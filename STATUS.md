# Orbital Overhaul — STATUS
Version: 1.0.0.30 · Changeset: CS030 · Phase: CLOSED · Registry: 87 · Levers: 18

## Phase ledger — CS030

- CS030 (P1–P7) shipped the achievement celebration panel — collector, eight-emblem lab/table,
  overlay panel with scroll, two call sites (game over + level end), a playtest gate, and this
  close. Full narrative: `log/CS030.md`.

## Working / verified

- Full suite on a full clone: **117 files, 117 passed, 0 failed, 0 skipped, 0 timed out.**
- Registry confirmed at **87**, `LEVERS` at **18** — unmoved since CS030 P3.

## Known issues

- **FLAG-CS030-c — two resume details for the level-end panel.** (1) The fanfare plays over live,
  un-ducked gameplay music at the level-end call site (the panel is deliberately not a menu). (2) A
  key/pad-button HELD at dismissal resumes as thrust/fire — unchanged input semantics, recorded
  because the P6 gate asked specifically about resume fairness. Both accepted at the gate.
- **FLAG-CS030-b — the gamepad's Start is swallowed while the panel is up, and dismissal is
  silent** (no `AudioSys.ui()` blip; the phase prompt sanctioned exactly one audio touch, the open
  fanfare). Mirrors the initials-entry block's own "nothing interrupts this" convention.
- **FLAG-CS030-a — `COLOR.ach` is byte-identical to `TIER_COLOR[2]` (Gold).** The two pool emblems
  and the Gold tier emblem ship in the same colour; shape carries the whole "not a tier rung"
  distinction. Confirmed readable at the P6 gate (G4), but a one-channel tell worth a future look.
- **`test-registry.js`'s FLAG-CS027-d — twelve suite files grep a comment-stripped copy of the
  source missing the same 80 lines `execSource()` fixed.** Latent, not live. One-line-per-file fix
  (`execSource()`); bundle with an opportunistic migration.
- **Piece-distinctness concern, deliberately unresolved (CS028).** Hubble's pieces 1/2 and
  Skylab's 0/2 share a polyline vertex-count signature; Juno's folded blade is a third member.
  Paul's gate call: leave as is. A real fix is new art authoring, its own changeset.
- **Ten suite files still hard-fail, not skip, on a shallow clone (from CS026)** — measured:
  `git clone --depth 1` runs 101 files, 91 passing, 10 failing. Each reaches for a reference/parent
  commit and throws instead of skipping. Mechanical fix, same shape as CS026 P1/P2's conversions.
  See `log/CS026.md`.
- **The three `localStorage` keys have never been round-tripped in a real browser (from CS026)** —
  one manual set-reload-confirm at a gate would close it; the failure mode if wrong is silent and
  total. See `log/CS026.md` §11 backlog.
- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (from
  CS023).** Both are live in the game today; no gate since has asked about them. See `log/CS023.md`.
- **The milestone floaters can still touch the dock anchor at the picked gate value (from
  CS029).** `SALVAGE BONUS`/`MAX HAUL` measured at 0.0px clearance from the delivery ticker at
  `anchorFrac` 0.50 — zero crossing, but no air either. Paul picked 0.50 anyway; recorded so a
  future "looks like it's touching" report is recognised as this, not a new regression.

## Open questions (blocking)

None.

## Next up

- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions**
  instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies**
  could migrate to `execSource()` whenever one of them is next open for other reasons.
- CS030 is closed. Nothing in flight — next changeset is genuinely open.

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
