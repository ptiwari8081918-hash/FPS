# 🌾 AnnSeva — UP FPS Slot Booking & Distribution Management System

A production-grade cloud platform engineered for **Uttar Pradesh Fair Price Shops (FPS)** under the National Food Security Act (NFSA) and Public Distribution System (PDS). 

AnnSeva digitises ration token distribution, integrates in real-time with official **SmartPDS ePOS** transaction endpoints, prevents duplicate booking per distribution cycle, provides atomic slot scheduling for up to **10,000 concurrent live citizens**, and rewards FPS shop dealers through an automated incentive wallet.

---

## 🌟 Core System Features

### 1. 🔍 Official SmartPDS ePOS Integration (`SRC_Trans_Int`)
- **Real-time Quota Verification:** Automatically fetches monthly food grain entitlements (Wheat, Rice, Sugar) by querying official UP SmartPDS servers.
- **Ration Collection Status:** Detects if ration for the current distribution month has already been availed electronically at any ePOS machine, preventing unauthorized duplicate slot allocations.
- **Active Family Members List:** Fetches verified cardholder family members with Aadhaar seeding and KYC status.

### 2. 👨‍👩‍👧‍👦 Mandatory Verified Beneficiary Selection
- Enforces strict verification so that the citizen booking the token **must explicitly select an authorized family member** registered on the ration card.
- Prevents manual typing of random/unverified names.
- The chosen beneficiary is captured on the token receipt for biometric fingerprint/IRIS matching at the FPS counter.

### 3. ⛔ Distribution Cycle Duplicate Prevention
- Automatically tracks and prevents multiple active bookings for the same ration card within the same calendar distribution period (`YYYY-MM`).
- Returns existing active token details if a citizen attempts duplicate booking.

### 4. ⚡ 10,000 Live Concurrent Users Architecture
- **Atomic Operations:** Uses MongoDB `$expr` and atomic `findOneAndUpdate` queries to avoid race conditions when thousands of citizens simultaneously attempt to book the same slot.
- **Optimized Connection Pooling:** Mongoose connection pool tuned with `maxPoolSize: 100`, `minPoolSize: 20`, and custom keep-alive timeouts.
- **High-Performance Compound Indexes:** Optimized indexing across `[rationCardNumber, slotDate, status]`, `[shopId, slotDate, tokenNumber]`, and `[shopId, date, status]` ensures sub-50ms query latency under peak load.
- **Cellular NAT Rate Limiting:** High-concurrency friendly rate limiting (up to 5,000 requests / 15 min with OPTIONS bypass) to protect servers against DDoS while preventing false 429 blocks for citizens sharing carrier-grade mobile NAT IPs (Jio/Airtel).

### 5. 🔐 End-to-End Cryptographic Security
- **AES-256-GCM Payload Encryption:** Transparent browser-to-server and server-to-browser encryption for sensitive transaction data.
- **Bcrypt Password Security:** 12-round salted hashing for all FPS accounts. Plaintext passwords are never stored or logged.
- **Password Change Verification:** Strictly validates the dealer's current password against the stored bcrypt hash before authorizing any password updates.
- **Default Credentials Enforcement:** Initial FPS dealer login enforces default password `jaihind` and mandates immediate password update before dashboard access is unlocked.
- **Session Lifecycle & Invalidation:** Server-side session rotation and token invalidation on password updates and logouts.

### 6. 🖨️ Official Government E-Token Print Receipt
- Clean, printable single-page token receipt formatted for standard thermal or laser printers.
- Includes official token number, allotment date/time window, family member count, head of family, allocated grain quota (Wheat/Rice KG), and toll-free helpline numbers.

### 7. 🪙 FPS Dealer Coin & Incentive Wallet
- **+1 Coin earned** by FPS owners on every confirmed booking.
- Exchange rate: **1 Coin = ₹0.50**.
- Payout claims supported via Direct Bank Transfer (NEFT/IMPS), UPI ID, or QR Code.

---

## 📁 Repository Structure

