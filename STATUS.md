# Orbital Overhaul — STATUS
Version: 1.0.0.27 · Changeset: CS027 (closed) · Phase: — · Registry: 85 · Levers: 18

## CS027 close-out (measured, not targets — full narrative in `log/CS027.md`)

| Metric | At `89a9a3a` (CS026 P6) | Target (`archive/PLANNED-FEATURES-CS027.md` §5) | Measured at close |
|---|---|---|---|
| Fixed session context (`CLAUDE.md` + `STATUS.md`) | ~164K tokens | < 12K | **~7.2K tokens** (CLAUDE.md 21.9 KB + this file ~6.8 KB = ~28.7 KB combined; ~4 chars/token estimate — the same rough method the §5 baseline used) |
| Files edited to add one registry knob | ~24 (~75 lines) | 1 | **4**: the game file, its own new test, `test-registry.js` (the one count owner), `STATUS.md`. The "1" target was specifically the count-sweep burden (`test-registry.js` now owns it alone, down from 22 non-owning files P3 decoupled) — the other 3 are inherent to shipping any knob, not sweep fallout. |
| Files edited to change how the build is loaded | 108 | 1 (for new tests) | **1** (`_harness.js`) for any *new* test file. The 105+ pre-existing files keep their own inline stub-eval idiom by design (FORK-A: no retroactive migration) — only 4 files use `_harness.js` today (`test-registry.js`, `test-cs027-p2.js`, `test-cs027-p6.js`, and `_harness.js` requiring itself doesn't count, so 3 consumers). |
| Suite pass state | unknown | known, and green | **Known and green: 109/109, 0 failed, 0 skipped**, confirmed by two consecutive full runs (see below). |
| `STATUS.md` | 615 KB, 6 headings | < 40 KB, sectioned | **~6.7 KB, 49 lines, 8 headings** — well under target. |

Additional measurements item 6 asked for:
- **Repo-wide global-count assertion lines**: `grep -rn '\.length,\? *=*=* *85\b' scratchpad/*.js` returns exactly one line outside `test-registry.js` — `test-cs026-p6.js`'s own parent-commit setup literal (sanctioned: P3's rule 4, "parent-commit setup assertions stay"). Zero unsanctioned repeats.
- **Suite pass/fail and wall time vs. the P1 baseline**: P1 baseline (CS027 P1) was 106 files / 106 passed / 0 failed / 0 skipped / 28.43s. At close: **109 files / 109 passed / 0 failed / 0 skipped / 0 timed out**, ~28–31s (two runs, both green; wall time is not gated — counter-based budgets only, per the standing test rule). The 3-file growth is `test-registry.js`, `test-cs027-p2.js`, `test-cs027-p6.js` (`_harness.js` is excluded by its `_` prefix, same as always).
- **Two consecutive `run-all.js` runs, diffed**: non-empty diff, confined entirely to per-file wall-clock timings (one run showed a `-0.37s` reading for `test-cs025-p3.js`, almost certainly `Date.now()` clock jitter in this environment). Every PASS/FAIL line and the summary counts were byte-identical between runs. **Zero `SKIPPED (no git history)` occurrences in either run.**

⛔ Registry confirmed unmoved at **85**, `LEVERS` at **18** — `test-cs027-p6.js` §B measures both against the CS027 start point (`89a9a3a`), not just quotes them.

## Phase ledger — CS027
CS027 is complete. Full phase-by-phase narrative: `log/CS027.md`.

## Working / verified
(Nothing yet for the next changeset — CS028 has not started. CS027's verification record lives in `log/CS027.md`.)

## Known issues
- **FLAG-CS027-d — twelve suite files grep a comment-stripped copy of the source that's missing the same 80 lines `execSource()` fixed. Latent, not live**: audited, no assertion any of them makes currently falls in the deleted region. Becomes live the moment one does. One-line-per-file fix (`execSource()`); not urgent, bundle with an opportunistic migration.
- **(carried from CS026) Ten suite files still hard-fail, not skip, on a shallow clone** — measured: `git clone --depth 1` runs 101 files, 91 passing, 10 failing (`test-cs017-p6.js`, `test-cs019-p1.js`, `test-cs020-p1.js`, `test-cs020-p1b.js`, `test-cs023-p2.js`, `test-cs023-p3.js`, `test-cs024-p1.js`, `test-cs024-p2.js`, `test-cs024-p4.js`, `test-cs024-p6b.js`). Each reaches for a reference/parent commit and throws instead of skipping. Mechanical fix, same shape as the files already converted in CS026 P1/P2. See `log/CS026.md`.
- **(carried from CS026) The three `localStorage` keys (`afd_settings_v1`, `afd_achievements_v2`, `afd_scores_v1`) have never been round-tripped in a real browser** — one manual set-reload-confirm at a gate would close it; the failure mode if wrong is silent and total. See `log/CS026.md` §11 backlog.
- **(carried from CS023, dropped rather than resolved) Satellite-vs-satellite elastic bounce (CS023 P2) and mutual collision damage (CS023 P3) were never playtested.** `debrisBounce()` and the mutual-damage rule are live in the game today; no gate since has asked about them. See `log/CS023.md`.

## Open questions (blocking)
(none)

## Next up
- **CS028 is not yet scoped.** No planning pair exists at the repo root.
- **(carried from CS026 §11 backlog) The satellite sprite redesign is its own changeset, with two clarifying questions still open** before it can be scoped as planning docs.
- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions** (`2560`/`1440`/`1920`/`1080`) instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies** (see `## Known issues`) could migrate to `execSource()` whenever one of them is next open for other reasons.

## Balance notes
- **(carried from CS026) `COMBO n/N`'s denominator is still unrepresented** since CS026 P4 dropped the HUD row (FORK-CS026-F, accepted risk). Recorded so a future "the cargo cap is invisible" report is recognised as this, not a new bug.
- **(carried from CS026) The delivery floater column is tighter than before, by Paul's own choice — watch it next time it's played.** Nominal 8px separation, ~10.7px on screen. If it smears again, `DOCK_OFFLOAD_INTERVAL` (0.05 → 0.10) is the lever, not `deliveryFloatRise` (already costed and declined at the gate).
- **(carried from CS024/CS025) The UFO difficulty chain goes fully flat past level 65** (FLAG-CS025-b) — junk saturates at L41, hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth on their drivers with nothing escalating underneath. Fix if wanted is a step-count increase, no mechanism change.
- **(carried from CS023) `DEBRIS_BOUNCE_RESTITUTION` (1.0) and `DEBRIS_BOUNCE_MIN` (40 px/s) are both first-pass and browser-unverified**, same status as `SHIELD_BOUNCE_RESTITUTION`/`MIN` at CS021 P1b. Measured consequence: a rail satellite sweeping into a parked free one throws it up to 511.5 px/s off the outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives from.

## Playtest asks (open only — answered ones move to the log)
(none — CS027 shipped no gameplay changes)
