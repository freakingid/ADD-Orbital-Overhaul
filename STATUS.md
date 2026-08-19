# Orbital Overhaul — STATUS
Version: 1.0.0.36 · Changeset: CS037 · Phase: P2.1 · Registry: 110 · Levers: 18

## Phase ledger — CS037

- P1 — per-source damage attribution, instrumentation only (spec §5.5, C4-rev). `damageShip()` gains
  a `srcTag` parameter; ten flat `game.stats.dmgFrom*` accumulators (Garbage Satellite x3 sizes,
  Hunter Satellite x3 sizes, UFO body x2 sizes, UFO shot x2 sizes), accumulated on the non-lethal
  branch only, mirroring `dmgThisWave`'s own placement. The merged hazard loop (`[...game.debris,
  ...game.hunters]`) discriminates via the existing `h instanceof HunterSatellite` test plus `h.size`
  — no new field on either class. Hostile `Bullet` gains a `small` field, set only at its one spawn
  site inside `Saucer.update()`; the player's spawn site is untouched (the constructor param defaults
  `false`). No gameplay behaviour change: knockback, i-frames, scoop decay, `dmgThisWave`,
  `hitsSurvived`, `everBelowHalf` and the CS023 P3 mutual-kill arms are all byte-identical in effect.

- P2 — the in-game benchmark instrument (spec §3), driven from two new debug-panel action rows. A
  thirteen-run battery over twelve isolated populations (Debris singles / clumps, Garbage Satellites
  3/2/1, Hunters 3/2/1, UFOs, particles, floaters, the tow chain) plus one mixed late-wave run, ramping
  by `benchRampStep` to `benchMaxCount` and reporting the count at which p95 crosses 16.7 ms and then
  33.3 ms, **update and draw timed separately**; a population that reaches the ceiling reports "not
  reached". Results export as CSV through `navigator.clipboard`, falling back to the `dumpDifficultyLog`
  Blob download and stating the outcome on the panel. ⛔ **Sealed** — five one-line `Bench.running`
  guards at `addScore`/`saveSettings`/`HighScores.save`/`Achievements.save`/`Achievements.evaluate`, and
  `loop()` skips `update()`/`draw()` entirely. ⛔ FORK-CS037-D → (a): `debugOverride` is forced OFF for
  the run and restored on completion, ESC abort and the per-frame `catch`; the run's own entity arrays
  and ship velocity are set aside and put back the same way. New BENCHMARK section, registry 106 → 110,
  headers 10 → 11.

- P2.1 — Gate A instrumentation over the shipped P2 benchmark, additive only: no rework of the
  battery, no existing CSV column altered, no new registry rows. `PEAK_POPS` + `PlayPeaks` add a
  passive real-play high-water-mark recorder over the same twelve populations the battery enumerates
  (peak this run, peak this session), sampled once per frame from `update()`'s cleanup block **after**
  its dead filters, and gated on `Bench.running` — the seal read in the other direction from P2's five
  guards, verified to hold and left unchanged. `PlayPeaks.reset()` fires from `resetRun()`, mirroring
  `DiffLog.rows`'s own per-run reset; the session figure has no reset and lives module-level, not on
  `game` (CS016 P3). `benchPredictMixed()` answers Gate A Q5 in-build: a linear per-entity
  extrapolation from each isolated population's own 16.7 ms crossing row, weighted by `BENCH_MIX`,
  solved for the mixed field's predicted crossing — "unavailable" if any weighted population never
  crossed. `benchReportCSV()` gained new header comment lines (`BENCH_MIX` weights, `navigator.userAgent`
  / viewport / `devicePixelRatio`, the predicted-vs-actual line, and the extrapolation's stated method)
  plus a third table (`population,peak_this_run,peak_this_session`) appended after P2's own two tables,
  which are byte-identical to what P2 shipped.

## Working / verified

- Full suite: **151 files** (150 + new `test-cs037-p2-1.js`, 49 assertions), **151 passed, 0 failed,
  0 skipped**, run clean twice in a row; `node --check` passes. `test-cs037-p2-1.js`
  hand-mutation-checked six times (latch the last value instead of the true max; sample before the
  cleanup filters instead of after; drop the `Bench.running` guard on `sample()`; drop
  `PlayPeaks.reset()` from `resetRun()`; fall back to a population's `top` row when its `cross60` is
  `null`, extrapolating past the ceiling; alter an existing summary-table column header) — all six
  caught. `test-cs026-p3.js`'s TRAP 5 (a byte-literal pin on `resetRun()`'s executable source) needed
  repointing for `PlayPeaks.reset();`, the same treatment CS036 P5's `dockPingTimer` got — not a scope
  change to what that pin protects, and its message string also picked up CS036 P5's own
  previously-unlisted `dockPingTimer`.

- **P2 touched 25 older suite files plus `test-registry.js`, all repoints, none a scope change.** The registry grew by four
  rows and a header and the panel's trailer grew by two action rows, which is what those pins measure:
  nine `DEBUG_VARS.length + 4` → `+ 6`; six section-header lists gaining `BENCHMARK`; six "registry
  unchanged since my parent" allowances widened by four; `test-cs018-p2`/`test-cs015-p4`/`test-cs017-p2`
  re-derived their trailer offsets (P2 now walks the two new rows); `test-cs026-p4`'s FloatText call-site
  count 7 → 8; `test-cs023-p3`'s `/ram/i` id pattern narrowed to `ram(?![a-z])|ramming` (it matched
  `benchRampStep`). ⛔ `Achievements.save()`'s shipped `debugRun || resumedRun` line is byte-unchanged —
  the seal is a SECOND line under it, precisely because two files pin that text and its position.

- Three older suite files pin `damageShip()` / the hazards-vs-ship arm and needed touching because
  this phase's edit landed inside what they pin — none of it a scope change to what they protect:
  - `test-cs024-p6.js` §H TRAP 2 compares against a genuinely moving `git show HEAD:...` (a pre-existing
    defect, same class as the two already flagged below for `test-cs023-p3.js`) — it read red only
    until this phase's own commit landed, then passed vacuously again. Not touched.
  - `test-cs024-p1.js` §F TRAP 2 pins against a **fixed** historical SHA (`8540f2a`, CS024 P1's own
    parent) and correctly caught a real diff. Narrowed the same way CS033 P3's `saucerKills` line
    already was in the same section: the new `srcTag` lines are stripped before the byte-compare, and
    separately asserted present so the strip can't pass by accident.
  - `test-cs023-p3.js` had three byte-literal pins on the two `damageShip()` call sites and its
    function signature; all three repointed to the new (srcTag-carrying) literal text.

## Known issues

- **The benchmark's ms figures exclude the frame's fixed overhead** (starfield, ship, HUD, chrome), by
  design — that is what makes the update-vs-draw split readable — so a crossing count is an **upper
  bound** on what a real frame can afford. The report header says so. Gate A's numbers should be read
  that way, and P3's caps set with headroom accordingly.

- **With "Overrides Applied" already OFF, the four BENCHMARK knobs read their own registry defaults**
  like every other row. Consistent, and no longer a footgun (the battery forces the toggle itself), but
  it means a knob edit made in that state is silently not in effect for the run.

- **`navigator.clipboard` is unavailable on `file://` in several browsers.** The copy row falls back to
  a CSV download and says which happened; if both fail it says that too. Untested in a real browser —
  this session is headless, so the clipboard path itself has only been exercised on its absent-API
  branch.

