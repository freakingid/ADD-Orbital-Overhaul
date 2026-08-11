# PLANNED FEATURES — Changeset 026

Opened against `65107a7` (`cs-25 p5: retune, version 1.0.0.25, doc sweep — CS025
complete`), build **`1.0.0.25`**, registry **75**, `LEVERS` **17**, **100** test
files in `scratchpad/`.

Two of Paul's items are the changeset's subject — **early-level pacing** and **the
delivery payoff** — plus five carried-forward items of maintenance. Every figure
below was read out of the shipped `asteroids-deluxe.html` by symbol, not from
memory, not from a summary.

---

## §0 — Preamble

### 0.1 ✅ ALL EIGHT FORKS ARE RESOLVED — PAUL'S ANSWERS

Recorded verbatim as the decision record. Every phase is buildable.

| Fork | Subject | **Resolution** |
|---|---|---|
| **FORK-CS026-A** | Split count | **Lever.** `junkSplit`, carried by `junkCount`: **2 through L10, 3 from L11** |
| **FORK-CS026-B** | `DEBRIS_MASS` conservation | **Leave the numbers**, rewrite the comment as a fitted ratio |
| **FORK-CS026-C** | `DEBRIS_SCORE` | **Accept** the leaner curve; no compensation |
| **FORK-CS026-D** | The tail fix | **Smaller world only** (no chevron), **1920×1080**, **levels 1–5** |
| **FORK-CS026-E** | Delivery feedback shape | **Spread the existing floaters** in place |
| **FORK-CS026-F** | HUD `COMBO` readout | **Drop it** |
| **FORK-CS026-G** | Incidental floater | **Quieter** — dimmed and smaller, never folded into the towed feedback |
| **FORK-CS026-H** | Git history unavailable | **Skip**, loudly; the closing phase asserts zero skips |

**⛔ FORK-C's accepted consequence, stated once so the gate can watch for it:**
`REPAIR_MILESTONE` is a fixed 10,000-point interval, so halving the debris score
curve halves how often the hull repairs itself. That is a real early-game
difficulty increase in the opposite direction from this changeset's intent. Gate
Q3 is what catches it.

**⛔ FORK-F's accepted risk:** the `COMBO n/24` readout was the only thing showing
the *denominator*. The spread floaters do not. Gate Q5 is what catches it.

Three non-blocking FLAGS remain at §9.2 (`DEBRIS_GARBAGE` holds at 4; the banner
stays in `P` exports). **FLAG-CS026-b is retired** — no chevron is built, so the
three-concurrent-chevrons question never arises.

### 0.2 ⛔ What CS026 is NOT

**The half-strength "Mega Delivery" at levels 6–11 is CANCELLED.** Gate B question
13 asked for it, CS024 P7 declined to invent it, CS025 P0 re-filed it as "CS026's
opening scope," and Paul has now decided against it. It is not in this changeset
and it is not deferred to a later one — it is dead.

`STATUS.md` still carries it as a live mandate in **four** places and the count
matters, because a P0 that fixes one and leaves three is worse than useless:

| `STATUS.md` section | What it says |
|---|---|
| `## Next up` (×4 paragraphs) | *"CS026's OPENING SCOPE — THE DEFERRED MEGA DELIVERY, STILL UNBUILT AND STILL THE FIRST THING TO DECIDE"* |
| `## Known issues` | *"THIS IS THE FIRST THING THE NEXT CHANGESET SHOULD DECIDE"* |
| `## Working / verified` | the CS024 P7 gate-outcome record |
| `## Playtest asks` (×3) | Gate B Q13's verbatim question and answer |

**The `Playtest asks` and `Working / verified` mentions are HISTORICAL RECORD and
must NOT be edited** — they record what the gate asked and what Paul answered at
the time, which remains true. Only the two *forward-looking* sections (`Next up`,
`Known issues`) carry a live mandate, and only those are rewritten. This is the
same distinction CS025 P0 drew for its `-old` disambiguation, and it is the
distinction that stopped that sweep falsifying its own record.

### 0.3 Verification performed for this spec

Fresh `git clone`; HEAD, root filenames and `GAME_VERSION` all confirmed. Every
anchor below greppped by symbol name. Registry count, lever count and the
per-level debris arithmetic were computed by **building the shipped script in a
headless factory and calling the real `leverState`**, not by reading the table.
`test-cs025-p5.js` and `test-starfield.js` were executed.

---

## §1 — Early-level pacing: the debris tree

### 1.1 What ships today

