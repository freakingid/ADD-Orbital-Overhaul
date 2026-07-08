# ASTEROID FIELD DELUXE — Planned Features (v2.0 Design)

**Status:** **The full v2.0 feature set (F1–F9) is built and shipped as v2.0.** F1 shipped as v1.2 (spec in GDD §2.11), F2 as v1.3 (spec in GDD §2.12), F3 + F5 as v1.4 (specs in GDD §2.4 / §2.10 / §3.4), F10's `difficultyFactor`/`ramp` + saucer calming as v1.5 (spec in GDD §2.6 / §2.13), F4 Hunter Satellites as v1.6 (spec in GDD §2.5), F6 Powerups as v1.7 (spec in GDD §2.14), F7 controller support as v1.8 (defaults) + **v1.9 (rebinding UI)** (spec in GDD §2.15 / §2.16), F8 Pause/Options/Rebinding as **v1.9** (spec in GDD §2.16), **F9 Achievements as v2.0 (spec in GDD §2.17)**. The **only** thing still open is a tuning pass, not a feature: of F10, the Hunter-scaling half shipped in v1.6 and only the **Debris-density retune** is still deferred (see F10 below).
**Companion docs:** `asteroid-field-deluxe-GDD.md` (shipped spec, Section 2 = current truth), `IMPLEMENTATION-PHASES.md` (build order + Claude Code prompts), `STATUS.md` (session log).

**How to use this document:** each feature (F1–F10) has a status tag, a full spec, the assumptions I made where your request was ambiguous (flagged explicitly — override any of these freely), and how it interacts with existing systems. When a feature ships, its spec should move out of here and into GDD Section 2, and this doc should note it as done (or just delete the section — GDD Section 7 Version History is the permanent record).

**Status legend:** 🔴 Not Started · 🟡 In Progress · 🟢 Done (move to GDD when you see this)

---

## 0. Naming & Identity Resolution (read this first)

Two of your requests use the word "satellite" for two different things, and one of them collides with a system that's already shipped:

- The **shipped v1.1 game already has a "Satellite"** — the spinning hexagon that drifts toward the ship and splits into homing `Wedge` ships (GDD 2.5). This is the *Asteroids Deluxe* signature enemy.
- Your **"Change the main threat to be Satellites instead of asteroids"** request wants the *asteroid* reskinned as a satellite (debris satellites, 3-way splits, garbage on every tier).
- Your **"Add Satellites that seek the player"** request describes a large-diamond, drift-toward-player, 3-way-split-per-tier enemy — which is, mechanically, almost exactly the existing hexagon Satellite/Wedge system already in the game, just with different numbers (3/3 instead of 3/2), a different shape (diamond instead of hex/wedge), and garbage emission added.

I don't think you meant to describe the same enemy twice under different names — more likely you were picturing two *distinct* hazards and didn't clock that one of them already exists under a name you're about to reuse. Here's my resolution, so the codebase and this document stay unambiguous:

| Old name (shipped) | New name (v2.0) | What changes |
|---|---|---|
| `Asteroid` (rock, drifts randomly) | **Debris Satellite** | Reskinned visually (broken-satellite silhouette instead of jagged rock); 3-way split at large/medium tiers; garbage on **every** tier including the final small-tier kill. See F3. |
| `Satellite` + `Wedge` (hexagon, drifts toward ship, splits into wedges) | **Hunter Satellite** | Reshaped to a diamond; split counts become 3/3 (not 3/2); garbage added on every split tier; final (small) tier's garbage is explicitly low-mass. See F4. |

Both families read as "satellites" thematically (per your request), but stay visually and behaviorally distinct — Debris Satellites drift passively like the old rocks, Hunter Satellites actively home — which matters for Pillar 3 (every threat needs a readable tell). **If this isn't what you meant — e.g. if you intended to fully merge these into one enemy family — say so before Phase 3/4 and I'll re-cut the spec.** Everything below assumes this two-family resolution.

---

## F1 — Larger Playing Field & Scrolling Camera
**Status:** 🟢 Done — shipped in v1.2 (build Phase 1). The full shipped spec now lives in **GDD §2.11**; this section is retained only for the deferred follow-up below.

