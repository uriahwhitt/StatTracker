// ── Role resolution helpers — Phase 2 Gate 2 / Gate 3 ─────────────────────────
// Exports: getUserRole, canWrite, getOrgForUser, getRoleStatus,
//          writeRoleDoc, removeRole, updateMemberRole,
//          getOrgMembers

import { db as firestoreDb } from '../firebase';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs } from 'firebase/firestore';

// Get the active role document for a user in a specific org.
// Returns null if the user has no role or if the role has been soft-removed.
export const getUserRole = async (uid, orgId) => {
  try {
    const ref = doc(firestoreDb, `users/${uid}/roles/${orgId}`);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data();
    if (data.removedAt) return null; // treat soft-removed roles as non-existent
    return data;
  } catch {
    return null;
  }
};

// Returns true if the user can write to org data (owner or headcoach, not removed).
export const canWrite = async (uid, orgId) => {
  const role = await getUserRole(uid, orgId);
  if (!role) return false;
  return ['owner', 'headcoach'].includes(role.role);
};

// Returns the first active org the user belongs to as { orgId, role, teamId, ... },
// or null if the user has no active org membership.
export const getOrgForUser = async (uid) => {
  try {
    const rolesRef = collection(firestoreDb, `users/${uid}/roles`);
    const snap = await getDocs(rolesRef);
    if (snap.empty) return null;
    const active = snap.docs.find(d => !d.data().removedAt);
    if (!active) return null;
    return { orgId: active.id, ...active.data() };
  } catch {
    return null;
  }
};

// Returns the full role doc including removedAt — for management/admin use.
// Does NOT filter out removed roles.
export const getRoleStatus = async (uid, orgId) => {
  try {
    const ref = doc(firestoreDb, `users/${uid}/roles/${orgId}`);
    const snap = await getDoc(ref);
    return snap.exists() ? { orgId, ...snap.data() } : null;
  } catch {
    return null;
  }
};

// Write a role doc to users/{uid}/roles/{orgId}.
// Also writes a denormalized member doc to orgs/{orgId}/members/{uid} when
// memberProfile is provided — required for the Members list UI.
// memberProfile: { displayName, email, photoURL }
export const writeRoleDoc = async (uid, orgId, roleData, memberProfile) => {
  const fullRole = {
    status: 'active',
    removedAt: null,
    removedBy: null,
    ...roleData,
  };
  await setDoc(doc(firestoreDb, `users/${uid}/roles/${orgId}`), fullRole);
  if (memberProfile) {
    await setDoc(doc(firestoreDb, `orgs/${orgId}/members/${uid}`), {
      uid,
      displayName: memberProfile.displayName || '',
      email: memberProfile.email || '',
      photoURL: memberProfile.photoURL || null,
      ...fullRole,
    });
  }
};

// Soft-removes a role: sets removedAt + removedBy on both the user role doc
// and the org member doc. The role document is not deleted.
export const removeRole = async (uid, orgId, removedByUid) => {
  const now = new Date().toISOString();
  const update = { removedAt: now, removedBy: removedByUid };
  await updateDoc(doc(firestoreDb, `users/${uid}/roles/${orgId}`), update);
  // Best-effort update to org members doc
  await updateDoc(doc(firestoreDb, `orgs/${orgId}/members/${uid}`), update).catch(() => {});
};

// Update a member's role (for role transfer / change role).
// Also writes an audit log entry.
export const updateMemberRole = async (uid, orgId, newRole, updatedByUid) => {
  const now = new Date().toISOString();
  const update = {
    role: newRole,
    status: 'active',
    grantedByUid: updatedByUid,
    grantedAt: now,
  };
  await updateDoc(doc(firestoreDb, `users/${uid}/roles/${orgId}`), update);
  await updateDoc(doc(firestoreDb, `orgs/${orgId}/members/${uid}`), update).catch(() => {});
};

// Returns all active roles for a user across all orgs.
export const getAllUserRoles = async (uid) => {
  try {
    const snap = await getDocs(collection(firestoreDb, `users/${uid}/roles`));
    return snap.docs
      .filter(d => !d.data().removedAt)
      .map(d => ({ orgId: d.id, ...d.data() }));
  } catch {
    return [];
  }
};

// List all members of an org from the denormalized orgs/{orgId}/members collection.
// Includes removed members — filter by removedAt in the UI as needed.
export const getOrgMembers = async (orgId) => {
  try {
    const snap = await getDocs(collection(firestoreDb, `orgs/${orgId}/members`));
    return snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  } catch {
    return [];
  }
};
