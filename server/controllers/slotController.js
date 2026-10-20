const Slot = require('../models/Slot');
const Shop = require('../models/Shop');
const { buildISTDate, formatISTTime, getISTDateString } = require('../utils/ist');

/**
 * Build slots for a single date using IST-aware times.
 * All Date objects are stored in UTC internally by MongoDB;
 * the IST offset (UTC+5:30) is accounted for here.
 */
function buildSlots(shopId, date, opts = {}) {
  const {
    startHour = 9, endHour = 17,
    duration = 5, capacity = 10,
    breakAfterMinutes = 60, breakDuration = 20,
  } = opts;

  const dur = Math.max(1, Math.min(60, parseInt(duration)));

  // Validate date is a real calendar date
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return [];

  // Build start/end as IST-aware UTC Dates
  const start = buildISTDate(date, parseInt(startHour), 0);
  const end   = buildISTDate(date, parseInt(endHour), 0);

  if (start >= end) return []; // Invalid range guard

  const slots = [];
  let cur = new Date(start);
  let minSince = 0;

  while (cur < end) {
    // Insert break slot if needed
    if (minSince >= breakAfterMinutes) {
      const bEnd = new Date(cur);
      bEnd.setMinutes(bEnd.getMinutes() + parseInt(breakDuration));
      if (bEnd <= end) {
        slots.push({
          shopId, date,
          startTime: new Date(cur), endTime: bEnd,
          duration: parseInt(breakDuration),
          capacity: 0, bookedCount: 0,
          status: 'locked', isBreak: true,
        });
        cur = bEnd; minSince = 0; continue;
      } else break;
    }

    const slotEnd = new Date(cur);
    slotEnd.setMinutes(slotEnd.getMinutes() + dur);

    // Strict guard: slot must fit entirely within the day's end
    if (slotEnd > end) break;

    slots.push({
      shopId, date,
      startTime: new Date(cur), endTime: slotEnd,
      duration: dur, capacity: parseInt(capacity),
      bookedCount: 0, status: 'active', isBreak: false,
    });

    minSince += dur;
    cur = slotEnd;
  }

  return slots;
}

/** Generate slots for a single date */
exports.generateSlots = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { date, ...opts } = req.body;

    if (!date) return res.status(400).json({ success: false, message: 'Date is required' });

    // Validate date format strictly
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
      return res.status(400).json({ success: false, message: 'Invalid date format. Use YYYY-MM-DD' });

    await Slot.deleteMany({ shopId, date });
    const slots = buildSlots(shopId, date, opts);
    if (slots.length) await Slot.insertMany(slots);

    res.json({ success: true, message: `${slots.length} slots created for ${date}`, count: slots.length });
  } catch (err) {
    console.error('[generateSlots]', err);
    res.status(500).json({ success: false, message: 'Failed to generate slots' });
  }
};

/**
 * Generate slots for multiple dates (weekly repeat).
 * Only generates for dates within [today, validUntil] — no overflow.
 */
exports.repeatSlots = async (req, res) => {
  try {
    const { shopId } = req.params;
    const {
      startHour, endHour, duration, capacity,
      breakAfterMinutes, breakDuration,
      daysOfWeek = [1, 2, 3, 4, 5, 6],
      validUntil,
    } = req.body;

    if (!validUntil) return res.status(400).json({ success: false, message: 'validUntil is required' });

    // Validate validUntil format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validUntil))
      return res.status(400).json({ success: false, message: 'Invalid validUntil format. Use YYYY-MM-DD' });

    // Use IST today as start, validUntil as inclusive end
    const todayIST = getISTDateString();
    const [ty, tm, td] = todayIST.split('-').map(Number);
    const [uy, um, ud] = validUntil.split('-').map(Number);

    const startDate = new Date(Date.UTC(ty, tm - 1, td));
    const untilDate = new Date(Date.UTC(uy, um - 1, ud));

    if (untilDate < startDate)
      return res.status(400).json({ success: false, message: 'validUntil must be today or in the future' });

    // Safety cap: no more than 90 days ahead
    const maxAhead = new Date(startDate);
    maxAhead.setUTCDate(maxAhead.getUTCDate() + 90);
    const effectiveUntil = untilDate > maxAhead ? maxAhead : untilDate;

    const results = [];
    let cursor = new Date(startDate);

    while (cursor <= effectiveUntil) {
      const dow = cursor.getUTCDay(); // 0=Sun, 1=Mon...
      const normalised = dow === 0 ? 7 : dow; // allow both 0 and 7 for Sunday

      if (daysOfWeek.includes(dow) || daysOfWeek.includes(normalised)) {
        const ds = cursor.toISOString().slice(0, 10);
        await Slot.deleteMany({ shopId, date: ds });
        const slots = buildSlots(shopId, ds, { startHour, endHour, duration, capacity, breakAfterMinutes, breakDuration });
        if (slots.length) await Slot.insertMany(slots);
        results.push({ date: ds, count: slots.length });
      }

      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    res.json({ success: true, message: `Slots created for ${results.length} days`, results });
  } catch (err) {
    console.error('[repeatSlots]', err);
    res.status(500).json({ success: false, message: 'Failed to repeat slots' });
  }
};

exports.getSlots = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { date } = req.query;
    const q = { shopId };
    if (date) q.date = date;
    const slots = await Slot.find(q).sort({ startTime: 1 });
    res.json({ success: true, slots });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch slots' });
  }
};

exports.updateSlot = async (req, res) => {
  try {
    const existing = await Slot.findById(req.params.slotId);
    if (!existing) return res.status(404).json({ success: false, message: 'Slot not found' });
    if (req.auth.role !== 'ADMIN' && existing.shopId !== req.auth.shopId) {
      return res.status(403).json({ success: false, message: 'You can only manage slots for your own FPS.' });
    }
    const { status, capacity, duration } = req.body;
    const upd = {};
    if (status   !== undefined) upd.status   = status;
    if (capacity !== undefined) upd.capacity = parseInt(capacity);
    if (duration !== undefined) upd.duration = parseInt(duration);
    const slot = await Slot.findByIdAndUpdate(req.params.slotId, { $set: upd }, { new: true });
    res.json({ success: true, slot });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update slot' });
  }
};

exports.deleteSlot = async (req, res) => {
  try {
    const existing = await Slot.findById(req.params.slotId);
    if (!existing) return res.status(404).json({ success: false, message: 'Slot not found' });
    if (req.auth.role !== 'ADMIN' && existing.shopId !== req.auth.shopId) {
      return res.status(403).json({ success: false, message: 'You can only manage slots for your own FPS.' });
    }
    await Slot.findByIdAndDelete(req.params.slotId);
    res.json({ success: true, message: 'Slot deleted' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete slot' });
  }
};
