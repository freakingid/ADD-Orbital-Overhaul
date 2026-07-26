# IMPLEMENTATION-PHASES-CS016.md — Title & Menu Navigation Pass

**Companion to:** `PLANNED-FEATURES-CS016.md` (all three forks resolved)
**Base build:** CS015 P7 round-complete, `GAME_VERSION "1.0.0.15"`
**Target:** `GAME_VERSION "1.0.0.16"`, carried by **P5** (last player-visible phase)
**Phases:** 5 · one Claude Code session each · one commit each · on `main` · Paul pushes

---

## How to use this doc

One phase per session. Attach a **fresh pull** of `asteroids-deluxe.html`,
`ORBITAL-OVERHAUL-GDD.md`, `CLAUDE.md`, `STATUS.md`, and this file. Do **not** attach
`PLANNED-FEATURES-CS016.md` to a build session — the phase prompts below are self-contained.

Set the model with `/model` **before** pasting the prompt. Every prompt below re-instructs the
session to grep its own anchors by symbol; the line numbers in this document are from the CS015 P7
build and **will** drift.

**Dependency order is strict for P1 → P2.** P3, P4, P5 are mutually independent and can be
reordered, but all three depend on P2 having landed.

| Phase | Scope | Player-visible | Risk |
|---|---|---|---|
| P1 | Menu-active decoupling + music concept swap | No (pure no-op refactor) | Low, but load-bearing |
| P2 | Title menu + single-parent IA | Yes | **Highest** |
| P3 | Modal confirmation system | Yes | Medium (new machinery) |
| P4 | Unavailable-row idiom: Save row + Difficulty lock | Yes | Low |
| P5 | Achievements two tabs + version bump | Yes | Medium (large test blast radius) |

---

## P1 — Menu-active decoupling + music concept swap

**Goal.** Separate the two meanings currently conflated in `game.paused` — *"the sim is frozen"* and
*"a menu owns input"* — so P2 can open a menu at the title without freezing anything or lying about
the world state. **This phase changes no behaviour whatsoever.** Its acceptance criterion is that
the full regression passes with **zero test-file edits**.

**Anchors** (grep by symbol; line numbers from CS015 P7):

| Symbol | ~Line | Note |
|---|---|---|
| `menuActive()` | 2406 | `return game.paused;` |
| `updateMusic()` | 6284 | contains the `setDuck` call |
| `MusicSys.setDuck(...)` call | 6289 | reads `menuActive()` today |
| `musicStateFor(s)` | 6280 | reads `game.paused` today |

**Exact work — three one-line edits, nothing else:**

1. `menuActive()` becomes `return game.paused || game.menu.screen === "titlemenu";`
2. The `setDuck` call swaps `menuActive()` → `game.paused`
3. `musicStateFor`'s first line swaps `game.paused` → `menuActive()`

Edits 2 and 3 move in **opposite directions**. That is deliberate, not a typo — see the prompt.

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, as always.

This is CS016 Phase 1 of 5. It is a pure no-op refactor that prepares a seam for P2. It must
change NO observable behaviour. Do not build any part of the title menu this phase.

BACKGROUND. `menuActive()` currently returns `game.paused`. That single boolean means two
different things at once: "the simulation is frozen" and "a menu owns input". CS016 P2 adds a
navigable menu on the title screen, which needs the second meaning without the first (the sim
is already not running at the title — update() early-returns on game.state !== "playing").

Grep these four symbols and read each in context before editing: `menuActive`, `updateMusic`,
`musicStateFor`, and the `MusicSys.setDuck(` call site.

MAKE EXACTLY THREE EDITS.

(1) menuActive() becomes:
      return game.paused || game.menu.screen === "titlemenu";

(2) The setDuck call in updateMusic() changes its FIRST operand from menuActive() to game.paused:
      MusicSys.setDuck(game.paused && game.menu.screen !== "highscores");

(3) musicStateFor()'s first line changes its FIRST operand from game.paused to menuActive():
      if (menuActive() && game.menu.screen === "highscores") return "highscore";

ultrathink about why (2) and (3) move in OPPOSITE directions before you write them, and put a
short comment at each site recording the reasoning:
  - Ducking exists to make room for GAMEPLAY audio under an overlaid menu. There is no gameplay
    under the title screen. So the duck must read the "sim is frozen" concept (game.paused), or
    P2's title menu will permanently duck the title track to MUSIC_DUCK_GAIN.
  - The High Scores screen is moving to the title menu in P2, where game.paused will be FALSE.
    So its music-state check must read the "a menu is open" concept (menuActive()), or the
    `highscore` fanfare track silently stops playing on that screen.
Getting these backwards is the main hazard of this phase.

WHY THIS IS SAFE TODAY: no screen is named "titlemenu" yet, so menuActive() === game.paused for
every reachable state, and all three edits are byte-identical in behaviour. That is exactly what
makes them verifiable now, before P2 adds the state that would make a mistake hard to see.

