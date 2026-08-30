# Orbital Overhaul — STATUS
Version: 1.0.0.40 · Changeset: CS041 · Phase: P4 · Registry: 110 · Levers: 18

## Phase ledger — CS041

- P1 — The read contract. GDD gains `## 0. How to read this document` (9.8 KB, additive, before §1):
  one row per §2.x/§3.x subsection — all 35 — carrying the section number, its name, an approximate
  size, and a "read this when you are touching…" line phrased as *what you might be editing*.
  `CLAUDE.md`'s document map row goes from "§1–§3 before code" to "§0 + §1 always; then the §2.x/§3.x
  your phase names", with the full contract stated once under the map. `CLAUDE.md` gains its own
  50 KB ceiling and a `RATIONALE.md` pressure valve (FLAG-CS041-b). No GDD content deleted; no build
  edit. Measured GDD load for a typical phase: **~505 KB → ~33–46 KB** (see Working / verified).

- P2 — GDD §3's **Constants** row becomes a pointer. Its two content cells held **22,852 bytes** on
  one line — an append-only changelog of every tuning constant since v1.1, plus a "Notes for
  modification" cell. Replaced by **3,140 bytes**: the constants block's grouping, the standing
  rules, and a one-line index of every retired constant NAME so a grep for `GARBAGE_DECAY` finds
  "deleted, see `log/`" rather than silence. **Saving 19,712 bytes (19.2 KB).** §3 body 94,200 →
  75,608 bytes; GDD 544,406 → 524,764. Cut text preserved verbatim in the new
  `log/GDD-TRIM-CS041.md` (FORK-CS041-C). §3's ⛔ count is **unchanged at 13**, ⚠ at 1. §0's §3 size
  row re-measured 94.2 → 73.8 KB.

- GATE C (closed) — **Lever A worked; Lever C is re-scoped, not cancelled.** Items 1, 2 and 5 came
  back clean: the read contract points at the right subsections and missed nothing. **FORK-CS041-A:
  NO `GAME_VERSION` bump** — the build is byte-identical to CS040's and must keep saying so in every
  high-score record and leaderboard row; both live version pins stay un-repointed. **FORK-CS041-B:
  the specced 30–40% prose trim is NOT wanted** — replaced by a **staleness sweep** (P3–P5, GATE D
  retained after P3), on the evidence that §2/§3's problem is wrongness, not size. **P6–P8 dropped.**

- P3 — Staleness sweep of GDD §3's table (everything but P2's Constants row), plus the audit as a
  committed tool (`scratchpad/gdd-audit.py`; reporting only, not wired into `run-all.js`). **Six of
  the twelve candidate-carrying rows were wrong; five were fixed by CORRECTION, not removal, so §3
  went 75,608 → 75,451 bytes — a net −157.** That is the shape of a correctness sweep and is the
  intended outcome. One large removal (Helpers, 2,915 → 1,497: five paragraphs specifying
  `difficultyFactor`/`ramp`/`leverScale`/`cycleValue`/`wavePressure`/`bonusSpawnChance`, all
  deleted, one of which instructed "use these for any new wave-scaled value"). **§3's ⛔ count went
  13 → 22** — nine new "X is GONE" prohibitions; ⚠ unchanged at 1; **no marker removed.** Rule as
  applied, three amendments, both false-positive classes and every cut: `log/GDD-TRIM-CS041.md`.

- GATE D (closed) — **PASSES as written; all three of P3's amendments ratified unchanged.** Correct
  inline over remove; extend an existing "Gone:" list rather than rewrite its history clause; an
  incomplete "Gone:" list is itself a staleness defect. No re-run of P3 was required.

