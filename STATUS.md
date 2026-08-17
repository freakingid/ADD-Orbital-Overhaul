# Orbital Overhaul — STATUS
Version: 1.0.0.34 · Changeset: CS035 · Phase: P2 · Registry: 92 · Levers: 18

## Phase ledger — CS035

- P1 — delivery ticker re-tune: applied a later dock-float-lab session's seven values as the shipped
  defaults, superseding CS034 P8's GATE A numbers — anchor frac 0.75→0.50, rise 200→150, size
  18→16/step 0.0→1.0 (per-piece growth live for the first time)/cap 36→48, hold 0.25→0.00, fade
  0.75→1.20. Deleted the "SALVAGE BONUS" (8-piece) and "MAX HAUL" (24-piece) floaters — the lab
  measured −15.7px ink overlap against the re-tuned ticker — keeping their powerup award,
  `maxChainVisit`, and `cargoFlash` side effects intact. FLAG-CS035-a (open, not this phase's to
  resolve): the 24-haul's text celebration is gone, carried instead by the ticker, the HUD cargo
  flash, and the `dock_24` voice line — gate asks whether that still lands. Eight older suite files
  that pinned CS034's now-superseded numbers or the deleted floaters were repointed in this commit,
  same convention as their own prior "REPOINTED BY" comments (test-cs012-p3, test-cs018-p8,
  test-cs020-p1, test-cs024-p6b, test-cs026-p4, test-cs026-p6, test-cs029-p4, test-p6).

- P2 — dock scoop lockout: the capture gate now leads with `!inRing`, so nothing can be hooked while
  the ship is inside the dock's neighbourhood ring, at any chain length including zero. A piece that
  reaches the capture region (base circle OR scoop mouth) instead has its velocity SET — never added —
  to the new `dockBounceSpeed` knob (DELIVERY, def 90, 20–300/10) directly away from the ship, with
  `AudioSys.shieldPing()` as the tell and the ship completely unaffected; `debrisBounce()` is
  deliberately not called. The magnet's pull is suppressed in the ring through `pulling` (the two
  budget spend sites still read the raw `magnet`, unchanged), so nothing churns against that push.
  That makes the incidental category **empty by construction**, so CS020's `towed: !inRing` tag, the
  `node.towed !== false` read and the whole incidental branch (flat `DOCK_BASE_SCORE`, its size-12
  floater, `AudioSys.deliver(1)`) are deleted — the actual fix for §0.2's LIFO queue jump, which was
  never a counter reset. `inRing` survives, hoisted above the garbage loop, still guarding the pickup
  gate and the `deliveryCount = 0` reset. Registry 91→92; no lever moved. Twenty suite files repointed
  in this commit, nineteen phase tests plus `test-registry.js`'s count.

## Working / verified

- Full suite on a full clone: **139 files, 137 passed, 2 pre-existing failures, 0 skipped** — the
  same two files (`test-f2`, `test-v36-death`) that were already red on this phase's parent.
- New `scratchpad/test-cs035-p2.js` drives the real pickup/push/offload paths: the lockout either side
  of the ring boundary (and exactly on it, which is outside), the push's exact `dockBounceSpeed`
  magnitude/direction and its no-accumulation-on-a-second-frame property, the ship taking no recoil or
  damage, the scoop mouth being covered too, the lockout at `chain.length === 0`, the magnet
  suppression with an outside-the-ring non-vacuity control, the knob's shape/section — and §0.2's bug
  asserted directly: a 24-piece haul delivered while loose pieces keep landing on the hull climbs
  1..24 with no gap and pays the escalating share on every pop.
- The nineteen repointed phase tests all keep their scenarios and invert what they assert (the park
  now pays 0 rather than a flat 30,000; a +39 capture is refused rather than tagged) — CS020's claim
  survives strictly strengthened, so no section was deleted.
- New `scratchpad/test-cs035-p1.js` drives the real dock-offload path: the anchor frac, all five
  registry rows' `def`/`min`/`max`/`step`, no SALVAGE/MAX HAUL floater at deliveries 8/24 while the
  powerup/`maxChainVisit`/`cargoFlash` side effects still fire, and the ticker's per-piece size
  formula (`min(48, 16 + 1.0 * (N-1))`).
- Registry at **92** (P2's `dockBounceSpeed`), `LEVERS` unmoved at **18**.

## Known issues

- **⛔ NEW — the GDD's shipped-behaviour prose for the towed/incidental split is now stale, and P2 did
  not sweep it.** `ORBITAL-OVERHAUL-GDD.md` §2.10 still documents `towed: !inRing`, the LIFO tagging
  rationale, the incidental's flat `DOCK_BASE_SCORE`/size-12 floater and "loitering at the dock to mop
  up stragglers is still worth doing" — all deleted or reversed by this phase. Left for the CS035
  closing phase's doc sweep, the same convention P1 followed (it moved seven `def`s and touched no
  GDD). Five paragraphs under "A delivery run is ONE EFFORT" plus the "incidental delivery is quieted"
  bullet are the affected text.
