# IMPLEMENTATION PHASES — v3.6 (Changeset 8)

Companion to `PLANNED-FEATURES-v3.6.md`. Seven phases, dependency-ordered. Each is one Claude Code
session. **GDD is the LAST phase** — §2 describes shipped behaviour only.

**All three forks are signed off — nothing is blocked. Every phase can start.** Resolutions, baked into
the prompts below: **FORK-1 = Option B** (`COLOR.garbage` `#c8ff50` is the green; only `clumpHot` dies,
`garbageLight` survives) · **FORK-2 = per-visit** (`game.deliveryCount === 10`) · **FORK-3 = yes, bank**
(`+=` duration and shots; magnitude still never stacks).

Every prompt below assumes the standing repo rules in `CLAUDE.md`: grep the live build first, wrap-aware
helpers (`dist2`/`angleTo`/`shortDelta`) for all world-space math, dead-flag + end-of-frame `.filter()`,
all scoring through `addScore()`, tuning constants in the constants block, tests drive the real code (no
reimplementation), full regression re-run before finishing, **never commit or push**.

| # | Phase | Depends on | Model / effort |
|---|---|---|---|
| 1 | Presentation: garbage colour, boundary removal, scoop scale + translucent box | — | Sonnet · thinking **off** |
| 2 | Feel: Magnet strength + Hunter last-stand pursuit | — | Sonnet · thinking **low** |
| 3 | Powerup drop economy: three deterministic sources | — | Sonnet · thinking **on** |
| 4 | Powerup stacking + HUD rebuild | P3 (soft — HUD reads the budgets P3 fills) | Sonnet · thinking **on** |
| 5 | Game Over spectacle: the `"dying"` state | — | **Opus** · thinking **on** |
| 6 | High scores: top-10, 3-initial entry, `afd_scores_v1` | **P5** (hard) | Sonnet · thinking **on** |
| 7 | GDD + docs | all | Sonnet · thinking **low** |

Only P6→P5 is a hard dependency. P1, P2, P3, P5 are mutually independent and can run in any order.

---

## Phase 1 — Presentation: garbage colour, boundary removal, scoop scale + translucent box

Render and constants only. No sim, no collision, no pickup logic touched. Three independent parts, one
commit each is fine.

> **PASTE TO CLAUDE CODE:**
>
> Read `PLANNED-FEATURES-v3.6.md` §2, §3, §4 first. Grep the live build to confirm every line reference
> before editing. Three parts, all render/constants only — **do not touch any sim, collision, or pickup
> logic.**
>
> **PART A — all garbage glows one safe green (FORK-1 = Option B: the green is `COLOR.garbage`
> `#c8ff50`; only the red dies, `COLOR.garbageLight` survives).**
> Delete `COLOR.clumpHot` entirely. In `Garbage.draw()`, both the `pieces === 1` and the `pieces > 1`
> branch now pick colour by the **same** rule: per-piece mass `< 1` → `COLOR.garbageLight`, else
> `COLOR.garbage`. For a clump, per-piece mass is `this.mass / this.pieces` (today a clump ignores its
> own mass and only reads the red `lerpColor` — that lerp goes away). Everything else about the v3.5 P2
> clump render (one `drawCanister` at `scale = this.radius / 7`) is unchanged. Grep `lerpColor` — if
> nothing else calls it, delete it too. The chain-node render already uses `n.mass < 1 ? garbageLight :
> garbage` and must stay byte-identical — it is now the same rule as the field, which is the point. Fix
> the stale `clumpHot` mention in `COLOR.lowhp`'s comment.
>
> **PART B — delete the wraparound boundary.** Remove `drawWorldBoundary()`, its call site in `draw()`,
> and the four `BOUNDARY_*` constants. **Delete `scratchpad/test-boundary.js` entirely** — every one of
> its 20 assertions is about the boundary; do not try to repair it. No replacement overlay.
>
> **PART C — the scoop mouth gets bigger and becomes visible.** Set `SCOOP_CONFIG.maxWidthMult` 3.0 →
> **5.0** and `maxDepth` 36 → **60** (both playtest starting points — comment them as such; Paul re-picks
> them in `tools/scoop-lab.html`). Do not touch `buildScoopSteps`, index 0, or the load-time
> `SCOOP_WIDTH[0] !== 0` throw — the `scoopLevel === 0` byte-identical invariant is guaranteed by
> construction and must stay that way.
>
> Then replace the scoop render in `Ship.draw()`. It currently draws an open V
> (`[[d,-hw],[16,0],[d,hw]]`) which is **not** the capture region: `inScoopBox()` tests a full rectangle
> from `forward = -SHIP_RADIUS` to `forward = SCOOP_DEPTH[lvl]`, `|lateral| <= SCOOP_WIDTH[lvl]/2`. Draw
> **exactly that box** — corners `[[-SHIP_RADIUS,-hw],[d,-hw],[d,hw],[-SHIP_RADIUS,hw]]` — as a
> translucent fill (`COLOR.dock`, alpha ~0.15, a look-call knob) with the normal `glowStroke` outline on
> top. Derive every corner from `SCOOP_WIDTH`/`SCOOP_DEPTH`/`SHIP_RADIUS`; never hardcode a number. Keep
> it before the hull, inside the `!blink` block, hidden at level 0. This is a deliberate exception to
> GDD §3.2's no-fills rule — note it in a code comment.
>
> **Update `tools/scoop-lab.html` in the same commit** — it carries a verbatim duplicate of the prong-V
> draw. If the lab still previews a V while the game draws a box, the lab is lying.
>
> **Tests:** extend `scratchpad/test-v33-p1.js` (owns the clump render) and `scratchpad/test-v33-p3.js`
> (owns the scoop). Assert: no `clumpHot` in the source; a clump's drawn colour matches its per-piece
> mass at `pieces` 2/5/11; `drawWorldBoundary`/`BOUNDARY_*` absent from the source; `SCOOP_WIDTH[5] ===
> 5 * SHIP_DRAW_W` exactly; `SCOOP_WIDTH[0] === 0 && SCOOP_DEPTH[0] === 0` still; and — the load-bearing
> one — **the drawn box's four corners, recovered from a recording ctx, agree with `inScoopBox`'s
> accept/reject boundary at levels 1..5** (probe a canister just inside and just outside each edge,
> including the `-SHIP_RADIUS` rear edge). Re-run the full regression.

