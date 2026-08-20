# PLANNED-FEATURES-CS038 — Credits, glow legibility, telemetry opt-in, knob retirement, voice repetition

**Baseline:** `21bced2` (CS037 P8 closed), `GAME_VERSION = "1.0.0.37"`, registry **114** entries
(60 literal rows + 18 levers × 3), 18 levers, 156 suite files.

Five scope items, none of which touch the simulation:

1. **§1 — A Credits screen**, reachable from Options.
2. **§2 — The low-hull corner glow is hard to notice.** A new measuring instrument, then a retune.
3. **§3 — Telemetry capture becomes opt-in**, off at every launch.
4. **§4 — Retire 12 presentation knobs** from the debug registry.
5. **§5 — Voice lines repeat too often.** Mechanism only; new phrasings are CS039.

---

## 0. Corrections

Recorded because each contradicts an assumption the scope notes were written on. None of these are
opinions — each is a fact checked against `21bced2`.

**C1 — There is no sprite source material to link, and saying so is the point.**
`archive/PLANNED-FEATURES-v3.3.md` FLAG A-7 and `archive/PLANNED-FEATURES-CS028.md` both state the
Garbage Satellite art is *original stylized silhouettes authored in code*, under an explicit
prohibition on importing or tracing NASA / Wikimedia / CC assets, because a CC BY-SA source would
infect the GPL-3.0 single file. `SAT_ART`'s own header repeats it: "ORIGINAL stylized line drawings
authored in code from published geometry; nothing is traced or imported."

So the credits line is an **inspiration list, not an attribution list**, and it must say that no
assets were used — that is the licensing-relevant fact, and it is the opposite of what an attribution
line would imply. Twelve craft ship (`SAT_ART`), enumerated in §1.3.

**C2 — The events that repeat are the ones a no-repeat picker cannot help.**
Only five events have alternatives at all: `health_low` (3), `health_relief` (3), `health_full` (3),
`chain_broken` (4), `chain_guard` (3). Every other event in `VOICE_LINES` — including **`cargo_full`
and `chain_lost`** — has exactly **one** line. A no-repeat *selection* fix does nothing for a
single-line event. This is why §5 ships two independent mechanisms rather than one.

**C3 — CS037 raised the firing rate of exactly those two single-line events.**
CS037 P5 made any HP-dealing hit release the *whole* tow. Before it, a hit broke the chain partially
(`chain_broken`, 4 alternatives, priority 2); now it fires `chain_lost` (1 line, and `VOICE_CRITICAL`,
so it *queues* rather than dropping) and forces a refill from zero to `cargoMax`, which re-arms and
re-fires `cargo_full` (1 line, also `VOICE_CRITICAL`). The complaint is very likely a CS037
regression in cadence, not a long-standing defect — which is also why §5.2's suppression window is
the load-bearing half of this item and §5.1 is the cheap half.

**C4 — `STATUS.md` says `Registry: 115`; a fresh count gives 114.**
60 literal `{ id: …}` rows in `DEBUG_VARS` plus 18 `leverKnob()` spreads × 3 rows = 114. P1 confirms
the live `DEBUG_ENTRIES.length` and corrects `STATUS.md` if 114 is right. **No phase in this
changeset quotes a registry count it has not read from the running build.**

**C5 — Retiring the 12 knobs in §4 is a large phase, not a tidy-up.** Discovered after sign-off, and
logged here rather than silently absorbed. Every one of the 12 ids is referenced by suite files —
roughly 20 of them, in two distinct shapes:

- *Mechanical* — registry-shape pins that carry the id list or a count
  (`test-cs024-p6b.js` holds a literal comma-joined id-order regex; `test-cs026-p6.js`,
  `test-cs029-p4.js`, `test-cs024-p6c.js` pin shape/order/count).
- *Substantive* — the phases that **own** these knobs assert their `def`/`min`/`max`/`step` directly:
  `test-cs035-p1.js` (the six delivery-floater rows), `test-cs036-p4.js` (the four hunter-pulse rows),
  `test-cs030-p3.js` (the two celebration rows).

