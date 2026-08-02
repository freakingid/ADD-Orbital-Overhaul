# PLANNED FEATURES — CS020

**Changeset scope: the delivery combo.** Two defects in the same counter — the
second found by playtesting the fix for the first.

- **§1, fixed in P1 (shipped, playtested).** A ship parked inside the recycling
  dock's neighbourhood keeps its combo alive indefinitely, so garbage that
  wanders into it earns escalating score, advances every delivery-keyed
  achievement latch, and fires the Super Mega Delivery at levels where the
  player's payload could never have carried 24 pieces.
- **§2, fixed in P1b.** A ship that skirts the dock, delivers part of its load
  and swings back out loses the whole run — the counter restarts even though the
  same chain is still in tow, and a single skirt costs a level-12 player the SMD
  outright.

Nothing else is in scope.

Base build: CS019 P2, `GAME_VERSION "1.0.0.19"`, commit `09d443f`.
Target: `"1.0.0.20"`, bumped in **P2**.

**Phase map.** P1 → playtest gate (passed) → P1b → playtest gate → P2.

---

## 1. The parking exploit (P1)

### 1.1 What Paul observed

> "Once Dan's ship enters the recycle ring to drop off payload, as long as the
> ship is still in the recycle ring, any new garbage pieces that hit the ship
> automatically get dropped off for recycling. […] those new garbage pieces seem
> to keep counting in the score streak […] especially if the player has the
> magnet powerup."

### 1.2 The mechanism

Three shipped facts compose into it.

**(a) `game.deliveryCount` has no ceiling and one distance-gated reset.** It
increments once per `chain.pop()` in the dock-offload block; the only reset there
sits in the `else` branch behind `dist2 > (dock.radius + 40)²`. A ship that never
travels that far never resets.

**(b) The award is linear in an unbounded counter.**
`pts = DOCK_BASE_SCORE + DOCK_BONUS_STEP * (deliveryCount − 1)` — 50 + 25(n−1),
summing to ≈ `12.5n²` over a visit. Quadratic, uncapped.

**(c) The dock accepts 20 canisters per second.** `DOCK_OFFLOAD_INTERVAL` is
`0.05`. The pickup gate never blocks a parked ship either — it tests
`game.chain.length < game.cargoMax`, and the chain is draining at 20/s, so there
is always room regardless of the level's payload cap.

### 1.3 Measured, against the real build

Driven through the real `update()` path at `09d443f`. Ship parked just inside the
offload cutoff, one fresh piece fed every 6 frames (≈10/s, well under the 20/s
ceiling):

| Scenario | Canisters | Score |
|---|---:|---:|
| Level 1, parked 10 s | 100 | 168,750 |
| Level 1, parked 30 s | 300 | 1,513,750 |
| Level 1, parked 60 s | 600 | 5,650,000 |
| Level 12, parked 60 s | 600 | 5,650,000 |
| **Control — 10 full-cap visits at level 12, played as designed** | 240 | **107,000** |

The 600th canister alone pays 15,025. Legitimate level-12 play averages ~446 per
canister. The park's level makes no difference to the score at all, which is the
tell: the exploit is entirely decoupled from the difficulty curve.

### 1.4 The consequence that is not about score

`if (game.deliveryCount === CARGO_CAP_MAX) superMegaDelivery();` — `CARGO_CAP_MAX`
is 24, but `levelDef(n).payloadSlots` is **8 at levels 1–4** and does not reach 24
until level 12. Parking fires the full SMD — the guaranteed six-type powerup set,
the snapshot Hunter sweep, the `sweepCoalescePause` — at level 1. Confirmed in the
probe. That is CS018 FORK-B being routed around.

### 1.5 The consequence that persists across runs

`stats.bestCombo`, `stats.delivered`, `Achievements.lifetime.delivered`,
`.bestDeliveredGame` and `.deliveryScore` all inflate. The lifetime figures never
reset, so one parked run permanently distorts Recycling Magnate, Salvage King and
Ton of Scrap.

### 1.6 Why the CS018 "depth is fine" precedent does not apply

CS018 accepted a difficulty reduction at level 63 because players are not reaching
level 63. This is reachable at level 1, inside the first minute, by anyone who
picks up a Magnet near the dock.

---

## 2. The one-effort defect (P1b)

### 2.1 What Paul observed

