# PLANNED FEATURES — CS019

**Changeset scope: one bug.** The Chain Guard powerup (CS017 P6–P7) drains its
count-mode budget at frame rate against a single sustained body contact, and
machine-guns its feedback tell in time mode. This changeset fixes that and
nothing else.

Base build: CS018 P10, `GAME_VERSION "1.0.0.18"`, commit `6928ff3`.
Target: `"1.0.0.19"`, bumped in **P2**.

---

## 1. The bug

### 1.1 What Paul observed

> "With the powerup set to last a certain number of saved chain pieces, it
> doesn't seem to work very long. It seems like maybe it only works on the
> pieces in the towed chain at the time the player acquires the powerup."

### 1.2 The hypothesis is falsifiable, and false

There is **no per-node guard state anywhere in the build**. Chain nodes are
plain object literals — `{x, y, px, py, spin, spinRate, mass}` — pushed in the
garbage-pickup block (`~L6101`, `~L6119`); no guard flag, no acquisition
timestamp, nothing that could distinguish an "old" node from a new one.
`drawChain` (`~L5884`) reads a single `powerActive("guard")` for the whole tow,
and `breakChain` (`~L5823`) tests the same single predicate before any index
math. A node scooped ten seconds after pickup is protected exactly as much as
node 0.

So the "only protects the pieces I had" read is a **symptom misattribution**.
The budget really is gone; it just isn't gone for that reason.

### 1.3 The actual root cause — absorb re-entry on sustained contact

`breakChain(i)`'s guard branch **returns without removing the node**:

```js
if (powerActive("guard")) {
  if (powerMode("guard") === "count") game.powerBudget.guard = Math.max(0, game.powerBudget.guard - 1);
  …sparks, floater, shieldPing, VoiceSys.say("chain_guard")…
  return; // no node severed, deliveryCount untouched — the load is byte-identical
}
```

That "byte-identical load" property is the correct behaviour and also the bug.
Consider the hazard-vs-chain scan (`~L6404`):

```js
chainScan:
for (let i = 0; i < game.chain.length; i++) {
  const n = game.chain[i];
  for (const h of chainHazards) {
    if (h.dead) continue;
    const r = h.radius + 7;
    if (dist2(n, h) < r * r) { breakChain(i); break chainScan; }
  }
}
```

- **Unguarded path:** node `i` is destroyed, everything aft is cut loose. The
  hazard is no longer overlapping *anything* — contact is self-terminating. One
  contact = one break. This is why the bug never showed up before CS017 P6.
- **Guarded path:** node `i` survives, in place, still inside `h.radius + 7`.
  The hazard is still there. **Next frame the identical test passes again**, and
  the frame after that, for as long as the two overlap.

Each of those frames is a full absorb: one budget decrement, seven particles, a
`FloatText`, a `shieldPing()`, a `VoiceSys.say()` attempt.

### 1.4 The numbers

`dt` is clamped at `0.05` (`~L7570`), so at 60 fps the scan runs ~60×/second and
at 144 fps ~144×/second — **the drain is frame-rate dependent.**

Contact duration for a straight pass through a node's centre, ship stationary:

| Hazard | radius | contact diameter (`2×(r+7)`) | typical speed | contact time | frames @60fps |
|---|---|---|---|---|---|
| Large debris | 46 | 106 px | ~70–90 px/s | ~1.2–1.5 s | **~72–90** |
| Medium debris | 26 | 66 px | ~110–140 px/s | ~0.5 s | **~30** |
| Large Hunter core | 24 | 62 px | 40.6 px/s | ~1.5 s | **~90** |
| Small Hunter (homing) | 10 | 34 px | 101.5 px/s | — *re-acquires* | **unbounded** |

Default `chainGuardIntercepts` is **3**. So the first hazard to graze the tow
consumes the entire budget in **three frames — 0.05 seconds** — and then keeps
going, because after the budget hits 0 `powerActive("guard")` is false and the
very next frame's identical test severs the chain normally.

From the seat, that reads exactly as Paul described: the guard is on, a piece of
junk touches the chain, the chain breaks anyway, and the HUD number went from 3
to 0 too fast to see. The homing-Hunter case is worse than the table — a small
Hunter that loses contact re-acquires and comes straight back, so it can burn a
10-intercept budget through repeated approaches inside a couple of seconds.

**Time mode is not immune.** The clock isn't drained (correct — it's a clock),
but the *tell* fires every frame: ~60 particle pushes/second into
`game.particles`, ~60 overlapping `"GUARDED"` floaters, ~60 `shieldPing()` calls
into Web Audio. `VoiceSys.say()` is the one thing that survives, because
`VOICE_COOLDOWN` (1.2 s) drops the repeats. The rest is a visual/audio smear
that also misreads as "the guard is broken."

### 1.5 The bullet path is fine

The other call site (`~L6358`) is `b.dead = true; breakChain(i); break;` — the
bullet is marked dead *before* the call and filtered at end of frame, so it can
never re-present. One bullet = one absorb, correctly. **No change needed there**,
and that asymmetry is the whole shape of the fix: the problem is bodies that
persist, not projectiles that don't.

---

