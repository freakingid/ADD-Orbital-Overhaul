# PLANNED-FEATURES-v3.md — Asteroid Field Deluxe (Orbital Overhaul, v3.0 cycle)

**Status:** design detail for the v3.0 change set — *not yet built*. Companion to
`asteroid-field-deluxe-GDD.md` (design intent + shipped) and `IMPLEMENTATION-PHASES.md`
(build order). When a feature ships, its spec moves out of here into GDD §2 and its status
flips, exactly as the archived v2.0 planning docs were retired.

Build target: single self-contained `asteroids-deluxe.html`, vanilla JS, no deps, no build step.
Current build reality: **v2.1** (full v2.0 feature set + the dashed world-boundary line). See `STATUS.md`.

This document is organized as: **Part A — Achievements Overhaul** (the main item), then
**Part B — Orbital Overhaul Change Set 1** (the eight change requests). Every non-obvious call
is written up as a numbered **FLAG** so nothing is a silent interpretation. Two items are **real
design forks** left for Paul — both marked **FORK** with a recommendation.

---

## Pre-flight: three things already true in the shipped build (verified against `asteroids-deluxe.html`)

Before specifying anything, three requests describe things that already exist or are already
done. Flagging up front so the phases don't "add" something that's present:

- **FLAG P0-a — The starfield already exists.** Request B-3 asks for "a starfield … so we can see
  movement relative to something." The build already has one: `STAR_DENSITY = 40`,
  `STAR_COUNT`-scaled `stars[]`, `drawStarfield()` (wrap-aware, screen-space), called every frame
  in `draw()`. There is also a dashed world-boundary line (v2.1). So B-3 is **not** "add a
  starfield" — it's "the existing starfield is too faint/sparse to read as a motion reference."
  Spec'd below as an *enhancement*, not a new feature. (Colour is `#1a2a40` — a very dim blue-grey
  barely above the near-black background — stars are 1–1.8 px, uniform brightness, no parallax.)

- **FLAG P0-b — Iron Hull is already a pure lifetime counter with no "without dying" clause.**
  Shipped: `{ id:"iron_hull", desc:"Survive 100 hazard hits (all-time)", goal:100, cur:(s,l)=>l.hitsSurvived }`.
  The achievements ask to "drop the without-dying clause" — there is nothing to drop; it's already
  lifetime-cumulative. The only *new* work for Iron Hull is optional tiering (recommended — see A-14).

- **FLAG P0-c — The wave-clear gate is `debris.length === 0 && hunters.length === 0`.** Request B-7
  ("how do I end a level / show a remaining count") is answered by this one line in `update()`. The
  "remaining" number is literally `game.debris.length + game.hunters.length`. Details + the one UX
  wrinkle (Hunters arrive on a timer, so the count can *rise* mid-wave) in B-7 below.

---

# PART A — ACHIEVEMENTS OVERHAUL (main item)

## A-0. What the shipped achievements system is (so the overhaul is precise)

The `Achievements` module (defined after the powerup flow functions) holds two flat arrays,
`WEEKLY` (15) and `LIFETIME` (12). Each entry is:

```js
{ id, name, desc, goal, cur(s, l), text? }   // pool inferred by which array it's in
```

`evaluate()` runs each frame (already-unlocked entries short-circuit) + once at game over, and
unlocks an entry the instant `cur(game.stats, lifetime) >= goal`. Unlock → gold toast + fanfare;
the viewer (Pause → Options → Achievements) shows one row per entry with a `cur/goal` readout.
Persistence: its own `localStorage` key `afd_achievements_v1`, `typeof`-guarded + try/caught.
Per-game counters live in `game.stats` (`resetGameStats()`); lifetime counters in
`Achievements.lifetime`. **The module observes, never drives** — that contract is non-negotiable
and the overhaul preserves it.

**The key structural fact:** the current model is *single-goal*. It has no concept of tiers. So
"6 tiers each" is a genuine (contained) change to `evaluate()`, the persisted unlock state, and the
viewer renderer — **not** just more array rows. The design below adds a tier structure while
keeping every `cur()` untouched.

---

## A-1. Tier model (bronze → diamond)

Introduce an optional `tiers` array on a definition. A tiered entry looks like:

```js
{ id:"recycling_magnate", pool:"lifetime", name:"Recycling Magnate",
  desc:"Deliver canisters to the dock (all-time).",
  cur:(s,l)=>l.delivered,
  tiers:[1000, 5000, 10000, 25000, 50000, 100000] }   // bronze,silver,gold,titanium,platinum,diamond
```

- `TIER_NAMES = ["Bronze","Silver","Gold","Titanium","Platinum","Diamond"]` and a
  `TIER_COLOR[]` palette (kept in the vector-glow family — see FLAG A-1-a) live with `COLOR`.
- **`evaluate()` for a tiered entry:** compare `cur` against each not-yet-unlocked tier; unlock
  **every** newly-crossed tier this pass (a big lifetime jump can cross two at once → two toasts,
  in ascending order). Persist the **highest tier index reached** per tiered id (see A-2).
- **Unlock semantics stay "observe":** `evaluate()` only reads `cur()`; it never mutates game
  state. A tiered unlock is exactly today's unlock, run per crossed threshold.
- **Toast text** names the tier: e.g. *"Recycling Magnate — Gold."*
- **Non-tiered entries are unchanged** — a definition with no `tiers` is the old single-goal path.
  Weekly achievements stay single-goal (tiers are a lifetime concept here).

