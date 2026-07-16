# IMPLEMENTATION PHASES — CS014 (Onboarding: HintSys, telegraph, reference card)

Source spec: `PLANNED-FEATURES-CS014.md` (FORKs A–D resolved 2026-07-16: hints over the real game, silent HintSys surface, pre-birth telegraph, attract mode deferred). Base build: `GAME_VERSION "1.0.0.13"` (CS013 P4).

Five phases, dependency-ordered, one per Claude Code session. Standard ritual every phase (per `CLAUDE.md`, not repeated in each prompt): read `STATUS.md` first; **re-grep every anchor before editing** (line numbers below are estimates from planning-time grep, not gospel); headless test delivered with the code; edit `STATUS.md` + GDD in place (GDD §2 gains only *shipped* behavior; history appends to `GDD-VERSION-HISTORY.md`); commit per phase on `main`, no push. Scope discipline: build only your phase — P1 must not start the card, P2 must not touch hints.

Round-wide invariants that bite here: three frozen localStorage keys (the only touch is one additive `tutSeen` field on `afd_settings_v1`); wrap-aware helpers (`shortDelta`/`dist2`) for every world-space check; no fills beyond the named exceptions (`drawText` is one — hints and card are text); modules live ALONGSIDE AudioSys/MusicSys/VoiceSys, never inside; VoiceSys is **untouched all round** (FORK-B ships silent).

---

## P0 — `tutSeen` persistence (additive, `afd_settings_v1`)

**Scope:** the persistence substrate only. No hints, no UI, no player-visible change.

**Prompt (paste-ready):**

