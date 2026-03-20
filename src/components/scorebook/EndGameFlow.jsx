import { useState } from "react";
import { T } from "../../utils/constants";
import {
  deriveBoxScore, deriveTeamStats, deriveOpponentStats,
  getActivatedPlayers,
} from "../../utils/scorebookEngine";
import BoxScoreTable from "./BoxScoreTable";

export default function EndGameFlow({ game, onFinalize, onCancel }) {
  const [confirmed, setConfirmed] = useState(false);

  const events = game.events || [];
  const boxScore = deriveBoxScore(events, game.roster);
  const teamStats = deriveTeamStats(events, game.format);
  const oppStats = deriveOpponentStats(events);
  const activatedPlayerIds = getActivatedPlayers(events, game.initialFive);

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.9)", zIndex: 60,
      overflowY: "auto",
    }}>
      <div style={{ padding: "20px 16px", maxWidth: 600, margin: "0 auto" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#fff", marginBottom: 4 }}>Game Over</div>
        <div style={{ fontSize: 14, color: "#666", marginBottom: 20 }}>vs {game.opponent} — {game.gameDate}</div>

        {/* Final Score */}
        <div style={{
          background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)",
          borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 20,
        }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 40, fontWeight: 900, color: "#fff" }}>
            {teamStats.score} <span style={{ color: "#444" }}>-</span> {oppStats.score}
          </div>
          <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>FINAL</div>
        </div>

        {/* Box Score */}
        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginBottom: 10 }}>Box Score</div>
        <BoxScoreTable boxScore={boxScore} activatedPlayerIds={activatedPlayerIds} />

        {/* Finalize */}
        <div style={{ marginTop: 24 }}>
          {!confirmed ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onCancel} style={{
                flex: 1, background: "rgba(255,255,255,0.06)", color: "#888",
                border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>Back to Game</button>
              <button onClick={() => setConfirmed(true)} style={{
                flex: 2, background: `linear-gradient(135deg, ${T.orange}, #ea580c)`,
                color: "#fff", border: "none", borderRadius: 12, padding: "14px",
                fontSize: 14, fontWeight: 800, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(249,115,22,0.3)",
              }}>Finalize Game</button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 13, color: T.orange, fontWeight: 600, marginBottom: 10, textAlign: "center" }}>
                This will generate individual stat records for {activatedPlayerIds.length} player{activatedPlayerIds.length !== 1 ? "s" : ""}.
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setConfirmed(false)} style={{
                  flex: 1, background: "rgba(255,255,255,0.06)", color: "#888",
                  border: `1px solid ${T.border}`, borderRadius: 12, padding: "14px",
                  fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>Cancel</button>
                <button onClick={onFinalize} style={{
                  flex: 2, background: `linear-gradient(135deg, ${T.green}, #16a34a)`,
                  color: "#fff", border: "none", borderRadius: 12, padding: "14px",
                  fontSize: 14, fontWeight: 800, cursor: "pointer",
                  boxShadow: "0 4px 16px rgba(34,197,94,0.3)",
                }}>Confirm & Generate Records</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
