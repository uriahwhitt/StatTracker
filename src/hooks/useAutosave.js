import { useEffect, useRef } from "react";
import { persist } from "../utils/storage";

// Debounced autosave of the full db whenever a scorebook game changes.
// Saves after 300ms of inactivity to avoid thrashing localStorage.
export default function useAutosave(db, game) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!game) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      // Update the game in the db and persist
      const updatedGames = db.scorebookGames.map(g => g.id === game.id ? game : g);
      const exists = updatedGames.some(g => g.id === game.id);
      const newDb = {
        ...db,
        scorebookGames: exists ? updatedGames : [...db.scorebookGames, game],
      };
      persist(newDb);
    }, 300);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [game]);
}
