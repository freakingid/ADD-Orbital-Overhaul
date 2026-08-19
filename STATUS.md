# Orbital Overhaul — STATUS
Version: 1.0.0.37 · Changeset: CS037 · Phase: P8 (closed) · Registry: 115 · Levers: 18

## Phase ledger — CS037

- P1 — per-source damage attribution, instrumentation only. `damageShip()` gains a `srcTag` covering
  ten categories (Garbage Satellite/Hunter Satellite × 3 sizes, UFO body/shot × 2 sizes); ten flat
  `game.stats.dmgFrom*` accumulators, non-lethal branch only. No gameplay behaviour change.

- P2 — the in-game benchmark instrument. A sealed, debug-panel-only battery over twelve isolated
  entity populations plus one mixed run, reporting p95 16.7/33.3 ms crossing counts with update and
  draw timed separately. **FORK-CS037-D → (a)** forces `debugOverride` off for the run and restores
  it unconditionally, neutralizing FLAG-CS036-a for the measurement's own duration. New BENCHMARK
  section, registry 106 → 110, headers 10 → 11.

- P2.1 — Gate A instrumentation, additive over shipped P2: a passive real-play per-population peak
  recorder (run + session), `BENCH_MIX` weights and an environment stamp in the CSV header, and an
  in-build predicted-vs-actual mixed-crossing calculation. Registry unchanged at 110.

- ~~P3 — static object caps~~ — **DROPPED.** ✅ **Gate A closed 2026-08-19: every population cleared
  both thresholds at a 2000-entity ceiling on two browsers** (Edge/Ganesh, Chrome/Graphite); the
  smallest margin against real-play peaks was **>12×**, all figures lower bounds. No population needs
  a cap. Secondary finding kept as a known issue below: the late-wave frame hiccup is **not** caused
  by entity accumulation, and its real cause is unmeasured.

- P4 — periodic gameplay telemetry. One row every `telemetryInterval` seconds of **game time**
  (new GLOBAL knob, def 15; registry 110 → 111), 400-row per-run ring cleared at `resetRun()`. Thirty
  columns: score/level/hull/speed, six remaining-use columns, seven pickup counts, P1's ten
  `dmgFrom*` columns, `debugRun`/`resumedRun`, timestamp. New key `afd_telemetry_v1` (SaveSlots
  idiom, silent-fail background write). Clipboard export in the debug panel, reachable at game-over.

- P5 — full tow release on damage; "Payload lost." as its own event. Any real HP-dealing hit calls
  `scatterChain()` unchanged on `damageShip()`'s non-lethal branch only (no double-scatter on death).
  **FORK-B1/B2 → no** — no chain-guard interception, no `cargoDamageEvents` bump. "Payload lost."
  moved verbatim out of `chain_broken` into a new critical event, `chain_lost`, chosen by "was the
  chain non-empty, and is it now empty" at every chain-loss site. `VOICE_QUEUE_MAX` 4 → 5. No
  registry rows.

- P6 — resume achievement baseline, both pools. `Achievements.snapshotResumeBaseline()` snapshots
  every active achievement's `cur()` as `resumeFromSave()`'s new step 3 (after the stats overwrite,
  before `nextWave()`), fixing a live data-integrity bug where two LIFETIME achievements
  (`untouchable`, `max_haul`) were leaking into `afd_achievements_v2` via the next non-resumed run.
  **FORK-A → (b), FORK-A.1 → (b2):** a genuinely post-baseline unlock now persists through a targeted
  merge write (`Achievements.mergeUnlock()`) that leaves stored `lifetime` counters untouched, so
  CS032 P2's repeated-resume counter bar survives intact. No registry rows.

- P7 — one powerup per dock visit + two DELIVERY score knobs. The four `deliveryCount` latches
  (8/12/16/20) collapse to the `=== 8` one; the counter always passes through 8, so that equality
  already is the rule. `DOCK_BASE_SCORE`/`DOCK_BONUS_STEP` promoted to `dockBaseScore`/`dockBonusStep`
  registry knobs at unchanged values (50/25) — no score compensation. Registry 111 → 113.

