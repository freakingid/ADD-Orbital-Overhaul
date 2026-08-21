# IMPLEMENTATION-PHASES-CS039 — telemetry instrumentation

Each phase below is a **paste-ready Claude Code prompt**, self-contained enough to execute without
this conversation's history.

**⚠ There is no `PLANNED-FEATURES-CS039.md`.** These prompts carry their own spec inline rather than
pointing at a section number that does not exist. If you write the spec doc later, repoint the
prompts at it and delete the inline scope blocks.

**⚠ Numbering assumption.** Verified against a fresh clone at `76eeca7` (`cs038 p5`): `STATUS.md`
reads *Changeset: CS038 · Phase: P6 · Registry: 115 · Levers: 18*, and CS038 still has GATE B and P7
(doc sweep, CS039 worklist, version bump) outstanding. So this is **CS039**. If CS038's P7 worklist
lands something else first, renumber the whole document before handing out P1.

**Standing rules for every phase (house rules — do not restate them in a session):**

- One Claude Code session per phase, one commit per phase. **Claude Code never pushes** — Paul
  commits and pushes.
- Re-grep every anchor by symbol before editing. Line numbers drift between sessions and are never
  written into a prompt.
- `CLAUDE.md` is auto-loaded. **Do not attach `STATUS.md`** — read it from the repo. No phase here
  touches levers, so `DIFFICULTY-LEVERS.md` is not needed.
- Suite green before the phase is done: `node scratchpad/run-all.js`. Zero skips is asserted at the
  closing phase, not per phase.
- **Codebase vocabulary is inverted on purpose:** `game.debris` holds **Garbage Satellites** (the
  enemies); `game.garbage` holds towable **Debris** (the salvage). Documented in `CLAUDE.md`.

**Order:** P1 → P2 (P2 reads counters P1 creates). P3 is independent of both and may run any time.
**GATE T** (capture a run and re-run the analysis) blocks P4.

**§1's seven forks are all resolved** (Paul, at the recommended default). Nothing blocks P1 — every
phase prompt below already reflects those decisions and can be handed out as written.

---

## §0 — Corrections to the source suggestions

The five instrumentation suggestions came out of an analysis session, not a repo read. Three of them
were wrong about the build. Recorded here so they are not silently "fixed" back:

1. **"the three kill counters already in the CS033 leaderboard payload" — wrong, there are two.**
   `Leaderboard.submit()` sends `wave_reached`, `canisters_delivered`, `saucer_kills`,
   `debris_destroyed`. `hunter_kills` is registered on the Worker side and **deliberately unsent**,
   with the reason written into the comment above `LEADERBOARD_ENDPOINT`: no per-game, player-only
   Hunter-kill counter exists. `hunterLineageKills` resets per lineage,
   `Achievements.lifetime.hunterKills` is cross-game, and `largeHunterKills` counts large cores only.
   So a Hunter-kill telemetry column requires a **new counter**, not a reuse. See FORK-A.

2. **"`canistersDelivered`" — the field is `game.stats.delivered`.** `canisters_delivered` is the
   wire name in the leaderboard payload only. Do not introduce a second name.

3. **"cumulative `REPAIR_FULL_BONUS` and `SCOOP_MAX_BONUS` totals — two lines" — accurate, but note
   the asymmetry.** `REPAIR_FULL_BONUS` is added with a bare `game.score += …` inside `addScore()`
   itself; `SCOOP_MAX_BONUS` goes through `addScore(SCOOP_MAX_BONUS)` from `applyPowerup()`, so it
   can itself trip a repair milestone. Both counters are still one line each, but they are not
   symmetric code and the comments must say so.

Also confirmed as **not** needing work: new flat number fields on `game.stats` are carried through
save/resume for free. `buildSaveEntry()` spreads `game.stats`, and `resumeFromSave()` runs a
known-key type-matched `for (const k in game.stats)` loop. Nested objects need special-casing;
flat numbers do not. Every counter added in P1 is a flat number, deliberately.

---

## §1 — Forks: RESOLVED

**All seven resolved by Paul, at the recommended default, before P1.** Recorded here with the
refused options and their reasons, so nothing below can be re-proposed as an open question without
acknowledging the record.

**FORK-A — a per-game, all-tier Hunter kill counter. → YES.**
Add `game.stats.hunterKills`, incremented in the same `awardScore`-gated block that already
increments `hunterLineageKills` and `Achievements.lifetime.hunterKills`. Hunters did 78% of the
damage in the analysed run and there is currently no way to see how many the player killed.

