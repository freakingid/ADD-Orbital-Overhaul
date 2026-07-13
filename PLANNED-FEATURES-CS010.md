# Orbital Overhaul — Changeset 10 (CS010) — Planned Features

**Target version:** `v1.0.0.10` (see FORK-1)
**Predecessor:** CS009 (HUD rebuild), shipped at `fef7ea2`.
**Anchors verified against:** `asteroids-deluxe.html` @ `fef7ea2` — the live `origin/main` HEAD,
CS009 P7 included. Line numbers below are from that build.

> Standing rule: **re-grep before writing anything.** Line numbers shift; symbols are the contract.

---

## 1. Scope summary

- **Versioning** (§2) — real semver, visible on the title screen.
- **Feel** (§3, §4) — towed mass matters more; the Engine powerup becomes noticeable as a consequence.
- **Music** (§6, §8c) — Drift and Warehouse get longer, varied loops; a new sixth track for the
  high-score screen.
- **Presentation** (§5, §7) — low-health corner glow; the scoop reverts to a prong-V.
- **New system** (§11) — Dan's synthesized voice lines.
- **UI** (§8, §9, §10) — high scores nested under Options and rendered larger; a Sound/Music
  sub-dialog; a ship-rotation-speed slider.

**The two hardest problems in this changeset are §5 (which collides head-on with a CS009 design
decision) and §11 (synthesized speech). Everything else is comparatively routine.**

---

## 2. Versioning (`GAME_VERSION`)

### Current state (verified @ fef7ea2)
- `const GAME_VERSION = "3.6";` — **L204**.
- **Not rendered anywhere on screen.**
- **Is** stamped into every high-score record's `build` field (**L3229**), inside the wire shape
  `{ v, id, initials, score, wave, delivered, ts, build }` persisted to `afd_scores_v1`.

### Target
- `GAME_VERSION` becomes a **single combined string**: `"1.0.0.10"`.
- Scheme: **Major . Minor . Patch . Changeset**
  - **Major** — new mechanics, new levels.
  - **Minor** — tweaks to existing systems (music, mechanics, artwork).
  - **Patch** — bug fixes, where "bug" includes *the game not doing what the design intends*, not
    just crashes.
  - **Changeset** — monotonically increasing, never resets.
- Rendered in the **lower-right corner of the title screen**, format `v1.0.0.10`. Small, dim
  (`COLOR.dim`) — a build stamp, not a design element.
- Title screen draws at **L4406+** (`drawText("ORBITAL", …)` etc.). Viewport is **1280×720**.

### Notes
- Existing records carry `build: "3.6"`. **Leave them.** `build` is a free-form string by design; a
  mixed table is expected and harmless. **Do not migrate.**
- `afd_settings_v1` / `afd_achievements_v2` / `afd_scores_v1` remain **frozen** key names.

### Doc convention (already in force)
CS009 archived as `archive/PLANNED-FEATURES-CS009.md` / `archive/IMPLEMENTATION-PHASES-CS009.md`.
CS010 follows: **`PLANNED-FEATURES-CS010.md` / `IMPLEMENTATION-PHASES-CS010.md`** — changeset number,
zero-padded to three digits. Older `-vX.X` archives keep their names; don't rewrite history.

> **FORK-1 — the version number itself.**
> Paul's notes say `v1.0.0.9`, but also that this is **changeset 10** (CS009 = the HUD rebuild, now
> shipped). The 4th segment *is* the changeset number, so those conflict.
> **Specced as `v1.0.0.10`.** CS009 shipped with no version stamp at all (`GAME_VERSION` is still
> `"3.6"`), so the visible history simply starts at `v1.0.0.10`. Paul to overrule if he meant
> something else.

---

## 3. Towed mass should actually be felt

### The real complaint
Paul: *"the effect of garbage mass being towed doesn't seem to affect the ship that much anyway…
mass is not increasing inertia a noticeable amount."*

This is the **root cause** of the Engine complaint (§4). Engine's entire effect is halving
`chainMass()`. If mass barely matters, halving it barely matters. **Fix §3 and §4 fixes itself.**

### Current state (verified @ fef7ea2)
```
const CARGO_MASS   = 0.07;   // L292 — tug mass-factor per unit towed mass
const CARGO_THRUST = 0.06;   // L293 — thrust divisor per unit towed mass
const CARGO_MAXSPD = 0.03;   // L294 — max-speed divisor per unit towed mass
```
Consumed at exactly three sites:
- `Ship.update()`: `thrustMul = 1 / (1 + cargo * CARGO_THRUST)`,
  `maxSp = SHIP_MAX_SPEED / (1 + cargo * CARGO_MAXSPD)`
- `updateChain()`: `massFactor = Math.min(1.4, chainMass() * CARGO_MASS)`

**Why they're so soft:** v3.0 P6 raised the tow cap from a fixed 12 to a growing
`CARGO_BASE 12 → CARGO_CAP_MAX 24`, and *deliberately softened all three in lock-step* so a **full
chain at 24** would land on the **old full-12 feel** (~45% thrust / ~63% top speed). The arithmetic
worked. The side effect: a **typical** 6–12 node chain — what you actually fly around with — is now
far lighter than a 12-node chain used to be.

