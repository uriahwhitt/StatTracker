import { useState, useEffect, useRef } from "react";
import { T, circBtn } from "../../utils/constants";
import { fmtGameDate } from "../../utils/dates";
import { deriveTeamStats, deriveOpponentStats } from "../../utils/scorebookEngine";
import { clearLiveGame } from "../../utils/liveGame";
import { claimLock, breakLock, subscribeAllLocks } from "../../utils/scorekeeperLock";
import GameSetup from "./GameSetup";
import LiveScorebook from "./LiveScorebook";
import SectionLabel from "../common/SectionLabel";

const LOCK_STALE_MS = 15 * 60 * 1000; // 15 minutes

export default function ScorebookView({ db, updateDb, onLiveChange, user, userRole }) {
  const [mode, setMode] = useState("list"); // "list" | "setup" | "live"
  const [activeGameId, setActiveGameId] = useState(null);
  const [initialGame, setInitialGame] = useState(null); // pre-loaded from scheduled game
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmStartGame, setConfirmStartGame] = useState(null); // scheduled game awaiting lock-claim confirm
  const [lockDocs, setLockDocs] = useState({}); // { [gameId]: lockData }
  const pendingLockClaimRef = useRef(false); // set to true when "Start Keeping Score" is confirmed

  const orgId = userRole?.orgId || null;
  const isHCOrAbove = userRole?.role === "owner" || userRole?.role === "headcoach";

  // Subscribe to all active locks for this org
  useEffect(() => {
    if (!orgId) return;
    return subscribeAllLocks(orgId, setLockDocs);
  }, [orgId]);

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

    // Claim the scorekeeper lock if this was a "Start Keeping Score" entry
    if (pendingLockClaimRef.current && user) {
      const gameOrgId = db.teams?.find(t => t.id === game.teamId)?.orgId || orgId;
      if (gameOrgId) {
        claimLock(
          gameOrgId,
          game.id,
          user.uid,
          user.displayName || user.email || "Scorekeeper"
        ).catch(() => {});
      }
      pendingLockClaimRef.current = false;
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

  const handleBreakLock = (gameId, lockData) => {
    if (!orgId || !lockData) return;
    breakLock(
      orgId,
      gameId,
      user?.displayName || user?.email || "Head Coach",
      lockData.scorekeeperUid
    ).catch(() => {});
  };

  // Live scorebook takes over the full screen
  if (mode === "live" && activeGameId) {
    const activeGame = db.scorebookGames.find(g => g.id === activeGameId);
    const gameOrgId = db.teams?.find(t => t.id === activeGame?.teamId)?.orgId || null;
    return (
      <LiveScorebook
        db={db}
        updateDb={updateDb}
        gameId={activeGameId}
        onExit={exitGame}
        orgId={gameOrgId}
        user={user}
      />
    );
  }

  // Setup wizard
  if (mode === "setup") {
    return (
      <GameSetup
        db={db}
        initialGame={initialGame}
        onComplete={onSetupComplete}
        onCancel={() => { setMode("list"); setInitialGame(null); pendingLockClaimRef.current = false; }}
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
            const isMyGame = sg.scorekeeperId === user?.uid;
            const isAssignedToOther = sg.scorekeeperId && !isMyGame;

            return (
              <div key={sg.id} style={{
                background: isMyGame
                  ? "rgba(249,115,22,0.08)"
                  : "rgba(59,130,246,0.07)",
                border: `1px solid ${isMyGame ? "rgba(249,115,22,0.3)" : "rgba(59,130,246,0.2)"}`,
                borderRadius: 12, padding: "12px 16px", marginBottom: 8,
                cursor: isAssignedToOther && !isHCOrAbove ? "default" : "pointer",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>vs {sg.opponent}</div>
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
                      {team?.name && `${team.name} · `}{sg.gameDate || "No date"}
                    </div>
                  </div>

                  {/* CTA varies by assignment */}
                  {!sg.scorekeeperId && (
                    // No assignment — any coach can load
                    <div onClick={() => startNewGame(sg)} style={{ fontSize: 12, color: T.blue, fontWeight: 700 }}>LOAD ›</div>
                  )}
                  {isMyGame && (
                    // This user is assigned — show Start Keeping Score
                    <button onClick={() => setConfirmStartGame(sg)} style={{
                      background: `linear-gradient(135deg, ${T.orange}, #ea580c)`,
                      color: "#fff", border: "none", borderRadius: 8,
                      padding: "6px 12px", fontSize: 12, fontWeight: 800, cursor: "pointer",
                    }}>
                      START KEEPING SCORE
                    </button>
                  )}
                  {isAssignedToOther && (
                    // Assigned to someone else
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                      <span style={{ fontSize: 11, color: "#555" }}>
                        🔒 {sg.scorekeeperName}
                      </span>
                      {isHCOrAbove && (
                        <button onClick={() => setConfirmStartGame(sg)} style={{
                          fontSize: 10, color: T.orange, background: "none",
                          border: "none", cursor: "pointer", padding: 0,
                        }}>
                          Take Over
                        </button>
                      )}
                    </div>
                  )}
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
            const lock = lockDocs[g.id];
            const lockIsStale = lock && (Date.now() - new Date(lock.lastActivity).getTime()) > LOCK_STALE_MS;
            const activeLock = lock && !lockIsStale;
            const isMyLock = activeLock && lock.scorekeeperUid === user?.uid;
            const isOthersLock = activeLock && !isMyLock;

            return (
              <div key={g.id} style={{
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
                borderRadius: 14, padding: "14px 16px", marginBottom: 10,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div
                    onClick={() => (!isOthersLock || isHCOrAbove) && resumeGame(g.id)}
                    style={{ flex: 1, cursor: isOthersLock && !isHCOrAbove ? "default" : "pointer" }}
                  >
                    <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>vs {g.opponent}</div>
                    <div style={{ fontSize: 12, color: "#444", marginTop: 2 }}>{fmtGameDate(g)}</div>
                    {isOthersLock && (
                      <div style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
                        🔒 Being scored by {lock.scorekeeperName}
                      </div>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      onClick={() => (!isOthersLock || isHCOrAbove) && resumeGame(g.id)}
                      style={{ textAlign: "right", cursor: isOthersLock && !isHCOrAbove ? "default" : "pointer" }}
                    >
                      <div style={{ fontFamily: "'DM Mono',monospace", fontSize: 22, fontWeight: 900, color: "#fff" }}>
                        {home.score} <span style={{ color: "#555" }}>-</span> {opp.score}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: isMyLock ? T.orange : T.green }}>
                        {isMyLock ? "CONTINUE SCORING" : isOthersLock ? "LOCKED" : "TAP TO RESUME"}
                      </div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {isOthersLock && isHCOrAbove && (
                        <button
                          onClick={() => handleBreakLock(g.id, lock)}
                          style={{ ...deleteBtn("rgba(239,68,68,0.15)"), fontSize: 10, color: T.red, border: `1px solid rgba(239,68,68,0.3)` }}
                        >
                          Break Lock
                        </button>
                      )}
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
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, color: g.status === "finalized" ? T.blue : T.orange, fontWeight: 600 }}>
                        {g.status === "finalized" ? "Finalized" : "Completed"}
                      </span>
                      {g.status === "finalized" && (() => {
                        const gameOrgId = db.teams?.find(t => t.id === g.teamId)?.orgId || null;
                        return gameOrgId ? (
                          <button onClick={() => clearLiveGame(gameOrgId).catch(() => {})} style={{
                            fontSize: 10, color: T.red, background: "none", border: "none", cursor: "pointer", padding: 0,
                          }}>
                            End Broadcast
                          </button>
                        ) : null;
                      })()}
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

      {/* ── "Start Keeping Score" confirm dialog ── */}
      {confirmStartGame && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        }} onClick={() => setConfirmStartGame(null)}>
          <div style={{
            background: "#111118", borderRadius: 20, padding: "24px 20px",
            width: "100%", maxWidth: 360,
          }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 8 }}>
              Claim Scorekeeper Lock
            </div>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 20, lineHeight: 1.5 }}>
              You're about to claim the scoring lock for <strong style={{ color: "#fff" }}>vs {confirmStartGame.opponent}</strong>.
              Other users will be blocked from scoring until you finish or the lock is released.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setConfirmStartGame(null)} style={{
                flex: 1, background: "rgba(255,255,255,0.06)", color: "#888",
                border: `1px solid ${T.border}`, borderRadius: 12, padding: "13px",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>Cancel</button>
              <button onClick={() => {
                pendingLockClaimRef.current = true;
                const game = confirmStartGame;
                setConfirmStartGame(null);
                startNewGame(game);
              }} style={{
                flex: 2, background: `linear-gradient(135deg, ${T.orange}, #ea580c)`,
                color: "#fff", border: "none", borderRadius: 12, padding: "13px",
                fontSize: 14, fontWeight: 800, cursor: "pointer",
              }}>Start Keeping Score</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const deleteBtn = (bg) => ({
  background: bg, border: "none", color: "#fff", borderRadius: 8,
  padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
});
