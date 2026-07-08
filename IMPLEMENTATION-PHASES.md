# IMPLEMENTATION-PHASES.md — Asteroid Field Deluxe (v3.0 cycle)

Build order for the v3.0 change set. Dependency-ordered, each phase sized for **one Claude Code
session**, each ending as **its own commit on `main`** (code + doc updates together). Full specs and
all flagged decisions live in `PLANNED-FEATURES-v3.md`; this file is the *order*, the ready-to-paste
prompts, the model/effort setting, and the commit message.

**Read `CLAUDE.md` + `STATUS.md` before starting any phase.** Non-negotiables unchanged: single file,
vanilla JS, no deps; tuning constants at the top; wrap-aware helpers; `dead`-flag/`filter` lifecycle;
score through `addScore`; **one phase per session, don't build ahead**; a phase isn't done until its
headless test passes and `STATUS.md` + the GDD are updated in place.

**Dependency graph:**
```
P1 starfield ─┐
P2 fire rate ─┼─ independent (any order)
P3 targets HUD┘
P4 pause-anywhere ──▶ P5 difficulty screen + expiry modes
P6 tow-cap physics ──▶ P7 achievements A (tiers) ──▶ P8 achievements B (new achievements)
```
P1–P3 are low-risk warm-ups. P4→P5 share the menu. P6→P7→P8 share the "full chain = 12" semantics and
the achievements module. Do them in number order unless Paul reorders.

**Two decisions to lock before P6 and P7/P8** (see the FORKs in `PLANNED-FEATURES-v3.md`):
- **FORK A-fork-2** (P6): cap growth = *per canisters delivered* (recommended) or *per wave*.
- **FORK A-fork-1** (P7/P8): event-counter cadence = *per-event* (recommended) or *per-game*.
Default to the recommendation if Paul hasn't said otherwise, and note the choice in `STATUS.md`.

---

## Phase 1 — Starfield legibility & motion reference (B-3)

**Goal:** make the *existing* starfield actually usable as a motion reference — brighter, denser,
with one parallax layer for depth. Purely cosmetic; zero gameplay effect. (The field already exists —
`drawStarfield`, `stars[]`, `STAR_DENSITY` — this enhances it; see FLAG P0-a / B-3.)

**Touches:** the starfield block near `drawStarfield` (screen-space, wrap-aware); the v1.2 world
constants block. Nothing in `update()`.

**Ready-to-paste prompt:**
> Read `CLAUDE.md`, then `STATUS.md`, then GDD §2.11 (world/camera/starfield) before coding. Implement
> **v3.0 Phase 1 — starfield legibility** per `PLANNED-FEATURES-v3.md` §B-3. The starfield already
> exists (`drawStarfield`, `stars[]`, `STAR_DENSITY = 40`, colour `#1a2a40`); do **not** add a second
> system — enhance this one. (1) Give each star a per-star brightness and draw with a brighter cool
> colour than `#1a2a40` so the field reads without competing with entities (Pillar 1). (2) Raise
> `STAR_DENSITY` (try ~70–90; it scales by world area). (3) Add **one** nearer parallax layer moving
> at a fraction of the camera offset (`STAR_PARALLAX_FACTOR`), keeping the existing 1.0× layer as the
> world-fixed reference. Handle the seam carefully — a ≠1× layer is not world-fixed, so tile it in
> screen space modulo its spacing rather than reusing the wrap math (FLAG B-3-a). New constants
> (`STAR_PARALLAX_FACTOR`, `STAR_BRIGHT_MIN/MAX`, retuned `STAR_DENSITY`) go in the v1.2 world block.
> No gameplay effect at all. Headless-test that `draw()` stays crash-free in title + playing and that
> driving `update()` with the ship moving/wrapping changes no score/HP/entity counts. Update GDD §2.11
> + the Architecture Map draw() row + `STATUS.md`. End with the browser playtest asks (brightness,
> density, whether the parallax reads as depth, seam cleanliness).

**Model/effort:** low-complexity cosmetic. **Sonnet, medium thinking.** No `ultrathink` needed.

**Commit:** `v3.0 P1: starfield legibility — brighter/denser field + one parallax depth layer (cosmetic)`

---

## Phase 2 — Fire-rate rebalance (B-6)