## 2. The fix

**One idea: a hazard that has already paid for a contact may not present that
same contact again while the guard holds.**

Implemented as a per-hazard cooldown stamp, mirroring the shipped
`game.ship.invuln` i-frame idiom.

1. New knob `DEBUG.chainGuardCooldown` (seconds) — see FLAG-CS019-a.
2. `DebrisSatellite` and `HunterSatellite` each gain `this.guardT = 0` in the
   constructor, decremented toward 0 in their existing `update(dt)`.
3. `breakChain(i, src = null)` — second parameter is the *source* of the break.
   In the guard branch, after the spend and the tell, `if (src) src.guardT = DEBUG.chainGuardCooldown`.
4. The hazard-vs-chain scan skips a stamped hazard **while the guard is up**:
   ```js
   if (h.guardT > 0 && powerActive("guard")) continue;
   ```
5. The two call sites pass their source: `breakChain(i, b)` and `breakChain(i, h)`.

### 2.1 Why the skip goes in the scan and not in `breakChain`

Putting the cooldown test inside `breakChain`'s guard branch would work for the
common case but has a shadowing flaw: the scan `break chainScan`s on the *first*
overlapping pair it finds. A stamped hazard overlapping node 0 would consume the
scan's one slot every frame and hide a *different, unstamped* hazard genuinely
hitting node 5 for the whole cooldown window. Skipping in the inner loop lets the
scan keep looking. `breakChain` stays the single accounting choke point and its
call-site count stays at **exactly 2** (see §4, TRAP 1).

### 2.2 Why the skip is gated on `powerActive("guard")`

If the guard expires mid-contact — clock runs out, or the budget is spent on a
*different* hazard — a stamped hazard must be able to cut the chain immediately.
The `&& powerActive("guard")` clause guarantees that: guard down, no skip, normal
break on the very next frame. Without it, a stale stamp would grant free passage
through an unprotected chain.

### 2.3 `src = null` default is load-bearing

`scratchpad/test-cs017-p6.js` calls `C.breakChain(4)`, `D.breakChain(6)`,
`S.breakChain(6)` directly with one argument, including a
`while (S.powerActive("guard")) S.breakChain(6)` drain loop. With `src`
defaulting to `null`, those calls take the "no source, absorb and spend once"
path — behaviourally identical to today. **Those tests stay green untouched**,
and that is the correct semantic anyway: a break with no persistent source is a
one-shot event.

### 2.4 What this fixes, restated

- Count mode: 3 intercepts finally means *three distinct hostile events*, which
  is what the Options → Difficulty help line has claimed all along.
- Time mode: one absorb tell per contact instead of one per frame.
- Both modes: behaviour no longer depends on frame rate.

---

## 3. Forks

> **These two are resolved to my recommendation below so the P1 prompt is
> paste-ready. Flip either one and say so — each is a small, localised edit to
> the prompt, noted inline.**

### FORK-CS019-A — how does the contact end?

- **(a) ✅ RECOMMENDED — per-hazard absorb cooldown.** The hazard passes through
  the armoured chain unharmed and unimpeded; it just can't bill twice. Minimal
  surface, no physics perturbation, no new geometry.
