// Berechnung aller Statistiken für die Statistik-Kachel und den Jahresbericht.
// App-Ansicht und Druckbericht nutzen dieselben Ergebnisse, damit die Zahlen immer übereinstimmen.
import { BEREICHE, BEREICH_KEYS, CATEGORIES } from "./constants";
import { atemschutzStatus, todayISO } from "./helpers";
import { zuMin, fmtHM, aufViertel } from "./zeit";

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
  { key: "einsaetze", label: "Einsätze" },
];

// roster: nur aktive (nicht gesperrte) Mitglieder
// akten: vom Server gelieferte, auf das Nötigste reduzierte Daten aus den Personalakten (auch Gesperrte, für Austritte)
// einsaetze: Einsatzberichte vom Server (nur Admin, mit Namen); gezählt wird nach Einsatzjahr (Hauptversammlung bis Hauptversammlung)
export function berechneStatistik({ jahr, roster, events, sitzungen, vehicles, bewegung, akten, einsaetze }) {
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
      { id: "raenge", title: "Dienstgrade (aktuell)", type: "bars",
        items: zaehle(roster.filter((r) => aktenByName[r.name] && aktenByName[r.name].rang).map((r) => [aktenByName[r.name].rang, r.name])),
        empty: "Noch keine Dienstgrade in den Personalakten eingetragen." },
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
  // Qualifikationen: alle Lehrgänge der aktiven Mitglieder (egal aus welchem Jahr), jede Person einmal je Lehrgang
  const qualifikationen = zaehle(aktenAktiv.flatMap((a) => [...new Set((a.lehrgaenge || []).map((l) => l.titel).filter(Boolean))].map((t) => [t, a.name])));
  const maschinisten = aktenAktiv.filter((a) => (a.lehrgaenge || []).some((l) => l.titel === "Maschinist") || (a.funktionen || []).includes("Maschinist")).length;
  const ausbildung = {
    kpis: [
      { label: `Lehrgänge ${jahr}`, value: summe(lehrgaenge) },
      { label: `Leistungsabz. ${jahr}`, value: summe(abzeichen) },
      { label: "Maschinisten", value: maschinisten },
    ],
    sections: [
      { id: "funktionen", title: "Aktive Funktionen", type: "bars", items: funktionen, empty: "Noch keine Funktionen in den Personalakten eingetragen." },
      { id: "qualifikationen", title: "Qualifikationen (alle Lehrgänge, aktueller Stand)", type: "bars", items: qualifikationen, empty: "Noch keine Lehrgänge in den Personalakten eingetragen." },
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

  // ---------------- EINSÄTZE (nach Einsatzjahr) ----------------
  const rund = (n) => Math.round(n * 10) / 10;
  const ej = (einsaetze || []).filter((b) => String(b.einsatzjahr) === jahrStr);
  // Einsatzzeiten: je Person und Einsatz auf die nächste Viertelstunde aufgerundet, dann summiert (Anzeige als Std:Min)
  const viertelMin = (b) => (b.mannschaft || []).reduce((s, m) => s + aufViertel(zuMin(m.ein)), 0);
  const stdGesamtMin = ej.reduce((s, b) => s + viertelMin(b), 0);
  const proPerson = {};
  ej.forEach((b) => (b.mannschaft || []).forEach((m) => { const p = (proPerson[m.name] ||= { anzahl: 0, min: 0 }); p.anzahl++; p.min += aufViertel(zuMin(m.ein)); }));
  const monate = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const fzZaehler = {};
  ej.forEach((b) => (b.fahrzeuge || []).forEach((id) => { const n = (b.fahrzeugNamen || {})[id] || "Fahrzeug"; fzZaehler[n] = (fzZaehler[n] || 0) + 1; }));
  const einsaetzeStat = {
    note: einsaetze === null ? "Einsatzberichte konnten nicht geladen werden." : `Einsatzjahr ${jahr} – von Hauptversammlung zu Hauptversammlung, wie in der Kachel Einsatzberichte. Einsatzzeiten: je Person und Einsatz auf die nächste Viertelstunde aufgerundet (die Berichte selbst sind minutengenau).`,
    kpis: [
      { label: `Einsätze ${jahr}`, value: ej.length },
      { label: "Einsatzstunden (Std:Min)", value: fmtHM(stdGesamtMin) },
      { label: "Ø Einsatzkräfte", value: ej.length ? rund(ej.reduce((s, b) => s + (b.kraefte || 0), 0) / ej.length) : "–" },
    ],
    sections: [
      { id: "arten", title: "Einsätze nach Art", type: "bars", color: "#C1272D", items: zaehle(ej.map((b) => [b.einsatz || "ohne Angabe", b.nummer || ""])).map((x) => ({ label: x.label, value: x.value })), empty: `Keine Einsätze im Einsatzjahr ${jahr}.` },
      { id: "monate", title: "Einsätze nach Monat", type: "bars", color: "#C1272D",
        items: ej.length ? monate.map((m, i) => ({ label: m, value: ej.filter((b) => Number(String(b.datum || "").slice(5, 7)) === i + 1).length })).filter((x) => x.value > 0) : [],
        empty: `Keine Einsätze im Einsatzjahr ${jahr}.` },
      { id: "fahrzeuge", title: "Eingesetzte Fahrzeuge", type: "bars", items: Object.entries(fzZaehler).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), empty: "Keine Fahrzeuge eingetragen." },
      { id: "personen", title: "Einsätze und Einsatzstunden pro Person", type: "bars", nurMitNamen: true,
        items: Object.entries(proPerson).map(([name, p]) => ({ label: name, value: p.anzahl, suffix: ` · ${fmtHM(p.min)} Std.` })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "de")),
        empty: "Keine Einsatzkräfte eingetragen." },
    ],
  };

  return { personal, ausbildung, einsatz, dienst, einsaetze: einsaetzeStat };
}

