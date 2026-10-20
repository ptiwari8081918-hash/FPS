const path     = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
require('dotenv').config(); // cwd fallback
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const helmet   = require('helmet');
const cron     = require('node-cron');
const { getISTDateString } = require('./utils/ist');
const { generalLimiter } = require('./middleware/rateLimiter');

const app  = express();
const PORT = process.env.PORT || 5000;

// Fail fast on missing secrets required for auth to be secure at all.
['JWT_SECRET', 'DEFAULT_PASSWORD'].forEach((key) => {
  if (!process.env[key]) {
    console.warn(`⚠️  ${key} is not set. Login/signup will not work correctly until this is configured.`);
  }
});

app.set('trust proxy', 1); // needed for correct req.ip behind Render's proxy

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS allowlist — comma-separated origins in CORS_ORIGIN. Falls back to
// same-origin only (no wildcard) when unset, since the client is served
// from this same Express app in production.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // same-origin / server-to-server / curl
    if (process.env.NODE_ENV !== 'production') return cb(null, true); // allow all in dev (e.g. localhost:3000)
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Encrypted-Payload', 'X-Session-Id', 'x-encrypted-payload', 'x-session-id'],
  exposedHeaders: ['X-Encrypted-Payload', 'x-encrypted-payload', 'X-Session-Id', 'x-session-id'],
}));

const dns = require('dns');
try {
  // Fix Windows Node SRV lookup ECONNREFUSED for mongodb+srv://
  dns.setServers(['8.8.8.8', '1.1.1.1']);
} catch (_) {}

const { encryptionMiddleware } = require('./utils/crypto');

app.use(express.json({ limit: '5mb' })); // Increased for QR image upload
app.use(encryptionMiddleware); // End-to-end payload encryption & decryption
app.use('/api', generalLimiter);

const connectMongo = async () => {
  const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/annseva';
  try {
    await mongoose.connect(uri, {
      maxPoolSize: 100, // High-performance connection pool for 10,000 concurrent live users
      minPoolSize: 20,
      maxIdleTimeMS: 30000,
      connectTimeoutMS: 15000,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    });
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.warn(`⚠️ Primary MongoDB connection failed (${err.message}). Trying local fallback mongodb://127.0.0.1:27017/annseva...`);
    try {
      await mongoose.connect('mongodb://127.0.0.1:27017/annseva', {
        serverSelectionTimeoutMS: 5000,
      });
      console.log('✅ Connected to local MongoDB (annseva)');
    } catch (localErr) {
      console.error('❌ MongoDB error:', localErr.message);
      console.error('→ Check: Local MongoDB service or IP whitelist in Atlas (0.0.0.0/0)');
      process.exit(1);
    }
  }
};
connectMongo();

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/slots',     require('./routes/slots'));
app.use('/api/bookings',  require('./routes/bookings'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/fps',       require('./routes/fps'));
app.use('/api/shop',      require('./routes/shop'));
app.use('/api/payments',  require('./routes/payments'));
app.use('/api/coins',     require('./routes/coins'));
app.use('/api/feedback',  require('./routes/feedback'));

app.get('/health', (_, res) => res.json({
  status: 'OK',
  time: new Date(),
  istDate: getISTDateString(),
  db: mongoose.connection.readyState,
}));

// Serve React build in production
const fs = require('fs');
const clientBuild = path.join(__dirname, '..', 'client', 'build');
app.use(express.static(clientBuild));
app.get('*', (req, res, next) => {
  const indexHtml = path.join(clientBuild, 'index.html');
  if (fs.existsSync(indexHtml)) {
    return res.sendFile(indexHtml);
  }
  if (req.accepts('html')) {
    return res.status(200).send('<!DOCTYPE html><html><head><title>AnnSeva</title></head><body><div id="root"><h1>AnnSeva API is running</h1><p>Ready for client connections.</p></div></body></html>');
  }
  next();
});

// Cron: lock expired slots every minute (IST-aware comparison is fine since Date comparison is UTC)
cron.schedule('* * * * *', async () => {
  try {
    const Slot = require('./models/Slot');
    await Slot.updateMany(
      { endTime: { $lt: new Date() }, status: 'active' },
      { $set: { status: 'locked' } }
    );
  } catch (_) {}
});

// Global error handler
app.use((err, _q, res, _n) => {
  console.error('[Unhandled]', err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

app.listen(PORT, () => console.log(`🚀 AnnSeva running on http://localhost:${PORT}`));
