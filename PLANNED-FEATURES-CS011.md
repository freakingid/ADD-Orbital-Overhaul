# PLANNED-FEATURES-CS011 — Player-selectable voice styles + captions

**Changeset:** CS011. **Baseline:** the **shipped** CS010 `VoiceSys` (HEAD `525c47b`,
"CS010 P9: VoiceSys — Dan speaks"). This is not paper — it extends a live speech system.
**Version:** bump `GAME_VERSION` per Paul's semver scheme (real-semver display shipped in CS010);
exact string is Paul's call.

CS011 makes Dan's voice **player-selectable** (six styles + Off), adds an **independent captions
toggle**, a **level-start announcement**, and a **chain-broken frustration** event — all synthesized,
no external files (the CS011 file-protocol contract lift is already in `CLAUDE.md` / the GDD header /
`EXTERNAL-FILES.md`; this changeset adds **no** external file, so that registry stays empty).

---

## 0. Confirmed against the live build (grep first — re-verify before editing)

Anchors as of HEAD `525c47b`; the implementing thread must re-grep, not trust these line numbers.

- **`VoiceSys`** module — L1555. Owns a small sequencer + a **radio chain only** (`voiceBus → dry →
  AudioSys.voice`, and `voiceBus → rIn → rLP → rShaper → rComp → rGain → AudioSys.voice`, plus a
  squelch-gated static bed). **No ring / flange / crush nodes exist.** `ensure()` L1567, `applyRadio()`
  L1594, `_stop()` L1608, `reset()` L1620, `say(event)` L1625, `dockDelivery(n)` L1650, `_render(phonStr)`
  L1659.
- **`VOICE_PARAMS`** — L1432. A **single** `const` param object (basePitch, pitchRange, finalFall,
  contour, rate, wobble, srcType, richness, breath, f1/f2/f3Scale, bwScale, fricGain, burstGain,
  consDur, radio{on,hp,lp,drive,static}). Read directly throughout `_render` / `applyRadio` /
  `buildUtterance`. The shipped character is declarative + radio-on.
- **`VOICE_LINES`** — L1458, keyed by event, each an **array** of `{text, phon}` alternatives. 24 lines
  across 8 trigger classes. Adding a line is a one-line data edit (house invariant).
- **`VOICE_PRIORITY`** — L1553: `{ health_low: 3, health_relief: 2, health_full: 2 }`. Absent event → 1.
- **`VOICE_COOLDOWN`** — a post-line gap; superseded lines **drop, never queue**; equal/lower priority
  drops, strictly-higher pre-empts. Cooldown/priority run off `AudioSys.now()` (ctx clock).
- **Engine** (`PH`, `WORDS`, `g2p`, `parsePhonTokens`, `buildUtterance`, `buildPitch`) is PORT-ME
  BLOCK A, shared verbatim with `tools/voice-robot-lab.html`. **`g2p` is dead code in the game** — line
  `phon` is baked; g2p lives in the lab, where a new line's phon is composed before its `{text,phon}`
  pair is pasted in.
- **Voice dictionary has no number words and no `"level"`.** Level announcements are a genuinely new
  sub-path.
- **Settings** — `settings` L2099 (`shotPowerupMode`, `magnetMode`, `musicTrack`, `shipTurnScale`).
  Persistence: `saveSettings()` / `loadSettings()` — additive fields, frozen `STORAGE_KEY`
  (`afd_settings_v1`), each accepted **only if a known value** else snapped to default. `data.vol`
  categories now derive from `AudioSys.vol`'s own keys (voice bus persists automatically).
- **Sound / Music sub-screen** — `SOUND_ROWS` L2090 = `["SFX Volume","Music Volume","Master Volume",
  "Voice Volume","Music Track","Back"]`; `menuSound(a)` L2210 (label-dispatch, cycler idiom for Music
  Track); `drawSound()` L4918 (`menuPanel(600, 510, …)`, value column mirrors `drawDifficulty`).
  `drawText(text, x, y, size, color, align)` is the text helper.
- **Hooks:** `nextWave()` L3387, `game.wave++` L3388 (runs once at `startGame`, then per clear).
  `breakChain(i)` L4270 — the **single choke point** for chain loss (both the bullet-hit path L4732 and
  the Hunter-contact path L4788 route through it, once per triggering hit).