Wave clear is `game.debris.length === 0` (line ~8209) — **debris only**. Hunters,
saucers and loose garbage carry across the boundary by design (CS015 P3) and gate
nothing. So a level's length is entirely the debris tree.

`nextWave()` spawns `Math.round(liveLevers(game.wave).junkCount)` large satellites
through `spawnFieldSatellites()`, the only spawn path. Every satellite dies in one
hit. `destroyDebris()` splits with a hardcoded `for (let i = 0; i < 3; i++)`
(line ~6002).

### 1.2 The measured problem — and it is not where "early levels" suggests

Computed through the real `leverState`:

| Level | `junkCount` | Bodies (3-way) | Bodies (2-way) | Canisters shed (3-way) | Score (3-way) |
|---|---|---|---|---|---|
| 1 | 3 | 39 | 21 | 156 | 3,210 |
| 5 | 7 | 91 | 49 | 364 | 7,490 |
| **10** | **12** | **156** | **84** | **624** | **12,840** |
| 11 | 3 | 39 | 21 | 156 | 3,210 |
| 21 | 3 | 39 | 21 | 156 | 3,210 |

**`junkCount` sawtooths 3 → 12 every ten levels, so by body count the early levels
are the SHORTEST levels in the game.** Level 1 is 39 bodies; level 10 is 156. If
level 1 already reads as a slog, the bulk is not the cause — 39 one-shot kills at
the base `FIRE_COOLDOWN` is well under ten seconds of firing.

**Two consequences follow, and both bear on FORK-A.**

**(a) The "late waves go thin" worry does not survive the numbers.** At 2-way,
level 10 is **84 bodies — more than level 1 is today at 39**. The thinnest 2-way
level (21 bodies) is the same rung of the odometer that is thinnest now. A flat
cut lowers the whole sawtooth; it does not hollow out the top of it.

**(b) The problem is the tail, and the tail is a search problem.** The world is
2560×1440 and the viewport 1280×720, so **25% of the world is visible**. The last
two or three *smalls* are radius-13 bodies at 140–240 px/s somewhere in the other
75%, and the maximum wrap-aware distance from the ship is **1,469 px**. The only
two chevrons in the game point at the dock (r=42) and at a health powerup while
low (r=58). Nothing points at debris.

### 1.3 ⛔ FORK-CS026-A — flat knob, or a lever

The split count must land in the difficulty system one way or the other. A bare
constant is not an option (house rule).

**(a) FLAT KNOB.** `DEBRIS_SPLIT = 2`, a `DEBUG_ENTRIES` row in the **JUNK**
section, plus a `DIFFICULTY-LEVERS.md` **§4 not-a-lever row** stating why: the
branching factor of the debris tree is a *shape* constant, not a per-level
pressure axis, and an odometer sawtooth would make the tree **shallower again at
every wrap** — the same "takes capability back" objection that keeps
`payloadSlots` out of the odometer.

**(b) LEVER.** `junkSplit` joins the `LEVERS` table and **`junkCount`'s
`carriesTo` array**. It cannot be a driver (drivers-only-may-wrap, CS024 P6b — a
wrapping split count would take children back), so it must be carried, which means
it plateaus. At `floor: 2, ceil: 3, steps: 2` it reads **2 for levels 1–10 and 3
from level 11 forever**, because `junkCount` wraps every ten levels. That is a
clean, legible shape. It also costs: a `DIFFICULTY-LEVERS.md` §3 row, three debug
rows via `leverKnob()` (registry 75 → 78), a `DIFFLOG_FIELDS` column, and rounding
at the consumer — `Math.round`, not floor, for exactly the reasons `junkCount`'s
own comment gives.

**My reading, for what it is worth and not as a decision:** (a). The measured
sawtooth removes the argument (b) exists to answer, and (b) makes FORK-B a
per-level question instead of a one-time one.

### 1.4 ⛔ FORK-CS026-B — `DEBRIS_MASS` conservation

This is the fork the brief does not raise, and it is load-bearing.

```js
// MASS IS CONSERVED THROUGH THE 3-WAY SPLIT THE GAME ALREADY PERFORMS, which is where 9/3/1 comes from
// rather than from a fit: a large is 9 and becomes three mediums of 3; a medium is 3 and becomes three
// smalls of 1. Shattering a body therefore leaves the total mass on the board unchanged, and the 9:1
// ratio is what makes a small RICOCHET off a large instead of shoving it.
const DEBRIS_MASS = { 3: 9, 2: 3, 1: 1 };
```

