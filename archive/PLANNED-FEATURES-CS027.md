# PLANNED FEATURES — CS027

**The maintenance changeset. Zero gameplay change.**

Parent: `89a9a3a` (`cs-26 p6`, `GAME_VERSION` `1.0.0.26`).
Registry at 85 rows, `LEVERS` at 18. Neither moves in CS027.

---

## §0. The problem, measured

Measured against the repo at `89a9a3a`. These are not estimates.

**Fixed per-session context cost.** `CLAUDE.md` (36 KB / ~9K tokens) plus
`STATUS.md` (615 KB / ~155K tokens) is **~164K tokens before a single line of
code is read.** `STATUS.md` carries 615 KB across 1,224 lines — ~500 chars per
line, one line at **38,364 characters**, and **six headings in the whole file**,
with 346 KB above the first one. There is no way to read a slice of it.

**The log is growing faster than the project.** `archive/STATUS-HISTORY.md`
holds CS009–CS022 — fourteen changesets in 950 KB, ~68 KB each. Live `STATUS.md`
holds CS023–CS026 — four changesets in 615 KB, **~154 KB each.** The logging rate
has risen 2.3x. It is also holding four changesets against a three-changeset rule.

**The suite is coupled to globals it doesn't own.** CS026 P3 changed **69 lines
of game code** and touched **30 files**, 25 of them pre-existing tests. The
repairs were almost entirely of this shape:

```js
-  eq(values.length, 78, "H: 78 value entries remain — the 21-tier-knob prune, P5's ...")
+  eq(values.length, 79, "H: 79 value entries remain — the 21-tier-knob prune, P5's ..., CS026 P3's earlyWorldLevels")
```

Counted exactly:
- **48 global registry-count assertion lines across 22 files** assert the literal
  `85`.
- **8 lever-count assertions across 6 files** assert `18`.
- **4 files** assert the section-header count `9`.
- **15 files** hardcode `"STATUS.md"` in a "nothing else changed" allowlist.

That is **~75 hand-edited assertion lines per knob added**, each with a
hand-maintained prose message reciting the registry's full history. A count
assertion inside `test-cs018-p4.js` protects nothing about CS018.

**There is no shared harness.** Of 109 files in `scratchpad/`: **108** re-extract
and comment-strip the `<script>` block independently, **107** stub the DOM
themselves, **105** define their own `assert`/`eq`/`close`. There are two
divergent regex idioms for the script extraction already.

**There is no runner.** 109 test files, no `run-all`. Nobody currently knows how
many of them pass.

**33% of test bytes are comment prose** — 960 KB of 2.9 MB. `test-cs026-p3.js`
opens with ~40 lines of essay before its first `require`.

---

## §1. What CS027 changes

1. A test runner, and a recorded baseline of what actually passes today.
2. A shared harness so a build-loading change is a 1-file edit, not a 108-file
   edit.
3. Canonical ownership of every global count, so adding a knob is a 1-file edit
   rather than a ~75-line sweep.
4. A `STATUS.md` that is one page, and a per-changeset narrative log that is
   never loaded.
5. A `CLAUDE.md` that states rules without rationale, with an explicit marker for
   settled decisions.

## §2. What CS027 does not change

⛔ **No gameplay change. No lever change. No registry change. No new knob.**

⛔ **TRAP-CS027-A — the changeset's central assertion.** At P6, the `<script>`
block of `asteroids-deluxe.html` differs from its content at `89a9a3a` by
**exactly one line**: the `GAME_VERSION` string. P6 asserts this via
`parentSource("89a9a3a…")` and a line diff. Any other delta is a defect in this
changeset, not a finding about the game.

⛔ **No retroactive migration of the 109 existing tests to the harness.** (FORK-A,
resolved: harness for new tests only; migrate opportunistically when a later
phase already has a file open.) The count-assertion sweep in P3 *is* exhaustive,
because it is mechanical and greppable.

