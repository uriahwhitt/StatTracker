// ── Live game helpers — Phase 2 Gate 4 ────────────────────────────────────────
// orgs/{orgId}/live/game — single document per org, written by coach during Go Live.

import { db as firestoreDb } from '../firebase';
import { doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

// Write / update the live game state. Called on each dispatch when isLive.
export const publishLiveGame = async (orgId, gameSnapshot) => {
  await setDoc(doc(firestoreDb, `orgs/${orgId}/live/game`), {
    ...gameSnapshot,
    isLive: true,
    updatedAt: new Date().toISOString(),
  });
};

// Clear the live game — called on Stop Broadcasting or game exit.
export const clearLiveGame = async (orgId) => {
  try {
    await deleteDoc(doc(firestoreDb, `orgs/${orgId}/live/game`));
  } catch { /* already gone */ }
};

// Subscribe to live game updates for an org.
// callback(data | null) — data is null when no game is live.
// Returns unsubscribe function.
export const subscribeLiveGame = (orgId, callback) => {
  if (!orgId) { callback(null); return () => {}; }
  return onSnapshot(
    doc(firestoreDb, `orgs/${orgId}/live/game`),
    (snap) => callback(snap.exists() ? snap.data() : null),
    () => callback(null)
  );
};
