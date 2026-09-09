# TODO — Orbital Overhaul

A hand-curated queue of what's next, for Paul. Distinct from `STATUS.md` (current changeset only,
reset every close) and `DECISIONS.md` (judgment calls already made) — this is the backlog those
feed into and draw from. Snapshotted at **CS042's close (`1.0.0.42`)** and refreshed at **CS043 P0
(2026-09-09)**; check `STATUS.md` for whether any of this has since moved.

**Not session-authoritative.** A future session should treat this as a starting point for
conversation with Paul, not a work order to execute unprompted — several items below need a human
decision (a playtest, a "yes go ahead") before they're implementation-ready.

---

## ⛔ RESUME HERE — last worked 2026-09-09 (CS043 P0 landed; P1 is next)

**If a session was told "pick up where we left off," this block is the clue.** It is the only dated
resume point in the repo; everything below it is the standing backlog, which is a different thing.
Delete this block once its "next step" is done or Paul redirects — a stale resume note is worse than
none. (⚠ Paul-facing companion, not session context: **`START-HERE.md`** at the repo root explains
*how* a session is run here — the ritual, not the state. This block stays the authority on the state.)

**Where things stand.** **CS043 is in flight and one phase deep.** It deletes the level-end pause —
the freeze on wave clear, the "Level N Complete" announcement, and the achievement panel at the level
seam (the panel becomes game-over-only) — because the beat lands mid-fight, at a moment the player
did not choose. That reversal is Paul's, taken off-cycle, and it deliberately outweighs CS036's own
H1 playtest finding; `DECISIONS.md` and `PLANNED-FEATURES-CS043.md` §0 record it so no future session
reads the deletion as a tidy-up mistake. **P0 shipped 2026-09-09 as `eb7c6b9`** — five stale comments
corrected, comments only, with a phase pin proving the extracted script is byte-identical to its
parent once comments are stripped. No gameplay byte has moved yet.

**⛔ THE NEXT STEP, and it needs no decision from anyone: run P1.** Open
`IMPLEMENTATION-PHASES-CS043.md`, go to its **P1** section, set the model and effort named there
(**Opus 5 · XHigh · ultrathink yes**), and paste that section's copy-paste prompt block as the
session's first message. It carries its own read chain and scope fence — nothing has to be remembered
or added to it. P1 is the deletion itself and it is the one phase in this changeset that can break the
shipped game silently, which is why it is the expensive one. Then: **P2** panel → **P3**
banner/grace/pulse → **P4** spawn floor → **⛔ GATE A, a blocking playtest with no session** → **P5**
close (version bump to `1.0.0.43`, docs, `STATUS.md` roll, archive).

**Nothing blocks P1, P2 or P3.** FORK-CS043-A — the changeset's only fork — was resolved at review on
2026-09-09: the ship's alpha pulse spans the **whole** protection window, not just the grace.

**Two things still need Paul, neither of them blocking P1.**

1. ⛔ **`CLAUDE.md` is OVER its own 50 KB ceiling (51.25 KiB) and the size valve that was supposed to
   prevent that is spent** — it fired on `### Audio` exactly as designed, and afterwards no section is
   over the ~4 KB the valve requires. This is FLAG-CS041-b, live since CS042's close. Three ways out,
   all his call: lower the section threshold, raise the ceiling (it has always been "a first guess"),
   or accept the overrun. **Nothing is blocked** — the file works — but **P5 has to report the measured
   delta either way**, so an answer before the close is worth having. CS043 is expected to come out
   ahead: the level-end ceremony's rules shrink and only §5's spawn floor is added.
2. ⛔ **The Orbital Overhaul 2 comparison is still where it was, and still blocked on him.** The
   2026-09-07 GDD accuracy pass existed to make this GDD comparable against the **OO2** design
   document; ⛔ **that document is not in this repo and nobody here has seen it.** Ask Paul for the
   path or the file. Do **not** infer OO2's design from this repo and do **not** assume the two
   documents share a structure. Start at GDD **§1.1**'s closing *"What the game deliberately does
   NOT have"* list — it was written for this comparison. ⚠ §1.1 is a SUMMARY and never
   authoritative; if it is ever found contradicting §2, `DECISIONS.md`'s standing call is to
   **delete it rather than repair it**.

**Housekeeping worth knowing before you start.** The tree is clean and the suite is **181/181, 0
failed, 0 skipped**. ⚠ Both documented flakes (`test-cs035-p3` §F ~5%, `test-f6` §F ~1.7%) happened to
fire in the same run at P0's close and both passed on rerun — a rerun is still the standing way to
tell either from a real regression. **`eb7c6b9` and `82e3419` are unpushed**; pushing is Paul's and no
session does it.

**Unblocked work, if Paul is away and you want something else to do:** the deferred SFX retune (below
— it is a `tools/sfx-lab.html` session, never a hand-edit) and the "Documentation" section. ⚠ The four
stale code comments that used to sit here are **done** — CS043 P0 fixed those four plus a fifth.

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
- **⚠ Paul flagged some of CS042's twelve event SFX as wanting a retune and EXPLICITLY DEFERRED it
  to a later changeset.** ⛔ **It is a `tools/sfx-lab.html` session, not a hand-edit in the build** —
  all twelve methods are pinned byte-for-byte against `CS042-GATE-A.md`, so re-tuning a gain in
  place fails the suite by design. He has not said which sounds.
