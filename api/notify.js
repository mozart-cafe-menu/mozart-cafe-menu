/* ================================================
   Vercel Function — Envoi notifications FCM
   Sans dépendances externes (Node.js built-in uniquement)
================================================ */

const crypto = require('crypto');
const https  = require('https');

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function httpsRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const opts = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function getAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const hdr = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const pay = base64url(JSON.stringify({
    iss: sa.client_email,
    sub: sa.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/firebase.database'
  }));

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(hdr + '.' + pay);
  const sig = base64url(sign.sign(sa.private_key));
  const jwt = hdr + '.' + pay + '.' + sig;

  const body = `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`;
  const res = await httpsRequest('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(body)
    }
  }, body);

  if (!res.body.access_token) throw new Error('Token failed: ' + JSON.stringify(res.body));
  return res.body.access_token;
}

async function getFCMTokens(projectId, accessToken) {
  // Essai 1 : sans auth (règles .read:true)
  const urlPublic = `https://${projectId}-default-rtdb.europe-west1.firebasedatabase.app/fcm_tokens.json`;
  const r1 = await httpsRequest(urlPublic, { method: 'GET' });
  console.log('Firebase public status:', r1.status);

  let body = null;
  if (r1.status === 200 && r1.body && typeof r1.body === 'object') {
    body = r1.body;
  } else {
    // Essai 2 : avec access_token
    const urlAuth = urlPublic + '?access_token=' + accessToken;
    const r2 = await httpsRequest(urlAuth, { method: 'GET' });
    console.log('Firebase auth status:', r2.status);
    if (r2.status === 200 && r2.body && typeof r2.body === 'object') body = r2.body;
  }

  console.log('Firebase body:', JSON.stringify(body));
  if (!body) return [];
  return Object.entries(body)
    .filter(([, v]) => v && v.token)
    .map(([deviceId, v]) => ({ deviceId, token: v.token }));
}

async function deleteToken(projectId, accessToken, deviceId) {
  const url = `https://${projectId}-default-rtdb.europe-west1.firebasedatabase.app/fcm_tokens/${deviceId}.json?access_token=${accessToken}`;
  await httpsRequest(url, { method: 'DELETE' }).catch(() => {});
  console.log('Deleted invalid token for:', deviceId);
}

async function sendFCM(projectId, accessToken, tokenObjs, table, lang, customMessage) {
  let body_text;
  if (customMessage) {
    // Message libre depuis admin
    body_text = customMessage;
  } else {
    const MESSAGES = {
      fr: `Table ${table} demande un serveur`,
      en: `Table ${table} needs a waiter`,
      ar: `الطاولة ${table} تطلب نادلاً`,
    };
    body_text = MESSAGES[lang] || MESSAGES.fr;
  }

  let sent = 0;
  for (const { deviceId, token } of tokenObjs) {
    const payload = JSON.stringify({
      message: {
        token,
        notification: { title: '🔔 Mozart Café', body: body_text },
        data: {
          table: String(table),
          lang:  lang || 'fr',
          title: '🔔 Mozart Café',
          body:  body_text
        },
        android: { priority: 'high' },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default' } }
        }
      }
    });
    try {
      const res = await httpsRequest(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + accessToken,
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload)
          }
        },
        payload
      );
      console.log('FCM result:', res.status, JSON.stringify(res.body));
      if (res.status === 200) {
        sent++;
      } else if (res.status === 404 || res.body?.error?.status === 'NOT_FOUND') {
        // Token invalide → supprimer de Firebase
        await deleteToken(projectId, accessToken, deviceId);
      }
    } catch(e) {
      console.error('FCM error:', e.message);
    }
  }
  return { sent, total: tokenObjs.length };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { table, lang, message } = req.body || {};
    console.log('Notify called: table=' + table + ' lang=' + lang + ' message=' + (message||''));
    if (!table) { res.status(400).json({ error: 'Missing table' }); return; }

    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getAccessToken(sa);
    const tokens = await getFCMTokens(sa.project_id, accessToken);
    console.log('Tokens found:', tokens.length);

    if (tokens.length === 0) {
      res.status(200).json({ sent: 0, reason: 'no_tokens' }); return;
    }

    const result = await sendFCM(sa.project_id, accessToken, tokens, table, lang, message);
    console.log('Result:', JSON.stringify(result));
    res.status(200).json(result);

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
