# PLANNED FEATURES — v3.6 (Changeset 8)

Target build: **v3.6**, from shipped **v3.5** (post-music-arc, docs closed out).
Every claim below was confirmed by grepping the attached live build — line numbers are that build's.

**All three forks are RESOLVED (Paul, this cycle) — no phase is blocked.** Everything else is a
best-guess with a FLAG. Forks and their resolutions are in §0; conflicts with shipped GDD §2 are in §1.

| fork | question | **resolved** |
|---|---|---|
| FORK-1 | which green, and do both cues die? | **Option B** — `COLOR.garbage` `#c8ff50` is the green; only the red (`clumpHot`) dies, `garbageLight` survives |
| FORK-2 | what triggers the hub emitter? | **Per-visit** — `game.deliveryCount === 10` |
| FORK-3 | do powerups bank instead of refresh? | **Yes** — adopt banking; magnitude still never stacks |

---

## 0. FORKS — need sign-off

### FORK-1 — Which green, and do we spend one cue or two? (Item 1) — ✅ RESOLVED: **Option B**

Grep result — there are **two** greens on garbage today, plus the red:

| constant | hex | reads as | drawn where |
|---|---|---|---|
| `COLOR.garbage` | `#c8ff50` (lime) | the canister | a `pieces === 1` single of `mass >= 1`, and the base of the clump lerp |
| `COLOR.garbageLight` | `#b8ffb0` (pale mint) | "low-mass, easy to tow" | a single of `mass < 1` (small-Hunter scrap), and chain nodes of `mass < 1` |
| `COLOR.clumpHot` | `#ff5a2a` (red) | "nearing the Hunter transform" | a `pieces > 1` clump, lerped from `COLOR.garbage` by `pieces / 12` |

"The colour small pieces get on first appearance" resolves to **`COLOR.garbage` `#c8ff50`** — that's
what a fresh canister from a Debris kill or a large/medium Hunter kill draws as (mass 1.0). Only
small-*Hunter*-tier scrap (mass 0.5) is born mint. If Paul was picturing the *mint* one, the change is
a one-constant swap and the code shape below is identical either way.

Then the real decision — **two cues are being spent here, not one:**

- **Option A — one colour, both cues die.** Every garbage body at every size draws `COLOR.garbage`.
  `clumpHot` **and** `garbageLight` are deleted. Maximum "is this safe?" legibility, zero exceptions.
- ✅ **Option B — TAKEN. Only the red dies.** Garbage draws `mass-per-piece < 1 ? garbageLight :
  garbage`, uniformly, for **singles and clumps alike** (today a clump ignores its own mass entirely
  and only reads the red lerp — so this actually *unifies* a rule that was split). `clumpHot` is
  deleted; `garbageLight` survives.

  Rationale: `garbageLight` is *also* green — it does not compromise the "safe to touch" read at all,
  which is the item's actual goal. The red is the only hue that says *don't*. Killing a working
  tow-weight tell for symmetry costs something and buys nothing.

