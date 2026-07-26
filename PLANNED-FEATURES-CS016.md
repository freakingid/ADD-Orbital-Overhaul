# PLANNED-FEATURES-CS016.md — Title & Menu Navigation Pass

**Round:** CS016
**Target `GAME_VERSION`:** `"1.0.0.16"` (placement per FLAG-CS016-i)
**Build this was specced against:** CS015 P7 round-complete, `GAME_VERSION "1.0.0.15"`
**Source of requirements:** Paul's "Description of what our Title and Menu system needs" (8 sections)
**Scope note:** the reusable menu-library extraction discussed alongside this round is **explicitly
out of scope** and deferred. This round changes Orbital Overhaul only, in place, using the existing
menu state machine. No ES modules, no build step, no new external runtime files.

**Fork status: all three resolved** — FORK-CS016-A → single-parent IA, FORK-CS016-B → (b)
chrome-less title menu with the keyboard legend dropped, FORK-CS016-C → (b) confirm Return to
Defaults and mid-run Quit. See the RESOLVED FORKS section.

> **Anchors below are indicative line numbers from the CS015 P7 build.** Per the standing
> convention, every anchor is re-grepped **by symbol** at implementation time — line numbers drift
> between phases and must never be trusted from this document.

---

## §0 — What already ships (read this first)

A symbol-level grep of the live build against Paul's 8-section description found that the large
majority of the requested behaviour **is already built**. This round is much smaller than the
description implies. Recording the audit here so no phase re-implements something that exists.

| Requirement | Status in CS015 P7 build |
|---|---|
| 1.1 Title, artwork, animation | Partial — `drawText` title lines + `titleDebris` drifting field (~L5844, L6161) |
| 1.2 Keyboard controls shown on title | ✅ two legend lines (~L5847–5848) |
| 1.3 Options from title | ⚠️ `O` key + gamepad `B` only — **ESC does nothing on the title** |
| 1.4 Achievements from title | ⚠️ only via `O` → Options → Achievements |
| 1.5 High Scores from title | ⚠️ only via `O` → Options → High Scores |
| 2.1–2.3 Options → Sound / Controls / Difficulty | ✅ `MENU_OPTIONS` (~L2321) |
| 2.4 Options Back to entry context | ✅ already context-aware (`menuOptions`, ~L2505) |
| 3.1–3.4 SFX / Music / Voice / Master volume | ✅ `SOUND_ROWS` + `VOL_LABELS`/`VOL_CATS` (~L2326–2328) |
| 3.5 Voice on/off | ✅ voice **style** picker incl. `"off"` (`VOICE_STYLE_VALUES`) |
| 3.6 Captions toggle | ✅ `settings.captions` |
| 3.7 Music track selection | ✅ `MUSIC_TRACK_VALUES` cycler |
| 3.8 Back to Options | ✅ |
| 4.1 Configurable keyboard + gamepad | ✅ `startRebind`/`captureKeyRebind`/`capturePadRebind` (~L2666–2686) |
| 4.2 Sensitivity setting | ✅ Ship Rotation slider (`adjustShipTurnScale`, ~L2705) |
| 4.3 Return to Defaults | ⚠️ exists (`returnToDefaults`, ~L2691) — **fires immediately, no confirmation** |
| 4.4 Back to Options | ✅ |
| 5.1–5.2 Difficulty knobs | ✅ `DIFFICULTY_ROWS` = shot / magnet / autoshield / back |
| 5.3 Back to Options | ✅ |
| 6.1 Weekly + lifetime achievements | ✅ `drawAchievements` (~L5607) |
| 6.2 Scrolls for long lists | ✅ clipped continuous scroll (CS013 P3) |
| 6.3 Back to **Title** | ⚠️ backs to **Options** |
| 7.1 Local top-10 | ✅ `HighScores` + `drawScoreTable` (~L4372, L5683) |
| 7.2 Back to **Title** | ⚠️ backs to **Options** |
| 8.1 Continue | ✅ `MENU_ROOT_PLAY` |
| 8.2 Options from pause | ✅ |
| 8.3 Save | ❌ not present in any form |
| 8.4 Quit | ✅ |

