# PLANNED-FEATURES-CS030 — Achievement Celebration Panel

**Baseline (verified by fresh clone, this session):**
`git clone --depth 1 https://github.com/freakingid/ADD-Orbital-Overhaul` →
`8e08221 cs-29 p5: closing phase — gate answers applied, version 1.0.0.29, doc sweep`

- Game file: `orbital-overhaul.html`, 10,102 lines. Version string `1.0.0.29`.
- `STATUS.md` header: Registry **85**, `LEVERS` **18**, CS029 **closed**, nothing in flight.
- No `PLANNED-FEATURES-CS0##.md` / `IMPLEMENTATION-PHASES-CS0##.md` at root — CS029's pair is in
  `archive/`. CS030 is genuinely next.
- `tools/` now holds six labs: `dock-float-lab.html`, `music-lab.html`, `sat-art-lab.html`,
  `scoop-lab.html`, `voice-lab.html`, `voice-robot-lab.html`.

⚠ Every line number below is an **estimate from this session's clone**. Re-grep by symbol name
before editing. Line numbers drift.

**All design forks are resolved (Paul, this session). §3 records the Q&A. This is a build-ready
spec — no blocking forks remain. FORK-CS030-F (fanfare timing) is deliberately left open as a P6
gate question, not a blocking fork; it's a playtest knob, not an architecture decision.**

---

## §0 CORRECTIONS — things prior planning got wrong

### §0.1 ⛔ THE BIG ONE: the wave-clear window is **not a pause**. There is no level-end transition point.

`archive/PLANNED-FEATURES-CS029.md` §10 previewed CS030 as:

> `Achievements.onUnlock()` (~L7011) is a single choke point, and the 2.5s `waveClearTimer` window
> (~L8726) is the natural place to hang the panel.

The first half is correct. The second half is wrong. Grepped (`update()`, ~L8787):

```js
if (game.debris.length === 0) {
  game.waveClearTimer += dt;
  if (game.waveClearTimer > 2.5) {
    game.waveClearTimer = 0;
    if (game.stats.dmgThisWave === 0) { /* perfectWaves++, noScratchWave3, flawlessLateWave */ }
    nextWave();
  }
} else {
  game.waveClearTimer = 0;
}
```

That block sits in the middle of `update()`'s **live playing body**. For those 2.5 seconds the ship
still flies, **Hunters and loose garbage are still live and hunting** (CS015 P3, deliberate: wave
clear triggers on debris-empty alone; `nextWave()` clears nothing), saucers can be on screen and
shooting, and collision/coalescence/the dock all keep running. `nextWave()` is called **inline**, and
the next level begins the very next frame.

**Resolved (Paul, FORK-CS030-A = a — both):** the level-end panel is knowingly built as a genuinely
new pause of live gameplay, not the reuse of an existing one. P5 freezes the field on entry and the
gate (P6, G7/G8) specifically tests the resume.

### §0.2 Line-number drift in the §10 preview

| Symbol | §10 said | Actual (this clone) |
|---|---|---|
| `Achievements.onUnlock` | ~L7011 | **L7050** |
| wave-clear `waveClearTimer` block | ~L8726 | **L8787** |

### §0.3 A second unlock site the preview didn't name

`Achievements.evaluate()` has **two** callers:

- **L8810** — every frame in `update()`'s playing body.
- **L7318** — a one-shot final flush inside `killShip()`, after `game.stats.gameEnded = true`.

The `killShip()` flush fires at the *start* of the `"dying"` spectacle. `updateDeath()` never calls
`evaluate()`. By the `"dying"` → `"gameover"` seam, the run's unlock bucket is already complete.

### §0.4 Frame-ordering fact that constrains the collector's shape

In the wave-clear frame: `perfectWaves++` → `nextWave()` (does `game.wave++`) →
`Achievements.evaluate()` at L8810. **`evaluate()` runs after the wave counter has already
advanced.** A Perfect Wave earned clearing wave 7 evaluates while `game.wave === 8`.

⛔ **The collector is a flushed bucket, never filtered by `game.wave`.**

---

## §1 What ships

A **celebration panel**, overlaid on top of whatever screen it sits over, presenting the
achievements earned since the last flush: name, tier badge, full description, and an emblem.

**In scope:** the unlock collector; an 8-emblem tiered/pool art table + lab; the panel (draw, state,
scroll, input); a game-over overlay in front of the CS029 P2 screen; a level-end overlay that defers
`nextWave()`.

**Out, explicitly:** what the 36 achievements *are* or how they unlock; per-badge illustration
(settled prior to this changeset — tiered emblems, not 36 drawings); Dan voice lines for the panel;
music for the panel; profiles / save-load / leaderboards (CS031–033).

---

## §2 The existing machinery, grepped

### §2.1 The unlock choke point (L7050)

