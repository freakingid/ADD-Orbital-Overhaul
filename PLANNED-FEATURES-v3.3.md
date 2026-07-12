# PLANNED FEATURES — v3.3 (Changeset 4)

Target build: **v3.3**, four phases (P1–P4). Predecessor: v3.2 (P1–P3) shipped.
All statements below were verified by grepping the live build (`asteroids-deluxe.html`,
post-Changeset-3), **not** from prior-conversation memory. Constants quoted are the values
actually in the file today.

Housekeeping (carry forward): when this round is spent, archive as
`archive/PLANNED-FEATURES-v3.3.md` and `archive/IMPLEMENTATION-PHASES-v3.3.md` — **version-suffixed,
never bare**. The pre-existing bare `archive/IMPLEMENTATION-PHASES.md` (the v2.0 one) should be
renamed `archive/IMPLEMENTATION-PHASES-v2.md` at the same time.

---

## 0. Verified state (what the build actually does today)

| Thing | Shipped value / behavior |
|---|---|
| World / view | `WORLD_W/H` 2560×1440, `VIEW_W/H` 1280×720 |
| Debris art | `DebrisSatellite` = **procedural** irregular hull (6+size verts) + 1–2 antenna/dish shards |
| Debris spawn rotation | `angle = rand(0, TAU)`, `spin = rand(-1.2, 1.2)` — **already random** |
| Hunter art | Diamond core / kite-diamond homers; core `angle = rand(0,TAU)`, homers render at `heading` |
| Garbage rotation | `spin = rand(0, TAU)`, `spinRate = rand(-1.5, 1.5)` — **already random** |
| Garbage decay | **None.** Removed in v3.2 P3. Two exits only: recycled, or consumed by coalescence |
| Clump | `pieces` counter, `mass` sums, `radius = 7·√pieces`, drawn as a **cluster of `pieces` mini-canisters** (golden-angle), **un-hookable**, non-solid, Magnet ignores it |
| Clump shatter | 1 player bullet → `pieces` singles, mass `clumpMass/pieces`, re-armed delay, no score |
| Coalescence | `GARBAGE_COALESCE_DELAY = 6.0`, `GARBAGE_MAGNET_RANGE = 260`, `GARBAGE_MAGNET_PULL = 40`, `GARBAGE_MERGE_DIST = 12`, `HUNTER_COALESCE_COUNT = 12` |
| Scrap-born Hunter | `bornOfScrap = true` → **emits zero garbage at every tier** (v3.2 P3, closes 12-in/66-out) |
| Hunter garbage | `HUNTER_GARBAGE = 3` (large/med), `HUNTER_SMALL_GARBAGE = 6` @ `HUNTER_SMALL_MASS = 0.5` |
| Powerups | `POWERUP_DROP_CHANCE = 0.10`, `POWERUP_DECAY = 14`, `POWERUP_DURATION = 15`, drop types `["rapid","triple","magnet","engine"]` (Health is ambient-only) |
| Pickup | `GARBAGE_PICKUP = 18` (circle from ship center); Magnet ×1.6 pickup, ×3 pull range |
| HUD | Score, HULL bar, `CARGO n/m`, `TARGETS n`, active-effect rows, dock chevron, **`WAVE n`** top-right (22px, `COLOR.dim`), SHIELD bar |
| Dialogs | `drawMenu()` dims backdrop `rgba(4,10,20,0.74)`; `menuPanel()` **strokes** the rect and never fills it — all 5 screens (root/options/difficulty/controls/achievements) route through it |
| Ship | drawn poly spans **18 px** wide (y −9…+9), 27 px long; `SHIP_RADIUS = 13` |
| Wave spawn | `count = min(3 + wave, 9)` large debris; clear gate = `debris.length === 0 && hunters.length === 0` |
| Storage | `afd_settings_v1`, `afd_achievements_v2` |

---

## 1. Rename → "Orbital Overhaul"

