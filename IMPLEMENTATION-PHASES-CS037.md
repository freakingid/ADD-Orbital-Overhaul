# IMPLEMENTATION PHASES — Changeset 037

Companion to `PLANNED-FEATURES-CS037.md`. Verified against `70518af`, `GAME_VERSION` 1.0.0.36,
registry 106, headers 10, `LEVERS` 18.

**Standing rules for every phase below.**

- **One phase per Claude Code session. One commit per phase. Claude Code commits but NEVER pushes** —
  Paul pushes.
- **Ground truth first.** Every session opens by grepping the live build **by symbol name**. Never
  navigate by line number: the numbers in this document are orientation aids captured at `70518af`
  and will drift.
- Phases are **behavioural contracts**, not pre-written diffs. Where a phase names a literal value,
  that value is authored data and is literal.
- **The suite must pass at zero skips before the changeset closes.** Two unseeded flakes are standing
  (`test-cs035-p3` §F ~5 %, `test-f6` §F ~1.7 %) — rerun before treating either as a regression.
- Any phase adding a registry row updates **`test-registry.js`** in the same commit.

**Phase map.**

| Phase | Scope | Model |
|---|---|---|
| P1 | Damage source tagging (prerequisite for D) | Sonnet, high |
| P2 | Benchmark instrument | Opus, high, ultrathink |
| P2.1 | Gate A instrumentation: real-play peaks, mix weights, env stamp, predicted-vs-actual | Sonnet, high |
| **GATE A** | **⛔ BLOCKING — Paul runs the benchmark, reports numbers** | — |
| P3 | Static caps, from Gate A's numbers | Opus, high |
| P4 | Telemetry buffer, storage, clipboard export | Opus, high |
| P5 | Full release on damage + voice event split | Opus, high, ultrathink |
| P6 | Resume baseline + targeted persistence | Opus, xhigh, ultrathink |
| P7 | Delivery payout nerf + two dock knobs | Sonnet, high |
| **GATE B** | **⛔ BLOCKING — playtest, numeric answers** | — |
| P8 | Closing: version, invariants, STATUS, GDD, archive | Sonnet, high |

**Ordering rationale.** P1 is a prerequisite for P4 and is cheap, so it goes first and de-risks the
measurement window. P2 must precede Gate A, and Gate A must precede P3 — that is the only hard
sequencing constraint in the changeset. P5 and P7 are both player-facing balance changes and are
deliberately placed **before** a single combined Gate B, rather than each carrying its own gate: the
full-tow release and the powerup nerf both push in the same direction (large hauls get riskier and
less rewarding), so they need to be felt together, not separately.

**All forks are closed.** FORK-CS037-A.1 resolved to **(b2)**, the targeted merge write
(`PLANNED-FEATURES-CS037.md` §2.2), which is what P6 below is already specified against. No phase in
this changeset is waiting on a decision.

---

## P1 — Damage source tagging

**Why first.** Item D's per-source attribution is build surgery, not instrumentation. Landing it
alone keeps P4 to one subject, and keeps the diff that touches the game's damage contract small
enough to review on its own.

**Model:** Sonnet, high effort.

### Contract

- `damageShip()` accepts a **source tag** identifying which of ten categories dealt the hit:
  Garbage Satellite ×3 sizes, Hunter Satellite ×3 sizes, UFO-large body, UFO-small body,
  UFO-large shot, UFO-small shot.
- The **merged hazard loop** over `[...game.debris, ...game.hunters]` discriminates in place using
  `h instanceof HunterSatellite` (already evaluated there for Close Shave) and `h.size`. **No new
  field on `DebrisSatellite` or `HunterSatellite`.**
- **Hostile `Bullet` gains a shooter-size field**, set at its single spawn site inside
  `Saucer.update()` from `this.small`. The player-shot spawn site is untouched.
- The saucer-body site reads `s.small`.
- **Ten accumulators** on `resetGameStats()`, flat fields, accumulating HP actually deducted.
- Attribution accumulates **only on the non-lethal branch**, where HP is deducted. Shielded hits,
  i-framed repeats and auto-shield saves return `false`, deal 0 HP and attribute 0.
- **⛔ Observational only.** Knockback, i-frames, scoop decay, `dmgThisWave`, `hitsSurvived`,
  `everBelowHalf`, achievements and the CS023 P3 mutual-kill arms are all byte-unchanged in
  behaviour.
- **No registry rows this phase.**

### Paste-ready prompt

> Read `CLAUDE.md`, `STATUS.md`, `PLANNED-FEATURES-CS037.md` (§5.5 and correction C4-rev) before
> touching anything. Grep the build by symbol name — do not navigate by line number.
>
> This is CS037 P1: thread a damage source tag through `damageShip()` so per-source health-loss
> attribution becomes possible. Instrumentation only — no gameplay behaviour changes.
>
> Verify first, by grep: `damageShip` has exactly **three** call sites, and the hazard-vs-ship site
> iterates a **merged** array built as `[...game.debris, ...game.hunters]`. If that is not what you
> find, stop and report rather than proceeding.
>
> Add a source tag parameter to `damageShip()` covering ten categories: Garbage Satellite at each of
> sizes 3/2/1, Hunter Satellite at each of sizes 3/2/1, UFO-large body, UFO-small body, UFO-large
> shot, UFO-small shot. At the merged hazard site, discriminate with the `h instanceof
> HunterSatellite` test already present there for Close Shave, plus `h.size` — do not add a field to
> either entity class. Give hostile `Bullet` a shooter-size field, set from `this.small` at its one
> spawn site inside `Saucer.update()`; leave the player's spawn site alone. The saucer-body site
> reads `s.small`.
>
> Add ten flat accumulators to `resetGameStats()` recording HP actually deducted per category. Flat
> fields, not a nested object — `game.stats.powerUsed` is nested and both `buildSaveEntry()` and
> `resumeFromSave()` carry special-cases for it; flat fields inherit their copy loops for free.
>
> ⛔ Accumulate on the **non-lethal** branch only, where HP is deducted. The shielded / i-framed /
> auto-shield paths all return false, deal 0 HP, and must attribute 0. ⛔ Nothing else changes:
> knockback, i-frames, scoop decay, `dmgThisWave`, `hitsSurvived`, `everBelowHalf`, every achievement
> path and the CS023 P3 mutual-kill arms all behave exactly as at HEAD.
>
> Write `scratchpad/test-cs037-p1.js` covering: each of the ten categories attributing to its own
> accumulator and no other; the three no-damage paths attributing zero; a lethal hit not
> double-attributing; and the new stats fields surviving a save/resume round trip at their values.
> Confirm the test catches hand-mutated regressions before you finish. Run the full suite.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P1: thread damage source tag through damageShip()

