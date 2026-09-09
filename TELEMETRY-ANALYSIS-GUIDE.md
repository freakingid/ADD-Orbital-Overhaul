# Orbital Overhaul — Telemetry Analysis Guide

**Purpose.** Hand this to Claude along with a telemetry CSV. It carries everything needed to parse
the log, verify it, run the standard battery, and avoid the traps — so a session can go straight to
findings instead of rediscovering the schema.

**Written after:** the first full analysis (196-row run, waves 1–13, `orbital-overhaul.html` @
`76eeca7` / CS038). Covers the **v1 schema** (30 columns, CS037 P4), the **v2 schema** (43 columns +
`#` header, CS039 P1–P3), the **v3 schema** (44 columns, CS039 GATE T) and the **v4 schema** (49
columns + 9-line header, CS040 P5). A v2 log still parses fine — it is simply missing
`cargoSevers`, and §3 says what to do instead. A v3 log parses fine too — it is missing the six
CS040 columns (§3's v4 section) and the two new header lines (§3's header-block subsection); do not
attempt to backfill either.

---

## 0. First move: verify, don't assume

Everything below is written from the build at a moment in time. **The repo is ground truth and
supersedes this document.** Clone before writing any claim:

```
git clone --depth 1 https://github.com/freakingid/ADD-Orbital-Overhaul /tmp/adorb
cd /tmp/adorb && git log -1 --oneline
grep -n "const TELEMETRY_FIELDS" -A 20 orbital-overhaul.html
grep -n "const Telemetry" orbital-overhaul.html
```

Read `TELEMETRY_FIELDS` and `Telemetry.push()` together — they are the single source of truth for
both the row shape and the CSV column order. If the field list has grown past what §3 documents,
trust the file and say so in the report.

Also re-read the constants in §4 rather than trusting the numbers printed here. Most of the useful
arithmetic (hit counts, wasted healing, bonus attribution) is division by a constant, and a retuned
constant silently invalidates it.

**Vocabulary is inverted on purpose.** `game.debris` holds **Garbage Satellites** (the enemies);
`game.garbage` holds towable **Debris** (the salvage). So `dmgDebris1` is damage *from a small
Garbage Satellite*, and `debrisKills` counts *Garbage Satellites destroyed*. Do not "fix" this in
the write-up — carry the build's own names and gloss them once.

---

## 1. What the log is

- **One row every `DEBUG.telemetryInterval` seconds of GAME TIME** (default 15). The clock is
  `game.stats.gameTime`, ticked from `update()`'s cleanup block, which only runs on a live,
  unpaused, unfrozen playing frame. **Menu, pause and level-ceremony seconds are not in `t`.** Two
  rows are therefore always comparable; you never need to correct for idle time.
- **Per-run.** `resetRun()` clears the buffer. A log is one run, never two.
- **Ring buffer, `TELEMETRY_MAX = 800` (CS040 P5, was 400).** At 15 s that is 200 minutes. Past
  that, the OLDEST rows roll off — **no longer silently as of v4**: the ring latches `wrapped` the
  first time it drops a row, and the export's `# ringWrapped=` header line reports it. **Always
  check that line before trusting a total** (§2).
- **Persisted every `TELEMETRY_PERSIST_EVERY` (4th) snapshot** to `afd_telemetry_v1` in
  localStorage — CS040 P5 traded per-snapshot writes for a quadrupled-payload, one-fourth-frequency
  write (the ring doubling alone would have doubled every write's `JSON.stringify` cost; this holds
  it at roughly the pre-CS040 volume). A crash can lose at most three snapshots. **The game-over
  flush (v4) always persists regardless of where that counter stands** — see the header-block
  subsection below for `finalRowIsGameOver`. The export prefers the live buffer and falls back to
  the stored one.
- **Opt-in since CS038 P3.** `DEBUG.telemetryCapture` defaults OFF and is off at every launch. A run
  with capture off produces nothing; it does not produce a partial log.
- **Exported by hand.** Through CS040 P5, from the debug panel's "Copy telemetry log" row. **As of
  CS040 P6, telemetry has its own Options → Telemetry submenu** (Capture ON/OFF, a sample-rate
  preset cycle, and "Copy log") — the debug-panel action row is gone, but `DEBUG.telemetryInterval`/
  `telemetryCapture` are unchanged underneath and still never persist (session-only by design).
  Either surface produces the identical CSV.

---

## 2. Verification checklist — run this before analysing anything

Six checks. Each has caught something real.

1. **Cadence.** `df['t'].diff()` should be tight around the interval (σ ≈ 0.002 s). A gap that is a
   clean multiple of the interval means dropped snapshots; a ragged one means something is wrong
   with the clock. Report either.
2. **Truncation.** **In a v4 log, lead with `# ringWrapped=` from the header block — this is now the
   METHOD, not a fallback.** `true` means the run's opening rolled off the ring and every cumulative
   column starts from a non-zero, unknown baseline, so *all* whole-run totals are lower bounds; say
   so prominently, it is the single most misleading failure mode in this schema. `false` means the
   log is complete from the run's start, full stop — no arithmetic needed.
   For a v1–v3 log, which carries no such flag, fall back to the old arithmetic: if
   `len(df) == 400` (or whatever `TELEMETRY_MAX` was for that build) **and** `t[0]` is noticeably
   greater than the interval, the run's opening rolled off the ring. If `t[0] ≈ interval`, the log
   is complete from the run's start.

   **Capacity is interval-dependent, and it doubled at CS040 P5** (`TELEMETRY_MAX` 400 → 800):

   | Interval | Capacity (v1–v3, `TELEMETRY_MAX=400`) | Capacity (v4, `TELEMETRY_MAX=800`) |
   |---|---|---|
   | 5 s | 33 min | 67 min |
   | 10 s | 67 min | 133 min |
   | 15 s (default) | 100 min | 200 min |

   **Practical rule:** any run expected to run past ~30 minutes wants a v4 build, interval 15, or
   both. The 08-26 capture (a v3 build) wrapped and silently lost its first 21.5 minutes and waves
   1–7 — `t[0]` was 1290 with `rows = 400` — which is the failure `ringWrapped` exists to make
   loud instead of silent.
3. **Monotonicity.** Every cumulative column (`score`, all `*Picked`, all `dmg*`, and in v2+ the
   kill/delivery/bonus counters, and in v4 `hpWasted`) must be non-decreasing. A decrease means a
   schema misread or a corrupt export — **with exactly two sanctioned exceptions, both sawtooths:
   `cargoDamageEvents` (v2+) and `scoopHits` (v4).** Both must be excluded from this check by name,
   or it reports a failure on every real log (§3). Nothing else dropping is ever legitimate.