| Chain mass | thrust mult | top-speed mult |
|---|---|---|
| 0 | 100% | 100% |
| 6 | 73.5% | 84.7% |
| 12 | 58.1% | 73.5% |
| 24 (full) | 40.9% | 58.1% |

The penalty is real but it's a **smooth divisor with no bite in the low-to-mid range** — precisely
what Paul is describing.

### Target
Raise the mass penalty so a mid-sized haul is genuinely felt, **without** making a full 24-node chain
unflyable. All three are **PLAYTEST KNOBS** — comment them as such, and do **not** over-specify final
numbers here.

**The deeper question the implementing session should raise rather than quietly answer:** the
divisor shape `1/(1 + m·k)` **asymptotes**, so it can never bite hard no matter the coefficient.
If raising `CARGO_THRUST`/`CARGO_MAXSPD` doesn't deliver "inertia," the *shape* is the problem, not
the constant. Options worth proposing to Paul (**do not silently change the formula**):
- a steeper early falloff,
- a small **turn-rate** penalty under load (mass resisting rotation is what "inertia" actually
  means, and turn rate is currently completely unaffected by cargo — see §10b, which touches the
  same two lines),
- an added acceleration lag.

`CARGO_MASS` feeds the momentum tug and is **capped at 1.4**, saturating around m ≈ 20. Raising it
just makes it saturate earlier — no *new* stability risk, the cap is the guard. But:

> **FLAG-3a — do not skip.** GDD §3.4's chain-stability envelope was validated at **24 nodes /
> `CHAIN_ITER` 4**, worst-case link stretch ≈ 4.11 px on a 20 px `CHAIN_LINK`, **under the current
> coefficients**. If `CARGO_MASS` changes, **re-run the stress** (900 frames, hard thrust-flips
> across a world wrap, 24 nodes; assert no NaN, no velocity blowup, worst-case stretch under ~5 px)
> and **report the measured number either way.** Do not assume the envelope holds.

---

## 4. Engine powerup

### Current state (verified @ fef7ea2)
- `const ENGINE_MASS_MULT = 0.5;` — **L397**.
- `chainMass()` returns `powerActive("engine") ? m * 0.5 : m`. **That is the entire effect.**
  `chainMass()` is the single quantity feeding `thrustMul`, `maxSp`, and the tug's `massFactor`, so
  halving it eases all three at once.
- Duration: shared `POWERUP_DURATION = 15` s. Engine is **always timed** — no count-budget mode, not
  configurable in the Difficulty screen.
- **With an empty chain, Engine does literally nothing** (`chainMass()` of an empty chain is 0).
  This is almost certainly why it reads as inert.

### Target — resolved
**Identity stays "makes hauling easier."** No always-on thrust/turn bonus. `ENGINE_MASS_MULT = 0.5`
**stays** — Paul is happy with the magnitude.

**The fix is entirely §3.** Tune §3 first, then re-judge §4. There may be no §4 code change at all.

> **FLAG-4a:** Engine remains a no-op when picked up with an empty chain. **Accepted, not fixed.**
> Note that Dan's `"A few more horsepower."` line (§11) plus CS009's powerup HUD ring at least make
> the *pickup* legible even when the *effect* is nil.

---

## 5. Low-health corner glow ⚠️ **THE CONTENTIOUS ONE**

### Current state (verified @ fef7ea2)
- `LOW_HP_THRESHOLD = 100` (**L164**) — 40% of `SHIP_MAX_HP` (250). The low-health state is a **pure
  per-frame read**, no stored flag.
- **Audio siren** (`AudioSys.lowhp(on)` / `lowhpSet(t)`): root sine + harmonic partner through an
  amplitude-LFO pulse gain. Urgency `t = 1 − hp / LOW_HP_THRESHOLD`. Pulse rate ramps
  **`LOWHP_PULSE_RATE_MIN` 0.9 Hz → `LOWHP_PULSE_RATE_MAX` 2.4 Hz** with `t`. `lowhpSet(t)` is called
  **every frame** from one edge-detect site in `update()`.
- **Red directional chevron** to the nearest Health powerup still exists (**L4659**, orbit radius 58,
  `COLOR.lowhp`).
- **CS009 added a critical-hull pulse.** `hpCrit = game.ship.hp <= LOW_HP_THRESHOLD` (**same
  threshold**) turns the HULL ring `COLOR.lowhp` and pulses its alpha:
  ```
  ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now()/1000 * TAU * HUD_PULSE_HZ);   // L4526
  ```
  with, verbatim from the code (**L227–228**):
  ```
  const HUD_PULSE_HZ = 1.2;  // pulse rate for critical/max/full-cargo states — constant, bound to
                             // nothing else (the audio siren already ramps its own rate with HP)
  ```

### ⚠️ CONFLICT-A — CS009 explicitly decided *not* to do what Paul is now asking for
CS009 chose a **flat 1.2 Hz** HUD pulse and **wrote the reasoning into the code**: the siren already
ramps, so the visual deliberately doesn't. Paul now wants the corner glow **synced to the siren's
variable rate**.

