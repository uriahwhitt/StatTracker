// ── Scorekeeper lock helpers — Phase 2 Gate 5a ────────────────────────────────
// orgs/{orgId}/scorekeeperAssignments/{gameId}
//
// Doc presence = locked. Doc absence = unlocked.
// gameId is the scorebook game ID (not the scheduled game ID).

import { db as firestoreDb } from '../firebase';
import {
  doc, setDoc, deleteDoc, onSnapshot, collection, addDoc,
} from 'firebase/firestore';

const lockRef = (orgId, gameId) =>
  doc(firestoreDb, `orgs/${orgId}/scorekeeperAssignments/${gameId}`);

// Claim the lock — scorekeeper calls this before entering LiveScorebook.
export const claimLock = async (orgId, gameId, uid, displayName) => {
  await setDoc(lockRef(orgId, gameId), {
    gameId,
    scorekeeperUid:  uid,
    scorekeeperName: displayName,
    claimedAt:       new Date().toISOString(),
    lastActivity:    new Date().toISOString(),
  });
};

// Release the lock — scorekeeper calls this on clean exit or finalize.
export const releaseLock = async (orgId, gameId) => {
  try {
    await deleteDoc(lockRef(orgId, gameId));
  } catch { /* already gone */ }
};

// Break the lock — Head Coach+ calls this. Also writes a notification to the
// displaced scorekeeper so Gate 8 can surface it.
export const breakLock = async (orgId, gameId, breakerName, scorekeeperUid) => {
  try { await deleteDoc(lockRef(orgId, gameId)); } catch { /* already gone */ }
  try {
    await addDoc(
      collection(firestoreDb, `users/${scorekeeperUid}/notifications`),
      {
        type:        'lock_broken',
        orgId,
        gameId,
        brokenByName: breakerName,
        brokenAt:    new Date().toISOString(),
        read:        false,
      }
    );
  } catch { /* notification write failure is non-fatal */ }
};

// Update the heartbeat timestamp — called (debounced) on every stat dispatch.
export const updateHeartbeat = async (orgId, gameId) => {
  try {
    await setDoc(lockRef(orgId, gameId), { lastActivity: new Date().toISOString() }, { merge: true });
  } catch { /* non-fatal */ }
};

// Subscribe to a specific game's lock doc.
// callback(lockData | null) — null when unlocked.
export const subscribeLock = (orgId, gameId, callback) => {
  if (!orgId || !gameId) { callback(null); return () => {}; }
  return onSnapshot(
    lockRef(orgId, gameId),
    (snap) => callback(snap.exists() ? snap.data() : null),
    () => callback(null)
  );
};

// Subscribe to ALL active lock docs for an org.
// callback({ [gameId]: lockData }) — empty object when no games locked.
export const subscribeAllLocks = (orgId, callback) => {
  if (!orgId) { callback({}); return () => {}; }
  return onSnapshot(
    collection(firestoreDb, `orgs/${orgId}/scorekeeperAssignments`),
    (snap) => {
      const locks = {};
      snap.forEach(d => { locks[d.id] = d.data(); });
      callback(locks);
    },
    () => callback({})
  );
};
