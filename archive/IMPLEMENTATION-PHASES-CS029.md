# IMPLEMENTATION-PHASES-CS029 — Orbital Overhaul

Companion to `PLANNED-FEATURES-CS029.md`. One phase per Claude Code session, one commit per
phase. The gate between P3 and P4 is **blocking**.

**Parent build:** `533365a` — record this SHA as `PARENT_SHA` in every new test file.

| Phase | Work | Model | Effort | Session notes |
|---|---|---|---|---|
| P1 | Rename | Sonnet | high | ⛔ **Full clone required** |
| P2 | Game-over exit | Sonnet | medium | |
| P3 | `tools/dock-float-lab.html` | Opus | high, `ultrathink` | |
| — | **PLAYTEST GATE** | — | — | Paul answers G1–G6 |
| P4 | Floater implementation | Sonnet | high | Gate answers required |
| P5 | Close | Sonnet | medium | Full clone; zero-skips assertion |

⛔ **All anchors below are ESTIMATES from build `533365a`. Line numbers drift. Re-grep by
symbol name before every edit.**

---

## P1 — RENAME

**Commit:** `cs-29 p1: rename asteroids-deluxe.html -> orbital-overhaul.html`

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS029.md §2 (and §0.2).

This phase renames the main game file and nothing else. No behaviour changes. No
opportunistic fixes — STATUS.md lists four carried maintenance items and none of them
belong in this commit.

⛔ WORK ON A FULL CLONE, NOT --depth 1. Ten suite files hard-fail on a shallow clone
(STATUS.md known issues) and you must be able to tell those apart from damage you cause.

STEP 0 — BASELINE. Run the full suite BEFORE touching anything. Record passed/failed
counts and the names of every failing file. You will match this exactly at the end.

STEP 1 — git mv asteroids-deluxe.html orbital-overhaul.html

STEP 2 — THE LANDMINE FIRST. scratchpad/_phase-ref.js's SCOPE_BASE array contains the
literal "asteroids-deluxe.html". That array is outsideScope()'s allowlist. If it keeps the
old name, every future phase reports the game file as an out-of-scope edit. Fix it now.

STEP 3 — Add to _phase-ref.js and export: GAME_FILE ("orbital-overhaul.html"),
GAME_FILE_LEGACY ("asteroids-deluxe.html"), and gameFileAt(ref) — which asks git which of
the two paths exists at that ref (git cat-file -e), returns null when history is
unavailable, and needs NO hardcoded rename SHA. Route parentSource() through it, since it
is the one helper that will be handed both pre- and post-rename SHAs from now on.

STEP 4 — THE 22 GIT-HISTORY SITES. Sort them into three groups; the treatments differ and
mixing them up produces pins that pass vacuously. PLANNED-FEATURES-CS029.md §2.3 has the
full table, but VERIFY THE LIST YOURSELF by grepping — the table is an estimate.

  (a) Reads HEAD (~5 sites) -> switch to the NEW name.
  (b) Reads a hardcoded PRE_*_REF literal (~16 sites) -> KEEP THE LEGACY NAME. Those
      commits predate the rename. Add this comment line at each one:
      // ⚠ SETTLED: legacy path is CORRECT here — this ref predates the CS029 rename. Do not "fix".
  (c) test-cs024-p6b.js's `git diff -U0 PRE_P6B_REF -- asteroids-deluxe.html` (~:635) —
      this range now SPANS the rename. Pass both paths as pathspecs.

  🚩 RUN test-cs024-p6b.js after that change. Do not assume rename detection preserves the
  -U0 hunk structure the pin depends on. IF IT FAILS: STOP, report, do not redesign the
  pin. That is Paul's call, not a session decision.

⛔ DO NOT refactor the ~21 call sites in (a)/(b) onto gameFileAt(). Tempting; out of scope.
The new constants are for new code.

