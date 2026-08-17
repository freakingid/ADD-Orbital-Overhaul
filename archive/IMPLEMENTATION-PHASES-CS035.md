# IMPLEMENTATION-PHASES-CS035 — Orbital Overhaul

Execution order and paste-ready per-phase prompts. **Spec is `PLANNED-FEATURES-CS035.md`** —
read it, don't re-derive from here.

**One phase per Claude Code session. One commit per phase. Claude Code never pushes.**

Baseline: `42cecae`, `GAME_VERSION = "1.0.0.34"`, registry **91** / **10** headers,
`LEVERS` **18**, suite **137/137 on a full clone**. Thirteen suite files hard-fail on a shallow
clone — work from a **full clone**, never `--depth 1`.

---

## Phase order

| Phase | What | Model | Registry | Blocks on |
|---|---|---|---|---|
| **P1** | Delivery ticker re-tune + milestone floater suppression | sonnet | +0 | — |
| **P2** | Dock scoop lockout, push, magnet suppression, incidental deletion | **opus** | +1 | — |
| **P3** | Level-end invincibility — state machine, gates, pulse | **opus** | +4 | — |
| **P4** | Hunter volatility — age + heartbeat render | sonnet | +5 | — |
| **P5** | Hunter volatility — three damage sources | sonnet | +0 | P4 |
| **P6** | Powerup rebalance — guard pity, SMD set, volume knobs | sonnet | +5 | — |
| **GATE** | Blocking playtest | — | — | P1–P6 |
| **P7** | Closing: version bump, doc sweep, log, archive | sonnet | — | GATE |

**Why this order.** P1 is small, self-contained, and immediately visible — a good first session.
P2 and P3 both cut into `update()` and both delete or extend load-bearing guards; they get Opus
and they get their own sessions. P4 must land before P5 (the damage sources read `this.age` and
the volatility predicate). P6 is independent of everything else. The gate is the one blocking
point and it is a **numbers** gate, not a yes/no one.

---

# P1 — Delivery ticker re-tune

```
claude --model sonnet
```

```
You are implementing ONE phase of changeset CS035 for Orbital Overhaul. Read CLAUDE.md, then
STATUS.md, then PLANNED-FEATURES-CS035.md §1. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

## Goal

Apply Paul's second dock-float-lab session's numbers as the shipped defaults, and delete the two
floaters that were overlapping the ticker.

## Part 1 — the seven values

grep DELIVERY_FLOAT_ANCHOR_FRAC. Change its value from 0.75 to 0.50. Leave the comment block above
it intact and append one line noting CS035 re-tuned it.

grep deliveryFloatRise to find the DELIVERY registry rows. Change ONLY the `def` on five rows:

  deliveryFloatRise      200  -> 150
  deliveryFloatSize       18  -> 16
  deliveryFloatSizeStep  0.0  -> 1.0
  deliveryFloatSizeMax    36  -> 48
  deliveryFloatHold     0.25  -> 0.00
  deliveryFloatFade     0.75  -> 1.20

min / max / step do not move on any row. No rows added, none retired.

DOCK_OFFLOAD_INTERVAL is already 0.05 and is correct. Do not touch it.

Note in the comment above the rows that CS035 replaces CS034 P8's GATE A values with a later lab
session's, and that sizeStep moving off 0.0 turns on per-piece growth for the first time — CS034
shipped the mechanism with its step at zero.

## Part 2 — delete the two milestone floaters

In the dock offload block:

  1. The `new FloatText("SALVAGE BONUS", ...)` push inside the 8/12/16/20 reward-tier branch.
     DELETE the FloatText push and the `if (game.deliveryCount === 8)` wrapper around it.
     KEEP the dropPowerup() call and the branch it lives in.

  2. The `new FloatText("MAX HAUL", ...)` push in the `deliveryCount === CARGO_CAP_MAX` block.
     DELETE the FloatText push only.
     KEEP game.stats.maxChainVisit = true.
     KEEP game.cargoFlash = HUD_CAP_FLASH.

Do not touch the separate `if (game.deliveryCount === CARGO_CAP_MAX) superMegaDelivery();` block.

Leave a short tombstone comment at each site: CS035 §1.3 removed them because the lab measured
-15.7px ink overlap against the delivery ticker at the new sizes, and the ticker plus the HUD
cargo flash plus the dock_24 voice line now carry the moment.

## Test

New file scratchpad/test-cs035-p1.js using scratchpad/_harness.js.

Assert, by driving the real code:
  - DELIVERY_FLOAT_ANCHOR_FRAC === 0.50
  - each of the five knobs has the new def AND its unchanged min/max/step
  - a driven dock visit that reaches deliveryCount 8 pushes NO floater whose text contains
    "SALVAGE" — and still drops a powerup on that pop
  - a driven visit that reaches CARGO_CAP_MAX pushes NO floater whose text contains "MAX HAUL",
    and still sets game.stats.maxChainVisit and game.cargoFlash
  - the ticker's size after N pops equals min(48, 16 + 1.0 * (N - 1))

Do NOT assert the registry total — that lives only in test-registry.js, and this phase adds no
rows.

Run `node scratchpad/run-all.js` before committing. Non-zero exit = not done.

## Commit

One commit, subject: `cs-35 p1: delivery ticker re-tune, milestone floaters removed`
Update STATUS.md (one ledger line, ~200 words max in the body). Do not push.
```

