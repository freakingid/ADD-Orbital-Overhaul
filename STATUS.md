# Orbital Overhaul — STATUS
Version: 1.0.0.40 · Changeset: CS041 · Phase: P9 (closed) · Registry: 110 · Levers: 18

## Phase ledger — CS041

- P1 — GDD gains `## 0. How to read this document`: a 35-row index, one row per §2.x/§3.x
  subsection, letting a session load only what its phase names instead of §1–§3 in full.
  `CLAUDE.md`'s document map switches to the named-subsection contract; `CLAUDE.md` gains its own
  50 KB ceiling (FLAG-CS041-b). No GDD content deleted; no build edit.
- P2 — GDD §3's Constants row (22.5 KB append-only changelog) replaced by a 3.1 KB pointer,
  preserving three since-dead "standing rules" it had shipped as live instructions — one directly
  contradicted `CLAUDE.md`'s "one clock" invariant. This finding triggered GATE C.
- GATE C (closed) — Lever A (§0) and the read contract confirmed working; Lever C's specced
  30–40% prose trim declined, re-scoped to a **staleness sweep** (P3–P5); FORK-CS041-A resolved to
  **no version bump**. Full text: `log/CS041.md`.
- P3 — Staleness rule (remove only what is FALSE, keep what is merely OLD) plus a committed,
  reporting-only identifier audit (`scratchpad/gdd-audit.py`); applied to GDD §3's table. 6 of 12
  candidate rows corrected, 0 removed outright; §3's ⛔ count 13 → 22.
- GATE D (closed) — rule ratified as written; no re-run of P3 required.
- P4 — Swept §2.19/§2.13/§2.14+.1+.2/§2.10+.1+.2/§2.5+.1/§2.7/§2.12 (the CS024/CS038/CS040
  fallout). 105 candidates → 9 real, 9 corrections, 0 removals. Found `POWERUP_HEALTH_GAP` and
  CS038 P5's twelve retired knobs each live-as-written in multiple places; narrowed FLAG-8a.
- P5 — Swept the remainder (§2.4/§2.6/§2.8/§2.9/§2.11+.1/§2.16/§2.17/§2.18/§2.20+.1/§2.23/
  §3.1–§3.4). 41 candidates → 7 real, 7 corrections, 0 removals. Resolved FLAG-CS041-d (the weekly
  pool modulus was right in number, wrong in stated structure). Found and fixed a GDD citation of a
  deleted test file.
- P9 — Closing. Re-measured all 35 of GDD §0's size rows (drift ≤0.5 KB per row, byte-neutral
  overall); added the re-measure to `CLAUDE.md`'s closing-phase rules. Confirmed `CLAUDE.md`'s read
  contract still describes reality and its own ceiling still has headroom (48.4 KB / ~1.6 KB left).
  `STATUS.md` rolled and reset. Both planning docs archived; `log/GDD-TRIM-CS041.md` stays in `log/`.

Full narrative for every phase and both gates: `log/CS041.md`.

## Working / verified

- Full suite: **171 files, 171 passed, 0 failed, 0 skipped** at close. `orbital-overhaul.html` is
  byte-identical to CS040's across the whole changeset — no phase's diff touches it.
- The four literal prose pins (§1.3b) all still match, re-checked after every phase's edits.
- Headline result: per-session GDD load for a representative phase, old rule vs new — **~505 KB →
  ~33–46 KB**, a ~91–94% reduction, with nothing deleted. GDD whole-file size: 534,526 → 528,243
  bytes (net **+3,717** — P1's additive index outweighs the sweep's net −16,209 across P2–P5).
- The staleness sweep's own result: ~246 audit candidates across P3–P5, 16 real (a ~93–94%
  false-positive rate, as GATE C's own sample predicted) — every real hit was a defect byte-counting
  would never have found. Full byte table and candidate accounting: `log/CS041.md`.

## Known issues

- **⛔ Three P5 findings still want attention in a future changeset, none touchable this phase under
  NO BUILD EDIT:** two stale `% 15` comments (`orbital-overhaul.html:99`, a build edit; and
  `scratchpad/test-f9.js:11`, a header-comment-only test edit — its assertions already use 16
  correctly); and GDD §3's Entities row still describing `Powerup.radius`/`Dock.radius` via the dead
  `leverScale()` inside a "v3.4 (P2)" stamp, left alone deliberately since §3's rows are P3's
  territory and were ratified at GATE D.
- **⛔ FLAG-8a stands, narrowed but still open (found P4).** The ambient low-health Health cadence
  now rolls 12.4–18.0 s at the low-hull threshold (tightened from CS040 P2's healing rework,
  confirmed against the live build), down from the "up to 26 s" the flag originally complained
  about — but no force-spawn exists and the wait is still real.
- **⛔ A `STATUS.md` playtest ask (below) names four knobs — `hunterPulseMin`/`Max`/`Grow`/`Shrink` —
  retired to plain constants by CS038 P5, so there is nothing to read off the debug panel for them
  (found P4, not rewritten here).** The underlying question (does the heartbeat feel right?) is
  still live; only the instruction for how to answer it is stale. Rewording it is a small edit but
  changes what Paul is asked to go do, so it is left as-is rather than silently rewritten.
- **⛔ Seven §3 rows and both of §2's "came back clean" sections were never actually swept for
  prose-level staleness, only for dead identifiers** (Canvas/scaling, AudioSys, MusicSys, VoiceSys,
  Input, Chain physics, Main loop in §3; §2.7 and §2.10.2 in §2). The identifier audit cannot see a
  wrong ordering claim or a superseded rule stated in words with no dead name in it. Covering this
  is a different, more expensive pass and was not GATE D's ask.
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
  intervening diffs named.
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

- **CS042 is not yet started.**
- `CS039-VOICE-WORKLIST.md` (written CS038 P7) still records which voice events most need line
  alternatives, for Paul's next `tools/voice-robot-lab.html` session — still unconsumed.
- **The first thing any future gate should do is clear the debug overrides** (FLAG-CS036-a).
- A second, deeper telemetry capture on the v4 build (waves 10+) — see Known issues.
- The three P5 findings above (two stale `% 15` comments, the §3 `leverScale` cross-reference) and
  the stale playtest-ask knob names are each a one-line fix for whatever changeset next touches the
  file they live in.

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
