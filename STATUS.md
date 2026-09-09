# Orbital Overhaul — STATUS
Version: 1.0.0.42 · Changeset: CS043 · Phase: P0 · Registry: 117 · Levers: 18

⛔ **CS043 is IN FLIGHT — P0 landed, P1-P5 not yet run.** CS042 is CLOSED underneath it: both of
CS042's planning docs are in `archive/`, and its full narrative is `log/CS042.md`. `CS042-GATE-A.md`
stays at the repo root — three CS042 phases are pinned byte-for-byte against it and those pins must
keep resolving. `PLANNED-FEATURES-CS043.md` and `IMPLEMENTATION-PHASES-CS043.md` carry CS043's own
spec and phase prompts; FORK-CS043-A is already resolved (§8: span the whole protection window).
Everything under **Known issues** below not resolved by P0 is carried forward and still live.

⛔ **The dated "where was I" note is `TODO.md`'s RESUME HERE block, and it is the only one** — it was
rewritten at P0's close and points at P1. Don't start a second resume note here; this file is build
reality, not a session log. **State at P0's close:** clean tree, suite **181/181, 0 failed, 0 skipped**
(both `test-cs035-p3` §F and `test-f6` §F flaked once in one run and passed on rerun — the two
documented flakes, not regressions). `eb7c6b9` and `82e3419` are **unpushed**; pushing is Paul's.

## Phase ledger — CS043

- P0 — Five stale build/suite comments fixed, comments only, no build byte: `nextWave()`'s comment
  near its `worldSizeFor()` call, which still described the retired CS021/CS022 archetype cadence
  ("up at every 3rd level... 42 times in a 63-level run"), now describes what the code actually does
  — one boundary, one resize per run at the default `earlyWorldLevels`, none at 0 (§7.1); the v1.5
  history note no longer calls the retired `RAMP_WAVES` "the single knob" in the present tense; the
  Achievements weekly-rotation modulus, stale at `% 15` in two places (`orbital-overhaul.html:99` and
  `test-f9.js`'s header) against the shipped 16-entry `WEEKLY` pool, corrected to `% 16`; and the
  `settings` object's `voiceStyle`/`captions` comments, which still claimed "NOT persisted yet (later
  phase)" after CS011 P3 shipped both, now say so. `scratchpad/test-cs043-p0.js` pins the extracted
  script comment-stripped-identical against its literal parent SHA.

## Phase ledger — CS042

- P0 — `tools/handling-lab.html`: a flyable mock ship on a real verlet tow chain, a model
  selector, a solver that works constants backwards from two stated outcomes, and a six-step
  protocol panel. Found three defects in spec §6's published tables. No build byte.
- P1 — `tools/sfx-lab.html`: twelve rows, three candidates each differing in *approach*, a per-row
  context button against the real neighbours, and a copy-out block printing the picked methods via
  `Function.prototype.toString` so what is heard is what ships. No build byte.
- P2 — `tools/ceremony-lab.html`: both ceremonies as scrubbable timelines over a mock frame
  carrying the real chrome, five presets, an `X` A/B against shipped, and a copy-out ending in
  **CHANGES FROM SHIPPED**. Two spec/build divergences found. No build byte.
- GATE A (answered) — twelve SFX picks and the "Cross-fade" ceremony preset, both verbatim in
  `CS042-GATE-A.md`. Its handling third came back **null** after three passes, which is what
  produced §6.8. `SHIP_DRAG` stays 0.35 (FLAG-CS042-f) and `CARGO_TURN` does not ship
  (FLAG-CS042-j).
- P3 — the first build byte: three `AudioSys` methods (`cargofull`/`cargolost`/`chainsever`) plus
  `CARGOFULL_FREQS`, ported verbatim and pinned against `CS042-GATE-A.md`. **The event-SFX rule is
  written into the build**: an SFX fires at its trigger site, immediately above the `say()`.
- P4 — the remaining nine methods plus `POWERTAG_ROOT`, eight more trigger sites. One
  **replacement**, not an addition: `breakChain()`'s guard branch drops its borrowed `shieldPing()`
  for `guardblock()`.
