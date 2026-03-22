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
// FIRESTORE SECURITY RULES REQUIRED:
//   match /transferCodes/{code} {
//     allow create: if request.auth != null;
//     allow read, delete: if request.auth != null;   // any authed user can read/redeem
//   }
//   match /users/{userId}/data/db {
//     allow read: if request.auth != null;           // needed for data copy
//     allow write: if request.auth.uid == userId;
//   }

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
