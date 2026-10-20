const Booking = require('../models/Booking');
const Slot    = require('../models/Slot');
const Shop    = require('../models/Shop');
const { formatISTTime, getISTDateString } = require('../utils/ist');

exports.createBooking = async (req, res) => {
  try {
    const { shopId, slotId, rationCardNumber, mobileNumber, customerName, paymentId } = req.body;

    if (!shopId || !slotId || !rationCardNumber || !mobileNumber)
      return res.status(400).json({ success: false, message: 'All fields are required' });

    const slot = await Slot.findById(slotId);
    if (!slot) return res.status(404).json({ success: false, message: 'Slot not found' });
    if (slot.status === 'cancelled' || slot.status === 'locked') {
      return res.status(400).json({ success: false, message: `Slot is ${slot.status}` });
    }

    // Fraud: same mobile 3+ times same day
    const mobCount = await Booking.countDocuments({
      shopId, mobileNumber, slotDate: slot.date, status: { $ne: 'cancelled' }
    });
    if (mobCount >= 3)
      return res.status(400).json({ success: false, message: '⚠️ Too many bookings from this mobile number today.' });

    const cleanRc = rationCardNumber.trim().toUpperCase();
    const slotD = slot.date || new Date().toISOString().slice(0, 10);
    const dObj = new Date(slotD);
    const slotMonth = String(dObj.getMonth() + 1).padStart(2, '0');
    const slotYear = String(dObj.getFullYear());
    const periodPrefix = `${slotYear}-${slotMonth}`;

    // 1. Prevent duplicate booking for the SAME distribution period (month/year)
    const existingPeriodBooking = await Booking.findOne({
      rationCardNumber: cleanRc,
      slotDate: { $regex: '^' + periodPrefix },
      status: { $ne: 'cancelled' },
    });
    if (existingPeriodBooking) {
      return res.status(400).json({
        success: false,
        alreadyBooked: true,
        message: `⚠️ This ration card already has an active slot booking (Token #${existingPeriodBooking.tokenNumber}) for this distribution period on ${existingPeriodBooking.slotDate} at ${existingPeriodBooking.slotTime}. Further slot booking is not permitted in this period.`,
        booking: existingPeriodBooking,
      });
    }

    // 2. SmartPDS check: If ration has already been collected this month, disallow booking
    let headOfFamily = req.body.headOfFamily || '';
    let totalMembers = req.body.totalMembers || 1;
    let scheme = req.body.scheme || 'PHH';
    let entitlements = req.body.entitlements || [];
    let members = req.body.members || [];
    let totalGrain = req.body.totalGrain || 0;

    try {
      const { fetchSmartPdsCardDetails } = require('./fpsController');
      const cardData = await fetchSmartPdsCardDetails(cleanRc, slotMonth, slotYear);
      if (cardData && cardData.benficaryTransList && cardData.benficaryTransList.length > 0) {
        const t = cardData.benficaryTransList[0];
        return res.status(400).json({
          success: false,
          alreadyCollected: true,
          message: `Ration for this month has already been collected on ${t.avail_date} by ${t.availed_member_name} (${t.trans_status || 'Biometric'}). Further slot booking is not permitted.`
        });
      }

      if (cardData && cardData.beneficaryMemberList?.length > 0) {
        const memList = cardData.beneficaryMemberList;
        headOfFamily = memList[0]?.member_name_en || headOfFamily || 'Primary Cardholder';
        totalMembers = memList.length;
        scheme = memList[0]?.scheme_short_name || scheme;
        members = memList.map(m => ({
          memberId: m.member_id,
          name: m.member_name_en,
          age: m.member_age > 0 ? m.member_age : null,
          gender: m.gender_type_gt_type_id !== 'NA' ? m.gender_type_gt_type_id : '',
          kycUid: m.kyc_uid !== '-NA-' ? m.kyc_uid : '',
          active: m.active || 'Active',
          scheme: m.scheme_short_name || scheme,
        }));
      }

      if (cardData && cardData.benficaryEntitlementList?.length > 0) {
        entitlements = cardData.benficaryEntitlementList
          .filter(e => parseFloat(e.allocation_qty || 0) > 0)
          .map(e => ({
            commodity: e.comm_name_eng,
            qty: parseFloat(e.allocation_qty),
            unit: e.unit_type || 'KG',
            month: e.month_short_name,
          }));
        totalGrain = parseFloat(entitlements.reduce((sum, e) => sum + e.qty, 0).toFixed(2));
      }
    } catch (_) {}

    // Ensure beneficiary name is provided and matches verified family members
    const cleanCustomerName = (customerName || '').trim();
    if (!cleanCustomerName) {
      return res.status(400).json({ success: false, message: 'Beneficiary name is required.' });
    }
    if (members && members.length > 0) {
      const validNames = members.map(m => (m.name || '').trim().toLowerCase());
      if (!validNames.includes(cleanCustomerName.toLowerCase())) {
        return res.status(400).json({
          success: false,
          message: 'Selected beneficiary must be a verified family member from the ration card.'
        });
      }
    }

    // Atomically reserve slot to prevent race conditions under high concurrent traffic (10,000 users)
    let finalSlot = null;
    let isRaceConditionReassigned = false;
    let originalSlotTime = '';
    let raceConditionNote = '';

    // 1. First attempt: atomic reservation on the user's requested slot
    const updatedSlot = await Slot.findOneAndUpdate(
      {
        _id: slotId,
        status: 'active',
        $expr: { $lt: ['$bookedCount', '$capacity'] }
      },
      { $inc: { bookedCount: 1 } },
      { new: true }
    );

    if (updatedSlot) {
      finalSlot = updatedSlot;
      if (updatedSlot.bookedCount >= updatedSlot.capacity) {
        await Slot.updateOne({ _id: slotId }, { status: 'full' });
      }
    } else {
      // 2. RACE CONDITION DETECTED:
      // The requested slot was active when user selected it, but another user took the last seat
      // in that split second. Automatically manage race condition by allocating nearest available slot.
      isRaceConditionReassigned = true;
      originalSlotTime = formatISTTime(slot.startTime);

      // Find all other active, non-break candidate slots for this shop on the same date
      const candidateSlots = await Slot.find({
        shopId,
        date: slot.date,
        _id: { $ne: slot._id },
        status: 'active',
        isBreak: false,
        $expr: { $lt: ['$bookedCount', '$capacity'] }
      });

      // Sort candidate slots by absolute nearest time difference to the requested slot's startTime
      const requestedTimeMs = new Date(slot.startTime).getTime();
      candidateSlots.sort((a, b) => {
        const diffA = Math.abs(new Date(a.startTime).getTime() - requestedTimeMs);
        const diffB = Math.abs(new Date(b.startTime).getTime() - requestedTimeMs);
        if (diffA !== diffB) return diffA - diffB;
        // Tie-breaker: prefer upcoming / forward slot over earlier slot
        return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      });

      // Atomically claim the nearest candidate slot
      for (const cand of candidateSlots) {
        const reserved = await Slot.findOneAndUpdate(
          {
            _id: cand._id,
            status: 'active',
            $expr: { $lt: ['$bookedCount', '$capacity'] }
          },
          { $inc: { bookedCount: 1 } },
          { new: true }
        );
        if (reserved) {
          finalSlot = reserved;
          if (reserved.bookedCount >= reserved.capacity) {
            await Slot.updateOne({ _id: cand._id }, { status: 'full' });
          }
          break;
        }
      }

      if (!finalSlot) {
        // If all slots on the same date are full, check active candidate slots on subsequent dates
        const nextDatesSlots = await Slot.find({
          shopId,
          date: { $gt: slot.date },
          status: 'active',
          isBreak: false,
          $expr: { $lt: ['$bookedCount', '$capacity'] }
        }).sort({ date: 1, startTime: 1 }).limit(10);

        for (const cand of nextDatesSlots) {
          const reserved = await Slot.findOneAndUpdate(
            {
              _id: cand._id,
              status: 'active',
              $expr: { $lt: ['$bookedCount', '$capacity'] }
            },
            { $inc: { bookedCount: 1 } },
            { new: true }
          );
          if (reserved) {
            finalSlot = reserved;
            if (reserved.bookedCount >= reserved.capacity) {
              await Slot.updateOne({ _id: cand._id }, { status: 'full' });
            }
            break;
          }
        }
      }

      if (!finalSlot) {
        // If payment was verified, accommodate the beneficiary so paid bookings are never lost
        if (paymentId && paymentId !== 'N/A') {
          finalSlot = await Slot.findByIdAndUpdate(
            slot._id,
            { $inc: { bookedCount: 1 }, status: 'full' },
            { new: true }
          );
          const assignedSlotTime = formatISTTime(finalSlot.startTime);
          raceConditionNote = `Priority slot allocation confirmed on ${assignedSlotTime} following payment verification.`;
        } else {
          return res.status(400).json({
            success: false,
            message: 'Requested slot was filled during simultaneous booking, and no alternate slots remain available for this date. Please select another date.'
          });
        }
      }

      const assignedSlotTime = formatISTTime(finalSlot.startTime);
      if (!raceConditionNote) {
        raceConditionNote = `Auto-allotted to nearest available slot (${assignedSlotTime}) due to high-demand slot contention (original requested slot ${originalSlotTime} was filled concurrently).`;
      }
    }

    // Token number — sequential per shop per day, wraps at 999
    const last = await Booking.findOne({ shopId, slotDate: finalSlot.date }).sort({ tokenNumber: -1 });
    const tokenNumber = last ? (last.tokenNumber % 999) + 1 : 1;

    // Use IST-formatted time for display
    const slotTime = formatISTTime(finalSlot.startTime);

    const booking = await Booking.create({
      shopId,
      slotId: finalSlot._id,
      rationCardNumber: cleanRc,
      mobileNumber:     mobileNumber.trim(),
      customerName:     cleanCustomerName,
      tokenNumber,
      slotDate:         finalSlot.date,
      slotTime,
      paymentId:        paymentId || '',
      headOfFamily,
      totalMembers,
      scheme,
      entitlements,
      members,
      totalGrain,
      distributionPeriod: periodPrefix,
      reassignedDueToRaceCondition: isRaceConditionReassigned,
      originalSlotTime: isRaceConditionReassigned ? originalSlotTime : '',
      raceConditionNote: isRaceConditionReassigned ? raceConditionNote : '',
    });

    // Award 1 coin to the FPS owner on every successful booking
    await Shop.findOneAndUpdate({ shopId }, {
      $inc: { coins: 1, totalCoinsEarned: 1 },
    });

    return res.json({
      success: true,
      message: isRaceConditionReassigned
        ? `Booking confirmed! Auto-allotted to nearest available slot (${slotTime}) due to concurrent booking.`
        : 'Booking confirmed!',
      booking,
      tokenNumber,
      slotTime,
      reassignedDueToRaceCondition: isRaceConditionReassigned,
      originalSlotTime: isRaceConditionReassigned ? originalSlotTime : '',
      raceConditionNote: isRaceConditionReassigned ? raceConditionNote : '',
    });
  } catch (err) {
    if (err.code === 11000)
      return res.status(400).json({ success: false, message: 'Ration card already booked today.' });
    console.error('[Booking:create]', err);
    res.status(500).json({ success: false, message: 'Booking failed. Please try again.' });
  }
};