- P4 — Staleness sweep of the CS024/CS038/CS040 fallout: §2.19, §2.13, §2.14+.1+.2, §2.10+.1+.2,
  §2.5+.1, §2.7, §2.12. **105 candidates → 9 false claims → 9 corrections, 0 removals**, on 9 changed
  lines. Swept sections 183,573 → 185,626 bytes (**+2,053**); whole-GDD delta is the same +2,053, so
  nothing outside them moved. §2.7 and §2.10.2 came back **clean** — every candidate there is a
  sentence correctly saying the identifier is gone. The nine: `clampShown`'s carrier count and a dead
  `garbageAttractDelay` exemplar (§2.19); the JUNK chain named as `speedLarge/Medium/Small` instead
  of `junkSpeed*`, contradicting the next bullet (§2.13); `POWERUP_HEALTH_GAP` alive in two places
  (§2.14); the six `deliveryFloat*` and four `hunterPulse*` CS038 P5 retirements still written as
  `DEBUG.*` rows (§2.10, §2.5); `COLOR.clumpHot` as a live comparand and **FLAG-8a's invalidated
  premise** (§2.12). Every cut preserved verbatim with its verification in `log/GDD-TRIM-CS041.md`.
  Three new false-positive classes documented there. **No build edit; suite 171/171, 0 skips.**

Full narrative: `log/CS041.md` (written at P9).

## Working / verified

- Full suite: **171 files, 171 passed, 0 failed, 0 skipped**. No test file touched this phase.
- **`orbital-overhaul.html` is byte-identical to CS040's** — `git diff --stat` shows the GDD and
  `log/GDD-TRIM-CS041.md` only. FORK-CS041-A holds: no version bump, no version pin re-pointed.
- The four literal prose pins all still match, re-checked after P4's nine edits: §3.2 still reads
  "plus two deliberate exceptions", the file nowhere says "three", no `§2.13.1` cross-reference
  exists, and §2.4/§2.11's banner prose is intact. None of P4's corrections is near one of them.
- §0's coverage is machine-checked, not eyeballed: all 35 §2.x/§3.x headings have exactly one row,
  no row names a section that does not exist, and **every index name is an exact prefix of its real
  heading** — names are the heading's own, minus its trailing version/changeset stamp.
- **Measured read contract, old vs new.** Old rule (§1–§3): 1.9 + 395 + 107 = **~505 KB**. New rule
  for a representative phase — §0 (9.8) + §1 (1.9) + two named subsections, e.g. §2.14 Powerups
  (25.8) + §2.14.2 Chain Guard (8.8) = **~46 KB**; a lighter phase, e.g. §2.21 (8.8) + §2.22 (12.9),
  = **~33 KB**. **A ~91–94% reduction**, with nothing deleted.
- GDD 534,526 → 544,406 bytes (+9,880, all of it §0 and the §5.1 clause) **at P1**. `CLAUDE.md`
  46,161 → 48,268 bytes (47.1 KB / 836 lines), inside its new 50 KB ceiling with ~2.9 KB of
  headroom — untouched since P1.
- **GDD running total: 534,526 (pre-CS041) → 526,660 bytes**, a net **−7,866** across P1–P4.
  Measured off each commit, not summed from the ledger: **+9,926** (P1 §0 index) **−19,688**
  (P2 Constants cell) **−157** (P3 §3 sweep) **+2,053** (P4 §2 corrections). ⚠ P1's and P2's own
  ledger lines above quote per-*section* figures that differ from these whole-file deltas by tens of
  bytes; both are right about their own subject. ⛔ **The headline number of this changeset is
  neither** — it is the per-session read contract (~505 KB → ~33–46 KB) plus the count of false
  statements removed from the file.

## Known issues

- **⛔ P3–P5 ARE THE SWEEP; P6–P8 NO LONGER EXIST.** GATE D is **closed** (passed as written, P4).
  **The sweep's failure mode is the inverse of the trim's** — not "cut something protective" but "cut
  a true sentence because an audit flagged the dead identifier inside it." P4 removed nothing at all
  and that was the right outcome; **P5 should expect the same."
- **⛔ The sweep must not be run as a size trim.** Byte reduction is a side effect. A phase that
  removes four false sentences and reports "the rest is true" has succeeded; padding the number is
  the way this goes wrong.
