# Orbital Overhaul — STATUS
Version: 1.0.0.33 · Changeset: CS034 · Phase: P7 · Registry: 87 · Levers: 18

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

- P5 — `drawCelebration()` now derives its title/sub-line from `game.celebration.resume` per
  `PLANNED-FEATURES-CS034.md` §4: level-end (`resume === "wave"`) reads `"LEVEL N COMPLETE"` /
  `"During level N you earned:"`, off live `game.wave` (still the just-completed wave —
  `nextWave()` stays deferred to dismissal, no new field added). Game-over (`resume === null`) is
  unchanged. Two pre-existing `test-cs030-p5.js` assertions were stale against this legitimate
  change and updated: §B's rendered-title check, and §H's byte-identity pin, which now excludes
  `drawCelebration(` from its untouched-functions list (the other three stay pinned). Suite:
  133/133 on a full clone (`test-cs034-p5.js`, new this phase).

- P6 — Achievement reset per `PLANNED-FEATURES-CS034.md` §5. New `resetAchievements(pool)` owns clear +
  persist for the ACTIVE PROFILE only (`"lifetime"` zeroes every counter and empties
  `lifetimeUnlocked`/`lifetimeTiers`; `"weekly"` empties `weeklyUnlocked`; then `Achievements.save()` —
  never `init()`, which would reload what was just cleared). `weekKey`/`activeIds` untouched; no new
  `localStorage` key. Reached from the Achievements viewer behind two stages: the shared modal (naming
  pool + profile, `index: 1` CANCEL default untouched) then a typed `reset`. ⚠ **FLAG-CS034-a shipped as
  spec'd** — `menuAchievements()`'s `confirm` is split off from `back`, so ENTER now resets the shown
  tab instead of leaving; `ACH_HINT` rewritten in the same edit. `openNameEntry()`'s `ctx` gained
  optional `title`/`validate`, resolved for the live AND commit paths through one new
  `nameEntryValidate()`; `nameEntryError()` is untouched and becomes the default. `ACH_ROW_CLIP_BOTTOM`
  620 → 572 to seat the reset row (Weekly tab still ceiling 0). Two pre-existing tests asserted the old
  shared confirm/back branch and were updated: `test-cs016-p2.js` §D and `test-cs016-p5.js` §H. Suite:
  134/134 on a full clone (`test-cs034-p6.js`, new this phase).

- P7 — Local high scores reworked per `PLANNED-FEATURES-CS034.md` §6. **The 3-slot initials entry is
  DELETED** (`game.entry` from both places, its dispatcher/commit/renderer, both input handlers' blocks,
  all seven guards); a qualifying run's record is written outright at the "dying"→"gameover" seam, named
  from `Profiles.nameOf(activeId)`, `game.lastScoreId` unchanged in role, eligibility gate byte-unchanged.
  `SCORES_CHARSET` KEPT (`NAME_CELLS` derives from it), comment repointed. Records are additive: new ones
  carry `name` + `durationS`/`saucerKills`/`satelliteKills` and no `initials`; `load()`'s filter dropped
  its `initials` clause (numeric score only) so legacy and new rows both survive. `HighScores` reads **no
  game global** — `add(record)` takes a complete plain object and stamps only `v`/`id`/`ts`; one
  `makeRunResult()` feeds both it and `Leaderboard.submit(outcome, run)`. `SCORES_MAX` 10 → 25; the
  browsable screen gains an ALL PROFILES / THIS PROFILE ◄► view over the still-shared table
  (`HighScores.filtered()`; `qualifies()`/`add()` never see it), its own eight-column renderer at
  `HS_TABLE_SCALE` **1.4** (⚠ FLAG-CS034-b) and `ACH_SCROLL_STEP` scrolling clamped by one
  `scoresMaxScroll()` measured from the clip top. `resetHighScores()` now sits behind P6's two-stage
  confirm (`openScoresReset()`), reached from the screen's ENTER and from the unchanged debug row —
  ⚠ so ENTER no longer leaves that screen, the shape FLAG-CS034-a took one phase earlier. Suite: 135/135
  on a full clone (`test-cs034-p7.js`, new this phase); 17 pre-existing files carried stale assertions
  about the deleted subsystem and were updated (see Known issues).

## Working / verified

- Full suite on a full clone: **135 files, 135 passed, 0 failed, 0 skipped, 0 timed out.** (134 →
  135: `test-cs034-p7.js`, new this phase.)
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

