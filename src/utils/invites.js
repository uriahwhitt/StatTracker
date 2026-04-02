// ── Invite helpers — Phase 2 Gate 3 ──────────────────────────────────────────
// Exports: createInvite, getInvite, markInviteUsed

import { db as firestoreDb } from '../firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

// Create an invite document in /invites/{token} and return the token.
// Includes denormalized orgName + teamName so the acceptor can display context
// without having org data access yet.
export const createInvite = async ({ orgId, teamId, role, createdByUid, teamName, orgName }) => {
  const token = crypto.randomUUID();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();

  await setDoc(doc(firestoreDb, `invites/${token}`), {
    orgId,
    teamId,
    role,
    createdByUid,
    createdAt: now,
    expiresAt,
    teamName: teamName || '',
    orgName: orgName || '',
    usedAt: null,
    usedByUid: null,
  });

  return token;
};

// Fetch an invite document by token. Returns null if not found.
export const getInvite = async (token) => {
  try {
    const snap = await getDoc(doc(firestoreDb, `invites/${token}`));
    return snap.exists() ? { token, ...snap.data() } : null;
  } catch {
    return null;
  }
};

// Mark an invite as used — called after successful role write.
export const markInviteUsed = async (token, uid) => {
  await updateDoc(doc(firestoreDb, `invites/${token}`), {
    usedAt: new Date().toISOString(),
    usedByUid: uid,
  });
};
