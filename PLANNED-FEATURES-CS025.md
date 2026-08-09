# PLANNED FEATURES — Changeset 025 (UFO CHAIN STAGGER)

**Status:** design complete, FORK-CS025-A resolved. Companion:
`IMPLEMENTATION-PHASES-CS025.md`.

**Prerequisite:** CS024 complete and shipped (`GAME_VERSION` `"1.0.0.24"`),
**including the drivers-only-wrap amendment folded into CS024 P4**. This
changeset finishes what that amendment started; it cannot run before it.

**Scope:** two phases and one gate. The odometer *semantics* fix ships in
CS024 P4 (§1, recorded here for its rationale); CS025 owns the UFO chain's
step-count stagger (§2), the playtest gate (§4), and the close.

---

## 0. Why this exists

CS024's lever tables were plotted level-by-level after the spec was written.
The arithmetic surfaced one defect and one dead zone that no amount of reading
the tables would have shown:

**The defect — a visible difficulty regression at level 33.**
`ufoFlightSpeedSmall` climbs 150 → 210 px/s across levels 1–25, then **resets to
150 at level 33**. A UFO at level 33 is genuinely slower than at level 25. This
was CS024's original semantics working exactly as specified — a carried lever
that itself has a `carriesTo` list wraps like any other — but flight speed is
one of the most legible quantities in the game, and a mid-run slowdown reads as
a bug rather than as breathing.

**The dead zone — a second generation that never arrives.**
`ufoShotSpeedSmall`, `ufoShotSpeedBig`, `ufoDirChange*` and `ufoAccuracySmall`
sat two carry generations deep. They moved exactly **twice** in the first 64
levels and did not reach their ceilings until **level 97**. For any realistic
run they were frozen constants wearing lever clothing.

### ✅ FORK-CS025-A — RESOLVED, route (a)

The semantics fix (§1) was folded into the **CS024 P4** prompt and is built
there, so this changeset never touches `leverState()`. That avoids a
build-then-invert cycle: CS024 P4 would otherwise have shipped the general
wrapping DAG plus tests asserting it, and CS025 would have restricted the
mechanism and inverted those tests one changeset later.

**Consequence:** §1 below is a **record of what CS024 P4 builds**, not a CS025
deliverable. CS025 is §2 alone — a table change, a playtest gate, and a close.

---

## 1. Only DRIVERS may wrap — BUILT IN CS024 P4, recorded here

**Not a CS025 deliverable.** This section is the design record for the rule; the
implementation lives in CS024 P4 per FORK-CS025-A route (a). It is kept here
because the rationale — and the plotted evidence for it — originated in this
changeset's analysis, and `DIFFICULTY-LEVERS.md` should be able to cite it.

**The rule:** a lever may declare `carriesTo` **only if it also declares
`everyNLevels`.** Every carried lever plateaus at its ceiling — always, with no
exceptions and no second generation.

This is a restriction of the odometer's original semantics, not a redesign.
Three consequences, all of them simplifications:

1. **The level-33 regression becomes structurally impossible.** No carried lever
   can ever return to its floor, so no quantity in the game can get easier as
   levels rise except by an explicit inverted floor/ceil pair, which is a
   deliberate authoring choice rather than an emergent one.
2. **The carry graph collapses to depth 1.** A driver and its direct dependents,
   full stop. `leverState()`'s propagation becomes a single pass rather than
   an iterated one, and the closed form is `Math.floor((wave - 1) /
   (everyN × steps))` carries into each dependent — no recursion.
3. **The load-time guard is a legality check, not a cycle check.** A cycle is
   unreachable by construction under this rule, so the guard is a **stronger and
   cheaper** one: throw if any lever declares `carriesTo` without
   `everyNLevels`, or names an unknown id. Same invariant-guard idiom as
   `SCOOP_WIDTH[0] !== 0` — **not test scaffolding, do not delete it on a
   cleanup pass.**

**The junk and hunter chains are unaffected.** `junkCount` and `coalescePause`
are drivers; their dependents already have empty `carriesTo` lists. Only the
UFO chain changes shape, and only because it was the one chain that used the
second generation.

**The assertion that enforces this** — *no lever in the shipped table returns
toward its floor at any level 1–200 except a driver* — is CS024 P4's, and it is
the single line that would have caught the level-33 defect without anyone
needing to plot anything. CS025 P1 restates it specifically over the UFO nine so
a later step-count retune fails in the file that owns those numbers.

**What is lost:** the ability to express a chain deeper than one carry
generation. Nothing in the shipped tables was using that deliberately — the UFO
chain got it by accident of authoring, not by design. If a future changeset
genuinely wants depth, it should reopen this rule explicitly rather than
discovering it still works.

---

## 2. The UFO chain, flattened and staggered

`ufoAppearFreq` remains the driver and now carries to **all nine** other UFO
levers directly. Step counts are re-staged so the levers saturate in a
deliberate order rather than all at once:

