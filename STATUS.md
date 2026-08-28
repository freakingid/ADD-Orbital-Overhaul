# Orbital Overhaul — STATUS
Version: 1.0.0.40 · Changeset: CS041 · Phase: P1 · Registry: 110 · Levers: 18

## Phase ledger — CS041

- P1 — The read contract. GDD gains `## 0. How to read this document` (9.8 KB, additive, before §1):
  one row per §2.x/§3.x subsection — all 35 — carrying the section number, its name, an approximate
  size, and a "read this when you are touching…" line phrased as *what you might be editing*.
  `CLAUDE.md`'s document map row goes from "§1–§3 before code" to "§0 + §1 always; then the §2.x/§3.x
  your phase names", with the full contract stated once under the map. `CLAUDE.md` gains its own
  50 KB ceiling and a `RATIONALE.md` pressure valve (FLAG-CS041-b). No GDD content deleted; no build
  edit. Measured GDD load for a typical phase: **~505 KB → ~33–46 KB** (see Working / verified).

Full narrative: `log/CS041.md` (written at P9).

## Working / verified

- Full suite: **171 files, 171 passed, 0 failed, 0 skipped**. No test file touched this phase.
- The four literal prose pins (§1.3b) all still match — §0 adds no text that collides with them
  (it says "the two sanctioned fill exceptions", never "three deliberate exceptions").
- §0's coverage is machine-checked, not eyeballed: all 35 §2.x/§3.x headings have exactly one row,
  no row names a section that does not exist, and **every index name is an exact prefix of its real
  heading** — names are the heading's own, minus its trailing version/changeset stamp.
- **Measured read contract, old vs new.** Old rule (§1–§3): 1.9 + 395 + 107 = **~505 KB**. New rule
  for a representative phase — §0 (9.8) + §1 (1.9) + two named subsections, e.g. §2.14 Powerups
  (25.8) + §2.14.2 Chain Guard (8.8) = **~46 KB**; a lighter phase, e.g. §2.21 (8.8) + §2.22 (12.9),
  = **~33 KB**. **A ~91–94% reduction**, with nothing deleted.
- GDD 534,526 → 544,406 bytes (+9,880, all of it §0 and the §5.1 clause). `CLAUDE.md` 46,161 →
  48,268 bytes (47.1 KB / 836 lines), inside its new 50 KB ceiling with ~2.9 KB of headroom.

## Known issues

- **⛔ P3–P8 ARE CONDITIONAL ON GATE C.** Lever C (the §2/§3 prose trim) is not authorised. If GATE C
  finds Lever A solved the problem, the changeset closes at P9 with P3–P8 unbuilt — a good outcome,
  the same shape as CS040's no-op P7 (FORK-CS041-B).
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

None for P2. **GATE C is blocking for P3 onward** and carries FORK-CS041-A, -B and -C.

## Next up

- **P2 — GDD §3's Constants cell → a pointer** (~21 KB from one table cell; Sonnet, standard). It is
  scheduled before GATE C so the gate sees both cheap wins before ruling on the expensive one
  (FLAG-CS041-a).
- **Then GATE C**, whose central question needs *one real, normal phase of other work* run under the
  new contract — not a dry read. Its item 5 (FORK-CS041-D) is already answered.
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
