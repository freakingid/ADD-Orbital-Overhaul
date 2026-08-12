# PLANNED-FEATURES-CS029 — Orbital Overhaul

**Parent build:** `533365a` (CS028 closed, v1.0.0.28, registry 85, levers 18)
**Target version:** 1.0.0.29
**Phases:** P1 rename · P2 game-over exit · P3 float lab · **GATE** · P4 floater implementation · P5 close

Three jobs, deliberately kept in one changeset because none of them touches persistence,
difficulty, or the sim: a file rename, a readability fix at game over, and the delivery
floater column. Everything in Paul's CS029 notes that *does* touch persistence — profiles,
save slots, online leaderboards, the achievement celebration panel — is out of scope here
and previewed in §10.

---

## §0 CORRECTIONS

Three claims from the CS029 planning session were wrong or under-measured. They are recorded
here because two of them changed the shape of a phase.

**§0.1 — "The game-over screen has no menu."** Wrong. `MENU_ROOT_OVER`
(`["Play Again", "Options", "Quit to Title"]`, ~L3124) has existed since CS013 P1,
`rootItems()` (~L3198) serves it, and the game-over draw block already prints
`"MENU: O    (controller: B)"`. The defect is not a missing feature. It is that the hint is
14px, dim gold, static, sitting 48px off the bottom edge, directly beneath a **22px blinking**
neighbour — and it names `O`, which no player guesses. Paul played the screen and reported
seeing only one option. That is a legibility failure, and P2 is scoped as one, not as a
feature build.

**§0.2 — "One functional path read plus seven `git show` sites."** Under-measured by 3×. The
live count is **22 git-history sites across 18 files**, plus `_phase-ref.js`'s own
`parentSource()`, plus one `git diff` *pathspec* site. §2.3 enumerates them. The rename phase
is bigger than advertised, though still mechanical.

**§0.3 — CS026 P6's gate record is accurate and now superseded.** The comment at
`DELIVERY_FLOAT_DY` (~L646) records Paul's CS026 gate answer as *"it needs to be closer to the
ship"*, and both delivery branches were moved to a ship-relative origin on that basis. Paul's
actual intent was a **static anchor at the dock**, and the CS026 reading was a
misinterpretation. The historical record stays (it is what was said); the ⛔ comment block it
justifies at `DEBUG.deliveryFloatRise` (~L3399–3406) becomes false the moment P4 lands and
**must be rewritten, not deleted** — see §6.5.

---

## §1 SCOPE

**In:** the rename; the canonical-name settling; the game-over exit path; a new authoring tool
for the delivery floater column; the floater implementation Paul picks at the gate.

**Out, explicitly:** profiles, save/load, online leaderboards, the achievement celebration
panel (all CS030–CS033, §10). Also out: the four carried maintenance items in `STATUS.md`
(FLAG-CS027-c world-dimension hardcodes, FLAG-CS027-d `execSource()` migration, the ten
shallow-clone hard-failers, the `localStorage` browser round-trip). **Do not opportunistically
fix them here** — P1 already moves 100+ files and a second mechanical sweep riding along would
make its diff unreviewable.

---

## §2 P1 — THE RENAME

`asteroids-deluxe.html` → `orbital-overhaul.html`. Use `git mv` so history follows the file.

### §2.1 Why this is safe for players

The website publishes the game at `coinlessgames/public/play/orbital-overhaul/index.html` —
the source filename never appears in a public URL. **No bookmark, link, or embed breaks.** This
rename is entirely internal to the repo.

### §2.2 The landmine — read this before anything else

⛔ **`scratchpad/_phase-ref.js`'s `SCOPE_BASE` array contains the literal
`"asteroids-deluxe.html"`.** That array is the allowlist `outsideScope()` uses to answer
"did this phase touch anything it shouldn't have?". If the rename misses it, **every
subsequent phase in every future changeset reports the game file itself as an out-of-scope
edit** — a failure that looks like a scope violation and is actually a stale string. Update it
in the same commit.

### §2.3 The 22 git-history sites — three different treatments

These are not interchangeable. Sorting them wrong produces pins that pass vacuously or fail
inexplicably.

**(a) Sites reading `HEAD` — switch to the NEW name (5 sites).**
After the rename commit, `HEAD` carries the new path. These always run against current HEAD.

| File | Line (est.) |
|---|---|
| `test-cs010-p1.js` | 32 |
| `test-cs010-p2.js` | 37 |
| `test-cs023-p3.js` | 175 |
| `test-cs024-p6.js` | 855 |
| `test-cs025-p4.js` | 50 |

