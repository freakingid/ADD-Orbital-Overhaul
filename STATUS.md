# Orbital Overhaul — STATUS
Version: 1.0.0.27 · Changeset: CS028 · Phase: P1 · Registry: 85 · Levers: 18

## Phase ledger — CS028
- P1 — the satellite breakup model: `SAT_ART` becomes twelve real spacecraft with three authored breakup `pieces` each, `SAT_SCRAP` replaces the retired per-craft `small` field, and craft/piece identity now crosses a split. Suite 110/110.

## Working / verified

**P1 — data shape, identity propagation, split-site rewrite.** `SAT_ART` replaced end to end (6 generic archetypes → 12 real craft: Sputnik 1, Vanguard 1, Explorer 1, Telstar 1, Syncom, Hubble, JWST, Voyager, Pioneer 10, Juno, Apollo LM, Skylab), each `{ full, pieces[3] }`. New top-level `SAT_SCRAP` (3 craft-agnostic shards) owns the small tier. `DebrisSatellite`'s constructor takes two optional args (`craft`, `piece`, both defaulting to the `-1` sentinel) and dispatches: size 3 → rolled craft's `full`; size 2 → the *passed* craft's `pieces[piece % 3]`; size 1 → a random `SAT_SCRAP` shard with both fields left at `-1`. `destroyDebris()` passes `a.craft` and `pieceOffset + i` to every child. **FORK-CS028-A ships as the rotating offset** (`Math.floor(rand(0, 3))`, once per kill) — open at the gate.

Measured, not assumed: 12 craft / 3 pieces each / worst authored `|p|` **0.9879** (Apollo LM piece 2) / max `full` polylines **10** (the LM) — all matching the plan's figures. 600 real `destroyDebris()` splits across **both** `junkSplit` values (300 at level 1, 300 at level 15): 600/600 craft inherited, 600/600 pieces in range, 600/600 distinct. `scratchpad/test-cs028-p1.js` delivered, 44 assertions. Mutation-checked: swapping the offset for a fixed `i`, or dropping craft inheritance, each fails the suite.

**Suite: 110 files, 110 passed, 0 failed, 0 skipped**, two consecutive runs, diff confined to wall-clock timings. The two non-split call sites (wave spawner ~6328, title decoration ~9887) are unedited — exactly three `new DebrisSatellite(` sites, as the plan said.

## Known issues