**FORK-A.1 — also send `hunter_kills` to the leaderboard? → NO, not this changeset.**
The CS033/CS034 payload is settled ground and the counter's first job is offline analysis; sending
it is a separate, deliberate decision with a public-board consequence. ⛔ P1 therefore MUST write the
comment saying the counter exists for telemetry and that wiring it into `Leaderboard.submit()` is an
open, un-taken decision — so the next reader does not assume it was forgotten. `Leaderboard.submit()`
and `makeRunResult()` are untouched by this whole changeset.

**FORK-B — hits: one total, not ten per-source counts. → ONE TOTAL, `game.stats.hitsTaken`.**
The ten `dmgFrom*` sums plus one hit total lets you compute mean damage per hit and detect the moment
reconstruction breaks; ten more columns nearly doubles the damage family for a resolution nobody has
asked for yet. **Refused option recorded:** per-source hit counts. Reopen this fork — and only this
fork — if a damage multiplier lands, or if two sources ever come to share a damage magnitude. At that
point the offline reconstruction in `TELEMETRY-ANALYSIS-GUIDE.md` §5 stops working and per-source
counts become the right answer.

**FORK-C — per-game `game.stats.deliveryScore`. → IN SCOPE.**
Only `Achievements.lifetime.deliveryScore` exists. One line beside it at the dock payout site. It is
the single most direct fix for "score conflates deliveries, kills and refund bonuses" — with it,
delivery income and everything else separate exactly. Noted for the record: this is a sixth
suggestion rather than one of the original five, admitted deliberately.

**FORK-D — the lever fingerprint's carrier. → `#`-PREFIXED COMMENT LINES above the CSV header**,
one `key=value` per line. Pandas, R and most sheet importers skip `#` lines with one argument, so
the CSV stays a CSV. **Refused options recorded, with reasons:** a separate clipboard block (gets
separated from its data the first time someone pastes into two files); extra columns (repeats one
constant 400 times); a separate export action row (two things to remember to press).

**FORK-E — edited values or effective values? → EFFECTIVE**, i.e. what `DEBUG` actually resolves to,
plus one explicit `overrides=ON|OFF` line.
⚠ **SETTLED — this is the one most likely to be "helpfully" reverted.** With the master overrides
toggle OFF, every gameplay knob reads its own `def` no matter what the panel displays. A fingerprint
listing shown-but-inert edits would be actively misleading, and would be believed — the same failure
mode the CS038 P3 `sessionSwitch` comment already warns about for `telemetryCapture`. "Surely it
should show what the panel shows" is the wrong instinct here. P4 pins this in `CLAUDE.md`.

**FORK-F — fingerprint contents. → `GAME_VERSION`, `overrides`, the resolved `telemetryInterval`,
the row count, the source, and the lever list. NO PROFILE NAME OR ID.**
**Refused option recorded:** profile identity. A telemetry log gets pasted into chats and files; it
does not need to identify a player, and the analysis never reads it.

**FORK-G — the cheap extra columns (no new counter needed; one `TELEMETRY_FIELDS` entry plus one
`push()` line each). → FIRST THREE IN, LAST THREE OUT.**

| Field | What it measures | Decision |
|---|---|---|
| `cargoDamageEvents` | unguarded chain severs — cargo actually lost | **IN** — the tow loop is the game, and this is its failure counter |
| `hunterCoalesced` | Hunters born from neglected scrap | **IN** — the Kessler premise, currently invisible in the log |
| `deflects` | hits absorbed by the shield | **IN** — explains HP that *didn't* get taken |
| `largeHunterKills` | large cores only | **OUT** — achievement-shaped; `hunterKills` covers the analysis need |
| `smallSaucerKills` | small saucers only | **OUT** — same |
| `bestCombo` / `pacifistBest` | achievement maxima | **OUT** — not rates, not states |


## P1 — Five new per-run counters (no output change)

**Model:** Sonnet, high effort.

