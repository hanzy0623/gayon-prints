const CACHE_NAME = "gayon-cache-v3";

const ASSETS_TO_CACHE = [
  "./",
  "./index.html",
  "./gallery.html",
  "./firebase.js",
  "./logo.png",
  "./manifest.json",
  "./qrcode.min.js",
  "./remixicon-local.css",
  "./remixicon.woff2",
  "./camera.js",
  "./capture.js",
  "./countdown.js",
  "./dom.js",
  "./review.js",
  "./state.js",
  "./test.js"
];

// Install Event - Cache all local assets
self.addEventListener("install", (evt) => {
  console.log("Service Worker installing...");
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Caching app assets");
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn("Cache addAll error:", err);

        // Fallback: cache files one by one
        return ASSETS_TO_CACHE.reduce((promise, asset) => {
          return promise.then(() =>
            cache.add(asset).catch(() =>
              console.warn(`Failed to cache: ${asset}`)
            )
          );
        }, Promise.resolve());
      });
    })
  );

  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener("activate", (evt) => {
  console.log("Service Worker activating...");
  evt.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("Deleting old cache:", key);
            return caches.delete(key);
          })
      );
    })
  );

  self.clients.claim();
});

// Fetch Event - Cache-first for local assets
self.addEventListener("fetch", (evt) => {
  if (evt.request.method !== "GET") return;

  const url = new URL(evt.request.url);

  if (url.origin === location.origin) {
    evt.respondWith(
      caches.match(evt.request).then((cachedRes) => {
        if (cachedRes) {
          return cachedRes;
        }

        return fetch(evt.request)
          .then((networkRes) => {
            if (networkRes && networkRes.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(evt.request, networkRes.clone());
              });
            }
            return networkRes;
          })
          .catch(() => {
            // Offline fallback
            if (evt.request.destination === "document") {
              return caches.match("./index.html");
            }
            return caches.match(evt.request);
          });
      })
    );
  }
});