Under a 2-way split that derivation is false: 9 → 2×3 = **6** → 4×1 = **4**. The
numbers still *work* — `debrisBounce()` only ever reads the ratio between two live
bodies, so a small still ricochets off a large — but **the stated reason for the
table stops being true**, and a future reader will either "fix" the table or "fix"
the split.

**(a) ACCEPT.** Keep 9/3/1, rewrite the comment and GDD §2.4 to say the ratio is
now a *fitted* 9:3:1 chosen for ricochet feel, with conservation recorded as a
retired property. Zero behavioural change; one honest doc edit.

**(b) RETUNE.** Pick masses that conserve through a 2-way split — 4/2/1. That
changes **every satellite-vs-satellite bounce in the game**, a CS023 P2 mechanic
that came through its own gate clean and unretuned, and it flattens the ratio from
9:1 to 4:1 so a small shoves a large noticeably harder.

**My reading:** (a). (b) reopens a settled mechanic to preserve a property nothing
reads.

### 1.5 ⛔ FORK-CS026-C — the score curve

`DEBRIS_SCORE = { 3: 20, 2: 50, 1: 100 }`. A full level-1 clear pays **3,210** at
3-way and **1,560** at 2-way; the whole curve halves at every level.

That is not cosmetic. `addScore()` drives `REPAIR_MILESTONE` (10,000 → +25 HP, or
`REPAIR_FULL_BONUS` 2,500 at full hull), so **halving debris score halves the rate
at which the hull repairs itself** — a difficulty change nobody asked for, in the
opposite direction from the one this changeset wants. It also makes every high
score in `afd_scores_v1` non-comparable with every future one.

**(a) LET IT HALVE.** Accept a genuinely harder repair cadence; note it in the
gate. **(b) COMPENSATE** by raising `DEBRIS_SCORE` so a full clear pays roughly
what it does now — at 2-way that is about `{3: 40, 2: 100, 1: 200}`, exactly
double, which is arithmetically clean and preserves the 1:2.5:5 tier shape.
**(c) COMPENSATE PARTIALLY**, e.g. 1.5×.

**No option preserves comparability with existing high scores.** That is a
consequence of the changeset, not of this fork, and the gate should see it stated
rather than discover it.

### 1.6 Hunters do NOT change, and the reason is an achievement

`destroyHunter()` carries its own `for (let i = 0; i < 3; i++)` (line ~6049). It
stays at 3, and this is not an oversight:

```js
const ACH_LINEAGE_FULL = 13;   // Hunter kills in one full lineage: 1 large + 3 medium + 9 small (Hunter's Bane)
```

A 2-way Hunter split makes a lineage **7** bodies and **Hunter's Bane
structurally unreachable**. P2's prompt must name this loop explicitly as
out of scope, because "the split loop" is ambiguous in the source and the wrong
one is one line away.

### 1.7 The garbage consequence — bigger than the brief states

`DEBRIS_GARBAGE` is 4 per kill at every tier. Against `GARBAGE_SOFT_MAX` **220**:

| Level | Canisters shed, 3-way | 2-way |
|---|---|---|
| 1 | 156 | 84 |
| 10 | **624** (2.8× the ceiling) | 336 |

Level 1's 156 against 220 is the comfortable case. **Level 10 sheds 624 and does
it again at 20, 30, forever**, against a ceiling culled one piece per frame. So
item 5 ("the density ceiling is still a guess") is not merely *re-asked* by this
changeset — **the split count is the largest single lever on it**, and the two must
be answered in the same gate or neither answer means anything.

`coalesceGarbage()`'s O(n²) walk is 24,090 pair visits/frame at 220. Halving the
tree is a performance *win*; nothing here tightens a frame budget.

### 1.8 Doc obligations, either fork

GDD §2 makes **four present-tense "3-way split" claims** (lines 55, 67, 78, 204)
and §3's Flow-functions row says *"pushes 3 children if `size > 1`"* — plus an
already-stale *"spawns `min(3+wave, 9)` debris"*. All of it moves with the split.
`DIFFICULTY-LEVERS.md` gains either a §3 row (fork b) or a §4 row (fork a).

---

## §2 — The tail: finding the last few

### 2.1 Option 1 — an off-screen debris chevron

Attacks the tail directly with **zero change to combat math**, which is what makes
it safe to ship alongside §1: it cannot make late levels thin.

The idiom already exists twice, both as inline literals with no constants:

```js
drawPoly([[7, 0], [-4, -4], [-4, 4]],
  VIEW_W/2 + Math.cos(a) * 42, VIEW_H/2 + Math.sin(a) * 42, a, COLOR.dock);   // dock, while hauling
// ...and the same shape at r = 58 in COLOR.lowhp, pointing at the nearest health powerup while low
```

