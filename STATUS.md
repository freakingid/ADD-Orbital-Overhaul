# Orbital Overhaul — STATUS
Version: 1.0.0.36 · Changeset: CS037 · Phase: P7 · Registry: 113 · Levers: 18

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

- P4 — periodic gameplay telemetry (spec §5). `Telemetry` (module-level, the `DebugPanel`/`PlayPeaks`
  precedent) buffers one row every `telemetryInterval` seconds of **game time** — new GLOBAL knob, def 15,
  registry 110 → 111, headers unchanged at 11. `Telemetry.tick(dt)` sits beside `PlayPeaks.sample()` in
  `update()`'s cleanup block, so pause, menu and level-ceremony seconds cannot reach it by construction.
  Thirty columns (`TELEMETRY_FIELDS`, the one source of truth for row shape and CSV order): score, level,
  hull, speed, six remaining-use columns (five `powerBudget` keys + `scoopLevel` — health has none, spec
  C10), seven pickup counts, P1's ten `dmgFrom*` accumulators, `debugRun`/`resumedRun`, and the
  `game.stats.gameTime` timestamp. 400-row ring, oldest off; cleared by `Telemetry.reset()` in
  `resetRun()`, so both `startGame()` and `resumeFromSave()` inherit it. Six new flat `*Picked` counters on
  `resetGameStats()`, incremented at ONE site above `applyPowerup()`'s scoop early-return; **health reuses
  `healthPicked`** and Glass Cannon is untouched. New key `afd_telemetry_v1`, written each snapshot on the
  `SaveSlots` idiom verbatim (`Profiles.keyFor()` at both sites, `storageOK()`, try/catch, versioned
  envelope, known-value-else-default) but **silent on failure** — a background write, not a player-initiated
  save. ⛔ No existing key touched. Export is a "Copy telemetry log" debug-panel action row, and the secret
  code's gate gained a **paused-gameover** arm so it is reachable there — required, since the next
  `resetRun()` clears the buffer.

- P5 — full tow release on damage + the "Payload lost." event split (spec §4). Any real HP-dealing hit
  now calls `scatterChain()` **unchanged**, hooked on `damageShip()`'s non-lethal branch **below** the
  `s.hp <= 0` exit — `killShip()` already scatters, so the shared return would double-scatter. Shielded /
  i-framed / auto-shield hits return false, deal 0 HP and keep the cargo. ⛔ FORK-B1 → no (`powerBudget.guard`
  neither read nor spent; `breakChain()` is not on this path) and ⛔ FORK-B2 → no (`cargoDamageEvents`
  untouched — reusing `scatterChain()` verbatim gives both for free). The release is guarded on a
  **non-empty** chain: with nothing in tow it is a genuine no-op, so a hit taken empty-handed cannot zero
  a dock visit's `deliveryCount` through `scatterChain()`'s own side effects. "Payload lost." moved out of
  `chain_broken` into a new `chain_lost` event, **text and phon verbatim** — no new phon, no
  `voice-robot-lab` gate. One selection rule at every chain-loss site ("was the chain non-empty, and is it
  now empty"): the damage release speaks it, `breakChain(0)` speaks it, `breakChain(i > 0)` keeps
  `chain_broken`, the guarded absorb is unchanged, and ship death stays silent because the `say()` is at
  `damageShip()`'s call site, never inside `scatterChain()`. `VOICE_PRIORITY` 2 (matching `chain_broken`,
  strictly below `health_low`), `VOICE_CRITICAL` true, **`VOICE_QUEUE_MAX` 4 → 5**, `VOICE_STILL_TRUE`
  predicate `game.chain.length === 0`. No registry rows, no lever change.

