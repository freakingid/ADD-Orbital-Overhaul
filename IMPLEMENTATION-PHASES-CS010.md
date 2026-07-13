# Orbital Overhaul — Changeset 10 (CS010) — Implementation Phases

**Spec:** `PLANNED-FEATURES-CS010.md`
**Base build:** `asteroids-deluxe.html` @ `fef7ea2` (CS009 P7 included, `GAME_VERSION` still `"3.6"`).
**Target version:** `v1.0.0.10` (FORK-1).

> **Standing rule, restated because CS010 tripped over it:** *re-grep before writing anything.*
> Line numbers below are `≈` and are navigation aids only. **Symbols are the contract.**
> The spec's own anchors were re-grepped against this build during planning; seven were wrong.
> They are corrected inline below. Assume the same of anything else you don't verify yourself.

---

## 0. Fork status — SIGNED OFF

**All five forks are signed off by Paul. These are decisions, not proposals. Build to them.**

| Fork | Resolution | Phase |
|---|---|---|
| **FORK-1** | `GAME_VERSION = "1.0.0.10"` (unprefixed); rendered as `"v" + GAME_VERSION`. | **P0** |
| **FORK-2** | **(a), scoped by trigger.** `lowhpPulseRate(t)` shared by siren + hull ring + corner glow, driven by a `game.lowHpPhase` accumulator. `HUD_PULSE_HZ` **stays 1.2** and keeps driving cargo-gold + the powerup low-timer. **Reverses CS009 — the L227–228 comment gets rewritten, not left standing.** | **P3** |
| **FORK-3** | **FILL.** Radial-gradient corner glows, as a named, deliberate exception to the no-fills rule. **No `LOWHP_GLOW_MODE` knob — build the fill, don't build the arc.** GDD §3.2's exception list ends at **3**. | **P3** |
| **FORK-4** | **Remove "High Scores" from `MENU_ROOT_SYS`.** One entry point, no `scoreReturn` tracker. | **P4** |
| **FORK-5** | **(b), on the pop that empties the chain.** No latch needed — the gate is the latch. | **P9** |

---

## 1. Corrections to the spec (verified against the attached build)

These are **not** optional reading. The spec is wrong on each of them.

1. **`HUD_PULSE_HZ` has THREE consumers, not two.** Critical hull (≈L4526), cargo-gold (≈L4546),
   **and the powerup low-timer row** (≈L4588 — a timed row at `≤ HUD_FX_LOW` seconds recolors to
   `COLOR.lowhp` and pulses). **Max-hull is NOT pulsed** — `if (hpCrit && !hpMax)` gates it; `hpMax`
   is gold-*colored* only. The spec's FORK-2 parenthetical ("max-hull and full-cargo pulses") is
   wrong on both counts. There is already a **third red pulsing element** on screen at low HP.
2. **§11f's full-hull anchor does not exist.** `applyPowerup("health")` (≈L2903) is a bare
   `hp = Math.min(SHIP_MAX_HP, hp + POWERUP_HEALTH_AMOUNT)`. There is **no** full-HP bonus branch.
   (`SCOOP_MAX_BONUS`'s comment cites a `REPAIR_FULL_BONUS` pattern that isn't in the build.)
   `"Like a brand new ship."` needs its **own** edge-detect latch, and the predicate is **`>=`**
   (matching the HUD's `hpMax`), not `===`.
3. **A voice bus is FOUR sites, not one.** `AudioSys.setVol()`'s node picker is
   `cat === "master" ? this.master : cat === "sfx" ? this.sfx : this.music` — **`setVol("voice", …)`
   would silently write to the MUSIC gain.** Also: the `vol:` literal, `init()`, and
   `loadSettings()`'s hardcoded `for (const c of ["master","sfx","music"])` loop (miss it and voice
   volume never persists).
4. **§8a's 180% overflows the GAMEOVER screen.** `drawScoreTable` has exactly **two** callers
   (confirmed — there is no third): `drawHighScores()` and the gameover block (≈L4476, `topY =
   VIEW_H/2 + 60` = 420, with prompts at 640 and 672). At 180% the last row lands at **≈747** — off
   the bottom of the 720 viewport and straight through both prompts. Ceiling there without a
   re-flow is **≈1.4×**.
5. **FORK-4's removal breaks `menuHighScores`.** Its back path is
   `gotoScreen("root", rootItems().indexOf("High Scores"))` → **`-1`** once the row is gone, and
   `gotoScreen`'s `game.menu.index = index || 0` lets `-1` through (truthy).
6. **The `CARGO_*` block comment is stale.** It reasons about a *"20-node ceiling"* and solves
   `1/(1 + 20·k)`. `CARGO_CAP_MAX` is **24** (v3.4 P1 bumped it; the comment was never updated).
   Fix the comment in P2 regardless of what happens to the numbers.
7. **Chain `mass` is not node count.** `COLOR.garbageLight` scrap carries `mass < 1`, and clump
   pieces carry `g.mass / g.pieces`. "24 nodes" ≠ "mass 24". The FLAG-3a stress must be driven on
   **mass**, and must report both.

---

## 2. Phase order and dependency graph

```
P0  Version stamp (§2)                       [independent]
P1  Scoop prong-V revert (§7)                [independent] ── must precede P3 (§3.2 bookkeeping)
P2  Turn-rate ownership + towed mass (§3,§4,§10b)  [FORK-2 n/a; owns Ship.update's turn lines]
P3  Low-health corner glow (§5)              [needs FORK-2 + FORK-3; after P1]
P4  Menu restructure (§8b, §9, §10a)         [needs FORK-4; after P2 — both touch menuControls]
P5  High-score table scale-up (§8a)          [after P4]
P6  Music: Drift + Warehouse B-sections (§6) [independent]
P7  High-score track (§8c)                   [after P4 (screen must exist) and P6 (lab warm)]
────────── the nine items are DONE and shippable here ──────────
P8  tools/voice-lab.html (§11a)              [GATED — nothing enters the build]
P9  VoiceSys integration (§11b–f)            [ONLY on Paul's sign-off of P8; after P3 + P4]
```

**Why this order:**

- **P1 before P3.** §7 *deletes* fills-exception (1); §5(a) may *add* one back. Doing them in this
  order means GDD §3.2's exception list is rewritten **once, in P3**, with a known final count —
  instead of twice, with a contradictory intermediate state on `main`.
- **§3 and §10b are ONE phase, not two sequenced phases.** The spec asks to "sequence them so they
  don't collide." Better: give the two turn lines **one owner**. P2 introduces `shipTurnRate()` and
  both features route through it. The collision dissolves instead of being scheduled around.
- **P2 before P4.** Both edit `menuControls()` — P2 adds a row (shifting `ROWS`/`defaultsRow`/
  `backRow`), P4 fixes its hardcoded back-index (FLAG-8b). P4's prompt is told to expect the row.
- **P8/P9 last, and severable.** P0–P7 deliver **all nine non-voice items**. If voice never lands,
  CS010 still ships. This is FLAG-11a, honored structurally.

---

## 3. The relief cue — resolved, and it is why the nine ship cleanly

**§5's spec says the relief cue is Dan's voice line only.** Voice is P8/P9 and is gated, so as
written, *leaving* low-health would have had **no cue at all** — the glow and siren simply stop. A
state the player can't tell they've left is only half-legible, which defeats the point of §5.

**Paul's call: P3 ships a visual relief cue that stands on its own** — a non-pulsing, geometry-only
"exhale" pop on the HULL ring on the falling edge, reusing CS009's own `HUD_BANK_POP` / cap-up-width
idioms. Full spec in **P3, step 7**.

It is **permanent, not a stopgap.** If P9 lands, Dan's `"We're okay for now."` is **additive** to it,
not a replacement — a visual tell and a spoken one, the same way the low-health *onset* already
carries a siren, a chevron, a red ring and (now) a corner glow. This is also what lets P0–P7 ship as
a coherent, complete changeset with no dangling half-feature if voice never happens.

---

# Phase prompts

Each prompt is paste-ready into a fresh Claude Code session. `CLAUDE.md` auto-loads; the session
still reads `STATUS.md` first, per the non-negotiables.

---

## P0 — Version stamp

**Model:** Sonnet · standard thinking. Mechanical, single-symbol.

### Prompt

