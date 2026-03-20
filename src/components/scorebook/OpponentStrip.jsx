import { T } from "../../utils/constants";

export default function OpponentStrip({ opponent, score, fouls, timeouts, onScore, onFoul, onTechFoul, onTimeout }) {
  const btn = (label, color, onClick) => (
    <button onClick={onClick} style={{
      background: `${color}44`, border: `1px solid ${color}88`, color: "#fff",
      borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 800,
      cursor: "pointer", minHeight: 38,
    }}>{label}</button>
  );

  return (
    <div style={{
      background: "rgba(59,130,246,0.08)",
      borderTop: `1px solid rgba(59,130,246,0.3)`,
      padding: "8px 10px env(safe-area-inset-bottom, 8px)",
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: "#888", fontWeight: 700 }}>{opponent}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 20, fontWeight: 900, color: "#fff" }}>{score}</span>
            <span style={{ fontSize: 10, color: "#777" }}>PF:{fouls}</span>
            <span style={{ fontSize: 10, color: "#777" }}>
              TOs:{Array.from({ length: timeouts.awayRemaining }, () => "●").join("")}
              {Array.from({ length: timeouts.awayUsed }, () => "○").join("")}
            </span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {btn("+1", T.blue, () => onScore(1))}
          {btn("+2", T.blue, () => onScore(2))}
          {btn("+3", T.blue, () => onScore(3))}
          {btn("PF", "#F59E0B", onFoul)}
          {btn("TF", T.red, onTechFoul)}
          {btn("TO", T.orange, onTimeout)}
        </div>
      </div>
    </div>
  );
}
