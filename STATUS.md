# Asteroid Field Deluxe — STATUS

Last updated: 2026-07-06 · Build version: **1.7** (v2.0 Phase 6 of 9 shipped) · Last session: implemented **F6 — Powerups**. Added a `Powerup` entity class with five types. **Health** spawns ambiently on a saucer-like timer (18–26 s, one at a time) and instantly repairs +25 HP capped; **Rapid Fire / Triple Shot / Magnet / Engine** drop from small-tier Debris/Hunter kills at a 10% roll (`POWERUP_DROP_CHANCE`) and last 15 s (`POWERUP_DURATION`). Rapid raises the bullet cap 4→8; Triple fires a 3-bullet spread and raises it 4→12 — **both active takes the higher cap (12), not 24** — through a new `maxBullets()` the fire block now reads. Magnet pulls free garbage toward the ship inside 3× the pickup radius (a real, damped attraction force, not just a bigger circle) and widens the pickup radius 1.6×; Engine halves the effective towed mass by applying `ENGINE_MASS_MULT` inside `chainMass()`, so thrust/top-speed/tug all lighten at once. Same-type pickups **refresh** the timer (no magnitude stacking); different types stack. A HUD row under CARGO shows each active timed effect with a shield-bar-style remaining-duration bar. Each type has a distinct vector-glow icon (rotating hexagon housing + a per-type glyph via `drawPowerupGlyph`, reused in the HUD).

## Working / verified

**Headless-verified this session (v1.7, `scratchpad/test-f6.js`, 39 assertions):**
- **Effect magnitudes (one of each type)** — Health repairs exactly +25 and is capped at `SHIP_MAX_HP` (never arms a timer slot); each of rapid/triple/magnet/engine arms *only its own* `game.powerFx` slot to `POWERUP_DURATION` (15 s).
- **The 12-not-24 combined cap** — `maxBullets()` returns 4 / 8 (Rapid) / 12 (Triple) / **12** (Rapid+Triple), explicitly *not* 24, 20, or 16. Triple's cap wins whenever Triple is active.
- **Triple-shot spread + rapid cap, driven through the REAL `Ship.update` fire block** — a normal shot fires 1 bullet; with Triple active one volley fires exactly 3, evenly spread by `TRIPLE_SPREAD` (0.14 rad). At the base cap (4 bullets alive) a 5th can't fire; with Rapid active the 5th flies (cap raised to 8).
- **Duration expiry + same-type refresh** — a nearly-expired effect counts down through `update()` to 0 and the cap resets to 4; picking the same type back up sets the *full* 15 s (refresh), not `remaining + 15` (no stacking).
- **Engine halves the effective towed mass** — `chainMass()` returns the true sum with no Engine and `sum × 0.5` with Engine, for both all-mass-1.0 and mixed (1.0/0.5 low-mass Hunter scrap) chains — so the thrust/top-speed penalties (Ship.update) and the momentum tug (updateChain) all read the lighter value.
- **Magnet moves garbage toward the ship over frames** — a canister placed at +45 px (inside the ~54 px attraction range, outside the ~29 px magnet pickup) is measurably closer after 6 `update()` frames and its velocity points at the ship; with the Magnet **inactive**, an at-rest canister at the same spot doesn't drift. Confirms a real pull, not a teleport or a passive radius.
- **Drops only from small-tier kills, never Health** — with the roll forced, a small Debris kill and a small Hunter kill each drop exactly one powerup from the drop pool; a *large* Debris or Hunter kill drops nothing even with the roll forced (only the small tier rolls); below the chance, a small kill drops nothing; `POWERUP_DROP_TYPES` excludes Health.

**Regression re-run green this session:** `scratchpad/test-f2.js` (54/54), `scratchpad/test-f3.js` (28/28), `scratchpad/test-f4.js` (30/30), `scratchpad/test-f5.js` (47/47) all pass. `node --check` clean.

