/* StockAuto — Service Worker for admin Web Push notifications.
 * Scope: served from /sw.js so its scope is the whole origin.
 * Registered lazily by the admin panel only after the user clicks "Ativar".
 */
/* eslint-env serviceworker */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'StockAuto', body: event.data ? event.data.text() : '' };
  }
  const title = payload.title || 'StockAuto';
  const options = {
    body: payload.body || '',
    icon: '/favicon-192.png',
    badge: '/favicon-192.png',
    tag: payload.type || 'stockauto-notification',
    renotify: true,
    data: {
      url: payload.url || '/admin',
      tab: payload.tab || null,
      notificationId: payload.notification_id || null,
    },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetTab = data.tab;
  const target = new URL(data.url || '/admin', self.location.origin);
  if (targetTab) target.searchParams.set('tab', targetTab);
  const targetUrl = target.toString();

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      const url = new URL(client.url);
      if (url.origin === self.location.origin && url.pathname.startsWith('/admin')) {
        client.focus();
        client.navigate(targetUrl).catch(() => {});
        return;
      }
    }
    await self.clients.openWindow(targetUrl);
  })());
});
