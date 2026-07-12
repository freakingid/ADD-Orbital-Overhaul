# DIFFICULTY LEVERS — living registry

This is a **living document** — it is never archived, unlike the version-suffixed
planning docs (`PLANNED-FEATURES-vX.md` / `IMPLEMENTATION-PHASES-vX.md`). Every
difficulty lever, present and future, gets an entry here regardless of which
version shipped it. Update this file in the same commit that adds, retunes, or
enables/disables a lever.

## 1. Purpose

A **difficulty lever** is a small, named, catalogued knob that scales one
gameplay quantity from an easy wave-1 value toward its shipped baseline as the
game's existing difficulty ramp progresses. Levers exist so that:

- Difficulty tuning is **discoverable in one place** instead of scattered as
  ad hoc `if (game.wave > N)` checks at call sites.
- A lever can be **built, wired, and tested while shipping inert** — landing
  the plumbing and a phase's balance change (if any) as separate, reviewable
  steps.
- Every lever follows the **same shape and the same curve**, so reading one
  teaches you how to read all of them.

## 2. The mechanism

```js
// A difficulty lever scales a quantity from `start` (wave 1) toward `floor` (full difficulty)
// along the SHIPPED difficultyFactor() curve — levers never get their own curve. When
// `enabled` is false the lever is INERT: the quantity is pinned at `start`, so the lever is
// built, wired and testable but does not ramp. `floor` is a HARD CLAMP — a lever can never
// take a quantity below its shipped baseline.
function leverScale(lever, wave) {
  const s = lever.enabled ? ramp(lever.start, lever.floor, wave) : lever.start;
  return Math.max(lever.floor, s);
}
```

A lever is a plain object: `{ enabled, start, floor }`.

- **`start`** — the value at wave 1 (and, while disabled, at every wave).
- **`floor`** — the value the lever ramps *toward* as difficulty climbs. This
  is always the **shipped baseline** — the value the game already had before
  the lever existed.
- **`enabled`** — when `false`, the lever is **inert**: `leverScale` always
  returns `start`, at every wave. The lever is fully wired into real entity
  construction and is proven-by-test to ramp correctly, but nothing about
  observed gameplay changes until someone flips it on.
- **The floor is a hard clamp.** `Math.max(lever.floor, s)` guarantees a
  lever can never push a quantity past (i.e. below, since levers describe
  *easing off* difficulty) its shipped baseline. **Making the game harder
  than today requires changing the baseline itself (the constant the lever
  wraps), not flipping a lever.** Levers only ever return the game toward
  today's difficulty from an easier starting point — they are not a general
  difficulty-*increase* mechanism.
- **Levers ramp on `game.wave` via the existing `difficultyFactor`/`ramp`
  curve (§2.13 of the GDD) — they never get a private curve.** `RAMP_WAVES`
  is the one knob that governs the whole game's pacing; a lever piggybacks
  on it rather than duplicating it, so tuning `RAMP_WAVES` retunes every
  lever at once, consistently.
- **Levers are evaluated at entity construction, not per frame.** A lever's
  effect is baked into an entity (a `Powerup`, a `Dock`, …) once, when it's
  created. Ramping therefore only affects newly-spawned objects going
  forward — it never mutates something already on screen mid-frame, and the
  per-frame `update()`/`draw()` paths never call `leverScale` themselves.

## 3. Lever registry

| Lever | Constant | Scales | start | floor | Enabled? | Shipped | Playtest status |
|---|---|---|---|---|---|---|---|
| Powerup size | `LEVER_POWERUP_SIZE` | `Powerup.radius` (baseline `POWERUP_RADIUS` = 15) | 2.0 | 1.0 | **false** | v3.4 P2 | Not yet playtested — ships disabled (tooling only) |
| Dock size | `LEVER_DOCK_SIZE` | `Dock.radius` (baseline `DOCK_RADIUS` = 44) | 2.0 | 1.0 | **false** | v3.4 P2 | Not yet playtested — ships disabled (tooling only) |

Both v3.4 P2 levers share the same shape (`start: 2.0, floor: 1.0`), so their
only observable effect while shipped disabled is that powerups and the
recycling dock are permanently **2×** their pre-lever size (`start` pinned).
Enabling either lever would instead make wave 1 spawn at 2× and shrink toward
the familiar 1× baseline as difficulty ramps — an "ease players in with a
bigger, easier target/dock" difficulty knob, not yet turned on.

## 4. Assumptions & Decisions

- **Levers ramp on `game.wave` via the existing `difficultyFactor` curve.**
  They do **not** get their own curve — `RAMP_WAVES` governs the whole
  game's pacing (GDD §2.13), and a second, independent curve per lever would
  make the game's difficulty progression illegible across systems.
- **A lever's `floor` is always the SHIPPED BASELINE.** Enabling a lever can
  only ever return the game to today's difficulty, never past it. Making the
  game harder than today requires a baseline change (editing the constant a
  lever wraps, e.g. `POWERUP_RADIUS` itself), not a lever flip.
- **Levers are evaluated at ENTITY CONSTRUCTION, not per frame.** Ramping
  affects newly-spawned objects only, and the per-frame update/render paths
  never touch `leverScale`.
- **Both v3.4 levers ship disabled.** They are tooling for a future playtest
  round, not a balance change — the observable effect of v3.4 P2 is simply
  that powerups and the dock are permanently 2× their old size (since
  `start = 2.0` is pinned while `enabled = false`).

## 5. Candidate levers not yet built

A running list for future rounds — not yet implemented, not yet named
constants:

- **`HUNTER_GARBAGE` counts** — the per-tier garbage-drop table (§2.5/§2.5.1
  of the GDD). A lever could ease the Hunter-side garbage amplifier in
  earlier waves.
- **`GARBAGE_DECAY`** — the single-canister decay clock (§2.10.1). A lever
  could make early-wave garbage linger longer (an easier, more forgiving
  field) before tightening to the shipped decay rate.
- **`POWERUP_DROP_CHANCE`** — the small-tier-kill drop roll (§2.14). A lever
  could raise early-wave drop odds to onboard new players faster.
- **`CARGO_GROW_PER`** — the per-delivery tow-cap growth rate (§2.10.2). A
  lever could make the cap grow faster early on, easing the greed-vs-safety
  tension before the game reaches full intensity.
