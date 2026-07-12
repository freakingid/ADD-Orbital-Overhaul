# IMPLEMENTATION PHASES — v3.4 (Change Set 5)

Companion to `PLANNED-FEATURES-v3.4.md` (the spec) and `orbital-overhaul-GDD.md` (design
authority). Seven phases. Each is one Claude Code session.

**Dependency graph:**
```
P1 (economy)  ─┐
P2 (levers)   ─┤  all independent — any order
P3 (scoop)    ─┤
P4 (magnet)   ─┤
P5 (low HP)   ─┘
P6 (music core) ──> P7 (music tracks)     P7 depends on P6
```
Recommended order is P1 → P7 as numbered: it front-loads the cheap, high-confidence work and
back-loads the two expensive ones, so if the round runs long you can ship a coherent partial.

**Standing rules for every phase** (already in `CLAUDE.md`, restated because they're the ones
that get broken):
- **Grep the live build before editing.** Never trust a value quoted in a planning doc.
- **Wrap-aware helpers (`dist2`, `angleTo`, `shortDelta`) are mandatory** for all world-space
  distance/aiming math.
- **Entity lifecycle:** dead-flag + end-of-frame `.filter()`. Never mid-loop splice.
- **All scoring routes through `addScore()`.** Tuning constants live in the constants block at
  the top of the file, never inline.
- **`localStorage` keys `afd_settings_v1` and `afd_achievements_v2` are FROZEN.**
- **`POWERUP_DROP_TYPES` must not receive new entries.** It drives the timed-effect HUD machinery.
- **GDD §2 describes shipped behavior only.** Update it in place at the end of each phase; never
  leave a contradiction standing.
- **Headless-test through the real `update()`.** No reimplementation of game logic in tests.
- **Do not push.** Paul commits and pushes.

---

## Phase 1 — Economy & dock tuning

**Spec:** §1 (Hunter drops), §2 (dock intake), §4 (tow cap 24)
**Blocked on:** nothing — ✅ FORK-1 resolved: (b), `{3:3, 2:2, 1:1}` + `DEBRIS_GARBAGE` 3→4
**Model:** Sonnet · **Thinking:** low (mechanical — except the chain stress test, which is
mechanical too, just careful)
**Why these three together:** all three are constants-and-one-loop edits to the same salvage
economy. Splitting them would mean re-greping the same three code regions three times.

### Paste-ready prompt

```
Orbital Overhaul — v3.4 Phase 1: economy & dock tuning.

Read CLAUDE.md first. Grep the live build for every constant below before you change it — do not
trust these numbers, confirm them.

THREE CHANGES, all in asteroids-deluxe.html.

(1) HUNTER GARBAGE DROPS SCALE BY TIER.
Currently: HUNTER_GARBAGE = 3 (used for BOTH large and medium) and HUNTER_SMALL_GARBAGE = 6
(small tier, at HUNTER_SMALL_MASS = 0.5). destroyHunter() branches on h.size === 1.

Replace both scalars with one per-tier table, matching the shape of HUNTER_RADII / HUNTER_SCORE /
HUNTER_DAMAGE:
    const HUNTER_GARBAGE = { 3: 3, 2: 2, 1: 1 };   // canisters per KILL, by tier
Delete HUNTER_SMALL_GARBAGE. KEEP HUNTER_SMALL_MASS = 0.5 — the small tier's single canister is
still low-mass scrap with the paler tint. destroyHunter reads HUNTER_GARBAGE[h.size] in BOTH
branches (the small-tier branch and the large/medium branch). Nothing else about destroyHunter
changes: score, the 3-way split, the small-tier maybeDropPowerup, the fan-out kick ranges all stay.

Also bump DEBRIS_GARBAGE 3 -> 4 in the same commit, commented as a playtest knob compensating for
the Hunter supply cut (FORK-1(b), confirmed). Total field supply should land close to today's
while Hunter drops still scale by tier as asked.

Mark HUNTER_GARBAGE and DEBRIS_GARBAGE as playtest knobs in comments — field density is the thing
most likely to be wrong after this.

(2) DOCK INTAKE RATE.
In the dock-offload block in update() there is a BARE LITERAL:  game.offloadTimer = 0.13;
Hoist it into the constants block next to the other DOCK_* values:
    const DOCK_OFFLOAD_INTERVAL = 0.05;   // PLAYTEST KNOB (was a bare literal 0.13). sec between
                                          // canisters peeling off at the dock.
and read the constant at the assignment site. Nothing else in that block changes — scoring, cargo
cap growth, and every achievement latch stay keyed to the same per-canister events.

(3) TOW CAPACITY 20 -> 24.
CARGO_CAP_MAX = 20 -> 24. Do NOT re-solve CARGO_THRUST / CARGO_MAXSPD / CARGO_MASS — a bigger hold
is SUPPOSED to cost handling. At m=24 that's ~41% thrust / ~58% top speed (vs 45%/63% at m=20);
the tug's massFactor is min(1.4, m*0.07) and already saturates at m≈20, so it doesn't get worse.

THIS ONE IS LOAD-BEARING AND NEEDS A TEST, NOT JUST AN EDIT: GDD §3.4's chain-stability envelope
was validated at 20 nodes / CHAIN_ITER 4. Write a headless stress driving the REAL updateChain():
a 24-node chain, hard thrust-flips across a world wrap, ~900 frames. Assert no NaN in any node
position, no velocity blowup, and report the worst-case link stretch on the 20 px CHAIN_LINK.
If worst-case stretch exceeds ~5 px, bump CHAIN_ITER 4 -> 5 and re-assert. Report the number
either way — I want to see it.

Also confirm by grep (do not change): Heavy Hauler / Freight Baron / The Long Haul all latch on
the literal `game.deliveryCount === 12`, NOT on game.cargoMax. They must stay decoupled.

TESTS: extend the existing scratchpad tests (do not create a new file if an existing one owns the
system). Drive the REAL destroyHunter / update() / updateChain — no reimplementation.
- A full 13-member Hunter lineage (1 large -> 3 medium -> 9 small) emits exactly 3 + 6 + 9 = 18
  canisters, with the 9 small-tier pieces at mass 0.5 and the rest at 1.0. Total score unchanged.
- The small tier still drops no children and still calls maybeDropPowerup.
- A dock offload delivers at DOCK_OFFLOAD_INTERVAL; a full 24-node chain fully offloads.
- The chain cap: game.cargoMax can reach 24 (drive the real dock-offload growth path), and the
  pickup gate refuses a 25th node.
- The 24-node stability stress above.
Update the existing config assertions for the new constant values.

GDD: rewrite IN PLACE (do not append a contradiction):
- §2.5 — the "every tier emits garbage" bullet and the small-tier low-mass-reward line.
- §2.5.1 — the "12-in / 66-out amplifier" arithmetic. A full lineage now yields 18, not 66. The
  v3.3 9b rationale (decay is the governor, not emission suppression) still HOLDS and must survive.
- §2.10 / §2.10.2 — the new cap, the intake constant, and the m=24 handling numbers.
- §3.4 — the stability envelope, revalidated at 24 nodes (and CHAIN_ITER if you changed it).
- §4 backlog — log "rectangular dock geometry" as considered-and-declined for this round.
- Architecture Map: Constants row. Version line. New §7 Version History entry.
Update STATUS.md. Do not push.
```

