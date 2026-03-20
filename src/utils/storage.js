const STORAGE_KEY = "bball_tracker_v2";
const PLAYER_KEY = "bball_active_player";

export const loadDb = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    return {
      games: raw.games || [],
      tournaments: raw.tournaments || [],
      players: raw.players || [],
      organizations: raw.organizations || [],
      teams: raw.teams || [],
      scorebookGames: raw.scorebookGames || [],
    };
  } catch { return { games: [], tournaments: [], players: [], organizations: [], teams: [], scorebookGames: [] }; }
};

export const persist = (db) => localStorage.setItem(STORAGE_KEY, JSON.stringify(db));

export const loadActivePlayer = () => localStorage.getItem(PLAYER_KEY) || "";

export const persistActivePlayer = (id) => localStorage.setItem(PLAYER_KEY, id);
