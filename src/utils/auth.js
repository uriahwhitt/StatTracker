// ── Auth utilities — Phase 2 Gate 1 ────────────────────────────────────────
// Exports: signInWithGoogle, signInWithExistingAccount, signOutUser,
//          isSuperadmin, useAuthUser

import { auth } from '../firebase';
import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { useState, useEffect } from 'react';

const provider = new GoogleAuthProvider();

// ── Google sign-in / account linking ─────────────────────────────────────────
//
// If the current session is anonymous, this links the Google credential to the
// existing anonymous UID — preserving all Firestore data at users/{uid}/data/db.
//
// Returns one of:
//   { user, linked: true }           — success (linked or already authenticated)
//   { conflict: true, credential }   — Google account already belongs to a
//                                      different Firebase UID; caller should
//                                      confirm then call signInWithExistingAccount
//   { cancelled: true }              — user closed the popup
//
export const signInWithGoogle = async () => {
  const user = auth.currentUser;
  if (!user) throw new Error("No active session found. Please restart the app.");

  try {
    const result = await linkWithPopup(user, provider);
    // Force token refresh so any custom claims are immediately available
    await result.user.getIdToken(true);
    return { user: result.user, linked: true };
  } catch (err) {
    if (err.code === 'auth/credential-already-in-use') {
      const credential = GoogleAuthProvider.credentialFromError(err);
      return { conflict: true, credential };
    }
    if (
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request'
    ) {
      return { cancelled: true };
    }
    throw err;
  }
};

// ── Conflict resolution — sign in with the existing account ──────────────────
// Call this when the user confirms they want to switch to the conflicting account.
export const signInWithExistingAccount = async (credential) => {
  const result = await signInWithCredential(auth, credential);
  await result.user.getIdToken(true);
  return result.user;
};

// ── Sign out ──────────────────────────────────────────────────────────────────
export const signOutUser = () => signOut(auth);

// ── Superadmin check — reads Firebase Auth custom claims ─────────────────────
export const isSuperadmin = async (user) => {
  if (!user) return false;
  try {
    const tokenResult = await user.getIdTokenResult();
    return tokenResult.claims.superadmin === true;
  } catch {
    return false;
  }
};

// ── React hook — subscribes to Firebase auth state ────────────────────────────
// Returns the current Firebase User object (or null before auth resolves).
// user.isAnonymous === true  → anonymous session
// user.isAnonymous === false → signed in with Google
export const useAuthUser = () => {
  const [user, setUser] = useState(() => auth.currentUser);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return unsub;
  }, []);

  return user;
};
