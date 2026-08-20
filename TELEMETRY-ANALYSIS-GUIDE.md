# Orbital Overhaul — Telemetry Analysis Guide

**Purpose.** Hand this to Claude along with a telemetry CSV. It carries everything needed to parse
the log, verify it, run the standard battery, and avoid the traps — so a session can go straight to
findings instead of rediscovering the schema.

**Written after:** the first full analysis (196-row run, waves 1–13, `orbital-overhaul.html` @
`76eeca7` / CS038). Covers both the **v1 schema** (30 columns, CS037 P4) and the **v2 schema**
(43 columns + `#` header, CS039).

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
- **Ring buffer, `TELEMETRY_MAX = 400`.** At 15 s that is 100 minutes. Past that, the OLDEST rows
  roll off silently. **Always check whether the log is truncated** (§2).
- **Persisted** to `afd_telemetry_v1` in localStorage on every snapshot, so a crash or refresh keeps
  the data. The export prefers the live buffer and falls back to the stored one.
- **Opt-in since CS038 P3.** `DEBUG.telemetryCapture` defaults OFF and is off at every launch. A run
  with capture off produces nothing; it does not produce a partial log.
- **Exported by hand** from the debug panel's "Copy telemetry log" row, reachable at game over.

---

## 2. Verification checklist — run this before analysing anything

Six checks. Each has caught something real.

1. **Cadence.** `df['t'].diff()` should be tight around the interval (σ ≈ 0.002 s). A gap that is a
   clean multiple of the interval means dropped snapshots; a ragged one means something is wrong
   with the clock. Report either.
2. **Truncation.** If `len(df) == 400` (or whatever `TELEMETRY_MAX` currently is) **and** `t[0]` is
   noticeably greater than the interval, the run's opening rolled off the ring. Every cumulative
   column then starts from a non-zero, unknown baseline and *all* whole-run totals are lower bounds.
   Say so prominently — this is the single most misleading failure mode.
   If `t[0] ≈ interval`, the log is complete from the run's start.
3. **Monotonicity.** Every cumulative column (`score`, all `*Picked`, all `dmg*`, and in v2 all the
   kill/delivery/bonus counters) must be non-decreasing. A decrease means a schema misread or a
   corrupt export.
4. **Flags.** `debugRun` and `resumedRun`. A `debugRun` row was played with knob overrides in force;
   a `resumedRun` row belongs to a run that loaded a save, meaning `score` contains a baked-in
   pre-load component that cannot be separated out. **Either flag being true anywhere makes the run
   non-comparable to a clean one** — filter or caveat, do not quietly average.
5. **Damage arithmetic.** Every `dmg*` total should divide evenly by its source's damage constant
   (§4). If it does not, either a constant was retuned or a damage multiplier has landed — and the
   hit-ledger reconstruction in §5 is invalid.
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
| `engineLeft` | **seconds** of forward thrust — the only fractional budget |
| `guardLeft` | chain-guard intercepts remaining |
| `scoopLevel` | 0…`SCOOP_MAX_LEVEL`, persistent; decays by damage, never by time |

There are six, not seven, and the asymmetry is deliberate: five live in `game.powerBudget`, scoop is
a persistent level, and health is instantaneous so it has no remaining-use quantity at all.

**Cumulative pickup counters:** `rapidPicked`, `triplePicked`, `healthPicked`, `magnetPicked`,
`enginePicked`, `scoopPicked`, `guardPicked`.

**Cumulative damage, in HP actually deducted**, non-lethal hits only:
`dmgDebris3/2/1` (large/medium/small **Garbage Satellite**), `dmgHunter3/2/1` (large/medium/small
**Hunter**), `dmgUfoBodyLarge/Small`, `dmgUfoShotLarge/Small`.

**Flags:** `debugRun`, `resumedRun` — emitted as `true`/`false`, always the last two columns.

### v2 — the CS039 additions (13 columns)

