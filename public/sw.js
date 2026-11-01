/*
 * Service worker for the installable app (website and CRM).
 *
 * - Built files (/_next/static, icons, fonts) are cached: the app opens fast.
 * - Public website pages are network-first, with the last copy kept for offline.
 * - The CRM (/admin) and every /api route are never cached (private data);
 *   without a connection they show the offline page instead.
 *
 * - Web Push: staff alerts (new enquiry, payment, …) show as system
 *   notifications even when the CRM is closed; open CRM windows also get a
 *   message so they refresh and show the alert straight away.
 *
 * Bump VERSION to drop old caches after a change to this file.
 */
const VERSION = "v2";
const STATIC_CACHE = `sp-static-${VERSION}`;
const PAGE_CACHE = `sp-pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/icon-192.png", "/icon-512.png", "/apple-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("sp-") && k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

const isPrivate = (url) => url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/");
const isBuiltAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  /\.(?:png|ico|svg|woff2?|webmanifest)$/.test(url.pathname);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Page loads.
  if (request.mode === "navigate") {
    if (isPrivate(url)) {
      event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
      return;
    }
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(PAGE_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match(OFFLINE_URL)),
    );
    return;
  }

  // Built files never change at the same URL: cache first.
  if (isBuiltAsset(url) && !isPrivate(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
  // Everything else (data, API, RSC requests) goes straight to the network.
});

// ─── Staff alerts (Web Push) ─────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "" };
  }
  const title = data.title || "The Sundaram Palace";
  const url = data.url || "/admin";
  event.waitUntil(
    (async () => {
      // Tell open CRM windows, so the bell and lists refresh and a toast shows.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of windows) client.postMessage({ type: "staff-alert", title, body: data.body || "", url });
      await self.registration.showNotification(title, {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag || undefined,
        renotify: Boolean(data.tag),
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/admin", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse an open CRM window when there is one.
      const crm = windows.find((w) => new URL(w.url).pathname.startsWith("/admin"));
      if (crm) {
        await crm.focus();
        return crm.navigate(target);
      }
      return self.clients.openWindow(target);
    })(),
  );
});

// The browser replaced the subscription (keys rotated): tell the server about the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const options = event.oldSubscription?.options;
      if (!options) return;
      const sub = await self.registration.pushManager.subscribe(options);
      await fetch("/api/push/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
    })(),
  );
});