---

# P2 — Dock scoop lockout

```
claude --model opus
```

```
ultrathink

You are implementing ONE phase of changeset CS035 for Orbital Overhaul. Read CLAUDE.md, then
STATUS.md, then PLANNED-FEATURES-CS035.md §0.2 and §2. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

## Goal

The ship cannot hook Debris while inside the dock neighbourhood ring. Debris that reaches the ship
or the scoop mouth is pushed away. This deletes the "incidental" category entirely.

READ §0.2 BEFORE YOU START. The mechanism being fixed is NOT a counter reset — incidentals already
do not reset deliveryCount. It is a LIFO queue jump: an incidental is pushed to the chain tail, the
offload pops from the tail, so it is delivered next and lands in a branch that awards nothing. Fix
the cause, not the symptom you might guess at.

## Part 1 — the lockout

grep for `inRing` in the pickup gate. It is already computed there as
`dist2(game.ship, game.dock) < pad * pad` with `pad = game.dock.radius + DOCK_NEIGHBORHOOD_PAD`.

Add `!inRing &&` to the front of the capture gate condition. Unconditional — it applies at every
chain length including zero.

⛔ inRing itself is NOT deleted. It still guards the pickup gate and still guards the
`game.deliveryCount = 0` reset for a haul started outside the ring. Only its `towed` consumer goes.

## Part 2 — the push

New registry row, DELIVERY section:
  { id: "dockBounceSpeed", label: "Dock bounce speed", unit: "px/s",
    def: 90, min: 20, max: 300, step: 10 }

In the garbage loop, when the lockout is in force and a piece is inside the capture region that
WOULD have hooked it (base circle OR inScoopBox), push it away instead:

  - direction: wrap-aware unit vector ship -> piece, via shortDelta (the same idiom the magnet pull
    uses one block above)
  - velocity is SET, not added: g.vx = ux * DEBUG.dockBounceSpeed, likewise vy. Setting is what
    stops a piece pinned between ship and dock accumulating speed frame over frame.
  - AudioSys.shieldPing() as the tell. NO new audio method.
  - the ship is completely unaffected: no recoil, no velocity change, no damage, no hit-stun.

⛔ DO NOT call debrisBounce(). It is a mass-aware two-body elastic solver written for satellites
and its own dispatch comment warns against handing it bodies outside its contract. A canister has
mass but no size, and the ship is not in its contract at all.

## Part 3 — magnet suppression inside the ring

grep `const pulling = magnetPulling();`. Suppress it inside the ring:

  const pulling = magnetPulling() && !<ship is in the ring>;

Hoist the ring test above the loop next to `magnet` and `pulling` — do not recompute per piece.

⛔ The TWO BUDGET SPEND SITES read `magnet`, not `pulling`, and MUST STAY THAT WAY. CS025 P1's
comment on that two-name split is explicit that repointing a spend site at `pulling` hands out free
hooks. Read that comment before you touch this block.

⛔ pickR reads `pulling`, so the widened magnet circle correctly collapses to GARBAGE_PICKUP inside
the ring. That is intended — CS025's "the circle comes back WITH the pull" rule.

magnetPushBurst(), game.magnetHoldT and the game.cargoWasFull edge boolean are UNTOUCHED.

## Part 4 — delete the incidental branch

No node can now be created with towed: false. Delete:

  - the `else` branch in the offload block (its DOCK_BASE_SCORE addScore, its FloatText, and its
    AudioSys.deliver(1))
  - `const towed = node.towed !== false;` and the `if (towed)` wrapper — the towed body becomes the
    whole pop handler
  - the `towed: !inRing` field on BOTH chain-push sites (the pieces===1 single and the clump)

Leave a tombstone comment explaining that CS035 §2 made the incidental category empty by
construction, and that the `!== false` absence-defaults-to-towed idiom went with it.

⛔ SUITE TRAP: grep scratchpad/ for `towed` BEFORE you edit the build. Any suite file that seeds
`towed: false` to exercise the incidental branch, or asserts on the field, is now asserting deleted
behaviour. Fix those in this same commit.

## Test

New file scratchpad/test-cs035-p2.js using scratchpad/_harness.js.

Drive the real code. Assert:
  - a piece placed inside the base pickup circle while the ship is inside the ring is NOT hooked
    after update(1/60) — chain.length unchanged
  - the same piece's velocity magnitude is DEBUG.dockBounceSpeed after that frame, directed away
    from the ship
  - the same piece placed with the ship OUTSIDE the ring IS hooked (the gate still works normally)
  - the lockout holds at chain.length === 0
  - with a magnet active and the ship inside the ring, a piece in MAGNET_RANGE is not accelerated
    toward the ship
  - a 24-piece towed haul delivered with loose pieces sitting inside the ring reaches
    deliveryCount === CARGO_CAP_MAX with no gap — this is the actual bug, assert it directly
  - dockBounceSpeed exists with def 90, min 20, max 300, step 10

Update COUNTS.registryEntries in scratchpad/test-registry.js: 91 -> 92.
Assert the total NOWHERE else.

Run `node scratchpad/run-all.js` before committing.

## Commit

One commit, subject: `cs-35 p2: dock scoop lockout, incidental branch deleted`
Update STATUS.md. Do not push.
```

