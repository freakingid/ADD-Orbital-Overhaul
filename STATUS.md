# Orbital Overhaul — STATUS
Version: 1.0.0.29 · Changeset: CS029 (closed) · Phase: — · Registry: 85 · Levers: 18

## Phase ledger — CS029

- P1 — renamed `asteroids-deluxe.html` -> `orbital-overhaul.html` (`git mv`); no behaviour change.
- P2 — ESC now opens the pause menu at game over; the game-over footer collapsed to one
  `drawMenuHint` line at `GAMEOVER_HINT_SIZE` (20, gate G6).
- P3 — `tools/dock-float-lab.html`: the delivery-floater column lab, models A/B/C.
- P4 — model C shipped: delivery floaters move to a static dock anchor; the towed branch
  collapses to one per-visit accumulating ticker.
- P5 — closing phase: canonical name "Orbital Overhaul" settled across every live doc, version
  bumped to 1.0.0.29, GDD §2.10 rewritten for model C, both planning docs archived. See
  `log/CS029.md` for the full narrative, including the CS026-P6-misinterpretation story.

## Working / verified

- Full suite on a full clone: **113 files, 113 passed, 0 failed, 0 skipped, 0 timed out.**
- Registry confirmed at **85**, `LEVERS` at **18** — CS029 added no knob and moved no lever.
- CS029 closed. See `log/CS029.md` for phase-by-phase detail.

## Known issues

- **(carried) `test-registry.js`'s FLAG-CS027-d — twelve suite files grep a comment-stripped copy
  of the source that's missing the same 80 lines `execSource()` fixed.** Latent, not live:
  audited, no assertion any of them makes currently falls in the deleted region. Becomes live the
  moment one does. One-line-per-file fix (`execSource()`); not urgent, bundle with an
  opportunistic migration.
- **(carried) Piece-distinctness concern, deliberately unresolved.** Hubble's pieces 1/2 and
  Skylab's 0/2 share a polyline vertex-count signature; Juno's folded blade is a third member of
  that family. Paul's gate call (CS028): leave as is. Any real fix is new art authoring — its own
  changeset, not a routine edit.
- **(carried from CS026) Ten suite files still hard-fail, not skip, on a shallow clone** —
  measured: `git clone --depth 1` runs 101 files, 91 passing, 10 failing (`test-cs017-p6.js`,
  `test-cs019-p1.js`, `test-cs020-p1.js`, `test-cs020-p1b.js`, `test-cs023-p2.js`,
  `test-cs023-p3.js`, `test-cs024-p1.js`, `test-cs024-p2.js`, `test-cs024-p4.js`,
  `test-cs024-p6b.js`). Each reaches for a reference/parent commit and throws instead of skipping.
  Mechanical fix, same shape as the files already converted in CS026 P1/P2. See `log/CS026.md`.
- **(carried from CS026) The three `localStorage` keys (`afd_settings_v1`, `afd_achievements_v2`,
  `afd_scores_v1`) have never been round-tripped in a real browser** — one manual set-reload-confirm
  at a gate would close it; the failure mode if wrong is silent and total. See `log/CS026.md` §11
  backlog.
- **(carried from CS023, dropped rather than resolved) Satellite-vs-satellite elastic bounce
  (CS023 P2) and mutual collision damage (CS023 P3) were never playtested.** `debrisBounce()` and
  the mutual-damage rule are live in the game today; no gate since has asked about them. See
  `log/CS023.md`.
- **(carried, applied not resolved) FLAG-CS029-e — the milestone floaters can still touch the
  dock anchor at the picked G2.** `SALVAGE BONUS` / `MAX HAUL` climb from `dock.y - 22` on
  `FloatText`'s defaults and top out at `dock.y - 55`. At the gate's G2 = 0.50, the lab measured
  model C's own all-floaters minimum separation at **0.0px** — zero clearance, not a crossing, but
  no air either. Paul picked 0.50 anyway; not re-litigated at the gate. Recorded so a future
  "SALVAGE BONUS looks like it's touching the ticker" report is recognised as this, not a new
  regression.

## Open questions (blocking)

None.

## Next up

- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions**
  (`2560`/`1440`/`1920`/`1080`) instead of reading `worldDims(X)` from `_harness.js`. See
  `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies**
  (see `## Known issues`) could migrate to `execSource()` whenever one of them is next open for
  other reasons.
- No changeset currently in flight. Next session picks up wherever Paul points it — profiles,
  save/load, online leaderboards, and the achievement celebration panel (CS030–033) are previewed
  in `archive/PLANNED-FEATURES-CS029.md` §10 but not yet scoped as their own changeset.

## Playtest asks (open only — answered ones move to the log)

None open.

## Balance notes

- **(carried from CS026) `COMBO n/N`'s denominator is still unrepresented** since CS026 P4 dropped
  the HUD row (FORK-CS026-F, accepted risk). Recorded so a future "the cargo cap is invisible"
  report is recognised as this, not a new bug.
- **(carried from CS024/CS025) The UFO difficulty chain goes fully flat past level 65**
  (FLAG-CS025-b) — junk saturates at L41, hunters at L33, so past 65 all three UFO sub-chains are
  pure sawtooth on their drivers with nothing escalating underneath. Fix if wanted is a step-count
  increase, no mechanism change.
- **(carried from CS023) `DEBRIS_BOUNCE_RESTITUTION` (1.0) and `DEBRIS_BOUNCE_MIN` (40 px/s) are
  both first-pass and browser-unverified**, same status as `SHIELD_BOUNCE_RESTITUTION`/`MIN` at
  CS021 P1b. Measured consequence: a rail satellite sweeping into a parked free one throws it up to
  511.5 px/s off the outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives
  from.
