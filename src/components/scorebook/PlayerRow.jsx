import { useState, useRef, useCallback } from "react";
import { T } from "../../utils/constants";

const flashLabels = {
  "2pt_made": "+2", "2pt_missed": "MISS", "3pt_made": "+3", "3pt_missed": "MISS",
  "ft_made": "+1", "ft_missed": "MISS", "oreb": "+OR", "dreb": "+DR",
  "assist": "+AST", "steal": "+STL", "block": "+BLK",
  "turnover": "+TO", "personal_foul": "+PF", "technical_foul": "+TF",
};
const flashColors = {
  "2pt_made": T.green, "3pt_made": T.green, "ft_made": T.green,
  "2pt_missed": T.red, "3pt_missed": T.red, "ft_missed": T.red,
  "oreb": T.blue, "dreb": T.blue, "assist": T.blue, "steal": T.blue, "block": T.blue,
  "turnover": T.orange, "personal_foul": "#F59E0B", "technical_foul": T.red,
};

function FB({ label, bg, border, onClick, span }) {
  const [flash, setFlash] = useState(false);
  const t = useRef(null);
  const handle = useCallback(() => {
    onClick();
    setFlash(true);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setFlash(false), 300);
  }, [onClick]);
  return (
    <button onClick={handle} style={{
      gridColumn: span || "auto",
      background: flash ? "#fff" : bg, border: `1px solid ${flash ? "#fff" : border}`,
      color: flash ? "#000" : "#fff", fontWeight: 800, borderRadius: 8,
      padding: "8px 0", fontSize: 11, cursor: "pointer", minHeight: 40,
      display: "flex", alignItems: "center", justifyContent: "center",
      WebkitTapHighlightColor: "transparent", transition: "all 0.15s ease-out",
      width: "100%",
    }}>{label}</button>
  );
}

function Counter({ val, label }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: 40, lineHeight: 1,
    }}>
      <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 13, fontWeight: 900, color: "#aaa" }}>{val}</span>
      <span style={{ fontSize: 7, fontWeight: 700, color: "#444", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
    </div>
  );
}