A third at **r = 74** in `COLOR.debris`, pointing at the wrap-aware nearest live
debris, shown only while `game.debris.length <= DEBRIS_CHEVRON_AT` (default 3).
Nearest-scan via `dist2` and `angleTo`, never naive arithmetic.

**FLAG-CS026-b (non-blocking, best guess):** hauling + low HP + ≤3 debris puts
**three** chevrons on screen at once, at 42 / 58 / 74. Best guess is that this is
fine — they are concentric, differently coloured, and the situation is rare and
genuinely three-things-urgent. If the gate says it reads as clutter, the fix is a
precedence rule, not a radius change.

### 2.2 Option 2 — an early-level world shrink, and its hard floor

The brief calls this "close to a one-function change" because `worldSizeFor(level)`
already exists and returns a constant. **That is true only down to one specific
size, and grep gives the bound.**

`worldDims(size) = [VIEW_W × √size, VIEW_H × √size]`. `drawEntity()` renders each
body at **exactly one** wrapped image, and `onScreen()`'s reach is
`VIEW/2 + CULL_MARGIN(100) + radius` — so for a large satellite (r=46) the world's
**half-period must clear 786 × 506** or bodies clip at the seam instead of
crossing it.

| size | dims | visible | max search dist | verdict |
|---|---|---|---|---|
| **4** (today) | 2560×1440 | 25% | 1,469 px | shipped |
| **2.25** | **1920×1080** | **44%** | **1,101 px** | **the floor — clears both constraints** |
| 1.5625 | 1600×900 | 64% | 918 px | ⛔ vertical half-period **450 < 506** — clips |
| 1 | 1280×720 | 100% | 734 px | ⛔ clips, **and** see below |

**Size 1 fails a second way.** `SPAWN_MAX_DIST` is a flat 640 and `DOCK_MAX_DIST`
620; at a 720-px period a "far" spawn lands **80 px** from the ship wrap-aware —
inside `SPAWN_MIN_DIST` (220) and inside `DOCK_RADIUS` (88). Making the
whole world visible at once therefore requires scaling the spawn and dock rings
too, which is a different and much larger change than "return a smaller number."

**One further cost either way.** A non-constant `worldSizeFor` re-arms
`resizeWorld()` at wave boundaries — the six-step carried-entity re-homing pass
that moves Hunters, garbage, powerups, particles, floaters and the tow chain.
**It has not run in live play since CS024 P1 removed orbit levels.** It is still
exercised by `test-cs024-p1.js` §E, but "tested" and "shipped" are different
claims, and this would put it back on the critical path at every transition
level.

### 2.3 ⛔ FORK-CS026-D — which fix, and what "early" means

Two sub-questions:

**(i) Which?** Chevron, world shrink, or both. If both, they must be **separate
phases** so the gate can attribute the improvement — that is the whole reason the
brief proposed splitting them, and it is right.

**(ii) What is "early"?** Levels 1–3 or 1–5 — and note that under the odometer
this is a slightly odd question, since level 11 and level 21 are identical to
level 1. A world shrink keyed to `level <= 3` gives a small world at 1–3 and a
big one from 4 on, forever, including at the *identical* levels 11 and 21. A shrink
keyed to `junkCount` instead would follow the sawtooth. **The chevron does not have
this problem at all** — it keys on remaining debris, not on level.

**My reading:** the chevron, alone, in one phase. It costs nothing in balance,
cannot thin late levels, needs no world-size decision, and keys on the actual
condition ("few left, can't find them") rather than a level proxy. The world
shrink is a real option but it is a bigger phase than it looks and it should not
be spent on the same gate as the split change.

---

## §3 — The delivery payoff

### 3.1 The finding — nothing was removed

The escalating per-canister floater still fires on every towed delivery:

```js
game.floaters.push(new FloatText("+" + pts, node.x, node.y, COLOR.dock));
```

The HUD `COMBO n/24` readout (CS021 P4, `HUD_COMBO_X/Y/SIZE`) was an **addition**,
not a replacement. So this is a legibility defect, not a missing feature.

### 3.2 Why it reads as gone — the arithmetic

| | |
|---|---|
| `DOCK_OFFLOAD_INTERVAL` | **0.05 s** → 20 canisters/second |
| `FloatText.life` | **1.1 s** |
| `FloatText` rise | **30 px/s** |
| ⇒ spacing between consecutive floaters | **1.5 px** |

