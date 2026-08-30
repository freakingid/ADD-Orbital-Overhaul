# GDD trim — CS041

**What this is.** Text removed from `ORBITAL-OVERHAUL-GDD.md` during CS041, preserved verbatim.
Nothing here was rewritten, summarised or edited on the way in; each entry is the exact string that
left the GDD, under a heading naming the section it came out of.

**Why it exists.** CS041 makes the live docs cheap to load (`PLANNED-FEATURES-CS041.md`). The
obvious home for cut narration — appending each fragment to its originating `log/CS0##.md` — would
edit closed historical records, which `CLAUDE.md` treats as sacred. A single new file preserves
everything and edits nothing (FORK-CS041-C).

⛔ **Never read by default.** This is `log/`. Pull it in only when a question genuinely needs the
per-constant or per-mechanic retune history, and say you did. It is **not** archived at the
changeset's close — it stays in `log/` as the record of what was cut.

⛔ **Not authoritative for anything.** Where this file and the GDD disagree, the GDD is right; where
the GDD and the build disagree, the build is right. Several passages preserved here were already
stale when they were cut — see each entry's note.

---

## GDD §3 — the Code Architecture Map's **Constants** row (CS041 P2)

The row's two content cells held **22,499 bytes** on one line of markdown: an append-only changelog
of every tuning constant added, retired or retuned since v1.1, plus a "Notes for modification" cell
whose standing rules had partly gone stale. They were replaced by a **3,116-byte** pointer.

**What moved into the replacement rather than here:** the grouping rule; "change balance here first,
never hardcode magic numbers deeper in the file"; `WORLD_*` (wrap boundary) vs `VIEW_*` (screen) and
the `let`/module-load-cache consequence; "retune the constant, never the debug row's `def`"; the ⛔
`POWERUP_RADIUS` 30 / `DOCK_RADIUS` 88 "do not restore 1×" rule; `DEBRIS_SPEED_CAP` stays; and a
one-line index of every retired constant NAME, so a grep for `GARBAGE_DECAY` or
`POWERUP_DROP_CHANCE` finds "deleted, see `log/`" instead of silence.

⛔ **Three of the cut "Notes for modification" rules were STALE AT THE TIME OF CUTTING**, and were
verified against the build at CS041 P2 before removal. They are preserved below because this file
preserves everything, **not** because they are true:

1. *"Early-game pacing tunes from `RAMP_WAVES` + the saucer floor/ceiling pairs — every wave-scaled
   value is `ramp(floor, ceil, wave)`."* — `ramp`/`difficultyFactor`/`RAMP_WAVES` were deleted by
   CS024 P4 (`RAMP_WAVES` renamed `MUSIC_INTENSITY_WAVES`, music-only); `SAUCER_AIM_ERR_*` has zero
   occurrences in the build. Difficulty comes from `leverState()` and nothing else.
2. *"As of CS017 P3 there are TWO clocks and you must know which one a lever is on…"* — the CS017
   cycle clock (`CYCLE_LENGTH`, `CYCLE_GAIN`, `cycleValue()`, `game.cycle`, `game.cycleWave`) was
   retired by CS018 P4 (FORK-CS018-A) and its replacement by CS024 P4. **This passage contradicted
   `CLAUDE.md`'s ⛔ "One clock. All difficulty scaling derives from `game.wave`. No parallel
   clocks."** Its surviving occurrences in the build are tombstone comments only.
3. *"Debris density tunes from decay (`DEBUG.garbageLifetime`…)… `garbageLifetime` must stay a
   wide-enough multiple of `garbageAttractDelay` or nothing clumps."* — CS024 P3 deleted
   `Garbage.decay`, `GARBAGE_FADE` and the `garbageLifetime` knob (loose Debris is permanent);
   CS024 P5 retired `garbageAttractDelay` in favour of the `coalescePause` lever. Density is now
   governed by `GARBAGE_SOFT_MAX`/`GARBAGE_HARD_MAX` and `cullGarbage()`.

The replacement therefore points at §2.10.1 / §2.5.1 / `DIFFICULTY-LEVERS.md` for density,
coalescence and wave scaling rather than restating a rule here. **Writing a current-state
replacement for these three was deliberately NOT done** — that is new GDD content, which P2 was not
scoped to author. Recorded in `STATUS.md` for GATE C / P4.

---

### Cell 1 of 2 — the "Contents" column, verbatim (18,211 bytes)

