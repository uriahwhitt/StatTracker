import { useState, useEffect } from "react";
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
import SettingsView from "./components/settings/SettingsView";
import InviteAcceptView from "./components/invite/InviteAcceptView";
import { useAuthUser, isSuperadmin } from "./utils/auth";
import { getOrgForUser } from "./utils/roles";

// ── One-time data migration (v3) ──────────────────────────────────────────────
const runMigrationV3 = () => {
  if (localStorage.getItem("hasRunMigration_v3")) return;
  const raw = JSON.parse(localStorage.getItem("bball_tracker_v2")) || {};
  if (!raw.players && !raw.games && !raw.scorebookGames) {
    localStorage.setItem("hasRunMigration_v3", "1");
    return;
  }

  let orgs = raw.organizations || [];
  let players = raw.players || [];
  let games = raw.games || [];
  let sbGames = raw.scorebookGames || [];

  // Ensure a default org exists if players exist
  let defaultOrgId = orgs[0]?.id;
  if (!defaultOrgId && players.length > 0) {
    const defaultOrg = { id: "default_org", name: "My Organization" };
    orgs = [defaultOrg, ...orgs];
    defaultOrgId = defaultOrg.id;
  }

  // players: add orgId if missing
  players = players.map(p =>
    p.orgId ? p : { ...p, orgId: defaultOrgId || "default_org" }
  );

  // games: add missing fields (additive only)
  games = games.map(g => ({
    teamId: null,
    phase: null,
    bracketName: null,
    round: null,
    ...g,
  }));

  // scorebookGames: add missing fields + migrate bonusThreshold → doubleBonusFoulLimit
  sbGames = sbGames.map(g => {
    const migratedFormat = g.format ? {
      ...g.format,
      doubleBonusFoulLimit: g.format.doubleBonusFoulLimit ?? g.format.bonusThreshold ?? 10,
    } : g.format;
    return {
      scheduledGameId: null,
      phase: null,
      bracketName: null,
      round: null,
      ...g,
      format: migratedFormat,
    };
  });

  const migrated = { ...raw, organizations: orgs, players, games, scorebookGames: sbGames, scheduledGames: raw.scheduledGames || [] };
  localStorage.setItem("bball_tracker_v2", JSON.stringify(migrated));
  localStorage.setItem("hasRunMigration_v3", "1");
};

// Run migration before any state is initialized
runMigrationV3();

// ── Invite route detection ─────────────────────────────────────────────────────
const inviteMatch = window.location.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)$/);
const INVITE_TOKEN = inviteMatch ? inviteMatch[1] : null;

// ── App router ────────────────────────────────────────────────────────────────
// Handles /invite/{token} vs the main app. Kept outside AppMain to avoid
// calling hooks before this guard — React requires hooks to be called in
// the same order every render.
export default function App() {
  if (INVITE_TOKEN) {
    return <InviteAcceptView token={INVITE_TOKEN} />;
  }
  return <AppMain />;
}

// ── Main app ──────────────────────────────────────────────────────────────────
function AppMain() {
  const user = useAuthUser();
  const [view, setView] = useState("tracker");
  const [db, setDb] = useState(null);
  const [activePlayerId, setActivePlayerId] = useState("");
  const [userRole, setUserRole] = useState(null);      // { orgId, role, teamId, ... }
  const [isSuperadminUser, setIsSuperadminUser] = useState(false);

  // ── Async initial load from Firestore ────────────────────────────────────────
  useEffect(() => {
    loadDb().then(loaded => {
      if (loaded.players.length === 0 && loaded.games.length > 0) {
        const defaultPlayer = { id: "default", name: "Player 1" };
        loaded.players = [defaultPlayer];
        loaded.games = loaded.games.map(g => g.playerId ? g : { ...g, playerId: "default" });
        persist(loaded);
      }
      setDb(loaded);

      const saved = loadActivePlayer();
      if (saved && loaded.players.some(p => p.id === saved)) {
        setActivePlayerId(saved);
      } else if (loaded.players.length > 0) {
        setActivePlayerId(loaded.players[0].id);
      }
    });
  }, []);

  // ── Resolve role + superadmin once auth is ready ──────────────────────────────
  useEffect(() => {
    if (!user || user.isAnonymous) {
      setUserRole(null);
      setIsSuperadminUser(false);
      return;
    }
    getOrgForUser(user.uid).then(role => setUserRole(role || null));
    isSuperadmin(user).then(setIsSuperadminUser);
  }, [user]);

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

  const [scorebookLive, setScorebookLive] = useState(false);

  const navTo = (v) => { setView(v); setSelectedGame(null); setSelectedTournament(null); if (v !== "tracker") { setEditingGameId(null); } };

  // ScorebookView manages its own live state and tells App when to hide chrome
  const handleScorebookLiveChange = (isLive) => setScorebookLive(isLive);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!db) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#444", fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>
      </div>
    );
  }

  // Filter helpers — only safe to compute once db is loaded
  const playerGames = db.games.filter(g => g.playerId === activePlayerId || (!g.playerId && activePlayerId === "default"));
  const tournamentGames = (tid) => playerGames.filter(g => g.tournamentId === tid);
  const activePlayer = db.players.find(p => p.id === activePlayerId);

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

      {!hideChrome && <Header db={db} activePlayerId={activePlayerId} setActivePlayer={setActivePlayer} view={view} stats={stats} setView={navTo} />}

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
          <HistoryView db={db} setView={navTo} />
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
          <ReportsView db={db} />
        )}

        {view === "manage" && (
          <ManageView db={db} updateDb={updateDb} user={user} userRole={userRole} isSuperadminUser={isSuperadminUser} />
        )}

        {view === "settings" && (
          <SettingsView db={db} updateDb={updateDb} />
        )}
      </div>

      <BottomNav view={view} navTo={navTo} hidden={hideChrome} />
    </div>
  );
}
