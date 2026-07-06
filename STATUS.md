# Asteroid Field Deluxe — STATUS

Last updated: 2026-07-06 · Build version: **1.6** (v2.0 Phase 5 of 9 shipped) · Last session: implemented **F4 — Hunter Satellites**. Merged the shipped killer `Satellite` + homing `Wedge` classes into one `HunterSatellite` diamond family (tiers 3/2/1): a passive-drifting large core that splits **3-ways** into medium then small **actively-homing** children, each faster/more agile than the last. **Every speed and turn rate is wired into the v1.5 difficulty ramp from line one** — full-intensity numbers are the ceilings, `HUNTER_FLOOR_FRAC` (0.58) sets the gentle wave-1 floor, so the whole family moves at ~60% at wave 1 and ~96% by wave 20. Garbage at every tier (3 normal-mass at large/medium; a 6-canister burst of low-mass `0.5` scrap at small, paler tint). Contact damage 60/45/30. Shield: core bounces, homers destroyed-on-contact and still split; chain-severing preserved. **Not** this phase: the joint F3+F10 Debris-density retune (still deferred to a post-playtest pass).

## Working / verified

**Headless-verified this session (v1.6, `scratchpad/test-f5.js`, 40 assertions):**
- **Full Hunter lineage** — destroying one large all the way down = exactly **13 kills** (1 large / 3 medium / 9 small) and **66 canisters**: **12 normal-mass (1.0)** (large + 3 mediums, 3 each) + **54 low-mass (0.5)** (9 smalls × 6). Total towable mass sums to **39** — the same haul weight as a cleared Debris lineage, just lighter and more numerous at the tail. Confirmed against the real `destroyHunter` path.
- **Per-tier splits + tiered garbage mass in isolation** — large → 3 homing mediums + 3× mass-1.0; medium → 3 homing smalls + 3× mass-1.0; small → destroyed (no children) + 6× mass-0.5. The passive/`homing` flags are correct per tier.
- **Damage / score / radii tables** — contact 60/45/30, score 200/150/250 (small worth the most, hardest to hit — old small-wedge value preserved), radii 24/15/10 by tier; `spawnCore()` makes a passive large.
- **Difficulty ramp wired into EVERY speed & turn rate** — for all three tiers, wave-1 speed sits exactly on `ceiling × HUNTER_FLOOR_FRAC` and is meaningfully slower than wave 20 (ratio ≈ 0.60). Turn rate scales the same for the homing tiers; the large core's turn rate is 0 at all waves (never turns) while its *drift speed* still scales. Concrete: a small homer runs **102 px/s at wave 1 vs 168 px/s at wave 20** (turn 1.51 → 2.50 rad/s).
- **Active homing** — a frozen-in-place small homer re-aims its heading from 0 to face the ship (±π) over frames, proving relentless wrap-aware pursuit (not passive drift).
- **Chain-severing on contact** — a Hunter body touching a chain node severs the chain (node + everything aft breaks loose) and the Hunter itself survives.

**Regression re-run green this session:** `scratchpad/test-f2.js` (54/54, updated so its three killer-satellite/wedge damage cases now exercise the merged `HunterSatellite` tiers at 60/45/30), `scratchpad/test-f3.js` (28/28, `clearField` retargeted to `game.hunters`), and `scratchpad/test-f4.js` (30/30, unchanged) all pass. `node --check` clean.

**Verified headlessly earlier (unchanged this session):** the v1.5 difficulty curve + saucer floor/ceiling wiring (`test-f4.js`); the v1.4 Debris lineage counts + mass-sum chain physics (`test-f3.js`); v1.3 HP/damage/knockback (`test-f2.js`); v1.2 camera/world-wrap/ship-relative spawns (`test-f1.js`); v1.1 salvage pickup/tow/wrap/dock/severing. The chain **integration** is untouched this phase.

**Not yet verified (needs a real browser — see playtest asks):** whether the Hunter feels gentle enough in the opening waves and escalates smoothly, whether the diamond silhouette + low-mass tint read clearly, whether the point-blank shield-kill split feels fair, and the combined Hunter+Debris garbage density.

