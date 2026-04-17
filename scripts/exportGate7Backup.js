// scripts/exportGate7Backup.js
//
// One-shot pre-Gate-7 backup. Reads orgs/{orgId}/data/db via the Firebase
// Admin SDK and writes per-collection JSON snapshots into backup/.
//
// Usage:
//   1. Drop your service account key at scripts/serviceAccountKey.json (gitignored).
//   2. List orgs:               node scripts/exportGate7Backup.js
//      (or: npm run backup:gate7)
//   3. Run the backup:          node scripts/exportGate7Backup.js --org=<ORGID>
//
// Output:
//   backup/gate7-<timestamp>/
//     manifest.json         metadata + counts + sourcePath
//     scorebookGames.json   full event logs
//     games.json            per-player stat records
//     players.json          player roster
//     db-full.json          complete raw db doc (full rollback safety net)

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const KEY_PATH = resolve(__dirname, 'serviceAccountKey.json');

if (!existsSync(KEY_PATH)) {
  console.error(`\n  Missing service account key at:\n    ${KEY_PATH}\n`);
  console.error('  Download a key from Firebase Console → Project Settings →');
  console.error('  Service accounts → Generate new private key, then save it');
  console.error('  to the path above. The file is gitignored.\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
initializeApp({ credential: cert(serviceAccount) });
const fs = getFirestore();

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  })
);

// Convert Admin SDK Timestamps to a portable ISO form so the backup is
// human-readable and survives round-trips through plain JSON tooling.
const normalize = (v) => {
  if (v === null || v === undefined) return v;
  if (v instanceof Timestamp) {
    return { __ts: true, iso: v.toDate().toISOString(), seconds: v.seconds, nanos: v.nanoseconds };
  }
  if (Array.isArray(v)) return v.map(normalize);
  if (typeof v === 'object') {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, normalize(x)]));
  }
  return v;
};

const writeJson = (path, value) => {
  const json = JSON.stringify(value, null, 2);
  writeFileSync(path, json, 'utf8');
  return json.length;
};

const fmt = (n) => n.toLocaleString('en-US');

const main = async () => {
  const orgsSnap = await fs.collection('orgs').get();
  if (orgsSnap.empty) {
    console.error(`\n  No orgs found in project "${serviceAccount.project_id}".\n`);
    process.exit(1);
  }

  console.log(`\n  Project: ${serviceAccount.project_id}`);
  console.log(`  Found ${orgsSnap.size} org(s):\n`);

  const orgList = [];
  for (const orgDoc of orgsSnap.docs) {
    const data = orgDoc.data() || {};
    const name = data.name || data.displayName || '(unnamed)';
    const dbDocSnap = await fs.doc(`orgs/${orgDoc.id}/data/db`).get();
    const d = dbDocSnap.exists ? dbDocSnap.data() : {};
    const counts = {
      scorebookGames: d.scorebookGames?.length ?? 0,
      games: d.games?.length ?? 0,
      players: d.players?.length ?? 0,
      teams: d.teams?.length ?? 0,
    };
    orgList.push({ id: orgDoc.id, name, counts });
    console.log(`    ${orgDoc.id}  ${name}`);
    console.log(
      `      scorebookGames=${counts.scorebookGames}  games=${counts.games}  ` +
      `players=${counts.players}  teams=${counts.teams}`
    );
  }
  console.log('');

  if (!args.org) {
    console.log('  To perform the backup, re-run with --org=<ORGID>. Example:');
    console.log(`    node scripts/exportGate7Backup.js --org=${orgList[0].id}\n`);
    process.exit(0);
  }

  const orgId = String(args.org);
  const target = orgList.find((o) => o.id === orgId);
  if (!target) {
    console.error(`\n  Org "${orgId}" not found in project. Aborting.\n`);
    process.exit(1);
  }

  console.log(`  Exporting org "${orgId}" (${target.name})...`);
  const snap = await fs.doc(`orgs/${orgId}/data/db`).get();
  if (!snap.exists) {
    console.error(`\n  No db doc at orgs/${orgId}/data/db. Aborting.\n`);
    process.exit(1);
  }
  const raw = snap.data();
  const dbData = normalize(raw);

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = resolve(ROOT, 'backup', `gate7-${ts}`);
  mkdirSync(outDir, { recursive: true });

  const counts = {
    scorebookGames: dbData.scorebookGames?.length ?? 0,
    games: dbData.games?.length ?? 0,
    players: dbData.players?.length ?? 0,
    teams: dbData.teams?.length ?? 0,
    organizations: dbData.organizations?.length ?? 0,
    tournaments: dbData.tournaments?.length ?? 0,
    scheduledGames: dbData.scheduledGames?.length ?? 0,
  };

  const manifest = {
    exportedAt: new Date().toISOString(),
    projectId: serviceAccount.project_id,
    orgId,
    orgName: target.name,
    sourcePath: `orgs/${orgId}/data/db`,
    counts,
    files: {
      scorebookGames: 'scorebookGames.json',
      games: 'games.json',
      players: 'players.json',
      fullDb: 'db-full.json',
    },
    timestampEncoding: 'Firestore Timestamps are encoded as { __ts: true, iso, seconds, nanos }',
    note: 'Pre-Gate-7 backup. db-full.json is the complete raw db doc for full rollback. Per-collection files are convenience views.',
  };

  const writes = [
    ['manifest.json', manifest],
    ['scorebookGames.json', dbData.scorebookGames ?? []],
    ['games.json', dbData.games ?? []],
    ['players.json', dbData.players ?? []],
    ['db-full.json', dbData],
  ];

  console.log('');
  for (const [name, value] of writes) {
    const bytes = writeJson(resolve(outDir, name), value);
    console.log(`    wrote ${name.padEnd(22)} ${fmt(bytes).padStart(12)} bytes`);
  }

  console.log('');
  console.log(`  Counts: scorebookGames=${counts.scorebookGames}  games=${counts.games}  players=${counts.players}`);
  console.log(`  Backup complete: ${outDir}\n`);
};

main().catch((err) => {
  console.error('\n  Backup failed:', err?.stack || err, '\n');
  process.exit(1);
});
