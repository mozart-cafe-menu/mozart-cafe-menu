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

async function getFCMEntries(projectId, accessToken) {
  const url = `https://${projectId}-default-rtdb.europe-west1.firebasedatabase.app/fcm_tokens.json`;
  let res = await httpsRequest(url, { method: 'GET' });
  console.log('Firebase status:', res.status);

  if (res.status !== 200 || !res.body || typeof res.body !== 'object') {
    const url2 = url + `?access_token=${accessToken}`;
    res = await httpsRequest(url2, { method: 'GET' });
    console.log('Firebase auth status:', res.status);
  }

  if (!res.body || typeof res.body !== 'object') return [];
  return Object.entries(res.body)
    .filter(([, v]) => v && v.token)
    .map(([deviceId, v]) => ({ deviceId, token: v.token, lang: v.lang || 'fr' }));
}

async function deleteToken(projectId, accessToken, deviceId) {
  const url = `https://${projectId}-default-rtdb.europe-west1.firebasedatabase.app/fcm_tokens/${deviceId}.json?access_token=${accessToken}`;
  try {
    await httpsRequest(url, { method: 'DELETE' });
    console.log('Token supprimé pour deviceId:', deviceId);
  } catch(e) {
    console.warn('Erreur suppression token:', e.message);
  }
}

const BELL = {
  fr: n => `Appel : Table ${n}`,
  en: n => `Call : Table ${n}`,
  de: n => `Ruf : Tisch ${n}`,
  el: n => `Κλήση : Τραπέζι ${n}`,
  ar: n => `نداء : طاولة ${n}`,
};

const ORDER = {
  fr: { cmd:'Commande',   takeaway:'À emporter',    table:'Table'    },
  en: { cmd:'Order',      takeaway:'Takeaway',       table:'Table'    },
  de: { cmd:'Bestellung', takeaway:'Zum Mitnehmen', table:'Tisch'    },
  el: { cmd:'Παραγγελία', takeaway:'Σερβίρισμα',   table:'Τραπέζι'  },
  ar: { cmd:'طلب',        takeaway:'للخارج',         table:'طاولة'    },
};

function buildBody(type, table, deviceLang) {
  if (type === 'order') {
    const lbl  = ORDER[deviceLang] || ORDER.fr;
    const dest = table === 'takeaway' ? lbl.takeaway : `${lbl.table} ${table}`;
    return `${lbl.cmd} · ${dest}`;
  }
  const fn = BELL[deviceLang] || BELL.fr;
  return fn(table);
}

async function sendFCM(projectId, accessToken, entries, table, lang, type, title) {
  let sent = 0;
  for (const entry of entries) {
    const deviceLang = entry.lang || lang || 'fr';
    const body_text  = buildBody(type, table, deviceLang);
    const title_text = title || (type === 'order' ? '🧾 Mozart Coffee Lounge' : '🔔 Mozart Coffee Lounge');
    const payload = JSON.stringify({
      message: {
        token: entry.token,
        data: {
          table: String(table),
          lang:  deviceLang,
          title: title_text,
          body:  body_text
        },
        android: { priority: 'high' },
        apns: {
          headers: { 'apns-priority': '10' },
          payload: { aps: { sound: 'default', 'content-available': 1 } }
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
      console.log('FCM result:', res.status, entry.deviceId);
      if (res.status === 200) {
        sent++;
      } else if (res.status === 404 || res.body?.error?.status === 'NOT_FOUND' || res.body?.error?.status === 'UNREGISTERED') {
        await deleteToken(projectId, accessToken, entry.deviceId);
      }
    } catch(e) {
      console.error('FCM error:', e.message);
    }
  }
  return { sent, total: entries.length };
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try {
    const { table, lang, type, title } = req.body || {};
    console.log('Notify called: table=' + table + ' lang=' + lang + ' type=' + type);
    if (!table) { res.status(400).json({ error: 'Missing table' }); return; }

    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    const accessToken = await getAccessToken(sa);
    const entries = await getFCMEntries(sa.project_id, accessToken);
    console.log('Tokens found:', entries.length);

    if (entries.length === 0) {
      res.status(200).json({ sent: 0, reason: 'no_tokens' }); return;
    }

    const result = await sendFCM(sa.project_id, accessToken, entries, table, lang, type || null, title || null);
    console.log('Result:', JSON.stringify(result));
    res.status(200).json(result);

  } catch (err) {
    console.error('Error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
