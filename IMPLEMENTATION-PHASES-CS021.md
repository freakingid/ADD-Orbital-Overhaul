# IMPLEMENTATION PHASES — CS021

**Changeset:** CS021 — Orbit-level archetype + HUD delivery-combo readout
**Spec:** `PLANNED-FEATURES-CS021.md` (must sit beside this file at repo root)
**Baseline:** CS020 complete, `41d6ea5`, `"1.0.0.20"` → ships `"1.0.0.21"`
**Phases:** P1 archetype · P2 difficulty scaling + lever · P3 debug panel · P4 HUD combo readout · ⛔ playtest gate · P5 retune, version bump, doc sweep

✅ All forks resolved — P1 can be scheduled.

## Fork ledger (mirror — full text in spec §3)

| Fork | Subject | Resolution |
|---|---|---|
| FORK-CS021-A | Hub center & ship start | **(c)** dock-centered rings, ship never moved, `startAngle` rerolled for spawn safety |
| FORK-CS021-B | Ring count × tier | **(a)** 4 rings of size-3; radii 180/330/480/630, step 150, curve `[0.75, 0.45, 0.35, 0.85]` |
| FORK-CS021-C1 | Motion | **(b)** slow orbit, ring 3 markedly faster — **both velocities are debug knobs** |
| FORK-CS021-C2 | Children on shatter | **(i)** inherit tangent, no orbit state, split site unchanged |
| FORK-CS021-D | Totals | **(a)** accept the bonanza — 40 size-3s at first occurrence, 45 at the floor |
| FORK-CS021-E | Schedule | **(a)** every 3rd level: 3, 6, 9 … 63 (21 of 63) |
| FORK-CS021-F | HUD combo readout | **(a)** in scope — P4, spec §10 |

## Phase / model assignments

| Phase | Model | Effort | Why |
|---|---|---|---|
| P1 | Opus 4.8 + thinking | xhigh | New motion mode + generator + `nextWave()` branch + spawn safety; the wrap-aware geometry and the split-site tangent handoff are where a cheap mistake is expensive |
| P2 | Sonnet 5 | high | Mechanical: occurrence math, lever row, small surface |
| P3 | Sonnet 5 | high | Registry idiom is well-worn; novelty is the reroll keybind and the geometry clamp |
| P4 | Sonnet 5 | high | Display-only HUD element, no game-logic coupling |
| P5 | Sonnet 5 | high | Retune-and-close, same shape as CS019 P2 / CS020 P2 |

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
  ORBITAL-OVERHAUL-GDD.md   (P5 only; grep to the section, then read that section)
  DIFFICULTY-LEVERS.md      (P2 and P5 only; grep for where the lever row belongs)

DO NOT READ, DO NOT OPEN, AT ALL:
  GDD-VERSION-HISTORY.md    (P5 opens it ONLY to append, never to read for context)
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

Implement CS021 Phase 1 per PLANNED-FEATURES-CS021.md §1, §4 and the resolved
forks in §3. This phase lands the orbit-level archetype end to end at fixed
(pre-P2, pre-P3) values. Corrections §2 are binding: no ES module, no new
satellite-size constant, no DECISIONS.md.

1. GENERATOR. Inline generateOrbitLayout() as a plain function near the other
   spawn logic (grep anchor: `function nextWave` — estimate only). Adapt the
   handoff text per spec §4.1: no export, no size-derived radius defaults,
   rand() not Math.random(), per-ring `maxCount >= 1` assertion, wrap-aware
   output via wrapPos(), per-ring angVel on the returned object.
   satelliteDiameter comes from DEBRIS_RADII[3] * 2 at the CALL SITE.
   Geometry is spec §1.2 verbatim: innerRadius 180, radiusStep 150,
   orbitCount 4, curve [0.75, 0.45, 0.35, 0.85], gapMult 2.5, safetyMargin 8.
   Assert against §1.2's table: counts 6/6/7/21, total 40, outer edge 676.

2. LEVELDEF. levelDef(n) gains `archetype`, derived as n % 3 === 0 ? "orbit"
   : "field" (FORK-E). game.wave stays the ONE difficulty clock — no second
   clock, no cycle math (CS018 P4 invariant).

3. NEXTWAVE BRANCH. After `game.dock = new Dock();`, branch on archetype.
   "field": the existing spawn loop, byte-untouched. "orbit": call the
   generator centered on the dock, push one DebrisSatellite per satellite in
   orbit motion mode. junkCount is NOT consumed on orbit levels. Everything
   else in nextWave() runs identically for both archetypes.

