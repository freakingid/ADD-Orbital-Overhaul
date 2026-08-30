# TODO — Orbital Overhaul

A hand-curated queue of what's next, for Paul. Distinct from `STATUS.md` (current changeset only,
reset every close) and `DECISIONS.md` (judgment calls already made) — this is the backlog those
feed into and draw from. Snapshotted at CS041's close (`1.0.0.40`); check `STATUS.md` for whether
any of this has since moved.

**Not session-authoritative.** A future session should treat this as a starting point for
conversation with Paul, not a work order to execute unprompted — several items below need a human
decision (a playtest, a "yes go ahead") before they're implementation-ready.

---

## Needs a person, not code

- **Clear the debug overrides before any future playtest gate's numeric questions
  (`FLAG-CS036-a`).** `saveSettings()` snapshots every debug knob and `loadSettings()` re-applies it
  over the registry defaults with `debugOverride` defaulting ON — any install that has ever saved
  settings is not running shipped defaults. This has bitten at least one prior gate.
- **A deeper telemetry capture on the current build, waves 10+, ideally spanning a
  delivery-hub-relief episode.** The last capture (CS039 GATE T) is waves 1–5 and predates the
  CS040 healing rework — `hpWasted`/`healthBanked`/`hunterCount` have never had a real-play look,
  and GATE T's "mean tow length rises as score rate falls" finding is still n=1.
- **Three open playtest questions**, none yet asked at a gate:
  - Does the low-health / Hunter-pulse heartbeat feel right? (The old ask named four knobs —
    `hunterPulseMin`/`Max`/`Grow`/`Shrink` — that CS038 P5 retired to plain constants; ask about the
    feel directly rather than by knob name until STATUS.md's ask is reworded.)
  - Does the "Level N" caption expiring mid-freeze read right, or should it hold through the frozen
    tail?
  - Does the dock apron read as pressure or as litter, now that CS035 P2's lockout means a parked
    ship no longer cleans up around itself?
- **`CS039-VOICE-WORKLIST.md`** (written CS038 P7) — still unconsumed. Records which voice events
  most need line alternatives, for whenever Paul next sits down with `tools/voice-robot-lab.html`.

## Small, mechanical fixes — bundle into whichever changeset next touches the file

- Two stale `% 15` comments (found CS041 P5, not fixed — that phase was under a no-build-edit
  rule): `orbital-overhaul.html:99` and `scratchpad/test-f9.js:11`'s header comment. The code at
  both sites is already correct (`WEEKLY.length`, currently 16); only the comment lies.
- GDD §3's Entities row still describes `Powerup.radius`/`Dock.radius` via the dead `leverScale()`
  function inside a "v3.4 (P2)" stamp. The correct baked-in-2× rule already exists in §2.10 and
  §2.14; this is a stale cross-reference, not a missing fact.
- `STATUS.md`'s H10/H11 playtest ask names four retired debug knobs (see "heartbeat" bullet above)
  — reword once Paul decides how he wants the question asked.
- `CLAUDE.md` documentation debt: `Achievements.save()` is no longer `afd_achievements_v2`'s only
  writer, and `mergeUnlock()` goes unnoted (flagged CS037 P6, deferred every changeset since).

## Balance / design, lower urgency

- UFO difficulty chain goes fully flat past level 65 (junk saturates L41, hunters L33). Fix, if
  wanted, is a step-count increase to the `LEVERS` table — no new mechanism.
- Score composition shifted after CS040 removed `scoreRepairBonus` outright; CS039 GATE T's
  "Hunters carry the run" measurement (~56% of score, 65% of damage) hasn't been re-run since.
- `COMBO n/N`'s denominator is unrepresented in the HUD (accepted risk since CS026).
- `DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are first-pass values, unverified in a real browser (CS023).

## Test-suite housekeeping (no urgency, no player-facing effect)

- Four moving-`HEAD` test pins pass vacuously on a clean tree and need a fixed SHA each:
  `test-cs023-p3.js`, `test-cs024-p6.js` §H TRAP 2, `test-cs025-p4.js` TRAP 3.
- Two unseeded-test flakes: `test-cs035-p3` §F (~5%), `test-f6` §F (~1.7%). Rerun to distinguish
  from a real regression before chasing either.
- No other fixed-ref diff pin reaching back past the CS029 rename has been swept for the same
  `--find-renames` failure mode `test-cs024-p6b.js` §G TRAP 5 hit in CS040 — nobody has checked.

## Not started

- **CS042 has no scope yet.** Nothing here is pre-committed to the next changeset — this file is
  the queue to pull from when `PLANNED-FEATURES-CS042.md` gets written, not a substitute for it.

---

*Source: `STATUS.md` at CS041's close (`log/CS041.md` has the full changeset narrative). Update this
file as items resolve or new ones surface — it isn't rolled into `log/` automatically the way
`STATUS.md` is.*
