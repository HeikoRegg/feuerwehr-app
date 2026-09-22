// Feuerwehr Regglisweiler – Service Worker
// Zuständig für: (1) Push-Benachrichtigungen bei "Dringend"-Mitteilungen für die
// Einsatzabteilung, (2) die Zahl am Homescreen-App-Icon für neue Mitteilungen.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const badgeCount = typeof data.badge === "number" ? data.badge : 0;

  const updateBadge = (async () => {
    try {
      if ("setAppBadge" in self.navigator) {
        if (badgeCount > 0) await self.navigator.setAppBadge(badgeCount);
        else await self.navigator.clearAppBadge();
      }
    } catch (e) {
      // Badge-API auf diesem Gerät/Browser nicht unterstützt – kein Problem, einfach ignorieren.
    }
  })();

  if (data.loud) {
    // "Dringend"-Mitteilung für die Einsatzabteilung: sichtbare Benachrichtigung anzeigen.
    event.waitUntil(Promise.all([
      updateBadge,
      self.registration.showNotification(data.title || "Feuerwehr Regglisweiler", {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: "ffw-dringend",
        renotify: true,
      }),
    ]));
  } else {
    // Normale Mitteilung: nur die Zahl am Icon aktualisieren, keine Benachrichtigung anzeigen.
    event.waitUntil(updateBadge);
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of allClients) {
      if ("focus" in client) return client.focus();
    }
    if (self.clients.openWindow) return self.clients.openWindow("/");
  })());
});
