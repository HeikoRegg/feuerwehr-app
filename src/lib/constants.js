import React from "react";

export const APP_NAME = "Feuerwehr Regglisweiler";
// Offizielle Bezeichnung – steht auf allen Ausdrucken und PDFs.
export const DRUCK_NAME = "Feuerwehr Dietenheim Abt. Regglisweiler";
export const APP_VERSION = "2.31";
export const CHANGELOG = [
  "Hydranten-Karte: beim Hineinzoomen erscheinen Hydrantenschilder mit Leitungsdurchmesser und Zustand",
  "Kalender: Datum leicht farbig hinterlegt; nach dem Anmeldeschluss steht „Anmeldung geschlossen“ mit deiner Antwort",
  "Oben der Löwe – bei der Jugendfeuerwehr „Jugendfeuerwehr Regglisweiler“",
  "Jugendwart und Admins: Terminliste der Jugendfeuerwehr als PDF (über die Glocke)",
  "Neues Symbol für die Kachel Atemschutz",
];

// Kachelfarben (seit 2.29): feste Palette heller Töne, damit Schrift und Zahlen lesbar bleiben.
export const KACHEL_FARBEN = {
  rot: { label: "Rot", von: "#FDE3E1", bis: "#F6B9B4", rand: "#E08A83", kante: "#C1574F", schatten: "rgba(140,30,20,0.18)" },
  orange: { label: "Orange", von: "#FFE9D2", bis: "#FBC890", rand: "#EBA65C", kante: "#C77A2A", schatten: "rgba(140,70,10,0.18)" },
  goldgelb: { label: "Goldgelb", von: "#FFEDA8", bis: "#FFD452", rand: "#E5B416", kante: "#C28F00", schatten: "rgba(120,90,0,0.22)" },
  gelb: { label: "Gelb", von: "#FFF3C9", bis: "#FFDF7E", rand: "#E8C04A", kante: "#C29A12", schatten: "rgba(120,90,0,0.18)" },
  gruen: { label: "Grün", von: "#E3F2E6", bis: "#B9DEC1", rand: "#86C091", kante: "#4F9460", schatten: "rgba(20,90,40,0.18)" },
  blau: { label: "Blau", von: "#E4EEF8", bis: "#BBD3EC", rand: "#8DB2D8", kante: "#5E89B5", schatten: "rgba(20,60,110,0.18)" },
  lila: { label: "Lila", von: "#EFE6F7", bis: "#D4C0EA", rand: "#AE93D3", kante: "#7E5FAE", schatten: "rgba(70,30,110,0.18)" },
  grau: { label: "Grau", von: "#F1F0EC", bis: "#D8D6CF", rand: "#B9B6AC", kante: "#8E8B82", schatten: "rgba(0,0,0,0.15)" },
};
// Standard: Einsatz & Technik rot, Organisation blau, Personal grün, Kommunikation gelb, Verwaltung grau
export const KACHEL_STANDARD_FARBEN = {
  einsatz: "rot", geraete: "rot", hydranten: "rot", atemschutz: "rot", fuehrerschein: "rot", bewegung: "rot",
  ausschuss: "blau", beschluesse: "blau", umfragen: "blau", statistik: "blau",
  personalakte: "gruen", jugend: "gruen",
  chat: "gelb",
  einstellungen: "grau",
};

export const CATEGORIES = {
  uebung: { label: "Übung", color: "#C1272D", bg: "#FBEAEA" },
  brandwache: { label: "Brandwache", color: "#7A3B9E", bg: "#F1E9F6" },
  einsatz: { label: "Arbeitseinsatz", color: "#1F6F5C", bg: "#E7F2EF" },
  sonstiges: { label: "Kameradschaft", color: "#5C5F58", bg: "#EEEEEC" },
};
export const CAPACITY_DEFAULT_CATEGORIES = ["brandwache", "einsatz"];

export const PRIORITIES = {
  info: { label: "Info", color: "#4A6670", bg: "#EAF0F1", rank: 2 },
  wichtig: { label: "Wichtig", color: "#B8791A", bg: "#FBF1E1", rank: 1 },
  dringend: { label: "Dringend", color: "#C1272D", bg: "#FBEAEA", rank: 0 },
};

export const BEREICHE = {
  einsatzabteilung: { label: "Einsatzabteilung", short: "EA", color: "#C1272D" },
  jugendfeuerwehr: { label: "Jugendfeuerwehr", short: "JF", color: "#B8791A" },
  wettkampfgruppe: { label: "Wettkampfgruppe", short: "WK", color: "#1F6F5C" },
  altersabteilung: { label: "Altersabteilung", short: "AA", color: "#5C5F58" },
  atemschutz: { label: "Atemschutz", short: "AS", color: "#2C6E8F" },
  fuehrungskraefte: { label: "Führungskräfte", short: "FK", color: "#8A3B5C" },
};
export const BEREICH_KEYS = Object.keys(BEREICHE);