- **⛔ NEW (P7) — FLAG-CS036-a: a `def` retune does not reach any installation that has ever saved
  settings.** `saveSettings()` writes `debug: { ...debugShown }`, a full snapshot of **every** knob
  (`debugShown` is seeded for all 106 at boot), and `loadSettings()` re-applies every finite
  in-`[min,max]` stored value over the registry default, with `debugOverride` defaulting ON. Measured
  through the harness: a store carrying the CS035 gate's pulse values reloads at envelope 87/125,
  grow 55, shrink 28 — a 50.9 % grow/shrink ratio and a 2.05 s beat — where a fresh boot gives
  80/150, 900, 20 (2.2 %, 3.58 s). **This is what H10/H11 almost certainly measured.** ⛔ Before the
  next gate, set the debug panel's **"Overrides Applied" → OFF** or use **"Reset all debug knobs to
  defaults"**, then re-ask. Whether the full-snapshot save is itself wrong is a design call, not
  taken.

- **⛔ DEFERRED (H6, gate) — the level-end ship pulse "needs to go faster."** Paul: *"It is hard to
  notice the player ship is pulsing… going back and forth between a low intensity and high intensity
  in terms of brightness… like a ghost, and cannot be hit."* No number was returned, so nothing moved.
  The knobs already reach it: `levelEndFade` (`def` 0.25 s one-way → a 0.5 s period; `min` **0.05** →
  0.1 s, 10 Hz) and `levelEndGracePulseEnd` (`def` 0.08 → 0.16 s period; `min` **0.02** → 0.04 s,
  25 Hz). The alpha swing is already 1.0 → 0.2. A slider question wanting a number, not new code —
  and subject to FLAG-CS036-a above.

