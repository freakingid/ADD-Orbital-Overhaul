# Orbital Overhaul — STATUS
Version: 1.0.0.31 · Changeset: CS032 · Phase: P1 · Registry: 87 · Levers: 18

## Phase ledger — CS032

- P1 — `SaveSlots` store (`afd_saves_v1`, per-profile via `Profiles.keyFor()`, lazy, guarded
  read/write/clear/count with a boolean `write()`) + pure `buildSaveEntry()` reading live `game`
  state. No restore logic, no menu wiring, no `game.resumedRun` — P2/P3/P4's territory.

CS031 is closed; see `log/CS031.md` for its full P1–P7 build log. Player Profiles: a named roster
layered over the three existing `localStorage` stores (`afd_settings_v1`, `afd_achievements_v2`,
`afd_scores_v1`), plus `afd_profiles_v1`.

## Working / verified

- Full suite on a full clone: **123 files, 123 passed, 0 failed, 0 skipped, 0 timed out.**
- Registry confirmed at **87**, `LEVERS` at **18** — unmoved this changeset.
- `SaveSlots` is lazy (no boot-time read) and routes both its read and write through
  `Profiles.keyFor(SAVES_KEY)`, per-profile, exactly like Achievements' own store.
- `buildSaveEntry()` deep-copies `game.stats.powerUsed` (nested) and shallow-copies `game.powerBudget`
  (flat) — verified non-aliasing: mutating the live run after capture does not move the entry.
- An envelope holding a slot with an unrecognised `kind` (e.g. `"snapshot"`) is handed back as data,
  not coerced to `null` — SaveSlots validates the envelope (`v`, array-ness, length 3), never a
  slot's own contents; that's the slots screen's (P3) job.
- `keyFor()` is the one route from a store's base name to the key it reads/writes; `localStorage`
  is never enumerated anywhere in the build.
- `p0`'s stores ARE the three pre-CS031 frozen keys, verbatim — the legacy migration copies, moves
  and rewrites nothing.
- `Profiles.activate(id)` resets the runtime to shipped defaults before loading the incoming
  profile; nothing in the reset step writes to storage.

## Known issues

- **FLAG-CS031-c — `test-f2.js` flakes ~3% of runs** (CS030's celebration-panel `game.celebration`
  leaking across sections in `resetShip()`; pre-existing, not this changeset's). One-line fix
  identified: `game.celebration = null;` in `resetShip()`. 29 suite files reach a death/gameover
  and never mention `game.celebration` — the class is latent beyond `test-f2`. See `log/CS031.md`.
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
- **CS032 P1 repointed `test-cs024-p6b.js`'s TRAP 5 fixed-ref diff pin** — `powerBudget` left the
  "no diff line touches this symbol" list, same precedent already applied there to
  `engineBurnSeconds` (CS024 P7) and `powerActive` (CS025 P1): `buildSaveEntry()` legitimately adds
  a new READER (`{ ...game.powerBudget }`) without touching the store's declaration or any existing
  consumer. Flagged here because it's a one-line edit outside CS032's own file, made under the
  standing "may not leave the suite redder than it found it" rule rather than CS032's own scope.

## Open questions (blocking)

None.

## Next up

- **CS032 P2 — `resumeFromSave()` + `resumedRun`.** Opus, xhigh, `ultrathink` per the phase doc —
  the restore-ordering invariant (`game.stats` before `nextWave()`) and the new sticky
  `game.resumedRun` eligibility flag. `MENU_ROOT_PLAY`'s `"Save"` row and its unavailable-row idiom,
  `menuRoot()`'s dispatch, `drawRootMenu()`'s forced `COLOR.dim` branch, `startGame()`, and
  `nextWave()` are all still exactly as they were before CS032 P1 — confirmed untouched this phase.
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