---

# P3 — Level-end invincibility

```
claude --model opus
```

```
ultrathink

You are implementing ONE phase of changeset CS035 for Orbital Overhaul. Read CLAUDE.md (especially
"Achievement celebration panel"), then STATUS.md, then PLANNED-FEATURES-CS035.md §3. Build only
what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

## Goal

A protected window around the level-end seam. Today the player goes from live action straight into
a frozen achievement panel and, on dismissal, straight back into live action — with Hunters still
on screen, because the wave-clear condition reads game.debris only and Hunters carry over.

Sequence: wave clears -> ship invincible immediately -> 5s hold (full player control) -> panel if
any -> "Level N" banner -> 3s grace -> vulnerable.

## Part 1 — four registry rows, CELEBRATION section

  { id: "levelEndHold",          label: "Level-end hold",            unit: "s",
    def: 5.00, min: 0,    max: 15,   step: 0.25 },
  { id: "levelEndGrace",         label: "Level-end grace",           unit: "s",
    def: 3.00, min: 0,    max: 10,   step: 0.25 },
  { id: "levelEndFade",          label: "Level-end fade time",       unit: "s",
    def: 0.25, min: 0.05, max: 1.50, step: 0.05 },
  { id: "levelEndGracePulseEnd", label: "Level-end grace pulse end", unit: "s",
    def: 0.08, min: 0.02, max: 0.50, step: 0.02 }

Both time knobs are ONE-WAY transition times ("how long does 100% -> 20% take"). The full pulse
period is 2x. Say so in the comment — a mixed-units pair would eventually be misread.

## Part 2 — three fields on game, reset in startGame() ONLY

  levelEndSafe:   false
  levelEndGraceT: 0
  levelEndPulseT: 0

⛔ THE NAME IS levelEndSafe, NOT invuln. ship.invuln is hit-stun i-frames and drives a 10Hz hard
square blink in Ship.draw(). Folding these together would inherit the wrong visual and make a
level-end window indistinguishable from "I just got hit". They are separate; gates read both.

⛔ nextWave() MUST NOT RESET ANY OF THE THREE. nextWave() runs INSIDE the window. Its reset block
carries a comment listing what it zeroes and why (sweepPause/deliveryCount are in-flight state
meaningless at a wave start). These three are the opposite — in-flight state that must SURVIVE the
wave boundary. Add a line to that comment saying so explicitly, so a future cleanup pass doesn't
"tidy" them in.

## Part 3 — arm

In the wave-clear branch, BEFORE `game.waveClearTimer += dt`:

  if (game.waveClearTimer === 0) { game.levelEndSafe = true; game.levelEndPulseT = 0; }

The zero-check is the "passes through exactly once" latch idiom the dock block already uses in four
places. waveClearTimer is zeroed by the else branch when Debris exists, so this re-arms each clear.

Then change the threshold literal:

  if (game.waveClearTimer > 2.5)   ->   if (game.waveClearTimer > DEBUG.levelEndHold)

REPLACE, not add. 5.0s total, not 7.5s.

⛔ Do not touch the celebration branch's `return`. That return IS the deferral of nextWave().
⛔ Do not touch the `game.state === "playing"` clause. It is not redundant — killShip() flips state
mid-frame.

## Part 4 — arm the grace at banner expiry

grep `game.levelBanner.life -= dt;`. Make it a one-shot on the crossing:

  const wasLive = game.levelBanner.life > 0;
  game.levelBanner.life -= dt;
  if (wasLive && game.levelBanner.life <= 0 && game.levelEndSafe) {
    game.levelEndGraceT = DEBUG.levelEndGrace;
  }

⛔ The `game.levelEndSafe` clause is load-bearing. startGame() calls nextWave() for wave 1, which
seeds a banner with no level-end window behind it. Without the clause every new run would open with
3 free seconds of invincibility.

## Part 5 — disarm

Where the per-frame timers tick:

  if (game.levelEndGraceT > 0) {
    game.levelEndGraceT = Math.max(0, game.levelEndGraceT - dt);
    if (game.levelEndGraceT === 0) game.levelEndSafe = false;
  }

## Part 6 — the pulse

⛔ PHASE ACCUMULATES IN HALF-CYCLES, NOT SECONDS. levelEndGracePulseEnd changes the period
mid-window; a seconds-based phase would jump discontinuously the moment the period moved.

While levelEndSafe:

  const oneWay = game.levelEndGraceT > 0
    ? <lerp from DEBUG.levelEndFade to DEBUG.levelEndGracePulseEnd as graceT runs down>
    : DEBUG.levelEndFade;
  game.levelEndPulseT += dt / Math.max(0.0001, oneWay);

In Ship.draw():

  const p = game.levelEndPulseT % 2;
  const tri = p < 1 ? p : 2 - p;   // 0 -> 1 -> 0
  const a = 1 - 0.8 * tri;         // 1.0 -> 0.2 -> 1.0

Apply as ctx.globalAlpha around the scoop-V + hull + thrust flame.

⛔ RESTORE ctx.globalAlpha TO 1 BEFORE THE SHIELD BLOCK. That block sets its own alpha and assumes
it enters at 1. Three existing draw sites in the file follow set-draw-restore; follow it exactly.

⛔ While levelEndSafe, SKIP the hit-stun `blink` entirely. A hit taken just before the clear would
otherwise strobe at 10Hz on top of the 2Hz pulse.

The 0.2 floor and 1.0 ceiling are NOT knobs. Do not add them.

⛔ DO NOT re-add a magnet-pull recolour to the scoop stroke. There is an explicit do-not-re-add
comment in Ship.draw() from CS025 P5. You are adding an alpha wrapper, nothing else.

## Part 7 — five damage gates

Sites 1-3 already read `!game.ship.dead && game.ship.invuln <= 0`. Add `&& !game.levelEndSafe`:
  1. hostile bullet vs player
  2. hazards vs ship
  3. the Hunter knockback / i-frame block

Sites 4-5 gain a NEW `!game.levelEndSafe` guard on the whole block:
  4. hostile bullet vs tow chain
  5. hazards vs tow chain (the `chainScan:` labelled block)

⛔ Sites 4 and 5 are GUARDED, NOT ABSORBED. They must not reach breakChain() at all during the
window. Routing there would spend chain-guard charges and speak the chain_guard voice line — both
wrong for protection the player did not earn.

⛔ shieldDeflect / shieldBounce and the shield energy cost are untouched. A player holding shield
sees no change; the outer gate simply never reaches them.
⛔ game.stats.dmgThisWave and the Perfect Wave latch are untouched.

## Test

New file scratchpad/test-cs035-p3.js using scratchpad/_harness.js. Drive the real code.

  - clearing a wave sets game.levelEndSafe true on the SAME frame debris hits zero
  - a hostile bullet on the ship during the window does no damage; ship.hp unchanged
  - a Hunter overlapping a chain node during the window does not sever it and does not spend a
    chain-guard charge
  - the celebration branch still fires and still defers nextWave()
  - after the banner expires, levelEndGraceT === DEBUG.levelEndGrace
  - levelEndSafe goes false exactly when levelEndGraceT reaches 0
  - a FRESH startGame() does NOT leave levelEndSafe true (the wave-1 banner trap)
  - nextWave() called mid-window leaves all three fields untouched
  - the four knobs exist with their bounds

Update COUNTS.registryEntries in scratchpad/test-registry.js: 92 -> 96.

Run `node scratchpad/run-all.js` before committing.

## Commit

One commit, subject: `cs-35 p3: level-end invincibility window`
Update STATUS.md. Do not push.
```