4. MOTION MODE. DebrisSatellite gains optional orbit state
   {orbitCenter, orbitRadius, orbitAngle, orbitAngVel}; update() advances the
   angle and derives x/y wrap-aware when present, and the existing drift path
   is byte-untouched when absent. Sprite spin is independent and unchanged.
   This phase ships fixed velocities — base and the ring-3 fast multiplier are
   named consts whose values P3 will derive DEBUG_VARS defs from, so pick
   const names now and do not inline the numbers.

5. SPLIT. On shatter, children take vx/vy = the parent's instantaneous orbital
   tangent (speed = orbitAngVel * orbitRadius, perpendicular to the centre
   ray) and NO orbit state (FORK-C2(i)). The split site's shape must not
   change — grep the existing size-1-from-size-2 push site and match its idiom.

6. SPAWN SAFETY (FORK-A(c)). After generation, any ring whose radius band
   contains the ship rerolls its startAngle (bounded attempts) until the
   nearest satellite clears the ship by >= minRequiredGap. If the bound is
   exhausted, log and accept the last roll — never infinite-loop a wave start.
   Note the ring band is checked with WRAP-AWARE distance.

7. TESTS. scratchpad/test-cs021-p1.js against the REAL startGame/update/
   nextWave path, rand() stubbed for determinism, run twice byte-identical.
   Cover spec §8 items 1–8 at this phase's fixed values, and specifically:
   - the §1.2 geometry table pinned exactly (counts, gaps, edge, clearance);
   - the field-level proof: satellite count == junkCount, no orbit state on
     any field-level satellite, levelDef unchanged in every other column;
   - the tangent handoff: a child's speed equals orbitAngVel * orbitRadius
     within epsilon and its direction is perpendicular to the centre ray;
   - the maxCount guard: a deliberately tiny ring is rejected, never placed
     with a negative gap;
   - wrap correctness: generate with the dock near a world edge, assert every
     satellite's TOROIDAL distance to centre equals its ring radius (naive
     arithmetic must fail this if substituted);
   - spawn safety: seed the ship exactly on a ring band, assert the reroll
     clears it, and assert the bounded loop terminates;
   - the §8 item 7 frame-budget probe, REPORTED not gated: peak simultaneous
     entity count and per-frame update cost for a fully harvested level-3
     orbit wave vs a field-level control. Put the numbers in STATUS.md — P5's
     retune argues from them (FLAG-CS021-h).

GAME_VERSION untouched (TRAP 1). GDD / GDD-VERSION-HISTORY / DIFFICULTY-LEVERS
untouched (TRAP 2 — P2 owns the lever row, P5 owns the GDD). Baseline: run the
full scratchpad suite BEFORE editing and record the counts in STATUS.md. Full
regression after, twice, byte-identical. Update STATUS.md. Commit. Do not push.
```

**Commit message:** `CS021 P1: orbit-level archetype — generator, orbit motion mode, nextWave branch, spawn safety`

---

## P2 — occurrence scaling + lever registration

**Paste after the preamble:**

```
Implement CS021 Phase 2 per PLANNED-FEATURES-CS021.md §5. P1 has landed and
moved anchors — re-grep everything by symbol.

1. Occurrence-scaled gap multiplier: occurrence = level / 3 (FORK-E schedule),
   gapMult = max(1.8, 2.5 - (occurrence - 1) * 0.1). Consumed by the nextWave
   orbit branch in place of P1's fixed 2.5. ONE variable scales — densities and
   both angular velocities stay fixed across occurrences (spec §5).

2. DIFFICULTY-LEVERS.md gains the lever row (FLAG-CS021-d): name, curve, the
   1.8 floor, the level the floor lands at (24), and the fairness rationale.
   Grep the file for its row format; do not restructure anything.

3. TESTS. scratchpad/test-cs021-p2.js:
   - gapMult pinned at level 3 (2.5), level 24 (1.8, first floor level), and
     level 63 (1.8);
   - satellite totals across the scaling range: 40 at occurrence 1, 45 at the
     floor, with the maxCount widening (7/13/19/25 -> 8/14/21/28) asserted;
   - spec §8 sweep re-run at occurrence-scaled values: the fairness floor holds
     at EVERY orbit level 3 through 63;
   - a mutant check per the suite's convention: with the 1.8 clamp removed,
     some deep level MUST violate the floor, proving the assertion has teeth.

GAME_VERSION untouched. GDD untouched. Baseline before, full regression after,
twice, byte-identical. STATUS.md. Commit. Do not push.
```

**Commit message:** `CS021 P2: occurrence-scaled orbit gap multiplier, lever registered`

---

## P3 — debug panel knobs, persistence, reroll

**Paste after the preamble:**

```
Implement CS021 Phase 3 per PLANNED-FEATURES-CS021.md §6 and FLAG-CS021-a/b/c/g.
P1+P2 have landed — re-grep anchors by symbol.