**Commit messages:**
```
v3.6 P1a: all garbage renders one safe green; COLOR.clumpHot deleted

The red proximity-to-Hunter lerp is gone — a clump now draws in the same green
as its pieces (per-piece mass picks lime vs the low-mass mint). Size (radius =
7·√pieces) is now the only Hunter-transform tell. Reverses the v3.3 P1 "free
threat meter" rationale deliberately: instant is-this-safe legibility wins.
```
```
v3.6 P1b: remove the dashed world-boundary overlay

Deletes drawWorldBoundary(), the four BOUNDARY_* constants, and
scratchpad/test-boundary.js. Wrap should read without an explanatory overlay;
whether it does is now a playtest question.
```
```
v3.6 P1c: scoop mouth to 5x ship width, drawn as the actual capture region

SCOOP_CONFIG maxWidthMult 3.0 -> 5.0 (L5 mouth 54px -> 90px), maxDepth 36 -> 60.
Ship.draw's open prong V is replaced by a translucent box matching inScoopBox()
exactly — including its rear edge at -SHIP_RADIUS, which the V never showed.
tools/scoop-lab.html updated to match. scoopLevel 0 unchanged by construction.
```

---

## Phase 2 — Feel: Magnet strength + Hunter last-stand pursuit

Two small, unrelated tuning changes in `update()`/`HunterSatellite`. Separate commits; one session.

