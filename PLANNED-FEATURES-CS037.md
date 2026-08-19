# PLANNED FEATURES — Changeset 037

**Verified against** `freakingid/ADD-Orbital-Overhaul` @ `70518af` ("Add .gitignore and itch packaging
script"), `GAME_VERSION` **1.0.0.36**, CS036 closed at P7. Registry **106**, headers **10**,
`LEVERS` **18**, `POWERUP_DROP_TYPES` **5**, `tools/` holds **seven** labs. No `PLANNED-FEATURES-*` /
`IMPLEMENTATION-PHASES-*` at root. Main file is `orbital-overhaul.html` (12,708 lines).

**Scope.** Five items:

| | Item | Shape |
|---|---|---|
| **A** | Perf measurement (caps measured, not needed — see §3.4) | new instrument; **no caps ship** |
| **C** | Full tow release on damage + truthful "Payload lost." | behaviour + voice table |
| **D** | Periodic gameplay telemetry | new subsystem + build surgery |
| **E** | Resumed-run achievement flood | defect fix (data integrity) |
| **F** | One powerup per dock visit | balance nerf + two knobs |

Item **B** of the raw notes is dropped (see §7).

**Vocabulary — the entity names are INVERTED and stay that way.** `game.debris` is the **Garbage
Satellite** array; `game.garbage` is the **Debris** array (loose salvage, towable).
`game.stats.debrisKills` counts Garbage Satellites. Not typos. Not renamed by this changeset.

---

## 1. Corrections to prior assumptions

Carried forward from the CS037 notes, plus three found during this verification pass. C1, C2, C3,
C5, C6 and C8 were checked against the build and are confirmed **exactly as written**; they are not
restated here.

### C4-rev — three `damageShip()` call sites, not four, and the hazard split is one merged loop

`damageShip(amount, srcX, srcY)` is called from exactly three places:

| Site | Source | Damage |
|---|---|---|
| hostile bullet vs ship | `Bullet` with `hostile === true` | `DMG_BULLET` |
| hazard body vs ship | **merged loop** over `[...game.debris, ...game.hunters]` | `h.damage` |
| saucer body vs ship | `Saucer` | `s.damage` |

The middle site is one loop over a concatenated array, so Garbage Satellite and Hunter Satellite
contacts arrive at the same call. Two facts make the per-source split cheap anyway:

- The discriminator already exists at that site — `h instanceof HunterSatellite` is evaluated three
  lines below for Close Shave.
- Both classes carry `this.size` (3 large / 2 medium / 1 small), so per-size attribution needs no
  new field on either.

Hostile bullets have exactly **one** spawn site (inside `Saucer.update()`), so threading shooter
size is one constructor parameter and one call, not a sweep. **Item D's prerequisite is materially
smaller than the notes assumed**, but it is still a build change and still wants its own phase.

### C7-rev — the flood is not weekly-only, and the lifetime half is the damaging half

The notes state the defect is a WEEKLY-pool defect. It is predominantly weekly — all **16** weekly
achievements read per-game stats — but **two LIFETIME achievements read them too**:

| id | pool | tiered? | `cur()` |
|---|---|---|---|
| `untouchable` | LIFETIME | no (`goal: 1`) | `(game.wave >= 10 && !s.everBelowHalf) ? 1 : 0` |
| `max_haul` | LIFETIME | no (`goal: 1`) | `s.maxChainVisit ? 1 : 0` |

Both are non-tiered, so both run through `checkSingle(ach, this.lifetimeUnlocked)` in `evaluate()`.
`deriveLifetime()` — the silent catch-up that exists to prevent exactly this fanfare storm — is
called **once**, from `load()`, when `game.stats` is still fresh. It is never re-run after
`resumeFromSave()` overwrites `game.stats` out of the slot.

**Consequence, live at HEAD.** A resumed run adds these two ids to the in-memory `lifetimeUnlocked`
set. `Achievements.save()` early-returns for the rest of that run, so nothing is written *then* — but
the set is module state that survives the run. The **next non-resumed run in the same session** calls
`save()` with no suppression and writes `lifetimeUnlocked: [...this.lifetimeUnlocked]` to
`afd_achievements_v2`, persisting up to two lifetime achievements the player never earned. This is
the same leak the notes anticipated for weeklies, except it is not hypothetical — it ships today.

**Therefore the resume baseline covers BOTH pools.** This is not offered as a fork: weekly-only would
knowingly leave a path that persists unearned lifetime achievements. The baseline is specified as a
**blanket** over every active achievement — simpler than filtering to the eighteen that read `s`, and
it cannot rot the day a future `cur()` starts reading per-game state.

### C9 — FLAG-CS036-a poisons item A's measurement, and the fix belongs in the build

`saveSettings()` writes `debug: { ...debugShown }` — a full snapshot of **all 106** knobs — and
`loadSettings()` re-applies every finite in-range stored value over the registry `def`, with
`debugOverride` defaulting ON. Any installation that has ever saved settings is not running shipped
defaults. For item A this is not a nuisance, it is disqualifying: two of the knobs in that snapshot
are `garbageSoftMax` and `garbageHardMax`, i.e. the benchmark would measure against a cull ceiling
the tester forgot they moved, and the caps derived from it would be wrong. This is the same flag that
made CS036's H10/H11 gate answers unusable. **Resolved by FORK-CS037-D → (a)** — see §2.1.

### C10 — the "seven powerup types" are not seven symmetric quantities

`POWERUP_DROP_TYPES` is 5; `POWERUP_COLOR` names **seven** types (`rapid`, `triple`, `health`,
`magnet`, `engine`, `scoop`, `guard`). They differ in what "remaining uses" even means:

- `powerBudget` holds five (`rapid`, `triple`, `magnet`, `engine`, `guard`).
- `scoop` is a persistent level on `game.scoopLevel`, capped at `SCOOP_MAX_LEVEL`.
- `health` is instantaneous — it has no remaining-use quantity at all.

Item D's "remaining uses of each powerup" is therefore **six columns**, not seven: the five budgets
plus `scoopLevel`. Health's column is *pickups only*. This is stated rather than papered over so the
exported rows are honest about what does not exist.

---

## 2. Fork resolutions

All five forks resolved by Paul before this document was written.

| Fork | Question | Resolved |
|---|---|---|
| **A** | Resumed-run achievement persistence | **(b)** lift `save()` suppression for post-baseline unlocks |
| **B1** | Does a chain-guard charge intercept the damage-release? | **no** |
| **B2** | Does the damage-release increment `cargoDamageEvents`? | **no** |
| **C** | Is the new "Payload lost." event critical? | **critical** |
| **D** | How does benchmark mode defeat FLAG-CS036-a? | **(a)** force `debugOverride` OFF for the run, restore after |
| **E** | Telemetry per-type pickup counters | **all 7** |
| **A.1** | Shape of (b): latch the choke point, or targeted merge write? | **(b2)** targeted merge write |

### 2.1 FORK-CS037-D → (a), mechanism

Benchmark mode reads and stashes `debugShown[DEBUG_OVERRIDE_ID]`, calls
`applyDebug(DEBUG_OVERRIDE_ID, 0)` — which the existing carve-out routes into a full
`rebuildDebug()` — runs, then restores the stashed value through the same call on exit.

**⛔ `saveSettings()` MUST NOT be reachable while the override is forced.** `applyDebug` writes
`debugShown`, and `saveSettings()` persists `debugShown` wholesale; a save landing mid-benchmark
would permanently persist the toggle OFF and silently discard the tester's entire knob set from that
installation's point of view. The restore is unconditional — it runs on normal completion, on abort,
and on any early exit from benchmark mode.

### 2.2 FORK-CS037-A.1 — RESOLVED → (b2)

Fork A resolved to **(b)**: honour unlocks that cross above the resume baseline. That raised a
sub-fork the notes did not anticipate, because `Achievements.save()` does not write unlocks in
isolation — it writes one blob:

```
{ lifetime: {...counters}, lifetimeTiers: {...}, lifetimeUnlocked: [...], weekly: {key, unlocked:[...]} }
```

So "lift the suppression" has two possible shapes:

- **(b1) Latch the choke point.** The first post-baseline unlock in a resumed run sets a latch;
  `save()` stops early-returning for the remainder of that run. Minimal, matches the existing
  one-choke-point architecture. **Cost:** it also persists `lifetime` counters accrued during the
  resumed run. Those counters compound across repeated resumes of the same slot — e.g.
  `fullChains`, `heavyHaulerEvents`, `pacifistTowEvents` are `++` counters, so loading the same save
  five times and delivering twelve each time banks five events. CS032 P2's resumedRun bar exists
  precisely to stop that, and (b1) reopens it.

- **(b2) Targeted merge write.** A separate write path that read-modify-writes the stored blob,
  adding only the ids that crossed above the baseline (and their tier indices), and leaving the
  stored `lifetime` counters untouched. **Cost:** one new function and its own storage-failure
  guard. **Benefit:** lifts exactly the thing fork A said was honestly earned — the unlock — and
  nothing else. CS032 P2's counter bar survives intact.

**Resolved: (b2).** It is the conservative reading of (b), it reverses no prior gate outcome, and it
leaves the repeated-resume counter exploit closed. P6 is specified against (b2) below, and every fork
in this changeset is now closed — no phase is blocked on an outstanding decision.

**⛔ (b1) is refused, not merely unchosen.** If a future changeset revisits this, the reason (b1) was
rejected is recorded here rather than left to be rediscovered: `save()` writes one blob including
`lifetime: {...counters}`, several of which are `++` counters, so lifting the choke point lets a
player bank the same events repeatedly by reloading one slot. CS032 P2's resumed-run bar exists
precisely to prevent that, and (b1) would silently reopen it while appearing to only touch unlocks.

---

## 3. Item A — perf measurement (no caps shipped)

### 3.1 What ships

A **benchmark mode**, driven from the debug panel, that measures the shipped entity code on real
hardware. Caps were to follow in a phase gated on the measurement; **the measurement cleared every
population, so no caps ship** — see §3.4.

Not exposed in Options. Not a player-facing feature. Not a `tools/` lab — a lab would have to
re-implement `DebrisSatellite`, `HunterSatellite`, the particle system and the draw calls, and that
duplicate would drift from the build and would not exercise the real hot paths (Hunter homing does
wrap-aware `angleTo`/`dist2` work per frame that a mock does not reproduce).

### 3.2 Measurement contract

- **Ramp to threshold.** Grow one population until frame time degrades. Report the count at which
  **p95 frame time** crosses **16.7 ms**, then again at **33.3 ms**. Both thresholds per population;
  a population that reaches the safety ceiling without crossing reports "not reached" rather than a
  fabricated number.
- **Update and draw are timed separately.** Hunters are update-heavy (homing); particles are
  draw-heavy. The split is what decides which cap actually matters, so a single combined frame-time
  number is not sufficient output.
- **Populations, isolated, one at a time, in one automated battery:**
  1. `game.garbage` — singles
  2. `game.garbage` — clumps (separately: a clump carries lineage and merge state)
  3. `game.debris` (Garbage Satellites) — per size (3 / 2 / 1)
  4. `game.hunters` — per size (3 / 2 / 1) — the suspected cost centre
  5. `game.saucers`
  6. `game.particles`
  7. `game.floaters`
  8. `game.chain`
  9. **mixed** — one run at realistic late-wave proportions, to catch interaction costs the isolated
     runs miss
- The battery runs all of the above in sequence from one action. There is deliberately **no
  population selector knob**: a selector would need a label-array registry hook that does not exist
  (`boolLabels` is a two-value display hook), and running the whole battery is what the measurement
  needs anyway.

### 3.3 Isolation and safety

**⛔ Benchmark mode is unreachable from normal play and cannot write anything.** For its duration it
must not be able to reach `addScore()`, `HighScores.save()`, `Achievements.save()`, the telemetry
buffer of item D, or `saveSettings()`. Entry is from the debug panel only.

Per **FORK-CS037-D → (a)**, it forces `debugOverride` OFF for the run and restores it after (§2.1).

### 3.4 Caps — MEASURED, NOT NEEDED, NOT SHIPPED

**Gate A closed 2026-08-19. No caps ship this changeset. P3 is dropped.**

The measurement did not support the premise. Run at the 2000-entity ceiling on two browsers (Edge on
Ganesh / AMD integrated, Chrome on Graphite / RTX 3060), **every population reported "not reached" at
both 16.7 ms and 33.3 ms.** One apparent Chrome crossing at 1700 large Garbage Satellites is noise,
not a threshold: the raw steps run 9.4 → 17.1 → 16.0 → 11.3 → 11.8, i.e. non-monotonic and settling
back down well below the line.

Against real-play peaks from the P2.1 recorder, the smallest margin is **>12×**, and every figure is
a *lower bound* because nothing crossed:

| Population | Cost at 2000 | Real-play peak | Margin |
|---|---|---|---|
| Particles | 1.0 ms | 166 | >12× |
| Debris singles | 3.1 ms | 90 | >22× |
| Hunter Satellite — sm | 2.2 ms | 35 | >57× |
| Tow chain | 5.7 ms | 20 | >100× |
| Garbage Satellite — lg | 10.2 ms | 12 | >166× |
| All others | — | 1–26 | >75× |

The spec's own rule decides it: *populations that the measurement clears are not capped; a cap nobody
needs is a behaviour change with no benefit.* Every population clears, by two orders of magnitude.

**Secondary findings, worth keeping:**

- **Draw dominates; update is negligible.** At 2000 entities, update cost is ≤1.0 ms for every
  population while draw runs 0.9–16.5 ms. The suspicion recorded in §3.2 — that Hunter homing's
  wrap-aware per-frame work was the cost centre — is **wrong**, and is corrected here rather than
  left standing.
- **The frame-rate hiccup has some other cause.** The benchmark deliberately excludes fixed
  per-frame overhead (starfield, ship, HUD, chrome), and at real-play counts all populations combined
  cost roughly 1–2 ms. Entity accumulation is ruled out; the real cause is unmeasured and remains
  open. **Not pursued this changeset** — recorded in `STATUS.md` as a known issue with the evidence
  attached, so a future changeset starts from the null result rather than re-deriving it.
- **Rasterizer backend matters more than GPU.** Edge (Ganesh) outperformed Chrome (Graphite) on
  identical work despite Chrome holding the discrete GPU. Relevant to any future perf work: size
  against the slowest representative backend, not the fastest available one.

**⛔ C2 is untouched.** CS024 P3's determinism requirement was never at risk — no cull changed, and
the `cullGarbage()` invariant in `CLAUDE.md` needs **no edit** this changeset.

## 4. Item C — release the whole tow on any hit; fix the "Payload lost" lie

Two coupled changes.

### 4.1 Full release on damage

When the ship takes a **real HP-dealing hit** from any source — Garbage Satellite, Hunter Satellite,
UFO body, UFO shot — **all** towed Debris is released.

- **Fires on the non-lethal branch of `damageShip()` only.** Shielded hits, i-framed repeats and
  auto-shield saves all `return false` and keep the cargo — that is what the shield is *for*.
- **⛔ The lethal path is excluded.** `damageShip()` also returns `true` after `killShip()`, and
  `killShip()` already calls `scatterChain()`. Hooking the shared return would double-scatter on
  death. The hook is on the non-lethal branch, below the `s.hp <= 0` early exit.
- **Mechanism: `scatterChain()`, unchanged.** Full scatter to free Debris, `deliveryCount` zeroed,
  `releaseDeliveryTicker()` called. No new scatter function, no variant.
- **FORK-B1 → no.** An available chain-guard charge does **not** intercept the release. The guard
  intercepts chain *severs* through `breakChain()`; hull damage is a different event and `breakChain()`
  is not on this path. `powerBudget.guard` is not read and not spent.
- **FORK-B2 → no.** The release does **not** increment `game.stats.cargoDamageEvents`. That counter
  is the chain-guard drop-weight pity counter and CS035 P6 scoped it to `breakChain()`'s sever path
  only — a guarded absorb and `scatterChain()` both leave it untouched. Reusing `scatterChain()`
  verbatim delivers this for free; the phase must not add an increment at the new call site.

### 4.2 Truthful voice line

Today `"Payload lost."` is one of five random alternatives under `chain_broken`, so it can fire on a
**partial** break — a satellite striking mid-chain — and read as total loss when the player kept most
of the load. This is a table-partition problem, not a trigger-condition problem (C3).

- **Split `"Payload lost."` into its own event.** The line moves **verbatim** — text and phon both.
  The phon is already lab-composed and zero-error-verified, so **no new phons and no
  `voice-robot-lab` gate is required this changeset**. `chain_broken` retains its other four
  alternatives ("Payload damaged. / disrupted. / adrift. / is getting away.").
- **The selection rule is general, and applies at every chain-loss site:** choose by *"was the chain
  non-empty, and is it now empty."*
  - **New damage release** — empty by construction, so: the new event, guarded on the chain having
    been non-empty before the release.
  - **`breakChain(i, …)` sever path** — `chain.length = i`, so `i === 0` means total loss and speaks
    the new event; `i > 0` keeps `chain_broken`.
  - **Guarded absorb** — unchanged, still `chain_guard`, still returns before the sever path.
- **⛔ Ship death stays silent.** `scatterChain()` is deliberately voiceless (CS011 P5). The new
  event is spoken **at the call site in `damageShip()`**, never from inside `scatterChain()` — which
  is what keeps `killShip()`'s call silent without a flag or a guard parameter.

### 4.3 Voice table consequences of FORK-C → critical

| Table | Change |
|---|---|
| `VOICE_LINES` | new event, one alternative, moved verbatim out of `chain_broken` |
| `VOICE_PRIORITY` | new entry at **2**, matching `chain_broken` — priority is untouched by criticality |
| `VOICE_CRITICAL` | new entry **true** — the set grows 4 → **5** |
| `VOICE_QUEUE_MAX` | **4 → 5** |
| `VOICE_STILL_TRUE` | new predicate |

**⛔ `VOICE_QUEUE_MAX` must move with the critical set.** The constant is sized to the critical set so
it stays a structural guard rather than live logic that silently eats a real line, and the ⛔ note at
its declaration says so explicitly. `test-cs025-p4.js` §F pins the *relationship*, not either
literal, so it fails if only one of the two moves.

**The re-validation predicate is `game.chain.length === 0`.** This is the trigger's own condition
restated, per the CS025 P4 contract: a parked "Payload lost." speaks only while the payload is in
fact still lost. If the player has scooped new Debris by drain time, the line is discarded silently
rather than spoken late. It is mutually exclusive with `cargo_full`'s predicate by construction.

**Criticality stays orthogonal to priority — two tables, never merged.** The new event is critical
because total loss should *wait* for the channel; it stays at priority 2 because it must **not** gain
the power to pre-empt `health_low` (3). There is no TTL.

---

## 5. Item D — periodic gameplay telemetry

### 5.1 What ships

A snapshot every **N** seconds — debug knob, **default 15** — producing one row per interval, with a
**copy-to-clipboard** export so rows can be pasted into a text file for offline processing. C5
confirmed: no clipboard code exists anywhere in the build, so the export is net-new.

### 5.2 Per-row fields

| Group | Columns | Source |
|---|---|---|
| Run | score, level | `game.score`, `game.wave` |
| Ship | health remaining, current speed | `game.ship.hp`, `hypot(ship.vx, ship.vy)` |
| Remaining uses | rapid, triple, magnet, engine, guard, scoop | `game.powerBudget` ×5, `game.scoopLevel` |
| Pickups this run | rapid, triple, health, magnet, engine, scoop, guard | seven counters — see §5.4 |
| Health lost by source | Garbage Satellite ×3 sizes, Hunter Satellite ×3 sizes, UFO-large body, UFO-small body, UFO-large shot, UFO-small shot | ten accumulators — see §5.5 |
| Flags | `debugRun`, `resumedRun` | `game.debugRun`, `game.resumedRun` |
| Clock | interval timestamp | `game.stats.gameTime` |

Health is one column (there is no health "remaining uses" — C10).

### 5.3 Contract

- **Clock: game time, paused time excluded.** The same clock `game.stats.gameTime` runs on. Menu,
  pause and level-ceremony time do not count toward N.
- **Scope: per-run.** Cleared through `resetRun()`, which is the shared reset both `startGame()` and
  `resumeFromSave()` go through — so a resumed run also starts with a clean buffer.
- **400-row cap**, oldest rows roll off.
- **Always captures**, including debug and resumed runs. Every row carries `debugRun` / `resumedRun`
  so the data can be filtered afterwards rather than being silently absent.
- **Export lives in the debug panel only**, not Options, as an action row alongside "Dump difficulty
  log". **It must be reachable at game-over**, since the buffer clears on the next `resetRun()`.
- **Benchmark mode does not write to the buffer** (§3.3).

### 5.4 Per-type pickup counters (FORK-E → all 7)

`game.stats` today has `powerupsPicked` (a total) and `powerUsed` (four booleans). There is no
per-type count.

- **Six new flat counters** on `resetGameStats()`, one each for `rapid`, `triple`, `magnet`,
  `engine`, `scoop`, `guard`.
- **Health reuses the existing `healthPicked`**, which already counts exactly this quantity for Glass
  Cannon. A seventh parallel counter would be duplicate state that can disagree with itself; the
  achievement is not touched and not repointed.
- **⛔ Flat fields, not a nested object.** `game.stats.powerUsed` is nested and both
  `buildSaveEntry()` and `resumeFromSave()` carry explicit special-cases for it — a bare spread would
  leave it **aliased** to the live run. Flat counters need neither special-case and inherit the
  known-key type-matched copy loops for free.
- **One increment site:** the top of `applyPowerup(type)`. The two existing `powerupsPicked++` sites
  (the scoop early-return arm and the shared arm) are left untouched.

Adding fields to `resetGameStats()` is additive and safe: `buildSaveEntry()` spreads the bag, and
`resumeFromSave()` copies known keys with a type match, so an older slot simply leaves the new
counters at zero.

### 5.5 Per-source damage attribution (prerequisite work, C4-rev)

`damageShip(amount, srcX, srcY)` carries no source identity, and hostile `Bullet` carries only
`hostile` — no shooter size. Both are build changes, not instrumentation, and they land in their own
phase ahead of the telemetry buffer.

- **`damageShip()` gains a source tag** identifying which of the ten categories dealt the hit.
- **The merged hazard loop discriminates in place** using `h instanceof HunterSatellite` (already
  evaluated there) and `h.size` — no new field on either class.
- **Hostile `Bullet` gains a shooter-size field**, set at its single spawn site inside
  `Saucer.update()` from `this.small`.
- **The saucer body site** reads `s.small`.
- **Attribution accumulates only on the non-lethal branch**, where HP is actually deducted. Shielded
  hits, i-framed repeats and auto-shield saves deal 0 HP and attribute 0.
- The tag is **observational**: it must not change knockback, i-frames, scoop decay, `dmgThisWave`,
  `hitsSurvived`, `everBelowHalf` or any achievement path.

### 5.6 Storage

- **A new localStorage key**, written each snapshot (every 15 s — trivially cheap), so a crash or
  refresh does not lose the run.
- **⛔ Existing keys are frozen and append-only.** No schema bump, no rename, no touching
  `afd_scores_v1`, `afd_achievements_v2`, `afd_settings_v1`, `afd_profiles_v1`, `afd_saves_v1`.
- Follows the `SaveSlots` idiom: routed through `Profiles.keyFor()`, guarded by `storageOK()`,
  wrapped in try/catch, versioned envelope, **known-value-else-default on the envelope** — absent,
  unreadable JSON or a wrong version resolves to an empty buffer rather than throwing or partially
  trusting a bad blob. A background write nobody is watching fails silently (the `SaveSlots.write()`
  boolean-return exception does not apply — that exists because saving is a player-initiated act with
  an expectation of success).

---

## 6. Item E — achievement flood after loading a saved game

### 6.1 Symptom and root cause

Quit the browser entirely → load a saved game → many achievement banners at once. Quit the game and
load the same save again *in the same browser session* → no banners.

`resumeFromSave()` copies `game.stats` out of the slot, and the very next `evaluate()` finds Scrap
Runner, Satellite Buster, Shield Surfer, Combo Collector, Small Ball, Diamond Cutter and others all
satisfied on the same frame. Per **C7-rev**, `untouchable` and `max_haul` — both LIFETIME — join them.

Two structural facts make it more than a one-liner:

- **`deriveLifetime()` has no weekly sibling and is not re-run at resume.** The silent catch-up that
  exists precisely to prevent a fanfare storm walks `this.LIFETIME` only, once, from `load()`.
- **`weeklyUnlocked` is week-scoped and persisted, not per-run.** The naive fix — silently mark
  everything unlocked at resume — leaks into any *fresh* run later in the same session, where
  `Achievements.save()` is no longer suppressed, and would persist achievements the player never
  earned. Strictly worse than the bug.

### 6.2 Decision: no banner-display gating

The one-at-a-time banner queue floated in the raw notes is **not in scope**. `drawToasts()` stacks
banners by design and that behaviour stays. The defect is in the save/load award path; fix the cause.

### 6.3 Resolved fix: a resume baseline

A resumed run unlocks only what it genuinely earns *after* the load.

- At resume, snapshot each **active achievement's** `cur()` value — **both pools**, blanket, per
  C7-rev.
- `evaluate()` toasts only on a crossing **above that baseline**.
- The baseline lives for the duration of the resumed run and **⛔ never touches `weeklyUnlocked`,
  `lifetimeUnlocked` or `lifetimeTiers`**.
- For tiered lifetime achievements the baseline is the tier index already justified at load time, so
  a resumed run toasts a tier only when it crosses a threshold it did not already sit above.

**Placement.** `resumeFromSave()` carries a load-bearing invariant — **step 2 (stats overwrite)
precedes step 4 (`nextWave()`)**, because `nextWave()` reads `game.stats.powerupsPicked`. The
baseline snapshot must be taken **after step 2 and before step 4**, or it snapshots zeroes and fixes
nothing. Note `untouchable`'s `cur()` reads `game.wave`, which step 4 advances — another reason the
snapshot cannot sit after it.

**Storage.** The baseline lives on the `Achievements` module, not on `game` — which sidesteps the
standing CS016 P3 both-places rule (a field added to only one of `game`'s two literals reads
`undefined` for a whole run). It is cleared in `resetRun()`, the one shared reset.

### 6.4 Persistence (FORK-A → b; FORK-A.1 → b2)

`Achievements.save()` early-returns on `game.debugRun || game.resumedRun`, so today even a genuinely
earned post-baseline unlock is toasted but never persisted — the player is shown a reward they do not
receive. Fork A resolved **(b)**: honour it.

Shape resolved **(b2)** — a targeted merge write that adds only the ids crossing above the baseline
and leaves stored `lifetime` counters untouched. See **§2.2** for why (b1) was refused.
`game.debugRun` remains an absolute bar, unchanged.

---

## 7. Item F — one powerup per dock visit

### 7.1 Current rule

Four one-shot latches at `deliveryCount` 8 / 12 / 16 / 20, each awarding one powerup — cumulatively
1 for 8–11, 2 for 12–15, 3 for 16–19, 4 for 20–23.

### 7.2 Change

**Exactly one powerup per visit, at `deliveryCount >= 8`.** Keep the `=== 8` latch, delete the
12 / 16 / 20 latches. The counter increments by one per canister, so it always passes through 8 — the
existing `=== 8` equality **is** the ">= 8, once per visit" rule and needs no restructuring. Hauls of
7 or fewer continue to award nothing, unchanged.

**⛔ Do not disturb the neighbouring latches.** `deliveryCount === 12` (Heavy Hauler / `fullChains` /
`heavyHaulerEvents`) and `deliveryCount === CARGO_CAP_MAX` (Maxed Out / `superMegaDelivery()`) sit in
the same block, share the same "passes through N exactly once per visit" idiom, and are **not** in
scope. The 12 in the powerup condition and the 12 in the Heavy Hauler condition are different
mechanisms that happen to share a number.

### 7.3 Score compensation: none (S4)

The delivery curve is untouched. It already pays `50 + 25 × (N−1)` for the Nth canister of a visit,
so a 24-piece haul totals **8,100** — **6.75×** what those same 24 pieces earn delivered one at a
time. The greed-vs-risk incentive is already carried by the score curve; the powerups were stacked on
top of it.

| Canisters in one visit | Visit total | Per canister | vs. one at a time |
|---|---|---|---|
| 1 | 50 | 50 | 1.00× |
| 4 | 350 | 88 | 1.75× |
| 7 | 875 | 125 | 2.50× |
| **8** | **1,100** | 138 | **2.75×** |
| 12 | 2,250 | 188 | 3.75× |
| 16 | 3,800 | 238 | 4.75× |
| 20 | 5,750 | 288 | 5.75× |
| 24 | 8,100 | 338 | 6.75× |

### 7.4 Two new knobs

Promote `DOCK_BASE_SCORE` (50) and `DOCK_BONUS_STEP` (25) — bare constants today (C6) — to debug
knobs in the **DELIVERY** section, at their current values. **Values do not change this changeset.**
This exists so the curve can be retuned by feel in-browser if the powerup nerf turns out to need
compensation after all, rather than by rebuild. The shipped constants stay in place as the documented
defaults the knobs derive from, per the `scoopHitsPerLevel` precedent.

Scoring continues to route through `addScore()`.

---

## 8. Dropped

**Wrong name-entry screen (raw notes item 2).** Paul identified this as a cached file in MS Edge.
Confirmed unreproducible at HEAD in any case: CS034 P7 deleted the 3-slot initials entry, its
renderer, its input dispatcher and its commit function; `makeRunResult()` now reads
`Profiles.nameOf(Profiles.activeId)`. **No investigation, no phase, no test.**

---

## 9. Cross-cutting constraints

- **`DEBUG_VARS` is append-only.** Registry was **106** at HEAD. Growth this changeset: **+4** (item A
  benchmark controls, landed P2) **+1** (telemetry interval) **+2** (delivery score knobs) =
  **113 final**. Item A's caps contributed **0** — Gate A cleared every population and P3 was
  dropped. Headers **10 → 11** (a BENCHMARK section). `LEVERS` stays **18** — nothing here is a
  difficulty ramp.
- **`test-registry.js` pins registry 106, headers 10, `LEVERS` 18, `POWERUP_DROP_TYPES` 5.** Every
  phase that adds a row updates it in the same commit.
- All new world-space distance/aiming math uses the wrap-aware helpers `dist2`, `angleTo`,
  `shortDelta`.
- Entity lifecycle: dead-flag plus end-of-frame `.filter()`, never a mid-loop splice.
- All scoring routes through `addScore()`.
- localStorage keys are frozen and append-only; new state is additive with known-value-else-default
  loading.
- The CS016 P3 both-places rule: any new field on `game` is declared in **both** the `game` literal
  and `resetRun()`. Preferred alternative where it fits: module-level state (the `DebugPanel`
  precedent), which the baseline and the telemetry buffer both use.
- **`⛔ INVARIANT` markers in `CLAUDE.md` to update: one, not two.** Only the `resumeFromSave()` step
  ordering (item E — the baseline snapshot joins the ordering constraint). The `cullGarbage()`
  determinism note is **left exactly as it stands**: no cull changed, no cap shipped, and editing it
  would imply a change that did not happen.
- **GDD §2 describes shipped behaviour only.** Nothing enters it until built. Item A's benchmark is a
  developer instrument and does not enter §2 at all — and with P3 dropped, item A contributes
  **nothing** to §2.
- **Two unseeded-test flakes are standing** (`test-cs035-p3` §F at ~5 %, `test-f6` §F at ~1.7 %). A
  rerun is the standing way to tell either from a real regression; roughly one full-suite run in
  twenty goes red for this reason alone.
- **FLAG-CS036-a applies to every gate in this changeset**, not just Gate A. Before answering any
  numeric gate question, set **"Overrides Applied" → OFF** or use **"Reset all debug knobs to
  defaults"**. Gate A's phase handles this in code (§2.1); Gate B is a manual discipline.