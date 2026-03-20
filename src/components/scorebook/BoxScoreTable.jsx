import { T } from "../../utils/constants";
import { pct } from "../../utils/stats";

export default function BoxScoreTable({ boxScore, activatedPlayerIds }) {
  const cols = ["PTS", "2PT", "3PT", "FT", "REB", "AST", "STL", "BLK", "TO", "PF"];

  return (
    <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${T.border}` }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, fontFamily: "'DM Mono',monospace" }}>
        <thead>
          <tr style={{ background: "rgba(255,255,255,0.04)" }}>
            <th style={{ padding: "8px 6px", textAlign: "left", color: "#666", fontWeight: 700 }}>Player</th>
            {cols.map(c => (
              <th key={c} style={{ padding: "8px 4px", textAlign: "center", color: "#666", fontWeight: 700, fontSize: 10 }}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {boxScore.map(p => {
            const s = p.stats;
            const wasActive = activatedPlayerIds?.includes(p.playerId);
            const anyStats = s.points > 0 || s.oreb > 0 || s.dreb > 0 || s.ast > 0 ||
              s.stl > 0 || s.blk > 0 || s.tov > 0 || s.foul > 0;
            return (
              <tr key={p.playerId} style={{
                borderTop: "1px solid rgba(255,255,255,0.04)",
                opacity: wasActive === undefined || wasActive ? 1 : 0.3,
              }}>
                <td style={{ padding: "8px 6px", whiteSpace: "nowrap" }}>
                  <span style={{ color: T.orange, fontWeight: 900 }}>#{p.jerseyNumber}</span>
                  <span style={{ color: "#ccc", fontWeight: 600, fontFamily: "'DM Sans',sans-serif", marginLeft: 6 }}>{p.name}</span>
                  {wasActive && !anyStats && <span style={{ color: "#444", fontSize: 9, marginLeft: 4 }}>DNP</span>}
                </td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#fff", fontWeight: 700 }}>{s.points}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#aaa" }}>{s.pts2}/{s.pts2a}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#aaa" }}>{s.pts3}/{s.pts3a}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#aaa" }}>{s.ft}/{s.fta}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#aaa" }}>{s.oreb + s.dreb}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#aaa" }}>{s.ast}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#aaa" }}>{s.stl}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#aaa" }}>{s.blk}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: "#aaa" }}>{s.tov}</td>
                <td style={{ textAlign: "center", padding: "8px 4px", color: s.foul >= 5 ? T.red : "#aaa" }}>{s.foul}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
