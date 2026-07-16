# IMPLEMENTATION-PHASES-CS013.md

**Changeset:** CS013 — a grab-bag of navigation, readability, and balance fixes surfaced by playtest
(gameover→title nav, three UI-readability edits, one auto-shield balance nerf). Lab-free.
**Base build (grepped, this session):** CS012 P5 · `asteroids-deluxe.html` · `GAME_VERSION` `"1.0.0.12"`
— **confirmed by grep** (`GAME_VERSION` at L242) **and `STATUS.md`** (top line: *"CS012 P5 … CS012 round
COMPLETE … `GAME_VERSION` "1.0.0.12"*"). CS012 shipped P1–P5 (UFO accuracy knob, HUD segmented Scoop +
fixed 5-row stack, Maxed-Out achievement, menu-IA collapse, opt-in auto-shield). Not Paul's summary —
verified.
**Source spec:** `PLANNED-FEATURES-CS013.md` (WHAT/WHY). Its one fork is resolved: **FORK-CS013-A → (a)**.
**Version stamp:** `"1.0.0.12" → "1.0.0.13"` on the **last player-visible phase**. Recommended host: **P4**
(the final phase of the sequence) — see *Version-bump note* below. Established `Major.Minor.Patch.Changeset`
scheme; the changeset digit closes the round on its last phase (CS012 did this on P5).

