# IMPLEMENTATION-PHASES-CS011 — Player-selectable voice styles + captions

**Changeset:** CS011. **Baseline:** shipped CS010 `VoiceSys` (HEAD `525c47b`). **Turns** the signed-off
`PLANNED-FEATURES-CS011.md` into dependency-ordered, session-sized Claude Code phases.
**Version:** bump `GAME_VERSION` per Paul's semver scheme (real-semver display shipped in CS010) — exact
string is Paul's call, set it in whichever phase Paul prefers (recommend P3, the last player-visible
change before the two data phases).

Port source for all voice audio/data this changeset: **`tools/voice-robot-lab.html`** (the six style
presets, the ring stage, and — after P0 — the new dictionary phon). It supersedes `voice-lab.html` as the
style/robot instrument; `voice-lab.html` stays as the CS010 engine source.

No auto-push. Claude Code commits nothing to `main` — Paul commits and pushes each phase himself. Each
phase ends with the commit message to hand to Paul, not a `git push`.

---

## 0. Grep-confirmed against the live build (done this session — re-verify before editing)

The spec's §0 anchors drift by a few lines against the shipped file; **these are the actual anchors as
grepped in the attached `asteroids-deluxe.html` (5709 lines).** Each phase prompt still tells Claude Code
to re-grep the symbol, not trust a number.

| Symbol | Spec §0 said | **Actual** | Notes |
|---|---|---|---|
| `VOICE_PARAMS` | L1432 | **L1432** | single `const`, full-shaped; `radio{on,hp,lp,drive,static}` |
| `VOICE_LINES` | L1458 | **L1458** | keyed by event, arrays of `{text,phon}`; 24 lines |
| `VOICE_COOLDOWN` | — | **L1549** | `= 1.2` |
| `VOICE_PRIORITY` | L1553 | **L1550** | `{health_low:3, health_relief:2, health_full:2}` |
| `VoiceSys` | L1555 | **L1555** | `ensure` L1566, `applyRadio` L1593, `_stop` L1606, `reset` L1619, `say` L1623, `dockDelivery` L1644, `_render` L1653 |
| `_render`'s `buildUtterance` line | L1659 | **L1659** | the one line that moves up to `_emit` |
| Engine (`PH`/`parsePhonTokens`/`buildUtterance`/`buildPitch`) | — | **L1286 / L1321 / L1334 / L1408** | `buildUtterance` is **PURE**; `parsePhonTokens` skips `/` as a cosmetic word gap |
| `settings` | L2099 | **L2099** | `shotPowerupMode, magnetMode, musicTrack, shipTurnScale` |
| `MUSIC_TRACK_VALUES`/`LABELS` | — | **L2108 / L2109** | the cycler idiom to mirror |
| `SOUND_ROWS` | L2090 | **L2090** | `["SFX Volume","Music Volume","Master Volume","Voice Volume","Music Track","Back"]` |
| `VOL_CATS`/`VOL_LABELS` | — | **L2091 / L2092** | volume rows dispatch **by label**, not by SOUND_ROWS index — row inserts are index-safe |
| `menuSound` | L2210 | **L2210** | label-dispatch; Music-Track cycler branch L2221 |
| `drawSound` | L4918 | **L4918** | `menuPanel(600, 510, …)`; footer at `y + 490`; else-branch handles Music Track only |
| `menuPanel` / `drawText` | — | **L4878 / L4852** | `drawText(str,x,y,size,color,align)` — does **not** touch `ctx.globalAlpha` |
| `STORAGE_KEY` / `saveSettings` / `loadSettings` | — | **L2354 / L2358 / L2372** | `loadSettings()` call at L2410; known-value-else-default idiom |
| `nextWave` / `game.wave++` | L3387 / L3388 | **L3387 / L3388** | runs once at `startGame`, then per clear |
| `breakChain` | L4270 | **L4270** | choke point; call sites **L4732** (bullet), **L4788** (Hunter, `break chainScan`) |
| `scatterChain` | — | **L4281** | **ship-death path — MUST stay silent (§6)**; do not hook it |
| `FloatText` | L3189 | **L3189** | dt-aging idiom (`life -= dt`; alpha via `ctx.globalAlpha`) |
| `game` object literal | — | **L3274** | seed `caption` here |
| `startGame` | — | **L3346** | `VoiceSys.reset()` **L3383** → `nextWave()` **L3384** |
| `quitToTitle` | — | **L2130** | no `VoiceSys.reset()` today |
| `update` | — | **L4382** | pause/state early-return **L4389**; floaters aged **L4467** |
| render tail | — | world `ctx.restore()` **L5313**; `drawHUD()` (Capture-gated) **L5331**; `drawMenu()` **L5350** |
| `AudioSys` | — | `ctx` null-init **L537**; `vol.voice` **L542**; `now()` **L565** |
| `VIEW_W`/`VIEW_H` | — | **L103** (1280 × 720) |

**Lab (`voice-robot-lab.html`, 913 lines) — port source, grep-confirmed:**
- Ring chain **L372–378**, carrier `.start()` **L394**, ring reads in `applyRobot` **L419–421**.
- Base working copy `P` **L610–622**; `MALE`/`FEM` **L774–775**; `PRESETS` **L776**.
- Engine is `PORT-ME BLOCK A` **L95–603**, verbatim-shared with the game — phon composed in the lab renders
  identically in the build.

---

## Findings / decisions surfaced this session (all FLAGs — no new FORKs; the resolved forks stay resolved)

These are grep-caught issues where the spec's literal wording, taken at face value, would produce a wrong
build. Each is resolved as a best-guess with the reasoning inline; none reopens a resolved fork.

- **FLAG-A — Lab presets are diffs, not full objects (P1, load-bearing).** The `PRESETS` entries are
  `Object.assign({}, MALE|FEM, {…})` **overrides on the lab's base `P`** (L610). They do **not** restate
  `pitchRange, finalFall, srcType, richness, breath, bwScale, fricGain, burstGain`. A naive paste of a
  preset's `set` block yields a `VOICE_STYLES` entry missing those fields → `buildUtterance` reads
  `undefined` → NaN pitch / broken synth. **Each style must be expanded to a full `VOICE_PARAMS`-shaped
  object = base-`P` unstated fields + preset overrides, with `robot.ring`→top-level `ring` and
  `robot.flange`/`robot.crush` dropped.** The base-`P` unstated values to carry into every style:
  `pitchRange 4, finalFall 5, srcType "pulse", richness 0.85, breath 0.12, bwScale 1.0, fricGain 1.0,
  burstGain 1.0`. This is a mechanical port, not a re-tune. P1's headless test asserts every style has every
  field and every style yields a finite `buildUtterance().dur`.