> "If the ship legitimately has more than one piece of garbage in tow, then
> reaches the recycle hub to begin offloading, but flies out of the recycle hub
> before all those pieces are delivered, then the delivery count starts over.
> […] this shows as a problem when the ship happens to just skirt the recycle hub
> a little bit, with only enough time to deliver a few of the towed garbage
> pieces."

**This predates CS020.** The `radius + 40` reset has always behaved this way; P1
did not cause it, it only prompted a hard look at delivery scoring.

### 2.2 Measured

Ship at `dock.radius − 20`, 8-piece towed load, deliver 3, step out, return:

```
dock.radius = 88   (DOCK_RADIUS 44, LEVER_DOCK_SIZE disabled ⇒ permanent 2×)
offload zone < 98 px      combo reset > 128 px      offload rate 20/s

CLEAN PASS    : deliveryCount 8,  score 1100
SKIRT + RETURN: deliveryCount 5,  score 725      (the same 8 pieces)
```

The cliff is exact and unhysteretic:

| Exit distance | Final `deliveryCount` | Score |
|---|---:|---:|
| 127 px (`radius + 39`) | 8 | 1100 |
| **129 px (`radius + 41`)** | **5** | **725** |
| 208 px (`radius + 120`) | 5 | 725 |

One frame past 128 px and the run is gone. The level-12 case is the one that
matters:

```
LEVEL 12, full 24-piece load:
  clean     : deliveryCount 24, score 8100, SMD fires: TRUE
  one skirt : deliveryCount 21, score 6525, SMD fires: FALSE
```

**A single skirt costs the Super Mega Delivery outright.** The player towed 24,
delivered 24, and the `=== CARGO_CAP_MAX` trigger never fired.

### 2.3 Why a grace timer alone is not the fix

The obvious repair — swap the reset for a countdown, cancel it on re-entry —
reopens the exploit at a wider radius.

`MAGNET_RANGE` is 380 px; the ring is 128 px from dock centre. A player hovering
at 130 px is *outside* the ring, so their pickups tag `towed` under P1, and they
reach garbage out to 510 px. Fill, dip inside 98 px, offload at escalating rates,
drift back out, and the timer carries the combo across. The counter climbs
across trips without bound — the annulus, at 60 px of travel for the entire cost.

**The timer cannot be the safety mechanism.** Something else has to bound the
counter, and then the timer is free to be as generous as feel requires.

### 2.4 How long is a real turnaround?

Simulating `Ship.update`'s actual integrator (`SHIP_TURN` 4.2, `SHIP_THRUST` 340,
`SHIP_DRAG` 0.35, `SHIP_MAX_SPEED` 520, with the `CARGO_THRUST`/`CARGO_MAXSPD`
towed-mass penalties), seconds spent outside the 128 px ring before getting back
in:

| Exit speed | cargo 0 | cargo 5 | cargo 12 | cargo 20 |
|---|---:|---:|---:|---:|
| **react 0.2 s (sharp pilot)** | | | | |
| 100 px/s | 1.90 | 1.95 | 2.03 | 2.12 |
| 200 px/s | 2.43 | 2.53 | 2.67 | 2.82 |
| 300 px/s | 2.92 | 3.05 | 3.23 | 3.45 |
| **react 0.5 s (normal pilot)** | | | | |
| 200 px/s | 2.80 | 2.90 | 3.03 | 3.18 |
| 300 px/s | 3.28 | 3.42 | 3.60 | 3.80 |
| 400 px/s | 3.72 | 3.88 | 4.12 | 4.42 |

A 180° turn at `SHIP_TURN` costs **0.75 s before thrust can even begin**, then
reaction, then killing the outbound velocity, then the trip back.

**A 2,000 ms window would fail in almost every real skirt** — including the exact
case that prompted the fix. Hence `DOCK_COMBO_GRACE` ships at **4.0 s**. Since the
hook-reset (§5.1) is what bounds the counter, a generous window costs nothing.

---

## 3. Resolved forks

