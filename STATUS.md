# Orbital Overhaul — STATUS
Version: 1.0.0.39 · Changeset: CS040 · Phase: P3 · Registry: 109 · Levers: 18

## Phase ledger — CS040

- P1 — The score milestone no longer heals or pays: below `SHIP_MAX_HP` a crossing calls
  `spawnHealthPowerup()` (the ambient placement path, reused) and pings; at exactly `SHIP_MAX_HP` it
  does nothing and makes no sound (FORK-CS040-A). `game.nextRepair` still advances on every crossing.
  `REPAIR_AMOUNT`, `REPAIR_FULL_BONUS` and `game.stats.scoreRepairBonus` deleted outright, zero
  consumers left. `REPAIR_MILESTONE` stays 10,000 (FORK-CS040-B). GDD §2's two milestone/health
  bullets and §2.12's hull-full parenthetical corrected in place.
- P2 — Ambient Health spawn cadence is now pity-driven instead of a flat `[18, 26]` gap.
  `POWERUP_HEALTH_GAP` retired outright; `healthGapRoll()` (mirrors `guardDropWeight()`'s shape)
  lerps `[HEALTH_GAP_LOW_HURT, HEALTH_GAP_HIGH_HURT]` (6–10s at zero hull) to
  `[HEALTH_GAP_LOW_OK, HEALTH_GAP_HIGH_OK]` (22–30s at full hull) on `game.ship.hp / SHIP_MAX_HP`.
  Both existing re-roll sites (resetRun seed, ambient spawn) repointed; no re-roll added on the
  damage path (would let a player farm spawns by tanking hits). Four new POWERUPS registry knobs
  (`healthGapLowOk/HighOk/LowHurt/HighHurt`), not levers — same "flat knob off a shipped const"
  treatment as `engineBurnSeconds`. Registry 104 → 108; `LEVERS.length` unmoved at 18.
  **Thirteen other-phase test files needed narrowing repairs** (same idiom CS040 P1 used on
  `test-cs020-p1`/`test-cs039-p1`): each asserts an exact registry order/count/diff against its own
  parent SHA, and a new trailing POWERUPS row falsifies all of them the same way. Widened by name,
  not wildcarded — `test-cs024-p6b/c`, `test-cs025-p1/p2/p5`, `test-cs026-p2/p3/p5/p6`,
  `test-cs027-p2/p6`, `test-cs029-p4`, `test-cs030-p1`, `test-cs038-p5`.
- P3 — Health BANKS instead of evaporating at the cap. `applyPowerup()`'s health arm now applies only
  what the hull has room for and banks the remainder as a WHOLE charge worth `POWERUP_HEALTH_AMOUNT`
  (`game.healthBank`, 0..`DEBUG.healthBankMax`); past the cap the leftover HP lands in the new
  cumulative `game.stats.hpWasted` (P5's telemetry column is its only planned consumer). One charge
  auto-spends per damage event at `damageShip()`'s single hull-reduction site, beside the `dmgFrom*`
  switch and BELOW the `s.hp <= 0` exit — so a lethal hit is never rescued, and the counters above it
  still read the trough the hit caused. New `AudioSys.bankspend()` for that moment: a swelling sine
  dyad with a 0.12 s pre-delay, so it is not masked by `hit()` and cannot be confused with `powerup()`
  or `shieldPing()`. HUD tell (FLAG-CS040-d, overridden to required): a segmented pip row under the
  "HULL" label, `drawRingSegments()` at `HUD_BANK_PIP_R`/`_DY`, always drawn, stroke-only, measured
  clear of the CARGO cluster. `healthBank` is additive in the save envelope, no schema bump. One new
  POWERUPS knob (`healthBankMax`, min 0 disables the mechanic); Registry 108 → 109, `LEVERS` unmoved
  at 18. **Fourteen other-phase pins narrowed again** — the same trailing-registry-row family P2
  repaired, plus `test-cs026-p3` §G TRAP 5 (`resetRun()` gained `game.healthBank = 0;`).

## Phase ledger — CS039 (closed; full narrative in `log/CS039.md`)

- P1 — Five new per-run counters on `game.stats` (`hunterKills`, `hitsTaken`, `deliveryScore`,
  `scoreRepairBonus`, `scoreScoopBonus`), each flat and incremented at one site. Nothing reads
  them yet — no output changed.
- P2 — Thirteen new telemetry columns built from P1's counters plus `chainLen`/`cargoMax`.
  Persistence envelope `v: 1 → 2`; storage key `afd_telemetry_v1` unchanged.
- P3 — A seven-line `#`-comment lever fingerprint prepended to the telemetry CSV export
  (`build`/`overrides`/`telemetryInterval`/`rows`/`source`/`levers`), reporting **effective**,
  not edited, lever values.
- GATE T (closed) — First real capture (`LEVEL-5-TELEMETRY.csv`, waves 1–5). Confirmed the `#`
  carrier survives a clipboard round-trip and killed a standing ~14% delivery-income estimate
  (measured refund share 3.75%; Hunter kills ~56% of score). Caught `cargoDamageEvents`
  misdocumented as cumulative in four places at once (it is a pity counter that resets on each
  guard drop) — fixed at the gate with a new `game.stats.cargoSevers` (44th column) and envelope
  `v: 2 → 3`, a deliberate override of P2's own "one shape per changeset" rule.
- P4 — Closing. `GAME_VERSION` → 1.0.0.39, `CLAUDE.md` gained a Telemetry pin and the
  `afd_telemetry_v1` Save-data entry (closing two-changeset-old doc debt), GDD checked and left
  untouched (telemetry is a dev instrument with no shipped player-facing behavior beyond what's
  already documented), `IMPLEMENTATION-PHASES-CS039.md` archived, STATUS.md pruned.

Full narrative for every phase and the gate, including the fork resolutions and the GATE T
decision verbatim: `log/CS039.md`.

## Working / verified

- **CS040 P1:** full suite 166 files, 166 passed, 0 failed, 0 skipped (baseline before the phase was
  165/165/0/0 — the extra file is `test-cs040-p1.js`). `node --check` passes on the extracted script.
  The new test is non-vacuous against the parent build at `1ee9eed`, checked directly: that build
  heals +25 HP and spawns nothing on the same crossing.
- **CS040 P2:** full suite 167 files, 167 passed, 0 failed, 0 skipped (the extra file over P1's 166
  is `test-cs040-p2.js`; the thirteen narrowed pins listed above are counted in this total, not
  separately). `node --check` passes on the extracted script. `test-cs040-p2.js` §B–§E sample the
  roll at full hull, zero hull, half hull and five points in between, confirming the range narrows
  monotonically as hull drops; §F confirms all four registry knobs and that none reached `LEVERS`.
- **CS040 P3:** full suite 168 files, 168 passed, 0 failed, 0 skipped (the extra file over P2's 167 is
  `test-cs040-p3.js`; the fourteen narrowed pins are counted in this total, not separately).
  `node --check` passes on the extracted script. ⚠ The suite is only green **after** the phase's commit
  lands: `test-cs024-p6.js` §H TRAP 2 pins `damageShip` byte-for-byte against `git show HEAD`, so a
  phase that edits that function is red on a dirty tree by construction. Nothing else in the file fails.
- **`scratchpad/_harness.js` gained one additive option, `ctxLog`** — an array the 2D-context stub
  records method calls and tracked property writes into, so a draw contract can be MEASURED against the
  real draw path. Same shape and same justification as CS036 P2's `listeners`: three suite files
  (`test-cs009-p2`, `test-cs012-p2`, `test-cs038-p6`) each hand-rolled a whole sandbox for want of it,
  which the test rules bar for new files. Pass nothing and the stub is byte-identical to before.
- Telemetry: five counters agree with their sibling populations (`hitsTaken` reconstructs exactly
  from the `dmgFrom*` sums; `hunterKills` counts all three tiers); thirteen new columns present on
  every pushed row; `cargoSevers` never moves when the pity counter resets. Confirmed via
  `test-cs039-p1/p2/p3.js` and a real captured run (GATE T).
- CS038 (Credits, low-hull glow retune, telemetry opt-in switch, voice repeat suppression):
  confirmed working end-to-end at that changeset's close — see `log/CS038.md`.

## Known issues

- **⛔ CS040 P5 MUST remove the `scoreRepairBonus` telemetry column.** P1 deleted the counter behind
  it but left `TELEMETRY_FIELDS` alone by instruction, so `Telemetry.push()` now emits a **literal 0**
  for that column with a comment saying so. Left reading the deleted counter it would have serialised
  as an **empty cell** (`Array.join` renders `undefined` as `""`), and `test-cs039-p2` §F's
  monotonicity walk would have gone red on `NaN`. The 0 is honest — the value can no longer be
  anything else — but the column is dead weight until P5 drops it.
- **Two other-phase tests were repaired by CS040 P1, both narrowings rather than deletions.**
  `test-cs020-p1.js` §J now excludes `score` from its bit-identical cross-build loop (PRE_FIX_REF
  still pays the retired full-hull bonus; the gap is pinned at exactly `crossings ×
  REPAIR_FULL_BONUS`, read off the pre-fix module, since HEAD has neither symbol left).
  `test-cs039-p1.js` lost §E and one of its five `NEW_FIELDS` — the counter it pinned is gone.
  `test-f2.js` §(e/f) was repointed to the new contract and its two constants dropped from the
  hand-rolled return list.
- **⛔ GDD debt for CS040 P8 (the doc sweep): health banking is player-facing shipped behaviour and is
  not in the GDD yet.** §2's healing bullets, §2.14's powerup section and §3.2's HUD inventory all need
  the bank, the auto-spend and the HULL pip row written in. P3's prompt scoped no doc edit and P8 owns
  the sweep, so this is deferred deliberately, not forgotten. FLAG-CS040-f (always-drawn vs
  only-when-non-zero pips) is GATE T's call and may change what gets written.
- **CLAUDE.md documentation debt: one item remains, one closed this phase.** `afd_telemetry_v1`
  now documented as the sixth Save-data key (closed CS039 P4, flagged CS037 P4). Still open:
  `Achievements.save()` is no longer `afd_achievements_v2`'s only writer, and `mergeUnlock()` goes
  unnoted (flagged CS037 P6, not telemetry-adjacent — deferred again).
- **GATE T's own capture is waves 1–5, not the wave 10+ a deeper analysis wants, and predates
  `cargoSevers`.** T4 (does tow length collapse with score rate?) is an n=1 finding on that log
  and answered "no, the opposite" — wants a second, v3-build capture to generalize. A candidate
  second log (`LEVEL-10-TELEMETRY.csv`) is sitting untracked at the repo root but has not been
  analyzed as part of this changeset.
- **The late-wave frame hiccup's cause remains unmeasured** (CS037 Gate A null result — every
  entity population cleared the benchmark's ceiling by >12×, so the actual cause is still open).
- **Two unseeded-test flakes stand:** `test-cs035-p3` §F (~5%), `test-f6` §F (~1.7%). A rerun is
  the standing way to tell either from a real regression.
- **⛔ FLAG-CS036-a stands.** `saveSettings()` writes a full snapshot of every debug knob, and
  `loadSettings()` re-applies it over the registry defaults with `debugOverride` defaulting ON —
  any installation that has ever saved settings is not running shipped defaults. Clear "Overrides
  Applied" (or reset all debug knobs) before any future gate's numeric questions.
- **Four moving-`HEAD` test pins survive, passing vacuously on a clean tree:** `test-cs023-p3.js`
  (the `debrisBounce` line count and the byte-strict `shieldDeflect`/`shieldBounce` compare),
  `test-cs024-p6.js` §H TRAP 2, and `test-cs025-p4.js` TRAP 3. Each needs a fixed SHA chosen and
  the intervening diffs named.
- **`navigator.clipboard` is unavailable on `file://` in several browsers.** The benchmark's and
  telemetry's copy rows both fall back to a CSV Blob download and say which happened (now also
  true of P3's fingerprinted export). Untested in a real browser.
- **Carried forward, unaffected by CS039** — full detail in each item's own changeset log:
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

- `CS039-VOICE-WORKLIST.md` (written CS038 P7) records which voice events most need line
  alternatives and why, in priority order, for Paul's next `tools/voice-robot-lab.html` session —
  no `phon` composed there, per the standing rule. Still unconsumed.
- **The first thing any future gate should do is clear the debug overrides** (FLAG-CS036-a).
- A second, deeper telemetry capture on the v3 build (waves 10+) would turn GATE T's T4 finding
  (mean tow length rising, not collapsing, as score rate falls) from n=1 into something
  actionable — see Known issues above.

## Playtest asks (open only — answered ones move to the log)

- **H6, H10 and H11 come back**, all three under FLAG-CS036-a's remedy: clear the debug overrides
  first, then ask for **numbers** — `levelEndFade`/`levelEndGracePulseEnd` for the ship pulse, and
  `hunterPulseMin`/`Max`/`Grow`/`Shrink` (plain constants as of CS038 P5, still askable) for the
  heartbeat.
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
- **GATE T's measurement: Hunters carry the run, not delivery.** ~56% of score and 65% of damage
  in the one analysed run came from Hunters; delivery income (26%) and the two refund bonuses
  (4%) are minority streams. Not yet a design call — a measurement worth having next time the
  score mix comes up.