**Verified headlessly earlier (unchanged this session):** the v1.6 Hunter lineage/garbage/ramp/homing/shield/chain-sever behaviour (`test-f5.js`); the v1.5 difficulty curve + saucer wiring (`test-f4.js`); the v1.4 Debris lineage counts + mass-sum chain physics (`test-f3.js`); v1.3 HP/damage/knockback (`test-f2.js`); v1.2 camera/world-wrap; v1.1 salvage. The chain **integration** is untouched this phase (Engine only scales the *result* of `chainMass()`; the verlet/constraint solver is unchanged).

**Not yet verified (needs a real browser — see playtest asks):** whether the 10% drop rate feels right, whether the Magnet pull feels satisfying rather than jittery, whether the five icons read distinctly, and whether the HUD duration row is legible.

## Known issues

- None confirmed. New v1.7 watch items are in GDD §6: **powerup drop rate & Magnet feel** (both first-pass, no playtest data — levers `POWERUP_DROP_CHANCE`, `POWERUP_HEALTH_GAP`, `MAGNET_PULL`, `MAGNET_DAMP`). The v1.6 Hunter watch items and the v1.4 garbage-density / v1.3 knockback-chain watch items still stand.
- **Soft cap, by design:** the fire-block cap check is `count < maxBullets()` (matching the shipped single-shot pattern), so a Triple volley can transiently exceed the 12 cap by up to 2 bullets when fired at count 10–11. This is intentional (the cap is a clutter ceiling, not an exact quota) and mirrors how the base game already lets a shot fire at count 3 of 4. Flagged so it isn't mistaken for a bug.

## Balance notes

- **Powerups (v1.7) — all first-pass, no playtest data yet.**
  - **`POWERUP_DROP_CHANCE = 0.10`** (middle of the proposed 8–12%). THE lever for how often the four combat powerups appear. Only small-tier Debris/Hunter kills roll it, so access scales with how thoroughly you finish lineages. Raise it if powerups feel too rare to matter; lower it if they stop feeling special.
  - **`POWERUP_DURATION = 15 s`** for all four timed effects. Same-type pickups refresh (never stack), so the practical ceiling on any one effect is "keep finding more of it," not a growing magnitude.
  - **Health:** ambient, `POWERUP_HEALTH_GAP = [18, 26]` s between spawns, at most one in the field at a time (its 14 s `POWERUP_DECAY` bounds coexistence). `POWERUP_HEALTH_AMOUNT = 25` (matches the F2 milestone repair). Spawns in a `[220, 520]` px ring around the ship (reachable, roughly on-screen).
  - **Weapon caps:** Rapid 8 (`RAPID_MAX_BULLETS`), Triple 12 (`TRIPLE_MAX_BULLETS`) — Triple's is also the *combined* cap (higher-of, not 24). `TRIPLE_SPREAD = 0.14` rad is a deliberately *narrow* fan so the extra bullets add coverage without becoming a shotgun.
  - **Magnet:** attraction range `MAGNET_RANGE_MULT = 3` × `GARBAGE_PICKUP` (≈54 px); `MAGNET_PULL = 360` px/s² toward the ship with `MAGNET_DAMP = 0.06`/s in-range damping → terminal ≈130 px/s (a firm-but-smooth glide, not a snap). `MAGNET_PICKUP_MULT = 1.6` widens the actual grab radius so the swept garbage collects reliably. **If the pull feels jittery, lower `MAGNET_DAMP` toward 0 (settles harder) before touching `MAGNET_PULL`.**
  - **Engine:** `ENGINE_MASS_MULT = 0.5` — halves the effective towed mass. A full 12-canister chain handles like a 6-canister one while active. Applied inside `chainMass()`, so it reaches the thrust penalty, top-speed penalty, and momentum tug uniformly.
- **Carried from v1.6 (unchanged):** the Hunter Satellite tables, `HUNTER_FLOOR_FRAC` (0.58), and the shared `RAMP_WAVES` (8).
- **Carried from v1.4 (unchanged):** `GARBAGE_DECAY` 12 s / `GARBAGE_SEVER_DECAY` 10 s, wave spawn `min(3+wave, 9)`, the mass-sum chain physics. **Open: the joint F3+F10 Debris-density retune** — still a post-playtest pass; now that all three of saucers, Hunters, and the powerup layer are in, this is the last big early-game balance lever left before the world feels "full."