- **(b) Absorb + deflect** — bounce the hazard off the chain, so contact ends
  physically and no cooldown is needed. Stronger visual read ("the tow is
  armoured"). **Rejected for now on three counts:** `shieldDeflect(obj)`
  (`~L5634`) is *not* reusable — it repositions the object relative to
  `game.ship`, spends ship shield energy, and increments `game.stats.deflects`
  (Shield Surfer), so this would need a new node-relative deflect function.
  Second, deflecting a large debris off a mid-chain node can fling it straight at
  the ship on a vector the player didn't cause. Third, **medium/small Hunters
  home** — a deflected Hunter re-acquires and is back in contact within a
  second, so (b) *still needs* (a) underneath it. If the read isn't strong
  enough after playtest, (b) becomes a clean follow-on changeset on top of this
  one.
- **(c) Absorb + destroy** — the guarded chain kills junk on contact. Turns a
  defensive powerup into an area weapon. Out of scope.

### FORK-CS019-B — what does one intercept cost?

- **(a) ✅ RECOMMENDED — one per absorbed break EVENT.** Unchanged from CS017's
  intent. The difficulty-screen help line already says "N blocked breaks," GDD
  §2.14.2 already documents "one spent per absorbed break," and after this fix
  that sentence is true for the first time.
- **(b) One per NODE that would have been severed** (`chain.length - i`) — this
  is the literal reading of "a certain number of saved chain pieces." **Rejected:**
  a hit on node 0 of a full 24-node tow would cost 24 charges against a max of 10,
  so the guard would be strictly weaker than it is *today* on exactly the haul it
  most needs to protect. It also makes the cost unpredictable from the player's
  side — the same hit costs 1 or 20 depending on where it lands.
  *If you want (b) anyway:* it's one line in P1 step (3) — change the decrement to
  `game.powerBudget.guard = Math.max(0, game.powerBudget.guard - (game.chain.length - i))`
  — plus the help-line and GDD wording, and the default/max in `DEBUG_VARS`
  would need a large bump to stay playable.

---

## 4. Flags

### FLAG-CS019-a — cooldown as a `DEBUG_VAR`, not a frozen const ✅

`{ id: "chainGuardCooldown", label: "Chain guard cooldown", unit: "s", def: 0.75, min: 0.1, max: 3, step: 0.05 }`,
appended under the existing `{ header: "CHAIN GUARD" }` group (`~L2658`). This is
precisely the number Paul will want to turn during playtest, and the CS017 P6
precedent is that all three chain-guard numbers are live knobs with the registry
entry as source of truth. `DEBUG_VARS` grows 15 → 16. No `toNative` (display =
native). Note the `step: 0.05` — the first sub-1.0 step in the registry; the
panel's numeric entry should handle it, but P1 must verify rather than assume.

**Why 0.75 s:** long enough to cover a medium-debris pass-through (~0.5 s) in one
charge; short enough that a hazard which drifts off and makes a genuinely new
approach several seconds later is billed again. Not long enough to matter as an
exploit — the guard's own duration is 30 s.

### FLAG-CS019-b — `chainGuardIntercepts` default 3 may now be too low

3 was chosen when an intercept was, unknowingly, worth ~1/60th of a second.
It now buys three real blocked hits. That may be right, or it may feel thin
against a 24-node haul. **Deliberately not changed in this changeset** — the max
is already 10, so Paul can find the number in the panel during the P1 playtest
and it becomes a one-line edit in P2. Changing it blind in the same phase that
changes the mechanic would confound the playtest.

### FLAG-CS019-c — non-guard behaviour must be byte-identical

With the guard **down**, `guardT` is set nowhere (only the absorb branch stamps
it) and the scan's skip clause short-circuits on `powerActive("guard")` being
false. A run with the powerup never picked up must be provably unchanged. This
is a required assertion in P1's test, not an assumption.

---

## 5. Retirement ledger

Nothing retires. No constant, field, or function is removed. The change is
additive: one `DEBUG_VARS` entry, two constructor fields, two `update()` lines,
one parameter, one guard-branch line, one scan-loop line, two call-site arguments.

---

## 6. Test plan (P1 owns this)

New `scratchpad/test-cs019-p1.js`, driving the **real** `startGame()` /
`update(1/60)` / `breakChain` / `applyPowerup` — nothing reimplemented.

**(A) Source pins.** `node --check`. `breakChain` still has exactly **one**
definition and exactly **two** call sites under `test-cs017-p6.js` §A's regex.
`chainGuardCooldown` present in `DEBUG_VARS` with the stated def/min/max/step and
no shadowing const. Both call sites pass a second argument.

**(B) THE REGRESSION — the whole point of the changeset.** Count mode,
`chainGuardIntercepts = 3`. Stage a large debris satellite **stationary and
overlapping** a mid-chain node, guard up, and drive **60 real `update(1/60)`
frames**. Assert: `game.powerBudget.guard === 2` (exactly one spent), the chain
length is unchanged, and exactly **one** `"GUARDED"` floater and **one**
`shieldPing()` were emitted across all 60 frames. *Against `HEAD` this test
asserts 2 and gets 0 by frame 4 — run it on the unfixed build first to confirm it
actually catches the bug.*

**(C) Time mode, same staging.** 60 frames, guard clock ticking normally, one
tell total, chain intact throughout, `powerFx.guard` decremented only by `dt`.

**(D) Cooldown expiry.** Same stationary overlap, `chainGuardCooldown = 0.2`,
`chainGuardIntercepts = 10`, 60 frames: assert the spend count equals
`ceil(1.0 / 0.2) = 5` (±1 for frame quantisation — assert a range, not an exact
integer, and say so in the message).

**(E) No shadowing.** Hazard H stamped on node 0, unstamped hazard K overlapping
node 5 in the same frame → K's hit is absorbed the same frame, not swallowed by
the `break chainScan`. This is the §2.1 property; it fails if the skip is put in
`breakChain` instead of the scan.

**(F) Guard-down passthrough (FLAG-CS019-c).** A stamped hazard with the guard
expired severs the chain on the next frame — `chain_broken` fires, `deliveryCount`
zeroes, the aft nodes become `Garbage`. And: a full run with no guard ever picked
up produces an identical break under a shared seeded RNG.

**(G) Budget exhaustion mid-contact.** `chainGuardIntercepts = 1`, stationary
overlap: frame 1 absorbs and stamps; the budget is now 0, so `powerActive("guard")`
is false, the skip does not apply, and frame 2 **severs**. Assert the chain
breaks on frame 2 — the stamp must not outlive the guard.

**(H) The bullet path is untouched.** A real hostile bullet on a mid-chain node,
guard up: exactly one absorb, one spend, `b.dead === true`, no `guardT` on the
bullet, no second absorb.

**(I) Headless safety.** `AudioSys.ctx = null` smoke through
`startGame`/`update`/`draw`/`breakChain`.

**Full regression required:** all 83 `scratchpad/test-*.js` files. Expect the five
known CS018 self-documented `GAME_VERSION` pins to be green at P1 (no bump this
phase) and to stay green — P1 does **not** bump the version.