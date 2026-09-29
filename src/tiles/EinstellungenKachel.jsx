import React, { useState } from "react";
import { ArrowLeft, Check, ChevronDown, Plus, X } from "lucide-react";
import { APP_VERSION, EINSATZ_GERAETE_STANDARD, FESTE_FUNKTIONEN, FESTE_LEHRGAENGE, MONTHS } from "../lib/constants";
import { matchesSearch, weiblichVorschlag } from "../lib/helpers";
import { styles } from "../lib/styles";
import { GeschlechtListEditor, RosterAdminRow, SearchBox, SimpleListEditor } from "../components/Shared";
import { supabase } from "../supabaseClient";
import { LION_ICON } from "../lib/icons";
import { fmtDate } from "../lib/helpers";
import { useApp } from "../AppContext";

const KACHELN = [["fuehrerschein", "Führerschein"], ["atemschutz", "Atemschutz"], ["ausschuss", "Ausschuss"], ["einsatz", "Einsatzberichte"], ["geraete", "Geräte"], ["jugend", "Jugendfeuerwehr"], ["bewegung", "Bewegungsfahrten"], ["statistik", "Statistik"], ["personalakte", "Personalakte"], ["chat", "Nachrichten"]];
// Kachel Einstellungen (nur Admin): Mitglieder, Rechte, Auswahllisten, Zugangscode, Admins
export default function EinstellungenKachel() {
  const [logoUpload, setLogoUpload] = useState(false);
  const { flashError, alleMitglieder, setConfirmBlock, config, roster, newCode, setNewCode, rosterSearch, setRosterSearch, newMemberName, setNewMemberName, setConfirmDeleteName, showAdvanced, setShowAdvanced, kachelReturnTo, isMainAdmin, closeKachelView, persistConfig, resetPin, toggleAdmin, togglePermission, toggleBereichAssignment, toggleAtemschutz, adminAddMember, toggleGruppenfuehrer, toggleAusschuss, toggleAusschussRecht } = useApp();
  // Ein Listen-Paar (Einträge + weibliche Formen) gemeinsam speichern.
  const listeSpeichern = (key) => (items, weiblich) => persistConfig({ ...config, [key]: items, weiblich });
  // Einträge ohne weibliche Form, für die es einen Vorschlag gibt (z. B. ältere Listen von vor Version 2.8).
  const fehlendeWeiblich = {};
  ["raenge", "funktionen", "lehrgaenge", "leistungsabzeichen", "ehrungen"].forEach((k) => (config[k] || []).forEach((it) => {
    const w = weiblichVorschlag(it);
    if (!(config.weiblich || {})[it] && w && w !== it) fehlendeWeiblich[it] = w;
  }));
  async function logoHochladen(file) {
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) { flashError("Bitte ein PNG- oder JPG-Bild wählen."); return; }
    if (file.size > 3 * 1024 * 1024) { flashError("Das Bild ist zu groß (max. 3 MB)."); return; }
    setLogoUpload(true);
    try {
      const path = `logo/druck_${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}`;
      const { error } = await supabase.storage.from("anhaenge").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("anhaenge").getPublicUrl(path);
      persistConfig({ ...config, druckLogoUrl: data.publicUrl });
    } catch (e) { flashError("Logo-Upload fehlgeschlagen."); }
    setLogoUpload(false);
  }
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
              <div style={{ ...styles.label, marginTop: 22, fontSize: 13 }}>Auswahllisten für die Personalakte</div>
              <div style={{ fontSize: 11, color: "#8A8C86", marginBottom: 8 }}>Gespeichert wird immer die erste Form. Bei Frauen zeigt die App automatisch die weibliche Form (Geschlecht wählt jedes Mitglied in seiner Personalakte).</div>
              {Object.keys(fehlendeWeiblich).length > 0 && (
                <div style={{ ...styles.capacityBox, marginTop: 4, marginBottom: 6 }}>
                  <div style={{ fontSize: 12, color: "#5C5F58", marginBottom: 6 }}>Für {Object.keys(fehlendeWeiblich).length} Einträge fehlt noch die weibliche Form, z. B. {Object.entries(fehlendeWeiblich).slice(0, 2).map(([m, w]) => `${m} → ${w}`).join(", ")}.</div>
                  <button style={styles.tinyBtnPrimary} onClick={() => persistConfig({ ...config, weiblich: { ...fehlendeWeiblich, ...config.weiblich } })}>Vorschläge übernehmen</button>
                  <span style={{ fontSize: 10.5, color: "#8A8C86", marginLeft: 8 }}>danach einzeln prüfbar</span>
                </div>
              )}
              <label style={{ ...styles.label, marginTop: 10 }}>Dienstgrade</label>
              <GeschlechtListEditor items={config.raenge || []} weiblich={config.weiblich} onChange={listeSpeichern("raenge")} placeholder="z. B. Oberfeuerwehrmann" />
              <label style={{ ...styles.label, marginTop: 16 }}>Funktionen</label>
              <GeschlechtListEditor items={config.funktionen || []} weiblich={config.weiblich} onChange={listeSpeichern("funktionen")} placeholder="z. B. Sprechfunker" locked={FESTE_FUNKTIONEN} />
              <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 2 }}>Gruppenführer, Gerätewart und Jugendwart sind fest und steuern Rechte in der App (Einsatzberichte, Mängelmeldungen, Jugendliche verwalten).</div>
              <label style={{ ...styles.label, marginTop: 16 }}>Lehrgänge</label>
              <GeschlechtListEditor items={config.lehrgaenge || []} weiblich={config.weiblich} onChange={listeSpeichern("lehrgaenge")} placeholder="z. B. Truppführer" locked={FESTE_LEHRGAENGE} />
              <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 2 }}>Maschinist ist fest: Wer diesen Lehrgang in der Akte hat, wird bei den Bewegungsfahrten eingeteilt.</div>
              <label style={{ ...styles.label, marginTop: 16 }}>Leistungsabzeichen</label>
              <GeschlechtListEditor items={config.leistungsabzeichen || []} weiblich={config.weiblich} onChange={listeSpeichern("leistungsabzeichen")} placeholder="z. B. Leistungsabzeichen THL Bronze" />
              <label style={{ ...styles.label, marginTop: 16 }}>Ehrungen & Auszeichnungen</label>
              <GeschlechtListEditor items={config.ehrungen || []} weiblich={config.weiblich} onChange={listeSpeichern("ehrungen")} placeholder="z. B. Ehrenzeichen Silber" />
              <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 2 }}>Bei Lehrgängen, Leistungsabzeichen und Ehrungen kann zusätzlich immer etwas frei eingetragen werden.</div>

              <label style={{ ...styles.label, marginTop: 22 }}>Einsatzbericht – Geräte & Material</label>
              <SimpleListEditor items={config.einsatzGeraete || []} onChange={(v) => persistConfig({ ...config, einsatzGeraete: v })} placeholder="z. B. Betriebsdauer Rettungsspreizer (Std.)" />
              <div style={{ fontSize: 10.5, color: "#8A8C86", marginTop: 2 }}>Die Einheit in Klammern dahinter schreiben. Kilometer und Pumpenstunden kommen automatisch je Fahrzeug dazu, Atemschutz aus der Mannschaftsliste.
                {" "}<button style={{ ...styles.tinyBtn, marginTop: 4 }} onClick={() => persistConfig({ ...config, einsatzGeraete: EINSATZ_GERAETE_STANDARD })}>Standardliste wiederherstellen</button></div>

              <label style={{ ...styles.label, marginTop: 22 }}>Logo für Ausdrucke</label>
              <div style={{ ...styles.capacityBox, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <img src={config.druckLogoUrl || LION_ICON} alt="Logo" style={{ height: 46, width: "auto", maxWidth: 140, objectFit: "contain", background: "white", border: "1px solid #E2DFD6", borderRadius: 4, padding: 4 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={styles.smallAddBtn}>
                    {logoUpload ? "Lädt hoch …" : <><Plus size={12} /> Anderes Logo hochladen</>}
                    <input type="file" accept="image/png,image/jpeg" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) logoHochladen(e.target.files[0]); e.target.value = ""; }} />
                  </label>
                  {config.druckLogoUrl && <button style={styles.tinyBtn} onClick={() => persistConfig({ ...config, druckLogoUrl: "" })}>Standard-Logo verwenden</button>}
                </div>
                <div style={{ fontSize: 10.5, color: "#8A8C86", width: "100%" }}>Am besten ein PNG mit durchsichtigem Hintergrund. Standard ist das Löwen-Wappen.</div>
              </div>
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
                  <label style={styles.label}>Kacheln verwalten</label>
                  <div style={{ fontSize: 11.5, color: "#8A8C86", marginBottom: 8 }}>Hier gibst du Kacheln für die gesamte Feuerwehr frei oder sperrst sie. Eine gesperrte Kachel verschwindet bei allen aus dem Funktionen-Menü und lässt sich auch nicht mehr über einen Link öffnen. Nur du kannst das ändern.</div>
                  {KACHELN.map(([key, name]) => {
                    const aus = (config.kachelnAus || []).includes(key);
                    return (
                      <label key={key} style={{ ...styles.checkboxRow, alignItems: "center", padding: "5px 0" }}>
                        <input type="checkbox" aria-label={`Kachel ${name} freigegeben`} checked={!aus} onChange={() => persistConfig({ ...config, kachelnAus: aus ? (config.kachelnAus || []).filter((k) => k !== key) : [...(config.kachelnAus || []), key] })} />
                        <span style={{ flex: 1 }}>{name}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: aus ? "#C1272D" : "#2E7D4F" }}>{aus ? "gesperrt" : "freigegeben"}</span>
                      </label>
                    );
                  })}
                </div>
              )}

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