- **⛔ DEFERRED (H10/H11, gate) — "the punch just isn't there."** Paul asked for the grow leg to take
  ~20 % of the shrink leg; **P4's shipped defaults are at 2.2 %, exceeding the ask ~9×**. Not retuned:
  the ask is already met, and moving the `def`s again cannot change what a build reading stored values
  displays. Re-ask under FLAG-CS036-a's remedy. ⛔ **The colour question stays resolved AGAINST** —
  no `COLOR.satellite` change, `lerpColor()` stays deleted; reversed twice now.

- **A wave that spawns ZERO Garbage Satellites soft-locks the level (P2).** Unreachable in shipped
  play (`junkCount` floors at 3), reachable from the debug panel, whose `junkCountFloor`/`Ceil` both
  go to 0: the field is empty on the next frame and the `waveClearTimer === 0` latch cannot re-arm.
  Narrowing the arm is a design call the spec does not cover.

- **The two announcements can overprint (P3, cosmetic, debug-knobs-only).** A still-live "Level N"
  banner and "Level N Complete" draw at the same `levelBannerY`/`levelBannerSize`. Reachable only by
  raising `levelBannerTime` far enough that a wave clears under a live banner.

- **⛔ Two MORE moving-`HEAD` pins survive in `test-cs023-p3.js`, passing VACUOUSLY (P6).** `headSrc()`
  feeds the `debrisBounce` line count (~599) and the byte-strict `shieldDeflect`/`shieldBounce`
  compare (~641); on a clean tree both compare the file to itself and cannot fail. Each needs a SHA
  chosen and the intervening diffs named. The cure is written in the same file, twice.

- **⛔ Two unseeded-test flakes, measured (P6) and RE-MEASURED (P7).** `test-cs035-p3` §F at **6/120
  (~5 %)** at P6 and **3/60 (5 %)** re-measured at P7 — same rate, same message; `test-f6` §F at
  **2/120 (~1.7 %)**. Neither carries `installSeed`; that shared trait is the likely class. ⚠ P7's own
  closing runs caught them twice before landing a clean 148/148, so **a rerun is the standing way to
  tell either from a real regression** — at 5 % per run, roughly one full-suite run in twenty goes red
  for this reason alone.

- **CS035 — parking at the Recycle dock no longer cleans up, and that is a real behaviour change.**
  A parked ship cannot mop up loose Debris around it; a 60-second park leaves ~220 pieces where CS020
  recycled all 600 (`test-cs020-p1b` §I). Coalescence keeps running on that cloud, so a neglected dock
  apron can still breed a Hunter Satellite — arguably the intended pressure, but new, and no gate has
  asked about it directly.

- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame**, a `getItem` +
  `JSON.parse` per title-screen frame at 60 fps. Deliberate per CS032 §4.3 (a profile switch or delete
  changes the answer, so it can't be cached) — the build's first **unconditional** per-frame storage
  read. See `log/CS032.md`.

- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`**, not on `"Load
  Saved Game"`. `returnToTitleMenu()` hardcodes `MENU_TITLE.indexOf("Options")`, correct for its other
  callers. Changing it is a signature question, which is design, not wiring. See `log/CS032.md`.

- **`test-registry.js`'s `FLAG-CS027-d`** — twelve suite files grep a comment-stripped copy of the
  source missing the same 80 lines `execSource()` fixed. Latent, not live.

- **FLAG-CS027-c (opportunistic) — 8 test files hardcode world dimensions** instead of reading
  `worldDims(X)` from `_harness.js`. See `log/CS027.md`.

- **Piece-distinctness concern, deliberately unresolved (CS028).** Hubble's pieces 1/2 and Skylab's
  0/2 share a polyline vertex-count signature; Juno's folded blade is a third member. Paul's gate
  call: leave as is.

- **Thirteen suite files hard-fail, not skip, on a shallow clone** (measured CS034 P9).
  `test-cs017-p6`, `test-cs019-p1`, `test-cs020-p1`, `test-cs020-p1b`, `test-cs023-p2`,
  `test-cs023-p3`, `test-cs024-p1`, `test-cs024-p2`, `test-cs024-p4`, `test-cs024-p6b`,
  `test-cs024-p6f`, `test-cs026-p1`, `test-cs029-p1`. Mechanical fix, same shape as CS026 P1/P2's
  conversions.

- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (CS023).**
  Both are live in the game today; no gate since has asked about them.

- **`blankLegacyStores()` calls `Achievements.save()` unguarded (CS034 P6)** — harmless today, only
  reachable from profile delete (title-only). A future changeset that makes the profiles or
  achievements screen reachable mid-run must fix both it and the achievement reset.

## Open questions (blocking)

None.

## Next up

- **CS037 is in flight (P1, P2 done). ⛔ GATE A is next and is BLOCKING** — P3 (static caps) does not
  start until Paul has run the battery and returned numbers. Run it from the debug panel's "Run
  benchmark battery" row, then "Copy benchmark results"; the battery forces registry defaults itself, so
  no manual "Overrides Applied → OFF" step is needed. `IMPLEMENTATION-PHASES-CS037.md` GATE A lists the
  six questions to answer.

- `PLANNED-FEATURES-CS037.md` / `IMPLEMENTATION-PHASES-CS037.md` are the live planning pair; P1 is
  prerequisite instrumentation for Item D's telemetry buffer (§5), which is not yet built.

- **The first thing any CS037 gate should do is clear the debug overrides** (FLAG-CS036-a). Every
  slider answer this changeset returned, and every one a future gate returns, is only as good as
  whether the build was reading its registry defaults at the time.

- **Delivery-ticker ship-anchor (deferred) — wants its own gate/playtest**, not a closing-phase guess:
  CS026 P6 tried it and CS029 measured it worse ("a ship-relative origin smears the delivery column as
  the ship drifts DURING a visit"). Declined four times now.

- **Deferred to `coinless-kit`, not this repo** — `game_version` in the board SELECT, a per-player
  query, and client-module support for both, ahead of a future GAME changeset rendering a Version
  column and a worldwide/just-me scope toggle. Shape recorded in `log/CS034.md`.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade` / `levelEndGracePulseEnd` for the ship pulse, and
  `hunterPulseMin`/`Max`/`Grow`/`Shrink` for the heartbeat. H8, H9 and H12 also returned no number and
  stand at their shipped values.

- **Does the caption expiring mid-freeze read right?** With captions on, Dan's "Level N" caption now
  ages during the frozen tail instead of holding, so it can vanish while the field is still stopped.
  Argued from the freeze's own contract and one line to revert either way. Never asked at the gate.

- **Does the dock apron read as pressure or as litter?** CS035 P2's lockout means a parked ship no
  longer cleans up around itself. Nobody has played a long session against that yet, and coalescence
  still runs on the cloud that accumulates.

## Balance notes

- **`COMBO n/N`'s denominator is still unrepresented (from CS026)** since the HUD row was dropped
  (accepted risk). Recorded so a future "the cargo cap is invisible" report is recognised as this.

- **The UFO difficulty chain goes fully flat past level 65 (CS024/CS025)** — junk saturates at L41,
  hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth with nothing escalating
  underneath. Fix if wanted is a step-count increase, no mechanism change.

- **`DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are both first-pass and browser-unverified (CS023).** Measured
  consequence: a rail satellite sweeping into a parked free one throws it up to 511.5 px/s off the
  outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives from.

- **Hunter Debris supply halved (CS034 P3), confirmed right-sized at a wave-12 playtest.**
  `HUNTER_GARBAGE` large/medium tiers dropped to 0; a full lineage yields 9 pieces, down from 18. Not
  verified past wave 12.

- **G20 says the game is no longer too easy**, and CS036's H1 says the level end now reads as a
  deliberate beat. Hunter volatility remains the answer to the former, assessed at
  `hunterVolatileAge` 60.
