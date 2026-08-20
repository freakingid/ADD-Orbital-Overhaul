# IMPLEMENTATION-PHASES-CS038

Companion to `PLANNED-FEATURES-CS038.md`. Each phase below is a **paste-ready Claude Code prompt**,
self-contained enough to execute without this conversation's history.

**Standing rules for every phase (do not restate them in a session; they are the house rules):**

- One Claude Code session per phase, one commit per phase. **Claude Code never pushes** — Paul
  commits and pushes.
- Re-grep every anchor by symbol before editing. Line numbers drift between sessions and are never
  written into a prompt.
- `CLAUDE.md` is auto-loaded. Attach `DIFFICULTY-LEVERS.md` only where a phase touches levers (none
  here do). **Do not attach `STATUS.md`** — read it from the repo.
- Suite green before the phase is done: `node scratchpad/run-all.js`. Zero skips is asserted at the
  closing phase, not per phase.
- **Codebase vocabulary is inverted on purpose:** `game.debris` holds **Garbage Satellites** (the
  enemies); `game.garbage` holds towable **Debris** (the salvage). Documented in `CLAUDE.md`.

**Order:** P1–P5 are independent and may run in any order. **GATE A** (the glow lab session) blocks
P6. **GATE B** (playtest) blocks P7.

**⛔ Before P1 can run, Paul must supply the display name for the credits "Made by" line.**

---

## P1 — Credits screen

**Model:** Opus, high effort, thinking on.