**Net: the round is seven items**, listed in §1–§7 below.

---

## §1 — Title screen becomes a navigable vertical menu

**The problem.** The title screen is static text. Achievements and High Scores are two levels deep
behind an undiscoverable `O` keypress, and a gamepad player has no on-screen affordance telling them
`B` opens anything. This is the discoverability failure that motivated the whole round.

**The change.** The title screen gains a focused vertical menu, navigated with the same
up/down/confirm actions every other screen already uses, so keyboard and gamepad both work with zero
new input plumbing.

**Proposed items and order (FLAG-CS016-a):**

```
START GAME
ACHIEVEMENTS
HIGH SCORES
OPTIONS
```

Cursor defaults to `START GAME` on every entry to the title, so `ENTER` / `A` still starts a run
immediately — the existing muscle memory survives.

### §1.1 — The implementation seam (the load-bearing decision)

The existing menu machinery (`menuInput` dispatch ~L2470, `handleMenuKey` ~L2459,
`handleGamepadMenu` ~L2197, `menuNavEdges` ~L2269) is gated on `menuActive()`, which is
**`return game.paused;`** (~L2406). That one boolean currently means two different things at once:
*"the simulation is frozen"* and *"a menu owns input."* The title menu needs the second without the
first.

**Resolved approach — decouple the two meanings; the title menu does NOT set `game.paused`.**

```js
function menuActive() { return game.paused || game.menu.screen === "titlemenu"; }
```

The title menu lives at `game.menu.screen === "titlemenu"` with `game.paused` staying `false`. This
is safe because `update()` already early-returns on `game.state !== "playing"` — the sim was never
running at the title, so nothing needs freezing.

**Two downstream consumers must swap which concept they read.** Both are one-line edits, and both
are **provably byte-identical on today's build**, because `menuActive()` and `game.paused` are the
same value until `"titlemenu"` exists:

| Site | Today | After | Why |
|---|---|---|---|
| `updateMusic()` ~L6289 | `setDuck(menuActive() && screen !== "highscores")` | `setDuck(game.paused && screen !== "highscores")` | Ducking makes room for **gameplay** audio under an overlay. There is no gameplay under the title. Reading `game.paused` means the title menu can never duck the title track. |
| `musicStateFor()` ~L6281 | `if (game.paused && screen === "highscores")` | `if (menuActive() && screen === "highscores")` | High Scores is now entered from the title menu, where `game.paused` is false. Without this swap the `highscore` fanfare track silently stops playing on that screen — a regression, not a design change. |

Getting these backwards is the single easiest way to break this round: the duck reads the
**freeze** concept, the music-state read uses the **menu-open** concept. They move in opposite
directions.

**FLAG-CS016-l — `menuActive()`'s `"titlemenu"`-only check does not survive drilling into a
sub-screen (discovered during P1, unresolved).** `menuActive()` gates three things: the music
system (above), the render path, and — the one this flag is about — the input router
(`handleMenuKey`/`handleGamepadMenu`, both `if (menuActive())`-gated). §2 has `menuAchievements` /
`menuHighScores` reach their screens via `gotoScreen("achievements"|"highscores")`, which sets
`game.menu.screen` to that name — **not** `"titlemenu"` — while `game.paused` stays `false` (never
set true anywhere in the title-menu path). At that exact moment `menuActive()` evaluates
`false || ("achievements" === "titlemenu")` = **false**, i.e. the same gap the table above
documents for `musicStateFor()`, except here it breaks input, not just music: Up/Down/Back stop
routing through `handleMenuKey`/`handleGamepadMenu` on those two screens, and keydown falls through
to the title's normal-play branch, where Confirm triggers `startGame()` — pressing Enter while
looking at High Scores would silently start a new run. Verified against the live P1 build
(`scratchpad/test-cs016-p1.js` section D pins today's actual — currently gap-exposing — behavior).
**Not fixed in P1** (out of phase scope — P1 is the exact three-edit seam, nothing more) and **not
fixed in this doc's original §1.1 text** (an oversight — the swap table above was written assuming
the `"titlemenu"` check alone would cover every title-descendant screen; it only covers the root).
**Candidate fix for P2:** `game.menu.screen !== null` in place of `game.menu.screen === "titlemenu"`
— i.e. `function menuActive() { return game.paused || game.menu.screen !== null; }`. This is
**equally byte-identical on today's build** (verified: every existing code path that sets
`game.menu.screen` non-null — `openPause()`, `openDebug()` — sets `game.paused = true` in the same
call, and `closePause()`/`quitToTitle()` null both together, so `screen !== null` and `game.paused`
are the same value today, exactly like the `"titlemenu"` check is) and it organically covers every
present and future title-descendant screen without an ever-growing OR chain. P2 should confirm this
(or a different fix) explicitly rather than inherit the gap silently.

