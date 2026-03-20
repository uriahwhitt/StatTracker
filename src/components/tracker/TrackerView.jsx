import { T, circBtn } from "../../utils/constants";
import { pct } from "../../utils/stats";
import ShotCard from "../common/ShotCard";
import CountCard from "../common/CountCard";
import SectionLabel from "../common/SectionLabel";

export default function TrackerView({
  db, activePlayerId, stats, adj, shotHandlers,
  opponent, setOpponent, gameDateInput, setGameDateInput,
  tournamentId, setTournamentId,
  editingGameId, cancelEdit, saveGame, saveMsg,
  confirmReset, setConfirmReset, setStats, defaultStats,
  newPlayerName, setNewPlayerName, addPlayer,
}) {
  return (
    <div>
      {db.players.length === 0 && (
        <div style={{ marginTop: 16, background: "rgba(249,115,22,0.08)", border: `1px solid rgba(249,115,22,0.2)`, borderRadius: 14, padding: "16px" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T.orange, marginBottom: 8 }}>Add a player to get started</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input placeholder="Player name…" value={newPlayerName} onChange={e => setNewPlayerName(e.target.value)} onKeyDown={e => e.key === "Enter" && addPlayer()} />
            <button onClick={addPlayer} style={{ ...circBtn(T.orange, 46), borderRadius: 10, flexShrink: 0, fontSize: 22 }}>+</button>
          </div>
        </div>
      )}

      {db.players.length > 0 && (
        <>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <input placeholder="vs. Opponent…" value={opponent} onChange={e => setOpponent(e.target.value)} />
            <select value={tournamentId} onChange={e => setTournamentId(e.target.value)} style={{ width: "auto", minWidth: 130, flexShrink: 0 }}>
              <option value="">No Tourney</option>
              {db.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 8 }}>
            <input type="date" value={gameDateInput} onChange={e => setGameDateInput(e.target.value)} style={{ fontSize: 14 }} />
          </div>

          <SectionLabel label="Scoring" color={T.orange} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
            <ShotCard label="2PT" made={stats.pts2} att={stats.pts2a} accent={T.orange} {...shotHandlers("pts2", "pts2a")} />
            <ShotCard label="3PT" made={stats.pts3} att={stats.pts3a} accent="#a855f7" {...shotHandlers("pts3", "pts3a")} />
            <ShotCard label="FT" made={stats.ft} att={stats.fta} accent={T.green} {...shotHandlers("ft", "fta")} />
          </div>

          <div style={{ marginTop: 10, background: "rgba(255,255,255,0.03)", borderRadius: 12, padding: "10px 14px", display: "flex", justifyContent: "space-around" }}>
            {[
              ["FG%", stats.pts2 + stats.pts3, stats.pts2a + stats.pts3a, T.orange],
              ["3P%", stats.pts3, stats.pts3a, "#a855f7"],
              ["FT%", stats.ft, stats.fta, T.green],
            ].map(([lbl, m, a, accent]) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <div style={{ fontSize: 20, fontWeight: 900, fontFamily: "'DM Mono',monospace", color: accent }}>{pct(m, a)}</div>
                <div style={{ fontSize: 10, color: "#555", textTransform: "uppercase", letterSpacing: "0.08em" }}>{lbl}</div>
              </div>
            ))}
          </div>

          <SectionLabel label="Boards & Playmaking" color={T.green} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
            {[["Off Reb", "oreb"], ["Def Reb", "dreb"], ["Assists", "ast"]].map(([lbl, key]) => (
              <CountCard key={key} label={lbl} value={stats[key]} accent={T.green} onAdd={() => adj({ [key]: 1 })} onSub={() => adj({ [key]: -1 })} />
            ))}
          </div>

          <SectionLabel label="Defense & Misc" color={T.blue} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {[["Steals", "stl", T.blue], ["Blocks", "blk", T.blue], ["TO", "tov", "#888"], ["Fouls", "foul", "#888"]].map(([lbl, key, accent]) => (
              <CountCard key={key} label={lbl} value={stats[key]} accent={accent} onAdd={() => adj({ [key]: 1 })} onSub={() => adj({ [key]: -1 })} />
            ))}
          </div>

          {editingGameId && (
            <div style={{ marginTop: 16, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>Editing game vs {opponent}</span>
              <button onClick={cancelEdit} style={{ background: "transparent", border: "1px solid #333", color: "#666", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
            </div>
          )}

          <button onClick={saveGame} style={{
            marginTop: editingGameId ? 10 : 20, width: "100%",
            background: editingGameId ? `linear-gradient(135deg, ${T.blue}, #2563eb)` : `linear-gradient(135deg, ${T.orange}, #ea580c)`,
            color: "#fff", border: "none", borderRadius: 14, padding: "16px",
            fontSize: 17, fontWeight: 800, cursor: "pointer", letterSpacing: "-0.01em",
            boxShadow: editingGameId ? "0 4px 20px rgba(59,130,246,0.3)" : "0 4px 20px rgba(249,115,22,0.3)",
          }}>{saveMsg || (editingGameId ? "Update Game" : "Save Game")}</button>

          {!editingGameId && (
            !confirmReset
              ? <button onClick={() => setConfirmReset(true)} style={{ marginTop: 10, width: "100%", background: "transparent", color: "#444", border: "1px solid #1e1e1e", borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Reset Stats</button>
              : <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button onClick={() => { setStats(defaultStats()); setConfirmReset(false); }} style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: T.red, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Confirm Reset</button>
                <button onClick={() => setConfirmReset(false)} style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #222", borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
              </div>
          )}
          <div style={{ height: 8 }} />
        </>
      )}
    </div>
  );
}
