# IMPLEMENTATION-PHASES-CS042.md

**Reads with:** `PLANNED-FEATURES-CS042.md` (spec). Every `§` reference below points there.
**Base:** `71ab1bc`, `GAME_VERSION 1.0.0.40` → `1.0.0.41` at P11.

## How to use this document

**Every phase below carries a `Copy-paste prompt` block.** Set the model and effort named above it in
Claude Code, then paste the block verbatim as the session's first message. It carries its own read
chain, its own scope fence and its own commit instruction — nothing has to be remembered or added.

⛔ **Model and effort are UI settings. `ultrathink` is not an effort level** — it is a per-turn lever
that only works when it appears inside the message text, which is why it sits at the bottom of the
prompt blocks that want it (`CLAUDE.md`, Model guidance). Effort levels are **Low / Medium / High /
XHigh / Max**.

⚠ **Max is deliberately unassigned.** It is the escalation for a phase that has already gone wrong
once and is being retried, not a default. If a phase at XHigh produces something that fails its own
test twice, that is the signal to raise it.

**Standing rules** (all of these are in `CLAUDE.md`, which auto-loads — repeated here only so the
phase bodies can lean on them):

- One session per phase. One commit per phase, on `main`. **Never push** — that is Paul's.
- Navigate the single-file build with `grep -n 'symbolName'` + `sed -n 'START,ENDp'`. **Anchor by
  symbol name, never by line number** — line numbers drift within a session.
- **Forks are not resolved inside a session.** All five (§8) are resolved. If a prompt seems to
  conflict with a resolution, stop and report rather than choosing.
- **Baseline is 171/171.** `test-f6.js` is a documented ~1.7% unseeded flake — rerun it before
  treating a failure as a regression.

---

## Phase map

| phase | content | model | effort | ultrathink | build? |
|---|---|---|---|---|---|
| **P0** | ✅ **DONE** — `tools/handling-lab.html` (§6.6). GATE A's handling half returned a null result; §6.8 is the outcome | Opus 5 | **High** | yes | no |
| **P1** | `tools/sfx-lab.html` — 12 sounds × 3 candidates (§1.6) | Fable 5.1 | **Medium** | no | no |
| **P2** | `tools/ceremony-lab.html` — both sequences (§3) | Opus 5 | **High** | yes | no |
| **⛔ GATE A** | **Paul uses all three labs. No session.** | — | — | — | — |
| **P3** | SFX foundation + the anchor trio (§1.3, §1.4) | Opus 5 | **High** | yes | yes |
| **P4** | SFX completion — the remaining nine (§1.4) | Sonnet 5 | **Medium** | no | yes |
| **P5** | The ceremony edit — scope is GATE A's block (§3) | Opus 5 | **XHigh** | yes | yes |
| **P6** | Health supply levelling — five changes, five knobs (§2.3) | Opus 5 | **High** | yes | yes |
| **P7** | One mass for cargo handling + Engine burn condition (§6.8, §6.5) | Opus 5 | **XHigh** | yes | yes |
| **P8** | Scoop levels 6–7, orbs, level-1 floor (§4.3) | Opus 5 | **High** | yes | yes |
| **P9** | Scoop loss rate + the reserve rule (§4.4, §4.5) | Opus 5 | **XHigh** | yes | yes |
| **P10** | Menu navigation repeat (§5) | Sonnet 5 | **Medium** | no | yes |
| **⛔ GATE C** | **Blocking playtest. No session.** | — | — | — | — |
| **P11** | Closing: tuning, docs, §0 re-measure, version bump, archive | Sonnet 5 | **High** | yes | yes |

### Why these settings

**XHigh on P5, P7 and P9** — the three phases that can break the shipped game *silently*. P5 edits a
freeze whose documented failure mode is a hard hang. P7 (rewritten for §6.8) replaces five handling
constants with one derived mass and changes the momentum tug's form, and `chainMass()` feeds the
verlet chain, which has a stability envelope in GDD §3.4 that P7 must re-validate rather than assume. P9
edits the build's most heavily-commented function and gives an existing mechanism a second job.

**High on P0, P2, P3, P6, P8, P11** — each either mirrors real physics or state closely enough that a
wrong model misleads Paul's decision, or reverses a decision the build argues for in its own comments.

**Medium on P1, P4, P10** — P4 and P10 are mechanical applications of a pattern already established.
P1 is a generative-variety problem with no invariants and no build byte.

**Fable 5.1 for P1, and only P1.** Thirty-six sound characters that must be *meaningfully different
from each other* is a variety problem, not a correctness one. It touches no build byte, has no
invariant to violate, and a weak result is audible immediately in the lab. ⚠ **If the candidates come
out indistinct or unmusical, rerun P1 on Opus 5 at Medium** — the phase is disposable by design.

### Why this order

The three labs land first because all three are decision instruments and Paul can work them in one
sitting at GATE A. Everything after GATE A is built against answers rather than guesses. The ceremony
edit (P5) sits **before** GATE C so the playtest can judge it; P8 and P9 split the Scoop's reward side
from its risk side so GATE C can accept one without the other.

---

## P0 — `tools/handling-lab.html`