```
ultrathink

You are implementing CS038 Phase 1 of Orbital Overhaul, per PLANNED-FEATURES-CS038.md §1.
The whole game ships as one file, orbital-overhaul.html. Read PLANNED-FEATURES-CS038.md §0 and §1
in full before writing anything.

Scope: a Credits screen reachable from the Options menu. No gameplay change of any kind.

--- ORIENT FIRST (grep by symbol; never trust a line number) ---

  grep -n "const MENU_OPTIONS" orbital-overhaul.html
  grep -n "function menuOptions" orbital-overhaul.html
  grep -n "function drawOptionsMenu" orbital-overhaul.html
  grep -n "function menuInput" orbital-overhaul.html
  grep -n "function drawMenu()" orbital-overhaul.html
  grep -n "function menuHighScores" orbital-overhaul.html
  grep -n "function drawHighScores" orbital-overhaul.html
  grep -n "function achMaxScroll" orbital-overhaul.html
  grep -n "function gotoScreen" orbital-overhaul.html
  grep -n "function menuPanel" orbital-overhaul.html
  grep -n "function drawMenuHint" orbital-overhaul.html
  grep -n "const GAME_VERSION" orbital-overhaul.html
  grep -n "const SAT_ART" orbital-overhaul.html
  grep -n "Telemetry.msg" orbital-overhaul.html

Read menuHighScores + drawHighScores together: they are the template this screen copies (a
read-only scrolling panel that returns to its parent with the cursor on its own row).

--- WHAT TO BUILD ---

1. CREDITS_ROWS — a DATA TABLE near the other menu row tables (MENU_OPTIONS / SOUND_ROWS /
   DIFFICULTY_ROWS). Entries carry a `kind`:
     { kind: "head", text }          — a section heading, NOT selectable
     { kind: "text", text }          — a plain line, NOT selectable
     { kind: "link", text, url }     — a label plus a URL, SELECTABLE
     { kind: "gap" }                 — vertical spacing, NOT selectable
   The whole screen renders from this table. No typed draw calls per line — the same
   "tracks/lines are DATA" idiom used throughout the file. Adding a credit later must be one
   table edit.

2. The content, in this order and this wording (§1.3). Do not reorder, do not editorialise,
   do not add credits of your own:

   HEAD  ORBITAL OVERHAUL
   TEXT  Coinless Games
   TEXT  Version <GAME_VERSION, read from the constant — never a typed literal>
   GAP
   HEAD  MADE BY
   TEXT  <<<PAUL SUPPLIES THIS STRING — if it is not in this prompt, STOP and ask. Do not
         invent a name, and do not substitute the GitHub handle.>>>
   GAP
   HEAD  FIND IT AT
   LINK  Coinless Games      https://coinlessgames.com
   LINK  itch.io             https://coinlessgames.itch.io/orbital-overhaul
   LINK  Source on GitHub    https://github.com/freakingid/ADD-Orbital-Overhaul
   GAP
   HEAD  INSPIRED BY
   TEXT  Asteroids Deluxe (Atari, 1980)
   GAP
   HEAD  BUILT WITH
   LINK  Claude Code         https://www.anthropic.com/claude-code
   LINK  MDN Web Docs        https://developer.mozilla.org
   GAP
   HEAD  EVERYTHING YOU HEAR IS SYNTHESISED
   TEXT  Music, sound effects and Dan's voice are all generated
   TEXT  at runtime with the Web Audio API. No recordings, no samples.
   GAP
   HEAD  SATELLITE SILHOUETTES
   TEXT  Drawn from scratch in code. No assets were used.
   TEXT  Shapes inspired by:
   TEXT  Sputnik 1 · Vanguard 1 · Explorer 1 · Telstar 1
   TEXT  Syncom / Early Bird · Hubble · James Webb
   TEXT  Voyager · Pioneer 10 · Juno · Apollo Lunar Module · Skylab
   GAP
   HEAD  LICENSE
   TEXT  GPL-3.0. Source at the GitHub link above.

   ⛔ THE SATELLITE BLOCK IS AN INSPIRATION LIST, NOT AN ATTRIBUTION LIST, AND THE "No assets
   were used" LINE IS THE LOAD-BEARING ONE. SAT_ART's own header and archive/PLANNED-FEATURES-
   v3.3.md FLAG A-7 both state these are original line drawings authored in code, under an
   explicit prohibition on importing or tracing NASA/Wikimedia/CC assets because a CC BY-SA
   source would infect the GPL-3.0 file. Do not reword this into anything that reads as
   crediting a source. Verify the twelve names against SAT_ART before you write them.

3. openExternal(url) — the build's FIRST window.open. Put it beside the other small helpers.

     window.open(url, "_blank", "noopener")

   `noopener` is REQUIRED, not stylistic: without it the opened page gets a live window.opener
   handle back into the game. Wrap in try/catch. If the call throws OR returns null (a blocked
   popup), set a one-line status string on the screen — follow the Telemetry.msg / slotMsg
   precedent — saying the popup was blocked and the address is shown on screen. It must never
   throw into the caller and must never be silent.

4. menuCredits(a) — a case in menuInput's switch, screen id "credits".
     up/down   move between SELECTABLE rows only (kind === "link"). Skip head/text/gap
               exactly as menuDebug skips header rows. Wrap both directions.
     confirm   openExternal on the selected link row.
     back      gotoScreen("options", MENU_OPTIONS.indexOf("Credits"))
     pause     closePause()
   Scroll follows menuHighScores: up/down clamp against the SAME max-scroll function the
   renderer uses, per achMaxScroll's standing contract. Decide, and write down in a comment,
   whether up/down move the cursor or scroll — if the content exceeds the panel, keeping the
   selected row visible is the requirement; solve it, don't leave it implicit.

5. drawCredits() — a branch in drawMenu's dispatch. menuPanel, title "CREDITS".
     - head rows: COLOR.text
     - text rows: COLOR.menuIdle
     - link rows: the label, plus THE FULL URL DRAWN UNDERNEATH IT, ALWAYS — selected or not.
       Selected uses the "▶ " prefix and COLOR.text; unselected COLOR.menuIdle. The URL line
       is COLOR.dim.
     - drawMenuHint footer, matching the other screens' wording.
     - the popup-blocked status line, if set.

   ⛔ THE URL IS ALWAYS VISIBLE. This is the whole reason FORK-CS038-B resolved to (c): itch.io
   serves the game inside a sandboxed iframe and a blocked popup fails silently. A drawn URL
   means a blocked popup costs the player nothing. Do not "tidy" this into showing the URL only
   on the selected row.

6. MENU_OPTIONS gains "Credits" before "Back", plus its dispatch branch in menuOptions
   (gotoScreen("credits")). Every consumer addresses MENU_OPTIONS rows BY LABEL via indexOf —
   verify that is still true after the insert and that no positional assumption exists anywhere.
   drawOptionsMenu's panel is 600x420 with a 42px row step; confirm 5 rows still fit and say so.

--- ALSO IN THIS PHASE (C4) ---

Print the live DEBUG_ENTRIES.length from the built script. STATUS.md's header claims
"Registry: 115"; a static count gives 114 (60 literal { id: ... } rows in DEBUG_VARS + 18
leverKnob() spreads x 3). Whichever the running build reports is the truth — correct STATUS.md's
header if it is wrong, and say in your summary which it was. Do NOT change any registry content.

--- DO NOT ---
- Touch MENU_TITLE, titleMenuLayout, or any TITLE_MENU_* constant. FORK-CS038-A resolved to
  Options specifically because an 8th title row does not fit (step would be 18.9px against
  24px text). The title menu is out of scope.
- Add Credits to any second parent. One parent: Options. (CS016 P2's single-parent IA.)
- Add any registry knob.

--- TEST ---
New scratchpad/test-cs038-p1.js using the shared _harness.js (require("./_harness.js"),
buildGame, mkAssert). Pin at least:
  - CREDITS_ROWS shape: every entry has a valid kind; every link has a non-empty https URL;
    the twelve satellite names appear and match SAT_ART's names exactly.
  - The version line reads GAME_VERSION rather than a literal.
  - MENU_OPTIONS contains "Credits" before "Back", and every consumer resolves by label.
  - Nav: up/down land only on link rows, wrap both directions, never select a head/text/gap.
  - back returns to "options" with the cursor on the Credits row.
  - openExternal: a stubbed window.open returning null sets the status message and does not
    throw; a throwing window.open likewise. Assert "noopener" is passed.
  - drawCredits() renders every selection state and both scroll extremes without throwing,
    under the standing headless canvas-Proxy stub. NOTE: that stub answers unknown methods with
    () => {}, so measureText returns undefined and .width on it THROWS — see the note above
    achMaxScroll. If you measure text, handle it the way the existing code does.

Run node scratchpad/run-all.js. Report the counts.

--- DOCS ---
This phase does not sweep docs (P7 does). Leave GAME_VERSION at 1.0.0.37.
Do not commit; do not push. Summarise what landed, what you verified, and anything the spec got
wrong.
```

---

## P2 — `tools/lowhp-glow-lab.html`

**Model:** Opus, high effort, thinking on.

