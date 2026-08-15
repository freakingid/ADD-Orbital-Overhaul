# Orbital Overhaul — STATUS
Version: 1.0.0.32 · Changeset: CS033 · Phase: P2 (no closing phase run) · Registry: 87 · Levers: 18

## Phase ledger — CS033

- **CS033 was run off-cycle, directly from a chat prompt — no `PLANNED-FEATURES-CS033.md` /
  `IMPLEMENTATION-PHASES-CS033.md` exists.** Judgment calls that would normally be settled by a plan
  doc are instead recorded in `DECISIONS.md`. Only P1 and P2 (as the prompt itself named them) ran;
  there was no closing phase, so the version was **not** bumped and this changeset is not closed.
- P1 — `player_id`: a `crypto.randomUUID()` field on each `Profiles` roster entry, minted once on
  first activation (never at `add()`), never regenerated, backfilled lazily for profiles that
  predate it. Never displayed; `display_name` stays the existing `name` field.
- P2 — `lib/kit-leaderboard.js` (coinless-kit v0.1.0) integrated: an ES-module bridge
  (`EXTERNAL-FILES.md` rule 1 exception, confirmed with Paul), `beginRun()`/`submit()` wired at run
  start and at both real outcomes (`died` at the death seam, `quit` from a live run only —
  `completed` has no call site, see `DECISIONS.md`), a "Leaderboard" title-menu board screen
  (`fetchBoard()`, flagged-entry marker, time-window cycling), `NAME_CHANGE_NOTICE` gating the
  profile rename flow, and a queue-pending indicator on the title screen. The local High Scores
  table is untouched and has no network dependency either way.

## Working / verified

- Full suite on a full clone: **129 files, 129 passed, 0 failed, 0 skipped, 0 timed out.** (127 →
  129: `test-cs033-p1.js` and `test-cs033-p2.js`, both new this changeset.)
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
- **Not yet verified in a live browser.** Every check above is headless (Node, module-tag
  unevaluated). The board screen's layout/columns, the two-line modal's rendering, and the ES-module
  bridge actually loading over a real local server have not been visually confirmed. See Playtest
  asks below.

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

- **CS033 has no closing phase yet.** If it continues: a version bump, a browser playtest (see
  below), and — since this ran off-cycle — deciding whether to author
  `PLANNED-FEATURES-CS033.md`/`IMPLEMENTATION-PHASES-CS033.md` retroactively so the changeset has a
  normal record, or fold it into `log/CS033.md` directly from `DECISIONS.md` + this file.
- **The real Worker `statsFields` list for `orbital-overhaul` is not visible from this repo.**
  `Leaderboard.submit()` sends only `wave_reached`/`canisters_delivered` (the two names the module's
  own doc uses in its worked example for this game). Non-blocking — a mismatch only sets a flag,
  never a rejection — but if Paul has the real field list, extending the `stats` object is a
  one-line change. See `DECISIONS.md`.
- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions**
  instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies**
  could migrate to `execSource()` whenever one of them is next open for other reasons.

## Playtest asks (open only — answered ones move to the log)

- **CS033 P2 has not been exercised in a real browser.** Specifically: the board screen's layout at
  1000×560 (does the 5-column table read cleanly at `scale = 1.5`?), the two-line
  `NAME_CHANGE_NOTICE` modal's sizing (the new `MODAL_LINE_PITCH` math), the "⚑" flagged-entry glyph
  rendering in a real canvas monospace font, and — most load-bearing — that the ES-module bridge
  actually loads `window.KitLeaderboard` over a real local server (`python -m http.server` /
  `npx serve`) and that the game still opens cleanly via plain `file://` double-click with the
  module absent. All of this is headless-verified only (`test-cs033-p2.js`); none of it is
  browser-verified.

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