- **⛔ NEW, and the most answerable thing on this list: does the dashed Scoop read as an energy
  field?** CS042 P11 answered GATE C's G4 without ever opening a browser. The mouth V, both level-6/7
  orbs and the level-7 tethers now stroke through a 6/6 px dash so they stop reading as hittable
  hull. `SCOOP_FIELD_DASH` / `SCOOP_FIELD_GAP` are two plain constants at the top of the Scoop block
  — no knob, no gate needed to retune.
- **The seven knobs CS042 added stand at analytic defaults, unplaytested against their own extremes.**
  `DIFFICULTY-LEVERS.md` §4 names each one's A/B. The two most worth a deliberate look are
  `cargoUnitMass` (at 0 the whole one-mass model switches off) and `bankSpareHullPct` (at 1.0 a
  banked charge always heals, at 0.0 it always spares a scoop level).
- **`CS039-VOICE-WORKLIST.md`** (written CS038 P7) — still unconsumed. Records which voice events
  most need line alternatives, for whenever Paul next sits down with `tools/voice-robot-lab.html`.

## Small, mechanical fixes — bundle into whichever changeset next touches the file

- ~~Four stale comments, all needing a build or test edit (two `% 15`, the `settings` object's "NOT
  persisted yet," and `RAMP_WAVES` as "the single knob")~~ — **done 2026-09-09, CS043 P0 (`eb7c6b9`)**,
  along with a **fifth** the CS043 planning session turned up: `nextWave()`'s comment still described
  the CS021/CS022 archetype world cadence ("42 times in a 63-level run") that CS024 P1 retired, and
  `CS043-KICKOFF.md`'s Q1 had already been written from it. ⚠ **That is the cautionary one** — a stale
  comment did not just sit there, it fed a wrong question to Paul. `resizeWorld()` fires **once per
  run**, at the `earlyWorldLevels` 5 → 6 seam.
- ~~GDD §3's Entities row describes `Powerup.radius`/`Dock.radius` via the dead `leverScale()`~~ —
  **done 2026-09-07**: past-tensed, with the live plain-constant rule stated in the same row.
- `STATUS.md`'s H10/H11 playtest ask names four retired debug knobs (see "heartbeat" bullet above)
  — reword once Paul decides how he wants the question asked.
- `CLAUDE.md` documentation debt: `Achievements.save()` is no longer `afd_achievements_v2`'s only
  writer, and `mergeUnlock()` goes unnoted (flagged CS037 P6, deferred every changeset since).
- ~~When writing CS043's planning docs, state the version bump as `1.0.0.43` — the CHANGESET NUMBER —
  not "the next integer"~~ — **done**: both docs say `1.0.0.43` as a literal (`PLANNED-FEATURES-CS043.md`
  §9). ⛔ **The underlying rule stands for CS044 and after**: CS042's phase doc wrote "the next integer,"
  shipped `1.0.0.41`, and both live version pins passed it, because they assert HEAD's literal and cannot
  know what it should have been. `GAME_VERSION`'s own comment block is authoritative. `DECISIONS.md`,
  2026-09-08.

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

- **Five §3 rows have still never been swept for prose-level staleness** (Canvas/scaling, AudioSys,
  MusicSys, VoiceSys, Input — **Chain physics came off this list at CS042 P11**, rewritten for the
  one-mass model). Every real find in that pass was a claim with no dead
  identifier in it, which is exactly what `scratchpad/gdd-audit.py` cannot see — so these six are
  unchecked, not checked-and-clean.
- ~~Extend the closing-phase checklist to re-read the GDD's build stamp~~ — **done CS042 P11.**
  `CLAUDE.md`'s §0 re-measure rule now re-reads line 3's version / registry / `LEVERS` stamp in the
  same step, and the stamp is current for the first time in sixteen changesets. ⚠ **§4's half is NOT
  done** — it carries a ⛔ "must not grow back into a changelog" rule but still has no checklist
  owner, which is the same structural gap.
- ~~`scratchpad/gdd-sizes.py` is uncommitted and unreferenced~~ — **done:** it is committed, and
  `CLAUDE.md`'s closing-phase rule now names `--check` the way the staleness rule names
  `gdd-audit.py`. CS042 P11 used it and it found sixteen drifted rows.
- **⛔ §0's two AGGREGATE size figures have no owner either.** The re-measure rule covers the ~35
  table rows; the preamble's "always-read floor" and "§4–§7" numbers are separate snapshots, and the
  second was found ~55% understated at CS042 P11 (~14 KB claimed, 21.8 KB measured) having drifted
  independently of any changeset. Either fold them into `gdd-sizes.py --check` or say in the rule
  that they are re-read too.

## Not started

- **CS043 has no scope yet.** Nothing here is pre-committed to the next changeset — this file is
  the queue to pull from when `PLANNED-FEATURES-CS043.md` gets written, not a substitute for it.
  ⚠ **CS042 did not reach anything it planned to and then dropped** — every phase in its build order
  shipped, both gates were answered, and all five forks and thirteen flags closed. What it *opened*
  is FLAG-CS041-b, at the top of this file.

---

*Source: `STATUS.md` at CS042's close (`log/CS042.md` has the full changeset narrative), which in
turn carried forward CS041's and the 2026-09-07 off-cycle GDD accuracy pass's open items. Update this file as items resolve or new ones surface — it
isn't rolled into `log/` automatically the way `STATUS.md` is.*