```
CS010 Phase 0 — version stamp (spec: PLANNED-FEATURES-CS010.md §2, FORK-1 resolved as v1.0.0.10).

Read STATUS.md first.

1. GREP FIRST. Confirm `const GAME_VERSION` and every read of it. As of fef7ea2 there is exactly
   one read: the high-score record's `build` field in HighScores.add (≈L3229). Verify that's still
   true; if a second read exists, stop and report it.

2. Change GAME_VERSION from "3.6" to "1.0.0.10". Keep the string UNPREFIXED — the `build` field must
   persist as "1.0.0.10", not "v1.0.0.10". Rewrite the comment above it to document the scheme:
   Major.Minor.Patch.Changeset — Major = new mechanics/levels; Minor = tweaks to existing systems;
   Patch = bug fixes, where "bug" includes the game not doing what the design intends; Changeset =
   monotonically increasing, never resets. State that the 4th segment IS the changeset number.

3. Render it on the TITLE SCREEN ONLY, lower-right corner, as "v" + GAME_VERSION. The title block is
   in draw()'s `game.state === "title"` branch (≈L4406+). Viewport is 1280x720 (VIEW_W/VIEW_H — use
   the constants, not literals). Use drawText(..., COLOR.dim) at a small size (12). New named
   constants for its x/y inset — no inline magic numbers (CLAUDE.md rule). It's a build stamp, not a
   design element: small, dim, out of the way of the title art and the drifting debris.

4. DO NOT migrate existing high-score records. Records carrying build:"3.6" stay as they are — the
   field is a free-form provenance string and a mixed table is expected. Do not touch afd_scores_v1.

5. Headless test: node --check on the extracted script; assert GAME_VERSION === "1.0.0.10" and that
   a fresh HighScores.add stamps build === "1.0.0.10". Confirm an existing record with build "3.6"
   survives a load/save round-trip unchanged.

6. Docs: bump the GDD version header; append the phase entry to GDD-VERSION-HISTORY.md (NOT the
   GDD's §7). Update STATUS.md.
```

**Commit:** `CS010 P0: GAME_VERSION -> 1.0.0.10 (semver.changeset), stamped on the title screen`

---

## P1 — Scoop prong-V revert

**Model:** Sonnet · standard thinking. Render-only — but **gated on a lab look before the port**
(FLAG-7a): the V was designed at `SCOOP_CONFIG` 3.0/36 and the build now runs **5.0/60**.

### Prompt

```
CS010 Phase 1 — revert the scoop render to the prong-V (spec: PLANNED-FEATURES-CS010.md §7).

Read STATUS.md first.

THIS IS RENDER-ONLY. inScoopBox()'s capture math does not change. Not one character of it.

1. GREP FIRST. Confirm in the live build:
   - Ship.draw()'s scoop block (≈L1936-1952): the `if (game.scoopLevel > 0)` branch that builds
     `box = [[-SHIP_RADIUS,-hw],[d,-hw],[d,hw],[-SHIP_RADIUS,hw]]`, fills it at globalAlpha 0.15 in
     COLOR.dock, then glowStrokes it.
   - SCOOP_CONFIG is currently maxWidthMult 5.0 / maxDepth 60 (v3.6 P1c grew it from 3.0/36).
   - The load-time `SCOOP_WIDTH[0] !== 0 || SCOOP_DEPTH[0] !== 0` throw. DO NOT TOUCH IT — it is a
     deliberate invariant guard (CLAUDE.md), not test scaffolding.

2. AUDITION BEFORE YOU PORT (FLAG-7a). tools/scoop-lab.html carries its own DUPLICATE copy of the
   box render. Revert the lab to the prong-V FIRST, at the CURRENT 5.0/60 config, and look at it.
   The V is (from GDD §2.14.1, verbatim, the code v3.6 P1c replaced):
       drawPoly([[d, -hw], [16, 0], [d, hw]], this.x, this.y, this.angle, COLOR.dock, false)
   — an OPEN poly (closed = false), throat at the ship's nose (16,0), flaring forward to +/-width/2
   at mouth depth d. No fill. Derive `d` and `hw` from SCOOP_WIDTH/SCOOP_DEPTH exactly as the box
   code does — corners derived, never hardcoded.
   The V was designed at the OLD 3.0/36 scale. At 5.0/60 it may look enormous or proportionally
   wrong. If it does, STOP and report with a screenshot — do not silently re-tune SCOOP_CONFIG (the
   config is a playtest knob owned by Paul, and re-tuning it changes CAPTURE behavior, not just
   render).

3. Once it reads right: port the V into Ship.draw(). Delete the box fill AND its glowStroke outline
   entirely. Show only the prongs. Still hidden at scoopLevel 0.

4. The lab revert and the game revert land in the SAME COMMIT. If they diverge, the lab previews
   something the game no longer draws.

5. Docs — this is the load-bearing part:
   - GDD §2.14.1: record this as a DELIBERATE SUPERSESSION with the history preserved. State plainly
     what is being given up: the prong-V never showed the mouth's true REAR edge at
     forward = -SHIP_RADIUS, and that was the stated reason v3.6 P1c replaced it. Paul has decided
     the cleaner look is worth an incomplete tell. That bullet has been rewritten three times —
     write it so a fourth session doesn't "fix" it back.
   - GDD §3.2: the no-fills exception list goes from THREE to TWO. Exception (1), the scoop capture
     box, is GONE. REWRITE the list — do not edit around it. (A later CS010 phase may add a new
     exception back; that is P3's problem, not yours. Leave the count at 2.)
   - CLAUDE.md: grep its no-fills paragraph for a stale reference to the scoop box.
   - GDD-VERSION-HISTORY.md + STATUS.md as usual.

6. Headless: node --check; assert inScoopBox() behavior is byte-identical (capture a set of
   ship/garbage poses before and after and diff the boolean results).
```

**Commit:** `CS010 P1: revert scoop render to the prong-V; drop the capture-box fill (fills-exception 1)`

---

## P2 — Turn-rate ownership + towed mass

**Model:** **Opus · extended thinking (`ultrathink` on the coefficient/shape question).**
The heaviest feel phase in the changeset. New persistent setting, a physics retune, a stability
stress to re-run, and a proposal Paul has to rule on.

### Prompt

