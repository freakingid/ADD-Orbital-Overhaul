# Asteroid Field Deluxe — IMPLEMENTATION PHASES (v3.1)

> Specs: `PLANNED-FEATURES-v3.1.md`. **GDD §2 is shipped truth** — each phase must sync it.
> One phase per Claude Code session; commit per phase; you control pushing.
> All decisions are locked, so all three phases are unblocked.

## Dependency order & rationale

**Housekeeping → P1 (world) → P2 (wrap fix) → P3 (coalescence).**

- World size (P1) reshapes the density and edge-crossing frequency the other changes tune against,
  so it lands first.
- The wrap fix (P2) confirms the world is still a correct torus, which coalescence's wrap-aware
  math depends on — so it lands before the coalescence system.
- Coalescence (P3) is the largest new piece and sits on top of a correct, correctly-sized world.

---

## Housekeeping (do first — ~10 min, no code)

- Move `PLANNED-FEATURES-v3.md` and the old `IMPLEMENTATION-PHASES.md` into `archive/`.
- Place `PLANNED-FEATURES-v3.1.md` and this file at repo root.
- (Confirmed with Paul: there was no Phase 9 — nothing unshipped gets buried.)

---

## Phase 1 — Shrink the world to 2560×1440 + clamp spawn rings

**Model / effort:** Claude Sonnet 5, **medium** effort, extended thinking **on** (spawn-clamp reasoning).

**Paste-ready prompt:**

> Read GDD §2.11 and the "Larger world & scrolling camera (v1.2)" constants block first; §2 is
> shipped truth. This phase resizes the toroidal world and retunes only the constants that depend
> on it.
>
> 1. Change `WORLD_W`/`WORLD_H` from `3840`/`2160` to **`2560`/`1440`**.
> 2. In the same block, clamp the ship-relative spawn rings so nothing can wrap past halfway and
>    land on the ship: the binding limit is `min(WORLD_W, WORLD_H)/2 − 60 = 660`. Set
>    **`SPAWN_MAX_DIST` 1100 → 640** and **`DOCK_MAX_DIST` 900 → 620** (mins unchanged:
>    `SPAWN_MIN_DIST` 220, `DOCK_MIN_DIST` 260 — rings `[220,640]` / `[260,620]` stay valid,
>    and DOCK_MAX < SPAWN_MAX is preserved).
> 3. **Do NOT change `STAR_DENSITY` or `STAR_NEAR_DENSITY`.** `STAR_COUNT` (~line 2913) already
>    derives from world area (`STAR_DENSITY * WORLD_W*WORLD_H / (VIEW_W*VIEW_H)`), so the far-layer
>    count auto-scales to ~44% and visual density is preserved; the near layer is screen-space.
>    The starfield needs no edits.
> 4. **Do NOT touch** wrap/camera/render logic — it's correct against `WORLD_W/WORLD_H`. (The
>    separate `+120` wrap bug is Phase 2, not this phase.)
>
> Add a headless check `scratchpad/test-v31-world.js` (established harness pattern — stub
> `window`/`document`/`requestAnimationFrame`, drive the REAL spawn path): over many samples on the
> new world, assert new-debris and dock placements land within `[MIN, clamped-MAX]` of the ship and
> never inside `SPAWN_MIN_DIST`/`DOCK_MIN_DIST`; assert `STAR_COUNT` is the area-derived value for
> 2560×1440. Update GDD §2.11 (new dimensions, the clamp rationale, and that STAR density is
> preserved automatically) and the Architecture-Map constants row. Run `node --check` on the
> extracted script. Commit; I'll push.

**Commit message:**
`feat(world): shrink toroidal world to 2560x1440; clamp spawn/dock rings (v3.1 P1)`

---

## Phase 2 — Fix the wrap (+120 seam discontinuity)

**Model / effort:** Claude Sonnet 5, **medium** effort.

**Paste-ready prompt:**

> Read GDD §2.11; §2 is shipped truth. Bug: `wrap()` (~line 1010) and the chain node-wrap inside
> `updateChain` (~line 2272) teleport by `WORLD_W + 120` / `WORLD_H + 120`, but all distance/aim/
> render helpers (`dist2`, `angleTo`, `shortDelta`, `wrapOffset`, `wrapPos`) use period
> `WORLD_W`/`WORLD_H`. This 120 px mismatch shifts every entity ~120 px relative to the ship at each
> seam crossing.
>
> Fix: change both wrap jumps to **exactly `WORLD_W` / `WORLD_H`**. Keep the ±60 trigger margins —
> they are the anti-flicker hysteresis, and a jump of exactly `WORLD_W` from `x = −61` lands at
> `WORLD_W − 61`, safely inside the `[−60, WORLD_W+60]` band (no re-trigger). Verify the chain
> node-wrap still shifts `px/py` by the same delta as `x/y` (implied velocity must survive the
> teleport — §3 rule).
>
> Add a headless check `scratchpad/test-v31-wrap.js`: place two entities straddling a seam; assert
> `shortDelta` between them is continuous before and after one crosses (no ~120 px discontinuity),
> and that a wrapped entity lands in `[0, WORLD_W)` (resp. `WORLD_H`). Note in GDD §2.11 that the
> wrap jump is now exactly `WORLD_*` (the undocumented `+120` removed). Run `node --check`.
> Commit; I'll push.

