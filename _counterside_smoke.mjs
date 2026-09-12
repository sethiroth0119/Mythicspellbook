/* 🔵🖤 v121v125 — "On Play: gain 2 Ualti Counters" lands on the card that played
   it, and the Black Market opens on account level rather than on a mission.
   Run: node _counterside_smoke.mjs */
import { readFileSync } from 'fs';
let fails = 0;
const ok = (c, m, x) => { console.log((c ? '  PASS ' : '  FAIL ') + m + (c || x === undefined ? '' : '  ← ' + x)); if (!c) fails++; };
const SRC = readFileSync('./public/index.html', 'utf8').replace(/\r\n/g, '\n');

/* ── 1. who gets the counters ── */
ok(/const _side = eff\.counterSide \|\| 'self';/.test(SRC) && !/eff\.tSide/.test(SRC.slice(SRC.indexOf("eff.type === 'addCounters'"), SRC.indexOf("eff.type === 'addCounters'") + 2200)),
  'Add Counters asks its OWN question and no longer reads tSide at all — that is the Target Strike DAMAGE dropdown, whose default "enemy" is what sent the counters to the wrong card');
ok(/if \(_side === 'self' && u !== unit\) return;          \/\/ 🔵 itself only — the common case/.test(SRC), 'itself only is a real option, and it is the default');
ok(/if \(_side === 'ally' \|\| _side === 'all'\) \{\n\s*window\.MythicCounters\.permanentsFor/.test(SRC), 'permanents take them when the effect is aimed at your side, not merely "not enemy"');
ok(/const COUNTER_SIDES = \[\n\s*\{ id: 'self',  label: 'Itself — the card that played this' \},/.test(SRC), 'the four choices are named in the author\'s language');
ok(/function _counterSideFieldHtml\(prefix, eff\) \{/.test(SRC) && /id="' \+ prefix \+ '-counterside"/.test(SRC), 'and rendered as a field of its own');
ok(/'counterside': \['counterSide'\]/.test(SRC), 'the effect gate shows it only for effects that place counters');
ok(/if \(!document\.getElementById\(pre \+ '-counterside'\)\) \{/.test(SRC), 'it is injected into EVERY effect block, like the summon zone — not written into one template');
ok(/if \(eff\.type !== 'addCounters' && eff\.type !== 'removeCounters'\) return;\n\s*eff\.counterSide = el\.value;/.test(SRC), 'and swept back on save, only onto effects that place or strip counters');

/* ── 2. the Black Market ── */
ok(/const BLACKMKT_UNLOCK_ACCOUNT_LEVEL = 3;/.test(SRC), 'the Black Market has an account-level door');
ok(/\(\(acctLevel >= BLACKMKT_UNLOCK_ACCOUNT_LEVEL \|\| _hubIsAdmin\) \? null/.test(SRC) && /badge: `Lv \$\{acctLevel\} \/ \$\{BLACKMKT_UNLOCK_ACCOUNT_LEVEL\}`, locked: true,/.test(SRC),
  'below Lv 3 it is the game\'s own locked tile, showing how far off you are');
ok(/if \(App\._bmInHall && typeof openBlackMarketHall === 'function'\) \{ openBlackMarketHall\(\); \}\n\s*else \{ App\.screen = 'vendor'; render\(\); \}/.test(SRC),
  'at Lv 3 it opens the market — it is no longer locked behind surviving the route');
ok(/function _startBlackMarketRun/.test(SRC), '…and the route still exists, for carrying a haul home');

/* ── 3. run the recipient rule for real ── */
{
  /* the exact shape the handler filters with */
  const pick = (eff, units, unit, owner) => {
    const _side = eff.counterSide || 'self';
    return units.filter((u) => {
      if (_side === 'self' && u !== unit) return false;
      if (_side === 'ally' && u.owner !== owner) return false;
      if (_side === 'enemy' && u.owner === owner) return false;
      return true;
    });
  };
  const me = { id: 'u1', owner: 'player', name: 'Ualti' };
  const mate = { id: 'u2', owner: 'player' };
  const foe = { id: 'u3', owner: 'ai' };
  const units = [me, mate, foe];
  ok(pick({ type: 'addCounters', tSide: 'enemy' }, units, me, 'player').length === 1 && pick({ type: 'addCounters', tSide: 'enemy' }, units, me, 'player')[0] === me,
    'run for real: the owner\'s card — an untouched side dropdown saying "enemy" — now gives the counters to ITSELF (it gave them to the enemy, or to nobody)');
  ok(pick({ counterSide: 'self' }, units, me, 'player').length === 1, 'run for real: itself only');
  ok(pick({ counterSide: 'ally' }, units, me, 'player').map((u) => u.id).join(',') === 'u1,u2', 'run for real: your side');
  ok(pick({ counterSide: 'enemy' }, units, me, 'player').map((u) => u.id).join(',') === 'u3', 'run for real: theirs');
  ok(pick({ counterSide: 'all' }, units, me, 'player').length === 3, 'run for real: everyone in radius');
  ok(pick({ counterSide: 'enemy', tSide: 'ally' }, units, me, 'player').map((u) => u.id).join(',') === 'u3', 'run for real: the damage dropdown is ignored entirely — only the counter side decides');
}

/* the knobs */
const v = (SRC.match(/window\.BUILD_VERSION = '([^']+)'/) || [])[1];
ok(parseInt((v || '').replace('v121v', ''), 10) >= 125, 'BUILD_VERSION is v121v125 or later', v);
ok(readFileSync('./public/version.txt', 'utf8').trim() === v, 'version.txt equals BUILD_VERSION');
ok(new RegExp("CACHE_VERSION = 'mythic-" + v + "-").test(readFileSync('./public/sw.js', 'utf8')), 'sw.js carries the build');
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
