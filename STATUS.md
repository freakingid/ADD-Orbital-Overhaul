# Orbital Overhaul — STATUS
Version: 1.0.0.39 · Changeset: CS039 · Phase: P4 (closed) · Registry: 104 · Levers: 18

## Phase ledger — CS039

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

- Full suite: see this phase's closing session summary for file/pass/fail/skip counts (target:
  zero skips). `node --check` passes on the extracted script.
- Telemetry: five counters agree with their sibling populations (`hitsTaken` reconstructs exactly
  from the `dmgFrom*` sums; `hunterKills` counts all three tiers); thirteen new columns present on
  every pushed row; `cargoSevers` never moves when the pity counter resets. Confirmed via
  `test-cs039-p1/p2/p3.js` and a real captured run (GATE T).
- CS038 (Credits, low-hull glow retune, telemetry opt-in switch, voice repeat suppression):
  confirmed working end-to-end at that changeset's close — see `log/CS038.md`.

## Known issues

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
