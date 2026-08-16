# Orbital Overhaul — STATUS
Version: 1.0.0.34 · Changeset: CS034 · Phase: P9 · Registry: 91 · Levers: 18

## Phase ledger — CS034

- CS034 is closed. See `log/CS034.md` for the full P1–P9 build log and the GDD version-history
  entry. Vocabulary glossary (four canonical terms, the build's deliberate code-name inversion
  documented but not touched), Hunter Debris yield halved at the large/medium tiers, a leaderboard
  stats-key fix (every public score since CS033 P3 had been showing flagged), a level-end
  celebration header, a two-stage achievement/high-score reset flow, the 3-slot initials entry
  deleted outright in favor of a single `makeRunResult()` seam, and a delivery-ticker readability
  pass (GATE A tuned the size/hold/fade/anchor values; Gate B, this closing phase, brightened the
  incidental-delivery floater to match and declined a second requested change — moving the ticker's
  anchor to the ship — as a repeat of a CS029 experiment already measured and reverted). P9 applied
  that one Gate B fix, corrected three stale docs, bumped the version, and archived both of CS034's
  planning docs.

## Working / verified

- Full suite on a full clone: **137 files, 137 passed, 0 failed, 0 skipped, 0 timed out.**
- Registry confirmed at **91**, `LEVERS` at **18** — unmoved since P8's own bump from 87.
- The leaderboard stats-key fix (P4) confirmed live: a real posted score's row showed no ⚑ flag
  (Gate B, B18).
- The incidental (non-chain) delivery floater now reads `COLOR.dock`, matching the towed ticker's
  brightness; size (12, vs. the ticker's grown 18–36) is the one remaining thing distinguishing it.

## Known issues

- **Delivery-ticker origin — Gate B asked for a ship-relative anchor; not built.** CS026 P6 already
  tried this and CS029 reverted it, measured: "a ship-relative origin smears the delivery column as
  the ship drifts DURING a visit." Paul confirmed keeping the dock anchor this session rather than
  re-attempt a change already tried and found worse, deferring a real ship-anchor attempt to a
  future changeset with its own gate/playtest. See `log/CS034.md` (P9).
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
- **Thirteen suite files hard-fail, not skip, on a shallow clone (measured fresh, CS034 P9;
  corrects a stale "ten" carried since CS026).** `test-cs017-p6`, `test-cs019-p1`, `test-cs020-p1`,
  `test-cs020-p1b`, `test-cs023-p2`, `test-cs023-p3`, `test-cs024-p1`, `test-cs024-p2`,
  `test-cs024-p4`, `test-cs024-p6b`, `test-cs024-p6f`, `test-cs026-p1`, `test-cs029-p1`. Mechanical
  fix, same shape as CS026 P1/P2's conversions. See `log/CS026.md`, `log/CS034.md`.
- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (from
  CS023).** Both are live in the game today; no gate since has asked about them. See `log/CS023.md`.
- **The milestone floaters overlap the delivery ticker at the shipped CS034 values — confirmed
  acceptable (Gate B, B4: "overlapping (fine)").** Not a defect; Paul's explicit call.
- **P6's `blankLegacyStores()` calls `Achievements.save()` unguarded** — the same latent hole P6's
  own achievement reset had to design around. Harmless today: only reachable from profile delete
  (title-only, where neither `debugRun` nor `resumedRun` can be set). A future changeset that makes
  the profiles or achievements screen reachable mid-run must fix both, not just the reset. See
  `log/CS034.md`.

## Open questions (blocking)

None.

## Next up

- **No changeset planned yet.** CS034 closed with no `PLANNED-FEATURES-CS035.md` in flight.
- **Delivery-ticker ship-anchor (Gate B, deferred) — wants its own gate/playtest**, not a
  closing-phase guess, given CS029 already measured the naive version as worse. See "Known issues."
- **Celebration header treatment (Gate B, B8) — reads clearly enough to ship, but the abrupt
  full-stop-of-action when the panel opens still feels jarring.** Paul flagged wanting a different
  treatment "later" — not a defect, a future design idea. See `log/CS034.md`.
- **FLAG-CS034-e — `debrisBounceRestitution`'s canonical-vocabulary label still doesn't fit the
  debug panel's 32-char column** ("Garbage Satellite bounce restitution" is 36 chars; shipped as the
  unchanged "Satellite bounce restitution"). Needs either a shorter canonical-reading label or a
  column-width change — a gate question or a small dedicated phase, not folded into this closing
  phase. See `log/CS034.md` (P2).
- **Deferred to `coinless-kit`, not this repo** — `game_version` in the board SELECT, a per-player
  query, and client-module support for both, ahead of a future GAME changeset that renders a Version
  column and a worldwide/just-me scope toggle. Full shape recorded in `log/CS034.md`.
- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions**
  instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies**
  could migrate to `execSource()` whenever one of them is next open for other reasons.

## Playtest asks (open only — answered ones move to the log)

None open. Gate B's full set of answers (B1–B19) is recorded in `log/CS034.md` (P9).

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
- **Hunter Debris supply halved (from CS034 P3), confirmed right-sized at a wave-12 playtest (Gate
  B, B5–B7).** `HUNTER_GARBAGE` large/medium tiers dropped to 0; a full lineage now yields 9 pieces,
  down from 18. Delivery-combo achievements (`heavy_hauler` at 12, `max_haul` at `CARGO_CAP_MAX` 24)
  stayed reachable at that wave. Not verified past wave 12 — a much later, hunter-lineage-saturated
  wave could still read differently; no further action unless it's reported.
