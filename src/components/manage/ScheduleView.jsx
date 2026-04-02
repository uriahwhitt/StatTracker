import { useState } from "react";
import { T } from "../../utils/constants";
import TournamentModal from "./TournamentModal";
import GameModal from "./GameModal";

const TODAY = new Date().toISOString().slice(0, 10);

const getTournamentStatus = (t) => {
  if (!t.startDate && !t.endDate) return "upcoming";
  if (t.endDate && t.endDate < TODAY) return "done";
  if (t.startDate && t.startDate <= TODAY && (!t.endDate || t.endDate >= TODAY)) return "active";
  return "upcoming";
};

const statusBadge = (status) => {
  const map = {
    active:   { label: "Active",    color: T.green,  bg: "rgba(34,197,94,0.15)"  },
    done:     { label: "Done",      color: "#555",   bg: "rgba(255,255,255,0.04)" },
    upcoming: { label: "Upcoming",  color: T.blue,   bg: "rgba(59,130,246,0.15)" },
  };
  const s = map[status] || map.upcoming;
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, color: s.color, background: s.bg,
      borderRadius: 6, padding: "2px 6px", textTransform: "uppercase", letterSpacing: "0.06em",
    }}>{s.label}</span>
  );
};

const phaseBadge = (phase, bracketName, round) => {
  if (!phase) return null;
  const label = phase === "pool" ? "Pool" : [bracketName, round].filter(Boolean).join(" · ") || "Bracket";
  const color = phase === "pool" ? "#A855F7" : "#F59E0B";
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, color,
      background: `${color}22`, borderRadius: 6, padding: "2px 6px",
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>{label}</span>
  );
};

