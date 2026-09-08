# PLANNED-FEATURES-CS042.md

**Changeset:** CS042
**Base:** `71ab1bc` ("off-cycle: GDD accuracy pass"), `GAME_VERSION 1.0.0.40`
**Theme:** Feedback and feel. Every announced event gets a sound of its own; the tow chain gets heavy
enough that the Engine matters; the Scoop becomes worth wanting and easy to lose; health stops being
free; menus scroll like menus; and three design instruments are built before anything is tuned by
guesswork.

**Evidence base:** direct reading of the shipped build at `71ab1bc` — every number in §1–§6 was
measured or computed from it, not recalled. **No new telemetry capture exists** (CS039 GATE T is waves
1–5 and predates CS040's healing rework), so §2's and §6's numbers are analytic. That is stated at
each one, and §6's are why P0's lab exists.

**Three labs ship before any tuning phase.** Paul asked for instruments rather than guesses on
handling (§6) and sounds (§1), and the ceremony (§3) was already going to need one. All three land
first, then one gate where he uses them together.

---

## 0. Scope

**In:**

1. **A unique sound effect for every event that has a voice line** (§1), chosen from a lab that offers
   **three candidates per sound**. Nine events have no cue at all today.
2. **Health supply levelling** (§2) — health pickups appear too often and can coexist on screen.
3. **Three design instruments** (§3, §1.6, §6.6): `tools/ceremony-lab.html`, `tools/sfx-lab.html`,
   `tools/handling-lab.html`.
4. **The Scoop redesign** (§4) — two more levels, flanking orbs, discernible steps, twice as easy to
   lose, and a new interaction where the health reserve can absorb the loss.
5. **Menu navigation key repeat** (§5) — up and down only.
6. **Engine and tow-chain handling** (§6) — the Engine's fuel stops burning when it is doing nothing,
   and the chain gets heavy enough for the Engine's relief to be felt.
7. Doc sweep, GDD §2 updates, version bump to `1.0.0.41`.

**Explicitly out, and not to be re-proposed inside this changeset:**

- **A voice-line writing pass.** `CS039-VOICE-WORKLIST.md` records which events most need
  alternatives. That needs Paul in `tools/voice-robot-lab.html` and is not implementation work.
  ⛔ **No `phon` string is derived, edited or improved by this changeset** (`CLAUDE.md`, Audio 2).
- **Renaming `game.debris` / `game.garbage`.** The inversion is load-bearing history.
- **Reworking the Magnet.** §4.2 measures Magnet against Scoop only to size the Scoop.
- **A second telemetry capture.** Needed, and named in `TODO.md`, but it is a Paul task.
- **Any Engine effect that works on an empty chain.** ⛔ **Decided: the Engine does nothing with an
  empty chain, exactly as today.** An earlier draft of this spec proposed cargo-independent thrust,
  top-speed and drag multipliers for the Engine. **That is withdrawn** — see §6.4. Do not re-propose it.

### 0.1 One thing Paul remembers correctly

> *"I thought we already specced this out, but I don't see any difference."*

He did. `archive/PLANNED-FEATURES-CS040.md` §0 lists, under **Explicitly out**:

> **Scoop redesign** (two new levels, side orbs, damage-weighted loss). Deferred to its own
> changeset — it is a second large difficulty increase and stacking it here makes the playtest gate
> uninterpretable.

It was scoped, deferred deliberately, and never built. `log/CS040.md:22` repeats it. That deferral is
what §4 discharges.

⛔ **`ANALYSIS-RESPONSE.md`, which CS040's plan cites for the fourth piece ("FORK-S1", sever-linked
scoop loss), is not in this repo.** It is referenced from `archive/PLANNED-FEATURES-CS040.md` and
exists nowhere on disk or in `log/`. Recorded so a future session does not spend a phase looking for
it. FORK-S1 is nonetheless **resolved** by §4.5 — and resolved to "the build already does this right."

---

## 1. A sound for every announced event

### 1.1 The problem

CS038 P4 made voice lines play less often — correctly, and it is not being reversed. But several
events had **no cue but the voice**, so making the voice rare made the *event* silent. The sound
effect tells the player something happened; the voice is flavour on top of it.

### 1.2 The audit — every voice event, and what it sounds like today

23 events. The `SFX today` column is what actually reaches the speakers at that trigger instant.

| Event | Trigger site | SFX today | Verdict |
|---|---|---|---|
| `health_low` | `update()` low-hull rising edge | `lowhp(true)` — the siren *starts* | Fades up; no onset punctuation |
| `health_relief` | falling edge | `lowhp(false)` — the siren *stops* | ⛔ **No positive cue.** Relief is silence |
| `health_full` | `hp >= SHIP_MAX_HP` edge | — | ⛔ **None** |
| `collect_rapid` | `applyPowerup()` | `powerup()` | Shared by all six types |
| `collect_triple` | `applyPowerup()` | `powerup()` | Shared |
| `collect_magnet` | `applyPowerup()` | `powerup()` | Shared |
| `collect_engine` | `applyPowerup()` | `powerup()` | Shared |
| `collect_scoop` | `applyPowerup()` scoop arm | `powerup()` | Shared |
| `expire_rapid` | `update()` falling edge | — | ⛔ **None** |
| `expire_triple` | `update()` falling edge | — | ⛔ **None** |
| `expire_magnet` | `update()` falling edge | — | ⛔ **None** |
| `expire_engine` | `update()` falling edge | — | ⛔ **None** |
| `expire_scoop` | `damageShip()` | `scooploss()` | ✅ Unique already |
| `dock_5` / `_10` / `_15` / `_20` | delivery pop that empties the chain | `deliver(n)` per canister | A per-piece climb, not a haul-size verdict |
| `dock_24` | `superMegaDelivery()` | — | ⛔ **None.** The biggest event in the game is silent |
| `cargo_full` | the pickup that fills the chain | `pickup()` | Identical to every other hook |
| `chain_broken` | `breakChain(i > 0)` | `boom()` → `explosion(1)` | Shared with every destruction |
| `chain_lost` | `damageShip()` release, `breakChain(0)` | `hit()` + `boom()` | ⛔ Indistinguishable from any hit |
| `chain_guard` | `breakChain()` guard branch | `shieldPing()` | Borrowed from the *ship's* shield |
| `level` | `nextWave()` | — | ⛔ **None** |

**Nine events have no sound at all. Four more share a generic one.**

### 1.3 The rule — and where the call goes