```js
onUnlock(ach, tierIdx) {
  const label = (tierIdx === undefined) ? ach.name : ach.name + " — " + TIER_NAMES[tierIdx];
  game.toasts.push({ name: label, life: ACH_TOAST_TIME });
  AudioSys.achievement();
  this.save();
}
```

One function, every unlock path routes through it. ⚠ `deriveLifetime()` deliberately does **not**
call it (the silent post-load catch-up) — the collector must not touch that function.

### §2.2 The achievement pool — 36 total, two shapes

- `WEEKLY` — 16 entries, 5 active per ISO week, all single-goal, **no tiers**.
- `LIFETIME` — 20 entries: **14 tiered** (6-rung ladders), **6 non-tiered** single-goal.

Every entry already carries a `desc` string. The panel reads `ach.desc` — no new copy needed.

`TIER_NAMES` / `TIER_COLOR` at L4804–4805 (6 rungs, Bronze `#c8823c` → Diamond `#ffffff`).
`COLOR.ach` = `#ffcf5a` (L4797).

### §2.3 The vector-art idiom the emblems must follow (L4985–5028)

`SAT_ART` / `SAT_SCRAP` establish the format: unit space (every point inside the radius-1 circle,
scales by `* r`), `{ pts, closed }` polylines through `drawPoly()` (L4733), no fills, no external
assets, composed in a standalone lab and pasted in verbatim.

⚠ `tools/sat-art-lab.html` was built *after* `SAT_ART` shipped, so that table was briefly its own
source of truth. `tools/emblem-lab.html` ships **first** this time, avoiding the gap.

### §2.4 The game-over screen as CS029 P2 left it (draw, L9692) — CONFIRMED: stays untouched

```js
if (game.state === "gameover") {
  drawText("GAME OVER", VIEW_W/2, VIEW_H/2 - 20, 56);
  drawText("FINAL SCORE  " + game.score, VIEW_W/2, VIEW_H/2 + 36, 26);
  if (game.entry) drawEntrySlots(VIEW_H/2 + 110);
  else {
    drawScoreTable(VIEW_W/2, VIEW_H/2 + 60, game.lastScoreId);
    drawMenuHint(GAMEOVER_HINT, VIEW_W/2, GAMEOVER_HINT_Y, GAMEOVER_HINT_SIZE);
  }
}
```

`drawScoreTable` (L9427) documents itself as already tight against the `GAMEOVER_HINT` footer — this
screen has no spare space. **Resolved (FORK-CS030-B = b — overlay):** this block is never gated, never
early-returned, never touched. See §2.5.

### §2.5 The overlay precedent already shipping — `drawMenu()` over game-over (L9708–9709)

```js
if (game.paused) drawMenu(); // pause modal / system menu / options / controls
drawToasts();
```

This is the *exact* pattern FORK-CS030-B resolved to: `drawMenu()` draws its own opaque `menuPanel()`
chrome **after** the gameover block, on top of it, without the gameover block knowing or caring.
The celebration panel follows the same shape — its own `menuPanel()`-style box, drawn after whatever
state it sits over, in the same slot in `draw()`. No gating logic needed on the screen underneath, at
game-over or (see §4.4) at level-end.

### §2.6 The Achievements viewer's scroll idiom — reused as a PATTERN, not as STATE

Grepped this session (`drawAchievements()`, `menuAchievements()`, L9219–9420, L4141–4155):

- Content height derived from row count: `achMaxScroll() = max(0, contentH - ACH_ROW_VISIBLE_H)`.
- Render clamps: `game.menu.scroll = Math.max(0, Math.min(maxScroll, game.menu.scroll))`.
- A clip region — `ctx.rect(x, ACH_ROW_CLIP_TOP, w, ACH_ROW_VISIBLE_H); ctx.clip();` — so scrolled
  rows can never spill past the panel. Rows draw inside the clip; the clip is `ctx.restore()`d before
  anything else.
- **Scroll affordance drawn OUTSIDE the clip**, shown only when there's something to scroll: `▲` iff
  `scroll > 0`, `▼` iff `scroll < maxScroll`.
- Input: up/down step `game.menu.scroll` by `ACH_SCROLL_STEP` (60px), clamped against the same
  `achMaxScroll()` the renderer uses — **one shared ceiling function**, so input and render can never
  disagree.
- Confirm/back **always exits**, regardless of scroll position. There is no "must scroll to the
  bottom before you can leave" gate anywhere in this codebase's menu idiom, and the panel matches it.

⛔ **`game.menu.scroll` itself is menu-scoped** — it's reset on `setAchTab()`, on every `gotoScreen()`
call (L3887/3898/3909). The celebration panel is not part of the menu system (no `game.menu.screen`,
no `menuActive()`), so it must **not** reuse this field — that would let an unrelated menu action reset
panel scroll, or vice versa. **The panel gets its own `scroll` field on `game.celebration`.** Reuse the
pattern (clip, shared max-scroll function, ▲/▼ cue, up/down step) — not the storage.