Ten-category source attribution (Garbage Satellite x3 sizes, Hunter
Satellite x3 sizes, UFO body/shot x2 sizes) accumulated on the non-lethal
branch only. Hostile Bullet carries shooter size from its single spawn
site. Merged hazard loop discriminates via the existing instanceof test
plus h.size — no new field on either entity class. Instrumentation only:
no gameplay behaviour change.
```

### Headless test expectations

`test-cs037-p1.js` — roughly 60–80 assertions.

- **§A** ten categories, ten accumulators, no cross-talk.
- **§B** shielded / i-framed / auto-shield hits attribute zero.
- **§C** lethal hit attributes once, not twice.
- **§D** hostile bullets from a large saucer and a small saucer attribute to different columns.
- **§E** merged-loop discrimination: a Garbage Satellite of size 2 and a Hunter of size 2 land in
  different columns.
- **§F** save/resume round trip preserves all ten.
- **§G** regression pins: `dmgThisWave`, `hitsSurvived`, `everBelowHalf`, scoop decay and knockback
  unchanged against HEAD behaviour.

Full suite: **148 files + 1 new = 149**, zero failures, zero skips.

---

## P2 — Benchmark instrument

**Model:** Opus, high effort, thinking. `ultrathink`.

### Contract

- **Benchmark mode**, entered from a debug-panel action row. Not in Options. Not a `tools/` lab.
- Runs an automated **battery** in sequence: `game.garbage` singles; `game.garbage` clumps;
  `game.debris` per size 3/2/1; `game.hunters` per size 3/2/1; `game.saucers`; `game.particles`;
  `game.floaters`; `game.chain`; then one **mixed** run at realistic late-wave proportions.
- **Ramp to threshold.** Grow the population until p95 frame time crosses **16.7 ms**, report the
  count; continue to **33.3 ms**, report that count. A population reaching the safety ceiling without
  crossing reports "not reached" — never a fabricated number.
- **Update cost and draw cost are timed separately.** A single combined number is not sufficient
  output.
- **⛔ Sealed.** For the run's duration, benchmark mode cannot reach `addScore()`,
  `HighScores.save()`, `Achievements.save()`, `Achievements.evaluate()`, the P4 telemetry buffer, or
  `saveSettings()`.
- **⛔ FORK-D → (a).** On entry, stash `debugShown[DEBUG_OVERRIDE_ID]` and call
  `applyDebug(DEBUG_OVERRIDE_ID, 0)` — the existing carve-out routes that into a full
  `rebuildDebug()`. Restore the stashed value on exit, **unconditionally**: normal completion, abort,
  and any early exit. `saveSettings()` must be unreachable while the override is forced, or the
  toggle persists OFF and the tester's whole knob set is silently discarded.
- Results are held in memory and exported through a **copy-to-clipboard** action row.
- **Four new registry rows** in a new **BENCHMARK** section: ramp step (entities added per step),
  ramp interval (seconds per step), settle frames (discarded before sampling resumes after a step),
  and a max-count safety ceiling. Registry **106 → 110**, headers **10 → 11**.
- Two new action rows: run the battery, copy the results.

### Paste-ready prompt

> ultrathink
>
> Read `CLAUDE.md`, `STATUS.md`, and `PLANNED-FEATURES-CS037.md` §3 in full before touching anything.
> Grep by symbol name — do not navigate by line number.
>
> This is CS037 P2: build an in-game benchmark mode, driven from the debug panel, that measures the
> **shipped** entity code on real hardware. It is a one-off instrument for the developer — not
> exposed in Options, not a player-facing feature, and deliberately not a `tools/` lab (a lab would
> re-implement `DebrisSatellite`, `HunterSatellite`, the particle system and the draw calls, and that
> duplicate would drift from the build and would not exercise Hunter homing's per-frame wrap-aware
> `angleTo`/`dist2` work).
>
> Read `applyDebug`, `rebuildDebug`, `overridesOn`, `debugNative`, `DEBUG_ROWS` and the existing
> action-row dispatch (the "Dump difficulty log" / "Reset all debug knobs to defaults" branch) before
> designing anything — the panel's row model is derived from the registry and the two trailing action
> rows are appended, never special-cased by index.
>
> Build a battery that runs these populations in sequence, isolated, one at a time: `game.garbage`
> singles; `game.garbage` clumps (separately — a clump carries lineage and merge state);
> `game.debris` at each of sizes 3/2/1; `game.hunters` at each of sizes 3/2/1; `game.saucers`;
> `game.particles`; `game.floaters`; `game.chain`; and finally one mixed run at realistic late-wave
> proportions. Do not add a population-selector knob — the battery runs the whole set from one
> action.
>
> For each population: ramp the count upward and report the count at which **p95 frame time** crosses
> **16.7 ms**, then the count at which it crosses **33.3 ms**. Time **update cost and draw cost
> separately** — Hunters are update-heavy and particles are draw-heavy, and that split is the entire
> point of the measurement. A population that hits the safety ceiling without crossing reports "not
> reached"; never extrapolate a number.
>
> ⛔ Seal the mode. While it runs it must not be able to reach `addScore()`, `HighScores.save()`,
> `Achievements.save()`, `Achievements.evaluate()`, or `saveSettings()`.
>
> ⛔ FLAG-CS036-a: `saveSettings()` persists a full snapshot of all 106 knobs and `loadSettings()`
> re-applies them over the registry defaults, so any installation that has ever saved settings is not
> running shipped defaults — including `garbageSoftMax`/`garbageHardMax`, which this benchmark exists
> to inform. On entry, stash `debugShown[DEBUG_OVERRIDE_ID]`, then `applyDebug(DEBUG_OVERRIDE_ID, 0)`.
> Restore the stashed value on exit unconditionally — normal completion, abort, and every early exit
> path. `saveSettings()` must be unreachable for the duration; if it fires while the override is
> forced, the toggle persists OFF and the tester loses their entire knob set with no warning.
>
> Add a **BENCHMARK** registry section with four knobs: ramp step, ramp interval, settle frames, and
> a max-count safety ceiling. Follow the existing registry conventions (comment each one, `def`
> derived from a named shipped constant where one is natural). Registry goes 106 → 110, headers
> 10 → 11. Add two action rows: run the battery, and copy results to the clipboard. There is no
> clipboard code anywhere in this build yet — this is net-new; guard it the way every other
> browser-API touch in this build is guarded, and fail visibly rather than silently.
>
> Update `test-registry.js` for 110 rows and 11 headers in this same commit.
>
> Write `scratchpad/test-cs037-p2.js` covering: the battery enumerating every listed population; the
> p95 threshold logic including the not-reached case; update and draw timers being independent; the
> override force-and-restore round trip including an aborted run; and the seal (no scoring,
> high-score, achievement or settings write reachable from benchmark mode). Confirm hand-mutated
> regressions fail it. Run the full suite.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P2: in-game benchmark mode (registry 106 -> 110, headers 10 -> 11)

Debug-panel-driven battery over ten isolated populations plus one mixed
late-wave run. Ramps to threshold and reports the count at p95 16.7ms and
33.3ms, with update and draw timed separately. Sealed: no scoring,
high-score, achievement, telemetry or settings write is reachable.
Forces debugOverride OFF for the run and restores unconditionally
(FLAG-CS036-a). New BENCHMARK section: four knobs, two action rows.
```

### Headless test expectations

`test-cs037-p2.js` — roughly 90–120 assertions.

- **§A** battery enumerates all listed populations, in order, none skipped.
- **§B** p95 threshold detection: crossing at 16.7, crossing at 33.3, and the not-reached path.
- **§C** update and draw timers are independent and non-aliasing.
- **§D** override force/restore round trip; restore on abort; restore on early exit.
- **§E** the seal — `addScore`, `HighScores.save`, `Achievements.save`, `saveSettings` unreachable.
- **§F** registry at 110, headers at 11, `LEVERS` still 18.

---

## P2.1 — Gate A instrumentation

**Model:** Sonnet, high effort.

**Why this exists.** P2 landed and its CSV covers Gate A questions 1–3 well. Reviewing it against the
gate found four things Paul would otherwise transcribe by hand or work out in a spreadsheet. This is
a small additive phase over shipped P2 code — **no rework of P2, no behaviour change to the battery
itself, and no new registry rows.**

### Contract

