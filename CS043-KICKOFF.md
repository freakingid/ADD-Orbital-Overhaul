# CS043 — Kickoff prompt: remove the level-end pause

Written off-cycle 2026-09-09 from a playtest conversation with Paul. Parent commit `2532b16`
(`1.0.0.42`, CS042 closed). Every line number below was read at that commit and should be
re-confirmed, not trusted.

## 0. How to use this file

Read `CLAUDE.md`, then `STATUS.md`, then this. Then produce `PLANNED-FEATURES-CS043.md` and
`IMPLEMENTATION-PHASES-CS043.md` for Paul's review. **Do not write a build byte until he has
reviewed them.** §5 holds two questions that are genuinely his and that change the shape of the
work; put them to him before writing phases.

This file is a design brief, not a spec. It carries Paul's decision and the inventory one session
already did. It does not decide phase order, gates, or tests.

## 1. The problem, in Paul's words

> When a level ends, we pause to say "Level complete", then we show an achievement panel if
> applicable, then we show the next level announcement. One awkward and annoying situation occurs
> when the player ship is in the middle of some satellites and blasting them, in a precarious
> position, and suddenly the "Level complete" message appears, which pauses the action. While the
> player is not in immediate danger, and gameplay will resume at the next level with the player
> enjoying invulnerability for a time, it feels scary to the player. It feels like control is being
> taken away, and that is not good.

The complaint is about **when the beat lands**, not that a beat exists. The wave-clear condition
reads `game.debris` only, so Hunters, saucers and loose Debris are all still live and still hunting
at the moment everything stops. The stop can and does land mid-fight.

## 2. The decision

Four options were put to Paul. He chose **option 1: delete the beat.** Four parts, all of them:

- **a.** No freeze on wave clear. The field never stops at a level boundary.
- **b.** No "Level N Complete" announcement, and no confirm press to get past it.
- **c.** No achievement panel at the level seam. The panel is shown **at game over only**. In-play
  recognition is the existing unlock toast plus `AudioSys.achievement()`, both of which already fire
  at `Achievements.onUnlock()` and need no new code.
- **d.** The "Level N" banner moves from screen centre to about **a third of the way down from the
  top**, out of where the action is.

⛔ **This knowingly reverses the whole of CS036 (P1/P2/P3) and half of CS042 P5.** CS036 built the
freeze, the completion announcement and the extended tail; CS042 P5 gave the announcement its
out-dissolve. `STATUS.md`'s own balance notes record that CS036's H1 playtest said the level end
"reads as a deliberate beat" — that finding is not being called wrong, it is being outweighed by
where the beat lands. **Record the reversal in `DECISIONS.md` and in `log/CS043.md`** so a future
session cannot read the deletion as a tidy-up mistake. Paul is the one reversing it.

## 3. Inventory — what option 1 touches

### Deleted outright

| Site | Line at `2532b16` | Note |
|---|---|---|
| `updateLevelEndFreeze()` | 12642 | And its branch in `update()` just below. Its five documented jobs all belong to the playing body once nothing freezes. |
| `levelDoneActive()` | 13749 | Three readers: `drawLevelDone()` and both input handlers. |
| `dismissLevelDone()` | 13781 | Carries the celebration fork and one `AudioSys.achievement()` call. |
| `drawLevelDone()` / `drawLevelDoneText()` | 13830 / 13845 | |
| Keyboard `levelDoneActive()` branch | 3750 | |
| Gamepad `levelDoneActive()` branch | 3844 | ⛔ Both handlers or neither — the CS030 P4 rule. |
| `game.levelDone` / `game.levelDoneOut` / `game.levelEndFreeze` | 9677, 9686, 9703 | Plus their `resetRun()` resets at 9984-9990. |
| `LEVEL_DONE_HINT` / `LEVEL_DONE_HINT_DY` | 3023 | |

### Changed

- **`update()`'s wave-clear latch, 13612.** The `=== 0` latch **stays** — it still owns the
  protection window's arm and the Perfect Wave / No Scratches / Flawless Run block. What changes is
  that it calls `nextWave()` directly instead of arming a freeze and an announcement.
  ⛔ **The achievement block must stay at the latch and stay above `nextWave()`** — it reads
  `game.wave` as the *completed* wave, and `nextWave()` increments it.
- **`LEVEL_BANNER_Y`, 3012 (default `24`), and the `levelBannerY` registry row, 4812.** The offset is
  measured from `VIEW_H/2`. A third of the way down a 720-high view is y 240, so the offset is
  **-120**, comfortably inside the row's -200..200 range. Once `drawLevelDone()` is gone,
  `drawLevelBanner()` (13718) is the only reader.
- **`dismissCelebration()`, 14973.** Its `resume: "wave"` fork becomes unreachable; the panel is only
  ever opened by `killShip()` now. Decide whether to delete the fork or leave it. Do not leave it
  half-deleted.
- **`tickCeremony()`, 15763.** Loses `levelDoneOut`. Check what it still has to do.
- **`CEREMONY_ANNOUNCE_OUT`, 3040.** Loses one of its users. Confirm the other survives before
  deleting the constant.
