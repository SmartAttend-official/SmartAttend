const CACHE_NAME = 'smartattend-student-v3';
const ASSETS = [
  './',
  'index.html',
  'student_dashboard.html',
  'student_forget.html',
  'backend/config.js',
  'backend/student_login.js',
  'backend/student_dashboard.js',
  'backend/student_forget.js',
  'images/bg1.1.png',
  'images/logo.png',
  'icon.png',
  'manifest.json'
];

// Install Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(ASSETS.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// Activate & Clear Old Caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy: Network First, then Cache fallback
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