- **Seventeen pre-existing suite files were updated for CS034 P7's deletions**, all of them asserting the
  initials entry or `add()`'s old partial-record signature: `test-cs010-p0`, `test-cs010-p5`,
  `test-cs013-p1`, `test-cs016-p2`, `test-cs024-p6d`, `test-cs024-p6e`, `test-cs025-p5`, `test-cs026-p3`,
  `test-cs026-p6`, `test-cs029-p2`, `test-cs030-p4`, `test-cs031-p1`, `test-cs031-p3`, `test-cs032-p2`,
  `test-cs032-p3`, `test-v36-scores`, `test-v36-death`. Three were **repointed rather than deleted**,
  each named in place: `test-cs013-p1` §I and `test-cs029-p2` §A now aim their exclusive-mode guard at
  the celebration panel (the surviving mode armed at the same seam), and `test-cs030-p4` §G's gameover
  byte-identity pin became a "every surviving parent line, in order, and nothing added" pin — a
  byte-identity claim cannot survive an instructed deletion that re-indents the block.
- **`openAchReset()` (P6) and `openScoresReset()` (P7) are near-identical two-stage openers.**
  P7 deliberately did NOT extract the shared opener: the phase prompt's DO NOT list says achievements
  are P6's, and CLAUDE.md rule 7 says propose a refactor rather than take it. The one thing that could
  really drift — the typed word, its heading and its error message — is already shared
  (`ACH_RESET_WORD`/`_TITLE`/`_ERR`), so what is duplicated is the five-line openModal→openNameEntry
  chain. **Proposed:** extract `openTypedReset(prompt, verb, back, backIndex, onReset)` and rename those
  three consts to `CONFIRM_RESET_*` (their `ACH_` prefix is now historical — they serve both flows).
  Costs three identifier updates in `test-cs034-p6.js`.
- **`blankLegacyStores()` calls `Achievements.save()` unguarded — the same latent hole CS034 P6's reset
  had to design around, and it is NOT fixed this changeset** (spec §5.2). `save()` early-returns on
  `game.debugRun || game.resumedRun`, so a call made during a resumed run clears memory and never
  persists. Harmless today for the same structural reason the new reset is safe: `blankLegacyStores()`
  is only reachable from profile delete, which is title-only, where neither flag can be set. **A future
  changeset that makes the profiles screen — or the achievements viewer — reachable mid-run must fix
  both, not one.** Recorded, deliberately unfixed.
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

- **⚠ FLAG-CS034-b (GATE B) — the browsable High Scores screen dropped to `HS_TABLE_SCALE` 1.4.**
  Eight columns (`# NAME SCORE LEVEL TIME DEBRIS SAUCERS SATELLITES`) do not fit 1000 px at the shipped
  1.8, and that const's header warns its offsets are hand-computed for whatever scale it holds. Shipped
  as the spec's own best guess: 1.4, with every column offset, the clip band, the reset row and the
  footer re-derived by hand. **Does 1.4 read too small in the browser?** The alternative is widening the
  panel past 1000×560, which would stop it reading as the leaderboard screen's sibling. Worth looking at
  in the same pass: the ~11-of-25 visible rows and whether the ▲/▼ cues are enough to advertise the
  scroll; the `NO SCORES YET` empty state under THIS PROFILE on a fresh profile; and whether ranks
  numbered 1..n *within* the filtered view (rather than their place in the shared table) read right.
  **Second, same screen:** ENTER now raises the erase confirmation instead of returning — the same
  change FLAG-CS034-a made on the Achievements viewer, and it has the same shipped-muscle-memory cost.
  `HS_HINT` is the only warning. If one of the two screens should keep ENTER-to-return, they should
  probably both keep it.
- **⚠ FLAG-CS034-a (GATE B) — ENTER no longer leaves the Achievements viewer.** `menuAchievements()`
  handled `confirm` and `back` in one shared branch from CS012 P4 until CS034 P6; both left the screen,
  so ENTER-to-return is shipped muscle memory. The screen has **no row cursor** (up/down are a
  continuous scroll), so rather than invent one, `confirm` became the reset verb and acts on whichever
  pool the active tab shows. `ACH_HINT` was rewritten in the same edit — it is the only warning a
  returning player gets. **Does ENTER-resets-the-shown-tab read right in the browser, or does it want a
  real cursor / a different key?** Also worth a look at the gate: the new reset row's placement
  (`ACH_RESET_Y` 616, 18 px) now that the row region lost 48 px (`ACH_ROW_CLIP_BOTTOM` 620 → 572), and
  whether the two-stage confirmation reads as deliberate rather than tedious.
  **One consequence to look at specifically:** leaving the typed field — committed or cancelled — goes
  back through `gotoScreen("achievements")`, which resets the tab to Weekly by the standing CS016 P5
  rule. So resetting Lifetime returns the player to the *Weekly* tab, where nothing visibly changed.
  Not fixed here (that rule is deliberate and shipped); if it reads as "did that work?", the fix is a
  return-to-tab argument, which is a design call.

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
