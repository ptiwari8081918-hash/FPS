// fpsController.js — SmartPDS & UPPDS integration SERVER-SIDE ONLY
const axios = require('axios');
const Shop  = require('../models/Shop');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
  'Accept': 'application/json, text/javascript, */*; q=0.01',
  'Referer': 'https://portal.uppds.in/',
  'Origin': 'https://portal.uppds.in',
  'X-Requested-With': 'XMLHttpRequest',
};
const BASE = process.env.UPPDS_API || 'https://portal.uppds.in/api/PublicDashboard/DashboardTxnCumAuthReport/excel';
const RECEIPT_BASE = 'https://portal.uppds.in/api/PublicDashboard/PopupTxnCumAuthReport/excel';

// In-memory caching for high concurrency & 10k users
const memCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

function getCached(key) {
  const item = memCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    memCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data, ttlMs = CACHE_TTL_MS) {
  if (memCache.size > 2000) {
    const firstKey = memCache.keys().next().value;
    memCache.delete(firstKey);
  }
  memCache.set(key, { data, expiry: Date.now() + ttlMs });
}

function clearShopCache(shopId) {
  for (const k of memCache.keys()) {
    if (k.startsWith(`${shopId}_`)) memCache.delete(k);
  }
}

function parseMonthYear(inputMonth, inputYear) {
  const now = new Date();
  const curM = String(now.getMonth() + 1);
  const curY = String(now.getFullYear());

  let m = inputMonth ? String(inputMonth) : curM;
  let y = inputYear ? String(inputYear) : curY;
  if (m.includes('-')) {
    const parts = m.split('-');
    y = parts[0] || curY;
    m = String(parseInt(parts[1], 10) || curM);
  }
  return { month: m, year: y };
}

/**
 * Fetch Stock Register from SmartPDS official endpoint:
 * POST https://smartpds.up.gov.in/Epos_Spring/fps/getfpsStockregister
 */
