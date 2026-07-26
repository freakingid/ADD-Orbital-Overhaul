# IMPLEMENTATION-PHASES-CS015.md

Build order for Change Set 15. Source of intent: `PLANNED-FEATURES-CS015.md`.
Ground-truth build at planning time: **CS013 P4, `GAME_VERSION` "1.0.0.13"**
(CS014 was built then reverted; its tag is kept, so CS015 is the next round and
the version target is **"1.0.0.15"** — .14 is deliberately skipped, not lost).

Every anchor below was grepped against the uploaded CS013 build. **Line numbers
are as-of-planning and will drift as phases land — re-grep by symbol every
session before editing (standing non-negotiable).** Each phase: read `STATUS.md`
first, re-grep its named anchors to confirm shipped behavior, build only that
phase, deliver a headless `scratchpad/test-cs015-p*.js` with the code, update the
docs in place, commit on `main`, do **not** push.

**How to use this doc.** Each phase ends with a **▶ Claude Code prompt** — a fenced
block you paste directly into a fresh Claude Code session (set the model/effort noted
on the block first). The prompt is self-contained: it tells Claude Code to read
`STATUS.md`, re-grep the anchors, make the change, write the test, update the docs,
and commit (without pushing) with the exact message. The prose above each prompt
(Goal / anchors / Change / Watch / Test) is the reasoning behind it — read it if you
want the why; paste the block to get the work done. Run phases one at a time, in
order.

---

## Round-level forks & flags (resolve/skim before starting)

- **FLAG-CS015-a (item 10 — garbage lifetime default & scope). — RESOLVED: 10 s.**
  The shipped constant is `GARBAGE_DECAY = 22`, and today **only loose singles
  decay** (`pieces === 1`); clumps never age out (FORK-4, v3.3 P4). Item 10 asks
  for **any size** to disappear "if not picked up **or merged together**."
  **Paul's call: default 10 s** (the panel is the escape hatch — tune from there;
  no reason to bias the default toward the old 22). P6 therefore: `def:10`, make
  **all sizes** decay, and treat a **merge as activity** — the surviving clump's
  clock **resets to a full lifetime** on each merge, so an actively-growing
  lineage never dies but a stalled one does. Note for the build log: this changes
  single-garbage life from 22 s → 10 s at default (expected, not a regression).

- **FLAG-CS015-b (item 2 — "same colors" is ambiguous).** Each timed row already
  uses its **own** hue when active and `COLOR.dim` when idle; the Scoop row's
  label/number are **hardcoded violet regardless of level**, so at rest it's the
  one bright row among dim ones. Best-guess in P1: make the Scoop label + number
  + lit segments follow the **same active/idle convention** as the timed rows —
  `POWERUP_COLOR.scoop` when `scoopLevel > 0`, `COLOR.dim` when `0`. If you meant
  instead "make every indicator one identical hue," that's a one-line swap of the
  litColor/label color — say so and it's a two-minute follow-up.

- **FLAG-CS015-c (item 4 — where debug values persist).** Item 4.7 says "saved to
  local storage just like the other Options values." Best-guess: a nested
  `debug: { … }` object **inside the existing `afd_settings_v1`** blob (additive,
  per-key known-value-else-default — the same guard pattern as every other field
  on that key). This honors "just like other options," adds **no new frozen key**,
  and isolates the churn ("adding/removing settings in coming changesets") to one
  sub-object. Alternative: a dedicated `afd_debug_v1` key. Recommending the nested
  object; flag if you want the separate key.

- **FLAG-CS015-h (item 4 — debug vars as DATA).** Strong recommendation, baked
  into P4: a single **`DEBUG_VARS` registry** (label, unit, default, min/max/step,
  optional unit conversion) drives the panel render, the input/adjust handler, and
  persistence generically. Adding or removing a debug variable in a future
  changeset is then **one registry entry** + repointing its consumer site — no
  panel/persistence code touched. This is the same "tracks are data / lines are
  data" idiom the codebase already uses. P4 ships the registry with **one** entry
  (item 5); P5/P6 add entries only.

- **FORK-CS015-D (item 6 — which strings ship). — RESOLVED (strings approved).**
  Approved set (functional/matter-of-fact register — no Dan sarcasm here, by
  design): **"Payload damaged."**, **"Payload disrupted."**, **"Payload
  scattered."**, **"Bounty broke free."**, **"Bounty lost."** "Payload"/"Bounty"
  chosen deliberately to signal the lost salvage was *worth points*, not trash.
  P7 remains gated on the **lab phon** step: each line's `phon` must still be
  composed and zero-err-verified in `tools/voice-robot-lab.html` and pasted
  **verbatim** (voice non-negotiable), exactly like CS011 P5. Strings are locked;
  only the phon composition remains before P7 can run.

- **FLAG-CS015-e (item 5 — "even longer").** "Make it take even longer … I believe
  we made it 1 second before" — confirmed: `AUTO_SHIELD_REGEN_PAUSE = 1.0`.
  Best-guess: the fix is to make it **tunable**, default **1000 ms** (= today's
  1.0 s, so no behavior change at default); you dial it **up** in the panel to find
  the value that finally makes auto-shield losable. Default is **not** raised
  blindly. Note: values **below** `HIT_STUN_DURATION` (1.0 s) weaken the
  "no recharge between i-frames" guarantee — that's your call from the panel.

- **FLAG-CS015-g (version).** Target **"1.0.0.15"**, hosted on the round's **last
  landed phase** (P7 as ordered). If P7 slips past the rest of the round (lab not
  ready), move the bump to whichever phase lands last, per the CS013 P4 precedent.

---

## Phase map & dependencies

```
P1  items 1,2   Pause-panel width + Scoop HUD color        (rendering, independent)
P2  item  3     Achievements row: no name/medal overlap    (rendering + scroll math, independent)
P3  items 9,8   Level-up gate + scoop-assisted powerup pickup (gameplay logic, independent)
P4  items 4,5   Debug Options panel: registry + secret entry + first var  (ARCHITECTURE — foundation)
P5  items 7,11,12  Four more debug variables               (registry adds; depends on P4)
P6  item  10    Garbage lifetime var + all-sizes decay      (behavior change; depends on P4)
P7  item  6     Chain-broken voice strings + version bump   (voice-lab-gated; do last)
```

P1–P3 are independent and low-risk — ship them first for value and warm-up.
P4 is the foundation for P5/P6. P7 is gated and goes last.

---

## Phase P1 — Pause-panel width + Scoop HUD indicator color (items 1, 2)

**Goal.** (1) The root/PAUSED panel is `menuPanel(360, 300)`; its control hint
`"↑↓ move    ENTER / A select    ESC / B back"` renders at `MENU_HINT_SIZE = 16`
(CS013 P2 bumped it from 12) — ~43 monospace chars ≈ 410 px, wider than 360, so it
bleeds past both borders. Widen the panel to seat the hint with margin. (2) Make
the Scoop indicator obey the same color convention as the other lower-left rows.

**Grep-confirmed anchors (re-confirm):**
- `drawRootMenu()` ≈ L5202–5209 — `menuPanel(360, 300, …)`; hint at L5208.
- `MENU_HINT_SIZE = 16` ≈ L2248; `drawMenuHint()` ≈ L5150.
- Scoop HUD block ≈ L5915–5921 (`drawRingSegments(…, POWERUP_COLOR.scoop, COLOR.dim)`
  then two `drawText(…, POWERUP_COLOR.scoop)` for label + number).
- Timed-row color convention ≈ L5860 (`active ? POWERUP_COLOR[t] : COLOR.dim`).
- The gameover root reuses `drawRootMenu` with the same hint — widening fixes both.