4. **Flags.** `debugRun` and `resumedRun`. A `debugRun` row was played with knob overrides in force;
   a `resumedRun` row belongs to a run that loaded a save, meaning `score` contains a baked-in
   pre-load component that cannot be separated out. **Either flag being true anywhere makes the run
   non-comparable to a clean one** — filter or caveat, do not quietly average.
5. **Damage arithmetic.** Every `dmg*` total should divide evenly by its source's damage constant
   (§4). If it does not, either a constant was retuned or a damage multiplier has landed — and the
   hit-ledger reconstruction in §5 is invalid. Both the 08-23 and 08-26 captures passed this check
   exactly — reconstructed hits (`dmg*/UNIT`) equalled `hitsTaken` to the unit across all five parts
   of those runs (34, 54, 86, 120, 126). Worth recording as the shape of a pass, not just a failure.
6. **Column count.** Compare the header against `TELEMETRY_FIELDS` in the cloned build. A mismatch
   means the log came from a different build than the one you are reading.

---

## 3. Column dictionary

### v1 — 30 columns (CS037 P4)

**Instantaneous state at the sample instant:**

| Column | Meaning |
|---|---|
| `t` | seconds of game time since the run started |
| `level` | `game.wave`, 1-based |
| `score` | cumulative run score (see §6 — it is a composite) |
| `hp` | hull, 0…`SHIP_MAX_HP` |
| `speed` | `hypot(vx, vy)` px/s — a single instant, **not** an average over the interval |

**Remaining-use budgets** — how much of an effect is left, *not* whether it was picked up:

| Column | Unit |
|---|---|
| `rapidLeft` | trigger-pulls remaining |
| `tripleLeft` | trigger-pulls remaining (a 3-fan is ONE pull) |
| `magnetLeft` | canisters the magnet will still hook |
| `engineLeft` | **seconds** of forward thrust — the only fractional budget. ⛔ **As of CS042 P7 the tank burns only while the chain is NON-EMPTY**, so an unladen stretch no longer drains it; a flat `engineLeft` across several rows can mean "flying empty", not "not thrusting" |
| `guardLeft` | chain-guard intercepts remaining |
| `scoopLevel` | 0…`SCOOP_MAX_LEVEL`, persistent; decays by damage, never by time |

There are six, not seven, and the asymmetry is deliberate: five live in `game.powerBudget`, scoop is
a persistent level, and health is instantaneous so it has no remaining-use quantity at all.

`SCOOP_MAX_LEVEL` is itself a tunable constant (currently 5) that a future changeset may raise —
read it from the build (§4's grep), never assume 5 when computing an "at max" share.

**Cumulative pickup counters:** `rapidPicked`, `triplePicked`, `healthPicked`, `magnetPicked`,
`enginePicked`, `scoopPicked`, `guardPicked`.

**Cumulative damage, in HP actually deducted**, non-lethal hits only:
`dmgDebris3/2/1` (large/medium/small **Garbage Satellite**), `dmgHunter3/2/1` (large/medium/small
**Hunter**), `dmgUfoBodyLarge/Small`, `dmgUfoShotLarge/Small`.

**Flags:** `debugRun`, `resumedRun` — emitted as `true`/`false`, always the last two columns.

### v2/v3 — the CS039 additions (14 columns)

Inserted before the two flags. **Three** kinds, and the names don't tell you which. The third kind
has exactly one member, and it is the trap in this whole schema — read `cargoDamageEvents` below
before you total anything.

**Instantaneous:**

| Column | Meaning |
|---|---|
| `chainLen` | tow-chain nodes at the sample instant — how much cargo is on the hook |
| `cargoMax` | the live tow cap. Grows by wave: `payloadSlots(n)` = 8 for n≤4, +2 per wave, 24 at n≥12 |

**Cumulative:**

| Column | Meaning |
|---|---|
| `delivered` | canisters delivered to the dock |
| `deliveryScore` | points earned *at the dock* |
| `cargoSevers` | **v3 only.** unguarded chain severs this run — cargo actually lost. The column to total. |
| `debrisKills` | **Garbage Satellites** destroyed |
| `hunterKills` | Hunters destroyed, all three tiers |
| `saucerKills` | saucers destroyed, both sizes |
| `hunterCoalesced` | Hunters born from neglected scrap — the Kessler loop firing |
| `deflects` | hits absorbed by the shield (HP that was *not* taken) |
| `hitsTaken` | non-lethal hits that deducted HP — same population as the `dmg*` sums |
| `scoreRepairBonus` | ⛔ **REMOVED in v4** (CS040 P1/P5) — see the v4 section below. Present in v2/v3 only. |
| `scoreScoopBonus` | cumulative `SCOOP_MAX_BONUS` (scoop picked at max level) |

**Neither — one column, and it DECREASES:**

| Column | Meaning |
|---|---|
| `cargoDamageEvents` | unguarded chain severs **since the last guard drop**. A sawtooth, not a total. |

⛔ **`cargoDamageEvents` is the chain-guard drop-weight PITY counter, not a run tally.** It is zeroed
in `dropPowerup()` the instant a guard is *selected to drop* — **not on pickup**, so it resets with
no matching `guardPicked` increment and a log can show more resets than pickups. The last row is
whatever happened to be standing when the run ended, and is routinely **0**. It was documented here
and in the build as cumulative for the whole of CS039; the first real capture showed 7 decreases in
53 rows. `guardDropWeight()` is the one consumer that wants this value.

**In a v3 log, read `cargoSevers` and ignore the sawtooth.** In a v2 log `cargoSevers` does not
exist, and the best available answer is a **lower bound** — sum the positive deltas, and at each
reset add the new value (severs between the last sample and the reset are unrecoverable):

```python
sev, resets, prev = 0, 0, 0
for c in d.cargoDamageEvents:
    if c >= prev: sev += c - prev
    else:         sev += c; resets += 1
    prev = c
print(f'severs >= {sev} across {resets} guard drops')   # v2: a FLOOR, never a total
```

### v4 — the CS040 additions (49 columns total)

CS040 P1 deleted the score-milestone HP repair outright (§4's constants table and its two
behavioural facts explain why) and P5 built the six-column telemetry footprint of the healing
rework that replaced it. **Net change from v3's 44: −1 (`scoreRepairBonus`, removed) + 6 (below) =
49.** The full, ordered column list — grep `TELEMETRY_FIELDS` in `orbital-overhaul.html` rather than
trusting this list across builds:

```
t, level, score, hp, speed,
rapidLeft, tripleLeft, magnetLeft, engineLeft, guardLeft, scoopLevel,
rapidPicked, triplePicked, healthPicked, magnetPicked, enginePicked, scoopPicked, guardPicked,
dmgDebris3, dmgDebris2, dmgDebris1,
dmgHunter3, dmgHunter2, dmgHunter1,
dmgUfoBodyLarge, dmgUfoBodySmall, dmgUfoShotLarge, dmgUfoShotSmall,
chainLen, cargoMax,
hunterCount, debrisCount, garbageCount, healthBanked,
delivered, deliveryScore, cargoDamageEvents, cargoSevers,
debrisKills, hunterKills, saucerKills, hunterCoalesced,
deflects, hitsTaken, hpWasted,
scoreScoopBonus, scoopHits,
debugRun, resumedRun
```

**Instantaneous — four new columns, inserted after `cargoMax`:**

| Column | Meaning |
|---|---|
| `hunterCount` | live Hunters at the sample instant (`game.hunters.length`) |
| `debrisCount` | live **Garbage Satellites** at the sample instant (`game.debris.length`) — **inverted vocabulary, on purpose** |
| `garbageCount` | live towable **Debris** at the sample instant (`game.garbage.length`) — **inverted vocabulary, on purpose** |
| `healthBanked` | spare whole Health charges currently held, `0..DEBUG.healthBankMax` |

⛔ **Restating the inverted vocabulary because these three columns are exactly where it bites.** The
build's own names are inverted from the canonical terms (CLAUDE.md's vocabulary table): `game.debris`
holds **Garbage Satellites** — the enemies you shoot, which split and drop Debris — and `game.garbage`
holds towable **Debris**, the salvage you tow to the dock. So `debrisCount` is a count of Garbage
Satellites (matching `debrisKills` and the `dmgDebris*` family already in this schema), and
`garbageCount` is a count of towable Debris. Do not "fix" the column names — they carry the build's
own naming convention deliberately, the same as every other column in this dictionary. **This closes
the "enemy population" blind spot §10 named as the most obvious next column** — it now exists, in
exactly the three-integer shape §10 asked for.

