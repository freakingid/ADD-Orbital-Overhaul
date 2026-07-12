# IMPLEMENTATION PHASES — v3.3 (Changeset 4)

Four phases, dependency-ordered, one Claude Code session each. Companion spec:
`PLANNED-FEATURES-v3.3.md` (§ references below point into it).

| Phase | Scope | Changeset items | Depends on | Risk |
|---|---|---|---|---|
| **P1** | Presentation pass: rename, opaque dialogs, clump silhouette, LEVEL HUD | 1, 3, 4, 7 | — | Low (render/strings only) |
| **P2** | Real satellite line art for Debris | 2, 5 | — (independent of P1) | Low-med (art authoring) |
| **P3** | Scoop powerup + powerup drop economy | 8, 6 | P1 (HUD layout) | **High** (new persistent system) |
| **P4** | Pacing: garbage decay, Hunters always drop, clumps scoopable | 9a, 9b, 9c | P3 (capture region) | **High** (reverses 3 shipped rules) |

Ship P1 and P2 in either order. **P4 must not ship before P3** (9c reuses the scoop capture test) and
**9a must not ship without 9b's context** (see A-4 — 9b without decay diverges).

Open forks needing sign-off before P2 (FORK-1), P3 (FORK-2, FORK-3), P4 (FORK-4, FORK-5, FORK-6).
Every recommendation is stated in the spec; if you don't object, Claude Code should take the
recommendation and note it in STATUS.

---

## Phase 1 — Presentation pass

**Model/effort: Sonnet 5, medium.** Mechanical, four independent edits, no sim logic.

<details><summary>Paste-ready prompt</summary>

```
Read CLAUDE.md, STATUS.md, the GDD, and PLANNED-FEATURES-v3.3.md before touching code.
Implement v3.3 Phase 1 — the presentation pass (Changeset-4 items 1, 3, 4, 7). Render and
strings only; do NOT touch update(), collision, or any sim constant.

1. RENAME (spec §1). "Asteroid Field Deluxe" -> "Orbital Overhaul".
   - <title> tag; the header banner comment's first line (keep the version log body).
   - Title screen: "ASTEROID FIELD" / "D E L U X E" -> "ORBITAL" / "O V E R H A U L",
     same sizes/colors/positions.
   - Rename asteroid-field-deluxe-GDD.md -> orbital-overhaul-GDD.md; update its H1, STATUS.md's
     H1, and every reference to the old filename (CLAUDE.md, GDD §5.1, STATUS).
   - DO NOT rename the localStorage keys afd_settings_v1 / afd_achievements_v2. Add an in-code
     comment at each saying the afd_ prefix is frozen because renaming it wipes player saves.

2. DIALOG OPACITY (spec §3). menuPanel() currently strokes the panel rect and never fills it, so
   the world shows through and the text is unreadable. Fill it first:
   ctx.fillStyle = "rgba(2,6,14,0.95)"; ctx.fillRect(x,y,w,h); then the existing glowStroke.
   Also raise drawMenu()'s backdrop from rgba(4,10,20,0.74) to ~0.88. Both alphas are look-calls —
   comment them as such. All five menu screens route through menuPanel, so verify root / options /
   difficulty / controls / achievements all benefit from the one edit.

3. CLUMP SILHOUETTE (spec §4). In Garbage.draw(), pieces > 1 takes a completely different branch
   from pieces === 1 (which stays byte-identical):
   - ONE closed hull polygon — no inner lines, no mini-canisters. 7-9 vertices, radius jittered
     around the existing derived radius (7*sqrt(pieces)). Generate the hull ONCE and cache it on
     the object (in the constructor and at every merge, where radius is already recomputed) — do
     NOT re-randomize per frame. Rotate by this.spin so it still tumbles.
   - Danger tint: lerp the hull color from COLOR.garbage (#c8ff50) toward a new
     COLOR.clumpHot (#ff5a2a) as pieces / HUNTER_COALESCE_COUNT -> 1. The clump reddens as it
     nears the Hunter transform. Keep the radioactive alpha flicker and glowStroke.
   - shatterClump and coalesceGarbage keep working unchanged; only draw() + the cached hull field
     are new.

4. LEVEL HUD (spec §7). The HUD already draws "WAVE n" top-right at 22px in COLOR.dim — it's just
   invisible. Move it to the left column as "LEVEL n" at 22px in COLOR.text, directly under the
   HULL bar; shift CARGO / TARGETS / the powerup row start (prow) down to make room. Remove the
   top-right WAVE readout. DO NOT rename game.wave or nextWave() — this is a display label only.
   Note in the GDD (§2.7) that the player-facing word is "level" and the code term is "wave".

Headless-test what's testable (menuPanel fills before stroking; Garbage.draw() is crash-free at
pieces = 1, 2, and 11; the cached hull is stable across frames and regenerates on merge). Run the
full regression suite. Update STATUS.md and the GDD in place (§2.5.1 clump render, §2.7 HUD, §2.16
menus, the version line, and a §7 Version History v3.3 P1 entry). Do not push.
```
</details>