- **⛔ THE AUDIT'S FALSE-POSITIVE RATE FOR "REMOVE THIS" IS VERY HIGH, BY DESIGN — CONFIRMED TWICE.**
  P4: **105 candidates, 9 false claims — a ~91% false-positive rate**, and §2.14's candidate count
  went **UP** (15 → 19) on a phase that made §2.14 more accurate, because the corrections are written
  in the GDD's own slash-glob style. ⛔ **Never read the count as a progress bar.** P3's finding,
  which still stands: §3 went 100 candidates → 98 across six swept rows, because nearly every candidate sits
  inside a sentence that correctly says the identifier is gone. **A gate reading the count as a
  progress bar will conclude the phase failed; it did not.** Two false-positive classes are now
  documented: identifiers held as **string literals** (`debugOverride` is `const DEBUG_OVERRIDE_ID =
  "debugOverride"`, and the scanner strips string contents), and **name collisions** (`ramp` shows 4
  live hits, all a local arrow function in `AudioSys.lowhpSet`, while the difficulty `ramp()` really
  is gone — so an identifier can be dead *despite* live hits). Never trust the count; read the site.
- **⛔ SEVEN §3 ROWS WERE NOT SWEPT AND THAT IS NOT A CLEAN BILL OF HEALTH.** Canvas/scaling,
  AudioSys, MusicSys, VoiceSys, Input, Chain physics and Main loop carry zero candidates, which only
  means nothing in them names a dead identifier. **The audit cannot see prose-level staleness** — a
  wrong ordering claim, a superseded rule stated in words. Covering them is a
  different and much more expensive pass, and it should be scoped deliberately — GATE D did not ask
  for it. **The same caveat now applies to §2**: §2.7 and §2.10.2 "came back clean" only in the sense
  that nothing in them names a dead identifier.
- **The decay clock was stated as live in THREE separate §3 rows** (Constants, fixed at P2; game
  object; Flow functions; and a fourth in `update(dt)`). One deletion — CS024 P3's — left four
  independent false claims behind. **P4 confirmed the multiplicity prediction, for different
  deletions:** `POWERUP_HEALTH_GAP` (CS040 P2) was live in **two** §2.14 sites, and CS038 P5's twelve
  retired presentation knobs in **two** more (§2.10's six `deliveryFloat*`, §2.5's four
  `hunterPulse*`). The decay clock itself was clean everywhere in §2 — §2.10, §2.10.1 and §2.5.1 all
  describe it correctly as deleted. **One deletion leaving N false claims is the pattern; which
  deletions did it is not predictable from the changeset.**
- **⛔ DOC/BUILD DISAGREEMENT FOUND, NOT FIXED (FLAG-CS041-d).** GDD §3's Achievements row gives the
  weekly rotation as `(isoYear*52+isoWeek) % 16`; the build's own header comment at line 99 says
  `% 15`. §2.17 documents 16 weekly achievements, so the GDD looks right and the build's COMMENT
  looks stale — but correcting a build comment is a build edit, which this changeset forbids
  everywhere. Someone should confirm the live pool size and fix whichever is wrong.
