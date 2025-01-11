const CACHE_NAME = 'neon-snake-v1';
const CACHE_URLS = [
    '/neon-snake/',
    '/neon-snake/index.html',
    '/neon-snake/game.js',
    '/neon-snake/background.js',
    '/neon-snake/sounds.js',
    '/neon-snake/manifest.json',
    '/neon-snake/sounds/background.mp3',
    '/neon-snake/sounds/eat.mp3',
    '/neon-snake/sounds/gameover.mp3',
    '/neon-snake/sounds/hit.mp3',
    '/neon-snake/sounds/levelup.mp3'
];

// Service Worker kurulumu
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(CACHE_URLS);
            })
    );
});

// Ağ isteklerini yakala
self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache'de varsa cache'den döndür
                if (response) {
                    return response;
                }
                
                // Cache'de yoksa ağdan al ve cache'e ekle
                return fetch(event.request).then(
                    (response) => {
                        if(!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }

                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });

                        return response;
                    }
                );
            })
    );
}); 