1. DEBUG_VARS gains { header: "ORBIT" } and the TEN entries in the spec §6
   table, standard registry idiom, every def DERIVED from the shipped const
   (never a duplicated literal). Registry 34 -> 44; nine headers.
   Fractional steps are already supported — verified against
   chainGuardCooldown (def 0.75, step 0.05), so no x10 display workaround.
   orbitAngVel is in DEGREES/SECOND with toNative: v => v * Math.PI / 180,
   following the unit:"ms" + toNative precedent.

2. Persistence: the existing additive afd_settings_v1.debug path, known-value-
   else-default per field. No schema bump. No new key. No frozen key touched.
   returnToDefaults() resets bindings only — do not touch it.

3. Consumption: the nextWave orbit branch reads the knobs. orbitCount is
   geometry-clamped per FLAG-CS021-a (radiusStep auto-derived, floored at
   satelliteDiameter + 40 = 132; at size-3 the effective max is 4 and a
   requested 5 clamps down), and the panel shows the clamped value. Densities
   are consumed first-orbitCount per FLAG-CS021-b. Panel changes take effect on
   the next orbit level, or immediately via reroll.

4. Reroll (FLAG-CS021-c): a keybind active while the debug panel is open during
   an orbit level. Regenerates startAngles ONLY — counts, radii, densities and
   velocities byte-identical before and after — and re-runs P1's spawn-safety
   pass. Documented on the panel footer. No new row kind, no button machinery.

5. REPOINTS. Four files pin the live registry count: test-cs018-p4.js §H,
   test-cs018-p6.js §I, test-cs018-p7.js §H, test-cs020-p1.js TRAP 3. Each gets
   the established treatment — new count (44) plus the ids of the entries that
   moved it, with a REPOINTED BY CS021 P3 note. Then SWEEP THE WHOLE SUITE for
   a fifth pin the spec did not anticipate; CS020 P1b found this surface wider
   than predicted, so assume it is again.

6. TESTS. scratchpad/test-cs021-p3.js:
   - every knob driven through the real applyDebug in DISPLAY units, including
     toNative(30) === Math.PI/6 for orbitAngVel;
   - persistence round-trip including bad-value fallbacks per field;
   - returnToDefaults() behavioural proof (bindings only, orbit knobs survive);
   - the orbitCount clamp: request 5, get 4, and the fairness sweep still
     passes at the clamped geometry;
   - reroll changes startAngles and NOTHING else;
   - a velocity knob actually reaches the motion mode: set orbitAngVel, drive
     real frames, assert the angular advance matches.

GAME_VERSION untouched. GDD untouched. Baseline before, full regression after,
twice, byte-identical. STATUS.md. Commit. Do not push.
```

**Commit message:** `CS021 P3: ORBIT debug section (34→44), additive persistence, startAngle reroll`

---

## P4 — HUD delivery-combo readout (closes FLAG-CS020-i)

**Paste after the preamble:**

```
Implement CS021 Phase 4 per PLANNED-FEATURES-CS021.md §10. This closes
FLAG-CS020-i, which CS020 deferred to CS021 by name. It is orthogonal to P1-P3
— re-grep anchors, but nothing here touches the orbit archetype.

1. A HUD element showing the live delivery effort, deliveryCount / cargoMax,
   drawn whenever game.deliveryCount > 0. DISPLAY ONLY: read the existing
   state, never write it, never cache it into a second source of truth, and do
   not touch scoring, the one-effort rule, the grace window, the SMD, or any
   CS018 P8 reward latch.

2. It must track: counting up as TOWED nodes offload; holding through the
   DOCK_COMBO_GRACE window while the ship is outside the ring; vanishing when
   the effort ends by any of the three routes (towed hook outside the ring,
   window expiry, ship death via scatterChain). Incidental offloads do NOT
   advance the counter (CS020 P1) and must not advance the readout.

3. Ships PLAIN — no grace-window countdown indicator (spec §10). Placement and
   style follow the existing HUD's drawing conventions and colour roles; no new
   HUD system, no reflow of existing elements.

4. TESTS. scratchpad/test-cs021-p4.js against the real startGame/update/dock-
   offload path: the readout tracks the counter through a full skirt-and-return
   (the CS020 P1b 8/1100 scenario); an incidental at dock.radius + 39 does not
   advance it; it vanishes on window expiry and on ship death; it never appears
   at deliveryCount 0; and a source pin that no new write to game.deliveryCount
   was introduced (the count of write sites is unchanged from P3).