**Cumulative — one new column, `hpWasted`, inserted beside `hitsTaken`:**

`hpWasted` is healing thrown away because the hull was already full **and** the health bank was also
full — CS040 P3's banking mechanic applies what room remains, banks one whole charge for any
leftover at all, and only counts toward `hpWasted` when a pickup lands with *both* full. It answers a
question v1–v3 could not: is healing scarce, or is it arriving mistimed? Read it against
`healthPicked`:

- **Near zero, relative to `healthPicked × POWERUP_HEALTH_AMOUNT`.** The bank cap (`healthBankMax`)
  is sufficient for how bursty this run's healing pickups actually were — nothing to retune.
- **Large, and rising in calm stretches.** Health cadence (the pity-driven ambient timer, §4) is
  outrunning damage while the player is safe, so pickups are landing at/near the cap with the bank
  already full. **The fix is to widen the bank (`healthBankMax`), not to slow the cadence** — the
  cadence is deliberately faster while hurt (§4) and slowing it globally would blunt the rescue case
  the whole rework exists for.

**Neither — a SECOND sawtooth, `scoopHits`, inserted after `scoreScoopBonus`:**

⛔ **The schema now has TWO sawtooths, not one.** `scoopHits` mirrors `cargoDamageEvents`'s shape from
a different mechanism: `damageShip()` zeros it every time a scoop LEVEL IS ACTUALLY LOST, so it reads
"non-lethal hits since the last scoop-level loss," never the run total. **It resets on scoop level
loss, specifically — not on any hit, not on a scoop pickup.** There is no cumulative twin for it in
this schema; nothing in the build counts scoop hits across a whole run, and none was added to serve
this column. **§2's monotonicity check and §9's starter-script `CUM` list must exclude BOTH
`cargoDamageEvents` and `scoopHits` by name** — either one left in will report a failure on every
real log.

### v2/v3/v4 — the `#` header block

**Nine** `#`-prefixed lines above the CSV header as of v4 (seven through v3). Skip them with
`pd.read_csv(path, comment='#')`, but **read them first** — they are the run's provenance:

```
# orbital-overhaul telemetry v4
# build=1.0.0.40
# overrides=OFF
# telemetryInterval=15
# rows=196
# ringWrapped=false
# finalRowIsGameOver=true
# source=this run
# levers=none
```

`levers=` lists **effective** non-default knobs — what the game actually used, resolved through the
master overrides toggle. `levers=none` with `overrides=OFF` means stock tuning even if the panel had
edits sitting in it. Any lever listed means **this run is not comparable to a stock run** on whatever
that lever controls; lead the report with it.

⛔ **`ringWrapped` (v4) — read this BEFORE anything else in the header.** `true` means the ring
dropped rows and every cumulative total below is a lower bound over an unknown-length missing
opening (§2.2). It is the single most load-bearing line in the block, which is why it sits directly
above `finalRowIsGameOver` rather than buried near the bottom.

`finalRowIsGameOver` (v4) — `true` means the last row in this log **is** the death frame (CS040 P5's
game-over flush), so the killing blow is actually visible in the data for the first time in this
schema's history. `false` means the log stops up to one sampling interval short of the end — either
the run is still in progress, or it ended in a way the flush didn't catch (a menu quit rather than a
death; `quitToTitle()` does not flush).

`source=storage` means the export came from the persisted envelope rather than a live buffer —
usually a run recovered after a crash or refresh, still valid but worth noting. **In a v4 log, a
`source=storage` export reads `ringWrapped`/`finalRowIsGameOver` from the stored envelope, not the
live session's latches** — the envelope carries both for exactly this case (the morning after a
capture, live buffer empty).

---

## 4. Constants needed for the arithmetic

Re-grep these; do not trust the values below across builds.