- ✅ **GATE B — closed 2026-08-19: every tunable answer "no change."** Zero knob moves, zero
  deferrals. The dock nerf and the tow release both read as intended under play — under play, not
  just argument, this confirms FORK-CS037-B1 → no. **The gate's one actionable output was a defect,
  not a tunable:** a hull hit's released tow re-hooks itself almost immediately (random release
  vector + pickup-circle overlap + knockback aimed at the wrong thing + a Magnet's pull). → P7.1.

- P7.1 — tow release separation. Two mechanisms, both hooked only at the P5 damage-release site:
  every freed node is propelled radially away from the ship at `DEBUG.towReleaseSpeed` (velocity SET,
  not added), and `game.towLockoutT` arms to `DEBUG.towReleaseLockout` and shuts the capture gate +
  suppresses the Magnet's `pulling` pull while it runs. **Not** gated on `ship.invuln` — an
  auto-shield save sets that too but keeps the cargo. `scatterChain()`/`Garbage.fromNode()`/
  `breakChain()`/`killShip()` all byte-unchanged. Two new SHIP knobs. Registry 113 → 115.

- P8 — closing. Gate B's "fold numeric answers into `def`s" was a no-op and is recorded as such —
  every answer was "no change." `GAME_VERSION` → **1.0.0.37** (seven live pins re-pointed). One new
  `⛔ INVARIANT` in `CLAUDE.md` (the `resumeFromSave()` five-step order, now including P6's baseline
  as step 3) — `cullGarbage()`'s note left untouched, P3 having shipped nothing. GDD §2 updated for
  the tow release + P7.1's lockout (documented together, one mechanism), the `chain_broken`/
  `chain_lost` split threaded through every §2.8 voice mention, and the one-powerup dock nerf.
  `DIFFICULTY-LEVERS.md` verified — `LEVERS` still 18, two new "not a lever" rows added for P7's and
  P7.1's flat knobs. `log/CS037.md` written, both planning docs archived.

## Working / verified

- Full suite: **156 files, 156 passed, 0 failed, 0 skipped, 0 timed out**; `node --check` passes on
  the extracted script. `test-registry.js` confirms registry **115**, headers **11**, `LEVERS` **18**,
  `POWERUP_DROP_TYPES` **5**. Neither standing unseeded flake fired on the closing run.
- Eight new test files this changeset — `test-cs037-p1/p2/p2-1/p4/p5/p6/p7/p7-1.js` — each
  hand-mutation-checked against multiple regressions (P5 and P6 the deepest, 14 and 15 respectively)
  before landing; every one of the ~25 older suite files P1–P7.1 touched was a repoint, never a scope
  change to what that file protects (full accounting in `log/CS037.md`).

## Known issues

- **The late-wave frame hiccup's cause remains unmeasured (Gate A null result).** Entity accumulation
  is ruled out — every population cleared the benchmark's ceiling by >12× against real-play peaks
  (particles: 166 real peak vs. 2000 costing 1.0 ms) — so the actual cause is open. The benchmark
  deliberately excludes fixed per-frame overhead (starfield, ship, HUD, chrome); a future
  investigation should start there.

- **CLAUDE.md documentation debt, three items, none behavioural — deliberately not closed this
  phase** (this session's closing scope named exactly one `⛔ INVARIANT` change and three GDD items;
  these three are separate enumeration staleness, not invariant changes): `afd_telemetry_v1` missing
  from the Save data key list (flagged P4); `Achievements.save()` no longer `afd_achievements_v2`'s
  only writer, `mergeUnlock()` unnoted (flagged P6); the Audio section's `VOICE_CRITICAL` enumeration
  still names four events, not five — missing `chain_lost` (flagged P5).

- **A resume can still fanfare `master_field`/`no_powerups` tiers, OUTSIDE the P6 baseline by
  design.** `nextWave()` credits `lifetime.maxWave`/`maxWaveNoPowerup` at its own step 5, after the
  baseline's step 3, so a store that never recorded the slot's wave (fresh install, a lifetime reset)
  can still cross those two MAX ladders on the resume frame. Pre-existing, unreachable for a player
  whose own store already recorded the wave they saved on.

