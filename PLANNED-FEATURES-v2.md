# ASTEROID FIELD DELUXE — Planned Features (v2.0 Design)

**Status:** Design complete for all features below; **nothing in this document is built yet.**
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
**Status:** 🔴 Not Started

### Spec
- World size increases from the current 1280×720 (which is both the field *and* the screen) to a larger toroidal world — proposed **3840×2160** (3× in each dimension). The world still wraps at its own edges, same torus topology as today, just bigger.
- The screen becomes a **1280×720 viewport** that scrolls to keep the ship centered. Camera simply tracks the ship's world position every frame (no clamping needed, since the world wraps — there's no "edge" for the camera to bump into).
- All existing wrap-aware helpers (`dist2`, `angleTo`, `shortDelta`, `wrap`) need to operate against world dimensions (`WORLD_W`/`WORLD_H`), not screen dimensions (`VIEW_W`/`VIEW_H`). Rendering needs a camera-offset translation pass.
- Off-screen entities still simulate normally (they're in a much bigger world now); only on-screen ones need to be drawn — a visibility cull becomes worthwhile for performance once the world is 9× the area.

### Assumptions / open questions (best guess — override freely)
- **World size (3840×2160):** confirmed good by Paul. Easy constant to retune later (`WORLD_W`, `WORLD_H`).
- **Off-screen threat awareness:** with a 3× bigger world, hazards can approach from outside the visible viewport with no warning. **Confirmed as a deliberately-deferred item** — Paul wants this parked so it isn't forgotten, to be addressed later (a good fit alongside F10's difficulty pacing, since calmer early waves + bigger world make approach-awareness more valuable). Not committed scope for Phase 1; tracked here and in F10's interactions note.
- **Spawn distribution:** confirmed — spawn new hazards within a radius of the player's *current* world position (not world center), so waves don't spawn entirely off-screen and take forever to matter.

### Interactions with existing systems
- **Everything.** This is the foundational change — nearly every other system (dock placement, wave spawning, wedge/hunter homing, HUD) implicitly assumes screen space = world space today. This is why it's Phase 1 in the implementation order (see `IMPLEMENTATION-PHASES.md`), even though you listed it in the middle of your notes.
- The recycling dock (shipped in v1.1) needs to reposition somewhere in the *larger* world, not just the current 1280×720 rect — likely still "somewhere reasonably reachable," worth a max-distance-from-ship-spawn constraint so it's not absurdly far on wave 1.

---

## F2 — Health Points & Knockback (replaces Lives)
**Status:** 🔴 Not Started

