// Berechnung aller Statistiken für die Statistik-Kachel und den Jahresbericht.
// App-Ansicht und Druckbericht nutzen dieselben Ergebnisse, damit die Zahlen immer übereinstimmen.
import { BEREICHE, BEREICH_KEYS, CATEGORIES } from "./constants";
import { atemschutzStatus, todayISO } from "./helpers";

export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const namenSort = (arr) => [...arr].sort((a, b) => a.localeCompare(b, "de"));

// Werte in Gruppen einsortieren (z. B. Altersgruppen in 5-Jahres-Schritten).
function gruppiere(werte, schritt, start, ende) {
  const gruppen = [];
  for (let g = start; g < ende; g += schritt) gruppen.push({ von: g, bis: g + schritt - 1, label: `${g} – ${g + schritt - 1}`, value: 0, names: [] });
  gruppen.push({ von: ende, bis: 999, label: `${ende}+`, value: 0, names: [] });
  werte.forEach(({ wert, name }) => {
    const gr = wert < start ? gruppen[0] : gruppen.find((x) => wert >= x.von && wert <= x.bis);
    if (gr) { gr.value++; gr.names.push(name); }
  });
  const erster = gruppen.findIndex((x) => x.value > 0);
  if (erster === -1) return [];
  let letzter = gruppen.length - 1;
  while (gruppen[letzter].value === 0) letzter--;
  return gruppen.slice(erster, letzter + 1).map((x) => ({ label: x.label, value: x.value, names: namenSort(x.names) }));
}
const zaehle = (paare) => {
  const z = {};
  paare.forEach(([key, name]) => { (z[key] ||= []).push(name); });
  return Object.entries(z).map(([label, names]) => ({ label, value: names.length, names: namenSort(names) })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "de"));
};

export function jahreAuswahl(events) {
  const jetzt = new Date().getFullYear();
  const jahre = (events || []).map((e) => Number(String(e.date || "").slice(0, 4))).filter((y) => y > 2000 && y <= jetzt);
  const min = Math.min(jetzt, ...jahre);
  const liste = [];
  for (let y = jetzt; y >= min; y--) liste.push(y);
  return liste;
}

export const STATISTIK_REITER = [
  { key: "personal", label: "Personal" },
  { key: "ausbildung", label: "Ausbildung" },
  { key: "einsatz", label: "Einsatzbereitschaft" },
  { key: "dienst", label: "Dienstbetrieb" },
];

