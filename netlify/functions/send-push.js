// netlify/functions/send-push.js
// Wird von der App aufgerufen, sobald eine NEUE Mitteilung gespeichert wird.
// Jede Mitteilung erzeugt eine sichtbare Benachrichtigung (das verlangen iPhone und
// Chrome – "stille" Nachrichten führen sonst zur Sperre) plus Zahl am App-Symbol.
// Empfänger: alle angemeldeten Geräte von Mitgliedern des jeweiligen Bereichs
// (Admins sehen alle Bereiche), außer dem Verfasser selbst.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:kein-kontakt@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

async function getKv(key) {
  const { data } = await supabase.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const { bereich, title, text, sender } = JSON.parse(event.body || "{}");
    if (!bereich) return { statusCode: 400, body: "bereich fehlt" };

    const roster = (await getKv("roster")) || [];
    const config = (await getKv("config")) || {};
    const admins = config.adminNames || [];
    // Bereiche werden bei jedem Versand frisch aus der Mitgliederliste gelesen.
    const eintrag = (name) => roster.find((r) => r.name === name) || {};
    // Gesperrte Mitglieder bekommen keine Benachrichtigungen mehr.
    const siehtBereich = (name) => !eintrag(name).gesperrt && (admins.includes(name) || (eintrag(name).bereiche || []).includes(bereich));

    const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
    if (error) throw error;
    const relevant = (subs || []).filter((s) => s.name && s.name !== sender && siehtBereich(s.name));

    await Promise.allSettled(relevant.map(async (sub) => {
      const badge = (sub.badge_count || 0) + 1;
      const payload = JSON.stringify({
        title: title || "Neue Mitteilung",
        body: (text || "").slice(0, 180),
        badge,
      });
      try {
        await webpush.sendNotification(sub.subscription, payload);
        await supabase.from("push_subscriptions").update({ badge_count: badge }).eq("endpoint", sub.endpoint);
      } catch (err) {
        // Abgelaufene/ungültige Anmeldungen (z. B. App vom Gerät gelöscht) aufräumen.
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
