// netlify/functions/auth.js
// Geschützte Anmeldung: PINs liegen NICHT mehr in der öffentlichen Mitgliederliste,
// sondern in der Tabelle "app_users", die nur diese Serverfunktion lesen darf
// (Zugriff über den geheimen service_role-Schlüssel aus den Netlify-Umgebungsvariablen).

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MAX_TOKENS = 6;          // so viele Geräte pro Person gleichzeitig angemeldet
const MAX_FAILS = 5;           // Fehlversuche bis zur Sperre
const LOCK_MINUTES = 15;       // Dauer der Sperre

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const hashPin = (salt, pin) => crypto.createHash("sha256").update(`${salt}:${pin}`).digest("hex");
const newToken = () => crypto.randomBytes(24).toString("hex");

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}
async function setKv(key, value) {
  await db.from("kv_store").upsert({ key, value, updated_at: new Date().toISOString() });
}
async function getUser(name) {
  const { data } = await db.from("app_users").select("*").eq("name", name).maybeSingle();
  return data;
}
async function upsertUser(row) {
  const { error } = await db.from("app_users").upsert(row);
  if (error) throw error;
}
async function userByToken(token) {
  if (!token) return null;
  // Kleine Tabelle – deshalb einfach alle Benutzer laden und den Schlüssel hier im Code suchen.
  const { data, error } = await db.from("app_users").select("*");
  if (error) throw error;
  return (data || []).find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) || null;
}
// Prüft die PIN inkl. Sperre nach zu vielen Fehlversuchen. Gibt null (ok) oder eine Fehlerantwort zurück.
async function checkPin(user, pin) {
  if (user.locked_until && new Date(user.locked_until) > new Date()) {
    return json(429, { error: `Zu viele Fehlversuche. Bitte in ${LOCK_MINUTES} Minuten nochmal versuchen.` });
  }
  if (!user.pin_hash || hashPin(user.pin_salt, String(pin || "")) !== user.pin_hash) {
    const fails = (user.failed_attempts || 0) + 1;
    const locked = fails >= MAX_FAILS;
    await upsertUser({ ...user, failed_attempts: locked ? 0 : fails, locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null });
    return json(401, { error: locked ? `Zu viele Fehlversuche. Bitte in ${LOCK_MINUTES} Minuten nochmal versuchen.` : "PIN stimmt nicht. Nochmal versuchen." });
  }
  return null;
}
const GESPERRT_TEXT = "Dein Zugang zur App ist gesperrt. Bei Fragen bitte beim Kommandanten melden.";
const ELEVATION_STUNDEN = 2; // Sicherheitsnetz, falls die Personalakten-Kachel offen liegen bleibt

// Übernimmt evtl. noch öffentlich gespeicherte PINs und Admin-Rechte in den geschützten
// Speicher und entfernt die PINs danach aus der öffentlichen Mitgliederliste.
async function migrate() {
  const roster = (await getKv("roster")) || [];
  const config = (await getKv("config")) || {};
  let changed = false;
  for (const r of roster) {
    if (r && r.pin) {
      const existing = await getUser(r.name);
      if (!existing || !existing.pin_hash) {
        const salt = crypto.randomBytes(8).toString("hex");
        await upsertUser({ ...(existing || {}), name: r.name, pin_salt: salt, pin_hash: hashPin(salt, r.pin), tokens: (existing && existing.tokens) || [] });
      }
    }
  }
  const cleaned = roster.map((r) => {
    if (!r || !("pin" in r)) return r;
    changed = true;
    const { pin, ...rest } = r;
    return { ...rest, hasPin: rest.hasPin !== undefined ? rest.hasPin : !!pin };
  });
  if (changed) await setKv("roster", cleaned);

  // Admin-Rechte einmalig aus der Konfiguration übernehmen (danach gilt nur noch app_users).
  const { data: admins } = await db.from("app_users").select("name").eq("is_admin", true);
  if (!admins || admins.length === 0) {
    const names = config.adminNames || (config.adminName ? [config.adminName] : []);
    const main = config.mainAdminName || config.adminName || names[0];
    for (const n of names) {
      const u = (await getUser(n)) || { name: n, tokens: [] };
      await upsertUser({ ...u, is_admin: true, is_main_admin: n === main });
    }
  }
}