⛔ **The SFX call goes at the TRIGGER SITE, immediately above the `VoiceSys.say()` call, never inside
`_emit()`.** `_emit()` is the one cooldown/priority/criticality gate. A sound placed inside it would
inherit the drop, park and repeat-suppression rules, which is precisely the opposite of the
requirement. At the trigger site the sound is unconditional, and — because `say()` is called on the
next line and `_schedule()` leads by 0.10 s — the sound lands just before the voice on every occasion
the voice survives the gate. **That ordering is a consequence of the placement, not a second
mechanism**, and no sequencing code is added to obtain it.

⛔ **`AudioSys` stays a flat bag of one-shot voices and does not grow a sequencer** (`CLAUDE.md`,
Audio). Each new method builds its own oscillator/gain graph and schedules it, exactly as
`achievement()`, `hunterborn()` and `scooploss()` already do. `MusicSys` is not touched.

⛔ **Every entry point is `if (!this.ctx) return;`-guarded**, like every existing one — headless-safe.

### 1.4 The twelve new sounds

Names follow the existing single-lowercase-word convention.

| Method | Serves | Character brief for the lab |
|---|---|---|
| `cargofull()` | `cargo_full` | **"Filling up."** Ascending, landing and latching — a tank topping off. **The anchor sound.** |
| `cargolost()` | `chain_lost` | **"Running out."** ⛔ Built from `cargofull()`'s intervals **reversed**, so the pair is a matched set by construction, not by ear. |
| `chainsever()` | `chain_broken` | A *smaller* `cargolost()`. ⛔ Must be audibly lesser — partial loss versus total loss is the distinction it carries. |
| `guardblock()` | `chain_guard` | Metallic, armoured. Distinguishable from the ship's own shield, which it currently borrows. |
| `levelup()` | `level` | Confident, rising. ⛔ Distinct from `achievement()` — the two can land seconds apart at a level end. |
| `hullfull()` | `health_full` | Soft, warm, settled. Quieter than `powerup()`; reassurance, not reward. |
| `hullrelief()` | `health_relief` | An exhale. The audible half of the visual exhale flash, which has no partner today. |
| `hullcritical()` | `health_low` | An alarm hit punctuating the siren's fade-up. ⛔ Additive — `lowhp(true)` is unchanged. |
| `powertag(type)` | `collect_*` | A short tag note after the unchanged `powerup()` chime, on a per-type root. |
| `powerfade(type)` | `expire_*` | `powertag()` inverted: same root, descending, no preceding chime. |
| `haulsize(n)` | `dock_5/10/15/20` | A tier stinger over the per-canister `deliver()` climb — the player hears *how big*. |
| `megadelivery()` | `dock_24` | The largest cue in the game. The Super Mega Delivery is currently silent. |

**Per-type roots for `powertag`/`powerfade`** — a small data table beside `POWERUP_COLOR`, so adding a
powerup type later is a one-row edit: `rapid` high/bright · `triple` a third under it · `scoop` mid ·
`magnet` mid-low · `engine` low · `guard` low with a doubled octave.

⚠ `health` has no `collect_` line by design (it speaks through the hull-full latch) and takes no
`powertag`. **Do not build a `collect_health` event to fill the table** — that is a design change.

### 1.5 What this does NOT change

⛔ `VOICE_LINES`, `VOICE_PRIORITY`, `VOICE_CRITICAL`, `VOICE_STILL_TRUE`, `VOICE_REPEAT_GAP`, the park
queue, `_emit()`'s gate arithmetic and every `phon` string are **untouched**. This changeset adds
sound *beside* the voice channel and changes nothing *inside* it.

### 1.6 `tools/sfx-lab.html` — three candidates per sound

⛔ **Nothing is written into the build until Paul has picked.** The lab offers **three distinct
candidates for each of the twelve sounds — 36 in all** — auditioned individually and in context.

Requirements:

1. **A grid of twelve rows**, one per sound, three audition buttons each, plus a "picked" radio.
2. **Every candidate is a self-contained Web Audio graph** in the shipped `AudioSys` idiom — an
   oscillator/gain/filter chain scheduled at call time. ⛔ **No sequencer, no sample, no external
   asset.** What the lab plays must be portable into `AudioSys` verbatim.
3. ⛔ **`cargofull` and `cargolost` are auditioned as a PAIR.** Each `cargolost` candidate derives its
   frequencies from its matching `cargofull` candidate, reversed. Picking one picks both.
   `chainsever` auditions immediately after `cargolost` so "smaller" can be judged, not assumed.
4. **Context playback:** a button per row that plays the candidate against the sounds it will really
   sit beside — `powerup()` before a `powertag`, `deliver()` before a `haulsize`, `explosion(1)`
   under a `chainsever`, `achievement()` next to `levelup`. ⛔ **The neighbours are ported verbatim
   from the build** so the comparison is honest; they are the only port-in the lab carries.
5. **Master/SFX volume sliders** matching the game's own categories, so nothing is picked at a
   loudness the game never plays it at.
6. **A copy-out block** emitting the twelve picked candidates as finished `AudioSys` methods, ready
   to paste. **That block is what the SFX phases port.**

---

## 2. Health supply levelling

### 2.1 The three sources, in plain terms

Health pickups reach the field by exactly three routes. Two of them ignore each other.

1. **The ambient timer.** `game.healthTimer` counts down; on expiry it spawns one **only if no health
   pickup is already on the field**. The gap is re-rolled by `healthGapRoll()`, which interpolates on
   *missing hull*: `[22, 30]` seconds at full hull down to `[6, 10]` seconds at zero hull.
2. **The score milestone.** Every `REPAIR_MILESTONE` (10,000) points, if the hull is below maximum, it
   spawns one and plays `shieldPing()`. ⛔ **This route does not consult the one-at-a-time gate** —
   that gate lives at the ambient call site, not inside `spawnHealthPowerup()`. CS040 P1 says so in a
   comment, deliberately, and predicts that moving it *"would be a design change, not a tidy-up."*
3. **The Super Mega Delivery.** `"health"` sits in the seven-type per-piece sweep pool, rolled flat, so
   roughly one in seven swept Hunter pieces drops one, up to `DEBUG.sweepPowerupCap`.

A fourth thing is not a spawn but multiplies supply: the **health bank** (`DEBUG.healthBankMax` = 2),
which banks a whole 25-HP charge from a pickup taken at high hull. §4.5 gives that reserve a second
job, which makes it more valuable still — another reason the supply side needs pulling back.

### 2.2 Why it feels like a flood

Three compounding effects, none of them a bug on its own:

