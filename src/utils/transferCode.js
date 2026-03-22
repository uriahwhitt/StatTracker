// ── Transfer Code — Device Linking (One-Time Data Copy) ───────────────────────
//
// This is a TEMPORARY bridge until Google Sign-in is implemented in Phase 2.
//
// HOW IT WORKS (Data Copy approach — not shared UID):
//   Device A generates a code → Firestore stores { uid, expiresAt }
//   Device B enters code → reads Device A's Firestore document →
//   copies that data to Device B's own Firestore path → both devices
//   now have identical data but continue writing to their own separate paths.
//
// LIMITATION: This is a one-time sync snapshot. Changes made on Device A
// after linking are NOT reflected on Device B and vice versa. Real-time
// multi-device sync requires proper authentication (Phase 2 — Google Sign-in).
//
// FIRESTORE SECURITY RULES (as deployed):
//
//   match /users/{userId}/data/db {
//     allow read, write: if request.auth != null && request.auth.uid == userId;
//   }
//   match /transferCodes/{code} {
//     allow create: if request.auth != null;
//     allow read:   if request.auth != null;                              // any authed user can redeem
//     allow delete: if request.auth != null && resource.data.uid == request.auth.uid;  // owner only
//   }
//   match /users/{userId}/data/db {
//     allow read: if request.auth != null;                               // any authed user can copy data
//   }
//
// BEHAVIORAL NOTE: Device B cannot delete the transfer code after redeeming it
// (delete is owner-only and Device B's UID ≠ code creator's UID). The deleteDoc
// call in redeemTransferCode will fail silently via .catch(() => {}). This is
// acceptable — the code expires naturally after 10 minutes regardless.

import { db as firestoreDb } from '../firebase';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

const EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

// Generates a random 6-character alphanumeric code.
// Excludes O, 0, I, 1 to avoid visual confusion.
export const generateCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
};

// Returns display format: "X7K-2P9"
export const formatCode = (code) => `${code.slice(0, 3)}-${code.slice(3)}`;

// Normalizes input: strips dashes, uppercases
const normalizeCode = (raw) => raw.replace(/-/g, '').toUpperCase().trim();

// ── Device A: create a transfer code ─────────────────────────────────────────
export const createTransferCode = async (uid) => {
  const code = generateCode();
  const ref = doc(firestoreDb, 'transferCodes', code);
  await setDoc(ref, {
    uid,
    createdAt: serverTimestamp(),
    expiresAt: Date.now() + EXPIRY_MS,
  });
  return code;
};

// ── Device B: redeem a transfer code (data copy) ──────────────────────────────
export const redeemTransferCode = async (rawCode, currentUid) => {
  const code = normalizeCode(rawCode);
  if (code.length !== 6) throw new Error('Invalid code format. Enter the 6-character code from the other device.');

  // 1. Read the transfer code document
  const codeRef = doc(firestoreDb, 'transferCodes', code);
  const codeSnap = await getDoc(codeRef);

  if (!codeSnap.exists()) {
    throw new Error('Code not found or expired. Ask the other device to generate a new one.');
  }

  const { uid: sourceUid, expiresAt } = codeSnap.data();

  // 2. Check expiry
  if (expiresAt < Date.now()) {
    await deleteDoc(codeRef).catch(() => {});
    throw new Error('Code not found or expired. Ask the other device to generate a new one.');
  }

  // 3. Read source device's Firestore data
  const sourceRef = doc(firestoreDb, `users/${sourceUid}/data/db`);
  const sourceSnap = await getDoc(sourceRef);

  if (!sourceSnap.exists()) {
    throw new Error('Could not read data from the source device. Try again.');
  }

  // 4. Copy to this device's Firestore document (full overwrite)
  const destRef = doc(firestoreDb, `users/${currentUid}/data/db`);
  await setDoc(destRef, sourceSnap.data());

  // 5. Store a debug marker in localStorage
  localStorage.setItem('linked_from_uid', sourceUid);

  // 6. Delete the transfer code
  await deleteDoc(codeRef).catch(() => {});
};

// ── Device A: cancel / delete a transfer code ─────────────────────────────────
export const deleteTransferCode = async (code) => {
  const ref = doc(firestoreDb, 'transferCodes', code);
  await deleteDoc(ref);
};

// ── Device B: refresh from source (re-copy data from linked device) ───────────
// Requires linked_from_uid to be set in localStorage (written during redemption).
// Returns the new db data so the caller can update React state if available;
// falls back to window.location.reload() if state update isn't plumbed through.
export const refreshFromSource = async (currentUid) => {
  const sourceUid = localStorage.getItem('linked_from_uid');
  if (!sourceUid) throw new Error('No source device linked.');

  // Read source device's current Firestore data
  const sourceRef = doc(firestoreDb, `users/${sourceUid}/data/db`);
  const sourceSnap = await getDoc(sourceRef);

  if (!sourceSnap.exists()) {
    throw new Error('Could not reach source device data. Make sure the source device has been used recently.');
  }

  const newData = sourceSnap.data();

  // Overwrite this device's Firestore document
  const destRef = doc(firestoreDb, `users/${currentUid}/data/db`);
  await setDoc(destRef, newData);

  // Update localStorage cache
  try { localStorage.setItem('bball_tracker_v2', JSON.stringify(newData)); } catch { /* quota */ }

  // Record sync timestamp
  localStorage.setItem('last_sync_at', new Date().toISOString());

  return newData;
};
