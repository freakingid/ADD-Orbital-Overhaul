# Orbital Overhaul — STATUS
Version: 1.0.0.40 · Changeset: CS040 · Phase: P8 (closed) · Registry: 110 · Levers: 18

## Phase ledger — CS040

- P1 — Score milestone no longer heals or pays: below `SHIP_MAX_HP` a crossing calls
  `spawnHealthPowerup()` and pings; at `SHIP_MAX_HP` it does nothing. `REPAIR_AMOUNT`/
  `REPAIR_FULL_BONUS`/`game.stats.scoreRepairBonus` deleted outright.
- P2 — Ambient Health spawn cadence is pity-driven off missing hull (`healthGapRoll()`), not a flat
  `[18, 26]` s roll; `POWERUP_HEALTH_GAP` retired. Four new POWERUPS knobs; registry 104 → 108.
- P3 — Health BANKS instead of evaporating at the cap: `applyPowerup()` banks one whole charge
  (`game.healthBank`, cap `DEBUG.healthBankMax`) for any leftover, auto-spent one per damage event;
  overflow counts in `game.stats.hpWasted`. New stroke-only HUD pip row under "HULL". Registry
  108 → 109.
- P4 — The recycle hub's own drop (`deliveryCount === 8`) biases toward a dry powerup budget
  (`hubBias`, `DEBUG.hubDryWeightMult` = 4) — a supply-starvation relief valve, composing with
  guard's existing eligibility gate and pity weight. Registry 109 → 110.
- P5 — Telemetry v4: 44 → 49 columns. Out: `scoreRepairBonus`. In: `hunterCount`/`debrisCount`/
  `garbageCount`/`healthBanked` (instantaneous), `hpWasted` (cumulative), `scoopHits` (a second
  sawtooth). New `Telemetry.flush()` at `killShip()` — a completed run's last row is the death
  frame. Header block 7 → 9 lines (`ringWrapped`/`finalRowIsGameOver`). `TELEMETRY_MAX` 400 → 800,
  persist every 4th snapshot. Envelope `v: 3 → 4`; key name unchanged.
- P6 — Telemetry controls moved off the hidden debug panel onto Options → Telemetry (Capture,
  Sample rate, Copy log); `MENU_OPTIONS` 5 rows → 6. Debug panel's telemetry rows hidden
  (`hidden: true`, not removed — `Telemetry` still reads them there). Capture stays session-only.
- GATE T (closed) — a completely clean gate. None of the seven new knobs needed to move; the
  healing rework, hub resupply and Options telemetry flow all read right.
- P7 — Tuning pass: a no-op, per the phase's own sanctioned outcome for a clean gate. No commit.
- P8 — Closing. `GAME_VERSION` → 1.0.0.40, `TELEMETRY-ANALYSIS-GUIDE.md` v4 section, `CLAUDE.md`/
  `DIFFICULTY-LEVERS.md`/GDD sweep, `DECISIONS.md` pointer, both planning docs archived.

Full narrative for every phase and the gate: `log/CS040.md`.

## Working / verified

- Full suite: **171 files, 171 passed, 0 failed, 0 skipped** on this phase's closing run;
  `node --check` passes on the extracted script. `test-registry.js` confirms registry **110**,
  headers **11**, `LEVERS` **18**, `POWERUP_DROP_TYPES` **5**.
- Healing: `applyPowerup()`'s health arm confirmed as the sole upward writer of `game.ship.hp`;
  the milestone's spawn-only behavior, the pity cadence's monotonic narrowing toward full hull, and
  the bank's auto-spend-below-death-check ordering are each driven through real `update()`/
  `damageShip()` calls in their phase's own test, not reimplemented.
- Recycle-hub bias: a seeded roll confirms the hub's dry-budget bias is byte-identical to an
  unbiased roll once no budget sits at zero, and that `destroyHunter()`/`destroySaucer()` stay
  completely unweighted at full dryness.
- Telemetry v4: a live export was eyeballed end-to-end — 49 columns, `v4` header, `hp=0` final row,
  `finalRowIsGameOver=true`, envelope persisted at `v:4`. `scoopHits`'s decreasing step and
  `cargoDamageEvents`'s exclusion are both proven against a real scoop-level loss, not asserted.
- Options telemetry submenu: Capture ON survives a save/reload cycle correctly reading back OFF
  (session-only, confirmed against a rebuilt module instance over the same store); the minutes
  figure in the Sample rate label is computed from `TELEMETRY_MAX`, not baked in; the panel cursor
  never lands on either now-hidden debug row across 130+ navigation presses.
- CS039 (Telemetry instrumentation, GATE T's `cargoDamageEvents` fix) and CS038 (Credits, low-hull
  glow retune, telemetry opt-in switch, voice repeat suppression): confirmed working end-to-end at
  their own changesets' close — see `log/CS039.md`/`log/CS038.md`.

## Known issues

- **⛔ A FIXED-REF DIFF PIN CROSSED GIT'S RENAME THRESHOLD MID-CS040, and every phase from here on
  should know it exists.** `test-cs024-p6b.js` §G TRAP 5 diffs the build against `79222e5`, a commit
  *before* the CS029 `asteroids-deluxe.html` → `orbital-overhaul.html` rename, relying on git's
  rename-detection to keep it one renamed file rather than a whole-file delete plus add. Repaired by
  pinning the threshold explicitly (`--find-renames=20%`), which buys until roughly 39,000 lines.
  **Any other fixed-ref pin reaching back past CS029 has the same latent failure** — none found so
  far, but nobody has swept for one.
- **`test-cs037-p4.js` §H's `Bench.running` guard count is now 10** (was 9 pre-CS039). The count is
  a pin, not a list, and it moves when the seal legitimately grows.
