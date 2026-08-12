# Orbital Overhaul — STATUS
Version: 1.0.0.28 · Changeset: CS028 (closed) · Phase: — · Registry: 85 · Levers: 18

## Phase ledger — CS028

## Working / verified

## Known issues

- **(carried) `test-registry.js`'s FLAG-CS027-d — twelve suite files grep a comment-stripped copy of the source that's missing the same 80 lines `execSource()` fixed.** Latent, not live: audited, no assertion any of them makes currently falls in the deleted region. Becomes live the moment one does. One-line-per-file fix (`execSource()`); not urgent, bundle with an opportunistic migration.
- **(carried) `tools/sat-art-lab.html` (FLAG-CS028-a) is not in the repo.** `SAT_ART`/`SAT_SCRAP` (CS028) are their own source of truth; a retune or a 13th craft has no authoring instrument. Not blocking; the table is validated in-suite.
- **(carried) Piece-distinctness concern, deliberately unresolved.** Hubble's pieces 1/2 and Skylab's 0/2 share a polyline vertex-count signature; Juno's folded blade is a third member of that family. Paul's gate call (CS028): leave as is. Any real fix is new art authoring — its own changeset, not a routine edit.
- **(carried from CS026) Ten suite files still hard-fail, not skip, on a shallow clone** — measured: `git clone --depth 1` runs 101 files, 91 passing, 10 failing (`test-cs017-p6.js`, `test-cs019-p1.js`, `test-cs020-p1.js`, `test-cs020-p1b.js`, `test-cs023-p2.js`, `test-cs023-p3.js`, `test-cs024-p1.js`, `test-cs024-p2.js`, `test-cs024-p4.js`, `test-cs024-p6b.js`). Each reaches for a reference/parent commit and throws instead of skipping. Mechanical fix, same shape as the files already converted in CS026 P1/P2. See `log/CS026.md`.
- **(carried from CS026) The three `localStorage` keys (`afd_settings_v1`, `afd_achievements_v2`, `afd_scores_v1`) have never been round-tripped in a real browser** — one manual set-reload-confirm at a gate would close it; the failure mode if wrong is silent and total. See `log/CS026.md` §11 backlog.
- **(carried from CS023, dropped rather than resolved) Satellite-vs-satellite elastic bounce (CS023 P2) and mutual collision damage (CS023 P3) were never playtested.** `debrisBounce()` and the mutual-damage rule are live in the game today; no gate since has asked about them. See `log/CS023.md`.

## Open questions (blocking)

None.

## Next up

- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions** (`2560`/`1440`/`1920`/`1080`) instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies** (see `## Known issues`) could migrate to `execSource()` whenever one of them is next open for other reasons.
- **A satellite art authoring tool (`tools/sat-art-lab.html`) does not exist** (FLAG-CS028-a). Only worth building if a future changeset wants to retune the twelve craft or add a 13th.

## Playtest asks (open only — answered ones move to the log)

None open.

## Balance notes
- **(carried from CS026) `COMBO n/N`'s denominator is still unrepresented** since CS026 P4 dropped the HUD row (FORK-CS026-F, accepted risk). Recorded so a future "the cargo cap is invisible" report is recognised as this, not a new bug.
- **(carried from CS026) The delivery floater column is tighter than before, by Paul's own choice — watch it next time it's played.** Nominal 8px separation, ~10.7px on screen. If it smears again, `DOCK_OFFLOAD_INTERVAL` (0.05 → 0.10) is the lever, not `deliveryFloatRise` (already costed and declined at the gate).
- **(carried from CS024/CS025) The UFO difficulty chain goes fully flat past level 65** (FLAG-CS025-b) — junk saturates at L41, hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth on their drivers with nothing escalating underneath. Fix if wanted is a step-count increase, no mechanism change.
- **(carried from CS023) `DEBRIS_BOUNCE_RESTITUTION` (1.0) and `DEBRIS_BOUNCE_MIN` (40 px/s) are both first-pass and browser-unverified**, same status as `SHIELD_BOUNCE_RESTITUTION`/`MIN` at CS021 P1b. Measured consequence: a rail satellite sweeping into a parked free one throws it up to 511.5 px/s off the outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives from.
