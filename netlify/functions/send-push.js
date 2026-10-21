// netlify/functions/send-push.js
// Verschickt Push-Nachrichten (sichtbare Benachrichtigung plus Zahl am App-Symbol).
//  - an einen ganzen Bereich: neue Mitteilung vom Schwarzen Brett (Empfänger = Mitglieder des Bereichs, Admins sehen alle)
//  - gezielt an Personen (`an`): Chat, Umfragen, Geräte-/Hydranten-Mängel, Bewegungsfahrten …
//
// Seit 2.28:
//  - Aufruf aus der App nur noch mit gültigem Anmelde-Schlüssel (token). Andere Server-Funktionen rufen den
//    handler direkt mit `intern: true` auf (das lässt sich über das Internet nicht setzen).
//  - Mitteilungen: Bereich, Text und „dringend“ werden aus der gespeicherten Mitteilung gelesen (nicht vom Handy).
//  - Push-Pause (Glocke → „Benachrichtigungen ausschalten“, kv "pushAus"): diese Personen bekommen nur noch
//    dringende Mitteilungen und Mängel an Geräten/Fahrzeugen.

import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:kein-kontakt@example.com",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const BEREICH_NAME = { einsatzabteilung: "Einsatzabteilung", jugendfeuerwehr: "Jugendfeuerwehr", wettkampfgruppe: "Wettkampfgruppe", fuehrungskraefte: "Führungskräfte", altersabteilung: "Altersabteilung", atemschutz: "Atemschutz" };
const antwort = (statusCode, obj) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(obj) });

async function getKv(key) {
  const { data } = await supabase.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

export async function handler(event) {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  try {
    const intern = event.intern === true;
    const body = JSON.parse(event.body || "{}");
    const [roster, config, usersRes, pause] = await Promise.all([getKv("roster"), getKv("config"), supabase.from("app_users").select("name,is_admin,tokens,blocked"), getKv("pushAus")]);
    const liste = roster || [];
    const cfg = config || {};
    const users = (usersRes && usersRes.data) || [];
    const eintrag = (name) => liste.find((r) => r && r.name === name) || {};
    const istAdmin = (name) => (cfg.adminNames || []).includes(name) || !!users.find((u) => u.name === name && u.is_admin);

    // Absender prüfen (nur bei Aufrufen aus der App)
    let absender = intern ? String(body.sender || "") : "";
    if (!intern) {
      const me = body.token ? users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(body.token)) : null;
      if (!me || eintrag(me.name).gesperrt) return antwort(401, { error: "Bitte PIN bestätigen." });
      absender = me.name;
    }

    let { bereich, title, text, an, url } = body;
    let wichtig = intern && body.wichtig === true;

    if (!intern && body.mitteilung) {
      // Neue Mitteilung: aus der gespeicherten Liste lesen (das Speichern vom Handy kann einen Moment dauern)
      let n = null;
      for (let i = 0; i < 4 && !n; i++) {
        n = ((await getKv("notices")) || []).find((x) => x && x.id === body.mitteilung) || null;
        if (!n) await warte(500);
      }
      if (!n) return antwort(404, { error: "Mitteilung nicht gefunden." });
      const recht = istAdmin(absender) || !!(((eintrag(absender).rechte || {})[n.bereich] || {}).news);
      if (!recht) return antwort(403, { error: "Keine Berechtigung für diesen Bereich." });
      bereich = n.bereich; text = n.text || n.title || ""; an = null;
      const label = BEREICH_NAME[n.bereich] || "";
      wichtig = n.priority === "dringend";
      title = wichtig ? (n.bereich === "einsatzabteilung" ? "🚨 DRINGEND – Einsatzabteilung" : `Dringend – ${label}`) : `Neue Mitteilung – ${label}`;
    } else if (!intern) {
      // Aus der App nur gezielte Nachrichten an Personen (Bewegungsfahrten, Fahrzeug-Mängel)
      if (!Array.isArray(an)) return antwort(400, { error: "Empfänger fehlen." });
      wichtig = body.art === "fahrzeugmangel";
    }
    if (!bereich && !Array.isArray(an)) return { statusCode: 400, body: "bereich fehlt" };

    const pausiert = new Set(Object.keys((pause && typeof pause === "object") ? pause : {}));
    const siehtBereich = (name) => istAdmin(name) || (eintrag(name).bereiche || []).includes(bereich);
    const { data: subs, error } = await supabase.from("push_subscriptions").select("*");
    if (error) throw error;
    const relevant = (subs || []).filter((s) => s.name && !eintrag(s.name).gesperrt
      && (wichtig || !pausiert.has(s.name))
      && (Array.isArray(an) ? an.includes(s.name) : s.name !== absender && siehtBereich(s.name)));

    await Promise.allSettled(relevant.map(async (sub) => {
      const badge = (sub.badge_count || 0) + 1;
      const payload = JSON.stringify({
        title: String(title || "Neue Mitteilung").slice(0, 120),
        body: String(text || "").slice(0, 180),
        badge,
        ...(typeof url === "string" && url.startsWith("/") ? { url } : {}),
      });
      try {
        await webpush.sendNotification(sub.subscription, payload);
        await supabase.from("push_subscriptions").update({ badge_count: badge }).eq("endpoint", sub.endpoint);
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
      }
    }));

    return antwort(200, { sent: relevant.length, pausiert: (subs || []).filter((s) => pausiert.has(s.name)).length });
  } catch (e) {
    return { statusCode: 500, body: String(e) };
  }
}
