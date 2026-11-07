// netlify/functions/umfrage-erinnerung.js
// Zeitgesteuerte Funktion (Netlify startet sie stündlich, siehe netlify.toml): Erinnerung vor Fristende einer
// Terminumfrage und Info an den Ersteller nach Fristende. Die Regeln stehen in umfrage.js (pruefeErinnerungen).
// Seit 2.36 zusätzlich: Erinnerung an Aufgaben (Projekte/To-do, Regeln in projekte.js).
// Seit 2.38 zusätzlich: Nachfrage „Geht es dir gut?“ 3 Tage nach einem Verbandbuch-Eintrag (Regeln in verbandbuch.js).
import { pruefeErinnerungen } from "./umfrage.js";
import { pruefeAufgabenErinnerungen } from "./projekte.js";
import { pruefeNachfragen } from "./verbandbuch.js";

export async function handler() {
  const ergebnis = {};
  try { ergebnis.umfragen = await pruefeErinnerungen(new Date()); } catch (e) { ergebnis.umfragenFehler = String(e && e.message ? e.message : e); }
  try { ergebnis.aufgaben = await pruefeAufgabenErinnerungen(new Date()); } catch (e) { ergebnis.aufgabenFehler = String(e && e.message ? e.message : e); }
  try { ergebnis.verbandbuch = await pruefeNachfragen(new Date()); } catch (e) { ergebnis.verbandbuchFehler = String(e && e.message ? e.message : e); }
  return { statusCode: ergebnis.umfragenFehler && ergebnis.aufgabenFehler ? 500 : 200, body: JSON.stringify(ergebnis) };
}
