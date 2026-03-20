import { T } from "../../utils/constants";

export default function GameHeader({
  periodLabel, period, maxPeriods, onAdvancePeriod,
  homeScore, awayScore, teamFouls, bonusThreshold, doubleBonusThreshold,
  homeTimeouts, onUndo, onGroupSub, onEventLog, onEndGame,
  onTeamTechFoul, onHomeTimeout,
}) {
  const foulColor = teamFouls >= doubleBonusThreshold ? T.red
    : teamFouls >= bonusThreshold ? "#F59E0B" : "#888";

  const canAdvance = period < maxPeriods;

  const btnStyle = (bg, border) => ({
    background: bg, border: border || "none", color: "#fff", borderRadius: 8,
    padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer",
    whiteSpace: "nowrap",
  });

  return (
    <div style={{
      background: "linear-gradient(160deg, #0e0e1c 0%, #16082a 100%)",
      padding: "env(safe-area-inset-top, 8px) 10px 8px",
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0,
    }}>
      {/* Row 1: Score */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 6 }}>
        <button onClick={canAdvance ? onAdvancePeriod : undefined} style={{
          background: canAdvance ? "rgba(249,115,22,0.2)" : "rgba(255,255,255,0.05)",
          border: `1px solid ${canAdvance ? "rgba(249,115,22,0.5)" : T.border}`,
          color: canAdvance ? T.orange : "#555",
          borderRadius: 8, padding: "4px 10px",
          fontSize: 14, fontWeight: 900, cursor: canAdvance ? "pointer" : "default",
          fontFamily: "'DM Mono',monospace",
        }}>{periodLabel}</button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>HOME</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 900, color: "#fff" }}>{homeScore}</span>
          <span style={{ fontSize: 20, color: "#333" }}>-</span>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 28, fontWeight: 900, color: "#fff" }}>{awayScore}</span>
          <span style={{ fontSize: 11, color: "#666", fontWeight: 700 }}>AWAY</span>
        </div>
      </div>

      {/* Row 2: Info + Actions */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: foulColor, fontWeight: 700 }}>
            FOULS: <span style={{ fontSize: 14, fontFamily: "'DM Mono',monospace" }}>{teamFouls}</span>
            {teamFouls >= doubleBonusThreshold ? " 2x BONUS" : teamFouls >= bonusThreshold ? " BONUS" : ""}
          </span>
          <span style={{ fontSize: 10, color: "#555" }}>
            TOs: {Array.from({ length: homeTimeouts.homeRemaining }, () => "●").join("")}
            {Array.from({ length: homeTimeouts.homeUsed }, () => "○").join("")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onUndo} style={btnStyle("rgba(239,68,68,0.4)", "1px solid rgba(239,68,68,0.6)")}>UNDO</button>
          <button onClick={onGroupSub} style={btnStyle("rgba(34,197,94,0.4)", "1px solid rgba(34,197,94,0.6)")}>SUB</button>
          <button onClick={onHomeTimeout} style={btnStyle("rgba(255,255,255,0.15)", `1px solid rgba(255,255,255,0.25)`)}>TO</button>
          <button onClick={onTeamTechFoul} style={btnStyle("rgba(239,68,68,0.25)", "1px solid rgba(239,68,68,0.45)")}>TF</button>
          <button onClick={onEventLog} style={btnStyle("rgba(255,255,255,0.15)", `1px solid rgba(255,255,255,0.25)`)}>LOG</button>
          <button onClick={onEndGame} style={btnStyle("rgba(239,68,68,0.25)", "1px solid rgba(239,68,68,0.45)")}>END</button>
        </div>
      </div>
    </div>
  );
}