export default function ScheduleView({ db, updateDb }) {
  const [expandedTournId, setExpandedTournId] = useState(null);
  const [showTournamentModal, setShowTournamentModal] = useState(false);
  const [editingTournament, setEditingTournament] = useState(null);
  const [showGameModal, setShowGameModal] = useState(false);
  const [editingGame, setEditingGame] = useState(null); // { game, source: "scheduled"|"scorebook" }
  const [gameModalTournId, setGameModalTournId] = useState(null);
  const [confirmDeleteTourn, setConfirmDeleteTourn] = useState(null);
  const [confirmDeleteGame, setConfirmDeleteGame] = useState(null); // { id, source }

  const sectionLabel = (text) => (
    <div style={{ fontSize: 10, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, marginTop: 20 }}>
      {text}
    </div>
  );

  // ── Tournament CRUD ─────────────────────────────────────────────────────────
  const saveTournament = (data) => {
    if (data.id) {
      updateDb({ ...db, tournaments: db.tournaments.map(t => t.id === data.id ? data : t) });
    } else {
      const newT = { ...data, id: `tourn_${Date.now()}_${Math.random().toString(36).slice(2, 5)}` };
      updateDb({ ...db, tournaments: [...db.tournaments, newT] });
    }
    setShowTournamentModal(false);
    setEditingTournament(null);
  };

  const deleteTourn = (id) => {
    updateDb({ ...db, tournaments: db.tournaments.filter(t => t.id !== id) });
    setConfirmDeleteTourn(null);
    if (expandedTournId === id) setExpandedTournId(null);
  };

  // ── Game CRUD ───────────────────────────────────────────────────────────────
  const deleteGame = ({ id, source }) => {
    if (source === "scorebook") {
      const sbGame = db.scorebookGames.find(g => g.id === id);
      let newDb = { ...db, scorebookGames: db.scorebookGames.filter(g => g.id !== id) };
      if (sbGame?.scheduledGameId) {
        newDb.scheduledGames = (db.scheduledGames || []).map(sg =>
          sg.id === sbGame.scheduledGameId ? { ...sg, status: "scheduled" } : sg
        );
      }
      updateDb(newDb);
    } else {
      updateDb({ ...db, scheduledGames: (db.scheduledGames || []).filter(g => g.id !== id) });
    }
    setConfirmDeleteGame(null);
  };

  const saveGame = (data) => {
    if (data._source === "scorebook") {
      // Retroactive edit of a scorebook game
      updateDb({
        ...db,
        scorebookGames: db.scorebookGames.map(g => g.id === data.id ? { ...g, ...data } : g),
      });
    } else if (data.id) {
      updateDb({
        ...db,
        scheduledGames: (db.scheduledGames || []).map(g => g.id === data.id ? data : g),
      });
    } else {
      const newG = {
        ...data,
        id: `sched_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        status: data.status || "scheduled",
      };
      updateDb({ ...db, scheduledGames: [...(db.scheduledGames || []), newG] });
    }
    setShowGameModal(false);
    setEditingGame(null);
  };

  // ── Derived ─────────────────────────────────────────────────────────────────
  const scheduledGames = db.scheduledGames || [];
  const scorebookGames = db.scorebookGames || [];

  // Scheduled games that have been loaded into the scorebook show up in both arrays.
  // Suppress the scheduled entry once a scorebook game claims it via scheduledGameId.
  const claimedScheduledIds = new Set(scorebookGames.map(g => g.scheduledGameId).filter(Boolean));
  const unclaimedScheduled = scheduledGames.filter(g => !claimedScheduledIds.has(g.id));

  const gamesForTourn = (tournId) => [
    ...unclaimedScheduled.filter(g => g.tournamentId === tournId).map(g => ({ ...g, _source: "scheduled" })),
    ...scorebookGames.filter(g => g.tournamentId === tournId).map(g => ({ ...g, _source: "scorebook" })),
  ].sort((a, b) => (a.gameDate || "").localeCompare(b.gameDate || ""));

  const unlinked = [
    ...unclaimedScheduled.filter(g => !g.tournamentId).map(g => ({ ...g, _source: "scheduled" })),
    ...scorebookGames.filter(g => !g.tournamentId).map(g => ({ ...g, _source: "scorebook" })),
  ].sort((a, b) => (b.gameDate || "").localeCompare(a.gameDate || ""));

  const GameRow = ({ game, onEdit }) => {
    const isFinal = game.status === "finalized" || game.status === "final";
    const isLive = game.status === "live";
    const dotColor = isFinal ? T.green : isLive ? T.orange : "#555";
    const isConfirming = confirmDeleteGame?.id === game.id;
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 0",
        borderBottom: `1px solid ${T.border}`,
      }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
        <div style={{ flex: 1, cursor: "pointer" }} onClick={onEdit}>
          <div style={{ fontSize: 13, color: "#ddd", fontWeight: 600 }}>vs {game.opponent || game.awayOpponent || "TBD"}</div>
          <div style={{ fontSize: 11, color: "#555" }}>{game.gameDate || game.date || "—"}</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {phaseBadge(game.phase, game.bracketName, game.round)}
          {isConfirming ? (
            <>
              <button onClick={() => deleteGame(confirmDeleteGame)} style={smallBtn(T.red)}>Delete</button>
              <button onClick={() => setConfirmDeleteGame(null)} style={smallBtn("#444")}>✕</button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 12, color: "#444", cursor: "pointer" }} onClick={onEdit}>›</span>
              <button onClick={e => { e.stopPropagation(); setConfirmDeleteGame({ id: game.id, source: game._source }); }} style={smallBtn("rgba(239,68,68,0.25)")}>🗑</button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      {/* ── Tournaments ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        {sectionLabel("Tournaments")}
        <button onClick={() => { setEditingTournament(null); setShowTournamentModal(true); }} style={{
          background: "rgba(249,115,22,0.15)", border: `1px solid rgba(249,115,22,0.3)`,
          color: T.orange, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer",
        }}>+ Tournament</button>
      </div>

      {db.tournaments.length === 0 && (
        <div style={{ color: "#333", fontSize: 13, padding: "12px 0" }}>No tournaments yet.</div>
      )}

      {db.tournaments.map(tourn => {
        const status = getTournamentStatus(tourn);
        const isExpanded = expandedTournId === tourn.id;
        const games = gamesForTourn(tourn.id);

        return (
          <div key={tourn.id} style={{
            background: "rgba(20,184,166,0.05)", border: `1px solid rgba(20,184,166,0.15)`,
            borderRadius: 12, marginBottom: 8, overflow: "hidden",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", cursor: "pointer" }}
              onClick={() => setExpandedTournId(isExpanded ? null : tourn.id)}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 800, color: "#fff", fontSize: 15 }}>{tourn.name}</span>
                  {statusBadge(status)}
                </div>
                <div style={{ fontSize: 11, color: "#555" }}>
                  {tourn.location && `${tourn.location} · `}
                  {tourn.startDate && tourn.endDate
                    ? `${tourn.startDate} – ${tourn.endDate}`
                    : tourn.startDate || ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditingTournament(tourn); setShowTournamentModal(true); }} style={smallBtn("#555")}>Edit</button>
                {confirmDeleteTourn === tourn.id ? (
                  <>
                    <button onClick={() => deleteTourn(tourn.id)} style={smallBtn(T.red)}>Confirm</button>
                    <button onClick={() => setConfirmDeleteTourn(null)} style={smallBtn("#444")}>✕</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDeleteTourn(tourn.id)} style={smallBtn("rgba(239,68,68,0.3)")}>Delete</button>
                )}
              </div>
              <span style={{ fontSize: 12, color: "#555", transform: `rotate(${isExpanded ? 180 : 0}deg)`, transition: "transform 0.2s" }}>▾</span>
            </div>

            {isExpanded && (
              <div style={{ borderTop: `1px solid rgba(20,184,166,0.1)`, padding: "8px 14px 12px" }}>
                {games.length === 0 && (
                  <div style={{ fontSize: 12, color: "#444", padding: "8px 0" }}>No games yet.</div>
                )}
                {games.map(g => (
                  <GameRow key={g.id} game={g} onEdit={() => { setEditingGame(g); setShowGameModal(true); }} />
                ))}
                <button onClick={() => { setEditingGame(null); setGameModalTournId(tourn.id); setShowGameModal(true); }} style={{
                  marginTop: 10, width: "100%", background: "none",
                  border: `1px dashed ${T.border}`, color: "#555", borderRadius: 8,
                  padding: "8px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>+ Add game to tournament</button>
              </div>
            )}
          </div>
        );
      })}

      {/* ── Exhibition / Unlinked ── */}
      {sectionLabel("Exhibition / Unlinked")}
      {unlinked.length === 0 && (
        <div style={{ color: "#333", fontSize: 13, padding: "12px 0" }}>No unlinked games.</div>
      )}
      {unlinked.map(g => (
        <GameRow key={g.id} game={g} onEdit={() => { setEditingGame(g); setGameModalTournId(null); setShowGameModal(true); }} />
      ))}

      <button onClick={() => { setEditingGame(null); setGameModalTournId(null); setShowGameModal(true); }} style={{
        marginTop: 12, width: "100%", background: "none",
        border: `1px dashed ${T.border}`, color: "#555", borderRadius: 8,
        padding: "10px", fontSize: 13, fontWeight: 600, cursor: "pointer",
      }}>+ Scheduled Game</button>

      <div style={{ height: 16 }} />

      {/* Modals */}
      {showTournamentModal && (
        <TournamentModal
          tournament={editingTournament}
          onSave={saveTournament}
          onClose={() => { setShowTournamentModal(false); setEditingTournament(null); }}
        />
      )}

      {showGameModal && (
        <GameModal
          db={db}
          game={editingGame}
          defaultTournamentId={gameModalTournId}
          onSave={saveGame}
          onClose={() => { setShowGameModal(false); setEditingGame(null); setGameModalTournId(null); }}
        />
      )}
    </div>
  );
}

const smallBtn = (bg) => ({
  background: bg, border: "none", color: "#fff", borderRadius: 8,
  padding: "5px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0,
});
