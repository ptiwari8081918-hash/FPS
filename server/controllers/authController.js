// All UPPDS calls are SERVER-SIDE ONLY. URL never reaches the browser.
const axios = require('axios');
const Shop  = require('../models/Shop');
const { signToken, createSession, destroySession } = require('../middleware/auth');
const { logAction }  = require('../utils/audit');

function publicShop(shop) {
  // Never send password/internal fields to the client.
  return {
    shopId:       shop.shopId,
    shopName:     shop.shopName,
    ownerName:    shop.ownerName,
    role:         shop.role,
    slotDuration: shop.slotDuration,
    slotCapacity: shop.slotCapacity,
    language:     shop.language,
    mustChangePassword: shop.mustChangePassword,
    snapshot:     shop.apiSnapshot || {},
  };
}

const UPPDS_HEADERS = {
  'User-Agent':       'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36',
  'Accept':           'application/json, text/javascript, */*; q=0.01',
  'Accept-Language':  'en-US,en;q=0.9',
  'Referer':          'https://portal.uppds.in/',
  'Origin':           'https://portal.uppds.in',
  'X-Requested-With': 'XMLHttpRequest',
};

function buildUrl(shopId) {
  const base  = process.env.UPPDS_API;
  const month = process.env.UPPDS_MONTH || '2026-01-01';
  const nd    = Date.now();
  return `${base}?curLevel=STATE&geography=UTTAR%20PRADESH&zone=LinkWell&allotmentmonth=${month}&fps=${encodeURIComponent(shopId)}&rationcard=&dashboardtype=current-dashboard&type=1&_search=false&nd=${nd}&rows=10&page=1&sidx=&sord=asc`;
}

function parseUPPDSResponse(data) {
  // Handle multiple response formats
  let rows = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data && Array.isArray(data.rows)) {
    if (data.rows.length > 0 && data.rows[0].cell) {
      // jqGrid cell format
      rows = data.rows.map(r => ({
        fpsName:         r.cell[0] || '',
        totalCards:      r.cell[1] || 0,
        aayCards:        r.cell[2] || 0,
        phhCards:        r.cell[3] || 0,
        totalTxns:       r.cell[4] || 0,
        percentAch:      r.cell[5] || 0,
        fingerprintTxns: r.cell[6] || 0,
        otpTxns:         r.cell[7] || 0,
        irisTxns:        r.cell[8] || 0,
      }));
    } else {
      rows = data.rows;
    }
  }
  if (!rows.length) return null;
  const r = rows[0];
  const name = r.fpsName || r.fps_name || r.shopName || '';
  if (!name) return null;
  return {
    fpsName:         String(name).trim(),
    ownerName:       String(r.ownerName || r.dealerName || r.dealer_name || name).trim(),
    address:         String(r.address   || r.fpsAddress   || '').trim(),
    district:        String(r.district  || r.districtName || '').trim(),
    block:           String(r.block     || r.blockName    || '').trim(),
    village:         String(r.village   || r.villageName  || '').trim(),
    mobileNo:        String(r.mobileNo  || r.mobile       || '').trim(),
    totalCards:      parseInt(r.totalCards)      || 0,
    aayCards:        parseInt(r.aayCards)        || 0,
    phhCards:        parseInt(r.phhCards)        || 0,
    totalTxns:       parseInt(r.totalTxns)       || 0,
    percentAch:      parseFloat(r.percentAch)    || 0,
    fingerprintTxns: parseInt(r.fingerprintTxns) || 0,
    otpTxns:         parseInt(r.otpTxns)         || 0,
    irisTxns:        parseInt(r.irisTxns)        || 0,
  };
}

async function fetchFromUPPDS(shopId) {
  try {
    const { data } = await axios.get(buildUrl(shopId), {
      timeout: 12000,
      headers: UPPDS_HEADERS,
    });
    return parseUPPDSResponse(data);
  } catch (err) {
    console.warn('[UPPDS] Fetch failed for', shopId, ':', err.message);
    return null;
  }
}