- **`drawMenu()` chrome.** `drawMenu()` (~L5345) paints a full-viewport dim (`rgba(4,10,20,0.88)`)
  then `menuPanel()` paints an opaque panel. The title branch of `draw()` (~L5866) currently calls
  it under `if (game.paused)`. Since the title menu no longer sets `game.paused`, the title menu
  gets its own chrome-less render path automatically — and Options opened *from* the title still
  routes through `drawMenu()` as it does today, panel and all. This falls out of the design rather
  than needing a special case.
- **Boot and quit entry.** The `game` literal (~L3689) starts at `state: "title"` with
  `menu.screen: null`, and `quitToTitle()` (~L2430) sets `menu.screen = null`. Both must now land on
  `"titlemenu"`, or the title screen boots with no cursor and no way to navigate.

**Alternative considered and rejected:** setting `game.paused = true` at the title so everything
downstream "just works" unchanged. Rejected because it makes `game.paused` assert something false
about the world, and every future consumer of that flag inherits the lie. The two swaps above are
cheaper than that debt.

### §1.2 — Layout

The title currently draws, top to bottom: `ORBITAL` (64px) / `O V E R H A U L` (32px) / two control
legend lines (20px) / `BEWARE THE HUNTER SATELLITE` (18px) / blinking `PRESS ENTER TO START` (26px) /
the `OPTIONS / ACHIEVEMENTS: O` hint (14px) / version stamp.

**Resolved (FORK-CS016-B → b).** After this round the title screen draws, top to bottom:

```
ORBITAL                     (64px, unchanged)
O V E R H A U L             (32px, unchanged)

  ▶ START GAME              (menu rows, ~24px, existing "▶ " selection idiom)
    ACHIEVEMENTS
    HIGH SCORES
    OPTIONS

BEWARE THE HUNTER SATELLITE (18px, unchanged — flavour, kept)
↑↓ move   ENTER / A select  (drawMenuHint, MENU_HINT_SIZE)
v1.0.0.16                   (version stamp, unchanged position)
```

**Removed:** both keyboard control-legend lines (`ROTATE: … THRUST: …` and `FIRE: … SHIELD: …
PAUSE: …`), the blinking `PRESS ENTER TO START`, and the `OPTIONS / ACHIEVEMENTS: O` hint. The
legend is redundant once Options → Controls is a visible, navigable destination listing every
binding authoritatively — and it never served a gamepad player, being keyboard-only text.

**Kept:** `titleDebris` drifting field and the version stamp, both untouched.

A control hint replaces the old `PRESS ENTER TO START` blink, routed through the existing
`drawMenuHint()` helper (~L5325) rather than a fresh `drawText` literal — the CS013 P2 precedent.

---

## §2 — Achievements and High Scores reachable from the title menu

**Resolved (FORK-CS016-A → single-parent IA).** Rather than letting these screens have two parents
and building machinery to track which one, each screen gets **exactly one parent**:

| Screen | Parent after CS016 | Was |
|---|---|---|
| Achievements | **Title menu** | Options |
| High Scores | **Title menu** | Options |
| Difficulty | **Options** | Options (unchanged) |
| Sound / Music | Options | Options (unchanged) |
| Controls | Options | Options (unchanged) |