```
You are implementing CS039 Phase 1 of Orbital Overhaul. The whole game ships as one file,
orbital-overhaul.html.

Scope: FIVE new per-run counters on game.stats. NOTHING reads them this phase — no telemetry
column, no HUD, no leaderboard, no achievement. This phase is deliberately invisible in play and
in every export. P2 consumes them.

--- ORIENT FIRST (grep by symbol; never trust a line number) ---

  grep -n "function resetGameStats" orbital-overhaul.html
  grep -n "function damageShip" orbital-overhaul.html
  grep -n "function addScore" orbital-overhaul.html
  grep -n "function applyPowerup" orbital-overhaul.html
  grep -n "function destroyHunter" orbital-overhaul.html
  grep -n "hunterLineageKills\|largeHunterKills" orbital-overhaul.html
  grep -n "REPAIR_FULL_BONUS\|SCOOP_MAX_BONUS" orbital-overhaul.html
  grep -n "Achievements.lifetime.deliveryScore" orbital-overhaul.html
  grep -n "function buildSaveEntry\|function resumeFromSave" orbital-overhaul.html

Read resetGameStats() in full first — the CS037 P4 comment block above the six *Picked counters
explains why these are FLAT NUMBER fields and not a nested object. Follow it exactly.

--- WHAT TO BUILD ---

Five fields in resetGameStats(), each incremented at EXACTLY ONE site:

1. `hunterKills: 0` — every Hunter destroyed by the player, ALL THREE TIERS.
   Site: destroyHunter's existing achievement-stats block, inside the SAME `awardScore` gate that
   already guards hunterLineageKills / largeHunterKills / Achievements.lifetime.hunterKills. It must
   sit with them, not beside them outside the gate — the "dying"-state chain detonations pass
   awardScore=false and must move no counter.
   ⛔ Write a comment: this counter exists for offline telemetry. `hunter_kills` IS a registered
   statsField on the leaderboard Worker and is deliberately still unsent — wiring it into
   Leaderboard.submit() is an OPEN, UN-TAKEN decision, not an oversight this phase forgot.
   Do NOT touch Leaderboard.submit() or makeRunResult().

2. `hitsTaken: 0` — non-lethal hits that actually deducted HP.
   Site: damageShip, in the same block as the ten `case "debris3": … dmgFromDebris3 += amount`
   attribution switch, on the path where HP is actually deducted. Read that function carefully
   first: a shielded / i-frame hit early-returns BEFORE the attribution switch, and this counter
   must land on exactly the same side of that return as the dmgFrom* sums. If it does not, the
   ten sums and this total describe different populations and every "mean damage per hit" derived
   from them offline is wrong. That agreement IS the feature.

3. `deliveryScore: 0` — points earned at the recycle dock this run.
   Site: the dock delivery block, one line beside the existing
   `Achievements.lifetime.deliveryScore += pts;`. Same `pts`, same place. Do not recompute it.

4. `scoreRepairBonus: 0` — cumulative REPAIR_FULL_BONUS awarded.
   Site: addScore()'s milestone branch, in the else arm where the ship is already at full HP.
   Note in the comment that this arm adds to game.score DIRECTLY (`game.score += REPAIR_FULL_BONUS`)
   rather than recursing through addScore, so the counter cannot double-count.

5. `scoreScoopBonus: 0` — cumulative SCOOP_MAX_BONUS awarded.
   Site: applyPowerup()'s scoop branch, the else arm where scoopLevel is already at SCOOP_MAX_LEVEL.
   Note in the comment that this one DOES go through addScore(SCOOP_MAX_BONUS), so it can itself
   trip a repair milestone — the two bonus counters are not symmetric code, and that is fine.

⛔ ALL FIVE ARE FLAT NUMBERS. That is what makes buildSaveEntry()'s spread and resumeFromSave()'s
known-key type-matched `for (const k in game.stats)` loop carry them with no edit at either site.
Verify that by reading both functions — do NOT add a special case, and do NOT edit either function.
If you find yourself wanting to, stop: something is wrong with the field shape.

--- TEST ---
New scratchpad/test-cs039-p1.js on _harness.js. Use the real startGame / update(1/60) paths.
Pin:
  - resetGameStats() returns all five at 0, and resetRun() clears them mid-run.
  - hitsTaken agrees EXACTLY with the dmgFrom* population: drive a set of hits of known sources and
    assert hitsTaken equals the number of attributed hits, then assert a shielded / i-frame hit
    moves NEITHER hitsTaken nor any dmgFrom* sum.
  - hunterKills counts all three tiers; a destroyHunter call with awardScore=false moves nothing.
  - deliveryScore equals the sum of the pts actually added across a multi-canister dock visit.
  - scoreRepairBonus moves only when a milestone lands at full HP, and scoreScoopBonus only when a
    scoop pickup lands at SCOOP_MAX_LEVEL. Assert each is still 0 in the opposite case.
  - Save/resume round-trip: set all five to non-zero, buildSaveEntry(), resumeFromSave(), all five
    come back with no edit to either function.
  - NO OUTPUT CHANGED: TELEMETRY_FIELDS is byte-identical, the CSV header is byte-identical, and
    Leaderboard.submit()'s stats object still has exactly its four existing keys.

Run node scratchpad/run-all.js.

--- DOCS ---
None (the closing phase sweeps). Leave GAME_VERSION alone. Do not commit; do not push.
```