**Model:** Opus 5 · **Effort:** High
**Commit subject:** `cs042 p0: handling lab — drag, cargo mass and engine relief across chain lengths`

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P0 — tools/handling-lab.html" in full, then PLANNED-FEATURES-CS042.md §6
in full, then the GDD subsections P0's "Read" line names.

Build P0 and nothing else. Do not build ahead into any later phase.

P0 creates one new file, tools/handling-lab.html, and edits CLAUDE.md's
"Design instruments (tools/)" list by one line. It touches no build byte:
orbital-overhaul.html must be byte-identical when you are done. Verify that
before committing.

tools/ is not shipped code and has never carried suite coverage, so P0 ships no
test — say so explicitly in the commit body rather than adding a first-ever
tools test. Still run `node scratchpad/run-all.js` to confirm you broke nothing;
the baseline is 171/171 and test-f6.js is a known ~1.7% flake, so rerun that one
file before treating a failure as a regression.

Commit on main with the subject named in P0. Do not push. Update STATUS.md.

ultrathink
```

### What to build

**Read:** spec §6 in full. GDD §2.1 (ship — thrust, drag, top speed), §2.10.2 (payload curve —
`CARGO_THRUST`/`CARGO_MAXSPD`/`CARGO_MASS`/`CARGO_TURN`), §2.14 (the Engine budget), §3.4 (chain
physics — the tug reads `chainMass()`).

A standalone lab in the `tools/` house style (dark canvas left, control panel right — copy the CSS
shape from `tools/scoop-lab.html`). ⛔ **It duplicates the integration it needs; it does not import
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

---

## P1 — `tools/sfx-lab.html`

**Model:** Fable 5.1 · **Effort:** Medium
**Commit subject:** `cs042 p1: sfx lab — three candidates for each of the twelve event sounds`

⚠ The one phase on a creative-leaning model, because thirty-six sound characters must be distinct
from one another. It touches no build byte. **If the candidates come out indistinct or unmusical,
rerun this phase on Opus 5 at Medium** — it is disposable by design.

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P1 — tools/sfx-lab.html" in full, then PLANNED-FEATURES-CS042.md §1
in full, then the GDD subsections P1's "Read" line names.

Build P1 and nothing else. Do not build ahead into any later phase.

P1 creates one new file, tools/sfx-lab.html, and edits CLAUDE.md's "Design
instruments (tools/)" list by one line. It touches no build byte:
orbital-overhaul.html must be byte-identical when you are done. Verify that
before committing.

No phon string is composed, derived, edited or improved by this phase. VOICE_LINES
is not touched. This phase is about AudioSys one-shots only.

tools/ is not shipped code and has never carried suite coverage, so P1 ships no
test — say so explicitly in the commit body. Still run `node scratchpad/run-all.js`
to confirm you broke nothing; the baseline is 171/171 and test-f6.js is a known
~1.7% flake, so rerun that one file before treating a failure as a regression.

Commit on main with the subject named in P1. Do not push. Update STATUS.md.
```

### What to build

**Read:** spec §1.1, §1.2, §1.4, §1.6. GDD §2.8 (Audio) — specifically the existing `AudioSys`
one-shots, which are the idiom every candidate must be portable into.

Deliver everything in §1.6:

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

**Character briefs are in §1.4's third column.** The three candidates for a given sound must differ in
*approach*, not just in pitch — for `cargofull`, say: a stepped arpeggio, a continuous filter sweep,
and a pulsed fill. ⛔ **Three transpositions of one idea is a failed phase.**

⛔ **`health` gets no `powertag` row.** It has no `collect_` line by design. Do not add a thirteenth.

---

## P2 — `tools/ceremony-lab.html`

**Model:** Opus 5 · **Effort:** High
**Commit subject:** `cs042 p2: ceremony lab — the level-end and game-over sequence instrument`

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P2 — tools/ceremony-lab.html" in full, then PLANNED-FEATURES-CS042.md §3
in full, then the GDD subsections P2's "Read" line names.

Build P2 and nothing else. Do not build ahead into any later phase. In particular,
P2 does NOT change the ceremony in the game — that is P5, and its scope comes from
this lab's output, not from your judgment.

P2 creates one new file, tools/ceremony-lab.html, and edits CLAUDE.md's "Design
instruments (tools/)" list by one line. It touches no build byte:
orbital-overhaul.html must be byte-identical when you are done. Verify that
before committing.

tools/ is not shipped code and has never carried suite coverage, so P2 ships no
test — say so explicitly in the commit body. Still run `node scratchpad/run-all.js`
to confirm you broke nothing; the baseline is 171/171 and test-f6.js is a known
~1.7% flake, so rerun that one file before treating a failure as a regression.

Commit on main with the subject named in P2. Do not push. Update STATUS.md.

