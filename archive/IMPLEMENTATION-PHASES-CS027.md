# IMPLEMENTATION PHASES — CS027

Parent: `89a9a3a` (`cs-26 p6`). Seven phases, one session each, one commit each.

**Phase order is dependency-ordered and not reorderable.** P1 must establish the
baseline before P3 changes 22 test files, or there is no way to tell a sweep
regression from a pre-existing failure.

**No playtest gate.** Zero gameplay change means nothing to gate on — this is the
first changeset since CS022 with no blocking stop, which is itself part of the
time saving.

| Phase | Scope | Model |
|---|---|---|
| P0 | Archive CS026 pair, repoint refs | Sonnet, normal |
| P1 | `run-all.js` + recorded baseline | Sonnet, high |
| P2 | `_harness.js`, `_registry.js`, `outsideScope()` | **Opus, xhigh, thinking** |
| P3 | The count-assertion sweep (22 files) | Sonnet, high |
| P4 | Doc split — `STATUS.md` → one page, `log/` | Sonnet, high |
| P5 | `CLAUDE.md` rewrite + `RATIONALE.md` + GDD §5 | **Opus, xhigh** |
| P6 | Close: version 1.0.0.27, sweep, measure | Sonnet, high |

**No open forks.** CS027-C (split the STATUS history) and CS027-D (fold the
version history) are both resolved; P4 carries their outcomes. FLAG-CS027-a
(unknown suite green state) has a stop condition inside P1.

---

## P0 — Archive the CS026 pair, repoint references

**Prompt:**

> Read `CLAUDE.md` and `STATUS.md` first. This is CS027 P0, the housekeeping
> phase. No code changes.
>
> 1. Move `PLANNED-FEATURES-CS026.md` and `IMPLEMENTATION-PHASES-CS026.md` to
>    `archive/`, preserving filenames.
> 2. Add `PLANNED-FEATURES-CS027.md` and `IMPLEMENTATION-PHASES-CS027.md` at
>    repo root (I will supply them).
> 3. `grep -rn "CS026" --include="*.html" --include="*.js" --include="*.md" .`
>    and repoint every reference to the two moved files to their `archive/`
>    paths. Report the count of repointed references before and after.
> 4. Prepend the CS027 header to `STATUS.md` per the existing format, with a
>    one-line P0 ledger entry.
>
> Do not touch `asteroids-deluxe.html` except for doc-path references inside
> comments. Do not create `log/` yet — that is P4.
>
> Commit: `cs-27 p0: archive CS026 pair, repoint refs`

---

## P1 — The runner, and the truth about the suite

**This phase's real deliverable is the baseline, not the runner.** Nobody
currently knows how many of the 109 test files pass.

**Prompt:**

> Read `CLAUDE.md` and `STATUS.md` first. This is CS027 P1.
>
> Build `scratchpad/run-all.js`:
> - Discovers every `scratchpad/test-*.js` (excluding `_`-prefixed helpers and
>   `diag-*.js`), runs each in its own child process via `execFileSync` with a
>   per-file timeout (start at 120s), captures exit code, stdout tail, wall time,
>   and any `SKIPPED (no git history)` occurrences.
> - Prints a one-line-per-file table, then a summary: passed / failed / skipped /
>   timed out, total wall time, and the five slowest files.
> - Exits non-zero if any file fails or times out.
> - Accepts `--only <substring>` and `--quiet`.
>
> ⛔ Do not modify a single existing test file in this phase, even if you can see
> why one fails. Run it, record it, stop.
>
> Then run it and record the baseline in `STATUS.md` under a new
> `## Suite baseline (CS027 P1)` section: the pass/fail/skip counts, total wall
> time, the five slowest files, and — for every failing file — the filename and
> the first failing assertion message, one line each.
>
> **`ultrathink` on the discovery/timeout design specifically:** several of these
> tests drive 200-level runs and one is known to have flaked 2-in-12 before
> seeding, so a timeout that is too tight will manufacture failures that aren't
> real.
>
> Commit: `cs-27 p1: run-all.js runner, suite baseline recorded`

**Gate:** if the baseline shows pre-existing failures, report the list and stop.
Repairs get scoped before P2 proceeds.