---

## P2 — Telemetry schema extension, one shape, one envelope bump

**Model:** Sonnet, high effort.

```
You are implementing CS039 Phase 2 of Orbital Overhaul. The whole game ships as one file,
orbital-overhaul.html. CS039 P1 must already be in the tree — this phase reads counters it created.

Scope: extend the telemetry row with thirteen columns and bump the persistence envelope ONCE.
No new counters (P1 made them). No change to cadence, capture gating, ring size, or the export
action row.

--- ORIENT FIRST ---

  grep -n "const TELEMETRY_FIELDS" orbital-overhaul.html
  grep -n "const TELEMETRY_MAX\|const TELEMETRY_KEY\|const Telemetry" orbital-overhaul.html
  grep -n "function telemetryCSV\|function telemetryExportRows\|function copyTelemetry" orbital-overhaul.html
  grep -n "const DIFFLOG_FIELDS\|function logDifficultySnapshot" orbital-overhaul.html
  grep -n "function payloadSlots\|cargoMax" orbital-overhaul.html

Read the whole Telemetry block header comment, and read DIFFLOG_FIELDS beside it — DiffLog already
logs chainLen / cargoMax / scoopLevel from exactly the expressions this phase copies. Use the same
expressions; do not invent new ones.

--- WHAT TO BUILD ---

1. THIRTEEN new entries in TELEMETRY_FIELDS, appended in this order, BEFORE the two trailing
   debugRun / resumedRun flags (the flags stay last — several existing consumers read the tail):

     "chainLen", "cargoMax",
     "delivered", "deliveryScore", "cargoDamageEvents",
     "debrisKills", "hunterKills", "saucerKills", "hunterCoalesced",
     "deflects", "hitsTaken",
     "scoreRepairBonus", "scoreScoopBonus",

   TELEMETRY_FIELDS is the ONE source of truth for both the row shape and the CSV column order.
   Adding a key here and forgetting push() yields a column of `undefined` — add both together.

2. The matching lines in Telemetry.push():

     chainLen: game.chain.length,        // the DiffLog expression, verbatim
     cargoMax: game.cargoMax,            // the live runtime cap, NOT payloadSlots(game.wave)
                                         // recomputed — the two must never be two sources of truth
     delivered: s.delivered,
     deliveryScore: s.deliveryScore,
     cargoDamageEvents: s.cargoDamageEvents,
     debrisKills: s.debrisKills,         // Garbage Satellites — the inverted vocabulary, see CLAUDE.md
     hunterKills: s.hunterKills,
     saucerKills: s.saucerKills,         // both sizes
     hunterCoalesced: s.hunterCoalesced,
     deflects: s.deflects,
     hitsTaken: s.hitsTaken,
     scoreRepairBonus: s.scoreRepairBonus,
     scoreScoopBonus: s.scoreScoopBonus,

   Write a short comment naming the two KINDS in the row, because an offline reader has to know
   which is which and cannot tell from the name: `chainLen` and `cargoMax` are INSTANTANEOUS state
   at the sample instant (like hp and speed); every other new column is a CUMULATIVE per-run counter
   (like the *Picked and dmgFrom* families) and is monotone non-decreasing within a run.

3. ⛔ THE ENVELOPE BUMPS TO `v: 2`, IN BOTH read() AND write(), AND EXACTLY ONCE FOR THE WHOLE
   CHANGESET. read()'s existing `data.v !== 1` guard becomes `data.v !== 2`, which makes a stored
   v1 blob resolve to an EMPTY buffer under the known-value-else-default rule already documented
   there. That is the correct and intended outcome: a v1 row has none of these thirteen keys, and
   telemetryCSV would emit the literal string "undefined" in thirteen columns for it. Silently
   dropping a stale run beats exporting a corrupt one.

   ⛔ THE localStorage KEY NAME DOES NOT CHANGE. It stays `afd_telemetry_v1`. The `_v1` in the key
   and the `v:` in the envelope are different things, and the five storage keys are frozen
   (CLAUDE.md, Save data). Do not "tidy" the key to match the envelope.

   ⛔ Any further row-shape change inside CS039 must reuse v2, not add v3. One shape per changeset.
   If a later phase needs another column, it goes in HERE, in this phase.

4. Nothing else moves. TELEMETRY_MAX stays 400. Telemetry.tick()'s Bench.running and
   DEBUG.telemetryCapture gates are untouched. telemetryExportRows(), copyTelemetry(),
   telemetryDownload() and the "Copy telemetry log" action row are untouched. DIFFLOG_FIELDS and
   logDifficultySnapshot() are untouched — the two logs stay siblings, not one merged thing.

--- TEST ---
New scratchpad/test-cs039-p2.js on _harness.js, driving real startGame / nextWave / update(1/60).
Pin:
  - TELEMETRY_FIELDS length grew by exactly 13, debugRun/resumedRun are still the last two entries,
    and no existing field changed name or position.
  - Every key in TELEMETRY_FIELDS is present on a pushed row — assert this by iterating
    TELEMETRY_FIELDS against the row object, so the test cannot go stale when the list next grows.
  - telemetryCSV's header line has the same number of columns as every data line, and NO cell is
    the string "undefined".
  - cargoMax in the row equals game.cargoMax after a nextWave() that changes it (drive past a wave
    boundary that moves payloadSlots), NOT a recomputed value.
  - chainLen tracks a real tow: hook pieces, assert the column moves, break the chain, assert it drops.
  - The cumulative columns are monotone non-decreasing across a multi-sample run.
  - ENVELOPE: write() emits v:2; read() returns [] for a seeded v:1 blob and returns the rows for a
    seeded v:2 blob; the storage key read and written is Profiles.keyFor("afd_telemetry_v1") at both
    sites, unchanged.
Find and update any existing test that pins the telemetry column count or the CSV header:
  grep -rn "TELEMETRY_FIELDS\|telemetryCSV\|afd_telemetry" scratchpad/*.js
Read the live list for the new count; do not compute it from a stale number.

Run node scratchpad/run-all.js.

--- DOCS ---
None (the closing phase sweeps). Leave GAME_VERSION alone. Do not commit; do not push.
```

