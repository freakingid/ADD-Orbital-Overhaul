# IMPLEMENTATION PHASES — CS021

**Changeset:** CS021 — Orbit-level archetype
**Spec:** `PLANNED-FEATURES-CS021.md` (must sit beside this file at repo root)
**Baseline:** CS020 complete, `41d6ea5`, `"1.0.0.20"` → ships `"1.0.0.21"`
**Phases:** P1 core archetype · P2 difficulty scaling + levers · P3 debug panel · ⛔ playtest gate · P4 retune, version bump, doc sweep
**Optional:** P5 HUD combo readout (only if FORK-CS021-F resolves (a))

---

## ⛔ FORK GATE — before P1 can be scheduled

**No phase runs until Paul resolves the §3 fork ledger in the spec.** P1's prompt below is written against the *recommended* resolutions (A→a+c, B→a, C→b+i, D→b, E→open, F→open) and is annotated where a different resolution changes it. Two forks are pure taste and have no recommendation:

- **FORK-CS021-E** — which levels are orbit levels (every 3rd = 21 of 63? phase slots? delayed start?). P1 cannot wire `levelDef().archetype` without it.
- **FORK-CS021-F** — HUD combo readout (FLAG-CS020-i) in or out. Decides whether P5 exists.

Record resolutions in the spec's ledger (strike the ⛔, note the chosen option per fork) before the first session.

## Fork ledger (mirror — full text in spec §3)