// roster: nur aktive (nicht gesperrte) Mitglieder
// akten: vom Server gelieferte, auf das Nötigste reduzierte Daten aus den Personalakten (auch Gesperrte, für Austritte)
export function berechneStatistik({ jahr, roster, events, sitzungen, vehicles, bewegung, akten }) {
  const heute = todayISO();
  const jahrStr = String(jahr);
  const imJahr = (datum) => String(datum || "").slice(0, 4) === jahrStr;
  const aktive = new Set(roster.map((r) => r.name));
  const aktenAktiv = (akten || []).filter((a) => aktive.has(a.name));
  const aktenByName = Object.fromEntries(aktenAktiv.map((a) => [a.name, a]));
  const ea = roster.filter((r) => r.bereiche.includes("einsatzabteilung"));

  // ---------------- PERSONAL ----------------
  const mitAlter = roster.filter((r) => aktenByName[r.name] && aktenByName[r.name].geburtsjahr);
  const alterVon = (r) => jahr - aktenByName[r.name].geburtsjahr;
  const durchschnitt = (liste) => (liste.length ? Math.round(liste.reduce((s, r) => s + alterVon(r), 0) / liste.length) : null);
  const oAlter = durchschnitt(mitAlter);
  const fehlendeGeburtsdaten = roster.length - mitAlter.length;
  const personal = {
    kpis: [
      { label: "Mitglieder", value: roster.length },
      { label: "Einsatzabteilung", value: ea.length },
      { label: "Ø Alter", value: oAlter ?? "–", suffix: oAlter ? " J." : "" },
    ],
    sections: [
      { id: "stand", title: "Personalstand je Bereich", type: "bars",
        items: BEREICH_KEYS.map((b) => { const names = namenSort(roster.filter((r) => r.bereiche.includes(b)).map((r) => r.name)); return { label: BEREICHE[b].label, value: names.length, names, color: BEREICHE[b].color }; }),
        note: "Ein Mitglied kann mehreren Bereichen angehören." },
      { id: "alter", title: `Altersstruktur ${jahr} (5-Jahres-Schritte)`, type: "bars",
        items: gruppiere(mitAlter.map((r) => ({ wert: alterVon(r), name: r.name })), 5, 10, 70),
        empty: "Noch keine Geburtsdaten in den Personalakten eingetragen.",
        note: fehlendeGeburtsdaten ? `${fehlendeGeburtsdaten} Mitglied(er) ohne Geburtsdatum nicht berücksichtigt.` : "" },
      { id: "alterbereich", title: "Durchschnittsalter je Bereich", type: "bars",
        items: BEREICH_KEYS.map((b) => { const l = mitAlter.filter((r) => r.bereiche.includes(b)); return l.length ? { label: BEREICHE[b].label, value: durchschnitt(l), suffix: " J.", color: BEREICHE[b].color } : null; }).filter(Boolean),
        empty: "Noch keine Geburtsdaten in den Personalakten eingetragen." },
      { id: "dienst", title: `Dienstjahre ${jahr}`, type: "bars",
        items: gruppiere(roster.filter((r) => aktenByName[r.name] && aktenByName[r.name].dienstbeginnJahr).map((r) => ({ wert: Math.max(0, jahr - aktenByName[r.name].dienstbeginnJahr), name: r.name })), 5, 0, 40),
        empty: "Noch keine Eintrittsdaten in den Personalakten eingetragen.",
        note: "Gezählt ab Eintritt, frühestens ab dem 14. Geburtstag." },
      { id: "raenge", title: "Ränge (aktuell)", type: "bars",
        items: zaehle(roster.filter((r) => aktenByName[r.name] && aktenByName[r.name].rang).map((r) => [aktenByName[r.name].rang, r.name])),
        empty: "Noch keine Ränge in den Personalakten eingetragen." },
      { id: "entwicklung", title: `Mitgliederentwicklung ${jahr}`, type: "bars",
        items: [
          { label: "Eintritte", names: (akten || []).filter((a) => a.eintrittsjahr === jahr).map((a) => a.name) },
          { label: "Übertritte", names: (akten || []).filter((a) => (a.verlauf || []).some((v) => v.jahr === jahr && /übertritt/i.test(v.text))).map((a) => a.name) },
          { label: "Austritte", names: (akten || []).filter((a) => (a.verlauf || []).some((v) => v.jahr === jahr && /^\s*austritt/i.test(v.text))).map((a) => a.name) },
          { label: "Wiedereintritte", names: (akten || []).filter((a) => (a.verlauf || []).some((v) => v.jahr === jahr && /wiedereintritt/i.test(v.text))).map((a) => a.name) },
        ].map((x) => ({ ...x, value: x.names.length, names: namenSort(x.names) })),
        note: "Aus Eintrittsdatum und Mitgliedsverlauf der Personalakten." },
    ],
  };

  // ---------------- AUSBILDUNG ----------------
  const funktionen = zaehle(roster.flatMap((r) => ((aktenByName[r.name] || {}).funktionen || []).map((f) => [f, r.name])));
  const lehrgaenge = zaehle(aktenAktiv.flatMap((a) => (a.lehrgaenge || []).filter((l) => l.jahr === jahr).map((l) => [l.titel || "ohne Bezeichnung", a.name])));
  const abzeichen = zaehle(aktenAktiv.flatMap((a) => (a.leistungsabzeichen || []).filter((l) => l.jahr === jahr).map((l) => [l.titel || "ohne Bezeichnung", a.name])));
  const summe = (l) => l.reduce((s, x) => s + x.value, 0);
  const ausbildung = {
    kpis: [
      { label: `Lehrgänge ${jahr}`, value: summe(lehrgaenge) },
      { label: `Leistungsabz. ${jahr}`, value: summe(abzeichen) },
      { label: "Maschinisten", value: (funktionen.find((f) => f.label === "Maschinist") || { value: 0 }).value },
    ],
    sections: [
      { id: "funktionen", title: "Aktive Funktionen / Qualifikationen", type: "bars", items: funktionen, empty: "Noch keine Funktionen in den Personalakten eingetragen." },
      { id: "lehrgaenge", title: `Lehrgänge ${jahr}`, type: "bars", items: lehrgaenge, empty: `Keine Lehrgänge mit Datum ${jahr} eingetragen.` },
      { id: "abzeichen", title: `Leistungsabzeichen ${jahr}`, type: "bars", items: abzeichen, empty: `Keine Leistungsabzeichen mit Datum ${jahr} eingetragen.` },
    ],
  };

  // ---------------- EINSATZBEREITSCHAFT (aktueller Stand) ----------------
  const traeger = roster.filter((r) => r.atemschutz);
  const status = traeger.map((r) => ({ name: r.name, st: atemschutzStatus(r) }));
  const tauglich = status.filter((x) => x.st.allValid).map((x) => x.name);
  const asInEa = traeger.filter((r) => r.bereiche.includes("einsatzabteilung"));
  const lkw = ea.filter((r) => r.fuehrerschein.lkw.hasLicense);
  const pkw = ea.filter((r) => r.fuehrerschein.pkw.hasLicense);
  const planJahr = Object.entries((bewegung && bewegung.plan) || {}).filter(([k, m]) => k.startsWith(jahrStr) && m.status !== "ausgesetzt");
  let bwGeplant = 0, bwErledigt = 0;
  planJahr.forEach(([, m]) => Object.values(m.fahrzeuge || {}).forEach((f) => { bwGeplant++; if (f.erledigt) bwErledigt++; }));
  const maengelJahr = ((bewegung && bewegung.maengel) || []).filter((m) => imJahr(m.datum));
  const einsatz = {
    note: "Atemschutz, Führerscheine und Einweisungen zeigen den aktuellen Stand.",
    kpis: [
      { label: "AS einsatztauglich", value: `${tauglich.length}/${traeger.length}` },
      { label: "AS-Anteil an EA", value: pct(asInEa.length, ea.length), suffix: " %" },
      { label: "LKW-Führerschein", value: lkw.length },
    ],
    sections: [
      { id: "as-anteil", title: "Atemschutzgeräteträger in der Einsatzabteilung", type: "ratio",
        items: [{ label: "Atemschutzträger", value: asInEa.length, max: ea.length, names: namenSort(asInEa.map((r) => r.name)), namesLabel: "Atemschutzträger" }] },
      { id: "as-tauglich", title: "Atemschutz: einsatztauglich", type: "ratio",
        items: [{ label: "einsatztauglich", value: tauglich.length, max: traeger.length, names: namenSort(traeger.filter((r) => !tauglich.includes(r.name)).map((r) => r.name)), namesLabel: "nicht tauglich" }] },
      { id: "as-gruende", title: "Woran es hängt (Atemschutz)", type: "bars", color: "#C1272D",
        items: [
          { label: "G26.3 fehlt/abgelaufen", names: status.filter((x) => !x.st.g26Valid).map((x) => x.name) },
          { label: "Streckendurchgang", names: status.filter((x) => !x.st.streckeValid).map((x) => x.name) },
          { label: "Übung", names: status.filter((x) => !x.st.uebungValid).map((x) => x.name) },
          { label: "Unterweisung", names: status.filter((x) => !x.st.unterweisungValid).map((x) => x.name) },
        ].map((x) => ({ ...x, value: x.names.length, names: namenSort(x.names) })),
        note: "Fehlend oder abgelaufen. Eine Person kann mehrfach gezählt sein." },
      { id: "fs", title: `Führerscheinkontrolle ${jahr} (Einsatzabteilung)`, type: "ratio",
        items: [
          { label: "PKW kontrolliert", value: pkw.filter((r) => r.fuehrerschein.pkw.confirmedYear === jahr).length, max: pkw.length, names: namenSort(pkw.filter((r) => r.fuehrerschein.pkw.confirmedYear !== jahr).map((r) => r.name)), namesLabel: "noch offen" },
          { label: "LKW kontrolliert", value: lkw.filter((r) => r.fuehrerschein.lkw.confirmedYear === jahr).length, max: lkw.length, names: namenSort(lkw.filter((r) => r.fuehrerschein.lkw.confirmedYear !== jahr).map((r) => r.name)), namesLabel: "noch offen" },
        ] },
      { id: "einweisung", title: "Fahrzeugeinweisungen (berechtigte Fahrer)", type: "ratio",
        items: vehicles.map((v) => {
          const berechtigt = ea.filter((r) => (v.type === "lkw" ? r.fuehrerschein.lkw.hasLicense : r.fuehrerschein.pkw.hasLicense));
          const drin = berechtigt.filter((r) => r.fahrzeuge && r.fahrzeuge[v.id] && r.fahrzeuge[v.id].confirmedBy);
          return { label: v.name, value: drin.length, max: berechtigt.length, names: namenSort(berechtigt.filter((r) => !drin.includes(r)).map((r) => r.name)), namesLabel: "noch nicht eingewiesen" };
        }),
        empty: "Noch keine Fahrzeuge angelegt." },
      { id: "bewegung", title: `Bewegungsfahrten ${jahr}`, type: "ratio",
        items: bwGeplant || maengelJahr.length ? [
          { label: "Fahrten erledigt", value: bwErledigt, max: bwGeplant },
          { label: "Mängel behoben", value: maengelJahr.filter((m) => m.behoben).length, max: maengelJahr.length },
        ] : [],
        empty: `Keine Bewegungsfahrten ${jahr}.` },
    ],
  };

  // ---------------- DIENSTBETRIEB ----------------
  const evJahr = events.filter((e) => imJahr(e.date));
  // Übungsbesuch: nur Übungen mit mind. einem Anwesenheits-Häkchen; jeder nur an den Übungen seiner Bereiche gemessen
  const uebungenAlle = evJahr.filter((e) => e.category === "uebung" && e.date <= heute);
  const uebungen = uebungenAlle.filter((e) => Object.values(e.anwesenheit || {}).some(Boolean));
  const besuch = roster.map((r) => {
    const relevant = uebungen.filter((e) => r.bereiche.includes(e.bereich));
    const da = relevant.filter((e) => (e.anwesenheit || {})[r.name]).length;
    return { name: r.name, relevant: relevant.length, da, quote: pct(da, relevant.length) };
  }).filter((x) => x.relevant > 0).sort((a, b) => b.quote - a.quote || b.da - a.da || a.name.localeCompare(b.name, "de"));
  const oBesuch = besuch.length ? Math.round(besuch.reduce((s, x) => s + x.quote, 0) / besuch.length) : null;
  const kapazitaet = evJahr.filter((e) => e.capacityMode && e.date <= heute);
  const voll = kapazitaet.filter((e) => Object.keys(e.signups || {}).length >= (e.capacityNeeded || 1));
  const szJahr = sitzungen.filter((s) => imJahr(s.date) && s.date <= heute);
  const dienst = {
    kpis: [
      { label: `Termine ${jahr}`, value: evJahr.length },
      { label: "Ø Übungsbesuch", value: oBesuch ?? "–", suffix: oBesuch !== null ? " %" : "" },
      { label: "Ausschusssitzungen", value: szJahr.length },
    ],
    sections: [
      { id: "kategorien", title: `Termine ${jahr} nach Kategorie`, type: "bars",
        items: Object.entries(CATEGORIES).map(([k, c]) => ({ label: c.label, value: evJahr.filter((e) => e.category === k).length, color: c.color })) },
      { id: "bereiche", title: `Termine ${jahr} nach Bereich`, type: "bars",
        items: BEREICH_KEYS.map((b) => ({ label: BEREICHE[b].label, value: evJahr.filter((e) => e.bereich === b).length, color: BEREICHE[b].color })).filter((x) => x.value > 0),
        empty: "Keine Termine in diesem Jahr." },
      { id: "besuch-verteilung", title: "Übungsbesuch (Verteilung)", type: "bars",
        items: [
          { label: "über 75 %", names: besuch.filter((x) => x.quote > 75).map((x) => x.name), color: "#1F6F5C" },
          { label: "50 bis 75 %", names: besuch.filter((x) => x.quote >= 50 && x.quote <= 75).map((x) => x.name), color: "#B8791A" },
          { label: "unter 50 %", names: besuch.filter((x) => x.quote < 50).map((x) => x.name), color: "#C1272D" },
        ].map((x) => ({ ...x, value: x.names.length, names: namenSort(x.names) })),
        empty: "Noch keine Anwesenheit bei Übungen eingetragen.",
        note: `Grundlage: ${uebungen.length} von ${uebungenAlle.length} Übungen mit eingetragener Anwesenheit. Jeder wird nur an den Übungen seiner Bereiche gemessen.` },
      { id: "besuch-personen", title: "Übungsbesuch pro Person", type: "ratio", nurMitNamen: true,
        items: besuch.map((x) => ({ label: x.name, value: x.da, max: x.relevant })),
        empty: "Noch keine Anwesenheit bei Übungen eingetragen." },
      { id: "besetzung", title: "Termine mit Personenbedarf (Brandwache, Arbeitseinsatz …)", type: "ratio",
        items: kapazitaet.length ? [{ label: "voll besetzt", value: voll.length, max: kapazitaet.length }] : [],
        empty: "Keine vergangenen Termine mit Personenbedarf." },
      { id: "ausschuss", title: "Anwesenheit Ausschusssitzungen", type: "ratio", nurMitNamen: true,
        items: szJahr.length ? roster.filter((r) => r.ausschuss).map((r) => ({ label: r.name, value: szJahr.filter((s) => (s.anwesenheit || {})[r.name] === "anwesend").length, max: szJahr.length })) : [],
        empty: "Keine Ausschusssitzungen in diesem Jahr." },
    ],
  };

  return { personal, ausbildung, einsatz, dienst };
}

