# Orbital Overhaul — STATUS
Version: 1.0.0.35 · Changeset: CS036 · Phase: P4 · Registry: 105 · Levers: 18

## Phase ledger — CS036

- P1 — the level-end freeze primitive, built and proved INERT. New `game.levelEndFreeze`, declared in
  the game literal and reset in `resetRun()` only — deliberately not `nextWave()`, which runs inside
  the freeze; added to that function's standing ⛔ note beside the other three. New
  `updateLevelEndFreeze(dt)`, a reduced sim on the `updateDeath()` model, branching **before** the
  general early-return: it runs `AudioSys.thrust(false)`, the level-banner tick and `VoiceSys.update()`,
  and deliberately not `Achievements.evaluate()` or the heartbeat (the celebration panel's own freeze
  stops both, and the wave-clear `return`'s comment says why). The banner tick moved verbatim into a new
  `tickLevelBanner(dt)` called from both paths — without it the freeze is a hard hang. Nothing sets the
  flag; P2 arms it. Registry unmoved at 106.

- P2 — the level-end completion hold. The wave-clear `waveClearTimer === 0` latch now ARMS the ceremony
  beside `levelEndSafe`: `levelEndFreeze = true`, a new `game.levelDone = { text, age }` ("Level N
  Complete", N = the completed wave), and `resetMenuNav()`. `levelEndHold` is RETIRED with its threshold
  (registry **106 → 105**, `COUNTS` updated; no shim, by rule). The Perfect Wave block (`perfectWaves++`
  / `noScratchWave3` / `flawlessLateWave`) MOVED to the arm — behaviourally identical, since
  `levelEndSafe` is set on the line above it and gates every damage site. The panel-or-`nextWave()` fork
  moved WHOLE into new `dismissLevelDone()`, reached by confirm/back from BOTH input handlers, each
  branch sitting immediately before its `game.celebration` branch and gated by the shared
  `levelDoneActive()`. New `drawLevelDone()` — a third sibling of `drawHUD()`, fading in over
  `levelBannerFade` and holding, with `LEVEL_DONE_HINT = "ENTER / A  continue"`. `_harness.js` gained
  additive `listeners`/`pads` hooks so the real keydown listener and real gamepad can be driven without
  a second sandbox.

- P3 — the freeze TAIL, the pulse restriction, the panel header. The freeze now survives
  `dismissLevelDone()` (that line is deleted) and the whole of `nextWave()`, and lifts inside
  `updateLevelEndFreeze()` at `levelBanner.life <= DEBUG.levelBannerFade` — written as the `else` of the
  announcement's `age` tick, so `game.levelDone` is what tells the HOLD from the TAIL. A plain `<=`, no
  crossing one-shot: `fade >= time` and `time === 0` both thaw on the first tail frame instead of hanging.
  The alpha pulse moved to `game.levelEndGraceT > 0` at both sites (accumulator + `Ship.draw()`'s new
  `pulsing`), while the blink suppression stays on `levelEndSafe` — two questions, two reads; both knobs
  retained, registry unmoved at 105. `levelEndSafe` keeps its full extent (C2), recorded in a ⛔ comment at
  its declaration so the redundancy is not read as an oversight. `menuPanel()`'s `isWave` ternary is gone
  (`isWave` itself stays — the sub-line still forks). ⚠ **P1's caption question, handed here by P2, is
  answered YES**: `game.caption.life -= dt` joins the reduced sim, because the freeze keeps the
  announcement channel running and `sayLevel()` now fires inside it. The pause and the panel still hold
  the caption — untouched.

## Working / verified

- Full suite on a full clone: **147 files, 143 passed, 3 failed, 0 skipped, 0 timed out** — the three
  failures are the standing pre-existing set (see Known issues), unchanged from P3's 143/3.
  `node --check` on the extracted script passes.

- New `scratchpad/test-cs036-p4.js` (52 assertions): the raised `hunterPulseGrow` bound and all four
  retuned defs read from the registry itself; re-runs of CS035 P4's own don't-mutate (§G) and
  radius-unmoved (§F) invariants against the new, much faster grow rate; `pulseScale` non-vacuously
  reaches and reverses at both `hunterPulseMin`/`Max` across a long run; steady-state grow/shrink legs
  are measured by detecting the exact frame `pulseUp` flips (not by epsilon-comparing `pulseScale` to a
  target, which drifts out of sync with the clamp's own float arithmetic) — the grow leg lands in ≤6
  frames and the shrink leg is ≥30× longer; and cranking `hunterPulseGrow` to its raised bound clamps
  straight to the ceiling on the very frame volatility begins. Four mutations (grow def reverted, shrink
  def reverted, bound left at 300, envelope left at 87/125) were each confirmed to fail it.
  `test-cs035-p4.js` §A repointed to the new bound/defs, naming this phase.

- New `scratchpad/test-cs036-p3.js` (121 assertions, seeded): the confirm reaches `nextWave()` and 30
  frames later the newly spawned field has not moved a pixel, on the panel fork as well as the inline one;
  the tail lifts on exactly the frame `levelBanner.life` crosses `levelBannerFade` (asserted from both
  sides, with the ship pinned still throughout and moving on the next frame); all three degenerate knob
  pairs (`fade >= time`, `time === 0`, both at 0) thaw on the FIRST tail frame and a second full ceremony
  still runs after them; the pulse is 0 across the hold, the tail and the banner, starts at the grace and
  ramps `dt/levelEndFade` → `dt/levelEndGracePulseEnd` with every frame's advance larger than the last;
  the alpha is read off `ctx.stroke()` through the real `Ship.draw()` at four phases with and without the
  grace; the blink is still skipped while `levelEndSafe` with no grace running; `levelEndSafe` is true at
  the clear, 5 s into the hold, under the panel, across the tail and the banner, and closes on the frame
  `levelEndGraceT` hits exactly 0; and both panels render "ACHIEVEMENTS UNLOCKED". **Twelve mutations of
  the shipped code** (the unfreeze deleted, ungated, made a crossing one-shot, moved above the banner
  tick; each pulse condition reverted; the blink coupled to it; the restore mis-guarded; the dismissal's
  clear re-added; the header ternary restored; a damage gate narrowed; the caption tick deleted and added
  to the pause path) were each confirmed to fail it.

- **Seven suite files repointed, all named in-commit.** `test-cs036-p1` stages the freeze the way the game
  arms it (flag **and** announcement — the bare flag now reads as a tail past its crossing and thaws), and
  its writer-set pin swaps the dismissal's line for the tail's. `test-cs036-p2` §D/§E flip to their mirror
  image: the confirm ends the announcement, not the freeze. `test-cs035-p3` §A pins a hand-seeded phase
  instead of an accumulating one, and §I arms the grace before measuring the pulse at all. `test-cs034-p5`
  §A is rewritten as F2's mirror image — the header reverted, the sub-line's fork surviving.
  `test-cs030-p5` §B takes the new header, §D's parent trace and §E's resume lift the tail by hand (§E
  first pinning that the ceremony's freeze outlives the panel). `test-cs024-p3` and `test-cs026-p3` drive
  runs that clear the field on a fixed cadence, so both lift the freeze at the confirm.

- P4 — the Hunter heartbeat punch (spec §2). No new mechanism: CS035 P4's asymmetric grow/shrink/clamp/
  flip is unchanged, `this.radius`/`this.shape`/`this.inner` untouched, `LEVERS` stays 18. Four `def`s
  retuned toward a harder punch and a slower settle — envelope `hunterPulseMin`/`Max` widens 87/125 →
  80/150 (38 → 70 points), `hunterPulseGrow` 55 → 900 %/s, `hunterPulseShrink` 28 → 20 %/s. New cycle:
  ~0.08 s out, ~3.5 s back, ~3.58 s a beat (was ~2.05 s). `hunterPulseGrow`'s `max` bound — the binding
  constraint spec §2 named — raised 300 → 5000 %/s, chosen so the raised bound sweeps the new envelope
  in under one 60 fps frame (70/5000 = 0.014 s < 1/60 s), genuinely instantaneous rather than just
  faster. `hunterPulseMax`'s own bound (200) and `hunterVolatileAge` (60) are untouched — nothing in the
  retune argued for moving either. **⛔ G18's colour ask stays reversed** — `COLOR.satellite` unchanged,
  `lerpColor()` stays deleted; the punch is motion-only, per Paul's explicit re-decision this session.
  `DIFFICULTY-LEVERS.md`'s not-a-lever row and GDD §2's volatility bullet both take the new numbers.

- New `scratchpad/test-cs036-p2.js` (127 assertions, seeded) drives the real `update()`, the real
  keydown listener and the real `handleGamepadMenu()`: a real bullet kills the last size-1 Garbage
  Satellite and the field is frozen with the announcement seeded **in that same frame**; 20 s of frames
  later the wave has not advanced and the ship has not moved a pixel (only `levelDone.age` ticks);
  ENTER/ESC and pad A/B each end it, reaching `nextWave()` with an empty bucket and the panel with a
  banked one; an `e.repeat` keydown, a held pad button across the arm, fire and the pause key all do
  nothing; the Perfect Wave bookkeeping fires once per clear at the arm with `game.wave` reading the
  completed wave, and not at all when damage was taken; a fresh `startGame()` is unfrozen for 120
  frames; the announcement's alpha ramps 0 → ½ → 1 and is still 1 thirty seconds later (no fade-out),
  draws with the HUD hidden, and never draws paused or at gameover; and the knob is gone from
  `DEBUG_ENTRIES`/`DEBUG`/`debugShown`, with a save file carrying `debug.levelEndHold` loading fine and
  orphaning it.

- **Sixteen suite files repointed, all named in-commit.** Five registry-delta pins (`test-cs027-p2/-p6`,
  `test-cs029-p4`, `test-cs030-p1`, `test-cs026-p5`) and two list pins (`test-cs024-p6b/-p6c`) take a
  −1. `test-cs026-p3`'s TRAP 5 gains `game.levelDone` by name. The rest are the freeze's fallout: a
  test that empties `game.debris` for quiet now clears a wave and stops the world, so nine files either
  park `waveClearTimer` far below zero (CS035 P3's own suppression, from `test-f2`/`test-f5`) or drive
  the confirm. `test-cs035-p3` §B is rewritten as the retired knob's mirror image and its `arm()` lifts
  the freeze by hand so the damage gates are not measured against a stopped field; `test-cs030-p5`'s
  `clearFrame()` clears *and* confirms, §A finds the fork in its new home, and §D's parent trace still
  matches byte-for-byte on seven fields with `waveClearTimer` traced separately as the one legitimate
  divergence. `test-cs036-p1` §H's inertness pin flips to its mirror image (the writers are the
  ceremony's). `test-cs025-p4` §A's `git diff HEAD` pin moved onto CS025 P4's own commit via
  `_phase-ref.js` — it could not survive any later phase editing the file it watches.

- New `scratchpad/test-cs036-p1.js` (52 assertions, seeded) drives the real `update()` with the flag set
  by hand: a Hunter Satellite, a Garbage Satellite, a saucer, a bullet and a loose piece of Debris all
  byte-identical across 120 frozen frames; the ship neither moves, rotates, recharges nor fires with
  rotate/thrust/fire held; a stretched chain does not settle a single px; a Hunter on the hull deals no
  damage and takes none; `levelBanner.life` ticks exactly one `dt` per frame in **both** paths and
  reaches 0; a parked critical voice line still drains; `Achievements.evaluate()` and the heartbeat are
  pinned as running **zero** times; and every one of those is paired with an unfrozen frame that does
  the opposite. Eight mutations of the shipped code (branch deleted, each of the three calls dropped,
  the two stops re-added, a double-tick, `nextWave()` clearing the flag, `resetRun()` forgetting it)
  were each confirmed to fail it.

- `test-cs026-p3.js`'s TRAP 5 run-reset pin repointed for the one new reset line, by name in
  `DROPPED_LINES` — the same narrowing every prior changeset made to it, so any *other* edit to
  `resetRun()` still fails the trap.

## Known issues

- **⛔ RESOLVED (P3) — the caption clock now runs during the freeze.** P1 raised it, P2 declined it and
  handed the call to P3; P3's answer is **yes**, one line in `updateLevelEndFreeze()`. What decided it is
  visible only from here: `nextWave()` fires INSIDE the freeze, so `VoiceSys.sayLevel()` raises a caption
  at the head of the tail on **every** level transition, and the level banner it is the twin of (same
  call, same string) is ticking down beside it — a stopped caption clock would hold that line at full
  alpha for the whole 1.7 s tail while its own audio, on the audio clock, finished seconds earlier. The
  freeze stops the SIM and deliberately keeps the ANNOUNCEMENT CHANNEL running; a caption is that
  channel's visual half. ⛔ **The pause and the celebration panel still hold the caption** (CS011 P2's
  rule, untouched) — they run no announcement channel at all. Pinned both ways in `test-cs036-p3` §H.
  It is one line if Paul wants it back out.

- **NEW (P2) — a wave that spawns ZERO Garbage Satellites now soft-locks the level.** Unreachable in
  shipped play (`junkCount` floors at 3), reachable from the debug panel, whose `junkCountFloor`/`Ceil`
  knobs both go to 0: `nextWave()` spawns nothing, the field is empty on the next frame, and the
  `waveClearTimer === 0` latch cannot re-arm (the timer is still counting from the previous clear), so
  no further ceremony fires and the level never ends. The shipped build advanced a wave every
  `levelEndHold` seconds instead — equally degenerate, differently. Flagged, not fixed: narrowing the
  arm condition is a design call the spec does not cover.

- **⛔ RESOLVED BY SPEC, not by code — the level-end window (CS035 P3) "appears to do nothing in play."**
  `PLANNED-FEATURES-CS036.md` §0.1: the window *runs*; what it does not do is announce itself, because
  CS035's FORK-L resolved to "the player retains full control throughout." G9–G14 stay unanswered and
  the four knobs stay untuned, but there is no defect to chase and no environment to establish. CS036's
  ceremony (P1–P3) is the answer. ⛔ Not to be written up as a bug fix.

- **⛔ CS035 — G18 asked for a red Hunter while volatile; RESOLVED AGAINST by CS036's spec.**
  `PLANNED-FEATURES-CS036.md` §2 records Paul reversing that answer at the CS036 planning session:
  **no colour change**, `lerpColor()` and a hazard red stay deleted, and the punch comes from the
  heartbeat's own asymmetry instead (CS036 P4). Kept here only so the CS035 gate answer is not read as
  still-outstanding.

- **CS035 — Debris sometimes not bouncing away at the dock (G5's note).** Paul: "Sometimes when player
  ship is in the dock, and hits a piece of debris, the debris is not bouncing away, which causes
  numerous rapid collisions between ship and debris, until the player actually flies the ship out of
  the way." `dockBounceSpeed` came back at the shipped 90, so nothing was retuned. The push's
  magnitude, direction, set-not-add and no-accumulation properties are pinned in `test-cs035-p2` §B and
  pass. The "numerous rapid collisions" reading is consistent with the ping issue directly below.

- **CS035 — `AudioSys.shieldPing()` fires once per pushed piece per frame.** With several pieces on the
  hull the tell stacks. No rate limit was added: spec §2.3 asked for the shipped ping and no new audio
  method, and a cooldown is a design call.

- **⛔ RE-DERIVED (P3), and the CS035 flag's symptom is GONE — what is left is a knob inequality.** The
  old flag read: "a wave cleared while the PREVIOUS level's banner is still live arms the grace early →
  protection through the hold, none through the banner." Measured under the freeze, in four staged
  scenarios, it now goes three ways:
  - **The old banner expires during the hold.** The one-shot still fires and still arms the grace early
    — but `levelEndGraceT` only counts down in `update()`'s playing body, which the freeze replaces, so
    it is **parked at its full value** for the rest of the hold and the whole tail. It then ticks for
    exactly `levelBannerFade` seconds (the live frames between the unfreeze and the new banner's own
    expiry) before that crossing **re-arms it to full**. Measured: armed at t=0.98, still 3.000 at the
    unfreeze at t=11.53, re-armed 3.000 at t=12.03, closed at t=15.05 — i.e. exactly `levelEndGrace`
    after the new banner expired, which is the intended sequence. **Nothing is lost.**
  - **The player confirms before the old banner expires.** `nextWave()` reassigns `game.levelBanner`
    wholesale, so the premature crossing never happens at all. The case simply does not occur.
  - **The residue: `levelEndGrace <= levelBannerFade`.** Only then can the parked grace run out inside
    that fade window, and the crossing that would re-arm it is refused (the one-shot reads `levelEndSafe`,
    now false). Measured at grace 0.25 / fade 1.0: protection closes 0.7 s into the banner and there is no
    post-banner grace. Both are debug-panel knobs; shipped is 3.0 vs 0.5, a 6× margin.
  It is also **harder to reach than it was**: the clear must land inside the previous banner's life, and
  the first 1.7 s of every banner is now frozen, so only its last `levelBannerFade` seconds are live play.
  Not fixed — narrowing the arm is the same design call CS035 declined, and the shipped knobs are nowhere
  near the inequality.

- **NEW (P3, cosmetic, debug-knobs-only) — the two announcements can overprint.** In the case above the
  still-live "Level N" banner and "Level N Complete" draw at the same `levelBannerY` and
  `levelBannerSize`, on top of each other, for the rest of the hold. Reachable only by raising
  `levelBannerTime` far enough that a wave clears under a live banner. Not fixed: which one yields is a
  design call the spec does not cover.

- **CS035 — parking at the dock no longer cleans up, and that is a real behaviour change.** A parked
  ship cannot mop up the loose pieces around it any more; they stay in the field, pushed clear of the
  hull, bounded only by the CS024 P3 density ceiling. Measured in `test-cs020-p1b` §I: a 60-second
  magnet-style park leaves ~220 pieces where CS020 recycled all 600. Coalescence keeps running on that
  cloud, so a neglected dock apron can still breed a Hunter — arguably the intended pressure, but new,
  and G6/G7 did not ask about it directly.

- **CS035 — `test-cs035-p3.js` flaked ~1-in-5 runs during P3–P6** and did not reproduce across repeated
  runs at P7. Carried forward unresolved rather than declared fixed; it is not seed-related (P3 adds no
  `installSeed`).

- **Three pre-existing suite failures, none this changeset's.** `test-cs023-p3.js` (a TRAP 3 pin
  against a fixed historical SHA); `test-f2.js` (§g "shield deflection consumed energy" fails
  deterministically, distinct from FLAG-CS031-c's celebration flake living in the same file);
  `test-v36-death.js` (3 `Achievements.save` call-count assertions around `killShip`). All three are
  present on CS035's own baseline `42cecae` and were not investigated.

- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame**, a
  `localStorage.getItem` + `JSON.parse` per title-screen frame at 60 fps. Deliberate per CS032 §4.3 (a
  profile switch or delete changes the answer, so it can't be cached) — the build's first
  **unconditional** per-frame storage read. If it ever measures, the fix is a cache invalidated at the
  three sites that can change the answer. See `log/CS032.md`.

- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`**, not on `"Load
  Saved Game"`. `returnToTitleMenu()` hardcodes `MENU_TITLE.indexOf("Options")`, correct for its other
  callers. Changing it is a signature question, which is design, not wiring. See `log/CS032.md`.

- **FLAG-CS031-c — `test-f2.js` flakes ~3% of runs** (CS030's celebration-panel `game.celebration`
  leaking across sections in `resetShip()`). One-line fix identified: `game.celebration = null;` in
  `resetShip()`. 29 suite files reach a death/gameover and never mention `game.celebration`.

- **`test-registry.js`'s `FLAG-CS027-d`** — twelve suite files grep a comment-stripped copy of the
  source missing the same 80 lines `execSource()` fixed. Latent, not live.

- **Piece-distinctness concern, deliberately unresolved (CS028).** Hubble's pieces 1/2 and Skylab's
  0/2 share a polyline vertex-count signature; Juno's folded blade is a third member. Paul's gate call:
  leave as is.

- **Thirteen suite files hard-fail, not skip, on a shallow clone** (measured fresh, CS034 P9).
  `test-cs017-p6`, `test-cs019-p1`, `test-cs020-p1`, `test-cs020-p1b`, `test-cs023-p2`,
  `test-cs023-p3`, `test-cs024-p1`, `test-cs024-p2`, `test-cs024-p4`, `test-cs024-p6b`,
  `test-cs024-p6f`, `test-cs026-p1`, `test-cs029-p1`. Mechanical fix, same shape as CS026 P1/P2's
  conversions.

- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (CS023).**
  Both are live in the game today; no gate since has asked about them.

- **`blankLegacyStores()` calls `Achievements.save()` unguarded (CS034 P6)** — harmless today, only
  reachable from profile delete (title-only). A future changeset that makes the profiles or
  achievements screen reachable mid-run must fix both it and the achievement reset.

## Open questions (blocking)

None.

## Next up

- **CS036 P5 — dock ping cooldown + FLAG-CS034-e**, registry 105 → **106**. Then P6 (suite triage). ⛔
  The ceremony is complete as of P3, and the heartbeat punch is complete as of P4; neither lands
  anything further.

- **P7's doc sweep — five GDD passages now describe a build that no longer exists.** None is a code
  defect; the GDD is §2 = shipped only, so all five are the sweep's. The build's own remaining
  `levelEndHold` mentions are deliberate tombstones (the registry comment, the wave-clear branch,
  `dismissLevelDone()`'s header) and are not misses.
  - `ORBITAL-OVERHAUL-GDD.md` §2.7 (twice): the next wave starts `DEBUG.levelEndHold` after the field is
    clear. It starts when the player confirms; the knob is retired.
  - §2.20's "Two headers, one panel (CS034 P5)": the level-end title is `"LEVEL N COMPLETE"`. Reverted by
    P3 (FORK-F → F2) — one header, `"ACHIEVEMENTS UNLOCKED"`; only the sub-line still forks.
  - §2.20.1's "The sequence": step 2 is a `levelEndHold` wait, "the player keeps full control
    throughout", steps 2/4/5 are ordinary gameplay frames, "Total at the defaults: **10.2 s**". All four
    clauses are gone — the field freezes at the clear, step 2 is player-paced and untimed, and the total
    has no fixed value any more.
  - §2.20.1's "The tell": the pulse "running continuously for the whole window". P3 confined it to the
    grace (FORK-D → D1); both knobs are retained and still shape that ramp.
  - §2.20.1's closing "⚠ Known edge": superseded outright by the re-derivation in Known issues above.

- **Delivery-ticker ship-anchor (Gate B, deferred) — wants its own gate/playtest**, not a
  closing-phase guess: CS026 P6 tried it and CS029 measured it worse ("a ship-relative origin smears
  the delivery column as the ship drifts DURING a visit"). Declined a third time at CS034 P9.

- **Celebration header treatment (CS034 Gate B, B8)** — reads clearly enough to ship, but the abrupt
  full-stop-of-action when the panel opens still feels jarring. A future design idea, not a defect.

- **FLAG-CS034-e — `debrisBounceRestitution`'s canonical-vocabulary label still doesn't fit the debug
  panel's 32-char column** ("Garbage Satellite bounce restitution" is 36). Needs a shorter label or a
  column-width change.

- **Deferred to `coinless-kit`, not this repo** — `game_version` in the board SELECT, a per-player
  query, and client-module support for both, ahead of a future GAME changeset rendering a Version
  column and a worldwide/just-me scope toggle. Shape recorded in `log/CS034.md`.

- **FLAG-CS027-c (opportunistic) — 8 test files hardcode world dimensions** instead of reading
  `worldDims(X)` from `_harness.js`. See `log/CS027.md`.

- **FLAG-CS027-d (opportunistic) — 12 suite files' stale comment-stripped copies** could migrate to
  `execSource()` whenever one is next open for other reasons.

## Playtest asks (open only — answered ones move to the log)

- **G9–G14: `levelEndHold` is gone as of P2, so G9 is void.** `levelEndGrace` / `levelEndFade` /
  `levelEndGracePulseEnd` stay at 3.00 / 0.25 / 0.08 and are still unassessed — and the pulse they shape
  only runs across the grace from P3 on, so the old questions (does it read instantly as "invincible",
  is the 0.2 floor too faint to fly at) should be re-asked at the CS036 gate against the new sequence,
  not the CS035 one. §8's H6/H10/H11 are how they come back; ⛔ do not resurrect G9–G14 themselves.

- **H4 and H6 are P3's, and both are about the hand-back to live play.** H4: the freeze lifts 1.7 s into
  the 2.2 s "Level N+1" label, so the last 0.5 s of that label is live play with the field already moving
  — does that read as a hand-back, or as the label overstaying? (The knobs to answer with are
  `levelBannerTime`/`levelBannerFade`, and the answer moves the unfreeze with them.) H6: with the pulse
  now confined to the 3 s grace, is "you are still safe, and it is running out" still legible — or does
  the pulse now arrive so late that it reads as a new event rather than a tail?

- **New, P3's, and worth one look: does the caption expiring mid-freeze read right?** With captions on,
  Dan's "Level N" caption now ages during the frozen tail instead of holding — so it can vanish while the
  field is still stopped. Argued from the freeze's own contract (Known issues above) and one line to
  revert either way.

- **H2 and H3 are P2's, and both need a controller as well as a keyboard.** H2 (can a held fire button
  skip the announcement?) is argued structurally and pinned headlessly in `test-cs036-p2.js` §F — the
  keydown that fired the killing shot lands before the arm, auto-repeat carries `e.repeat`, `gpPressed()`
  is a rising edge, and fire is neither `confirm` nor `back` on either device. It has never been tried in
  a hand. H3 is the wording of `LEVEL_DONE_HINT` ("ENTER / A  continue"): it names the two bindings that
  work and omits ESC / B, which also work.

- **Does the dock apron read as pressure or as litter?** CS035 P2's lockout means a parked ship no longer
  cleans up around itself. Nobody has played a long session against that yet, and coalescence still
  runs on the cloud that accumulates.

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

- **G20 says the game is no longer too easy.** CS035's answer to that complaint was §4's Hunter
  volatility (a passively-drifting large now becomes three homing mediums without the player choosing
  it), and G19 says a late-wave saucer pass through aged larges is not too much — assessed at
  `hunterVolatileAge` 60, the gate's own number, not P4's shipped 30.