```
ultrathink

You are implementing CS038 Phase 2 of Orbital Overhaul, per PLANNED-FEATURES-CS038.md §2.

Scope: build a NEW standalone design instrument, tools/lowhp-glow-lab.html, for judging and
retuning the low-hull corner glow. THE GAME FILE orbital-overhaul.html IS NOT TOUCHED IN THIS
PHASE — not one character. Verify with git status before you finish.

--- ORIENT FIRST ---

  grep -n "LOWHP_GLOW_" orbital-overhaul.html
  grep -n "lowHpSiren\|lowHpPhase" orbital-overhaul.html
  grep -n "function drawHUD" orbital-overhaul.html
  grep -n "function lowhpPulseRate" orbital-overhaul.html
  grep -n "LOW_HP_THRESHOLD" orbital-overhaul.html
  grep -n "^const COLOR" orbital-overhaul.html

Read the corner-glow block at the top of drawHUD() and the LOWHP_GLOW_* constant block
together, including their comments — they state why it is a fill and not a glowStroke, and that
is a constraint on this lab, not background reading.

Then read tools/dock-float-lab.html and tools/emblem-lab.html for the house instrument pattern:
standalone, no imports, no build step, opens by double-click, a PORT-ME block, a sliders panel,
and a paste-ready dump panel.

--- THE PROBLEM THIS INSTRUMENT EXISTS TO ANSWER ---

The glow is hard to notice in play. There are TWO candidate causes and the lab must be able to
separate them:

  (a) It is too dim. Peak alpha near death is 0.26; AT THE THRESHOLD it is
      0.10 * (0.6 + 0.4*sin) at its trough = 0.06, and the alpha is multiplied by the HP-urgency
      ramp t which is 0 at the threshold — so the alarm STARTS at close to invisible.
  (b) It is in the wrong PLACE. Two of the four corners are already occupied (HULL/CARGO rings
      top-right, powerup rows bottom-left), and at LOWHP_GLOW_RADIUS = 280 on a 1280x720
      viewport the middle of every edge is dark — 720px of unlit span across the top edge.
      A peripheral alarm absent from the middle of every edge may be unfindable no matter how
      bright the corners get.

--- WHAT TO BUILD ---

1. PORT THE REAL BLOCK, VERBATIM. Copy the corner-glow draw block out of drawHUD() as a
   PORT-ME BLOCK and drive it from lab sliders. DO NOT reimplement it. A lab that renders a
   second implementation of the glow answers a question about the lab.

2. A REPRESENTATIVE BACKGROUND, not an empty canvas. 1280x720. Dark field, a scatter of vector
   strokes in the game's palette (COLOR.debris / COLOR.garbage / COLOR.ship), and MOCK HUD
   FURNITURE at its true positions and colours: the HULL/CARGO rings top-right and the powerup
   rows bottom-left. The judgement being asked for is "can I see this against what is actually
   on screen", so the occupied corners must be occupied.

3. A/B, SIDE BY SIDE. Render shipped values and candidate values simultaneously, plus a hard
   toggle that flips one against the other in place. Sliders: alpha min, alpha max, radius (or
   thickness), RGB, pulse rate. An HP slider driving t from 0 (at threshold) to 1 (near death)
   so the whole ramp can be walked — and note in the UI what t is, because t=0 is where the
   alarm is weakest and is the case that matters most.

4. A SHAPE SELECTOR. At minimum:
     - four corner blobs (what ships)
     - full edge vignette (gradient inward from all four edges)
     - edge bars (a band along each edge, thickness variable)
     - corners with the two OCCUPIED corners attenuated by a separate factor
   Each must stay a FILL. Do not introduce shadowBlur anywhere in a candidate shape: CS037's
   benchmark identified ctx.shadowBlur on Chrome/Skia Graphite as the renderer's cost centre,
   so a shape that adds it is a performance regression wearing a look change's clothes.

5. MEASUREMENT — this is the half that makes it an instrument rather than a preview.
   Sample the COMPOSITED canvas with getImageData at eight probes: the four corners, the
   midpoint of each edge. Plus the screen centre as a control. For each probe report:
     - relative luminance at pulse peak and at pulse trough
     - peak-to-trough contrast ratio  (is the PULSE visible?)
     - glow-to-background contrast ratio  (is the GLOW visible at all?)
     - the same four figures for the SHIPPED values alongside, so a candidate is quoted as a
       multiple of today rather than as a bare number
   And one headline number: WORST-PROBE glow-to-background ratio — the lowest across the eight.
   That single figure answers "is this alarm findable from anywhere on the edge", and it is the
   number GATE A will be argued in. Make it big and obvious in the UI.

   Use a standard relative-luminance formula and say in a comment which one and why.

6. A PASTE-READY DUMP PANEL emitting the chosen constants as a block ready to paste, following
   voice-robot-lab / dock-float-lab. P6 ports from this dump; it must not retype.

--- DO NOT ---
- Touch orbital-overhaul.html.
- Add a debug-registry knob for the glow. §4 of this changeset REMOVES presentation knobs from
  the registry, and CAPTION_LINGER/FADE/Y/SIZE are the standing precedent: pure presentation is
  tuned in a lab and lands in the constants block, never in the panel.
- Change LOWHP_GLOW_RGB's default away from mirroring COLOR.lowhp. The lab may explore it; the
  mirror is deliberate and breaking it is a GATE A decision, not a lab default.

--- TEST ---
New scratchpad/test-cs038-p2.js. Follow the tools-lab test precedent (see test-cs010-p8.js):
extract the lab's script and drive it under a stubbed DOM, no real canvas. Pin the pure parts —
the luminance function against known inputs, the contrast-ratio arithmetic, the probe
coordinates being inside the viewport, each shape producing a nonzero fill somewhere, and the
dump panel emitting parseable output that round-trips the slider values. node --check clean.

Run node scratchpad/run-all.js.

--- DOCS ---
Add the lab to CLAUDE.md's Design instruments list. Nothing else — P7 sweeps.
Do not commit; do not push. Report git status showing orbital-overhaul.html unmodified.
```