**1. Real-play population peaks (the gap that matters).** Gate A Q6 divides each population's
crossing count by what a real late wave actually reaches, and nothing in the build records the
second number. Add a passive high-water-mark recorder over the same population set the battery
enumerates: `game.garbage` singles, `game.garbage` clumps, `game.debris` per size, `game.hunters`
per size, `game.saucers`, `game.particles`, `game.floaters`, `game.chain`.

- Sampled once per frame in normal play, in `update()`'s cleanup block after the filters, so the
  count recorded is the post-cull count a frame actually drew.
- Two figures per population: **peak this run**, and **peak this session** across runs.
- Session-scoped and in memory only. **⛔ No localStorage key** — the Gate A workflow is play, then
  run the battery, then copy, all in one session, and this does not justify new persisted state.
- **⛔ Benchmark mode must not feed the recorder.** The battery's synthetic populations are exactly
  what these peaks must be measured against; letting them in makes the column self-referential and
  useless. This is P2's seal read in the other direction — verify it holds both ways.

**2. Mixed-run weights in the export.** `BENCH_MIX` is a const in code, and Q5's prediction needs it.
Emit the weight table into the CSV comment header.

**3. Environment stamp.** Q4 asks which browsers and machines were tested; the CSV cannot currently
answer that about itself. Add `navigator.userAgent`, viewport size and `devicePixelRatio` to the
comment header, so a paste is self-identifying and pastes cannot be mixed up between browsers.

**4. Predicted-vs-actual mixed crossing, computed in-build.** The per-step raw table already carries
everything needed: derive each isolated population's per-entity cost, weight by `BENCH_MIX`, solve
for the crossing, and emit predicted count, actual mixed count, and the ratio as one line. This turns
Q5 from a spreadsheet exercise into a read-off.

- **⛔ State the method in the comment header** — that the prediction is linear per-entity
  extrapolation and therefore assumes populations are independent, which is precisely the assumption
  Q5 exists to test. A number whose derivation is invisible will be trusted more than it deserves.
- If a population needed for the prediction reported "not reached", emit the prediction as
  unavailable rather than extrapolating past the ceiling.

**Registry: unchanged at 110.** None of this is a tunable.

### Paste-ready prompt

> Read `CLAUDE.md`, `STATUS.md`, `PLANNED-FEATURES-CS037.md` §3, and the CS037 Gate A questions in
> `IMPLEMENTATION-PHASES-CS037.md` before touching anything. Grep by symbol name.
>
> This is CS037 P2.1, a small additive phase over the benchmark that P2 already shipped. Read `Bench`,
> `BENCH_MIX`, `benchReportCSV`, `benchCopyResults` and `benchDownloadResults` first. ⛔ Do not rework
> the battery, change how it ramps or samples, or alter any existing CSV column — this phase only adds
> to the export and adds one passive recorder. No new registry rows.
>
> **1. Real-play population peaks.** Gate A asks which populations to cap, which needs each
> population's crossing count compared against what a real late wave actually reaches — and nothing
> records the second number. Add a passive high-water-mark recorder covering the same populations the
> battery enumerates: `game.garbage` singles, `game.garbage` clumps, `game.debris` per size,
> `game.hunters` per size, `game.saucers`, `game.particles`, `game.floaters`, `game.chain`. Sample
> once per frame in normal play, in `update()`'s cleanup block **after** the filters, so you record
> the post-cull count a frame actually drew. Keep two figures per population: peak this run, and peak
> this session across runs. In memory only, module-level — ⛔ no localStorage key, and no field on
> `game` (the CS016 P3 both-places rule).
>
> ⛔ Benchmark mode must NOT feed this recorder. The battery's synthetic populations are the thing
> these peaks get compared against, so letting them in makes the number self-referential. P2 sealed
> benchmark mode against writing scores, achievements and settings; verify that seal holds in this
> direction too and extend it if it does not.
>
> Emit both figures per population into the CSV.
>
> **2. Mixed weights.** Emit the `BENCH_MIX` weight table into the CSV comment header — the mixed-run
> prediction depends on it and it is currently only visible in source.
>
> **3. Environment stamp.** Add `navigator.userAgent`, viewport size and `devicePixelRatio` to the CSV
> comment header, so a paste identifies which browser and machine produced it.
>
> **4. Predicted-vs-actual mixed crossing.** The per-step raw table already carries per-population
> update and draw cost at each count. From the isolated runs, derive each population's per-entity
> cost, weight those by `BENCH_MIX`, and solve for the total count at which the weighted sum crosses
> 16.7 ms. Emit that predicted count alongside the mixed run's actual crossing count and the ratio
> between them, as one clearly-labelled line.
>
> ⛔ State the method in the comment header: that this is a linear per-entity extrapolation which
> assumes the populations are independent — which is exactly the assumption the comparison exists to
> test. If any population the prediction needs reported "not reached", emit the prediction as
> unavailable rather than extrapolating past the ceiling.
>
> Write `scratchpad/test-cs037-p2-1.js` covering: peaks tracking the true maximum and not the last
> value; peaks sampled after the filters, not before; benchmark mode not contributing to peaks;
> run-peak resetting per run while session-peak does not; the mixed prediction against a hand-computed
> fixture; the not-reached path emitting unavailable rather than a number; and every pre-existing CSV
> column being byte-identical to P2's output for the same results. Confirm hand-mutated regressions
> fail it. Run the full suite.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P2.1: Gate A instrumentation over the P2 benchmark

Passive per-population high-water marks from normal play (run peak and
session peak), sampled post-filter and sealed off from benchmark mode, so
the cap decision can compare crossing counts against what a real late wave
actually reaches. BENCH_MIX weights, userAgent / viewport / DPR, and a
computed predicted-vs-actual mixed crossing added to the CSV header, with
the extrapolation method stated alongside it.

