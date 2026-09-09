# PLANNED-FEATURES-CS043.md — Remove the level-end pause

**Base:** `2532b16`, `GAME_VERSION 1.0.0.42` → **`1.0.0.43`**.
**Source:** `CS043-KICKOFF.md`, written off-cycle 2026-09-09 from a playtest conversation with Paul.
**Reads with:** `IMPLEMENTATION-PHASES-CS043.md` (build order + phase prompts).

⛔ **This changeset DELETES a shipped feature that a playtest gate approved.** CS036 (P1/P2/P3) built
the level-end freeze, the "Level N Complete" announcement and the extended frozen tail; CS042 P5 gave
the announcement its out-dissolve; CS036's own H1 playtest found that the level end "reads as a
deliberate beat." **That finding is not being called wrong.** It is being outweighed by *where the
beat lands* — mid-fight, with Hunters and saucers still live, at a moment the player did not choose.
Paul is the one reversing it. The reversal is recorded in `DECISIONS.md` and in `log/CS043.md` so a
future session cannot read the deletion as a tidy-up mistake.

---

## §0. The problem, in Paul's words

> When a level ends, we pause to say "Level complete", then we show an achievement panel if
> applicable, then we show the next level announcement. One awkward and annoying situation occurs
> when the player ship is in the middle of some satellites and blasting them, in a precarious
> position, and suddenly the "Level complete" message appears, which pauses the action. While the
> player is not in immediate danger, and gameplay will resume at the next level with the player
> enjoying invulnerability for a time, it feels scary to the player. It feels like control is being
> taken away, and that is not good.

The wave-clear condition reads `game.debris` **only** (§2.7, CS015 P3). Hunters, saucers and loose
Debris are all still live and still hunting at the instant everything stops. The stop can and does
land mid-fight. The complaint is about **when the beat lands**, not that a beat exists — and Paul's
chosen remedy is to remove the beat rather than to move it.

## §0.1 Four decisions, all Paul's, all taken

Four options were put to Paul off-cycle. He chose **option 1: delete the beat**, in four parts:

- **a.** No freeze on wave clear. The field never stops at a level boundary.
- **b.** No "Level N Complete" announcement, and no confirm press to get past it.
- **c.** No achievement panel at the level seam. The panel is shown **at game over only**.
- **d.** The "Level N" banner moves from screen centre to about a third of the way down.

Four further questions were put to him at the start of this planning session (§7 records the two the
kickoff got wrong). His answers:

| # | Question | Answer |
|---|---|---|
| **Q1** | `resizeWorld()`'s ship teleport, now that it is known to fire **once per run** | **Ship it live**, judge it in the playtest |
| **Q2** | Satellites spawning 220 px from a moving ship at every boundary | **Push the inner radius out** for live spawns |
| **Q3** | How long the player should feel protected after a clear | **About what today's live part gives (~3.5 s)** |
| **Q4** | Whether toast + `AudioSys.achievement()` carry an unlock on their own | **Yes, enough** — no work |

---

## §1. The deletion

Line numbers were read at `2532b16` and **re-confirmed during this planning session**. They are
navigation aids only — phases anchor by symbol name.

### §1.1 Deleted outright

| Site | Line | Note |
|---|---|---|
| `updateLevelEndFreeze()` | 12642 | And its branch in `update()` at 12684. Its five documented jobs all belong to the playing body once nothing freezes. |
| `levelDoneActive()` | 13749 | Three readers, all deleted with it. |
| `dismissLevelDone()` | 13781 | Carries the celebration fork (→ §2) and one `AudioSys.achievement()` call (→ §1.4). |
| `drawLevelDone()` / `drawLevelDoneText()` | 13830 / 13845 | Plus the `drawLevelDone()` call at `draw()`'s line 15260. |
| Keyboard `levelDoneActive()` branch | 3750 | |
| Gamepad `levelDoneActive()` branch | 3844 | ⛔ **Both handlers or neither** — the CS030 P4 rule. |
| `game.levelEndFreeze` / `game.levelDone` / `game.levelDoneOut` | 9677 / 9686 / 9703 | Plus their `resetRun()` resets at 9984 / 9985 / 9990. |
| `LEVEL_DONE_HINT` / `LEVEL_DONE_HINT_DY` | 3023 | The whole line. |
| `CEREMONY_ANNOUNCE_OUT` | 3040 | **Confirmed: its only two readers are both inside the deleted functions** (13791, 13840). `CEREMONY_PANEL_FADE` and `CEREMONY_GAMEOVER_IN` share the declaration line and both survive — edit the line, do not delete it. |
| `tickCeremony()`'s `levelDoneOut` arm | 15765-15768 | The other three arms survive; see §1.3. |