## Known issues

- None confirmed. New v1.6 watch items are in GDD §6: **Hunter shield-kill at point-blank** (a medium destroyed on the shield spawns 3 smalls that scatter 0.6 s before homing — verify fair), **Hunter garbage density** (a full lineage emits 66 canisters, top Hunter-side lever is `HUNTER_SMALL_GARBAGE`), and **Hunter early-game feel vs. escalation** (the `HUNTER_FLOOR_FRAC` / `RAMP_WAVES` calibration). The v1.4 garbage-density and v1.3 knockback/chain watch items still stand.

## Balance notes

- **Hunter Satellites (v1.6) — all first-pass, no playtest data yet.**
  - **Speeds/turn ceilings** (`HUNTER_SPEED_CEIL` / `HUNTER_TURN_CEIL`): large drift **70 px/s** (no turn); medium **120 px/s / 1.6 rad/s**; small **175 px/s / 2.6 rad/s**. The medium/small numbers are the old big-wedge / small-wedge values; the large drift is a new tier (the old satellite drifted a flat 55). These are the *full-difficulty* targets.
  - **`HUNTER_FLOOR_FRAC = 0.58`** is THE knob for early-game Hunter calm — the whole family moves at 58% of ceiling at wave 1 (≈ 60% since `difficultyFactor(1)=0`), ramping up under `RAMP_WAVES`. Raise it toward 1.0 to make the early game more aggressive, lower it to make wave 1 gentler. It moves the whole family at once; `RAMP_WAVES` (shared with the saucers) sets *how fast* the climb happens.
  - **Chose a floor *fraction*, not per-value floor/ceiling pairs** (unlike the saucers). Faithful to F4's "floors ≈ 55–60% of ceiling," one knob for the whole family, and can't fall out of sync when a ceiling is retuned. Values still flow through the standard `ramp(floor, ceil, wave)`.
  - **Garbage:** `HUNTER_GARBAGE = 3` (large/medium, mass 1.0); `HUNTER_SMALL_GARBAGE = 6` at `HUNTER_SMALL_MASS = 0.5` (small tier). Picked 6 (top of the proposed 5–6) so the small-tier drop clearly reads as a "larger burst" bonus; 6 × 0.5 = 3.0 mass-equivalent, so it's a *rich but light* pile. First Hunter-side density lever if it feels cluttered.
  - **Contact damage 60/45/30** (`HUNTER_DAMAGE`) — a step above the equivalent Debris tier (50/35/20), since Hunters are the actively-seeking threat. Max HP is 250, so a large Hunter ram costs ~24% hull.
  - **Score 200/150/250** — small worth the most (hardest to hit), preserving the old satellite/wedge inversion.
- **One Hunter lineage at a time.** Spawn cadence is unchanged from the old Satellite (`hunterTimer` = `rand(14,22)` first, `rand(20,32)` after) and only fires when the whole family is clear and `wave ≥ 2`. So despite the 66-canister full-lineage volume, only one lineage's worth is ever in flight — decay (12 s) bounds coexistence.
- **Carried from v1.5 (unchanged):** the difficulty ramp `RAMP_WAVES = 8` (shared knob), all saucer floor/ceiling pairs, and the wave-driven small-saucer escalation.
- **Carried from v1.4 (unchanged):** `GARBAGE_DECAY` 12 s / `GARBAGE_SEVER_DECAY` 10 s, wave spawn `min(3+wave, 9)`, the mass-sum chain physics. **Open: the joint F3+F10 Debris-density retune** — still a post-playtest pass, now judgeable once the *combined* calmer early game (saucers + Hunters) is confirmed to feel right.
- **Tow feel unchanged from v1.3** for mass-1.0 cargo. The new low-mass (0.5) Hunter scrap tows lighter by design (`chainMass()` sums it), and 2× of it = one normal canister's weight — the F5 groundwork finally has a real source.