**Commit:** `v3.3 P1: rename to Orbital Overhaul; opaque dialog panels; single-hull danger-tinted clumps; LEVEL in HUD`

---

## Phase 2 — Real satellite line art

**Model/effort: Opus 4.8, medium.** Mechanically simple but it's an *aesthetic* task — silhouette
legibility at r=13 is a judgment call, not a spec.

**Blocking fork: FORK-1** (does the Hunter get satellite art too? recommendation: **no** — the diamond
is the threat tell).

<details><summary>Paste-ready prompt</summary>

```
Read CLAUDE.md, STATUS.md, the GDD, and PLANNED-FEATURES-v3.3.md §2 and §5 before touching code.
Implement v3.3 Phase 2 — real satellite drawings for DebrisSatellite (Changeset-4 items 2 and 5).
Scope is DebrisSatellite ONLY. Do NOT restyle the Hunter Satellite — its diamond is the threat tell
(FORK-1, resolved: no).

1. New module-level SAT_ART table: 5-6 ORIGINAL stylized line-art satellite silhouettes. Each is an
   array of polylines in UNIT SPACE (normalized to fit a radius-1 circle), each polyline tagged
   closed/open, drawn via the existing drawPoly at this.radius scale. No fills, no new render
   primitive, no external assets — these are authored in code (the file is a single self-contained
   GPL-3.0 HTML with zero dependencies; do NOT trace or import NASA/Wikimedia/CC art).
   Archetypes: comms bus + twin solar panels; dish relay; boxy Earth-observer with a boom; a
   Sputnik-ish sphere with radial whip antennas; a cylindrical spent booster; optionally a truss
   segment. Every one is WRECKED — a bent/snapped panel, a hanging antenna. This is a debris field.

2. DebrisSatellite gains this.art = SAT_ART[floor(rand(0, SAT_ART.length))], picked per instance
   (splits re-roll independently). draw() iterates this.art and replaces the procedural
   this.hull / this.shards entirely. Small per-instance variation (a random bend/jitter) is applied
   ONCE in the constructor, never per frame.

3. PRESERVE the existing random spawn rotation — this.angle = rand(0, TAU) and
   this.spin = rand(-1.2, 1.2) must survive the draw-path rewrite (Changeset item 5 is already
   satisfied by these; the risk is losing them by anchoring art to a fixed "up"). Assert it.

4. Small-tier legibility: at radius 13 a 14-segment satellite is mush. Gate detail on size — the
   small tier gets a simplified 2-4 stroke variant (body + one panel). Tune this by eye; it's a
   look-call, not a spec.

5. this.radius / DEBRIS_RADII are unchanged — art is cosmetic, collision stays a circle (GDD §3.1).
   The title screen's decorative titleDebris uses DebrisSatellite and gets this for free.

Headless-test: every SAT_ART entry is well-formed (arrays of [x,y] pairs, all coords within the
unit circle); a freshly-constructed DebrisSatellite of each size has a non-empty art, a random
angle, and a random spin; draw() is crash-free at all three sizes. Run the full regression suite.
Update STATUS.md and the GDD in place (§2.4 Debris Satellites — the silhouette description, the new
SAT_ART table in the Architecture Map's Constants row, the version line, a §7 v3.3 P2 entry). Do
not push.
```
</details>

**Commit:** `v3.3 P2: replace procedural debris hulls with authored satellite line art (SAT_ART)`