**No return-context machinery is added.** No nav stack, no `returnTo` tracker, no revival of
`achReturn`. Every Back destination stays hardcoded exactly as it is today — only two of them change
which screen they name:

- `menuAchievements` (~L2565): `gotoScreen("options", …)` → `gotoScreen("titlemenu", …)`
- `menuHighScores` (~L2582): `gotoScreen("options", …)` → `gotoScreen("titlemenu", …)`

**`MENU_OPTIONS` drops from six rows to four:**

```js
const MENU_OPTIONS = ["Sound / Music", "Controls", "Difficulty", "Back"];
```

This is safe to do positionally-blind: every consumer already addresses rows **by label** via
`MENU_OPTIONS.indexOf(...)` (verified — 8 call sites, ~L2506–2658, plus the `forEach` renderer at
~L5397). Removing two entries shifts no hardcoded index anywhere.

**The one screen that legitimately has multiple parents is Options** (title menu, pause root,
gameover root) — and its context-aware Back branch **already exists** (~L2517, ~L2520):

```js
if (game.state === "playing" || game.state === "gameover") gotoScreen("root", …); else closePause();
```

Only the `else` changes — from "close the overlay entirely" to "return to the title menu." That is
an edit to an existing branch, not a new branch.

**Accepted cost, confirmed by Paul.** Achievements and High Scores become **unreachable mid-run and
at gameover**. This reverses two prior deliberate decisions — CS010 P4 §8b nested High Scores under
Options specifically so it would be reachable from pause, and CS012 P4 made Achievements
Options-only for the same reason. Two mitigations already exist and are unaffected: the gameover
screen renders the high-score table inline with the fresh entry highlighted (CS010 P5), and
achievement unlocks fire as toasts during play (`drawToasts`, ~L5740).

**IA result:** Options becomes purely *"change how the game behaves"*; the title menu becomes
*"start playing, or look at things."*

---

## §3 — Modal confirmation dialog (new machinery)

**The gap.** `returnToDefaults()` (~L2691) wipes every rebindable action's keys and buttons back to
`DEFAULT_BINDINGS` and saves immediately on `confirm`. One accidental keypress on that row destroys
a player's entire control setup with no undo. Spec item 4.3 requires an "are you sure?" gate.

**No dialog/modal system exists anywhere in the build.** This is the only genuinely new machinery in
the round.

### §3.1 — Proposed shape

A single generic modal, held on the menu state object rather than as a new screen — because it must
render **over** whichever screen invoked it, not replace it:

```
game.menu.modal = {
  text:      "Reset all controls to defaults?",   // prompt line
  confirmLabel: "RESET",                          // affirmative row label
  cancelLabel:  "CANCEL",
  index:     1,                                   // 0 = confirm, 1 = cancel — defaults to CANCEL
  onConfirm: fn,
  onCancel:  fn                                   // optional; defaults to dismiss
}
```

**Input interception.** `menuInput(action)` (~L2470) already opens with an exclusive-mode guard for
rebinding:

```js
if (game.menu.rebinding) return; // capture mode owns all input
```

The modal follows the identical precedent — an exclusive branch checked before the screen `switch`,
so no per-screen handler needs to know modals exist:

- `up` / `down` (and `left` / `right`, since a two-item horizontal row reads naturally either way)
  move between confirm and cancel
- `confirm` runs the focused branch and dismisses
- `back` cancels and dismisses
- `pause` — see FLAG-CS016-f

**Precedence against rebinding.** A modal and a live rebind capture can never coexist (the modal is
only reachable from a menu row, and `startRebind` is only reachable the same way), but the guard
order should still be explicit: rebinding first, then modal, then screen dispatch.

**Render.** `drawModal()`, called at the end of `drawMenu()` (~L5345) so it paints over the current
screen's panel. Reuses `menuPanel()` for the box and `drawMenuHint()` for the footer; two centered
rows using the existing `▶ ` selection idiom. Cursor defaults to **cancel** so a
double-tap of `ENTER` can never destructively confirm.

### §3.2 — Consumers

**Resolved (FORK-CS016-C → b).** Two consumers this round:

1. **Return to Defaults** (`menuControls`, ~L2637 `defaultsRow` branch) — spec 4.3. Prompt:
   *"Reset all controls to defaults?"*
2. **Quit, mid-run** (`menuRoot`, ~L2484, the `"Quit"` label branch reached from `MENU_ROOT_PLAY`) —
   discards an entire session's progress on one keypress. Prompt: *"Quit to title? Progress in this
   run will be lost."*

**Explicitly NOT confirmed: `"Quit to Title"` at gameover** (`MENU_ROOT_OVER`). The run is already
over — there is nothing left to destroy, and confirming a harmless action trains players to dismiss
modals reflexively. `menuRoot` dispatches by **label**, and the two paths already carry different
labels (`"Quit"` vs `"Quit to Title"`), so this distinction needs no state check — the existing
label dispatch separates them for free.

---

## §4 — Save row in the pause menu (disabled)

Spec 8.3. Save is not implemented and is not being implemented this round. Paul's call: **show it
disabled but visible**, so the player learns the feature is coming.

**Change.** `MENU_ROOT_PLAY` (~L2305) grows from `["Continue", "Options", "Quit"]` to
`["Continue", "Save", "Options", "Quit"]`.

`MENU_ROOT_OVER` (`["Play Again", "Options", "Quit to Title"]`) is **not** touched — there is no run
in progress at gameover, so a Save row there would be meaningless.

**Disabled-row model (FLAG-CS016-b).** The build has no concept of a non-selectable row. Proposed:
the row is **focusable but inert** — the cursor can land on it, it renders in `COLOR.dim` (dimmer
than the `COLOR.menuIdle` used for normal unselected rows, so it reads as unavailable rather than
merely unfocused), and `confirm` on it does nothing. Focusable-but-inert beats skip-over because a
skipped row is invisible to a player who never sees the cursor stop there, which defeats the point
of showing it at all.

**Panel sizing.** `drawRootMenu` (~L5377) uses `menuPanel(w, 300, …)` with a fixed 46px row step and
the hint at `y + 272`. A fourth row at that step overruns the 300px height. The height must grow (or
be derived from `items.length`, which is the more self-healing fix and matches the CS015 P1
precedent of deriving panel width from measured content rather than hardcoding).

Both root layouts render through the one `drawRootMenu`, so a derived height covers the 3-item
gameover root and the 4-item pause root without a branch.

---

## §5 — Difficulty settings locked when entered from Pause

**The problem.** Options is reachable from Pause, and Difficulty sits under Options. Changing
auto-shield, shot-powerup expiry, or magnet expiry **mid-run** retroactively changes the rules of a
run already in progress — which corrupts the meaning of the resulting score and any achievement
progress earned in it.

**Paul's call: lock the difficulty controls when the screen was entered from Pause.**

**Behaviour.** On the Difficulty screen (`menuDifficulty`, ~L2592), when the screen was reached from
a paused live game:

- the three value rows (`shot`, `magnet`, `autoshield`) still take focus and still render their
  current values, so the player can *read* their settings
- `left` / `right` on a locked row is inert — no value change, no `saveSettings()`, no
  `AudioSys.ui()` confirmation blip
- the rows render dimmed, and a help line explains why (FLAG-CS016-c)
- `back` and the `Back` row behave normally

**Scope of "from Pause".** The lock keys on a live run being in progress —
`game.state === "playing"` — not merely on `game.paused`, since the title screen is also paused
under §1.1's design. **Gameover is deliberately unlocked**: the run is over, nothing is corrupted by
changing settings that will apply to the next one.

**Correction to an earlier draft of this document:** §2 previously claimed Difficulty needed the
same return-context mechanism as Achievements/High Scores. That was wrong — it conflated two
different questions. The lock keys on **whether a run is in progress** (`game.state === "playing"`),
which is already directly readable, not on **which screen you came from**. Difficulty needs no entry
tracking under any resolution of FORK-CS016-A.

---

## §6 — Achievements viewer as two tabs

**Current.** One screen, three columns: weekly (`xL`), and lifetime split across two columns
(`xM`, `xR`), each at `colW = 350` (~L5611). CS013 P3 flagged 350px as marginal for descriptions at
`ACH_SCALE` 1.5, and noted long descriptions may clip — a known, unresolved readability issue.

