// scripts/checkUser.js
//
// Look up a Firebase Auth user by UID or email and print their identity,
// providers, and custom claims (including the superadmin flag).
//
// Usage:
//   node scripts/checkUser.js <UID>
//   node scripts/checkUser.js --email=user@example.com
//
// Requires: scripts/serviceAccountKey.json (gitignored)

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, 'serviceAccountKey.json');

if (!existsSync(KEY_PATH)) {
  console.error(`\n  Missing service account key at ${KEY_PATH}\n`);
  process.exit(1);
}

initializeApp({ credential: cert(JSON.parse(readFileSync(KEY_PATH, 'utf8'))) });
const auth = getAuth();

const argv = process.argv.slice(2);
const emailArg = argv.find((a) => a.startsWith('--email='));
const uidArg = argv.find((a) => !a.startsWith('--'));

if (!emailArg && !uidArg) {
  console.error('\n  Usage:');
  console.error('    node scripts/checkUser.js <UID>');
  console.error('    node scripts/checkUser.js --email=user@example.com\n');
  process.exit(1);
}

const main = async () => {
  const user = emailArg
    ? await auth.getUserByEmail(emailArg.split('=')[1])
    : await auth.getUser(uidArg);

  const claims = user.customClaims || {};
  const isSuperadmin = claims.superadmin === true;

  console.log('');
  console.log('  UID:           ', user.uid);
  console.log('  Email:         ', user.email || '(none)');
  console.log('  Display name:  ', user.displayName || '(none)');
  console.log('  Email verified:', user.emailVerified);
  console.log('  Disabled:      ', user.disabled);
  console.log('  Created:       ', user.metadata.creationTime);
  console.log('  Last sign-in:  ', user.metadata.lastSignInTime || '(never)');
  console.log('  Providers:     ', user.providerData.map((p) => p.providerId).join(', ') || '(none — anonymous)');
  console.log('  Custom claims: ', Object.keys(claims).length ? JSON.stringify(claims) : '(none)');
  console.log('');
  console.log(`  Superadmin:    ${isSuperadmin ? 'YES' : 'no'}`);
  console.log('');
};

main().catch((err) => {
  if (err?.code === 'auth/user-not-found') {
    console.error('\n  User not found.\n');
    process.exit(2);
  }
  console.error('\n  Lookup failed:', err?.message || err, '\n');
  process.exit(1);
});