The substantive ones do not get deleted; each becomes an assertion about the **constant** the knob
collapses into, so the value those phases fought for stays pinned. §4.3 states the rule.
**If the migration balloons past one phase, the correct response is to narrow the retirement set (in
this order: keep hunter-pulse, keep celebration, retire only the delivery floaters) — not to weaken
the assertions.**

**C6 — `sessionOnly` collides with `debugOverride`, and one hook has to cover both.** Discovered
while specifying §3. See §3.2; the resolution is recorded there and is a change to what FORK-CS038-F
was signed off as.

---

## 1. The Credits screen (§1)

### 1.1 Where it lives — and why not the title

**FORK-CS038-A → (c): Credits is a row on `MENU_OPTIONS`.** Resolved with the measurement in hand,
against the originally-proposed (a).

`titleMenuLayout(n)` derives row spacing from a **fixed 132 px band** —
`(VIEW_H/2 + 120 − 24) − (VIEW_H/2 − 60 + 24)` — and silently shrinks the step once rows overflow it:

| N | step | vs. `TITLE_MENU_SIZE = 24` |
|---|------|----------------------------|
| 6 (CS032 P4) | 26.4 | fits |
| **7 (shipped today)** | **22.0** | **already below the font size** |
| 8 (+ Credits) | 18.9 | badly below |

An 8th title row needs the band widened to ~210 px, which means moving the "O V E R H A U L"
baseline up, the flavour line down past `TITLE_MENU_HINT_Y` (530), and the hint down after it — four
title-art constants retuned by eye. `MENU_OPTIONS` is four rows at a 42 px step inside a 600 × 420
`menuPanel`; a fifth row is free, and Options is one key from the title (ESC / B / O).

This does **not** violate CS016 P2's single-parent IA (FORK-CS016-A). That rule says a screen has one
parent; Credits' one parent is Options. CS016 P2 removed *Achievements* and *High Scores* from
`MENU_OPTIONS` because they had acquired two parents, which is a different situation.

> **FLAG-CS038-a (pre-existing, NOT fixed here).** The title menu is over capacity at N = 7 today:
> step 22.0 against 24 px text. Nothing in CS038 makes it worse and nothing in CS038 fixes it.
> Recorded so a future changeset finds it stated rather than re-measuring.

> **⚠ REFUSED OPTION, RECORDED (CS032 P4).** "Hide *Load Saved Game* when no saves exist" was
> considered and refused: `MENU_TITLE.length` drives `titleMenuLayout()`, so a row that comes and
> goes re-centres the whole block and shifts rows under the cursor. That reason still binds. Do not
> re-propose it without acknowledging this record.

> **⚠ DEFERRED, NOT REFUSED — title-menu IA.** Three restructurings were raised and are parked for
> their own changeset, with reasons:
> - *"Load Saved Game" under "Start Game"* — taxes the one-press start CS016 P2 deliberately
>   preserved ("the existing muscle memory survives"), forever, to reclaim one row.
> - *"Profile" moved off the title* — CS031 P5 made that row **be** the active-profile readout, the
>   only place the active profile is displayed. Scores, achievements and saves are all per-profile;
>   hiding it means starting a run under the wrong profile and finding out afterwards.
> - *"High Scores" as a third `ACH_TABS` tab* — not a data edit. An `ACH_TABS` entry carries
>   `rows()` (achievement-shaped) and a `resetWord`, and CS034 P6 made ENTER reset that tab's pool; a
>   High Scores tab needs its own renderer and its own ENTER meaning. The natural pairing is High
>   Scores + Leaderboard (local/online), but **both already spend ◄/► on their own axis**
>   (`HS_FILTERS` vs. `LEADERBOARD_WINDOWS`) and up/down on scroll, so a tab axis has no free input.

### 1.2 How a link actuates

**FORK-CS038-B → (c).** This is the build's first `window.open`; every screen to date is canvas +
keyboard/gamepad.

- A link row is **focusable and selectable**; ENTER / A calls `window.open(url, "_blank", "noopener")`.
- **The full URL is always drawn on screen**, under its label, whether or not the row is selected.

Both halves, because itch.io serves the game inside a sandboxed iframe and a blocked popup fails
**silently**. The drawn URL means a blocked popup costs the player nothing — they can read and type
it. This is the unavailable-row idiom's spirit: never a silently broken affordance.

