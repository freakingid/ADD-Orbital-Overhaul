# IMPLEMENTATION-PHASES-CS040.md

**Reads with:** `PLANNED-FEATURES-CS040.md` (spec). Every `§` reference below points there.
**Base:** `1ee9eed`, `GAME_VERSION 1.0.0.39` → `1.0.0.40` at P8.

**Standing rules for every phase:**

- One Claude Code session per phase. One commit per phase. **Claude Code never pushes** — Paul commits and pushes.
- Fresh `git clone --depth 1` at the start of every session. Never trust cached state.
- Navigate the single-file build with `grep -n 'symbolName'` + `sed -n 'START,ENDp'`. **Anchor by symbol name, never by line number** — line numbers drift within a session.
- Check `DEBUG_VARS` and the `LEVERS` count at the start of each session as the state-of-build indicator.
- Forks are **not** resolved inside a session. If a prompt hits an unresolved fork, stop and report.

**Prerequisite before P1:** run the standalone `PROMPT-guide-update.md` (v3 corrections). Those land against v3 and should not be tangled with P8's v4 work.

**All four forks and all six flags are RESOLVED** — see `PLANNED-FEATURES-CS040.md` §5 and §6. No phase below is blocked. A resolved fork cannot be re-opened inside a session; if a prompt seems to conflict with a resolution, stop and report rather than choosing.

| fork | resolution | phase |
|---|---|---|
| FORK-CS040-A | keep `AudioSys.shieldPing()`, gated on the spawn actually happening | P1 |
| FORK-CS040-B | `REPAIR_MILESTONE` stays 10,000 | P1 |
| FORK-CS040-C | c1 — weighted, `HUB_DRY_WEIGHT_MULT = 4` | P4 |
| FORK-CS040-D | `TELEMETRY_MAX` → 800; persist every 4th snapshot | P5 |

⚠️ **FLAG-CS040-d was overridden:** a simple HUD tell for the banked charge **is** required. P3 is structural, not audio-only.

---

## Phase map

| phase | content | model / effort | gate |
|---|---|---|---|
| P1 | Healing core — milestone becomes a conditional spawn | Opus, `ultrathink` | |
| P2 | Pity-driven ambient health cadence | Sonnet, standard | |
| P3 | Health banking + auto-spend SFX | Opus, `ultrathink` | |
| P4 | Recycle-hub resupply weighting | Sonnet, standard | |
| P5 | Telemetry v4 — schema, flush, header | Opus, `ultrathink` | |
| P6 | Options telemetry submenu; debug panel rows retired | Sonnet, standard | |
| **GATE T** | **blocking playtest** | — | ⛔ |
| P7 | Tuning pass from GATE T | Sonnet, standard | |
| P8 | Doc sweep, guide v4, version bump, archive | Sonnet, standard | |

P7 exists because §1.5 predicts the four gap constants will need a pass. If GATE T finds them right, P7 is a no-op commit and that is a fine outcome.

---

## P1 — Healing core

**Commit:** `cs040 p1: milestone spawns health instead of healing`