**Paul's call: two tabs — Weekly and Lifetime.**

**Behaviour.**

- `left` / `right` switch tabs. These actions are currently unused on this screen
  (`menuAchievements`, ~L2565, handles only `up`/`down`/`confirm`/`back`/`pause`), so there is no
  input conflict to resolve.
- `up` / `down` continue to drive the existing clipped continuous scroll.
- A tab header row shows both tab names with the active one highlighted, using the established
  selected/idle colour convention (`COLOR.text` / `COLOR.menuIdle`).

**Layout benefit.** One tab at a time means the full panel width is available per tab, which fixes
CS013 P3's `colW` readability complaint as a side effect rather than as separate work.

**`achMaxScroll()` must become tab-aware** (~L5600). It currently derives the ceiling from
`Math.max(activeWeekly().length, ceil(LIFETIME.length / 2))` — the tallest of the three columns. Per
tab, the ceiling is that tab's own row count. **The renderer and the input clamp must keep reading
the same function**, which is exactly why `achMaxScroll()` was hoisted to a shared top-level helper
in CS013 P3; do not let a tab-aware renderer grow its own private copy of the ceiling maths.

**Scroll state on tab switch (FLAG-CS016-d):** reset `game.menu.scroll` to 0 on every tab change.
Preserving a per-tab scroll offset means carrying two values on `game.menu` and getting the reset
semantics right on entry; not worth it for a viewer this small.

---

## §7 — ESC opens Options from the title screen

Spec 1.3 asks for ESC. The keydown listener (~L2110) gates pause on
`bindings.pause.keys.includes(k) && game.state === "playing"`, so **ESC is currently inert on the
title screen**. `O` is the only keyboard route, and it is undocumented outside the on-screen hint
this round removes (§1.2).

With §1's title menu, Options is a visible row, so this is now a convenience shortcut rather than
the sole path. See FLAG-CS016-e for whether the shortcut is retained at all, and what `O` becomes.

---

## RESOLVED FORKS

### FORK-CS016-A → **single-parent IA** ✅ RESOLVED

Paul's resolution, and better than any of the three options originally offered: rather than choosing
a mechanism to track multiple parents, **eliminate the multiple parents**. Achievements and High
Scores get the title menu as their sole parent; Difficulty keeps Options as its sole parent. No nav
stack, no return tracker, no `achReturn` revival — the problem is designed away rather than solved.
Full detail and the accepted access cost in §2. The three originally-offered options (nav stack /
return tracker / `game.state` branch) are all superseded and none is built.

### FORK-CS016-B → **(b) chrome-less title menu, keyboard legend dropped** ✅ RESOLVED

Menu rows draw directly on the title screen — no backdrop dim, no panel box, art and debris field
stay fully visible. Both keyboard control-legend lines are removed as redundant with Options →
Controls; `BEWARE THE HUNTER SATELLITE` is kept as flavour. Full layout in §1.2.

### FORK-CS016-C → **(b) confirm Return to Defaults and mid-run Quit** ✅ RESOLVED

Gameover's `"Quit to Title"` stays unconfirmed. Full detail in §3.2.

---

## Superseded fork options (recorded, not built)

Kept only so a future session can see what was considered and why it was passed over. **None of
this is in scope.**

### FORK-CS016-A — return-context mechanism *(superseded — no mechanism is built)*

Achievements, High Scores (§2) and Difficulty (§5) all need to know where they were entered from.
CS012 P4 deliberately retired the `achReturn` tracker when this stopped being necessary; it is
necessary again.

- **(a) A general navigation stack.** `game.menu.stack = []` — `gotoScreen` pushes the current
  screen, `back` pops. Solves the whole class of problem permanently, makes any future screen
  re-parenting free, and is the structurally correct answer. Costs the most: every screen's Back
  branch stops hardcoding its destination, which touches all seven existing handlers and their
  tests.
