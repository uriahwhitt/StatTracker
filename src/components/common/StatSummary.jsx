import { T } from "../../utils/constants";
import { pct } from "../../utils/stats";

export default function StatSummary({ stats, points, gamesPlayed, showAvg }) {
  const n = gamesPlayed || 1;
  const avg = (v) => showAvg ? (v / n).toFixed(1) : v;
  const rows = [
    { label: "Points", val: showAvg ? (points / n).toFixed(1) : points, sub: null, accent: T.orange },
    { label: "2PT", val: `${stats.pts2}/${stats.pts2a}`, sub: pct(stats.pts2, stats.pts2a), accent: T.orange },
    { label: "3PT", val: `${stats.pts3}/${stats.pts3a}`, sub: pct(stats.pts3, stats.pts3a), accent: T.orange },
    { label: "FT", val: `${stats.ft}/${stats.fta}`, sub: pct(stats.ft, stats.fta), accent: T.orange },
    { label: "Off Reb", val: avg(stats.oreb), sub: null, accent: T.green },
    { label: "Def Reb", val: avg(stats.dreb), sub: null, accent: T.green },
    { label: "Reb Total", val: avg(stats.oreb + stats.dreb), sub: null, accent: T.green },
    { label: "Assists", val: avg(stats.ast), sub: null, accent: T.green },
    { label: "Steals", val: avg(stats.stl), sub: null, accent: T.blue },
    { label: "Blocks", val: avg(stats.blk), sub: null, accent: T.blue },
    { label: "Turnovers", val: avg(stats.tov), sub: null, accent: "#888" },
    { label: "Fouls", val: avg(stats.foul), sub: null, accent: "#888" },
  ];
  return (
    <div style={{ background: "rgba(255,255,255,0.025)", borderRadius: 14, overflow: "hidden", border: `1px solid ${T.border}` }}>
      {rows.map((r, i) => (
        <div key={r.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 16px", borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
          <span style={{ fontSize: 14, color: "#777" }}>{r.label}{showAvg && !["Points", "2PT", "3PT", "FT"].includes(r.label) ? " /g" : ""}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {r.sub && <span style={{ fontSize: 12, color: r.accent, fontWeight: 700 }}>{r.sub}</span>}
            <span style={{ fontFamily: "'DM Mono',monospace", fontWeight: 700, color: "#fff", fontSize: 16, minWidth: 44, textAlign: "right" }}>{r.val}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