---

## P2 — The three helpers

**Prompt:**

> Read `CLAUDE.md` and `STATUS.md` first. This is CS027 P2. Three new helpers in
> `scratchpad/`. **No existing test file is migrated in this phase.**
>
> **1. `scratchpad/_harness.js`** — factor out what 105+ files currently
> duplicate. Derive it by reading `test-cs026-p3.js`, `test-cs026-p6.js` and
> `test-cs024-p1.js` and taking the union of what they stub, not by inventing a
> new sandbox.
>
> ```js
> const { buildGame, mkAssert, worldDims } = require("./_harness.js");
> const X = buildGame();            // stubs + eval of the real <script> block
> const { assert, eq, close, skip, report } = mkAssert();
> ```
>
> - `buildGame(opts)` — reads `asteroids-deluxe.html`, extracts the `<script>`
>   block, comment-strips it (the existing idiom: block comments, then trailing
>   and leading `//`), stubs `window`, `document.getElementById` (canvas whose
>   `getContext` yields a no-op Proxy), `performance`, `requestAnimationFrame`,
>   `navigator`, `localStorage`, and returns the evaluated globals object.
>   `opts.source` accepts a pre-built source string so `parentSource(sha)` output
>   can be fed straight in.
> - `mkAssert()` — `assert` / `eq` / `close` / `skip` plus `report()` returning
>   `{passed, failed, skipped}` and setting `process.exitCode`.
> - `worldDims(X, level)` — reads world dimensions off the build. **No literals.**
>
> ⛔ **`buildGame()` must be behaviourally identical to the inline idiom.** Prove
> it, don't assert it: `test-cs027-p2.js` builds the game both ways — once via
> `_harness.js`, once via the inline idiom copied verbatim out of
> `test-cs026-p6.js` — and asserts the two global objects have identical key sets
> and identical values for every primitive, plus identical `DEBUG_ENTRIES.length`,
> `LEVERS.length`, and `GAME_VERSION`.
>
> **2. `scratchpad/test-registry.js`** — the single canonical owner of every
> global count. It asserts: `DEBUG_ENTRIES.length === 85`,
> `DEBUG_VARS.filter(v => !v.header).length === 85`,
> `DEBUG_VARS.filter(v => v.header).length === 9`, `LEVERS.length === 18`, that
> `DEBUG_ENTRIES` and `DEBUG_VARS` agree entry-for-entry, and
> `POWERUP_DROP_TYPES.length`. Header comment states, in one line, that this file
> is the only place these numbers may appear.
>
> Also export from it: `hasKnob(X, id, {def, min, max, step})` and
> `hasLever(X, id, {floor, ceil, steps})` — the presence-and-shape assertions that
> replace the count assertions in P3.
>
> **3. `outsideScope(changed, extra)` in `_phase-ref.js`** — the "nothing else
> moved" allowlist, currently hardcoded as the string `"STATUS.md"` in 15 files.
> It owns the base allowlist (`asteroids-deluxe.html`, `scratchpad/`, `STATUS.md`,
> and — from P4 — `log/`) and takes phase-specific extras as an argument. Export
> it alongside the existing five.
>
> **`ultrathink` on the comment-stripping and stubbing equivalence.** The
> comment-strip is load-bearing: it exists so a TOMBSTONE naming a retired shape
> can't be mistaken for live code, and there are two divergent regex idioms in the
> suite already. Pick the correct one and say why in the phase report.
>
> Run `node scratchpad/run-all.js` before committing; the baseline must be
> unchanged.
>
> Commit: `cs-27 p2: _harness.js, test-registry.js, outsideScope() — new tests only`

---

## P3 — The count-assertion sweep

The largest mechanical phase. **This is the one that buys back implementation
time.**

**Prompt:**