Inserted before the two flags. Two kinds, and the names don't tell you which:

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
| `cargoDamageEvents` | unguarded chain severs — cargo actually lost |
| `debrisKills` | **Garbage Satellites** destroyed |
| `hunterKills` | Hunters destroyed, all three tiers |
| `saucerKills` | saucers destroyed, both sizes |
| `hunterCoalesced` | Hunters born from neglected scrap — the Kessler loop firing |
| `deflects` | hits absorbed by the shield (HP that was *not* taken) |
| `hitsTaken` | non-lethal hits that deducted HP — same population as the `dmg*` sums |
| `scoreRepairBonus` | cumulative `REPAIR_FULL_BONUS` (milestone hit at full HP) |
| `scoreScoopBonus` | cumulative `SCOOP_MAX_BONUS` (scoop picked at max level) |

### v2 — the `#` header block

Seven `#`-prefixed lines above the CSV header. Skip them with `pd.read_csv(path, comment='#')`, but
**read them first** — they are the run's provenance:

```
# orbital-overhaul telemetry v2
# build=1.0.0.38
# overrides=OFF
# telemetryInterval=15
# rows=196
# source=this run
# levers=none
```

`levers=` lists **effective** non-default knobs — what the game actually used, resolved through the
master overrides toggle. `levers=none` with `overrides=OFF` means stock tuning even if the panel had
edits sitting in it. Any lever listed means **this run is not comparable to a stock run** on whatever
that lever controls; lead the report with it.

`source=storage` means the export came from the persisted envelope rather than a live buffer —
usually a run recovered after a crash or refresh, still valid but worth noting.

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
| `POWERUP_HEALTH_AMOUNT` | 25 | HP per health pickup |
| `REPAIR_MILESTONE` | 10000 | score interval that grants a repair |
| `REPAIR_AMOUNT` | 25 | HP per milestone, if not already full |
| `REPAIR_FULL_BONUS` | 2500 | score paid instead, if already full |
| `SCOOP_MAX_LEVEL` | 5 | scoop ceiling |
| `SCOOP_HITS_PER_LEVEL` | 5 | hits that cost one scoop level |
| `SCOOP_MAX_BONUS` | 500 | score paid when a scoop pickup lands at max |
| `RAPID_SHOTS / TRIPLE_SHOTS / MAGNET_PIECES` | 40 / 30 / 40 | budget granted per pickup |
| `ENGINE_BURN_SECONDS` | 10.0 | thrust-seconds per engine pickup |
| `DEBUG.chainGuardIntercepts` | 3 | intercepts per guard pickup |
| `POWERUP_DROP_WEIGHTS` | rapid 30, triple 30, scoop 20, magnet 10, engine 10; guard dynamic | expected drop mix |
| `POWERUP_HEALTH_GAP` | [18, 26] s | ambient health spawn cadence |
| `CARGO_CAP_MAX` | 24 | tow cap ceiling |

**Two behavioural facts that matter more than any single constant:**

1. **Powerup budgets BANK.** A same-type pickup *adds* to the remaining budget; nothing decays on a
   clock. So a `*Left` column is a stockpile with memory, and a good phase silently converts into a
   buffer spent one or two waves later.
2. **Health is time-gated; everything else is kill-gated.** `spawnHealthPowerup` runs on an ambient
   18–26 s timer. Every other powerup drops from a kill or a dock event. This asymmetry is the
   single most useful structural fact in the whole schema — see §7.

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
Health pickups can supply at most `healthPicked × 25`; the remainder came from score milestones.
Milestones crossed = `floor(final_score / REPAIR_MILESTONE)`. Milestones that did *not* heal fired
`REPAIR_FULL_BONUS` instead. In v1 this is an estimate; in v2 `scoreRepairBonus` measures it directly
and the estimate should be dropped.

**Score decomposition (v2 only):**
`score = deliveryScore + scoreRepairBonus + scoreScoopBonus + residual`, where the residual is kills
and everything else. Report all four shares — this is the thing v1 could not do.

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
   Look for sources that never fire at all — one of them being zero for a whole run is either a
   design fact or a dead hook.
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
   shortfall in one type is a hint that it is being skipped or timing out.
9. **Health share of pickups, by wave.** The throughput index (§7). Cleaner than score because it is
   not polluted by bonuses.
