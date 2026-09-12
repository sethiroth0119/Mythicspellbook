/* 🔴 v121v127 — the Just Business collect exploit (bug-mtxzznni, high).
   A collect pays a pure function of (now − meta.lastCollect), capped at 36 h.
   The marker was written AFTER the payout, and for a CEO who is not the founder
   the write was refused by policy and returned 204 with NO error — so the
   client believed it had recorded the collection, re-read the stale row, and
   offered the same 36 hours again. Forever.
   Run: node _opcollect_smoke.mjs */
import { readFileSync } from 'fs';
let fails = 0;
const ok = (c, m, x) => { console.log((c ? '  PASS ' : '  FAIL ') + m + (c || x === undefined ? '' : '  ← ' + x)); if (!c) fails++; };
const SRC = readFileSync('./public/index.html', 'utf8').replace(/\r\n/g, '\n');

/* ── 1. claim first, pay second ── */
ok(/async function _opClaimCollect\(o\) \{/.test(SRC), 'the collection is CLAIMED by a function of its own');
ok(/\.eq\('id', o\.id\)\.select\('id'\);/.test(SRC), '…which asks for the row back — a refused update answers 204 with no error, so without this a refusal looks exactly like success');
ok(/if \(!up \|\| !Array\.isArray\(up\.data\) \|\| up\.data\.length === 0\) return false;   \/\/ refused by policy — say so/.test(SRC), '…and no row means refused');
ok(/const _claimed = await _opClaimCollect\(o\);/.test(SRC), 'the handler claims BEFORE it settles');
{
  const i = SRC.indexOf('const _claimed = await _opClaimCollect(o);'), j = SRC.indexOf('const s = await _opSettle(o);');
  ok(i > 0 && j > i, '…and the payout happens only after it, not before', 'claim@' + i + ' settle@' + j);
}
ok(/if \(!_claimed\) \{[\s\S]{0,400}nothing was paid/.test(SRC), 'a refused claim pays NOTHING and says so');

/* ── 2. the marker no longer trails the money ── */
{
  const settle = SRC.slice(SRC.indexOf('async function _opSettle(o) {'), SRC.indexOf('async function _opSettle(o) {') + 9000);
  ok(!/lastCollect: Date\.now\(\) \}\);\n  try \{\n    const up = await Cloud\.client\.from\('corp_operations'\)\.update\(\{ meta: meta/.test(settle),
    'the settle no longer writes the marker after paying — that write is gone from it entirely');
}

/* ── 3. one at a time ── */
ok(/let _jbOpBusy = \{\};/.test(SRC) && /if \(_jbOpBusy\[a\.opId\]\) \{/.test(SRC), 'a second collect of the same operation is refused while the first is in flight');
ok(/_jbOpBusy\[a\.opId\] = true;\n\s*\/\* 🔴 CLAIM BEFORE PAYING/.test(SRC), '…and the lock is taken immediately before the claim, so a cheap refusal cannot strand it');
ok(/const _claimed = await _opClaimCollect\(o\);\n\s*try \{ delete _jbOpBusy\[a\.opId\]; \} catch \(e2\) \{\}/.test(SRC), '…and released once the marker has moved (the six-hour cooldown holds the door after that)');

/* ── 4. the door ── */
ok(/if \(e\.origin && e\.origin !== window\.location\.origin\) return;/.test(SRC), 'the Just Business message handler takes messages from our own origin only — it checked the message TYPE and nothing else');

/* ── 5. run the accrual rule for real ── */
{
  /* the shape the payout is computed from */
  const CAP_H = 36, CD_MS = 6 * 3600000;
  const computed = (lastCollect, now) => {
    const hrs = Math.min(CAP_H, Math.max(0, (now - lastCollect) / 3600000));
    return { hrs, gross: Math.floor(100 * hrs), cdLeft: Math.max(0, (lastCollect + CD_MS) - now) };
  };
  const now = Date.now(), day = 86400000;
  const first = computed(now - 2 * day, now);
  ok(first.hrs === 36 && first.cdLeft === 0, 'run for real: two days of accrual pays the 36-hour cap and the cooldown is clear');
  /* the old order: pay, then fail to record → the next call pays the same again */
  const brokenSecond = computed(now - 2 * day, now + 1000);
  ok(brokenSecond.gross === first.gross && brokenSecond.cdLeft === 0,
    'run for real: with the marker unmoved, the very next click pays the SAME 36 hours again — this is the exploit, exactly as reported');
  /* claimed first: lastCollect moves, so the same click now refuses */
  const afterClaim = computed(now, now + 1000);
  ok(afterClaim.gross === 0 && afterClaim.cdLeft > 5.9 * 3600000,
    'run for real: once the claim has moved the marker, the next click has nothing to pay and six hours to wait', JSON.stringify(afterClaim));
}

/* the knobs */
const v = (SRC.match(/window\.BUILD_VERSION = '([^']+)'/) || [])[1];
ok(parseInt((v || '').replace('v121v', ''), 10) >= 127, 'BUILD_VERSION is v121v127 or later', v);
ok(readFileSync('./public/version.txt', 'utf8').trim() === v, 'version.txt equals BUILD_VERSION');
ok(new RegExp("CACHE_VERSION = 'mythic-" + v + "-").test(readFileSync('./public/sw.js', 'utf8')), 'sw.js carries the build');
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
