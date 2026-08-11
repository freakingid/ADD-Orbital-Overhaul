# PLANNED FEATURES — Changeset 025

**Baseline:** `cd4d946`, `GAME_VERSION` `"1.0.0.24"`. Target: `"1.0.0.25"`
(P5 owns the bump).

Companion: `IMPLEMENTATION-PHASES-CS025.md`. When a feature ships, its spec
moves out of here and into `ORBITAL-OVERHAUL-GDD.md` §2.

---

## §0 — Preamble: read this before anything else

### 0.1 ⛔ THERE ARE TWO FILES CALLED `PLANNED-FEATURES-CS025.md` AND THEY ARE NOT THE SAME DOCUMENT

`archive/PLANNED-FEATURES-CS025-old.md` and
`archive/IMPLEMENTATION-PHASES-CS025-old.md` are a **different, abandoned plan**
— a CS025 that was written, then absorbed wholesale into CS024 P6b (the
drivers-only-wrap rule and the UFO step-count restage). CS024 P7 archived them
with SUPERSEDED banners. **This document is a fresh changeset that reuses the
free number**, and it has nothing to do with the odometer.

**Paul renamed the archived pair with an `-old` suffix before CS025 P0**, so the
two plans no longer share a basename. That is the disambiguation, and it is
stronger than relying on the directory alone — but **the rename orphaned every
reference written before it**, and P0 owns the sweep (§0.4).

**Do not delete or re-rename the archived pair.** `DIFFICULTY-LEVERS.md` §2
cites it as the record of *why* drivers-only-wrap exists — evidence gathered by
plotting the lever tables level by level rather than reading them — and that
citation must keep resolving. A session that finds two CS025 specs and "tidies"
one away destroys the only written account of that finding.

Root = live CS025. `archive/…-old.md` = the abandoned odometer plan.

### 0.4 ⛔ THE `-old` RENAME ORPHANED SEVEN REFERENCES, AND THREE OF THEM NOW POINT AT THE WRONG LIVE FILE

Greped at `cd4d946`. **The dangerous ones carry neither a path nor a `.md`
extension.** Before the rename they were merely terse; now they resolve to
*this* document, which says nothing about levers — so a session following one
concludes the reference is stale rather than misdirected, which is the worse
failure of the two.

**Repoint these five (P0 owns it):**

| Location | Current text | Why it matters |
|---|---|---|
| `asteroids-deluxe.html`, the `ONLY DRIVERS MAY WRAP` comment above the odometer guard | `PLANNED-FEATURES-CS025 §1` | **bare** — now points at this doc |
| `scratchpad/test-cs024-p6b.js`, header comment | `PLANNED-FEATURES-CS025 §1` | **bare** |
| `scratchpad/test-cs024-p6b.js`, at the UFO table pin | `PLANNED-FEATURES-CS025 §2's table, verbatim` | **bare, and load-bearing** — the anchor for a pinned nine-lever table |
| `DIFFICULTY-LEVERS.md` §2 | `archive/PLANNED-FEATURES-CS025.md` §0 | a broken path in a **living** document |
| `GDD-VERSION-HISTORY.md`, CS024 entry | `archive/PLANNED-FEATURES-CS025.md` §1 | broken path; append-only file, see below |

All five become `archive/PLANNED-FEATURES-CS025-old.md`. **Give the three bare
ones a path and an extension** — terseness is exactly what made them fragile.

**Do NOT rewrite `STATUS.md`'s nine historical mentions**, nor the two in the
archived `IMPLEMENTATION-PHASES-CS024.md`. A historical entry records what was
true when it was written — one of them is the entry recording the archiving
action itself — and editing nine paragraphs of history to chase a filename
falsifies the record for no gain. Add **one** disambiguating note instead: one
edit rather than nine.

**Opening `GDD-VERSION-HISTORY.md` is a deliberate exception, not an oversight.**
That file is append-only by convention and never read for context. But this is a
one-token path correction inside an existing entry, not a change to what the
entry claims — the difference between repairing a citation and editing history.
Do it, and record in `STATUS.md` that the append-only file was opened for a path
repair, so the exception is on the record rather than discovered later as a
convention breach.

**No test asserts either filename programmatically** — the only two `archive`
mentions anywhere in `scratchpad/` are prose comments in `test-cs024-p4.js` and
`test-cs024-p6f.js`, both describing what a doc-sweep phase does. Neither
breaks. Verified by grep, not assumed.

### 0.2 What CS025 is NOT