- P5 — the ceremony cross-fade, GATE A's preset taken unedited: fourteen transitions, **no timing
  moved**. Both dismissals still null the fields the build gates on; each dissolve is a render-only
  ghost (`levelDoneOut`, `celebrationOut`) ticked by `tickCeremony()` in `loop()`, not `update()`.
  Reverses CS034 P7 — the GAME OVER stack no longer draws under the panel.
- P6 — health supply levelling. The one-at-a-time gate **moved into `spawnHealthPowerup()`**
  (reversing CS040 P1, whose comment predicted it); a global spawn lock bounds the rate; the
  milestone interval grows with the level and pays only below 70% hull; the four ambient pity pairs
  widened to 30/45/10/16 s. Registry 110 → 113.
- P7 — **one mass, one force.** Four constants retired for `shipMass()`; `CHAIN_TUG` 26 → 58 holds
  a full chain's yank fixed. Both flagged consequences shipped as specified (FLAG-CS042-l/m). The
  Engine's tank burns only under load. Registry 113 → 114. §3.4's envelope re-validated at 4.112 px.
- P8 — the Scoop's reward side: cap 5 → 7 with `SCOOP_MOUTH_LEVELS` split out so the mouth curve
  keeps its own span, flanking capture orbs at 6–7, level-1 floor raised 713 → 2,200 px².
- P9 — the Scoop's risk side: `SCOOP_HITS_PER_LEVEL` 5 → 2 (its comment rewritten in place, quoting
  the intent it reverses), and a banked Health charge given a second job — above 70% hull it spares
  a scoop level instead of healing. **Never both.** Registry 114 → 115.
- P10 — menu navigation repeat, one shared timer for both devices, up/down only. The browser's
  `e.repeat` guard **stays**. Registry 115 → 117.
- GATE C (answered) — nine of ten questions "ship as-is"; FLAG-CS042-l and -m close as shipped. G4
  was the one actionable finding and it is render-only.
- P11 — Closing. ⛔ **`GAME_VERSION` went 1.0.0.40 → 1.0.0.42. The phase doc said `.41` and the phase
  doc was wrong** — `GAME_VERSION`'s own comment block has said "the 4th segment IS the changeset
  number" since CS010 P0. `.41` shipped first and Paul caught it at the close. `.41` is now a
  deliberate gap and **must not be back-filled** (the same rule `.23` already carries), because
  CS041 shipped no build byte and correctly bumped nothing. `DECISIONS.md` has the full entry. G4 answered with a **dashed field stroke** on every scoop shape (see below). Docs
  swept, all ~35 GDD §0 size rows re-measured, GDD build stamp made current and given an owner,
  version bumped, `STATUS.md` rolled, both planning docs archived. `CLAUDE.md`'s valve fired for the
  first time and is now exhausted — see Open questions.

Full narrative for every phase and both gates: `log/CS042.md`.

## Working / verified

- Full suite at close: **180 files, 180 passed, 0 failed, 0 skipped, 0 timed out** (exit 0),
  `node --check` clean, no flake rerun needed. Zero skips is asserted, not assumed. Baseline at the
  changeset's start was 171 files; nine new test files landed, one per build phase plus P11's.
- **P11's build change is one render edit and it is measured as render-only.**
  `scratchpad/test-cs042-p11.js` is 147 assertions in seven sections. §E pins `inScoopBox()`,
  `buildScoopSteps()` and `damageShip()` byte-identical against the phase's literal parent, holds all
  four scoop tables and six GATE-C-closed knobs unmoved, and drives **12,600 capture probes across
  eight levels × five headings** that match the parent exactly. §F is the load-bearing mutation
  check: a build with the `setLineDash([])` clear removed is constructed and driven, and the hull is
  shown to stroke inside the still-armed window — which is what `drawPoly()`'s own `save()`/
  `restore()` preserving a dash would do in the real game.
