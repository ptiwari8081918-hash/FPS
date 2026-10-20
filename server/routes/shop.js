const r = require('express').Router();
const Shop = require('../models/Shop');
const { requireAuth } = require('../middleware/auth');
const { requireOwnShop } = require('../middleware/roles');
const { logAction } = require('../utils/audit');

r.get('/:shopId', requireAuth, requireOwnShop, async (req, res) => {
  try {
    const s = await Shop.findOne({ shopId: req.params.shopId });
    if (!s) return res.status(404).json({ success: false });
    res.json({ success: true, shop: s });
  } catch (e) { res.status(500).json({ success: false }); }
});

// NOTE: password is intentionally NOT accepted here — it can only be changed
// via POST /api/auth/change-password, which verifies the current password.
r.patch('/:shopId', requireAuth, requireOwnShop, async (req, res) => {
  try {
    const { language, slotDuration, slotCapacity } = req.body;
    const upd = {};
    if (language) upd.language = language;
    if (slotDuration) upd.slotDuration = parseInt(slotDuration);
    if (slotCapacity) upd.slotCapacity = parseInt(slotCapacity);
    const s = await Shop.findOneAndUpdate({ shopId: req.params.shopId }, { $set: upd }, { new: true });
    if (!s) return res.status(404).json({ success: false });
    await logAction(req, 'PROFILE_UPDATE', { metadata: upd });
    res.json({ success: true, shop: s });
  } catch (e) { res.status(500).json({ success: false }); }
});

module.exports = r;
