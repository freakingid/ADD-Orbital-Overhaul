# IMPLEMENTATION-PHASES-CS042.md

**Reads with:** `PLANNED-FEATURES-CS042.md` (spec). Every `§` reference below points there.
**Base:** `71ab1bc`, `GAME_VERSION 1.0.0.40` → `1.0.0.41` at P11.

**Standing rules for every phase:**

- One Claude Code session per phase. One commit per phase, on `main`. **Never push** — that is Paul's.
- Navigate the single-file build with `grep -n 'symbolName'` + `sed -n 'START,ENDp'`. **Anchor by
  symbol name, never by line number** — line numbers drift within a session.
- Check the `DEBUG_VARS` count and the `LEVERS` count at the start of each session as the
  state-of-build indicator. `STATUS.md`'s header carries both.
- **Forks are not resolved inside a session.** All five (§8) are resolved. If a prompt seems to
  conflict with a resolution, stop and report rather than choosing.
- ⛔ **Read the GDD by named subsection** (`CLAUDE.md`'s document map): §0 + §1 always, then the
  §2.x/§3.x this phase names.
- ⛔ **`node scratchpad/run-all.js` green before every commit.** Baseline is 171/171; `test-f6.js` is a
  documented ~1.7% flake — rerun it before treating a failure as a regression.

---

## Phase map

| phase | content | model | effort | build? |
|---|---|---|---|---|
| **P0** | `tools/handling-lab.html` — drag, cargo, Engine vs chain length (§6.6) | **Opus 5** | `ultrathink` | no |
| **P1** | `tools/sfx-lab.html` — 12 sounds × 3 candidates (§1.6) | **Fable 5.1** | standard | no |
| **P2** | `tools/ceremony-lab.html` — both sequences (§3) | **Opus 5** | `ultrathink` | no |
| **⛔ GATE A** | **Paul uses all three labs. Picks models, numbers, sounds, ceremony.** | — | — | — |
| **P3** | SFX foundation + the anchor trio, ported from GATE A (§1.3, §1.4) | **Opus 5** | `ultrathink` | yes |
| **P4** | SFX completion — the remaining nine (§1.4) | **Sonnet 5** | standard | yes |
| **P5** | The ceremony edit — spec is GATE A's copy-out block (§3) | **Opus 5** | `ultrathink` | yes |
| **P6** | Health supply levelling — five changes, five knobs (§2.3) | **Opus 5** | `ultrathink` | yes |
| **P7** | Handling model + Engine burn condition, from GATE A (§6.3, §6.5) | **Opus 5** | `ultrathink` | yes |
| **P8** | Scoop levels 6–7, orbs, level-1 floor (§4.3) | **Opus 5** | `ultrathink` | yes |
| **P9** | Scoop loss rate + the reserve-spares-the-scoop rule (§4.4, §4.5) | **Opus 5** | `ultrathink` | yes |
| **P10** | Menu navigation repeat (§5) | **Sonnet 5** | standard | yes |
| **⛔ GATE C** | **blocking playtest — G1…G10 (§7)** | — | — | — |
| **P11** | Closing: tuning pass, docs, §0 re-measure, version bump, archive | **Sonnet 5** | standard | yes |

### On the model calls

**Fable 5.1 for P1, and only P1.** That phase is thirty-six distinct sound characters that must be
*meaningfully different from each other* — a generative-variety problem, not a correctness problem. It
touches no build byte, has no invariants to violate, and a weak result is visible immediately in the
lab and costs nothing. That is the one place in this changeset where a creative-leaning model can
genuinely change the outcome. ⚠ If its Web Audio graphs come out unmusical or the three candidates
per sound are not actually distinct, **rerun P1 on Opus 5** — the phase is disposable by design.

**Opus with `ultrathink` for every phase touching a documented invariant** — P3 (the trigger-site
rule the whole changeset rests on), P6/P7/P8/P9 (each reverses or restructures a decision the build
argues for in comments), P5 (the ceremony's five reduced-sim jobs and four `nextWave()` prohibitions).

**Sonnet for P4 and P10** — both are mechanical application of a pattern P3 or the spec already
established. **Sonnet for P11**: closing is a checklist.

**P0 and P2 are Opus** despite touching no build byte: both are physics or state machines that must
mirror the real one closely enough that Paul's decision transfers, and a lab that lies is worse than
no lab.

### Why this order

The three labs land first because all three are decision instruments and Paul can work them in one
sitting at GATE A. Everything after GATE A is built against answers rather than guesses. The ceremony
edit (P5) sits **before** GATE C so the playtest can judge it; P8 and P9 split the Scoop's reward side
from its risk side so GATE C can accept one without the other.

---

## P0 — `tools/handling-lab.html`

> **Model: Opus 5 · Effort: `ultrathink`**

**Commit:** `cs042 p0: handling lab — drag, cargo mass and engine relief across chain lengths`

**Read:** spec §6 in full. GDD §2.1 (ship — thrust, drag, top speed), §2.10.2 (payload curve —
`CARGO_THRUST`/`CARGO_MAXSPD`/`CARGO_MASS`/`CARGO_TURN`), §2.14 (the Engine budget), §3.4 (chain
physics — the tug reads `chainMass()`).

Build a standalone lab in the `tools/` house style (dark canvas left, control panel right — copy the
CSS shape from `tools/scoop-lab.html`). ⛔ **It duplicates the integration it needs; it does not import
build code.**

Deliver everything in §6.6:

1. **A flyable mock ship** on a wrapping field with an adjustable tow chain (0–24 nodes), using the
   build's integration shape: `v += thrust·mul·dt`, then `v *= (1−drag)^dt`, then clamp.
2. **Model selector A / B / C** (§6.3), swapping the whole speed-penalty structure live.
3. **Sliders** for `SHIP_DRAG`, `SHIP_THRUST`, `SHIP_MAX_SPEED`, `CARGO_THRUST`, `CARGO_MAXSPD`
   (models A/B), `CARGO_DRAG` (model C), `CARGO_MASS`, `CARGO_TURN`, `ENGINE_MASS_MULT`,
   `ENGINE_BURN_SECONDS`.
4. **Engine toggle**, plus ⛔ **a live "which limit is binding?" readout — cap or drag.** That single
   fact is the whole of §6.3 and it must be visible, not inferred.
5. **A table across chain lengths 0 / 4 / 8 / 12 / 16 / 20 / 24**, with and without Engine: effective
   accel, terminal speed, binding limit, time to 90% of top speed, coast half-life. ⛔ **Engine gain %
   is the headline column** — it is the number Paul is deciding on.
6. **A/B toggle** against the shipped values on one key.
7. **A copy-out block** of the chosen model and constants.

⛔ Seed every slider from the shipped values so "A, untouched" is honest: `SHIP_THRUST` 340,
`SHIP_DRAG` 0.35, `SHIP_MAX_SPEED` 520, `CARGO_THRUST` 0.07, `CARGO_MAXSPD` 0.035, `CARGO_MASS` 0.10,
`CARGO_TURN` 0.0, `ENGINE_MASS_MULT` 0.5, `ENGINE_BURN_SECONDS` 10.0.

⛔ **Reproduce §6.3's tables in the lab and check them.** If the lab disagrees with the spec's numbers,
**the lab is right and the spec is wrong** — report the discrepancy in the commit body rather than
adjusting the lab to match.

⚠ `CARGO_TURN` is in the lab and is **not** pre-committed to shipping above 0.0 (FLAG-CS042-j, G6).

**Test:** none. `tools/` is not shipped code and has never carried suite coverage. ⛔ Say so in the
commit body rather than adding a first-ever tools test.

**Also:** add the lab to `CLAUDE.md`'s "Design instruments (`tools/`)" list, one line, matching its
neighbours' shape.

---

## P1 — `tools/sfx-lab.html`

> **Model: Fable 5.1 · Effort: standard**
> ⚠ The one phase where a creative-leaning model should genuinely help — thirty-six sound characters
> that must be distinct from one another. Touches no build byte. **If the candidates come out
> indistinct or unmusical, rerun this phase on Opus 5**; it is disposable by design.

**Commit:** `cs042 p1: sfx lab — three candidates for each of the twelve event sounds`

**Read:** spec §1.1, §1.2, §1.4, §1.6. GDD §2.8 (Audio) — specifically the existing `AudioSys`
one-shots, which are the idiom every candidate must be portable into.

Build a standalone lab in the `tools/` house style. Deliver everything in §1.6:

1. **Twelve rows**, one per sound in §1.4's table, each with **three audition buttons and a "picked"
   radio**.
2. ⛔ **Every candidate is a self-contained Web Audio graph in the shipped `AudioSys` idiom** — an
   oscillator/gain/filter chain scheduled at call time. **No sequencer, no sample, no external asset,
   no `setInterval`.** What the lab plays must paste into `AudioSys` verbatim.
3. ⛔ **`cargofull` and `cargolost` audition as a PAIR.** Each `cargolost` candidate derives its
   frequencies from its matching `cargofull` candidate, **reversed** — the pair is a matched set by
   construction, not by ear. Picking one picks both. **`chainsever` auditions immediately after
   `cargolost`** so "audibly smaller" can be judged rather than assumed.
4. **Context playback** per row, against the sounds each will really sit beside: `powerup()` before a
   `powertag`, `deliver()` before a `haulsize`, `explosion(1)` under a `chainsever`, `achievement()`
   next to `levelup`, `lowhp(true)` under `hullcritical`. ⛔ **Port those neighbours verbatim from the
   build** — they are the lab's only port-in, and the comparison is dishonest without them.
5. **Master and SFX volume sliders** matching the game's own categories.
6. ⛔ **A copy-out block** emitting the twelve picked candidates as finished `AudioSys` methods, ready
   to paste. **That block is what P3 and P4 port.**

**Character briefs are in §1.4's third column.** The three candidates for a given sound should differ
in *approach*, not just in pitch — e.g. for `cargofull`: a stepped arpeggio, a continuous filter
sweep, and a pulsed fill. Three transpositions of one idea is a failed phase.

⛔ **`health` gets no `powertag` row.** It has no `collect_` line by design. Do not add a thirteenth.

**Test:** none, same reason as P0. Say so in the commit body.

**Also:** add the lab to `CLAUDE.md`'s "Design instruments (`tools/`)" list. ⛔ **Note in that entry
that it is the porting source for every `AudioSys` event one-shot**, the way `music-lab.html`'s entry
names it as the porting source for `MUSIC_TRACKS`.

---

## P2 — `tools/ceremony-lab.html`

> **Model: Opus 5 · Effort: `ultrathink`**

**Commit:** `cs042 p2: ceremony lab — the level-end and game-over sequence instrument`

**Read:** spec §3. GDD §2.20 (celebration panel), §2.20.1 (level-end ceremony), §2.18 (high scores —
sequence B beat 4), §2.9 (states).

Build a standalone lab in the `tools/` house style. ⛔ **It duplicates whatever slice of the sequences
it needs. It does not import build code and it is not a PORT-ME BLOCK** —
`tools/lowhp-glow-lab.html`'s port block is the exception that proves the rule, and it exists because
that lab studies exact pixels. This one studies pacing.

Deliver everything in §3.4:

1. **Two tabs**, Level End and Game Over, each a **scrubbable timeline** over a mock 1280×720 canvas
   carrying the real chrome: frozen starfield, the "Level N Complete" announcement, the celebration
   panel silhouette **at its real 820×560**, the "Level N+1" banner, and the GAME OVER / FINAL SCORE /
   10-row table stack.
2. **Per-beat controls** — duration; input-gated vs timed; fade-in and fade-out curve; overlap with the
   previous beat; frozen vs live; and for Level End beat 5, **thaw as a switch or as a ramp**.
3. **Five named presets:** Current (shipped) · Auto-advance · Cross-fade · Merged · Compressed.
4. **A/B toggle** between the working preset and Current (shipped), on one key.
5. ⛔ **A copy-out block** naming every beat, duration and transition chosen. **That block is P5's spec.**

Seed both timelines from the shipped numbers in §3.2/§3.3 so "Current (shipped)" is honest:
`levelBannerFade` 0.5 · `levelBannerTime` 2.2 · `levelEndGrace` (read the registry) ·
`DEATH_DURATION` 2.5 · the panel's hard cut at both ends · the thaw at `life <= levelBannerFade`.

**Test:** none, same reason as P0. Say so in the commit body.

**Also:** add the lab to `CLAUDE.md`'s "Design instruments (`tools/`)" list.

---

## ⛔ GATE A — Paul uses the three labs

**Nothing after this line is built until Paul answers.** One sitting, three instruments:

| Lab | What comes back |
|---|---|
| `handling-lab` | The model (A/B/C), and values for every slider — including whether `CARGO_TURN` ships above 0.0 (FLAG-CS042-j). Feeds **P7**. |
| `sfx-lab` | Twelve picked candidates as a copy-out block. Feeds **P3** and **P4**. |
| `ceremony-lab` | The chosen beats, durations and transitions for both sequences. Feeds **P5**. |

⛔ **Clear the debug overrides before touching the handling lab (FLAG-CS036-a)** if any comparison is
made against the running game.

⚠ **If the handling lab contradicts §6.3's tables, the lab wins.** The spec's numbers are analytic and
have never been flown.

---

## P3 — SFX foundation and the anchor trio

> **Model: Opus 5 · Effort: `ultrathink`**
> The trigger-site rule established here is what the whole of §1 rests on, and P4 copies it nine more
> times. Getting it wrong once gets it wrong twelve times.

**Commit:** `cs042 p3: event SFX foundation — cargo full, cargo lost, chain sever`

**Read:** spec §1.1–§1.5. GDD §2.8 (Audio — all of it; this phase adds to `AudioSys` and reads the
`VoiceSys` channel contract), §2.10 (tow chain, for the three trigger sites).

**Port `cargofull` / `cargolost` / `chainsever` from GATE A's copy-out block.** ⛔ **Verbatim.** Do not
re-tune them here — they were picked by ear at the volume the game plays them.

**Write the rule into the build**, as a comment block above the first new method, because every later
phase depends on it:

> ⛔ An event SFX is fired at its TRIGGER SITE, immediately above the `VoiceSys.say()` call — never
> inside `_emit()`. `_emit()` is the one cooldown/priority/criticality gate; a sound placed inside it
> would inherit the drop, park and repeat-suppression rules, and the entire point of these sounds is
> that they play when the voice does not. The sound landing just *before* the voice is a consequence
> of that placement (`_schedule()` leads by 0.10 s), not a second mechanism.

⛔ Each method opens `if (!this.ctx) return;`. ⛔ `AudioSys` does not grow a sequencer. `MusicSys` is
untouched.

**Wire three trigger sites**, each one line immediately above the existing `say()`:

| Site | Call |
|---|---|
| the pickup that fills the chain (`game.chain.length === game.cargoMax`) | `AudioSys.cargofull();` |
| `damageShip()`'s payload-release branch | `AudioSys.cargolost();` |
| `breakChain()`'s sever tail | `chain.length === 0 ? AudioSys.cargolost() : AudioSys.chainsever();` |

⛔ The `breakChain()` call must use **the same `chain.length === 0` test the `say()` on the next line
already uses**, so the sound and the line can never disagree about which event happened. Do not
introduce a second predicate.

⛔ `boom()` at `breakChain()` stays — the sever's explosion is the *canister* dying, a different
statement from the payload cue. Layer, do not replace.

**Test — `scratchpad/test-cs042-p3.js`.** ⛔ **The load-bearing assertion of the whole changeset:**

- Drive a real chain fill, a real sever and a real payload release through the real functions.
- Assert the `AudioSys` method fired **with the voice gate closed** — put the event inside its own
  `VOICE_REPEAT_GAP` window, or pre-empt it with a higher-priority line, so `say()` returns null.
  **The sound must still have fired.**
- Assert `cargolost` and `chainsever` are reached by the two distinct chain lengths.
- ⛔ Do **not** assert a global count of `AudioSys` methods — `test-registry.js` owns totals.

---

## P4 — SFX completion

> **Model: Sonnet 5 · Effort: standard**
> Mechanical application of P3's pattern to nine more sites, from a copy-out block that already exists.

**Commit:** `cs042 p4: event SFX — the remaining nine events`

**Read:** spec §1.2, §1.4. GDD §2.8, §2.7 (waves/health — `level`, `health_*`), §2.14 (powerups — the
`collect_`/`expire_` sites), §2.10 (dock tiers), §2.14.2 (chain guard).

**Port the remaining nine from GATE A's copy-out block, verbatim:** `guardblock`, `levelup`,
`hullfull`, `hullrelief`, `hullcritical`, `powertag(type)`, `powerfade(type)`, `haulsize(n)`,
`megadelivery`.

**Add one data table** beside `POWERUP_COLOR` / `POWERUP_LABEL`: the per-type root for
`powertag`/`powerfade` (§1.4). Adding a powerup type later must be a one-row edit. ⚠ **`health` has no
entry** — it has no `collect_` line by design. **Do not invent `collect_health`.**

**Wire the sites**, each immediately above the existing `say()` (or at the event itself where there is
no `say()`):

| Event | Site | Call |
|---|---|---|
| `level` | `nextWave()`, above `VoiceSys.sayLevel()` | `AudioSys.levelup()` |
| `health_full` | `update()`'s hull-full latch | `AudioSys.hullfull()` |
| `health_relief` | the falling edge, inside the `!ship.dead` guard | `AudioSys.hullrelief()` |
| `health_low` | the rising edge, beside `lowhp(true)` | `AudioSys.hullcritical()` |
| `collect_*` | `applyPowerup()` — **both** the scoop early-return arm and the main arm | `AudioSys.powertag(type)` after the existing `powerup()` |
| `expire_*` | the `POWERUP_DROP_TYPES` falling-edge loop | `AudioSys.powerfade(t)` |
| `dock_5/10/15/20` | the pop that empties the chain, above `dockDelivery()` | `AudioSys.haulsize(game.deliveryCount)` |
| `dock_24` | `superMegaDelivery()`, above `say("dock_24")` | `AudioSys.megadelivery()` |
| `chain_guard` | `breakChain()`'s guard branch | `AudioSys.guardblock()` **replacing** `shieldPing()` |

⛔ **`chain_guard` is the one replacement, not an addition.** The borrowed `shieldPing()` is exactly
what makes chain armour indistinguishable from the ship's shield. **Rewrite the comment there that
explains the borrowing; do not leave it standing false.**

⛔ **`hullcritical()` is additive** — `lowhp(true)` still starts the siren loop, unchanged.
⛔ **`powerfade` is skipped for `"guard"`**, mirroring the existing `t !== "guard"` clause on the voice
line. ⛔ **`haulsize(n)` layers over the per-canister `deliver(n)` climb**, which is unchanged.

⚠ **The `expire_*` loop runs every frame.** Confirm the falling-edge latch (`game.powerVoiced[t]`) is
what gates the call, so `powerfade` fires **once** per expiry and not per frame.

**Test — `scratchpad/test-cs042-p4.js`:** same shape as P3's — each event driven through real code
with the voice gate closed, asserting the sound still fired. Cover `guardblock` replacing
`shieldPing` at the guard branch, and the once-per-expiry latch.

---

## P5 — The ceremony edit

> **Model: Opus 5 · Effort: `ultrathink`**
> Every constraint below is a rule the build argues for at length in its own comments. This is the
> phase most likely to break something silently.

**Commit:** `cs042 p5: level-end and game-over ceremony, per GATE A`

⛔ **SCOPE IS GATE A's ceremony-lab copy-out block.** The prompt for this phase is written from that
block. If it is not in hand, this phase does not start.

**Read:** spec §3. GDD §2.20, §2.20.1, §2.18, §2.9.

**Standing constraints, whatever the block says:**

- ⛔ **Both input handlers or neither** (CS030 P4). Keyboard and gamepad gates move together.
- ⛔ **`updateLevelEndFreeze()`'s five reduced-sim jobs each exist for a stated reason** and none is
  removed casually: `AudioSys.thrust(false)`, `tickLevelBanner(dt)` (**without it the freeze is a hard
  hang**), `VoiceSys.update()` (the critical-line drain), the `levelDone.age` clock, the caption tick.
- ⛔ **The hold and the tail are mutually exclusive and stay one `if/else`**, not two `if`s.
- ⛔ **`nextWave()` must not gain resets for `levelEndSafe` / `levelEndGraceT` / `levelEndPulseT` /
  `levelEndFreeze` / `levelDone`.** It is called from *inside* the protection window; zeroing any of
  the five there ends the window at the instant the banner appears. `resetRun()` owns them.
- ⛔ **`game.pendingAch` is a flushed bucket, never filtered by `game.wave`** (CS030 §0.4).
- ⛔ **`dismissLevelDone()` must not lift the freeze** — CS036 P3 removed that line deliberately
  (FORK-CS036-B); re-adding it ends the ceremony a step early.
- ⛔ Both degenerate banner-knob settings must still degrade to "unfreeze immediately" via the plain
  `<=`; a crossing one-shot hangs on both.

**Test — `scratchpad/test-cs042-p5.js`:** whatever the block requires, plus ⛔ **a regression assert
that the freeze still terminates** under both degenerate knob settings (`levelBannerFade >=
levelBannerTime`, and `levelBannerTime === 0`).

---

## P6 — Health supply levelling

> **Model: Opus 5 · Effort: `ultrathink`**
> Reverses a CS040 decision the build argues against in a comment, and must not undo CS040's rescue.

**Commit:** `cs042 p6: health supply — spawn lock, milestone growth, hull gate, wider ambient gap`

**Read:** spec §2. GDD §2.7 (waves, health, scoring — `REPAIR_MILESTONE`, `healthGapRoll()`), §2.14
(powerups — the Health pickup, `game.healthBank`), §2.19 (debug registry).

**Five changes, five knobs** (§2.3):

- **(a)** `game.healthSpawnLock` — seconds, set by **every** spawn route, respected by all three.
  `DEBUG.healthSpawnLock`, `def` from a new `HEALTH_SPAWN_LOCK = 12`, min **0 disables**, max 60.
- **(b)** Move the one-at-a-time gate **into `spawnHealthPowerup()`**. ⛔ CS040 P1's comment at the
  milestone site says the placement is deliberate and predicts that moving it *"would be a design
  change, not a tidy-up."* **It is one, it is intended, and that comment is REWRITTEN to record the
  reversal and its changeset — not deleted.**
- **(c)** `game.nextRepair += REPAIR_MILESTONE * (1 + DEBUG.repairMilestoneGrowth * game.wave)`.
  New `REPAIR_MILESTONE_GROWTH = 0.08`, min **0 restores today's flat behaviour**, max 0.5.
  ⛔ `REPAIR_MILESTONE` itself stays 10,000 (CS040's FORK-B).
- **(d)** Milestone fires only while `hp <= SHIP_MAX_HP * DEBUG.repairMilestoneHullPct`.
  New `REPAIR_MILESTONE_HULL_PCT = 0.70`, min 0.1, max **1.0 restores today's `hp < SHIP_MAX_HP`**.
  ⛔ The bookkeeping still advances on **every** crossing whatever the hull reads — CS040 P1's rule,
  and it is why a stretch at full hull cannot bank crossings and cash them at the first scratch.
  ⛔ **0.70 is the changeset's one definition of "hurt"** and P9's `bankSpareHullPct` is the same
  number by design (§4.5). If one moves, say so; they are meant to agree.
- **(e)** `def` changes only: `HEALTH_GAP_LOW_HURT` 6 → 10, `HEALTH_GAP_HIGH_HURT` 10 → 16,
  `HEALTH_GAP_LOW_OK` 22 → 30, `HEALTH_GAP_HIGH_OK` 30 → 45. No mechanism change.

⛔ **CS040's rescue must survive.** The milestone spawn exists because removing milestone healing
outright killed both replayed runs many waves early. **Do not tune (d) so tight the arm stops firing.**

⛔ **Each knob's minimum is its own A/B.** `healthSpawnLock` 0, `repairMilestoneGrowth` 0 and
`repairMilestoneHullPct` 1.0 together restore today's behaviour exactly — that is what G3 needs.

**Registry:** three new `DEBUG_VARS` rows in the POWERUPS section, `def` deriving from the new consts.
⛔ **Not levers** — health cadence is powerup pacing, not a difficulty ramp: no floor/ceil/steps, no
▼/↳ glyph, no `LEVERS` entry, same reasoning as the four `healthGap*` rows.
⛔ **Update `scratchpad/test-registry.js`'s registry count** — the one place that number lives.

**Test — `scratchpad/test-cs042-p6.js`:** the lock blocks a second spawn inside the window and admits
one after it; the gate inside `spawnHealthPowerup()` refuses a second concurrent pickup **from the
milestone route**; the milestone interval grows with wave; the hull gate blocks at 90% and admits at
50%; every knob at its minimum reproduces pre-phase behaviour.

---

## P7 — Handling model and the Engine burn condition

> **Model: Opus 5 · Effort: `ultrathink`**
> Model C retires a documented knob and restructures the speed penalty. `chainMass()` feeds three
> systems, one of which is the verlet chain.

**Commit:** `cs042 p7: cargo drag model + engine fuel burns only under load`

**Read:** spec §6 in full. GDD §2.1 (ship), §2.10.2 (payload curve), §2.14 (Engine budget), §3.4
(chain physics — ⛔ **read this before touching anything `chainMass()` feeds**).

**Part 1 — the handling model, from GATE A.** Implement whichever of A / B / C Paul picked, with his
values.

If **Model C**: replace the `CARGO_MAXSPD` divisor with a drag term
`λ_eff = λ_base · (1 + cargo·CARGO_DRAG)`, so terminal speed becomes emergent and `SHIP_MAX_SPEED`
becomes a rail binding only when unloaded.
⛔ **`CARGO_MAXSPD`'s comment documents a full-24 top-speed percentage. Rewrite it to record the
retirement and its changeset — do not delete it.**
⛔ **`SHIP_MAX_SPEED` stays as the clamp.** It is not removed; it stops being the *binding* limit under
load, which is the point.
⛔ **Confirm in the diff that `DEBRIS_SPEED_CAP = 2 * SHIP_MAX_SPEED` still reads the CONSTANT.** It is
FLAG-CS017-a's guard rail and has nothing to do with player handling.

If **Model B**: only `CARGO_THRUST` and `CARGO_MAXSPD` `def`s move. No structural change.

⛔ **`chainMass()` is untouched in every model.** It feeds `thrustMul`, the speed limit **and**
`updateChain()`'s momentum tug — GDD §3.4 governs the third and this phase must not perturb it.

`SHIP_DRAG` becomes `DEBUG.shipDrag` (`def` from the constant, min 0.15, max 0.90, step 0.05), at
GATE A's value. ⚠ **Record in its comment that this is a deliberate Pillar 2 change**, with §6.3's
coast half-life table, so the next reader knows it was chosen rather than drifted into.

If GATE A said `CARGO_TURN` ships above 0.0 (FLAG-CS042-j), set it and **note that it activates a
knob shipped dormant since CS010**. If not, leave it at 0.0 and say so.

**Part 2 — the Engine burn condition.** ⛔ **One term added, nothing else:**

```
if (this.thrusting)                             →  if (this.thrusting && game.chain.length > 0)
```

⛔ **`ENGINE_BURN_SECONDS` stays 10.0.** Paul's call: the tank is not resized, it just stops leaking.
⛔ **The decrement stays inside the thrust branch**, read after the thrust it paid for, clamped at 0.
It is **not** moved to `update()`'s timer block — "seconds of laden forward thrust" is only measurable
where it already lives.

⛔ **FORK-CS042-C: the Engine gains NO cargo-independent effect.** `ENGINE_THRUST_MULT`,
`ENGINE_MAXSPD_MULT` and `ENGINE_DRAG_MULT` are **withdrawn and must not be built** (§6.4).
⛔ **CS024 P6's "FLAT while any fuel remains" rule STANDS and is not reversed.** No taper, no sputter,
no `ENGINE_TAPER_SECONDS`.

**Test — `scratchpad/test-cs042-p7.js`:** drive real `Ship.update()` at dt = 1/60 and assert —
Engine's terminal-speed gain **rises with chain length and is exactly zero at chain length 0**
(§6.4's rule, made assertable); the binding limit is drag rather than the cap at a laden chain under
the chosen model; `DEBRIS_SPEED_CAP` unmoved; **fuel does not decrement while thrusting with an empty
chain**, and does while thrusting with one node; every knob at its shipped-today value reproduces
pre-phase numbers.

---

## P8 — Scoop levels 6–7 and the flanking orbs

> **Model: Opus 5 · Effort: `ultrathink`**
> Carries FORK-CS042-A's trap, which silently corrupts levels 1–5 if missed.

**Commit:** `cs042 p8: scoop levels 6-7 with flanking orbs; level-1 floor raised`

**Read:** spec §4.1–§4.3. GDD §2.14.1 (the Scoop — all of it), §2.12 (damage, scoop-level loss), §3.2
(rendering conventions), §2.14 (powerups).

**1. `SCOOP_MAX_LEVEL` 5 → 7.**

⛔ **THE TRAP, and FORK-CS042-A resolves it (a).** `buildScoopSteps()` divides by
`(SCOOP_MAX_LEVEL − 1)`. Raising the cap would re-spread the mouth curve across seven levels and
**silently shrink levels 1–5.** The mouth table keeps **its own five-step span** (`SCOOP_MOUTH_LEVELS`
= 5); levels 6–7 read level 5's mouth. `SCOOP_MAX_LEVEL` governs the cap, the HUD ring and the orb
tables — **not** the mouth curve.
⛔ **Verify by printing `SCOOP_WIDTH[1..5]` and `SCOOP_DEPTH[1..5]` before and after** — identical
once part 3's floor change is accounted for.

**2. The orbs.** Two new step tables, `SCOOP_ORB_OFFSET` and `SCOOP_ORB_R`, zero at indices 0–5 and
non-zero only at 6 and 7. Starting values from §4.3 (±62 / ±84 offset, 26 / 34 radius).

⛔ **Extend the load-time guard** so both new tables carry the index-0-is-zero property: today's
`SCOOP_WIDTH[0] !== 0 || SCOOP_DEPTH[0] !== 0` throw gains them. It is a deliberate invariant guard,
not test scaffolding — without it a level-0 ship silently grows orbs.

**Capture:** `inScoopBox()` gains the two orb discs, OR'd in beside the mouth box and the base circle,
in the same ship-local rotated space the mouth already uses. ⛔ **Wrap-aware throughout** — reuse the
existing `shortDelta()` result, never a fresh `Math.hypot`. ⛔ **`inScoopBox()` has two callers** — the
Debris pickup pass and the powerup pickup pass. Both get the orbs, and both must. **Do not fork the
predicate.**

**Render:** in `Ship.draw()`, alongside the mouth prong-V and before the hull. Each orb a small
stroked ring through `drawPoly`/`glowStroke` in `POWERUP_COLOR.scoop`; faint tether to the hull at
level 7. ⛔ **No fills** (Pillar 1). ⛔ **Do not re-add a magnet-pull recolour** — CS025 P5 backed that
out at Paul's gate call and the prohibition stands.

**3. Raise the level-1 floor:** `SCOOP_CONFIG.minWidthMult` 1.2 → **2.6**, `minDepth` 20 → **34**.
⛔ Record §4.2's before/after area table in the constant's comment — the measurement is the
justification.

**4. The HUD ring** reflows for free from `SCOOP_MAX_LEVEL` (CS012's FLAG-CS012-1b). ⛔ **Verify seven
segments are legible at `HUD_FX_RING_R`.** If not, that is a tuning note for P11 — **not** a reason to
cap the levels.

**Also:** extend `tools/scoop-lab.html` to render and size the orbs; its five-level UI grows to seven.

**Test — `scratchpad/test-cs042-p8.js`:** mouth tables at 1–5 unchanged by the cap raise (the trap);
orb tables zero at 0–5; the load-time guard throws if an orb table's index 0 is non-zero; a piece
inside an orb disc but outside both the mouth and the base circle **is** captured at level 6 and **is
not** at level 5; both `inScoopBox()` callers see it; level 0 byte-identical to the pre-scoop path.

---

## P9 — Scoop loss rate and the reserve

> **Model: Opus 5 · Effort: `ultrathink`**
> Reverses a documented intent and gives an existing mechanism a second job, in the build's single
> most heavily-commented function.

**Commit:** `cs042 p9: scoop loses at 2 hits; a health reserve can absorb the loss`

**Read:** spec §4.4, §4.5. GDD §2.12 (damage — `damageShip()` and the scoop-loss site), §2.14.1,
§2.14 (the health bank), §2.19.

**Part 1 — the rate.** `SCOOP_HITS_PER_LEVEL` **5 → 2**. ⛔ **`DEBUG.scoopHitsPerLevel` keeps its exact
meaning** — a flat hits-per-level count. Only its `def` moves. **No table, no curve.**

⛔ **The build's comment states the stickiness is intended** — *"the scoop is now effectively sticky
once earned. That's the intent, not a bug to 'fix.'"* CS042 reverses that at Paul's request.
**Rewrite the comment to record the reversal and its changeset. Do not delete it.**

⛔ `game.scoopHits` keeps its shape: a running tally, reset only on an actual level loss, never
accumulating at level 0, never reset by a scoop pickup (FORK-3 stands).

**Part 2 — the reserve.** ⛔ **NO TRIGGER CHANGES.** §4.5's table is the reason: scoop loss is already
keyed on **the ship being hit**, and `breakChain(0)` — a hit on a chain node — already leaves the
scoop alone. **That separation is FORK-S1's resolution and a phase must not "unify" the two paths.**
Nor is a `srcTag` test needed: the switch already enumerates exactly the ten sources Paul named, and
shielded / i-framed / auto-shielded hits return before the scoop block entirely.

The bank's auto-spend gains a second job, decided by one threshold. New
`BANK_SPARE_HULL_PCT = 0.70` → `DEBUG.bankSpareHullPct`, min 0, max 1, step 0.05:

| Hull after the hit | The charge does | Scoop |
|---|---|---|
| at or below 70% | **heals** (+25 HP), as today | loses a level |
| above 70% | **spares the scoop** — no heal | **kept** |
| any, with `scoopLevel === 0` | **heals** — nothing to spare | n/a |

⛔ **Never both. One charge, one job.**
⛔ **THE HULL IS READ AFTER THE DAMAGE** — that is why this is a threshold and not "is the hull full".
Damage lands before the bank check, so a literal full-hull rule would be dead code. Say this in the
comment; it is the first thing a reader will question.
⛔ **One charge per damage event** (CS040's FLAG-CS040-b) — unchanged.
⛔ **Still below the `hp <= 0` exit**, so the reserve never rescues a lethal hit.
⛔ **0.70 is P6's `repairMilestoneHullPct`, deliberately** — the changeset has one definition of
"hurt". Cross-reference both comments to each other.

**Tell:** the spare arm pushes a `"SCOOP SAVED"` `FloatText` in `POWERUP_COLOR.scoop`, mirroring the
`"SCOOP -1"` the loss arm already pushes. `AudioSys.bankspend()` still fires either way.

⛔ **Knob endpoints are the gate's A/B:** 1.0 → always heals, scoop always drops. 0.0 → always spares
while a scoop exists.

**Registry:** one new row. ⛔ **Update `scratchpad/test-registry.js`'s count.**

**Test — `scratchpad/test-cs042-p9.js`:**
- ⛔ **`breakChain(0)` leaves `game.scoopLevel` AND `game.scoopHits` untouched, while `damageShip()`
  moves them.** Nothing else in the suite protects FORK-S1's resolution.
- Two hits cost a level; one does not.
- Hull at 50% after the hit → charge heals, scoop drops. Hull at 90% → charge spares, no heal.
- `scoopLevel === 0` → charge heals regardless of hull.
- Bank empty → scoop drops normally.
- A lethal hit never spends a charge.
- `bankSpareHullPct` at 1.0 reproduces pre-phase behaviour.

---

## P10 — Menu navigation repeat

> **Model: Sonnet 5 · Effort: standard**
> Self-contained, two handlers, one timer. The only subtlety (`menuKeys{}`) is spelled out below.

**Commit:** `cs042 p10: menus repeat on a held up/down — delay then rate, both devices`

**Read:** spec §5. GDD §2.16 (menus, options, rebinding — input routing), §2.15 (controller input),
§2.9 (states and controls), §2.19 (registry).

**One shared repeat timer**, ticked once per frame from `loop()` beside `handleGamepadMenu()`, feeding
the existing `menuInput()`.

- `menuRepeat = { dir: null, t: 0 }`.
- `DEBUG.menuRepeatDelay` — `def` from `MENU_REPEAT_DELAY = 0.40`, min 0.1, max 1.5.
- `DEBUG.menuRepeatRate` — `def` from `MENU_REPEAT_RATE = 0.10` (**10/sec**), min 0.03, max 0.5.
- ⛔ **`menuRepeatDelay` at its maximum is effectively pre-phase behaviour** — the gate's A/B.

⛔ **KEEP `if (e.repeat) return;`.** The browser's ~30/sec auto-repeat stays suppressed; the game
supplies its own at its own rate. **The original hazard — spinning the Music Track row and thrashing
the crossfade — is answered by owning the rate, not by removing the guard.** ⛔ **Say this in the
comment there**, or a future reader will see the guard as redundant and delete it.

⛔ **▲/▼ only.** `left`/`right` do **not** repeat — Paul's explicit call, and the direct answer to the
Music Track hazard. ⛔ **`confirm`/`back`/`pause` never repeat.**

⛔ **One timer, both devices.** Neither input handler grows a private copy — the standing "both
handlers or neither" rule (CS030 P4) applied to navigation.

**The obstacle (§5.3).** Branch (2) of the keydown listener returns *before* writing `keys{}`, so no
held keyboard state exists in menus.

- Add a separate `menuKeys{}` map, written in branch (2) on keydown, cleared in the keyup listener.
- ⛔ **It must never write `keys{}`.** That early return is what stops a menu keypress leaking into
  ship rotation and thrust, and it is not being weakened.
- Gamepad direction reads the existing `menuDirState()`, already a held-state read.
- ⛔ **Clear `menuKeys{}` at every `resetMenuNav()` site** — four of them (menu open, the wave-clear
  arm, both celebration-panel opens) — for the same reason `resetMenuNav()` exists.

**Registry:** two new rows. ⛔ **Update `scratchpad/test-registry.js`'s count.**

**Test — `scratchpad/test-cs042-p10.js`:** a held direction fires once, then nothing until
`menuRepeatDelay`, then once per `menuRepeatRate`; releasing stops it; `left`/`right` never repeat;
`confirm` never repeats; a direction held across a screen change does not repeat into the new screen;
`menuKeys{}` is never written into `keys{}`; `menuRepeatDelay` at max reproduces pre-phase behaviour.

---

## ⛔ GATE C — blocking playtest

**Nothing after this line is built until Paul answers.** Spec §7 carries G1–G10 in full.

⛔ **Clear the debug overrides before asking anything numeric (FLAG-CS036-a).** Any install that has
ever saved settings is not running shipped defaults, and this has spoiled at least one prior gate.

Every question routes to P11's tuning pass. ⛔ **If G7 finds `SHIP_DRAG` kills the drift, the answer is
a lower drag — not reverting P7's model.** The two are separable and must be judged separately.

---

## P11 — Closing

> **Model: Sonnet 5 · Effort: standard**

**Commit:** `cs042 p11: tuning pass, docs, version bump, archive`

1. **Tuning pass** from GATE C. ⛔ **A no-op commit here is a fine outcome** if the gate found the
   defaults right.
2. **GDD §2 updates**, by named subsection: §2.8 (twelve new sounds + the trigger-site rule), §2.7 and
   §2.14 (health supply), §2.14.1 (scoop levels 6–7, orbs, the 2-hit rate), §2.12 (the reserve's
   second job), §2.1 and §2.10.2 (the handling model and drag), §2.16 (menu repeat), §2.20.1 (whatever
   P5 shipped).
3. ⛔ **Re-measure every row of GDD §0's size column** before writing `STATUS.md`'s headline number —
   this changeset edits GDD content, so §0's snapshotted sizes are invalid.
   `scratchpad/gdd-sizes.py --check` does it in one command if it is kept (see `TODO.md`).
4. ⛔ **Check `CLAUDE.md` against its own 50 KB ceiling.** It measured **48.4 KB with ~1.6 KB of
   headroom** at CS041 P9. This changeset adds rules to it (the SFX trigger-site rule, the scoop orb
   guard, the menu-repeat contract, three new labs) and **will cross it.** Past the ceiling the valve
   fires: a section over ~4 KB moves its *reasoning* into `RATIONALE.md` under an `#anchor` and keeps
   its *rule* here. `### Audio` (5.3 KB) is the first candidate and this changeset edits it — **so the
   valve fires on `### Audio` this phase**, not as a standing sweep.
5. **`DIFFICULTY-LEVERS.md`** — §4 for the new health, handling and reserve knobs, if it names them.
6. **`TELEMETRY-ANALYSIS-GUIDE.md`** — §7, the `scoopHits` sawtooth rate change (P9).
7. **Version bump** `1.0.0.40` → `1.0.0.41`. ⛔ At a version bump a phase-local version pin flips to
   its standing mirror image (`!== "1.0.0.N"`); it is **not** re-pointed to a new literal. The small
   deliberate set of live pins that genuinely track HEAD's version **is** re-pointed.
8. **`STATUS.md`** rolled into `log/CS042.md` (with its `## GDD version history` entry) and reset.
9. **Both planning docs archived** to `archive/`.
10. **`TODO.md`** — clear the stale "RESUME HERE" block if CS042 superseded it; carry forward anything
    this changeset did not reach.
11. ⛔ **Assert zero skips** in the suite. A closing phase does.

---

## Close checklist

- [ ] `node scratchpad/run-all.js` — green, **zero skips**.
- [ ] `node --check` on the extracted script.
- [ ] The game opens and plays from `file://` by double-click.
- [ ] All three labs open standalone and their copy-out blocks still emit valid text.
- [ ] `scratchpad/test-registry.js` carries the new registry count and nothing else duplicates it.
- [ ] Every new `DEBUG_VARS` row has a `def` deriving from its shipped constant.
- [ ] `repairMilestoneHullPct` and `bankSpareHullPct` still agree (both 0.70 unless the gate moved
      them together).
- [ ] Every reversed prior decision is **rewritten in place with its changeset**, never deleted:
      CS040 P1's health-gate placement (P6), `CARGO_MAXSPD`'s retirement if Model C shipped (P7),
      v3.4 P3's scoop-stickiness note (P9), CS025 P5's keydown auto-repeat comment (P10).
- [ ] Every decision **not** reversed is still standing and still true: CS024 P6's flat-engine rule,
      FORK-3's no-reset-on-pickup, CS025 P5's magnet-recolour prohibition.
- [ ] GDD §0 size rows re-measured. `CLAUDE.md` under 50 KB, or the valve fired on `### Audio`.
- [ ] `STATUS.md` rolled and reset; both planning docs archived.
- [ ] **Not pushed.**
