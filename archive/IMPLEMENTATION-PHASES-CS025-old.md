# IMPLEMENTATION PHASES — Changeset 025

> **⛔ SUPERSEDED AND ARCHIVED BY CS024 P7 (2026-08-10) — NO PHASE BELOW WAS
> EVER RUN AS WRITTEN, AND NONE REMAINS TO RUN.** CS025 was absorbed into
> CS024: the UFO step-count stagger shipped as **CS024 P6b**, the panel work
> its gate depended on as **CS024 P6c**, and its gate itself was folded into
> **Gate B**. There is no `"1.0.0.25"`; CS024 shipped `"1.0.0.24"` and the next
> changeset starts from there. Every phase prompt, TRAP and commit message
> below is historical — **do not paste one into a session.** The one part of
> this changeset still worth reading is `PLANNED-FEATURES-CS025.md` §0, cited
> by `DIFFICULTY-LEVERS.md` §2 as the record of why the drivers-only-wrap rule
> exists.

Companion to `PLANNED-FEATURES-CS025.md`. **One phase per session, one commit
per phase, on `main`.** Claude Code commits; Paul pushes.

**Prerequisite:** CS024 complete, `GAME_VERSION` `"1.0.0.24"`. Target:
`"1.0.0.25"` (P2 owns the bump).

> **FORK-CS025-A is RESOLVED — route (a).** The "only drivers may wrap"
> semantics were folded into the CS024 P4 prompt and will be built there, so
> **the former CS025 P1 is deleted** and the phases below are renumbered. The
> mechanism restriction, the depth-1 closed form, the replaced structural guard,
> and the "no lever returns toward its floor except a driver" assertion are all
> **CS024 P4's** deliverables now — CS025 does not touch `leverState()` at all.

## Phase map

| Phase | Scope | Model | Effort | `ultrathink` |
|---|---|---|---|---|
| **P1** | UFO chain staggered step counts | Sonnet | medium | no |
| ⛔ | **GATE** — blocking playtest, levels 25→45 ← *Paul plays; answers go in `STATUS.md`* | — | — | — |
| **P2** | Retune, version bump, doc sweep | Sonnet | medium | no |