- P6 — the resume achievement baseline + FORK-CS037-A.1's (b2) targeted merge write (spec §6, §2.2).
  Root cause confirmed by inspection, exactly as C7-rev states it (the prompt's `load()` is the build's
  `init()` — same function, there is no `load()`). `Achievements.resumeBaseline`, module state and NOT a
  `game.*` field, is taken by `snapshotResumeBaseline()` **blanket over both pools** as
  `resumeFromSave()`'s new **step 3**, between the stats overwrite and `nextWave()`; `evaluate()` reads
  it as a floor in two places (`checkSingle` returns before its `set.add`; the tiered loop's start index
  is raised, so a baselined tier is SKIPPED, not silently recorded). ⛔ It marks nothing —
  `weeklyUnlocked` / `lifetimeUnlocked` / `lifetimeTiers` untouched. Cleared in `resetRun()`.
  `Achievements.mergeUnlock()` is a second, narrow writer of `afd_achievements_v2`: read-modify-write,
  unlock ids and tier indices only, stored `lifetime` counters returned byte-identical, guarded
  `!game.resumedRun || game.debugRun` (combined form deliberately — `test-cs032-p2.js` §M pins the
  single-flag `if (game.debugRun) return;` gone) plus the `Bench.running` seal, 8 guards → 9. With no
  stored blob it writes nothing. `save()` byte-unchanged, `drawToasts()` untouched, no registry rows.

- P7 — one powerup per dock visit + two DELIVERY score knobs (spec §7). The four `deliveryCount`
  latches (8/12/16/20) collapse to one: `=== 8` kept, `=== 12`/`=== 16`/`=== 20` deleted — the counter
  always passes through 8, so the equality already is the ">= 8, once per visit" rule. Hauls of 7 or
  fewer still award nothing; `=== 12` Heavy Hauler and `=== CARGO_CAP_MAX` Maxed Out/`superMegaDelivery()`
  are untouched (different mechanisms, shared numbers). `DOCK_BASE_SCORE`/`DOCK_BONUS_STEP` promoted to
  `dockBaseScore`/`dockBonusStep`, DELIVERY registry knobs at their shipped values (50/25, unchanged this
  changeset) — the delivery pts calculation now reads `DEBUG.dockBaseScore`/`DEBUG.dockBonusStep`, same
  `scoopHitsPerLevel` precedent. No score compensation (S4). Registry 111 → 113. The two new rows land
  inside the existing DELIVERY section, not at the registry's true tail, so fourteen older phases'
  registry-count/order pins needed the same in-place "REPOINTED BY" update every prior registry
  addition has required — no build behavior in those phases changed, only their own historical pins.

## Working / verified

- Full suite: **154 files** (153 + new `test-cs037-p6.js`, 229 assertions), **154 passed, 0 failed,
  0 skipped**; `node --check` passes. `test-cs037-p6.js` hand-mutation-checked **fifteen** times, all
  fifteen caught and thirteen BEHAVIOURALLY rather than only by a source pin: drop the `checkSingle`
  gate / the tiered floor / `onUnlock`'s `mergeUnlock()` call / `resetRun()`'s clear; snapshot before the
  stats overwrite; snapshot after `nextWave()`; the naive fix (snapshot marks things unlocked); snapshot
  weekly-only; lifetime-only; the merge write writing `lifetime` counters too (i.e. (b1)); it dropping
  the `debugRun` bar; it dropping the `Bench.running` guard; `>` for `>=` in the gate; the tiered floor
  off by one; the merge write creating a blob where none was stored.

- **P6 touched three older suite files plus one comment-only annotation, all repoints, none a scope
  change.** `test-cs026-p3` TRAP 5 gained `Achievements.resumeBaseline = null;` in `DROPPED_LINES` (the
  treatment P2.1's `PlayPeaks.reset();` and P4's `Telemetry.reset();` got); `test-cs030-p1` §A read the
  reset list through a 3000-**byte** window off `function startGame()` that this phase's commented line
  pushed past, re-anchored on `resetRun()`'s closing brace so it cannot go stale that way again;
  `test-cs037-p4` §H's `Bench.running` guard COUNT is 8 → 9. The annotation is `test-cs032-p2` §E: it
  still passes and still measures what it always did (the `delete` above it leaves no blob to merge
  into), but its claim is narrower than it reads now, and the comment says so.

