// ── Storage — Firebase Firestore backend (Phase 1.5) ─────────────────────────
// Interface: loadDb / persist / loadActivePlayer / persistActivePlayer / getCurrentUid
// All React components and utilities use these functions only.
//
// Firebase is initialized once in src/firebase.js. This module imports from
// there to avoid duplicate-app errors.

import { db as firestoreDb, auth } from '../firebase';
import { doc, getDoc, setDoc } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";

const LEGACY_KEY  = "bball_tracker_v2";
const PLAYER_KEY  = "bball_active_player";
const FIRESTORE_PATH = (uid) => `users/${uid}/data/db`;

// Module-scoped uid — set once anonymous sign-in resolves
let uid = null;
let uidReady = null;

const getUid = () => {
  if (!uidReady) {
    uidReady = new Promise((resolve) => {
      const unsub = onAuthStateChanged(auth, (user) => {
        if (user) {
          uid = user.uid;
          unsub();
          resolve(uid);
        }
      });
      // Trigger sign-in if not already signed in
      signInAnonymously(auth).catch(console.error);
    });
  }
  return uidReady;
};

// Expose UID for components that need it (e.g. Settings device ID display)
export const getCurrentUid = () => uid;

// ── Default shape ─────────────────────────────────────────────────────────────
const defaultDb = () => ({
  games: [], tournaments: [], players: [],
  organizations: [], teams: [], scorebookGames: [], scheduledGames: [],
});

// ── loadDb ────────────────────────────────────────────────────────────────────
export const loadDb = async () => {
  try {
    const uid = await getUid();
    const ref = doc(firestoreDb, FIRESTORE_PATH(uid));
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const data = snap.data();
      return { ...defaultDb(), ...data };
    }

    // First load — migrate localStorage data to Firestore if available
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy);
      const migrated = { ...defaultDb(), ...parsed };
      await setDoc(ref, migrated);
      return migrated;
    }

    // Brand new user
    const fresh = defaultDb();
    await setDoc(ref, fresh);
    return fresh;
  } catch (err) {
    console.error("loadDb error:", err);
    try {
      const raw = JSON.parse(localStorage.getItem(LEGACY_KEY)) || {};
      return { ...defaultDb(), ...raw };
    } catch {
      return defaultDb();
    }
  }
};

// ── persist ───────────────────────────────────────────────────────────────────
export const persist = async (db) => {
  try { localStorage.setItem(LEGACY_KEY, JSON.stringify(db)); } catch { /* quota */ }

  try {
    const uid = await getUid();
    const ref = doc(firestoreDb, FIRESTORE_PATH(uid));
    await setDoc(ref, db);
  } catch (err) {
    console.error("persist error:", err);
  }
};

// ── Active player (stays in localStorage) ────────────────────────────────────
export const loadActivePlayer = () => localStorage.getItem(PLAYER_KEY) || "";
export const persistActivePlayer = (id) => localStorage.setItem(PLAYER_KEY, id);
