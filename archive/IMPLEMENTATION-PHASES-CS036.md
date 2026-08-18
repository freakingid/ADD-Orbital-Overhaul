# IMPLEMENTATION-PHASES-CS036 — Orbital Overhaul

Execution order and paste-ready per-phase prompts. **Spec is `PLANNED-FEATURES-CS036.md`** —
read it, don't re-derive from here.

**One phase per Claude Code session. One commit per phase. Claude Code never pushes.**

Baseline: `a909d33` (build unchanged since `d8b82cf`), `GAME_VERSION = "1.0.0.35"`, registry **106** /
**10** headers, `LEVERS` **18**, `POWERUP_DROP_TYPES` **5**, suite **143 files / 140 passed / 3 failed
(pre-existing) / 0 skipped** on a full clone. Thirteen suite files hard-fail on a shallow clone — work
from a **full clone**, never `--depth 1`.

---

## Phase order

| Phase | What | Model | Effort | Registry | Blocks on |
|---|---|---|---|---|---|
| **P1** | The freeze primitive — `updateLevelEndFreeze()`, inert | **opus** | **xhigh** | +0 → 106 | — |
| **P2** | The completion hold — arm, announce, confirm; retire `levelEndHold` | **opus** | **xhigh** | −1 → **105** | P1 |
| **P3** | The freeze tail, the pulse restriction, the panel header | **opus** | **xhigh** | +0 → 105 | P2 |
| **P4** | Hunter heartbeat punch — bounds + defaults | sonnet | medium | +0 → 105 | — |
| **P5** | Dock ping cooldown + FLAG-CS034-e label | sonnet | medium | +1 → **106** | — |
| **P6** | Suite triage — the three red files + FLAG-CS031-c | **opus** | **max** | +0 → 106 | — |
| **GATE** | Blocking playtest | — | — | — | P1–P5 |
| **P7** | Closing: gate fold-in, version bump, doc sweep, log, archive | sonnet | high | — | GATE |

**Why this order.** P1–P3 are one feature cut into three testable pieces, and all three touch
`update()`'s control flow, which is the most load-bearing code in the build — they get Opus and their
own sessions. P1 builds the freeze and proves it in isolation *without any gameplay path setting it*,
so the risky part (what still runs during a freeze) is settled before anything depends on it. P2 arms
it and takes the input. P3 extends it across the wave boundary, which is the subtlest part and is much
easier to reason about once P2's seam is real. P4 and P5 are independent of the ceremony and of each
other. P6 is independent of everything and does not block the gate — but landing it before P7 means
the closing phase can assert a **fully green** suite for the first time since CS034.

⚠ **The registry count moves DOWN then UP.** P2 retires `levelEndHold` (106 → 105); P5 adds
`dockPingCooldown` (105 → 106). A phase between them that asserts 106 is wrong. The count lives only in
`scratchpad/test-registry.js`'s `COUNTS`, and P2 and P5 each update it.

## Reasoning effort

Five levels — **low · medium · high · xhigh · max** — set for the session, independent of the model.
Separately, ⛔ **`ultrathink` must appear inside the message text itself**; it is a per-turn lever, not
a session setting (CLAUDE.md, Model guidance), and every phase prompt below already carries it. Set
both.

**The rule of thumb this table uses:** effort buys *depth of reasoning*, not diligence. Raise it when
the phase has to work something out; a phase that is broad but fully specified needs care and a
checklist, not more thinking.

- **medium (P4, P5)** — the work is decided and written down. P4 picks numbers inside stated bounds;
  P5 adds one knob and changes one string. Both have real traps (the don't-mutate invariant, the
  both-places reset rule), but the traps are *named in the prompt*, so the phase has to follow rather
  than derive.
- **high (P7)** — broad and mechanical. Fold in numbers, bump a version, sweep five documents, write a
  log, reset STATUS. Lots of surface, little to work out — except deciding which gate answers are
  design decisions to defer rather than values to apply, which is the one judgement call in it.
- **xhigh (P1, P2, P3)** — all three cut into `update()`'s control flow, the most load-bearing code in
  the build, and each has to *reason* rather than follow. P1 decides what a frozen frame may still
  run and defends the choice against a shipped comment that says the opposite for a neighbouring
  state. P2 retires a registry row and moves achievement bookkeeping, then has to find every suite
  file pinning either. P3 is the subtlest in the changeset: two degenerate cases on knobs a player can
  drag, and ⛔ a re-derivation of CS035's banner-crossing edge whose answer nobody knows yet. **If you
  only raise effort on one of the three, make it P3.**
