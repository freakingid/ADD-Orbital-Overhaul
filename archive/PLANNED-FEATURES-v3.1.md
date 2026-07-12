# Asteroid Field Deluxe — PLANNED FEATURES (v3.1)

> Provisional label **v3.1** (feature increment on shipped v3.0). Final version number
> to be set at release. Basis: v3.0 Phases 1–8 shipped; **GDD §2 is shipped truth** — every
> spec below was grepped against the current build (`asteroids-deluxe.html`, 3142 lines) before
> writing. Implementation plan + paste-ready Claude Code prompts live in `IMPLEMENTATION-PHASES.md`.

## Round summary

Three gameplay changes + one already-resolved test flake:

1. **Garbage coalescence** — uncollected garbage clumps up and, at 12 pieces, becomes a Hunter.
2. **Smaller world** — 3840×2160 → **2560×1440** (too much dead space).
3. **Edge behavior** — the toroidal wrap has a real bug; **fix the wrap**.
4. **test-f3 chain-physics flake** — **already fixed on `main`; no action.**

## Decisions locked (this cycle)

| Question | Decision |
|---|---|
| New world size | **2560×1440** (2×2 viewports, 4× area ≈ 44% of current) |
| Edge behavior | **Fix the wrap** (stay toroidal, done right) |
| FORK-1 (coalesced Hunters vs. one-lineage-at-a-time) | **Allow multiple concurrent lineages** |
| FORK-2 (partially-formed clump pickup) | **Pickable as one normal mass-1.0 node** |
| Version label | v3.1 provisional; set final number at release |
| v3.0 "Phase 9" | **Did not exist** — Phase 8 then "After Phase 8" notes; safe to archive v3 docs |

---

## Spec A — Garbage magnetism + coalescence → Hunter formation

### Shipped basis (confirmed in build)
- `Garbage` class (line 1486): `{x, y, vx, vy, spin, spinRate, decay, mass, radius:7, dead}`.
  Free canisters in `game.garbage[]`; towed ones move to `game.chain[]`.
- Three emission sites, all with an outward kick: `destroyDebris` (3× mass-1.0),
  `destroyHunter` small-tier (6× mass-0.5), `destroyHunter` large/medium (3× mass-1.0).
  `Garbage.fromNode` re-emits severed chain scrap.
- Free-garbage update + Magnet-powerup pull + pickup all happen in the
  `for (const g of game.garbage)` loop (line 2403); dead pieces compacted at line 2659.
- `new HunterSatellite(x, y, 3)` already builds a large core that drifts toward the ship at spawn.

### New behavior
- **Delay + counter.** Every new `Garbage` gets `coalesceDelay = GARBAGE_COALESCE_DELAY (1.0)`
  and `pieces = 1` as constructor defaults, so all three emission sites *and* `fromNode`
  inherit them. `coalesceDelay` counts down in `update()`. A piece is **active** once
  `coalesceDelay <= 0`.
- **`coalesceGarbage(dt)`** — new pass, once per frame, right after the garbage pickup loop and
  before `updateChain(dt)`. O(n²) over **active** pieces, all math wrap-aware (`shortDelta`/`dist2`):
  - *Mutual magnetism:* each active pair within `GARBAGE_MAGNET_RANGE (140)` accelerates toward the
    other at `GARBAGE_MAGNET_PULL (40 px/s²)`, applied symmetrically. Gentle/local by design.
  - *Merge on contact:* when two active pieces are within `GARBAGE_MERGE_DIST (12)`, merge —
    `survivor.vx += other.vx; survivor.vy += other.vy` (**literal vector sum**, per directive),
    `survivor.pieces += other.pieces`, `other.dead = true`.
  - *Transform:* if `survivor.pieces >= HUNTER_COALESCE_COUNT (12)` → `survivor.dead = true`,
    push `new HunterSatellite(survivor.x, survivor.y, 3)`, play `AudioSys.hunterborn()`.
