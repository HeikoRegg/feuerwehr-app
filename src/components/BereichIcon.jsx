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
