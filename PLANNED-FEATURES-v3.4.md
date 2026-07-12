# PLANNED FEATURES — v3.4 (Change Set 5)

Companion to `orbital-overhaul-GDD.md` (design authority) and `IMPLEMENTATION-PHASES-v3.4.md`
(the build order). This doc is the **spec**; the phases doc is the **plan**.

Build version **v3.4** — unrelated to the Change Set number (this is Change Set 5).
All values below were grepped from the **live build** (`asteroids-deluxe.html`, post-v3.3),
not from prior planning docs. Where a shipped constant is quoted, it is quoted from the file.

**Forks — all resolved, Paul confirmed every recommendation (2026-07-12):**
FORK-1 → (b), FORK-4 → (a), FORK-6 → `sqrt(mass)`, FORK-8 → `LOW_HP_THRESHOLD = 100`,
FORK-9 → `retro`. The sections below are kept in full as the decision record — the *reasoning*
is what a future session needs, not just the number. Everything else is an unchanged best-guess
with a FLAG (no sign-off needed).

---

## 1. Hunter Satellite garbage drops — scale by tier

### Shipped now
```
const HUNTER_GARBAGE       = 3;   // large AND medium
const HUNTER_SMALL_GARBAGE = 6;   // small tier — a LARGER burst...
const HUNTER_SMALL_MASS    = 0.5; // ...of LOW-mass scrap (tows easily)
```
`destroyHunter()` branches on `h.size === 1`: the small tier emits 6 at mass 0.5 and drops no
children; large/medium emit 3 at mass 1.0 and split 3 ways.

⚠️ **Wording flag — "when hit":** Hunters have no HP. A single bullet destroys one at any tier
(`destroyHunter` is the only emission site). The spec is read as **per kill**, not per hit.

### Spec
Replace the two scalars with one per-tier table, matching the existing `HUNTER_RADII` /
`HUNTER_SCORE` / `HUNTER_DAMAGE` shape:

```
const HUNTER_GARBAGE = { 3: 3, 2: 2, 1: 1 };   // canisters per kill, by tier
```
`destroyHunter` reads `HUNTER_GARBAGE[h.size]` in **both** branches. The small tier keeps its
distinct identity (low mass, paler tint) — it just emits one piece instead of six.

Delete `HUNTER_SMALL_GARBAGE`. **Keep `HUNTER_SMALL_MASS = 0.5`** — the small tier's single
canister is still low-mass scrap.

### ✅ FORK-1 — RESOLVED: (b), `{3:3, 2:2, 1:1}` + `DEBRIS_GARBAGE` 3 → 4

This is the largest economy change in the set and it deserves an explicit look before it ships.

A full 13-member lineage (1 large + 3 medium + 9 small) currently drops
`3 + (3×3) + (9×6) = 66` canisters. Under this spec it drops `3 + (3×2) + (9×1) = 18`.
**A 73% cut to the game's single biggest garbage source.** `DEBRIS_GARBAGE = 3` is untouched,
so Debris becomes the dominant supplier by a wide margin.

Downstream consequences, all of which point the same direction (less garbage on the field):
- **Coalescence gets rare.** `HUNTER_COALESCE_COUNT = 12` pieces must fuse to birth a Hunter.
  With `GARBAGE_DECAY = 22 s` on singles (v3.3 9a) already acting as the governor, an 18-piece
  lineage yield may make the neglect-breeds-danger loop nearly unreachable outside heavy Debris
  waves. That loop is Pillar 5 and the whole reason §2.5.1 exists.
- **§4 (24-piece tow cap) and §7 (screen-wide Magnet) both assume there is garbage to collect.**
  Three changes in this set independently reduce pressure on the salvage loop; §1 is the only
  one that reduces *supply*.
- **GDD §2.5 explicitly frames the 6-piece small drop as the payoff for finishing a lineage**
  ("a valuable bonus for finishing a Hunter line"). Going to 1 removes that reward. The line
  becomes pure score.

**Options:**
- **(a) As written — `{3:3, 2:2, 1:1}`.** Clean, matches the spec literally. Accepts the
  coalescence-loop risk and the loss of the lineage payoff.
- **(b) Recommended — `{3:3, 2:2, 1:1}` but bump `DEBRIS_GARBAGE` 3 → 4** in the same commit,
  so total field supply lands closer to today while the *Hunter-specific* scaling you asked for
  still happens. Debris becomes the deliberate supplier, Hunters become a threat you clear
  rather than a piñata.
- **(c) Keep the small tier fat — `{3:3, 2:2, 1:3}`** at mass 0.5, so finishing a line still
  pays. Preserves the shipped design intent; only medium/small are nerfed relative to today.

**Decision: (b).** It honors the stated goal (drops scale with satellite size) without silently
cutting field density by ~70% at the same moment three other changes make collection easier.
Both `HUNTER_GARBAGE` and `DEBRIS_GARBAGE` are flagged as playtest knobs — if the field still
feels sparse after the bump, this is the first dial. "Does anything ever coalesce anymore?" is
still the round's headline playtest ask (see §7's Magnet range for the other half of that risk).