**The half-strength "Mega Delivery" at levels 6–11 (Gate B Q13) is NOT in this
changeset.** `STATUS.md`'s `## Next up` currently names it as "the next
changeset's opening scope"; that is now **deferred to CS026** by Paul's explicit
decision. P0 re-files that note so it does not read as unfinished CS025 work.
Everything CS024 P7 recorded about it stands and should be read when CS026 is
specced: three of the SMD's four effects halve cleanly and one (the board sweep)
does not, `SWEEP_POWERUP_CAP` (48) is deliberately not a debug knob, and the
level-6 trigger threshold is an inference (`payloadSlots(6)` = 12, exactly half
the 24 that fires an SMD), not a stated design.

Also out of scope, carried forward unchanged: the spatial grid for
`coalesceGarbage()`, and the music-intensity composition changeset.

### 0.3 Verification performed for this spec

Against a fresh `--depth 1` clone of `cd4d946`:

| Check | Value |
|---|---|
| HEAD | `cd4d946` — *cs-24 p7: retune, version 1.0.0.24, doc sweep — CS024 complete* |
| `GAME_VERSION` | `"1.0.0.24"` (the only other `1.0.0.22` occurrence is the tombstone comment above the constant) |
| Root planning docs | `PLANNED-FEATURES-CS024.md`, `IMPLEMENTATION-PHASES-CS024.md` |
| Debug registry | **72** rows = 21 explicit `{ id: … }` + 51 lever rows, nine headers |
| Test files | 95 in `scratchpad/` |

**Every anchor in this document is a symbol, never a line number. Grep before
you edit.** Line numbers drift between sessions; several are quoted below as
*approximate orientation only* and are marked as such.

---

## §1 — Magnet suppression at full cargo

### 1.1 The defect

With the Magnet active and the tow chain at `game.cargoMax`, garbage keeps being
pulled toward the ship but has nowhere to go — the pickup gate
(`game.chain.length < game.cargoMax`) blocks every hook. Pieces accumulate and
loiter on top of the ship. Because garbage-to-garbage coalescence
(`GARBAGE_MAGNET_RANGE` 160 px / `GARBAGE_MAGNET_PULL` 30 px/s²) is a **separate
system that keeps running**, that loitering cloud reaches
`HUNTER_COALESCE_COUNT` (12) and converts into a Hunter *at the player's
position*, which then immediately collides with the ship.

### 1.2 The rule

**While the tow chain is full, the Magnet's attraction is inactive. It resumes
`DEBUG.magnetResumeDelay` seconds (default 0.25 s) after a cargo slot opens.
The powerup's budget is untouched throughout — suppression neither spends nor
refunds a single use.**

### 1.3 The mechanism — DERIVED, not hooked at five sites

Five things can free a cargo slot, and **one of them is easy to miss**:

1. `game.chain.pop()` in the dock offload block
2. `breakChain()` (`chain.length = i`)
3. `scatterChain()` (ship death)
4. `game.chain = []` in `startGame()`
5. **`game.cargoMax = payloadSlots(game.wave)` in `nextWave()`** — a level-up
   grows the cap, so a *full* 8-load at L4 becomes a *not-full* 8-of-10 load at
   L5 with no delivery and no pickup at all.

Hooking all five is five chances to miss one, and (5) would certainly have been
missed. **Do not hook any of them.** The condition is a per-frame read, in the
`saturatedClump()` derived-not-stored idiom:

```js
const cargoFull = game.chain.length >= game.cargoMax;
if (cargoFull) game.magnetHoldT = DEBUG.magnetResumeDelay;
else if (game.magnetHoldT > 0) game.magnetHoldT = Math.max(0, game.magnetHoldT - dt);
```

`game.magnetHoldT` is the **only** new state, it has exactly **one writer**, and
it covers all five sources automatically. It ticks on `dt` (game time), so it
freezes with a pause like every other in-game timer.

**The public read is a function, not a local const**, because `Ship.draw()`
needs the same answer (§3) and runs in `draw()`, not `update()`:

```js
function magnetPulling() {          // pure read; no dt, no writes
  return powerActive("magnet") && game.magnetHoldT <= 0;
}
```

### 1.4 ⛔ THE TRAP: ONE FLAG CURRENTLY FEEDS THREE CONSUMERS, AND ONLY TWO OF THEM MOVE

At the top of `update()`'s pickup block sits a single
`const magnet = powerActive("magnet")`, and **three different things read it**:

| Consumer | After CS025 | Why |
|---|---|---|
| the attraction force | `magnetPulling()` | this is the whole feature |
| `pickR` (the 1.6× `MAGNET_PICKUP_MULT` circle) | `magnetPulling()` | FORK-1 resolved: the widened circle comes back **with** the pull, not before it |
| the budget spend at the hook (**two sites**: the single-hook `powerBudget.magnet--` and the clump-scoop `Math.max(0, … - take)`) | **`powerActive("magnet")` — UNCHANGED** | see below |