- **NEW — parking at the dock no longer cleans up, and that is a real behaviour change.** A parked
  ship cannot mop up the loose pieces around it any more; they stay in the field, pushed clear of the
  hull, bounded only by the CS024 P3 density ceiling. Measured in `test-cs020-p1b` §I: a 60-second
  magnet-style park leaves ~220 pieces in the field where CS020 recycled all 600. Coalescence keeps
  running on that cloud, so a neglected dock apron can still breed a Hunter — arguably the intended
  pressure (the dock is for delivering, not gathering), but it is new and nobody has played it yet.
- **NEW — `AudioSys.shieldPing()` fires once per pushed piece per frame.** With several pieces on the
  hull at once the tell stacks. No rate limit was added: §2.3 asked for the shipped ping and no new
  audio method, and a cooldown is a design call. Worth listening for at the gate.
- **NEW — the push's degenerate direction was a phase decision, not a spec line.** A piece resting
  exactly on the ship's centre has no ship→piece vector; the house `|| 0.0001` idiom would hand it a
  velocity of ZERO and pin it on the hull with coalescence still running. It falls back to the ship's
  own facing, so the magnitude is always `dockBounceSpeed`. Staged in `test-cs035-p2` §B.

- **Delivery-ticker origin — Gate B asked for a ship-relative anchor; not built.** CS026 P6 already
  tried this and CS029 reverted it, measured: "a ship-relative origin smears the delivery column as
  the ship drifts DURING a visit." Paul confirmed keeping the dock anchor this session rather than
  re-attempt a change already tried and found worse, deferring a real ship-anchor attempt to a
  future changeset with its own gate/playtest. See `log/CS034.md` (P9).