---

## P3 — Telemetry session switch

**Model:** Sonnet, high effort.

```
You are implementing CS038 Phase 3 of Orbital Overhaul, per PLANNED-FEATURES-CS038.md §3.

Scope: telemetry capture becomes OPT-IN, off by default and off at every launch.

--- ORIENT FIRST ---

  grep -n "const Telemetry" orbital-overhaul.html
  grep -n "telemetryInterval" orbital-overhaul.html
  grep -n "const DEBUG_OVERRIDE_ID\|function overridesOn\|function debugNative" orbital-overhaul.html
  grep -n "function applyDebug\|function rebuildDebug\|function resetAllDebug" orbital-overhaul.html
  grep -n "function saveSettings\|function loadSettings" orbital-overhaul.html
  grep -n "boolLabels" orbital-overhaul.html

Read the Telemetry object's header comment in full, and the block above DEBUG_VARS explaining
DEBUG / debugShown / toNative / clampShown / overridesOn.

--- WHAT TO BUILD ---

1. A new registry hook, `sessionSwitch: true`. It means: THIS ROW IS INSTRUMENTATION, NOT A
   GAMEPLAY TUNING VALUE. One hook, three effects, one stated reason:

     (a) OMITTED from saveSettings' `debug` sub-object. The blob never carries it.
     (b) SKIPPED in loadSettings' per-entry restore loop. Belt and braces: an older or
         hand-edited blob cannot revive it either.
     (c) EXEMPT from overridesOn() in debugNative() and rebuildDebug() — it reads
         debugShown[id] directly, the same way DEBUG_OVERRIDE_ID itself does.

   (c) IS NOT OPTIONAL AND IS THE PART THAT IS EASY TO MISS. Without it, with the master
   "Overrides Applied" toggle OFF, debugNative returns e.def = 0 while the panel still shows
   ON — the row would read ON and capture nothing. That is a silent trap for the exact person
   using the panel.

   ⛔ Write a comment saying sessionSwitch is NOT a way for a future gameplay knob to dodge
   persistence. It is for instrumentation only.

2. The row, in the GLOBAL section beside telemetryInterval:

     { id: "telemetryCapture", label: "Telemetry capture", unit: "",
       def: 0, min: 0, max: 1, step: 1, boolLabels: ["OFF", "ON"], sessionSwitch: true },

   boolLabels is an existing display-only hook in drawDebug (DEBUG_OVERRIDE_ID uses it) — reuse
   it, do not add a parallel mechanism. Check the label fits the panel's HARD 32-character label
   column (see the DEBUG_VALUE_X comment); "Telemetry capture" is 17, fine.

3. THE GATE IS Telemetry.tick() AND NOWHERE ELSE. One early return beside the existing
   Bench.running guard.

   Consequences, all intended — write them into the comment:
     - No rows accrue while off, so push() never runs, so write() never runs, so
       afd_telemetry_v1 is LEFT UNTOUCHED by an off session. Yesterday's capture survives.
     - read(), telemetryExportRows() and the "Copy telemetry log" action row are NOT gated.
       The export must keep working while capture is off — that is precisely the state you are
       in the morning after a capture session, and gating it would make the data unreachable.
     - Telemetry.reset() stays wired to resetRun() unchanged.

4. afd_settings_v1 is NOT schema-bumped, NOT renamed, and no key is deleted. An id simply stops
   being written — the standing known-value-else-default rule already covers it, exactly as it
   covered CS024 P6 dropping shotPowerupMode / magnetMode / chainGuardMode.

5. resetAllDebug() / Reset All / `r` treat the row as ordinary and set it to def (0). Correct:
   reset-to-defaults turns capture off. Do not special-case it.

--- TEST ---
New scratchpad/test-cs038-p3.js on _harness.js. Pin:
  - Fresh boot: DEBUG.telemetryCapture === 0 and Telemetry.tick() accrues nothing over many
    frames, with localStorage untouched at afd_telemetry_v1.
  - Turn it on, drive update(1/60) past the interval, rows appear and the envelope is written.
  - THE LAUNCH TEST, which is the whole point: turn it on, saveSettings(), build a FRESH
    instance, loadSettings() — it must come back 0. Assert the saved blob's `debug` sub-object
    does not contain the key at all.
  - The overrides interaction: with debugOverride OFF, telemetryCapture set to 1 still reads 1
    in DEBUG (effect (c)). Assert the same for rebuildDebug()'s full pass, not just applyDebug's
    single-field write.
  - The export still works with capture off: seed afd_telemetry_v1, capture off, and confirm
    telemetryExportRows() returns the stored rows.
  - Every OTHER registry entry is unaffected by the new hook — the count grows by exactly one
    and no existing id changes shape.
Existing registry-shape tests will need their expected count/id-list updated (+1). Find them:
  grep -rn "DEBUG_ENTRIES.length\|hasKnob" scratchpad/*.js
Read the live registry for the new count; do not compute it from a stale number.

Run node scratchpad/run-all.js.

--- DOCS ---
None (P7 sweeps). Leave GAME_VERSION alone. Do not commit; do not push.
```