- **max (P6)** — the only phase whose *answer* is unknown at the start. Three tests have failed since
  CS035 P1 and nobody knows whether any of them is a real build defect; `test-v36-death`'s is a
  save-write question. Diagnosis with an open hypothesis space is exactly what the top of the range is
  for, and it is a cheap place to spend it — the phase touches no gameplay code.

**If you want to spend less:** P4, P5 and P7 will very likely be fine a notch lower (low / low /
medium). ⛔ Do not drop P1–P3 or P6 below the table — those four are where a wrong answer is expensive
and where a cheap session costs more in re-work than it saves.

---

# P1 — The freeze primitive

```
claude --model opus
# reasoning effort: xhigh
```

```
ultrathink

You are implementing PHASE 1 of changeset CS036 for Orbital Overhaul. Read CLAUDE.md, then STATUS.md,
then PLANNED-FEATURES-CS036.md §0.3 and §1. Build ONLY what this prompt scopes. Do not build ahead —
nothing in this phase arms the freeze, and P2 owns everything that does.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

## What this phase owns

The freeze PRIMITIVE, and nothing that uses it.

1. A new field on `game`: `levelEndFreeze: false`.
   - ⛔ Reset it in resetRun(), NOT nextWave(). The freeze will eventually span a wave boundary
     (P3), so it is in-flight state that must SURVIVE nextWave() — the same category as
     levelEndSafe/levelEndGraceT/levelEndPulseT. Add it to nextWave()'s standing ⛔ note beside those
     three.
   - ⛔ It is NOT game.paused. Setting that would satisfy menuActive() and drag in the whole menu
     chrome path — the same argument CS030 P5's celebration-panel comment already makes. Read that
     comment before you write this one.

2. `updateLevelEndFreeze(dt)` — a REDUCED SIM, modelled on updateDeath().
   - v3.6 P5's `if (game.state === "dying" && !game.paused) { updateDeath(dt); return; }` sits BEFORE
     the general early-return for exactly this reason. Put the freeze branch in the same place, with
     the same shape.
   - ⛔ WHAT IT RUNS: the level-banner countdown (`game.levelBanner.life -= dt`) and
     `VoiceSys.update()` (the voice queue drain). That is all.
   - ⛔ WHAT IT DELIBERATELY DOES NOT RUN: `Achievements.evaluate()` and the heartbeat. The
     celebration panel's own freeze already stops both, and the wave-clear branch's `return` comment
     says why in terms — an unlock raised by this clear would toast on top of the panel and still not
     appear in it. Running them here would change achievement timing that has been stable since
     CS030. Write that reason at the site; a future reader WILL think it is an omission.
   - ⛔ It calls `AudioSys.thrust(false)`, like both existing early-return paths do. Without it a
     player thrusting on the killing frame gets a stuck engine loop over a motionless field.
   - The banner countdown moves INTO this function or is called from it — spec §0.3's table says a
     naive freeze makes the banner never expire, which is a hard hang. Whichever shape you pick, the
     tick must run in both the frozen and unfrozen paths and must not double-tick in either.

3. Nothing sets `game.levelEndFreeze` to true. It is inert this phase.

## What this phase does NOT own

- Arming the freeze, the "Level N Complete" announcement, any input handling, retiring levelEndHold
  (all P2).
- Extending the freeze through nextWave(), the alpha-pulse restriction, the celebration panel's
  header (all P3).
- Any registry change. The count stays 106.

## Test

New `scratchpad/test-cs036-p1.js`. Drive the REAL update() with `game.levelEndFreeze = true` set by
hand and assert:

  - entities do not move: a Hunter Satellite, a Garbage Satellite, a saucer, a bullet and a loose
    piece of Debris all hold position across many frames;
  - the ship does not move, does not rotate, and does not fire, with input held;
  - the tow chain does not settle: a stretched chain's node positions are byte-identical after
    many frames;
  - collisions do not resolve: a Hunter Satellite overlapping the ship deals no damage;
  - ⛔ `game.levelBanner.life` STILL TICKS DOWN and reaches 0 — the anti-hang property;
  - ⛔ `VoiceSys.update()` still runs — a parked critical line still drains;
  - `Achievements.evaluate()` does NOT run and the heartbeat does NOT fire — assert the deliberate
    stops, so a later phase cannot quietly "fix" them;
  - clearing the flag resumes everything, with a non-vacuity check that the same entities DO move on
    the unfrozen frames either side.

Use scratchpad/_harness.js. `node --check` the extracted script. Run `node scratchpad/run-all.js`
before committing — three files fail on the baseline (test-f2, test-v36-death, test-cs023-p3);
that is the bar, and you may not leave the suite redder than you found it.

## Commit

Subject: `cs-36 p1: the level-end freeze primitive`
Do not push.
```