## Next up

**Phase 6 — Powerups (F6).** Add a `Powerup` entity class with five types: Rapid Fire, Triple Shot, Health, Magnet, Engine. Health spawns ambiently on a timer; the rest drop from small-tier Debris/Hunter kills at a modest chance. Use the Phase 6 prompt in `IMPLEMENTATION-PHASES.md`.

Notes for that session:
- **The mass field + `chainMass()` are the hook for Engine and Magnet.** Engine temporarily halves the effective mass sum in `Ship.update`'s `thrustMul`/`maxSp` and `updateChain`'s `massFactor`; Magnet extends the pickup radius and nudges nearby garbage toward the ship. Both live in the chain math that's now stable and mass-based.
- **Powerup drops from small-tier kills** slot cleanly into `destroyDebris` and `destroyHunter` (both already the single choke point for small-tier destruction + guaranteed garbage). Add a roll there, don't scatter the logic.
- **Health powerup** restores +25 HP capped at max (same value as the F2 score-milestone repair) — reuse that.
- **Still open: the joint F3+F10 Debris-density retune** — not touched in Phase 5. Do it once the combined calmer difficulty is confirmed to feel right (see playtest asks), not a number to guess now.

Attach/have present all four docs. GDD §2 is current truth *including* the rewritten §2.5 (Hunter Satellites) and the updated §2.3 (shield) / §2.12 (damage table) / §2.13 (difficulty ramp).

## Changed this session

