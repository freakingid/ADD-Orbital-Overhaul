# PLANNED-FEATURES-CS034 — Orbital Overhaul

Spec for changeset 034. **What and why.** Execution order and per-phase prompts live in
`IMPLEMENTATION-PHASES-CS034.md`.

Written against a fresh clone at `212e542` ("cs-33 p5: closing phase — version 1.0.0.33,
stats invariant correction, doc sweep"), `GAME_VERSION = "1.0.0.33"`, registry **87**,
`LEVERS` **18**, suite **130/130 on a full clone**. Every symbol named below was grepped
against that build.

---

## §0 Corrections to prior assumptions

**These correct things the scope doc, `CLAUDE.md`, or `STATUS.md` currently say. Read this
section before anything else.**

### §0.1 ⛔ The stats-registry invariant in `CLAUDE.md` is factually wrong

`CLAUDE.md`'s Leaderboard block states that the Worker's `statsFields` registry "is not
visible from this repo." It is. `github.com/freakingid/coinless-kit` holds
`services/leaderboard/src/registry.js`, and the registered keys for `orbital-overhaul` are:

```
wave_reached, canisters_delivered, hunter_kills, saucer_kills, debris_destroyed
```

The build sends `garbage_satellite_kills`, which is **not** one of them. Per the Worker's own
contract an unrecognized key doesn't reject the submission — it **flags the row**, which is
the same `⚑` marker `drawLeaderboard()` renders next to bounds-check failures. **Every score
posted since CS033 P3 is displaying as flagged on the public board.**

CS033 accepted this as "cosmetic risk only" *because the registry could not be checked*. It
can be now, and the guess was wrong. Fixed in P4.

### §0.2 The vocabulary is INVERTED in code, not merely inconsistent

| Canonical term (CS034) | What the build calls it | Sites |
|---|---|---|
| **Garbage Satellite** — shoot it, it splits | `DebrisSatellite`, `DEBRIS_*`, `game.debris`, `destroyDebris`, `debrisKills` | ~97 |
| **Debris** — tow it to the dock | `Garbage`, `GARBAGE_*`, `game.garbage`, `coalesceGarbage`, "canister" | ~181 |
| **Hunter Satellite** | `HunterSatellite`, `HUNTER_*` | ~59 — already correct |
| **Recycle dock** | `Dock`, `DOCK_*`, renders `"RECYCLE"` | already correct |

Each of the two nouns is currently attached to the *other* object. This is not a tidy-up; it
is a systematic inversion that has propagated into player-facing strings.

### §0.3 Three scope items are already satisfied or moot

- **Item 8 (10 profiles)** — `PROFILE_MAX` is already **8**, not 3. The 3 is `SLOT_COUNT`,
  save slots *per profile* (CS032). **Dropped from CS034** (FORK-G).
- **Item 11 (duration excludes pause)** — already true. `game.stats.gameTime += dt` sits
  inside `update()`'s body, past the early return gating on
  `game.state === "playing" && !game.paused && !game.celebration`. Pause, the death
  spectacle, and the celebration panel are all already excluded. **Dropped from CS034**
  (FORK-F).
- **Item 2's "debug knobs"** — none exist. `HUNTER_GARBAGE` / `HUNTER_SMALL_MASS` are plain
  consts, not registry rows. Nothing to remove from the panel.

### §0.4 Items 10 and 12 are partly outside this repo

`kit-leaderboard` v0.1.0's `fetchBoard({window, limit})` takes **no player or scope
parameter**, and `services/leaderboard/src/board.js` does `PARTITION BY player_id … rn = 1`
— one row per player, no per-player view. `game_version` **is** a populated D1 column but
`board.js` never SELECTs it and the module's `entries.map` never maps it.

Per FORK-E, CS034 stays in this repo:

- **Item 12's Duration column ships now** — `durationS` is already mapped by the module.
- **Item 12's Version column and all of item 10 defer** to a `coinless-kit` changeset. Two
  small edits there (add `game_version` to the SELECT + entry map; add a `player` scope
  param), then a follow-up game changeset renders them.

### §0.5 Undocumented state found on the shallow clone

`STATUS.md` says "ten suite files still hard-fail, not skip, on a shallow clone." The real
count is **fourteen**: `test-cs017-p6`, `cs019-p1`, `cs020-p1`, `cs020-p1b`, `cs023-p2`,
`cs023-p3`, `cs024-p1`, `cs024-p2`, `cs024-p4`, `cs024-p6b`, `cs024-p6f`, `cs026-p1`,
`cs026-p2`, `cs029-p1`. Full clone is clean at 130/130. Corrected in the closing phase; not
otherwise this changeset's work.

Two further doc gaps, both closed in the closing phase:

- `tools/emblem-lab.html` exists on disk and appears once in the GDD, but is **missing from
  `CLAUDE.md`'s "Design instruments" list.**
- **CS033 shipped the online leaderboard with no GDD §2 section.** §2 ends at 2.22
  (Save/Load). CS034 adds **§2.23 Online Leaderboard** describing shipped CS033 behavior
  plus this changeset's changes.

---

## §1 Vocabulary (scope item 1) — FORK-A → (a), FORK-B → yes

### §1.1 The canonical terms

| Term | Definition |
|---|---|
| **Garbage Satellite** | The satellites the player shoots for cleanup. Splits into smaller Garbage Satellites when hit; the smallest tier is destroyed outright. Sheds **Debris** on destruction. |
| **Debris** | The towable objects the player scoops, chains, and delivers. Coalesces into **Hunter Satellites** if neglected. |
| **Hunter Satellite** | Actively homing enemy born from coalesced Debris. Splits 3-way on each hit down to the small tier. |
| **Recycle dock** | Where Debris is delivered for points. |

### §1.2 Scope of the correction

**Docs and player-facing strings only. No code-symbol renames.** A full rename is ~278 sites
across a 771 KB build plus a 463 KB GDD, and buys nothing a glossary doesn't.

**Corrected:**
- `CLAUDE.md` — a new **Vocabulary** section carrying the table above *and* the inversion
  map, stated explicitly so a future session reads `game.debris` correctly.
- `ORBITAL-OVERHAUL-GDD.md`, `DIFFICULTY-LEVERS.md`, `RATIONALE.md`, `EXTERNAL-FILES.md`,
  `DECISIONS.md`, `STATUS.md` — prose brought to canonical terms where it names an object.
- Achievement `name` / `desc` strings.
- `DEBUG_VARS` row `label` strings naming an object.
- In-game HUD / menu / floater strings naming an object.

**Not corrected:**
- Any code identifier — class, const, function, field, or object key.
- `archive/` and `log/` — the existing ⛔ in `CLAUDE.md` forbids sweeping them, and that
  holds here.
- **Achievement `id` values** (FORK-B). `satellite_buster`, `field_sweeper` et al. are keys
  inside every player's persisted unlock set (`afd_achievements_v2`,
  `lifetimeUnlocked` / `weeklyUnlocked` / `lifetimeTiers`). Renaming one silently drops that
  achievement's unlock for every existing player. **⛔ ids are save data. Never rename one.**