- **FLAG-B — §8's `captions` "else `false`" is a wording trap (P3).** §8 says accept `captions` "only if
  boolean (else `false`)". Taken literally as a shipTurnScale-style else-snap, an **absent** `captions` key
  (every pre-CS011 save) would snap to `false` → captions OFF for existing players, silently breaking the
  **resolved** default-ON fork. Resolve with the **musicTrack conditional-overwrite idiom**:
  `if (typeof data.captions === "boolean") settings.captions = data.captions;` — absent **or** corrupt
  leaves the object-literal init `true`. This is the correct reading of "known-value-else-default" (default
  = init = `true`) and preserves default-ON. Not reopening the fork; fixing wording that contradicts it.

- **FLAG-C — Caption must be state-gated, not just pause-gated (P2, correctness).** Caption aging lives in
  `update()`'s playing body (past the `game.state !== "playing" || game.paused` early-return at L4389), so
  on **game-over** `game.caption.life` **freezes** — it never ages down. A `!game.paused`-only draw guard
  would therefore stick a frozen caption on the game-over screen forever. Guard the draw on
  `game.state === "playing" && !game.paused && game.caption.life > 0`.

- **FLAG-D — `game.caption` init ordering (P2).** `sayLevel(1)` fires inside `nextWave()` (L3384), called
  from `startGame` immediately after `VoiceSys.reset()` (L3383). `sayLevel`→`_emit`→`showCaption` writes
  `game.caption`, so `game.caption` must be initialized **before** L3383. Set it in `startGame` above the
  `VoiceSys.reset(); nextWave();` pair **and** seed it in the base `game` literal (L3274) so it is never
  `undefined`.

- **FLAG-E — `scatterChain` stays silent (P5).** Hook `chain_broken` **only** inside `breakChain(i)`
  (L4270), never `scatterChain()` (L4281). Ship-death already has its own spectacle/audio, and the existing
  L4636 comment documents that `scatterChain` deliberately reaches no voice site.

- **FLAG-F — `drawSound` footer offset must track panel growth (P3).** The help line draws at a **fixed**
  `y + 490` from panel top. Growing the panel `510 → 602` (+92px, two rows) without moving the footer
  leaves it floating mid-panel; bump it to `y + 582`. Look-call — tune by eye — but don't leave it at 490.

- **FLAG-G — Capture-gate on captions is a look-call (P2).** Placing `drawCaption()` **inside** `drawHUD()`
  makes the `H` capture key hide captions too; placing it as a **sibling** call (recommended) keeps captions
  visible in HUD-hidden capture mode — appropriate for an accessibility mirror. Recommend sibling; flag for
  Paul.

- **FLAG-H — `♀` glyph in labels is a look-call (P3).** `VOICE_STYLE_LABELS` use `♀`; `drawText` renders
  monospace, where `♀` may fall back. The existing `◄`/`►` chevrons already render fine, so likely OK —
  but if it boxes, swap to a `" F"` suffix. Value-column width is already a look-call per §3.

- **FLAG-I — Digit fallback needs `"zero"` (P0/P4).** §5's ≥100 digit fallback maps each digit char through
  number words, but `"zero"` (digit `"0"`, e.g. Level 100 → "one zero zero") is **not** among the 27 words
  §5 enumerates. Add `"zero"` to the lab dictionary + `NUM_PHON` in P0. ≥100 is rare but reachable
  (`maxWave` is unbounded), so the fallback must not drop a digit.

**Model policy (per Paul's guidance + spec §13):** Opus 4.8 for the two load-bearing refactors (P1 style
system + ring, P2 `_emit` split + caption path); Sonnet 5 for the mechanical/data phases (P0 lab,
P3 UI+persistence, P4 level, P5 chain_broken). Avoid `opusplan`/`ultracode` (surgical single-file workflow).

