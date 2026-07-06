# Asteroid Field Deluxe — STATUS

Last updated: 2026-07-06 · Build version: **1.4** (v2.0 Phase 3 of 9 shipped) · Last session: implemented **F3 — Debris Satellites** (renamed/redesigned the asteroid hazard: broken-satellite silhouette, 3-way splits at large/medium, guaranteed 3 canisters at every tier incl. the small-tier kill) **+ F5 — variable-mass garbage** (a `mass` field on garbage/chain nodes; chain thrust/top-speed/tug moved from a node *count* to a mass *sum*). Includes a first-pass garbage-volume rebalance.

## Working / verified

**Headless-verified this session (v1.4, `scratchpad/test-f3.js`, 28 assertions):**
- **Full lineage counts** — destroying one large Debris Satellite all the way down produces exactly **13 kills** (1 large / 3 medium / 9 small) and exactly **39 garbage canisters**, all `mass: 1.0`. This is the F3 8× volume target, confirmed against the real `destroyDebris` path.
- **Per-tier behavior in isolation** — large → 3 mediums, medium → 3 smalls, small → destroyed; and *every* tier (including the final small kill) drops exactly `DEBRIS_GARBAGE` (3) canisters.
- **`mass` field (F5)** — `Garbage` defaults to mass 1.0 and carries an explicit mass; `Garbage.fromNode()` carries a node's mass back to free garbage (and defaults to 1.0 for a mass-less legacy node); pickup copies the canister's mass onto the new chain node; a severed mixed-mass chain preserves each node's mass as free garbage and uses the shorter `GARBAGE_SEVER_DECAY`.
- **Mass-sum chain physics** — `chainMass()` = Σ node.mass; the thrust penalty (one isolated `ship.update`), the top-speed penalty (terminal velocity over ~10 s of thrust), and the momentum tug (direct `updateChain` with a known first-link stretch) all match the mass-sum formulas, and an **8× mass-1.0 chain tows identically to a 16× mass-0.5 chain** across all three.

**F2 regression re-run green (`scratchpad/test-f2.js`, 54 assertions)** against the renamed symbols (`DebrisSatellite`/`game.debris`), so the HP/knockback/hit-stun/repair/shield behavior is unaffected by the rename. `node --check` clean.

**Verified headlessly earlier (unchanged this session):** camera-follow + world-boundary wrap + ship-relative spawns (v1.2, `test-f1.js`); HP/damage/knockback (v1.3, `test-f2.js`, re-run above); garbage drop/decay/pickup/tow/wrap/dock-delivery/chain-severing (v1.1). The chain **integration** (verlet nodes, constraints, wrap) is untouched — only the mass-derived scalars changed — so v1.1's tow-integrity tests still hold.

**Not yet verified (needs a real browser — see playtest asks):** the Debris Satellite silhouette's readability, garbage-density/decay *feel* at the new numbers, whether the trimmed wave count still feels substantial, and that tow handling feels identical to v1.3 (it should, since all cargo is mass 1.0).

## Known issues

- None confirmed. New v1.4 watch items are in GDD §6: **garbage density & decay feel** (the first-pass balance numbers, top retune candidate) and **raised performance ceiling** (far more free canisters, though decay bounds coexistence). The v1.3 knockback/chain watch items still stand.

## Balance notes

