# Asteroid Field Deluxe — STATUS

Last updated: 2026-07-06 · Build version: **1.3** (v2.0 Phase 2 of 9 shipped) · Last session: implemented **F2 — HP pool + knockback replaces lives** (removed discrete lives + all respawn logic; source-specific contact/bullet damage; knockback + 1.0 s hit-stun; score-milestone hull repair; HULL/HP bar)

## Working / verified

**Headless-verified this session (v1.3, `scratchpad/test-f2.js`, 54 assertions):**
- **Per-hit-type damage** — driving real `update()` collisions, HP drops by exactly `DMG_LARGE` 50 (large asteroid, killer satellite), `DMG_MEDIUM` 35 (medium asteroid, big wedge, big saucer), `DMG_SMALL` 20 (small asteroid, small wedge, small saucer), and `DMG_BULLET` 15 (hostile bullet). Each hit opens the ~1.0 s hit-stun window.
- **Hit-stun blocks repeat damage** — after one hit, re-overlapping the same hazard for 10 consecutive frames (<1 s) deals zero further damage; once the stun clears, the next contact damages again.
- **Knockback** — an unshielded hit sets ship velocity to ≈`KNOCKBACK_SPEED` (250 px/s) pointing directly *away* from the hazard (verified on both +x and −x sides; magnitude within 1 px/s).
- **0 HP → permanent game over, no respawn** — a lethal hit floors HP at 0, sets `dead`, flips state to `gameover`, and `scatterChain()` drops the tow load to free garbage; `game.lives`/`game.respawnTimer` no longer exist, and 200 further `update()` frames (~3.3 s) produce no respawn.
- **Score-milestone hull repair** — crossing a 10,000-pt milestone below max HP adds +25 (capped); at full HP it pays a flat `REPAIR_FULL_BONUS` (2,500) instead.
- **Shield unchanged** — a shielded hit (shift held) deals no HP damage, no hit-stun, and no knockback, and still spends deflection energy.

`node --check` clean.

**Verified headlessly earlier (v1.2 / v1.1, unchanged):** camera-follow + world-boundary wrap + ship-relative spawns (v1.2, `test-f1.js` — not re-run this session, no F1 code touched); garbage drop/decay/pickup/tow/wrap/dock-delivery/chain-severing (v1.1). F2 did not alter chain physics (GDD §3.4) — `scatterChain()` is reused as-is on death.

**Not yet verified (needs a real browser — see playtest asks):** knockback *feel*, damage pacing across waves, HULL-bar readability, and all prior v1.2/v1.1 feel items.

## Known issues

- None confirmed. New F2 watch items (knockback dragging the chain through hazards; knockback pinballing in dense fields) are in GDD §6 and the playtest asks. The two old respawn-related §6 watch items are now moot (no respawn exists).

## Balance notes

- **Max HP = 250 (`SHIP_MAX_HP`).** The Phase 2 prompt said 100, but PLANNED-FEATURES-v2 F2 and this STATUS both recorded 250 as Paul-confirmed — the conflict was surfaced and **Paul reconfirmed 250**. (`IMPLEMENTATION-PHASES.md` Phase 2 still reads 100 as a stale artifact; 250 is authoritative.) With 250 HP and the damage table, a large hit is 20% of the pool (≈5 large hits to die); at 100 it would have been ≈2. If the game feels too forgiving/too swingy, this is the top lever.
- **Damage table (first-pass, tunable):** small 20 / medium 35 / large 50 / hostile bullet 15 (`DMG_*`). The *existing* v1.1 hazards are mapped onto these (killer satellite = large; wedges & saucers by size). Hunter-specific 30/45/60 ramming damage is deferred to F4/Phase 5.
- **`KNOCKBACK_SPEED` 250 px/s**, **`HIT_STUN_DURATION` 1.0 s** — knockback *sets* (not adds) velocity so the ship always separates; over the 1 s stun, drag bleeds ~250→~160 px/s, moving the ship a few hundred px clear of any hazard. If knockback feels floaty, raise it; if it feels violent/disorienting, lower it (and/or shorten the stun).
- **Hull repair:** `REPAIR_MILESTONE` 10,000 pts → `REPAIR_AMOUNT` +25 HP, or `REPAIR_FULL_BONUS` 2,500 pts flat at full HP.
- v1.2 spawn-distance knobs and v1.1 balance notes unchanged.
- **Still pending for later phases:** F3 (Debris Satellites) will increase garbage volume ~8× per cleared large lineage and convert chain physics from a node *count* to a `mass` sum — a Phase 3 concern, not this session.

## Next up

