# Orbital Overhaul — STATUS
Version: 1.0.0.31 · Changeset: CS032 · Phase: P5 · Registry: 87 · Levers: 18

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

- P3 — the `"slots"` screen: one screen, `game.menu.slotMode` = `"save"` | `"load"`, following
  `drawProfiles()`'s panel/row-step/prefix/footer idiom exactly. Row state is `empty` / `occupied` /
  `unreadable` (FORK-H: an unrecognised `kind`, or malformed data, reads as unreadable — never
  guessed at). Save on empty writes straight through (`buildSaveEntry()` + `SaveSlots.write()`); save
  on occupied/unreadable raises an `openModal()` overwrite confirm naming what's lost; a failed
  `write()` sets `game.menu.slotMsg` and the screen stays open (spec §4.4 — never reports success on
  failure). Load confirm on an occupied row calls `resumeFromSave()`, whose own `resetRun()` already
  clears the menu and lands `game.state = "playing"` — no extra teardown needed here. `slotMode` has
  no separate return-screen field: Back derives its destination FROM the mode itself (`"save"` → the
  paused root, `"load"` → the title), since those are the only two callers the spec allows (§0.2/§4.3)
  — a stored back/backIndex pair (nameCtx's own shape) would just duplicate what the mode already
  implies. `slotMode`/`slotMsg` follow the CS016 P3 both-places rule (game literal + `resetRun()`);
  `gotoScreen()` also unconditionally clears `slotMsg` on every screen change, the same treatment
  `achTab` already gets. Reachable only from the test harness this phase — `MENU_ROOT_PLAY`,
  `MENU_TITLE` and both menus' dispatch are untouched; P4 wires the two real callers.

- P4 — menu wiring. `"Save"`'s three-piece unavailable-row idiom unpicked in one commit: `menuRoot()`
  gained a `"Save"` branch (`slotMode = "save"` → `gotoScreen("slots")`) and `drawRootMenu()`'s
  `it === "Save" ? COLOR.dim` ternary was **deleted** — `MENU_ROOT_PLAY` itself is byte-identical, label
  and position both. `MENU_TITLE` gained `"Load Saved Game"` at index 1, beside `"Start Game"`; N went
  5 → 6 with **no** `TITLE_MENU_*` edit (Y unmoved at 324, step self-healed 33 → 26.4, pinned
  byte-identical against P3's SHA). The row is the idiom's new consumer: present, focusable, dim and
  inert at `SaveSlots.count() === 0`, asked fresh in `drawTitleMenu()` (draw time) and `menuTitle()`
  (confirm time), never cached. All four `unavailable-row idiom` citations repointed at
  `menuProfiles()`'s `Add Profile` cap, now the canonical example — including `menuDifficulty()`'s,
  which the prompt did not list. Six suite files repointed; `test-cs032-p4.js` mutation-tested eight
  ways.

- P5 — the purge. `removeProfileStores(id)` gained a third `ls.removeItem(SAVES_KEY + ":" + id)`
  beside the two existing removes. `blankLegacyStores()` clears `p0`'s three slots through
  `SaveSlots.clear(i)` — the guarded write path, never a raw `removeItem`, matching how its two
  sibling stores are reset-in-place. `Profiles.activate()` needed no change: `SaveSlots` is lazy and
  reads through `keyFor()` at call time, confirmed by test rather than inspection (write under
  profile A, switch to B, read empty, switch back, read A's write intact — no flush/reload).
  `quitToTitle()` is confirmed untouched: no `SaveSlots`/`buildSaveEntry` reference in its body, and
  a spied `SaveSlots.write` counts zero calls across a mid-run quit. `test-cs032-p5.js`: (A)
  non-legacy delete removes just that id's saves key, leaving siblings' intact; (B) `p0` delete
  blanks `p0`'s slots in both the p0-active and p0-not-active shapes; (C) deleting the ACTIVE
  profile hands `activeId` to the roster's next survivor (per `profileDelete()`'s own unreordered
  ordering) and purges only the deleted id's slots — the newly-active profile's own slot, written
  before the delete, reads back unchanged; (D) per-profile isolation across `activate()`; (E)
  `quitToTitle()` writes nothing. Full suite: **127 files, 127 passed, 0 failed, 0 skipped.**

CS031 is closed; see `log/CS031.md` for its full P1–P7 build log. Player Profiles: a named roster
layered over the three existing `localStorage` stores (`afd_settings_v1`, `afd_achievements_v2`,
`afd_scores_v1`), plus `afd_profiles_v1`.

## Working / verified

- Full suite on a full clone: **127 files, 127 passed, 0 failed, 0 skipped, 0 timed out.**
- **P5's mutation trap confirmed by reverting the code change:** on the pre-P5 build, `test-cs032-p5.js`
  fails 7 ways across §A/§B/§C (Ripley's/p0's saves keys survive a delete, the "deleted, not
  newly-active" isolation reads Ripley's own leftover data) and passes clean once the two removes
  land. No pin passed vacuously.
- **P4's pins were mutation-tested, not just asserted.** Eight deliberate breaks — restoring the
  forced-dim ternary, dropping `drawTitleMenu()`'s dim rule, dropping `menuTitle()`'s count guard,
  re-adding a stale `MENU_ROOT_PLAY's "Save"` citation, deleting the `menuRoot()` branch, adding
  `"Save"` to `MENU_ROOT_OVER`, hiding the Load row instead of dimming it, and hand-tuning
  `TITLE_MENU_STEP_MAX` — each failed in the section written to catch it. No pin passed vacuously.
  Restoring the ternary alone (the silent failure this phase exists for) fails §A four ways.
- **Title-menu layout at N=6** (the values the build's `TITLE_MENU_*` comment points here for):
  Y 324, step 26.4, last row 456 — 24px clear of the flavour line at 480. N=5 was Y 324 / step 33;
  N=4 is Y 324 / step 38 (the full `STEP_MAX`). Y is unmoved at every count because the block
  re-centres; only the step shrinks.
- Driven end-to-end through the real `draw()`: title → `"Load Saved Game"` → the slots screen renders
  its three rows with `game.paused` false, and Back returns to the title menu.
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
  slot's own contents; the slots screen (P3) is what renders that data as `unreadable`.
- P3's `menuSlots()`/`drawSlots()` drive the real `SaveSlots`/`buildSaveEntry()`/`resumeFromSave()` —
  nothing about a row's state or a write's success/failure is reimplemented in the test. The modal's
  CANCEL-safe default (index 1) is reused verbatim from profile Delete, not re-derived.
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

- **CS032 P3 repointed two more pins, same standing rule.** `test-cs026-p3.js`'s §G TRAP 5
  `foldMenuReset` regex now folds `slotMode`/`slotMsg` back too (the fifth narrowing of that pin) —
  anchored on both new field names by name, not loosened into a wildcard. `test-cs032-p1.js`'s §A
  "nothing calls `SaveSlots.read()`" pin was a P1-scoped textual proxy for a boot-time-laziness
  invariant, correct only because P1 truly had zero call sites; P3 gives it two real ones
  (`menuSlots()`/`drawSlots()`). Repointed to drive the actual invariant instead of the proxy: a
  `Proxy` `store` records every `afd_saves_v1*` key `buildGame()` alone touches, before any menu
  input runs — asserting laziness directly, so it stays correct through however many later phases
  add more (non-boot) callers.

- **CS032 P4 repointed SIX suite files, same standing "may not leave the suite redder" rule** — more
  than any earlier phase this changeset, because making a shipped row live and inserting a title row
  are both visible to tests that never mentioned CS032. All six are repoints, not loosenings; each
  says in place what changed and why. `test-cs016-p4.js` §A/§B is the load-bearing one: that phase
  BUILT the unavailable-row idiom and used `"Save"` as its demonstrator, so §B's "inert + always dim"
  pair is now false *of that row*. It was repointed in its new direction rather than deleted — the
  claims that survive (the cursor lands on it, passes through it) stay — and the idiom itself is still
  fully under test by that file's own §D–§G (the Difficulty mid-run lock) and `test-cs031-p4.js`'s
  `Add Profile` cap. Its §H smoke also gained a `back` after the Save confirm; without it the rest of
  that section would have driven `menuSlots()` by accident and quietly stopped smoking the Difficulty
  cycle it was written for. The other five: `test-cs010-p4.js`/`test-cs016-p2.js` §A (the `MENU_TITLE`
  literal, re-pinned at 6 rather than loosened), `test-cs016-p2.js` §K (step 33 → 26.4, and the row
  colour loop now asks the real `SaveSlots` whether the Load row should be dim), `test-cs013-p2.js` §C
  (the `"Save"` colour exception deleted), `test-f8.js` §A (the pause-root walk now backs out of the
  slots screen), and `test-cs031-p5.js` §A/§B (Profile is row 2 now, and its forecast N=6 is real).

- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame**, which is a
  `localStorage.getItem` + `JSON.parse` per title-screen frame at 60fps. This is what the spec asked
  for (§4.3: *"`drawTitleMenu()` asks `SaveSlots.count() === 0` at draw time"*, explicitly not cached,
  because a profile switch or delete changes the answer) and `drawSlots()` already reads per frame the
  same way, so it is deliberate, not an oversight. Recorded because it is the build's first
  **unconditional** per-frame storage read — it runs on the title screen whether or not the player
  ever opens a menu. If it ever measures, the fix is a cache invalidated at the three sites that can
  change the answer (profile activate, profile delete, slot write), not a moved question.

- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`, not on
  `"Load Saved Game"`.** `menuSlots()`'s back calls `returnToTitleMenu()`, which hardcodes
  `MENU_TITLE.indexOf("Options")` — correct for its other callers (menuOptions' Back, profile SWITCH),
  slightly off here: the player backs out of Load and the cursor has jumped four rows. Shipped in P3
  and untouched by P4, but P4 is what makes it player-reachable for the first time. Not fixed —
  changing it is a `returnToTitleMenu()` signature question, which is design, not wiring. Save mode is
  unaffected (it restores the cursor to `"Save"` correctly).

- **The P4 prompt named three idiom citation sites; there were four, and one of the named three did
  not exist.** Actual: `menuProfiles()`'s cap, `drawProfiles()`, `drawSlots()`, and
  `menuDifficulty()`'s `DIFFICULTY_LOCK_HELP` note (unlisted). The `MENU_TITLE` region carried no
  citation — it carried a *stale forecast* (`CS032's planned 6th`), swept separately. All four are
  repointed, and `test-cs032-p4.js` §F now pins the citation form itself (`MENU_ROOT_PLAY's "Save"`
  appears nowhere; no line mentioning the idiom quotes `"Save"`) so the next such sweep is mechanical.

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

- **⛔ CS032 P6 — PLAYTEST GATE, BLOCKING.** No code phase follows until Paul answers G1–G11 in
  `IMPLEMENTATION-PHASES-CS032.md`. Real browser, real `file://` load, not the harness. G4 is the
  gate's real question — the direct playtest of save-moment values (FORK-A) via `RESUMED RUN` +
  suppressed initials entry at game over; a fail there means P2's eligibility wiring has a gap and
  P7 does not proceed until it's fixed.

- **⛔ P7 doc sweep — `MENU_TITLE` is 6 rows and the pause root's `"Save"` is live.** The GDD's menu
  IA section and any passage calling `"Save"` a placeholder both need the update; GDD §2's
  unavailable-row-idiom passage (if it names `"Save"` as the example) repoints at `Add Profile`, as
  the build's own comments now do.

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