- **Garbage volume is up ~8× per cleared large lineage** (39 canisters vs the old ~5). This is inherent to F3's guaranteed-3-per-tier design and **cannot** be meaningfully controlled by spawn counts (cutting spawns enough to offset 39-per-lineage would make waves trivial). So density control leans on **decay** + the `CHAIN_MAX` (12) tow ceiling.
- **First-pass rebalance landed (documented baseline — retune from here):**
  - **`GARBAGE_DECAY` 20 → 12 s** — the *primary* density lever. ~40% shorter on-screen lifetime; still leaves a ~7 s solid + 5 s blink collection window (blink < 5 s, fast blink < 2 s).
  - **`GARBAGE_SEVER_DECAY` 10 s (new)** — promoted from an inline `15` in `Garbage.fromNode`; kept below `GARBAGE_DECAY` so severed scrap stays the more ephemeral (original design intent).
  - **Wave spawn `min(4+wave, 11)` → `min(3+wave, 9)`** — the *secondary* trim (−1 large/wave, cap 11→9). Kept modest on purpose: **F10 wants *more* Debris Satellites** to fill the bigger, calmer world, and will do a joint density retune (see below). This is trimmed enough to take the edge off, not gutted.
  - **Why decay-first, spawn-second:** documented in GDD §2.10.1. The player is not expected to collect all 39 — most decay uncollected, which is fine (Pillar 5: optional greed). Decay just bounds how much clutter coexists.
- **Open: joint F3 + F10 tuning pass.** The right long-term density is a playtested middle done once F10 (difficulty ramp + more Debris density) is in. Until then these numbers are the baseline. Tracked in PLANNED-FEATURES F3/F10 and GDD §2.10.1.
- **Tow feel is intentionally unchanged from v1.3.** Because every canister is mass 1.0, `chainMass()` equals the old `chain.length` everywhere, so `CARGO_THRUST`/`CARGO_MAXSPD`/`CARGO_MASS` produce identical numbers. If tow handling *feels* different, that's a bug, not a balance change. (`CHAIN_MAX` 12, `CHAIN_TUG` 26, `CARGO_*` all unchanged.)
- **Carried from v1.3 (unchanged):** Max HP = 250 (`SHIP_MAX_HP`); damage table 20/35/50 contact + 15 bullet, now assigned to Debris tiers via `DEBRIS_DAMAGE` (same values as the old `AST_DAMAGE`); knockback 250 px/s + 1.0 s hit-stun; hull repair every 10,000 pts.

## Next up