TESTS. Add scratchpad/test-cs016-p1.js driving the REAL menuActive/musicStateFor/updateMusic
(no reimplemented logic). Cover:
  (A) node --check clean.
  (B) EQUIVALENCE: across every combination of game.state in {title, playing, dying, gameover} x
      game.paused in {true,false} x game.menu.screen in {null, root, options, sound, controls,
      difficulty, achievements, highscores, debug}, menuActive() === game.paused. This is the
      byte-identity proof — it must hold for every currently-reachable combination.
  (C) The forward-looking case: force game.menu.screen = "titlemenu" with game.paused === false
      and assert menuActive() === true. Then assert the real updateMusic() does NOT duck in that
      state (drive it and read MusicSys's duck target), and that musicStateFor("title") still
      returns "title".
  (D) Force game.menu.screen = "highscores" with game.paused === false (the shape P2 creates) and
      assert musicStateFor() returns "highscore" — the regression edit (3) exists to prevent.
  (E) The existing high-scores-from-pause path (game.paused === true, screen "highscores") still
      returns "highscore" and still does NOT duck.
  (F) AudioSys.ctx null -> startGame()/update(1/60) no-crash smoke.

ACCEPTANCE CRITERION, and it is strict: the FULL regression suite must pass with ZERO edits to
any existing test file. If any pre-existing test needs changing, you have changed behaviour —
stop, do not "fix" the test, and report what diverged. Run the full suite and report the file
and assertion counts.

Do not touch: any menu handler, any draw function, MENU_OPTIONS, the keydown listener, or
MusicSys.setDuck's own implementation. Do not add a "titlemenu" screen. Update STATUS.md at the
end. Do not push.
```

**Session setup:** Sonnet 5, effort **high**.
*(Where this doc names Sonnet 5 / Opus 5, it is the current-generation equivalent of the
Sonnet-for-mechanical / Opus-for-architectural split established in prior rounds.)*

**Docs:** GDD Architecture Map — Menu row (`menuActive()` no longer an alias for `game.paused`) and
the MusicSys row (the two concept reads). No §2 change — nothing shipped that a player can see.

**Commit:** `CS016 P1: decouple menuActive() from game.paused; swap music duck/state concepts`

---

## P2 — Title menu + single-parent IA

**Goal.** The title screen becomes a navigable vertical menu; Achievements and High Scores move to
it as their sole parent; `MENU_OPTIONS` shrinks to four rows. **This is the largest and highest-risk
phase of the round.**

**Anchors:**

| Symbol | ~Line | Note |
|---|---|---|
| `MENU_ROOT_PLAY` / `MENU_ROOT_OVER` | 2305–2306 | constant cluster the new `MENU_TITLE` joins |
| `MENU_OPTIONS` | 2321 | shrinks 6 → 4 |
| `openPause()` | 2409 | title branch routes to `"options"` |
| `closePause()` | 2424 | sets `screen = null` |
| `quitToTitle()` | 2430 | sets `screen = null` — must become `"titlemenu"` |
| `gotoScreen(s, index)` | 2441 | |
| `menuInput(action)` | 2470 | dispatch `switch` gains a `"titlemenu"` case |
| `menuOptions(a)` | 2505 | its Back `else` branch |
| `menuAchievements(a)` | 2565 | Back destination |
| `menuHighScores(a)` | 2582 | Back destination |
| keydown listener | 2110 | branch (2) `menuActive()`, branch (3) confirm/`o`/pause |
| `handleGamepadMenu()` | 2197 | branch (3) `onTitleOrOver` |
| `game` literal `menu:` | 3700 | `screen: null` → `"titlemenu"` |
| `drawMenu()` | 5345 | dispatch |
| `drawOptionsMenu()` | 5394 | renders `MENU_OPTIONS` |
| `drawMenuHint()` | 5325 | reuse for the title hint |
| title branch of `draw()` | 5844–5867 | the legend/blink/hint lines removed here |

**Exact work.** New `MENU_TITLE` constant and `menuTitle(a)` handler; new `drawTitleMenu()`; title
draw branch reworked per `PLANNED-FEATURES-CS016.md` §1.2; `MENU_OPTIONS` shrunk; two Back
destinations repointed; boot/quit entry set to `"titlemenu"`; Options' Back `else` returns to the
title menu; ESC added as a title-screen Options shortcut.

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, as always.

This is CS016 Phase 2 of 5, the largest phase of the round. CS016 P1 has landed: menuActive()
is now `game.paused || game.menu.screen === "titlemenu"`, and no screen is named "titlemenu"
yet. This phase creates it.

STOP AND READ FLAG-CS016-l FIRST (`PLANNED-FEATURES-CS016.md` §1.1 addendum / Resolved Forks
list) before touching menuActive() or its consumers. P1's headless testing found that the
"titlemenu"-only check does NOT survive gotoScreen("achievements")/gotoScreen("highscores") —
game.menu.screen becomes that screen's own name (not "titlemenu") while game.paused stays false,
so menuActive() reads false again the moment either screen is reached, breaking BOTH the
highscore-fanfare musicStateFor() check AND, more seriously, handleMenuKey/handleGamepadMenu
input routing on those two screens (Up/Down/Back go dead; Confirm falls through to the title's
startGame() shortcut). This phase must resolve it explicitly — the flag's candidate fix is
`game.menu.screen !== null` in place of `=== "titlemenu"` (verified equally byte-identical on
the pre-P2 build) — before wiring Achievements/High Scores into MENU_TITLE. Update
scratchpad/test-cs016-p1.js section (D) once this lands (it currently pins the gap, not the fix).

Grep and read in context before editing: MENU_ROOT_PLAY, MENU_ROOT_OVER, MENU_OPTIONS,
openPause, closePause, quitToTitle, gotoScreen, menuInput, menuOptions, menuAchievements,
menuHighScores, the `game` object literal's `menu:` field, startGame's menu reset, drawMenu,
drawOptionsMenu, drawMenuHint, the keydown listener, handleGamepadMenu, and the
`if (game.state === "title")` branch of draw().

GOAL. The title screen becomes a navigable vertical menu. Achievements and High Scores move to
it as their SOLE parent and are removed from Options. No return-context machinery is added —
every Back destination stays hardcoded, two of them just name a different screen.

(1) NEW CONSTANT, beside MENU_ROOT_PLAY/MENU_ROOT_OVER:
      const MENU_TITLE = ["Start Game", "Achievements", "High Scores", "Options"];

(2) NEW HANDLER menuTitle(a), following the menuRoot label-dispatch template exactly (dispatch
    by LABEL, never by hardcoded index):
      up/down   -> wrap the cursor, AudioSys.ui(false)
      confirm   -> "Start Game" -> startGame()
                   "Achievements" -> gotoScreen("achievements")
                   "High Scores"  -> gotoScreen("highscores")
                   "Options"      -> openPause()   [see (6) — keeps the panel chrome]
      back      -> nothing (this is the root of the title; there is nowhere to go back to)
      pause     -> nothing
    Add `case "titlemenu": menuTitle(action); break;` to menuInput's switch.

(3) ENTRY POINTS. game.menu.screen must be "titlemenu" whenever the title screen is showing:
      - the `game` object literal's menu: field, screen: null -> "titlemenu"
      - quitToTitle(), which currently sets screen = null
    Check startGame()'s menu reset and make sure it sets screen back to null (in play, no menu).

(4) MENU_OPTIONS shrinks 6 -> 4:
      const MENU_OPTIONS = ["Sound / Music", "Controls", "Difficulty", "Back"];
    Every consumer already addresses rows by label via MENU_OPTIONS.indexOf(...) — verify that
    by grepping all call sites before you edit, and report if you find any positional access.

(5) BACK DESTINATIONS repointed (two edits):
      menuAchievements -> gotoScreen("titlemenu", MENU_TITLE.indexOf("Achievements"))
      menuHighScores   -> gotoScreen("titlemenu", MENU_TITLE.indexOf("High Scores"))
    Both screens are now unreachable mid-run and at gameover. That is intended and signed off.

(6) OPTIONS' BACK, `else` branch only. Today:
      if (game.state === "playing" || game.state === "gameover") gotoScreen("root", ...);
      else closePause();
    The `else` must now return to the title menu AND clear the paused flag that openPause set.
    Add a small helper beside closePause rather than inlining it in two places (menuOptions has
    TWO back branches — the confirm-label one and the a === "back" one; both need it):
      function returnToTitleMenu() {
        game.paused = false;
        game.menu.screen = "titlemenu";
        game.menu.index = MENU_TITLE.indexOf("Options");
        game.menu.row = 0; game.menu.col = 0; game.menu.scroll = 0;
        AudioSys.ui(false);
      }
    openPause() is deliberately left routing the title to "options" with game.paused = true, so
    Options opened from the title keeps its existing dimmed-panel chrome unchanged.

(7) TITLE RENDER. In draw()'s title branch:
    REMOVE: both keyboard control-legend lines (ROTATE/THRUST and FIRE/SHIELD/PAUSE), the
            blinking "PRESS ENTER TO START", and the "OPTIONS / ACHIEVEMENTS: O" hint.
    KEEP:   ORBITAL / O V E R H A U L, "BEWARE THE HUNTER SATELLITE", the titleDebris field,
            the version stamp, drawToasts().
    ADD:    a drawTitleMenu() drawing the four MENU_TITLE rows with the existing "▶ " selection
            idiom and the COLOR.text / COLOR.menuIdle selected/idle convention, plus a control
            hint routed through the EXISTING drawMenuHint() helper (not a fresh drawText literal).
    This menu is CHROME-LESS: no backdrop dim, no menuPanel box. The title art and debris must
    stay fully visible. Note that because P1 decoupled menuActive() from game.paused, the
    existing `if (game.paused) drawMenu();` line in the title branch already will NOT fire for
    the title menu — Options opened from the title still routes through drawMenu() normally.
    Pick row positions that clear the existing title text above and the flavour line below;
    state the exact y-offsets you chose and flag them as playtest knobs.

(8) KEYBOARD/GAMEPAD ROUTING. The title now satisfies menuActive(), so keydown branch (2)
    intercepts and routes through handleMenuKey -> menuInput -> menuTitle. Consequences to
    handle deliberately, not by accident:
      - The direct `startGame()` on confirm in keydown branch (3) and the `pressedConfirm &&
        onTitleOrOver` branch in handleGamepadMenu are now unreachable at the TITLE but are
        still required at GAMEOVER. Leave them working for gameover; do not delete them.
      - Gamepad Start at the title: handleGamepadMenu's branch (2) now catches it. Make sure
        Start at the title still starts a game rather than becoming inert — route it through
        menuTitle or handle it explicitly, your call, but say which you chose and why.
      - ADD ESC as a title Options shortcut (spec item 1.3): ESC is currently inert at the title
        because pause is gated on game.state === "playing". "o" already works and is kept.
      - CHECK THE DEBUG SECRET CODE. Its keydown block sits ABOVE the three context branches and
        is gated on game.state === "title", so it still arms. But its characters now fall
        through into handleMenuKey, which treats w/a/s/d as nav. Verify DEBUG_CODE contains none
        of those characters (it was designed not to) and assert that in the test — this property
        was previously incidental and is now load-bearing.

TESTS. Add scratchpad/test-cs016-p2.js driving the REAL handlers (menuTitle/menuInput/
openPause/gotoScreen/quitToTitle/startGame and the real captured keydown listener; no
reimplemented nav logic). Cover:
  (A) node --check; MENU_TITLE and the shrunk MENU_OPTIONS shapes.
  (B) Boot lands on screen "titlemenu" with game.paused false and the cursor on "Start Game";
      quitToTitle() from a live run lands the same way.
  (C) Cursor wrap both directions over 4 rows; each row's confirm reaches the right destination.
  (D) Achievements and High Scores Back both return to "titlemenu" with the cursor restored to
      their own row.
  (E) Full round trip: titlemenu -> Options -> Controls -> Back -> Options -> Back -> titlemenu,
      ending with game.paused false and the cursor on "Options".
  (F) The pause-path and gameover-path roots are UNCHANGED: paused mid-game still opens "root",
      Options' Back from both still returns to "root", gameover still opens "root".
  (G) Achievements/High Scores are genuinely unreachable from Options — assert MENU_OPTIONS
      contains neither label.
  (H) ESC at the title opens Options; "o" still does; ENTER on the default cursor starts a game;
      gamepad Start at the title starts a game.
  (I) DEBUG_CODE contains no character in {w,a,s,d} (upper or lower), and typing the full code
      at the title still opens the debug panel without having moved the title cursor.
  (J) AudioSys.ctx null -> startGame()/update(1/60) + a full title-menu nav cycle no-crash.

EXPECT PRE-EXISTING TEST FAILURES — this phase legitimately changes navigation. Grep
scratchpad/ for MENU_OPTIONS, "PRESS ENTER TO START", menuAchievements, menuHighScores, and
title-screen draw assertions BEFORE editing, list every file you expect to touch, then update
them. Likely: test-p4.js, test-cs010-p4.js, test-cs012-p4.js, test-cs013-p1.js, test-f9.js,
test-v36-scores.js. For each, change only what the IA change genuinely invalidates and say so
per file — do not weaken an assertion to make it pass. Report full suite file/assertion counts.

Do not bump GAME_VERSION (P5 carries it). Update STATUS.md and the GDD. Do not push.
```

**Session setup:** Opus 5, effort **xhigh**, thinking on. This phase has real architectural
judgement in it (routing, unreachable-branch preservation, render layout).

**Docs:** GDD §2.9 (control scheme — title menu replaces the legend/hint), §2.16 (menu IA
rewritten: single-parent tree, `MENU_OPTIONS` 6→4, the mid-run access loss recorded as deliberate
with its CS010 P4 / CS012 P4 reversal named), Architecture Map Menu + `draw()` rows,
`GDD-VERSION-HISTORY.md`.

**Commit:** `CS016 P2: title screen becomes a navigable menu; Achievements/High Scores move to it`

---

## P3 — Modal confirmation system

**Goal.** A generic yes/no modal, and its two consumers: Return to Defaults and mid-run Quit.

**Anchors:**

| Symbol | ~Line | Note |
|---|---|---|
| `menuInput(action)` | 2470 | the `game.menu.rebinding` exclusive guard is the precedent |
| `menuRoot(a)` | 2484 | `"Quit"` label branch |
| `menuControls(a)` | 2637 | `defaultsRow` branch |
| `returnToDefaults()` | 2691 | |
| `game` literal `menu:` | 3700 | gains `modal: null` |
| `gotoScreen` / `closePause` / `startGame` | 2441 / 2424 / — | modal must be cleared in each |
| `drawMenu()` | 5345 | `drawModal()` called last |
| `menuPanel` / `drawMenuHint` | 5359 / 5325 | reuse |

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, as always.

This is CS016 Phase 3 of 5. CS016 P1 and P2 have landed. This phase adds the build's first
modal dialog — new machinery — and wires two consumers.

Grep and read in context first: menuInput (specifically its `if (game.menu.rebinding) return;`
exclusive-mode guard, which is the precedent this follows), menuRoot, menuControls,
returnToDefaults, the `game` literal's menu: field, gotoScreen, closePause, startGame's menu
reset, drawMenu, menuPanel, drawMenuHint.

(1) STATE. game.menu gains `modal: null`. When open it holds:
      { text, confirmLabel, cancelLabel, index, onConfirm }
    index: 0 = confirm row, 1 = cancel row. It MUST default to 1 (cancel), so a double-tap of
    ENTER can never destructively confirm.
    Clear it (set null) wherever rebinding is cleared: gotoScreen, closePause, startGame's reset,
    and quitToTitle. Grep for `rebinding = null` and mirror every site.

(2) HELPER:
      function openModal(text, confirmLabel, onConfirm) { ... AudioSys.ui(true); }
    with cancelLabel defaulting to "CANCEL".

(3) INPUT. Add an exclusive branch to menuInput BEFORE the screen switch, directly after the
    existing rebinding guard — order matters, rebinding stays first:
      if (game.menu.modal) { menuModal(action); return; }
    menuModal(a):
      up/down/left/right -> toggle index between 0 and 1, AudioSys.ui(false)
      confirm -> capture onConfirm, clear the modal FIRST, then invoke (so a callback that
                 navigates can't be clobbered by the teardown), AudioSys.ui(true)
      back    -> clear the modal, AudioSys.ui(false)
      pause   -> treat as cancel; it must never close the whole menu out from under an open
                 confirmation
    No per-screen handler should need to know modals exist.

(4) RENDER. drawModal(), called at the END of drawMenu() so it paints over the current screen's
    panel. Use menuPanel() for the box and drawMenuHint() for the footer; two rows using the
    existing "▶ " selection idiom and the COLOR.text / COLOR.menuIdle convention. Size the panel
    off the measured prompt text the way drawRootMenu measures its hint (the CS015 P1
    self-healing-width precedent), not a hardcoded width.

(5) CONSUMER ONE — Return to Defaults. menuControls' defaultsRow confirm branch currently calls
    returnToDefaults() immediately. It must now open a modal:
      text "Reset all controls to defaults?", confirmLabel "RESET",
      onConfirm -> returnToDefaults()
    returnToDefaults() itself is UNCHANGED.

(6) CONSUMER TWO — mid-run Quit. menuRoot dispatches by LABEL. The mid-run root's label is
    "Quit" and the gameover root's is "Quit to Title" — so the two are already distinguishable
    with no state check. Wire ONLY "Quit":
      text "Quit to title? Progress in this run will be lost.", confirmLabel "QUIT",
      onConfirm -> quitToTitle()
    "Quit to Title" at gameover stays UNCONFIRMED and calls quitToTitle() directly — the run is
    already over and there is nothing to destroy. Do not add a modal there.

TESTS. Add scratchpad/test-cs016-p3.js driving the REAL menuInput/menuModal/menuRoot/
menuControls/returnToDefaults/drawMenu (no reimplemented dialog logic). Cover:
  (A) node --check; game.menu.modal defaults null.
  (B) Opening a modal sets index to 1 (cancel) — assert explicitly, this is the safety property.
  (C) Cancel and back both dismiss WITHOUT running onConfirm; confirm runs it exactly once.
  (D) `pause` inside an open modal cancels and leaves the underlying screen open and paused —
      it must not closePause().
  (E) Return to Defaults: rebind an action to a non-default key, open the modal, CANCEL, assert
      the binding is still the custom one; reopen, CONFIRM, assert bindings match
      DEFAULT_BINDINGS and settings were saved.
  (F) Mid-run Quit: open the modal from a paused live run, cancel -> still playing and still
      paused; confirm -> game.state "title" and the title menu is showing.
  (G) Gameover "Quit to Title" opens NO modal and quits directly (assert game.menu.modal stays
      null through the whole interaction).
  (H) The modal takes input priority over the underlying screen: with a modal open on the
      Controls screen, "down" moves the modal cursor and does NOT move m.row.
  (I) A live rebinding capture still takes priority over a modal (assert the guard order).
  (J) drawMenu() with a modal open renders without throwing on every screen that can open one;
      AudioSys.ctx null smoke.

Grep scratchpad/ for existing assertions on returnToDefaults and on menuRoot's Quit branch
before editing — they will likely now need a confirm step inserted. List them, update them, and
say what changed per file. Report full suite counts. Do not bump GAME_VERSION. Update STATUS.md
and the GDD. Do not push.
```

**Session setup:** Opus 5, effort **high**. New machinery with a guard-ordering subtlety.

**Docs:** GDD §2.16 (new modal subsection — state shape, exclusive-input precedent, cancel-default
rationale, the two consumers and the one deliberate non-consumer), Architecture Map Menu +
`draw()` rows, `GDD-VERSION-HISTORY.md`.

**Commit:** `CS016 P3: add modal confirmation; gate Return to Defaults and mid-run Quit`

---

## P4 — Unavailable-row idiom: Save row + Difficulty lock

**Goal.** One shared "this row is present but unavailable" visual idiom, built once and used twice:
the disabled Save row in the pause menu, and the Difficulty value rows locked during a run.

**Anchors:**

| Symbol | ~Line | Note |
|---|---|---|
| `MENU_ROOT_PLAY` | 2305 | gains `"Save"` |
| `MENU_ROOT_OVER` | 2306 | **not** touched |
| `menuRoot(a)` | 2484 | `"Save"` confirm is inert |
| `DIFFICULTY_ROWS` | ~2588 | `["shot","magnet","autoshield","back"]` |
| `menuDifficulty(a)` | 2592 | left/right branch gated |
| `drawRootMenu()` | 5377 | fixed `menuPanel(w, 300, …)`, 46px row step, hint at `y + 272` |
| `drawDifficulty()` | — | grep it; renders the toggle rows + per-row help line |
| `COLOR.dim` / `COLOR.menuIdle` | ~2748 | dim = unavailable, menuIdle = merely unfocused |

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, as always.

This is CS016 Phase 4 of 5. CS016 P1-P3 have landed. Two small features that share one new
visual idiom: a menu row that is visible and focusable but cannot be actioned.

Grep and read in context first: MENU_ROOT_PLAY, MENU_ROOT_OVER, rootItems, menuRoot,
drawRootMenu, DIFFICULTY_ROWS, menuDifficulty, drawDifficulty, and the COLOR block (note the
existing distinction: COLOR.menuIdle = unselected-but-available, COLOR.dim = muted/unavailable).

THE SHARED IDIOM. An unavailable row still takes focus and still renders its label and value,
but renders in COLOR.dim rather than COLOR.menuIdle/COLOR.text, and its action is inert — no
state change, no saveSettings(), and no AudioSys.ui() confirmation blip (silence is the feedback
that nothing happened). Focusable-but-inert is deliberate: a skipped row is invisible to a
player who never sees the cursor stop on it, which defeats the point of showing it.

(1) SAVE ROW.
      MENU_ROOT_PLAY becomes ["Continue", "Save", "Options", "Quit"]
      MENU_ROOT_OVER is UNCHANGED — there is no run to save at gameover.
    menuRoot dispatches by label; add no branch for "Save", but make sure an unmatched label
    falls through harmlessly rather than doing something surprising. Render "Save" in COLOR.dim
    at all times, including when focused.
    drawRootMenu currently hardcodes menuPanel(w, 300, ...) with a 46px row step and its hint at
    y + 272. A fourth row overruns that. DERIVE the height from items.length rather than
    hardcoding a new number — same self-healing principle as CS015 P1's derived panel width —
    so the 3-row gameover root and the 4-row pause root both fit through the one function with
    no branch. State the formula you used.

(2) DIFFICULTY LOCK. Changing difficulty mid-run retroactively changes the rules of a run in
    progress, which corrupts the meaning of its score and its achievement progress.
    Lock condition: game.state === "playing". NOT game.paused (P2 made the title paused-free but
    the point stands: the condition is "a run is in progress"), and NOT gameover — at gameover
    the run is over and changing settings for the next run is harmless and should stay allowed.
    When locked:
      - the three value rows (shot, magnet, autoshield) still take focus and still show their
        current values, so the player can READ their settings
      - left/right on them is fully inert: no settings write, no saveSettings(), no AudioSys.ui()
      - they render COLOR.dim
      - the "back" row is unaffected and fully live
      - a help line explains why. Suggested wording, Paul's to change:
        "Difficulty can't be changed during a run."
        Route it through the existing per-row help-line mechanism drawDifficulty already has
        rather than adding a second one.

TESTS. Add scratchpad/test-cs016-p4.js driving the REAL menuRoot/menuDifficulty/drawRootMenu/
drawDifficulty (canvas-recording stub for the render assertions, matching the test-cs013-p2.js
idiom). Cover:
  (A) node --check; MENU_ROOT_PLAY is 4 rows with Save at index 1; MENU_ROOT_OVER still 3 rows
      and contains no "Save".
  (B) The cursor CAN land on Save; confirm on Save changes nothing (assert game.state, paused,
      and menu.screen all unchanged) and the row renders COLOR.dim while focused.
  (C) drawRootMenu's panel height fits 4 rows: read the real strokeRect bounds off the recording
      stub and assert every row's baseline and the hint's baseline fall inside them — for BOTH
      the 4-row pause root and the 3-row gameover root.
  (D) Locked difficulty: with game.state "playing", left/right on each of the three value rows
      leaves settings.shotPowerupMode / magnetMode / autoShield byte-identical, and no
      saveSettings write occurs (spy the storage stub).
  (E) Unlocked difficulty: with game.state "gameover" (and from the title), the same left/right
      presses DO change the settings and DO persist — the lock must not leak outside a live run.
  (F) The Back row is live in both states.
  (G) Locked rows render COLOR.dim and unlocked rows do not; the help line appears only when
      locked.
  (H) AudioSys.ctx null smoke.

Grep scratchpad/ for existing assertions on root-menu row indices and on Difficulty navigation
before editing — test-p5.js is known to walk the Difficulty rows by index, and any test that
indexes MENU_ROOT_PLAY will shift by the inserted Save row. List, update, explain per file.
Report full suite counts. Do not bump GAME_VERSION. Update STATUS.md and the GDD. Do not push.
```

**Session setup:** Sonnet 5, effort **high**. Mechanical, with one derived-geometry calculation.

**Docs:** GDD §2.16 (Save row as a deliberate disabled placeholder; the unavailable-row idiom),
§2.9 or the Difficulty section (the mid-run lock and its rationale), Architecture Map Menu row.

**Commit:** `CS016 P4: add disabled Save row; lock Difficulty during a live run`

---

## P5 — Achievements two tabs + version bump

**Goal.** The Achievements viewer becomes two tabs (Weekly / Lifetime) instead of three columns,
and the round's version bump lands.

**Anchors:**

| Symbol | ~Line | Note |
|---|---|---|
| `menuAchievements(a)` | 2565 | `left`/`right` currently unused — free for tab switching |
| `ACH_SCALE` / `ACH_SCROLL_STEP` | 2308–2309 | |
| `achMaxScroll()` | 5600 | must become tab-aware; shared by render **and** input clamp |
| `drawAchievements()` | 5607 | three columns at `colW = 350` (`xL`/`xM`/`xR`) |
| `drawAchRow` | — | grep; tiered and single-goal branches |
| ACH geometry consts | 5586–5594 | `ACH_PANEL_W/H`, `ACH_ROW0_Y`, `ACH_ROW_CLIP_TOP/BOTTOM`, etc. |
| `game` literal `menu:` | 3700 | gains the tab field |
| `GAME_VERSION` | ~242 | `"1.0.0.15"` → `"1.0.0.16"` |

### Paste-ready prompt

```
Read STATUS.md and CLAUDE.md first, as always.

This is CS016 Phase 5 of 5, the final phase. It carries the round's version bump.

Grep and read in context first: menuAchievements, achMaxScroll, drawAchievements, drawAchRow,
the ACH_* geometry constant cluster, ACH_SCALE, ACH_SCROLL_STEP, the `game` literal's menu:
field, Achievements.activeWeekly / Achievements.LIFETIME, and GAME_VERSION.

(1) TABS. The viewer becomes two tabs instead of three columns:
      Weekly   — Achievements.activeWeekly()
      Lifetime — Achievements.LIFETIME
    game.menu gains a tab field (e.g. achTab: "weekly"). Reset it to "weekly" on every entry to
    the screen — do that in gotoScreen beside the existing scroll reset, so re-entry is always
    predictable.
    menuAchievements: left/right switch tabs. These actions are currently UNUSED on this screen
    (it handles only up/down/confirm/back/pause), so there is no input conflict. up/down keep
    driving the existing clipped continuous scroll. Switching tabs MUST reset game.menu.scroll
    to 0 — a stale offset from a long tab applied to a short one scrolls into empty space.

(2) LAYOUT. One tab at a time means the full panel width is available, so render a SINGLE
    full-width column instead of three 350px ones. CS013 P3 explicitly flagged colW=350 as
    marginal for descriptions at ACH_SCALE 1.5 with long ones clipping; this phase resolves that
    as a side effect. Keep drawAchRow's existing three-line row layout (name / status / desc at
    ACH_STATUS_DY / ACH_DESC_DY) — only the column width and count change.
    Add a tab header row showing both tab names with the active one highlighted, using the
    established COLOR.text / COLOR.menuIdle selected/idle convention, plus a hint that left/right
    switches tabs (route through drawMenuHint).

(3) achMaxScroll() MUST BECOME TAB-AWARE. It currently returns the ceiling for the tallest of
    the three columns: max(activeWeekly().length, ceil(LIFETIME.length / 2)). Per tab it is that
    tab's own row count — and note the Lifetime tab is no longer halved across two columns, so
    its content is now roughly TWICE as tall as before and will scroll considerably more.
    CRITICAL: achMaxScroll() is shared by drawAchievements (render clamp) and menuAchievements
    (input clamp) precisely so the two can never disagree about the ceiling — that was the whole
    reason CS013 P3 hoisted it to a top-level helper. Do NOT let the renderer grow its own copy
    of the ceiling maths. One function, both callers, still.

(4) VERSION BUMP. GAME_VERSION "1.0.0.15" -> "1.0.0.16". Then grep scratchpad/ for the old
    literal and bump every live hit (test-cs010-p0.js and test-cs013-p4.js have pinned it in
    past rounds — verify rather than assume). Leave archive/ and planning docs alone.

TESTS. Add scratchpad/test-cs016-p5.js driving the REAL drawAchievements/drawAchRow/
achMaxScroll/menuAchievements/gotoScreen via the canvas-recording stub idiom established by
test-cs013-p3.js (no reimplemented scroll or geometry logic). Cover:
  (A) node --check; GAME_VERSION === "1.0.0.16" pin.
  (B) Entry defaults to the Weekly tab with scroll 0 — on a SECOND entry too, not just the first.
  (C) left/right switch tabs both directions and wrap or clamp (say which you chose); each
      switch resets scroll to 0.
  (D) Only the active tab's rows render — assert the recording log contains the active tab's
      achievement names and none from the inactive one.
  (E) achMaxScroll() returns a DIFFERENT, tab-appropriate ceiling per tab, and up/down clamp to
      [0, achMaxScroll()] on each. Cross-check the returned value against an independent
      recompute built from the real exported symbols (ACH_ROW_STEP / ACH_DESC_DY / ACH_SCALE /
      ACH_ROW_VISIBLE_H) — the same render-vs-clamp drift check test-cs013-p3.js does.
  (F) Rows render inside the clip bracket in the correct save->beginPath->rect->clip->rows->
      restore order, and the panel title / tab header / footer all draw OUTSIDE it.
  (G) Both drawAchRow branches (tiered and single-goal) still render correctly in the new
      single-column layout.
  (H) Back still returns to "titlemenu" (P2's destination) with the cursor restored.
  (I) AudioSys.ctx null -> startGame()/update(1/60) + a full open/tab-switch/scroll/close cycle
      no-crash, from the title.

EXPECT SIGNIFICANT PRE-EXISTING TEST BREAKAGE. test-cs013-p3.js pins achievements row geometry
across ~267 assertions and test-cs015-p2.js pins the three-line row layout — both were written
against the three-column layout. Grep scratchpad/ for drawAchievements, drawAchRow, achMaxScroll
and the ACH_* consts BEFORE editing, list every file, then update them. For each, preserve the
assertion's INTENT (sizes, contrast, clip bracket, scroll clamp) and repoint only the positional
expectations that the single-column layout genuinely invalidates. Do not delete coverage to make
the suite pass. Report full suite counts.

This is the round's last phase: update STATUS.md to CS016 ROUND COMPLETE, and consolidate the
CS016 P1-P5 entries into one round-closing GDD-VERSION-HISTORY.md entry (the CS012/CS013/CS015
precedent). Do not push.
```

**Session setup:** Opus 5, effort **high**. The tab-aware ceiling and the test-migration judgement
are the non-mechanical parts.

**Docs:** GDD §2.17 (viewer rewritten: two tabs, single full-width column, tab-aware ceiling, the
CS013 P3 `colW` complaint resolved), top-of-file Current-build → CS016 P5 / `"1.0.0.16"`,
Architecture Map `game.menu` row (tab field), consolidated `GDD-VERSION-HISTORY.md` entry,
`STATUS.md` round-complete.

**Commit:** `CS016 P5: Achievements viewer becomes two tabs; bump GAME_VERSION to 1.0.0.16`

---

## Round-level notes

**No voice-lab gate this round.** CS016 touches no `phon` strings and no `VOICE_LINES` entry. There
is no ⛔ STOP handoff block — every phase can run back to back.

**Frozen keys untouched.** No phase adds, renames, or restructures a `localStorage` key.
`game.menu.achTab` (P5) and `game.menu.modal` (P3) are **runtime-only** state and must not be
persisted — a tab position and an open dialog are not settings.

**Two known latent bugs deliberately left alone** (`PLANNED-FEATURES-CS016.md` FLAG-CS016-g), so no
phase should "fix" them in passing: `captureKeyRebind` destroys shipped dual bindings by replacing
the whole `keys` array with a single key, and there is no rebinding conflict detection at all.
Both are real; both are out of scope; both want their own changeset.

**Highest-risk moment in the round is P2**, and the second-highest is P5's test migration. If a
phase has to be reverted, revert to the last green phase commit rather than patching forward —
the CS014 lesson.