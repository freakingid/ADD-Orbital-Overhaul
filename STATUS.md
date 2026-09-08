# Orbital Overhaul — STATUS
Version: 1.0.0.40 · Changeset: CS042 · Phase: P3 · Registry: 110 · Levers: 18
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

## Working / verified

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

- **⛔ CS042 P2 found two divergences between `PLANNED-FEATURES-CS042.md` §3 and the build. P5 must
  not paste §3.3's table as-is.** (1) **§3.3 lists the GAME OVER stack as beat 4, after the panel.
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

- **⛔ §6.8 "one mass, one force" PROPOSED (2026-09-08), superseding §6.7 and §6.3's three models.**
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

- **⛔ GATE A's handling question came back NULL (2026-09-08). `CARGO_COAST` has no value and
  FLAG-CS042-k stays open.** Paul's third findings block was the shipped defaults with every protocol
  step unrecorded, and his own note was that he is *"not feeling super confident about how this testing
  went"* and that this may return in a later changeset. ⛔ **Read that as a verdict on the instrument.**
  A mock ship on an empty field has no enemies, no dock, no chain to lose and nothing to be late for,
  which is most of what makes a haul feel heavy — inertia may not be judgeable outside a real run.
  **Do not send him back to the lab for a fourth pass without changing something structural.**
  Spec §6.7 now carries the two ways forward: ship the knob at 0.0 (byte-equivalent to today) and make
  the value a GATE C playtest question, or defer §6.7 to its own changeset and cut P7 to §6.5 alone.
  **P7 is blocked on that choice; nothing else in CS042 is blocked at all.**

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
- **P4 is the next session** — the remaining nine sounds (§1.2/§1.4), **Sonnet 5, Medium**; its
  copy-paste prompt is in `IMPLEMENTATION-PHASES-CS042.md`. It copies P3's trigger-site placement
  nine times, adds `POWERTAG_ROOT` beside `POWERUP_COLOR`, and is the one phase that **replaces** a
  shipped sound (`shieldPing()` → `guardblock()` in `breakChain()`'s guard branch). ⛔ **Read
  `CS042-GATE-A.md`'s "What this means for P3 and P4" note first** — `powertag()`'s 0.16 s offset,
  `POWERTAG_ROOT.guard`'s absent caller and the `health` exclusion are all recorded there.
  **Nothing in CS042 is blocked.**
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
- **P7 has been rewritten for §6.8** (`IMPLEMENTATION-PHASES-CS042.md`), including its copy-paste
  prompt. It no longer asks for a lab block, no longer builds §6.3's A/B/C, and now carries a
  mandatory GDD §3.4 re-validation as Part 3. ⚠ **Two open flags belong to Paul, not to a phase:**
  FLAG-CS042-l (`CARGO_UNIT_MASS`'s value — 0.07 reproduces today) and FLAG-CS042-m (§6.8 penalises
  rotation by construction, reversing his GATE A "no" on `CARGO_TURN`). Both are answerable at GATE C
  from the debug panel.
- **What he can already tune in-game today, before any of this ships:** the debug panel's POWERUPS
  section has **Engine towed-mass multiplier** (0–1, step 0.05, def 0.5, lower is stronger) and
  **Engine fuel per pickup** (0.5–60 s, def 10). ⛔ **Nothing exposes the chain's own weight** — that
  is what P7 adds. ⛔ **Turn "Overrides Applied" on or the rows read but do not bite**, and clear the
  overrides first (FLAG-CS036-a) if a clean baseline matters.
- **⛔ Doc debt for P11:** §6.3's tables ship two wrong numbers (§6.2's 12-node Engine cells, §6.3's
  Model C 4- and 12-node rows, both measured in P0). §6.3 and §6.7 are both superseded by §6.8 and
  should be marked as history rather than left reading as live proposals.
- **The GDD's front matter and §4 are no longer changelogs — keep them that way.** Both carried
  per-round status text that nobody's checklist reached, so both aged silently. Each now carries a ⛔
  rule saying it must not grow back. **The structural fix is that a closing phase already re-measures
  §0** — extending that same checklist to re-read the build stamp is the cheap way to stop this
  recurring, and is not yet done.
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