---

## P4 — Voice: no-repeat selection + per-event repeat suppression

**Model:** Opus, high effort, thinking on.

```
ultrathink

You are implementing CS038 Phase 4 of Orbital Overhaul, per PLANNED-FEATURES-CS038.md §5.

Scope: voice lines repeat too often, too close together. TWO mechanisms, both pure channel
logic. NO NEW LINES AND NO NEW PHON STRINGS — those are CS039.

⛔ STANDING RULE, ABSOLUTE: all `phon` strings are composed and zero-error-verified by Paul in
tools/voice-robot-lab.html. Claude Code never derives, edits, improves or invents a phon string.
This phase adds none, edits none, and touches VOICE_LINES' CONTENT not at all.

--- ORIENT FIRST ---

  grep -n "const VOICE_LINES" orbital-overhaul.html
  grep -n "const VOICE_PRIORITY\|const VOICE_CRITICAL\|const VOICE_QUEUE_MAX" orbital-overhaul.html
  grep -n "const VOICE_STILL_TRUE\|const VOICE_COOLDOWN" orbital-overhaul.html
  grep -n "  say(event)\|  sayLevel(\|  _emit(\|  _enqueue(\|  update()\|  reset()" orbital-overhaul.html
  grep -n "VoiceSys.say(" orbital-overhaul.html

Read VoiceSys.say / _emit / _enqueue / update / reset as one unit, INCLUDING their comments.
The comments state design rules this phase must not break — in particular the two-tables split
(priority answers "may this INTERRUPT?", criticality answers "may this WAIT?") and the explicit
prohibition on adding a TTL.

--- CONTEXT YOU NEED (verify it; do not take it on faith) ---

Only FIVE events have alternatives: health_low (3), health_relief (3), health_full (3),
chain_broken (4), chain_guard (3). EVERY other event — including cargo_full and chain_lost —
has exactly ONE line. So a no-repeat picker cannot help the two events that annoy most. That is
why there are two mechanisms and why mechanism 2 is the load-bearing one.

Also: CS037 P5 made any HP-dealing hit release the WHOLE tow, so chain_lost (1 line, critical)
now fires where chain_broken (4 lines) used to, and the forced refill re-fires cargo_full
(1 line, critical) far more often than before. The cadence problem is largely a CS037 side
effect.

--- MECHANISM 1: no immediate repeat of an alternative ---

say() currently does a plain random pick WITH replacement. Replace with a uniform pick that
EXCLUDES the previous choice for that event:

    const prev = this.lastLine[event];               // index, or undefined
    let i = (Math.random() * (lines.length - (prev == null ? 0 : 1))) | 0;
    if (prev != null && i >= prev) i++;

Uniform over the remaining n-1, one branch, no re-roll loop, no bag. At n === 1 it yields index
0 every time and the event is unaffected — which is correct and is why mechanism 2 exists.

  - Record lastLine AT PICK TIME, in say(), not on a successful _emit. This matches the existing
    stated design ("the line is picked HERE, at TRIGGER time — a queued critical carries the
    alternative that was rolled when it happened"). Write a comment stating the consequence
    plainly: an alternative that is picked and then dropped by the gate still rotates. Over 3-4
    alternatives that is benign; threading the index through _emit buys nothing.
  - Clear lastLine in VoiceSys.reset(), beside queue.length = 0.
  - sayLevel() does not go through say() and is unaffected.

--- MECHANISM 2: per-event repeat suppression ---

An event that spoke within its window is DROPPED. Three PLAYTEST-KNOB constants in the constants
block near VOICE_COOLDOWN — plain constants, NOT registry rows (§4 of this changeset removes
presentation rows from the panel; CAPTION_* is the standing precedent):

    VOICE_REPEAT_GAP          = 12    // s — default window, ordinary chatter
    VOICE_REPEAT_GAP_CRITICAL = 20    // s — the longer window for VOICE_CRITICAL events
    VOICE_REPEAT_EXEMPT       = { level: true }

Resolve per event through one small helper so there is one rule in one place.

⛔ PLACEMENT IS LOAD-BEARING. The check goes at the TOP of _emit(), immediately after
`const now = AudioSys.now()`, BEFORE the busy/cooldown branches and therefore BEFORE
_enqueue(). A suppressed critical must DROP, NOT PARK. Parking it would replay the same line
seconds later and defeat the entire item. Paul signed this off explicitly.

⛔ THE CLOCK IS AudioSys.now() — the same clock busyUntil runs on. NOT game time.
VoiceSys.update()'s header states why the two must never be mixed. Using the audio clock also
means a long pause lets the window lapse, which is CORRECT: re-saying "Truck is full" after
five minutes is not a repeat.

⛔ WRITE THE TIMESTAMP WHERE busyUntil AND curPriority ADVANCE — i.e. only on a line that
actually passes the gate, and in captions-only mode as well as with audio on. The two outputs
share the one gate, and a captioned repeat is as annoying as a spoken one.

⛔ `level` IS EXEMPT, and VOICE_REPEAT_EXEMPT exists for it. The table keys on EVENT, but a
`level` firing carries DATA — each one names a different number, so consecutive levels are not
a repeat, and suppressing "Level 6" because "Level 5" spoke nine seconds ago would break CS025
P5's unmissable-level requirement outright. Nothing else has this property: the dock_* tiers
carry data too, but a second dock_10 genuinely IS a repeat of the same line and stays subject
to the window.

⛔ THIS IS SUPPRESSION, NOT A TTL, AND MUST NOT GROW INTO ONE. VoiceSys.update()'s header
forbids a TTL on queued entries for a stated reason. This mechanism touches the ENTRY gate only.
It adds no expiry to anything already queued; VOICE_STILL_TRUE remains the only thing that
discards a parked line.

Clear the timestamp map in VoiceSys.reset().

--- DO NOT ---
- Touch VOICE_PRIORITY or VOICE_CRITICAL. Two tables, two questions; repetition is a THIRD
  question and gets a third mechanism, not a promotion or demotion in either table.
- Touch VOICE_QUEUE_MAX (stays 5) — no critical event is added or removed.
- Add, remove, reword or re-phon any line.
- Change any say() call site.

--- TEST ---
New scratchpad/test-cs038-p4.js on _harness.js, driving the real VoiceSys under the standing
Web-Audio-Proxy mock. Pin:
  - Mechanism 1: over many picks on a 3-line event, the same index never appears twice in a
    row; and the distribution over the excluded-pick is uniform over the other two (seed
    Math.random via scratchpad/_seeded-random.js so this is deterministic, not flaky).
  - n === 1 events are unaffected and never throw.
  - reset() clears lastLine — a fresh run's first pick is unconstrained.
  - Mechanism 2: a second cargo_full inside VOICE_REPEAT_GAP_CRITICAL is DROPPED and NOT
    QUEUED. Assert queue.length is unchanged — this is the assertion that catches the
    placement bug if the check lands after the critical branch.
  - The same event outside its window speaks normally.
  - Ordinary events use VOICE_REPEAT_GAP, criticals use VOICE_REPEAT_GAP_CRITICAL. Assert both
    numbers are actually being read, not one applied to everything.
  - level is exempt: sayLevel(5) then sayLevel(6) one second apart — BOTH are admitted.
  - Captions-only (voice style "off", captions on): the timestamp still advances, so a repeat
    is suppressed with audio off too.
  - The queue drain still works: a critical that loses the gate on a busy channel still parks
    and still drains, and VOICE_STILL_TRUE still discards a stale one. This phase must not
    regress CS025 P4/P5 or CS037 P5 behaviour — check test-cs025-p4.js and test-cs037-p5.js
    still pass unmodified, and if one needs a change, say why in your summary rather than
    editing it quietly.

Run node scratchpad/run-all.js.

--- DOCS ---
None (P7 sweeps). Do not commit; do not push. In your summary, list which events you observed
firing most often, as raw material for CS039's worklist.
```

