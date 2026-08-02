# PLANNED FEATURES — CS020

**Changeset scope: one exploit.** A ship parked inside the recycling dock's
neighbourhood keeps its delivery combo alive indefinitely, so garbage that
wanders into the ship while parked earns escalating combo score, advances every
delivery-keyed achievement latch, and triggers the Super Mega Delivery at levels
where the player's payload capacity could never have carried 24 pieces. This
changeset fixes that and nothing else.

Base build: CS019 P2, `GAME_VERSION "1.0.0.19"`, commit `09d443f`.
Target: `"1.0.0.20"`, bumped in **P2**.

---

## 1. The exploit

### 1.1 What Paul observed

> "Once Dan's ship enters the recycle ring to drop off payload, as long as the
> ship is still in the recycle ring, any new garbage pieces that hit the ship
> automatically get dropped off for recycling. […] those new garbage pieces seem
> to keep counting in the score streak that happens if you deliver multiple
> pieces at once. This allows the player to game the multiple-delivery system for
> score, and most drastically for the supermega delivery, especially if the
> player has the magnet powerup."

Confirmed in full, and it is larger than the observation.

### 1.2 The mechanism

Three shipped facts compose into it.

**(a) `game.deliveryCount` has no ceiling and only one reset.** It increments
once per `chain.pop()` in the dock-offload block, and the only reset in that
block is in the `else` branch, gated on distance:

```js
} else {
  game.offloadTimer = 0;
  // combo resets once you leave the dock's neighborhood
  if (!game.ship.dead &&
      dist2(game.ship, game.dock) > (game.dock.radius + 40) * (game.dock.radius + 40)) {
    game.deliveryCount = 0;
  }
}
```

A ship that never travels further than `dock.radius + 40` never resets. (The
other two resets — `breakChain` and `scatterChain` — require taking a hit, which
a parked ship can largely avoid, and trivially so under a Chain Guard.)

**(b) The per-canister award is linear in an unbounded counter.**

```js
const pts = DOCK_BASE_SCORE + DOCK_BONUS_STEP * (game.deliveryCount - 1);  // 50 + 25(n−1)
```

Summed over a visit that is total ≈ `12.5n²`. Quadratic, uncapped.

**(c) The dock accepts 20 canisters per second.** `DOCK_OFFLOAD_INTERVAL` is
`0.05`. Parking is not merely possible, it is the highest-throughput scoring
action in the game.

The pickup gate never blocks a parked ship either — it tests
`game.chain.length < game.cargoMax`, and the chain is being drained at 20/s, so
there is always room regardless of the level's payload cap.

### 1.3 Measured, against the real build

Driven through the real `update()` dock-offload path at commit `09d443f`. Ship
parked just inside the offload cutoff, one fresh garbage piece fed every 6 frames
(≈10/s — roughly what a magnet park looks like, and well under the 20/s ceiling):

| Scenario | Canisters | Score |
|---|---:|---:|
| Level 1, parked 10 s | 100 | 168,750 |
| Level 1, parked 30 s | 300 | 1,513,750 |
| Level 1, parked 60 s | 600 | 5,650,000 |
| Level 12, parked 60 s | 600 | 5,650,000 |
| **Control — 10 separate full-cap visits at level 12, played as designed** | 240 | **107,000** |

The 600th canister alone is worth 15,025 points. Legitimate play at level 12
averages ~446 points per canister. The park's level makes no difference to the
score at all, which is itself the tell: the exploit is entirely decoupled from
the difficulty curve.

### 1.4 The consequence that is not about score

**The Super Mega Delivery's level gate is bypassed.** The SMD trigger is

```js
if (game.deliveryCount === CARGO_CAP_MAX) superMegaDelivery();
```

`CARGO_CAP_MAX` is 24, but `levelDef(n).payloadSlots` is **8 at levels 1–4** and
does not reach 24 until level 12. Parking therefore lets a level-1 player fire
the full SMD — the guaranteed six-type powerup set, the snapshot Hunter sweep
with kills credited, and the `sweepCoalescePause` — with a payload capacity of 8.
Confirmed firing at level 1 in the probe.

