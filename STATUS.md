# Orbital Overhaul — STATUS
Version: 1.0.0.33 · Changeset: CS034 · Phase: P4 · Registry: 87 · Levers: 18

## Phase ledger — CS034

- P1 — `tools/dock-float-lab.html` extended per `PLANNED-FEATURES-CS034.md` §3: five new sliders
  (size/sizeStep/sizeMax/hold/fade, replacing the retired `life` knob) feeding the build symbols
  `DEBUG.deliveryFloatSize`/`SizeStep`/`SizeMax`/`Hold`/`Fade`; per-piece size growth on the
  simulated ticker; a hold-then-fade opacity curve (`min(1, life/fade)`, pinned floaters don't age
  so a long visit never eats the hold); and a new ink-aware minimum-clearance readout (delivery
  ticker glyph box vs. the two milestone floaters' glyph boxes, each at its own font size, red at
  &le;0px) replacing the old raw-centerline approximation that reported the misleadingly-exact
  0.0px. At shipped defaults (size 16, sizeStep 0, hold 0, fade 1.2) the sim is behaviourally
  identical to today — verified: measured ink clearance at those defaults is actually **-11.4px**
  (real overlap the old metric couldn't see), not the 0.0px previously on record. Zero changes to
  `orbital-overhaul.html` or any other `tools/` file. GATE A is open; P8 (the build port) blocks on
  Paul's slider answers.

- P2 — Vocabulary glossary and doc sweep per `PLANNED-FEATURES-CS034.md` §1/§0.2. `CLAUDE.md` gains
  a **Vocabulary** section (the four canonical terms + the code inversion map + both required ⛔
  markers). Prose swept to canonical terms in `ORBITAL-OVERHAUL-GDD.md`, `DIFFICULTY-LEVERS.md`,
  `RATIONALE.md` (`EXTERNAL-FILES.md`/`DECISIONS.md`/`STATUS.md` had no matches); code symbols
  untouched throughout. Player-facing strings: 3 achievement descs reworded per spec
  (`satellite_buster`, `field_sweeper`, `waste_not`), every "canister(s)" desc reworded to "Debris"
  (count preserved), 4 `DEBUG_VARS` labels reworded (`garbageAttractRadius/Force`,
  `garbageSoftMax/HardMax`). **One spec'd label reverted:** `debrisBounceRestitution`'s
  "Garbage Satellite bounce restitution" is 36 chars against the debug panel's hard 32-char
  no-wrap/no-truncate column budget (`test-cs024-p6c.js` §G) — left as shipped ("Satellite bounce
  restitution") rather than widening the column, which would be a layout change outside this
  phase's strings-only scope. See Known issues. Achievement ids byte-identical to parent. Suite:
  130/130 on a full clone (one pre-existing test's stale-wording assertion updated to match the new
  Waste Not text).

- P3 — `HUNTER_GARBAGE` per `PLANNED-FEATURES-CS034.md` §2 is now `{3:0, 2:0, 1:1}`: large/medium
  Hunter Satellites emit no Debris on death (still 3-way split, large core still drops its
  powerup), the small tier's one low-mass piece is unchanged since that tier spawns no children.
  The stale v3.3 P4 comment above the emission block in `destroyHunter()` is replaced, not
  appended to. A full 13-body lineage now yields 9 pieces, down from 18. Suite: 131/131 on a full
  clone (`test-cs034-p3.js`, new this phase).

- P4 — `Leaderboard.submit()`'s `stats` key `garbage_satellite_kills` renamed to
  `debris_destroyed` per `PLANNED-FEATURES-CS034.md` §7.1/§0.1: that key was never registered in
  the Worker's `statsFields` (confirmed readable from `coinless-kit`, correcting CLAUDE.md's prior
  "not visible from this repo" claim), so every score posted since CS033 P3 has been showing
  flagged on the public board. Value source unchanged (`game.stats.debrisKills`); `hunter_kills`
  stays deliberately unsent, reason rewritten in `CLAUDE.md`. Added `fmtDuration()` beside
  `fmtCommas()` (`h:mm:ss` at/above an hour, else `m:ss`, `"-"` on bad input) — written once here,
  P7 reuses it. `drawLeaderboard()` gains a `TIME` column between LEVEL and DELIVERED reading
  `e.durationS`, falling back to `"-"`; all six column x-offsets re-derived from `cx` in one edit.
  One pre-existing test (`test-cs033-p2.js` §E) had a stale assertion on the old key name, updated
  to match. Suite: 132/132 on a full clone (`test-cs034-p4.js`, new this phase).

## Working / verified

- Full suite on a full clone: **132 files, 132 passed, 0 failed, 0 skipped, 0 timed out.** (131 →
  132: `test-cs034-p4.js`, new this phase.)
- Registry confirmed at **87**, `LEVERS` at **18** — unmoved this changeset.
- `player_id` mint/backfill/never-regenerate verified directly (`test-cs033-p1.js`): a profile
  loaded from a pre-CS033 blob is backfilled on boot, and a second boot from that same store reuses
  the identical id.
- `Leaderboard` verified with a fake `window.KitLeaderboard` injected post-build
  (`test-cs033-p2.js`): correct `gameId`/`gameVersion`/`getPlayer()` wiring, `beginRun()` firing once
  per `resetRun()`, `eligible()` blocking a debug/resumed run's `submit()`, the real `died`/`quit`
  call sites (including that gameover's own "Quit to Title" does NOT double-submit), the title row's
  dim/inert-with-no-module state, and the rename modal showing `NAME_CHANGE_NOTICE` verbatim before
  applying.
- **All 13 browser-QA items passed (Paul, live browser).** Module bridge served over a local server
  and absent cleanly on `file://`; board screen layout at 1000×560; the two-line
  `NAME_CHANGE_NOTICE` modal; the "⚑" flagged-entry glyph; submit eligibility; both real outcomes
  (`died`/`quit`), including no double-post on gameover's "Quit to Title"; and the per-game saucer
  counter.

## Known issues

- **Every score posted between CS033 P3 and CS034 P4 stays flagged on the public leaderboard.**
  The key fix (P4) only changes what future submissions send — nothing client-side can retroactively
  unflag an already-submitted row. A `coinless-kit` data question, not a game one (spec §7.1).
- **FLAG-CS034-e — `debrisBounceRestitution`'s spec'd label overflows the debug panel's label
  column.** `PLANNED-FEATURES-CS034.md` §1.3 calls for "Garbage Satellite bounce restitution" (36
  chars); `test-cs024-p6c.js` §G enforces a hard 32-monospace-char budget (`drawDebug` neither
  wraps nor truncates). Shipped this phase as the unchanged "Satellite bounce restitution" instead.
  A fix needs either a shorter label that still reads as canonical (gate question — abbreviation
  wording is a design call) or a column-width change (a layout/behaviour change, out of a
  strings-only phase's scope). Not blocking; flagged for the closing phase or a gate.
- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame**, a
  `localStorage.getItem` + `JSON.parse` per title-screen frame at 60fps. Deliberate, per spec
  §4.3 (a profile switch or delete changes the answer, so it can't be cached) — the build's first
  **unconditional** per-frame storage read. If it ever measures, the fix is a cache invalidated at
  the three sites that can change the answer, not a moved question. See `log/CS032.md`.
- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`, not on
  `"Load Saved Game"`.** `returnToTitleMenu()` hardcodes `MENU_TITLE.indexOf("Options")`, correct
  for its other callers, slightly off here. Shipped in P3, player-reachable since P4. Not fixed —
  changing it is a `returnToTitleMenu()` signature question, which is design, not wiring. Save mode
  is unaffected. See `log/CS032.md`.
- **FLAG-CS031-c — `test-f2.js` flakes ~3% of runs** (CS030's celebration-panel `game.celebration`
  leaking across sections in `resetShip()`; pre-existing, not this changeset's). One-line fix
  identified: `game.celebration = null;` in `resetShip()`. 29 suite files reach a death/gameover
  and never mention `game.celebration` — the class is latent beyond `test-f2`.
- **`test-registry.js`'s `FLAG-CS027-d`** — twelve suite files grep a comment-stripped copy of the
  source missing the same 80 lines `execSource()` fixed. Latent, not live.
- **Piece-distinctness concern, deliberately unresolved (CS028).** Hubble's pieces 1/2 and
  Skylab's 0/2 share a polyline vertex-count signature; Juno's folded blade is a third member.
  Paul's gate call: leave as is.
- **Ten suite files still hard-fail, not skip, on a shallow clone (from CS026).** Mechanical fix,
  same shape as CS026 P1/P2's conversions. See `log/CS026.md`.
- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (from
  CS023).** Both are live in the game today; no gate since has asked about them. See `log/CS023.md`.
- **The milestone floaters can still touch the dock anchor at the picked gate value (from
  CS029).** `SALVAGE BONUS`/`MAX HAUL` measured at 0.0px clearance from the delivery ticker at
  `anchorFrac` 0.50 — zero crossing, but no air either. Paul picked 0.50 anyway.

## Open questions (blocking)

None.

## Next up

- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions**
  instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies**
  could migrate to `execSource()` whenever one of them is next open for other reasons.

## Playtest asks (open only — answered ones move to the log)

None open.

## Balance notes

- **`COMBO n/N`'s denominator is still unrepresented (from CS026)** since the HUD row was dropped
  (accepted risk). Recorded so a future "the cargo cap is invisible" report is recognised as this.
- **The UFO difficulty chain goes fully flat past level 65 (from CS024/CS025)** — junk saturates
  at L41, hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth with nothing
  escalating underneath. Fix if wanted is a step-count increase, no mechanism change.
- **`DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are both first-pass and browser-unverified (from CS023),**
  same status as the shield-bounce equivalents. Measured consequence: a rail satellite sweeping
  into a parked free one throws it up to 511.5 px/s off the outer fast ring — nearly double the
  255.7 px/s cap CS023 P4's drift derives from.
- **Hunter Debris supply halved (from CS034 P3)** — `HUNTER_GARBAGE` large/medium tiers dropped
  to 0 (`PLANNED-FEATURES-CS034.md` §2.5). A full lineage now yields 9 pieces, down from 18. Late
  waves where `largeHunterCap` runs several lineages at once may thin delivery-combo achievements
  (`heavy_hauler` at 12, `max_haul` at `CARGO_CAP_MAX` 24) more than intended — a gate question,
  not pre-emptively compensated; nothing about junk spawn rates changed this phase.