ultrathink
```

### What to build

**Read:** spec §3. GDD §2.20 (celebration panel), §2.20.1 (level-end ceremony), §2.18 (high scores —
sequence B beat 4), §2.9 (states).

⛔ **It duplicates whatever slice of the sequences it needs. It does not import build code and it is
not a PORT-ME BLOCK** — `tools/lowhp-glow-lab.html`'s port block is the exception that proves the
rule, and it exists because that lab studies exact pixels. This one studies pacing.

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

---

## ⛔ GATE A — Paul uses the three labs

**No session. Nothing after this line is built until Paul answers.** One sitting, three instruments:

| Lab | What comes back | Feeds |
|---|---|---|
| `handling-lab` | The model (A/B/C) and every slider value, including whether `CARGO_TURN` ships above 0.0 (FLAG-CS042-j) | **P7** |
| `sfx-lab` | Twelve picked candidates as a copy-out block | **P3**, **P4** |
| `ceremony-lab` | The chosen beats, durations and transitions for both sequences | **P5** |

⛔ **Clear the debug overrides before touching the handling lab (FLAG-CS036-a)** if any comparison is
made against the running game.

⚠ **If the handling lab contradicts §6.3's tables, the lab wins.** The spec's numbers are analytic and
have never been flown.

---

## P3 — SFX foundation and the anchor trio

**Model:** Opus 5 · **Effort:** High
**Commit subject:** `cs042 p3: event SFX foundation — cargo full, cargo lost, chain sever`

⚠ **Requires GATE A's `sfx-lab` copy-out block.** Paste it into the session after the prompt.

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P3 — SFX foundation and the anchor trio" in full, then
PLANNED-FEATURES-CS042.md §1 in full, then the GDD subsections P3's "Read" line names.

Build P3 and nothing else. Do not build ahead into P4 — P3 ships exactly three
AudioSys methods and three trigger-site calls, and P4 does the other nine.

The three sounds are PORTED VERBATIM from the sfx-lab copy-out block I am pasting
below. Do not re-tune them: they were picked by ear at the volume the game plays
them at. If the block is missing or looks truncated, stop and say so rather than
composing your own.

The rule P3 establishes — that an event SFX fires at its TRIGGER SITE and never
inside VoiceSys._emit() — is copied nine more times by P4, so getting it wrong
here gets it wrong twelve times. Write it into the build as a comment block, in
the words the P3 section gives.

Deliver scratchpad/test-cs042-p3.js with the code. Its load-bearing assertion is
that the sound still fires WITH THE VOICE GATE CLOSED. Run
`node scratchpad/run-all.js` before committing — the baseline is 171/171 and
test-f6.js is a known ~1.7% flake, so rerun that one file before treating a
failure as a regression.

Commit on main with the subject named in P3. Do not push. Update STATUS.md.

ultrathink

--- sfx-lab copy-out block follows ---
[PASTE HERE]
```

### What to build

**Read:** spec §1.1–§1.5. GDD §2.8 (Audio — all of it; this phase adds to `AudioSys` and reads the
`VoiceSys` channel contract), §2.10 (tow chain, for the three trigger sites).

**Port `cargofull` / `cargolost` / `chainsever` from GATE A's block, verbatim.**

**Write the rule into the build**, as a comment block above the first new method:

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

**Model:** Sonnet 5 · **Effort:** Medium
**Commit subject:** `cs042 p4: event SFX — the remaining nine events`

⚠ **Requires GATE A's `sfx-lab` copy-out block.** Paste it into the session after the prompt.

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P4 — SFX completion" in full, then PLANNED-FEATURES-CS042.md §1 in full,
then the GDD subsections P4's "Read" line names. Also read the comment block P3
wrote above AudioSys's first new method — it states the rule this phase applies
nine more times.

Build P4 and nothing else. Do not build ahead into any later phase.

The nine sounds are PORTED VERBATIM from the sfx-lab copy-out block I am pasting
below. Do not re-tune them. If the block is missing or looks truncated, stop and
say so rather than composing your own.

One of the nine REPLACES an existing sound rather than adding to it: chain_guard
stops borrowing AudioSys.shieldPing(). Rewrite the comment there that explains the
borrowing; do not leave it standing false.

Deliver scratchpad/test-cs042-p4.js with the code, same shape as P3's: each event
driven through real code with the voice gate closed, asserting the sound still
fired. Run `node scratchpad/run-all.js` before committing — the baseline is
171/171 and test-f6.js is a known ~1.7% flake, so rerun that one file before
treating a failure as a regression.

Commit on main with the subject named in P4. Do not push. Update STATUS.md.