> Implement CS014 P0 per §3 of `PLANNED-FEATURES-CS014.md`.
>
> 1. New constant `TUT_IDS = ["shield","hook","dock","clump","birth","tow","thrust","decay"]` in the constants block (comment: canonical hint id list AND the display-priority order — P1 consumes both meanings; single source of truth, never redeclared).
> 2. `settings.tutSeen`: an object built from `TUT_IDS`, all `false`, in the `settings` literal (grep `const settings = {`, ~L2270).
> 3. `saveSettings()` (~L2565): one added line in the `data` literal — `tutSeen: settings.tutSeen` (follow the CS011 P3 / CS012 P5 additive comment style).
> 4. `loadSettings()`: known-value-else-default per house idiom — accept only a plain object (not array/null); copy **only** ids present in `TUT_IDS`, coercing each to boolean; anything absent or corrupt leaves that flag `false`. A corrupt `tutSeen` must never disturb the other fields' loads.
> 5. `returnToDefaults()` does NOT touch `tutSeen` (FLAG-10a precedent — it resets bindings, not preferences/progress). Do not add any reset path this phase (that's P3's "Replay Hints").
>
> Headless test `scratchpad/test-cs014-p0.js`, driving the REAL `saveSettings`/`loadSettings`/`returnToDefaults` against the storage stub (no reimplementation; follow `test-cs010-p2.js`'s pattern): (A) `node --check`. (B) round-trip: flip three flags, save, reload into fresh settings → exactly those three true. (C) corrupt shapes — string, array, number, null, `{unknownId:true}`, `{thrust:"yes"}` — each loads to clean defaults (unknown ids dropped, non-boolean coerced) with `voiceStyle`/`autoShield`/`shipTurnScale` unharmed. (D) missing key → all false. (E) `returnToDefaults()` leaves a modified `tutSeen` intact while restoring bindings. Full regression green.
>
> Docs: GDD §2.16 (settings/persistence) gains the field; STATUS.md per ritual.

**Commit:** `CS014 P0: additive tutSeen persistence on afd_settings_v1 + headless suite`
**Model/effort:** Sonnet 5, `high`.

---

## P1 — HintSys core (the round's only real machinery)

**Scope:** the eight adaptive one-shot hints of spec §2.2 — data table, trigger/suppression engine, render surface, persisted latches. Silent (FORK-B: no VoiceSys involvement).

**Prompt (paste-ready):**

> Implement CS014 P1 per §2.2 of `PLANNED-FEATURES-CS014.md` (FORK-B resolved: dedicated silent surface). Build **HintSys** as a small module ALONGSIDE AudioSys/MusicSys/VoiceSys — never inside any of them.
>
> **Constants** (new `TUT_*` group, playtest-knob comments): `TUT_GAP = 5.0` (min sec between displays), `TUT_DUR = 4.5` (sec a hint stays up), `TUT_Y = 96` (screen-space y, top-center — deliberately the opposite end from `CAPTION_Y`'s bottom line so the two channels never collide), `TUT_SIZE = 20`.
>
> **`TUT_LINES`** — id → copy, data-only, per the spec's §2.2 table (copy is a playtest knob, FLAG-CS014-j). The `thrust`/`shield` lines render their key **live**: add a tiny `tutKey(action)` helper returning the FIRST bound keyboard key prettified — grep the Controls screen's `keyLabel` prettifier first and reuse its key-name mapping if it has one; otherwise a small local dictionary (`"arrowup"→"↑"`, `" "→"SPACE"`, `"shift"→"SHIFT"`, …). Rebind-safe by construction: never bake a key name into copy.
>
> **Runtime state:** `game.tut = { thrustT:0, shieldT:0, shieldHitArmed:false, hookArmed:false, chainPrev:0, chainPeak:0, coalescedPrev:0, active:null, showT:0, gapT:0 }`, reset in `startGame()`. Runtime-only — never persisted.
>
> **Engine — `HintSys.update(dt)`,** called from `update()`'s playing body (place near the caption-aging line, ~L4745). Rules that bind:
> - Evaluate in `TUT_IDS` order (index = priority); **one active hint max**; `TUT_GAP` between displays; a display sets `settings.tutSeen[id] = true` + `saveSettings()`.
> - **Demonstrated skill latches silently** (same `tutSeen` write, no display) — the implicit veteran skip. Both paths persist.
> - Armed triggers **re-arm frame to frame until display succeeds** — a busy moment delays a hint, never drops it (deliberate inversion of VoiceSys drop-not-queue; spec §2.2).
> - Per-hint logic: **thrust** — accumulate `thrustT` while `input.thrust()`; fire at `gameTime > 6 ∧ thrustT < 0.5`; silent-latch at `thrustT ≥ 1.5`. **shield** — accumulate `shieldT` while shield held; arm `shieldHitArmed` with a one-line flag in `damageShip`'s normal unshielded-hit branch ONLY (grep both branches — two distinct `s.invuln = HIT_STUN_DURATION` sites exist; do NOT arm in the auto-shield branch, the shield did the work there); fire at armed ∧ `energy ≥ 0.5` ∧ `shieldT < 0.5`; silent-latch at `shieldT ≥ 0.5`. **hook** — arm at the PLAYER-bullet→debris destruction call site (grep the collision pass; do NOT hook inside `destroyDebris` itself — other paths reach it); silent-latch if the chain went 0→1 before display. **dock** — fire on the `chain.length` 0→1 rising edge (`chainPrev`); silent-latch if `game.stats.delivered ≥ 1`. **tow** — fire when chain length first reaches 5 (`chainPeak`). **clump** — fire when any live garbage with `pieces ≥ 3` is inside the viewport; viewport test MUST be wrap-aware: `shortDelta(game.camera, g)`, `|dx| ≤ VIEW_W/2+40 ∧ |dy| ≤ VIEW_H/2+40` — naive subtraction breaks at the seam. **birth** — fire when `game.stats.hunterCoalesced > coalescedPrev` (then sync). **decay** — grep the v3.3 P4 single-decay field on `Garbage` first; fire when a loose single enters its `GARBAGE_FADE` blink window inside the viewport (same wrap-aware check).
>
> **Render — `drawHint()`:** a SIBLING of `drawHUD()`/`drawCaption()` in `draw()`, gated on `Capture.hudVisible ∧ game.state === "playing" ∧ !game.paused ∧ game.tut.active` — hints hide with the `H` capture toggle, unlike captions (FLAG-CS014-d, deliberate: guidance, not accessibility). `drawText` top-center at `TUT_Y`/`TUT_SIZE`, `COLOR.ach`. No new fill class. Never renders in `"dying"`.
>
> Do NOT touch VoiceSys, AudioSys, MusicSys, the chain contract, spawn tables, scoring, or achievements. No Dan lines this round.
>
> Headless test `scratchpad/test-cs014-p1.js` driving the REAL `startGame`/`update`/`damageShip`/`saveSettings` (no reimplementation; spy pattern per `test-cs010-p9.js`): (A) `node --check`. (B) thrust — 7 idle sec → hint shows, `tutSeen.thrust` persisted through the stub; a fresh run holding thrust 1.6 s → silent latch, never shows, still persisted. (C) shield — unshielded `damageShip` at energy 0.8 → shows; an auto-shield-branch hit does NOT arm. (D) hook + dock edges incl. both silent-latch paths. (E) two triggers armed at once → priority order wins, second still shows after `TUT_GAP` (re-arm proof — the delay-not-drop assertion). (F) clump viewport across the wrap seam: a piece 8 px across the seam counts, a far piece doesn't. (G) `tutSeen` writes round-trip; a seen hint never re-fires in a fresh run. (H) `drawHint` crash-free via the proxy canvas; hidden when `Capture.hudVisible` is false. Full regression green.
>
> Docs: new GDD §2.19 "Onboarding hints (CS014)" describing shipped behavior only; STATUS.md per ritual.

**Commit:** `CS014 P1: HintSys — 8 adaptive one-shot onboarding hints, data-driven, persisted latches`
**Model/effort:** Opus 4.8, `high`. If the trigger/suppression ordering fights you, `ultrathink` the `HintSys.update` evaluation loop only.

---
## P2 — In-world tells: clump pre-birth telegraph + hull-repair floater

**Scope:** the two diegetic additions of spec §2.4 + FLAG-CS014-h. Render-only telegraph; one floater. Independent of P1 (only P0 is a hard dependency for this phase's regression run).

**Prompt (paste-ready):**

> Implement CS014 P2 per §2.4 and FLAG-CS014-h of `PLANNED-FEATURES-CS014.md` (FORK-C resolved: telegraph ships, pulse-only).
>
> **Telegraph:** new constant `HUNTER_TELEGRAPH_COUNT = 9` beside `HUNTER_COALESCE_COUNT` (playtest-knob comment: pieces at which a clump starts reading as *unstable*; must stay < `HUNTER_COALESCE_COUNT` or the tell never shows). In `Garbage.draw`, when `this.pieces >= HUNTER_TELEGRAPH_COUNT`, pulse the clump's stroke alpha at `0.6 + 0.4·sin` on the shipped `HUD_PULSE_HZ` non-HP pulse convention — grep `HUD_PULSE_HZ`'s consumers first and reuse the SAME phase source they read (do not invent a second clock, and do not read `game.lowHpPhase` — that accumulator is the HP alarm's, wrong rate semantics). Alpha via `ctx.globalAlpha` set-draw-restore exactly as the hull ring does it — restore to 1 unconditionally, the corner-glow comment's leak warning applies. `glowStroke` parameters only: no color change, no fills, no shape change (a red shift would read as a new enemy class — spec look-call, revisable in playtest).
>
> **Repair floater:** in `addScore()`'s milestone-repair branch (grep `REPAIR_MILESTONE`, ~L3671), when the repair actually lands (hp < max path only — NOT the full-HP `REPAIR_FULL_BONUS` branch), push `new FloatText("HULL +" + REPAIR_AMOUNT, game.ship.x, game.ship.y - 22, COLOR.hp)`. Keep the existing `shieldPing()`. This is inside `addScore` — the scoring-routing rule is untouched, nothing new mutates score.
>
> Headless test `scratchpad/test-cs014-p2.js` driving the REAL `addScore`/`Garbage.draw` (recording-canvas pattern per `test-p5.js` §L): (A) `node --check`. (B) telegraph — draw crash-free at `pieces` 1 / 8 / 9 / 11; `globalAlpha` is exactly 1 after every draw (leak guard); a `pieces = 8` draw never modulates alpha, a `pieces = 9` draw does. (C) floater — crossing a milestone at hp < max pushes exactly one `FloatText` whose text is `"HULL +25"` (derive from `REPAIR_AMOUNT`, don't pin the literal twice); crossing at full hp pushes none and still pays `REPAIR_FULL_BONUS`. Full regression green.
>
> Docs: telegraph into GDD §2.10.1 (coalescence); floater into §2.7/§2.12; STATUS.md per ritual.

**Commit:** `CS014 P2: clump pre-birth telegraph (pulse at 9 pieces) + HULL+25 repair floater`
**Model/effort:** Sonnet 5, `high`.

---

## P3 — "HOW TO PLAY" reference card + "Replay Hints" (Options)

**Scope:** spec §2.3 + FLAG-CS014-c. One new menu screen, two new Options rows, on shipped menu idioms. Depends on P0 (Replay Hints writes `tutSeen`).

**Prompt (paste-ready):**

> Implement CS014 P3 per §2.3 and FLAG-CS014-c of `PLANNED-FEATURES-CS014.md`.
>
> **New screen `"howto"`:** wire all three shipped extension points — a `case "howto"` in `menuInput`'s dispatcher, a branch in `drawMenu()`, and a row on the Options root. Add TWO Options rows: **"How to Play"** (recommend first row — newest players reach it fastest; look-call) and **"Replay Hints"**. Grep the Options root's row array and index math first, and grep `scratchpad/` for any test pinning Options row order/count (the `test-cs010-p4` SOUND_ROWS-snapshot precedent says at least one exists) — update those snapshots deliberately, never by weakening assertions. Verify back-path indices after insertion: the CS010 FORK-4 round shipped a one-line back-path index bug from exactly this kind of row insertion.
>
> **`drawHowto()`** via `menuPanel` + `drawMenuHint` idioms, ~1000×620 first pass, four blocks per spec: (1) CONTROLS rendered LIVE from `bindings` via the Controls screen's `keyLabel`/`padLabel` helpers so rebinds always show truthfully; (2) THE SALVAGE LOOP — shoot debris → it sheds salvage; fly over salvage to hook it; park at the dock (follow the marker) to bank escalating points; cargo slows you; loose salvage fades in ~20 s; (3) THE HUNTER LOOP — neglected salvage clumps; a clump of 12 becomes a Hunter; shoot clumps apart or haul them away; shield destroys homing Hunters on contact; (4) POWERUPS — glyph legend reusing the shipped pickup-glyph draw calls (grep the glyph set the HUD/pickups share, ~L2411/L5884), one label each, plus the Scoop persistent-but-damage-loses-a-level note. Copy must never imply a tow key or a chain-release control — neither exists. Static single panel (FLAG-CS014-i); if it genuinely won't fit at 1280×720, reuse CS013 P3's clipped-scroll idiom rather than shrinking text below legibility — but try the static fit first.
>
> **"Replay Hints" action:** on confirm, set every `TUT_IDS` flag in `settings.tutSeen` to `false`, `saveSettings()`, `AudioSys.ui(true)` feedback. No confirmation dialog. `returnToDefaults()` stays untouched.
>
> Headless test `scratchpad/test-cs014-p3.js` driving the REAL `menuInput`/`openPause`/draw path (proxy canvas): (A) `node --check`. (B) navigate title → Options → How to Play → back, and pause → Options → How to Play → back; indices land where they started. (C) Replay Hints flips a pre-set `tutSeen` to all-false and persists through the stub. (D) `drawHowto` crash-free; the controls block reflects a rebound thrust key. (E) every pre-existing menu suite still green (row-order snapshots updated as needed). Full regression green.
>
> Docs: GDD §2.16 (menu tree) + §2.19 (retrievability guarantee); STATUS.md per ritual.

**Commit:** `CS014 P3: HOW TO PLAY reference card + Replay Hints row (Options)`
**Model/effort:** Sonnet 5, `high`.

---

## P4 — Title salvage tagline + version bump (round close)

**Scope:** spec §2.5 + the round's version bump. Smallest phase; hosts the bump per CS013 P4 precedent.

**Prompt (paste-ready):**

> Implement CS014 P4 per §2.5 of `PLANNED-FEATURES-CS014.md` — the round's last phase.
>
> **Title line:** insert `SHOOT DEBRIS · HOOK SALVAGE · HAUL IT TO THE DOCK` (copy knob, FLAG-CS014-g) into the title block (grep the title draw, ~L5637) between the second control line (y+62) and the Hunter warning (y+120) — ~y+91, size 18 first pass, `COLOR.dock` so it reads as the salvage system's color (look-call; fall back to `COLOR.dim` if it fights the Hunter warning's red for attention). Nudge neighboring lines only if collision forces it; keep the blinking start prompt and Options hint where they are.
>
> **Version bump:** `GAME_VERSION "1.0.0.13"` → `"1.0.0.14"`; grep `scratchpad/` for the old literal and bump every hit (CS013 P4 found them in `test-cs010-p0.js`).
>
> **Round close:** move the shipped CS014 specs out of `PLANNED-FEATURES-CS014.md` into the GDD per the doc-layer rules, archive the spent planning doc to `archive/`, append the round summary to `GDD-VERSION-HISTORY.md`, and write STATUS.md's round-complete entry (include the open playtest asks: hint copy/timing knobs `TUT_GAP`/`TUT_DUR`, `HUNTER_TELEGRAPH_COUNT` feel, card legibility, title-line color).
>
> Headless: extend or add `scratchpad/test-cs014-p4.js` — `node --check`; title draw crash-free via proxy canvas; `GAME_VERSION === "1.0.0.14"`. Full regression green.

**Commit:** `CS014 P4: title salvage tagline; GAME_VERSION 1.0.0.14 — CS014 round complete`
**Model/effort:** Sonnet 5, `high`.

---

## Round exit criteria + playtest asks (for STATUS.md at close)

Ship-gate: all five phases committed, full scratchpad regression green, `tutSeen` round-trips in a real browser (top persistence playtest item — the sandbox has no `localStorage`). Browser feel asks, first playtest: (1) do the eight hints fire at the right moments and never twice; (2) does a veteran's first run stay hint-free on behavior alone (thrust immediately, shield early, hook fast); (3) does the 9-piece pulse read as *unstable* rather than *new enemy*; (4) `TUT_GAP`/`TUT_DUR` pacing; (5) does the card fit and read at one glance; (6) title-line color call. Deferred and waiting on signals: practice wave (FORK-A benchmark: first-session quit spike at tow intro), Dan-voiced hint lines (FORK-B, voice-robot-lab session), attract-mode autopilot (FORK-D, CS015+).

*— End of IMPLEMENTATION-PHASES-CS014.md.*