---

# P4 — Hunter volatility: age and heartbeat

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS035 for Orbital Overhaul. Read CLAUDE.md, then
STATUS.md, then PLANNED-FEATURES-CS035.md §4.1-§4.3. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

## Goal

A large Hunter core that has been alive for DEBUG.hunterVolatileAge seconds starts a visible size
heartbeat. THIS PHASE IS THE CLOCK AND THE TELL ONLY. The damage sources are P5 — do not build
ahead.

## Part 1 — five registry rows, HUNTER section

  { id: "hunterVolatileAge",  label: "Hunter volatile age",       unit: "s",
    def: 30, min: 0,  max: 120, step: 1 },
  { id: "hunterPulseMin",     label: "Hunter pulse min",          unit: "%",
    def: 92, min: 50, max: 100, step: 1 },
  { id: "hunterPulseMax",     label: "Hunter pulse max",          unit: "%",
    def: 115, min: 100, max: 200, step: 1 },
  { id: "hunterPulseGrow",    label: "Hunter pulse grow rate",    unit: "%/s",
    def: 55, min: 5,  max: 300, step: 5 },
  { id: "hunterPulseShrink",  label: "Hunter pulse shrink rate",  unit: "%/s",
    def: 28, min: 5,  max: 300, step: 1 }

Asymmetric on purpose: fast growth, slow shrink. Symmetric reads as breathing; asymmetric reads as
pumping. Say so in the comment.

## Part 2 — age