**What is genuinely lost either way:** the clump's proximity-to-Hunter tell. §2.5.1 currently calls
`clumpHot` "the only tell that a clump is nearing the Hunter transform." After this, **size is the
only tell** — `radius = 7·√pieces`, so a 1-piece single is 7 px and a 12-piece clump is 24 px, a real
and monotone signal, but a much quieter one. That is the trade Paul already accepted ("instant *is
this safe* legibility is worth more than the threat meter"); recording it here so a future session
doesn't re-add the red thinking it was an oversight.

### FORK-2 — What triggers the hub emitter? (Item 3) — ✅ RESOLVED: **per-visit**

"Delivering a chain of 10 garbage items to the recycle hub" has two readings against the shipped code:

- ✅ **Per-visit — TAKEN.** `game.deliveryCount` is the per-visit combo counter (reset when the ship
  leaves the dock's neighbourhood, or on a chain break). Latch on `game.deliveryCount === 10`, one line
  above the existing `=== 12` Heavy Hauler latch — the exact same "passes through this value exactly
  once per visit" idiom, already proven. **Consequence:** a player who never hauls 10 at once never
  sees a hub drop. That is the intended pressure — big hauls are the payoff.
- **Cumulative.** `game.stats.delivered % 10 === 0` (per run, not per visit). Steadier supply, rewards
  dribbling 3 canisters at a time as much as a full chain. Softer, less on-pillar.

This matters more than it looks, because of CONFLICT-3 below: with Debris no longer dropping powerups
at all, the hub is now a **primary** supply source, not a bonus.

### FORK-3 — Does a same-type pickup now STACK instead of REFRESH? (Item 8's premise — REVERSES shipped §2.14) — ✅ RESOLVED: **yes, bank**

Item 8 says shot-limited powerups need a plain number because *"there is no meaningful maximum — the
player can bank unlimited credit,"* and that for time-limited ones *"stacking can exceed"* one
pickup's duration.

**Neither is true in the shipped build.** GDD §2.14's "Stacking rule" and `applyPowerup()` (L2721-2725)
both **refresh, never add**:

```js
} else if (powerMode(type) === "time") {
  game.powerFx[type] = powerDuration(type);      // refresh, not add
} else {
  game.powerBudget[type] = POWERUP_BUDGET[type]; // count mode: refresh to full
}
```

So today a budget is hard-capped at `POWERUP_BUDGET[type]` and a bar is perfectly meaningful. The HUD
spec's own rationale is only true if the stacking rule changes.

- ✅ **Adopt banking — TAKEN.** `+=` in both branches. Duration and shot-count accumulate;
  **magnitude still never stacks** (two Rapids don't double the fire rate) — that part of §2.14 stands.
  This is what makes the whole of item 8 coherent: a shots counter has no ceiling → plain number; a
  time bar clamps at 1.0 → "full = at least one pickup's worth left, surplus invisible" (the HUD's
  `clamp01(frac)` already does this, no change needed).
- **Alternative: leave refresh-only.** Then item 8's HUD is still buildable, but its stated reason is
  wrong and the shots number is bounded by `POWERUP_BUDGET`, which a bar would show just fine.

This is a deliberate reversal of a shipped §2 rule and was **not** in Paul's constraint list. **Signed
off: yes.** It gets the same in-place-supersession treatment in §2.14 that the garbage-decay bullets got
in Changeset 4 — the "refresh, never add" rule is superseded with its history preserved, not contradicted.

---

## 1. CONFLICTS with shipped behaviour — verified by grep

**CONFLICT-1 (Item 1, and Paul's Constraint 1).** §2.5.1's clump-render bullet documents `COLOR.clumpHot`
as the deliberate "only tell that a clump is nearing the Hunter transform," landed in v3.3 P1 and
explicitly *preserved* through the v3.5 P2 render rewrite. Item 1 deletes it. **Rewrite that bullet in
place, preserving its history — supersede, never contradict.** The new bullet must state (a) the tell is
now size alone, (b) why that was accepted, so no future session restores the red.

**CONFLICT-2 (Item 5).** `drawWorldBoundary()` (L3959) is called at L4020 as the first thing inside the
camera transform. Deleting it also orphans `BOUNDARY_DASH`/`BOUNDARY_GAP`/`BOUNDARY_WIDTH`/`BOUNDARY_GLOW`
(L261-264) **and invalidates the whole of `scratchpad/test-boundary.js` (20 assertions)** — that file is
100% about the boundary and must be **deleted**, not repaired. (Bonus: it carries a documented §E RNG
flake, which dies with it.) GDD §2.11 describes the boundary as an "interim wrap-visibility aid" —
rewrite in place to record that the aid was removed deliberately.

**CONFLICT-3 (Item 3) — the one to think hardest about.** The three new sources *replace* the shipped
drop rule, and the shipped rule is **not** "skewed toward Hunter kills." Grep says `maybeDropPowerup()`
is called from exactly two sites — `destroyDebris`'s small-tier branch (L2565) and `destroyHunter`'s
small-tier branch (L2595) — each at `POWERUP_DROP_CHANCE` 0.16. **Saucers currently drop nothing at
all.** So today a fully-cleared large Debris lineage (9 small kills) yields ~1.4 powerups, and Debris is
the most common target in the game.

After item 3, **Debris drops nothing, ever.** Supply becomes: saucers (one at a time, 12–30 s gaps),
large Hunters (exactly one per lineage, 14–32 s timer), and the hub. Early waves — few Hunters, sparse
saucers, small hauls — could go quite dry. This is on-pillar (it pushes supply onto the salvage loop),
but it is a real economy shift and FORK-2 is the compensating dial. **Flagged, not blocked.**

**CONFLICT-4 (Item 3, drop velocity).** `Powerup.update()` (L2326) applies `vx *= Math.pow(0.4, dt)` —
a "drop kick settles quickly" drag that kills ~60% of velocity per second. A drop that "flies on the
UFO's vector" or "travels until collected or expired" cannot have it. **Delete the drag outright** — it
is byte-identical for ambient Health (which spawns at rest, `vx = vy = 0`), and all three new emitters
want ballistic drops. `Powerup.update()` already calls `wrap()`, so a long-lived drifter is safe.

**CONFLICT-5 (Item 8, "same colour as the score").** Score is `COLOR.text`. Today the hull bar fill is
`COLOR.hp` green, dropping to `#ff7060` red below 30%; the shield fill is `COLOR.shield` blue, dropping
to `#ff7060` below 25%. A literal reading kills the **low-HP red bar** — which is one of the three tells
in §2.12's low-health warning system (siren + red chevron + red bar). **Best guess: the "same colour as
score" rule governs the NOMINAL state (labels + fills in `COLOR.text`); the low-HP / low-shield red
overrides survive.** FLAG-A — say the word if you actually want the red bar gone.

**CONFLICT-6 (Item 8, "remove total targets").** The `TARGETS` readout (L4080-4082) is the only thing
`scratchpad/test-targets.js` (12 assertions) tests. That file must be **deleted**, not repaired. The
wave-clear gate itself (`game.debris.length === 0 && game.hunters.length === 0`) is untouched — only the
readout dies.

**CONFLICT-7 (Item 6).** `killShip()` (L3060) sets `game.state = "gameover"` *immediately*, and
`update()` (L3291) hard-returns unless state is `"playing"`. That's the freeze. A spectacle needs the sim
to keep ticking, which means a new state — see §6.

**NO CONFLICT — Constraint 2 (scoop stays out of the timed machinery).** Verified:
`POWERUP_DROP_TYPES = ["rapid","triple","magnet","engine"]` (L303) drives the HUD active-effect loop
(L4088), `powerActive`, `powerMode`, `powerBudget`. `POWERUP_DROP_WEIGHTS` (L307, includes `scoop`) is a
separate table read only by `maybeDropPowerup`. The hub emitter is a new **emitter** that rolls the same
weights table and pushes a `new Powerup(...)` — it adds **no new type** anywhere. Nothing in this
changeset goes near `POWERUP_DROP_TYPES`.

**NO CONFLICT — Constraint 3 (scoopLevel 0 invariant).** Verified structurally safe:
`buildScoopSteps()` (L353) hardcodes index 0 to `0` and only interpolates `1..SCOOP_MAX_LEVEL`, and L363
`throw`s at load if `SCOOP_WIDTH[0] !== 0 || SCOOP_DEPTH[0] !== 0`. Rescaling `SCOOP_CONFIG` **cannot**
change level 0 — the guard is already in the code, not just in tests. The new translucent draw is
likewise gated on `game.scoopLevel > 0`, exactly as the prong V is today.

**NO CONFLICT — Constraint 4 (frozen keys).** `afd_settings_v1` (L1537) and `afd_achievements_v2`
(L2747) are the only two keys in the build. High scores get a **third**: `afd_scores_v1`. Neither
existing key is renamed, extended, or read by the new code.

---

## 2. Item 1 — All garbage glows safe-green

Resolve **FORK-1** first. Under Option B (recommended), the changes are:

- `COLOR.clumpHot` **deleted** from the `COLOR` block (L1687-1690).
- `lerpColor()` (L2190) becomes unused — **grep before deleting**; if nothing else calls it, delete it.
- `Garbage.draw()` (L2240-2260): the `pieces === 1` and `pieces > 1` branches now pick colour by the
  same rule. A clump's per-piece mass is `this.mass / this.pieces` — use that, so a clump of low-mass
  Hunter scrap is mint and a clump of normal canisters is lime, matching what its pieces looked like
  before they fused. The `drawCanister(..., scale = this.radius / 7)` call from v3.5 P2 is otherwise
  untouched.
- Chain-node render (L3286) already reads `n.mass < 1 ? garbageLight : garbage` — **unchanged**, and it
  is now the same rule as the field. Good.
- `COLOR.lowhp`'s comment (L1694-1695) name-checks `clumpHot` as a colour it was chosen to avoid — fix
  the comment, not the value.

`HUNTER_COALESCE_COUNT` is now read only by `coalesceGarbage`'s transform gate, not the render.

## 3. Item 5 — Remove the wraparound boundary

Delete `drawWorldBoundary()` (L3959-3968), its call site (L4020), the four `BOUNDARY_*` constants
(L261-264), and `scratchpad/test-boundary.js`. Nothing else reads them (grep-confirmed). No replacement
overlay — the point is to find out whether wrap reads fine without one. Purely a deletion; zero sim
effect.

## 4. Item 4 — Bigger scoop, drawn as a translucent capture region

**Scale.** One field: `SCOOP_CONFIG.maxWidthMult` **3.0 → 5.0**. With `SHIP_DRAW_W = 18` that takes the
L5 mouth from 54 px to **90 px** — 5× the ship. Levels 1–4 re-interpolate for free (`curve` 1.0, linear).
Level 0 stays 0 by construction (Constraint 3, guarded by the L363 `throw`).

**Depth — FLAG-B.** Item 4 only specifies width. At `maxDepth` 36 a 90 px-wide mouth is a letterbox. A
proportional bump lands near **`maxDepth: 60`** (36 × 5/3) with `minDepth` 20 unchanged — **shipped as a
starting point, not a decision.** `tools/scoop-lab.html` exists precisely to pick these five numbers by
eye; Paul should re-pick `maxDepth` (and possibly `curve`) there and hand-edit `SCOOP_CONFIG`, exactly
as after v3.4 P3. Don't agonise over it in code.

**Render — the mouth becomes the actual capture region.** Today `Ship.draw()` (L1811-1814) draws an open
V: `[[d, -hw], [16, 0], [d, hw]]`. That V is **not the capture box** — `inScoopBox()` (L2657) tests
`|lateral| <= SCOOP_WIDTH[lvl]/2 && forward >= -SHIP_RADIUS && forward <= SCOOP_DEPTH[lvl]`, i.e. a full
rectangle that extends *behind* the nose to `-SHIP_RADIUS` (= −13). The player has never been shown the
real region. Replace the V with the **exact box**, in ship-local space:

```
[[-SHIP_RADIUS, -hw], [d, -hw], [d, hw], [-SHIP_RADIUS, hw]]   // hw = SCOOP_WIDTH[lvl]/2, d = SCOOP_DEPTH[lvl]
```

filled translucent (`ctx.globalAlpha` ≈ 0.12–0.18, `COLOR.dock` green) **and** stroked with the usual
`drawPoly`/`glowStroke` outline so it stays inside the vector-glow language. Drawn before the hull,
inside the `!blink` block (so it blinks with the ship), hidden at level 0.

Derive the corners from `SCOOP_WIDTH`/`SCOOP_DEPTH`/`SHIP_RADIUS` — never re-type the numbers. If
`inScoopBox` and the drawn shape ever disagree, that is the bug this item exists to kill.

**FLAG-C — rendering-convention exception.** GDD §3.2 says vector-glow, no fills except bullets and
particles. This is a deliberate, documented exception (a HUD-ish affordance drawn in world space, not an
entity). Record it in §3.2, don't let it become a licence for filled entities.

**`tools/scoop-lab.html` must be updated in the same commit** — it carries verbatim duplicates of
`buildScoopSteps`/`inScoopBox`/the ship hull poly *and its own copy of the prong-V draw*. If the lab
still draws a V while the game draws a box, the lab stops being a preview of the game.

## 5. Item 3 — Powerup drops: three deterministic sources

Delete: `POWERUP_DROP_CHANCE` (L302), and **both** `maybeDropPowerup(x, y)` call sites (L2565 in
`destroyDebris`, L2595 in `destroyHunter`). Debris and small Hunters now drop nothing. (See CONFLICT-3.)

Keep: `POWERUP_DROP_WEIGHTS` (L307) — it stays the **type-roll** table for all three emitters. Rework
`maybeDropPowerup` into an unconditional `dropPowerup(x, y, vx, vy)`: roll the weights, push a
`new Powerup(x, y, type, vx, vy)`. No chance gate — the *emitters* decide when, this decides *what*.

Keep: `spawnHealthPowerup()` and its ambient `POWERUP_HEALTH_GAP` timer, untouched. Health is not a
drop and is not one of the three sources. **Do not delete it.**

Delete: the drag in `Powerup.update()` (CONFLICT-4).

**Source 1 — every UFO, large or small.** There are **two** saucer-kill sites and they are copy-pasted:
the bullet branch (L3508-3517) and the shield-body-contact branch (L3590-3597). Both do
`s.dead = true` + `addScore` + two achievement counters + `boom` + `AudioSys.saucer(false)`. **Extract a
`destroySaucer(s)` flow function** — shaped like `destroyDebris`/`destroyHunter`, placed next to them —
and call it from both sites. That is the single choke point for the drop, and it removes a live
duplication hazard. The drop inherits `s.vx, s.vy` exactly (no scaling — "flies on that vector").

**Source 2 — every large Hunter.** In `destroyHunter`, gate on `h.size === 3` (large only, *not* the
medium/small children) and call `dropPowerup(h.x, h.y, h.vx, h.vy)`. A large core's velocity is its
fixed spawn-time drift, so this reads as the core "spitting out" its cargo along its path.

**Source 3 — the hub.** At the dock-offload site (L3416-3453), on the FORK-2 trigger, emit one powerup
from the **dock's** position at `DOCK_POWERUP_SPEED` (new constant, ~120 px/s — a playtest knob) in a
random direction. It then drifts for its full `POWERUP_DECAY` (26 s) until collected or expired. A
`FloatText` at the dock ("SALVAGE BONUS" or similar) makes the causality legible. **FLAG-D:** the drop
must not be emitted *inside* the dock's collision footprint in a way that makes it instantly collectable
without moving — spawn it at the dock centre and let the launch vector carry it out; at 120 px/s it
clears a 2×-scaled dock in well under a second.

## 6. Item 8 + FORK-3 — Powerup stacking and the HUD rebuild

**Stacking (pending FORK-3).** `applyPowerup()` L2722/L2724 become `+=`. `game.powerFx[type]` is already
counted down per frame and the HUD's `frac` is already `clamp01`'d, so a stacked timer needs no other
change. `game.powerBudget[type]` becomes unbounded above.

**HUD.** `drawHUD()` (L4059-4147), left column, top to bottom:

1. **Score** — `COLOR.text`, unchanged (L4060).
2. **Level** — unchanged (L4074).
3. **Hull** — bar, label + nominal fill in `COLOR.text` (CONFLICT-5: keep the `<30%` red override).
   **At max** (`hp === SHIP_MAX_HP`) it must be *unmistakable* that a Health pickup would be wasted —
   FLAG-E, look-call: suggest the bar fill goes gold (`COLOR.ach`) with a `MAX` tag beside it, tuned on
   sight.
4. **Shield** — **moves from the top-right (L4140, `bx = VIEW_W - 30 - bw`) into the left column,
   directly beneath hull.** Same bar geometry, label + nominal fill in `COLOR.text`, `<25%` red override
   kept.
5. **Cargo** — `COLOR.text` when hauling, `COLOR.dim` when empty (today it's `COLOR.garbage` when
   hauling — that's the change).
6. **Powerups remaining** — the existing `POWERUP_DROP_TYPES` loop, moved below cargo. **Time-limited
   (`powerMode(t) === "time"`): keep the bar** (already clamped — a stacked surplus is invisible, which
   is the accepted behaviour). **Count-limited: no bar at all — glyph + the plain number.**

**Delete** the `TARGETS` readout and `targetsLeft` (L4080-4082), and `scratchpad/test-targets.js`
(CONFLICT-6).

**FLAG-F — the SCOOP pip row (L4104-4113) is not in Paul's list.** Best guess: **keep it**, directly
under the powerup rows. It is persistent state, not a timed effect, and is deliberately drawn *outside*
the `POWERUP_DROP_TYPES` loop (Constraint 2's whole point). Say the word if it should move or go.

All row y-offsets shift; they are bare literals today (46 / 62 / 104 / 126 / 146 / 172). Hoist them into
a small local layout cursor rather than re-deriving six magic numbers.

## 7. Item 2 — The Magnet is still underpowered

Shipped: `MAGNET_RANGE` 380, `MAGNET_PULL` 520, `MAGNET_PULL_MIN` 60, quadratic falloff
`accel = MIN + (PULL − MIN)·t²` where `t = 1 − d/RANGE`, then `accel /= √mass`, then `MAGNET_DAMP` 0.06.

**Grep found the actual culprit, and it isn't `MAGNET_PULL`.** `MAGNET_DAMP` is applied as
`g.vx = g.vx * Math.pow(0.06, dt) + (dx/d)*accel*dt`. At 60 fps that's `0.06^(1/60) ≈ 0.954` — the piece
loses ~4.6% of its velocity *every frame*. That makes the pull a **terminal-velocity governor**, not an
acceleration: solving the steady state gives `v_terminal ≈ accel / 2.7`. So:

- at the ship (`accel` 520) a piece tops out near **190 px/s**;
- at half range, 190 px out, the quadratic gives `accel = 60 + 460·0.25 = 175` → **~65 px/s**. A piece
  half a screen away closes at walking pace and takes ~3 seconds to arrive. **That is what "underpowered"
  feels like** — the mid-field is dead.

Three structural levers, in order of effect. Ship all three as named playtest knobs; **don't
over-specify the values** — they need feel, not arithmetic:

1. **Hoist the falloff exponent into a constant** `MAGNET_FALLOFF_POW`, and ship it at **1.0 (linear)**
   instead of the hardcoded square. At 190 px linear gives `accel = 290` (vs 175) — the mid-field wakes
   up. `t²` was a "near-field yank" choice; the near field was never the problem.
2. **Raise `MAGNET_PULL_MIN`** (60 → ~150). This lifts the entire far field, and by construction it's
   the number that governs how the top of the screen behaves.
3. **Weaken `MAGNET_DAMP`** (0.06 → ~0.35). Counter-intuitive: a *larger* value damps *less*
   (`pow(damp, dt)`). At 0.35 the per-frame retention is ~0.983, so `v_terminal ≈ accel / 1.0` — pieces
   arrive roughly 2.7× faster at the same `accel`. **This is the biggest single lever.** It also risks
   overshoot/jitter at the ship, which is exactly what the damping was added to prevent — so tune 1 and
   2 first, then 3, and watch for pieces orbiting the ship instead of landing.

Document the `v_terminal ≈ accel · dt / (1 − MAGNET_DAMP^dt)` relationship in a code comment above the
block. It is not obvious, and the next person to tune this will otherwise reach for `MAGNET_PULL` and be
disappointed, exactly as this round was.

Leave `MAGNET_RANGE` (380) and `accel /= √mass` alone.

## 8. Item 9 — Large Hunters pursue when they're the last ones standing

Condition: **no Debris left on the field.** `game.debris.length === 0 && !game.ship.dead`. (Saucers are a
separate, timed nuisance and don't block wave-clear, so they don't count as "satellites"; the wave-clear
gate is `debris.length === 0 && hunters.length === 0`, so this state is exactly "the wave is down to
Hunters.")

In `HunterSatellite.update()` (L2054), the `size === 3` core currently takes the `else` branch: it only
tumbles (`this.angle += this.spinRate * dt`) and rides the fixed velocity it got at construction. Add:

```
if (!this.homing && this.size === 3 && game.debris.length === 0 && !game.ship.dead) {
  // steer heading toward the ship at HUNTER_LAST_STAND_TURN rad/s (slow — this is a search-ender,
  // not a second homing tier), rebuild vx/vy at HUNTER_LAST_STAND_SPEED
}
```

Use the **wrap-aware `angleTo(this, game.ship)`** and the same shortest-angular-delta clamp the homing
branch already uses (L2058-2063) — a naive angle is ~180° wrong across a seam.

**Do NOT flip `this.homing = true`.** `this.shape` and `this.inner` are baked in the constructor off
`this.homing`, and `draw()` (L2074) picks `this.heading` vs `this.angle` off it. Flipping it mid-life
would silently swap the core's symmetric diamond for the kite silhouette *and* freeze its tumble — a
visual pop, and a change to the threat-tell language nobody asked for. Add a separate `this.pursuing`
flag (or just evaluate the condition inline; it's cheap).

Two new constants, both playtest knobs, both deliberately under-specified: `HUNTER_LAST_STAND_SPEED`
(slower than a medium homer — "slowly", per the item) and `HUNTER_LAST_STAND_TURN`.

**FLAG-G — no visual tell.** The core keeps its tumbling diamond while pursuing. Best guess: the pursuit
*is* the tell, and mid-life silhouette swaps read as bugs. If playtest says players don't notice, the
cheapest addition is stopping the tumble (heading-locked), not a new shape.

## 9. Item 6 — Game Over should be explosive

Today: `killShip()` sets `game.state = "gameover"`, and `update()` hard-returns, so the field freezes
under the text. To make it a spectacle the sim has to keep running — which means **a new `"dying"`
state** between `playing` and `gameover`.

`killShip()`: everything it does now stays (the `boom`, `scatterChain`, the two AudioSys teardowns, and
**crucially `game.stats.gameEnded = true` + `Achievements.evaluate()` + `Achievements.save()` — leave
these at `killShip`, so achievement timing does not change**). Only the state assignment changes:
`game.state = "dying"` and a new `game.deathT = DEATH_DURATION` (~2.5 s).

`update()`'s gate (L3291) gains a branch **before** the existing early-return: while `"dying"` and not
paused, run `updateDeath(dt)` and return. `updateDeath` keeps the world alive — advance particles,
floaters, garbage, debris, hunters, saucers, powerups, and the camera — but runs no ship input, no
spawns, no pickup pass, no collisions. Then the spectacle, all in new named constants:

- **Staged secondary detonations.** Over the death window, detonate nearby bodies in sequence
  (nearest-first, by wrap-aware `dist2`) — reuse `boom()` and the existing `destroyDebris(a, false)` /
  `destroyHunter(h, false)` **with `awardScore = false`** (both already take that flag — that's what it's
  for). The chain reaction is the spectacle, and it costs almost no new code.
- **Shockwave ring** expanding from the death point, drawn with `glowStroke` (an expanding stroked arc,
  no fill — stays inside §3.2).
- **Screen shake:** a decaying offset added to the camera translate in `draw()` (L4019). One `game.shake`
  scalar, decayed in `updateDeath`.
- **White flash** on frame 1 (a full-viewport `fillRect` at decaying alpha, drawn after the world).

At `deathT <= 0` → `game.state = "gameover"` and hand off to the high-score flow (§10).

**Every `game.state` read must be checked against the new state — here is the complete list from grep:**

| line | site | behaviour under `"dying"` |
|---|---|---|
| 1216 | confirm key → `startGame()` on title/gameover | correctly **excluded** (can't skip/restart the spectacle) |
| 1217 | pause key → `openPause()` when `"playing"` | excluded — **FLAG-H:** can't pause mid-death. Fine. |
| 1220 | `"o"` → system menu on title/gameover | excluded. Fine. |
| 1264 | gamepad `onTitleOrOver` | excluded. Fine. |
| 1757 | `AudioSys.thrust(... && state === "playing")` | thrust correctly silent |
| 3291 | `update()` gate | **the new branch** |
| 3717 | menu panel title | unreachable while dying |
| 4126 | HUD low-health pointer | `state === "playing"` → hidden. Fine. |
| 4183 | `Capture.active()` | screenshots/slow-mo disabled while dying — **FLAG-I:** arguably the one frame Paul most wants to screenshot. Consider allowing `P` during `"dying"`. |
| 4250 | `musicStateFor(s)` | falls through to `"off"` → the ~1 s `MUSIC_FADE_OUT` runs under the explosion. Good by accident; keep. |

## 10. Item 7 — Top-10 local high scores with 3-initial entry

**Storage — Constraint 4.** New third key, `afd_scores_v1`. `afd_settings_v1` and `afd_achievements_v2`
are untouched, unread, unextended. Same guarded `lsGet()`/try-catch idiom as both existing stores.

**The record is the WIRE shape.** Design it so a remote leaderboard can consume it with **no migration**:

```js
// One immutable run record. This object is what a future leaderboard POSTs, verbatim.
// ADD fields; never rename, never repurpose, never reorder-with-meaning.
{
  v:         1,              // record schema version — lets a server accept mixed-version clients
  id:        "a1f3…",        // client-generated, unique, stable — the DEDUPE KEY for a later sync/upload
  initials:  "PDW",          // exactly 3 chars from the entry charset
  score:     123450,
  wave:      14,             // LEVEL reached
  delivered: 87,             // canisters recycled — the salvage loop's headline stat
  ts:        1752300000000,  // Date.now(), UTC ms
  build:     "3.6"           // the game version that produced the run
}
```

Store: `{ v: 1, entries: [ … ] }`, sorted score-desc, sliced to `SCORES_MAX` (10). **What makes the
deferred work migration-free:** `id` is present from day one (a server dedupes on it, so a client can
upload its whole local table later without double-counting), `v` is present on both the store and the
record (so a server can accept a v1 record from a stale client forever), and a `playerId`/`name` field is
**purely additive** when login lands — nothing needs to change shape. Generate `id` via
`crypto.randomUUID?.()` with a `Math.random()` hex fallback.

**Entry.** At the `"dying"` → `"gameover"` transition, if the run qualifies (`score > 0` and either
fewer than 10 entries or `score > entries[9].score`), set `game.entry = { initials: [0,0,0], idx: 0 }`.
The gameover screen renders three big slots; up/down cycles the charset (`A–Z`, `0–9`, and a space —
keep it a single `const SCORES_CHARSET` string), left/right moves the cursor, confirm commits. Wire it
through **both** input paths — the keydown normal branch and the gamepad's already-edge-detected
`menuNavEdges()` (a held stick must not spin the letter, exactly like the v3.5 P1 `e.repeat` fix).

**⚠️ The load-bearing input guard:** L1216 currently starts a new game on confirm from `"gameover"`.
It **must** become `… && !game.entry` or Enter will restart the run instead of committing the initials.
This is the single most likely bug in the phase.

After commit (or immediately, if the run didn't qualify), the gameover screen shows the **top-10 table**
with the fresh entry highlighted, above the existing "PRESS ENTER TO PLAY AGAIN".

**FLAG-J:** also add a `"High Scores"` row to `MENU_ROOT_SYS` (`["Options", "Achievements", "Back"]`)
so the table is browsable from the title. Cheap — the menu dispatches by label and `menuPanel()` already
exists — and it reuses the same table renderer. **Included in the phase.** Note this shifts
`MENU_ROOT_SYS` indices; `test-p4.js` keys off labels, not indices, but re-run it.

---

## 11. Deferred / explicitly NOT in this changeset

- Player login, profile, remote leaderboard (item 7 — designed for, not built).
- Any replacement for the deleted wraparound boundary (item 5 — decided by playtest, after).
- Re-arming the dormant music intensity layering (v3.5's freeze stands).
- Splitting the single HTML file into modules (still parked; Paul asked not to act on it).

## 12. Playtest asks this round hands back

1. Does a single-green field actually read as safer — and is the clump's **size** enough of a
   Hunter-transform warning now that the red is gone? (FORK-1's real cost.)
2. Does wrap make sense with no boundary line at all? (Item 5's whole purpose.)
3. Is the powerup supply too thin at low waves now that Debris drops nothing? (CONFLICT-3.)
4. Does the Magnet finally feel strong — and does the weakened damping make pieces orbit instead of
   land? (§7 lever 3.)
5. Is a slowly-pursuing large Hunter *legible* without a silhouette change? (FLAG-G.)
6. Is the 5× scoop mouth so big it trivialises collection, and is the translucent box readable against a
   busy field? (`tools/scoop-lab.html` answers "how big does it look"; only play answers "is it too
   easy".)