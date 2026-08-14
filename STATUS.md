# Orbital Overhaul — STATUS
Version: 1.0.0.32 · Changeset: CS032 · Phase: CLOSED · Registry: 87 · Levers: 18

## Phase ledger — CS032

- CS032 is closed. See `log/CS032.md` for the full P1–P7 build log and the GDD version-history
  entry. Save Game / Load Saved Game / three save slots: a new `afd_saves_v1` key (per-profile via
  `Profiles.keyFor()`, lazy), save-moment capture (`buildSaveEntry()`), a shared `resetRun()`
  extracted out of `startGame()`'s old body so `resumeFromSave()` never hand-copies the reset, and
  the new sticky `game.resumedRun` flag that permanently bars a resumed run from the high-score
  table and from persisting achievement/lifetime-stat writes — the mechanism that makes save-moment
  values safe to ship. P6's playtest gate came back clean on all eleven questions, including the
  gate's real question (G4 — the tag and the eligibility block both held through a full resumed run
  to game over), so P7 applied zero code changes for gate answers and moved straight to
  documentation and the version bump.

## Working / verified

- Full suite on a full clone: **127 files, 127 passed, 0 failed, 0 skipped, 0 timed out.**
- Registry confirmed at **87**, `LEVERS` at **18** — unmoved this changeset.
- `SaveSlots` is lazy (no boot-time read) and routes both its read and write through
  `Profiles.keyFor(SAVES_KEY)`, per-profile, exactly like `Achievements`' own store.
- `resetRun()` is the one reset list both `startGame()` and `resumeFromSave()` share — no
  hand-copied second reset exists anywhere in the build.
- `game.resumedRun` is declared in both the `game` literal and `resetRun()` (the standing
  both-places rule), set `true` at exactly one site, and cleared nowhere until the next
  `resetRun()`.

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

- **No changeset planned yet.** CS032 closed with no `PLANNED-FEATURES-CS033.md` in flight.
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
