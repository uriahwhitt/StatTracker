import { useState } from "react";
import { T } from "./utils/constants";
import { loadDb, persist, loadActivePlayer, persistActivePlayer } from "./utils/storage";
import { defaultStats, calcPoints } from "./utils/stats";
import { todayStr } from "./utils/dates";
import Header from "./components/layout/Header";
import BottomNav from "./components/layout/BottomNav";
import TrackerView from "./components/tracker/TrackerView";
import HistoryView from "./components/history/HistoryView";
import TournamentView from "./components/tournament/TournamentView";
import ReportsView from "./components/reports/ReportsView";
import ManageView from "./components/manage/ManageView";
import ScorebookView from "./components/scorebook/ScorebookView";

export default function App() {
  const [view, setView] = useState("tracker");
  const [db, setDb] = useState(() => {
    const loaded = loadDb();
    if (loaded.players.length === 0 && loaded.games.length > 0) {
      const defaultPlayer = { id: "default", name: "Player 1" };
      loaded.players = [defaultPlayer];
      loaded.games = loaded.games.map(g => g.playerId ? g : { ...g, playerId: "default" });
      persist(loaded);
    }
    return loaded;
  });
  const [activePlayerId, setActivePlayerId] = useState(() => {
    const saved = loadActivePlayer();
    const loaded = loadDb();
    if (saved && loaded.players.some(p => p.id === saved)) return saved;
    return loaded.players.length > 0 ? loaded.players[0].id : "";
  });

  const [stats, setStats] = useState(defaultStats());
  const [opponent, setOpponent] = useState("");
  const [gameDateInput, setGameDateInput] = useState(todayStr);
  const [tournamentId, setTournamentId] = useState("");
  const [selectedGame, setSelectedGame] = useState(null);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [saveMsg, setSaveMsg] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [editingGameId, setEditingGameId] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const updateDb = (newDb) => { setDb(newDb); persist(newDb); };
  const setActivePlayer = (id) => { setActivePlayerId(id); persistActivePlayer(id); };

  const adj = (updates) => setStats(s => {
    const next = { ...s };
    for (const [k, d] of Object.entries(updates)) next[k] = Math.max(0, (s[k] || 0) + d);
    return next;
  });

  const shotHandlers = (madeKey, attKey) => ({
    onMadeAdd: () => adj({ [madeKey]: 1, [attKey]: 1 }),
    onMadeUndo: () => setStats(s => {
      if (s[madeKey] <= 0) return s;
      return { ...s, [madeKey]: s[madeKey] - 1, [attKey]: Math.max(s[madeKey] - 1, s[attKey] - 1) };
    }),
    onMissAdd: () => adj({ [attKey]: 1 }),
    onMissUndo: () => setStats(s => {
      const missed = s[attKey] - s[madeKey];
      if (missed <= 0) return s;
      return { ...s, [attKey]: s[attKey] - 1 };
    }),
  });

  // ── Player management ────────────────────────────────────────────────────────
  const addPlayer = () => {
    const name = newPlayerName.trim();
    if (!name) return;
    const player = { id: Date.now().toString(), name };
    const newDb = { ...db, players: [...db.players, player] };
    updateDb(newDb);
    if (!activePlayerId) setActivePlayer(player.id);
    setNewPlayerName("");
  };

  const deletePlayer = (id) => {
    const updatedGames = db.games.filter(g => g.playerId !== id);
    const updatedPlayers = db.players.filter(p => p.id !== id);
    // Cascade: remove player from all team rosters
    const updatedTeams = db.teams.map(t => ({
      ...t,
      roster: (t.roster || []).filter(r => r.playerId !== id),
      tempRoster: t.tempRoster ? t.tempRoster.filter(r => r.playerId !== id) : null,
    }));
    updateDb({ ...db, games: updatedGames, players: updatedPlayers, teams: updatedTeams });
    if (activePlayerId === id) {
      const next = updatedPlayers.length > 0 ? updatedPlayers[0].id : "";
      setActivePlayer(next);
    }
    setConfirmDelete(null);
  };

  const deleteTournament = (id) => {
    const updatedGames = db.games.map(g => g.tournamentId === id ? { ...g, tournamentId: null } : g);
    updateDb({ ...db, games: updatedGames, tournaments: db.tournaments.filter(t => t.id !== id) });
    setSelectedTournament(null);
    setConfirmDelete(null);
  };

  const deleteGame = (id) => {
    updateDb({ ...db, games: db.games.filter(g => g.id !== id) });
    setSelectedGame(null);
    setConfirmDelete(null);
  };

  const confirmAndDelete = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === "game") deleteGame(confirmDelete.id);
    else if (confirmDelete.type === "tournament") deleteTournament(confirmDelete.id);
    else if (confirmDelete.type === "player") deletePlayer(confirmDelete.id);
    setConfirmDelete(null);
  };

  // ── Game operations ──────────────────────────────────────────────────────────
  const saveGame = () => {
    if (!activePlayerId) return;
    if (editingGameId) {
      const updatedGames = db.games.map(g => g.id === editingGameId ? {
        ...g,
        gameDate: gameDateInput,
        opponent: opponent.trim() || "Unknown Opponent",
        tournamentId: tournamentId || null,
        stats: { ...stats },
        points: calcPoints(stats),
      } : g);
      updateDb({ ...db, games: updatedGames });
      setEditingGameId(null);
    } else {
      const game = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        gameDate: gameDateInput,
        opponent: opponent.trim() || "Unknown Opponent",
        tournamentId: tournamentId || null,
        playerId: activePlayerId,
        stats: { ...stats },
        points: calcPoints(stats),
      };
      updateDb({ ...db, games: [game, ...db.games] });
    }
    setStats(defaultStats());
    setOpponent("");
    setGameDateInput(todayStr());
    setTournamentId("");
    setSaveMsg("Saved ✓");
    setTimeout(() => setSaveMsg(""), 2500);
  };

  const editGame = (g) => {
    setStats({ ...g.stats });
    setOpponent(g.opponent);
    setGameDateInput(g.gameDate || g.date.slice(0, 10));
    setTournamentId(g.tournamentId || "");
    setEditingGameId(g.id);
    setSelectedGame(null);
    setView("tracker");
  };

  const cancelEdit = () => {
    setEditingGameId(null);
    setStats(defaultStats());
    setOpponent("");
    setGameDateInput(todayStr());
    setTournamentId("");
  };

  const updateGameTournament = (gameId, newTid) => {
    const updatedGames = db.games.map(g => g.id === gameId ? { ...g, tournamentId: newTid || null } : g);
    updateDb({ ...db, games: updatedGames });
    setSelectedGame(prev => prev ? { ...prev, tournamentId: newTid || null } : null);
  };

  // Filter helpers
  const playerGames = db.games.filter(g => g.playerId === activePlayerId || (!g.playerId && activePlayerId === "default"));
  const tournamentGames = (tid) => playerGames.filter(g => g.tournamentId === tid);
  const activePlayer = db.players.find(p => p.id === activePlayerId);

  const [scorebookLive, setScorebookLive] = useState(false);

  const navTo = (v) => { setView(v); setSelectedGame(null); setSelectedTournament(null); if (v !== "tracker") { setEditingGameId(null); } };

  // ScorebookView manages its own live state and tells App when to hide chrome
  const handleScorebookLiveChange = (isLive) => setScorebookLive(isLive);

  // ── Render ──────────────────────────────────────────────────────────────────
  const hideChrome = view === "scorebook" && scorebookLive;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: "#e0e0e0", fontFamily: "'DM Sans',sans-serif", paddingBottom: hideChrome ? 0 : 84 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,600;0,700;0,900;1,400&family=DM+Mono:wght@400;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        body { background: ${T.bg}; }
        input, select { outline: none; color: #fff; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 10px; padding: 10px 14px; font-size: 15px; width: 100%; font-family: 'DM Sans', sans-serif; -webkit-appearance: none; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        input[type="file"] { display: none; }
        option { background: #1a1a2e; }
        button { font-family: 'DM Sans', sans-serif; }
        input::placeholder { color: #444; }
        @keyframes fadeUp { 0% { opacity: 1; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-18px); } }
      `}</style>

      {!hideChrome && <Header db={db} activePlayerId={activePlayerId} setActivePlayer={setActivePlayer} view={view} stats={stats} />}

      <div style={{ padding: hideChrome ? 0 : "0 16px" }}>
        {view === "tracker" && (
          <TrackerView
            db={db} activePlayerId={activePlayerId} stats={stats} adj={adj} shotHandlers={shotHandlers}
            opponent={opponent} setOpponent={setOpponent} gameDateInput={gameDateInput} setGameDateInput={setGameDateInput}
            tournamentId={tournamentId} setTournamentId={setTournamentId}
            editingGameId={editingGameId} cancelEdit={cancelEdit} saveGame={saveGame} saveMsg={saveMsg}
            confirmReset={confirmReset} setConfirmReset={setConfirmReset} setStats={setStats} defaultStats={defaultStats}
            newPlayerName={newPlayerName} setNewPlayerName={setNewPlayerName} addPlayer={addPlayer}
          />
        )}

        {view === "scorebook" && (
          <ScorebookView db={db} updateDb={updateDb} onLiveChange={handleScorebookLiveChange} />
        )}

        {view === "history" && (
          <HistoryView
            db={db} playerGames={playerGames} activePlayer={activePlayer}
            selectedGame={selectedGame} setSelectedGame={setSelectedGame}
            editGame={editGame} updateGameTournament={updateGameTournament}
            confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} confirmAndDelete={confirmAndDelete}
          />
        )}

        {view === "tournament" && (
          <TournamentView
            db={db} updateDb={updateDb} tournamentGames={tournamentGames}
            selectedTournament={selectedTournament} setSelectedTournament={setSelectedTournament}
            confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} confirmAndDelete={confirmAndDelete}
            setView={setView} setSelectedGame={setSelectedGame}
          />
        )}

        {view === "reports" && (
          <ReportsView
            activePlayer={activePlayer} playerGames={playerGames} db={db}
            setView={setView} setSelectedGame={setSelectedGame}
          />
        )}

        {view === "manage" && (
          <ManageView
            db={db} updateDb={updateDb} activePlayerId={activePlayerId} setActivePlayer={setActivePlayer}
            activePlayer={activePlayer} playerGames={playerGames} addPlayer={addPlayer}
            confirmDelete={confirmDelete} setConfirmDelete={setConfirmDelete} confirmAndDelete={confirmAndDelete}
          />
        )}
      </div>

      <BottomNav view={view} navTo={navTo} hidden={hideChrome} />
    </div>
  );
}