**Repointing the budget sites at `magnetPulling()` would hand out free hooks.**
During the 0.25 s resume delay the pull is off but the *base* `GARBAGE_PICKUP`
circle is still live, so a piece drifting into it is genuinely hooked. If the
spend were gated on the suppressed flag, that hook would cost nothing — turning
"the magnet is inactive while full" into "the magnet gains free uses whenever
you fill up," which is the opposite of preserving its number of uses.

So this phase **splits one name into two** and the budget sites keep reading the
raw one. That split is the single most important edit in P1.

### 1.5 Consequences accepted

- **The suppression alone does not disperse a cloud that has already gathered.**
  Pieces already inbound keep their velocity, and `MAGNET_DAMP` lives *inside*
  the attraction branch, so the light in-range damping stops too. §2 is the
  answer to this, and the two features ship together for that reason.
- **`powerActive("magnet")` is untouched**, so the HUD row, the banking pop, the
  `expire_magnet` falling-edge latch and `game.powerVoiced.magnet` all behave
  exactly as they do today. Suppression is invisible to the powerup machinery.
- **The player's tell for suppression is the scoop glow going dark** (§3, FORK-7
  resolved). There is deliberately no HUD change.

---

## §2 — The repulsion kick

### 2.1 The rule

**On the frame the tow chain becomes full while the Magnet is active, every
garbage piece within `MAGNET_RANGE` is pushed outward from the ship on a
randomly-fanned vector, and has its `coalesceDelay` re-armed.**

### 2.2 Precedent — this shape already ships twice

`shatterClump()` and the scoop-leftover respill both do exactly *outward kick
plus a re-armed `coalesceDelay`*, and `shatterClump`'s own comment states the
reason: "a full re-armed `coalesceDelay` (so the burst disperses before it can
start re-clumping)." This phase is a third instance of a shipped idiom, not a
new mechanic shape.

**The re-arm is what actually solves the defect, and the velocity is what makes
it legible.** Conversion to a Hunter happens at exactly one place — the merge
branch in `coalesceGarbage()`, which requires `a.coalesceDelay <= 0 &&
b.coalesceDelay <= 0` on **both** sides — plus `drainHeldClumps()` for clumps
already at 12. A piece with a re-armed inert window cannot merge at all,
whichever direction it happens to be drifting. Kick alone would leave dispersal
to momentum and to luck.

**FORK-15 resolved, and its cost is accepted on the record.** Filling cargo now
resets the coalescence clock on every nearby piece, which makes it a deliberate
defensive tool: park in a debris field with the Magnet up, let cargo fill, and
the cloud's clock resets. At level 1 that is a 5.0 s reset per fill (the
`coalescePause` lever's floor). The cycle costs a full dock run each time, which
is the game asking the player to do the thing it wants, so the loop is **not**
treated as an exploit. Gate question Q5 watches it anyway.

### 2.3 The edge detector — an explicit flag, deliberately not inferred

The kick must fire **once** per fill, on the rising edge. Parking at full must
not re-fire it; refilling after a delivery must.

It is tempting to infer the edge from `game.magnetHoldT < DEBUG.magnetResumeDelay`
(true only on the first full frame, since the write pins it at the delay
thereafter). **Do not.** That inference breaks the moment someone drags the
`magnetResumeDelay` slider *upward while parked at full* — the timer would read
below the new value and the kick would re-fire, at the gate, on the exact
session where the knob is being tuned. Use a plain stored boolean,
`game.cargoWasFull`, written once at the end of the block.

Order within the block is load-bearing:

```js
const cargoFull = game.chain.length >= game.cargoMax;
if (cargoFull && !game.cargoWasFull && powerActive("magnet")) magnetPushBurst();
if (cargoFull) game.magnetHoldT = DEBUG.magnetResumeDelay;
else if (game.magnetHoldT > 0) game.magnetHoldT = Math.max(0, game.magnetHoldT - dt);
game.cargoWasFull = cargoFull;
```

The gate is `powerActive("magnet")`, not `magnetPulling()` — at the instant of
the rising edge the hold timer has not yet been set, so the two agree; using the
raw predicate says plainly that this is a *magnet* mechanic and not a general
cargo-full effect. It is not a cargo-full effect: with no Magnet running there
is no gathered cloud to disperse.

### 2.4 `magnetPushBurst()`

```js
function magnetPushBurst() {
  for (const g of game.garbage) {
    if (g.dead) continue;
    if (dist2(g, game.ship) >= MAGNET_RANGE * MAGNET_RANGE) continue;
    const [dx, dy] = shortDelta(game.ship.x, game.ship.y, g.x, g.y); // ship -> piece = OUTWARD
    const d = Math.hypot(dx, dy);
    const base = d > 1e-4 ? Math.atan2(dy, dx) : rand(0, TAU);
    const a = base + rand(-1, 1) * DEBUG.magnetPushSpread * Math.PI / 180;
    const kick = DEBUG.magnetPushKick / Math.sqrt(g.mass);
    g.vx += Math.cos(a) * kick;
    g.vy += Math.sin(a) * kick;
    g.coalesceDelay = liveLevers(game.wave).coalescePause;
  }
}
```

