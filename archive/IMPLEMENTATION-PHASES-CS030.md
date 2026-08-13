# IMPLEMENTATION-PHASES-CS030 — Achievement Celebration Panel

Companion to `PLANNED-FEATURES-CS030.md`. Read that first — all forks are resolved there; this is a
build-ready sequence.

**Baseline:** `8e08221` (CS029 P5), version `1.0.0.29`, `orbital-overhaul.html` @ 10,102 lines,
registry **85**, `LEVERS` **18**.

⚠ **Every line number in this document is an estimate from the planning session's clone.** Re-grep by
symbol name before editing. Never edit by line number.

**Resolved this session:** A=both, B=overlay, C=panel-first (via input priority), D=8 emblems,
E=scrollable (own `scroll` field, reusing the Achievements viewer's clip/scroll pattern, not its
`game.menu.scroll` storage). F is open — a P6 gate question, not a blocking fork. Every phase below
already reflects these answers; there is nothing left to decide before starting P1.

---

## Anchors — re-grep before use

| What | Symbol to grep | Est. line |
|---|---|---|
| Unlock choke point | `onUnlock(ach, tierIdx)` | 7050 |
| Evaluate (per-frame) | `Achievements.evaluate();` in `update()` | 8810 |
| Evaluate (death flush) | `Achievements.evaluate();` in `killShip()` | 7318 |
| Wave-clear window | `game.waveClearTimer += dt;` | 8788 |
| `nextWave()` call site | `nextWave();` inside the 2.5s branch | 8803 |
| `"dying"` → `"gameover"` seam | `game.state = "gameover";` | 8067 |
| `game` object literal | `const game = {` | 6014 |
| `startGame()` reset | `function startGame()` | 6255 |
| `game.toasts = []` reset | `game.toasts = [];` | 6271 |
| Keydown entry intercept | `if (game.entry) {` | 2971 |
| Keydown gameover confirm | `bindings.confirm.keys.includes(k) && (game.state === "title"` | 2993 |
| Gamepad gameover branch | `const onTitleOrOver =` | 3064 |
| Gameover draw block | `if (game.state === "gameover") {` | 9692 |
| `drawMenu()`-over-gameover precedent | `if (game.paused) drawMenu();` | 9708 |
| `draw()` | `function draw()` | 9611 |
| `menuPanel` | `function menuPanel(w, h, title)` | 8947 |
| `drawPoly` | `function drawPoly(points, x, y, angle` | 4733 |
| `SAT_ART` table | `const SAT_ART = [` | 5028 |
| `TIER_NAMES` / `TIER_COLOR` | `const TIER_NAMES =` | 4804 |
| `COLOR.ach` | `ach: "#ffcf5a"` | 4797 |
| `DEBUG_VARS` registry | `const DEBUG_VARS = [` | 3348 |
| Achievements viewer draw (scroll pattern source) | `function drawAchievements()` | 9339 |
| Achievements viewer input (scroll pattern source) | `function menuAchievements(a)` | 4141 |
| `achMaxScroll()` | `function achMaxScroll()` | ~9302 |
| `ACH_SCROLL_STEP` | `const ACH_SCROLL_STEP` | 3157 |
| `update()` early-return | `if (game.state !== "playing" \|\| game.paused) {` | ~8807 |

---

## Dependency graph

```
                    P1 collector ──────┐
                                       ├──> P4 panel (game-over overlay) ──> P5 level-end overlay ──> P6 GATE ──> P7 close
  P2 emblem lab ──> P3 emblem table ───┘
```

P1 and P2 are independent. P3 needs P2's output. P4 needs P1+P3. P5 needs P4 (shares the panel's
draw/scroll/dismiss machinery — it should be a second call site, not a second implementation). P6 is
a blocking playtest gate between the last code phase and P7.

---

## P1 — the unlock collector

**Model:** Sonnet · standard effort. Mechanical, tightly specced.

