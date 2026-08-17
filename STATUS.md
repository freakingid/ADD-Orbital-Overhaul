# Orbital Overhaul — STATUS
Version: 1.0.0.35 · Changeset: CS035 · Phase: P7 (closed) · Registry: 106 · Levers: 18

## Phase ledger — CS035

- P1 — delivery ticker re-tune: a later dock-float-lab session's seven values shipped as the new
  defaults, superseding CS034 P8's GATE A numbers; `sizeStep` 0.0→1.0 turns per-piece growth on for the
  first time. The "SALVAGE BONUS" and "MAX HAUL" floaters deleted (−15.7 px measured ink overlap),
  every side effect kept.

- P2 — dock scoop lockout: nothing can be hooked inside the dock's neighbourhood ring, at any chain
  length; a piece reaching the capture region is pushed out at `dockBounceSpeed` (new knob, def 90).
  That empties the incidental category by construction, so the `towed` tag and the whole flat-pay
  branch were deleted — the real fix for the LIFO queue-jump stall. Registry 91→92.

- P3 — level-end invincibility: `game.levelEndSafe` spans wave clear → `levelEndHold` → celebration
  panel → `nextWave()` → banner → grace. Four gate sites; the two chain blocks are **guarded, not
  absorbed**. Tell is an accelerating alpha pulse replacing the hit-stun blink. Registry 92→96.

- P4 — Hunter volatility clock and heartbeat: age from construction, every tier; `volatile()` is
  `size === 3 && age >= hunterVolatileAge`; draw-only pulse on a fresh vertex array. Five HUNTER
  knobs, none a lever. Registry 96→101.

- P5 — Hunter volatility damage sources: a volatile large dies to another volatile large, a hostile
  bullet, or a saucer body — all `destroyHunter(h, false)`, 3-way split unchanged. The hostile-bullet
  arm is a sibling of the `levelEndSafe`-guarded chain block, deliberately not under it.

- P6 — powerup rebalance: `POWERUP_DROP_WEIGHTS` ×10 with `guard`'s entry a placeholder overwritten by
  `guardDropWeight()` (three CHAIN GUARD knobs, 4/8/40, driven by unguarded chain severs); `guard` out
  of the Super Mega Delivery guaranteed set (6→5) and back into the sweep pool explicitly;
  `sweepPowerupCap` 24 and `dockPowerupSpeed` 180 replace two frozen consts. Registry 101→106.

- P7 — closing: gate folded in (three `def` edits — `hunterVolatileAge` 30→60, `hunterPulseMin` 92→87,
  `hunterPulseMax` 115→125; fourteen answers matched shipped values and are recorded as no-ops; two
  design asks deferred, below). `GAME_VERSION` 1.0.0.34→1.0.0.35, seven live pins re-pointed and
  `test-cs034-p9.js`'s phase-local pin flipped to its mirror. GDD §2.5/§2.7/§2.10/§2.14/§2.14.2 swept
  and a new §2.20.1 written for the level-end window; §3.1's pass order updated;
  `DIFFICULTY-LEVERS.md` and `CLAUDE.md` corrected. `log/CS035.md` written, both planning docs
  archived.

## Working / verified

- Full suite on a full clone: **143 files, 140 passed, 3 failed, 0 skipped, 0 timed out** — identical
  to the pre-P7 baseline on `ffd4e73`. Zero skips, as a closing phase requires. The three failures are
  pre-existing and untouched by this changeset's diff (see Known issues).

- Counts verified live off the built game, not read off the source: registry **106**, section headers
  **10**, `LEVERS` **18**, `POWERUP_DROP_TYPES` **5**, `GAME_VERSION` `"1.0.0.35"`, and the three
  retuned knobs reading 60 / 87 / 125. `node --check` on the extracted script passes.

- Six new phase tests ship with the changeset (`test-cs035-p1` … `p6`), each driving the real code:
  the delivery ticker's size formula and the absent milestone floaters; the lockout either side of the
  ring boundary (and exactly on it, which is outside) plus §0.2's stall asserted directly as a 1..24
  climb with no gap; the level-end window's hold, grace, four gate sites and alpha pulse read off real
  `Ship.draw()`; the volatility clock's boundary, the clamp's non-vacuity, and the don't-mutate
  invariant on `this.shape`/`this.inner`; the three new damage sources with every no-credit case
  checking score, `hunterLineageKills`, `largeHunterKills` and `Achievements.lifetime.hunterKills`
  together; and the guard pity curve, the ×10 weights, and the shrunk SMD.