> Read `CLAUDE.md` and `STATUS.md` first. This is CS027 P3. Mechanical sweep, no
> new behaviour, no new tests.
>
> The target set, verified at `89a9a3a` — re-grep and report if your counts
> differ:
> - **48 lines across 22 files** asserting the global registry count `85` (as
>   `DEBUG_ENTRIES.length`, `DEBUG_VARS.filter(v => !v.header).length`, or
>   `DEBUG_VARS.filter(v => v.id).length`).
> - **8 lines across 6 files** asserting `LEVERS.length === 18`.
> - **4 files** asserting the section-header count `9`.
> - **15 files** hardcoding `"STATUS.md"` in a changed-files allowlist.
>
> For each:
>
> 1. **A global count assertion is deleted outright** if the file's phase did not
>    create a registry entry.
> 2. **If the file's phase did create one**, replace the count with
>    `hasKnob(X, "<id>", {...})` / `hasLever(X, "<id>", {...})` from
>    `test-registry.js` — asserting the thing that phase actually built.
> 3. **Delete the prose history in the message.** `"85 value entries remain — the
>    21-tier-knob prune, P5's lever-knob rebuild, P6's POWERUPS section, …"` is
>    exactly the maintenance burden being removed. Do not carry it into the new
>    assertion.
> 4. **Parent-commit setup assertions stay.** Lines like
>    `eq(OLD.DEBUG_ENTRIES.length, 72, "G: (setup) the parent commit held 72
>    entries")` are pinned to a specific parent SHA and are correct as literals.
>    Leave them. Only *current-build* global counts are in scope.
> 5. Replace hardcoded `"STATUS.md"` allowlists with `outsideScope(changed)`.
>
> ⛔ Do not migrate these files to `_harness.js` while you are in them. That is a
> separate concern and would make this diff unreviewable. Assertion lines only.
>
> ⛔ Run `node scratchpad/run-all.js` after every 5 files, not once at the end. A
> sweep this wide will produce a regression somewhere, and finding it against a
> 22-file diff is much harder than against a 5-file one.
>
> Report: the before/after count of global-count assertion lines repo-wide, and
> confirm `grep -rn "\.length,\? *=*=* *85" scratchpad/*.js` returns only
> `test-registry.js`.
>
> Commit: `cs-27 p3: global counts move to test-registry.js; 22 files decoupled`

---

## P4 — The doc split

**Both forks resolved: split `archive/STATUS-HISTORY.md`, fold
`GDD-VERSION-HISTORY.md`.**

⛔ **This is a relocation phase. Write the split as a script, run it, and check
the script's arithmetic — do not relocate 1.9 MB of prose by hand.** The
correctness condition is conservation: every non-empty paragraph in, exactly one
paragraph out.

**Prompt:**