---

## P5 — Retire 12 presentation knobs

**Model:** Sonnet, high effort. The largest phase; see the narrowing note.

```
You are implementing CS038 Phase 5 of Orbital Overhaul, per PLANNED-FEATURES-CS038.md §4.

Scope: retire TWELVE pure-presentation knobs from the debug registry, collapsing each to a plain
constant at EXACTLY its current default. Registry 114 -> 102 (verify both numbers live).

The twelve:
  CELEBRATION  celebrationScrollStep, celebrationEmblemSize
  DELIVERY     deliveryFloatRise, deliveryFloatSize, deliveryFloatSizeStep,
               deliveryFloatSizeMax, deliveryFloatHold, deliveryFloatFade
  HUNTER       hunterPulseMin, hunterPulseMax, hunterPulseGrow, hunterPulseShrink

The rule being applied is the file's own, already written above CAPTION_LINGER: pure
presentation, tuned by eye, no gameplay effect, NO DEBUG-REGISTRY ENTRY. These twelve meet that
standard and predate it. This is NOT a dead-code sweep — every one of the 114 ids has a live
consumer.

--- ORIENT FIRST ---

  grep -n "const DEBUG_VARS" orbital-overhaul.html
  grep -n "const DEBUG_ENTRIES\|const CAPTION_LINGER" orbital-overhaul.html
  for id in celebrationScrollStep celebrationEmblemSize deliveryFloatRise deliveryFloatSize \
            deliveryFloatSizeStep deliveryFloatSizeMax deliveryFloatHold deliveryFloatFade \
            hunterPulseMin hunterPulseMax hunterPulseGrow hunterPulseShrink; do
    echo "== $id"; grep -n "$id" orbital-overhaul.html; done

--- HOW TO RETIRE ONE ---

Each id becomes a plain const in the constants block at EXACTLY its current `def`, in the
file's SCREAMING_SNAKE convention, with a comment recording (a) the changeset that set the
value and (b) the lab or gate that picked it — that provenance is in the registry comments
today and must survive the move, not be dropped with the row. Then repoint every
DEBUG.<id> consumer.

⛔ NO VALUE CHANGES IN THIS PHASE. A retirement that also retunes cannot be reviewed: a
behaviour difference at the gate would be unattributable to either change. Every constant lands
byte-identical to the def it replaces. State in your summary that you verified this per id.

⛔ NO SECTION HEADER IS EMPTIED — verified: CELEBRATION also holds levelEndGrace /
levelEndFade / levelEndGracePulseEnd, and DELIVERY and HUNTER hold many others. The standing
rule "a header dies with its last knob" is NOT triggered here. Confirm this yourself before
deleting anything; if you find a header would be emptied, STOP and report it.

Keep, and do not touch: levelBannerTime/Fade/Size/Y (CS025 P5's unmissable-level requirement is
not settled, and levelBannerTime is a two-site timing contract), and the four BENCHMARK rows
(STATUS.md carries an open finding — the late-wave frame hiccup is not entity accumulation and
its cause is unmeasured, so the battery will be re-run).

--- THE SUITE MIGRATION — THE BULK OF THE WORK ---

Roughly 20 files reference these ids. Two shapes, two treatments:

  MECHANICAL — registry-shape pins carrying an id list, order, or count. test-cs024-p6b.js
  holds a literal comma-joined id-order regex; also test-cs024-p6c.js, test-cs026-p5.js,
  test-cs026-p6.js, test-cs029-p4.js, test-cs030-p1.js, test-cs030-p4.js, test-cs030-p5.js,
  test-cs020-p1.js, test-cs020-p1b.js, test-cs025-p1/p2/p5.js, test-cs026-p2/p4.js,
  test-cs034-p8.js, test-cs035-p4.js. Update the expected list/count. READ THE LIVE REGISTRY
  for the new count; never compute it by arithmetic on a stale one.

  SUBSTANTIVE — the phases that OWN these knobs and assert their def/min/max/step:
    test-cs035-p1.js  the six delivery-floater defs
    test-cs036-p4.js  the four hunter-pulse defs and the raised hunterPulseGrow bound
    test-cs030-p3.js  the two celebration rows
  ⛔ THE ASSERTION MOVES, IT DOES NOT DISAPPEAR. hasKnob(X, "hunterPulseGrow", { def: 900, ... })
  becomes an assertion that the new constant equals 900. Those phases fought for those numbers
  and the pin survives the knob. Deleting a substantive assertion is the failure mode this
  phase is most likely to produce — do not.

  test-cs036-p4.js §E pins that pulseScale never escapes [hunterPulseMin, hunterPulseMax].
  That is about the MECHANISM, not the knob, and must keep passing against the constants.

New scratchpad/test-cs038-p5.js pinning: none of the twelve ids appears in DEBUG_ENTRIES; each
new constant equals the old def exactly; DEBUG_ENTRIES.length is the live 102; every remaining
id is untouched; and the three affected behaviours (celebration scroll, delivery floater growth,
hunter pulse envelope) are unchanged end-to-end through real update()/draw paths.

--- IF THIS OVERRUNS ---
Narrow the set rather than weakening assertions, in this order: keep hunter-pulse, keep
celebration, retire only the six delivery floaters. Report what you narrowed and why. Do NOT
half-retire an id (constant added but consumers still reading DEBUG) — that is worse than not
starting.

Run node scratchpad/run-all.js. Report pass/fail/skip counts and the live DEBUG_ENTRIES.length.

--- DOCS ---
None (P7 sweeps). Do not commit; do not push.
```

