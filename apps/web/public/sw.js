/* Service Worker für Browser-Benachrichtigungen (Web Push) – Sholat Aljanoub */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "شعلة الجنوب", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "شعلة الجنوب";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/brand/mark.png",
      badge: "/brand/mark.png",
      dir: "auto",
      lang: "ar",
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      requireInteraction: true,
      vibrate: [200, 100, 200, 100, 300],
      data: { url: data.url || "/ar/admin" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/ar/admin", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.navigate(url).catch(() => undefined);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