- Previously: full suite at P5 was **153 files** (152 + new `test-cs037-p5.js`, 152 assertions), **153 passed, 0 failed,
  0 skipped** after P5's own commit landed; `node --check` passed on the extracted script.
  `test-cs037-p5.js` hand-mutation-checked **fourteen** times, all fourteen caught, every one reporting
  cleanly rather than crashing: release moved above the lethal exit; release ALSO hooked on the lethal
  branch; the empty-chain guard dropped; the release spending a guard charge (FORK-B1); the release
  bumping `cargoDamageEvents` (FORK-B2); the `say()` moved inside `scatterChain()`; `VOICE_QUEUE_MAX`
  left at 4; `chain_lost` promoted to priority 3; `chain_lost` dropped from `VOICE_CRITICAL`; the
  still-true predicate weakened to `() => true`; `breakChain`'s selection removed; `breakChain`'s
  selection inverted; "Payload lost." left under `chain_broken` as well; `VOICE_STILL_TRUE.chain_lost`
  removed. ⛔ A double scatter is behaviourally INVISIBLE (the second call sees an empty chain), so §E
  pins it two ways — released pieces are counted by a marked node `mass` that `Garbage.fromNode()` copies
  through, and §I pins the source ORDER inside `damageShip()` against `execSource()`'s comment-free copy.

- **P5 touched four older suite files, all repoints, none a scope change.** `test-cs015-p7` split its
  `APPROVED` five into four partial + one total and now asserts the CONSERVED TOTAL across both events
  (every byte of Paul's approved pairs is still pinned, and §C's zero-err gate follows the moved line);
  `test-cs011-p5` §B stopped pinning `chain_broken.length === 5` (a count it never owned — CS015 P7
  replaced that set) and walks both events, while §D/§E accept either pool since what they own is the
  captioning, not which event supplied the line; `test-cs017-p7`'s "chain_broken's 5 lines are
  untouched" sanity line became the same conserved-total claim plus a no-leak check; `test-cs023-p3`
  §A's byte-strict `breakChain` pin gained P5's voice selection as a **fourth named diff**, with both
  halves of the pair extended through the whole `say()` line including its comment — the final
  `eq()` stays byte-strict, which is what keeps the diff list exhaustive.

- Previously: `test-cs037-p4.js` hand-mutation-checked
  eleven times (drop `Telemetry.reset()` from `resetRun()`; move the pickup increment below the scoop
  early-return; drop the health exclusion so `healthPicked` double-counts; cap 400 → 500; roll the NEWEST
  row off instead of the oldest; drop `tick()`'s `Bench.running` guard; stop checking the envelope version;
  revert the paused-gameover arm; write the bare key instead of `Profiles.keyFor()`; make the empty-buffer
  export a silent no-op; halve the effective interval) — all eleven caught.

- **P4 touched 21 older suite files plus `test-registry.js`, all repoints, none a scope change** except one,
  named below. Registry 110 → 111 and the panel trailer grew by one action row: ten `DEBUG_VARS.length + 6`
  → `+ 7`; `test-cs018-p2`/`test-cs015-p4`/`test-cs017-p2` re-derived their trailer offsets;
  `test-cs018-p6`/`test-cs026-p3` widened their GLOBAL-membership lists; `test-cs024-p6b` gained a
  tail-ordered `,telemetryInterval$` strip; `test-cs024-p6c`'s non-lever count 56 → 57; five "added since"
  allowlists gained the id; six "registry unchanged since my parent" allowances widened by one;
  `test-cs026-p3`'s TRAP 5 gained `Telemetry.reset();` in `DROPPED_LINES`, the same treatment CS037 P2.1's
  `PlayPeaks.reset();` got. **The one genuine narrowing:** `test-cs026-p5.js` §A asserted "nothing was
  appended to GLOBAL"; P4 appends `telemetryInterval` there, so that claim is retired and replaced by a
  pin that `levelBannerY` is followed by exactly that row. What §A actually owns — the four banner knobs
  sitting together after `startLevel` — is unchanged.