Additive only: no battery behaviour change, no existing column altered,
registry unchanged at 110.
```

### Headless test expectations

`test-cs037-p2-1.js` — roughly 50–70 assertions. §A peak tracking (true max, not last value);
§B post-filter sampling; §C benchmark mode excluded; §D run-peak vs session-peak lifecycle;
§E mixed prediction against a hand-computed fixture; §F not-reached → unavailable; §G P2's existing
columns byte-identical.

---

## ⛔ GATE A — Measurement gate (BLOCKING)

**P3 does not start until Paul has run the battery and returned numbers.**

**Procedure, per browser/machine.** After P2.1, one CSV per browser answers questions 1–5 on its own;
nothing needs writing down by hand.

1. **Play first, benchmark second.** Play a few runs into the late waves — far enough that the field
   feels crowded and any hiccup shows. This is what populates the real-play peak columns; running the
   battery on a cold boot leaves them empty and Q6 unanswerable.
2. Enter the debug panel, run the battery, and **copy or download the CSV before switching browsers**
   — results are in memory only and closing the tab loses them.
3. Repeat per browser. Each CSV carries its own `userAgent` stamp, so pastes cannot be mixed up.

The benchmark forces registry defaults itself, so no manual "Overrides Applied → OFF" step is needed
for this gate.

**Read off the CSV** (these are columns and header lines, not calculations):

1. Count at which p95 frame time crosses **16.7 ms**, per population. (number, or "not reached")
2. Count at which p95 frame time crosses **33.3 ms**, per population. (number, or "not reached")
3. Update-cost share vs draw-cost share at the 16.7 ms crossing. (two numbers, ms)
4. Which browsers and machines were tested? (the `userAgent` header line from each CSV)
5. **Mixed run**: predicted crossing, actual crossing, and the ratio. (the predicted-vs-actual line)
   A ratio near 1 means the populations are independent and caps can be sized off the isolated
   numbers. A materially lower actual means something interacts — most likely Hunter homing scanning
   a larger `game.garbage` — and caps get sized off the mixed number instead.

**The one judgment call:**

6. Given the numbers, which populations should get caps this changeset, and why? (list plus
   reasoning, not just names — P3's prompt quotes the reasoning into the spec)

   Method: for each population, divide its 16.7 ms crossing count by its **real-play session peak**
   (also a CSV column, courtesy of P2.1) to get a margin. **Margin under ~2× wants a cap; above ~3×
   does not** — a cap nobody needs is a behaviour change with no benefit. Between the two, use the
   update/draw split from Q3 and your own read on whether that population still feels like it
   accumulates. Note also that `game.garbage` is already capped by `cullGarbage()` and Hunters
   already have a *spawn* cap, so for those two the question is whether the existing mechanism is
   doing enough, not whether to start from zero.

---

## P3 — Static caps

**Model:** Opus, high effort, thinking.

**Blocked on Gate A.** Populations and numbers come from Gate A answers 1–3 and 6.

### Contract

- Caps for the populations Gate A implicates, and **only** those. A cap nobody needs is a behaviour
  change with no benefit.
- **Follows the `cullGarbage()` idiom exactly:** soft ceiling drips one victim per frame, hard
  ceiling drains to soft in one pass; **dead-flag plus the end-of-frame `.filter()`**, never a
  mid-loop splice; silent (no blink, no particle, no sound).
- **⛔ Fully deterministic — same inputs, same victims, every run.** CS024 P3 considered and rejected
  a frame-rate-reactive cull and recorded determinism as a requirement rather than a nicety. Item A
  **preserves** that: the measurement was offline, these caps are static constants, and the runtime
  cull never samples frame time. **This is not a reversal and must not be written up as one.**
- Victim selection is a deterministic total order over the array, ties broken by array order.
- Soft/hard knobs are read live and **not** validated against each other — an inverted pair yields a
  non-positive count and culls nothing. `cullGarbage()` carries no ordering assert; neither may
  these.
- Runs in `update()`'s cleanup block, after every pass that can mark an entity dead and before the
  filters — the placement `cullGarbage()` already occupies and documents. **Not** mirrored into
  `updateDeath()`, for the reasons recorded there.
- If Hunters are capped: this is a **field** cap and sits **alongside** the existing spawn cap
  (`hunterCapMax` 6, `hunterCapLevelsPerStep` 2), not replacing it.
- Registry grows by 2 per capped population. Update `test-registry.js`.

### Paste-ready prompt

> ultrathink
>
> Read `CLAUDE.md`, `STATUS.md`, `PLANNED-FEATURES-CS037.md` §3.4, and the `IMPLEMENTATION-PHASES-CS037.md`
> Gate A answers before touching anything. Grep by symbol name.
>
> This is CS037 P3: add static object caps for the populations Gate A implicated. Read `cullGarbage()`
> and its surrounding comment block, and the cleanup-block comment in `update()` that explains its
> placement, before writing anything — the new caps follow that idiom exactly rather than inventing a
> second one.
>
> Cap **only** the populations named in the Gate A answers, at the numbers given there. A population
> that cleared comfortably gets no cap.
>
> Each cap: soft ceiling drips exactly one victim per frame; hard ceiling drains straight back to soft
> in one pass; victims marked with the dead flag and swept by the existing end-of-frame `.filter()`,
> never spliced mid-loop; entirely silent — no blink, no particle, no sound. Victim selection is a
> deterministic total order over the array with ties broken by array order.
>
> ⛔ Determinism is a requirement, not a nicety: same inputs, same victims, every run. CS024 P3
> rejected a frame-rate-reactive cull and recorded that decision; this phase **preserves** it — the
> measurement was offline, these caps are static constants read from the registry, and the runtime
> cull must never sample frame time. Do not write this up as reversing anything.
>
> ⛔ Do not validate soft against hard. `cullGarbage()` deliberately carries no ordering assert — an
> inverted pair yields a non-positive count and culls nothing — and no registry row in this build has
> ever validated a sibling. Match that.
>
> Place the caps in `update()`'s cleanup block alongside `cullGarbage()`: after every pass that can
> mark an entity dead, before the filters. Do not mirror them into `updateDeath()`.
>
> If Hunters are capped, this is a **field** cap and sits alongside the existing spawn cap
> (`hunterCapMax`, `hunterCapLevelsPerStep`) — read `largeHunterCount()` first and do not conflate
> the two.
>
> Add two registry rows per capped population, in that population's existing section, following the
> surrounding comment conventions. Update `test-registry.js` for the new count in this same commit.
>
> Write `scratchpad/test-cs037-p3.js` covering, per cap: the soft drip rate (exactly one per frame);
> the hard drain in one pass; determinism (identical inputs produce identical victims across repeated
> runs); the inverted-pair no-op; and that no victim survives a frame to be drawn. Confirm
> hand-mutated regressions fail it. Run the full suite.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P3: static object caps for <populations> (registry NNN -> NNN)

Soft-drip / hard-drain ceilings following the cullGarbage() idiom:
dead-flag plus the end-of-frame filter, silent, deterministic victim
order, no soft/hard cross-validation. Numbers from the CS037 Gate A
measurement. CS024 P3's determinism requirement is preserved, not
reversed: the measurement was offline and the runtime cull never samples
frame time.
```

### Headless test expectations

Per cap: soft drip rate, hard drain, determinism across repeated identical runs, inverted-pair no-op,
no victim drawn after death. Plus a registry-count assertion.

---

## P4 — Telemetry buffer, storage, clipboard export

**Model:** Opus, high effort, thinking.

### Contract

- Snapshot every **N** seconds of **game time** — `telemetryInterval`, **default 15**, one new
  registry row (GLOBAL section; one knob does not justify its own header).
- **Clock excludes paused time**: the same clock `game.stats.gameTime` runs on. Menu, pause and
  level-ceremony time do not count.
- **Per-row fields** per `PLANNED-FEATURES-CS037.md` §5.2 — score, level, six remaining-use columns
  (five `powerBudget` keys plus `scoopLevel`; health has no remaining-use quantity), ship health,
  ship speed, seven pickup counts, ten health-lost-by-source columns from P1, `debugRun` and
  `resumedRun` flags, and the interval timestamp.
- **Seven pickup counters (FORK-E → all 7):** six new flat counters on `resetGameStats()` for
  `rapid`, `triple`, `magnet`, `engine`, `scoop`, `guard`; **health reuses the existing
  `healthPicked`**, which already counts exactly this. Do not add a parallel health counter and do
  not repoint Glass Cannon. One increment site: the top of `applyPowerup(type)`. The two existing
  `powerupsPicked++` sites stay untouched.
- **Scope: per-run**, cleared through `resetRun()` — the shared reset both `startGame()` and
  `resumeFromSave()` go through, so a resumed run also starts clean. **400-row cap**, oldest roll
  off.
- **Always captures**, including debug and resumed runs; the flags make filtering an offline concern.
- **Export is a debug-panel action row only**, and **must be reachable at game-over** — the buffer
  clears on the next `resetRun()`.
- **New localStorage key**, written each snapshot. Follows the `SaveSlots` idiom: `Profiles.keyFor()`,
  `storageOK()` guard, try/catch, versioned envelope, known-value-else-default on the envelope. A
  background write fails silently — the `SaveSlots.write()` boolean-return is a deliberate exception
  for player-initiated saves and does not apply here.