## Next up

**Phase 7 — Basic Gamepad Input (F7).** Refactor the `input` predicate object so each of `left`/`right`/`thrust`/`fire`/`shield` checks *either* keyboard state *or* the first connected gamepad, using the hardcoded defaults in F7 (D-pad/left-stick for rotate/thrust, A to fire, a shoulder button for shield) — **no rebinding UI** (that's Phase 8). Call sites elsewhere keep calling `input.left()` etc. unchanged. Use the Phase 7 prompt in `IMPLEMENTATION-PHASES.md`.

Notes for that session:
- The headless harness already stubs `navigator.getGamepads()` (returns `[]`), so the keyboard path stays testable; add a fake gamepad object to the stub to exercise the controller branch.
- Keep the refactor to the `input` object only — don't scatter gamepad reads into call sites (GDD §3.3 Input row / F7 interactions note).

Attach/have present all four docs. GDD §2 is current truth *including* the new **§2.14 (Powerups)** and the updated §2.2 (weapons/`maxBullets`) and §2.7 (Health as a second HP-restore path).

## Changed this session

- **`asteroids-deluxe.html` → v1.7.**
  - **New constants block "Powerups (F6)"** (after the saucer/F10 block): `POWERUP_DURATION` (15), `POWERUP_RADIUS` (15), `POWERUP_DECAY` (14), `POWERUP_DROP_CHANCE` (0.10), `POWERUP_DROP_TYPES` (`[rapid,triple,magnet,engine]` — no Health), `POWERUP_HEALTH_GAP` ([18,26]), `POWERUP_HEALTH_AMOUNT` (25), `POWERUP_HEALTH_MIN/MAX_DIST` (220/520), `RAPID_MAX_BULLETS` (8), `TRIPLE_MAX_BULLETS` (12), `TRIPLE_SPREAD` (0.14), `MAGNET_RANGE_MULT` (3), `MAGNET_PICKUP_MULT` (1.6), `MAGNET_PULL` (360), `MAGNET_DAMP` (0.06), `ENGINE_MASS_MULT` (0.5). Added `POWERUP_COLOR`/`POWERUP_LABEL` maps right after `COLOR`.
  - **New `AudioSys.powerup()`** — a bright two-note rising "power on" chime (distinct from the salvage `pickup()`).
  - **New `Ship.update` fire block** — reads `maxBullets()` instead of the raw `MAX_BULLETS`; when `game.powerFx.triple > 0` it fires 3 bullets at `angle ± TRIPLE_SPREAD` via a small `shoot(a)` closure, else one.
  - **New `drawPowerupGlyph()` helper + `Powerup` class** (before `FloatText`): standard contract; a rotating hexagon housing (pulsing alpha, so all five read as one pickup family) wrapping a distinct per-type glyph (rapid = fast-forward chevrons, triple = 3-way fan, health = cross, magnet = horseshoe, engine = thruster bell). Drifts with a settling kick, screen-wraps, blinks out at `POWERUP_DECAY`.
  - **`chainMass()`** now applies `ENGINE_MASS_MULT` when `game.powerFx.engine > 0` — the single chokepoint that lightens thrust/top-speed/tug together. Identical to before when Engine is inactive.
  - **New flow functions** (after `destroyHunter`): `maxBullets()` (the flexible cap, higher-of for combined), `maybeDropPowerup(x,y)` (the small-tier drop roll — the single choke point), `spawnHealthPowerup()` (ambient ring spawn), `applyPowerup(type)` (Health instant-repair vs. timed-refresh, floater + chime). `destroyDebris`/`destroyHunter` call `maybeDropPowerup` in their small-tier branch.
  - **`game` object:** added `powerups: []`, `powerFx: {rapid,triple,magnet,engine}` (remaining sec), `healthTimer`; `startGame` resets all three (health timer seeded to the ambient gap).
  - **`update()`:** the salvage pickup loop gained the **Magnet** pull (extended-radius velocity nudge toward the ship, in-range damping) + a widened pickup radius; a new **powerup pickup pass + `powerFx` countdown**; an **ambient Health spawn timer** in the spawn block (one at a time); and a `powerups` cleanup filter.
  - **`draw()`:** `powerups` drawn above hazards (below bullets) in the world z-order; a **HUD active-powerup row** under CARGO — one glyph + shield-bar-style duration bar per running timed effect (Health, being instant, never appears).
  - Version header + changelog bumped to v1.7.
- **Tests:** New **`scratchpad/test-f6.js`** (39 assertions, see Working/verified). `test-f2/f3/f4/f5` re-run green unchanged. `node --check` clean.
- **Docs:** GDD — version header → 1.7 (Phase 6 of 9); **§2.2** notes the flexible bullet cap; **§2.7** adds Health as a second HP-restore path; **new §2.14 (Powerups)** = the shipped F6 spec; Architecture Map rows (Constants, Entity classes, game object, Flow functions, Chain physics/`chainMass`, update, draw, §3.3 extension point — now the worked example); §6 Bug Watch (powerup drop rate + Magnet feel); Version History v1.7 + the "v2.0 in progress" line → Phase 6. `PLANNED-FEATURES-v2.md` — F6 → 🟢 Done with resolved-decisions; F5's Engine forward-note marked shipped; top status line → F1–F6 built, F7–F9 remain.

## Playtest asks (Paul — can't be checked headlessly)

**New this session (v1.7 Powerups — the two the prompt flagged):**

1. **Does the drop rate feel right?** With combat powerups on a **10% roll off small-tier Debris/Hunter kills** (`POWERUP_DROP_CHANCE`) and Health drifting in every **18–26 s** (`POWERUP_HEALTH_GAP`), do powerups feel *earned but not stingy*? Watch for the two failure modes: **too rare to matter** (you finish waves without ever seeing one, so they never shape play) or **too common to feel special** (one's always active, so they stop reading as a moment). If too rare, raise `POWERUP_DROP_CHANCE` (0.10 → ~0.14) and/or tighten `POWERUP_HEALTH_GAP`; if too common, lower them. Note roughly *how many waves* you play before your first drop.
2. **Does the Magnet's pull feel satisfying rather than jittery?** Grab a Magnet and fly past a loose canister field. The intent: garbage should *glide* toward the ship and collect in a smooth sweep, not orbit, oscillate, or ping-pong around you. Terminal pull speed is tuned to ≈130 px/s (`MAGNET_PULL` accel + `MAGNET_DAMP` damping). If it feels jittery/overshooting, lower `MAGNET_DAMP` toward 0 first (makes garbage settle harder) before dropping `MAGNET_PULL`. Also: does the extended pickup radius (`MAGNET_PICKUP_MULT` 1.6×) make collection feel reliably *easy* while the Magnet's up?

**Also worth confirming (v1.7):**

3. **Do the five icons read distinctly and on-theme?** Rapid (amber fast-forward chevrons), Triple (magenta 3-way fan), Health (red cross), Magnet (blue horseshoe), Engine (mint thruster bell) — each a rotating hexagon housing + a glyph. Can you tell which is which at a glance in the field, and do they stay consistent with the vector-glow look (Pillar 1) rather than reading as "UI stickers"?
4. **Is the HUD duration row legible?** The active-effect row sits under CARGO (top-left): a small glyph + a shrinking shield-bar-style bar per running effect. With 2–3 effects up at once, is it clear what's active and how much time is left, or does it crowd the corner?
5. **Do the effects feel worth chasing?** Triple Shot with the 12-bullet cap, Engine making a full chain handle light, Magnet sweeping a field — do these change how you play a wave (e.g. worth diverting to grab, worth towing a big chain while Engine's up), or do they feel incidental? Especially: does **Engine** noticeably help the greed loop (Pillar 5) — is a long, dangerous haul more tempting while it's active?

**Still open from earlier phases (unchanged, still need a browser):** Hunter early-game calm + escalation and the point-blank shield-kill (v1.6); waves 1–4 saucer calm + ramp intensity (v1.5); Debris silhouette + garbage density in late waves (v1.4). **And the deferred joint F3+F10 Debris-density retune** — with saucers, Hunters, and now the powerup layer all in, this is the last major early-game balance pass; judge it once the combined field feel is confirmed.