```text
All tuning values (SHIP_*, BULLET_*, SHIELD_*, `DEBRIS_*`, scores) + v1.1 salvage block (GARBAGE_*, CHAIN_*, CARGO_*, DOCK_*) + v1.2 world block (`WORLD_W/H`, `VIEW_W/H`, `CULL_MARGIN`, `SPAWN_MIN/MAX_DIST`, `DOCK_MIN/MAX_DIST`, `STAR_DENSITY`) + v1.3 HP block (`SHIP_MAX_HP`, `DMG_SMALL/MEDIUM/LARGE`, `DMG_BULLET`, `DEBRIS_DAMAGE`, `KNOCKBACK_SPEED`, `HIT_STUN_DURATION`, `REPAIR_*`). v1.4 (F3): the Garbage Satellite table is `DEBRIS_SPEEDS/RADII/SCORE/DAMAGE` (was `AST_*`) plus `DEBRIS_GARBAGE` (Debris/kill — 3, retuned to 4 in v3.4 P1); `GARBAGE_DROP` was removed; `GARBAGE_DECAY` 20→12 and a new `GARBAGE_SEVER_DECAY` (10) replaced the inline 15. v1.5 (F10): a "Difficulty ramp & early-game pacing" block — `RAMP_WAVES` (the ramp knob) + the saucer floor/ceiling pairs and base fire ranges (see §2.13). **CS017 P1: `CYCLE_LENGTH` (9) and `CYCLE_GAIN` (0.12, both PLAYTEST KNOBS) join the same block — the difficulty cycle clock's period and per-cycle spiral gain (§2.13); inert as of P1.** **CS017 P3: four more PLAYTEST KNOBS join them, grouped directly under the cycle pair because they are meaningless without it — `DEBRIS_COUNT_MAX` (12, the in-cycle ceiling on `3 + cycleWave`, replacing the inline literal 9), `DEBRIS_COUNT_HARD_MAX` (24, the absolute ceiling AFTER the spiral gain — the backstop that keeps a deep run's field bounded), `DEBRIS_SPEED_PER_WAVE` (0.08, hoisted out of the inline literal that used to sit at BOTH Garbage-Satellite-speed sites), and `DEBRIS_SPEED_CAP` (`2 × SHIP_MAX_SPEED` = 1040, the FLAG-CS017-a guard rail clamping the RESULTING per-entity speed in the `DebrisSatellite` ctor — never the multiplier, since the three sizes have different bases). `DEBRIS_SPEEDS`/`RADII`/`SCORE`/`DAMAGE` stay in the v1.4 Garbage Satellite block, with a pointer comment on `DEBRIS_SPEEDS` to the cycle knobs (§2.4/§2.13).** **CS017 P5: five more constants join the v1.1 salvage block (with the GARBAGE_* group, not the cycle group — the bonus Debris is a salvage feature that happens to read the cycle clock) — `BONUS_CANISTER_PIECES` (6), `BONUS_CANISTER_SCORE` (250), `BONUS_SPAWN_CHANCE_EARLY` (0.5), `BONUS_SPAWN_CHANCE_LATE` (0.1), all PLAYTEST KNOBS, plus the look-call `BONUS_RING_PAD` (5 px). The two chance constants are the ONE lever in CS017 that eases off across a cycle instead of escalating (§2.10, `DIFFICULTY-LEVERS.md`).** v1.6 (F4): a "Hunter Satellites" block replacing `SAT_SCORE`/`WEDGE_SCORE` — `HUNTER_RADII/SCORE/DAMAGE`, `HUNTER_SPEED_CEIL/TURN_CEIL` (the difficulty ceilings), `HUNTER_FLOOR_FRAC` (wave-1 gentleness knob), `HUNTER_SCATTER`, `HUNTER_GARBAGE`/`HUNTER_SMALL_MASS` (`HUNTER_GARBAGE` became a per-tier table and `HUNTER_SMALL_GARBAGE` was folded into it in v3.4 P1); plus `COLOR.garbageLight` for low-mass scrap (see §2.5). v1.7 (F6): a "Powerups" block — `POWERUP_DURATION/RADIUS/DECAY/DROP_TYPES` (`POWERUP_DROP_CHANCE` removed in v3.6 P3 — no chance gate left), `POWERUP_HEALTH_*`, the weapon caps `RAPID_MAX_BULLETS`/`TRIPLE_MAX_BULLETS`/`TRIPLE_SPREAD`, the `MAGNET_*` (range/pickup/pull/damp) and `ENGINE_MASS_MULT` (see §2.14); `POWERUP_COLOR`/`POWERUP_LABEL` sit with `COLOR`. v1.8 (F7): a "Controller / gamepad input" block — just `GP_DEADZONE` (0.25, the analog-stick threshold / the one controller-feel knob); the `GP` index enum and `bindings` table are structural, not balance, and live in the Input section (see §2.15). v2.0 (F9): an "Achievements" block — `ACH_TOAST_TIME` (4.5), `ACH_WEEKLY_SHOWN` (5), `ACH_LINEAGE_FULL` (13), `ACH_SAVE_EVERY` (30); the achievement pools/logic are structural and live in the Achievements module (see §2.17). v2.1: `BOUNDARY_DASH`/`BOUNDARY_GAP`/`BOUNDARY_WIDTH`/`BOUNDARY_GLOW` in the v1.2 world block — the dashed wrap-seam visibility line (cosmetic, uses `COLOR.dim`). v3.0 (P1): `STAR_DENSITY` retuned 40→80; new `STAR_PARALLAX_FACTOR`, `STAR_BRIGHT_MIN/MAX`, `STAR_NEAR_DENSITY`, `STAR_NEAR_BRIGHT_MIN/MAX` in the same v1.2 world block — starfield legibility + a near parallax layer (cosmetic). v3.0 (P2): `FIRE_COOLDOWN` retuned 0.16→0.20 (base gun, slightly slower); new `RAPID_FIRE_COOLDOWN` (0.09) in the same weapons block — Rapid Fire now genuinely speeds up cadence, not just the bullet cap (see §2.2). v3.0 (P5): count-based powerup-expiry budgets in the Powerups block — `RAPID_SHOTS` (40), `TRIPLE_SHOTS` (30), `MAGNET_PIECES` (20) + the `POWERUP_BUDGET` lookup; the two expiry-mode settings (`shotPowerupMode`/`magnetMode`, default `"time"`) live on the persisted `settings` object in the menu section (see §2.14/§2.16). v3.0 (P6/B-8): the salvage/chain block gains a growing-tow-cap group — `CARGO_BASE` (12, replaces the removed `CHAIN_MAX`), `CARGO_CAP_MAX` (**24** as of v3.4 P1, was 20), `CARGO_GROW_PER` (30) + a new `CHAIN_ITER` (4) relaxation-pass count; and the mass-penalty coefficients were retuned **down** (`CARGO_THRUST` 0.10→0.06, `CARGO_MAXSPD` 0.05→0.03, `CARGO_MASS` 0.12→0.07) so a full chain at the higher ceiling matches the old full-12 feel (see §2.10.2). v3.0 (P7): `TIER_NAMES` + `TIER_COLOR[]` (the bronze→diamond badge palette) sit with `COLOR`; the tier ladders themselves are `tiers:[…]` arrays on the tiered LIFETIME definitions (structural, in the Achievements module — see §2.17). v3.1 (P1): `WORLD_W/H` shrunk 3840×2160→2560×1440; `SPAWN_MAX_DIST` 1100→640, `DOCK_MAX_DIST` 900→620 clamped to match (mins unchanged); `STAR_DENSITY` untouched (see §2.11). v3.1 (P3): a Debris-coalescence group in the salvage/chain block (near `GARBAGE_DECAY`) — `GARBAGE_COALESCE_DELAY` (1.0 s activation delay), `GARBAGE_MAGNET_RANGE` (140), `GARBAGE_MAGNET_PULL` (40), `GARBAGE_MERGE_DIST` (12), `HUNTER_COALESCE_COUNT` (12 → a Hunter), and the off-by-default `GARBAGE_CLUMP_MAXSPD` (Infinity) playtest clamp (see §2.5.1). v3.2 (P2): `GARBAGE_SHATTER_KICK` (a `[40, 90]` px/s outward-kick range, playtest knob) joins the same group — the shatter burst reuses `GARBAGE_COALESCE_DELAY` rather than adding a second delay constant (see §2.5.1). v3.2 (P3): `GARBAGE_DECAY`/`GARBAGE_SEVER_DECAY` were removed and `GARBAGE_COALESCE_DELAY` retuned 1.0→6.0, `GARBAGE_MAGNET_RANGE` 140→260. **v3.3 (P4): `GARBAGE_DECAY` is REINTRODUCED (≈ 22 s, singles only) — decay is the density governor again (§2.10.1); a new `GARBAGE_FADE` (≈ 2 s) is the blink-out window. `GARBAGE_SEVER_DECAY` stays deleted (severed Debris reuses the one `GARBAGE_DECAY`). `GARBAGE_COALESCE_DELAY` retuned 6.0→3.0 and `GARBAGE_MAGNET_RANGE` 260→180 (both walked back from their permanent-Debris values; playtest knobs, the range still FLAG D-1). The Scoop group gains `SCOOP_SPILL_KICK` (≈ 85 px/s, the outward kick on a partially-scooped clump's leftover — §2.5.1). `DEBRIS_GARBAGE`/`HUNTER_GARBAGE`/`HUNTER_SMALL_GARBAGE` unchanged.** v3.3 (P1): new `COLOR.clumpHot` (`#ff5a2a`) sits with `COLOR` — the hot end of the clump danger-tint lerp (§2.5.1); no new tunable constant otherwise (the two menu-backdrop alphas are inline look-call literals at their call sites, not named constants). **v3.5 (P2): no new constant** — the clump render scales `drawCanister` by `this.radius / 7` (`= √pieces`), reusing the derived radius; `COLOR.clumpHot` is unchanged (§2.5.1). **v3.6 (P1a): `COLOR.clumpHot` is DELETED**, along with the now-unused `lerpColor()` helper (§2.5.1); no replacement constant — the clump colour rule is now identical to a single's (`mass/pieces < 1 ? garbageLight : garbage`), read off the existing `COLOR.garbage`/`COLOR.garbageLight`. **v3.6 (P1b): `BOUNDARY_DASH`/`BOUNDARY_GAP`/`BOUNDARY_WIDTH`/`BOUNDARY_GLOW` (v2.1) are DELETED** along with `drawWorldBoundary()` — no replacement overlay (§3.2/draw() row). **v3.6 (P1c): `SCOOP_CONFIG.maxWidthMult` 3.0→5.0 and `maxDepth` 36→60`** (both playtest starting points — §2.14.1); no new constant, the box render derives every corner from the existing `SCOOP_WIDTH`/`SCOOP_DEPTH`/`SHIP_RADIUS`. **v3.6 (P2a): `MAGNET_DAMP` 0.06→0.35, `MAGNET_PULL_MIN` 60→150, and a new `MAGNET_FALLOFF_POW` (1.0, hoisted out of the inline `t*t`)** — all playtest knobs (§2.14); `MAGNET_RANGE`/`MAGNET_PULL` unchanged. **v3.6 (P2b): two new constants, `HUNTER_LAST_STAND_SPEED` (50) and `HUNTER_LAST_STAND_TURN` (0.5)**, sit with the Hunter block — the large core's post-clear pursuit speed/turn rate (§2.5), both deliberately below a wave-1 medium homer. **v3.6 (P3): `POWERUP_DROP_CHANCE` is DELETED** — the three drop sources (§2.14) are unconditional, so there is no longer a chance constant to tune; a new `DOCK_POWERUP_SPEED` (120) sits with the `DOCK_*` group — the recycle hub's per-visit launch speed. v3.3 (P2): a module-level **`SAT_ART`** table (just above `class DebrisSatellite`) — six authored satellite silhouettes, each `{ full, small }` arrays of `{ pts, closed }` polylines in unit space, drawn via `drawPoly` at `this.radius`; it's authored line-art data, not a balance knob (the per-instance jitter fraction is an inline look-call literal in the constructor) — see §2.4. **v3.3 (P3): the Powerups block gains** `POWERUP_DROP_WEIGHTS` (the weighted drop table `{rapid3,triple3,scoop2,magnet1,engine1}` — a **separate** structure from `POWERUP_DROP_TYPES`, the timed-effect list) and the **Scoop** group `SCOOP_MAX_LEVEL` (5), `SCOOP_WIDTH`/`SCOOP_DEPTH` (per-level mouth geometry arrays), `SCOOP_HITS_PER_LEVEL` (2), `SCOOP_MAX_BONUS` (500); `POWERUP_DROP_CHANCE` retuned 0.10→0.16 and `POWERUP_DECAY` 14→26 (both playtest knobs); new `POWERUP_COLOR.scoop`/`POWERUP_LABEL.scoop` sit with `COLOR` (see §2.14/§2.14.1). **v3.4 (P1): `HUNTER_GARBAGE` is now a per-tier table `{3:3, 2:2, 1:1}` (playtest knob), replacing the flat `HUNTER_GARBAGE = 3` + `HUNTER_SMALL_GARBAGE = 6` (both now gone — `HUNTER_SMALL_MASS` (0.5) is unchanged); `DEBRIS_GARBAGE` bumped 3→4 (playtest knob, compensating field supply — §2.4/§2.5); `DOCK_OFFLOAD_INTERVAL` (**0.05**, playtest knob) is a new named constant hoisted out of a bare literal `0.13` at its one assignment site in the dock-offload block (§2.10); `CARGO_CAP_MAX` raised **20→24** (§2.10.2) without retuning `CARGO_THRUST`/`CARGO_MAXSPD`/`CARGO_MASS`/`CHAIN_ITER` — the higher cap is deliberately heavier-handling by design, and the stability envelope was re-validated at 24 nodes rather than re-tuned (§3.4). **v3.4 (P2): the first two difficulty-lever objects — `LEVER_POWERUP_SIZE` and `LEVER_DOCK_SIZE` (both `{enabled:false, start:2.0, floor:1.0}`) — sit next to `POWERUP_RADIUS`/`DOCK_RADIUS` respectively; both ship DISABLED, so the observable effect is that powerups and the dock are simply 2× their old size. The registry lives in `DIFFICULTY-LEVERS.md`, not here (see §2.13).** **v3.4 (P3): `SCOOP_HITS_PER_LEVEL` retuned 2→5 (playtest knob — at 5 hits/level a level-5 scoop survives 25 non-lethal hits, effectively sticky once earned given `SHIP_MAX_HP` 250 / `DMG_MEDIUM` 35). `SCOOP_WIDTH`/`SCOOP_DEPTH` are no longer hand-picked literals — they're GENERATED by a new `buildScoopSteps(min, max, curve)` helper from a new `SCOOP_CONFIG` object (`maxWidthMult`/`minWidthMult`/`curve`/`minDepth`/`maxDepth`) and a new `SHIP_DRAW_W` (18, the drawn hull's width — the unit the scoop is spec'd in); the arrays keep the exact same shape (length `SCOOP_MAX_LEVEL+1`, index = level, index 0 always 0) so every reader (`inScoopBox`, `Ship.draw()`'s prong V, the HUD pip row) is unchanged. See `tools/scoop-lab.html` (§2.14.1) — the disposable design instrument that sets `SCOOP_CONFIG`'s five numbers by eye.** **v3.4 (P4): the Magnet-buff constants in the Powerups block — `MAGNET_RANGE_MULT` (the old ≈54 px multiplier) is DELETED and replaced by `MAGNET_RANGE` (**380 px**, a flat reach past `VIEW_H/2`); `MAGNET_PULL` retuned 360→**520** (px/s² at zero distance) and a new `MAGNET_PULL_MIN` (**60**, the px/s² floor at max range) give the pull a quadratic falloff; `MAGNET_PIECES` **20→40** (pieces-mode budget doubles); and a new `MAGNET_DURATION` (**30** = 2× `POWERUP_DURATION`) is the Magnet's own time-mode duration. All are playtest knobs (§2.14). `MAGNET_PICKUP_MULT`/`MAGNET_DAMP` are unchanged.** **v3.4 (P5): a new `LOW_HP_THRESHOLD` (**100**, 40% of `SHIP_MAX_HP` — a playtest knob) joins the v1.3 HP block — the HP at/below which the low-health warning (§2.12) engages; `COLOR.lowhp` (`#ff4040`) sits with `COLOR`.** **v3.5 (P3): a new low-health-VOICE knob group sits right after `LOW_HP_THRESHOLD`** — `LOWHP_ROOT_FREQ` (220), `LOWHP_HARMONIC_RATIO` (1.5), `LOWHP_HARMONIC_GAIN_FRAC` (0.35), `LOWHP_PULSE_RATE_MIN/MAX` (0.9/2.4 Hz), `LOWHP_PULSE_DEPTH` (0.5), `LOWHP_GAIN_MIN/MAX` (0.08/0.13), `LOWHP_PARAM_RAMP` (0.15 s) — all playtest knobs feeding `AudioSys.lowhp`/`lowhpSet` (§2.8). **v3.4 (P6): a "Music" block — `MUSIC_LOOKAHEAD` (0.2 s scheduler window), `MUSIC_CROSSFADE` (0.6 s), `MUSIC_FADE_OUT` (1.0 s), `MUSIC_DUCK_GAIN` (0.5), `MUSIC_DUCK_RAMP` (0.15 s), `MUSIC_A4` + the `mfreq` MIDI helper; the tracks are DATA in `MUSIC_TRACKS` (structural, not balance). The menu picker `MUSIC_TRACK_VALUES`/`MUSIC_TRACK_LABELS` + `VOL_LABELS` live in the menu section, and `settings.musicTrack` on the persisted `settings` object (see §2.8/§2.16). `MUSIC_LAYER_THRESHOLD`/`MUSIC_LAYER_CROSSFADE` (v3.4 P7) are still here but **dormant** as of v3.5's freeze — no track carries a `tier`, so the intensity gates never move.** **v3.5: the `title`/`tense`/`retro`/`ambient` builders were replaced by `buildBeaconTitle`/`buildZenTrack`/`buildDerelictTrack`/`buildDriftTrack`/`buildWarehouseTrack` (ported verbatim from `tools/music-lab.html`); `MUSIC_TRACK_VALUES` is now `["zen","derelict","drift","warehouse"]` (calm→hot), `settings.musicTrack` default `"zen"` (see §2.8/§2.16).** **v3.6 (P5): a "death spectacle" group joins the v1.3 HP block (just after `REPAIR_FULL_BONUS`)** — `DEATH_DURATION` (2.5 s), `DEATH_SHOCKWAVE_SPEED` (700 px/s — also the chain-detonation front), `DEATH_SHOCKWAVE_WIDTH` (4), `DEATH_SHAKE_INIT` (16 px)/`DEATH_SHAKE_DECAY` (24 px/s), `DEATH_FLASH_TIME` (0.22 s)/`DEATH_FLASH_ALPHA` (0.8) — all playtest knobs feeding the `dying` state (§2.7/§2.9). **CS010 (P2): the salvage/chain mass coefficients were firmed — `CARGO_THRUST` 0.06→0.07, `CARGO_MAXSPD` 0.03→0.035, `CARGO_MASS` 0.07→0.10 (all playtest knobs — §2.10.2) — a new `CARGO_TURN` (0.0, a dormant towed-mass turn-rate penalty) joins the same block, and a new rotation-speed group sits by `SHIP_TURN`: `SHIP_TURN_SCALE_MIN`/`MAX`/`STEP`/`DEFAULT` (0.5/1.5/0.10/1.0) feeding `settings.shipTurnScale` through `shipTurnRate()` (§2.16/§3.4).** **CS012 (P1): a new `SAUCER_ACCURACY_RAMP_SCALE` (0.5, playtest knob) sits beside `SAUCER_AIM_ERR_FLOOR/CEIL` in the v1.5 difficulty-ramp block — it scales only the wave ARGUMENT passed to `ramp()` for small-saucer aim error (`1 + (game.wave − 1) × SAUCER_ACCURACY_RAMP_SCALE`), not the floor/ceiling pair itself, so saucer accuracy ramps slower than (and independently of) `RAMP_WAVES` while pinning the wave-1 floor exactly (§2.13).** **CS012 (P2): a new `HUD_RING_SEG_GAP` (0.12 rad, playtest knob) sits with the `HUD_FX_*` group — the angular gap between wedges in the new `drawRingSegments` HUD primitive, used by the Scoop row (§2.14/§2.14.1). No powerup/Scoop balance constant changed — this phase is render-only (fixed row positions + the segmented ring replacing the pip dots).** **CS013 (P4): a new `AUTO_SHIELD_REGEN_PAUSE` (1.0 s, playtest knob — `≥ HIT_STUN_DURATION` guarantees no recharge sneaks in between an auto-save's i-frame ending and the next hit) sits beside `AUTO_SHIELD_SCORE_PENALTY` in the Shield block — see §2.3.** **CS015 (P4): the auto-shield regen pause is now the FIRST entry in a new **`DEBUG_VARS`** registry backing a hidden Debug Options panel (§2.19) — the `AUTO_SHIELD_REGEN_PAUSE` const stays as the shipped default (and the registry entry's `def` source), but the live value `damageShip` reads is now `DEBUG.autoShieldRegenPause`. `DEBUG_VARS`/`DEBUG`/`debugShown` + the `DEBUG_CODE`/`DEBUG_CODE_IDLE_MS`/`DebugCode` secret-entry constants sit just after the `settings` object — structural, not balance (each knob's min/max/step/default lives in its own registry entry).** **CS015 (P5): `DEBUG_VARS` grew from 1 to 5 entries — `scoopHitsPerLevel` (`SCOOP_HITS_PER_LEVEL`, §2.14.1), `garbageAttractDelay` (`GARBAGE_COALESCE_DELAY`), `garbageAttractRadius` (`GARBAGE_MAGNET_RANGE`), `garbageAttractForce` (`GARBAGE_MAGNET_PULL`, all three §2.10.1) — same registry/`toNative` idiom as P4, no panel/persistence code touched. All four consts stay in place as the documented shipped defaults; each's one consumer site now reads the live `DEBUG.*` value instead.** **CS015 (P6): `DEBUG_VARS` grew from 5 to 6 — a sixth entry, `garbageLifetime` (unit `s`, `def:10`, `min:1`, `max:60`, `step:1`, no `toNative`, §2.10.1/§2.19), whose default is NOT derived from the const it supersedes (FLAG-CS015-a: 10, not the old single-only `GARBAGE_DECAY` 22). This phase also changed behavior, not just added a knob: every `Garbage` piece (single OR clump, the `pieces === 1` gate is gone) now seeds `this.decay` from `DEBUG.garbageLifetime` at construction and ages out at 0, and `coalesceGarbage`'s merge branch resets the survivor's `decay` back to `DEBUG.garbageLifetime` (a merge counts as activity) — so an actively-growing clump never dies but a stalled one now does, reversing FORK-4's "clumps are permanent." **CS017 (P4): `DEBUG_VARS` grew from 6 to 9 — `saucerPressureSecs`/`saucerAimPressure`/`saucerGapPressure` (§2.13/§2.19), the dev-tunable ramp time and per-lever scales for the new time-in-level saucer pressure axis; none supersedes an existing const (the axis itself is new, not a repoint), so unlike every prior knob there is no def-derived-from-shipped-const story for these three.** **CS020 (P1/P1b): two new constants join the v1.1 salvage/`DOCK_*` group — `DOCK_NEIGHBORHOOD_PAD` (**40**, P1 — the px margin added to `dock.radius` marking a ship as "parked in the neighborhood" for the per-node towed/incidental capture tag) and `DOCK_COMBO_GRACE` (**4.0 s**, P1b — how long a delivery run survives outside that neighborhood before the towed-hook reset's escalating combo lapses to zero; also the source of the `DEBUG_VARS` `dockComboGrace` knob's `def`, §2.19). Both PLAYTEST KNOBS; see §2.10.**
```

---

### Cell 2 of 2 — the "Notes for modification" column, verbatim (4,288 bytes)

```text
**Change balance here first.** Never hardcode magic numbers deeper in the file. `WORLD_*` = the wrap boundary; `VIEW_*` = the screen — keep the distinction (see §2.11). **Debris density tunes from decay (`DEBUG.garbageLifetime`, the governor for every piece as of CS015 P6, live-tunable — was the frozen `GARBAGE_DECAY`, singles-only, pre-P6), coalescence (`GARBAGE_MAGNET_RANGE`, `GARBAGE_COALESCE_DELAY`, `HUNTER_COALESCE_COUNT`), the drop-volume constants, and the `nextWave` count. `garbageLifetime` must stay a wide-enough multiple of `garbageAttractDelay` or nothing clumps — tighter at the CS015 P6 defaults (10s/3s) than the old 22s/3s pairing (§2.10.1).** **Early-game pacing tunes from `RAMP_WAVES` + the saucer floor/ceiling pairs — every wave-scaled value is `ramp(floor, ceil, wave)` (§2.13).** **As of CS017 P3 there are TWO clocks and you must know which one a lever is on before retuning it: the four SAWTOOTH levers (Garbage Satellite count, Garbage Satellite speed at both sites, Hunter speed, Hunter turn rate) sample `game.cycleWave` and pass through `cycleValue(x, game.cycle)`; every FROZEN lever (the whole saucer group, and the Kessler/player-ability/economy groups) still samples the absolute `game.wave`. That asymmetry is deliberate — see §2.13 before "fixing" it.** **CS021 P1/P1b: an `ORBIT_*` block (`ORBIT_LEVEL_EVERY` with the Level Progression constants; `ORBIT_INNER_RADIUS`, `ORBIT_RADIUS_STEP`, `ORBIT_RING_COUNT`, `ORBIT_RADIUS_STEP_PAD`, `ORBIT_DENSITY[]`, `ORBIT_GAP_MULT`/`_FLOOR`/`_STEP`, `ORBIT_SAFETY_MARGIN`, `ORBIT_ANG_VEL`, `ORBIT_FAST_MULT`, `ORBIT_FAST_RING` in their own block) plus `SHIELD_BOUNCE_RESTITUTION`/`SHIELD_BOUNCE_MIN` with the shield constants — the orbit-archetype spec [RETIRED — CS024]. The radii are **fitted to this world, not derived from satellite size**: the outermost satellite edge (676 px) must stay inside the wrap-clean budget `WORLD_H/2 − 20` (~700 px), so raising the ring geometry means raising `WORLD_H`/`WORLD_W` first. Ten of these are live debug knobs whose `def`s derive from them (§2.19) — retune the const, never the `def`. CS021 P4: `HUD_COMBO_X/Y/SIZE` with the CS009 HUD knobs (§2.10).** **CS022 P1/P3: a `WORLD_SIZE_*` block joins the world-size constants (`WORLD_SIZE_FIELD` 4, `WORLD_SIZE_ORBIT` 16, `WORLD_SIZE_MAX`) — `WORLD_W`/`WORLD_H` are now `let`, set by `worldSizeFor(level)`'s archetype read rather than fixed at load (§2.11.1). `ORBIT_INNER_RADIUS`/`ORBIT_RADIUS_STEP` move to 460/276 and `ORBIT_DENSITY[3]` halves to 0.42 (the orbit-archetype spec [RETIRED — CS024]). `ORBIT_RADIUS_STEP_PAD` is RETIRED — left defined as a historical value (the `DEBRIS_COUNT_MAX` precedent, CS018 P3) with zero remaining readers now that `orbitRadiusStepFor` holds the step fixed rather than the outer edge.** **⛔ CS024 REPLACED THE WHOLE DIFFICULTY BLOCK.** Out: `levelDef`/`stepAt`/`TIER_STEPS`, `PHASE_LEN`, `LEVEL_MAX`, `JUNK_CYCLE`, `HUNTER_CAP_STEPS`, `ramp`/`difficultyFactor`/`RAMP_WAVES`, `leverScale`/`LEVER_POWERUP_SIZE`/`LEVER_DOCK_SIZE`, `SAUCER_SMALL_CHANCE_FLOOR/CEIL`, the whole `ORBIT_*` block, the bonus-Debris constants (`BONUS_CANISTER_PIECES/_SCORE`, `BONUS_SPAWN_CHANCE_EARLY/LATE`, `BONUS_RING_PAD`), `GARBAGE_DECAY`/`GARBAGE_FADE`, `POWERUP_DURATION`/`MAGNET_DURATION`, `LARGE_HUNTER_MAX`, and the dead set (`CARGO_GROW_PER`, `DEBRIS_SPEED_PER_WAVE`, `DEBRIS_COUNT_MAX/_HARD_MAX`, the `SAUCER_GAP_*`/`SAUCER_FIRE_MULT_*`/`SAUCER_AIM_ERR_*`/`SAUCER_ACCURACY_RAMP_SCALE` group, `ORBIT_RADIUS_STEP_PAD`, `GARBAGE_CLUMP_MAXSPD`). In: the **lever odometer** section — `LEVERS`, `buildLeverOrder()` (a load-time structural guard, in the style of the `SCOOP_WIDTH[0]` assertion), `LEVER_ORDER`, `leverValues(table, wave)`, `leverState(wave)` — followed by `payloadSlots(n)` (a fixed curve, marked as outside the odometer), plus `MUSIC_INTENSITY_WAVES`/`musicIntensity(wave)` (the renamed `RAMP_WAVES`/`difficultyFactor`, curve byte-identical, kept solely for the music), `GARBAGE_SOFT_MAX` (220) / `GARBAGE_HARD_MAX` (300), `HELD_CLUMP_RING_PAD` (6), `ENGINE_BURN_SECONDS` (10.0), and `FREQ_JITTER` (0.25, frozen at `jitteredInterval()`'s site). `POWERUP_RADIUS` is **30** and `DOCK_RADIUS` **88** — the retired size levers' 2×, baked in; do not restore 1×. `DEBRIS_SPEED_CAP` stays.
```

---

## GDD §3 — the rest of the Code Map (CS041 P3)

⛔ **The rule this phase actually applied** — GATE C replaced the original Lever C KEEP/MOVE rule
with a **correctness sweep**, and this is the rule as executed, amendments included:

> **REMOVE a sentence only if it is FALSE about the current build** — it names a deleted identifier
> as though live, describes machinery that no longer exists, states a tuning rule whose knobs are
> gone, or contradicts a `CLAUDE.md` ⛔/⚠ or a later GDD section.
> **KEEP everything that is merely OLD.** Narration, phase attribution, retune chains, "as of
> CSxxx" — all stay. Byte reduction is a side effect, never the goal.
> ⛔ **A statement that an identifier was DELETED is TRUE and STAYS.**
> ⛔ **Verify against the build before removing.** A hit only inside comments or string literals is
> dead.

**Three amendments the work forced, all for GATE D to rule on:**

1. **"Corrected inline" was used more than "removed", and it makes rows BIGGER.** Where a false
   claim had an obvious current-state replacement, the fix was to state the truth, not to delete
   the sentence. Five of this phase's six rows grew. §3 net: **75,608 → 75,451 bytes, −157.** That
   is the honest shape of a correctness sweep and should not be read as a failed trim.
2. **A false claim is often best fixed by extending a correction that already exists elsewhere in
   the same row**, rather than rewriting the history clause that carries it. Rows 1299, 1300 and
   1301 each already had a "CS024: … Gone: …" list that had simply been left incomplete. Extending
   that list preserves the narration AND closes the grep hole.
3. **A "Gone:" list is a grep landing pad and is load-bearing.** Row 1301's omission of `levelDef`
   and `Garbage.decay` meant a grep for either landed only on the sentence that ADDED it. Treat an
   incomplete Gone list as itself a staleness defect.

⛔ **The audit's false-positive rate for "should be removed" is very high, BY DESIGN, and GATE D
should not read that as the tool failing.** §3 went from 100 candidates to 98 across six swept rows,
because nearly every candidate sits inside a sentence that correctly says the identifier is gone.
Two false-positive classes are worth naming for later phases:

- **String-literal identifiers.** `debugOverride` is flagged, but the build holds it as
  `const DEBUG_OVERRIDE_ID = "debugOverride"` — the scanner strips string contents, so a registry
  `id` reads as dead. The §3 Benchmark row's ⛔ about it is TRUE and was kept.
- **Name collisions with unrelated locals.** `ramp` shows 4 live occurrences and the difficulty
  `ramp()` is nonetheless gone — all four are a local arrow function inside `AudioSys.lowhpSet`
  that ramps a Web Audio param. This cuts the other way: an identifier can be dead *despite* live
  hits. Never trust the count alone; read the site.

⛔ **The audit cannot see prose-level staleness.** Seven §3 rows (Canvas/scaling, AudioSys, MusicSys,
VoiceSys, Input, Chain physics, Main loop) carry zero candidates and were therefore not swept. That
is not a clean bill of health — it means nothing in them names a dead identifier.

### Row-by-row

| row | before | after | what happened |
|---|---|---|---|
| **Helpers** | 2,915 | 1,497 | the only large removal — five paragraphs specifying deleted helpers |
| **Entity classes** | 7,603 | 7,702 | one correction: `drawBonusRing` & friends named in the CS024 loss list |
| **game object** | 6,982 | 7,597 | three corrections: the decay clock, `commitEntry`, the CS017 cycle clock |
| **Flow functions** | 11,815 | 12,006 | two: the decay claim, and three names missing from "Gone:" |
| **Menu / Options / Rebinding** | 10,008 | 10,304 | one: `DIFFICULTY_ROWS` and the two deleted expiry toggles |
| **update(dt)** | 4,096 | 4,156 | four: decay, `powerFx`, `ramp(...)`, the whole bonus-Debris pickup block |

⛔ §3's ⛔ count went **13 → 22** — nine new standing prohibitions, all of the form "X is GONE, do
not reintroduce it". ⚠ unchanged at 1. **No marker was removed.**

### The cuts, verbatim


#### Row: **Helpers**

**Why:** Contents column listed difficultyFactor/ramp/leverScale/wavePressure as live helpers; the row's OWN Notes column ends by declaring all four GONE (CS024 P4). Zero live occurrences in the build.

```text
- `rand`, `randSign`, **`difficultyFactor`/`ramp`** (v1.5), **`leverScale`** (v3.4 P2), **`wavePressure`** (CS017 P4), `wrap`
```

```text
+ `rand`, `randSign`, `wrap`
```

**Why:** CORRECTED INLINE, not cut: the constant is live (2 occurrences) but its stated purpose is gone. The build says so at its definition — 'All gone. COLOR.garbageBonus SURVIVES — the debug panel's uncommitted-entry tint reads it.'

```text
- CS017 P5 adds **`garbageBonus`** `#ffe23a`, the rare bonus Debris's hot-yellow tell, deliberately kept in the salvage hue family so it never reads as a hazard — §2.10)
```

```text
+ **`garbageBonus`** `#ffe23a` was CS017 P5's bonus-Debris tell and SURVIVES that feature's CS024 P3 removal as the debug panel's uncommitted-entry tint — §2.19)
```

**Why:** Five paragraphs specifying deleted helpers (difficultyFactor, ramp, leverScale, cycleValue, wavePressure, bonusSpawnChance) — all zero live occurrences. The first actively instructed 'use these for any new wave-scaled value', which is now the wrong instruction, not merely an old one.

```text
-  **`difficultyFactor(wave)`** = `1−e^(−(wave−1)/RAMP_WAVES)` (0→1 ramp); **`ramp(floor, ceil, wave)`** interpolates any threat parameter through it — use these for any new wave-scaled value (§2.13). **`leverScale(lever, wave)`** (v3.4 P2) wraps `ramp` for a **difficulty lever** `{enabled, start, floor}` — pinned at `start` when disabled, else ramps `start`→`floor` (clamped, never below `floor`); see §2.13 and `DIFFICULTY-LEVERS.md`. **`cycleValue(base, cycle)`** (CS017 P1, beside `leverScale`) = `base × (1 + cycle × CYCLE_GAIN)` — the FORK-CS017-A spiral term; unused this phase, wired by P3 (§2.13). **`wavePressure()`** (CS017 P4, beside `difficultyFactor`) = `min(1, game.waveTime / DEBUG.saucerPressureSecs)` — the FORK-CS017-B time-in-level pressure term, `0` at a level's start rising to `1`; composes on top of (never replaces) a lever's wave-based `ramp()` value at the two frozen saucer sites (§2.13). **`bonusSpawnChance()`** (CS017 P5, directly after `cycleValue`) returns the bonus Debris's per-wave spawn probability, easing `BONUS_SPAWN_CHANCE_EARLY` → `BONUS_SPAWN_CHANCE_LATE` **linearly** across `game.cycleWave` (§2.10). It is the one lever that deliberately does **not** ramp on `difficultyFactor` — its two constants are defined as the cycle's exact endpoints and the shipped curve is asymptotic, so a `ramp()` version would never reach the value `BONUS_SPAWN_CHANCE_LATE` claims to be; the deviation is argued at the function and registered in `DIFFICULTY-LEVERS.md` §2.6.
```

```text
+ (removed outright)
```

**Why:** KEPT AND EXTENDED, not cut: the ⛔ is true and protective. Extended to name cycleValue/bonusSpawnChance, which were gone but unlisted, and to carry the instruction the deleted difficultyFactor paragraph used to give.

```text
- **⛔ CS024 P4: `difficultyFactor`, `ramp`, `leverScale` and `wavePressure` are GONE.** The curve survives only as `musicIntensity(wave)` (up in the odometer block, not here), and nothing else interpolates on a wave-driven curve any more — every scaling quantity reads `liveLevers(game.wave)` at the point of use.
```

```text
+ **⛔ CS024 P4: `difficultyFactor`, `ramp`, `leverScale` and `wavePressure` are GONE**, as are CS017's `cycleValue` and CS017 P5's `bonusSpawnChance` (retired with the bonus Debris, CS024 P3). The curve survives only as `musicIntensity(wave)` (up in the odometer block, not here), and nothing else interpolates on a wave-driven curve any more — every scaling quantity reads `liveLevers(game.wave)` at the point of use. **⛔ A new wave-scaled value is a LEVER, never a reintroduced ramp helper** (§2.13, `DIFFICULTY-LEVERS.md`).
```


#### Row: **Entity classes**

**Why:** KEPT the CS017 P5 paragraph (true history) but extended the CS024 correction: it said Garbage 'loses bonus' without naming drawBonusRing/BONUS_RING_PAD/BONUS_CANISTER_*, so a grep for drawBonusRing landed ONLY on the sentence that says it was added. That silence is what the retired-name rule exists to prevent.

```text
- `Garbage` loses `decay` and `bonus` and both blink-out render branches, and
```

```text
+ `Garbage` loses `decay` and `bonus` — and with `bonus`, `drawBonusRing()`, `BONUS_RING_PAD` and `BONUS_CANISTER_PIECES`/`_SCORE` — and both blink-out render branches, and
```


#### Row: **game object**

**Why:** The v3.3 P4 clause states 'a single carries a `decay` clock again (`GARBAGE_DECAY`, singles only)' as current; CS024 P3 deleted decay outright (0 live occurrences) and the row's own CS024 list did not mention it. Corrected by extending the existing CS024 list rather than rewriting the history clause.

```text
- **CS024:** out — `game.orbitLayout`, `game.hunterTimer`, `game.powerFx`.
```

```text
+ **CS024:** out — `game.orbitLayout`, `game.hunterTimer`, `game.powerFx`, and (P3) the `Garbage.decay` clock, `GARBAGE_DECAY` and `game.stats.garbageDecayed`'s successor machinery — **loose Debris is permanent**, so the v3.3 P4 sentence above is history, not the current shape (§2.10.1).
```

**Why:** `commitEntry` has zero occurrences anywhere in the build. CS034 P7 replaced the initials-entry commit with a direct write at the seam (build line 11680: `game.lastScoreId = HighScores.add(run).id`). The sentence named a function that no longer exists as the live write path.

```text
- armed/cleared at the `dying → gameover` seam and in `commitEntry` (§2.18).
```

```text
+ armed/cleared at the `dying → gameover` seam, where `HighScores.add(run).id` sets it (§2.18). **⛔ `commitEntry` is GONE — CS034 P7 deleted the initials-entry flow outright**, so gameover has no input mode of its own (§2.9).
```

**Why:** 'CS017 P1 adds cycle/cycleWave/waveTime — the difficulty cycle clock' stood with no removal note anywhere in the row. cycle/cycleWave have zero live occurrences; the build's own comment says they were 'retired outright (FORK-CS018-A)'. Left uncorrected this contradicted CLAUDE.md's ⛔ one-clock invariant, the same defect P2 found in the Constants row.

```text
- All three are inert this phase — no lever reads them yet.**
```

```text
+ All three were inert at that phase. **⛔ `cycle` and `cycleWave` are GONE — CS018 P4 retired the cycle clock (FORK-CS018-A) and CS024 P4's odometer replaced its replacement; only `waveTime` survives.** `CLAUDE.md` pins the rule this leaves behind: ONE clock, `game.wave`, no parallel clocks (§2.13).**
```


#### Row: **Flow functions**

**Why:** Present-tense 'a single NOW decays via GARBAGE_DECAY' — deleted CS024 P3, zero live occurrences, and the row's own CS024 'Gone:' list did not cover it. This is the third row in §3 to state the retired decay clock as live (Constants row at P2, game object, here).

```text
- and a single now decays via `GARBAGE_DECAY` in `Garbage.update()` (§2.5.1/§2.10).
```

```text
+ and a single decayed via `GARBAGE_DECAY` in `Garbage.update()` — **⛔ deleted by CS024 P3; loose Debris is permanent and `Garbage.update()` counts nothing down** (§2.5.1/§2.10.1).
```

**Why:** The 'Gone:' list is this row's grep landing pad and omitted three names the same changeset deleted. levelDef appeared only under '[RETIRED — CS024]' phrasing about its archetype COLUMN, which does not tell a reader the function itself is gone.

```text
- `activeRingsFor`, `maxOrbitSpeed`, `updateDebrisDrift`, `bonusSpawnChance`, `HunterSatellite.spawnCore`, `powerMode`, `powerDuration`.
```

```text
+ `activeRingsFor`, `maxOrbitSpeed`, `updateDebrisDrift`, `bonusSpawnChance`, `HunterSatellite.spawnCore`, `powerMode`, `powerDuration`, `levelDef` (with the whole level table — P4), and `Garbage.decay`/`GARBAGE_DECAY` (P3).
```


#### Row: **Menu / Options / Rebinding**

**Why:** CORRECTED INLINE: present-tense 'persists' was false (CS024 P6 deleted both settings; build says 'shotPowerupMode / magnetMode / chainGuardMode STOOD HERE'), and the row went on to give DIFFICULTY_ROWS as ["shot","magnet","autoshield","back"] with no correction anywhere. Live value is ["autoshield", "back"]. History sentences kept; only the tense fixed and the supersession stated.

```text
- with the two powerup-expiry toggles; `settings {shotPowerupMode,magnetMode}` persists into `afd_settings_v1` (§2.14/§2.16).
```

```text
+ with the two powerup-expiry toggles; `settings {shotPowerupMode,magnetMode}` persisted into `afd_settings_v1` (§2.14/§2.16). **⛔ CS024 P6 made every powerup count-based and DELETED both toggles — `shotPowerupMode`/`magnetMode`/`chainGuardMode` are gone from `settings`, and `DIFFICULTY_ROWS` is now `["autoshield", "back"]`, so the four-entry array in the next sentence is history, not the current shape** (§2.14).
```


#### Row: **update(dt)**

**Why:** Two false claims in one clause: `Garbage.update()` counts down GARBAGE_DECAY (deleted CS024 P3) and a `powerFx` countdown step (deleted CS024 P6). Both zero live occurrences; `powerBudget` is live with 28. Row 1300 already carried the powerFx removal, so update(dt) contradicted the game-object row.

```text
- also the pickup pass above now **scoops** `pieces > 1` clumps, and `Garbage.update()` counts down `GARBAGE_DECAY` for singles) → **powerup pickup + `powerFx` countdown** (v1.7)
```

```text
+ also the pickup pass above now **scoops** `pieces > 1` clumps; **⛔ CS024 P3 then deleted `Garbage.decay`/`GARBAGE_DECAY` — loose Debris is permanent and nothing counts down here**, §2.10.1) → **powerup pickup + `powerBudget` decrement** (v1.7; **⛔ `powerFx` is GONE — CS024 P6 made every effect count-based**, §2.14)
```

**Why:** 'now sets ... via ramp(...)' — the difficulty ramp() was deleted CS024 P4. NOTE THE TRAP: `ramp` shows 4 live occurrences, but all four are a local arrow function inside AudioSys.lowhpSet that ramps a Web Audio param. Name collision, not survival — checked before cutting.

```text
- The **saucer spawn block** now sets the next gap and the small/big roll via `ramp(...)` off `game.wave` (v1.5/F10 — §2.6, §2.13).
```

```text
+ The **saucer spawn block** sets the next gap and the small/big roll off `game.wave` (v1.5/F10 — §2.6, §2.13); **⛔ it reads `liveLevers(game.wave)` now, NOT `ramp(...)` — CS024 P4 deleted `ramp` (§2.13).**
```

**Why:** A full paragraph specifying a pickup-pass branch that no longer exists. `bonus` and BONUS_CANISTER_SCORE have zero live occurrences; the build's tombstone at line 12103 quotes the exact deleted line. Replaced by a one-line 'gone' note rather than silence, so a future grep still lands.

```text
-  **CS017 P5: the pickup pass gained ONE block and no restructuring** — a `if (g.bonus)` payout at the top of the capture branch, above the single/clump split (so both paths trip it) and inside the capture gate (so only a real scoop counts): it clears the flag, calls `addScore(BONUS_CANISTER_SCORE)` and pushes a `FloatText`. The `take = min(room, g.pieces)` clump-intake loop below it is **unchanged** — a bonus piece of Debris is an ordinary multi-piece `Garbage` and needs no new intake (§2.10).
```

```text
+  **⛔ CS017 P5's `if (g.bonus)` payout block is GONE** — CS024 P3 removed the bonus Debris entirely, taking `Garbage.bonus`, `BONUS_CANISTER_SCORE` and this pickup-pass branch with it; the build carries a tombstone at the old site. The `take = min(room, g.pieces)` clump-intake loop is unchanged and was never part of it (§2.10).
```

---

## GDD §2 — the CS024 / CS038 / CS040 fallout (CS041 P4)

⛔ **The rule, as GATE D ratified it** (unchanged from P3's header above; all three amendments
approved as written): remove only what is FALSE about the current build, keep what is merely OLD, a
statement that an identifier was DELETED is TRUE and stays, verify against the build before touching
anything — and, per the amendments, prefer **correcting inline** over removing, prefer **extending an
existing "Gone:" list** over rewriting the history clause that carries it, and treat an **incomplete
"Gone:" list as itself a defect**.

**The shape of this phase: 105 candidates across twelve sections, 9 false claims, 9 corrections, 0
removals.** Every one of the nine was fixed in place. Nothing was deleted from §2 this phase, so
this file records **replaced** text rather than cut text — each entry gives the exact string that
left the GDD and what replaced it. The twelve swept sections grew 183,573 → 185,626 bytes
(**+2,053**) across **9 changed lines**, and the whole-file delta is the same +2,053 — so every byte
of change is inside the swept sections and nothing else moved. That growth is the correct shape for
a correctness sweep and is not a failed trim.

**Two sections came back CLEAN.** §2.7 (4 candidates) and §2.10.2 (1) hold no false claim at all —
every candidate sits inside a sentence that correctly says the identifier is gone. §2.7 is the
notable one: it is the section CS040 P1/P2 rewrote, and it is accurate down to the numbers.

### New false-positive classes found (for P5, and for anyone re-running the audit)

P3 documented two (string-literal ids; name collisions with unrelated locals). This phase adds
three more, all of which produced candidates that must never be acted on:

1. **Ids synthesized by concatenation.** `coalescePauseFloor`/`Ceil`/`Steps` are real, live registry
   ids that appear nowhere as a literal token — `leverKnob()` builds them as `id + "Floor"`. Every
   lever's three rows are invisible to the scanner. **Eighteen levers × 3 = 54 registry ids in this
   class.**
2. **Metasyntactic placeholders.** `` `<leverId>Floor` `` and `` `{ leverId: number }` `` are prose
   variables, not identifiers.
3. **Glob and slash notation.** `` `DEBUG_ROW*` ``, `` `ufoFireFreq*` ``, `` `POWERUP_HEALTH_MIN/MAX_DIST` ``
   tokenize into fragments (`DEBUG_ROW`, `ufoFireFreq`, `MAX_DIST`) that are dead as written while the
   full names are live. ⚠ This phase's own corrections **added four instances** of this class
   (`HEALTH_GAP_LOW_OK`/`HIGH_OK`/`LOW_HURT`/`HIGH_HURT`, `DELIVERY_FLOAT_RISE`/`_SIZE`/…,
   `HUNTER_PULSE_*`) because slash-globbing is the GDD's house style and matching it was the right
   call — so §2.14's candidate count went **up**, 15 → 19, on a phase that made §2.14 more accurate.
   ⛔ **A gate reading that number as a regression will be reading it wrong.**

### §2.19 Debug Options — 32 candidates, 2 false claims

**(1) `clampShown`'s carrier count, verbatim:**

```text
Exactly one entry carries it (`orbitCount`, below); the other 43 are byte-unchanged by its addition.
```

FALSE two ways, and misleading in a third. `orbitCount` went with the ORBIT section at CS024 P1
(§2.19's own bullet says so, twelve lines further down — the row it points at with "below" does not
exist); 43 was CS021's registry size and the registry is 110; and the present-tense "exactly one"
frames a standing mechanism as a one-off curiosity. **Verified:** `clampShown` has 9 live
occurrences, and `leverKnob()` emits it on every lever's `Steps` row — plus `hunterCapMax`,
`hunterCapLevelsPerStep`, `heldClumpMax` and three of the four BENCHMARK controls. Replaced with a
rule-shaped statement (any integer-valued row) rather than a fresh inventory, which is what went
stale the first time.

**(2) A dead exemplar cited as live, verbatim:**

```text
Same `unit:"ms"` + `toNative` idiom as `autoShieldRegenPause`/`garbageAttractDelay`:
```

`garbageAttractDelay` was removed by CS024 P5 — §2.19 says so in two other places. The other
exemplar, `autoShieldRegenPause`, is live (1 hit) and was kept. Surgical: the dead half dropped.

**Kept, all TRUE and protective:** the `[RETIRED CS024 P3]` Debris-lifetime bullet, the
`[RETIRED CS018 P7]` saucer-pressure bullet, the `[RETIRED CS024 P1]` ORBIT bullet, the CS024
rebuild's "Gone:" list, CS038 P5's twelve-knob retirement sentence, `levelEndHold`'s retirement,
`chainGuardTime`'s deletion, and the closing Structure line's whole `are all deleted` clause.
`debugOverride` is P3's string-literal class (`const DEBUG_OVERRIDE_ID = "debugOverride"`).

### §2.13 Level Progression — 13 candidates, 1 false claim

**Verbatim:**

```text
`junkCount → speedLarge → speedMedium → speedSmall` would not move small-satellite speed until roughly level 96.
```

The JUNK chain's dependents are `junkSpeedLarge`/`junkSpeedMedium`/`junkSpeedSmall` — named
correctly in the very next bullet, so the section disagreed with itself and neither `speedLarge` nor
its siblings would ever be found by a grep. Corrected to the real ids (3 live hits each). The
counterfactual it illustrates is untouched.

**Verified and kept:** `**There is no `LEVEL_MAX`**` — the audit flagging a sentence whose entire job
is to say the identifier does not exist. `` `{ leverId: number }` `` is class 2 above. The whole
`[RETIRED CS024 P4]` bullet (`levelDef`, `LEVEL_MAX`, `JUNK_CYCLE`, `HUNTER_CAP_STEPS`, `RAMP_WAVES`,
`difficultyFactor`, `leverScale`) is protective. **`Seven levers are INVERTED` was re-derived against
the live table and is exactly right** — 7 of 18, and the named seven are the seven.

### §2.14 Powerups (+ .1, .2) — 19 candidates, 2 false claims, both `POWERUP_HEALTH_GAP`

The constant is **ABSENT from the build entirely** — 0 occurrences, comments and strings included —
deleted by CS040 P2 in favour of `healthGapRoll()`. It survived in two places in §2.14:

**(1) The Health bullet, verbatim:**

```text
**Health** spawns *ambiently* on a saucer-like timer (`POWERUP_HEALTH_GAP` = 18–26 s between spawns), one at a time
```

**(2) The Structure line, listing it among live tuning constants, verbatim:**

```text
`POWERUP_HEALTH_GAP`, `POWERUP_HEALTH_AMOUNT`, `POWERUP_HEALTH_MIN/MAX_DIST`,
```

Both corrected against the live `healthGapRoll()` (3 hits) and the four `HEALTH_GAP_*` constants
(2 hits each), with the numbers taken from §2.7's own already-correct account of the same mechanism
rather than re-derived. Per amendment 2, the Structure line's fix **extended its existing
`POWERUP_DROP_CHANCE is gone` clause** rather than opening a new one, so a grep for
`POWERUP_HEALTH_GAP` still lands somewhere that explains it.

**Kept:** `⛔ EVERY EFFECT IS COUNT-BASED. TIMED EXPIRY IS GONE (CS024 P6)` and its deletion list
(`powerMode`, `powerDuration`, `game.powerFx`, `POWERUP_DURATION`, `MAGNET_DURATION`,
`DEBUG.chainGuardTime`); the three orphaned settings keys; `MAGNET_RANGE_MULT` as the replaced
constant; `leverScale`'s deletion. §2.14.1's `SCOOP_MAGNET_*` bullet correctly records CS025 P3
shipping them and CS025 P5 backing them out. §2.14.2's `chainGuardTime`/`chainGuardMode` are both
explicit deletion statements.

### §2.10 Salvage / Tow Chain / Dock (+ .1, .2) — 18 candidates, 1 false claim

**Verbatim:**

```text
- **Rise, hold and fade (CS034 P8 split; CS035 P1 retune).** `DEBUG.deliveryFloatRise` is **150 px/s**;
```

CS038 P5 retired all six `deliveryFloat*` rows off the debug registry to plain constants. **Verified:
values are byte-identical** (`DELIVERY_FLOAT_RISE = 150`, `_HOLD = 0.00`, `_FADE = 1.20`) — only the
home moved, so the numbers in the bullet were right and were kept. Corrected the `DEBUG.` prefix and
added a ⛔ naming all six retired row names, so a grep for `deliveryFloatHold` still lands.
`deliveryFloatLife`'s CS034 P8 retirement clause was already there and correct; it stays.

**Kept:** `⛔ NO DEBRIS EVER AGES OUT (CS024 P3)` and its four-name deletion list; both `leverScale`
bullets (§2.10's `⛔ Dock size … do not "restore" 44` is one of the densest protective passages in
the file); `HUD_COMBO_X/Y/SIZE are gone with it`; `DELIVERY_FLOAT_DY` in a "Through CS026" past-tense
clause. §2.10.1's two `bornOfScrap` mentions are both explicit history-of-a-deleted-flag — the second
one is *about* why the flag was a worse idea than the ceiling that replaced it. §2.10.2's `LEVEL_MAX`
says the clamp "went with the table."

### §2.5 Hunter Satellites (+ .1) — 15 candidates, 1 false claim

**Verbatim:**

```text
While volatile, `this.pulseScale` (init 100) grows at `DEBUG.hunterPulseGrow` (**900 %/s**, CS036 P4, bound raised 300→5000) and shrinks at `DEBUG.hunterPulseShrink` (**20 %/s**), clamped at `DEBUG.hunterPulseMin`/`hunterPulseMax` (**80 / 150 %**, CS036 P4, was 87/125) and flipping direction on each clamp
```

Same CS038 P5 retirement, other half. **Verified byte-identical values** (`HUNTER_PULSE_MIN = 80`,
`MAX = 150`, `GROW = 900`, `SHRINK = 20`). Corrected to the constants; the `bound raised 300→5000`
parenthetical went with the fix, because it describes a **registry row's `max`** and there is no
registry row any more — that is a fact about a panel that no longer has this knob, not a fact about
the pulse. The CS036 P4 retune attribution and the `was 87/125` history both stay.

⚠ **Consequence outside this file, flagged not fixed:** `STATUS.md`'s open playtest ask **H6/H10/H11**
tells Paul to "clear the debug overrides first, then ask for numbers — `hunterPulseMin`/`Max`/`Grow`/
`Shrink` for the heartbeat." Those four rows have not existed since CS038 P5, so that half of the
instruction cannot be followed. The *question* (does the heartbeat read right?) is still live.

**Kept:** `spawnCore()`/`game.hunterTimer` "removed outright"; `HUNTER_CAP_STEPS` and
`LARGE_HUNTER_MAX = 100` as the two things `largeHunterCap()` replaced; `HUNTER_SMALL_GARBAGE` as the
flat constant the per-tier table replaced; `spawnCore()` "died in CS024 P3". §2.5.1's
`GARBAGE_COALESCE_DELAY`/`garbageAttractDelay` are named as what `coalescePause` replaced;
`makeClumpHull` and `COLOR.clumpHot`/`lerpColor` are all inside explicit "deleted entirely" clauses.

### §2.12 Health, Damage & Knockback — 4 candidates, 2 false claims

**(1) A deleted palette entry named as a live comparand, verbatim:**

```text
(`COLOR.lowhp` = `#ff4040`, distinct from `COLOR.hp`, `COLOR.clumpHot`, and the low-HP bar fill `#ff7060`)
```

`clumpHot` is **ABSENT** (0 occurrences, comments included) — deleted v3.6 P1a, as §2.5.1 says at
length. Corrected to name the two live comparands and record the third as deleted, so the name stays
greppable.

**(2) ⛔ THE MOST CONSEQUENTIAL FIND OF THE PHASE — an OPEN flag whose premise CS040 P2 silently
invalidated. Verbatim:**

```text
  - **FLAG-8a (open, deliberate — sharper as of v3.5 P3):** `POWERUP_HEALTH_GAP` (18–26 s ambient spawn cadence) was **not** shortened and no force-spawn was added for this warning. A player can sit in the low-health state with the alarm running and nothing on the field to point at for up to 26 s. The v3.5 P3 urgency scaling mitigates this somewhat, but a louder/more urgent alarm with nothing to point at near the end of that window is a sharper version of the same gap — still left open pending playtest, not force-fixed here.
