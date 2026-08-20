# Orbital Overhaul — STATUS
Version: 1.0.0.37 · Changeset: CS038 · Phase: P6 · Registry: 115 · Levers: 18

## Phase ledger — CS038

- P1 — Credits screen, reachable from Options. `CREDITS_ROWS` (32 rows; four kinds — `head` / `text` /
  `link` / `gap`) drives the whole screen, so a later credit is one table edit; `menuCredits` /
  `drawCredits` follow the `menuHighScores` / `drawHighScores` template. `MENU_OPTIONS` 4 rows → 5
  ("Credits" before "Back") — the 5th row's baseline lands y+286, 114 px clear of the y+400 footer, so
  the 600×420 panel is unresized. `openExternal()` is the build's first and only `window.open`, always
  `(url, "_blank", "noopener")`. Up/down move the CURSOR between the five `link` rows only
  (`debugStep`'s walk); the scroll is DERIVED from the cursor every nav press and every draw
  (`debugScrollTop`'s recompute rule), with the first link pinned to 0 and the last to
  `creditsMaxScroll()` — those two pins are the only thing that makes the header block and the
  SATELLITE SILHOUETTES + LICENSE tail reachable, since neither carries a cursor. Every URL is drawn
  in full under its label whether or not the row is selected (FORK-CS038-B → c). New
  `game.menu.linkMsg`, in BOTH literals. No registry rows, no gameplay change, `GAME_VERSION`
  unmoved. **C4 checked against the running build: `DEBUG_ENTRIES.length` is 115, so `STATUS.md`'s
  header was already right and the spec's static 114 is the wrong count** (61 literal rows, not 60,
  + 18 levers × 3). Four older suite files repointed, none narrowed.

- P2 — `tools/lowhp-glow-lab.html`, the low-hull glow instrument for GATE A. **`orbital-overhaul.html`
  is unmodified** (verified against `git status`). The glow is a **PORT-ME BLOCK** copied
  byte-for-byte out of `drawHUD()` — three substitutions only (`game.ship.hp`→`hp`,
  `game.lowHpPhase`→`phase`, the four `LOWHP_GLOW_*` constants destructured off a parameter set) and
  the test compares it against the build's own bytes. Backdrop is a seeded busy frame with the
  HULL/CARGO rings and powerup rows at their real coordinates, and it paints `#000208` itself,
  because the build clears to TRANSPARENT and takes its ground from CSS — a `getImageData` sample of
  the real canvas would read (0,0,0,0). Four shapes (corners / edge vignette / edge bars / corners
  with the two occupied ones attenuated), all fills, none touching `shadowBlur` or `globalAlpha`.
  Measurement: WCAG relative luminance off a composited offscreen render at the two exact pulse
  poses, 8 edge probes + a centre control, headlined by **worst-probe glow:bg**. The
  `0.6 + 0.4·sin` pulse split is deliberately NOT a slider (it is a literal inside the ported block;
  moving it would be a draw-block edit, not a constants retune). Paste-ready dump answers A1–A5.

- P6 — **GATE A cleared** (Paul, in-browser). Answers: **A1** shape = full edge vignette (not the
  shipped four corners — the lab's own hypothesis (b), that the middle of every edge was dark
  regardless of alpha, won). **A2** `LOWHP_GLOW_ALPHA_MIN`/`_MAX` 0.10/0.26 → **0.20/0.40**;
  worst-probe glow:bg **1.188** vs shipped **1.000** (×1.19, worst at "edge top"). **A3** depth/radius
  unchanged at **280**. **A4** peak:trough 1.163 at edge top / 1.469 at corner TL (shipped 1.000 at
  every edge probe, since the shipped shape painted nothing there) — the pulse still reads. **A5**
  `LOWHP_GLOW_RGB` unchanged, mirror intact. Applied to `drawHUD()`'s glow block per the lab's
  `glowVignette()` reference (four `createLinearGradient` bands, one inward from each edge,
  overlapping at the corners under source-over) — ported, not retyped; `LOWHP_GLOW_RADIUS` keeps its
  name across the shape change (now read as vignette depth), per the lab's own dump convention. Every
  P6 invariant held: still a fill, no `shadowBlur`, `globalAlpha` never touched, still gated on
  `game.lowHpSiren`, still driven by the shared `game.lowHpPhase`. `test-cs038-p2.js` §B/§C repointed
  (a lab's frozen "shipped" baseline does not re-track the build after the build's own retune ships;
  full reasoning inline in the test) — a repoint, not a narrowing.
  **Flag carried to GATE B B1: the chosen worst-probe ratio (1.19×) is barely above 1.000 (no
  contrast at all) — a small edge-legibility win, not a strong one. Worth confirming it actually
  reads as findable in real play before treating GATE A as closed on brightness, not just shape.**

## Working / verified

- Full suite: **159 files, 159 passed, 0 failed, 0 skipped, 0 timed out**; `node --check` passes on
  the extracted script. `test-registry.js` confirms registry **115**, headers **11**, `LEVERS` **18**,
  `POWERUP_DROP_TYPES` **5**. Neither standing unseeded flake fired on the P6 run.
- `test-cs038-p6.js` (45 assertions) — drives the real `drawHUD()`/`startGame()` against a recording
  ctx (test-cs009-hud.js's bespoke pattern, since `_harness.js`'s stub swallows gradient stops):
  constants equal GATE A's dump; the block is unreachable when `lowHpSiren` is false; the shape is
  4 linear (not radial) gradients with band geometry matching the vignette contract exactly; alpha
  brackets `ALPHA_MIN`↔`ALPHA_MAX` at t=0/t=1 at both the pulse peak and trough; alpha rises
  monotonically as HP falls; `globalAlpha`/`shadowBlur` are never touched **inside the glow block
  specifically** (isolated from the HULL ring's own legitimate `globalAlpha` use immediately after
  it); still reads the shared `game.lowHpPhase`; `Capture.hudVisible` still gates the whole thing.
  Hand-mutation-checked against four regressions (peak alpha stops tracking t, a `globalAlpha` leak,
  band-depth drift, and the siren gate loosening) — all four caught.
- `test-cs038-p2.js` (243 assertions, repointed for P6 — see §B/§C's own comments) — the lab's frozen
  pre-retune baseline pinned as a historical snapshot (no longer re-read from the live build for the
  four constants GATE A can move), the RGB-mirror check (unaffected by the retune, still checked
  live), the byte-strict port-verbatim compare against a frozen copy of the pre-P6 block, WCAG
  luminance + contrast against known inputs, probe geometry, per-shape coverage evaluated
  analytically at each probe, and the dump round-tripping every slider.
- `test-cs038-p1.js` (341 assertions) — the credits table's shape, the twelve SAT_ART names read out
  of `SAT_ART`'s own header comments, the label-resolved `MENU_OPTIONS` consumers, nav + derived
  scroll, `openExternal`'s three outcomes, and `drawCredits` at every selection state and both scroll
  extremes.
- Eight new test files this changeset — `test-cs037-p1/p2/p2-1/p4/p5/p6/p7/p7-1.js` — each
  hand-mutation-checked against multiple regressions (P5 and P6 the deepest, 14 and 15 respectively)
  before landing; every one of the ~25 older suite files P1–P7.1 touched was a repoint, never a scope
  change to what that file protects (full accounting in `log/CS037.md`).

## Known issues

- **⛔ CS038 P1: `window.open(url, "_blank", "noopener")` RETURNS `null` ON SUCCESS** — the HTML spec's
  own rule, not a browser quirk — so the build genuinely cannot tell a blocked popup from a working
  one. `CREDITS_LINK_MSG` is therefore worded conditionally ("If nothing opened, your browser blocked
  it — the address is on screen above.") and is set on every actuation rather than only on a detected
  failure; a flat "the popup was blocked" would be a lie after every working click. The spec (§1.2 and
  the P1 prompt) assumed null meant blocked. Dropping `noopener` to recover a truthful return value
  would hand the opened page a live `window.opener` handle back into the game and is refused. **GATE B
  B6 should confirm the links actually open from `file://`, a local server and the itch.io build** —
  headless, only the absent/blocked branch has been exercised.

- **CS038 GATE A closed (Paul, in-browser) — resolved, see P6's ledger entry above** for the answers
  and the retune applied from them.

- **CS038 P1: the spec's C4 registry count (114) is wrong; the live build reports 115** and
  `STATUS.md`'s header already said so. 61 literal `{ id: … }` rows + 18 levers × 3, not 60 — CS037
  P7.1's two SHIP knobs took it 113 → 115. `test-registry.js` has pinned 115 since that phase. No
  registry content was touched.

- **The late-wave frame hiccup's cause remains unmeasured (Gate A null result).** Entity accumulation
  is ruled out — every population cleared the benchmark's ceiling by >12× against real-play peaks
  (particles: 166 real peak vs. 2000 costing 1.0 ms) — so the actual cause is open. The benchmark
  deliberately excludes fixed per-frame overhead (starfield, ship, HUD, chrome); a future
  investigation should start there.

- **CLAUDE.md documentation debt, three items, none behavioural — deliberately not closed this
  phase** (this session's closing scope named exactly one `⛔ INVARIANT` change and three GDD items;
  these three are separate enumeration staleness, not invariant changes): `afd_telemetry_v1` missing
  from the Save data key list (flagged P4); `Achievements.save()` no longer `afd_achievements_v2`'s
  only writer, `mergeUnlock()` unnoted (flagged P6); the Audio section's `VOICE_CRITICAL` enumeration
  still names four events, not five — missing `chain_lost` (flagged P5).

- **A resume can still fanfare `master_field`/`no_powerups` tiers, OUTSIDE the P6 baseline by
  design.** `nextWave()` credits `lifetime.maxWave`/`maxWaveNoPowerup` at its own step 5, after the
  baseline's step 3, so a store that never recorded the slot's wave (fresh install, a lifetime reset)
  can still cross those two MAX ladders on the resume frame. Pre-existing, unreachable for a player
  whose own store already recorded the wave they saved on.

- **Two unseeded-test flakes stand:** `test-cs035-p3` §F (~5%), `test-f6` §F (~1.7%). A rerun is the
  standing way to tell either from a real regression — at 5% per run, roughly one full-suite run in
  twenty goes red for `test-cs035-p3` §F alone.

- **⛔ FLAG-CS036-a stands.** `saveSettings()` writes a full snapshot of every debug knob, and
  `loadSettings()` re-applies it over the registry defaults with `debugOverride` defaulting ON — any
  installation that has ever saved settings is not running shipped defaults. Clear "Overrides
  Applied" (or reset all debug knobs) before any future gate's numeric questions.

- **Four moving-`HEAD` test pins survive, passing vacuously on a clean tree:** `test-cs023-p3.js`
  (the `debrisBounce` line count and the byte-strict `shieldDeflect`/`shieldBounce` compare),
  `test-cs024-p6.js` §H TRAP 2, and `test-cs025-p4.js` TRAP 3 (the `VOICE_QUEUE_MAX`/critical-set
  relationship pin). Each needs a fixed SHA chosen and the intervening diffs named — the cure is
  written in `test-cs023-p3.js` itself.

- **`navigator.clipboard` is unavailable on `file://` in several browsers.** The benchmark's and
  telemetry's copy rows both fall back to a CSV Blob download and say which happened. Untested in a
  real browser — this session is headless, so only the absent-API branch has been exercised.

- **CS035 — parking at the Recycle dock no longer cleans up, and that is a real behaviour change.**
  A parked ship cannot mop up loose Debris around it; coalescence keeps running on the cloud that
  accumulates, so a neglected dock apron can still breed a Hunter Satellite. No gate has asked about
  it directly (see Playtest asks, below).

- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame**, a `getItem` +
  `JSON.parse` per title-screen frame at 60 fps. Deliberate (CS032 §4.3) — the build's first
  unconditional per-frame storage read. See `log/CS032.md`.

- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`**, not on `"Load
  Saved Game"`. Changing it is a signature question, design not wiring. See `log/CS032.md`.

- **`test-registry.js`'s FLAG-CS027-d** — twelve suite files grep a comment-stripped copy of the
  source missing the same 80 lines `execSource()` fixed. Latent, not live. **FLAG-CS027-c** — 8 test
  files hardcode world dimensions instead of reading `worldDims(X)` from `_harness.js`.

- **Piece-distinctness concern, deliberately unresolved (CS028).** Paul's gate call: leave as is.

- **Thirteen suite files hard-fail, not skip, on a shallow clone** (measured CS034 P9). Mechanical
  fix, same shape as CS026 P1/P2's conversions.

- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (CS023).**
  Both are live in the game today; no gate since has asked about them.

- **`blankLegacyStores()` calls `Achievements.save()` unguarded (CS034 P6)** — harmless today, only
  reachable from profile delete (title-only). A future changeset that makes the profiles or
  achievements screen reachable mid-run must fix both it and the achievement reset.

## Open questions (blocking)

None.

## Next up

- **CS038 is in flight** against `PLANNED-FEATURES-CS038.md` / `IMPLEMENTATION-PHASES-CS038.md`.
  P1 (Credits), P2 (glow lab) and P6 (glow retune, GATE A cleared) have landed. **P3–P5 (telemetry
  opt-in, voice repeat suppression, knob retirement) are still open** — independent of P6 and of each
  other. **GATE B** (playtest) blocks the P7 doc sweep.

- **The first thing any future gate should do is clear the debug overrides** (FLAG-CS036-a). Every
  slider answer any past gate has returned, and every one a future gate returns, is only as good as
  whether the build was reading its registry defaults at the time.

- **Delivery-ticker ship-anchor (deferred) — wants its own gate/playtest**, not a closing-phase guess:
  CS026 P6 tried it and CS029 measured it worse ("a ship-relative origin smears the delivery column as
  the ship drifts DURING a visit"). Declined four times now.

- **Deferred to `coinless-kit`, not this repo** — `game_version` in the board SELECT, a per-player
  query, and client-module support for both, ahead of a future GAME changeset rendering a Version
  column and a worldwide/just-me scope toggle. Shape recorded in `log/CS034.md`.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade`/`levelEndGracePulseEnd` for the ship pulse, and
  `hunterPulseMin`/`Max`/`Grow`/`Shrink` for the heartbeat. H8, H9 and H12 also returned no number and
  stand at their shipped values.

- **Does the caption expiring mid-freeze read right?** With captions on, Dan's "Level N" caption now
  ages during the frozen tail instead of holding, so it can vanish while the field is still stopped.
  Argued from the freeze's own contract and one line to revert either way. Never asked at the gate.

- **Does the dock apron read as pressure or as litter?** CS035 P2's lockout means a parked ship no
  longer cleans up around itself. Nobody has played a long session against that yet, and coalescence
  still runs on the cloud that accumulates.

## Balance notes

- **`COMBO n/N`'s denominator is still unrepresented (from CS026)** since the HUD row was dropped
  (accepted risk). Recorded so a future "the cargo cap is invisible" report is recognised as this.

- **The UFO difficulty chain goes fully flat past level 65 (CS024/CS025)** — junk saturates at L41,
  hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth with nothing escalating
  underneath. Fix if wanted is a step-count increase, no mechanism change.

- **`DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are both first-pass and browser-unverified (CS023).** Measured
  consequence: a rail satellite sweeping into a parked free one throws it up to 511.5 px/s off the
  outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives from.

- **Hunter Debris supply halved (CS034 P3), confirmed right-sized at a wave-12 playtest.**
  `HUNTER_GARBAGE` large/medium tiers dropped to 0; a full lineage yields 9 pieces, down from 18. Not
  verified past wave 12.

- **G20 says the game is no longer too easy**, and CS036's H1 says the level end now reads as a
  deliberate beat. Hunter volatility remains the answer to the former, assessed at
  `hunterVolatileAge` 60.

- **CS037 (C+F together) rated 5/10** — balanced, does not push late-wave play toward small hauls.