> Read `CLAUDE.md` and `STATUS.md` first. This is CS027 P4. Document relocation
> only — no game code, no test logic. The only `.js` edit is `_phase-ref.js` step 6.
>
> ⛔ **Do this with a Python script in `scratchpad/`, not by hand.** Commit the
> script. It must report, for every input file: paragraphs in, paragraphs out per
> destination, and paragraphs unaccounted for. **Unaccounted must be zero.**
>
> **1. The split algorithm — read this before writing the script; the obvious
> approach is wrong.** In `archive/STATUS-HISTORY.md`, only **180 of 618
> paragraphs** carry a `CS0NN` marker. The remaining **438 are continuation
> paragraphs** belonging to the marked paragraph above them. Classifying
> paragraph-by-paragraph orphans 71% of the file.
>
> Use a **run-based** walk instead. Track two pieces of state as you go:
> - **current section** — updated on every `##` / `###` heading.
> - **current changeset** — updated only when a paragraph *opens* with a `CS0NN`
>   reference in roughly its first 220 characters (`**CS022 P3 — …**`,
>   `**Headless-verified this session (CS022 P1, …`, `**Prior session (CS022 P3,
>   landed):**`). Every subsequent paragraph inherits it until the next marker.
>
> The destination key is **(changeset, section)**, not changeset alone — lines
> 1–395 are a newest-first rolling recap, but lines 396+ are cross-changeset
> buckets (`Working / verified`, `Known issues`, `Balance notes`, `Next up`,
> `Playtest asks`). A CS022 bullet from `Known issues` belongs in `log/CS022.md`
> under a *Known issues* heading, not merged into that changeset's recap.
>
> If a run appears before any marker, park it in `log/UNSORTED.md` and report it —
> **do not guess an owner.**
>
> **2. Split `archive/STATUS-HISTORY.md`** into `log/CS009.md` … `log/CS022.md`,
> plus `log/pre-CS009.md` for the `### Deep history (pre-CS009: v2.0 through
> v3.6)` section. Then delete the original.
> ⛔ **Straight relocation. Do not summarize, shorten, reorder, or rewrite while
> moving.** Nothing is lost; it only leaves the read path.
>
> **3. Split the current `STATUS.md` narrative** the same way into
> `log/CS023.md` … `log/CS026.md`, appending to any file step 2 already created.
>
> **4. Fold `GDD-VERSION-HISTORY.md`.** Its CS009+ entries are one bullet per
> changeset (some grouped, e.g. `- **CS012 (P1–P5) — …`); CS025 and CS026 have
> their own `##` headings with multi-paragraph bodies. Append each to its
> changeset's `log/` file under `## GDD version history`. Everything above the
> CS009 bullet — the `v1.0` … `v3.3` era — goes to `log/pre-CS009.md` under the
> same heading. Then delete the original.
>
> ⛔ **Report, do not fill: `GDD-VERSION-HISTORY.md` has no CS018 entry.** It runs
> CS017 → CS019, but CS018 shipped (nine test files, 21 attributable paragraphs in
> the STATUS history). CS014 is also absent and probably correctly so — it appears
> never to have existed. Reconstructing a missing changelog entry is writing, not
> relocation. **Flag both in `STATUS.md` and leave them.**
>
> **5. Repoint live references only.** `ORBITAL-OVERHAUL-GDD.md` (5, including the
> §7 pointer), `DIFFICULTY-LEVERS.md` (1), and 18 across 11 files in `scratchpad/`.
> `CLAUDE.md`'s 3 are P5's. `STATUS.md`'s 19 evaporate in step 6.
> ⛔ **Do not touch the 128 references inside `archive/`.** Those are spent
> planning docs — historical records of what was true when written. Rewriting them
> is churn that destroys their accuracy as artifacts. Re-grep and report if your
> counts differ from these.
>
> **6. Rewrite `STATUS.md` from the template in `CLAUDE.md`.** Current changeset
> only (CS027, P0–P4). Carry forward **only**: still-open known issues,
> still-unanswered playtest asks, live balance notes, `Next up`, and the P1 suite
> baseline. Everything answered or closed goes to the log with its changeset.
> Target under 400 lines.
>
> **7. Add `log/` to the `outsideScope()` base allowlist** in `_phase-ref.js`, so
> a phase writing its own log entry doesn't trip a "nothing else moved" pin.
>
> Run `node scratchpad/run-all.js` before committing — step 5 touches 11 test
> files and step 7 touches a shared helper.
>
> Report: before/after byte size of every file touched, the conservation numbers
> from the script, the contents of `log/UNSORTED.md` if non-empty, and the CS018
> gap.
>
> **`ultrathink` on the run-based walk and the (changeset, section) keying**
> specifically — this is the phase where a plausible-looking script silently
> scatters a third of the project's history into the wrong files, and the failure
> is not visible in a diff of that size.
>
> Commit: `cs-27 p4: STATUS.md to one page, history split per changeset into log/`

---

## P5 — CLAUDE.md and RATIONALE.md

**Prompt:**