```

Half of this flag stopped being true at CS040 P2 and nobody noticed, because the changeset that
broke it was rewriting §2.7 and §2.14, not §2.12. The flat 18–26 s roll is gone; `healthGapRoll()`
reads hull. **Derived against the live build:** at `LOW_HP_THRESHOLD` (100 of `SHIP_MAX_HP` 250 =
0.4 hull) the gap rolls **12.4–18.0 s** — `lo = 6 + (22−6)×0.4`, `hi = 10 + (30−10)×0.4` — tightening
toward **6–10 s** at zero hull. So "was not shortened" is false, and the stated worst case of 26 s
is roughly a third too pessimistic exactly where the flag applies.

⛔ **The flag was NARROWED, not closed, and this was a deliberate call.** Its other half is still
true — no force-spawn exists — the wait is still real, and the shortening arrived as a side effect
of a healing rework that was never validated against this warning. Closing it on the strength of a
number nobody playtested would be the sweep overreaching. The corrected text says all of that.

**Kept:** the `⛔ REPAIR_AMOUNT/REPAIR_FULL_BONUS are DELETED (CS040 P1), not parked` line, which
restates a CLAUDE.md ⛔ verbatim and is the single most protective sentence among this phase's
candidates.

---

## GDD §2 remainder + §3.1–§3.4 (CS041 P5)

Same rule, same three GATE-D-ratified amendments as P4 above.

**Shape: 41 candidates across fifteen sections, 7 false claims, 7 corrections, 0 removals.** The
swept sections grew 199,349 → 200,932 bytes (**+1,583**) across 9 changed lines; whole-file delta is
the same +1,583, so nothing outside them moved. **Nine of the fifteen sections came back clean**:
§2.4, §2.6, §2.9, §2.11.1, §2.16, §2.18, §2.20.1, §2.23, §3.4.

⛔ **§3 proper (the Code Architecture Map's rows, L1294–L1303) was P3's and was NOT re-swept.** Its
surviving candidates are accounted for in the audit below; one of them is flagged for a future pass.

### §2.8 Audio — 6 candidates, 1 false claim

```text
`scheduleStep` clamps a note's start to `max(stepTime, currentTime)` so a stalled frame can never schedule into the past.
```

The clamp is right; the identifier is not. The live code is `scheduleStep(step, tStep)` clamping
`Math.max(tStep, AudioSys.ctx.currentTime)` — there is no `stepTime` anywhere in the build (0
occurrences, comments included). ⚠ **Borderline, corrected deliberately:** the *semantics* were
never wrong, so this is a grep-landing-pad fix (amendment 3) rather than a falsehood fix — and it
matters more than usual here because CLAUDE.md pins `scheduleStep()` as **not to be modified**, so
its description is the only thing a session is allowed to work from.

**Kept:** `setInterval` inside the ⛔ **prohibition** "No `setTimeout`/`setInterval` for note timing,
ever" — ⛔ **a new false-positive class: an API named in order to FORBID it.** `difficultyFactor` is
named as the pre-CS024-P4 name of `musicIntensity`. `padRoot`/`padThird` are `name:"padRoot"` string
keys in the `derelict` track data — P3's string-literal class — and the GDD's claim about them
(detuned sawtooths) is verified correct against `type:"sawtooth", detune:12`. `game.powerFx` at L242
is named as **deleted**, which is the exact opposite of §3.3's use of the same identifier below.

### §2.17 Achievements — 2 candidates, 1 false claim, and **FLAG-CS041-d is RESOLVED**

```text
the pool index is **`(isoYear × 52 + isoWeek) % 16`** and the active set is the 5 consecutive pool entries from that index, **wrapping** around the 16.
```

⛔ **STATUS.md's FLAG-CS041-d asked which of the GDD (`% 16`) and the build's line-99 comment
(`% 15`) was right. Answer: NEITHER IS THE MECHANISM.** The live code is

```js
poolIndex(year, week) { return ((year * 52 + week) % this.WEEKLY.length + this.WEEKLY.length) % this.WEEKLY.length; }
```

— the modulus is **derived from `WEEKLY.length`**, never a literal, and it carries a `(x % n + n) % n`
negative guard the GDD omitted. **`WEEKLY.length` counted from the live table = 16**, and
`scratchpad/test-f9.js:111` pins it (`WEEKLY.length === 16`). So the GDD's *number* was right, its
*structure* was wrong, and the difference is load-bearing: a 17th weekly achievement re-indexes every
week automatically, with no constant to bump. Corrected to name `WEEKLY.length` so the disagreement
cannot recur.

⛔ **Two stale comments confirmed and NOT fixed — both out of scope, both worth a future one-liner.**
(1) `orbital-overhaul.html:99` says `% 15`: a **build edit**, forbidden all changeset. (2)
`scratchpad/test-f9.js:11`'s header comment also says `% 15` — a **test edit**, and this phase
touches no test file. Neither is an assertion; `test-f9.js`'s actual assertions at lines 111/155/162
all correctly use 16.

**Kept:** `colW` at L632 — present in the build only in two comments, and the GDD names it while
describing the **pre-CS015-P2 layout bug that was fixed**, which is the same thing the build's own
comment at line 13719 does.

### §2.20 Achievement Celebration Panel — 2 candidates, 1 false claim

```text
  `celebrationScrollStep` (px per up/down press, default 60) and `celebrationEmblemSize` (emblem
  radius px, default 32).
