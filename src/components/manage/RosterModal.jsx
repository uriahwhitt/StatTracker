import { useState } from "react";
import { T } from "../../utils/constants";

export default function RosterModal({ db, updateDb, teamId, onClose }) {
  const team = db.teams.find(t => t.id === teamId);
  const [editingJersey, setEditingJersey] = useState({}); // playerId → jerseyNumber
  const [addPlayerId, setAddPlayerId] = useState("");
  const [addJersey, setAddJersey] = useState("");
  const [confirmRemove, setConfirmRemove] = useState(null);

  if (!team) return null;

  const roster = team.roster || [];
  const orgPlayers = db.players.filter(p => p.orgId === team.orgId);
  const notOnTeam = orgPlayers.filter(p => !roster.some(r => r.playerId === p.id));

  const persist = (newRoster) => {
    updateDb({ ...db, teams: db.teams.map(t => t.id === teamId ? { ...t, roster: newRoster } : t) });
  };

  const saveJersey = (playerId) => {
    const num = editingJersey[playerId];
    if (num === undefined) return;
    persist(roster.map(r => r.playerId === playerId ? { ...r, jerseyNumber: num } : r));
    setEditingJersey(j => { const next = { ...j }; delete next[playerId]; return next; });
  };

  const removePlayer = (playerId) => {
    persist(roster.filter(r => r.playerId !== playerId));
    setConfirmRemove(null);
  };

  const addToRoster = () => {
    if (!addPlayerId) return;
    persist([...roster, { playerId: addPlayerId, jerseyNumber: addJersey.trim() || "?" }]);
    setAddPlayerId("");
    setAddJersey("");
  };

  return (
    // Faux viewport overlay pattern (no position:fixed)
    <div style={{
      minHeight: "100vh", background: "rgba(0,0,0,0.85)",
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
      position: "fixed", inset: 0, zIndex: 60,
    }} onClick={onClose}>
      <div style={{
        background: "#111118", borderRadius: "20px 20px 0 0",
        padding: "20px 16px", maxHeight: "85vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{team.name} — Roster</div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
            color: "#888", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Close</button>
        </div>

        {/* Roster entries */}
        {roster.length === 0 && (
          <div style={{ color: "#333", textAlign: "center", padding: "20px 0", fontSize: 13 }}>No players on roster yet.</div>
        )}
        {roster.map(entry => {
          const player = db.players.find(p => p.id === entry.playerId);
          const currentJersey = editingJersey[entry.playerId] ?? entry.jerseyNumber;
          return (
            <div key={entry.playerId} style={{
              display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
              borderBottom: `1px solid ${T.border}`,
            }}>
              <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, color: "#555", width: 16 }}>#</span>
              <input
                value={currentJersey}
                onChange={e => setEditingJersey(j => ({ ...j, [entry.playerId]: e.target.value }))}
                onBlur={() => saveJersey(entry.playerId)}
                onKeyDown={e => e.key === "Enter" && saveJersey(entry.playerId)}
                style={{
                  width: 52, textAlign: "center", fontSize: 15, fontWeight: 900,
                  fontFamily: "'DM Mono',monospace", color: T.orange, padding: "6px 8px",
                }}
              />
              <span style={{ flex: 1, color: "#ddd", fontWeight: 600, fontSize: 14 }}>
                {player?.name || "Unknown"}
              </span>
              {confirmRemove === entry.playerId ? (
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => removePlayer(entry.playerId)} style={actionBtn(T.red)}>Remove</button>
                  <button onClick={() => setConfirmRemove(null)} style={actionBtn("#444")}>✕</button>
                </div>
              ) : (
                <button onClick={() => setConfirmRemove(entry.playerId)} style={actionBtn("rgba(239,68,68,0.2)")}>−</button>
              )}
            </div>
          );
        })}

        {/* Add player to roster */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
            Add player to roster
          </div>
          {notOnTeam.length === 0 ? (
            <div style={{ fontSize: 12, color: "#444" }}>All org players are on this roster.</div>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <select value={addPlayerId} onChange={e => setAddPlayerId(e.target.value)} style={{ flex: 1, fontSize: 13 }}>
                <option value="">Select player…</option>
                {notOnTeam.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span style={{ fontSize: 12, color: "#555" }}>#</span>
              <input
                value={addJersey}
                onChange={e => setAddJersey(e.target.value)}
                placeholder="00"
                style={{ width: 52, textAlign: "center", fontSize: 14, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}
              />
              <button onClick={addToRoster} disabled={!addPlayerId} style={{
                background: addPlayerId ? T.orange : "rgba(255,255,255,0.06)",
                color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px",
                fontSize: 13, fontWeight: 700, cursor: addPlayerId ? "pointer" : "default",
              }}>Add</button>
            </div>
          )}
        </div>
        <div style={{ height: 8 }} />
      </div>
    </div>
  );
}

const actionBtn = (bg) => ({
  background: bg, border: "none", color: "#fff", borderRadius: 6,
  padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer",
});