**Phase 4 — Difficulty Ramp & Early-Game Pacing (F10).** A shared `difficultyFactor(wave)` helper that scales threat parameters (Hunter speeds/turn — via F4's ceilings, saucer spawn/fire/aim) from gentle floors up to full-intensity ceilings, so early waves are approachable. **This is also the home of the joint F3+F10 garbage-density retune** — Paul explicitly wants more Debris Satellites to fill the calmer world, balanced against F3's canister volume by leaning on `GARBAGE_DECAY`. Build F10 *before/alongside* F4 (Phase 5) so the Hunter redesign wires into the difficulty factor from the start. Use the Phase 4 prompt in `IMPLEMENTATION-PHASES.md`.

Notes for that session:
- The `mass` field and `chainMass()` are now in place; F4's low-mass Hunter scrap (proposed `mass: 0.5`) and the F6 Engine powerup both build directly on them. `Garbage.fromNode` and the pickup path already carry mass through.
- **Chain node shape now includes `mass`** (GDD §3.4) — any *new* code that creates a chain node must set it, or `chainMass()` returns `NaN`. The existing pickup path handles this.
- F3 left the existing hexagon `Satellite`/`Wedge` system and saucers untouched (that's Phase 5 / F10's saucer pacing), so the count→mass-sum conversion starts from a clean, documented baseline.

Attach/have present all four docs. GDD §2 is current truth *including* the new §2.4 (Debris Satellites), the mass-updated §2.10/§3.4, and §2.7's trimmed spawn formula.

## Changed this session

- **`asteroids-deluxe.html` → v1.4.**
  - **Rename (throughout):** `Asteroid` → `DebrisSatellite`; `game.asteroids` → `game.debris`; `destroyAsteroid` → `destroyDebris`; `AST_SPEEDS/RADII/SCORE/DAMAGE` → `DEBRIS_*`; `COLOR.asteroid` → `COLOR.debris`; `titleRocks` → `titleDebris`. Values unchanged (radii/speeds/scores/damage carry over).
  - **Shape:** the class now builds a `hull` (irregular polygon, `n = 6 + size` verts, jitter 0.65–1.05) + `shards` (1–2 antenna stalks each with a tip crossbar, drawn as open polylines). `draw()` strokes hull + shards in `COLOR.debris`.
  - **Splits & garbage (`destroyDebris`):** 3-way split for `size > 1` (was 2-way); a fixed loop emits exactly `DEBRIS_GARBAGE` (3) canisters at *every* tier with an outward kick (was `if (Math.random() < GARBAGE_DROP[size])` single drop). `GARBAGE_DROP` removed; `DEBRIS_GARBAGE` added.
  - **Mass (F5):** `Garbage` constructor takes a `mass` param (default 1.0) and stores `this.mass`; `Garbage.fromNode` carries `n.mass` and uses `GARBAGE_SEVER_DECAY`; the pickup push adds `mass: g.mass` to the chain node. New **`chainMass()`** helper (Σ node.mass) in the chain-physics block. `Ship.update` cargo and `updateChain`'s tug `massFactor` now use `chainMass()` instead of `game.chain.length`.
  - **Balance constants:** `GARBAGE_DECAY` 20 → 12; new `GARBAGE_SEVER_DECAY` 10; `nextWave` count `min(4+wave,11)` → `min(3+wave,9)`. `CARGO_*` comments reworded (per unit mass). Version header + changelog bumped to v1.4.
- **Tests:** `scratchpad/test-f2.js` updated to the renamed symbols (and its manual chain node given `mass: 1`) — still 54/54. New **`scratchpad/test-f3.js`** (28 assertions) covers lineage counts, per-tier splits, mass propagation, and the mass-sum chain equivalence. `node --check` clean.
- **Docs:** GDD — version header → 1.4; **§2.4 rewritten** as Debris Satellites (F3 spec moved in); §2.7 spawn formula; §2.10 garbage-drop paragraph + new cargo-mass paragraph + mass-sum penalty bullets; §2.10.1 rationale rewritten (guaranteed-drop model, decay-first density); §2.12 damage-table entity names + `DEBRIS_DAMAGE`; Architecture Map rows (Constants, Entity classes, game object, Flow functions, Chain physics, draw); §3.1 + §3.4 (node shape includes `mass`, cargo penalties via `chainMass()`); §6 watch items; Version History v1.4. `PLANNED-FEATURES-v2.md` — F3 and F5 marked 🟢 Done with specs pointed to the GDD, first-pass balance recorded, the joint F3+F10 tuning pass kept open; top status line updated.

## Playtest asks (Paul — can't be checked headlessly)

1. **Debris silhouette reads right?** At all three sizes, does the hull + antenna/panel shards read clearly as *broken satellite / wrecked hardware* rather than a rock — and stay legible in the glow at small size and when several overlap? (Blue `COLOR.debris` vs the teal Hunter satellites — still easy to tell apart?)
2. **Garbage density & decay feel (top retune lever).** Play a few waves and clear some full lineages. Does the field read as *rich, optional salvage* or does it feel **carpeted/cluttered**? Is **12 s** long enough to actually collect a lineage's worth of canisters without feeling frantic, or too generous (clutter) / too tight (nothing collectable)? If off, `GARBAGE_DECAY` is the first knob.
3. **Wave spawn count** — `min(3+wave, 9)` (down from `min(4+wave, 11)`). Do waves still feel substantial with the 3-way splits filling in, or too sparse now? (F10 will likely push this back up — but does the *current* build feel thin?)
4. **Tow handling unchanged?** Grab a long chain (toward 12) and fly/turn/burn — since all cargo is mass 1.0, thrust drag, top speed, and the momentum tug should feel **exactly** like v1.3. Confirm nothing regressed in the count→mass-sum swap.
5. **Performance** — in a garbage-heavy late wave (lots of free canisters + a full chain + a wave of splitting debris), does the frame rate hold on your target hardware? If it dips, `GARBAGE_DECAY` down is the fastest relief, then a glow toggle.