**Commit:** `v3.4 P1: per-tier Hunter garbage drops, faster dock intake, 24-piece tow cap`

---

## Phase 2 — Difficulty levers + powerup/dock sizing

**Spec:** §5, §6, §10
**Blocked on:** nothing
**Model:** Sonnet · **Thinking:** low
**Note:** this phase introduces the `leverScale` mechanism that every future difficulty lever
will reuse, and it writes `DIFFICULTY-LEVERS.md`. The mechanism matters more than the two levers.

### Paste-ready prompt

```
Orbital Overhaul — v3.4 Phase 2: the difficulty-lever mechanism + powerup & dock sizing.

Read CLAUDE.md first. Grep the live build before editing.

(1) THE MECHANISM. Add to the constants area, near difficultyFactor()/ramp():

    // A difficulty lever scales a quantity from `start` (wave 1) toward `floor` (full difficulty)
    // along the SHIPPED difficultyFactor() curve — levers never get their own curve. When
    // `enabled` is false the lever is INERT: the quantity is pinned at `start`, so the lever is
    // built, wired and testable but does not ramp. `floor` is a HARD CLAMP — a lever can never
    // take a quantity below its shipped baseline. See DIFFICULTY-LEVERS.md.
    function leverScale(lever, wave) {
      const s = lever.enabled ? ramp(lever.start, lever.floor, wave) : lever.start;
      return Math.max(lever.floor, s);
    }

(2) POWERUP SIZE LEVER.
    const LEVER_POWERUP_SIZE = { enabled: false, start: 2.0, floor: 1.0 };
POWERUP_RADIUS (15) stays as the baseline. In the Powerup constructor:
    this.radius = POWERUP_RADIUS * leverScale(LEVER_POWERUP_SIZE, game.wave);
CRITICAL, EASY TO MISS: the powerup pickup check in update() currently reads the CONSTANT
(`const r = POWERUP_RADIUS + SHIP_RADIUS;`). It must read `p.radius + SHIP_RADIUS` instead, or the
collision circle will silently disagree with the rendered sprite. The draw path already scales off
this.radius (the hex housing and drawPowerupGlyph's `r` arg), so it needs no change. Verify that.

(3) DOCK SIZE LEVER.
    const LEVER_DOCK_SIZE = { enabled: false, start: 2.0, floor: 1.0 };
In the Dock constructor: this.radius = DOCK_RADIUS * leverScale(LEVER_DOCK_SIZE, game.wave), and
bake this.pts from this.radius.
Then find EVERY other read of DOCK_RADIUS and route it through dock.radius. There are several and
they are scattered — grep for all of them. At minimum:
  - Dock.draw(): the intake vanes (currently DOCK_RADIUS - 10, plus a hardcoded inner radius 14)
    and the "RECYCLE" label offset (+22). These must scale with this.radius or the dock looks
    broken at 2x — scale the 14 and the 22 proportionally, don't leave them absolute.
  - update(): the offload proximity gate (DOCK_RADIUS + 10) and the combo-reset distance
    (DOCK_RADIUS + 40). Route the RADIUS through dock.radius but LEAVE the +10 / +40 margins as
    absolute px — those are feel margins, not geometry.
A new Dock is constructed each wave, so once the lever is enabled the dock re-sizes per wave with
no mid-wave mutation. That's the intent.

BOTH LEVERS SHIP DISABLED. The observable effect of this phase is simply that powerups and the
dock are permanently 2x bigger. That is correct and intended.

(4) NEW DOC: DIFFICULTY-LEVERS.md at repo root. This is a LIVING doc — it is never archived.
Structure (house convention — it MUST have an Assumptions & Decisions section):
  1. Purpose — what a lever is, why they're catalogued centrally.
  2. The mechanism — leverScale / ramp / difficultyFactor, the enabled/disabled contract, the
     floor-is-a-hard-clamp rule.
  3. Lever registry — one entry per lever: name, constant, what it scales, start, floor, enabled?,
     shipped-in version, playtest status. Seed with LEVER_POWERUP_SIZE and LEVER_DOCK_SIZE (both
     start 2.0, floor 1.0, DISABLED, v3.4).
  4. Assumptions & Decisions:
     - Levers ramp on game.wave via the existing difficultyFactor curve. They do NOT get their own
       curve — RAMP_WAVES governs the whole game's pacing (GDD §2.13).
     - A lever's `floor` is always the SHIPPED BASELINE, so enabling a lever can only ever return
       the game to today's difficulty, never past it. Making the game harder than today requires a
       baseline change, not a lever flip.
     - Levers are evaluated at ENTITY CONSTRUCTION, not per frame. Ramping affects newly-spawned
       objects only, and never touches the per-frame path.
     - Both v3.4 levers ship disabled — they are tooling, not a balance change.
  5. Candidate levers not yet built — a running list for future rounds. Seed it with:
     HUNTER_GARBAGE counts, GARBAGE_DECAY, POWERUP_DROP_CHANCE, CARGO_GROW_PER.

TESTS: new scratchpad file. Drive the REAL Powerup / Dock / update() — no reimplementation.
- leverScale: disabled -> always `start` regardless of wave; enabled -> `start` at wave 1,
  monotonically approaches `floor` as wave climbs, never goes below `floor` at any wave (sweep to
  wave 200).
- A Powerup constructed at wave 1 has radius === POWERUP_RADIUS * 2; the pickup gate fires at that
  radius (drive the real update(): a powerup at 40 px from the ship IS collected at 2x and would
  NOT be at 1x). Assert the render `r` and the collision `r` are the same number.
- A Dock constructed at wave 1 has radius === DOCK_RADIUS * 2, its baked pts reach that radius, and
  the real offload gate fires at the scaled distance. draw() is crash-free.
- Flip each lever's enabled to true in the test and assert the ramp shrinks the quantity toward the
  floor and clamps there — the levers must be PROVEN to work while shipping disabled.

GDD: §2.14 (powerup size), §2.10 (dock size), §2.13 (a pointer to DIFFICULTY-LEVERS.md as the
lever registry), Architecture Map Constants + Flow-functions rows, Version line, §7 entry.
Update STATUS.md. Do not push.
```

