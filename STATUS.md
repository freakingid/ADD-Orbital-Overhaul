# Asteroid Field Deluxe — STATUS

Last updated: 2026-07-06 · Build version: **1.5** (v2.0 Phase 4 of 9 shipped) · Last session: implemented **F10 (partial) — Difficulty Ramp & Saucer Calming**. Added a global `difficultyFactor(wave)` curve (`1 − e^(−(wave−1)/RAMP_WAVES)`, `RAMP_WAVES=8`) + a `ramp(floor, ceil, wave)` interpolation helper, then re-expressed the shipped saucers' difficulty-sensitive params (spawn gap, fire rate, small-saucer aim error, small-saucer chance) as floor/ceiling pairs scaled through it, so waves 1–4 are noticeably calmer and full intensity arrives ~wave 20. The old score>8000 small-saucer gate was folded into the wave-driven ramp (one escalation system). **Not** this phase: Hunter-Satellite scaling (Phase 5/F4) and the joint Debris-density retune.

## Working / verified

**Headless-verified this session (v1.5, `scratchpad/test-f4.js`, 30 assertions):**
- **`difficultyFactor(wave)` curve shape (waves 1–25)** — exactly `0` at wave 1, strictly increasing, always in `[0,1)`, gentle over the first few waves (wave 2 ≈ 0.12, wave 4 ≈ 0.31), building by the teens (wave 12 ≈ 0.75), near-full by wave 20 (≈ 0.91) and plateauing by wave 25 (≈ 0.95). Confirmed against the real helper.
- **Saucer floor/ceiling interpolation, wave 1 vs wave 20** (through the same `ramp()` + constants the game uses): spawn gap `[20,30]s` → `[12.7,17.3]s` (>7s less frequent early, both endpoints tighter), fire multiplier `1.80×` → `1.07×`, small-saucer aim error `±0.350` → `±0.114` rad (>2.5× wider early), small-saucer chance `15%` → `56%`. All in the expected direction and magnitude.
- **End-to-end wiring through a real `Saucer`** — a forced aimed shot's fired-bullet angle carries exactly the wave-scaled aim error (`0.350` rad at wave 1 vs `0.114` at wave 20; geometry pinned so `angleTo` = 0 and `Math.random` = 1 so the offset is `+err`), and `Saucer.rollFireTimer(range)` returns the midpoint × the wave-scaled fire multiplier (`1.62s` at wave 1 vs `0.97s` at wave 20). Proves the constants actually reach the entity, not just the helper.

**Regression re-run green this session:** `scratchpad/test-f2.js` (54/54) and `scratchpad/test-f3.js` (28/28) still pass unchanged — the saucer/difficulty work touched no HP/knockback, debris, or chain logic. `node --check` clean.

**Headless-verified in v1.4 (`scratchpad/test-f3.js`, 28 assertions):**
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

- **Difficulty ramp (v1.5) — `RAMP_WAVES` is the master knob.** `RAMP_WAVES = 8` was chosen (per F10) so waves 1–4 feel clearly gentle and full intensity arrives ~wave 20–25. Raise it to lengthen the "enjoy the early game" window, lower it to steepen the ramp — it moves the *whole* game's pacing at once. Every saucer floor/ceiling pair is independently tunable underneath it. **All v1.5 saucer numbers are first-pass, no playtest data yet** (see playtest asks): gap `rand(20,30)s`→`rand(12,16)s`, fire mult `1.8×`→`1.0×`, aim err `±0.35`→`±0.09`, small-saucer chance `15%`→`60%`.
- **Note on the ceiling vs the old numbers.** At full difficulty the saucers land *near but not exactly* on the shipped v1.1 feel: the difficulty factor only reaches ~0.91 by wave 20 (asymptotic), so e.g. the gap ceiling reads `[12.7,17.3]s` at wave 20 rather than a hard `[12,16]`. That's intended (it keeps climbing slightly past wave 20). If Paul wants the *late* game to hit exactly the old intensity sooner, lower `RAMP_WAVES`; the ceilings themselves are already ≈ the old values.
- **Small-saucer escalation is now wave-driven, not score-driven.** The old `score>8000 → 60%` gate is gone, folded into `ramp(0.15, 0.60, wave)`. Consequence: a skilled player who banks 8000+ points *early* (say wave 3) now sees fewer small saucers than before (~0.22 vs the old 0.60) — deliberate (ease players in), but a behavior change worth confirming feels right, not like the dangerous saucer "went missing."
- **First saucer of a run** now waits the wave-1 floor gap `rand(20,30)s` (was `rand(10,18)s`), so the opening is calmer end-to-end rather than the very first saucer arriving sooner than any later wave-1 saucer.
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

