# Orbital Overhaul — STATUS
Version: 1.0.0.26 · Changeset: CS027 · Phase: P5 · Registry: 85 · Levers: 18

## Phase ledger — CS027
- P0 — archived the CS026 planning pair, repointed 17 live bare-filename references to it.
- P1 — built `scratchpad/run-all.js`; suite baseline measured for the first time: 106/106 pass, 0 failed, 0 skipped.
- P2 — added `scratchpad/_harness.js`, `scratchpad/test-registry.js`, `outsideScope()`; found the comment-strip idiom is not a build path (see Known issues).
- P3 — moved global counts (registry/header/lever/POWERUP_DROP_TYPES counts) into `test-registry.js`; 28 files decoupled from hardcoded counts.
- P4 — split `archive/STATUS-HISTORY.md` and STATUS.md's CS023–026 narrative into per-changeset `log/CS0##.md`; folded `GDD-VERSION-HISTORY.md` into the same files; STATUS.md cut to one page.

- P5 — `CLAUDE.md` now states rules only (528 → 427 lines, ⛔ INVARIANT / ⚠ SETTLED markers); `RATIONALE.md` created from the stripped prose under 18 anchors; GDD §5 rewritten off the attach-everything workflow.

## Working / verified
- Full suite green throughout: 106/106 at P1, 108/108 at P2 (registry + P2's own test added), 108/108 re-confirmed at P4 after the log/ split touched 11 scratchpad files + `_phase-ref.js`'s shared allowlist (already carried `log/` from P3).
- `buildGame()` evaluates the RAW script; the comment-strip idiom (deletes 80 live lines of the current build and still parses — `asteroids-deluxe.html:6556`) is confined to `execSource()`, a dedicated character-scanner used only for tombstone greps, never for building. `test-cs027-p2.js` (185 assertions) proves the two paths byte-identical and behavior-identical.
- `outsideScope(changed, extra)` in `_phase-ref.js` is now the one "nothing else moved" allowlist (base: `asteroids-deluxe.html`, `STATUS.md`, `scratchpad/`, `log/`); six files' hand-rolled variants converted to call it.
- `scratchpad/test-registry.js` is the only file allowed to name a global count: 85 entries / 9 headers / 18 levers / 5 `POWERUP_DROP_TYPES`.
- **P5 rule-survival audit is mechanical, not eyeballed**: all 73 bolded rules ≥12 chars in `89a9a3a:CLAUDE.md` were extracted and matched against `CLAUDE.md` ∪ `RATIONALE.md` (blockquote markers stripped). **64 survive byte-identically; the other 9 are restatements the supplied `CLAUDE.md` tightened deliberately** (e.g. "Game logic in one file, vanilla JS, no modules" → the ⛔ one-`<script>`-block rule). Zero dropped. All 6 old `⛔` blocks located. Suite re-run green after the doc edits: 108/108, 0 skipped, 28.90s.
- `RATIONALE.md` defines 18 anchors; `CLAUDE.md` currently points at 2 (`#pins`, `#voice-queue`). Both resolve. The other 16 are addressable but unreferenced — deliberate, so a future rule can link one without a new file edit.
- **FLAG-CS027-e resolved (P5b, Paul's call): `destroyHunter()` reclassified `⚠ SETTLED` → `⛔ INVARIANT`.** It read as both — it *looks* like an oversight that one kill path isn't levered (the `⚠` case), but changing it moves the 1+3+9 lineage total and breaks the shipped `ACH_LINEAGE_FULL = 13` (the `⛔` case). `⚠ SETTLED` invites "raise it with Paul"; this one isn't open for discussion. The marker-classification reasoning is recorded at `RATIONALE.md#levers` so a future session doesn't re-open it. This is the first exercise of the two-marker scheme, and the boundary it sets: **when a rule fits both, the tiebreak is whether the answer could change — if it can't, it's `⛔`.**

## Known issues
- **FLAG-CS027-d — twelve suite files grep a comment-stripped copy of the source that's missing the same 80 lines `execSource()` fixed. Latent, not live**: audited, no assertion any of them makes currently falls in the deleted region. Becomes live the moment one does. One-line-per-file fix (`execSource()`); not urgent, bundle with an opportunistic migration.
- ⛔ `GDD-VERSION-HISTORY.md` had no CS018 entry (its bullets run CS017 → CS019 directly), even though CS018 shipped (nine test files, its own `log/CS018.md` entries exist from the STATUS-HISTORY split). No CS014 entry either, and CS014 appears never to have existed. Both are reported, not reconstructed — writing a missing changelog entry now would be composing history, not relocating it.
- One paragraph — `archive/STATUS-HISTORY.md`'s own opening note explaining why the archive exists — carried no CS0NN/version marker of its own and was parked at `log/UNSORTED.md` rather than guessed into a changeset, per this phase's own instruction not to guess an owner.
- **(carried from CS026) Ten suite files still hard-fail, not skip, on a shallow clone** — measured: `git clone --depth 1` runs 101 files, 91 passing, 10 failing (`test-cs017-p6.js`, `test-cs019-p1.js`, `test-cs020-p1.js`, `test-cs020-p1b.js`, `test-cs023-p2.js`, `test-cs023-p3.js`, `test-cs024-p1.js`, `test-cs024-p2.js`, `test-cs024-p4.js`, `test-cs024-p6b.js`). Each reaches for a reference/parent commit and throws instead of skipping. Mechanical fix, same shape as the four files already converted in CS026 P1/P2 — deliberately left as a decision for whoever next needs the closing-phase "zero skips" assertion to mean something on a shallow clone. See `log/CS026.md`.
- **(carried from CS026) The three `localStorage` keys (`afd_settings_v1`, `afd_achievements_v2`, `afd_scores_v1`) have never been round-tripped in a real browser** — one manual set-reload-confirm at a gate would close it; the failure mode if wrong is silent and total. See `log/CS026.md` §11 backlog.
- **(carried from CS023, dropped rather than resolved) Satellite-vs-satellite elastic bounce (CS023 P2) and mutual collision damage (CS023 P3) were never playtested.** CS023's own gate (P5) never ran — the orbit shell/ring geometry it was mostly about got deleted by CS024 — but `debrisBounce()` and the mutual-damage rule shipped anyway and are still live in the game today. No later gate (CS024/25/26) ever asked about them. See `log/CS023.md`.

## Balance notes
- **(carried from CS026) `COMBO n/N`'s denominator is still unrepresented** since CS026 P4 dropped the HUD row (FORK-CS026-F, accepted risk; gate Q5 didn't catch it, Paul didn't ask for it back). Recorded so a future "the cargo cap is invisible" report is recognised as this, not a new bug.
- **(carried from CS026) The delivery floater column is tighter than before, by Paul's own choice — watch it next time it's played.** Nominal 8px separation, ~10.7px on screen. If it smears again, `DOCK_OFFLOAD_INTERVAL` (0.05 → 0.10) is the lever, not `deliveryFloatRise` (already costed and declined at the gate: a 24-canister visit would go 1.2s → 2.4s).
- **(carried from CS026) FLAG-CS026-a — `DEBRIS_GARBAGE` held at 4 through CS026 deliberately**, so as not to confound the gate's only clean read on garbage density. That read is now taken; moving it is a normal retune whenever a future changeset wants one.
- **(carried from CS024/CS025) The UFO difficulty chain goes fully flat past level 65** (FLAG-CS025-b) — junk saturates at L41, hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth on their drivers with nothing escalating underneath. Gate question 4 in `archive/PLANNED-FEATURES-CS025.md` §4 owns it; fix if wanted is a step-count increase, no mechanism change.
- **(carried from CS023) `DEBRIS_BOUNCE_RESTITUTION` (1.0) and `DEBRIS_BOUNCE_MIN` (40 px/s) are both first-pass and browser-unverified**, same status as `SHIELD_BOUNCE_RESTITUTION`/`MIN` at CS021 P1b. Measured consequence: a rail satellite sweeping into a parked free one throws it up to 511.5 px/s off the outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives from, and the number to watch if the shell reads like a pinball table.

## Next up
- CS027 P6 (closing): version bump to 1.0.0.27, TRAP-CS027-A (assert the parent-to-HEAD script delta is exactly the `GAME_VERSION` line), two consecutive suite runs diffed, doc sweep, and the §5 success-criteria table with **measured** actuals. P5 note for it: the fixed-context metric is now `CLAUDE.md` + `STATUS.md` only — `RATIONALE.md` is explicitly not session context and must not be counted into that budget.
- **(carried from CS026 §11 backlog) The satellite sprite redesign is its own changeset, with two clarifying questions still open** before it can be scoped as planning docs.

## Playtest asks
CS027 has shipped no gameplay changes (P0–P4 are archive/test-infra/doc housekeeping) — nothing new to ask.

## Suite baseline (CS027 P1)
Runner: `scratchpad/run-all.js`. 106 files discovered (109 files in `scratchpad/` minus the three excluded: `_phase-ref.js`, `_seeded-random.js`, `diag-chain-iter.js`).

- **106 passed, 0 failed, 0 skipped, 0 timed out.**
- Total wall time: **28.43s** (single sequential run, 120s per-file timeout, 64 MB `maxBuffer`).
- Five slowest: `test-cs026-p1.js` 4.96s · `test-cs024-p3.js` 3.60s · `test-cs024-p6c.js` 1.28s · `test-cs024-p6.js` 1.12s · `test-cs026-p2.js` 1.07s.
- No failing files this run — no first-failing-assertion lines to record.

**Re-measured at CS027 P2** (P1's numbers above are left as its own record): **108 files, 108 passed, 0 failed, 0 skipped, 0 timed out**, 30.54s. The two added files are `test-registry.js` and `test-cs027-p2.js`; `_harness.js` is excluded by the `_` prefix. No pre-existing file moved bucket.

**Re-confirmed at CS027 P4**: **108 files, 108 passed, 0 failed, 0 skipped, 0 timed out** after the `log/` split (11 scratchpad files repointed off the retired `GDD-VERSION-HISTORY.md`; `_phase-ref.js`'s `outsideScope()` base already carried `log/` from P3, so no change needed there).