| Fork | Resolution |
|---|---|
| **FORK-CS020-A** | ✅ **Per-node `towed` tag**, set at capture. Not a count snapshot — the chain is LIFO and a snapshot credits the wrong pieces (§4.1). |
| **FORK-CS020-B** | ✅ **In-ring pickups count toward nothing.** Not `stats.delivered`, not `lifetime.delivered`, not `bestCombo`, not `deliveryCount`. They are *incidentals*, not part of the work Dan has to do. |
| **FORK-CS020-C** | ✅ **An incidental pays flat `DOCK_BASE_SCORE` (50).** No new constant. |
| **FORK-CS020-D** | ✅ **`DOCK_OFFLOAD_INTERVAL` stays at 0.05.** See §6. |
| **FORK-CS020-E** | ✅ **A delivery run is ONE EFFORT: one chain, delivered in one go.** Terminated by *gathering again* (a towed hook), not by moving. Plus a grace window so a skirt-and-return is still one effort. Exposed as a debug knob in **milliseconds**. |

### Flags (best-guess, review at playtest)

| Flag | Call |
|---|---|
| **FLAG-CS020-a** | An incidental does **not** advance `pacifistStreak`, and does not break it either — only firing does that. Incidentals are neutral to Pacifist Tow / Zen Master. |
| **FLAG-CS020-b** | An incidental's 50 points do **not** enter `lifetime.deliveryScore`. The one exclusion arguably at odds with Ton of Scrap's own wording; reachable either way. |
| **FLAG-CS020-c** | ✅ **Cleared at the P1 gate.** The `REPAIR_MILESTONE` farming residual did not bite in play. No `DOCK_INCIDENTAL_SCORE` constant. |
| **FLAG-CS020-d** | ✅ **Cleared at the P1 gate.** Incidental `FloatText` density is legible. |
| **FLAG-CS020-e** | ✅ **Cleared at the P1 gate.** `AudioSys.deliver(1)` reads correctly. |
| **FLAG-CS020-f** | ✅ **Cleared at the P1 gate.** The straggler-on-approach case did not read as unfair. No grace period on the tag. |
| **FLAG-CS020-g** | `DOCK_COMBO_GRACE` default **4.0 s / 4000 ms**, not the 2,000 ms first proposed — §2.4 shows 2 s fails the case it exists for. Retune at the P1b gate. |
| **FLAG-CS020-h** | The grace window runs whenever the ship is outside the ring, **regardless of whether the chain is empty**. Simpler than gating on chain contents, and provably equivalent: with an empty chain there is nothing left to count, and the next towed hook resets anyway. |
| **FLAG-CS020-i** | There is still **no HUD readout of `deliveryCount` anywhere in the build**. The combo is invisible except through floaters and Dan's line, and it now survives across trips. A real gap, deliberately **out of scope** — CS021. |

---

## 4. The mechanism — P1 (shipped)

### 4.1 Why a per-node tag and not a count snapshot

The chain is LIFO. The offload takes the tail
(`const node = game.chain.pop(); // canisters peel off from the tail`) and both
pickup sites `push()` to that same tail, so **a piece hooked while parked jumps
the queue and is delivered first**. Any count-based scheme spends the snapshot's
escalation budget on the in-ring pickups and demotes the genuinely towed ones.
Tagging at capture is immune to ordering, needs no arrival event, costs one field.

### 4.2 The tag

`DOCK_NEIGHBORHOOD_PAD = 40` hoists the bare literal. Inside the capture gate,
above the single/clump branch (the CS017 P5 bonus-canister placement idiom, so one
expression covers both push paths):

```js
const pad = game.dock ? game.dock.radius + DOCK_NEIGHBORHOOD_PAD : 0;
const inRing = !!game.dock && dist2(game.ship, game.dock) < pad * pad;
```

Both `game.chain.push({...})` sites carry `towed: !inRing`.

**Why `+40` and not the `+10` offload radius.** Under P1 alone this was the only
radius under which "tagged incidental" and "combo not reset" described the same
region; `+10` left a farmable annulus. **P1b supersedes that argument** — the
hook-reset caps the counter at `cargoMax` regardless of tag radius — but `+40`
stays, now for a different and equally good reason: at `+10`, a parked player's
magnet grabs would tag `towed` and therefore *reset their own combo* continuously.
`+40` keeps a parked ship's pickups neutral.

### 4.3 The read, and its default

```js
const towed = node.towed !== false;   // absent ⇒ towed
```

**Load-bearing.** 22 files under `scratchpad/` seed chain nodes as bare object
literals with no `towed` field; a truthiness test silently reclassifies all of
them as incidentals. Same defensive-default reasoning as `breakChain(i, src = null)`
in CS019 P1. `Garbage.fromNode(n)` reads only `n.x`, `n.y`, `n.mass`, so a severed
node carries no stale tag back into the world.