---

## §3. The rules this changeset installs

### §3.1 Test ownership

> **A test asserts only what its own phase owns.** Presence and shape of the
> things that phase built — never a global count, total, or inventory of anything
> it did not build.

The replacement idiom. Instead of:

```js
eq(X.DEBUG_ENTRIES.length, 85, "A: the registry holds 85 value entries after CS026 P3 …");
```

a phase that added `earlyWorldLevels` asserts what it actually built:

```js
hasKnob(X, "earlyWorldLevels", { def: 5, min: 0, max: 20, step: 1 });
```

`test-registry.js` — and only `test-registry.js` — asserts `85`, `18`, and `9`.

### §3.2 STATUS.md is one page

Current changeset only, under ~400 lines. Per-phase entry: one ledger line plus
at most ~200 words. The closing phase moves the whole file to `log/CS0##.md` and
resets it from the template.

### §3.3 CLAUDE.md states rules, not reasons

Rationale relocates to `RATIONALE.md`, keyed by anchor, not session context. Two
markers survive into the rules themselves:

- **⛔ INVARIANT** — violating this breaks the build, save data, or a shipped
  guarantee.
- **⚠ SETTLED** — this looks wrong and is not. Do not fix it, do not re-litigate
  it, and do not change it in the same session you noticed it. Raise it with Paul.

**This is the load-bearing part of Paul's answer to FORK-B.** Claude Code does not
need the reasoning, but it does need to know *which* oddities are deliberate —
otherwise a "tidy-up" pass silently undoes a decision that cost a changeset to
reach. `⚠ SETTLED` is how that is communicated without carrying the prose.

Current `⚠ SETTLED` set (7): the two HUD fill exceptions; the `addScore` bypass;
the `VOICE_CRITICAL` park-and-revalidate narrowing; `drawLevelBanner()` not being
a caption; the `SCOOP_WIDTH[0]` load-time throw; the
`POWERUP_DROP_TYPES`/`_WEIGHTS` split; `destroyHunter()` staying unlevered. Plus
two on the pin rule (no "design doc untouched" pin; the version-pin mirror flip).

### §3.4 Test comment budget

~15 lines of header: what's under test, and any trap not obvious from the code.
Rationale belongs in the planning doc, which is already written and archived.
**Not retroactive** — applies to tests written from P1 on.

---

## §4. Forks and flags

**FORK-A — retroactive test migration.** ✅ **RESOLVED (Paul, this session):**
harness for new tests only; opportunistic migration; P3's count sweep exhaustive.

**FORK-B — does the narrative prose serve a purpose?** ✅ **RESOLVED (Paul, this
session):** *"The narrative prose does not serve a purpose. Claude Code only needs
to understand what is going on, what has happened — it doesn't need to know why.
If there are truly important caveats, such as warnings about not re-litigating
settled decisions, that would be important to communicate somehow."* Implemented
as §3.3's `⚠ SETTLED` marker plus `RATIONALE.md`.

**FORK-CS027-C — how far back does `log/` go?** ✅ **RESOLVED (Paul): split it.**
`archive/STATUS-HISTORY.md` (950 KB, CS009–CS022) becomes per-changeset `log/`
files and the original is deleted. Straight relocation; nothing is summarized.

**FORK-CS027-D — does `GDD-VERSION-HISTORY.md` also split?** ✅ **RESOLVED
(Paul): fold it.** Each changeset's changelog entry moves into that changeset's
`log/` file under `## GDD version history`; the central file is deleted. There is
no longer a separate changelog to maintain — a closing phase writes its entry to
`log/CS0##.md` alongside the narrative.

### §4.1 What the fork resolutions turned up

Three things the split surfaced that P4 has to handle, all verified at `89a9a3a`:

**(a) `archive/STATUS-HISTORY.md` is not one paragraph per changeset.** Only
**180 of its 618 paragraphs** carry a `CS0NN` marker; the other **438 are
continuation paragraphs** belonging to whichever marked paragraph precedes them.
A per-paragraph classifier would orphan 71% of the file. The split must be
**run-based**: a marked paragraph opens a run, and every following paragraph
joins that run until the next marker. P4's prompt says so explicitly.

**(b) The file is grouped two ways at once.** Lines 1–395 are a newest-first
rolling recap; lines 396+ are cross-changeset section buckets (`Working /
verified`, `Known issues`, `Balance notes`, `Next up`, `Playtest asks`). A CS022
bullet from `Known issues` must land in `log/CS022.md` under a *Known issues*
heading, not merged into that changeset's recap. The split key is
**(changeset, section)**, not changeset alone.

**(c) `GDD-VERSION-HISTORY.md` has a hole: there is no CS018 entry.** It runs
CS017 (line 75) → CS019 (line 77). CS018 unquestionably shipped — it has nine
test files and 21 attributable paragraphs in the STATUS history. CS014 is also
absent, but CS014 appears never to have existed as a changeset at all (one
incidental mention repo-wide), so that gap is probably correct. **P4 reports both
and fills neither** — reconstructing a missing changelog entry is a writing task,
not a relocation task, and it needs Paul.

**(d) The reference count is 174, not the ~19 estimated.** `GDD-VERSION-HISTORY`
is referenced 174 times across 39 files — but **128 of those are inside
`archive/`**, i.e. spent planning docs and the STATUS history that P4 itself
deletes. ⛔ **P4 does not repoint references inside `archive/`.** They are
historical records describing what was true when they were written; rewriting
them is pure churn and destroys their accuracy as artifacts. Live references
needing repointing: `ORBITAL-OVERHAUL-GDD.md` (5), `DIFFICULTY-LEVERS.md` (1),
`CLAUDE.md` (3, handled by P5's rewrite), and 18 across 11 files in
`scratchpad/`. `STATUS.md`'s 19 evaporate when P4 rewrites it.

**FLAG-CS027-a — the suite's true green state is unknown.** P1 establishes it. If
the baseline comes back with pre-existing failures, **P1 records them and stops**;
it does not fix them. Repairs get scoped into P2+ once we know the size.

**FLAG-CS027-b — GDD §5 (Session Handoff Protocol) is stale.** §5.4 rule 1 says
*"Deliver the complete file, not fragments,"* which directly contradicts
`CLAUDE.md`'s `str_replace` rule; §5.1 describes an attach-everything workflow
that predates `CLAUDE.md` being auto-loaded; §5.3's `STATUS.md` template is not
the template in use. P5 rewrites §5 to match reality. Non-blocking.

**FLAG-CS027-c — 8 test files hardcode world dimensions** (`2560`/`1440`/`1920`/
`1080`): `test-cs015-p5`, `-cs018-p9`, `-cs023-p2`, `-cs024-p1`, `-cs025-p2`,
`-cs026-p3`, `test-v31-coalesce`, `test-v31-world`. Same class of defect as the
count assertions, but only 8 files and the values are genuinely load-bearing in
several of them. P2 ships `worldDims(X)` in the harness; **migration is
opportunistic, not swept.** Non-blocking.

---

## §5. Success criteria

Measured at P6 and recorded in `STATUS.md`:

| Metric | At `89a9a3a` | Target |
|---|---|---|
| Fixed session context (`CLAUDE.md` + `STATUS.md`) | ~164K tokens | **< 12K** |
| Files edited to add one registry knob | ~24 (~75 lines) | **1** |
| Files edited to change how the build is loaded | 108 | **1** (for new tests) |
| Suite pass state | unknown | **known, and green** |
| `STATUS.md` | 615 KB, 6 headings | **< 40 KB, sectioned** |

The real test is CS028: a knob-adding phase should touch the game file, its own
test, `test-registry.js`, and `STATUS.md`. Four files.