--- sfx-lab copy-out block follows ---
See file CS042-GATE-A.md
```

### What to build

**Read:** spec §1.2, §1.4. GDD §2.8, §2.7 (waves/health — `level`, `health_*`), §2.14 (powerups — the
`collect_`/`expire_` sites), §2.10 (dock tiers), §2.14.2 (chain guard).

**Port the remaining nine verbatim:** `guardblock`, `levelup`, `hullfull`, `hullrelief`,
`hullcritical`, `powertag(type)`, `powerfade(type)`, `haulsize(n)`, `megadelivery`.

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
what makes chain armour indistinguishable from the ship's shield.

⛔ **`hullcritical()` is additive** — `lowhp(true)` still starts the siren loop, unchanged.
⛔ **`powerfade` is skipped for `"guard"`**, mirroring the existing `t !== "guard"` clause on the voice
line. ⛔ **`haulsize(n)` layers over the per-canister `deliver(n)` climb**, which is unchanged.

⚠ **The `expire_*` loop runs every frame.** Confirm the falling-edge latch (`game.powerVoiced[t]`) is
what gates the call, so `powerfade` fires **once** per expiry and not per frame.

---

## P5 — The ceremony edit

**Model:** Opus 5 · **Effort:** XHigh
**Commit subject:** `cs042 p5: level-end and game-over ceremony, per GATE A`

⛔ **Requires GATE A's `ceremony-lab` copy-out block. That block IS this phase's spec.** If it is not
in hand, this phase does not start.

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P5 — The ceremony edit" in full, then PLANNED-FEATURES-CS042.md §3 in
full, then the GDD subsections P5's "Read" line names. GDD §2.20.1 is the one you
cannot skim.

Build P5 and nothing else. Do not build ahead into any later phase.

The ceremony-lab copy-out block I am pasting below IS this phase's specification.
Build what it says. If it is missing, truncated, or silent on something you need,
STOP and ask rather than choosing a sequence yourself — the whole point of the lab
was that this design is mine, not the session's.

This is the phase most likely to break something silently. The P5 section lists
six standing constraints, every one of which is a rule the build argues for at
length in its own comments. Read all six before you edit anything. The
freeze's documented failure mode is a HARD HANG.

Deliver scratchpad/test-cs042-p5.js with the code, including a regression assert
that the freeze still terminates under both degenerate banner-knob settings. Run
`node scratchpad/run-all.js` before committing — the baseline is 171/171 and
test-f6.js is a known ~1.7% flake, so rerun that one file before treating a
failure as a regression.

Commit on main with the subject named in P5. Do not push. Update STATUS.md.

ultrathink

--- ceremony-lab copy-out block follows ---
See file CS042-GATE-A.md
```

### What to build

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

**Model:** Opus 5 · **Effort:** High
**Commit subject:** `cs042 p6: health supply — spawn lock, milestone growth, hull gate, wider ambient gap`

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P6 — Health supply levelling" in full, then PLANNED-FEATURES-CS042.md §2
in full, then the GDD subsections P6's "Read" line names.

Build P6 and nothing else. Do not build ahead into any later phase.

P6 reverses a CS040 decision that the build argues against in a comment at the
site you are editing. That comment predicted this exact change and called it "a
design change, not a tidy-up." It IS one, it is intended, and you must REWRITE
that comment to record the reversal and its changeset — not delete it, and not
leave it standing false.

P6 must NOT undo CS040's rescue. The milestone health spawn exists because
removing milestone healing outright killed both replayed telemetry runs many
waves early. Two of the five changes slow and qualify that arm; neither removes
it, and none of them may be tuned so tight it stops firing.

Three new DEBUG_VARS rows. Update scratchpad/test-registry.js's registry count —
that is the one place the number lives, and nothing else may duplicate it.

Deliver scratchpad/test-cs042-p6.js with the code. Run `node scratchpad/run-all.js`
before committing — the baseline is 171/171 and test-f6.js is a known ~1.7% flake,
so rerun that one file before treating a failure as a regression.

Commit on main with the subject named in P6. Do not push. Update STATUS.md.