---

# P2 — The completion hold

```
claude --model opus
# reasoning effort: xhigh
```

```
ultrathink

You are implementing PHASE 2 of changeset CS036 for Orbital Overhaul. Read CLAUDE.md, then STATUS.md,
then PLANNED-FEATURES-CS036.md §1 in full. Build ONLY what this prompt scopes.

WORK FROM A FULL CLONE.

P1 built `game.levelEndFreeze` and `updateLevelEndFreeze(dt)` and left them inert. This phase arms
them.

## What this phase owns

1. ARM at wave clear. In the wave-clear branch, on the existing `waveClearTimer === 0` latch (the
   same "passes through exactly once" idiom that already arms levelEndSafe there): set
   `game.levelEndFreeze = true` and seed the completion announcement. Call `resetMenuNav()` here —
   ⛔ exactly as the celebration panel's open does, and for the reason its comment gives: the player
   is mid-flight and may well be holding the stick.

2. ⛔ RETIRE `levelEndHold`. The `if (game.waveClearTimer > DEBUG.levelEndHold)` threshold goes; the
   announcement is untimed and ends on player input. Delete the registry row (CELEBRATION section).
   REGISTRY 106 -> 105. Update scratchpad/test-registry.js's COUNTS — that is the ONLY file that
   holds a total.
   - ⛔ Retiring a knob needs NO migration shim. A saved value for a deleted field orphans harmlessly
     under known-value-else-default; that is the whole point of the rule. Do not write one.
   - ⛔ `waveClearTimer` itself SURVIVES as the arm latch. Nothing reads it as a threshold any more,
     but the `=== 0` test and the else-branch zeroing are what make the window re-arm on every clear.
     Do not delete it as newly-unused.

3. ⛔ MOVE the Perfect Wave bookkeeping. `Achievements.lifetime.perfectWaves++`,
   `stats.noScratchWave3` and `stats.flawlessLateWave` currently fire at the retired threshold. They
   move to the ARM. Behaviourally identical (the ship is invincible across the whole span either way,
   so dmgThisWave cannot change between the two points) — but it is a real move; say so at the site.
   ⛔ game.wave is still the COMPLETED wave at both points, since nextWave() is deferred. Do not
   compensate.

4. The announcement — spec §1.3. A sibling draw function in `drawLevelBanner()`'s style, NOT a panel
   and NOT a card: LEVEL_BANNER_SIZE / LEVEL_BANNER_Y / COLOR.text / centred / through drawText.
   - Text `"Level N Complete"`, N = the completed wave.
   - A prompt beneath it in CELEB_HINT's idiom. Proposed: `LEVEL_DONE_HINT = "ENTER / A  continue"`.
     Exact wording is a gate question — ship the proposal, don't agonise.
   - Fades in over DEBUG.levelBannerFade, then holds at full. ⛔ No fade-out; the panel or the next
     banner replaces it.
   - ⛔ A SIBLING of drawHUD(), like drawLevelBanner() and drawCaption() — NOT inside it, NOT gated by
     Capture's H toggle. drawLevelBanner()'s own header states this rule; follow it.

5. The input — spec §1.4. ⛔ MIRROR THE CELEBRATION PANEL'S CONTRACT EXACTLY; do not invent one.
   - Keyboard: a keydown branch, `if (!e.repeat)`, accepting bindings.confirm.keys OR
     bindings.back.keys.
   - Gamepad: the matching branch in handleGamepadMenu() on `pressedConfirm || pressedBack`.
   - ⛔ BOTH HANDLERS OR NEITHER — CLAUDE.md's standing CS030 P4 rule.
   - ⛔ The branch sits IMMEDIATELY BEFORE the `game.celebration` branch in both, so input priority
     matches the visual order: announcement -> panel -> play.
   - Confirming clears the freeze/announcement and falls through to the EXISTING path: the
     `game.state === "playing" && game.pendingAch.length` panel branch if there is one, else
     nextWave(). ⛔ Do not duplicate that fork; route to it.

## What this phase does NOT own

- Extending the freeze past nextWave() (P3 — this phase's freeze ends when the player confirms).
- The alpha-pulse restriction and the celebration panel's header (P3).
- Any change to the Achievements panel, its input gating, its resume field, or dismissCelebration()'s
  deferred nextWave(). ⛔ The `return` that IS that deferral stays exactly where it is.

## Test

New `scratchpad/test-cs036-p2.js`, driving the real update() and the real handlers:

  - killing the last Garbage Satellite freezes the field in that same update() and seeds the
    announcement, with the completed wave's number in it;
  - the freeze does NOT end on its own: many seconds of frames pass and nextWave() has not fired;
  - a confirm keypress ends it and reaches the panel when one is pending, and nextWave() when none
    is;
  - the gamepad path does the same thing (assert both, or the test is only half written);
  - ⛔ a HELD key cannot skip it: an `e.repeat` keydown does nothing;
  - the Perfect Wave bookkeeping fires exactly once per clear, at the arm, with game.wave reading
    the completed wave;
  - a fresh startGame() is not frozen for a single frame;
  - the knob is GONE: DEBUG_ENTRIES has no levelEndHold row, and nothing in the build reads
    DEBUG.levelEndHold.

Update scratchpad/test-registry.js's COUNTS to 105. Any older suite file that pins levelEndHold or
the 106 count will break — repoint it in THIS commit, naming this phase, same "REPOINTED BY"
convention every prior registry change has used.

`node --check`, then `node scratchpad/run-all.js` before committing.

## Commit

Subject: `cs-36 p2: the level-end completion hold`
Do not push.
```