```
CS010 Phase 2 — towed mass, the Engine powerup, and the ship-rotation slider
(spec: PLANNED-FEATURES-CS010.md §3, §4, §10b).

Read STATUS.md first. ultrathink the mass-shape question in step 4 before writing any code.

These three items are ONE phase because §3 and §10b both own the same two lines
(Ship.update's `this.angle -+= SHIP_TURN * dt`). One phase, one owner, one helper.

1. GREP FIRST. Confirm:
   - SHIP_TURN (4.2 rad/s), read at exactly TWO sites: Ship.update ≈L1859-1860.
   - CARGO_MASS 0.07 / CARGO_THRUST 0.06 / CARGO_MAXSPD 0.03, consumed at exactly three sites:
     Ship.update's thrustMul + maxSp, and updateChain's `massFactor = Math.min(1.4, chainMass()*CARGO_MASS)`.
   - CARGO_BASE 12, CARGO_CAP_MAX 24, CARGO_GROW_PER 30.
   - ENGINE_MASS_MULT 0.5, consumed ONLY in chainMass().
   - The settings object + saveSettings/loadSettings (afd_settings_v1 — FROZEN KEY NAME).
   - menuControls() / drawControlsMenu() / returnToDefaults() / REBINDABLE.

2. THE CONSTANTS' COMMENT IS STALE — fix it. The block above CARGO_MASS reasons about a "20-node
   ceiling" and solves 1/(1+20*k). CARGO_CAP_MAX has been 24 since v3.4 P1; the comment was never
   updated. Whatever you do to the numbers, the comment must describe the build that exists.

3. Ship-rotation multiplier (§10b):
   - New `settings.shipTurnScale`, default 1.0, range 0.5..1.5 in 0.10 steps (11 positions).
   - Persist ADDITIVELY into afd_settings_v1 — the established no-schema-bump pattern
     (shotPowerupMode / magnetMode / musicTrack all did this). Missing key -> default.
     Corrupt / non-numeric / out-of-range -> clamp to 1.0.
   - New row on the EXISTING Controls screen (menuControls), NOT a new screen. Left/right adjusts.
     Numeric readout as a PERCENTAGE ("110%") — the raw rad/s figure means nothing to a player.
     The 100% default must be indicated visually (a tick, a color, or a "(default)" tag — your call,
     but it must be visible without moving the slider).
   - menuControls currently computes `ROWS = ACTIONS.length + 2` with defaultsRow/backRow derived
     from it. Adding a row shifts those. Derive them; do not hardcode.
   - FLAG-10a: `returnToDefaults()` must NOT reset shipTurnScale. Paul asked for this explicitly.
     It resets bindings only. This is deliberate and possibly counter-intuitive — put a comment
     saying so at returnToDefaults, or a future session will "fix" it.
   - The v3.5 P1 `e.repeat` guard: the menu-open keydown branch already early-returns on e.repeat
     (≈L1281), so a held key nudges once instead of spinning. VERIFY this covers the new row. Don't
     assume it — trace it.

4. Towed mass (§3) — THE REAL PROBLEM. Read this before touching a coefficient.

   The complaint is "mass is not increasing inertia a noticeable amount." Here is what the build
   actually does, verified:
     - thrustMul = 1/(1 + m*CARGO_THRUST) gates ACCELERATION.
     - maxSp     = SHIP_MAX_SPEED/(1 + m*CARGO_MAXSPD) is applied ONLY INSIDE `if (this.thrusting)`.
       It is a thrust ceiling, not a coasting clamp.
     - TURN RATE is completely unaffected by cargo.
     - DRAG is completely unaffected by cargo.
   So towed mass currently affects how fast you speed UP and how fast you can thrust TO. It does not
   affect rotation and it does not affect stopping. "Inertia" is felt in rotation and stopping.
   That is why it doesn't read as mass — and it is why raising the two coefficients may not fix it:
   1/(1 + m*k) ASYMPTOTES, so it can never bite hard no matter the coefficient.

   The three coefficients are PLAYTEST KNOBS. Comment them as such. Do NOT over-specify final
   numbers. Raise them as a first pass and say what you raised them to and why.

   Then implement the shape fix, but SHIPPED OFF BY DEFAULT so it's Paul's call, not yours:
     - New constant `CARGO_TURN`, **default 0.0**, commented as a PLAYTEST KNOB and as the proposed
       fix for "inertia."
     - Route BOTH turn lines through ONE helper:
           function shipTurnRate() {
             return SHIP_TURN * settings.shipTurnScale / (1 + chainMass() * CARGO_TURN);
           }
       At CARGO_TURN = 0 this is byte-identical to today's behavior times the player scale, so the
       phase is shippable with the penalty dormant and Paul enables it with one number.
     - Report, in STATUS.md, the turn-rate multiplier this yields at chain mass 6 / 12 / 24 for a
       few candidate CARGO_TURN values, so Paul can pick from a table instead of guessing.
   DO NOT silently change the thrust/maxspd FORMULA (a steeper falloff, an accel lag). If you think
   the divisor shape must change there too, PROPOSE it in STATUS.md with numbers. Don't ship it.

5. FLAG-3a — DO NOT SKIP, AND DO NOT ASSUME. GDD §3.4's chain-stability envelope was validated at
   24 nodes / CHAIN_ITER 4, worst-case link stretch ~4.11px on a 20px CHAIN_LINK, UNDER THE CURRENT
   COEFFICIENTS. If CARGO_MASS changes, RE-RUN THE STRESS:
     900 frames, hard thrust-flips across a world wrap, 24 nodes, dt at the 0.05 main-loop clamp.
     Assert: no NaN, no velocity blowup, worst-case stretch under ~5px.
   REPORT THE MEASURED NUMBER EITHER WAY — including if you didn't change CARGO_MASS.
   NOTE: chain node `mass` is NOT 1.0 across the board — light (Hunter-sourced) scrap carries
   mass < 1, and clump-scooped pieces carry g.mass/g.pieces. "24 nodes" is NOT "mass 24". Drive the
   stress on MASS and report both the node count and the mass sum.

6. Engine (§4): expect NO CODE CHANGE. ENGINE_MASS_MULT stays 0.5; Paul is happy with the magnitude;
   the identity stays "makes hauling easier." Its whole effect is halving chainMass(), so if §3 makes
   mass matter, Engine matters as a consequence. Re-judge it AFTER the §3 numbers are in and say
   whether you'd still touch it. FLAG-4a: Engine remains a no-op with an empty chain. ACCEPTED, not
   fixed — do not "fix" it.

7. Headless tests: node --check. Assert shipTurnRate() at scale 0.5/1.0/1.5 and at chain mass 0/12/24.
   Assert shipTurnScale round-trips through afd_settings_v1, that a missing key yields 1.0, and that a
   corrupt value (string / NaN / 99) clamps to 1.0. Assert returnToDefaults() leaves it untouched.
   Plus the FLAG-3a stress.

8. Docs: GDD §2 (handling penalties), GDD §3.4 (the chain contract's "cargo penalties live in
   Ship.update" bullet now includes turn rate — and its stability-envelope bullet carries the NEW
   measured stretch), GDD-VERSION-HISTORY.md, STATUS.md (with the CARGO_TURN table from step 4).
```

**Commit:** `CS010 P2: shipTurnRate() owns both turn sites; rotation-speed slider; towed-mass retune + CARGO_TURN knob`

---

## P3 — Low-health corner glow + shared pulse rate

**Model:** **Opus · extended thinking.** Reverses a documented CS009 decision, adds a shared
rate/phase primitive, and is an explicit look-call.

