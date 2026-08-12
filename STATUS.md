# Orbital Overhaul — STATUS
Version: 1.0.0.29 · Changeset: CS030 · Phase: P1 · Registry: 85 · Levers: 18

## Phase ledger — CS030

- P1 — the achievement unlock collector: `game.pendingAch` (flushed bucket, `{ id, name, desc,
  tierIdx, pool }` per unlock) + `game.celebration` (`null`, reserved for the panel a later phase
  builds). Fed from `onUnlock()`, the single unlock choke point — not gated on `game.debugRun`,
  not filtered by `game.wave` (PLANNED-FEATURES-CS030.md §0.3/§0.4). Data only; no UI/draw/input.

## Working / verified

- Full suite on a full clone: **114 files, 114 passed, 0 failed, 0 skipped, 0 timed out.**
- Registry confirmed at **85**, `LEVERS` at **18** — P1 added no knob and moved no lever.
- `test-cs026-p3.js`'s TRAP 5 byte-identity pin (startGame()'s executable source vs. its CS026 P3
  parent) narrowed a second time, to also exclude P1's two new reset lines
  (`game.pendingAch = []`, `game.celebration = null`) — same treatment CS029 P4 already used for
  `game.deliveryTicker = null`.

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
- CS030 in flight (the achievement celebration panel). P1 (this session) built the collector only.
  Remaining phases per `IMPLEMENTATION-PHASES-CS030.md`: the emblem table/lab (§4.2), the panel
  itself (draw/state/scroll/input, §4.3), and the game-over + level-end integration points (§4.4).

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