// ---------------- Druckbericht (HTML) ----------------
export function statistikBerichtHtml(stat, jahr, mitNamen, logo) {
  const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const bar = (value, max, color) => `<div style="flex:1;background:#EEEEEC;border-radius:4px;height:12px;overflow:hidden;"><div style="width:${max ? Math.min(100, Math.round((value / max) * 100)) : 0}%;background:${color || "#4A6670"};height:100%;border-radius:0 4px 4px 0;"></div></div>`;
  const namen = (names, label) => (mitNamen && names && names.length ? `<div style="font-size:11px;color:#5C5F58;margin:0 0 5px 0;">${label ? esc(label) + ": " : ""}${esc(names.join(", "))}</div>` : "");
  const zeile = (label, barHtml, wert) => `<div style="display:flex;align-items:center;gap:8px;margin:3px 0;"><div style="width:180px;font-size:12px;">${esc(label)}</div>${barHtml}<div style="width:110px;text-align:right;font-size:12px;font-weight:700;">${wert}</div></div>`;
  const section = (s) => {
    if (s.nurMitNamen && !mitNamen) return "";
    let inner;
    if (!s.items.length) inner = `<div style="font-size:12px;color:#8A8C86;">${esc(s.empty || "Keine Daten.")}</div>`;
    else if (s.type === "bars") {
      const max = Math.max(1, ...s.items.map((i) => i.value || 0));
      inner = s.items.map((i) => zeile(i.label, bar(i.value || 0, max, i.color || s.color), `${esc(i.value ?? "–")}${esc(i.suffix || "")}`) + namen(i.names)).join("");
    } else {
      inner = s.items.map((i) => zeile(i.label, bar(i.value, i.max, "#1F6F5C"), `${i.value} / ${i.max} (${pct(i.value, i.max)} %)`) + namen(i.names, i.namesLabel)).join("");
    }
    return `<div style="margin:14px 0;page-break-inside:avoid;"><div style="font-weight:700;font-size:13.5px;margin-bottom:4px;">${esc(s.title)}</div>${inner}${s.note ? `<div style="font-size:10.5px;color:#8A8C86;margin-top:3px;">${esc(s.note)}</div>` : ""}</div>`;
  };
  const teile = STATISTIK_REITER.map((t) => {
    const d = stat[t.key];
    const kpis = d.kpis.map((k) => `<div style="flex:1;border:1px solid #E2DFD6;border-radius:6px;padding:8px;text-align:center;"><div style="font-size:18px;font-weight:700;">${esc(k.value)}${esc(k.suffix || "")}</div><div style="font-size:10.5px;color:#8A8C86;">${esc(k.label)}</div></div>`).join("");
    return `<h2 style="border-bottom:2px solid #C1272D;padding-bottom:4px;margin-top:26px;font-size:16px;page-break-after:avoid;">${esc(t.label)}</h2>${d.note ? `<div style="font-size:11px;color:#8A8C86;">${esc(d.note)}</div>` : ""}<div style="display:flex;gap:8px;margin:10px 0;">${kpis}</div>${d.sections.map(section).join("")}`;
  }).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Jahresbericht ${jahr}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:24px auto;padding:0 16px 70px;color:#2C2F2A;} .print-btn{position:fixed;bottom:20px;right:20px;background:#C1272D;color:white;border:none;border-radius:8px;padding:12px 18px;font-size:14px;font-weight:700;} @media print{.print-btn,.no-print{display:none !important;}} @media screen{body{padding-top:46px !important;}}</style></head><body>
<button class="no-print" onclick="try{window.close()}catch(e){};setTimeout(function(){location.href='/'},300)" style="position:fixed;top:14px;right:14px;z-index:10;background:#2C2F2A;color:white;border:none;border-radius:20px;padding:9px 14px;font-size:14px;font-weight:700;box-shadow:0 2px 8px rgba(0,0,0,0.25);">✕ Schließen</button>
<div style="display:flex;align-items:center;gap:14px;border-bottom:3px solid #C1272D;padding-bottom:12px;"><img src="${logo}" style="width:48px;height:48px;object-fit:contain;"/><div><div style="font-size:20px;font-weight:700;">FEUERWEHR REGGLISWEILER</div><div style="font-size:12px;color:#8A8C86;">Jahresbericht ${jahr} · Statistik · erstellt am ${new Date().toLocaleDateString("de-DE")}${mitNamen ? " · mit Namen – vertraulich" : ""}</div></div></div>
${teile}
<p style="font-size:10.5px;color:#8A8C86;margin-top:24px;">Gesperrte (ausgetretene) Mitglieder sind nicht mitgezählt, außer bei der Mitgliederentwicklung.</p>
<button class="print-btn" onclick="window.print()">🖨️ Drucken / Als PDF sichern</button></body></html>`;
}