CS025 is now a two-session changeset. If CS024 P5 already authored the staggered
step counts (see P1's first instruction), P1 collapses to a verification pass and
CS025 is effectively gate-and-close.

Standing rules are assumed and not restated in each prompt: read `CLAUDE.md`
then `STATUS.md` before touching code; update `STATUS.md` at the end; commit but
do not push; surface genuine design decisions rather than inventing them; prefer
`str_replace` over full-file rewrites; a phase is not done until its headless
test passes.

---

## How a playtest gate works (read this once)

A gate is a **stop**. Claude Code cannot answer these questions; only playing the
build can. The whole handoff:

**Step 1 — Claude Code opens the gate.** P1 ends its session by writing a
gate-open block into `STATUS.md` under the existing
`## Playtest asks (Paul — can't be checked headlessly)` heading: the questions
verbatim, plus a briefing on what the headless suite already settled. P1's
prompt carries this as its final instruction.

**Step 2 — Paul plays and answers.** Pull, open `asteroids-deluxe.html` in a
browser, play what the gate says, then **write the answers into that same
`STATUS.md` section.** Inline under each question; the repo's established style
is literally `Paul says: this is fine.` One line per question is enough.

*Alternative, if you'd rather not edit the file:* paste the answers into P2's
opening message and tell it to record them in `STATUS.md` first. Same outcome —
that is what CS020 P2 did when answers were missing.

**Step 3 — P2 reads them and proceeds.** It retunes from actual answers only.
If a question is unanswered, it must **stop and ask directly** rather than invent
an interpretation (CS020 P2 precedent, standing rule).

**Two things that make answers useful:** for anything on a debug slider, retune
live and **report the number you landed on, not a yes/no**; and **"fine" is a
complete answer** — a clean gate means P2 is bump-and-sweep only, which has
happened twice before (CS020 P2, CS022 P4).

---

## P1 — UFO chain staggered step counts

**Model: Sonnet · Effort: medium**

> Changeset 025, Phase 1. Implement per `PLANNED-FEATURES-CS025.md` §2. This is
> a **lever-table edit and nothing else** — no mechanism change, no new
> function, no call-site change, and no edit to `leverState()`.
>
> **FIRST, before editing anything: check what CS024 actually shipped.** Read the
> live `LEVERS` table and compare its nine UFO dependent levers against the
> target table below. CS024 P4 landed the drivers-only-wrap rule, and CS024 P5
> *may* have already authored these step counts. Three possible states:
>
> - **Already correct** — report that, run the verification tests below, and
>   commit the test file alone. Do not manufacture a diff.
> - **Partially correct** — bring the remainder into line and say exactly which
>   levers moved.
> - **Still CS024's original 4s** — apply the whole table.
>
> `ufoAppearFreq` stays the driver (25 → 12, 8 steps, `everyNLevels` 1) and
> carries to **all nine** other UFO levers directly. Target:
>
> | Lever | floor | ceil | steps | reaches ceil |
> |---|---|---|---|---|
> | `ufoFlightSpeedBig` | 100 | 150 | 5 | L33 |
> | `ufoFlightSpeedSmall` | 150 | 210 | 5 | L33 |
> | `ufoFireFreqBig` | 1.8 | 0.7 | 6 | L41 |
> | `ufoFireFreqSmall` | 1.8 | 0.6 | 6 | L41 |
> | `ufoDirChangeBig` | 2.2 | 1.0 | 7 | L49 |
> | `ufoDirChangeSmall` | 1.8 | 0.7 | 7 | L49 |
> | `ufoShotSpeedBig` | 300 | 430 | 8 | L57 |
> | `ufoShotSpeedSmall` | 320 | 470 | 8 | L57 |
> | `ufoAccuracySmall` | 30 | 8 | 9 | L65 |
>
> Floors and ceils are **unchanged from CS024**; only `steps` moves. Every one of
> these nine is a dependent, so none may declare `carriesTo` — CS024 P4's
> structural guard will throw at load time if one does.
>
> **The stagger is the design, and a comment at the table should say so:** speed
> arrives first, then rate of fire, then evasiveness, then shot velocity, and
> **accuracy last** — the most lethal quantity creeping in over the longest span
> in the smallest per-carry increments (9 steps across 22° is ~2.75° per carry).
> Do not "tidy" the step counts into a uniform number; the unevenness is the
> point.
>
> **`ufoAppearFreq` still cycles forever** and never permanently tightens — at
> level 100 exactly as at level 1. That is deliberate: it is the driver, and a
> driver that stopped cycling would freeze every lever under it. Do not "fix" it.
>
> **New `scratchpad/test-cs025-p1.js`.** The headline assertion is the one that
> would have caught the defect this whole changeset descends from: **every one of
> the nine dependents is monotone in its own difficulty direction across levels
> 1–200** — never returning toward its floor, at any level, for any lever. CS024
> P4 asserts this generically over the whole table; assert it here specifically
> over the UFO nine, with the saturation levels named, so a future step-count
> retune that accidentally reintroduces a regression fails in the file that owns
> those numbers. Also: each lever reaching its ceiling at exactly the level in the
> table above; every value arriving at the real `Saucer` constructor and
> `update()` through the actual spawn path, not read off `leverState` alone; big
> and small remaining independent on all four per-size levers; and big saucers
> still firing genuinely unaimed.
>
> **TRAP 1:** `GAME_VERSION` stays `"1.0.0.24"`. P2 owns the bump.
> **TRAP 2:** junk and hunter chains are out of scope and must be untouched —
> pin their `leverState` output byte-identical against `HEAD`.
> **TRAP 3:** no `floor <= ceil` validator, anywhere. Six of these nine are
> inverted.
> **TRAP 4:** `leverState()` itself is untouched this phase — pin it
> byte-identical against `HEAD`.
> **TRAP 5:** docs untouched — GDD, `GDD-VERSION-HISTORY.md`,
> `DIFFICULTY-LEVERS.md` are P2's job.
>
> **FINALLY — OPEN THE GATE.** This phase is followed by a blocking playtest.
> Before finishing, write a gate-open block into `STATUS.md` under the existing
> `## Playtest asks (Paul — can't be checked headlessly)` heading, following the
> shape CS021/CS022/CS023 used: state plainly that **the CS025 gate is open and
> P2 must not run until it is answered here**, reproduce the gate's five
> questions verbatim from `IMPLEMENTATION-PHASES-CS025.md`, say what to play
> (levels 25→45, reached by playing rather than by jumping the counter), and add
> a briefing listing **each of the ten UFO levers with its knob id, current
> value, saturation level, range and step**, so retuning at the gate is dragging
> a slider rather than hunting for one. Flag question 4 as the one that can add
> scope to P2.

**Commit:** `cs-25 p1: stagger the UFO chain's step counts`

---

## ⛔ GATE — BLOCKING PLAYTEST (after P1)

**P2 must not run until the questions below are answered in `STATUS.md`'s
`## Playtest asks` section.** See "How a playtest gate works" above. P1's own
prompt ends by writing these questions there.

**What to play: levels 25 → 45 at minimum** — that is the window where the old
level-33 defect lived and where the new stagger does its work. Getting there
from level 1 is the point; do not jump the level counter, since the whole
question is how the ramp *arrives*.

**The questions:**

1. **Levels 25 → 40:** do the UFOs read as continuously escalating? The pre-CS025
   build got visibly slower at 33; this one must not.
2. **Is the stagger legible?** Somewhere around 40–50 the UFOs should start
   feeling *evasive* rather than merely fast. Does that land as a change in
   character, or as undifferentiated pressure?
3. **Accuracy last:** by level 60, do small UFO shots feel genuinely threatening?
   If accuracy still feels harmless, 9 steps is too many — slide
   `ufoAccuracySmall` and report the number.
4. **Levels 45+ overall:** with junk fully ramped at 41 and hunters at 33, does
   the late game feel flat, or does the UFO chain plus the two sawtooths carry
   it? ← *this is the one that can add scope to P2*
5. **Any lever whose floor or ceiling is wrong.** Slide it, land on a number,
   report the number.

**⛔ Question 4 is the one that can add scope.** If levels 45+ come back flat,
P2 raises the step counts on the six junk/hunter dependent levers so those chains
saturate later (FLAG-CS025-b). That is a table edit, not a mechanism change — but
P2 will not do it unless the gate asks.

---

## P2 — Retune, version bump, doc sweep

**Model: Sonnet · Effort: medium**

> Changeset 025, Phase 2 — the closing phase. Read the gate's answers in
> `STATUS.md` first.
>
> **1. Retune.** Apply every number the gate returned. If it came back "no
> change," move nothing — the CS020 P2 / CS022 P4 precedent for a clean gate is
> that the closing phase is bump-and-sweep only.
>
> **2. FLAG-CS025-b, only if gate question 4 asks for it.** If levels 45+ came
> back flat, raise the step counts on the six junk/hunter dependent levers so
> those chains saturate later. **This is a table edit — no mechanism change.** If
> the gate said "fine," build nothing. Do not implement this speculatively.
>
> **3. Version bump.** `"1.0.0.24"` → `"1.0.0.25"`. **Grep for every pin rather
> than trusting a list** — this project has undercounted the pin set at every
> changeset that predicted it. Test files asserting `!== "1.0.0.24"` are
> repointed to their standing mirror image.
>
> **4. `DIFFICULTY-LEVERS.md`.** The UFO rows get their new step counts and a
> saturation-level column. Add a short paragraph recording **why** the
> drivers-only-wrap rule exists — the level-33 flight-speed regression, found by
> plotting the tables level by level rather than by reading them — because that
> is the kind of finding a future changeset will otherwise rediscover the hard
> way. The rule itself was documented by CS024's own doc sweep; **check what
> that sweep already said before writing, and extend rather than duplicate it.**
> Record the depth-2 capability loss (FLAG-CS025-d) explicitly if CS024's sweep
> did not: it was taken because nothing used depth on purpose, and a future
> changeset wanting it must reopen the rule rather than assume it still works.
>
> **5. GDD.** §2's odometer section gains the UFO stagger if it describes lever
> shape at that level of detail; if CS024's sweep already covers the mechanism,
> this may be a no-op. §2 describes shipped behaviour only.
>
> **6. `GDD-VERSION-HISTORY.md`:** one consolidated CS025 (P1–P2) entry. It
> should note that the changeset's mechanism half shipped inside CS024 P4 under
> FORK-CS025-A route (a), so the history is not confusing to read later.
>
> **7. `STATUS.md` archive check** — roughly the last three changesets stay
> live; older material relocates to `archive/STATUS-HISTORY.md`, newest-first,
> each entry its own paragraph, **without summarising or shortening**. Watch the
> trailing-newline pitfall on any shell append.
>
> **8. Archive** `PLANNED-FEATURES-CS024.md` and
> `IMPLEMENTATION-PHASES-CS024.md` to `archive/`.
>
> **TRAP 1:** `DIFFICULTY-LEVERS.md` must not still describe a carried lever as
> capable of wrapping.
> **TRAP 2:** full regression, run twice consecutively, both reported.

**Commit:** `cs-25 p2: retune, version 1.0.0.25, doc sweep — CS025 complete`