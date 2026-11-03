/* ===== Nudge service worker =====
   1. Offline: pages and files are cached, so the app opens without internet.
   2. Notifications: shows alerts with Done / Snooze buttons and handles taps.
   Bump VERSION whenever you ship new files so phones pick them up. */
const VERSION = "nudge-v2";
const CORE = [
  "./", "index.html", "login.html", "onboarding.html", "dashboard.html", "timetable.html",
  "reminders.html", "reading.html", "notifications.html", "settings.html", "manifest.json",
  "base.css", "components.css", "landing.css", "auth.css", "onboarding.css",
  "app.css", "timetable.css", "lists.css", "alerts.css", "settings.css",
  "storage.js", "copy.js", "ui.js", "auth.js", "app.js", "planner.js", "alerts.js",
  "pwa.js", "landing.js", "login.js", "onboarding.js", "dashboard.js", "timetable.js",
  "reminders.js", "reading.js", "notifications.js", "settings.js",
  "icon.svg", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(VERSION)
      .then(function (c) { return Promise.all(CORE.map(function (u) { return c.add(u).catch(function () {}); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) { return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); })
      .then(function () { return self.clients.claim(); })
  );
});

/* Own files: network first (you always get the newest), cache when offline.
   Google Fonts: stale-while-revalidate. */
self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) e.respondWith(networkFirst(req));
  else if (/(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) e.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    if (req.mode === "navigate") { const home = await cache.match("index.html"); if (home) return home; }
    return Response.error();
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const fresh = fetch(req).then(function (res) { if (res && res.ok) cache.put(req, res.clone()); return res; }).catch(function () { return hit; });
  return hit || fresh;
}

/* Tapping a notification (or one of its buttons) */
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  const data = e.notification.data || {};
  const action = e.action;
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      for (const c of list) {
        if ("focus" in c) {
          if (action && data.id) c.postMessage({ type: "alert-action", id: data.id, action: action });
          else if ("navigate" in c) c.navigate("notifications.html").catch(function () {});
          return c.focus();
        }
      }
      let url = "notifications.html";
      if (data.id) url += "?alert=" + encodeURIComponent(data.id) + (action ? "&do=" + action : "");
      return self.clients.openWindow(url);
    })
  );
});

/* Ready for real background push later (Firebase Cloud Messaging / Web Push).
   Today the app schedules alerts itself while it is running. */
self.addEventListener("push", function (e) {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) {}
  e.waitUntil(self.registration.showNotification(d.title || "Nudge", {
    body: d.body || "", icon: "icon-192.png", badge: "icon-192.png", data: { id: d.id || "" }
  }));
});