---

# P3 — The freeze tail, the pulse, the panel header

```
claude --model opus
# reasoning effort: xhigh   <- if you raise effort on only one phase, make it this one
```

```
ultrathink

You are implementing PHASE 3 of changeset CS036 for Orbital Overhaul. Read CLAUDE.md, then STATUS.md,
then PLANNED-FEATURES-CS036.md §1.2 (FORK-B, -C, -D, -F) and §1.5. Build ONLY what this prompt
scopes.

WORK FROM A FULL CLONE.

## What this phase owns

1. THE FREEZE TAIL (FORK-B). The freeze currently ends when the player confirms. It now SURVIVES
   nextWave() and lifts when the "Level N+1" label STARTS FADING OUT — `game.levelBanner.life <=
   DEBUG.levelBannerFade`.
   - ⛔ DEGENERATE CASES, both reachable from the debug panel. levelBannerTime is 0-8s and
     levelBannerFade is 0-3s, so `fade >= time` makes the condition true on the banner's first frame,
     and `time === 0` means no banner at all. BOTH must degrade to "unfreeze immediately" rather than
     hang or glitch. drawLevelBanner()'s own `Math.max(0, ...)` guard exists for this exact pair —
     same spirit.
   - ⛔ The freeze now spans a wave boundary, which is why P1 put its reset in resetRun() and not
     nextWave(). Verify that still holds; do not move it.

2. THE PULSE RESTRICTION (FORK-D -> D1). The ship's alpha pulse runs during the GRACE ONLY. Both the
   phase accumulator in update() and the read in Ship.draw() switch their condition from
   `game.levelEndSafe` to `game.levelEndGraceT > 0`.
   - ⛔ BOTH KNOBS ARE RETAINED. levelEndFade and levelEndGracePulseEnd still shape the ramp across
     the grace, which is now the only place the pulse runs. NO REGISTRY CHANGE. Count stays 105.
   - ⛔ The blink-suppression rule is unchanged: while levelEndSafe, the hit-stun blink is still
     skipped. Do not couple that to the pulse's new condition — they are separate questions.
   - ⛔ ctx.globalAlpha is still restored to 1 BEFORE the shield block.

3. levelEndSafe KEEPS ITS FULL EXTENT (FORK-C -> C2). This is a no-op in code and a real decision:
   most of the window now protects a stopped field, and that is accepted as belt-and-braces. ⛔ No
   gate site moves. Record it in a comment so a later cleanup pass does not read the redundancy as an
   oversight and delete it.

4. THE PANEL HEADER (FORK-F -> F2). The celebration panel's header reverts to "ACHIEVEMENTS UNLOCKED"
   in BOTH branches — the gameover branch already reads exactly that, so this deletes the `isWave`
   ternary from menuPanel()'s title argument. ⚠ `isWave` has other readers in that function; check
   before deleting the binding itself.

5. ⛔ RE-DERIVE CS035's BANNER-CROSSING EDGE, do not port it. STATUS.md carries: "a wave cleared while
   the PREVIOUS level's banner is still live arms the grace early." Under the freeze, the new level's
   banner cannot be live when a wave clears — the field is frozen through it and nothing can die — so
   the case changes shape or disappears. Work out what it actually becomes now and RECORD THE ANSWER
   in STATUS.md, whichever way it goes. Do not assume it vanished.

## Test

New `scratchpad/test-cs036-p3.js`:

  - confirming the announcement fires nextWave() and the field is STILL frozen;
  - the field unfreezes exactly on the frame `levelBanner.life` crosses levelBannerFade, and not
    before;
  - both degenerate cases unfreeze immediately and neither hangs: fade >= time, and time === 0;
  - the pulse does NOT run during the freeze or the hold, DOES run during the grace, and still ramps
    across it — read the alpha off ctx.stroke() through the real Ship.draw(), as CS035 P3's test does;
  - levelEndSafe is still true across the hold, the panel and the banner (C2's belt-and-braces),
    and still closes when levelEndGraceT hits exactly 0;
  - the panel header reads "ACHIEVEMENTS UNLOCKED" at BOTH call sites.

`node --check`, then `node scratchpad/run-all.js` before committing.

## Commit

Subject: `cs-36 p3: freeze tail, pulse restricted to the grace, panel header`
Do not push.
```

