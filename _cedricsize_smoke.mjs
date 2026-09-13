/* 🧍 v121v153 — CEDRIC, MUCH BIGGER. Run: node _cedricsize_smoke.mjs

   Owner, looking at the menu: "Make him much bigger."

   The interesting part is not the numbers, it is that `object-fit: contain`
   binds on whichever cap is TIGHTER — so the height box and the image's bottom
   offset are one decision written twice, and a narrow screen needs both halves
   overridden or it gets the worse half of the pair. That is what these checks
   protect, and it is the bug this release shipped and then fixed after looking
   at a phone. */
import { readFileSync } from 'fs';
let fails = 0;
const ok = (c, m, x) => { console.log((c ? '  PASS ' : '  FAIL ') + m + (c || x === undefined ? '' : '  ← ' + x)); if (!c) fails++; };
const MM  = readFileSync('./public/main-menu/index.html', 'utf8').replace(/\r\n/g, '\n');
const SRC = readFileSync('./public/index.html', 'utf8').replace(/\r\n/g, '\n');

/* ── the asset grew FIRST, so bigger does not mean blurrier ───────────────── */
{
  const buf = readFileSync('./public/assets/artwork/ui/cedric-idle.webp');
  ok(buf.length > 1000000 && buf.length < 6000000,
    'the loop is still under the 6.0MB the whole-body loop used to cost',
    (buf.length / 1048576).toFixed(2) + 'MB');
  /* WebP VP8X canvas size: bytes 24..29 of the RIFF are width-1 / height-1, 24-bit LE */
  const s = buf.toString('latin1');
  const i = s.indexOf('VP8X');
  ok(i > 0, 'the file is an extended (animated) WebP');
  if (i > 0) {
    const w = 1 + (buf[i + 12] | (buf[i + 13] << 8) | (buf[i + 14] << 16));
    const h = 1 + (buf[i + 15] | (buf[i + 16] << 8) | (buf[i + 17] << 16));
    ok(w === 768 && h === 1152,
      'THE LOOP IS AT THE SOURCE\'S NATIVE 768x1152 — the box was grown, so leaving the asset at 640 would have made him bigger AND softer, which is not what bigger means',
      w + 'x' + h);
  }
  const still = readFileSync('./public/assets/artwork/ui/cedric-still.webp');
  ok(still.length > 20000 && still.length < 900000, 'the still is still cheap', (still.length / 1024).toFixed(0) + 'KB');
}

/* ── the box, and the pair that makes the overflow work ───────────────────── */
{
  const m = MM.match(/\.char-stage\{\s*\n\s*position:fixed[^}]*?width:min\((\d+)vw, (\d+)px\); height:(\d+)vh;/);
  ok(!!m, 'the char-stage box is readable from the CSS');
  if (m) {
    const [, vw, px, vh] = m.map(Number);
    ok(vh > 100, 'IT IS TALLER THAN THE SCREEN on purpose — a head-to-toe figure caps out at exactly 100vh, which measured only +16% over the old 86vh', vh + 'vh');
    ok(vh >= 115, '…and by enough to read as "much bigger" (+37% linear, +88% area against 86vh)', vh + 'vh');
    ok(vw >= 80 && px >= 1300,
      'the width cap was raised alongside it, so a short wide window does not quietly become the binding cap instead', vw + 'vw / ' + px + 'px');
    const off = Number((MM.match(/\.char-img\{[^}]*?bottom:-(\d+)vh;/s) || [])[1]);
    ok(off === vh - 100,
      'THE IMAGE OFFSET EQUALS THE OVERFLOW — the pair is one decision written twice, and splitting them crops his head instead of his boots',
      '-' + off + 'vh vs ' + (vh - 100) + 'vh');
  }
}
ok(/crop the HEAD — never/.test(MM) || /cropped at the head instead/.test(MM),
  'which part leaves the frame is written down: the boots, never the head');

/* ── the narrow screens get BOTH halves overridden ────────────────────────── */
{
  const lo = MM.indexOf('@media (max-width: 900px)');
  const hi = MM.indexOf('@media', lo + 10);
  ok(lo > 0, 'the narrow breakpoint is locatable');
  const blk = MM.slice(lo, hi > lo ? hi : lo + 2500);
  ok(/\.char-stage\{ width:88vw; height:100vh;/.test(blk),
    'a narrow screen gets the taller WIDTH but NOT the overflow height');
  ok(/\.char-img\{ bottom:-2vh; \}/.test(blk),
    'AND the bottom offset is restored with it — on a phone the WIDTH binds, so the figure never grows into the tall box and the push would only drop him below the fold (measured: head 459px down the page, most of him behind the nav)');
}

/* ── run the fit rule for real ────────────────────────────────────────────── */
{
  const ART_W = 768, ART_H = 1152;
  const fit = (vw, vh, capVw, capPx, capVh) => {
    const boxW = Math.min(vw * capVw / 100, capPx), boxH = vh * capVh / 100;
    const k = Math.min(boxW / ART_W, boxH / ART_H);
    return { h: ART_H * k, boundBy: (boxW / ART_W < boxH / ART_H) ? 'width' : 'height' };
  };
  const oldD = fit(1920, 1080, 46, 760, 86), newD = fit(1920, 1080, 86, 1420, 118);
  ok(newD.boundBy === 'height', 'run for real: on a desktop the HEIGHT is the binding cap, which is why raising it is what does the work');
  ok(newD.h / oldD.h > 1.3, 'run for real: he is more than a third taller than before', '+' + Math.round((newD.h / oldD.h - 1) * 100) + '%');
  ok(newD.h > 1080, 'run for real: …and overflows the viewport, which is the only way past a head-to-toe cap');

  const phone = fit(375, 812, 88, 1420, 118);
  ok(phone.boundBy === 'width',
    'run for real: ON A PHONE THE WIDTH BINDS — so the tall box buys nothing there and the matching push would be pure loss, which is exactly why the breakpoint overrides both');
  const oldP = fit(375, 812, 64, 1420, 86);
  ok(phone.h > oldP.h, 'run for real: he is still bigger on a phone than before', '+' + Math.round((phone.h / oldP.h - 1) * 100) + '%');
}

/* the knobs */
const v = (SRC.match(/window\.BUILD_VERSION = '([^']+)'/) || [])[1];
ok(parseInt((v || '').replace('v121v', ''), 10) >= 153, 'BUILD_VERSION is v121v153 or later', v);
ok(readFileSync('./public/version.txt', 'utf8').trim() === v, 'version.txt equals BUILD_VERSION');
ok(new RegExp("CACHE_VERSION = 'mythic-" + v + "-").test(readFileSync('./public/sw.js', 'utf8')), 'sw.js carries the build');
ok(new RegExp('window\\.NC_BUILD = "' + v + '-').test(readFileSync('./public/node-city/index.html', 'utf8')), 'NC_BUILD carries the build');
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