That is CS018 FORK-B (payload slots are **granted by level**, starting at 8)
being routed around. The SMD was scoped as the reward for a capability the player
has to reach level 12 to possess. The same reasoning applies, less dramatically,
to the CS018 P8 reward tiers at 8/12/16/20 and to the Heavy Hauler / Maxed Out
latches.

### 1.5 The consequence that persists across runs

`game.stats.bestCombo`, `game.stats.delivered`,
`Achievements.lifetime.delivered`, `Achievements.lifetime.bestDeliveredGame` and
`Achievements.lifetime.deliveryScore` all inflate. Unlike score, the lifetime
figures do not reset — a single parked run permanently distorts Recycling
Magnate, Salvage King and Ton of Scrap.

### 1.6 Why the CS018 "depth is fine" precedent does not apply

CS018 accepted a difficulty reduction at level 63 on the grounds that players are
not reaching level 63. That reasoning does not transfer: this is reachable at
level 1, inside the first minute, by anyone who picks up a Magnet near the dock.

---

## 2. Resolved forks

| Fork | Resolution |
|---|---|
| **FORK-CS020-A** | ✅ **Per-node `towed` tag.** Discriminate at the moment of capture, not by counting pops. See §3.1 for why a count snapshot is wrong. |
| **FORK-CS020-B** | ✅ **In-ring pickups count toward nothing.** Not `game.stats.delivered`, not `Achievements.lifetime.delivered`, not `bestCombo`, not `deliveryCount`. Paul's framing: they are *incidentals*, not part of the work Dan has to do to deliver garbage. |
| **FORK-CS020-C** | ✅ **An incidental pays flat `DOCK_BASE_SCORE` (50).** No new constant. A canister is a canister; what an incidental does not earn is the *combo*. |
| **FORK-CS020-D** | ✅ **`DOCK_OFFLOAD_INTERVAL` stays at 0.05.** Deliberately untouched — see §4. |

### Flags (best-guess, review at playtest)

| Flag | Call |
|---|---|
| **FLAG-CS020-a** | An incidental does **not** advance `game.stats.pacifistStreak`. It does not *break* it either — only firing does that (`game.stats.pacifistStreak = 0` in the fire path). Incidentals are neutral to Pacifist Tow / Zen Master. |
| **FLAG-CS020-b** | An incidental's 50 points do **not** flow into `Achievements.lifetime.deliveryScore`. Consistent with FORK-CS020-B, but note this is the one exclusion arguably at odds with the achievement's own wording ("Earn 10,000 points from dock deliveries"). Ton of Scrap stays comfortably reachable either way. |
| **FLAG-CS020-c** | The residual: incidentals still route through `addScore()`, which trips the `REPAIR_MILESTONE` hull repair every 10,000 points. At the 20/s ceiling that is 1,000 pts/s → a 25 HP repair every 10 s. In practice the rate is bounded by garbage *availability*, not by the offload interval, so the real figure is much lower — but this is a genuine consequence of FORK-CS020-C that was not costed when it was resolved. **Watch it in playtest.** If it matters, the fix is a smaller `DOCK_INCIDENTAL_SCORE` constant, a one-line change. |
| **FLAG-CS020-d** | An incidental still pushes its own `FloatText`. At high throughput that is up to 20 floaters/second. Kept, because the player should see they are being paid — but it is a look-call. |
| **FLAG-CS020-e** | `AudioSys.deliver(n)` pitches with the combo. An incidental calls `AudioSys.deliver(1)` — audible, but flat, so the rising delivery run stays the sound of an actual haul. |
| **FLAG-CS020-f** | A piece hooked while the ship is inside the neighbourhood but still coasting in — e.g. a magnet-dragged straggler that lands at 35 px from the dock edge — is tagged incidental and loses its multiplier. Ship without a grace period; playtest decides whether it reads unfairly. |

---

## 3. The mechanism

### 3.1 Why a per-node tag and not a count snapshot