- **⛔ No existing key is touched.** `afd_scores_v1`, `afd_achievements_v2`, `afd_settings_v1`,
  `afd_profiles_v1`, `afd_saves_v1` — no schema bump, no rename, no read-modify-write.
- **Benchmark mode does not write to the buffer.**
- Buffer state is module-level (the `DebugPanel` precedent), not a field on `game` — sidestepping the
  CS016 P3 both-places rule.

### Paste-ready prompt

> ultrathink
>
> Read `CLAUDE.md`, `STATUS.md`, and `PLANNED-FEATURES-CS037.md` §5 in full before touching anything.
> Grep by symbol name.
>
> This is CS037 P4: a periodic gameplay telemetry buffer with a clipboard export, for offline
> analysis. P1 already landed the ten per-source damage accumulators this reads — verify that by grep
> before starting.
>
> Snapshot every N seconds of **game time**, N being a new `telemetryInterval` registry knob defaulting
> to **15**, in the GLOBAL section. Use the same clock `game.stats.gameTime` runs on, so menu, pause
> and level-ceremony time do not count toward N.
>
> Each row carries: score; level; remaining uses for rapid, triple, magnet, engine and guard (from
> `powerBudget`) plus scoop level (from `game.scoopLevel`) — health has no remaining-use quantity and
> gets no such column; ship health; current ship speed; this-run pickup counts for all seven powerup
> types; the ten per-source health-lost accumulators from P1; the `debugRun` and `resumedRun` flags;
> and the interval timestamp.
>
> For pickup counts: add six flat counters to `resetGameStats()` for rapid, triple, magnet, engine,
> scoop and guard. **Health reuses the existing `healthPicked`** — it already counts exactly this
> quantity for Glass Cannon; do not add a parallel counter and do not repoint the achievement.
> Increment at one site, the top of `applyPowerup(type)`; leave the two existing `powerupsPicked++`
> sites alone. Flat fields, not a nested object — read the copy-semantics comment above
> `buildSaveEntry()` first and note why `powerUsed` needs its special-case.
>
> Buffer is per-run, cleared in `resetRun()` (the shared reset both `startGame()` and
> `resumeFromSave()` go through), capped at **400 rows** with oldest rolling off. It always captures,
> including debug and resumed runs — the flags exist so the data can be filtered offline rather than
> silently missing.
>
> Add a debug-panel action row that copies the buffer to the clipboard. ⛔ It must be reachable at
> game-over, since the buffer clears on the next `resetRun()`. Export lives in the debug panel only,
> never in Options.
>
> Persist to a **new** localStorage key, written each snapshot, so a crash or refresh does not lose
> the run. Follow the `SaveSlots` idiom exactly — read it first: routed through `Profiles.keyFor()`,
> guarded by `storageOK()`, wrapped in try/catch, a versioned envelope, and known-value-else-default
> on the envelope so an absent, unreadable or wrong-version blob resolves to an empty buffer rather
> than throwing or partially trusting bad data. This is a background write nobody is watching, so it
> fails silently — `SaveSlots.write()`'s boolean return is a deliberate exception for player-initiated
> saves and does not apply here.
>
> ⛔ Do not touch `afd_scores_v1`, `afd_achievements_v2`, `afd_settings_v1`, `afd_profiles_v1` or
> `afd_saves_v1` in any way. No schema bump, no rename, no read-modify-write.
>
> ⛔ Benchmark mode must not write to this buffer — check P2's seal still holds after this phase.
>
> Keep buffer state module-level, like `DebugPanel`, rather than adding a field to `game` — that
> sidesteps the CS016 P3 both-places rule.
>
> Update `test-registry.js` for the new row count in this same commit.
>
> Write `scratchpad/test-cs037-p4.js` covering: interval timing against game time with a pause
> interposed; the 400-row cap rolling oldest off; clearing at `resetRun()` from both entry points;
> the flags being set correctly on debug and resumed runs; all seven pickup counters incrementing
> once per pickup at the right type; storage round trip including absent / corrupt / wrong-version
> envelopes; and the export being reachable at game-over. Confirm hand-mutated regressions fail it.
> Run the full suite.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P4: periodic gameplay telemetry with clipboard export