---

## Phase 3 — Scoop powerup + drop economy

**Model/effort: Opus 4.8, high.** New persistent ship system, new geometry, HUD, damage coupling.
The single largest phase of the round — keep it alone in its session.

**Blocking forks: FORK-2** (oriented box vs circle — recommendation: **box**), **FORK-3**
(`scoopHits` reset on level gain — recommendation: **no**).

<details><summary>Paste-ready prompt</summary>

```
Read CLAUDE.md, STATUS.md, the GDD, and PLANNED-FEATURES-v3.3.md §6 and §8 before touching code.
Implement v3.3 Phase 3 — the Scoop powerup and the powerup drop economy (Changeset-4 items 8 and 6).

PART A — drop economy (§6):
- POWERUP_DROP_CHANCE 0.10 -> ~0.16 and POWERUP_DECAY 14 -> ~26 s. Both are playtest knobs;
  comment them as such and do not agonize over the exact values.
- Replace the flat POWERUP_DROP_TYPES roll in maybeDropPowerup with a WEIGHTED table
  (POWERUP_DROP_WEIGHTS), favoring the shot powerups: rapid 3, triple 3, scoop 2, magnet 1,
  engine 1 (starting point, tunable).
- CRITICAL: POWERUP_DROP_TYPES is iterated by the HUD's active-effect row and is the list of TIMED
  effects that powerActive()/powerMode()/powerBudget understand. DO NOT add "scoop" to it. The
  weighted drop table is a separate structure.

PART B — the Scoop (§8). A PERSISTENT, non-timed ship upgrade — the first of its kind here.
- State: game.scoopLevel (0..SCOOP_MAX_LEVEL = 5) and game.scoopHits, both reset in startGame().
  NOT in game.powerFx, NOT in game.powerBudget.
- New droppable type "scoop": its own drawPowerupGlyph case (a widening funnel/V), its own
  POWERUP_COLOR entry. applyPowerup("scoop") raises scoopLevel by 1 (capped at 5); at max, award a
  small score bonus instead (mirroring the full-HP Health-milestone pattern). Push a "SCOOP +1" float.
- Geometry — an oriented capture BOX (the "mouth"), centered on the ship's facing axis (FORK-2,
  resolved: box, not a circle):
    SCOOP_WIDTH = [0, 22, 30, 38, 46, 54]   // px, index = level; 54 = 3x the drawn ship's 18px width
    SCOOP_DEPTH = [0, 20, 24, 28, 32, 36]   // px forward of the nose (playtest knob)
  Capture test lives in the existing garbage pickup pass: take the wrap-aware ship->garbage delta
  (shortDelta), rotate it into ship-local space by -ship.angle, and capture if
  |lateral| <= SCOOP_WIDTH[lvl]/2 AND -SHIP_RADIUS <= forward <= SCOOP_DEPTH[lvl].
  The base GARBAGE_PICKUP circle ALWAYS still applies, OR'd with the box — so scoopLevel === 0 is
  byte-identical to today's behavior, and MAGNET_PICKUP_MULT keeps multiplying the CIRCLE only (no
  double-counting).
- Damage decay: in damageShip(), on any non-lethal hit (after the existing HP/knockback work),
  game.scoopHits++; when scoopHits >= SCOOP_HITS_PER_LEVEL (2), drop one level
  (scoopLevel = max(0, scoopLevel - 1)), reset scoopHits to 0, push a "SCOOP -1" float and a
  distinct AudioSys cue. scoopHits does NOT reset on a scoop pickup (FORK-3, resolved: no). There is
  NO time decay — the scoop only goes away by taking hits.
- Render: in Ship.draw(), before the hull, draw two prongs from the nose flaring to +/- width/2 at
  the mouth depth (open polylines via drawPoly, COLOR.dock green so it reads as a collector). At
  level 5 the mouth must LOOK 3x the ship's width; if it doesn't, the constants are wrong.
- HUD: a SCOOP pip row (e.g. filled/empty dots, 5 pips) under the powerup rows, hidden at level 0.
  It is NOT a timed bar — do not route it through the POWERUP_DROP_TYPES loop.

Known, accepted: applyPowerup increments game.stats.powerupsPicked, so picking a scoop freezes the
maxWaveNoPowerup achievement counter. That's correct (it IS a powerup) — note it in STATUS.

Headless-test through the REAL update()/damageShip()/applyPowerup (no reimplementation): scoop level
climbs 0->5 and caps; the box captures a canister that is outside GARBAGE_PICKUP but inside the
mouth, at several ship headings AND across the world wrap seam; a canister behind the ship or
laterally outside the mouth is NOT captured; at scoopLevel 0 the pickup set is identical to the
pre-change build; two non-lethal hits drop exactly one level, four drop two, and hits at level 0 are
harmless; a shielded/i-frame hit (damageShip's early return) does NOT count toward scoopHits.
Run the full regression suite. Update STATUS.md + the GDD in place (§2.14 Powerups — the new
persistent-upgrade category, §2.10 collection radius, §2.12 damage, Architecture Map Constants /
game-object / draw() rows, version line, §7 v3.3 P3 entry). Do not push.
```
</details>