// POST /api/auth/login
exports.login = async (req, res) => {
  try {
    const { shopId, password } = req.body;
    if (!shopId || !password) {
      return res.status(400).json({ success: false, message: 'Shop ID and password are required.' });
    }
    const sid = String(shopId).trim();

    // Try UPPDS first (non-blocking — if it fails we still allow login if shop exists in DB)
    const uppdsData = await fetchFromUPPDS(sid);

    // .select('+password') because the schema hides password by default.
    let shop = await Shop.findOne({ shopId: sid }).select('+password');

    if (!shop) {
      // New shop — must be found in UPPDS
      if (!uppdsData) {
        return res.status(404).json({
          success: false,
          message: `Shop ID "${sid}" not found. Please check your FPS code or try again (UPPDS portal may be slow).`,
        });
      }
      const defaultPassword = process.env.DEFAULT_PASSWORD;
      if (!defaultPassword) {
        console.error('[Login] DEFAULT_PASSWORD is not configured on the server.');
        return res.status(500).json({ success: false, message: 'Server is not configured. Please contact support.' });
      }
      shop = await Shop.create({
        shopId:    sid,
        shopName:  uppdsData.fpsName,
        ownerName: uppdsData.ownerName,
        apiSnapshot: uppdsData,
        password:  defaultPassword,   // hashed by the pre-save hook
        mustChangePassword: true,
      });
    } else if (uppdsData) {
      // Existing shop — refresh from UPPDS (password untouched)
      shop.shopName    = uppdsData.fpsName;
      shop.ownerName   = uppdsData.ownerName;
      shop.apiSnapshot = uppdsData;
      await shop.save();
    }

    if (shop.isActive === false) {
      return res.status(403).json({ success: false, message: 'This account has been deactivated. Contact your coordinator.' });
    }

    const valid = await shop.comparePassword(password);
    if (!valid) {
      await logAction(req, 'LOGIN_FAILED', { shopId: sid });
      return res.status(401).json({ success: false, message: 'Wrong password. Enter correct password, or contact your coordinator.' });
    }

    shop.lastLoginAt = new Date();
    await shop.save();
    await logAction(req, 'LOGIN', { shopId: sid });

    const sessionId = await createSession(shop.shopId, shop.role, req);
    const token = signToken({ shopId: shop.shopId, role: shop.role, sessionId });

    return res.json({
      success: true,
      token,
      sessionId,
      shop: publicShop(shop),
    });
  } catch (err) {
    console.error('[Login]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// POST /api/auth/change-password — requires a valid session (even one still
// flagged mustChangePassword). Always requires the current password.
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Current and new password are required.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }
    if (newPassword === currentPassword) {
      return res.status(400).json({ success: false, message: 'New password must be different from the current password.' });
    }

    const shop = await Shop.findOne({ shopId: req.auth.shopId }).select('+password');
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });

    const valid = await shop.comparePassword(currentPassword);
    if (!valid) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
    }

    shop.password = newPassword; // hashed by pre-save hook
    shop.mustChangePassword = false;
    shop.passwordChangedAt = new Date();
    await shop.save();
    await logAction(req, 'PASSWORD_CHANGE');

    // Destroy old session and issue a fresh session + token after password change.
    await destroySession(req.auth.sessionId);
    const newSessionId = await createSession(shop.shopId, shop.role, req);
    const token = signToken({ shopId: shop.shopId, role: shop.role, sessionId: newSessionId });

    return res.json({ success: true, message: 'Password updated.', token, sessionId: newSessionId, shop: publicShop(shop) });
  } catch (err) {
    console.error('[ChangePassword]', err);
    res.status(500).json({ success: false, message: 'Server error. Please try again.' });
  }
};