- **FLAG A-1-a — tier colours must not read as new hazards.** Six gold-ish metal tints on
  glow-stroked banners is fine, but keep them inside the existing palette discipline (Pillar 1); use
  brightness/saturation steps of one hue family (or the classic bronze→silver→gold→white-hot ramp),
  not six saturated colours that compete with enemy tells. This is a look call for the browser
  playtest, tunable via `TIER_COLOR[]`.

- **FLAG A-1-b — two kinds of lifetime counter: SUM vs MAX.** Paul's cover note calls these "all
  straightforward lifetime cumulative counters," but four of the thirteen are **single-game
  bests**, not running totals:
  - **Sum (running total):** A-2 Recycling Magnate, A-3 Ghost Protocol, A-4 Saucer Hunter,
    A-7 Perfect Wave, A-8 small-saucer total, A-11..A-14 the event counters, and Iron Hull.
  - **Max (personal best across games):** A-5 Master of the Field (best wave ever — already
    `l.maxWave`), A-6 No-Powerups best wave, A-9 most canisters in one game, A-10 most Debris in one
    game. These tier on a *persisted maximum*, updated with `Math.max(...)` at the relevant event or
    at game over — **not** `+=`. The tier structure is identical; only the counter's update rule
    differs. The spec for each says which it is; Claude Code must add the right kind of counter.

---

## A-2. Persistence — bump to `afd_achievements_v2`