```
Fresh clone first:
  git clone --depth 1 https://github.com/freakingid/ADD-Orbital-Overhaul /tmp/adorb
  cd /tmp/adorb && git log -1 --oneline

ultrathink

Read PLANNED-FEATURES-CS040.md §1.1 and §1.2 before editing anything.

Grep these and read each site fully before you change one character:
  grep -n "REPAIR_MILESTONE\|REPAIR_AMOUNT\|REPAIR_FULL_BONUS" orbital-overhaul.html
  grep -n "scoreRepairBonus" orbital-overhaul.html
  grep -n "function addScore" -A 25 orbital-overhaul.html
  grep -n "function spawnHealthPowerup" -A 8 orbital-overhaul.html
  grep -n "ship\.hp *=" orbital-overhaul.html

That last grep must return exactly three sites: the loadSlot restore, addScore's milestone arm,
and applyPowerup's health arm. If it returns more, STOP and report — the spec's premise is wrong.

CHANGE 1 — addScore()'s milestone arm.
  Keep REPAIR_MILESTONE and game.nextRepair exactly as they are, including the `nextRepair +=`
  advance, which must happen on EVERY crossing regardless of hull.
  Replace the two-armed if/else with:
    - hp < SHIP_MAX_HP  -> call spawnHealthPowerup()
    - hp === SHIP_MAX_HP -> do nothing
  Do not add a second placement path. spawnHealthPowerup() already picks a random angle and a
  distance in [POWERUP_HEALTH_MIN_DIST, POWERUP_HEALTH_MAX_DIST] and wraps the result. Reuse it.

  FORK-CS040-A is RESOLVED: KEEP the AudioSys.shieldPing() call, but move it inside the spawn arm so
  it fires only when a health powerup actually spawns. At full hull the milestone does nothing, so it
  must also make no sound.
  FORK-CS040-B is RESOLVED: REPAIR_MILESTONE stays at 10,000. Do not change it.

CHANGE 2 — retire three symbols outright, do not leave them dormant.
  - REPAIR_AMOUNT (const)
  - REPAIR_FULL_BONUS (const)
  - game.stats.scoreRepairBonus (the counter, its resetGameStats() initialiser, and its increment)
  Grep each by name AFTER deleting to prove zero remaining consumers. The telemetry COLUMN
  scoreRepairBonus is P5's job, not yours -- leave TELEMETRY_FIELDS alone this phase. If the
  build will not run with the column referencing a deleted counter, emit 0 for it and leave a
  comment saying P5 removes the column; do not remove the column here.

  REPAIR_MILESTONE STAYS -- it has a live consumer.

CHANGE 3 — leave a comment block at addScore()'s milestone arm recording WHY, in the build's own
voice: milestone healing supplied 63%/62% of all healing across the 08-23 and 08-26 captures, and
removing it without the §1.3 cadence and §1.4 banking killed both simulated runs at waves 4 and 9.
State that the full-hull gate is deliberate (a milestone must not be generous when the player is
safest) and that REPAIR_AMOUNT/REPAIR_FULL_BONUS were deleted, not parked, so a future reader does
not "restore" them.

TESTS — add to the suite:
  - crossing a milestone below max hull spawns exactly one health powerup
  - crossing at exactly SHIP_MAX_HP spawns nothing and awards no score
  - nextRepair advances by REPAIR_MILESTONE in BOTH cases
  - score no longer changes as a side effect of any milestone crossing

Run the whole suite. Report every edit, every deleted symbol with its proof-of-zero-consumers grep,
and any place the build contradicted this prompt.
```

---

## P2 — Pity-driven health cadence

**Commit:** `cs040 p2: health spawn cadence scales with missing hull`

```
Fresh clone. Read PLANNED-FEATURES-CS040.md §1.3.

Grep:
  grep -n "POWERUP_HEALTH_GAP" orbital-overhaul.html
  grep -n "healthTimer" orbital-overhaul.html
  grep -n "function guardDropWeight" -A 6 orbital-overhaul.html   # the idiom to mirror

Retire POWERUP_HEALTH_GAP. Replace with four consts in the same place:
  HEALTH_GAP_LOW_OK    = 22
  HEALTH_GAP_HIGH_OK   = 30
  HEALTH_GAP_LOW_HURT  =  6
  HEALTH_GAP_HIGH_HURT = 10

Add healthGapRoll() next to guardDropWeight() -- same shape, same "pressure-driven, clamped at both
ends" comment style:
  frac = clamp01(game.ship.hp / SHIP_MAX_HP)
  lo   = lerp(HEALTH_GAP_LOW_HURT,  HEALTH_GAP_LOW_OK,  frac)
  hi   = lerp(HEALTH_GAP_HIGH_HURT, HEALTH_GAP_HIGH_OK, frac)
  return rand(lo, hi)

Repoint BOTH existing re-roll sites (the resetRun seed and the ambient spawn site) at
healthGapRoll(). Grep POWERUP_HEALTH_GAP after the edit to prove zero consumers remain.

⛔ Do NOT add a re-roll on the damage path. The timer re-rolls only where it re-rolls today. A
damage-triggered re-roll would let a player farm spawns by tanking hits -- say so in the comment.

Four registry knobs in the POWERUPS section of DEBUG_VARS, each `def` deriving from its const
(the standing idiom -- the const stays as the documented shipped value). Confirm the LEVERS count
moves by exactly four and report the new number.

TESTS:
  - gap at hp = SHIP_MAX_HP falls in [22, 30]
  - gap at hp = 0 falls in [6, 10]
  - gap at hp = SHIP_MAX_HP/2 falls between the two ranges
  - the roll is monotone non-increasing as hp falls (sample several points)

Run the suite. Report the new LEVERS count.
```

