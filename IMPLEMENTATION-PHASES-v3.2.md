# IMPLEMENTATION PHASES — v3.2 (Changeset 3)

Three phases, dependency-ordered, one Claude Code session each. Scope must not bleed.

**Why this order.** P1 makes a clump a *physical object* (mass, size, un-hookable). P2 gives the player the *tool* to deal with one (shoot it apart). Only then is it safe to P3 remove decay — do it before P2 and the field fills with permanent, un-hookable, un-breakable junk and the build is unplayable.

| Phase | Scope | Blocking forks |
|---|---|---|
| **P1** | Clump mass / radius / cluster render / un-hookable / mass-weighted attraction | ✅ A1, A2 decided |
| **P2** | Shoot a clump → shatter into its pieces | — |
| **P3** | Remove decay; close the garbage economy; retune delay + range; repurpose Waste Not | ✅ B decided |

✅ **All three forks are DECIDED** (FORK-A1 momentum-conserving · FORK-A2 non-solid · FORK-B scrap-born Hunters emit no garbage). Every prompt below already encodes them. **Paste as-is — nothing left to edit.**

---

## Phase 1 — Clump identity: mass, size, silhouette, un-hookable

**Model / effort:** Opus 4.8, medium. Mechanically contained, but it deliberately reverses a shipped, documented, headless-tested decision (FORK-2), so it needs care in the GDD, not just the code.

**Forks (decided):** FORK-A1 → momentum-conserving merge. FORK-A2 → clumps non-solid; the ship passes through.

### Paste-ready prompt

```
v3.2 Phase 1 — garbage clumps become physical: scaled mass, scaled size, cluster silhouette, un-hookable.

Read PLANNED-FEATURES-v3.2.md §A first. This phase REVERSES the shipped FORK-2 decision in
GDD §2.5.1 ("mass is NOT summed"). That was correct when clumps were hookable; Phase 2 makes
them un-hookable, so the reason for FORK-2 is gone. Rewrite §2.5.1 — do not append to it.

Grep the live build for current behaviour before you start. Do not trust these notes over the file.

CHANGES

1. Garbage.mass now SUMS on merge. In coalesceGarbage's merge branch, the survivor takes
   a.mass + b.mass (it currently keeps its base mass). `pieces` keeps its existing meaning
   (the 1..11 threat counter that triggers the Hunter at HUNTER_COALESCE_COUNT).

2. Garbage.radius becomes derived, not fixed: radius = 7 * Math.sqrt(this.pieces).
   Recompute it at every merge and wherever pieces changes. A single piece still reads 7.
   No new constant — 7 is the existing canister radius.

3. Merge velocity becomes MOMENTUM-CONSERVING, replacing the shipped literal vector sum:
       v = (a.mass * a.v + b.mass * b.v) / (a.mass + b.mass)
   computed with the PRE-merge masses. Rationale: with mass now summing and (Phase 3) garbage
   permanent, a literal sum makes every merge ADD speed — clumps end up the fastest objects on
   screen, backwards from "a heavy wad of junk." This intentionally breaks the exact-vector-sum
   assertion in scratchpad/test-v31-coalesce.js — REWRITE that assertion to check the momentum
   sum. Do not delete the test.

4. Attraction becomes mass-weighted, and must reduce EXACTLY to the shipped behaviour when both
   masses are 1.0 (so GARBAGE_MAGNET_PULL needs no retune):
       a.v += (dx/d) * GARBAGE_MAGNET_PULL * b.mass * dt
       b.v -= (dx/d) * GARBAGE_MAGNET_PULL * a.mass * dt
   (Gravity-like and momentum-conserving: m_a·acc_a == m_b·acc_b.) Heavy clumps become slow
   anchors that loose singles fall into. Keep the existing wrap-aware dist2/shortDelta math and
   the existing off-by-default GARBAGE_CLUMP_MAXSPD clamp exactly where they are.

5. RENDER a clump as a CLUSTER, not one big canister. In Garbage.draw(), when pieces > 1, draw
   `pieces` mini-canisters via the existing drawCanister at deterministic golden-angle offsets —
   for k in 0..pieces-1: theta = k * 2.39996, r = 5 * Math.sqrt(k) — all rotated by this.spin so
   the wad tumbles as one body. No stored per-clump state, no numerals, no new UI language.
   pieces === 1 must render byte-identically to today. Keep the mass<1 paler-tint rule.

6. A CLUMP CANNOT BE TOWED. The pickup hook in update() now additionally requires g.pieces === 1.
   This is the load-bearing rule of the whole changeset (Phase 2 gives the player the tool to
   break a clump open). The Magnet powerup pull must ALSO skip pieces > 1 — pulling something you
   can't hook is just noise.

7. Clumps stay NON-SOLID to the ship (FORK-A2, decided): zero contact damage, not added to the
   `hazards` array. Garbage is not the threat; what it becomes is. Do not touch the hazard loop.

DO NOT, in this phase: touch decay, touch bullet collision, add a shatter path, or change any
emission counts. Those are Phases 2 and 3.

HEADLESS TESTS (extend scratchpad/test-v31-coalesce.js — drive the REAL coalesceGarbage/update/
Garbage, no reimplementation): mass sums across a chain of merges; radius tracks 7*sqrt(pieces);
merge velocity is the momentum sum (not the vector sum) and a heavy clump absorbing a fast light
piece BARELY speeds up; two mass-1.0 singles behave numerically identically to the shipped
attraction (regression guard on the reduction); a pieces>1 clump sitting on the ship is NOT hooked;
Magnet does not pull a clump; a pieces=1 canister is still hooked and still pulled; draw() is
crash-free at pieces=1 and pieces=11. Re-run the FULL regression suite green.

DOCS: rewrite GDD §2.5.1 (mass sums, derived radius, momentum-conserving merge, mass-weighted
attraction, cluster render, un-hookable — and state plainly that this SUPERSEDES FORK-2 and why).
Update §2.10's "Collection & chain" paragraph (the hook now refuses clumps) and the Architecture
Map. Update STATUS.md per the house format. Do not push.
```