- **⛔ THE STALENESS IS NOT LOCALISED TO §3 — MEASURED AT GATE C.** Every backticked identifier in
  §2/§3 was checked against the build with comments and string literals removed by a **character
  scanner** (never a regex — `CLAUDE.md`'s Test rules say why): **156 distinct plausible build
  identifiers named in §2/§3 have ZERO live occurrence.** Worst sections: **§3** (100), **§2.19**
  (32), **§2.14 + .1 + .2** (19), **§2.10 + .1 + .2** (18), **§2.13** (13), **§2.5 + .1** (15).
  ⛔ **These are CANDIDATES, not verdicts** — a sentence saying "`GARBAGE_DECAY` was removed in
  CS024 P3" is true, protective, and flagged by the audit for exactly the reason it exists. Each hit
  needs a context read. **Both clusters this item named are now resolved, and they resolved
  OPPOSITE ways (P4)** — worth keeping as the clearest example of why the count is not a verdict.
  (1) The CS038 P5 presentation-knob cluster was **real**: §2.10's six `deliveryFloat*` and §2.5's
  four `hunterPulse*` were genuinely written as live `DEBUG.*` rows and were corrected. §2.20's
  `celebrationScrollStep`/`celebrationEmblemSize` are P5's, untouched here. (2) The
  `REPAIR_AMOUNT`/`REPAIR_FULL_BONUS`/`POWERUP_HEALTH_GAP` cluster was **almost entirely a false
  positive**: §2.7 and §2.12 both already say those two constants are DELETED, in §2.12's case
  quoting CLAUDE.md's ⛔ nearly verbatim. Only `POWERUP_HEALTH_GAP` was actually live-as-written, and
  in §2.14 rather than in either section the item pointed at.
- **⛔ P4 FOUND AN OPEN FLAG WHOSE PREMISE A LATER CHANGESET SILENTLY INVALIDATED — NARROWED, NOT
  CLOSED.** §2.12's **FLAG-8a** said the ambient health cadence `POWERUP_HEALTH_GAP` (a flat 18–26 s)
  "was **not** shortened" for the low-health warning, so a player could wait "up to 26 s" with the
  alarm running and nothing to point at. **CS040 P2 shortened exactly that**, and nobody noticed
  because CS040 was rewriting §2.7 and §2.14, not §2.12. Derived against the live build: at
  `LOW_HP_THRESHOLD` (0.4 hull) the gap now rolls **12.4–18.0 s**, tightening to **6–10 s** at zero
  hull. ⛔ **The flag stays OPEN** — no force-spawn was ever added, the wait is still real, and the
  shortening arrived as a side effect of a healing rework that was never validated against this
  warning. **This is the class of defect the sweep exists to find**, and the audit found it only
  incidentally: the flag's *reasoning* went stale, and the dead identifier inside it was the tell.
- **⛔ THREE NEW FALSE-POSITIVE CLASSES (P4), all in `log/GDD-TRIM-CS041.md`.** (1) **Ids synthesized
  by concatenation** — `leverKnob()` builds `id + "Floor"`, so all **54** lever registry ids
  (18 levers × 3) are invisible to the scanner and read as dead. (2) **Metasyntactic placeholders** —
  `` `<leverId>Floor` ``, `` `{ leverId: number }` ``. (3) **Glob and slash notation** — `` `ufoFireFreq*` ``,
  `` `POWERUP_HEALTH_MIN/MAX_DIST` `` tokenize into dead fragments while the full names are live.
  ⚠ Class 3 means **writing a correct sentence in the GDD's house style can RAISE the candidate
  count**, which is what happened to §2.14.
- **⛔ A STATUS.md PLAYTEST ASK NAMES FOUR KNOBS THAT NO LONGER EXIST (found P4, not fixed).** The
  open **H6/H10/H11** ask below tells Paul to clear the debug overrides and read numbers off
  `hunterPulseMin`/`Max`/`Grow`/`Shrink` — retired to plain constants by CS038 P5, so there are no
  panel rows to read. The *question* is still live; the instruction is not. **Left for P9's doc
  sweep** rather than rewritten here, since P4's scope is the GDD and rewording a playtest ask is
  Paul's call. **The wider point: the staleness is not confined to the GDD.**
- **⛔ P2 FOUND THREE STALE "STANDING RULES" INSIDE §3's CONSTANTS ROW — this is GATE C evidence.**
  All three were verified dead against the build before removal, and are preserved verbatim with
  their notes in `log/GDD-TRIM-CS041.md`. (1) *"Early-game pacing tunes from `RAMP_WAVES` + the
  saucer floor/ceiling pairs"* — `ramp`/`difficultyFactor`/`RAMP_WAVES` were deleted by CS024 P4
  and `SAUCER_AIM_ERR_*` has zero build occurrences. (2) *"As of CS017 P3 there are TWO clocks"* —
  **this directly contradicted `CLAUDE.md`'s ⛔ "One clock. All difficulty scaling derives from
  `game.wave`. No parallel clocks."**; the cycle clock died at CS018 P4 and its replacement at
  CS024 P4. (3) *"Debris density tunes from decay (`DEBUG.garbageLifetime`)…"* — CS024 P3 deleted
  decay outright and CS024 P5 retired `garbageAttractDelay`. **The point for GATE C: these were not
  narration, they read as live tuning instructions, and the blunt "read §1–§3" rule delivered all
  three to every session for sixteen changesets.** Writing current-state replacements was NOT done
  — that is new GDD content and P2 was not scoped to author it; the replacement points at §2.10.1 /
  §2.5.1 / `DIFFICULTY-LEVERS.md` instead. **§3 may hold more of these; P4 is where to look.**
- **P2's saving was 19.2 KB, not the plan's projected ~21 KB, and the plan's figure counted two
  cells as one.** §2.3 measured "the Constants cell" at 22,520 chars; that is the whole row —
  18,211 in the *Contents* cell and 4,288 in the *Notes for modification* cell. Both were replaced
  (the invariants §2.3 named as "buried in the cell" all lived in the second one). The replacement
  is 3,140 B rather than ≤1.5 KB because the prompt's own ⛔ retired-constant-NAMES line is ~1.1 KB
  of that on its own; the remaining ~2 KB is grouping + the standing rules + history pointers.
- **§0's `**3.** Code Architecture Map` size row was re-measured at P2 (94.2 → 73.8 KB).** Strictly
  outside "one table cell plus STATUS.md", but P2 invalidated the row it had just shipped, and
  FLAG-CS041-c's P9 re-measure is a sweep, not a licence to ship a known-stale index for six phases.
- **§0 is 9.8 KB, not the prompt's 3–4 KB target, and this was a deliberate call.** 35 rows leave
  ~90 B/row at 4 KB, of which number + name + size already spends ~55 — about five words for the
  "touching…" line, which is exactly the "§2.14 Powerups — powerups" uselessness the prompt names as
  the whole risk. The ⛔ on that column beat the soft target. **GATE C should say whether it wants
  §0 shorter**; the compressible fat is the header prose (~1.3 KB), not the rows.
- **The old read rule was stated in a second place, and it was corrected: GDD §5.1 item 5.** It read
  "This GDD (§1–§3 before writing code)". Left alone it would have contradicted CLAUDE.md on the one
  rule this changeset ships. Reworded, not deleted — a rule change, the same one, not GDD content
  loss. **Flagged because P1's scope was "additive plus one rule change" and this is a second site
  for that rule.**
- **GDD §3's Code Architecture Map has no row for the `Telemetry` module** (CS039/CS040), though it
  does have one for `Benchmark`. Telemetry is documented — §2.19 and §2.16 — but a session using §3
  as the "where does this live" map will not find it. §0's §2.19/§2.16 rows name telemetry so the
  gap is not load-bearing today. **Not fixed: §3 content belongs to P4, and P1 deletes and adds no
  GDD content outside §0.**
- **⛔ FORK-CS041-A, -B and -C remain OPEN.** Only -D was resolved (Paul, at this session: §0 carries
  sizes). GATE C item 5 is therefore already answered and can be struck.
- **⛔ §0's sizes go stale the moment any section is edited (FLAG-CS041-c).** P9 re-measures every
  row. If P3–P8 run, all 35 are invalidated.
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

None. GATE C is closed; FORK-CS041-A, -B and -D are resolved and -C was settled by the plan.

## Next up

- **P5 — the remainder of the sweep, and next.** Everything the audit still flags outside P4's
  twelve sections — §2.4, §2.6, §2.8, §2.9, §2.11, §2.11.1, §2.16, §2.17, §2.18, §2.20, §2.20.1,
  §2.23 — plus §3.1–§3.4. Then re-run the audit and report what survives, one line per surviving
  candidate. ⛔ **A candidate that survives because the sentence correctly says "this was deleted" is
  the EXPECTED outcome, not a miss** — P4 finished at ~91% survival and was correct to.
  ⛔ **Do not re-sweep P4's twelve sections**; their surviving candidates are accounted for above and
  in `log/GDD-TRIM-CS041.md`.
- **The first thing any future gate should do is clear the debug overrides** (FLAG-CS036-a).
- `CS039-VOICE-WORKLIST.md` (written CS038 P7) still records which voice events most need line
  alternatives, for Paul's next `tools/voice-robot-lab.html` session — still unconsumed.
- A second, deeper telemetry capture on the v4 build (waves 10+) — see Known issues.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade`/`levelEndGracePulseEnd` for the ship pulse, and
  `hunterPulseMin`/`Max`/`Grow`/`Shrink` for the heartbeat.
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