In the HunterSatellite constructor: `this.age = 0;`
At the TOP of update(dt): `this.age += dt;` — unconditional, every tier.

Construction is the origin because larges arise from exactly one source (garbage coalescing to
HUNTER_COALESCE_COUNT, constructed in place at the clump's position). static spawnCore() was
deleted in CS024 P3; there is no separate spawn event to hang a clock on.

Add a small predicate next to the class or as a method:

  volatile == this.size === 3 && this.age >= DEBUG.hunterVolatileAge

Medium and small age too — one float each — and ignore it.

## Part 3 — the heartbeat

Constructor: `this.pulseScale = 100;` and `this.pulseUp = true;`

In update(), ONLY while volatile: advance pulseScale by DEBUG.hunterPulseGrow * dt while pulseUp,
or shrink by DEBUG.hunterPulseShrink * dt while not. Clamp at DEBUG.hunterPulseMax /
DEBUG.hunterPulseMin and flip pulseUp on the clamp.

In draw(): scale the vertex arrays by pulseScale / 100 for this frame's drawPoly calls.

⛔ DRAW-ONLY. this.radius, this.shape and this.inner are NOT rebuilt. The collision radius every
pass reads is unchanged. A pulsing hitbox would make ship contact damage depend on animation phase.

⛔ this.shape and this.inner are BAKED AT CONSTRUCTION and read by draw(). Scale at the draw call
into a fresh array. Do NOT mutate the stored arrays — mutating them compounds every frame and the
Hunter would grow without bound.

Colour is unchanged (COLOR.satellite). The motion is the tell. No new colour, no glow change.

## Part 4 — DIFFICULTY-LEVERS.md

Add a short note that Hunter volatility exists and is DELIBERATELY NOT A LEVER — a flat rule at
every wave, same spirit as the CS018 P4 frozen turn rates. The LEVERS table does not grow. Stays 18.

## Test

New file scratchpad/test-cs035-p4.js using scratchpad/_harness.js. Drive the real code.

  - a fresh large Hunter has age 0 and pulseScale 100
  - after DEBUG.hunterVolatileAge seconds of driven update(1/60), the large's pulseScale has moved
    off 100
  - a medium and a small, aged past the threshold, have pulseScale STILL 100
  - pulseScale never exceeds hunterPulseMax and never falls below hunterPulseMin across a long run
  - this.radius is unchanged before and after the pulse starts
  - this.shape array contents are IDENTICAL before and after many frames of pulsing (the
    don't-mutate invariant — this is the one that will actually catch a bug)
  - the five knobs exist with their bounds

Update COUNTS.registryEntries in scratchpad/test-registry.js: 96 -> 101.

Run `node scratchpad/run-all.js` before committing.

## Commit

One commit, subject: `cs-35 p4: Hunter volatility clock and heartbeat`
Update STATUS.md. Do not push.
```

---

# P5 — Hunter volatility: damage sources

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS035 for Orbital Overhaul. Read CLAUDE.md (especially
"Difficulty levers" and "New enemies"), then STATUS.md, then PLANNED-FEATURES-CS035.md §0.3, §0.4
and §4.4. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

Depends on P4 (this.age and the volatile predicate must already exist).

## Goal

A VOLATILE large Hunter is destructible by three sources it previously ignored. Non-volatile
larges, mediums and smalls are unaffected by all three.

READ §0.3 AND §0.4 FIRST. Two of these three are NEW WIRING, not threshold tweaks:
  - hostile bullets currently do not iterate game.hunters at all
  - the satellite-vs-satellite bounce pass walks game.debris only; Hunter-vs-Hunter collision does
    not exist in any form

## Part 1 — Hunter vs Hunter

New pair walk over game.hunters, placed in the same position in the collision order as the existing
satellite-vs-satellite pass (find it by grepping debrisBounce and read its placement comment —
it runs before the end-of-frame dead-filter and checks `dead` explicitly on both sides).

BOTH bodies must be volatile larges for either to die. Both then die, via destroyHunter(h, false).
A volatile large touching a medium or small does NOTHING to either — no bounce, no damage. Do not
add an elastic bounce here; that is not in scope.

## Part 2 — hostile bullet vs volatile large

The hostile branch of the bullet collision pass currently tests the ship and the tow chain. Add a
game.hunters loop testing volatile larges only. The bullet dies on contact, as it does against the
ship. destroyHunter(h, false).

⛔ P3 added a !game.levelEndSafe guard to the hostile-bullet-vs-chain block. Your new hunter loop
is a SIBLING of that block and must NOT inherit that guard — a UFO shot should still pop a volatile
Hunter during a level-end window. Read the surrounding structure before you place it.

## Part 3 — saucer body vs volatile large

The existing UFO-vs-debris pass gains a Hunter arm. Both die: the saucer via
destroySaucer(s, false), the Hunter via destroyHunter(h, false). Same "no score for either" shape
the saucer-vs-satellite case already has.

## The invariants

⛔ ALL THREE call destroyHunter(h, false). The awardScore=false argument is the shipped gate for
score AND achievement counters — the same argument the ring-detonation site passes. A Hunter that
dies to a UFO is not the player's kill.

⛔ PLAYER BULLETS ARE UNCHANGED. They kill any Hunter at any tier at any age with full score and
achievement credit. Do not touch the player-bullet arm.

⛔ THE SPLIT STAYS 3-WAY IN ALL CASES. destroyHunter() is not levered and ACH_LINEAGE_FULL = 13
depends on it. A volatile large killed by a UFO yields three mediums exactly as a player-shot one
does. This is the POINT of the feature — the player no longer controls whether a large splits.

⛔ HUNTER_GARBAGE[3] === 0 as of CS034 P3. A large sheds no Debris on death. Unchanged.

No new registry rows this phase.

## Test

New file scratchpad/test-cs035-p5.js using scratchpad/_harness.js. Drive the real code.

  - two volatile larges placed overlapping both die after one update(1/60), each yielding 3 mediums
  - two NON-volatile larges placed overlapping both survive
  - a volatile large overlapping a medium: neither dies
  - a hostile bullet on a volatile large kills it and the bullet; on a non-volatile large, neither
  - a hostile bullet on a volatile large still works while game.levelEndSafe is true
  - a saucer flown into a volatile large kills both
  - a PLAYER bullet on a non-volatile large still kills it with score credited (the unchanged path —
    assert it, this is the regression that matters)
  - a volatile large killed by any of the three sources credits NO score and NO achievement counter

Run `node scratchpad/run-all.js` before committing.

## Commit

One commit, subject: `cs-35 p5: Hunter volatility damage sources`
Update STATUS.md. Do not push.
```

---

# P6 — Powerup rebalance

```
claude --model sonnet
```

```
ultrathink

You are implementing ONE phase of changeset CS035 for Orbital Overhaul. Read CLAUDE.md (especially
"Two traps that have each burned twice"), then STATUS.md, then PLANNED-FEATURES-CS035.md §5. Build
only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

## Goal

Break the powerup feedback loop. Chain armour becomes rare and pity-driven; the Super Mega Delivery
flood gets smaller and flings further.

⛔ READ THE TRAP FIRST. POWERUP_DROP_TYPES is the BUDGETED-EFFECT list — append-only, its order
fixes HUD row indices, and it does NOT MOVE in this phase. POWERUP_DROP_WEIGHTS is the DROP TABLE.
These two have been conflated twice already. Do not do it a third time.

## Part 1 — weights x10

POWERUP_DROP_WEIGHTS { rapid: 3, triple: 3, scoop: 2, magnet: 1, engine: 1, guard: 1 }
                  -> { rapid: 30, triple: 30, scoop: 20, magnet: 10, engine: 10, guard: 20 }

Every NON-GUARD ratio is byte-identical. guard's entry becomes a placeholder overwritten at roll
time by Part 2 and is set to 20 only so a reader sees a plausible number rather than a lie. Say
that in the comment.

## Part 2 — three registry rows, CHAIN GUARD section

  { id: "chainGuardDropBase", label: "Chain guard drop base", unit: "",
    def: 4,  min: 0, max: 60,  step: 1 },
  { id: "chainGuardDropPity", label: "Chain guard drop pity", unit: "",
    def: 8,  min: 0, max: 40,  step: 1 },
  { id: "chainGuardDropMax",  label: "Chain guard drop cap",  unit: "",
    def: 40, min: 0, max: 120, step: 1 }

  function guardDropWeight() {
    return Math.min(DEBUG.chainGuardDropMax,
      DEBUG.chainGuardDropBase + DEBUG.chainGuardDropPity * game.stats.cargoDamageEvents);
  }

At a 100 non-guard total: base 4 -> ~3.8% (was 9.1%), +8 per cargo-damage event, capped ~29%.

New stat field game.stats.cargoDamageEvents, reset to 0 in startGame(). ⛔ NOT in nextWave() —
pity carries across waves within a run, same as cargoMax growth does.

Increment in breakChain(), on the SEVER PATH ONLY — after the powerActive("guard") early return.
A guarded absorb does NOT count (the player did not lose cargo; the powerup did its job).
scatterChain() does NOT count (ship death is its own terminal event).

Reset to 0 in dropPowerup() at the point type === "guard" is selected, BEFORE the Powerup is
pushed. Not on pickup — an uncollected guard still consumed the pity.

## Part 3 — the roll

In dropPowerup(), one indirection:

  const weightOf = k => k === "guard" ? guardDropWeight() : POWERUP_DROP_WEIGHTS[k];

used in BOTH the running total AND the walk.

⛔ THE eligible() GATE STAYS. "guard" still enters the roll only while
game.chain.length >= DEBUG.chainGuardMinTow. An ineligible key must be skipped in BOTH the total
and the walk or a dead slot silently drops nothing. The weight is now dynamic ON TOP OF that gate —
the two conditions compose, they do not replace each other.

## Part 4 — superMegaDelivery()

  const setTypes = Object.keys(POWERUP_DROP_WEIGHTS).filter(k => k !== "guard");

setTypes.length drops 6 -> 5 and the reservation
`sweepPowerupCap - setTypes.length - snap.filter(h => h.size === 3).length` follows automatically.
NO manual arithmetic adjustment.

⛔ THE PER-PIECE POOL MUST RE-ADD guard EXPLICITLY. It is currently setTypes.concat("health") — 7
types. With guard filtered out of setTypes it must become setTypes.concat("guard", "health") to
stay at 7. FAILING TO DO THIS REMOVES guard FROM THE SWEEP ENTIRELY, which is not what was decided:
the flat per-piece roll is a random chance, not a guarantee, and is the only thing keeping chain
armour reachable during a sweep.

⛔ That pool roll stays FLAT AND UNGATED — no guardDropWeight(), no chainGuardMinTow. The chain is
empty at this instant (the 24th pop just cleared it), which is the documented reason the gate is
bypassed here.

## Part 5 — two volume knobs, POWERUPS section

  { id: "sweepPowerupCap",  label: "Sweep powerup cap",  unit: "",
    def: 24,  min: 0,  max: 64,  step: 1 },     // was const SWEEP_POWERUP_CAP = 48
  { id: "dockPowerupSpeed", label: "Dock powerup speed", unit: "px/s",
    def: 180, min: 40, max: 400, step: 10 }     // was const DOCK_POWERUP_SPEED = 120

Both constants STAY in the file as the rows' def source; call sites read DEBUG.* — the
chainGuardIntercepts idiom every knob in this build follows.

dockPowerupSpeed has TWO call sites: the guaranteed set in superMegaDelivery() and the 8/12/16/20
reward-tier drops in the offload block. Both move together — the complaint is powerups landing on
top of a parked ship and both emitters launch from the dock.

⛔ POWERUP_DECAY (26s) is NOT touched.
⛔ The reservation reads the knob, not the constant. sweepPowerupCap's min of 0 makes the budget go
negative on purpose if Paul drags it down; `budget-- > 0` already handles that. DO NOT ADD A CLAMP.

## Test

New file scratchpad/test-cs035-p6.js using scratchpad/_harness.js. Drive the real code.

  - every non-guard weight ratio is unchanged vs the pre-x10 table
  - guardDropWeight() returns base at 0 events, base + pity*n at n events, and clamps at the cap
  - an unguarded breakChain() sever increments cargoDamageEvents; a GUARDED absorb does not;
    scatterChain() does not
  - a guard drop resets cargoDamageEvents to 0
  - the eligible() gate still excludes guard below chainGuardMinTow, in BOTH total and walk (drive
    the roll many times with a seeded RNG and assert no guard appears)
  - superMegaDelivery()'s guaranteed set contains exactly 5 types and none is "guard"
  - the per-piece pool still contains 7 entries including "guard"
  - POWERUP_DROP_TYPES is UNCHANGED at length 5 (the append-only trap — assert it)
  - the five knobs exist with their bounds

Update COUNTS.registryEntries in scratchpad/test-registry.js: 101 -> 106.
COUNTS.powerupDropTypes stays 5.

Run `node scratchpad/run-all.js` before committing.

## Commit

One commit, subject: `cs-35 p6: powerup rebalance — guard pity, SMD volume`
Update STATUS.md. Do not push.
```

---

# GATE — blocking playtest

**Paul plays a full build with P1–P6 in. Nothing proceeds to P7 until these come back.**

Answers are **numbers**, not yes/no, wherever a slider is involved.

**Delivery readout (§1)**

- G1 — Does the ticker now read as a climbing chain? `yes` / `no`
- G2 — `deliveryFloatSizeStep` final: ___ (shipped 1.0)
- G3 — `deliveryFloatFade` final: ___ (shipped 1.20)
- G4 — **FLAG-CS035-a**: does a 24-haul still land as a celebration without `"MAX HAUL"`?
  `yes` / `no — restore at y-offset ___`

**Dock lockout (§2)**

- G5 — `dockBounceSpeed` final: ___ (shipped 90)
- G6 — Does the lockout read as a rule or as a bug? `rule` / `bug`
- G7 — **FLAG-CS035-b/c**: is the ring boundary felt, or just suffered? `felt` / `suffered`
  (if `suffered`, a dock-ring render is the follow-up changeset)
- G8 — Did any chain of 24 still show a gap in the ticker? `yes` / `no`

**Level-end window (§3)**

- G9 — `levelEndHold` final: ___ (shipped 5.00)
- G10 — `levelEndGrace` final: ___ (shipped 3.00)
- G11 — `levelEndFade` final: ___ (shipped 0.25)
- G12 — `levelEndGracePulseEnd` final: ___ (shipped 0.08)
- G13 — Does the alpha pulse read instantly as "invincible", and is it clearly distinct from the
  hit-stun blink? `yes` / `no`
- G14 — Is the 0.2 alpha floor too faint to fly at? `ok` / `raise to ___`

**Hunter volatility (§4)**

- G15 — `hunterVolatileAge` final: ___ (shipped 30)
- G16 — `hunterPulseMin` / `Max` final: ___ / ___ (shipped 92 / 115)
- G17 — `hunterPulseGrow` / `Shrink` final: ___ / ___ (shipped 55 / 28)
- G18 — Does the heartbeat read as "about to go off" before you know the rule? `yes` / `no`
- G19 — **FLAG-CS035-d**: is a late-wave saucer pass through aged larges too much? `ok` /
  `raise hunterVolatileAge to ___`
- G20 — Is the game still too easy? `yes` / `no`

**Powerups (§5)**

- G21 — `chainGuardDropBase` / `Pity` / `Max` final: ___ / ___ / ___ (shipped 4 / 8 / 40)
- G22 — `sweepPowerupCap` final: ___ (shipped 24)
- G23 — `dockPowerupSpeed` final: ___ (shipped 180)
- G24 — Does chain armour now arrive when you need it rather than when you're already winning?
  `yes` / `no`

---

# P7 — Closing

```
claude --model sonnet
```

```
ultrathink

You are implementing the CLOSING PHASE of changeset CS035 for Orbital Overhaul. Read CLAUDE.md,
then STATUS.md, then PLANNED-FEATURES-CS035.md. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

## Part 1 — fold in the gate

<PASTE THE GATE ANSWERS HERE BEFORE RUNNING THIS PHASE>

Apply every returned number as the row's new `def` (or the constant's new value, for
DELIVERY_FLOAT_ANCHOR_FRAC). A gate answer that matches the shipped value is a no-op — say so in
the log rather than editing nothing silently.

If a gate answer asks for a change that is a DESIGN decision rather than a value (G4's restore,
G7's dock-ring render, G14 if it wants a new knob) — DO NOT BUILD IT. Record it in STATUS.md's
"Known issues" as deferred, with the gate answer that raised it.

## Part 2 — version bump

GAME_VERSION "1.0.0.34" -> "1.0.0.35".

⛔ A phase-local version pin flips to its standing mirror image (!== "1.0.0.NN", permanently true).
It is NOT re-pointed to a new literal. Live pins that genuinely track HEAD's version are a separate,
small, deliberate set and ARE re-pointed. Read CLAUDE.md's pins section and RATIONALE.md#pins
before touching any test that mentions a version string.

## Part 3 — doc sweep

  - ORBITAL-OVERHAUL-GDD.md — §2 is SHIPPED BEHAVIOUR ONLY. Add: the dock pickup lockout and push,
    the level-end invincibility window, Hunter volatility, the chain-guard pity weighting, the
    incidental delivery category's REMOVAL. §3 code map if any section moved.
  - DIFFICULTY-LEVERS.md — P4 already added the volatility note; verify it survived and that the
    table is still 18.
  - CLAUDE.md — the incidental/`towed` idiom is gone; if any invariant text references it, correct
    it. Do NOT invent new invariants.
  - Use CANONICAL VOCABULARY in all prose: Garbage Satellite, Debris, Hunter Satellite, Recycle
    dock. The code's inverted names (DebrisSatellite/game.debris = Garbage Satellite;
    Garbage/game.garbage = Debris) are deliberate and are NOT renamed.

## Part 4 — the log

Write log/CS035.md: the full P1-P7 build log, the gate answers and what they changed, and the GDD
version-history entry under `## GDD version history`. There is no central changelog.

Then RESET STATUS.md to the current changeset only, per CLAUDE.md's format block. Carry forward the
still-open known issues from CS034 that this changeset did not touch (the drawTitleMenu()
SaveSlots.count() flag, the returnToTitleMenu() cursor, test-f2's flake, test-registry's
FLAG-CS027-d, the piece-distinctness concern, the thirteen shallow-clone hard-failers, and the
never-playtested satellite-vs-satellite bounce). Drop the ones CS035 resolved — in particular the
milestone-floater overlap issue, which §1.3 closed.

⛔ Every STATUS entry starts on its own paragraph. If you append with a shell redirect, VERIFY the
written entry actually begins a new paragraph.

## Part 5 — archive

Move PLANNED-FEATURES-CS035.md and IMPLEMENTATION-PHASES-CS035.md to archive/.

## Part 6 — verify

  - node --check the extracted script
  - node scratchpad/run-all.js — full suite, on a FULL clone. Report files/passed/failed/skipped/
    timed-out as raw numbers. A closing phase asserts ZERO SKIPS.
  - confirm registry === 106, headers === 10, LEVERS === 18, POWERUP_DROP_TYPES === 5
  - grep the build for any remaining reference to `towed` or the incidental branch

## Commit

One commit, subject: `cs-35 p7: closing phase — version 1.0.0.35, gate fold-in, doc sweep`
Do not push.
```