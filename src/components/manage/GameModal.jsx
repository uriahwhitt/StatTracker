import { useState } from "react";
import { T } from "../../utils/constants";

export default function GameModal({ db, game, defaultTournamentId, onSave, onClose }) {
  const isFinalized = game?._source === "scorebook" && (game?.status === "finalized" || game?.status === "final");

  const [teamId, setTeamId] = useState(game?.homeTeamId || game?.teamId || "");
  const [opponent, setOpponent] = useState(game?.opponent || "");
  const [gameDate, setGameDate] = useState(game?.gameDate || new Date().toISOString().slice(0, 10));
  const [tournamentId, setTournamentId] = useState(game?.tournamentId || defaultTournamentId || "");
  const [phase, setPhase] = useState(game?.phase || "none");
  const [bracketName, setBracketName] = useState(game?.bracketName || "");
  const [round, setRound] = useState(game?.round || "");
  const [status, setStatus] = useState(game?.status || "scheduled");

  const handleSave = () => {
    const base = {
      ...(game || {}),
      tournamentId: tournamentId || null,
      phase: phase === "none" ? null : phase,
      bracketName: phase === "bracket" ? bracketName.trim() || null : null,
      round: phase === "bracket" ? round.trim() || null : null,
      status,
    };

    if (isFinalized) {
      // Retroactive edit: only allow updating tournament/phase/bracket/round/status
      onSave({ ...base, _source: "scorebook" });
    } else {
      onSave({
        ...base,
        homeTeamId: teamId,
        teamId,
        opponent: opponent.trim() || "TBD",
        gameDate,
        _source: game?._source || "scheduled",
      });
    }
  };

  const labelStyle = { fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6, display: "block" };
  const toggleBtn = (val, label, active) => (
    <button key={val} onClick={() => { if (val === "phase") return; }} style={{
      flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
      background: active ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
      border: `1px solid ${active ? "rgba(249,115,22,0.4)" : T.border}`,
      color: active ? T.orange : "#666",
    }}>{label}</button>
  );

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column", justifyContent: "flex-end", zIndex: 60,
    }} onClick={onClose}>
      <div style={{
        background: "#111118", borderRadius: "20px 20px 0 0",
        padding: "20px 16px", maxHeight: "85vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            {game ? "Edit Game" : "New Scheduled Game"}
          </div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
            color: "#888", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Cancel</button>
        </div>

        {isFinalized && (
          <div style={{ background: "rgba(59,130,246,0.08)", border: `1px solid rgba(59,130,246,0.2)`, borderRadius: 10, padding: "10px 14px", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: T.blue, fontWeight: 600 }}>Finalized scorebook game — only tournament/phase fields can be updated.</div>
          </div>
        )}

        {/* Team */}
        {!isFinalized && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Team</label>
            <select value={teamId} onChange={e => setTeamId(e.target.value)} style={{ fontSize: 14 }}>
              <option value="">Select team…</option>
              {db.teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        {/* Opponent */}
        {!isFinalized && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Opponent</label>
            <input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="Opponent team name…" style={{ fontSize: 15 }} />
          </div>
        )}

        {/* Date */}
        {!isFinalized && (
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Date</label>
            <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)} style={{ fontSize: 14 }} />
          </div>
        )}

        {/* Tournament */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Tournament</label>
          <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} style={{ fontSize: 14 }}>
            <option value="">None / Exhibition</option>
            {db.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {/* Phase */}
        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Phase</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["none", "None"], ["pool", "Pool"], ["bracket", "Bracket"]].map(([val, label]) => (
              <button key={val} onClick={() => setPhase(val)} style={{
                flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: phase === val ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${phase === val ? "rgba(249,115,22,0.4)" : T.border}`,
                color: phase === val ? T.orange : "#666",
              }}>{label}</button>
            ))}
          </div>
        </div>

        {/* Bracket fields */}
        {phase === "bracket" && (
          <>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Bracket Name</label>
              <input value={bracketName} onChange={e => setBracketName(e.target.value)} placeholder="Gold, Silver, Championship…" style={{ fontSize: 14 }} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Round</label>
              <input value={round} onChange={e => setRound(e.target.value)} placeholder="Round 1, Semifinal, Final…" style={{ fontSize: 14 }} />
            </div>
          </>
        )}

        {/* Status */}
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Status</label>
          <div style={{ display: "flex", gap: 8 }}>
            {[["scheduled", "Scheduled"], ["live", "Live"], ["final", "Final"]].map(([val, label]) => (
              <button key={val} onClick={() => setStatus(val)} style={{
                flex: 1, padding: "10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer",
                background: status === val ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${status === val ? "rgba(249,115,22,0.4)" : T.border}`,
                color: status === val ? T.orange : "#666",
              }}>{label}</button>
            ))}
          </div>
        </div>

        <button onClick={handleSave} style={{
          width: "100%",
          background: `linear-gradient(135deg, ${T.orange}, #ea580c)`,
          color: "#fff", border: "none", borderRadius: 12,
          padding: "14px", fontSize: 15, fontWeight: 800, cursor: "pointer",
        }}>
          {game ? "Save Changes" : "Create Game"}
        </button>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}