### §2.7 Where the panel draws, and the Capture rule

`draw()` (L9611) ends: gameover block → `if (game.paused) drawMenu();` → `drawToasts();`. The comment
above `drawHUD()` states the rule: menus, toasts, and the game-over text stay in `draw()`, outside
`drawHUD()`, so Capture's **H** toggle only ever hides the always-on overlay. **The celebration panel
draws in this same tail of `draw()`, outside `drawHUD()`. H must not hide it.**

### §2.8 Input-precedence idiom to copy (keydown, L2971)

```js
if (game.entry) {
  if (!e.repeat) { /* nav / confirm → entryInput(...) */ }
  return;
}
```

The panel's guard goes **immediately before** this block, same shape: intercept, handle, `return`.
Gamepad mirror at L3064 (`const onTitleOrOver = …`) needs the same gate.

---

## §3 Forks — RESOLVED (Paul, this session)

### FORK-CS030-A — where does the panel appear? → **(a) Both: level-end pause + game-over panel.**

Chosen with the level-end cost fully visible (§0.1): the panel genuinely pauses live gameplay at
level end, freezing a field that may still contain Hunters. P5 builds it; P6 gates G7/G8 specifically
test whether the resume is fair and whether the cadence earns the interruption. If the gate comes
back bad, P5 is a clean single-commit revert — P4 (game-over) stands alone.

### FORK-CS030-B — how does the game-over panel sit in front of CS029 P2? → **(b) Overlay.**

Not the modal-replace best guess — and simpler than it. Reuses the shipped `drawMenu()`-over-gameover
precedent (§2.5): the existing screen draws completely untouched; the panel draws after it, on top,
via its own `menuPanel()`-style backdrop. This **removes** the "retune CS029 P2's tight layout" risk
entirely — nothing about that screen is touched by this changeset.

### FORK-CS030-C — panel before or after initials entry? → **(a) Panel first.**

Delivered through **input priority, not draw order** (this is a change from the original framing, a
consequence of B resolving to overlay): `game.entry` is armed at the same `"dying"`→`"gameover"` seam
where `game.celebration` is set, so on the first game-over frame the entry slots may already be
rendering underneath the panel. That's fine — the panel's opaque backdrop covers them, and the
panel's input guard sits before `game.entry`'s (§2.8), so the player cannot interact with entry until
the panel is dismissed. Functionally "panel first," achieved without touching entry-arming logic.

### FORK-CS030-D — emblem for the 22 untiered achievements? → **(b) Two extras — 8 total.**

6 tier emblems (Bronze…Diamond) + 1 weekly + 1 untiered-lifetime. The six tier emblems must read as
one family with six rungs; the two pool emblems must be visually distinguishable from that family
(P6 gate G3/G4 test both).

### FORK-CS030-E — overflow handling? → **Scrollable, reusing the Achievements viewer's exact idiom (§2.6).**

Not paged — the "rows per page" question is moot; there is no page count to pick. State shape is
`game.celebration = { items: [...], scroll: 0 }`, not `{ items, page }`.

⚠ **Accepted, non-blocking tradeoff:** confirm/back dismisses the panel regardless of scroll
position, matching the existing Achievements-viewer convention — a player *can* dismiss without
having scrolled to see everything. The ▲/▼ affordance is the shipped mitigation for exactly this in
the Achievements viewer already; the panel inherits it unchanged. Not re-litigated.

### FORK-CS030-F — does the panel re-fire the fanfare? → **Open. P6 gate question (non-blocking).**

`AudioSys.achievement()` (L1446) already fired at unlock time. Options remain: once on panel open /
once per item scrolled into view / silent. This is a playtest knob, not an architecture decision —
answered at the gate (§ P6 in the implementation doc), not here.

---

## §4 Design

### §4.1 The collector — `game.pendingAch` + `game.celebration`

Declared in **both** the `game` object literal and `startGame()`'s reset (CS016 P3 rule):

- `game.pendingAch` — `[]`. Appended by `onUnlock()`: `{ id, name, desc, tierIdx, pool }`.
  `tierIdx` stays `undefined` for untiered unlocks — `onUnlock`'s existing signature semantics.
- `game.celebration` — `null`, or `{ items: [...], scroll: 0 }` while a panel is live. Presence
  intercepts input and adds a draw call; it is not part of the menu system.

⛔ Per §0.4, flushed, never filtered by `game.wave`.
⚠ **Not gated on `game.debugRun`.** `Achievements.save()` gates on it (a persistence point); this is
UI. A debug run must still show the panel, or it can never be tested. Don't copy that guard.