**Commit:** `v3.4 P2: difficulty-lever mechanism; 2x powerup + dock sizing (levers disabled)`

---

## Phase 3 — Scoop config, durability, and the standalone UX lab

**Spec:** §3
**Blocked on:** nothing — ✅ FORK-4 resolved: `tools/scoop-lab.html`
**Model:** Sonnet · **Thinking:** low
**Note:** this phase ends with **Paul playtesting the lab and picking numbers.** The numbers then
go into `SCOOP_CONFIG` as a trivial follow-up edit — no phase needed for that.

### Paste-ready prompt

```
Orbital Overhaul — v3.4 Phase 3: scoop durability, a generated size config, and a standalone
scoop UX lab.

Read CLAUDE.md first. Grep the live build before editing.

(1) DURABILITY. SCOOP_HITS_PER_LEVEL 2 -> 5. One-line change; the decay site in damageShip()
already reads the constant. Shielded and hit-stun hits still early-return before the decay block,
so they still don't count. Keep it commented as a playtest knob and note in the comment that at 5
hits/level a level-5 scoop survives 25 non-lethal hits — with SHIP_MAX_HP 250 and DMG_MEDIUM 35
the player can only take ~7 hits in a full-health run, so the scoop is now effectively sticky.
That's the intent; the comment exists so a future session doesn't "fix" it.

(2) REPLACE THE LITERAL SIZE ARRAYS WITH A GENERATED CONFIG.
Currently: SCOOP_WIDTH = [0,22,30,38,46,54] and SCOOP_DEPTH = [0,20,24,28,32,36], hand-picked.
The drawn ship hull is 18 px wide (grep the Ship draw poly and CONFIRM this before relying on it).

Add:
    const SHIP_DRAW_W = 18;    // the drawn hull's width — the unit the scoop is spec'd in
    const SCOOP_CONFIG = {
      maxWidthMult: 3.0,   // L5 mouth width as a multiple of SHIP_DRAW_W  (SET FROM THE LAB)
      minWidthMult: 1.2,   // L1 mouth width, same units
      curve:        1.0,   // step distribution: 1.0 = linear; >1 = weighted toward the LARGE end
      minDepth:     20,    // px forward of ship center at L1
      maxDepth:     36,    // px forward of ship center at L5
    };
    // step k in 1..SCOOP_MAX_LEVEL: min + (max-min) * ((k-1)/(N-1)) ** curve. Index 0 is ALWAYS 0.
    function buildScoopSteps(min, max, curve) { ... }
    const SCOOP_WIDTH = buildScoopSteps(SCOOP_CONFIG.minWidthMult * SHIP_DRAW_W,
                                        SCOOP_CONFIG.maxWidthMult * SHIP_DRAW_W, SCOOP_CONFIG.curve);
    const SCOOP_DEPTH = buildScoopSteps(SCOOP_CONFIG.minDepth, SCOOP_CONFIG.maxDepth,
                                        SCOOP_CONFIG.curve);

The generated arrays keep the EXACT same shape (length SCOOP_MAX_LEVEL+1, index = level), so
inScoopBox(), Ship.draw()'s prong V, and the HUD pip row all read unchanged. Verify that by grep —
if any of them index the arrays differently than I've assumed, tell me rather than working around it.

THE LOAD-BEARING INVARIANT: SCOOP_WIDTH[0] === 0 && SCOOP_DEPTH[0] === 0, so inScoopBox returns
false at scoopLevel 0 and pickup is BYTE-IDENTICAL to the pre-scoop build. Assert it.
The generated values will NOT exactly reproduce the old hand-picked arrays. That is fine and
expected — don't contort the curve to match them.

(3) NEW FILE: tools/scoop-lab.html — a standalone, self-contained interactive design harness.
NOT part of the game build. It imports nothing (no build step, house rule), so it carries its own
copies of buildScoopSteps, the ship hull poly, inScoopBox, drawPoly and glowStroke. Yes, that's
duplication — accepted: the lab is a disposable design instrument and drift can only ever produce
a bad preview, never a bad build.

Requirements:
  - Renders the player ship (same vector-glow look — drawPoly + glowStroke, same COLOR palette,
    scoop prongs in the dock green like the game) with the scoop mouth attached at the selected level.
  - Live sliders/number inputs for: maxWidthMult (1.5 .. 5.0), minWidthMult, curve (0.5 .. 3.0),
    minDepth, maxDepth. Everything re-renders live.
  - A level stepper 0..5 (and ideally a "show all 6 levels at once" overlay/ghost view, so the
    SCALING BETWEEN steps is visible at a glance — that's the actual question being answered).
  - A scatter of garbage canisters in the field, drawn at the game's real size (grep the Garbage
    draw path — a single reads radius 7), draggable, so the scoop can be eyeballed against what
    it's actually collecting. Show which pieces are currently INSIDE the mouth (use the real
    inScoopBox math) by highlighting them.
  - A readout of the generated SCOOP_WIDTH / SCOOP_DEPTH arrays, and a "copy config" button that
    prints the exact SCOOP_CONFIG object literal, ready to paste into the game.
  - Keep it simple. No thrust, no chain, no wrap, no clumps. It answers "how big does this LOOK",
    not "how does this PLAY".

TESTS: extend the existing scoop test file (test-v33-p3.js). Drive the REAL inScoopBox / damageShip.
- buildScoopSteps: index 0 is 0; index 5 equals the max; monotonically increasing; curve 1.0 is
  linear (assert the exact midpoint); curve 2.0 clusters the early levels low and makes the last
  step the biggest (assert step 5 - step 4 > step 2 - step 1).
- SCOOP_WIDTH[5] === SCOOP_CONFIG.maxWidthMult * SHIP_DRAW_W exactly.
- scoopLevel 0 capture is byte-identical to the base circle (this assertion already exists — make
  sure it still passes against the GENERATED arrays).
- Five non-lethal hits drop exactly one level; four drop none; ten drop two. Shielded and i-frame
  hits still don't count. (Update the existing 2-hit assertions to 5 — do not delete them.)

GDD: §2.14.1 (the scoop) — the generated config, the new durability, and a pointer to
tools/scoop-lab.html as the tool that sets the numbers. Architecture Map Constants row. Version
line. §7 entry. Update STATUS.md. Do not push.

AFTER THIS SHIPS: I'll open the lab, pick the numbers, and edit SCOOP_CONFIG by hand.
```