async function issueToken(user) {
  const token = newToken();
  const tokens = [token, ...(user.tokens || [])].slice(0, MAX_TOKENS);
  await upsertUser({ ...user, tokens, failed_attempts: 0, locked_until: null });
  return token;
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }
  const { action } = body;

  try {
    await migrate();

    if (action === "migrate") return json(200, { ok: true });

    if (action === "dropElevation") {
      // Freischaltung für fremde Personalakten beenden (beim Schließen der Kachel).
      if (body.elevatedToken) {
        const { data } = await db.from("app_users").select("*").eq("elevated_token", body.elevatedToken);
        for (const u of data || []) await upsertUser({ ...u, elevated_token: null, elevated_until: null });
      }
      return json(200, { ok: true });
    }

    if (action === "login") {
      const { name, pin } = body;
      const user = name && (await getUser(name));
      if (!user || !user.pin_hash) return json(401, { error: "PIN stimmt nicht. Nochmal versuchen." });
      if (user.blocked) return json(403, { error: GESPERRT_TEXT });
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return json(429, { error: `Zu viele Fehlversuche. Bitte in ${LOCK_MINUTES} Minuten nochmal versuchen.` });
      }
      if (hashPin(user.pin_salt, String(pin || "")) !== user.pin_hash) {
        const fails = (user.failed_attempts || 0) + 1;
        const locked = fails >= MAX_FAILS;
        await upsertUser({ ...user, failed_attempts: locked ? 0 : fails, locked_until: locked ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null });
        return json(401, { error: locked ? `Zu viele Fehlversuche. Bitte in ${LOCK_MINUTES} Minuten nochmal versuchen.` : "PIN stimmt nicht. Nochmal versuchen." });
      }
      return json(200, { token: await issueToken(user) });
    }

    if (action === "setPin") {
      // Nur erlaubt, wenn noch keine PIN gesetzt ist (erstes Anmelden oder nach Zurücksetzen durch den Admin).
      const { name, pin } = body;
      if (!name || !/^\d{4}$/.test(String(pin || ""))) return json(400, { error: "Bitte eine 4-stellige PIN eingeben." });
      const user = (await getUser(name)) || { name, tokens: [] };
      if (user.blocked) return json(403, { error: GESPERRT_TEXT });
      if (user.pin_hash) return json(403, { error: "Für diesen Namen ist schon eine PIN vergeben." });
      const salt = crypto.randomBytes(8).toString("hex");
      const updated = { ...user, pin_salt: salt, pin_hash: hashPin(salt, pin), tokens: [] };
      return json(200, { token: await issueToken(updated) });
    }

    if (action === "setup") {
      // Allererste Einrichtung der App – nur möglich, solange es noch gar keine Benutzer gibt.
      const { count } = await db.from("app_users").select("name", { count: "exact", head: true });
      if (count && count > 0) return json(403, { error: "Die App ist bereits eingerichtet." });
      const { name, pin } = body;
      if (!name || !/^\d{4}$/.test(String(pin || ""))) return json(400, { error: "Name und 4-stellige PIN nötig." });
      const salt = crypto.randomBytes(8).toString("hex");
      const user = { name, pin_salt: salt, pin_hash: hashPin(salt, pin), tokens: [], is_admin: true, is_main_admin: true };
      return json(200, { token: await issueToken(user) });
    }

    // ---- Ab hier nur mit gültigem Sitzungs-Schlüssel ----
    const me = await userByToken(body.token);
    if (!me) return json(401, { error: "Bitte PIN bestätigen." });

    if (action === "verify") return json(200, { name: me.name, isAdmin: !!me.is_admin });

    if (action === "elevate") {
      // Admin schaltet mit erneuter PIN-Eingabe die fremden Personalakten frei.
      if (!me.is_admin) return json(403, { error: "Nur für Admins." });
      const fehler = await checkPin(me, body.pin);
      // Falsche PIN hier bewusst NICHT als 401 melden – sonst hielte die App das für eine abgelaufene Anmeldung.
      if (fehler) return fehler.statusCode === 401 ? json(403, JSON.parse(fehler.body)) : fehler;
      const elevatedToken = newToken();
      await upsertUser({ ...me, failed_attempts: 0, locked_until: null, elevated_token: elevatedToken, elevated_until: new Date(Date.now() + ELEVATION_STUNDEN * 3600000).toISOString() });
      return json(200, { elevatedToken });
    }

    if (action === "setBlocked") {
      if (!me.is_admin) return json(403, { error: "Nur für Admins." });
      const name = body.target;
      const gesperrt = !!body.value;
      const target = (await getUser(name)) || { name, tokens: [] };
      if (gesperrt && (target.is_admin || name === me.name)) return json(403, { error: "Admins können nicht gesperrt werden. Bitte zuerst das Admin-Recht entfernen." });
      await upsertUser({ ...target, blocked: gesperrt, tokens: gesperrt ? [] : (target.tokens || []), elevated_token: null, elevated_until: null });
      // Automatischer Eintrag im Mitgliedsverlauf der Personalakte.
      const { data: row } = await db.from("personalakten").select("data").eq("name", name).maybeSingle();
      const akte = (row && row.data) || {};
      const verlauf = [...(akte.mitgliedsverlauf || []), { id: newToken().slice(0, 10), text: gesperrt ? "Austritt" : "Wiedereintritt", datum: new Date().toISOString().slice(0, 10) }];
      await db.from("personalakten").upsert({ name, data: { ...akte, mitgliedsverlauf: verlauf }, updated_at: new Date().toISOString() });
      if (gesperrt) await db.from("push_subscriptions").delete().eq("name", name);
      return json(200, { ok: true });
    }

    if (action === "resetPin") {
      if (!me.is_admin) return json(403, { error: "Nur für Admins." });
      const target = await getUser(body.target);
      if (target) await upsertUser({ ...target, pin_hash: null, pin_salt: null, tokens: [], failed_attempts: 0, locked_until: null });
      return json(200, { ok: true });
    }

    if (action === "setAdmin") {
      if (!me.is_main_admin) return json(403, { error: "Nur der Haupt-Admin darf Admins ernennen." });
      const target = (await getUser(body.target)) || { name: body.target, tokens: [] };
      await upsertUser({ ...target, is_admin: !!body.value });
      return json(200, { ok: true });
    }

    if (action === "deleteUser") {
      if (!me.is_admin) return json(403, { error: "Nur für Admins." });
      const name = body.target;
      await db.from("app_users").delete().eq("name", name);
      await db.from("personalakten").delete().eq("name", name);
      const folder = name.replace(/[^a-z0-9]+/gi, "_");
      const { data: files } = await db.storage.from("personalakte").list(folder, { limit: 1000 });
      if (files && files.length) await db.storage.from("personalakte").remove(files.map((f) => `${folder}/${f.name}`));
      return json(200, { ok: true });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    return json(500, { error: "Serverfehler: " + (e && e.message ? e.message : String(e)) });
  }
}
