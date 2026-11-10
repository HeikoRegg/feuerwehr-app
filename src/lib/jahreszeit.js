// Jahreszeiten-Deko (seit 2.40): ergibt sich nur aus dem Datum, keine Pflege nötig.
//  - Advent/Weihnachten: 1.–26. Dezember (Mütze am Löwen, Tannenbaum)
//  - Ostern: Palmsonntag bis Ostermontag (Hase mit Ostereiern)
//  - Sommerpause: ganzer August (Sonne und Palme)
//  - Schnee kurz beim Öffnen der App: Dezember bis Februar
// Jeder kann die Deko für sich ausschalten (Glocke → „Deko ausschalten“, gespeichert auf dem Handy).

// Ostersonntag nach der Gaußschen Osterformel (gregorianisch)
export function osterSonntag(jahr) {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31), tag = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(jahr, monat - 1, tag);
}

const tagNummer = (d) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5);

export function saison(jetzt = new Date()) {
  const m = jetzt.getMonth() + 1, t = jetzt.getDate();
  let motiv = null;
  if (m === 12 && t <= 26) motiv = "advent";
  else if (m === 8) motiv = "sommer";
  else {
    const ostern = tagNummer(osterSonntag(jetzt.getFullYear()));
    const heute = tagNummer(jetzt);
    if (heute >= ostern - 7 && heute <= ostern + 1) motiv = "ostern";
  }
  return { motiv, schnee: m === 12 || m === 1 || m === 2 };
}

// Adventskalender-Zeitraum auf dem Handy (der Server prüft die Türchen selbst nach deutscher Zeit)
export const istDezember = (jetzt = new Date()) => jetzt.getMonth() === 11;
