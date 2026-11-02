// netlify/functions/umfrage-erinnerung.js
// Zeitgesteuerte Funktion (Netlify startet sie stündlich, siehe netlify.toml): Erinnerung vor Fristende einer
// Terminumfrage und Info an den Ersteller nach Fristende. Die Regeln stehen in umfrage.js (pruefeErinnerungen).
// Seit 2.36 zusätzlich: Erinnerung am Vortag fälliger Aufgaben (Projekte/To-do, Regeln in projekte.js).
import { pruefeErinnerungen } from "./umfrage.js";
import { pruefeAufgabenErinnerungen } from "./projekte.js";

export async function handler() {
  const ergebnis = {};
  try { ergebnis.umfragen = await pruefeErinnerungen(new Date()); } catch (e) { ergebnis.umfragenFehler = String(e && e.message ? e.message : e); }
  try { ergebnis.aufgaben = await pruefeAufgabenErinnerungen(new Date()); } catch (e) { ergebnis.aufgabenFehler = String(e && e.message ? e.message : e); }
  return { statusCode: ergebnis.umfragenFehler && ergebnis.aufgabenFehler ? 500 : 200, body: JSON.stringify(ergebnis) };
}