### §1.2 The wave-clear latch — changed, not moved

`update()`'s `game.waveClearTimer === 0` latch at 13612 **stays exactly where it is.** It still owns
the protection window's arm (`levelEndSafe = true; levelEndPulseT = 0`) and the Perfect Wave / No
Scratches / Flawless Run block. What changes is what it does next:

```
  BEFORE                          AFTER
  levelEndFreeze = true           (deleted)
  levelDone = {...}               (deleted)
  resetMenuNav()                  (deleted — see below)
  <achievement block>             <achievement block>   ← UNMOVED
                                  nextWave()            ← new, LAST
```

⛔ **The achievement block stays at the latch and stays ABOVE `nextWave()`.** It reads `game.wave` as
the *completed* wave — Perfect Wave, `noScratchWave3` and `flawlessLateWave` all depend on that — and
`nextWave()` increments it. This is the same ordering constraint CS036 P2 recorded when it moved the
block here; the constraint survives the deletion of everything around it.

⛔ **`resetMenuNav()` goes.** Its own comment says it was belt-and-braces for a field stopping under a
held stick. Nothing stops now, and no screen takes input at this seam, so it has no consumer. The
celebration panel's own `resetMenuNav()` at `killShip()` is a different call and stays.

⚠ **`game.waveClearTimer` itself survives and still counts.** The `+= dt` / `else = 0` pair is what
makes the latch a latch. Nothing else reads the accumulated value, but removing the accumulation
would remove the latch, and the latch must fire exactly once per clear.

### §1.3 What `tickCeremony()` still has to do