exports.getBookings = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { date, status } = req.query;
    const q = { shopId };
    if (date)   q.slotDate = date;
    if (status) q.status   = status;
    const bookings = await Booking.find(q).sort({ createdAt: -1 });
    res.json({ success: true, bookings, total: bookings.length });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch bookings' });
  }
};

/**
 * Check booking status by ration card number OR mobile number.
 * Does NOT require shopId — global search.
 */
exports.checkBookingStatus = async (req, res) => {
  try {
    const { rationCardNumber, mobileNumber } = req.query;

    if (!rationCardNumber && !mobileNumber)
      return res.status(400).json({ success: false, message: 'Provide rationCardNumber or mobileNumber' });

    const q = { status: { $ne: 'cancelled' } };
    if (rationCardNumber) q.rationCardNumber = rationCardNumber.trim().toUpperCase();
    if (mobileNumber)     q.mobileNumber     = mobileNumber.trim();

    const bookings = await Booking.find(q).sort({ createdAt: -1 }).limit(10);

    if (!bookings.length)
      return res.status(404).json({ success: false, message: 'No active bookings found.' });

    // Attach shop details to each booking
    const shopIds = [...new Set(bookings.map(b => b.shopId))];
    const shops   = await Shop.find({ shopId: { $in: shopIds } }).select('shopId shopName apiSnapshot');
    const shopMap = Object.fromEntries(shops.map(s => [s.shopId, s]));

    const enriched = bookings.map(b => {
      const shop = shopMap[b.shopId] || {};
      return {
        ...b.toObject(),
        shopName:    shop.shopName     || b.shopId,
        shopAddress: shop.apiSnapshot?.address || '',
      };
    });

    res.json({ success: true, bookings: enriched });
  } catch (err) {
    console.error('[Booking:checkStatus]', err);
    res.status(500).json({ success: false, message: 'Status check failed' });
  }
};