---

## GATE A — the glow lab session (blocks P6)

Paul runs `tools/lowhp-glow-lab.html`. **Answers as numbers, not yes/no.**

- **A1** Shape: four corners / full edge vignette / edge bars / corners with the occupied two attenuated?
- **A2** `LOWHP_GLOW_ALPHA_MIN` and `LOWHP_GLOW_ALPHA_MAX` — chosen values, plus the **worst-probe
  glow-to-background contrast ratio** each produces, quoted against today's.
- **A3** Radius (or thickness, if a bar/vignette shape wins).
- **A4** Peak-to-trough ratio at the chosen brightness — is the pulse still legible? A glow bright
  enough to notice but too bright for the pulse to read has lost the urgency ramp.
- **A5** Does `LOWHP_GLOW_RGB` move off `255,64,64`? It currently mirrors `COLOR.lowhp`; break that
  mirror deliberately or not at all.

---

## P6 — Glow retune

**Model:** Opus, high effort, thinking on.

```
ultrathink

You are implementing CS038 Phase 6 of Orbital Overhaul, per PLANNED-FEATURES-CS038.md §2.4.

Scope: apply GATE A's answers to the shipped low-hull corner glow.

GATE A ANSWERS (paste them here before running — if this block is empty, STOP):
  A1 shape:        <<<>>>
  A2 alpha min/max:<<<>>>   worst-probe ratio vs today: <<<>>>
  A3 radius/thick: <<<>>>
  A4 peak/trough:  <<<>>>
  A5 RGB:          <<<>>>

--- ORIENT FIRST ---

  grep -n "LOWHP_GLOW_" orbital-overhaul.html
  grep -n "function drawHUD" orbital-overhaul.html
  grep -n "lowHpSiren\|lowHpPhase" orbital-overhaul.html

Port from tools/lowhp-glow-lab.html's dump panel. DO NOT RETYPE VALUES — the lab is the source
of truth and the port-verbatim rule applies here as it does to every other lab.

--- INVARIANTS THIS PHASE MUST NOT BREAK ---

⛔ It stays a FILL. A named GDD §3.2 fills-exception, signed off with a stated reason: a
peripheral-vision alarm is low-frequency, large-area and EDGELESS, which is what makes it
readable out of the corner of the eye without competing with the two red rings for focus. A
glowStroke arc would be a LINE — a third red HUD element, the very noise this exists to avoid.

⛔ NO shadowBlur, anywhere, in any shape. CS037's benchmark identified ctx.shadowBlur on
Chrome/Skia Graphite as the renderer's cost centre. A shape change that adds it is a
performance regression wearing a look change's clothes.

⛔ ALPHA RIDES THE GRADIENT STOP. This block must NEVER touch ctx.globalAlpha — the current
implementation is written that way specifically so it cannot leak.

⛔ It stays gated on game.lowHpSiren — the EXACT same predicate as the audio siren — and stays
driven by game.lowHpPhase, so siren, critical-hull ring and glow remain ONE alarm at ONE
HP-ramped rate. Do not introduce a second phase accumulator or a second rate.

⛔ It stays inside drawHUD(), drawn FIRST so the readouts paint crisply over it, so that
Capture's H key hides it and P exports a clean frame.

⛔ Intensity scales with BOTH t (brighter near death) and the pulse. Never merely faster.

If A1 changed the shape, all of the above still bind — the shape is the only thing that moves.
Update the constant names and the block comment to describe what is actually drawn; a comment
saying "four corners" over an edge vignette is a defect.

--- TEST ---
New scratchpad/test-cs038-p6.js: the constants equal the lab dump; the block is unreachable when
lowHpSiren is false; alpha at t=0 and t=1 bracket correctly; globalAlpha is never written (spy
on the stubbed ctx); no shadowBlur is set inside the block; peak scales with t. Update any
existing test pinning the old LOWHP_GLOW_* values — grep for them.

Run node scratchpad/run-all.js. Do not commit; do not push.
```

