import { useState, useEffect } from "react";
import { T } from "./utils/constants";
import { loadDb, persist, loadActivePlayer, persistActivePlayer, invalidatePathCache, setActiveOrgId, getActiveOrgId } from "./utils/storage";
import { defaultStats, calcPoints } from "./utils/stats";
import { todayStr } from "./utils/dates";
import Header from "./components/layout/Header";
import BottomNav from "./components/layout/BottomNav";
import TrackerView from "./components/tracker/TrackerView";
import HistoryView from "./components/history/HistoryView";
import TournamentView from "./components/tournament/TournamentView";
import ReportsView from "./components/reports/ReportsView";
import ManageView from "./components/manage/ManageView";
import ParentManageView from "./components/manage/ParentManageView";
import ScorebookView from "./components/scorebook/ScorebookView";
import SettingsView from "./components/settings/SettingsView";
import InviteAcceptView from "./components/invite/InviteAcceptView";
import AuthGate from "./components/auth/AuthGate";
import LiveGameBanner from "./components/live/LiveGameBanner";
import LiveGameView from "./components/live/LiveGameView";
import { useAuthUser, isSuperadmin } from "./utils/auth";
import { getAllUserRoles } from "./utils/roles";
import { subscribeLiveGame } from "./utils/liveGame";

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

  let defaultOrgId = orgs[0]?.id;
  if (!defaultOrgId && players.length > 0) {
    const defaultOrg = { id: "default_org", name: "My Organization" };
    orgs = [defaultOrg, ...orgs];
    defaultOrgId = defaultOrg.id;
  }

  players = players.map(p => p.orgId ? p : { ...p, orgId: defaultOrgId || "default_org" });

  games = games.map(g => ({ teamId: null, phase: null, bracketName: null, round: null, ...g }));

  sbGames = sbGames.map(g => {
    const migratedFormat = g.format ? {
      ...g.format,
      doubleBonusFoulLimit: g.format.doubleBonusFoulLimit ?? g.format.bonusThreshold ?? 10,
    } : g.format;
    return { scheduledGameId: null, phase: null, bracketName: null, round: null, ...g, format: migratedFormat };
  });

  const migrated = { ...raw, organizations: orgs, players, games, scorebookGames: sbGames, scheduledGames: raw.scheduledGames || [] };
  localStorage.setItem("bball_tracker_v2", JSON.stringify(migrated));
  localStorage.setItem("hasRunMigration_v3", "1");
};

runMigrationV3();

// ── Invite route detection ────────────────────────────────────────────────────
const inviteMatch = window.location.pathname.match(/^\/invite\/([A-Za-z0-9_-]+)$/);
const INVITE_TOKEN = inviteMatch ? inviteMatch[1] : null;

// ── App router ────────────────────────────────────────────────────────────────
export default function App() {
  if (INVITE_TOKEN) return <InviteAcceptView token={INVITE_TOKEN} />;
  return <AppMain />;
}

// ── Role-based visible tabs ───────────────────────────────────────────────────
const TABS_COACH    = ["scorebook", "history", "reports", "manage"];
const TABS_PARENT   = ["history", "reports", "manage"];

function getVisibleTabs(role) {
  if (!role) return TABS_COACH; // owner/superadmin — no org role doc but full access
  switch (role.role) {
    case "owner":         return TABS_COACH;
    case "headcoach":     return TABS_COACH;
    case "assistantcoach":return TABS_COACH;
    case "parent":        return TABS_PARENT;
    default:              return TABS_COACH;
  }
}

