const Feedback = require('../models/Feedback');

// POST /api/feedback — public, only one feedback allowed per user / device / IP
exports.submitFeedback = async (req, res) => {
  try {
    const { name, mobile, email, category, message, rating, shopId, rationCard, clientToken } = req.body;
    if (!name || !message) {
      return res.status(400).json({ success: false, message: 'Name and message are required.' });
    }
    if (String(message).trim().length > 1000) {
      return res.status(400).json({ success: false, message: 'Message must be 1000 characters or less.' });
    }
    if (rating && (rating < 1 || rating > 5)) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5.' });
    }

    const cleanMobile     = mobile ? String(mobile).replace(/\D/g, '').slice(-10) : '';
    const cleanEmail      = email  ? String(email).trim().toLowerCase() : '';
    const cleanRationCard = rationCard ? String(rationCard).trim().toUpperCase() : '';
    const cleanToken      = clientToken ? String(clientToken).trim() : '';
    const clientIp        = (req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || '').trim();

    // Check if feedback has already been submitted by this client / identity
    const dedupeConditions = [];
    if (cleanToken)      dedupeConditions.push({ clientToken: cleanToken });
    if (cleanMobile)     dedupeConditions.push({ mobile: cleanMobile });
    if (cleanEmail)      dedupeConditions.push({ email: cleanEmail });
    if (cleanRationCard) dedupeConditions.push({ rationCard: cleanRationCard });
    
    // Only enforce global IP block for public internet IPs (avoid locking out local dev or office NAT)
    const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(clientIp) || clientIp.startsWith('192.168.') || clientIp.startsWith('10.');
    if (clientIp && !isLocalhost) {
      dedupeConditions.push({ ipAddress: clientIp });
    }

    if (dedupeConditions.length > 0) {
      const existing = await Feedback.findOne({ $or: dedupeConditions }).lean();
      if (existing) {
        return res.status(409).json({
          success: false,
          alreadySubmitted: true,
          message: 'Feedback has already been submitted from your account/device. Only one feedback submission is allowed.',
        });
      }
    }

    const fb = await Feedback.create({
      name:        String(name).trim(),
      mobile:      cleanMobile || undefined,
      email:       cleanEmail || undefined,
      category:    category || 'general',
      message:     String(message).trim(),
      rating:      rating ? Number(rating) : undefined,
      shopId:      shopId ? String(shopId).trim() : undefined,
      rationCard:  cleanRationCard || undefined,
      clientToken: cleanToken || undefined,
      ipAddress:   clientIp || undefined,
    });

    return res.status(201).json({ success: true, message: 'Thank you! Your feedback has been recorded.', id: fb._id });
  } catch (err) {
    console.error('[Feedback]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// GET /api/feedback — admin-only summary (protected elsewhere via requireAuth + role)
exports.listFeedback = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Feedback.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Feedback.countDocuments(),
    ]);

    res.json({ success: true, feedback: items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[Feedback/list]', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

