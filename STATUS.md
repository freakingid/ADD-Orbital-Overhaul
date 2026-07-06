# Asteroid Field Deluxe — STATUS

Last updated: 2026-07-05 · Build version: 1.1 shipped / v2.0 in design · Last session: refined the v2.0 plan after playtest feedback — added a difficulty-ramp feature (F10) and confirmed a batch of Paul's design decisions; build plan now 9 phases

## Working / verified

Same as before — nothing new has shipped this session. See below for what's now planned.

**Verified headlessly (v1.1, unchanged):**
- Garbage drops, decay, pickup, tow physics, screen-wrap, dock delivery scoring, chain severing all still hold. See prior STATUS entries / GDD Section 2 for detail.

**Not yet verified (needs a real browser):**
- Same v1.1 items as before (tug feel, serpentine visuals, audio, frame rate under load).

## Known issues

- None confirmed for the shipped v1.1 build. See GDD Section 6 for the watch list.

## Balance notes

- v1.1 balance notes unchanged (see GDD Section 6 / prior STATUS entries).
- **New for v2.0 planning:** Feature F3 (Debris Satellites) as specified will increase garbage volume roughly 8× per fully-cleared large lineage. `PLANNED-FEATURES-v2.md` flags this as a required rebalance during Phase 3, not something to guess numbers for now.

## Next up

**Still planning-only — no code has changed.** The naming resolution is confirmed (Paul verified he'd now seen the existing Hunter/Killer Satellite in-game and wants it evolved into the F4 "Hunter Satellite"), and a round of design decisions is locked in.

**Confirmed this session (all now marked in `PLANNED-FEATURES-v2.md`):**
- Hunter Satellite split children **actively home** (relentless pursuit), NOT passive drift — early-game gentleness comes from the difficulty ramp instead.
- Max HP **250** for initial testing; damage numbers, hit-stun (1.0s), knockback (250 px/s), +25 HP milestone bonus, permanent no-continue game-over, unchanged shield — all confirmed.
- World size 3840×2160 confirmed; spawn-within-radius-of-player confirmed; off-screen threat awareness deliberately deferred (parked, not forgotten).
- New **Feature F10 (Difficulty Ramp)** added to address playtest feedback that early waves are too intense: Hunters and both saucers start gentle and ramp slowly via a shared `difficultyFactor(wave)`. Debris Satellite density can rise to fill the calmer, larger world (joint tuning pass with F3).

**Immediate next step:** start **Phase 1 (Larger World & Scrolling Camera)** in a new Claude Code session, using the prompt in `IMPLEMENTATION-PHASES.md`. Attach/have-present all four docs in the project directory. The build plan is now **9 phases** (difficulty ramp was inserted as Phase 4, pushing Hunter redesign to Phase 5).

## Changed this session

- **Added Feature F10 (Difficulty Ramp & Early-Game Pacing)** to `PLANNED-FEATURES-v2.md`: a shared `difficultyFactor(wave)` curve that scales Hunter speed/turn-rate, saucer spawn/fire/aim, and feeds the Debris Satellite density decision. Includes the "Ease players in" design principle.
- **Confirmed/locked** F1 (world size, spawn distribution, deferred off-screen awareness), F2 (HP 250, all sub-decisions), and F4 (active homing) per Paul's answers — updated all the relevant "open question" notes from proposals to confirmed.
- **Reworked `IMPLEMENTATION-PHASES.md` from 8 to 9 phases:** inserted Phase 4 (Difficulty Ramp & Saucer Calming) so the difficulty helper exists before the Hunter redesign wires into it; Hunter Satellites moved to Phase 5; Powerups→6, Gamepad→7, Pause/Options→8, Achievements→9. Fixed all internal cross-references and the dependency diagram; added a deferred-items note (off-screen awareness) to the After section.
- **Updated `asteroid-field-deluxe-GDD.md`:** added Pillar 6 ("Ease players in", marked planned); added a superseded-pending callout to Section 2.6 (Saucers) for the F10 rebalance.

---

### Prior session (planning kickoff) — retained for history
- Added `PLANNED-FEATURES-v2.md` (originally F1–F9) and `IMPLEMENTATION-PHASES.md` (originally 8 phases); added companion-doc pointers and superseded callouts (Sections 2.4 Asteroids, 2.5 Killer Satellite/Wedges, 2.7 Lives) to the GDD; resolved the satellite naming collision into two families (Debris Satellites = asteroid reskin, Hunter Satellites = killer-satellite/wedge redesign).