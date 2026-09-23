// Feuerwehr Regglisweiler – Service Worker
// Zeigt bei jeder neuen Mitteilung eine Benachrichtigung und setzt die Zahl am App-Symbol.
// Wichtig: Jede Push-Nachricht MUSS sichtbar angezeigt werden, sonst sperren iPhone
// und Chrome die Anmeldung nach wenigen Nachrichten.

self.addEventListener("install", () => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}

  const tasks = [
    self.registration.showNotification(data.title || "Feuerwehr Regglisweiler", {
      body: data.body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    }),
  ];
  if (typeof data.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
    tasks.push(self.navigator.setAppBadge(data.badge).catch(() => {}));
  }
  event.waitUntil(Promise.all(tasks));
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