---

## P3 — Health banking

**Commit:** `cs040 p3: health banks at full hull, auto-spends on damage`

```
Fresh clone.

ultrathink

Read PLANNED-FEATURES-CS040.md §1.4 in full, plus FLAG-CS040-a/b/d in §6.

Grep:
  grep -n "function applyPowerup" -A 60 orbital-overhaul.html
  grep -n "POWERUP_HEALTH_AMOUNT" orbital-overhaul.html
  grep -n "function damageShip" -A 40 orbital-overhaul.html
  grep -n "function resetRun" -A 40 orbital-overhaul.html
  grep -n "scoopLevel: game.scoopLevel" -B 10 -A 10 orbital-overhaul.html   # the save envelope
  grep -n "AudioSys = {" -A 5 orbital-overhaul.html

NEW STATE:
  game.healthBank  (0 .. HEALTH_BANK_MAX), HEALTH_BANK_MAX = 2, a registry knob with def from const.
  game.stats.hpWasted (cumulative, integer HP) -- initialised in resetGameStats().

PICKUP, in applyPowerup()'s health arm:
  room      = SHIP_MAX_HP - hp
  applied   = min(POWERUP_HEALTH_AMOUNT, room)
  hp       += applied
  leftover  = POWERUP_HEALTH_AMOUNT - applied
  if leftover > 0:
      if healthBank < HEALTH_BANK_MAX: healthBank++          // one charge, worth POWERUP_HEALTH_AMOUNT
      else:                            stats.hpWasted += leftover
  healthPicked still increments exactly as it does today -- do not move or duplicate it.

  ⛔ A charge is a WHOLE charge worth POWERUP_HEALTH_AMOUNT, not a partial-HP reserve. A pickup at
  240/250 applies 10 and banks a full charge. That is deliberate: a fractional bank is unreadable
  to the player and untunable for us. Comment it.

AUTO-SPEND: at the point hull drops below max on a damage event, if healthBank > 0, spend ONE
charge (hp += POWERUP_HEALTH_AMOUNT, clamped to SHIP_MAX_HP) and decrement.
  ⛔ ONE charge per damage event, never a drain to full (FLAG-CS040-b). A single hit must not
  evaporate the whole reserve.
  ⛔ Find the ONE choke point where hull is reduced -- the same site that already routes the
  per-source dmgFrom* attribution -- and put the spend there. Do not scatter it across call sites.
  ⛔ The spend must not re-enter the damage path or fire the damage SFX/shake again.

AUDIO: one new AudioSys method for the auto-spend moment. It must be audibly distinct from
AudioSys.powerup() (the pickup) and from whatever FORK-CS040-A left on the milestone. NO voice
line, no VOICE_LINES edit, no phon work -- this changeset touches no voice data at all.

SAVE/LOAD: healthBank is ADDITIVE state in the existing envelope, read known-value-else-default via
the num() idiom, clamped to [0, HEALTH_BANK_MAX]. ⛔ NO SCHEMA BUMP. afd_settings_v1 /
afd_scores_v1 / afd_achievements_v2 are frozen keys.

RESET: healthBank = 0 in resetRun(). hpWasted = 0 in resetGameStats().

HUD TELL -- REQUIRED THIS PHASE. Read PLANNED-FEATURES-CS040.md §1.5 in full first. Also grep:
  grep -n "function drawRingSegments" -A 10 orbital-overhaul.html
  grep -n "HUD_HULL_CX\|HUD_CARGO_CX\|HUD_RING_R\|HUD_RING_LABEL_Y\|HUD_SHIELD_R_GAP" orbital-overhaul.html
  grep -n "drawRingSegments(40, scoopY" -B 14 orbital-overhaul.html    # the SCOOP row, the idiom to copy

  Draw a short segmented pip row BENEATH the "HULL" text label at HUD_RING_LABEL_Y, using
  drawRingSegments() with HEALTH_BANK_MAX segments and game.healthBank lit. POWERUP_COLOR.health
  when lit, COLOR.dim when not. ALWAYS DRAWN, dim track at zero -- the same always-shown-muted
  convention the SCOOP row uses (FLAG-CS040-f; GATE T decides whether that is clutter).

  ⛔ STROKE ONLY. GDD §3.2's no-fills rule -- the SCOOP row's fill dot was removed for exactly this.
  ⛔ DO NOT draw it as a ring outside HUD_RING_R. HUD_HULL_CX and HUD_CARGO_CX are 76 px apart with
     only 16 px of air between the ring edges; an outer ring eats that from both sides and the two
     clusters read as one object. Measure it in the running build before you commit to geometry.
  ⛔ DO NOT put the tell on the ship. CS025 P3 added a magnet-blue scoop tell on the hull and CS025
     P5 backed it out WHOLE at the playtest gate as unreadable against the hull stroke; the build
     carries an explicit do-not-re-add comment. Persistent state lives in the HUD corners in this
     game. Respect that, and say so in your comment so the next reader does not retry it.

TESTS:
  - pickup at full hull: hp unchanged, bank +1, hpWasted unchanged
  - pickup at 240/250: hp 250, bank +1
  - pickup with bank already at 2 and hull full: hpWasted += POWERUP_HEALTH_AMOUNT, bank stays 2
  - one damage event with bank 2 spends exactly one charge
  - auto-spend clamps at SHIP_MAX_HP and never exceeds it
  - healthBank round-trips through save/load; an OLD save with no healthBank key loads as 0
  - resetRun() clears healthBank; resetGameStats() clears hpWasted
  - HUD pip row renders at bank 0, 1 and 2 with the right lit count
  - the pip row is stroke-only and its bounding box does not overlap the CARGO ring cluster

Run the suite. Report the new LEVERS count and the new AudioSys method name.
```