**Commit message:**
`fix(wrap): jump by exactly WORLD_W/H (drop the +120 seam discontinuity) (v3.1 P2)`

---

## Phase 3 — Garbage magnetism + coalescence → Hunter formation

**Model / effort:** Claude Opus 4.8, **high** effort, extended thinking **on** (new pairwise system +
Hunter-spawn integration + audio + tuning). The meaty phase.

**Paste-ready prompt:**

> Read GDD §2.4–2.5 (garbage/Hunters), §2.7 (TARGETS/wave-clear), §2.8 (audio) first; §2 is shipped
> truth. Add a garbage coalescence system.
>
> **Constants** (salvage/chain block, near `GARBAGE_DECAY` ~line 159), all tunable:
> `GARBAGE_COALESCE_DELAY = 1.0`, `GARBAGE_MAGNET_RANGE = 140`, `GARBAGE_MAGNET_PULL = 40`,
> `GARBAGE_MERGE_DIST = 12`, `HUNTER_COALESCE_COUNT = 12`, `GARBAGE_CLUMP_MAXSPD = Infinity`
> (off-by-default playtest clamp).
>
> **Garbage class:** add constructor defaults `coalesceDelay = GARBAGE_COALESCE_DELAY` and
> `pieces = 1` (so all three emission sites AND `Garbage.fromNode` inherit them). In `update()`,
> decrement `coalesceDelay` by `dt`. A piece is "active" once `coalesceDelay <= 0`.
>
> **New `coalesceGarbage(dt)`**, called once per frame in `update()` immediately after the garbage
> pickup/magnet loop and before `updateChain(dt)`. O(n²) over active pieces, skipping any already
> marked dead this pass; all math wrap-aware (`shortDelta`/`dist2`):
> - *Attraction:* for each active pair within `GARBAGE_MAGNET_RANGE`, accelerate each toward the
>   other at `GARBAGE_MAGNET_PULL` (symmetric: `a` gains `+(unit toward b)*PULL*dt`, `b` the
>   negative). Optionally clamp each piece's speed to `GARBAGE_CLUMP_MAXSPD`. Both attraction AND
>   merging require BOTH pieces active (a fresh burst disperses for 1 s first).
> - *Merge* (`dist2 < GARBAGE_MERGE_DIST²`, both active): survivor velocity becomes the literal
>   vector sum (`survivor.vx += other.vx; survivor.vy += other.vy`), `survivor.pieces += other.pieces`,
>   `other.dead = true`. **Keep survivor `mass` at its base — do NOT sum mass** (FORK-2: a clump tows
>   as one normal canister).
> - *Transform:* if `survivor.pieces >= HUNTER_COALESCE_COUNT`, set `survivor.dead = true`,
>   `game.hunters.push(new HunterSatellite(survivor.x, survivor.y, 3))`, call `AudioSys.hunterborn()`.
>   Coalesced Hunters are independent of `game.hunterTimer` — multiple concurrent lineages are
>   allowed (FORK-1). Rely on the existing dead-filter (~line 2659) for compaction; add no new filter.
>
> **Do NOT increment `game.stats.garbageDecayed` on a merge** — coalescing is a distinct fate from
> decaying and must not trip Waste Not.
>
> **Pickup (FORK-2):** clumps stay pickable as one normal mass-1.0 node — the existing pickup gate
> already pushes one node per hooked piece, so no change is needed; just confirm a `pieces>1` clump
> hooks as one node and delivers as one canister.
>
> **Audio:** add `AudioSys.hunterborn()` — a distinct, ominous cue (e.g., a low descending two-tone
> with slight dissonance, ~0.4 s, darker/longer than `explosion`), connected to `this.sfx`, guarded
> by `if (!this.ctx) return`.
>
> **Test** `scratchpad/test-v31-coalesce.js` (drive the REAL `coalesceGarbage`/`update`/
> `destroyDebris`): (1) a piece can't merge before 1 s, can after; (2) two active pieces in contact
> merge — survivor velocity == exact vector sum, `pieces == 2`; (3) twelve pieces coalesce to exactly
> one new Hunter (`game.hunters.length` +1, clump gone, `hunterborn` stub called once); (4) a merge
> across the world seam works (wrap-aware); (5) merging does NOT bump `garbageDecayed`; (6) a
> `pieces>1` clump hooks as a single mass-1.0 node.
>
> Update GDD: §2.5 (coalescence subsection — 1 s delay, mutual magnetism, literal vector-sum merge,
> 12→Hunter, multi-lineage note replacing the "one lineage at a time" absolute), §2.8 (`hunterborn`),
> §2.7 (coalesced Hunters count toward TARGETS/wave-clear), and the Architecture-Map constants +
> game-object rows. Run `node --check`. Commit; I'll push.

**Commit message:**
`feat(garbage): mutual magnetism + coalescence, 12 pieces form a Hunter w/ warning cue (v3.1 P3)`

---

## After the round

- Verify in a real browser: shrunken world feel; clean seam crossings; a clump forming into a Hunter
  (on- and off-screen, listen for `hunterborn`); Magnet-as-anti-coalescence; playtest whether
  `GARBAGE_CLUMP_MAXSPD` needs a finite clamp.
- Roll the STATUS "After Phase 8" notes into a v3.1 section as each phase lands.
- When v3.1 ships and its specs are in GDD §2, archive this doc pair.