- CS037 P2's seal re-measured after P4 and **holds**: eight `if (Bench.running) return;` guards now (P2's
  five, `benchCopyResults()`'s, `PlayPeaks.sample()`'s and `Telemetry.tick()`'s), `loop()` still skips
  `update()`/`draw()` outright, and 60 s of driven `update()` under `Bench.running` produces no telemetry
  row and does not move the accumulator.

- Previously: `test-cs037-p2-1.js` hand-mutation-checked six times, all six caught (latch-vs-max;
  sample before the cleanup filters; drop `sample()`'s `Bench.running` guard; drop `PlayPeaks.reset()`
  from `resetRun()`; fall back to a population's `top` row past the ceiling; alter a summary column
  header). `test-cs026-p3` TRAP 5 took `PlayPeaks.reset();` into `DROPPED_LINES`, the CS036 P5
  `dockPingTimer` treatment, and its message picked up that previously-unlisted line too.

- **P2 touched 25 older suite files plus `test-registry.js`, all repoints, none a scope change** — the
  registry grew four rows and a header and the panel trailer two action rows, which is exactly what
  those pins measure (nine `DEBUG_VARS.length + 4` → `+ 6`; six header lists gaining `BENCHMARK`; six
  "unchanged since my parent" allowances widened by four; three re-derived trailer offsets;
  `test-cs026-p4`'s FloatText count 7 → 8; `test-cs023-p3`'s `/ram/i` narrowed to
  `ram(?![a-z])|ramming`). ⛔ `Achievements.save()`'s shipped `debugRun || resumedRun` line is
  byte-unchanged — the seal is a SECOND line under it, because two files pin that text and its position.

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

- **⛔ NEW (P6) — a resume can still fanfare `master_field` / `no_powerups` tiers, OUTSIDE the baseline
  by design.** `nextWave()` credits `lifetime.maxWave` and (behind its `powerupsPicked === 0` gate)
  `maxWaveNoPowerup` at step 5, AFTER step 3's snapshot, so on a store that does not already record the
  slot's wave — fresh install, a profile that never played that deep, a lifetime reset — those two MAX
  ladders can cross on the resume frame. Pre-existing (CS032 P2 bars the write, not the in-memory
  credit) and unreachable for a player whose own store recorded the wave they saved on. The cure would
  be re-snapshotting after `nextWave()`, which the ⛔ placement forbids because `untouchable`'s `cur()`
  reads `game.wave`. `test-cs037-p6.js` works around it with realistic fixture stores.

- **⛔ NEW (P6) — P8's closing contract is short by two items, and this file is at its cap.** P8's GDD
  §2 list names the tow release, the "Payload lost." split and the one-powerup rule; **the resume
  baseline and the merge write are shipped behaviour too** (§2.20 / §2.22), and `CLAUDE.md`'s Save data
  section now understates `afd_achievements_v2` — `Achievements.save()` is no longer its only writer.
  Not edited here: exactly one `⛔ INVARIANT` change belongs to this changeset (this phase's
  `resumeFromSave()` ordering, made in the build) and P8 owns both sweeps. Joins P4's key-list gap and
  P5's `VOICE_CRITICAL` gap on that list. ⛔ **`STATUS.md` is at ~400 lines** even after this phase
  compressed P2's and P2.1's superseded repoint blocks; P7 crosses it, and the roll resets it.

- **⛔ NEW (P5) — a THIRD moving-`HEAD` pin site, `test-cs025-p4.js`'s TRAP 3.** It asserts
  `VOICE_LINES` and `VOICE_PRIORITY` are "unchanged from HEAD" via `git show HEAD:`, so it read red
  through this session and goes green (vacuously — the file compared to itself) the moment P5's commit
  lands. Same class as `test-cs024-p6.js` §H TRAP 2, which CS037 P1 hit and deliberately left, and as
  the two already listed below in `test-cs023-p3.js`. **Deliberately not repaired here:** the cure is
  choosing a fixed SHA and naming the intervening diffs in a file this phase does not own, which is the
  same judgement P1 made. What P5 *does* change is that both tables are now genuinely edited, so the
  trap has a real diff to have caught and did not. Four sites now share this defect; they want one pass.