### 4.4 The offload split

The whole existing body moves unchanged into `if (towed) { … }`; the else branch is
`addScore(DOCK_BASE_SCORE)`, its own `FloatText`, and `AudioSys.deliver(1)`.
`game.offloadTimer = DOCK_OFFLOAD_INTERVAL` runs for both.
`VoiceSys.dockDelivery` moved **inside** the towed branch — a parked ship empties
its chain on every incidental pop, so leaving it outside had Dan sizing up a haul
twenty times a second.

Everything keyed on `deliveryCount` is then correct with no further edits: the
CS018 P8 reward tiers at 8/12/16/20, Heavy Hauler `=== 12`, Maxed Out
`=== CARGO_CAP_MAX`, and the SMD trigger.

---

## 5. The mechanism — P1b

### 5.1 The rule that does the work

> **A towed hook ends the current effort.** When a piece is captured with
> `!inRing`, `game.deliveryCount = 0`.

The combo now means *"pieces from the load I brought."* Its terminator is starting
to gather again, not moving.

One line, inside the capture gate beside the tag:

```js
// CS020 P1b: gathering again starts a NEW effort. An INCIDENTAL never does this —
// it is neutral to the counter in both directions (FORK-CS020-B).
if (!inRing) game.deliveryCount = 0;
```

**This is what makes the counter safe, and it yields a guarantee P1 never had:**

> Between any two resets, only nodes already in the chain can be counted, and the
> pickup gate bounds the chain at `game.cargoMax`. Therefore
> **`deliveryCount ≤ cargoMax`, structurally.**

Maxed Out at 24 now requires level 12 because it *cannot* be reached otherwise —
a stronger property than policing each consumer. The annulus farm of §2.3 dies
with it: a player hovering at 130 px resets on every hook, so each trip delivers
at most one payload's worth.

### 5.2 The grace window

`DOCK_NEIGHBORHOOD_PAD` regains its second reader. The distance-based reset is
**deleted** and replaced by a countdown, hoisted to the top of the dock block so it
evaluates on every frame independent of the offload branch:

```js
const DOCK_COMBO_GRACE = 4.0;  // sec a delivery run survives outside the dock neighbourhood
```

```js
if (game.dock) {
  // CS020 P1b / FORK-CS020-E: one effort = one chain delivered in one go. It survives LEAVING
  // the dock — a skirt-and-return is still one effort — for DEBUG.dockComboGrace seconds. It does
  // NOT survive gathering again; that reset lives at the pickup gate. Ship-dead is excluded so a
  // corpse neither decays nor re-arms (scatterChain already zeroed the counter).
  const npad = game.dock.radius + DOCK_NEIGHBORHOOD_PAD;
  if (!game.ship.dead && dist2(game.ship, game.dock) > npad * npad) {
    game.comboGrace -= dt;
    if (game.comboGrace <= 0) game.deliveryCount = 0;
  } else {
    game.comboGrace = DEBUG.dockComboGrace;   // inside the ring: the run is safe, window re-armed
  }
  … nearDock / offload as before, its else branch now only `game.offloadTimer = 0;` …
}
```

New run state `comboGrace: 0` sits beside `deliveryCount: 0, offloadTimer: 0` in
the game object literal, and is zeroed in `startGame()` alongside them.

**Re-arming happens at the ring (128 px), not the offload zone (98 px).** Once the
player is back inside the neighbourhood the run is safe indefinitely and they can
take their time closing the last 30 px. Loitering there is harmless: pickups are
incidentals, so nothing advances.

### 5.3 The debug knob

The `unit: "ms"` + `toNative` idiom already exists (`autoShieldRegenPause`,
`garbageAttractDelay`), so this is the established pattern, not a novelty:

```js
{ header: "DELIVERY" },
{ id: "dockComboGrace", label: "Delivery one-effort window", unit: "ms",
  def: DOCK_COMBO_GRACE * 1000, min: 0, max: 10000, step: 100, toNative: v => v / 1000 },
```