/** Legacy check (requires shopId) — kept for backward compat */
exports.checkBooking = async (req, res) => {
  try {
    const { shopId, mobileNumber } = req.query;
    if (!shopId || !mobileNumber)
      return res.status(400).json({ success: false, message: 'shopId and mobileNumber are required' });
    const bookings = await Booking.find({
      shopId, mobileNumber, status: { $ne: 'cancelled' }
    }).sort({ createdAt: -1 }).limit(5);
    if (!bookings.length)
      return res.status(404).json({ success: false, message: 'No bookings found for this mobile number.' });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Check failed' });
  }
};

exports.cancelBooking = async (req, res) => {
  try {
    const existing = await Booking.findById(req.params.bookingId);
    if (!existing) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (req.auth.role !== 'ADMIN' && existing.shopId !== req.auth.shopId) {
      return res.status(403).json({ success: false, message: 'You can only manage bookings for your own FPS.' });
    }
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId, { $set: { status: 'cancelled' } }, { new: true }
    );
    await Slot.findByIdAndUpdate(booking.slotId, {
      $inc: { bookedCount: -1 }, $set: { status: 'active' },
    });
    res.json({ success: true, message: 'Booking cancelled', booking });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Cancel failed' });
  }
};

exports.exportBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ shopId: req.params.shopId }).sort({ createdAt: -1 });
    const csv = ['Token,Ration Card,Customer,Mobile,Date,Time (IST),Status']
      .concat(bookings.map(b =>
        `${b.tokenNumber},${b.rationCardNumber},"${b.customerName}",${b.mobileNumber},${b.slotDate},${b.slotTime},${b.status}`
      )).join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=bookings_${req.params.shopId}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Export failed' });
  }
};