| Constant | Value | Used for |
|---|---|---|
| `SHIP_MAX_HP` | 250 | the healing ceiling |
| `DMG_SMALL / MEDIUM / LARGE` | 20 / 35 / 50 | Garbage Satellite hits by tier (small/medium/large) |
| `HUNTER_DAMAGE` | {3:60, 2:45, 1:30} | Hunter hits by tier |
| `DMG_BULLET` | 15 | saucer shot, both sizes |
| saucer body | 20 small / 35 medium | ramming a saucer |
| `POWERUP_HEALTH_AMOUNT` | 25 | HP per health pickup (also the size of one banked charge) |
| `REPAIR_MILESTONE` | 10000 | score interval that now SPAWNS a Health pickup (CS040 P1) — see the behavioural facts below |
| `SCOOP_MAX_LEVEL` | **7** (was 5 before CS042 P8) | scoop ceiling; levels 6–7 add the flanking capture orbs |
| `SCOOP_HITS_PER_LEVEL` | **2** (was 5 before CS042 P9) | hits that cost one scoop level — see §7's `scoopHits` trap |
| `SCOOP_MAX_BONUS` | 500 | score paid when a scoop pickup lands at max |
| `RAPID_SHOTS / TRIPLE_SHOTS / MAGNET_PIECES` | 40 / 30 / 40 | budget granted per pickup |
| `ENGINE_BURN_SECONDS` | 10.0 | thrust-seconds per engine pickup |
| `DEBUG.chainGuardIntercepts` | 3 | intercepts per guard pickup |
| `POWERUP_DROP_WEIGHTS` | rapid 30, triple 30, scoop 20, magnet 10, engine 10; guard's `20` is a placeholder, never read as a weight | expected drop mix |
| `DEBUG.healthBankMax` | 2 (`def` from `HEALTH_BANK_MAX`) | spare Health charges the bank can hold, `0` disables banking |
| `DEBUG.healthGapLowOk / HighOk` | **30 / 45 s** (was 22 / 30 before CS042 P6; `def` from `HEALTH_GAP_LOW_OK` / `HEALTH_GAP_HIGH_OK`) | ambient health roll range at full hull |
| `DEBUG.healthGapLowHurt / HighHurt` | **10 / 16 s** (was 6 / 10 before CS042 P6; `def` from `HEALTH_GAP_LOW_HURT` / `HEALTH_GAP_HIGH_HURT`) | ambient health roll range at zero hull |
| `DEBUG.healthSpawnLock` | 12 s (`def` from `HEALTH_SPAWN_LOCK`, CS042 P6) | global lockout after **any** Health spawn; `0` disables it. The separate one-at-a-time gate has no knob |
| `DEBUG.repairMilestoneGrowth` | 0.08 (CS042 P6) | the milestone interval widens by this fraction of `REPAIR_MILESTONE` per level; `0` = flat |
| `DEBUG.repairMilestoneHullPct` | 0.70 (CS042 P6) | a milestone crossing pays only while `hp <= SHIP_MAX_HP ×` this; `1.0` = CS040's rule |
| `DEBUG.bankSpareHullPct` | 0.70 (CS042 P9) | above this **post-damage** hull a banked charge spares a scoop level instead of healing. Same number as the row above, by design |
| `DEBUG.cargoUnitMass` | 0.07 (`def` from `CARGO_UNIT_MASS`, CS042 P7) | `shipMass()` = `1 + chainMass() ×` this — the one divisor for thrust, drag rate, turn and tug. `0` = weightless cargo |
| `DEBUG.hubDryWeightMult` | 4 (`def` from `HUB_DRY_WEIGHT_MULT`) | multiplier on a zero-budget type's roll weight, recycle-hub drop only |
| `CARGO_CAP_MAX` | 24 | tow cap ceiling |

⛔ **`REPAIR_AMOUNT` and `REPAIR_FULL_BONUS` are DELETED (CS040 P1), not retuned — do not look for
them or treat their absence as a build regression.** Every 10,000-point milestone used to add +25 HP
directly, or pay 2,500 points instead if the hull was already full; as of CS040 both of those arms
are gone. A crossing below max HP now calls the same `spawnHealthPowerup()` the ambient timer uses
— it places a pickup, it does not heal — and a crossing at max HP does nothing at all, not even a
sound. See the second behavioural fact below for why this changed and what replaced it.

⛔ **`POWERUP_HEALTH_GAP` is RETIRED (CS040 P2) — ambient cadence is now a function of hull, not a
flat `[18, 26]` roll.** `healthGapRoll()` lerps between the `HEALTH_GAP_*` pairs above on
`game.ship.hp / SHIP_MAX_HP`: roughly 6–10 s between spawns near zero hull, 22–30 s near full hull.
A telemetry column cannot see the roll directly, but `hp` is sampled every row, so a rough cadence
estimate is recoverable by bucketing `t`-gaps between consecutive Health pickups (`d_health` deltas
in §5) against the `hp` reading at the start of each gap.

**Guard's real weight is dynamic, not the table's `20`.** `dropPowerup()`'s `weightOf()`
indirection substitutes `guardDropWeight() = min(chainGuardDropMax, chainGuardDropBase +
chainGuardDropPity × cargoDamageEvents)` — defaults 40 / 4 / 8 — and guard is admitted to the roll
at all only while `game.chain.length >= chainGuardMinTow` (default 5); an ineligible key is skipped
in both the running total and the walk, so the remaining weights renormalise. Against the fixed
100-point non-guard total, that puts guard's own share at ~3.8% at its pity-reset floor (4/104),
climbing to ~29% at its cap (40/140). The `20` sitting in the table exists only so a reader sees a
plausible slot — it is never actually evaluated as a weight.

**Two behavioural facts that matter more than any single constant:**

1. **Powerup budgets BANK.** A same-type pickup *adds* to the remaining budget; nothing decays on a
   clock. So a `*Left` column is a stockpile with memory, and a good phase silently converts into a
   buffer spent one or two waves later.