**Commit:** `v3.4 P3: scoop durability 5 hits/level; generated size config; tools/scoop-lab.html`

---

## Phase 4 — Magnet buff

**Spec:** §7
**Blocked on:** nothing — ✅ FORK-6 resolved: `accel /= sqrt(mass)`
**Model:** **Opus** · **Thinking:** **on**
**Why:** this touches the pickup loop, the coalescence system, the per-type duration model, and
the HUD, and it changes the balance of the game's central threat loop. It is the phase most likely
to produce a subtle wrong interaction. Keep it alone in its session.

### Paste-ready prompt

```
Orbital Overhaul — v3.4 Phase 4: the Magnet buff. Range, strength, falloff, duration, and clumps.

Read CLAUDE.md first. Grep the live build before touching anything — in particular grep the
magnet pull block inside the garbage pickup loop in update(), applyPowerup(), powerMode(),
powerActive(), POWERUP_BUDGET, and the HUD active-effect row.

Context you need: the ship is ALWAYS at screen center (camera = ship). VIEW_H = 720, so the top
edge of the viewport is 360 px from the ship. The current magnet range is
GARBAGE_PICKUP(18) * MAGNET_RANGE_MULT(3) = 54 px. That is the number we are fixing.

(1) DURATION — doubled, in BOTH expiry modes.
POWERUP_DURATION (15) is SHARED by rapid/triple/magnet/engine. Do NOT change it — that would
double the other three.
Add:
    const MAGNET_DURATION = POWERUP_DURATION * 2;   // 30 s — Magnet is the one long effect
and change MAGNET_PIECES 20 -> 40 ("pieces" mode).
Add a powerDuration(type) helper mirroring the existing powerMode(type) predicate: returns
MAGNET_DURATION for "magnet", POWERUP_DURATION otherwise. THREE call sites, and the third is the
one that gets missed:
  a. applyPowerup(): game.powerFx[type] = powerDuration(type)
  b. the HUD active-effect row's bar DENOMINATOR: game.powerFx[t] / POWERUP_DURATION must become
     / powerDuration(t). Miss this and the magnet bar renders permanently over-full.
  c. nothing else — POWERUP_BUDGET already reads MAGNET_PIECES, so pieces-mode doubles for free.
     Confirm that by grep rather than assuming.

(2) RANGE — reach the top of the screen.
DELETE MAGNET_RANGE_MULT. Add:
    const MAGNET_RANGE = 380;   // PLAYTEST KNOB. px from ship center. Deliberately > VIEW_H/2
                                // (360) so a piece at the very top of the viewport still feels a
                                // pull. Replaces MAGNET_RANGE_MULT's 54 px — a ~7x buff.
MAGNET_PICKUP_MULT (the pickup CIRCLE widener, 1.6) is UNTOUCHED. It is a different thing. The
v3.3 P3 note about the circle and the scoop box being OR'd with no double-counting still holds —
do not disturb it.

(3) STRENGTH + FALLOFF. Strongest near, weakest far, with a floor so the top of the screen still
visibly moves.
    const MAGNET_PULL     = 520;   // PLAYTEST KNOB. px/s^2 at zero distance (was a flat 360)
    const MAGNET_PULL_MIN = 60;    // PLAYTEST KNOB. px/s^2 floor at MAGNET_RANGE — a subtle pull
In the pull block:
    const t = 1 - (d / MAGNET_RANGE);                                    // 1 at ship, 0 at max range
    let accel = MAGNET_PULL_MIN + (MAGNET_PULL - MAGNET_PULL_MIN) * t * t;   // quadratic ease
Quadratic, not linear — the near-field yank should be dramatic and the far field a nudge.
MAGNET_DAMP (0.06) stays as-is.

(4) ALL GARBAGE, NOT JUST SINGLES.
Remove the `g.pieces === 1` gate on the magnet pull. This is now CONSISTENT with shipped behavior:
v3.3's 9c made clumps directly scoopable, so v3.2 P1's justification for the gate ("you can't hook
a clump, so pulling it is just noise") is DEAD. Do not leave that reasoning standing in the GDD.

But a clump is heavy — Garbage.mass SUMS on merge, so an 11-piece clump has mass ~11. Scale the
acceleration by mass:
    accel /= Math.sqrt(g.mass);     // FORK-6: sqrt, not linear mass.
A mass-1 single is UNAFFECTED (sqrt(1) = 1) — today's single behavior must be preserved exactly,
assert it. A mass-11 clump pulls at ~30% acceleration: it visibly, unmistakably drifts toward you,
but slowly enough that you can outrun it or line it up. This preserves the "heavy clumps are slow
anchors" identity established by v3.2 P1's mass-weighted coalescence attraction. Comment the 0.5
exponent as a playtest knob.

(5) MAGNET BUDGET ON A CLUMP SCOOP (FLAG-7b).
The pieces-mode budget decrement currently lives ONLY in the pieces===1 branch of the pickup gate,
so scooping a clump under an active Magnet spends ZERO budget. With clumps now magnetically pulled,
that's a loophole — a 6-piece clump would be free where 6 singles cost 6. In the clump branch,
decrement the magnet budget by `take` (clamped at 0) when the magnet is active and magnetMode is
"pieces". One line.

TESTS: extend scratchpad/test-v31-coalesce.js and/or the P5 powerup test — whichever already owns
the magnet fixtures. Drive the REAL update() / applyPowerup / the pickup loop. No reimplementation.
- Range: a single at 350 px (inside the new range, far outside the old 54) IS pulled; one at 400 px
  is NOT. Test across a world wrap seam — the pull must use shortDelta/dist2, never naive math.
- Falloff: acceleration at d≈0 is ~MAGNET_PULL; at d = MAGNET_RANGE it is ~MAGNET_PULL_MIN and is
  strictly > 0; it decreases monotonically with distance.
- Mass: a mass-1.0 single's per-frame velocity delta is BIT-IDENTICAL to the unscaled formula
  (the sqrt(1)=1 reduction guard — this is the regression assertion that matters most).
  A mass-9 clump's delta is exactly 1/3 of the same-distance single's.
- Clumps ARE pulled now (the old test asserts they are NOT — REWRITE that assertion, do not delete
  it; leave a comment saying it was reversed in v3.4 P4 and why).
- Duration: applyPowerup("magnet") in time mode sets powerFx.magnet === MAGNET_DURATION === 30,
  while rapid/triple/engine still get POWERUP_DURATION === 15. In pieces mode the budget is 40.
- The HUD bar fraction for magnet uses the 30 s denominator (assert powerDuration("magnet") === 30
  and that the render path reads it — drive the real draw() if the fraction is computed there).
- Budget: scooping a 6-piece clump under an active pieces-mode Magnet spends exactly 6 budget.
- Coalescence still works when the Magnet is OFF (regression: the 12-piece -> Hunter transform).

GDD: rewrite IN PLACE, do not append contradictions —
- §2.14 — Magnet range / strength / falloff / the 2x duration in both modes.
- §2.5.1 — the "the Magnet ignores clumps" bullet is now WRONG; rewrite it. Also rewrite the
  "Magnet is the natural anti-coalescence tool" bullet: at 380 px range vs GARBAGE_MAGNET_RANGE's
  180, the Magnet now dominates the ENTIRE visible field while active — nothing can clump anywhere
  the player can see, for 30 seconds. That is on-design but the DEGREE is new. Say so explicitly,
  and flag it as this round's headline playtest ask.
- Architecture Map: Constants + Flow-functions rows. Version line. §7 entry.
Update STATUS.md. Do not push.
```

