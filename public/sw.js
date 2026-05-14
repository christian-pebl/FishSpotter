const CACHE_NAME = "fishspotter-shell-v2";
const APP_SHELL = ["/manifest.webmanifest", "/icon.svg", "/apple-touch-icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

function isPersonalisedRoute(url) {
  const path = url.pathname;
  if (path.startsWith("/api/")) return true;
  if (path.startsWith("/auth/")) return true;
  // HTML routes that render per-user content (feed has streak, leaderboard has names)
  return path === "/" || path === "/feed" || path === "/leaderboard" || path.startsWith("/feed/");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache personalised or API responses. Let the network handle them.
  if (isPersonalisedRoute(url)) return;

  // Cache-first for static assets we precached, network-first for everything else.
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return new Response("Offline", { status: 503, statusText: "Offline" });
    })
  );
});
