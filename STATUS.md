# Orbital Overhaul — STATUS
Version: 1.0.0.38 · Changeset: CS038 · Phase: P7 (closed) · Registry: 104 · Levers: 18

## Phase ledger — CS038

- P1 — Credits screen, reachable from Options. `CREDITS_ROWS` (data table) drives the whole screen;
  `openExternal()` is the build's first `window.open` call, always with `noopener`.
- P2 — `tools/lowhp-glow-lab.html`, the low-hull glow legibility instrument for GATE A. Build untouched.
- P3 — Telemetry capture made opt-in via a new `sessionSwitch` registry-entry flag (off at every
  launch); voice repeat-suppression mechanism 1 (no-immediate-repeat line picker).
- P4 — Voice repeat-suppression mechanism 2: an entry-gate repeat window (`VOICE_REPEAT_GAP`/
  `_CRITICAL`) that drops, not parks, a too-recent repeat of the same event.
- P5 — Twelve pure-presentation debug-registry knobs retired to plain constants (registry 116 → 104).
- GATE A (closed) — full edge-vignette glow shape picked over the shipped corners; alpha range raised.
- P6 — GATE A's retune applied to `drawHUD()`'s glow block.
- GATE B (closed) — glow findable and still one alarm; repeat windows sized right; Credits links work
  from `file://`/local server/itch.io; two Credits link tuning requests.
- P7 — Closing. Applied GATE B's two Credits link changes, `GAME_VERSION` → 1.0.0.38, GDD §2 + CLAUDE.md
  updated for all five scope items, `CS039-VOICE-WORKLIST.md` written, both planning docs archived.

Full narrative for every phase and both gates: `log/CS038.md`.

## Working / verified

- Full suite: **162 files, 162 passed, 0 failed, 0 skipped, 0 timed out** on this phase's clean closing
  run; `node --check` passes on the extracted script. `test-registry.js` confirms registry **104**,
  headers **11**, `LEVERS` **18**, `POWERUP_DROP_TYPES` **5**.
- Credits screen: six link rows (Coinless Games, itch.io, GitHub, the Asteroids Deluxe Wikipedia page,
  Claude Code, MDN's Web Audio API docs), confirmed openable from `file://`, a local server, and the
  itch.io sandboxed iframe (GATE B, B6).
- Low-hull edge glow: findable in real play, still reads as one alarm with the two red HP rings, no
  regression anywhere in the retune (GATE B, B1/B2/B7).
- Voice repeat suppression: `VOICE_REPEAT_GAP`/`VOICE_REPEAT_GAP_CRITICAL` (12s/20s) confirmed under a
  beating with repeated tow refills — no stacking, no needed line ever eaten; `health_low`/
  `chain_broken`/`chain_guard` now read as varied (GATE B, B3–B5).

## Known issues

- **CLAUDE.md documentation debt, two items, neither behavioural:** `afd_telemetry_v1` missing from the
  Save data key list (flagged CS037 P4); `Achievements.save()` no longer `afd_achievements_v2`'s only
  writer, `mergeUnlock()` unnoted (flagged CS037 P6). Not this changeset's named scope — deferred again.
- **The late-wave frame hiccup's cause remains unmeasured** (CS037 Gate A null result — every entity
  population cleared the benchmark's ceiling by >12×, so the actual cause is still open; a future
  investigation should start with the fixed per-frame overhead the benchmark deliberately excludes).
- **Two unseeded-test flakes stand:** `test-cs035-p3` §F (~5%), `test-f6` §F (~1.7%). A rerun is the
  standing way to tell either from a real regression.
- **⛔ FLAG-CS036-a stands.** `saveSettings()` writes a full snapshot of every debug knob, and
  `loadSettings()` re-applies it over the registry defaults with `debugOverride` defaulting ON — any
  installation that has ever saved settings is not running shipped defaults. Clear "Overrides Applied"
  (or reset all debug knobs) before any future gate's numeric questions.
- **Four moving-`HEAD` test pins survive, passing vacuously on a clean tree:** `test-cs023-p3.js` (the
  `debrisBounce` line count and the byte-strict `shieldDeflect`/`shieldBounce` compare),
  `test-cs024-p6.js` §H TRAP 2, and `test-cs025-p4.js` TRAP 3. Each needs a fixed SHA chosen and the
  intervening diffs named.
- **`navigator.clipboard` is unavailable on `file://` in several browsers.** The benchmark's and
  telemetry's copy rows both fall back to a CSV Blob download and say which happened. Untested in a
  real browser.