### GDD impact
§2.5 (the every-tier-emits bullet and the small-tier low-mass reward line) and §2.5.1 (the
"12-in / 66-out amplifier" arithmetic, which becomes 12-in / 18-out) must be **rewritten in
place** — do not append a contradiction. The v3.3 9b rationale ("emission suppression isn't the
governor, decay is") still holds and should survive.

---

## 2. Recycling dock intake rate

### Shipped now
The intake interval is a **bare literal**, not a constant:
```js
AudioSys.deliver(game.deliveryCount);
game.offloadTimer = 0.13;   // ← literal, inside the dock-offload block in update()
```
Proximity gate: `dist2(ship, dock) < (DOCK_RADIUS + 10)²` (radius 44 → 54 px).
Combo resets past `DOCK_RADIUS + 40`.

### Spec
1. Hoist the literal into the constants block next to the other `DOCK_*` values:
   ```
   const DOCK_OFFLOAD_INTERVAL = 0.05;   // PLAYTEST KNOB (was a bare literal 0.13).
                                         // sec between canisters peeling off at the dock.
   ```
   `0.05` is a ~2.6× speed-up: a full 24-piece chain (§4) offloads in ~1.2 s instead of ~3.1 s.
   **Tune by feel** — this is exactly the kind of number playtest should own, so the phase ships
   a starting value and a comment, not a defended figure.
2. Nothing else in the block changes. Scoring (`DOCK_BASE_SCORE + DOCK_BONUS_STEP × (n-1)`),
   cap growth, and all achievement latches stay keyed to the same per-canister events.

⚠️ **FLAG-2a — `AudioSys.deliver(count)` fires once per canister** and pitches up with the combo
count. At 0.05 s intervals a 24-canister haul is 24 rising chimes in 1.2 s. That may read as a
satisfying arpeggio or as a shrill machine-gun. Watch it in playtest; the cheap fix if it grates
is to clamp the pitch climb (it currently has no ceiling) rather than to slow the intake back down.

⚠️ **Interacts with §6.** A 2× dock radius means the ship is inside the intake gate for longer at
any given approach speed, which *also* increases effective intake. §2 and §6 ship in the same
phase for exactly this reason — tune them together, not sequentially.

Rectangular-dock geometry: **explicitly rejected** for this round (per the change set). Not
specced, not built. Log it in the GDD §4 backlog as a considered-and-declined alternative so a
future session doesn't rediscover it.

---

## 3. Garbage scoop — durability & sizing

### 3a. Durability

Shipped: `const SCOOP_HITS_PER_LEVEL = 2;`

Spec: **`SCOOP_HITS_PER_LEVEL = 5`.** One-line change. The decay site in `damageShip()` already
reads the constant and needs no edit. Shielded and hit-stun (i-frame) hits still early-return
before the decay block, so they still don't count — unchanged.

Consequence worth stating: a level-5 scoop now survives 25 non-lethal hits before returning to
level 0. With `SHIP_MAX_HP = 250` and `DMG_MEDIUM = 35`, the player can only *take* ~7 hits in a
full-health run before dying. **At 5 hits/level the scoop is effectively permanent for most
runs** — it will almost never decay more than one level. That is a large, quiet shift from
"upgrade you must protect" to "upgrade you keep."

⚠️ **FLAG-3a.** If the intent was "the scoop should be sticky but still punishable," 5 is right.
If the intent was "decay should still bite," 3 is the number that keeps a two-level loss possible
within one full-health run. Shipping 5 as asked; flagging so you can eyeball it against the
harness. Playtest knob either way.

### 3b. Sizing config — replace the literal arrays with a generator

Shipped:
```
const SCOOP_WIDTH = [0, 22, 30, 38, 46, 54];   // L5 = 54 = 3× the drawn ship's 18 px width
const SCOOP_DEPTH = [0, 20, 24, 28, 32, 36];
```
Ship's drawn width is 18 px (hull poly), collision `SHIP_RADIUS = 13`.

The change set asks for a live-configurable max width **and** a configurable distribution across
the 5 steps, with "final values feed back into the config object." Two literal arrays cannot
express that. So:

```
const SHIP_DRAW_W = 18;                 // the drawn hull's width — the unit the scoop is spec'd in

const SCOOP_CONFIG = {
  maxWidthMult: 3.0,   // L5 mouth width, as a multiple of SHIP_DRAW_W  (PLAYTEST — set from the harness)
  minWidthMult: 1.2,   // L1 mouth width, same units
  curve:        1.0,   // step distribution: 1.0 = linear; >1 = weighted toward the LARGE end
                       //                    (early levels cluster low, the last step is the big one)
  minDepth:     20,    // px forward of ship center at L1
  maxDepth:     36,    // px forward of ship center at L5
};

// Built once at load from SCOOP_CONFIG. Index = level (0 = no scoop). Shape is unchanged from
// v3.3, so inScoopBox() / Ship.draw() / the HUD pip row all read exactly as they do today.
const SCOOP_WIDTH = buildScoopSteps(SCOOP_CONFIG.minWidthMult * SHIP_DRAW_W,
                                    SCOOP_CONFIG.maxWidthMult * SHIP_DRAW_W,
                                    SCOOP_CONFIG.curve);
const SCOOP_DEPTH = buildScoopSteps(SCOOP_CONFIG.minDepth, SCOOP_CONFIG.maxDepth,
                                    SCOOP_CONFIG.curve);

// step k (1..SCOOP_MAX_LEVEL): min + (max-min) * ((k-1)/(N-1)) ** curve   → index 0 is 0
function buildScoopSteps(min, max, curve) { ... }
```

At `curve = 1.0, maxWidthMult = 3.0, minWidthMult = 1.2` this reproduces widths within a couple
px of the shipped array — **not byte-identical**, and that's fine (the shipped numbers were
hand-picked, not generated). What matters is that `SCOOP_WIDTH[0] === 0` and
`SCOOP_DEPTH[0] === 0`, so **`scoopLevel === 0` stays byte-identical to the pre-scoop build** —
the load-bearing invariant from v3.3 P3. Assert it in the tests.