10. **Correlations — then immediately sort them into three buckets** (§7).
11. **Narrate the worst window as a sequence.** Find the lowest-HP or lowest-score-rate stretch and
    walk it in order: what spiked, what depleted, what collapsed, what recovered and how. Feedback
    loops are visible in ordering and invisible in a correlation matrix.
12. **v2 additions:** tow occupancy (`chainLen` / `cargoMax`), deliveries per minute, sever rate
    (`cargoDamageEvents`), coalescence rate (`hunterCoalesced`), deflect share
    (`deflects` vs `hitsTaken`), and the score decomposition from §5.

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
  claim about a mixture. Say so. In v2, decompose instead.
- **Health rate rising is not good news.** Because health is time-gated and everything else is
  kill-gated, health's *share* of pickups rises automatically whenever kills dry up. A wave where
  health pickups go up and everything else goes down is a wave in trouble, not a wave being generous.
- **Ring truncation makes every total a lower bound.** See §2.2.
- **15 s aliasing.** Anything faster than the interval is invisible: an i-frame window, a chain
  sever and recovery, a powerup picked and fully spent. Absence of a change between two rows is not
  absence of the event. Never assert "never happened" from the log alone.
- **`resumedRun` poisons score comparisons** — the pre-load component is baked into `game.score` with
  no way to separate it.
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
v2 = all(c in d.columns for c in V2)

# --- verification -------------------------------------------------------
iv = d['t'].diff().median()
print(f'rows={len(d)}  t={d.t.iloc[0]:.1f}->{d.t.iloc[-1]:.1f}  '
      f'interval={iv:.3f} (sd {d.t.diff().std():.4f})  schema={"v2" if v2 else "v1"}')
if len(d) >= 400 and d.t.iloc[0] > iv * 1.5:
    print('!! RING TRUNCATED — opening rows rolled off; all totals are LOWER BOUNDS')
cum = ['score'] + [p+'Picked' for p in PICK] + DMG + (V2[2:] if v2 else [])
bad = [c for c in cum if c in d and (d[c].diff().dropna() < 0).any()]
print('non-monotonic:', bad or 'none',
      '| debugRun:', bool(d.debugRun.any()), '| resumedRun:', bool(d.resumedRun.any()))

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
MAXHP, HEAL, MILE, RB, SB = 250, 25, 10000, 2500, 500
heal = d.hp.iloc[-1] - MAXHP + d.dmgTot.iloc[-1]
print(f'\nhealing applied {heal}  (pickups supply <= {d.healthPicked.iloc[-1]*HEAL})'
      f'  milestones crossed {d.score.iloc[-1]//MILE}')
print(f'at full HP: {(d.hp==MAXHP).mean()*100:.1f}% of samples'
      f' | scoop at max: {(d.scoopLevel==d.scoopLevel.max()).mean()*100:.1f}%')
if v2:
    s = d.score.iloc[-1]
    for k in ['deliveryScore','scoreRepairBonus','scoreScoopBonus']:
        print(f'  {k:18s} {int(d[k].iloc[-1]):>8d}  {d[k].iloc[-1]/s*100:5.1f}% of score')
    resid = s - d[['deliveryScore','scoreRepairBonus','scoreScoopBonus']].iloc[-1].sum()
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

## 10. Known blind spots (as of v2)

Even with the CS039 columns, the log still cannot see:

- **Anything sub-interval.** 15 s is the resolution floor. Chain severs, i-frames, brief full-cargo
  states and powerups picked-and-spent inside one interval are invisible except as counter deltas.
- **Where things are.** No positions, no distances, no dock proximity. "Was the player camped near
  the dock" is unanswerable.
- **Shots fired.** Budgets spent can be inferred (`picked × grant − Δstock`), but shots that missed,
  accuracy, and time-to-kill cannot.
- **Enemy population.** How many Garbage Satellites or Hunters were *alive* at the sample instant.
  `DiffLog` logs `hunterCount` once per level; the telemetry log does not carry it at all. This is
  the most obvious next column if the analysis keeps wanting it.
- **What the player was doing.** No input, no thrust state, no fire state.