Those two things cannot both be true on the same screen without something looking wrong: at
`hp = 100` the glow pulses at 0.9 Hz while the hull ring pulses at 1.2 Hz; near death the glow hits
2.4 Hz while the ring is still at 1.2. **Two red elements, driven by the same threshold, beating in
and out of phase.** That is not a subtle artifact — it's the most visually noisy thing on screen at
the most stressful moment of the game.

> **FORK-2 — how do the two red pulses reconcile?**
> - **(a) Sync everything to the siren.** Change `HUD_PULSE_HZ` from a constant into the same
>   `t`-driven rate the siren uses, so hull ring **and** corner glow **and** audio all pulse as one.
>   Extract `lowhpPulseRate(t)` as **one shared helper** read by all three. **Reverses a CS009
>   decision**, but it is the only option where the screen reads as a single coherent alarm.
>   *(Note: `HUD_PULSE_HZ` also drives the **max-hull** and **full-cargo** pulses, which have nothing
>   to do with HP. Those must keep a constant rate — so this becomes "critical-hull pulses on `t`;
>   the other two stay flat," i.e. a second rate, not a replacement.)*
> - **(b) Corner glow pulses at the flat `HUD_PULSE_HZ` too.** Ignores Paul's "sync to the siren"
>   instruction, but the screen stays coherent and CS009's decision stands.
> - **(c) Ship it as asked and playtest the beat.** Cheapest; may look broken.
>
> **Recommendation: (a).** It's what Paul actually asked for, and it makes the alarm one instrument
> instead of three. But it **reverses a decision CS009 made deliberately and documented in code**, so
> it needs Paul's explicit sign-off — and the CS009 comment at L227–228 must be **rewritten, not left
> standing**, or the next session will find a comment contradicting the code.

### ⚠️ CONFLICT-B — CS009 *hardened* the no-fills rule one changeset ago
`CLAUDE.md` now reads (verbatim):
> **The HUD draws with `glowStroke` like everything else — no `fillRect`, no `strokeRect`.** The
> CS009 HUD rebuild (P0–P6) replaced every hull/… bar/rect… Don't reintroduce a bar/rect for a new
> HUD element; follow the ring idiom instead.

GDD **§3.2** now names exactly **three** surviving fill exceptions: (1) the scoop capture box,
(2) the death-spectacle white flash, (3) the SCOOP pip row's 4px dots.

A soft radial-gradient corner glow is **a fill**, and it lands directly on a rule that was tightened
*last changeset*.

> **FORK-3 — how is the glow rendered?**
> - **(a) A named 4th exception.** Radial-gradient fills at the four corners. Looks best; requires
>   amending both CLAUDE.md and GDD §3.2 **in the same commit**, with the reasoning recorded so a
>   future cleanup pass doesn't strip it.
> - **(b) Stroke-only, in the ring idiom.** Corner arcs via `glowStroke` / `drawRingArc` — obeys the
>   rule as written, reuses CS009's own vocabulary, and will read as *part of* the new HUD rather
>   than a foreign element bolted on.
>
> **Recommendation: (b) first — try it before asking for an exception.** CS009's whole HUD is glow
> arcs; corner arcs pulsing red would look native. If it can't carry the intensity Paul wants, escalate
> to (a) as a deliberate, documented 4th exception. **Don't default to a fill just because it's easier.**
>
> Convenient bookkeeping note: §7 **deletes** exception (1) (the scoop box). So the exception count
> goes 3 → 2, and §5(a) would take it back to 3. §3.2's list must be **rewritten**, not edited.

### Corner occupancy (verified — the corners are not empty)
Viewport **1280×720**.
- **Top-right:** HULL / CARGO rings — `HUD_HULL_CX 1156`, `HUD_CARGO_CX 1232`, `HUD_RING_CY 74`,
  `HUD_RING_R 30`, labels at `HUD_RING_LABEL_Y 122`.
- **Bottom-left:** powerup rows + SCOOP pips — stacking **upward** from `HUD_FX_BASE_Y 640`,
  x ≈ 40–140.
- **Top-left:** score / level readout.

**Two of the four corners are occupied, and one of them (top-right) is the very hull ring that will
be pulsing red at the same time.** Size the glow so it frames rather than fights. This is a look-call;
**it needs eyes in a browser, not just a passing test.**

### Behavior (settled)
- **Sync:** the glow's phase must come from a **shared phase accumulator** (e.g. `game.lowHpPhase`,
  advanced by `2π · rate(t) · dt` while engaged, reset on disengage) — **never** by reading a Web
  Audio LFO node's value. AudioParam values aren't reliably readable and `ctx` may be `null` (no user
  gesture yet). **The glow must render with audio unavailable.**
- **One formula, one place.** Whatever rate function is chosen, audio and visual read **the same
  helper**. Duplicating the min/max interpolation is exactly the drift this codebase has been bitten
  by before.
- **Intensity scales with `t` as well as rate** — near death it should be *brighter*, not merely
  *faster*. New knobs `LOWHP_GLOW_*`, commented as PLAYTEST KNOBS.
- **Engages and disengages on the exact same predicate as the siren.** Reuse the existing
  `game.lowHpSiren` edge-detect latch in `update()` — **do not add a second latch.**
- **The chevron stays.** The corner glow is additive.
- **Relief cue = Dan's voice line only** (§11). No new SFX.

---

## 6. Music: Drift and Warehouse loop too tightly

