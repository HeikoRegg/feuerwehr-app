// netlify/functions/geraete.js
// Gerätedatenbank mit Prüfungen und Mängelmeldungen.
//  - Standorte (Fahrzeuge, Geräteraum …) mit Fächern           -> Tabelle geraete_orte
//  - Geräte inkl. Prüfarten und letztem Prüfstand              -> Tabelle geraete
//  - Prüfverlauf (jede Prüfung)                                -> Tabelle geraete_pruefungen
//  - Mängel mit Foto, Notizen und Status                       -> Tabelle geraete_maengel
//  - Fotos im privaten Speicher "geraete" (Zugriff über kurzlebige Links)
//
// Rechte (immer frisch aus der Mitgliederliste ermittelt):
//  - Zugriff, Prüfungen eintragen, Mängel melden: Einsatzabteilung, Gerätewart, Kommandant, stellv. Kommandant, Admins
//  - Mängel bearbeiten (Notizen, Status): Gerätewart, Kommandant, stellv. Kommandant, Admins
//  - Geräte, Standorte, Fristen (Elektroprüfung, externe Prüfung, Verfallsdatum) pflegen: Gerätewart und Admins
// Bei jedem neuen Mangel bekommen Gerätewart, Kommandant, stellv. Kommandant und Admins eine Push-Nachricht.

import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { handler as sendPush } from "./send-push.js";

const db = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const BUCKET = "geraete";

// Prüfarten: "intervall" = alle X Tage wieder fällig, "datum" = gültig bis zu einem eingetragenen Datum.
const ARTEN = { sicht: "intervall", funktion: "intervall", tank: "intervall", akku: "intervall", vollzaehlig: "intervall", elektro: "datum", extern: "datum", verfall: "datum" };
const ART_NAME = { sicht: "Sichtprüfung", funktion: "Funktionsprüfung", tank: "Tank / Kraftstoff", akku: "Akku", vollzaehlig: "Vollzähligkeit", elektro: "Elektroprüfung", extern: "Externe Prüfung", verfall: "Verfallsdatum" };
const STATUS = { offen: "Offen", bearbeitung: "In Bearbeitung", behoben: "Behoben" };
const OFFENE_STATUS = ["offen", "bearbeitung"];

const json = (statusCode, body) => ({ statusCode, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const neueId = () => crypto.randomBytes(5).toString("hex");
const kurz = (v, n) => String(v ?? "").trim().slice(0, n);
const istDatum = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || "")) && !isNaN(Date.parse(s));
const fehler = (code, text) => { const e = new Error(text); e.code = code; return e; };

async function getKv(key) {
  const { data } = await db.from("kv_store").select("value").eq("key", key).maybeSingle();
  return data ? data.value : null;
}

async function ladeLage(token) {
  const [usersRes, roster] = await Promise.all([db.from("app_users").select("name,is_admin,tokens,blocked"), getKv("roster")]);
  if (usersRes.error) throw usersRes.error;
  const users = usersRes.data || [];
  const me = token ? users.find((u) => !u.blocked && Array.isArray(u.tokens) && u.tokens.includes(token)) : null;
  const liste = roster || [];
  const e = (me && liste.find((r) => r && r.name === me.name)) || {};
  const admin = !!(me && me.is_admin);
  const verwalter = admin || !!e.geraetewart;
  const bearbeiter = verwalter || !!e.kommandant || !!e.stellvKommandant;
  const einsatz = (e.bereiche || []).includes("einsatzabteilung");
  return { me, users, roster: liste, rechte: { verwalter, bearbeiter, zugriff: admin || einsatz || bearbeiter } };
}
// Gerätewart, Kommandant, stellv. Kommandant und Admins (ohne den Absender, ohne gesperrte Mitglieder).
function fuehrungsNamen(lage, ausser) {
  const gesperrt = new Set([...lage.users.filter((u) => u.blocked).map((u) => u.name), ...lage.roster.filter((r) => r && r.gesperrt).map((r) => r.name)]);
  const namen = new Set([
    ...lage.users.filter((u) => u.is_admin).map((u) => u.name),
    ...lage.roster.filter((r) => r && (r.geraetewart || r.kommandant || r.stellvKommandant)).map((r) => r.name),
  ]);
  return [...namen].filter((n) => n && !gesperrt.has(n) && n !== ausser);
}
async function push(an, title, text, sender) {
  if (!an.length) return;
  try { await sendPush({ httpMethod: "POST", body: JSON.stringify({ an, title, text, sender }) }); } catch (e) { /* Push ist Zusatz – die Meldung ist gespeichert */ }
}
async function fotoUrl(path) {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data ? data.signedUrl : null;
}
async function fotoLoeschen(pfade) {
  const p = (pfade || []).filter(Boolean);
  if (p.length) { try { await db.storage.from(BUCKET).remove(p); } catch (e) { /* egal */ } }
}