**Change:**
1. Hoist the root hint to a `const ROOT_MENU_HINT = "↑↓ move    ENTER / A select    ESC / B back";`
   so measure and draw can't diverge. Before calling `menuPanel`, measure it:
   `ctx.font = MENU_HINT_SIZE + "px monospace"; const w = Math.max(360, Math.ceil(ctx.measureText(ROOT_MENU_HINT).width) + 2*ROOT_MENU_HINT_MARGIN);`
   with a new `ROOT_MENU_HINT_MARGIN` constant (~28, playtest knob). Pass `w` to
   `menuPanel(w, 300, …)`. Height and the fixed 46 px row step are unchanged
   (CS013 P1's "no resize for gameover" note is about **height/rows**, unaffected).
   Draw the hint with `drawMenuHint(ROOT_MENU_HINT, …)`. Measured-not-magic so it
   self-heals if the hint or font size ever changes again.
2. In the Scoop block, compute `const scoopCol = game.scoopLevel > 0 ? POWERUP_COLOR.scoop : COLOR.dim;`
   and use `scoopCol` for the segmented ring's litColor, the "SCOOP" label, and the
   level number — mirroring the timed rows' active/idle rule (FLAG-CS015-b). The
   dim track already uses `COLOR.dim`; unchanged.

**Watch:** don't touch `menuPanel`'s internals (fill/stroke/title) — only the `w`
passed by `drawRootMenu`. No new fills (GDD §3.2).

**Test (`scratchpad/test-cs015-p1.js`):** `node --check`; assert `ROOT_MENU_HINT`
measured width + margins is ≤ the panel width the code computes (pull both from the
real symbols, don't hardcode); assert the Scoop color helper returns `COLOR.dim` at
level 0 and `POWERUP_COLOR.scoop` at level ≥1; headless no-crash `draw()` smoke at
title + paused.

**Model/effort:** **Sonnet 5 · high.** Two localized rendering edits, no logic.

**▶ Claude Code prompt — paste this (model: Sonnet 5 · high):**
```
CS015 Phase P1 (items 1,2): pause-panel width fit + Scoop HUD indicator color.

First read STATUS.md and CLAUDE.md. This is ONE phase only — do not build ahead.

Re-grep to confirm current line numbers before editing (they will have drifted):
- drawRootMenu → the menuPanel(360, 300, ...) call and the control-hint drawMenuHint call
- MENU_HINT_SIZE, drawMenuHint
- the Scoop HUD row: drawRingSegments(..., POWERUP_COLOR.scoop, ...) plus the two drawText for the SCOOP label and the level number
- a timed powerup row for the convention: active ? POWERUP_COLOR[t] : COLOR.dim

Change:
1. Add const ROOT_MENU_HINT = "↑↓ move    ENTER / A select    ESC / B back"; and a new tuning const ROOT_MENU_HINT_MARGIN = 28 (playtest knob, grouped with the menu consts). In drawRootMenu, before menuPanel: set ctx.font = MENU_HINT_SIZE + "px monospace", measure ROOT_MENU_HINT, compute w = Math.max(360, Math.ceil(measuredWidth) + 2*ROOT_MENU_HINT_MARGIN), pass w to menuPanel(w, 300, ...). Draw the hint via drawMenuHint(ROOT_MENU_HINT, ...). Do NOT touch menuPanel internals or the row height/step.
2. In the Scoop HUD row, compute scoopCol = game.scoopLevel > 0 ? POWERUP_COLOR.scoop : COLOR.dim and use scoopCol for the lit segments, the SCOOP label, and the level number. Leave the dim track as COLOR.dim.

No new fills.

Test: create scratchpad/test-cs015-p1.js. node --check clean. Drive the REAL symbols (stub canvas/ctx like the other scratchpad tests): assert the computed panel width ≥ measured hint width + 2*margin; assert the scoop-color expression returns COLOR.dim at scoopLevel 0 and POWERUP_COLOR.scoop at ≥1; headless draw() smoke at title and paused with no throw. Run the full scratchpad regression.

Docs (in place): GDD §2 HUD/menu note (Scoop-row active/idle color + measured root-panel width); Architecture Map only if it references panel size; append GDD-VERSION-HISTORY.md; update STATUS.md.

Commit on main, do NOT push:
CS015 P1: widen pause panel to fit control hint; align Scoop HUD indicator to the active/idle color convention
```

**Commit:** `CS015 P1: widen pause panel to fit control hint; align Scoop HUD indicator to the active/idle color convention`

**Docs:** GDD §2 HUD/menu notes for the Scoop-row color rule + the measured root-
panel width; Architecture Map only if a row description references the panel size;
`GDD-VERSION-HISTORY.md` entry; `STATUS.md`.

---

## Phase P2 — Achievements row: eliminate name/medal overlap (item 3)

**Goal.** In `drawAchRow`, the achievement **name** (left) and the **medal/tier or
progress status** (right, at `x + w` where `w = colW = 350`) share **one baseline**.
With `ACH_SCALE = 1.5` (CS013 P3), long name + long status now collide mid-column.
Keep the larger font; guarantee no overlap by giving the status its **own line**.

**Grep-confirmed anchors (re-confirm):**
- `drawAchRow(ach, x, ry, w)` ≈ L5450–5462 — three `drawText` calls: name @`ry`,
  status @`(x+w, ry)` right-aligned, desc @`ry+22`. Two shapes (tiered vs plain),
  same collision.
- `ACH_SCALE = 1.5` ≈ L2249; `ACH_ROW_STEP = 40 * ACH_SCALE` ≈ L5387.
- `achMaxScroll()` ≈ L5396–5401 — derives content height from `ACH_ROW_STEP` + a
  `+22 + 10*ACH_SCALE` desc tail; **shared** with the render, so any per-row height
  change must update BOTH or scroll/clip desync.
- Clip region `ACH_ROW_CLIP_*` ≈ L5388–5390 (derived from panel Y, not step).

**Change (best-guess — uniform 3-line rows; guaranteed no overlap, clean scroll
math; see FLAG-CS015-f note below):**
1. Lay every row out as three stacked lines: **name** @`ry`, **status** @`ry + ACH_STATUS_DY`
   (still right-aligned at `x+w`, or left at `x` — look-call), **desc** @`ry + ACH_DESC_DY`.
   Add `ACH_STATUS_DY` / `ACH_DESC_DY` constants (playtest knobs).
2. Bump `ACH_ROW_STEP` so three lines seat without touching the next row (e.g.
   `~48 * ACH_SCALE`; confirm in-browser — knob).
3. Update `achMaxScroll()`'s tail term to the new **desc bottom** (`ACH_DESC_DY +
   ~10*ACH_SCALE`) so the render and the input clamp still agree exactly.
4. Apply to **both** branches of `drawAchRow` (tiered and plain).

Rows now uniformly taller → more scrolling; the CS013 P3 clip+scroll already handle
that. Exact `DY`/step values are look-calls to nudge in a browser playtest.

**FLAG-CS015-f:** always-wrap (above) is chosen for guaranteed no-overlap and a
uniform grid. If the extra whitespace under short rows bugs you, the alternative is
a **measured conditional wrap** (`ctx.measureText(name)` + status width vs `w`; wrap
only when they'd collide) — but variable row heights complicate the shared
`achMaxScroll` math, so it's more code for a cosmetic gain. Say the word.

**Test (`scratchpad/test-cs015-p2.js`):** `node --check`; assert the render's
per-row content height (`ACH_DESC_DY + tail`) equals what `achMaxScroll()` assumes
(pull both from real symbols); assert `achMaxScroll()` ≥ 0 and clamps `game.menu.scroll`;
headless `drawAchievements()` no-crash at scroll 0 and scroll = max, both column shapes.

**Model/effort:** **Sonnet 5 · high** (drop `ultrathink` into the message for the
`achMaxScroll` coupling if it stalls — that shared-math seam is the only trap).

**▶ Claude Code prompt — paste this (model: Sonnet 5 · high; add `ultrathink` if the scroll math stalls):**
```
CS015 Phase P2 (item 3): stop achievement name/medal overlap at ACH_SCALE 1.5.

First read STATUS.md and CLAUDE.md. ONE phase only.

Re-grep to confirm current lines:
- drawAchRow(ach, x, ry, w): the three drawText calls (name left @ry, status right-aligned @x+w @ry, desc @ry+22), in BOTH the tiered and plain branches
- ACH_SCALE, ACH_ROW_STEP
- achMaxScroll(): the content-height math (it shares the per-row height with the render — both must agree)
- the achievements clip-region consts

Change (uniform 3-line rows):
1. Add tuning consts ACH_STATUS_DY and ACH_DESC_DY (playtest knobs, grouped with the ach consts). Lay each row as three stacked lines: name @ry, status @ry+ACH_STATUS_DY (keep it right-aligned at x+w), desc @ry+ACH_DESC_DY. Apply to BOTH branches of drawAchRow.
2. Bump ACH_ROW_STEP so three lines seat without touching the next row (start ~48*ACH_SCALE).
3. Update achMaxScroll()'s tail term to the new desc bottom (ACH_DESC_DY + ~10*ACH_SCALE) so render and input-clamp agree exactly.

Test: scratchpad/test-cs015-p2.js. node --check. Pull the real per-row height and the value achMaxScroll() assumes from the real symbols and assert they match; assert achMaxScroll() ≥ 0 and clamps game.menu.scroll; headless drawAchievements() no-throw at scroll 0 and scroll=max, both column shapes. Full regression.

Docs: GDD §2.16 row-layout note; Architecture Map if the row-geometry consts are listed; version history; STATUS.md (note the DY/step values are browser-tuned look-calls to nudge in playtest).

Commit on main, do NOT push:
CS015 P2: stack Achievements name/status/desc on separate lines to stop overlap at the larger font
```

**Commit:** `CS015 P2: stack Achievements name/status/desc on separate lines to stop overlap at the larger font`

**Docs:** GDD §2.16 (Achievements viewer) row-layout note; Architecture Map if the
row-geometry consts are listed; version history; `STATUS.md` (flag the DY/step
values as browser-tuned look-calls).

---

## Phase P3 — Level-up gate + scoop-assisted powerup pickup (items 9, 8)

**Goal.** (9) Advance to the next level when **all garbage satellites (debris) are
destroyed**, regardless of Hunters; carry Hunters **and** loose garbage into the new
level. (8) The Scoop mouth that eases garbage pickup should ease **powerup** pickup too.

**Grep-confirmed anchors (re-confirm):**
- Wave-clear ≈ L5101: `if (game.debris.length === 0 && game.hunters.length === 0)`
  → 2.5 s timer → `nextWave()`.
- `nextWave()` ≈ its function: increments wave, relocates dock, spawns new debris —
  **does not** clear `game.hunters` or `game.garbage`. So once the hunters gate is
  dropped, both carry over **for free**; no other edit needed for 9.1/9.2.
- `startGame()` full reset ≈ L3605–3608 (fresh game only — leave alone).
- Powerup pickup ≈ L4831–4836: `const r = p.radius + SHIP_RADIUS; if (dist2(p, game.ship) < r*r) { … }`.
- `inScoopBox(g)` ≈ L3824–3832 — wrap-aware, reads `g.x/g.y`, returns `false` at
  `scoopLevel 0` (invariant guard L503), so it's byte-identical at level 0.

**Change:**
1. **Item 9:** drop the hunters clause — `if (game.debris.length === 0)`. Update the
   comment: wave clears on debris-empty; Hunters and garbage persist across the
   boundary by design (9.1/9.2), which can let Hunters accumulate if neglected.
   Nothing in `nextWave` wipes them, so carry-over is automatic. (Heartbeat density
   `debris + hunters*2` and the Perfect-Wave check at clear are unaffected.)
2. **Item 8:** OR the scoop mouth into the powerup test —
   `if (dist2(p, game.ship) < r*r || inScoopBox(p)) { … }`. Same idiom as garbage
   pickup at L4774. Scoop-only (no magnet mult for powerups — item 8 doesn't ask
   for it).

**Watch:** confirm by grep there is **no second** wave-clear path (there isn't at
planning). Don't add a garbage/hunter wipe to `nextWave`.

**Test (`scratchpad/test-cs015-p3.js`):** drive the **real** `update`/`nextWave`
headless. (9) With `debris = []` but a live Hunter present, the wave-clear timer
runs and `nextWave` fires; assert the carried Hunter and any carried garbage survive
into the new wave and new debris is added on top. (8) At `scoopLevel 0`, a powerup
just outside `r` is **not** collected (byte-identical); at `scoopLevel ≥1`, a powerup
inside the scoop mouth but outside `r` **is** collected (real `inScoopBox`, real
`applyPowerup`). `node --check`; no-crash smoke.

**Model/effort:** **Sonnet 5 · high.** Two small, well-anchored logic edits.

**▶ Claude Code prompt — paste this (model: Sonnet 5 · high):**
```
CS015 Phase P3 (items 9,8): level-up on debris-empty; scoop mouth captures powerups.

First read STATUS.md and CLAUDE.md. ONE phase only.

Re-grep to confirm current lines:
- the wave-clear condition: game.debris.length === 0 && game.hunters.length === 0
- nextWave(): CONFIRM it does NOT clear game.hunters or game.garbage (it shouldn't)
- powerup pickup: const r = p.radius + SHIP_RADIUS; if (dist2(p, game.ship) < r*r) { ... }
- inScoopBox(g): confirm it reads g.x/g.y generically and returns false at scoopLevel 0
- confirm there is NO second wave-clear path anywhere

Change:
1. Item 9: drop the hunters clause → if (game.debris.length === 0). Update the comment: wave clears on debris-empty; Hunters and loose garbage carry over by design and can accumulate if neglected. Do NOT add any hunter/garbage wipe to nextWave.
2. Item 8: OR the scoop mouth into the powerup test → if (dist2(p, game.ship) < r*r || inScoopBox(p)) { ... }. Scoop only, no magnet multiplier.

dist2 is wrap-aware and already in place. No new fills.

Test: scratchpad/test-cs015-p3.js driving the REAL update/nextWave. (9) debris=[] with a live Hunter → wave-clear timer runs, nextWave fires, the carried Hunter and any carried garbage survive into the new wave and new debris is added on top. (8) scoopLevel 0: a powerup just outside r is NOT collected; scoopLevel ≥1: a powerup inside the scoop mouth but outside r IS collected (real inScoopBox + real applyPowerup). node --check; full regression.

Docs: GDD §2 wave/level progression + §2.14/§2.14.1 (scoop now captures powerups); version history; STATUS.md.

Commit on main, do NOT push:
CS015 P3: clear wave on debris-empty (Hunters/garbage carry over); scoop mouth now also captures powerups
```

**Commit:** `CS015 P3: clear wave on debris-empty (Hunters/garbage carry over); scoop mouth now also captures powerups`

**Docs:** GDD §2 wave/level-progression + §2.14/§2.14.1 (scoop capture now covers
powerups); version history; `STATUS.md`.

---

## Phase P4 — Debug Options panel: registry + secret entry + first variable (items 4, 5)

**Goal.** A hidden **Debug Options** dialog, opened by a secret keystroke sequence
from the Title or Pause screen, listing data-driven **debug variables** that adjust
live and persist. Ship the full infrastructure **plus the first variable** (item 5,
Auto Shield Regen Pause) as a complete vertical slice. Build **only** this — later
debug vars are P5/P6 (don't wire them here).

**Grep-confirmed anchors (re-confirm):**
- Menu state machine: `menuInput(action)` dispatch ≈ L2345–2356; screen handlers
  `menuRoot`/`menuOptions`/… (label-dispatched); render dispatch in `drawMenu()` ≈
  L2176–2185; panel primitive `menuPanel(w,h,title)` ≈ L5183.
- `gotoScreen(s,index)` ≈ L2327; `openPause()` ≈ L2295 (sets `game.paused=true` +
  screen); `closePause()` ≈ L2310.
- Keydown listener ≈ L2077 (three contexts: rebind / menu-open / play; `k = e.key.toLowerCase()`);
  its title/gameover openers ≈ L2123–2129.
- **`update(dt)` is paused/title-gated** (early-return L2666-ish / confirmed L4666
  `if (game.state !== "playing" || game.paused) return;`) — so the 4 s idle timeout
  **cannot** tick in `update`; it must tick in **`loop()`** (L6039, always runs).
- AudioSys one-shot pattern: `ui(up)` ≈ L within AudioSys, `scooploss()` ≈ L844 —
  `this.ctx` guard, `this.now()`, oscillator→gain envelope→`this.sfx`, start/stop.
- Persistence: `settings` obj ≈ L2270; `saveSettings()` ≈ L2565; `loadSettings()` ≈
  L2581 (additive known-value-else-default per field); `STORAGE_KEY = "afd_settings_v1"`.
- Item 5 consumer: `s.autoShieldRegenLock = AUTO_SHIELD_REGEN_PAUSE;` ≈ **L4303**;
  const `AUTO_SHIELD_REGEN_PAUSE = 1.0` ≈ L132 (seconds; `>= HIT_STUN_DURATION` note).

**Change — build in four cohesive pieces (natural split point after piece 2 if you
want two sessions):**

**(1) DEBUG registry + runtime (data-driven, FLAG-CS015-h).** Near the `settings`
block, add:
```
const DEBUG_VARS = [
  { id:"autoShieldRegenPause", label:"Auto Shield Regen Pause", unit:"ms",
    def: AUTO_SHIELD_REGEN_PAUSE * 1000, min:0, max:5000, step:100, toNative:v=>v/1000 },
];
const DEBUG = {};          // native-unit live values, read by consumers
const debugShown = {};     // display-unit values, shown/persisted by the panel
function applyDebug(id, shown){
  const e = DEBUG_VARS.find(v=>v.id===id);
  debugShown[id] = shown;
  DEBUG[id] = e.toNative ? e.toNative(shown) : shown;
}
for (const v of DEBUG_VARS) applyDebug(v.id, v.def);   // seed from defaults
```
`def` derives from the shipped const (converted to display units) so there's one
source of truth; `toNative` is identity unless present. Repoint the item-5 consumer:
`s.autoShieldRegenLock = DEBUG.autoShieldRegenPause;` (native seconds). Leave the
`AUTO_SHIELD_REGEN_PAUSE` const in place as the documented shipped default.

**(2) Panel screen (generic over the registry).** Add `"debug"` to `menuInput`
dispatch and `drawMenu` dispatch. `drawDebug()`: `menuPanel(560, …, "DEBUG OPTIONS")`,
one row per `DEBUG_VARS` entry — label (left) + `◄ value unit ►` (right) — plus a
centered **Back** row; cursor `game.menu.index` over `N+1` rows.
`menuDebug(a)`: up/down move; left/right adjust the selected var by `step`, clamped
`[min,max]`, then `applyDebug(id, …)` + `saveSettings()` + `AudioSys.ui(false)`;
confirm/back on **Back** returns to context; `back` anywhere returns to context.
Return routing mirrors `menuOptions`: `game.state==="playing"||"gameover"` →
`gotoScreen("root", …)`, else `closePause()`. Add `openDebug()` (like `openPause`
but `screen="debug"`) for the title case (sets `game.paused=true`). **Do not** add
Debug to `MENU_OPTIONS`/`rootItems` — it's reachable only by the secret code.

**(3) Persistence (FLAG-CS015-c).** In `saveSettings`, add `debug: { ...debugShown }`.
In `loadSettings`, after the other additive fields: for each `DEBUG_VARS` entry, if
`data.debug && Number.isFinite(data.debug[id])` and in `[min,max]`, `applyDebug(id,
data.debug[id])`, else leave the seeded default. Known-value-else-default, same
guard style as every other field. No new key; `afd_settings_v1` stays frozen-named.

**(4) Secret-code entry + beeps.** Add a `DebugCode` module-level object:
`{ armed:false, buf:"", last:0 }` and constants `DEBUG_CODE = "EvilG3niu$"`,
`DEBUG_CODE_IDLE_MS = 4000`. Two AudioSys methods modeled on `ui`/`scooploss`:
`secretArm()` = 3 quick **ascending** square/triangle blips; `secretDisarm()` = 3
**descending** blips (both `this.ctx`-guarded, → `this.sfx`).
- In the keydown listener, **before** the context branches (right after
  `AudioSys.init()`), when armed-context is valid — `game.state==="title"` **or**
  (`game.paused && game.state==="playing"`) — and not `rebinding`/`entry`:
  - `` e.key === "`" `` → `DebugCode.armed=true; buf=""; last=performance.now();
    AudioSys.secretArm();` (return; backtick is inert elsewhere).
  - else if armed and `!e.repeat`: `last = now`; if `e.key.length === 1` append to
    `buf` (this preserves case + shifted symbols like `G`,`3`,`$` and **drops**
    modifiers/arrows/Enter/Esc, whose `e.key` is multi-char); keep only the last
    `DEBUG_CODE.length` chars; if `buf.endsWith(DEBUG_CODE)` → disarm +
    (`game.state==="title" ? openDebug() : gotoScreen("debug")`).
  Let normal handling proceed otherwise — every code char is inert on title/pause
  (none are nav/confirm keys), so nothing visible happens (item 4.3 "secret").
- In **`loop()`** (unconditional, after `update`): if `DebugCode.armed &&
  performance.now() - DebugCode.last > DEBUG_CODE_IDLE_MS` → `armed=false;
  AudioSys.secretDisarm();`. (Must live here, not `update` — `update` is
  paused/title-gated, but the timeout must fire on inactivity with no keypress.)

**Watch:** the first-ever keystroke also inits AudioSys in the same handler, so the
arm beep can play; methods early-return if `!ctx` anyway. Don't `preventDefault` the
code keys on the title. Keep the panel out of the normal Options tree.

**Test (`scratchpad/test-cs015-p4.js`):** `node --check`; registry round-trip
(`applyDebug` display↔native, ms/1000 for item 5; clamp at min/max); a real
`saveSettings`→`loadSettings` cycle round-trips `debug.autoShieldRegenPause` and an
out-of-range/garbage value snaps to default; the item-5 consumer reads
`DEBUG.autoShieldRegenPause` (drive real `damageShip`; auto-save arms
`autoShieldRegenLock` to the live value, default 1.0 s); secret-code state machine
(feed a fake key stream: backtick arms; `"EvilG3niu$"` suffix opens `"debug"`; a
non-matching stream doesn't; modifiers/arrows don't pollute `buf`); the `loop()`
idle path disarms after `DEBUG_CODE_IDLE_MS`; `drawDebug()`/`menuDebug()` no-crash
headless.

**Model/effort:** **Opus 4.8 · xhigh.** Genuine architecture: menu wiring, keydown
context-gating, the `loop()`-vs-`update()` timeout seam, persistence, registry.
Drop **`ultrathink`** into the message on two sub-problems: the secret-code
contexts/`e.key` buffering, and the const→`DEBUG` live-tunable persistence path.

**▶ Claude Code prompt — paste this (model: Opus 4.8 · xhigh; include `ultrathink`):**
```
CS015 Phase P4 (items 4,5): hidden Debug Options panel — data-driven DEBUG_VARS registry + secret-code entry + first knob (Auto Shield Regen Pause). FOUNDATION phase; build ONLY this, no later debug vars. ultrathink.

First read STATUS.md and CLAUDE.md. ONE phase only.

Re-grep to confirm current lines:
- menu state machine: menuInput(action) dispatch, the per-screen handlers (menuRoot/menuOptions, label-dispatched), drawMenu() render dispatch, menuPanel(w,h,title)
- gotoScreen(s,index), openPause() (sets game.paused), closePause()
- the keydown listener (three contexts: rebind / menu-open / play) and where AudioSys.init()/resume() is called in it
- update(dt) early-return guard (state !== "playing" || paused) — CONFIRM it early-returns; the idle timeout must NOT live there
- loop() (runs unconditionally every frame)
- AudioSys one-shot method pattern (e.g. ui(), scooploss()): this.ctx guard, this.now(), oscillator→gain→this.sfx
- settings obj, saveSettings(), loadSettings() (additive known-value-else-default), STORAGE_KEY "afd_settings_v1"
- item-5 consumer: s.autoShieldRegenLock = AUTO_SHIELD_REGEN_PAUSE; and const AUTO_SHIELD_REGEN_PAUSE = 1.0

Change — four pieces:

(1) Registry + runtime. Near the settings block, add:
  const DEBUG_VARS = [
    { id:"autoShieldRegenPause", label:"Auto Shield Regen Pause", unit:"ms",
      def: AUTO_SHIELD_REGEN_PAUSE * 1000, min:0, max:5000, step:100, toNative:v=>v/1000 },
  ];
  const DEBUG = {};        // native-unit live values (consumers read these)
  const debugShown = {};   // display-unit values (panel + persistence)
  function applyDebug(id, shown){
    const e = DEBUG_VARS.find(v=>v.id===id);
    debugShown[id] = shown;
    DEBUG[id] = e.toNative ? e.toNative(shown) : shown;
  }
  for (const v of DEBUG_VARS) applyDebug(v.id, v.def);
Repoint the item-5 consumer to DEBUG.autoShieldRegenPause (native seconds). Leave the AUTO_SHIELD_REGEN_PAUSE const in place as the documented default.

(2) Panel screen (generic over the registry). Add "debug" to the menuInput dispatch and the drawMenu dispatch. drawDebug(): menuPanel(560, ..., "DEBUG OPTIONS"), one row per DEBUG_VARS entry — label left, "◄ value+unit ►" right — plus a centered Back row; cursor game.menu.index over N+1 rows. menuDebug(a): up/down move; left/right adjust the selected var by step, clamped [min,max], then applyDebug(id, newShown) + saveSettings() + AudioSys.ui(false); Back row (or the back action) returns to context. Return routing mirrors menuOptions: state playing/gameover → gotoScreen("root", ...), else closePause(). Add openDebug() like openPause() but screen="debug" (sets game.paused). Do NOT add Debug to MENU_OPTIONS/rootItems.

(3) Persistence. In saveSettings add debug: { ...debugShown }. In loadSettings, after the other additive fields, for each DEBUG_VARS entry: if data.debug && Number.isFinite(data.debug[id]) && it's within [min,max] → applyDebug(id, data.debug[id]); else keep the seeded default. No new storage key.

(4) Secret-code entry + beeps. Add module-level DebugCode = { armed:false, buf:"", last:0 } and consts DEBUG_CODE = "EvilG3niu$", DEBUG_CODE_IDLE_MS = 4000. Add two AudioSys methods modeled on ui()/scooploss(): secretArm() = 3 ascending blips, secretDisarm() = 3 descending blips (both this.ctx-guarded). In the keydown listener, right after AudioSys.init(), only when ((game.state==="title") || (game.paused && game.state==="playing")) and NOT rebinding/name-entry:
  - if e.key === "`": DebugCode.armed=true; DebugCode.buf=""; DebugCode.last=performance.now(); AudioSys.secretArm(); return;
  - else if DebugCode.armed && !e.repeat: DebugCode.last=performance.now(); if e.key.length===1 append e.key to DebugCode.buf (this preserves case and $/G/3 and drops multi-char modifier/nav keys); keep only the last DEBUG_CODE.length chars; if DebugCode.buf.endsWith(DEBUG_CODE) → disarm and (game.state==="title" ? openDebug() : gotoScreen("debug")).
  Otherwise let normal handling proceed (every code char is inert on title/pause). Do NOT preventDefault the code keys.
In loop(), unconditionally after update(): if DebugCode.armed && performance.now() - DebugCode.last > DEBUG_CODE_IDLE_MS → DebugCode.armed=false; AudioSys.secretDisarm(). (Must be in loop(), NOT update, which is paused-gated.)

Do NOT touch invariant guards, the MusicSys scheduler, or the VoiceSys engine. No new frozen localStorage key names.

Test: scratchpad/test-cs015-p4.js. node --check. Drive REAL functions: applyDebug round-trips display↔native (ms/1000) and clamps at min/max; a real saveSettings→loadSettings cycle round-trips debug.autoShieldRegenPause and snaps a garbage/out-of-range stored value to default; the item-5 consumer reads DEBUG.autoShieldRegenPause (drive the real auto-shield/damage path; the lock equals the live value, default 1.0s); the secret-code machine on a fake key stream (backtick arms; "EvilG3niu$" suffix opens "debug"; a non-matching stream does not; modifier/arrow keys do not pollute buf); the loop() idle path disarms after DEBUG_CODE_IDLE_MS; drawDebug()/menuDebug() no-throw headless. Full regression.

Docs: GDD §2 new "Debug Options" subsection (secret entry, registry, persistence location); Architecture Map — AudioSys (secretArm/secretDisarm), menu/input (debug screen, DebugCode, openDebug), Constants (DEBUG_VARS/DEBUG), loop() idle-timeout note; the afd_settings_v1 frozen-keys note gains the additive debug sub-object; version history; STATUS.md.

Commit on main, do NOT push:
CS015 P4: hidden Debug Options panel (data-driven DEBUG_VARS registry, secret-code entry + beeps, afd_settings_v1.debug persistence); first knob: Auto Shield Regen Pause
```

**Commit:** `CS015 P4: hidden Debug Options panel (data-driven DEBUG_VARS registry, secret-code entry + beeps, afd_settings_v1.debug persistence); first knob: Auto Shield Regen Pause`

**Docs:** GDD §2 new "Debug Options" subsection (secret entry, registry, persistence
location); Architecture Map — AudioSys row (`secretArm`/`secretDisarm`), menu/input
rows (`debug` screen, `DebugCode`, `openDebug`), Constants row (`DEBUG_VARS`/`DEBUG`),
`loop()` note (idle-timeout tick); `afd_settings_v1` frozen-keys note gains the
additive `debug` sub-object; version history; `STATUS.md`.

---

## Phase P5 — Four more debug variables (items 7, 11, 12)

**Goal.** Add the remaining tuning knobs. With P4's registry in place these are pure
**registry entries + consumer repoints** — no panel/persistence changes. Defaults
equal the shipped constants, so **no behavior change at default**; they just become
live-tunable.

**Grep-confirmed anchors (re-confirm each — replace *every* value-read, not just
the first):**
- Item 7 — `SCOOP_HITS_PER_LEVEL = 5` (L504); consumer `if (game.scoopHits >= SCOOP_HITS_PER_LEVEL)` ≈ **L4341**.
- Item 11 — `GARBAGE_COALESCE_DELAY = 3.0` (L310); consumers `this.coalesceDelay = …`
  ≈ **L3300** (ctor) and `g.coalesceDelay = …` ≈ **L4813** (re-arm). Grep the symbol
  and repoint all value assignments (watch for a shatter re-arm near L3780).
- Item 12.1 — `GARBAGE_MAGNET_RANGE = 180` (L316); consumer
  `if (d2 >= GARBAGE_MAGNET_RANGE * GARBAGE_MAGNET_RANGE) continue;` ≈ **L4450**.
  (Verifies item 12.1's premise: yes, attraction **is** radius-gated — default =
  current 180 px, per the doc.)
- Item 12.2 — `GARBAGE_MAGNET_PULL = 40` (L322); consumer
  `(dx/d) * GARBAGE_MAGNET_PULL * dt` ≈ **L4483** (default = current 40 px/s²).

**Change.** Append to `DEBUG_VARS`:
```
{ id:"scoopHitsPerLevel",    label:"Hits before losing scoop", unit:"",     def:SCOOP_HITS_PER_LEVEL,        min:1, max:20,   step:1 },
{ id:"garbageAttractDelay",  label:"Garbage attraction delay", unit:"ms",   def:GARBAGE_COALESCE_DELAY*1000, min:0, max:10000, step:250, toNative:v=>v/1000 },
{ id:"garbageAttractRadius", label:"Garbage attraction radius",unit:"px",   def:GARBAGE_MAGNET_RANGE,        min:0, max:600,  step:10 },
{ id:"garbageAttractForce",  label:"Garbage attraction force", unit:"px/s²",def:GARBAGE_MAGNET_PULL,         min:0, max:200,  step:5 },
```
Repoint consumers: `SCOOP_HITS_PER_LEVEL`→`DEBUG.scoopHitsPerLevel`;
`GARBAGE_COALESCE_DELAY` (both sites, native s)→`DEBUG.garbageAttractDelay`;
`GARBAGE_MAGNET_RANGE`→`DEBUG.garbageAttractRadius`;
`GARBAGE_MAGNET_PULL`→`DEBUG.garbageAttractForce`. Keep the consts as documented
shipped defaults. `garbageAttractDelay` captured per-piece at ctor time takes effect
on **new** garbage (fine for a dev knob; retroactive change isn't needed).

**Watch:** `garbageAttractDelay` in **native seconds** at the consumer (the ms→s
conversion is in the registry, not the call site). The `SCOOP_WIDTH[0]/SCOOP_DEPTH[0]`
invariant guard and the `POWERUP_DROP_TYPES` vs `POWERUP_DROP_WEIGHTS` distinction are
untouched here.

**Test (`scratchpad/test-cs015-p5.js`):** `node --check`; each of the four
round-trips display↔native and clamps; each consumer reads `DEBUG.*` (drive real
paths: scoop-loss after `DEBUG.scoopHitsPerLevel` hits; a fresh piece stays inert for
`DEBUG.garbageAttractDelay` then attracts; `coalesceGarbage` skips pairs beyond
`DEBUG.garbageAttractRadius`; pull magnitude scales with `DEBUG.garbageAttractForce`);
at defaults, behavior is byte-identical to pre-P5 (assert against the shipped consts).

**Model/effort:** **Sonnet 5 · high.** Mechanical, well-anchored, no design surface.

**▶ Claude Code prompt — paste this (model: Sonnet 5 · high):**
```
CS015 Phase P5 (items 7,11,12): four more debug knobs. Depends on P4's registry. Defaults = shipped consts, so NO behavior change at default.

First read STATUS.md and CLAUDE.md. ONE phase only.

Re-grep to confirm current lines AND every value-read (not just the first):
- SCOOP_HITS_PER_LEVEL and its consumer (game.scoopHits >= SCOOP_HITS_PER_LEVEL)
- GARBAGE_COALESCE_DELAY and ALL consumers (the ctor assignment + the re-arm site; also check for a shatter re-arm)
- GARBAGE_MAGNET_RANGE and its consumer (d2 >= RANGE*RANGE continue)
- GARBAGE_MAGNET_PULL and its consumer (pull * dt)

Change. Append to DEBUG_VARS:
  { id:"scoopHitsPerLevel",    label:"Hits before losing scoop", unit:"",      def:SCOOP_HITS_PER_LEVEL,        min:1, max:20,    step:1 },
  { id:"garbageAttractDelay",  label:"Garbage attraction delay", unit:"ms",    def:GARBAGE_COALESCE_DELAY*1000, min:0, max:10000, step:250, toNative:v=>v/1000 },
  { id:"garbageAttractRadius", label:"Garbage attraction radius",unit:"px",    def:GARBAGE_MAGNET_RANGE,        min:0, max:600,   step:10 },
  { id:"garbageAttractForce",  label:"Garbage attraction force", unit:"px/s²", def:GARBAGE_MAGNET_PULL,         min:0, max:200,   step:5 },
Repoint consumers: SCOOP_HITS_PER_LEVEL→DEBUG.scoopHitsPerLevel; GARBAGE_COALESCE_DELAY (all sites, native seconds)→DEBUG.garbageAttractDelay; GARBAGE_MAGNET_RANGE→DEBUG.garbageAttractRadius; GARBAGE_MAGNET_PULL→DEBUG.garbageAttractForce. Keep the consts in place as documented defaults. garbageAttractDelay is captured per-piece at ctor time (applies to new garbage — fine).

Do NOT touch the SCOOP_WIDTH[0]/SCOOP_DEPTH[0] invariant guard.

Test: scratchpad/test-cs015-p5.js. node --check. For each of the four: round-trip display↔native + clamp; the consumer reads DEBUG.* (scoop-loss after DEBUG.scoopHitsPerLevel hits; a fresh piece stays inert for DEBUG.garbageAttractDelay then attracts; coalesceGarbage skips pairs beyond DEBUG.garbageAttractRadius; pull magnitude scales with DEBUG.garbageAttractForce). Assert byte-identical to pre-P5 at defaults (compare against the shipped consts). Full regression.

Docs: GDD §2.10.1 (coalescence knobs now dev-tunable) + §2.14 (scoop hits/level); Architecture Map Constants (DEBUG_VARS grown); version history; STATUS.md.

Commit on main, do NOT push:
CS015 P5: add debug knobs — scoop hits/level, garbage attraction delay/radius/force (defaults = shipped)
```

**Commit:** `CS015 P5: add debug knobs — scoop hits/level, garbage attraction delay/radius/force (defaults = shipped)`

**Docs:** GDD §2.10.1 (garbage coalescence knobs now dev-tunable) + §2.14 (scoop
hits/level); Architecture Map Constants row (`DEBUG_VARS` grown); version history;
`STATUS.md`.

---

## Phase P6 — Garbage lifetime knob + all-sizes decay (item 10)

**Goal.** A "Garbage lifetime" debug variable **and** the behavior change it implies:
garbage of **any size** disappears after the lifetime **unless picked up or merged**.
See **FLAG-CS015-a** — default **10 s** (doc) vs shipped `GARBAGE_DECAY = 22`, and
today only singles decay.

**Grep-confirmed anchors (re-confirm):**
- `GARBAGE_DECAY = 22` (L299); seed `this.decay = GARBAGE_DECAY` ≈ **L3293**.
- Decay gate ≈ **L3317–3320**: `if (this.pieces === 1) { this.decay -= dt; if (this.decay <= 0) this.dead = true; }`.
- Single blink-out tell in `draw()` ≈ L3325–3336 (`this.decay < GARBAGE_FADE`);
  clump draw branch ≈ L3338–3345 (no fade tell today).
- Merge site in `coalesceGarbage` ≈ **L4458–4463** (survivor `a` absorbs `b`,
  `a.pieces += b.pieces`, `a.radius = …`) — the "merged together" moment.
- `Garbage.fromNode` ≈ L3305 (still routes through the ctor → gets a normal life).

**Change:**
1. Registry entry (append to `DEBUG_VARS`):
   `{ id:"garbageLifetime", label:"Garbage lifetime", unit:"s", def:10, min:1, max:60, step:1 }`
   — **FLAG-CS015-a**: `def:10` per the doc; flip to `22` to preserve current feel.
2. Seed from the knob: `this.decay = DEBUG.garbageLifetime;` at L3293.
3. **All sizes decay:** drop the `pieces === 1` gate — every piece counts its clock
   down and dies at `<= 0`:
   ```
   this.decay -= dt;
   if (this.decay <= 0) this.dead = true;
   ```
4. **Merge resets the clock (activity):** in the merge branch, after the survivor
   absorbs `b`, add `a.decay = DEBUG.garbageLifetime;` — an actively-growing lineage
   never ages out; a stalled clump does. (This is the "or merged together" clause.)
5. **Expiry tell for clumps:** apply the same `GARBAGE_FADE` blink to the clump draw
   branch as singles get, so a dying clump reads as expiring (look-call — mirror the
   single's `this.decay < GARBAGE_FADE` blink in the `pieces > 1` branch).

**Watch:** the `must exceed GARBAGE_COALESCE_DELAY` margin comment (L300) — with
lifetime 10 s and the attraction delay 3 s (P5 knob), a piece has ~7 s of active
window before dying; still clumps, but Hunters get rarer, which is exactly the
balance you're now tuning from the panel. `Garbage.fromNode` singles decay normally
(unchanged). Coalesced-Hunter transform (`a.pieces >= HUNTER_COALESCE_COUNT`) is
unaffected — it kills `a` and spawns a Hunter before any decay matters.

**Test (`scratchpad/test-cs015-p6.js`):** `node --check`; a **clump** (`pieces > 1`)
now ages out after `DEBUG.garbageLifetime` (pre-P6 it never did); a merge resets the
survivor's `decay` to full; a single still dies on schedule and blinks in its last
`GARBAGE_FADE`; changing the knob changes new-spawn lifetime; a clump one merge shy of
the Hunter threshold that keeps merging never dies (clock keeps resetting) but one
that stalls dies; headless no-crash `draw()` for a decaying clump.

**Model/effort:** **Opus 4.8 · xhigh** (behavior + balance change; the default-value
FLAG and the merge-reset/fade-tell decisions). `ultrathink` on the decay/merge
interaction if it stalls.

**▶ Claude Code prompt — paste this (model: Opus 4.8 · xhigh; include `ultrathink`):**
```
CS015 Phase P6 (item 10): garbage of ANY size ages out on a tunable lifetime; a merge resets the clock. Depends on P4. FLAG-CS015-a resolved: default 10s. ultrathink on the decay/merge interaction.

First read STATUS.md and CLAUDE.md. ONE phase only.

Re-grep to confirm current lines:
- GARBAGE_DECAY (=22) and the seed this.decay = GARBAGE_DECAY
- the decay gate: if (this.pieces === 1) { this.decay -= dt; if (this.decay <= 0) this.dead = true; }
- the single blink-out tell in draw() (this.decay < GARBAGE_FADE) and the clump draw branch (no fade tell today)
- the merge site in coalesceGarbage (survivor a absorbs b: a.pieces += b.pieces, a.radius = ...)
- Garbage.fromNode (routes through the ctor)

Change:
1. Append registry entry: { id:"garbageLifetime", label:"Garbage lifetime", unit:"s", def:10, min:1, max:60, step:1 }.  (def:10 is the resolved call.)
2. Seed from the knob: this.decay = DEBUG.garbageLifetime; at the ctor seed site.
3. All sizes decay: remove the pieces===1 gate so every piece runs: this.decay -= dt; if (this.decay <= 0) this.dead = true;
4. Merge resets the clock: in the merge branch, after the survivor a absorbs b, add a.decay = DEBUG.garbageLifetime;
5. Clump expiry tell: mirror the single's (this.decay < GARBAGE_FADE) blink in the pieces>1 draw branch.

Leave the GARBAGE_DECAY const in place as the documented shipped value. The coalesced-Hunter transform is unaffected (it kills a and spawns a Hunter before decay matters).

Test: scratchpad/test-cs015-p6.js. node --check. A clump (pieces>1) now ages out after DEBUG.garbageLifetime (it never did before); a merge resets the survivor's decay to full; a single still dies on schedule and blinks in its last GARBAGE_FADE; changing the knob changes new-spawn lifetime; a clump that keeps merging (one shy of the Hunter threshold) never dies while a stalled one does; headless draw() no-throw for a decaying clump. Full regression.

Docs: GDD §2.10.1 (rewrite the decay rule: all sizes, merge-resets, lifetime is a dev knob; note the 22→10 default change); Architecture Map Constants/Entity; version history; STATUS.md (call out FLAG-CS015-a).

VERSION: only if you are NOT running P7 this round (voice lab not done), ALSO bump GAME_VERSION "1.0.0.13" → "1.0.0.15" here and grep scratchpad/ for the old literal and bump it too, then add that to this commit message. If P7 is coming, leave the version alone (P7 carries it).

Commit on main, do NOT push:
CS015 P6: garbage of any size ages out on a tunable lifetime (merge resets the clock); add Garbage Lifetime debug knob (default 10s — was 22s single-only)
```

**Commit:** `CS015 P6: garbage of any size ages out on a tunable lifetime (merge resets the clock); add Garbage Lifetime debug knob (default 10s — was 22s single-only)`

**Docs:** GDD §2.10.1 (rewrite the decay rule: all sizes, merge-resets, lifetime is a
dev knob; note the 22→10 default change); Architecture Map Constants/Entity rows;
version history; `STATUS.md` (call out FLAG-CS015-a explicitly for future readers).

> **⛔ STOP — do this before P7 (manual lab step, not a build session).**
> P7 is blocked until the voice phon is composed. When you finish P6:
> 1. Open **`tools/voice-robot-lab.html`** in a browser.
> 2. Compose the `phon` for each of the **five approved lines** (copy the text
>    verbatim): `Payload damaged.` · `Payload disrupted.` · `Payload scattered.` ·
>    `Bounty broke free.` · `Bounty lost.`
> 3. Confirm the lab reports **zero errors** for every line (`parsePhonTokens`).
> 4. If you added any dictionary entries in the lab, **commit the lab file first**
>    (design-instruments-first rule).
> 5. Copy the five verified `{text, phon}` pairs into your P7 build session.
>
> Only after all five phon strings are zero-err-verified does P7 run. If you're
> **not** doing the lab this round, tell Claude Code to carry the `GAME_VERSION` →
> **1.0.0.15** bump in **P6** instead (it normally rides P7 as the last landed
> phase), so the round still ships versioned — then run P7 as a later follow-up.

---

## Phase P7 — Chain-broken voice strings + version bump (item 6)

**GATED — strings locked, one precondition remains.** (a) Line set is **approved**
(FORK-CS015-D, below). (b) **Still required before this phase runs:** each approved
line's `phon` composed and **zero-err-verified** in `tools/voice-robot-lab.html`
(`parsePhonTokens`), brought here to paste **verbatim** — the voice engine/data
port-verbatim rule (CLAUDE.md VoiceSys non-negotiable) forbids hand-authoring `phon`
in the build. Do the lab pass, then run P7.

**Why item 6 exists.** The trigger is a **severed tow-haul**: `breakChain(i)` fires
when a chain node is destroyed and everything aft floats free (≈ L4546–4555,
`VoiceSys.say("chain_broken")`). Today's lines
(`"Junk is gone!"`, `"Lost my scrap!"`, `"Trash is loose!"`, `"There goes the garbage!"`,
`"There goes my junk!"`, ≈ L1589–1595) don't say **what** was lost or convey that it
was **worth points**. Captions default on, so the **text** is what the player reads —
clarity lands even before phon.

**Approved replacement set (locked — replaces the current five).** Register is
deliberately **functional/matter-of-fact**, not sarcastic — a flat status call for
this trigger (a conscious deviation from Dan's dryer lines elsewhere). "Payload"/
"Bounty" are chosen to signal the lost salvage was *worth points*, not trash:

1. `Payload damaged.`
2. `Payload disrupted.`
3. `Payload scattered.`
4. `Bounty broke free.`
5. `Bounty lost.`

**Replace** the current five with these (item 6 says the old ones are the problem).
Text is final; only the `phon` composition (lab step (b)) remains.

**Change (once the lab phon step (b) is done):**
1. Compose the `phon` for each of the five approved lines in
   `tools/voice-robot-lab.html`; verify zero errors; **commit the lab** first if any
   dictionary entries were added (design-instruments-first).
2. Replace `VOICE_LINES.chain_broken` (≈ L1589–1595) with the approved
   `{text, phon}` pairs, pasted verbatim. `VOICE_PRIORITY.chain_broken` unchanged.
   Lines-are-data — no engine/scheduler edit.
3. **Version bump (round's last phase, FLAG-CS015-g):** `GAME_VERSION`
   `"1.0.0.13"` → **`"1.0.0.15"`** (L243). Grep `scratchpad/` for the old literal
   and bump any hits (CS013 P4 found `test-cs010-p0.js`). If P7 is deferred past the
   rest of CS015, move this bump to whatever phase lands last.

**Test (`scratchpad/test-cs015-p7.js`):** `node --check`; assert every
`chain_broken` entry has non-empty `text` + `phon`; run each `phon` through the
build's `parsePhonTokens`/`buildUtterance` path and assert **zero** unknown tokens
(the same zero-err gate the lab enforces); `VoiceSys.say("chain_broken")` is
headless-safe (`!AudioSys.ctx` early-return); `GAME_VERSION === "1.0.0.15"` pin;
no-crash smoke.

**Model/effort:** **Sonnet 5 · high** for the paste + version bump (mechanical once
phon is verified). The lab composition is a separate manual/creative step — do it in
the lab, not in a build session. (Fable 5 · xhigh is fine if you prefer.)

**▶ Claude Code prompt — paste this ONLY after the lab phon is verified (model: Sonnet 5 · high; Fable 5 · xhigh is fine):**
```
CS015 Phase P7 (item 6): replace the chain-broken voice lines + bump version to 1.0.0.15. GATED — do not run until the five phon strings are composed and zero-err-verified in tools/voice-robot-lab.html.

First read STATUS.md and CLAUDE.md. ONE phase only.

Precondition: you should be pasting five verified {text, phon} pairs for exactly these lines:
  "Payload damaged."
  "Payload disrupted."
  "Payload scattered."
  "Bounty broke free."
  "Bounty lost."
If you do not have verified phon for all five, STOP and do the lab pass first. If the lab added any dictionary entries, that lab commit must already be on main.

Re-grep to confirm current lines:
- VOICE_LINES.chain_broken (the current five entries)
- VOICE_PRIORITY.chain_broken (leave unchanged)
- breakChain(i) → VoiceSys.say("chain_broken") (context only, no edit)
- GAME_VERSION (currently "1.0.0.13")
- grep scratchpad/ for the old version literal "1.0.0.13"

Change:
1. Replace VOICE_LINES.chain_broken with the five approved {text, phon} pairs, pasted VERBATIM from the lab. Do NOT hand-author or hand-edit phon. No engine/scheduler change (lines are data).
2. Bump GAME_VERSION "1.0.0.13" → "1.0.0.15" (.14 skipped: CS014 reverted, tag kept). Bump any matching literal found in scratchpad/.

Do NOT touch the VoiceSys engine.

Test: scratchpad/test-cs015-p7.js. node --check. Assert every chain_broken entry has non-empty text + phon; run each phon through the build's parsePhonTokens/buildUtterance path and assert ZERO unknown tokens; VoiceSys.say("chain_broken") is headless-safe (early-returns when !AudioSys.ctx); pin GAME_VERSION === "1.0.0.15". Full regression.

Docs: GDD §2.8/§2 voice-lines note (chain_broken set replaced); GDD top-of-file Current-build → CS015 / "1.0.0.15"; version history (a consolidated CS015 entry); STATUS.md → CS015 round complete.

Commit on main, do NOT push:
CS015 P7: clearer chain-broken voice lines (verbatim from voice-robot-lab); bump GAME_VERSION 1.0.0.13 -> 1.0.0.15 (CS014 reverted, .14 skipped)
```

**Commit:** `CS015 P7: clearer chain-broken voice lines (verbatim from voice-robot-lab); bump GAME_VERSION 1.0.0.13 -> 1.0.0.15 (CS014 reverted, .14 skipped)`

**Docs:** GDD §2.8/§2 voice-lines note (`chain_broken` set replaced); GDD top-of-file
Current-build → CS015 / `"1.0.0.15"`; version history (a consolidated CS015 entry);
`EXTERNAL-FILES.md` only if a new audio subresource shipped (it shouldn't — this is
data); `STATUS.md` → **CS015 round complete**.

---

## Testing & discipline (every phase)

- Read `STATUS.md` first; re-grep the phase's symbols; confirm shipped behavior
  before editing. Line numbers here are as-of-planning.
- Deliver the headless `scratchpad/test-cs015-p*.js` **with** the code (drive the
  **real** functions — never reimplement the logic under test); `node --check`
  clean; run the **full** regression each phase.
- `str_replace`, not full-file rewrites. Wrap-aware helpers (`dist2`/`shortDelta`)
  for any world-space math. Rendering via `drawPoly`/`glowStroke`/`drawRing*` — no
  new fills (GDD §3.2). Scoring via `addScore()` (the one sanctioned bypass is the
  auto-shield penalty). Don't touch invariant guards, the MusicSys scheduler, the
  VoiceSys engine, or the three frozen `localStorage` key **names**.
- Commit per phase on `main`; **don't push** (Paul's call).

## Suggested order & batching

P1 → P2 → P3 (independent, low-risk, ship first). Then **P4** (foundation).
Then **P5** and **P6** (need P4). **P7** last (gated on your string sign-off + lab
phon; hosts the version bump). If the lab isn't ready when the rest lands, run P7 as
a short follow-up and carry the version bump with it.