---

# P4 — Hunter heartbeat punch

```
claude --model sonnet
# reasoning effort: medium
```

```
ultrathink

You are implementing PHASE 4 of changeset CS036 for Orbital Overhaul. Read CLAUDE.md, then STATUS.md,
then PLANNED-FEATURES-CS036.md §2. Build ONLY what this prompt scopes.

WORK FROM A FULL CLONE.

CS035's G18 asked for a volatile Hunter Satellite to turn red. ⛔ THAT ANSWER WAS WITHDRAWN. There is
NO colour change in this changeset: COLOR.satellite is unchanged, lerpColor() stays deleted, and
PLANNED-FEATURES-CS035.md §6's "motion is the tell" stands. If you find yourself adding a colour,
stop and re-read §2.

## What this phase owns

The existing heartbeat is the right SHAPE — an asymmetric linear ramp, fast up, slow down, shipped by
CS035 P4 precisely so it reads as pumping rather than breathing. It is simply too subtle. This phase
changes NUMBERS and, in one case, the BOUNDS that hold them.

1. ⛔ RAISE `hunterPulseGrow`'s `max`. It is 300 %/s and it is the binding constraint. A wider
   envelope at the same rate ceiling is SLOWER, not punchier — so widening the envelope without
   raising this makes the problem worse. Raise it far enough that the fastest reachable growth is
   effectively instantaneous at 60fps, and pick the number deliberately rather than doubling it.

2. Retune the four defs — hunterPulseMin / Max / Grow / Shrink — toward a harder punch and a slower
   settle. Current: 87 / 125 / 55 / 28 (~0.69s out, ~1.36s back). State the new cycle timing in the
   registry comment the way P4's own comment does, so the gate can check the feel against a number.

3. `hunterVolatileAge` (60s) is NOT this phase's to move unless the retune argues for it. If you
   change it, say why.

## ⛔ What must not change

- DRAW-ONLY. this.radius, this.shape and this.inner are never touched; draw() keeps scaling a FRESH
  vertex array per frame. The collision circle can never depend on animation phase — that is the
  invariant CS035 P4's test §F/§G guards, and it must keep passing unchanged.
- Not a lever. LEVERS stays 18. DIFFICULTY-LEVERS.md's not-a-lever row gets the new numbers.
- No new state, no easing curve, no new mechanism. Grow, shrink, clamp, flip — as shipped.
- No registry rows added or retired. Count stays 105 after P2.

## Test

Extend `scratchpad/test-cs036-p4.js` (new file) or repoint test-cs035-p4.js — your call, but say
which and why. Whichever you pick:

  - the raised bound is asserted with its new min/max/step/unit;
  - the four new defs are asserted;
  - ⛔ CS035 P4's don't-mutate and radius-unmoved invariants still hold — re-run them against the new
    numbers rather than assuming, since a much faster grow rate is exactly the kind of change that
    would expose an in-place mutation;
  - pulseScale still never escapes [min, max] across a long run, with the non-vacuity checks that it
    genuinely reaches both ends and reverses.

test-cs035-p4.js §A pins the old bounds and defs; repoint it in THIS commit, naming this phase.

`node --check`, then `node scratchpad/run-all.js` before committing.

## Commit

Subject: `cs-36 p4: Hunter heartbeat punch`
Do not push.
```