function saubereGeraet(d, orteIds) {
  const name = kurz(d.name, 80);
  if (!name) throw fehler(400, "Bitte einen Gerätenamen eingeben.");
  const ort = kurz(d.ort, 40);
  if (ort && !orteIds.has(ort)) throw fehler(400, "Dieser Standort existiert nicht (mehr).");
  const menge = Math.max(1, Math.min(999, parseInt(d.menge, 10) || 1));
  const pruefarten = [];
  (Array.isArray(d.pruefarten) ? d.pruefarten : []).forEach((p) => {
    if (!p || !ARTEN[p.art] || pruefarten.some((x) => x.art === p.art)) return;
    const standard = ARTEN[p.art] === "intervall" ? 30 : 12; // Tage bzw. Monate
    const intervall = Math.max(0, Math.min(3650, parseInt(p.intervall, 10) || (ARTEN[p.art] === "datum" && p.art === "verfall" ? 0 : standard)));
    pruefarten.push({ art: p.art, intervall });
  });
  return {
    name, kurzname: kurz(d.kurzname, 40), ort, fach: kurz(d.fach, 40), menge,
    inventar: kurz(d.inventar, 40), seriennummer: kurz(d.seriennummer, 60), hersteller: kurz(d.hersteller, 60),
    baujahr: String(d.baujahr ?? "").replace(/[^\d]/g, "").slice(0, 4), notiz: kurz(d.notiz, 500),
    pruefarten, ausgesondert: !!d.ausgesondert,
  };
}

async function geraetLaden(id) {
  const { data } = await db.from("geraete").select("*").eq("id", String(id || "")).maybeSingle();
  return data || null;
}
const alsGeraet = (row) => ({ ...(row.data || {}), id: row.id });
const alsMangel = (row) => ({ ...(row.data || {}), id: row.id, geraet: row.geraet, status: row.status, created_at: row.created_at });