2. ⛔ **REWRITTEN FOR v4 (CS040) — "health is time-gated, everything else is kill-gated" is now
   WRONG in both halves, not just retuned.** This used to be the single most useful structural fact
   in the whole schema (§7 built a trap on it, "health rate rising is not good news" — that trap is
   also rewritten, see §7) and both halves changed at once, so it needs restating rather than
   patching:
   - **Health is no longer purely time-gated.** The ambient timer survives, but as of CS040 P2 its
     own cadence is **hull-gated** — a pity curve that fires roughly every 6–10 s near zero hull and
     22–30 s near full hull (`healthGapRoll()`, §4), not a flat roll. On top of that, as of CS040 P1
     the 10,000-point score milestone is **also** a Health source: below max HP a crossing calls the
     exact same `spawnHealthPowerup()` the ambient timer uses, making Health additionally
     **score-gated**. Two independent triggers now feed the same pickup type.
   - **Everything else is still kill- or dock-gated, unchanged** — Rapid/Triple/Magnet/Engine/Scoop
     drop from a Saucer kill, a large Hunter core, or the recycle dock's every-10th-Debris latch,
     exactly as before CS040. **What's new here (CS040 P4) is that the recycle HUB's own drop — the
     one that fires at `game.deliveryCount === 8`, distinct from the every-10-Debris drop above —
     is additionally delivery-gated with a dry-budget bias:** any budgeted type sitting at zero
     (`rapid`/`triple`/`magnet`/`engine`, never `guard`) gets its roll weight multiplied by
     `DEBUG.hubDryWeightMult` (4) on that one call only. Kill-gated drops (Saucer, large-Hunter-core)
     are completely unaffected by this bias — see the hub-resupply discussion in the GDD's Powerups
     section for the full mechanic.
   - **Net effect:** Health's "share of pickups" trend (§6 item 9, §7's old trap) can no longer be
     read as a pure inverse of kill rate. A rising Health share can now mean falling kills (the old
     reading), rising score (a new, independent driver), or both at once — decompose before
     concluding either way. `hpWasted` and `healthBanked` (§3's v4 section) are the columns built to
     help separate "health is genuinely scarce" from "health is arriving but mistimed."

---

## 5. Standard derivations

```python
import pandas as pd, numpy as np
d = pd.read_csv(path, comment='#')          # comment='#' is harmless on v1, required on v2

DMG = ['dmgDebris3','dmgDebris2','dmgDebris1','dmgHunter3','dmgHunter2','dmgHunter1',
       'dmgUfoBodyLarge','dmgUfoBodySmall','dmgUfoShotLarge','dmgUfoShotSmall']
UNIT = dict(zip(DMG, [50,35,20,60,45,30,35,20,15,15]))
PICK = ['rapid','triple','health','magnet','engine','scoop','guard']

d['dmgTot'] = d[DMG].sum(axis=1)
d['ddmg']   = d['dmgTot'].diff()             # damage taken in this interval
d['dscore'] = d['score'].diff()              # score earned in this interval
for k in PICK: d['d_'+k] = d[k+'Picked'].diff()
d['killpu'] = d[['d_'+k for k in PICK if k != 'health']].sum(axis=1)
d['dry']    = (d.rapidLeft == 0) & (d.tripleLeft == 0)
```

**Always work in deltas.** Nearly every column is cumulative, and correlating cumulative columns
against each other or against `t` just measures that both go up. The rate is the signal.

**Hit ledger** (v1's only route to hit counts; a cross-check in v2):
`hits_from_source = dmg_total / UNIT[source]`. Sum for total hits.
In v2, assert this equals `hitsTaken`. Disagreement means a constant moved or a multiplier landed.

**HP balance:**
`healing_applied = hp_end − SHIP_MAX_HP + total_damage`.
⛔ **v1–v3 only, and the milestone half is dead in v4.** In v1–v3, Health pickups supply at most
`healthPicked × 25` and the remainder came from score milestones — a milestone that healed added
+25 HP directly, and one that didn't fired `REPAIR_FULL_BONUS` (2,500 points) instead
(`milestones crossed = floor(final_score / REPAIR_MILESTONE)`, estimated in v1, measured directly by
`scoreRepairBonus` in v2/v3). **As of v4 (CS040 P1), a milestone never heals directly** — it only
spawns a Health pickup below max HP, which the player then has to fly to and collect like any other
Health pickup, so `healthPicked` alone accounts for every point of applied healing again. Use
`hpWasted` (§3's v4 section) for what a v4 run threw away rather than trying to reconstruct a
milestone-healing estimate that no longer exists.

**Score decomposition:**
⛔ **v1–v3:** `score = deliveryScore + scoreRepairBonus + scoreScoopBonus + residual`, where the
residual is kills and everything else. **v4 (CS040 P1 deleted `scoreRepairBonus` — milestone healing
is gone, so the counter had no consumer left):**
`score = deliveryScore + scoreScoopBonus + residual`, three terms instead of four. Report every
present share — this is the thing v1 could not do at all, and v4 does with one fewer term than
v2/v3.

**Delivery economy has a fixed incentive floor at 8 (v2/v3).** The recycle hub drops exactly ONE
powerup per dock visit, latched at `game.deliveryCount === 8` (CS037 P7 collapsed the former
12/16/20 latches into this single equality — the counter increments by one per canister, so it
always passes through 8 exactly once per visit). `game.deliveryCount === CARGO_CAP_MAX` (24)
additionally fires `superMegaDelivery()`. Per-visit score is quadratic —
`pts(n) = DOCK_BASE_SCORE + DOCK_BONUS_STEP × (n-1)` per canister — summing to `12.5×N² + 37.5×N`
at the shipped 50/25 (`DOCK_BASE_SCORE = 50`, `DOCK_BONUS_STEP = 25`), i.e. an average of 137.5
pts/canister at N=8 and 337.5 at N=24. **Consequence:** mean `chainLen` is a STRATEGY readout, not a
capacity readout — 8 is a hard floor that does not move with `cargoMax`. `deliveryScore / delivered`
recovers the player's typical visit size by inverting the per-canister average `12.5×N + 37.5`.
This pairs with tow-cap occupancy (dwell vs. distinct full hauls — §7):

```python
at_cap = d.chainLen >= d.cargoMax
episodes = (at_cap & ~at_cap.shift(1, fill_value=False)).sum()
print(f'at-cap dwell: {at_cap.mean()*100:.1f}% of samples  |  distinct full hauls: {episodes}')

avg_per_canister = d.deliveryScore.iloc[-1] / d.delivered.iloc[-1]
typical_N = (avg_per_canister - 37.5) / 12.5
print(f'typical visit size ≈ {typical_N:.1f} canisters (avg payout {avg_per_canister:.1f}/canister)')
```

**Wave table.** Group by `level` and report, per wave: duration, score/s, damage/min, HP min and
mean, mean scoop, pickups/min, and in v2 mean `chainLen` and deliveries/min. This table is where the
run's story lives; build it first.

---

## 6. The analysis battery — what to check, in order

1. **Run shape.** Score rate by wave. Look for phases (ramp / plateau / trough / recovery), not a
   smooth curve. Note where wave *duration* diverges from wave *score* — a wave that pays the same
   as the last one but takes 50% longer is the real difficulty signal.
2. **Does anything trend with `t` or `level` at all?** Spearman on damage/interval and score/interval
   against `t`. In the first analysed run both were ≈0.04, i.e. **difficulty scaling was invisible in
   per-minute terms** and showed up only as wave length. That is a headline finding either way.
3. **Damage composition.** Share by source, implied hit counts, and first-appearance time per source.
   Look for sources that never fire at all. **Do not diagnose a zero as a bug, and do not propose
   instrumentation for it before asking** — report the zero, name the mechanism, and ask the player.
   `deflects` was 0 across 81 minutes in the 08-23 and 08-26 captures; the shield is a deliberate
   *Asteroids Deluxe* homage this particular player does not use, with the auto-shield option
   covering players who want the mechanic without manual timing. A zero can be a design outcome, not
   a dead hook.
4. **Damage clustering.** Fraction of intervals with zero damage, longest clean streak, worst
   rolling 3–5-interval window. Damage is bursty; a mean is close to meaningless and the tail is the
   tunable thing.
5. **Ceiling waste.** Time at `hp == SHIP_MAX_HP`, health pickups taken while already full, time at
   `scoopLevel == SCOOP_MAX_LEVEL`, scoop pickups landing at max. Both resources convert to score
   when capped, so time-at-cap is a reward-economy question, not just a comfort one.
6. **Budget dynamics.** Per powerup: mean stock, fraction of samples at zero, peak and when. Look for
   the hoard-and-drain arc (banking creates one) and for powerups that are functionally absent —
   in the first run, engine was empty 83% of samples and guard 73%, meaning neither is a resource the
   player manages.
7. **The dry-weapon split.** Median score/interval when `rapidLeft == 0 and tripleLeft == 0` versus
   otherwise. This was the strongest single-variable split in the first run (1,400 vs 4,825).
8. **Drop mix vs the design table.** Kill-drop shares against `POWERUP_DROP_WEIGHTS`. Close agreement
   means both that the roll is behaving and that the player is collecting rather than filtering; a
   shortfall in one type is a hint that it is being skipped or timing out. **`guard` must be excluded
   from a naive share comparison, or its expected share computed dynamically from
   `guardDropWeight()`** (§4) — comparing observed guard pickups against the table's flat `20` will
   always look like a shortfall and always be wrong. **This comparison measures COLLECTION, not the
   roll.** In the 08-23 and 08-26 captures, `triple` was over-collected and `rapid` under-collected
   by ~12 points of share in both runs, and the cause was player preference, not drop behaviour —
   ask the player before inferring anything from a drop-mix gap.
9. **Health share of pickups, by wave.** The throughput index (§7). Cleaner than score because it is
   not polluted by bonuses.
10. **Correlations — then immediately sort them into three buckets** (§7).
11. **Narrate the worst window as a sequence.** Find the lowest-HP or lowest-score-rate stretch and
    walk it in order: what spiked, what depleted, what collapsed, what recovered and how. Feedback
    loops are visible in ordering and invisible in a correlation matrix.
12. **v2/v3 additions:** tow occupancy (`chainLen` / `cargoMax`), deliveries per minute, sever rate
    (`cargoSevers` — **never** `cargoDamageEvents`, §3), coalescence rate (`hunterCoalesced`), deflect share
    (`deflects` vs `hitsTaken`), and the score decomposition from §5.
13. **Delivery economy floor (v2/v3).** The dock's one-powerup-per-visit latch fires at a fixed
    `game.deliveryCount === 8`, and per-visit score is quadratic — see §5's derivation and inversion.
    Because 8 does not move with `cargoMax`, mean `chainLen` reads as a strategy choice, not a
    capacity ceiling; recover typical visit size from `deliveryScore / delivered` instead of reading
    `chainLen` as "how much cargo the player can carry."

---

## 7. Traps

**Sort every correlation into one of three buckets and label it in the report.** This matters more
than the coefficients.

- **Mechanically forced** — true but not a discovery. `hp` ↔ damage (damage *is* HP loss).
  `scoopLevel` ↔ `hp` (scoop decays on hit; hits also cost HP — one cause, two effects). Report the
  mechanism, not the coefficient.
- **Confounded** — right number, wrong sign or wrong story. In the first run magnet stock appeared to
  *hurt* score, purely because magnet was abundant in waves 1–2, which are low-scoring for unrelated
  reasons. Always check whether an effect survives inside a single wave before believing it.
- **Real** — survives both checks. Say so explicitly; it earns the reader's attention.

**Other traps:**

- **Cumulative-vs-cumulative correlations are meaningless.** Two monotone columns correlate at ρ≈1
  by construction. Difference first, always.
- **`speed` is one instant, not an average.** Do not read it as "how fast was the player moving that
  interval." It is a sample, and 15 s apart the samples are effectively independent draws.
- **Score is a composite.** In v1 it silently contains delivery payouts, kill scores,
  `REPAIR_FULL_BONUS` and `SCOOP_MAX_BONUS`. Any "throughput" claim built on v1 `score` is really a
  claim about a mixture. Say so. In v2/v3, decompose into four terms (§5); in v4, three
  (`scoreRepairBonus` is gone with the milestone-heal mechanism it measured).
- ⛔ **REWRITTEN FOR v4 — "health rate rising is not good news" no longer has a single cause.** The
  old reasoning (health is time-gated, everything else is kill-gated, so health's *share* rises
  automatically whenever kills dry up) is only half true as of CS040 — see §4's rewritten second
  behavioural fact for the full mechanism. As of v4, a rising health-pickup rate can mean: kills
  drying up (the original reading, still valid), score climbing fast enough to trip milestones
  often (a new, independent driver — `spawnHealthPowerup()` is also called from the score-milestone
  arm below max HP), or both together. **Do not read a rising health share as "a wave in trouble"
  without checking the kill-rate columns in the same window** — it may just be a wave paying well.
  `hpWasted`/`healthBanked` help separate a genuine scarcity signal from a supply-timing one.
- **`cargoDamageEvents` AND `scoopHits` (v4) are both sawtooths, and both have meaningless last
  rows.** Two columns in the schema decrease; totalling either, differencing either as if
  cumulative, or reading either's final row as a run total all give wrong answers. For
  `cargoDamageEvents`, read `cargoSevers` (v3+) or reconstruct a floor (v2 — §3). `scoopHits` has no
  cumulative twin at all — there is no better number to substitute, only the sawtooth itself,
  useful for "how close is the current scoop level to dropping," not for a run total. This was
  wrong for `cargoDamageEvents` in this document, in the build's own comment and in the P2 test
  simultaneously, which is why it gets a trap entry as well as a schema entry — `scoopHits` is
  documented correctly from the day it shipped, so it does not repeat that history, but the shape
  of the mistake is exactly the kind this trap entry exists to prevent a second time.
  ⛔ **`scoopHits`' RATE moved at CS042 P9 (spec §4.4): `SCOOP_HITS_PER_LEVEL` went 5 → 2, so the
  sawtooth resets more than twice as often in any capture taken from that build on.** The column's
  SHAPE is unchanged and so is every rule above — it is still a sawtooth, still excluded by name from
  monotonicity checks and cumulative totals, still without a cumulative twin. Only the tooth got
  shorter. **A steeper, more frequent sawtooth in a v4 log is the shipped loss rate, not a defect and
  not a player in trouble**; compare captures only within one build, and read the run's own
  `DEBUG.scoopHitsPerLevel` off the export header's `levers=` fingerprint before comparing two.
  The companion change in the same phase — a banked health charge can spend itself sparing a scoop
  level instead of healing, above `bankSpareHullPct` (0.70) of hull — means a hit can now leave
  `scoopHits` flat while `hp` still drops, so the old "`scoopLevel` ↔ `hp`, one cause two effects"
  reading at the top of this section is weaker than it was: some hits no longer erode the scoop at all.
- **Ring truncation makes every total a lower bound.** See §2.2.
- **15 s aliasing.** Anything faster than the interval is invisible: an i-frame window, a chain
  sever and recovery, a powerup picked and fully spent. Absence of a change between two rows is not
  absence of the event. Never assert "never happened" from the log alone.
- **`resumedRun` poisons a lone post-load log's score comparisons** — the pre-load component is
  baked into `game.score` with no way to separate it out of that log alone. **This has a supported
  workaround:** if the PRE-load portion is exported as its own part before capture is re-enabled
  post-load, the parts stitch — every cumulative column matched to the unit across the seam in the
  08-23 capture. Measured seam cost: 5–9 s of unlogged play per seam; the worst seam in that capture
  lost 610 score, 10 Garbage Satellite kills and one triple pickup. Concatenation recipe: concat the
  parts in `t` order, then NULL the delta row at each seam so the seam gap doesn't pollute rate
  stats — never let a single `.diff()` run across a seam uncorrected.
- **External capture keystrokes are invisible.** A player pressing a hotkey for external
  screen-capture software (F8 for Medal, etc.) leaves no trace in the log in any form, and the
  resulting distraction reads as a clean difficulty spike — damage burst, weapons dry, HP collapse.
  The 08-23 capture's wave 4–5 near-death was exactly this and nothing else. Never conclude "this
  wave is too hard" from a single bad window without asking the player what was happening outside
  the game.
- **Dwell at cap is not frequency at cap.** `chainLen`/`cargoMax` occupancy measures how long the
  chain SITS at a value, not how often it gets there. A full chain is delivered almost immediately,
  so dwell-at-cap is short by construction — that is not evidence the cap goes unused. To ask "does
  the player reach the cap", count distinct EPISODES where `chainLen` crosses the threshold, not the
  fraction of samples at it (§5's episode-counting snippet). In the 08-26 capture, at-cap dwell was
  11% of samples while the run contained 19 separate full-24 hauls.
- **One log is one run.** Every number in a report is n=1. Resist "the game does X"; write "in this
  run, X." A pattern worth acting on wants a second log.

---

## 8. Reporting conventions

- Open with **format confirmation** (what was verified, against which commit) and the **integrity
  checks** — the reader needs to know the data is sound before the findings.
- Then **questions**, before conclusions. The first analysis turned up five things the log could not
  answer, and getting them asked early was worth more than a longer findings list.
- Findings as prose with tables, not bullet soup. Each finding: what the number is, what it means,
  and what it does *not* establish.
- **Separate estimates from measurements.** Show the arithmetic on any estimate so the reader can
  see its width.
- Flag the **unresolved** ones explicitly rather than rounding them up into conclusions.
- Close with **instrumentation gaps** — what the log could not see. That list is what turns an
  analysis into the next changeset.

---

## 9. Starter script

```python
import pandas as pd, numpy as np
pd.set_option('display.width', 250)

path = 'telemetry.csv'
hdr = [l.strip() for l in open(path) if l.startswith('#')]
d = pd.read_csv(path, comment='#')
print('\n'.join(hdr) if hdr else '(v1 log — no header block)')

DMG  = ['dmgDebris3','dmgDebris2','dmgDebris1','dmgHunter3','dmgHunter2','dmgHunter1',
        'dmgUfoBodyLarge','dmgUfoBodySmall','dmgUfoShotLarge','dmgUfoShotSmall']
UNIT = dict(zip(DMG, [50,35,20,60,45,30,35,20,15,15]))
PICK = ['rapid','triple','health','magnet','engine','scoop','guard']
V2   = ['chainLen','cargoMax','delivered','deliveryScore','cargoDamageEvents','debrisKills',
        'hunterKills','saucerKills','hunterCoalesced','deflects','hitsTaken',
        'scoreRepairBonus','scoreScoopBonus']
V4   = ['hunterCount','debrisCount','garbageCount','healthBanked','hpWasted','scoopHits']
v2 = all(c in d.columns for c in V2)
v3 = v2 and 'cargoSevers' in d.columns          # CS039 GATE T's 44th column
v4 = v3 and all(c in d.columns for c in V4)     # CS040 P5 — scoreRepairBonus is GONE in v4
# ⛔ cargoDamageEvents AND scoopHits (v4) are BOTH SAWTOOTHS (§3) — never in a cumulative list,
# never totalled from the last row.
CUM_V2 = [c for c in V2[2:] if c != 'cargoDamageEvents' and c != 'scoreRepairBonus'] \
         + (['cargoSevers'] if v3 else []) \
         + ([c for c in V4 if c != 'scoopHits'] if v4 else [])

# --- verification -------------------------------------------------------
iv = d['t'].diff().median()
schema = 'v4' if v4 else 'v3' if v3 else 'v2' if v2 else 'v1'
print(f'rows={len(d)}  t={d.t.iloc[0]:.1f}->{d.t.iloc[-1]:.1f}  '
      f'interval={iv:.3f} (sd {d.t.diff().std():.4f})  schema={schema}')
ring_wrapped_line = next((l for l in hdr if l.startswith('# ringWrapped=')), None)
if ring_wrapped_line is not None:
    if ring_wrapped_line.endswith('true'):
        print('!! RING TRUNCATED (# ringWrapped=true) — opening rows rolled off; all totals are LOWER BOUNDS')
elif len(d) >= 400 and d.t.iloc[0] > iv * 1.5:   # pre-v4 fallback — no header flag to trust
    print('!! RING TRUNCATED (inferred) — opening rows rolled off; all totals are LOWER BOUNDS')
cum = ['score'] + [p+'Picked' for p in PICK] + DMG + (CUM_V2 if v2 else [])
bad = [c for c in cum if c in d and (d[c].diff().dropna() < 0).any()]
print('non-monotonic:', bad or 'none',
      '| debugRun:', bool(d.debugRun.any()), '| resumedRun:', bool(d.resumedRun.any()))
if v2:
    sev = resets = prev = 0
    for c in d.cargoDamageEvents:
        if c >= prev: sev += c - prev
        else:         sev += c; resets += 1
        prev = c
    print(f'severs: {int(d.cargoSevers.iloc[-1])} (cargoSevers, exact)' if v3
          else f'severs >= {sev} across {resets} guard drops (v2 LOWER BOUND — no cargoSevers column)')

# --- derived ------------------------------------------------------------
d['dmgTot'] = d[DMG].sum(axis=1)
d['ddmg']   = d['dmgTot'].diff()
d['dscore'] = d['score'].diff()
for k in PICK: d['d_'+k] = d[k+'Picked'].diff()
d['killpu'] = d[['d_'+k for k in PICK if k != 'health']].sum(axis=1)
d['dry']    = (d.rapidLeft == 0) & (d.tripleLeft == 0)

# --- hit ledger ---------------------------------------------------------
fin = d[DMG].iloc[-1]
print('\nhits by source:', {k: round(fin[k]/UNIT[k], 2) for k in DMG if fin[k]})
print('total hits (reconstructed):', sum(fin[k]/UNIT[k] for k in DMG),
      '| hitsTaken:', d.hitsTaken.iloc[-1] if v2 else 'n/a (v1)')

# --- HP + score books ---------------------------------------------------
MAXHP, HEAL, MILE = 250, 25, 10000
heal = d.hp.iloc[-1] - MAXHP + d.dmgTot.iloc[-1]
print(f'\nhealing applied {heal}  (pickups supply <= {d.healthPicked.iloc[-1]*HEAL})')
if not v4:   # v1-v3: a milestone could heal directly; v4 deleted that arm (CS040 P1)
    print(f'  milestones crossed {d.score.iloc[-1]//MILE}')
print(f'at full HP: {(d.hp==MAXHP).mean()*100:.1f}% of samples'
      f' | scoop at max: {(d.scoopLevel==d.scoopLevel.max()).mean()*100:.1f}%')
if v4:
    print(f'  healthBanked (final) {int(d.healthBanked.iloc[-1])}  '
          f'| hpWasted (cumulative) {int(d.hpWasted.iloc[-1])}')
if v2:
    s = d.score.iloc[-1]
    terms = ['deliveryScore', 'scoreScoopBonus'] if v4 else \
            ['deliveryScore', 'scoreRepairBonus', 'scoreScoopBonus']
    for k in terms:
        print(f'  {k:18s} {int(d[k].iloc[-1]):>8d}  {d[k].iloc[-1]/s*100:5.1f}% of score')
    resid = s - d[terms].iloc[-1].sum()
    print(f'  {"residual (kills+)":18s} {int(resid):>8d}  {resid/s*100:5.1f}%')

# --- wave table ---------------------------------------------------------
rows = []
for lv, x in d.groupby('level'):
    i0 = x.index[0]; prev = d.loc[i0-1] if i0 > 0 else None
    s0  = prev['score']  if prev is not None else 0
    m0  = prev['dmgTot'] if prev is not None else 0
    mins = len(x) * iv / 60
    r = dict(wave=lv, secs=round(len(x)*iv), sps=round((x.score.iloc[-1]-s0)/(len(x)*iv), 1),
             dmg_min=round((x.dmgTot.iloc[-1]-m0)/mins, 1), hp_min=x.hp.min(),
             hp_mean=round(x.hp.mean()), scoop=round(x.scoopLevel.mean(), 1),
             killpu_min=round(x.killpu.sum()/mins, 2),
             health_pct=round(x.d_health.sum()/max(x.killpu.sum()+x.d_health.sum(), 1)*100),
             dry_pct=round(x.dry.mean()*100))
    if v2:
        r['chain'] = round(x.chainLen.mean(), 1)
        r['deliv_min'] = round((x.delivered.iloc[-1] - (prev['delivered'] if prev is not None else 0))/mins, 2)
    rows.append(r)
print('\n', pd.DataFrame(rows).to_string(index=False))

# --- headline splits ----------------------------------------------------
print(f'\ndry-weapon median dscore {d.loc[d.dry,"dscore"].median()} '
      f'vs armed {d.loc[~d.dry,"dscore"].median()}')
print('trend vs t   — damage:', round(d.ddmg.corr(d.t, method="spearman"), 3),
      ' score:', round(d.dscore.corr(d.t, method="spearman"), 3))
print('killpu vs dscore:', round(d.killpu.corr(d.dscore, method="spearman"), 3),
      '| health vs dscore:', round(d.d_health.corr(d.dscore, method="spearman"), 3))
```

---

## 10. Known blind spots (as of v4)

Even with the CS039/CS040 columns, the log still cannot see:

- **Anything sub-interval.** 15 s is the resolution floor. Chain severs, i-frames, brief full-cargo
  states and powerups picked-and-spent inside one interval are invisible except as counter deltas.
- **Where things are.** No positions, no distances, no dock proximity. "Was the player camped near
  the dock" is unanswerable.
- **Shots fired.** Budgets spent can be inferred (`picked × grant − Δstock`), but shots that missed,
  accuracy, and time-to-kill cannot.
- ✅ **CLOSED (CS040 P5). Enemy population.** How many Garbage Satellites, Hunters and towable
  Debris were *alive* at the sample instant is now three real columns — `hunterCount`,
  `debrisCount` (Garbage Satellites — inverted vocabulary, §0/§3), `garbageCount` (Debris) — all
  instantaneous, sampled every row. This was the most obvious next column and it shipped.
- ✅ **CLOSED (CS040 P5). No row is flushed at game over.** `killShip()` now calls
  `Telemetry.flush()` on the frame it sets `game.stats.gameEnded`, so a completed run's last row IS
  the death frame — the killing blow is visible in the data for the first time. `# finalRowIsGameOver=`
  in the header block says whether a given log's last row actually is the death (§3) — a log can
  still end short of it (a menu quit, a run still in progress).
- **What the player was doing.** No input, no thrust state, no fire state.