// ── Main app ──────────────────────────────────────────────────────────────────
function AppMain() {
  const user = useAuthUser();

  // ── ALL state hooks first (must run unconditionally, every render) ──────────
  const [view, setView] = useState("history");
  const [db, setDb] = useState(null);
  const [activePlayerId, setActivePlayerId] = useState("");

  // Role state
  const [allRoles, setAllRoles] = useState([]);
  const [userRole, setUserRole] = useState(null);
  const [isSuperadminUser, setIsSuperadminUser] = useState(false);
  const [activeOrgId, setActiveOrgIdState] = useState(null);

  // Live game
  const [liveGame, setLiveGame] = useState(null);
  const [showLiveView, setShowLiveView] = useState(false);

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
  const [scorebookLive, setScorebookLive] = useState(false);

  // ── ALL effect hooks (must run unconditionally, every render) ───────────────

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    loadDb().then(loaded => {
      if (loaded.players.length === 0 && loaded.games.length > 0) {
        const defaultPlayer = { id: "default", name: "Player 1" };
        loaded.players = [defaultPlayer];
        loaded.games = loaded.games.map(g => g.playerId ? g : { ...g, playerId: "default" });
        persist(loaded);
      }
      setDb(loaded);
      const saved = loadActivePlayer();
      if (saved && loaded.players.some(p => p.id === saved)) setActivePlayerId(saved);
      else if (loaded.players.length > 0) setActivePlayerId(loaded.players[0].id);
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user || user.isAnonymous) return;
    Promise.all([
      getAllUserRoles(user.uid),
      isSuperadmin(user),
    ]).then(([roles, isSA]) => {
      setAllRoles(roles);
      setIsSuperadminUser(isSA);

      const storedOrg = getActiveOrgId(user.uid);
      const activeRole = storedOrg
        ? roles.find(r => r.orgId === storedOrg) || roles[0]
        : roles[0];
      setUserRole(activeRole || null);
      setActiveOrgIdState(activeRole?.orgId || null);
    });
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const orgId = userRole?.orgId || activeOrgId;
    if (!orgId) return;
    const unsub = subscribeLiveGame(orgId, (data) => setLiveGame(data));
    return unsub;
  }, [userRole, activeOrgId]);

  useEffect(() => {
    if (!userRole) return;
    const visible = getVisibleTabs(userRole);
    if (!visible.includes(view)) setView(visible[0]);
  }, [userRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth gate — after all hooks ─────────────────────────────────────────────
  if (user === undefined) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#444", fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>
      </div>
    );
  }
  if (!user || user.isAnonymous) return <AuthGate />;

  const updateDb = (newDb) => { setDb(newDb); persist(newDb); };
  const setActivePlayer = (id) => { setActivePlayerId(id); persistActivePlayer(id); };

  // ── Team switching ──────────────────────────────────────────────────────────
  const handleSwitchOrg = async (orgId) => {
    setActiveOrgId(user.uid, orgId);
    setActiveOrgIdState(orgId);
    const role = allRoles.find(r => r.orgId === orgId) || null;
    setUserRole(role);
    invalidatePathCache();
    const fresh = await loadDb();
    setDb(fresh);
  };

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
        ...g, gameDate: gameDateInput,
        opponent: opponent.trim() || "Unknown Opponent",
        tournamentId: tournamentId || null,
        stats: { ...stats }, points: calcPoints(stats),
      } : g);
      updateDb({ ...db, games: updatedGames });
      setEditingGameId(null);
    } else {
      const game = {
        id: Date.now().toString(), date: new Date().toISOString(),
        gameDate: gameDateInput, opponent: opponent.trim() || "Unknown Opponent",
        tournamentId: tournamentId || null, playerId: activePlayerId,
        stats: { ...stats }, points: calcPoints(stats),
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

  const navTo = (v) => {
    setView(v);
    setSelectedGame(null);
    setSelectedTournament(null);
    if (v !== "tracker") setEditingGameId(null);
  };

  const handleScorebookLiveChange = (isLive) => setScorebookLive(isLive);

  // ── Live banner — show if game is live for user's team ────────────────────
  const showBanner = liveGame?.isLive && !showLiveView &&
    (userRole?.role === "owner" || !userRole?.teamId || liveGame.teamId === userRole?.teamId);

  // ── Render ──────────────────────────────────────────────────────────────────
  if (!db) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#444", fontSize: 14, fontFamily: "'DM Sans',sans-serif" }}>Loading…</div>
      </div>
    );
  }

  const visibleTabs = getVisibleTabs(userRole);
  const activeTeam = db.teams?.find(t => t.id === userRole?.teamId);
  const activeOrg = db.organizations?.find(o => o.id === userRole?.orgId);
  const playerGames = db.games.filter(g => g.playerId === activePlayerId || (!g.playerId && activePlayerId === "default"));
  const tournamentGames = (tid) => playerGames.filter(g => g.tournamentId === tid);
  const hideChrome = view === "scorebook" && scorebookLive;
  const isParent = userRole?.role === "parent";

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

      {/* Multi-team selector */}
      {allRoles.length > 1 && !hideChrome && (
        <div style={{ padding: "0 16px 8px", display: "flex", gap: 6, overflowX: "auto" }}>
          {allRoles.map(role => {
            const team = db.teams?.find(t => t.id === role.teamId);
            const org = db.organizations?.find(o => o.id === role.orgId);
            const isActive = role.orgId === (userRole?.orgId);
            return (
              <button key={role.orgId} onClick={() => handleSwitchOrg(role.orgId)} style={{
                flexShrink: 0, padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: "pointer", whiteSpace: "nowrap",
                background: isActive ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? "rgba(249,115,22,0.4)" : "rgba(255,255,255,0.08)"}`,
                color: isActive ? T.orange : "#666",
              }}>
                {team?.name || org?.name || role.orgId}
              </button>
            );
          })}
        </div>
      )}

      {/* Live game banner */}
      {showBanner && !hideChrome && (
        <LiveGameBanner liveGame={liveGame} onClick={() => setShowLiveView(true)} />
      )}

      <div style={{ padding: hideChrome ? 0 : "0 16px" }}>

        {/* Team context banner for History and Reports */}
        {(view === "history" || view === "reports") && activeTeam && (
          <div style={{
            background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.15)",
            borderRadius: 10, padding: "10px 14px", marginBottom: 14,
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 10, color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {activeOrg?.name}
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{activeTeam.name}</div>
            </div>
            <div style={{
              fontSize: 10, fontWeight: 700, color: T.orange,
              background: "rgba(249,115,22,0.12)", border: "1px solid rgba(249,115,22,0.3)",
              borderRadius: 20, padding: "3px 10px", textTransform: "uppercase",
            }}>
              {userRole?.role === "parent" ? "Parent" : "Coach"}
            </div>
          </div>
        )}

        {view === "scorebook" && visibleTabs.includes("scorebook") && (
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
          isParent
            ? <ParentManageView db={db} allRoles={allRoles} />
            : <ManageView db={db} updateDb={updateDb} user={user} userRole={userRole} isSuperadminUser={isSuperadminUser} />
        )}

        {view === "settings" && (
          <SettingsView db={db} updateDb={updateDb} />
        )}
      </div>

      <BottomNav view={view} navTo={navTo} hidden={hideChrome} visibleTabs={visibleTabs} />

      {/* Live game full view */}
      {showLiveView && (
        <LiveGameView
          orgId={userRole?.orgId || activeOrgId}
          onClose={() => setShowLiveView(false)}
        />
      )}
    </div>
  );
}