---

## P3 — Lever fingerprint on the export

**Model:** Opus, high effort, thinking on.

```
ultrathink

You are implementing CS039 Phase 3 of Orbital Overhaul. The whole game ships as one file,
orbital-overhaul.html. Independent of P1/P2 — it may land before or after either.

Scope: the telemetry export gains a small header block naming the build and every knob that is NOT
at its registry default, so two logs can be compared without asking what the debug panel looked like.
No new registry row, no new action row, no gameplay change.

--- ORIENT FIRST ---

  grep -n "const DEBUG_VARS\|const DEBUG_ENTRIES\|const DEBUG_ROWS" orbital-overhaul.html
  grep -n "const DEBUG = \|const debugShown" orbital-overhaul.html
  grep -n "const DEBUG_OVERRIDE_ID\|function overridesOn\|function debugNative\|function rebuildDebug" orbital-overhaul.html
  grep -n "sessionSwitch" orbital-overhaul.html
  grep -n "function telemetryCSV\|function copyTelemetry\|function telemetryDownload" orbital-overhaul.html
  grep -n "const GAME_VERSION" orbital-overhaul.html
  grep -n "boolLabels" orbital-overhaul.html

Read the DEBUG / debugShown / toNative / clampShown / overridesOn block above DEBUG_VARS in full
before writing anything. The distinction between debugShown (edited display value), e.def (registry
default) and DEBUG (resolved native value) is the whole phase.

--- WHAT TO BUILD ---

1. A new function, telemetryHeaderLines(), returning an array of strings. Each line is `#` + a
   `key=value` pair. Exactly these, in order:

     # orbital-overhaul telemetry v2
     # build=<GAME_VERSION>
     # overrides=ON|OFF
     # telemetryInterval=<the resolved DEBUG value>
     # rows=<row count>
     # source=this run|storage
     # levers=<none | id=value id=value …>

2. ⛔ THE `levers=` LINE REPORTS EFFECTIVE VALUES, NOT EDITED ONES. Walk DEBUG_ENTRIES and, for each
   entry, compare the value the game is ACTUALLY USING against e.def. The value the game is actually
   using is what debugNative(e, debugShown[e.id], on) resolves to under the CURRENT overridesOn()
   state — read it the same way rebuildDebug() does, not by reading debugShown directly.

   This is the part that is easy to get wrong and is the reason the phase is Opus. With the master
   "Overrides Applied" toggle OFF, every gameplay knob resolves to its own e.def no matter what the
   panel displays. A fingerprint built from debugShown would then list a dozen "non-default" levers
   for a run that used none of them — worse than no fingerprint, because it would be believed. With
   overrides OFF and no sessionSwitch row changed, the line must read `levers=none`.

   A `sessionSwitch: true` row (telemetryCapture) is EXEMPT from overridesOn() and resolves from its
   own debugShown — so it can legitimately differ from def while `overrides=OFF`. Report it like any
   other entry; the exemption is already in debugNative and you must go through debugNative rather
   than reimplementing the rule.