GAME_VERSION untouched. GDD untouched (P5 owns it). Baseline before, full
regression after, twice, byte-identical. STATUS.md. Commit. Do not push.
```

**Commit message:** `CS021 P4: HUD delivery-combo readout, closes FLAG-CS020-i`

---

## ⛔ PLAYTEST GATE — between P4 and P5

P5 must not run until Paul has played the P4 build through at least the first three orbit occurrences (levels 3, 6, 9) and ideally one past the floor. The values P5 exists to carry are the density curve, `orbitAngVel`, `orbitFastMult`, and — if the floor feels wrong in the hands — the gap-mult curve.

**Questions for Paul:**

1. **Fairness.** At the shipped curve, does threading ever feel like pixel luck rather than timing — especially **inbound with a full tow chain** (spec C5)?
2. **Rhythm.** Does the curve read as tight → breather → wide → climax, or as noise? Ring 4 at 21 satellites is the climax; ring 2 at 6 is the breather.
3. **The fast ring.** Does ring 3's timing pressure land, or does it read as unfair next to the tight rings? What did you settle `orbitAngVel` and `orbitFastMult` at while playing?
4. **The bonanza (FORK-D(a)).** 40 size-3s against a normal max of 13 — set-piece or grind? Any Hunter-pressure spike from the harvest cascade that needs the density dial pulled down?
5. **Frame budget.** Any hitching during full harvest? (P1's probe numbers are in STATUS.md; this is the in-hand check against them.)
6. **Spawn safety.** Any wave start where the ship materialised inside or dangerously near a ring?
7. **Schedule.** Every 3rd = 21 of 63. Does the archetype still feel special at occurrence 5, or repetitive? (A schedule change is CS022 work, not a P5 retune — but the answer belongs on record now.)
8. **HUD readout.** Does it read at a glance mid-haul? Do you want the grace-window countdown after all (spec §10's deferred detail)?

Record answers in STATUS.md's Playtest asks before P5's session. **P5 retunes from actual answers only** — never an invented interpretation (CS020 P2 precedent, where the gate answers were missing from the session's own setup and had to be asked before any edit).

---

## P5 — retune, version bump, doc sweep, close

**Paste after the preamble:**

```
Implement CS021 Phase 5 — the closing phase: retune from Paul's gate answers,
version bump, doc sweep. No new logic.

1. RETUNE only what the gate answers direct; "no change" answers move nothing.
   Any retuned const must keep its DEBUG_VARS def DERIVED from it, never
   duplicated. If gate Q8 asked for the grace-window countdown, that is a
   FEATURE, not a retune — surface it and leave it for CS022.

2. GAME_VERSION "1.0.0.20" -> "1.0.0.21". Grep the WHOLE repo for version pins
   rather than trusting any list — CS020 P2 found eight beyond the HTML, and
   CS021 has added four test files since. Bump both the console label and the
   assert message in each. Leave historical header-comment narratives alone
   (CS018 P10 / CS020 P2 precedent). Repoint the four new CS021 test files'
   own "unchanged this phase" pins to the mirror image (assert !== "1.0.0.20").

3. GDD, SHIPPED BEHAVIOUR ONLY. §2's level-structure section gains the orbit
   archetype as built: the every-3rd schedule, the 4-ring size-3 geometry, the
   dock centre and spawn safety, orbital motion and the fast ring, the fairness
   floor and its occurrence curve, the tangent-inheriting split and the
   erode-by-harvest property, and the deliberate satellite-count step up.
   §2.10's delivery section gains the HUD readout. §2.19 gains the ORBIT header
   + ten knobs and the registry count 34 -> 44 (nine headers). The Architecture
   Map rows for Constants / DebrisSatellite / nextWave / levelDef gain their new
   members. Nothing unbuilt enters — no countdown indicator, no schedule change.

4. GDD-VERSION-HISTORY.md: append ONE consolidated CS021 (P1-P5) entry, opened
   only to append. DIFFICULTY-LEVERS.md: verify P2's row still matches after any
   retune and update it if the curve moved.

5. Archive check: confirm PLANNED-FEATURES-CS020.md and
   IMPLEMENTATION-PHASES-CS020.md are already in archive/ (Paul stages this in
   setup — verify, do not re-run).

6. Full regression, twice, byte-identical, counts recorded. STATUS.md gets the
   closing entry (CS021 COMPLETE). Commit. Do not push.
```

**Commit message:** `CS021 P5: retune from gate, version 1.0.0.21, doc sweep — CS021 complete`

---

## Session-setup checklist (Paul, before each phase)

1. Both CS021 planning docs at repo root; CS020 docs moved to `archive/`.
2. Fresh Claude Code session, model/effort per the assignments table.
3. Paste the preamble, then the phase prompt (P1's `ultrathink` is already inside the prompt text).
4. After the session: review the diff, play the build, push when satisfied.
5. Before P5: gate answers written into STATUS.md's Playtest asks.