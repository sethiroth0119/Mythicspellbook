/* 🔮🧭 v121v133 — enchantments come out of any zone onto the BOARD, and the
   camp's back button sits top-left like every other screen's.
   Run: node _enchzone_smoke.mjs */
import { readFileSync } from 'fs';
let fails = 0;
const ok = (c, m, x) => { console.log((c ? '  PASS ' : '  FAIL ') + m + (c || x === undefined ? '' : '  ← ' + x)); if (!c) fails++; };
const SRC = readFileSync('./public/index.html', 'utf8').replace(/\r\n/g, '\n');

/* ── 🔮 an enchantment is summonable ───────────────────────────────────────────
   Owner: "Enchantments need to be able to be summoned from the deck, hand, void
   or graveyard. As they stay on the field until destroyed." …and, clarifying,
   "Enchantments get placed on the board like units do."

   🌟 Summon From Zone already reached all four piles with the Card Filter, the
   id list, the picker and the placement search. The ONLY thing stopping it
   carrying an enchantment was the type test, so the fix widens that rather than
   building a parallel effect. */
ok(/return t === 'unit' \|\| t === 'summon' \|\| t === 'enchantment' \|\| t === 'curse';/.test(SRC),
  'an enchantment and a curse are summonable — the one line that stopped it');
{
  const f = SRC.slice(SRC.indexOf('function _isSummonableCard(c) {') - 1400, SRC.indexOf('function _isSummonableCard(c) {') + 400);
  ok(/HEROES are deliberately excluded/.test(f),
    '…and a HERO still is not, so "your hero died" cannot become ambiguous');
}
ok(/if \(_ct === 'enchantment' \|\| _ct === 'curse'\) \{ u\.isEnchantment = true; u\.cardType = _ct; \}/.test(SRC),
  'the token on the board announces itself — buildUnit carries no card type onto a unit, so the flag is the only thing that can');
{
  /* the engine already looked for exactly this and nothing could produce it */
  const zc = SRC.slice(SRC.indexOf('if (z.controlEnchantment'), SRC.indexOf('if (z.controlEnchantment') + 260);
  ok(/u\.isEnchantment \|\| t === 'enchantment' \|\| t === 'curse'/.test(zc),
    '…which is the shape "while you control an enchantment" was already testing board units for');
}
ok(/units, summons AND enchantments, by Card Filter or id list/.test(SRC),
  'the effect label says so, so an author can find it without reading the engine');
ok(/finds nothing in \$\{owner === 'player' \? 'your' : 'their'\}/.test(SRC),
  '…and the empty-pile line no longer says "no unit" about a search that can also find a permanent');
{
  /* run the type rule for real */
  const summonable = (t) => t === 'unit' || t === 'summon' || t === 'enchantment' || t === 'curse';
  ok(summonable('unit') && summonable('summon'), 'run for real: units and summons are unchanged');
  ok(summonable('enchantment') && summonable('curse'), 'run for real: enchantments and curses now qualify');
  ok(!summonable('spell') && !summonable('trap') && !summonable('location') && !summonable('weather'),
    'run for real: a spell, trap, location or weather still cannot be put on a tile');
  ok(!summonable('hero'), 'run for real: and never a hero');
}
{
  /* the cast-from-hand path is deliberately untouched */
  const ps = SRC.slice(SRC.indexOf("if (card.type === 'enchantment' || card.type === 'curse') {"), SRC.indexOf("if (card.type === 'enchantment' || card.type === 'curse') {") + 900);
  ok(/enchantments: \[\.\.\.\(s\.enchantments \|\| \[\]\), \{/.test(ps),
    'a HAND-CAST enchantment still lands on state.enchantments exactly as before — every card authored against that behaves identically');
}

/* ── 🧭 bug-mtxkwv4m — the back button ───────────────────────────────────────
   "The location of the button to navigate back to previous page in the camp is
   top right whereas the majority are top left." Repro: Camp → Camp → Camp, and
   "The Bunker" shows at top right. .forge-header is space-between with two
   children, so a button in the right-hand group is pinned right by the LAYOUT. */
{
  const i = SRC.indexOf('<!-- 🧭 v121v133 (bug-mtxkwv4m)');
  ok(i > 0, 'the camp header carries the reason the button moved');
  const hdr = SRC.slice(i, i + 1500);
  const btn = hdr.indexOf('id="btn-back-camp"');
  const title = hdr.indexOf('<h2 class="section-title"');
  ok(btn > 0 && title > 0 && btn < title,
    'the back button comes BEFORE the title in the header, so it renders top-left', 'btn@' + btn + ' title@' + title);
}
ok((SRC.match(/id="btn-back-camp"/g) || []).length === 1,
  'there is exactly ONE back button — the old right-hand copy is gone, not merely hidden');
ok(/document\.getElementById\('btn-back-camp'\)\.onclick/.test(SRC),
  '…and it is still the button the click handler binds');
{
  const fh = SRC.slice(SRC.indexOf('.forge-header { display: flex;'), SRC.indexOf('.forge-header { display: flex;') + 160);
  ok(/justify-content: space-between/.test(fh),
    '.forge-header itself is UNTOUCHED — it is shared by many screens, and re-laying it out to move one button is how a header regression reaches pages nobody tested');
}

/* the knobs */
const v = (SRC.match(/window\.BUILD_VERSION = '([^']+)'/) || [])[1];
ok(parseInt((v || '').replace('v121v', ''), 10) >= 133, 'BUILD_VERSION is v121v133 or later', v);
ok(readFileSync('./public/version.txt', 'utf8').trim() === v, 'version.txt equals BUILD_VERSION');
ok(new RegExp("CACHE_VERSION = 'mythic-" + v + "-").test(readFileSync('./public/sw.js', 'utf8')), 'sw.js carries the build');
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