**Commit:** `v3.4 P4: Magnet buff — screen-wide range with falloff, 2x duration, pulls clumps`

---

## Phase 5 — Low health warning

**Spec:** §8
**Blocked on:** nothing — ✅ FORK-8 resolved: `LOW_HP_THRESHOLD = 100`
**Model:** Sonnet · **Thinking:** low–medium (the audio teardown discipline is the only trap)

### Paste-ready prompt

```
Orbital Overhaul — v3.4 Phase 5: the low-health warning (siren + red directional pointer).

Read CLAUDE.md first. Grep the live build before editing.

CONTEXT: there is no hit counter. SHIP_MAX_HP = 250 and damage is variable (DMG_SMALL 20 /
DMG_MEDIUM 35 / DMG_LARGE 50 / DMG_BULLET 15; Hunters hit for 60/45/30). So "5 hits remaining" is
expressed as an explicit HP threshold:

    const LOW_HP_THRESHOLD = 100;   // PLAYTEST KNOB. HP at or below which the low-health warning
                                    // engages. 100 = 5 small hits / ~3 medium / 2 large — "five
                                    // bad seconds from dead." 40% of SHIP_MAX_HP. (FORK-8, confirmed.)

The low-health STATE is a pure per-frame read, no stored flag needed:
    game.state === "playing" && !game.ship.dead && game.ship.hp <= LOW_HP_THRESHOLD
It engages and disengages freely — one Health pickup (POWERUP_HEALTH_AMOUNT = 25) can clear it.

(1) AUDIO — a looping siren.
AudioSys already has this exact pattern TWICE: thrust(on) and saucer(on) are persistent looping
voices with a stored oscillator + gain, created on true and torn down on false. Grep both and
follow their shape exactly. Add AudioSys.lowhp(on) in the same shape, on the SFX bus:
a GENTLE, SLOW warble — a two-tone or LFO-swept sine/triangle, low gain. NOT a klaxon. The spec
says non-distracting: it should read as "you need health," not as an emergency alarm you want to
mute. Guard with `if (!this.ctx) return;` like every other voice.

TEARDOWN DISCIPLINE — this is the thing that will go wrong. The siren must be stopped at EVERY
site where thrust/saucer are stopped, or it will drone over the game-over screen forever:
  - killShip()      (already calls AudioSys.thrust(false) / AudioSys.saucer(false))
  - quitToTitle()   (same)
  - openPause()     (already calls AudioSys.thrust(false))
  - the per-frame state check, when HP recovers back above the threshold
Grep for every AudioSys.thrust(false) call site and make sure lowhp(false) is beside each one.
Drive the state from ONE place in update() (a single edge-detected call), not from scattered sites.

(2) VISUAL — a red directional pointer.
The green dock chevron in draw() is the template, verbatim:
    if (game.chain.length && game.dock && !game.ship.dead) {
      const a = angleTo(game.ship, game.dock);
      drawPoly([[7,0],[-4,-4],[-4,4]], VIEW_W/2 + Math.cos(a)*42, VIEW_H/2 + Math.sin(a)*42, a, COLOR.dock);
    }
Add a second chevron, same drawPoly shape, at a DIFFERENT orbit radius — use 58, so both chevrons
can be on screen simultaneously without overlapping — in a new COLOR.lowhp red. Recommend #ff4040:
it must be distinct from COLOR.hp, from COLOR.clumpHot (#ff5a2a), and from the low-HP bar fill
(#ff7060). Check the palette and pick something unmistakable if 4040 collides.

Target: the NEAREST live powerup with type === "health". Use the wrap-aware angleTo/dist2 helpers —
naive world-space arithmetic breaks at the wrap edges and is the #1 bug source in this codebase.
Write it as a real nearest-scan over game.powerups (cheap, and correct if a second health powerup
ever coexists), not as a find-first.

Drawn only when: in the low-health state AND at least one live health powerup exists on the field.
Hidden otherwise; appears the frame one spawns. No state to track.

DO NOT change POWERUP_HEALTH_GAP or add a force-spawn. I know that means the player can be at 40%
HP with a siren running and nothing to point at for up to 26 seconds. That's logged as FLAG-8a and
I'll decide after playtest. Leave it.

TESTS: new scratchpad file. Drive the REAL update() / damageShip / killShip / draw().
- The low-health state engages at exactly LOW_HP_THRESHOLD (at threshold: yes; at threshold+1: no)
  and disengages when a Health pickup lifts HP back above it (drive the real applyPowerup).
- AudioSys.lowhp is stubbed and asserted: fires (true) exactly once on the rising edge, not every
  frame; fires (false) exactly once on the falling edge; fires (false) on killShip, on
  quitToTitle, and on openPause. THE TEARDOWN ASSERTIONS ARE THE POINT OF THIS TEST FILE.
- The pointer angle: place a health powerup at a known bearing and assert the chevron's angle
  matches angleTo(ship, powerup) — INCLUDING across a world wrap seam, where a naive angle would be
  ~180 degrees wrong.
- Nearest-selection: with two health powerups on the field, the pointer targets the nearer one by
  wrap-aware dist2.
- draw() is crash-free in the low-health state with zero health powerups on the field (the hidden
  case), with one, and with the dock chevron also showing.

GDD: §2.12 (health/damage — the low-health state + threshold), §2.8 (AudioSys.lowhp), §2.14
(the health powerup's new pointer), Architecture Map (Constants / AudioSys / draw() rows), Version
line, §7 entry. Update STATUS.md. Do not push.
```