```
Read CLAUDE.md and STATUS.md, then PLANNED-FEATURES-CS030.md §0.3, §0.4 and §4.1.

CS030 Phase 1 — the achievement unlock collector. Data only. No UI, no draw code,
no input changes. Do not build ahead into the panel.

Add two fields to the `game` object. Per the standing CS016 P3 rule, declare BOTH in the
`game` object literal (grep `const game = {`) AND in startGame()'s reset (grep
`function startGame()` — put them beside the existing `game.toasts = [];` line):

  game.pendingAch   = [];    // unlocks banked since the last panel flush
  game.celebration  = null;  // the live panel { items, scroll }, or null

Feed pendingAch from the single unlock choke point. Grep `onUnlock(ach, tierIdx)`.
Append ONE object per unlock, alongside the existing toast push — do not replace or
reorder anything already in that function:

  game.pendingAch.push({ id: ach.id, name: ach.name, desc: ach.desc, tierIdx, pool: ach.pool });

`tierIdx` is deliberately left as-is (undefined for untiered unlocks) — that is the
signature's existing meaning and later phases depend on it.

FOUR THINGS THAT ARE EASY TO GET WRONG — all four are in the spec, read them:

1. Do NOT gate this on game.debugRun. Achievements.save() gates on debugRun because
   it is a PERSISTENCE point (CS024 P6d). This is UI state. A debug run must still
   collect, or the panel cannot be tested. Do not copy the save() guard.

2. Do NOT record game.wave on the item and do NOT filter by it. See spec §0.4: in a
   wave-clear frame, nextWave() (which increments game.wave) runs BEFORE
   Achievements.evaluate(), so a Perfect Wave earned clearing wave 7 is evaluated at
   game.wave === 8. This is a FLUSHED BUCKET, not a per-wave filter.

3. deriveLifetime() must stay silent. It deliberately does not call onUnlock() — that
   is the post-load catch-up, and routing it through the collector would show a returning
   player a panel full of progress they earned in past sessions. Verify by grep that you
   have not touched it.

4. Achievements.evaluate() has TWO callers: the per-frame one in update() and a one-shot
   flush in killShip(). Both must feed the bucket — confirm by reading killShip(), both
   route through onUnlock so this should already hold, just verify it.

Write scratchpad/test-cs030-p1.js using the real startGame / update(1/60) paths via
_harness.js, in the idiom of the existing test files. Assert:
  - an unlock during play appends exactly one item with the right shape
  - a tiered unlock carries a numeric tierIdx; an untiered one carries undefined
  - a multi-tier crossing in one evaluate() pass appends one item PER tier, bronze-first
  - startGame() empties the bucket
  - a debugRun collects normally while Achievements.save() still writes nothing
Any pin needing git history must SKIP LOUDLY, not throw (STATUS.md, carried from CS026).

Run scratchpad/run-all.js. Update STATUS.md. Commit. Do not push.
```

**Commit:** `cs-30 p1: achievement unlock collector (game.pendingAch, fed from onUnlock)`

---

## P2 — `tools/emblem-lab.html`

**Model:** Opus · xhigh effort, thinking on. Art authoring with a legibility bar.

```
Read CLAUDE.md, STATUS.md, then PLANNED-FEATURES-CS030.md §2.3 and §4.2.

CS030 Phase 2 — build tools/emblem-lab.html, the achievement-emblem authoring lab.
Lab only. Do NOT touch orbital-overhaul.html this phase.

Read the SAT_ART header comment in orbital-overhaul.html (grep `const SAT_ART = [`) and
tools/sat-art-lab.html first. The emblems follow that contract EXACTLY:
  - unit space, every point inside the radius-1 circle, so a design scales by * r
  - { pts: [[x,y],...], closed: bool } polylines
  - drawn through drawPoly() — no fills, no new primitive, no external assets
  - original line drawings authored in code

Author EIGHT designs (resolved: FORK-CS030-D = two extras, 8 total):
  - 6 tier emblems, one per TIER_NAMES rung: Bronze, Silver, Gold, Titanium, Platinum,
    Diamond. These must read as ONE FAMILY WITH SIX RUNGS, not six unrelated shapes —
    increasing complexity or enclosure as the ladder climbs.
  - 1 weekly emblem (a "this week's challenge" mark)
  - 1 untiered-lifetime emblem
  The two pool emblems (weekly, untiered-lifetime) must ALSO read as visually distinct
  from the six-tier family — a player should not mistake either for a tier rung.

The lab must show, side by side and live:
  - all eight at the shipping size (radius 32px, the celebrationEmblemSize default),
    each in its shipping colour: TIER_COLOR[i] for the six, COLOR.ach for the two
  - the same eight at 2x for authoring
  - the six tier emblems in a row, so "does this read as a ladder" is answerable at a glance
  - the two pool emblems next to a tier emblem, so "distinct from the tier family" is
    answerable at a glance
  - a copy-out button emitting the ACH_EMBLEM table as paste-ready JS

⛔ THE LEGIBILITY BAR IS MEASURED, NOT ASSUMED. CS028 P1 DELETED the per-craft small
satellite variant after measuring that no silhouette survived at r=13. If a design does
not read at r=32, simplify it in the lab — do not ship it and hope.

⚠ tools/sat-art-lab.html was written AFTER SAT_ART shipped, leaving that table as its own
source of truth for a while. This lab ships FIRST. Keep it authoritative: the table pasted
into the game in P3 must be regenerable from this lab.

Note in STATUS.md that P3 pastes the output in. Commit. Do not push.
```

**Commit:** `cs-30 p2: tools/emblem-lab.html — tiered achievement emblem authoring lab`

---

## P3 — `ACH_EMBLEM` + `drawEmblem()`

**Model:** Sonnet · standard effort. Paste-and-wire.

```
Read CLAUDE.md, STATUS.md, PLANNED-FEATURES-CS030.md §4.2.

CS030 Phase 3 — paste the P2 emblem table into orbital-overhaul.html and add one draw
helper. No panel yet.

1. Add `const ACH_EMBLEM = { ... }` near TIER_NAMES / TIER_COLOR (grep `const TIER_NAMES =`).
   Paste the lab's output VERBATIM — do not retouch coordinates by hand. Header comment in
   the SAT_ART house style: unit space, the { pts, closed } contract, and a pointer to
   tools/emblem-lab.html as the source of truth.

2. Add drawEmblem(cx, cy, r, tierIdx, pool) — resolves which emblem and which colour, then
   delegates to drawPoly() once per polyline. Colour: TIER_COLOR[tierIdx] when tierIdx is a
   number, COLOR.ach otherwise. Emblem: the tier design when tierIdx is a number, else the
   weekly or untiered-lifetime design off `pool` ("weekly" | "lifetime").

   ⛔ tierIdx === 0 is Bronze, a VALID tier. Test `typeof tierIdx === "number"`, never a
   truthiness check — `if (tierIdx)` silently misroutes every Bronze unlock to the untiered
   emblem, and Bronze is the most common unlock in the game.

3. Add two DEBUG_VARS rows (grep `const DEBUG_VARS = [`), in the existing row idiom:
     celebrationScrollStep  — px per up/down scroll press, default 60 (matches
                               ACH_SCROLL_STEP, independently tunable), min 10 max 200 step 10
     celebrationEmblemSize  — emblem radius px, default 32, min 12 max 64 step 2
   Put them under an appropriate header. The registry is 85 BEFORE this phase — after
   adding, print the live count and record the real number in STATUS.md. Do not trust a
   predicted count; it has undercounted historically.

Write scratchpad/test-cs030-p3.js asserting: every ACH_EMBLEM design's points all lie
within the unit circle (|p| <= 1.0); the expected number of designs (8) exists; drawEmblem
routes tierIdx 0 to Bronze and not to the untiered emblem. Skip loudly on any git pin.

Run scratchpad/run-all.js. Update STATUS.md with the verified registry count. Commit.
```

**Commit:** `cs-30 p3: ACH_EMBLEM table + drawEmblem(); two registry knobs`

---

## P4 — the panel, at game over

**Model:** Opus · xhigh effort, thinking on. `ultrathink`. Two input handlers plus a new scroll
surface, layered over a screen reworked one changeset ago.

```
ultrathink

Read CLAUDE.md, STATUS.md, then PLANNED-FEATURES-CS030.md §2.4 through §2.8, §4.3, §4.4.

CS030 Phase 4 — the celebration panel itself, wired at GAME OVER ONLY. Level-end
integration is Phase 5; do not build ahead into it.

--- DRAW: OVERLAY, NOT MODAL REPLACE ---
Resolved: FORK-CS030-B = overlay. The shipped precedent is `if (game.paused) drawMenu();`
(grep it) — it draws AFTER the gameover block, on top of it, without that block knowing or
caring. Follow the same shape EXACTLY:

⛔ The gameover draw block (grep `if (game.state === "gameover") {`) must be BYTE-UNCHANGED
by this phase. Do not gate it, do not early-return it, do not touch anything inside it.
CS029 P2 retuned that screen one changeset ago and its footer is still an open playtest
knob under FORK-CS029-C — this phase does not touch it, structurally, not just carefully.

Add drawCelebration(), called from draw() (grep `function draw()`) in the SAME tail
position as the drawMenu() call — after the gameover block, alongside/after
`if (game.paused) drawMenu();`, before drawToasts(). It draws OUTSIDE drawHUD() — the
standing rule at the drawHUD header comment is that menus, toasts and the game-over text
stay in draw() so Capture's H toggle only ever hides the always-on overlay, never anything
modal. H must NOT hide this panel.

Panel chrome: menuPanel()-style box, same as every other overlay in this codebase. Its own
near-opaque backdrop is what makes it read as "in front of" whatever's underneath — no
separate dimming pass needed, menuPanel() already fills before it strokes.

--- SCROLL: REUSE THE ACHIEVEMENTS VIEWER'S PATTERN, NOT ITS STATE ---
Resolved: FORK-CS030-E = scrollable, not paged. Grep drawAchievements() and
menuAchievements() and reproduce the SAME PATTERN:
  - a content-height -> maxScroll derivation (write celebrationMaxScroll(), the
    game.celebration.items-length analogue of achMaxScroll())
  - render clamps game.celebration.scroll against it
  - a clipped row region (ctx.rect + ctx.clip(), restored after)
  - a ▲/▼ affordance drawn OUTSIDE the clip, shown only when there's something to scroll
  - up/down step game.celebration.scroll by DEBUG.celebrationScrollStep, clamped against
    the SAME celebrationMaxScroll() the renderer uses (one shared ceiling — this is the
    exact discipline achMaxScroll() enforces and the reason it's a top-level function
    rather than a local)

⛔ DO NOT REUSE game.menu.scroll. It is menu-scoped (reset on every gotoScreen() and tab
switch) and the celebration panel is not part of the menu system. game.celebration carries
ITS OWN scroll field: { items: [...], scroll: 0 }.

Per row: [emblem via drawEmblem()] [name + tier badge] / [description]. Confirm/back
dismisses UNCONDITIONALLY regardless of scroll position — this matches the Achievements
viewer's own convention exactly; do not invent a "must scroll to bottom" gate.

--- GAME-OVER INTEGRATION ---
Open the panel at the "dying" -> "gameover" seam (grep `game.state = "gameover";"`). By
that point killShip()'s final Achievements.evaluate() has already run, so the bucket is
complete. If game.pendingAch.length:
  game.celebration = { items: game.pendingAch, scroll: 0 };
  game.pendingAch = [];

Resolved: FORK-CS030-C = panel first. This is delivered through INPUT PRIORITY, not draw
order — game.entry may already be armed on this same frame (a qualifying run), so its
slots may render underneath the panel. That's fine; the panel's backdrop covers them. What
makes it "panel first" is that the panel's input guard sits BEFORE game.entry's (see below)
— the player physically cannot interact with entry until the panel is dismissed.

--- INPUT: BOTH HANDLERS. THIS IS THE PART THAT BREAKS. ---
There are TWO independent input paths and they are in different functions:

  1. Keyboard — grep `if (game.entry) {`. Add a game.celebration block IMMEDIATELY BEFORE
     it, in the same shape: handle up/down (scroll, per above) and confirm/back (dismiss),
     then `return`. The return is load-bearing for the same reason the comment at the
     game.entry block gives — without it, a confirm that just dismissed the panel falls
     through into initials entry or startGame() in the SAME keypress.
  2. Gamepad — grep `const onTitleOrOver =`. Add the mirror gate BEFORE that block, with
     the same up/down-scrolls, confirm-dismisses behaviour.
     ⛔ Missing this half means a controller player blows straight through the panel with
     Start and never sees it. Test it.

Use the existing e.repeat guard idiom so a held key does not spin the scroll instantly.

--- FANFARE ---
FORK-CS030-F is an OPEN gate question (§3-F in the spec), not resolved here. Implement it
as a single AudioSys.achievement() call when the panel first opens (routed through the
existing call, no new sound) — this is the cheapest default to ship and the gate can retune
it to per-item or silent without restructuring anything.

Write scratchpad/test-cs030-p4.js. Assert:
  - a run ending with N banked unlocks opens the panel with N items and scroll 0
  - a run with zero unlocks does NOT open a panel and reaches gameover unchanged
  - up/down move game.celebration.scroll, clamped to celebrationMaxScroll()
  - confirm/back clears game.celebration REGARDLESS of scroll position
  - while game.celebration is set, a confirm does NOT reach startGame() and does NOT reach
    entryInput() — assert this for BOTH the keyboard and the gamepad path
  - a qualifying run still arms game.entry, and entry becomes reachable after dismissal
  - the gameover draw block is untouched (assert against source, skipping loudly if the
    pin needs git history)
  - game.menu.scroll is never read or written by any celebration code path

Run scratchpad/run-all.js. Update STATUS.md. Commit.
```

**Commit:** `cs-30 p4: achievement celebration panel, wired at game over (overlay + scroll)`

---

## P5 — level-end integration

**Model:** Opus · xhigh effort, thinking on. `ultrathink`. This phase inserts a pause into the
hottest path in `update()` — resolved in scope per FORK-CS030-A = both.

```
ultrathink

Read CLAUDE.md, STATUS.md, then PLANNED-FEATURES-CS030.md §0.1 IN FULL, plus §4.4.

CS030 Phase 5 — show the celebration panel at level end.

⛔ READ §0.1 BEFORE WRITING ANY CODE. The prior changeset's preview called the 2.5s
waveClearTimer window "the natural place to hang the panel" and that was WRONG. That window
is NOT a pause: the ship flies, Hunters and loose garbage are live and hunting (CS015 P3 —
nextWave() clears nothing, deliberately), saucers shoot, collisions resolve, and the player
can die inside it. nextWave() is then called INLINE from update(). This phase is therefore
ADDING A NEW PAUSE OF LIVE GAMEPLAY, not reusing an existing one. Paul signed off on that
cost knowingly (FORK-CS030-A = both). Treat it as the delicate change it is — the P6 gate
specifically re-checks whether this was the right call (G7/G8).

Grep `game.waveClearTimer += dt;`. Inside the `> 2.5` branch, AFTER the existing
perfectWaves / noScratchWave3 / flawlessLateWave block and BEFORE nextWave():

  if (game.pendingAch.length) {
    game.celebration = { items: game.pendingAch, scroll: 0 };
    game.pendingAch = [];
    return;                        // ⛔ do NOT call nextWave() yet
  }
  nextWave();

REUSE P4's panel wholesale — same drawCelebration(), same scroll machinery, same dismissal
handling. This is a SECOND CALL SITE for existing machinery, not a second implementation.
The draw call already fires every frame from draw() regardless of game.state, so no new
draw wiring is needed here — only the open/dismiss logic below.

Dismissal at level end must call nextWave() (vs. game-over's dismissal, which does
nothing further). Branch the shared dismissal handler on game.state, or on which state was
active when game.celebration was opened — do not duplicate the scroll/input logic itself
in two places.

FOUR ORDERING AND FREEZE FACTS THAT MUST HOLD:

1. game.levelBanner and VoiceSys.sayLevel() both fire from INSIDE nextWave(). Deferring
   nextWave() defers both, which is correct — "Level 8" should announce after the
   celebration, not under it. Verify this is what actually happens; do not just assume it.
2. ⛔ update() must be frozen while game.celebration is set at level end, or the live field
   keeps simulating behind the panel and the player is killed by a Hunter they cannot see
   coming. Grep the `if (game.state !== "playing" || game.paused)` early-return and extend
   its condition to also freeze while game.celebration is set. Do NOT set game.paused —
   that would satisfy menuActive() and pull in the whole menu chrome path, which this is
   not part of.
3. ⛔ Up/down, while the level-end panel is open, must reach the panel's scroll handling,
   NOT the ship's turn controls. Since update() is frozen but the input handlers are not
   gated by game.state, this is the same P4 input-priority guard doing double duty — verify
   it fires regardless of game.state being "playing" (not just "gameover").
4. The waveClearTimer was already zeroed at the top of the branch before this code runs.
   Confirm a dismissal cannot re-enter the branch and fire a second panel on the same clear.

Write scratchpad/test-cs030-p5.js. Assert:
  - clearing a wave with banked unlocks opens the panel and does NOT advance game.wave
  - dismissal advances game.wave by exactly one and sets game.levelBanner
  - clearing a wave with an EMPTY bucket calls nextWave() immediately, behaviour identical
    to the pre-CS030 build (this is the common case — most wave clears bank nothing)
  - update() advances no entity while game.celebration is set at level end
  - game.paused stays FALSE throughout (menuActive() must not become true)
  - up/down move the panel's scroll, not the ship, while it's open mid-level
  - the panel cannot fire twice on one wave clear

Run scratchpad/run-all.js. Update STATUS.md. Commit.
```

**Commit:** `cs-30 p5: celebration panel at level end (defers nextWave until dismissal)`

---

## P6 — playtest gate ⛔ BLOCKING

No code. Paul plays; answers go back as **numbers where a slider is involved**, not yes/no.

| # | Question | Format |
|---|---|---|
| **G1** | `celebrationScrollStep` — px per up/down press that feels right | integer 10–200 |
| **G2** | `celebrationEmblemSize` — emblem radius px | integer 12–64 |
| **G3** | Do the six tier emblems read as one ladder, or six unrelated shapes? | ladder / unrelated / which rungs fail |
| **G4** | Are the weekly and untiered-lifetime emblems distinguishable from the tier family? | yes / no / which |
| **G5** | Fanfare on panel open (FORK-CS030-F, still open) | once on open / once per item scrolled into view / silent |
| **G6** | Game over: does "panel first, entry underneath" feel right, or does seeing entry slots behind the panel read as broken? | keep / hide entry entirely until dismissal |
| **G7** | Resume after a level-end panel — fly a clear with Hunters close. Is the resume fair, or do you get hit before you can reorient? | fair / unfair + what would fix it |
| **G8** | Does the per-level cadence earn the pause, or does it interrupt a run's rhythm? | earns it / interrupts |
| **G9** | Does the panel still feel celebratory on a run that banks 10+ unlocks, or does it become a chore to scroll through? | celebratory / chore |
| **G10** | Does dismissing without scrolling to the bottom ever cost a player something they clearly wanted to read? | no issue observed / describe what was missed |

⚠ **G7 and G8 are the ones that can still send FORK-CS030-A back to game-over-only.** If they come
back bad, reverting P5 is a clean single-commit revert — P4 stands alone and ships the game-over
panel with no dependency on P5.

⚠ **G6 is new** — it only exists because B resolved to overlay rather than modal-replace. If it comes
back "reads as broken," the fix is narrow (delay arming game.entry's *visible* slots, not its state,
until dismissal) and does not require revisiting B itself.

---

## P7 — closing phase

**Model:** Sonnet · standard effort.

```
Read CLAUDE.md, STATUS.md, PLANNED-FEATURES-CS030.md.

CS030 Phase 7 — closing phase. Apply the P6 gate answers, then sweep.

1. Apply every G-answer from the gate to the registry defaults and to any affected
   emblem/panel constant. Gate answers are the shipping values.
2. Bump the version string to 1.0.0.30. Grep the GAME_VERSION site in
   orbital-overhaul.html — do not assume its line number.
3. GDD (ORBITAL-OVERHAUL-GDD.md): document the celebration panel in §2 (SHIPPED BEHAVIOUR
   ONLY) — both the game-over overlay and the level-end overlay, since both shipped.
4. CLAUDE.md: add the ⛔ INVARIANT that the collector is a flushed bucket and must never be
   filtered by game.wave (spec §0.4), and the ⛔ that both the keyboard and gamepad handlers
   gate on game.celebration, including its scroll input, before falling through to
   game.entry or normal play.
5. STATUS.md: roll the window to the last ~3 changesets, move older content to
   archive/STATUS-HISTORY.md. Verify no two entries land on the same physical line (the
   shell-append trailing-newline pitfall). Record the VERIFIED registry count and lever
   count from the live build, not a predicted one.
6. Write log/CS030.md — the phase-by-phase narrative. It must include the §0.1 correction
   story: the prior changeset's preview named the waveClearTimer window as a natural pause,
   grep showed it was fully live gameplay, and Paul chose to build the pause anyway with the
   cost known. Also record the B-resolves-to-overlay finding and the G6 gate outcome.
7. Archive PLANNED-FEATURES-CS030.md and IMPLEMENTATION-PHASES-CS030.md to archive/.
8. Run scratchpad/run-all.js ON A FULL CLONE. Assert 0 failed AND 0 skipped. Record the
   file/pass/fail counts in STATUS.md.

Commit. Do not push.
```

**Commit:** `cs-30 p7: closing phase — gate answers applied, version 1.0.0.30, doc sweep`

---

## Model / effort summary

| Phase | Model | Effort | Why |
|---|---|---|---|
| P1 | Sonnet | standard | Mechanical, tightly specced |
| P2 | Opus | xhigh + thinking | Art authoring against a measured legibility bar, now 8 designs |
| P3 | Sonnet | standard | Paste-and-wire |
| P4 | Opus | xhigh + `ultrathink` | Two input handlers, new scroll surface, overlay in front of a freshly-reworked screen |
| P5 | Opus | xhigh + `ultrathink` | Inserts a pause into `update()`'s hot path; reuses P4's machinery at a second call site |
| P6 | — | — | Paul plays |
| P7 | Sonnet | standard | Doc sweep, mechanical |

`ultrathink` is baked into the P4 and P5 prompts. Set the model with a session-level `/model`
command; it is not a per-turn note.