async function fetchSmartPdsStock(fpsId, month, year) {
  const now = new Date();
  const m = month ? String(month) : String(now.getMonth() + 1);
  const y = year ? String(year) : String(now.getFullYear());
  const cacheKey = `stock_${fpsId}_${m}_${y}`;

  const cached = getCached(cacheKey);
  if (cached && cached.length > 0) return cached;

  const tryFetch = async (targetM, targetY) => {
    try {
      const { data } = await axios.post(
        'https://smartpds.up.gov.in/Epos_Spring/fps/getfpsStockregister',
        {
          fps_id: String(fpsId).trim(),
          month: String(targetM),
          year: String(targetY),
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

  // 1. Try requested month
  let res = await tryFetch(m, y);
  if (res.length > 0) {
    setCache(cacheKey, res);
    return res;
  }

  // 2. Fallback to immediately preceding month if current month is not yet published
  const numM = parseInt(m, 10) || 1;
  const prevM = numM === 1 ? '12' : String(numM - 1);
  const prevY = numM === 1 ? String((parseInt(y, 10) || 2026) - 1) : y;
  const prevCacheKey = `stock_${fpsId}_${prevM}_${prevY}`;
  const prevCached = getCached(prevCacheKey);
  if (prevCached && prevCached.length > 0) {
    setCache(cacheKey, prevCached);
    return prevCached;
  }

  res = await tryFetch(prevM, prevY);
  if (res.length > 0) {
    setCache(cacheKey, res);
    setCache(prevCacheKey, res);
    return res;
  }

  // 3. Fallback to database stock snapshot if available
  try {
    const shop = await Shop.findOne({ shopId: String(fpsId).trim() }).lean();
    if (shop?.stockSnapshot?.items?.length > 0) {
      setCache(cacheKey, shop.stockSnapshot.items);
      return shop.stockSnapshot.items;
    }
  } catch (_) {}

  return [];
}

/**
 * Fetch ePOS Transactions from SmartPDS official endpoint:
 * POST https://smartpds.up.gov.in/Epos_Spring/fps/fpstransactionwitoutcatptcha
 */
async function fetchSmartPdsTransactions(fpsId, month, year) {
  const now = new Date();
  const m = month ? String(month) : String(now.getMonth() + 1);
  const y = year ? String(year) : String(now.getFullYear());
  const cacheKey = `txns_${fpsId}_${m}_${y}`;

  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.post(
      'https://smartpds.up.gov.in/Epos_Spring/fps/fpstransactionwitoutcatptcha',
      {
        fps_id: String(fpsId).trim(),
        month: String(m),
        year: String(y),
      },
      {
        timeout: 20000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      }
    );
    const res = Array.isArray(data) ? data : [];
    if (res.length > 0) setCache(cacheKey, res);
    return res;
  } catch (err) {
    console.warn('[SmartPDS Transactions fetch error]', err.message);
    return [];
  }
}

/**
 * Fetch Ration Card Details, Family Members, Entitlements & Transactions from SmartPDS:
 * POST https://smartpds.up.gov.in/Epos_Spring/sdms/SRC_Trans_Int
 */
async function fetchSmartPdsCardDetails(rationCardNo, month, year) {
  const now = new Date();
  const m = month ? String(month).padStart(2, '0') : String(now.getMonth() + 1).padStart(2, '0');
  const y = year ? String(year) : String(now.getFullYear());
  const cleanRc = String(rationCardNo || '').trim();
  if (!cleanRc) return null;

  const cacheKey = `rc_trans_int_${cleanRc}_${m}_${y}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await axios.post(
      'https://smartpds.up.gov.in/Epos_Spring/sdms/SRC_Trans_Int',
      {
        month: m,
        year: y,
        src_no: cleanRc,
        captcha: '',
        salt: '',
      },
      {
        timeout: 18000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        },
      }
    );
    if (data && data.respcode === '200') {
      setCache(cacheKey, data, 5 * 60 * 1000); // 5 min cache
      return data;
    }
    return data || null;
  } catch (err) {
    console.warn('[SmartPDS SRC_Trans_Int error]', err.message);
    return null;
  }
}

function buildUrl(shopId, month, type = 2, page = 1, rows = 500) {
  const p = new URLSearchParams({
    curLevel: 'STATE', geography: 'UTTAR PRADESH', zone: 'LinkWell',
    allotmentmonth: month, fps: shopId, rationcard: '',
    dashboardtype: 'current-dashboard', type: String(type),
    _search: 'false', nd: String(Date.now()),
    rows: String(rows), page: String(page), sidx: '', sord: 'asc',
  });
  return `${BASE}?${p}`;
}

function buildReceiptUrl(rationCardNo, month) {
  const p = new URLSearchParams({
    curLevel: 'RATIONCARD', geography: rationCardNo,
    zone: 'LinkWell', allotmentmonth: month,
    dashboardtype: 'current-dashboard',
    _search: 'false', nd: String(Date.now()),
    rows: '10', page: '1', sidx: '', sord: 'asc',
  });
  return `${RECEIPT_BASE}?${p}`;
}

async function fetchRows(url) {
  try {
    const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    if (Array.isArray(data)) return data;
    if (data?.rows?.length) {
      if (data.rows[0]?.cell) {
        return data.rows.map(r => ({
          transTime: r.cell[0], cardType: r.cell[1],
          riceAayKg: r.cell[2], ricePhhKg: r.cell[3],
          wheatAayKg: r.cell[4], wheatPhhKg: r.cell[5],
        }));
      }
      return data.rows;
    }
    if (Array.isArray(data?.data)) return data.data;
    return [];
  } catch (e) {
    console.warn('[FPS fetch]', e.message);
    return [];
  }
}

function processTransactions(rows) {
  let aay = 0, phh = 0, rice = 0, wheat = 0, sugar = 0;
  const cards = new Set();
  const daily = {};
  const hourly = Array(24).fill(0);

  (rows || []).forEach(r => {
    const ct = (r.cardType || '').toUpperCase();
    if (ct === 'AAY') aay++;
    if (ct === 'PHH') phh++;
    if (r.rationCardNo) cards.add(r.rationCardNo);
    const rKg = parseFloat(r.riceAayKg || 0) + parseFloat(r.ricePhhKg || 0);
    const wKg = parseFloat(r.wheatAayKg || 0) + parseFloat(r.wheatPhhKg || 0);
    const sKg = parseFloat(r.sugarAayQty || 0);
    rice += rKg; wheat += wKg; sugar += sKg;
    const dt = (r.transDate || r.transTime || '').slice(0, 10) || 'unknown';
    if (!daily[dt]) {
      daily[dt] = {
        date: dt,
        transactions: 0,
        wheatAay: 0,
        wheatPhh: 0,
        riceAay: 0,
        ricePhh: 0,
        sugar: 0,
        total: 0,
        aay: 0,
        phh: 0,
      };
    }
    daily[dt].transactions++;
    if (ct === 'AAY') daily[dt].aay++;
    if (ct === 'PHH') daily[dt].phh++;
    daily[dt].wheatAay = parseFloat((daily[dt].wheatAay + parseFloat(r.wheatAayKg || 0)).toFixed(2));
    daily[dt].wheatPhh = parseFloat((daily[dt].wheatPhh + parseFloat(r.wheatPhhKg || 0)).toFixed(2));
    daily[dt].riceAay  = parseFloat((daily[dt].riceAay  + parseFloat(r.riceAayKg || 0)).toFixed(2));
    daily[dt].ricePhh  = parseFloat((daily[dt].ricePhh  + parseFloat(r.ricePhhKg || 0)).toFixed(2));
    daily[dt].sugar    = parseFloat((daily[dt].sugar    + sKg).toFixed(2));
    daily[dt].total    = parseFloat((daily[dt].total    + (rKg + wKg + sKg)).toFixed(2));
  });

  return {
    summary: {
      totalCards: cards.size,
      aayCount: aay,
      phhCount: phh,
      totalRice: parseFloat(rice.toFixed(2)),
      totalWheat: parseFloat(wheat.toFixed(2)),
      totalSugar: parseFloat(sugar.toFixed(2)),
      totalDistributed: parseFloat((rice + wheat + sugar).toFixed(2)),
      totalTxns: (rows || []).length,
    },
    dailyTrend: Object.values(daily).sort((a, b) => a.date.localeCompare(b.date)),
    hourlyDist: hourly.map((count, hour) => ({ hour, count, label: `${String(hour).padStart(2, '0')}:00` })),
  };
}

async function fetchAllPages(shopId, month, type = 2) {
  let page = 1, all = [];
  while (true) {
    const rows = await fetchRows(buildUrl(shopId, month, type, page, 500));
    all = all.concat(rows);
    if (rows.length < 500) break;
    page++;
    if (page > 20) break;
  }
  return all;
}

// POST or GET /api/fps/:shopId/stock-register
exports.getStockRegister = async (req, res) => {
  try {
    const { shopId } = req.params;
    const reqMonth = req.query.month || req.body?.month;
    const reqYear = req.query.year || req.body?.year;
    const { month, year } = parseMonthYear(reqMonth, reqYear);

    const items = await fetchSmartPdsStock(shopId, month, year);
    if (!items || items.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock register is currently being updated for this cycle.',
      });
    }

    function getCommodityOrder(name) {
      const n = (name || '').toLowerCase();
      if (n.includes('wheat')) return 1;
      if (n.includes('rice') || n.includes('frice')) return 2;
      if (n.includes('sugar')) return 3;
      return 4;
    }

    items.sort((a, b) => {
      const pA = getCommodityOrder(a.commNameEn);
      const pB = getCommodityOrder(b.commNameEn);
      if (pA !== pB) return pA - pB;
      return (a.commNameEn || '').localeCompare(b.commNameEn || '');
    });

    let totalAllotted = 0;
    let totalReceived = 0;
    let totalIssued = 0;
    let totalCb = 0;
    let totalOb = 0;

    items.forEach(item => {
      totalAllotted += parseFloat(item.allottedQty || 0);
      totalReceived += parseFloat(item.receivedQty || 0);
      totalIssued += parseFloat(item.issuedQty || 0);
      totalCb += parseFloat(item.cb || 0);
      totalOb += parseFloat(item.ob || 0);
    });

    const percentIssued = totalAllotted > 0
      ? parseFloat(((totalIssued / totalAllotted) * 100).toFixed(2))
      : 0;

    const first = items[0] || {};
    const distNameEn = first.distNameEn || '';
    const afso_name_en = first.afso_name_en || '';
    const refreshTime = first.refreshTime || '';

    // Update Shop snapshot & stockSnapshot in DB
    Shop.findOne({ shopId }).then(shop => {
      if (shop) {
        if (distNameEn) {
          shop.apiSnapshot = shop.apiSnapshot || {};
          shop.apiSnapshot.district = distNameEn;
          shop.apiSnapshot.block = afso_name_en;
        }
        shop.stockSnapshot = {
          month,
          year,
          distNameEn,
          afso_name_en,
          refreshTime,
          summary: {
            totalAllotted: parseFloat(totalAllotted.toFixed(2)),
            totalReceived: parseFloat(totalReceived.toFixed(2)),
            totalIssued: parseFloat(totalIssued.toFixed(2)),
            totalCb: parseFloat(totalCb.toFixed(2)),
            totalOb: parseFloat(totalOb.toFixed(2)),
            percentIssued,
            commodityCount: items.length,
          },
          items,
          updatedAt: new Date(),
        };
        shop.save().catch(() => {});
      }
    }).catch(() => {});

    return res.json({
      success: true,
      shopId,
      month,
      year,
      distNameEn,
      afso_name_en,
      refreshTime,
      summary: {
        totalAllotted: parseFloat(totalAllotted.toFixed(2)),
        totalReceived: parseFloat(totalReceived.toFixed(2)),
        totalIssued: parseFloat(totalIssued.toFixed(2)),
        totalCb: parseFloat(totalCb.toFixed(2)),
        totalOb: parseFloat(totalOb.toFixed(2)),
        percentIssued,
        commodityCount: items.length,
      },
      items,
    });
  } catch (err) {
    console.error('[getStockRegister]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve stock register' });
  }
};

// POST or GET /api/fps/:shopId/transactions
exports.getTransactions = async (req, res) => {
  try {
    const { shopId } = req.params;
    const reqMonth = req.query.month || req.body?.month;
    const reqYear = req.query.year || req.body?.year;
    const { month, year } = parseMonthYear(reqMonth, reqYear);

    const rawTxns = await fetchSmartPdsTransactions(shopId, month, year);

    let phhCount = 0;
    let aayCount = 0;
    let biometricCount = 0;
    let otpCount = 0;
    let irisCount = 0;
    const salesByCommodity = {};
    const cardSet = new Set();
    const dailyMap = {};
    const hourlyArr = Array(24).fill(0);

    const transactions = rawTxns.map((t, idx) => {
      const ct = (t.schemeShortName || '').toUpperCase();
      if (ct === 'PHH') phhCount++;
      else if (ct === 'AAY') aayCount++;

      const auth = t.auth_type || '';
      if (auth.toLowerCase().includes('bio')) biometricCount++;
      else if (auth.toLowerCase().includes('otp')) otpCount++;
      else if (auth.toLowerCase().includes('iris')) irisCount++;

      if (t.existingRcNumber) cardSet.add(t.existingRcNumber);

      let totalKg = 0;
      const commItems = (t.commodityList || []).map(c => {
        const qty = parseFloat(c.sale_qty || 0);
        if (c.comm_name_en) {
          salesByCommodity[c.comm_name_en] = parseFloat(((salesByCommodity[c.comm_name_en] || 0) + qty).toFixed(2));
        }
        totalKg += qty;
        return {
          commName: c.comm_name_en || 'Item',
          commId: c.comm_id,
          saleQty: qty,
        };
      });

      const timeStr = t.loginTime || '';
      let dateKey = 'unknown';
      let hourNum = 0;
      if (timeStr) {
        dateKey = timeStr.slice(0, 10);
        try {
          const dObj = new Date(timeStr.replace(' ', 'T'));
          hourNum = dObj.getHours();
          if (hourNum >= 0 && hourNum < 24) hourlyArr[hourNum]++;
        } catch (_) {}
      }

      if (!dailyMap[dateKey]) {
        dailyMap[dateKey] = { date: dateKey, count: 0, totalKg: 0, phh: 0, aay: 0 };
      }
      dailyMap[dateKey].count++;
      dailyMap[dateKey].totalKg = parseFloat((dailyMap[dateKey].totalKg + totalKg).toFixed(2));
      if (ct === 'PHH') dailyMap[dateKey].phh++;
      if (ct === 'AAY') dailyMap[dateKey].aay++;

      return {
        serialNo: idx + 1,
        existingRcNumber: t.existingRcNumber || '',
        schemeShortName: t.schemeShortName || 'PHH',
        authType: t.auth_type || 'Biometric',
        loginTime: t.loginTime || '',
        receiptId: t.receiptId || '',
        txnId: t.txnId || '',
        portCheck: t.portCheck || 'Self',
        amount: t.amount || '0.00',
        totalKg: parseFloat(totalKg.toFixed(2)),
        commodities: commItems,
      };
    });

    const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
    const hourlyDist = hourlyArr.map((count, h) => ({
      hour: h,
      count,
      label: `${String(h).padStart(2, '0')}:00`,
    }));

    return res.json({
      success: true,
      shopId,
      month,
      year,
      summary: {
        totalTxns: rawTxns.length,
        totalCards: cardSet.size,
        phhCount,
        aayCount,
        biometricCount,
        otpCount,
        irisCount,
        salesByCommodity,
      },
      dailyTrend,
      hourlyDist,
      transactions,
    });
  } catch (err) {
    console.error('[getTransactions]', err);
    res.status(500).json({ success: false, message: 'Failed to retrieve transactions' });
  }
};

// GET /api/fps/:shopId/data
exports.getFPSData = async (req, res) => {
  try {
    const { shopId } = req.params;
    const reqMonth = req.query.month || process.env.UPPDS_MONTH || '2026-09-01';
    const { month, year } = parseMonthYear(reqMonth, '2026');

    const shop = await Shop.findOne({ shopId });
    if (!shop) return res.status(404).json({ success: false, message: 'Shop not found. Please login first.' });

    // 1. Try SmartPDS stock and transactions first (current official endpoints)
    const [smartStock, smartTxns] = await Promise.all([
      fetchSmartPdsStock(shopId, month, year),
      fetchSmartPdsTransactions(shopId, month, year),
    ]);

    if (smartStock.length > 0 || smartTxns.length > 0) {
      let totalAllotted = 0, totalIssued = 0, totalCb = 0, totalReceived = 0;
      smartStock.forEach(item => {
        totalAllotted += parseFloat(item.allottedQty || 0);
        totalReceived += parseFloat(item.receivedQty || 0);
        totalIssued   += parseFloat(item.issuedQty || 0);
        totalCb       += parseFloat(item.cb || 0);
      });

      let phh = 0, aay = 0, bio = 0, otp = 0, iris = 0;
      const cardSet = new Set();
      const dailyMap = {};
      const hourlyArr = Array(24).fill(0);

      const cardDetails = smartTxns.map((t, idx) => {
        const ct = (t.schemeShortName || 'PHH').toUpperCase();
        if (ct === 'PHH') phh++; else if (ct === 'AAY') aay++;
        const auth = t.auth_type || 'Biometric';
        if (auth.toLowerCase().includes('bio')) bio++;
        else if (auth.toLowerCase().includes('otp')) otp++;
        else if (auth.toLowerCase().includes('iris')) iris++;
        if (t.existingRcNumber) cardSet.add(t.existingRcNumber);

        let wheat = 0, rice = 0, sugar = 0;
        (t.commodityList || []).forEach(c => {
          const q = parseFloat(c.sale_qty || 0);
          const cn = (c.comm_name_en || '').toLowerCase();
          if (cn.includes('wheat')) wheat += q;
          else if (cn.includes('rice')) rice += q;
          else if (cn.includes('sugar')) sugar += q;
        });

        const timeStr = t.loginTime || '';
        let dk = 'unknown';
        if (timeStr) {
          dk = timeStr.slice(0, 10);
          try {
            const h = new Date(timeStr.replace(' ', 'T')).getHours();
            if (h >= 0 && h < 24) hourlyArr[h]++;
          } catch (_) {}
        }

        if (!dailyMap[dk]) {
          dailyMap[dk] = {
            date: dk,
            transactions: 0,
            wheat: 0,
            rice: 0,
            sugar: 0,
            wheatAay: 0,
            wheatPhh: 0,
            riceAay: 0,
            ricePhh: 0,
            aay: 0,
            phh: 0,
            total: 0,
          };
        }
        dailyMap[dk].transactions++;
        if (ct === 'AAY') {
          dailyMap[dk].aay++;
          dailyMap[dk].wheatAay = parseFloat((dailyMap[dk].wheatAay + wheat).toFixed(2));
          dailyMap[dk].riceAay  = parseFloat((dailyMap[dk].riceAay  + rice).toFixed(2));
        } else {
          dailyMap[dk].phh++;
          dailyMap[dk].wheatPhh = parseFloat((dailyMap[dk].wheatPhh + wheat).toFixed(2));
          dailyMap[dk].ricePhh  = parseFloat((dailyMap[dk].ricePhh  + rice).toFixed(2));
        }
        dailyMap[dk].wheat = parseFloat((dailyMap[dk].wheat + wheat).toFixed(2));
        dailyMap[dk].rice  = parseFloat((dailyMap[dk].rice  + rice).toFixed(2));
        dailyMap[dk].sugar = parseFloat((dailyMap[dk].sugar + sugar).toFixed(2));
        dailyMap[dk].total = parseFloat((dailyMap[dk].total + (wheat + rice + sugar)).toFixed(2));

        return {
          serialno: idx + 1,
          rationCardNo: t.existingRcNumber,
          cardType: ct,
          authMethod: auth,
          lastTxn: timeStr,
          receiptId: t.receiptId,
          txnId: t.txnId,
          wheat: parseFloat(wheat.toFixed(2)),
          rice: parseFloat(rice.toFixed(2)),
          sugar: parseFloat(sugar.toFixed(2)),
          total: parseFloat((wheat + rice + sugar).toFixed(2)),
          commodities: t.commodityList,
        };
      });

      const dailyTrend = Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date));
      const first = smartStock[0] || {};

      return res.json({
        success: true,
        source: 'live',
        shopInfo: {
          ...shop.apiSnapshot,
          district: first.distNameEn || shop.apiSnapshot?.district,
          block: first.afso_name_en || shop.apiSnapshot?.block,
        },
        stockRegister: smartStock,
        data: {
          summary: {
            totalAllotted: parseFloat(totalAllotted.toFixed(2)),
            totalReceived: parseFloat(totalReceived.toFixed(2)),
            totalIssued: parseFloat(totalIssued.toFixed(2)),
            totalCb: parseFloat(totalCb.toFixed(2)),
            percentAch: totalAllotted > 0 ? parseFloat(((totalIssued / totalAllotted) * 100).toFixed(2)) : 0,
            totalCards: cardSet.size,
            aayCount: aay,
            phhCount: phh,
            fingerprint: bio,
            otp,
            iris,
            totalTxns: smartTxns.length,
          },
          dailyTrend,
          hourlyDist: hourlyArr.map((count, hour) => ({ hour, count, label: `${String(hour).padStart(2, '0')}:00` })),
          cardDetails,
        },
        month: `${year}-${String(month).padStart(2, '0')}-01`,
        rawCount: smartTxns.length,
      });
    }

    // Fallback if no live rows
    const rows = await fetchAllPages(shopId, reqMonth, 2);
    const data = processTransactions(rows);
    return res.json({ success: true, source: 'live', shopInfo: shop.apiSnapshot || {}, data, month: reqMonth, rawCount: rows.length });
  } catch (err) {
    console.error('[FPS data]', err);
    res.status(500).json({ success: false, message: 'FPS data error: ' + err.message });
  }
};

// GET /api/fps/:shopId/receipt
exports.getReceipt = async (req, res) => {
  try {
    const { shopId } = req.params;
    const now = new Date();
    const curM = String(now.getMonth() + 1);
    const curY = String(now.getFullYear());
    const { rationCard, month = curM, year = curY } = req.query;
    if (!rationCard) return res.status(400).json({ success: false, message: 'rationCard required' });

    const shop = await Shop.findOne({ shopId });
    const { month: m, year: y } = parseMonthYear(month, year);
    const mStr = String(m).padStart(2, '0');

    // 1. Primary Source: SmartPDS official SRC_Trans_Int API
    const cardData = await fetchSmartPdsCardDetails(rationCard, mStr, y);
    if (cardData && cardData.respcode === '200') {
      const memberList = cardData.beneficaryMemberList || [];
      const firstMember = memberList[0] || {};

      // Filter members with valid, non-null, non-zero values
      const members = memberList.map(mem => ({
        memberId: mem.member_id,
        name: mem.member_name_en,
        age: mem.member_age > 0 ? mem.member_age : null,
        gender: mem.gender_type_gt_type_id && mem.gender_type_gt_type_id !== 'NA' ? mem.gender_type_gt_type_id : '',
        active: mem.active || 'Active',
        kycUid: mem.kyc_uid && mem.kyc_uid !== '-NA-' ? mem.kyc_uid : '',
        scheme: mem.scheme_short_name || 'PHH',
        fpsId: mem.fps_id || shopId,
        district: mem.dist_name_en || '',
        block: mem.afso_name_en || '',
      }));

      // Filter entitlements with allocation_qty > 0
      const entitlements = (cardData.benficaryEntitlementList || [])
        .filter(e => parseFloat(e.allocation_qty || 0) > 0)
        .map(e => ({
          commodity: e.comm_name_eng,
          qty: parseFloat(e.allocation_qty),
          unit: e.unit_type || 'KG',
          month: e.month_short_name,
        }));

      // Filter transactions and non-zero commodities
      const transList = (cardData.benficaryTransList || []).map((t, idx) => {
        const nonZeroCommodities = (t.commoditylist || [])
          .filter(c => parseFloat(c.allot_qty || c.sale_qty || c.availed_qty || 0) > 0)
          .map(c => ({
            commName: c.comm_short || c.comm_name_en || 'Grain',
            saleQty: parseFloat((c.allot_qty || c.sale_qty || c.availed_qty || 0).toFixed(2)),
            unit: c.unit_type || 'KG',
          }));

        let w = 0, r = 0, s = 0;
        nonZeroCommodities.forEach(c => {
          const cn = (c.commName || '').toLowerCase();
          if (cn.includes('wheat')) w += c.saleQty;
          else if (cn.includes('rice') || cn.includes('frice')) r += c.saleQty;
          else if (cn.includes('sugar')) s += c.saleQty;
        });

        return {
          transRefNo: t.port_fpsid ? `FPS-${t.port_fpsid}-TXN-${idx + 1}` : `TXN-${idx + 1}`,
          transType: t.trans_status || 'Biometric',
          transDate: t.avail_date || '',
          availedBy: t.availed_member_name || '',
          fpsId: t.port_fpsid || shopId,
          wheat: parseFloat(w.toFixed(2)),
          rice: parseFloat(r.toFixed(2)),
          sugar: parseFloat(s.toFixed(2)),
          totalGrain: parseFloat((w + r + s).toFixed(2)),
          commodities: nonZeroCommodities,
        };
      });

      // Filter authentications
      const authentications = (cardData.benficaryAuthenticationsList || []).map(a => ({
        authType: a.auth_type,
        memberName: a.member_name_en,
        authTime: a.auth_time,
        status: a.error_desc || 'Success',
      }));

      // Compute total distributed commodities
      let totalWheat = 0, totalRice = 0, totalSugar = 0;
      if (transList.length > 0) {
        totalWheat = parseFloat(transList.reduce((acc, t) => acc + (t.wheat || 0), 0).toFixed(2));
        totalRice  = parseFloat(transList.reduce((acc, t) => acc + (t.rice || 0), 0).toFixed(2));
        totalSugar = parseFloat(transList.reduce((acc, t) => acc + (t.sugar || 0), 0).toFixed(2));
      } else {
        entitlements.forEach(e => {
          const cn = (e.commodity || '').toLowerCase();
          if (cn.includes('wheat')) totalWheat += e.qty;
          else if (cn.includes('rice') || cn.includes('frice')) totalRice += e.qty;
          else if (cn.includes('sugar')) totalSugar += e.qty;
        });
      }
      const totalGrain = parseFloat((totalWheat + totalRice + totalSugar).toFixed(2));

      const receipt = {
        rationCardNo:    rationCard,
        cardType:        firstMember.scheme_short_name || 'AAY',
        beneficiaryName: firstMember.member_name_en || 'Beneficiary',
        shopName:        shop?.shopName || shop?.apiSnapshot?.fpsName || `FPS-${firstMember.fps_id || shopId}`,
        shopOwner:       shop?.ownerName || shop?.apiSnapshot?.ownerName || 'FPS Dealer',
        shopCode:        firstMember.fps_id || shopId,
        district:        firstMember.dist_name_en || shop?.apiSnapshot?.district || 'UTTAR PRADESH',
        block:           firstMember.afso_name_en || shop?.apiSnapshot?.block || 'PDS Block',
        state:           'UTTAR PRADESH',
        month:           `${y}-${mStr}-01`,
        monthName:       entitlements[0]?.month || 'Current Month',
        receiptId:       transList[0]?.transRefNo || `RC-${rationCard.slice(-6)}`,
        txnId:           transList[0]?.transRefNo || '',
        authType:        transList[0]?.transType || authentications[0]?.authType || 'Biometric',
        loginTime:       transList[0]?.transDate || '',
        availedBy:       transList[0]?.availedBy || '',
        isCollected:     transList.length > 0,
        totalWheat,
        totalRice,
        totalSugar,
        totalGrain,
        members,
        entitlements,
        transactions:    transList,
        authentications,
      };

      return res.json({ success: true, receipt, source: 'live' });
    }

    // 2. Fallback: Check live transactions for this ration card
    const smartTxns = await fetchSmartPdsTransactions(shopId, m, y);
    const matched = smartTxns.filter(t => String(t.existingRcNumber).trim() === String(rationCard).trim());

    if (matched.length > 0) {
      const t = matched[0];
      const receipt = {
        rationCardNo:    t.existingRcNumber,
        cardType:        t.schemeShortName || 'PHH',
        beneficiaryName: 'Beneficiary',
        shopName:        shop?.shopName || shop?.apiSnapshot?.fpsName || `FPS-${shopId}`,
        shopOwner:       shop?.apiSnapshot?.ownerName || shop?.ownerName || 'FPS Dealer',
        shopCode:        shopId,
        district:        shop?.apiSnapshot?.district || 'UTTAR PRADESH',
        block:           shop?.apiSnapshot?.block    || 'UP PDS',
        state:           'UTTAR PRADESH',
        month:           `${y}-${mStr}-01`,
        receiptId:       t.receiptId,
        txnId:           t.txnId,
        authType:        t.auth_type,
        loginTime:       t.loginTime,
        transactions: matched.map((x, i) => {
          let wheat = 0, rice = 0, sugar = 0;
          (x.commodityList || []).forEach(c => {
            const q = parseFloat(c.sale_qty || 0);
            const cn = (c.comm_name_en || '').toLowerCase();
            if (cn.includes('wheat')) wheat += q;
            else if (cn.includes('rice')) rice += q;
            else if (cn.includes('sugar')) sugar += q;
          });
          return {
            transRefNo:  x.txnId || `TXN-${i + 1}`,
            transType:   x.auth_type || 'Biometric',
            transDate:   x.loginTime || '',
            wheat:       parseFloat(wheat.toFixed(2)),
            rice:        parseFloat(rice.toFixed(2)),
            sugar:       parseFloat(sugar.toFixed(2)),
            totalGrain:  parseFloat((wheat + rice).toFixed(2)),
            commodities: (x.commodityList || []).filter(c => parseFloat(c.sale_qty || 0) > 0),
          };
        }),
      };

      receipt.totalWheat = parseFloat(receipt.transactions.reduce((s, x) => s + x.wheat, 0).toFixed(2));
      receipt.totalRice  = parseFloat(receipt.transactions.reduce((s, x) => s + x.rice, 0).toFixed(2));
      receipt.totalSugar = parseFloat(receipt.transactions.reduce((s, x) => s + x.sugar, 0).toFixed(2));
      receipt.totalGrain = parseFloat((receipt.totalWheat + receipt.totalRice).toFixed(2));

      return res.json({ success: true, receipt, source: 'live' });
    }

    // 3. Fallback to UPPDS receipt
    const url = buildReceiptUrl(rationCard, month);
    const txns = await fetchRows(url);

    if (!txns.length) return res.status(404).json({ success: false, message: 'No transactions found for this ration card.' });

    const t = txns[0];
    const receipt = {
      rationCardNo:    rationCard,
      cardType:        t.cardType || 'N/A',
      beneficiaryName: t.beneficiaryName || 'N/A',
      shopName:        shop?.shopName || shop?.apiSnapshot?.fpsName || 'N/A',
      shopOwner:       shop?.apiSnapshot?.ownerName || shop?.ownerName || 'N/A',
      shopCode:        t.salefpscode || shopId,
      district:        shop?.apiSnapshot?.district || 'N/A',
      block:           shop?.apiSnapshot?.block    || 'N/A',
      state:           t.homeStateName || 'UTTAR PRADESH',
      month,
      transactions: txns.map(x => ({
        transRefNo:  x.transRefNo   || '',
        transType:   x.transType    || 'Aadhaar',
        transDate:   x.transDate    || '',
        riceAayKg:   parseFloat(x.riceAayKg  || 0),
        ricePhhKg:   parseFloat(x.ricePhhKg  || 0),
        wheatAayKg:  parseFloat(x.wheatAayKg || 0),
        wheatPhhKg:  parseFloat(x.wheatPhhKg || 0),
        sugarAayQty: parseFloat(x.sugarAayQty || 0),
        rice:  parseFloat((parseFloat(x.riceAayKg||0)+parseFloat(x.ricePhhKg||0)).toFixed(2)),
        wheat: parseFloat((parseFloat(x.wheatAayKg||0)+parseFloat(x.wheatPhhKg||0)).toFixed(2)),
      })),
    };

    receipt.totalRice  = parseFloat(receipt.transactions.reduce((s,x)=>s+x.rice, 0).toFixed(2));
    receipt.totalWheat = parseFloat(receipt.transactions.reduce((s,x)=>s+x.wheat,0).toFixed(2));
    receipt.totalSugar = parseFloat(receipt.transactions.reduce((s,x)=>s+x.sugarAayQty,0).toFixed(2));
    receipt.totalGrain = parseFloat((receipt.totalRice+receipt.totalWheat).toFixed(2));

    return res.json({ success: true, receipt, source: 'live' });
  } catch (err) {
    console.error('[Receipt]', err);
    res.status(500).json({ success: false, message: 'Receipt fetch failed: ' + err.message });
  }
};

// GET /api/fps/:shopId/summary
exports.getFPSSummary = async (req, res) => {
  try {
    const shop = await Shop.findOne({ shopId: req.params.shopId });
    if (!shop) return res.status(404).json({ success: false, message: 'Not found.' });
    res.json({ success: true, snapshot: shop.apiSnapshot || {}, shopId: shop.shopId, shopName: shop.shopName });
  } catch (err) { res.status(500).json({ success: false }); }
};

// POST /api/fps/:shopId/refresh
exports.refreshShopData = async (req, res) => {
  try {
    const { shopId } = req.params;
    clearShopCache(shopId);

    const now = new Date();
    const curM = String(now.getMonth() + 1);
    const curY = String(now.getFullYear());

    // Refresh via SmartPDS first
    const smartStock = await fetchSmartPdsStock(shopId, curM, curY);
    if (smartStock.length > 0) {
      const first = smartStock[0];
      const snap = {
        district: first.distNameEn || '',
        block: first.afso_name_en || '',
        fpsId: String(shopId),
        lastRefresh: first.refreshTime || new Date().toISOString(),
      };
      await Shop.findOneAndUpdate({ shopId }, { $set: { 'apiSnapshot.district': snap.district, 'apiSnapshot.block': snap.block } });
      return res.json({ success: true, snapshot: snap });
    }

    const month = process.env.UPPDS_MONTH || '2026-01-01';
    const rows  = await fetchRows(buildUrl(shopId, month, 1, 1, 10));
    if (!rows.length) return res.status(404).json({ success: false, message: 'No data from upstream' });
    const r = rows[0];
    const snap = {
      fpsName:         r.fpsName || r.fps_name || `FPS-${shopId}`,
      ownerName:       r.ownerName || r.dealerName || '',
      address:         r.address || '', district: r.district || '',
      block:           r.block || '', village: r.village || '', mobileNo: r.mobileNo || '',
      totalCards:      parseInt(r.totalCards) || 0,
      aayCards:        parseInt(r.aayCards)   || 0,
      phhCards:        parseInt(r.phhCards)   || 0,
      totalTxns:       parseInt(r.totalTxns)  || 0,
      percentAch:      parseFloat(r.percentAch) || 0,
      fingerprintTxns: parseInt(r.fingerprintTxns) || 0,
      otpTxns:         parseInt(r.otpTxns)  || 0,
      irisTxns:        parseInt(r.irisTxns) || 0,
    };
    await Shop.findOneAndUpdate({ shopId }, { $set: { apiSnapshot: snap, shopName: snap.fpsName } });
    res.json({ success: true, snapshot: snap });
  } catch (err) { res.status(500).json({ success: false, message: 'Refresh failed: ' + err.message }); }
};

exports.fetchSmartPdsCardDetails = fetchSmartPdsCardDetails;
