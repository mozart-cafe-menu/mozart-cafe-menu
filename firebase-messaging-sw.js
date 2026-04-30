/* ================================================
   Firebase Messaging Service Worker — Mozart Coffee Lounge
================================================ */

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyAOuYRxE39KDgmizSdqCzAglWrkL4DZXYQ",
  authDomain:        "mozart-cafe-ae8e0.firebaseapp.com",
  projectId:         "mozart-cafe-ae8e0",
  storageBucket:     "mozart-cafe-ae8e0.firebasestorage.app",
  messagingSenderId: "89531105163",
  appId:             "1:89531105163:web:224863264ff5eebdb9b98e",
  databaseURL:       "https://mozart-cafe-ae8e0-default-rtdb.europe-west1.firebasedatabase.app"
});

firebase.messaging();

/* ── Gestionnaire push principal ──────────────────────────────────────
   Se déclenche TOUJOURS, même quand index.html est ouvert.
   On affiche la notification sauf si app.html est ouvert en premier plan.
──────────────────────────────────────────────────────────────────── */
self.addEventListener('push', e => {
  if (!e.data) return;

  let data = {};
  try {
    const payload = e.data.json();
    data = payload.data || payload;
  } catch(err) { return; }

  if (!data.table) return;

  const table = data.table;
  const title = data.title || '🔔 Mozart Coffee Lounge';
  const body  = data.body  || 'Appel : Table ' + table;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const appOpen = clients.some(c => c.url.includes('app.html'));
      if (appOpen) return;

      return self.registration.showNotification(title, {
        body,
        icon:  '/icon.svg',
        badge: '/icon.svg',
        tag:   'mc-call-' + table + '-' + Date.now(),
        renotify:            true,
        requireInteraction:  true,
        vibrate: [200, 80, 200, 80, 350],
        actions: [
          { action: 'open',    title: "Ouvrir l'app" },
          { action: 'dismiss', title: 'Fermer' }
        ],
        data: { table, url: '/app.html' }
      });
    })
  );
});

/* ── Clic sur notification ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'dismiss') return;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('app.html')) return client.focus();
      }
      return self.clients.openWindow('/app.html');
    })
  );
});

/* ── Cycle de vie du SW ── */
const CACHE  = 'cafe-mozart-v1';
const ASSETS = ['app.html', 'manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(self.skipWaiting());
  caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(() => {});
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request))
    );
  }
});