### ✅ FORK-4 — RESOLVED: (a), `tools/scoop-lab.html` as a second committed file

The change set wants a standalone interactive test harness. Two shapes:

- **(a) Recommended — `tools/scoop-lab.html`, a second self-contained file, committed.**
  It imports nothing (house rule: no build step), so it carries its own copy of `buildScoopSteps`,
  the ship hull poly, `inScoopBox`, and `drawPoly`/`glowStroke`. Sliders for `maxWidthMult`,
  `minWidthMult`, `curve`; a level stepper 0–5; a scatter of draggable garbage pieces; and a
  **"copy config" button that prints the exact `SCOOP_CONFIG` literal to paste into the game.**
  The game keeps `SCOOP_CONFIG` + `buildScoopSteps` as above, so the harness and the game agree
  by construction — the only thing hand-carried is five numbers.
  *Cost:* ~80 lines of the ship/scoop draw path exist in two places. Acceptable: the harness is a
  disposable design tool, and drift only ever produces a bad *preview*, never a bad *build*.

- **(b) In-game debug overlay** (a hidden key that opens the sliders in the real game).
  Zero drift, but it permanently pollutes the shipped single file with a dev-only UI and a
  runtime-mutable constant path. Against the house grain.

**Decision: (a).** `tools/scoop-lab.html` is a design instrument, not a game feature; it does not
cost the shipped file a single byte.

⚠️ **FLAG-3b — the harness is not the game.** It renders the ship + scoop + garbage and lets you
step the levels, but it has no thrust, no chain, no clumps, no wrap. It answers "how big does this
*look*", not "how does this *play*." Land the numbers in the lab, then confirm in a real run
before archiving the round.

---

## 4. Tow capacity → 24

### Shipped now
```
const CARGO_BASE    = 12;   // starting cap
const CARGO_CAP_MAX = 20;   // ceiling
const CARGO_GROW_PER = 30;  // +1 cap per this many canisters recycled this run
const CARGO_THRUST = 0.06;  // thrust divisor per unit of towed mass
const CARGO_MAXSPD = 0.03;  // max-speed divisor per unit of towed mass
const CARGO_MASS   = 0.07;  // tug mass-factor per unit of towed mass (capped at 1.4)
const CHAIN_ITER   = 4;     // verlet relaxation passes/frame
```
The v3.0 P6 / B-8 retune **solved these coefficients so that a full chain at m=20 lands on the
old full-12 feel** (≈45% thrust, ≈63% top speed). GDD §3.4's stability envelope was validated at
**20 nodes / 4 iterations** (worst-case link stretch ≈4 px on a 20 px link).

### Spec
`CARGO_CAP_MAX = 20 → 24`. That is the whole change **on paper**. It is not the whole change in
practice:

1. **Handling at the new ceiling.** At m=24 under today's coefficients: thrust
   `1/(1+24×0.06) = 41%`, top speed `1/(1+24×0.03) = 58%`. The tug's `massFactor` is
   `min(1.4, m × 0.07)` and already saturates at m≈20, so the tug does **not** get worse — only
   thrust and top speed do, by ~4–5 points each. **Decision: let it be heavier.** A bigger hold
   should cost handling; the coefficients are not re-solved. (GDD §2.10.1 warns against the
   "broken, not heavy" zone — 41%/58% is still comfortably above the ~33%/50% that section calls
   broken.)
2. **Stability revalidation is mandatory, not optional.** The §3.4 contract was validated at 20
   nodes. Re-run the headless 24-node stress (hard thrust-flips across a wrap, ~900 frames):
   assert no NaN, no velocity blowup, and worst-case link stretch. If stretch exceeds ~5 px on a
   20 px link, bump `CHAIN_ITER` 4 → 5 and re-assert. **Do not ship 24 without this test.**
3. **Achievements are safe.** Heavy Hauler / Freight Baron / The Long Haul all latch on the
   literal `game.deliveryCount === 12` (FLAG B-8-b), deliberately decoupled from `cargoMax`.
   Grep-confirmed still true in the live build. No change.

⚠️ **FLAG-4a — 24 may be unreachable.** Cap growth is `CARGO_BASE + floor(delivered / 30)`, so
reaching 24 needs **360 canisters recycled in a single run**. Today's ceiling of 20 needs 240 —
already a long run. If 24 is meant to be a real number players see rather than a theoretical
ceiling, `CARGO_GROW_PER` needs to come down (25 → 300 deliveries for 24; 20 → 240). **Not
specced** — flagged as a playtest knob so you can decide after seeing a real run's delivery count.
The scoop (v3.3 P3) and the buffed Magnet (§7) both raise deliveries/minute substantially, so it
may already be closer than it looks.

---

## 5. Powerup sizing (difficulty lever, tooled but disabled)

### Shipped now
```
const POWERUP_RADIUS = 15;   // pickup icon radius = its collision radius
```
`Powerup` bakes `this.radius = POWERUP_RADIUS` in its constructor, and **both** the draw path
(hexagon housing + glyph, scaled by `r`) and the collision check
(`r = POWERUP_RADIUS + SHIP_RADIUS`) size off it. Convenient: one scalar moves render and
collision in lockstep, exactly as the spec wants.

### Spec
Introduce the difficulty-lever mechanism (§10) and route the powerup size through it:

```
const LEVER_POWERUP_SIZE = {
  enabled: false,   // ← DISABLED for now (per spec). When false, scale is pinned at `start`.
  start:   2.0,     // multiplier at wave 1 — powerups are 2× today's size
  floor:   1.0,     // never smaller than today's baseline (the spec's hard floor)
};
```
`leverScale(LEVER_POWERUP_SIZE, game.wave)` returns `start` when disabled, and
`ramp(start, floor, wave)` when enabled — reusing the shipped `ramp()` / `difficultyFactor()`
curve, so the shrink follows the same `RAMP_WAVES = 8` asymptote as every other threat parameter.
Clamped `>= floor` unconditionally.

Wiring:
- `Powerup` constructor: `this.radius = POWERUP_RADIUS * leverScale(LEVER_POWERUP_SIZE, game.wave)`.
- The collision check in `update()` must read **`p.radius`**, not the `POWERUP_RADIUS` constant.
  It currently reads the constant — **this is the one edit that's easy to miss and would silently
  make the collision circle disagree with the rendered sprite.**
- `drawPowerupGlyph` already takes an `r` argument. No change.

Baked at construction, so a mid-run difficulty ramp (once enabled) affects **newly spawned**
powerups only. Fine — it's how the field turns over anyway, and it keeps the lever off the
per-frame path.

---

## 6. Recycling dock sizing (difficulty lever, tooled but disabled)

### Shipped now
`DOCK_RADIUS = 44` is read in **five** places: the `Dock` constructor's `this.radius` and its
baked `pts` octagon; `draw()`'s intake vanes (`DOCK_RADIUS - 10`, plus a literal `14` inner
radius) and the "RECYCLE" label offset (`+ 22`); the offload proximity gate (`+ 10`); and the
combo-reset distance (`+ 40`).