**Depends on:** FORK-2, FORK-3, and P1 (for §3.2's exception count).

### Prompt

```
CS010 Phase 3 — the low-health corner glow (spec: PLANNED-FEATURES-CS010.md §5; FORK-2 = (a); FORK-3 = build both behind a knob).

Read STATUS.md first. ultrathink the phase-accumulator problem in step 3 before writing code.

THIS PHASE REVERSES A DECISION CS009 MADE DELIBERATELY AND WROTE INTO THE CODE. Paul has signed off.
Your job includes REWRITING that comment — leaving it standing would leave a comment that contradicts
the code, which is worse than either choice.

1. GREP FIRST. Confirm:
   - LOW_HP_THRESHOLD 100. The low-health STATE is a pure per-frame read; the AUDIO is edge-detected
     off `game.lowHpSiren` at ONE site in update() (≈L3661-3666), right after the camera-follow.
     lowhpSet(t) is called EVERY frame while engaged, with t = 1 - hp/LOW_HP_THRESHOLD.
   - AudioSys.lowhpSet's rate line: `LOWHP_PULSE_RATE_MIN + (MAX - MIN) * t` (0.9 -> 2.4 Hz).
   - HUD_PULSE_HZ = 1.2 and its THREE call sites. The spec says two. IT IS WRONG. They are:
       (a) ≈L4526 — critical hull ring, gated `if (hpCrit && !hpMax)`
       (b) ≈L4546 — cargo-gold ring, gated `cargoFull || cargoFlash > 0`
       (c) ≈L4588 — the powerup LOW-TIMER row (`powerFx[t] <= HUD_FX_LOW`), which ALSO recolors to
           COLOR.lowhp and pulses. This is a THIRD red pulsing element at low HP.
     Note MAX-HULL is NOT pulsed — it's gold-colored only. Verify all of this yourself.
   - The low-health chevron (≈L4649) inside drawHUD(). It STAYS. The glow is additive.

2. RATE IS SHARED BY TRIGGER, NOT BY WIDGET. This is the rule for the phase:
   - Hull-critical ring + corner glow + audio siren all key off `hp <= LOW_HP_THRESHOLD`. They get
     ONE shared, HP-ramped rate.
   - Cargo-gold and the powerup low-timer key off DIFFERENT triggers. They KEEP flat HUD_PULSE_HZ
     (1.2). This is correct, not a compromise: a distinct rate is how the player tells "hull alarm"
     apart from "timer expiring."
   So: extract
       function lowhpPulseRate(t) { return LOWHP_PULSE_RATE_MIN + (LOWHP_PULSE_RATE_MAX - LOWHP_PULSE_RATE_MIN) * t; }
   and have AudioSys.lowhpSet READ IT instead of duplicating the interpolation. One formula, one place.
   HUD_PULSE_HZ stays a constant and keeps its two remaining consumers.

3. YOU CANNOT JUST MAKE THE PULSE CONSTANT VARIABLE. The existing idiom is
       0.6 + 0.4 * Math.sin(performance.now()/1000 * TAU * HUD_PULSE_HZ)
   i.e. phase = omega * t. If omega becomes a function of HP, the phase JUMPS every time HP changes
   (a 0.5 rad/s delta at t = 60s is a ~30-radian snap). The pulse will visibly stutter.
   So: a PHASE ACCUMULATOR is mandatory.
   - New `game.lowHpPhase`, advanced in update() at the EXISTING lowHpSiren edge-detect site:
         if (lowHp) game.lowHpPhase = (game.lowHpPhase + TAU * lowhpPulseRate(t) * dt) % TAU;
     Reset to 0 on disengage, and in startGame(). Reuse the EXISTING latch — DO NOT ADD A SECOND ONE.
   - The critical-hull ring AND the corner glow both read `Math.sin(game.lowHpPhase)`.
   - NEVER read a Web Audio LFO node's value for this. AudioParam values aren't reliably readable and
     AudioSys.ctx may be null (no user gesture yet). THE GLOW MUST RENDER WITH AUDIO UNAVAILABLE.
   - Living in update() means the phase FREEZES while paused. That is CORRECT and deliberate:
     openPause() already tears the siren down, and CS009 put hudHull/cargoFlash in update() for the
     same reason. Comment it.

4. THE GLOW ITSELF — FORK-3 IS SIGNED OFF AS **FILL**. Build the fill. Do NOT build a stroke-arc
   variant, and do NOT add a LOWHP_GLOW_MODE toggle — Paul has picked.
   - Four radial-gradient corner glows: ctx.createRadialGradient + ctx.fill, COLOR.lowhp.
   - Intensity scales with t as well as rate — near death it must be BRIGHTER, not merely FASTER.
     New knobs LOWHP_GLOW_* (alpha at t=0 and t=1, radius/extent), all commented PLAYTEST KNOB.
   - The reasoning, for the comment and for GDD §3.2: a peripheral-vision alarm is low-frequency,
     large-area and EDGELESS by definition. That is what makes it readable out of the corner of the
     eye without competing for focus. A glowStroke arc is a LINE — high-frequency, small-area — and
     would read as yet another HUD element next to two red rings, which is the noise this phase
     exists to avoid. It is also cheaper: glowStroke is shadowBlur, already the renderer's hot spot,
     and four blurred arcs would burn it in the busiest frames of the game.
   - Engages/disengages on the EXACT SAME predicate as the siren. Reuse game.lowHpSiren.
   - CORNER OCCUPANCY IS REAL. Viewport 1280x720. Top-right = the HULL/CARGO rings
     (HUD_HULL_CX 1156, HUD_CARGO_CX 1232, HUD_RING_CY 74, HUD_RING_R 30, labels at 122) — and the
     HULL ring will be pulsing red IN PHASE with the glow. Bottom-left = powerup rows + SCOOP pips
     (HUD_FX_BASE_Y 640, x ~40-140). Top-left = score/level. Size the glow so it FRAMES rather than
     FIGHTS. Do not let it wash out the rings it sits behind.
   - It goes in drawHUD(), so Capture's H key hides it and P exports a clean frame. That's correct —
     say so in a comment.

5. REWRITE THE CS009 COMMENT AT HUD_PULSE_HZ (≈L227-228). It currently reads:
       "pulse rate for critical/max/full-cargo states — constant, bound to nothing else (the audio
        siren already ramps its own rate with HP)"
   It is now BOTH stale AND wrong (max-hull isn't pulsed; the powerup low-timer is). Replace it with
   the rule from step 2: HUD_PULSE_HZ is the flat rate for NON-HP alarms (cargo-gold, powerup
   low-timer); anything keyed on LOW_HP_THRESHOLD reads lowhpPulseRate(t) via game.lowHpPhase, so
   the hull ring, the corner glow, and the siren are ONE instrument. Also fix the in-line comment at
   the hull-ring pulse site (≈L4524-4525), which states the old reasoning.

6. GDD §3.2 — the no-fills exception list. P1 took it from THREE to TWO (it deleted the scoop capture
   box). The corner glow takes it back to THREE, as a NAMED, DELIBERATE exception that Paul signed
   off on. REWRITE the list — do not edit around it — and RECORD THE REASONING FROM STEP 4 in it, so
   a future cleanup pass that doesn't know why it exists doesn't strip it. Net effect across CS010:
   the exception COUNT is unchanged at three, but the MEMBERSHIP changed. Say that explicitly.
   Check CLAUDE.md's no-fills paragraph for a stale reference too.

7. THE RELIEF CUE — BUILD IT (FLAG-CS010-a, resolved: Paul wants a fallback).
   §5 says the relief cue is Dan's voice line, but voice is P9 and is gated. A state the player can't
   tell they've LEFT is half-legible, so P3 ships a visual relief cue that stands on its own. It is
   PERMANENT, not a stopgap — if voice lands, Dan's line is ADDITIVE to it, not a replacement.

   - New constant `LOWHP_RELIEF_FLASH` (sec, PLAYTEST KNOB — start around 0.5, the HUD_CAP_FLASH
     neighbourhood).
   - New field `game.hpReliefFlash`, 0 in startGame().
   - ARM IT ON THE FALLING EDGE, in the existing else-if branch, and ONLY IF THE SHIP IS ALIVE:
         else if (!lowHp && game.lowHpSiren) {
           AudioSys.lowhp(false); game.lowHpSiren = false;
           if (!game.ship.dead) game.hpReliefFlash = LOWHP_RELIEF_FLASH;   // relief, not death
         }
     THE GUARD IS LOAD-BEARING. `lowHp` is `hp <= LOW_HP_THRESHOLD && !game.ship.dead`, so DYING also
     drives lowHp false. Without the guard, the hull ring would play a cheerful "you're okay now" pop
     at the exact moment the player is killed. (killShip's own teardown currently happens to prevent
     the edge from being reached — trace it and confirm — but do not rely on that; guard explicitly.)
   - DECAY IT IN update(), NOT drawHUD(), right beside the existing `game.cargoFlash` decay (≈L3653):
         if (game.hpReliefFlash > 0) game.hpReliefFlash = Math.max(0, game.hpReliefFlash - dt);
     Same reason CS009 put hudHull/cargoFlash there: a decay that only ran while DRAWN would freeze
     while the HUD is hidden (Capture's H key) and pop back on re-show.
   - ZERO IT wherever `game.lowHpSiren = false` is assigned DIRECTLY — there are four such sites
     outside the falling-edge branch (openPause ≈L1461, quitToTitle ≈L1475, startGame ≈L2649,
     killShip ≈L3340). Grep for them; a stale flash must never survive a pause, a quit, or a death.
   - RENDER: a GEOMETRY-ONLY pop on the HULL ring — radius + stroke width, decaying to normal over
     LOWHP_RELIEF_FLASH. Reuse CS009's OWN idioms verbatim: HUD_BANK_POP's fractional-radius pop
     (≈L4615) and the cargo cap-up's width bump (`HUD_RING_W + 2`). NON-PULSING, deliberately — the
     alarm WAS the pulse; the relief is its absence plus one clean exhale.
   - DO NOT TOUCH THE COLOR. `hullColor` is already `hpMax ? COLOR.ach : (hpCrit ? COLOR.lowhp :
     COLOR.hp)` — on relief, hpCrit is false, so the ring is ALREADY back to COLOR.hp. Adding a color
     rule would fight that precedence chain (and the hpMax gold case). Geometry-only composes with it
     for free, adds no new color semantics, and CANNOT LEAK globalAlpha because it never touches it.

8. Headless: node --check. Assert lowhpPulseRate(0) === LOWHP_PULSE_RATE_MIN and (1) === _MAX.
   Assert game.lowHpPhase advances monotonically (mod TAU) while engaged, is 0 on disengage and after
   startGame(), and that drawHUD() runs WITHOUT THROWING when AudioSys.ctx is null (the whole point).
   Assert the alpha never leaks: globalAlpha must be 1 after drawHUD() returns.
   RELIEF FLASH — the assertions that matter:
     - healing back above LOW_HP_THRESHOLD arms hpReliefFlash exactly once, and it decays to 0 over
       LOWHP_RELIEF_FLASH seconds of update() ticks;
     - DYING while below the threshold arms it ZERO times (drive killShip and assert
       game.hpReliefFlash === 0 — this is the guard from step 7, and it is the one that will
       actually bite);
     - pausing while below the threshold and resuming arms it ZERO times (openPause tears the siren
       latch down directly, so the falling-edge branch must not run — confirm, don't assume);
     - startGame() zeroes it.

9. Docs: GDD §2 (low-health warning), GDD §3.2 (rewritten exception list),
   GDD-VERSION-HISTORY.md, STATUS.md — including a PLAYTEST ASK: which LOWHP_GLOW_MODE, and does the
   synced hull-ring/glow/siren read as one alarm.
```

**Commit:** `CS010 P3: low-health corner glow + relief pop; lowhpPulseRate() + lowHpPhase sync hull ring, glow and siren`

---

## P4 — Menu restructure

**Model:** Sonnet · **extended thinking** (mechanical, but index-fragile — this is the exact
function family that has broken twice).

**Depends on:** FORK-4. **After P2** (which adds a row to `menuControls`).

### Prompt

```
CS010 Phase 4 — Sound/Music sub-dialog, High Scores under Options, final MENU_OPTIONS
(spec: PLANNED-FEATURES-CS010.md §8b, §9, §10a; FORK-4 = REMOVE from MENU_ROOT_SYS).

Read STATUS.md first.

This is a RELOCATION, NOT A REDESIGN. Same control style (left/right sliders, track cycler). No new
widgets. The risk here is entirely index fragility — read FLAG-8b twice.

1. GREP FIRST. Confirm:
   - MENU_ROOT_SYS = ["Options","Achievements","High Scores","Back"]  (≈L1427)
   - MENU_OPTIONS  = ["SFX Volume","Music Volume","Master Volume","Music Track","Controls",
                      "Achievements","Difficulty","Back"]  (≈L1432)
   - VOL_CATS ["sfx","music","master"] AND **VOL_LABELS** ["SFX Volume","Music Volume","Master Volume"]
     — the spec only mentions VOL_CATS. VOL_LABELS EXISTS, and menuOptions()/drawOptionsMenu()
     already dispatch via `VOL_LABELS.indexOf(label)` -> `VOL_CATS[vi]`. So the coupling is
     VOL_LABELS <-> VOL_CATS (parallel arrays), NOT "parallel to the first three MENU_OPTIONS rows."
     Keep the two arrays paired and moving rows is safe. Verify this before you trust it.
   - The Difficulty sub-screen as the template: DIFFICULTY_ROWS + menuDifficulty() +
     drawDifficulty() + a case in menuInput()'s switch + a branch in drawMenu()'s dispatch + a Back
     row returning via `MENU_OPTIONS.indexOf("Difficulty")`.
   - P2 has already added a ship-rotation row to menuControls(). DO NOT CLOBBER IT.

2. FLAG-8b — TWO HARDCODED INDICES, BOTH VERIFIED IN THE LIVE BUILD. Fix BOTH first, before you
   touch MENU_OPTIONS, so the restructure lands on non-fragile code:
     menuControls:     gotoScreen("options", 3)   // TWO sites (confirm branch + back branch)
     menuAchievements: gotoScreen("options", 4)   // ONE site
   Both become `MENU_OPTIONS.indexOf("Controls")` / `.indexOf("Achievements")`. menuDifficulty
   already does this correctly — copy its shape.
   Then GREP EVERY FILE IN scratchpad/ for hardcoded menu indices. test-f8.js and test-p4.js have
   been broken by exactly this, twice. Fix what you find, in this commit.

3. New "Sound / Music" sub-screen. Follow the Difficulty template EXACTLY:
     const SOUND_ROWS = ["SFX Volume","Music Volume","Master Volume","Music Track","Back"];
     menuSound(a) + drawSound() + a "sound" case in menuInput() + a branch in drawMenu().
   Move the three volume sliders and the Music Track cycler off the Options screen and onto it.
   Back returns to Options via `MENU_OPTIONS.indexOf("Sound / Music")`.
   Keep VOL_LABELS/VOL_CATS paired; re-derive the slider index against SOUND_ROWS (or keep dispatching
   by label, which is what the code already does). DO NOT LEAVE A STALE INDEX ASSUMPTION ANYWHERE.
   Persistence is unchanged — volumes already round-trip through saveSettings()/afd_settings_v1.
   NOTE: P9 will add a Voice Volume row to this screen. Don't build it now (one phase per feature),
   but leave SOUND_ROWS shaped so a row is purely additive.

4. Final MENU_OPTIONS (§10a):
     ["Sound / Music", "Controls", "Achievements", "High Scores", "Difficulty", "Back"]
   Options is reachable from BOTH the system menu (title/gameover) AND the pause menu, so nesting
   High Scores here makes the table reachable in both contexts — which the root-only entry never did.
   That is the entire point of §8b; don't lose it.

5. FORK-4 — REMOVE "High Scores" from MENU_ROOT_SYS. THIS BREAKS SOMETHING. menuHighScores()'s back
   path is currently:
       gotoScreen("root", rootItems().indexOf("High Scores"))
   With the row gone, indexOf returns **-1**, and gotoScreen does `game.menu.index = index || 0` —
   and -1 IS TRUTHY, so the cursor lands off the list. Rewrite it to:
       gotoScreen("options", MENU_OPTIONS.indexOf("High Scores"))
   With one entry point there is NO need for a `scoreReturn` tracker (the achReturn pattern). Don't
   add one. Also drop the now-dead "High Scores" branch from menuRoot()'s label dispatch.

6. Headless: node --check. Drive the full menu graph and assert every screen's Back lands on the
   right parent with the cursor on the right ROW LABEL (not index — assert the label, so the test
   survives the next reorder). Cover: root -> Options -> Sound/Music -> Back; Options -> High Scores
   -> Back; Options -> Controls -> Back; Options -> Achievements -> Back (from BOTH root and Options
   entry paths — achReturn still has two); Options -> Difficulty -> Back. Assert MENU_ROOT_SYS no
   longer contains "High Scores" and that no gotoScreen call anywhere passes a negative index.

7. Docs: GDD §2 (menus), GDD-VERSION-HISTORY.md, STATUS.md. Note in STATUS.md that High Scores is now
   TWO keypresses from the title (O -> Options -> High Scores) rather than one — accepted per FORK-4.
```

**Commit:** `CS010 P4: Sound/Music sub-dialog; High Scores nested under Options; kill both hardcoded menu indices`

---

## P5 — High-score table scale-up

**Model:** Sonnet · standard thinking. Presentation, but with a real layout trap.

**Depends on:** P4 (the screen has moved).

### Prompt

```
CS010 Phase 5 — render the high-score table larger (spec: PLANNED-FEATURES-CS010.md §8a).

Read STATUS.md first.

THE SPEC IS WRONG ABOUT THIS ONE AND WILL BREAK THE GAMEOVER SCREEN IF FOLLOWED LITERALLY. Read step 2.

1. GREP FIRST. drawScoreTable(cx, topY, highlightId) has EXACTLY TWO callers (confirmed at fef7ea2 —
   verify it's still two):
     (a) drawHighScores()  -> menuPanel(640, 460, "HIGH SCORES"), table at y + 90, footer at y + 420
     (b) draw()'s gameover block -> drawScoreTable(VIEW_W/2, VIEW_H/2 + 60, game.lastScoreId)
         with "PRESS ENTER TO PLAY AGAIN" at VIEW_H/2 + 280 and the O/B hint at VIEW_H/2 + 312.
   Current metrics: font 13 everywhere, header at topY, rows at topY + 22 + i*18 (pitch 18),
   column offsets cx-230 / cx-170 / cx+10 / cx+130 / cx+230.

2. 180% CANNOT BE APPLIED TO BOTH CALLERS. Do the arithmetic yourself and confirm:
   The gameover table starts at y=420 in a 720-tall viewport, with prompts at 640 and 672. At 180%
   (header ~23, pitch ~32) the 10th row lands at roughly 420 + 39 + 9*32 = ~747 — OFF THE BOTTOM OF
   THE VIEWPORT, straight through both prompts. The ceiling there without re-flowing the gameover
   screen is about 1.4x.
   So: PARAMETERIZE.
     drawScoreTable(cx, topY, highlightId, scale = 1)
   Every font size, the row pitch, the header offset, AND the column x-offsets multiply by `scale`
   (bigger glyphs need wider columns — the spec says so, and it's right).
     - drawHighScores() passes 1.8.
     - The gameover caller passes 1.0 (UNCHANGED — its layout is already tight and the fresh entry
       is highlighted gold there anyway).
   Comment WHY the two differ, or a future session will "unify" them and push the table off-screen.

3. The HIGH SCORES panel must GROW — the spec says grow the panel rather than shrink the font, and at
   1.8 the table does not fit 640x460. Compute it, don't guess: header + 10 rows at the new pitch,
   plus the panel title, plus the footer line. Grow menuPanel's w/h until it fits with air, widen the
   column offsets to match, and move the footer. All layout numbers stay one-line tunables.

4. DO NOT touch the initials-entry screen (drawEntrySlots) — it's already at font 40 and is not part
   of this item.

5. Headless: node --check + a recording-canvas test that captures every drawText call from
   drawHighScores() and from the gameover block, and asserts (a) no y exceeds the panel's inner
   bottom on the browsable screen, and (b) no y exceeds VIEW_H - 20 on the gameover screen with a
   FULL 10-row table.

6. Docs: GDD §2 (high scores), GDD-VERSION-HISTORY.md, STATUS.md. Add a PLAYTEST ASK: is 1.8 right on
   the browsable screen, and does the gameover table now look small by comparison (if it does, the fix
   is re-flowing the gameover screen, which is a separate, un-scoped job — flag it, don't do it).
```

**Commit:** `CS010 P5: drawScoreTable takes a scale; browsable high scores at 180%, gameover left at 1.0`

---

## P6 — Music: Drift and Warehouse B-sections

**Model:** **Opus · standard thinking.** Composition — an aesthetic phase.

### Prompt

```
CS010 Phase 6 — give Drift and Warehouse a real B-section (spec: PLANNED-FEATURES-CS010.md §6).

Read STATUS.md first.

ONLY Drift and Warehouse. Beacon/Zen/Derelict are not touched.

1. GREP FIRST. Confirm buildDriftTrack() and buildWarehouseTrack(), their registration in
   MUSIC_TRACKS (≈L951), and the data shape { stepDur, steps, layers: [{type|noise, gain, atk, rel,
   ..., steps: [cell|null] }] } built via the shared mk/put/hit helpers. Drift is currently
   BARS 8 / SPB 16 / STEPS 128 / stepDur 0.17 over ONE 8-chord progression with a 16th-note organ
   arp — the same 8 bars forever. Warehouse is the same story with a house groove and, BY DESIGN, no
   melodic hook at all.

2. NON-NEGOTIABLES (standing CLAUDE.md rules — violating any of these fails the phase):
   - TRACKS ARE DATA. MusicSys.update() / scheduleStep() / the layerGates gain-gating are NOT to be
     modified. playNote()'s voice branch is the ONE extension point, and only if a track needs a
     synthesis capability the current fields genuinely don't cover.
   - THE INTENSITY SYSTEM STAYS DORMANT. No `tier` fields on any layer. setIntensity() stays a no-op.
     MUSIC_LAYER_THRESHOLD / layerGates / the nextWave() call site all stay intact so re-arming is
     data-only later. DO NOT RE-ARM IT HERE.
   - Track NAMES stay "drift" / "warehouse". settings.musicTrack and afd_settings_v1 unchanged.
     Existing saves must keep working.

3. WORKFLOW — do not compose blind in the game file. Compose and audition in tools/music-lab.html
   (the established design instrument; it runs a faithful copy of the scheduler, so what it plays is
   what the game plays). Then port the builder functions VERBATIM. Do not hand-tune gains in the
   live build.

4. THE MUSIC. Extend BARS and give the added bars DIFFERENT chord movement and/or a DIFFERENT layer
   arrangement, so each loop has an A -> B (-> A) shape instead of one repeating cell. Longer, with
   real variation inside — NOT an ambient interlude (explicitly rejected).
   For WAREHOUSE: the round-2 music-lab data still contains A HOOK LAYER THAT WAS CUT. Find it.
   Strongly consider dropping it back in as the B-section's payload rather than composing fresh —
   it was cut for being too present as a constant element, which is exactly what makes it a B-section.

5. EXISTING TEST GUARANTEES MUST STILL HOLD (scratchpad/test-v34-p6.js — grep it, it's the contract):
   - every loop >= 10s
   - no gap longer than ONE STEP where nothing sounds across any layer, checked CIRCULARLY
   - worst-case node creation for a single scheduled step <= 16 (current worst: 13, Zen step 0)
   FLAG-6a: longer loops with more layers can push that node budget. MEASURE IT. Report the new
   worst-case step and which track/step it is. Do not assume.

6. Docs: GDD §2.8 (music), GDD-VERSION-HISTORY.md, STATUS.md — with the measured node budget and a
   PLAYTEST ASK (does the B-section land as relief, or as a different song?).
```

**Commit:** `CS010 P6: Drift and Warehouse get B-sections; longer loops, hook layer restored to Warehouse`

---

## P7 — High-score track

**Model:** **Opus · standard thinking.** A composition plus one genuine architectural change.

**Depends on:** P4 (the screen has moved) and P6 (lab is warm).

### Prompt

```
CS010 Phase 7 — a dedicated celebratory track for the High Scores screen
(spec: PLANNED-FEATURES-CS010.md §8c).

Read STATUS.md first.

1. GREP FIRST. Confirm, verbatim:
       function musicStateFor(s) { return s === "playing" ? settings.musicTrack : s === "title" ? "title" : "off"; }
   and its ONE caller, updateMusic():
       MusicSys.setState(musicStateFor(game.state));
       MusicSys.setDuck(menuActive());
       MusicSys.update();
   Also: MUSIC_TRACKS (the registry), MUSIC_TRACK_VALUES (the PLAYER-FACING gameplay picker),
   menuActive() (`return game.paused`), MUSIC_DUCK_GAIN (0.5).

2. THE TWO REAL PROBLEMS (the spec is right that these are the whole item):

   (a) musicStateFor() keys off game.state ALONE. The High Scores screen is a MENU: game.paused is
       true while game.state is still "title" / "gameover" / "playing". So game.state never says
       "high scores" and musicStateFor can't express it. It must ALSO consult the active menu screen.
       Least-invasive fix — it already reads module globals (settings), so reading game.menu is
       in-idiom:
           function musicStateFor(s) {
             if (game.paused && game.menu.screen === "highscores") return "highscore";
             return s === "playing" ? settings.musicTrack : s === "title" ? "title" : "off";
           }
       Switching in and out is then a NORMAL setState() crossfade. No new track-switch code path.

   (b) MENU DUCKING WILL MUTE IT. setDuck(menuActive()) drops the bus to 50% whenever ANY menu is
       open — so a track that plays ONLY while a menu is open would be PERMANENTLY DUCKED. Exempt the
       High Scores screen; there's no gameplay audio underneath it to duck for:
           MusicSys.setDuck(menuActive() && game.menu.screen !== "highscores");
       setDuck is already idempotent on its target, so this costs nothing per frame.

3. THE TRACK. Compose in tools/music-lab.html, port VERBATIM (same rule as P6). Celebratory.
   Register it in MUSIC_TRACKS as `highscore: buildHighScoreTrack()`.
   DO NOT add it to MUSIC_TRACK_VALUES — it is CONTEXTUAL, like `title`, not a gameplay track the
   player picks. settings.musicTrack and afd_settings_v1 are unchanged.
   Same constraints as P6: tracks are DATA, no tier fields, scheduler untouched, and the
   test-v34-p6.js guarantees (>=10s loop, no >1-step silence gap checked circularly, <=16 nodes per
   scheduled step) must still hold. Re-measure the node budget.

4. FLAG — SURFACE, DO NOT DECIDE: should the celebratory track ALSO play on the GAMEOVER screen's
   post-entry table, where the player has just EARNED a high score? Today musicStateFor("gameover")
   returns "off" — the death spectacle deliberately ends in SILENCE. The spec scopes this item to
   "while the High Scores screen is open," so build EXACTLY that and leave gameover silent. Put the
   question in STATUS.md for Paul.

5. Headless: node --check. Assert musicStateFor returns "highscore" iff (game.paused &&
   game.menu.screen === "highscores"), for game.state in each of title/playing/gameover/dying — and
   that it is UNCHANGED for every other combination (this is the regression that matters). Assert
   setDuck is NOT engaged on the high-scores screen but IS on every other menu screen.

6. Docs: GDD §2.8, GDD-VERSION-HISTORY.md, STATUS.md.
```

**Commit:** `CS010 P7: sixth track for the High Scores screen; musicStateFor() is menu-aware, duck exempted`

---

> ### ⬛ THE NINE ITEMS ARE COMPLETE HERE.
> §2, §3, §4, §5, §6, §7, §8, §9, §10 all ship at P7. **CS010 is releasable without P8/P9.**
> Everything below is the voice system, and it is gated.

---

## P8 — `tools/voice-lab.html` — GATED, NOTHING ENTERS THE BUILD

**Model:** **Opus · extended thinking.** The highest-risk item in the changeset (FLAG-11a).

**This phase ships NO change to `asteroids-deluxe.html`.** It ends with Paul listening.

### Prompt

```
CS010 Phase 8 — tools/voice-lab.html, a formant-synthesis instrument for Dan's voice
(spec: PLANNED-FEATURES-CS010.md §11a).

Read STATUS.md first. ultrathink the intelligibility problem before writing code.

THIS PHASE MUST NOT TOUCH asteroids-deluxe.html. Not one line. It builds a design instrument, and it
ends with Paul listening to it and deciding. If you find yourself editing the game file, stop.

WHY: voice is SYNTHESIZED. No audio files. The game stays a single self-contained GPL-3.0 HTML file
with no build step — a HARD project constraint. That means formant synthesis in Web Audio: a glottal
source (pulse/saw on a pitch contour) through a bank of bandpass filters at formant frequencies,
sequenced across a phoneme string, with noise bursts for fricatives and plosives. It is doable. It
will not sound like a person. INTELLIGIBILITY IS A REAL ENGINEERING PROBLEM and it is the only thing
this phase is actually about.

1. Build tools/voice-lab.html following the established instrument pattern (tools/scoop-lab.html,
   tools/music-lab.html): standalone HTML, no bundler, no imports, carries whatever slice of logic it
   needs duplicated in place. Read both existing labs before you start — match their shape.

2. The lab must let Paul, live, without reloading:
   - Type a phrase and hear it.
   - Load each of the 20 SHIPPING LINES from §11f with one click (they're listed below — Paul's
     phrasing, VERBATIM, preserve it exactly).
   - Tune, with visible sliders: formant frequencies (F1/F2/F3) and bandwidths, the pitch contour
     (base pitch, range, and its shape across the phrase), phoneme timing / rate, the glottal source
     type and its harmonic richness, fricative/plosive noise burst character, and any
     "character" processing (see 4).
   - See the phoneme string it derived from the text, and EDIT IT DIRECTLY — English orthography is a
     poor guide to pronunciation and Paul will want to hand-fix words.
   - Dump the current parameter set + phoneme strings as a JS object literal, ready to paste. THE LAB
     IS THE PORTING SOURCE.

3. The 20 lines (Paul's phrasing — VERBATIM):
   Health low:    "Aw, man, we are taking a beating." / "Hull integrity is critical." /
                  "Somebody patch that hole."
   Health relief: "We're okay for now." / "Crisis averted." /
                  "Nothing a little Duct Tape can't handle."
   Health full:   "Like a brand new ship." / "It doesn't get any better than this." /
                  "Not a scratch on it."
   Collected:     "We got a triple shot." / "Rapid shot acquired." / "A bigger pooper scooper." /
                  "Now we're more attractive." / "A few more horsepower."
   Expired:       "Triple shot is gone." / "Rapid shot is gone." / "Garbage scoop got smaller." /
                  "Magnet power is gone." / "Engine's a little less peppy."
   Dock:          "There's at least 5 good pieces in there." / "That's somewhere around a dozen." /
                  "Special delivery." / "I'm not sure I can count that high."
   Full:          "Truck is full, let's go."
   (That's 25 including the dock/full tiers — build them all; they're the real test corpus.)

4. THE FALLBACKS ARE PART OF THE DESIGN, NOT A FAILURE. If clean intelligibility can't be reached,
   the honest options are:
     (a) LEAN IN — a deliberately robotic / comms-static character. Dan on a crackly radio. This FITS
         the fiction, and a band-limited, slightly distorted voice is often MORE intelligible than a
         thin clean formant synth, not less. Build a "radio" processing chain (bandpass ~300-3400Hz,
         soft clip, a touch of noise) as a toggle IN THE LAB so Paul can A/B it.
     (b) CAPTION each line on screen, making the audio flavour rather than information.
   Build (a) INTO THE LAB. Surface (b) to Paul as a question. DO NOT ship something unintelligible
   and hope.

5. This phase ENDS with a report to Paul: what you achieved, what the honest intelligibility ceiling
   is, which fallback (if any) you recommend, and a link to the lab. NOTHING ENTERS THE GAME BUILD
   UNTIL PAUL HAS HEARD IT AND SIGNED OFF. That is FLAG-11a and it is not negotiable.

6. Docs: STATUS.md — the lab exists, what it does, what it sounds like, what it can't do.
   Add tools/voice-lab.html to CLAUDE.md's "Design instruments" section.
   No GDD change (nothing shipped).
```

**Commit:** `CS010 P8: tools/voice-lab.html — formant-synthesis instrument for Dan's voice (lab only, nothing in the build)`

---

## P9 — VoiceSys integration — ONLY ON SIGN-OFF OF P8

**Model:** **Opus · extended thinking.** A new persistent system with hooks across a dozen sites.

**Depends on:** P8 sign-off, **P3** (reuses the `lowHpSiren` latch), **P4** (the slider's screen).

### Prompt

```
CS010 Phase 9 — VoiceSys: Dan speaks (spec: PLANNED-FEATURES-CS010.md §11b-§11f; FORK-5 = fire on
the pop that empties the chain).

Read STATUS.md first. Do not start this phase unless Paul has signed off on P8's lab.

Port the engine and the phrase data from tools/voice-lab.html VERBATIM. Do not re-tune in the game
file — same rule as MusicSys/music-lab.

1. ARCHITECTURE (§11b):
   - NEW `VoiceSys` module, ALONGSIDE AudioSys and MusicSys — NOT inside AudioSys, which is a flat bag
     of one-shot voices and must not grow a sequencer. MusicSys is the exact precedent; read it first.
   - Guard every entry point with `if (!AudioSys.ctx) return;` like every other voice in the codebase.
   - LINES ARE DATA: one table keyed by event, each event holding an ARRAY of alternatives. Adding a
     new line for an existing event must be a ONE-LINE DATA EDIT. Paul wants to add variety later —
     design for it now.
   - Selection (§11d): PLAIN RANDOM PICK each time. Not a shuffle bag. Paul's call.

2. THE VOICE BUS IS FOUR SITES, NOT ONE. The spec says one. IT IS WRONG. Verify each:
   (a) `AudioSys.vol` literal — currently `{ master: 1, sfx: 1, music: 1 }`. Add `voice: 1`.
   (b) `AudioSys.init()` — `this.voice = ctx.createGain(); this.voice.gain.value = this.vol.voice;
       this.voice.connect(this.master);` mirroring the sfx/music buses.
   (c) `AudioSys.setVol()` — its node picker is
       `cat === "master" ? this.master : cat === "sfx" ? this.sfx : this.music`.
       AS WRITTEN, setVol("voice", v) WOULD SILENTLY WRITE TO THE MUSIC GAIN. Replace the ternary
       chain with a lookup (`this[cat]`, or an explicit map) so it cannot happen again.
   (d) `loadSettings()` — its volume loop is a HARDCODED `for (const c of ["master","sfx","music"])`.
       Miss it and voice volume never persists. Derive it from the vol object's keys, or add "voice".
   Volume slider (§11c): a Voice Volume row on P4's Sound/Music screen — SOUND_ROWS + VOL_LABELS +
   VOL_CATS all grow together, keeping the parallel arrays paired. Persisted ADDITIVELY into the
   FROZEN afd_settings_v1 (no schema bump), like every setting before it.

3. COOLDOWN / PRIORITY (§11e) — design this, don't hack it:
   - A GLOBAL cooldown (`VOICE_COOLDOWN`, PLAYTEST KNOB): no line starts while one is playing, or
     within N seconds of the last one ending.
   - A PRIORITY per event class, so a high-priority line (hull critical) can PRE-EMPT a low-priority
     one (powerup expired) rather than being dropped.
   - SUPERSEDED LINES DROP. THEY DO NOT QUEUE. A queue means Dan narrating events that finished ten
     seconds ago — worse than silence.
   Test the burst case explicitly: take a hit -> drop to low health -> grab a powerup, all inside one
   second.

4. TRIGGERS AND THEIR ANCHORS — every one of these is verified; use them, don't invent your own:

   HEALTH LOW (rising edge) / HEALTH RELIEF (falling edge): REUSE the existing edge-detect latch in
   update() (`game.lowHpSiren`, ≈L3661-3666). DO NOT ADD A SECOND LATCH FOR THE SIREN. P3 already
   advances game.lowHpPhase and arms game.hpReliefFlash at that same site — hook alongside, don't
   restructure.
   NOTE: P3 SHIPPED A VISUAL RELIEF CUE (the HULL-ring exhale pop). Dan's `"We're okay for now."` is
   ADDITIVE to it — do NOT remove the flash and do NOT gate it on voice being unavailable. Onset
   already carries four tells (siren, chevron, red ring, corner glow); relief carrying two is not
   redundancy, it's parity.

   ⚠ THE RISING EDGE RE-FIRES ON EVERY UNPAUSE — the spec does not anticipate this and it will make
   Dan repeat himself. `game.lowHpSiren` is torn down DIRECTLY by openPause (≈L1461) and
   quitToTitle (≈L1475) so the siren doesn't drone through a menu. So: pause while at low HP, resume,
   and update()'s rising-edge branch fires AGAIN — which is correct for the SIREN (it must restart)
   and WRONG for the VOICE (Dan re-announces "Hull integrity is critical." every single unpause).
   VOICE_COOLDOWN will not save you; the player can be paused for minutes.
   FIX: give the voice its OWN latch (e.g. `game.lowHpVoiced`) that is NOT cleared by openPause or
   quitToTitle. Clear it ONLY on the genuine falling edge and in startGame(). Set it when the line
   fires. The siren latch and the voice latch answer different questions ("is the tone playing?" vs
   "has Dan already said this?") and must not be the same boolean. Verify this pattern against the
   OTHER trigger classes too — anything hooked to a latch that a menu tears down has the same bug.

   HEALTH FULL: THE SPEC IS WRONG HERE. It claims applyPowerup("health") "already special-cases a
   full-HP pickup (pays a bonus instead of healing)." IT DOES NOT — that branch is a bare
   `hp = Math.min(SHIP_MAX_HP, hp + POWERUP_HEALTH_AMOUNT)`. There is NO existing seam. So:
     - Add your OWN edge-detect latch (e.g. game.hpFullVoice), next to the lowHpSiren latch in
       update(), same idiom, ONE site.
     - The predicate is `hp >= SHIP_MAX_HP` (matching the HUD's `hpMax`), NOT `=== SHIP_MAX_HP`.
     - MUST be edge-detected, or it fires every frame while healthy.
     - It must fire for healing from ANY source — the Health powerup AND addScore()'s REPAIR_MILESTONE
       hull repair. Latching in update() gets you both for free. That's why it goes there.

   POWERUP COLLECTED: applyPowerup(type). NOTE "scoop" is handled in its OWN EARLY-RETURN BRANCH,
   before the health/timed branches — hook "A bigger pooper scooper." THERE, not in the timed path.
   v3.6 P4 made powerups BANK (`+=` on a same-type pickup) and CS009 added a bank-flash HUD tell, so a
   same-type pickup while already active RE-FIRES the collected line. That's fine — but make sure the
   §11e cooldown survives a rapid double-pickup, and say in STATUS.md that you decided it.

   POWERUP EXPIRED: ROUTE THROUGH `powerActive(type)` — the single predicate every "is this live?"
   read goes through. It correctly handles BOTH time mode AND count mode (shots/pieces). Hooking
   game.powerFx directly would SILENTLY MISS THE COUNT MODES. Detect the falling edge of
   powerActive(t) per type.

   SCOOP LOST A LEVEL: NOT timed — it decays by DAMAGE (SCOOP_HITS_PER_LEVEL = 5 non-lethal hits, in
   damageShip ≈L3324-3330, which already pushes a "SCOOP -1" float and plays AudioSys.scooploss()).
   Hook "Garbage scoop got smaller." THERE.

   RECYCLING AT THE DOCK (FORK-5 = b): fire on the pop that EMPTIES the chain. The hook is right after
   `const node = game.chain.pop();` in the dock-offload block — at the bottom of that tick, if
   `game.chain.length === 0`, speak the tier for the CURRENT game.deliveryCount.
   NO LATCH IS NEEDED, and don't add one: the offload block only runs while chain.length > 0, so the
   emptying pop happens exactly once and cannot recur until the player re-loads. THE GATE IS THE LATCH.
   Verified: the `dist > dock.radius + 40` reset does NOT fire while the ship sits at the dock with an
   empty chain, so deliveryCount is intact at that instant.
   Tiers (inclusive, by pieces delivered this visit):
     5-9   "There's at least 5 good pieces in there."
     10-14 "That's somewhere around a dozen."
     15-19 "Special delivery."
     20+   "I'm not sure I can count that high."
   A 1-4 piece visit says NOTHING. Intentional.
   breakChain() and scatterChain() ALSO zero deliveryCount. THEY MUST NOT FIRE A LINE.

   TOWING CAPACITY FULL: "Truck is full, let's go." The pickup gate is
   `game.chain.length < game.cargoMax && (in range)`. Fire on the pickup where chain.length BECOMES
   cargoMax. It CANNOT re-fire (the gate blocks further pickups once full) and it re-arms naturally
   after a delivery. DON'T ADD A LATCH — THE GATE IS THE LATCH.
   BUT: the CLUMP-SCOOP branch pushes SEVERAL nodes at once (`take = Math.min(room, g.pieces)`).
   Confirm the line trips correctly and EXACTLY ONCE when a clump fills the chain. Put the check
   after the if/else, inside the capture branch, so both paths hit it.
   READ THE RUNTIME game.cargoMax, NEVER A CONSTANT — it grows CARGO_BASE 12 -> CARGO_CAP_MAX 24
   during a run, so "full" is a moving target.

5. Headless: node --check. Every trigger asserted by DRIVING THE REAL CODE (startGame + update, never
   an inlined copy): each edge fires exactly once; **pausing and resuming while at low HP does NOT
   re-fire the hull-critical line** (the lowHpVoiced latch from step 4 — assert it explicitly, this
   is the one that will regress); the relief line fires on the falling edge and P3's hpReliefFlash
   still arms alongside it; breakChain/scatterChain fire nothing; a clump-scoop that fills the chain
   fires "full" exactly once; the cooldown drops (not queues) a superseded line; a higher-priority
   line pre-empts a lower one; setVol("voice", 0.5) moves the VOICE gain and NOT the music gain;
   voice volume round-trips through afd_settings_v1 and defaults to 1 when the key is missing.
   VoiceSys must be a total no-op with AudioSys.ctx null (that's what makes it headless-safe).

6. Docs: a new GDD §2 subsection for VoiceSys + a row in the §3 Architecture Map (alongside
   AudioSys/MusicSys), CLAUDE.md (VoiceSys's non-negotiables: lines are data; route expiry through
   powerActive; never queue), GDD-VERSION-HISTORY.md, STATUS.md.
```

**Commit:** `CS010 P9: VoiceSys — Dan speaks; voice bus + volume slider, 25 lines across 8 trigger classes`

---

## 4. Model / effort summary

| Phase | Model | Thinking | Why |
|---|---|---|---|
| P0 | Sonnet | standard | One constant, one draw call. |
| P1 | Sonnet | standard | Render-only — but **gated on a lab look** (FLAG-7a) before the port. |
| P2 | **Opus** | **extended** | Physics retune + new persistent setting + a stability stress + a proposal Paul must rule on. |
| P3 | **Opus** | **extended** | Reverses a documented CS009 decision; new shared rate/phase primitive; a look-call. |
| P4 | Sonnet | **extended** | Mechanical, but this is the exact index-fragile family that has broken twice. |
| P5 | Sonnet | standard | Presentation — with one layout trap, already named. |
| P6 | **Opus** | standard | Composition. Aesthetic phase. |
| P7 | **Opus** | standard | Composition + one genuine architectural change (`musicStateFor`). |
| P8 | **Opus** | **extended** | Hardest problem in the changeset. Lab only. |
| P9 | **Opus** | **extended** | New persistent system, hooks across a dozen sites, four-site audio bus. |

---

## 5. Out of scope for CS010 (from spec §12 — restated so no phase drifts)

- Re-arming the difficulty-gated music intensity system (stays dormant; machinery preserved).
- Any change to Zen, Derelict, or Beacon.
- A remote leaderboard (the `afd_scores_v1` wire shape already accommodates one).
- Renaming any `localStorage` key — `afd_settings_v1` / `afd_achievements_v2` / `afd_scores_v1` are **frozen**.
- Splitting the single HTML file into modules (deliberately deferred, again).
- Any change to `inScoopBox()`'s capture math (§7 is render-only).
- Migrating existing high-score records' `build` field (§2).
- Any rework of CS009's HUD **beyond** what §5 forces.
- **Re-flowing the gameover screen** to fit a larger score table (surfaced in P5 — flag it, don't do it).

## 6. Open questions carried to Paul

**Nothing here blocks a phase from starting.** All five forks are signed off; FLAG-CS010-a is
resolved (the relief cue ships in P3). Everything below is answered *after* the phase reports, in a
browser.

| # | Question | Where | When |
|---|---|---|---|
| **FLAG-CS010-d** | `CARGO_TURN` ships at **0.0** (dormant). P2 delivers a table of turn-rate multipliers at chain mass 6/12/24 for candidate values — pick one. | P2 | After P2 reports. |
| **FLAG-CS010-e** | At 180% the browsable table dwarfs the gameover one (left at 1.0). Live with it, or re-flow gameover in a later changeset? | P5 | After P5, in a browser. |
| **FLAG-CS010-b** | Should the celebratory track also play on the **gameover** post-entry table? Today gameover is deliberately silent. Specced as *no*. | P7 | After P7, in a browser. |
| **FLAG-7a** | Does the prong-V still read right at the current `SCOOP_CONFIG` 5.0/60 (it was designed at 3.0/36)? P1 stops and reports if it doesn't. | P1 | In-flight, at the lab. |
| **FLAG-CS010-f** | `LOWHP_RELIEF_FLASH` duration + pop magnitude — pure look-call, needs eyes. | P3 | After P3, in a browser. |

**Resolved during planning:** FORK-1 – FORK-5 (all signed off, §0) · FLAG-CS010-a (relief cue: build
it, P3 step 7) · FLAG-CS010-c (glow render: FILL, no mode knob).