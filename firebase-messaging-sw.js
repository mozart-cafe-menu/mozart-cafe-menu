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

// Initialiser Firebase Messaging (nécessaire pour décoder les payloads FCM)
firebase.messaging();

/* ── Gestionnaire push principal ──────────────────────────────────────
   Remplace onBackgroundMessage : celui-ci se déclenche TOUJOURS,
   même quand index.html est ouvert dans le navigateur.
   On affiche la notification sauf si app.html est lui-même ouvert
   (dans ce cas l'app la gère en premier plan via onMessage).
──────────────────────────────────────────────────────────────────── */
self.addEventListener('push', e => {
  if (!e.data) return;

  let data = {};
  try {
    const payload = e.data.json();
    // Le payload FCM peut être à payload.data ou directement à payload
    data = payload.data || payload;
  } catch(err) { return; }

  if (!data.table) return; // Pas notre format

  const table = data.table;
  const title = data.title || '🔔 Mozart Coffee Lounge';
  const body  = data.body  || 'Appel : Table ' + table;

  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Toujours poser un flag → l'app revalidera son token FCM à la prochaine ouverture
      caches.open('mc-fcm-meta').then(cache =>
        cache.put('/needs-token-refresh', new Response('1'))
      ).catch(() => {});

      // Si app.html est visible (premier plan), elle gère la notification elle-même.
      // Si elle est minimisée/en arrière-plan, on affiche quand même la notif système.
      const appVisible = clients.some(c => c.url.includes('app.html') && c.visibilityState === 'visible');
      if (appVisible) return;

      // Sinon (app fermée ou seulement index.html ouvert) → afficher la notification
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

/* ── Renouvellement automatique de la subscription push ──────────────
   Quand le navigateur renouvelle la subscription sans que l'app soit
   ouverte, l'ancien token FCM devient invalide. On informe l'app ou
   on stocke un flag pour qu'elle se ré-enregistre à la prochaine ouverture.
──────────────────────────────────────────────────────────────────── */
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        if (clients.length > 0) {
          // App déjà ouverte → lui demander de ré-enregistrer le token immédiatement
          clients.forEach(c => c.postMessage({ type: 'FCM_TOKEN_REFRESH' }));
        }
        // Dans tous les cas, stocker un flag → si l'app s'ouvre plus tard, elle se ré-enregistre
        return caches.open('mc-fcm-meta').then(cache =>
          cache.put('/needs-token-refresh', new Response('1'))
        );
      })
  );
});

/* ── Cycle de vie du SW ── */
const CACHE  = 'mozart-cafe-v1';
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