**Commit message:**
```
v3.2 P1: garbage clumps gain real mass, size, and a cluster silhouette

Reverses FORK-2 (GDD §2.5.1): a clump's mass now SUMS and its radius derives
from 7*sqrt(pieces), because Phase 2 makes clumps un-hookable and FORK-2's
reason (a clump must tow as one normal canister) no longer holds.

- mass sums on merge; radius = 7*sqrt(pieces) (single piece unchanged at 7)
- merge velocity is now momentum-conserving, replacing the literal vector sum:
  with mass summing and garbage soon permanent, literal-sum made every merge
  ADD speed, so clumps became the fastest things on screen
- attraction is mass-weighted (gravity-like, momentum-conserving); reduces
  exactly to the shipped force at mass 1.0, so GARBAGE_MAGNET_PULL is unretuned
- clumps render as a golden-angle cluster of mini-canisters, tumbling as one
- clumps CANNOT be hooked and are ignored by the Magnet (Phase 2 adds the tool)
- clumps stay non-solid to the ship (FORK-A2)

test-v31-coalesce.js extended; the exact-vector-sum assertion is rewritten to
the momentum sum. Full regression green.
```

---

## Phase 2 — Shatter a clump with one shot

**Model / effort:** Sonnet 5, medium. One new collision branch and one emission helper against a codebase whose patterns (`destroyDebris` fan-out, dead-flag + end-of-frame filter) it copies directly. Low ambiguity.

**Depends on P1** (needs the derived `radius` for the bullet test and the summed `mass` to redistribute).

### Paste-ready prompt

