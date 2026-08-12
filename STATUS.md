# Orbital Overhaul — STATUS
Version: 1.0.0.28 · Changeset: CS029 · Phase: P3 · Registry: 85 · Levers: 18

## Phase ledger — CS029

- P1 — renamed `asteroids-deluxe.html` -> `orbital-overhaul.html` (`git mv`); no behaviour change.
- P2 — ESC now opens the pause menu at game over; the game-over footer collapsed from two lines
  (a blinking 22px "play again" + a dim 14px "MENU: O" hint) to one `drawMenuHint` line.
- P3 — `tools/dock-float-lab.html`: the delivery-floater column lab, models A/B/C. Build untouched.

## Working / verified

- **P1's rename swept further than the plan's "22 git-history sites" estimate** — ~100 scratchpad
  test files also hardcode the *live* build path (`path.join(repoRoot, "asteroids-deluxe.html")`),
  which breaks the instant the file moves. All renamed; the 16 historical-SHA reads kept the legacy
  name and are SETTLED-marked; `_phase-ref.js`'s `SCOPE_BASE` now carries both names permanently
  (already-closed phases' own scope pins diff pre-rename ranges that legitimately list the old
  name). FLAG-CS029-a (the `test-cs024-p6b.js` pathspec spanning the rename) was run, not assumed —
  git's rename detection held, `-U0` hunk structure intact, 315/315 in that file. Full suite:
  111/111 passed, 0 failed, 0 skipped post-commit.
- **P2 — the game-over exit path.** §0.1's read confirmed: `MENU_ROOT_OVER`/`rootItems()`/
  `openPause()`/`closePause()` all already routed gameover correctly; nothing there needed a
  change. The one-line input guard now admits `game.state === "gameover"` alongside `"playing"`,
  carrying the standing `!game.entry` operand. The footer re-flow is the CS016 P2 move applied to
  the one screen that missed it: `drawMenuHint` gained a trailing optional `size` parameter
  (default `MENU_HINT_SIZE`), all 9 pre-existing call sites stay byte-identical, and the gameover
  screen's two retired lines are replaced by one call at `GAMEOVER_HINT_SIZE` (20 — a playtest
  knob, since this is the only on-screen affordance rather than a reminder under a visible menu).
  New test `test-cs029-p2.js` drives the real keydown listener and `draw()` through a recording
  ctx (22/22). Full suite: 112/112 passed, 0 failed, 0 skipped.

- **P3 — the float lab.** `tools/dock-float-lab.html` (scoop-lab conventions, `file://`, no deps):
  static dock, real offload cadence and point formula (`+50`…`+625` at 24), the two dock-anchored
  milestone floaters, a dock/ship anchor toggle with a drifting mock ship, and models A/B/C with
  the specced knobs, replay/pause/step and a run-minimum separation readout. Three things were
  **measured, not assumed**, and all three are inputs to the gate — see FLAG-CS029-c/d/e below.
  The readout became two numbers because the specced one (any two live floaters) is pinned near
  zero by a milestone crossing that no model can affect; the second isolates the delivery column,
  which is what actually distinguishes A/B/C. Verified headlessly by driving the lab's own `sim()`
  under stubs: A bottoms out at 10.7px, B holds `minGap` exactly at every cadence tried
  (0.02s/40px included), C keeps one `+` floater alive and ticks `+50`…`+8100`. Build untouched;
  suite 112/112, 0 failed, 0 skipped.

## Known issues

- 🚩 **FLAG-CS029-c (BLOCKING for P4) — §6.2's model-B rule does not have the property §4.3 claims
  for it.** "Born at the anchor unless the *previous* delivery floater is within `minGap`, else at
  `prevFloater.y - minGap`" places the new floater *above* the previous one, so the last-spawned is
  no longer the lowest; two spawns later the anchor test passes against that high floater and the
  column resets to the anchor with an older floater still inside it. Measured at the defaults, the
  column runs 13.3 / 33.3 / 34.7 / 54.7 px above the anchor — a **1.4px gap, worse than model A**.
  One reference cannot see it. The lab implements the smallest rule that does deliver the advertised
  property (`slotY()`: start at the anchor, walk the live column bottom-up, rise `minGap` above
  anything you would land inside) — still derived, no stored column-height counter, and it collapses
  to "born at the anchor" at a slow cadence, which is what the "UNLESS" clause exists for.
  **If Paul picks B, P4 implements `slotY()`, not §6.2's sentence.**

- 🚩 **FLAG-CS029-d — the recorded "160 × 0.05 = 8 px" is the ideal, not the shipped number.**
  `game.offloadTimer` is reset to a flat `DOCK_OFFLOAD_INTERVAL` and decremented by whole frames
  with no remainder carried, so the realised cadence is `ceil`-ed to frames — and 0.05 costs **four**
  frames at 60Hz, not three (`0.05 - 3/60` is +2.8e-18, not ≤ 0). True spacing in **world space** is
  160 × 4/60 = **10.67px**, not 8. ⚠ Do not read this as the balance note's "~10.7px on screen"
  below — that is 8px × the CSS letterbox scale, a different quantity that lands on the same number
  by coincidence. Both are true, and they compose: on-screen separation is 10.67 × the CSS scale.
  Under the 16px glyph either way, so the diagnosis is unchanged, but the arithmetic in the
  `DEBUG.deliveryFloatRise` ⛔ block (~L3399) is a frame short and P4 is rewriting that block
  anyway (§6.5).