One row every telemetryInterval seconds of game time (default 15, new
GLOBAL knob), 400-row per-run ring cleared at resetRun(). Rows carry
score, level, six remaining-use columns, hull, speed, seven per-type
pickup counts and P1's ten per-source damage columns, flagged debugRun /
resumedRun. Six new flat pickup counters; health reuses healthPicked.
New per-profile localStorage key on the SaveSlots idiom — no existing
key touched. Export is a debug-panel action row, reachable at game-over.
```

### Headless test expectations

`test-cs037-p4.js` — roughly 100–130 assertions. §A interval timing vs game time incl. pause;
§B 400-row cap; §C clearing from both `resetRun()` entry points; §D flags; §E seven pickup counters,
one increment per pickup; §F storage round trip incl. absent/corrupt/wrong-version; §G export
reachable at game-over; §H benchmark seal still holds.

---

## P5 — Full release on damage + voice event split

**Model:** Opus, high effort, thinking. `ultrathink`.

### Contract

**Release.**

- Any **real HP-dealing hit** releases **all** towed Debris, from any source.
- **⛔ Non-lethal branch only.** `damageShip()` returns `true` from two places — after `killShip()`
  and at the end of the non-lethal path. `killShip()` already calls `scatterChain()`; hooking the
  shared return double-scatters on death.
- **Mechanism: `scatterChain()`, unchanged.** No variant, no new scatter function.
- **FORK-B1 → no.** A chain-guard charge does **not** intercept. `powerBudget.guard` is not read and
  not spent. `breakChain()` is not on this path.
- **FORK-B2 → no.** `game.stats.cargoDamageEvents` is **not** incremented. Reusing `scatterChain()`
  verbatim gives this for free — do not add an increment at the new site.
- Shielded, i-framed and auto-shield hits keep the cargo.

**Voice.**

- Split `"Payload lost."` out of `chain_broken` into its own event. Text and phon move **verbatim** —
  already lab-composed and zero-error-verified. **No new phons; no `voice-robot-lab` gate this
  changeset.** `chain_broken` keeps its other four alternatives.
- **Selection rule, applied at every chain-loss site:** *was the chain non-empty, and is it now
  empty.*
  - new damage release → new event (guarded on the chain having been non-empty)
  - `breakChain(i, …)` sever path → `i === 0` speaks the new event; `i > 0` keeps `chain_broken`
  - guarded absorb → unchanged, `chain_guard`, still returns before the sever path
- **⛔ Ship death stays silent.** Speak from the call site in `damageShip()`, never from inside
  `scatterChain()` — that is what keeps `killShip()` silent with no flag or guard parameter.
- **FORK-C → critical.** `VOICE_PRIORITY` **2** (matching `chain_broken`); `VOICE_CRITICAL` **true**;
  **`VOICE_QUEUE_MAX` 4 → 5**; `VOICE_STILL_TRUE` predicate `game.chain.length === 0`.
- **No registry rows this phase.**

### Paste-ready prompt

> ultrathink
>
> Read `CLAUDE.md`, `STATUS.md`, and `PLANNED-FEATURES-CS037.md` §4 in full before touching anything.
> Grep by symbol name. Read `damageShip`, `killShip`, `scatterChain`, `breakChain`, `VOICE_LINES`,
> `VOICE_PRIORITY`, `VOICE_CRITICAL`, `VOICE_QUEUE_MAX` and `VOICE_STILL_TRUE` — with their comment
> blocks — before writing anything.
>
> This is CS037 P5, two coupled changes.
>
> **1. Full release on damage.** Any real HP-dealing hit, from any source, releases all towed Debris.
> ⛔ Hook the **non-lethal** branch of `damageShip()` only. That function returns `true` from two
> places — after `killShip()`, and at the end of the non-lethal path — and `killShip()` already calls
> `scatterChain()`, so hooking the shared return double-scatters on death. Reuse `scatterChain()`
> unchanged; do not write a variant.
>
> ⛔ A chain-guard charge does **not** intercept this (FORK-CS037-B1 → no): the guard intercepts chain
> severs through `breakChain()`, and hull damage is a different event. Do not read or spend
> `powerBudget.guard`. ⛔ Do **not** increment `game.stats.cargoDamageEvents` (FORK-CS037-B2 → no):
> CS035 P6 scoped that pity counter to `breakChain()`'s sever path only, and `scatterChain()`
> deliberately leaves it alone — reusing `scatterChain()` verbatim gives you this for free, so simply
> do not add an increment at the new site.
>
> Shielded, i-framed and auto-shield hits all return false, deal 0 HP, and keep the cargo — that is
> what the shield is for.
>
> **2. Truthful voice line.** Today `"Payload lost."` is one of five random alternatives under
> `chain_broken`, so it fires on partial breaks and reads as total loss when the player kept most of
> the load. Split it into its own event, moving text and phon **verbatim** — the phon is already
> lab-composed and zero-error-verified, so no new phons are composed and no `voice-robot-lab` gate is
> required. `chain_broken` keeps its other four alternatives.
>
> Apply one general selection rule at **every** chain-loss site: *was the chain non-empty, and is it
> now empty.* The new damage release is empty by construction, so it speaks the new event, guarded on
> the chain having been non-empty beforehand. In `breakChain(i, …)`'s sever path, `i === 0` drops the
> entire load and speaks the new event; `i > 0` keeps `chain_broken`. The guarded absorb is unchanged
> and still returns before the sever path.
>
> ⛔ Ship death stays silent (CS011 P5). Speak from the call site in `damageShip()`, never from inside
> `scatterChain()` — that is what keeps `killShip()`'s call silent without needing a flag or a guard
> parameter.
>
> The new event is CRITICAL (FORK-CS037-C). That means: `VOICE_PRIORITY` **2**, matching
> `chain_broken` — criticality is orthogonal to priority and the two tables are never merged, and it
> must **not** gain the power to pre-empt `health_low` at 3. `VOICE_CRITICAL` true. ⛔ **`VOICE_QUEUE_MAX`
> 4 → 5** — read the ⛔ note at its declaration: it is sized to the critical set as a structural guard,
> and `test-cs025-p4.js` §F pins the relationship rather than either literal, so moving one without
> the other fails the suite. Add a `VOICE_STILL_TRUE` predicate: `game.chain.length === 0`. That is
> the trigger's own condition restated — a parked line speaks only while the payload is in fact still
> lost, and is otherwise discarded silently rather than spoken late.
>
> Write `scratchpad/test-cs037-p5.js` covering: release on a real hit from each of the four source
> categories; cargo kept on shielded / i-framed / auto-shield hits; no double-scatter on the lethal
> path; `cargoDamageEvents` unchanged by the release; `powerBudget.guard` unspent by the release; the
> voice selection rule at all three sites including `breakChain(0)` and `breakChain(n>0)`; ship death
> still silent; the queue-max / critical-set relationship; and the still-true predicate discarding a
> parked line once the player has re-scooped. Confirm hand-mutated regressions fail it. Run the full
> suite.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P5: full tow release on damage; "Payload lost." as its own event

Any real HP-dealing hit scatters the whole tow via scatterChain(), hooked
on damageShip()'s non-lethal branch only so death does not double-scatter.
Chain guard does not intercept and cargoDamageEvents is untouched
(FORK-CS037-B1/B2 -> no).

"Payload lost." splits out of chain_broken verbatim — no new phons, no
voice-robot-lab gate. Event chosen by "was non-empty, now empty" at every
chain-loss site, including breakChain(0). Ship death stays silent: the
line is spoken at the damageShip() call site, not inside scatterChain().
New event is critical, priority 2, VOICE_QUEUE_MAX 4 -> 5.
```

### Headless test expectations

`test-cs037-p5.js` — roughly 110–140 assertions, and the highest regression-catch count of the
changeset. Confirm at least 10 hand-mutated regressions fail it, with specific attention to the
lethal-path double-scatter and the queue-max coupling.

---

## P6 — Resume baseline + targeted persistence

**Model:** Opus, **xhigh** effort, thinking. `ultrathink`.

**FORK-CS037-A.1 → (b2)**, the targeted merge write (`PLANNED-FEATURES-CS037.md` §2.2). Resolved; the
prompt below is final.

### Contract

**Baseline.**

- At resume, snapshot each **active achievement's** `cur()` value — **both pools, blanket**
  (C7-rev: `untouchable` and `max_haul` are LIFETIME and read per-game stats).
- `evaluate()` toasts only on a crossing **above that baseline**.
- For tiered lifetime achievements, the baseline is the tier index already justified at load time.
- **⛔ The baseline never touches `weeklyUnlocked`, `lifetimeUnlocked` or `lifetimeTiers`.**
- **⛔ Placement:** after `resumeFromSave()` step 2 (stats overwrite), before step 4 (`nextWave()`).
  Earlier snapshots zeroes and fixes nothing; later, `nextWave()` has advanced `game.wave`, which
  `untouchable`'s `cur()` reads.
- Lives on the `Achievements` module, cleared in `resetRun()`. Not a field on `game` — that avoids
  the CS016 P3 both-places rule.
- **No banner-display gating.** `drawToasts()` stacks by design; that behaviour stays.

**Persistence (b2).**

- A targeted merge write: read the stored blob, add only ids that crossed above the baseline (and
  their tier indices), leave stored `lifetime` counters untouched, write back.
- **`game.debugRun` remains an absolute bar** on all persistence, unchanged.
- CS032 P2's resumed-run bar on lifetime **counters** survives intact — which is the point of (b2)
  over (b1).

### Paste-ready prompt