- No `towed` reference or incidental branch survives in the build except deliberate tombstones and
  towed-*mass* (a different quantity) — grepped, not assumed.

## Known issues

- **⛔ NEW, UNRESOLVED — Paul reports the level-end window (P3) appears to do nothing in play.** From
  the gate: "The levelEndHold did not seem to do anything. When the level ends, for some reason we are
  immediately given the Achievements screen. It seems like the levelEndGrace items are not in effect,
  either. I don't really see any difference visibly during gameplay at level end / Achievement panel
  display / Level start." G9–G14 were therefore not answered. **Not reproducible headlessly and not
  explained.** The shipped code was re-read against spec §3 line for line and matches; `test-cs035-p3`
  (112 assertions through the real `update()`/`Ship.draw()`) passes on this commit, including that
  nothing happens at 2.6 s, the wave advances at 5.0 s, a retuned 1.0 s hold moves the seam, and ship
  alpha is 1.0 at phase 0 / 0.2 at phase 1. **Next session should establish the environment first** —
  whether the browser was serving a cached `orbital-overhaul.html`, and what `DEBUG.levelEndHold` and
  `game.levelEndSafe` actually read in DevTools at a live level end — before touching any code. No fix
  was attempted in the closing phase.

- **⛔ NEW — G18 asks for a red Hunter while volatile; DEFERRED, not built.** The heartbeat does not
  read as "about to go off" on its own. A colour change is exactly what `PLANNED-FEATURES-CS035.md` §6
  excluded ("No Hunter colour change for volatility. Motion is the tell."), so it is a design reversal
  and belongs in a plan doc, not a closing phase. `hunterVolatileAge` 30→60 is the only part of that
  answer applied.

- **NEW — Debris sometimes not bouncing away at the dock (G5's note).** Paul: "Sometimes when player
  ship is in the dock, and hits a piece of debris, the debris is not bouncing away, which causes
  numerous rapid collisions between ship and debris, until the player actually flies the ship out of
  the way." `dockBounceSpeed` came back at the shipped 90, so nothing was retuned. The push's
  magnitude, direction, set-not-add and no-accumulation properties are pinned in `test-cs035-p2` §B and
  pass. The "numerous rapid collisions" reading is consistent with the ping issue directly below.

- **NEW — `AudioSys.shieldPing()` fires once per pushed piece per frame.** With several pieces on the
  hull the tell stacks. No rate limit was added: spec §2.3 asked for the shipped ping and no new audio
  method, and a cooldown is a design call.

- **NEW — a wave cleared while the PREVIOUS level's banner is still live arms the grace early.** The
  banner-expiry one-shot fires on any crossing with `levelEndSafe` true and cannot tell the level-1
  banner it was written to exclude from a level-N banner that has simply not expired yet. Result:
  protection through the hold, none through the banner. Unreachable at the shipped 2.2 s
  `levelBannerTime` (a level-1 clear is ~39 kills), but that knob goes to 8 s from the debug panel.
  Narrowing the arm is a design call, so it was flagged rather than taken.

- **NEW — parking at the dock no longer cleans up, and that is a real behaviour change.** A parked
  ship cannot mop up the loose pieces around it any more; they stay in the field, pushed clear of the
  hull, bounded only by the CS024 P3 density ceiling. Measured in `test-cs020-p1b` §I: a 60-second
  magnet-style park leaves ~220 pieces where CS020 recycled all 600. Coalescence keeps running on that
  cloud, so a neglected dock apron can still breed a Hunter — arguably the intended pressure, but new,
  and G6/G7 did not ask about it directly.

- **NEW — `test-cs035-p3.js` flaked ~1-in-5 runs during P3–P6** and did not reproduce across repeated
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

- **The level-end window's non-appearance is the first thing to settle** — it blocks G9–G14, which
  means four shipped knobs have never been tuned by anyone. See the first known issue for what to
  check before touching code.

- **A volatile-Hunter colour treatment (G18)** wants its own plan doc — spec §6 excluded it and the
  gate reversed that.

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

- **G9–G14 are still open** — `levelEndHold` / `levelEndGrace` / `levelEndFade` /
  `levelEndGracePulseEnd` are shipped at 5.00 / 3.00 / 0.25 / 0.08 and have never been assessed,
  because the window did not appear to be running. Also unanswered: whether the alpha pulse reads
  instantly as "invincible" and distinctly from the hit-stun blink, and whether the 0.2 alpha floor is
  too faint to fly at.

- **Does the dock apron read as pressure or as litter?** P2's lockout means a parked ship no longer
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
