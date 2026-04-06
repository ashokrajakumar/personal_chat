const CACHE_NAME = 'funtimes-v1';
const ASSETS = [
    '/',
    '/index.html',
    '/assets/css/style.css',
    '/assets/js/app.js',
    '/assets/js/socket_webrtc.js'
];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    );
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then((res) => res || fetch(e.request))
    );
});