> **⚠ Upload/naming note (read once).** The file attached to this planning thread was *named*
> `IMPLEMENTATION-PHASES-CS013.md` but its first line is `# PLANNED-FEATURES-CS013.md` and its body is
> the **spec** (WHAT/WHY only — it even states the phase breakdown "come[s] in
> `IMPLEMENTATION-PHASES-CS013.md` (a later doc)"). So the spec was saved under the output filename. **This
> doc IS that later doc.** Save the attached spec back as `PLANNED-FEATURES-CS013.md`, and this file as
> `IMPLEMENTATION-PHASES-CS013.md`, so the two don't collide at repo root.

---

## Sequencing (per the spec's grouping note, honoured)

| Phase | Group | Item | Nature | Depends on |
|---|---|---|---|---|
| **P1** | A | §1 Gameover → Title navigation (context-aware gameover root) | FORK → (a), resolved | — |
| **P2** | B | §2.1 `COLOR.menuIdle` + §2.2 `drawMenuHint` palette/helper sweep | TWEAK | **P1** (sweep must cover A's new gameover-root rows) |
| **P3** | B | §2.3 Achievements viewer ×1.5 + contrast + clipped vertical scroll | TWEAK (only new machinery) | **P2** (reuses `COLOR.menuIdle`) |
| **P4** | C | §3 Auto-shield regen pause | TWEAK | — (independent) |

**Why this order.** The only hard dependency is **A → B** (B's readability sweep should recolour/resize the
*final* set of menu rows, including the gameover root P1 adds), and within B, **§2.1/§2.2 → §2.3** (§2.3's
contrast lift reuses the `COLOR.menuIdle` key §2.1 introduces). **Group C is fully independent** — it touches
`Ship.update`/`damageShip`/one constant, nothing in the menu tree — so its slot is free; it sits last only to
host the version bump.

**Version-bump note.** The `.12 → .13` bump belongs on **whichever phase ships last**. The recommended
sequence puts C last, so **P4 hosts the bump** (it *is* player-visible — the auto-shield plays differently).
If you reorder so C is not last, move the one-line `GAME_VERSION` edit **and** the pinned-literal test update
(below) to the actual final phase. Only one phase bumps.

---

## Standing non-negotiables (baked into every phase prompt)

- **Grep first, every phase.** Anchors below were re-grepped against *this* build, but they drift — re-grep
  the **symbol**, not the line number, at implementation time (CLAUDE.md; prior sessions surfaced plan-vs-code
  conflicts). Line numbers here are current-as-of-this-build fingerposts.
- **Frozen keys, no persisted field.** `afd_settings_v1` / `afd_scores_v1` / `afd_achievements_v2` unchanged.
  CS013 adds **nothing persisted**: §1 is menu structure, §2 is render-only, §2.3's scroll offset and §3's
  regen lock are **runtime fields** (on `game.menu` / the ship), never saved.
- **Invariant guards + AudioSys/MusicSys/VoiceSys buses untouched** — no CS013 item targets them.
- **Headless test per phase in `scratchpad/`** that drives the **REAL extracted code** (stub `window`/
  `document.getElementById`→Proxy-canvas/`requestAnimationFrame`; drive `startGame()`/`update(1/60)` and the
  real handlers/draws) — **never reimplement the logic under test**. A phase isn't done until its test passes.
- **Update pre-existing tests that legitimately change** (each phase names the ones it expects to touch). A
  changed assertion because behaviour changed is expected fallout, not a bug — comment it as such.
- **Docs edited in place** (GDD §, Architecture Map, top-of-file, STATUS.md; `GDD-VERSION-HISTORY.md` on the
  final phase). **Surgical `str_replace`, re-read before editing.**
- **Commit per phase on `main`. Never push** — Paul commits/pushes himself.
- **Surface genuinely new forks; best-guess the look-calls with a clear FLAG.** Don't re-open FORK-CS013-A.

---

## Grep audit — what the re-grep confirmed, corrected, and surfaced

**All spec anchors hold** (symbols present; a few line numbers drifted 1–2 lines, noted per phase). Specifics:

- **§1** confirmed exactly: `openPause` L2288, the route `game.menu.screen = game.state === "playing" ? "root"
  : "options"` **L2292**, `MENU_ROOT_PLAY`/`rootItems()` **L2243–2244**, `menuRoot()` **L2348**, `menuOptions()`
  context-aware Back **L2377 (confirm-label) / L2379 (`a==="back"`)**, `quitToTitle()` **L2306**, the `"o"`
  opener **L2128**. `drawRootMenu`'s dead `"PAUSED" : "MENU"` title ternary **L5165** — currently unreachable,
  revived by (a). Gameover "PRESS ENTER TO PLAY AGAIN" **L5628**. *Minor drift:* the gamepad `startGame()`
  sites are **L2189/L2193** (spec said 2188/2192) and pad-B `openPause()` is **L2191** (spec said 2190).
- **§2.1** `COLOR` block **L2728**; `text:"#a8d4ff"` **L2736**, `dim:"#3a5a80"` **L2737** (spec ~2739). The
  spec's site list is **accurate** — the non-`sel` booleans (`backSel`/`rowSel`/`m.row===`) at L5219/5253/5267/
  5278/5279 *do* exist and are correct. **FINDING-C (new, spec-unlisted):** two more `? COLOR.text : COLOR.dim`
  sites the spec didn't enumerate — **L5243** (Difficulty toggle inactive-side, `r.rightActive ? …`) and
  **L5313** (`drawBindCell` value text) — plus **L5424** (`drawEntrySlots` initials) and **L5745** (HUD chain
  count), both clearly out of menu scope. Resolutions in P2.
- **§2.2** footer/hint sites confirmed: `drawRootMenu` **L5170**, `drawOptionsMenu` **L5183**, `drawSound`
  **L5220**, `drawDifficulty` help **L5254** + hint **L5255**, `drawControlsMenu` **L5280**, plus the
  Achievements footer **L5355** (handled in P3). No shared hint helper exists — each is a literal.
- **§2.3** `drawAchievements()` **L5340**; `menuPanel(1200,660,"ACHIEVEMENTS")` **L5343** (**spec's "L103" is
  an error** — harmless; the symbol is unambiguous). `colW=350`, `ry0=y+130`, `step=40` **L5345**; headers
  size 15 `COLOR.satellite` **L5346–5348**; `half=Math.ceil(LIFETIME.length/2)` **L5350** → **LIFETIME.length
  = 20, confirmed by count → half = 10** (10+10). `drawAchRow` **L5364–5377**: name 15, progress 13/14, desc
  **size 10 `COLOR.dim` at `ry+15`**. `menuAchievements` **L2424** handles only `pause`/`confirm`/`back` —
  **up/down are free**. `gotoScreen(s,index)` **L2317** resets index/row/col but has **no scroll field** →
  add `game.menu.scroll = 0` there. Both keyboard and pad feed `menuInput(action)` normalized to `"up"/"down"`.
- **§3** `SHIELD_RECHARGE=0.12` **L128**, `SHIELD_HIT_COST=0.22` **L129**, `AUTO_SHIELD_SCORE_PENALTY=500`
  **L131**, `HIT_STUN_DURATION=1.0` **L173**, `LOW_HP_THRESHOLD=100` **L174**. Passive recharge (the **only**
  site) **L2821** (`else` branch, L2819–2821). Ship field init `this.shieldOn=false; this.energy=1` **L2781–
  2782**. `s.invuln` decrement **L2852** (`if (this.invuln > 0) this.invuln -= dt;`). Auto-shield branch
  **L4266–4281** (`s.invuln = HIT_STUN_DURATION;` **L4275** — where the lock arms).

**New items surfaced for Paul (not blocking; best-guessed, flag if you disagree):**
- **FINDING-A (P1):** the hint `"OPTIONS / ACHIEVEMENTS: O    (controller: B)"` appears **twice** — the
  **title** copy **L5559** (`VIEW_H/2 + 220`) and the **gameover** copy **L5629** (`VIEW_H/2 + 312`). Under (a),
  only the **gameover** routing changes (O/B now opens the gameover **root**: Play Again / Options / Quit to
  Title); **title O/B still opens Options directly**, so **L5559 stays accurate and must NOT be touched**. Edit
  **only L5629** to `"MENU: O    (controller: B)"` (best-guess copy). Because the literal is non-unique,
  `str_replace` must disambiguate by the `VIEW_H/2 + 312` coordinate. Wording is a look-call — flag to override.
- **FINDING-C (P2):** L5243 (leave `COLOR.dim` — a toggle state indicator, per §2.1's "glyphs stay dim") and
  L5313 (best-guess **include** → `COLOR.menuIdle`, so an unselected rebind row's key reads as legibly as its
  label — consistent with the value-column sites the spec *did* list). L5424/L5745 excluded. Flag to override.

---

# Phase P1 — Gameover → Title navigation (Group A, §1)

**Goal.** Give the gameover screen its own context-aware root `["Play Again","Options","Quit to Title"]` so
there is a menu path back to Title, per **FORK-CS013-A → (a)**. Natural completion of CS012 P4's own
philosophy (session states get a root; title doesn't).

**Load-bearing risk (self-flagged): the BACK PATH.** This re-touches the exact area CS012 P4 simplified
(`openPause`/`rootItems`/`menuRoot`/`menuOptions`-Back). CS012 P4's STATUS note is explicit that a wrong
"Back from Options" dead-ends navigation. Test **both** the gameover-root→Options→back-to-root loop **and**
Quit-to-Title, in **both** the gameover and the (unchanged) playing contexts.

**Exact work (7 edits + hint + tests + docs):**
1. **`openPause()` route (L2292):** `game.state === "playing" ? "root" : "options"` →
   `(game.state === "playing" || game.state === "gameover") ? "root" : "options"` (title still → `"options"`).
2. **`rootItems()` (L2244)** becomes context-aware:
   `return game.state === "gameover" ? MENU_ROOT_OVER : MENU_ROOT_PLAY;` where a new
   `const MENU_ROOT_OVER = ["Play Again", "Options", "Quit to Title"];` sits beside `MENU_ROOT_PLAY` (L2243).
   *(Do not resurrect `MENU_ROOT_SYS` — this is a new, differently-shaped constant.)*
3. **`menuRoot()` confirm branch (L2353–2357)** gains the two gameover labels:
   `else if (label === "Play Again") startGame();` and `else if (label === "Quit to Title") quitToTitle();`
   (Continue/Options/Quit branches unchanged; dispatch stays by-label).
4. **`menuOptions()` Back (L2377 confirm-label AND L2379 `a==="back"`):** extend the playing test to
   `game.state === "playing" || game.state === "gameover"` → `gotoScreen("root", rootItems().indexOf("Options"))`;
   title still `closePause()`. **Both branches** — they must stay in lockstep (CS012 P4's lesson).
5. **`drawRootMenu` (L5165)** — the `"PAUSED" : "MENU"` ternary is already correct copy for the revived
   gameover root ("MENU" shows at gameover). Confirm it reads well; no change needed unless the fit-check
   below says otherwise (the panel is `menuPanel(360, 300, …)`; three rows fit — same count as playing).
6. **FLAG-CS013-1a entry-guard.** The gameover root path opens via `openPause()`, which at gameover is reached
   through the `"o"` handler (**already `!game.entry`-guarded, L2128**) and pad-B (L2191, reached only when
   `onTitleOrOver` and no menu is open). Confirm nothing lets the root open mid-initials-entry; the existing
   guards cover it, but **assert it in the test** (open attempt while `game.entry` is truthy is a no-op).
7. **FINDING-A — stale gameover hint (L5629 ONLY).** The literal `"OPTIONS / ACHIEVEMENTS: O    (controller:
   B)"` appears **twice** — title at L5559 (`VIEW_H/2 + 220`) and gameover at L5629 (`VIEW_H/2 + 312`). Edit
   **only the gameover copy** (`+312`) → `"MENU: O    (controller: B)"` (keep `COLOR.ach`, size 14, `+312`);
   `str_replace` must include the `VIEW_H/2 + 312` coordinate to stay unique. **Leave the title copy L5559
   untouched** — title O/B still opens Options directly. Flag the wording to Paul.

**FLAG-CS013-1b (settled by spec → include "Play Again").** Keep it in `MENU_ROOT_OVER` so the opened menu is
self-complete. No change to the bare-screen Enter-to-play-again.

**Test — `scratchpad/test-cs013-p1.js`** (drive the REAL `openPause`/`menuInput`/`menuRoot`/`menuOptions`/
`rootItems`/`closePause` — mirror `test-cs012-p4.js`'s idiom; no reimplementation):
- Source-grep: `MENU_ROOT_OVER` exists; `MENU_ROOT_SYS` still absent (don't reintroduce it).
- `rootItems()` returns `["Continue","Options","Quit"]` when `game.state==="playing"`, `["Play Again","Options",
  "Quit to Title"]` when `"gameover"`, and (unchanged) the play list at `"title"`.
- **Gameover:** `openPause()` lands on `"root"` (NOT `"options"`); navigating to "Quit to Title" → `quitToTitle`
  (assert `game.state → "title"`, overlay closed); "Play Again" → `startGame` (assert a fresh run); Options →
  `"options"`, Back → **back to `"root"`** (still overlaid, cursor on Options), Back again → closes to gameover.
- **Playing (regression):** `openPause()` → `"root"` = `["Continue","Options","Quit"]`; Options → back → `"root"`;
  Quit → `quitToTitle`. Byte-for-byte the pre-CS013 behaviour.
- **Title (regression):** `openPause()` → `"options"` (NOT `"root"`); Back closes to title.
- **Entry guard (FLAG-1a):** with `game.entry` truthy, the gameover open path is inert.
- `AudioSys.ctx` null → `startGame()`/`update(1/60)` + a full gameover open/nav/close cycle never throw.

**Pre-existing tests to update (expected fallout — behaviour changed, not a bug):**
- **`test-cs012-p4.js`** is the primary one. Its section (B) asserts `rootItems()` returns only
  `[Continue,Options,Quit]` in **every** state — now context-aware, so the gameover case changes. Its section
  (D) asserts **gameover → `openPause()` lands on `"options"`** and Back closes — now gameover → `"root"`, Back
  from Options → `"root"`. Rewrite (B) and (D) to the new gameover-root contract; keep (C) title-path and (E)
  playing-path as-is (both unchanged). Grep `scratchpad/` for other tests reading `rootItems`/gameover-open
  (`test-cs010-p4.js`, `test-v36-scores.js`, `test-p4.js` were all touched by CS012 P4) and fix any that assert
  the retired "gameover → Options-direct" path; leave the rest.

**Docs (edit in place):** GDD **§2.9** (the "Open OPTIONS (from title/gameover)" bullet L149 + the pause-menu
bullet L153 — gameover now opens a **root** with Play Again / Options / Quit to Title; title still Options-direct);
GDD **§2.16** state-machine bullet (L328–329 — `rootItems()` context-aware over `MENU_ROOT_PLAY`/`MENU_ROOT_OVER`;
the `drawRootMenu` "MENU" branch is **reachable again** — correct the "unreachable dead text" note); Architecture
Map **Menu/Options/Rebinding** row (L394 — `rootItems()` returns a gameover list now); **STATUS.md** (new CS013
P1 session entry). No version bump this phase.

**Model / effort / thinking:** **Sonnet 5 · effort `high`.** Well-specified menu wiring, but the back-path is
the trap — drop **`ultrathink`** into the message on the `menuOptions`-Back / gameover-root loop. (Step up to
Opus 4.8 `high` only if the back-path proves fiddly.)

**Suggested commit message:**
`CS013 P1: gameover gets its own context-aware root (Play Again / Options / Quit to Title); restores the Gameover→Title path (FORK-CS013-A → a)`

**Paste-ready Claude Code prompt:**
> Implement CS013 Phase 1 (Group A, §1) — the gameover→Title navigation fix, `PLANNED-FEATURES-CS013.md`
> FORK-CS013-A → (a). Read `STATUS.md` first. **Re-grep every anchor before editing — they drift; confirm the
> symbol, not the line number.** Current fingerposts: `openPause` route L2292, `MENU_ROOT_PLAY`/`rootItems()`
> L2243–2244, `menuRoot()` L2348 (confirm branch ~L2353–2357), `menuOptions()` Back L2377 **and** L2379,
> `quitToTitle` L2306, `drawRootMenu` title ternary L5165, the bare-gameover hint L5629.
>
> **The load-bearing risk is the BACK PATH** (CS012 P4's lesson — get "Back from Options" wrong and gameover
> nav dead-ends). `ultrathink` the `menuOptions`-Back / gameover-root loop.
>
> Edits, surgically via `str_replace`: **(1)** `openPause()` routes `playing || gameover → "root"`, title
> still `→ "options"`. **(2)** add `const MENU_ROOT_OVER = ["Play Again","Options","Quit to Title"];` beside
> `MENU_ROOT_PLAY`; `rootItems()` returns `MENU_ROOT_OVER` when `game.state === "gameover"`, else
> `MENU_ROOT_PLAY`. Do **not** reintroduce `MENU_ROOT_SYS`. **(3)** `menuRoot()`'s confirm branch handles the
> two new labels (Play Again → `startGame`, Quit to Title → `quitToTitle`); keep by-label dispatch. **(4)**
> `menuOptions()`'s Back — **both** the confirm-label branch and the `a==="back"` branch — extend the playing
> test to `playing || gameover` → `gotoScreen("root", rootItems().indexOf("Options"))`; title still
> `closePause()`. **(5)** confirm `drawRootMenu`'s "MENU" title reads well at gameover (fit-check the 3 rows in
> the 360×300 panel). **(6)** FLAG-1a: confirm the path can't open during initials entry (existing
> `!game.entry` guard on the `"o"` opener covers it — assert it in the test). **(7)** the hint
> `"OPTIONS / ACHIEVEMENTS: O    (controller: B)"` exists **twice** — title L5559 (`VIEW_H/2 + 220`) and gameover
> L5629 (`VIEW_H/2 + 312`). Edit **only the gameover copy** (disambiguate `str_replace` with the `VIEW_H/2 + 312`
> coordinate) → `"MENU: O    (controller: B)"`, keep `COLOR.ach`/size 14/+312; **leave the title copy L5559**
> (title O/B still opens Options directly).
>
> Ship `scratchpad/test-cs013-p1.js` driving the REAL handlers (mirror `test-cs012-p4.js`; no reimplementation):
> `rootItems()` per-state shape; gameover open → `"root"`, Quit-to-Title → title, Play Again → fresh run,
> Options→Back→root→Back→close; playing-path regression (unchanged); title-path regression (Options-direct);
> entry-guard no-op; `AudioSys.ctx` null no-crash. **Update `test-cs012-p4.js`** sections (B) and (D) to the new
> gameover-root contract (keep C/E); grep `scratchpad/` for other gameover-open assertions and fix only the ones
> that legitimately changed. Run the full regression + `node --check`.
>
> Docs in place: GDD §2.9 (gameover opens a root now), §2.16 (context-aware `rootItems`; "MENU" branch reachable
> again), Architecture Map Menu row, STATUS.md. **No version bump.** Commit on `main` with the message above.
> **Do not push.** If a genuinely new fork surfaces, stop and flag it.

---

# Phase P2 — Menu-item contrast + hint helper (Group B, §2.1 + §2.2)

**Goal.** Two readability edits in one small palette/helper sweep: (§2.1) unselected menu-item text moves from
the too-dim `COLOR.dim` to a new brighter `COLOR.menuIdle`; (§2.2) the control-hint footers get larger + higher-
contrast via a single `drawMenuHint` helper. This sweep covers P1's new gameover-root rows too (why A precedes B).

**Exact work:**

**§2.1 — new palette key + swap.**
1. Add **`menuIdle: "#6f92bd",`** to the `COLOR` block (L2728; beside `text`/`dim` at L2736–2737).
   *Best-guess shade (FLAG-2a) — tune by eye against the `rgba(2,6,14,0.95)` panel; clearly legible yet visibly
   dimmer than `#a8d4ff`.* **Do NOT lighten `COLOR.dim` globally** — it also colours HUD ring tracks, chevrons,
   table headers, the ◄►/`|` glyphs and slider frames, which stay dim.
2. Swap the **non-selected menu-item** `COLOR.dim` → `COLOR.menuIdle` at these confirmed sites (re-grep
   `? COLOR.text : COLOR.dim`):
   - **L5168** `drawRootMenu` item · **L5181** `drawOptionsMenu` item · **L5196** `drawSound` row label ·
     **L5204** `drawSound` volume % readout · **L5212** `drawSound` value column · **L5219** `drawSound` Back ·
     **L5239** `drawDifficulty` row label · **L5253** `drawDifficulty` Back · **L5267** `drawControlsMenu` rebind
     row label · **L5278** `drawControlsMenu` "Return to Defaults" · **L5279** `drawControlsMenu` "Back" ·
     **L5289** `drawTurnScaleRow` "Ship Rotation" label · **L5302** `drawTurnScaleRow` % readout.
   - **FINDING-C (best-guess):** **also L5313** (`drawBindCell` value text — change the `sel ? COLOR.text :
     COLOR.dim` fallback so an unselected binding cell's key reads in `menuIdle`; leave the `capturing ?
     COLOR.garbage` path). **Leave L5243** (Difficulty toggle inactive-side — a state indicator, stays `COLOR.dim`).
     **Do NOT touch L5424** (initials entry — gameplay text) or **L5745** (HUD chain count — not a menu).
   - **Explicitly leave dim:** the `drawControlsMenu` column headers ACTION/KEYBOARD/GAMEPAD (L5261–5263, table
     headers per FLAG-2a), all ◄►/`|` glyphs, slider frames.

**§2.2 — `drawMenuHint` helper + route the footers.**
3. Add a helper near `drawText`: `function drawMenuHint(text, cx, y) { drawText(text, cx, y, MENU_HINT_SIZE,
   COLOR.menuIdle, "center"); }` with a `const MENU_HINT_SIZE = 16;` playtest-knob by the menu-render constants.
   *(FLAG-2b look-call: 15 vs 16, and menuIdle-reuse vs a distinct `COLOR.hint` — best-guess reuse `menuIdle`
   at 16.)*
4. Route the per-screen control-hint footers through it (drop the literal size-12/`COLOR.dim`):
   **L5170** `drawRootMenu` · **L5183** `drawOptionsMenu` · **L5220** `drawSound` · **L5255** `drawDifficulty`
   hint · **L5280** `drawControlsMenu`. Also the `drawDifficulty` **per-row help line L5254** — bump to the same
   size/colour (best-guess: route it through `drawMenuHint` too; it's the same dim/small secondary text §2.2
   targets). *(The Achievements footer L5355 is handled in P3 via the same helper — FLAG-2e.)*
5. **Fit-check per panel (FLAG-2b).** Footers sit well below the last row (`y+272` in the 300-tall root, `y+582`
   in the 602-tall Sound panel, etc.), so 12→16 should fit — but confirm none crowds the last row / Back; if a
   panel is tight, grow its height a few px (one-line tunable).

**Test — `scratchpad/test-cs013-p2.js`** (drive the REAL draws via a recording-canvas stub that logs `fillText`
calls with their size + `fillStyle` — mirror `test-cs012-p2.js`'s canvas-recording idiom):
- `COLOR.menuIdle` exists and differs from both `COLOR.dim` and `COLOR.text`.
- For each menu screen, render with a known cursor: the **unselected** item labels draw in `COLOR.menuIdle`
  (not `COLOR.dim`), the **selected** row still `COLOR.text`; the toggle inactive-side (L5243) and glyphs stay
  `COLOR.dim`; column headers stay `COLOR.dim`.
- Every control-hint footer draws at `MENU_HINT_SIZE` in `COLOR.menuIdle` (assert the size + colour off the log).
- Bind-cell (L5313): unselected → `menuIdle`, capturing → `COLOR.garbage` (unchanged).
- `AudioSys.ctx` null → `startGame()`/`update(1/60)` no-crash; every menu screen renders without throwing.

**Pre-existing tests to update:** likely none behavioural — grep `scratchpad/` for any test asserting a menu
label's colour is `COLOR.dim` (rare; most menu tests assert nav/shape). Fix only genuine colour-pins.

**Docs (edit in place):** GDD **§2.16** (note the readability pass — unselected menu text = `COLOR.menuIdle`,
hints via `drawMenuHint` at size 16; the `menuPanel` opacity bullet L344 is a good neighbour); Architecture Map
**Helpers/COLOR** row (add `menuIdle`) and **draw()** row (add `drawMenuHint`); GDD **§3.2** no-fills rule —
**no change** (menuIdle is a colour; `drawMenuHint` is `drawText`; no new fill). **STATUS.md.** No version bump.

**Model / effort / thinking:** **Sonnet 5 · effort `high`.** Mechanical, low-risk; no `ultrathink` needed.

**Suggested commit message:**
`CS013 P2: readability — new COLOR.menuIdle for unselected menu text + a drawMenuHint helper (larger, higher-contrast footers) [§2.1/§2.2]`

**Paste-ready Claude Code prompt:**
> Implement CS013 Phase 2 (Group B, §2.1 + §2.2) — the menu readability sweep. Read `STATUS.md` first.
> **Re-grep every anchor first** (`? COLOR.text : COLOR.dim` and each footer literal). This ships **after P1**,
> so the sweep covers P1's gameover-root rows too.
>
> **§2.1:** add `menuIdle: "#6f92bd",` to the `COLOR` block (L2728) — a best-guess shade, tune by eye; it must
> read clearly on the near-black panel yet stay dimmer than `#a8d4ff`. **Do not touch `COLOR.dim`** (HUD tracks/
> chevrons/table headers/glyphs depend on it). Swap the **non-selected menu-item** `COLOR.dim` → `COLOR.menuIdle`
> at: L5168, L5181, L5196, L5204, L5212, L5219, L5239, L5253, L5267, L5278, L5279, L5289, L5302, **and L5313**
> (`drawBindCell` unselected fallback only — leave the `capturing` path). **Leave L5243** (Difficulty toggle
> inactive-side — a state indicator), **L5424** (initials entry), **L5745** (HUD), and the ACTION/KEYBOARD/
> GAMEPAD column headers (L5261–5263) all as `COLOR.dim`; leave all ◄►/`|` glyphs + slider frames dim.
>
> **§2.2:** add `const MENU_HINT_SIZE = 16;` (playtest knob) and `function drawMenuHint(text, cx, y)` near
> `drawText`, drawing at `MENU_HINT_SIZE` in `COLOR.menuIdle`, centered. Route the control-hint footers through
> it: L5170, L5183, L5220, L5255, L5280 — and bump the `drawDifficulty` per-row help line L5254 to the same
> treatment. **Fit-check each panel** (footer must not crowd the last row/Back; grow a panel height a few px if
> tight — one-liner).
>
> Ship `scratchpad/test-cs013-p2.js` (recording-canvas stub logging fillText size+colour, `test-cs012-p2.js`
> idiom): `menuIdle` distinct from dim/text; unselected labels → `menuIdle`, selected → `text`, toggle-inactive/
> headers/glyphs stay dim; every footer at size 16 `menuIdle`; bind-cell unselected → menuIdle, capturing →
> garbage; no-crash headless. Grep `scratchpad/` for colour-pins and update only genuine ones. Full regression +
> `node --check`.
>
> Docs in place: GDD §2.16 (readability pass), Architecture Map COLOR + draw() rows, STATUS.md. §3.2 no-fills
> unchanged. **No version bump.** Commit on `main` with the message above. **Do not push.**

---

# Phase P3 — Achievements viewer: ×1.5 + contrast + clipped scroll (Group B, §2.3)

**Goal.** Make the Achievements screen legible: scale text ×1.5, lift the worst-contrast text to `COLOR.menuIdle`,
and add a **clipped vertical scroll** so the ×1.5 rows that overflow the panel are reachable. **This carries the
only new machinery in CS013** (a scroll offset + clip region). Depends on P2 (reuses `COLOR.menuIdle`).

**The overflow is real (why scroll, not just a bigger panel).** At ×1.5, `step` 40→60; the 10 lifetime rows put
the last name at `ry0 + 9·60 = y+670`, past the 660-tall panel bottom and the footer — and the panel can't grow
enough on a 720-tall viewport (already 660 → ~700 max buys ~1 row, not the ~3 needed). Confirmed: `LIFETIME.length
= 20` → 10 rows per lifetime column.

**Exact work:**

**§2.3.1 — ×1.5 sizing** (in `drawAchievements` L5340–5356 and `drawAchRow` L5364–5377). Best-guess: introduce a
`const ACH_SCALE = 1.5;` (playtest knob) and multiply, rather than hardcoding scaled literals, so it stays a knob:
- `drawAchRow` name 15→`15*ACH_SCALE`, tier-status 13→`13*ACH_SCALE`, single progress 14→`14*ACH_SCALE`, desc
  10→`10*ACH_SCALE`, and the intra-row description offset **`ry+15` → `ry + 22`** (≈`15*ACH_SCALE`).
- `drawAchievements` column headers 15→`15*ACH_SCALE`, subtitle 12→`12*ACH_SCALE`, footer 12→`12*ACH_SCALE`
  (or route the footer through `drawMenuHint` per FLAG-2e), and **`step` 40 → 60** (`40*ACH_SCALE`).
- Fit-check the header/subtitle baselines (`y+74`, `y+108`) don't collide after the size bump; nudge if needed.

**§2.3.2 — contrast (uses P2's `COLOR.menuIdle`).**
- `drawAchRow` description (`… size 10, COLOR.dim` at L5370 tiered / L5376 single) → `COLOR.menuIdle`.
- Locked/incomplete progress readout `COLOR.dim` (L5369 tiered when `idx<0`; L5375 single when not done) →
  `COLOR.menuIdle`. **Unlocked stays `COLOR.ach` gold; tier tints unchanged.**

**§2.3.3 — clipped vertical scroll (the new machinery).**
- **State:** add `game.menu.scroll = 0` to the `game.menu` literal, and **reset it in `gotoScreen` (L2317)**
  (`game.menu.scroll = 0;` beside the index/row/col resets) so every screen entry — including re-entering
  Achievements — starts unscrolled. Runtime only; never persisted.
- **Input (FLAG-2c → continuous scroll):** `menuAchievements(a)` (L2424) gains `up`/`down` (currently free):
  `else if (a === "down") { game.menu.scroll = Math.min(maxScroll, game.menu.scroll + ACH_SCROLL_STEP); }` and
  the `up` mirror clamped to 0. `const ACH_SCROLL_STEP = 60;` (≈ one row; playtest knob — smooth vs per-row is
  a look-call). Keyboard up/down **and** pad d-pad/L-stick already normalize to `"up"/"down"` through
  `menuInput`, so this covers both inputs uniformly.
- **maxScroll:** compute from content height vs the visible row region. The tallest column is 10 lifetime rows:
  `contentH = (perColumnRows - 1) * step + descBlock`; `maxScroll = Math.max(0, contentH - visibleRegionH)`
  where `visibleRegionH` is the clipped interior between the header baseline and the footer. Derive it, don't
  hardcode (LIFETIME could grow again). `menuAchievements` reads the same `maxScroll` its clamp uses.
- **Clip + offset (no fill — `clip()` is not a fill, so §3.2 gains no exception):** wrap **only the three row
  columns** in `ctx.save(); ctx.beginPath(); ctx.rect(panelInteriorLeft, headerBottom, panelInteriorW,
  visibleRegionH); ctx.clip();` then draw each `drawAchRow` at `ry0 + row*step - game.menu.scroll`, then
  `ctx.restore()`. The panel frame, backdrop, headers, subtitle and footer draw **outside** the clip (they
  don't scroll). Rows that scroll past the top/bottom are clipped, not spilling under the header/footer.
- **Affordance (when `maxScroll > 0`):** a `▲`/`▼` "more" cue — best-guess a small `drawText("▼", …)` at the
  interior bottom (and `▲` at top when `scroll > 0`), in `COLOR.menuIdle`. *(A scrollbar tick is fine as a menu
  rect if preferred — menu rects are exempt from the HUD no-fills rule — but the text cue is simplest.)*

**FLAG-2d (column width at ×1.5) — best-guess KEEP 3 columns + scroll.** `colW=350` is marginal for ×1.5
descriptions (~48-char line ≈ 336px — right at the edge); let over-long descriptions clip/wrap as a look-call.
**Fallback (Paul's call only if it reads badly):** drop LIFETIME to a single wider column (2 columns total),
which the scroll already accommodates. Do **not** pre-build the fallback — ship the 3-column version.

**Test — `scratchpad/test-cs013-p3.js`** (drive the REAL `drawAchievements`/`drawAchRow`/`menuAchievements` via
a recording-canvas stub that logs `fillText` (text/x/y/size/colour) and `save`/`rect`/`clip`/`restore`; mirror
`test-cs012-p2.js`/`test-cs012-p5.js`):
- Sizes: every logged achievement `fillText` size == the pre-P3 size × `ACH_SCALE`; `step` spacing between
  consecutive rows == 60; the description sits at `ry + 22` under its name.
- Contrast: description and locked/incomplete-progress draws use `COLOR.menuIdle`; unlocked uses `COLOR.ach`;
  tier tints unchanged.
- Clip: a `save → rect → clip → …rows… → restore` bracket surrounds the row draws; the panel frame/headers/
  footer draw **outside** it (assert order off the log).
- Scroll: with a full 20-entry LIFETIME, `maxScroll > 0`; `menuAchievements("down")` increases `game.menu.scroll`
  and clamps at `maxScroll`; `"up"` decreases and clamps at 0; the ▲/▼ cue is logged when `maxScroll > 0` and
  absent when 0 (e.g. force a short LIFETIME). Entering via `gotoScreen("achievements", …)` resets `scroll` to 0.
- `AudioSys.ctx` null → `startGame()`/`update(1/60)` + open/scroll/close cycle no-crash.

**Pre-existing tests to update:** grep `scratchpad/` for tests asserting achievements-render geometry or
`drawAchRow` sizes/positions (`test-f9.js` is the achievements test — it pins `LIFETIME.length`, which is
**unchanged at 20**, so likely fine; verify it doesn't pin row Y/size). Update any that legitimately shift.

**Docs (edit in place):** GDD **§2.17** (viewer now ×1.5 with `COLOR.menuIdle` contrast + continuous clipped
vertical scroll driven by up/down; note the 3-column-keep with the 2-column fallback flagged); Architecture Map
**draw()** row (`drawAchievements` clip+scroll) and the **game object** row (`game.menu.scroll` runtime field);
GDD **§3.2** no-fills — **note `clip()` adds no exception**. **STATUS.md.** No version bump.

**Model / effort / thinking:** **Sonnet 5 · effort `high`**, with **`ultrathink`** on the scroll math
(maxScroll derivation + clamp + clip region — the one non-mechanical bit). Step up to **Opus 4.8 `high`** if you'd
rather the new-machinery phase run on the stronger model.

**Suggested commit message:**
`CS013 P3: Achievements viewer at 1.5× with COLOR.menuIdle contrast + clipped continuous vertical scroll [§2.3]`

**Paste-ready Claude Code prompt:**
> Implement CS013 Phase 3 (Group B, §2.3) — the Achievements viewer readability + scroll. Read `STATUS.md` first.
> **Re-grep first:** `drawAchievements` L5340 (`menuPanel(1200,660)` L5343, `colW/ry0/step` L5345, headers
> L5346–5348, `half` L5350, footer L5355), `drawAchRow` L5364–5377, `menuAchievements` L2424, `gotoScreen`
> L2317. This ships **after P2** and reuses `COLOR.menuIdle`. `ultrathink` the scroll math (maxScroll + clamp +
> clip region).
>
> **Sizing:** add `const ACH_SCALE = 1.5;` (knob) and multiply every achievement text size by it (name 15,
> tier-status 13, progress 14, desc 10, headers 15, subtitle 12, footer 12), set `step` 40→60 (`40*ACH_SCALE`),
> and the description offset `ry+15` → `ry+22`. Fit-check the header/subtitle baselines don't collide.
> **Contrast:** description (L5370/L5376) and locked/incomplete progress (L5369 when `idx<0` / L5375 when not
> done) → `COLOR.menuIdle`; unlocked stays `COLOR.ach`; tier tints unchanged.
> **Scroll (new machinery, no fills — `clip()` isn't a fill):** add `game.menu.scroll = 0` to the `game.menu`
> literal and reset it in `gotoScreen` beside index/row/col. Add `const ACH_SCROLL_STEP = 60;`. `menuAchievements`
> gains `up`/`down` adjusting `game.menu.scroll`, clamped `[0, maxScroll]` — derive `maxScroll` from the 10-row
> lifetime column height vs the clipped visible region (don't hardcode; LIFETIME may grow). Wrap **only the three
> row columns** in `ctx.save()/beginPath()/rect(interior)/clip()/…rows at ry0 + row*step - game.menu.scroll/
> restore()`; draw the panel/headers/subtitle/footer outside the clip. Show a `▲`/`▼` `COLOR.menuIdle` cue when
> `maxScroll > 0` (▲ only when scrolled). **Keep 3 columns + scroll (FLAG-2d);** let long descriptions clip —
> do not build the 2-column fallback.
>
> Ship `scratchpad/test-cs013-p3.js` (recording-canvas stub logging fillText text/x/y/size/colour +
> save/rect/clip/restore): sizes == pre-P3 × `ACH_SCALE`; step 60; desc at ry+22; desc & locked-progress in
> `menuIdle`, unlocked in `ach`; clip brackets the rows with panel/headers/footer outside; full 20-entry
> LIFETIME → `maxScroll>0`, down/up clamp at maxScroll/0, ▲/▼ cue present/absent by maxScroll; `gotoScreen`
> resets scroll; no-crash headless. Update any achievements-geometry pins in `scratchpad/` (`test-f9.js` pins
> LIFETIME.length=20, unchanged — verify it doesn't pin row Y/size). Full regression + `node --check`.
>
> Docs in place: GDD §2.17 (×1.5 + menuIdle contrast + clipped scroll; 3-col keep, 2-col fallback flagged),
> Architecture Map draw() + game-object rows, §3.2 (clip adds no fill exception), STATUS.md. **No version bump.**
> Commit on `main` with the message above. **Do not push.** If the 3-column ×1.5 layout reads badly, note it in
> STATUS.md for Paul (the 2-column fallback is his call) — don't switch it yourself.

---

# Phase P4 — Auto-shield regen pause (Group C, §3)  ·  **version bump lives here**

**Goal.** Remove the "never dies" degenerate case from the opt-in auto-shield by **pausing passive energy regen
for a short window after each auto-save**, so consecutive saves net the full `−0.22` (no `+0.12` recharge
sneaking in during the i-frame) — roughly halving back-to-back saves (~8 → ~4) and letting the pool drain to 0
under sustained fire. Independent of Groups A/B. Paul's proposed mechanism ("try 1 second and playtest").

**The math (why it's overpowered today).** The i-frame rate-limits saves to ~1/`HIT_STUN_DURATION`; during that
i-frame the shield is off, so energy recharges `+0.12`. Net per save-cycle: `−0.22 + 0.12 = −0.10` → ~8 saves
from a full pool. Pausing regen across the protected window makes each cycle net `−0.22` → ~4 saves, and under
sustained fire (each hit re-arming the lock) the pool drains monotonically.

**Exact work (1 constant + 1 field + 3 tiny edits):**
1. **Constant:** `const AUTO_SHIELD_REGEN_PAUSE = 1.0; // sec — passive regen freezes this long after an
   auto-save. PLAYTEST KNOB (≥ HIT_STUN_DURATION guarantees no recharge between i-frame end and next hit).`
   Place with the `SHIELD_*`/`AUTO_SHIELD_*` constants (by L128–131).
2. **Runtime field:** add `this.autoShieldRegenLock = 0;` to the ship init beside `this.shieldOn`/`this.energy`
   (L2781–2782). Runtime only — no persistence, no `afd_settings_v1` change.
3. **Arm it (auto-shield branch, beside `s.invuln = HIT_STUN_DURATION;` at L4275):** add
   `s.autoShieldRegenLock = AUTO_SHIELD_REGEN_PAUSE;`.
4. **Tick it (FLAG-3c — alongside the invuln countdown, L2852):** add
   `if (s.autoShieldRegenLock > 0) s.autoShieldRegenLock -= dt;` right after `if (this.invuln > 0) this.invuln
   -= dt;` (use the correct receiver — it's `this` in `Ship.update`). Ticks every frame regardless of shield
   state.
5. **Gate the passive recharge (the ONLY recharge site, L2821):** the `else`-branch line
   `this.energy = Math.min(1, this.energy + SHIELD_RECHARGE * dt);` → run it **only when the lock has elapsed**:
   `if (this.autoShieldRegenLock <= 0) this.energy = Math.min(1, this.energy + SHIELD_RECHARGE * dt);`
   (keep `this.shieldOn = false;` unconditional). **FLAG-3b: gate ONLY this passive `else`-branch** — manual
   shield play (the `if` drain branch, L2815–2818) is untouched, and the player can still raise the shield
   manually if they have energy; the lock only withholds *passive refill*.

**FLAG-3a (duration).** `1.0` (== the i-frame) is the requested floor; `~1.1–1.2` is the belt-and-braces value
if playtest still shows survivability. Knob — ship 1.0.

**Version bump (this phase is the sequence's last, so it hosts the changeset digit):**
6. `GAME_VERSION` `"1.0.0.12"` → `"1.0.0.13"` (L242).
7. **Update every pinned literal in `scratchpad/`:** `grep -rn "1.0.0.12" scratchpad/` and bump each (STATUS
   confirms `test-cs010-p0.js` pins it — grep-driven so you catch any others too). Don't assume it's only one
   file.

**Test — `scratchpad/test-cs013-p4.js`** (drive the REAL `damageShip` + `Ship.update` — extend
`test-cs012-p5.js`'s idiom; no reimplementation of the energy math):
- **Lock arms:** a real auto-save sets `s.autoShieldRegenLock === AUTO_SHIELD_REGEN_PAUSE`.
- **Regen frozen while locked:** with the lock > 0 and the shield off, an `update(1/60)` frame leaves
  `s.energy` unchanged (no `+SHIELD_RECHARGE*dt`); after the lock decrements past 0, a subsequent frame *does*
  recharge (`+SHIELD_RECHARGE*dt`, clamped ≤ 1).
- **Lock decrements** by `dt` each frame (alongside `invuln`), independent of shield state.
- **Consecutive-save count roughly halves:** driving repeated hits at the i-frame cadence, the pool now nets
  `−0.22`/cycle (assert ~4 saves from full vs the pre-P4 ~8) and drains to 0 under sustained fire.
- **Manual shield untouched (FLAG-3b):** holding the shield (the `if` branch) still drains normally; raising the
  shield manually with energy still works while the lock is set (the lock gates only passive refill).
- `AudioSys.ctx` null → `startGame()`/`update(1/60)` no-crash. Plus a `GAME_VERSION === "1.0.0.13"` pin check.

**Pre-existing tests to update (expected fallout):** **`test-cs012-p5.js`** asserts the auto-shield **energy
self-limit** under the *old* `−0.10`/cycle net (the ~4–5-then-exhausts figure includes the `+0.12` recharge).
With regen paused, the per-save net is `−0.22` and back-to-back saves drop to ~4 — update that section's
expected count/drain to the new (faster) exhaustion. Also update `test-cs010-p0.js` (and any other) `GAME_VERSION`
pin to `"1.0.0.13"`.

**Docs (edit in place):** GDD **§2.3** (extend the auto-shield bullet: after a save, passive regen pauses for
`AUTO_SHIELD_REGEN_PAUSE` so the net per save-cycle is `−0.22` and the pool drains under sustained fire — a
lull still lets it recover); Architecture Map **Flow functions** row (`damageShip` arms `autoShieldRegenLock`)
and **Ship**/Constants (the field + the constant, `Ship.update` gates the passive recharge on it); GDD top-of-
file **Current build** line (L3) → **CS013 P4 / `"1.0.0.13"`**; **`GDD-VERSION-HISTORY.md`** — append the
consolidated **CS013 (P1–P4)** entry (this is the round's last phase, per the CS012 P5 precedent of one
consolidated changeset entry on the final phase); **STATUS.md** (CS013 P4 + round-complete recap).

**Model / effort / thinking:** **Sonnet 5 · effort `high`.** Surgical (1 constant + 1 field + 3 tiny edits + the
bump); no `ultrathink` needed.

**Suggested commit message:**
`CS013 P4: auto-shield regen pause (AUTO_SHIELD_REGEN_PAUSE) — nets −0.22/save so the safety net drains under fire; bump GAME_VERSION 1.0.0.13 [§3]`

**Paste-ready Claude Code prompt:**
> Implement CS013 Phase 4 (Group C, §3) — the auto-shield regen pause, **and the CS013 version bump** (this is
> the last phase). Read `STATUS.md` first. **Re-grep first:** `SHIELD_*`/`AUTO_SHIELD_*` constants L128–131,
> ship init `this.shieldOn`/`this.energy` L2781–2782, the passive recharge `else`-branch L2819–2821 (the **only**
> recharge site — confirm by grepping `SHIELD_RECHARGE`), the `invuln` decrement L2852, the auto-shield branch
> L4266–4281 (`s.invuln = HIT_STUN_DURATION;` L4275), `GAME_VERSION` L242.
>
> Edits: **(1)** add `const AUTO_SHIELD_REGEN_PAUSE = 1.0;` (playtest knob, comment: ≥ HIT_STUN_DURATION blocks
> any between-i-frame recharge) by the SHIELD_* constants. **(2)** add `this.autoShieldRegenLock = 0;` to the
> ship init (L2781–2782) — runtime field, **no persistence**. **(3)** in the auto-shield branch, beside
> `s.invuln = HIT_STUN_DURATION;`, add `s.autoShieldRegenLock = AUTO_SHIELD_REGEN_PAUSE;`. **(4)** beside the
> invuln countdown (L2852) add `if (this.autoShieldRegenLock > 0) this.autoShieldRegenLock -= dt;`. **(5)** gate
> the passive recharge (L2821): run it **only when `this.autoShieldRegenLock <= 0`**, keeping `this.shieldOn =
> false;` unconditional. **Gate ONLY the passive `else`-branch (FLAG-3b)** — leave the manual-shield drain branch
> (L2815–2818) alone; the player can still raise the shield manually. **(6)** bump `GAME_VERSION`
> `"1.0.0.12"` → `"1.0.0.13"`. **(7)** `grep -rn "1.0.0.12" scratchpad/` and update every pinned literal (at
> least `test-cs010-p0.js`).
>
> Ship `scratchpad/test-cs013-p4.js` (extend `test-cs012-p5.js`; drive the REAL `damageShip`/`Ship.update`, no
> energy-math reimplementation): lock arms on a save; regen frozen while locked, resumes after it elapses; lock
> decrements each frame; consecutive saves ~halve (net −0.22/cycle, drains to 0 under fire); manual shield
> untouched; `GAME_VERSION === "1.0.0.13"`; no-crash headless. **Update `test-cs012-p5.js`'s energy-self-limit
> section** to the new faster exhaustion, and every `GAME_VERSION` pin to `"1.0.0.13"`. Full regression +
> `node --check`.
>
> Docs in place: GDD §2.3 (regen-pause extension), Architecture Map Flow/Ship/Constants rows, top-of-file
> Current-build → CS013 P4 / "1.0.0.13", append the consolidated CS013 entry to `GDD-VERSION-HISTORY.md`,
> STATUS.md (round complete). Commit on `main` with the message above. **Do not push.**

---

## Decision roundup (all locked; nothing blocking)

1. **FORK-CS013-A → (a)** — gameover gets its own context-aware root `["Play Again","Options","Quit to Title"]`
   (P1). Built to the resolved fork; not re-opened.
2. **Everything else is TWEAK**, built to the inline FLAGs: §2.1 new `COLOR.menuIdle` (don't mutate `COLOR.dim`),
   §2.2 `drawMenuHint` at size 16, §2.3 ×1.5 + `menuIdle` contrast + clipped continuous scroll (3-column keep,
   2-column fallback flagged), §3 `AUTO_SHIELD_REGEN_PAUSE = 1.0` gating the single L2821 recharge site.
3. **Sequencing:** A (P1) → B (P2 palette/helper, P3 achievements) → C (P4, independent, hosts the bump).

**New findings surfaced this planning pass (best-guessed, override-able — not blocking):**
- **FINDING-A (P1):** the bare-gameover on-screen hint text goes stale under (a); updated to `"MENU: O
  (controller: B)"` — wording is a look-call.
- **FINDING-C (P2):** two `? COLOR.text : COLOR.dim` sites the spec's list didn't enumerate — L5243 left dim
  (state indicator), L5313 (`drawBindCell`) best-guess brightened to `menuIdle`; L5424/L5745 excluded.
- **FINDING-D (harmless anchor drift):** the spec's Achievements `menuPanel` "L103" is really L5343; a handful
  of §1 pad/hint anchors drifted 1–2 lines. Corrected inline; no action.

**Remaining FLAGs (1a–1b, 2a–2e, 3a–3c)** are look-calls / guards / tuning knobs — safe to best-guess in-build,
none blocking. Playtest confirmations Paul may want after the build: the `menuIdle` shade + hint size (P2), the
×1.5 3-column readability and scroll step (P3), and `AUTO_SHIELD_REGEN_PAUSE` at 1.0 vs 1.1–1.2 (P4).