- The Worker's `debris_destroyed` stat key (FORK-D3). It is the old vocabulary, frozen in
  rows already submitted. Recorded in the glossary as a known legacy name, exactly like
  `game.debris`.

### §1.3 Specific string corrections

Grep anchors, by `id`:

| Anchor | Current text | Becomes |
|---|---|---|
| `satellite_buster` | "Destroy 15 Debris Satellites in one game." | "Destroy 15 Garbage Satellites in one game." |
| `field_sweeper` | "Most Debris destroyed in one game (best)." | "Most Garbage Satellites destroyed in one game (best)." |
| `waste_not` | "…no Hunters born from neglected scrap." | "…no Hunter Satellites born from neglected Debris." |
| `garbageAttractRadius` | "Garbage attraction radius" | "Debris attraction radius" |
| `garbageAttractForce` | "Garbage attraction force" | "Debris attraction force" |
| `garbageSoftMax` | "Garbage soft max" | "Debris soft max" |
| `garbageHardMax` | "Garbage hard max" | "Debris hard max" |
| `debrisBounceRestitution` | "Satellite bounce restitution" | "Garbage Satellite bounce restitution" |

Every achievement `desc` reading "canister(s)" becomes "Debris" with the count preserved —
e.g. `scrap_runner` "Deliver 20 canisters to the dock in one game." → "Deliver 20 Debris to
the Recycle dock in one game." Achievement **names** are proper nouns and stay
(`Scrap Runner`, `Recycling Magnate`, `Ton of Scrap` are all fine as flavour).

⚠ The Debug panel's `label` strings feed `DEBUG_ROWS` label-dispatch in `menuDebug()`. Two
action rows are dispatched **by label string** (`"Reset all debug knobs to defaults"`,
`"Reset saved scores"`). Neither names an object, so neither changes — but any label edit
must be checked against that dispatch.

---

## §2 Hunter Satellites shed no Debris (scope item 2) — FORK-C → (b)

### §2.1 What changes