> ultrathink
>
> Read `CLAUDE.md`, `STATUS.md`, and `PLANNED-FEATURES-CS037.md` §6 **and §2.2** in full before
> touching anything. Grep by symbol name. Read `resumeFromSave`, `resetRun`, `Achievements.evaluate`,
> `Achievements.deriveLifetime`, `Achievements.save`, `Achievements.onUnlock` and the WEEKLY and
> LIFETIME tables — with their comment blocks — before writing anything.
>
> This is CS037 P6: fix the achievement flood that fires when a saved game is loaded in a fresh
> browser session.
>
> Verify the root cause by inspection first. All 16 weekly achievements read per-game stats directly,
> and **two LIFETIME ones do too** — `untouchable` and `max_haul`, both non-tiered. `resumeFromSave()`
> copies `game.stats` out of the slot, and the next `evaluate()` finds a batch of them all satisfied
> on the same frame. `deriveLifetime()` — the silent catch-up that exists to prevent exactly this — is
> called once from `load()`, when `game.stats` is still fresh, and is never re-run after the resume
> overwrite. If that is not what you find, stop and report.
>
> ⛔ Note the live consequence, because it shapes the fix: those two lifetime ids enter the in-memory
> `lifetimeUnlocked` set during the resumed run, and the **next non-resumed run in the same session**
> calls `Achievements.save()` with no suppression and persists them. That is a data-integrity bug
> shipping today, and it is why the baseline covers **both pools, blanket**, not weeklies only.
>
> **The fix is a resume baseline.** At resume, snapshot each active achievement's `cur()` value across
> both pools. `evaluate()` then toasts only on a crossing above that baseline. For tiered lifetime
> achievements the baseline is the tier index already justified at load time, so a resumed run toasts
> a tier only when it crosses one it did not already sit above.
>
> ⛔ The baseline must never touch `weeklyUnlocked`, `lifetimeUnlocked` or `lifetimeTiers`. Silently
> marking things unlocked at resume is the naive fix and it is strictly worse than the bug — those
> sets are week-scoped and persisted, and the marks leak into any fresh run later in the same session.
>
> ⛔ Placement is load-bearing. `resumeFromSave()` already carries an invariant that step 2 (the stats
> overwrite) precedes step 4 (`nextWave()`), because `nextWave()` reads `game.stats.powerupsPicked`.
> Take the snapshot **after step 2 and before step 4**: earlier and it snapshots zeroes and fixes
> nothing; later and `nextWave()` has already advanced `game.wave`, which `untouchable`'s `cur()`
> reads. Update that `⛔ INVARIANT` comment so it names the baseline too.
>
> Keep the baseline on the `Achievements` module and clear it in `resetRun()`. Do not add a field to
> `game` — the CS016 P3 both-places rule makes that a trap.
>
> **No banner-display gating.** `drawToasts()` stacks banners by design and that behaviour stays; this
> phase fixes the award path, not the display.
>
> **Persistence.** `Achievements.save()` early-returns on `game.debugRun || game.resumedRun`, so today
> even a genuinely-earned post-baseline unlock is toasted and never persisted — the player is shown a
> reward they do not receive. FORK-CS037-A resolved to honour it, via **(b2), the targeted merge
> write**: read the stored blob, add only the ids that crossed above the baseline plus their tier
> indices, leave the stored `lifetime` counters exactly as they were, write back. Guard it the way
> `save()` guards itself.
>
> ⛔ Do **not** simply lift the `game.resumedRun` early-return. `save()` writes one blob including
> `lifetime: {...counters}`, and several of those are `++` counters — lifting the gate would let a
> player bank the same events repeatedly by reloading one slot, which is exactly what CS032 P2's bar
> exists to prevent. ⛔ `game.debugRun` stays an absolute bar on all persistence, unchanged.
>
> Write `scratchpad/test-cs037-p6.js` covering: a resume from a stats-rich slot toasting nothing on
> the first `evaluate()`; a genuine post-load crossing toasting exactly once; the baseline covering
> `untouchable` and `max_haul` specifically; tiered lifetime baselines; the baseline never mutating
> the three unlock structures; the snapshot placement (a deliberately mis-ordered variant failing);
> the merge write adding unlocks while leaving stored lifetime counters byte-identical; a repeated
> resume of one slot not compounding counters; and `debugRun` still barring everything. Confirm
> hand-mutated regressions fail it. Run the full suite.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P6: resume achievement baseline, both pools

Snapshot every active achievement's cur() at resume, between the stats
overwrite and nextWave(), and toast only on crossings above it. Covers
weekly AND lifetime: untouchable and max_haul read per-game stats too,
and were leaking into afd_achievements_v2 via the next non-resumed run
in the same session.

Baseline never touches weeklyUnlocked / lifetimeUnlocked / lifetimeTiers.
Post-baseline unlocks now persist through a targeted merge write that
leaves stored lifetime counters untouched (FORK-CS037-A -> b, A.1 -> b2),
so CS032 P2's counter bar survives. debugRun remains an absolute bar.
No banner-display gating: drawToasts() is unchanged.
```

### Headless test expectations

`test-cs037-p6.js` — roughly 120–160 assertions. This is the subtlest phase in the changeset; §F's
placement test (a mis-ordered snapshot must fail) and §G's counter-immutability test are the two that
matter most. Confirm at least 12 hand-mutated regressions fail it.

---

## P7 — Delivery payout nerf + two dock knobs

**Model:** Sonnet, high effort.

### Contract

- **One powerup per visit, at `deliveryCount >= 8`.** Keep the `=== 8` latch; delete the 12 / 16 / 20
  latches. The counter increments by one per canister so it always passes through 8 — the existing
  equality **is** the ">= 8, once per visit" rule and needs no restructuring. Hauls of 7 or fewer
  award nothing, unchanged.
- **⛔ Do not disturb the neighbouring latches.** `deliveryCount === 12` (Heavy Hauler /
  `fullChains` / `heavyHaulerEvents`) and `deliveryCount === CARGO_CAP_MAX` (Maxed Out /
  `superMegaDelivery()`) sit in the same block and share the same idiom. The 12 in the powerup
  condition and the 12 in the Heavy Hauler condition are different mechanisms that happen to share a
  number.
- **No score compensation (S4).** The delivery curve is untouched.
- **Promote `DOCK_BASE_SCORE` (50) and `DOCK_BONUS_STEP` (25) to registry knobs** in the **DELIVERY**
  section at their current values. Values do not change this changeset. The shipped constants stay as
  the documented defaults the knobs derive from — the `scoopHitsPerLevel` precedent. Registry +2.
- Scoring continues to route through `addScore()`.

### Paste-ready prompt

> Read `CLAUDE.md`, `STATUS.md`, and `PLANNED-FEATURES-CS037.md` §7 before touching anything. Grep by
> symbol name.
>
> This is CS037 P7: nerf the dock powerup payout to one per visit, and promote two delivery-score
> constants to registry knobs.
>
> Find the four one-shot powerup latches at `deliveryCount` 8 / 12 / 16 / 20 in the dock delivery
> block. Keep the `=== 8` latch, delete the other three. Do not restructure the condition — the
> counter increments by one per canister so it always passes through 8, which means the existing `=== 8`
> equality already **is** the ">= 8, once per visit" rule. Hauls of 7 or fewer continue to award
> nothing.
>
> ⛔ The same block contains `deliveryCount === 12` for Heavy Hauler / `fullChains` /
> `heavyHaulerEvents`, and `deliveryCount === CARGO_CAP_MAX` for Maxed Out and `superMegaDelivery()`.
> Those are different mechanisms that happen to share numbers with the latches you are deleting. Do
> not touch them.
>
> No score compensation — the delivery curve is deliberately untouched. It already pays
> `50 + 25 × (N−1)` for the Nth canister of a visit, so a 24-piece haul totals 8,100, which is 6.75×
> what those pieces earn one at a time; the greed-vs-risk incentive is carried by the curve and the
> powerups were stacked on top of it.
>
> Promote `DOCK_BASE_SCORE` (50) and `DOCK_BONUS_STEP` (25) to registry knobs in the DELIVERY section
> at their current values. **Values do not change this changeset** — this exists so the curve can be
> retuned by feel in-browser if the nerf turns out to need compensation after all. Keep the shipped
> constants in place as the documented defaults the knobs derive from, following the
> `scoopHitsPerLevel` precedent. Scoring stays routed through `addScore()`.
>
> Update `test-registry.js` for the new row count in this same commit.
>
> Write `scratchpad/test-cs037-p7.js` covering: exactly one powerup awarded at a haul of 8, 12, 16,
> 20 and 24; zero at 7 and below; Heavy Hauler still firing at 12 and Maxed Out still firing at
> `CARGO_CAP_MAX`; `superMegaDelivery()` unchanged; and the score curve identical to HEAD at every
> visit size in the reference table. Confirm hand-mutated regressions fail it. Run the full suite.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P7: one powerup per dock visit (registry NNN -> NNN)

Keep the deliveryCount === 8 latch, delete 12 / 16 / 20. The counter
always passes through 8, so the existing equality already is the
">= 8, once per visit" rule. Heavy Hauler's === 12 and Maxed Out's
=== CARGO_CAP_MAX are untouched — different mechanisms, shared numbers.

No score compensation (S4): the delivery curve is unchanged.
DOCK_BASE_SCORE and DOCK_BONUS_STEP promoted to DELIVERY knobs at their
current values 50 and 25, so the curve can be retuned in-browser if the
nerf needs compensation after all.
```