- **`AudioSys.achievement()` at 13797** goes with `dismissLevelDone()`. This removes a **duplicate
  fanfare**: today a level-seam unlock plays the cue once at unlock and again seconds later when the
  panel opens. After CS043 it is one per unlock, plus one when the game-over panel opens.

### Survives, and matters more than before

- **`tickLevelBanner()`, 12568** — the grace arm. ⛔ Its crossing one-shot idiom and its
  `game.levelEndSafe` clause are both load-bearing and neither may be simplified. `startGame()` calls
  `nextWave()` for wave 1, and without that clause every run would open with free invincibility.
- **`levelEndGrace` / `levelEndFade` / `levelEndGracePulseEnd`, 4870-4874.** All three stay. See §5 Q2.
- **`killShip()`'s panel open, 12543**, and the panel's own freeze. Untouched.

## 4. What must not change

- ⛔ **`nextWave()` (10134) still must not zero the level-end fields** — its comment at 10147 says so
  in terms and names the tidy-up pass that would add it "harmlessly." The reason survives option 1:
  the protection window still spans the call.
- ⛔ **`game.pendingAch` is a flushed bucket, never filtered by `game.wave`** (CS030 §0.4). Under
  option 1 the bucket now spans a whole run instead of one level, which makes that rule *more*
  live, not less. Do not add a wave stamp to "tidy" the ordering.
- ⛔ Achievement `id` values are save data. Nothing here renames one.
- ⛔ Registry totals live in `scratchpad/test-registry.js` and nowhere else. Deleting registry rows,
  if any go, updates that one file.
- ⛔ New tests use `scratchpad/_harness.js`, and phase-local pins use `scratchpad/_phase-ref.js` with
  a literal parent SHA, never `HEAD`.
- ⚠ `test-cs024-p6.js` §H TRAP 2 diffs `damageShip` against `HEAD` and goes red from the first edit
  until the commit lands. If a phase touches `damageShip`, expect it and re-run after committing.

## 5. Questions for Paul — the first two are blocking

**Q1. The world resize is the real hazard, not the announcement.** `nextWave()` relocates the Recycle
dock, spawns the new field in a ring around the ship, and on roughly two levels in three calls
`resizeWorld()` (9736), which **teleports the ship to the centre of the new world** and drags every
other body along its own bearing toward it. Under a frozen field the player never feels that. Live,
it is arguably a larger loss of control than the pause CS043 is removing. Three ways:

- **(a)** Ship it live and judge it in a playtest, leaning on the protection window to cover it.
- **(b)** Hold the resize until a lull, letting the level roll over immediately and the world change
  a moment later.
- **(c)** Keep a short freeze on resize levels only.

**Q2. How long should the player be protected, and what tells them?** With no freeze,
`game.levelEndSafe` now covers **real play** from the clear, through the banner, through the grace.
At shipped knobs that is roughly the banner's hold plus `levelEndGrace`. Paul should give a number he
wants to feel, not a knob value. Also: does the ship keep its alpha pulse for the whole window, or
only for the grace as it does today? ⛔ Ask by outcome, and clear the debug overrides first —
FLAG-CS036-a means a saved settings blob is not running shipped defaults.

**Q3, not blocking.** With the panel gone from the level seam, a toast at the top of the screen and a
short triad are the only things marking an unlock in play, and a toast is easy to miss in a firefight.
Ask whether that carries enough weight. If not, it is a one-cue question, not a new mechanism.

## 6. Housekeeping

- ⛔ **`GAME_VERSION` goes to `1.0.0.43`.** The 4th segment is the changeset number. Write the literal
  in the phase doc; do not write "the next integer." CS042 shipped `.41` from that mistake and `.41`
  is now a permanent gap that must not be back-filled. `DECISIONS.md`, 2026-09-08.
- **GDD sections this will touch:** the level-end / wave-clear ceremony, the achievement celebration
  panel, and the level banner. Read `§0` and `§1`, then the `§2.x`/`§3.x` rows §0 names for those.
  ⛔ If §0 has no row for something you edit, that is a defect in §0 — record it in `STATUS.md`.
- **The closing phase re-measures every §0 size row** and re-reads the GDD's build stamp.
  `scratchpad/gdd-sizes.py --check` does the table in one command.
- ⛔ **`CLAUDE.md` is already ~1.25 KB over its 50 KB ceiling and its size valve is spent
  (FLAG-CS041-b, `STATUS.md`).** CS043 deletes rules as well as adding them, so it may come out
  ahead. A phase still may not silently drop a rule to fit, nor silently valve an under-size section.
- **If there is room,** `STATUS.md` names the most ready backlog items: four stale build and suite
  comments, four surviving moving-`HEAD` pins, and Paul's deferred event-SFX retune. ⛔ Any SFX
  retune is a `tools/sfx-lab.html` session, never a hand-edit — the twelve methods are pinned
  byte-for-byte against `CS042-GATE-A.md`.
