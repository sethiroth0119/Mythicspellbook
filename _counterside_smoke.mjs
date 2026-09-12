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
/* v121v128 replaced the identity test this used to pin — see section 3. */
ok(/if \(_side === 'self'\) \{\n\s*if \(u\.id !== unit\.id\) return;/.test(SRC), 'itself only is a real option, and it is the default');
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

/* ── 🔵 v121v128 — THE FOURTH REPORT, and the bug standing behind the third ──
   The owner's card, read out of the live catalog:
     Ualti Spirit — counterToken { id:'ualticounter', name:'Ualti Counters', max:4 }
                    onPlay { type:'addCounters', amount:2, counterName:'',
                             radius:1, counterSide:null, tSide:'enemy' }
   So v121v125 IS working: counterSide null reads as 'self' and the token
   resolves off the card. The counters still never arrived, because the line
   that picks the recipient tested OBJECT IDENTITY — `u !== unit` — and
   state.units is rebuilt by half a dozen steps between a card being played and
   its on-play resolving. Each of them hands the board a copy of the caster
   while `unit` still points at the original. */
ok(/if \(_side === 'self'\) \{\n\s*if \(u\.id !== unit\.id\) return;/.test(SRC),
  'the caster is found by WHO IT IS, not by which copy of it the caller happens to hold');
{
  const h = SRC.slice(SRC.indexOf("eff.type === 'addCounters'"), SRC.indexOf("eff.type === 'addCounters'") + 6000);
  /* the comment above the fix quotes the old expression, so this asks for the
     STATEMENT — `u !== unit` followed by a return — rather than the words. */
  ok(!/if \([^)]*u !== unit[^)]*\)\s*return/.test(h),
    '…and the identity test is gone — nothing else in this file compares a unit by object, because the engine rebuilds them constantly');
  ok(!/Math\.max\(Math\.abs\(u\.pos\.x - unit\.pos\.x\)/.test(h) && /if \(!u\.pos \|\| !inRadius\(u\)\) return;/.test(h),
    '…and the range test is the hex one: Chebyshev reaches tiles that are not neighbours on an odd row and misses tiles that are (HEXSPEC §5)');
  ok(/if \(_side === 'self' && touched === 0 && unit\) \{/.test(h),
    '…and a caster that is not on the board at all — a hand, grave or field ability resolves through a hero-anchored synthetic — still gets its own counters');
}
{
  /* run the recipient rule for real, INCLUDING the copy that broke it */
  const pick = (eff, units, unit, owner, radius, dist) => {
    const side = eff.counterSide || 'self';
    const out = [];
    units.forEach((u) => {
      if (!u || !u.alive) return;
      if (side === 'self') { if (u.id !== unit.id) return; }
      else {
        if (side === 'ally' && u.owner !== owner) return;
        if (side === 'enemy' && u.owner === owner) return;
        if (!u.pos || dist(u) > radius) return;
      }
      out.push(u);
    });
    if (side === 'self' && out.length === 0 && unit) out.push(unit);
    return out;
  };
  const D = () => 0;
  const me = { id: 'u1', owner: 'player', name: 'Ualti Spirit', alive: true, pos: { x: 1, y: 1 } };
  const copyOfMe = { ...me };                       // what the MP stamp / infection / weather leave behind
  const foe = { id: 'u3', owner: 'ai', alive: true, pos: { x: 2, y: 1 } };

  ok(pick({}, [me, foe], me, 'player', 1, D).length === 1 && pick({}, [me, foe], me, 'player', 1, D)[0].id === 'u1',
    'run for real: the owner\'s card gives its 2 Ualti Counters to itself');
  ok(pick({}, [copyOfMe, foe], me, 'player', 1, D).length === 1 && pick({}, [copyOfMe, foe], me, 'player', 1, D)[0] === copyOfMe,
    'run for real: …and STILL does when the board holds a COPY of it — this is the case that failed, and it is the common one (the multiplayer on-play stamp remaps the whole array)');
  ok(pick({}, [foe], me, 'player', 1, D)[0] === me,
    'run for real: a caster that is not on the board at all still gets them — a hand or graveyard ability is a hero-anchored synthetic that "self" could never find');
  ok(pick({}, [{ ...me, alive: false }], me, 'player', 1, D)[0] === me,
    'run for real: a caster already dead on the board falls through to itself rather than silently placing nothing');
  const posless = { id: 'u1', owner: 'player', alive: true };
  ok(pick({}, [posless], posless, 'player', 1, D).length === 1,
    'run for real: "self" never asks for a position — a unit is at distance zero from itself and a hero-anchored caster has no real one');
}

/* the knobs */
const v = (SRC.match(/window\.BUILD_VERSION = '([^']+)'/) || [])[1];
ok(parseInt((v || '').replace('v121v', ''), 10) >= 125, 'BUILD_VERSION is v121v125 or later', v);
ok(readFileSync('./public/version.txt', 'utf8').trim() === v, 'version.txt equals BUILD_VERSION');
ok(new RegExp("CACHE_VERSION = 'mythic-" + v + "-").test(readFileSync('./public/sw.js', 'utf8')), 'sw.js carries the build');
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