### Current state (verified @ fef7ea2)
Five synthesized step-sequencer tracks feeding `MusicSys`'s Web Audio lookahead scheduler.

| Track | Builder | Loop | Verdict |
|---|---|---|---|
| Beacon (title) | `buildBeaconTitle()` | ~21.8 s | leave alone |
| Zen (default) | `buildZenTrack()` | 48 s | leave alone |
| Derelict | `buildDerelictTrack()` | 24 s | leave alone (no beat) |
| **Drift** | `buildDriftTrack()` | ~21.8 s | **fix** |
| **Warehouse** | `buildWarehouseTrack()` | 23 s | **fix** |

Registered by name in `MUSIC_TRACKS` (**~L951**). Data shape:
`{ stepDur, steps, layers: [{ type, gain, steps: [cell|null] }] }`, built via shared `mk`/`put`/`hit`.

Drift is `BARS = 8, SPB = 16, STEPS = 128, stepDur = 0.17` over one 8-chord progression
(Am F C G Am F Dm E) with a 16th-note organ arp — **the same 8 bars, forever**. Warehouse is the same
story with a house groove and, by design, **no melodic hook at all**.

### Target — resolved
**Only Drift and Warehouse.** Make the loops **longer, with real variation inside — a chorus /
B-section.** Not an ambient interlude (**rejected**).

Extend `BARS` and give the added bars **different chord movement and/or a different layer
arrangement**, so the loop has an A → B (→ A) shape rather than one repeating cell. Warehouse has
**no hook by design** — the round-2 `tools/music-lab.html` data still contains **a hook layer that
was cut**. **Consider dropping it back in as the B-section's payload** rather than composing fresh.

### Non-negotiables
- **Tracks are DATA.** `MusicSys.update()` / `scheduleStep()` and the `layerGates` gain-gating are
  **not to be modified**. `playNote()`'s voice branch is the one extension point. *(Standing
  `CLAUDE.md` rule.)*
- **The intensity system stays dormant.** No `tier` fields. `setIntensity()` stays a no-op.
  `MUSIC_LAYER_THRESHOLD` / `layerGates` / the `nextWave()` call site stay intact so re-arming is
  data-only later. **Do not re-arm it here.**
- Existing test guarantees in `scratchpad/test-v34-p6.js` must still hold:
  - every loop ≥ 10 s
  - no gap longer than **one step** where nothing sounds across any layer (checked **circularly**)
  - worst-case node creation for a single scheduled step **≤ 16** (current worst: **13**, Zen step 0)
- **FLAG-6a:** longer loops with more layers can push that node budget. **Measure it, don't assume.**
- Track *names* stay `zen` / `derelict` / `drift` / `warehouse`. `settings.musicTrack` and
  `afd_settings_v1` unchanged. Existing saves keep working.

### Workflow
Compose and audition in **`tools/music-lab.html`** (the established design-instrument pattern), then
port the builders **verbatim**. **Do not compose blind in the game file.**

---

## 7. Scoop render: revert to the prong-V

### Current state (verified @ fef7ea2)
The "debug square" is **not debug scaffolding.** It's the **scoop-mouth capture box**, shipped
deliberately in v3.6 P1c and documented in GDD §2.14.1 and §3.2 as **fills-exception (1)**.
`Ship.draw()` (**~L1940–1950**) draws the exact `inScoopBox()` rectangle — corners
`[[-SHIP_RADIUS,-hw],[d,-hw],[d,hw],[-SHIP_RADIUS,hw]]` — as a translucent `COLOR.dock` fill
(`globalAlpha 0.15`, **L1946–1947**) plus a `glowStroke` outline.

**GDD §2.14.1 records the code it replaced, verbatim:** an open `drawPoly` V,
**`[[d,-hw],[16,0],[d,hw]]`** — throat at the ship's nose `(16,0)`, flaring forward to ±width/2 at
mouth depth `d`, in `COLOR.dock`, **not closed, no fill**.

### Target — resolved
**Revert to the prong-V.** Delete the box fill and outline. Show only the prongs.

### Do NOT touch
- `inScoopBox()` — the capture math is **unchanged**. **This is render-only.**
- `SCOOP_CONFIG`, `SCOOP_WIDTH`, `SCOOP_DEPTH`, `buildScoopSteps()`, and the load-time
  `SCOOP_WIDTH[0] !== 0` **throw** (a deliberate invariant guard, not test scaffolding — standing
  `CLAUDE.md` rule).
- Scoop damage-decay, HUD pips, drop weighting.

### Consequence, stated honestly
The prong-V **never showed the mouth's true rear edge** at `forward = -SHIP_RADIUS`. That was the
stated reason v3.6 P1c replaced it. Reverting means **going back to a render that doesn't tell the
whole truth about the capture region.** Paul has decided the cleaner look is worth it. **Record it in
GDD §2.14.1 as a deliberate supersession with the history preserved** — that bullet has already been
rewritten three times; don't let a future session "fix" it back a fourth.

### Scale check
v3.6 P1c **also** grew the mouth: `maxWidthMult` 3.0 → **5.0**, `maxDepth` 36 → **60**. The V was
designed at the **old** 3.0/36 scale. At 5.0/60 it may look enormous or proportionally wrong.