**Commit:** `v3.3 P3: Scoop powerup (5 persistent levels, damage-decayed) + weighted powerup drops`

---

## Phase 4 — Pacing: decay, Hunter garbage, clump scooping

**Model/effort: Opus 4.8, high.** Reverses three shipped rules and re-tunes the coalescence economy.
Highest blast radius of the round; the test suite will need real rewriting, not just extending.

**Blocking forks: FORK-4** (do clumps decay? rec: **no**), **FORK-5** (delete `bornOfScrap`? rec:
**yes**), **FORK-6** (does clump-scooping need `scoopLevel ≥ 1`? rec: **no, unconditional**).

<details><summary>Paste-ready prompt</summary>

```
Read CLAUDE.md, STATUS.md, the GDD (esp. §2.5.1 and §2.10.1), and PLANNED-FEATURES-v3.3.md §9 before
touching code. Implement v3.3 Phase 4 — the pacing pass (Changeset-4 items 9a, 9b, 9c). This phase
DELIBERATELY REVERSES three rules shipped in v3.2. Paul has signed off on all three. When you rewrite
the GDD, rewrite the load-bearing rationale bullets IN PLACE with the new reason — do not merely
contradict them, or a future session will restore the old rules.

9a — SMALL GARBAGE DECAYS AGAIN (reverses v3.2 P3; GDD §2.10.1 currently says "don't restore decay"):
- Reintroduce GARBAGE_DECAY on Garbage. It applies to SINGLES ONLY (pieces === 1). Countdown in
  Garbage.update(); dead = true at 0; restore a fade/blink-out branch in draw() for the last ~2 s.
- Clumps (pieces > 1) do NOT decay (FORK-4, resolved: no) — a clump is a target AND now a pickup.
- Chain nodes never decay. Severed garbage (Garbage.fromNode) inherits the same GARBAGE_DECAY — do
  NOT resurrect the deleted GARBAGE_SEVER_DECAY. One constant.
- RETUNE, and comment all three as playtest knobs: GARBAGE_DECAY ~= 22 s;
  GARBAGE_COALESCE_DELAY 6.0 -> ~3.0 (6.0 was tuned FOR permanent garbage — a third of a 22 s life
  spent inert means nothing ever clumps); GARBAGE_MAGNET_RANGE 260 -> ~180 (also raised only because
  garbage was permanent). Do not over-specify — these are feel numbers.

9b — HUNTERS ALWAYS DROP GARBAGE (reverses v3.2 P3's FORK-B/B1):
- Delete the `const emitGarbage = !h.bornOfScrap;` gate in destroyHunter. Every Hunter of every
  origin emits at its existing tier counts (3 / 3 / 6-at-low-mass).
- Delete the HunterSatellite.bornOfScrap field and its propagation to split children (FORK-5,
  resolved: yes — it was read by nothing else). game.stats.hunterCoalesced is incremented at the
  coalescence transform site and does NOT read the flag, so the "Waste Not" achievement is untouched
  — verify that.
- The existing test-v31-coalesce.js assertions that a bornOfScrap lineage emits ZERO garbage must be
  REWRITTEN to assert the opposite (a scrap-born lineage now emits the full 66, same as a
  timer-spawned one), not deleted. Same for the bornOfScrap-propagation assertions.
- This reopens the 12-in / 66-out amplifier that B1 closed. That is intentional: 9a's decay is now
  the governor. Say so in the GDD.

9c — CLUMPS ARE SCOOPABLE (reverses v3.2 P1's "a clump is un-hookable"):
- In the pickup pass, a clump entering the capture region (the base GARBAGE_PICKUP circle OR the
  Phase-3 scoop box — UNCONDITIONAL, no scoopLevel requirement; FORK-6, resolved: no gate) with any
  chain room is scooped:
      room  = game.cargoMax - game.chain.length            // must be > 0
      take  = min(room, g.pieces)
      pMass = g.mass / g.pieces
      push `take` chain nodes at (g.x, g.y), each mass = pMass (carry spin/spinRate as today)
      if (take === g.pieces) g.dead = true
      else: g.pieces -= take; g.mass -= take * pMass; g.radius = 7*sqrt(g.pieces);
            g.coalesceDelay = GARBAGE_COALESCE_DELAY (re-arm); regenerate the cached P1 hull;
            kick it directly away from the ship by SCOOP_SPILL_KICK (~60-110 px/s, playtest knob)
            -- "the rest of the ball floats off and away".
- A partial scoop can only happen when the chain fills, so the leftover cannot be immediately
  re-scooped (no room). Do NOT add a re-pickup cooldown.
- The Magnet still ignores clumps (keep the pieces === 1 gate in the magnet pull) — the scoop is the
  clump tool now.
- Shatter (v3.2 P2) SURVIVES and keeps its purpose: shatter is LOSSLESS (all pieces become hookable
  singles you can come back for), scooping is LOSSY but instant (greedily scooping a 10-piece clump
  with 3 slots left throws 7 away). Greed vs tidiness, same fulcrum as v3.2. Put that in the GDD.

Headless-test through the REAL update()/coalesceGarbage/destroyHunter/pickup pass (no
reimplementation): a single dies at GARBAGE_DECAY and a clump does not; a chain node never decays;
GARBAGE_DECAY > GARBAGE_COALESCE_DELAY by a wide margin (assert the relationship, not just the
values); coalescence still forms clumps and still transforms at 12 under the new delay; a
scrap-born lineage now emits 66; bornOfScrap is gone from the source; Waste Not still keys on
hunterCoalesced and still fires; scooping a 5-piece clump with 5+ slots free yields exactly 5 chain
nodes at mass = clumpMass/5 and kills the clump; scooping a 10-piece clump with 3 slots free yields
3 nodes, leaves a live 7-piece clump with re-derived radius/mass, a re-armed delay, and an outward
velocity away from the ship; scooping works at scoopLevel 0 (via the base circle) and through the
scoop box; total mass is conserved in the full-scoop case. Run the FULL regression suite — expect
real breakage in test-v31-coalesce.js and test-f3.js and fix it by rewriting assertions to the new
contract. Update STATUS.md and the GDD in place: §2.10.1 (the "decay exists to protect readability"
bullet — REWRITE it: decay is back, and here is why the v3.2 removal was superseded), §2.5.1
(clumps are scoopable; bornOfScrap is gone; shatter = lossless vs scoop = lossy), §2.10 (collection),
§2.5 (Hunter garbage emission), the Architecture Map rows, the version line, and a §7 v3.3 P4 entry.
Do not push.
```
</details>

**Commit:** `v3.3 P4: small garbage decays again; Hunters always drop garbage; clumps are scoopable (lossy)`

---

## After the round

- Archive both docs with version suffixes: `archive/PLANNED-FEATURES-v3.3.md`,
  `archive/IMPLEMENTATION-PHASES-v3.3.md`. While in there, rename the legacy bare
  `archive/IMPLEMENTATION-PHASES.md` (the v2.0 one) to `archive/IMPLEMENTATION-PHASES-v2.md`.
- Open lever, not scoped: `nextWave()`'s `count = min(3 + wave, 9)` and `SPAWN_MAX_DIST` are the
  direct fix for the late-wave lull if 9a–9c don't fully land it (spec §9 preamble).
- Still unresolved from earlier rounds: splitting the single HTML file into modules. No action.