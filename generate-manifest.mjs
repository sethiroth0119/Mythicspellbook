// generate-manifest.mjs — write public/asset-manifest.json for the in-game
// "Download game data" precache flow (Settings → Device Storage).
//
// Scans public/assets/ (which only exists in full on the dev machine — the
// code-only mirror doesn't carry the ~2.5 GB) and lists every file that will
// actually be deployed: entries matched by public/.assetsignore or over
// Cloudflare's 25 MiB per-asset cap are excluded, because requesting them
// in-game would 404 and count as a failed download.
//
// Output shape (kept terse — the manifest itself ships to every player):
//   { generated, count, totalBytes, files: [{ u: '/assets/…', s: bytes }] }
//
// URLs are per-path-segment encodeURIComponent'd so they compare equal to
// Request.url pathnames when the precache checks what it already has.
//
// Usage:  node generate-manifest.mjs        (also runs inside `npm run deploy`)

import fs from 'node:fs';
import path from 'node:path';

const PUBLIC = path.resolve('public');
const ASSETS = path.join(PUBLIC, 'assets');
const OUT = path.join(PUBLIC, 'asset-manifest.json');
const IGNORE_FILE = path.join(PUBLIC, '.assetsignore');
const MAX_BYTES = 25 * 1024 * 1024; // Cloudflare Workers static-asset cap

// Parse the (simple) subset of .assetsignore patterns this repo uses:
// directory prefixes ('assets/Exports/'), exact file paths, and '*.ext'.
function loadIgnoreRules() {
  const rules = { dirs: [], files: [], exts: [] };
  let raw = '';
  try { raw = fs.readFileSync(IGNORE_FILE, 'utf8'); } catch (e) { return rules; }
  for (let line of raw.split('\n')) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('*.')) rules.exts.push(line.slice(1).toLowerCase());
    else if (line.endsWith('/')) rules.dirs.push(line);
    else rules.files.push(line);
  }
  return rules;
}

function isIgnored(rel, rules) {
  const lower = rel.toLowerCase();
  if (rules.dirs.some((d) => rel.startsWith(d))) return true;
  if (rules.files.includes(rel)) return true;
  if (rules.exts.some((e) => lower.endsWith(e))) return true;
  return false;
}

export function generateManifest() {
  if (!fs.existsSync(ASSETS)) {
    // The code-only mirror / CI checkout has no assets folder. Keep any
    // previously-generated manifest rather than clobbering it with [].
    console.log('⚠  no public/assets folder here — skipping manifest generation' +
      (fs.existsSync(OUT) ? ' (existing manifest kept)' : ''));
    return null;
  }
  const rules = loadIgnoreRules();
  const files = [];
  let skipped = 0;
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const abs = path.join(dir, name);
      const st = fs.statSync(abs);
      // rel is the path under public/, forward-slashed, e.g. 'assets/Audio/x.mp3'
      const rel = path.relative(PUBLIC, abs).split(path.sep).join('/');
      if (st.isDirectory()) {
        if (rules.dirs.some((d) => (rel + '/').startsWith(d))) { skipped++; continue; }
        walk(abs);
        continue;
      }
      if (isIgnored(rel, rules) || st.size > MAX_BYTES || name.startsWith('.')) { skipped++; continue; }
      const u = '/' + rel.split('/').map(encodeURIComponent).join('/');
      files.push({ u, s: st.size });
    }
  };
  walk(ASSETS);
  files.sort((a, b) => (a.u < b.u ? -1 : 1));
  const totalBytes = files.reduce((n, f) => n + f.s, 0);
  const manifest = {
    generated: new Date().toISOString(),
    count: files.length,
    totalBytes,
    files,
  };
  fs.writeFileSync(OUT, JSON.stringify(manifest));
  console.log('✓ asset-manifest.json — ' + files.length + ' files, ' +
    (totalBytes / 1e6).toFixed(1) + ' MB' + (skipped ? ' (' + skipped + ' excluded)' : ''));
  return manifest;
}

const arg = process.argv[1] || '';
if (import.meta.url === 'file://' + arg.replace(/\\/g, '/')) {
  generateManifest();
}
