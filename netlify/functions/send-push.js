// netlify/functions/send-push.js
// Wird von der App aufgerufen, sobald eine Mitteilung gespeichert wird. Verschickt bei
// "Dringend" + Einsatzabteilung eine sichtbare Push-Nachricht an alle Einsatzabteilung-
// Mitglieder, bei allen anderen Mitteilungen nur eine "stille" Nachricht, die lediglich
// die Zahl am Homescreen-App-Icon aktualisiert.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:kein-kontakt@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const { bereich, priority, title, text } = JSON.parse(event.body || "{}");
    if (!bereich) return { statusCode: 400, body: "bereich fehlt" };

    const { data: subs, error: subsError } = await supabase.from("push_subscriptions").select("*");
    if (subsError) throw subsError;

    const relevant = (subs || []).filter((s) => Array.isArray(s.bereiche) && s.bereiche.includes(bereich));
    const isLoud = priority === "dringend" && bereich === "einsatzabteilung";

    // Aktuelle Mitteilungen aus dem kv_store holen, um für jeden Empfänger die passende
    // Zahl für das Homescreen-Icon zu berechnen (nur dessen eigene sichtbare Bereiche zählen).
    const { data: noticesRow } = await supabase.from("kv_store").select("value").eq("key", "notices").maybeSingle();
    const allNotices = (noticesRow && noticesRow.value) || [];
    const today = new Date().toISOString().slice(0, 10);

    await Promise.allSettled(relevant.map(async (sub) => {
      const badgeCount = allNotices.filter((n) =>
        Array.isArray(sub.bereiche) && sub.bereiche.includes(n.bereich) &&
        n.expiryDate >= today &&
        !(n.priority === "dringend" && n.bereich === "einsatzabteilung")
      ).length;

      const payload = JSON.stringify({
        loud: isLoud,
        title: isLoud ? (title || "Dringende Mitteilung") : undefined,
        body: isLoud ? (text || "") : undefined,
        badge: badgeCount,
      });

      try {
        await webpush.sendNotification(sub.subscription, payload);
      } catch (err) {
        // Abgelaufene/ungültige Abos (z. B. App auf dem Gerät deinstalliert) entfernen.
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }));

    return { statusCode: 200, body: JSON.stringify({ sent: relevant.length }) };
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