### §4.2 Emblems — `ACH_EMBLEM`, unit space, `drawPoly`, 8 designs

Per §3-D: 6 tier + weekly + untiered-lifetime. Same contract as `SAT_ART` (§2.3). Authored in
`tools/emblem-lab.html`, pasted in verbatim. Tier emblems draw in `TIER_COLOR[tierIdx]`; the two pool
emblems in `COLOR.ach`, but must be shaped distinctly enough from the tier family to read as their
own thing (gate-tested, not asserted).

### §4.3 The panel — overlay + scroll, not modal + pages

Draws via `menuPanel()`-style chrome, in the same tail of `draw()` as `drawMenu()` (§2.5/§2.7), after
whatever screen it sits over — that screen's own draw code is never touched. Content: one row per
item — `[emblem] [name + tier badge] / [desc]` — inside a clipped region sized like
`ACH_ROW_CLIP_TOP`/`ACH_ROW_VISIBLE_H`, scrolled by `game.celebration.scroll`, clamped against a
`celebrationMaxScroll()` shared by render and input (mirrors `achMaxScroll()`'s shared-ceiling
contract exactly). ▲/▼ affordance outside the clip, shown only when there's more to see. Confirm/back
dismisses unconditionally.

### §4.4 Integration points

**Game over** — at the `"dying"` → `"gameover"` seam, after `killShip()`'s final `evaluate()` flush
(§0.3), if `game.pendingAch.length`: set `game.celebration`, clear `game.pendingAch`. The gameover
draw block is untouched (§2.4); the panel overlays it (§2.5); input priority delivers "panel first"
(§3-C) without touching `game.entry`'s arming.

**Level end** — at the top of the `waveClearTimer > 2.5` branch, before `nextWave()`: if
`game.pendingAch.length`, set `game.celebration` and **return without calling `nextWave()`**.
Dismissal calls `nextWave()`. `update()`'s early-return must be extended so the field stays frozen
while `game.celebration` is set at level end — **without** setting `game.paused` (that would pull in
`menuActive()` and the whole menu chrome path, which this isn't). The panel overlays the live
(frozen) field, same shape as `drawMenu()` overlaying a paused game.

### §4.5 Knobs

Registry is **85** today — verify against the live build after P3, the prediction has historically
undercounted. New `DEBUG_VARS` rows:

- `celebrationScrollStep` — px per up/down press, default 60 (matches `ACH_SCROLL_STEP`, independently
  tunable since the panel's row height differs from the Achievements viewer's).
- `celebrationEmblemSize` — emblem radius px, default 32.

Both additive to `afd_settings_v1` under known-value-else-default. No schema bump, no key rename.

---

## §5 Risks

1. **Input interception missed on one of the two handlers**, or missed for the panel's own up/down
   scroll specifically (new surface area vs. the original page-based design). Keyboard and gamepad
   are separate functions (L2971, L3064); every input-touching phase tests both, including the
   scroll keys.
2. **Level-end resume into a live hostile field.** Accepted cost of FORK-A = (a). No code mitigation;
   the gate (G7/G8) is the check.
3. **Emblem legibility at 32px, across 8 designs now** — the six-tier family must read as a ladder
   *and* the two pool emblems must read as distinct from it. Measured in the lab (CS028 precedent:
   the per-craft small variant was deleted after measurement, not shipped on assumption).
4. **CS029 P2 regression — structurally avoided**, not just mitigated: FORK-B's overlay resolution
   means that screen's draw code is never touched by this changeset. P4 asserts this with a source
   diff, not just a behavioral test.
5. **Player dismisses without scrolling to see everything.** Accepted (§3-E), matches an existing
   shipped tradeoff in the Achievements viewer. Not a defect to fix in this changeset.
6. **Shallow-clone test skips.** Ten suite files still hard-fail on `--depth 1` (STATUS.md, carried
   from CS026). New CS030 pins must skip loudly; the closing phase asserts zero skips on a full clone.

---

## §6 Fork summary — all resolved

| Fork | Question | Resolution |
|---|---|---|
| **A** | Level-end + game-over, or game-over only? | **(a) Both** — level-end genuinely pauses; gated at P6 |
| **B** | Panel vs. CS029 P2 game-over screen | **(b) Overlay** — reuses the shipped `drawMenu()`-over-gameover precedent |
| **C** | Panel before or after initials entry | **(a) Before** — delivered via input priority, not draw order |
| **D** | Emblem for the 22 untiered achievements | **(b) 8 total** — 6 tier + weekly + untiered-lifetime |
| **E** | Overflow handling | **Scrollable** — reuses the Achievements viewer's clip/scroll idiom; own `scroll` field, not `game.menu.scroll` |
| **F** | Fanfare on panel open | **Open — P6 gate question**, not architecture |