New `{ header: "DELIVERY" }` section placed after `CHAIN GUARD` (chain-adjacent,
and leaves room for future delivery knobs). `DEBUG_VARS` count **33 → 34**.
`DOCK_COMBO_GRACE` stays in place as the documented shipped value, per the
CS015 P5 registry idiom. Persistence is the existing additive
`afd_settings_v1.debug` path with known-value-else-default validation — **no schema
bump**.

### 5.4 Where this is stricter than the literal ask

Skirt with 8, deliver 3, hook one stray on the way back: the combo resets, and the
5 originals deliver at 1…5 rather than 4…8. The player topped up mid-run, so it is
a new run. This is the load-bearing rule that keeps the counter capped, and it is
the one case where the originals might have been expected to survive.

### 5.5 Reachability audit — nothing becomes unreachable

| Achievement | Requirement | Under CS020 |
|---|---|---|
| Combo Collector | `bestCombo` ≥ 8 | Level 1 `payloadSlots` is exactly 8 — a full level-1 tow earns it |
| Scrap Runner | 20 delivered, one game | Cumulative across visits; unaffected |
| Speed Recycler | first canister within 60 s | `stats.delivered === 1` latch; unaffected |
| Pacifist Tow / Zen Master | 5-delivery no-fire streak | 5 ≤ 8; reachable from level 1 |
| Heavy Hauler / Long Haul / Freight Baron | `deliveryCount === 12` | Needs `payloadSlots` ≥ 12 → level 6+ |
| Maxed Out | `deliveryCount === 24` | Needs level 12+ — **and now cannot be reached any other way** |
| Salvage King | up to 200 canisters, one game | ~9 full 24-loads; a grind, which is what a top tier is |
| Recycling Magnate | up to 100,000 lifetime | Genuinely slower — it *was* farmable, and should not have been |
| Ton of Scrap | 10,000 lifetime delivery score | Two or three good games; unaffected in practice |

P1b makes these **easier**, not harder, relative to the P1-only build: a skirting
player no longer loses Heavy Hauler and Maxed Out to a counter restart.

---

## 6. Deliberately not changing

- **`DOCK_OFFLOAD_INTERVAL` (0.05 s).** A documented playtest knob, and what makes
  parking efficient — but not what makes it *pay*. Slowing it changes the feel of
  every legitimate delivery to fix nothing the tag does not already fix.
- **The pickup gate.** In-ring pickups still hook, recycle and clear the board.
  Blocking them would fight the Kessler loop.
- **`breakChain` / `scatterChain`.** Both still zero `deliveryCount`. A chain break
  genuinely disrupts the load; the guard absorb correctly does not reset.
- **The tag radius.** `+40` keeps its value — see §4.2 for the new reason.
- **`DIFFICULTY-LEVERS.md`.** No row. `dockComboGrace` is a feel knob on a scoring
  rule, not a difficulty lever, and it scales with nothing.
- **A HUD combo readout.** FLAG-CS020-i. Real, deliberately CS021.

---

## 7. Retirement ledger

- **Retired:** the distance-based combo reset in the dock block's `else` branch
  (`if (dist2 > (dock.radius + 40)²) game.deliveryCount = 0;`). Replaced by the
  towed-hook reset (§5.1) plus the grace window (§5.2). No constant loses its last
  reader — `DOCK_NEIGHBORHOOD_PAD` gains a new one in the same phase.
- **Added:** `DOCK_COMBO_GRACE`, `game.comboGrace`, `DEBUG_VARS.dockComboGrace`,
  one `{ header: "DELIVERY" }`. `DEBUG_VARS` 33 → 34.
- No symbol deleted, no localStorage key touched, no schema bump.

---

## 8. Test plan

### 8.1 P1 — `scratchpad/test-cs020-p1.js` (written, green)

Source pins; the level-1 60-second park pinned against the **fixed SHA `09d443f`**
as a permanent red control; the tag boundary at `±1 px`; both push paths and the
clump-scoop's `take` nodes; the LIFO ordering property; the `!== false` default;
the latch suite; the stats suite; Dan's silence; a byte-identity control; an
`AudioSys.ctx` null smoke.

### 8.2 P1b — `scratchpad/test-cs020-p1b.js` (new)

Same discipline: drive the real `startGame` / `update` / pickup gate / offload
path, reimplement nothing.