**(b) Sites reading a hardcoded historical SHA — KEEP the legacy name (16 sites).**
Every `PRE_*_REF` literal in the suite predates this rename, so at those commits the file
*is* `asteroids-deluxe.html`. Changing them breaks the pin.

`test-cs017-p6.js` (×2), `test-cs019-p1.js`, `test-cs020-p1.js`, `test-cs020-p1b.js`,
`test-cs023-p2.js`, `test-cs023-p3.js` (:162, :648), `test-cs024-p1.js`, `-p2.js`, `-p4.js`,
`-p6b.js` (:175), `-p6c.js`, `-p6d.js`, `-p6e.js`, `-p6f.js`.

⚠ **SETTLED — mark each one.** Add a single comment line at each site:

```js
// ⚠ SETTLED: legacy path is CORRECT here — this ref predates the CS029 rename. Do not "fix".
```

Without that marker a future session will read these as sixteen missed renames and helpfully
break them all.

**(c) The pathspec site — `test-cs024-p6b.js:635` (est.).**

```js
execFileSync("git", ["diff", "-U0", PRE_P6B_REF, "--", "asteroids-deluxe.html"], ...)
```

This diffs a **pre-rename ref against the working tree**, so the range now *spans* the rename.
Pass both paths (`"--", "asteroids-deluxe.html", "orbital-overhaul.html"`) and rely on git's
default rename detection to keep the hunk structure intact.

🚩 **FLAG-CS029-a — DO NOT ASSUME THIS WORKS. RUN IT.** If rename detection does not fire, the
diff degrades to whole-file-delete plus whole-file-add and the `-U0` hunk analysis this pin is
built on becomes meaningless. **If the pin fails after the change, STOP and report — do not
redesign the pin in-session** (no design during implementation). A `-M` flag or a
two-diff-and-splice approach are both plausible repairs, and both are Paul's call.

### §2.4 `parentSource()` needs a two-name fallback — and it is the ONLY place that does

`_phase-ref.js`'s `parentSource(sha)` is the shared helper. From CS029 onward it will be handed
both pre-rename SHAs (existing pins) and post-rename SHAs (every future changeset). It is the
one function that genuinely cannot know which name applies. Add, in `_phase-ref.js`:

```js
const GAME_FILE        = "orbital-overhaul.html";
const GAME_FILE_LEGACY = "asteroids-deluxe.html";   // pre-CS029 history only

// Which path the game file lives at in a given ref. Asks git rather than comparing SHAs, so it
// needs no rename-commit literal and cannot go stale. Returns null when history is unavailable.
function gameFileAt(ref) { /* git cat-file -e ref:GAME_FILE, else LEGACY, else null */ }
```

Export both constants and `gameFileAt`. Route `parentSource()` through it.

⛔ **DO NOT refactor the 21 call sites in §2.3 to use the new helper.** That is a plausible
tidy-up and it is out of scope: it would turn a mechanical rename into an 18-file behavioural
refactor in a single session. The constants exist for *new* code.

### §2.5 Sweep scope — what gets rewritten and what does not

**FORK-CS029-A — resolved (a), best-guess, flagged for Paul.**

- **Rewrite:** the game file's own comments, `scratchpad/` comments, `tools/*.html`,
  `CLAUDE.md`, `EXTERNAL-FILES.md`, `RATIONALE.md`, `ORBITAL-OVERHAUL-GDD.md`, `STATUS.md`.
- **Leave alone:** `archive/` and `log/`. These are dated records of what was true when they
  were written; rewriting them makes them lie. A future reader who greps `archive/` and finds
  the old name should understand it as history, not as a miss.

The one-line explanation of that boundary belongs in `CLAUDE.md`, not scattered through
`archive/`.

### §2.6 Verification

⛔ **Run P1 on a FULL clone, not `--depth 1`.** Ten suite files (see `STATUS.md` known issues)
hard-fail on a shallow clone, and you will not be able to tell those pre-existing failures from
damage the rename caused. Baseline first: run the suite *before* the rename, record
passed/failed, then match it after.

New pin `scratchpad/test-cs029-p1.js`:

1. `orbital-overhaul.html` exists at repo root; `asteroids-deluxe.html` does not.
2. `git log --follow` on the new path reaches pre-rename history (the `git mv` worked).
3. No **live-path** read of the legacy name survives — every remaining occurrence in
   `scratchpad/*.js` is on a line that also mentions a `*_REF`/`PRE_*` identifier.
