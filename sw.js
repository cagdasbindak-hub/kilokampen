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

// Notifications. The payload is { title, body, url, tag, actions?, answer?, answerUrl? }; url is a view name such as
// "forslag". The coach's morning question has Yes/No buttons (Android and Chrome show them; iPhone does not, and a tap
// there opens the coach page instead). A button sends the answer with the question's one-time code; the coach's reply
// comes back as a new notification, and any open page is told to fetch the news.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { /* not JSON: show a plain notification */ }
  e.waitUntil(self.registration.showNotification(d.title || 'Kilokampen', {
    body: d.body || '', icon: 'icon-192.png', badge: 'icon-192.png', tag: d.tag || 'kilokampen',
    data: { url: d.url || '', answer: d.answer || null, answerUrl: d.answerUrl || null },
    actions: Array.isArray(d.actions) ? d.actions.slice(0, 2) : [],
  }));
});
const openView = (view) => self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
  for (const c of list) {
    if (c.url.startsWith(self.registration.scope)) { c.postMessage({ kkOpen: view }); return c.focus(); }
  }
  return self.clients.openWindow(self.registration.scope + (view ? '#' + view : ''));
});
const tellPages = () => self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  .then((list) => list.forEach((c) => c.postMessage({ kkRefresh: true })));
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const data = e.notification.data || {};
  const view = data.url || '';
  if ((e.action === 'yes' || e.action === 'no') && data.answer && data.answerUrl) {
    e.waitUntil(fetch(data.answerUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ answer: data.answer, result: e.action }),
    })
      .then((r) => r.json())
      .then((reply) => {
        if (!reply || reply.error || !reply.body) return openView(view);
        return self.registration.showNotification(reply.title || 'Kilokampen', {
          body: reply.body, icon: 'icon-192.png', badge: 'icon-192.png', tag: 'fast-reply', data: { url: view },
        }).then(tellPages);
      })
      .catch(() => openView(view)));
    return;
  }
  e.waitUntil(openView(view));
});