---

# P5 — Dock ping cooldown + the label that does not fit

```
claude --model sonnet
# reasoning effort: medium
```

```
ultrathink

You are implementing PHASE 5 of changeset CS036 for Orbital Overhaul. Read CLAUDE.md, then STATUS.md,
then PLANNED-FEATURES-CS036.md §3.1 and §3.3. Build ONLY what this prompt scopes. Two small,
unrelated fixes.

WORK FROM A FULL CLONE.

## 1. A cooldown on the dock push's shieldPing (§3.1)

The dock lockout's push fires one AudioSys.shieldPing() per pushed piece of Debris per frame, so
several pieces on the hull stack the tell.

New knob, DELIVERY section: `dockPingCooldown`, def 0.50, min 0, max 3.0, step 0.05, unit "s",
label "Dock push ping cooldown" (23 chars). REGISTRY 105 -> 106. Update
scratchpad/test-registry.js's COUNTS — the only file holding a total.

  - One timer on `game`, counted down where the per-frame decays live (cargoFlash / hpReliefFlash).
    The push site pings only when it is at 0, then re-arms.
  - ⛔ Reset it in resetRun(), not only startGame() — the standing CS016 P3 both-places rule. A field
    added to startGame()'s thin body is missed by every resumed run.
  - ⛔ AT 0 THE FEATURE IS OFF and every push pings, exactly as today. That is the gate's clean A/B,
    the same property magnetResumeDelay's own 0 has, and it is why min is 0 and not 0.05.
  - ⛔ THE PUSH ITSELF DOES NOT CHANGE. Velocity is still SET and never added; direction, magnitude
    and the degenerate-case facing fallback are untouched. This is an audio rate limit, nothing else.

## 2. FLAG-CS034-e — the debug label (§3.3)

debrisBounceRestitution's label becomes "Garbage Sat bounce restitution" (30 chars), replacing the
non-canonical "Satellite bounce restitution". ⛔ drawDebug neither wraps nor truncates, so 32 is a
hard ceiling.

⛔ THE `id` IS NOT RENAMED. debugShown persists BY ID inside afd_settings_v1.debug; renaming it would
orphan every player's saved tuning for that row. Only the label moves. Do not widen the column —
that touches every row's layout, and "simplest" was the instruction.

## Test

New `scratchpad/test-cs036-p5.js`:

  - the new knob exists with its exact def/min/max/step/unit and lives in the DELIVERY section;
  - drive the real pickup/push path: several pieces of Debris landing on the hull inside the ring in
    one frame produce exactly ONE ping, and the next ping comes only after the cooldown;
  - ⛔ at dockPingCooldown 0, every push pings — the A/B, asserted, not assumed;
  - ⛔ the push is UNCHANGED: same magnitude, same direction, still SET not added, on every piece,
    cooled-down or not. A rate-limited ping must not become a rate-limited push;
  - the timer is reset by resetRun() as well as startGame();
  - the label is exactly "Garbage Sat bounce restitution", is <= 32 chars, and the id is unchanged.

Update test-registry.js's COUNTS to 106. `node --check`, then `node scratchpad/run-all.js`.

## Commit

Subject: `cs-36 p5: dock ping cooldown, debug label fix`
Do not push.
```

---

# P6 — Suite triage

```
claude --model opus
# reasoning effort: max   <- the only phase whose ANSWER is unknown at the start
```

