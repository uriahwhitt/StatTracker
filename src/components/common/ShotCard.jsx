import { T, circBtn } from "../../utils/constants";
import { pct } from "../../utils/stats";

export default function ShotCard({ label, made, att, accent, onMadeAdd, onMadeUndo, onMissAdd, onMissUndo }) {
  const missDisplay = Math.max(0, att - made);
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8, userSelect: "none" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 14, fontWeight: 900, color: accent, letterSpacing: "0.08em", textTransform: "uppercase", minWidth: 36 }}>{label}</span>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>MADE</span>
          <button onClick={onMadeUndo} style={circBtn("#2a2a2a", 30)}>−</button>
          <span style={{ minWidth: 28, textAlign: "center", fontSize: 22, fontWeight: 900, color: "#fff", fontFamily: "'DM Mono',monospace" }}>{made}</span>
          <button onClick={onMadeAdd} style={circBtn(accent, 30)}>+</button>
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: "#888", fontWeight: 700 }}>MISS</span>
          <button onClick={onMissUndo} style={circBtn("#2a2a2a", 30)}>−</button>
          <span style={{ minWidth: 28, textAlign: "center", fontSize: 22, fontWeight: 900, color: "#555", fontFamily: "'DM Mono',monospace" }}>{missDisplay}</span>
          <button onClick={onMissAdd} style={circBtn("#444", 30)}>+</button>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 12, fontFamily: "'DM Mono',monospace", color: "#666", whiteSpace: "nowrap" }}>
          {made}/{att} <span style={{ color: accent, fontWeight: 700 }}>{pct(made, att)}</span>
        </span>
        <div style={{ flex: 1, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: att > 0 ? `${(made / att) * 100}%` : "0%", background: accent, borderRadius: 99, transition: "width 0.3s ease" }} />
        </div>
      </div>
    </div>
  );
}