- **`FloatText`** L3189 is world-space, rising, fading, tied to an entity — **not** a subtitle;
  captions need a new screen-space path. Existing say() sites: `collect_scoop` L3634, `collect_<type>`
  L3665, `expire_scoop` L4070, `health_low` L4421, `health_relief` L4436, `health_full` L4445,
  `cargo_full` L4546, plus `dockDelivery`.

---

## 1. Scope

1. **Voice styles** — refactor the single `VOICE_PARAMS` into a `VOICE_STYLES` table; add a
   **ring-modulator** stage to `VoiceSys`; resolve the active style from `settings.voiceStyle`.
2. **Voice picker** — one "Voice" cycler row (Off + 6 styles) in Sound / Music.
3. **Captions** — an independent On/Off toggle + a screen-space caption render path; `say()` emits the
   caption whenever captions are on, independent of voice volume or Off.
4. **Level announcement** — number-word phonemes + a digit composer + `VoiceSys.sayLevel(n)`, hooked in
   `nextWave()`.
5. **`chain_broken` event** — five verbatim frustration lines + a `breakChain` hook.
6. **Persistence** — additive `voiceStyle` + `captions` into the frozen key.

---

## 2. Voice styles (`VOICE_STYLES` + ring mod + active-style refactor)

### 2.1 The six styles (ported verbatim from `tools/voice-robot-lab.html`)
Only three lab presets ship, each in male + female form. **Of the six, only Comms uses a robot effect
(ring modulation); Flat and Vintage use none.** So the *only* new audio node CS011 adds to `VoiceSys`
is the ring modulator — flanger and bitcrush stay in the lab (FORK-CS011-effect-scope → ring-only).

`VOICE_STYLES` = a table keyed by style id, each entry a full `VOICE_PARAMS`-shaped object **plus** a
`ring: {on, freq, mix}` block. Values are ported from the lab presets; **do not re-tune here — tune in
the lab, re-port** (house rule). Female = male + raised `basePitch` + formant scale up (`f1Scale 1.14,
f2Scale 1.18, f3Scale 1.16` — the shorter-vocal-tract lever).

| id | label | source preset | ring |
|----|-------|---------------|------|
| `comms` | Comms | Comms robot (announcer) | on, 55 Hz, mix 0.25 |
| `comms_f` | Comms ♀ | Comms robot ♀ | on, 55 Hz, mix 0.25 |
| `flat` | Monotone | Flat monotone | off |
| `flat_f` | Monotone ♀ | Flat monotone ♀ | off |
| `vintage` | Computer | Vintage computer (DECtalk) | off |
| `vintage_f` | Computer ♀ | Vintage computer ♀ | off |

Every style carries a `ring` block for uniformity (Flat/Vintage: `{on:false}`). Radio: Comms +
Flat have `radio.on:true`; Vintage `radio.on:false` — per the lab presets.

### 2.2 Active-style refactor
`VOICE_PARAMS` becomes the **active** style's params:
- Change `const VOICE_PARAMS` → `let VOICE_PARAMS` (a live binding `_render`/`applyRadio`/
  `applyRing`/`buildUtterance` read each call).
