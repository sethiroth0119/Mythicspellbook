# 🐛 BUG-TRACKER HANDOFF — 2026-09-09

Live at **v121v90**. Tracker: **30 fixed / 13 open**. Ten builds shipped this
session (v121v81 → v121v90), every one full-gated and edge-verified.

Read this top to bottom before touching anything. The **Traps** section at the
end will cost you an hour each if you skip it.

---

## 0. THE STANDING JOB

> *"Keep track of the bug tracker, look at the photos that are uploaded by
> players and look at what they are saying and then fix them in the right way.
> After you are done the ones you deemed as fixed mark them as fixed."*

That is ongoing, not a one-off. Start a session by reading the tracker.

### Where the tracker is

The **Abraxas Codex** site (`D:\Abraxascodex`) runs on Supabase project
**`uvfhiqwvpixfobjnyqtf`**. The game (`D:\game-deploy`, Mythic Spellbook) is a
**different** project, `ktsiasyjusesawtrwrjc`.

🔴 **The tracker lives on the Codex site but every report in it is a MYTHIC
SPELLBOOK bug.** Reports are read from one repo and fixed in the other.

```sql
-- the open list
select id, data->>'severity' sev, data->>'reporter' who,
       left(data->>'title',80) title,
       jsonb_array_length(coalesce(data->'attachments','[]'::jsonb)) files
from public.bug_reports
where data->>'status' not in ('fixed','wont-fix','duplicate')
order by case data->>'severity' when 'critical' then 0 when 'high' then 1
                                when 'med' then 2 else 3 end, created_at;
```

