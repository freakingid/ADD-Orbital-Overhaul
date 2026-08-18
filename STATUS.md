# Orbital Overhaul — STATUS
Version: 1.0.0.36 · Changeset: CS036 · Phase: P7 (closed) · Registry: 106 · Levers: 18

## Phase ledger — CS036

- P1 — the level-end freeze primitive, built and proved INERT. `game.levelEndFreeze` +
  `updateLevelEndFreeze(dt)`, a reduced sim above `update()`'s early-return; `tickLevelBanner(dt)`
  extracted so both paths share one banner countdown.

- P2 — the completion hold. The wave-clear latch arms the ceremony (`levelDone` + `resetMenuNav()`),
  `levelEndHold` RETIRED (registry 106 → 105), Perfect Wave and CS030 P5's fork moved to the arm and
  to `dismissLevelDone()`, `drawLevelDone()` added.

- P3 — the freeze TAIL, the pulse restriction, the panel header. The freeze survives the confirm and
  `nextWave()`, lifting when the "Level N+1" label starts fading; the pulse moves to the grace, the
  blink stays on `levelEndSafe`; `menuPanel()`'s `isWave` title ternary deleted; the caption clock
  runs inside the freeze; CS035's banner-crossing edge re-derived.

- P4 — the Hunter Satellite heartbeat punch. Four `def`s retuned (envelope 87/125 → 80/150, grow
  55 → 900 %/s, shrink 28 → 20 %/s) and `hunterPulseGrow`'s bound raised 300 → 5000 %/s. No new
  mechanism, no colour change, `LEVERS` still 18.

- P5 — `dockPingCooldown` (0.50 s, DELIVERY; registry 105 → **106**) rate-limits the dock push's
  `shieldPing()` only — the push is untouched and the feature is off at 0. FLAG-CS034-e closed by
  shortening `debrisBounceRestitution`'s label; id unchanged.

- P6 — suite triage. All three standing failures were **stale tests; the build is untouched**. Two
  share one cause (a weekly achievement unlocking in 20 weeks of 53); the third was a pin against the
  moving `HEAD`, not a fixed SHA. FLAG-CS031-c is the same defect as `test-f2` §g, fixed in the test.

- P7 — closing. Gate folded in with **zero `def` edits**, `GAME_VERSION` → **1.0.0.36** (seven live
  version pins re-pointed), GDD §2.20.1 rewritten plus §2.7/§2.19/§2.20/§3, `DIFFICULTY-LEVERS.md` and
  `CLAUDE.md` verified needing no edit, `log/CS036.md` written, both planning docs archived.

## Working / verified

- Full suite on a full clone: **148 files, 148 passed, 0 failed, 0 skipped, 0 timed out**;
  `node --check` passes. ⛔ **Zero skips AND zero failures — the first zero-failure closing phase since
  CS034.** `test-registry.js` confirms registry **106**, headers **10**, `LEVERS` **18**,
  `POWERUP_DROP_TYPES` **5**.

- The build's remaining `levelEndHold` mentions are deliberate tombstones (the registry comment, the
  wave-clear branch, `dismissLevelDone()`'s header). Nothing reads `DEBUG.levelEndHold`, and no
  registry row carries the id.

- Four new test files this changeset — `test-cs036-p1` (52 assertions), `-p2` (127), `-p3` (121),
  `-p4` (52), `-p5` (32) — with 8, 4, 12, 4 and 4 hand-mutated regressions confirmed to fail them
  respectively.

## Known issues

- **⛔ NEW (P7) — FLAG-CS036-a: a `def` retune does not reach any installation that has ever saved
  settings.** `saveSettings()` writes `debug: { ...debugShown }`, a full snapshot of **every** knob
  (`debugShown` is seeded for all 106 at boot), and `loadSettings()` re-applies every finite
  in-`[min,max]` stored value over the registry default, with `debugOverride` defaulting ON. Measured
  through the harness: a store carrying the CS035 gate's pulse values reloads at envelope 87/125,
  grow 55, shrink 28 — a 50.9 % grow/shrink ratio and a 2.05 s beat — where a fresh boot gives
  80/150, 900, 20 (2.2 %, 3.58 s). **This is what H10/H11 almost certainly measured.** ⛔ Before the
  next gate, set the debug panel's **"Overrides Applied" → OFF** or use **"Reset all debug knobs to
  defaults"**, then re-ask. Whether the full-snapshot save is itself wrong is a design call, not
  taken.

- **⛔ DEFERRED (H6, gate) — the level-end ship pulse "needs to go faster."** Paul: *"It is hard to
  notice the player ship is pulsing… going back and forth between a low intensity and high intensity
  in terms of brightness… like a ghost, and cannot be hit."* No number was returned, so nothing moved.
  The knobs already reach it: `levelEndFade` (`def` 0.25 s one-way → a 0.5 s period; `min` **0.05** →
  0.1 s, 10 Hz) and `levelEndGracePulseEnd` (`def` 0.08 → 0.16 s period; `min` **0.02** → 0.04 s,
  25 Hz). The alpha swing is already 1.0 → 0.2. A slider question wanting a number, not new code —
  and subject to FLAG-CS036-a above.