**Spec.** Drop "Asteroid Field Deluxe" as the product name. Touch points:
- `<title>` (line 6) → `ORBITAL OVERHAUL`
- Header banner comment (line ~30) → `ORBITAL OVERHAUL — v3.3` (keep the version-log body intact)
- Title screen: `"ASTEROID FIELD"` / `"D E L U X E"` → `"ORBITAL"` / `"O V E R H A U L"` (same two-line treatment, same sizes/colors)
- Doc titles: `GDD.md` H1, `STATUS.md` H1. **Rename the GDD file** `asteroid-field-deluxe-GDD.md` → `orbital-overhaul-GDD.md` and update every reference (`CLAUDE.md`, `STATUS.md`, GDD §5.1).

> **FLAG A-6 — do NOT rename the localStorage keys.** `afd_settings_v1` and `afd_achievements_v2`
> are load-bearing: renaming them silently wipes every player's settings, bindings, and lifetime
> achievement tiers. They stay `afd_*` forever. Add a one-line in-code comment saying so, or a future
> session will "tidy" them. Repo/dir name is Paul's call outside the code.

---

## 2. Real satellite drawings (replaces the "satellite asteroids")

**Scope = `DebrisSatellite` only.** That's the entity Paul means by "satellite asteroids" — the
passive field hazard with the procedural broken-hull silhouette.