- A refused / failed `window.open` (returns `null`, or throws) sets a one-line status message on the
  screen — the `Telemetry.msg` / `game.menu.slotMsg` precedent. It never throws into the caller.
- `noopener` is not optional: without it the opened page gets a live `window.opener` handle back into
  the game.

### 1.3 Content

Eight blocks, in order. Rendered from **one data table** (`CREDITS_ROWS`), never from typed draw
calls — the "tracks/lines are DATA" idiom, so a later addition is one table edit.

1. **Title** — `ORBITAL OVERHAUL`, Coinless Games, and `GAME_VERSION`. The version is here so a bug
   report carries it.
2. **Made by** — *input needed, see §6.* The GitHub handle is `freakingid`; the display name is
   Paul's call and the phase prompt must not invent one.
3. **Find it at** — three links:
   - `https://coinlessgames.com`
   - `https://coinlessgames.itch.io/orbital-overhaul`
   - `https://github.com/freakingid/ADD-Orbital-Overhaul`
4. **Inspired by** — *Asteroids Deluxe* (Atari, 1980). Named as inspiration; no assets, no code, no
   trademark claim.
5. **Built with** — Claude Code (`https://www.anthropic.com/claude-code`) and MDN Web Docs
   (`https://developer.mozilla.org`). One MDN link covers both HTML5 and JavaScript; two links to the
   same property would be padding.
6. **Everything you hear is synthesised** — music, sound effects and Dan's voice are all generated at
   runtime through the Web Audio API. No recordings, no samples. Worth stating plainly: it is
   unusual, and it is also why there is no audio credit to give.
7. **Satellite silhouettes** — per **C1**: drawn from scratch in code, **no assets used**, shapes
   inspired by twelve real craft. The twelve, from `SAT_ART` in shipped order: Sputnik 1, Vanguard 1,
   Explorer 1, Telstar 1, Syncom / Early Bird, Hubble Space Telescope, James Webb Space Telescope,
   Voyager, Pioneer 10, Juno, Apollo Lunar Module, Skylab.
8. **License** — GPL-3.0. The source link in block 3 is the source offer.

### 1.4 Screen mechanics

- `game.menu.screen === "credits"`; `menuCredits(a)` in `menuInput`'s switch, `drawCredits()` in
  `drawMenu`'s dispatch. Both follow the `menuHighScores` / `drawHighScores` template.
- `CREDITS_ROWS` entries carry a `kind`: `head` (section heading), `text` (a plain line), `link`
  (label + url). **Only `link` rows are selectable** — up/down skip the rest, exactly as `menuDebug`
  skips `header` rows via `DEBUG_ENTRIES`.
- Scrolling uses the `achMaxScroll()` contract verbatim: input and render clamp against the **same**
  function, so they can never disagree about the ceiling.
- `back` returns to Options with the cursor on the Credits row
  (`gotoScreen("options", MENU_OPTIONS.indexOf("Credits"))`), the established landing idiom.
- Reachable from the title (via Options), mid-run pause, and gameover — Options already is.

---

## 2. The low-hull corner glow (§2)

### 2.1 What is actually shipped

`drawHUD()` draws four radial-gradient corner fills gated on `game.lowHpSiren`, pulsing in phase with
the critical-hull ring and the siren off the shared `game.lowHpPhase`. Peak alpha ramps
`LOWHP_GLOW_ALPHA_MIN` (0.10) → `LOWHP_GLOW_ALPHA_MAX` (0.26) with HP urgency, times a
`0.6 + 0.4·sin` pulse. `LOWHP_GLOW_RADIUS` is 280 px; `LOWHP_GLOW_RGB` is `255,64,64`.

**Peak alpha near death is therefore 0.26 × 1.0 = 0.26, and at the threshold it is 0.10 × 0.2 = 0.02.**
Against a dark field with a HUD already drawing in `#a8d4ff` and two red rings, 0.02 is close to
invisible and 0.26 is a soft wash.

### 2.2 The shape problem is real and may dominate the alpha problem

**FORK-CS038-E → yes: shape is in scope for the instrument.**