**Goal:** base gun slightly slower; Rapid Fire actually faster (today Rapid only raises the bullet
cap, not the cadence — that's the bug Paul feels).

**Touches:** `FIRE_COOLDOWN` constant + new `RAPID_FIRE_COOLDOWN`; the fire block in `Ship.update`.

**Ready-to-paste prompt:**
> Read `CLAUDE.md`, `STATUS.md`, GDD §2.2 (weapons) + §2.14 (powerups). Implement **v3.0 Phase 2 —
> fire-rate rebalance** per `PLANNED-FEATURES-v3.md` §B-6. Today a single `FIRE_COOLDOWN = 0.16` is
> used for every shot and Rapid Fire only changes `maxBullets()`, so cadence never changes. (1) Retune
> base `FIRE_COOLDOWN` slightly slower (start 0.20). (2) Add `RAPID_FIRE_COOLDOWN` clearly faster
> (start 0.09). (3) In the fire block, set the post-shot cooldown to `RAPID_FIRE_COOLDOWN` when Rapid
> is active, else `FIRE_COOLDOWN`. Leave Triple on the base cadence and keep Rapid's higher cap.
> Note Rapid+Triple is now a stronger combo (FLAG B-6-a) — that's intended; flag it for playtest.
> Headless-test: cooldown after a shot equals the base value with Rapid inactive and the rapid value
> with Rapid active; drive the real fire block over N frames and confirm the shots-per-second
> relationship (rapid > base). Update GDD §2.2 + `STATUS.md` balance notes. End with playtest asks
> (wave 1–3 clear time at the slower base; is Rapid+Triple too dominant).

**Model/effort:** small, localized. **Sonnet, medium thinking.**

**Commit:** `v3.0 P2: fire-rate rebalance — slower base gun, genuinely faster Rapid Fire cadence`

---

## Phase 3 — "Targets remaining" HUD (B-7)

**Goal:** a HUD count of satellites (any size, both families) left before the wave clears, since the
wave-clear gate is `debris.length === 0 && hunters.length === 0`.

**Touches:** the HUD draw block (near the CARGO readout). No sim changes.

**Ready-to-paste prompt:**
> Read `CLAUDE.md`, `STATUS.md`, GDD §2.7 (waves) + §2.4/§2.5 (Debris/Hunters). Implement **v3.0
> Phase 3 — Targets-remaining HUD** per `PLANNED-FEATURES-v3.md` §B-7. The wave-clear gate is
> `game.debris.length === 0 && game.hunters.length === 0` → 2.5 s grace → `nextWave()`, so the count
> is `game.debris.length + game.hunters.length` (each split child is its own entry, so a large Debris
> splitting into 3 mediums raises the count from 3 to 5 — intended). Add a HUD readout **`TARGETS n`**
> near the CARGO line, lit while `n > 0`. Note two things in-code and in the playtest asks: the count
> can **rise** mid-wave when a Hunter lineage spawns on its timer (Hunters appear from wave 2, one
> lineage at a time, not at wave start — FLAG B-7-a/b), and label it `TARGETS` (not "satellites left,"
> which implies a fixed start budget). Headless-test that `TARGETS` equals `debris.length +
> hunters.length` across a Debris split (3→5) and a Hunter spawn, and reads 0 exactly when the gate
> trips. Update GDD §2.7 + the Architecture Map draw()/HUD row + `STATUS.md`. Playtest ask: does the
> number rising when a Hunter arrives read clearly, or is the two-part `DEBRIS n · HUNTERS m` variant
> better?

**Model/effort:** small. **Sonnet, medium thinking.**

**Commit:** `v3.0 P3: HUD Targets-remaining count (debris + hunters), with the Hunter-spawn-jump note`

---

## Phase 4 — Pause/menu reachable from any state + ESC-to-pause (B-1, B-2) — SHIPPED

**SHIPPED — commit `90ab503` ("v3.0 P4 (revised): pause/menu from any state; corrected controls
(Start=session toggle, O/B open menu, ESC pause)"), superseding the initial attempt at commit
`389364a`.** The as-built control scheme: controller **Start = session toggle** (title/gameover →
start a game; playing → open pause; paused → dismiss/resume — unchanged from the original §2.15
spec, not a new mapping); keyboard **ESC** pauses during play and resolves to "back" inside a menu;
keyboard **"O"** and controller **B** open the title/gameover **system menu**
(`["Options","Achievements","Back"]`), both context-aware as "back" when a menu is already open.
Authoritative spec now lives in GDD §2.9 / §2.16 / §2.15 + the Architecture Map Menu row; build
narrative in `STATUS.md` (v3.0 P4 entries).

**FLAG P4-a resolved: "P" retired** as a pause key — `bindings.pause.keys` is `["escape"]` only,
sharing ESC with `bindings.back`. **FLAG P4-b (a single confirm can't both navigate the system menu
and start a game) held**, guaranteed structurally: the gamepad normal branch is an else-if chain
(Start > B > A), and both the keyboard and gamepad handlers hit the menu-open context (which returns)
before the title "press to start" line.

**Historical note — the original prompt below planned FLAG B-1-a (controller Start remapped to
open the menu, with "start game" moved fully onto A).** A playtest rejected that mapping; the P4
run was reset to the clean Phase 3 commit and rebuilt with the corrected scheme above, where Start
keeps its original session-toggle behavior and **O (keyboard) / B (controller)** — not Start — are
the new system-menu openers. See `PLANNED-FEATURES-v3.md` §B-1/B-2 for the full as-built writeup and
the formal withdrawal of B-1-a.

<details>
<summary>Original ready-to-paste prompt (planning-time; superseded by the as-built scheme above)</summary>

> Read `CLAUDE.md`, `STATUS.md`, and GDD §2.9 + §2.15 + §2.16 (states, gamepad, menu state machine)
> **carefully** before coding. Implement **v3.0 Phase 4 — pause/menu from any state + ESC-to-pause**
> per `PLANNED-FEATURES-v3.md` §B-1/§B-2. Today pause opens only from `playing`; the whole
> Options/Controls/Achievements tree is unreachable without starting a game. Changes: (1) Add
> `"escape"` to `bindings.pause.keys` — the keyboard handler checks confirm→back→pause in order, so
> ESC inside a menu still resolves to **back** and ESC outside a menu now pauses; verify no collision.
> (2) Let `openPause()` be called from `title`/`gameover` as well as `playing`. (3) **Context-aware
> root menu:** from `playing` keep `["Continue","Options","Quit"]`; from `title`/`gameover` show a
> system menu `["Options","Achievements","Back"]` where Back closes the overlay and returns to the
> underlying screen — reuse the entire tested Options/Controls/Achievements sub-tree unchanged.
> (4) Preserve "start a game": Enter (keyboard) and **A** (gamepad) still start from title/gameover;
> move controller "start" fully onto A/confirm and make **Start → openPause() in all states**
> (FLAG B-1-a — a deliberate small shipped-behaviour change). (5) Keep the three-context input
> priority intact and ensure a confirm can't both navigate the system menu and start a game
> (FLAG B-1-b) — suppress/ignore the title "press to start" while the system menu is open. `ultrathink`
> the input-routing/state-machine correctness (contexts × states × the `game.paused` invariant) — this
> is the one tricky part. Headless-test: open/close from each of title/playing/gameover; ESC-as-pause
> outside vs ESC-as-back inside; the context-aware root arrays; Start→menu in all states + A→startGame
> on title/gameover; **no leak** of menu input into `keys{}` or into a title start; and the full F8
> menu regression stays green. Update GDD §2.9/§2.16 + the Architecture Map Menu row + `STATUS.md`
> (this also closes the long-standing "menu reachable only via pause" note). End with playtest asks
> (does ESC-to-pause feel right; does the title→Options/Achievements entry read; does Start-not-
> starting-a-game surprise a controller player).

**Model/effort:** **Opus, high thinking**, with `ultrathink` on the input-context/state-machine
sub-problem as the prompt flags. This phase's risk is subtle input leakage, not volume.

</details>

**Commit:** `90ab503` (revised, shipped) — historical original-attempt commit: `389364a`
(`v3.0 P4: pause/menu from any state + ESC-to-pause; context-aware root (title→Options/Achievements)`,
superseded).

---

## Phase 5 — Difficulty Options screen + powerup expiry modes (B-4, B-5)

**Goal:** a new **Options → Difficulty** screen with two mode toggles — shot powerups expire by
**Time | Shots**, Magnet expires by **Time | Pieces** — and the count-based expiry logic behind them.
Defaults to today's time-based behaviour so nothing changes until opted in. Depends on P4's menu
structure.

**Touches:** `POWERUP_DURATION` path in `update()`; a new `game.powerBudget`; the fire block (shot
count) + the garbage-hook site (piece count); `MENU_OPTIONS` (+`"Difficulty"` row) + a new
`"difficulty"` sub-screen mirroring `menuOptions`/`drawOptionsMenu`; settings persistence
(`afd_settings_v1`, additive); the HUD active-powerup row (count vs time label).

**Ready-to-paste prompt:**
> Read `CLAUDE.md`, `STATUS.md`, GDD §2.14 (powerups) + §2.16 (menu/persistence). Implement **v3.0
> Phase 5 — Difficulty screen + powerup expiry modes** per `PLANNED-FEATURES-v3.md` §B-4/§B-5. Two
> persisted settings in `afd_settings_v1` (additive fields, tolerate a missing key on load):
> `shotPowerupMode` (`"time"` default | `"shots"`) and `magnetMode` (`"time"` default | `"pieces"`).
> In count mode, track budgets in a new `game.powerBudget {rapid,triple,magnet}`: Rapid/Triple
> decrement **per trigger-pull** (a Triple 3-fan is ONE shot; with both active decrement both budgets
> once per pull, each ending independently — FLAG B-4-b) via `RAPID_SHOTS`/`TRIPLE_SHOTS`; Magnet
> decrements **per canister hooked** (count at the hook, not the pull — FLAG B-5-a) via
> `MAGNET_PIECES`. Same-type pickup refreshes the budget to full (never stacks), matching the timed
> rule. HUD: reuse the active-effect bar as `remaining/budget` with a count label in count mode.
> New menu: add `"Difficulty"` to `MENU_OPTIONS` before `"Back"`; add a `"difficulty"` sub-screen
> (mirror `menuOptions`/`drawOptionsMenu`) with two left/right toggle rows + Back, navigable via the
> existing `menuInput` dispatcher; persist on change; leave the screen structured to grow (FLAG B-4-c).
> Headless-test: default `"time"` reproduces current behaviour exactly; `"shots"` ends Rapid after
> exactly `RAPID_SHOTS` pulls (Triple 3-fan counts once; Rapid+Triple budgets independent); `"pieces"`
> ends Magnet after exactly `MAGNET_PIECES` hooks; same-type refresh restores the budget; toggles flip
> + persist round-trip; the Difficulty screen draws without throwing; F8 menu regression green. Update
> GDD §2.14/§2.16 + Architecture Map + `STATUS.md`. Playtest asks: do the count budgets feel right;
> is the count HUD legible; is the Difficulty screen discoverable.

**Model/effort:** **Opus, high thinking** (touches the menu state machine, the fire block, the pickup
pass, and persistence together — several coupled sites). `ultrathink` optional on the
Rapid+Triple-both-active budget interaction if it gets fiddly.

**Commit:** `v3.0 P5: Difficulty Options screen — shot-powerup (time|shots) & magnet (time|pieces) expiry modes`

---

## Phase 6 — Tow-capacity progression + chain physics retune (B-8)

**Goal:** the tow cap grows during a run (base 12 → ceiling ~20) and the chain physics are retuned so
a long chain feels **heavy, not broken**, with constraint stability re-validated at the higher node
count. Ships before the achievements phases because it redefines what "full chain" means.

**Touches:** `CHAIN_MAX` → `game.cargoMax` + `CARGO_BASE`/`CARGO_CAP_MAX`/growth constants; the pickup
gate + the HUD `CARGO n/max`; `startGame` reset; the growth hook (delivery or wave); `CARGO_THRUST`/
`CARGO_TOPSPEED` retune in `Ship.update`; possibly `CHAIN_ITER` (constraint iterations) in
`updateChain`. **Read GDD §2.10, §2.10.1, §3.4 before touching the chain — the stability envelope and
the "cap is a handling ceiling" rationale are load-bearing.**

**Ready-to-paste prompt:**
> Read `CLAUDE.md`, `STATUS.md`, and GDD **§2.10 + §2.10.1 + §3.4 (chain physics contract)** carefully
> before coding. Implement **v3.0 Phase 6 — tow-capacity progression + chain retune** per
> `PLANNED-FEATURES-v3.md` §B-8. Part 1 (variable cap): replace the `CHAIN_MAX` reads (pickup gate +
> HUD) with a runtime `game.cargoMax` starting at `CARGO_BASE` (12) and growing to `CARGO_CAP_MAX`
> (start 20). **Growth rule = per canisters delivered** (FORK A-fork-2, recommended): +1 per
> `CARGO_GROW_PER` (start 30) delivered, bounded by the ceiling; reset to base in `startGame`; HUD
> `CARGO n/{cargoMax}` + a brief "TOW +1" float on increase. Part 2 (the real work — physics): soften
> `CARGO_THRUST` (the 0.10 thrust-penalty coefficient) and `CARGO_TOPSPEED` (the 0.05) **down** so a
> full chain at `CARGO_CAP_MAX` lands near today's 12-node feel (~45% thrust / ~63% top speed) instead
> of the "broken" ~33%/50% a naive m=20 gives; keep the momentum-tug `massFactor` cap sensible; re-check
> the Engine-powerup halving at the new ceiling (FLAG B-8-a). Re-validate chain stability at
> `CARGO_CAP_MAX` nodes per §3.4 rule 7 — if it whips/drifts, bump the relaxation iterations (3→4/5,
> `CHAIN_ITER`) and re-confirm the `drawLink` 120 px wrap-skip. Do **not** touch the achievements yet;
> just note in `STATUS.md` that Heavy Hauler / Freight Baron / The Long Haul must key on a fixed ≥12
> (not `cargoMax`) — the achievements phases consume that (FLAG B-8-b). `ultrathink` the physics retune
> + stability revalidation (the whipping/feel is the hazard). Headless-test: `cargoMax` starts at 12,
> grows by the rule up to `CARGO_CAP_MAX`, never exceeds it; pickup gate + HUD read `cargoMax`; a full
> chain at the ceiling produces the retuned thrust/top-speed ratios (assert targets); constraint
> stability holds at `CARGO_CAP_MAX` nodes across wrap + hard thrust-flips. Update GDD §2.10/§2.10.1/
> §3.4 + Architecture Map + `STATUS.md`. Playtest asks: does a full max chain feel *heavy but drivable*
> (not broken); does the cap-growth cadence feel earned; any whip/perf issues in dense late waves.

**Model/effort:** **Opus, high thinking**, `ultrathink` on the physics retune + stability (per the
prompt). This is the second-hardest phase; the risk is chain feel/stability, not code volume.

**Commit:** `v3.0 P6: growing tow cap (12→20) with chain mass-penalty retune + stability revalidation`

---

## Phase 7 — Achievements A: tiered infrastructure + convert existing lifetime achievements

**Goal:** add the 6-tier structure to the `Achievements` module, convert the flagged lifetime
achievements to tiers (including the SUM-vs-MAX counter distinction), rewrite the viewer for tiered
rows, and bump persistence to `afd_achievements_v2`. **No new achievement *ideas* yet** — this phase
is the machinery + converting what already exists. Split from P8 to keep each session sized.

**Touches:** the `Achievements` module (`tiers` field, `evaluate()` per-tier unlock, per-id highest-
tier tracking, `TIER_NAMES`/`TIER_COLOR`); `Achievements.lifetime` (add `maxWaveNoPowerup` and the
MAX-counter update sites); persistence (`afd_achievements_v2` + best-effort migration); the viewer
(`drawAchievements`/`drawAchRow` — tiered rows: badge + progress-to-next); `test-f9.js` (heavy
rewrite — see below).

**Ready-to-paste prompt:**
> Read `CLAUDE.md`, `STATUS.md`, and GDD §2.17 (achievements) carefully. Implement **v3.0 Phase 7 —
> tiered achievements infrastructure + convert existing** per `PLANNED-FEATURES-v3.md` §A-1..A-3,
> A-5, A-7. Add an optional `tiers:[bronze…diamond]` array to a lifetime definition and
> `TIER_NAMES`/`TIER_COLOR[]` (kept in the vector-glow palette — FLAG A-1-a). `evaluate()` for a
> tiered entry unlocks **every** newly-crossed tier this pass (a big jump → multiple toasts,
> ascending; toast text names the tier), persisting the **highest tier index reached** per id.
> Non-tiered + weekly entries stay single-goal (unchanged). Convert these lifetime achievements to
> tiers using the exact ladders in the §A-3 table: Recycling Magnate, Ghost Protocol, Saucer Hunter,
> Master of the Field, No Powerups Needed, Perfect Wave, and Iron Hull. **Respect the SUM-vs-MAX
> counter kind (FLAG A-1-b):** Master of the Field (`l.maxWave`, exists) and No Powerups Needed tier
> on a persisted **max**, not a sum — add `l.maxWaveNoPowerup`, updated to `max(current, wave)` at
> each wave-clear **only while `game.stats.powerupsPicked === 0`** (frozen once a powerup is picked).
> Also reword the "full 12-chain" lifetime achievement (The Long Haul / `l.fullChains`) to a **fixed
> ≥12 delivered in one visit** (decoupled from `game.cargoMax` — FLAG A-5-a / B-8-b). Rewrite the
> viewer (`drawAchievements`/`drawAchRow`) to render tiered lifetime rows as **one row each**: a tier
> badge + progress to the *next* tier (e.g. "Gold · 12,431 → 25,000"). Bump persistence to
> `afd_achievements_v2` (new shape: `lifetimeTiers{id:idx}` + non-tiered `lifetimeUnlocked[]` +
> `weekly{key,unlocked[]}`); on load, if only `_v1` exists, keep the raw lifetime **counters** and
> let tiers recompute, ignoring old unlock sets (FLAG A-2 / A-2-a). Keep the `typeof`-guard + try/catch
> contract (never crashes). **The module still observes, never drives** — `cur()` is untouched.
> `ultrathink` the per-tier unlock + persistence-migration logic. **Rewrite `test-f9.js`'s lifetime
> assertions to per-tier boundaries** (cross bronze not silver; a jump crossing two tiers fires two
> unlocks; MAX counters update correctly; the v2 persistence round-trip; the `_v1→_v2` migration keeps
> counters). Regression: the weekly rotation + non-tiered paths stay green. Update GDD §2.17 (tier
> model, the SUM/MAX note) + Architecture Map Achievements row + `STATUS.md`. Playtest asks: do the
> tier badges/colours read (not like hazards); does progress-to-next make sense; does a big lifetime
> jump popping several toasts feel good or spammy.

**Model/effort:** **Opus, high thinking**, `ultrathink` on the per-tier unlock + persistence
migration. Largest single phase; the risk is the module/persistence/test rewrite, not gameplay.

**Commit:** `v3.0 P7: tiered achievements (bronze→diamond) + convert existing lifetime set; afd_achievements_v2`

---

## Phase 8 — Achievements B: new lifetime event achievements + new weekly + audit

**Goal:** add the new tiered lifetime achievements that need **new counters/hooks** (small-saucer
total, best-canisters-in-a-game, best-debris-in-a-game, and the four event counters), add the new
**weekly**, confirm the four definitions read correctly against the code, and update the weekly
rotation count + tests. Depends on P7's tier infrastructure and P6's fixed-12 "full chain" semantics.

**Touches:** the `WEEKLY`/`LIFETIME` arrays (new tiered lifetime entries + one new weekly);
`Achievements.lifetime` + `resetGameStats` (new counters); one-liner hooks at existing event sites
(observe-at-source); `test-f9.js` (recompute pool-size-dependent rotation values for length 16 + add
the new counters' boundary tests); GDD §2.17 prose ("15 weekly" → "16 weekly").

**Ready-to-paste prompt:**
> Read `CLAUDE.md`, `STATUS.md`, GDD §2.17. Implement **v3.0 Phase 8 — new achievements + audit** per
> `PLANNED-FEATURES-v3.md` §A-3 (rows A-8..A-14), §A-4 (the fork), §A-5 (audit), §A-6 (new weekly),
> §A-7 (rotation/tests). Add these **tiered lifetime** achievements (reuse P7's `tiers` machinery,
> exact ladders + names from the §A-3 table): **Sharpshooter** (small-saucer total, `l.smallSaucerKills`
> new, ladder tops at **7,500** per FLAG A-8-a), **Salvage King** (MAX: best canisters delivered in one
> game, `l.bestDeliveredGame` new), **Field Sweeper** (MAX: best Debris destroyed in one game,
> `l.bestDebrisGame` new), **Freight Baron** (Heavy-Hauler events, `l.heavyHaulerEvents` new),
> **Daredevil** (Glass-Cannon events, `l.glassCannonGames` new, **softened ladder 1/5/20/50/125/300**),
> **Zen Master** (Pacifist-Tow events, `l.pacifistTowEvents` new), **Wave Rider** (Shield-Surfer events,
> `l.shieldSurferGames` new, **softened ladder 1/5/20/50/125/300**). Cadence per **FORK A-fork-1
> (default: per-EVENT)**: increment `heavyHaulerEvents` once per dock visit that delivers **≥12**
> (latch so it fires once per visit, using the fixed-12 semantics from P6, not `cargoMax`); increment
> `pacifistTowEvents` once per haul whose no-fire delivery streak reaches 5 (reuse the existing
> `pacifistStreak`/reset-on-fire machinery). Note Glass Cannon + Shield Surfer are inherently
> once-per-game so per-event≡per-game for them — increment `glassCannonGames`/`shieldSurferGames` once
> at game over from their per-game flags. Add each counter to `Achievements.lifetime` + `resetGameStats`
> and place **one-liner hooks at the existing event sites** (small-saucer kill site; the dock-offload
> block; `destroyDebris`; the shield-deflect/Glass-Cannon-condition sites) — observe-at-source, no new
> indirection. Add the new **weekly "Flawless Run"** (clear wave **8+** damage-free — FLAG A-6-b:
> harder than the trivial "any wave" and distinct from No Scratches; `s.flawlessLateWave` set in the
> wave-clear block when `game.wave >= 8 && s.dmgThisWave === 0`). Audit + confirm in-code comments that
> Pacifist Tow / Close Shave / No Scratches / Heavy Hauler match §A-5 (they do — Heavy Hauler keys the
> fixed 12). The weekly pool is now **16**: `poolIndex()` uses `.length` so it self-adjusts, but
> **recompute `test-f9.js`'s expected rotation indices/slices for length 16** (FLAG A-7-a) and update
> GDD §2.17 "15 weekly"→"16 weekly". Add boundary tests for every new counter/tier and the two
> event-cadence hooks. Regression green across f2–f9 + P7's tiered tests. Update GDD §2.17 + Architecture
> Map + `STATUS.md`. Playtest asks: do the new goals feel earnable-but-meaningful; is Flawless Run @
> wave 8 the right floor; do the per-event counters (Freight Baron/Zen Master) climb at a satisfying
> rate.

**Model/effort:** **Opus, high thinking.** Big but mechanical (many parallel hooks + test recompute);
`ultrathink` only if the per-event latch logic (Heavy Hauler once-per-visit) gets fiddly.

**Commit:** `v3.0 P8: new tiered lifetime achievements + Flawless Run weekly; 16-weekly rotation + F9 test recompute`

---

## After Phase 8 — housekeeping

- Confirm every shipped v3.0 feature's spec has moved from `PLANNED-FEATURES-v3.md` into GDD §2 (no
  handoff gaps), then **archive `PLANNED-FEATURES-v3.md` + this file** under `archive/` with a README
  note (mirroring how the v2.0 docs were retired) — the GDD §2 + `STATUS.md` become authoritative.
- Fold the still-open v2.0 items forward if desired: the **Waste Not** redefinition (out of scope this
  cycle) and the **joint F3+F10 Debris-density retune** (a browser playtest pass).
- Re-run the full headless suite (f2–f9 + the v3.0 additions) and `node --check` clean before the
  final push.

---

## Per-phase settings at a glance

| Phase | Complexity | Model / thinking | `ultrathink` on |
|---|---|---|---|
| P1 starfield | low (cosmetic) | Sonnet / medium | — |
| P2 fire rate | low | Sonnet / medium | — |
| P3 targets HUD | low | Sonnet / medium | — |
| P4 pause-anywhere | **high** (input/state) | Opus / high | input-context × state × `game.paused` invariant |
| P5 difficulty + expiry | medium-high | Opus / high | Rapid+Triple budget interaction (optional) |
| P6 tow-cap physics | **high** (chain feel) | Opus / high | mass-penalty retune + stability revalidation |
| P7 achievements A (tiers) | **high** (module/persist) | Opus / high | per-tier unlock + `_v1→_v2` migration |
| P8 achievements B (new) | medium-high | Opus / high | per-event latch (optional) |

*(Model names map to whatever tier you used for the equivalent-complexity v2.0 phases — the point is
the low-risk cosmetic/HUD phases want a light setting, and the input-state, chain-physics, and
achievements-module phases want the heavy setting with `ultrathink` on the one flagged sub-problem.)*