> **FLAG-7a:** Re-audition the V at the **current** `SCOOP_CONFIG` in `tools/scoop-lab.html`.
> **`tools/scoop-lab.html` carries its own duplicate copy of the box render** (GDD §2.14.1 says so
> explicitly) — **it must be reverted to the V too**, in the same commit, or the lab previews
> something the game no longer draws.

### GDD §3.2 bookkeeping
Removing the box removes **exception (1) of three**. §5 may add one back. §3.2's exception list must
be **rewritten**, not edited — and `CLAUDE.md`'s no-fills paragraph checked for a stale reference.

---

## 8. High scores

### Current state (verified @ fef7ea2)
- `HighScores` module, own frozen key `afd_scores_v1`, `SCORES_MAX = 10`.
- `drawScoreTable(cx, topY, highlightId)` — **unchanged by CS009**. Columns rank / initials / score /
  level / delivered, **all at font size 13**, row pitch **18 px**, header 13. Column x-offsets
  `cx-230, cx-170, cx+10, cx+130, cx+230`.
- `drawHighScores()` — `menuPanel(640, 460, "HIGH SCORES")`, table at `y + 90`.
- Reachable **only** from `MENU_ROOT_SYS` (**L1427**) — the title/gameover system menu. **Not** from
  Options, and **not** while paused mid-game.

### 8a. Font size — resolved
Render at **~180%**: font 13 → **~23**, row pitch 18 → **~32**, header likewise. **Panel stays
640×460** (Paul: currently fine) — but **verify** 10 rows + header + footer still fit at the larger
pitch. If they don't, **grow the panel rather than shrink the font.** Column x-offsets must widen to
match the bigger glyphs.

`drawScoreTable` has **two** callers: the gameover post-entry table and the browsable screen. Both
get the larger type. **Re-grep to confirm there isn't a third.**

### 8b. Reachability — resolved
High Scores becomes **nested inside Options**: `Options > High Scores`. Because Options is reachable
from **both** the system menu (title/gameover) **and** the pause menu mid-game, this single change
makes the table reachable in **both** contexts — which the root-only entry never did.

> **FLAG-8b — TWO hardcoded Options indices will break. Both verified in the live build.**
> ```
> menuControls:     gotoScreen("options", 3)   // L1609 and L1611  -> "Controls"
> menuAchievements: gotoScreen("options", 4)   // L1564            -> "Achievements"
> ```
> `menuDifficulty` already does it correctly (`MENU_OPTIONS.indexOf("Difficulty")`, L1590/L1592).
> **Fix both to `.indexOf(label)` in the same pass.** Then grep every file in `scratchpad/` for
> hardcoded menu indices — `test-f8.js` and `test-p4.js` have already been broken by exactly this,
> twice.

### 8c. A dedicated high-score track — resolved
Compose a **new sixth track**, **celebratory**, playing while the High Scores screen is open.

**Two real problems to solve — think before coding:**

1. **`musicStateFor(s)` can't express it.** Verbatim (**L4773**):
   ```
   function musicStateFor(s) { return s === "playing" ? settings.musicTrack : s === "title" ? "title" : "off"; }
   ```
   It keys off **`game.state` alone**. The High Scores screen is a **menu** — `game.paused` is true
   while `game.state` is still `title` / `gameover` / `playing`. **`musicStateFor` must also consult
   the active menu screen.** This is the one genuine architectural question in the item.
2. **Menu ducking will mute it.** `setDuck(menuActive())` drops the bus to **50%** whenever *any*
   menu is open. A celebratory track that plays *only* while a menu is open would be **permanently
   ducked**. **Recommend exempting the High Scores screen from ducking** — there's no gameplay audio
   underneath it to duck for.

Switching in and out is a normal `setState()` **crossfade** — no new track-switch code path. The new
track is **not** added to `MUSIC_TRACK_VALUES` (the player-facing gameplay picker); it's contextual,
like `title`. `settings.musicTrack` and `afd_settings_v1` unchanged. Same data/no-tier/node-budget
constraints as §6.

> **FORK-4 — does the root-menu "High Scores" row survive?**
> Keeping it on **both** `MENU_ROOT_SYS` and `MENU_OPTIONS` means two entry points and two
> back-destinations to track. The Achievements viewer already carries a `game.menu.achReturn` field
> for exactly this reason.
> **Recommendation: REMOVE it from `MENU_ROOT_SYS`.** One entry point, one back-destination, no
> `scoreReturn` field needed — and Options is one keypress away on the title screen anyway.
> If Paul wants both, the implementing session **must** add a `scoreReturn` tracker mirroring
> `achReturn`.

---

## 9. Sound / Music sub-dialog

### Current state (verified @ fef7ea2 — CS009 did not touch the menus)
```
const MENU_OPTIONS = ["SFX Volume", "Music Volume", "Master Volume", "Music Track",
                      "Controls", "Achievements", "Difficulty", "Back"];   // L1432
const VOL_CATS = ["sfx", "music", "master"];   // PARALLEL TO THE FIRST THREE ROWS
const VOL_STEP = 0.1;
```
- `menuOptions()` dispatches **by label** (good — the v3.4 P6 refactor).
- `AudioSys` buses: `master` → destination; `sfx` → master; `music` → master. `setVol(cat, v)` picks
  the node by category.