ultrathink
```

### What to build

**Read:** spec §2. GDD §2.7 (waves, health, scoring — `REPAIR_MILESTONE`, `healthGapRoll()`), §2.14
(powerups — the Health pickup, `game.healthBank`), §2.19 (debug registry).

**Five changes, five knobs** (§2.3):

- **(a)** `game.healthSpawnLock` — seconds, set by **every** spawn route, respected by all three.
  `DEBUG.healthSpawnLock`, `def` from a new `HEALTH_SPAWN_LOCK = 12`, min **0 disables**, max 60.
- **(b)** Move the one-at-a-time gate **into `spawnHealthPowerup()`**. ⛔ This is the reversal the
  prompt names.
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

⛔ **Each knob's minimum is its own A/B.** `healthSpawnLock` 0, `repairMilestoneGrowth` 0 and
`repairMilestoneHullPct` 1.0 together restore today's behaviour exactly — that is what G3 needs.

**Registry:** three new rows in the POWERUPS section, `def` deriving from the new consts.
⛔ **Not levers** — health cadence is powerup pacing, not a difficulty ramp: no floor/ceil/steps, no
▼/↳ glyph, no `LEVERS` entry, same reasoning as the four `healthGap*` rows.

**Test — `scratchpad/test-cs042-p6.js`:** the lock blocks a second spawn inside the window and admits
one after it; the gate inside `spawnHealthPowerup()` refuses a second concurrent pickup **from the
milestone route**; the milestone interval grows with wave; the hull gate blocks at 90% and admits at
50%; every knob at its minimum reproduces pre-phase behaviour.

---

## P7 — One mass, one force, and the Engine burn condition

**Model:** Opus 5 · **Effort:** XHigh
**Commit subject:** `cs042 p7: one mass for cargo handling + engine fuel burns only under load`

⛔ **REWRITTEN 2026-09-08. This phase no longer builds §6.3's A/B/C models — it builds §6.8.**
GATE A returned a null result on handling: three passes through `tools/handling-lab.html` produced no
value Paul trusted, and his read was that a mock ship on an empty field cannot answer a question about
weight. §6.3's three models, §6.7's `CARGO_COAST`, `SHIP_DRAG` 0.45 and `CARGO_TURN` are **all closed
and none of them ship**. Read §6.8 and ignore §6.3's tables except as history.

⛔ **This phase needs no lab block.** Both knobs land at values that reproduce today's behaviour, and
the values are decided at GATE C in a real run.

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P7 — One mass, one force, and the Engine burn condition" in full, then
PLANNED-FEATURES-CS042.md §6.8 and §6.5 in full, then the GDD subsections P7's
"Read" line names. GDD §3.4 is mandatory and its stability envelope must be
re-validated by this phase — §6.8 changes the momentum tug's form AND lets a laden
ship sustain much higher speeds for much longer, which is exactly what that
envelope bounds.

Build P7 and nothing else. Do not build ahead into any later phase.

⛔ §6.3's three models, §6.7's CARGO_COAST, the SHIP_DRAG raise to 0.45 and
CARGO_TURN above 0.0 are ALL CLOSED and none of them ship. §6.8 supersedes them.
Do not implement anything from §6.3's tables; they are history, and two of their
numbers are wrong (recorded in STATUS.md).

§6.8 collapses five constants into one. CARGO_THRUST, CARGO_MAXSPD, CARGO_TURN,
CARGO_MASS all retire; CARGO_UNIT_MASS replaces them; CHAIN_TUG rescales 26 -> 58
so a full chain tugs exactly as hard as it does today. Each retired constant's
comment is REWRITTEN to record the retirement and its changeset, never deleted.

Two things this phase must NOT do, both settled and both easy to re-invent:
  1. The Engine gains NO cargo-independent effect. ENGINE_THRUST_MULT,
     ENGINE_MAXSPD_MULT and ENGINE_DRAG_MULT were proposed and WITHDRAWN.
     ENGINE_MASS_MULT stays its only effect, and the Engine doing nothing on an
     empty chain is correct behaviour, not a bug — under §6.8 an empty chain is
     mass 1 and the multiplier has nothing to act on.
  2. CS024 P6's "FLAT while any fuel remains" rule STANDS. No taper, no sputter,
     no ENGINE_TAPER_SECONDS. Full effect until the tank runs out.

ENGINE_BURN_SECONDS stays 10.0. The only Engine change is one added term on the
burn condition: the chain must be non-empty.

Two consequences of §6.8 are FLAGGED, NOT RESOLVED (FLAG-CS042-l, FLAG-CS042-m).
Build them as §6.8 describes and say plainly in the commit body what they do; do
not soften either one, and do not special-case rotation back out.

Deliver scratchpad/test-cs042-p7.js with the code. Run `node scratchpad/run-all.js`
before committing — the baseline is 171/171 and test-f6.js is a known ~1.7% flake,
so rerun that one file before treating a failure as a regression.

Commit on main with the subject named in P7. Do not push. Update STATUS.md.

ultrathink
```

### What to build

**Read:** spec §6.8 and §6.5 in full. GDD §2.1 (ship — thrust, drag, top speed, `shipTurnRate()`),
§2.10.2 (the payload curve and the handling penalties it names), §2.14 (the Engine budget), §3.4
(chain physics — ⛔ **read this before touching anything `chainMass()` feeds, and re-validate it**).

**Part 1 — one mass.** `M = 1 + chainMass() * CARGO_UNIT_MASS`, then in `Ship.update`:

| quantity | becomes |
|---|---|
| acceleration | `SHIP_THRUST / M` |
| drag | `Math.pow(1 - SHIP_DRAG, dt / M)` — the same idiom, one divisor added |
| turn | `shipTurnRate()` returns `SHIP_TURN * settings.shipTurnScale / M` |
| top speed | `SHIP_MAX_SPEED`, flat — the mass divisor is gone |

and in `updateChain`, the momentum tug's `massFactor` becomes `(M - 1) / M`, replacing
`Math.min(1.4, chainMass() * CARGO_MASS)`. ⛔ **`CHAIN_TUG` rescales 26 → 58** so a full chain tugs
exactly as hard as today; the arbitrary 1.4 clamp is gone and its asymptote is now physical.

⛔ **`chainMass()` itself is untouched** — it still returns the Engine-multiplied node-mass sum, and it
is still the single quantity every penalty reads. §6.8 changes what is *done* with it, not what it is.

⛔ **Both knobs go in the debug registry at values that reproduce today**: `cargoUnitMass`
(`def` 0.07, min 0, max 0.30, step 0.005) and the existing `engineMassMult`. Registry 110 → 111 —
`scratchpad/test-registry.js` owns that count and is the ONE file that changes for it.

⛔ **Confirm in the diff that `DEBRIS_SPEED_CAP = 2 * SHIP_MAX_SPEED` still reads the CONSTANT.** It is
FLAG-CS017-a's guard rail and has nothing to do with player handling.

**Part 2 — the Engine burn condition.** ⛔ **One term added, nothing else:**

```
if (this.thrusting)   →   if (this.thrusting && game.chain.length > 0)
```

⛔ **The decrement stays inside the thrust branch**, read after the thrust it paid for, clamped at 0.
It is **not** moved to `update()`'s timer block — "seconds of laden forward thrust" is only measurable
where it already lives.