Three of its four arms survive: `celebrationOut` (the game-over panel's dissolve still exists),
`celebrationT` and `gameoverT`. Its header's justification is unchanged — the panel's fade-in runs
while `game.celebration` is set, which is precisely the term `update()` early-returns on. **The
function is not a candidate for deletion or for folding back into `update()`.**

Its header names the announcement's dissolve in two places as an example. Those sentences get
rewritten in place, not deleted, in the phase that removes the arm.

### §1.4 A duplicate fanfare disappears, and that is a fix

`dismissLevelDone()` calls `AudioSys.achievement()` when it opens the level-seam panel. Today a
level-seam unlock therefore plays that cue **twice**: once at `Achievements.onUnlock()` during play,
and again seconds later when the panel opens. After CS043 it is one per unlock, plus one when the
game-over panel opens. Not a new decision — a consequence of §2, recorded so it is not read as a
regression.

---

## §2. The celebration panel becomes game-over-only

`dismissCelebration()` (14973) forks on `c.resume`: `"wave"` is the level-end panel and owes the
deferred `nextWave()`; `null` is the game-over panel and owes nothing. With `dismissLevelDone()` gone,
**`killShip()` (12543) is the only thing that opens the panel, and it stamps `resume: null`.** The
`"wave"` fork is unreachable.

⛔ **Delete the fork, do not leave it.** The kickoff says "decide whether to delete the fork or leave
it; do not leave it half-deleted." Deleting it whole is the call: an unreachable branch calling
`nextWave()` from a panel dismissal is exactly the shape a future session would either resurrect or
trip over. That means, together and in one phase:

- `dismissCelebration()` loses `const resume = c ? c.resume : null;` and `if (resume === "wave") nextWave();`.
- The `resume` field is dropped from the object `killShip()` builds and from `celebrationOut`'s snapshot.
- `drawCelebration()`'s `resume`-derived sub-line loses its fork and keeps the game-over wording only.
- The headers on all four functions are **rewritten in place**, not deleted. Their two-call-site
  reasoning is the historical record of why the panel is shaped as it is.

⚠ **`celebrationOut.wave` STAYS.** Its purpose was never the level-end site alone: it stops the ghost
reading `game.wave` live. `nextWave()` no longer runs on the line below, so the pressure is off — but
the snapshot is correct as written and there is no reason to make it live again.

⛔ **`game.pendingAch` is a flushed bucket, never filtered by `game.wave`** (CS030 §0.4). Under CS043
the bucket spans a **whole run** instead of one level, which makes that rule *more* live, not less. A
long run now opens one panel at game over listing every unlock it earned. **Do not add a wave stamp to
"tidy" the ordering.** The panel already scrolls (`celebrationScroll()`), so a long list is a shipped,
handled case rather than a new one.

---

## §3. The banner moves up

`LEVEL_BANNER_Y` (3012, default `24`) is an offset **from `VIEW_H/2`**, and once `drawLevelDone()` is
gone, `drawLevelBanner()` (13718) is its only reader.

A third of the way down a 720-high view is y = 240, so the offset is **`-120`** — comfortably inside
the `levelBannerY` registry row's `-200..200` range (4812).

| | y offset | absolute y | fraction down the view |
|---|---|---|---|
| shipped | `24` | 384 | 0.533 |
| **CS043** | **`-120`** | **240** | **0.333** |

The constant moves and the registry row's `def` follows it automatically — the row reads
`def: LEVEL_BANNER_Y`, so there is **one** edit, not two. **No registry row is added or retired here;
the count stays put for this change.**

---

## §4. The protection window — Q3

### §4.1 What changes without anyone touching a knob

`game.levelEndSafe` opens at the clear and closes when `levelEndGraceT` reaches exactly 0. The grace
is armed by the **banner's expiry crossing** in `tickLevelBanner()`, so the window is always
`levelBannerTime + levelEndGrace` long. What CS043 changes is not its length but **how much of it is
real play**:

| | frozen | live | total |
|---|---|---|---|
| shipped | player-paced hold + 1.7 s tail | **~3.5 s** (0.5 s banner tail + 3.0 s grace) | unbounded |
| CS043, knobs untouched | none | **5.2 s** (2.2 s banner + 3.0 s grace) | 5.2 s |

Paul's answer to Q3 is **"about what today's live part gives (~3.5 s)"** — hold the *felt* amount of
protected play steady rather than letting it grow by half.

### §4.2 The one knob that moves

The banner's 2.2 s hold is a **readability** requirement, and §3 has just made the banner the only
level announcement there is, so it does not get trimmed. The grace is the half that gives:

> ⛔ **`DEBUG.levelEndGrace` (4870): `def` 3.00 → 1.25.** Total live window 5.2 s → **3.45 s**.

1.25 is on the row's own 0.25 step; 1.30 (which would land exactly on 3.5) is not, and inventing an
off-step default to hit a round total would be false precision on a number Paul gave as "about."

⚠ **This is a tuning number and it is the changeset's most likely retune.** It is a one-row change
with no mechanism behind it, and GATE A asks about it by outcome. The row's `min: 0` still degrades
cleanly — at 0 the window is the banner alone, and `tickLevelBanner()`'s crossing one-shot arms a
grace of 0, which `update()`'s `> 0` test simply never enters.

### §4.3 FORK-CS043-A — does the pulse span the whole window?

**The kickoff raises this and it is a real fork.** Today the ship's alpha pulse runs on the **grace
only**, both in `Ship.draw()`'s `pulsing` (8213) and in the accumulator in `update()` (12736). CS036
P3 decided that deliberately (FORK-CS036-D → D1) and wrote down its reason:

> the pulse says "you cannot be hit right now", which is meaningless over the frozen field the rest of
> the window is spent on … The grace is the one step that is live gameplay with damage off, so it is
> the only step the tell belongs to.

⛔ **CS043 does not falsify that reason — it satisfies it everywhere.** After this changeset *the whole
window* is live gameplay with damage off. D1's own stated criterion therefore now selects the whole
window, so extending the pulse **keeps D1's reasoning and reverses only its conclusion.** That is the
recommendation.

**Two things must move together, and a third must not:**

1. `Ship.draw()`'s `pulsing` becomes `game.levelEndSafe`.
2. The accumulator's condition follows it. **The ramp cannot simply follow.** It reads
   `graceFrac = 1 - levelEndGraceT / DEBUG.levelEndGrace`; during the banner phase `levelEndGraceT` is
   0, so `graceFrac` is 1 and `oneWay` resolves to `levelEndGracePulseEnd` — the *fastest* period,
   exactly backwards. The banner phase must hold at the resting period (`levelEndFade`) and the ramp
   must still span the grace alone. One ternary, at one site.
3. ⛔ **`blink` keeps `!levelEndSafe` and the two are still two questions.** `pulsing` and `blink`
   become textually equal and must **not** be collapsed into one variable or one name. Blink
   suppression answers "is a hit-stun strobe allowed to run" and is the reason a hit taken just before
   the clear does not strobe the ship at 10 Hz on top of the pulse. The comment block at 8200-8212
   says the two "move together or not at all" about the *pulse's* two sites; that sentence is about
   items 1 and 2 and is rewritten, not deleted.

⛔ **FORK-CS043-A IS RESOLVED: span the whole window** (Paul, at review, 2026-09-09). Items 1 and 2
are made; item 3's prohibition binds. This is a deliberate reversal of FORK-CS036-D → D1's conclusion
and it is recorded in `DECISIONS.md` alongside §0's, because D1's *reasoning* is being kept, not
discarded — a future session must not read this as the fork having been decided wrong twice.

---

## §5. The live spawn floor — Q2

### §5.1 The hazard the kickoff did not name

`nextWave()` does two things at **every** boundary that the freeze has always hidden:

- **`spawnFieldSatellites()` (10122)** places the whole new field of large Garbage Satellites in a ring
  `rand(SPAWN_MIN_DIST, SPAWN_MAX_DIST)` = **220–640 px** around the ship's *current* world position.
- **`game.dock = new Dock()`** relocates the Recycle dock, ship-relative, up to `DOCK_MAX_DIST` (620).

Under the shipped freeze the player never sees either happen. Live, satellites materialise around a
moving ship mid-fight. 220 px is well inside a 1280×720 viewport (half-width 640, half-height 360) —
it is in the player's face.

**This is a bigger and more frequent hazard than the `resizeWorld()` teleport the kickoff worried
about**, because it happens at every single boundary rather than once per run (§7.1).

### §5.2 The change

> ⛔ **`SPAWN_MIN_DIST` (774): `220` → `380`**, and it gains a `DEBUG_VARS` row so the number can be
> A/B'd from the panel. **Registry 117 → 118.**

**Why 380 and not further out.** A guaranteed off-screen arrival needs the viewport's half-diagonal,
734 px — which exceeds `SPAWN_MAX_DIST` (640) outright, so it is not reachable inside the current
band and raising the max trades against the reachability the max exists to protect (and against
`DOCK_MAX_DIST` 620, deliberately kept below it). **380 clears the viewport's half-height (360)**, so
nothing can appear directly above or below the ship on screen, and a spawn to the side arrives at the
outer third rather than in the player's lap. That is the outcome Paul asked for — "nothing appears
close enough to read as unfair" — solved backwards from the screen, not picked round.

⚠ **The band narrows from 420 px wide to 260, so the new field clusters into a thinner ring.** That is
a real, visible change to level composition and it is the reason this gets a knob rather than a bare
constant edit. It is a GATE A question.

**One constant, one row, no branch — deliberately.** The alternative considered and rejected was a
separate boundary-only floor leaving wave 1's opening spawn at 220. It buys nothing: wave 1 spawns
into an empty field where a larger floor costs the player only a slightly longer opening approach,
and a second constant with a live/not-live branch is a second thing to keep true.

⛔ **`SPAWN_MIN_DIST` is not a lever and does not become one.** `LEVERS` is the difficulty odometer
(§2.13) and every entry in it scales with `game.wave`; this is a fixed placement floor with no clock,
in the same category as `SPAWN_MAX_DIST` and `DOCK_MAX_DIST` beside it. A registry row is the right
home; a `LEVERS` entry is not.

⚠ **GDD §2.7 currently states the ring as "220–1100 px" and §2.11 owns the spawn-ring clamp.** 1100 is
stale against the shipped 640 independently of this changeset. Both figures get corrected in the same
edit — recorded here so the correction is not read as part of the retune.

---

## §6. What must not change

- ⛔ **`nextWave()` (10134) still must not zero the level-end fields.** Its comment at 10147 says so in
  terms and names the tidy-up pass that would add it "harmlessly." **The reason survives option 1
  intact:** the protection window still spans the call, and `levelEndSafe` / `levelEndGraceT` /
  `levelEndPulseT` are still armed *before* it runs and still must outlive it. Two of the five names
  that comment lists (`levelEndFreeze`, `levelDone`) cease to exist; the comment is edited down to the
  three that remain, and **the rule it states is not weakened while it is edited.**
- ⛔ **`tickLevelBanner()` (12568) survives and matters more than before** — it is the grace's arm. Its
  crossing one-shot idiom and its `game.levelEndSafe` clause are both load-bearing and neither may be
  simplified. `startGame()` calls `nextWave()` for wave 1, and without that clause every run would open
  with `DEBUG.levelEndGrace` seconds of free invincibility. **It loses one of its two callers** (the
  freeze), which retires its "must never run twice in a frame" hazard — the header says so rather than
  dropping the warning silently.
- ⛔ **Achievement `id` values are save data.** Nothing here renames one.
- ⛔ **Registry totals live in `scratchpad/test-registry.js` and nowhere else.** §5's added row is one
  edit there. ⚠ `test-cs029-p4.js` §B and `test-cs038-p5.js` §A also state a total as a literal, against
  that rule (`STATUS.md`, carried); they get repointed 117 → 118 the way every earlier phase has
  repointed them. Rewriting them parent-relative is a refactor and is **not** in scope.
- ⛔ **New tests use `scratchpad/_harness.js`; phase-local pins use `scratchpad/_phase-ref.js` with a
  literal parent SHA, never `HEAD`.**
- ⚠ **`test-cs024-p6.js` §H TRAP 2 diffs `damageShip` against `HEAD`** and goes red from the first edit
  until the commit lands. No CS043 phase is planned to touch `damageShip`, so it should stay green — if
  it goes red, something is out of scope.
- ⛔ **`killShip()`'s panel open and the panel's own freeze are untouched.** The panel still stops the
  field; that was never the complaint.

## §6.1 The suite — 21 files, and the precedent for retiring them

Twenty-one suite files reference the deleted names. Three exist **only** to pin the deleted feature:

| file | lines | disposition |
|---|---|---|
| `test-cs036-p1.js` | 362 | **delete** — the freeze's reduced sim |
| `test-cs036-p2.js` | 444 | **delete** — the announcement and its arm |
| `test-cs036-p3.js` | 479 | **delete** — the extended tail |
| `test-cs042-p5.js` | 581 | **edit** — the ceremony cross-fade; the panel and game-over halves survive |
| `test-cs030-p5.js` | 637 | **edit** — the panel's two call sites become one |
| `test-cs035-p3.js` | 443 | **edit** — the protection window survives, its shape changes |
| 15 others | — | **edit** — incidental references |

⛔ **Deleting a test file whose feature was deleted is established practice in this repo, not a new
liberty.** CS024 P1 deleted nine test files when it removed the orbit levels; CS024 P2/P3/P4 deleted
four more. The rule that binds is `CLAUDE.md`'s — *a phase may not leave the suite redder than it
found it* — and a test asserting a deleted function's behaviour cannot be made green by any means
other than deletion.

⛔ **A deletion is not a licence to drop an assertion that still has a subject.** Each of the three
files is read for assertions about things that **survive** — the grace arm, the banner tick, the voice
drain's placement, `resetMenuNav()`'s other callers — and any such assertion is **carried into the
deleting phase's own new test file** rather than lost. The phase prompt says so explicitly and the
phase reports what it carried.

**Baseline is 180/180, 0 skipped** (`node scratchpad/run-all.js`, exit 0).

---

## §7. Two corrections to `CS043-KICKOFF.md`

The kickoff invited exactly this: *"Every line number below was read at that commit and should be
re-confirmed, not trusted."* Every line number **did** re-confirm. Two claims of substance did not.

### §7.1 ⛔ `resizeWorld()` fires ONCE per run, not on two levels in three

The kickoff's Q1 opens: *"on roughly two levels in three calls `resizeWorld()` (9736), which teleports
the ship to the centre of the new world."* At `2532b16`:

```js
function worldSizeFor(level) {
  return level <= DEBUG.earlyWorldLevels ? WORLD_SIZE_EARLY : WORLD_SIZE_FIELD;
}
```

Two return values, one boundary. `nextWave()` resizes only when the size actually changes, so at the
default `earlyWorldLevels` of 5 the resize fires **exactly once per run, at the 5 → 6 boundary**, and
never again. At `earlyWorldLevels = 0` it never fires at all. GDD §2.11.1 has this right, and so does
`worldSizeFor()`'s own header ("now FIRES IN LIVE PLAY, **once per run**").

**Where the wrong figure came from:** `nextWave()`'s comment at 10193 still describes the retired
CS021/CS022 archetype cadence — *"up at every 3rd level and back down at the level after, 42 times in
a 63-level run."* CS024 P1 removed the orbit levels and that comment did not follow. **It is a fifth
stale build comment**, and it belongs on `STATUS.md`'s list beside the four already there.

**Why it matters to the decision, not just to the record:** Q1's option (c) — "keep a short freeze on
resize levels only" — sounded like keeping a third of the ceremony alive. It is in fact one freeze per
run, at level 6, when the field is at its thinnest. Paul was re-asked on the corrected facts and chose
**(a): ship it live and judge it in the playtest.** No build work; one GATE A question.

### §7.2 The every-level hazard is the spawn ring, and the kickoff does not mention it

§5.1. The ring spawn and the dock relocation happen at every boundary and are hidden by the freeze
today. Paul's answer produced §5, which is the changeset's only genuinely additive change.

### §7.3 No §0 defect found

`CLAUDE.md` requires a `STATUS.md` entry if GDD §0 has no row for something a phase edits. Every
section CS043 touches has one: **§2.20.1** (the level-end ceremony and protection window, 17.6 KB),
**§2.20** (the celebration panel), **§2.7** (waves, `nextWave()`, the wave-clear gate), **§2.11** /
**§2.11.1** (spawn ring, `resizeWorld()`), **§2.9** (states and controls), **§2.19** (the registry row),
**§3.** and **§3.1**. Nothing to report.

---

## §8. Forks

| id | question | status |
|---|---|---|
| **FORK-CS043-A** | Does the ship's alpha pulse span the whole protection window, or stay on the grace? (§4.3) | ⛔ **RESOLVED at review, 2026-09-09 — SPAN THE WHOLE WINDOW.** Paul's call. |

One fork, deliberately. Everything else in this changeset is either Paul's already-taken decision
(§0.1) or falls out of it.

---

## §9. Version and housekeeping

- ⛔ **`GAME_VERSION` goes to `1.0.0.43`** — the literal, not "the next integer." The 4th segment is
  the changeset number (the scheme at the constant's own comment block since CS010 P0). CS042 shipped
  `.41` from writing "the next integer" and `.41` is now a permanent gap that **must not be
  back-filled**, exactly as `.23` already is. `DECISIONS.md`, 2026-09-08.
- **GDD sections edited:** §2.20.1 (heavily — most of it describes deleted machinery), §2.20, §2.7,
  §2.11 (§5's stale ring figure), §2.19 (§5's row), §2.9, §3., §3.1.
- **The closing phase re-measures every §0 size row** (`scratchpad/gdd-sizes.py --check`) and re-reads
  the GDD's own build stamp on line 3.
- ⛔ **`CLAUDE.md` is ~1.25 KB over its 50 KB ceiling and its size valve is spent (FLAG-CS041-b).**
  **CS043 should come out ahead**: the level-end ceremony's rules shrink, and this changeset adds only
  §5's spawn floor. A phase still **may not** silently drop a rule to fit, nor silently valve an
  under-size section. The closing phase reports the measured delta either way.
- **Backlog picked up if there is room:** the five stale build/suite comments (four in `STATUS.md`,
  plus §7.1's). ⛔ **Paul's deferred event-SFX retune is NOT in this changeset** — it is a
  `tools/sfx-lab.html` session, never a hand-edit, because the twelve methods are pinned byte-for-byte
  against `CS042-GATE-A.md`.