export default function PlayerRow({
  player, stats, foulsToDisqualify, onStat, onSub,
  assistMode, onAssist, onDismissAssist,
}) {
  const [popup, setPopup] = useState(null);
  const popupTimer = useRef(null);

  const pf = stats.foul || 0;
  const tf = stats.techFoul || 0;
  const isFouledOut = pf >= foulsToDisqualify || tf >= 2;
  const foulWarning = pf >= foulsToDisqualify - 2 || tf >= 1;
  const foulColor = isFouledOut ? T.red : foulWarning ? "#F59E0B" : "#888";

  const isInAssistMode = assistMode !== null;
  const isScorer = assistMode?.scorerPlayerId === player.playerId;
  const canAssist = isInAssistMode && !isScorer;

  const handleStat = useCallback((type) => {
    onStat(type);
    setPopup({ label: flashLabels[type] || "+1", color: flashColors[type] || "#fff" });
    if (popupTimer.current) clearTimeout(popupTimer.current);
    popupTimer.current = setTimeout(() => setPopup(null), 600);
  }, [onStat]);

  const s = stats;
  const reb = (s.oreb || 0) + (s.dreb || 0);

  return (
    <div style={{
      background: isFouledOut ? "rgba(239,68,68,0.06)" : T.card,
      border: `1px solid ${isFouledOut ? "rgba(239,68,68,0.2)" : T.border}`,
      borderRadius: 14, padding: "8px 10px", marginBottom: 6, userSelect: "none",
      position: "relative",
    }}>
      {popup && (
        <div style={{
          position: "absolute", top: 4, right: 50, zIndex: 5,
          background: popup.color, color: "#fff", fontWeight: 900,
          fontSize: 16, fontFamily: "'DM Mono',monospace",
          padding: "2px 12px", borderRadius: 8,
          animation: "fadeUp 0.6s ease-out forwards",
          pointerEvents: "none",
        }}>{popup.label}</div>
      )}

      {/* Player identity row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <button onClick={onSub} style={{
          background: "rgba(34,197,94,0.3)", border: "1px solid rgba(34,197,94,0.6)",
          color: "#fff", borderRadius: 6, padding: "4px 8px", fontSize: 10, fontWeight: 800,
          cursor: "pointer", flexShrink: 0,
        }}>SUB</button>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 16, fontWeight: 900, color: T.orange, minWidth: 32 }}>#{player.jerseyNumber}</span>
        <span style={{ fontWeight: 700, color: "#fff", fontSize: 14, flex: 1 }}>{player.name}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: foulColor, fontFamily: "'DM Mono',monospace", whiteSpace: "nowrap" }}>
          {pf}PF{tf > 0 && `/${tf}TF`}
        </span>
        <span style={{ fontFamily: "'DM Mono',monospace", fontSize: 18, fontWeight: 900, color: T.orange, minWidth: 32, textAlign: "right" }}>{s.points || 0}</span>
      </div>

      {/* Assist mode: scorer gets NO ASSIST cancel, others get AST button */}
      {canAssist && (
        <button onClick={onAssist} style={{
          width: "100%", background: "rgba(34,197,94,0.35)", border: "2px solid rgba(34,197,94,0.7)",
          color: "#fff", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 800,
          cursor: "pointer", marginBottom: 6,
        }}>ASSIST</button>
      )}
      {isInAssistMode && isScorer && (
        <button onClick={onDismissAssist} style={{
          width: "100%", background: "rgba(239,68,68,0.3)", border: "2px solid rgba(239,68,68,0.55)",
          color: "#fff", borderRadius: 10, padding: "12px", fontSize: 14, fontWeight: 800,
          cursor: "pointer", marginBottom: 6,
        }}>NO ASSIST</button>
      )}

      {/* Stat buttons — 3 rows using consistent 8-col grid
       *  Cols: [1][2] [3][4] [5] | [6][7][8]
       *  Proportions: 5 button cols at 1fr + 3 counter cols at 0.55fr
       *  Row 1: 2PT✓  2PT✗  AST(span 3-4)  PF   | AST  REB  STL
       *  Row 2: 3PT✓  3PT✗  OR       DR     TF   | BLK  T/O  PF
       *  Row 3: FT✓   FT✗   STL      BLK    TO   |
       */}
      {(!isInAssistMode || isScorer) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Row 1 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 0.55fr 0.55fr 0.55fr", gap: 3, alignItems: "stretch" }}>
            <FB label="2PT ✓" bg="rgba(34,197,94,0.35)" border="rgba(34,197,94,0.65)" onClick={() => handleStat("2pt_made")} />
            <FB label="2PT ✗" bg="rgba(239,68,68,0.3)" border="rgba(239,68,68,0.55)" onClick={() => handleStat("2pt_missed")} />
            <FB label="AST" bg="rgba(59,130,246,0.3)" border="rgba(59,130,246,0.55)" onClick={() => handleStat("assist")} span="3 / 5" />
            <FB label="PF" bg="rgba(245,158,11,0.3)" border="rgba(245,158,11,0.55)" onClick={() => handleStat("personal_foul")} />
            <Counter val={s.ast || 0} label="AST" />
            <Counter val={reb} label="REB" />
            <Counter val={s.stl || 0} label="STL" />
          </div>
          {/* Row 2 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 0.55fr 0.55fr 0.55fr", gap: 3, alignItems: "stretch" }}>
            <FB label="3PT ✓" bg="rgba(34,197,94,0.35)" border="rgba(34,197,94,0.65)" onClick={() => handleStat("3pt_made")} />
            <FB label="3PT ✗" bg="rgba(239,68,68,0.3)" border="rgba(239,68,68,0.55)" onClick={() => handleStat("3pt_missed")} />
            <FB label="OR" bg="rgba(59,130,246,0.3)" border="rgba(59,130,246,0.55)" onClick={() => handleStat("oreb")} />
            <FB label="DR" bg="rgba(59,130,246,0.3)" border="rgba(59,130,246,0.55)" onClick={() => handleStat("dreb")} />
            <FB label="TF" bg="rgba(239,68,68,0.25)" border="rgba(239,68,68,0.5)" onClick={() => handleStat("technical_foul")} />
            <Counter val={s.blk || 0} label="BLK" />
            <Counter val={s.tov || 0} label="T/O" />
            <Counter val={pf} label="PF" />
          </div>
          {/* Row 3 */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 0.55fr 0.55fr 0.55fr", gap: 3, alignItems: "stretch" }}>
            <FB label="FT ✓" bg="rgba(34,197,94,0.35)" border="rgba(34,197,94,0.65)" onClick={() => handleStat("ft_made")} />
            <FB label="FT ✗" bg="rgba(239,68,68,0.3)" border="rgba(239,68,68,0.55)" onClick={() => handleStat("ft_missed")} />
            <FB label="STL" bg="rgba(59,130,246,0.3)" border="rgba(59,130,246,0.55)" onClick={() => handleStat("steal")} />
            <FB label="BLK" bg="rgba(59,130,246,0.3)" border="rgba(59,130,246,0.55)" onClick={() => handleStat("block")} />
            <FB label="TO" bg="rgba(249,115,22,0.3)" border="rgba(249,115,22,0.55)" onClick={() => handleStat("turnover")} />
            <div /><div /><div />
          </div>
        </div>
      )}
    </div>
  );
}
