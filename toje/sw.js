// Hors ligne : ce qui a été chargé une fois reste disponible sans réseau.
//
// Les fichiers de la page portent le commit du build (?v=…) : une même adresse
// ne change jamais, on la sert du cache d'abord. Seule la page (index.html)
// passe d'abord par le réseau — c'est elle qui désigne la génération du reste —
// et retombe sur le cache hors ligne, comme tout fichier non versionné (médias
// d'un jeu verrouillé, ?media=…). Les médias joués une fois restent jouables.
//
// Filtré par Maven (src/main/webapp-filtered) pour porter le commit : pas de
// gabarit JavaScript à dollar-accolade ici, il serait réécrit.

const VERSION = '3e92a52';
const CACHE = 'toje';
const MEDIA = /\.(fd|sap|sd|rom|zip)$/i;

self.addEventListener('install', () => self.skipWaiting());

// Une nouvelle génération chasse les fichiers des précédentes.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    for (const request of await cache.keys()) {
      const v = new URL(request.url).searchParams.get('v');
      if (v && v !== VERSION) await cache.delete(request);
    }
    await self.clients.claim();
  })());
});

// La page signale ce qu'elle a chargé avant que le service worker ne la
// contrôle (première visite) : on le met en cache aussi.
self.addEventListener('message', event => {
  if (!event.data || !Array.isArray(event.data.cache)) return;
  event.waitUntil(caches.open(CACHE).then(cache =>
    Promise.all(event.data.cache.map(url => cache.add(url).catch(() => {})))));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') await cache.put(request, response.clone());
    return response;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw e;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET') return;
  // Média d'un jeu verrouillé hébergé sur un autre site (?media=https://…) :
  // gardé lui aussi pour le hors-ligne. Seule une réponse CORS lisible est mise
  // en cache (une réponse opaque ne servirait à rien, la page ne la lit pas).
  if (url.origin !== self.location.origin) {
    if (MEDIA.test(url.pathname)) event.respondWith(networkFirst(request));
    return;
  }
  // Sans ?v= (la page, les médias d'un jeu verrouillé pris sur le site) :
  // l'adresse peut changer de contenu, le réseau d'abord.
  const versioned = url.searchParams.has('v');
  event.respondWith(request.mode === 'navigate' || !versioned ? networkFirst(request) : cacheFirst(request));
});
