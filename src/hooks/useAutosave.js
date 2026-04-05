import { useEffect, useRef } from "react";
import { persist } from "../utils/storage";

const ROSTER_DEBOUNCE_MS  = 300;    // fast — for Manage tab edits
const SCOREBOOK_DEBOUNCE_MS = 45000; // 45s — live game: data is safe in localStorage, Firestore sync is for cross-device visibility only

export default function useAutosave(db, game) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (!game) return;

    const isLiveGame = game.status === "live";
    const delay = isLiveGame ? SCOREBOOK_DEBOUNCE_MS : ROSTER_DEBOUNCE_MS;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const updatedGames = db.scorebookGames.map(g => g.id === game.id ? game : g);
      const exists = updatedGames.some(g => g.id === game.id);
      const newDb = {
        ...db,
        scorebookGames: exists ? updatedGames : [...db.scorebookGames, game],
      };
      persist(newDb);
    }, delay);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [game]); // eslint-disable-line react-hooks/exhaustive-deps
}
