import React from "react";

export const APP_NAME = "Feuerwehr Regglisweiler";
export const APP_VERSION = "2.5";
export const CHANGELOG = [
  "Neue Kachel Bewegungsfahrten: monatliche Einteilung der Maschinisten, Abfahrtskontrolle als Checkliste, Mängelmeldung an Admin und Gerätewart",
  "Funktionen in der Personalakte mit Status aktiv / a.D. und Datum – Gruppenführer, Maschinist und Gerätewart werden daraus automatisch übernommen",
];

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

// Diese drei Funktionen steuern Rechte in der App und lassen sich nicht löschen oder umbenennen.
export const FESTE_FUNKTIONEN = ["Gruppenführer", "Maschinist", "Gerätewart"];
export const FUNKTION_FLAG = { "Gruppenführer": "gruppenfuehrer", "Maschinist": "maschinist", "Gerätewart": "geraetewart" };

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