---

## P4 — Recycle-hub resupply

**Commit:** `cs040 p4: hub drop biases toward an empty budget`

```
Fresh clone. Read PLANNED-FEATURES-CS040.md §2 in full.

FORK-CS040-C is RESOLVED: c1, WEIGHTED. In the hub's call only, multiply the weight of any type whose
game.powerBudget[type] === 0 by HUB_DRY_WEIGHT_MULT (4, a registry knob with def from const). The roll
stays a roll -- do NOT implement the guaranteed variant.

Grep:
  grep -n "game.deliveryCount === 8" -B 12 -A 6 orbital-overhaul.html
  grep -n "function dropPowerup" -A 30 orbital-overhaul.html
  grep -n "function guardDropWeight" -A 6 orbital-overhaul.html
  grep -n "chainGuardMinTow" orbital-overhaul.html

⛔ THE BIAS APPLIES AT THE HUB CALL SITE ONLY. destroyHunter()'s large-core drop and
destroySaucer()'s drop stay exactly as they are. Biasing them would defeat the entire point: a dry
player is not killing anything, so a kill-gated relief valve relieves nothing. Put that sentence in
the comment.

The cleanest shape is an optional parameter on dropPowerup() that only the hub call passes, so the
other two emitters are byte-identical. Do not fork dropPowerup() into two functions.

⛔ Compose with, do not replace, the two existing guard rules:
  - guard's eligibility gate (chain.length >= DEBUG.chainGuardMinTow)
  - guardDropWeight()'s pity substitution in BOTH the total and the walk
⛔ Guard is NOT a budget in the "dry" sense. Do not include it in the dry set -- its budget being 0
is the normal resting state (74-80% of samples across both captures), so treating it as dry would
make every hub drop a guard.

The dry set is the budgeted types whose game.powerBudget[type] === 0: rapid, triple, magnet, engine.

Leave a comment recording the evidence: the dry-weapon split survived the within-wave check in 11
of 13 waves across the two captures (median score/5s 650 vs 1100, and 300 vs 1250), and drops are
kill-gated, so a dry player has no route back to armed. This is the escape hatch.

TESTS:
  - with all four budgets non-zero, the hub roll is statistically indistinguishable from today's
  - with rapid at 0, rapid's hub share rises by the specified rule
  - destroyHunter / destroySaucer drop distributions are UNCHANGED (assert against the flat table)
  - guard eligibility and pity weighting still behave at the hub call
  - guard never enters the dry set

Run the suite.
```