**Phase 5 — Hunter Satellites (F4).** Redesign the shipped `Satellite`/`Wedge` system into the diamond-shaped Hunter Satellite: 3-way splits at every tier, garbage on every split tier (final small tier drops a larger burst of low-mass `mass: 0.5` scrap), actively-homing children. **Wire it into the v1.5 difficulty ramp from the start** — its drift/homing speeds and turn rates are the *ceilings* that `ramp(floor, ceil, game.wave)` interpolates up toward, so at wave 1 the whole Hunter family moves at a gentle fraction of full speed (F4 proposes ~55–60% floor). The helpers (`difficultyFactor`, `ramp`) and the pattern (saucers) are now in place to copy. Use the Phase 5 prompt in `IMPLEMENTATION-PHASES.md`.

Notes for that session:
- **The difficulty helpers exist and are proven** — `difficultyFactor(wave)` + `ramp(floor, ceil, wave)` in the Helpers block, with the saucers as a worked example of floor/ceiling pairs in the constants block. Copy that shape for the Hunter speed/turn floors & ceilings.
- The `mass` field and `chainMass()` are in place; F4's low-mass Hunter scrap (`mass: 0.5`) and the F6 Engine powerup build directly on them. `Garbage.fromNode` and the pickup path carry mass through. **Any new chain node must set `mass`** (GDD §3.4) or `chainMass()` returns `NaN`.
- **Still open: the joint F3+F10 Debris-density retune.** Not touched in Phase 4 (F10's saucer half). Paul wants *more* Debris Satellites to fill the calmer world, balanced against F3's 8× canister volume by leaning on `GARBAGE_DECAY`. This is a post-playtest tuning pass — do it once the calmer difficulty is confirmed to feel right (see playtest asks), not a number to guess now.
- Decide explicitly whether the reshaped Hunter can damage the tow chain (the shipped Satellite/Wedge already does — GDD §2.10; carry it forward).

Attach/have present all four docs. GDD §2 is current truth *including* the new §2.6 (wave-scaled saucers) and §2.13 (difficulty ramp).

## Changed this session

- **`asteroids-deluxe.html` → v1.5.**
  - **New constants block "Difficulty ramp & early-game pacing (F10)"** (after the v1.2 world block): `RAMP_WAVES` (8, the ramp knob); saucer gap floor/ceiling `SAUCER_GAP_FLOOR_MIN/MAX` (20/30), `SAUCER_GAP_CEIL_MIN/MAX` (12/16); base fire ranges `SAUCER_FIRE_INIT` [0.6,1.4], `SAUCER_FIRE_BIG` [0.9,1.6], `SAUCER_FIRE_SMALL` [0.7,1.1]; fire multiplier `SAUCER_FIRE_MULT_FLOOR/CEIL` (1.8/1.0); aim error `SAUCER_AIM_ERR_FLOOR/CEIL` (0.35/0.09); small-saucer chance `SAUCER_SMALL_CHANCE_FLOOR/CEIL` (0.15/0.60).
  - **Two helpers** in the Helpers block (after `randSign`): `difficultyFactor(wave)` = `1 − Math.exp(−(wave−1)/RAMP_WAVES)` and `ramp(floor, ceil, wave)` = `floor + (ceil−floor)*difficultyFactor(wave)`.
  - **`Saucer` class:** new method `rollFireTimer(range)` returns `rand(...range) × ramp(FIRE_MULT_FLOOR, FIRE_MULT_CEIL, game.wave)`. Constructor's first-shot `fireTimer` now `this.rollFireTimer(SAUCER_FIRE_INIT)` (was inline `rand(0.6,1.4)`). In `update`, the reload is `this.rollFireTimer(this.small ? SAUCER_FIRE_SMALL : SAUCER_FIRE_BIG)` (was inline ternary), and the small-saucer aim error is `ramp(AIM_ERR_FLOOR, AIM_ERR_CEIL, game.wave)` (was inline `±0.09`). Big saucer still fires randomly (unchanged).
  - **Spawn block (`update`):** small-saucer roll is now `Math.random() < ramp(SMALL_CHANCE_FLOOR, SMALL_CHANCE_CEIL, game.wave)` — **removed the `game.score > 8000` branch** (folded into the ramp). Next `saucerTimer` is `rand(ramp(gap floor→ceil min), ramp(gap floor→ceil max))` (was `rand(12,22) − Math.min(6, game.wave)`).
  - **`startGame`:** first saucer delay `rand(SAUCER_GAP_FLOOR_MIN, SAUCER_GAP_FLOOR_MAX)` (was `rand(10,18)`), matching the wave-1 floor.
  - Version header + changelog bumped to v1.5. **No changes to debris, chain, HP/knockback, dock, or the Satellite/Wedge system** (Phase 5).
- **Tests:** New **`scratchpad/test-f4.js`** (30 assertions): curve shape 1–25, saucer floor/ceiling interpolation wave 1 vs 20, and end-to-end wiring through a real `Saucer` (fired-bullet aim error via pinned geometry + `Math.random`, and `rollFireTimer`). `test-f2.js` (54/54) and `test-f3.js` (28/28) re-run green unchanged. `node --check` clean.
- **Docs:** GDD — version header → 1.5; Pillar 6 flipped planned→shipped; **§2.6 rewritten** as wave-scaled saucers (F10 saucer spec moved in); **new §2.13** (difficulty ramp system); Architecture Map rows (Constants, Helpers, Entity classes, update); Version History v1.5 + the "v2.0 in progress" line → Phase 4. `PLANNED-FEATURES-v2.md` — F10 → 🟡 In Progress with a "Shipped in v1.5" / "Still open" split, the Saucers sub-bullet marked ✅ shipped; top status line updated.

## Playtest asks (Paul — can't be checked headlessly)

**New this session (v1.5 difficulty ramp — the two that matter most):**

1. **Do waves 1–4 now feel approachable?** This is the whole point of the phase. Play the opening waves: are the saucers noticeably calmer — longer gaps before one shows up (first one ~20–30 s in), slower shots, the small saucer clearly *spraying* rather than sniping, and mostly the harmless random-fire big saucer early? Does the early game finally give you room to learn the salvage loop instead of being under fire immediately? If wave 1 still feels too hot, the fix is the saucer *floors* (wider gap, higher fire mult, wider aim) or a larger `RAMP_WAVES`.
2. **Does the ramp reach satisfying intensity by the teens?** By roughly waves 12–20, do the saucers feel like they've climbed back to a *real* threat — tight gaps, aimed small saucers that actually punish, appearing often? Or does it stay too soft too long (raise the ceilings / lower `RAMP_WAVES`) or spike too hard too fast (the opposite)? The target is "gentle start, full pressure by ~wave 20." Note *which wave* it starts feeling properly dangerous — that calibrates `RAMP_WAVES`.
3. **Did the dangerous small saucer "go missing" for a high-scoring early run?** The old score>8000 gate is gone (now wave-driven). If you bank points fast on an early wave, you'll now see *fewer* small saucers than the old build did. Confirm that reads as "calm early game," not "where did the 1000-pt saucers go?"

**Still open from v1.4 (unchanged, still need a browser):**

4. **Debris silhouette reads right?** At all three sizes, does the hull + antenna/panel shards read clearly as *broken satellite / wrecked hardware* rather than a rock — and stay legible in the glow at small size and when several overlap? (Blue `COLOR.debris` vs the teal Hunter satellites — still easy to tell apart?)
5. **Garbage density & decay feel (top retune lever).** Play a few waves and clear some full lineages. Does the field read as *rich, optional salvage* or does it feel **carpeted/cluttered**? Is **12 s** long enough to actually collect a lineage's worth without feeling frantic? If off, `GARBAGE_DECAY` is the first knob. *(The joint F3+F10 density retune is still pending — now that the difficulty is calmer, this is the moment to judge whether the field wants **more** Debris Satellites, per Paul's F10 note.)*
6. **Tow handling unchanged?** Grab a long chain (toward 12) and fly/turn/burn — thrust drag, top speed, and momentum tug should feel **exactly** like v1.3 (this phase didn't touch the chain). Confirm nothing regressed.
7. **Performance** — in a garbage-heavy late wave (lots of free canisters + a full chain + a wave of splitting debris), does the frame rate hold? If it dips, `GARBAGE_DECAY` down is the fastest relief, then a glow toggle.
