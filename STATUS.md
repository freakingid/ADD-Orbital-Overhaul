# Orbital Overhaul — STATUS
Version: 1.0.0.31 · Changeset: CS032 · Phase: P2 · Registry: 87 · Levers: 18

## Phase ledger — CS032

- P1 — `SaveSlots` store (`afd_saves_v1`, per-profile via `Profiles.keyFor()`, lazy, guarded
  read/write/clear/count with a boolean `write()`) + pure `buildSaveEntry()` reading live `game`
  state. No restore logic, no menu wiring, no `game.resumedRun` — P2/P3/P4's territory.

- P2 — `resumeFromSave()` + the sticky `game.resumedRun`. `startGame()`'s whole body was **extracted
  verbatim** into a new shared `resetRun(wave, debugRun)`; `startGame()` is now `resetRun(startLevel-1,
  startLevel>1)` + `nextWave()`, and `resumeFromSave()` is its sibling — same reset, then the
  save-moment overwrite, then `resumedRun = true`, then `nextWave()`. The two seeds became parameters
  because the reset reads `game.wave` (`saucerTimer`'s `ufoAppearInterval()` seed) before it returns.
  `resumedRun` is declared in the `game` literal and cleared in `resetRun()` (both-places rule), set
  true at exactly one site, cleared at exactly one; it ORs into `Achievements.save()` and the
  initials-entry arm, and draws `"RESUMED RUN"` as an `else if` under `"DEBUG RUN"`. Restore is
  known-value-else-default (type-matched, over the fresh defaults) and deep-copies `stats`/`powerUsed`
  so a resumed run can never write back through into the slot it came from — the mirror of
  `buildSaveEntry()`'s own copy rule. No menu wiring; `resumeFromSave()` has no caller until P3.

CS031 is closed; see `log/CS031.md` for its full P1–P7 build log. Player Profiles: a named roster
layered over the three existing `localStorage` stores (`afd_settings_v1`, `afd_achievements_v2`,
`afd_scores_v1`), plus `afd_profiles_v1`.

## Working / verified

- Full suite on a full clone: **124 files, 124 passed, 0 failed, 0 skipped, 0 timed out.**
- **One reset list, textually pinned:** `game.debris = [];` occurs exactly once in the whole build
  (`test-cs032-p2.js` §M). A resumed run and a fresh run at the same level agree on `cargoMax`,
  `worldSize`, live world dimensions and `hudHull`, checked at level 3 (small world) and level 9.
- **Every P2 invariant was mutation-tested, not just asserted.** Six deliberate breaks — dropping
  either persistence clause, dropping the `hudHull` follow-up, dropping the HUD `else if`, calling
  `nextWave()` before the restore, and moving the `resumedRun = true` below `nextWave()` — each
  produced a failure in the sections meant to catch it. No pin passed vacuously.
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

- **CS032 P2 repointed `test-cs026-p3.js`'s §G TRAP 5 byte-identity pin** — same category, same
  standing rule. That pin compared `startGame()`'s executable source against CS026 P3's parent; the
  reset list moved, unedited, into `resetRun()`, so the pin is re-aimed at the function that now holds
  it, with the signature and the two parameterised seeds folded back by name and `nextWave()`
  re-appended. It is the fourth narrowing of that pin (CS029 P4 / CS030 P1 / CS031 P3 before it) and
  the first to move it. `test-cs032-p2.js` §M carries the compensating half: `startGame()`'s new
  two-line body is pinned literally, so the folds cannot hide an edit to what they fold.

- **`test-cs030-p1.js` §A reads a fixed 3000-CHARACTER window** from `function startGame()` to find
  `game.pendingAch = []` / `game.celebration = null`. Those now sit at +2102 / +2187 — inside, with
  ~800 characters of headroom against ~1500 before P2. It bit once during this phase and the fix was
  to move prose above `function startGame()` rather than repoint a green test. ⛔ **A future phase
  that adds comment bulk to the section header, `startGame()` or the top of `resetRun()` will fail
  §A**; the honest repoint, when someone is in that file anyway, is to slice `resetRun()`'s real body
  instead of counting characters.

- **CS032 P2 repointed the build's "declared in BOTH this literal and `startGame()`'s reset" comments
  at `resetRun()`** — seven of them, plus the `DebugPanel` note that cites the same standing rule.
  ⛔ **One was deliberately left saying `startGame()`:** the `powerBudget`/`powerBank` note that reads
  *"Keep these in step with `POWERUP_DROP_TYPES` and with `startGame()`'s resets below"*. Rewording it
  produces a diff line mentioning `POWERUP_DROP_TYPES`, which `test-cs024-p6b.js` §G TRAP 5 pins
  against — a comment nicety is not worth repointing that pin. The tombstone at `orbitLayout`
  (*"was never in `startGame()`'s reset"*) is also left as written: it is a true statement about the
  pre-CS024 build.

## Open questions (blocking)

None.

## Next up

- **CS032 P3 — the slots screen.** Sonnet. `resumeFromSave(entry)` is live and fully tested but has
  **no caller** — P3's `"load"` confirm is its first. It takes a slot's contents exactly as
  `SaveSlots.read()` hands them back and needs no pre-validation: it is written for untrusted JSON
  (every field falls back to the fresh-run default). It sets `game.state = "playing"` and clears
  `game.menu` itself, so P3's load path does not have to. `MENU_ROOT_PLAY`, `MENU_TITLE`,
  `menuRoot()`, `drawRootMenu()` and `nextWave()` remain untouched through P2 — confirmed.

- **⛔ P7 doc sweep — the GDD names `startGame()` as the site of the reset list in ~4 places** (the
  level-banner clear at §2, the world-resize contract, `game.worldSize`'s both-places note). The
  *orderings* those passages assert are all still true; the function name moved to `resetRun()`.
  Out of P2's scope pin (the GDD is not on the allowlist), so it is recorded here rather than swept.
  GDD §3's Flow section also needs `resetRun` / `resumeFromSave` added to its function list.
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