A 12-canister haul stacks twelve floaters inside a **33 px** band, all fading
together, at chain-tail positions themselves bunched within a few pixels. The
information is entirely present and entirely unreadable. `DOCK_OFFLOAD_INTERVAL`
was 0.13 until v3.4 P1; the floaters were tuned for the slow cadence and never
re-tuned for the fast one.

**Floaters render through `game.floaters.forEach(drawEntity)`** — world space,
culled, drawn at their nearest wrapped image. A dock-anchored tally therefore
renders and wraps correctly with no new machinery.

### 3.3 ⛔ FORK-CS026-E — the shape

**(a) ONE TALLY, UPDATED IN PLACE.** A single `FloatText` at `dock.y - 22` whose
`text` is rewritten and whose `life` resets on each canister: `+50 → +75 → +100`
ticking up. One object, unmistakable escalation, stacking structurally impossible.
Needs one new `game` field (the live tally's identity) declared in **both** the
`game` literal and `startGame()` — the standing CS016 P3 both-places rule.

**(b) A LADDER.** One floater per canister at the dock, offset by index so they
stair-step. Preserves "lots of value arriving"; needs a cap so a 24-haul does not
run off the top, and needs a rule for what the cap does when exceeded.

**(c) RETUNE IN PLACE.** Leave them at the node, raise the rise speed so they
separate. Cheapest; puts the text back over the ship, which is the crowding this
was moved away from.

**My reading:** (a), as the brief argues. It is the only one where the failure mode
is structurally unreachable rather than merely tuned away.

### 3.4 ⛔ FORK-CS026-F — does `COMBO n/24` stay?

If the dock feedback works, the HUD row may be redundant. Against removing it:
it is the only readout that shows the **denominator** (`/cargoMax`), it survives
the floater's 1.1 s life, and it closed FLAG-CS020-i deliberately. For removing
it: two things saying the same number in different places is how they drift.

### 3.5 ⛔ FORK-CS026-G — the incidental floater

**The brief names only the towed branch. There is a second one.** An *incidental*
delivery (a piece hooked while already parked inside the dock neighbourhood) pays
`DOCK_BASE_SCORE` and pushes its own floater:

```js
game.floaters.push(new FloatText("+" + DOCK_BASE_SCORE, node.x, node.y, COLOR.dock));
AudioSys.deliver(1);   // flat pitch, deliberately — an incidental is not part of the haul
```

Parked at the dock with a Magnet running, that is up to **20 `+50` floaters per
second** — the identical smear, and it is arguably the worse one, because
incidentals are exactly what a parked player generates. Options: fold them into
the same tally; give them their own quieter tell; or leave them alone. **They must
not silently inherit the towed tally**, because CS020 P1's whole point was that an
incidental is not part of the combo, and a shared tally would re-merge the two
concepts the counter was fixed to separate.

### 3.6 Deconfliction — the anchor is already occupied

Both of these fire at exactly the anchor point option (a) wants:

```js
new FloatText("SALVAGE BONUS", game.dock.x, game.dock.y - 22, COLOR.dock)      // at deliveryCount === 8
new FloatText("MAX HAUL",      game.dock.x, game.dock.y - 22, COLOR.ach, 24)   // at CARGO_CAP_MAX, + cargoFlash
```

The tally must yield, offset, or suppress for the frames those occupy. **Do not
touch `AudioSys.deliver(deliveryCount)`** — the audio half of the escalation
already works and is the one part of this that is not broken.

---

## §4 — The phase-reference helper

### 4.1 The cost, and the correction

Ten repairs across four changesets. Nine retired at once in CS024 P7; CS025 P5
retired the tenth (`test-cs025-p3.js` §G, `git diff --name-only HEAD`).

**⛔ CORRECTION TO THE BRIEF: `parentOf(subjectPrefix)` is the wrong shape.** What
CS025 P1/P2 actually ship is the *opposite* decomposition — the parent is a
**hardcoded literal SHA** (correct: a fixed reference, known at write time because
it is `HEAD` before the commit), and it is the phase's **own commit** that is
resolved dynamically, by subject, within `PARENT_SHA..HEAD`:

```js
const PARENT_SHA = "2cd73e870b860151a578816eacc1fca5a34933e5";
// ...
execFileSync("git", ["log", "--format=%H", "--grep", "^" + PHASE_SUBJECT, PARENT_SHA + "..HEAD"], ...)
execFileSync("git", ["diff", "--name-only", PARENT_SHA, shas[0]], ...)
```

So the helper wants **`parentSource(sha)`** (build the parent's script text, or
`null`) and **`ownCommit(parentSha, subjectPrefix)`** — not `parentOf`.

### 4.2 ⛔ FORK-CS026-H — skip, or fail, when git history is unavailable

**There is a live inconsistency for the helper to settle, and it is reproducible.**
On a shallow clone (`git clone --depth 1`):

- `test-cs025-p1.js` / `-p2.js` **skip** their git-dependent pins cleanly and pass
  (`catch → OLD = null`, every OLD-gated assertion guarded).
- **`test-cs025-p5.js` §G HARD-FAILS** — `fatal: bad revision '2cd73e8'`, then
  `FAIL: G: the parent commit (cs-25 p4) resolved`. **89 passed, 1 failed.**

Both behaviours are defensible. Skipping keeps the suite portable but risks a pin
passing vacuously forever. Failing makes vacuity impossible but makes the suite
un-runnable outside a full checkout — which is exactly the environment a fresh
verification clone lands in.

**(a) SKIP, LOUDLY** — print a `SKIPPED (no git history)` line and count it in the
summary, so a vacuous run is visible rather than silent. **(b) FAIL** — and accept
that `--depth 1` clones cannot run the suite. **(c) SKIP, but the CLOSING PHASE
asserts zero skips** — portable for everyday runs, non-vacuous where it counts.

**My reading:** (c). It is the only one that gets both properties, and the closing
phase already runs the full regression twice, so it is the natural place for the
check.

---

## §5 — Suite determinism

### 5.1 The five paths

| File | Symptom | Rate |
|---|---|---|
| `test-cs017-p3.js` | assertion **count** 1569 / 1570 | ~3 in 20 |
| `test-cs018-p4.js` | assertion **count** 535 / 541 | ~1 in 3 |
| `test-starfield.js` §D | genuine intermittent failure | ~1 in 15 |
| `test-p5.js` §C | genuine intermittent failure | ~1 in 30 |
| `test-cs017-p1.js` §F | genuine intermittent failure | characterised |

The first two always pass; only the count varies.

### 5.2 ⛔ CORRECTION: three of the five are the GAME's randomness, not the test's

The brief says *"Every one is unpinned `Math.random()`."* True — but **which
`Math.random()` is the whole design of the fix**, and grep splits the five:

| File | `Math.random` in the TEST file |
|---|---|
| `test-cs017-p3.js` | 5 |
| `test-cs017-p1.js` | 4 |
| `test-cs018-p4.js` | 3 |
| **`test-starfield.js`** | **0** |
| **`test-p5.js`** | **0** |

For the last two the randomness is the **game's** — 23 sites in
`asteroids-deluxe.html` — and critically, `starsNear` is generated at **module
load**, inside the factory:

```js
for (let i = 0; i < STAR_NEAR_COUNT; i++) {
  starsNear.push({ x: Math.random() * STAR_NEAR_TILE_W, ... });
}
```

`test-starfield.js` §D's failing assertion computes an expected screen-x for
`starsNear[0]` under a fractional camera shift and returns `null` when no tile
offset puts it on screen. That star's position is fixed the instant the factory
runs.

**So a utility that seeds call sites inside test files fixes nothing for two of
the five.** The seed has to be installed on the **global `Math.random`, before
`new Function(...)(...)` is invoked**, and restored afterwards. That is a
different deliverable from the one the brief describes and it changes P1's shape.

### 5.3 The shape

`scratchpad/_seeded-random.js`, Node CommonJS like everything else in
`scratchpad/`. A small deterministic PRNG (mulberry32 or equivalent — the exact
algorithm does not matter, only that it is pure, seeded and stable), plus
`withSeed(seed, fn)` that swaps `Math.random`, runs `fn`, and restores in a
`finally`. Test files wrap their **factory invocation**, not just their own
call sites.

**This does not violate the no-modules rule.** That rule binds
`asteroids-deluxe.html`; `scratchpad/` is already Node CommonJS with `require`.

---

## §6 — Level banner look-calls → knobs

Built by CS025 P5 out of the gate's own Q6 answer, so it arrived **after** the gate
closed and **has never been seen in motion**:

```js
const LEVEL_BANNER_TIME = 2.2, LEVEL_BANNER_FADE = 0.5, LEVEL_BANNER_SIZE = 72, LEVEL_BANNER_Y = 24;
```

All four are look-calls, not registry rows, so there is no slider — which collides
with the house rule that a gate reports a number. **Promoting them to knobs before
the gate turns an unanswerable question into an answerable one.** Four rows in the
**GLOBAL** section, appended after `startLevel` (registry 75 → 79, or 78 → 82 if
FORK-A resolves to a lever). Each constant stays in place as the row's `def`, the
standing "retune the const, never the `def`" convention.

**FLAG-CS026-c (non-blocking, best guess):** `drawLevelBanner()` is a sibling of
`drawHUD()` and is **outside** `Capture.hudVisible`, so `P` exports a frame with
"Level 2" across it for the first 2.2 s of every level. That is consistent with how
captions and the achievement toast are treated. Best guess: leave it, ask at the
gate. If the answer is "annoying," it is a one-line move inside the `H` gate.

The rest of the look-call backlog — `MODAL_*` (**12** constants, not ten), the four
`TITLE_MENU_*` values, the two-tab Achievements layout, the Save row's dim render
and the Difficulty lock's help text — stays a **report-in-words** gate item. They
are one-off menu geometry, not things that want sliders.

---

## §7 — The garbage density ceiling

`GARBAGE_SOFT_MAX` 220 / `GARBAGE_HARD_MAX` 300, flagged as a guess since CS024
(FLAG-CS024-c) and never moved. Both are live knobs (`garbageSoftMax`,
`garbageHardMax`, GARBAGE section), so this is answerable with a number today.

**§1.7 makes it urgent rather than merely overdue**, and the gate must ask it in
the same session as the split change or the answer is meaningless. Frame budget
bounds any raise: 24,090 pair visits/frame at 220, 44,850 at 300, ~99,900 at 450,
~500,000 at 1,000 — **quadratic**, so ~300–350 is affordable and beyond that wants
a spatial grid, not a bigger number.

---

## §8 — Registry additions

| Row | Section | Def | Range | Step | Phase |
|---|---|---|---|---|---|
| `debrisSplit` *(if FORK-A → a)* | JUNK | 2 | 2–4 | 1 | P2 |
| `junkSplitFloor/Ceil/Steps` *(if FORK-A → b)* | JUNK | via `leverKnob()` | derived | derived | P2 |
| `debrisChevronAt` *(if FORK-D includes the chevron)* | GLOBAL | 3 | 0–12 | 1 | P3 |
| `levelBannerTime` | GLOBAL | 2.2 | 0–8 | 0.1 | P5 |
| `levelBannerFade` | GLOBAL | 0.5 | 0–3 | 0.1 | P5 |
| `levelBannerSize` | GLOBAL | 72 | 16–160 | 4 | P5 |
| `levelBannerY` | GLOBAL | 24 | −200–200 | 4 | P5 |

**None of the banner four is a lever** — no floor/ceil/steps triple, no `▼`/`↳`, no
`carriesTo`, no `LEVERS` entry. They get a `DIFFICULTY-LEVERS.md` §4 not-a-lever
row saying why: a banner's size is a look-call, not a pressure axis.

**Registry undercounts historically — every prediction to date has.** Verify the
final number by building the file, not by adding up this table.

---

## §9 — Corrections

### 9.1 To the brief

1. **`parentOf()` is the wrong decomposition** — the parent is a literal, the *own
   commit* is what resolves by subject. §4.1.
2. **"Every one is unpinned `Math.random()`" is true but misleading** — two of the
   five test files contain none; the randomness is the game's, at module load. §5.2.
3. **`MODAL_*` is 12 constants, not ten.**
4. **GDD §3 carries 5 dangling `§2.13.1` occurrences across 3 lines, not four.**
5. **The "late waves too thin" caveat is not supported by the sawtooth** — at 2-way,
   level 10 is busier than level 1 is today. §1.2.
6. **The garbage figure is 624/level at the sawtooth peak, not 156.** §1.7.
7. **The world shrink has a hard floor at 1920×1080** and is not a one-function
   change below it. §2.2.
8. **`destroyHunter` carries a second 3-way loop** and `ACH_LINEAGE_FULL = 13`
   depends on it. §1.6.
9. **The incidental delivery branch has its own floater.** §3.5.
10. **`DEBRIS_MASS`'s stated rationale dies with the 3-way split.** §1.4.

### 9.2 Non-blocking FLAGS (best guesses — may be built on)

- **FLAG-CS026-a — `DEBRIS_GARBAGE` holds at 4.** Moving it in the same phase as
  the split would confound the gate's only clean read on garbage density. The gate
  asks for a number; a later changeset applies it.
- **FLAG-CS026-b — three concurrent chevrons is acceptable.** §2.1.
- **FLAG-CS026-c — the banner stays in `P` exports.** §6.

### 9.3 A prior-doc correction

`STATUS.md`'s CS025 P0 entry and `## Next up` both describe the Mega Delivery as
CS026's opening scope. That was true when written. §0.2 governs which mentions are
rewritten and which are preserved as record.

---

## §10 — ⛔ THE PLAYTEST GATE (blocking; sits between P5 and P6)

**Standing instruction: for anything on a slider, retune live and REPORT THE NUMBER
YOU LANDED ON, not a yes/no. "Fine" is a complete answer** — four closing phases on
record have been clean (CS020 P2, CS022 P4, CS024 P7, CS025 P5). Do not manufacture
changes to justify the gate.

**What to play:** levels **1 → 12** minimum for pacing, delivery and the banner. At
least one level in the **8–11** band, because that is where `junkCount` is at 10–12
and where the tree is four times level 1's — the pacing question is not answerable
from levels 1–3 alone. `startLevel` can sample a deep level but gives a level-N
field with a level-1 ship, so it is the wrong tool for anything reading on scoop
level or banked powerups.

**Q1 — pacing, the changeset's central bet.** With the split at its new value, does
a level *end* at about the right time? Play level 1 and a level in the 8–11 band and
say which one is wrong, if either. Slider: the split knob (JUNK section) — set it
back to 3 for the clean A/B. **Report the number.**

**Q2 — did the tail fix do the work?** With the split change alone the last few
satellites are still somewhere in the other 75% of the world. Does the tail fix make
"where is it" into "go there"? If it is the chevron: does ≤3 remaining feel like the
right trigger, or should it show earlier? Slider if built. **Report the number.**

**Q3 — the score curve.** Whatever FORK-C resolved to: does the run feel like it
pays what it should, and does the hull repair often enough? This is the question
that catches a wrong answer to FORK-C.

**Q4 — garbage density, and it must be answered in this session.** The split moved
the shed volume by roughly half at every level. Do you ever *see* a canister vanish?
(The cull is silent by design; catching one means `garbageSoftMax` is too low.) Does
a level-10 field read as salvage-rich or as noise? Sliders: `Garbage soft max`,
`Garbage hard max`. **Report the number.** ⛔ Do not raise past ~350 without saying
so — beyond that the O(n²) walk, not readability, is what binds.

**Q5 — the delivery payoff, the other central bet.** Deliver a full haul. Does the
escalation *read* now — can you see it climbing? Is the dock the right place for it,
or does it want to be nearer the ship? And the specific failure to watch for: does
it collide with `SALVAGE BONUS` (at 8) or `MAX HAUL` (at 24)?

**Q6 — the incidental case.** Park at the dock with a Magnet and let it feed you.
Whatever FORK-G resolved to: does that read as sensible, or as the same smear in a
new place?

**Q7 — the level banner, first sight.** It has never been playtested. Does "Level N"
at **72 px**, held **2.2 s** with a **0.5 s** ramp each end, read as *briefly, large,
easy to read, fading*? Too big, too long, too easy to miss in a busy frame? It sits
at screen centre, where the ship usually is — does it ever obscure something that
matters at the instant a level starts? **All four are sliders as of P5. Report the
numbers.** Also: `P` exports a frame with the banner across it for the first 2.2 s of
every level (FLAG-CS026-c). Correct, or annoying?

**Q8 — the look-call backlog, in words.** No sliders here, so words are the answer:
the modal dialog's proportions; the title menu's row spacing (the tightest in the
game); the two-tab Achievements layout; and specifically — **does the Options screen's
dim "Save" row read as *coming soon* or as *broken*?**

---

## §11 — Out of scope, recorded so it is not rediscovered

- **The half-strength Mega Delivery. Cancelled, not deferred.** §0.2.
- **A spatial grid for `coalesceGarbage()`.** Carried since CS024. Only becomes the
  answer if Q4 wants the ceiling past ~350.
- **The three `localStorage` keys' real-browser verification** (`afd_settings_v1`,
  `afd_scores_v1`, `afd_achievements_v2`) — exercised only through a headless stub
  since v1.9. **Not a phase**: one manual round-trip (set, reload, confirm) at the
  gate, reported in a sentence. Worth doing because the failure mode is asymmetric —
  per GDD §2.16, renaming or merging any of these silently wipes every player's data
  with no error and no symptom.
- **The satellite sprite redesign** (iconic real-world silhouettes in the vector
  style). Its own changeset; two clarifying questions still open.
- **Music intensity composition.** Deferred, unchanged.
- **The menu/dialog system as a reusable library.** Architecturally non-trivial.