Every line above is load-bearing:

- **`shortDelta`, not subtraction.** The world is toroidal and the Magnet's
  380 px reach crosses the seam constantly. This is CLAUDE.md's most-cited bug
  source.
- **`+=`, not `=`.** An impulse, not a teleport — momentum is preserved
  (Pillar 2), exactly as the pull itself is a velocity nudge.
- **`/ Math.sqrt(g.mass)`.** The pull already divides its accel by `√mass`; the
  push mirrors it, so a mass-11 clump gets shoved at ~30% of a single's speed
  and the "heavy clumps are slow anchors" identity survives in both directions.
  A mass-1 single is unaffected (√1 = 1).
- **`rand(-1, 1) × spread`** is a **half-angle in degrees**, per piece. At 0 the
  burst is a coherent radial shell; at 180 the directions are fully random. This
  is FORK-17's "different directions."
- **The `d > 1e-4` guard.** A piece sitting exactly on the ship's centre has no
  outward direction; `atan2(0,0)` returns 0 and would push it dead +x. A random
  angle is the honest answer, and this is precisely the case the defect
  produces.
- **`liveLevers`, not `leverState`.** Every consumer reads `liveLevers` so the
  debug panel's floor/ceil/steps rows are folded in. `leverState` has no in-game
  caller by design.

### 2.5 Placement and cost

Called from inside `update()`'s pickup block, **before** the garbage loop, so
the kicked velocities are integrated on this frame's own `g.update(dt)` and the
re-armed delays are already in place when `coalesceGarbage()` runs later in the
same frame.

**O(n) over `game.garbage`, once per fill event** — not per frame. Against the
`GARBAGE_SOFT_MAX` 220 ceiling that is at most 220 visits at the moment of a
fill, against a per-frame budget that already absorbs `coalesceGarbage()`'s
24,090 pair visits. It does not move the frame budget and no ceiling changes.

### 2.6 Saturated and held clumps are kicked, deliberately

A held 12-piece clump (CS024 P6f) is ordinary salvage in every respect except
absorption, and shoving a *pending Hunter* away from the ship is the most
valuable thing this burst does. Re-arming its `coalesceDelay` is **inert** — the
pair walk already skips it via `saturatedClump()`, and its conversion runs
through `drainHeldClumps()`, which reads no delay. That is fine and needs **no
special case**. Recorded here so a future session does not add one, and so
nobody reads the inert write as a bug.

---

## §3 — The scoop energy tell

### 3.1 The rule

**While the Magnet is actively pulling, the ship's scoop strokes in
`POWERUP_COLOR.magnet` at a wider width and a bigger glow blur. At
`scoopLevel` 0 — where there is no scoop to light — a small fixed-size V at the
nose carries the same energy instead.**

### 3.2 What it means — FORK-7 resolved

The glow reads **`magnetPulling()`**, not `powerActive("magnet")`. It is
therefore the free, diegetic tell for §1: the scoop goes dark the instant cargo
fills, and lights again `magnetResumeDelay` after a slot opens.

This is one transition per fill, not a flicker. During a dock offload the chain
drains monotonically one node per `offloadTimer`, so the ship goes not-full once
and stays not-full.

### 3.3 The rendering change

`drawPoly()` currently hardcodes `glowStroke(color)` and offers no way to reach
`glowStroke`'s `width`/`blur` parameters. **Append two optional parameters
rather than opening a bespoke draw path in `Ship.draw()`:**

```js
function drawPoly(points, x, y, angle, color, closed = true, width, blur) {
  …
  glowStroke(color, width, blur);
  …
}
```

**They are deliberately left `undefined` rather than given literal defaults.**
Passing `undefined` through triggers `glowStroke`'s own `width = 1.6, blur = 10`
defaults, so **every one of the existing callers is byte-identical** and the
defaults live in exactly one place. Duplicating `1.6`/`10` into `drawPoly`'s
signature would create a second source of truth that a future `glowStroke`
retune would silently desync.

This keeps CLAUDE.md's "rendering goes through `drawPoly` + `glowStroke`" rule
intact — the alternative was a hand-rolled `beginPath`/`glowStroke` in
`Ship.draw()`, which is the first step toward a per-entity draw pipeline.

### 3.4 `Ship.draw()`

Inside the existing `if (!blink)` block, replacing the current
`if (game.scoopLevel > 0)` arm:

- **`scoopLevel > 0`:** same geometry as today — `[[d,-hw],[16,0],[d,hw]]`,
  `hw = SCOOP_WIDTH[lvl]/2`, `d = SCOOP_DEPTH[lvl]`, corners derived, no fill —
  but the colour becomes `magnetPulling() ? POWERUP_COLOR.magnet : COLOR.dock`,
  and while pulling it passes `SCOOP_MAGNET_W` / `SCOOP_MAGNET_BLUR`.
- **`scoopLevel === 0` and pulling:** the same V shape at a fixed small size —
  `hw = SCOOP_MAGNET_NOSE_W/2`, `d = SCOOP_MAGNET_NOSE_D` — in
  `POWERUP_COLOR.magnet` at the same width/blur. It reads as "the scoop you do
  not have yet, glowing." Nothing is drawn at level 0 when not pulling, exactly
  as today.

Four new look-call constants, in the Powerups block beside the other
`SCOOP_*` entries:

| Constant | Value | Note |
|---|---|---|
| `SCOOP_MAGNET_W` | 2.6 | vs `glowStroke`'s default 1.6 |
| `SCOOP_MAGNET_BLUR` | 18 | vs the default 10 |
| `SCOOP_MAGNET_NOSE_W` | 10 | ~half of level 1's 21.6 px mouth |
| `SCOOP_MAGNET_NOSE_D` | 22 | just forward of the nose at (16, 0) |

**All four are LOOK-CALLS, tuned by eye, and deliberately NOT debug knobs** —
the standing convention for presentation values (`HELD_CLUMP_RING_PAD`,
`GUARD_CHAIN_WIDTH`/`_BLUR`). Gate question Q4 is where they get re-picked.

### 3.5 ⛔ THIS DOES NOT REOPEN THE V-VS-BOX QUESTION

GDD §2.14.1's render bullet carries an explicit warning: the scoop render has
been rewritten three times across two supersessions (V → box → V), and a future
session tempted to "fix" it back to the box must ask Paul first.

**CS025 changes colour, stroke width and blur. The geometry is untouched, the
no-fill rule is untouched, and `inScoopBox()`'s capture math is untouched.** The
V-vs-box trade is not re-decided and must not be. P5's doc sweep says so in the
GDD itself rather than only here.

### 3.6 Static, not pulsing — FLAG-8 resolved

Static-bright. The `HUD_PULSE_HZ` flat pulse is already spoken for as the
non-HP alarm rate (held-clump ring, cargo gold), and a third pulsing thing at
the same rate would dilute all three.

---

## §4 — Critical voice lines

### 4.1 ⛔ THIS OVERTURNS A DOCUMENTED NON-NEGOTIABLE, WITH PAUL'S EXPLICIT SIGN-OFF

**"Superseded lines DROP, never queue"** is asserted in four places, with the
stated reason "a queue would have Dan narrating events that finished ten seconds
ago — worse than silence":

1. `CLAUDE.md` — VoiceSys non-negotiable **(3)**
2. `ORBITAL-OVERHAUL-GDD.md` §2.8 — the *Cooldown & priority (§11e)* bullet
3. `ORBITAL-OVERHAUL-GDD.md` §2.8 — the *Captions (CS011 P2)* bullet
   ("a caption obeys the identical drop-not-queue/pre-empt rule")
4. `ORBITAL-OVERHAUL-GDD.md` §3 — the Architecture Map's VoiceSys row

**Paul has signed off on overturning it.** All four are rewritten in P5. This is
recorded as a Correction (§6) rather than a silent edit, and the rewrite must
say *what the old rule got right* — see §4.6.

### 4.2 The defect, which has two distinct causes

`_emit`'s gate has **two** drop paths and only one of them checks priority:

```js
if (now < this.busyUntil) {              // a line is on the channel
  if (p <= this.curPriority) return null; // equal/lower → DROP
  // higher → fall through and pre-empt
} else if (now < this.busyUntil + VOICE_COOLDOWN) {
  return null;                            // ⛔ PRIORITY-BLIND
}
```

- **Cause 1 — priority.** `cargo_full` is priority **1** (the default; it is not
  in `VOICE_PRIORITY` at all), so *any* line in flight drops it.
- **Cause 2 — the cooldown gap, and this one is easy to miss.** The second
  branch drops unconditionally. **Even `health_low` at priority 3 is silently
  eaten inside the 1.2 s post-line gap.** No priority in the system can
  currently survive that window.

Both are fixed. Fixing only the first would leave `health_low` still losable.

### 4.3 The critical set — orthogonal to priority

```js
const VOICE_CRITICAL = { health_low: true, health_relief: true, cargo_full: true };
const VOICE_QUEUE_MAX = 3;
```

**`VOICE_PRIORITY` is not touched. `cargo_full` stays priority 1.** Raising it
to 3 to make it "critical" would also give it the power to *pre-empt* the health
tier — a truck-full bark cutting off "hull integrity is critical" is exactly
backwards. Criticality answers "may this line wait?"; priority answers "may this
line interrupt?" They are different questions and get different tables.