Two of the four corners are already occupied — HULL/CARGO rings top-right, powerup rows
bottom-left — and the glow's own header says the radius is sized to *frame* rather than fight them.
At 280 px on a 1280 × 720 viewport, the middle of every edge is dark: the top edge has 720 px of
unlit span between the two corner blobs, the sides 160 px each. A peripheral-vision alarm that is
absent from the middle of every edge may be hard to notice **because of where it is**, not because of
how bright it is. Raising alpha alone would then make two corners louder without making the alarm
more findable.

So the instrument must A/B **shape**, not just intensity:

- four corner blobs (shipped), radius variable;
- a full edge vignette (a gradient inward from all four edges);
- edge bars (a band along each edge, thickness variable);
- and any of the above with the two occupied corners attenuated.

The shipped choice is decided at **GATE A** (§7), not here.

### 2.3 The instrument — `tools/lowhp-glow-lab.html`

**FORK-CS038-D → (a).** A standalone lab in the established `tools/` pattern (no imports, no build
step, opens by double-click), joining `music-lab`, `scoop-lab`, `voice-lab`, `voice-robot-lab`,
`sat-art-lab`, `dock-float-lab`, `emblem-lab`.

**Explicitly NOT (b) — no registry knobs for the glow.** §4 exists to *remove* presentation rows from
the panel, and the house precedent is already written: `CAPTION_LINGER / FADE / Y / SIZE` are
documented as "pure presentation, tuned by eye, no gameplay effect, **no debug-registry entry**."
Look is tuned in a lab; the answer lands in the constants block.

The lab must do three things:

1. **Render the real thing over a real background.** The four-corner gradient block ported
   **verbatim** from `drawHUD()` (the port-verbatim rule every other lab follows), over a
   representative busy frame — dark field, a scatter of vector strokes, and mock HUD furniture in the
   two occupied corners at their true positions and colours. A glow judged against an empty canvas
   is not the judgement being asked for.
2. **A/B, side by side.** Shipped values and candidate values rendered simultaneously, plus a hard
   toggle to flip one against the other in place. Sliders for alpha min/max, radius/thickness, RGB,
   pulse rate, and a shape selector per §2.2. An HP slider drives `t`, so the whole ramp from
   threshold to near-death can be walked.
3. **Measure it, so "brighter" is a number.** This is the half that makes it an instrument rather
   than a preview:
   - probe points sampled off the **composited** canvas (`getImageData`) — the four corners, the
     midpoint of each edge, and the screen centre;
   - relative luminance at each probe at pulse peak and pulse trough;
   - **peak-to-trough contrast ratio** per probe (is the pulse visible at all?) and
     **glow-to-background contrast ratio** per probe (is the glow visible at all?);
   - the same figures for the shipped values alongside, so a candidate is quoted as a multiple of
     today rather than as a bare number.
   - A **worst-probe** readout: the lowest glow-to-background ratio across the eight probes. That
     single number is the answer to "is this alarm findable from anywhere on the edge", and it is the
     number GATE A should be argued in.
4. **A paste-ready dump panel**, per the `voice-robot-lab` / `dock-float-lab` precedent: the chosen
   constants emitted as a paste-ready block, so §2.4 ports rather than retypes.

The lab **must not** be a second implementation of the glow. Port the block; do not rewrite it.

### 2.4 The retune