4. `SCOPE_BASE` names the new file (§2.2).
5. `gameFileAt()` returns the legacy path for a pre-rename SHA and the new path for `HEAD`;
   skips loudly (`SKIP_TAG`) with no git history.

---

## §3 P2 — THE GAME-OVER EXIT PATH

### §3.1 The input fix

One guard, at the keydown handler (~L2987):

```js
if (bindings.pause.keys.includes(k) && game.state === "playing") openPause();
```

becomes

```js
if (bindings.pause.keys.includes(k) && (game.state === "playing" || game.state === "gameover")
    && !game.entry) openPause();
```

The `!game.entry` operand is belt-and-suspenders — the initials-entry block above already
early-returns — and matches the existing idiom on the neighbouring `confirm` and `"o"` lines.

**Verify, expect no change:** `openPause()` (~L3837) already routes game-over to `"root"`;
`closePause()` (~L3852) already returns to a clean game-over screen; `menuRoot`'s
`Quit to Title` (~L4059) already works. If any of these need edits, something else is wrong —
report it rather than patching.

### §3.2 The footer re-flow

Delete both existing lines (the blinking 22px `PRESS ENTER TO PLAY AGAIN` and the 14px
`MENU: O    (controller: B)`) and replace them with **one** footer.

**This is the CS016 P2 move, applied to the one screen that never got it.** CS016 P2 removed
the title screen's blinking `PRESS ENTER TO START` and its `OPTIONS / ACHIEVEMENTS: O` hint in
favour of a menu plus a single `drawMenuHint` footer. Game over kept the old two-line shape and
that is precisely the screen Paul can't read.

New constants beside `MENU_HINT_SIZE` (~L3143):

```js
const GAMEOVER_HINT      = "ENTER / A play again    ESC / B menu";
const GAMEOVER_HINT_SIZE = 20;              // PLAYTEST KNOB — see FORK-CS029-C
const GAMEOVER_HINT_Y    = VIEW_H / 2 + 290;
```

The wording follows `TITLE_MENU_HINT` exactly: keyboard/controller pairs joined with `/`,
four-space separators, lowercase verbs. Consistency across screens is the point.

`drawMenuHint` (~L8781) gains a trailing optional size:

```js
function drawMenuHint(text, cx, y, size = MENU_HINT_SIZE) { ... }
```

Trailing-and-optional is the established shape for this (FloatText's `rise`/`life`, CS012 P3's
`size`): all nine existing callers stay byte-identical.

**FORK-CS029-C — resolved 20, best-guess, gate lever.** 20 rather than the 16 every other
footer uses, because on every other screen the footer is a *reminder* under a visible menu,
while here it is the *only* affordance on screen. If 20 reads wrong at the gate, the knob is
`GAMEOVER_HINT_SIZE` — one number, no structural change.

### §3.3 Verification

`scratchpad/test-cs029-p2.js`: pause binding admitted at `gameover` and still refused at
`title`; the `!game.entry` guard present; both retired literals absent from the source;
`drawMenuHint`'s default parameter preserves every pre-existing call site byte-for-byte.

---

## §4 P3 — `tools/dock-float-lab.html`

A standalone authoring instrument, same conventions as `tools/scoop-lab.html` (canvas left,
340px knob panel right, `file://`-openable, no build step, no imports).

### §4.1 What it simulates

A dock visit. Static octagonal dock at canvas centre. Canisters peel off at
`DOCK_OFFLOAD_INTERVAL`, each spawning a `+points` floater. Values must **vary in width**
(`+50` through `+1,440`) — a column of same-width numbers hides exactly the overlap being
diagnosed.

It must also draw the two **stationary** dock floaters, `SALVAGE BONUS` (canister 8) and
`MAX HAUL` (canister 12/24), at their real `dock.y - 22`. They do not move by design, and
judging the number column without them means judging half the composition.

### §4.2 The anchor

`anchorFrac` slider, 0 → 1.5, applied as `y = dock.y - DOCK_RADIUS * anchorFrac`
(`DOCK_RADIUS` is 88). Paul's note proposed *"50% between the centre of the dock and the top"* —
that is `anchorFrac = 0.5`, i.e. 44px above centre. Default there.

Include an **`anchor: dock / ship (today)`** toggle. Ship mode drifts a mock ship at an
adjustable speed to reproduce the current shipped behaviour. This is the before/after: it is
worth being able to *see* that a moving origin is half the problem.

### §4.3 The three models

**A — dock-anchored, timing-spaced.** Today's mechanism with the origin moved. Separation is
`rise × interval` and nothing else. At the shipped 160 px/s and 0.05s that is **8px between
16px glyphs** — overlap is arithmetic, not bad luck. A is in the lab as the control, so the
other two are judged against a real baseline.

