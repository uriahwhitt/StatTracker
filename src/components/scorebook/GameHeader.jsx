import { useState } from "react";
import { T } from "../../utils/constants";

export default function GameHeader({
  periodLabel, period, maxPeriods,
  onSetPeriod,
  homeScore, awayScore,
  teamFouls, oppFouls,
  format,
  homeTimeouts,
  onUndo, onGroupSub, onEventLog, onEndGame,
  onTeamTechFoul, onHomeTimeout,
}) {
  const [periodSelectorOpen, setPeriodSelectorOpen] = useState(false);

  const btnStyle = (bg, border) => ({
    background: bg, border: border || "none", color: "#fff", borderRadius: 8,
    padding: "6px 10px", fontSize: 11, fontWeight: 800, cursor: "pointer",
    whiteSpace: "nowrap",
  });

  // Bonus badge logic — backward compat with old bonusThreshold/doubleBonusThreshold fields
  const getBonusState = (fouls) => {
    const dbl = format?.doubleBonusFoulLimit ?? format?.doubleBonusThreshold ?? format?.bonusThreshold ?? 10;
    if (fouls >= dbl) return "double";
    if (format?.singleBonusEnabled && format?.singleBonusFoulLimit && fouls >= format.singleBonusFoulLimit) return "single";
    return "none";
  };

  const homeBonusState = getBonusState(teamFouls || 0);
  const oppBonusState = getBonusState(oppFouls || 0);

  const homeFoulColor = homeBonusState === "double" ? T.red : homeBonusState === "single" ? "#F59E0B" : "#888";
  const oppFoulColor = oppBonusState === "double" ? T.red : oppBonusState === "single" ? "#F59E0B" : "#888";

  // Period selector pills
  const totalPeriods = maxPeriods || (format?.periodType === "quarter" ? 4 : 2);
  const periodPillLabels = format?.periodType === "quarter"
    ? Array.from({ length: totalPeriods }, (_, i) => `Q${i + 1}`)
    : Array.from({ length: totalPeriods }, (_, i) => `H${i + 1}`);

  // Fixed-height bonus badge slot — never causes layout shift
  const renderBonusBadge = (state) => (
    <div style={{ height: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {state === "double" && (
        <span style={{
          fontSize: 8, fontWeight: 800, color: T.red,
          background: "rgba(239,68,68,0.15)", borderRadius: 4,
          padding: "2px 4px", border: "1px solid rgba(239,68,68,0.3)",
        }}>DBL BONUS</span>
      )}
      {state === "single" && (
        <span style={{
          fontSize: 8, fontWeight: 800, color: "#F59E0B",
          background: "rgba(245,158,11,0.15)", borderRadius: 4,
          padding: "2px 4px", border: "1px solid rgba(245,158,11,0.3)",
        }}>BONUS</span>
      )}
    </div>
  );

  return (
    <div style={{
      background: "linear-gradient(160deg, #0e0e1c 0%, #16082a 100%)",
      padding: "env(safe-area-inset-top, 8px) 10px 8px",
      borderBottom: `1px solid ${T.border}`,
      flexShrink: 0,
    }}>
      {/* Row 1: Period pill + Score */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 6 }}>
        <button onClick={() => setPeriodSelectorOpen(o => !o)} style={{
          background: periodSelectorOpen ? "rgba(249,115,22,0.3)" : "rgba(249,115,22,0.15)",
          border: `1px solid ${periodSelectorOpen ? "rgba(249,115,22,0.7)" : "rgba(249,115,22,0.4)"}`,
          color: T.orange, borderRadius: 8, padding: "4px 10px",
          fontSize: 14, fontWeight: 900, cursor: "pointer",
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

      {/* Inline period selector (expands between score row and stats row) */}
      {periodSelectorOpen && (
        <div style={{
          display: "flex", gap: 8, justifyContent: "center",
          marginBottom: 8, padding: "4px 0",
        }}>
          {periodPillLabels.map((label, i) => {
            const p = i + 1;
            const isVisited = p < period;
            const isCurrent = p === period;
            const isFuture = p > period;
            return (
              <button key={p} onClick={() => {
                if (isFuture) return;
                onSetPeriod(p);
                setPeriodSelectorOpen(false);
              }} style={{
                padding: "8px 14px", borderRadius: 20, fontSize: 13, fontWeight: 800,
                cursor: isFuture ? "default" : "pointer",
                background: isCurrent
                  ? "rgba(249,115,22,0.25)"
                  : isVisited ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.3)",
                border: `1px solid ${isCurrent
                  ? "rgba(249,115,22,0.6)"
                  : isVisited ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)"}`,
                color: isCurrent ? T.orange : isVisited ? "#555" : "#2a2a3a",
                fontFamily: "'DM Mono',monospace",
              }}>{label}</button>
            );
          })}
        </div>
      )}

      {/* Stats row: Home fouls | Home TOs | divider | Opp fouls | Opp TOs */}
      <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 8 }}>
        {/* Home fouls */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>HOME PF</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 900, color: homeFoulColor, lineHeight: 1.1 }}>{teamFouls || 0}</div>
          {renderBonusBadge(homeBonusState)}
        </div>
        {/* Home TOs */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>HOME TO</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 900, color: "#888", lineHeight: 1.1 }}>{homeTimeouts?.homeRemaining ?? 0}</div>
          <div style={{ height: 16 }} />
        </div>
        {/* Divider */}
        <div style={{ width: 1, background: "rgba(255,255,255,0.08)", alignSelf: "stretch", margin: "0 6px" }} />
        {/* Opp fouls */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>OPP PF</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 900, color: oppFoulColor, lineHeight: 1.1 }}>{oppFouls || 0}</div>
          {renderBonusBadge(oppBonusState)}
        </div>
        {/* Opp TOs */}
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 9, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em" }}>OPP TO</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 900, color: "#888", lineHeight: 1.1 }}>{homeTimeouts?.awayRemaining ?? 0}</div>
          <div style={{ height: 16 }} />
        </div>
      </div>

      {/* Action buttons row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
        <button onClick={onUndo} style={btnStyle("rgba(239,68,68,0.4)", "1px solid rgba(239,68,68,0.6)")}>UNDO</button>
        <button onClick={onGroupSub} style={btnStyle("rgba(34,197,94,0.4)", "1px solid rgba(34,197,94,0.6)")}>SUB</button>
        <button onClick={onHomeTimeout} style={btnStyle("rgba(255,255,255,0.15)", `1px solid rgba(255,255,255,0.25)`)}>TO</button>
        <button onClick={onTeamTechFoul} style={btnStyle("rgba(239,68,68,0.25)", "1px solid rgba(239,68,68,0.45)")}>TF</button>
        <button onClick={onEventLog} style={btnStyle("rgba(255,255,255,0.15)", `1px solid rgba(255,255,255,0.25)`)}>LOG</button>
        <button onClick={onEndGame} style={btnStyle("rgba(239,68,68,0.25)", "1px solid rgba(239,68,68,0.45)")}>END</button>
      </div>
    </div>
  );
}