The obvious implementation of "only the load I towed in earns multipliers" is to
snapshot `game.chain.length` on arrival and let the first N pops escalate. **That
credits the wrong pieces.**

The chain is LIFO. The offload block takes the tail:

```js
const node = game.chain.pop(); // canisters peel off from the tail
```

and both pickup sites `push()` to that same tail. A piece hooked while parked
therefore **jumps the queue and is delivered first**. Any count-based scheme
spends the snapshot's escalation budget on the in-ring pickups and demotes the
genuinely towed ones.

Tagging the node at capture is immune to ordering, needs no arrival event, and
costs one field.

### 3.2 The tag

Hoist the existing bare literal:

```js
const DOCK_NEIGHBORHOOD_PAD = 40;  // px past dock.radius: the combo's "still at the dock" region
```

and repoint the existing combo-reset test at `~L6295` to use it, so the two sites
provably share one number.

In the garbage-pickup block, immediately inside the capture gate and **above**
the single/clump branch (the same placement idiom the CS017 P5 bonus-canister
award already uses, so both push paths are covered by one expression):

```js
// CS020: a node is TOWED if it was hooked OUTSIDE the dock's neighbourhood.
const pad = game.dock ? game.dock.radius + DOCK_NEIGHBORHOOD_PAD : 0;
const inRing = !!game.dock && dist2(game.ship, game.dock) < pad * pad;
```

Both `game.chain.push({...})` sites gain `towed: !inRing` alongside `mass`.

**The radius choice is load-bearing.** It must be the *combo-reset* radius
(`+40`), not the *offload* radius (`+10`). Using `+10` leaves a farmable annulus:
a player hovering 20 px out would hook pieces tagged `towed` (they are outside
`+10`) while never travelling far enough to reset the combo (they are inside
`+40`), then drift in and offload the whole farm at escalating rates. `+40` is
the only radius under which "tagged incidental" and "combo not reset" describe
the same region, leaving no gap.

### 3.3 The read, and its default

```js
const node = game.chain.pop();
const towed = node.towed !== false;   // absent ⇒ towed
```

**The `!== false` form is deliberate and load-bearing.** 22 files under
`scratchpad/` seed chain nodes directly as object literals without a `towed`
field; a truthiness test would silently reclassify every one of them as an
incidental and turn most of the delivery suite red for no behavioural reason.
This is the same defensive-default reasoning that made `breakChain(i, src = null)`
work in CS019 P1, and it is verified by test rather than assumed.

`Garbage.fromNode(n)` reads only `n.x`, `n.y` and `n.mass`, so a severed node
carries no stale tag back into the world; a re-hooked piece is re-tagged at its
new capture. No change needed there.

### 3.4 The offload split

The entire existing body of the offload block moves, unchanged, into a
`if (towed) { … }` branch. The `else` branch is new and short:

```js
} else {
  // CS020: an incidental — hooked inside the dock's neighbourhood, not towed in. It recycles
  // and it pays, but it is not part of the haul: no combo, no delivery stats, no latches.
  addScore(DOCK_BASE_SCORE);
  game.floaters.push(new FloatText("+" + DOCK_BASE_SCORE, node.x, node.y, COLOR.dock));
  AudioSys.deliver(1);
}
game.offloadTimer = DOCK_OFFLOAD_INTERVAL;   // both branches
```

Everything keyed on `game.deliveryCount` is then correct **without further
edits**, because incidentals never advance it: the CS018 P8 reward tiers at
8/12/16/20, the Heavy Hauler `=== 12` latch, the Maxed Out `=== CARGO_CAP_MAX`
latch, and the Super Mega Delivery trigger. That is the point of fixing this at
the counter rather than at each consumer.

**One consumer does need moving explicitly:**

```js
if (game.chain.length === 0) VoiceSys.dockDelivery(game.deliveryCount);
```

This must live inside the towed branch. A parked ship empties its chain on
*every* incidental pop (hook one, pop it, length is 0 again), so leaving it
outside would have Dan sizing up a 24-piece haul twenty times a second. It is a
pre-existing noise source that the fix should close while it is here.

