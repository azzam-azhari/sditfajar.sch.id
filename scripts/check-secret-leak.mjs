#!/usr/bin/env node
// ==============================================================================
// ZERO SECRET LEAK — pindai bundle browser hasil `next build` (.next/static)
// untuk nilai rahasia server. Jalankan SETELAH build: `npm run check:secrets`.
// Nilai dibaca dari environment atau .env.local; nilai tidak pernah dicetak.
// ==============================================================================
import fs from 'node:fs';
import path from 'node:path';

const SECRET_NAMES = ['SUPABASE_SERVICE_ROLE_KEY', 'MIDTRANS_SERVER_KEY'];
const STATIC_DIR = path.resolve(process.env.NEXT_DIST_DIR || '.next', 'static');

function readEnvFile(file) {
  if (!fs.existsSync(file)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=');
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
      })
  );
}

const fileEnv = readEnvFile(path.resolve('.env.local'));
const secrets = SECRET_NAMES.map((name) => ({ name, value: process.env[name] || fileEnv[name] || '' })).filter(
  (s) => s.value.length >= 16
);

if (!fs.existsSync(STATIC_DIR)) {
  console.error('Folder .next/static tidak ada. Jalankan `npm run build` terlebih dahulu.');
  process.exit(2);
}

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let scanned = 0;
const leaks = [];
for (const file of walk(STATIC_DIR)) {
  if (!/\.(js|css|html|json|map|txt)$/.test(file)) continue;
  const content = fs.readFileSync(file, 'utf8');
  scanned++;
  for (const s of secrets) {
    if (content.includes(s.value)) leaks.push({ name: s.name, file: path.relative(process.cwd(), file) });
  }
  // Nama variabel rahasia tidak boleh dirujuk dari kode browser sama sekali.
  for (const name of SECRET_NAMES) {
    if (content.includes(name)) leaks.push({ name: `${name} (nama variabel)`, file: path.relative(process.cwd(), file) });
  }
}

if (secrets.length === 0) {
  console.warn('Peringatan: tidak ada nilai rahasia yang bisa dicocokkan (env belum diisi); hanya nama variabel yang dipindai.');
}

if (leaks.length > 0) {
  console.error(`GAGAL: ${leaks.length} kebocoran ditemukan di bundle browser:`);
  for (const l of leaks) console.error(`  - ${l.name} di ${l.file}`);
  process.exit(1);
}

console.log(`OK: ${scanned} berkas bundle browser dipindai, ${secrets.length} nilai rahasia diperiksa, tidak ada kebocoran.`);