- **The milestone accelerates on its own.** A milestone is a flat 10,000 points, but score rate climbs
  with wave. Late in a run milestones arrive far faster than early, with no ramp anywhere saying so.
  CS040 P1 identified exactly this shape as the reason milestone *healing* had to go — the spawn arm
  inherited it.
- **The full-hull gate is 249/250, not "hurt".** `hp < SHIP_MAX_HP` is satisfied by a single scratch.
- **Two ungated routes plus one gated one.** The ambient gate prevents coexistence only among ambient
  spawns. A milestone or a sweep can put a second and third on the field beside it.

⚠ **Analytic, not measured.** No telemetry capture exists on the CS040 build. G3 asks for the
observation this section is missing.

### 2.3 The proposal — five changes, each behind a knob

| # | Change | Effect |
|---|---|---|
| **a** | **One global spawn lock.** `game.healthSpawnLock` (seconds), set by *every* spawn, respected by *all three* routes. `DEBUG.healthSpawnLock`, default **12 s**, min 0 disables. | Structurally bounds the rate whatever the source. The highest-value change here. |
| **b** | **Move the one-at-a-time gate into `spawnHealthPowerup()`.** | Makes "more than one on screen" impossible by construction. ⛔ This is the design change CS040 P1's comment predicted; it is deliberate, and that comment is rewritten, not deleted. |
| **c** | **Make the milestone interval grow.** `game.nextRepair += REPAIR_MILESTONE * (1 + DEBUG.repairMilestoneGrowth * game.wave)`, default growth **0.08**. | Wave 1: next milestone 10,800 away. Wave 15: 22,000. Cancels the automatic acceleration without touching score values. |
| **d** | **Gate the milestone on real damage.** Fire only while hull is at or below **70%** of maximum (`DEBUG.repairMilestoneHullPct`). | A scratch no longer earns a pickup. ⛔ **70% is the changeset's one definition of "hurt"** — §4.5's reserve threshold uses the same number, and they are meant to agree. |
| **e** | **Widen the ambient gap's hurt end.** `[6, 10]` → `[10, 16]`; full-hull end `[22, 30]` → `[30, 45]`. | The four `healthGap*` knobs already exist; this is a `def` change, no new mechanism. |

