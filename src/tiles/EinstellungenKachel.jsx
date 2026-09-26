import React from "react";
import { ArrowLeft, Check, ChevronDown, Plus, X } from "lucide-react";
import { APP_VERSION, FESTE_FUNKTIONEN, MONTHS } from "../lib/constants";
import { matchesSearch } from "../lib/helpers";
import { styles } from "../lib/styles";
import { RosterAdminRow, SearchBox, SimpleListEditor } from "../components/Shared";
import { fmtDate } from "../lib/helpers";
import { useApp } from "../AppContext";

// Kachel Einstellungen (nur Admin): Mitglieder, Rechte, Auswahllisten, Zugangscode, Admins
export default function EinstellungenKachel() {
  const { alleMitglieder, setConfirmBlock, config, roster, newCode, setNewCode, rosterSearch, setRosterSearch, newMemberName, setNewMemberName, setConfirmDeleteName, showAdvanced, setShowAdvanced, kachelReturnTo, isMainAdmin, closeKachelView, persistConfig, resetPin, toggleAdmin, togglePermission, toggleBereichAssignment, toggleAtemschutz, adminAddMember, toggleGruppenfuehrer, toggleAusschuss, toggleAusschussRecht } = useApp();
  return (
        <div style={styles.fullscreenPage}>
          <div style={styles.fullscreenHeader}>
            <button style={styles.fullscreenBackBtn} onClick={closeKachelView}><ArrowLeft size={18} /> {kachelReturnTo === "tiles" ? "Funktionen" : "Kalender"}</button>
          </div>
          <div style={styles.modalTitle}>Einstellungen</div>
          <div style={{ fontSize: 10.5, color: "#A5A79F", margin: "4px 0 14px" }}>Version {APP_VERSION}</div>
          <div style={styles.formBody}>
              <label style={styles.label}>Mitgliederliste, Bereiche & Rechte</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                <input style={{ ...styles.input, flex: 1 }} placeholder="Neues Mitglied: Name eingeben" value={newMemberName} onChange={(e) => setNewMemberName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newMemberName.trim()) { adminAddMember(newMemberName); setNewMemberName(""); } }} />
                <button style={{ ...styles.saveBtn, flex: "none", padding: "0 14px" }} onClick={() => { if (newMemberName.trim()) { adminAddMember(newMemberName); setNewMemberName(""); } }}><Plus size={16} /></button>
              </div>
              <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 10 }}>Die Person vergibt sich beim ersten eigenen Login selbst eine PIN.</div>
              <SearchBox value={rosterSearch} onChange={setRosterSearch} placeholder="Name suchen …" />
              <div style={styles.rosterManageList}>
                {roster.filter((r) => matchesSearch(r.name, rosterSearch)).map((r) => (
                  <RosterAdminRow key={r.name} r={r} isAdminName={config.adminNames.includes(r.name)}
                    onResetPin={() => resetPin(r.name)}
                    onRequestRemove={() => setConfirmDeleteName(r.name)}
                    onRequestBlock={() => setConfirmBlock({ name: r.name, gesperrt: true })}
                    onToggleBereich={(b) => toggleBereichAssignment(r.name, b)}
                    onTogglePerm={(b, f) => togglePermission(r.name, b, f)}
                    onToggleAtemschutz={() => toggleAtemschutz(r.name)}
                    onToggleAusschuss={() => toggleAusschuss(r.name)}
                    onToggleAusschussRecht={(f) => toggleAusschussRecht(r.name, f)}
                  />
                ))}
                {roster.length === 0 && <div style={{ fontSize: 12.5, color: "#8A8C86" }}>Noch niemand eingetragen.</div>}
                {alleMitglieder.some((r) => r.gesperrt) && (
                  <div style={{ marginTop: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", marginBottom: 6, letterSpacing: "0.04em" }}>GESPERRTE MITGLIEDER</div>
                    {alleMitglieder.filter((r) => r.gesperrt).map((r) => (
                      <div key={r.name} style={{ ...styles.rosterManageItemFull, display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, opacity: 0.8 }}>
                        <span style={{ fontSize: 13 }}>{r.name}{r.gesperrtSeit && <span style={{ fontSize: 11, color: "#8A8C86" }}> · gesperrt seit {fmtDate(r.gesperrtSeit)}</span>}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button style={styles.tinyBtn} onClick={() => setConfirmBlock({ name: r.name, gesperrt: false })}>Entsperren</button>
                          <button style={styles.rosterRemoveBtn} title="Entfernen" onClick={() => setConfirmDeleteName(r.name)}><X size={13} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <label style={{ ...styles.label, marginTop: 22 }}>Ränge (Auswahlliste für die Personalakte)</label>
              <SimpleListEditor items={config.raenge || []} onChange={(v) => persistConfig({ ...config, raenge: v })} placeholder="z. B. Oberfeuerwehrmann" />
              <label style={{ ...styles.label, marginTop: 16 }}>Funktionen / Qualifikationen (Auswahlliste)</label>
              <SimpleListEditor items={config.funktionen || []} onChange={(v) => persistConfig({ ...config, funktionen: v })} placeholder="z. B. Sprechfunker" locked={FESTE_FUNKTIONEN} />
              <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 2 }}>Gruppenführer, Maschinist und Gerätewart sind fest und steuern Rechte in der App (Gruppenführer-Auswahl, Bewegungsfahrten, Mängelmeldungen).</div>
              <label style={{ ...styles.label, marginTop: 22 }}>Bewegungsfahrten</label>
              <div style={styles.capacityBox}>
                <div style={{ fontSize: 12, color: "#5C5F58", marginBottom: 6 }}>Personen pro Fahrt</div>
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  {[1, 2].map((n) => (
                    <button key={n} onClick={() => persistConfig({ ...config, bewegung: { ...config.bewegung, personen: n } })} style={{ ...styles.categoryChip, background: config.bewegung.personen === n ? "#2C2F2A" : "#F3F1EC", color: config.bewegung.personen === n ? "white" : "#5C5F58", borderColor: config.bewegung.personen === n ? "#2C2F2A" : "#E2DFD6" }}>{n === 1 ? "1 Person" : "2 Personen"}</button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "#5C5F58", marginBottom: 6 }}>In welchen Monaten wird gefahren?</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
                  {MONTHS.map((name, i) => {
                    const m = i + 1; const an = (config.bewegung.monate || []).includes(m);
                    return <button key={m} onClick={() => persistConfig({ ...config, bewegung: { ...config.bewegung, monate: an ? config.bewegung.monate.filter((x) => x !== m) : [...config.bewegung.monate, m].sort((a, b) => a - b) } })} style={{ ...styles.categoryChip, fontSize: 11.5, padding: "4px 9px", background: an ? "#1F6F5C" : "#F3F1EC", color: an ? "white" : "#8A8C86", borderColor: an ? "#1F6F5C" : "#E2DFD6", textDecoration: an ? "none" : "line-through" }}>{name.slice(0, 3)}</button>;
                  })}
                </div>
                <div style={{ fontSize: 12, color: "#5C5F58", marginBottom: 6 }}>Checkliste – vor der Fahrt</div>
                <SimpleListEditor items={config.bewegung.checklisteVor || []} onChange={(v) => persistConfig({ ...config, bewegung: { ...config.bewegung, checklisteVor: v } })} placeholder="Neuer Prüfpunkt" />
                <div style={{ fontSize: 12, color: "#5C5F58", margin: "10px 0 6px" }}>Checkliste – nach der Fahrt</div>
                <SimpleListEditor items={config.bewegung.checklisteNach || []} onChange={(v) => persistConfig({ ...config, bewegung: { ...config.bewegung, checklisteNach: v } })} placeholder="Neuer Prüfpunkt" />
              </div>
              <label style={{ ...styles.label, marginTop: 22 }}>Zugangscode ändern</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...styles.input, flex: 1 }} placeholder={`aktuell: ${config.accessCode}`} value={newCode} onChange={(e) => setNewCode(e.target.value)} />
                <button style={{ ...styles.saveBtn, flex: "none", padding: "0 16px" }} onClick={() => { if (newCode.trim().length >= 4) { persistConfig({ ...config, accessCode: newCode.trim() }); setNewCode(""); } }}><Check size={16} /></button>
              </div>

              {isMainAdmin && (
                <div style={{ marginTop: 22 }}>
                  <button style={styles.advancedToggle} onClick={() => setShowAdvanced(!showAdvanced)}>
                    <ChevronDown size={13} style={{ transform: showAdvanced ? "rotate(180deg)" : "none" }} /> Erweitert
                  </button>
                  {showAdvanced && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#8A8C86", marginBottom: 6 }}>ADMIN-RECHTE VERGEBEN</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        {roster.filter((r) => r.name !== config.mainAdminName).map((r) => (
                          <label key={r.name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "#5C5F58" }}>
                            <input type="checkbox" checked={config.adminNames.includes(r.name)} onChange={() => toggleAdmin(r.name)} /> {r.name}
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
  );
}