---

## GATE B — playtest (blocks P7)

- **B1** Is the low-hull alarm findable in real play, without looking for it?
- **B2** Do the two red rings and the glow still read as **one** alarm, or does the brighter glow now
  compete for focus?
- **B3** `VOICE_REPEAT_GAP` and `VOICE_REPEAT_GAP_CRITICAL` — **answer in seconds.** Starting values
  12 / 20. Take a beating, refill the tow repeatedly, report whether `cargo_full` and `chain_lost`
  still stack up.
- **B4** Did suppression ever eat a line that was *needed* — a genuine second `health_low` after a
  real recovery, or a `chain_lost` on a second separate disaster? If so the critical window is long.
- **B5** Do `health_low` / `chain_broken` / `chain_guard` read as more varied, or was the perceived
  repetition entirely the single-line events? This answer sizes CS039.
- **B6** Credits: readable, correctly ordered, scroll right? Do links open from `file://`, from a
  local server, and **from the itch.io build** (the sandboxed-iframe case)?
- **B7** Anything in the glow retune or the knob retirement that reads as a regression.

---

## P7 — Doc sweep, CS039 worklist, version bump

**Model:** Sonnet, high effort.

```
You are closing CS038 of Orbital Overhaul. This is the doc-sweep-and-version-bump phase; GATE B
is closed and its answers are below.

GATE B ANSWERS (paste before running — if empty, STOP):
  <<<>>>

Apply any GATE B tuning first (voice windows, glow constants). Values only — no new mechanism at
the closing phase.

Then:

1. GAME_VERSION -> "1.0.0.38".

2. ORBITAL-OVERHAUL-GDD.md §2 — SHIPPED BEHAVIOUR ONLY, never planned features. Add/update:
   the Credits screen under Options; the low-hull alarm's retuned glow (and its shape, if it
   changed); telemetry capture being opt-in and session-scoped; the voice channel's two new
   repetition mechanisms. Version history folds into log/CS038.md, not the GDD.

3. CLAUDE.md:
   - the sessionSwitch hook, with its "instrumentation only, not a persistence dodge" rule
   - the voice section: mechanisms 1 and 2, the AudioSys.now() clock rule, the drop-not-park
     rule for suppressed criticals, and the standing no-TTL prohibition restated
   - tools/lowhp-glow-lab.html in Design instruments
   - the twelve retired knobs, as a ⚠ SETTLED note naming the CAPTION_* precedent, so a future
     changeset does not re-add them as if they were an oversight
   - openExternal / window.open as a new capability, with the noopener requirement

4. STATUS.md — roll to CS038, keep roughly the last three changesets, prune older content to
   log/. Update the header's Registry count from the LIVE build. Never allow two entries on one
   physical line (the shell-append trailing-newline pitfall).

5. log/CS038.md — the per-changeset record.

6. NEW: a CS039 voice worklist. Record which events most need alternatives, in priority order,
   for Paul's tools/voice-robot-lab.html session. On the evidence: cargo_full and chain_lost
   first (one line each, both VOICE_CRITICAL, both made more frequent by CS037 P5), then the
   five dock_* tiers, then the ten collect_*/expire_* events. State how many alternatives each
   wants and why. ⛔ COMPOSE NO PHON. This is a list of EVENTS AND ENGLISH TEXT IDEAS ONLY;
   every phon is authored by Paul in the lab and pasted in by a later changeset.

7. Archive PLANNED-FEATURES-CS038.md and IMPLEMENTATION-PHASES-CS038.md to archive/.

8. THE SUITE MUST PASS AT ZERO SKIPS. node scratchpad/run-all.js — report pass/fail/skip.
   A nonzero skip count blocks the close; do not close around it.

Do not commit; do not push.
```