**Commit:** `v3.4 P5: low-health warning — looping siren + red health-powerup pointer`

---

## Phase 6 — Music core: scheduler, ducking, title track, Options row

**Spec:** §9a, §9d, and the `title` track from §9c
**Blocked on:** nothing
**Model:** **Opus** · **Thinking:** **on**
**Why:** a Web Audio lookahead scheduler in a 3,600-line no-build single file, plus a menu refactor
that touches index-fragile dispatch code. High complexity, and getting the architecture right here
is what makes P7 cheap.

### Paste-ready prompt

```
Orbital Overhaul — v3.4 Phase 6: the music system's CORE — scheduler, bus, ducking, the title
track, and the Options menu row. The three gameplay tracks are Phase 7; do NOT build them here.

Read CLAUDE.md first. Grep AudioSys in full before you write a line.

THE GOOD NEWS, CONFIRM IT BY GREP: AudioSys.init() already creates this.music as a GainNode, sets
its gain from the persisted Music Volume slider, and connects it to master. Nothing is connected to
its INPUT. There is a comment in the file saying so ("music is wired for a future track — NOTHING
is connected to its input yet"). This phase is that future. You should not need to touch the bus.

(1) NEW MODULE: MusicSys, alongside AudioSys — NOT inside it. AudioSys is a flat bag of one-shot
voices and must not grow a scheduler. All MusicSys output routes into AudioSys.music, so the
existing Music Volume slider governs it with zero new plumbing.

    MusicSys = {
      duck,               // a GainNode between the track graph and AudioSys.music
      setState(s),        // "title" | "play" | "off" — crossfades between tracks
      setIntensity(f),    // 0..1 — a no-op stub this phase; P7 uses it
      setDuck(on),        // menu overlay open -> 0.5 gain, else 1.0
      update(),           // the lookahead scheduler; called once per frame from the main loop
    }

SCHEDULER: a standard Web Audio lookahead. Each frame, schedule any note whose start time falls
within the next ~0.2 s window, using ctx.currentTime. NEVER use setTimeout/setInterval for note
timing. Tracks are DATA (a step-sequencer table per layer), not code — P7 will add three more
tables and should not have to touch the scheduler.

NO AUDIO FILES. House standard: WebAudio synthesis only. Oscillators, a noise buffer for
percussion, biquad filters, gain envelopes — the same toolkit AudioSys already uses.

DUCKING: call MusicSys.setDuck(menuActive()) each frame from the main loop. menuActive() already
returns game.paused, which is true for Pause AND Options AND every sub-screen — they all live under
game.paused. So one line covers the entire §9 ducking spec. Ramp the duck gain over ~0.15 s
(linearRampToValueAtTime) so it doesn't click. 50% per the spec.

STATE: game.state === "title" -> title track. "playing" -> the selected gameplay track (a silent
stub this phase — P7 fills it). "gameover" -> fade to silence over ~1 s. (That last one is a
look-call I'm making now: the game-over screen is a quiet beat and the title track would be wrong
there.)

FIRST-GESTURE GATING: AudioSys.ctx does not exist until a user gesture, so the title track cannot
start on page load — it starts on the first key/button press. Every MusicSys entry point needs the
same `if (!AudioSys.ctx) return;` guard every AudioSys voice already has. Verify the title track
starts correctly when the player arrives at the title screen AFTER a game (ctx already exists).

(2) THE TITLE TRACK. One long synthesized loop. EPIC ADVENTURE — deliberately unrelated to the
gameplay mood set: slow build, wide intervals, a sense of scale and departure. No percussion pulse,
no urgency. It is NOT layered (there is no difficulty on the title screen) — it's just a long,
patient loop. Make it long enough that it doesn't feel like a jingle on repeat: target 45-90 s.

(3) OPTIONS MENU — A REQUIRED REFACTOR FIRST.
menuOptions() currently dispatches on HARDCODED INDICES (`if (m.index <= 2)` for the volume
sliders; `m.index === 3` -> Controls, 4 -> Achievements, 5 -> Difficulty, 6 -> Back). Adding a row
shifts every one of them.

REFACTOR menuOptions() TO DISPATCH BY LABEL. menuRoot() already does exactly this and is the
in-file precedent — follow it. Then the new row is purely additive and the index-fragile code stops
existing. Do the refactor as a distinct, verifiable step BEFORE adding the row, and confirm the
existing rows still work.

Then add the row: "Music Track", placed directly after "Master Volume", as a left/right cycle over
["Tense", "Retro", "Ambient"] — the same toggle idiom as the Difficulty screen's rows. Extend
drawOptionsMenu with a value column for it, mirroring drawDifficulty's layout.

PERSISTENCE: a new field on the existing `settings` object -> afd_settings_v1. THE KEY IS FROZEN,
DO NOT RENAME IT. The load path already ignores unknown/corrupt values and keeps defaults, so this
is additive with NO schema bump — the same pattern v3.0 P5 used for shotPowerupMode / magnetMode.
Follow that pattern exactly.

This phase ships with all three gameplay track names selectable but only silence behind them.
That's fine and expected — P7 fills them in.

TESTS: new scratchpad file. Headless (no real AudioContext — stub it, as the existing audio tests do).
- MusicSys.setDuck(true) sets the duck gain toward 0.5 and setDuck(false) back to 1.0, via a RAMP
  not a jump (assert linearRampToValueAtTime was called, not a bare .value = assignment).
- menuActive() drives the duck: opening Pause, Options, Difficulty, Controls and Achievements ALL
  duck (they all live under game.paused — assert each screen).
- Every MusicSys entry point is safe to call with AudioSys.ctx === null (no crash, no throw).
- setState("title" / "play" / "off") transitions without throwing and stops the previous track.
- The scheduler: driven for N simulated frames against a stubbed ctx.currentTime, it schedules each
  note exactly once (no double-scheduling, no gaps) and never schedules into the past.
- The Options menu label-dispatch refactor: every existing row still reaches its screen (Controls,
  Achievements, Difficulty, Back) and the three volume sliders still nudge. Then: the new Music
  Track row cycles through all three values, persists to settings, and survives a save/load
  round-trip. A corrupt/unknown persisted value falls back to the default without throwing.
- afd_settings_v1 still round-trips every PRE-EXISTING field (regression — assert the key name too).

GDD: §2.8 (Audio) — the music system, the bus, the scheduler, the ducking rule, the title track.
§2.16 (menu) — the new Options row and the label-dispatch refactor. Architecture Map (a new MusicSys
row, plus AudioSys / Menu / Constants rows). Version line. §7 entry. Update STATUS.md. Do not push.
```

