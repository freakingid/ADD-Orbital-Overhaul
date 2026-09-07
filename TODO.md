# TODO — Orbital Overhaul

A hand-curated queue of what's next, for Paul. Distinct from `STATUS.md` (current changeset only,
reset every close) and `DECISIONS.md` (judgment calls already made) — this is the backlog those
feed into and draw from. Snapshotted at CS041's close (`1.0.0.40`) and updated by the 2026-09-07 off-cycle GDD pass;
check `STATUS.md` for whether any of this has since moved.

**Not session-authoritative.** A future session should treat this as a starting point for
conversation with Paul, not a work order to execute unprompted — several items below need a human
decision (a playtest, a "yes go ahead") before they're implementation-ready.

---

## ⛔ RESUME HERE — last worked 2026-09-07 (off-cycle GDD accuracy pass)

**If a session was told "pick up where we left off," this block is the clue.** It is the only
dated resume point in the repo; everything below it is the standing backlog, which is a different
thing. Delete this block once its "next step" is done or Paul redirects — a stale resume note is
worse than none, and that is the exact failure the pass below was cleaning up after.

**What just happened.** `ORBITAL-OVERHAUL-GDD.md` was swept for accuracy against the shipped build.
⛔ **Not a changeset, not CS042, no build byte changed** — suite 171/171, 0 skips. The staleness was
concentrated in the sections no closing-phase checklist owns: the front-matter build stamp (16
changesets out of date), §4's per-version blockquotes (two still marked *"in progress"* for rounds
long shipped), and §6's watch list (three entries built on retired knobs). §2 and §3 largely held up.
Six false claims and one documentation gap were fixed; §1.1 was added. Full account: `STATUS.md`'s
off-cycle ledger entry, the findings in its Known issues, and the four judgment calls in
`DECISIONS.md` under its dated 2026-09-07 heading.

**The next step, and it is BLOCKED on Paul, not on work.** The whole point of the pass was to make
this GDD comparable against the **Orbital Overhaul 2** design document. ⛔ **That document is not in
this repo and nobody here has seen it.** Ask Paul for the path or the file. Do **not** infer OO2's
design from this repo and do **not** assume the two documents share a structure.

- **Where to start once the OO2 doc is in hand:** GDD **§1.1** ("The game in one page — the core
  loop"), specifically its closing **"What the game deliberately does NOT have"** list. That list was
  written for this comparison — it is where two designs usually diverge most.
- ⚠ **§1.1 is a SUMMARY and is never authoritative.** §2 wins any disagreement. The standing call in
  `DECISIONS.md` is that if §1.1 is ever found contradicting §2, **delete it rather than repair it**.

**Unblocked work, if Paul is away and you want something to do:** the "Documentation" section below
(six §3 rows still unswept for prose staleness; the closing-phase checklist gap) and the four stale
code comments under "Small, mechanical fixes." None of those need him.

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

- **Four stale comments, all needing a build or test edit.** Two `% 15` comments found CS041 P5
  (`orbital-overhaul.html:99` and `scratchpad/test-f9.js:11`'s header — the code at both sites is
  already correct at `WEEKLY.length`, currently 16; only the comment lies), plus two found by the
  2026-09-07 off-cycle GDD pass: the `settings` object's comment says `voiceStyle`/`captions` are
  "NOT persisted yet (later phase)" when CS011 P3 shipped both, and `orbital-overhaul.html:54` still
  calls `RAMP_WAVES` the single difficulty knob when it was renamed `MUSIC_INTENSITY_WAVES` and now
  drives music intensity only. Bundle them into whichever changeset next touches these files.
- ~~GDD §3's Entities row describes `Powerup.radius`/`Dock.radius` via the dead `leverScale()`~~ —
  **done 2026-09-07**: past-tensed, with the live plain-constant rule stated in the same row.
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

## Documentation, from the 2026-09-07 off-cycle GDD pass

- **Six §3 rows have still never been swept for prose-level staleness** (Canvas/scaling, AudioSys,
  MusicSys, VoiceSys, Input, Chain physics). Every real find in that pass was a claim with no dead
  identifier in it, which is exactly what `scratchpad/gdd-audit.py` cannot see — so these six are
  unchecked, not checked-and-clean.
- **Extend the closing-phase checklist to re-read the GDD's build stamp and §4.** Both were years
  stale for the same structural reason: no phase owned them. §0's size rows already get a
  closing-phase re-measure; adding these two is a one-line rule change and would close the loop.
- **`scratchpad/gdd-sizes.py` exists but is uncommitted and unreferenced by any rule.** It makes the
  CS041 P9 §0 re-measure one command (`--check`, exits non-zero on drift). If it is kept, name it in
  `CLAUDE.md`'s closing-phase rule the way `gdd-audit.py` is named in the staleness rule; if not,
  delete it — an orphan tool nobody is told to run is worse than no tool.

## Not started

- **CS042 has no scope yet.** Nothing here is pre-committed to the next changeset — this file is
  the queue to pull from when `PLANNED-FEATURES-CS042.md` gets written, not a substitute for it.

---

*Source: `STATUS.md` at CS041's close (`log/CS041.md` has the full changeset narrative), plus the
2026-09-07 off-cycle GDD accuracy pass. Update this file as items resolve or new ones surface — it
isn't rolled into `log/` automatically the way `STATUS.md` is.*
