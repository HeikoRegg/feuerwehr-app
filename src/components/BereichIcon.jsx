import React from "react";
import { JF_ICON, LION_ICON } from "../lib/icons";
import { BEREICHE } from "../lib/constants";

export function BereichIcon({ bereich, size = 18 }) {
  if (bereich === "einsatzabteilung") return <img src={LION_ICON} alt="Einsatzabteilung" style={{ width: size, height: size, objectFit: "contain" }} />;
  if (bereich === "jugendfeuerwehr") return <img src={JF_ICON} alt="Jugendfeuerwehr" style={{ width: size, height: size, objectFit: "contain" }} />;
  if (bereich === "wettkampfgruppe") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={BEREICHE.wettkampfgruppe.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="6" cy="6" r="3.2" /><circle cx="18" cy="18" r="3.2" /><path d="M8.3 8.3l7.4 7.4" /><path d="M14 10l3-3M10 14l-3 3" />
      </svg>
    );
  }
  if (bereich === "altersabteilung") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={BEREICHE.altersabteilung.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12a7 7 0 0 1 14 0v3H5v-3z" /><path d="M4 17h16" /><path d="M12 5v0" /><circle cx="12" cy="4" r="1.2" fill={BEREICHE.altersabteilung.color} stroke="none" />
      </svg>
    );
  }
  if (bereich === "atemschutz") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={BEREICHE.atemschutz.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 10a5 5 0 0 1 10 0v4a5 5 0 0 1-10 0v-4z" />
        <circle cx="9.5" cy="12" r="1.1" fill={BEREICHE.atemschutz.color} stroke="none" />
        <circle cx="14.5" cy="12" r="1.1" fill={BEREICHE.atemschutz.color} stroke="none" />
        <path d="M12 16v2M9 20h6" />
      </svg>
    );
  }
  if (bereich === "fuehrungskraefte") {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={BEREICHE.fuehrungskraefte.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 9l7-4 7 4" /><path d="M5 14l7-4 7 4" /><path d="M5 19l7-4 7 4" />
      </svg>
    );
  }
  return null;
}

// Kachel-Symbol der Jugendfeuerwehr: „JF“ mit kleiner Flamme, schwarz.
export function JFFlammeIcon({ size = 28, color = "#2C2F2A" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="Jugendfeuerwehr">
      <g fill="none" stroke={color}>
        <path fill={color} stroke="none" fillRule="evenodd" d="M24 2.5C27.2 7.3 32.3 10.3 32.3 15.8C32.3 20.4 28.7 23.4 24 23.4C19.3 23.4 15.7 20.4 15.7 15.8C15.7 12.8 17.2 10.8 18.9 9.1C19.3 11.8 20.7 13 22 13.2C21 9.6 21.6 6 24 2.5ZM24 13.6C25.6 15.6 27 16.6 27 18.4C27 20 25.7 21.2 24 21.2C22.3 21.2 21 20 21 18.4C21 16.9 22.5 15.9 24 13.6Z" />
        <path strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" d="M17.8 28V37.2Q17.8 42.6 12.6 42.6Q8.6 42.6 7.4 39.2" />
        <path strokeWidth="4.6" strokeLinecap="round" strokeLinejoin="round" d="M27.5 42.6V28.2H40M27.5 35.4H37.2" />
      </g>
    </svg>
  );
}

// Hydrant (Überflur-Form, gut erkennbar) für die Kachel „Hydranten“.
export function HydrantIcon({ size = 26, color = "#2C2F2A" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 2.6v1.6" />
      <path d="M7.6 8.2a4.4 4.4 0 0 1 8.8 0" />
      <path d="M6.4 8.2h11.2" />
      <path d="M8 8.2v11.6M16 8.2v11.6" />
      <path d="M5.6 20.4h12.8" />
      <path d="M8 11.6H5.2v3.4H8M16 11.6h2.8v3.4H16" />
      <circle cx="12" cy="14.2" r="1.7" />
    </svg>
  );
}