1. **`node --check`.**
2. **Source pins.** No surviving distance-based `deliveryCount = 0` in the dock
   block. `DOCK_NEIGHBORHOOD_PAD` has exactly two readers (the tag, the grace
   gate). `DEBUG_VARS.length` accounts for 34 knobs plus headers.
   `dockComboGrace` carries `unit: "ms"` and `toNative: v => v / 1000`.
3. **THE BUG, closed.** 8 towed, deliver 3, exit to 200 px for 1 s, return:
   `deliveryCount` reaches **8**, score **1100** — identical to the clean pass.
   Pin the pre-fix `5` / `725` against `09d443f` as a permanent red control.
4. **The level-12 headline.** Full 24 load, one skirt inside the window: reaches
   24, SMD **fires**. Pre-fix control: 21, no SMD.
5. **The window expires.** Same scenario, out for `grace + 0.5 s`: counter resets,
   remaining pieces deliver from 1. Boundary-probe at `grace ± 1 frame`.
6. **The window is the knob.** Set `DEBUG.dockComboGrace` to 0 → expiry is
   immediate. Set it to 10 s → a 9-second excursion still preserves the run. The
   test drives the knob, not the constant.
7. **THE CAP — the property that replaces the annulus argument.** Across a long
   randomized session (hooks at random distances, random excursions, random
   offloads, seeded RNG), assert `deliveryCount <= game.cargoMax` on **every
   frame**. This is §5.1's guarantee, asserted rather than argued.
8. **The hook-reset discriminates.** A hook at `dock.radius + 41` resets the
   counter; a hook at `dock.radius + 39` does not (and does not count, per P1).
9. **The 130 px farm is dead.** Hover just outside the ring, hook to capacity, dip
   inside 98 px, offload, repeat ×5 within the grace window: peak combo never
   exceeds `cargoMax` and total score matches five honest full loads.
10. **P1 is not regressed.** Re-run the P1 park scenario: still bounded, still
    zero latches, still no SMD.
11. **Ship death.** `scatterChain` zeroes the counter; the grace timer neither
    decays nor re-arms while `ship.dead`.
12. **Persistence.** `dockComboGrace` round-trips through `afd_settings_v1.debug`;
    a garbage stored value falls back to default; `returnToDefaults()` does not
    touch it (it resets **bindings only**).
13. **`AudioSys.ctx` null smoke** across a full skirt-and-return cycle.

**Mutation-test the suite.** Each must fail it on a **behavioural** assertion, not
merely a source pin: dropping the hook-reset (keeps §8.2.7 green? then the test is
wrong); resetting on *every* hook including incidentals; re-arming at the offload
radius instead of the ring; making the grace timer the only guard (must fail
§8.2.9); `toNative` returning `v` instead of `v / 1000`.

**Baseline first.** Sweep `scratchpad/test-*.js` at the P1 commit before editing
and record the failure count. Expect the `test-p5.js` flake (~1 run in 15).

**Expected repoint surface.** No existing test hardcodes `radius + 40`, so it is
small. The P1 suite's `DOCK_NEIGHBORHOOD_PAD` reader-count pin was written when
there was one reader and needs repointing to two. Repoint to the mirror-image
claim, never weaken or delete.

---

## 9. Docs (P2 only)

- **GDD §2.10** — the delivery run as **one effort**: what earns the combo, what an
  incidental pays, the LIFO reasoning for tagging at capture, the towed-hook
  terminator, the grace window, and the `deliveryCount ≤ cargoMax` guarantee.
- **GDD §2.10.2** — the payload curve is now genuinely load-bearing for the SMD and
  the reward tiers, and is now the *hard ceiling* on the combo.
- **GDD §2.17** — Maxed Out is a level-12+ achievement by construction; Recycling
  Magnate and Salvage King are no longer farmable at the dock.
- **GDD §2.19** — the Debug Options section header gains the `DELIVERY` section and
  the one-effort knob (34 knobs).
- **Architecture Map** — Constants gain `DOCK_NEIGHBORHOOD_PAD` and
  `DOCK_COMBO_GRACE`; run state gains `comboGrace`; the chain-node shape gains
  `towed`.
- **`GDD-VERSION-HISTORY.md`** — one consolidated CS020 (P1 + P1b + P2) entry.
  **Note in passing: CS018 still has no entry there** — CS019 P2 found the gap and
  correctly left it alone. Still not this changeset's job.
- **`DIFFICULTY-LEVERS.md`** — untouched, per §6.