- **Two plain constants, no registry row** (`SCOOP_FIELD_DASH`/`SCOOP_FIELD_GAP`, both 6), on the
  `CAPTION_LINGER` precedent. Registry stays at 117. `tools/scoop-lab.html` resynced in the same
  edit so its preview still matches the build, which GDD §2.14.1 states as a contract.
- ⚠ **Nobody has seen the dashed scoop in a browser.** 6/6 px was sized off the shapes it strokes
  (13.5 dashes around an L6 orb ring, 17.6 around an L7), not picked round. A retune edits the two
  constants directly — no knob, no lever, no gate needed.
- GDD: 551,818 → 579,847 bytes. `CLAUDE.md` 50,657 → 52,480. `RATIONALE.md` 43,246 → 62,027 (eight
  anchors, five of them new). `orbital-overhaul.html` 1,077,675 → 1,081,177.

## Known issues

- **⛔ `CLAUDE.md` IS OVER ITS 50 KB CEILING AND THE VALVE THAT WAS SUPPOSED TO STOP THAT IS SPENT.**
  It closes at **52,480 bytes / 880 lines = 51.25 KiB, ~1.25 KB over**. The valve fired exactly as
  the phase prompt prescribed — `### Audio` 5,252 → 4,026 bytes, its reasoning relocated undeleted
  to `RATIONALE.md#music`/`#voice`/`#voice-queue`/`#captions` plus two new anchors — **and that was
  the whole ~1.2 KB it had to give.** No section is now over ~4 KB (largest: `### Audio` at 3.93
  KiB, then `### Save data` at 3.71), and the valve's own ⚠ SETTLED clause forbids firing on an
  under-size section however long the file gets. CS042's own rules were written as bare imperatives
  with their reasoning pre-relocated to three further new anchors, and the file still crossed. This
  is FLAG-CS041-b, and it is now live — see Open questions.
- **⛔ GDD §4–§7 measure ~21.8 KB, not the "~14 KB" §0's preamble claimed.** Corrected at P11's
  re-measure. Nothing in CS042 touched those sections, so that figure had been stale independently
  and nobody's checklist reached it. The §0 *rows* now have an owner (the closing-phase re-measure);
  the preamble's two aggregate figures are covered only because P11 noticed.
- **⛔ P9's judgment call, recorded because §4.5 does not reach it: a spared hit does not advance
  `game.scoopHits` either.** At the shipped 2-hit rate one charge therefore buys **half** a scoop
  level, not a whole one. The alternative spends a charge silently on hits that were not yet the
  costly one, which is what the `"SCOOP SAVED"` floater exists to prevent. If Paul wants a charge to
  buy a whole level, that is a different mechanism, not a tuning change.
- **⛔ P6's judgment call: a BLOCKED sweep Health roll drops another type, it does not drop
  nothing.** Health leaves the pool while the lock is up and the piece rolls over the other six, so
  the Super Mega Delivery's payout volume is unmoved and at most one Health arrives per sweep.
  Dropping nothing broke a shipped guarantee two older tests pin by name. One line to reverse.
- **⛔ The momentum tug's MID RANGE is weaker and only the endpoints were held (P7).** The old and
  new curves cross at m ≈ 8: below it the new tug is stronger (+37% at 2 nodes), above it weaker,
  **worst at m = 14, −21%**, recovering to −0.1% at 24. That is what retiring the 14-node flat spot
  costs. ⚠ **If a mid haul ever reads floaty, this is the first place to look** — and the fix is a
  `CHAIN_TUG` retune, which re-opens GDD §3.4's envelope.
- **⚠ GDD §3.4's envelope holds at the documented methodology (4.112 px, unmoved) but P7 recorded a
  reading worth Paul's eye:** the same kinematic stress at the speed §6.8 newly makes attainable
  (520/320) gives 5.118 px, 2.4% over the ~5 px budget — identical on the parent, so it is a
  property of the solver at that speed rather than of the phase. What changed is that a laden ship
  can now get there. Raising `CHAIN_ITER` to 5 would take the worst case 13.4 → 11.9 px; offered,
  not taken.
