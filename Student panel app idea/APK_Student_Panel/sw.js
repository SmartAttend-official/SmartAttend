const CACHE_NAME = 'smartattend-core-v2';
const ASSETS = [
  '../index.html',
  'student_login.html',
  'Login.html',
  'admin_login.html',
  'backend/config.js',
  'images/bg1.1.png'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

// Fetch Strategy: Network First, then Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});

