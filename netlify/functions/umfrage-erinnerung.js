// netlify/functions/umfrage-erinnerung.js
// Zeitgesteuerte Funktion (Netlify startet sie stündlich, siehe netlify.toml): Erinnerung vor Fristende einer
// Terminumfrage und Info an den Ersteller nach Fristende. Die Regeln stehen in umfrage.js (pruefeErinnerungen).
import { pruefeErinnerungen } from "./umfrage.js";

export async function handler() {
  try {
    const r = await pruefeErinnerungen(new Date());
    return { statusCode: 200, body: JSON.stringify(r) };
  } catch (e) {
    return { statusCode: 500, body: String(e && e.message ? e.message : e) };
  }
}