- **Two unseeded-test flakes stand:** `test-cs035-p3` §F (~5%), `test-f6` §F (~1.7%). A rerun is the
  standing way to tell either from a real regression — at 5% per run, roughly one full-suite run in
  twenty goes red for `test-cs035-p3` §F alone.

- **⛔ FLAG-CS036-a stands.** `saveSettings()` writes a full snapshot of every debug knob, and
  `loadSettings()` re-applies it over the registry defaults with `debugOverride` defaulting ON — any
  installation that has ever saved settings is not running shipped defaults. Clear "Overrides
  Applied" (or reset all debug knobs) before any future gate's numeric questions.

- **Four moving-`HEAD` test pins survive, passing vacuously on a clean tree:** `test-cs023-p3.js`
  (the `debrisBounce` line count and the byte-strict `shieldDeflect`/`shieldBounce` compare),
  `test-cs024-p6.js` §H TRAP 2, and `test-cs025-p4.js` TRAP 3 (the `VOICE_QUEUE_MAX`/critical-set
  relationship pin). Each needs a fixed SHA chosen and the intervening diffs named — the cure is
  written in `test-cs023-p3.js` itself.

- **`navigator.clipboard` is unavailable on `file://` in several browsers.** The benchmark's and
  telemetry's copy rows both fall back to a CSV Blob download and say which happened. Untested in a
  real browser — this session is headless, so only the absent-API branch has been exercised.

- **CS035 — parking at the Recycle dock no longer cleans up, and that is a real behaviour change.**
  A parked ship cannot mop up loose Debris around it; coalescence keeps running on the cloud that
  accumulates, so a neglected dock apron can still breed a Hunter Satellite. No gate has asked about
  it directly (see Playtest asks, below).

- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame**, a `getItem` +
  `JSON.parse` per title-screen frame at 60 fps. Deliberate (CS032 §4.3) — the build's first
  unconditional per-frame storage read. See `log/CS032.md`.

- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`**, not on `"Load
  Saved Game"`. Changing it is a signature question, design not wiring. See `log/CS032.md`.

- **`test-registry.js`'s FLAG-CS027-d** — twelve suite files grep a comment-stripped copy of the
  source missing the same 80 lines `execSource()` fixed. Latent, not live. **FLAG-CS027-c** — 8 test
  files hardcode world dimensions instead of reading `worldDims(X)` from `_harness.js`.

- **Piece-distinctness concern, deliberately unresolved (CS028).** Paul's gate call: leave as is.

- **Thirteen suite files hard-fail, not skip, on a shallow clone** (measured CS034 P9). Mechanical
  fix, same shape as CS026 P1/P2's conversions.

- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (CS023).**
  Both are live in the game today; no gate since has asked about them.

- **`blankLegacyStores()` calls `Achievements.save()` unguarded (CS034 P6)** — harmless today, only
  reachable from profile delete (title-only). A future changeset that makes the profiles or
  achievements screen reachable mid-run must fix both it and the achievement reset.

## Open questions (blocking)

None.

## Next up

- **CS037 is closed. No changeset is in flight.** The next one opens with a
  `PLANNED-FEATURES-CS038.md` / `IMPLEMENTATION-PHASES-CS038.md` pair; `STATUS.md` above is the whole
  of the current state.

- **The first thing any future gate should do is clear the debug overrides** (FLAG-CS036-a). Every
  slider answer any past gate has returned, and every one a future gate returns, is only as good as
  whether the build was reading its registry defaults at the time.

- **Delivery-ticker ship-anchor (deferred) — wants its own gate/playtest**, not a closing-phase guess:
  CS026 P6 tried it and CS029 measured it worse ("a ship-relative origin smears the delivery column as
  the ship drifts DURING a visit"). Declined four times now.

- **Deferred to `coinless-kit`, not this repo** — `game_version` in the board SELECT, a per-player
  query, and client-module support for both, ahead of a future GAME changeset rendering a Version
  column and a worldwide/just-me scope toggle. Shape recorded in `log/CS034.md`.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade`/`levelEndGracePulseEnd` for the ship pulse, and
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

- **CS037 (C+F together) rated 5/10** — balanced, does not push late-wave play toward small hauls.
