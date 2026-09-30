// Vorschlagsliste: typische Geräte eines LF 8/6. Nur ein Vorschlag – jedes Fahrzeug ist etwas anders beladen.
// Kurzkürzel für die Prüfarten: s = Sichtprüfung, f = Funktion, t = Tank, a = Akku, v = Vollzähligkeit, e = Elektro (DGUV V3), x = externe Prüfung.
const K = { s: "sicht", f: "funktion", t: "tank", a: "akku", v: "vollzaehlig", e: "elektro", x: "extern" };

function v(name, kurz, arten) { return { name, kurzname: kurz, arten: arten.split("").map((c) => K[c]) }; }

export const VORLAGEN_GRUPPEN = [
  { gruppe: "Schläuche & Armaturen", eintraege: [
    v("Hohlstrahlrohr C", "HSR C", "s"),
    v("Hohlstrahlrohr B", "HSR B", "s"),
    v("Schaumrohr", "Schaumrohr", "s"),
    v("B-Druckschlauch 20 m", "B-Schlauch", "s"),
    v("C-Druckschlauch 15 m", "C-Schlauch", "s"),
    v("A-Saugschlauch 1,6 m", "A-Saugschlauch", "s"),
    v("Saugkorb", "Saugkorb", "s"),
    v("Ventilleine", "Ventilleine", "s"),
    v("Verteiler B-CBC", "Verteiler", "s"),
    v("Sammelstück", "Sammelstück", "s"),
    v("Übergangsstück B/C", "Übergang B/C", "s"),
    v("Standrohr", "Standrohr", "s"),
    v("Hydrantenschlüssel", "Hydr.-Schlüssel", "s"),
    v("Unterflurhydranten-Schlüssel", "UF-Schlüssel", "s"),
    v("Kupplungsschlüssel", "Kupplungsschl.", "s"),
    v("Schlauchhalter", "Schlauchhalter", "s"),
    v("Schlauchbrücke", "Schlauchbrücke", "s"),
    v("Schlauchtragekorb", "Schlauchkorb", "s"),
    v("Druckbegrenzungsventil", "Druckbegr.", "sf"),
  ] },
  { gruppe: "Pumpen & Aggregate", eintraege: [
    v("Tragkraftspritze", "TS", "sftv"),
    v("Stromerzeuger", "Stromerzeuger", "sfte"),
    v("Tauchpumpe", "Tauchpumpe", "sfe"),
    v("Lüfter (Überdruck)", "Lüfter", "sfte"),
    v("Motorkettensäge", "Kettensäge", "sft"),
    v("Trennschleifer", "Trennschleifer", "sft"),
    v("Kraftstoffkanister", "Kanister", "st"),
  ] },
  { gruppe: "Rettung & Technische Hilfe", eintraege: [
    v("Steckleiter", "Steckleiter", "sx"),
    v("Schiebleiter", "Schiebleiter", "sx"),
    v("Hakenleiter", "Hakenleiter", "sx"),
    v("Hydraulisches Rettungsgerät (Schere)", "Schere", "sfax"),
    v("Hydraulisches Rettungsgerät (Spreizer)", "Spreizer", "sfax"),
    v("Feuerwehraxt", "Axt", "s"),
    v("Brechstange", "Brechstange", "s"),
    v("Bolzenschneider", "Bolzenschneider", "s"),
    v("Rettungsbrett", "Rettungsbrett", "s"),
    v("Rettungsmesser / Gurtmesser", "Gurtmesser", "s"),
    v("Feuerwehrleine", "FW-Leine", "sx"),
    v("Auffanggurt / Rettungsgurt", "Gurt", "sx"),
    v("Unterbaumaterial (Holzkeile)", "Unterbau", "sv"),
    v("Hebekissen", "Hebekissen", "sfx"),
    v("Glasmanagement (Glassäge, Kissen)", "Glasmanagement", "sv"),
  ] },
  { gruppe: "Beleuchtung & Elektro", eintraege: [
    v("Handscheinwerfer (Akku)", "Handlampe", "sa"),
    v("Flutlichtstrahler", "Flutlicht", "sfe"),
    v("Stativ für Flutlicht", "Stativ", "s"),
    v("Kabeltrommel", "Kabeltrommel", "se"),
    v("Verteilerkasten", "Verteiler Strom", "se"),
    v("Kabel-Verlängerung", "Verlängerung", "se"),
  ] },
  { gruppe: "Atemschutz & Persönliches", eintraege: [
    v("Atemschutzgerät", "PA", "sfx"),
    v("Atemanschluss / Maske", "Maske", "sx"),
    v("Wärmebildkamera", "WBK", "sfa"),
    v("Warnweste", "Warnweste", "s"),
    v("Chemikalienschutzanzug", "CSA", "sx"),
  ] },
  { gruppe: "Sonstiges", eintraege: [
    v("Handfeuerlöscher", "Feuerlöscher", "sx"),
    v("Erste-Hilfe-Koffer", "Erste Hilfe", "sv"),
    v("Verbandkasten", "Verbandkasten", "sv"),
    v("Warndreieck", "Warndreieck", "s"),
    v("Warnleuchte / Blitzleuchte", "Warnleuchte", "sa"),
    v("Leitkegel", "Leitkegel", "sv"),
    v("Absperrband", "Absperrband", "s"),
    v("Ölbindemittel", "Ölbinder", "sv"),
    v("Wathose", "Wathose", "s"),
  ] },
];