3. Compare with a small epsilon, not `!==`. Several entries are floats with toNative conversions and
   a bare inequality will report a knob as changed because it round-tripped to 0.30000000000000004.
   Say so in a comment.

4. Wire it in telemetryCSV(), as lines PREPENDED above the existing header line. The `#` prefix is
   the whole compatibility story and belongs in the comment: pandas/R/most sheet importers skip
   comment lines with one argument, so the CSV stays a CSV. Do NOT emit the fingerprint as extra
   columns (400 rows repeating one constant) and do NOT add a second export action row (two things
   to remember to press).

   telemetryCSV currently takes only `rows`. It now also needs the source string for the `source=`
   line — thread it through from telemetryExportRows()'s existing `{ rows, from }` return rather
   than reaching for a global. Both callers (copyTelemetry's clipboard path and its download
   fallback) must get the identical text; build it once and pass it to both, exactly as copyTelemetry
   already does.

5. ⛔ NO PROFILE NAME OR ID IN THE HEADER. A telemetry log gets pasted into chats and files; it does
   not need to identify a player, and the analysis never reads it. Write that as a comment so it is
   not "helpfully" added later.

--- TEST ---
New scratchpad/test-cs039-p3.js on _harness.js. Pin:
  - Default state: the header contains `levers=none` and `overrides=OFF` (or ON, whichever a fresh
    boot actually gives — read it, do not assume), and the line count is exactly the seven above.
  - Change one gameplay knob with overrides ON: it appears in `levers=` with its resolved value, and
    no other knob does.
  - THE TRAP TEST, which is the point of the phase: change several gameplay knobs, then turn
    overrides OFF. `levers=` must go back to `none` — the game is not using those edits.
  - A sessionSwitch row (telemetryCapture) set to 1 with overrides OFF DOES appear, because it is
    exempt. Assert both halves of that in one test so the exemption cannot silently invert.
  - Every emitted line starts with "#", and the first non-# line is exactly the TELEMETRY_FIELDS
    header — assert by splitting the real telemetryCSV output, not by inspecting the function.
  - A float knob left untouched is NOT reported (the epsilon guard).
  - The download fallback and the clipboard path receive byte-identical text.

Run node scratchpad/run-all.js.

--- DOCS ---
None (the closing phase sweeps). Leave GAME_VERSION alone. Do not commit; do not push.
```

---

## GATE T — capture a run and re-run the analysis (blocks P4)

Not a code phase. Paul, in the browser, on the P1–P3 build:

1. Debug panel → **Telemetry capture ON**, interval left at 15.
2. Play one run to death, ideally long enough to reach wave 10+ (the previous log's interesting
   material was all late).
3. **Copy telemetry log** at the game-over screen, before starting another run — the buffer is
   per-run and `resetRun()` clears it.
4. Hand the log plus `TELEMETRY-ANALYSIS-GUIDE.md` to a claude.ai thread.

**What the gate is checking**, and the answers to write down as numbers, not yes/no:

- **T1.** Does the `#` header survive the clipboard round-trip and parse cleanly? (If a sheet or
  pandas chokes, FORK-D was wrong and P3 needs a different carrier.)
- **T2.** `score` vs `deliveryScore + scoreRepairBonus + scoreScoopBonus` — what fraction of the run's
  score is delivery income, what fraction is the two refund bonuses, and what is the residual
  (kills and everything else)? The previous run's ~14%-from-`REPAIR_FULL_BONUS` was an estimate;
  this is the measurement that either confirms or kills it.
- **T3.** Does `hitsTaken` equal the reconstructed hit count from the ten `dmgFrom*` sums divided by
  their damage constants? They should agree exactly. A mismatch means P1's counter landed on the
  wrong side of the shield/i-frame early return.
- **T4.** Does `chainLen` show the death spiral the previous analysis could only infer — i.e. does
  mean tow length collapse in the same window where score rate collapses?
- **T5.** `hunterCoalesced` over the run: is the Kessler loop actually firing, and at what rate per
  wave?

### ✅ GATE T — CLOSED. Recorded answers (2026-08-20)