`public.bug_reports` is one row per report: `id` (client text), `data` (jsonb —
the whole record, so the page's shape evolves without migrations), `created_by`,
`created_at`, `updated_at`. jsonb keys: `title description category severity
status reproSteps expected actual build platform reporter email msbEmail
msbUserId votes responses created updated`, plus optional `attachments`
`attachmentSlot` `reward` `_createdBy`.

Vocabulary (from `project/bugs.jsx`): severity `low|med|high|critical`; status
`open|triaged|in-progress|needs-info|fixed|wont-fix|duplicate`; category
`gameplay|ui|economy|other`.

⚠ `email` / `msbEmail` are PII. Do not print them.

### Marking fixed

```sql
update public.bug_reports set data = jsonb_set(data,'{status}','"fixed"')
where id in ('bug-xxxx') returning id, data->>'status', left(data->>'title',60);
```

Only mark what you **verified live at the edge**. The user has already been
burned once by a report marked fixed that wasn't ("This was said to be fixed but
isn't") — that is worse than leaving it open, because it stops being counted.

**Do not write `responses`.** Every existing response is authored by a named
person; posting under the user's name puts words in their mouth. Ask what name
to use if reply notes are wanted.

### 📷 THE ATTACHMENTS — STILL BLOCKED, AND THIS IS THE #1 UNBLOCK

Screenshots live in the **private** `bug-attachments` bucket (signed URLs only,
one folder per uploader uid). The file list is on `data->'attachments'` as
`{id,name,path,size,type,width,height,addedAt}`.

Signing needs the **user's own session**, so:
- The Supabase MCP cannot fetch them (no storage tool, and the bucket is private).
- The in-app Browser pane is a fresh browser with no session.
- **Claude in Chrome** would work — it uses the real Chrome with real sessions —
  but it would **not connect** all session (five retries). The user said "I am
  connected to chrome" and it still refused.

**Ask for either**: the Chrome side panel actually open and signed in to the same
account as this app (installed alone is not enough), **or** the images pasted
into chat. Three open reports are blocked on this and two are `high`.

---

## 1. WHAT SHIPPED THIS SESSION

| Build | What |
|---|---|
| v121v81 | Stash visibility — 265 SALVAGE_RES ids counted against the vault cap and could never be listed |
| v121v82 | Truck Yard: Bulk Feed + Livestock cargo classes, 3D models, yard made class-agnostic |
| v121v83 | 35 empty industrial buildings given recipes; ledger mirror derived from recipes + batched |
| v121v84 | steel↔metalAlloys deadlock + woodPanels broken → **15 firms unblocked**; 60× Cinder tooltip; 2 phantom venue types |
| v121v85 | **Businesses stop going bankrupt while profitable** |
| v121v86 | Athena Engine character cast (peers were blue capsules) |
| v121v87 | Camp defense cap; referral redeem direction; Trash Crusher label; Card Hunt repeats |
| v121v88 | Warehouse "Refined stock" card — the six city-stock goods had no view anywhere |
| v121v89 | Base Vault ceiling stopped moving; card purchases return you where you were |
| v121v90 | Corporation member cities filtered to nodes the member still owns |

New suites, all registered in `_checkall.mjs` (**86 suites** now):
`_rigyard_smoke.mjs` `_citychain_smoke.mjs` `_ecoreach_smoke.mjs`
`_firmcash_smoke.mjs` `_athenacast_smoke.mjs` `_openfour_smoke.mjs`
`_citystock_smoke.mjs` `_payreturn_smoke.mjs` `_corpcities_smoke.mjs`
Extended: `_vault_smoke.mjs` (§10, minPasses 20→27), `_citybiz_smoke.mjs`,
`_athena_smoke.mjs` (engine assertion split into three).

---

## 2. THE 13 OPEN REPORTS

### 🔴 Blocked on YOU — a decision or an image

| id | sev | What is needed |
|---|---|---|
| `bug-mtuadu79` | high | **Clinic remedies spiral.** 2 screenshots. Confirmed: the Clinic is the ONLY producer (`gen.remedies 0.45`) *and* the ONLY consumer (`svc.input remedies, rate 0.30`). Production is scaled by `tileOutputFactor` (city conditions); the `svc` draw is **not**. Below ~0.67 conditions the draw overtakes production and it spirals — exactly "it's eating its own lunch". **What the images settle:** whether that is the defect or the intended "a failing city runs down its stock". Do not guess on a `high` in a live economy. |
| `bug-mtuasm4d` | med | **Stadium not picking up Remedies/Goods/Rations.** 1 screenshot. First hypothesis was WRONG — `nodeStockView()` merges `res` then `stock` correctly, so it reads them fine. Need the image to see *which* panel: the tile inspect (which genuinely shows nothing — the stadium has no `gen`/`use` **by design**, see the comment at node-city ~5556: a `gen` there would make it an idle earner) or the event readiness panel. |
| `bug-mtp1ltjq` | high | **Employee wages.** Full analysis in §3 below. Needs a design decision. |
| `bug-mtttvge5` | med | **Beverages have no consumer.** Produced by Club, Gym, Cinema, Food Truck; consumed by nothing, so they pile in the vault. ⚠ There is a **recorded rejection** of the obvious fix at node-city ~4850: a `use:` input **halts** a building at zero, and "every restaurant in a city without them would have closed". The safe version is a *soft* draw (`svc.input`, which throttles instead of halting) — that is a venue-economics decision, not a bug fix. |
| `bug-mtrmzyhc` | med | **Hiring.** Full analysis in §4. Needs a tuning decision. |
| `bug-mtu9vzp3` | med | **Duplicate PRNs.** Almost certainly **working as designed** — `nodeEstablish()` caps at `NODE_MAX_PER_CORP = 6` **total, not per type**, and the only unique index on `economy_nodes` is `one_main_per_owner`. Six of any mix looks intended. He paid Cinder + materials for the second Supply PRN, so **do not delete it** without an explicit instruction. A second player also has a duplicate (2× Storage) and has not reported it. The real gap is that no UI states the rule. |

### 🟡 Diagnosed, needs work

| id | sev | Where it stands |
|---|---|---|
| `bug-mttcdw79` | high | **Population display.** Has 2 screenshots. The numbers are **several different true quantities with similar labels**: `popCap()` = beds + node-granted capacity + zoning delta; `popUsed()` = build slots (army.workers + army.soldiers + each building's `pop` cost), **not** residents; `cityPop()` = `game.pop.npc`, the actual residents, which does **not** consume popCap; `citCap()` = `min(400, cityPop())`. So "Free population 1089" beside "capacity 294" can both be correct. This is a labelling/reconciliation job — the screenshots say which panels he is comparing so you fix the right ones instead of all of them. |
| `bug-mtu13pzm` | med | **"Nobody is shopping."** Partly fixed in v121v84 (two of seven patron NEEDS pointed at buildings that do not exist — `cardshop`, `techstore` — now removed). **Not fully explained**: `_patronVenues()` pushes every tile and patronage never checks shop stock at all, so it is not refusing to shop. Suspect a **name collision**: the patron *need* id is `goods` and so is the CITY_STOCK *resource* — a "goods unmet" line reads as "your goods are not counted" when it means "nobody built a clothing store". 3 screenshots would finish it. |
| `bug-mttyizit` | med | **Living Economy 0%.** Mostly fixed in v121v84 (Structural Steel, Lumber, Metal Components). **`Workers` was never touched** — that is what is left. |
| `bug-mtrmi2e5` | med | **Workers bottleneck / housing.** Same cluster as population + hiring. |
| `bug-mtsq62mg` | med | **Out of Cash.** Root cause fixed in v121v85 (see §5). Left open deliberately — needs confirmation from the reporter that it is actually resolved in play, since he reported it as still broken once before. |
| `bug-mtr5xz8t` | high | **Managed cities not loading first time.** No repro. The user's own response on the report says "Likely a server/internet issue". Untouched. |
| `bug-mtr5bze0` | med | **Startup sequence should be automated.** A feature request, not a bug ("IMO this should all be handled in the background"). Note v121v89 fixed the *related* complaint — a card purchase used to dump you at the title screen — but the Bank → City Hall → Licences → PRNs walk is this separate item. |

---

## 3. THE WAGES QUESTION — recommendation already made, awaiting the call

Verified installed on the live game DB: `get_my_ledger`, `corp_staff_payroll`,
`corp_pay_member`, `corp_pay_member_from_treasury`.

**The game has three wage systems and only one is coherent:**

1. `/src/economy` firms → households — **coherent**. `households.js` states the
   invariant: *"a household can only spend Cinder it was actually paid. There is
   no 'consumer spending' term computed [from nothing]."*
2. **Corp operations (`op_salary`)** — a pure **sink**.
   `_opTreasuryRow(-salaryPay, 'op_salary', …)`. Destroyed. Nobody receives it.
3. **Patronage** — a pure **faucet**. `game.frac.cinder += P.credited` mints from
   nothing, capped at `DAY_CAP_TOP` 1,000,000/day at top tier.

NPC wages are destroyed over here; NPC shopping is invented over there; the two
are about the same NPCs and have **nothing to do with each other**. That is why
the report feels true even though nothing is technically broken.

**Recommended:** join #2 and #3 the way #1 already is. Wages paid into a city
Household Wage Pool; patronage spends from that pool **first** and only mints the
shortfall. Keep a 25–35% leak so wages stay a partial sink; keep the daily cap as
a ceiling. This makes the economy *tighter*, not looser, and gives a real reason
for factories and shops to share a city.

**Rejected:** paying NPC wages into player wallets (turns a 100k+/cycle sink into
a faucet and makes hiring NPCs a money printer). **Fallback:** relabel the line
"NPC payroll — leaves the economy" (honest, an hour, explains the hole rather
than filling it).

⚠ Complication: `op_salary` is in the **corp treasury on Supabase**; patronage is
in **node-city's local sim**. Different layers. Cheapest shape is a per-city pool
node-city owns, credited on op settle through the existing
`window.cityAddCinders` seam. A day of work, and the economy gauntlet will judge
it hard.

---

## 4. THE HIRING QUESTION — analysis done, needs a tuning call

Reported: 570 qualified citizens, **1,177 open positions**, 208 employed.

```
CIT.MAX     = 400                      named-citizen roster ceiling
citCap()    = min(400, cityPop())      570 residents → at most 400 workers
citTarget() = min(citCap, jobSlots)    → min(400, 1177) = 400
```

`citJobSlots()` sums `npcSeatsAt()` over every tile and businesses offer
**10–200 posts each**, so a developed city reaches 1,177 seats easily while the
roster that fills them is hard-capped at 400.

**1,177 open positions is a number that can never reach zero.** The comment on
`CIT.MAX` records it being raised 80 → 400 for exactly this reason; the same
thing has now happened one order of magnitude up.

1. **Make the number honest** (recommended, safe): Job Fair says "208 employed ·
   400 the city can name · 1,177 seats exist". No performance risk.
2. **Raise `CIT.MAX`**: every named citizen has a name, mood, job and tenure and
   is ticked every 2 s. **Measure before touching.**
3. **Decouple staffing from the roster**: `staffAt()` already blends city-wide
   hired workers with named residents, so seats could be filled by anonymous
   labour with named citizens as a bonus. Biggest change, probably right
   long-term.

Recommendation: **1 now, 3 later.**

---

## 5. THE FIX MOST WORTH UNDERSTANDING (v121v85)

`closeDay()` in `/src/economy/firms.js` had:

```js
if (f.cash <= 0) { f.badDays++; f.goodDays = 0; }
else if (profit > 0) { f.goodDays++; … }
```

`pay()` clamps to the balance rather than refusing, so a firm that spends what it
earns — wages, rent, inputs — **closes the day on zero**. That is a business at
the margin, the normal state of most of a young city. But `cash <= 0` alone
booked a bad day *and* reset `goodDays`, making the recovery branch unreachable
for exactly the firms that needed it. Throttle at 2 days, a quarter of the staff
sacked at 4, **BANKRUPT at 14** — and every consequence cut revenue, which cut
the next day's cash. The bank could not help either: capacity is
`revenueAvg × maxLoanToRevenueDays − debt`, so the earlier rungs shrink the very
number `autoBorrow()` is sized from.

Now `if (f.cash <= 0 && profit <= 0)`. A genuinely failing firm walks the same
rungs on the same day counts — `_firmcash_smoke.mjs` proves it by driving both
shapes through 30 modelled days.

---

## 6. PROCESS

```bash
npm run check          # fast gate, ~86 suites, seconds
npm run check:full     # + economy gauntlet + forgeab, ~10 min — BEFORE EVERY DEPLOY
npm run deploy
# then verify at the edge with a cache-buster (see Traps)
```

Economy gauntlet baseline is **3 documented known failures** (round0b dead-ground
gate, round0c business trading before upgrade, round0p farm/mine/quarry gen legs)
plus `_plague_smoke` 1. Anything else is a regression. **Never raise a baseline
to make a build pass** — the runner says so itself.

**SIX version knobs move together** (`bump` scripts in the scratchpad show the
shape): `window.BUILD_VERSION`, **`public/version.txt`**, `sw.js CACHE_VERSION`,
node-city `NC_BUILD`, `effects.js?v=`, `handset.js?v=` (last must EQUAL
BUILD_VERSION).

---

## 7. TRAPS — each of these cost real time this session

1. **`version.txt` must move WITH `BUILD_VERSION`.** Otherwise the app's update
   check calls `location.reload()` 500 ms after load and every headless suite
   dies with *"Execution context was destroyed"*.
2. **CRLF files.** `public/src/economy/firms.js`, `mapforge.format.js`,
   `mapforge.bridge.js`, `mapforge.editor.js` and `_athena_smoke.mjs` are CRLF.
   Anchors written with `\n` match nothing. Normalise, edit, write CRLF back.
3. **The file-lock trap.** `UNKNOWN: open index.html` intermittently, on read AND
   write. Always fails *before* writing. Use the `Atomics.wait` retry loop in the
   scratchpad patch scripts and just re-run.
4. **Never use heredocs for patch content.** Backticks and apostrophes corrupt
   `index.html`. Use the Write tool for patch scripts, then run them with node.
   Backticks inside a JS template literal in a patch script break it too.
5. **Minification changes quoting.** Verifying at the edge, `'x'` becomes `"x"`
   and spaces vanish. `grep -c "economy_nodes').select('id,owner_id')"` returns 0
   on a shipped file that definitely contains it. Search a looser pattern before
   concluding a deploy failed.
6. **CDN cache lag.** `version.txt` can read the *previous* build for ~30 s after
   a successful deploy. Re-check with `-H 'Cache-Control: no-cache'` and a
   cache-buster before panicking.
7. **`_checkall.mjs` is JS, not data.** An unescaped apostrophe in a `why:`
   string breaks the whole file — and a broken `_checkall.mjs` piped to `tail`
   reports **exit 0**, so a "gate run" can look green having executed nothing.
   `node --check _checkall.mjs` after every edit. Never `import()` it to test
   parsing — that *runs* the gate.
8. **`| 0` truncates timestamps.** `Date.now() | 0` is 32-bit garbage. Cost a
   silently-dead fix in v121v89, caught only because the suite drove the real
   lifted function instead of asserting on source text.
9. **Don't scan the live DB.** Targeted, `limit`-ed queries only. A full-table
   bug hunt once throttled production and looked like mass data loss.
10. **A building may only `use` a mirrored id or a CITY_STOCK key.** Since
    v121v83 `LEDGER_MIRROR_RES` is *derived* from the recipes, so this is now
    true by construction — **do not replace the derivation with a literal list.**
    That is what starved the Machine Shop and the Feedstock Plant, twice, both
    found by players.

---

## 8. THE PATTERN WORTH CARRYING FORWARD

**Roughly half the reports this session described a cause that was not the actual
cause.** The gas station's output was fine and its tooltip was lying by 60×. The
Card Hunt's RNG was fine and its pool was tiny. The duplicate PRN is the shipped
design. The referral system was never blocked. The vault's "random" max was two
identical jumps caused by a module not being mounted.

The **symptom** was real every single time. Read the report for the symptom,
then go and find the cause in the code — and when the reporter's diagnosis turns
out to be wrong, say so plainly and fix what is actually broken.

Corollary: three fixes this session were *already written elsewhere in the same
codebase* — `_warehouseCapacity()` held a last-trusted value, `households.js`
stated the wage invariant, `campFortify()` guarded the defense cap. **Look for
the pattern before inventing one.**

## v121v91 — shipped 2026-09-09 (later session), full-gated, edge-verified

Tracker after this build: 34 fixed / 9 open.

| Report | What shipped |
|---|---|
| bug-mtp1ltjq (wages, high) | Household Wage Pool per the §3 recommendation. `op_salary` (corp and local ops) credits `Profile.wagePool` less a 30% leak; node-city patronage draws from the pool through `window.cityWagePoolDraw` BEFORE minting. Takings unchanged, ceiling unchanged; the ledger verb now reads "paid worker wages into the city wage pool"; the Trading card shows the share wages paid for. Cloud-synced as `__wagePool__` (newest stamp wins). `_wagepool_smoke.mjs`. |
| bug-mtuadu79 (clinic, high) | Measured, not designed: the raw fallback in `svcDraw` drew MEDICINE for dispensing when the remedies shelf emptied — 1.9× the Clinic recipe, pinning the larder at one unit. A service building now never raids an ingredient its own `use` needs. Restaurant/food fallback byte-for-byte unchanged. The "A Cannery" note names the real maker. `_clinicloop_smoke.mjs`. |
| bug-mtrmzyhc (hiring) | §4 option 1: Job Fair states seats vs. what the roster can name (CIT.MAX / citizenry). Options 2–3 still open as design work. |
| bug-mtu9vzp3 (duplicate PRNs) | The six-in-any-mix rule is now printed on the licence dialog. The second node was NOT deleted. |

Still open and why: bug-mttcdw79 / bug-mtuasm4d / bug-mtu13pzm / bug-mttyizit need the screenshots (attachments still unreadable — see 📷). bug-mtttvge5 (beverages) and the Lumber "feeds nothing" line in bug-mttyizit are the same venue-economics decision. bug-mtsq62mg awaits reporter confirmation. bug-mtr5xz8t no repro. bug-mtr5bze0 feature request.

Note on the wages design: the pool REPLACES minted patronage; it does not raise a shop's takings. If the intent is that factories should make shops richer, that is a one-line follow-up (a bounded spend bonus funded from the pool) and a tuning decision, not done here.

## v121v92 — shipped 2026-09-09 (same later session), full-gated, edge-verified

Worked from the report TEXT alone (the user is asking players for screenshots; attachments still unreadable from here).

| Report | What shipped |
|---|---|
| bug-mtr5xz8t (managed cities not loading first time, high) | `cityStateLoad` retries a refused `city_state` read once behind a bounded `auth.refreshSession()`; node-city `boot()` reads again 2.5 s later when the first read was refused and nothing local stood in. No repro was available — this is the exit-and-re-enter the reporter does by hand, automated. If it recurs, the console line `[cityStateLoad] REJECTED <code>` names the real refusal. |
| bug-mtr5bze0 (startup sequence) | `_cityWarmup()` runs opFetch / frFetch / nodeFetch / cityHallFetch / corpTreasuryFetch in the background 7 s after load and again at the city door when the last pass is >5 min old (bounded 8 s, best-effort). This is what the Bank → City Hall → Licences → PRNs walk was fetching. The Bank of Ethos iframe itself is not touched — if a bank-side init is also load-bearing for the city, that is the remaining gap. |
| bug-mttcdw79 (population, high) | Three quantities shared one word. Army row is now "Free housing slots" (beds − slots) with a tooltip; Vital Signs reads "NPC residents N / M beds"; the economy panel says "Residents (economy model)". The 294 figure in the report was not located in code — it may be the Camp screen in index.html; the screenshots will settle it. Left OPEN. |
| bug-mtrmi2e5 (345 vs 346 residents) | Label only: the economy count is its own household model. Left OPEN with the workers bottleneck. |
| bug-mtsq62mg (Out of cash) | `bottleneck.classify` judged cash BEFORE the material: an input nobody makes read as "out of cash — failing". Material first now; cash only when a supplier exists. Fix text no longer says "failing" (v121v85 made break-even survivable). Still awaiting the reporter — left OPEN. |

Not touched, and why: bug-mtuasm4d (stadium) — readiness reads `game.stock` + `game.res` and the concession ids are CITY_STOCK only, so the panel should be right; needs the image to see which number he means. bug-mtu13pzm (nobody shopping) — the quoted notification text ("nobody is shopping yet", "no goods to buy") does not exist in the tree; needs the image. bug-mtttvge5 (beverages) — venue-economics decision (handoff §2); note the economy-side `beverages` recipe IS reachable (canecroft → sugarmill, hydrofarm fruit, timber packaging). bug-mttyizit — Lumber has a taker (Panel Plant, `use.lumber`) so "feeds nothing yet" only appears when none is built; Workers bottleneck untouched.

New suite: `_firstload_smoke.mjs` (39 passes) drives the lifted warm-up and `classify`.

## v121v93 — shipped 2026-09-09, full-gated, edge-verified

Reported by word of mouth (no tracker row): "players are able to craft booster packs". They could — the Crafting Station (`CRAFT_RECIPES_DEFAULT`, ~index.html:83714) shipped `pack` and `box` recipes whose grant (`_craftGrantPacks`) put REAL unopened packs in the inventory for salvage. It survived the Card Forge removal (`_cardcraft_smoke.mjs`) because it was never called a forge.

Instruction: "cannot craft anything that has anything to do with cards." So:
- `pack`, `box` and the `sleeve` (card sleeve) rows are gone from the defaults; only the dice skin remains.
- `_craftKindAllowed()` is enforced by `getAllCraftRecipes()`, `_craftProduce()` and `craftStationMake()` — a pack recipe in a published Catalog, a cached Forge copy or an old device is not listed, not made, and spends nothing. Resource recipes that would refine one of the five card GOODS ids are refused too.
- The recipe editor no longer offers pack or sleeve outputs.
- Untouched on purpose: the Foundation Reserve pack (a Cinder PURCHASE), shop purchases, gifts and chests; and the Living Economy's `boosterPacks` GOODS chain (sim inventory only — `cardOutput()` reports, never mints).

Suite: `_nocardcraft_smoke.mjs` (30 passes), drives the lifted station against a catalog that publishes pack/box/legacy/dice.

Git: local history repaired (a corrupt tree from 2026-08-17 rebuilt exactly); commit 07dc451367 on `weather-hotfix` is the full tree. GitHub remote `mythicspellbook` is a code-only mirror — pushed a code-only snapshot as branch `v121v92-code`; its `main` was left alone. v121v93 is NOT yet committed.

## v121v94 — shipped 2026-09-09, full-gated, edge-verified

Three handoffs arrived from other sessions (WOODS_FISHING_HANDOFF.md, FARM_HANDOFF.md, HighwayHaulTestDrive.html) plus one audio bug. What was actually recoverable, and what shipped:

| Ask | State |
|---|---|
| Guide audio overlapping | FIXED. `narrative/index.html` AudioSys keeps ONE voice (`playUrl` stops the last clip; `stopVoice` / `voicePlaying` / `onVoiceEnd`). Journal narration waits for its voice-over before moving on; a voiced dialogue line auto-advances when it ends; Next/Skip cut the clip and the next node starts its own; muted/blocked/404 counts as finished. The classic bubble player (index.html `typeBubble`) got the same rule. |
| Feed Operation | NEW. `OPS_ECON.feed` — 1,500,000 🔥 or `azaStartup: 55` (the one alternate price in the table). Yields `animalFeed` 3.0/worker-hr from food 1.0 + water 0.8. Registered in OP_LABELS, the Just Business catalogue (with a second "◈ Found for 55 Aza" button → `opFound` with `pay:'aza'`, charged through `spendSovereigns`, awaited against the ledger, refunded if unsettled, row written only then), the sidebar (`feed` → Homestead Farm), node-city `OP_BP.feed` (mesh farm) and `OP_ECO_MAP.feed` (a `mill` firm making `animalFeed`, the recipe the ranch/egg/dairy firms already draw on). |
| "Add the operations to my companies" | The owner's founded corporation is **Hidn Studios [HIDN]** (founder = the richaegisop admin account). A `feed` row was inserted into `corp_operations` for it after deploy. The other admin emails found no corporation; "Aurelia" is a member of Omnione, not the owner. |
| Homestead Farm | CONNECTED. The farm branch (`claude/3d-animal-farm-sim-02mrk9`, commits cdf3a83…) is on no reachable remote and its commits are not in local history. The ONLY copy of the code that reached this repo is the sandbox artifact the handoff links — a flat bundle of the six modules. It is lifted verbatim as ONE file, `public/src/farm/index.js` (273 KB), mounted by the new `farm` screen (`renderFarm`), bridged by `window.MythicFarmBridge`, saved on `Profile.farm` and cloud-synced as `__farm__`. Not recovered: `sql/038_farm_auction_and_ranch.sql` (player lots + corp ranch — the module prints "not set up on the server yet"), the Reconstruction workforce seams (`farmers()`/`builders()` return 0), the convoy `bestRig`, node-city's `STOCK_FARM_FALLBACK`/smokehouse/dairy and `OPS_FARM_MENU`. Thirteen ids promoted at the four RESOURCES_NEXT sites (RESOURCES 143 → 156). |
| Highway Haul | CONNECTED, practice mode. The freight game's seven files were lifted verbatim from the inlined test-drive bundle into `public/src/haul/index.js` (152 KB), bridged by `window.MythicHaulBridge`, launched from the Haulage Board's new "🛣️ Drive it" button. `animalFeed` hauls as heavy (bulk) and `livestock` as fragile. Its server side (`haul_*` tables and RPCs, that branch's sql/038–039) is NOT installed here and was not in the bundle, so shipments stay practice-mode; `cities()` returns [] (node rows carry no coordinates) so it drives its built-in 16-city map. |
| Woods Fishing expansion | NOT RECOVERABLE. The branch is on no reachable remote and no artifact exists. Round-2 code (WF3 threats, boats, crew, tournaments) IS already in the tree; `src/fishing/{demand,render,index}.js`, the bridge, the cannery op, the six fish buildings and sql/038_fishing_records are absent. Deliberately NOT retuned: switching `OPS_ECON.fishing` to fish yields without the missing Cold Storage bench would strand every Fishing Company owner's food. |

| Terroir charge on two-yield buildings | FIXED — the "eggs waits for that fix" defect in RESOURCE_CINDER_VALUE's own note. Promoting 13 ids re-dealt the ground and the gauntlet went red on the Smelting Foundry (`@dealt over-charged 264🔥 > one unit per leg (4🔥)`). `inputTerroirScale` charged inputs at the MAX of the yields' factors under a comment claiming every building was single-output; the Foundry has yielded metal + ingots since v121v70. It is now the value-weighted mean (Σ yield×V×tf ÷ Σ yield×V), the only factor that keeps a cycle at the catalogue ratio on every ground. New `resValue` seam on the city bridge (→ `_resCinderValue`), mirrored in the gauntlet's fake host; the gauntlet's drift check prices at the module's own rule while `amp` still asserts the ratio never rises, and its two ground checks read the forced yield's own factor (`tfOut`). Gauntlet back at its documented three. |

Verified: `_farmhaul_smoke.mjs` (147 passes, drives the AudioSys with a stub Audio and checks both bridges field-by-field against what each module dereferences); `tmp/_drive_modules.mjs` boots both modules in headless Chromium against mock bridges — overlay painted, farm shell mounted, zero page errors.

## v121v95 — shipped 2026-09-10, full-gated, edge-verified

The bunker (public/base): asked for "remove all of these modals from the bunker pictures when they are clicked on, I just want them to be for show. Remove the buttons down here but Assign change that to Camp and Ethos Heights. Make them big buttons next to the bunker images on the left side and give a tool tip above them."
- app.jsx: a Room renders with no click and never active; the room Panel is handed null. The A hotkey now reaches Camp Ops like the door.
- hud.jsx: the bottom action row (Build, Ethos Heights, Assign, Hire, Bunks) is gone; the minimap cells no longer open rooms; two full-width doors (`.doors .door`) sit at the top of LeftColumn — Camp → `nav:campOps`, Ethos Heights → `ethos` — each with a `data-tip` tooltip rendered ABOVE the button (styles.css `.door::after`, 78px headroom reserved).
- Measured in headless Chromium (tmp/_drive_bunker.mjs): 9 rooms, no panel on click, cursor default, no action row, two 235×99 doors at x=12 beside the bunker at x=319, both postMessages fire, tooltip opacity 1. Screenshot tmp/_bunker_v95.png.
- Suite: `_bunkerdoors_smoke.mjs` (27). base/index.html busters bumped to the build.

## v121v96 — shipped 2026-09-10, full-gated, edge-verified

- Highway Haul: "Drive it" closes the Haulage Board first, then refuses without a FREIGHT truck bought from Prince Portfolios (the charter gift rig is minted `issued: true`; a legacy unflagged gift is discounted; oil/feed/livestock rigs do not count). Bridge `rigs()` lists the lot's freight trucks; `canDrive()` exposes the gate.
- Feed Operation card prints "1,500,000 🔥 · or 55 ◈ Aza".
- Mayor reports (3): `cityResourceHeadroom` fell through to the MAYOR's own getResourceUnits in a client city — now the owner's units and an open vault (bug-mtul7bkt, bug-mtuqepq5); the crew picker read the mayor's cards — now `city_owner_cards_get` (sql/126, APPLIED) gated on the active mayoral contract, ids and counts only, empty roster on a failed read (bug-mtuqna3v). node_mayors data was checked: no self-owner rows, all match tw_node_owners.
- Woods Fishing round 1: RESOURCES 158 (primeSeafood, monsterParts appended); the live trip banks Fresh Fish / Shellfish / Prime Seafood (+ seaweed 1 in 6); fleet drops land as fish; the Fishing Company yields 1.5 fresh + 0.6 shellfish + 0.3 seaweed; Fish Cannery op (400k, 2 fresh fish → 2.8 food/worker-hr) at every op site; Cold Storage bench (5 → 7 etc.); CONTRACTS tab (4 per 8h window, deterministic per user, 1.25–1.70 premium, paid only against fish held) under a weekly tide event.
- Suite: `_fishing1_smoke.mjs` (51). Round 2 (threats, boats, crew, tournament) is the next build.

## v121v97 — shipped 2026-09-10, full-gated, edge-verified

Woods Fishing round 2, written from WOODS_FISHING_HANDOFF into the existing live trip (the branch never reached this repo). One block in index.html after `_wf3Close`, hooked at five seams (trip open, each frame, each cast, each catch, trip close) and never redefining an engine function:
- THREATS: a meter rises per cast (biome × weather ÷ boat sonar), decays idle; at 100 a Reef Shark / Ash Mako / Cinder Hammerhead / Drowned Anomaly / Ash Leviathan surfaces (weighted by biome tier) and bites the hull on a timer, armour soaking a share. Harpoon (4 per trip + mount; 15–30% + 2×level + mods), Flee (speed + stability odds), Fight (the existing card-battle route; a WON fight pays Leviathan Parts on the way back via `_fishingEncounterAfter.parts`). Kill → parts drop. Hull 0 → WRECK: boat docks damaged, trip over.
- BOATS: `WF3_BOAT_STATS` (armour / sonar / stability per class), XP per trip/expedition/kill, level every 100 (`WF_BOAT_XP_PER_LEVEL`), refit slots at L2/L4/L6, `WF_BOAT_MODS` (Harpoon Mount, Reinforced Hull, Sonar Array, Bilge Pumps) via a Docks refit modal (`data-wfa-refit`).
- CREW: `WF_CREW_RANKS` by exp; `_wfCrewHurt` (health, survive roll 70% / veterans 90%, death removed + logged); `_wfExpCrewHurt` on expeditions; the best idle crewman ships as deckhand (luck) and can be bitten.
- WEATHER + CLOCK per trip (`WF3_WEATHER`, night favours rare fish); HOLD = class capacity × 12, ends the trip when full.
- TOURNAMENT tab: `fishing_record_submit` / `fishing_records_top` (sql/127, APPLIED — one record per angler per week, kg clamped ≤120 server-side, read-only to clients); local best kept offline.
- Not built (no data in the handoff to build from): sonar/school VISUALS in the 3D scene, per-species day/night tables, the six fish city buildings, the anomaly hunter trait, coastal-claim luck. Documented, not faked.
- Suite: `_fishing2_smoke.mjs` (52) lifts the block into a vm with a stubbed engine and runs a scripted trip through every path.

A session cron (156f74e7, hourly at :23, 7-day expiry) sweeps the tracker for NEW reports and fixes them without being asked — the standing order of 2026-09-10. Recreate it in a new session.

## v121v98 — shipped 2026-09-10, full-gated, edge-verified

bug-mtvblyi9 (ClareyV, med): the Zone Demand residential tab at ~71% said "Nobody is moving in… Wages, rents, jobs and services are what move that; the Survey tab shows which one is worst" — and the only Survey tab (Econ → Survey) is the deposit survey. Real cause: `src/demographics/pipeline.js` folded the three draws (work × 0.5, rent-against-wages × 0.3, services × 0.2) into ONE meter and never published the parts, so the sentence promised a breakdown that nothing printed.
- pipeline.js: the arrival loop now accumulates the three draws over every household that looked (a household the rent or job gate turned away counts at the score that turned it away); `pullTerms()` publishes `{ terms, worst, worstText }` as `S.pull`. The cause line keeps its housing verdict and appends "Weakest right now: work / rents against wages / services — …" with the percentage and the fix (Job Fair wages, cheaper zoning, operations, Clinic/Market). No score at all → "the row under this meter shows which one is weakest".
- index.js publishes `pull`; render.js prints a "📊 What draws people here" row under the Move-in pressure meter (three bars, weakest in red) with the sentence beneath. Nothing was added to the Survey tab; the breakdown lives where the sentence is.
- Suite: `_pullrow_smoke.mjs` (24) runs pullTerms and renders the panel. Six knobs → v121v98-pullrow (the demographics module imports at `?v=NC_BUILD`).

## v121v99 — shipped 2026-09-10, full-gated, edge-verified

Two more Zone Demand reports from ClareyV, both the same shape as bug-mtvblyi9: a descriptor named a problem and not its parts.
- bug-mtvdb20t (med) "Services falling short — residents cannot buy what they need here" never said WHICH services or how to fix them. Real cause: `services` in the demographics tick is the MEAN of the economy's per-category satisfaction and the per-category table never left `src/demographics/index.js`. Now `servicesBreakdown(E, snap)` joins each category to the basket row and the INDUSTRIES shop that sells it (Food → Grocery Store, Healthcare → Pharmacy…), hands it to the pipeline as `ctx.servicesBy`, and the cause reads "Short: ⚕️ Healthcare 0% (Pharmacy), 🍞 Food 12% (Grocery Store)… Each is sold by the shop named: found one from the Operations catalogue, staff it at the Job Fair, and keep it stocked." Worst first, at most four, only those below `servicesGood`. The v98 weakest-draw sentence names them too when services is the weakest draw. No breakdown yet → says so.
- bug-mtvdpfce (med) Commercial "Almost Nobody Is Shopping Yet" said the basket was under one unit and that satisfaction reads N% "but there is nothing to satisfy" — the reporter read that as inconsistent, fairly. Real cause: the want figure is residents' savings × spend share, savings are wages, and none of that was printed. `src/hud/demand.js residentsSpending(snap)` now prints residents, savings, employed / working-age and wages last round from the snapshot, and ONE lever picked in order (nobody here → housing; under half employed → jobs; employed but wages under 1 🔥 per resident → firms' cash; under 20 residents → residents; else rents). The commercial tab shows the four as stat cells; `fold()` used to drop `stat` for every non-residential category, so this is the first time any of them has had one.
- What a screenshot would settle for bug-mtvdpfce: the reporter also says the descriptor is "inconsistent with the measure". If the meter shows a high commercial % beside this − term, that is the midpoint (50%) plus the other signed terms (labour slack, customers arriving, utilities) — the note under the panel already says the meter is the midpoint plus the weights. If the image shows something else, reopen.
- Suite: `_shopwhy_smoke.mjs` (32) runs servicesShortText and residentsSpending for real. Six knobs → v121v99-shopwhy.

## v121v100 — shipped 2026-09-10, full-gated, edge-verified (late-morning sweep: 7 new + 4 reopened)

| Report | Verdict |
|---|---|
| `bug-mtvg7q4f` (GreyDragon, **critical**) "Mayor resources showing in client city resources" — text says see PDF | FIXED (the code half). v96 fixed `cityGetRes` / `cityResourceHeadroom` / `cityResourceLedger`; three more bridges still answered for the MAYOR in a managed city: `cityGetResMany` (the bulk read the stock panel and the bottleneck plan use) read `_ensureResources()`; `cityVaultState` / `cityVaultMove` offered the mayor's own Bank of Ethos vault; `cityResourceNeeds` handed over the mayor's Forge needs list. All four now answer for the owner (stalled → zeros / refused; managing → `CityMgr.salvage`, vault reported `managed:true` and node-city's vault panel says whose it is). The PDF was never attached to the report — if it shows a surface other than stock/vault/needs, reopen with the panel name. |
| `bug-mtvg7l39` (Sausage) daily-limit toast covering Roads/Pipes/Zones | FIXED. `.toast` is `pointer-events:none` (no toast has a control), gets `.toast-top` while `#node-city-frame` is open, and the held-Cinder line toasts at most once per 30 min (the bell still gets every change). |
| `bug-mtvgyt59` (Sausage) campaign always fights as Cedric | FIXED. `rlcStartRun` fixed `heroId` before the deck pick (first hero unless the campaign pins one). The pick handler now sets `run.heroId` from the chosen deck (`_rlcDeckHero`: starter deck, `getDeckById`, `Profile.decks`; admin decks with no hero leave it alone). |
| `bug-mtty05g7` (Grimalkin Lord, reopened by Gary) game restarts after a dev-points purchase | FIXED. `payReturnRemember` now records the open city (`App._cityNodeId`); `payReturnRestore` reopens it and sets `window.__ncBootOpen = 'progression'`, which node-city reads after the progression module mounts and opens the tree (`progression/index.js` exports `open()`). The return still lands on the title for a second — that is the Stripe redirect reloading the page, which cannot be avoided. |
| `bug-mtvgfy5s` (ClareyV) services read 0% with two grocers, five power plants, a pharmacy | FIXED (the sentence). The shops ARE counted by the economy; satisfaction is take ÷ want and a grocer with nothing on the shelf reads 0% exactly like no grocer. `servicesBreakdown` now counts standing shops of each kind, the stock of what they sell and the producers that make it, so the row reads "2 Grocery Stores standing with nothing to sell: nothing here makes bread, packaged food — found a Bakery" / "no Pharmacy here — found one" / "stocked; residents could not pay". Electronics: a Tech Store IS in the catalogue (OP_ECO_MAP `techStore`); if the card is locked for them, that is a licence/level gate — a screenshot of the Build menu would settle it. |
| `bug-mtrm50hn` (Grimalkin Lord, reopened) referral box locked after entering the invitee's code | FIXED. The reporter typed the code of a player THEY invited into their own redeem box; the row was accepted (naming the newer player as inviter) and the primary key locked the box. `sql/128` (APPLIED) refuses a referrer whose account is newer than the redeemer's BEFORE the redemption is spent (`referrer_newer`), and the client explains it. The reporter's own wrong row still stands — deleting it from `referral_redemptions` is your call (it paid both sides 5,000 🔥 + 5 Aza + a pack). |
| `bug-mtqasoy6` (Gary via Anonymous, reopened) member cities: "numerous cities against my profile", others "no city founded" | FIXED (the label) — MEASURED on the live table: the CEO owns SIX economy_nodes and has five published cities on them (the five listed are real; the other six rows are a local save and five nodes no longer held, correctly hidden). The other four members own NO node; their city_profiles rows sit on the CEO's nodes because they opened and published the CEO's cities while working in them. The panel now says "no city of their own · works in <city> (<owner>)" for those instead of "no city founded". If one city per corp is what is wanted, that is a design change — say so. |
| `bug-mtvgtg34` (Sausage) cannot open the camp rooms from the grid | OPEN, by design. v95 made the bunker rooms "for show" on the owner's instruction ("remove all of these modals… I just want them to be for show"). Decide whether to keep that; nothing to fix in code. |
| `bug-mtvgecfl` (Aston Drakonis, iOS) "Campaign — the path is stretched out and cannot move the truck; straight lines as shown in video" | OPEN — the video is not attached and the text does not say which mode (Highway Haul is the only truck; its road is a three.js scene). What an image would settle: whether the 3D scene failed to build on iOS (only the route lines drew) or the tap controls did not register. Nothing changed. |
| `bug-mtvg117e` (Sausage, low) flickering number boxes "C96, C3, C80" bottom-centre in City mode | OPEN — nothing in node-city or the parent prints a bare "C" + number at the bottom centre (the parent toast is bottom-centre but prints words). The screenshot would settle it; it is attached but unreadable from here. |
| `bug-mtubctds` (Grimalkin Lord, reopened) Remedies absent from Bank Vault / Player Market / Foundation Reserve | OPEN — by design today: `remedies` (with rations, goods, reagents…) is CITY_STOCK, not a game RESOURCE; node-city documents the trap (sim.js header, CITY_STOCK §2b) and the promotion recipe (RESOURCES row + cloud whitelist + remove from CITY_STOCK). Promoting it is a design call with economy consequences (Health coverage draws from `game.stock.remedies`). Say the word and it gets the farm-id treatment. |

Suite: `_sweep3_smoke.mjs` (48) runs the three bridges, `_rlcDeckHero` and the new `servicesWhy` for real and diffs sql/128 against sql/058. `_corpcities_smoke.mjs` pin updated for the shared-row form. Six knobs → v121v100-sweep3.

## v121v101 — shipped 2026-09-10, full-gated, edge-verified (the owner's list, sent mid-sweep)

| Ask | Done |
|---|---|
| "When opening Feed operation it does not open, just a black screen" | FIXED. `renderFarm()` RETURNED its HTML; every other screen writes `root.innerHTML` itself and `render()` never paints a returned string, so the page cleared and nothing was drawn. Reproduced on the live build (App.screen = 'farm' → #app empty, no error). It now writes #app like the rest. |
| "Make the operation tab neater and cleaner" | DONE (a tidy, not a redesign): registry cards are flex columns with the stat block at the bottom so neighbours line up; every stat row shares one padding and one dashed rule; the description line has a minimum height. Say what else looks untidy and it gets a second pass. |
| "Open the Construction company to every player, licence free and open, but they must start a business and own it from Operations in Just Business; make it the cheapest company: 10 Aza or 20k Cinder" | DONE. `OPS_ECON.construction` = 20,000 🔥 or `azaStartup: 10` (the cheapest priced operation; the registry card shows both prices). `CITY_LICENSES.construction` = no fee, no materials, compliance floor 0. `cityHoldsLicense('construction')` / the licence row's "waived" line are also satisfied by OWNING a Construction Co. (`_ownsConstructionCo`, off the corp_operations rows Just Business already holds). A mayor's own Company now counts in a CLIENT's city: the parent publishes `cityMayorBuildCo()` (Companies + workers) and node-city's `bldSlots` / `bldSpeed` add it with the sited-Co arithmetic while `gov.isOwner === false` (v-earlier `bldMayorCo` only lifted the duration ceiling). |
| "In Bank of Ethos allow players once to obtain a loan for 40 cinder (only once)" | DONE as **40,000 🔥** — read as forty thousand, since 40 Cinder would not buy anything and the cheapest company is 20,000. If forty was meant literally, change `BOE_STARTER_LOAN_CINDER`. A "Starter loan · 40,000 🜂 (once)" button on the Ethos Loans page; no hero collateral; an ordinary boe_loans row tagged `note = 'starter'` (that tag is the once-only rule), four weekly installments, principal credited by the existing `boe_loan_disburse` RPC; refused while any loan is active. |
| "Random buildings appearing in players' cities due to being registered to another player's node… players joining guilds — random PRN nodes are spawning in players' cities" | FIXED at the cause found: the city rings itself with anchors from `FoundationReserve.nodes`, which is the whole CORPORATION's reserve — so joining a corp rang a member's own city with the founder's PRN anchors. `fetchNodes` (own city) now keeps only nodes whose `owner_id` is the viewer (rows without an owner are kept). A client city still rings with its OWNER's nodes (`cityOwnerNodes`, unchanged). Camp REGISTRATION never placed anchors (the Reconstruction seam is `tw_camp_registrations`, read only by the Employment Board); if a registered player still sees foreign buildings after this build, a screenshot of the building card would settle which path placed it. |
| "In Reconstruction pull from the city node the player is registered to and hire from the NPC population there; the message only when the node has no built city / no NPCs" | DONE. The owner's city now publishes EVERY resident not on an errand (not only the jobless) as its labour pool (`citLabourByRole`), so a built city always has people on the board; a hire still leaves it one short (sql/088). `sql/129` (APPLIED) makes `camp_labour_market` list every published trade including 0 free (the client already disables the button and prints "0 avail"), so an empty board means exactly "no city with residents on this node", and the board now says that. Reach and never-your-own-city rules from 088b are unchanged. ⚠ The pool is published from the OWNER's open game every 20 minutes (`cityTradePublish`); a node whose owner has not opened their city since this build still shows the old pool until they do. |
| "Build it where city builders of mayors, registered camps/cities and corporations do not clash — everyone has their own city data" | This build closes the two leaks found (corp-wide anchors above; the mayor's ledger/vault/needs in v100). City state itself is per node and per owner already (`city_states`, CityMgr owner ledger). Anything still crossing over needs the building name and whose city it appeared in. |
| "Account and device data transfer is still not working — different data on my other PC" | NOT CHANGED — nothing to act on yet. The sync guard is most-recent-write (cloudFetchProfile compares the cloud row's updated_at against the device's last local edit with a 5 s grace; a real sign-in forces the cloud copy). To find the cause I need, from the PC that shows the wrong data: which figures differ (Cinder? cards? camp level? the city?), the build number in the corner, and whether that PC was signed in with a persisted session or signed in fresh. A screenshot of the Profile page on both PCs would settle it. |

⚠ The Construction Co. price is PINNED, not merely tabled: h016 clamped it FREE through any published override so a stale catalog (350,000) could not paywall it; the same stale catalog would now reprice it, so `OPS_FREE_LICENCE` is empty and `OPS_PINNED_PRICE = { construction: 1 }` makes the table's startup / azaStartup the last word through any override. §8 of tools/economy-tests/run.mjs was re-pointed at the new rule (it pinned startup 0 and would otherwise fail for ever).

Suite: `_ownerlist_smoke.mjs` (47) runs renderFarm against a fake document, the licence/gang readers, the loan refusals, node-city's slots/speed with a mayor Co., the anchor filter, and diffs sql/129 against 088b. Six knobs → v121v101-ownerlist.

## v121v102 — shipped 2026-09-10, full-gated, edge-verified (the owner's afternoon list)

⚠ STANDING ORDER REVISED 2026-09-10 (afternoon): "before auto fixing things in the bug tracker let me approve it first." The hourly sweep (cron 862febcc, replaces 156f74e7) now TRIAGES only — it reads new reports, finds the cause, writes up the proposed fix, and waits for the owner's yes per report before any code change, deploy or "fixed" mark.

| Ask | Done |
|---|---|
| "Make sure the leaderboard stats on the little phone" | The phone's 🏆 Leaderboards app was already wired (window.MythicLeaderboard → sql/124 `lb_cities` / `lb_players` / `lb_city_resources`, all present and returning rows on the live DB: 25 cities on cinder and population, 25 players on wins and kills, 16 on rating, 4 on ranked). Your own row was marked "you" but nothing was said when you were outside the top — it now prints "You are #n of the N ranked" / "You are not in the top N on this board yet" / "Sign in to see where you stand". If the ask meant something else (a stat that is missing, a board that shows empty), say which board. |
| "Listing something for sale didn't list, but the resources were deducted" | Not reproducible from the code or the data: `resource_listings` shows listings landing (five in the last 24 h, three at 11:56–11:57 today), `rl_post_listing` RAISES on every refusal (TOO_MANY_LISTINGS, TOO_FAST, NOT_SIGNED_IN…) and the client unescrows on any error. What would settle it: the resource, the amount, the time, and whether it showed under My Listings after a refresh — a listing that was posted but not shown is a different bug from one that was refused. |
| "Depositing into the Foundation Reserve — nothing happened but the resources are gone" | One real hole closed: the refund of a FAILED contribution went through `addSalvage`, which clamps to the stash ceiling — on a full stash (the usual state right before contributing) the refund was silently eaten. It now goes through the unclamped `_refundRes` and persists. Contributions themselves are landing (172 rows updated in 24 h). |
| "…or in the vault" | One real hole closed: the bank's resource write (`_boeResTx`) updated `bank_of_ethos … eq(user_id)` without selecting, and a PostgREST update that matches no row returns success with nothing written — the stash was debited, the vault never moved. The write now selects the row it touched and a 0-row write fails, which makes `boeDepositRes` unwind and refund both the units and the 2,500 🔥 fee. 78 of 125 profiles have no bank row yet; those accounts open one on first bank visit, so a deposit before that ever loaded would have hit exactly this. |
| Homestead: "move the buttons at the bottom to the top because you cannot see them" | DONE. `.farm-bar` is at the top (10 px; 4 px on phones, with the HUD moved under it and the panel using the bottom). |
| "Make it where you need corn, bread, fruit to craft feed, after the Feed Mill is built" | DONE. `feedMillRecipe` = 6 corn + 4 bread + 4 fruit → 24 Animal Feed (all three are ledger resources the city farms and bakeries bank); the existing gate already refuses until the Feed Mill is built and ready. |
| "Increase the amount of resources needed to build these" | DONE. Every level of every farm building: resources ×2, Cinder ×1.5 (Feed Mill L1 22,000/30 wood/20 stone/10 water → 33,000/60/40/20; Cattle Barn L1 90,000/120/60/30 → 135,000/240/120/60). 35 cost rows. |

Suite: `_farmfeed_smoke.mjs` (26) runs the vault seam against fakes (0 rows → ok:false) and pins the recipe, the bar, and the raised costs. `_farmhaul_smoke.mjs` buster pin relaxed. Six knobs → v121v102-farmfeed; the farm module buster moved to farm2.

## v121v103 — shipped 2026-09-10, full-gated, edge-verified (Homestead: no flash, the city's sky)

Owner: "Fix the flashing that all of the pages do like it refreshes… and when it comes to pressing buttons on the feed stock it changes the weather. The weather should be exactly like how the city builder weather and time is."
- FLASH: `paint()` rebuilt the ledger, HUD and panel `innerHTML` on every 20 s tick AND every click, whether or not anything changed — a full rebuild reads as the page refreshing. A `setHtml(el, html)` helper now diffs against the last paint and writes only when the markup differs, keeping the scroll position. The 3D scene already re-lit only on a weather/sky key change.
- WEATHER ON A CLICK: the farm rolled its own 6-hour weather off the camp seed (`weatherAt(seed, now)`) and read it from two places (`seedOf(host)` vs `s.seed`) — a click could repaint through the other reader and flip the chip. Replaced at the source: node-city's live `wx` (which lives only in the iframe and was never serialised) is now PUBLISHED to `localStorage.nc_wx` ({type, until, at}) at the top of every weather tick when type or deadline changed; `MythicFarmBridge.cityWeather()` reads it and `cityHour()` gives the city's clock (America/New_York, the same formatter node-city `estClock` lights the city by). The farm's `weatherAt` takes the city's answer first (cloudy→overcast, snow→snow (new row, never rolled), tornado/fire rain/anomaly→storm; a front whose `until` passed while the city was shut reads as clear) and rolls its own only for a player whose city has never run. The 3D sky follows the clock (night <5 and ≥21, dusk 5–7 and 19–21, day between — node-city `phaseBlend` bands); the HUD prints "HH:MM city time".
- ⚠ Parity is exact while the city is running (it publishes on every change) and "last known, honouring the deadline" while it is shut — the city's weather is random per session and cannot be re-derived without it. The farm's raid/egg/graze multipliers still key off the mirrored weather.
- Suite: `_farmsky_smoke.mjs` (30) lifts `cityWeatherAt` / `skyForHour` / `setHtml` and runs them. Six knobs → v121v103-farmsky; the farm buster moved to farm3.

## v121v104 — shipped 2026-09-10, full-gated, edge-verified (Construction Co. at home AND in a client's city)

Owner: "a player cannot place his construction company in his city because it is saying his construction company is placed in another city. Allow only mayors' Construction Co. to be placed in other players' cities, and even if their construction companies are placed in another city allow them to place it in their own."
- Cause: an operation row carries ONE `meta.site`. A mayor who sited their Co. in a client's city (the one op a mayor may site there — `opsMayorMaySite` / `cityOpsSite`) then found the card locked at home: `opsRowsOf` read the row as `elsewhere`, the card said "Sited in another city", and `cityOpsSite` refused with `already-sited`.
- Fix (construction only): the build-menu card offers a Co. that stands elsewhere as placeable here (`resite`), `tryPlace` sites the elsewhere row when none stands here, and `cityOpsSite` lets a construction row be sited again — the one `site` MOVES to the city it is placed in (same city twice is still refused). The building already standing in the other city is left where it is: the reconcile there touches no row that points elsewhere, the tile still counts for `bldCoTiles()`, and a managing mayor's crews there are counted off the mayor's own manifest since v121v101 (`bldMayorCoStats`). Every other operation keeps the one-plot rule; the mayor rule (only construction in a city you manage) is unchanged.
- ⚠ The moved-away building has no live row behind it: `opsRowAt` there returns null, so its own workers read 0 in that city (the mayor's manifest fills that in while managing); demolishing it there is a plain demolition. If a Co. is wanted to keep TWO live rows, that is a multi-site row shape (`meta.sites` keyed by node) — say so.
- Suite: `_cohome_smoke.mjs` (20) runs the card gate and `cityOpsSite` against fakes for all four shapes. Six knobs → v121v104-cohome.

## TRIAGED 2026-09-10 evening — APPROVED by the owner ("Fix those bugs") and shipped in v121v105 below

| Report | Cause found | Proposed fix |
|---|---|---|
| `bug-mtvziq1a` (Grimalkin Lord, high) reagents read 0 while being produced | node-city `economyTick`: every consumer's `use` is added to `spendNeeds` BEFORE the input gate decides whether the building runs (29956 vs 29964), and the total is subtracted from city stock clamped at 0 (30282). When reagent demand exceeds supply (Smelter 0.09/min vs Research 0.30 + Med Lab 0.28 + …) the stock is drained to exactly 0 every tick, every consumer is gated offline and still charged, and the balance never accumulates. | Charge inputs only for buildings that actually run, and when short share stock proportionally (run and charge at supply ÷ demand, the way `opsLabTick` already does). ~10 lines in `economyTick`; economy gauntlet must pass. |
| `bug-mtw1n1bi` (Fuzzy, high) Construction Co. disappeared; a message when placing a new one | No code path deletes a Co. tile (the reconcile's deleting pass is dead code after `return;` — "left standing on purpose"; the anchor pass removes PRN anchors only). The MESSAGE is almost certainly the "sited in another city" lock that v121v104 lifted for construction — the reporter is in GreyDragon's corp with a camp registered elsewhere, and a mayor-placed Co. in a client city produced exactly that lock at home. The tile vanishing is unexplained without the image; the cross-device profile mismatch the owner reported is the other candidate. | Ask Fuzzy to reload (v121v104) and place again; if the message persists or the tile is still gone, the screenshot's message text settles which path. |
| `bug-mtw1v5e2` (ClareyV) cannot license more than 6 PRNs; has a duplicate | By design: `NODE_MAX_PER_CORP` = 6 total per corporation in any mix (`nodeEstablish`), and the Reserve panel says so. There is no "abandon a node" action, so a duplicate cannot be traded for another type. | Design call: raise the cap, or add "Release node" (delete the economy_nodes row, refund nothing / part) so a corp can swap a duplicate. Placement per city is already the anchor ring, unlimited by the licence count. |
| `bug-mtw1qg89` / `bug-mtw1jo7k` (Grimalkin Lord) Rations / Planks only on the phone leaderboard, not in the Ops Vault, Reserve or Market | Same shape as `bug-mtubctds` (Remedies): rations, planks, ingots, components, reagents, goods, remedies are CITY_STOCK — they live in the city builder only (node-city sim.js header, §2b). sql/124's `lb_city_resources` ranks `state.stock` keys, so the phone shows them as boards, which sets the expectation. | Either promote them to game RESOURCES (RESOURCES row + cloud whitelist + remove from CITY_STOCK, the farm-id recipe — an economy change: Health coverage draws from `game.stock.remedies`), or label the phone board "city stock — stays in the city builder". One decision covers all three reports. |
| `bug-mtw1eyki` (Grimalkin Lord) "Shut Down Corporation" button | Feature: there is no leave/dissolve path at all (grep: no corp_leave / corp_dissolve RPC or UI), and sql/078 enforces one corporation per founder, so a founder can never join another. | New RPC `corp_dissolve` (founder only; refuses while the treasury/vault hold anything or ops are sited, or sweeps them by rule) + a button in City Hall → Registry with a typed-name confirm. |
| `bug-mtvzvnwt` (Grimalkin Lord) Production Chain "Feeds" cut at 4 with "+N more" | node-city 34007-34008: the feeds line is `arr.slice(0, 4)` + " +N more". | Print the whole list (or a "show all" toggle) — a two-line change. |

## v121v105 — shipped 2026-09-10, full-gated, edge-verified (the approved batch + the 3D map only)

| Report | Done |
|---|---|
| `bug-mtvziq1a` (Grimalkin Lord, high) reagents read 0 while produced | FIXED in node-city `economyTick`: a consumer's inputs are charged ONLY when it runs, and every city-stock input is shared in proportion — `share = 0.9 × shelf ÷ last tick's full demand` (read at the top of the tick, after last tick's spend and before this tick's production), scaling the draw AND the output (goods, Cinder, power). With demand 7× supply the shelf settles above zero and every consumer keeps running at its share (the suite replays 40 ticks). No economics numbers changed. |
| `bug-mtvzvnwt` (Grimalkin Lord) Production Chain feeds cut at four | FIXED: the feeds / fed-by lists print every building. |
| `bug-mtw1v5e2` (ClareyV) six PRNs, one a duplicate, no way out | DONE: each node card in the Foundation Reserve has 🗑 Release — the member who licensed the node deletes it for good (economy_nodes `en_del`, owner only, the delete proves it touched a row), nothing is refunded, the reserve re-reads and a licence slot frees. The cap of six per corporation is unchanged. |
| `bug-mtw1qg89` / `bug-mtw1jo7k` / `bug-mtubctds` (Grimalkin Lord) rations / planks / remedies nowhere but the phone | DONE, player-driven: the three are game RESOURCES now (rows appended LAST after the fishing ids; SALVAGE_RES; Cinder values 5 / 6 / 9; MINIGAME_IDS), and the Warehouse's Refined stock card has "📤 Send N to stash" per good, which moves the pile out of city stock into the ledger through the bridge (put back if the stash refuses). Inside the city they are still CITY_STOCK — kitchens, clinics and yards draw from the shelf exactly as before; nothing leaves the city unless the player sends it. Once in the stash they show in the Ops Vault, the Reserve Contribute tab and the Player Market like any resource. Goods, components and reagents stay city-only. |
| `bug-mtw1eyki` (Grimalkin Lord) "Shut Down Corporation" | DONE: `sql/130` (APPLIED) `corp_dissolve(p_corp_id)` — founder only, refuses while the treasury holds Cinder or the vault holds items (pay out / withdraw first with the existing tools), then deletes the corporation row (members, requests, licences, operations, staff, offers, chat, policies cascade; licensed nodes survive under their owner via SET NULL). The founder's Guild & Hiring panel (where members see Leave) has "🏢 Shut down corporation" with a typed-name confirm; the parent action calls the RPC and resets the corp state like Leave. |
| `bug-mtw1n1bi` (Fuzzy, high) Construction Co. disappeared | Not reproducible in code (no path deletes the tile); the placement message is the one v121v104 lifted. Left OPEN until Fuzzy reloads and reports — a screenshot of the message text settles it. |
| Owner: "Remove Classic map from the rogue map — only the 3D map" | DONE: the in-map "🗺 Classic map" button is gone and `_rlcUseAscent` answers true regardless of the old localStorage opt-out or a campaign's `useAscentMap === false`. The 2D board code stays for the editor. |

Suite: `_batch1_smoke.mjs` (32) replays the share rule, lifts nodeRelease, corp_dissolve and the stash-send handler. Pins updated: `_citystock_smoke.mjs` (card title), `_fishing1_smoke.mjs` (the last five RESOURCES ids). Six knobs → v121v105-batch.

## v121v106 — shipped 2026-09-10, full-gated, edge-verified (the valuation panel tracks real player sales)

Owner: "keep track of real data when it comes to the sell price — this card (Bahamut King of Good Dragons) sold for 300,000 cinder to a player so the market should have tracked and counted that, and the price and chart should have reflected it… same as resources."
- Found: the server already had the sales — `card_market_listings` holds the sold rows (this card: 300,000 🔥 on 2026-09-09 and 500,000 🔥 on 2026-08-12) and sql/115 `luni_price_history('card', card_id)` is the public read the item pages already draw. The Digital Valuation modal (`renderDvsAssetModal`) never asked it: its "Recent sales" was the BUYER's own local `Market.salesLog`, its chart was the local hourly model snapshots, and its Suggested Cinder Value was the model alone — so the seller, and everyone else, saw "No recorded sales yet" and 468 🔥 beside a real 300,000 🔥 sale.
- Now: the modal fetches the real feed through the Luni cache (and repaints when it lands), lists the real sales with "Last sold N 🔥 · N recorded player sales", draws the chart from real sale points when two or more are in view (model snapshots only for an untraded card), takes the 24h/7d/30d deltas from them, and the value box becomes **Market Cinder Value** = 70% × the real average in view + 30% × the model (the model still anchors against a single outlier; Aza-priced sales are left out of the Cinder maths). For Bahamut that is 0.7 × 400,000 + 0.3 × 468 = 280,140 🔥.
- ⚠ Not changed: the market TILES' small "suggested" chip still shows the model (it has no feed per tile); and the wider Stock Market view (main chart + ticker) is still the local sales log — the owner's next ask (v121v107) is to rebuild that on real data across all players with 1 h / all-time highs.
- Suite: `_realsales_smoke.mjs` (17) lifts the modal and renders it against no sales, one, two, and an Aza-only sale. Six knobs → v121v106-realsales.

## v121v107 — shipped 2026-09-11, full-gated, edge-verified (the Crash/Exchange on the real shared tape)

Owner: "update the stock market to make it look and feel like a real stock market where it shows the 1 hour and all-time highs and real data vs all the players."
- Found: every player's buys and sells already moved ONE shared price per asset (`cx_prices`, realtime-synced). What nobody held was the HISTORY: each client kept its own 80-point local tape (`cx.history`) and padded it with a synthetic curve (`_cxGenSyntheticSeries`) when thin — so two players looking at the same asset saw different charts, and no 1-hour or all-time high could exist.
- `sql/131` (APPLIED): `cx_price_history` — a trigger on `cx_prices` appends every shared price change (skips writes where the price did not move); backfilled with the 666 current prices; read-only to players. `cx_history(asset, seconds)` returns a range downsampled to ~400 points; `cx_stats(asset)` returns 1 h / 24 h high-low, all-time high (with its date) and low, the price 24 h ago, point count, first point; `cx_stats_all()` the same per asset plus a 16-point spark.
- Client: `CXHist` cache (60 s TTL, one fetch in flight per key, repaint when a fetch lands). `_cxGetHistory` draws the shared tape when it has two points for the range (the live price appended as the last point); local tape / synthetic curve only until the first fetch lands or for an asset with fewer than two shared points. The focus toolbar shows **1H high/low**, the range **HIGH/LOW**, **ATH** (title carries the date) / **ATL**, VOL, and a ● LIVE mark when the line is the shared tape. Every market and portfolio row's 24H Δ is measured against the shared price 24 h ago (`_cxDelta24`; the base-price delta only until the tape has a day), and table sparks are the shared 24 h spark (no per-row fetch). The exchange asks for every asset's stats once a minute on open.
- ⚠ The tape starts today: until it has a day, "24 h ago" is empty and rows fall back to the base-price delta; ATH equals the current price for assets nobody has traded since the backfill. The order book, world events and insider intel panels are still the synthetic dressing they were.
- Suite: `_cxtape_smoke.mjs` (24) lifts the fetchers and runs the in-flight guard, the shared-series read and the 24 h delta. Six knobs → v121v107-cxtape.

## v121v108 — shipped 2026-09-11, full-gated, edge-verified ("check the bug checker and fix what is on there")

| Report | Verdict |
|---|---|
| `bug-mtsq62mg` (Grimalkin Lord, reopened ×4) "Out of Cash — Limited by Business 0%" for days, then bankrupt | FIXED at the root that was left: v91 stopped counting a zero balance alone as a bad day, but a firm that could not afford its FIRST inputs had `revenueAvg` 0, so `creditLimit()` (revenue × 90 days) was 0 and the bank could never lend; and `autoBorrow` fired only at DEBT/DEFAULT, which a firm that never trades (never loses money) never reaches — stuck at 0 for ever. Now `creditLimit` has a working-capital floor of five days of operating cost for a firm with no revenue history (`ECON.bank.startupDays`), and `autoBorrow` also fires for a firm at 0 cash with no revenue today (a firm breaking even at zero is left alone). Needs a Bank in the city — the Out-of-cash verdict now says so. Economy gauntlet unchanged at baseline. |
| `bug-mtrmi2e5` (Grimalkin Lord) "workers 0%" with 345 residents, 207 employed, 3% unemployment | FIXED (the sentence): all three numbers were true at once — residents include children and retirees, and 3% unemployment means the working-age pool is spent. The primary bottleneck now says "Only N of M working-age residents are free to hire (E already employed; P residents in all — children and retirees do not work)" and what raises them. |
| `bug-mtu13pzm` (Grimalkin Lord) nobody shopping + "a non-numeric value presented" | FIXED (the value): `qty()` printed `1e-7` for a basket under a hundredth — now "under 0.01". The shopping verdict itself was rebuilt in v121v99 (what makes a basket, and the one lever). |
| `bug-mtuasm4d` (Grimalkin Lord) Stadium not picking up Remedies, Goods, Rations | FIXED (the panel): the readiness reads city stock correctly (`nodeStockView` = city stock over ledger) but printed only one "N% served" figure, so a short line read as a resource not plugged in. Each concession line now shows HAVE (city stock) / NEED for the event's attendance and length, ✓ or short. |
| `bug-mttcdw79` (GreyDragon, high) population figures disagree | Already addressed in the tree (node-city `renderArmy` — the Army row is housing slots and says so; beds, slots, NPC residents and the model's households are four different true numbers). Verified served at the edge; marked fixed. |
| `bug-mttyizit` (Grimalkin Lord) values at 0% for all companies; "Lumber isn't going anywhere" | Explained: the Workers bar now moves (reporter's own follow-up); Lumber is a ledger resource, and its Production Chain line already reads "feeds nothing yet — it banks to your vault"; Structural Steel / Metal Components at 0% are inputs no building in that city makes (the chain says "nothing in this city makes it"). Marked fixed. |
| `bug-mtvgtg34` (Sausage) cannot open the camp rooms | WON'T FIX — by the owner's v121v95 instruction (rooms are for show; the two doors are Camp and Ethos Heights). |
| `bug-mtvg117e` (Sausage, low) flickering "C96, C3, C80" boxes bottom-centre in City mode | OPEN — those look like citizen ids (c96…), but no code path prints one as a label (hover tips print the name); the attached screenshot would settle it. |
| `bug-mtvgecfl` (Aston Drakonis, iOS) truck path stretched, cannot move | OPEN — needs the video. |
| `bug-mtw1n1bi` (Fuzzy) Construction Co. disappeared | OPEN — awaiting a reload on v121v104+. |

Suite: `_tracker_smoke.mjs` (21) runs creditLimit / autoBorrow / primary() / qty() / concessionFulfilment for real. `_firmcash_smoke.mjs` pin updated to the new lending rule. Six knobs → v121v108-tracker.

## v121v109 — shipped 2026-09-11, full-gated, edge-verified (candlesticks on the exchange; real exits in Highway Haul)

Owner: "change the chart lines to the stock bar candles… and show the price when a player hovers over the candles" / "in the 3D haul for the exit make it where it actually takes the exit and goes to a new highway instead of putting the car back on the road."
- **Candlesticks.** The Crash/Exchange focus chart buckets the shared tape (v121v107) into open/high/low/close bars — 12 per hour range, 24 per 6 h and 24 h, 28 per week, 30 per month, 40 for ALL (`CX_CANDLES_PER_RANGE`); green when the close is above the open, red below; the live price is the last point. One delegated `mousemove` listener (bound once) shows a tooltip beside the cursor with the bucket's time span, tick count, O / H / L / C and the bucket's % move. The old line chart stays for an asset with fewer than two candles (a card nobody has traded, or a range with one point).
- **Real exits.** Before: at a correct exit the rig was clamped straight back onto the same road (`S.x = min(x, ROAD_W/2 − …)`) — the ramp led nowhere. Now a correct, non-final exit leaves the highway: every segment is re-seeded (`legSeed` = hash of the road it is leaving for, folded into the prop RNG) and the building palette steps (four palettes, one per highway), a full-screen merge overlay names the new road ("↗ EXIT → CINDER FORK HIGHWAY · merging onto the new highway"), and the rig is eased from the ramp into the slow lane over 2.4 s with the rails held off, then a flash names the highway. A wrong exit (or the final exit into the destination) still clamps back and reroutes exactly as before, so the scoring is unchanged. The road centreline function is shared, so the two highways differ in scenery, palette and name rather than lane count.
- Suite: `_candles_smoke.mjs` (24) lifts the bucketing, the SVG and the tooltip, and runs the merge easing. `_farmhaul_smoke.mjs` buster pin relaxed (haul2). Six knobs → v121v109-candles.

## v121v110 — shipped 2026-09-11, full-gated, edge-verified (the flatbed semi and its containers; raiders cannot drive through traffic)

Owner (with three Meshy GLBs): "Make it where raiders cannot go through cars, where if they are coming to ram the player and there is traffic the traffic can help the player… Change the freight trucks into this and then change the freight truck model that the haul mini game [uses] into the freight truck… picked from Prince Portfolio. Also when it comes to the containers use these container models and still use the animations and physics of the containers that we already have."
- **The models.** Packed by `tools/glbprop.mjs` (masters in `assets-source/glb-masters/{trucks,containers}/`, never under public/): the white flatbed semi 26.7 MB / ~3M tris → 0.84 MB / 12k tris (`models/trucks/freight_semi.glb`), the blue 20-ft container 19.9 MB → 0.59 MB, the red 40-ft container 16.7 MB → 0.53 MB (512px WebP). Three re-include lines in `public/.assetsignore` — without them the blanket `**/*.glb` rule 404s a model in production only.
- **Prince Portfolio.** Every freight rig row in `src/transport/rigs.data.js` (six rows, five body types) now carries `FREIGHT_MODEL` (`rotY: 90` — the mesh's long axis is X with the cab at −X), so the Truck Yard card and the vehicle modal show the semi where they showed nothing. One body for five body types is the owner's call ("the freight trucks"). `_rigyard_smoke` pin updated (a freight rig resolved null by design before).
- **The haul drives the truck you picked.** The bridge's `rigs:` list copies `_ppModelOf(v)` onto each lot row; `rigProfile` keeps it; the run loads it with the GLTFLoader from the SAME three.js 0.171 build the run imports (the addon resolves its `three` import through the page's import map, so there is one instance — window.THREE's legacy loader would hand the WebGPU renderer foreign objects), flattens materials to Lambert, fits it uniformly to the traffic trucks' width (2.4 m) capped at 14 m, and hides (never removes) the procedural cab/bed/wheels — they are the fallback if the file fails, and the run starts on them before the file lands. The collision half-length becomes the fitted model's (per run, `let PLAYER_HALF_L`, capped at 7.2 m) and the chase camera backs off by the extra length.
- **Containers, same animation.** The three cargo crates became three GROUPS (`userData.cargo`) with the crate as a child, so the cargo animation in draw() (scale + tilt per cargo child with the cargo %) is untouched. When the semi lands, `haulDeckOf` finds the deck in the mesh (the low run of height bins behind the cab, sampled on the centre strip so the wheels stay out) and the slots are re-laid along it: the red 40-footer rear (58 %), the blue 20-footer front (42 %), each fitted to its slot on every axis via a scaled holder (scaling the turned model itself put the length scale on the width — caught by the suite). The third slot is hidden. A guard rides on the cab roof.
- **Raiders vs traffic.** A raider was a homing point that slid through every car. Now `raiderLead` (the nearest car ahead of it, in its width, not yet past the rig) is its lead; `raiderSteer` brakes it behind that lead and aims for the gap beside it on the rig's side (or the other side when that is off the road); it can never overlap the lead; and a raider held off for `RAIDER_GIVE_UP_S` = 6 s gives up — "🚗 TRAFFIC HELD THE RAIDERS OFF", counted as beaten. The how-to says so.
- Suite: `_semi_smoke.mjs` (41) pins the files, the allow-list, the rows, the bridge, the run wiring, and runs raiderLead / raiderSteer / haulFit / haulDeckOf for real on node's three. `_candles_smoke` buster pin relaxed. Six knobs → v121v110-semi.

## v121v111 — shipped 2026-09-11, full-gated, edge-verified (signals, A/D, the semi done properly, traffic)

Owner: "The turn signals are wrong… in the city builder A moves right and D moves left… the traffic in the haul flickers and does not appear after a while." Then, with a screenshot of a sideways box truck wearing containers: "This does not look right, make the truck look good and sizeable, facing the right way… and the turning signals are still wrong."
- **Blinkers.** Every vehicle in the run is built nose-at-+Z and turned 180°, so the model's local −x is the driver's RIGHT. `addBlinkers` put L at −x and R at +x — mirrored for the rig and every traffic car. Sides swapped; the steer sign and the traffic signal direction were already right.
- **City builder A/D.** `keyPanTick` built the camera-right vector as (fwd.z, 0, −fwd.x), which is forward × up NEGATED — left. D panned left, A panned right. Now (−fwd.z, 0, fwd.x).
- **What the screenshot was.** The owner's freight lot row carries an admin-uploaded box-truck render (`modelUrl`, rotY 0 — the HidnEx truck), and v110's bridge preferred a row upload over the catalogue, so the haul drove that box truck sideways (its long axis is X) and `haulDeckOf` could find no deck on a box body, so the "guessed" deck stacked both containers on its roof. Three fixes: (1) the haul now takes the CATALOGUE class model first (`_haulModelOf` — the semi for every freight rig), a row upload only when the class has none; the yard card keeps the other order. (2) `haulAutoOrient` measures the mesh — long axis to Z, tall end (the cab) to +Z — so no rotY knob can put a truck sideways or backwards. (3) A truck whose mesh has no deck (`deck.guessed`) gets NO containers and no crates; the cargo % and damage still run.
- **Bigger.** Fitted to 2.6 m wide / 15 m long (the semi lands at 2.37 × 15 × 3.1, a little larger than the traffic trucks); collision half-length cap 7.6 m; containers 2.1 m tall and the deck width less 15 cm.
- **Traffic.** Could not reproduce a flicker in the Browser pane (the sim does not step in a hidden tab). Two real jitter sources fixed by reading the tick: a car whose lead was in its target lane could be snapped INTO the lead's position every frame (now only ever eased back, 6 m/s, behind a lead that is actually ahead), and a side-swiped car was shoved 0.8 m per FRAME with no road clamp (now per second, clamped to the road). If the owner still sees it, a short video would settle it.
- Suite: `_signals_smoke.mjs` (21) runs the pan vector and haulAutoOrient on four synthetic orientations for real. `_semi_smoke` pins moved with the rule. Six knobs → v121v111-signals.

## v121v112 — shipped 2026-09-11, full-gated, edge-verified (tooltips everywhere)

Owner (with the Mission Debrief screenshot): "Add tool tips on all of the buttons on the menus, as well as the tool tips on everything in camp, as well as the hovering over the resources."
- **One engine, not a hundred render sites.** `src/hubui/tips.js` (classic script, so it can read the game's top-level tables by name) resolves what to say for the thing under the pointer in order: `data-tip` on the element or an ancestor → a `title` (every one of the ~600 titles already in the game now shows as the styled bubble; the native title is parked in `data-tip-title` while ours shows and put back after, so nothing shows twice and code reading `.title` still works) → `TIP_BY`, a selector → text table for controls that never had a title (main-menu rows, hub breadcrumb, Luni market bar, cinder/aza sprites, every camp control the inventory found without one: tabs, build/upgrade, collect, rescue, MIA, Deploy, storage, bed rack, debrief, cost editor, ambience) → the resource icon under the pointer.
- **Resources.** The character under the pointer is read from the text itself (`caretPositionFromPoint` / `caretRangeFromPoint`, grapheme-safe through `Intl.Segmenter`; both graphemes touching a caret boundary are tried, since the caret sits on a boundary), so "🥫 12 · 🔫 4" names each icon as the mouse crosses it wherever it is printed — debrief lines, loot lines, chips, tables. The icon → name map is built lazily from `RESOURCES`, `SALVAGE_RES`, `CITY_STOCK`/`CITY_RESOURCES` when present, the haul's materials, plus `TIP_ICONS` for 🔥 Cinder, 🪙 Aza, 🌙 Luni, ⛽ Fuel, ⭐ XP, 💊 Medicine, 🧂 Salvage.
- **Menus.** Every hub tile (`.hub-portal`, ~50 tiles across main / battle / forge / exchange / codex / field / arcanum) carries `data-tip="name — sub"` from its PORTALS row; every fallback Master-Duel item carries "title — subtitle" from MD_SECTIONS; every phone app carries "name — sub" from APPS; the cinematic main menu (`main-menu/index.html`, its own document) loads the same engine and its eight nav rows are named in TIP_BY. The camp HUD resource chips (Gold … Defenses) carry `CHUD_TIPS`.
- **Touch and keyboard.** A long press (450 ms) shows the tip for what is under the finger, lifting hides it after 1.4 s; focus shows it; scroll, mousedown, Escape and leaving hide it; a repaint that removes the anchor hides it (MutationObserver). Fixed layer at z-index 2147483000 — above every in-app modal, under the toast.
- Suite: `_tips_smoke.mjs` (42) runs the shipped engine on a fake DOM: the resolution order, the no-borrowing rule for buttons, the table, and the icon-under-pointer on a real loot line. Knobs → v121v112-tips, then v121v113-tips: the edge check found 🔥 naming "Cat Gasoline" (a chain resource in RESOURCES borrows the flame), so the currency names in TIP_ICONS are now entered before the tables — Cinder wins. Verified at the edge by dispatching mousemove over a loot line (🥫 Food, 🔫 Ammo) and over a titled element (title parked, bubble shown, title restored).

## v121v114 — shipped 2026-09-11, full-gated, edge-verified (Grant Passive effect; Spell counters; the semi done right)

Owner (with two screenshots — the field-ability editor with a "Ualit Counters" cost, and a crumpled white truck facing backwards): "Make an effect type where when X happens they can grant a passive for X turns or permanently — e.g. when this unit is sent to the graveyard give all units, fusions, archons called this turn the passive Speed until the end of the turn. Also Spell counters is not working. The truck is facing the wrong way… increase the res of the truck; it should look like this [only] if it is wrecked."
- **🧬 Grant Passive (effect id `grantPassive`, Buffs & Debuffs).** Every effect section (on-play, grave ability, on-grave trigger, field ability, hand ability, Kalon on-x chain) gets the same box: the passive (from PASSIVES, grouped by category), who gets it (this unit / all your units / all enemy units / every unit / your units, fusions and archons called this turn / your fusions and archons called this turn) and turns (0 = permanent, 1 = until the end of this turn, N = for N of your turns). A grant is a `statusEffects` entry `{ type: 'grantPassive', passiveId, turns, eot }` that `hasPassive` reads exactly like a printed passive (still nothing while field-negated); permanent grants go onto `unit.passives`. "Called this turn" = not on the board when the turn began (`state._idsAtTurnStart`, stamped in `startTurn`), never the hero. Units called LATER in the turn get it too: the grant is remembered on `App._battleTurnGrants` for the rest of that side's turn, applied in `applyOnPlayEffect`, and consulted by both summoning-sickness checks so a granted Speed really lets the unit act. End-of-turn hooks (`endPlayerTurn` / `endAITurn`) drop the until-end-of-turn grants and the pending turn grants of that side. Gate tokens `grantPassive` / `counterName` so the knobs hide for every other effect; the forge id suites' self-describing counts moved (380/460, 140 literal reads, `ed-kalon-onx-gturns` in BLIND_SPOTS, harness truth 88) — the checks, not the baselines.
- **🔵 Spell counters.** Three real mismatches: (1) "Add Counters" placed the SOURCE card's own token (or `charge` when it had none), so a card that had not enabled a token could never put "Spell Counters" on anything a field ability could spend — Add / Remove Counters now take a Counter name (`counterName`) and place that pile; (2) the two editor save sites, the field-ability cost and the module slugged independently and nobody singularised, so "Spell Counters" ≠ "Spell Counter" — one `_ctrSlug` (lower-case, letters and digits, trailing plural s dropped, -ss kept) on every side, `MythicCounters.slug` in the module, and the cost re-slugs its NAME on every read so old cards meet in one pile; (3) `_fieldcounter_smoke` lifts the slug now. Not touched: a `from: self` cost still reads one unit's pile (a counter on a location needs `pool`), and turn-end grants still come from units only.
- **🚛 The truck.** What the screenshot showed was a lot row from before `rigId` existed: with no catalogue row, v111's `_haulModelOf` fell to the admin's box-truck render, `haulAutoOrient` put its (taller) box at the nose, and the 9k-tri pack read as a wreck. Now `_haulModelOf` falls to the CLASS model (any catalogue rig of the row's cargo class with a model — the semi for freight) before a row upload; the semi is repacked at 45k tris / 2048px WebP (2.3 MB, from 12k / 0.84 MB); and `FREIGHT_MODEL.wrecked` is a 1.1k-tri sloppy pack of the same master that a Wrecked or Salvage rig drives, paint dimmed to 55 % — crumpled on purpose, clean otherwise. Containers repacked at 14k tris / 1024px. `_semi_smoke` / `_signals_smoke` pins moved with the rules.
- Suite: `_grantpassive_smoke.mjs` (50) runs the grant helpers, the scopes, the pending turn grants, the end-of-turn expiry and the counter module for real. Six knobs → v121v114-grant (effects.js buster too).

## v121v115 — shipped 2026-09-11, full-gated, edge-verified (lobby numbers off the Play Online tile)

Owner (with the tile screenshot "3 online · 0 searching / 3 ONLINE"): "Do not show how many players are online and searching on the Play Online post, never, for players — move the online count and searching to the User Management tab."
- **The tile.** `btn-play-online` said "🟢 N online · 🔍 M searching" with a "N online" badge and a queue pulse — all three already admin-gated, which is why the owner (an admin) still saw them. Now the tile carries only "Find a real opponent · ranked" (or "Sign in to face real players"), `badge: null`, `alertBadge: false` — for everyone. The matchmaking screen's own live stats were already admin-only and are untouched.
- **User Management.** `_umLobbyLine()` paints "🌐 Lobby right now: 🟢 N online · 🔍 M searching for a match" under the account line (presence count from the lobby channel and the matchmaking queue, both kept fresh by `joinLobbyPresence()`), and `_umLobbyWatch()` subscribes once via `onLobbyPresence` to re-paint that one line in place on every tick.
- Suite: `_lobby_smoke.mjs` (11) pins the tile to no counts / no badge / no pulse and runs the line for real. Knobs → v121v115-lobby.

## v121v116 — shipped 2026-09-11, full-gated, edge-verified (the Athena Engine merge: build A + build B)

Owner: "Update and merge this Athena Update" with `ATHENA_MERGE_HANDOFF.md`. Two Athena builds existed — A (repository `main` at `12297093`, rounds 5–18) and B (this checkout: FILES/MENU tabs, world_assets uploads, ⚒ pill, menu worlds, sessions, the player character). Common ancestor `eddeb0d093`. Build B was pushed as-is to `origin/athena/files-menu`; the merge was done on `athena/merge` from this tree, taking every module of A that B never touched, three-way merging the ten both changed (`mapforge.editor/world/engine/format/props/css/index`, the docs), renaming B's `mapforge.assets.js` (uploads API) to `mapforge.files.js` because A's asset-browser index owns that name, porting A's index.html hunks (MythicBridge slots/files/battle/ui, Forge.cityModels catalogue + hydrate, `__mythicCityModels`, the battle-board overlay + bmIndex, the admin buttons, the widgets/battle script tags) and A's node-city model-slot hook, and inlining A's farm adapter/overlay into B's farm bundle (`FarmAthena`) because the bundle may import nothing. Dropped, not silently: `MythicBridge.battle.openLegacyEditor` — this build retired the legacy Battlemap Forge (`_noboard3d`). `docs/athena-engine.md` → "Merge round" carries the full account; `CLAUDE.md` gained the Athena block.
- **Database.** `world_maps` (B's 091/092), `world_assets` (112), `ui_widgets` (040), the farm auction/ranch tables (038) were already live; A's 041 (`ui_widgets.kind` allows `page`) applied through the MCP as `athena_041_ui_pages_kind`.
- **Tests.** All nineteen harness suites plus the fallback green on this machine (`tools/athena-harness/serve.mjs` in place of the python server — the volume takes no symlinks; `PLAYWRIGHT_PKG` points at the repo's playwright; `beep.wav` generated for the audio suite; suite path handling fixed for Windows). New `pw-test19.mjs` covers the FILES panel, the MENU tab and the merged Scene tab. The game's own gates: fast + full green (`_athena_smoke` re-pointed at `mapforge.files.js`; farm buster pins relaxed to the v121v1xx series; forge-id counts moved with the layout).
- Busters: mapforge `mf18`, widgets `aw5`, battle `ba2`, farm `v121v116farm4`; six knobs → v121v116-athena.

## v121v117 — shipped 2026-09-11, full-gated, edge-verified (the ring includes linked nodes; the Foundry; the Node Inventory)

Owner approved two triaged reports and asked for one feature, with `FOUNDRY_HANDOFF.md`:

| Report | Verdict |
|---|---|
| `bug-mtwtxvg8` (Sausage, high) PRN nodes not spawning in city | FIXED. The 2026-09-10 rule rang a city only with nodes whose `owner_id` is the viewer; a corporation member whose licences the founder holds owns none by that column (Sausage: 0 owned, 12 `city_node_links` rows). A city_node_links row is the player's deliberate "this node is synced to my city", so the parent now hands those rows over (`window.cityLinkedNodes`: links → `economy_nodes`) and node-city rings the owner's licensed nodes PLUS the linked ones, deduped. A node obtained through the Foundation Reserve is placeable again. |
| `bug-mtwsvrtq` (Grimalkin Lord, high) "Post a Scrap Run" opens the Haulage Board, not a Trash Crusher mini-game | FIXED with the owner's file: the Trash Crusher's mini-game is **the Foundry** — the recycling plant from branch `claude/epic-heisenberg-64ym25` (15 machines, 34 materials, 22 recipes, 9 modules under `src/foundry/`, `_foundrysim.mjs` 34/34). Ported whole: the bridge (`MythicFoundryBridge`, placed before the mercenary bridge so that suite's segment stays clean), `__foundry__` / `foundry` on the cloud whitelists, the newest-save reconcile, `openFoundry()` + offline catch-up, the camp building (moved to x8-11 / y8-10, door 10,11 — the branch's x8-11 / y10-12 sat on Vex the Scout). The corp sidebar row is now two doors: 🗜️ Trash Crusher → the Foundry, 🚛 Post a Scrap Run → the Haulage Board (`openfour` pins moved with the rule). |

- **📦 Node Inventory.** Every node owner's node modal has a NODE INVENTORY section after Node Power: the node's resource fills on the wall clock at 10/h × a multiplier that climbs from ×1 to ×1.5 as the node's tier (meta.level, the level the city syncs up), its Node Power level (1–10) and its city's level (city_state.cityXp through the city builder's own curve, 1–25) climb — each a third. The shelf holds 48 h. Collect calls `node_inventory_claim` (sql/132, applied) which checks the owner, returns the hours since `meta.invAt` and stamps now (two devices cannot bank the same hours); the client turns hours into units and banks them through `addRes()`. Assumption stated to the owner: one combined bonus up to ×1.5, not ×1.5 per factor.
- Suite: `_nodeinv_smoke.mjs` (34) runs the multiplier and yield maths; `_foundrysim.mjs` registered (plain-text PASS lines). `_ownerlist` pin moved with the ring rule. Knobs → v121v117-foundry (`src/foundry/index.js?v=v121v117foundry5`).

## v121v118 — shipped 2026-09-11, full-gated, edge-verified (the reopened trio: Clinic, Rations, Planks — and planks as a build cost)

Owner: "The following defects failed retest… These are not fixed. Add the plank resource to certain buildings and they should be used to build buildings in the Feed business and some buildings in the city builder as well as the Camp."

| Report | Verdict |
|---|---|
| `bug-mtuadu79` (Grimalkin Lord, high, reopened ×2) the Clinic consumes more remedies than it creates | FIXED at the root this time. The output was scaled by city conditions and the dispensing draw was not, so below ~67 % conditions the shelf drained (the design note said "coverage must not amplify a slump" — the owner overruled it). `svcWantFor(def, s, mult, omRes, dtMin)`: a building that makes the very good it dispenses draws AT MOST what it prepared this tick, at the same conditions multiplier. Kitchens (which only dispense) are unchanged. The "cannery" wording was already gone since v121v108. |
| `bug-mtw1qg89` / `bug-mtw1jo7k` (Grimalkin Lord, med, reopened) Rations / Planks show ZERO in the Ops Vault, the Market and the Reserve with 4,000 "in the stash" | FIXED for real: the 4,000 were CITY stock (the city builder's shelf), and those screens read the player's stash; the v121v105 Send button moved them by hand and nobody found it. `autoStashTick` in node-city's economy tick now moves the SURPLUS of every stashable good (rations, planks, remedies) into the stash every five minutes by itself, keeping two hours of the city's own draw plus a 20-unit floor on the shelf (kitchens and the Clinic never run dry because of it); a full stash declines and the move is retried by halves; the player is told what moved. The phone leaderboard counts city stock, so a city that ships its planks ranks lower there — by design. |

- **🪚 Planks as a build cost.** City builder: thirteen buildings (Housing 4 → High-Rise 200; Barracks, Watchtower, City Gate, Player Shop, Office Block, Retail Parade, Club, Duel Arena). Homestead Farm (the feed business): the Feed Mill, the four pens and the Farm Kitchen from level 2 (40 / 100 at the Mill). Camp: the Resistance Ring, Training Center, Proving Ground, Black Market and Morale Lounge from level 2. All three pay from the ledger through the existing cost paths, which is exactly where the auto-stash now puts the planks the Sawmill mills.
- Suite: `_stockflow_smoke.mjs` (24) runs svcWantFor, the reserve maths and the whole auto-stash (including the halving retry) for real; `_farmfeed` pin moved with the costs; the auto-stash call sits just above the demand snapshot (`_batch1` pin). Knobs → v121v118-planks (`src/farm/index.js?v=v121v118farm5`).

## v121v119 — shipped 2026-09-11, full-gated, edge-verified (Athena renames; market-style candles)

Owner (with a model card labelled "[object Promise]", the rename modal showing the same, and a real broker chart beside ours): "Renaming 3D models in Athena Engine is not working. I want our stock candles to look like the actual stock market candles — ours are huge and big."
- **Renames.** The game replaces `window.prompt` with its themed "Enter a value" modal (`gcPrompt` → a Promise); build A's editor called `window.prompt(...)` synchronously and stored the Promise as the name. `askText(msg, def)` awaits whichever prompt is installed and is used at every name prompt: library / model / sound / prefab / cloud-file rename, F2 on an object, prefab rename, relink-a-model, the content browser's URL door, the custom mini-game id; the widget designer's new-variable prompt likewise. Harness suites 5, 6, 12, 17, 19 rerun green (the harness has a plain synchronous prompt, which askText passes through).
- **Candles.** `CX_CANDLES_PER_RANGE` is 60 / 72 / 96 / 84 / 120 / 120 buckets (1 min, 5 min, 15 min, 2 h, 6 h, and ALL) instead of 12–40; a bucket with no tick is carried forward as a doji at the last close (marked `quiet`) so the chart stays continuous; every candle gets one slot (the slot count floors at 24) and a body at most 9 units wide, right-aligned against a five-rung price axis on the right, with time labels along the bottom and the last price tagged on the axis with a dashed line. The hover tooltip (v121v109) is unchanged.
- Suite: `_prompts_smoke.mjs` (24) runs askText, the bucketing and the SVG for real; `_candles_smoke` count pin moved. Busters: mapforge `mf19`, widgets `aw6`; knobs → v121v119-candles2.

## v121v120 — shipped 2026-09-11, full-gated, edge-verified (the haul rig faces forward at full resolution; blinkers; traffic)

Owner (with a phone screenshot of a crumpled white truck showing its grille to the chase camera): "This is still not fixed where the truck still backwards and the things I asked to be fixed are not done on the haul. Like fix the resolution of the truck."
- **What the truck was.** Not the semi. The owner's rig is a Bulk Feeder: index.html stamps every bought rig `cargoClass: base.cargoClass === 'oil' ? 'oil' : 'freight'`, so a feed rig lands on the freight haul board and `_haulModelOf` hands the run its catalogue model, `feed_truck.glb` (the HidnEx box truck). Its box stands taller than its cab, and v111's `haulAutoOrient` ("the tall end is the cab") put the box at the nose — tail-first since v111. The semi itself was always right (verified in a headless render of the real module). The stamping is left as is (a separate decision: fixing it would move feed rigs off the freight board).
- **Orientation.** `HAUL_KNOWN_ROT` records the nose of every truck file the game ships (all long along X with the cab at −X → 90°, checked by eye in `tools/athena-harness/pw-truckview.mjs`). An upload is measured by its roofline instead of its tallest end: a step a short way in (back of the cab against a deck, or the cab/box gap) plus a ramp at the tip (bonnet below the roof, read as a median so a tow hitch cannot pass for one), sampled along triangle edges (vertex-only sampling read decimated roofs as dips). `pw-orient.mjs` runs it on the four real trucks each lying four ways round: 16/16 with no filename help.
- **Resolution.** The run's material is now MeshStandard with the scan's normal map (Lambert discarded it — the smudged look) and the renderer's anisotropy on both textures; metalness 0. `feed_truck.glb` and `livestock_truck.glb` repacked from `assets-source/glb-masters/trucks/` at 45k tris / 2048px (were 14k–26k / 1024px). A Wrecked or Salvage rig drives the same file with paint dimmed; `FREIGHT_MODEL.wrecked` is gone (the 1.1k-tri pack rendered as a handful of triangles; the bridge never passed `condition`, so it had not been reachable in the game anyway).
- **Blinkers.** The rig's four blinkers move onto the fitted model's corners (they sat at the old box rig's corners, inside a 15 m truck). Driven in the harness: steer left lights the screen-left pair, right the screen-right pair, on the semi, the feed truck and a wrecked livestock truck.
- **Traffic.** Boxes and paints are shared and despawned cars are pooled (every car used to allocate its own geometry and material and was dropped with its GPU buffers held). Cars enter at 85 % of the fog distance (they popped in 140 m ahead in clear weather), the window scales with the sight line, the first tick seeds the visible road, and below 20 m/s half the new cars come up from behind the camera faster than the rig (a slow rig used to watch the road empty). The shared paint block sits above the hazard setup (a breakdown hazard builds a car before makeCar's section). 90 s and 30 s drives held 10–13 cars with 6–11 within 300 m ahead.
- The haul module buster had sat at `v121v111haul4` since v111; it is `v121v120haul5` now. Harness: `haul.html` + `pw-haul.mjs [cond] [secs] [modelUrl]` (set MSYS_NO_PATHCONV=1 in Git Bash), `window.__HAUL_DEBUG` read-only handle in the run (off unless a page sets it), serve.mjs maps `/models/trucks/`.
- Suite: `_haulrig_smoke.mjs` (30) runs the orient step on a flatbed, a box truck with a hitch and a bonnet-cab tanker, four ways round each, plus the roofline score. `_semi_smoke` / `_signals_smoke` pins moved with the rule. Knobs → v121v120-haulrig.

## v121v121 - shipped 2026-09-11, full-gated, edge-verified (the exchange trades like a desk; player corporations; the Crash Herald)

Owner: "Remove this and I do not think we need this. We are just buying shares of the resources and companies. Make the crash exchange run like a real stock market, tracking data on the sells and buys all across the game and the world events that can affect the market. In OPERATIONS put all of the players corperations and allow players to buy shares... give their weekly treseary reports and judge by if they have add more resources, cinder and aza coin... Like a fake news site that keeps track of everything on the crash market and the player economy. A fix that need to be fixed is when buying stock the price of stock is charging more than what it is being bought for."
- **The overcharge, and its cause.** A buy was priced from the mark AFTER its own impact, multiplied by slippage against a reserve pool, then by a 4% spread, while the TOTAL box beside it quoted the tile price plus the 0.4% fee - about +17% on ten units, and a typed price could not lower it (Math.max against the post-impact mark). The Foundation Reserve model is gone from the trade path and the screen. A fill is now the geometric mean of the price before and after the order (the average price it walks through), quoted by the same function that charges it and requoted as the size changes. Measured: ten units of a 100 CR staple cost 117.41 then, 106.15 now; an instant round trip returns the fees and leaves the price where it started, which is what the spread was there to guarantee.
- **The tape.** Every price writer in the game (shop, craft, node yield, haul delivery, production, world event, desk order) records id, direction, size, price and SOURCE to one capped record. The asset panel shows 24h flow - bought, sold, net, and which parts of the game did it - where the reserve depth bar used to be.
- **OPERATIONS = player corporations.** sql/133_corp_market.sql: corp_market_list() is SECURITY DEFINER and publishes AGGREGATES ONLY (balance, balance a week ago, week inflow/outflow, vault units and kinds, members, live ops, float) because corp_treasury and corp_vault are members-only under sql/046 - a rival reads the published figures, never the books. corp_shares holds the float server-side with own-row RLS; corp_share_trade() owns the share leg and refuses a sale of shares nobody holds; the cinder leg stays the client wallet, as it is for every other CX trade. A share is priced off the book: cinder + units x 12 + members x 1500 + ops x 2500, over 10,000 shares, times a float premium capped at +75%. The weekly report prints the treasury, the change, inflow and outflow, and rates it STRONG BUY / BUY / HOLD / SELL / STRONG SELL with the reason beside the word.
- **THE CRASH HERALD** (third tab): stories written from the tape (movers, with the desks that moved them), the corporation register (who banked and who burned), the world-event log and the day in numbers. It says on the page that nothing in it is invented.
- Suite: `_cxdesk_smoke.mjs` (30) runs the fill maths, the round trip and the corporation pricing for real - against the live register's own numbers (Clarey Nexus 19.6M -> 1,997.35 a share, HOLD on a 4% dip). `_phonecx_smoke` pin moved to the new quote. Knobs -> v121v121-desk.

## v121v122 - shipped 2026-09-11, full-gated, edge-verified (the Player Closet; cards not released yet; dated sets)

Owner: "Add a cannot be not released yet button in here which will stop players from gaining access to cards that have not been released yet. Allow for me to create packs in the pack opening forge. Where I can make not releaed sets that will release on the date that is set and added to the Vendor market." Plus the two handoffs (BRUCE_IN_ATHENA, PLAYER_CLOSET).
- **The gate.** A fourth pill on the card row. While it is on - or the card belongs to a set whose date is ahead - no player obtains the card by ANY route: grantCard (the file's own "one door a card enters a collection through") refuses it, playerObtainablePool drops it, and getCardPoolForPacks, the shared pack / body-loot / dilemma pool that consulted NOTHING about obtainability, now consults it. Copies already owned are untouched on purpose: pulling a card out of a deck somebody built is worse than the leak it closes.
- **Sets.** A Forge tab: name, icon, the cards, the pack that carries them, and a release instant picked in local time. Before it, its cards cannot be obtained and its pack is off the vendor shelf; at it, both go live on every device with nothing to run - the check is a comparison against the clock, like the coupon expiry already shipped. (tier_drops, the pg_cron path, is not versioned in this repo at all: the client writes a table whose DDL is only in the live database.) "Release now" is there when the date is not wanted.
- **Player Closet** cherry-picked from claude/character-creator-clothing-y2lat6 - three commits, not the sixty under them. 11 modules, the outfit worn wherever Athena draws the player, a fit stored as RATIOS of a measured body part so one record fits every character. sql/134 applied (renumbered - 132 here is Node Inventory). Profile.closet is in all three whitelists.
- Two suite pins moved to follow code the closet extended, not to hide a break: a peer is rebuilt on a change of character OR outfit; the avatar is dressed on the way into createAvatar. **Every file the merge touched was re-normalised to LF** - git checked them out CRLF and my patch then converted the whole page, which broke ten suites that match across line breaks. Nothing was wrong with the code.
- Suite: `_release_smoke.mjs` (40), the release maths run for real. Knobs -> v121v122-closet.

## v121v123 - shipped 2026-09-11, full-gated, edge-verified (the Custom Audio Manager)

Owner: "I just changed the music to the main menu it have not changed and I want a save and update button... Also show me all of the old music and files incase I want to delete them. Also add a shuffle feature... Add a Just business, City builder, audio. Change the name from pricing Admin to Admin Controls."
- **Why it did nothing, and it was not a cache.** `playMenuMusic` tested the playlist with `length > 1`, so a zone holding EXACTLY ONE uploaded track fell through to the else branch and hard-set the built-in Settings theme: upload one track, tick "only mine", and the upload could never play. Without "only mine" the pool was two, shuffled, and started on the built-in about half the time. Menu and Camp now bind whenever the pool holds anything (Camp had the same `> 1` gate but its else used the pool, so it worked - mainMenu was the only zone with the defect).
- **It takes hold now.** A changed playlist starts playing instead of waiting for the current track to end, and 💾 Save & apply writes everything, clears the one-element "what is loaded" caches (`_menuAudioSrc`, every element's `_msSig`) and re-asks the router.
- **📁 Stored Audio.** Every clip on the device with its size, including ORPHANS - deleting a track blanked its record (`idbSet(key, "")`, never a delete) and left the bytes behind, and `forge_customMusic_idx` was written but never read back, so the space was unreclaimable and invisible. Each row plays and deletes, and deleting a track removes it from its zone too.
- **Shuffle is a switch** per zone, not a side effect of owning two tracks; the header says "shuffles" or "in order", and flipping it re-picks immediately.
- **Two silent rooms.** Just Business (a real screen) and the City Builder (an overlay that never changes App.screen, so _openNodeCity / _closeNodeCity call the router by hand). Neither child document owns any audio, so the element stays in the parent - no cross-frame plumbing. Both ship with no built-in track and stay silent until something is uploaded.
- **Admin Controls**: the tile, the heading, both back buttons and the admin-gate toast. The screen id `pricingAdmin` and the tile id `btn-pricing-admin` are untouched - 13 places route on the id, mapforge.pill.js hides itself on it, and the tile id keys the uploaded tile art.
- Suite: `_audiozones_smoke.mjs` (26), the ordering run for real. Knobs -> v121v123-audio.

## v121v127 — the Just Business collect exploit, and the blade that glows
Deployed 2026-09-12, edge-verified (v121v127, `_opClaimCollect` present, glow rule present).
Full gate: 127 suites, all at or below baseline.

**bug-mtxzznni (high, live) — "Just collecting wages from just business and it would
not stop coming up… I amassed a ton of food, metal and other resources."**
A collect pays a pure function of `now − meta.lastCollect`, capped at 36 h. Nothing is
spent and no counter decrements, so that one timestamp is the ONLY thing that ends the
accrual. Three failures compounded:
1. The client admits founder / owner / CEO / Corp CEO as an officer; the
   `corp_operations` UPDATE policy admitted the FOUNDER only — and PostgREST answers a
   row filtered out by a `USING` clause with **204 and no error**, so the throw never
   fired, `o.meta` was set in memory only, and the very next `opFetch()` re-read the
   stale row and offered the full 36 hours again. Forever.
2. The payout came FIRST and the marker was written after, so a refused write cost the
   game everything and recorded nothing.
3. No in-flight lock on a settle that is five to seven round trips long with the button
   still enabled, so click-spam paid the same accrual several times even for a founder.

Fixed: the policy now matches the client's roles (applied live); the collection is
CLAIMED before a single resource moves and the row is demanded back (`.select('id')`) so
a refusal is loud; a per-operation lock covers the in-flight window; and the Just
Business `postMessage` handler takes messages from its own origin only (it checked the
message *type* and nothing else). No player data was altered — that is the owner's call.

**The Abra Blade glows.** The pointer was reverting to the system hand over anything
clickable. There are 863 `cursor:pointer` declarations in index.html, many of them inline
styles that beat any stylesheet rule, so the fix is `!important` plus a
`[style*="cursor:pointer"]` selector, pointing at a purple-aura variant of the blade.
Verified in-browser: plain → blade, button → glow, inline-pointer → glow, text box → I-beam.

## v121v128 — three new card effects, the assault-prompt cost bug, spell counters (fourth report), victory & defeat music, six tracker reports

### The three card effects the owner asked for

**🔇 Suppression Aura** — "While this unit is on the field enemy players cannot
use spells, or activate units passive, or on play abilities." It is CONTINUOUS,
so it is never resolved: the engine asks the board. `_battleIsLocked(state,
side, cat)` is already the single choke point every spell / deploy / counter
path on both sides reads, so teaching it a second source of truth locks spells
everywhere at once with no new call sites. The two categories it did not have —
activating a unit's ability, and an on-play firing — were added at the three
functions that own them (`_canUseFieldAbility`, the AI's field-ability loop, and
`applyOnPlayEffect`). It is a LIVE BOARD READ, deliberately, not a status
stamped on the enemy's cards: the aura has to end the instant the unit leaves
the field, and a stamped status outlives its source. Memoised on the units array
by identity, so asking it on every effect resolution costs nothing.

**⚰️ Banish Unless Called From Hand** — needed a fact no unit had ever recorded:
where it came from. The two paths that ARE a hand play stamp `_fromHand`; the
other seven `buildUnit` callers (summon, raise, token, tunnel emergence, mutate)
leave it unset, which is precisely the card's condition. Swept at the end of its
owner's turn, after the turnEnd triggers so a card can answer before it goes.

**💥 Punish Arrivals** — hangs off the arrival event the engine already fires
from both hand-deploy paths, plus `_fireAnywhereForSummons`, the choke point
every effect-spawned unit passes — rather than a ninth hand-rolled hook. The
weakness bonus reads the same `MATCHUPS` / `getFactionMatchup` tables the damage
formula does, so "weak to" means on the card what it means in combat.

### The assault-prompt cost bug (owner)
"You pay the cost — for example you pay 50 health — then the modal appears to
play an assault card from your hand, you click skip and the spell does not play
even though you paid the cost."

`_interceptCardCost` pays the cost, sets `App._cardCostPaid`, re-enters
`playSpell`, and clears the receipt in a `finally`. But that re-entry does not
RESOLVE the spell when an assault card is in hand — it parks the play on
`App.ui.assaultPrompt` and returns immediately, waiting for a click. The
`finally` then wiped the receipt, so Skip re-entered with no receipt and
`_interceptCardCost` charged the cost a SECOND time; a hero that had just paid 50
life could not pay 50 more, the gate refused, and the spell never fired with the
life already gone. The receipt now survives a SUSPENDED play and is torn up by
whichever hand finishes it.

### Spell counters — the FOURTH report, and the bug standing behind the third
The owner's card, read out of the live catalog, settles what is authored:
`Ualti Spirit — counterToken {id:'ualticounter', name:'Ualti Counters', max:4},
onPlay {type:'addCounters', amount:2, counterName:'', radius:1,
counterSide:null, tSide:'enemy'}`. So v121v125 IS working: `counterSide` null
reads as 'self' and the token resolves off the card. The counters still never
arrived because the line that picks the recipient tested OBJECT IDENTITY:

    if (_side === 'self' && u !== unit) return;

`state.units` is rebuilt by half a dozen steps between a card being played and
its on-play resolving — the multiplayer on-play stamp remaps the whole array,
so does the infection zone, so can the weather summoner and the in-grave tick.
Each hands the board a COPY of the caster while `unit` still points at the
original, after which "itself" matched nothing and the log said "finds nothing
to put Ualti Counters on". Nothing else in this file tests a unit by object;
the engine compares ids, for exactly this reason. Also fixed alongside it: a
caster that is not on the board at all (a hand / grave / field ability resolves
through a hero-anchored synthetic) now gets its own counters, "self" no longer
demands a position, and the range test for OTHERS is the hex `distance()` rather
than Chebyshev, which on an odd row reaches non-neighbours and misses neighbours.

### Victory and defeat music (owner)
Victory had a loop and an Audio Manager slot. DEFEAT had neither — losing
dropped straight into silence, because `isVictoryActive()` is false the moment
the loser is you and the battle track is stopped by the same sync pass that
would have started the victory one. `assets/Audio/defeat music.mp3` has been in
the build all along, referenced by nothing. Defeat is now victory's exact mirror
— its own element, its own playlist slot in the Audio Manager, its own
`isDefeatActive()` — with one deliberate asymmetry: `stopVictoryMusic()` stops
BOTH, because it is called from fourteen places and every one of them means the
player has left the end-of-match moment.

### Six tracker reports
- **bug-mtxqh027** — Reconstruction's back button was the last one in the camp
  still naming a screen instead of asking `_campBackTarget()`. 'camp' is the
  BUNKER; 'campOps' is the camp page.
- **bug-mtxmvepn** — every deploy calls `render()`, which rebuilds the camp from
  a template string, so the two `.dpx-scroll` panes come back as new elements at
  zero. Remembered per pane AND per tab.
- **bug-mtxmdmq1** — `roadCapParts()` counted a Supply Depot as one building
  however tall it was. Housing is `popCap * t.lvl`, the barracks garrison is
  `garrison * t.lvl`, production is `RATE_MULT ** (t.lvl - 1)` — this line was
  the odd one out, so three upgrades bought no road.
- **bug-mtxkunre** — a new city starts with `stock: {}` and cannot make a plank
  until it has power, a Logging Camp and a Sawmill, each needing crew that needs
  housing. The BASIC house pays no planks; the sink stays on the Apartment (16),
  Block (40), Tower (90) and High-Rise (200).
- **bug-mtxl7z60** (high) — `planCost` summed `c.cinder` and threw the rest of
  `costOf` away, so the Develop button priced a district in 🔥 alone while the
  plan also needed metal, supplies and planks. Approving it stalled development
  one silent permit at a time, because each site pays as it STARTS. The panel
  now prints the full materials bill in the city's own cost chips.
- **bug-mtxq7yoy** — the "vault full" throttle is real, but the row asserted
  something the player cannot check: the ceiling counts the WHOLE Base Vault
  (every id in Profile.salvage) while the city's strip shows the twelve-id
  mirror. Both numbers were already read and discarded; the row names them now.
- **bug-mtxlmhvr** — "ometimes" in the Tutor Shop guide. Authored content, fixed
  in the catalog rather than in code.

## v121v129 — card art for cards that are played; spell counters land in the pile the card spends from

### 🎴 Card art in the battle log (owner, with a screenshot of a log that is all text)
v121v126 built the row that can draw it — `_bcLogRow` resolves the art at RENDER
time from `l.cardId`, falls back to the card frame, and suppresses it entirely
for a face-down card. What it never got was the ID: the five places that
announce a card being PLAYED all pushed a bare `{ msg, color }`, the oldest
shape in the file and the one thing the renderer cannot draw. So a whole match
of deploys scrolled past as sentences while the activations that followed them
showed their art. All five now carry the id the caller was already holding — a
unit you play, a unit the AI plays, the one it drops as an interception, an
opponent's unit arriving over the socket (`originalCardId`, not the battle
instance), and a spell the enemy casts. Each keeps its `msg` and `color`
exactly, so the filter chips, the relay and the replay snapshots are untouched.
🃏 A Subterfuge SET carries the id with `hidden: true` — the same redaction the
on-screen flourish uses, so a face-down play does not leak its art.

### 🔵 Spell counters — the FOURTH report, and a THIRD distinct cause
"I just summoned this archon who gets spell counters, it has the on play gain
spellcounters but still it has no spell counters when entered play" — the
ability row reading "Needs 2 🔵 Krystal Flutters · it holds 0".

Krystal Anomaly Opal Butterfly, read out of the live catalog:

    counterToken : null                                  ← the token block is OFF
    onPlay       : { type:'addCounters', amount:2, counterName:'' }
    fieldActive  : { counters: { n:2, id:'krystalflutter',
                                 name:'Krystal Flutter' } }

The card names its counter in exactly ONE place — the cost of the ability that
spends it — and the two halves of the engine resolved that name completely
differently. SPENDING (`_fieldAbilityCounterCost`) re-slugs `fc.name` and reads
the pile `krystalflutter`. PLACING tried `eff.counterName` (blank), the card's
own `counterToken` (absent), the effect's token (absent), and fell through to
`DEFAULT_TOKEN`, filling a pile called `charge`. Two piles, one card: the
counters really were placed, and logged, into somewhere nothing on that card
can see.

This is not an authoring mistake. The effect's counter-name box is blank by
default, the card's token block is optional and off by default, and the
ability's cost carries its own id and name — so authoring the card the obvious
way produces this every time, which is why the same symptom has now been
reported four times across three cards with three different causes underneath
(v125: the recipient side read the damage dropdown; v128: the recipient was
matched by object identity across a rebuilt units array; v129: this).

Fixed by adding one step to the token chain: when the effect names no counter
and the card carries no token of its own, use the counter the CARD'S OWN
ABILITIES SPEND — `_cardCounterDecl` reads `fieldActive` / `graveActive` /
`handActive` / `triggers[]` counter costs off the card definition and slugs the
NAME first, exactly as the spend side does, so the pile filled is byte-for-byte
the pile that ability reads. Precedence where the author was explicit is
unchanged: a name typed on the effect still wins over everything, and a card
with its own token block still uses it. The ability cost is a fallback, never an
override, and a card declaring no counter anywhere still falls to the default.

## v121v130 — the resource duplication exploit

Found by investigating an account the owner flagged for farming.

**THE BUG**, in one line of the profile hydration:

    for (const k in _cl) { const cv = _cl[k]|0, lv = _loc[k]|0; if (cv > lv) _loc[k] = cv; }

`Profile.salvage` was merged from the cloud row by taking the LARGER of the two
numbers per resource id, on every hydration. A spend can only ever make the
local number SMALLER — `spendResources()` decrements the client mirror alone,
and the server ledger (`user_resources`) is only ever topped UP by
`wh_resync_resources`. So any hydration whose snapshot predated a spend put the
resources straight back, and hydration happens on reload, on resume, on a second
device and on the periodic fetch. Resources could go up and could never come
down. `_whSeedLedger`'s own comment asserts the opposite — "a send deducts both,
so the client can only ever run AHEAD by what the city produced" — and it is
simply not true of any client-side spend.

**THE EVIDENCE.** The flagged profile blob held 57,046 fuel · 56,822 food ·
14,956 weaponParts · 7,350 metal against a stash ceiling of 2,000 + 250 per
bought vault row that `addRes()` clamps every gain at, while `user_resources`
for the same account held 227 fuel · 1,840 food · 0 weaponParts · 257 metal.
1,515 "Delivery paid" credits landed on 11–12 Sep — 1,092 inside a single hour,
90–500 ms apart — each supposedly SPENDING resources, and not one row of
`user_resources` moved after 10 Sep.

**THE FIX.** Salvage now obeys the same freshness rule every other field on that
row already obeys: the newer side is taken WHOLE, including ids where it is
smaller — precisely the spend the ratchet was swallowing. The max-merge survives
only for a cloud row with nothing local behind it, where taking the larger
cannot lose anything.

**THE CASH-OUT.** `_aiDeliver` had no lock and no interval: a 3-run contract was
drainable at 90 ms per press, and each run also raised rep, which raises the
pay. It gets an in-flight lock and a 2.5 s minimum interval, both before the
payout.

**THE BLADE** is 26px (was 40) with the hotspot re-measured on the smaller
render, and `html, body` joined the cursor selector — `*` matches ELEMENTS, so
over a full-bleed background with no child under the pointer it fell through to
the system arrow, which is why it was missing on the main menu.

## v121v131 — the AI trade cap, standing that buys bigger business, and the editor

**THE FAUCET.** The AI-corporation TRADE tab was the loop: `_aiEnterBusiness`
had no cooldown and no cost, each `_aiDeliver` spent the quantity CLIENT-side
and credited the pay SERVER-side while raising rep by 5 (which feeds
`_aiPayMul`, so a spammed contract inflated its own price), and completing the
third run DELETED the contract so the next signature was free. With ~12 corps it
ran in parallel against all of them. Measured on one account: 12,523 deliveries
at a 0.21 s median gap, 97.9% under one second, across 13-hour sittings.
v121v130 throttled `_aiDeliver` alone — 1,440 runs an hour, signature wide open.
Now: **two pieces of business per corporation per rolling 24 hours**, a spot
sale and a delivery both counting, asked at all THREE doors.

**STANDING BUYS THE SIZE OF THE BUSINESS.** It moved the price ±15% and nothing
else — every player got the same 3-run contract whether a corp loved them or
would not spit on them. The tier now sets whether they deal at all (hostile and
blacklisted do not), the contract's runs, the quantity per run, and the daily
slots. Allied: 5 slots, 6-run contracts, 1.6× quantity.

**EVERY VAULT HOLDS WHAT IT SHOULD.** `_stashEnforceCap()` is correct and
complete — and had exactly ONE caller, `renderStash()`. So the ceiling was only
enforced when a player opened that panel, throttled to once per 30 s, and a
vault that went over any other way (the v130 ratchet, `_refundRes`, an admin
grant, an old save) stayed over on every other screen. One account showed
141,598 units against a 31,250 absolute maximum. Enforcement now runs when the
cloud copy lands and again the moment the ceiling becomes vouchable (it refuses
to trim against an unread one, which is why a cold load needs the retry).

**THE WAGE DRAIN** is 12 h instead of 6; `OP_ACCRUAL_CAP_H` stays 36, so
collecting half as often loses nothing and halves how fast a treasury drains.

**PRN NODES IN A CITY THAT OWNS NONE** (MirageSoldier). `city_node_links` has
one writer, sql/105's `city_push_node_boost`, and it records *my city BOOSTS
that node* — a contribution with a pct. The 2026-09-11 change read it as *that
node belongs in my city*. Live: 64 rows across nine-plus players pointed at
nodes they do not own, and NOT ONE was backed by a claim. A city now rings a
node it owns or is the owner's ACTIVE MAYOR of.

**THE EDITOR.** A field ability could charge only energy and counters, so
"sacrifice 3 units, deal 100 damage to everything they control" was unauthorable
— `activationCost` (discard / payLifeHero / banish / tribute / tributeSelf) had
gated moves and on-play effects since it was written and was never wired to the
third activation. The effect filter never typed: it was bound for Escape and ✕
only, with typing left to a delegated listener that cannot reach a picker
outside its host. Passives got their own search (they could never qualify — the
picker test counts ONPLAY_TYPES ids and a passive list has none). Effect VFX can
carry a SOUND, fired independently of the picture through `playSfx` so the admin
override and volume still apply.

**THE RUIN EXCHANGE** plays the main menu music on every page but Just Business,
which keeps its own zone. The hub view already did; walking into a tile changed
it — Black Market Basement on five, Camp music on `vendorMarket` (which sits in
both sets) — so one building had three tracks. ⚠ The 💰 Black Market music slot
is now unrouted.
