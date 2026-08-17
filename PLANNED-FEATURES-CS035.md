# PLANNED-FEATURES-CS035 — Orbital Overhaul

Spec for changeset CS035. Companion: `IMPLEMENTATION-PHASES-CS035.md`.

Baseline: `42cecae` ("cs-34 p9: closing phase — version 1.0.0.34, Gate B fold-in, doc sweep"),
`GAME_VERSION` `1.0.0.34`, registry **91** entries / **10** section headers, `LEVERS` **18**,
suite **137/137 on a full clone**. Thirteen suite files hard-fail on a shallow clone — work from a
**full clone**, never `--depth 1`.

Five scope areas, all from Paul's CS035 request document:

1. Delivery score readout re-tune (the ticker still doesn't read)
2. No Debris pickup while parked at the Recycle dock
3. Level-end invincibility window around the achievement panel
4. Large Hunter Satellites become volatile with age
5. Powerup feedback loop — chain-guard rarity and Super Mega Delivery volume

---

## §0 Corrections to prior assumptions

### §0.1 This is CS035. CS034 is closed.

Paul's request document is headed "Changeset 034". CS034 shipped at `42cecae`; `log/CS034.md`
is written and both CS034 planning docs are in `archive/`. Everything here is **CS035**.

### §0.2 ⛔ The item-2 diagnosis is close but not the mechanism

Paul's hypothesis: picking up new Debris while unloading at the dock trips "one of our failsafes"
and interrupts the chain bonus.

**Incidental pickups inside the ring already do NOT reset `deliveryCount`.** The `!inRing` guard at
the pickup gate exists precisely to prevent that, and CS020 P1b's comment on it says so in terms:
"resetting on EVERY hook would mean a magnet grab at the dock kills a player's own run mid-offload —
the exact unfairness this phase exists to remove."

What actually happens is the **LIFO queue jump**. A piece hooked inside the ring is tagged
`towed: false` at capture and `push`ed onto the chain **tail**. The offload `pop`s from the tail.
So an incidental hooked mid-offload is delivered **next**, ahead of the towed load, and lands in
the `else` branch — which awards `DOCK_BASE_SCORE` and nothing else. No `deliveryCount++`, no
escalating `pts`, no `AudioSys.deliver(deliveryCount)` pitch climb, no ticker growth. The player
sees a stall in the middle of a climbing chain, hears the flat pitch, and reads it as lost credit.

**The load is intact. The feedback is not.** `deliveryCount` still reaches 24 across the towed
pieces and the Super Mega Delivery still fires.

The one path that genuinely zeroes the counter is hooking something while **outside** the ring
(`dock.radius + DOCK_NEIGHBORHOOD_PAD`). §2's lockout does not reach that path, and is not
intended to — see §2.6.

### §0.3 Hostile bullets do not test Hunters at all

The hostile branch of the bullet-collision pass tests the ship and the tow chain. It does not
iterate `game.hunters`. "Hit by a UFO shot" (§4) is **new wiring**, not a threshold tweak.

### §0.4 Hunters do not participate in the bounce pass

The satellite-vs-satellite elastic bounce introduced by CS023 walks `game.debris` only —
an `i`/`j` double loop over that one array. `game.hunters` is a separate array and appears in
neither side. **Hunter↔Hunter collision does not exist in any form today**, elastic or damaging.
§4's mutual-detonation source is new wiring.

### §0.5 The wave-clear condition reads Debris only — Hunters are alive at level end

`if (game.debris.length === 0)` is the whole wave-clear test. Hunters carry over across waves by
design and are **not** wiped by `nextWave()`. A player at level end is routinely sharing the
screen with live homing Hunters.

This makes §3 more than a nicety: the current build genuinely can drop a player out of a dismissed
achievement panel into a medium Hunter's face.

---

## §1 Delivery score readout — re-tune (FORK-A → apply, FORK-B → suppress)

### §1.1 What changes

Seven values, taken from Paul's dock-float-lab session (GATE/GATE A lines in the request doc) and
applied as the new defaults. Model C and the dock anchor are unchanged — they shipped in CS034 P8.

| Symbol | Shipped (CS034) | CS035 |
|---|---|---|
| `DELIVERY_FLOAT_ANCHOR_FRAC` | `0.75` | **`0.50`** |
| `DEBUG.deliveryFloatRise` | `200` | **`150`** |
| `DEBUG.deliveryFloatSize` | `18` | **`16`** |
| `DEBUG.deliveryFloatSizeStep` | `0.0` | **`1.0`** |
| `DEBUG.deliveryFloatSizeMax` | `36` | **`48`** |
| `DEBUG.deliveryFloatHold` | `0.25` | **`0.00`** |
| `DEBUG.deliveryFloatFade` | `0.75` | **`1.20`** |
| `DOCK_OFFLOAD_INTERVAL` | `0.05` | `0.05` — unchanged, already correct |

`min`/`max`/`step` bounds on all five registry rows are unchanged. Only `def` moves. The lab's
values for `min`/`max` in the request document match what already shipped.

**No new registry entries and none retired. This is a `def` change and one constant.**

### §1.2 ⚠ This reverses CS034's GATE A outcome, deliberately

CS034 P8 shipped the GATE A numbers Paul returned from the lab. These are different numbers from
a later lab session. That is not a contradiction — it is a second measurement — but the build
should record it, so the `def` comment on each row says CS035 and does not pretend CS034's values
never existed.

`sizeStep` moving `0.0 → 1.0` is the substantive one: CS034 shipped per-piece growth machinery
and then set its step to zero, so the ticker never actually grew. **CS035 turns the mechanism on
for the first time.** At `size` 16, `step` 1.0, `cap` 48, a 24-piece haul climbs 16 → 39px and
never reaches the cap; the cap only binds above 33 pieces, which `CARGO_CAP_MAX` makes unreachable.
That is intentional headroom, not a dead knob.

### §1.3 Milestone floaters — suppressed during a dock visit (FORK-B → 3)

The lab's clearance readout measures the delivery ticker's glyph box against **two** floaters, and
at the CS035 values the measured ink clearance is **−15.7px** — real overlap. Those two floaters:

- **`"SALVAGE BONUS"`**, `COLOR.dock`, default size, at `game.dock.y - 22` — fires once per visit,
  on the first of the four 8/12/16/20 reward-tier awards.
- **`"MAX HAUL"`**, `COLOR.ach`, size 24, at `game.dock.y - 22` — fires at
  `deliveryCount === CARGO_CAP_MAX`.

**Both `FloatText` pushes are deleted.** Nothing else in either block moves:

- The four `dropPowerup()` reward-tier awards at 8/12/16/20 **stay**.
- `game.stats.maxChainVisit = true` **stays**.
- `game.cargoFlash = HUD_CAP_FLASH` **stays** — the HUD cargo pip flash is now the sole visual
  tell for a max haul, alongside the ticker itself.
- `superMegaDelivery()` and its `VoiceSys.say("dock_24")` **stay**.

The ticker is the readout. Two more strings landing on top of it in the same 40px of screen were
the overlap the lab was measuring.

> **⚠ FLAG-CS035-a — the 24-haul loses its text celebration.** After this change a Super Mega
> Delivery announces itself with: a size-39 ticker showing a four-figure number, the HUD cargo
> flash, the `dock_24` voice line, and roughly thirty powerups erupting from the dock. That is
> assessed as sufficient. **The gate asks whether it still lands.** If not, the fix is to
> re-introduce `"MAX HAUL"` at a y-offset clear of the ticker — not to restore it in place.

### §1.4 Not touched

The incidental (non-chain) delivery floater's `COLOR.dock` / size-12 treatment is CS034 P9's
Gate B fix and stays exactly as shipped — **but note §2 makes it unreachable**; see §2.4.

---

## §2 No Debris pickup while parked at the dock

### §2.1 The rule

**While the ship is inside the dock neighbourhood ring, it cannot hook Debris. Debris that reaches
the ship or the scoop mouth is pushed away.**

"Inside the ring" is `dist2(ship, dock) < pad * pad` where `pad = dock.radius +
DOCK_NEIGHBORHOOD_PAD` — the **same** expression the pickup gate already computes as `inRing`
(FORK-C → the ring). Not the offload radius (`dock.radius + 10`), not `dock.radius`.

The ring was chosen because it is the boundary the whole incidental concept was already keyed on.
Using it makes the incidental category **empty by construction** rather than leaving a narrow
annulus where the old behaviour survives.

### §2.2 The pickup gate

At the capture gate, `inRing` is already computed one line above the branch. The gate gains it:

```
if (!inRing && game.chain.length < game.cargoMax && (dist2(...) < pickR*pickR || inScoopBox(g)))
```

**Unconditional** (FORK-F → yes): it applies with an empty chain, a full chain, and every chain
length between. A conditional lockout is not learnable — the player would have to model
`chain.length` to predict whether the dock eats their pickups.

### §2.3 The push (FORK-E → simple push, no damage, no recoil)

A Debris piece (`Garbage`, canonically Debris) whose centre comes within the capture region while
the lockout holds gets a **radial velocity away from the ship**, not an elastic bounce.

- Direction: the wrap-aware unit vector ship → piece (`shortDelta`, same idiom the magnet uses).
- Magnitude: velocity is **set**, not added — `g.vx = ux * DEBUG.dockBounceSpeed`, likewise `vy`.
  Setting rather than adding is what stops a piece pinned between the ship and the dock from
  accumulating speed frame over frame.
- **`debrisBounce()` is not called and must not be.** It is a mass-aware two-body elastic solver
  written for satellites; its own dispatch comment warns against handing it bodies it wasn't
  built for. A canister has `mass` but no `size`, and the ship is not in its contract.
- **The ship is unaffected.** No recoil, no velocity change, no damage, no hit-stun, no
  `AudioSys` call on the ship's behalf.
- A short audible tell is appropriate. Reuse `AudioSys.shieldPing()` — the shipped "a contact was
  deflected" voice. **No new audio method.**

New knob: `dockBounceSpeed`, DELIVERY section, `def 90`, `min 20`, `max 300`, `step 10`, unit
`px/s`. Label `"Dock bounce speed"` (17 chars).

### §2.4 The incidental branch is deleted (FORK-D → delete)

With the lockout at the ring, no node can ever be created with `towed: false`. The offload's
`else` branch is unreachable. Delete:

- The `else` branch in the offload block (the `DOCK_BASE_SCORE` award, its `FloatText`, and
  `AudioSys.deliver(1)`).
- The `const towed = node.towed !== false;` binding and the `if (towed)` wrapper — the towed
  branch's body becomes the whole of the pop handler.
- The `towed: !inRing` field on **both** chain-push sites (single and clump).

⛔ **`inRing` itself is NOT deleted.** It is still the pickup gate's own guard (§2.2) and still
guards the `game.deliveryCount = 0` reset for a fresh haul started outside the ring. Only its
**third** consumer — the `towed` tag — goes.

> **⛔ Suite trap.** CS020's `!== false` idiom exists because "every chain node any older test
> seeds by hand" has no `towed` field and must default to towed. Removing the field removes the
> need for the idiom, but **any suite file that asserts on `towed`, or that seeds `towed: false`
> to exercise the incidental branch, will now be asserting on deleted behaviour.** Grep
> `scratchpad/` for `towed` before touching the build and fix what turns up in the same commit.

### §2.5 Magnet attraction suppressed inside the ring (FORK-G → suppress)

Without this, a Magnet running at the dock drags every loose piece in a 380px radius into the ship
to be pushed away, pulled back, and pushed away again — a permanent churn at the exact spot the
player is trying to read a score off.

`pulling` is captured once above the garbage loop and is the suppressible name (CS025 P1's
two-name split: `magnet` is the raw budget predicate, `pulling` is the suppressible one). The
suppression rides `pulling`:

```
const pulling = magnetPulling() && !shipInDockRing;
```

⛔ **The two budget-spend sites read `magnet`, not `pulling`, and must stay that way.** CS025's
comment on that split is explicit that repointing a spend site at `pulling` hands out free hooks.
The lockout makes hooks impossible in here, so nothing spends anyway — but the split is a standing
invariant and this phase does not get to relax it.

⛔ `pickR` also reads `pulling`, so the widened magnet pickup circle collapses to
`GARBAGE_PICKUP` inside the ring. That is correct and intended — the circle is moot when the gate
above it is closed, and keeping the two in step preserves CS025's "the circle comes back WITH the
pull" rule.

`magnetPushBurst()` and `game.magnetHoldT` (the full-cargo hold) are **untouched**. They are a
different mechanic answering a different question, and CS025's edge-boolean invariant on
`game.cargoWasFull` is not this phase's business.

### §2.6 What this does and does not fix

**Fixes:** the queue-jump stall of §0.2. With no incidentals, every pop is a towed pop, every pop
advances the ticker, and the pitch climb is unbroken for the whole visit.

**Does not fix:** the genuine `deliveryCount = 0` reset that fires when a player hooks something
while **outside** the ring during a grace window. That is CS020 P1b's designed behaviour —
gathering again starts a new effort — and it is what bounds the counter and kills the farmable
annulus. **It is deliberately left alone.**

> **⚠ FLAG-CS035-b — new failure mode.** A player who parks *just* outside the ring to grab one
> more piece before dipping in now still loses their run, and the lockout makes the ring boundary
> matter more than it used to. There is no visual tell for the ring. The gate asks whether the
> boundary is felt or merely suffered; a dock-ring render is the obvious follow-up if it is the
> latter, and is **out of scope here**.

---

## §3 Level-end invincibility window

### §3.1 The sequence

| # | Moment | Duration | Ship |
|---|---|---|---|
| 1 | `game.debris.length === 0` first true | — | invincible from this frame |
| 2 | Hold | `DEBUG.levelEndHold` (5.0s) | invincible, **full control** |
| 3 | Achievement panel, if any | until dismissed | frozen (`update()` already freezes) |
| 4 | `nextWave()` → `"Level N"` banner | `DEBUG.levelBannerTime` | invincible |
| 5 | Grace | `DEBUG.levelEndGrace` (3.0s) | invincible, pulse accelerating |
| 6 | — | — | vulnerable, gameplay continues |

If no panel is pending, step 3 is skipped and 2 runs straight into 4 — no separate code path, the
existing `if (game.state === "playing" && game.pendingAch.length)` branch already forks there.

**FORK-L → yes:** the player retains full control throughout — thrust, rotate, fire, tow, dock.
Steps 2/4/5 are ordinary gameplay frames with damage switched off.

### §3.2 Four new knobs — CELEBRATION section

| id | label | def | min | max | step | unit |
|---|---|---|---|---|---|---|
| `levelEndHold` | `Level-end hold` | `5.00` | `0` | `15` | `0.25` | `s` |
| `levelEndGrace` | `Level-end grace` | `3.00` | `0` | `10` | `0.25` | `s` |
| `levelEndFade` | `Level-end fade time` | `0.25` | `0.05` | `1.50` | `0.05` | `s` |
| `levelEndGracePulseEnd` | `Level-end grace pulse end` | `0.08` | `0.02` | `0.50` | `0.02` | `s` |

> **Correction on `levelEndGracePulseEnd`.** In conversation this was offered as a *period* of
> 0.15s. It is specified here as a **one-way transition time**, `def 0.08`, to match
> `levelEndFade`'s units exactly. Both knobs answer "how long does 100% → 20% take"; the full
> pulse period is 2×. Two knobs in the same units cannot be misread against each other; a mixed
> pair can and eventually would.

### §3.3 State

Three new fields on `game`, reset in `startGame()`:

```
levelEndSafe:  false,   // the invincibility flag — read by every damage gate
levelEndGraceT: 0,      // sec of post-banner grace remaining; > 0 only during step 5
levelEndPulseT: 0,      // pulse phase, in HALF-CYCLES (see §3.5)
```

⛔ **The name is `levelEndSafe`, not `invuln`, and the two are separate.** `ship.invuln` is
hit-stun i-frames and drives a 10Hz hard square blink in `Ship.draw()`. Folding level-end
invincibility into it would (a) inherit the blink, which is the wrong visual, and (b) make a
level-end window indistinguishable from "I just got hit". Every damage gate reads **both**.

⛔ **`nextWave()` must NOT reset any of the three.** `nextWave()` runs *inside* the window
(step 4). Its reset block already carries a comment listing what it zeroes and why —
`sweepPause`/`deliveryCount` are in-flight state meaningless at a wave start. These three are the
opposite: they are in-flight state that **must survive** the wave boundary. Add them to
`startGame()` only, and put a line in `nextWave()`'s comment saying so.

### §3.4 Arming and disarming

**Arm** — in the wave-clear branch, before `waveClearTimer += dt`:

```
if (game.waveClearTimer === 0) { game.levelEndSafe = true; game.levelEndPulseT = 0; }
```

The zero-check is the "passes through exactly once" latch idiom the build already uses in four
places at the dock. `waveClearTimer` is zeroed by the `else` branch when Debris exists, so this
re-arms correctly on every clear.

⛔ **The threshold moves from `2.5` to `DEBUG.levelEndHold` (FORK-I → replace).** The literal
`if (game.waveClearTimer > 2.5)` becomes `> DEBUG.levelEndHold`. Not additive — 5.0s total, not
7.5s.

**Arm the grace** — at the level-banner countdown, a one-shot on the crossing:

```
const wasLive = game.levelBanner.life > 0;
game.levelBanner.life -= dt;
if (wasLive && game.levelBanner.life <= 0 && game.levelEndSafe) {
  game.levelEndGraceT = DEBUG.levelEndGrace;
}
```

⛔ The `game.levelEndSafe` clause is load-bearing. `startGame()` calls `nextWave()` for wave 1,
which seeds a banner with no level-end window behind it. Without the clause, every new run would
open with 3 seconds of free invincibility.

**Disarm** — tick the grace wherever per-frame timers live:

```
if (game.levelEndGraceT > 0) {
  game.levelEndGraceT = Math.max(0, game.levelEndGraceT - dt);
  if (game.levelEndGraceT === 0) game.levelEndSafe = false;
}
```

### §3.5 The visual (FORK-M → continuous pulse, FORK-M2 → yes)

A **triangle wave on ship alpha, 100% → 20% → 100%**, running continuously for the whole window.
One-way transition time is `DEBUG.levelEndFade` (0.25s), so the resting period is 0.5s.

⛔ **Phase is accumulated in half-cycles, not seconds.** `levelEndGracePulseEnd` changes the
period mid-window; a seconds-based phase would jump discontinuously the moment the period moved.

```
const oneWay = game.levelEndGraceT > 0
  ? lerp(DEBUG.levelEndFade, DEBUG.levelEndGracePulseEnd,
         1 - game.levelEndGraceT / Math.max(0.0001, DEBUG.levelEndGrace))
  : DEBUG.levelEndFade;
game.levelEndPulseT += dt / Math.max(0.0001, oneWay);
```

Alpha, in `Ship.draw()`:

```
const p = game.levelEndPulseT % 2;
const tri = p < 1 ? p : 2 - p;      // 0 → 1 → 0
const a = 1 - 0.8 * tri;            // 1.0 → 0.2 → 1.0
```

The 0.2 floor and the 1.0 ceiling are **not knobs**. Two more sliders for a thing whose whole job
is "obviously not normal" is knob sprawl; if the gate wants a different floor it is a one-line
`def`-style change in a later changeset.

**During `levelEndSafe`, the hit-stun `blink` is skipped entirely** — the alpha pulse replaces it.
Otherwise a hit taken just before the clear would strobe the ship at 10Hz on top of the 2Hz pulse.

⛔ **`ctx.globalAlpha` must be restored to `1` before the shield block.** That block sets its own
alpha and assumes it is entering at 1. Three existing draw sites in the file follow the
set-draw-restore idiom; follow it exactly.

**M2 — the accelerating tail.** During step 5 the one-way time ramps 0.25s → 0.08s across the 3
seconds, so the pulse visibly speeds up as protection runs out. No countdown text, no second
channel; the thing already moving simply moves faster.

### §3.6 Damage gates — five sites

`levelEndSafe` extends every gate that `ship.invuln` guards, **plus the two chain gates**
(FORK-K → yes: the tow chain is protected too, or "safe" is a lie).

| # | Site | Change |
|---|---|---|
| 1 | Hostile bullet vs player | `!game.ship.dead && game.ship.invuln <= 0` → `&& !game.levelEndSafe` |
| 2 | Hazards vs ship | same guard, same addition |
| 3 | Hunter knockback / i-frame block | same guard, same addition |
| 4 | Hostile bullet vs tow chain | new `!game.levelEndSafe` guard on the whole block |
| 5 | Hazards vs tow chain (`chainScan`) | new `!game.levelEndSafe` guard on the whole block |

⛔ Sites 4 and 5 are **guarded, not absorbed**. They must not route through `breakChain()` at all
during the window — routing there would spend chain-guard charges and speak `chain_guard`, both
wrong for a protection the player did not earn.

⛔ **`shieldDeflect` / `shieldBounce` and the shield's own energy cost are untouched.** A player
holding shield during the window sees no change; the outer gate simply never reaches them.

⛔ **`game.stats.dmgThisWave` and the Perfect Wave latch are untouched.** They are evaluated in
the same frame the window opens, before any of this can affect them.

### §3.7 Not touched

- The celebration panel itself — its open, its input gating on **both** keyboard and gamepad
  handlers, its `resume: "wave"` field, and `dismissCelebration()`'s deferred `nextWave()` call.
  ⛔ The `return` that *is* the deferral stays exactly where it is.
- `game.pendingAch` remains a flushed bucket, never filtered by `game.wave`.
- The `game.state === "playing"` clause on the celebration branch stays. It is not redundant —
  `killShip()` flips state mid-frame.

---

## §4 Large Hunter Satellites become volatile with age

### §4.1 The rule

A large Hunter core (`size === 3`) accumulates age from construction. On reaching
`DEBUG.hunterVolatileAge` it becomes **volatile**: it starts a visible size heartbeat, and it
becomes destructible by three sources it previously ignored.

**Volatility is a vulnerability, not a fuse** (FORK-R). A volatile Hunter left entirely alone
drifts forever, pulsing. Nothing self-detonates.

### §4.2 Age (FORK-N → construction)

`this.age = 0` in the `HunterSatellite` constructor; `this.age += dt` at the top of `update()`,
unconditionally, every tier. Volatility reads `this.size === 3 && this.age >= DEBUG.hunterVolatileAge`.

Construction, not spawn, is the origin because larges arise from exactly one source — garbage
coalescing to `HUNTER_COALESCE_COUNT` — and are constructed in place at the clump's position.
There is no separate spawn event to hang a clock on. (`static spawnCore()` was deleted in
CS024 P3.)

Ageing all tiers rather than gating on `size === 3` costs one float per Hunter and leaves the
field available if a later changeset wants it. Medium and small ignore it.

### §4.3 The heartbeat (FORK-Q → draw-only)

A scale factor oscillating between `hunterPulseMin` and `hunterPulseMax`, asymmetric: fast growth,
slow shrink. Symmetric would read as *breathing*; asymmetric reads as *pumping*.

| id | label | def | min | max | step | unit |
|---|---|---|---|---|---|---|
| `hunterVolatileAge` | `Hunter volatile age` | `30` | `0` | `120` | `1` | `s` |
| `hunterPulseMin` | `Hunter pulse min` | `92` | `50` | `100` | `1` | `%` |
| `hunterPulseMax` | `Hunter pulse max` | `115` | `100` | `200` | `1` | `%` |
| `hunterPulseGrow` | `Hunter pulse grow rate` | `55` | `5` | `300` | `5` | `%/s` |
| `hunterPulseShrink` | `Hunter pulse shrink rate` | `28` | `5` | `300` | `1` | `%/s` |

At defaults: 92% → 115% in ~0.42s, back in ~0.82s, a ~1.24s cycle.

State: `this.pulseScale` (init `100`) and `this.pulseUp` (init `true`), advanced in `update()`
only while volatile. Clamp at both ends and flip direction on the clamp.

⛔ **Draw-only.** `this.radius`, `this.shape`, and `this.inner` are **not** rebuilt.
`drawPoly` receives scaled vertex arrays for this frame; the collision radius every pass reads is
unchanged. A pulsing hitbox would make the ship's contact damage depend on animation phase.

⛔ **`this.shape` and `this.inner` are baked at construction and read by `draw()`.** Scale at the
draw call, do not mutate the stored arrays — mutating them compounds every frame.

Colour is unchanged (`COLOR.satellite`). The motion is the tell.

### §4.4 Damage sources (FORK-O → all three, FORK-P → 3-way split, no score)

A volatile large is destroyed by:

1. **Hunter↔Hunter contact** — a new pair walk over `game.hunters`, in the same place in the
   collision order as the existing satellite-vs-satellite pass. **Both** bodies must be volatile
   larges for either to die; both die. A volatile large touching a medium or small does nothing
   to either. New wiring (§0.4).
2. **A hostile bullet** — the hostile branch gains a `game.hunters` loop testing volatile larges
   only. New wiring (§0.3). The bullet dies on contact, as it does against the ship.
3. **A saucer body** — the existing UFO-vs-debris pass gains a Hunter arm. **Both die**: the
   saucer via `destroySaucer(s, false)` (no score, exactly as it dies against a satellite), the
   Hunter via `destroyHunter(h, false)`.

Non-volatile larges, mediums, and smalls are **unaffected by all three**. They pass through each
other and through saucers exactly as they do today.

⛔ **Player bullets are unchanged.** They kill any Hunter at any tier at any age, volatile or not,
with full score and achievement credit. Nothing in this section touches the player-bullet arm.

**All three call `destroyHunter(h, false)`.** The `awardScore = false` argument is the shipped
gate for score *and* achievement counters — the same argument the ring-detonation site uses.
A Hunter that dies to a UFO is not the player's kill.

⛔ **The split stays 3-way in all cases.** `destroyHunter()` is not levered and
`ACH_LINEAGE_FULL = 13` depends on it. A volatile large killed by a UFO shot yields three
mediums, exactly as a player-shot one does. **This is the whole point of the feature**: a
passively-drifting large becomes three homing mediums without the player choosing it.

⛔ **`HUNTER_GARBAGE[3] === 0`** as of CS034 P3 — a large sheds no Debris on death at any tier.
This is unchanged and is what keeps the feature from re-opening the 12-in/66-out amplifier.

### §4.5 Difficulty consequence

This is the changeset's main answer to "the game is getting pretty easy". The current dominant
strategy — leave larges alone, they drift harmlessly — stops working, because the player no longer
controls whether a large splits. A field of aged larges plus one saucer pass becomes a field of
mediums.

⛔ **This is not a lever and does not go in `LEVERS`.** It is a flat rule at every wave, in the
same spirit as the CS018 P4 frozen turn rates. `DIFFICULTY-LEVERS.md` gains a note that the
mechanic exists and is deliberately unlevered; the table does not grow.

**Watch at the gate:** `largeHunterCap()` plateaus at 6. Six aged larges in a saucer's path is a
realistic late-wave state and yields eighteen mediums. If that is too much, the first knob to
reach for is `hunterVolatileAge` upward, not the cap.

---

## §5 Powerup rebalance

### §5.1 The loop being broken

A 24-piece delivery fires `superMegaDelivery()`, which guarantees one of **every** droppable type —
including `guard` — plus a swept-Hunter payout capped at `SWEEP_POWERUP_CAP = 48`, plus the four
8/12/16/20 reward-tier drops. Chain armour makes the next 24-chain easier, which fires another
Super Mega Delivery, which guarantees another chain armour.

Two independent fixes: **`guard` gets rarer and conditional** (§5.2–5.4), and **the flood gets
smaller** (§5.5). They are separate levers on separate complaints.

### §5.2 The weights table goes ×10

`POWERUP_DROP_WEIGHTS` is currently `{ rapid: 3, triple: 3, scoop: 2, magnet: 1, engine: 1,
guard: 1 }` — integers with no room between them. `guard` sits at 1-in-11 (~9.1%) and the next
value down is zero.

Multiply every entry by 10: `{ rapid: 30, triple: 30, scoop: 20, magnet: 10, engine: 10,
guard: 20 }`. **Every non-guard ratio is byte-identical.** `guard`'s entry becomes a placeholder
overwritten at roll time (§5.3) and is set to 20 only so a reader of the table sees a plausible
number rather than a lie.

⛔ **`POWERUP_DROP_TYPES` is a different structure and does not move.** It is the *budgeted-effect*
list, it is append-only, and its order fixes HUD row indices. This has been conflated twice.
`POWERUP_DROP_WEIGHTS` is the *drop table*. `"guard"` is in both, which does not merge them.

### §5.3 `guard` weight becomes dynamic (FORK-S, FORK-T)

```
function guardDropWeight() {
  return Math.min(DEBUG.chainGuardDropMax,
    DEBUG.chainGuardDropBase + DEBUG.chainGuardDropPity * game.stats.cargoDamageEvents);
}
```

| id | label | def | min | max | step |
|---|---|---|---|---|---|
| `chainGuardDropBase` | `Chain guard drop base` | `4` | `0` | `60` | `1` |
| `chainGuardDropPity` | `Chain guard drop pity` | `8` | `0` | `40` | `1` |
| `chainGuardDropMax` | `Chain guard drop cap` | `40` | `0` | `120` | `1` |

At a table total of 100 non-guard: base 4 → **~3.8%** (down from 9.1%). Each cargo-damage event
adds 8 → 11% at one event, 17% at two, capped at 40 → **~29%** at four-plus. A player who never
loses cargo almost never sees chain armour; a player being torn apart gets it quickly.

**What counts as a cargo-damage event (FORK-S → unguarded severs only):** `game.stats.cargoDamageEvents++`
fires in `breakChain()` **on the sever path only** — after the `powerActive("guard")` early return.

- A **guarded** absorb does not count. The player did not lose cargo; the powerup did its job.
- `scatterChain()` does not count. Ship death is its own terminal event and already scatters the
  whole load; letting it feed the pity counter would hand a fresh run a stacked table.

**Reset (FORK-T → on drop):** `game.stats.cargoDamageEvents = 0` when a `guard` powerup actually
**drops** — in `dropPowerup()`, at the point `type === "guard"` is selected, before the `Powerup`
is pushed. Not on pickup: an uncollected guard still consumed the pity, and tying the reset to
collection would let a player farm the counter by ignoring drops.

Reset to `0` in `startGame()`. ⛔ Not in `nextWave()` — pity carries across waves within a run,
same as `cargoMax` growth does.

**The roll** — `dropPowerup()` gains one indirection:

```
const weightOf = k => k === "guard" ? guardDropWeight() : POWERUP_DROP_WEIGHTS[k];
```

used in **both** the running total and the walk.

⛔ **The `eligible()` gate stays.** `"guard"` still enters the roll only while
`game.chain.length >= DEBUG.chainGuardMinTow`. An ineligible key must be skipped in **both** the
total and the walk or a dead slot silently drops nothing — a standing invariant, and now the
weight is dynamic on top of it, so the two conditions compose rather than replace.

### §5.4 `guard` leaves the Super Mega Delivery guaranteed set (FORK-U → remove, FORK-U2 → leave)

```
const setTypes = Object.keys(POWERUP_DROP_WEIGHTS).filter(k => k !== "guard");
```

`setTypes.length` drops 6 → 5, and the budget reservation
`SWEEP_POWERUP_CAP - setTypes.length - snap.filter(h => h.size === 3).length` follows
automatically. **No manual arithmetic adjustment.**

⛔ **The per-piece sweep pool must re-add `guard` explicitly.** It is currently
`setTypes.concat("health")` — 7 types. With `guard` filtered out of `setTypes`, the pool must
become `setTypes.concat("guard", "health")` to stay at 7. **Failing to do this removes `guard`
from the sweep entirely**, which is not what FORK-U2 resolved: the flat per-piece roll is a
random chance, not a guarantee, and is the only thing keeping chain armour reachable during a
sweep at all.

⛔ The pool roll stays **flat and ungated** — no `guardDropWeight()`, no `chainGuardMinTow`. The
chain is empty at this instant (the 24th pop just cleared it), which is the documented reason the
gate is bypassed here. Weighting this roll would be a second, undiscussed change.

### §5.5 Super Mega Delivery volume (FORK-V → in scope)

Two constants become knobs, POWERUPS section:

| id | label | def | min | max | step | unit | was |
|---|---|---|---|---|---|---|---|
| `sweepPowerupCap` | `Sweep powerup cap` | `24` | `0` | `64` | `1` | — | `SWEEP_POWERUP_CAP = 48` |
| `dockPowerupSpeed` | `Dock powerup speed` | `180` | `40` | `400` | `10` | `px/s` | `DOCK_POWERUP_SPEED = 120` |

Both constants stay in the file as the registry rows' `def` source and are read as `DEBUG.*` at
the call sites — the `chainGuardIntercepts` idiom every knob in this build follows.

`dockPowerupSpeed` has **two** call sites: the guaranteed set in `superMegaDelivery()` and the
8/12/16/20 reward-tier drops in the offload block. Both move together; that is intended — the
complaint is powerups landing on top of a parked ship, and both emitters launch from the dock.

⛔ `POWERUP_DECAY` (26s) is **not** touched. Flinging them harder already gets them off the dock;
shortening their life as well would make the sweep punishing to collect at all.

⛔ The reservation arithmetic in `superMegaDelivery()` reads the knob, not the constant. At
`sweepPowerupCap` 24 with 5 guaranteed types and 6 larges reserved, the medium/small budget is 13.
**Verify that stays non-negative at `largeHunterCap()`'s plateau of 6** — 24 − 5 − 6 = 13, fine —
and note the knob's `min` of 0 makes it negative on purpose if Paul drags it down. `budget-- > 0`
already handles that correctly; do not add a clamp.

---

## §6 What CS035 explicitly does not do

- **No ship-relative delivery-ticker anchor.** CS026 P6 tried it, CS029 measured it worse
  ("a ship-relative origin smears the delivery column as the ship drifts DURING a visit"), and
  CS034 P9 declined it a third time. It stays a dock anchor. A real attempt needs its own gate.
- **No dock-ring render.** See FLAG-CS035-b.
- **No new lever.** `LEVERS` stays at 18.
- **No `destroyHunter()` split change.** ⛔ `ACH_LINEAGE_FULL = 13`.
- **No Hunter colour change** for volatility. Motion is the tell.
- **No new voice lines.** ⛔ Every phon string must be composed and zero-error-verified in
  `tools/voice-robot-lab.html` before `VOICE_LINES` is touched, and no phase here has a lab gate
  for it. If the gate wants a volatile-Hunter line it is a future changeset.
- **No music intensity work.** Still deferred from CS017.
- **No local-high-score or `kit-scores` work.** CS034 closed the local table; the shared-module
  question is untouched here.
- **No `towed`-tag revival in any form.** §2.4 deletes it; a future incidental-like mechanic
  would be a new design, not a restoration.

---

## §7 Open flags carried into the gate

- **FLAG-CS035-a** — the 24-haul loses `"MAX HAUL"`; does the ticker + cargo flash + `dock_24`
  voice + powerup eruption still land as a celebration? (§1.3)
- **FLAG-CS035-b** — the dock ring boundary now has teeth and no visual tell. (§2.6)
- **FLAG-CS035-c** — with incidentals deleted, a player who drifts into the ring while gathering
  simply stops collecting, silently, mid-approach. The push is the only feedback. Is it enough?
- **FLAG-CS035-d** — six aged larges plus one saucer pass yields eighteen mediums. (§4.5)
- **FLAG-CS035-e** — `sweepPowerupCap` 24 and `dockPowerupSpeed` 180 are proposed, not measured.
  Gate answers are **numbers**, not yes/no.

---

## §8 Registry and version

| | Before | After |
|---|---|---|
| `DEBUG_ENTRIES` | 91 | **106** |
| Section headers | 10 | 10 |
| `LEVERS` | 18 | 18 |
| `POWERUP_DROP_TYPES` | 5 | 5 |
| `GAME_VERSION` | `1.0.0.34` | **`1.0.0.35`** |

Fifteen new entries: `dockBounceSpeed` (DELIVERY, +1); `levelEndHold` / `levelEndGrace` /
`levelEndFade` / `levelEndGracePulseEnd` (CELEBRATION, +4); `hunterVolatileAge` /
`hunterPulseMin` / `hunterPulseMax` / `hunterPulseGrow` / `hunterPulseShrink` (HUNTER, +5);
`chainGuardDropBase` / `chainGuardDropPity` / `chainGuardDropMax` (CHAIN GUARD, +3);
`sweepPowerupCap` / `dockPowerupSpeed` (POWERUPS, +2). None retired.

⛔ **The count lives in exactly one file: `scratchpad/test-registry.js`'s `COUNTS`.** A phase that
adds a knob asserts *that knob exists with those bounds* and updates `COUNTS.registryEntries` —
it never asserts a total anywhere else.

⛔ **Every label is under the hard 32-character column.** Longest here is
`Level-end grace pulse end` at 25. `drawDebug` neither wraps nor truncates.