Log: `LEVEL-5-TELEMETRY.csv` at the repo root — 53 rows, waves 1–5, 795 s of game time, final score
133,185, ended at 35 HP. Header `overrides=ON` / `levers=telemetryCapture=1`: the only effective
non-default knob is the `sessionSwitch` capture switch itself, so **tuning was stock and the run is
comparable**. `debugRun`/`resumedRun` false in every row. Not ring-truncated (53 of 400, `t[0]` ≈
interval), so every total is exact rather than a floor. Cadence σ 0.0016 s, no dropped snapshots.
⛔ These answers are pre-`cargoSevers`: the log is a **v2** capture, which is what surfaced T-DEFECT
below.

- **T1 — PASS, FORK-D holds.** 43 columns matching `TELEMETRY_FIELDS` exactly; 7 `#` lines + header
  + 53 data rows; ASCII/LF, no BOM, no CR, no quotes, no embedded delimiters, no blank lines,
  uniform field counts, and **no `#` anywhere after the header block** (which is what makes pandas'
  truncate-at-first-`#` safe). `rows=53` matches the row count. Sheets/Excel do **not** treat `#`
  as a comment and land the 7 lines as single-cell rows above the header — a delete-rows-1–7 step,
  not a choke. No carrier change needed.
- **T2 — the ~14% estimate is KILLED; measured 3.75%.** `deliveryScore` 34,825 (**26.15%**),
  `scoreRepairBonus` 5,000 (**3.75%**, exactly 2 × `REPAIR_FULL_BONUS`), `scoreScoopBonus` 500
  (**0.38%**), residual **92,860 (69.72%)**. The books close independently: 13 milestones crossed,
  2 paid the bonus, 11 healed at 25 HP = 275, total healing applied 680, so health pickups supplied
  405 of a possible 475 with 70 HP lost to the cap. The residual is overwhelmingly **Hunter kills** —
  337 × the 2,900-per-13-kill lineage mix ≈ 75,176, i.e. **~56% of the whole run's score from Hunters
  alone**, against 26% from delivery. Delivery is a minority income stream in this run.
- **T3 — EXACT.** 895 HP over the ten sums reconstructs to **28 hits**; `hitsTaken` = **28**. Every
  sum divides integrally by its constant. P1's counter is on the correct side of the
  shield/i-frame/lethal early returns. `deflects` = 5, so the shield absorbed 15.2% of 33 contacts.
  Both `dmgUfoBody*` are zero — no saucer was ever rammed all run.
- **T4 — NO, and the sign points the other way.** ρ(`chainLen`, Δscore) = **−0.09** whole run,
  **−0.11** inside wave 5. Mean tow by wave **3.0 → 3.6 → 5.7 → 5.1 → 5.6** — it rises and never
  collapses. Score rate is a function of Hunter kills: ρ(Δ`hunterKills`, Δscore) = **+0.82** whole
  run, **+0.99** in wave 5. The worst rolling-3 window (t 690–720, 17.8 pts/s vs 334 at best) had
  mean `chainLen` **7.0 on a cap of 10**, and there is a **105 s delivery drought** (t 645–750) with
  the chain at 10/10 in five of seven samples. The failure mode is cargo accumulating and **not
  moving** under hull pressure, not a tow collapse. n=1 — wants a second log before generalising.
- **T5 — FIRING, and accelerating.** 34 coalescences in 13.25 min = **2.57/min**; per wave **0.67 /
  1.71 / 2.33 / 2.50 / 4.33** per minute, monotone rising, wave 5 at 6.5× wave 1.
  `hunterKills/hunterCoalesced` = **9.91**, so ~76% of each 13-kill lineage is cleared. Hunters are
  also the dominant threat: `dmgHunter*` = 585 of 895 HP (**65%** of all damage), vs 31% Garbage
  Satellites and 3% saucer shots. They pay ~56% of the score and charge 65% of the damage.

### ⛔ T-DEFECT — `cargoDamageEvents` was never cumulative. Fixed at the gate.

The one integrity check that failed: **7 decreases in 53 rows, last row 0.** It is the chain-guard
drop-weight PITY counter, zeroed in `dropPowerup()` when a guard is *selected to drop* (CS035 P6 /
FORK-T — not on pickup, hence 7 resets against 6 `guardPicked`). It counts severs since the last
guard drop, never the run.