```

Introduced by the words "Two `DEBUG_VARS` knobs:". **CS038 P5 retired both to plain constants** —
`CELEB_SCROLL_STEP = 60`, `CELEB_EMBLEM_SIZE = 32`, values unchanged. This is the **third and last**
of the twelve-knob CS038 P5 cluster STATUS.md predicted; P4 corrected the other two (§2.10's six
`deliveryFloat*`, §2.5's four `hunterPulse*`). All twelve are now accounted for in the GDD.

### §3.1 Collision conventions — 2 candidates, 1 false claim

```text
- **Unshielded contact/bullet hits call `damageShip(amount, hazardX, hazardY)`** (v1.3)
```

The live signature is `damageShip(amount, srcX, srcY, srcTag)`. Both position names were wrong **and
a fourth parameter was missing** — `srcTag` (CS037 P1), one of ten source-attribution keys,
observational only, stamped on the non-lethal branch. ⛔ **This is a "read before wiring a new
hazard" section and CLAUDE.md's New-enemies rule sends you here**, so a wrong call signature is the
most directly actionable falsehood found in either sweep phase. Corrected to the real signature with
`srcTag`'s contract named.

### §3.2 Rendering conventions — 2 candidates, 2 false claims

⚠ **This line carries a literal test pin (`plus two deliberate exceptions` / never "three"). Both
corrections were written to leave the count at two, and the pin was re-checked after.**

**(1) The low-health glow's geometry, verbatim:**

```text
**(2, CS010 P3)** The **low-health corner glow** (§2.12) — four `createRadialGradient` corner fills in `COLOR.lowhp`, drawn first inside `drawHUD()`,
```

`createRadialGradient` is **ABSENT from the build** (0 occurrences). **CS038 GATE A replaced the four
radial corner fills with four `createLinearGradient` bands**, one inward from each edge, overlapping
at the corners under source-over — and CLAUDE.md carries that as a ⚠ SETTLED with the fill exception
and the no-`shadowBlur`/no-`globalAlpha` contract explicitly carried over. The GDD had not caught up.
Corrected, with the old shape recorded so the change is greppable.

**(2) A justification resting on a deleted feature and a deleted test file, verbatim:**

```text
**CS017 P5's bonus-Debris tell adds NO new exception — the count stays at two:** the tell is a colour swap (`COLOR.garbageBonus` passed into the existing `drawCanister()`) plus `Garbage.drawBonusRing()`, a full-turn `drawRingArc()` — i.e. a stroked `ctx.arc` through `glowStroke`, the same primitive the HUD gauges use, with no `closePath()` and no fill. Asserted in `scratchpad/test-cs017-p5.js` section (G): a recording canvas proxy counts every method the real `Garbage.draw()` calls, on all four branches (bonus/plain × clump/single), and `fill`/`fillRect`/`fillText`/`rect` appear in none of them.
```

Three separate problems. The **bonus-Debris feature was deleted at CS024 P4**; `Garbage.drawBonusRing()`
went with it; and ⛔ **the cited test file `scratchpad/test-cs017-p5.js` DOES NOT EXIST** — the
clause's entire evidentiary basis is a dangling reference. The *conclusion* (the count is two) is
still true and is what the pin protects, so it was preserved while the reasoning was rewritten.

⛔ **One live detail rescued in the process: `COLOR.garbageBonus` SURVIVES the feature's deletion** —
the build's own comment at line 601 says "All gone. COLOR.garbageBonus SURVIVES — the debug panel's
uncommitted-entry tint reads it." It is now that tint's only reader. Recorded in the GDD so a future
orphan-hunting pass does not delete it.

**A systematic check, run because of this find:** every `scratchpad/*.js` citation in the whole GDD
was tested for existence. **7 distinct cited test files exist; this was the only dangling one.** Not
a systemic problem.

### §3.3 Known safe extension points — 1 candidate, 1 false claim

```text
*v1.7 (F6) is the worked example:* weapon caps flow through `maxBullets()` (not the raw `MAX_BULLETS`) and Triple Shot's spread lives in the fire block; timed effects live in `game.powerFx` and count down in `update()`;
```

⛔ **The single most actively harmful sentence found in either phase.** §3.3's entire job is to tell a
future session how to add a thing safely, and this told it to put a new effect on `game.powerFx` —
a field **deleted at CS024 P6**, against a CLAUDE.md ⛔ that reads *"Ask 'did an effect end?' through
`powerActive(type)`, never `powerFx`."* A session following §3.3 literally would have written the one
thing CLAUDE.md forbids by name. Corrected to the count-based contract
(`game.powerBudget[type]` + `powerActive(type)`).

**`maxBullets()`/`MAX_BULLETS` in the same sentence were verified live and correct** and were kept —
the sentence was half right, which is exactly why it survived four changesets.

### Borderline calls — two false-ish claims deliberately LEFT

Both are **dated changelog clauses whose correction already exists, prominently, in the same
section** — amendment 2 says extend an existing correction rather than rewrite the history clause,
and here the correction is already written, so the right action is none.

1. **§2.11 L367** — `> New tuning constants live in the "Larger world & scrolling camera" block …
   v2.1 adds `BOUNDARY_DASH`/`BOUNDARY_GAP`/`BOUNDARY_WIDTH`/`BOUNDARY_GLOW` to the same block.` The
   four are deleted — and L347, twenty lines above in the same section, is a whole bullet titled
   **"World-boundary line (v2.1) — removed (v3.6 P1b)"** naming all four as gone.
2. **§2.16 L585** — `v3.0 P5 adds … the persisted `settings` object `{shotPowerupMode, magnetMode}`.`
   Both keys are orphaned — and L545 carries a ⛔ **"CS024 P6 ORPHANED THREE KEYS AND DID NOT REMOVE
   THEM"** naming all three.

⚠ **If a future pass disagrees, the fix is to extend those two lines, not to rewrite them.**

### ⛔ Full audit accounting — every surviving candidate, with its reason

Re-run after P5's edits: **152 distinct identifiers, 292 candidate hits across §2/§3.** Every one is
accounted for; **none is an unexplained survivor.**

| Class | Hits | Why it survives |
|---|---:|---|
| **STRING** | 196 | Present in the build only as a string literal, an object key or a comment — the scanner strips all three. Includes every `DEBUG_VARS` `id` (`debugOverride` is `const DEBUG_OVERRIDE_ID = "debugOverride"`) and every `MUSIC_TRACKS` layer `name`. |
| **PROTECTIVE** | 57 | The sentence correctly states the identifier is deleted / retired / replaced. ⛔ **This is the sweep working, not failing.** |
| **REVIEW→resolved** | 23 | Read individually this phase; all resolved to PROTECTIVE, GLOB or a recorded borderline. Listed below. |
| **GLOB** | 14 | Glob/slash notation (`ufoFireFreq*`, `HUD_COMBO_X/Y/SIZE`, `POWERUP_HEALTH_MIN/MAX_DIST`) tokenizing into fragments while the full names are live. |
| **PLACEHOLDER** | 2 | Metasyntactic prose variables — `` `<leverId>Floor` ``, `` `{ leverId: number }` ``. |

The 23 that needed a read, and how each resolved:

- **§2.10 L291** `HUD_COMBO_SIZE`, `HUD_COMBO_Y` — GLOB; the line reads "`HUD_COMBO_X/Y/SIZE` are gone with it."
- **§2.11 L367** `BOUNDARY_DASH`/`GAP`/`GLOW`/`WIDTH` (4) — **recorded borderline #1 above; left deliberately.**
- **§2.19 L702** `hunterPulseMin` — PROTECTIVE; it is inside CS038 P5's own retirement sentence.
- **§2.19 L742** `DEBUG_ROW` — GLOB (`DEBUG_ROW*`); `DEBUG_ROWS`/`DEBUG_ROW_STEP` are both live.
- **§2.20.1 L973** `junkCountFloor` — synthesized lever id (`leverKnob()` builds `id + "Floor"`); live.
- **§3 L1294** `DEBRIS_SPEED_PER_WAVE`, `LEVER_DOCK_SIZE`, `LEVER_POWERUP_SIZE`, `PHASE_LEN`,
  `POWERUP_DROP_CHANCE`, `POWERUP_HEALTH_GAP`, `SAUCER_ACCURACY_RAMP_SCALE` (7) — PROTECTIVE. This is
  **P2's retired-constant NAME index**, whose whole purpose is to be the thing a grep lands on. ✅ It
  already lists `POWERUP_HEALTH_GAP` and `REPAIR_AMOUNT`/`REPAIR_FULL_BONUS`, so §3 and P4's corrected
  §2.14 now agree.
- **§3 L1302** `nextExtraLife`, `respawnTimer`, `satelliteTimer` (3) — PROTECTIVE ("v1.3 removes …").
- **§3 L1303** `destroyAsteroid`, `maybeDropPowerup` (2) — PROTECTIVE ("was `destroyAsteroid`", "was
  `maybeDropPowerup`"). `gapMult` — a parameter name inside the retired ORBIT block's description.
- **§3 L1301** `BASE_RADIUS` — ⚠ **the one flagged for a future pass.** The clause reads
  "**v3.4 (P2):** `Powerup.radius` and `Dock.radius` are now each `BASE_RADIUS * leverScale(LEVER,
  game.wave)`" — present tense inside a dated stamp, and `leverScale` died at CS024 P4 with the 2×
  baked into the constants. ⛔ **NOT touched: §3's rows are P3's territory, P3 was ratified at GATE D,
  and re-opening a swept row on a judgment call P3 made differently is not P5's to do.** §2.10 L287
  and §2.14 L480 both carry loud ⛔ "the 2× is BAKED IN — do not restore" bullets, so the protective
  statement exists; only this one cross-reference lags.