| Fork | Subject | Resolution |
|---|---|---|
| FORK-CS021-A | Hub center & ship start | ⛔ (rec: dock-centered + spawn-safe reroll) |
| FORK-CS021-B | Ring count × tier fit | ⛔ (rec: 4 rings of size-3) |
| FORK-CS021-C | Motion + children | ⛔ (rec: slow orbit, one fast sparse ring; ballistic children) |
| FORK-CS021-D | Satellite totals | ⛔ (rec: density-scaled to ≈2× junkCount) |
| FORK-CS021-E | Schedule | ⛔ (no recommendation — Paul's call) |
| FORK-CS021-F | HUD combo readout in CS021 | ⛔ (no recommendation) |

## Phase / model assignments

| Phase | Model | Effort | Why |
|---|---|---|---|
| P1 | Opus 4.8 + thinking | xhigh | New motion mode + generator + `nextWave()` branch + spawn safety; the wrap-aware geometry and the split-site tangent handoff are the two places a cheap mistake is expensive |
| P2 | Sonnet 5 | high | Mechanical: occurrence math, lever row, small surface |
| P3 | Sonnet 5 | high | Registry idiom is well-worn; the only novelty is the reroll keybind |
| P4 | Sonnet 5 | high | Retune-and-close, same shape as CS019 P2 / CS020 P2 |
| P5 (optional) | Sonnet 5 | high | Small HUD element, no game-logic coupling |

One session per phase, one commit per phase, on `main`. Paul pushes; Claude Code never pushes. `ultrathink` goes **inside the message text** of P1's prompt.

## Pre-session preamble (paste **before** each phase prompt)

```
Session setup for CS021.

READ WHOLE, first, before any code:
  CLAUDE.md
  STATUS.md
  PLANNED-FEATURES-CS021.md
  IMPLEMENTATION-PHASES-CS021.md

GREP ONLY, never read whole (it is ~7,700+ lines):
  asteroids-deluxe.html
  ORBITAL-OVERHAUL-GDD.md   (P4 only; grep to the section, then read that section)
  DIFFICULTY-LEVERS.md      (P2 only; grep for where the lever row belongs)

DO NOT READ, DO NOT OPEN, AT ALL:
  GDD-VERSION-HISTORY.md    (P4 opens it ONLY to append, never to read for context)
  archive/
  PLANNED-FEATURES-CS020.md, IMPLEMENTATION-PHASES-CS020.md
  tools/                    (no voice work in this changeset — FLAG-CS021-e)

Anchors in the phase prompt are ESTIMATES. Re-grep every one by SYMBOL NAME
before editing. Never navigate by line number.

If a genuine design decision surfaces that PLANNED-FEATURES-CS021.md does not
cover, STOP and surface it. Do not invent design and do not quietly pick an
interpretation.
```

---

## P1 — the archetype: generator, motion mode, wiring

**Paste after the preamble:**

```
ultrathink

Implement CS021 Phase 1 per PLANNED-FEATURES-CS021.md §1, §4, and the resolved
forks in §3. This phase lands the orbit-level archetype end to end at fixed
(pre-P2, pre-P3) values. Corrections §2 are binding: no ES module, no new
satellite-size constant, no DECISIONS.md.

1. GENERATOR. Inline generateOrbitLayout() as a plain function near the other
   spawn logic (grep anchor: `function nextWave` — estimate only). Adapt the
   handoff text per spec §4.1: no export, no size-derived radius defaults,
   rand() not Math.random(), per-ring `maxCount >= 1` assertion, wrap-aware
   output via wrapPos(). satelliteDiameter comes from DEBRIS_RADII at the call
   site. innerRadius/radiusStep per the resolved FORK-CS021-B geometry (rec:
   180 / 150, 4 rings of size-3; re-derive if B resolved differently).

2. LEVELDEF. levelDef(n) gains `archetype` per resolved FORK-CS021-E. game.wave
   stays the one difficulty clock — no second clock, no cycle math (CS018 P4).

3. NEXTWAVE BRANCH. After `game.dock = new Dock();`, branch on archetype.
   "field": the existing spawn loop, byte-untouched (assert this — see tests).
   "orbit": call the generator centered on the dock (FORK-A rec), density curve
   per FORK-D rec, push one DebrisSatellite per satellite in orbit motion mode.
   junkCount is not consumed on orbit levels.

4. MOTION MODE. DebrisSatellite gains optional orbit state
   {orbitCenter, orbitRadius, orbitAngle, orbitAngVel}; update() advances the
   angle and derives x/y wrap-aware when present, existing drift path
   byte-untouched when absent. Ring angular velocities per FORK-C rec: slow
   base, the designated sparse ring faster (fixed multipliers, spec §5 — NOT
   occurrence-scaled in this changeset).

5. SPLIT. On shatter, children take vx/vy = parent's instantaneous orbital
   tangent and NO orbit state (FORK-C(i)). The split site's shape must not
   change — grep the size-1-from-size-2 push site and match its idiom.

6. SPAWN SAFETY (FORK-A(c)). After generation, any ring whose radius band
   contains the ship rerolls its startAngle (bounded attempts) until the
   nearest satellite clears the ship by >= minRequiredGap. If the bound is
   exhausted, log and accept the last roll — never infinite-loop a wave start.

7. TESTS. scratchpad/test-cs021-p1.js against the REAL startGame/update/
   nextWave path, rand() stubbed for determinism, run twice byte-identical:
   the spec §8 sweep items 1–6 at this phase's fixed values; the field-level
   byte-untouched proof (satellite count == junkCount, no orbit state on any
   field-level satellite); the tangent handoff (a child's speed equals
   orbitAngVel * orbitRadius within epsilon, direction perpendicular to the
   center ray); the maxCount guard (a deliberately tiny ring throws/skips,
   never places a negative gap); wrap correctness (generate with the dock near
   a world edge; every satellite's toroidal distance to center equals its ring
   radius — naive arithmetic must fail this if substituted).

GAME_VERSION untouched (TRAP 1). GDD/GDD-VERSION-HISTORY/DIFFICULTY-LEVERS
untouched (TRAP 2 — P2 owns the lever row, P4 owns the GDD). Baseline: run the
full scratchpad suite BEFORE editing and record the counts in STATUS.md.
Full regression after, twice, byte-identical. Update STATUS.md. Commit. Do not
push.
```

**Commit message:** `CS021 P1: orbit-level archetype — generator, orbit motion mode, nextWave branch, spawn safety`

---

## P2 — occurrence scaling + lever registration

**Paste after the preamble:**

```
Implement CS021 Phase 2 per PLANNED-FEATURES-CS021.md §5. P1 has landed and
moved anchors — re-grep everything by symbol.

1. Occurrence-scaled gap multiplier: gapMult(level) = max(1.8, 2.5 −
   (occurrence − 1) × 0.1), occurrence = ordinal among orbit levels under the
   resolved FORK-CS021-E schedule. Consumed by the nextWave orbit branch in
   place of P1's fixed value. ONE variable scales — densities and angular
   velocities stay fixed (spec §5).

2. DIFFICULTY-LEVERS.md gains the lever row (FLAG-CS021-d): name, curve, floor,
   the level at which the floor lands, and the fairness rationale. Grep the
   file for its row format; do not restructure anything.

3. TESTS. scratchpad/test-cs021-p2.js: gapMult table pinned at the first
   occurrence, the floor occurrence, and 63; the spec §8 sweep re-run at
   occurrence-scaled values (the fairness floor holds at EVERY orbit level
   through 63); a mutant check per the suite's convention — with the floor
   clamp removed, some deep level MUST violate item 1, proving the assertion
   has teeth.

GAME_VERSION untouched. GDD untouched. Baseline before, full regression after,
twice, byte-identical. STATUS.md. Commit. Do not push.
```

**Commit message:** `CS021 P2: occurrence-scaled orbit gap multiplier, lever registered`

---

## P3 — debug panel knobs, persistence, reroll

**Paste after the preamble:**

```
Implement CS021 Phase 3 per PLANNED-FEATURES-CS021.md §6 and FLAG-CS021-a/b/c.
P1+P2 have landed — re-grep anchors by symbol.

1. DEBUG_VARS gains { header: "ORBIT" } and eight entries per the spec §6
   table, standard idiom, defs derived from the shipped consts. Registry
   34 → 42.

2. Persistence: existing additive afd_settings_v1.debug path, known-value-
   else-default per field. No schema bump. No frozen-key change.
   returnToDefaults() resets bindings only — do not touch it.

3. Consumption: the nextWave orbit branch reads the knobs; orbitCount clamped
   per FLAG-CS021-a with radiusStep auto-derived and floored; densities
   consumed first-orbitCount per FLAG-CS021-b. Panel changes take effect on
   the next orbit level, or immediately via reroll.

4. Reroll (FLAG-CS021-c): keybind active while the debug panel is open during
   an orbit level; regenerates startAngles ONLY (counts/radii/densities
   untouched), re-running P1's spawn-safety pass. Documented on the panel
   footer. No new row kind.

5. REPOINTS. Four files pin the live registry count — test-cs018-p4.js §H,
   test-cs018-p6.js §I, test-cs018-p7.js §H, test-cs020-p1.js TRAP 3. Each
   gets the established treatment: new count (42) plus the ids of the entries
   that moved it, with a REPOINTED BY CS021 P3 note. Then sweep the whole
   suite for any fifth pin the spec did not anticipate (CS020 P1b found the
   surface wider than predicted — assume it is again).

6. TESTS. scratchpad/test-cs021-p3.js: every knob driven through the real
   applyDebug in display units; persistence round-trip incl. bad-value
   fallbacks per field; returnToDefaults() behavioral proof (bindings only);
   the orbitCount clamp (request 5 rings in a geometry where only 4 fit —
   the panel value clamps, the fairness sweep still passes); reroll changes
   startAngles and nothing else (counts/radii byte-identical before/after).

GAME_VERSION untouched. GDD untouched. Baseline before, full regression after,
twice, byte-identical. STATUS.md. Commit. Do not push.
```

**Commit message:** `CS021 P3: ORBIT debug section (34→42), additive persistence, startAngle reroll`

---

## ⛔ PLAYTEST GATE — between P3 and P4

P4 must not run until Paul has played the P3 build through at least the first three orbit occurrences. The knobs P4 exists to carry are the density curve, the base/fast angular velocities, and (if the floor feels wrong in the hands) the gap-mult curve. Questions for Paul:

1. **Fairness:** at the shipped curve, does threading ever feel like pixel luck rather than timing — especially inbound with a full tow chain (spec C5)?
2. **Rhythm:** does the density curve read as tight → breather → … → climax, or as noise?
3. **The fast sparse ring:** does timing pressure land, or does it read as unfair relative to the tight rings?
4. **Economy:** with FORK-D's scaled totals, do orbit levels feel like set-pieces or like grind? Any Hunter-pressure spikes from the harvest cascade?
5. **Spawn safety:** any wave start where the ship materialized inside or dangerously near a ring?

Record answers in STATUS.md's Playtest asks before P4's session. P4 retunes from **actual answers only** — never an invented interpretation (CS020 P2 precedent).

---

## P4 — retune, version bump, doc sweep, close

**Paste after the preamble:**

```
Implement CS021 Phase 4 — the closing phase: retune from Paul's gate answers,
version bump, doc sweep. No new logic.

1. RETUNE only what the gate answers direct; "no change" answers move nothing.
   Any retuned const must keep its DEBUG_VARS def derived, never duplicated.

2. GAME_VERSION "1.0.0.20" → "1.0.0.21". Grep the WHOLE repo for version pins
   rather than trusting any list — CS020 P2 found eight beyond the HTML and
   this changeset has added three test files since. Bump console labels and
   assert strings both; leave historical header-comment narratives alone
   (CS018 P10 precedent). Repoint the new files' own "unchanged this phase"
   pins to the mirror image (assert !== "1.0.0.20"), per the CS020 treatment.

3. GDD: shipped behavior only. §2's level-structure section gains the orbit
   archetype as built (schedule per resolved FORK-E, geometry, motion, the
   fairness floor and its curve, spawn safety, the erode-by-harvest property);
   §2.19 gains the ORBIT header + eight knobs and the registry count 34→42
   (nine headers); the Architecture Map rows for constants / DebrisSatellite /
   nextWave gain their new members. Nothing unbuilt enters — if P5 has not
   shipped, no HUD readout appears.

4. GDD-VERSION-HISTORY.md: append ONE consolidated CS021 entry (open only to
   append). DIFFICULTY-LEVERS.md: verify P2's row still matches any retune;
   update the row if a retune moved the curve.

5. Archive check: confirm PLANNED-FEATURES-CS020.md / IMPLEMENTATION-PHASES-
   CS020.md are in archive/ (Paul stages this in setup; verify, don't re-run).

6. Full regression, twice, byte-identical, counts recorded. STATUS.md gets the
   closing entry (CS021 COMPLETE). Commit. Do not push.
```

**Commit message:** `CS021 P4: retune from gate, version 1.0.0.21, doc sweep — CS021 complete`

---

## P5 (OPTIONAL) — HUD delivery-combo readout (FLAG-CS020-i)

Exists only if FORK-CS021-F resolves (a). Runs between the gate and P4 (so the GDD sweep can include it), or slides to CS022 untouched. Scope: a HUD element showing live `deliveryCount` / `cargoMax` during a delivery effort, visible whenever the count is non-zero; no scoring logic touched; `test-cs021-p5.js` proves the readout tracks the counter through a real skirt-and-return and vanishes on reset. Spec to be written into PLANNED-FEATURES-CS021.md as a §10 addendum **only if** the fork resolves (a) — nothing unbuilt enters the spec's shipped sections either.

---

## Session-setup checklist (Paul, before each phase)

1. Fork ledger fully resolved and recorded in the spec (before P1 only).
2. Both CS021 planning docs at repo root; CS020 docs moved to `archive/`.
3. Fresh Claude Code session, model/effort per the assignments table.
4. Paste the preamble, then the phase prompt (P1's `ultrathink` is inside the prompt text already).
5. After the session: review the diff, play the build, push when satisfied.