- **(b) A per-screen return tracker.** Reinstate something `achReturn`-shaped, generalised —
  `game.menu.returnTo = { screen, index }` set by `gotoScreen`. Cheaper, isolated, and one level
  deep is all this menu tree actually needs. But it is the pattern CS012 P4 removed on purpose, and
  it does not compose if a screen ever gets a third parent.
- **(c) Keep hardcoded destinations, branch on `game.state`.** Cheapest — Achievements' Back reads
  "if `game.state === "title"` go to the title menu, else go to Options". No new state at all. But
  it is another `game.state` branch of exactly the kind that has already been rewritten three times
  across CS012 P4, CS013 P1, and CS015 P4, and it will need rewriting again next time.

**Recommendation: (a).** The tree is now genuinely a tree with re-entrant nodes, which is what a
stack is for, and (c)'s branch has demonstrably churned every time the IA moved. But (a) has by far
the largest test blast radius, so it is Paul's call whether that cost lands this round.

### FORK-CS016-B — title menu chrome and legend

The title menu cannot render through `drawMenu()`'s dim-plus-panel path without hiding the title art
(§1.1). Beyond that, the two control-legend lines and `BEWARE THE HUNTER SATELLITE` compete with the
menu for vertical space.

- **(a) Chrome-less inline menu; keep both legend lines.** Menu rows drawn directly on the title
  screen, no backdrop, no panel. Legend stays below the menu, possibly at reduced size. Most
  information on screen; busiest.
- **(b) Chrome-less inline menu; move the legend into Options → Controls.** The Controls screen
  already lists every binding authoritatively, so the title legend is redundant reference material.
  Cleanest title screen; costs at-a-glance discoverability for a brand-new player who has not opened
  a menu yet.
- **(c) Panelled menu over a dimmed title.** Consistent with every other screen, zero new render
  path. But it hides the art and debris field behind a dim, which is a real loss on the one screen
  whose job is to look good.

**Recommendation: (b)**, keeping `BEWARE THE HUNTER SATELLITE` as flavour. A title menu that lists
`OPTIONS` makes an always-on keyboard legend redundant, and the gamepad player was never served by
it anyway.

### FORK-CS016-C — does Quit also get a confirmation modal?

§3's modal exists for Return to Defaults. `Quit` (mid-run, `MENU_ROOT_PLAY`) discards an entire
session's progress on one keypress, and `Achievements.save()` in `quitToTitle()` (~L2430) persists
only lifetime progress, not the run.

- **(a) Return to Defaults only.** Exactly what was asked for; minimum surface.
- **(b) Return to Defaults and mid-run Quit.** Both destructive-and-irreversible. `Quit to Title`
  at gameover is *not* destructive (the run is already over) and stays unconfirmed.
- **(c) Every destructive action, including gameover's Quit to Title.** Consistent, but confirms
  something that destroys nothing, which trains players to dismiss modals reflexively.

**Recommendation: (b).**

---

## FLAGS — best-guess decisions, review but not blocking

- **FLAG-CS016-a — title menu items and order.** `START GAME` / `ACHIEVEMENTS` / `HIGH SCORES` /
  `OPTIONS`, cursor defaulting to `START GAME`. Achievements above High Scores because the weekly
  set rotates and is the more time-sensitive thing to check.
- **FLAG-CS016-b — disabled row model.** Focusable-but-inert, rendered `COLOR.dim`. See §4.
- **FLAG-CS016-c — difficulty lock presentation.** Locked rows render `COLOR.dim`; a help line at
  the panel foot reads approximately *"Difficulty can't be changed during a run."* Wording is
  Paul's.
- **FLAG-CS016-d — achievements scroll resets on tab switch.** See §6.
- **FLAG-CS016-e — `O` and `ESC` on the title.** Best guess: **both** open Options directly, as a
  shortcut past the menu row. `O` is retained rather than retired because it is existing muscle
  memory and costs one line to keep.
- **FLAG-CS016-f — `pause` action inside a modal.** Best guess: treat as cancel. It should never
  close the entire menu stack out from under an open confirmation.