- **Audio.** New `AudioSys.hunterborn()` — a distinct ominous cue on the `sfx` bus, guarded by
  `if (!this.ctx) return`. Audible regardless of on/off-screen (audio isn't spatial), so the
  "even off-screen" requirement is automatic.

### Both delay-gates matter
The 1 s delay gates **both** attraction and merging. A fresh burst rides its explosion kick apart
for 1 s, *then* begins clumping — this matches "so they do not immediately coalesce" better than
gating merge alone.

### Fork resolutions (locked)
- **FORK-1 = allow multiple lineages.** Coalescence spawns Hunters independent of `game.hunterTimer`
  (which only gates the timed spawn and is suppressed while any Hunter exists). Neglect can therefore
  create additional concurrent lineages — the intended "neglect breeds danger" pressure. Deviates from
  the §2.5 "one lineage at a time" wording, which will be updated. Minor side effect: overlapping
  lineages slightly muddy `hunterLineageKills` (Hunter's Bane) — acceptable.
- **FORK-2 = clump pickable as one mass-1.0 node.** `pieces` is purely the threat trigger, decoupled
  from tow weight; a clump hooks/delivers as one normal canister. Preserves player agency (grab the
  clump to defuse the Hunter) with **zero** risk to the P6-tuned chain physics.

### Best-guess details (baked in)
- Small-Hunter 0.5-mass scrap counts as **1 piece** each toward 12 (count is canister-based).
- Literal vector-sum means a growing clump accelerates; same-burst pieces mostly cancel (they fan
  out), so it's usually moderate. Ships with an off-by-default `GARBAGE_CLUMP_MAXSPD = Infinity`
  clamp as a playtest knob.
- **Coalescing is a distinct fate** — a merge sets `dead` WITHOUT touching
  `game.stats.garbageDecayed`, so it must not trip **Waste Not**. (Adjacent to the open Waste-Not
  edge-case deliberation — see Deferred.)

### §2 consistency
- **§2.7 (TARGETS / wave-clear):** a coalesced Hunter lands in `game.hunters`, so `TARGETS n` rises
  and wave-clear is blocked until it's killed. This is exactly the documented "count can rise
  mid-wave" behavior (FLAG B-7-b) — no conflict, just a new trigger for it.
- **Not the Magnet powerup:** ship↔garbage attraction (`MAGNET_*`) is a separate, stronger,
  powerup-gated force. The new garbage↔garbage force is always-on and weaker. Kept independent —
  and Magnet becomes the natural anti-coalescence tool (vacuum pieces before they clump).

### New constants (salvage/chain block, near `GARBAGE_DECAY`)
`GARBAGE_COALESCE_DELAY = 1.0`, `GARBAGE_MAGNET_RANGE = 140`, `GARBAGE_MAGNET_PULL = 40`,
`GARBAGE_MERGE_DIST = 12`, `HUNTER_COALESCE_COUNT = 12`, `GARBAGE_CLUMP_MAXSPD = Infinity`. All tunable.

### Perf
O(n²) is a non-issue at realistic counts (a full lineage tops out ~39 free canisters; ~1.5k cheap
checks/frame). The range gate keeps clumping local.

---

## Spec B — World size

- **Original (pre-v1.2):** 1280×720 — world and viewport were the same rectangle (single screen).
- **Current (shipped):** 3840×2160 (9× viewport area).
- **New:** **2560×1440** (2×2 viewports, 4× area ≈ 44% of current) — halves the dead space while
  keeping the camera/parallax investment (v1.2, v3.0-P1) meaningful.

**A one-constant edit would break spawns.** These are tuned to the current world and must move together:
- `SPAWN_MAX_DIST (1100)` and `DOCK_MAX_DIST (900)` are ship-relative spawn rings. On the new world
  the binding limit is `min(WORLD_W, WORLD_H)/2 − 60 = 720 − 60 = 660`; above it, a spawn placed
  straight up/down can wrap past halfway and land on the near side / on the ship.
  **→ `SPAWN_MAX_DIST` → 640, `DOCK_MAX_DIST` → 620** (both under 660; preserves DOCK_MAX < SPAWN_MAX;
  mins unchanged — rings `[220, 640]` / `[260, 620]` stay valid).
- **`STAR_DENSITY` — do NOT change.** `STAR_COUNT` (line 2913) already derives from world area
  (`STAR_DENSITY * WORLD_W*WORLD_H / (VIEW_W*VIEW_H)`), so the count auto-scales to ~44% and visual
  density is preserved. `STAR_NEAR_DENSITY` is screen-space (per-tile), also unaffected. The
  starfield needs no edits.
- `CULL_MARGIN` unchanged.

---

## Spec C — Edge behavior (fix the wrap)

**Current behavior (confirmed):** toroidal wrap. `wrap()` (line 1010) teleports an object once it's
60 px past a world edge; camera = ship position, no clamping; entities render at their nearest
wrapped image (`wrapOffset`); the dashed boundary line is cosmetic.

**The bug.** `wrap()` jumps by `WORLD_W + 120` / `WORLD_H + 120` (and the chain node-wrap at line 2272
does the same), but **every** distance/aim/render helper — `dist2`, `angleTo`, `shortDelta`,
`wrapOffset`, `wrapPos` — uses period `WORLD_W`/`WORLD_H`. That 120 px mismatch shifts every entity
~120 px relative to the ship the instant the ship (camera) crosses a seam — the "wraps, but not
correctly" symptom. It also contradicts GDD §2.11 ("all world/simulation math uses WORLD_W/WORLD_H").

**The fix.** Change both wrap jumps to **exactly `WORLD_W` / `WORLD_H`**. The ±60 trigger margins stay
— they are the anti-flicker hysteresis, and a jump of exactly `WORLD_W` from `x = −61` lands at
`WORLD_W − 61` (safely inside the band, no re-trigger). ~2-line correctness fix; preserves everything
built on the torus. The chain node-wrap must keep `px/py` shifted by the same delta as `x/y` (§3 rule:
implied velocity survives the teleport).

---

## Spec D — test-f3.js chain-physics flake — RESOLVED, no action

Fetched the live `scratchpad/test-f3.js` off `main` and grepped the build:

- Signature is real: `chainMass()` (build line 2268) halves its sum whenever `powerActive("engine")`
  is true (`game.powerFx.engine > 0`, `ENGINE_MASS_MULT = 0.5`).
- **The fix is already present.** `test-f3.js`'s `resetShip` (lines 88–90) zeroes `game.powerFx`
  before every measurement, with a comment naming this exact issue ("Fix owned by the B-8 chain
  phase.") — the P6/B-8 fix STATUS claims.
- **The (D) assertions are unreachable by an Engine drop anyway.** The measurement helpers
  (`measureThrustVx`, `terminalSpeed`, `measureTugVx`) drive `game.ship.update()` / `updateChain()`
  **directly** — never the full `update(dt)` that runs the powerup drop/pickup pass. With no powerup
  system executing and `powerFx` zeroed each `resetShip`, `chainMass()` always sees `engine === 0`.
  The block is deterministic.

The pasted note was the **original flag** that prompted the B-8 fix (it repro'd on P3, which predates
the fix). The fix landed; the note is stale. If a fresh `node scratchpad/test-f3.js` on `main` still
goes red, capture the failing assertion — but per the current tree, this is closed. Optional
belt-and-suspenders (not needed): stub `maybeDropPowerup` to a no-op in the harness header.

---

## Deferred / open (carried, not scoped this round)

- **Waste-Not degenerate edge case** — still open from before. Note the new interaction: a coalesced
  piece is a *third* fate (not delivered, not expired), so it does not count against Waste Not.
- **Off-screen threat awareness** — still parked. A coalesced Hunter can form off-screen; the warning
  sound is the only tell for now. If off-screen indicators land later, "a Hunter just formed off
  your left" is a natural addition.
- **`GARBAGE_CLUMP_MAXSPD` clamp** — ships off (Infinity); enable only if playtest shows runaway
  clump speed.
- **Post-round housekeeping** — archive this doc pair once v3.1 ships and its specs are in GDD §2.