- **CLAUDE.md documentation debt: one item remains.** `Achievements.save()` is no longer
  `afd_achievements_v2`'s only writer, and `mergeUnlock()` goes unnoted (flagged CS037 P6, not
  telemetry- or healing-adjacent — deferred again).
- **CS039 GATE T's own capture is waves 1–5, not the wave 10+ a deeper analysis wants, and predates
  `cargoSevers`/the whole CS040 healing rework.** A second, deeper capture on the v4 build (waves
  10+, ideally spanning a delivery-hub-relief episode) would both generalize GATE T's n=1 tow-length
  finding and give the healing rework's `hpWasted`/`healthBanked`/`hunterCount` columns their first
  real-play validation beyond CS040's own GATE T session.
- **The late-wave frame hiccup's cause remains unmeasured** (CS037 Gate A null result).
- **Two unseeded-test flakes stand:** `test-cs035-p3` §F (~5%), `test-f6` §F (~1.7%). A rerun is the
  standing way to tell either from a real regression.
- **⛔ FLAG-CS036-a stands.** `saveSettings()` writes a full snapshot of every debug knob, and
  `loadSettings()` re-applies it over the registry defaults with `debugOverride` defaulting ON —
  any installation that has ever saved settings is not running shipped defaults. Clear "Overrides
  Applied" (or reset all debug knobs) before any future gate's numeric questions.
- **Four moving-`HEAD` test pins survive, passing vacuously on a clean tree:** `test-cs023-p3.js`
  (the `debrisBounce` line count and the byte-strict `shieldDeflect`/`shieldBounce` compare),
  `test-cs024-p6.js` §H TRAP 2, and `test-cs025-p4.js` TRAP 3. Each needs a fixed SHA chosen and the
  intervening diffs named.
- **`navigator.clipboard` is unavailable on `file://` in several browsers.** The benchmark's and
  telemetry's copy rows (now reachable from both the debug panel and Options → Telemetry) both fall
  back to a CSV Blob download and say which happened. Untested in a real browser.
- **Carried forward, unaffected by CS040** — full detail in each item's own changeset log:
  parking at the Recycle dock no longer cleans up around the ship (CS035 P2's lockout, dock-apron
  question below); `FLAG-CS032-a`, `drawTitleMenu()` calling `SaveSlots.count()` every frame
  (deliberate, CS032 §4.3); the slots-screen LOAD-mode cursor landing on "Options" (CS032);
  `test-registry.js`'s `FLAG-CS027-d`/`FLAG-CS027-c`; the CS028 piece-distinctness call (leave as
  is, Paul's gate call); thirteen suite files hard-failing rather than skipping on a shallow clone
  (CS034 P9); satellite-vs-satellite bounce/damage never playtested (CS023);
  `blankLegacyStores()`'s unguarded `Achievements.save()` call (CS034 P6, harmless, profile-delete
  only); the four-times-declined delivery-ticker ship-anchor idea (`log/CS029.md`/`log/CS026.md`);
  `game_version`/per-player leaderboard queries deferred to `coinless-kit` (`log/CS034.md`).

## Open questions (blocking)

None.

## Next up

- **CS041 is not yet started.**
- `CS039-VOICE-WORKLIST.md` (written CS038 P7) still records which voice events most need line
  alternatives and why, for Paul's next `tools/voice-robot-lab.html` session — still unconsumed.
- **The first thing any future gate should do is clear the debug overrides** (FLAG-CS036-a).
- A second, deeper telemetry capture on the v4 build (waves 10+) would turn CS039 GATE T's T4
  finding (mean tow length rising, not collapsing, as score rate falls) from n=1 into something
  actionable, and would be the first real-play look at CS040's `hpWasted`/`healthBanked`/
  `hunterCount` columns outside GATE T's own session — see Known issues above.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade`/`levelEndGracePulseEnd` for the ship pulse, and
  `hunterPulseMin`/`Max`/`Grow`/`Shrink` for the heartbeat.
- **Does the caption expiring mid-freeze read right?** With captions on, Dan's "Level N" caption
  ages during the frozen tail instead of holding, so it can vanish while the field is still
  stopped. Never asked at a gate.
- **Does the dock apron read as pressure or as litter?** CS035 P2's lockout means a parked ship no
  longer cleans up around itself. Nobody has played a long session against that yet.

## Balance notes

- **`COMBO n/N`'s denominator is still unrepresented (from CS026)** since the HUD row was dropped
  (accepted risk).
- **The UFO difficulty chain goes fully flat past level 65 (CS024/CS025)** — junk saturates at
  L41, hunters at L33. Fix if wanted is a step-count increase, no mechanism change.
- **`DEBRIS_BOUNCE_RESTITUTION`/`_MIN` are both first-pass and browser-unverified (CS023).**
- **Hunter Debris supply halved (CS034 P3), confirmed right-sized at a wave-12 playtest.** Not
  verified past wave 12.
- **G20 says the game is no longer too easy**, and CS036's H1 says the level end now reads as a
  deliberate beat. Hunter volatility remains the answer to the former.
- **CS037 (C+F together) rated 5/10** — balanced, does not push late-wave play toward small hauls.
- **CS039 GATE T's measurement: Hunters carry the run, not delivery.** ~56% of score and 65% of
  damage in that one analysed run came from Hunters; delivery income (26%) and the two refund
  bonuses (4%) were minority streams. **CS040 removed one of those two refund-bonus terms
  (`scoreRepairBonus`) outright**, so the score composition has shifted again since that
  measurement — not yet re-run, a candidate for the next telemetry capture above.
