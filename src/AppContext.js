import { createContext, useContext } from "react";

// Gemeinsamer Zustand der App (Mitglieder, Termine, Rechte, Funktionen …),
// den die einzelnen Kacheln lesen, ohne alles einzeln weiterreichen zu müssen.
export const AppContext = createContext(null);
export function useApp() { return useContext(AppContext); }