**B — dock-anchored slot column.** A new floater is born at the anchor *unless* the previous
delivery floater is still within `minGap` of it, in which case it is born at
`prevFloater.y - minGap`. All floaters rise at the same rate, so the gap is preserved for
life. **Overlap becomes impossible by construction, at any cadence.** `minGap` slider,
8 → 40px, default 20 (16px glyphs + 4px of air).

**C — accumulating ticker.** One floater at the anchor whose text is the running visit total,
rewritten as each canister lands. **Release trigger: last canister of the visit** (Paul, Q10).
On release it becomes an ordinary rising floater with its own life; the next visit starts a new
ticker. One object, no column, nothing to overlap — at the cost of the per-canister rhythm.

### §4.4 Knobs and instrumentation

Sliders: `model` (A/B/C), `anchorFrac`, `rise`, `life`, `minGap` (B only), `interval`,
`canisterCount` (1–24), `shipDrift` (ship-anchor mode only), `timeScale` (slow-mo down to 0.1×).
Buttons: replay, pause/step.

**Live readout — the whole reason this is a tool and not three screenshots:** the minimum
vertical separation observed between any two live floaters this run, in px, held as a
run-minimum, and turned red whenever it drops below the glyph height. Paul should be able to
read the failure as a number, not just squint at it.

Footer: a copy-paste block of the current knob values in constant form, so the gate answer
transfers to P4 without transcription.

---

## §5 THE GATE — BLOCKING

⛔ **P4 does not begin until Paul has played the lab and answered.** Answers as numbers, not
yes/no, wherever a slider is involved.

- **G1.** Model — `A`, `B`, or `C`.
- **G2.** `anchorFrac` — 0 to 1.5.
- **G3.** `rise` px/s, and `life` seconds.
- **G4.** `minGap` px (model B only).
- **G5.** Does `DOCK_OFFLOAD_INTERVAL` stay at 0.05? *Under B and C the answer is almost
  certainly yes* — CS026 traded separation against a slower dock visit, and both B and C
  dissolve that trade. Confirm rather than assume.
- **G6.** Game-over footer: `GAMEOVER_HINT_SIZE` 20 — keep, or a number.

---

## §6 P4 — IMPLEMENT THE CHOSEN MODEL

Anchors are estimates from build `533365a`. **Re-grep by symbol before editing.**

### §6.1 The origin move (all models)

Both delivery branches — the towed one (~L8432) and the incidental one (~L8454) — currently
spawn at `game.ship.x, game.ship.y - DELIVERY_FLOAT_DY`. Both move to the dock anchor. They
must share one origin expression; two copies will drift apart.

`DELIVERY_FLOAT_DY` (~L651) is replaced by an anchor derived from `DOCK_RADIUS` and the gate's
`anchorFrac`. The dock is genuinely static (`Dock.update()` at ~L5924 only advances `spin`), so
this is a fixed point for the whole visit — which is the entire property Paul asked for.

### §6.2 Model B specifics

Track the previous delivery floater by reference and read its **current** `y` at spawn time —
derived, not stored. Do not maintain a separate column-height counter; that is a second source
of truth that desynchronises the moment a floater dies early. Clear the reference when the
floater dies or the visit ends.

### §6.3 Model C specifics

One live ticker per visit, held by reference; its `text` is rewritten per canister. It becomes
an ordinary floater at the last canister. ⛔ The incidental branch (`+DOCK_BASE_SCORE`, size 12,
`COLOR.dim`, ~L8454) is deliberately distinct from the towed branch and **must not be folded
into the ticker** — CS026 separated them on purpose so an incidental never shares a tally with
a towed canister.

### §6.4 Registry

New knobs (`minGap` under B, or the anchor fraction if exposed) change
`DEBUG_ENTRIES.length`. `scratchpad/test-registry.js:21` (`registryEntries: 85`) and
`STATUS.md`'s header must both be updated.

🚩 **FLAG-CS029-b.** The registry-count prediction in these docs has historically undercounted.
**Read the number off the live build, do not trust 85 + n.**

### §6.5 Comment debt — mandatory

Two comment blocks assert things P4 makes false. Both must be **rewritten to say what is now
true and why it changed**, not silently deleted:

- `DELIVERY_FLOAT_DY` (~L646–651) — the "closer to the ship" rationale (§0.3).
- `DEBUG.deliveryFloatRise`'s ⛔ ACCEPTED CONSEQUENCE block (~L3399–3406) — the
  8px-separation arithmetic and the "`DOCK_OFFLOAD_INTERVAL` is the lever, NOT a bigger rise"
  instruction. Under B and C that instruction is obsolete.

