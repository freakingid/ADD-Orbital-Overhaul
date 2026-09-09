# Orbital Overhaul — STATUS
Version: 1.0.0.40 · Changeset: CS042 · Phase: P10 · Registry: 117 · Levers: 18
⛔ **CS042 is in flight.** `PLANNED-FEATURES-CS042.md` is the spec and `IMPLEMENTATION-PHASES-CS042.md`
carries the build order plus a copy-paste prompt per phase. CS041 and the 2026-09-07 off-cycle GDD pass
are both closed; their narratives are in `log/CS041.md`. Everything under **Known issues** below is
carried forward and still live.

## Phase ledger — CS042

- P0 — `tools/handling-lab.html` (spec §6.6): a flyable mock ship on a real verlet tow chain of 0–24
  nodes, a live A/B/C model selector, ten constant sliders seeded from the shipped values, a live
  **binding-limit** readout, the 0/4/8/12/16/20/24 sweep table headlined by Engine gain %, an `X`-key
  A/B against shipped, and a pinned recompute of §6.2/§6.3. Three spec defects found — see Known
  issues. ⛔ **The lab is driven by a six-step protocol panel** (feel today → model → base drag →
  is a full haul playable → `CARGO_TURN` → Engine strength); each step arms the lab and records one
  answer, and the Findings block is the single artefact GATE A hands back. Reference grid and ship
  trail carry the motion read, since the camera is locked to the ship. No build byte; no test
  (`tools/` has never carried suite coverage).
- P0 follow-up 3 (2026-09-08) — ⛔ **`CARGO_COAST` proposed (spec §6.7, NEW, awaiting Paul's
  sign-off), and the lab repointed from top speed to inertia.** Root cause of three failed tuning
  passes: `Ship.update`'s drag is `Math.pow(1 - SHIP_DRAG, dt)` with **no cargo term**, so an empty
  ship and a 24-node haul both bleed to a tenth of their speed in **5.35 s**. Coasting, stopping and
  turning are identical laden or empty — mass sets the ceiling and then stops mattering, and every
  §6.3 model tunes the ceiling. §6.7 adds one term, `dt / (1 + cargo * CARGO_COAST)`, so cargo
  **divides** the decay rate. The lab's two dials are now full-chain coast and the Engine's share of
  it, the sweep leads with coast / stop-distance / tug against today, and the verdict line checks
  §6.7's central claim that **no shipped top speed moves**. FLAG-CS042-k opens for the value.
- P0 follow-up 2 (2026-09-08) — ⛔ **the lab gained the view whose absence let a wrong answer
  through: a "vs today" column and a three-case weight verdict** (identical / heavier above N /
  LIGHTER by X at N). Paul's second pass read as a good result at a full chain and was in fact
  *lighter than the shipped game by up to 64 px/s at 8 nodes*, because the solver had lowered
  `CARGO_MAXSPD` to 0.010 to stop the speed cap clipping the Engine target — and that cap is the only
  thing making a SHORT chain heavy today. That lift is now opt-in (`freeCap`), off by default,
  restores 0.035 when unticked, and warns with the clipped figure instead of silently buying room.
- P0 follow-up (2026-09-08, same phase, Paul's direction) — ⛔ **the protocol was reframed around two
  OUTCOMES instead of two constants**, after Paul stated the goal in one sentence: *"the only thing I
  want this change to do is make it so cargo is heavier and the engine powerup makes a big difference
  in offsetting that heaviness."* The lab now carries two dials — **full-chain speed** (24 nodes, no
  Engine) and **Engine gain at a full chain** — and solves `CARGO_THRUST` (or `CARGO_DRAG`) and
  `ENGINE_MASS_MULT` backwards from them, lifting the speed cap out of the way only if it would clip
  a target. Both seed from what the shipped game actually does (283 px/s, +30%), so the starting
  position is the thing being changed. Model B is now the default and picking a model is an optional
  last step, not the first question.