export const ALLE_VORLAGEN = VORLAGEN_GRUPPEN.flatMap((g) => g.eintraege.map((e) => ({ ...e, gruppe: g.gruppe })));

// Vorschlag (mitgeliefert oder eigene Vorlage) -> Prüfarten mit den Standard-Fristen.
export function vorlagePruefarten(vor, PRUEFART) {
  if (Array.isArray(vor.pruefarten)) return vor.pruefarten; // eigene Vorlage: enthält die Fristen schon
  return (vor.arten || []).map((art) => ({ art, intervall: PRUEFART[art].standard, einheit: PRUEFART[art].einheit }));
}

export const EIGENE_GRUPPE = "Eigene Vorlagen";

// Mitgelieferte Vorschläge + gespeicherte Vorlagen (kv „geraete_vorlagen“) zu einer Gruppenliste zusammenführen.
// Gespeicherte Einträge mit „basis“ passen einen mitgelieferten Vorschlag an (Name, Kurzname, Fristen, ausgeblendet),
// Einträge ohne „basis“ sind eigene Vorlagen (Gruppe frei wählbar, Standard „Eigene Vorlagen“).
// Jeder Eintrag bekommt einen eindeutigen „schluessel“.
export function vorlagenGruppen(gespeichert, { mitAusgeblendeten = false } = {}) {
  const liste = Array.isArray(gespeichert) ? gespeichert.filter((x) => x && x.id) : [];
  const anpassung = new Map(liste.filter((x) => x.basis).map((x) => [x.basis, x]));
  const gruppen = VORLAGEN_GRUPPEN.map((g) => ({
    gruppe: g.gruppe,
    eintraege: g.eintraege.map((e) => {
      const a = anpassung.get(e.name);
      return a
        ? { ...e, name: a.name || e.name, kurzname: a.kurzname ?? e.kurzname, pruefarten: a.pruefarten, ausgeblendet: !!a.ausgeblendet, id: a.id, basis: e.name, angepasst: true, original: e, schluessel: `std:${e.name}` }
        : { ...e, basis: e.name, schluessel: `std:${e.name}` };
    }).filter((e) => mitAusgeblendeten || !e.ausgeblendet),
  }));
  const eigeneGruppen = [];
  liste.filter((x) => !x.basis).forEach((x) => {
    const e = { ...x, eigene: true, schluessel: x.id };
    const name = x.gruppe || EIGENE_GRUPPE;
    let g = gruppen.find((y) => y.gruppe === name) || eigeneGruppen.find((y) => y.gruppe === name);
    if (!g) { g = { gruppe: name, eintraege: [] }; eigeneGruppen.push(g); }
    g.eintraege.push(e);
  });
  eigeneGruppen.sort((a, b) => (a.gruppe === EIGENE_GRUPPE ? -1 : b.gruppe === EIGENE_GRUPPE ? 1 : a.gruppe.localeCompare(b.gruppe, "de")));
  return [...eigeneGruppen, ...gruppen].filter((g) => g.eintraege.length);
}