Deleting them loses the record of a decision that was made twice. Rewriting them stops the
third rediscovery.

---

## §7 P5 — NAME SETTLING, DOC SWEEP, VERSION BUMP

**The one canonical name is `Orbital Overhaul`.** Not "Asteroids Deluxe: Orbital Overhaul",
not "Asteroid Field Deluxe". The GitHub repo keeps the name `ADD-Orbital-Overhaul` — that is a
URL, not the game's name, and renaming it buys nothing.

- `CLAUDE.md` header — currently `# CLAUDE.md — Asteroid Field Deluxe (ADD-Orbital-Overhaul)`.
- `ORBITAL-OVERHAUL-GDD.md`, `EXTERNAL-FILES.md`, `RATIONALE.md`, `STATUS.md`.
- `GAME_VERSION` (~L453) → `"1.0.0.29"`.
- `STATUS.md` header: version, changeset, registry, levers. Roll the window — CS026 out to
  `archive/STATUS-HISTORY.md`. ⛔ Never two entries on one physical line (the shell-append
  trailing-newline trap).
- `log/CS029.md`.
- Archive both planning docs.
- Add to `CLAUDE.md`: the canonical name, the `archive/`-and-`log/` sweep boundary (§2.5), and
  the ⚠ SETTLED note that legacy filenames in historical pins are correct.
- Assert the suite runs with **zero skips** on a full clone.

---

## §8 FORKS

| ID | Question | Resolution |
|---|---|---|
| FORK-CS029-A | Does the name sweep rewrite `archive/` and `log/`? | **(a) No** — best-guess, §2.5. Flagged. |
| FORK-CS029-B | Refactor all 21 history sites onto `gameFileAt()`? | **No** — helper lands in `_phase-ref.js` only, §2.4. |
| FORK-CS029-C | Game-over footer size. | **20**, gate lever G6, §3.2. |
| FORK-CS029-D | Floater model + numbers. | **Paul, at the gate.** §5. |
| FLAG-CS029-a | `test-cs024-p6b` pathspec across the rename. | Must be **run**, not assumed. STOP on failure. §2.3(c). |
| FLAG-CS029-b | Registry count after P4. | Read off the live build. §6.4. |

---

## §9 DEPENDENCY GRAPH

```
P1 rename ──► P2 game-over ──► P3 lab ──► [GATE] ──► P4 floaters ──► P5 close
     │                                                                  ▲
     └──────────────────── every later phase edits the renamed file ────┘
```

P1 is first so that every later phase, every anchor in these docs, and every commit message
speaks one filename. P2 and P3 are independent of each other and could swap; P4 cannot start
before the gate; P5 cannot start before P4.

---

## §10 WHAT COMES AFTER — not in this changeset

- **CS030 — achievement celebration panel.** Tiered emblem art (Paul, Q9), not 36 per-badge
  drawings. `Achievements.onUnlock()` (~L7011) is a single choke point, and the 2.5s
  `waveClearTimer` window (~L8726) is the natural place to hang the panel.
- **CS031 — profiles.** The three frozen `localStorage` keys get a profile layer *additively*;
  existing data migrates into a default profile rather than being re-keyed. Blocks CS032.
- **CS032 — save/load, 3 slots.** Wave-boundary resume first, full mid-run snapshot preserved
  as a later upgrade (Paul, Q8 = c). The save format is versioned from day one so (a) can land
  without a schema break.
- **CS033 — online leaderboard.** Cloudflare Worker + D1 (Paul, Q4 = a), **its own repo**, no
  game-file change in 033a. All eight rolling windows — one indexed `WHERE ts > ?`; the
  daily/weekly/monthly compromise was only ever needed to fit a canned service. 12-character
  names, `A–Z 0–9 space - _`, uppercase-normalised, server-side profanity rejection at submit
  with a client-side pre-check. Payload: score, wave, duration, canisters delivered, UFO kills,
  Hunter kills, Garbage Satellite kills. ⛔ `EXTERNAL-FILES.md`'s `file://` contract binds the
  client: a double-clicked build must degrade to "offline — local scores only", never hang.
  **Before CS033, move coinlessgames.com's DNS to Cloudflare and address the API as
  `scores.coinlessgames.com` from the first line of client code** — DNS is independent of
  Netlify hosting, and a `*.workers.dev` URL baked into a shipped build cannot be changed
  without re-releasing.