**Commit:** `v3.4 P6: MusicSys core — lookahead scheduler, menu ducking, title track, Options row`

---

## Phase 7 — Music: the three gameplay tracks + intensity layers

**Spec:** §9b, §9c
**Blocked on:** **P6** — ✅ FORK-9 resolved: `retro` is the default
**Model:** Sonnet · **Thinking:** **on** (the layer-gating logic is fiddly; the composition itself
is creative work that benefits from thinking)

### Paste-ready prompt

```
Orbital Overhaul — v3.4 Phase 7: the three gameplay music tracks and the difficulty-driven
intensity layers.

Read CLAUDE.md first. This builds ON Phase 6's MusicSys — read that code before adding to it. If
P6's scheduler makes this awkward, tell me; do not work around it silently.

Three gameplay tracks, all WebAudio-synthesized loops, all defined as DATA (step-sequencer tables)
feeding P6's scheduler — you should not be modifying the scheduler itself.

  tense   — driving, minor, insistent. 16th-note bass, tight filter, relentless.
  retro   — square/saw arcade, bright. The vector-arcade lineage — this is the one that sounds like
            the game LOOKS (drawPoly + glowStroke, CRT palette, synthesized SFX).
  ambient — slow pads, sparse, spacey. The "long haul in the dark" salvage-sim mood.

DEFAULT: "retro". (FORK-9, confirmed.)
Reasoning, so a future session understands the choice: retro is the track that matches every other
aesthetic decision in the build, AND it has the most headroom for the layer design below — an
arcade loop that starts sparse and stacks into something frantic is exactly the shape §9b wants,
whereas `tense` already starts near its ceiling at wave 1 (leaving the layers nowhere to go).

INTENSITY LAYERS. Each gameplay track is FOUR layers, gated on the SHIPPED difficultyFactor(game.wave)
curve (RAMP_WAVES = 8 — 0 at wave 1, asymptotic to 1). Grep it; do not invent a second curve.

  Layer 1 — foundation : always on          : bass pulse + kick
  Layer 2 — pulse      : enters at f >= 0.20: hats / arp / off-beat
  Layer 3 — harmony    : enters at f >= 0.45: pad or chord stabs
  Layer 4 — lead       : enters at f >= 0.70: melody / lead line

CRITICAL: the track THICKENS, it does not SWAP. The loop, key, and tempo NEVER change across the
intensity range — that is what makes it one track that builds rather than four different loops.
Each layer's gain crossfades in over a short smoothstep around its threshold (not a hard on/off
switch, which would pop).

Recompute intensity ONLY on wave change (call MusicSys.setIntensity(difficultyFactor(game.wave))
from nextWave()), NOT per frame. The per-frame path must stay clean.

Wire the Options "Music Track" setting (P6) to actually select the track. Switching tracks mid-game
via the pause menu should crossfade, not hard-cut.

PERF — this is the round's biggest risk (FLAG-9c). A 4-layer scheduler running alongside a
late-wave field of glowStroke'd entities. Web Audio synthesis runs off the main thread, so the risk
is the SCHEDULER's per-frame work, not the synthesis. Keep the lookahead window small and bound the
per-frame node creation. If you find yourself creating more than a handful of nodes per frame at
full intensity, restructure. Report the per-frame node-creation count at max intensity — I want the
number.

TESTS: extend P6's music test file. Headless, stubbed AudioContext.
- All three tracks load, start, stop, and crossfade without throwing.
- Layer gating: at difficultyFactor values 0.0 / 0.25 / 0.5 / 0.8, exactly 1 / 2 / 3 / 4 layers are
  audible (gain > 0). At each threshold boundary the crossfade is a ramp, not a jump.
- setIntensity is called from the REAL nextWave() (drive it) and NOT from the per-frame update path
  (assert the call count over N frames at a fixed wave is zero).
- Tempo and key are IDENTICAL across all four intensity levels for a given track (assert the
  scheduler's note timings for layer 1 are unchanged as intensity climbs — the track thickens, it
  does not swap).
- Switching tracks via settings crossfades and leaves exactly one track live.
- The default track is "retro" on a fresh settings load.
- Node-creation count per frame at max intensity is bounded (assert an upper limit).

GDD: §2.8 — the three tracks, the layer model, the intensity->difficultyFactor coupling, the
default. Architecture Map MusicSys row. Version line. §7 entry. Update STATUS.md. Do not push.
```

