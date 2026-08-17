# Orbital Overhaul — STATUS
Version: 1.0.0.35 · Changeset: CS036 · Phase: P1 · Registry: 106 · Levers: 18

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

## Working / verified

- Full suite on a full clone: **144 files, 141 passed, 3 failed, 0 skipped, 0 timed out** — the three
  failures are the standing pre-existing set (see Known issues), unchanged from the CS036 baseline's
  143/140/3. `node --check` on the extracted script passes.

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

- **NEW (P1) — a voice caption raised DURING the freeze holds until the freeze lifts.** The freeze runs
  `VoiceSys.update()` (so a parked critical can speak) but not `game.caption.life -= dt` (which lives in
  the frozen playing body), so a line drained mid-freeze captions and then sits at full alpha for the
  length of the hold. Unreachable today — nothing arms the freeze — and it cannot happen behind the
  celebration panel, whose freeze runs neither. **P2/P3 should decide** whether the caption clock joins
  the reduced sim; spec §0.3's table does not list it, so P1 left it stopped rather than widen scope.

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

- **CS035 — a wave cleared while the PREVIOUS level's banner is still live arms the grace early.** The
  banner-expiry one-shot fires on any crossing with `levelEndSafe` true and cannot tell the level-1
  banner it was written to exclude from a level-N banner that has simply not expired yet. Result:
  protection through the hold, none through the banner. Unreachable at the shipped 2.2 s
  `levelBannerTime` (a level-1 clear is ~39 kills), but that knob goes to 8 s from the debug panel.
  Narrowing the arm is a design call, so it was flagged rather than taken.

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

- **CS036 P2 — arm the freeze**: the wave-clear latch sets it, the "Level N Complete" announcement and
  its prompt draw, both input handlers take confirm/back immediately ahead of the `game.celebration`
  branch, `levelEndHold` retires (registry 106 → **105**) and the Perfect Wave bookkeeping moves to the
  arm. P1 left the primitive inert and tested; nothing else in the build reads it yet.

- **CS036 P3 — the freeze tail**: the unfreeze at `levelBanner.life <= levelBannerFade` with both
  degenerate cases (`fade >= time`, `time === 0`) degrading to "unfreeze immediately"; the alpha pulse
  restricted to the grace; the panel header reverted. ⛔ It also owns re-deriving CS035's
  banner-crossing edge (Known issues above) under the freeze — the answer is not known yet.

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

- **G9–G14 are still open, but three of the four knobs are about to change hands.** `levelEndHold`
  retires at P2; `levelEndGrace` / `levelEndFade` / `levelEndGracePulseEnd` stay at 3.00 / 0.25 / 0.08
  and are still unassessed — and the pulse they shape only runs across the grace from P3 on, so the old
  questions (does it read instantly as "invincible", is the 0.2 floor too faint to fly at) should be
  re-asked at the CS036 gate against the new sequence, not the CS035 one.

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