### 4.4 The four rule changes

**(a) A critical line that would be dropped as equal/lower priority is QUEUED
instead.** In the busy branch only.

**(b) Pre-emption is UNCHANGED — FORK-10 resolved.** `health_low` at priority 3
still pre-empts anything at priority ≤ 2, today and after this phase. The queue
is purely additive: it catches lines that would currently be **dropped**, and
changes nothing about lines that currently **speak**. Making criticals "always
wait" would have made `health_low` *slower* than it is now — a regression on the
single most urgent line in the game.

**(c) Criticals are exempt from the post-line cooldown gap — FORK-11 resolved.**
In the second branch, a critical falls through and speaks immediately rather
than being dropped. `VOICE_COOLDOWN` is an anti-chatter aesthetic; these three
lines are not chatter. A queued critical therefore fires the moment the blocking
line ends, with no 1.2 s tail — which is what "as soon as the blocking line
finishes" means.

**(d) A queued line is RE-VALIDATED at drain time — FORK-12 resolved (option c).**

```js
const VOICE_STILL_TRUE = {
  health_low:    () => game.ship.hp <= LOW_HP_THRESHOLD && !game.ship.dead,
  health_relief: () => game.ship.hp >  LOW_HP_THRESHOLD && !game.ship.dead,
  cargo_full:    () => game.chain.length >= game.cargoMax,
};
```

**Each predicate is its own trigger's condition, restated.** `health_low` mirrors
the rising-edge test; `cargo_full` mirrors the pickup gate; `health_relief`
mirrors the falling edge **including its `!game.ship.dead` guard**, which GDD
§2.12 calls load-bearing — without it the relief line could speak over the
player's death, the precise failure that guard exists to prevent. A queue makes
that failure *more* reachable, not less, so the mirroring is deliberate.

A line failing its predicate is **discarded silently**, not spoken late. This is
what makes the old rule's concern addressed rather than merely overridden.

### 4.5 The queue and the drain

```js
_enqueue(event, line, p) {
  if (this.queue.some(q => q.event === event)) return;   // dedupe by event
  if (this.queue.length >= VOICE_QUEUE_MAX) return;
  this.queue.push({ event, line, p });
}
```

**FIFO, capped at 3, deduped by event.** With three critical events and dedupe,
the cap is structurally unreachable today — it is a guard for the day a fourth
critical event is added without anyone thinking about depth. Say so at the site.

The line is picked at **trigger** time (`say()` already did the random pick
before calling `_emit`), not at drain time. One less thing to be inconsistent
about.

**`VoiceSys` has no per-frame tick and needs one**, because nothing calls
`_emit` when the channel is idle, so a queued line would otherwise never fire:

```js
update() {                                    // NO dt parameter — see below
  if (!AudioSys.ctx || !this.queue.length) return;
  if (AudioSys.now() < this.busyUntil) return;      // still speaking — wait
  const q = this.queue.shift();
  const still = VOICE_STILL_TRUE[q.event];
  if (still && !still()) return;                    // stale — discard
  this._emit(q.line, q.p, q.event);
}
```

- **It takes no `dt`, and that is a consequence of choosing re-validation over a
  TTL.** A TTL would have had to tick on the game clock while `busyUntil` lives
  on the audio clock (`ctx.currentTime`, which does not pause) — a clock
  mismatch that would have expired queued lines during a long pause. Option (c)
  removes the hazard entirely rather than managing it. Worth knowing if anyone
  later proposes adding a TTL "as well."
- **One drain per frame.** Draining a second is pointless: the first advanced
  `busyUntil` past now.
- **The `now >= busyUntil` guard makes `_emit`'s busy branch unreachable from
  the drain**, so a drained line can never re-queue itself. Assert this
  positively; it is the one shape that could loop.
- **Called from the very end of `update()`'s playing body**, after every pass
  that can call `say()`. It therefore does not run while paused, during the
  `dying` spectacle, or on any menu — which is also why **no new teardown site
  is needed**: the queue cannot drain outside play, and `VoiceSys.reset()`
  (called from `startGame()`) clears it. Add `this.queue.length = 0` there.

### 4.6 Why the old rule was right, and what was wrong with it

The rule was **over-broad, not wrong**. Its concern — Dan narrating a dead event
— is real, and §4.4(d) is what answers it: a queued line is spoken only if its
own triggering condition is *still true*. What the rule got wrong was applying
that concern uniformly to a channel where a priority-1 line
(`cargo_full`) could not win a contest against *anything*, and where even a
priority-3 line was eaten priority-blind by the cooldown gap. The fix is not
"queue everything"; it is "three named lines may wait, and only while they are
still true."

