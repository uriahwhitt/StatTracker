import { T, circBtn } from "../../utils/constants";

export default function CountCard({ label, value, accent, onAdd, onSub }) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 18, padding: "14px 10px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, userSelect: "none" }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: accent, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button onClick={onSub} style={circBtn("#2a2a2a", 36)}>−</button>
        <span style={{ fontSize: 30, fontWeight: 900, minWidth: 38, textAlign: "center", color: "#fff", fontFamily: "'DM Mono',monospace" }}>{value}</span>
        <button onClick={onAdd} style={circBtn(accent, 36)}>+</button>
      </div>
    </div>
  );
}