- **`asteroids-deluxe.html` → v1.6.**
  - **New constants block "Hunter Satellites (F4)"** (replacing `SAT_SCORE`/`WEDGE_SCORE`): `HUNTER_RADII` {24/15/10}, `HUNTER_SCORE` {200/150/250}, `HUNTER_DAMAGE` {60/45/30}, `HUNTER_SPEED_CEIL` {70/120/175}, `HUNTER_TURN_CEIL` {0/1.6/2.6}, `HUNTER_FLOOR_FRAC` (0.58), `HUNTER_SCATTER` (0.6), `HUNTER_GARBAGE` (3), `HUNTER_SMALL_GARBAGE` (6), `HUNTER_SMALL_MASS` (0.5). Added `COLOR.garbageLight` (paler mint for low-mass scrap).
  - **`Satellite` + `Wedge` classes → one `HunterSatellite` class.** Tiers 3/2/1; `homing` flag (large passive drift with a slow visual tumble / medium+small active homing after a 0.6 s scatter); speed & turn rate sampled once at construction via `ramp(ceiling × HUNTER_FLOOR_FRAC, ceiling, game.wave)`. Diamond `shape` per tier (symmetric for the spinning core, forward-elongated kite for the pointing homers) + an inner diamond on the two larger tiers. `static spawnCore()` places a fresh large off a viewport edge (the old Satellite's entry logic).
  - **New flow function `destroyHunter(h, awardScore=true)`** (after `destroyDebris`): score + boom + tier garbage (3 normal-mass at large/medium; `HUNTER_SMALL_GARBAGE` low-mass at small) + 3-way split; called from the bullet-vs-hunter pass and the shield-kill branch.
  - **`drawCanister()` gained an optional `color` param**; `Garbage.draw` and `drawChain` pass `COLOR.garbageLight` when `mass < 1` so low-mass scrap (free and towed) renders paler.
  - **`game` object:** `wedges`/`satellites` arrays → one **`hunters`**; `satelliteTimer` → **`hunterTimer`**. `startGame` resets updated. **`update()`** collapsed the old two-array spawn/update/collision/cleanup passes into single `game.hunters` passes — one bullet loop → `destroyHunter`; hunters in both the hazard-vs-ship and hazard-vs-chain spread copies; wave-clear now `debris === 0 && hunters === 0`; heartbeat density uses `hunters.length * 2`. Shield-vs-ship: core bounces (`shieldDeflect`), medium/small homers `destroyHunter` at a deflection's energy cost. **`draw()`** z-order `debris → hunters → saucers`. Title tagline → "BEWARE THE HUNTER SATELLITE".
  - Version header + changelog bumped to v1.6.
- **Tests:** New **`scratchpad/test-f5.js`** (40 assertions, see Working/verified). Updated `test-f2.js` (killer-satellite/wedge cases → HunterSatellite tiers; `clearField` + imports retargeted) and `test-f3.js` (`clearField` → `game.hunters`); both plus `test-f4.js` re-run green. `node --check` clean.
- **Docs:** GDD — version header → 1.6 (Phase 5 of 9); Pillar 6 notes both saucers and Hunters now scale; **§2.3** shield behaviour rewritten for the Hunter; **§2.5 fully rewritten** as the shipped Hunter Satellites (F4 spec moved in); **§2.12** damage table gains a Hunter row; **§2.13** "what scales" updated (Hunters shipped, only Debris-density left); Architecture Map rows (Constants, Entity classes, game object, Flow functions, update, draw, §3.3); §6 Bug Watch (three new Hunter items); Version History v1.6 + the "v2.0 in progress" line → Phase 5. `PLANNED-FEATURES-v2.md` — F4 → 🟢 Done with a resolved-decisions note; F10's Hunter-scaling marked shipped; F2's Hunter-damage deferred item marked shipped; top status line + F10 status line updated.

## Playtest asks (Paul — can't be checked headlessly)

**New this session (v1.6 Hunter Satellites — the two that matter most):**

1. **Do the Hunters feel gentle enough in the early waves?** This is the whole point of wiring them into the ramp. Play waves 1–4: does the large core drift in slowly and ominously (not zip across), and when you pop it, do the mediums/smalls pursue at a pace you can actually out-fly and pick apart — rather than the old "everything seeks too fast from wave 1"? If wave 1 still feels too hot, lower `HUNTER_FLOOR_FRAC` (0.58 → ~0.45) for a gentler family-wide floor, or raise `RAMP_WAVES` to slow the whole climb.
2. **Does the three-tier homing progression escalate satisfyingly as *both* tier and wave climb?** Two axes here: within a single lineage, do the smalls clearly feel faster/nastier than the mediums than the core? And across waves, does a wave-15 Hunter feel meaningfully more dangerous than a wave-3 one? Target: "gentle, readable start; a real, agile threat by the teens." Note *which wave* the smalls start feeling genuinely punishing — that calibrates the shared `RAMP_WAVES`.

**Also worth confirming (v1.6):**

3. **Diamond silhouette + tint read right?** Do the three tiers read clearly as one aggressive "hunter" family (teal diamonds, homers visibly *pointing at you*, the core tumbling) and stay distinct from the blue Debris Satellites and the saucers? And do the small-tier's **low-mass canisters read as paler/lighter** (`COLOR.garbageLight` mint vs the normal yellow-green) so you can see at a glance which pile tows easier?
4. **Point-blank shield-kill — fair?** Raise the shield into a medium Hunter: it dies and spawns 3 smalls at the shield edge. They scatter 0.6 s before homing, so it shouldn't be an instant swarm — but does it read as a fair "spent energy, now deal with the smalls" trade, or as a death trap? (Old wedge tension, carried forward.)
5. **Combined garbage density.** A full Hunter lineage drops 66 canisters (mostly the light 6-per-small burst) on top of whatever Debris scrap is around. With only one Hunter lineage in flight at a time and 12 s decay, does the field stay *rich but readable*, or does the small-tier jackpot carpet the screen? If cluttered, `HUNTER_SMALL_GARBAGE` (6) is the first lever. *(This is also the moment to finally judge the deferred joint F3+F10 Debris-density retune — with both saucers and Hunters now calmer, does the field want more Debris, or is it already busy enough?)*

**Still open from earlier phases (unchanged, still need a browser):** waves 1–4 saucer calm + ramp intensity by the teens (v1.5); Debris silhouette readability + tow-handling-unchanged + performance in garbage-heavy late waves (v1.4).