---

## P5 — Telemetry v4

**Commit:** `cs040 p5: telemetry v4 — populations, hpWasted, game-over flush`

```
Fresh clone.

ultrathink

Read PLANNED-FEATURES-CS040.md §3 in full. ⛔ §3.3 is the critical part -- read it twice.

FORK-CS040-D is RESOLVED: TELEMETRY_MAX 400 -> 800, and persist to afd_telemetry_v1 every 4th
snapshot instead of every snapshot.

Grep:
  grep -n "const TELEMETRY_FIELDS" -A 30 orbital-overhaul.html
  grep -n "const Telemetry = {" -A 120 orbital-overhaul.html
  grep -n "TELEMETRY_MAX" orbital-overhaul.html
  grep -n "cargoDamageEvents" orbital-overhaul.html
  grep -n "scoopHits" orbital-overhaul.html
  grep -n "gameEnded = true" -B 8 -A 8 orbital-overhaul.html
  grep -n "orbital-overhaul telemetry v3" -B 4 -A 12 orbital-overhaul.html

TELEMETRY_FIELDS goes 44 -> 49. Read TELEMETRY_FIELDS and Telemetry.push() TOGETHER and edit them
in lockstep -- they are the single source of truth for both row shape and CSV column order.

REMOVE: scoreRepairBonus (P1 deleted its counter).

ADD, instantaneous, inserted with the other instantaneous columns:
  hunterCount   <- game.hunters.length
  debrisCount   <- game.debris.length
  garbageCount  <- game.garbage.length
  healthBanked  <- game.healthBank

⛔ VOCABULARY IS INVERTED ON PURPOSE. game.debris holds GARBAGE SATELLITES (the enemies);
game.garbage holds towable DEBRIS (the salvage). debrisCount therefore counts Garbage Satellites,
consistent with the existing debrisKills and dmgDebris*. Carry the build's own names, gloss it once
in the comment, and DO NOT "fix" it.

ADD, cumulative:
  hpWasted      <- game.stats.hpWasted   (P3 created it)

ADD, ⛔⛔ NEITHER -- A SECOND SAWTOOTH:
  scoopHits     <- game.scoopHits

  game.scoopHits RESETS TO 0 every time a scoop level is lost. It counts hits SINCE THE LAST LEVEL
  LOSS, exactly as cargoDamageEvents counts severs since the last guard drop. It is the SECOND
  sawtooth in this schema.

  ⛔ This is not hypothetical. cargoDamageEvents was documented as cumulative in the guide, in this
  file's own comment block, and in test-cs039-p2 SIMULTANEOUSLY for the whole of CS039, and the
  first real capture showed 7 decreases in 53 rows. DO NOT REPEAT IT.

  Document scoopHits as a sawtooth at ALL THREE sites in this phase:
    1. the TELEMETRY_FIELDS comment block, in the same ⛔ NEITHER section as cargoDamageEvents
    2. the CS040 test
    3. (P8 handles the analysis guide)
  Any monotonicity assertion in the suite must exclude BOTH columns BY NAME.

GAME-OVER FLUSH: at the site that sets game.stats.gameEnded = true, push one final row (subject only
to the existing telemetryCapture gate).
  ⛔ Must not double-push if a scheduled snapshot lands the same frame -- reset Telemetry.acc after.

HEADER BLOCK: seven lines -> nine. Add, in the order shown in §3.6:
  # ringWrapped=<bool>          true once the buffer has hit TELEMETRY_MAX and dropped a row
  # finalRowIsGameOver=<bool>
  Bump the version line to v4.
  ringWrapped needs a latch on the ring -- set it where a row is dropped, clear it in reset().

TELEMETRY_MAX / PERSIST CADENCE (FORK-CS040-D):
  - TELEMETRY_MAX 400 -> 800. Ring coverage becomes 67 min at 5 s, 133 at 10 s, 200 at 15 s.
  - Persist every 4th snapshot rather than every one. Net effect with the doubled ring is HALF of
    today's write volume per unit of game time, risking at most 3 rows on a hard crash.
  ⛔ THE GAME-OVER FLUSH ALWAYS PERSISTS, whatever the every-4th counter is standing at. That is
    precisely the row you cannot afford to lose. Test it.
  ⛔ Reset the persist counter in Telemetry.reset().

TESTS:
  - header is 49 columns and matches TELEMETRY_FIELDS order exactly
  - scoreRepairBonus absent everywhere
  - ⛔ scoopHits asserted to be a SAWTOOTH (construct a level loss, assert the decrease) and
    excluded from the monotonicity check alongside cargoDamageEvents
  - the three population columns read the right arrays (assert debrisCount tracks game.debris)
  - game-over flush pushes exactly one row; no double-push on a coincident snapshot
  - the game-over flush PERSISTS even when the every-4th counter is mid-cycle
  - TELEMETRY_MAX is 800 and the ring drops the oldest row at 801
  - ringWrapped false on a short run, true after a forced wrap, false again after reset()

Run the suite. Report the final column count and the full ordered field list.
```