⚠ **It was described as cumulative in FOUR places at once** — §P2 step 2 of this document, the
build's comment above `TELEMETRY_FIELDS`, `test-cs039-p2.js` §F, and `TELEMETRY-ANALYSIS-GUIDE.md`
§3 — and §F passed for a whole changeset because it drove the counters by hand and never reached
the reset path. **The §P2 text above is left as written**: it is the record of what was specified,
and correcting it in place would hide how a wrong claim propagated into three artefacts unchallenged.
Read it with this section attached.

**Applied at the gate** (Paul's call — see `DECISIONS.md`, retire into `log/CS039.md` at P4):

1. `game.stats.cargoSevers` — a genuine cumulative run total, incremented on the line below
   `cargoDamageEvents++` in `breakChain()`'s sever path, reset nowhere else. Emitted as a **44th**
   telemetry column immediately after the pity counter. Both ship: `guardDropWeight()` needs the
   pity value, an analysis needs the total.
2. ⛔ **Envelope → `v: 3`**, overriding §P2 step 3's "reuse v2, one shape per changeset". Full
   reasoning in `DECISIONS.md`; the short form is that P2's own stated reason for versioning (never
   export an `undefined` column from a stale blob) beat its letter. **`afd_telemetry_v1` is
   unchanged** — the key name and the envelope `v` are different things.
3. `test-cs039-p2.js` §H — the section §F could not be: it drives the real `breakChain()` sever and
   `dropPowerup()` reset, and pins that `guardPicked` does **not** move when the pity counter zeroes.
4. `TELEMETRY-ANALYSIS-GUIDE.md` — a third "neither" kind in §3, a §7 trap, the §2.3 monotonicity
   exception, and a v2 lower-bound reconstruction recipe for logs captured before this change.
5. Reconstructed from this (v2) log: **≥26 severs** across 7 guard drops — a floor, not a total.
   Per wave ≥ 1 / 1 / 10 / 7 / 7.

**Not done, for P4 to note:** this run is waves 1–5, not the wave 10+ the gate asked for, so the
late-game material the previous analysis found interesting is still uncaptured. A second log — on
the v3 build, ideally deeper — would turn T4's n=1 observation into something actionable.

---

## P4 — Doc sweep, version bump, changeset close

**Model:** Sonnet, high effort.

```
You are implementing CS039's closing phase for Orbital Overhaul. All code phases (P1–P3) are in the
tree and GATE T is cleared.

Scope: documentation, version bump, archive. No behaviour change of any kind.

--- ORIENT FIRST ---

  grep -n "const GAME_VERSION" orbital-overhaul.html
  ls log/
  grep -n "Telemetry\|telemetry" CLAUDE.md ORBITAL-OVERHAUL-GDD.md STATUS.md

--- WHAT TO DO ---

1. GAME_VERSION bump. Read the current value from the file; do not compute it from a number in this
   prompt.

2. STATUS.md: new CS039 phase ledger (P1, P2, P3, GATE T with Paul's recorded answers, this phase).
   Update the header line's Changeset / Phase / Registry / Levers — READ THE LIVE REGISTRY for the
   counts, do not copy a number from a previous changeset. CS039 adds no registry row, so Registry
   and Levers should be unchanged from CS038's close; assert that rather than assuming it.
   Prune STATUS.md back to roughly the last three changesets, moving older content to log/.
   ⛔ Never allow two entries on the same physical line (the shell-append trailing-newline pitfall).

3. New log/CS039.md with the per-changeset record, including §0's corrections and §1's fork
   resolutions verbatim — a refused option needs its reason on the record so it cannot be
   re-proposed without acknowledging it.

4. CLAUDE.md: add a short pin under the telemetry material stating that TELEMETRY_FIELDS is the one
   source of truth for row shape AND CSV column order, that a row-shape change bumps the ENVELOPE
   `v` and never the storage KEY name, and that the fingerprint reports EFFECTIVE lever values
   (FORK-E) — with a ⚠ SETTLED marker on the last one, because "surely it should show what the panel
   shows" is exactly the kind of thing that gets helpfully reverted.

5. GDD: §2 describes SHIPPED behaviour only. Telemetry is a dev instrument, not player-facing
   behaviour — check whether the GDD mentions it at all before adding anything, and if it does not,
   do not start now.

6. Archive the spent planning docs to log/ if any exist for CS039.

7. ⛔ Do not write a "no design doc was touched" pin (standing CLAUDE.md rule).

--- TEST ---
Full suite at ZERO SKIPS: node scratchpad/run-all.js. Flip any phase-local version pin to its
post-bump value. Report the file/pass/fail/skip counts in the session summary.

Do not commit; do not push.
```