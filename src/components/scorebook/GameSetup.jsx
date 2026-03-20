import { useState } from "react";
import { T, circBtn } from "../../utils/constants";
import { todayStr } from "../../utils/dates";

export default function GameSetup({ db, onComplete, onCancel }) {
  const [step, setStep] = useState(1); // 1: team, 2: format, 3: details, 4: roster/starting5
  const [orgId, setOrgId] = useState(db.organizations[0]?.id || "");
  const [teamId, setTeamId] = useState("");
  const [gameRoster, setGameRoster] = useState([]); // working roster for this game
  const [format, setFormat] = useState({
    periodType: "quarter",
    periods: 4,
    periodLength: 8,
    foulsToDisqualify: 5,
    bonusThreshold: 7,
    doubleBonusThreshold: 10,
    homeTimeouts: 5,
    awayTimeouts: 5,
  });
  const [opponent, setOpponent] = useState("");
  const [tournamentId, setTournamentId] = useState("");
  const [gameDate, setGameDate] = useState(todayStr);
  const [startingFive, setStartingFive] = useState([]);

  const teamsForOrg = db.teams.filter(t => t.orgId === orgId);
  const selectedTeam = db.teams.find(t => t.id === teamId);

  const loadTeamRoster = (tid) => {
    setTeamId(tid);
    const team = db.teams.find(t => t.id === tid);
    if (!team) { setGameRoster([]); return; }
    // Use temp roster if available, otherwise permanent
    const source = team.tempRoster || team.roster || [];
    setGameRoster(source.map(r => ({
      playerId: r.playerId,
      name: db.players.find(p => p.id === r.playerId)?.name || "Unknown",
      jerseyNumber: r.jerseyNumber,
    })));
    setStartingFive([]);
  };

  const toggleStarting = (playerId) => {
    setStartingFive(prev =>
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : prev.length < 5 ? [...prev, playerId] : prev
    );
  };

  const handleComplete = () => {
    const game = {
      id: `sb_${Date.now()}`,
      status: "live",
      createdAt: new Date().toISOString(),
      orgId,
      teamId,
      opponent: opponent.trim() || "Unknown Opponent",
      tournamentId: tournamentId || null,
      gameDate,
      format,
      roster: gameRoster,
      initialFive: startingFive,
      activePlayers: startingFive,
      currentPeriod: 1,
      events: [],
      finalizedAt: null,
      generatedGameIds: [],
    };
    onComplete(game);
  };

  const canProceed = () => {
    if (step === 1) return teamId && gameRoster.length >= 5;
    if (step === 2) return true;
    if (step === 3) return opponent.trim().length > 0;
    if (step === 4) return startingFive.length === 5;
    return false;
  };

  const sectionStyle = { marginBottom: 16 };
  const labelStyle = { fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>New Game Setup</div>
        <button onClick={onCancel} style={{
          background: "transparent", border: "1px solid #333", color: "#555",
          borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}>Cancel</button>
      </div>

      {/* Step indicators */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {["Team", "Format", "Details", "Lineup"].map((s, i) => (
          <div key={s} style={{
            flex: 1, textAlign: "center", fontSize: 10, fontWeight: 700, letterSpacing: "0.06em",
            color: step === i + 1 ? T.orange : step > i + 1 ? T.green : "#333",
            borderBottom: `2px solid ${step === i + 1 ? T.orange : step > i + 1 ? T.green : "#222"}`,
            paddingBottom: 6,
          }}>{s}</div>
        ))}
      </div>

      {/* Step 1: Select Team */}
      {step === 1 && (
        <div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Organization</div>
            <select value={orgId} onChange={e => { setOrgId(e.target.value); setTeamId(""); setGameRoster([]); }} style={{ fontSize: 14 }}>
              <option value="">Select Organization…</option>
              {db.organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Team</div>
            <select value={teamId} onChange={e => loadTeamRoster(e.target.value)} style={{ fontSize: 14 }}>
              <option value="">Select Team…</option>
              {teamsForOrg.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({(t.roster || []).length} players)</option>
              ))}
            </select>
          </div>
          {gameRoster.length > 0 && (
            <div style={sectionStyle}>
              <div style={labelStyle}>Game Roster ({gameRoster.length} players)</div>
              {gameRoster.map(r => (
                <div key={r.playerId} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
                  background: T.card, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 4,
                }}>
                  <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 900, color: T.orange, minWidth: 30 }}>#{r.jerseyNumber}</span>
                  <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{r.name}</span>
                </div>
              ))}
            </div>
          )}
          {gameRoster.length < 5 && teamId && (
            <div style={{ color: T.red, fontSize: 13, fontWeight: 600 }}>Need at least 5 players on roster. Add players in the Manage tab.</div>
          )}
        </div>
      )}

      {/* Step 2: Game Format */}
      {step === 2 && (
        <div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Period Type</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[["quarter", "Quarters (4)"], ["half", "Halves (2)"]].map(([val, label]) => (
                <button key={val} onClick={() => setFormat(f => ({ ...f, periodType: val, periods: val === "quarter" ? 4 : 2 }))} style={{
                  flex: 1, padding: "12px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                  background: format.periodType === val ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${format.periodType === val ? "rgba(249,115,22,0.4)" : T.border}`,
                  color: format.periodType === val ? T.orange : "#666",
                }}>{label}</button>
              ))}
            </div>
          </div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Period Length (minutes)</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              {[6, 8, 10, 12, 16, 20].map(len => {
                const presetSelected = [6, 8, 10, 12, 16, 20].includes(format.periodLength);
                const isActive = format.periodLength === len;
                return (
                  <button key={len} onClick={() => setFormat(f => ({ ...f, periodLength: len }))} style={{
                    flex: 1, padding: "10px 4px", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer",
                    background: isActive ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${isActive ? "rgba(249,115,22,0.4)" : T.border}`,
                    color: isActive ? T.orange : "#666",
                  }}>{len}</button>
                );
              })}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 12, color: "#555", fontWeight: 700, flexShrink: 0 }}>Custom:</span>
              <input
                type="number"
                min="1"
                max="30"
                placeholder="Min"
                value={![6, 8, 10, 12, 16, 20].includes(format.periodLength) ? format.periodLength : ""}
                onChange={e => {
                  const v = parseInt(e.target.value);
                  if (v > 0 && v <= 30) setFormat(f => ({ ...f, periodLength: v }));
                }}
                style={{ width: 70, minWidth: 70, textAlign: "center", fontSize: 14, fontWeight: 700, padding: "8px 10px" }}
              />
              <span style={{ fontSize: 12, color: "#444" }}>minutes</span>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Game Details */}
      {step === 3 && (
        <div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Opponent</div>
            <input placeholder="Opponent team name…" value={opponent} onChange={e => setOpponent(e.target.value)} style={{ fontSize: 15 }} />
          </div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Date</div>
            <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} style={{ fontSize: 14 }} />
          </div>
          <div style={sectionStyle}>
            <div style={labelStyle}>Tournament (optional)</div>
            <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} style={{ fontSize: 14 }}>
              <option value="">No Tournament</option>
              {db.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Step 4: Starting Five */}
      {step === 4 && (
        <div>
          <div style={labelStyle}>Select Starting 5 <span style={{ color: T.orange }}>({startingFive.length}/5)</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
            {gameRoster.map(r => {
              const selected = startingFive.includes(r.playerId);
              return (
                <button key={r.playerId} onClick={() => toggleStarting(r.playerId)} style={{
                  padding: "14px 8px", borderRadius: 12, cursor: "pointer", textAlign: "center",
                  background: selected ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                  border: `2px solid ${selected ? T.orange : T.border}`,
                  transition: "all 0.15s",
                }}>
                  <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 900, color: selected ? T.orange : "#555" }}>
                    {r.jerseyNumber}
                  </div>
                  <div style={{ fontSize: 11, color: selected ? "#fff" : "#666", fontWeight: 600, marginTop: 4 }}>{r.name}</div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Navigation buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
        {step > 1 && (
          <button onClick={() => setStep(s => s - 1)} style={{
            flex: 1, background: "rgba(255,255,255,0.04)", color: "#888",
            border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px",
            fontSize: 15, fontWeight: 700, cursor: "pointer",
          }}>Back</button>
        )}
        <button onClick={() => step < 4 ? setStep(s => s + 1) : handleComplete()} disabled={!canProceed()} style={{
          flex: 2, borderRadius: 12, padding: "14px", fontSize: 15, fontWeight: 800, cursor: canProceed() ? "pointer" : "default",
          background: canProceed() ? `linear-gradient(135deg, ${T.orange}, #ea580c)` : "rgba(255,255,255,0.04)",
          color: canProceed() ? "#fff" : "#444", border: "none",
          boxShadow: canProceed() ? "0 4px 16px rgba(249,115,22,0.3)" : "none",
        }}>{step < 4 ? "Next" : "Start Game"}</button>
      </div>
    </div>
  );
}
