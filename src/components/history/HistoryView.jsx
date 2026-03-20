import { T, backBtn } from "../../utils/constants";
import { fmtGameDate } from "../../utils/dates";
import StatSummary from "../common/StatSummary";

export default function HistoryView({
  db, playerGames, activePlayer,
  selectedGame, setSelectedGame,
  editGame, updateGameTournament,
  confirmDelete, setConfirmDelete, confirmAndDelete,
}) {
  // Game list
  if (!selectedGame) {
    return (
      <div style={{ marginTop: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 14 }}>
          {activePlayer?.name ? `${activePlayer.name}'s Games` : "All Games"} <span style={{ color: "#444", fontWeight: 400, fontSize: 14 }}>({playerGames.length})</span>
        </div>
        {playerGames.length === 0 && (
          <div style={{ color: "#333", textAlign: "center", marginTop: 70, fontSize: 15 }}>No games saved yet.<br />Track your first game! 🏀</div>
        )}
        {playerGames.map(g => {
          const t = db.tournaments.find(x => x.id === g.tournamentId);
          const reb = (g.stats.oreb || 0) + (g.stats.dreb || 0);
          return (
            <div key={g.id} onClick={() => setSelectedGame(g)} style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>vs {g.opponent}</div>
                  <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>{fmtGameDate(g)}</div>
                  {t && <div style={{ fontSize: 11, color: T.orange, marginTop: 3, fontWeight: 600 }}>🏆 {t.name}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 30, fontWeight: 900, color: T.orange, fontFamily: "'DM Mono',monospace", lineHeight: 1 }}>{g.points}</div>
                  <div style={{ fontSize: 10, color: "#444", textTransform: "uppercase" }}>pts</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                {[
                  [`${g.stats.pts2}/${g.stats.pts2a}`, "2PT", T.orange],
                  [`${g.stats.pts3}/${g.stats.pts3a}`, "3PT", "#a855f7"],
                  [`${g.stats.ft}/${g.stats.fta}`, "FT", T.green],
                  [reb, "REB", T.green],
                  [g.stats.ast, "AST", T.blue],
                ].map(([val, lbl, col]) => (
                  <div key={lbl} style={{ textAlign: "center" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: col, fontFamily: "'DM Mono',monospace" }}>{val}</div>
                    <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase" }}>{lbl}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Game detail
  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setSelectedGame(null)} style={backBtn}>← All Games</button>
      <div style={{ fontWeight: 900, fontSize: 22, color: "#fff", marginTop: 4 }}>vs {selectedGame.opponent}</div>
      <div style={{ fontSize: 12, color: "#444", marginBottom: 12 }}>{fmtGameDate(selectedGame)}</div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#555", marginBottom: 4, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>Tournament</div>
        <select value={selectedGame.tournamentId || ""} onChange={e => updateGameTournament(selectedGame.id, e.target.value)} style={{ fontSize: 14 }}>
          <option value="">No Tournament</option>
          {db.tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <StatSummary stats={selectedGame.stats} points={selectedGame.points} />
      <button onClick={() => editGame(selectedGame)} style={{
        marginTop: 16, width: "100%",
        background: `linear-gradient(135deg, ${T.blue}, #2563eb)`,
        color: "#fff", border: "none", borderRadius: 14, padding: "12px",
        fontSize: 14, fontWeight: 700, cursor: "pointer",
      }}>Edit Game</button>
      {confirmDelete?.type === "game" && confirmDelete.id === selectedGame.id ? (
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={confirmAndDelete} style={{ flex: 1, background: "rgba(239,68,68,0.15)", color: T.red, border: "1px solid rgba(239,68,68,0.3)", borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Confirm Delete</button>
          <button onClick={() => setConfirmDelete(null)} style={{ flex: 1, background: "transparent", color: "#555", border: "1px solid #222", borderRadius: 14, padding: "12px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Cancel</button>
        </div>
      ) : (
        <button onClick={() => setConfirmDelete({ type: "game", id: selectedGame.id, label: `vs ${selectedGame.opponent}` })} style={{
          marginTop: 8, width: "100%", background: "rgba(239,68,68,0.08)", color: T.red,
          border: "1px solid rgba(239,68,68,0.25)", borderRadius: 14, padding: "12px",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
        }}>Delete Game</button>
      )}
    </div>
  );
}