### 3.5 Reachability audit — nothing becomes unreachable

Verified against the live achievement definitions.

| Achievement | Requirement | Under CS020 |
|---|---|---|
| Combo Collector | `bestCombo` ≥ 8 | Level 1 `payloadSlots` is exactly 8 — a full level-1 tow earns it |
| Scrap Runner | 20 delivered, one game | Cumulative across visits; unaffected |
| Speed Recycler | first canister within 60 s | `stats.delivered === 1` latch; unaffected |
| Pacifist Tow / Zen Master | 5-delivery no-fire streak | 5 ≤ 8; reachable from level 1 |
| Heavy Hauler / Long Haul / Freight Baron | `deliveryCount === 12` | Needs `payloadSlots` ≥ 12 → level 6+ |
| Maxed Out | `deliveryCount === 24` | Needs level 12+ — **which is the original intent** |
| Salvage King | up to 200 canisters, one game | ~9 full 24-loads; a grind, which is what a top tier is |
| Recycling Magnate | up to 100,000 lifetime | Genuinely slower — it *was* farmable, and should not have been |
| Ton of Scrap | 10,000 lifetime delivery score | Two or three good games; unaffected in practice |

Two are worth stating out loud rather than burying: **Maxed Out becomes a
level-12+ achievement**, and **Recycling Magnate's top tiers get materially
harder**. Both are the fix working as intended, not collateral damage.

---

## 4. Deliberately not changing

- **`DOCK_OFFLOAD_INTERVAL` (0.05 s).** It is a documented playtest knob and it
  is what makes parking *efficient*, but it is not what makes parking *pay*.
  Slowing it would change the feel of every legitimate delivery to fix nothing
  the tag does not already fix. Resolved as FORK-CS020-D; revisit only if
  FLAG-CS020-c bites.
- **The pickup gate.** In-ring pickups still get hooked, still get recycled,
  still clear the board. Blocking them would fight the Kessler loop — neglected
  garbage coalescing into Hunters is the game's central pressure, and the player
  should never be discouraged from clearing it.
- **`breakChain` / `scatterChain`.** Both still zero `deliveryCount`; both
  correct as-is.
- **The combo-reset radius itself.** `+40` keeps its value; it is only being
  hoisted to a named constant because a second site now reads it.
- **`DIFFICULTY-LEVERS.md`.** No row. This is a scoring-eligibility rule, not a
  difficulty lever, and FORK-CS020-C adds no tunable constant. If FLAG-CS020-c
  forces a `DOCK_INCIDENTAL_SCORE` later, that would be the moment to reconsider
  — and even then it is arguably still not a lever.

---

## 5. Retirement ledger

Nothing retires. One bare literal (`40`) is hoisted to `DOCK_NEIGHBORHOOD_PAD`
and its one existing reader repointed. No constant loses its last reader, no
symbol is deleted, no `DEBUG_VARS` entry is added or removed (count stays 33).

---

## 6. Test plan

New file `scratchpad/test-cs020-p1.js`, driving the **real** `startGame()`,
`update()`, pickup gate and dock-offload path. Nothing under test reimplemented.

1. **`node --check`** on the extracted `<script>`.
2. **Source pins.** `DOCK_NEIGHBORHOOD_PAD` defined once; exactly two readers
   (the tag expression and the combo reset), with no surviving bare
   `dock.radius + 40`. Both `game.chain.push` sites carry `towed:`. The offload
   read is the `!== false` form, not a truthiness test. `VoiceSys.dockDelivery`
   is inside the towed branch.
3. **THE REGRESSION — the exploit is dead.** Reproduce §1.3's level-1 60-second
   park through the real `update()` loop and assert the score is bounded by
   `towed-load escalation + 50 × incidentals`, not the quadratic 5,650,000. Pin
   the pre-fix number against the **fixed SHA `09d443f`** (never `HEAD`) as a
   permanent red control, per the `test-cs019-p1.js` §B3 idiom.
