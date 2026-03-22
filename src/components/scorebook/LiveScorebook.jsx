import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { T } from "../../utils/constants";
import {
  createEvent, derivePlayerStats, deriveTeamStats, deriveOpponentStats,
  deriveTimeouts, getActivePlayers, getActivatedPlayers, getCurrentPeriod,
  formatEventDescription, convertToIndividualGame,
} from "../../utils/scorebookEngine";
import useAutosave from "../../hooks/useAutosave";
import GameHeader from "./GameHeader";
import PlayerRow from "./PlayerRow";
import OpponentStrip from "./OpponentStrip";
import SubstitutionModal from "./SubstitutionModal";
import GroupSubModal from "./GroupSubModal";
import EventLogPanel from "./EventLogPanel";
import EndGameFlow from "./EndGameFlow";

export default function LiveScorebook({ db, updateDb, gameId, onExit }) {
  const initial = db.scorebookGames.find(g => g.id === gameId);
  const [game, setGame] = useState(initial);
  const [showSubFor, setShowSubFor] = useState(null);
  const [showGroupSub, setShowGroupSub] = useState(false);
  const [showEventLog, setShowEventLog] = useState(false);
  const [showEndGame, setShowEndGame] = useState(false);
  const [toast, setToast] = useState(null);
  const [assistMode, setAssistMode] = useState(null);
  const assistTimerRef = useRef(null);

  // Autosave
  useAutosave(db, game);

  // Derived state
  const events = game?.events || [];
  const period = useMemo(() => getCurrentPeriod(events), [events]);
  const activePlayers = useMemo(() => getActivePlayers(events, game?.initialFive || []), [events, game?.initialFive]);
  const teamStats = useMemo(() => deriveTeamStats(events, game?.format, period), [events, game?.format, period]);
  const oppStats = useMemo(() => deriveOpponentStats(events, game?.format, period), [events, game?.format, period]);
  const timeouts = useMemo(() => deriveTimeouts(events, game?.format, period), [events, game?.format, period]);
  const playerStats = useMemo(() => {
    const map = {};
    for (const pid of activePlayers) {
      map[pid] = derivePlayerStats(events, pid);
    }
    return map;
  }, [events, activePlayers]);

  if (!game) return <div style={{ color: "#555", padding: 40, textAlign: "center" }}>Game not found.</div>;

  const roster = game.roster || [];
  const getPlayer = (pid) => roster.find(r => r.playerId === pid) || { playerId: pid, name: "?", jerseyNumber: "?" };

  // ── Event dispatch ───────────────────────────────────────────────────────────
  const dispatch = useCallback((type, playerId = null, extras = {}) => {
    const evt = createEvent(type, period, playerId, extras);
    setGame(g => ({ ...g, events: [...g.events, evt] }));

    if (["2pt_made", "3pt_made"].includes(type) && playerId) {
      if (assistTimerRef.current) clearTimeout(assistTimerRef.current);
      setAssistMode({ scoringEventId: evt.id, scorerPlayerId: playerId });
      assistTimerRef.current = setTimeout(() => setAssistMode(null), 2000);
    }

    return evt;
  }, [period]);

  const recordAssist = useCallback((assistPlayerId) => {
    if (!assistMode) return;
    if (assistTimerRef.current) clearTimeout(assistTimerRef.current);
    const evt = createEvent("assist", period, assistPlayerId, { linkedEventId: assistMode.scoringEventId });
    setGame(g => ({ ...g, events: [...g.events, evt] }));
    setAssistMode(null);
  }, [assistMode, period]);

  const dismissAssist = useCallback(() => {
    if (assistTimerRef.current) clearTimeout(assistTimerRef.current);
    setAssistMode(null);
  }, []);

  // ── Undo ─────────────────────────────────────────────────────────────────────
  const undoLast = useCallback(() => {
    setGame(g => {
      const evts = [...g.events];
      for (let i = evts.length - 1; i >= 0; i--) {
        if (!evts[i].deleted) {
          evts[i] = { ...evts[i], deleted: true };
          showToast(`Undid: ${formatEventDescription(evts[i], roster)}`);
          if (evts[i].type === "substitution_out" || evts[i].type === "substitution_in") {
            const ts = evts[i].timestamp;
            for (let j = evts.length - 1; j >= 0; j--) {
              if (j !== i && !evts[j].deleted && evts[j].timestamp === ts &&
                (evts[j].type === "substitution_in" || evts[j].type === "substitution_out")) {
                evts[j] = { ...evts[j], deleted: true };
              }
            }
          }
          break;
        }
      }
      return { ...g, events: evts };
    });
  }, [roster]);

  const deleteEvent = useCallback((eventId) => {
    setGame(g => ({
      ...g,
      events: g.events.map(e => e.id === eventId ? { ...e, deleted: true } : e),
    }));
  }, []);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  // ── Substitution ─────────────────────────────────────────────────────────────
  const handleSingleSub = (outPlayerId, inPlayerId) => {
    const ts = new Date().toISOString();
    const evtOut = createEvent("substitution_out", period, outPlayerId, { replacedById: inPlayerId, timestamp: ts });
    const evtIn = createEvent("substitution_in", period, inPlayerId, { timestamp: ts });
    setGame(g => ({ ...g, events: [...g.events, evtOut, evtIn] }));
    setShowSubFor(null);
  };

  const handleGroupSub = (newFive) => {
    const ts = new Date().toISOString();
    const newEvents = [];
    const outPlayers = activePlayers.filter(p => !newFive.includes(p));
    const inPlayers = newFive.filter(p => !activePlayers.includes(p));
    for (let i = 0; i < outPlayers.length; i++) {
      const inP = inPlayers[i] || null;
      newEvents.push(createEvent("substitution_out", period, outPlayers[i], { replacedById: inP, timestamp: ts }));
      if (inP) newEvents.push(createEvent("substitution_in", period, inP, { timestamp: ts }));
    }
    setGame(g => ({ ...g, events: [...g.events, ...newEvents] }));
    setShowGroupSub(false);
  };

  // ── Period management ────────────────────────────────────────────────────────
  // Replaces advancePeriod — allows setting any period by dispatching period_change
  const handleSetPeriod = useCallback((n) => {
    const evt = createEvent("period_change", n);
    setGame(g => ({ ...g, events: [...g.events, evt] }));
  }, []);

  // ── End game ─────────────────────────────────────────────────────────────────
  const endGame = () => setShowEndGame(true);

  const finalizeGame = () => {
    const activatedPlayerIds = getActivatedPlayers(game.events, game.initialFive);
    const newIndividualGames = activatedPlayerIds.map(pid => convertToIndividualGame(game, pid));

    const finalized = {
      ...game,
      status: "finalized",
      finalizedAt: new Date().toISOString(),
      generatedGameIds: newIndividualGames.map(g => g.id),
    };

    const updatedTeams = db.teams.map(t =>
      t.id === game.teamId
        ? { ...t, tempRoster: game.roster.map(r => ({ playerId: r.playerId, jerseyNumber: r.jerseyNumber })) }
        : t
    );

    // Mark linked scheduled game as final if present
    const updatedScheduled = game.scheduledGameId
      ? (db.scheduledGames || []).map(sg =>
          sg.id === game.scheduledGameId ? { ...sg, status: "final" } : sg
        )
      : (db.scheduledGames || []);

    updateDb({
      ...db,
      games: [...newIndividualGames, ...db.games],
      scorebookGames: db.scorebookGames.map(g => g.id === gameId ? finalized : g),
      teams: updatedTeams,
      scheduledGames: updatedScheduled,
    });
    onExit();
  };

  const benchPlayers = roster.filter(r => !activePlayers.includes(r.playerId));

  const periodLabel = game.format.periodType === "quarter" ? `Q${period}` : `H${period}`;
  const maxPeriods = game.format.periods;

  return (
    <div style={{
      height: "100vh", background: T.bg, color: "#e0e0e0",
      fontFamily: "'DM Sans',sans-serif", display: "flex", flexDirection: "column",
      overflow: "hidden", overscrollBehavior: "none", touchAction: "pan-y",
    }}>
      {/* Game Header */}
      <GameHeader
        periodLabel={periodLabel}
        period={period}
        maxPeriods={maxPeriods}
        onSetPeriod={handleSetPeriod}
        homeScore={teamStats.score}
        awayScore={oppStats.score}
        teamFouls={teamStats.teamFouls}
        oppFouls={oppStats.fouls}
        format={game.format}
        homeTimeouts={timeouts}
        onUndo={undoLast}
        onGroupSub={() => setShowGroupSub(true)}
        onEventLog={() => setShowEventLog(true)}
        onEndGame={endGame}
        onTeamTechFoul={() => dispatch("team_tech_foul")}
        onHomeTimeout={() => dispatch("timeout_home")}
      />

      {/* Active Player Rows */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 8px", WebkitOverflowScrolling: "touch" }}>
        {activePlayers.map(pid => {
          const player = getPlayer(pid);
          const stats = playerStats[pid] || {};
          return (
            <PlayerRow
              key={pid}
              player={player}
              stats={stats}
              foulsToDisqualify={game.format.foulsToDisqualify}
              onStat={(type) => dispatch(type, pid)}
              onSub={() => setShowSubFor(pid)}
              assistMode={assistMode}
              onAssist={() => recordAssist(pid)}
              onDismissAssist={dismissAssist}
            />
          );
        })}
      </div>

      {/* Opponent Strip */}
      <OpponentStrip
        opponent={game.opponent}
        onScore={(pts) => dispatch(`opp_score_${pts}`)}
        onFoul={() => dispatch("opp_foul")}
        onTechFoul={() => dispatch("opp_tech_foul")}
        onTimeout={() => dispatch("timeout_away")}
      />

      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
          background: "rgba(0,0,0,0.85)", color: "#fff", padding: "8px 20px",
          borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 100,
          border: `1px solid ${T.border}`,
        }}>{toast}</div>
      )}

      {/* Modals */}
      {showSubFor && (
        <SubstitutionModal
          outPlayer={getPlayer(showSubFor)}
          benchPlayers={benchPlayers}
          onSelect={(inPid) => handleSingleSub(showSubFor, inPid)}
          onClose={() => setShowSubFor(null)}
        />
      )}

      {showGroupSub && (
        <GroupSubModal
          roster={roster}
          activePlayers={activePlayers}
          onConfirm={handleGroupSub}
          onClose={() => setShowGroupSub(false)}
        />
      )}

      {showEventLog && (
        <EventLogPanel
          events={events}
          roster={roster}
          format={game.format}
          onDelete={deleteEvent}
          onClose={() => setShowEventLog(false)}
        />
      )}

      {showEndGame && (
        <EndGameFlow
          game={game}
          onFinalize={finalizeGame}
          onCancel={() => setShowEndGame(false)}
        />
      )}
    </div>
  );
}