export async function handler(event) {
  if (event.httpMethod !== "POST") return json(405, { error: "Method Not Allowed" });
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { return json(400, { error: "Ungültige Anfrage." }); }

  try {
    const lage = await ladeLage(body.token);
    if (!lage.me) return json(401, { error: "Bitte PIN bestätigen." });
    if (!lage.rechte.zugriff) return json(403, { error: "Die Geräteprüfung ist für die Einsatzabteilung." });
    const ich = lage.me.name;
    const { verwalter, bearbeiter } = lage.rechte;
    const { action } = body;
    const nurVerwalter = () => { if (!verwalter) throw fehler(403, "Das dürfen nur der Gerätewart und die Admins."); };
    const nurBearbeiter = () => { if (!bearbeiter) throw fehler(403, "Das dürfen nur Gerätewart, Kommandant, stellv. Kommandant und Admins."); };

    if (action === "list") {
      const [o, g, m] = await Promise.all([
        db.from("geraete_orte").select("*"),
        db.from("geraete").select("*"),
        db.from("geraete_maengel").select("*").in("status", OFFENE_STATUS),
      ]);
      if (o.error) throw o.error; if (g.error) throw g.error; if (m.error) throw m.error;
      const maengel = (m.data || []).map(alsMangel);
      const geraete = (g.data || []).map((row) => {
        const eigene = maengel.filter((x) => x.geraet === row.id);
        const d = alsGeraet(row);
        return { ...d, hatFoto: !!d.foto, foto: undefined, offeneMaengel: eigene.length, nichtEinsatzbereit: eigene.some((x) => x.nichtEinsatzbereit) };
      });
      const orte = (o.data || []).map((x) => ({ id: x.id, name: x.name, faecher: x.faecher || [], sort: x.sort || 0 })).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, "de"));
      return json(200, {
        ich, rechte: lage.rechte, orte, geraete,
        maengel: maengel.map((x) => ({ id: x.id, geraet: x.geraet, von: x.von, ts: x.ts, text: x.text, status: x.status, nichtEinsatzbereit: !!x.nichtEinsatzbereit, notizen: (x.verlauf || []).length, art: x.art || "" })).sort((a, b) => String(b.ts).localeCompare(String(a.ts))),
      });
    }

    if (action === "get") {
      const row = await geraetLaden(body.id);
      if (!row) return json(404, { error: "Dieses Gerät gibt es nicht (mehr)." });
      const [h, m] = await Promise.all([
        db.from("geraete_pruefungen").select("*").eq("geraet", row.id),
        db.from("geraete_maengel").select("*").eq("geraet", row.id),
      ]);
      const historie = (h.data || []).sort((a, b) => String(b.ts).localeCompare(String(a.ts))).slice(0, 60);
      const maengel = await Promise.all((m.data || []).map(async (r) => { const x = alsMangel(r); return { ...x, fotoUrl: await fotoUrl(x.foto) }; }));
      maengel.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
      const d = alsGeraet(row);
      return json(200, { geraet: { ...d, fotoUrl: await fotoUrl(d.foto) }, historie, maengel, rechte: lage.rechte });
    }

    if (action === "saveOrt") {
      nurVerwalter();
      const name = kurz(body.name, 40);
      if (!name) return json(400, { error: "Bitte einen Namen eingeben." });
      const faecher = [...new Set((Array.isArray(body.faecher) ? body.faecher : []).map((f) => kurz(f, 40)).filter(Boolean))].slice(0, 60);
      const { data: alle } = await db.from("geraete_orte").select("*");
      const id = body.id ? String(body.id) : neueId();
      if ((alle || []).some((o) => o.id !== id && String(o.name).toLowerCase() === name.toLowerCase())) return json(400, { error: "Diesen Standort gibt es schon." });
      const vorhanden = (alle || []).find((o) => o.id === id);
      const sort = vorhanden ? vorhanden.sort || 0 : (alle || []).reduce((m, o) => Math.max(m, o.sort || 0), 0) + 1;
      const { error } = await db.from("geraete_orte").upsert({ id, name, faecher, sort });
      if (error) throw error;
      return json(200, { ok: true, id });
    }

    if (action === "deleteOrt") {
      nurVerwalter();
      const id = String(body.id || "");
      const { data: drin } = await db.from("geraete").select("id,data");
      const anzahl = (drin || []).filter((g) => (g.data || {}).ort === id).length;
      if (anzahl) return json(400, { error: `In diesem Standort ${anzahl === 1 ? "liegt noch 1 Gerät" : `liegen noch ${anzahl} Geräte`}. Bitte zuerst verschieben oder löschen.` });
      await db.from("geraete_orte").delete().eq("id", id);
      return json(200, { ok: true });
    }

    if (action === "saveGeraet" || action === "anlegenMehrere") {
      nurVerwalter();
      const { data: orte } = await db.from("geraete_orte").select("id");
      const orteIds = new Set((orte || []).map((o) => o.id));
      const jetzt = new Date().toISOString();

      if (action === "anlegenMehrere") {
        const zeilen = (Array.isArray(body.zeilen) ? body.zeilen : []).filter((z) => z && kurz(z.name, 80)).slice(0, 200);
        if (!zeilen.length) return json(400, { error: "Bitte mindestens ein Gerät eintragen." });
        const ids = [];
        for (const z of zeilen) {
          const d = saubereGeraet({ ...z, ort: body.ort, fach: body.fach, pruefarten: body.pruefarten }, orteIds);
          const id = neueId(); ids.push(id);
          const { error } = await db.from("geraete").upsert({ id, data: { ...d, pruefstand: {}, angelegtVon: ich, angelegtAm: jetzt }, created_at: jetzt, updated_at: jetzt });
          if (error) throw error;
        }
        return json(200, { ok: true, ids });
      }

      const d = saubereGeraet(body.geraet || {}, orteIds);
      const alt = body.geraet && body.geraet.id ? await geraetLaden(body.geraet.id) : null;
      if (body.geraet && body.geraet.id && !alt) return json(404, { error: "Dieses Gerät gibt es nicht (mehr)." });
      const id = alt ? alt.id : neueId();
      const altD = (alt && alt.data) || {};
      // Foto: nur Pfade aus dem eigenen Ordner "geraet/" übernehmen; ein ersetztes Foto wird gelöscht.
      let foto = altD.foto || "";
      if (body.geraet && "foto" in body.geraet) {
        const neu = String(body.geraet.foto || "");
        foto = neu.startsWith("geraet/") ? neu : "";
        if (altD.foto && altD.foto !== foto) await fotoLoeschen([altD.foto]);
      }
      const behalten = new Set(d.pruefarten.map((p) => p.art));
      const pruefstand = Object.fromEntries(Object.entries(altD.pruefstand || {}).filter(([k]) => behalten.has(k)));
      const row = { id, data: { ...d, foto, pruefstand, angelegtVon: altD.angelegtVon || ich, angelegtAm: altD.angelegtAm || jetzt }, created_at: alt ? alt.created_at : jetzt, updated_at: jetzt };
      const { error } = await db.from("geraete").upsert(row);
      if (error) throw error;
      return json(200, { ok: true, id });
    }

    if (action === "deleteGeraet") {
      nurVerwalter();
      const row = await geraetLaden(body.id);
      if (!row) return json(200, { ok: true });
      const { data: m } = await db.from("geraete_maengel").select("*").eq("geraet", row.id);
      await fotoLoeschen([(row.data || {}).foto, ...(m || []).map((x) => (x.data || {}).foto)]);
      await db.from("geraete_pruefungen").delete().eq("geraet", row.id);
      await db.from("geraete_maengel").delete().eq("geraet", row.id);
      await db.from("geraete").delete().eq("id", row.id);
      return json(200, { ok: true });
    }

    if (action === "uploadUrl") {
      const art = body.art === "geraet" ? "geraet" : "mangel";
      if (art === "geraet") nurVerwalter();
      const safe = String(body.filename || "foto.jpg").replace(/[^a-z0-9.\-_]+/gi, "_").slice(-60);
      const path = `${art}/${neueId()}/${Date.now()}_${safe}`;
      const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path);
      if (error) throw error;
      return json(200, { path, uploadToken: data.token });
    }

    // Mangel melden (frei oder aus einer Prüfung heraus)
    const mangelAnlegen = async (row, art, text, foto, nichtEinsatzbereit, jetzt) => {
      const id = neueId();
      const { error } = await db.from("geraete_maengel").upsert({
        id, geraet: row.id, status: "offen", created_at: jetzt, updated_at: jetzt,
        data: { von: ich, ts: jetzt, text, art: art || "", foto: String(foto || "").startsWith("mangel/") ? foto : "", nichtEinsatzbereit: !!nichtEinsatzbereit, verlauf: [] },
      });
      if (error) throw error;
      return id;
    };
    const mangelPush = async (row, texte, nichtEinsatzbereit) => {
      const d = row.data || {};
      const name = d.kurzname || d.name;
      await push(fuehrungsNamen(lage, ich), `⚠️ Mangel: ${name}${nichtEinsatzbereit ? " (nicht einsatzbereit)" : ""}`, `${ich}: ${texte.join(" · ")}`, ich);
    };

    if (action === "mangel") {
      const row = await geraetLaden(body.geraet);
      if (!row) return json(404, { error: "Dieses Gerät gibt es nicht (mehr)." });
      const text = kurz(body.text, 1000);
      if (text.length < 3) return json(400, { error: "Bitte kurz beschreiben, was defekt ist oder fehlt." });
      const jetzt = new Date().toISOString();
      const id = await mangelAnlegen(row, "", text, body.foto, body.nichtEinsatzbereit, jetzt);
      await mangelPush(row, [text], body.nichtEinsatzbereit);
      return json(200, { ok: true, id });
    }

    if (action === "pruefen") {
      const row = await geraetLaden(body.geraet);
      if (!row) return json(404, { error: "Dieses Gerät gibt es nicht (mehr)." });
      const d = row.data || {};
      const ergebnisse = Array.isArray(body.ergebnisse) ? body.ergebnisse : [];
      if (!ergebnisse.length) return json(400, { error: "Keine Prüfung ausgewählt." });
      const jetzt = new Date().toISOString();
      const stand = { ...(d.pruefstand || {}) };
      const mangelTexte = []; let nichtEinsatzbereit = false;
      for (const e of ergebnisse) {
        const art = e && e.art;
        if (!ARTEN[art] || !(d.pruefarten || []).some((p) => p.art === art)) return json(400, { error: "Diese Prüfart gehört nicht zu diesem Gerät." });
        if (e.ergebnis !== "ok" && e.ergebnis !== "mangel") return json(400, { error: "Bitte „in Ordnung“ oder „Mangel“ wählen." });
        let bis = "";
        if (ARTEN[art] === "datum") {
          nurVerwalter();
          if (e.ergebnis === "ok") { if (!istDatum(e.bis)) return json(400, { error: `Bitte bei „${ART_NAME[art]}“ eintragen, bis wann die Prüfung gilt.` }); bis = e.bis; }
          else if (istDatum(e.bis)) bis = e.bis;
        }
        const text = kurz(e.text, 1000);
        if (e.ergebnis === "mangel" && text.length < 3) return json(400, { error: `Bitte bei „${ART_NAME[art]}“ kurz beschreiben, was nicht stimmt.` });
        stand[art] = { ts: jetzt, von: ich, ergebnis: e.ergebnis, ...(bis ? { bis } : {}) };
        const { error } = await db.from("geraete_pruefungen").upsert({ id: neueId(), geraet: row.id, ts: jetzt, von: ich, art, ergebnis: e.ergebnis, text, bis });
        if (error) throw error;
        if (e.ergebnis === "mangel") {
          await mangelAnlegen(row, art, `${ART_NAME[art]}: ${text}`, e.foto, e.nichtEinsatzbereit, jetzt);
          mangelTexte.push(`${ART_NAME[art]}: ${text}`);
          if (e.nichtEinsatzbereit) nichtEinsatzbereit = true;
        }
      }
      const { error } = await db.from("geraete").upsert({ ...row, data: { ...d, pruefstand: stand }, updated_at: jetzt });
      if (error) throw error;
      if (mangelTexte.length) await mangelPush(row, mangelTexte, nichtEinsatzbereit);
      return json(200, { ok: true, pruefstand: stand, maengel: mangelTexte.length });
    }

    if (action === "notiz") {
      nurBearbeiter();
      const { data: m } = await db.from("geraete_maengel").select("*").eq("id", String(body.mangel || "")).maybeSingle();
      if (!m) return json(404, { error: "Diesen Mangel gibt es nicht (mehr)." });
      const text = kurz(body.text, 600);
      const status = body.status && STATUS[body.status] ? body.status : null;
      const d = m.data || {};
      const neuerStatus = status && status !== m.status ? status : null;
      if (!text && !neuerStatus) return json(400, { error: "Bitte eine Notiz schreiben oder den Status ändern." });
      const jetzt = new Date().toISOString();
      const verlauf = [...(d.verlauf || []), { id: neueId(), von: ich, ts: jetzt, text, ...(neuerStatus ? { status: neuerStatus } : {}) }];
      const neu = { ...d, verlauf };
      if (neuerStatus === "behoben") { neu.behobenVon = ich; neu.behobenAm = jetzt; }
      if (neuerStatus && neuerStatus !== "behoben") { delete neu.behobenVon; delete neu.behobenAm; }
      const { error } = await db.from("geraete_maengel").upsert({ ...m, status: neuerStatus || m.status, data: neu, updated_at: jetzt });
      if (error) throw error;
      // Der Melder erfährt, was daraus geworden ist.
      if (d.von && d.von !== ich) {
        const row = await geraetLaden(m.geraet);
        const gd = (row && row.data) || {};
        const zeile = [text, neuerStatus ? `Status: ${STATUS[neuerStatus]}` : ""].filter(Boolean).join(" · ");
        await push([d.von], `🔧 Dein Mangel: ${gd.kurzname || gd.name || "Gerät"}`, `${ich}: ${zeile}`, ich);
      }
      return json(200, { ok: true });
    }

    if (action === "deleteMangel") {
      nurVerwalter();
      const { data: m } = await db.from("geraete_maengel").select("*").eq("id", String(body.mangel || "")).maybeSingle();
      if (!m) return json(200, { ok: true });
      await fotoLoeschen([(m.data || {}).foto]);
      await db.from("geraete_maengel").delete().eq("id", m.id);
      return json(200, { ok: true });
    }

    return json(400, { error: "Unbekannte Aktion." });
  } catch (e) {
    if (e && e.code && typeof e.code === "number") return json(e.code, { error: e.message });
    const text = e && e.message ? e.message : String(e);
    if (/geraete/.test(text) && /(does not exist|not find|schema cache)/i.test(text)) {
      return json(500, { error: "Die Datenbank-Tabellen für die Geräte fehlen noch. Bitte das SQL aus der Update-Anleitung in Supabase ausführen." });
    }
    return json(500, { error: "Serverfehler: " + text });
  }
}
