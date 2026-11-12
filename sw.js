const CACHE_NAME = 'vamonos-club-v13';

const APP_SHELL_ASSETS = [
    './',
    './index.html',
    './manifest.webmanifest',
    './assets/icons/favicon.svg',
    './assets/icons/apple-touch-icon.png',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png',
    './src/styles/main.css',
    './src/config/tailwind.config.js',
    './src/config/constants.js',
    './src/config/placesAqp.js',
    './src/config/supabaseConfig.js',
    './src/domain/auth.js',
    './src/domain/geo.js',
    './src/domain/matching.js',
    './src/domain/tripRules.js',
    './src/domain/whatsapp.js',
    './src/services/storageService.js',
    './src/services/mockData.js',
    './src/services/mapService.js',
    './src/services/routingService.js',
    './src/services/geocodingService.js',
    './src/services/notificationService.js',
    './src/services/supabaseClient.js',
    './src/services/authService.js',
    './src/services/radarService.js',
    './src/services/matchService.js',
    './src/services/tripService.js',
    './src/state/appStore.js',
    './src/pwa/installPrompt.js',
    './src/ui/utils/dom.js',
    './src/ui/components/toast.js',
    './src/ui/components/topbar.js',
    './src/ui/components/profileModal.js',
    './src/ui/components/ratingModal.js',
    './src/ui/components/requestModal.js',
    './src/ui/components/incomingRequestModal.js',
    './src/ui/views/landingView.js',
    './src/ui/views/mapView.js',
    './src/ui/views/radarView.js',
    './src/ui/views/chatView.js',
    './src/ui/views/tripView.js',
    './src/main.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(APP_SHELL_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);
    if (url.origin !== self.location.origin) return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response && response.ok) {
                    const copy = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
                }
                return response;
            })
            .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
            for (const client of clientsList) {
                if ('focus' in client) return client.focus();
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow('./');
            }
            return undefined;
        })
    );
});