---

## P6 — Options telemetry submenu

**Commit:** `cs040 p6: telemetry controls move to Options`

```
Fresh clone. Read PLANNED-FEATURES-CS040.md §4 in full.

Grep:
  grep -n "const MENU_OPTIONS" -B 12 -A 4 orbital-overhaul.html
  grep -n "MENU_OPTIONS.indexOf(" orbital-overhaul.html
  grep -n "function drawOptionsMenu" -A 40 orbital-overhaul.html
  grep -n "Copy telemetry log" orbital-overhaul.html
  grep -n "function copyTelemetry" -A 20 orbital-overhaul.html
  grep -n "telemetryCapture\|telemetryInterval" orbital-overhaul.html
  grep -n "sessionSwitch" orbital-overhaul.html

Insert "Telemetry" into MENU_OPTIONS before "Back": 5 rows -> 6. This is the CS038 P1 precedent
(which inserted "Credits" before "Back") -- read that comment before editing.

⛔ Every consumer addresses rows by LABEL via MENU_OPTIONS.indexOf(...). Re-grep EVERY indexOf call
site at the insert and confirm each still resolves. If you find ANY positional addressing, STOP and
report it -- do not work around it.

SUBMENU, three rows plus Back:
  Capture      -- ON / OFF
  Sample rate  -- preset cycle over [5, 10, 15], labelled:
                    "5 s — Detail (67 min)"
                    "10 s — Balanced (133 min)"
                    "15 s — Full run (200 min)"
                  (the minutes are TELEMETRY_MAX * interval / 60; DERIVE them, do not hardcode. P5
                   just moved TELEMETRY_MAX 400 -> 800 and these labels changed with it -- that is
                   exactly why they must be computed.)
  Copy log     -- action row, calls the existing copyTelemetry()

⛔ CAPTURE IS SESSION-ONLY AND MUST NOT PERSIST. CS038 P3 made telemetryCapture opt-in per session,
OFF at every launch, and CS038 C6 made it a `sessionSwitch` knob EXEMPT from the overridesOn master
toggle so it can never show ON while capturing nothing. Paul has confirmed this is unchanged. The
Options row is a more convenient switch, nothing more. Do NOT write it to afd_settings_v1.
"Session" = one page load; a refresh turns it off.

⛔ telemetryInterval's registry `def` STAYS 15, so a stock run still reports `levers=none` and the
provenance header stays honest. Picking 5 or 10 correctly surfaces as levers=telemetryInterval=5.

⛔ The rate may be changed MID-RUN. Telemetry.tick() already handles a lowered interval by draining
acc one row per frame rather than bursting -- verify that still holds and add a test.

REMOVE from the debug panel: the telemetryCapture row, the telemetryInterval row, and the
"Copy telemetry log" action row.
⛔ copyTelemetry() ITSELF STAYS EXACTLY WHERE IT IS. The comment at Telemetry.tick() is explicit
that the export must keep working while capture is OFF -- that is precisely the state you are in the
morning after a capture session. Moving the CONTROL must not gate the EXPORT.

TESTS:
  - "Telemetry" present in MENU_OPTIONS; every indexOf consumer resolves
  - capture toggles, and does NOT survive a simulated reload
  - preset cycle wraps 5 -> 10 -> 15 -> 5
  - the minutes label derives from TELEMETRY_MAX (change the cap in the test, assert the label moves)
  - copyTelemetry() works with capture OFF
  - the three debug-panel rows are gone; LEVERS count moves as expected

Run the suite. Report the new LEVERS count and the new MENU_OPTIONS length.
```

