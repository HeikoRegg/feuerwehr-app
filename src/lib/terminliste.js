// Terminliste der Einsatzabteilung zum Ausdrucken bzw. Verschicken (z. B. WhatsApp) – nur Datum, Uhrzeit, Titel.
// Wird als Bericht-Modell beschrieben (lib/bericht.js): PC = Druckfenster, Handy = Vorschau + PDF teilen.
import { MONTHS, WEEKDAYS_SHORT } from "./constants";

export const TERMINLISTE_FUSS = "Änderungen sind jederzeit möglich. Die aktuellen Termine stehen immer in der Feuerwehr-App.";

const zweistellig = (n) => String(n).padStart(2, "0");
const datumKurz = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${WEEKDAYS_SHORT[d.getDay()]} ${zweistellig(d.getDate())}.${zweistellig(d.getMonth() + 1)}.${d.getFullYear()}`;
};

// Termine des Bereichs Einsatzabteilung im gewählten Jahr, nach Datum und Uhrzeit sortiert.
export function termineDesJahres(events, jahr) {
  return (events || [])
    .filter((ev) => ev && ev.bereich === "einsatzabteilung" && /^\d{4}-\d{2}-\d{2}$/.test(ev.date || "") && ev.date.startsWith(`${jahr}-`))
    .slice()
    .sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
}

export function terminlisteModell(events, jahr, heute = new Date()) {
  const liste = termineDesJahres(events, jahr);
  const stand = `${zweistellig(heute.getDate())}.${zweistellig(heute.getMonth() + 1)}.${heute.getFullYear()}`;
  const blocks = [
    { t: "h1", text: `Termine Einsatzabteilung ${jahr}` },
    { t: "text", text: `Stand ${stand}`, grau: true, klein: true },
  ];
  if (!liste.length) blocks.push({ t: "text", text: `Für ${jahr} sind noch keine Termine eingetragen.` });
  const nachMonat = {};
  liste.forEach((ev) => { const m = parseInt(ev.date.slice(5, 7), 10) - 1; (nachMonat[m] = nachMonat[m] || []).push(ev); });
  Object.keys(nachMonat).map(Number).sort((a, b) => a - b).forEach((m) => {
    blocks.push({ t: "h3", text: `${MONTHS[m]} ${jahr}` });
    blocks.push({
      t: "tabelle", kopf: ["Datum", "Uhrzeit", "Titel"], breiten: [2, 1.2, 6],
      zeilen: nachMonat[m].map((ev) => [datumKurz(ev.date), ev.time ? `${ev.time} Uhr` : "", ev.title || ""]),
    });
  });
  return { titel: `Termine Einsatzabteilung ${jahr}`, untertitel: "Terminliste Einsatzabteilung", dateiname: `Termine_Einsatzabteilung_${jahr}`, fuss: TERMINLISTE_FUSS, blocks };
}
