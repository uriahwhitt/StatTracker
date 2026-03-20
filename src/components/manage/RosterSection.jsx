import { useState } from "react";
import { T, circBtn } from "../../utils/constants";
import SectionLabel from "../common/SectionLabel";

export default function RosterSection({ db, updateDb, teamId }) {
  const [selectedPlayerId, setSelectedPlayerId] = useState("");
  const [jerseyNumber, setJerseyNumber] = useState("");
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editingJersey, setEditingJersey] = useState("");
  const [confirmRemoveId, setConfirmRemoveId] = useState(null);

  const team = db.teams.find(t => t.id === teamId);
  if (!team) return null;

  const roster = team.roster || [];
  const rosterPlayerIds = new Set(roster.map(r => r.playerId));
  const availablePlayers = db.players.filter(p => !rosterPlayerIds.has(p.id));

  const getPlayerName = (playerId) => db.players.find(p => p.id === playerId)?.name || "Unknown";

  const updateTeamRoster = (newRoster) => {
    updateDb({
      ...db,
      teams: db.teams.map(t => t.id === teamId ? { ...t, roster: newRoster } : t),
    });
  };

  const addToRoster = () => {
    if (!selectedPlayerId || !jerseyNumber.trim()) return;
    const duplicate = roster.find(r => r.jerseyNumber === jerseyNumber.trim());
    if (duplicate) {
      // Allow it but warn — they can have conflicts (we just proceed)
    }
    updateTeamRoster([...roster, { playerId: selectedPlayerId, jerseyNumber: jerseyNumber.trim() }]);
    setSelectedPlayerId("");
    setJerseyNumber("");
  };

  const removeFromRoster = (playerId) => {
    updateTeamRoster(roster.filter(r => r.playerId !== playerId));
    setConfirmRemoveId(null);
  };

  const saveJerseyEdit = (playerId) => {
    const num = editingJersey.trim();
    if (!num) return;
    updateTeamRoster(roster.map(r => r.playerId === playerId ? { ...r, jerseyNumber: num } : r));
    setEditingPlayerId(null);
    setEditingJersey("");
  };

  // Check for duplicate jersey numbers
  const jerseyCount = {};
  roster.forEach(r => { jerseyCount[r.jerseyNumber] = (jerseyCount[r.jerseyNumber] || 0) + 1; });

  return (
    <>
      <SectionLabel label={`Roster — ${team.name}`} color={T.orange} />

      {/* Add player to roster */}
      <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
        <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)} style={{ flex: 1 }}>
          <option value="">Select player…</option>
          {availablePlayers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <input
          placeholder="#"
          value={jerseyNumber}
          onChange={e => setJerseyNumber(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addToRoster()}
          style={{ width: 60, minWidth: 60, flexShrink: 0, textAlign: "center", fontSize: 16, fontWeight: 700 }}
        />
        <button onClick={addToRoster} style={{ ...circBtn(T.orange, 46), borderRadius: 10, flexShrink: 0, fontSize: 22 }}>+</button>
      </div>
      {availablePlayers.length === 0 && db.players.length > 0 && (
        <div style={{ fontSize: 11, color: "#444", marginBottom: 8, paddingLeft: 2 }}>All players assigned to this team.</div>
      )}
      {db.players.length === 0 && (
        <div style={{ fontSize: 11, color: "#444", marginBottom: 8, paddingLeft: 2 }}>Add players in the Players section below first.</div>
      )}

      {/* Roster list */}
      {roster.length === 0 && (
        <div style={{ color: "#333", fontSize: 13, marginBottom: 16, paddingLeft: 2, marginTop: 8 }}>No players on this roster yet.</div>
      )}
      {roster.map(r => {
        const name = getPlayerName(r.playerId);
        const isEditing = editingPlayerId === r.playerId;
        const isConfirming = confirmRemoveId === r.playerId;
        const isDuplicate = jerseyCount[r.jerseyNumber] > 1;

        return (
          <div key={r.playerId} style={{
            background: T.card, border: `1px solid ${isDuplicate ? "rgba(249,115,22,0.4)" : T.border}`,
            borderRadius: 12, padding: "10px 14px", marginBottom: 6,
          }}>
            {isEditing ? (
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 14, color: "#aaa", flex: 1 }}>{name}</span>
                <input
                  value={editingJersey}
                  onChange={e => setEditingJersey(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveJerseyEdit(r.playerId)}
                  style={{ width: 60, minWidth: 60, textAlign: "center", fontSize: 16, fontWeight: 700 }}
                  autoFocus
                />
                <button onClick={() => saveJerseyEdit(r.playerId)} style={{
                  background: T.orange, border: "none", color: "#fff", borderRadius: 8,
                  padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>Save</button>
                <button onClick={() => { setEditingPlayerId(null); setEditingJersey(""); }} style={{
                  background: "transparent", border: "1px solid #333", color: "#555", borderRadius: 8,
                  padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>Cancel</button>
              </div>
            ) : isConfirming ? (
              <div>
                <div style={{ fontSize: 13, color: T.red, fontWeight: 600, marginBottom: 8 }}>Remove {name} from roster?</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => removeFromRoster(r.playerId)} style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: T.red, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Remove</button>
                  <button onClick={() => setConfirmRemoveId(null)} style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #333", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{
                    fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 900, color: T.orange,
                    minWidth: 36, textAlign: "center",
                  }}>#{r.jerseyNumber}</span>
                  <span style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>{name}</span>
                  {isDuplicate && <span style={{ fontSize: 10, color: T.orange, fontWeight: 700 }}>DUPLICATE #</span>}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => { setEditingPlayerId(r.playerId); setEditingJersey(r.jerseyNumber); }} style={{
                    background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`, color: "#888",
                    borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>Edit #</button>
                  <button onClick={() => setConfirmRemoveId(r.playerId)} style={{
                    background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "#888",
                    borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}>Remove</button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Temp roster info */}
      {team.tempRoster && (
        <>
          <div style={{ fontSize: 11, color: "#555", fontWeight: 700, letterSpacing: "0.06em", marginTop: 16, marginBottom: 6, paddingLeft: 2 }}>LAST USED ROSTER</div>
          <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${T.border}`, borderRadius: 12, padding: "10px 14px" }}>
            {team.tempRoster.map(r => (
              <div key={r.playerId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 0" }}>
                <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 14, fontWeight: 700, color: "#666", minWidth: 30 }}>#{r.jerseyNumber}</span>
                <span style={{ fontSize: 13, color: "#888" }}>{getPlayerName(r.playerId)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