**Part 3 — re-validate GDD §3.4.** ⛔ **Not optional and not assumable.** Re-run the documented
24-node stress at the main-loop `dt` clamp and record the worst-case link stretch against §3.4's ~5 px
budget, the same way CS010 P2 did. Two things changed that the envelope is sensitive to: the tug's
form, and how long a laden ship holds high speed. If it exceeds budget, **stop and report** — do not
raise `CHAIN_ITER` to make a number fit.

**Test — `scratchpad/test-cs042-p7.js`:** drive real `Ship.update()` at dt = 1/60 and assert —
acceleration, coast time, turn rate and tug all **change monotonically with chain length, with no
clamp** (§6.8's whole claim); the Engine's benefit **rises with chain length and is exactly zero at
chain length 0** (§6.4's rule, made assertable); `CARGO_UNIT_MASS` at 0.07 reproduces today's
acceleration at every chain length; `DEBRIS_SPEED_CAP` unmoved; **fuel does not decrement while
thrusting with an empty chain**, and does while thrusting with one node.

---

## P8 — Scoop levels 6–7 and the flanking orbs

**Model:** Opus 5 · **Effort:** High
**Commit subject:** `cs042 p8: scoop levels 6-7 with flanking orbs; level-1 floor raised`

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P8 — Scoop levels 6-7 and the flanking orbs" in full, then
PLANNED-FEATURES-CS042.md §4.1 through §4.3, then the GDD subsections P8's "Read"
line names.

Build P8 and nothing else. P8 is the Scoop's REWARD side only — the loss rate and
the health-reserve rule are P9's, and splitting them is deliberate so the playtest
can accept one without the other. Do not build ahead into P9.

THE TRAP, and it silently corrupts levels 1-5 if you miss it: buildScoopSteps()
divides by (SCOOP_MAX_LEVEL - 1), so raising the cap from 5 to 7 re-spreads the
mouth curve across seven levels and shrinks every existing level. FORK-CS042-A is
already resolved: the mouth table keeps its own five-step span and levels 6-7 read
level 5's mouth. Print SCOOP_WIDTH[1..5] and SCOOP_DEPTH[1..5] before and after
and verify they are identical once the deliberate level-1 floor change is
accounted for.

The load-time SCOOP guard that throws is a deliberate invariant guard, not test
scaffolding. Extend it to cover the two new orb tables.

Deliver scratchpad/test-cs042-p8.js with the code. Run `node scratchpad/run-all.js`
before committing — the baseline is 171/171 and test-f6.js is a known ~1.7% flake,
so rerun that one file before treating a failure as a regression.

Commit on main with the subject named in P8. Do not push. Update STATUS.md.

ultrathink
```

### What to build

**Read:** spec §4.1–§4.3. GDD §2.14.1 (the Scoop — all of it), §2.12 (damage, scoop-level loss), §3.2
(rendering conventions), §2.14 (powerups).

**1. `SCOOP_MAX_LEVEL` 5 → 7**, with `SCOOP_MOUTH_LEVELS` = 5 holding the mouth curve's own span.
`SCOOP_MAX_LEVEL` governs the cap, the HUD ring and the orb tables — **not** the mouth curve.

**2. The orbs.** Two new step tables, `SCOOP_ORB_OFFSET` and `SCOOP_ORB_R`, zero at indices 0–5 and
non-zero only at 6 and 7. Starting values from §4.3 (±62 / ±84 offset, 26 / 34 radius).

⛔ **Extend the load-time guard** so both new tables carry the index-0-is-zero property — without it a
level-0 ship silently grows orbs.

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

**Model:** Opus 5 · **Effort:** XHigh
**Commit subject:** `cs042 p9: scoop loses at 2 hits; a health reserve can absorb the loss`

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P9 — Scoop loss rate and the reserve" in full, then
PLANNED-FEATURES-CS042.md §4.4 and §4.5, then the GDD subsections P9's "Read" line
names. You are editing damageShip(), the most heavily commented function in the
build — read the whole function before changing a line of it.

Build P9 and nothing else. Do not build ahead into any later phase.

NO TRIGGER CHANGES. Scoop loss is already keyed on the SHIP being hit, and
breakChain(0) — a hit on a chain node — already leaves the scoop alone. That
separation IS the resolution of a fork carried over from CS040, and a phase must
not "unify" the two paths. No srcTag test is needed either: the switch already
enumerates exactly the sources in scope, and shielded / i-framed / auto-shielded
hits return before the scoop block entirely.

P9 reverses a documented intent. The build currently says the scoop's stickiness
is "the intent, not a bug to 'fix.'" It is being reversed at Paul's request.
REWRITE that comment to record the reversal and its changeset — do not delete it.

The reserve rule reads the hull AFTER the damage lands. That is why it is a
threshold and not "is the hull full" — a literal full-hull rule would be dead
code, because damage is applied before the bank check. Say so in the comment; it
is the first thing a future reader will question.

One new DEBUG_VARS row. Update scratchpad/test-registry.js's registry count.

Deliver scratchpad/test-cs042-p9.js with the code. Its most important assertion is
that breakChain(0) leaves game.scoopLevel AND game.scoopHits untouched while
damageShip() moves them — nothing else in the suite protects that. Run
`node scratchpad/run-all.js` before committing — the baseline is 171/171 and
test-f6.js is a known ~1.7% flake, so rerun that one file before treating a
failure as a regression.

Commit on main with the subject named in P9. Do not push. Update STATUS.md.

ultrathink
```

### What to build

**Read:** spec §4.4, §4.5. GDD §2.12 (damage — `damageShip()` and the scoop-loss site), §2.14.1,
§2.14 (the health bank), §2.19.

**Part 1 — the rate.** `SCOOP_HITS_PER_LEVEL` **5 → 2**. ⛔ **`DEBUG.scoopHitsPerLevel` keeps its exact
meaning** — a flat hits-per-level count. Only its `def` moves. **No table, no curve.**

⛔ `game.scoopHits` keeps its shape: a running tally, reset only on an actual level loss, never
accumulating at level 0, never reset by a scoop pickup (FORK-3 stands).

**Part 2 — the reserve.** New `BANK_SPARE_HULL_PCT = 0.70` → `DEBUG.bankSpareHullPct`, min 0, max 1,
step 0.05:

| Hull after the hit | The charge does | Scoop |
|---|---|---|
| at or below 70% | **heals** (+25 HP), as today | loses a level |
| above 70% | **spares the scoop** — no heal | **kept** |
| any, with `scoopLevel === 0` | **heals** — nothing to spare | n/a |

⛔ **Never both. One charge, one job.**
⛔ **One charge per damage event** (CS040's FLAG-CS040-b) — unchanged.
⛔ **Still below the `hp <= 0` exit**, so the reserve never rescues a lethal hit.
⛔ **0.70 is P6's `repairMilestoneHullPct`, deliberately** — the changeset has one definition of
"hurt". Cross-reference both comments to each other.

**Tell:** the spare arm pushes a `"SCOOP SAVED"` `FloatText` in `POWERUP_COLOR.scoop`, mirroring the
`"SCOOP -1"` the loss arm already pushes. `AudioSys.bankspend()` still fires either way.

⛔ **Knob endpoints are the gate's A/B:** 1.0 → always heals, scoop always drops. 0.0 → always spares
while a scoop exists.

**Test — `scratchpad/test-cs042-p9.js`:**
- ⛔ **`breakChain(0)` leaves `game.scoopLevel` AND `game.scoopHits` untouched, while `damageShip()`
  moves them.**
- Two hits cost a level; one does not.
- Hull at 50% after the hit → charge heals, scoop drops. Hull at 90% → charge spares, no heal.
- `scoopLevel === 0` → charge heals regardless of hull.
- Bank empty → scoop drops normally.
- A lethal hit never spends a charge.
- `bankSpareHullPct` at 1.0 reproduces pre-phase behaviour.

---

## P10 — Menu navigation repeat

**Model:** Sonnet 5 · **Effort:** Medium
**Commit subject:** `cs042 p10: menus repeat on a held up/down — delay then rate, both devices`

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P10 — Menu navigation repeat" in full, then PLANNED-FEATURES-CS042.md §5
in full, then the GDD subsections P10's "Read" line names.

Build P10 and nothing else. Do not build ahead into any later phase.

KEEP the `if (e.repeat) return;` guard in the keydown listener's menu branch. It
is not redundant and it is not what this phase removes. Browser auto-repeat is
~30/sec and once pinned the music near-silent by thrashing the Music Track row's
crossfade; the fix is that the game now owns the repeat rate, not that the
suppression goes away. Say that in the comment there, or a future reader will
delete the guard as dead weight.

Up and down repeat. Left and right do NOT — that is Paul's explicit call and the
direct answer to the Music Track hazard. Confirm, back and pause never repeat.

One timer, both devices, feeding the existing menuInput(). Neither input handler
may grow a private copy — that is the standing "both handlers or neither" rule.

Two new DEBUG_VARS rows. Update scratchpad/test-registry.js's registry count.

Deliver scratchpad/test-cs042-p10.js with the code. Run `node scratchpad/run-all.js`
before committing — the baseline is 171/171 and test-f6.js is a known ~1.7% flake,
so rerun that one file before treating a failure as a regression.

Commit on main with the subject named in P10. Do not push. Update STATUS.md.
```

### What to build

**Read:** spec §5. GDD §2.16 (menus, options, rebinding — input routing), §2.15 (controller input),
§2.9 (states and controls), §2.19 (registry).

**One shared repeat timer**, ticked once per frame from `loop()` beside `handleGamepadMenu()`, feeding
the existing `menuInput()`.

- `menuRepeat = { dir: null, t: 0 }`.
- `DEBUG.menuRepeatDelay` — `def` from `MENU_REPEAT_DELAY = 0.40`, min 0.1, max 1.5.
- `DEBUG.menuRepeatRate` — `def` from `MENU_REPEAT_RATE = 0.10` (**10/sec**), min 0.03, max 0.5.
- ⛔ **`menuRepeatDelay` at its maximum is effectively pre-phase behaviour** — the gate's A/B.

**The obstacle (§5.3).** Branch (2) of the keydown listener returns *before* writing `keys{}`, so no
held keyboard state exists in menus.

- Add a separate `menuKeys{}` map, written in branch (2) on keydown, cleared in the keyup listener.
- ⛔ **It must never write `keys{}`.** That early return is what stops a menu keypress leaking into
  ship rotation and thrust, and it is not being weakened.
- Gamepad direction reads the existing `menuDirState()`, already a held-state read.
- ⛔ **Clear `menuKeys{}` at every `resetMenuNav()` site** — four of them (menu open, the wave-clear
  arm, both celebration-panel opens) — for the same reason `resetMenuNav()` exists.

**Test — `scratchpad/test-cs042-p10.js`:** a held direction fires once, then nothing until
`menuRepeatDelay`, then once per `menuRepeatRate`; releasing stops it; `left`/`right` never repeat;
`confirm` never repeats; a direction held across a screen change does not repeat into the new screen;
`menuKeys{}` is never written into `keys{}`; `menuRepeatDelay` at max reproduces pre-phase behaviour.

---

## ⛔ GATE C — blocking playtest

**No session. Nothing after this line is built until Paul answers.** Spec §7 carries G1–G10 in full.

⛔ **Clear the debug overrides before asking anything numeric (FLAG-CS036-a).** Any install that has
ever saved settings is not running shipped defaults, and this has spoiled at least one prior gate.

Every question routes to P11's tuning pass. ⛔ **If G7 finds `SHIP_DRAG` kills the drift, the answer is
a lower drag — not reverting P7's model.** The two are separable and must be judged separately.

---

## P11 — Closing

**Model:** Sonnet 5 · **Effort:** High
**Commit subject:** `cs042 p11: tuning pass, docs, version bump, archive`

### Copy-paste prompt

```text
Read CLAUDE.md, then STATUS.md, then this repo's IMPLEMENTATION-PHASES-CS042.md
section "P11 — Closing" in full, including its Close checklist, then
PLANNED-FEATURES-CS042.md §7 (the gate questions whose answers you are applying).

This is CS042's closing phase. Work the eleven numbered items and then the Close
checklist, in order. A no-op tuning pass is a fine outcome if the gate found the
defaults right — do not invent changes to justify the phase.

Three closing-phase rules that are easy to skip and are not optional:
  1. Re-measure EVERY row of GDD §0's size column against the finished GDD before
     you write STATUS.md's headline number. This changeset edited GDD content, so
     those snapshotted sizes are invalid. scratchpad/gdd-sizes.py --check does it
     in one command if that file is still around.
  2. CLAUDE.md had ~1.6 KB of headroom under its 50 KB ceiling at CS041 P9, and
     CS042 adds several rules to it, so it will cross. When it does, the valve
     fires: the "### Audio" section (the only one over ~4 KB, and one this
     changeset edits) moves its REASONING into RATIONALE.md under an #anchor and
     keeps its RULE in CLAUDE.md naming that anchor. Nothing is deleted.
  3. Assert ZERO SKIPS in the suite, not just zero failures.

Update GDD §2 by named subsection, edit every doc in place, roll STATUS.md into
log/CS042.md with its GDD version history entry, reset STATUS.md, and archive both
CS042 planning docs.

Run `node scratchpad/run-all.js` before committing — the baseline is 171/171 and
test-f6.js is a known ~1.7% flake, so rerun that one file before treating a
failure as a regression.

Commit on main with the subject named in P11. Do not push.

ultrathink
```

### What to do

1. **Tuning pass** from GATE C. ⛔ **A no-op commit here is a fine outcome.**
2. **GDD §2 updates**, by named subsection: §2.8 (twelve new sounds + the trigger-site rule), §2.7 and
   §2.14 (health supply), §2.14.1 (scoop levels 6–7, orbs, the 2-hit rate), §2.12 (the reserve's
   second job), §2.1 and §2.10.2 (the handling model and drag), §2.16 (menu repeat), §2.20.1 (whatever
   P5 shipped).
3. ⛔ **Re-measure every row of GDD §0's size column** before writing `STATUS.md`'s headline number.
4. ⛔ **Check `CLAUDE.md` against its 50 KB ceiling** and fire the valve on `### Audio` when it crosses.
5. **`DIFFICULTY-LEVERS.md`** — §4 for the new health, handling and reserve knobs, if it names them.
6. **`TELEMETRY-ANALYSIS-GUIDE.md`** — §7, the `scoopHits` sawtooth rate change (P9).
7. **Version bump** `1.0.0.40` → `1.0.0.41`. ⛔ At a version bump a phase-local version pin flips to
   its standing mirror image (`!== "1.0.0.N"`); it is **not** re-pointed to a new literal. The small
   deliberate set of live pins that genuinely track HEAD's version **is** re-pointed.
8. **`STATUS.md`** rolled into `log/CS042.md` (with its `## GDD version history` entry) and reset.
9. **Both planning docs archived** to `archive/`.
10. **`TODO.md`** — clear the stale "RESUME HERE" block if CS042 superseded it; carry forward anything
    this changeset did not reach.
11. ⛔ **Assert zero skips** in the suite.

### Close checklist

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
