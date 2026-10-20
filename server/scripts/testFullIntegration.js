const axios = require('axios');

async function testFull() {
  try {
    const page = await axios.get('http://localhost:5000');
    console.log('Homepage status:', page.status, 'HTML bytes:', page.data.length, 'Has root div:', page.data.includes('root'));

    const login = await axios.post('http://localhost:5000/api/auth/login', { shopId: '20551051', password: 'akgec1234' });
    const token = login.data.token;
    const sessionId = login.data.sessionId;
    console.log('Login OK. SessionId:', sessionId);

    const headers = { Authorization: 'Bearer ' + token, 'X-Session-Id': sessionId };
    const stockRes = await axios.post('http://localhost:5000/api/fps/20551051/stock-register', { month: '9', year: '2026' }, { headers });
    console.log('Stock Summary:', stockRes.data.summary);
    stockRes.data.items.forEach(i => {
      console.log('  -', i.commNameEn, ': Allotted =', i.allottedQty, 'Issued =', i.issuedQty, 'CB =', i.cb);
    });

    const txnRes = await axios.post('http://localhost:5000/api/fps/20551051/transactions', { month: '9', year: '2026' }, { headers });
    console.log('Txns Summary:', txnRes.data.summary);
    const t0 = txnRes.data.transactions[0];
    console.log('First Txn:', t0.existingRcNumber, t0.schemeShortName, t0.authType, t0.loginTime, JSON.stringify(t0.commodities));
  } catch (err) {
    console.error('Error during test:', err.message, err.response?.data);
  }
}

testFull();