```
v3.2 Phase 2 — one bullet shatters a garbage clump into its constituent pieces.

Read PLANNED-FEATURES-v3.2.md §B first. Phase 1 made clumps un-hookable; this is the tool that
makes them worth something again. Grep the live build before you start.

CHANGES

1. New collision branch: PLAYER bullets vs garbage, but ONLY where g.pieces > 1. Put it in the
   non-hostile bullet loop alongside the existing debris/saucer/hunter branches, following the
   same shape (dist2 against the target's radius; b.dead = true; break). Single canisters
   (pieces === 1) are NOT bullet targets — player bullets still pass straight through them, as
   they always have. Hostile (saucer) bullets are unchanged and pass through everything garbage.

2. New shatterClump(g) flow function, placed and shaped like destroyDebris/destroyHunter (a flow
   function, not a method). On a hit:
     - g.dead = true
     - emit exactly g.pieces new Garbage at (g.x, g.y), each with:
         * mass = g.mass / g.pieces  (per-piece identity is averaged back out — accepted
           fidelity trade, FLAG A-3; keeps mass a single number, not an array)
         * pieces = 1
         * a FULL, re-armed coalesceDelay (the constructor default) so the wad disperses before
           it can start re-clumping
         * an outward kick: reuse the destroyDebris pattern — a random angle plus
           GARBAGE_SHATTER_KICK (new constant, rand(40, 90) px/s), added to a fraction of the
           clump's own velocity so the burst inherits its drift
     - a boom() at the clump's position for the pop (COLOR.garbage, small size)
   NO score. The reward is the 2-11 hookable canisters you just unlocked; do not add an
   addScore() call.

3. New constant GARBAGE_SHATTER_KICK in the salvage/chain block near the other GARBAGE_* values.
   Comment it as a playtest knob.

DO NOT, in this phase: touch decay, emission counts, the coalescence pass itself, or the Hunter
transform. Phase 3 owns those.

HEADLESS TESTS (new file, or extend test-v31-coalesce.js — drive the REAL bullet loop / update()):
one player bullet on a pieces=7 clump yields exactly 7 live single canisters, all pieces=1, all
with a full coalesceDelay, all mass = clumpMass/7, total mass conserved; those 7 do NOT
immediately re-merge on the next frame (the delay gate holds); a player bullet passes THROUGH a
pieces=1 canister without killing either; a hostile bullet passes through a clump; the 7 emitted
pieces ARE hookable (pieces===1) once in pickup range — i.e. the P1 gate now lets them through;
shattering does not touch game.stats.garbageDecayed. Re-run the FULL regression suite green.

DOCS: add the shatter rule to GDD §2.5.1 and to §2.10 ("Chain vulnerability" currently says
"Player bullets pass through garbage and chain (they're debris, not targets)" — that is now only
true of SINGLE canisters; fix it). Note the intended loop in §2.5.1: a 9-piece clump is a
countdown — shoot it for a near-full cargo run, or let it hit 12 and fight what it becomes.
Update the Architecture Map (new flow function, new constant) and STATUS.md. Do not push.
```

**Commit message:**
```
v3.2 P2: one shot shatters a garbage clump into its pieces

Clumps became un-hookable in P1; this is the tool that reopens them. A player
bullet on a pieces>1 clump destroys it and emits exactly `pieces` single
canisters, each with mass = clumpMass/pieces, a full re-armed coalesceDelay, and
an outward GARBAGE_SHATTER_KICK — a small pop of harvestable salvage.

- new shatterClump() flow function (shaped like destroyDebris/destroyHunter)
- new player-bullet-vs-clump collision branch; singles are still not targets,
  hostile bullets still pass through all garbage
- new GARBAGE_SHATTER_KICK constant (playtest knob)
- no score for the shatter: the reward is the canisters

This is the greed fulcrum: a 9-piece clump is a near-full cargo run if you break
it, or a Hunter if you don't. Full regression green.
```

---

## Phase 3 — Persistent salvage: remove decay, close the economy

**Model / effort:** Opus 4.8, high. Deleting the decay field is five minutes; the hard part is that decay was load-bearing for **field density**, for an **achievement**, and for a **documented design rationale that explicitly says don't remove it**. This phase has to close a runaway economy and rewrite three GDD sections without leaving contradictions behind.

