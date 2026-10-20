const express = require('express');
const router = express.Router();
const crypto = require('crypto');

let Razorpay;
try { Razorpay = require('razorpay'); } catch (_) {}

router.post('/create-order', async (req, res) => {
  try {
    if (!Razorpay) return res.status(503).json({ success: false, message: 'Payment service unavailable' });
    const instance = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
    const order = await instance.orders.create({
      amount: 100,
      currency: 'INR',
      receipt: `slot_${Date.now()}`,
      notes: { purpose: 'Slot booking fee' },
    });
    res.json({ success: true, order, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    console.error('[Payment]', err.message);
    res.status(500).json({ success: false, message: 'Could not create payment order' });
  }
});

router.post('/verify', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expected = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest('hex');
    if (expected !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed' });
    }
    res.json({ success: true, paymentId: razorpay_payment_id });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Verification error' });
  }
});

module.exports = router;