`destroyHunter()` currently emits `HUNTER_GARBAGE[h.size]` Debris at every tier — `{3:3,
2:2, 1:1}`. After CS034:

- **Large (size 3) and medium (size 2): no Debris.** They still 3-way split into the next
  tier, and the large core still drops its one powerup.
- **Small (size 1): unchanged.** It still emits its `HUNTER_GARBAGE[1] = 1` low-mass
  (`HUNTER_SMALL_MASS`) piece.

### §2.2 Why the small tier is kept

A small Hunter spawns **no children** — the Debris is its entire payload. Removing it makes
a small Hunter a zero-yield kill, and the small tier is nine of the thirteen bodies in a full
lineage. Hunter's Bane (`ACH_LINEAGE_FULL = 13`) would become thirteen kills for one piece of
Debris.

The net economy change is still large: a full lineage drops from 3 + (3×2) + (9×1) = **18**
pieces to **9**.

### §2.3 ⚠ This reverses a documented deliberate decision

The comment above the emission block reads:

> v3.3 P4 (9b, reverses v3.2 P3's FORK-B/B1): EVERY Hunter drops garbage at its tier counts,
> regardless of origin. This reopens the 12-in/66-out amplifier a coalesced lineage
> represents — deliberately: 9a's single-decay is now the governor holding the field, not
> emission suppression.

That decision is being partially reversed again, with sign-off. The **implementing phase must
replace that comment**, not leave it contradicting the code. The new comment records: CS034
removed large/medium emission; the small-tier pile survives because it is that tier's whole
payload; and 9a's single-decay remains the field governor.

`HUNTER_GARBAGE` stays a three-key table with `{3:0, 2:0, 1:1}` rather than collapsing to a
scalar — the shape is what makes a future per-tier change a data edit.

### §2.4 Not touched

- `destroyHunter()`'s 3-way split. **⛔ THREE, HARDCODED** stands — `ACH_LINEAGE_FULL = 13`
  depends on it.
- The large core's `dropPowerup()`.
- `HUNTER_SMALL_MASS`.
- `superMegaDelivery()`'s sweep, which calls `destroyHunter(h, true)` per body and inherits
  the change.
- `coalesceGarbage()` — Debris → Hunter conversion is untouched in both directions of intent.

### §2.5 Balance consequence to watch at the gate

Hunters were a meaningful Debris source at high waves, where `largeHunterCap` lets several
lineages run at once. Halving that supply may make late waves thinner than intended for
delivery-combo achievements (`heavy_hauler` at 12, `max_haul` at `CARGO_CAP_MAX` 24). This is
a **gate question**, not a pre-emptive compensation — nothing about junk spawn rates changes
in this changeset.

---

## §3 Delivery score readout (scope item 4) — FORK-L → (a)

### §3.1 The complaint

The pinned ticker at the Recycle dock is too small, holds too briefly, and fades too fast for
the player to read the per-piece climb that the chain bonus produces.

### §3.2 What exists today

CS029 P4 model C: one `FloatText` per dock visit, `pinned = true`, born at
`(dock.x, dock.y - DOCK_RADIUS * DELIVERY_FLOAT_ANCHOR_FRAC)` with `DELIVERY_FLOAT_ANCHOR_FRAC
= 0.50`. Its `.total` accumulates and `.text` is rewritten `"+" + total` as each piece lands.
`releaseDeliveryTicker()` un-pins it at the visit's last piece, after which it rises at
`DEBUG.deliveryFloatRise` (160 px/s) and fades over `DEBUG.deliveryFloatLife` (1.2 s).
Font size is **hardcoded 16**.

`FloatText.draw()` computes `globalAlpha = max(0, life / life0)` — a linear fade over the
floater's whole lifetime, so there is no full-opacity hold at all.

### §3.3 The lab (P1)

`tools/dock-float-lab.html` already owns this question — anchor, cadence, and the three
placement models — and already has a "Copy constants" block. It is **extended**, not replaced.

New sliders, each named for the build symbol it feeds:

| Slider | Feeds | Suggested range |
|---|---|---|
| `size` | new `DEBUG.deliveryFloatSize` (replaces the hardcoded 16) | 12 – 64, step 1 |
| `sizeStep` | new `DEBUG.deliveryFloatSizeStep` — px added per piece in the visit | 0 – 6, step 0.5 |
| `sizeMax` | new `DEBUG.deliveryFloatSizeMax` — ceiling on the grown size | 16 – 96, step 1 |
| `hold` | new `DEBUG.deliveryFloatHold` — seconds at full opacity after release | 0 – 3.0, step 0.05 |
| `fade` | new `DEBUG.deliveryFloatFade` — seconds the fade itself takes | 0.1 – 3.0, step 0.05 |

`rise` stays. **`life` is retired as a delivery knob** and becomes `hold + fade` — see §3.5.

The lab must render the **growth** legibly: with `sizeStep > 0` the ticker gets visibly bigger
with each piece, which is the readability lever Paul actually asked for ("needs to see the
score is going up higher for each piece"). The lab's existing `canisterCount` slider drives
how many pieces the simulated visit delivers, so the growth curve is directly observable.

The lab keeps a **collision readout** against the existing milestone floaters
(`SALVAGE BONUS` at 8, `MAX HAUL` at `CARGO_CAP_MAX`), which climb from `dock.y - 22` on
`FloatText`'s un-passed 30 px/s · 1.1 s defaults. `STATUS.md` records these already sit at
0.0 px clearance at `anchorFrac 0.50`. **A larger ticker font makes that collision worse**, so
the readout must report measured clearance at the current slider values, and the gate asks for
it explicitly.

### §3.4 Blocking gate (GATE A)

P8 does not run until Paul returns numbers. Gate questions are in the phases doc, §GATE A.

### §3.5 The build change (P8)

`FloatText` gains **one** optional trailing field, `fade`, defaulting to `life` — so every
pre-existing call site stays byte-identical, exactly as CS026 P4's `rise`/`life` and CS029
P4's `pinned` did before it.

```
constructor(text, x, y, color, size = 16, rise = 30, life = 1.1, fade = life)
```

`draw()` becomes `globalAlpha = max(0, min(1, life / fade))`. With `fade === life0` this is
byte-identical to today. With `fade < life0` the floater holds at full opacity for
`life0 - fade` seconds, then fades over `fade`.

The delivery ticker's `life` is constructed as `DEBUG.deliveryFloatHold +
DEBUG.deliveryFloatFade`, with `fade = DEBUG.deliveryFloatFade`.

**⛔ The hold clock only runs after release.** The ticker is `pinned` until
`releaseDeliveryTicker()`, and `FloatText.update()` early-returns on `pinned` — so `life`
does not tick during the visit. That is already true and must stay true: a long visit must not
consume the hold.

Size growth: the ticker's `size` is recomputed on each piece as

```
min(deliveryFloatSizeMax, deliveryFloatSize + deliveryFloatSizeStep * (deliveryCount - 1))
```

written at the same site that already rewrites `.text` from `.total`.

Five new registry rows are added (§3.3's table minus `rise`), and `deliveryFloatLife` is
**retired** from the registry — it has exactly two readers, both in the delivery ticker path,
and both move to the hold/fade pair. Registry moves **87 → 91**.

⚠ Retiring a registry row is a **removal from persisted settings**. `CLAUDE.md`'s standing
rule covers it: "Removing a field needs no key rename and no migration shim — a saved value
for a deleted field orphans harmlessly." No migration is written.

⛔ `test-registry.js` is the **one** place the new counts land (87 → 91, section headers
unchanged, `LEVERS` unchanged at 18). No other test asserts a global count.

---

## §4 Level-end celebration header (scope item 5) — FORK-N → yes

### §4.1 What changes

`drawCelebration()` currently always renders `menuPanel(…, "ACHIEVEMENTS UNLOCKED")` with an
`"N NEW UNLOCKS"` sub-line at `CELEB_SUB_Y`.

The panel opens from two sites, already distinguished by `game.celebration.resume`:

| `resume` | Site | Title | Sub-line |
|---|---|---|---|
| `"wave"` | wave-clear, in `update()` | `"LEVEL N COMPLETE"` | `"During level N you earned:"` |
| `null` | `"dying"`→`"gameover"` seam, in `updateDeath()` | `"ACHIEVEMENTS UNLOCKED"` (unchanged) | `"N NEW UNLOCKS"` (unchanged) |

### §4.2 The level number is already correct — do not stamp it

⛔ At the wave-clear open site, `nextWave()` is **deferred to `dismissCelebration()`**, so
`game.wave` is still the *completed* wave when the panel opens and for its whole lifetime.
`drawCelebration()` reads `game.wave` live and gets the right number with no new field.

This does **not** conflict with the ⛔ that `game.pendingAch` is never filtered by
`game.wave`. That rule governs *which items are in the bucket* — this is a title string, and
it filters nothing. The bucket is still flushed whole.

⚠ The header must be derived from `resume`, **not** from `game.state`. `game.state` is
`"playing"` at the level-end panel and `"gameover"` at the other — it happens to agree today,
but `resume` is the field that answers "why did this panel open," and `dismissCelebration()`
already reads it for exactly that reason.

### §4.3 Not touched

- `celebrationMaxScroll()`, `CELEB_ROW0_Y`, the clip region, the ▲/▼ affordance.
- `dismissCelebration()`'s deferred `nextWave()`.
- The `game.state === "playing"` guard at the open site.
- Both input handlers' `game.celebration` gates.

---

## §5 Achievement reset (scope item 3) — FORK-J → (a), FORK-K → active-only

### §5.1 What resets

For the **active profile only**, matching every other per-profile store:

- `Achievements.lifetime` — every counter to 0
- `Achievements.lifetimeUnlocked` — emptied
- `Achievements.lifetimeTiers` — emptied
- `Achievements.weeklyUnlocked` — emptied

`Achievements.weekKey` and `activeIds` are **not** reset — they are calendar-derived, not
progress. The player gets this week's same five weekly challenges, all locked again.

Other profiles' stores are untouched. `afd_scores_v1` is untouched — that is §6's own reset.

### §5.2 ⛔ The persistence gate is a live trap

`Achievements.save()` early-returns on `game.debugRun || game.resumedRun`. A reset fired
during a resumed run would clear memory and never persist — and the runtime would then be
re-saved from the cleared state on the next legitimate save, or restored from disk on the next
`Profiles.activate()`, depending on timing. Either way the player sees a reset that didn't
take, or one that took later than they expected.

The reset flow **must be reachable only where that gate is false**. The Achievements viewer is
already title-menu-only as of CS016 P2 (FORK-CS016-A) — unreachable mid-run and at gameover —
so placing the row there satisfies this structurally rather than by a new guard.

⚠ `blankLegacyStores()` has the same latent hole today (it calls `Achievements.save()`
unguarded). **Not fixed in CS034** — it is only reachable from profile delete, which is also
title-only. Recorded in `STATUS.md` as a known issue so a future changeset that moves either
screen knows to look.

### §5.3 Where it lives

Two new rows on the **Achievements viewer** (`game.menu.screen === "achievements"`), below
the tab content:

```
Reset Lifetime Achievements
Reset Weekly Achievements
```

`menuAchievements()` currently uses up/down for **continuous scroll** with no row selection —
so it has no cursor to extend. Rather than invent one, the two rows are reached by a **new
action**: the existing `confirm` action, which today is a synonym for `back`.

⚠ **FLAG-CS034-a.** `menuAchievements()`'s `confirm` and `back` share one branch
(`else if (a === "confirm" || a === "back")`). Splitting them means ENTER no longer leaves the
screen, which is a shipped behaviour a player may have in muscle memory. The footer hint is
updated in the same edit. Best-guess resolution; override at the gate if it reads wrong.

The reset applies to whichever pool the **active tab** shows, so the two rows are one row whose
label follows `game.menu.achTab`:

```
weekly  → "Reset Weekly Achievements"
lifetime → "Reset Lifetime Achievements"
```

One row, one verb, no cursor. This also means the tab the player is looking at is the pool
they reset, which is the least surprising binding available.

### §5.4 The two-stage confirmation

**Stage 1** — the existing `openModal()`. Text names the pool and the profile:

```
Reset LIFETIME achievements for PAUL?
This cannot be undone.
```

Confirm label `RESET`, cancel default (`index: 1` — ⛔ that is the safety property, not a
tidy-up target).

**Stage 2** — a typed confirmation. The player must type `reset` (case-insensitive, trimmed)
and commit.

### §5.5 The typed-confirm screen — generalizing `nameentry`

⛔ **A gamepad cannot type.** The only pad-reachable text path in this build is the
`nameentry` character grid (`NAME_CELLS`, derived from `SCORES_CHARSET`). A keyboard-only
modal would make this feature unreachable for a pad player.

`openNameEntry(ctx, initial)` is generalized rather than duplicated. It already takes a `ctx`
carrying `mode`, `back`, `backIndex`, and `onCommit(name)`, and it already re-initialises all
three of its state fields on every entry — so it is one field short of being a general typed
field.

`ctx` gains two optional fields:

- `title` — the panel heading. Defaults to the current profile-name heading, so both existing
  callers (`add`, `rename`) are unchanged.
- `validate(buf)` — returns `""` when clean, else the inline message. Defaults to the current
  `nameEntryError(buf, ctx)`, so both existing callers are unchanged.

⛔ **`nameEntryError()` stays THE ONE PLACE THE NAME RULES LIVE.** It is not deleted or
inlined — it becomes the default `validate`. The live path and the commit path must keep
calling the *same* validator, whichever one `ctx` supplied.

The reset flow passes `mode: "confirm"`, a `title` of `TYPE RESET TO CONFIRM`, and a
`validate` that returns `""` iff `buf.trim().toLowerCase() === "reset"`. `PROFILE_NAME_MAX`
(12) is a comfortable cap for a 5-character word and is not changed.

⛔ `SCORES_CHARSET` is **not** deletable in §6 precisely because `NAME_CELLS` derives from it
— see §6.4.

### §5.6 Online-leaderboard forward-compatibility

The scope doc asks that a future online achievements board be kept in mind. `kit-leaderboard`
v0.1.0 is explicit: *"Anything with achievements. Lifetime achievements — including Orbital
Overhaul's tiered ones — are a separate kit module with a separate API. Nothing
achievement-shaped belongs in a submit payload here."*

So there is nothing to coordinate with today. What CS034 does provide is the seam: the reset
is **one function**, `resetAchievements(pool)`, that owns clearing + persisting for the active
profile. A future online module wires its own call beside that one site rather than
re-deriving what "reset" means.

⛔ `resetAchievements()` must **not** call `Achievements.init()` to rebuild — `init()` reloads
from storage, which would restore what was just cleared. It clears the four collections
directly and then saves, mirroring `blankLegacyStores()`'s existing shape.

---

## §6 Local high scores (scope items 6 & 7) — FORK-H → (a), FORK-I → delete, FORK-M → shape

### §6.1 Name comes from the profile; initials entry is deleted

The three-slot arcade initials field is removed entirely. At the `"dying"` → `"gameover"`
seam, a qualifying run's record is written immediately from
`Profiles.nameOf(Profiles.activeId)`, and `game.lastScoreId` is set so the gameover table
highlights it exactly as it does today.

**Deleted:** `game.entry` (from both the `game` literal and `resetRun()`), `entryInput()`,
`commitEntry()`, `drawEntrySlots()`, the keyboard handler's `if (game.entry)` interception
block, the gamepad handler's `(2.5)` block, and all seven `&& !game.entry` guards.

**Kept:** `SCORES_CHARSET` — `NAME_CELLS` derives from it (`SCORES_CHARSET.split("")` plus the
three verb cells) and §5.5's typed confirm depends on that grid. Its comment is repointed from
"the initials-entry alphabet" to "the name-entry grid alphabet."

⛔ The eligibility gate at that seam is unchanged:
`!game.debugRun && !game.resumedRun && HighScores.qualifies(game.score)`. This is the identical
gate `Leaderboard.eligible()` uses, and `CLAUDE.md` requires the two be extended together.
Neither is extended here.

⚠ `resetMenuNav()` at that seam existed for the held-stick-into-entry case. With entry gone it
has no consumer at this site and is removed **only if** `game.pendingAch.length` is empty —
the celebration panel's own open (immediately below) calls it for its own reason and that call
stays.

### §6.2 Records carry the full stat set

`HighScores.add()` currently persists `{v, id, initials, score, wave, delivered, ts, build,
profileId, profileName}`.

`initials` is **not** removed from the wire shape — old records have it and
`HighScores.load()`'s filter currently requires `typeof r.initials === "string"`. Instead:

- New records write `name` (the profile name at commit time), and **no** `initials`.
- The load filter drops its `initials` requirement and keeps only
  `typeof r.score === "number"`.
- The renderer reads `r.name || r.initials || "—"`, so pre-CS034 records display their
  initials forever and new ones display the profile name. **No migration, no rewrite of stored
  records.**

⛔ Per scope item 6, a later profile rename **never** updates existing records. The name is
snapshotted at commit, exactly as `profileName` already is.

New additive fields on every new record, mirroring the leaderboard payload:

| Field | Source |
|---|---|
| `durationS` | `Math.round(game.stats.gameTime)` |
| `delivered` | `game.stats.delivered` (already present) |
| `wave` | `game.wave` (already present) |
| `saucerKills` | `game.stats.saucerKills` |
| `satelliteKills` | `game.stats.debrisKills` |

⚠ Note the local field is named `satelliteKills`, not `debrisKills` — it is new, so it gets
the canonical name (§1.1) rather than inheriting the inverted one. The runtime counter it
reads from keeps its existing name. This is the one place CS034 introduces a canonical
identifier, and it is safe precisely because nothing persisted uses it yet.

⛔ **Additive only.** Every field above is absent from pre-CS034 records; the renderer shows
`"—"` for a missing one and never assumes shape.

### §6.3 Table capacity and the profile filter

`SCORES_MAX` moves **10 → 25**. `afd_scores_v1` stays **one shared machine-wide table** —
⚠ SETTLED at CS031 (FORK-B a), not re-litigated.

The browsable High Scores screen (`drawHighScores`, `menuHighScores`) gains a filter toggle
on ◄/►, mirroring `drawLeaderboard()`'s window cycling:

```
ALL PROFILES   /   THIS PROFILE
```

`THIS PROFILE` filters on `r.profileId === Profiles.activeId`. Pre-CS031 records have no
`profileId` and therefore never appear under `THIS PROFILE` — correct, since they predate
profiles entirely and belong to nobody in particular.

⛔ `qualifies()` and `add()` always operate on the **unfiltered** table. The filter is a view,
never a store — a record must not qualify differently depending on which screen was last open.

### §6.4 Layout

The gameover screen keeps `drawScoreTable()` at scale 1 with its **current five columns**
(`#`, `NAME`, `SCORE`, `LEVEL`, `DELIVERED`) — `STATUS.md` already records that table as tight
against `GAMEOVER_HINT`, and re-flowing it is out of scope. Only `INITIALS` → `NAME` changes
there, and it shows the top ten rows of a now-25-deep table.

The browsable screen gets its own renderer with the full column set:

```
#   NAME        SCORE    LEVEL   TIME       DEBRIS   SAUCERS   SATELLITES
```

`TIME` renders `durationS` as `h:mm:ss` (or `m:ss` under an hour), by a new `fmtDuration()`
helper beside the existing `fmtCommas()`. `DEBRIS` is the delivered count under canonical
vocabulary (§1.1).

25 rows at the current 1.8 scale will not fit the 1000×560 panel. The browsable screen scrolls
— `game.menu.scroll` with `ACH_SCROLL_STEP`, the Achievements viewer's exact idiom, clamped
against a `scoresMaxScroll()` that both the renderer and the input handler read. ⚠ Per
`celebrationMaxScroll()`'s header, measure content height **from the clip top**, not from row
0's baseline.

⚠ **FLAG-CS034-b.** `HS_TABLE_SCALE` is 1.8 and its header warns the offsets are hand-computed
for it. Eight columns at 1.8 will not fit 1000 px of panel width. Best guess: drop the
browsable screen to **1.4** and re-derive. If that reads too small, the alternative is
widening the panel — a gate question.

### §6.5 Reset

`resetHighScores()` already exists (debug panel, `"Reset saved scores"` action row, behind
`openModal`). It is **extended to the same two-stage confirmation as §5.4** and **surfaced on
the High Scores screen** so it is reachable without the secret debug code.

⛔ It clears both in-memory `entries` **and** the persisted key through `HighScores.save()` —
never `removeItem`. That contract is unchanged. It also clears `game.lastScoreId`, since the
id it points at no longer exists.

The debug panel's existing row stays, now routing through the same two-stage flow.

### §6.6 Shaping for extraction (item 7) — FORK-M → shape

CS034 **does not** create a `kit-scores` module. It shapes `HighScores` so extraction is a
later mechanical move:

- ⛔ `HighScores` reads **no globals from the game**. Today `add()` reads `game.score`,
  `game.wave`, `game.stats.*`, `GAME_VERSION`, and `Profiles.*` — some directly, some via its
  caller. After CS034, `add(record)` takes a **complete plain record object** and the caller
  assembles it. `HighScores` owns sorting, capping, persistence, and querying. Nothing else.
- ⛔ `qualifies()`, `add()`, `save()`, `load()` and the new `filtered(profileId)` are the whole
  surface. Rendering stays in the game — same seam `kit-leaderboard` draws ("The module never
  reaches into game state, never touches the DOM, never renders anything").
- The `RunResult` shape assembled at the gameover seam is the **one** object handed to both
  `HighScores.add()` and `Leaderboard.submit()`. Today those two sites read the same counters
  independently and can drift; after CS034 they read one object. This is the seam a future
  `kit-scores` extracts along.

⛔ `STORAGE_KEY: "afd_scores_v1"` is frozen and stays frozen. Extraction later must carry the
key, not rename it.

---

## §7 Leaderboard (scope items 10, 11, 12) — FORK-D, FORK-E

### §7.1 The stat key fix (FORK-D1 → yes)

`Leaderboard.submit()`'s `stats` object changes exactly one key:

```
garbage_satellite_kills  →  debris_destroyed
```

Value source is unchanged (`game.stats.debrisKills`). The other three keys
(`wave_reached`, `canisters_delivered`, `saucer_kills`) already match the registry and are
untouched.

**FORK-D2 → no.** `hunter_kills` is registered and remains deliberately unsent. `CLAUDE.md`'s
⛔ on that point stands — but its *reason* is rewritten, because "the registry isn't visible"
is no longer true. The correct standing reason: no per-game player-only Hunter-kill counter
exists (`hunterLineageKills` resets per lineage; `Achievements.lifetime.hunterKills` is
cross-game), and none was added to serve this.

**FORK-D3 → leave it.** `debris_destroyed` counts Garbage Satellites under CS034 vocabulary.
It is frozen in already-submitted rows. Recorded in the `CLAUDE.md` glossary as a known legacy
name.

⚠ Rows already submitted with the wrong key **stay flagged** on the public board. Nothing
client-side can unflag them. If that matters, it is a `coinless-kit` data question, not a game
one.

### §7.2 Duration column (item 12, partial)

`drawLeaderboard()` gains a `TIME` column between `LEVEL` and `DELIVERED`, rendering
`e.durationS` through the same `fmtDuration()` helper §6.4 adds. `durationS` is already mapped
by the module — no cross-repo dependency.

⛔ Crash-free the same way the existing two stat columns are: `durationS` may be absent or
non-numeric on any given entry, so it falls back to `"-"` rather than assuming shape.

Column count goes 5 → 6 at scale 1.5 in a 1000 px panel. The existing columns are
hand-positioned offsets from `cx`; all six are re-derived in one edit.

### §7.3 Deferred to a `coinless-kit` changeset

**Item 10 (just-me / worldwide filter)** and **item 12's Version column**. Neither is
buildable from this repo. What the follow-up needs:

- `services/leaderboard/src/board.js` — add `game_version` to the SELECT and the entries map;
  add an optional `player` query param branching to a per-player query (the
  `idx_scores_player_best` index already exists for it).
- `modules/kit-leaderboard/kit-leaderboard.js` — map `gameVersion` in `fetchBoard`'s entry
  map; accept and forward a `player` / `scope` option.
- `docs/kit-leaderboard-client-api.md` — document both.

⚠ Item 10's shape is a genuine design question for that changeset, not this one: worldwide is
*top players, one row each*, while "just me" almost certainly wants *my top N runs*. Those are
different queries, not one query with a filter.

⚠ Item 12's two-line row layout ("Name" left, everything else right, nothing wrapping under
the name) is specified against a **six-field** row. With Version deferred, CS034 ships five
fields on one line, which still fits. The two-line reflow lands with Version, in the follow-up.

---

## §8 What CS034 explicitly does not do

- No code-symbol renames (§1.2).
- No achievement `id` renames (§1.2). **⛔ ids are save data.**
- No `PROFILE_MAX` change (§0.3).
- No `game.stats.gameTime` change (§0.3).
- No `kit-scores` or `kit-profiles` module (§6.6, FORK-M).
- No `coinless-kit` edits (§7.3, FORK-E).
- No new `localStorage` key. `afd_scores_v1` and `afd_achievements_v2` stay frozen; both
  changes are additive-field or in-place-clear.
- No voice lines. **The phon gate is not engaged this changeset.**
- No `destroyHunter()` split change (§2.4).
- No fix to `blankLegacyStores()`'s save gate (§5.2) — recorded, not fixed.
- No fix to FLAG-CS032-a, FLAG-CS031-c, FLAG-CS027-c/d, or the `returnToTitleMenu()`
  landing-row issue. All still open, all still in `STATUS.md`.

---

## §9 Open flags carried into the gate

| Flag | What | Best guess |
|---|---|---|
| **FLAG-CS034-a** | Splitting `confirm` from `back` in `menuAchievements()` changes shipped ENTER behaviour on that screen | Split; update the footer hint |
| **FLAG-CS034-b** | Eight columns at `HS_TABLE_SCALE` 1.8 will not fit the 1000 px panel | Drop the browsable screen to 1.4 |
| **FLAG-CS034-c** | Halving Hunter Debris yield may thin late-wave delivery combos | Change nothing; ask at the gate |
| **FLAG-CS034-d** | A larger delivery ticker worsens the known 0.0 px milestone-floater clearance | Lab reports measured clearance; gate picks |

---

## §10 Registry and version

- Registry: **87 → 91** (five delivery rows added, `deliveryFloatLife` retired).
- `LEVERS`: **18**, unmoved.
- Version: **1.0.0.33 → 1.0.0.34**, at the closing phase only.
- `test-registry.js` is the **one** file carrying the new counts.