**Fork (decided):** FORK-B → **B1, scrap-born Hunters emit no garbage** — the only option that actually closes the loop.

### Paste-ready prompt

```
v3.2 Phase 3 — salvage becomes permanent; close the garbage economy.

Read PLANNED-FEATURES-v3.2.md §C and §D first — especially the FORK-B economy analysis. This
phase deliberately overrules a shipped design rationale in GDD §2.10.1 that says, in bold, not to
do this. Grep the live build before you start.

CHANGES

1. GARBAGE NO LONGER DECAYS. Remove the `decay` field from Garbage entirely, plus the constants
   GARBAGE_DECAY and GARBAGE_SEVER_DECAY, the decay countdown and death in Garbage.update(), the
   blink-out branch in Garbage.draw(), and the game.stats.garbageDecayed increment. A canister now
   leaves the field by exactly two doors: RECYCLED, or CONSUMED INTO A HUNTER. Garbage.fromNode's
   decay parameter goes away with it. (Powerup decay is a separate system — do not touch it.)

2. CLOSE THE ECONOMY (FORK-B, decided: option B1). Right now 12 coalesced pieces become one Hunter
   core whose full lineage drops 66 canisters back out — a 5.5x amplifier. With decay gone that
   loop diverges. Fix: tag a coalescence-born core `bornOfScrap = true` at the transform site in
   coalesceGarbage; propagate the flag to its children in destroyHunter's 3-way split; and in
   destroyHunter, SKIP the garbage emission entirely for a bornOfScrap Hunter (all tiers, including
   the small-tier low-mass burst). 12 pieces in, 0 out. Score, splits, damage, and the small-tier
   powerup drop are all UNCHANGED — only the garbage emission is suppressed. Read it in-fiction:
   that scrap has already been spent; it IS the Hunter now. Timer-spawned Hunters are untouched
   and still drop garbage normally.

3. RETUNE two constants (both playtest knobs — comment them as such):
   - GARBAGE_COALESCE_DELAY 1.0 -> 6.0 s. At the shipped 20-55 px/s emission kick, 6 s carries
     same-explosion siblings 120-330 px apart, so they drift apart instead of instantly clumping.
     This is the "float through space and happen upon other garbage" feel the changeset asks for.
     (Phase 2's shatter path already reuses this same constant — one knob, not two.)
   - GARBAGE_MAGNET_RANGE 140 -> 260 px. 140 was tuned when garbage lived 12 s and only ever had
     to find siblings in a fresh, tight cloud. With permanent garbage, pieces that drift >140 px
     apart NEVER find each other and the field silts up with inert junk. Flag it in-code as the
     first thing to tune by feel.

4. REPURPOSE the "Waste Not" achievement, IN PLACE. Its current goal ("finish a game with zero
   canisters expired") auto-unlocks every game once decay is gone. Keep the id and the pool slot
   (so the 16-entry weekly pool length is unchanged and poolIndex / test-f9's hardcoded rotation
   slices need NO recompute — this is why we repurpose rather than retire). New meaning: "Finish a
   game with zero Hunters born from neglected scrap." Add one per-game stat, hunterCoalesced,
   incremented at the coalescence transform site in coalesceGarbage; rewrite the achievement's
   desc and its cur() to read (s.gameEnded && s.hunterCoalesced === 0). Consider renaming the
   display name if "Waste Not" no longer fits the new meaning — your call, but keep the id.

DO NOT, in this phase: add a spatial hash to coalesceGarbage (O(n^2) with the early-continue is
fine at realistic counts and render is already viewport-culled — this is a follow-up if a late-wave
stress test shows it, not scope creep here); change DEBRIS_GARBAGE / HUNTER_GARBAGE /
HUNTER_SMALL_GARBAGE (held in reserve as a playtest lever); or touch GARBAGE_CLUMP_MAXSPD.

HEADLESS TESTS (extend the coalescence + f9 suites; drive the REAL update/destroyHunter/
coalesceGarbage/evaluate): a canister survives an arbitrarily long update() run and never dies of
age; garbageDecayed is gone from stats (or is dead) and nothing references it; a bornOfScrap core
killed through its FULL lineage (large -> 3 med -> 9 small) emits ZERO garbage while still awarding
the same score and still dropping its small-tier powerup; a TIMER-spawned Hunter still emits the
full 12+54; the bornOfScrap flag survives both split generations; hunterCoalesced increments once
per transform; Waste Not unlocks on a zero-coalescence game and does NOT unlock after one Hunter is
born from scrap; the weekly pool is still length 16 and every existing poolIndex assertion in
test-f9 is UNCHANGED. Re-run the FULL regression suite green.

DOCS — this is the careful part, do not skip any of it:
 - GDD §2.10: rewrite the decay sentences in "Garbage drops" (canisters no longer decay; two exits
   only) and in "Chain vulnerability" (severed scrap no longer gets a shorter decay).
 - GDD §2.10.1: the bullet "Decay exists to protect readability — and matters more now" is now
   FALSE and says "don't remove it." REWRITE it. The new density levers are coalescence (which
   consumes pieces) and shatter-to-harvest (which makes the player want them). Say why the old
   rationale was superseded — a future session must not read a stale argument and "fix" it back.
 - GDD §2.5.1: the coalesced-Hunter section gains the bornOfScrap rule and its rationale.
 - GDD §2.17: the repurposed achievement.
 - Architecture Map + STATUS.md. Do not push.
```

