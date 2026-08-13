# Orbital Overhaul — STATUS
Version: 1.0.0.30 · Changeset: CS031 · Phase: P1 · Registry: 87 · Levers: 18

## Phase ledger — CS031

- P1 — the `Profiles` module (roster, `keyFor()`, silent legacy migration), settings + achievements
  keys routed per-profile, the `LEGACY_KEY` v1 fallback gated to `p0`, additive
  `profileId`/`profileName` on new high-score records. No UI; nothing player-visible moved.

## Working / verified

- Full suite on a full clone: **118 files, 118 passed, 0 failed, 0 skipped, 0 timed out.**
- Registry confirmed at **87**, `LEVERS` at **18** — unmoved since CS030 P3.
- CS031 P1: `Profiles` sits immediately above `const STORAGE_KEY`, `Profiles.init()` immediately
  above `loadSettings()`. `p0`'s stores **are** the three frozen keys — the migration mints a roster
  entry and copies/moves/rewrites nothing, pinned byte-for-byte by `test-cs031-p1.js` §C. Every
  other profile suffixes (`afd_settings_v1:p3`). New key `afd_profiles_v1` (CS031's own, not frozen);
  it is an **explicit** key and `localStorage` is never enumerated.
- The `LEGACY_KEY` trap is closed and measured: the ungated build hands a brand-new profile the
  machine's `afd_achievements_v1` counters (26 000 deliveries reproduced), the gated build hands it
  zeros. §E pins both sides, plus the two non-vacuous mirrors (`p0` still migrates; a machine with no
  roster at all is still `p0`).

## Known issues

- **FLAG-CS031-a — one P1 choice the spec did not name: the roster blob carries a monotonic `seq`.**
  Ids are minted `p0`, `p1`, … from it and a removed profile's id is **never** recycled, because
  `remove()` is roster-only and does not clear that profile's stores — a recycled id would resurrect
  a deleted player's achievements. `load()` raises a hand-edited-low `seq` to the roster's own floor.
  Additive on CS031's own key; flagged so P2/P4 know it exists.
- **FLAG-CS031-b — `Profiles.remove()` deliberately leaves `activeId` naming a removed profile.**
  It is roster-only by the phase prompt, and `activate()` does not exist until P2. Per spec §4.5 the
  P4 caller must `activate()` another profile in the same act; nothing in P1 calls `remove()`.

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
- **FLAG-CS031-c — `test-f2.js` flakes ~3% of runs, and it is CS030 P4's freeze leaking across
  sections. Pre-existing, found at the P1 gate, NOT fixed here (another phase's test).** Section (d)
  kills the ship; the game-over call site banks whatever `Achievements.evaluate()` unlocked (usually
  `speed_recycler`, from scattered chain garbage randomly drifting into the dock during the death
  spectacle) and opens a panel. `game.celebration` is then never cleared, so CS030 P4's early-return
  freezes `update()` for the whole rest of the file, and section (g) fails on
  `g: shield deflection consumed energy` — the shield code never runs. Measured: **17/400 at
  `ee064fe`, 28/800 at parent `919e9ea`** — same rate, my change consumes no randomness (a 300-seed
  HEAD-vs-parent trace of that scenario differs in 0 seeds). Thirteen full-suite runs this session,
  one red. **One-line fix**: add `game.celebration = null;` to `test-f2.js`'s `resetShip()`.
  ⛔ **29 suite files reach a death/gameover and never mention `game.celebration`** — only `test-f2`
  has actually flaked so far, but the class is latent and P7 needs a green run.
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
  total. See `log/CS026.md` §11 backlog. ⛔ **CS031 is a persistence changeset built on top of this**
  (spec §5.1); the P6 gate's G1/G2 are the real-browser round-trip and upgrade path that close it.
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
- **CS031 P2 — `activate()`, the teardown/reload path.** It needs P1's `keyFor()` and must read
  `PLANNED-FEATURES-CS031.md` §2.2 / §2.3 / §4.3 in full first: seven of `loadSettings()`'s eight
  fields bleed across a switch, and `Achievements.init()` never zeroes the twenty lifetime counters.
  Reset to shipped defaults with writes SUPPRESSED, *then* load.

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