- **⛔ FLAG-CS032-a — `drawTitleMenu()` calls `SaveSlots.count()` every frame**, a
  `localStorage.getItem` + `JSON.parse` per title-screen frame at 60fps. Deliberate, per spec
  §4.3 (a profile switch or delete changes the answer, so it can't be cached) — the build's first
  **unconditional** per-frame storage read. If it ever measures, the fix is a cache invalidated at
  the three sites that can change the answer, not a moved question. See `log/CS032.md`.
- **Back from the slots screen in LOAD mode lands the title cursor on `"Options"`, not on
  `"Load Saved Game"`.** `returnToTitleMenu()` hardcodes `MENU_TITLE.indexOf("Options")`, correct
  for its other callers, slightly off here. Shipped in P3, player-reachable since P4. Not fixed —
  changing it is a `returnToTitleMenu()` signature question, which is design, not wiring. Save mode
  is unaffected. See `log/CS032.md`.
- **FLAG-CS031-c — `test-f2.js` flakes ~3% of runs** (CS030's celebration-panel `game.celebration`
  leaking across sections in `resetShip()`; pre-existing, not this changeset's). One-line fix
  identified: `game.celebration = null;` in `resetShip()`. 29 suite files reach a death/gameover
  and never mention `game.celebration` — the class is latent beyond `test-f2`.
- **`test-registry.js`'s `FLAG-CS027-d`** — twelve suite files grep a comment-stripped copy of the
  source missing the same 80 lines `execSource()` fixed. Latent, not live.
- **Piece-distinctness concern, deliberately unresolved (CS028).** Hubble's pieces 1/2 and
  Skylab's 0/2 share a polyline vertex-count signature; Juno's folded blade is a third member.
  Paul's gate call: leave as is.
- **Thirteen suite files hard-fail, not skip, on a shallow clone (measured fresh, CS034 P9;
  corrects a stale "ten" carried since CS026).** `test-cs017-p6`, `test-cs019-p1`, `test-cs020-p1`,
  `test-cs020-p1b`, `test-cs023-p2`, `test-cs023-p3`, `test-cs024-p1`, `test-cs024-p2`,
  `test-cs024-p4`, `test-cs024-p6b`, `test-cs024-p6f`, `test-cs026-p1`, `test-cs029-p1`. Mechanical
  fix, same shape as CS026 P1/P2's conversions. See `log/CS026.md`, `log/CS034.md`.
- **Satellite-vs-satellite elastic bounce and mutual collision damage were never playtested (from
  CS023).** Both are live in the game today; no gate since has asked about them. See `log/CS023.md`.
- **P6's `blankLegacyStores()` calls `Achievements.save()` unguarded** — the same latent hole P6's
  own achievement reset had to design around. Harmless today: only reachable from profile delete
  (title-only, where neither `debugRun` nor `resumedRun` can be set). A future changeset that makes
  the profiles or achievements screen reachable mid-run must fix both, not just the reset. See
  `log/CS034.md`.
- **NEW — `test-f2.js`'s §g assertion ("shield deflection consumed energy") fails deterministically**,
  on every run, on this phase's own parent commit — distinct from the documented FLAG-CS031-c
  celebration flake living in the same file. Not investigated; discovered incidentally while running
  the suite for CS035 P1, out of that phase's scope to fix.
- **NEW — `test-v36-death.js` fails on 3 assertions (`Achievements.save` call-count around
  `killShip`)**, also present on this phase's own parent commit and previously undocumented. Not
  investigated; same as above, out of CS035 P1's scope.

## Open questions (blocking)

None.

## Next up

- **CS035 P2–P6 are next**, per `IMPLEMENTATION-PHASES-CS035.md`: dock scoop lockout, level-end
  invincibility, Hunter volatility (age/heartbeat, then damage sources), and a powerup rebalance.
- **Delivery-ticker ship-anchor (Gate B, deferred) — wants its own gate/playtest**, not a
  closing-phase guess, given CS029 already measured the naive version as worse. See "Known issues."
- **Celebration header treatment (Gate B, B8) — reads clearly enough to ship, but the abrupt
  full-stop-of-action when the panel opens still feels jarring.** Paul flagged wanting a different
  treatment "later" — not a defect, a future design idea. See `log/CS034.md`.
- **FLAG-CS034-e — `debrisBounceRestitution`'s canonical-vocabulary label still doesn't fit the
  debug panel's 32-char column** ("Garbage Satellite bounce restitution" is 36 chars; shipped as the
  unchanged "Satellite bounce restitution"). Needs either a shorter canonical-reading label or a
  column-width change — a gate question or a small dedicated phase, not folded into this closing
  phase. See `log/CS034.md` (P2).
- **Deferred to `coinless-kit`, not this repo** — `game_version` in the board SELECT, a per-player
  query, and client-module support for both, ahead of a future GAME changeset that renders a Version
  column and a worldwide/just-me scope toggle. Full shape recorded in `log/CS034.md`.
- **FLAG-CS027-c (opportunistic, non-blocking) — 8 test files hardcode world dimensions**
  instead of reading `worldDims(X)` from `_harness.js`. See `log/CS027.md`.
- **FLAG-CS027-d (opportunistic, non-blocking) — 12 suite files' stale comment-stripped copies**
  could migrate to `execSource()` whenever one of them is next open for other reasons.

## Playtest asks (open only — answered ones move to the log)

- **FLAG-CS035-b (from spec §2.6) — is the ring boundary FELT, or merely suffered?** A player who
  parks just outside the ring to grab one more piece still loses their run to the towed-hook reset,
  and the lockout makes that boundary matter more than it used to. There is no visual tell for the
  ring. If the answer is "suffered", the follow-up is a dock-ring render — deliberately out of scope
  here. Also worth checking at the same time: whether 90 px/s reads as a firm shove or a nudge, and
  whether losing dock-apron cleanup (Known issues) is felt as pressure or as litter.

- **FLAG-CS035-a — does a Super Mega Delivery (24-haul) still land without its text celebration?**
  After P1, it announces itself with: a size-39+ ticker showing a four-figure number, the HUD cargo
  flash, the `dock_24` voice line, and roughly thirty powerups erupting from the dock. Assessed as
  sufficient; the fix if not is a re-introduced "MAX HAUL" at a y-offset clear of the ticker, not a
  restore in place. See `PLANNED-FEATURES-CS035.md` §1.3.

## Balance notes

- **`COMBO n/N`'s denominator is still unrepresented (from CS026)** since the HUD row was dropped
  (accepted risk). Recorded so a future "the cargo cap is invisible" report is recognised as this.
- **The UFO difficulty chain goes fully flat past level 65 (from CS024/CS025)** — junk saturates
  at L41, hunters at L33, so past 65 all three UFO sub-chains are pure sawtooth with nothing
  escalating underneath. Fix if wanted is a step-count increase, no mechanism change.
- **`DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are both first-pass and browser-unverified (from CS023),**
  same status as the shield-bounce equivalents. Measured consequence: a rail satellite sweeping
  into a parked free one throws it up to 511.5 px/s off the outer fast ring — nearly double the
  255.7 px/s cap CS023 P4's drift derives from.
- **Hunter Debris supply halved (from CS034 P3), confirmed right-sized at a wave-12 playtest (Gate
  B, B5–B7).** `HUNTER_GARBAGE` large/medium tiers dropped to 0; a full lineage now yields 9 pieces,
  down from 18. Delivery-combo achievements (`heavy_hauler` at 12, `max_haul` at `CARGO_CAP_MAX` 24)
  stayed reachable at that wave. Not verified past wave 12 — a much later, hunter-lineage-saturated
  wave could still read differently; no further action unless it's reported.