- **⚠ FLAG-CS028-a — the art's authoring tool is not in the repo.** `IMPLEMENTATION-PHASES-CS028.md` Step 6 names `tools/sat-art-lab.html` as the generator; it does not exist (`tools/` holds music/scoop/voice/voice-robot labs only), so Step 6's cosmetic CS027→CS028 relabel had no target and was skipped. Consequence: `SAT_ART`/`SAT_SCRAP` are currently their own source of truth — a retune or a 13th craft has no instrument. Not blocking; the table is validated in-suite.
- **P1 corrected four suite files it did not expect to touch.** Each is documented at its own site, and two were genuine latent defects rather than fallout:
  - `test-v33-p2.js` — the v3.3 P2 art test, which read the retired `small` field. Superseded, not deleted: §1/§4 repointed to `full`+`pieces`/`SAT_SCRAP`, claims unchanged, and it deliberately does **not** re-assert the craft count (that is `test-cs028-p1.js`'s).
  - `test-cs023-p2.js` — the split-loop source-text pin, repointed for the fourth time (CS024 P1/P5/P6c precede this one). One word of its claim genuinely changed and says so: children are no longer argument-identical to each other.
  - `test-cs027-p6.js` §B — ⛔ **a pin whose target was a moving reference.** It reconstructed `a5ef9f4` from `89a9a3a` and compared against the **live** build, which is only the same thing while HEAD *is* `a5ef9f4`. Both ends are literal SHAs now. Any changeset after CS027 would have hit this.
  - `test-cs026-p3.js` §H — ⛔ **an assertion that was wrong about the build's contract and passed on luck.** It required every surviving body to satisfy `0 <= p < w`; `wrap()` folds only once a body is **more than 60 px** past an edge (`asteroids-deluxe.html:4660`), so bodies legitimately sit in that margin. Verified at HEAD with this file untouched: seed 9 ends with a Powerup at `y = -22.7`. CS028 P1 shifts the `Math.random` stream (the split path spends one fewer roll per child, one more per kill), which is what surfaced it. Now asserts the real bound, read off the build rather than hardcoded.
- **⚠ Heads-up for P2:** `test-cs027-p6.js` §A pins the live `GAME_VERSION` at `"1.0.0.27"`. At the P2 bump it flips to its standing mirror image (`!== "1.0.0.27"`), per `CLAUDE.md`'s settled rule — it is not re-pointed to a new literal.
- **FLAG-CS027-d — twelve suite files grep a comment-stripped copy of the source that's missing the same 80 lines `execSource()` fixed. Latent, not live**: audited, no assertion any of them makes currently falls in the deleted region. Becomes live the moment one does. One-line-per-file fix (`execSource()`); not urgent, bundle with an opportunistic migration.
- **(carried from CS026) Ten suite files still hard-fail, not skip, on a shallow clone** — measured: `git clone --depth 1` runs 101 files, 91 passing, 10 failing (`test-cs017-p6.js`, `test-cs019-p1.js`, `test-cs020-p1.js`, `test-cs020-p1b.js`, `test-cs023-p2.js`, `test-cs023-p3.js`, `test-cs024-p1.js`, `test-cs024-p2.js`, `test-cs024-p4.js`, `test-cs024-p6b.js`). Each reaches for a reference/parent commit and throws instead of skipping. Mechanical fix, same shape as the files already converted in CS026 P1/P2. See `log/CS026.md`.
- **(carried from CS026) The three `localStorage` keys (`afd_settings_v1`, `afd_achievements_v2`, `afd_scores_v1`) have never been round-tripped in a real browser** — one manual set-reload-confirm at a gate would close it; the failure mode if wrong is silent and total. See `log/CS026.md` §11 backlog.
- **(carried from CS023, dropped rather than resolved) Satellite-vs-satellite elastic bounce (CS023 P2) and mutual collision damage (CS023 P3) were never playtested.** `debrisBounce()` and the mutual-damage rule are live in the game today; no gate since has asked about them. See `log/CS023.md`.

## Open questions (blocking)

**The CS028 gate is blocking between P1 and P2.** Four questions, in `PLANNED-FEATURES-CS028.md` §5 — answer them here under `## Playtest asks` before P2 runs.

## Next up
- **P2 — the closing phase.** Apply the gate answers, bump to `1.0.0.28`, GDD §2 sweep (the twelve-craft breakup model is P2's to document — P1 deliberately left GDD §2.4's `SAT_ART` paragraph describing the retired six-archetype/`small` shape), `log/CS028.md`, `STATUS.md` reset, archive the planning pair. Registry must still read 85 and `LEVERS` 18.
- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions** (`2560`/`1440`/`1920`/`1080`) instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies** (see `## Known issues`) could migrate to `execSource()` whenever one of them is next open for other reasons.

## Balance notes
- **(carried from CS026) `COMBO n/N`'s denominator is still unrepresented** since CS026 P4 dropped the HUD row (FORK-CS026-F, accepted risk). Recorded so a future "the cargo cap is invisible" report is recognised as this, not a new bug.
- **(carried from CS026) The delivery floater column is tighter than before, by Paul's own choice — watch it next time it's played.** Nominal 8px separation, ~10.7px on screen. If it smears again, `DOCK_OFFLOAD_INTERVAL` (0.05 → 0.10) is the lever, not `deliveryFloatRise` (already costed and declined at the gate).
- **(carried from CS024/CS025) The UFO difficulty chain goes fully flat past level 65** (FLAG-CS025-b) — junk saturates at L41, hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth on their drivers with nothing escalating underneath. Fix if wanted is a step-count increase, no mechanism change.
- **(carried from CS023) `DEBRIS_BOUNCE_RESTITUTION` (1.0) and `DEBRIS_BOUNCE_MIN` (40 px/s) are both first-pass and browser-unverified**, same status as `SHIELD_BOUNCE_RESTITUTION`/`MIN` at CS021 P1b. Measured consequence: a rail satellite sweeping into a parked free one throws it up to 511.5 px/s off the outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives from.

## Playtest asks (open only — answered ones move to the log)

**CS028 gate — four questions, blocking P2** (`PLANNED-FEATURES-CS028.md` §5, `IMPLEMENTATION-PHASES-CS028.md` GATE):

1. **FORK-CS028-A.** Play past level 11 so both `junkSplit` values are seen. Rotating offset (what shipped) or fixed index? A fixed `i` would make piece 2 a deliberate level-11 reveal; the rotation shows all three from level 1.

Paul says: rotating is good.

2. **Jitter vs. regular geometry (FLAG-CS028-b, deliberately not pre-built).** Telstar's facet grid and Webb's hexagon seams are repeating regular geometry that the `radius * 0.045` jitter may read as sloppy rather than damaged. Watch both at the large tier. Fix if needed is a per-polyline `jitter: false` opt-out.

Paul says: use the per-polyline `jitter: false` opt-out.

3. **Piece distinctness across craft.** ⚠ Measured concern, not a hunch: Hubble's pieces 1/2 and Skylab's 0/2 have identical polyline vertex-count signatures, and Juno's folded blade is a third member of that family. Readable as different objects at r=26 with jitter, or convergent? **This is the one most likely to mean real art rework — which is its own changeset, not a P2 edit.**

Paul says: Do not worry about this. Leave it as is.

4. **Spawn dilution.** Twelve archetypes at even odds is ~8.3% per craft per kill, against the old 16.7%. Richer variety, or diluted recognition?

Paul says: this is fine, it's good.