- P1 — `tools/sfx-lab.html` (spec §1.6): twelve rows, one per §1.4 sound, three candidates each that differ in
  *approach* (for `cargofull`: a stepped arpeggio, a filter sweep, a pulsed fill), a picked radio per row,
  master/SFX sliders on the build's two-stage bus, a per-row context button against the real neighbours
  (`pickup`/`hit`/`explosion`/`shieldPing`/`achievement`/`powerup`/`lowhp`/`deliver`, ported verbatim — the
  lab's only port-in), and a copy-out block that prints the twelve picked methods with
  `Function.prototype.toString`, so what is heard is byte-for-byte what P3/P4 paste. ⛔ **`cargofull` and
  `cargolost` are ONE radio**: every `cargolost` candidate reads `CARGOFULL_FREQS` reversed, and
  `chainsever` reads the same array (reversed, then made smaller), so the three are matched by construction;
  `chainsever`'s audition plays the picked `cargolost` first. Two constants ride in the copy-out:
  `CARGOFULL_FREQS` and `POWERTAG_ROOT` (the per-type root table, `guard`'s doubled octave as data). No
  build byte; no `phon`; no test (`tools/` carries none). CLAUDE.md's tools list gained one entry —
  **49.1 KB / 848 lines after it, ~0.9 KB under the 50 KB ceiling** (HEAD was 48.9 KB, not P9's 48.4).

- P2 — `tools/ceremony-lab.html` (spec §3.4): both sequences as scrubbable timelines over a mock
  1280×720 frame carrying the real chrome — two-layer starfield, the "Level N Complete"
  announcement, the celebration panel at its real 820×560 with real emblems, the "Level N+1" banner,
  and the GAME OVER / FINAL SCORE / ten-row / footer stack. Per beat: duration or gate, fade in/out
  with a curve each, join, frozen-vs-live, plus the beat-5 thaw as switch **or** ramp, the grace
  pulse's own two knobs, and the game-over stack's per-element stagger. Five presets, `X` A/Bs
  against shipped without discarding the edit, and a copy-out block that ends in **CHANGES FROM
  SHIPPED** — P5's whole scope, empty when nothing moved. ⛔ **Two join rules, not one, because a
  gate has no known end:** after a timed beat an overlap shortens the sequence; after a gate only a
  post-confirm dissolve and "drawn under" are implementable, so overlap is not offered there. Two
  spec/build divergences found — see Known issues. No build byte; no test (`tools/` carries none).
  CLAUDE.md gained one tools entry — **49.5 KiB / 857 lines, 543 bytes under the 50 KB ceiling**.

- P3 — **the first build byte of CS042.** Three `AudioSys` methods (`cargofull`/`cargolost`/
  `chainsever`) and the `CARGOFULL_FREQS` constant they share, all **ported verbatim** from
  `CS042-GATE-A.md`'s copy-out block (picks A · A · C) and pinned byte-for-byte against that file in
  test §A — a re-tuned gain is the one failure a behavioural test could never see. ⛔ **The
  event-SFX rule is now written into the build**, as a comment block above the first new method in
  §1.3's own words: an event SFX fires at its **trigger site, immediately above the `say()`**, never
  inside `_emit()`. P4 copies that placement nine more times. Three sites wired: the pickup that
  fills the chain, `damageShip()`'s payload release, and `breakChain()`'s sever tail — the last
  reading **the same `chain.length === 0` predicate** the `say()` on the next line uses, so sound and
  line can never disagree. `boom()` stays; the cues layer. Nothing inside the voice channel moved
  (§1.5), pinned against the parent. No registry row, no GDD edit (P11 owns §2.8).

- P4 — the remaining nine `AudioSys` methods (`guardblock`/`levelup`/`hullfull`/`hullrelief`/
  `hullcritical`/`powertag`/`powerfade`/`haulsize`/`megadelivery`) plus `POWERTAG_ROOT`, all **ported
  verbatim** from `CS042-GATE-A.md`'s copy-out block (picks C·C·A·C·A·B·A·C·C), applying P3's
  trigger-site rule nine more times. ⛔ **One replacement, not an addition:** `breakChain()`'s guard
  branch now calls `guardblock()` where it used to borrow `AudioSys.shieldPing()` — the comment
  explaining the borrow is rewritten in place to record the reversal, per §1.4's own audit finding
  that chain armour and the ship's shield were indistinguishable. Eight sites wired: `nextWave()`
  (`levelup`, unconditional), the three hull edges in `update()` (`hullcritical`/`hullrelief`/
  `hullfull`, same latches as their voice lines), `applyPowerup()`'s two arms (`powertag`, immediately
  after `AudioSys.powerup()` — its 0.16s offset is load-bearing — excluding `health`/`guard` exactly
  like the collect_ line), the `POWERUP_DROP_TYPES` falling-edge loop (`powerfade`, same latch as the
  say(), so once per expiry not per frame, same `guard` exclusion), the dock pop that empties the
  chain (`haulsize(game.deliveryCount)`), and `superMegaDelivery()` (`megadelivery`). No registry row,
  no GDD edit (P11 owns §2.8).

- P5 — the ceremony cross-fade, **GATE A's "Cross-fade" preset taken unedited: fourteen changes, every
  one a transition.** ⛔ **No timing moved** — no `DEBUG_VARS` row, registry still 110, and
  `levelBannerTime`/`levelBannerFade`/`levelEndGrace`/`DEATH_DURATION` are all where they were; three
  plain constants carry the whole numeric content (`CEREMONY_ANNOUNCE_OUT` 0.35, `CEREMONY_PANEL_FADE`
  0.35, `CEREMONY_GAMEOVER_IN` 0.40) plus the lab's two curves, `easeIn`/`easeOut`, ported verbatim.
  ⛔ **"Fade-out after the press" is new mechanism, and both dismissals still NULL the field the rest
  of the build gates on** — `game.levelDone` (the freeze's hold/tail `if`/`else`) and `game.celebration`
  (`update()`'s early return, both input handlers, the deferred `nextWave()`). Each dissolve is a
  render-only ghost nothing else reads: `game.levelDoneOut` and `game.celebrationOut`, the latter a
  snapshot carrying the just-completed `wave` because `nextWave()` runs on the next line. Four fade
  clocks, ticked by `tickCeremony(dt)` in **`loop()`, not `update()`** — a panel is exactly the term
  `update()` early-returns on — holding through a pause like the caption and banner rather than like the
  toasts. `drawLevelBanner()`'s one-expression alpha splits (easeOut in, linear out) and
  `drawCelebration()` becomes a wrapper over `drawCelebrationPanel(c, a, wave)`. ⛔ **B4 reverses
  CS034 P7:** the GAME OVER stack is gated on `!game.celebration` again and fades in over 0.40 s instead
  of being uncovered. No stagger — the lab's controls came back all-zero. GDD §2.18/§2.20/§2.20.1 and
  §3's Main loop row edited, because GATE A note 4 requires the reversal recorded rather than silently
  re-added.

- P6 — health supply levelling, spec §2's five changes and three knobs. ⛔ **(b) REVERSES CS040 P1 and
  the build said so in advance:** the one-at-a-time gate moved out of the ambient call site and into
  `spawnHealthPowerup()`, so all three routes meet it and a second Health on the field is impossible by
  construction. CS040's comment predicting exactly this ("would be a design change, not a tidy-up") is
  **rewritten in place, quoting itself**, never deleted. ⛔ **Two bounds, two questions:** the lock
  (`game.healthSpawnLock`, armed by every route, ticked beside `healthTimer`) bounds the RATE and has a
  knob; the gate bounds the COUNT and deliberately has none. (c) `nextRepair += REPAIR_MILESTONE * (1 +
  growth * wave)` — `REPAIR_MILESTONE` itself unmoved at 10,000 (CS040's FORK-B). (d) a crossing pays
  only while `hp <= SHIP_MAX_HP * 0.70`, the `< SHIP_MAX_HP` clause kept so max 1.0 restores CS040
  exactly. (e) the four `healthGap*` defs widened, no mechanism. ⛔ **CS040's rescue survives** — the
  arm still fires on every crossing a hurt run should get, asserted at shipped defaults. Registry
  110 → 113 (POWERUPS, appended); `test-registry.js` is the only file carrying the number. No GDD edit
  — §2.7/§2.14 are P11's (its item 2 already names them), and they now read false on the milestone
  gate and the four gap numbers.

- P7 — one mass, one force (spec §6.8) plus the Engine's laden-only burn (§6.5). ⛔ **Four constants
  RETIRED, one replaces them:** `CARGO_THRUST`/`CARGO_MAXSPD`/`CARGO_MASS`/`CARGO_TURN` are deleted,
  their comment rewritten in place as a tombstone; `CARGO_UNIT_MASS` (0.07) feeds the new
  `shipMass()` = `1 + chainMass() × DEBUG.cargoUnitMass`, and acceleration, the drag **rate**, the
  turn rate and the tug's `(M−1)/M` all divide by that one number. Top speed is a flat rail.
  `CHAIN_TUG` 26 → 58 holds a full chain's yank fixed. ⛔ **Both flagged consequences shipped as
  specified and are asserted, not softened** — FLAG-CS042-l (top speed is mass-independent; a full
  haul reaches 520, not 283) and FLAG-CS042-m (rotation is penalised, 241 → 90 °/s, reversing Paul's
  GATE A close of FLAG-CS042-j). The Engine gained no cargo-independent effect and no taper; its only
  change is one added term on the burn condition. Registry 113 → 114 (`cargoUnitMass`, SHIP). GDD
  §3.4 rewritten and its stability envelope re-validated (4.112 px, unmoved; `CHAIN_ITER` stays 4).

- P8 — the Scoop's REWARD side (spec §4.1–§4.3): levels 6–7, the flanking orbs, the level-1 floor.
  ⛔ **THE TRAP IS DEFUSED BY A SECOND CONSTANT, NOT A CLAMP AT THE CALL SITE:** `SCOOP_MOUTH_LEVELS` (5)
  is what `buildScoopSteps()` divides by, `SCOOP_MAX_LEVEL` (7) sizes the tables, levels above the mouth's
  span clamp to its top step. Measured both ways — the new builder fed the parent's own config reproduces
  levels 1–5 **bit-for-bit**, and the counterfactual (divide by the cap) shrinks 2, 3 and 4, as
  FORK-CS042-A predicted. `SCOOP_ORB_OFFSET`/`SCOOP_ORB_R` are literal cap-length tables, zero below 6,
  ±62/26 and ±84/34. ⛔ **The guard grew two ways:** over both orb tables' index 0, and a new LENGTH
  check — the mouth tables are generated from the cap and the orb tables are literals, so a cap change
  that missed them would index `undefined` and capture nothing rather than fail loudly. `inScoopBox()`
  gains one disc test off its existing `shortDelta()` projection (no fresh `Math.hypot`), so **both**
  callers get the orbs and the predicate is not forked. Render: two `SCOOP_ORB_SEGS`-gons in
  `POWERUP_COLOR.scoop` beside the mouth V, before the hull, plus a `COLOR.dim` tether at level 7 — **a
  colour choice, not an alpha one**, since `ctx.globalAlpha` there belongs to the grace pulse. Floor:
  `minWidthMult` 1.2 → 2.6, `minDepth` 20 → 34, §4.2's area table in the constant's comment. No registry
  row, no lever, no GDD edit (P11 owns §2.14.1). ⛔ **§4.4/§4.5 are P9's and were not built.**

- P9 — the Scoop's RISK side (spec §4.4–§4.5): the loss rate and the health reserve.
  `SCOOP_HITS_PER_LEVEL` 5 → 2, and ⛔ **its comment is REWRITTEN IN PLACE, quoting v3.4 P3's own
  "that's the intent, not a bug to 'fix.'" verbatim** — the reversal is only legible beside the call
  it reverses. The knob's meaning is untouched: a flat hits-per-level count, no table, no curve, same
  bounds; only the `def` moved. ⛔ **NO TRIGGER CHANGED, and that is asserted, not assumed:**
  `breakChain()` and `scatterChain()` are byte-identical to the parent and the `srcTag` switch is too,
  so FORK-S1 stays resolved by the build already being right. The reserve is one branch inside CS040
  P3's existing auto-spend: above `DEBUG.bankSpareHullPct` (0.70) of hull a charge SPARES a scoop
  level, at or below it the charge heals as it always did, and at `scoopLevel` 0 it heals because
  there is nothing to spare. ⛔ **Never both, one charge per damage event, still below the `hp <= 0`
  exit.** `AudioSys.bankspend()` rings either way; the spare arm's own tell is a `"SCOOP SAVED"`
  floater mirroring `"SCOOP -1"` — no new sound, no new voice event. Registry 114 → 115
  (`bankSpareHullPct`, POWERUPS, appended). One doc byte outside the build: the telemetry guide's §7
  `scoopHits` trap, which spec §4.4 assigns to this phase. No GDD edit (P11 owns §2.12/§2.14/§2.14.1).

- P10 — menu navigation repeat (spec §5). ⛔ **The keyboard's `if (e.repeat) return;` guard STAYS** —
  the comment beside it is rewritten in place to say why (browser auto-repeat is ~30/sec and once
  pinned the Music Track row's crossfade near-silent) and that the guard is not what this phase removes.
  One shared timer, `tickMenuRepeat(dt)`, ticked in `loop()` beside `handleGamepadMenu()`, feeds the
  existing `menuInput()` for both devices — up/down only; left/right and confirm/back/pause never
  repeat (Paul's explicit call). Keyboard held-state lives in a new `menuKeys{}` map (menu-only twin of
  `keys{}`, written in branch (2) on a genuine keydown, cleared on keyup and never written into `keys{}`
  itself). ⛔ **`resetMenuNav()` clears `menuKeys{}` and the repeat timer's own state too**, at all four
  named call sites (menu open, the wave-clear arm, both celebration-panel opens) — `openDebug()`'s own
  call inherits the same fix as a side effect of the shared function, not a fifth named site. First
  repeat after `DEBUG.menuRepeatDelay` (def 0.40s), then every `DEBUG.menuRepeatRate` (def 0.10s) —
  subtracting the rate rather than resetting to 0 on each fire keeps repeats evenly spaced. Registry
  115 → 117 (`menuRepeatDelay`/`menuRepeatRate`, GLOBAL, appended). No GDD edit (spec names none).
  ⛔ **Eighteen pre-existing tests were legitimately invalidated by the two new registry rows and by
  P5's own moving byte-identity pin against its parent; all eighteen were WIDENED, not weakened** —
  sixteen are the standing registry-allowlist/total maintenance every prior phase has repointed the
  same way, one (`test-cs038-p4.js`) had a loose `/repeat/i` substring trap narrowed to what it actually
  protects (`VOICE_REPEAT_*`, unrelated to this phase's menu-repeat knobs), and one
  (`test-cs042-p5.js` §G) strips CS042 P10's own two named diffs from the `keydown`/`handleGamepadMenu`
  regions before its byte-identity check against P5's own parent, rather than requiring full identity.

## Working / verified

- **P10:** full suite **179 files, 179 passed, 0 failed, 0 skipped, 0 timed out** (exit 0),
  `node --check` clean, `test-f6.js` rerun clean (the standing ~1.7% flake). `scratchpad/test-cs042-p10.js`
  is 51 assertions in eight sections, driving the REAL `keydown`/`keyup` listeners and `tickMenuRepeat()`
  through `_harness.js`'s `listeners` hook — no reimplemented logic. Mutation-checked on two of its
  load-bearing claims: dropping the delay gate (repeat on any held frame) turns eight assertions red,
  and removing `resetMenuNav()`'s new `menuKeys{}`/`menuRepeat` clear turns three red (§F, the
  held-across-a-screen-change claim). §C counts real tick calls against the real `DEBUG` values rather
  than asserting a hand-derived frame number, so it is immune to floating-point dt-accumulation jitter
  (measured: the first repeat lands on tick 26, one priming tick plus 25 accumulating ticks, not the
  naive 24). §E drives the real `menuHeldDir()` against every non-up/down key name it could plausibly
  see and confirms none of them registers as a direction — the structural reason confirm/back/pause and
  left/right can never repeat through this timer. §D confirms the same for a real value row (Sound
  screen's SFX Volume slider): one nudge on keydown, none on a 90-frame hold.
  ⚠ **Not yet played.** Whether 0.40s/10-per-second reads right under a real hold, and whether
  `menuRepeatDelay` at its minimum (0.1s) or `menuRepeatRate` at its extremes feel better, is a GATE C
  question — the debug panel exposes both knobs live (`Overrides Applied` must be ON, FLAG-CS036-a).

- **P9:** full suite **178 files, 178 passed, 0 failed, 0 skipped, 0 timed out** (exit 0, measured
  after the commit — see the moving-`HEAD` pin note below), `node --check` clean.
  `scratchpad/test-cs042-p9.js` is 176 assertions in eight sections, and its load-bearing ones were
  **mutation-checked, not just run**: nine substitutions were applied to the build and every one turned
  assertions red — reverting the rate to 5 (9), dropping the `!scoopSpared` guard so the spare buys
  nothing (8), `>` becoming `>=` at the gate (4), letting the spare arm heal as well (4), dropping the
  `scoopLevel > 0` arm (9), dropping the `"SCOOP SAVED"` tell (2), moving the gate off P6's 0.70 (4),
  reading the PRE-damage hull (7), and ⛔ **the one that matters — "unifying" the two paths so
  `breakChain()` also erodes the scoop (6)**. ⛔ **§B is the assertion nothing else in the suite makes:**
  `breakChain(0)`, every partial `breakChain(i)`, an intercepted break and a lethal hit all leave
  `game.scoopLevel` AND `game.scoopHits` untouched, while `damageShip()` moves both — measured from
  identical starting state, with the payload really cut loose each time so the call is never a no-op.
  ⛔ **§F MEASURES the comment's own claim rather than asserting it:** the shipped predicate is
  replaced by a literal `s.hp >= SHIP_MAX_HP` and both builds are driven over ten post-damage hulls —
  the shipped one spares 6 times, the full-hull counterfactual **0**. That is the "dead code" the
  comment warns a future reader about, built and run.
  ⛔ **Twenty pre-existing tests were legitimately invalidated; all twenty were WIDENED, not weakened.**
  Sixteen are the standing registry-allowlist maintenance (114 → 115). Four are real: `test-v33-p3.js`
  §0 records the reversal in place and its §5 now reads the rate off the build (its claim was always the
  mechanism, never the number — CS042 P8's own repair applied again); `test-cs015-p5.js` §E does the same
  for the const and its §F1 derives the default-path count; `test-cs042-p8.js` §H said the rate and the
  reserve belong to P9 and now records that P9 built both; and `test-cs026-p4.js` §A's FloatText
  call-site census goes 8 → 9 for the `"SCOOP SAVED"` push. Three files also gained a
  deliberate-retune exemption (`test-cs024-p6e.js` §G's own `P7_INTENDED` mechanism, copied to
  `test-cs025-p1.js` §G and `test-cs025-p2.js` §K), because `scoopHitsPerLevel` is the one pre-existing
  knob whose live value moved — which §H asserts is the ONLY one.
  ⚠ **Not yet played.** Every number here is measured headless. Whether losing a level every two hits
  reads as pressure rather than punishment, and whether the reserve teaches its own rule, is GATE C.

- **P8:** full suite **177 files, 177 passed, 0 failed, 0 skipped, 0 timed out** (exit 0, no flake
  rerun needed), `node --check` clean. `scratchpad/test-cs042-p8.js` is 189 assertions in eight sections,
  and its load-bearing ones were **mutation-checked, not just run**: nine substitutions were applied to the
  build and every one turned assertions red — dropping the orb branch (31), restoring the cap as the mouth
  divisor (18), dropping the orb tables from the guard (5), reverting the level-1 floor (6), moving the
  tether to level 6 (2), hardcoding 5 HUD segments (2), filling an orb (2), swapping the wrap-aware
  projection for a raw `Math.hypot` (4), and forking the powerup caller off the orbs (3). ⛔ **One of those
  found a defect in the test itself and it was fixed, not accepted:** the tether assertion originally read
  its expectation off `SCOOP_ORB_TETHER_LEVEL`, so it moved with the very knob it existed to pin and a
  tether at level 6 passed. It now expects the literal 7, and the constant's value is asserted once,
  separately. §A and §B measure against the phase's own parent (`4e15049`) rather than asserting from
  arithmetic. **HUD legibility, measured as the phase requires:** at `HUD_FX_RING_R` = 16 a lit wedge is
  **12.44 px** of arc at seven segments (18.19 at five), the inter-wedge gap is **1.92 px and unchanged**
  (`HUD_RING_SEG_GAP` is in radians, so it does not shrink with the count), and the stroke is 4 px wide.
  A wedge is still 3.1× its own stroke width and 6.5× the gap beside it, so seven segments read as
  segments. **No HUD tuning note for P11.**
  ⛔ **Three pre-existing tests were legitimately invalidated; all three were WIDENED, not weakened.**
  `test-v33-p3.js` §0 reads its table-length and mouth-top claims off `SCOOP_MAX_LEVEL`/`SCOOP_MOUTH_LEVELS`
  instead of the literal 5 they were written against, §1 derives its pick count from the cap, and §10's
  edge probes gain the orb term the predicate itself gained — with an assertion that the orb term is
  identically false at levels 1–5, so at every level that file was originally written against the mouth's
  boundary claims are exactly as sharp as before. `tools/lowhp-glow-lab.html`'s copied `SCOOP_MAX_LEVEL`
  was resynced to 7 (`test-cs038-p2.js` exists to catch exactly that drift, and did).
  ⚠ **Not yet seen in a browser.** Every number here is measured headless. Whether the orbs read as a
  *capability* rather than a bigger number is a GATE C question.

- **⛔ P8 FOUND AND REPAIRED A SIXTH MOVING-`HEAD` PIN: `test-cs010-p1.js` §B.** It compared
  `git show HEAD:orbital-overhaul.html` against the WORKING TREE and asserted `inScoopBox()` was
  byte-identical, so for thirty-odd changesets it compared a build against itself and passed vacuously —
  and the first phase to legitimately change the capture geometry made it fail for a reason unrelated to
  CS010. Both sides are now literal SHAs (`0b3d07b` and its parent `39369b9`, CS010 P1's own commit and
  the build it edited), which reproduces CS010's original render-only claim exactly (684 poses × levels,
  all identical) and can never be re-aimed. The parent predates the CS029 rename, so the source comes
  through `_phase-ref.js`'s `parentSource()`, which carries both game-file names and the 64 MB
  `maxBuffer`. The file now also skips **loudly** (`SKIP_TAG`) and counts the skip in its own summary
  line, replacing a `process.exit(1)`. **The four pins listed further down are unaffected and still open.**

- **P7:** full suite **176 files, 176 passed, 0 failed, 0 skipped, 0 timed out** (exit 0),
  `node --check` clean. `scratchpad/test-cs042-p7.js` is 189 assertions in eight sections, and its
  load-bearing ones were **mutation-checked, not just run**: restoring the top-speed divisor, exempting
  rotation from the mass, dropping the burn's chain term, re-clamping the tug's `massFactor`, making
  drag mass-blind again, moving `CARGO_UNIT_MASS` off 0.07, giving the Engine a cargo-independent
  effect and leaving `CHAIN_TUG` at 26 each turn 4–37 assertions red. §D and §G measure against the
  phase's own parent (`aebd3df`) rather than asserting from arithmetic: acceleration is byte-identical
  at every chain length with and without the Engine, while coast, turn and terminal speed are shown
  to have moved.
  ⛔ **Twenty pre-existing tests were legitimately invalidated; all twenty were WIDENED, not weakened.**
  Fifteen are the standing registry-allowlist maintenance (113 → 114). Five are real: `test-cs024-p6.js`
  lays a chain in every burn staging — **without one, "rotation burns nothing" and "firing burns nothing"
  would have passed for the NEW term's reason rather than their own** — and gains the new term's own
  pins; `test-f3.js` §D keeps its mass-sum thesis and re-asserts it on coast and turn, the two terms P7
  newly made mass-sensitive, because the top-speed equality it used to carry is now trivially true;
  `test-p6.js` §A pins the four retirements' absence and §D flips the m=20-vs-m=24 tug claim from
  "equal" to "strictly greater" (the retired flat spot); `test-cs019-p1.js` §F freezes the ship so its
  bit-identical chain-position compare isolates the solver from handling, the same technique
  `test-p6.js` §E already uses; and `test-cs010-p2.js` §B records the `CARGO_TURN` reversal in place
  and proves the divisor live off the knob instead of a source substitution.
  ⚠ **Not yet played.** Every number here is measured headless. Whether "heavier cargo, and the Engine
  offsetting it" now reads right is FLAG-CS042-l/m and a GATE C question.

- **P6:** full suite **175 files, 175 passed, 0 failed, 0 skipped, 0 timed out** (exit 0, no flake
  rerun needed), `node --check` clean. `scratchpad/test-cs042-p6.js` is 712 assertions in ten
  sections, and its load-bearing ones were **mutation-checked, not just run**: removing the moved gate,
  dropping the sweep's lock arm, reverting the hull gate to `< SHIP_MAX_HP`, dropping the growth term
  and making the ambient re-roll conditional each turn assertions red. Every probe **isolates one
  bound** — a gate probe zeroes the lock, a lock probe clears the field — because either mechanism
  alone would make the other's assertion pass vacuously. §D pins the reversal against the parent
  (`28f25cd`): the gate WAS at the ambient site there and `healthSpawnBlocked()` did not exist.
  ⛔ **Nineteen pre-existing tests were legitimately invalidated; all nineteen were WIDENED, not
  weakened.** Fourteen are the standing registry-allowlist maintenance (110 → 113). Five are real:
  `test-cs040-p1.js` §B/§C/§F now set P6's three knobs to their neutral ends (`asCS040()`) so CS040's
  own arithmetic assertions stand untouched, and its **§E is rewritten in place with its changeset** —
  it pinned the very behaviour (b) reverses, and now also asserts that no knob restores it;
  `test-cs040-p2.js` reads its bounds off the build's constants instead of retyping numbers (its §D's
  "strictly between the two ranges" is now the interpolation it actually is, since the widened pairs
  overlap); `test-cs020-p1.js` §J puts growth at 0 rather than dropping `nextRepair` from a bit-exact
  loop; `test-f2.js` computes the step from the knob; `test-cs026-p3.js` TRAP 5 names the new
  `healthSpawnLock` reset line.
  ⚠ **Not yet played** — every number here is measured headless. Whether the supply now reads as
  levelled is a GATE C question (spec §7's G3).

- **P5:** full suite **174 files, 174 passed, 0 failed, 0 skipped, 0 timed out** (exit 0, after one
  `test-f6.js` flake rerun — the standing ~1.7% one), `node --check` clean.
  `scratchpad/test-cs042-p5.js` is 157 assertions in nine sections, and its load-bearing ones were
  **mutation-checked, not just run**: removing the B4 gate, reverting the banner's fade-in to linear,
  and dropping the announcement's ghost each turn assertions red, and ⛔ **§F catches the documented
  HARD HANG** — replacing the freeze's plain `<=` with the crossing one-shot its own header warns about
  reports `frames: -1` on both degenerate knob settings, with and without a panel. §F is the phase
  prompt's required regression: `levelBannerFade >= levelBannerTime` and `levelBannerTime === 0` both
  thaw on the **first** tail frame, driven through the real `loop()`, counter-capped, never wall-clock.
  §G pins the six standing constraints positively against the parent — `updateLevelEndFreeze`,
  `tickLevelBanner`, `nextWave`, `Achievements.onUnlock` and **both input handlers** are byte-identical,
  and no handler, `update()` or the reduced sim reads any of the four new fade fields.
  ⛔ **Six pre-existing tests were legitimately invalidated; all six were WIDENED, not weakened**, on the
  standing moving-pin precedent — `test-cs026-p3.js` TRAP 5, `test-cs030-p4.js` §A/§G (a third repoint,
  folding B4's two edits back by name after asserting them present), `test-cs010-p5.js` §E,
  `test-cs025-p5.js` §C, `test-cs036-p2.js` §I and `test-cs036-p3.js` §A/§G. Two of those pinned the very
  behaviours GATE A reverses (the announcement's hard cut, the stack drawn unconditionally); each is
  rewritten in place with its changeset, never deleted.
  ⚠ **Not yet seen in a browser** — every number here is measured alpha, not a look call.

- **P4:** full suite **173 files, 173 passed, 0 failed, 0 skipped, 0 timed out** (exit 0),
  `node --check` clean. `scratchpad/test-cs042-p4.js` is 124 assertions in eight sections, same shape
  as P3's: every one of the nine methods pinned byte-for-byte against `CS042-GATE-A.md` (§A);
  `guardblock()` replacing `shieldPing()` verified both by call-count (§B) and textually — the source
  no longer contains `AudioSys.shieldPing()` at all (§H); every trigger site driven through real code
  (`nextWave`, `update`, `applyPowerup`, the expiry loop, a real dock-delivery visit, `breakChain`)
  with the voice gate closed, asserting the sound still fires (§C–§F); `health`/`guard` invent no
  `powertag`/`powerfade` caller (§E); the `expire_` latch fires `powerfade` once per expiry, not once
  per frame (§E); headless no-throw (§G); and the standing traps — nothing named inside `VoiceSys`,
  `powertag()` sits immediately after `AudioSys.powerup()` at both call sites, no registry row added,
  `VOICE_LINES`/`VOICE_PRIORITY`/`VOICE_CRITICAL` byte-identical to the parent (§H).
  ⛔ **P4 legitimately invalidated three pre-existing tests' assumptions about the guard-branch tell —
  all three widened, not weakened, following the standing "moving-HEAD pin" precedent:**
  `test-cs023-p3.js`'s byte-strict `breakChain` compare gained a fourth named diff (the
  `shieldPing()` → `guardblock()` tell, alongside its comment rewrite); `test-cs019-p1.js`'s absorb-tell
  counter now spies on whichever of `guardblock`/`shieldPing` the build under test actually has (the
  PRE_FIX pinned historical build at `6928ff3` still only carries `shieldPing()`); and
  `test-cs011-p4.js`'s "bare fake ctx" (§E) gained the minimal oscillator/gain/filter stubs every other
  headless `AudioContext` fake in the suite already carries, since `nextWave()` now also fires
  `AudioSys.levelup()` unconditionally whenever `ctx` is truthy — "bare" could no longer mean "has no
  node factories at all" once a phase's SFX call reached a path `startGame()` itself walks.

- **P3:** full suite **172 files, 172 passed, 0 failed, 0 skipped, 0 timed out** (exit 0, measured
  after the commit — see the moving-`HEAD` pin note under Known issues), `node --check` clean.
  `scratchpad/test-cs042-p3.js` is 104 assertions in seven sections. Its load-bearing ones (§C/§D/§E)
  were **mutation-checked, not just run**: rewriting the pickup site as
  `if (VoiceSys.say(...)) AudioSys.cargofull()` — what a call inside `_emit()` amounts to — turns
  three of them red. §B swaps in a recording `AudioContext` and reads the scheduled pitches back, so
  "reversed, faster, no closing knock" is measured rather than asserted from the source.
  `test-cs023-p3.js`'s byte-strict `breakChain` compare was **widened** by exactly this phase's edit,
  its own documented maintenance and the fourth such widening.

- **P2:** full suite **171 files, 171 passed, 0 failed, 0 skipped, 0 timed out** (exit 0, no flake
  rerun needed); `orbital-overhaul.html` byte-identical (md5 `3087c476…`, same as P0 and P1).
  The lab was exercised headless under stubbed DOM/canvas: every preset × both tabs × unlocked
  on/off scrubbed end to end in 0.02 s steps — **10,275 frames drawn, 56,131 assertions, 0 failed**
  — checking every beat's alpha and the field rate stay inside [0,1], that the findings block never
  prints `undefined`/`NaN`, that shipped diffs to NONE while all four other presets diff to
  something and to each other, that a gated beat's assumed dwell is never reported as a change, that
  both join rules behave, and that the grace pulse sweeps its full 0.2→1.0 range.
  ⚠ **Not yet opened in a browser** — pacing is what GATE A is for.

- **P1:** full suite **171 files, 171 passed, 0 failed, 0 skipped** (exit 0, no flake rerun needed);
  `orbital-overhaul.html` byte-identical (md5 `3087c476…`, same as P0).
  The lab was exercised headless under a stubbed `AudioContext`: all 36 candidates across every
  argument (75 calls), every audition/context path, all three pair configurations of the copy-out parsed
  as a constants block plus an object literal, and no two candidates of a sound share method text.
  ⚠ **Not yet heard in a browser** — the candidates are tuned by arithmetic, not by ear; that is what
  GATE A is for. If they come out indistinct, the phase doc says rerun P1 on Opus 5 — it is disposable.
- **P0:** full suite **171 files, 171 passed, 0 failed, 0 skipped, 0 timed out** (exit 0);
  `orbital-overhaul.html` is byte-identical to `47b1249` (md5 `3087c476…` on both sides), and
  `tools/` carries no suite coverage by long-standing practice,
  so P0 ships no test. The lab's analytics were cross-checked against an independent recompute and
  against a discrete 1/60 s integration of the build's own step order (within 0.7%, the expected
  offset from the cap being applied before drag).
- Carried from CS041's close: **171 files, 171 passed, 0 failed, 0 skipped**. `orbital-overhaul.html`
  has been byte-identical since CS040 — neither CS041 nor the off-cycle pass touched it.
- The four literal prose pins (§1.3b) all still match, re-checked after every phase's edits.
- Headline result: per-session GDD load for a representative phase, old rule vs new — **~505 KB →
  ~33–46 KB**, a ~91–94% reduction, with nothing deleted. GDD whole-file size: 534,526 → 528,243
  bytes (net **+3,717** — P1's additive index outweighs the sweep's net −16,209 across P2–P5).
- The staleness sweep's own result: ~246 audit candidates across P3–P5, 16 real (a ~93–94%
  false-positive rate, as GATE C's own sample predicted) — every real hit was a defect byte-counting
  would never have found. Full byte table and candidate accounting: `log/CS041.md`.

## Known issues

- **⛔ GDD §2.14.1, §2.14 and §2.12 now read false on scoop loss and the health bank (P9). P11 already
  owns all three** (its item 2 names §2.14.1 and §2.14; §2.12 should be added). §2.14.1's "Losing
  levels" bullet states the rate as "**5** as of v3.4 P3, up from 2", computes "at 5 hits/level a
  level-5 scoop survives 25 non-lethal hits", and closes by calling the resulting stickiness "the
  intent of the P3 retune, not a bug for a future session to 'fix.'" — the number, the arithmetic and
  the **intent** are all reversed now, and the cap is 7 rather than 5 (P8's own item below).
  §2.14's tuning-constants paragraph repeats "`SCOOP_HITS_PER_LEVEL` (**5** as of v3.4 P3, was 2)" and
  does not list the new `BANK_SPARE_HULL_PCT`; its health-bank bullet says a charge "**auto-spends**
  the instant the hull next drops below max" full stop, which is now only one of the charge's two jobs.
  ⚠ **§2.12's own scoop-decay bullet says "(2)" and is therefore ACCIDENTALLY CORRECT again** — it was
  stale from v3.4 P3 until this phase, so P11 should re-derive it rather than assume it was checked;
  what §2.12 does lack is any mention of the spare arm, which sits inside the `damageShip()` block that
  section owns. **P9 edited no GDD content**, on P6/P7/P8's precedent, so P11's §0 size re-measure stays
  mandatory for P5's and P7's edits.

- **⛔ P9'S ONE JUDGMENT CALL, RECORDED BECAUSE §4.5 DOES NOT REACH IT: a spared hit does not advance
  `game.scoopHits` either.** The spec's table says the scoop is "kept", which two readings satisfy —
  buy off the whole hit, or let the tally climb and block only the level drop. P9 built the first.
  The second spends a charge silently on every hit that was not yet the costly one, which is exactly
  what the `"SCOOP SAVED"` floater exists to prevent, and a third reading (spend only on the hit that
  would drop a level) would make the bank block reach into the scoop tally when §4.5 frames the whole
  decision as one threshold on the hull. Consequence: at the shipped 2-hit rate one charge buys half a
  level, not a whole one. If Paul wants a charge to buy a whole level, that is a different mechanism,
  not a tuning change.

- **⚠ SPEC DOC DEBT, RECORDED NOT FIXED: §4.4's illustrative fraction is stale and §4.5's is fine.**
  §4.4 reasons from a level-5 cap — "a player now loses three or four scoop levels across a run instead
  of one" against "roughly seven non-lethal hits in a full-health run". P8 raised the cap to 7, so those
  same seven hits cost three levels out of **seven**, not out of five. The mechanism and the knob are
  unchanged; only the fraction is stale, and it is already noted in the constant's own comment. Measured
  alongside it: a full ladder now takes 14 non-lethal hits to strip, down from 35.

- **⛔ GDD §2.14.1 now reads false on the Scoop in five places (P8). P11 already owns it** (its item 2
  names §2.14.1 by number). The claims that moved: the level range is stated as `0…SCOOP_MAX_LEVEL = 5`
  and the pickup as "capped at 5"; `buildScoopSteps`'s step formula is given as dividing by
  `(SCOOP_MAX_LEVEL − 1)` over `k in 1..SCOOP_MAX_LEVEL`, which is now `SCOOP_MOUTH_LEVELS` with a clamp
  above it; the shipped config is quoted as `{maxWidthMult: 5.0, minWidthMult: 1.2, curve: 1.0,
  minDepth: 20, maxDepth: 60}`, two of whose values moved; the render bullet describes the prong-V as the
  Scoop's only ship-side shape; and the `tools/scoop-lab.html` paragraph says "show all 6 levels", now 8.
  ⛔ **§0's row for §2.14.1 is also incomplete** — its third column lists "mouth geometry … the ship's
  scoop render" and should name the orbs and the two orb tables, so a future phase editing them finds the
  row. That row exists, so this is a gap in it, not a missing row. **P8 edited no GDD content**, on P6/P7's
  precedent, so P11's §0 size re-measure remains mandatory for P5's and P7's edits, not P8's.

- **⚠ SPEC DOC DEBT FOUND BY P8, RECORDED NOT FIXED: §4.3's level-1 justification does not hold on its
  own numbers.** It says the raised floor puts level 1 at "~2,246 px² — clearly outside the base circle
  and just ahead of the Magnet". The first half is right and is the defect §4.2 named: the measured box
  area at the constants §4.3 specifies is **2,200 px²** against a 1,018 px² base circle, so the first
  pickup is now unmistakable. The second half is wrong on either number — the Magnet's boosted pickup
  circle (`MAGNET_PICKUP_MULT` 1.6 → r 28.8) is **2,606 px²**, so level 1 sits *below* it, and §4.2's own
  finding 2 ("the Magnet beats Scoop levels 1 and 2 outright") therefore still holds at level 1. ⛔ **The
  constants shipped exactly as §4.3 specifies them** — moving `minWidthMult` to clear the Magnet would be
  inventing design, which is Paul's call, not a phase's. The arithmetic is printed on every run of
  `test-cs042-p8.js` §B. Also for P11: §4.2's "vs base circle" column is not reproducible from its own
  "Box area" column (its box areas are exact; the ratios are not `box/circle`, `(box+circle)/circle`, or
  the union of the two), so that column should be recomputed or dropped rather than carried into the GDD.

- **⛔ P7 FOUND A LATENT SUITE TRIPWIRE THAT CS042 P6'S OWN COMMIT ARMED, AND IT IS FIXED: the game
  file crossed 1 MiB, and `execSync`'s default `maxBuffer` IS 1 MiB.** `orbital-overhaul.html` went
  1,040,713 → **1,050,828 bytes** at P6, so from the moment that commit became `HEAD`, every suite
  file shelling out `git show HEAD:orbital-overhaul.html` **without** the standing 64 MB `maxBuffer`
  died with `ENOBUFS`. It could only fire *after* the phase that armed it, which is why P6 measured
  175/175 and the tree then measured 173/175 with nothing changed. Three sites lacked the idiom every
  other git-show site in the suite already had: `test-cs010-p1.js` and `test-cs025-p4.js` hard-failed,
  and **`test-cs010-p2.js` was worse — its call is inside a `try/catch`, so the throw was swallowed
  and its whole HEAD-vs-worktree comparison silently stopped running while the file still reported a
  clean pass.** All three now carry `maxBuffer: 64 * 1024 * 1024`. ⚠ **Nothing sweeps for the next
  one:** any future site added without it has the same latent failure, and the file will keep growing.

- **⛔ A FIFTH MOVING-`HEAD` PIN FOUND AND REPAIRED (P7): `test-cs010-p2.js` §D.** All three of its
  stability comparisons asked "is the WORKING TREE at least as stable as `HEAD`?" — so for eleven
  changesets they compared a build against itself and passed vacuously, and the first phase to
  legitimately change the physics made them fail for a reason unrelated to CS010. Both sides are now
  literal SHAs (`a66ef10` vs `a66ef10^`, CS010 P2's own commit and its parent), which reproduces
  CS010's own recorded figures exactly (8.17 vs 8.33 px at mass 24, 11.61 vs 12.61 at mass 6) and can
  never be re-aimed again. The file also now skips **loudly** (`SKIP_TAG`) instead of a `console.warn`
  nobody counts. **The four pins listed further down are unaffected and still open.**

- **⛔ P7 measured a consequence of §6.8 the spec did not state: THE MOMENTUM TUG'S MID RANGE IS
  WEAKER, and only the endpoints were held.** `CHAIN_TUG` 26 → 58 was solved to hold a *full* chain's
  yank fixed and it does (36.40 → 36.36 accel/px), but the two curves have different shapes between
  the endpoints. Old `26 × min(1.4, m·0.10)` is a straight line clamping flat from m=14; new
  `58 × (M−1)/M` saturates smoothly. **They cross at m ≈ 8:** below it the new tug is stronger (+37%
  at 2 nodes, +22% at 4), above it weaker — **worst at m=14, −21%** — recovering to −0.1% at 24. That
  is what retiring the 14-node flat spot costs, and CS010 P2's own reason for raising `CARGO_MASS`
  was exactly this mid-range heft. Not a defect and not softened; the full table is in
  `scratchpad/test-cs042-p7.js` §D, printed on every run, and in GDD §3.4. ⚠ **If GATE C reports a
  mid haul feeling floaty, this is the first place to look** — and the fix is a `CHAIN_TUG` retune,
  which is one number and re-opens §3.4's envelope.

- **⛔ GDD §3.4's envelope was RE-VALIDATED and holds, but P7 recorded a reading worth Paul's eye.**
  At the documented methodology (24 nodes, 900 frames, dt = 1/60, kinematic v = 420/260) worst-case
  link stretch is **4.112 px, byte-identical to the parent (delta 0.000)**, so `CHAIN_ITER` stays at 4
  and nothing was raised to fit. ⚠ **But the same kinematic stress at the speed §6.8 newly makes
  attainable (520/320) gives 5.118 px — 2.4% over the ~5 px budget, and identical on the parent**, so
  it is a property of the solver at that speed rather than of this phase; what changed is that a laden
  ship can now get there. The faithful stresses grew +0.49 to +0.59 px, from figures (7.2–8.4 px) that
  were already above 5 px on the parent for the big-timestep reason §3.4 itself records. No NaN, no
  velocity explosion, no node lost. **Raising `CHAIN_ITER` to 5 would take the worst case 13.4 → 11.9
  px**, measured — offered, not taken, because the phase forbids raising it to make a number fit and
  the documented budget was never exceeded.

- **⛔ GDD §2.1, §2.10, §2.10.1, §2.10.2, §2.14 and §1.1 now read false on handling (P7). P11 owns
  only two of them today.** Its item 2 names **§2.1 and §2.10.2** ("the handling model and drag") —
  the other four are NOT on its list and should be added: **§2.10** states the mass penalty as
  `1 + m×CARGO_THRUST` / `1 + m×CARGO_MAXSPD` and the tug as `CHAIN_TUG (26) × stretch × …`;
  **§2.10.1** cites the three retired coefficients by name in its tow-cap rationale; **§2.14**'s
  Engine bullet says the tank is "decremented by `dt` ONLY on frames where forward thrust is applied"
  (it now also requires a non-empty chain) and calls the unloaded no-op "FLAG-4a, accepted" when
  §6.5 has now acted on it; and **§1.1**, which is in the always-read floor, says "mass divides thrust
  and top speed (a full 24-node haul ≈ 37% thrust / 54% top speed)" — the thrust half is still exact,
  the top-speed half is not. §3's **Chain physics** row also names `shipTurnRate()`'s old expression.
  ⛔ **P7 edited §3.4 only** (its own mandatory re-validation target) and left the rest to P11 on P6's
  precedent. **P7 also edited GDD content, so P11's §0 size re-measure stays mandatory** — §3.4's own
  row is already corrected in place (5.2 → 9.0 KB), which is one row of ~35, not a substitute for it.

- **⛔ P6's one judgment call, recorded because the spec did not reach it: a BLOCKED sweep Health roll
  drops another type, it does not drop nothing.** §2.3 (a) says the lock is "respected by all three
  routes" but not what the Super Mega Delivery's per-piece roll should do when it lands on Health and
  the lock is up. Dropping nothing was written first and broke a shipped guarantee two older tests pin
  by name — every budgeted swept piece pays exactly one powerup (`test-cs018-p9.js`, `test-cs035-p6.js`,
  and the `SWEEP_POWERUP_CAP` arithmetic itself). So Health leaves the pool while it is blocked and the
  piece rolls over the other six, which is the same six-type pool §2.3's own "drop health from the sweep
  pool" variant describes. Consequence: at most ONE Health per sweep, and the SMD's payout volume is
  unmoved. If Paul wants the reward volume to fall instead, that is a one-line change back.

- **⛔ Two suite files state a registry TOTAL as a literal, which CLAUDE.md reserves for
  `scratchpad/test-registry.js` (found P6).** `test-cs029-p4.js` §B and `test-cs038-p5.js` §A both
  carry `eq(X.DEBUG_ENTRIES.length, <number>)`. Both were repointed 110 → 113 the way every earlier
  phase repointed them, and each now says so in place — rewriting them parent-relative like their
  siblings is a refactor, not a phase-local call.

- **⛔ GDD §2.7 and §2.14 now read false on health supply (P6). P11 already owns them** (its item 2
  names both by number). Four claims moved: the milestone's gate is no longer `hp < SHIP_MAX_HP` alone,
  its interval is no longer flat, "the one-Health-at-a-time gate is the *ambient* call site's, so a
  milestone can legitimately put a second one on the field" is now the opposite, and the ambient
  cadence reads 10–16 s / 30–45 s rather than 6–10 / 22–30.

- **✅ DISCHARGED BY P5 (kept for the log): CS042 P2 found two divergences between
  `PLANNED-FEATURES-CS042.md` §3 and the build, and P5 built the lab's model, not §3.3's table.** (1) **§3.3 lists the GAME OVER stack as beat 4, after the panel.
  The build draws it BEFORE the panel, in the same frame as the handoff** — `draw()`'s
  `game.state === "gameover"` block runs, then `drawCelebration()` draws the near-opaque 820×560
  panel over it, covering everything but the footer. So the stack does not "arrive" at the panel's
  dismissal; it is uncovered. §3.3's own clunk note ("behind another hard-cut modal") already
  half-says this, but the table's ordering reads the other way and would mislead an implementer.
  The lab models the build (`under: true` on that beat, and turning it off is itself a reportable
  change). (2) **§3.4 item 2's per-beat control list has no stagger**, yet §3.3 names "no stagger"
  as the game-over clunk — an instrument without it cannot answer its own question. The lab carries
  four per-element delays, a shared element fade and a per-row table step on that one beat, all
  zero at shipped. ⚠ **That is the one control not itemised in §3.4**, added deliberately rather
  than by drift; if Paul does not want it in scope, the copy-out simply reports all zeros.
  **It did: the stagger came back all-zero and none of it ships.** On (1), P5 implemented the
  lab's reading and the block's own B4 line — the stack stops drawing under the panel entirely —
  so §3.3's table ordering is now what the build does. ⛔ **§3.3's table is still wrong on paper**
  and is P11's doc debt, alongside §6.3's two wrong numbers.

- **✅ SHIPPED BY P7 (kept for the log): §6.8 "one mass, one force", proposed 2026-09-08, superseding §6.7 and §6.3's three models.**
  Paul asked for exactly two knobs — the cargo's effective mass and the Engine's effect on it — with
  the code deriving the rest "within reason for a ship and cargo flying in the relative weightlessness
  of space". ⛔ **It collapses five constants into one:** `M = 1 + chainMass() × CARGO_UNIT_MASS`, then
  acceleration, drag rate, turn rate and the momentum tug are all that one mass under one force.
  `CARGO_THRUST`, `CARGO_MAXSPD`, `CARGO_TURN`, `CARGO_MASS` and §6.7's `CARGO_COAST` all retire;
  `CHAIN_TUG` rescales 26 → 58 to preserve today's full-chain tug. `ENGINE_MASS_MULT` is unchanged and
  is the second knob. Registry 110 → 111. **At `CARGO_UNIT_MASS` 0.07 acceleration is byte-identical to
  today at every chain length**, while coast goes 5.3 s → 14.3 s and turn 241 → 90 °/s across 0 → 24
  nodes, every column monotonic with no clamp anywhere.
  - ⛔ **Two consequences needing Paul before it ships.** Terminal speed becomes mass-independent, so
    a full haul can eventually reach 520 where today it is capped at 283 (**the top-speed penalty
    disappears**); and rotation is penalised by construction, **reversing FLAG-CS042-j**, which he
    closed at GATE A as "`CARGO_TURN` does not ship". FLAG-CS042-l (the value) and FLAG-CS042-m (the
    turn reversal) are both open.
  - ⛔ **GDD §3.4's stability envelope must be re-validated** — the tug changes form and a laden ship
    sustains much higher speeds for much longer, which is what that envelope bounds.
  - ⚠ **Answered in the real game, not the lab.** Paul's own read after three lab passes; the two
    knobs go in the debug panel at values that reproduce today, and GATE C decides.
  - **✅ All of the above landed as written.** Registry went 113 → 114 rather than the 110 → 111 the
    proposal wrote, because CS042 P6 added three rows in between. §3.4 was re-validated and holds. The
    one thing the proposal did not predict is the tug's mid-range deficit — its own Known-issues item
    above.

- **⛔ GATE A's handling question came back NULL (2026-09-08). `CARGO_COAST` has no value and
  FLAG-CS042-k stays open.** Paul's third findings block was the shipped defaults with every protocol
  step unrecorded, and his own note was that he is *"not feeling super confident about how this testing
  went"* and that this may return in a later changeset. ⛔ **Read that as a verdict on the instrument.**
  A mock ship on an empty field has no enemies, no dock, no chain to lose and nothing to be late for,
  which is most of what makes a haul feel heavy — inertia may not be judgeable outside a real run.
  **Do not send him back to the lab for a fourth pass without changing something structural.**
  Spec §6.7 now carries the two ways forward: ship the knob at 0.0 (byte-equivalent to today) and make
  the value a GATE C playtest question, or defer §6.7 to its own changeset and cut P7 to §6.5 alone.
  **P7 was blocked on that choice; nothing else in CS042 ever was.** ✅ **Resolved by §6.8, which
  supersedes §6.7 outright — `CARGO_COAST` never shipped as a constant, and FLAG-CS042-k closes with
  it.** The drag divisor it proposed is what `dt / M` turned out to be, so the mechanism landed and
  the knob did not.

- **⛔ §6.7 `CARGO_COAST` is PROPOSED and unratified. Paul approved the mechanism on 2026-09-08; the
  value is FLAG-CS042-k and nothing ships until he signs off.** His goal, verbatim: *"I just want the
  ship to experience heavier effect on inertia from more debris mass, and I want the engine powerup to
  significantly ease up on that heavier effect. The more debris, the more mass, and the more effect."*
  - ⛔ **The minimum version is one constant and one line.** `CARGO_COAST` 0.03 with **every other
    value left shipped** moves no top speed at any chain length, leaves the tug alone, stretches a
    full haul's coast 5.35 s → 9.19 s, and the Engine already returns **50%** of that purely because
    `chainMass()` is the sum it halves. Moving `ENGINE_MASS_MULT` 0.5 → 0.35 raises the relief to 65%
    but is **not** speed-neutral, so it is a separate decision.
  - ⛔ **§6.3's base-drag raise does not ship and is pointed the wrong way for this goal** — higher
    drag stops the ship sooner, which is less momentum. FLAG-CS042-f closes as "no change (0.35)".
    §6.3's Model C is likewise unnecessary: it increases drag with cargo, which reads as friction
    rather than mass. **Model B, unedited, is G6's answer.**
  - ⚠ **The momentum tug still clamps at 1.4, reached at 14 nodes**, so from 14 to 24 the yank does
    not grow — a second violation of "more debris, more effect", deliberately left out of §6.7
    because raising it feeds the chain solver and pulls in GDD §3.4's stability re-validation. Offered
    and declined at this round; still available.

- **CS042 GATE A, handling half: second pass run, one decision outstanding.** Paul's pass 2 answered
  Model **B**, `SHIP_DRAG` **0.35 (unchanged — he flew 0.45 and kept the shipped value, so
  FLAG-CS042-f closes as "no change" and §6.3's proposed 0.45 does not ship)**, `CARGO_TURN`
  **0.000** (FLAG-CS042-j closes as "does not ship"), `CARGO_MASS` **0.100 (unchanged)**,
  `CARGO_THRUST` **0.085**, `ENGINE_MASS_MULT` **0.34**, targeting a full chain at 260 px/s with an
  Engine gain of +79%. ⛔ **As recorded it does not meet his own stated goal:** with `CARGO_MAXSPD`
  lowered to 0.010 the ship is *lighter* than today below ~16 nodes (by 64 px/s at 8), and only
  heavier at 20+. A full chain first reaches 16 nodes at level 9, so through level 8 the change would
  make cargo lighter, not heavier. **The fix is one checkbox:** leaving `CARGO_MAXSPD` at the shipped
  0.035 makes short chains identical to today, keeps 20/24 nodes heavier, and still roughly doubles
  the Engine at a full chain (+56% against today's +30%). The cost is the full-chain Engine gain
  falling from +79% to +56%. **Awaiting Paul's call between that and reopening G7's base drag**, which
  is the only other lever that makes the penalty bite at short chains.
- **CS042 GATE A, handling half: first pass, superseded.** His first sweep answered
  Model **B**, `SHIP_DRAG` **0.45**, `CARGO_TURN` **0.000** (closing FLAG-CS042-j as "does not ship"),
  and produced a full chain at **167 px/s** with an Engine gain of **+130%**, then restated the goal
  and re-ran. Superseded by pass 2 above; three things learned from it are still worth keeping:
  - **Model B reaches what §6.3 promised for Model C.** At `CARGO_THRUST` 0.10 with `SHIP_DRAG` 0.45
    the cap stops binding above ~1.5 nodes, so the ship is drag-limited from the first piece of
    Debris and thrust changes are visible. No new constant, nothing retired. He also raised the
    thrust penalty and lowered the cap penalty, which is P0's corrected direction, not the spec's.
  - ⛔ **`CARGO_MAXSPD` may not need to move at all.** The solver leaves it at the shipped 0.035
    because the cap already clears both targets; his hand-tuned 0.02 was not required.
  - ⛔ **`ENGINE_MASS_MULT` also drives the momentum tug**, via the same `chainMass()` sum. At 0.20 a
    full chain's tug falls 1.40 → 0.48 while the Engine is lit (at the shipped 0.5 it only falls to
    1.20). GDD §2.10 says the tug saturates at effective mass 14; at 0.20 that needs 70 raw nodes, so
    it never saturates with the Engine up. The Engine stops being speed relief and becomes "the chain
    stops fighting you". The lab now shows this live so it is a choice, not a surprise in P7.

- **⛔ CS042 P0 measured three defects in `PLANNED-FEATURES-CS042.md` §6. P7 must not paste that
  section's numbers.** The lab recomputes both published tables from the build's own arithmetic; where
  they disagree, the lab is right (P0's standing rule). **§6.2** is exact at 0, 4 and 24 nodes and wrong
  in its **12-node Engine cells** — accel **239** not 243 (**+30%**, not +31%), top speed **430** not
  424 (**+17%**, not +16%). **§6.3's Model C table** is exact at 0 and 24 nodes and wrong at 4 and 12:
  at 4 nodes both Engine states are still **cap-limited at 520**, so the Engine gain is **+0%**, not the
  claimed +19%; at 12 nodes it is **315 / 471 (+49%)**, not 249 / 340 (+37%). **The qualitative claim
  fails with it** — under Model C at the shipped `SHIP_DRAG` 0.35 the cap binds out to **4.7 nodes**
  (9.4 with Engine), not "only when unloaded". That sentence is true only at the *proposed* `SHIP_DRAG`
  **0.45**, where the cap stops binding at 0.9 nodes. ⛔ **Model C and the base-drag raise are therefore
  one decision, not two — G7 cannot take C alone and get §6.3's stated behaviour.** Separately, §6.3's
  Model B instruction to "raise `CARGO_THRUST` **and** `CARGO_MAXSPD`" is backwards on the second:
  raising `CARGO_MAXSPD` lowers the cap and binds it harder. At shipped values Model A's crossover sits
  near **31 nodes**, past the 24-node tow cap, which is why "the clamp binds nearly everywhere" is right.

- **⛔ Stale COMMENTS in the build and the suite — four now, all needing a build/test edit this
  doc-only pass could not make.** Two stale `% 15` comments (`orbital-overhaul.html:99`;
  `scratchpad/test-f9.js:11`'s header — its assertions already use 16 correctly), and two found by
  the off-cycle GDD pass: the `settings` object's comment claims `voiceStyle`/`captions` are "NOT
  persisted yet (later phase)" when CS011 P3 shipped both (`saveSettings`/`loadSettings` write and
  restore them additively), and `orbital-overhaul.html:54` still calls `RAMP_WAVES` "the single knob"
  for difficulty when CS024 P4 retired the ramp and renamed the constant `MUSIC_INTENSITY_WAVES`,
  which now drives only music intensity. ✅ **The fifth item of this group is DONE:** GDD §3's Entities
  row no longer states the dead `leverScale()` sizing in the present tense — it is past-tensed and
  points at the CS024 note in its own row.
- **⛔ FLAG-8a stands, narrowed but still open (found P4).** The ambient low-health Health cadence
  now rolls 12.4–18.0 s at the low-hull threshold (tightened from CS040 P2's healing rework,
  confirmed against the live build), down from the "up to 26 s" the flag originally complained
  about — but no force-spawn exists and the wait is still real.
- **⛔ A `STATUS.md` playtest ask (below) names four knobs — `hunterPulseMin`/`Max`/`Grow`/`Shrink` —
  retired to plain constants by CS038 P5, so there is nothing to read off the debug panel for them
  (found P4, not rewritten here).** The underlying question (does the heartbeat feel right?) is
  still live; only the instruction for how to answer it is stale. Rewording it is a small edit but
  changes what Paul is asked to go do, so it is left as-is rather than silently rewritten.
- **⛔ Prose-level staleness: narrowed by the off-cycle pass, not closed.** ✅ Swept and clean:
  **§2.7** and **§2.10.2** (every constant re-checked against the build; no false claim found).
  ✅ Swept and corrected: §3's **Main loop** row, which omitted both load-bearing `Capture`
  integration points (`Capture.timeScale` on `dt`, `Capture.afterDraw()` after `draw()`) and the
  `Bench.running` early-return. ⛔ **Still unswept: six §3 rows** — Canvas/scaling, AudioSys,
  MusicSys, VoiceSys, Input, Chain physics. The identifier audit cannot see a wrong ordering claim or
  a superseded rule stated in words with no dead name in it, which is exactly the class every real
  find below turned out to be.
- **The off-cycle pass's own result: 6 false claims and 1 documentation gap, none findable by the
  identifier audit.** In §2.10, "lower-mass scrap (planned for Hunter Satellites, F4) **will** tow
  more easily" (it shipped — `HUNTER_SMALL_MASS` 0.5) and a tow cap described as growing "from
  `CARGO_BASE` (12)" when CS018 P5 made it level-granted from **8**. In §2.8, voice style and
  captions called "not yet built" when CS011 P3 shipped both. In §6, three entries built on retired
  knobs (`GARBAGE_DECAY`, `POWERUP_DROP_CHANCE`, `RAMP_WAVES`-as-difficulty). **The gap: the player's
  Ship Rotation preference** (`settings.shipTurnScale`, 50–150%, on the Controls screen, with the
  FLAG-10a "Return to Defaults does not reset it" call) **was documented nowhere in §2** — only in
  §3 and §3.4. It is now §2.1's own bullet, cross-referenced from §2.16, and both §0 rows name it.
- **⛔ A FIXED-REF DIFF PIN CROSSED GIT'S RENAME THRESHOLD MID-CS040.** `test-cs024-p6b.js` §G TRAP 5
  diffs against `79222e5`, a commit *before* the CS029 `asteroids-deluxe.html` → `orbital-overhaul.html`
  rename. Repaired by pinning `--find-renames=20%`, good to roughly 39,000 lines. **Any other
  fixed-ref pin reaching back past CS029 has the same latent failure** — none found, nobody has swept.
- **`test-cs037-p4.js` §H's `Bench.running` guard count is 10** (was 9 pre-CS039). A pin, not a list;
  it moves when the seal legitimately grows.
- **CLAUDE.md documentation debt: one item remains.** `Achievements.save()` is no longer
  `afd_achievements_v2`'s only writer, and `mergeUnlock()` goes unnoted (flagged CS037 P6).
- **CS039 GATE T's capture is waves 1–5 and predates the CS040 healing rework.** A deeper capture on
  the v4 build (waves 10+, ideally spanning a delivery-hub-relief episode) would generalise its n=1
  tow-length finding and give `hpWasted`/`healthBanked`/`hunterCount` their first real-play look.
- **The late-wave frame hiccup's cause remains unmeasured** (CS037 Gate A null result).
- **Two unseeded-test flakes stand:** `test-cs035-p3` §F (~5%), `test-f6` §F (~1.7%). A rerun is the
  standing way to tell either from a real regression.
- **⛔ FLAG-CS036-a stands.** `saveSettings()` writes a full snapshot of every debug knob and
  `loadSettings()` re-applies it over the registry defaults with `debugOverride` defaulting ON — any
  installation that has ever saved settings is not running shipped defaults. Clear "Overrides
  Applied" before any future gate's numeric questions.
- **Four moving-`HEAD` test pins survive, passing vacuously on a clean tree:** `test-cs023-p3.js`
  (the `debrisBounce` line count and the byte-strict `shieldDeflect`/`shieldBounce` compare),
  `test-cs024-p6.js` §H TRAP 2, `test-cs025-p4.js` TRAP 3. Each needs a fixed SHA and the
  intervening diffs named. ⛔ **P3 paid the practical cost for the first time:** `test-cs024-p6.js`
  §H TRAP 2 diffs `damageShip` against `HEAD`, so it went red the moment P3 edited that function and
  stayed red until the commit landed. **Any phase touching `damageShip`, `shieldDeflect`,
  `shieldBounce` or `debrisBounce` should expect it** — P6 and P9 both will. Re-running after the
  commit is the tell; rerunning the file before it is not.
- **`navigator.clipboard` is unavailable on `file://` in several browsers.** The benchmark's and
  telemetry's copy rows both fall back to a CSV Blob download and say which happened. Untested in a
  real browser.
- **Carried forward, unaffected by CS041** — full detail in each item's own changeset log: parking at
  the Recycle dock no longer cleans up around the ship (CS035 P2's lockout, dock-apron question
  below); `FLAG-CS032-a`; `drawTitleMenu()` calling `SaveSlots.count()` every frame (deliberate,
  CS032 §4.3); the slots-screen LOAD-mode cursor landing on "Options" (CS032); `test-registry.js`'s
  `FLAG-CS027-d`/`FLAG-CS027-c`; the CS028 piece-distinctness call (leave as is, Paul's gate call);
  thirteen suite files hard-failing rather than skipping on a shallow clone (CS034 P9);
  satellite-vs-satellite bounce/damage never playtested (CS023); `blankLegacyStores()`'s unguarded
  `Achievements.save()` call (CS034 P6); the four-times-declined delivery-ticker ship-anchor idea;
  `game_version`/per-player leaderboard queries deferred to `coinless-kit` (`log/CS034.md`).

## Open questions (blocking)

None.

## Next up

- **✅ P10 IS DONE.** Menu navigation repeat shipped — see the P10 ledger entry and its "Working /
  verified" writeup.
- **⛔ GATE C IS ANSWERED (2026-09-08).** G1/G2/G3/G5/G6/G7/G8/G9/G10 all **ship as-is — no tuning
  change from any of them.** FLAG-CS042-l (`CARGO_UNIT_MASS` 0.07) and FLAG-CS042-m (the turn penalty,
  90 → 241 °/s empty-to-full) both close as "fine as shipped."
  - ⛔ **G4 is the one actionable finding, and it's a RENDER-ONLY ask, not a mechanics change.** The
    level-6/7 orbs and the scoop mouth read as *ship geometry* — solid glow-strokes that imply hittable
    hull — when neither has ever taken damage (true since the Scoop shipped, not new to P8). Paul's
    read: they should look like an energy field / tractor beam, not armor, so a hit landing near them
    doesn't feel like it should have hurt. Two candidate directions, **neither chosen**: transparency
    (`ctx.globalAlpha` on the orb/mouth strokes) or a dashed line (Paul flagged possible cost —
    `ctx.setLineDash()` is cheap per call but is a pattern nothing in `drawPoly`/`glowStroke` uses
    today, so it's a real evaluation, not a knob turn). **P11 owns this as its GATE C tuning pass
    (item 1)** — pick a direction and ship it; no new registry row implied unless P11 wants the alpha
    value tunable.
  - ⚠ **Separately, Paul flagged some of P3/P4's event SFX as wanting a retune — EXPLICITLY DEFERRED to
    a later changeset.** Not P11's problem; do not touch `AudioSys` tuning in the close.
  - **Then P11 closes.** No phase is blocked.
- ⛔ **GATE A IS ANSWERED (2026-09-08). Both copy-out blocks live verbatim in `CS042-GATE-A.md`**,
  a root artefact on `CS039-VOICE-WORKLIST.md`'s precedent, with a "what this means for the phase"
  note under each. ⛔ **P3, P4 and P5 read that file; it is their input and this bullet is not a
  substitute for it.** Its handling third stays null and superseded by §6.8.
  - **Sound (P3/P4):** all twelve picked — cargofull A · cargolost A · chainsever C · guardblock C ·
    levelup C · hullfull A · hullrelief C · hullcritical A · powertag B · powerfade A · haulsize C ·
    megadelivery C. Verified on recording: twelve methods, §1.4's order, every one `this.ctx`-guarded
    and routed to `this.sfx`, `POWERTAG_ROOT` carrying the six keys §1.4 asks for. ⛔ **`health` is
    deliberately absent from that table** (§1.4's own ⚠) and the `|| POWERTAG_ROOT.scoop` fallback
    is not a licence to add `collect_health`.
  - **Ceremony (P5): Cross-fade, taken unedited — fourteen changes, every one a transition.** No
    duration, gate or knob moves; both totals stay at shipped. ⛔ **P5 is a rendering and lifecycle
    change, not a timing one**, and three build invariants push back on it: `game.levelDone` and
    `game.celebration` must still go null on the confirm (the freeze's hold/tail `if`/`else` and
    `update()`'s early return read them), so a post-press dissolve needs its own render-only state;
    and `drawLevelBanner()`'s deliberate one-expression alpha has to split, because the banner now
    wants easeOut in and linear out. ⛔ **B4 reverses CS034 P7** — the gameover block goes back to
    not drawing under the panel. Full reasoning in `CS042-GATE-A.md`.
- **✅ P4 is DONE.** The remaining nine sounds are ported and wired — see the P4 ledger entry and its
  "Working / verified" writeup above. `shieldPing()` → `guardblock()` landed in `breakChain()`'s guard
  branch, `POWERTAG_ROOT` sits beside `POWERUP_LABEL`, and `powertag()`'s 0.16 s offset and the
  `health`/`guard` exclusions all came through as GATE A's note recorded them.
- **✅ P5 is DONE.** The ceremony cross-fade is shipped, GATE A's block taken unedited — see the P5
  ledger entry and its "Working / verified" writeup above. All six standing constraints hold and are
  asserted positively against the parent; the freeze terminates on the first tail frame under both
  degenerate banner-knob settings, panel or no panel.
  - ⛔ **P5 edited GDD content (§2.18, §2.20, §2.20.1, §3's Main loop row), so P11's §0 size re-measure
    is now mandatory** — that column is snapshotted numbers, not live formulas.
  - ⛔ **P11 still owns §2.20.1's fuller write-up if it wants one.** P5 wrote only what its own change
    made false, which is the minimum GATE A note 4 asks for; nothing here is a substitute for P11's own
    §2 pass.
  - ⚠ **`IMPLEMENTATION-PHASES-CS042.md` rides along in P5's commit.** Paul edited P5's copy-paste
    prompt in the working tree before the session started (`[PASTE HERE]` → a pointer at
    `CS042-GATE-A.md`); it is carried rather than left dangling, and named in the test's scope pin.
  - ⚠ **Nobody has seen this in a browser.** Every number in the writeup is measured alpha under a
    stubbed canvas. Whether the cross-fade actually reads as smooth is a GATE C question.

- **✅ P6 is DONE.** Health supply levelling shipped — see the P6 ledger entry and its
  "Working / verified" writeup above. All five §2.3 changes landed, the CS040 P1 comment is rewritten
  rather than deleted, and CS040's rescue is asserted still firing at shipped defaults.
  - ⛔ **P6 edited no GDD content**, so P11's §0 size re-measure is still mandatory for P5's edits
    alone, not P6's. §2.7/§2.14's now-false health claims are listed under Known issues.
  - ⚠ **Nobody has played this.** The three knobs are analytic defaults; G3 is the gate question that
    tells us whether 12 s / 0.08 / 0.70 are the right numbers, and each knob's own minimum is the A/B.
- **✅ P7 IS DONE, AND IT WAS THE ONLY BLOCKED PHASE.** §6.8 shipped as written — see the P7 ledger
  entry and its "Working / verified" writeup. §6.3's three models, §6.7's `CARGO_COAST`, the
  `SHIP_DRAG` raise to 0.45 and `CARGO_TURN` above 0.0 are all closed and none of them shipped, so
  FLAG-CS042-k is superseded and closed with §6.7.
  - ⛔ **Two flags are Paul's, not a phase's, and both are answerable from the debug panel at GATE C.**
    **FLAG-CS042-l** — `CARGO_UNIT_MASS`'s value. It ships at **0.07**, which holds acceleration
    byte-identical to every build since CS010; the row is **SHIP → "Cargo mass per unit"** (0–0.30,
    step 0.005). ⛔ **At 0 the whole model is off** — thrust, drag, turn and tug all read unloaded
    however much is towed — which is the clean A/B for §6.8 as a whole. **FLAG-CS042-m** — rotation is
    now penalised (241 → 90 °/s empty-to-full), reversing his GATE A "`CARGO_TURN` does not ship".
    There is no way to exempt rotation under one mass short of special-casing it back out, so the
    only dial is the same knob.
  - ⛔ **Turn "Overrides Applied" ON or both rows read but do not bite**, and clear the overrides first
    (FLAG-CS036-a) if a clean baseline matters. The partner knob, **POWERUPS → "Engine towed-mass
    multiplier"** (0–1, def 0.5, lower is stronger), is unchanged and is the second of the two dials.
  - ⚠ **Nobody has flown this.** Every number in the writeup is measured headless, and the whole point
    of §6.8 was that a mock ship on an empty field could not answer the question.
- **✅ P9 IS DONE.** The loss rate and the health reserve shipped — see the P9 ledger entry and its
  "Working / verified" writeup.
  - ⛔ **The gate ships at 0.70, the same number as P6's `repairMilestoneHullPct`, and the test asserts
    the two are equal rather than each being 0.70.** CS042 has one definition of "hurt"; if either
    moves, both move, and the pin makes a one-sided change fail.
  - ⛔ **The knob's two ends are the GATE C A/B and neither is an off switch.** POWERUPS → **"Bank
    scoop-save hull gate"** (0–1, step 0.05, def 0.70): at **1.0** the charge always heals and the scoop
    always drops, which is CS040's rule at P9's faster loss rate; at **0.0** a charge always spares while
    a scoop exists. Turn "Overrides Applied" ON or the row reads but does not bite (FLAG-CS036-a).
  - ⛔ **`test-cs024-p6.js` §H TRAP 2 went red mid-phase exactly as predicted below** — it diffs
    `damageShip` against `HEAD`, so it fails from the first edit until the commit lands. It is green
    again on the committed tree. Still a moving-`HEAD` pin, still unfixed, and the next phase to touch
    that function will pay the same cost.
  - ⚠ **Nobody has played this.** Whether "you notice it going" reads as pressure rather than
    punishment, and whether the reserve teaches its own rule from one floater, are GATE C questions.

- **✅ P8 IS DONE.** Scoop levels 6–7, the flanking orbs and the level-1 floor shipped — see the P8 ledger
  entry and its "Working / verified" writeup. FORK-CS042-A landed as resolution (a) and is measured both
  ways. **P9 has since shipped §4.4/§4.5** — see its own entry above; the four notes below were P8's
  hand-off to it and all four were acted on.
  - ⛔ **P9's `bankSpareHullPct` must ship at 0.70 too** — P6 pinned that number as the changeset's one
    definition of "hurt" and its own test says so; if the gate moves one, it moves both.
  - ⛔ **P9 must rewrite `SCOOP_HITS_PER_LEVEL`'s comment in place, not delete it.** It still ends *"the
    scoop is now effectively sticky once earned. That's the intent, not a bug to 'fix.'"* — the very call
    §4.4 reverses. P8 left it untouched deliberately: the constant is P9's and reversing its stated intent
    while its number stays at 5 would have been a comment that contradicted the code.
  - ⚠ **P9's own arithmetic moved under it, and the spec's does not know.** §4.4 reasons from "roughly
    seven non-lethal hits in a full-health run" against a level-**5** cap ("a player now loses three or
    four scoop levels across a run instead of one"). The cap is 7 now, so at 2 hits/level seven hits cost
    three levels out of seven rather than three out of five. The mechanism is unchanged and the knob still
    means what it always meant; only §4.4's illustrative fraction is stale.
  - ⚠ **Nobody has flown this.** Whether the orbs read as a *capability* is exactly what GATE C is for,
    and levels 6–7 are only reachable after seven scoop pickups, so the gate needs a long run or the
    debug panel.
- **⛔ CLAUDE.md's own ceiling is close.** 49.5 KiB / 857 lines at P2's close, **543 bytes of
  headroom**. P1's entry recorded 848 lines, which was wrong — HEAD measured 853 before this phase;
  the byte figure was right, and the historical numbers are KiB, not KB. The next phase that adds a
  paragraph there should re-measure rather than trust a remembered figure, and the valve
  (`### Audio`, 5.3 KB) is still the first candidate if it fires.
- **P1 hazards for P3/P4, recorded so the prompts can account for them:** (1) `powertag()`'s three
  candidates all carry a **0.16 s internal offset** (the `bankspend()` idiom) so the tag lands after
  `powerup()`'s second note; if P3 places the call anywhere but immediately after `AudioSys.powerup()`,
  that offset is wrong. (2) The build's `applyPowerup()` speaks no `collect_guard`/`expire_guard` line
  (both branches exclude `guard`), so `POWERTAG_ROOT.guard` exists for §1.4's table and has no caller
  today — P3 should not invent one. (3) `haulsize(n)` clamps the tier to 1–4 from `floor(n/5)`, matching
  `dock_5/10/15/20`; it is called on the emptying pop with `game.deliveryCount`. (4) The copy-out's
  `CARGOFULL_FREQS` is a `let` in the lab only — paste it as a `const` with the other tuning constants.
- **P7's own prompt in `IMPLEMENTATION-PHASES-CS042.md` still reads "Registry 110 → 111" and
  "the baseline is 171/171"** — both were true when it was written and neither is now (114, and 176
  files). Left as-is: it is a spent prompt, and rewriting a phase doc after the phase ran is P11's
  archive pass, not a phase-local edit.
- **⛔ Doc debt for P11:** §6.3's tables ship two wrong numbers (§6.2's 12-node Engine cells, §6.3's
  Model C 4- and 12-node rows, both measured in P0). §6.3 and §6.7 are both superseded by §6.8 and
  should be marked as history rather than left reading as live proposals.
- **The GDD's front matter and §4 are no longer changelogs — keep them that way.** Both carried
  per-round status text that nobody's checklist reached, so both aged silently. Each now carries a ⛔
  rule saying it must not grow back. **The structural fix is that a closing phase already re-measures
  §0** — extending that same checklist to re-read the build stamp is the cheap way to stop this
  recurring, and is not yet done.
- ⛔ **`STATUS.md` is over its own ~400-line ceiling — 864 lines after P9, 771 after P8, 678 after P7,
  568 after P6, 502 after P5, and it was already 443 at P4's close.** Flagged rather than trimmed: the fix is the closing phase's roll into `log/CS042.md`,
  and deleting a carried-forward item to make room is not a phase-local call.
- `CS039-VOICE-WORKLIST.md` (written CS038 P7) still records which voice events most need line
  alternatives, for Paul's next `tools/voice-robot-lab.html` session — still unconsumed.
- A second, deeper telemetry capture on the v4 build (waves 10+) — see Known issues.
- The stale `% 15` comments and the stale playtest-ask knob names are each a one-line fix for whatever
  changeset next touches the file they live in.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade`/`levelEndGracePulseEnd` for the ship pulse, and
  `hunterPulseMin`/`Max`/`Grow`/`Shrink` for the heartbeat. ⛔ **The four Hunter-pulse names are
  stale** (retired to plain constants, CS038 P5) — see Known issues; ask about the heartbeat feel
  directly rather than by knob name until this is reworded.
- **Does the caption expiring mid-freeze read right?** With captions on, Dan's "Level N" caption ages
  during the frozen tail instead of holding, so it can vanish while the field is still stopped.
- **Does the dock apron read as pressure or as litter?** CS035 P2's lockout means a parked ship no
  longer cleans up around itself. Nobody has played a long session against that yet.

## Balance notes

- **`COMBO n/N`'s denominator is still unrepresented (from CS026)** since the HUD row was dropped.
- **The UFO difficulty chain goes fully flat past level 65 (CS024/CS025)** — junk saturates at L41,
  hunters at L33. Fix if wanted is a step-count increase, no mechanism change.
- **`DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are both first-pass and browser-unverified (CS023).**
- **Hunter Debris supply halved (CS034 P3), confirmed right-sized at a wave-12 playtest.** Not
  verified past wave 12.
- **G20 says the game is no longer too easy**; CS036's H1 says the level end reads as a deliberate
  beat. **CS037 (C+F together) rated 5/10.**
- **CS039 GATE T's measurement: Hunters carry the run, not delivery** (~56% of score, 65% of damage
  in the one analysed run). **CS040 removed `scoreRepairBonus` outright**, so score composition has
  shifted since — not yet re-run.
