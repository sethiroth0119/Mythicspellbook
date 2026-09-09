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