4. **The tag itself.** A piece hooked at `dock.radius + 41` is `towed: true`; at
   `dock.radius + 39`, `towed: false`. Both the single-piece and the clump-scoop
   push paths tag correctly, and a clump scoop tags **all** `take` nodes
   identically. The Scoop mouth and a magnet-assisted hook tag the same way as a
   plain hook — the tag is computed once at the gate, above the branch.
5. **The annulus is closed.** Hover at `dock.radius + 20`, hook 20 pieces, drift
   inside `+10`, offload: all 20 are incidentals, `deliveryCount` ends at 0.
   This is the test that would fail if someone "simplified" the tag radius to
   `+10`.
6. **The LIFO ordering property.** Arrive with a full towed load, hook one
   incidental *during* the offload window, and assert the incidental — which
   pops **first** — takes flat 50 while every towed node keeps its escalating
   award. A mutant implementing the count-snapshot design must fail this.
7. **The default.** A hand-seeded node with no `towed` field delivers as towed.
   A node with `towed: undefined` likewise. Only an explicit `false` demotes.
8. **Latches.** A parked ship that pops 40 incidentals fires **zero** CS018 P8
   reward powerups, does not trip Heavy Hauler, does not trip Maxed Out, and does
   **not** call `superMegaDelivery()`. A genuine 24-piece towed visit at level 12
   still does all four. This is §1.4 closed, asserted behaviourally.
9. **Stats.** Across a park: `stats.delivered`, `lifetime.delivered`,
   `bestCombo`, `lifetime.bestDeliveredGame`, `lifetime.deliveryScore` and
   `pacifistStreak` are all byte-unchanged; `game.score` moved by exactly
   `50 × n`. FLAG-CS020-a and -b asserted, not assumed.
10. **Dan stays quiet.** A 40-incidental park produces zero
    `VoiceSys.dockDelivery` calls (spied); a real towed haul still produces
    exactly one, on the pop that empties the chain.
11. **Byte-identity control.** A run in which the ship never hooks anything
    inside the neighbourhood produces bit-identical score, stats and latch
    behaviour to the pre-fix build under a shared seeded RNG. The fix must be
    invisible to normal play.
12. **`AudioSys.ctx` null smoke** across the full park cycle.

**Mutation-test the suite.** Each of these deliberate breakages must fail it, on
behavioural assertions and not merely on source pins: dropping the tag from the
clump-scoop push; using `+10` instead of `+40`; using truthiness instead of
`!== false`; leaving `VoiceSys.dockDelivery` outside the towed branch;
implementing the rejected count-snapshot design.

**Baseline first.** The suite was red at `HEAD` more than once in CS018/CS019.
Sweep `scratchpad/test-*.js` at `09d443f` **before** editing anything and record
the failure count, so this changeset's blast radius is measured rather than
inferred. Expect the `test-p5.js` flake (~1 run in 15).

**Expected repoint surface.** Thirteen files touch `deliveryCount`; seven touch
the delivery stats. The `!== false` default should keep nearly all of them green,
since they seed nodes directly. Repoint to the mirror-image claim, never weaken
or delete — the standing convention.

---

## 7. Docs (P2 only)

- **GDD §2.10** — the delivery/combo rule gains the towed-vs-incidental
  distinction: what earns the combo, what an incidental pays, and the LIFO
  reasoning for tagging at capture.
- **GDD §2.10.2** — a note that the payload curve is now genuinely load-bearing
  for the SMD and the reward tiers, because the counter can no longer be fed
  from outside a tow.
- **GDD §2.17** — Maxed Out is a level-12+ achievement; Recycling Magnate and
  Salvage King are no longer farmable at the dock.
- **Architecture Map** — Constants row gains `DOCK_NEIGHBORHOOD_PAD`; the chain-
  node shape gains `towed`.
- **`GDD-VERSION-HISTORY.md`** — one consolidated CS020 (P1+P2) entry.
  **Note in passing: CS018 still has no entry there** — CS019 P2 found the gap
  and correctly left it alone. Still not this changeset's job.
- **`DIFFICULTY-LEVERS.md`** — untouched, per §4.