# Orbital Overhaul — STATUS
Version: 1.0.0.29 · Changeset: CS030 · Phase: P5 · Registry: 87 · Levers: 18

## Phase ledger — CS030

- P1 — the achievement unlock collector: `game.pendingAch` (flushed bucket, `{ id, name, desc,
  tierIdx, pool }` per unlock) + `game.celebration` (`null`, reserved for the panel a later phase
  builds). Fed from `onUnlock()`, the single unlock choke point — not gated on `game.debugRun`,
  not filtered by `game.wave` (PLANNED-FEATURES-CS030.md §0.3/§0.4). Data only; no UI/draw/input.

- P2 — `tools/emblem-lab.html`, the eight-emblem authoring lab. Six tier rungs are ONE family:
  the same delta mark inside the SAME r=0.66 circle, and the ladder is how much of that circle
  exists (120° cradle / 240° / 300° / closed / +4 points / points bound in an outer facet ring).
  Two off-family pool marks — an hourglass (weekly) and a stamped plate (untiered lifetime),
  both rectilinear, no ring, no delta. Live blocks for shipping size, the ladder, pool-vs-tier
  and 2x, plus a measured stats table and an `ACH_EMBLEM` copy-out. **P3 pastes that export in
  verbatim** — the lab ships first and stays the source of truth (contrast `SAT_ART`, §2.3).
  Lab only; `orbital-overhaul.html` untouched, no test added.

- P3 — pasted the lab's `ACH_EMBLEM` export verbatim near `TIER_NAMES`/`TIER_COLOR`, and added
  `drawEmblem(cx, cy, r, tierIdx, pool)` beside `drawPoly()`. Resolves `typeof tierIdx === "number"`
  (never truthiness) so Bronze (tierIdx 0) routes correctly, never to the untiered emblem. Added the
  two `DEBUG_VARS` rows (`celebrationScrollStep`, `celebrationEmblemSize`) under a new CELEBRATION
  header. Registry moved **85 -> 87**, section headers **9 -> 10** — measured via the harness, not
  predicted, and `test-registry.js`'s `COUNTS` updated to match. No panel yet, no draw call site
  wired — data + one helper only, per §4.2.
  - Eighteen older suite files pin literal/derived registry snapshots (section-header lists, "GLOBAL
    is the last header", "the registry grows by exactly N", parent-diff LATER-phase allowlists). Every
    one of the 18 was repointed to name CS030 P3's two new rows explicitly (the same "later phase
    named, never wildcarded" idiom CS025 P1/P2/P5 already used) rather than weakened or deleted. See
    `test-cs018-p4.js`, `test-cs018-p6.js`, `test-cs024-p4/p5/p6/p6b/p6c.js`, `test-cs025-p1/p2/p5.js`,
    `test-cs026-p2/p3/p5/p6.js`, `test-cs027-p2/p6.js`, `test-cs029-p4.js`, `test-cs030-p1.js`.

- P4 — the celebration panel itself, wired at **game over only** (§4.3/§4.4). `drawCelebration()` +
  `celebrationMaxScroll()` / `celebrationScroll()` / `dismissCelebration()` / `drawCelebrationRow()`,
  behind a `CELEB_*` geometry block. Called from `draw()`'s tail: **outside `drawHUD()`** (H cannot
  hide it) and **before `drawMenu()`**, so draw order mirrors input priority. The gameover draw block
  is byte-unchanged — *pinned* against the parent, not merely intended. Opens at the
  `"dying"`→`"gameover"` seam when `game.pendingAch.length`: flush the bucket, `resetMenuNav()`, one
  `AudioSys.achievement()` (FORK-CS030-F's cheapest default; still open at the P6 gate). Guards in
  BOTH input handlers, each immediately before its own `game.entry` block — that ordering is the whole
  of FORK-CS030-C's "panel first"; entry's arming is untouched. Registry 87 / levers 18, unmoved.
  - `celebrationMaxScroll()` deliberately does **not** transcribe `achMaxScroll()`'s arithmetic. That
    formula measures content height from row 0's *baseline* and so falls its own clip headroom short —
    invisible at the viewer's 16px, not invisible here, where 44px of emblem headroom cut the bottom
    row's emblem in half at full scroll. Measured from the clip top instead: shared-ceiling role kept,
    arithmetic corrected, and pinned in the test off the build's own consts.
  - Two older files **repointed, not weakened**: `test-v36-death.js` §E and `test-v36-scores.js`'s
    `freshDeath()` now also clear `game.celebration` — the same "later phase named" treatment §E
    already gave `game.entry` when v3.6 P6 put initials entry in front of the same confirm.

- P5 — the panel's **second call site, at level end** (§4.4, FORK-CS030-A = both). In the
  `waveClearTimer > 2.5` branch, after the perfect-wave block: flush the bucket into
  `game.celebration = { items, scroll: 0, resume: "wave" }` and **`return` without calling
  `nextWave()`** — so `game.levelBanner` and `VoiceSys.sayLevel()`, which both fire from inside it,
  announce *after* the celebration. `dismissCelebration()` gained the one branch (`resume === "wave"`
  → `nextWave()`); the game-over site stamps `resume: null`. Every other P4 function is byte-identical
  to the parent, pinned. `update()`'s early-return gained `|| game.celebration` — **not** `game.paused`
  (that would satisfy `menuActive()`); the level-end panel is therefore a genuine new pause of live
  play, which the P6 gate (G7/G8) re-checks. Registry 87 / levers 18, unmoved.
  - **Hazard the prompt didn't name, found and handled:** `killShip()` flips the state to `"dying"`
    **mid-frame** and `update()` runs on to the wave-clear branch, so dying on the exact crossing
    frame could open a level-end panel whose dismissal would fire `nextWave()` at game over. The open
    is gated `game.state === "playing" && game.pendingAch.length`; that frame falls through to the
    plain `nextWave()`, byte-identical to pre-CS030. Pinned in the test with a real mid-frame death.
  - **Four older files repointed, not weakened:** `test-f9.js` (C6, two C9 loops), `test-cs024-p3.js`
    §B, `test-cs026-p2.js` §K, `test-cs026-p3.js` §H drive multi-wave runs that now stall at the first
    clear on a real unlock. Each empties `game.pendingAch` per driven frame — the majority
    empty-bucket path, the same shape as the `saucerTimer = 1e9` controls they already carry. The
    unlocks still fire; only the panel's copy is dropped, and none of the four reads the bucket.

## Working / verified

- Full suite on a full clone: **117 files, 117 passed, 0 failed, 0 skipped, 0 timed out.**
- **P5 mutation-checked, not just asserted:** dropping the freeze term fails 11 assertions, dropping
  the deferral `return` 11, dropping `dismissCelebration()`'s `nextWave()` 24, and dropping the
  mid-frame-death guard 4. The empty-bucket path is traced **frame-by-frame against the P4 parent
  build** (same seed, ten frames across the clear) and is identical — the common case is untouched.
- The freeze is read two independent ways: nothing moved (ship, particles, `waveTime`, `gameTime`,
  `Achievements.lifetime.playTime`), and **zero entity `update()` bodies ran** in 90 frames.
  `game.paused`/`menuActive()` stay false throughout, pad Start included.
- **Both input guards mutation-checked**, not just asserted: deleting the gamepad half fails 15
  assertions, deleting the keyboard half 21, and perturbing one number inside the gameover draw block
  trips the parent byte-identity pin. The panel's layout was measured off a recording ctx (longest
  real row renders to x=837 inside a panel ending at 1050; four rows fit with no scroll).
