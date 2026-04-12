/* ================================================
   Firebase Messaging Service Worker
   Mozart Café — Notifications push (app fermée)
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
const messaging = firebase.messaging();

/* ── Message reçu en background ── */
messaging.onBackgroundMessage(payload => {
  const data  = payload.data || {};
  const table = data.table || payload.notification?.body?.match(/\d+/)?.[0] || '?';
  const title = data.title || payload.notification?.title || '🔔 Mozart Café';
  const body  = data.body  || payload.notification?.body  || `Table ${table} demande un serveur`;

  // Tag unique par appel → plusieurs notifs possibles sans blocage
  const tag = 'mc-call-' + table + '-' + Date.now();

  return self.registration.showNotification(title, {
    body,
    icon:  '/icon.svg',
    badge: '/icon.svg',
    tag,
    renotify: true,
    requireInteraction: true,
    vibrate: [200, 80, 200, 80, 350],
    actions: [
      { action: 'open',    title: "Ouvrir l'app" },
      { action: 'dismiss', title: 'Fermer' }
    ],
    data: { table, url: '/app.html' }
  });
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

/* ── Cache offline ── */
const CACHE  = 'mozart-cafe-v9';
const ASSETS = ['app.html', 'manifest.json', 'icon-192.png', 'icon-512.png', 'firebase-config.js'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
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
