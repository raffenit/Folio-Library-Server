const CACHE = 'folio-v5';

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Pass through cross-origin calls, APIs, and client-side SPA routes
  if (url.origin !== location.origin || url.pathname.includes('/api/') || url.pathname.includes('/proxy') || (!url.pathname.includes('.') && url.pathname !== '/')) {
    return;
  }

  // Network-first for navigation requests so the app always gets fresh HTML
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        return caches.match('/index.html').then(res => res || caches.match('/'));
      })
    );
    return;
  }

  // Cache-first for static assets (JS bundles, fonts, images)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      }).catch(err => {
        console.error('SW Fetch Error:', err);
        return new Response('Network error', { status: 408, headers: { 'Content-Type': 'text/plain' } });
      });
    })
  );
});