```
ultrathink

You are implementing PHASE 6 of changeset CS036 for Orbital Overhaul. Read CLAUDE.md, then STATUS.md,
then PLANNED-FEATURES-CS036.md §4. Build ONLY what this prompt scopes.

WORK FROM A FULL CLONE — two of these three files depend on real git history.

Three files have failed on every run since CS035 P1 and none has been investigated. A changeset that
opens with a red suite cannot tell its own regressions from the furniture.

  - test-f2.js §g — "shield deflection consumed energy", fails DETERMINISTICALLY
  - test-v36-death.js §A — 3 assertions on Achievements.save call counts around killShip
  - test-cs023-p3.js TRAP 3 — a pin against a fixed historical SHA

## ⛔ Diagnose before fixing, and say which it was

Each of these is EITHER a stale test OR a real build defect, and this phase's job is to determine
which for each one and record the finding. Do not assume "old test, repoint it" — that assumption is
how a real defect survives a triage pass.

test-v36-death is the one to be most careful with. If Achievements.save() genuinely fires more than
once around killShip, that is a BUILD bug with save-write consequences, not a test to adjust. If it
is a build bug, fix the build and say so plainly in the commit; if it is a stale pin, repoint it with
the reasoning written at the site.

Fixing a genuine build defect found here IS in scope. Refactoring around it is not.

## Also in this phase

FLAG-CS031-c's one-line fix: `game.celebration = null;` in resetShip(). CS030's celebration-panel
state leaks across sections, which is test-f2.js's OTHER, intermittent failure, and it is latent in
29 suite files that reach a death/gameover without ever mentioning game.celebration. CS036 §1 puts a
freeze on the same seam, so this is worth doing now rather than later.

⚠ Check whether test-cs035-p3.js's ~1-in-5 flake (seen during CS035 P3-P6, absent at P7) is the same
class. If it is, say so. If it is not, leave it — do not go hunting.

## ⛔ Explicitly NOT in this phase

- The thirteen shallow-clone hard-failers. Still opportunistic backlog.
- FLAG-CS027-c (8 files hardcode world dimensions) and FLAG-CS027-d (12 files' stale
  comment-stripped copies). Still opportunistic backlog.
- Any registry change. Count stays 106.

## Done means

`node scratchpad/run-all.js` reports 0 failed and 0 skipped on a full clone, or — if one of the three
turns out to need a design call rather than a fix — it is reported as such in STATUS.md with the
reasoning, and NOT papered over with a weakened assertion. ⛔ A repoint that deletes a claim rather
than inverting it is not a fix.

## Commit

Subject: `cs-36 p6: suite triage — the three standing failures`
Do not push.
```

---

# GATE — blocking playtest

**Paul plays a full build with P1–P5 in. Nothing proceeds to P7 until these come back.**
(P6 is independent and may land before or after.)

Answers are **numbers**, not yes/no, wherever a slider is involved.

**The ceremony (§1)**

- H1 — Does the level end now read as a deliberate beat rather than a hitch? `yes` / `no`
- H2 — ⛔ **Can a held fire button skip the "Level N Complete" announcement?** `no` / `yes — describe`
- H3 — Is "ENTER / A  continue" the right prompt wording, and is it visible enough? `ok` /
  `change to ___`
- H4 — Does the freeze lifting partway through the "Level N+1" label read correctly, or does play
  restarting under a still-visible label feel wrong? `ok` / `describe`
- H5 — **CS034 Gate B's B8, re-asked:** is the full-stop when the Achievements panel opens still
  jarring? `fixed` / `still jarring — describe`
- H6 — With the pulse now confined to the grace, is the hand-back to live play readable? `yes` / `no`

**The heartbeat (§2)**

- H7 — `hunterVolatileAge` final: ___ (shipped 60)
- H8 — `hunterPulseMin` / `Max` final: ___ / ___
- H9 — `hunterPulseGrow` / `Shrink` final: ___ / ___
- H10 — Does the pulse now read as a *punch* — unmissable at the edge of vision? `yes` / `no`
- H11 — Is a volatile large distinguishable from a non-volatile one at a glance, without knowing the
  rule? `yes` / `no`

**The small fixes (§3)**

- H12 — `dockPingCooldown` final: ___ (shipped 0.50)
- H13 — Does the dock push now sound like one event rather than a stutter? `yes` / `no`

⛔ **CS035's G9–G14 are deliberately not re-asked.** `levelEndHold` no longer exists and the pulse
questions are re-framed as H6/H10/H11.

---

# P7 — Closing

```
claude --model sonnet
# reasoning effort: high
```

