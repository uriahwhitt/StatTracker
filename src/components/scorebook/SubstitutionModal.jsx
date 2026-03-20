import { T } from "../../utils/constants";

export default function SubstitutionModal({ outPlayer, benchPlayers, onSelect, onClose }) {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", zIndex: 50,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div style={{
        background: "#111118", borderRadius: "20px 20px 0 0", padding: "20px 16px",
        maxHeight: "60vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#888", marginBottom: 12 }}>
          Sub out <span style={{ color: T.orange }}>#{outPlayer.jerseyNumber} {outPlayer.name}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
          {benchPlayers.map(p => (
            <button key={p.playerId} onClick={() => onSelect(p.playerId)} style={{
              padding: "16px 8px", borderRadius: 14, cursor: "pointer", textAlign: "center",
              background: "rgba(255,255,255,0.04)", border: `2px solid ${T.border}`,
            }}>
              <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 900, color: T.orange }}>
                {p.jerseyNumber}
              </div>
              <div style={{ fontSize: 11, color: "#aaa", fontWeight: 600, marginTop: 4 }}>{p.name}</div>
            </button>
          ))}
        </div>
        {benchPlayers.length === 0 && (
          <div style={{ color: "#444", textAlign: "center", padding: 20 }}>No players on bench.</div>
        )}
        <button onClick={onClose} style={{
          marginTop: 16, width: "100%", background: "rgba(255,255,255,0.06)",
          color: "#888", border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>Cancel</button>
      </div>
    </div>
  );
}