> **FORK-1 — does the Hunter get real satellite art too?**
> **Recommendation: NO.** The Hunter's diamond is the threat tell — it's the one shape the player must
> read at a glance under pressure. Making Hunters look like satellites too collapses hazard/threat into
> one silhouette family and breaks Pillar 1. Debris = recognizable satellites; Hunter = hostile diamond.
> **Needs your sign-off** (it's the one place where "real satellites" could plausibly mean *all* of them).

**Spec.**
- New module-level table `SAT_ART`: **5–6 original, stylized line-art satellite silhouettes**, each an
  array of polylines in **unit space** (coords normalized so the design fits a radius-1 circle), each
  polyline tagged closed/open. Drawn with the existing `drawPoly` at `radius` scale — no fills, no new
  render primitive.
- Families to author (recognizable archetypes, **not** traced from any source asset — see licensing FLAG):
  comms bus + twin solar panels; dish relay; boxy Earth-observer with a boom; a Sputnik-ish sphere +
  radial whip antennas; a cylindrical upper-stage / spent booster; (optional) a truss/array segment.
- Each satellite is **wrecked**: 1–2 panels bent or snapped, one antenna hanging. This is a debris field,
  not a working constellation. Per-instance variation via a small random bend applied at construction
  (keep it in the constructor, not per-frame).
- `DebrisSatellite` gains `this.art = SAT_ART[floor(rand(0, SAT_ART.length))]`, chosen per-instance
  (splits re-roll independently). `draw()` iterates `this.art` instead of `this.hull`/`this.shards`.
- **Tier legibility:** small tier is `radius = 13`. A 14-segment satellite at r=13 is mush. Give the small
  tier a **simplified variant** of each design (2–4 strokes: body + one panel), or gate detail on
  `size >= 2`. **Playtest call** — implement the gate, tune by eye.
- `this.radius` / `DEBRIS_RADII` are unchanged: art is cosmetic, collision stays a circle (§3.1).

> **FLAG A-7 (licensing).** These are **original stylized silhouettes authored in code**, evoking real
> satellite archetypes. Do **not** import or trace NASA/Wikimedia/CC assets: the project is one
> self-contained GPL-3.0 HTML file with no external assets, and CC BY-SA sources would infect it.
> Archetype resemblance is fine; asset reuse is not.

---

## 3. Dialogs must obscure the background

**Spec.** Two edits, both in the render layer:
- `menuPanel(w, h, title)` — **fill the panel rect before stroking it**:
  `ctx.fillStyle = "rgba(2,6,14,0.95)"; ctx.fillRect(x, y, w, h);` then the existing glow-stroke.
  All five screens route through `menuPanel`, so this one edit fixes root/options/difficulty/controls/achievements.
- `drawMenu()` — raise the backdrop dim from `rgba(4,10,20,0.74)` to `~0.88` so the world behind the
  panel recedes as well.

Alpha values are look-calls; keep them adjacent and commented as such. Do **not** make the panel fully
opaque black — a faint 0.95 keeps the vector-glow aesthetic (Pillar 1).

Out of scope: the GAME OVER / title text (no panel, drawn over a mostly-empty screen — not the complaint).

---

## 4. Clump legibility — "this needs shooting"

**Already exists (partially):** a clump *does* render distinctly today — as a cluster of `pieces`
mini-canisters (v3.2 P1). The complaint is that the cluster reads as "a pile of pickups", not "a target".

**Spec.** In `Garbage.draw()`, `pieces > 1` takes a **completely different branch** from `pieces === 1`:
- **One closed hull polygon**, no inner lines, no mini-canisters. Vertices: 7–9, radius jittered around
  the existing derived `radius` (`7·√pieces`), **deterministic per clump** (generate once and cache on the
  object at merge time — do not re-randomize per frame). Rotated by `this.spin` so it still tumbles.
- **Danger tint**: the hull color lerps from `COLOR.garbage` (`#c8ff50`) toward a hot orange-red
  (`#ff5a2a`) as `pieces / HUNTER_COALESCE_COUNT` → 1. The clump literally reddens as it approaches the
  Hunter transform — that's the readability win *and* a free threat meter.
- Keep the radioactive alpha flicker; keep `glowStroke`. Add `COLOR.clumpHot` next to `COLOR.garbage`.
- `pieces === 1` is byte-identical to today (single `drawCanister`, `mass<1` pale tint preserved).

> **FLAG A-7b** — do not reuse an existing hazard hue. `#ff5a2a` is clear of the ship blue, debris blue,
> Hunter teal, dock green, rapid amber (`#ffd24a`), and health red (`#ff6b6b`). Look-call; tune on sight.

---

## 5. Random spawn rotation

> **FLAG A-2 — this ALREADY EXISTS and is not a bug.**
> - `DebrisSatellite`: `angle = rand(0, TAU)`, `spin = rand(-1.2, 1.2)` ✅
> - `Garbage`: `spin = rand(0, TAU)`, `spinRate = rand(-1.5, 1.5)` ✅
> - `HunterSatellite` (large core): `angle = rand(0, TAU)`, `spinRate = rand(0.6,1.0)·±1` ✅
> - `HunterSatellite` (medium/small homers): render at `heading` — **deliberately not random**. Their nose
>   points at you; that's the "I am aiming at you" tell. **Recommendation: leave homers alone.**
>
> The real content of this item is a **constraint on Phase 2**: the new `SAT_ART` silhouettes must keep the
> existing per-instance random `angle` + `spin` (easy to lose by accident when you replace the draw path,
> e.g. by anchoring art to a fixed "up"). Phase 2 asserts it; no separate phase.

---

## 6. Shot powerups: more often, linger longer

"Shot powerups" = **Rapid Fire + Triple Shot**. (Health is ambient-only on its own timer — unaffected.)

**Spec.**
- `POWERUP_DROP_CHANCE` **0.10 → ~0.16** (playtest knob).
- `POWERUP_DECAY` **14 → ~26 s** (playtest knob) — this is the on-field linger the item asks for.
- Replace the flat `POWERUP_DROP_TYPES` roll with a **weighted table** so rapid/triple are favored:
  `POWERUP_DROP_WEIGHTS = { rapid: 3, triple: 3, magnet: 1, engine: 1, scoop: 2 }` (scoop arrives in the
  same phase — §8). Weights are the knob; the numbers above are a starting point, not a spec.

> **FLAG A-9 — `POWERUP_DROP_TYPES` is load-bearing in the HUD.** The active-effect row iterates
> `POWERUP_DROP_TYPES` to draw timed bars. **Do not add `scoop` to that array** (scoop is not timed — see
> §8). Introduce a *separate* weighted drop table for `maybeDropPowerup`, and leave `POWERUP_DROP_TYPES`
> as the list of *timed* effects the HUD/`powerActive`/`powerBudget` machinery understands.

---

## 7. Level in the HUD

> **FLAG A-1 — this ALREADY EXISTS.** `draw()` renders `"WAVE " + game.wave` at top-right, 22px, in
> `COLOR.dim`. It's there; it's just invisible — dim, small, and parked in a corner with no label weight.

**Spec.** Rename the *display* label `WAVE` → **`LEVEL`** and promote it:
- Move it under the score (left column, above `CARGO`) or keep it top-right but at ~26px in `COLOR.text`
  with a dim `LEVEL` caption — either is fine, one line of code. **Recommendation:** left column,
  `LEVEL n` at 22px `COLOR.text`, directly under the HULL bar; shift `CARGO`/`TARGETS`/powerup rows down
  ~22px to make room (`prow` start moves with them).
- **Do not rename the variable.** `game.wave`, `nextWave()`, `difficultyFactor(wave)`, `ramp(...)`, and
  every achievement that reads `game.wave` stay as-is. This is a label change only. Also update the title
  screen / GDD wording to say "level" where it's player-facing, but keep "wave" as the code term
  (documented in GDD §2.7 so the two vocabularies don't drift).

---

## 8. Scoop powerup (new)

The biggest new system this round. A **persistent, non-timed** ship upgrade — unlike every existing powerup.

**Spec.**
- New game state: `game.scoopLevel` (0…`SCOOP_MAX_LEVEL` = **5**) and `game.scoopHits` (damage counter).
  Both reset in `startGame()`. **Not** in `game.powerFx`, **not** in `game.powerBudget`.
- New droppable powerup type `"scoop"` (own glyph in `drawPowerupGlyph` — a widening funnel/V — and own
  `POWERUP_COLOR` entry). `applyPowerup("scoop")` → `game.scoopLevel = min(SCOOP_MAX_LEVEL, +1)`; at max,
  award a small score bonus instead (mirrors the full-HP Health-milestone pattern). Push a `"SCOOP +1"` float.
- **Geometry.** The scoop is a **forward-facing capture mouth**, centered on the ship's facing axis:
  - `SCOOP_WIDTH = [0, 22, 30, 38, 46, 54]` px (index = level). **Level 5 = 54 px = 3× the drawn ship's
    18 px width**, per the brief.
  - `SCOOP_DEPTH = [0, 20, 24, 28, 32, 36]` px forward of the nose (playtest knob).
  - Capture test (in the pickup pass, wrap-aware via `shortDelta`): rotate the ship→garbage delta into
    ship-local space; a piece is captured if `|lateral| ≤ SCOOP_WIDTH[lvl]/2` **and**
    `-SHIP_RADIUS ≤ forward ≤ SCOOP_DEPTH[lvl]`. This is an **oriented box** (the mouth).
  - The base `GARBAGE_PICKUP` circle **always still applies** (OR'd with the box) — so `scoopLevel === 0`
    is byte-identical to today, and the Magnet's `MAGNET_PICKUP_MULT` still multiplies the *circle*, not
    the box (no double-counting).
- **Decay by damage.** In `damageShip()` (after the existing HP/knockback work, on any non-lethal hit):
  `game.scoopHits++`; if `scoopHits >= SCOOP_HITS_PER_LEVEL` (**2**) → `scoopLevel = max(0, scoopLevel-1)`,
  `scoopHits = 0`, push a `"SCOOP -1"` float + a distinct audio cue. No time decay — the scoop only ever
  goes away by taking hits.
- **Render.** Two prongs from the ship's nose flaring out to `±width/2` at the mouth (open polylines, ship
  color at lower alpha, or `COLOR.dock` green to read as "collector"), drawn in `Ship.draw()` before the
  hull. Level-5 mouth must be visibly 3× the ship — if it isn't obvious on screen, the widths are wrong.
- **HUD.** A `SCOOP` pip row (`●●●○○`) under the powerup rows, lit in the scoop color, hidden at level 0.
  Explicitly **not** a timed bar — do not route it through the `POWERUP_DROP_TYPES` loop.

> **FORK-2 — scoop shape: oriented box vs. widened circle.**
> **Recommendation: oriented box** (above). "Centered on the ship" + "3× the width of the ship" + "visibly
> wider" all describe a *mouth*, not a bigger radius, and a box gives directional intent (you sweep garbage
> up by flying through it) that a circle can't. A circle is ~5 lines cheaper. **Needs sign-off.**

> **FORK-3 — does `scoopHits` reset when you *gain* a level?**
> **Recommendation: no** — the counter is a running damage tally, reset only when a level is actually lost.
> (Alternative, more forgiving: a scoop pickup zeroes `scoopHits`.) Cheap either way. **Needs sign-off.**

> **FLAG A-8** — `applyPowerup` increments `game.stats.powerupsPicked`, which permanently freezes the
> `maxWaveNoPowerup` achievement counter. Picking a scoop will therefore end a "No Powerups Needed" run.
> That's consistent (it *is* a powerup) — flagged so it isn't discovered as a bug later.

---

## 9. Pacing: the late-wave lull

Root cause, stated plainly: the wave-clear gate is `debris + hunters`, garbage is not a target, and a
thinning field spread across 2560×1440 leaves the player flying through empty space. 9a/9b/9c raise the
*density and churn* of the salvage layer; they do not change the gate. **Separate lever, not spec'd here,
offered for your call:** `nextWave()`'s `count = min(3 + wave, 9)` — raising the cap, or tightening
`SPAWN_MAX_DIST` in late waves, attacks the lull directly. Say the word and it becomes a 10-minute P5.

### 9a — Small garbage decays again

> **FLAG A-3 — this REVERSES shipped v3.2 P3, and the GDD says not to.** GDD §2.10.1 currently contains a
> load-bearing bullet explaining that decay was removed and *why a future session must not restore it*.
> That bullet must be **rewritten** (with the new reason), not merely contradicted, or the next session will
> restore the old rule. Paul has explicitly accepted this reversal.

**Spec.** Reintroduce `GARBAGE_DECAY` on the `Garbage` class:
- Applies to **singles only** (`pieces === 1`). Countdown in `Garbage.update()`; `dead = true` at 0;
  restore the blink/fade-out branch in `draw()` for the last ~2 s.
- Chain nodes never decay (they're `game.chain`, not `game.garbage`). Severed garbage (`Garbage.fromNode`)
  inherits the same decay — no second constant (v3.2 P3 already deleted `GARBAGE_SEVER_DECAY`; don't bring
  it back).
- **Tuning is the whole ballgame:** `GARBAGE_DECAY` must exceed `GARBAGE_COALESCE_DELAY` by a wide margin
  or nothing ever clumps. Starting point: `GARBAGE_DECAY ≈ 22 s`, `GARBAGE_COALESCE_DELAY` **6.0 → ~3.0 s**
  (the 6.0 was tuned *for* permanent garbage; with a 22 s life, 6 s of inertness is a third of a piece's
  existence). `GARBAGE_MAGNET_RANGE = 260` was also raised *because* garbage was permanent — expect to walk
  it back toward ~180. **All three are playtest knobs. Do not over-specify; ship them commented as such.**

> **FORK-4 — do *clumps* decay?**
> **Recommendation: no.** A clump is a *target* and now also a *pickup* (9c) — aging it out steals the
> player's loot and their Hunter-prevention window. Singles decay; a clump is permanent until shot, scooped,
> or transformed. (Alternative: clumps decay on a long, `pieces`-scaled timer. More knobs, unclear payoff.)
> **Needs sign-off.**

### 9b — Hunters always drop garbage

> **FLAG A-4 — this REVERSES shipped v3.2 P3's FORK-B/B1 (`bornOfScrap`).** That rule exists because a
> scrap-born lineage is a **12-in / 66-out amplifier** and, with permanent garbage, the field diverges
> without bound. 9a is what makes 9b safe: **decay is now the governor.** Ship 9a and 9b in the *same*
> phase — 9b alone, without decay, is a divergence bug.

**Spec.** Delete the suppression: `destroyHunter`'s `const emitGarbage = !h.bornOfScrap;` gate goes away;
every Hunter, of every origin, emits at its tier's existing counts (3 / 3 / 6-at-low-mass).

> **FORK-5 — delete the `bornOfScrap` field entirely?**
> `bornOfScrap` was *only* read by that gate. `game.stats.hunterCoalesced` (which drives the repurposed
> "Waste Not" achievement) is incremented at the coalescence transform site and does **not** read the flag,
> so Waste Not survives untouched. **Recommendation: delete the field and its propagation** (it's dead
> weight, and a dead flag is a trap). It has test coverage in `test-v31-coalesce.js` — those assertions must
> be **rewritten to assert the opposite** (a scrap-born lineage now emits the full 66), not deleted.
> **Needs sign-off** (deleting a field with live tests).

### 9c — Scoop a clump directly

> **FLAG A-5 — this REVERSES v3.2 P1's load-bearing "a clump is un-hookable" rule**, and it *weakens* v3.2
> P2 (shatter exists solely to reopen clumps). Shatter is not made pointless — see below — but it is
> demoted from "the only way in" to "the lossless way in".

**Spec.** In the pickup pass, a clump (`pieces > 1`) entering the capture region (circle OR scoop box) with
**any** chain room is scooped:
```
room  = game.cargoMax - game.chain.length          // > 0 required
take  = min(room, g.pieces)
pMass = g.mass / g.pieces
push `take` chain nodes at (g.x, g.y), each mass = pMass   // spin/spinRate carried as today
if (take === g.pieces) g.dead = true;
else {
  g.pieces -= take;  g.mass -= take * pMass;
  g.radius  = 7 * Math.sqrt(g.pieces);             // re-derive
  g.coalesceDelay = GARBAGE_COALESCE_DELAY;        // re-arm
  // "the rest floats off and away": outward kick directly away from the ship
  g.vx += cos(a) * SCOOP_SPILL_KICK; g.vy += sin(a) * SCOOP_SPILL_KICK;   // a = angleTo(ship, g)
  // regenerate the cached hull (fewer pieces = smaller silhouette)
}
```
- `SCOOP_SPILL_KICK ≈ 60–110` px/s (playtest knob).
- Partial scoop can only happen when the chain fills, so the leftover can't be immediately re-scooped
  (no room) — **no extra cooldown needed.** Don't add one.
- The chain-full case is the *cost*: greedily scooping a 10-piece clump with 3 slots left throws 7 pieces
  away. **That is what keeps shatter alive** — shatter is lossless (all `pieces` become hookable singles you
  can come back for), scooping is lossy but instant. Greed vs. tidiness, same fulcrum as v3.2. Say this in
  the GDD.

> **FORK-6 — does clump-scooping require `scoopLevel ≥ 1`?**
> **Recommendation: no — unconditional.** The brief says "allow our ship to collect larger garbage clumps",
> not "allow the scoop to". The scoop just makes it *easy* (a 54 px mouth catches a big clump without
> threading a 18 px circle onto it). Gating it behind the scoop would make clumps unreachable for a player
> who's taken hits — a punishing spiral. **Needs sign-off.**

> **FLAG A-5b — the Magnet still ignores clumps** (`pieces === 1` gate in the magnet pull). Keep that:
> a mass-weighted heavy clump yanked into the ship at speed is a different (bad) feel, and the scoop is now
> the clump tool. One-line decision, flagged not forked.

---

## 10. Playtest asks for this round

1. Scoop widths/depths — is level 5 *visibly* 3× the ship? Is level 1 worth picking up?
2. `SCOOP_HITS_PER_LEVEL = 2` — does losing a level every 2 hits feel fair or punishing?
3. `GARBAGE_DECAY` (~22) vs `GARBAGE_COALESCE_DELAY` (~3) vs `GARBAGE_MAGNET_RANGE` (~180) — the whole
   coalescence economy is re-tuned by 9a; expect one round of feel-tuning.
4. Do clumps still form *at all* once garbage decays? (If not, cut the delay or raise the decay.)
5. Post-9b: does the field silt up, or does decay hold it? Watch late waves.
6. Does the reddening clump hull read as "shoot me" — or now as "scoop me"? (Both are correct.)
7. Satellite art legibility at the small tier (r=13).
8. Does the lull actually go away, or do we still need the `nextWave` count/spawn-ring lever (§9 preamble)?