- **CS035 — parking at the Recycle dock no longer cleans up, and that is a real behaviour change.** A
  parked ship cannot mop up loose Debris around it; coalescence keeps running on the accumulating cloud.
- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame** (a `getItem` +
  `JSON.parse` per title-screen frame at 60 fps). Deliberate (CS032 §4.3).
- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`**, not on `"Load
  Saved Game"`. Design question, not a bug — see `log/CS032.md`.
- **`test-registry.js`'s FLAG-CS027-d** — twelve suite files grep a comment-stripped copy of the source
  missing the same 80 lines `execSource()` fixed. Latent, not live. **FLAG-CS027-c** — 8 test files
  hardcode world dimensions instead of reading `worldDims(X)` from `_harness.js`.
- **Piece-distinctness concern, deliberately unresolved (CS028).** Paul's gate call: leave as is.
- **Thirteen suite files hard-fail, not skip, on a shallow clone** (measured CS034 P9).
- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (CS023).**
- **`blankLegacyStores()` calls `Achievements.save()` unguarded (CS034 P6)** — harmless today, only
  reachable from profile delete (title-only).

## Open questions (blocking)

None.

## Next up

- **CS039 P1–P3 and GATE T are in the tree; P4 (closing) is next.** GATE T's recorded answers and the
  defect it caught are written up in `IMPLEMENTATION-PHASES-CS039.md` under "GATE T — CLOSED" — P4
  folds them into the new ledger and `log/CS039.md`. ⚠ **GATE T made a build change**, which its own
  prompt did not anticipate (see below), so P4 should not assume P1–P3 are the whole of CS039's code.
- **⛔ GATE T, hazard the prompt didn't name: `cargoDamageEvents` was never a cumulative counter** —
  it is the guard-drop pity counter and it decreases (7 times in 53 rows, last row 0). It had been
  documented as cumulative in the P2 spec, the build comment, `test-cs039-p2.js` §F and
  `TELEMETRY-ANALYSIS-GUIDE.md` §3 simultaneously. Fixed at the gate: new `game.stats.cargoSevers`
  (44th telemetry column), envelope **v:2 → v:3** overriding a P2 ⛔, new §H test, all four
  descriptions corrected. **P4 must retire `DECISIONS.md`'s CS039 entry into `log/CS039.md`** per
  that file's own rule.
- **GATE T's log is waves 1–5, not the wave 10+ the gate asked for**, and it is a v2 capture (no
  `cargoSevers`). A second, deeper log on the v3 build would turn T4's n=1 finding into something
  actionable.
- `CS039-VOICE-WORKLIST.md` (CS038 P7) records which voice events most need line alternatives and
  why, in priority order, for Paul's next `tools/voice-robot-lab.html` session — no `phon` is
  composed there, per the standing rule.
- **The first thing any future gate should do is clear the debug overrides** (FLAG-CS036-a).
- **Delivery-ticker ship-anchor (deferred) — wants its own gate/playtest**, not a closing-phase guess.
  Declined four times now; see `log/CS029.md`/`log/CS026.md`.
- **Deferred to `coinless-kit`, not this repo** — `game_version` in the board SELECT, a per-player
  query, and client-module support for both. Shape recorded in `log/CS034.md`.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade`/`levelEndGracePulseEnd` for the ship pulse, and
  `hunterPulseMin`/`Max`/`Grow`/`Shrink` (now plain constants as of CS038 P5, still askable) for the
  heartbeat.
- **Does the caption expiring mid-freeze read right?** With captions on, Dan's "Level N" caption ages
  during the frozen tail instead of holding, so it can vanish while the field is still stopped. Never
  asked at a gate.
- **Does the dock apron read as pressure or as litter?** CS035 P2's lockout means a parked ship no
  longer cleans up around itself. Nobody has played a long session against that yet.

## Balance notes

- **`COMBO n/N`'s denominator is still unrepresented (from CS026)** since the HUD row was dropped
  (accepted risk).
- **The UFO difficulty chain goes fully flat past level 65 (CS024/CS025)** — junk saturates at L41,
  hunters at L33. Fix if wanted is a step-count increase, no mechanism change.
- **`DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are both first-pass and browser-unverified (CS023).**
- **Hunter Debris supply halved (CS034 P3), confirmed right-sized at a wave-12 playtest.** Not
  verified past wave 12.
- **G20 says the game is no longer too easy**, and CS036's H1 says the level end now reads as a
  deliberate beat. Hunter volatility remains the answer to the former.
- **CS037 (C+F together) rated 5/10** — balanced, does not push late-wave play toward small hauls.
