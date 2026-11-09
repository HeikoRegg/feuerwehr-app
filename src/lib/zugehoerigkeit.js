// Seit 2.39: Atemschutzträger und Führungskräfte ergeben sich aus der Personalakte (nicht mehr von Hand).
//  - Atemschutzträger = Lehrgang „Atemschutzgeräteträger“ in der Akte, nicht a.D. -> G26-Pflicht + Bereich „Atemschutz“
//  - Führungskraft   = Funktion Gruppenführer oder Zugführer (aktiv, nicht a.D.) -> Bereich „Führungskräfte“
//  - Kommandant und stellv. Kommandant gehören immer zu beiden Bereichen; der Admin sieht ohnehin alle Bereiche.
// Dieselbe Regel steht auch in netlify/functions/auth.js (einmalige Übernahme) – bei Änderungen beide anpassen.
export const AUTO_BEREICHE = ["atemschutz", "fuehrungskraefte"];

const klein = (s) => String(s || "").trim().toLowerCase();
export const istAtemschutzLehrgang = (titel) => /^atemschutzger(ä|ae)tetr(ä|ae)ger(in)?$/.test(klein(titel));
export const istFuehrungsFunktion = (name) => /^(gruppenf(ü|ue)hrer|zugf(ü|ue)hrer)(in)?$/.test(klein(name));

export function atemschutzAusLehrgaengen(lehrgaenge) {
  return (lehrgaenge || []).some((l) => l && istAtemschutzLehrgang(l.titel) && l.status !== "ad");
}
export function fuehrungAusFunktionen(funktionen) {
  return (funktionen || []).some((f) => (typeof f === "string" ? istFuehrungsFunktion(f) : f && istFuehrungsFunktion(f.name) && f.status !== "ad"));
}

// Neue Bereichsliste: Atemschutz/Führungskräfte werden gesetzt oder entfernt, alle anderen Bereiche bleiben unverändert.
// atemschutz / fuehrung = true/false, oder undefined = so lassen, wie es ist.
export function bereicheAbleiten(eintrag, { atemschutz, fuehrung } = {}) {
  const alt = eintrag.bereiche || [];
  const kommando = !!(eintrag.kommandant || eintrag.stellvKommandant);
  const wolltAS = atemschutz === undefined ? alt.includes("atemschutz") : atemschutz;
  const wolltFK = fuehrung === undefined ? alt.includes("fuehrungskraefte") : fuehrung;
  const sollAS = wolltAS || kommando, sollFK = wolltFK || kommando;
  const ohne = alt.filter((b) => !AUTO_BEREICHE.includes(b));
  const neu = [...ohne, ...(sollAS ? ["atemschutz"] : []), ...(sollFK ? ["fuehrungskraefte"] : [])];
  // Reihenfolge der vorhandenen Einträge beibehalten, damit nichts „springt“
  const geordnet = [...alt.filter((b) => neu.includes(b)), ...neu.filter((b) => !alt.includes(b))];
  return geordnet;
}