**Phase 3 — Debris Satellites (F3) + variable-mass garbage (F5).** Rename/redesign `Asteroid` → `DebrisSatellite` (broken-satellite silhouette), 3-way splits at large/medium, guaranteed 3 canisters at every tier (incl. small), and add a `mass` field to garbage/chain nodes with chain math moving from `chain.length` to `sum(node.mass)`. Requires a real garbage-volume balance pass (decay/wave-count). Use the Phase 3 prompt in `IMPLEMENTATION-PHASES.md`.

Notes for that session:
- **The F2 damage table is now in place** — assign the renamed entity's per-tier contact damage from `AST_DAMAGE`/`DMG_*` (defaults carry over unchanged unless you have a reason to change them, per the Phase 3 prompt).
- F2 left every other system untouched; the chain-physics contract (GDD §3.4) is unchanged, so Phase 3's count→mass-sum conversion starts from the current, documented baseline.

Attach/have present all four docs. GDD §2 is current truth *including* §2.12 (HP/damage/knockback) and the updated §2.1/§2.7.

## Changed this session

- **`asteroids-deluxe.html` → v1.3.** Added the "Health, damage & knockback (F2)" constants block (`SHIP_MAX_HP`, `DMG_SMALL/MEDIUM/LARGE`, `DMG_BULLET`, `AST_DAMAGE`, `KNOCKBACK_SPEED`, `HIT_STUN_DURATION`, `REPAIR_MILESTONE`, `REPAIR_AMOUNT`, `REPAIR_FULL_BONUS`); removed `EXTRA_LIFE_AT`/`START_LIVES`. `Ship.reset()` now sets `hp = SHIP_MAX_HP` and `invuln = 0` (the 2.5 s spawn invuln is gone; `invuln` is now the hit-stun timer). Every hazard constructor sets a `damage` field. New **`damageShip(amount, srcX, srcY)`** (self-guarding: HP−, knockback shove via wrap-aware `shortDelta`, 1.0 s hit-stun, hit particles + new `AudioSys.hit()` thud, → `killShip` at 0 HP). **`killShip()`** rewritten to a respawn-free game over (boom + `scatterChain` + state → `gameover`). All three unshielded-hit sites (hostile bullet, hazard body, saucer body) call `damageShip` instead of `killShip`; the hazard-loop `break` removed (self-guard handles single-hit-per-frame). Deleted the respawn-clearing block in `update()`. `addScore()` milestone changed from extra-life to hull-repair. `game` state drops `lives`/`nextExtraLife`/`respawnTimer`, gains `nextRepair`. HUD: removed `drawShipIcon` + the life-ship loop; added a HULL/HP bar (`COLOR.hp` green, red < 30%) mirroring the shield bar. Version header + changelog bumped to v1.3.
- **Headless test** added at `scratchpad/test-f2.js` (evals the real script via GDD §5.4 stubs, drives `update()`/`damageShip()`/`addScore()`). 54/54 assertions pass; `node --check` clean.
- **Docs:** GDD — version header → 1.3; §2.1 (health + hit-stun, respawn removed), §2.7 (Waves, Health & Scoring), new **§2.12 (Health, Damage & Knockback)**; Architecture Map rows (Constants, Entity classes, game object, Flow functions, update(dt), draw()) + §3.1 collision conventions updated; §6 respawn watch items retired and two knockback watch items added; Version History v1.3. `PLANNED-FEATURES-v2.md` — F2 marked 🟢 Done with spec pointed to GDD §2.12, resolved max-HP decision recorded, deferred Hunter-damage/health-powerup notes retained; top status line updated.

## Playtest asks (Paul — can't be checked headlessly)

1. **Knockback strength** — does 250 px/s feel right? Not too weak/floaty (ship barely nudged, keeps grinding the hazard) and not too violent (flung across the screen, disorienting)? Pair this with the 1.0 s hit-stun — does the shove + brief blink read clearly as "I got hit, I'm briefly safe, get clear"?
2. **HP damage pacing** — play a few waves unshielded-ish: do the 20/35/50 contact hits and 15 bullet hits feel fairly paced against the 250 pool, or does the run end too fast / never feel threatened? (Top tuning lever if off.)
3. **Max HP = 250** — now that it's in the build (over the prompt's 100), does 250 feel like the right survivability target, or should we try lower for more bite?
4. **HULL bar readability** — top-left HULL bar vs top-right SHIELD bar: clear at a glance which is which? Does the red-below-30% warning register in the heat of a wave?
5. **Shield still the "free" answer** — does shielding to negate a hit (no damage/knockback) vs. eating the hit (damage + shove + i-frames) feel like a real tension, per Pillar 4? Watch the case where a deflected rock still hits your tow chain.
6. **Knockback + chain** — with a long tow chain, does a hit ever yank the ship somewhere that instantly severs the whole haul unfairly (esp. near a wrap seam)?