- 🚩 **FLAG-CS029-e — the milestone floaters cross the dock anchor, and only `anchorFrac` fixes it.**
  `SALVAGE BONUS` / `MAX HAUL` are born at `dock.y - 22` with `FloatText`'s defaults, so they climb
  30 × 1.1 = 33px and top out at `dock.y - 55` — straight up through any anchor below that, in every
  model. Measured all-floaters minimum at `anchorFrac` 0.50 / 0.625 / 0.70 / 0.75 / 0.80: A 0.2 /
  3.2 / 9.8 / 10.7 / 10.7, B 0.3 / 5.2 / 11.8 / 16.2 / 20.0, C 0.0 / 1.0 / 7.6 / 12.0 / 16.4.
  Crossing stops above 0.625 (55/88); a clear glyph of air needs ~0.81 ((55+16)/88). **G2 is doing
  more work than the gate doc assumes** — it is not just taste, it is this collision.

- **(carried) `test-registry.js`'s FLAG-CS027-d — twelve suite files grep a comment-stripped copy of the source that's missing the same 80 lines `execSource()` fixed.** Latent, not live: audited, no assertion any of them makes currently falls in the deleted region. Becomes live the moment one does. One-line-per-file fix (`execSource()`); not urgent, bundle with an opportunistic migration.
- ~~**(carried) `tools/sat-art-lab.html` (FLAG-CS028-a) is not in the repo.**~~ **Stale — closed at P3.** It IS in the repo, added in two un-phased commits (`5457e57` / `be3af24`, both ancestors of HEAD). `SAT_ART`/`SAT_SCRAP` have an authoring instrument after all; nothing else about the CS028 note changes.
- **(carried) Piece-distinctness concern, deliberately unresolved.** Hubble's pieces 1/2 and Skylab's 0/2 share a polyline vertex-count signature; Juno's folded blade is a third member of that family. Paul's gate call (CS028): leave as is. Any real fix is new art authoring — its own changeset, not a routine edit.
- **(carried from CS026) Ten suite files still hard-fail, not skip, on a shallow clone** — measured: `git clone --depth 1` runs 101 files, 91 passing, 10 failing (`test-cs017-p6.js`, `test-cs019-p1.js`, `test-cs020-p1.js`, `test-cs020-p1b.js`, `test-cs023-p2.js`, `test-cs023-p3.js`, `test-cs024-p1.js`, `test-cs024-p2.js`, `test-cs024-p4.js`, `test-cs024-p6b.js`). Each reaches for a reference/parent commit and throws instead of skipping. Mechanical fix, same shape as the files already converted in CS026 P1/P2. See `log/CS026.md`.
- **(carried from CS026) The three `localStorage` keys (`afd_settings_v1`, `afd_achievements_v2`, `afd_scores_v1`) have never been round-tripped in a real browser** — one manual set-reload-confirm at a gate would close it; the failure mode if wrong is silent and total. See `log/CS026.md` §11 backlog.
- **(carried from CS023, dropped rather than resolved) Satellite-vs-satellite elastic bounce (CS023 P2) and mutual collision damage (CS023 P3) were never playtested.** `debrisBounce()` and the mutual-damage rule are live in the game today; no gate since has asked about them. See `log/CS023.md`.

## Open questions (blocking)

None.

## Next up

- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions** (`2560`/`1440`/`1920`/`1080`) instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies** (see `## Known issues`) could migrate to `execSource()` whenever one of them is next open for other reasons.
- **THE GATE (blocking P4) — G1 model, G2 `anchorFrac`, G3 `rise`/`life`, G4 `minGap`, G5 `DOCK_OFFLOAD_INTERVAL`, G6 `GAMEOVER_HINT_SIZE`.** Play `tools/dock-float-lab.html`; its footer emits the answers in constant form. Read FLAG-CS029-c/d/e first — c changes what P4 builds under B, e changes what G2 is *for*.

## Playtest asks (open only — answered ones move to the log)

None open.

## Balance notes
- **(carried from CS026) `COMBO n/N`'s denominator is still unrepresented** since CS026 P4 dropped the HUD row (FORK-CS026-F, accepted risk). Recorded so a future "the cargo cap is invisible" report is recognised as this, not a new bug.
- **(carried from CS026, now being acted on in CS029) The delivery floater column is tighter than before, by Paul's own choice.** Nominal 8px separation, ~10.7px on screen — but see FLAG-CS029-d: the world-space figure is itself 10.67px, so this note's on-screen number is a frame low. It did smear; P3 built the lab and P4 fixes it. The "`DOCK_OFFLOAD_INTERVAL` is the lever" instruction is superseded under models B and C, which dissolve the trade entirely.
- **(carried from CS024/CS025) The UFO difficulty chain goes fully flat past level 65** (FLAG-CS025-b) — junk saturates at L41, hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth on their drivers with nothing escalating underneath. Fix if wanted is a step-count increase, no mechanism change.
- **(carried from CS023) `DEBRIS_BOUNCE_RESTITUTION` (1.0) and `DEBRIS_BOUNCE_MIN` (40 px/s) are both first-pass and browser-unverified**, same status as `SHIELD_BOUNCE_RESTITUTION`/`MIN` at CS021 P1b. Measured consequence: a rail satellite sweeping into a parked free one throws it up to 511.5 px/s off the outer fast ring — nearly double the 255.7 px/s cap CS023 P4's drift derives from.
