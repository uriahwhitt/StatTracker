import { T } from "../../utils/constants";
import { calcPoints } from "../../utils/stats";

export default function Header({ db, activePlayerId, setActivePlayer, view, stats }) {
  return (
    <div style={{
      background: "linear-gradient(160deg, #0e0e1c 0%, #16082a 100%)",
      padding: "env(safe-area-inset-top, 12px) 20px 14px",
      borderBottom: `1px solid ${T.border}`,
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 26 }}>🏀</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 19, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em" }}>StatTracker</div>
          <div style={{ fontSize: 10, color: T.orange, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase" }}>Game Log</div>
        </div>
        {db.players.length > 0 && (
          <select value={activePlayerId} onChange={e => setActivePlayer(e.target.value)} style={{
            width: "auto", minWidth: 90, padding: "6px 10px", fontSize: 13, fontWeight: 700,
            background: "rgba(255,255,255,0.08)", borderRadius: 20, textAlign: "center",
          }}>
            {db.players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
        {view === "tracker" && (
          <div style={{ background: "rgba(249,115,22,0.15)", border: `1px solid rgba(249,115,22,0.3)`, color: T.orange, borderRadius: 20, padding: "6px 16px", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 24, fontWeight: 900, color: "#fff" }}>{calcPoints(stats)}</span>
            <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.7 }}>PTS</span>
          </div>
        )}
      </div>
    </div>
  );
}