---

## ⛔ GATE T — blocking playtest

Nothing after this line starts until Paul signs off.

**Capture telemetry during the gate playtest at `5 s — Detail`, and export it.** `hpWasted`,
`healthBanked` and the three population columns are all new and unvalidated against real play; this
log is the changeset's own evidence.

Questions (from §7 of the spec):

1. Does healing feel earned rather than accrued, or merely scarce?
2. Do the four gap constants need a pass? (Expect yes.)
3. Is the banked-charge readable — the HUD pips at rest (FLAG-CS040-f) and the auto-spend SFX?
4. Does the hub resupply read as relief or as a vending machine (FORK-CS040-C)?
5. Does the run end earlier, and does that feel like difficulty or like a wall?
6. Can a capture session be started, sized and exported entirely from Options?

Also worth checking against the new columns once the log is in hand:

- `hpWasted` near zero → `HEALTH_BANK_MAX = 2` is sufficient, maybe generous.
- `hpWasted` large → health is arriving in clumps; widen the bank rather than slow the cadence.
- `hunterCount` vs `hunterCoalesced` should finally confirm or refute the 1+3+9 lineage ratio
  (11.65 and 11.89 observed against a theoretical 13) with a direct measurement instead of an inference.

---

## P7 — Tuning pass

**Commit:** `cs040 p7: gate T tuning`

```
Fresh clone. Read the GATE T resolutions recorded in PLANNED-FEATURES-CS040.md §5/§6.

Apply ONLY the constant changes Paul signed off at the gate. Candidates, in the order they are
most likely to move:
  HEALTH_GAP_LOW_OK / HIGH_OK / LOW_HURT / HIGH_HURT   (FLAG-CS040-c)
  HEALTH_BANK_MAX                                       (FLAG-CS040-a evidence)
  HUB_DRY_WEIGHT_MULT                                   (FLAG-CS040-e)
  REPAIR_MILESTONE                                      (FORK-CS040-B -- ⛔ RAISE THIS FIRST if the
                                                         gate says health is abundant late, BEFORE
                                                         touching the gap constants; see the watch
                                                         item in the spec's fork table)
  HUD pip always-drawn vs non-zero-only                 (FLAG-CS040-f -- a draw-gate condition, not
                                                         a structural change; allowed here)

⛔ NO STRUCTURAL CHANGES IN THIS PHASE. Constants and registry defs only. If the gate asked for
anything structural (a HUD tell for the banked charge, a different auto-spend rule), that is a
separate phase and must be added to this document first, not smuggled in here.

If the gate signed off with no changes, commit nothing and report that. A no-op P7 is a good outcome.

Run the suite.
```

---

## P8 — Doc sweep, guide v4, version bump

**Commit:** `cs040 p8: doc sweep + 1.0.0.40`