The saved shape changes (tier indices instead of a flat unlocked-set for tiered ids). Cleanest,
lowest-risk move: **new key `afd_achievements_v2`**, and on load, if only the old `_v1` key is
present, read what carries over cleanly (the raw lifetime counters — they're unchanged) and ignore
the old unlock sets (they'll simply re-derive on next `evaluate()` from the retained counters).

- New persisted shape: `{ lifetime:{…}, lifetimeTiers:{ id:highestTierIdx, … },
  lifetimeUnlocked:[…non-tiered lifetime ids…], weekly:{ key, unlocked:[…] } }`.
- Keep the `typeof`-guard + try/catch contract (a storage failure never crashes — GDD §4 item 1).
- **FLAG A-2-a** — because real `localStorage` persistence is *still unverified in a browser*
  (STATUS.md top ask), the migration is best-effort: worst case, a returning v2.1 player's lifetime
  *counters* survive and their tier badges recompute; their old *weekly* unlocks for the current
  week may reset once. Acceptable for a solo pre-release build; call it out in the session's playtest
  asks.

---

## A-3. The thirteen tiered lifetime achievements

Tiers are always `[bronze, silver, gold, titanium, platinum, diamond]`. "Kept" = Paul's proposed
numbers are sound and adopted as-is. Where a number is changed, the **FORK/FLAG** says why.

| # | id / name | counter (SUM/MAX) | `cur()` source | tiers |
|---|---|---|---|---|
| A-2 | `recycling_magnate` — **Recycling Magnate** | SUM | `l.delivered` (exists) | 1,000 / 5,000 / 10,000 / 25,000 / 50,000 / 100,000 — **kept** |
| A-3 | `ghost_protocol` — **Ghost Protocol** | SUM | `l.hunterKills` (exists) | 50 / 250 / 1,000 / 2,500 / 5,000 / 10,000 — **kept** |
| A-4 | `saucer_hunter` — **Saucer Hunter** (big+small) | SUM | `l.saucerKills` (exists) | 250 / 500 / 1,000 / 2,500 / 5,000 / 10,000 — **kept** |
| A-5 | `master_field` — **Master of the Field** | MAX | `l.maxWave` (exists) | 5 / 10 / 25 / 50 / 75 / 100 — **kept** |
| A-6 | `no_powerups` — **No Powerups Needed** | MAX | `l.maxWaveNoPowerup` (**new**) | 2 / 5 / 11 / 17 / 23 / 29 — **kept** (diamond is brutal by design — see FLAG A-6-a) |
| A-7 | `perfect_wave` — **Perfect Wave** | SUM | `l.perfectWaves` (exists) | 5 / 10 / 50 / 100 / 250 / 500 — **kept** |
| A-8 | `sharpshooter` — **Sharpshooter** *(name proposed)* small saucers all-time | SUM | `l.smallSaucerKills` (**new**) | 100 / 500 / 1,000 / 2,500 / 5,000 / **7,500** — see FLAG A-8-a |
| A-9 | `salvage_king` — **Salvage King** *(name proposed)* most canisters delivered in one game | MAX | `l.bestDeliveredGame` (**new**) | 10 / 20 / 40 / 75 / 125 / 200 — **kept** (see FLAG A-9-a) |
| A-10 | `field_sweeper` — **Field Sweeper** *(name proposed)* most Debris destroyed in one game | MAX | `l.bestDebrisGame` (**new**) | 15 / 40 / 80 / 150 / 250 / 400 — **kept** |
| A-11 | `freight_baron` — **Freight Baron** *(name proposed)* Heavy-Hauler events | SUM | `l.heavyHaulerEvents` (**new**) | 1 / 10 / 50 / 150 / 400 / 1,000 — **kept** (per-EVENT — see FORK A-fork-1) |
| A-12 | `daredevil` — **Daredevil** *(name proposed)* Glass-Cannon events | SUM | `l.glassCannonGames` (**new**) | **1 / 5 / 20 / 50 / 125 / 300** — see FLAG A-12-a (was 1/10/50/150/400/1000) |
| A-13 | `zen_master` — **Zen Master** *(name proposed)* Pacifist-Tow events | SUM | `l.pacifistTowEvents` (**new**) | 1 / 10 / 50 / 150 / 400 / 1,000 — **kept** (per-EVENT — see FORK A-fork-1) |
| A-14 | `wave_rider` — **Wave Rider** *(name proposed)* Shield-Surfer events | SUM | `l.shieldSurferGames` (**new**) | **1 / 5 / 20 / 50 / 125 / 300** — see FLAG A-12-a (was 1/10/50/150/400/1000) |
| A-14b | `iron_hull` — **Iron Hull** (tier the existing lifetime counter) | SUM | `l.hitsSurvived` (exists) | 100 / 500 / 1,000 / 2,500 / 5,000 / 10,000 — **recommended (see A-14 note)** |

**A-14 note (Iron Hull tiering).** Recommendation: **yes, tier it** for consistency with the family,
using the proposed ladder. It's already a pure lifetime counter (FLAG P0-b), so this is a
one-definition change.

### Threshold flags

- **FLAG A-6-a — No-Powerups diamond (wave 29, zero powerups ever picked) is extreme but coherent.**
  Powerups drop at 10% from small kills plus ambient Health on an 18–26 s timer; refusing *every*
  one to wave 29 is a genuine mastery flex. Keep as the diamond ceiling; it's the "is this even
  possible" tier by intent. No change recommended — flagging so it isn't mistaken for a typo.
  **New counter `l.maxWaveNoPowerup`:** updated to `max(current, wave)` at each wave-clear *only if*
  `game.stats.powerupsPicked === 0` this game; frozen for the game once a powerup is picked.

- **FLAG A-8-a — Sharpshooter (small-saucer) diamond lowered 10,000 → 7,500.** As written, small-only
  diamond (10,000) is *harder* than Saucer Hunter's combined diamond (10,000), because small saucers
  are a rarity-gated subset (15–60% of saucer spawns). A "rarer" achievement whose top tier out-grinds
  its superset reads as a numbering slip. Recommendation: cap the top two tiers below the combined
  ladder → **5,000 / 7,500**. If Paul wants small-only to be *the* ultimate grind, revert to 10,000 —
  flagging, not forcing.

- **FLAG A-9-a — Salvage King interacts with the raised tow cap (B-8).** Per-game delivery totals
  rise once the cap can exceed 12. The 10/20/40/75/125/200 ladder still reads fine (200/game is a long
  session), but re-check once B-8's final cap ceiling is set; if the cap goes high, consider nudging
  platinum/diamond up. Noted as a cross-phase dependency, not a change now.

- **FLAG A-12-a — once-per-game event ladders softened.** Two of the four event counters can fire
  **at most once per game** by nature: **Glass Cannon** (you either reached wave 5 with no Health this
  game or you didn't) and **Shield Surfer** (10 deflects in *one game* — a per-game count). For those,
  a diamond of 1,000 means playing **1,000 whole qualifying games** — far beyond even Marathon Runner
  (10 h). Recommendation: soften their ladders to **1 / 5 / 20 / 50 / 125 / 300**. The other two
  (Freight Baron, Zen Master) *can* fire many times per game (see the fork), so their original
  1/10/50/150/400/1,000 stays.

---

## A-4. The per-event vs per-game fork (Paul's flagged fork)

**FORK A-fork-1 — increment cadence for A-11..A-14.** Paul leans per-event; treats it as a real fork.

- **Recommendation: per-EVENT, matching your lean** — but with a sharpening: **the fork only
  materially changes two of the four.** Glass Cannon (A-12) and Shield Surfer (A-14) are
  *inherently once-per-game* (their qualifying condition is a per-game state that can't re-fire), so
  per-event ≡ per-game for them regardless. The distinction is only real for:
  - **Freight Baron (A-11):** per-event = **every** ≥12-canister dock visit counts (a long game with
    several full hauls counts several). Per-game = at most 1/game.
  - **Zen Master (A-13):** per-event = **every** 5-in-a-row no-fire haul counts. Per-game = at most 1.
- Per-event is the more rewarding, more "stat-like" reading (Pillar 5: greed is a choice — reward the
  repeated risky haul), and it's why the 1/10/50/150/400/1,000 ladders make sense for those two.
- **Hooks if per-event:** increment `l.heavyHaulerEvents` at the dock-offload site the moment a
  single visit's delivered-count hits 12 (once per visit — latch it so it fires once, not per
  canister past 12); increment `l.pacifistTowEvents` the moment a haul's no-fire delivery streak hits
  5 (once per haul — the existing `pacifistStreak`/reset-on-fire machinery already exists).
- If Paul vetoes → per-game: increment all four once at game over from the per-game flags. Trivial to
  swap; the ladders for A-11/A-13 would then want softening too (like A-12/A-14).

---

## A-5. Definition audit (confirm these read sensibly against the shipped code)

All four Paul asked to pin down — checked against the actual tracking:

- **Pacifist Tow** = deliver 5 canisters across one continuous haul (pickup → dock) without firing;
  firing resets that haul's streak. **Matches shipped tracking:** `game.stats.pacifistStreak` is
  zeroed in the fire block (`Ship.update`, the `game.stats.pacifistStreak = 0` line), and
  `pacifistBest` records the best streak. The weekly `pacifist_tow` (goal 5) already reads
  `s.pacifistBest`. The new lifetime event (A-13) counts each haul that *reaches* 5. ✔ no conflict.
- **Close Shave** = survive an *unshielded* Hunter collision leaving HP `> 0` and `< 10`. **Matches:**
  `s.closeShave` is set at the Hunter-vs-ship contact site when the post-hit HP is under 10 (and the
  ship survived — `damageShip` only reaches there when not lethal). ✔
- **No Scratches** = complete wave 3 with zero damage *during wave 3 specifically* (per-wave, not
  cumulative-through-3). **Matches:** `s.dmgThisWave` is reset each `nextWave`, and the wave-clear
  block records `s.noScratchWave3` off `s.dmgThisWave === 0`. Already per-wave. ✔
- **Heavy Hauler** = 12-canister chain delivered in one dock visit. **Needs a redefinition** because
  B-8 makes the tow cap variable: "full chain" ≠ "12" once the cap can be 20. **Spec: Heavy Hauler
  (weekly) and Freight Baron (A-11) both key on a *fixed* threshold of ≥12 canisters delivered in one
  dock visit**, decoupled from `game.cargoMax`. This keeps the achievement meaning stable as the cap
  grows. (**FLAG A-5-a**: the lifetime `long_haul` "The Long Haul — deliver a full 12-chain 10×"
  should likewise be reworded to "≥12 in one visit" for the same reason; it currently reads
  `l.fullChains`, so define `fullChains` as "visits delivering ≥12," fixed at 12.)

---

## A-6. New weekly achievement

**Ask:** "clear a single wave with zero damage (hard, weekly-worthy) — the single-wave version,
distinct from the lifetime-cumulative Perfect Wave tiers."

- **FLAG A-6-b — as literally written it isn't hard, and it collides with No Scratches.** "Clear a
  single wave damage-free" is trivial at wave 1, and the pool *already* has **No Scratches** (clear
  wave 3 damage-free, weekly). A second "clear *a* wave damage-free" is redundant and easy.
- **Recommendation:** make it genuinely weekly-worthy by gating on a later wave:
  **"Flawless Run" — clear wave 8 (or later) without taking any damage** (`id:"flawless_run"`,
  `goal:1`, `cur: s => s.flawlessLateWave ? 1 : 0`, where the wave-clear block sets `flawlessLateWave`
  when `game.wave >= 8 && s.dmgThisWave === 0`). At wave 8 the Hunter family, saucers, and Debris
  density are all mid-ramp, so a damage-free clear is a real feat. Alternative if Paul prefers an
  orthogonal challenge: **"clear any wave damage-free while towing a full cargo chain"** (harder +
  on-pillar). Adopting **Flawless Run @ wave 8** as best-guess; flag to confirm the wave floor.
- Adding one weekly makes the pool **16** — see FLAG A-7-a.

---

## A-7. Consequences for the weekly rotation + tests

- **FLAG A-7-a — weekly count 15 → 16; the deterministic rotation shifts.** `poolIndex()` already uses
  `this.WEEKLY.length` (not a hardcoded 15), so the math self-adjusts — **but** `test-f9.js`'s
  expected values are pool-size-dependent (`poolIndex(2026,2)===9`, the exact 5-slice arrays, the
  wrap case). **These assertions MUST be recomputed for length 16**, or the regression will "fail"
  on correct code. Also update GDD §2.17 prose ("15 weekly" → "16 weekly") and the Architecture Map
  Achievements row.
- **FLAG A-7-b — the tiered lifetime rewrite invalidates the F9 lifetime-boundary tests.**
  `test-f9.js` currently asserts "every lifetime counter at its just-below/at-goal boundary" against
  single goals. Those become per-tier boundary checks (cross bronze, don't cross silver; big jump
  crosses two tiers → two unlocks; etc.). Budget real test-rewrite time in the achievements phases.

---

# PART B — ORBITAL OVERHAUL CHANGE SET 1

## B-1 & B-2. Pause from any state + ESC-to-pause (and reach Options/Difficulty/Achievements without starting a game)

> **✅ SHIPPED — v3.0 Phase 4 (revised). Spec now lives in GDD §2.9 / §2.16 + the Architecture Map Menu row.**
> The corrected scheme that shipped: controller **Start is a session toggle** (title/gameover → start a
> game; playing → open pause; paused → dismiss/resume); the Options/Achievements **system menu** opens
> from title/gameover via keyboard **"O"** and controller **B** (both context-aware "back" when a menu is
> open); keyboard **ESC** is the pause key (P retired, FLAG P4-a resolved: retired) and resolves to "back"
> inside a menu; A/Enter still start a game. FLAG P4-b (a single confirm can't both nav a menu and start a
> game) is handled by the gamepad else-if chain + the keyboard menu-open early return. The context-aware
> root and the whole Options/Controls/Achievements sub-tree are reused as described below.
>
> **FLAG B-1-a WITHDRAWN.** The mapping below (remap controller Start to open the menu, moving "start
> game" fully onto A) was **rejected by playtest and never shipped**. Start was left **unchanged from
> its original §2.15 spec** — it already session-toggled (start/pause/unpause on one button) before this
> phase touched anything, so no shipped-behavior change to Start was actually needed to satisfy B-1/B-2.
> The real shipped change was adding a *separate* system-menu opener (O/B) rather than overloading Start.
> **FLAG B-1-b resolved:** confirmed no double-action — see FLAG P4-b above.
>
> Historical planning text kept for record:

**Shipped reality (at planning time):** pause opened **only from `playing`** (`if (bindings.pause.keys.includes(k) &&
game.state === "playing") openPause()`, and the gamepad path `game.state === "playing" → openPause`).
`bindings.pause` = `["p"]` / Start; `bindings.back` = `["escape"]` / B; `bindings.confirm` =
`["enter"]` / A. `MENU_ROOT = ["Continue","Options","Quit"]`. So today the entire Options/Controls/
Achievements tree is unreachable unless you start a game first — exactly the long-standing
"menu reachable only via pause" limitation STATUS.md has flagged since F8.

**Spec:**

1. **ESC pauses during play.** Add `"escape"` to `bindings.pause.keys`. Because the keyboard menu
   handler checks `confirm → back → pause` in order, ESC inside a menu still resolves to **back**
   first (backs out one screen / closes root), and ESC *outside* a menu now toggles pause. Net: ESC
   and P both pause; ESC also backs. ✔ no collision (verified against the handler order at the
   `menuInput` dispatch).
2. **Open the menu from `title` and `gameover`, not just `playing`.** Change the open-gate so
   ESC/P (keyboard) and Start (gamepad) call `openPause()` in any state.
3. **Context-aware root menu** (this is the real design content):
   - From **`playing`** → root = `["Continue", "Options", "Quit"]` (unchanged).
   - From **`title` / `gameover`** → root = `["Options", "Achievements", "Back"]` (a **system menu**;
     "Back" closes the overlay and returns to the underlying screen; there's no game to Continue or
     Quit). This finally delivers the title-screen entry to Options + Achievements.
   - Implement as a small branch in `openPause()`/`drawRootMenu()`/`menuRoot()` keyed on
     `game.state`, reusing the *entire* tested Options/Controls/Achievements sub-tree unchanged.
4. **Preserve "start a game."** Enter (keyboard) and **A** (gamepad) still start a game from
   title/gameover. Only the *menu-open* action changes:
   - **FLAG B-1-a — controller Start no longer starts a game from the title; A does.** Today Start
     starts a game on title/gameover. To make Start the universal menu key (Paul's ask), move
     "start game" fully onto **A/confirm** (which already starts a game from title/gameover — see the
     `pressedConfirm && (title||gameover) → startGame` line) and make Start → `openPause()` in all
     states. This mirrors the keyboard (Enter=play, ESC=menu) and the standard console idiom
     (A=confirm, Start=menu). It's a small, deliberate shipped-behaviour change — flagging it as such.
5. **`game.paused` invariant.** Today `game.paused ⇔ a menu is open` *and the code assumes play
   state* (`update()` early-returns on `state !== "playing" || paused`). Opening the menu from title/
   gameover must keep the three-context input priority (rebind-capture → menu-open → normal) intact
   and must not let menu nav leak into a title "start." Since `update()` already skips the sim outside
   `playing`, the safe rule is: **`game.paused` may be true in any state while a menu screen is open**;
   the input handlers already check menu-open before normal reads. **FLAG B-1-b:** verify the
   title-screen "press Enter/A to start" prompt is suppressed (or ignored) while the system menu is
   open, so a confirm doesn't both navigate the menu *and* start a game.

**Testable (headless):** open/close from each of title/playing/gameover; ESC-as-pause outside a menu
vs ESC-as-back inside; the context-aware root arrays; Start→menu in all states while A→startGame on
title/gameover; no leak of menu input into `keys{}` or into a title start. Regression: the full
F8 menu suite must stay green.

---

## B-3. Starfield / motion reference (enhance the existing one — see FLAG P0-a)

The field exists but is near-invisible: `#1a2a40`, 1–1.8 px, uniform, density 40, no parallax.

**Spec (all additive, all cosmetic, no gameplay effect):**

- **Brighter + varied:** give each star a per-star brightness (e.g. an `a` field 0.35–1.0 driving a
  brighter base colour than `#1a2a40`), so the field reads without competing with entities. Keep it
  cool/desaturated so it never looks like a bullet or pickup (Pillar 1).
- **Denser:** raise `STAR_DENSITY` (e.g. 40 → ~70–90) — it already scales by world area, so this is
  one knob. Watch draw cost (`fillRect` per visible star is cheap; no `shadowBlur` on stars).
- **Parallax for real motion read (the actual request):** add **one nearer layer** drawn at a
  fraction of the camera offset (e.g. foreground stars move at 1.0×, a second sparse brighter layer
  at ~0.5×), so the ship's motion produces visible relative drift/depth instead of a rigid field that
  translates in lockstep. This is what makes movement legible against "something in the world."
  - **FLAG B-3-a — parallax + a toroidal world need care at the seam.** The current field is
    world-fixed and wrap-aware via `shortDelta`; a parallax layer moving at ≠1× is *not* world-fixed,
    so it can't reuse the same wrap math directly. Simplest robust approach: tile the parallax layer
    in **screen space** modulo its own spacing (a scrolling screen-space texture keyed off
    `camera * factor`), which avoids seam artefacts entirely. Keep the existing 1.0× layer as the
    world-fixed reference. Flag the seam behaviour as a browser playtest item.
- New tuning constants in the v1.2 world block: `STAR_DENSITY` (retune), `STAR_PARALLAX_FACTOR`,
  `STAR_BRIGHT_MIN/MAX` (or a `STAR_COLOR_NEAR/FAR`).

**Testable (headless):** `drawStarfield` still crash-free in title + playing; no gameplay effect
(driving `update()` with the ship moving/wrapping changes no score/HP/entities). The *look* is a
browser-only judgement (brightness, density, whether parallax reads as depth).

---

## B-4 & B-5. Powerup expiry modes + new "Difficulty" Options screen

> **✅ SHIPPED — v3.0 Phase 5. Spec now lives in GDD §2.14 (powerups) + §2.16 (menu/persistence) + the Architecture Map.**
> Two additive, `"time"`-defaulting settings in `afd_settings_v1` — `shotPowerupMode` (`"time"`|`"shots"`) and
> `magnetMode` (`"time"`|`"pieces"`). Count budgets live in `game.powerBudget {rapid,triple,magnet}`; a single
> `powerActive(type)`/`powerMode(type)` pair routes every effect-active read (fire block, `maxBullets`,
> `chainMass`, Magnet pull, HUD) so the two modes can't diverge. Rapid/Triple decrement **per trigger-pull**
> (a Triple 3-fan is one pull; both budgets tick once per pull and end independently); Magnet decrements **per
> canister hooked** (at the hook, not the pull). Same-type pickup refreshes the budget/timer to full, never
> stacks. New Options → **Difficulty** screen (`menuDifficulty`/`drawDifficulty`, `DIFFICULTY_ROWS`) with the two
> toggle rows + Back. Headless-verified in `scratchpad/test-p5.js` (57 assertions); F8 menu suite still green.
>
> **All four FLAGs resolved as recommended:** B-4-a (default `"time"`, nothing changes until opted in) ✔;
> B-4-b (Rapid+Triple both decrement once per pull, each ends independently — a 3-fan is one pull) ✔;
> B-4-c (screen left structured to grow — add a `DIFFICULTY_ROWS` entry + switch case + renderer row) ✔;
> B-5-a (count at the hook, so a draw-then-hook spends once — no double-spend) ✔.
>
> Historical planning text kept for record:

**Shipped:** the four timed powerups (Rapid, Triple, Magnet, Engine) all expire on
`POWERUP_DURATION` (15 s), counted down in `update()` (`game.powerFx[k] -= dt`), regardless of use.
Requests B-4/B-5: let **shot powerups** (Rapid, Triple) expire after a number of **shots**, and the
**Magnet** expire after a number of **garbage pieces collected** — as a **configurable option** in a
new **Options → Difficulty** screen (choose time-based *or* count-based).

**Spec:**

- **Two settings, each a mode toggle** (persisted in `afd_settings_v1`, additive fields):
  - `shotPowerupMode`: `"time"` (default, current behaviour) | `"shots"`.
  - `magnetMode`: `"time"` (default) | `"pieces"`.
  - **FLAG B-4-a — default to `"time"`** so nothing changes for anyone until they opt in; the
    additive settings fields tolerate a missing key on load (no persistence-schema bump needed).
- **Count-based expiry (when selected):** replace the per-effect countdown with a per-effect
  *budget*. Track budgets in a parallel `game.powerBudget { rapid, triple, magnet }` (remaining
  shots/pieces; the effect is active while `> 0`).
  - **Rapid / Triple** decrement per **shot event** (one trigger-pull), *not* per bullet — a Triple
    volley of 3 bullets is **one** shot. Decrement in the fire block right where a shot fires.
    Constants `RAPID_SHOTS` (e.g. 40), `TRIPLE_SHOTS` (e.g. 30) — first-pass, tunable.
    - **FLAG B-4-b — what counts as "one shot" and the Rapid+Triple interaction.** With both active,
      `maxBullets()` uses Triple's cap and each pull fires a 3-fan; decrement **both** budgets by one
      per pull (they're separate effects). When one budget hits 0, that effect ends independently
      (e.g. Triple runs out → single shots continue under Rapid until Rapid's budget ends). Confirm
      this reads sensibly in play.
  - **Magnet** decrements per **garbage piece hooked** while active (at the pickup site, once per
    canister added to the chain). Constant `MAGNET_PIECES` (e.g. 20). **FLAG B-5-a:** does a piece
    pulled by the magnet *and* auto-hooked count once (yes — count at the hook, not at the pull) so a
    magnet that draws-then-hooks doesn't double-spend.
- **Same-type refresh rule** carries over: picking up the same powerup while active **refreshes** the
  budget (or the timer) to full — never stacks. (Matches the shipped `refresh, not add` rule.)
- **HUD:** the active-powerup row already shows a duration bar per timed effect. In count mode, show
  the same bar as `remaining / budget` (shots or pieces), with the count as the label. One renderer,
  two data sources.
- **New "Difficulty" Options screen:**
  - Add `"Difficulty"` to `MENU_OPTIONS` (before `"Back"`): →
    `["SFX Volume","Music Volume","Master Volume","Controls","Achievements","Difficulty","Back"]`.
  - New sub-screen `"difficulty"` (mirror the tested `menuOptions`/`drawOptionsMenu` pattern): two
    rows, each a left/right toggle — **"Shot powerups expire: Time | Shots"** and **"Magnet expires:
    Time | Pieces"** — plus Back. Navigable by keyboard or gamepad through the existing `menuInput`
    dispatcher (left/right flips the toggle, like the volume sliders adjust).
  - Persist both modes on change; load once at startup over defaults (same path as volumes/bindings).
  - **FLAG B-4-c — this screen is a clean place for future difficulty knobs** (e.g. the B-8 tow-cap
    ceiling, or an "aggressive Hunters" toggle). Scope *this* phase to only the two mode toggles
    Paul asked for; leave the screen structured to grow.

**Testable (headless):** mode default = time (unchanged behaviour); in `"shots"` mode a Rapid effect
ends after exactly `RAPID_SHOTS` trigger-pulls (Triple counts a 3-fan as one), Rapid+Triple budgets
decrement independently; in `"pieces"` mode Magnet ends after exactly `MAGNET_PIECES` hooks (counted
at hook, not pull); same-type refresh restores the budget; the toggles flip + persist round-trip; the
Difficulty screen draws without throwing. Regression: F8 menu suite green with the extra row.

---

## B-6. Fire-rate rebalance (normal slower, rapid faster)

**Shipped:** one `FIRE_COOLDOWN = 0.16` used for *every* shot. Rapid Fire only raises the **bullet
cap** (`maxBullets()` 4→8) — it does **not** change the cooldown. That's exactly why Paul feels rapid
fire isn't actually faster: more bullets can be alive, but the trigger cadence is identical.

**Spec:**

- Split the single cooldown:
  - Base **`FIRE_COOLDOWN`** slightly **slower** — proposed **0.16 → 0.20 s** (first-pass; tunable).
  - New **`RAPID_FIRE_COOLDOWN`** clearly **faster** — proposed **~0.09 s** (first-pass; tunable).
- Fire block: `this.cooldown = (game.powerFx.rapid > 0 || rapidBudgetActive) ? RAPID_FIRE_COOLDOWN :
  FIRE_COOLDOWN;` (respecting whichever expiry mode B-4/B-5 uses to decide "rapid is active").
- Rapid keeps its higher cap (8). Triple keeps the base cooldown (Paul didn't ask to speed Triple);
  the 3-fan on the *base* cadence is unchanged.
- **FLAG B-6-a — Rapid+Triple becomes a notably stronger combo** (fast cadence *and* Triple's cap of
  12 *and* the 3-fan). That's a fun "everything at once" moment, but flag it as a playtest balance
  item — if it's too dominant, the lever is `RAPID_FIRE_COOLDOWN` up a touch.
- **FLAG B-6-b — slowing base fire touches early-game feel** (opening waves rely on the base gun).
  0.20 s is a mild nerf; judge in-browser against wave 1–3 clear time. `FIRE_COOLDOWN` is the one
  knob.

**Testable (headless):** with Rapid inactive the cooldown after a shot equals `FIRE_COOLDOWN`; with
Rapid active it equals `RAPID_FIRE_COOLDOWN`; drive the real fire block over N frames and count
shots-per-second in each mode to confirm the faster/slower relationship.

---

## B-7. "Satellites remaining" HUD count + explaining wave-end

**Answering Paul's question first:** yes — a wave ends when the field is clear. The exact gate is
one line in `update()`: **`if (game.debris.length === 0 && game.hunters.length === 0)`** → after a
2.5 s grace → `nextWave()`. So the "pieces remaining" number is literally
`game.debris.length + game.hunters.length` — and because each split child is its own array entry,
Paul's example holds exactly: 3 large Debris reads **3**; shoot one large → it becomes 3 mediums →
the array now holds 2 large + 3 medium = **5**. ✔ every tier of every size counts.

**Spec:**

- Add a HUD readout (near the CARGO line): **`TARGETS n`** where `n = game.debris.length +
  game.hunters.length`. Lit while `n > 0`.
- **FLAG B-7-a — the count can *rise* mid-wave, and that's honest.** Two ways it goes up: (a) a
  Satellite splitting (a large → 3 mediums, +2), which Paul wants; and (b) a **Hunter lineage
  spawning on its timer** (Hunters arrive from wave 2 on a 14–32 s timer, one lineage at a time —
  they are *not* present at wave start). So a player who clears all Debris may see `TARGETS` jump from
  0-ish back up when a Hunter core slides in. Since the wave genuinely won't end until the Hunters are
  cleared too, the HUD should reflect that truth rather than lie about being "done."
  - **Recommendation:** show the true combined count and label it **`TARGETS`** (not "SATELLITES
    LEFT," which implies a fixed at-start budget). Optionally split the readout as
    **`DEBRIS n · HUNTERS m`** so the Hunter arrival reads as "a new threat appeared," not "the number
    went backwards." Best-guess: single `TARGETS n`; flag the two-part variant as the fallback if the
    jump confuses in playtest.
- **FLAG B-7-b — Hunters only appear from wave 2.** On wave 1 there are no Hunters, so `TARGETS`
  equals the Debris count exactly; from wave 2 it includes any active Hunter lineage.

**Testable (headless):** `TARGETS` equals `debris.length + hunters.length` across a split (3→5 after
one large Debris kill) and across a Hunter spawn; reads 0 exactly when the wave-clear gate trips.

---

## B-8. Increase max tow cargo (progression), with a physics retune

**Shipped:** `CHAIN_MAX = 12`, read directly at the pickup gate
(`game.chain.length < CHAIN_MAX`) and the HUD (`"CARGO " + game.chain.length + "/" + CHAIN_MAX`).
The mass penalty scales with `chainMass()` (Σ node.mass): a full 12 of mass-1.0 ⇒ m=12 ⇒ ~45%
thrust, ~63% top speed. GDD §2.10.1 explicitly warns: *"Beyond ~12 nodes the thrust penalty makes
the ship feel broken rather than heavy, and constraint chains that long start whipping. If raising
the cap, retune `CARGO_THRUST` down."* And §3.4's stability envelope is validated only at
**12 nodes / 3 constraint iterations / dt ≤ 0.05**.

So this is **not** a one-number bump — it's a small physics phase. Two parts:

**Part 1 — a growing, variable cap.**

- Replace the constant read with a runtime `game.cargoMax`, starting at `CARGO_BASE` (**12**) and
  growing to `CARGO_CAP_MAX` (**proposed 20** — the ceiling before feel/perf degrade; tunable).
- **FORK A-fork-2 — how the cap grows.** Paul offered per-level-progression *or* per-recycled-count.
  - **Recommendation: per canisters recycled (delivered) in the current run** — e.g. +1 cap per
    `CARGO_GROW_PER` (proposed 30) canisters delivered, up to `CARGO_CAP_MAX`. This is the more
    **on-pillar** choice: tying capacity to *engaging with the salvage loop* directly rewards the
    greed mechanic (Pillar 5) rather than passively handing it out by wave. It also self-paces —
    heavier haulers earn heavier hauling.
  - **Alternative (simpler, more predictable): per wave** — +1 every `CARGO_GROW_WAVES` (e.g. 3)
    waves. Cleaner to reason about; less thematically tied to the loop.
  - Either way, the growth is bounded by `CARGO_CAP_MAX`. Best-guess adopts **per-delivery**; flag to
    confirm before building.
- HUD becomes `CARGO n/{game.cargoMax}`. Show a brief float/toast when the cap increases ("TOW +1").
- Reset `game.cargoMax = CARGO_BASE` in `startGame`.

**Part 2 — the physics/feel retune (the actual work).**

- **Soften the mass penalty so a long chain feels heavy, not broken.** With the current curve, m=20
  ⇒ thrust /(1+20·0.10) = /3 ≈ 33% and top speed /(1+20·0.05) = /2 = 50%. That's the "broken" zone
  §2.10.1 warns about. Retune `CARGO_THRUST` (the 0.10 divisor coefficient) and `CARGO_TOPSPEED`
  (the 0.05) **down** so that a *full* chain at the new `CARGO_CAP_MAX` lands at roughly today's
  12-node feel (~45% thrust / ~63% top speed), i.e. the penalty-per-node shrinks as the ceiling
  rises. Keep the momentum-tug `massFactor` cap (`min(1.4, m·0.12)`) sensible at the higher m.
  - **FLAG B-8-a — Engine powerup interaction.** Engine halves effective mass in `chainMass()`
    (`ENGINE_MASS_MULT = 0.5`), so a full 20-chain under Engine behaves like m=10 — re-check that
    both the with- and without-Engine feels are acceptable at the new ceiling.
- **Re-validate chain stability at the new node count.** §3.4: constraints are validated at 12
  nodes / 3 iterations. A 20-node verlet chain may whip or sag; **bump the relaxation iterations**
  (3 → 4 or 5) if the headless stability test (rule 7) shows drift, and re-confirm the `drawLink`
  120 px wrap-skip still reads. This is the load-bearing risk of the phase.
- **FLAG B-8-b — "full chain" achievements decouple from the cap.** Heavy Hauler / Freight Baron /
  The Long Haul must key on a **fixed ≥12** delivered-in-one-visit, *not* on `game.cargoMax` (see
  A-5). Coordinate with the achievements phases (this phase ships first; the achievements phases
  consume the fixed-12 definition).
- **FLAG B-8-c — performance.** More towed nodes + the higher canister volume already flagged in the
  Bug Watch List means more `shadowBlur` in dense late waves. Watch frame rate at `CARGO_CAP_MAX`;
  `GARBAGE_DECAY` and a global glow toggle remain the density levers.

**Testable (headless):** `cargoMax` starts at 12, grows by the chosen rule up to `CARGO_CAP_MAX` and
never exceeds it; the pickup gate and HUD both read `cargoMax` (not the old constant); a full chain
at `CARGO_CAP_MAX` produces the retuned thrust/top-speed multipliers (assert the target ratios);
chain constraint stability holds at `CARGO_CAP_MAX` nodes across wrap and hard thrust-flips
(revalidate per §3.4 rule 7). The *feel* is a browser-only judgement.

---

## Constants added/changed this cycle (grouped by phase — the tuning-first convention holds)

- **Starfield (B-3):** `STAR_DENSITY` (retune), `STAR_PARALLAX_FACTOR`, `STAR_BRIGHT_MIN/MAX` (v1.2 world block).
- **Fire rate (B-6):** `FIRE_COOLDOWN` (retune 0.16→~0.20), new `RAPID_FIRE_COOLDOWN` (~0.09).
- **Powerup expiry / Difficulty (B-4/B-5):** `RAPID_SHOTS`, `TRIPLE_SHOTS`, `MAGNET_PIECES`; settings
  `shotPowerupMode`, `magnetMode` (default `"time"`); a `"difficulty"` menu screen + a `MENU_OPTIONS` row.
- **Tow cap (B-8):** `CARGO_BASE` (12), `CARGO_CAP_MAX` (~20), `CARGO_GROW_PER` (~30) *or*
  `CARGO_GROW_WAVES`; retuned `CARGO_THRUST`/`CARGO_TOPSPEED`; possibly `CHAIN_ITER` (3→4/5).
- **Achievements (A):** `TIER_NAMES`, `TIER_COLOR[]`; new lifetime counters `maxWaveNoPowerup`,
  `smallSaucerKills`, `bestDeliveredGame`, `bestDebrisGame`, `heavyHaulerEvents`, `glassCannonGames`,
  `pacifistTowEvents`, `shieldSurferGames`; persistence key `afd_achievements_v2`.

---

## Open items NOT in this change set (noted, not spec'd)

- **Waste Not** (degenerate: cheesable by dying early) — a v2.0 curation item, not in Paul's list.
  Since the achievements phases are open in this module anyway, flag: if Paul wants it fixed now, the
  cleanest redefinition is "finish a game **past wave N** with zero canisters expired" or drop it from
  the weekly pool. Left as-is unless Paul says otherwise.
- **The joint F3+F10 Debris-density retune** — the last v2.0 tuning lever; a browser-playtest pass,
  not code. Independent of this cycle.
- **Title-screen menu entry** — *delivered incidentally by B-1/B-2* (the system menu from the title).

---

*End of v3.0 planned features. Every "kept/proposed/changed" number is first-pass and tunable; the
FLAGs mark the calls that want a browser playtest read or a Paul decision. The two FORKs
(A-fork-1 event cadence, A-fork-2 cap growth) have recommendations but are yours to set.*