```
ultrathink

You are implementing the CLOSING PHASE of changeset CS036 for Orbital Overhaul. Read CLAUDE.md, then
STATUS.md, then PLANNED-FEATURES-CS036.md. Build only what this prompt scopes.

WORK FROM A FULL CLONE (not --depth 1) — thirteen suite files need real git history.

## Part 1 — fold in the gate

<PASTE THE GATE ANSWERS HERE BEFORE RUNNING THIS PHASE>

Apply every returned number as the row's new `def`. A gate answer that matches the shipped value is a
no-op — SAY SO IN THE LOG rather than editing nothing silently.

If a gate answer asks for a change that is a DESIGN decision rather than a value — H2 wanting an
input lockout, H4 wanting a different unfreeze point, H5 wanting further work on the panel seam,
H11 re-opening the colour question — DO NOT BUILD IT. Record it in STATUS.md's "Known issues" as
deferred, with the gate answer that raised it.

## Part 2 — version bump

GAME_VERSION "1.0.0.35" -> "1.0.0.36".

⛔ A phase-local version pin flips to its standing mirror image (!== "1.0.0.NN", permanently true). It
is NOT re-pointed to a new literal. Live pins that genuinely track HEAD's version are a separate,
small, deliberate set and ARE re-pointed — there were exactly seven at CS035, plus test-cs035-p?'s
own phase-local pin if one exists. Read CLAUDE.md's pins section and RATIONALE.md#pins before
touching any test that mentions a version string.

## Part 3 — doc sweep

  - ORBITAL-OVERHAUL-GDD.md — §2 is SHIPPED BEHAVIOUR ONLY. §2.20.1 is the level-end window's section
    and needs the largest edit in the changeset: the ceremony's sequence, the freeze as a reduced sim,
    the completion announcement and its input contract, the retirement of levelEndHold, the pulse
    confined to the grace, and levelEndSafe's now-deliberate redundancy. Also: §2.5's volatility
    bullet for the retuned heartbeat, §2.10 for the dock ping cooldown, §2.19 for the retired and
    added knobs, §2.20 for the panel header. §3 code map if any section moved.
  - DIFFICULTY-LEVERS.md — the Hunter volatility not-a-lever row's numbers; verify the table is still
    18.
  - CLAUDE.md — if any invariant text references levelEndHold, correct it. Do NOT invent new
    invariants.
  - Use CANONICAL VOCABULARY in all prose: Garbage Satellite, Debris, Hunter Satellite, Recycle dock.
    The code's inverted names are deliberate and are NOT renamed.

## Part 4 — the log

Write log/CS036.md: the full P1-P7 build log, the gate answers and what they changed, and the GDD
version-history entry under `## GDD version history`. There is no central changelog.

⛔ Record clearly that CS036 §1 is NOT a bug fix for CS035 P3. CS035 P3 shipped what its own spec
asked for (FORK-L: full control, live field); CS036 asks for a different thing at the same seam. A
future reader will otherwise conclude the earlier phase was broken.

Then RESET STATUS.md to the current changeset only, per CLAUDE.md's format block. Carry forward the
still-open known issues CS036 did not touch: the drawTitleMenu() SaveSlots.count() flag, the
returnToTitleMenu() cursor, test-registry's FLAG-CS027-d, FLAG-CS027-c, the piece-distinctness
concern, the thirteen shallow-clone hard-failers, the never-playtested satellite-vs-satellite bounce,
blankLegacyStores()'s unguarded save, the dock-apron behaviour change, and the delivery-ticker ship
anchor. Drop the ones CS036 resolved — in particular the three standing suite failures and
FLAG-CS031-c if P6 closed them, FLAG-CS034-e, the shieldPing stacking, and CS035's own
banner-crossing edge as P3 re-derived it.

⛔ Every STATUS entry starts on its own paragraph. If you append with a shell redirect, VERIFY the
written entry actually begins a new paragraph.

## Part 5 — archive

Move PLANNED-FEATURES-CS036.md and IMPLEMENTATION-PHASES-CS036.md to archive/.

## Part 6 — verify

  - node --check the extracted script
  - node scratchpad/run-all.js — full suite, on a FULL clone. Report files/passed/failed/skipped/
    timed-out as raw numbers. A closing phase asserts ZERO SKIPS, and if P6 landed it should be able
    to assert ZERO FAILURES for the first time since CS034.
  - confirm registry === 106, headers === 10, LEVERS === 18, POWERUP_DROP_TYPES === 5
  - grep the build for any remaining reference to levelEndHold

## Commit

One commit, subject: `cs-36 p7: closing phase — version 1.0.0.36, gate fold-in, doc sweep`
Do not push.
```
