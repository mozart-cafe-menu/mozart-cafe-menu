/* ================================================
   Service Worker — Mozart Café Serveur
   Gère le cache offline + notifications push
================================================ */

const CACHE = 'mozart-cafe-v1';
const ASSETS = [
  'app.html',
  'manifest.json',
  'icon.svg',
  'icon-maskable.svg'
];

/* ── INSTALL : mise en cache ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE : nettoyage ancien cache ── */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH : servir depuis le cache ── */
self.addEventListener('fetch', e => {
  // Ne gérer que les requêtes GET sur même origine
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (!url.hostname.includes('ntfy.sh') && url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        if (resp && resp.status === 200) {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return resp;
      }))
    );
  }
});

/* ── PUSH : notification système même app fermée ── */
self.addEventListener('push', e => {
  let title = '🔔 Mozart Café';
  let body  = 'Un client demande un serveur';
  let table = '?';

  try {
    const data = e.data ? e.data.json() : {};
    body  = data.message || data.body || body;
    title = data.title   || title;
    const m = body.match(/\d+/);
    if (m) table = m[0];
  } catch (_) {
    try { body = e.data ? e.data.text() : body; } catch(_) {}
  }

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon:  '/icon.svg',
      badge: '/icon.svg',
      tag:   'mc-call-' + table,
      renotify: true,
      requireInteraction: true,
      vibrate: [200, 80, 200, 80, 350],
      actions: [
        { action: 'open',    title: 'Ouvrir l\'app' },
        { action: 'dismiss', title: 'Fermer'        }
      ],
      data: { table, url: '/app.html' }
    })
  );
});

/* ── NOTIFICATION CLICK ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('app.html')) {
          return client.focus();
        }
      }
      return self.clients.openWindow('app.html');
    })
  );
});

/* ── MESSAGE depuis la page ── */
self.addEventListener('message', e => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});
