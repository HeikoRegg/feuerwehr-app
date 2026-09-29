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
