/* 📦 v121v117 — the Node Inventory on every node owner's modal, the Foundry as
   the Trash Crusher's mini-game, and a city ring that includes the nodes the
   viewer LINKED to their city. Runs the yield math for real.
   Run: node _nodeinv_smoke.mjs */
import { readFileSync } from 'fs';
let fails = 0;
const ok = (c, m, x) => { console.log((c ? '  PASS ' : '  FAIL ') + m + (c || x === undefined ? '' : '  ← ' + x)); if (!c) fails++; };
const SRC = readFileSync('./public/index.html', 'utf8').replace(/\r\n/g, '\n');
const NC = readFileSync('./public/node-city/index.html', 'utf8').replace(/\r\n/g, '\n');
const SHELL = readFileSync('./public/corp/shell.jsx', 'utf8').replace(/\r\n/g, '\n');
const SQL = readFileSync('./sql/132_node_inventory.sql', 'utf8');

/* ── 1. the ring ── */
ok(/^window\.cityLinkedNodes = async function \(\) \{/m.test(SRC) && /from\('city_node_links'\)\.select\('node_id'\)\.eq\('user_id', me\)/.test(SRC) && /from\('economy_nodes'\)\.select\('\*'\)\.in\('id', ids\)/.test(SRC), 'the parent hands the city the nodes LINKED to it (city_node_links → economy_nodes)');
ok(/let linked = \[\]; try \{ if \(typeof P\.cityLinkedNodes === 'function'\) linked = \(await P\.cityLinkedNodes\(\)\) \|\| \[\]; \} catch \(e\) \{\}/.test(NC) && /linked\.forEach\(n => \{ if \(n && n\.id && !seen\.has\(String\(n\.id\)\)\) \{ seen\.add\(String\(n\.id\)\); mine\.push\(n\); \} \}\);/.test(NC), 'the city rings its owner\'s licensed nodes PLUS the linked ones, deduped');
ok(/const mine = \(FR && Array\.isArray\(FR\.nodes\)\) \? FR\.nodes\.filter\(n => n && \(!me \|\| !n\.owner_id \|\| String\(n\.owner_id\) === String\(me\)\)\) : \[\];/.test(NC), '…and the 2026-09-10 owner rule still holds for the reserve list');

/* ── 2. the Foundry ── */
for (const f of ['admin', 'guide', 'index', 'machines', 'models', 'recipes', 'render', 'state', 'taps', 'world']) { let n = 0; try { n = readFileSync('./public/src/foundry/' + f + '.js', 'utf8').length; } catch (e) {} ok(n > 1000, 'src/foundry/' + f + '.js ships'); }
ok(/<script type="module" src="src\/foundry\/index\.js\?v=v121v117foundry5"><\/script>/.test(SRC) && /^function openFoundry\(\) \{/m.test(SRC) && /window\.MythicFoundry\.catchUp\(\)/.test(SRC), 'the module tag, openFoundry() and the offline catch-up');
ok(/^window\.MythicFoundryBridge = \{/m.test(SRC) && /__foundry__:\s+\(Profile\.foundry && typeof Profile\.foundry === 'object'\) \? Profile\.foundry : \{\},/.test(SRC) && /if \(f\.foundry && typeof f\.foundry === 'object'\) Forge\.foundry = f\.foundry;/.test(SRC) && /^function _foundryMergeState\(local, cloud\) \{/m.test(SRC), 'the bridge, the cloud whitelist (profile + forge), the newest-save reconcile');
ok(/\{ id: 'foundry',\s+name: 'The Foundry',[\s\S]{0,200}x: 8,\s+y: 8,\s+w: 4, h: 3,[\s\S]{0,120}door: \{ x: 10, y: 11 \},/.test(SRC), 'a camp building at x8-11 / y8-10 with its door below (the branch\'s spot sat on the scout)');
ok(/trashcrusher: \[\n\s*\{ label: 'Trash Crusher',\s+ico: '🗜️', action: 'openFoundry' \},\n\s*\{ label: 'Post a Scrap Run',\s+ico: '🚛', action: 'openHaulBoard' \},\n\s*\],/.test(SHELL), 'the corp sidebar: Trash Crusher → the Foundry, Post a Scrap Run → the Haulage Board');
ok(/if \(a\.kind === 'openFoundry'\) \{[\s\S]{0,500}openFoundry\(\); \} catch \(e\) \{\}/.test(SRC), 'JB_action routes openFoundry like the other doors');

/* ── 3. the inventory ── */
ok(/create or replace function public\.node_inventory_claim\(p_node_id uuid, p_cap_hours numeric default 48\)/.test(SQL) && /if v_owner <> auth\.uid\(\) then return jsonb_build_object\('ok', false, 'why', 'not-owner'\); end if;/.test(SQL) && /jsonb_build_object\('invAt', v_now\)/.test(SQL), 'sql/132: the owner-only claim stamps meta.invAt and returns the hours');
ok(/\$\{\(typeof _nodeInventorySectionHtml === 'function'\) \? _nodeInventorySectionHtml\(selNode\) : ''\}/.test(SRC), 'the modal shows the inventory section after Node Power');
ok(/if \(!own\) return '';/.test(SRC.slice(SRC.indexOf('function _nodeInventorySectionHtml'), SRC.indexOf('function _nodeInventorySectionHtml') + 1200)), '…for the node owner only');
ok(/window\.__mg\._nodeInvCollect = async function \(nodeId\) \{/.test(SRC) && /rpc\('node_inventory_claim', \{ p_node_id: nodeId, p_cap_hours: NODE_INV_CAP_H \}\)/.test(SRC) && /addRes\(res, qty\); try \{ saveProfile\(\); \} catch \(e\) \{\}/.test(SRC), 'Collect claims the hours on the server, then banks the units through addRes');
{
  const block = SRC.slice(SRC.indexOf('/* ═══ 📦 NODE INVENTORY'), SRC.indexOf('/* ═══ end node inventory ═══ */'));
  const api = new Function('App', 'Cloud', 'render', block.slice(0, block.indexOf('function _nodeInvHoursOf')) + '\nreturn { _nodeInvMult, _nodeInvYield, _nodeInvCityLevelFromXp, NODE_INV_BASE_PER_H, NODE_INV_CAP_H };')({}, null, () => {});
  ok(api._nodeInvMult(1, 1, 1) === 1, 'a fresh node in a new city: ×1.00');
  ok(Math.abs(api._nodeInvMult(50, 10, 25) - 1.5) < 1e-9, 'tier 50 · power LV 10 · city LV 25: ×1.50 — "produce 1.5x more"');
  ok(Math.abs(api._nodeInvMult(50, 1, 1) - (1 + 0.5 / 3)) < 1e-9 && Math.abs(api._nodeInvMult(1, 10, 1) - (1 + 0.5 / 3)) < 1e-9 && Math.abs(api._nodeInvMult(1, 1, 25) - (1 + 0.5 / 3)) < 1e-9, 'each of the three contributes a third');
  ok(api._nodeInvMult(999, 99, 99) === 1.5 && api._nodeInvMult(0, 0, 0) === 1, 'clamped both ways');
  ok(api._nodeInvYield(24, 1, 1, 1) === 240 && api._nodeInvYield(24, 50, 10, 25) === 360, 'a day on the shelf: 240 units at ×1, 360 at ×1.5');
  ok(api._nodeInvYield(100, 1, 1, 1) === api._nodeInvYield(48, 1, 1, 1) && api.NODE_INV_CAP_H === 48, 'the shelf holds 48 hours');
  ok(api._nodeInvCityLevelFromXp(0) === 1 && api._nodeInvCityLevelFromXp(80) === 2 && api._nodeInvCityLevelFromXp(1e9) === 25, 'the city level curve matches the city builder (80·(L−1)^2.4, max 25)');
}

/* the knobs */
const v = (SRC.match(/window\.BUILD_VERSION = '([^']+)'/) || [])[1];
ok(parseInt((v || '').replace('v121v', ''), 10) >= 117, 'BUILD_VERSION is v121v117 or later', v);
ok(readFileSync('./public/version.txt', 'utf8').trim() === v, 'version.txt equals BUILD_VERSION');
ok(new RegExp("CACHE_VERSION = 'mythic-" + v + "-").test(readFileSync('./public/sw.js', 'utf8')), 'sw.js carries the build');
ok(new RegExp('window\\.NC_BUILD = "' + v + '-').test(NC), 'NC_BUILD carries the build');
console.log(fails ? '\n' + fails + ' FAILED' : '\nALL PASS');
process.exit(fails ? 1 : 0);