| Lever | floor | ceil | steps | reaches ceil |
|---|---|---|---|---|
| `ufoAppearFreq` *(driver, inverted, wraps every 8 levels)* | 25 | 12 | 8 | — cycles forever |
| `ufoFlightSpeedBig` | 100 | 150 | 5 | **L33** |
| `ufoFlightSpeedSmall` | 150 | 210 | 5 | **L33** |
| `ufoFireFreqBig` *(inverted)* | 1.8 | 0.7 | 6 | **L41** |
| `ufoFireFreqSmall` *(inverted)* | 1.8 | 0.6 | 6 | **L41** |
| `ufoDirChangeBig` *(inverted)* | 2.2 | 1.0 | 7 | **L49** |
| `ufoDirChangeSmall` *(inverted)* | 1.8 | 0.7 | 7 | **L49** |
| `ufoShotSpeedBig` | 300 | 430 | 8 | **L57** |
| `ufoShotSpeedSmall` | 320 | 470 | 8 | **L57** |
| `ufoAccuracySmall` *(inverted)* | 30 | 8 | 9 | **L65** |

Neither `ufoFlightSpeedBig` nor `ufoFlightSpeedSmall` declares a `carriesTo` —
under §1 they may not, and CS024 P4's guard throws at load time if one does.

**Check what CS024 shipped before editing.** The amendment note carried into
CS024 also suggested authoring these step counts in CS024 P5. If that happened,
CS025 P1 is a verification pass rather than an edit — report it and do not
manufacture a diff.

**The stagger is the design.** Speed arrives first (the UFO gets *faster*), then
rate of fire, then evasiveness, then shot velocity, and **accuracy last** — the
most lethal quantity creeps in over the longest span, in the smallest per-carry
increments (9 steps across 22° of aim error is ~2.75° per carry). A player who
reaches level 60 should feel the UFOs have become genuinely dangerous without
ever being able to point at the level it happened.

**Verified before speccing, not asserted:** all nine curves are **monotone in
the difficulty direction** across levels 1–72, and no lever returns toward its
floor at any level. This is P1's headless test, and it is the assertion that
would have caught the original defect.

**`ufoAppearFreq` still never permanently tightens** — it cycles 25 → 12 every
eight levels forever, at level 100 exactly as at level 1. This is **deliberate
and unchanged**: it is the chain's driver, and a driver that stopped cycling
would freeze every lever under it. UFO *pressure* escalates through the other
nine levers; UFO *rhythm* stays constant.

---

## 3. Optional: the finished chains (FLAG-CS025-b)

Plotting also showed that the junk chain fully saturates at **level 41** and the
hunter chain at **level 33**. After those points each chain is a single
repeating sawtooth on its driver with nothing escalating underneath.

**This is not specified as a change**, because there is no correct answer without
play. Two facts to hold: the game never goes *static* (both drivers keep
breathing), but it does stop getting *harder* on those axes well before the UFO
chain finishes at level 65.

Gate question 4 asks about it directly. If the answer is "levels 45+ feel flat,"
the fix is a step-count increase on the six dependent levers — a table edit, no
mechanism change — and it lands in this changeset's closing phase (P2). If the answer
is "fine," nothing moves. **Do not build this speculatively.**

---

## 4. Playtest gate

⛔ **Blocking.** **The questions themselves live in `IMPLEMENTATION-PHASES-CS025.md`'s gate
section** — single source, and it is the doc open in front of you at gate time.
That file also explains the full handoff under "How a playtest gate works."
What follows here is the design rationale for *why* the gate exists.
Play levels **25 → 45 at minimum** — the window where the old defect lived and
where the new stagger does its work.

1. **Levels 25 → 40:** do the UFOs read as continuously escalating? The old
   build got visibly slower at 33; the new one should not.
2. **Is the stagger legible?** Somewhere around 40–50 the UFOs should start
   feeling evasive rather than merely fast. Does that land as a change in
   character, or as undifferentiated pressure?
3. **Accuracy last:** by level 60, do small UFO shots feel genuinely
   threatening? If accuracy still feels harmless, 9 steps is too many.
4. **Levels 45+ overall** (FLAG-CS025-b, §3): with junk fully ramped at 41 and
   hunters at 33, does the late game feel flat, or does the UFO chain plus the
   two sawtooths carry it?
5. Every lever is a live slider. **Retune in-session and report the number you
   landed on, not a yes/no.**

---

## 5. Flags

**FORK-CS025-A** (§0) — **RESOLVED, route (a).** The semantics fix is folded
into CS024 P4. The former CS025 P1 is deleted and CS025 is a two-phase
changeset. Nothing here touches `leverState()`.

**FLAG-CS025-b** (§3) — the junk/hunter plateau. Gate question 4 is its A/B.
Not built speculatively; lands in P2 only if the gate asks for it.

**FLAG-CS025-c** — the nine step counts in §2 are chosen for stagger *shape*,
not tuned. Gate questions 2 and 3 own the numbers.

**FLAG-CS025-d** — removing depth-2 support is a genuine capability loss. It is
taken because nothing used it on purpose, not because depth is wrong. A future
changeset wanting it must reopen §1 explicitly. Since the rule now ships in
CS024, **check whether CS024's own doc sweep already recorded this** before
writing it again in P2.

---

## 6. Standing rules this changeset must not break

- **Nothing may validate, clamp, reorder or assert `floor <= ceil`** — six of
  the ten UFO levers are inverted. This prohibition is load-bearing and carries
  forward from the retired tier tables through CS024.
- **`leverState()` stays PURE and evaluable alone in a bare context.** Its
  bare-context test slices the source from the section banner to the closing
  brace; anything it reads must be inside that slice.
- **Levers are evaluated at the POINT OF USE**, never per frame, never cached
  across an event.
- **The structural guard is an invariant, not scaffolding** — it belongs to
  CS024 P4 and CS025 must not weaken or remove it.
- **Grep before speccing.** Every anchor here is an estimate that drifts the
  moment a phase lands.