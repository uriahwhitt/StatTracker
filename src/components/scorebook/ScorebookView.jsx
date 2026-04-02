import { useState, useEffect } from "react";
import { T, circBtn } from "../../utils/constants";
import { fmtGameDate } from "../../utils/dates";
import { deriveTeamStats, deriveOpponentStats } from "../../utils/scorebookEngine";
import GameSetup from "./GameSetup";
import LiveScorebook from "./LiveScorebook";
import SectionLabel from "../common/SectionLabel";

export default function ScorebookView({ db, updateDb, onLiveChange }) {
  const [mode, setMode] = useState("list"); // "list" | "setup" | "live"
  const [activeGameId, setActiveGameId] = useState(null);
  const [initialGame, setInitialGame] = useState(null); // pre-loaded from scheduled game
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // Notify parent when live state changes
  useEffect(() => { onLiveChange?.(mode === "live"); }, [mode]);

  const startNewGame = (preload = null) => {
    setInitialGame(preload);
    setMode("setup");
  };

  const onSetupComplete = (game) => {
    const newDb = { ...db, scorebookGames: [...db.scorebookGames, game] };

    // If loaded from a scheduled game, mark it as live
    if (game.scheduledGameId) {
      const updatedScheduled = (db.scheduledGames || []).map(sg =>
        sg.id === game.scheduledGameId ? { ...sg, status: "live" } : sg
      );
      updateDb({ ...newDb, scheduledGames: updatedScheduled });
    } else {
      updateDb(newDb);
    }

    setActiveGameId(game.id);
    setMode("live");
  };

  const resumeGame = (gameId) => {
    setActiveGameId(gameId);
    setMode("live");
  };

  const exitGame = () => {
    setActiveGameId(null);
    setMode("list");
    setInitialGame(null);
  };

  const deleteGame = (gameId) => {
    const game = db.scorebookGames.find(g => g.id === gameId);
    let newDb = { ...db, scorebookGames: db.scorebookGames.filter(g => g.id !== gameId) };
    // If linked to a scheduled game, reset it back to "scheduled"
    if (game?.scheduledGameId) {
      newDb.scheduledGames = (db.scheduledGames || []).map(sg =>
        sg.id === game.scheduledGameId ? { ...sg, status: "scheduled" } : sg
      );
    }
    updateDb(newDb);
    setConfirmDeleteId(null);
  };

  // Live scorebook takes over the full screen
  if (mode === "live" && activeGameId) {
    const activeGame = db.scorebookGames.find(g => g.id === activeGameId);
    const orgId = db.teams?.find(t => t.id === activeGame?.teamId)?.orgId || null;
    return <LiveScorebook db={db} updateDb={updateDb} gameId={activeGameId} onExit={exitGame} orgId={orgId} />;
  }

  // Setup wizard
  if (mode === "setup") {
    return (
      <GameSetup
        db={db}
        initialGame={initialGame}
        onComplete={onSetupComplete}
        onCancel={() => { setMode("list"); setInitialGame(null); }}
      />
    );
  }

  // Game list
  const games = db.scorebookGames || [];
  const liveGames = games.filter(g => g.status === "live");
  const completedGames = games.filter(g => g.status === "completed" || g.status === "finalized");
  const upcomingScheduled = (db.scheduledGames || []).filter(g => g.status === "scheduled");

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>Scorebook</div>
        <button onClick={() => startNewGame()} style={{
          background: `linear-gradient(135deg, ${T.orange}, #ea580c)`,
          color: "#fff", border: "none", borderRadius: 10, padding: "10px 20px",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
          boxShadow: "0 4px 16px rgba(249,115,22,0.3)",
        }}>+ New Game</button>
      </div>

      {/* ── Load from schedule ── */}
      {upcomingScheduled.length > 0 && (
        <>
          <SectionLabel label="Load from Schedule" color={T.blue} />
          {upcomingScheduled.map(sg => {
            const team = db.teams.find(t => t.id === sg.homeTeamId || t.id === sg.teamId);
            return (
              <div key={sg.id} onClick={() => startNewGame(sg)} style={{
                background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.2)",
                borderRadius: 12, padding: "12px 16px", marginBottom: 8, cursor: "pointer",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>vs {sg.opponent}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                      {team?.name && `${team.name} · `}{sg.gameDate || "No date"}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.blue, fontWeight: 700 }}>LOAD ›</div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {liveGames.length > 0 && (
        <>
          <SectionLabel label="In Progress" color={T.green} />
          {liveGames.map(g => {
            const home = deriveTeamStats(g.events, g.format);
            const opp = deriveOpponentStats(g.events);
            const isConfirming = confirmDeleteId === g.id;
            return (
              <div key={g.id} style={{
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: 14, padding: "14px 16px", marginBottom: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div onClick={() => resumeGame(g.id)} style={{ flex: 1, cursor: "pointer" }}>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>vs {g.opponent}</div>
                    <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>{fmtGameDate(g)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div onClick={() => resumeGame(g.id)} style={{ textAlign: "right", cursor: "pointer" }}>
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 900, color: "#fff" }}>
                        {home.score} <span style={{ color: "#555" }}>-</span> {opp.score}
                      </div>
                      <div style={{ fontSize: 11, color: T.green, fontWeight: 700 }}>TAP TO RESUME</div>
                    </div>
                    {isConfirming ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => deleteGame(g.id)} style={deleteBtn(T.red)}>Delete</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={deleteBtn("#444")}>✕</button>
                      </div>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setConfirmDeleteId(g.id); }} style={deleteBtn("rgba(239,68,68,0.2)")}>🗑</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {completedGames.length > 0 && (
        <>
          <SectionLabel label="Completed" color={T.blue} />
          {completedGames.map(g => {
            const home = deriveTeamStats(g.events, g.format);
            const opp = deriveOpponentStats(g.events);
            const isConfirming = confirmDeleteId === g.id;
            return (
              <div key={g.id} style={{
                background: T.card, border: `1px solid ${T.border}`,
                borderRadius: 14, padding: "14px 16px", marginBottom: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>vs {g.opponent}</div>
                    <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>{fmtGameDate(g)}</div>
                    <div style={{ fontSize: 11, color: g.status === "finalized" ? T.blue : T.orange, marginTop: 2, fontWeight: 600 }}>
                      {g.status === "finalized" ? "Finalized" : "Completed"}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 900, color: "#fff" }}>
                      {home.score} <span style={{ color: "#555" }}>-</span> {opp.score}
                    </div>
                    {isConfirming ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => deleteGame(g.id)} style={deleteBtn(T.red)}>Delete</button>
                        <button onClick={() => setConfirmDeleteId(null)} style={deleteBtn("#444")}>✕</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(g.id)} style={deleteBtn("rgba(239,68,68,0.2)")}>🗑</button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </>
      )}

      {games.length === 0 && upcomingScheduled.length === 0 && (
        <div style={{ color: "#333", textAlign: "center", marginTop: 70, fontSize: 15 }}>
          No scorebook games yet.<br />Tap + New Game to start! 📋
        </div>
      )}
    </div>
  );
}

const deleteBtn = (bg) => ({
  background: bg, border: "none", color: "#fff", borderRadius: 8,
  padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
});