Constants only, from the lab's dump. If GATE A picks a shape other than four corner blobs, the draw
block changes shape too — but it stays inside `drawHUD()`, stays a **fill** (the named GDD §3.2
fills-exception Paul signed off, for the stated reason: a peripheral alarm is low-frequency,
large-area and edgeless, and a `glowStroke` arc would be a third red HUD *line* and would burn
`shadowBlur`, the renderer's hot spot), stays gated on `game.lowHpSiren`, and stays driven by
`game.lowHpPhase` so siren, ring and glow remain **one alarm at one rate**.

> **⛔ The alpha rides the gradient stop. This block must never touch `ctx.globalAlpha`** — the
> current implementation is written that way specifically so it cannot leak, and CS037's benchmark
> found `ctx.shadowBlur` on Chrome/Skia Graphite to be the renderer's cost centre. A shape change
> that adds `shadowBlur` is a performance regression, not a look change.

---

## 3. Telemetry becomes opt-in (§3)

### 3.1 What ships

A new registry row under the GLOBAL section, beside `telemetryInterval`:

```
{ id: "telemetryCapture", label: "Telemetry capture", unit: "",
  def: 0, min: 0, max: 1, step: 1, boolLabels: ["OFF", "ON"], sessionSwitch: true },
```

`boolLabels` already exists as a display-only hook in `drawDebug` (`DEBUG_OVERRIDE_ID` uses it) and is
reused for free. `def: 0` — **off by default, and off at every launch.**

**The gate is `Telemetry.tick()` and nowhere else.** One early return beside the existing
`Bench.running` guard. Consequences, all intended:

- No rows accrue while off, so no snapshot fires, so `write()` is never reached and
  **`afd_telemetry_v1` is left untouched** by an OFF session. Yesterday's capture is still there this
  morning.
- `read()`, `telemetryExportRows()` and the "Copy telemetry log" action row are **not** gated. The
  export must keep working while capture is off — that is exactly the state you are in the morning
  after a capture session, and gating it would make the previous session's data unreachable.
- `Telemetry.reset()` stays wired to `resetRun()` unchanged. A per-run buffer that clears per run is
  correct whether or not capture is on.

### 3.2 The persistence hook — and the collision found while specifying it

**FORK-CS038-F → (a), with C6's correction folded in.**

`debugShown` is persisted wholesale into `afd_settings_v1.debug` and restored per-entry in
`loadSettings`, so a plain row would survive relaunch — which is the thing the scope note forbids.
The signed-off answer was a `sessionOnly` hook honoured at both the write and the restore.

Specifying it surfaced a second problem the hook has to solve as well. `debugNative()` resolves every
row through `overridesOn()`: with the master **Overrides Applied** toggle OFF, a row derives to its
`def`. For `telemetryCapture` that means the panel would show **ON** while `DEBUG.telemetryCapture`
read 0 and no data was captured — a silent trap for exactly the person using the panel.

Both properties follow from one fact: **this row is not a gameplay tuning value, it is a session
switch.** So it is one hook with one stated reason and three effects:

```
sessionSwitch: true
```

1. **Omitted from `saveSettings`'s `debug` sub-object** — the blob never carries it, so it cannot
   come back.
2. **Skipped in `loadSettings`'s restore loop** — belt and braces; an older hand-edited blob cannot
   revive it either.
3. **Exempt from `overridesOn()`** in `debugNative()` / `rebuildDebug()` — it reads `debugShown[id]`
   directly, like `DEBUG_OVERRIDE_ID` itself does.

> **⛔ `sessionSwitch` IS NOT A GAMEPLAY KNOB HOOK.** It says "this row is instrumentation, not
> tuning". A future row that is genuinely a gameplay value must not wear it to dodge persistence.

`afd_settings_v1` is **not** schema-bumped, **not** renamed, and no key is removed — an id simply
stops being written, which the standing known-value-else-default rule already handles (the CS024 P6
precedent, where `shotPowerupMode` / `magnetMode` / `chainGuardMode` stopped being emitted).

`resetAllDebug()` / the panel's Reset All / `r` all treat it as an ordinary row and set it to `def`
(0). That is correct: reset-to-defaults should turn capture off.

---

## 4. Retire 12 presentation knobs (§4)

### 4.1 The rule being applied

**FORK-CS038-G → the 12 below.** Not a dead-code sweep: **every one of the 114 registry ids has at
least one live consumer.** This is retirement by *settled question*, and the standard is the one the
build already states for `CAPTION_*` — "pure presentation, tuned by eye, no gameplay effect, **no
debug-registry entry**." These twelve meet that standard and predate the standard.

| Section | Ids | Why |
|---|---|---|
| CELEBRATION | `celebrationScrollStep`, `celebrationEmblemSize` | Scroll step and emblem radius. Pure look; the emblem was sized in `emblem-lab` at r=32 and shipped there. |
| DELIVERY | `deliveryFloatRise`, `deliveryFloatSize`, `deliveryFloatSizeStep`, `deliveryFloatSizeMax`, `deliveryFloatHold`, `deliveryFloatFade` | Floating-text look. `tools/dock-float-lab.html` is where these are tuned, and CS035 P1's defs came from a lab session, not the panel. |
| HUNTER | `hunterPulseMin`, `hunterPulseMax`, `hunterPulseGrow`, `hunterPulseShrink` | The volatile-Hunter pulse envelope. Retuned twice (CS035 P4, CS036 P4) and settled at CS036 P4's punch-out/slow-settle shape. |

**114 → 102.**

**Kept, with reasons, so they are not swept next time by momentum:**

- **Level banner** (`levelBannerTime/Fade/Size/Y`) — CS025 P5 (gate Q6) made a level change
  deliberately unmissable, and `levelBannerTime` is read by **two** sites (`nextWave()` and
  `drawLevelBanner()`) as a shared timing contract. Not settled.
- **BENCHMARK** (`benchRampStep/RampInterval/SettleFrames/MaxCount`) — Gate A closed with a null
  result, but its secondary finding stands open in `STATUS.md`: the late-wave frame hiccup is **not**
  entity accumulation and its real cause is unmeasured. The battery will be re-run.

### 4.2 What a retirement is, mechanically

Each id collapses to a plain `const` in the constants block, at **exactly its current `def`**, named
in the file's existing SCREAMING_SNAKE convention, with a comment recording the changeset that set
the value and the lab or gate that picked it. Consumers repoint `DEBUG.<id>` → `<CONST>`.

> **⛔ NO VALUE CHANGES IN THIS PHASE.** A retirement that also retunes cannot be reviewed: a
> behaviour difference at the gate would be unattributable. Every constant lands byte-identical to
> the `def` it replaces.

**No section header is emptied.** Checked: CELEBRATION also holds `levelEndGrace` / `levelEndFade` /
`levelEndGracePulseEnd`, DELIVERY and HUNTER hold many others. The standing rule — *a header dies
with its last knob* — is not triggered. (My earlier note that CELEBRATION would be emptied was
wrong; it has five rows, not two.)

### 4.3 The test migration (see C5)

Roughly 20 suite files reference these ids. Two shapes, two treatments:

- **Mechanical** (registry id-order regexes, shape/order/count pins — `test-cs024-p6b.js`,
  `test-cs024-p6c.js`, `test-cs026-p5.js`, `test-cs026-p6.js`, `test-cs029-p4.js`,
  `test-cs030-p1.js`, `test-cs030-p4.js`, `test-cs030-p5.js`, `test-cs020-p1.js`,
  `test-cs020-p1b.js`, `test-cs025-p1/p2/p5.js`, `test-cs026-p2/p4.js`, `test-cs034-p8.js`,
  `test-cs035-p4.js`): update the expected id list / count. Read the live registry; do not compute
  the new count by arithmetic on a stale one.
- **Substantive** (`test-cs035-p1.js` — the six delivery-floater `def`s; `test-cs036-p4.js` — the
  four hunter-pulse `def`s and the raised `hunterPulseGrow` bound; `test-cs030-p3.js` — the two
  celebration rows): **the assertion moves, it does not disappear.** `hasKnob(X, "hunterPulseGrow",
  { def: 900, … })` becomes an assertion that the new constant equals 900. Those phases fought for
  those numbers; the pin survives the knob.

> `test-cs036-p4.js` §E pins that `pulseScale` never escapes `[hunterPulseMin, hunterPulseMax]`.
> That assertion is about the **mechanism**, not the knob, and must keep passing against the
> constants.

Suite must pass at **zero skips** before the changeset closes (standing rule).

---

## 5. Voice repetition (§5)

**FORK-CS038-H → mechanisms 1 and 2 only. New phrasings are CS039 and are out of scope here.**
No `phon` string is composed, edited, derived or improved by this changeset — the standing rule
(`tools/voice-robot-lab.html` is the only place a `phon` is authored, by Paul, zero-error-verified
before any build session sees it) is untouched.

### 5.1 Mechanism 1 — no immediate repeat of an alternative

`VoiceSys.say()` currently does a plain random pick with replacement, so a 3-line event says the same
line twice in a row 1 time in 3.

Replace with a **uniform pick that excludes the previous choice for that event**:

```
const prev = this.lastLine[event];              // index, or undefined
let i = (Math.random() * (lines.length - (prev == null ? 0 : 1))) | 0;
if (prev != null && i >= prev) i++;
```

Uniform over the remaining `n − 1`, one branch, no re-roll loop, no bag to keep in sync. Degrades
correctly at `n = 1`: the expression yields index 0 every time and the event is unaffected — which is
exactly C2's point, and why §5.2 exists.

- `lastLine` is recorded **at pick time, in `say()`** — not on a successful `_emit`. This matches the
  existing stated design ("the line is picked HERE, at TRIGGER time — a queued critical carries the
  alternative that was rolled when it happened"). The consequence, stated so it is a choice and not a
  bug: an alternative that is picked and then dropped by the gate still rotates. Over 3–4
  alternatives that is benign, and the alternative — threading the index through `_emit` — buys
  nothing for the complexity.
- Cleared in `VoiceSys.reset()`, beside `queue.length = 0`. A fresh run inherits no rotation state.
- `sayLevel()` does not go through `say()` and is unaffected.

### 5.2 Mechanism 2 — per-event repeat suppression

The half that reaches `cargo_full` and `chain_lost`.

An event that spoke within its window is **dropped**. Three constants, all **PLAYTEST KNOBS**, all
plain constants in the constants block — **not registry rows**, for §4's reason:

```
VOICE_REPEAT_GAP           // s — default window, ordinary chatter
VOICE_REPEAT_GAP_CRITICAL  // s — the longer window for VOICE_CRITICAL events
VOICE_REPEAT_EXEMPT        // events the window must not apply to
```

Starting values are proposed in §7 GATE B and are expected to move.

**Placement — and this is the load-bearing detail.** The check goes at the **top of `_emit()`**,
immediately after `const now = AudioSys.now()`, **before** the busy/cooldown branches and therefore
before `_enqueue()`. A suppressed critical must **drop, not park**; parking it would replay the same
line seconds later and defeat the entire item. Paul signed this off explicitly.

**The clock is `AudioSys.now()`, the same clock `busyUntil` runs on.** Not game time.
`VoiceSys.update()`'s header states why the two must not be mixed: a game-clock deadline against an
audio-clock gate expires queued lines during a long pause. Using the audio clock here also means a
five-minute pause lets the window lapse, which is correct — re-saying "Truck is full" after five
minutes is not a repeat.

**The timestamp is written where `busyUntil` and `curPriority` advance** — i.e. only on a line that
actually passes the gate, in captions-only mode as well as with audio on (the two outputs share the
one gate, and a captioned repeat is as annoying as a spoken one).

**`level` is exempt.** `VOICE_REPEAT_EXEMPT` exists for it. The suppression table keys on *event*,
but a `level` firing carries **data** — each one names a different number, so consecutive levels are
not a repeat, and suppressing "Level 6" because "Level 5" spoke nine seconds ago would break CS025
P5's unmissable-level requirement outright. Nothing else in `VOICE_LINES` has this property: the
`dock_*` tiers carry data too, but a second `dock_10` genuinely *is* a repeat of the same line and
stays subject to the window.

> **⛔ This is suppression, not a TTL, and it must not grow into one.** `VoiceSys.update()`'s header
> forbids a TTL on queued entries for a stated reason. This mechanism touches the *entry* gate only:
> it decides whether a line is admitted at all. It adds no expiry to anything already queued, and the
> queue's re-validation (`VOICE_STILL_TRUE`) remains the only thing that discards a parked line.

### 5.3 What is deliberately not done

- **No new lines, no new `phon`.** CS039.
- **`VOICE_PRIORITY` and `VOICE_CRITICAL` are untouched.** Two tables, two questions — the standing
  split. Repetition is a third question and gets a third mechanism rather than a promotion or
  demotion in either table.
- **`VOICE_QUEUE_MAX` is untouched at 5.** No critical event is added or removed.
- **The CS039 worklist is an output of this changeset, not a code change.** The doc-sweep phase
  records which events most need alternatives, in priority order, so Paul's lab session has a
  worklist rather than a memory. On the evidence: `cargo_full` and `chain_lost` first (1 line each,
  both critical, both made more frequent by CS037 P5), then the five `dock_*` tiers, then the ten
  `collect_*` / `expire_*` events.

---

## 6. Input still needed from Paul

1. **Display name for the credits "Made by" line.** GitHub handle is `freakingid`; the phase prompt
   will not invent one. P1 is blocked on this string alone.
2. **GATE A** — the lab session (§7).
3. **GATE B** — the playtest (§7).

---

## 7. Gates

### GATE A — the glow lab session (blocking between P2 and P6)

Run `tools/lowhp-glow-lab.html`. Answers wanted as **numbers**, not yes/no:

- **A1.** Which shape? (four corners / full edge vignette / edge bars / corners with the occupied two
  attenuated)
- **A2.** `LOWHP_GLOW_ALPHA_MIN` and `LOWHP_GLOW_ALPHA_MAX` — the chosen values, and the **worst-probe
  glow-to-background contrast ratio** each produces, quoted against today's.
- **A3.** Radius (or thickness, if a bar/vignette shape wins).
- **A4.** Is the pulse still legible at the chosen brightness — i.e. what is the peak-to-trough ratio?
  A glow bright enough to notice but too bright for the pulse to read has lost the urgency ramp.
- **A5.** Does `LOWHP_GLOW_RGB` move off `255,64,64`? (It currently mirrors `COLOR.lowhp`; moving it
  breaks that mirror deliberately or not at all.)

### GATE B — playtest (blocking between P6 and the doc sweep)

- **B1.** Is the low-hull alarm findable now, in real play, without looking for it?
- **B2.** Do the two red rings and the glow still read as **one** alarm, or does the brighter glow now
  compete with them for focus?
- **B3.** Voice cadence: `VOICE_REPEAT_GAP` and `VOICE_REPEAT_GAP_CRITICAL` — **answer in seconds.**
  Proposed starting values: **12 s** ordinary, **20 s** critical. Take a beating, refill the tow
  several times, and report whether `cargo_full` and `chain_lost` still stack up.
- **B4.** Did suppression ever eat a line that was **needed**? Specifically: a genuine second
  `health_low` after a real recovery, or a `chain_lost` on a second, separate disaster. If so, the
  critical window is too long.
- **B5.** Do the multi-line events (`health_low`, `chain_broken`, `chain_guard`) read as more varied,
  or was the perceived repetition entirely the single-line events? This answer sizes CS039.
- **B6.** Credits screen: readable, correctly ordered, scroll behaving? Do the links open from
  `file://`, from a local server, and **from the itch.io build** (the sandboxed-iframe case §1.2
  exists for)?
- **B7.** Anything missing from the glow retune or the knob retirement that reads as a regression.

---

## 8. Phase plan

| Phase | Scope | Model |
|---|---|---|
| **P1** | Credits screen — `CREDITS_ROWS`, `menuCredits`, `drawCredits`, `openExternal`, the `MENU_OPTIONS` row. Confirms `DEBUG_ENTRIES.length` and fixes `STATUS.md` per C4. | Opus, high |
| **P2** | `tools/lowhp-glow-lab.html` — instrument only; the game file is not touched. | Opus, high |
| **P3** | Telemetry session switch — `sessionSwitch` hook, the `telemetryCapture` row, the `tick()` gate. | Sonnet, high |
| **P4** | Voice — mechanisms 1 and 2. | Opus, high |
| **P5** | Knob retirement — 12 rows → constants, plus the suite migration (C5). | Sonnet, high |
| — | **GATE A** (lab session) | — |
| **P6** | Glow retune from GATE A's dump. Constants, and the draw shape if A1 moved it. | Opus, high |
| — | **GATE B** (playtest) | — |
| **P7** | Doc sweep — GDD §2, `CLAUDE.md`, `STATUS.md`, `log/CS038.md`, the CS039 voice worklist, archive the spent planning docs, `GAME_VERSION` → `1.0.0.38`. | Sonnet, high |

P1–P5 are independent of each other and of GATE A; only P6 blocks on it. P5 is the largest and is the
one to narrow (per C5) if it overruns.