/**
 * Verify Ration Card Allocation & Check Collection Status via SmartPDS SRC_Trans_Int
 * POST /api/bookings/verify-card or GET /api/bookings/verify-card
 */
exports.verifyCardAllocation = async (req, res) => {
  try {
    const rationCard = (req.query.rationCardNumber || req.body?.rationCardNumber || req.query.rationCard || req.body?.rationCard || req.query.src_no || req.body?.src_no || '').trim();
    const date = req.query.date || req.body?.date;
    const now = new Date();
    let month = req.query.month || req.body?.month;
    let year = req.query.year || req.body?.year;

    if (!month && date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        month = String(d.getMonth() + 1);
        year = String(d.getFullYear());
      }
    }
    if (!month) month = String(now.getMonth() + 1);
    if (!year) year = String(now.getFullYear());

    if (!rationCard) {
      return res.status(400).json({ success: false, message: 'Ration card number is required' });
    }

    const { fetchSmartPdsCardDetails } = require('./fpsController');
    const cardData = await fetchSmartPdsCardDetails(rationCard, month, year);

    if (!cardData || cardData.respcode !== '200') {
      return res.status(404).json({
        success: false,
        eligible: false,
        message: `Ration card "${rationCard}" not found for ${month}/${year}. Please check your 12-digit ration card number.`
      });
    }

    const memberList = cardData.beneficaryMemberList || [];
    const transList = cardData.benficaryTransList || [];
    const entitlementList = (cardData.benficaryEntitlementList || [])
      .filter(e => parseFloat(e.allocation_qty || 0) > 0)
      .map(e => ({
        commodity: e.comm_name_eng,
        qty: parseFloat(e.allocation_qty),
        unit: e.unit_type || 'KG',
        month: e.month_short_name,
      }));
    const monthName = entitlementList[0]?.month || 'this month';
    const periodPrefix = `${year}-${String(month).padStart(2, '0')}`;
    const cleanRc = rationCard.toUpperCase().trim();

    // 1. Check if slot is ALREADY BOOKED for this distribution period
    const existingPeriodBooking = await Booking.findOne({
      rationCardNumber: cleanRc,
      slotDate: { $regex: '^' + periodPrefix },
      status: { $ne: 'cancelled' },
    });
    if (existingPeriodBooking) {
      return res.json({
        success: true,
        eligible: false,
        alreadyBooked: true,
        alreadyCollected: false,
        message: `⚠️ This ration card already has an active slot booking (Token #${existingPeriodBooking.tokenNumber}) for this distribution period (${month}/${year}) on ${existingPeriodBooking.slotDate} at ${existingPeriodBooking.slotTime}. Further slot booking is not permitted in this period.`,
        existingBooking: {
          tokenNumber: existingPeriodBooking.tokenNumber,
          slotDate: existingPeriodBooking.slotDate,
          slotTime: existingPeriodBooking.slotTime,
          shopId: existingPeriodBooking.shopId,
          customerName: existingPeriodBooking.customerName,
          headOfFamily: existingPeriodBooking.headOfFamily,
          status: existingPeriodBooking.status,
        },
        members: memberList.map(m => ({
          memberId: m.member_id,
          name: m.member_name_en,
          age: m.member_age > 0 ? m.member_age : null,
          gender: m.gender_type_gt_type_id !== 'NA' ? m.gender_type_gt_type_id : '',
          active: m.active,
          kycUid: m.kyc_uid !== '-NA-' ? m.kyc_uid : '',
          scheme: m.scheme_short_name,
        })),
        entitlements: entitlementList,
      });
    }

    // 2. If benficaryTransList has transactions => Ration is ALREADY COLLECTED
    if (transList.length > 0) {
      const t = transList[0];
      const validCommodities = (t.commoditylist || [])
        .filter(c => parseFloat(c.allot_qty || c.sale_qty || c.availed_qty || 0) > 0)
        .map(c => ({
          commodity: c.comm_short || c.comm_name_en || 'Grain',
          qty: parseFloat((c.allot_qty || c.sale_qty || c.availed_qty || 0).toFixed(2)),
          unit: c.unit_type || 'KG',
        }));

      return res.json({
        success: true,
        eligible: false,
        alreadyCollected: true,
        alreadyBooked: false,
        message: `⚠️ Ration for ${monthName} has already been collected on ${t.avail_date} by ${t.availed_member_name} (${t.trans_status || 'Biometric'}). Further slot booking is not permitted for this month.`,
        trans: {
          availDate: t.avail_date,
          availedBy: t.availed_member_name,
          transType: t.trans_status,
          fpsId: t.port_fpsid,
          commodities: validCommodities,
        },
        members: memberList.map(m => ({
          memberId: m.member_id,
          name: m.member_name_en,
          age: m.member_age > 0 ? m.member_age : null,
          gender: m.gender_type_gt_type_id !== 'NA' ? m.gender_type_gt_type_id : '',
          active: m.active,
          kycUid: m.kyc_uid !== '-NA-' ? m.kyc_uid : '',
          scheme: m.scheme_short_name,
        })),
        entitlements: entitlementList,
      });
    }

    // 3. If benficaryTransList is empty & not yet booked => Eligible for booking
    const totalGrain = parseFloat(entitlementList.reduce((sum, e) => sum + e.qty, 0).toFixed(2));
    const headOfFamily = memberList[0]?.member_name_en || 'Primary Cardholder';

    return res.json({
      success: true,
      eligible: true,
      alreadyCollected: false,
      alreadyBooked: false,
      message: `Ration allocation verified for ${monthName}. Please confirm your family and allotment details to proceed with slot booking.`,
      members: memberList.map(m => ({
        memberId: m.member_id,
        name: m.member_name_en,
        age: m.member_age > 0 ? m.member_age : null,
        gender: m.gender_type_gt_type_id !== 'NA' ? m.gender_type_gt_type_id : '',
        active: m.active,
        kycUid: m.kyc_uid !== '-NA-' ? m.kyc_uid : '',
        scheme: m.scheme_short_name,
      })),
      entitlements: entitlementList,
      totalGrain,
      headOfFamily,
      totalMembers: memberList.length,
      scheme: memberList[0]?.scheme_short_name || 'PHH',
      shopId: memberList[0]?.fps_id,
      district: memberList[0]?.dist_name_en,
      block: memberList[0]?.afso_name_en,
    });
  } catch (err) {
    console.error('[verifyCardAllocation]', err);
    res.status(500).json({ success: false, message: 'Error checking ration card: ' + err.message });
  }
};
