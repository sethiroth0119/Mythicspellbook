// build.mjs — minify the inline <script> block in public/index.html.
//
// The deployed file is ~4.7 MB unminified; that's a 2-3 second parse cost on
// every first load. Minifying with Terser drops it to ~1.5 MB → much snappier
// first paint and the whole game feels less "website" and more "game."
//
// Strategy: in-place minify with a backup so the user keeps editing
// public/index.html directly (no src/ split, no asset re-copying — the
// public/ dir holds 2.5 GB of game assets that we DON'T want to copy on
// every deploy). deploy.mjs wraps:  minify → wrangler deploy → restore.
//
// Usage:
//   node build.mjs minify    → backs up + writes minified to public/index.html
//   node build.mjs restore   → restores public/index.html from backup
//
// If anything goes wrong, run `node build.mjs restore` to recover the source.

import fs from 'node:fs';
import path from 'node:path';
import { minify as terserMinify } from 'terser';

const PUBLIC = path.resolve('public');
const SRC = path.join(PUBLIC, 'index.html');
const BACKUP = path.join(PUBLIC, '.index.dev.html');
const SENTINEL = '<!--MIN-->';

// Match EVERY inline <script> block (no src=, no type="application/json").
// ⚠ This must be /g — the file has TWO inline blocks (the small PWA bootstrap
// added in <head> and the 5MB+ main game script after it). The old non-global
// regex silently minified only the FIRST (tiny) block, shipping the main
// script unminified — the whole point of this build step.
const SCRIPT_RE = /(<script(?![^>]*\bsrc=)(?![^>]*\btype=["'][^"']*json[^"']*["'])[^>]*>)([\s\S]*?)(<\/script>)/gi;

// Conservative Terser options — string-keyed property access is heavy in this
// codebase (Profile['gems'], dynamic event-handler IDs, etc.), so:
//  • keep_fnames / keep_classnames preserve function references used by
//    inline onclick attributes and string-based dispatch tables.
//  • reserved keeps the top-level state singletons that the rest of the code
//    accesses by name from many places.
const TERSER_OPTS = {
  compress: {
    drop_debugger: true,
    passes: 1,
    // Don't drop console — useful in the field for diagnosing player reports.
    drop_console: false,
    // The codebase relies on left-to-right evaluation of side effects in
    // a few places (the gems setter, save scheduling) — disable risky
    // optimizations that could change order.
    sequences: false,
    join_vars: false,
  },
  // ⚠ Mangle is DISABLED. The codebase has inline onclick="someFn()" and
  // other string-based dispatch tables that depend on top-level function
  // names being unchanged. Mangling broke at least one network/auth path
  // ("failed to fetch" on Sign In) — turning it off keeps the ~30% win from
  // whitespace + comment + dead-code removal without the risk. Re-enabling
  // requires a full audit of every inline onclick and string-keyed handler.
  mangle: false,
  format: { comments: false, ecma: 2020 },
  ecma: 2020,
  sourceMap: false,
};

export async function minify() {
  console.log('🔨 reading', SRC);
  const html = fs.readFileSync(SRC, 'utf8');
  if (html.startsWith(SENTINEL)) {
    console.log('✓ already minified — restoring source first so we re-minify fresh');
    await restore();
    return minify();
  }
  console.log('💾 backing up source →', path.basename(BACKUP));
  fs.writeFileSync(BACKUP, html);
  const matches = [...html.matchAll(SCRIPT_RE)].filter(m => m[2].trim().length > 0);
  if (!matches.length) throw new Error('Could not find inline <script> block in ' + SRC);
  // Rebuild the HTML walking the matches in order; indexOf + slice keeps the
  // substitution literal. ⚠ Don't use String.replace() — minified JS contains
  // $&, $1 etc. that String.replace interprets as backreferences, ballooning
  // the file 3x.
  let out = '';
  let cursor = 0;
  const t0 = Date.now();
  for (const m of matches) {
    const [whole, open, body, close] = m;
    const idx = m.index;
    console.log('⚙️  minifying', body.length.toLocaleString(), 'chars of JS …');
    const result = await terserMinify(body, TERSER_OPTS);
    if (result.error) throw result.error;
    if (!result.code) throw new Error('Terser returned empty output.');
    const pct = (1 - result.code.length / body.length) * 100;
    console.log('   ✓ ' + result.code.length.toLocaleString() + ' chars (' + pct.toFixed(1) + '% smaller)');
    out += html.slice(cursor, idx) + open + result.code + close;
    cursor = idx + whole.length;
  }
  out += html.slice(cursor);
  const dt = Date.now() - t0;
  const minHtml = SENTINEL + out;
  fs.writeFileSync(SRC, minHtml);
  console.log('✓ wrote minified', SRC, '(' + minHtml.length.toLocaleString() + ' chars total) in ' + (dt / 1000).toFixed(1) + 's');
}

export async function restore() {
  if (!fs.existsSync(BACKUP)) {
    console.log('⚠  no backup file at', BACKUP, '— nothing to restore');
    return;
  }
  const src = fs.readFileSync(BACKUP, 'utf8');
  fs.writeFileSync(SRC, src);
  fs.unlinkSync(BACKUP);
  console.log('✓ restored', SRC, 'from backup');
}

const arg = (process.argv[2] || '').toLowerCase();
if (import.meta.url === 'file://' + process.argv[1].replace(/\\/g, '/')) {
  if (arg === 'minify') {
    minify().catch(e => { console.error('❌', e.message); process.exit(1); });
  } else if (arg === 'restore') {
    restore().catch(e => { console.error('❌', e.message); process.exit(1); });
  } else {
    console.log('Usage: node build.mjs [minify|restore]');
  }
}