// ---------------- Jahresbericht als Berichtsmodell (siehe lib/bericht.js) ----------------
export function statistikBericht(stat, jahr, mitNamen) {
  const blocks = [];
  STATISTIK_REITER.forEach((t) => {
    const d = stat[t.key];
    blocks.push({ t: "h2", text: t.label });
    if (d.note) blocks.push({ t: "text", text: d.note, klein: true, grau: true });
    blocks.push({ t: "kpis", items: d.kpis.map((k) => ({ value: `${k.value}${k.suffix || ""}`, label: k.label })) });
    d.sections.forEach((s) => {
      if (s.nurMitNamen && !mitNamen) return;
      blocks.push({ t: "h3", text: s.title });
      if (!s.items.length) blocks.push({ t: "text", text: s.empty || "Keine Daten.", grau: true });
      else if (s.type === "bars") {
        const max = Math.max(1, ...s.items.map((i) => i.value || 0));
        blocks.push({ t: "balken", zeilen: s.items.map((i) => ({ label: i.label, value: i.value || 0, max, color: i.color || s.color, rechts: `${i.value ?? "–"}${i.suffix || ""}`, unter: mitNamen && i.names && i.names.length ? i.names.join(", ") : "" })) });
      } else {
        blocks.push({ t: "balken", zeilen: s.items.map((i) => ({ label: i.label, value: i.value, max: i.max, color: "#1F6F5C", rechts: `${i.value} / ${i.max} (${pct(i.value, i.max)} %)`, unter: mitNamen && i.names && i.names.length ? `${i.namesLabel ? i.namesLabel + ": " : ""}${i.names.join(", ")}` : "" })) });
      }
      if (s.note) blocks.push({ t: "text", text: s.note, klein: true, grau: true });
    });
  });
  blocks.push({ t: "text", text: "Gesperrte (ausgetretene) Mitglieder sind nicht mitgezählt, außer bei der Mitgliederentwicklung.", klein: true, grau: true });
  return {
    titel: `Jahresbericht ${jahr}`,
    untertitel: `Jahresbericht ${jahr} · Statistik · erstellt am ${new Date().toLocaleDateString("de-DE")}${mitNamen ? " · mit Namen – vertraulich" : ""}`,
    dateiname: `Jahresbericht_${jahr}${mitNamen ? "_mit_Namen" : ""}`,
    blocks,
  };
}