**Also available, not recommended as defaults:** drop `"health"` from the sweep pool (a one-word edit
at `superMegaDelivery()`'s `pool`), and lower `DEBUG.healthBankMax` from 2 to 1.

⛔ **CS040's rescue must survive.** The milestone spawn exists because removing milestone healing
outright killed both replayed runs many waves early. (c) and (d) *slow and qualify* it; neither
removes it. **Do not tune (d) so tight the arm stops firing.**

---

## 3. The ceremony instrument — `tools/ceremony-lab.html`

### 3.1 Why a tool and not an edit

Paul's report is *"clunky"* and *"not smooth"* — a judgment about pacing that cannot be turned into
constants by guessing. The tool exists so he can **choose** rather than describe.
⛔ **It duplicates whatever slice of the sequences it needs; it does not import build code.**

### 3.2 Sequence A — Level End, as shipped

| # | Beat | Ends on | Field |
|---|---|---|---|
| 1 | Last Garbage Satellite dies. The frame runs to its own end (achievements bank here) | frame end | live |
| 2 | **"Level N Complete"** fades in over `levelBannerFade` (0.5 s), then holds | **player confirm — indefinite** | frozen |
| 3 | **Achievements panel**, if anything unlocked. ⛔ Hard cut in and out, no fade | **player confirm — indefinite** | frozen |
| 4 | `nextWave()`; **"Level N+1"** banner (2.2 s) + Dan's line + music intensity + payload slots | — | frozen |
| 5 | Freeze lifts when the banner has 0.5 s left — **1.7 s in, mid-banner** | — | live, protected |
| 6 | Banner expires → `levelEndGrace` counts down | grace = 0 | live, protected |
| 7 | Normal play | — | live |

**Four candidate sources of the clunk, each a tool control:**

- **Two consecutive indefinite input gates** (beats 2 and 3) whenever anything unlocked.
- **The panel is a hard cut** at both ends. `menuPanel()` fills before it strokes; there is no fade
  anywhere in `drawCelebration()`.
- **The freeze lifts mid-banner** (beat 5). The field moves under an announcement still being read.
- **Beat 2 waits forever.** No auto-advance, by design (FORK-CS036-E, "still no timer").

### 3.3 Sequence B — Game Over, as shipped

| # | Beat | Ends on | Field |
|---|---|---|---|
| 1 | `killShip()` → `"dying"`; the death spectacle's reduced sim | `DEATH_DURATION` **2.5 s** | reduced |
| 2 | → `"gameover"`; `RunResult` built, leaderboard submitted, high score written | instant | frozen |
| 3 | **Achievements panel**, if anything unlocked. Hard cut | **player confirm** | frozen |
| 4 | **GAME OVER + FINAL SCORE + the 10-row table + the footer hint, all at once** | **player confirm** → `startGame()` | frozen |

Candidate clunk: beat 4 arrives in a single frame with no stagger, behind another hard-cut modal.

### 3.4 What the tool must do

1. **Two tabs**, Level End and Game Over, each a scrubbable timeline over a mock 1280×720 canvas
   carrying the real chrome — frozen starfield, the announcement, the panel silhouette (820×560, its
   real size), the banner, the GAME OVER stack.
2. **Per-beat controls:** duration; input-gated versus timed; fade-in and fade-out curve; overlap with
   the previous beat; frozen versus live; and for beat 5, **thaw as a switch or as a ramp**.
3. **Named preset variants:** **Current (shipped)** · **Auto-advance** · **Cross-fade** · **Merged** ·
   **Compressed**.
4. **A/B toggle** between the working preset and Current (shipped), on one key.
5. **A copy-out block** naming every beat, duration and transition chosen — the artefact the ceremony
   phase is built from.

⛔ Anything the tool recommends for the build must be renderable through `drawPoly`/`glowStroke` —
`drawText` and the low-hull glow are §3.2's only sanctioned fill exceptions.

---

## 4. The Scoop — two more levels, real steps, real risk

Discharges CS040's deferred scope (§0.1).

### 4.1 How it works today

- **Acquired:** only from the `"scoop"` powerup — weight **20** in `POWERUP_DROP_WEIGHTS`, whose
  weights total ~120, so ~17% of ordinary drops. Also the recycle hub's guaranteed per-visit award and
  the Super Mega Delivery's guaranteed set. Each pickup is **+1 level**, capped at
  `SCOOP_MAX_LEVEL` = 5; a pickup at cap pays `SCOOP_MAX_BONUS` (500) instead.
- **Lost:** `SCOOP_HITS_PER_LEVEL` = **5** non-lethal hits cost one level. `game.scoopHits` is a
  running tally, reset only when a level is actually lost, and does not accumulate at level 0.
- **Effect:** exactly one — `inScoopBox()`, an oriented capture box on the ship's facing axis, OR'd
  with the base pickup circle. It captures **both** Debris and powerups. There is no other scoop
  effect anywhere in the build.

### 4.2 Measured: the levels really are not discernible

`SCOOP_CONFIG` is `minWidthMult 1.2`, `maxWidthMult 5.0`, `minDepth 20`, `maxDepth 60`, `curve 1.0`,
over `SHIP_DRAW_W` = 18 and `SHIP_RADIUS` = 13. The box spans `|lateral| ≤ W/2` and
`−SHIP_RADIUS ≤ forward ≤ D`. The base pickup circle is `GARBAGE_PICKUP` = 18, area 1,018 px².

| Level | Mouth width | Depth | Box area | vs base circle |
|---|---|---|---|---|
| 0 | — | — | 0 | 1.0× |
| 1 | 21.6 | 20 | 713 px² | **~1.1×** |
| 2 | 38.7 | 30 | 1,664 px² | ~2.0× |
| 3 | 55.8 | 40 | 2,957 px² | ~3.2× |
| 4 | 72.9 | 50 | 4,593 px² | ~4.8× |
| 5 | 90.0 | 60 | 6,570 px² | ~6.7× |

Three findings:

1. ⛔ **Level 1 sits almost entirely inside the base circle.** ±10.8 lateral and −13 to +20 forward,
   against an 18-px-radius disc. The first pickup — the one that teaches what a Scoop *is* — changes
   almost nothing. The sharpest single defect here.
2. ⛔ **The Magnet beats Scoop levels 1 and 2 outright.** `MAGNET_PICKUP_MULT` 1.6 gives r = 28.8, area
   2,606 px², *and* a 380 px pull range. The Scoop's best reach is 60 px forward.
3. **The whole ramp is one shape getting bigger.** No level grants a *capability*, only a number.

### 4.3 The redesign

**Levels 1–5 keep the mouth. Levels 6 and 7 add flanking orbs.**

⛔ **The orbs are a new *capability*, not a bigger number.** Every level to date extends the forward
cone; the orbs give the Scoop **lateral** reach for the first time — the ship sweeps a corridor rather
than a wedge. That qualitative break is what makes the top levels feel earned.

**Geometry.** Two orbs, one per side, at `±SCOOP_ORB_OFFSET[lvl]` lateral in ship-local space,
carrying independent capture discs of radius `SCOOP_ORB_R[lvl]`, OR'd into the capture region beside
the mouth and the base circle. Starting values, to be re-picked in the lab:

| Level | Mouth | Orb offset | Orb radius | Orb area (both) | Total vs base |
|---|---|---|---|---|---|
| 6 | L5's mouth | ±62 | 26 | 4,247 px² | ~10× |
| 7 | L5's mouth | ±84 | 34 | 7,263 px² | ~13× |

**Render.** Each orb a small stroked ring through `drawPoly`/`glowStroke` in `POWERUP_COLOR.scoop`,
with a faint tether line to the hull at level 7. ⛔ **No fills** (Pillar 1). Drawn in `Ship.draw()`
alongside the existing mouth prong-V, before the hull.

**Fixing levels 1–4.** Raise the floor so the first pickup is felt: `minWidthMult` **1.2 → 2.6**
(mouth 21.6 → 46.8 px) and `minDepth` **20 → 34**. Level 1 then covers ~2,246 px² — clearly outside
the base circle and just ahead of the Magnet, which is the right relationship, since Scoop is
persistent and Magnet is not.

⛔ **THE TRAP.** `buildScoopSteps()` divides by `(SCOOP_MAX_LEVEL − 1)`. Raising `SCOOP_MAX_LEVEL`
from 5 to 7 **re-spreads the mouth curve across seven levels and silently shrinks levels 1–5.**
FORK-CS042-A resolves it **(a)**: the **mouth table keeps its own five-step span** (`SCOOP_MOUTH_LEVELS`
= 5), and levels 6–7 read level 5's mouth and add orbs. The mouth's numbers do not move when the cap does.

⛔ **The load-time guard stays and grows.** `SCOOP_WIDTH[0] !== 0 || SCOOP_DEPTH[0] !== 0` throws by
design and is what makes `inScoopBox()` return `false` at level 0. **The two new orb tables must carry
the same index-0-is-zero property and be covered by the same guard**, or a level-0 ship silently grows
orbs.

⛔ **The HUD ring reflows for free.** `drawRingSegments(…, SCOOP_MAX_LEVEL, …)` derives its segment
count and never hardcodes 5 — CS012's FLAG-CS012-1b exists precisely for this. **Verify seven segments
are legible at `HUD_FX_RING_R`**; if not, that is a HUD tuning note, not a reason to cap the levels.

### 4.4 Losing it — twice as easy, flat

`SCOOP_HITS_PER_LEVEL` **5 → 2**. ⛔ **`DEBUG.scoopHitsPerLevel` keeps its exact meaning** — the knob
is a flat hits-per-level count, as it has always been, and only its `def` moves. No table, no curve.

Against roughly seven non-lethal hits in a full-health run, a player now loses **three or four** scoop
levels across a run instead of one. That is the intended feel: **you notice it going.**

⛔ **The build's own comment currently states the stickiness is intended** — *"the scoop is now
effectively sticky once earned. That's the intent, not a bug to 'fix.'"* CS042 reverses that call at
Paul's request. **Rewrite the comment to record the reversal and its changeset. Do not delete it.**

⛔ `game.scoopHits` keeps its shape: a running tally, reset **only** on an actual level loss, never
accumulating at level 0, never reset by a scoop pickup (FORK-3 stands). It remains a **telemetry
sawtooth** — `TELEMETRY-ANALYSIS-GUIDE.md` §2/§3/§7 exclude it by name and that exclusion still holds.
Only the column's *rate* moves; **note the rate change in the guide's §7** so a future analysis does
not read a steeper sawtooth as a defect.

### 4.5 The health reserve absorbs the scoop loss — FORK-S1, resolved

Paul's rule: **a direct hit costs a scoop level, unless the player has a banked health charge to
spend instead.**

⛔ **FORK-S1 (sever-linked scoop loss) is resolved by the build already being right, and the
distinction is real.** Paul: *"Losing your whole payload is not an event that causes loss of a scoop
level. However, when the player ship is directly hit … that causes a loss of whole payload, and I
think it should also cause the loss of a scoop level."* Those are two different events and the code
already separates them:

| Event | Payload | Scoop | Correct today? |
|---|---|---|---|
| `damageShip()` — the **ship** is hit | released | counter increments | ✅ yes |
| `breakChain(0)` — a **chain node** is hit, ship untouched | lost | **untouched** | ✅ yes |
| `scatterChain()` — ship death | scattered | irrelevant | ✅ yes |

⛔ **So no trigger changes.** Scoop loss is already keyed on the hit, not on the payload. **A phase
must not "unify" these two paths** — the separation is the feature.

Nor does the hit need a new source test. `damageShip()`'s `srcTag` switch already enumerates exactly
the ten sources Paul named — `debris1/2/3` (Garbage Satellites), `hunter1/2/3` (Hunter Satellites),
`ufoBodyLarge/Small`, `ufoShotLarge/Small` — and shielded, i-framed and auto-shielded hits return
earlier and never reach the scoop block at all. **"Directly hit by a UFO shot, a UFO, or any kind of
satellite" is exactly the set of hits that already reaches it.**

**What is new: the reserve.** The bank's auto-spend already sits a few lines above the scoop block in
the same function, spending one charge per damage event while `hp < SHIP_MAX_HP`. It gains a second
job, and which job it does is decided by one threshold.

⛔ **THE HULL IS READ AFTER THE DAMAGE, AND THAT IS WHY THIS IS A THRESHOLD AND NOT "IS THE HULL
FULL".** Damage is applied before the bank check, so the hull is essentially never at maximum there; a
literal "only when full" rule would be dead code. `DEBUG.bankSpareHullPct` = **0.70**:

| Hull after the hit | The charge does | Scoop |
|---|---|---|
| **at or below 70%** | **heals** (+25 HP), as today | loses a level |
| **above 70%** | **spares the scoop** — no heal | **kept** |
| any, with `scoopLevel === 0` | **heals** — there is nothing to spare | n/a |

⛔ **Never both.** One charge, one job. ⛔ **One charge per damage event** (CS040's FLAG-CS040-b) —
unchanged. ⛔ **Still below the `hp <= 0` exit**, so the reserve never rescues a lethal hit.

⛔ **70% is the same number as §2.3(d)'s milestone gate, deliberately.** The changeset has one
definition of "hurt" and the two must move together if either moves.

**The knob spans the whole design space, which is what makes it gate-friendly:**
`bankSpareHullPct` **1.0** → the hull is never above it, so the charge always heals and the scoop
always drops (today's behaviour plus the new loss rate). **0.0** → always spares while a scoop exists.
**0.70** → the shipped rule.

**Tell:** the existing `AudioSys.bankspend()` fires either way, but the spare arm needs its own
floater so the player learns the rule — a `"SCOOP SAVED"` `FloatText` in `POWERUP_COLOR.scoop`,
mirroring the `"SCOOP -1"` the loss arm already pushes.

---

## 5. Menu navigation key repeat

### 5.1 What happens today

**Nothing repeats, on either device, and both are deliberate.**

- **Keyboard:** `if (e.repeat) return;` in the keydown listener's menu branch. Its comment gives the
  reason: browser auto-repeat is ~30/sec, which *"would otherwise spam menu actions — e.g. spin the
  3-value Music Track row back to its start and re-enter `setState()` nearly every frame, restarting
  the crossfade ramp and pinning the music near-silent."*
- **Gamepad:** `menuNavEdges()` is strictly edge-detected, so a held D-pad or stick moves once.

### 5.2 The proposal

⛔ **Keep `if (e.repeat) return;`.** The browser's auto-repeat stays suppressed. The game supplies
**its own** repeat, at its own rate, from the frame loop — so the original hazard is answered rather
than reintroduced. Ten per second is not thirty, and the rate is ours.

⛔ **One timer, driving `menuInput()`, shared by both devices.** Neither input handler grows a private
copy — the standing "both handlers or neither" rule (CS030 P4) applied to navigation.

- `menuRepeat = { dir: null, t: 0 }`, ticked once per frame from `loop()` beside `handleGamepadMenu()`.
- `DEBUG.menuRepeatDelay` — first repeat after **0.40 s** held. Range 0.1–1.5.
- `DEBUG.menuRepeatRate` — **0.10 s** between repeats thereafter (**10/sec**). Range 0.03–0.5.
- ⛔ **`menuRepeatDelay` at its maximum is effectively the pre-phase behaviour** — the gate's A/B.

⛔ **Up and down only. `left`/`right` do NOT repeat** — Paul's explicit call. Value rows are what the
original guard was written to protect, and a repeating ◄/► would still re-enter `setState()` ten times
a second.

⛔ **`confirm` / `back` / `pause` never repeat.** A repeating confirm would blow through nested screens
in a tenth of a second.

### 5.3 The obstacle, and the fix

⛔ **The menu branch never records held keyboard state.** Branch (2) of the keydown listener returns
*before* writing `keys{}` — that early return is exactly what stops a menu keypress leaking into ship
rotation and thrust. So the repeat timer has nothing to ask "is the arrow still down?"

**Fix:** a separate `menuKeys{}` map, written in branch (2) on keydown, cleared in the keyup listener.
⛔ **It must never write `keys{}`.** Gamepad direction reads the existing `menuDirState()`, already a
held-state read.

⛔ **Clear `menuKeys{}` at every `resetMenuNav()` site** — there are four (menu open, the wave-clear
arm, both celebration-panel opens) — for the same reason `resetMenuNav()` exists: a direction held
across a screen change must not repeat into whatever takes input next.

---

## 6. The Engine, the tow chain, and drag

### 6.1 How the Engine works today

- **Acquired:** weight **10** of ~120 in `POWERUP_DROP_WEIGHTS` — tied with Magnet as the rarest
  ordinary drop. Plus the recycle hub's award (×`DEBUG.hubDryWeightMult` = 4 when dry) and the Super
  Mega Delivery's guaranteed set.
- **Times out:** `DEBUG.engineBurnSeconds` = **10.0 seconds**, decremented inside `Ship.update()`'s
  thrust branch — so rotating, coasting, firing and idling already cost nothing. A second pickup
  **adds** 10 s rather than refreshing. Hard cutoff at zero.
- **Effect — and there is exactly one:** `chainMass()` returns `m × DEBUG.engineMassMult` (0.5) while
  fuel remains, feeding `thrustMul`, `maxSp`, and `updateChain()`'s momentum tug.

### 6.2 Why it feels like nothing

⛔ **With an empty chain the Engine does literally nothing.** `chainMass()` returns 0 either way.
**And the fuel still burns**, because the burn is unconditional inside the thrust branch. A player who
picks it up and flies unloaded spends the entire tank on nothing at all.

| Chain | Accel, no Engine | Accel, Engine | Top speed, no Engine | Top speed, Engine |
|---|---|---|---|---|
| 0 nodes | 340 px/s² | 340 (**+0%**) | 520 px/s | 520 (**+0%**) |
| 4 nodes | 266 | 298 (+12%) | 456 | 486 (+7%) |
| 12 nodes | 185 | 243 (+31%) | 366 | 424 (+16%) |
| 24 nodes | 127 | 185 (+46%) | 283 | 366 (+29%) |

The relief is real at a full chain and negligible everywhere else — and most of a run is spent
somewhere in between.

### 6.3 Drag never sets your top speed — and what to do about it

`SHIP_DRAG` 0.35 per second is a continuous decay rate of λ = −ln(0.65) = **0.431/s**. Thrust alone
would settle the unloaded ship at 340 / 0.431 = **789 px/s**, far above the 520 cap.

⛔ **So drag never sets the unloaded ship's top speed — `SHIP_MAX_SPEED` does.** Drag only shapes the
coast (half-life 1.61 s). **That is why no thrust or mass improvement can show up as speed:** top
speed is a hard clamp, and a clamp does not care what is pushing against it.

Laden, the two nearly coincide and the clamp still wins: at 24 nodes, drag would settle the ship at
294 px/s and the cap is 283. The Engine's mass halving moves the *cap* to 366, so it is felt — but
only because the cap moved, not because the ship got faster in any physical sense.

**Three models. The lab (§6.6) A/Bs all three; this section recommends one.**

| | Model | What changes | Consequence |
|---|---|---|---|
| **A** | **Today.** `maxSp = SHIP_MAX_SPEED / (1 + cargo·CARGO_MAXSPD)`, fixed drag. | nothing | The clamp binds nearly everywhere; thrust changes are invisible. |
| **B** | **Heavier cargo, same structure.** Raise `CARGO_THRUST` and `CARGO_MAXSPD` until a laden ship is drag-limited rather than cap-limited. | two constants | Smallest change. The Engine becomes visible because the chain got heavy, not because the model improved. |
| **C** | ⭐ **Cargo penalises DRAG, not top speed.** Replace the `CARGO_MAXSPD` divisor with a drag term: `λ_eff = λ_base · (1 + cargo·CARGO_DRAG)`. | one constant retired, one added | Top speed becomes emergent (`thrust ÷ drag`) at every chain length. `SHIP_MAX_SPEED` becomes a pure safety rail that binds only when unloaded. |

**Recommendation: Model C.** It is the only one that actually answers the question, and it makes the
Engine dramatic **for free and for the right reason** — the Engine halves effective mass, which
*raises thrust* and *lowers drag*, and terminal speed is thrust ÷ drag, so the two **multiply**:

At `SHIP_DRAG` 0.35, `CARGO_THRUST` 0.07, `CARGO_DRAG` 0.03:

| Chain | Terminal, no Engine | Terminal, Engine | Gain |
|---|---|---|---|
| 0 nodes | 520 (cap) | 520 (cap) | +0% — **as designed** |
| 4 nodes | 337 | 401 | **+19%** |
| 12 nodes | 249 | 340 | **+37%** |
| 24 nodes | 171 | 315 | **+84%** |

⚠ **Model C is the most structural of the three.** It retires `CARGO_MAXSPD` — a documented playtest
knob with a stated full-24 percentage in its own comment — and replaces it with `CARGO_DRAG`. The
comment is rewritten to record the retirement, not deleted. If the gate rejects C, **Model B is the
fallback and requires no structural change**, which is why the lab carries all three.

**Base drag.** Paul: *"without the powerups, drag needs to be more than what it currently is."*
Under Model C the laden cases are already drag-governed, so base drag now only shapes the **unloaded**
ship. `SHIP_DRAG` **0.35 → 0.45** is the proposed default (coast half-life 1.61 s → 1.16 s), less
aggressive than the 0.55 an earlier draft proposed because Model C is doing the heavy lifting.
⚠ **This still touches Pillar 2 — "Momentum is the game. The ship drifts."** It ships as
`DEBUG.shipDrag` and G7 settles it.

### 6.4 What the Engine does NOT get

⛔ **The Engine gains no cargo-independent effect. Decided, and not to be re-proposed.** An earlier
draft of this spec proposed `ENGINE_THRUST_MULT`, `ENGINE_MAXSPD_MULT` and `ENGINE_DRAG_MULT` applying
regardless of load. **Withdrawn at Paul's direction:** *"Engine powerup should not have any effect with
an empty chain, just as it currently behaves… the answer to engine powerup showing a noticeable effect
is for the tow chain to have more mass and drag on our ship."*

⛔ **`ENGINE_MASS_MULT` (0.5) remains the Engine's one and only effect.** §6.3's Model C is what makes
it felt.

⛔ **CS024 P6's rule stands and is NOT reversed:** the multiplier is *"FLAT while any fuel remains:
deliberately NOT scaled by how much fuel is left."* **No taper. No sputter. Full effect until the tank
runs out** — Paul's explicit call. FLAG-CS042-g is closed on that basis and `ENGINE_TAPER_SECONDS` is
not built.

### 6.5 The one Engine change: the fuel stops burning when it is doing nothing

⛔ **The burn condition gains one term: the chain must be non-empty.**

```
thrusting                          →  burns   (today)
thrusting AND chain.length > 0     →  burns   (CS042)
```

⛔ **`ENGINE_BURN_SECONDS` stays 10.0.** Paul: *"We still have 10 seconds of engine, but those seconds
are only to be counting down while the ship is thrusting AND there is debris in the tow chain."* The
tank is not resized; a tank that no longer leaks is the whole change. Its real duration rises, which
is the point — an Engine is no longer wasted by a flight it could not help.

⛔ **The decrement stays exactly where it is** — inside the thrust branch of `Ship.update()`, read
after the thrust it paid for, clamped at 0. It is not moved to the timer block; "seconds of laden
forward thrust" is only measurable there.

### 6.7 `CARGO_COAST` — PROPOSED, awaiting Paul's sign-off (2026-09-08)

⚠ **This subsection was not in the reviewed plan.** It was surfaced at GATE A, after two tuning passes
in the lab failed to produce what Paul was asking for, and he approved the direction. **The mechanism
is settled below; the VALUE is open (FLAG-CS042-k).** Nothing here ships until he signs off.

**The problem §6.1–§6.6 never named.** Paul's goal, in his own words: *"I just want the ship to
experience heavier effect on inertia from more debris mass, and I want the engine powerup to
significantly ease up on that heavier effect. The more debris, the more mass, and the more effect."*

⛔ **Drag in this build reads no mass at all.** `Ship.update`'s decay is
`Math.pow(1 - SHIP_DRAG, dt)`, with no cargo term, so an empty ship and a 24-node haul both bleed to a
tenth of their speed in **5.35 s**. Coasting, stopping and turning around are *identical* laden or
empty. Mass changes how fast you reach your ceiling (`CARGO_THRUST`) and where the ceiling is
(`CARGO_MAXSPD`), and then stops mattering. **Neither of those is inertia** — a clamp does not make a
ship feel heavy, and §6.3's three models all tune the clamp.

⛔ **§6.3's base-drag raise is pointed the wrong way for this goal, and does not ship.** Higher drag
makes the ship stop *sooner*, which is less momentum, not more — it works against Pillar 2 as well as
against the goal. Paul flew `SHIP_DRAG` 0.45 at GATE A and kept the shipped 0.35. **FLAG-CS042-f
closes as "no change."**

**The mechanism — one constant, one line.** Cargo *divides* the drag rate, the inverse of Model C:

```
λ_eff = λ_base / (1 + cargo × CARGO_COAST)
```

which is the build's existing idiom with one term added, in the one place drag is applied:

```js
const drag = Math.pow(1 - SHIP_DRAG, dt / (1 + cargo * CARGO_COAST));   // cargo is already in scope
```

⛔ **`cargo` is `chainMass()`, so the Engine eases this for free and for the right reason** — the same
single sum that already feeds `thrustMul`, `maxSp` and the momentum tug (§6.4: `ENGINE_MASS_MULT`
remains the Engine's one and only effect, and this does not change that).

**What it does, at `CARGO_COAST` 0.03 and `ENGINE_MASS_MULT` 0.35, every other constant shipped:**

| chain | top speed | coast to 10%, today | coast, laden | coast, +Engine | stop distance, today | laden |
|---|---|---|---|---|---|---|
| 0 | 520 | 5.35 s | 5.35 s | 5.35 s | 1086 px | 1086 px |
| 8 | 406 | 5.35 s | 6.63 s | 5.79 s | 849 px | 1052 px |
| 16 | 333 | 5.35 s | 7.91 s | 6.24 s | 696 px | 1031 px |
| 24 | 283 | 5.35 s | **9.19 s** | **6.69 s** | 590 px | **1016 px** |

⛔ **Not one shipped speed number moves.** The cap binds at every chain length today and still does, so
this is **purely additive**: it changes only how the ship carries momentum. That is what makes it the
smallest mechanism that answers the goal, and it is why `CARGO_MAXSPD` is **kept, not retired** —
Model C's structural change is unnecessary. **Model B (§6.3) is G6's answer** and needs no edit at all.

⛔ **The minimum version is ONE constant and ONE line, with every other value left shipped.** At
`CARGO_COAST` 0.03 and `ENGINE_MASS_MULT` at its **shipped 0.5**, no top speed moves, the tug is
untouched, and the Engine already gives back **50%** of the added coast (9.19 s → 7.27 s) purely
because `chainMass()` is the sum it halves. Nothing else in §6 has to change for the goal to be met.
Moving `ENGINE_MASS_MULT` to 0.35 raises that to **65%** (→ 6.69 s) and is a **separate, optional
decision** — it also lifts Engine-on top speed and softens the tug, so unlike `CARGO_COAST` it is not
speed-neutral.

**Costs and risks.**
- One new tuning constant plus `DEBUG.cargoCoast` (registry 110 → 111; `scratchpad/test-registry.js`
  owns that count). Not a lever — a handling constant like `CARGO_THRUST`, so no `LEVERS` entry (§2.13).
- ⚠ **Peak ship speed is unchanged**, so the stressor GDD §3.4's stability envelope actually measures
  (worst-case link stretch, driven by ship speed) is unchanged. The ship spends *longer* at speed,
  which is not what the envelope bounds. A re-validation run is cheap and should still be done.
- ⚠ **The momentum tug still clamps at 1.4, reached at 14 nodes**, so from 14 to 24 the yank does not
  grow. That is a second, separate violation of "the more debris, the more effect", deliberately left
  alone here: raising it changes a force the chain solver feeds on and pulls in §3.4's re-validation
  properly. **Available later; not part of this proposal.**

⛔ **FLAG-CS042-k — what value does `CARGO_COAST` take?** 0.03 doubles a full haul's coast; 0.01 is
barely felt; 0.06 makes a full haul drift further than an empty ship. **G6 answers it from the lab.**

### 6.6 `tools/handling-lab.html`

⛔ **Nothing in §6.3 ships a number that this lab did not produce.** All three models are analytic and
none has been flown.

Requirements:

1. **A flyable mock ship** on a wrapping field, with a tow chain of adjustable length (0–24), driven
   by the same integration shape the build uses: `v += thrust·mul·dt`, `v *= (1−drag)^dt`, clamp.
2. **Model selector — A / B / C** (§6.3), swapping the whole speed-penalty structure live.
3. **Sliders:** `SHIP_DRAG`, `SHIP_THRUST`, `SHIP_MAX_SPEED`, `CARGO_THRUST`, `CARGO_MAXSPD` (models
   A/B), `CARGO_DRAG` (model C), `CARGO_MASS`, **`CARGO_TURN`** (shipped dormant at 0.0 — see below),
   `ENGINE_MASS_MULT`, `ENGINE_BURN_SECONDS`.
4. **An Engine toggle**, and ⛔ **a live "which limit is binding?" readout** — cap or drag — because
   that single fact is the whole of §6.3 and it must be visible, not inferred.
5. **A table across chain lengths 0 / 4 / 8 / 12 / 16 / 20 / 24**, with and without Engine, giving:
   effective accel, terminal speed, the binding limit, time to 90% of top speed, and coast half-life.
   **Engine gain % per row is the headline column.**
6. **A/B toggle** against the shipped values on one key.
7. **A copy-out block** of the chosen model and constants.

⚠ **`CARGO_TURN` is included in the lab and is NOT pre-committed to shipping non-zero.** It is the
shipped-dormant *"mass resists rotation"* knob (CS010 §3), it is exactly on-theme for "more mass and
drag on our ship", and it costs one number. **Whether it ships above 0.0 is G6's answer, not a phase's
decision.** CS040 deferred it; this changeset puts it in front of Paul rather than deferring it again.

---

## 7. Gate C — the playtest questions

Asked after the build phases, before closing. ⛔ **Clear the debug overrides first (FLAG-CS036-a)** —
any install that has ever saved settings is not running shipped defaults, and this has spoiled at
least one prior gate.

| # | Question |
|---|---|
| **G1** | With voice at its normal rate, does every important event now announce itself *without* the voice? Name any event that still feels silent. |
| **G2** | Do `cargofull` and `cargolost` read as opposites? Is `chainsever` audibly *smaller* than `cargolost`? |
| **G3** | Health: how many pickups per level, and did two ever share the screen? (Numbers, not impressions.) |
| **G4** | Scoop: is the step from level 1 to 2 to 3 now visible in play? Do the level-6/7 orbs read as a different capability, or just a bigger cone? |
| **G5** | Scoop loss at 2 hits per level — right, or still too sticky? Does the reserve-spares-the-scoop rule read clearly from the `"SCOOP SAVED"` floater alone? |
| **G6** | Handling: which model, and what values? Does `CARGO_TURN` ship above 0.0? |
| **G7** | `SHIP_DRAG` at 0.45 — does the ship still *drift* enough to be this game (Pillar 2)? If not, what value? |
| **G8** | Engine: with the tank no longer leaking on unladen flight, does one pickup now feel like a real reprieve? Is 10 s still right? |
| **G9** | Menu repeat: is 0.40 s delay / 0.10 s rate right for scrolling the debug panel and the achievements list? |
| **G10** | Anything in the ceremony that the lab's preset did not predict once it was in the real game? |

---

## 8. Forks — all resolved

| Fork | Question | Resolution |
|---|---|---|
| **FORK-CS042-A** | `SCOOP_MAX_LEVEL` 5 → 7 re-spreads the mouth curve and shrinks levels 1–5. | **(a)** The mouth table keeps its own five-step span; levels 6–7 read level 5's mouth and add orbs. |
| **FORK-CS042-B** | Does the SFX call go at the trigger site or inside `_emit()`? | **Trigger site** (§1.3) — inside the gate it would inherit drop/park/repeat suppression. |
| **FORK-CS042-C** | Does the Engine get a cargo-independent arm? | **NO** (§6.4). Withdrawn at Paul's direction. `ENGINE_MASS_MULT` stays its only effect. |
| **FORK-CS042-D** | What bounds the Engine? | **10 seconds of laden forward thrust** (§6.5). The tank is unchanged; only the burn condition narrows. |
| **FORK-S1** (from CS040) | Should losing the payload cost a scoop level? | **No — and the build already gets this right** (§4.5). Scoop loss is keyed on the *ship* being hit, not on payload loss. `breakChain(0)` must stay scoop-neutral. |

## 9. Flags

| Flag | Question | Status |
|---|---|---|
| **FLAG-CS042-a** | A lab for the twelve sounds? | ⛔ **RESOLVED — yes**, three candidates each (§1.6). |
| **FLAG-CS042-b** | `powertag` as a tag note, or transpose `powerup()` per type? | **Tag note.** Additive; `powerup()` is a sound every player knows. |
| **FLAG-CS042-c** | Is `DEBUG.healthSpawnLock` = 12 s right, or should it scale with wave? | **Flat 12 s.** One clock is `game.wave`; a second scaling rule needs a reason. |
| **FLAG-CS042-d** | Milestone hull gate threshold. | ⛔ **RESOLVED — 70%**, and §4.5's reserve threshold is the same number by design. |
| **FLAG-CS042-e** | Should ◄/► repeat in menus? | ⛔ **RESOLVED — no.** Up/down only. |
| **FLAG-CS042-f** | `SHIP_DRAG` value. | ⛔ **RESOLVED — no change (0.35).** 0.45 was flown at GATE A and rejected; §6.7 explains why raising drag is pointed the wrong way for the goal. |
| **FLAG-CS042-g** | Engine wear-off: taper or sputter? | ⛔ **CLOSED — neither.** Full effect until the tank runs out (§6.4). |
| **FLAG-CS042-h** | Sever-linked scoop loss. | ⛔ **RESOLVED** as FORK-S1 above. |
| **FLAG-CS042-i** | Do §2's five changes ship together? | **All five**, each behind a knob, so the gate can subtract rather than guess. |
| **FLAG-CS042-j** | Does `CARGO_TURN` ship above 0.0? | ⛔ **RESOLVED — no.** Flown at GATE A, kept at 0.0. |
| **FLAG-CS042-k** | `CARGO_COAST` value (§6.7). | **OPEN — G6.** Mechanism approved 2026-09-08; value from the lab. |

---

## 10. Suite

Every phase delivers its test with its code, using `scratchpad/_harness.js`. Nothing asserts a global
count — `scratchpad/test-registry.js` owns registry size, lever count and `POWERUP_DROP_TYPES` length,
and it is the **one** file that changes when a knob is added.

⛔ **The one test this changeset most needs is the SFX one:** drive a real event to its trigger with
the voice gate **closed** (inside a repeat window, or pre-empted by a higher-priority line) and assert
**the sound still fired**. That is the whole requirement, and it is the assertion that stops a future
refactor quietly moving the call inside `_emit()`.

⛔ **The second-most-needed is §4.5's:** assert that `breakChain(0)` leaves `game.scoopLevel` and
`game.scoopHits` untouched while `damageShip()` moves them. That separation is the fork's resolution
and nothing else in the suite protects it.

⛔ Phase-local pins use `scratchpad/_phase-ref.js` against a **literal parent SHA**, never `HEAD`.
⛔ `node scratchpad/run-all.js` must be green before every commit.

**Known baseline:** 171 files, **170 passed / 1 failed** at `71ab1bc` — the failure is `test-f6.js`,
the documented ~1.7% unseeded flake, which passed three consecutive reruns during this spec's
research. Treat 171/171 as the baseline and rerun before chasing either known flake
(`test-f6` §F, `test-cs035-p3` §F ~5%).