**How to apply these in Claude Code (they are session settings, not mid-prompt):** each phase is its own
session, so set the model *before* pasting the prompt — `/model opus` for P1/P2, `/model sonnet` for
P0/P3/P4/P5. **Effort needs no separate command:** every model here defaults to `high`, so `/model <alias>`
already puts you at the phase's target. The active level shows next to the spinner ("with high effort") —
if it ever reads otherwise, `/effort high` corrects it (or `/effort xhigh` to push the hardest sub-problem).
**The only per-turn lever is the `ultrathink` keyword**, a literal word in the message — it is already baked
into the P1 and P2 prompt blocks below, so pasting them as-is triggers it. (`think`/`think hard` are *not*
keywords — they're ignored as plain text; `ultrathink` is the one that works.)

---

## Phase order & dependency graph

```
P0 (lab dictionary + phon)  ──gates──►  P4, P5      [tools/ only; no build change]
P1 (style system + ring + settings defaults)  ──►  P2 ──► P3 ──► P4 ──► P5
                                                    └────────────► P4, P5 (need _emit/sayLevel)
```
- **P1 is the base**: `let VOICE_PARAMS`, `VOICE_STYLES`, `setStyle`/`voiceEnabled`, ring stage, and the two
  `settings` **defaults** (`voiceStyle:"comms"`, `captions:true`) so every later phase has them.
- **P2** depends on P1 (`voiceEnabled()`, live `VOICE_PARAMS`, `settings.captions`).
- **P3** depends on P1 (values/labels, `setStyle`) — adds UI rows + persistence.
- **P4, P5** depend on P1+P2 (`_emit`/`say`/`sayLevel`) and on **P0** (their phon). Independent of P3 and of
  each other; P0 must ship (be committed) first so their ports are verbatim.

Each phase is one Claude Code session and one commit, individually shippable (coherent intermediate states:
`voiceStyle` stays `"comms"` and `captions` stays `true` until P3 wires persistence).

---

## Phase 0 — Lab dictionary + new phon composition (gates P4 & P5)

**Goal:** extend `tools/voice-robot-lab.html`'s hand dictionary with every word CS011 needs, compose/verify
ARPAbet by ear in the lab, and emit paste-ready `NUM_PHON` / `LEVEL_PHON` maps and the five `chain_broken`
`{text,phon}` pairs. **No change to `asteroids-deluxe.html`.** This is the standing "design instruments
first / lab-gates-the-build" step; nothing in P4/P5 ports until Paul has auditioned these in the lab.

**Words to add** (compose in the lab's freeform/g2p box, verify by ear):
- `"level"` → `LEVEL_PHON` (spec seed: `L EH1 V AH L`).
- Number words 1–99: ones `one two three four five six seven eight nine`; teens
  `ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen`; tens
  `twenty thirty forty fifty sixty seventy eighty ninety`. **Plus `zero`** (FLAG-I, for the ≥100 digit
  fallback). → `NUM_PHON` (word → ARPAbet string).
- `chain_broken` sentence words not yet in the dictionary: `junk, scrap, lost, trash, loose, goes` (and any
  others in the five lines below that the lab dictionary lacks).

**Verbatim `chain_broken` text (do not editorialize Dan):**
```
Junk is gone!
Lost my scrap!
Trash is loose!
There goes the garbage!
There goes my junk!
```

**Paste-ready Claude Code prompt:**
```
Work ONLY in tools/voice-robot-lab.html. Do not touch asteroids-deluxe.html.

Grep the lab for its hand dictionary (the g2p WORDS map) and the freeform phon box. Add these words with
composed ARPAbet phon, matching the lab's existing entry format and stress-digit convention:
  - "level"
  - "zero","one","two","three","four","five","six","seven","eight","nine"
  - "ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen"
  - "twenty","thirty","forty","fifty","sixty","seventy","eighty","ninety"
  - any words in these five sentences the dictionary still lacks (junk, scrap, lost, trash, loose, goes):
      "Junk is gone!" / "Lost my scrap!" / "Trash is loose!" / "There goes the garbage!" / "There goes my junk!"

Then emit three paste-ready blocks in a comment at the top of the lab (for me to audition, then port later):
  1. LEVEL_PHON = "<phon for 'level'>";
  2. NUM_PHON = { one:"…", two:"…", …, ninety:"…", zero:"…" };   // word -> ARPAbet
  3. VOICE_LINES.chain_broken = [ {text:"Junk is gone!", phon:"…"}, … five entries … ];

Sanity-check every composed phon string by running it through the lab's parsePhonTokens: it must produce
ZERO unknown-token errors (every symbol is in the PH table). Do NOT invent phonemes outside PH.
Do not commit — I audition each line by ear in the lab before anything ports.
```

**Session setup:** `/model sonnet` (Sonnet 5; effort defaults to `high`). Mechanical dictionary work; the lab's g2p seeds it, Paul verifies by ear. No `ultrathink` in the prompt (not needed).

**Test expectations (lab-side, no headless harness):** every new phon parses through the lab's
`parsePhonTokens` with **zero** `errs`; playing each in the lab is intelligible (Paul's ear is the gate).

**Doc note:** none yet (nothing shipped). P4/P5 record the port. Add a one-line `STATUS.md` "Next up" marker
that the lab phon is composed and awaiting audition.

**Commit message (Paul, after audition — lab-only):**
`CS011 P0: voice-robot-lab — number words + "level" + chain_broken dictionary + phon`

---

## Phase 1 — Style system: `VOICE_STYLES` + active-style refactor + ring stage (base phase)

**Goal:** turn the single `const VOICE_PARAMS` into a `let`-bound active style resolved from a
`VOICE_STYLES` table; add `setStyle`/`voiceEnabled`; add the ring-modulator stage to `VoiceSys`; seed the
two `settings` defaults. No UI, no persistence, no captions yet — but the default resolves to `comms`, so
Dan audibly changes character (the retired declarative default is gone).

**Exact work:**
1. **`VOICE_STYLES` table** above `VoiceSys` (near L1432). Six entries keyed by id
   (`comms, comms_f, flat, flat_f, vintage, vintage_f`), each a **full** `VOICE_PARAMS`-shaped object **plus**
   a top-level `ring:{on,freq,mix}`. Port from `voice-robot-lab.html` PRESETS, **expanded per FLAG-A**
   (base-`P` unstated fields + preset overrides; `robot.ring`→`ring`; drop flange/crush). Source presets:
   Comms robot (announcer)/♀, Flat monotone/♀, Vintage computer (DECtalk)/♀. Female = male + raised
   `basePitch` + `f1Scale 1.14, f2Scale 1.18, f3Scale 1.16`. `ring`: Comms `{on:true,freq:55,mix:0.25}`,
   Flat/Vintage `{on:false}`. `radio.on`: Comms & Flat `true`, Vintage `false` — per the lab presets.
2. **`const VOICE_PARAMS` → `let VOICE_PARAMS`** (L1432), initialized to `VOICE_STYLES.comms` (the new
   default). Keep it a **live binding** that `_render`/`applyRadio`/`applyRing`/`buildUtterance` read each call.
3. **`VOICE_STYLE_VALUES = ["off","comms","comms_f","flat","flat_f","vintage","vintage_f"]`** (Off first; used
   by P3 picker + loadSettings). Labels are P3 (UI-only).
4. **Ring nodes in `ensure()`** (L1566), ported from lab L372–378: declare
   `ringCarrier, ringMult, ringWet, ringDry, ringOut` in the null-field list (L1556). Build
   `voiceBus → ringMult (0-baseline gain, carrier→ringMult.gain) → ringWet`, `voiceBus → ringDry`,
   `ringWet+ringDry → ringOut`. **Re-point the split**: the two `this.voiceBus.connect(this.dry)` /
   `this.voiceBus.connect(this.rIn)` edges become `ringOut.connect(this.dry)` / `ringOut.connect(this.rIn)`.
   The static bed keeps feeding `rIn` (downstream of ring — correct). `ringCarrier.start()` once in `ensure()`
   (static-bed precedent). Call `applyRing()` in `ensure()` alongside `applyRadio()`.
5. **`applyRing()`** (guarded like `applyRadio`: `if (!AudioSys.ctx || !this.ringOut) return;`): reads
   `VOICE_PARAMS.ring` → `ringCarrier.frequency.value = ring.freq; ringWet.gain.value = ring.on?ring.mix:0;
   ringDry.gain.value = ring.on?(1-ring.mix):1;`. Styles without ring pass through by construction.
6. **`setStyle(id)`**: for a real id → `VOICE_PARAMS = VOICE_STYLES[id]`, then `applyRadio(); applyRing();`
   (both self-guard if the graph isn't built). For `"off"` → **leave `VOICE_PARAMS` on the last real style**
   (do not reassign) so `buildUtterance` stays valid for caption duration; no style swap.
7. **`voiceEnabled()`** → `settings.voiceStyle !== "off"` (single source of truth; no separate flag needed —
   the "enabled flag" in §2.2 is satisfied by reading the setting).
8. **`settings` defaults** (L2099): add `voiceStyle: "comms"` and `captions: true`. (Persistence is P3; these
   just give P1/P2 valid values.)

**Untouched:** MusicSys/AudioSys buses; the `_render` scheduler body (only the `dry`/`rIn` source edges move);
`_stop`/`reset` (ring nodes are persistent chain nodes, not per-utterance).

**Paste-ready Claude Code prompt** (contains the `ultrathink` keyword — leave it in):
```
ultrathink — the two tricky parts are the ring re-point (moving the voiceBus->dry/rIn fan-out behind the new
ring stage without breaking the graph) and the diff->full-object expansion in step 1 (FLAG-A). Reason
carefully on those before editing.

Read CLAUDE.md + STATUS.md first. Single-file game, file://-runnable, surgical str_replace edits, no auto-push.

Re-grep to confirm anchors (they drift): VOICE_PARAMS (const, ~L1432), VoiceSys.ensure (~L1566, the voiceBus
-> dry / rIn fan-out and the static bed), applyRadio (~L1593), _render's `buildUtterance(phonStr, VOICE_PARAMS)`
line (~L1659), settings (~L2099). Open tools/voice-robot-lab.html for the port source: ring chain L372-378,
carrier .start() L394, applyRobot ring reads L419-421, base P L610-622, MALE/FEM L774-775, PRESETS L776.

1) Add a VOICE_STYLES table (above VoiceSys) — 6 entries: comms, comms_f, flat, flat_f, vintage, vintage_f.
   Each is a FULL VOICE_PARAMS-shaped object PLUS a top-level ring:{on,freq,mix}. PORT from the lab PRESETS
   "Comms robot (announcer)"/♀, "Flat monotone"/♀, "Vintage computer (DECtalk)"/♀. CRITICAL: the lab PRESETS
   are Object.assign diffs over the lab's base P — they DO NOT restate pitchRange, finalFall, srcType,
   richness, breath, bwScale, fricGain, burstGain. Expand each style to a full object by taking those unstated
   fields from base P (pitchRange 4, finalFall 5, srcType "pulse", richness 0.85, breath 0.12, bwScale 1.0,
   fricGain 1.0, burstGain 1.0) MERGED with the preset's explicit fields. Flatten robot.ring -> ring; DROP
   robot.flange and robot.crush (they do NOT ship). Do not re-tune any value — port verbatim.
   ring: comms/comms_f {on:true,freq:55,mix:0.25}; flat/flat_f/vintage/vintage_f {on:false}.
   radio.on: comms & flat true, vintage false (per the presets).

2) const VOICE_PARAMS -> let VOICE_PARAMS = VOICE_STYLES.comms;  (live binding, read each call)
   Add: const VOICE_STYLE_VALUES = ["off","comms","comms_f","flat","flat_f","vintage","vintage_f"];

3) Ring stage in ensure(): declare ringCarrier, ringMult, ringWet, ringDry, ringOut in VoiceSys's null-field
   list. Build (port lab L372-378): voiceBus -> ringMult (gain 0 baseline; ringCarrier sine -> ringMult.gain)
   -> ringWet; voiceBus -> ringDry; ringWet & ringDry -> ringOut. Then CHANGE the existing fan-out so
   ringOut (not voiceBus) connects to this.dry and this.rIn. Keep the static bed feeding this.rIn. Start
   ringCarrier once in ensure() (like the static bed's st.start()). Call this.applyRing() in ensure()
   alongside applyRadio().

4) applyRing() { if (!AudioSys.ctx || !this.ringOut) return; const R = VOICE_PARAMS.ring;
   this.ringCarrier.frequency.value = R.freq; this.ringWet.gain.value = R.on?R.mix:0;
   this.ringDry.gain.value = R.on?(1-R.mix):1; }

5) setStyle(id): if id is a real style -> VOICE_PARAMS = VOICE_STYLES[id]; this.applyRadio(); this.applyRing();
   if id === "off" -> DO NOT reassign VOICE_PARAMS (keep last real style so buildUtterance stays valid).
   voiceEnabled() -> return settings.voiceStyle !== "off";

6) settings (L2099): add voiceStyle:"comms", captions:true. (No save/load yet — that's a later phase.)

Deliver an updated headless smoke test (extract script, node --check, stub window/document/rAF; AudioSys.ctx
stays null so applyRadio/applyRing/setStyle's graph calls no-op). Assert:
  - Object.keys(VOICE_STYLES).length === 6; each style has EVERY VOICE_PARAMS field defined (no undefined) and
    a ring:{on,freq,mix} block.
  - for every style id: isFinite(buildUtterance("HH AH1 L OW1 .", VOICE_STYLES[id]).dur)  (catches FLAG-A).
  - VoiceSys.setStyle("flat") makes VOICE_PARAMS === VOICE_STYLES.flat; setStyle("off") leaves VOICE_PARAMS a
    valid full object (last real style); with settings.voiceStyle="off", voiceEnabled()===false.
Don't push. Give me the commit message.
```

**Session setup:** `/model opus` (Opus 4.8; effort defaults to `high` — confirm "with high effort" in the
readout). The `ultrathink` keyword is already inside the prompt block, aimed at the ring re-point and the
diff→full-object expansion.

**Test expectations:** as embedded above — 6 full styles, finite `dur` for every style (FLAG-A guard),
`setStyle` param resolution, `voiceEnabled` off-state. All headless, `ctx` null.

**Doc note:** GDD §2.8 VoiceSys "Signal path" — add the ring stage (voiceBus → ring → dry/radio split) and
note ring-only (flanger/crush stay in the lab). GDD §2.8 opening + Code-Architecture-Map VoiceSys row —
note `VOICE_PARAMS` is now the active style resolved from `VOICE_STYLES`. CLAUDE.md VoiceSys non-negotiable
(L147): port-verbatim rule now covers `VOICE_STYLES` + the ring stage; add `VOICE_STYLES`/`VOICE_STYLE_VALUES`
to the Code map. STATUS.md "Changed this session": style table + ring + active-style refactor landed;
picker/persistence/captions still pending.

**Commit message:** `CS011 P1: VoiceSys — VOICE_STYLES table, active-style refactor, ring-mod stage`

---

## Phase 2 — `say()`→`_emit()`/`_schedule()` split + caption render path

**Goal:** split resolve/gate/schedule so the caption fires whenever captions are on, **independent of voice
volume and of Off**, while audio only plays when `voiceEnabled()`. Add the screen-space bottom-center caption.

**Exact work:**
1. **`_emit(line, p)`** — the new gate+fire, containing the current `say()` machinery **plus** the moved-up
   `buildUtterance`:
   ```
   _emit(line, p):
     if (!AudioSys.ctx) return null
     this.ensure(); now = AudioSys.now()
     // gate UNCHANGED: now<busyUntil & p<=curPriority -> drop; else now<busyUntil+VOICE_COOLDOWN -> drop; higher -> fall through
     utt = buildUtterance(line.phon, VOICE_PARAMS)          // moved up from _render; PURE
     if (settings.captions) this.showCaption(line.text, utt.dur)
     if (this.voiceEnabled()) this._schedule(utt)           // audio only
     this.curPriority = p; this.busyUntil = now + 0.10 + utt.dur
     return line
   ```
2. **`say(event)`** becomes: pick a random `VOICE_LINES[event]` line → `_emit(line, VOICE_PRIORITY[event]||1)`.
   Keep the `!lines || !lines.length` guard.
3. **`_schedule(utt)`** = the current `_render` body **minus** its `buildUtterance` line (which moved to
   `_emit`). Keep `this.ensure()`, the `!AudioSys.ctx` guard, `ctx.resume()`, `this._stop()`, and the whole
   scheduler intact. It takes the already-built `utt`.
4. **`sayLevel(n)`** stub now (used by P4): `_emit({text:"Level "+n, phon: levelPhon(n)}, VOICE_PRIORITY.level)`.
   `levelPhon`/`VOICE_PRIORITY.level` don't exist until P4 — so **either** land `sayLevel` in P4 (cleaner) or
   land it here guarded. **Recommendation:** land `sayLevel` in **P4** with its phon; P2 only does the
   `_emit`/`_schedule`/caption split. (Noted so P2 doesn't reference undefined `levelPhon`.)
5. **Caption state + render:**
   - Base `game` literal (L3274): add `caption: { text:"", life:0, dur:0 }`.
   - `startGame` (L3346): re-init `game.caption = { text:"", life:0, dur:0 }` **above** the
     `VoiceSys.reset(); nextWave();` pair (FLAG-D — `nextWave` won't fire `sayLevel` until P4, but seed it now
     so the ordering is correct when P4 lands).
   - `quitToTitle` (L2130): clear `game.caption.life = 0`.
   - `showCaption(text, dur)`: `game.caption = { text, dur, life: 0.10 + dur + CAPTION_LINGER }` (overwrite —
     matches voice pre-emption/supersede).
   - Age in `update()` playing body (near the floaters age at L4467): `game.caption.life -= dt;`.
   - `drawCaption()` — screen-space, **called as a sibling in the in-play render pass** (FLAG-G), guarded
     `game.state === "playing" && !game.paused && game.caption.life > 0` (FLAG-C): 
     `alpha = life < CAPTION_FADE ? life/CAPTION_FADE : 1; ctx.globalAlpha = alpha;
     drawText(text, VIEW_W/2, VIEW_H - CAPTION_Y, CAPTION_SIZE, COLOR.text, "center"); ctx.globalAlpha = 1;`
     (FloatText globalAlpha idiom — `drawText` doesn't set alpha). Place the call after
     `if (Capture.hudVisible) drawHUD();` (L5331) and before the game-over block, so it's under nothing during
     play and simply not called when paused.
   - Constants (look-call knobs, grouped): `CAPTION_LINGER = 1.5`, `CAPTION_FADE = 0.4`, `CAPTION_Y = 64`,
     `CAPTION_SIZE = 20`.

**Untouched:** the gate arithmetic (drop/pre-empt) is identical — it now drives both caption and audio, so
captions supersede/pre-empt consistently even with audio off. `_stop`/`reset` unchanged.

**Paste-ready Claude Code prompt** (contains the `ultrathink` keyword — leave it in):
```
ultrathink — the tricky part is extracting _schedule() from _render() so the Web-Audio scheduler stays
byte-faithful and the cooldown/priority gate arithmetic is UNCHANGED (only the buildUtterance line moves out).
Reason carefully on that split before editing.

Read CLAUDE.md + STATUS.md. Single file, file://-safe, surgical edits, no auto-push. Builds on P1.

Re-grep: VoiceSys.say (~L1623) and _render (~L1653, its buildUtterance line ~L1659); game literal (~L3274);
startGame (~L3346, the VoiceSys.reset()->nextWave() pair ~L3383-3384); quitToTitle (~L2130); update()'s
floaters age (~L4467); render tail (world ctx.restore() ~L5313, `if (Capture.hudVisible) drawHUD();` ~L5331,
`if (game.paused) drawMenu();` ~L5350); drawText (~L4852, note it does NOT touch ctx.globalAlpha); VIEW_W/H (L103).

Refactor the voice channel WITHOUT changing the cooldown/priority arithmetic:
- Add _emit(line, p): guard !AudioSys.ctx -> null; ensure(); now=AudioSys.now(); run the EXACT gate currently
  in say() (busyUntil/curPriority/VOICE_COOLDOWN: equal-or-lower drops, in-cooldown drops, higher falls
  through); utt = buildUtterance(line.phon, VOICE_PARAMS); if (settings.captions) this.showCaption(line.text,
  utt.dur); if (this.voiceEnabled()) this._schedule(utt); curPriority=p; busyUntil=now+0.10+utt.dur; return line.
- say(event): keep the lines-empty guard, then line = random pick; return this._emit(line, VOICE_PRIORITY[event]||1).
- _schedule(utt): the CURRENT _render body with its `const utt = buildUtterance(...)` line REMOVED (utt is the
  arg). Keep ensure(), the !AudioSys.ctx guard, ctx.resume(), _stop(), and the entire scheduler unchanged.
  Do NOT add sayLevel yet (it needs levelPhon from the next phase).

Caption path:
- game literal: add caption:{text:"",life:0,dur:0}. startGame: set game.caption={text:"",life:0,dur:0} ABOVE
  the VoiceSys.reset()/nextWave() pair. quitToTitle: game.caption.life = 0.
- Constants (look-call knobs): CAPTION_LINGER=1.5, CAPTION_FADE=0.4, CAPTION_Y=64, CAPTION_SIZE=20.
- showCaption(text,dur): game.caption = { text, dur, life: 0.10 + dur + CAPTION_LINGER };  (overwrite)
- update() playing body: game.caption.life -= dt;  (next to the floaters .update)
- drawCaption(): if (game.state==="playing" && !game.paused && game.caption.life>0) { const a =
  game.caption.life<CAPTION_FADE ? game.caption.life/CAPTION_FADE : 1; ctx.globalAlpha=a;
  drawText(game.caption.text, VIEW_W/2, VIEW_H-CAPTION_Y, CAPTION_SIZE, COLOR.text, "center"); ctx.globalAlpha=1; }
  Call drawCaption() as a SIBLING right after `if (Capture.hudVisible) drawHUD();`, NOT inside drawHUD.

Headless test: to exercise captions without a real AudioContext, stub AudioSys.ctx = { currentTime: 0 } and
leave AudioSys.voice = null (so ensure() early-returns and no graph is built) and AudioSys.now() returns
ctx.currentTime. Then assert:
  - settings.voiceStyle="off" (voiceEnabled false), settings.captions=true: VoiceSys._emit({text:"hi",
    phon:"HH AH1 IY1 ."}, 1) sets game.caption.text==="hi" and life>0 WITH NO audio scheduled (no crash).
  - showCaption overwrites (supersede); update(1/60) decreases game.caption.life.
  - a dropped line does NOT caption: set busyUntil high + equal priority (bump ctx.currentTime), _emit returns
    null and game.caption is unchanged (mirror property).
  - node --check passes; startGame()/update(1/60) run headless (ctx back to null) with no crash.
No push. Give me the commit message.
```

**Session setup:** `/model opus` (Opus 4.8; effort defaults to `high`). The `ultrathink` keyword is already
inside the prompt block, aimed at the `_render`→`_schedule` extraction (scheduler stays byte-faithful, gate
arithmetic untouched).

**Test expectations:** as embedded — caption fires with voice Off (independence), supersede overwrite, dt
aging, dropped-line-no-caption (mirror), headless no-crash. The **audible** ring/style behavior and the
on-screen caption look are browser-verified (ctx unavailable in node — same precedent as CS010 voice audio).

**Doc note:** GDD §2.8 VoiceSys — new "Captions" bullet: `say()` split into `_emit`/`_schedule`; caption
mirrors audio exactly (only gated lines caption; supersede replaces), independent of voice volume and Off;
screen-space bottom-center, ages like `FloatText`, hidden when paused/not-playing. GDD §3.2 (rendering) — the
caption is a `drawText`/`globalAlpha` screen-space overlay, not a new fill/bar (no-fills rule intact). CLAUDE.md
VoiceSys block — note the `_emit`/`_schedule` split and caption independence. STATUS.md — captions live;
level/chain lines pending.

**Commit message:** `CS011 P2: VoiceSys — _emit/_schedule split + screen-space captions`

---

## Phase 3 — Sound / Music rows (Voice picker + Captions toggle) + additive persistence

**Goal:** expose the Voice picker (Off + 6 styles) and the independent Captions toggle in Sound / Music, and
persist both additively in the frozen `afd_settings_v1`.

**Exact work:**
1. **`SOUND_ROWS` (L2090)** → insert `"Voice"` and `"Captions"` after `"Voice Volume"`, before `"Music Track"`:
   `["SFX Volume","Music Volume","Master Volume","Voice Volume","Voice","Captions","Music Track","Back"]`.
   (Volume dispatch is by `VOL_LABELS` label lookup, not index — safe.)
2. **Labels** near `MUSIC_TRACK_LABELS` (L2109):
   `VOICE_STYLE_LABELS = { off:"Off", comms:"Comms", comms_f:"Comms ♀", flat:"Monotone", flat_f:"Monotone ♀",
   vintage:"Computer", vintage_f:"Computer ♀" }` (FLAG-H: `♀` is a look-call; width is a look-call).
3. **`menuSound(a)` (L2210)** — add two branches beside the Music-Track cycler (L2221):
   - `label === "Voice"` (left/right cycler over `VOICE_STYLE_VALUES`): cycle `settings.voiceStyle`,
     `VoiceSys.setStyle(settings.voiceStyle)`, `saveSettings()`, `AudioSys.ui(false)`.
   - `label === "Captions"` (left/right both flip): `settings.captions = !settings.captions`,
     `saveSettings()`, `AudioSys.ui(false)`.
4. **`drawSound()` (L4918)** — grow panel `menuPanel(600, 510…)` → **602**; footer `y + 490` → **y + 582**
   (FLAG-F). In the row loop, replace the single Music-Track else-branch with a label dispatch producing a
   value column (Music-Track layout + `◄►` chevrons when selected):
   `Music Track → MUSIC_TRACK_LABELS[...]`; `Voice → VOICE_STYLE_LABELS[settings.voiceStyle]`;
   `Captions → settings.captions ? "On" : "Off"`.
5. **`saveSettings()` (L2358)** — add to `data`: `voiceStyle: settings.voiceStyle, captions: settings.captions`.
6. **`loadSettings()` (L2372)** — additive, no schema bump:
   - `if (VOICE_STYLE_VALUES.includes(data.voiceStyle)) settings.voiceStyle = data.voiceStyle;` **then**
     `VoiceSys.setStyle(settings.voiceStyle);` (graph re-applied in `ensure()` at first gesture — `setStyle`'s
     chain calls self-guard at load time when `ctx` is null).
   - **`if (typeof data.captions === "boolean") settings.captions = data.captions;`** — conditional overwrite,
     so absent/corrupt leaves the init `true` (FLAG-B; **do not** else-snap to `false`).

**Optional:** set/bump `GAME_VERSION` here (last player-visible change before the data phases).

**Frozen-key discipline:** `STORAGE_KEY` unchanged; both new fields are additive keys accepted only when a
known value; corrupt/missing → default. No other store touched.

**Paste-ready Claude Code prompt:**
```
Read CLAUDE.md + STATUS.md. Single file, no auto-push, surgical edits. Builds on P1/P2.

Re-grep: SOUND_ROWS (~L2090), VOL_LABELS/VOL_CATS (~L2091-2092), MUSIC_TRACK_LABELS (~L2109), menuSound
(~L2210, Music-Track cycler branch ~L2221), drawSound (~L4918, menuPanel(600,510…), else-branch = Music
Track, footer at y+490), saveSettings (~L2358), loadSettings (~L2372). Frozen key afd_settings_v1 — additive
only, NO schema bump.

1) SOUND_ROWS: insert "Voice","Captions" after "Voice Volume", before "Music Track".
2) Add VOICE_STYLE_LABELS = { off:"Off", comms:"Comms", comms_f:"Comms ♀", flat:"Monotone", flat_f:"Monotone ♀",
   vintage:"Computer", vintage_f:"Computer ♀" }; (near MUSIC_TRACK_LABELS).
3) menuSound: in the left/right block, add:
     label==="Voice": idx=VOICE_STYLE_VALUES.indexOf(settings.voiceStyle); n=VOICE_STYLE_VALUES.length;
       settings.voiceStyle=VOICE_STYLE_VALUES[(idx+(a==="right"?1:-1)+n)%n]; VoiceSys.setStyle(settings.voiceStyle);
       saveSettings(); AudioSys.ui(false);
     label==="Captions": settings.captions=!settings.captions; saveSettings(); AudioSys.ui(false);
   (mirror the existing Music-Track cycler idiom exactly.)
4) drawSound: menuPanel height 510 -> 602; footer help text y+490 -> y+582. Replace the single Music-Track
   else-branch with a value-column dispatch (same layout + ◄► chevrons): Music Track -> MUSIC_TRACK_LABELS,
   Voice -> VOICE_STYLE_LABELS[settings.voiceStyle], Captions -> settings.captions?"On":"Off".
5) saveSettings: data.voiceStyle = settings.voiceStyle; data.captions = settings.captions;
6) loadSettings: if (VOICE_STYLE_VALUES.includes(data.voiceStyle)) settings.voiceStyle=data.voiceStyle;
   then VoiceSys.setStyle(settings.voiceStyle);
   if (typeof data.captions === "boolean") settings.captions = data.captions;   // conditional overwrite;
   absent/corrupt MUST leave the default true — do NOT else-snap to false.

Headless test (ctx null): 
  - menuSound "Voice" right/left cycles settings.voiceStyle through VOICE_STYLE_VALUES and wraps (off<->vintage_f).
  - menuSound "Captions" flips settings.captions.
  - save/load round-trip: write a data blob, loadSettings restores voiceStyle+captions.
  - unknown voiceStyle -> "comms"; data.captions omitted -> stays true; data.captions="yes" (non-bool) -> stays true.
node --check + startGame()/update(1/60) no crash. No push. Give me the commit message.
```

**Session setup:** `/model sonnet` (Sonnet 5; effort defaults to `high`). Mechanical — mirrors the Music-Track cycler and the established persistence
idiom).

**Test expectations:** as embedded — cycler wraps, toggle flips, round-trip persists, unknown `voiceStyle`
→ `comms`, non-boolean/absent `captions` → stays `true` (FLAG-B).

**Doc note:** GDD §2.16 (Options) — Sound / Music now carries a Voice picker (Off + 6 styles) and an
independent Captions toggle; both persist additively in the frozen `afd_settings_v1` (known-value-else-
default; captions default ON). CLAUDE.md frozen-keys bullet (L178) — note the two additive fields. STATUS.md —
picker + captions toggle + persistence live. If bumping version, record the new `GAME_VERSION` in STATUS.

**Commit message:** `CS011 P3: Options — Voice picker + Captions toggle, additive persistence`

---

## Phase 4 — Level announcement (natural words, digit fallback ≥100)

**Goal:** announce the level at every wave start (including Level 1), speaking natural words ("Level
twenty-three") while the caption shows the numeral ("Level 23").

**Prereq:** P0 committed — `NUM_PHON`/`LEVEL_PHON` phon auditioned in the lab.

**Exact work:**
1. **Data (ported verbatim from P0's lab output):** `LEVEL_PHON = "L EH1 V AH L"` (or the auditioned value);
   `NUM_PHON = { zero, one … nine, ten … nineteen, twenty, thirty, forty, fifty, sixty, seventy, eighty,
   ninety }` (28 entries incl. `zero`, FLAG-I). Place near `VOICE_LINES`.
2. **`numberToWords(n)`** (pure) → word tokens: `n < 20` → single ones/teens word; else tens word + (ones word
   if `n % 10`).
3. **`levelPhon(n)`** (pure): if `n <= 99` →
   `LEVEL_PHON + " / " + numberToWords(n).map(w => NUM_PHON[w]).join(" / ")`. If `n >= 100` → digit fallback:
   `LEVEL_PHON + " / " + String(n).split("").map(d => NUM_PHON[DIGIT_WORD[d]]).join(" / ")` where `DIGIT_WORD`
   maps `"0".."9"` → `"zero".."nine"`. (`"/"` is the engine's cosmetic word gap — number flows, no pause.)
4. **`VoiceSys.sayLevel(n)`** (deferred from P2): `_emit({ text:"Level "+n, phon: levelPhon(n) },
   VOICE_PRIORITY.level)`.
5. **`VOICE_PRIORITY.level = 2`** (L1550).
6. **Hook** `nextWave()` (L3388), right after `game.wave++`: `VoiceSys.sayLevel(game.wave);`. Since `startGame`
   → `nextWave` runs at wave 1, this announces **Level 1** too (resolved — no gate). `VoiceSys.reset()` runs
   just before (L3383), so the gate is clear and Level 1 is not swallowed.

**Paste-ready Claude Code prompt:**
```
Read CLAUDE.md + STATUS.md. Single file, no auto-push. Builds on P1/P2; ports P0's lab-audited phon VERBATIM.

Re-grep: VOICE_LINES (~L1458), VOICE_PRIORITY (~L1550), VoiceSys (~L1555, _emit from P2), nextWave (~L3387,
game.wave++ L3388). parsePhonTokens treats "/" as a cosmetic word gap.

1) Paste (verbatim from tools/voice-robot-lab.html P0 output): LEVEL_PHON (e.g. "L EH1 V AH L") and NUM_PHON
   (word->ARPAbet for zero, one..nine, ten..nineteen, twenty..ninety — 28 entries). Do not re-compose phon here.
2) numberToWords(n): n<20 -> [ones/teens word]; else [tens word] then (ones word if n%10).
3) DIGIT_WORD = {"0":"zero","1":"one",...,"9":"nine"};
   levelPhon(n): n<=99 -> LEVEL_PHON + " / " + numberToWords(n).map(w=>NUM_PHON[w]).join(" / ");
                 n>=100 -> LEVEL_PHON + " / " + String(n).split("").map(d=>NUM_PHON[DIGIT_WORD[d]]).join(" / ").
4) VoiceSys.sayLevel(n): return this._emit({ text:"Level "+n, phon: levelPhon(n) }, VOICE_PRIORITY.level);
5) VOICE_PRIORITY.level = 2.
6) nextWave(): right after game.wave++, add VoiceSys.sayLevel(game.wave);

Headless test (ctx null; the pure functions don't need it):
  - numberToWords: 1->["one"], 7->["seven"], 13->["thirteen"], 20->["twenty"], 23->["twenty","three"],
    40->["forty"], 99->["ninety","nine"].
  - levelPhon(n) for n=1,7,23,40,99,100,123: parsePhonTokens(levelPhon(n)).errs.length === 0 (every token in PH).
  - VOICE_PRIORITY.level === 2.
  - drive startGame() with a fake ctx ({currentTime:0}, AudioSys.voice=null, voiceEnabled false, captions true)
    and assert game.caption.text === "Level 1" after startGame (nextWave fired sayLevel(1)); with ctx null it
    must not crash.
node --check + headless run clean. No push. Give me the commit message.
```

**Session setup:** `/model sonnet` (Sonnet 5; effort defaults to `high`). Mechanical port + two pure helpers.

**Test expectations:** as embedded — `numberToWords` cases (incl. 23→twenty·three, 40→forty, ≥100 digit
fallback), every `levelPhon` parses with zero `errs`, priority = 2, Level 1 caption fires at `startGame`.

**Doc note:** GDD §2.8 VoiceSys — new "Level announcement" bullet: natural words 1–99 (`numberToWords` +
`NUM_PHON`/`LEVEL_PHON`), digit fallback ≥100, hooked in `nextWave()` after `game.wave++`, announces Level 1;
caption shows the numeral, audio speaks the words; `VOICE_PRIORITY.level = 2`. Update the §2.8 "Lines are
DATA" / trigger-class count to include the level sub-path. CLAUDE.md Code map — add `NUM_PHON`/`LEVEL_PHON`/
`numberToWords`/`levelPhon`/`sayLevel`. GDD-VERSION-HISTORY: fold into the CS011 entry (P5 writes it).

**Commit message:** `CS011 P4: VoiceSys — level announcements (natural words, digit fallback ≥100)`

---

## Phase 5 — `chain_broken` frustration event

**Goal:** Dan reacts when the tow chain is knocked loose — one line per triggering hit, collapsed by cooldown.

**Prereq:** P0 committed — the five `chain_broken` phon auditioned in the lab.

**Exact work:**
1. **`VOICE_LINES.chain_broken`** (L1458) = the five `{text,phon}` pairs, **verbatim** from P0's lab output
   (do not editorialize the text; do not re-compose phon):
   `"Junk is gone!" / "Lost my scrap!" / "Trash is loose!" / "There goes the garbage!" / "There goes my junk!"`.
2. **`VOICE_PRIORITY.chain_broken = 2`** (L1550).
3. **Hook** inside `breakChain(i)` (L4270) — the single choke point: `VoiceSys.say("chain_broken");`. Both
   call sites (bullet L4732, Hunter L4788) route through it; the 1.2 s cooldown + equal-priority-drop collapse
   a multi-node break into one line. **Do NOT hook `scatterChain()` (L4281)** — ship death stays silent
   (FLAG-E).

**Final priority ladder (verify after this phase):**
```
health_low                              3
health_relief, health_full,
  chain_broken, level                   2
everything else (collect_/expire_/
  dock_/cargo_full)                     1 (default)
```

**Paste-ready Claude Code prompt:**
```
Read CLAUDE.md + STATUS.md. Single file, no auto-push. Builds on P1/P2; ports P0's lab-audited phon VERBATIM.

Re-grep: VOICE_LINES (~L1458), VOICE_PRIORITY (~L1550), breakChain (~L4270) and its ONLY call sites (bullet
~L4732, Hunter ~L4788); scatterChain (~L4281) — the ship-death path, which must stay SILENT.

1) VOICE_LINES.chain_broken = the 5 {text,phon} pairs from P0's lab output, verbatim (text unchanged):
   "Junk is gone!", "Lost my scrap!", "Trash is loose!", "There goes the garbage!", "There goes my junk!".
2) VOICE_PRIORITY.chain_broken = 2.
3) In breakChain(i) add: VoiceSys.say("chain_broken");  (once, at the choke point — NOT at the call sites,
   NOT in scatterChain).

Headless test:
  - VOICE_LINES.chain_broken.length === 5; each has text + phon; every phon parses with 0 errs (all in PH).
  - VOICE_PRIORITY.chain_broken === 2.
  - Fake ctx ({currentTime:t}, AudioSys.voice=null, voiceEnabled false, captions true): calling breakChain on
    a built game.chain fires exactly one caption ("chain_broken" text set); a SECOND breakChain within
    VOICE_COOLDOWN (advance currentTime < 1.2) does NOT replace it (equal priority drops — dedup).
  - With curPriority=3 busy (simulate health_low), a chain_broken _emit drops (3 > 2).
node --check + startGame()/update(1/60) headless (ctx null) clean. No push. Give me the commit message.
```

**Session setup:** `/model sonnet` (Sonnet 5; effort defaults to `high`). Data + one hook.

**Test expectations:** as embedded — five lines, phon parses clean, priority = 2, one line per break,
cooldown dedups a multi-node break, drops under `health_low`.

**Doc note (final CS011 doc pass — do it in this phase):**
- GDD §2.8 VoiceSys — "chain_broken" trigger (single `breakChain` choke point; `scatterChain` silent;
  priority 2; cooldown collapses a multi-node break); update the trigger-class count and the priority-ladder
  paragraph to the §7 ladder above.
- GDD §2.8 opening line count — was "24 lines across 8 trigger classes"; now +5 `chain_broken` lines (29) and
  the level sub-path; reword accordingly.
- GDD §2.16 — confirm the picker/captions row description matches shipped.
- GDD Code-Architecture-Map — VoiceSys row: `VOICE_STYLES`/active-style, ring stage, `_emit`/`_schedule`,
  captions, `sayLevel`, `chain_broken`.
- **GDD §7 → `GDD-VERSION-HISTORY.md`**: prepend the **newest-first** CS011 entry (P0–P5 summary) at the top
  of the history file (§7 in the GDD just points there since the CS009 P0 split). Requires the (unattached)
  history file in the session.
- CLAUDE.md — VoiceSys non-negotiable + Code map + design-instruments section: add a
  **`tools/voice-robot-lab.html`** entry (the robot/style + dictionary instrument; verbatim port source for
  `VOICE_STYLES`, the ring stage, `NUM_PHON`/`LEVEL_PHON`, and `chain_broken`).
- STATUS.md — CS011 complete; "Changed this session" lists P0–P5.
- Set/confirm `GAME_VERSION` (if not done in P3) and its display string.

**Commit message:** `CS011 P5: VoiceSys — chain_broken frustration lines + breakChain hook; CS011 docs`

---

## Session hygiene (every CS011 phase)

- **Attach** (fresh-pulled): `asteroids-deluxe.html`, `ORBITAL-OVERHAUL-GDD.md`, `STATUS.md`, `CLAUDE.md`,
  `PLANNED-FEATURES-CS011.md`, and this file. For P4/P5 also attach the P0-updated
  `tools/voice-robot-lab.html`. For P5's doc pass also attach `GDD-VERSION-HISTORY.md`.
- **Re-grep before editing** — the anchors in §0 drift; each prompt re-confirms its symbols. Prior sessions
  found plan/code conflicts; this is non-negotiable.
- **No auto-push.** Claude Code delivers the diff + a passing headless test + the commit message; **Paul
  commits and pushes.**
- **Frozen `afd_settings_v1`** — `voiceStyle`/`captions` are additive keys, known-value-else-default, no
  schema bump. **Named invariant guards and the MusicSys/AudioSys buses are untouched.**
- **Port verbatim** — `VOICE_STYLES`, the ring stage, and all new phon come from `voice-robot-lab.html`
  unchanged; tune in the lab and re-port, never in the build.
- **A phase isn't done until its headless test passes** (extract script → `node --check` → stub
  `window`/`document`/`rAF` → drive `startGame()`/`update(1/60)` against the real code; use the fake-ctx stub
  where a caption/gate assertion needs `AudioSys.ctx` truthy with `AudioSys.voice` null).