**Commit message:**
```
v3.2 P3: salvage is permanent; the garbage economy closes

Garbage no longer decays — a canister leaves the field only by being recycled or
consumed into a Hunter. Supersedes GDD §2.10.1's "decay protects readability"
rationale (rewritten in place, with the reason, so it isn't "fixed" back later).

- removes decay, GARBAGE_DECAY, GARBAGE_SEVER_DECAY, the blink-out, garbageDecayed
- FORK-B / B1: a coalescence-born Hunter (bornOfScrap, propagated through both
  split generations) emits NO garbage at any tier. Without this the loop is a
  5.5x amplifier (12 pieces in -> a lineage dropping 66 back out) and permanent
  garbage diverges. Score, splits, damage, powerup drop all unchanged.
- GARBAGE_COALESCE_DELAY 1.0 -> 6.0 s: siblings from one explosion now drift
  apart instead of instantly clumping (the "happen upon each other" feel)
- GARBAGE_MAGNET_RANGE 140 -> 260: 140 was tuned for 12-second garbage; with
  permanent garbage, anything that drifts further apart never re-finds anything
- "Waste Not" repurposed in place (id + pool slot kept, so the weekly rotation
  math is untouched): now "finish a game with zero Hunters born from scrap"

Full regression green.
```

---

## Playtest asks for the round (for STATUS)

1. **`GARBAGE_COALESCE_DELAY` (6.0):** do same-explosion siblings visibly drift apart and *later* find strangers — or do they still snap together, or never clump at all?
2. **`GARBAGE_MAGNET_RANGE` (260):** does the field silt up with inert junk that never clumps and never gets collected? This is the number most likely to be wrong.
3. **Does the shatter loop actually fire?** Do you find yourself *hunting* clumps to break them, or ignoring them until they Hunter?
4. **Does a mass-11 clump read as heavy** (momentum-conserving merge + mass-weighted pull), or just as slow and boring?
5. **Is the cluster silhouette legible** at speed against a busy field, and does it read as *garbage* rather than *enemy*?
6. **Late-wave perf** with permanent garbage — frame time at wave 10+, given the O(n²) pass (FLAG D-2).
7. **Does B1 make letting a clump transform feel like a real choice** (a scrap-born lineage is pure score, no cleanup bill), or is shooting the clump always strictly correct?