> Read the current `CLAUDE.md` and `STATUS.md` first. This is CS027 P5.
>
> **1. Replace `CLAUDE.md`** with the version I supply. It states rules without
> rationale and introduces two markers: `⛔ INVARIANT` and `⚠ SETTLED` (this looks
> wrong, is not, do not fix it, do not re-litigate it, raise it with Paul instead).
>
> **2. Create `RATIONALE.md`** by relocating the prose stripped out of the old
> `CLAUDE.md` — the "why" behind each rule, under `#anchor` headings the new
> `CLAUDE.md` can point at. Currently referenced anchors: `#pins` (the ten-times-
> paid phase-local-pin lesson, including the nine retired in CS024 P7) and
> `#voice-queue` (why the blanket "superseded lines DROP, never queue" rule was
> over-broad rather than wrong, and why re-validation rather than override was the
> answer).
> ⛔ **Relocation, not rewriting.** Take the paragraphs out of `git show
> 89a9a3a:CLAUDE.md` and move them. Add a header saying this file is not session
> context and exists so that a rule can be questioned without the rule itself
> carrying an essay.
>
> **3. Rewrite GDD §5 (Session Handoff Protocol)** — FLAG-CS027-b. It is stale in
> three ways: §5.4 rule 1 (*"Deliver the complete file, not fragments"*) directly
> contradicts `CLAUDE.md`'s `str_replace` rule; §5.1's attach-everything list
> predates `CLAUDE.md` being auto-loaded; §5.3's `STATUS.md` template is not the
> template in use. Replace §5 with the current reality: `CLAUDE.md` auto-loads,
> `STATUS.md` is one page, the in-flight planning pair is attached, and everything
> else is pulled on demand. Reference the new `STATUS.md` template rather than
> restating it.
>
> ⛔ Verify every rule in the old `CLAUDE.md` survives into either the new
> `CLAUDE.md` or `RATIONALE.md`. Produce a checklist in your report: every `⛔` and
> every bolded rule in the old file, mapped to where it now lives. **A dropped rule
> is the one failure mode of this phase.**
>
> Commit: `cs-27 p5: CLAUDE.md states rules; rationale to RATIONALE.md; GDD §5 refreshed`

---

## P6 — Close

**Prompt:**

> Read `CLAUDE.md` and `STATUS.md` first. This is CS027 P6, the closing phase.
>
> 1. `GAME_VERSION` `"1.0.0.26"` → `"1.0.0.27"`. Repoint the live version pins
>    (the small deliberate set that tracks HEAD); flip any phase-local version pin
>    to its standing mirror image rather than re-pointing it.
> 2. ⛔ **TRAP-CS027-A — assert it, don't claim it.** Using
>    `parentSource("89a9a3a…")`, diff the parent's `<script>` block against the
>    current one and assert the delta is **exactly one line, the `GAME_VERSION`
>    string.** Any other difference is a CS027 defect. Write this as a real
>    assertion in `test-cs027-p6.js`, not a note.
> 3. Run `node scratchpad/run-all.js` **twice consecutively and diff the two
>    runs.** A non-empty diff is a real finding (the seeding work in CS026 P1 is
>    what makes this meaningful). Assert zero `SKIPPED (no git history)`.
> 4. Doc sweep: move `PLANNED-FEATURES-CS027.md` / `IMPLEMENTATION-PHASES-CS027.md`
>    to `archive/`; move the CS027 `STATUS.md` narrative to `log/CS027.md` and
>    reset `STATUS.md` from the template — **this is the first time the new
>    close-out ritual runs, so record how long it took.**
> 5. Append the CS027 version-history entry to `log/CS027.md` under
>    `## GDD version history` — **the first changeset to write its changelog entry
>    to the folded location.** There is no central changelog any more. Confirm GDD
>    §7 points at `log/`, not at a deleted file.
> 6. **Record the §5 success-criteria table in `STATUS.md` with measured actuals,
>    not targets.** Include: `CLAUDE.md` + `STATUS.md` combined token estimate;
>    the count of files that would need editing to add one registry knob (derive
>    it — don't guess); repo-wide global-count assertion lines; suite pass/fail
>    and total wall time against the P1 baseline.
>
> ⛔ Registry stays at 85. `LEVERS` stays at 18. If either moved, something in
> CS027 was out of scope — stop and report rather than updating the number.
>
> Commit: `cs-27 p6: version 1.0.0.27, doc sweep, results measured — CS027 complete`

---

## After CS027

**The real test is CS028.** A knob-adding phase should touch four files: the game
file, its own test, `test-registry.js`, and `STATUS.md`. If it touches more, the
sweep missed something and P3's grep should be re-run.

Deferred, in rough priority order:

- **Test comment budget applied retroactively.** 960 KB of the suite's 2.9 MB is
  comment prose. Not worth a dedicated phase; strip opportunistically.
- **World-dimension literals** (FLAG-CS027-c, 8 files) — migrate to
  `worldDims()` opportunistically.
- **Harness migration for the remaining ~105 files** — opportunistic, per FORK-A.
- Satellite sprite redesign; music intensity composition; menu/dialog extraction;
  the Godot port question. All unchanged by CS027.