- **Emblem legibility measured at r=32, not assumed** (CS028 P1 precedent). All eight clear:
  worst unit norm **0.962** (bar 1.000), tightest gap between two features meant to read apart
  **5.1px** (bar 4px; welded pairs like a spike foot on its ring counted separately, not flagged).
  Measurement changed two designs: Platinum/Diamond's points were straight rays at the diagonals
  and read as an **X cancelling the ring out** — now chevrons with feet welded to the 12-gon's
  edge; and the weekly hourglass's cap bars sat 1.9px off the body — body pulled in to clear at
  5.1px. Both recorded in the lab's own header so a later pass can't undo them blind.
- Registry confirmed at **85**, `LEVERS` at **18** — P1 added no knob and moved no lever.
- `test-cs026-p3.js`'s TRAP 5 byte-identity pin (startGame()'s executable source vs. its CS026 P3
  parent) narrowed a second time, to also exclude P1's two new reset lines
  (`game.pendingAch = []`, `game.celebration = null`) — same treatment CS029 P4 already used for
  `game.deliveryTicker = null`.

## Known issues

- **FLAG-CS030-c (new, P5) — two resume details for the G7 look-call.** (1) The level-end panel fires
  the same single `AudioSys.achievement()` on open as the game-over one, now *over the live gameplay
  music*, which is un-ducked (the panel is deliberately not a menu). (2) The keydown handler records
  the raw key into `keys{}` **before** the panel's guard, and `↑` is the thrust binding — scrolling
  up is inert while frozen, but a key (or pad A) still HELD at dismissal resumes as thrust/fire.
  That is what holding it means, and it is unchanged input semantics; recorded because G7 asks
  specifically whether the resume is fair.

- **FLAG-CS030-b (P4, now live at level end too) — while the panel is up, the gamepad's Start is SWALLOWED, and dismissal
  is silent.** Start is inert rather than dismissing, mirroring the initials-entry block's own
  "nothing interrupts this" convention (confirm/back dismiss; the footer hint names both). Dismissal
  plays no `AudioSys.ui()` blip because the phase prompt sanctioned exactly one audio touch (the
  fanfare on open). Both are defensible at game over and both get louder at level end, where P5 has
  the panel freezing live play — worth a look-call at the P6 gate rather than a silent choice.