- **⚠ Spec doc debt in `archive/PLANNED-FEATURES-CS042.md`, recorded not fixed.** §4.3's level-1
  justification does not hold on its own numbers (L1 lands at 2,200 px², *below* the Magnet's 2,606,
  not "just ahead of" it — §4.2's own finding that the Magnet beats Scoop levels 1–2 therefore still
  holds at level 1); §4.4's illustrative fraction reasons from a level-5 cap; §4.2's "vs base circle"
  column is not reproducible from its own "Box area" column; §6.2/§6.3 carry four wrong cells P0
  measured; §6.3 and §6.7 read as live proposals when §6.8 superseded both. **The corrected figures
  are in the GDD and in the build's own comments** — the spec is archived history now, and none of
  it was carried forward wrong.
- **⛔ Prose-level GDD staleness: narrowed again, not closed.** CS042 P11 swept §2.1, §2.7, §2.8,
  §2.10/.1/.2, §2.12, §2.14/.1, §2.16, §2.19, §2.20.1, §1.1 and §3's Chain physics and Constants
  rows. ⛔ **Still unswept for prose (as opposed to dead identifiers): five §3 rows** —
  Canvas/scaling, AudioSys, MusicSys, VoiceSys, Input. The identifier audit cannot see a wrong
  ordering claim or a superseded rule stated in words with no dead name in it, which is the class
  every real find has turned out to be.
- **⛔ FLAG-8a stands, narrowed twice, still open.** No force-spawn exists for the low-health
  warning. The ambient cadence now rolls **18.0–27.6 s** at the low-hull threshold (recomputed at
  P6's widened pairs — the number moved *up* from CS040 P2's 12.4–18.0, because P6 raised absolute
  supply while holding the pity ratio), tightening toward 10–16 s at zero hull. The wait is real and
  it got longer.
- **⛔ Two suite files state a registry TOTAL as a literal**, which `CLAUDE.md` reserves for
  `scratchpad/test-registry.js`: `test-cs029-p4.js` §B and `test-cs038-p5.js` §A. Both were
  repointed 110 → 117 across CS042 the way every earlier phase repointed them. Rewriting them
  parent-relative like their siblings is a refactor, not a phase-local call.
- **⛔ A `STATUS.md` playtest ask (below) names four knobs — `hunterPulseMin`/`Max`/`Grow`/`Shrink`
  — retired to plain constants by CS038 P5**, so there is nothing to read off the debug panel for
  them. The underlying question (does the heartbeat feel right?) is still live; only the instruction
  for answering it is stale. Rewording changes what Paul is asked to go do, so it is left as-is.
- **⛔ Six moving-`HEAD` test pins have now been found and repaired; FOUR SURVIVE, passing vacuously
  on a clean tree:** `test-cs023-p3.js` (the `debrisBounce` line count and the byte-strict
  `shieldDeflect`/`shieldBounce` compare), `test-cs024-p6.js` §H TRAP 2, `test-cs025-p4.js` TRAP 3.
  Each needs a fixed SHA and the intervening diffs named. ⛔ **`test-cs024-p6.js` §H TRAP 2 went red
  mid-phase in both P3 and P9** — it diffs `damageShip` against `HEAD`, so it fails from the first
  edit until the commit lands. Any phase touching `damageShip`, `shieldDeflect`, `shieldBounce` or
  `debrisBounce` should expect it; re-running after the commit is the tell.
- **⛔ `execSync`'s default 1 MiB `maxBuffer` is a live tripwire and the game file is 1,081,177
  bytes.** P7 found and fixed three suite sites shelling out `git show HEAD:orbital-overhaul.html`
  without the standing 64 MB `maxBuffer` — one of them inside a `try/catch`, so its whole comparison
  had silently stopped running while the file still reported a clean pass. ⚠ **Nothing sweeps for
  the next one**, and the file keeps growing.
- **⛔ A FIXED-REF DIFF PIN CROSSED GIT'S RENAME THRESHOLD MID-CS040.** `test-cs024-p6b.js` §G TRAP 5
  diffs against `79222e5`, before the CS029 rename. Repaired by pinning `--find-renames=20%`, good
  to roughly 39,000 lines. **Any other fixed-ref pin reaching back past CS029 has the same latent
  failure** — none found, nobody has swept.