```
Fresh clone. Documentation and version only -- no gameplay logic changes.

⛔ Confirm PROMPT-guide-update.md (the standalone v3 corrections) has already landed. If
TELEMETRY-ANALYSIS-GUIDE.md still describes guard's weight as the flat 20 from POWERUP_DROP_WEIGHTS,
it has NOT landed -- STOP and report, because the v4 section below assumes those corrections exist.

1. GAME_VERSION -> "1.0.0.40".

2. TELEMETRY-ANALYSIS-GUIDE.md -- add a v4 section:
   - 49 columns. Give the full ordered list from TELEMETRY_FIELDS (grep it, do not transcribe from
     this document).
   - scoreRepairBonus REMOVED, and why: milestone healing is gone, so the counter had no consumer.
     The §5 "score decomposition" derivation loses that term -- rewrite it as
     score = deliveryScore + scoreScoopBonus + residual.
   - hunterCount / debrisCount / garbageCount: instantaneous. Restate the inverted vocabulary --
     debrisCount is GARBAGE SATELLITES, garbageCount is towable DEBRIS. Mark §10's "enemy population"
     blind spot as CLOSED.
   - hpWasted: cumulative. Document what it distinguishes -- health scarce vs health mistimed --
     and the reading rule (near zero = bank cap sufficient; large = cadence over-firing in calm
     stretches, widen the bank rather than slow the cadence).
   - healthBanked: instantaneous, 0..HEALTH_BANK_MAX.
   - ⛔ scoopHits: add it to §3's "NEITHER" section ALONGSIDE cargoDamageEvents. THE SCHEMA NOW HAS
     TWO SAWTOOTHS. Update §2's monotonicity check to exclude BOTH by name, and update the §9
     starter script's CUM list the same way. Say plainly that scoopHits resets on scoop level loss.
   - Header block: nine lines. Document ringWrapped and finalRowIsGameOver. In §2's truncation
     check, lead with ringWrapped -- the arithmetic on t[0] becomes the fallback, not the method.
   - §10 blind spots: mark "no row is flushed at game over" CLOSED.
   - §4 constants table: remove REPAIR_AMOUNT and REPAIR_FULL_BONUS; add HEALTH_BANK_MAX and the
     four HEALTH_GAP_* constants; note POWERUP_HEALTH_GAP is retired and the cadence is now a
     function of hull.
   - §4's "two behavioural facts": ⛔ REWRITE THE SECOND ONE. "Health is time-gated; everything else
     is kill-gated" is now WRONG in both halves -- health is hull-gated (pity cadence) plus
     score-gated (milestone spawn), and the hub's drop is delivery-gated with a dry-budget bias.
     This fact is described in the guide as "the single most useful structural fact in the whole
     schema", and §7's "health rate rising is not good news" trap is built on it. Both need rewriting
     together, not patching.

3. CLAUDE.md -- record the settled decisions:
   - the ONLY healing source is applyPowerup()'s health arm (plus the bank, which is fed from it)
   - REPAIR_AMOUNT / REPAIR_FULL_BONUS deleted, not parked; do not restore
   - milestone spawns, gated on hull below max
   - telemetryCapture remains session-only and non-persisted; Options is a control surface, not
     a settings store
   - scoopHits is a sawtooth

4. STATUS.md -- current state, the GATE T resolutions, and the tuning P7 applied.

5. DIFFICULTY-LEVERS.md -- the new knobs and their gate-tuned values.

6. GDD -- the healing section, the hub resupply behaviour, the Options telemetry submenu.

7. DECISIONS.md -- record the CLOSED items with rationale: balanceEra DECLINED; shield
   instrumentation DECLINED (deliberate homage, auto-shield covers it); scoop redesign, CARGO_TURN,
   sever-linked scoop loss, shots-fired and dock-proximity telemetry all DEFERRED to named future
   changesets, NOT rejected.

8. Archive PLANNED-FEATURES-CS040.md and IMPLEMENTATION-PHASES-CS040.md to log/CS040.md.

Run the full suite. ⛔ ZERO SKIPS before this changeset closes. Report any skip with its reason.
```

---

## Close checklist

- [x] All four forks and all six flags resolved with rationale — `PLANNED-FEATURES-CS040.md` §5/§6
- [ ] `TELEMETRY_MAX` is 800; game-over flush persists regardless of the every-4th counter
- [ ] Banked-charge HUD pips ship, stroke-only, clear of the CARGO cluster
- [ ] GATE T signed off; gate telemetry captured at 5 s and exported
- [ ] Suite passes at zero skips
- [ ] `GAME_VERSION` is `1.0.0.40`
- [ ] `TELEMETRY_FIELDS` is 49 columns; guide's v4 section matches it by grep, not by transcription
- [ ] **Both** sawtooth columns excluded from every monotonicity check, in build, test and guide
- [ ] Planning docs archived to `log/CS040.md`