### Target — resolved
Move **SFX Volume, Music Volume, Master Volume, Music Track** into a new **"Sound / Music"**
sub-dialog, reached via `Options > Sound / Music`. Same control style (◄/► sliders, track cycler) —
**a relocation, not a redesign.**

### Implementation notes
- Follow the **existing sub-screen pattern exactly**. `Difficulty` (`DIFFICULTY_ROWS` +
  `menuDifficulty` + `drawDifficulty`, **L1585–1595**, drawn ~L4130) is the closest template: a row
  list, a handler in `menuInput()`'s switch, a `drawX()` in `drawMenu()`'s dispatch, and a Back row
  returning to Options via `MENU_OPTIONS.indexOf(...)`.
- **`VOL_CATS`'s "parallel to the first three rows" coupling must be re-derived** against the new
  screen's row list, or replaced with label dispatch. **Do not leave a stale index assumption** —
  this is the single most likely bug in the item.
- Persistence unchanged: volumes already round-trip through `saveSettings()` / `afd_settings_v1`.
- **The new Voice Volume slider (§11) lives on this screen.**

---

## 10. Options ordering & the rotation slider

### 10a. Final `MENU_OPTIONS` — resolved
```
["Sound / Music", "Controls", "Achievements", "High Scores", "Difficulty", "Back"]
```

### 10b. Ship rotation speed — resolved
- **Current:** `const SHIP_TURN = 4.2;` (**L106**, rad/sec), read at exactly **two** sites —
  `Ship.update()` **L1859–1860** (`this.angle ∓= SHIP_TURN * dt`).
- **Target:** a player multiplier, **50% → 150% in 10% steps** (11 positions: 0.5 … 1.5).
- **Lives inside the existing Controls screen** (`menuControls`, ~L1600) — not a new screen.
- **Numeric readout.** Recommend the **percentage** (the raw rad/s figure means nothing to a player).
- **Default (100%) indicated visually** — a tick, a colour, a "(default)" tag. The player **returns
  to it manually.**

> **FLAG-10a:** `returnToDefaults()` currently resets every rebindable key/pad binding. Paul
> explicitly said rotation returns to default **manually**, so a player hitting "Return to Defaults"
> gets bindings reset but **not** rotation — arguably surprising, since the row is on the same screen.
> **Specced as Paul asked. Flagged as possibly counter-intuitive; Paul's call.**

### Implementation notes
- New `settings.shipTurnScale` (default `1.0`), persisted **additively** into the **frozen**
  `afd_settings_v1` — the established no-schema-bump pattern (`shotPowerupMode`, `magnetMode`,
  `musicTrack` all did this). Missing key → default; corrupt/out-of-range → `1.0`.
- **Route the two turn sites through one place** — a `shipTurnRate()` helper, or hoist the product
  into a local before both reads — so they cannot diverge.
- `SHIP_TURN` stays **4.2** and remains the design default. The scale is a **player preference, not a
  balance change.**
- **The v3.5 P1 `e.repeat` guard applies** — a held key nudges once, doesn't spin. The menu-open
  branch already returns early on `e.repeat`, so a new slider row inherits it for free. **Verify,
  don't assume.**
- **Cross-reference §3:** if §3 adds a cargo-dependent turn penalty, it touches **these same two
  lines**. Sequence the phases so they don't collide.

---

## 11. Dan's voice lines (the big new system)

### 11a. Synthesis — resolved, and the highest-risk item in the changeset
**Voice is SYNTHESIZED.** No audio files. The game stays a **single self-contained GPL-3.0 HTML file
with no build step** — a hard project constraint.

That means **formant synthesis in Web Audio**: a glottal source (pulse/saw at a pitch contour) through
a bank of bandpass filters at formant frequencies, sequenced across a phoneme string, with noise
bursts for fricatives/plosives. Doable — but **intelligibility is a real engineering problem**, and it
will not sound like a person.

**Required workflow — do not skip:**
1. Build **`tools/voice-lab.html`** first — a standalone harness, exactly like `tools/scoop-lab.html`
   and `tools/music-lab.html`. Type a phrase, hear it, tune formants / pitch contour / phoneme timing
   / character live. **Nothing enters the game build until Paul has heard it in the lab and signed
   off.**
2. Only then port the engine + phrase data **verbatim** into `asteroids-deluxe.html`.

If intelligibility can't be reached, the honest fallbacks are (a) lean into a deliberately robotic /
comms-static character (which fits — Dan on a crackly radio) and accept reduced clarity, or (b) pair
each line with an on-screen caption so the audio is flavour rather than information. **Surface this
to Paul rather than shipping something unintelligible.**

> **FLAG-11a:** Budget this its own phase. Gate it behind a lab sign-off. It is entirely plausible
> this is the phase that doesn't land, and the changeset should be structured so the other nine items
> ship regardless.

### 11b. Architecture
- **New `VoiceSys` module**, alongside `AudioSys` and `MusicSys` — **not inside `AudioSys`**, which is
  a flat bag of one-shot voices and must not grow a sequencer. (Exact precedent: `MusicSys`.)