- **`test-cs037-p4.js` §H's `Bench.running` guard count is 10.** A pin, not a list; it moves when
  the seal legitimately grows.
- **CLAUDE.md documentation debt: one item remains.** `Achievements.save()` is no longer
  `afd_achievements_v2`'s only writer, and `mergeUnlock()` goes unnoted (flagged CS037 P6).
- **CS039 GATE T's capture is waves 1–5 and predates BOTH the CS040 healing rework and all of
  CS042.** A deeper capture on the current build (waves 10+, ideally spanning a
  delivery-hub-relief episode) would generalise its n=1 tow-length finding, give
  `hpWasted`/`healthBanked`/`hunterCount` their first real-play look, and is now the only way to see
  P6's supply changes and P9's faster `scoopHits` sawtooth in real data.
- **The late-wave frame hiccup's cause remains unmeasured** (CS037 Gate A null result).
- **Two unseeded-test flakes stand:** `test-cs035-p3` §F (~5%), `test-f6` §F (~1.7%). A rerun is the
  standing way to tell either from a real regression.
- **⛔ FLAG-CS036-a stands.** `saveSettings()` writes a full snapshot of every debug knob and
  `loadSettings()` re-applies it over the registry defaults with `debugOverride` defaulting ON — any
  installation that has ever saved settings is not running shipped defaults. Clear "Overrides
  Applied" before any future gate's numeric questions.
- **`navigator.clipboard` is unavailable on `file://` in several browsers.** The benchmark's and
  telemetry's copy rows both fall back to a CSV Blob download and say which happened. Untested in a
  real browser.
- **Carried forward, unaffected by CS042** — full detail in each item's own changeset log: parking
  at the Recycle dock no longer cleans up around the ship (CS035 P2's lockout, dock-apron question
  below); `FLAG-CS032-a`; `drawTitleMenu()` calling `SaveSlots.count()` every frame (deliberate,
  CS032 §4.3); the slots-screen LOAD-mode cursor landing on "Options" (CS032); `test-registry.js`'s
  `FLAG-CS027-d`/`FLAG-CS027-c`; the CS028 piece-distinctness call (leave as is, Paul's gate call);
  thirteen suite files hard-failing rather than skipping on a shallow clone (CS034 P9);
  satellite-vs-satellite bounce/damage never playtested (CS023); `blankLegacyStores()`'s unguarded
  `Achievements.save()` call (CS034 P6); the four-times-declined delivery-ticker ship-anchor idea;
  `game_version`/per-player leaderboard queries deferred to `coinless-kit` (`log/CS034.md`).

## Open questions (blocking)

- **⛔ FLAG-CS041-b — what happens now that `CLAUDE.md` is over 50 KB and the valve is spent?**
  Three ways out, all Paul's call, none takeable by a phase: **(a)** lower the ~4 KB section
  threshold so the valve has candidates again (`### Save data` at 3.71 KiB and `## Code map` at 3.36
  are the next two); **(b)** raise the ceiling, which `CLAUDE.md` itself has always called "a first
  guess" that "has not yet bound anything"; **(c)** accept the overrun and treat the number as
  advisory. Nothing is blocked on this — the file works — but the next changeset that adds a rule
  will face it immediately, and a phase must not silently drop a rule to fit or silently valve an
  under-size section.

## Next up

- ⛔ **CS043 bumps `GAME_VERSION` to `1.0.0.43`, and its phase doc must say so rather than "the next
  integer."** The 4th segment is the changeset number (the scheme at the constant's own comment
  block, since CS010 P0); CS042's phase doc wrote the next integer instead and shipped a wrong
  version that both live pins passed. A changeset shipping no build byte bumps nothing and leaves
  its number permanently unused, exactly as CS041 did. `DECISIONS.md`, 2026-09-08.