P5's rewrite of all four passages must carry that reasoning, not just the new
behaviour.

### 4.7 No new phon strings — the voice-line gate does NOT apply

**This changeset composes no new `VOICE_LINES` entries.** `health_low`,
`health_relief` and `cargo_full` all already ship with verified phon strings.
The standing non-negotiable — phon must be composed and zero-error-verified in
`tools/voice-robot-lab.html` before Claude Code touches `VOICE_LINES` — is
**not triggered**, because `VOICE_LINES` is not edited at all. Stated explicitly
so a session does not believe itself blocked on a gate that does not apply.

### 4.8 A latch question that resolved itself

`game.lowHpVoiced = true` is set unconditionally at the call site, even when the
line is dropped. That looked like it would strand an episode if a queued
`health_low` were later discarded — but the discard condition (`hp` back above
`LOW_HP_THRESHOLD`) is *the same edge* that already sets `lowHpVoiced = false`
in the falling-edge branch. The latch self-heals and **needs no change**.

If the ship dies with a `health_low` queued, the predicate discards it and the
latch stays armed — but the run is over and `startGame()` resets it. Correct in
both directions. Recorded because it was flagged as a likely constraint and the
resolution made it moot; do not "fix" it.

### 4.9 The existing tests should pass UNMODIFIED — verify, do not assume

`test-cs010-p9.js` §D and `test-cs011-p2.js` §D are the two files that assert
drop-not-queue directly. Every one of their drop assertions fires on
`collect_rapid` / `collect_triple` (non-critical) or on a bare `_emit` with no
event at all (also non-critical); the one `health_low` call in §D is the
**pre-empt** case, which §4.4(b) preserves exactly. **Both files should pass
byte-identically.**

This is a *prediction*, and it is the strongest available evidence that the new
rule is genuinely additive rather than a behaviour change wearing a feature's
clothes. **Run them before writing any new test and report the result either
way.** If either fails, stop and surface it — an unexpected failure there means
the change is broader than this spec believes.

---

## §5 — Debug registry additions

Three new knobs, all in the **POWERUPS** section, appended after
`engineMassMult`. Registry **72 → 75**.

| id | Label | Unit | def | min | max | step | Notes |
|---|---|---|---|---|---|---|---|
| `magnetResumeDelay` | `Magnet resume delay` | `ms` | 250 | 0 | 3000 | 50 | `toNative: v => v / 1000` |
| `magnetPushKick` | `Magnet full-cargo push` | `px/s` | 120 | 0 | 600 | 10 | 0 disables the kick outright — the A/B for Q2 |
| `magnetPushSpread` | `Magnet push spread` | `°` | 45 | 0 | 180 | 5 | half-angle; 0 = coherent shell, 180 = fully random |

**`magnetResumeDelay` uses the `ms` + `toNative` idiom** established by
`autoShieldRegenPause` and `dockComboGrace`: the panel shows and persists
milliseconds, the consumer reads seconds. No shipped constant backs it — a
resume delay has no meaning outside the knob, so the registry entry **is** the
source of truth for its default, following the `chainGuardIntercepts` idiom.

**Two knobs for the kick, not one (FLAG-18).** Speed and fan-out are
independently wrong-feeling in different ways and one slider cannot separate
them: a burst that is too fast and a burst that is too narrow both read as "that
felt wrong," and the gate needs to come back with two numbers.

**None of the three is a lever.** No floor/ceil/steps triple, no `▼`/`↳` glyph,
no `carriesTo`, no `LEVERS` entry. `DIFFICULTY-LEVERS.md` §4's not-a-lever table
gains a row saying so, in the same commit — the standing rule.

Inserting into POWERUPS shifts the GLOBAL rows' indices below it. **That is
expected and is established practice** (CS024 P6f appended three knobs into the
middle of HUNTER). The registry's append-only discipline is about ids and
persistence, not about absolute row index.

**Persistence needs no code change at all.** All three are ordinary
`DEBUG_ENTRIES` rows and round-trip through the existing generic
`saveSettings`/`loadSettings` path in `afd_settings_v1.debug`. No schema bump,
no new key, no migration shim.

---

## §6 — Corrections

Corrections to prior documented decisions, recorded so a future session finds
the reversal *and* the reasoning.

**C1 — "Superseded lines DROP, never queue" is narrowed, not deleted.**
Three named lines may now wait. See §4.6 for what the rule got right and what it
got wrong. Four passages rewritten in P5; the rewrite must carry the reasoning,
not only the behaviour.

**C2 — `drawPoly()` gains two optional parameters.** The helper had a fixed
stroke weight since it was written. The addition is byte-identical for all
existing callers by construction (§3.3), and the defaults deliberately stay in
`glowStroke` rather than being duplicated.

