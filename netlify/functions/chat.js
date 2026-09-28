// netlify/functions/chat.js
// Direktnachrichten zwischen einem Kameraden und
//  - dem Ausschuss        (alle Mitglieder mit Ausschuss-Häkchen gemeinsam),
//  - der Kommandantschaft (aktive Funktion „Kommandant“ oder „stellv. Kommandant“ in der Personalakte),
//  - dem Entwickler       (Haupt-Admin).
// Jeder Kamerad hat pro Gruppe seine EIGENE Unterhaltung; Kameraden können nicht untereinander schreiben.
// Beide Seiten dürfen eine Unterhaltung beginnen. Jeder Beteiligte kann sie für alle löschen,
// 6 Monate nach der letzten Nachricht wird sie automatisch gelöscht.
// Die Nachrichten liegen in geschützten Tabellen (RLS an, keine Policies) – Zugriff nur hier.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { handler as sendPush } from "./send-push.js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const GRUPPEN = { ausschuss: "Ausschuss", kommando: "Kommandantschaft", entwickler: "Entwickler" };
const AN = { ausschuss: "den Ausschuss", kommando: "die Kommandantschaft", entwickler: "den Entwickler" };
const ZU = { ausschuss: "zum Ausschuss", kommando: "zur Kommandantschaft", entwickler: "zum Entwickler-Kontakt" };
const KOMMANDO_FUNKTIONEN = ["Kommandant", "stellv. Kommandant"];
const MAX_TEXT = 2000;
const AUFBEWAHRUNG_TAGE = 183; // ca. 6 Monate nach der letzten Nachricht

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const neueId = () => crypto.randomBytes(9).toString("hex");
const threadId = (gruppe, kamerad) => `${gruppe}|${kamerad}`;
const zeit = (ts) => { const t = Date.parse(ts || ""); return Number.isFinite(t) ? t : 0; };

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}
function aktiveFunktionen(akte) {
  return ((akte && akte.funktionen) || []).map((f) => (typeof f === "string" ? { name: f, status: "aktiv" } : f)).filter((f) => f.status !== "ad").map((f) => f.name);
}

// Wer gehört zu welcher Gruppe? Wird bei jedem Aufruf frisch ermittelt.
async function ladeLage(token) {
  const [usersRes, roster, aktenRes] = await Promise.all([
    db.from("app_users").select("name,tokens,blocked,is_main_admin"),
    getKv("roster"),
    db.from("personalakten").select("name,data"),
  ]);
  if (usersRes.error) throw usersRes.error;
  const users = usersRes.data || [];
  const me = token ? users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) : null;
  const gesperrt = new Set([
    ...users.filter((u) => u.blocked).map((u) => u.name),
    ...(roster || []).filter((r) => r && r.gesperrt).map((r) => r.name),
  ]);
  const aktiv = (n) => n && !gesperrt.has(n);
  const mitglieder = new Set((roster || []).filter((r) => r && aktiv(r.name)).map((r) => r.name));
  const gruppen = {
    ausschuss: (roster || []).filter((r) => r && r.ausschuss && aktiv(r.name)).map((r) => r.name),
    kommando: ((aktenRes && aktenRes.data) || []).filter((a) => aktiv(a.name) && mitglieder.has(a.name) && aktiveFunktionen(a.data).some((f) => KOMMANDO_FUNKTIONEN.includes(f))).map((a) => a.name),
    entwickler: users.filter((u) => u.is_main_admin && aktiv(u.name)).map((u) => u.name),
  };
  return { me, gruppen, mitglieder };
}
const istMitglied = (lage, gruppe, name) => (lage.gruppen[gruppe] || []).includes(name);
const darfThread = (lage, t) => t && (t.kamerad === lage.me.name || istMitglied(lage, t.gruppe, lage.me.name));