- **CS043 is IN FLIGHT — P0 landed this session, P1 next.** `PLANNED-FEATURES-CS043.md` and
  `IMPLEMENTATION-PHASES-CS043.md` carry the spec and phase prompts. Six phases (P0 done, P1 the
  deletion, P2 panel, P3 banner/grace/pulse, P4 spawn floor, GATE A, P5 close). **FORK-CS043-A is
  RESOLVED** — the ship's alpha pulse spans the whole protection window (Paul, at review,
  2026-09-09) — so P3 runs without waiting on it. The four surviving moving-`HEAD` pins and the
  deferred SFX retune are NOT in this changeset's scope.
- `TODO.md` carries the rest of the standing backlog.
- **⚠ Paul flagged some of P3/P4's event SFX as wanting a retune and EXPLICITLY DEFERRED it to a
  later changeset.** Not a defect, not blocked. ⛔ **Any such retune is a `tools/sfx-lab.html`
  session, not a hand-edit in the build** — the twelve methods are pinned byte-for-byte against
  `CS042-GATE-A.md`, so re-tuning a gain in place fails the suite by design.
- **A second, deeper telemetry capture on the current build (waves 10+)** — see Known issues. It is
  the only way to see CS042's health and scoop changes in real data.
- `CS039-VOICE-WORKLIST.md` (written CS038 P7) still records which voice events most need line
  alternatives, for Paul's next `tools/voice-robot-lab.html` session — still unconsumed. CS042's
  twelve SFX narrow the need but do not remove it: a one-line event still repeats its words.
- **The five unswept §3 prose rows** (Canvas/scaling, AudioSys, MusicSys, VoiceSys, Input) — a
  different, more expensive pass than the identifier audit, and nobody has scoped it.

## Playtest asks (open only — answered ones move to the log)

- **⛔ NEW, and it is the first thing to look at: does the dashed scoop read as an energy field?**
  P11 answered G4 without a browser. The mouth V, both level-6/7 orbs and the level-7 tethers now
  stroke through a 6/6 px dash. The question is whether a hit landing near an orb still feels as
  though it should have hurt. If the dashes read as too fine or too coarse, `SCOOP_FIELD_DASH` and
  `SCOOP_FIELD_GAP` are two plain constants at the top of the Scoop block.
- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade`/`levelEndGracePulseEnd` for the ship pulse, and
  the Hunter heartbeat's feel (⛔ ask directly, not by knob name — those four names are retired).
- **Does the caption expiring mid-freeze read right?** With captions on, Dan's "Level N" caption
  ages during the frozen tail instead of holding, so it can vanish while the field is still stopped.
- **Does the dock apron read as pressure or as litter?** CS035 P2's lockout means a parked ship no
  longer cleans up around itself. Nobody has played a long session against that yet.

## Balance notes

- **The seven knobs CS042 added all stand at their analytic defaults, unplaytested against their own
  extremes.** `DIFFICULTY-LEVERS.md` §4 names each one's A/B. The two most worth a deliberate look
  are `cargoUnitMass` (at 0 the whole one-mass model is off) and `bankSpareHullPct` (at 1.0 a charge
  always heals, at 0.0 it always spares).
- **`COMBO n/N`'s denominator is still unrepresented (from CS026)** since the HUD row was dropped.
- **The UFO difficulty chain goes fully flat past level 65 (CS024/CS025)** — junk saturates at L41,
  hunters at L33. Fix if wanted is a step-count increase, no mechanism change.
- **`DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are both first-pass and browser-unverified (CS023).**
- **Hunter Debris supply halved (CS034 P3), confirmed right-sized at a wave-12 playtest.** Not
  verified past wave 12.
- **G20 says the game is no longer too easy**; CS036's H1 says the level end reads as a deliberate
  beat. **CS037 (C+F together) rated 5/10.**
- **CS039 GATE T's measurement: Hunters carry the run, not delivery** (~56% of score, 65% of damage
  in the one analysed run). **CS040 removed `scoreRepairBonus` outright and CS042 changed both the
  health supply and the scoop economy**, so score composition has shifted twice since — not re-run.