---

## ⛔ GATE B — Playtest gate (BLOCKING)

**P8 does not start until these are answered.** Numeric answers where a tunable is involved.

**⛔ Before playing: FLAG-CS036-a.** Set **"Overrides Applied" → OFF**, or use **"Reset all debug
knobs to defaults"**. Any installation that has ever saved settings is otherwise running stored knob
values, not shipped defaults, and every answer below will be measuring the wrong build. P2's
benchmark handles this itself; this gate does not.

Play several full runs into the late waves, with the tow chain loaded.

**Item F — the powerup nerf.**

1. At what haul size does a large haul stop feeling worth the risk in the late waves? (number of
   canisters)
2. If `DOCK_BASE_SCORE` and `DOCK_BONUS_STEP` need to move to compensate, to what values?
   (two numbers, or "no change")

**Item C — full release on damage.**

3. How many hits per late wave now dump a loaded tow, roughly? (number)
4. Does the release make the shield feel more valuable, less, or unchanged? If it should be tuned,
   what should `SHIELD_HIT_COST` or the auto-shield threshold become? (numbers, or "no change")
5. Does "Payload lost." now fire only on genuine total loss? (yes/no — and if no, at which event)

**Items C+F together.**

6. Combined, do the two changes push late-wave play too far toward small hauls? On a 1–10 scale where
   5 is balanced, where does it sit? (number)

**Item A — the caps.**

7. Are frame-rate hiccups gone in the late waves after the caps? (yes/no)
8. If any capped population still visibly accumulates, which, and at what count does it become
   noticeable? (population + number)

**Item E — the resume fix.**

9. Load a save in a fresh browser session: how many achievement banners fire? (number — expected 0)
10. Earn one genuinely after the load, then start a fresh run and check the achievements viewer: is
    it still there? (yes/no — expected yes)

---

## P8 — Closing

**Model:** Sonnet, high effort.

### Contract

- Fold Gate B's numeric answers into `def` values. Record any question answered without a number as
  DEFERRED in `STATUS.md`, with the knobs that already reach it named — do not invent a number.
- `GAME_VERSION` → **1.0.0.37**. Re-point every live version pin in the suite (seven at CS036).
- **`CLAUDE.md` `⛔ INVARIANT` sweep**, specifically:
  - the `cullGarbage()` determinism note — extended to cover P3's new caps, and explicitly **not**
    written up as reversing CS024 P3
  - the `resumeFromSave()` step-ordering note — the P6 baseline snapshot joins the ordering
    constraint
- **GDD §2** — shipped behaviour only. Add: the full tow release, the "Payload lost." split, the
  one-powerup-per-visit rule, the new caps. **The benchmark and the telemetry buffer are developer
  instruments and do not enter §2.**
- `DIFFICULTY-LEVERS.md` — verify. `LEVERS` is still 18; nothing this changeset is a difficulty ramp.
  Likely no edit, but check the delivery-curve section against P7's two new knobs.
- `STATUS.md` roll: phase ledger, registry and header counts, working/verified, known issues. Carry
  forward the standing flakes and FLAG-CS036-a.
- `log/CS037.md` written; both planning docs archived there.
- **Full suite at zero failures and zero skips**, plus `node --check`. Rerun once before treating
  `test-cs035-p3` §F or `test-f6` §F as a regression.

### Paste-ready prompt

> Read `CLAUDE.md`, `STATUS.md`, `PLANNED-FEATURES-CS037.md`, `IMPLEMENTATION-PHASES-CS037.md` and the
> Gate B answers before touching anything. Grep by symbol name.
>
> This is CS037 P8, the closing phase.
>
> Fold the Gate B numeric answers into `def` values. ⛔ Where a question came back without a number,
> record it as DEFERRED in `STATUS.md` with the knobs that already reach it named — do not invent a
> value, and do not retune on a qualitative answer alone.
>
> Bump `GAME_VERSION` to **1.0.0.37** and re-point every live version pin in the suite — grep for
> them; there were seven at CS036.
>
> Sweep `CLAUDE.md`'s `⛔ INVARIANT` markers. Two need updating specifically. The `cullGarbage()`
> determinism note now covers P3's new caps — and ⛔ write it as CS024 P3's requirement being
> *preserved*, not reversed: the measurement was offline, the caps are static constants, and the
> runtime cull never samples frame time. The `resumeFromSave()` step-ordering note now includes P6's
> baseline snapshot in the ordering constraint.
>
> Update GDD §2 for shipped behaviour only: the full tow release on damage, the "Payload lost." event
> split, one powerup per dock visit, and the new object caps. ⛔ The benchmark mode and the telemetry
> buffer are developer instruments and do **not** enter §2.
>
> Verify `DIFFICULTY-LEVERS.md`. `LEVERS` is still 18 and nothing this changeset is a difficulty ramp,
> so it likely needs no edit — but check its delivery-curve section against P7's two new knobs.
>
> Roll `STATUS.md`: phase ledger for P1–P8 including P2.1, final registry and header counts, working/verified, known
> issues. Carry forward the two standing unseeded flakes and FLAG-CS036-a.
>
> Write `log/CS037.md` and archive both planning docs into it.
>
> Run the full suite — it must pass at **zero failures and zero skips** — plus `node --check`. If
> `test-cs035-p3` §F or `test-f6` §F fails, rerun once before investigating; both are known unseeded
> flakes at roughly 5% and 1.7%.
>
> Commit, do not push.

**Suggested commit message**

```
CS037 P8: closing — v1.0.0.37, invariants, GDD, STATUS, archive

Gate B answers folded into defs. CLAUDE.md invariant sweep: cullGarbage()
determinism extended to the new caps (preserved, not reversed) and
resumeFromSave() step ordering extended to the P6 baseline snapshot.
GDD §2 updated for shipped behaviour only — benchmark and telemetry stay
out as developer instruments. STATUS rolled, log/CS037.md written, both
planning docs archived.
```

---

## Registry accounting

| Phase | Rows | Running total | Headers |
|---|---|---|---|
| HEAD (`70518af`) | — | **106** | 10 |
| P2 | +4 (BENCHMARK) | 110 | **11** |
| P2.1 | +0 — instrumentation, no tunables | 110 | 11 |
| P3 | +2 per capped population | 110 + 2N | 11 |
| P4 | +1 (`telemetryInterval`, GLOBAL) | 111 + 2N | 11 |
| P7 | +2 (DELIVERY score knobs) | **113 + 2N** | 11 |

`LEVERS` stays **18** throughout — nothing in this changeset is a difficulty ramp.
`POWERUP_DROP_TYPES` stays **5**.

`test-registry.js` pins registry, headers, `LEVERS` and `POWERUP_DROP_TYPES`. Every phase that moves
a count updates it **in the same commit**.