- **⛔ NEW (P5) — the release is guarded on a non-empty chain, and the spec did not say either way.**
  §4.1 says a hit "releases all towed Debris"; with nothing in tow there is nothing to release, but
  `scatterChain()` also zeroes `deliveryCount` and calls `releaseDeliveryTicker()`. Called
  unconditionally it would end a dock visit's tally on any hit taken empty-handed — a side effect the
  spec never asks for. The guard is the same condition the voice rule needs ("was the chain non-empty"),
  so it is one test, not two. Stated rather than hidden; reversible in one line if Gate B disagrees.

- **⛔ NEW (P4) — `CLAUDE.md`'s Save data section now understates the key list, and P8 must fix it.**
  That section enumerates three frozen keys, "CS031 adds a fourth", "CS032 adds a fifth" and
  "⛔ CS033 adds no sixth key." P4 adds `afd_telemetry_v1` — additive, owned by CS037 P4, not frozen,
  lazy (nothing reads it at boot), routed through `Profiles.keyFor()`. The CS033 line stays literally
  true about CS033, but the enumeration now reads as complete when it is not. **Deliberately NOT edited
  here:** the spec's cross-cutting constraints say exactly one `⛔ INVARIANT` marker changes this
  changeset (`resumeFromSave()` step ordering, P6's) and P8 owns the `CLAUDE.md` sweep. This is the
  hazard that constraint was written before P4 existed to account for.

- **The telemetry export falls back to the PERSISTED buffer when the live one is empty (P4).** A design
  detail the spec did not name: §5.6 says the key exists "so a crash or refresh does not lose the run",
  which is only true if something reads it back, and nothing else in the build does. `copyTelemetry()`
  is that reader — live buffer first, persisted copy second — and `Telemetry.msg` always states which
  of the two it copied, so the two can never be confused. Consequence, stated rather than hidden: after
  a `resetRun()` and before the new run's first snapshot, the export hands back the PREVIOUS run's rows,
  labelled "storage". That is the recovery case working, not a leak.

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

- **CS037 is in flight (P1, P2, P2.1, P4, P5, P6, P7 done; P3 DROPPED at Gate A).** Next: the
  BLOCKING Gate B, then P8.

- **P8's `CLAUDE.md` sweep now has a second item beyond P4's key list:** the Audio section's
  `VOICE_CRITICAL` rule names the critical set as "the four `VOICE_CRITICAL` events" and lists
  `health_low` / `health_relief` / `cargo_full` / `level`. P5 makes it five, adding `chain_lost`. The
  rule's substance — criticality is orthogonal to priority, no TTL, raise `VOICE_QUEUE_MAX` with the set
  — is unchanged and was followed to the letter; only the enumeration is now short by one. Not edited
  here: the spec's cross-cutting constraints give exactly one `⛔ INVARIANT` change to this changeset
  (P6's `resumeFromSave()` ordering) and P8 owns the sweep.

- **GATE A closed 2026-08-19 with a null result** — every population cleared both thresholds at the
  2000-entity ceiling, so P3 (static caps) was dropped. `IMPLEMENTATION-PHASES-CS037.md` keeps the
  phase in place, struck, and `PLANNED-FEATURES-CS037.md` §3.4 holds the numbers.

- `PLANNED-FEATURES-CS037.md` / `IMPLEMENTATION-PHASES-CS037.md` are the live planning pair. Item D
  (§5) is now BUILT — P1's ten accumulators and P4's buffer, storage and export together.

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

- **Does losing the WHOLE tow to any hit read as fair, or as punishing?** P5 ships it with no shield-
  side softening beyond the existing shielded / i-framed / auto-shield exemptions, and with the chain
  guard deliberately NOT intercepting (FORK-B1). Gate B question 5 asks whether "Payload lost." now
  fires only on genuine total loss; this is the balance half of the same change and nobody has played
  a wave against it.

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