// Führerscheinklassen: Aus den eingetragenen Klassen ergibt sich automatisch, ob jemand
// bei der Führerscheinkontrolle und den Fahrzeugeinweisungen für PKW bzw. LKW auftaucht.
export const FUEHRERSCHEIN_KLASSEN = ["B", "BE", "C1", "C1E", "C", "CE", "FF 4,75 t", "FF 7,5 t"];
export const PKW_KLASSEN = ["B", "BE"];
export const LKW_KLASSEN = ["C1", "C1E", "C", "CE", "FF 4,75 t", "FF 7,5 t"];
export const JUBILAEUMS_JAHRE = [10, 15, 20, 25, 30, 40, 50, 60];

export const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
export const WEEKDAYS_SHORT = ["So","Mo","Di","Mi","Do","Fr","Sa"];

export const GRUPPENFUEHRER_CATEGORIES = ["uebung", "brandwache"];
export const ATEMSCHUTZ_UEBUNG_TYPES = { container: "Brandübungscontainer", warm: "Warmer Einsatz", einsatznah: "Einsatznahe Übung" };

// Runde Geburtstage, die in der Jahresübersicht erscheinen (zusätzlich zu allen Zehnern ab 20).
export const RUNDE_GEBURTSTAGE_EXTRA = [18];

// Diese Funktionen steuern Rechte in der App und lassen sich nicht löschen oder umbenennen.
// Kommandant und stellv. Kommandant bilden zusammen die Kommandantschaft (eigener Chat).
export const FESTE_FUNKTIONEN = ["Kommandant", "stellv. Kommandant", "Gruppenführer", "Gerätewart", "Jugendwart"];
export const FUNKTION_FLAG = { "Kommandant": "kommandant", "stellv. Kommandant": "stellvKommandant", "Gruppenführer": "gruppenfuehrer", "Gerätewart": "geraetewart", "Jugendwart": "jugendwart" };
// Maschinist ist ein Lehrgang: wer ihn in der Personalakte stehen hat, gilt als Maschinist (Bewegungsfahrten).
export const MASCHINIST_LEHRGANG = "Maschinist";
export const FESTE_LEHRGAENGE = [MASCHINIST_LEHRGANG];
// Weibliche Formen der festen Einträge (weitere pflegt der Admin in den Einstellungen).
export const WEIBLICH_STANDARD = { "Kommandant": "Kommandantin", "stellv. Kommandant": "stellv. Kommandantin", "Gruppenführer": "Gruppenführerin", "Gerätewart": "Gerätewartin", "Jugendwart": "Jugendwartin", "Maschinist": "Maschinistin" };
// Vorlagen für den Mitgliedsverlauf in der Personalakte (Freitext bleibt möglich).
export const VERLAUF_VORLAGEN = ["Eintritt Jugendfeuerwehr", "Übertritt Einsatzabteilung", "Eintritt Einsatzabteilung", "Übertritt Altersabteilung", "Austritt", "Wiedereintritt"];

// Einsatzberichte
export const EINSATZ_STICHWORTE = ["Brand", "Kleinbrand", "Technische Hilfeleistung", "Verkehrsunfall", "Ölspur", "Unwetter", "Wasserschaden", "Tierrettung", "Türöffnung", "Brandsicherheitswache", "Fehlalarm / Brandmeldeanlage", "Sonstiges"];
// Geräte & Material – in den Einstellungen änderbar. Die Einheit steht in Klammern.
export const EINSATZ_GERAETE_STANDARD = [
  "Betriebsdauer Notstromaggregat (Std.)", "Betriebsdauer TS 8 (Std.)", "Betriebsdauer Motorsäge (Std.)", "Betriebsdauer Tauchpumpe (Std.)",
  "Betriebsdauer Hochdrucklüfter (Std.)", "Betriebsdauer Wassersauger (Std.)",
  "B-Schläuche (Stück)", "C-Schläuche (Stück)", "D-Schläuche (Stück)", "Saugschläuche (Stück)",
  "Ölbindemittel 25-kg-Sack (Stück)", "Ölsperre Gewässer (Stück)", "Ölbindemittel Gewässer, Würfel (Stück)",
];
export const EINSATZ_NUMMER_PRAEFIX = "RW";

// Bewegungsfahrten – Standardwerte (in den Einstellungen änderbar)
export const BEWEGUNG_DEFAULT = {
  personen: 2,
  monate: [1, 2, 3, 4, 5, 6, 7, 9, 10, 11], // August und Dezember anfangs aus
  checklisteVor: [
    "Ladeerhaltung und Abgasabsaugung abgenommen",
    "Motoröl und Kühlwasser geprüft",
    "Reifen: Zustand und Luftdruck (Sichtprüfung)",
    "Druckluft: Vorratsdruck aufgebaut",
    "Beleuchtung, Blinker, Bremslicht",
    "Blaulicht und Martinshorn kurz geprüft",
    "Scheibenwischer und Waschwasser",
    "Fahrzeugfunk geprüft",
    "Geräteräume geschlossen, Beladung gesichert",
  ],
  checklisteNach: [
    "Bremsen während der Fahrt ohne Auffälligkeiten",
    "Getankt (mindestens ¾ voll)",
    "Ladeerhaltung und Abgasabsaugung wieder angeschlossen",
    "Fahrzeug einsatzbereit abgestellt",
  ],
};
