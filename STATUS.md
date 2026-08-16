# Orbital Overhaul — STATUS
Version: 1.0.0.33 · Changeset: CS033 (closed) · Phase: P5 (closing) · Registry: 87 · Levers: 18

## Phase ledger — CS033

- **CS033 was run off-cycle, directly from chat prompts — no `PLANNED-FEATURES-CS033.md` /
  `IMPLEMENTATION-PHASES-CS033.md` exists, and none will be authored retroactively.** Judgment calls
  that would normally be settled by a plan doc were instead recorded live in `DECISIONS.md`, then
  retired into `log/CS033.md` at P4. Full P1–P5 record: `log/CS033.md`.
- P1 — `player_id`: a `crypto.randomUUID()` field on each `Profiles` roster entry, minted once on
  first activation (never at `add()`), never regenerated, backfilled lazily for profiles that
  predate it. Never displayed; `display_name` stays the existing `name` field.
- P2 — `lib/kit-leaderboard.js` (coinless-kit v0.1.0) integrated: an ES-module bridge
  (`EXTERNAL-FILES.md` rule 1 exception, confirmed with Paul), `beginRun()`/`submit()` wired at run
  start and at both real outcomes (`died` at the death seam, `quit` from a live run only —
  `completed` has no call site, see `log/CS033.md`), a "Leaderboard" title-menu board screen
  (`fetchBoard()`, flagged-entry marker, time-window cycling), `NAME_CHANGE_NOTICE` gating the
  profile rename flow, and a queue-pending indicator on the title screen. The local High Scores
  table is untouched and has no network dependency either way.
- P3 — per-game saucer counter (`game.stats.saucerKills`, both sizes, distinct from
  `smallSaucerKills`/`Achievements.lifetime.saucerKills`) plus a `garbage_satellite_kills` key off
  the pre-existing `debrisKills` counter, extending `Leaderboard.submit()`'s `stats` payload to four
  keys. The two new keys are best-guess names against the Worker's real `statsFields` registry,
  which isn't visible from this repo — cosmetic risk only, per the module's own mismatch contract.
- P4 — off-cycle decision entries retired from `DECISIONS.md` into `log/CS033.md`; confirmed no
  retroactive planning docs would be authored for this changeset.
- P5 — closing phase: version bump to 1.0.0.33, CLAUDE.md's `stats`-keys invariant corrected to the
  real four-key set (was stale after P3), 13/13 browser-QA items confirmed by Paul, CS032's spent
  planning docs archived. Zero game-logic changes.

## Working / verified

- Full suite on a full clone: **130 files, 130 passed, 0 failed, 0 skipped, 0 timed out.** (129 →
  130: `test-cs033-p3.js`, new this phase.)
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
