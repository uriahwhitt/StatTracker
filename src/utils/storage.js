// ── Storage — Firebase Firestore backend (Phase 1.5 / Phase 2) ───────────────
// Interface: loadDb / persist / loadActivePlayer / persistActivePlayer / getCurrentUid
// All React components and utilities use these functions only.
//
// Firebase is initialized once in src/firebase.js. This module imports from
// there to avoid duplicate-app errors.

import { db as firestoreDb, auth } from '../firebase';
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";

const LEGACY_KEY  = "bball_tracker_v2";
const PLAYER_KEY  = "bball_active_player";

// Module-scoped uid — kept current by a persistent auth state listener
let uid = null;
let _uidWaiters = []; // resolve fns waiting for first uid

// Org path set after invite acceptance — primed into cache on next auth resolve
// so that loadDb() after a page reload routes to the org immediately.
let _pendingOrgPath = localStorage.getItem('_pending_org_path') || null;

export const setPendingOrgPath = (path) => {
  _pendingOrgPath = path;
  localStorage.setItem('_pending_org_path', path);
};

// Single persistent listener — stays active for the app lifetime.
// Updates uid whenever auth state changes (sign-in, sign-out, token refresh).
onAuthStateChanged(auth, (user) => {
  if (user) {
    uid = user.uid;
    // If an invite acceptance set a pending org path, prime the cache now
    if (_pendingOrgPath) {
      setActivePath(uid, _pendingOrgPath);
      _pendingOrgPath = null;
      localStorage.removeItem('_pending_org_path');
    }
    // Unblock any callers waiting on getUid()
    _uidWaiters.forEach(resolve => resolve(uid));
    _uidWaiters = [];
  } else {
    // No user at all — create an anonymous session.
    // Only reached when Firebase confirms nothing is persisted,
    // so this never races against a restored Google session.
    uid = null;
    signInAnonymously(auth).catch(console.error);
  }
});

const getUid = () => {
  if (uid) return Promise.resolve(uid);
  // uid not yet known — queue until onAuthStateChanged fires
  return new Promise((resolve) => _uidWaiters.push(resolve));
};

// Expose UID for components that need it (e.g. Settings device ID display)
export const getCurrentUid = () => uid;

// ── Org path routing (Phase 2 §2.4) ──────────────────────────────────────────
//
// Personal path (default):  users/{uid}/data/db
// Org path (when user has an org role): orgs/{orgId}/data/db
//
// Cache the resolved path per uid to avoid repeated Firestore reads.
// Call invalidatePathCache() after sign-in / sign-out so the next load
// re-evaluates the role.
//
let _pathCache = {};

export const invalidatePathCache = () => { _pathCache = {}; };

// Explicitly prime the path cache for a uid — use after org creation so persist
// doesn't have to re-query Firestore (which may not yet reflect the new role doc
// in collection queries due to local cache indexing lag).
export const setActivePath = (uid, path) => { _pathCache[uid] = path; };

const getActivePath = async (resolvedUid) => {
  if (_pathCache[resolvedUid]) return _pathCache[resolvedUid];

  try {
    const rolesRef = collection(firestoreDb, `users/${resolvedUid}/roles`);
    const rolesSnap = await getDocs(rolesRef);
    if (!rolesSnap.empty) {
      // User has at least one org role — route to the org's shared path.
      // Uses the first role document (orgId is the document ID).
      const orgId = rolesSnap.docs[0].id;
      _pathCache[resolvedUid] = `orgs/${orgId}/data/db`;
      return _pathCache[resolvedUid];
    }
  } catch {
    // roles subcollection does not exist yet — fall through to personal path
  }

  _pathCache[resolvedUid] = `users/${resolvedUid}/data/db`;
  return _pathCache[resolvedUid];
};

// ── Default shape ─────────────────────────────────────────────────────────────
const defaultDb = () => ({
  games: [], tournaments: [], players: [],
  organizations: [], teams: [], scorebookGames: [], scheduledGames: [],
});

// ── loadDb ────────────────────────────────────────────────────────────────────
export const loadDb = async () => {
  try {
    const resolvedUid = await getUid();
    const path = await getActivePath(resolvedUid);
    const ref = doc(firestoreDb, path);
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
    const resolvedUid = await getUid();
    const path = await getActivePath(resolvedUid);
    const ref = doc(firestoreDb, path);
    await setDoc(ref, db);
  } catch (err) {
    console.error("persist error:", err);
  }
};

// ── Active player (stays in localStorage) ────────────────────────────────────
export const loadActivePlayer = () => localStorage.getItem(PLAYER_KEY) || "";
export const persistActivePlayer = (id) => localStorage.setItem(PLAYER_KEY, id);