> **PASTE TO CLAUDE CODE:**
>
> Read `PLANNED-FEATURES-v3.6.md` §7 and §8. Grep first. Two independent parts.
>
> **PART A — the Magnet still feels weak.** Read §7 carefully: the culprit is **not** `MAGNET_PULL`.
> `MAGNET_DAMP` (0.06, applied as `pow(MAGNET_DAMP, dt)`) removes ~4.6% of a piece's velocity every
> frame, which turns the pull into a terminal-velocity governor: `v_terminal ≈ accel / 2.7`. Combined
> with the **quadratic** falloff, a piece 190 px away accelerates at only 175 px/s² and therefore tops
> out around 65 px/s — three seconds to arrive. The mid-field is dead. Three structural changes:
>
> 1. Hoist the hardcoded `t * t` into a named constant `MAGNET_FALLOFF_POW` and ship it at **1.0**
>    (linear). The near field was never the problem.
> 2. Raise `MAGNET_PULL_MIN` 60 → **150** (the number that governs the far field, by construction).
> 3. Raise `MAGNET_DAMP` 0.06 → **0.35** (counter-intuitive: a *larger* value damps *less*). This is the
>    biggest lever and the riskiest — it can make pieces overshoot and orbit the ship instead of landing,
>    which is exactly what the damping was there to prevent.
>
> All three are playtest knobs — comment them as such and **do not agonise over the exact values**.
> **Add a code comment above the pull block deriving `v_terminal ≈ accel·dt / (1 − MAGNET_DAMP^dt)`** —
> it is not obvious, and the next person to tune this will otherwise reach for `MAGNET_PULL` and be
> disappointed, exactly as this round was. Leave `MAGNET_RANGE` (380) and `accel /= √mass` alone.
>
> **PART B — large Hunters pursue when they're the last ones standing.** In `HunterSatellite.update()`,
> the `size === 3` core currently only tumbles and rides its fixed spawn-time velocity. When
> `game.debris.length === 0 && !game.ship.dead`, a large core now steers slowly toward the ship: use the
> **wrap-aware `angleTo(this, game.ship)`** and the same shortest-angular-delta clamp the homing branch
> already uses (a naive angle is ~180° wrong across a seam), at a new `HUNTER_LAST_STAND_TURN` rad/s, and
> rebuild `vx`/`vy` at a new `HUNTER_LAST_STAND_SPEED` — **slower than a medium homer**; this is a
> search-ender, not a second homing tier. Both constants are playtest knobs, deliberately under-specified.
>
> **⚠️ Do NOT set `this.homing = true`.** `this.shape` and `this.inner` are baked in the constructor off
> `this.homing`, and `draw()` picks `this.heading` vs `this.angle` off it — flipping it mid-life would
> silently swap the core's symmetric diamond for the kite silhouette and freeze its tumble. The core
> keeps tumbling while it pursues; the pursuit is the tell. Evaluate the condition inline or store a
> separate `this.pursuing` flag.
>
> **Tests:** extend `scratchpad/test-v31-coalesce.js` (owns the magnet pull physics) and
> `scratchpad/test-f5.js` (owns the Hunter). Drive the **real** `update()`. Magnet: pull is monotonically
> stronger at every distance than the shipped build (compute the old formula inline as the comparison
> baseline); a mass-1 single at 190 px reaches the ship measurably faster than before (assert the *time*,
> not the constant); `MAGNET_RANGE` unchanged; a piece at 400 px still feels nothing. Hunter: a large core
> with debris on the field keeps its exact spawn-time velocity across 60 frames (regression guard — the
> old behaviour must be untouched while debris remain); with `game.debris` emptied, the same core's
> heading converges toward the ship over time, **including across a world-wrap seam** (the naive-angle
> case); its `shape`/`inner`/`homing` fields are unchanged by pursuit; a medium/small homer's behaviour is
> byte-identical either way. Full regression re-run.

**Commit messages:**
```
v3.6 P2a: Magnet buff — linear falloff, higher floor, far less damping

The weak feel was MAGNET_DAMP, not MAGNET_PULL: at 0.06 it stripped ~4.6% of a
piece's velocity per frame, capping terminal speed near accel/2.7. Falloff
exponent hoisted to MAGNET_FALLOFF_POW (2 -> 1), MAGNET_PULL_MIN 60 -> 150,
MAGNET_DAMP 0.06 -> 0.35. The terminal-velocity relationship is now documented
in-code so the next tuning pass doesn't reach for MAGNET_PULL again.
```
```
v3.6 P2b: large Hunters slowly pursue once they're the last satellites left

When game.debris is empty, a size-3 core steers toward the ship at
HUNTER_LAST_STAND_TURN/SPEED (wrap-aware). Ends the late-wave search without
turning the core into a second homing tier: this.homing stays false, so its
silhouette and tumble are unchanged.
```

---

## Phase 3 — Powerup drop economy: three deterministic sources