**C3 — The scoop render's colour is now conditional; its geometry is not.**
GDD §2.14.1's V-vs-box warning stands entirely (§3.5). This correction exists so
that a session reading "CS025 changed the scoop render" does not conclude the
geometry question was reopened.

**C4 — `STATUS.md`'s "next changeset's opening scope" is re-filed.** The
half-strength Mega Delivery moves from *CS025 scope* to *CS026 scope* (§0.2).
P0 owns the edit.

---

## §7 — ⛔ THE PLAYTEST GATE (blocking; sits between P4 and P5)

Five questions. **Report the number you landed on, not a yes/no**, for anything
driven by a slider — Gate A's three numbers all shipped verbatim, and Gate B's
one number did too. **"Fine" is a complete answer**; a clean gate means P5 is
bump-and-sweep only, which has now happened three times (CS020 P2, CS022 P4,
CS024 P7). Do not manufacture changes to justify the gate.

**What to play:** enough levels to hold a **full cargo** repeatedly with a
Magnet running — so at least to the point where `payloadSlots` has grown and the
field is dense. Levels **1 → 12** is sufficient for everything here; this
changeset touches nothing level-scaled, so there is no reason to reach 45.
`startLevel` (GLOBAL) can jump you, remembering it gives a level-N field with a
level-1 ship — **no scoop upgrades and no banked powerups**, which makes it the
wrong tool for Q3 and Q4 specifically. Those two need a real played-through run.

**Q1 — the resume delay.** Fill cargo with the Magnet up, deliver one canister,
and feel the moment the pull returns. Is **250 ms** right — long enough that
the field does not snap back onto you mid-offload, short enough that it never
feels broken? Slider: `Magnet resume delay` (POWERUPS). **Report the number.**

**Q2 — the push, two numbers.** `Magnet push kick` (default **120 px/s**) and
`Magnet push spread` (default **45°**). Set the kick to **0** for the clean A/B
— that disables the burst entirely and leaves only §1's suppression, which is
the honest way to judge whether the push is earning its place. Then: does the
cloud read as being *shoved off* you, or as quietly switching off? Is the fan
wide enough to look like scattering rather than a shell expanding? **Report both
numbers.**

**Q3 — does the Hunter-on-top-of-you problem actually go away?** This is the
changeset's central bet and the only question that can invalidate it. Park in a
dense field with a Magnet, fill cargo, and stay there. Does a Hunter still
coalesce on top of the ship? A Hunter forming *nearby* after the pieces have
drifted apart is the system working; one forming *on you* is not.

**Q4 — the scoop energy tell.** Two parts. **(a)** Does the magnet-blue
(`POWERUP_COLOR.magnet`, `#8ab6ff`) read as *charged*, or does it just read as
the hull? It sits close to `COLOR.ship` (`#9fd8ff`), and that is the specific
risk. **(b)** Does the tell *inform* — do you notice the scoop go dark when
cargo fills, and does that teach you the magnet has stopped? All four constants
(`SCOOP_MAGNET_W` 2.6, `_BLUR` 18, `_NOSE_W` 10, `_NOSE_D` 22) are look-calls
and can be changed freely; the hue itself is a real decision, so say if it
should move. Play at **scoopLevel 0** for at least a stretch — the nose V is a
different tell and is the one nobody has seen.

**Q5 — the defensive fill loop.** §2.2 accepts that filling cargo now resets
nearby coalescence clocks, making it a usable defensive move. Does that read as
a smart play the game is rewarding, or as an exploit you feel obliged to spam?
If it is the latter, the lever to reach for is `magnetPushKick` toward 0, not a
new rule.

**Q6 — the critical voice lines, and one specific failure to watch for.** Do
`health_low`, `health_relief` and `cargo_full` now reliably speak? And the thing
re-validation is supposed to prevent: does a `cargo_full` ever arrive so late
that it is confusing — after you have already started offloading? It should be
discarded rather than spoken in that case (§4.4d). **If you hear a stale one,
that is a bug, not a tuning question** — say so plainly and P5 inherits a fix it
does not currently carry.

---

## §8 — Out of scope, recorded so it is not rediscovered

- **The half-strength Mega Delivery (Gate B Q13)** — CS026 (§0.2).
- **A spatial grid for `coalesceGarbage()`** — carried since CS024. The pair-count
  budgets that conversation needs are in `DIFFICULTY-LEVERS.md` §5: 24,090
  visits/frame at 220, 44,850 at 300, ~99,900 at 450, ~500,000 at 1,000.
- **The music-intensity composition changeset** — deferred since CS017;
  research-first when it comes up.
- **The reusable menu/UI library extraction** — deferred post-CS014.
- **Any change to `powerActive()`, the powerup budgets, the HUD, or
  `POWERUP_DROP_TYPES`.** §1 deliberately routes around all of them.