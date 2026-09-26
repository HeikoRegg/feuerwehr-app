// netlify/functions/personalakte.js
// Personalakten liegen in der geschützten Tabelle "personalakten" und die Nachweis-Fotos
// im privaten Speicher "personalakte". Lesen und Schreiben ist nur über diese Funktion
// möglich – und nur für die Person selbst und für Admins.

import { createClient } from "@supabase/supabase-js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "personalakte";
const ADMIN_ONLY_FIELDS = ["befoerderungen", "ehrungen", "funktionen"]; // Rang, Beförderungen, Ehrungen, Funktionen: nur Admin

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const folderFor = (name) => String(name || "").replace(/[^a-z0-9]+/gi, "_");

async function userByToken(token) {
  if (!token) return null;
  // Kleine Tabelle – deshalb einfach alle Benutzer laden und den Schlüssel hier im Code suchen.
  const { data, error } = await db.from("app_users").select("name,is_admin,tokens,blocked,elevated_token,elevated_until");
  if (error) throw error;
  return (data || []).find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) || null;
}
async function loadAkte(name) {
  const { data } = await db.from("personalakten").select("data").eq("name", name).maybeSingle();
  return (data && data.data) || {};
}
function photoPaths(akte) {
  return ((akte && akte.lehrgaenge) || []).map((l) => l.photoPath).filter(Boolean);
}
function aktuellerRang(akte) {
  const list = ((akte && akte.befoerderungen) || []).filter((b) => b.rang).sort((a, b) => (a.datum || "").localeCompare(b.datum || ""));
  return list.length ? list[list.length - 1].rang : "";
}

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }

  try {
    const me = await userByToken(body.token);
    if (!me) return json(401, { error: "Bitte PIN bestätigen." });
    const isAdmin = !!me.is_admin;
    const { action, target } = body;

    // Fremde Akten (und Übersicht/Arbeitgeberliste) nur mit frischer PIN-Freischaltung.
    const brauchtFreischaltung = action === "list" || action === "arbeitgeber" || (target && target !== me.name);
    if (brauchtFreischaltung) {
      if (!isAdmin) return json(403, { error: "Du darfst nur deine eigene Personalakte sehen." });
      const ok = body.elevatedToken && me.elevated_token === body.elevatedToken && me.elevated_until && new Date(me.elevated_until) > new Date();
      if (!ok) return json(403, { error: "Bitte PIN eingeben.", code: "PIN_NOETIG" });
    }

    if (action === "arbeitgeber") {
      const names = Array.isArray(body.names) ? body.names : [];
      const { data } = await db.from("personalakten").select("name,data").in("name", names.length ? names : ["-"]);
      const byName = Object.fromEntries((data || []).map((r) => [r.name, r.data || {}]));
      const items = names.map((n) => ({ name: n, arbeitgeber: { name: "", telefon: "", email: "", ...((byName[n] || {}).arbeitgeber || {}) } }))
        .sort((a, b) => a.name.localeCompare(b.name, "de"));
      return json(200, { items });
    }

    if (action === "list") {
      if (!isAdmin) return json(403, { error: "Nur für Admins." });
      const { data } = await db.from("personalakten").select("name,data");
      const items = (data || []).map((row) => ({
        name: row.name,
        geburtsdatum: (row.data && row.data.geburtsdatum) || "",
        eintrittsdatum: (row.data && row.data.eintrittsdatum) || "",
        rang: aktuellerRang(row.data),
      }));
      return json(200, { items });
    }

    if (!target) return json(400, { error: "Person fehlt." });
    if (!isAdmin && target !== me.name) return json(403, { error: "Du darfst nur deine eigene Personalakte sehen." });

    if (action === "get") {
      const akte = await loadAkte(target);
      const lehrgaenge = await Promise.all(((akte.lehrgaenge) || []).map(async (l) => {
        if (!l.photoPath) return l;
        const { data } = await db.storage.from(BUCKET).createSignedUrl(l.photoPath, 60 * 60);
        return { ...l, photoUrl: data ? data.signedUrl : null };
      }));
      return json(200, { data: { ...akte, lehrgaenge } });
    }

    if (action === "save") {
      const old = await loadAkte(target);
      const incoming = { ...(body.data || {}) };
      // Nicht-Admins können Rang/Beförderungen/Ehrungen nicht ändern – alte Werte bleiben.
      if (!isAdmin) for (const f of ADMIN_ONLY_FIELDS) incoming[f] = old[f] || [];
      incoming.lehrgaenge = (incoming.lehrgaenge || []).map(({ photoUrl, ...rest }) => {
        // Foto-Pfade dürfen nur in den Ordner der Person zeigen.
        if (rest.photoPath && !rest.photoPath.startsWith(folderFor(target) + "/")) rest.photoPath = null;
        return rest;
      });
      const { error } = await db.from("personalakten").upsert({ name: target, data: incoming, updated_at: new Date().toISOString() });
      if (error) throw error;
      // Nicht mehr verwendete Nachweis-Fotos endgültig löschen.
      const stillUsed = new Set(photoPaths(incoming));
      const removed = photoPaths(old).filter((p) => !stillUsed.has(p));
      if (removed.length) await db.storage.from(BUCKET).remove(removed);
      return json(200, { ok: true });
    }

    if (action === "uploadUrl") {
      const safe = String(body.filename || "foto").replace(/[^a-z0-9.\-_]+/gi, "_").slice(-60);
      const path = `${folderFor(target)}/${Date.now()}_${safe}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return json(200, { path, uploadToken: data.token });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    return json(500, { error: "Serverfehler: " + (e && e.message ? e.message : String(e)) });
  }
}
