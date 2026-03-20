import { T } from "../../utils/constants";
import { formatEventDescription } from "../../utils/scorebookEngine";

export default function EventLogPanel({ events, roster, onDelete, onClose }) {
  // Show in reverse chronological order
  const sorted = [...events].reverse();

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 50,
      display: "flex", flexDirection: "column", justifyContent: "flex-end",
    }} onClick={onClose}>
      <div style={{
        background: "#111118", borderRadius: "20px 20px 0 0", padding: "20px 16px",
        maxHeight: "80vh", overflowY: "auto",
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>Event Log</div>
          <button onClick={onClose} style={{
            background: "rgba(255,255,255,0.06)", border: `1px solid ${T.border}`,
            color: "#888", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>Close</button>
        </div>

        {sorted.length === 0 && (
          <div style={{ color: "#333", textAlign: "center", padding: 30 }}>No events yet.</div>
        )}

        {sorted.map(e => (
          <div key={e.id} style={{
            display: "flex", alignItems: "center", gap: 10, padding: "10px 0",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
            opacity: e.deleted ? 0.3 : 1,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: T.orange,
              fontFamily: "'DM Mono',monospace", minWidth: 24,
            }}>P{e.period}</div>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 13, color: e.deleted ? "#555" : "#ddd", fontWeight: 600,
                textDecoration: e.deleted ? "line-through" : "none",
              }}>{formatEventDescription(e, roster)}</div>
              <div style={{ fontSize: 10, color: "#333" }}>
                {new Date(e.timestamp).toLocaleTimeString()}
              </div>
            </div>
            {!e.deleted && (
              <button onClick={() => onDelete(e.id)} style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                color: T.red, borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: 700,
                cursor: "pointer", flexShrink: 0,
              }}>DEL</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
