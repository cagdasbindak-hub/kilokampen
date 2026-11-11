// Kilokampen service worker. Network first, so a new version shows up by itself;
// the cache is only a fallback when the phone is offline.
const CACHE = 'kilokampen-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match('./')))
  );
});

// Notifications. The payload is { title, body, url, tag }; url is a view name such as "forslag".
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* not JSON: show a plain notification */ }
  e.waitUntil(self.registration.showNotification(d.title || 'Kilokampen', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'kilokampen', data: { url: d.url || '' },
  }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const view = (e.notification.data && e.notification.data.url) || '';
  const target = self.registration.scope + (view ? '#' + view : '');
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope)) { c.postMessage({ kkOpen: view }); return c.focus(); }
    }
    return self.clients.openWindow(target);
  }));
});