```
fpsbooking/
├── client/                     # React 18 Frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── LandingPage.js             # Public Landing & Global Status Lookup
│   │   │   ├── CustomerPage.js            # SmartPDS Verification & Slot Booking Flow
│   │   │   ├── DashboardPage.js           # FPS Dealer Management Portal
│   │   │   └── dashboard/
│   │   │       ├── DashboardHome.js       # Live metrics & Portability data
│   │   │       ├── SlotManager.js         # IST Slot Generation & Capacity Control
│   │   │       ├── BookingsList.js        # Active & completed bookings management
│   │   │       ├── AnalyticsPage.js       # Distribution analytics & charts
│   │   │       ├── FPSDataPage.js         # UPPDS monthly allocation snapshot
│   │   │       ├── CoinClaimPage.js       # Dealer coin wallet & redemption claims
│   │   │       └── ChangePasswordPage.js  # Verified password rotation
│   │   ├── components/                    # Reusable UI components
│   │   └── utils/
│   │       ├── api.js                     # End-to-end encrypted HTTP client
│   │       └── dateUtils.js               # Indian Standard Time (IST) utilities
│   └── package.json
│
├── server/                     # Node.js + Express Backend
│   ├── controllers/
│   │   ├── authController.js              # Authentication, UPPDS check & password rotation
│   │   ├── bookingController.js           # Atomic booking, period check & SmartPDS validation
│   │   ├── slotController.js              # IST slot generation & lock scheduler
│   │   ├── coinController.js              # Dealer reward wallet & settlement claims
│   │   └── fpsController.js               # SmartPDS ePOS integration proxy
│   ├── middleware/
│   │   ├── auth.js                        # JWT verification & session tracking
│   │   └── rateLimiter.js                 # High-concurrency DDoS & brute-force protection
│   ├── models/
│   │   ├── Booking.js                     # Indexed booking model with period snapshot
│   │   ├── Shop.js                        # FPS shop credentials & coin wallet
│   │   ├── Slot.js                        # Atomic slot capacity model
│   │   └── Session.js                     # Server-side active session store
│   ├── utils/
│   │   ├── crypto.js                      # AES-256-GCM payload encryption
│   │   └── ist.js                         # Asia/Kolkata date & time handling
│   └── index.js                           # Express entry point, Atlas pooling & DNS configuration
│
├── .env.example                # Safe environment variable template
├── .gitignore                  # Git ignore rules (strict exclusion of .env files)
├── render.yaml                 # Cloud deployment specification
└── package.json                # Project root scripts
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the project root or in `server/.env` based on `.env.example`:

```env
NODE_ENV=development
PORT=5000

# MongoDB Atlas URI (Use SRV format or standard replica set)
MONGO_URI=mongodb+srv://<username>:<password>@<cluster-url>/annseva?retryWrites=true&w=majority

# Initial password for newly created FPS accounts (mandatory change on first login)
DEFAULT_PASSWORD=jaihind

# Secret for signing JWT tokens (64-byte random string)
JWT_SECRET=your_jwt_secret_key_here

# AES-256-GCM payload encryption key (32 bytes)
PAYLOAD_ENCRYPTION_KEY=annseva-fps-e2e-encryption-secret-key-32

# Official UP Food & Civil Supplies Endpoints
UPPDS_API=https://portal.uppds.in/api/PublicDashboard/DashboardTxnCumAuthReport/excel
UPPDS_MONTH=2026-01-01

# Allowed origins for CORS in production (comma-separated; leave blank for same-origin)
CORS_ORIGIN=

# Razorpay credentials for token booking confirmation fee
RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret
```

> **⚠️ Security Note:** Real `.env` files are strictly excluded from version control via `.gitignore`. Never commit actual API keys or database connection strings.

---

## 🚀 Installation & Local Development

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **MongoDB Atlas** or local MongoDB 6.0+
- **Razorpay** test or live account keys

### 1. Install Dependencies
```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Run Development Servers
```bash
# Start backend server (port 5000)
cd server
npm run dev

# In a separate terminal, start frontend client (port 3000)
cd client
npm start
```

### 3. Build for Production
```bash
# Build React bundle
cd client
npm run build

# Start production server
cd ../server
node index.js
```
The Express server serves the compiled React production bundle at `http://localhost:5000`.

---

## 📡 API Reference Summary

### Authentication & Shop Verification
- `POST /api/auth/login` — FPS shop login with shop ID & password
- `POST /api/auth/change-password` — Validates current password & updates credentials
- `GET /api/auth/verify/:shopId` — Verifies FPS shop existence and public dealer name
- `GET /api/auth/me` — Fetches current authenticated session information

### Slot Management & Citizen Bookings
- `GET /api/slots/:shopId?date=YYYY-MM-DD` — Fetches available time slots for a given date
- `POST /api/bookings` — Atomically reserves slot, verifies SmartPDS quota & issues official token
- `GET /api/bookings/status?rationCardNumber=...` — Global public booking status lookup
- `GET /api/bookings/verify-card?rc=...&slotDate=...` — SmartPDS ePOS verification for citizen booking

### FPS Dealer Wallet & Analytics
- `GET /api/coins/:shopId/balance` — Returns accumulated reward coins and redemption history
- `POST /api/coins/:shopId/claim` — Submits withdrawal claim for bank transfer, UPI, or QR
- `GET /api/analytics/:shopId` — Provides hourly and daily footfall metrics

---

## 🛡️ License

This project is licensed under the MIT License. Developed for the modernisation of Public Distribution Services in Uttar Pradesh.
# fps-dashboard
