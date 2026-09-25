import React from "react";

export const APP_NAME = "Feuerwehr Regglisweiler";
export const APP_VERSION = "2.4";
export const CHANGELOG = [
  "Neue Reihenfolge der Bereiche: Einsatzabteilung, Jugendfeuerwehr, Wettkampfgruppe, Altersabteilung, Atemschutz, Führungskräfte",
  "Fotos werden vor dem Hochladen automatisch verkleinert – spart Speicher und geht schneller",
  "Personalakte (Admin): Übersicht der runden Geburtstage im ganzen Jahr, Dienstjahre zählen ab dem 14. Lebensjahr",
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
