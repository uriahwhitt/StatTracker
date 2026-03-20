import { useState } from "react";
import { T } from "../../utils/constants";

export default function GroupSubModal({ roster, activePlayers, onConfirm, onClose }) {
  const [selected, setSelected] = useState([...activePlayers]);

  const toggle = (pid) => {
    setSelected(prev =>
      prev.includes(pid)
        ? prev.filter(id => id !== pid)
        : prev.length < 5 ? [...prev, pid] : prev
    );
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div style={{
        background: "#111118", borderRadius: "20px 20px 0 0", padding: "20px 16px",
        maxHeight: "80vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#888", marginBottom: 4 }}>
          Group Substitution
        </div>
        <div style={{ fontSize: 12, color: T.orange, fontWeight: 700, marginBottom: 16 }}>
          Select 5 players ({selected.length}/5)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {roster.map(p => {
            const isSelected = selected.includes(p.playerId);
            const wasActive = activePlayers.includes(p.playerId);
            return (
              <button key={p.playerId} onClick={() => toggle(p.playerId)} style={{
                padding: "14px 8px", borderRadius: 14, cursor: "pointer", textAlign: "center",
                background: isSelected ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                border: `2px solid ${isSelected ? T.orange : T.border}`,
              }}>
                <div style={{
                  fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 900,
                  color: isSelected ? T.orange : "#555",
                }}>{p.jerseyNumber}</div>
                <div style={{ fontSize: 11, color: isSelected ? "#fff" : "#666", fontWeight: 600, marginTop: 4 }}>
                  {p.name}
                </div>
                {wasActive && !isSelected && (
                  <div style={{ fontSize: 9, color: T.red, fontWeight: 700, marginTop: 2 }}>ON COURT</div>
                )}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{
            flex: 1, background: "rgba(255,255,255,0.06)", color: "#888",
            border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>Cancel</button>
          <button onClick={() => selected.length === 5 && onConfirm(selected)} disabled={selected.length !== 5} style={{
            flex: 2, borderRadius: 12, padding: "14px", fontSize: 14, fontWeight: 800,
            cursor: selected.length === 5 ? "pointer" : "default",
            background: selected.length === 5 ? `linear-gradient(135deg, ${T.orange}, #ea580c)` : "rgba(255,255,255,0.04)",
            color: selected.length === 5 ? "#fff" : "#444", border: "none",
          }}>Confirm Lineup</button>
        </div>
      </div>
    </div>
  );
}
