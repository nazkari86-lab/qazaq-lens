const VERSION = "qazaq-lens-v5";
const BUILD_ASSETS = [];
const CORE = [
  "/", "/start/", "/myths/", "/sources/", "/methodology/", "/about/", "/privacy/", "/offline/", "/story/", "/search/", "/compare/", "/profile/", "/paths/", "/gallery/", "/data-status/",
  "/myths/aral-sea-gone/", "/myths/baikonur/", "/myths/borat/", "/myths/capital-astana/", "/myths/economy-oil/", "/myths/ethnic-diversity/", "/myths/giant-door/", "/myths/horse-meat-kumys/", "/myths/internet-closed/", "/myths/kazakh-and-russian/", "/myths/kazakhstan-memes/", "/myths/landlocked-isolated/", "/myths/nuclear-energy-weapons/", "/myths/nuclear-weapons/", "/myths/only-steppe/", "/myths/part-of-russia/", "/myths/secular-muslim/", "/myths/silk-roads/", "/myths/yurts/",
  "/manifest.webmanifest", "/favicon.svg", "/icons/icon-192.png", "/icons/icon-512.png", ...BUILD_ASSETS
];
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then((response) => {
      const copy = response.clone(); caches.open(VERSION).then((cache) => cache.put(request, copy)); return response;
    }).catch(async () => (await caches.match(request)) || (await caches.match("/offline/"))));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => {
    if (response.ok) caches.open(VERSION).then((cache) => cache.put(request, response.clone())); return response;
  })));
});