// GET /api/auth/me — refresh shop info for an already-logged-in session.
exports.me = async (req, res) => {
  try {
    const shop = await Shop.findOne({ shopId: req.auth.shopId });
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found.' });
    res.json({ success: true, sessionId: req.auth.sessionId, shop: publicShop(shop) });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// POST /api/auth/logout — destroys the server-side session so the JWT is
// immediately invalid even if someone reads it from the browser storage.
exports.logout = async (req, res) => {
  await Promise.all([
    logAction(req, 'LOGOUT'),
    destroySession(req.auth.sessionId),
  ]);
  res.json({ success: true });
};

// GET /api/auth/verify/:shopId — public endpoint for customer booking
exports.verifyShop = async (req, res) => {
  try {
    const sid = String(req.params.shopId).trim();

    let shop = await Shop.findOne({ shopId: sid });
    if (shop) {
      return res.json({ success: true, shopId: sid, shopName: shop.shopName, ownerName: shop.ownerName });
    }

    const uppdsData = await fetchFromUPPDS(sid);
    if (!uppdsData) {
      return res.status(404).json({ success: false, message: `FPS Shop "${sid}" not found. Check the shop code.` });
    }

    const defaultPassword = process.env.DEFAULT_PASSWORD;
    if (!defaultPassword) {
      console.error('[Verify] DEFAULT_PASSWORD is not configured on the server.');
      return res.status(500).json({ success: false, message: 'Server is not configured. Please contact support.' });
    }
    shop = await Shop.create({
      shopId:    sid,
      shopName:  uppdsData.fpsName,
      ownerName: uppdsData.ownerName,
      apiSnapshot: uppdsData,
      password:  defaultPassword,
      mustChangePassword: true,
    });

    return res.json({ success: true, shopId: sid, shopName: shop.shopName, ownerName: shop.ownerName });
  } catch (err) {
    console.error('[Verify]', err);
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
};

/**
 * Fetch stock register directly from official smartpds endpoint:
 * POST https://smartpds.up.gov.in/Epos_Spring/fps/getfpsStockregister
 * Body: { fps_id: "XXXXX", month: "9", year: "2026" }
 */
async function fetchSmartPdsStockRegister(fpsId, month = '9', year = '2026') {
  const tryFetch = async (m, y) => {
    try {
      const { data } = await axios.post(
        'https://smartpds.up.gov.in/Epos_Spring/fps/getfpsStockregister',
        {
          fps_id: String(fpsId).trim(),
          month: String(m),
          year: String(y),
        },
        {
          timeout: 6500,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
          },
        }
      );
      return Array.isArray(data) ? data : [];
    } catch (_) {
      return [];
    }
  };

  let res = await tryFetch(month, year);
  if (res.length > 0) return res;

  // Fallback to previous month
  const numM = parseInt(month, 10) || 1;
  const prevM = numM === 1 ? '12' : String(numM - 1);
  const prevY = numM === 1 ? String((parseInt(year, 10) || 2026) - 1) : year;
  res = await tryFetch(prevM, prevY);
  if (res.length > 0) return res;

  // Fallback to DB snapshot
  try {
    const shop = await Shop.findOne({ shopId: String(fpsId).trim() }).lean();
    if (shop?.stockSnapshot?.items?.length > 0) {
      return shop.stockSnapshot.items;
    }
  } catch (_) {}

  return [];
}

// POST /api/auth/fps-stockregister (Public: called during FPS owner login / inspection)
exports.getFpsStockRegister = async (req, res) => {
  try {
    const { fps_id, month = '9', year = '2026' } = req.body;
    if (!fps_id) {
      return res.status(400).json({ success: false, message: 'fps_id is required' });
    }

    const items = await fetchSmartPdsStockRegister(fps_id, month, year);
    if (!items || items.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No stock register details found for FPS code ${fps_id}`,
      });
    }

    const first = items[0];
    const distNameEn = first.distNameEn || '';
    const afso_name_en = first.afso_name_en || '';

    // If shop already exists in DB, update district & block in snapshot if missing
    Shop.findOne({ shopId: String(fps_id).trim() }).then(shop => {
      if (shop && distNameEn) {
        shop.apiSnapshot = shop.apiSnapshot || {};
        shop.apiSnapshot.district = distNameEn;
        shop.apiSnapshot.block = afso_name_en;
        shop.save().catch(() => {});
      }
    }).catch(() => {});

    return res.json({
      success: true,
      fps_id: String(fps_id).trim(),
      distNameEn,      // District
      afso_name_en,    // Block / Tehsil / AFSO
      items,
      count: items.length,
    });
  } catch (err) {
    console.error('[getFpsStockRegister]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve stock register information.' });
  }
};

