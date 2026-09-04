const CACHE_NAME = 'urbanflow-shell-v3';
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/offline.html',
    '/data/gtfs-feed.json',
    '/data/shared-mobility.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
            ),
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') {
        return;
    }

    // L'API ne se met jamais en cache : ses réponses dépendent de la session et
    // changent à chaque action. Servie « cache d'abord », /api/state répondait
    // encore après la déconnexion, et /api/auth/session pouvait ressusciter la
    // session d'un compte précédent au rechargement (B21). Le socle et les
    // données statiques, eux, restent en cache pour le hors ligne.
    if (new URL(event.request.url).pathname.startsWith('/api/')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const networkResponse = fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200 && response.type === 'basic') {
                        const responseClone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
                    }
                    return response;
                })
                .catch(() => {
                    if (event.request.mode === 'navigate') {
                        return caches.match('/offline.html');
                    }
                    return cachedResponse;
                });

            return cachedResponse || networkResponse;
        }),
    );
});