- **⛔ DEFERRED (H10/H11, gate) — "the punch just isn't there."** Paul asked for the grow leg to take
  ~20 % of the shrink leg; **P4's shipped defaults are at 2.2 %, exceeding the ask ~9×**. Not retuned:
  the ask is already met, and moving the `def`s again cannot change what a build reading stored values
  displays. Re-ask under FLAG-CS036-a's remedy. ⛔ **The colour question stays resolved AGAINST** —
  no `COLOR.satellite` change, `lerpColor()` stays deleted; reversed twice now.

- **A wave that spawns ZERO Garbage Satellites soft-locks the level (P2).** Unreachable in shipped
  play (`junkCount` floors at 3), reachable from the debug panel, whose `junkCountFloor`/`Ceil` both
  go to 0: the field is empty on the next frame and the `waveClearTimer === 0` latch cannot re-arm.
  Narrowing the arm is a design call the spec does not cover.

- **The two announcements can overprint (P3, cosmetic, debug-knobs-only).** A still-live "Level N"
  banner and "Level N Complete" draw at the same `levelBannerY`/`levelBannerSize`. Reachable only by
  raising `levelBannerTime` far enough that a wave clears under a live banner.

- **⛔ Two MORE moving-`HEAD` pins survive in `test-cs023-p3.js`, passing VACUOUSLY (P6).** `headSrc()`
  feeds the `debrisBounce` line count (~599) and the byte-strict `shieldDeflect`/`shieldBounce`
  compare (~641); on a clean tree both compare the file to itself and cannot fail. Each needs a SHA
  chosen and the intervening diffs named. The cure is written in the same file, twice.

- **⛔ Two unseeded-test flakes, measured (P6) and RE-MEASURED (P7).** `test-cs035-p3` §F at **6/120
  (~5 %)** at P6 and **3/60 (5 %)** re-measured at P7 — same rate, same message; `test-f6` §F at
  **2/120 (~1.7 %)**. Neither carries `installSeed`; that shared trait is the likely class. ⚠ P7's own
  closing runs caught them twice before landing a clean 148/148, so **a rerun is the standing way to
  tell either from a real regression** — at 5 % per run, roughly one full-suite run in twenty goes red
  for this reason alone.

- **CS035 — parking at the Recycle dock no longer cleans up, and that is a real behaviour change.**
  A parked ship cannot mop up loose Debris around it; a 60-second park leaves ~220 pieces where CS020
  recycled all 600 (`test-cs020-p1b` §I). Coalescence keeps running on that cloud, so a neglected dock
  apron can still breed a Hunter Satellite — arguably the intended pressure, but new, and no gate has
  asked about it directly.

- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame**, a `getItem` +
  `JSON.parse` per title-screen frame at 60 fps. Deliberate per CS032 §4.3 (a profile switch or delete
  changes the answer, so it can't be cached) — the build's first **unconditional** per-frame storage
  read. See `log/CS032.md`.

- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`**, not on `"Load
  Saved Game"`. `returnToTitleMenu()` hardcodes `MENU_TITLE.indexOf("Options")`, correct for its other
  callers. Changing it is a signature question, which is design, not wiring. See `log/CS032.md`.

- **`test-registry.js`'s `FLAG-CS027-d`** — twelve suite files grep a comment-stripped copy of the
  source missing the same 80 lines `execSource()` fixed. Latent, not live.

- **FLAG-CS027-c (opportunistic) — 8 test files hardcode world dimensions** instead of reading
  `worldDims(X)` from `_harness.js`. See `log/CS027.md`.

- **Piece-distinctness concern, deliberately unresolved (CS028).** Hubble's pieces 1/2 and Skylab's
  0/2 share a polyline vertex-count signature; Juno's folded blade is a third member. Paul's gate
  call: leave as is.

- **Thirteen suite files hard-fail, not skip, on a shallow clone** (measured CS034 P9).
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

- **CS036 is closed. No changeset is in flight.** The next one opens with a `PLANNED-FEATURES-CS037.md`
  / `IMPLEMENTATION-PHASES-CS037.md` pair; `STATUS.md` above is the whole of the current state.

- **The first thing any CS037 gate should do is clear the debug overrides** (FLAG-CS036-a). Every
  slider answer this changeset returned, and every one a future gate returns, is only as good as
  whether the build was reading its registry defaults at the time.

- **Delivery-ticker ship-anchor (deferred) — wants its own gate/playtest**, not a closing-phase guess:
  CS026 P6 tried it and CS029 measured it worse ("a ship-relative origin smears the delivery column as
  the ship drifts DURING a visit"). Declined four times now.

- **Deferred to `coinless-kit`, not this repo** — `game_version` in the board SELECT, a per-player
  query, and client-module support for both, ahead of a future GAME changeset rendering a Version
  column and a worldwide/just-me scope toggle. Shape recorded in `log/CS034.md`.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade` / `levelEndGracePulseEnd` for the ship pulse, and
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