- **FLAG-CS016-g — rebinding is NOT touched this round.** Two latent issues were found and are
  deliberately left alone: (1) `captureKeyRebind` (~L2670) does `bindings[action].keys = [k]`, which
  **destroys the shipped dual bindings** — rebinding Thrust drops both `arrowup` and `w` in favour
  of one key, and there is no way back except Return to Defaults; (2) there is **no conflict
  detection**, so two actions can be bound to the same key with no warning. Both are real, neither
  was requested, and both would expand the round's scope significantly. Recorded here so a future
  changeset can pick them up deliberately.
- **FLAG-CS016-h — title art and animation unchanged.** Spec 1.1 names "artwork, animation"; the
  build has title text plus the `titleDebris` field. Best guess: this round reflows layout only and
  adds no new art. If more was intended, it is its own item.
- **FLAG-CS016-i — version bump placement.** `"1.0.0.16"` rides the **last player-visible phase** of
  the round, per the standing convention.
- **FLAG-CS016-j — music duck and music-state concept swap.** Resolved in §1.1 as two one-line
  edits that move in **opposite** directions: `setDuck` swaps `menuActive()` → `game.paused`, and
  `musicStateFor` swaps `game.paused` → `menuActive()`. Both are byte-identical on today's build,
  which makes them independently verifiable before the title menu exists. Getting them backwards
  permanently ducks the title track and silently kills the High Scores fanfare.
- **FLAG-CS016-k — `MENU_OPTIONS` shrinks 6 → 4.** Safe because all 8 consumers address rows by
  label via `indexOf`. Verified by grep, not assumed. See §2.
- **FLAG-CS016-l — `menuActive()`'s `"titlemenu"`-only check breaks on Achievements/High Scores.**
  Discovered during P1, unresolved — a real gap, not a matter of interpretation. See §1.1 addendum
  for the full derivation and a candidate fix (`game.menu.screen !== null` in place of
  `=== "titlemenu"`). **P2 must resolve this explicitly before shipping Achievements/High Scores
  navigation from the title menu.**

---

## Explicitly out of scope

- **The reusable menu library.** Deferred entirely. Nothing in this round should be shaped
  "for the library" at the cost of being the right change for Orbital Overhaul.
- **Save-game implementation.** §4 ships a disabled row only.
- **Internet leaderboards** (spec 7.1.2). Local top-10 only, unchanged.
- **Mouse and touch input.** The build has zero pointer handling (confirmed by grep: the only
  `click` in the file is the PNG-export download link). Not added.
- **Rebinding fixes.** FLAG-CS016-g.
- **`confirm` / `back` / `pause` becoming rebindable.** They are `fixed: true` (~L2033–2040) and
  stay that way — rebinding them lets a player lock themselves out of the menus.

---

## Risk notes

**Test blast radius is the dominant cost of this round.** The suite is 60 files / 4,844 assertions,
and menu behaviour is heavily pinned — including exact rendered text positions, panel geometry, and
screen-name strings. Files known to assert against surfaces this round changes:

`test-p4.js`, `test-p5.js`, `test-cs010-p4.js`, `test-cs012-p4.js`, `test-cs013-p1.js`,
`test-cs013-p2.js`, `test-cs013-p3.js`, `test-cs015-p1.js`, `test-cs015-p2.js`, `test-cs015-p4.js`,
`test-v34-p6.js`, `test-v36-scores.js`, `test-f9.js`.

That list is a **starting point from a keyword grep, not an audit** — the implementation phases must
grep `scratchpad/` per phase for the specific symbols that phase moves, which is the established
practice every prior round has followed.

Two specific hazards:

1. **`drawRootMenu` geometry** is pinned by `test-cs013-p2.js` and `test-cs015-p1.js`, including the
   panel-width measurement formula. §4's height change lands directly on it.
2. **`test-cs013-p3.js` pins achievements row geometry at 267 assertions**, and §6's tab rework
   moves essentially all of it.

**The `menuActive()` conflation (§1.1) is the highest-risk single change in the round** — it is one
boolean read by the music system, the render path, and the input router, and the title screen is
about to start setting it permanently. It deserves its own phase and its own headless test rather
than riding along with the title-menu layout work.