> **PASTE TO CLAUDE CODE:**
>
> Read `PLANNED-FEATURES-v3.6.md` §5 and CONFLICT-3/CONFLICT-4 first. Grep every site before editing.
>
> **⚠️ NON-NEGOTIABLE:** `POWERUP_DROP_TYPES` (`["rapid","triple","magnet","engine"]`) is the list of
> **timed effects** the HUD active-effect row / `powerActive` / `powerMode` / `powerBudget` iterate. It is
> **not** the drop table. `"scoop"` must never enter it — scoop is a persistent upgrade, not a timed
> effect. The recycle hub is a new **emitter**, not a new drop **type**. Nothing in this phase touches
> `POWERUP_DROP_TYPES`.
>
> **Remove the old rule.** Delete `POWERUP_DROP_CHANCE` and **both** `maybeDropPowerup()` call sites —
> `destroyDebris`'s small-tier branch and `destroyHunter`'s small-tier branch. Debris now drops nothing,
> ever. (This is a deliberate, flagged economy shift: today those two sites at 16% are the *only* drop
> source in the game — saucers drop nothing at all.) **Keep `spawnHealthPowerup()` and its
> `POWERUP_HEALTH_GAP` ambient timer completely untouched** — Health is not a drop and is not one of the
> three new sources.
>
> **Keep `POWERUP_DROP_WEIGHTS`** as the type-roll table for all three new emitters. Rework
> `maybeDropPowerup` into an unconditional `dropPowerup(x, y, vx, vy)`: roll the weights, push
> `new Powerup(x, y, type, vx, vy)`. No chance gate — emitters decide *when*, this decides *what*.
>
> **Delete the drag in `Powerup.update()`** (`this.vx *= Math.pow(0.4, dt)`). A drop must fly on its
> vector until collected or expired. This is byte-identical for ambient Health, which spawns at rest.
> `Powerup.update()` already calls `wrap()`, so a long-lived drifter is safe.
>
> **Source 1 — every UFO, large or small, always drops.** There are **two** saucer-kill sites and they
> are copy-pasted: the player-bullet branch and the shield-body-contact branch, each doing `s.dead` +
> `addScore` + two achievement counters + `boom` + `AudioSys.saucer(false)`. **Extract a
> `destroySaucer(s)` flow function** — shaped like `destroyDebris`/`destroyHunter`, placed beside them —
> and call it from both sites. That is the choke point for the drop and it kills a live duplication
> hazard. The drop inherits `s.vx, s.vy` **exactly** (no scaling — it flies on the UFO's vector).
>
> **Source 2 — every LARGE Hunter always drops.** In `destroyHunter`, gate on `h.size === 3` only (not
> the medium/small children) and call `dropPowerup(h.x, h.y, h.vx, h.vy)`.
>
> **Source 3 — the recycle hub (FORK-2 = per-visit).** In the dock-offload
> block, latch on `game.deliveryCount === 10` — one line above the existing `=== 12` Heavy Hauler latch,
> the same "passes through exactly once per visit" idiom. Emit one powerup **from the dock's position**
> at a new `DOCK_POWERUP_SPEED` (~120 px/s, playtest knob) in a random direction, so it travels until
> collected or expired (its full 26 s `POWERUP_DECAY`). Push a `FloatText` at the dock so the causality
> is legible.
>
> **Tests:** extend `scratchpad/test-v33-p3.js` (owns the drop economy) and `scratchpad/test-p6.js` (owns
> dock offload), driving the **real** `destroySaucer`/`destroyHunter`/`destroyDebris`/`update()`. Assert:
> `"scoop"` still absent from `POWERUP_DROP_TYPES` and present in `POWERUP_DROP_WEIGHTS`;
> `POWERUP_DROP_CHANCE` gone from the source; a full 13-kill Debris lineage drops **zero** powerups; a
> full 13-kill Hunter lineage drops **exactly one** (from the large core, not the smalls); a saucer
> killed by a bullet **and** a saucer killed on the shield each drop exactly one, and its `vx`/`vy` equal
> the saucer's at death; both saucer paths still award the same score and bump the same achievement
> counters as before (regression guard on the `destroySaucer` extraction); a powerup 5 s after a drop has
> **not** lost speed (drag is gone); a 10-canister dock visit emits exactly one hub powerup and an
> 11th/12th canister emits no more; a 9-canister visit emits none; ambient Health still spawns on its
> timer. Full regression re-run.

**Commit message:**
```
v3.6 P3: powerup drops become three deterministic sources

Replaces the 16%-per-small-kill roll (which only fired on Debris/Hunter smalls
— saucers dropped nothing) with: every UFO always drops (inheriting its
velocity); every large Hunter always drops (inheriting its velocity); the
recycle hub emits one per 10-canister visit, launched on its own vector.
Extracts destroySaucer() as the choke point for the two copy-pasted saucer-kill
sites. Powerup drag deleted so drops actually fly. POWERUP_DROP_TYPES untouched
— the hub is a new emitter, not a new type.
```

---

## Phase 4 — Powerup stacking + HUD rebuild

> **PASTE TO CLAUDE CODE:**
>
> Read `PLANNED-FEATURES-v3.6.md` §6, FORK-3, CONFLICT-5, CONFLICT-6. Grep `drawHUD()` in full first.
>
> **PART A — the stacking rule (FORK-3 = yes, adopt banking).** `applyPowerup()` currently **refreshes**:
> `game.powerFx[type] = powerDuration(type)` / `game.powerBudget[type] = POWERUP_BUDGET[type]`. Both
> become `+=`. Duration and shot-count now **accumulate** (bank). **Magnitude still never stacks** — two
> Rapids do not double the fire rate; that part of GDD §2.14 stands and must not change. The HUD bar's
> `frac` is already `clamp01`'d, so a stacked timer needs no other change: a full bar means "at least one
> pickup's worth left," surplus invisible, which is the accepted behaviour.
>
> **PART B — the HUD.** Rebuild `drawHUD()`'s left column, top to bottom: **Score, Level, Hull, Shield,
> Cargo, Powerups remaining.** Specifically:
>
> - **Remove the `TARGETS` readout and `targetsLeft` entirely, and delete
>   `scratchpad/test-targets.js`** — all 12 of its assertions are about that readout. The wave-clear gate
>   (`debris.length === 0 && hunters.length === 0`) is untouched; only the display dies.
> - **Move the shield bar out of the top-right corner** (`bx = VIEW_W - 30 - bw`) into the left column,
>   directly beneath hull, same bar geometry.
> - Hull, shield and cargo render their labels + **nominal** fills in `COLOR.text` (same as the score).
>   **Keep the existing low-HP (`<30%`) and low-shield (`<25%`) red fill overrides** — the red hull bar is
>   one of the three tells in GDD §2.12's low-health warning system, and the "same colour as score" rule
>   governs the nominal state, not the alarm state. Cargo goes `COLOR.text` when hauling (it's
>   `COLOR.garbage` today), `COLOR.dim` when empty.
> - **Hull at max must be unmistakable** — at `hp === SHIP_MAX_HP` a Health pickup is wasted, and the
>   player must be able to see that at a glance. Suggested: fill goes `COLOR.ach` gold with a `MAX` tag
>   beside the bar. Look-call, tune on sight.
> - **Powerups remaining.** Time-limited (`powerMode(t) === "time"`): **keep the bar**, unchanged.
>   Count-limited: **no bar at all** — glyph + the plain number. There is no meaningful maximum once
>   budgets bank, so a bar would be meaningless.
> - **Keep the SCOOP pip row**, directly under the powerup rows. It is persistent state, deliberately
>   drawn outside the `POWERUP_DROP_TYPES` loop — leave it there.
>
> The row y-offsets are bare literals today (46 / 62 / 104 / 126 / 146 / 172). Hoist them into a local
> layout cursor rather than re-deriving six magic numbers by hand.
>
> **Tests:** extend `scratchpad/test-p5.js` (owns powerup expiry modes + the HUD bar) — it already drives
> the **real** `draw()` through a recording canvas and measures bar fill widths in px; reuse that
> machinery. Assert: two Rapid pickups in time mode bank 2× duration and the bar still clamps at full
> width (not over-full); two in shots mode bank 2× budget; magnitude is unchanged (fire cadence after two
> Rapids equals after one); a count-mode row draws **no** bar rect and does draw the number; a time-mode
> row still draws its bar; no `TARGETS` text in the recorded draw calls; the shield bar's recorded x is in
> the left column; the hull bar renders distinctly at full HP vs 99% HP. Full regression re-run — expect
> `test-targets.js` to be gone, not failing.

**Commit message:**
```
v3.6 P4: powerup budgets bank; HUD reordered and cleaned up

applyPowerup now ADDs duration/shots instead of refreshing to full (magnitude
still never stacks) — reverses the v1.7 "refresh, never add" rule. HUD left
column is now Score / Level / Hull / Shield / Cargo / Powerups; shield moved out
of the top-right; hull, shield and cargo take the score's colour (low-HP and
low-shield red overrides kept); hull reads unmistakably at max; shot-limited
powerups show a plain count with no bar (there is no ceiling to draw against);
time-limited keep the clamped bar. TARGETS readout and test-targets.js deleted.
```

---

## Phase 5 — Game Over spectacle: the `"dying"` state

The riskiest phase — it adds a state to a state machine that eleven sites read. **Opus, thinking on.**
Keep it alone in its session.

> **PASTE TO CLAUDE CODE:**
>
> Read `PLANNED-FEATURES-v3.6.md` §9 in full, including the `game.state` audit table. **Grep every
> `game.state` read in the build yourself and confirm that table before writing any code** — an unhandled
> site is the failure mode of this phase.
>
> Today `killShip()` sets `game.state = "gameover"` and `update()` hard-returns unless state is
> `"playing"`, so the field freezes under the text. Add a **`"dying"` state** between them.
>
> **`killShip()`:** everything it does now **stays** — the `boom`, `scatterChain()`, the `AudioSys.thrust`
> / `lowhp` teardowns, and **crucially `game.stats.gameEnded = true` + `Achievements.evaluate()` +
> `Achievements.save()`. Leave those at `killShip` so achievement timing does not change.** Only the
> state assignment changes: `game.state = "dying"`, plus a new `game.deathT = DEATH_DURATION` (~2.5 s,
> playtest knob) and `game.shake`.
>
> **`update()`:** add a branch **before** the existing `if (game.state !== "playing" || game.paused)`
> early-return: while `"dying"` and not paused, call a new `updateDeath(dt)` and return. `updateDeath`
> keeps the world alive — advance particles, floaters, garbage, debris, hunters, saucers, powerups, and
> the camera — but runs **no** ship input, **no** spawns, **no** pickup pass, **no** collisions.
>
> **The spectacle**, all in new named constants, all playtest knobs:
> - **Staged secondary detonations** — over the death window, detonate nearby bodies in sequence
>   (nearest-first by **wrap-aware `dist2`**). Reuse `destroyDebris(a, false)` / `destroyHunter(h, false)`
>   — **both already take `awardScore = false`; that is exactly what it's for.** No score, no achievement
>   counters, during the death. The chain reaction is the spectacle and it costs almost no new code.
> - **A shockwave ring** expanding from the death point — an expanding stroked arc via `glowStroke`, no
>   fill (stays inside GDD §3.2).
> - **Screen shake** — one `game.shake` scalar decayed in `updateDeath`, added as an offset to the camera
>   translate in `draw()`.
> - **A white flash** on the first frames — a full-viewport `fillRect` at decaying alpha, after the world.
>
> At `deathT <= 0` → `game.state = "gameover"`. (Phase 6 hooks the high-score flow onto that transition;
> leave a clean seam.)
>
> **The eleven `game.state` sites** — confirm each: the confirm-key `startGame()` (must NOT fire while
> dying — a player can't skip or restart the spectacle), the pause key, the `"o"` system-menu key, the
> gamepad `onTitleOrOver`, `AudioSys.thrust`, the `update()` gate, the menu panel title, the HUD
> low-health pointer, `Capture.active()`, and `musicStateFor()` (which falls through to `"off"`, running
> the ~1 s `MUSIC_FADE_OUT` under the explosion — good, keep it). **Consider allowing `Capture`'s `P`
> screenshot key during `"dying"`** — it's plausibly the frame most worth capturing. Flag your call
> either way.
>
> **Tests:** new file `scratchpad/test-v36-death.js`, driving the **real** `killShip()`/`update()`/
> `draw()`. Assert: `killShip` sets `"dying"` (not `"gameover"`) and still fires `gameEnded` +
> `Achievements.evaluate` + `Achievements.save` exactly once, at `killShip`, not at the later transition
> (spy them); the field genuinely keeps moving during `"dying"` (a debris object's position changes across
> frames — the exact thing that was frozen before); `game.score` does **not** change during the death
> (the secondary detonations are `awardScore = false`) and no achievement counter moves; after
> `DEATH_DURATION` of real frames the state is exactly `"gameover"`; a confirm keypress during `"dying"`
> does **not** call `startGame()`; `draw()` is crash-free at several points through the window. Full
> regression re-run.

**Commit message:**
```
v3.6 P5: game over is a spectacle — the "dying" state

killShip now enters a new "dying" state (2.5s) instead of freezing straight to
"gameover": the field keeps simulating while nearby bodies chain-detonate
(awardScore=false, so no score or achievements move), a shockwave ring expands,
the screen shakes, and the music fades out under it. Achievement evaluation
still fires at killShip, unchanged. All eleven game.state read sites audited.
```

---

## Phase 6 — High scores: top-10, 3-initial entry, `afd_scores_v1`

Depends on **P5** — the entry screen hangs off the `"dying"` → `"gameover"` transition.

> **PASTE TO CLAUDE CODE:**
>
> Read `PLANNED-FEATURES-v3.6.md` §10 in full. Grep the two existing `localStorage` stores first — copy
> their guarded `lsGet()`/try-catch idiom exactly.
>
> **⚠️ `afd_settings_v1` and `afd_achievements_v2` are FROZEN — never renamed, never extended, never read
> by this code.** High scores get a **third** key: **`afd_scores_v1`**.
>
> **The record is a WIRE shape.** A remote leaderboard must be able to consume it later with **no data
> migration**. Build it exactly as specced in §10:
> `{ v: 1, id, initials, score, wave, delivered, ts, build }`, stored as
> `{ v: 1, entries: [...] }`, sorted score-desc, sliced to `SCORES_MAX` (10). The three things that make
> the deferred work migration-free: **`id`** (client-generated, unique, stable — a server dedupes on it,
> so a client can upload its whole local table later without double-counting; use
> `crypto.randomUUID?.()` with a `Math.random()` hex fallback), **`v`** on both the store and the record,
> and the fact that a `playerId`/`name` field is purely **additive** when login lands. Add fields later;
> never rename or repurpose one.
>
> **Entry.** At the `"dying"` → `"gameover"` transition (P5's seam), if the run qualifies (`score > 0`
> and either fewer than 10 entries or `score` beats the 10th), set `game.entry = { initials, idx }`. The
> gameover screen renders three big slots: up/down cycles a single `SCORES_CHARSET` (`A-Z`, `0-9`, space),
> left/right moves the cursor, confirm commits. Wire **both** input paths — the keydown normal branch and
> the gamepad's already-edge-detected `menuNavEdges()`. A held key/stick must not spin the letter (the
> same class of bug the v3.5 P1 `e.repeat` guard fixed — reuse that guard).
>
> **⚠️ THE LOAD-BEARING GUARD:** the keydown handler currently calls `startGame()` on confirm when
> `game.state === "gameover"`. That **must** become `… && !game.entry`, or Enter will restart the run
> instead of committing the initials. This is the single most likely bug in the phase — write the test
> for it first.
>
> After commit (or immediately, if the run didn't qualify), the gameover screen shows the **top-10
> table** with the fresh entry highlighted, above the existing "PRESS ENTER TO PLAY AGAIN".
>
> Also add a **`"High Scores"` row to `MENU_ROOT_SYS`** (`["Options","Achievements","Back"]`) so the
> table is browsable from the title, reusing the same table renderer and the existing `menuPanel()` +
> label-dispatch idiom. This shifts `MENU_ROOT_SYS` — `test-p4.js` keys off labels, not indices, but
> re-run it and confirm.
>
> **Tests:** new file `scratchpad/test-v36-scores.js`, driving the **real** `killShip()`/`update()`/
> keydown/gamepad handlers/persistence. Assert: `afd_settings_v1` and `afd_achievements_v2` are neither
> read nor written by any of this (spy the storage stub); the store round-trips through `localStorage`
> under `afd_scores_v1`; a corrupt/missing payload doesn't crash init; the table stays sorted, capped at
> 10, and a lower score than the 10th is refused; every committed record carries all eight fields with a
> unique `id` across two runs; **a confirm keypress while `game.entry` is live commits the initials and
> does NOT call `startGame()`** (spy it), while the same key after commit does start a game; a held key
> (`repeat: true`) does not advance the letter; the gamepad path reaches the same handler; `draw()` is
> crash-free with an empty table, a partial table, and a full table with the fresh entry highlighted.
> Full regression re-run.

**Commit message:**
```
v3.6 P6: top-10 local high scores with 3-initial entry

New third localStorage key afd_scores_v1 (afd_settings_v1 / afd_achievements_v2
untouched and unread). The score record is designed as the wire shape a future
remote leaderboard consumes with no migration: it carries a stable client-side
id (the dedupe key), a record-level schema version, and room for an additive
playerId when login lands. Arcade-style initials entry on the gameover screen,
plus a browsable table from the system menu. Confirm-key guarded so Enter
commits initials instead of restarting the run.
```

---

## Phase 7 — GDD + docs

Last, after all code has landed. §2 describes shipped behaviour only.

> **PASTE TO CLAUDE CODE:**
>
> Docs only — **no gameplay code**. `git diff --stat` at the end must show only `orbital-overhaul-GDD.md`,
> `CLAUDE.md`, `STATUS.md`. **Grep the live build to confirm every specific value before writing it** —
> don't trust the planning docs or this prompt for shipped constants.
>
> Update `orbital-overhaul-GDD.md` in place:
>
> - **§2.5.1 — the clump-render bullet.** It currently documents `COLOR.clumpHot` as "the only tell that a
>   clump is nearing the Hunter transform." **Rewrite it IN PLACE, preserving its history — supersede,
>   never contradict** (the same treatment the garbage-decay bullets got in Changeset 4). Record that the
>   red is gone, that **size (`radius = 7·√pieces`) is now the only transform tell**, and *why that was
>   accepted* — so no future session restores the red thinking it was an oversight. Note explicitly that
>   the low-mass `garbageLight` tint **survived** (FORK-1 = Option B): only the red cue was spent, and
>   the mint tint now applies uniformly to singles, clumps (by per-piece mass) and chain nodes alike —
>   one rule where there used to be two.
> - **§2.11** — the dashed boundary was an "interim wrap-visibility aid"; record that it was removed
>   deliberately and that whether anything replaces it is a playtest question.
> - **§2.14** — the drop-source bullet (three deterministic emitters; Debris no longer drops; Health
>   ambient unchanged; `POWERUP_DROP_TYPES` still not the drop table); the **Stacking rule** bullet
>   **rewritten in place, superseding the v1.7 "refresh, never add" rule with its history preserved** —
>   budgets and timers now BANK; magnitude still never stacks (that half of the rule stands); the
>   HUD bullet; the constants callout paragraph.
> - **§2.14.1** — the 5× mouth, the generated config's new values, and the translucent capture-region
>   render replacing the prong V (including that the drawn box now includes the rear `-SHIP_RADIUS` edge
>   the V never showed).
> - **§2.5** — large-Hunter last-stand pursuit.
> - **§2.7 / §2.9** — the new `"dying"` state and the death spectacle; the initials-entry screen in the
>   state/control flow.
> - **§2.12** — confirm the low-HP red bar tell survived the HUD recolour (or record that it didn't).
> - **§2.16** — persistence: the new `afd_scores_v1` key, alongside the two frozen ones.
> - **A new §2.18 — High scores.** The record shape, the storage key, and — the load-bearing part — **why
>   it is shaped that way**: the `id`/`v`/additive-field contract that lets a remote leaderboard consume
>   it with no migration. Whoever builds the leaderboard reads this section.
> - **§3.2 Rendering conventions** — the scoop's translucent fill is a deliberate, bounded exception to
>   "no fills except bullets and particles." Say so, so it doesn't become a licence for filled entities.
> - **Architecture Map** rows (Constants / Entity classes / Flow functions / `game` object / `update(dt)` /
>   `draw()` / Menu), the **top Version line**, and a new **§7 Version History** entry per phase
>   (newest-first within the version, per §7's convention).
>
> `CLAUDE.md`: add the non-negotiables this round earned — `afd_scores_v1` joins the frozen-key list; the
> scoop's `SCOOP_WIDTH[0] === 0` load-time throw is a guard, not a test artefact; `POWERUP_DROP_TYPES` is
> the timed-effect list, not the drop table (it has now survived two changesets of pressure — write it
> down).
>
> `STATUS.md`: the usual session entry.
>
> **Archive** the spent v3.6 planning docs to `archive/` with their version suffix
> (`archive/PLANNED-FEATURES-v3.6.md`, `archive/IMPLEMENTATION-PHASES-v3.6.md`). While you're in there:
> the bare-named `archive/IMPLEMENTATION-PHASES.md` still hasn't been renamed to a versioned filename —
> do it now (`-v2.md`). Bare names are not allowed in `archive/`.

**Commit message:**
```
v3.6 P7: docs — GDD, CLAUDE.md, STATUS for Changeset 8

§2.5.1's clumpHot "free threat meter" rationale and §2.11's boundary aid are
superseded in place, with the history preserved. New §2.18 documents the high-
score record as a wire shape and the no-migration contract behind it. Archives
the v3.6 planning pair and finally versions the bare archive/IMPLEMENTATION-
PHASES.md.
```