- `VoiceSys.setStyle(id)`: for a real style, `VOICE_PARAMS = VOICE_STYLES[id]`, then re-apply the chain
  (`applyRadio()`, `applyRing()`, both guarded if the graph isn't built yet). For `"off"`, set an
  `enabled = false` flag and leave `VOICE_PARAMS` on the last real style (or the `comms` default) so
  `buildUtterance` stays valid for caption duration.
- `VoiceSys.voiceEnabled()` → `settings.voiceStyle !== "off"`.
- The pre-CS011 declarative character is **retired**; `"comms"` is the new default (FORK Q2).

### 2.3 Ring modulator stage (port from the lab)
In `ensure()`, insert a ring stage between `voiceBus` and the dry/radio split — exactly the lab's
structure: a continuously-running sine **carrier** driving a 0-baseline gain (`out = signal ×
carrier`), mixed wet/dry. `voiceBus → ringStage → {dry, rIn}`. Start the carrier once in `ensure()`
(like the static bed). `applyRing()` reads `VOICE_PARAMS.ring`: `ringWet = on ? mix : 0`, `ringDry =
on ? 1-mix : 1`, `carrier.frequency = freq`. Styles without ring → passthrough by construction.

---

## 3. Voice picker + captions toggle (Sound / Music)

`SOUND_ROWS` gains two rows (group with the audio controls):
```
["SFX Volume","Music Volume","Master Volume","Voice Volume","Voice","Captions","Music Track","Back"]
```
- **`Voice`** — a cycler (same idiom as Music Track), over
  `VOICE_STYLE_VALUES = ["off","comms","comms_f","flat","flat_f","vintage","vintage_f"]` with
  `VOICE_STYLE_LABELS` (short — "Off","Comms","Comms ♀","Monotone","Monotone ♀","Computer","Computer ♀";
  label text is a look-call, tune to the value column width). On change: cycle `settings.voiceStyle`,
  `VoiceSys.setStyle(settings.voiceStyle)`, `saveSettings()`. **Off** disables speech
  (FORK-CS011-voice-off-placement → Off is the 7th picker value, not a separate row).
- **`Captions`** — a two-value On/Off toggle. On change: flip `settings.captions`, `saveSettings()`.

`menuSound(a)`: add a `label === "Voice"` cycler branch and a `label === "Captions"` toggle branch,
alongside the existing volume-slider and Music-Track branches. `drawSound()`: render both as value
columns (Music-Track style); bump `menuPanel` height by two rows (~+92px). No new dispatch wiring —
both live on the existing `sound` screen.

---

## 4. Captions (independent render path)

Captions **mirror the audio exactly** (FORK-CS011-caption-mirror): only lines that actually pass the
cooldown/priority gate are captioned, and a superseding line replaces the current caption — so text and
audio never disagree. Captions are **independent of voice volume and of Off**
(FORK-CS011-caption-independence): a player can run Voice = Off, Captions = On for a text-only
experience.

### 4.1 `say()` → `_emit()` refactor
Split the resolve/gate/schedule so the caption fires whether or not audio plays:
```
_emit(line, p):
  if (!AudioSys.ctx) return null            // events fire only in-play → ctx present (see flag)
  ensure(); now = AudioSys.now()
  cooldown/priority gate (unchanged: <busyUntil & p<=cur → drop; in cooldown gap → drop; higher → pre-empt)
  utt = buildUtterance(line.phon, VOICE_PARAMS)     // PURE — for duration (and, if enabled, audio)
  if (settings.captions) showCaption(line.text, utt.dur)
  if (voiceEnabled()) _schedule(utt)                // AUDIO ONLY
  curPriority = p; busyUntil = now + 0.10 + utt.dur
  return line
say(event):  pick a random VOICE_LINES[event] line → _emit(line, VOICE_PRIORITY[event] || 1)
sayLevel(n): _emit({ text:"Level "+n, phon: levelPhon(n) }, VOICE_PRIORITY.level)
```
`_schedule(utt)` = the current `_render` body **minus** its `buildUtterance` line (which moves up to
`_emit`), keeping `_stop()` / `ctx.resume()` / the whole scheduler intact. This is a contained
refactor: the cooldown/priority machinery drives **both** caption and audio, so captions supersede and
pre-empt consistently even with audio off.

### 4.2 Render path
- `game.caption = { text:"", life:0, dur:0 }` (reset in `startGame`; cleared on `quitToTitle`).
- `showCaption(text, dur)`: `text`, `dur`, `life = 0.10 + dur + CAPTION_LINGER` (overwrites — matches
  voice pre-emption).
- Age `game.caption.life -= dt` in `update()` (the `FloatText` dt-aging idiom).
- `drawCaption()` in the **in-play HUD pass** (screen-space; not over menus, so it hides when paused):
  if `life > 0`, `drawText(text, VIEW_W/2, VIEW_H - CAPTION_Y, CAPTION_SIZE, colorWithAlpha, "center")`,
  where `alpha = life < CAPTION_FADE ? life/CAPTION_FADE : 1`. Single line, bottom-center.
- Constants: `CAPTION_LINGER` (1.5s), `CAPTION_FADE` (0.4s), `CAPTION_Y` (~64px), `CAPTION_SIZE` (~20) —
  all look-call knobs.

---

## 5. Level announcement

`nextWave()` L3388, right after `game.wave++`: `VoiceSys.sayLevel(game.wave)`.

**Natural words** (FORK-CS011-level-format, resolved): "Level twenty-three", not "two. three." The
caption shows the numeral ("Level 23"); the audio speaks the words.

- Add number-word phonemes for 1–99: nine ones (one–nine), ten teens (ten–nineteen), eight tens
  (twenty, thirty, forty, fifty, sixty, seventy, eighty, ninety) + `"level"` — 28 phon entries.
  Composed directly (g2p is dead in the game) as `LEVEL_PHON = "L EH1 V AH L"` + `NUM_PHON` (a
  word→ARPAbet map).
- `numberToWords(n)` → word tokens: `n < 20` → the ones/teens word; else the tens word + (ones word if
  `n % 10`). `levelPhon(n) = LEVEL_PHON + " / " + numberToWords(n).map(w => NUM_PHON[w]).join(" / ")`
  (`"/"` = the engine's cosmetic word gap, so "twenty three" flows as a number, no pause).
- **Bound:** natural words cover 1–99. For `n >= 100` (rare), fall back to digit-by-digit
  (`String(n).split("")…`) so it never breaks — spec that fallback explicitly.
- `VOICE_PRIORITY.level = 2` (below `health_low`, above default chatter — see §7).
- Priming: `nextWave()` runs once at `startGame`, so this also announces **Level 1** at game start.
  Resolved: announce Level 1 at game start too — no gate.

---

## 6. `chain_broken` event

Dan's frustration when the tow chain is knocked loose. Hook `VoiceSys.say("chain_broken")` inside
`breakChain(i)` (L4270) — the single choke point; the global cooldown collapses a multi-node break into
one line.

Five alternatives, **verbatim** (house rule — do not editorialize Dan's text):
```
"Junk is gone!"
"Lost my scrap!"
"Trash is loose!"
"There goes the garbage!"
"There goes my junk!"
```
Add as `VOICE_LINES.chain_broken = [ {text, phon}, … ]`. **Phon composed/verified in the lab first**
(`junk`, `scrap`, `lost`, `trash`, `loose`, `goes` aren't in the dictionary yet). `VOICE_PRIORITY
.chain_broken = 2` (below health, above dock/powerup chatter — §7).

---

## 7. Priority ladder (after CS011)

```
health_low                         3   (top — pre-empts everything)
health_relief, health_full,
  chain_broken, level              2
everything else (collect_/expire_/
  dock_/cargo_full)                1   (default)
```
Satisfies "chain_broken below health, above dock/powerup." Equal priority still drops (never queues);
strictly-higher pre-empts. A frustration or level line interrupts minor chatter (2 > 1) but yields to a
hull-critical alarm (3 > 2).

---

## 8. Persistence (additive, frozen `afd_settings_v1`)

- `settings.voiceStyle` (default `"comms"`), `settings.captions` (default `true`).  <!-- captions ON, resolved -->
- `saveSettings()`: add both to the serialized `data`.
- `loadSettings()`: accept `voiceStyle` **only if** in `VOICE_STYLE_VALUES` (else `"comms"`); accept
  `captions` **only if** boolean (else `false`) — the established known-value-else-default pattern. No
  schema bump. After resolving `voiceStyle`, call `VoiceSys.setStyle(settings.voiceStyle)` (chain
  re-applied in `ensure()` at first gesture).

---

## 9. Constants introduced / changed

`VOICE_STYLES` (table, ported), `VOICE_STYLE_VALUES`, `VOICE_STYLE_LABELS`, `LEVEL_PHON`, `NUM_PHON`, `numberToWords`,
`CAPTION_LINGER`, `CAPTION_FADE`, `CAPTION_Y`, `CAPTION_SIZE`; `VOICE_PRIORITY` += `{chain_broken:2,
level:2}`; `settings` += `{voiceStyle, captions}`; `SOUND_ROWS` += `["Voice","Captions"]`;
`VOICE_PARAMS` `const`→`let` (now the active style). Ring params live inside each `VOICE_STYLES` entry.

---

## 10. Forks (all resolved)

- **FORK-CS011-file-protocol → (a)** external files allowed, `file://`-safe subresources, non-fatal.
  *(Prior — docs already edited; no external file this changeset.)*
- **FORK-CS011-voice-options → (a)** preset-style picker. *(Prior.)*
- **FORK-CS011-voice-picker-shape → (a)** one 6-value cycler (+ Off = 7). *(This session.)*
- **FORK-CS011-effect-scope → ring-only.** Flanger/crush stay in the lab. *(This session.)*
- **FORK-CS011-caption-mirror → mirror audio** (only actually-spoken lines caption). *(This session.)*
- **FORK-CS011-caption-independence → independent** of voice volume and Off. *(This session.)*
- **Default style → `comms`** (male). *(This session.)*
- **FORK-CS011-level-format → natural words** ("Level twenty-three"). *(Resolved this session.)*
- **FORK-CS011-voice-off-placement → Off is the 7th picker value.** *(This session.)*

---

## 11. Flags for the implementing session

- **Captions default ON** (resolved this session).
- **Level 1 announced at game start** (resolved this session — announce every level, including 1; no gate).
- **Caption look** (position, size, linger, fade, label text, panel height) are look-calls — tune by eye.
- **Captions require the AudioContext** (via `_emit`'s ctx guard). Events fire only during play, after
  the start gesture, so ctx always exists; acceptable, but note it.
- **New phon must be composed in the lab first:** the 5 `chain_broken` lines + the 27 number words (1–99) +
  `"level"`. Add those words to the lab dictionary, verify by ear, port `NUM_PHON`/`LEVEL_PHON` +
  `chain_broken` phon into the build. Standing lab-gates-the-build pattern.
- **Ring carrier runs continuously** — one extra always-on oscillator, negligible; matches the static-bed
  precedent.
- **Style-change mid-utterance:** `setStyle` swaps params + re-applies the chain immediately; an
  already-scheduled utterance finishes on its old character (acceptable — you changed the setting).

---

## 12. Lab dependency (`tools/voice-robot-lab.html`)

The lab is the **verbatim porting source** for the six style param sets and the ring stage. It keeps all
its presets for auditioning; only the six ship. Before the port: add `"level"` + the 1–99 number words and the
`chain_broken` sentence words to the lab dictionary, compose/verify all new phon in the freeform box,
then paste into `VOICE_STYLES` / `VOICE_LINES.chain_broken` / `NUM_PHON` / `LEVEL_PHON`.

---

## 13. Suggested phase shape (for the implementation thread to detail)

Dependency-ordered, session-sized; the implementation thread writes the paste-ready Claude Code prompts
+ per-phase model/effort + tests + commit messages.

1. **Active-style refactor + `VOICE_STYLES` + ring stage** (Opus — the load-bearing refactor):
   `const`→`let VOICE_PARAMS`, `VOICE_STYLES` table, `setStyle`/`voiceEnabled`, ring nodes in `ensure`,
   `applyRing`, default `"comms"`. Tests: each style resolves + applies; ring passthrough when off; Off
   disables audio.
2. **`say()`→`_emit()`/`_schedule()` split + caption render** (Opus): the refactor, `game.caption`,
   `showCaption`, `drawCaption`, dt-aging. Tests: caption fires with audio off; supersede replaces;
   mirror (dropped line → no caption).
3. **Sound / Music rows + persistence** (Sonnet — mechanical): `SOUND_ROWS` += Voice/Captions,
   `menuSound`/`drawSound` branches, `save`/`loadSettings` additive keys, panel height. Tests: cycler
   wraps; toggle flips; round-trip + unknown-value fallback.
4. **Level announcement** (Sonnet): number-word phon (`NUM_PHON`/`LEVEL_PHON`), `numberToWords`, `sayLevel`,
   `nextWave` hook, priority. Tests: `numberToWords` (7→seven, 23→twenty-three, 40→forty, ≥100→fallback); hook fires once per wave.
5. **`chain_broken` event** (Sonnet): 5 verbatim lines (phon from lab), `breakChain` hook, priority.
   Tests: fires on break; cooldown dedups a multi-node break; drops under health_low.

GDD updates in place (§2.8 VoiceSys, §2.16 Options/persistence, Architecture Map, §7 newest-first entry,
version line); STATUS/CLAUDE.md per convention. No auto-push — Paul commits.