- **New bus:** `AudioSys.voice = ctx.createGain(); voice.connect(master);` — mirroring the existing
  `sfx` / `music` buses. `setVol(cat, …)` gains a `"voice"` branch.
- **Lines are DATA** — a table keyed by event, each event holding an **array** of alternatives.
  **Adding a new line for an existing event must be a one-line data edit.** Paul explicitly wants to
  add variety later; design for it now.
- Guard every entry point with `if (!AudioSys.ctx) return;` like every other voice in the codebase.

### 11c. Volume — resolved
Voice gets **its own volume slider**, on the new **Sound / Music** screen (§9). New field in the
**frozen** `afd_settings_v1`, additive, no schema bump.

### 11d. Selection — resolved
Where an event has multiple lines: **plain random pick each time.** (Not a shuffle bag — Paul's call.)

### 11e. Cooldown / priority — resolved in principle, needs design
Dan must not talk over himself, and a burst of simultaneous events (take a hit → drop to low health →
grab a powerup) must not pile up.

- A **global voice cooldown** (`VOICE_COOLDOWN`, PLAYTEST KNOB): no line starts while one is playing
  or within N seconds of the last.
- A **priority per event class**, so a high-priority line (hull critical) can pre-empt a low-priority
  one (powerup expired) rather than being dropped.
- **Superseded lines DROP, they don't queue.** A queue means Dan narrating events that finished ten
  seconds ago — worse than silence.

### 11f. The lines and their triggers

**All phrasing is Paul's, verbatim. Preserve it exactly.**

#### Ship health

| Trigger | Lines |
|---|---|
| **Health is low** — rising edge of the low-health state (§5) | `"Aw, man, we are taking a beating."` · `"Hull integrity is critical."` · `"Somebody patch that hole."` |
| **Health leaves low condition** — falling edge. **This IS the relief cue** (§5) | `"We're okay for now."` · `"Crisis averted."` · `"Nothing a little Duct Tape can't handle."` |
| **Health is all the way full** | `"Like a brand new ship."` · `"It doesn't get any better than this."` · `"Not a scratch on it."` |

*Anchors:* the existing edge-detect site in `update()` (right after camera-follow) already latches the
low-health rising/falling edges for the siren via `game.lowHpSiren`. **Reuse that latch — do not add a
second one.**
*Full-health trigger:* the **rising edge** of `hp === SHIP_MAX_HP`. **Must be edge-detected**, or it
fires every frame while healthy. Note `applyPowerup("health")` already special-cases a full-HP pickup
(pays a bonus instead of healing), and CS009's HUD already flags full hull gold with a pulse
(`hpMax` → `COLOR.ach`) — **check whether that's the right seam.**

#### Powerups

| Event | Line |
|---|---|
| Triple collected | `"We got a triple shot."` |
| Rapid collected | `"Rapid shot acquired."` |
| Scoop collected | `"A bigger pooper scooper."` |
| Magnet collected | `"Now we're more attractive."` |
| Engine collected | `"A few more horsepower."` |
| Triple expired | `"Triple shot is gone."` |
| Rapid expired | `"Rapid shot is gone."` |
| Scoop lost a level | `"Garbage scoop got smaller."` |
| Magnet expired | `"Magnet power is gone."` |
| Engine expired | `"Engine's a little less peppy."` |

*Anchors:*
- **Collected** → `applyPowerup(type)`. Note `"scoop"` is handled in its **own early-return branch**
  before the `health` / `powerMode` branches — hook the line **there**, not in the timed-effect path.
- **Expired** → **route through `powerActive(type)`**, the single predicate every "is this live?" read
  goes through. It correctly handles **both** time mode **and** count mode (shots/pieces). Hooking
  `game.powerFx` directly would **silently miss the count modes.**
- **Scoop is not timed** — it decays by **damage** (5 hits/level, in `damageShip()`, which already
  pushes a `"SCOOP −1"` float and plays `AudioSys.scooploss()`). `"Garbage scoop got smaller."` hooks
  **there**.
- **v3.6 P4 made powerups BANK** (`+=` on a same-type pickup; magnitude never stacks), and **CS009
  added a bank-flash HUD tell** (`game.powerBank`, `HUD_BANK_FLASH`, a ring pop). So a same-type
  pickup while already active **re-fires the "collected" line**. Probably fine — but **decide**, and
  make sure the §11e cooldown survives a rapid double-pickup.
- CS009 also added `HUD_FX_LOW = 3` — a timed row already shows a "running out" warning at ≤3 s.
  Dan's expiry line fires *at* expiry, so the two are complementary, not redundant.

#### Recycling at the dock

Fires **once per dock visit**, by pieces delivered in that visit:

| Pieces (inclusive) | Line |
|---|---|
| 5 – 9 | `"There's at least 5 good pieces in there."` |
| 10 – 14 | `"That's somewhere around a dozen."` |
| 15 – 19 | `"Special delivery."` |
| 20 or more | `"I'm not sure I can count that high."` |

*Anchors:* `game.deliveryCount` increments once per canister at the dock-offload block, and is reset
to 0 at **three** sites:
- the ship leaves the dock's neighbourhood (`dist > dock.radius + 40`) ← **the only completed visit**
- `breakChain()` — a chain node was destroyed
- `scatterChain()` — the ship died

**`breakChain` and `scatterChain` must NOT fire a line.**

> **FORK-5 — when exactly does the line fire?**
> **(a)** At the **leave-dock reset**, reading `deliveryCount` before it's zeroed. Unambiguous, count
> is final, exactly-once by construction — but it lands *after* the player has flown away, which may
> read as late.
> **(b)** The moment the **chain empties at the dock** (`game.chain.length === 0` right after an
> offload tick). Immediate and satisfying — but it misses a visit where the player leaves with cargo
> still attached, and needs its own once-per-visit latch.
> **Recommendation: (b), immediate**, count taken from `deliveryCount` at that instant. It's the
> moment the player is actually *looking at* the dock, and a partial-then-leave visit arguably
> doesn't deserve a "great haul" line anyway. **Paul to confirm.**

Tiers start at **5**, so a 1–4 piece visit says nothing. Intentional.

#### Towing capacity full

| Trigger | Line |
|---|---|
| The chain reaches `game.cargoMax` on a pickup | `"Truck is full, let's go."` |

*Anchor:* the pickup gate is `game.chain.length < game.cargoMax && (…in range…)`. The line fires on
the pickup where `chain.length` **becomes** `cargoMax`. It **cannot re-fire** — the gate blocks
further pickups once full — and **re-arms naturally** after a delivery. **Don't add a latch; the gate
is the latch.**

But: **the clump-scoop branch pushes several nodes at once.** Confirm it trips the line correctly
(and exactly once) when a clump fills the chain.

`game.cargoMax` starts at `CARGO_BASE 12` and grows to `CARGO_CAP_MAX 24` (+1 per `CARGO_GROW_PER 30`
delivered this run), so "full" is a **moving target** — **read the runtime `game.cargoMax`, never a
constant.** CS009's HUD already turns the CARGO ring gold at `chain.length >= cargoMax`
(`cargoFull` → `COLOR.ach`), so there's an existing visual partner for this line.

---

## 12. Explicitly NOT in this changeset

- Re-arming the difficulty-gated music intensity system (stays dormant; machinery preserved).
- Any change to Zen, Derelict, or Beacon.
- A remote leaderboard (the `afd_scores_v1` wire shape already accommodates one).
- Renaming any `localStorage` key — `afd_settings_v1` / `afd_achievements_v2` / `afd_scores_v1` are
  **frozen**.
- Splitting the single HTML file into modules (deliberately deferred, again).
- Any change to `inScoopBox()`'s capture math (§7 is render-only).
- Migrating existing high-score records' `build` field (§2).
- Any rework of CS009's HUD **beyond** what §5 forces (the critical-hull pulse rate) — the HUD is
  freshly shipped; don't reopen it.

---

## 13. Forks requiring Paul's sign-off

| # | Question | Recommendation |
|---|---|---|
| **FORK-1** | Version: notes say `v1.0.0.9`, but this is changeset 10. | **`v1.0.0.10`.** |
| **FORK-2** | The corner glow syncs to the siren (0.9–2.4 Hz), but CS009's critical-hull ring pulses at a flat `HUD_PULSE_HZ` 1.2 and its code comment says that's deliberate. Two red pulses will beat. | **Sync the critical-hull ring to the siren too** — one shared rate helper, one coherent alarm. **Reverses a CS009 decision; needs explicit sign-off.** Max-hull / full-cargo pulses keep the flat rate. |
| **FORK-3** | The glow is a **fill**; CS009 *hardened* the no-fills rule last changeset. | **Try stroke-only corner arcs first** (`drawRingArc` idiom — it'll look native to the new HUD). Escalate to a documented 4th fills-exception only if that can't carry it. |
| **FORK-4** | Does "High Scores" stay on the root system menu once it's under Options? | **Remove it from `MENU_ROOT_SYS`** — one entry point, no `scoreReturn` tracker needed. |
| **FORK-5** | Dan's recycling line: on leaving the dock, or the moment the chain empties? | **The moment the chain empties** (immediate). |

## 14. Flags (decided, but load-bearing)

| # | Flag |
|---|---|
| **FLAG-3a** | Raising `CARGO_MASS` **requires re-running** the 24-node chain-stability stress. Report the measured stretch either way. |
| **FLAG-4a** | Engine stays a no-op with an empty chain. Accepted. |
| **FLAG-6a** | Longer music loops may breach the tested ≤16 nodes-per-step budget (current worst: 13). **Measure.** |
| **FLAG-7a** | The prong-V was designed at `SCOOP_CONFIG` 3.0/36; it's now 5.0/60. Re-audition in `scoop-lab` — **and revert `scoop-lab`'s own duplicate box render in the same commit.** |
| **FLAG-8b** | **Two** hardcoded Options indices break when `MENU_OPTIONS` grows: `menuControls`'s `3` (L1609/L1611) and `menuAchievements`'s `4` (L1564). Fix both to `.indexOf(label)`. Then grep `scratchpad/` for more. |
| **FLAG-10a** | Rotation speed deliberately **not** reset by Controls' "Return to Defaults", per Paul. Possibly counter-intuitive. |
| **FLAG-11a** | Synthesized speech is the highest-risk item. Gate it behind a `tools/voice-lab.html` sign-off, and structure the changeset so the other nine items ship without it. |