- **FLAG-CS030-a (new, P2) — `COLOR.ach` (`#ffcf5a`) is byte-identical to `TIER_COLOR[2]`
  (Gold).** The two pool emblems and the Gold tier emblem therefore ship in the *same colour*,
  so shape carries the entire "this is not a tier rung" distinction. Answered in the lab's
  pool-vs-tier block (all three drawn in `#ffcf5a` side by side) and it reads — but it is a
  one-channel tell, so it belongs in the P6 gate's look-call, not just in a measurement.

- **(carried) `test-registry.js`'s FLAG-CS027-d — twelve suite files grep a comment-stripped copy
  of the source that's missing the same 80 lines `execSource()` fixed.** Latent, not live:
  audited, no assertion any of them makes currently falls in the deleted region. Becomes live the
  moment one does. One-line-per-file fix (`execSource()`); not urgent, bundle with an
  opportunistic migration.
- **(carried) Piece-distinctness concern, deliberately unresolved.** Hubble's pieces 1/2 and
  Skylab's 0/2 share a polyline vertex-count signature; Juno's folded blade is a third member of
  that family. Paul's gate call (CS028): leave as is. Any real fix is new art authoring — its own
  changeset, not a routine edit.
- **(carried from CS026) Ten suite files still hard-fail, not skip, on a shallow clone** —
  measured: `git clone --depth 1` runs 101 files, 91 passing, 10 failing (`test-cs017-p6.js`,
  `test-cs019-p1.js`, `test-cs020-p1.js`, `test-cs020-p1b.js`, `test-cs023-p2.js`,
  `test-cs023-p3.js`, `test-cs024-p1.js`, `test-cs024-p2.js`, `test-cs024-p4.js`,
  `test-cs024-p6b.js`). Each reaches for a reference/parent commit and throws instead of skipping.
  Mechanical fix, same shape as the files already converted in CS026 P1/P2. See `log/CS026.md`.
- **(carried from CS026) The three `localStorage` keys (`afd_settings_v1`, `afd_achievements_v2`,
  `afd_scores_v1`) have never been round-tripped in a real browser** — one manual set-reload-confirm
  at a gate would close it; the failure mode if wrong is silent and total. See `log/CS026.md` §11
  backlog.
- **(carried from CS023, dropped rather than resolved) Satellite-vs-satellite elastic bounce
  (CS023 P2) and mutual collision damage (CS023 P3) were never playtested.** `debrisBounce()` and
  the mutual-damage rule are live in the game today; no gate since has asked about them. See
  `log/CS023.md`.
- **(carried, applied not resolved) FLAG-CS029-e — the milestone floaters can still touch the
  dock anchor at the picked G2.** `SALVAGE BONUS` / `MAX HAUL` climb from `dock.y - 22` on
  `FloatText`'s defaults and top out at `dock.y - 55`. At the gate's G2 = 0.50, the lab measured
  model C's own all-floaters minimum separation at **0.0px** — zero clearance, not a crossing, but
  no air either. Paul picked 0.50 anyway; not re-litigated at the gate. Recorded so a future
  "SALVAGE BONUS looks like it's touching the ticker" report is recognised as this, not a new
  regression.

## Open questions (blocking)

None.

## Next up

- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions**
  (`2560`/`1440`/`1920`/`1080`) instead of reading `worldDims(X)` from `_harness.js`. See
  `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies**
  (see `## Known issues`) could migrate to `execSource()` whenever one of them is next open for
  other reasons.
- CS030 in flight (the achievement celebration panel). P1 built the collector, P2 the emblem lab,
  P3 pasted `ACH_EMBLEM` + `drawEmblem()` and the two registry rows, P4 wired the panel at game over,
  P5 (this session) added the level-end call site + the freeze. Remaining, per
  `IMPLEMENTATION-PHASES-CS030.md`: **the P6 playtest gate (⛔ BLOCKING, no code — G1–G10, numbers
  where a slider is involved)**, then the P7 close. G7/G8 are the ones this phase was built to be
  judged by: is the resume after a level-end pause fair, and does the per-level cadence earn it.

## Playtest asks (open only — answered ones move to the log)

None open.

## Balance notes

- **(carried from CS026) `COMBO n/N`'s denominator is still unrepresented** since CS026 P4 dropped
  the HUD row (FORK-CS026-F, accepted risk). Recorded so a future "the cargo cap is invisible"
  report is recognised as this, not a new bug.
- **(carried from CS024/CS025) The UFO difficulty chain goes fully flat past level 65**
  (FLAG-CS025-b) — junk saturates at L41, hunters at L33, so past 65 all three UFO sub-chains are
  pure sawtooth on their drivers with nothing escalating underneath. Fix if wanted is a step-count
  increase, no mechanism change.
- **(carried from CS023) `DEBRIS_BOUNCE_RESTITUTION` (1.0) and `DEBRIS_BOUNCE_MIN` (40 px/s) are
  both first-pass and browser-unverified**, same status as `SHIELD_BOUNCE_RESTITUTION`/`MIN` at
  CS021 P1b. Measured consequence: a rail satellite sweeping into a parked free one throws it up to
  511.5 px/s off the outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives
  from.