STEP 5 — SWEEP. Rewrite the name in: the game file's own comments, scratchpad/ comments,
tools/*.html, CLAUDE.md, EXTERNAL-FILES.md, RATIONALE.md, ORBITAL-OVERHAUL-GDD.md,
STATUS.md. LEAVE archive/ AND log/ ALONE — they are dated records and rewriting them makes
them lie (FORK-CS029-A, resolved (a)).

STEP 6 — New pin scratchpad/test-cs029-p1.js, PARENT_SHA = 533365a:
  1. orbital-overhaul.html exists at root; asteroids-deluxe.html does not.
  2. git log --follow on the new path reaches pre-rename history.
  3. No live-path read of the legacy name survives: every remaining occurrence in
     scratchpad/*.js sits on a line that also names a *_REF / PRE_* identifier.
  4. SCOPE_BASE names the new file.
  5. gameFileAt() -> legacy for a pre-rename SHA, new for HEAD; SKIP_TAG loudly with no git.
  Git-dependent pins SKIP LOUDLY (SKIP_TAG) when history is unavailable — never silently.

STEP 7 — Full suite. Match the STEP 0 baseline exactly: same passes, same failures, no new
failures. Report both numbers side by side.

Do not commit until STEP 7 matches. Do not push — Paul pushes.
```

---

## P2 — GAME-OVER EXIT PATH

**Commit:** `cs-29 p2: ESC opens the menu at game over; single legible footer`

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS029.md §0.1 and §3.

Context you need before editing: the game-over menu ALREADY EXISTS. MENU_ROOT_OVER
(["Play Again","Options","Quit to Title"], ~L3124) has been there since CS013 P1 and
rootItems() (~L3198) serves it. This is not a feature build. Two things are wrong:
ESC is refused at game over, and the hint that says so is unreadable.

CHANGE 1 — the input guard, keydown handler (~L2987). Currently:
  if (bindings.pause.keys.includes(k) && game.state === "playing") openPause();
Admit gameover, with the same !game.entry belt-and-suspenders operand the neighbouring
confirm and "o" lines already carry.

VERIFY, EXPECTING NO CHANGE: openPause() (~L3837) already routes gameover to "root";
closePause() (~L3852) already returns to a clean gameover screen; menuRoot's "Quit to
Title" (~L4059) already works. If any of those actually needs an edit, something else is
wrong — report it, don't patch around it.

CHANGE 2 — the footer, gameover draw block (~L9629-9645). Delete BOTH existing lines: the
blinking 22px "PRESS ENTER TO PLAY AGAIN" and the 14px dim "MENU: O    (controller: B)".
Replace with ONE drawMenuHint footer.

This is exactly the CS016 P2 move applied to the one screen that never got it — read that
comment at the title branch (~L9553) before you write this, so the idiom matches.

New constants beside MENU_HINT_SIZE (~L3143):
  GAMEOVER_HINT      = "ENTER / A play again    ESC / B menu"
  GAMEOVER_HINT_SIZE = 20     // PLAYTEST KNOB (FORK-CS029-C)
  GAMEOVER_HINT_Y    = VIEW_H / 2 + 290
Wording follows TITLE_MENU_HINT (~L3142) exactly: keyboard/controller pairs joined with
"/", four-space separators, lowercase verbs.

drawMenuHint (~L8781) gains a TRAILING OPTIONAL size parameter defaulted to MENU_HINT_SIZE
— the FloatText rise/life and CS012 P3 size precedent. All nine existing callers must stay
byte-identical.

20 rather than 16 is deliberate and recorded: on every other screen the footer is a
reminder under a visible menu; here it is the only affordance on screen. Comment it.

TESTS — scratchpad/test-cs029-p2.js, PARENT_SHA = <P1's commit SHA>:
  - pause binding admitted at "gameover", still refused at "title"
  - the !game.entry guard is present
  - neither retired literal survives in the source
  - drawMenuHint's default parameter leaves every pre-existing call site byte-identical

Full suite green (minus the known shallow-clone failures if you are shallow — prefer full).
Do not push.
```

---

## P3 — `tools/dock-float-lab.html`

**Commit:** `cs-29 p3: dock float lab — three delivery-floater models`

```
ultrathink

Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS029.md §4 IN FULL. Then read
tools/scoop-lab.html for the house conventions — canvas left, ~340px knob panel right,
file://-openable, no build step, no imports, no external deps.

This phase builds ONLY the tool. It does not touch orbital-overhaul.html. Paul plays the
lab and picks a model; P4 implements what he picks.

WHY THIS EXISTS. The shipped delivery floaters overlap unreadably. Two independent causes,
and the lab must make both visible:
  1. The origin MOVES — CS026 P6 put both delivery branches at a ship-relative origin
     (see the DELIVERY_FLOAT_DY comment, ~L646). A drifting ship smears the column.
  2. Spacing is TIME-BASED — separation is rise x interval and nothing else. At the
     shipped 160 px/s and 0.05s that is 8px between 16px glyphs. Overlap is arithmetic.

WHAT IT SIMULATES. A dock visit: a static octagonal dock at canvas centre, canisters
peeling off at DOCK_OFFLOAD_INTERVAL, each spawning a +points floater. Point values MUST
vary in width (+50 through +1,440) — a column of same-width numbers hides the very defect
being diagnosed. Also draw the two STATIONARY dock floaters, SALVAGE BONUS (canister 8)
and MAX HAUL (canister 12/24), at their real dock.y - 22 — they don't move by design, and
judging the number column without them is judging half the composition.

THE ANCHOR. anchorFrac slider 0 -> 1.5, applied as y = dock.y - DOCK_RADIUS * anchorFrac
(DOCK_RADIUS = 88). Default 0.5 — Paul's "50% between the centre of the dock and the top".
Plus an `anchor: dock / ship (today)` toggle with an adjustable ship drift, so the current
shipped behaviour can be seen next to the fix.

THE THREE MODELS:
  A — dock-anchored, timing-spaced. Today's mechanism, origin moved. The control.
  B — dock-anchored SLOT COLUMN. A new floater is born at the anchor UNLESS the previous
      delivery floater is still within minGap of it, in which case it is born at
      prevFloater.y - minGap. All rise at the same rate, so the gap survives for life.
      Overlap becomes impossible by construction at any cadence. minGap slider 8->40,
      default 20.
  C — ACCUMULATING TICKER. One floater at the anchor, text rewritten to the running visit
      total as each canister lands. RELEASE TRIGGER: THE LAST CANISTER OF THE VISIT (Paul's
      answer, not grace-expiry). On release it becomes an ordinary rising floater with its
      own life.

KNOBS: model, anchorFrac, rise, life, minGap (B only), interval, canisterCount (1-24),
shipDrift (ship mode only), timeScale down to 0.1x. Buttons: replay, pause/step.

INSTRUMENTATION — this is the reason it is a tool and not three screenshots. Show the
MINIMUM vertical separation observed between any two live floaters this run, in px, held
as a run-minimum, turning red when it drops below the glyph height. Paul needs to read the
failure as a number.

FOOTER: a copy-paste block of the current knob values in constant form, so the gate answer
transfers into P4 without transcription.

⛔ NO NEW DESIGN BEYOND THIS SPEC. If something here is underspecified, implement your best
reading and FLAG it in the commit message — do not invent a fourth model or change a
model's semantics.

Do not push.
```

---

## GATE — BLOCKING

Paul plays `tools/dock-float-lab.html` and answers. **P4 does not open until these exist.**
Numbers, not yes/no, wherever a slider is involved.

- **G1** model — A / B / C
- **G2** `anchorFrac` — 0 to 1.5
- **G3** `rise` px/s, `life` s
- **G4** `minGap` px (B only)
- **G5** `DOCK_OFFLOAD_INTERVAL` — stays 0.05, or a number
- **G6** `GAMEOVER_HINT_SIZE` — 20, or a number

---

## P4 — FLOATER IMPLEMENTATION

**Commit:** `cs-29 p4: delivery floaters spawn from the dock anchor (model <X>)`

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS029.md §6.

GATE ANSWERS: model=<G1> anchorFrac=<G2> rise=<G3a> life=<G3b> minGap=<G4>
              DOCK_OFFLOAD_INTERVAL=<G5>
If any of these is missing, STOP and ask. Do not pick one.

THE ORIGIN MOVE (all models). Both delivery branches — towed (~L8432) and incidental
(~L8454) — currently spawn at game.ship.x, game.ship.y - DELIVERY_FLOAT_DY. Both move to
the dock anchor, y = dock.y - DOCK_RADIUS * anchorFrac. THEY MUST SHARE ONE ORIGIN
EXPRESSION — two copies will drift apart. The dock is genuinely static (Dock.update(),
~L5924, only advances spin), which is the whole property Paul asked for.

MODEL B: track the previous delivery floater BY REFERENCE and read its CURRENT y at spawn
time — derived, not stored. Do NOT keep a separate column-height counter; that is a second
source of truth that desyncs the moment a floater dies early. Clear the reference when the
floater dies or the visit ends.

MODEL C: one live ticker per visit, held by reference, text rewritten per canister,
released at the last canister. ⛔ The incidental branch (+DOCK_BASE_SCORE, size 12,
COLOR.dim, ~L8454) MUST NOT be folded into the ticker — CS026 separated the two on purpose
so an incidental never shares a tally with a towed canister.

REGISTRY. New knobs change DEBUG_ENTRIES.length. Update scratchpad/test-registry.js:21
(registryEntries: 85) and STATUS.md's header. 🚩 READ THE COUNT OFF THE LIVE BUILD — the
prediction in the planning doc has historically undercounted. Do not trust 85 + n.

COMMENT DEBT — MANDATORY, and not optional cleanup. Two blocks assert things this phase
makes false. REWRITE BOTH to say what is now true and why it changed. Do not delete them:
  - DELIVERY_FLOAT_DY (~L646-651) — the "closer to the ship" rationale from the CS026 P6
    gate. That was a misreading of Paul's intent; the record of the misreading is worth
    keeping, the false conclusion is not.
  - DEBUG.deliveryFloatRise's ⛔ ACCEPTED CONSEQUENCE block (~L3399-3406) — the 8px
    arithmetic and the "DOCK_OFFLOAD_INTERVAL is the lever, NOT a bigger rise" instruction.
    Under B and C that instruction is obsolete.
Deleting them loses a decision made twice. Rewriting them stops the third rediscovery.

TESTS — scratchpad/test-cs029-p4.js, PARENT_SHA = <P3's commit SHA>. Drive the REAL
delivery path (startGame / update(1/60)), not a reimplementation:
  - both branches spawn at the dock anchor, never at ship coordinates
  - model B: assert NO two live delivery floaters are ever closer than minGap, across a
    full 24-canister visit, at the shipped interval
  - model C: exactly one live ticker during a visit; released on the last canister
  - the incidental branch keeps its own size/colour and its own tally
  - registry count matches the live build

Full suite green. Do not push.
```

---

## P5 — CLOSE

**Commit:** `cs-29 p5: closing phase — gate answers applied, version 1.0.0.29, doc sweep`

```
Read CLAUDE.md, then STATUS.md, then PLANNED-FEATURES-CS029.md §7.

⛔ FULL CLONE — this phase asserts the suite runs with ZERO SKIPS, which is impossible to
verify on a shallow one.

1. Apply any gate answers not yet in the build (G5, G6 in particular).

2. THE NAME. One canonical name: "Orbital Overhaul". Not "Asteroids Deluxe: Orbital
   Overhaul", not "Asteroid Field Deluxe". The GitHub repo keeps ADD-Orbital-Overhaul —
   that is a URL, not the game's name.
   - CLAUDE.md header (currently "# CLAUDE.md — Asteroid Field Deluxe (ADD-Orbital-Overhaul)")
   - ORBITAL-OVERHAUL-GDD.md, EXTERNAL-FILES.md, RATIONALE.md, STATUS.md
   - grep the whole repo (excluding archive/ and log/) for both wrong names and fix them

3. GAME_VERSION (~L453) -> "1.0.0.29".

4. STATUS.md: version, changeset CS029 (closed), registry (LIVE COUNT), levers. Roll the
   window — CS026 moves to archive/STATUS-HISTORY.md. ⛔ Never two entries on one physical
   line (the shell-append trailing-newline trap).

5. log/CS029.md — the narrative log, including the CS026-P6-misinterpretation story from
   PLANNED-FEATURES-CS029.md §0.3. That is the part worth remembering.

6. Add to CLAUDE.md, permanently:
   - the canonical name
   - the sweep boundary: archive/ and log/ keep the old filename on purpose
   - ⚠ SETTLED: legacy filenames inside historical test pins are CORRECT, not misses

7. Archive PLANNED-FEATURES-CS029.md and IMPLEMENTATION-PHASES-CS029.md.

8. GDD §2 describes SHIPPED behaviour only. The floater change ships, so it belongs. Nothing
   from §10's CS030-033 preview enters the GDD.

9. Full suite, FULL CLONE, ZERO SKIPS. Assert it and print the count.

Do not push — Paul pushes.
```

---

## CORRECTIONS CARRIED INTO THESE PROMPTS

1. The claim that game over lacks a menu was wrong; P2 is scoped as a legibility fix
   (§0.1).
2. The git-history site count was under-measured 3× — 22 sites, three different treatments
   (§0.2, §2.3).
3. CS026 P6's recorded gate answer is historically accurate and is being superseded, not
   erased (§0.3, P4 comment-debt step).