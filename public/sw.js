const CACHE_NAME = 'urbanflow-shell-v5';
const APP_SHELL = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/offline.html',
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

    // Le HTML désigne les fichiers empreintés de la livraison. Le rendre depuis
    // le cache avant le réseau conserve l’ancien code au premier rechargement.
    // Hors ligne, le dernier écran téléchargé garde le bandeau et la reconnexion.
    if (event.request.mode === 'navigate') {
        event.respondWith((async () => {
            try {
                const response = await fetch(event.request, { cache: 'no-cache' });
                if (response.ok && response.type === 'basic') {
                    const cache = await caches.open(CACHE_NAME);
                    await cache.put(event.request, response.clone());
                }
                return response;
            } catch {
                return await caches.match(event.request) || await caches.match('/offline.html');
            }
        })());
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