### Spec
- Replace the discrete lives counter (`game.lives`, currently 3 + extra life every 10,000 pts) with a single **HP pool**. Ship takes damage from hazard contact and hostile bullets instead of dying outright; explosion (game over) only happens at 0 HP. No mid-game respawns — one HP pool for the whole run.
- **Knockback:** on any hit that doesn't destroy the ship, the ship's velocity is set away from the hazard at a strong impulse, so it physically separates rather than sitting inside the hazard racking up continuous damage.
- A brief **hit-stun invulnerability** (distinct from the old 2.5 s spawn invulnerability, which goes away since there's no respawn) prevents the same hazard from hitting the ship again in the same handful of frames.
- Health powerups (F6) restore HP, capped at max.
- HUD: HP bar replaces the life-ship icons.

### Assumptions / open questions (best guess — override freely)
- **Max HP: 250** (confirmed by Paul for initial testing). Damage per hit (proposed, tunable, confirmed as starting values): small Debris Satellite 20, medium 35, large 50; Hunter Satellite ramming damage slightly higher per tier (30/45/60) since it's the more dangerous, actively-hunting threat; hostile saucer bullet 15. These are first-pass numbers — flagged as a balance lever, but Paul has confirmed them as the starting point.
- **Hit-stun duration:** 1.0 s (confirmed).
- **Knockback strength:** ~250 px/s impulse directly away from the hazard's center (confirmed as starting value). Still worth feel-testing but Paul has confirmed the starting number.
- **What happens to "extra life at 10,000 points"?** Doesn't make sense in an HP-only model. Replacement (confirmed by Paul): the same score milestone grants a **+25 HP repair bonus** instead (capped at max HP; if already full, converts to a flat score bonus instead so the milestone always means something).
- **Does the shield still work exactly as before?** Yes (confirmed) — shield deflection continues to prevent damage entirely at the cost of energy, same as today. Knockback only applies to *unshielded* hits. This keeps the shield as the "free" answer and HP/knockback as the fallback when the shield isn't up, preserving Pillar 4.
- **Is this a genuinely permanent game-over with no continues?** Yes (confirmed) — single HP pool, no respawns, no lives in reserve, no continues.

### Interactions with existing systems
- **Salvage chain (v1.1):** `killShip()`/`scatterChain()` still fire, but only at true 0-HP death now, not at every hit. This is arguably a buff to the salvage mechanic — cargo runs become less fragile since a single hazard touch no longer risks ending the run outright.
- **Respawn-clearing logic** (GDD 2.1, "respawn only when center is clear") is deleted entirely — there's no respawn to gate.
- **Debris/Hunter Satellites (F3/F4):** their contact damage numbers should be defined alongside F2's implementation so the whole damage table is consistent.

---

## F3 — Debris Satellites (Asteroid Reskin)
**Status:** 🔴 Not Started

### Spec
- Replaces the `Asteroid` class/behavior (see Naming Resolution above). Visual redesign: broken-satellite silhouette (antenna/panel-shard polygon) instead of jagged rock, keeping the vector-glow rendering style (Pillar 1).
- **Large hit** → splits into **3 medium** Debris Satellites + emits **3 garbage canisters**.
- **Medium hit** → splits into **3 small** Debris Satellites + emits **3 garbage canisters**.
- **Small hit** → fully destroyed, emits **3 garbage canisters** (no further split).
- This replaces the old model (2-way split, probabilistic single-canister drop) with a fixed 3-way split and guaranteed 3-canister drop at every tier.

### Assumptions / open questions (best guess — override freely)
- **Guaranteed 3 garbage per kill at every tier is a large volume increase.** One fully-cleared large rock under the old model produced up to ~5 canisters total (probabilistic); under this spec, one large lineage produces 3 (from the large) + 9 (from 3 mediums × 3) + 27 (from 9 smalls × 3) = **39 garbage canisters** if a player clears the entire lineage. That's roughly 8× the current volume. This is a deliberate request-driven change, but it has real knock-on effects:
  - `GARBAGE_DECAY` (currently 20 s) may need to shrink so the field doesn't carpet itself in canisters.
  - `CHAIN_MAX` (currently 12) already caps how much a player can tow at once, which helps, but free-floating garbage density on screen will be much higher.
  - Wave asteroid counts (`min(4+wave, 11)` large spawns) likely need adjusting — but note the **opposing pressure from F10**: Paul wants *more* Debris Satellites to fill the larger, calmer world, while F3's garbage volume wants *fewer*. Resolve this as a joint F3+F10 tuning pass (see F10), leaning on `GARBAGE_DECAY` for density control so the field can stay populated with satellites without drowning in canisters.
  - **I'm not silently retuning these** — flagging them as a required balance pass during/after Phase 3, not guessing numbers now with zero data.
- **Introduces a `mass` field on garbage** as part of this phase's foundation (defaulting to 1.0 for all Debris-Satellite-sourced garbage), because Hunter Satellites (F4) need low-mass garbage from their final tier, and the chain math needs to support per-node mass rather than a flat per-canister penalty. See F5 below — I've folded F5 into this feature's implementation rather than keeping it separate, since it has no independent purpose without F3/F4.

### Interactions with existing systems
- **Chain physics (3.4 in GDD):** `CARGO_MASS`, `CARGO_THRUST`, `CARGO_MAXSPD` currently scale off `chain.length` (a count). This needs to become a sum of `node.mass` across the chain instead, so lighter (Hunter-sourced) garbage tows more easily than heavier (Debris-sourced) garbage, per your explicit request ("lower mass than regular satellite garbage... can be towed more easily").
- **Scoring:** existing `AST_SCORE` table can carry over directly to Debris Satellite tiers unless you want new values reflecting the harder 3-way fights — no strong signal either way; defaulting to keep current large/medium/small score values (20/50/100) unless told otherwise.

---

## F4 — Hunter Satellites (Killer Satellite / Wedge Redesign)
**Status:** 🔴 Not Started

### Spec
- Replaces the shipped `Satellite` + `Wedge` system (see Naming Resolution above). Shape changes to a diamond (all three tiers).
- **Split children actively home** (relentless, wrap-aware re-aiming pursuit — Paul confirmed this over passive-drift, preserving the *Asteroids Deluxe* character; the early-game gentleness comes from the F10 difficulty ramp slowing everything down, not from making the children passive).
- **Large Hunter hit** → splits into **3 medium** Hunters, which home toward the player **faster** than the large did, + emits **3 garbage canisters** (normal mass).
- **Medium Hunter hit** → splits into **3 small** Hunters, homing **even faster**, + emits **3 garbage canisters** (normal mass).
- **Small Hunter hit** → fully destroyed, emits a **larger-than-normal burst of low-mass garbage** (proposed: 5–6 canisters at `mass: 0.5`) — per your note, explicitly a valuable, easy-to-tow bonus for finishing off a Hunter line.
- **All speed and turn-rate values are ceilings** that the F10 difficulty factor interpolates *up toward* — at wave 1 the whole Hunter family moves at a gentle fraction of these, ramping to full over ~20 waves. Build F4 wired into F10's `difficultyFactor` from the start (see phase ordering).
- Spawn cadence, drift/homing behavior, and wrap-aware pursuit carry over from the shipped Satellite/Wedge system's proven feel (GDD 2.5) — this is a reshape/renumber/enrich of that system, not a from-scratch enemy.

### Assumptions / open questions (best guess — override freely)
- **Speed progression per tier:** the shipped Wedge system already speeds up per tier (120 → 175 px/s) and increases turn rate (1.6 → 2.6 rad/s); proposing to keep that same progression philosophy across three tiers instead of two, with medium landing between the old large-wedge and small-wedge values and small becoming the fastest/most agile thing in the game. Exact numbers are a tuning pass, not a design blocker.
- **Low-mass garbage quantity ("sizable amount"):** guessed at 5–6 canisters, tunable.
- **Does the large Hunter still drift passively before being hit** (like the current hexagon does at 55 px/s) or does it home immediately? Keeping the current behavior (large drifts toward the ship's position at spawn time, doesn't continuously re-aim) since your description says "slowly drifts towards the player at all times," matching the existing shipped behavior — only the split counts, shape, and garbage emission are new.

### Interactions with existing systems
- **Reuses F3's mass field** for its low-mass final-tier garbage — this is why F4 depends on F3 shipping first (see `IMPLEMENTATION-PHASES.md`).
- **Chain vulnerability rules (GDD 2.10):** Hunter Satellites already damage the tow chain on contact today (as "satellites" in the existing hazard list) — this carries forward unchanged, just against the renamed/reshaped entity.
- **HP damage table (F2):** Hunter contact damage should be defined slightly above equivalent-tier Debris Satellite damage, since Hunters are the more dangerous, actively-seeking threat (see F2's proposed numbers).

---

## F5 — Variable-Mass Garbage (folded into F3, noted separately for clarity)
**Status:** 🔴 Not Started (ships as part of Phase 3)

This isn't a player-facing feature on its own — it's the technical foundation that makes F4's "low-mass garbage" request possible, and it changes the chain-physics contract documented in GDD 3.4. Recording it here as its own entry so the change is easy to find:

- `Garbage` instances and chain nodes both gain a `mass` field (default `1.0`).
- `Garbage.fromNode()` must carry `mass` over when a chain node is severed back into free garbage.
- Pickup logic must copy `mass` from the collected `Garbage` onto the new chain node.
- Chain math (`CARGO_MASS`/`CARGO_THRUST`/`CARGO_MAXSPD` factors, and the momentum-tug `massFactor`) changes from `chain.length` (a count) to `sum(node.mass for node in chain)`. A chain of 8 normal-mass canisters and a chain of 16 half-mass canisters should now tow identically.
- This is a good place to also implement the **Engine powerup** (F6) cleanly, since "easier to maneuver despite more mass" is naturally a temporary multiplier applied to the same mass-sum calculation.

---

## F6 — Powerups
**Status:** 🔴 Not Started

### Weapon powerups
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
**Status:** 🔴 Not Started

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
- The **rebinding UI itself** is part of F8 (Options → Controls submenu), so F7's first pass (Phase 6) should ship with the *hardcoded* defaults above working end-to-end, with the rebinding UI arriving in Phase 7 alongside the rest of the options menu.

---

## F8 — Pause Modal & Options Menu
**Status:** 🔴 Not Started

### Spec
- **Pause** (keyboard `P`, or gamepad Start) opens a modal with: **Continue**, **Options**, **Quit**.
- **Options** shows: SFX volume, Music volume, Master volume (sliders), and a **Controls** button.
- **Controls** screen: rebind keyboard and controller buttons for the four configurable actions (rotate CCW/CW, thrust, fire) — plus shield, per F7's flagged gap — and a **Return to Defaults** button.
- Fixed (non-configurable) menu navigation: A = confirm, B = back, Start = start/pause/unpause, as specified in F7.

### Assumptions / open questions (best guess — override freely)
- **"Music volume" implies music exists, but the shipped game has no music** — only synthesized SFX (GDD 2.8). I'm treating this as: add the volume slider and wire it into the audio graph now, but **no music track is in scope for this phase** unless you want one. If you do want music, that's a separate, fairly substantial addition (composition/synthesis approach, looping, adaptive intensity) worth its own discussion rather than folding it silently into this phase.
- **Master/SFX volume routing:** the current `AudioSys` has independent gain nodes per sound with hardcoded gain values (GDD 3, AudioSys row). This phase needs to route everything through master + category (SFX) gain nodes so the sliders actually do something — a real, if mechanical, refactor of `AudioSys`.
- **Settings persistence:** volume levels and rebound controls should persist between sessions via `localStorage`. **Caveat carried over from the existing roadmap note:** `localStorage` doesn't work inside the claude.ai artifact preview sandbox, but works fine once this is run as a real local file (which is the expected environment once you're driving development through Claude Code rather than previewing in chat). Worth a quick sanity check the first time this ships.
- **Quit behavior:** for a browser game, "Quit" most likely means returning to the title screen rather than closing a window/tab (which a webpage can't reliably do anyway). Proposing Quit → title screen, same as reaching game-over today.

### Interactions with existing systems
- Introduces the game's first real **menu/UI state machine** — until now, `game.state` has only ever been `title` / `playing` / `gameover`, plus a simple `paused` boolean. This phase adds nested menu states (options, controls-rebind) that need their own input handling separate from gameplay input, and needs to coexist with F7's gamepad-vs-keyboard input layer (menus must be navigable by both).
- The rebinding screen is where F7's controller bindings actually become player-editable — these two features ship in the same phase for that reason (see `IMPLEMENTATION-PHASES.md` Phase 7).

---

## F9 — Achievements System
**Status:** 🔴 Not Started

### Spec
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
**Status:** 🔴 Not Started

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

**Saucers (existing / GDD 2.6):** Paul's note — "appear too frequently, fire too often, shots too accurate for beginning levels; less frequent, fire less often, aim less accurately at first, ramp over time."
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

- **`localStorage` caveat (F8, F9):** doesn't work in the claude.ai artifact preview sandbox; works fine as a real local file. Worth an explicit sanity check the first time settings/achievements persistence ships, wrapped in a try/catch regardless (existing roadmap note, GDD Section 4 item 1) so a storage failure never crashes the game.
- **Garbage volume increase (F3):** the guaranteed-3-per-tier drop model is roughly 8× the current garbage volume per large-satellite lineage. This needs a real balance pass (decay timing, wave spawn counts, on-screen density) once F3 ships — not something to pre-guess with invented numbers.
- **Entity count & performance (F1 + F3 + F4 combined):** a bigger world, guaranteed 3-way splits at two tiers instead of one 2-way split, and more garbage all raise the simultaneous entity ceiling substantially above the "~80 entities, watch shadowBlur cost" note already in GDD 3.2. Worth a frame-rate check after Phase 4 ships, before building further on top.
- **Menu/gameplay input separation (F7 + F8):** once menus exist, input handling needs a clean split between "gameplay input" and "menu input" so the two never fight each other (e.g. a rebind screen capturing a keypress shouldn't also rotate the ship if unpaused state leaks through). Worth explicit attention in Phase 7.