**Built:** a 3840×2160 toroidal world (`WORLD_W/H`) decoupled from the 1280×720 viewport (`VIEW_W/H`); a camera (`game.camera`) that tracks the ship every frame with no clamping (world wraps); all wrap-aware helpers retargeted to world dimensions plus new `wrapOffset`/`wrapPos`; a `draw()` camera transform with wrap-aware per-entity nearest-image rendering + viewport culling (`onScreen`/`drawEntity`); a seamless world-spanning starfield; and ship-relative spawning for waves, the dock, satellites, and saucers (the last two enter from viewport edges relative to the ship — feel unchanged; their behaviour/balance is untouched, that's Phase 4/5). Headless-tested per GDD §5.4 rule 7. See GDD §2.11 and Version History v1.2.

### Deferred follow-up (still open — do NOT treat as done)
- **Off-screen threat awareness:** with the 3× bigger world, hazards can approach from outside the visible viewport with no warning. **Deliberately parked** (confirmed by Paul) so it isn't forgotten — to be addressed later alongside F10's difficulty pacing, since calmer early waves + a bigger world make approach-awareness more valuable. Not built in Phase 1; also tracked in F10's interactions note.

---

## F2 — Health Points & Knockback (replaces Lives)
**Status:** 🟢 Done — shipped in v1.3 (build Phase 2). The full shipped spec now lives in **GDD §2.12** (with §2.1/§2.7 updated); this section is retained only for the resolved-decisions note and the follow-ups below.

**Built:** a single HP pool (`SHIP_MAX_HP` = 250) replacing discrete lives; all respawn/lives state removed. Unshielded hits go through a new `damageShip()`: source-specific damage via each hazard's `damage` field (`DMG_SMALL/MEDIUM/LARGE` = 20/35/50, `DMG_BULLET` = 15), a `KNOCKBACK_SPEED` (250 px/s) shove away from the hazard, and a `HIT_STUN_DURATION` (1.0 s) i-frame window (reusing `ship.invuln`; the old 2.5 s spawn invuln is gone). `killShip()` is now a respawn-free game over at 0 HP. The 10,000-point milestone repairs +25 HP (flat score bonus at full HP) instead of granting a life. HUD gained a HULL/HP bar styled like the shield bar. Headless-tested per GDD §5.4 rule 7 (`scratchpad/test-f2.js`, 54 assertions). See GDD §2.12 and Version History v1.3.

### Resolved decision (noted for the record)
- **Max HP = 250, not 100.** The Phase 2 prompt (and its copy in `IMPLEMENTATION-PHASES.md`) said `SHIP_MAX_HP` = 100, but this doc and STATUS.md both recorded 250 as Paul-confirmed. That conflict was surfaced during the build and **Paul reconfirmed 250**. The damage table (20/35/50/15) was identical across both sources, so only the pool size differed. `IMPLEMENTATION-PHASES.md`'s Phase 2 prompt still reads 100 as a historical artifact — the shipped, authoritative value is 250 (GDD §2.12).

### Deferred to later phases (not part of F2)
- **Hunter ramming damage (30/45/60 per tier):** ✅ shipped with the F4 redesign in v1.6 as `HUNTER_DAMAGE` (large 60 / medium 45 / small 30 — a step above the equivalent Debris tier). F2 itself only wired the v1.1 hazards; the Hunter-specific values landed when the entity was rebuilt in Phase 5.
- **Health powerups (F6):** restore HP capped at max — depend on this HP system existing; built in Phase 6.

---

## F3 — Debris Satellites (Asteroid Reskin)
**Status:** 🟢 Done — shipped in v1.4 (build Phase 3). The full shipped spec now lives in **GDD §2.4** (with §2.7 and §2.10/§2.10.1 updated); this section is retained only for the still-open joint-tuning note below.

**Built:** the `Asteroid` class → `DebrisSatellite` (array `game.asteroids` → `game.debris`; `AST_*` → `DEBRIS_*`; `destroyAsteroid` → `destroyDebris`; `COLOR.asteroid` → `COLOR.debris`), redrawn as a broken-satellite silhouette (irregular hull + 1–2 antenna/panel shards). Splits are 3-way at large/medium (small destroyed); every tier's destruction emits exactly `DEBRIS_GARBAGE` (3) canisters — replacing the probabilistic `GARBAGE_DROP` — so a fully-cleared large lineage yields 39. Scores (20/50/100) and per-tier contact damage (50/35/20) carried over unchanged. The `mass` field (F5, below) shipped alongside. Headless-tested per GDD §5.4 rule 7 (`scratchpad/test-f3.js`, 28 assertions). See GDD §2.4 and Version History v1.4.

### First-pass balance landed (documented for retuning)
The ~8× garbage-volume increase was met with a **first-pass** rebalance (not a guess-and-ship — flagged in STATUS.md for retune):
- `GARBAGE_DECAY` 20 → **12 s** (the *primary* density lever — spawn counts can't absorb an inherent 39-per-lineage without making waves trivial).
- New `GARBAGE_SEVER_DECAY` = **10 s** (was an inline 15; kept below the fresh window).
- Wave spawn `min(4+wave, 11)` → **`min(3+wave, 9)`** (secondary trim).

### Still open — joint F3 + F10 tuning pass (do NOT treat as closed)
- The density balance is deliberately a *first pass* with no playtest data. F3's garbage volume wants *fewer* Debris Satellites; **F10 wants *more*** to fill the larger, calmer world. The intended resolution is a playtested middle that leans on `GARBAGE_DECAY` for density control so the field stays populated without drowning in canisters — to be done once F10 is in. Until then, the v1.4 numbers above are the documented baseline.

---

## F4 — Hunter Satellites (Killer Satellite / Wedge Redesign)
**Status:** 🟢 Done — shipped in v1.6 (build Phase 5). The full shipped spec now lives in **GDD §2.5** (with §2.3 shield behaviour and the §2.12 damage table updated); this section is retained only for the resolved-decisions note below.

**Built:** the killer `Satellite` + homing `Wedge` classes merged into one **`HunterSatellite`** class — a teal diamond family, tiers 3/2/1. The large core drifts passively toward the ship (spawn-time aim, no re-aim) and, when shot, splits **3-ways** into medium then small children that actively home (wrap-aware, relentless), each faster/more agile than the last; scoring/boom/garbage/split all run through a new **`destroyHunter`** (parallel to `destroyDebris`), with a `static spawnCore()` for the off-edge large. Every speed & turn rate wires into the v1.5 difficulty ramp from the start — `ramp(ceiling × HUNTER_FLOOR_FRAC, ceiling, wave)` (ceilings 70 drift / 120·1.6 medium / 175·2.6 small; `HUNTER_FLOOR_FRAC` = 0.58), so the family moves at ~60% at wave 1 and ~96% by wave 20. Garbage at every tier: 3 normal-mass at large/medium, a burst of `HUNTER_SMALL_GARBAGE` (6) low-mass (0.5) canisters at small (paler `COLOR.garbageLight` tint). Contact damage 60/45/30 (`HUNTER_DAMAGE`). Shield: core bounces, homers destroyed-on-contact and still split; chain-severing preserved. Headless-tested (`scratchpad/test-f5.js`, 40 assertions). See GDD §2.5 and Version History v1.6.

### Resolved decisions (noted for the record)
- **Floor as a fraction, not per-value floor/ceiling pairs.** The saucers (F10) used explicit floor/ceiling constant pairs; the Hunters instead use explicit *ceilings* plus one shared `HUNTER_FLOOR_FRAC` (0.58) that derives every floor. This is faithful to F4's "floors are ~55–60% of ceiling" wording, keeps one knob for family-wide early calm, and can't drift out of sync when a ceiling is retuned. Speeds/turns still flow through the standard `ramp(floor, ceil, wave)`.
- **Small-tier garbage = 6 (top of the proposed 5–6).** Reads clearly as a "larger burst" bonus vs. the 3 at other tiers; 6 × 0.5 mass = 3.0 mass-equivalent, so the *weight* is modest. Flagged as the first Hunter-side density lever if the jackpot feels cluttered.
- **Shield behaviour on the merged entity.** The old satellite bounced off the shield; the old wedges were destroyed (and split). Preserved by tier: the large core bounces (you must shoot it), medium/small homers are destroyed on shield contact and still split (a shield-killed medium spawns 3 scattering smalls) at a deflection's energy cost. Bouncing a homer would be near-useless (it re-homes in ~1 s), so destroy-on-contact is the meaningful, in-tension answer (Pillar 4).
- **Score/damage inversion kept.** Small worth 250 (> medium 150), matching the old small-wedge value — small is the hardest to hit. Contact damage 60/45/30 sits a step above the equivalent Debris tier (F2's proposed Hunter numbers).

---

## F5 — Variable-Mass Garbage (folded into F3, noted separately for clarity)
**Status:** 🟢 Done — shipped in v1.4 as part of build Phase 3. The chain-physics change is documented in **GDD §3.4** (and §2.10); this section is retained for the F6 forward-note below.

**Built** (all headless-tested in `scratchpad/test-f3.js`):
- `Garbage` instances and chain nodes both carry a `mass` field (default `1.0`).
- `Garbage.fromNode()` carries `mass` over when a node is severed back into free garbage.
- Pickup copies `mass` from the collected `Garbage` onto the new chain node.
- Chain math (`CARGO_THRUST`/`CARGO_MAXSPD` penalties and the momentum-tug `massFactor`) now uses a new `chainMass()` = `sum(node.mass)` instead of `chain.length`. Verified: an 8× mass-1.0 chain tows identically to a 16× mass-0.5 chain across thrust, top speed, and tug. All current (Debris-sourced) scrap is mass 1.0, so v1.3 handling is unchanged — the groundwork is in place for F4's low-mass Hunter scrap.

### Forward note (resolved)
- The **Engine powerup** (F6) ✅ **shipped in v1.7** exactly as forecast: `chainMass()` applies `ENGINE_MASS_MULT` (0.5) while the effect is active, so the one function feeding `thrustMul`/`maxSp` (Ship.update) and the momentum-tug `massFactor` (updateChain) lightens all three at once. See GDD §2.14.

---

## F6 — Powerups
**Status:** 🟢 Done — shipped in v1.7 (build Phase 6). The full shipped spec now lives in **GDD §2.14** (with §2.2 weapons and §2.7 health updated); this section is retained only for the resolved-decisions note below.

**Built:** a new `Powerup` entity class with five types. **Health** spawns ambiently on a saucer-like timer (`POWERUP_HEALTH_GAP` 18–26 s, one at a time) and instantly repairs +25 HP capped; **Rapid Fire / Triple Shot / Magnet / Engine** drop from small-tier Debris/Hunter kills at `POWERUP_DROP_CHANCE` (10%) via `maybeDropPowerup()` and last `POWERUP_DURATION` (15 s). Rapid raises the bullet cap 4→8; Triple fires a 3-bullet spread and raises it 4→12 — both active takes the higher cap (12), not 24, through the new `maxBullets()`. Magnet pulls free garbage toward the ship inside 3× the pickup radius (with in-range damping so it glides) and widens the pickup radius 1.6×; Engine halves the effective towed mass by applying `ENGINE_MASS_MULT` inside `chainMass()` (so thrust/top-speed/tug all lighten). Same-type pickups refresh the timer (`game.powerFx`), different types stack; a HUD row shows each active timed effect with a shield-bar-style duration bar. Headless-tested (`scratchpad/test-f6.js`, 39 assertions). See GDD §2.14 and Version History v1.7.

### Resolved decisions (noted for the record)
- **Rapid + Triple = the higher cap (12), not the product (24).** Confirmed as spec'd — `maxBullets()` returns Triple's cap whenever Triple is active, so combining them never multiplies bullet volume. Keeps clutter from fighting Pillar 1.
- **Drop chance = 10%** (middle of the proposed 8–12% band), tunable via `POWERUP_DROP_CHANCE`. Health is *not* in the drop pool — it's ambient-only (`POWERUP_DROP_TYPES` = rapid/triple/magnet/engine), matching "floating spheres appear in the field on their own."
- **Magnet is a real attraction force, not just a bigger circle.** A `MAGNET_PULL` accel toward the ship with `MAGNET_DAMP` in-range velocity damping (terminal ≈ 130 px/s) so garbage glides in rather than oscillating, plus a modest `MAGNET_PICKUP_MULT` (1.6×) pickup-radius bump to honor "increases effective pickup radius." Respects momentum (Pillar 2).
- **Engine hooks the single `chainMass()` chokepoint** rather than touching `thrustMul`/`maxSp`/`massFactor` in three places — one guard reaches all three handling penalties, per the F5 forward-note.

### Weapon powerups (original design — see GDD §2.14 for the shipped spec)
- **Rapid Fire:** doubles the max simultaneous player bullets (from 4 to 8) and likely shortens fire cooldown somewhat so the higher cap is reachable — exact cooldown change is a tuning detail.
- **Triple Shot Spread:** fires 3 bullets in a narrow spread per shot, with max simultaneous bullets tripled (4 → 12) to accommodate it.
- **If both are active at once** (no rule specified by you): proposed **take the higher cap, don't multiply them together** (i.e. 12, not 24) — stacking multiplicatively risks pathological bullet-spam and screen clutter that fights Pillar 1 (vector clarity). Flagged as a guess.

### Health powerups
- Free-floating pickup: a sphere with a red-cross emblem, per your spec. Proposed spawn behavior: **ambient field spawn** (similar cadence to the existing saucer timer) rather than an enemy drop, since "floating spheres appear" reads as something that shows up in the field on its own, not as loot from a kill. Restores HP on pickup (proposed +25, capped at max — same value as the score-milestone repair bonus from F2, for consistency).

### Garbage-collection powerups
- **Magnet:** temporarily increases `GARBAGE_PICKUP` radius (currently 18 px) — proposed 3× (54 px) for the powerup's duration, pulling nearby canisters toward the ship rather than just widening the pickup check (a true attraction force reads better than a bigger invisible circle, and is closer to what "magnet" implies).
- **Engine:** temporarily reduces the mass-based handling penalty from F5's chain math (proposed: halves the effective mass sum for `thrustMul`/`maxSp` purposes while active) — "easier to maneuver even when towing garbage," per your spec.
- **Other ideas, since you asked ("any powerup ideas you have")** — not committed scope, just brainstormed candidates worth considering alongside Magnet/Engine:
  - *Decay Freeze* — pauses the decay countdown on all free-floating garbage for a duration, letting the player take their time on a collection run.
  - *Overflow Capacity* — temporarily raises `CHAIN_MAX` above 12 for one big haul.
  - *Tether Shield* — chain nodes become briefly immune to hazard contact, protecting a haul through a dangerous patch.
  - *Compactor* — instantly compresses the current chain into a single high-value node (guaranteed delivery value, but ends the haul early) — an interesting "cash out now vs. keep pushing" risk decision that reinforces Pillar 5.

### Assumptions / open questions (best guess — override freely)
- **Duration & spawn source for weapon/magnet/engine powerups:** proposed ~15 s timed effects, dropped by Debris/Hunter Satellites on small-tier kills (an 8–12% chance) — this ties powerup access to combat progress rather than pure luck, and gives the small-tier kills (which already guarantee garbage) an extra reason to finish a lineage.
- **Stacking rule:** picking up the same powerup while it's active refreshes/extends the duration rather than stacking magnitude; different powerup types can be active simultaneously (e.g. Magnet + Rapid Fire together) since none of them conflict mechanically.
- **HUD:** a small icon row showing active powerups and their remaining duration — not detailed further here; a UI/HUD layout decision for whoever implements Phase 5.

### Interactions with existing systems
- Health powerups depend on F2 (HP system) existing first.
- Magnet/Engine depend on F5's mass-based chain math existing first.
- Weapon powerups are largely self-contained (extend `MAX_BULLETS` handling and `Ship.update`'s fire block), per the "New weapon/powerup" extension point already documented in GDD 3.3.

---

## F7 — Controller Support
**Status:** 🟢 Done — **hardcoded default bindings shipped in Phase 7 (v1.8); the player-facing rebinding UI shipped in Phase 8 (v1.9)** as Options → Controls, exactly as planned. The default-bindings spec lives in **GDD §2.15**; the rebinding UI + persistence is documented with F8 in **GDD §2.16**. Fully shipped — this section is retained only as the historical record of the resolved decisions below.

### Shipped in v1.8 (Phase 7) — hardcoded defaults
- The `input` predicate object (`left`/`right`/`thrust`/`fire`/`shield`) now resolves keyboard **or** the first connected gamepad, with **no call-site changes** — the whole game still calls `input.left()` etc. Driven by a data-driven **`bindings`** table (one entry per action: keyboard `keys` / gamepad `buttons` / analog `axis` / a `fixed` rebindable flag), so F8's rebinding UI has a single structure to edit.
- `pollGamepad()` reads `navigator.getGamepads()` once per frame (before `update()`), uses the **first connected** pad only (ignores the rest), and snapshots buttons/axes + the prior frame's buttons for edge detection.
- Defaults exactly as spec'd: D-Pad / Left Stick past a `GP_DEADZONE` (0.25) for rotate CCW/CW + thrust, A to fire. Menu/system reads wired now (edge-triggered): A = confirm, B = back (reserved — no menu to back out of until F8), Start = start/pause/unpause (Start toggles pause like `P`).
- Headless-tested (`scratchpad/test-f7.js`, 52 assertions); f2–f6 regressions re-run green. See GDD §2.15 and Version History v1.8.

### Resolved decisions (noted for the record)
- **Shield → Right Trigger *or* Right Bumper** — the one binding F7 left unspecified. Filled with *both* shoulder inputs on the right side (either fires it), matching the "a shoulder button (e.g. right trigger or right bumper)" suggestion. Flagged as a gap-fill in the delivery notes / STATUS.md, and rebindable in F8 like the rest.
- **Menu keyboard reads route through the same `bindings` table.** The keydown handler now checks `bindings.confirm.keys` / `bindings.pause.keys` instead of inline `"Enter"`/`"p"` literals, so there's one source of truth for both input methods — behavior is byte-identical to before (Enter still starts/restarts, P still pauses).
- **Audio unlock on a controller press is best-effort only.** A Start/A press attempts `AudioSys.init()`/`resume()` (same as the keyboard), but browsers don't reliably count gamepad input as a user-activation gesture for the Web Audio autoplay policy — a controller-only player may still need one keyboard press for sound. A known browser limitation, surfaced as a playtest item.

### Spec (your defaults, as given)
**Configurable (player can rebind via Options → Controls):**
1. D-Pad Left / Left Stick Left past 25% deadzone → rotate CCW
2. D-Pad Right / Left Stick Right past 25% deadzone → rotate CW
3. D-Pad Up / Left Stick Up past 25% deadzone → thrust
4. A button → fire weapon

**Fixed, not configurable:**
1. A button → confirm/select in menus
2. B button → back out of current menu screen
3. Start button → start game / pause / unpause

### Assumptions / open questions (best guess — override freely)
- **Which stick/axis mapping for "up"?** Standard gamepad axis convention (negative Y = up) via the Gamepad API — no ambiguity here, just noting it for the implementer.
- **Multiple controllers connected:** proposed — use the first connected gamepad only (`navigator.getGamepads()[0]` equivalent), ignore others. No multi-controller/co-op scope implied by your request.
- **Shield button:** you didn't specify a controller binding for the shield. Proposed default: a shoulder button (e.g. right trigger or right bumper), configurable like the rest. Flagging since it's a gap in your spec, not a design disagreement.
- **Keyboard bindings remain configurable too** (implied by "these should all be configurable" plus the later Options → Controls spec covering "keyboard and game controller control buttons") — so this phase's rebinding UI covers both input methods, not just the controller.

### Interactions with existing systems
- Requires refactoring the current `input` predicate object (GDD 3, Input row) from hardcoded key-checks into a layer that checks *either* keyboard state *or* gamepad state against a configurable binding table. This is a clean, contained refactor — the rest of the game only ever calls `input.left()`, `input.thrust()`, etc., and doesn't need to change.
- The **rebinding UI itself** is part of F8 (Options → Controls submenu). F7's first pass (Phase 7) ✅ shipped the *hardcoded* defaults working end-to-end (v1.8); the rebinding UI arrives in **Phase 8** alongside the rest of the options menu, editing the `bindings` table this phase established.

---

## F8 — Pause Modal & Options Menu
**Status:** 🟢 Done — shipped in **Phase 8 (v1.9)**. The full shipped spec lives in **GDD §2.16** (menu state machine, gain-routing volume sliders, live rebinding, `localStorage` persistence); §2.8 (audio gain routing) and §2.9 (controls) were updated too. This section is retained only for the resolved decisions below.

### Resolved decisions (shipped as spec'd, with these calls made)
- **Music slider with no music.** As proposed: the Music slider + its gain node are wired into the audio graph, but **nothing is connected to the music node's input — there is no music track.** It changes nothing audible today; it exists so a future track drops in without re-plumbing. Called out plainly in the delivery notes and GDD §2.8 (not a silent placeholder track).
- **AudioSys gain refactor.** Every voice now connects to an `sfx` bus → `master` bus → destination (was: each sound straight to `ctx.destination`). `setVol(cat,v)` drives the three sliders; `vol {master,sfx,music}` (0..1, 1 = unity = pre-v1.9 loudness) persists even before the graph exists.
- **Persistence.** Volumes + custom bindings save to `localStorage` (`afd_settings_v1`) on change, load once at startup. All access is `typeof`-guarded + try/caught so the sandbox's missing `localStorage` (or a privacy-mode throw) never crashes the game. **Real-browser persistence still needs a sanity check outside the artifact sandbox** — flagged in STATUS.md.
- **Quit → title screen** (a webpage can't reliably close its own tab), same as reaching game-over.
- **Rebinding scope & the gamepad-axis call.** All five F7 gameplay actions (rotate CCW/CW, thrust, fire, shield) are rebindable for both keyboard and gamepad; menu nav (A/B/Start) stays fixed. A **gamepad** rebind captures a *button* and drops that action's analog-stick axis (a stick direction can't be captured, and the displayed binding must match what actually fires); Return to Defaults restores the axis. Documented in GDD §2.16.
- **Menu vs. gameplay input separation** (the flagged cross-cutting concern): the `keydown` handler and `handleGamepadMenu` each check rebind-capture → menu-open → normal-play in that order, and menu/capture input is consumed before `keys{}` is ever written, so it can't leak into ship control; `update()` stays frozen while paused. Verified headlessly in `scratchpad/test-f8.js`.

---

## F9 — Achievements System
**Status:** 🟢 Done — shipped in v2.0 (build Phase 9). The full shipped spec now lives in **GDD §2.17** (with §2.9 updated for the new Options → Achievements viewer entry). This section is retained only for the resolved-decisions note below; the original spec/pools/assumptions follow it for the record.

### Resolved decisions (shipped as spec'd, with these calls made)
- **Weekly rotation exactly as proposed:** pool index = `(isoYear × 52 + isoWeek) % 15` from the real UTC date at launch (ISO week is Monday-based/UTC via a Thursday-of-week rule), 5 consecutive entries wrapping the 15-pool. Deterministic — no randomness. **Weekly-unlock progress resets when the calendar week rolls over** (the stored week key must match the current one to carry over); lifetime progress is always retained. Verified headlessly incl. a year-boundary case (2027-01-01 → ISO 2026-W53) and a wrapping slice.
- **All 15 weekly + 12 lifetime starter achievements implemented**, each with a real stat hook placed at the event's existing site (observe-at-the-source — no new indirection), per the phase prompt. Per-game counters live in a flat `game.stats` bag (`resetGameStats()`); lifetime counters on `Achievements.lifetime`.
- **Separate `localStorage` key** (`afd_achievements_v1`, not folded into settings' `afd_settings_v1`) so a schema change to one never disturbs the other — as STATUS.md recommended. Same guarded (`typeof` + try/catch) contract; saved on unlock / game over / Quit / every 30 s. **Real cross-session persistence still needs a browser check outside the artifact sandbox** — carried as a playtest ask.
- **Notification:** a non-blocking gold toast (`ACH_TOAST_TIME` 4.5 s, fades in/out, stacks) + a distinct `AudioSys.achievement()` fanfare.
- **Viewer entry point:** **Pause → Options → Achievements** (reuses the tested F8 menu state machine — the lowest-risk integration). The title screen shows a hint pointing there; a first-class title-screen entry remains an easy future add (as STATUS.md predicted).
- **A few starter achievements are intentionally hard/degenerate** (e.g. Waste Not — "zero canisters expired" — is near-impossible to earn legitimately given the 39–66 canisters a lineage sheds, yet trivially satisfiable by dying before anything decays). Implemented literally per the starter pool; balancing/curating the pools is a post-playtest pass, not this phase's job.

---

### Original spec (retained for the record — shipped spec is GDD §2.17)

- **5 weekly achievements**, drawn from a rotating pool, changing based on the real-world calendar week (ISO week number) so every player worldwide sees the same weekly set on the same days. Once the pool is exhausted, it loops back to the start.
- **Lifetime achievements** — longer-term, harder, some skill-based and some cumulative/grindy.

### Weekly achievement pool (starter set — 15 ideas, cycles 5 at a time across 3 weeks before repeating; easy to extend since the system just indexes by pool size)
1. **Scrap Runner** — Deliver 20 garbage canisters to the recycling dock in a single game.
2. **Heavy Hauler** — Deliver a full 12-canister chain in one dock visit.
3. **Glass Cannon** — Reach wave 5 without picking up a health powerup.
4. **Satellite Buster** — Destroy 15 Debris Satellites (any size) in one game.
5. **Hunter's Bane** — Destroy an entire Hunter Satellite line (large → all mediums → all smalls) from a single spawn.
6. **Pacifist Tow** — Deliver 5 canisters without firing your weapon during that haul.
7. **Close Shave** — Survive a Hunter Satellite collision with less than 10 HP remaining.
8. **Shield Surfer** — Deflect 10 hazards with your shield in one game.
9. **Small Ball** — Destroy 10 small saucers in one game.
10. **No Scratches** — Complete wave 3 without taking any damage.
11. **Combo Collector** — Reach a delivery combo of 8+ in one dock visit.
12. **Speed Recycler** — Deliver your first canister within 60 seconds of starting a game.
13. **Powered Up** — Use all four powerup types in a single game.
14. **Diamond Cutter** — Destroy 3 large Hunter Satellites in one game.
15. **Waste Not** — Let zero garbage canisters expire/decay in a single game.

### Lifetime achievement pool (starter set — 12 ideas)
1. **Recycling Magnate** — Deliver 1,000 total canisters, cumulative across all games.
2. **Century Club** — Reach wave 25 in a single game.
3. **Untouchable** — Reach wave 10 in a single game without ever dropping below 50% HP.
4. **Ghost Protocol** — Destroy 50 Hunter Satellites (any tier), cumulative.
5. **Ton of Scrap** — Accumulate 10,000 lifetime score from dock deliveries alone.
6. **The Long Haul** — Successfully deliver a full 12-chain, 10 times cumulative.
7. **Iron Hull** — Survive 100 cumulative hazard hits without dying, across all games.
8. **Perfect Wave** — Clear a wave with zero damage taken, 10 times cumulative.
9. **Saucer Hunter** — Destroy 200 saucers (big + small combined), cumulative.
10. **Marathon Runner** — Accumulate 10 hours of total play time.
11. **Master of the Field** — Reach wave 50 in a single game.
12. **No Powerups Needed** — Reach wave 15 in a single game without ever picking up a powerup.

### Assumptions / open questions (best guess — override freely)
- **Calendar mechanics:** proposed formula — pool index = `(ISO year × 52 + ISO week number) % pool size`, computed from real UTC date at game launch, so the assignment is deterministic and identical for every player regardless of time zone quirks (ISO week boundaries are Monday-based UTC, which avoids most of the ambiguity daily-local-time would introduce).
- **Persistence:** achievement progress (especially lifetime ones) is meaningless without cross-session storage — same `localStorage` caveat as F8 applies here, more acutely, since lifetime achievements need to survive indefinitely.
- **Notification UI:** not spec'd here (a toast/banner on unlock is the obvious approach) — left as an implementation detail for the phase that builds this.
- **Pool size vs. calendar cadence:** 15 weekly achievements cycling 5-at-a-time means a 3-week rotation before repeats. If you'd rather have a longer rotation before repeats, the fix is just "add more achievement ideas to the pool," not a structural change.

### Interactions with existing systems
- This is the most "additive, touches-everything-a-little" feature — it needs hooks into nearly every system (kill counts by enemy type, dock deliveries, HP thresholds, powerup usage, wave number) to track progress. That's why it's last in the build order: achievement definitions are much easier to write and wire up once the final names and mechanics of F1–F8 actually exist, rather than tracking stats for systems that might still change shape.

---

## F10 — Difficulty Ramp & Early-Game Pacing
**Status:** 🟡 In Progress — **the difficulty helper + saucer application shipped in Phase 4 (v1.5), and the Hunter-Satellite scaling shipped in Phase 5 (v1.6)**; only the Debris-density retune remains deferred (see below). The shipped spec lives in **GDD §2.6 / §2.13** (saucers), **§2.5** (Hunters), with Pillar 6 flipped from planned to shipped in §1.

### Shipped in v1.5 (Phase 4)
- **`difficultyFactor(wave)`** = `1 − Math.exp(−(wave − 1) / RAMP_WAVES)` (0 at wave 1, → 1 over many waves) and a **`ramp(floor, ceil, wave)`** interpolation helper, both in the Helpers block. `RAMP_WAVES = 8` is the single ramp knob.
- **Saucers** re-expressed as named floor/ceiling pairs scaled through `ramp`: spawn gap `rand(20,30)s` → `rand(12,16)s`; fire-rate multiplier `1.8×` → `1.0×` (via a new `Saucer.rollFireTimer(range)` on both reload and first-shot); small-saucer aim error `±0.35` → `±0.09` rad; small-saucer appearance chance `15%` → `60%`.
- **Folded in the old score>8000 small-saucer gate** (per the cleanup note below) — escalation is now purely wave-driven, one system not two. Behavior/shape otherwise unchanged. Headless-tested (`scratchpad/test-f4.js`, 30 assertions).

### Shipped in v1.6 (Phase 5)
- **Hunter Satellite scaling** ✅ — the Hunter redesign (F4) wired every drift/homing speed and turn rate into `difficultyFactor`/`ramp` from the start: the full-intensity numbers are the ceilings, `HUNTER_FLOOR_FRAC` (0.58) sets the wave-1 floor. See GDD §2.5 / §2.13.

### Still open (NOT shipped)
- **Debris Satellite density retune** — the joint F3+F10 pass (see F3's "Still open" note). Leans on `GARBAGE_DECAY` for density, not the difficulty curve; still a post-playtest tuning pass, not a number to guess. Now that both the saucers (v1.5) and the Hunters (v1.6) are calmer early, this is closer to being judgeable — but it wants the *combined* early-game feel confirmed in a browser first.

---

This feature came out of playtesting: the shipped game is too intense in its opening waves. Hunter Satellites (and their split children) seek too fast from the start, and both saucer types appear too often, fire too often, and aim too accurately for a new player's first few levels. The fix is a **global difficulty-scaling system** that starts everything gentler and ramps up slowly with wave number, so players can enjoy the first several waves before the pressure builds. This is a distinct, cross-cutting feature rather than a set of scattered tweaks, because all the affected systems should scale off one shared, easy-to-tune difficulty curve.

### Design principle (add to GDD Pillars once shipped)
**Ease players in.** Opening waves should be approachable; intensity ramps gradually with wave number, not all at once. Any new threat parameter (speed, fire rate, accuracy, spawn frequency, density) should be expressed as `base_value` scaled by a wave-driven difficulty factor, not a flat constant — so the whole game's pacing can be tuned from one place. This sits alongside Pillar 3 ("Pressure, not chaos") — the pressure should *arrive on a schedule*, not slam the player at wave 1.

### The difficulty factor
- A single helper, proposed `difficultyFactor(wave)`, returns a multiplier that starts low and climbs slowly. Proposed shape: `0` at wave 1, approaching `1.0` asymptotically over many waves — e.g. `1 - Math.exp(-(wave-1) / RAMP_WAVES)` with `RAMP_WAVES ≈ 8`, giving roughly: wave 1 = 0.00, wave 2 = 0.12, wave 3 = 0.22, wave 5 = 0.39, wave 8 = 0.61, wave 12 = 0.77, wave 20 = 0.91, plateauing near full intensity by ~wave 25.
- Each affected parameter interpolates between an **easy floor** (used at wave 1) and a **full-intensity ceiling** (the roughly-current or slightly-higher values) using this factor. This keeps one tuning knob (`RAMP_WAVES`) controlling how fast the whole game gets hard, plus per-parameter floor/ceiling pairs for fine control.

### What scales (all values proposed, tunable — floors are the new easy early-game numbers, ceilings are the intense late-game numbers)

**Hunter Satellites (F4):** Paul's note — "moves too fast for beginning levels; all of its parts seek too fast; can ramp up as levels increase, but do it slowly."
- Large-tier drift speed, and every child tier's homing speed *and* turn rate, all scale with `difficultyFactor`. At wave 1, use a gentle floor (proposed ~55–60% of the F4 ceiling speeds/turn rates); ramp toward the full F4 values (the reshaped-Wedge numbers) as waves climb.
- The *large* Hunter's passive pre-hit drift stays passive at all difficulty levels (Paul confirmed) — only its drift *speed* scales, not its behavior.

**Saucers (existing / GDD 2.6):** ✅ **Shipped in v1.5 — spec now in GDD §2.6/§2.13; the detail below is the original design rationale.** Paul's note — "appear too frequently, fire too often, shots too accurate for beginning levels; less frequent, fire less often, aim less accurately at first, ramp over time."
- *Spawn frequency:* the saucer spawn timer's floor (minimum time between saucers) should be **longer** at low waves and shorten as difficulty climbs. Today it's `rand(12,22) - min(6, wave)` — this needs re-expressing so early waves have noticeably longer gaps (proposed early-game gap ~20–30s, tightening toward the current ~12–16s at high difficulty).
- *Fire rate:* both saucers' between-shots timers start **slower** (longer gaps) early and tighten with difficulty. Today big = `rand(0.9,1.6)`, small = `rand(0.7,1.1)`; propose early-game multipliers of ~1.8× those intervals at wave 1, easing to 1.0× at full difficulty.
- *Aim accuracy:* the small saucer's aimed-fire error (today `±0.09 rad`) should be **much wider** early (proposed `±0.35 rad` at wave 1, a barely-aimed spray) tightening to the current `±0.09` at full difficulty. The big saucer already fires randomly, so no accuracy change needed there — though its random fire is already the "easy" case, which is fine.
- *Small vs. big saucer mix:* the small (aimed, dangerous, 1000-pt) saucer's appearance chance could also scale — rarer early, more common later — but the existing score-gated logic (small saucer chance rises above 8000 pts) already does something similar. Propose folding that into the difficulty factor for consistency rather than leaving two separate escalation systems; flagged as an implementation cleanup, not a behavior change Paul asked for.

**Debris Satellite density (F3):** Paul's note — "because we've made difficulty lower by chilling out Hunters and UFOs, we can fill empty space with more Debris Satellites."
- The larger world (F1) plus calmer threats leaves room for more of the passive Debris Satellites. Their per-wave spawn count can be raised relative to the F3 baseline. **Interaction caution:** F3 already flagged that guaranteed-3-per-tier garbage drops create ~8× the garbage volume, and recommended *lowering* wave spawn counts to compensate. These two pressures push in opposite directions — more Debris Satellites for a fuller field (F10) vs. fewer to control garbage density (F3). The right answer is a playtested middle: more satellites than a garbage-controlled minimum, but with `GARBAGE_DECAY` doing more of the density-control work so the field feels populated without drowning in canisters. This is explicitly a tuning pass to do *after* both F3 and F10 are in, not a number to guess now.

### Assumptions / open questions (best guess — override freely)
- **Ramp speed (`RAMP_WAVES ≈ 8`):** chosen so the first 3–4 waves feel clearly gentle and full intensity arrives around wave 20–25. If Paul wants the "enjoy a few levels" window longer or shorter, this one constant moves it.
- **Does difficulty scale on anything besides wave number** (e.g. score, or player skill)? Proposed: wave number only, for predictability and because it's what Paul described ("as levels increase"). Score- or skill-adaptive difficulty is a much bigger design question, out of scope unless requested.
- **Should the ramp ever reset** (e.g. after a game-over, obviously yes since it's a new game; but within a very long single game, no — it just plateaus near 1.0). Assuming plateau, not reset.

### Interactions with existing systems
- **F4 (Hunter Satellites)** should be *built with the difficulty factor already in mind* — its speed/turn-rate values become the ceilings that `difficultyFactor` interpolates up toward. This means **F10's difficulty helper should ideally exist before or alongside F4**, so F4 can wire into it directly rather than being built flat and retrofitted. See revised phase ordering in `IMPLEMENTATION-PHASES.md`.
- **Saucers** are shipped v1.1 code; F10 modifies their existing spawn/fire/aim logic in place.
- **Debris Satellite density** ties into F3's spawn-count balance pass.
- This is the natural home for the **"enemy incoming" awareness cue** and the **off-screen threat indicators** flagged elsewhere — calmer early waves plus a bigger world make it more important that players can tell when something is approaching. Noted for later, not committed scope here.

---

## Cross-Cutting Technical Concerns

- **`localStorage` caveat (F8 ✅ / F9 pending):** doesn't work in the claude.ai artifact preview sandbox; works fine as a real local file. **F8 (v1.9) shipped the first persistence** — all access is `typeof`-guarded + try/caught so a storage failure never crashes (GDD Section 4 item 1 / §2.16). **Still needs an explicit sanity check in a real browser** (settings survive a reload) — carried as a STATUS.md playtest ask. F9 (achievements) will reuse the same guarded pattern.
- **Garbage volume increase (F3):** the guaranteed-3-per-tier drop model is roughly 8× the current garbage volume per large-satellite lineage. This needs a real balance pass (decay timing, wave spawn counts, on-screen density) once F3 ships — not something to pre-guess with invented numbers.
- **Entity count & performance (F1 + F3 + F4 combined):** a bigger world, guaranteed 3-way splits at two tiers instead of one 2-way split, and more garbage all raise the simultaneous entity ceiling substantially above the "~80 entities, watch shadowBlur cost" note already in GDD 3.2. Worth a frame-rate check after Phase 4 ships, before building further on top.
- **Menu/gameplay input separation (F7 + F8) ✅ addressed in v1.9:** the `keydown` handler and `handleGamepadMenu` each resolve three contexts in priority order — **rebind-capture → menu-open → normal-play** — and menu/capture input is consumed *before* `keys{}` is written, so a captured keypress (or any menu nav) can never reach ship control; `update()` also stays frozen while `paused`. Verified in `scratchpad/test-f8.js` (menu key navigates without setting `keys{}`; ship doesn't rotate while paused even with a gameplay key held).