**Commit:** `v3.4 P7: three gameplay music tracks with difficulty-gated intensity layers`

---

## After the round

- **Playtest asks, in priority order:**
  1. **Does anything still coalesce?** §1 cut Hunter garbage supply ~73% and §7 gave the Magnet a
     380 px anti-clumping field. The coalescence→Hunter loop is Pillar 5. If it's dead, the levers
     are `HUNTER_GARBAGE` / `DEBRIS_GARBAGE` / `GARBAGE_MAGNET_RANGE` / `MAGNET_RANGE`.
  2. **Is the Magnet now the best powerup by a mile?** 30 s, screen-wide, pulls clumps. Watch
     `POWERUP_DROP_WEIGHTS` (magnet is currently weight 1 of 10 — that may now be correct, or may
     need to go lower).
  3. **Scoop durability at 5 hits/level** — is it too sticky? (FLAG-3a)
  4. **Dock intake at 0.05 s** — and does `AudioSys.deliver`'s uncapped pitch climb grate over a
     24-canister haul? (FLAG-2a)
  5. **Is `CARGO_CAP_MAX = 24` reachable?** It needs 360 deliveries in one run. (FLAG-4a →
     `CARGO_GROW_PER`)
  6. **The low-health siren** — does it nag? (`LOW_HP_THRESHOLD`) And does it ever run with nothing
     to point at? (FLAG-8a)
  7. **Music perf** in a late-wave field. (FLAG-9c)
- **Scoop lab:** open `tools/scoop-lab.html`, land `maxWidthMult` / `curve`, paste into
  `SCOOP_CONFIG`. Trivial follow-up commit, no phase.
- **Title:** pick from §11's shortlist, then collision-check against Steam/itch/trademark before
  committing to it. The rename itself is a P1-style presentation pass in the *next* round, not this
  one.
- **Archive:** move `PLANNED-FEATURES-v3.4.md` and `IMPLEMENTATION-PHASES-v3.4.md` to `archive/`
  **with the version suffix intact**. `DIFFICULTY-LEVERS.md` stays at repo root — it is a living
  doc and is never archived.
- **Still outstanding from v3.3:** rename `archive/IMPLEMENTATION-PHASES.md` →
  `archive/IMPLEMENTATION-PHASES-v2.md`. Bare names are not allowed in `archive/`.