// Unterhaltungen, deren letzte Nachricht älter als 6 Monate ist, endgültig löschen.
async function alteLoeschen() {
  const { data } = await db.from("chat_threads").select("id,letzte");
  const grenze = Date.now() - AUFBEWAHRUNG_TAGE * 86400000;
  for (const t of (data || []).filter((x) => zeit(x.letzte) < grenze)) await threadLoeschen(t.id);
}
async function threadLoeschen(id) {
  await db.from("chat_nachrichten").delete().eq("thread", id);
  await db.from("chat_gelesen").delete().eq("thread", id);
  await db.from("chat_threads").delete().eq("id", id);
}
async function alsGelesen(thread, name) {
  await db.from("chat_gelesen").upsert({ id: `${thread}|${name}`, thread, name, ts: new Date().toISOString() });
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }

  try {
    const lage = await ladeLage(body.token);
    if (!lage.me) return json(401, { error: "Bitte PIN bestätigen." });
    const ich = lage.me.name;
    const { action } = body;

    if (action === "list") {
      await alteLoeschen();
      const { data: threads, error } = await db.from("chat_threads").select("*");
      if (error) throw error;
      const sichtbar = (threads || []).filter((t) => GRUPPEN[t.gruppe] && darfThread(lage, t));
      const ids = sichtbar.map((t) => t.id);
      let nachrichten = [], gelesen = [];
      if (ids.length) {
        const [n, g] = await Promise.all([
          db.from("chat_nachrichten").select("thread,von,ts").in("thread", ids),
          db.from("chat_gelesen").select("thread,name,ts").in("thread", ids),
        ]);
        nachrichten = n.data || []; gelesen = (g.data || []).filter((x) => x.name === ich);
      }
      const gelesenBis = Object.fromEntries(gelesen.map((g) => [g.thread, zeit(g.ts)]));
      const liste = sichtbar.map((t) => ({
        id: t.id, gruppe: t.gruppe, kamerad: t.kamerad,
        seite: t.kamerad === ich ? "kamerad" : "fuehrung",
        letzte: t.letzte, letzteVon: t.letzte_von || "", letzteText: t.letzte_text || "",
        ungelesen: nachrichten.filter((m) => m.thread === t.id && m.von !== ich && zeit(m.ts) > (gelesenBis[t.id] || 0)).length,
      })).sort((a, b) => zeit(b.letzte) - zeit(a.letzte));
      const gruppen = Object.fromEntries(Object.keys(GRUPPEN).map((g) => [g, {
        mitglied: istMitglied(lage, g, ich),
        // „Verfügbar“ = es gibt jemanden außer mir, der die Nachricht lesen kann.
        verfuegbar: (lage.gruppen[g] || []).some((n) => n !== ich),
        // Wer selbst zur Gruppe gehört, sieht die Mitglieder (für „Kameraden anschreiben“).
        ...(istMitglied(lage, g, ich) ? { mitglieder: lage.gruppen[g] } : {}),
      }]));
      return json(200, { ich, gruppen, threads: liste });
    }

    if (action === "get") {
      // Entweder eine bestehende Unterhaltung (id) oder eine noch leere (gruppe + kamerad).
      const id = body.id ? String(body.id) : threadId(String(body.gruppe || ""), String(body.kamerad || ""));
      const { data: t } = await db.from("chat_threads").select("*").eq("id", id).maybeSingle();
      if (!t) {
        const [gruppe, kamerad] = [String(body.gruppe || ""), String(body.kamerad || "")];
        if (body.id || !GRUPPEN[gruppe] || !darfThread(lage, { gruppe, kamerad })) return json(404, { error: "Diese Unterhaltung gibt es nicht mehr." });
        return json(200, { thread: null, teilnehmer: lage.gruppen[gruppe] || [], nachrichten: [] });
      }
      if (!darfThread(lage, t)) return json(403, { error: "Kein Zugriff auf diese Unterhaltung." });
      const { data: n } = await db.from("chat_nachrichten").select("id,von,text,ts").eq("thread", t.id);
      await alsGelesen(t.id, ich);
      return json(200, {
        thread: { id: t.id, gruppe: t.gruppe, kamerad: t.kamerad, seite: t.kamerad === ich ? "kamerad" : "fuehrung" },
        teilnehmer: lage.gruppen[t.gruppe] || [],
        nachrichten: (n || []).sort((a, b) => zeit(a.ts) - zeit(b.ts)),
      });
    }

    if (action === "send") {
      const gruppe = String(body.gruppe || "");
      const kamerad = String(body.kamerad || "");
      const text = String(body.text || "").trim();
      if (!GRUPPEN[gruppe]) return json(400, { error: "Unbekannter Empfänger." });
      if (!text) return json(400, { error: "Bitte eine Nachricht eingeben." });
      if (text.length > MAX_TEXT) return json(400, { error: `Die Nachricht ist zu lang (höchstens ${MAX_TEXT} Zeichen).` });
      if (!lage.mitglieder.has(kamerad)) return json(400, { error: "Dieses Mitglied gibt es nicht (mehr)." });
      const alsKamerad = kamerad === ich;
      if (!alsKamerad && !istMitglied(lage, gruppe, ich)) return json(403, { error: "Du kannst nur an Ausschuss, Kommandantschaft oder Entwickler schreiben." });
      if (!alsKamerad && istMitglied(lage, gruppe, kamerad)) return json(400, { error: `${kamerad} gehört selbst ${ZU[gruppe]}.` });
      const empfaengerSeite = (lage.gruppen[gruppe] || []).filter((n) => n !== ich);
      if (alsKamerad && empfaengerSeite.length === 0) return json(400, { error: `Für ${AN[gruppe]} ist noch niemand eingetragen.` });

      const id = threadId(gruppe, kamerad);
      const jetzt = new Date().toISOString();
      const { data: vorhanden } = await db.from("chat_threads").select("id,created_at").eq("id", id).maybeSingle();
      const { error: e1 } = await db.from("chat_threads").upsert({ id, gruppe, kamerad, letzte: jetzt, letzte_von: ich, letzte_text: text.slice(0, 120), created_at: (vorhanden && vorhanden.created_at) || jetzt });
      if (e1) throw e1;
      const nachricht = { id: neueId(), thread: id, von: ich, text, ts: jetzt };
      const { error: e2 } = await db.from("chat_nachrichten").upsert(nachricht);
      if (e2) throw e2;
      await alsGelesen(id, ich);

      // Push an alle anderen Beteiligten (Gruppe + Kamerad, ohne Absender).
      const an = [...new Set([...(lage.gruppen[gruppe] || []), kamerad])].filter((n) => n !== ich);
      const titel = alsKamerad ? `${ich} an ${AN[gruppe]}` : `${ich} (${GRUPPEN[gruppe]})`;
      if (an.length) {
        try { await sendPush({ httpMethod: "POST", body: JSON.stringify({ an, title: `💬 ${titel}`, text, sender: ich }) }); } catch (e) { /* Push ist Zusatz – Nachricht ist gespeichert */ }
      }
      return json(200, { ok: true, id, nachricht: { id: nachricht.id, von: ich, text, ts: jetzt } });
    }

    if (action === "delete") {
      const { data: t } = await db.from("chat_threads").select("*").eq("id", String(body.id || "")).maybeSingle();
      if (!t) return json(200, { ok: true });
      if (!darfThread(lage, t)) return json(403, { error: "Kein Zugriff auf diese Unterhaltung." });
      await threadLoeschen(t.id);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    const text = e && e.message ? e.message : String(e);
    if (/chat_/.test(text) && /(does not exist|not find|schema cache)/i.test(text)) {
      return json(500, { error: "Die Datenbank-Tabellen für den Chat fehlen noch. Bitte das SQL aus der Update-Anleitung in Supabase ausführen." });
    }
    return json(500, { error: "Serverfehler: " + text });
  }
}
