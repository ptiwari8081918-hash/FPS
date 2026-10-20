/**
 * Coin Controller — FPS Owner Coin System
 * 1 coin = ₹0.5 | Claim via Bank / UPI / QR
 */
const Shop = require('../models/Shop');
const path = require('path');
const fs   = require('fs');

const COIN_VALUE = 0.5; // INR per coin

/** Get coin balance for a shop */
exports.getCoinBalance = async (req, res) => {
  try {
    const shop = await Shop.findOne({ shopId: req.params.shopId })
      .select('coins totalCoinsEarned claims shopName');
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const pendingCoins = (shop.claims || [])
      .filter(c => c.status === 'pending')
      .reduce((s, c) => s + c.coins, 0);

    res.json({
      success: true,
      coins:            shop.coins,
      totalEarned:      shop.totalCoinsEarned,
      pendingCoins,
      pendingAmount:    pendingCoins * COIN_VALUE,
      availableAmount:  shop.coins * COIN_VALUE,
      claims:           shop.claims,
    });
  } catch (err) {
    console.error('[Coins:balance]', err);
    res.status(500).json({ success: false, message: 'Failed to fetch coin balance' });
  }
};

/** Submit a coin claim request */
exports.claimCoins = async (req, res) => {
  try {
    const { shopId } = req.params;
    const { method, coins, bankName, accountNumber, ifscCode, accountHolder, upiId } = req.body;

    if (!method || !['bank', 'upi', 'qr'].includes(method))
      return res.status(400).json({ success: false, message: 'Invalid claim method' });

    const coinsNum = parseInt(coins);
    if (!coinsNum || coinsNum < 1)
      return res.status(400).json({ success: false, message: 'Invalid coin amount' });

    const shop = await Shop.findOne({ shopId });
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    if (shop.coins < coinsNum)
      return res.status(400).json({ success: false, message: `Insufficient coins. Available: ${shop.coins}` });

    // Build claim payload
    const claim = {
      method, coins: coinsNum, amount: coinsNum * COIN_VALUE, status: 'pending',
    };

    if (method === 'bank') {
      if (!accountNumber || !ifscCode || !accountHolder)
        return res.status(400).json({ success: false, message: 'Bank details are incomplete' });
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase()))
        return res.status(400).json({ success: false, message: 'Invalid IFSC code format' });
      Object.assign(claim, { bankName, accountNumber, ifscCode: ifscCode.toUpperCase(), accountHolder });
    } else if (method === 'upi') {
      if (!upiId) return res.status(400).json({ success: false, message: 'UPI ID is required' });
      claim.upiId = upiId;
    } else if (method === 'qr') {
      // QR image stored as base64 in req.body.qrImageUrl
      if (!req.body.qrImageUrl)
        return res.status(400).json({ success: false, message: 'QR image is required' });
      claim.qrImageUrl = req.body.qrImageUrl; // base64 data URI
    }

    // Deduct coins and add claim atomically
    await Shop.findOneAndUpdate(
      { shopId, coins: { $gte: coinsNum } },
      { $inc: { coins: -coinsNum }, $push: { claims: claim } },
    );

    res.json({
      success: true,
      message: `Claim of ₹${claim.amount} submitted. Admin will process within 48 hours.`,
    });
  } catch (err) {
    console.error('[Coins:claim]', err);
    res.status(500).json({ success: false, message: 'Claim submission failed' });
  }
};

/** Admin: list all pending claims */
exports.listPendingClaims = async (req, res) => {
  try {
    const shops = await Shop.find({ 'claims.status': 'pending' })
      .select('shopId shopName coins claims');
    const claims = [];
    shops.forEach(s => {
      (s.claims || []).filter(c => c.status === 'pending').forEach(c => {
        claims.push({ ...c.toObject(), shopId: s.shopId, shopName: s.shopName });
      });
    });
    res.json({ success: true, claims });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to list claims' });
  }
};

/** Admin: approve or reject a claim */
exports.processClaim = async (req, res) => {
  try {
    const { shopId, claimId } = req.params;
    const { action, adminNote } = req.body; // action: 'approved' | 'rejected'

    if (!['approved', 'rejected'].includes(action))
      return res.status(400).json({ success: false, message: 'Invalid action' });

    const shop = await Shop.findOne({ shopId });
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found' });

    const claim = shop.claims.id(claimId);
    if (!claim) return res.status(404).json({ success: false, message: 'Claim not found' });
    if (claim.status !== 'pending')
      return res.status(400).json({ success: false, message: 'Claim is already processed' });

    claim.status      = action;
    claim.verified    = action === 'approved';
    claim.adminNote   = adminNote || '';
    claim.processedAt = new Date();

    // If rejected, refund coins
    if (action === 'rejected') shop.coins += claim.coins;

    await shop.save();
    res.json({ success: true, message: `Claim ${action}`, claim });
  } catch (err) {
    console.error('[Coins:process]', err);
    res.status(500).json({ success: false, message: 'Failed to process claim' });
  }
};