### Spec
Same lever shape:
```
const LEVER_DOCK_SIZE = { enabled: false, start: 2.0, floor: 1.0 };
```
The `Dock` constructor sets `this.radius = DOCK_RADIUS * leverScale(LEVER_DOCK_SIZE, game.wave)`
and bakes `pts` from `this.radius`. **Every other `DOCK_RADIUS` read becomes `dock.radius`** —
including the offload gate and the combo reset (leave the `+10` / `+40` margins as absolute px;
they're feel margins, not geometry). The vanes' inner `14` and the label's `+22` scale with the
radius too, or the dock looks wrong at 2×.

A new `Dock` is constructed every wave (`game.dock = new Dock()` in `nextWave`), so once the lever
is enabled the dock naturally re-sizes each wave with no mid-wave mutation. Clean fit.

⚠️ **FLAG-6a.** At 2× the dock is radius 88 — a large object. `DOCK_MIN_DIST = 260` keeps it off
the ship at spawn, so no collision-placement risk. But visually it's now the biggest thing on
screen; check it doesn't read as a hazard. Look-call, playtest.

⚠️ **Interacts with §2** (see FLAG in §2). Tune intake rate *after* the dock is at its new size.

---

## 7. Magnet powerup buff

The biggest single change in the set. It touches the pickup loop, the coalescence system, and
the timed-effect duration model — all three at once.

### Shipped now
```
const POWERUP_DURATION   = 15;   // sec — SHARED by rapid/triple/magnet/engine
const MAGNET_PIECES      = 20;   // canisters, in "pieces" expiry mode
const MAGNET_RANGE_MULT  = 3;    // range = GARBAGE_PICKUP(18) × 3 = 54 px  ← the whole range
const MAGNET_PULL        = 360;  // px/s² — flat, no falloff
const MAGNET_DAMP        = 0.06;
const MAGNET_PICKUP_MULT = 1.6;  // widens the pickup CIRCLE only
```
The pull loop is gated on **`g.pieces === 1`** — clumps are not pulled at all.
The HUD bar reads `game.powerFx[t] / POWERUP_DURATION`.

### 7a. Duration — double it, in both expiry modes

`POWERUP_DURATION` is global. Doubling it would double Rapid, Triple, and Engine too. So:

```
const MAGNET_DURATION = POWERUP_DURATION * 2;   // 30 s — Magnet is the one long effect
const MAGNET_PIECES   = 40;                      // was 20 — doubled, "pieces" mode
```
Add a `powerDuration(type)` helper (mirroring the existing `powerMode(type)` predicate) returning
`MAGNET_DURATION` for magnet and `POWERUP_DURATION` otherwise. **Three call sites:**
1. `applyPowerup()` — `game.powerFx[type] = powerDuration(type);`
2. The HUD active-effect bar's denominator (`game.powerFx[t] / POWERUP_DURATION` → `powerDuration(t)`).
   ⚠️ **Miss this and the magnet bar renders permanently over-full.**
3. Nothing else — `POWERUP_BUDGET` already reads `MAGNET_PIECES`, so "pieces" mode doubles for free.

### 7b. Range — reach the top of the screen

The ship is always at screen center (`camera = ship`), `VIEW_H = 720`, so the top edge is
**360 px** away and the screen corner is `hypot(640, 360) ≈ 734` px.

Replace the multiplier with an absolute range:
```
const MAGNET_RANGE = 380;   // PLAYTEST KNOB. px from ship center. Deliberately > VIEW_H/2 (360)
                            // so a piece at the very top edge of the viewport still feels a pull.
                            // Replaces MAGNET_RANGE_MULT (which gave a 54 px range — a 7× buff).
```
Delete `MAGNET_RANGE_MULT`. `MAGNET_PICKUP_MULT` (the pickup *circle* widener) is **untouched** —
it's a different thing and the box/circle no-double-counting note from v3.3 P3 still holds.

### 7c. Strength & falloff

Flat 360 px/s² across 380 px would be violent. Falloff, strongest near, weakest far, with a floor
so the top of the screen still visibly moves:
```
const MAGNET_PULL     = 520;   // PLAYTEST KNOB. px/s² at zero distance (was a flat 360)
const MAGNET_PULL_MIN = 60;    // PLAYTEST KNOB. px/s² floor at MAGNET_RANGE — "a subtle pull"
```
```js
const t = 1 - (d / MAGNET_RANGE);                        // 1 at the ship, 0 at max range
const accel = MAGNET_PULL_MIN + (MAGNET_PULL - MAGNET_PULL_MIN) * t * t;   // quadratic ease
```
Quadratic (not linear) so the near-field yank is dramatic and the far field is a nudge, which is
what "strongest on nearby pieces, weakest at range" asks for. `MAGNET_DAMP` stays.

### 7d. All garbage, not just singles — ✅ FORK-6 RESOLVED: `accel /= Math.sqrt(g.mass)`

Removing the `g.pieces === 1` gate is required by the spec ("all garbage pieces, not just small
ones") and is **now consistent with shipped behavior**: v3.3's 9c made clumps directly scoopable,
so the v3.2 P1 justification for the gate ("the Magnet ignores clumps — you can't hook one, so
pulling it is just noise") is dead. Good.

But a clump is heavy. `Garbage.mass` **sums** on merge (v3.2 P1), so an 11-piece clump has mass
~11 and a radius of `7×√11 ≈ 23`. Applying the same acceleration to it as to a mass-1 single
means an 11-piece clump rockets toward the ship as fast as a single canister — which looks wrong
(it's the field's designated anchor) and, worse, **the ship can't refuse it**: it will be scooped,
lossily, whether or not there's room, spilling the remainder.

**Options for how the pull scales with mass:**
- **(a) Unscaled** — everything accelerates identically. Simplest, most literal reading of the
  spec. Heavy clumps fly.
- **(b) Recommended — divide the acceleration by `sqrt(mass)`.** A mass-1 single is unaffected
  (√1 = 1, so today's singles behavior is preserved exactly). A mass-11 clump pulls in at ~30% the
  acceleration — it visibly, unmistakably drifts toward you, but slowly enough that you can outrun
  it or line it up. Preserves the "heavy clumps are slow anchors" physics identity established in
  v3.2 P1's mass-weighted coalescence attraction.
- **(c) Divide by `mass`** — full Newtonian. A mass-11 clump pulls at 9% acceleration: barely
  moves. Probably fails the spec's "visibly, noticeably pull" bar for clumps.

**Decision: (b), `accel /= Math.sqrt(g.mass)`.** It satisfies "all pieces visibly pull"
while keeping the mass identity the rest of the garbage system is built on. Flag the exponent
(0.5) as a playtest knob — it's a one-character change to try (a) or (c).

⚠️ **FLAG-7a — the Magnet now hard-counters coalescence across the whole screen.**
`GARBAGE_MAGNET_RANGE` (garbage↔garbage attraction) is **180 px**. The Magnet's new range is
**380**. While active, the Magnet dominates the entire visible field — nothing can clump anywhere
you can see. GDD §2.5.1 already frames the Magnet as "the natural anti-coalescence tool," so this
is on-design, but the *degree* is new. Combined with §1's supply cut, a Magnet pickup may end the
coalescence threat for its full 30 s. Headline playtest ask for this round.

⚠️ **FLAG-7b — "pieces" mode counts at the hook.** A clump scooped under the Magnet pushes
`take` chain nodes but the budget decrement currently sits only in the `pieces === 1` branch
(FLAG B-5-a, v3.0 P5). Leave it there: a clump-scoop spends **zero** magnet budget today. That's
now inconsistent — a 6-piece clump scooped for free is a better deal than 6 singles. Either
decrement `take` in the clump branch, or accept it. **Recommendation: decrement `take`**, since a
40-piece budget doubled specifically to survive more hooks shouldn't be dodged by clumping.
Cheap, one line, do it in this phase.

### GDD impact
§2.14 (Magnet's range/strength/duration) and §2.5.1 (the "Magnet ignores clumps" bullet and the
Magnet-as-counterplay bullet) both **rewritten in place**.

---

## 8. Low health warning

### ✅ FORK-8 — RESOLVED: `LOW_HP_THRESHOLD = 100`

There is no hit counter. `SHIP_MAX_HP = 250`, and damage is variable:
`DMG_SMALL 20 / DMG_MEDIUM 35 / DMG_LARGE 50 / DMG_BULLET 15` (Hunters hit harder still:
`HUNTER_DAMAGE {3:60, 2:45, 1:30}`). "5 hits remaining" is therefore anywhere from 75 HP
(5 saucer bullets) to 300 HP (5 large Hunters — more than max HP).

Ship an explicit HP threshold constant:
```
const LOW_HP_THRESHOLD = 100;   // PLAYTEST KNOB. HP at or below which the low-health state
                                // engages. 100 = 5 small hits / ~3 medium / 2 large — i.e. "you
                                // are five bad seconds from dead." 40% of SHIP_MAX_HP.
```
- **100 (recommended)** — 5× `DMG_SMALL`. Warns in genuine danger without nagging.
- **175** — 5× `DMG_MEDIUM`. That's **70% of max HP**: the siren would run for most of a typical
  run. Almost certainly too loud.
- **A fraction** (`SHIP_MAX_HP * 0.4`) — same number, less legible. Prefer the absolute constant.

State is `game.ship.hp <= LOW_HP_THRESHOLD && !game.ship.dead && game.state === "playing"`,
evaluated per frame. It engages and disengages freely (a Health pickup grants
`POWERUP_HEALTH_AMOUNT = 25`, so one pickup at 95 HP clears it).

### 8a. Audio — a looping siren

`AudioSys` already has the exact pattern needed twice over: `thrust(on)` and `saucer(on)` are
persistent looping voices with a stored oscillator + gain that get created on `true` and torn down
on `false`. Add **`AudioSys.lowhp(on)`** in the same shape: a gentle, slow LFO-swept sine or
triangle (a two-tone warble, not a klaxon — the spec says non-distracting), on the `sfx` bus,
low gain.

**Teardown discipline** — the same three sites that stop `thrust` and `saucer` must stop this, or
it plays over the game-over screen forever:
- `killShip()` (already calls `AudioSys.thrust(false)` / `saucer(false)`)
- `quitToTitle()` (same)
- the per-frame state check, when HP recovers above the threshold

Also stop it while paused, alongside the existing `AudioSys.thrust(false)` in `openPause()`.

### 8b. Visual — a red directional pointer

The green dock chevron is the template, verbatim:
```js
if (game.chain.length && game.dock && !game.ship.dead) {
  const a = angleTo(game.ship, game.dock);
  drawPoly([[7,0],[-4,-4],[-4,4]], VIEW_W/2 + Math.cos(a)*42, VIEW_H/2 + Math.sin(a)*42, a, COLOR.dock);
}
```
The health pointer is the same drawPoly at a **different orbit radius** (recommend **58**, so both
chevrons can be on screen at once without overlapping) in a new `COLOR.lowhp` red
(recommend `#ff4040` — distinct from `COLOR.hp`, from the `#ff5a2a` `clumpHot`, and from the
`#ff7060` low-HP bar fill).

Target: the nearest live `type === "health"` powerup, via **wrap-aware `angleTo`/`dist2`** (never
naive arithmetic — GDD non-negotiable). Health spawns ambiently on an 18–26 s cadence and its
`POWERUP_DECAY` bounds coexistence, so in practice there is 0 or 1 on the field; the "nearest"
scan is still written as a scan (cheap, and correct if a shot-drop ever adds a second).

Hidden when: not in the low-health state, or no health powerup exists. Appears the frame one
spawns. No state to track — it's a pure per-frame read, like the dock chevron.

⚠️ **FLAG-8a.** `POWERUP_HEALTH_GAP = [18, 26]` s. In the worst case the player is at 40% HP with
a siren running and **nothing to point at for 26 seconds** — the pointer is hidden, the siren
isn't, and the game is telling them to find something that doesn't exist. Consider (not specced,
your call after playtest) shortening the ambient Health gap while the low-health state is active,
or force-spawning one on the state's rising edge. Logged, not built.

---

## 9. Music system

The largest build in this set. `AudioSys` is already 250 lines of one-shot Web Audio voices and
**already has the bus**: `init()` creates `this.music`, sets its gain from the persisted Music
Volume slider, and connects it to `master` — and then nothing is ever connected to *its* input.
The in-code comment says so explicitly ("music is wired for a future track — NOTHING is connected
to its input yet"). This is that future.

### 9a. Architecture — `MusicSys`

A new module alongside `AudioSys` (not inside it — `AudioSys` is a flat bag of one-shot voices
and shouldn't grow a scheduler). All output routes to `AudioSys.music`, so the existing Music
Volume slider governs it with zero new plumbing.

```
MusicSys = {
  duck,                        // a GainNode between the track graph and AudioSys.music
  setState(s),                 // "title" | "play" | "off"  — crossfades tracks
  setIntensity(f),             // 0..1, from difficultyFactor(game.wave) — drives layer gains
  setDuck(on),                 // menu overlay open → 0.5 (§9 spec), else 1.0
  update(),                    // the lookahead scheduler; called once per frame from the main loop
}
```

- **Scheduling:** a standard Web Audio lookahead scheduler — each frame, schedule any note whose
  start time falls inside the next ~0.2 s window, using `ctx.currentTime` (never `setTimeout` for
  note timing). Tracks are defined as data (a step-sequencer table per layer), not as code.
- **No audio files.** House standard. All four tracks are synthesized loops — oscillators, a noise
  buffer for percussion, biquad filters, gain envelopes. Same toolkit `AudioSys` already uses.
- **Ducking:** `MusicSys.setDuck(menuActive())` each frame. `menuActive()` already returns
  `game.paused`, which is true for Pause **and** Options **and** every sub-screen (they all live
  under `game.paused`). One line, covers the whole spec. Ramp the duck gain over ~0.15 s so it
  doesn't click.
- **State:** `game.state === "title"` → title track; `"playing"` → the selected gameplay track;
  `"gameover"` → recommend **fade to silence** (not specced; the game-over screen is a quiet beat
  and the title track would be wrong there). FLAG-9a, look-call.

### 9b. Intensity layers

Each gameplay track is **4 layers**, gated on `difficultyFactor(game.wave)` (the shipped curve,
`RAMP_WAVES = 8` — 0 at wave 1, asymptotic to 1):

| Layer | Enters at | Content |
|---|---|---|
| 1 — foundation | always | bass pulse + kick |
| 2 — pulse | f ≥ 0.20 | hats / arp / off-beat |
| 3 — harmony | f ≥ 0.45 | pad or chord stabs |
| 4 — lead | f ≥ 0.70 | melody / lead line |

Each layer's gain crossfades in over its threshold (a short smoothstep, not a hard switch) so the
track **thickens** rather than swapping. The loop, key, and tempo never change — that's what makes
it one track that builds, per the spec. Recompute intensity only on wave change, not per frame.

### 9c. The four tracks

| Track | Feel | Notes |
|---|---|---|
| `tense` | driving, minor, insistent | 16th-note bass, tight filter, rising as layers stack |
| `retro` | square/saw arcade, bright | the vector-arcade lineage — closest to the game's visual identity |
| `ambient` | slow pads, sparse, spacey | the "long haul in the dark" read; salvage-sim mood |
| `title` | **epic adventure, long loop** | its own thing, unrelated to the gameplay set. Slow build, wide intervals, no percussion pulse. Not layered (there's no difficulty on the title screen) — just a long loop. |

### ✅ FORK-9 — RESOLVED: `retro` ships as the default gameplay track

**Decision: `retro`.**

Reasoning: the game is a vector-glow arcade successor to Asteroids Deluxe, and every other
aesthetic decision in the build (drawPoly + glowStroke, no fills, synthesized SFX, a CRT palette)
points the same direction. `retro` is the track that sounds like the game *looks*. It also has the
most headroom for the intensity-layer design — an arcade loop that starts sparse and stacks into
something frantic is exactly the shape §9b describes, whereas `tense` starts near its ceiling at
wave 1 (leaving the layers nowhere to go) and `ambient` never really arrives.

`tense` is the defensible alternative if you want the low-health siren and the coalescing-Hunter
dread to land in a bed that already feels dangerous. Your call.

### 9d. Options menu — 🔧 required refactor

Shipped `menuOptions()` dispatches on **hardcoded indices**:
```js
if (m.index <= 2) { /* a volume slider */ ... }
...
if (m.index === 3) gotoScreen("controls");
else if (m.index === 4) { gotoScreen("achievements"); ... }
else if (m.index === 5) gotoScreen("difficulty");
else if (m.index === 6) gotoScreen("root", ...);
```
Adding a "Music Track" row shifts every one of those. **Refactor `menuOptions` to dispatch by
label** — `menuRoot()` already does exactly this and is the in-file precedent. Then the new row is
additive and index-fragile code stops existing.

New row: **"Music Track"**, placed directly after "Master Volume", with a ◄/► cycle over
`["Tense", "Retro", "Ambient"]` — the same left/right toggle idiom as the Difficulty screen's rows.
The renderer (`drawOptionsMenu`) needs a value column for it, mirroring `drawDifficulty`.

Persist as a new field on the existing `settings` object → `afd_settings_v1`.
**The key is FROZEN — do not rename it.** The load path already ignores unknown/corrupt values and
keeps defaults, so this is additive with no schema bump (same pattern as v3.0 P5's
`shotPowerupMode` / `magnetMode`).

⚠️ **FLAG-9b — first-gesture gating.** `AudioSys.ctx` doesn't exist until a user gesture. The
title track therefore cannot start on page load; it starts on the first key/button press. Every
`MusicSys` entry point needs the same `if (!AudioSys.ctx) return;` guard every `AudioSys` voice
already has.

⚠️ **FLAG-9c — this is the round's biggest perf risk.** A 4-layer scheduler running alongside a
late-wave field of glowStroke'd entities. Web Audio runs off the main thread, so the risk is the
*scheduler's* per-frame work, not the synthesis. Keep the lookahead window small and the
per-frame node creation bounded. Browser-only ask; headless tests can't see it.

---

## 10. Difficulty-lever reference doc — `DIFFICULTY-LEVERS.md`

New standalone doc at repo root. Catalogs every difficulty-ramping lever as it's built. Seeded
with the two from this round (§5, §6), both **tooled but disabled**.

**Shared mechanism** (built in the §5/§6 phase, reused by every future lever):
```
// A difficulty lever scales some quantity from `start` (wave 1) toward `floor` (full difficulty)
// along the shipped difficultyFactor() curve. When `enabled` is false the lever is INERT and the
// quantity is pinned at `start` — the lever is built, wired, and testable, but does not ramp.
// `floor` is a hard clamp: a lever can never take a quantity below its shipped baseline.
function leverScale(lever, wave) {
  const s = lever.enabled ? ramp(lever.start, lever.floor, wave) : lever.start;
  return Math.max(lever.floor, s);
}
```

Doc structure (house convention — includes an **Assumptions & Decisions** section):
1. **Purpose** — what a lever is and why they're catalogued centrally.
2. **The mechanism** — `leverScale`, `ramp`, `difficultyFactor`, the enabled/disabled contract,
   the floor-is-a-hard-clamp rule.
3. **Lever registry** — one entry per lever: name, constant, what it scales, `start` / `floor`,
   enabled?, shipped-in version, playtest status. Seeded with:
   - `LEVER_POWERUP_SIZE` — powerup pickup radius + sprite. start 2.0, floor 1.0. **Disabled.** v3.4.
   - `LEVER_DOCK_SIZE` — dock interaction radius + render. start 2.0, floor 1.0. **Disabled.** v3.4.
4. **Assumptions & Decisions** —
   - Levers ramp on `game.wave` via the existing `difficultyFactor` curve; they do **not** get
     their own curve. One `RAMP_WAVES` knob governs the whole game's pacing (GDD §2.13).
   - A lever's `floor` is always the **shipped baseline**, so enabling a lever can only ever
     return the game to today's difficulty, never past it. Making things *harder than today* is a
     separate decision requiring a baseline change, not a lever flip.
   - Levers are evaluated at **entity construction**, not per frame. Ramping affects newly-spawned
     objects only.
   - Both v3.4 levers ship **disabled** — they are tooling, not a balance change. The observable
     effect of v3.4 is that powerups and the dock are simply 2× bigger, permanently.
5. **Candidate levers not yet built** — a running list (e.g. `HUNTER_GARBAGE` counts,
   `GARBAGE_DECAY`, `POWERUP_DROP_CHANCE`, `CARGO_GROW_PER`) so future rounds have a menu.

---

## 11. Title brainstorm

Criteria: memorable, alliterative (coinlessgames.com house style), fits the Atomic Dustbin Dan
series framing, not confusable with an existing game.

⚠️ **None of these have been collision-checked** against Steam / itch.io / trademark registries.
Shortlist first, then check — I can run that search when you've narrowed it.

**Strongest, in order:**

1. **Orbital Offload** — alliterative, and *offload* is already the literal verb in the code
   (`game.offloadTimer`, the dock-offload block). The whole game is the loop of towing salvage to
   a dock and offloading it. Says exactly what you do. Cleaner than "Overhaul," which describes
   repair rather than collection.
2. **Radioactive Roundup** — R-R alliteration, "radioactive salvage" is the GDD's own phrase, and
   *roundup* is precisely the tow-chain mechanic (you're wrangling scattered things into a line).
   Distinctive; unlikely to collide.
3. **Salvage Scramble** — S-S, punchy, arcade-shaped. "Scramble" carries the frantic pacing.
   Slight risk: *Scramble* is a 1981 Konami arcade title, so it's not a fresh word in this space.
4. **Wreckage Wrangler** — W-W, very memorable, describes the tow chain exactly. Reads a little
   more cartoon/Western than the vector-glow aesthetic.
5. **Debris Duty** — D-D, terse, and the Dustbin Dan framing (a job, a shift, a route) is right
   there in "duty." Understated; may be *too* plain.

**Also viable:**
- **Junk Jockey** — J-J, extremely memorable, but reads more comic than the game's tone.
- **Trash Trawler** — T-T, and *trawler* nails the drag-a-net-behind-you tow chain.
- **Cosmic Custodian** — C-C, the Dustbin Dan joke made literal. A touch soft.
- **Scrap Salvo** — S-S, the shooting and the salvaging in two words. Terse and good.
- **Hazardous Haul** — H-H, "haul" is the code's own word for a chain delivery.

**On the incumbent:** *Orbital Overhaul* is a fine title — clean O-O alliteration, on-theme. Its
one weakness is that "Orbital" is a crowded word in space-game naming, and "Overhaul" suggests
repair/upgrade rather than the actual loop (collect, tow, recycle). **Orbital Offload** keeps
everything that works about it and fixes the noun.

---

## Open question (report only — no changes this round)

### Does towed garbage mass affect ship handling?

**Yes — through thrust and top speed. Not through inertia or turning.** Confirmed in the live
build.

`chainMass()` sums `node.mass` across every chain node (the Engine powerup halves the result while
active). That single quantity feeds **three** places:

1. **Thrust acceleration** (`Ship.update`):
   `thrustMul = 1 / (1 + chainMass() × CARGO_THRUST)`, `CARGO_THRUST = 0.06`
2. **Top speed** (`Ship.update`):
   `maxSp = SHIP_MAX_SPEED / (1 + chainMass() × CARGO_MAXSPD)`, `CARGO_MAXSPD = 0.03`
3. **The chain's momentum tug** (`updateChain`):
   `massFactor = min(1.4, chainMass() × CARGO_MASS)`, `CARGO_MASS = 0.07` — the chain physically
   pulls back on the ship, and that pull-back scales with load until it saturates at m≈20.

At today's `CARGO_CAP_MAX = 20` (mass 20): **45% thrust, 63% top speed, tug at its 1.4 ceiling.**
At §4's proposed 24: **41% thrust, 58% top speed**, tug unchanged (already saturated).

**The nuance that matters for your playtest question:** what is *not* modeled is **inertia**. Ship
mass is effectively constant — `SHIP_DRAG` is a flat velocity fraction, turn rate (`SHIP_TURN`) is
independent of load, and there's no momentum term that makes a loaded ship *coast* further or
*turn* more sluggishly. A heavy chain makes you **accelerate more slowly and cap out slower**, and
the chain physically **drags on you** (the tug), but it does not make you harder to stop or turn.

So: *"does more attached garbage require more thrust/time to change the ship's momentum?"* —
**Time, yes** (weaker acceleration means every velocity change takes longer). **Thrust, no** (you
have exactly one thrust input; it just does less). And **stopping and turning are not penalized at
all** beyond the reduced counter-thrust.

If the playtest verdict is "a full hold should feel like it *carries*," the missing piece is an
inertia term — a load-scaled reduction in `SHIP_DRAG` and/or `SHIP_TURN`. That's a real handling
change and a real risk (GDD §2.10.1's "broken, not heavy" warning applies double), so it's flagged
here and left unspecced for a future round.

---

## Housekeeping

- Archive `PLANNED-FEATURES-v3.4.md` + `IMPLEMENTATION-PHASES-v3.4.md` to `archive/` **with the
  version suffix intact** once v3.4 ships.
- `DIFFICULTY-LEVERS.md` is a **living doc** — it stays at repo root and is never archived.
- Still outstanding from v3.3: rename the bare `archive/IMPLEMENTATION-PHASES.md` →
  `archive/IMPLEMENTATION-PHASES-v2.md` (bare names are not allowed in `archive/`).