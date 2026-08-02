# IMPLEMENTATION PHASES — CS019

Spec: `PLANNED-FEATURES-CS019.md`. Base build: CS018 P10, `GAME_VERSION "1.0.0.18"`, commit `6928ff3`.
Target: `"1.0.0.19"`, bumped in **P2**.

**How to use this doc.** One Claude Code session per phase, one commit per phase.
Set the model with `/model` before pasting. Paste the phase's prompt verbatim.
Paul commits and pushes; Claude Code never pushes.

**Deliberate sequencing:** P1 ships the fix with **no version bump and no GDD
edit**, so it can go straight into Paul's hands for a playtest. P2 runs *after*
that playtest, folds in whatever `chainGuardCooldown` / `chainGuardIntercepts`
numbers the playtest found, and does the version + doc sweep. Don't run P2 until
the playtest is done — its whole value is carrying the tuned numbers.

**Line numbers below are estimates taken against commit `6928ff3` — they drift.
Every prompt instructs a re-grep by symbol before editing.**

---

## Fork ledger

| Fork | Resolution |
|---|---|
| **FORK-CS019-A** | ✅ **(a) per-hazard absorb cooldown.** No deflect, no destroy. |
| **FORK-CS019-B** | ✅ **(a) one charge per absorbed break EVENT.** Unchanged from CS017 intent. |
| **FLAG-CS019-a** | ✅ **`DEBUG_VAR`**, not a frozen const. `chainGuardCooldown`, def 0.75 s. |
| **FLAG-CS019-b** | ✅ **Defer.** `chainGuardIntercepts` default stays 3 through P1; retune in P2 from playtest. |
| **FLAG-CS019-c** | ✅ **Assert it.** Guard-down behaviour byte-identical, proven by test not inspection. |

---

## Pre-session preamble (paste **before** each phase prompt)

```
Session setup for CS019.

READ WHOLE, first, before any code:
  CLAUDE.md
  STATUS.md
  PLANNED-FEATURES-CS019.md
  IMPLEMENTATION-PHASES-CS019.md

GREP ONLY, never read whole (it is ~7,600 lines):
  asteroids-deluxe.html

DO NOT READ AT ALL this session:
  GDD-VERSION-HISTORY.md
  archive/
  PLANNED-FEATURES-CS018.md
  IMPLEMENTATION-PHASES-CS018.md
  DIFFICULTY-LEVERS.md
  tools/

Line numbers in the planning docs are ESTIMATES from a planning pass against
commit 6928ff3. Re-grep every anchor by symbol name before you edit it.
```

---

# P1 — The absorb-repeat fix

**Model:** Opus 4.8, **xhigh**, thinking on. **Player-visible:** yes.
**Version bump:** NO.

Small diff, high trap density: a signature change on a function whose call-site
count is asserted by an existing test, plus a new per-frame skip in a collision
scan. Worth the reasoning budget.

### Anchors (re-grep by symbol)

| Symbol | Est. | Note |
|---|---|---|
| `{ header: "CHAIN GUARD" }` | ~L2658 | `DEBUG_VARS` group; the three existing knobs follow it |
| `class DebrisSatellite` | ~L4083 | ctor ends after the `this.art = polys.map(...)` block |
| `DebrisSatellite`'s `update(dt)` | ~L4115 | 4 lines: move, spin, `wrap(this)` |
| `class HunterSatellite` | ~L4132 | ctor ends after the `this.inner = …` ternary |
| `HunterSatellite`'s `update(dt)` | ~L4193 | starts `if (this.homing) {` |
| `function breakChain` | ~L5823 | the guard branch is the first statement after `const hit` |
| `// hostile bullet vs tow chain` | ~L6354 | call site 1 — `b.dead = true; breakChain(i); break;` |
| `chainScan:` | ~L6408 | call site 2 — the labelled hazards-vs-chain double loop |

### Paste-ready prompt

```
Implement CS019 Phase 1 per IMPLEMENTATION-PHASES-CS019.md P1, spec
PLANNED-FEATURES-CS019.md §1–§2 with FORK-CS019-A resolved to (a) and
FORK-CS019-B resolved to (a). Re-grep every anchor by symbol before editing —
the line numbers in the docs are estimates and drift.

ultrathink

THE BUG, so you can verify the diagnosis yourself before you touch anything:
breakChain(i)'s chain-guard branch returns WITHOUT removing node i. That is
correct behaviour and also the bug. In the unguarded path the node is destroyed,
so an overlapping hazard stops overlapping and the contact self-terminates. In
the guarded path the node survives in place, still inside h.radius + 7, so the
hazards-vs-chain scan re-fires breakChain(i) on the very next frame and every
frame after — each one a full absorb: one budget decrement, seven particles, a
FloatText, a shieldPing. Default chainGuardIntercepts is 3, so a single large
debris grazing the tow burns the whole budget in three frames (~0.05 s) and then
severs the chain normally on frame four. Confirm this by reading the two call
sites before you change anything, and say in your report whether you agree.

THE FIX, in one sentence: a hazard that has already paid for a contact may not
present that same contact again while the guard holds.

(1) DEBUG_VARS — append ONE entry inside the existing { header: "CHAIN GUARD" }
    group, after chainGuardMinTow:
      { id: "chainGuardCooldown", label: "Chain guard cooldown", unit: "s",
        def: 0.75, min: 0.1, max: 3, step: 0.05 }
    No toNative (display = native), matching its three siblings. The registry
    entry IS the source of truth for the default — do NOT also add a const.
    NOTE: step 0.05 is the first sub-1.0 step in the registry. VERIFY the panel's
    increment/decrement and typed-entry paths actually handle a fractional step
    (grep DEBUG_ENTRY_MAXLEN and the panel's step arithmetic). If they don't,
    STOP and report — do not silently round the step to 1 or reshape the knob.

(2) Per-hazard cooldown field on the two body-hazard classes ONLY:
    - DebrisSatellite ctor: this.guardT = 0;
    - HunterSatellite ctor: this.guardT = 0;
    - each class's existing update(dt): if (this.guardT > 0) this.guardT -= dt;
    Bullet gets NOTHING — a bullet is marked dead before breakChain is called and
    filtered at end of frame, so it can never re-present. That asymmetry is the
    whole shape of this fix; do not "for consistency" add guardT to Bullet.
    Comment both fields as CS019 with a one-line why.

(3) breakChain gains an optional source parameter:
      function breakChain(i, src = null)
    The `= null` default is LOAD-BEARING: scratchpad/test-cs017-p6.js calls
    C.breakChain(4) / D.breakChain(6) / S.breakChain(6) with one argument,
    including a `while (S.powerActive("guard")) S.breakChain(6)` drain loop.
    Those must keep their current behaviour (absorb, spend once) untouched.
    Inside the existing guard branch, AFTER the spend and AFTER the tell, add:
      if (src) src.guardT = DEBUG.chainGuardCooldown;
    Change NOTHING else in that branch. The budget decrement stays exactly
    `- 1` per absorbed break (FORK-CS019-B (a)) — one charge per EVENT, not per
    severed node.

(4) The hazards-vs-chain scan (the `chainScan:` labelled double loop). In the
    INNER hazard loop, immediately after the `if (h.dead) continue;` line:
      if (h.guardT > 0 && powerActive("guard")) continue;
    Two things about this line, both required, both testable:
    - It goes in the SCAN, not inside breakChain. The scan `break chainScan`s on
      the first overlapping pair it finds; if the cooldown test lived in
      breakChain, a stamped hazard on node 0 would consume the scan's one slot
      every frame and hide a DIFFERENT, unstamped hazard genuinely hitting node 5
      for the whole cooldown window. Test (E) below pins this.
    - The `&& powerActive("guard")` clause is NOT redundant. If the guard expires
      mid-contact — clock runs out, or the budget is spent on another hazard — a
      stamped hazard must sever the chain on the very next frame. Without the
      clause a stale stamp grants free passage through an UNPROTECTED chain.
      Test (G) pins this.

(5) Both call sites pass their source:
      hostile-bullet-vs-chain:  breakChain(i, b);
      hazards-vs-chain scan:    breakChain(i, h);

TRAP 1 — breakChain call-site count. scratchpad/test-cs017-p6.js §A asserts
breakChain has exactly TWO call sites by regexing the literal substring
`breakChain(` out of the shipped <script> source, minus `function breakChain(`.
CS017 P7 already tripped this once with a doc COMMENT containing `breakChain(i)`.
Your new comments must not contain the substring `breakChain(` with an open
paren. Write "breakChain" or "the top of breakChain" instead. Run that test file
specifically before you consider the phase done.

TRAP 2 — this phase does NOT bump GAME_VERSION and does NOT touch
ORBITAL-OVERHAUL-GDD.md or DIFFICULTY-LEVERS.md. P2 owns both, after Paul
playtests. Five CS018-phase tests assert GAME_VERSION is "unchanged this phase";
they must stay green.

TRAP 3 — do not change chainGuardIntercepts' default, min, or max. It stays
def 3 / min 1 / max 10 this phase, deliberately: retuning the budget in the same
phase that changes what a budget unit means would confound Paul's playtest.

TESTS — new scratchpad/test-cs019-p1.js, driving the REAL startGame() /
update(1/60) / breakChain / applyPowerup. Nothing under test reimplemented.

(A) node --check. Source pins: exactly ONE `function breakChain` definition and
    exactly TWO call sites under test-cs017-p6.js §A's own regex; the
    chainGuardCooldown registry entry with its exact def/min/max/step and no
    shadowing const; both call sites pass a second argument; Bullet has no
    guardT.
(B) THE REGRESSION, and the reason this changeset exists. Count mode,
    chainGuardIntercepts = 3. Stage a large DebrisSatellite STATIONARY and
    overlapping a mid-chain node, guard up, drive 60 real update(1/60) frames.
    Assert powerBudget.guard === 2 (exactly ONE spent), chain length unchanged,
    and exactly ONE "GUARDED" floater across all 60 frames.
    BEFORE you write the fix, write this test and run it against the CURRENT
    build to confirm it fails (it should read 0 by frame 4). A regression test
    that never saw red proves nothing. Report both numbers.
(C) Time mode, same staging, 60 frames: one tell total, chain intact throughout,
    powerFx.guard decremented only by dt.
(D) Cooldown expiry: same overlap, chainGuardCooldown = 0.2, intercepts = 10,
    60 frames. Assert the spend count is 5 ± 1 — assert a RANGE and say why in
    the message (frame quantisation), do not pin an exact integer.
(E) No shadowing: hazard H stamped on node 0, unstamped hazard K overlapping
    node 5 the same frame. K's hit is absorbed that frame, not swallowed by the
    break chainScan.
(F) FLAG-CS019-c: a full run with the guard never picked up produces an
    identical break under a shared seeded RNG — non-guard behaviour unchanged.
(G) Budget exhaustion mid-contact: intercepts = 1, stationary overlap. Frame 1
    absorbs and stamps; budget is now 0 so powerActive("guard") is false; frame 2
    must SEVER. Assert the chain breaks on frame 2 — the stamp must not outlive
    the guard.
(H) The bullet path untouched: a real hostile bullet on a mid-chain node with the
    guard up — exactly one absorb, one spend, b.dead === true, no second absorb.
(I) Headless smoke with AudioSys.ctx = null through
    startGame/update/draw/breakChain.

Run the FULL regression across every scratchpad/test-*.js file, not just the new
one and not just the ones you think are related. Report the file count and total
assertion count. If any pre-existing file fails, repoint it to its mirror-image
claim rather than weakening or deleting it, and say in STATUS.md what it used to
assert and why the new assertion is the same claim at the same strength.

Update STATUS.md. Commit; do NOT push.
```

### Commit message

```
CS019 P1: fix chain-guard absorb repeat on sustained hazard contact

The guard branch in breakChain returns without removing the node, so a
hazard overlapping the tow re-presented the same contact every frame —
burning the whole count-mode budget in ~3 frames and machine-gunning the
absorb tell in time mode. A hazard now carries a guardT cooldown stamp
set on absorb; the hazards-vs-chain scan skips a stamped hazard while
the guard is up, and only while it is up.

New DEBUG knob chainGuardCooldown (0.75 s). breakChain gains an optional
src parameter defaulting to null. No version bump; GDD and
DIFFICULTY-LEVERS deferred to P2 pending playtest.
```

---

## ⛔ PLAYTEST GATE — between P1 and P2

Do not start P2 until this is done. Its whole purpose is to carry the numbers.

Open the dev panel and answer three questions:

1. **`chainGuardCooldown`** — at 0.75 s, does a large debris tumbling through the
   tow cost exactly one charge and feel like one event? Try 0.3 and 1.5 against a
   homing small Hunter, which is the pathological case (it re-acquires and comes
   straight back). If a Hunter can still bill twice on what reads as one attack,
   the number is too low.
2. **`chainGuardIntercepts`** (FLAG-CS019-b) — 3 now buys three *real* blocked
   hits. Against a full 24-node haul, is that a powerup or a rounding error? The
   max is already 10; find the number in the panel rather than guessing.
3. **The tell** — with the machine-gun gone, is one 7-particle burst plus one
   "GUARDED" floater per contact still legible, or did the spam accidentally
   carry the readability? If it's too quiet, `GUARD_ABSORB_SPARKS` is a one-line
   knob and P2 can take it.

Write the three numbers into the P2 prompt below where marked, or say "no change"
for each.

---

# P2 — Retune, version bump, doc sweep

**Model:** Sonnet 5, high. **Player-visible:** yes (numbers only).
**Version bump:** YES → `"1.0.0.19"`.

Mechanical. No new logic.

### Anchors (re-grep by symbol)

| Symbol | Est. | Note |
|---|---|---|
| `GAME_VERSION` | ~L250 | `const GAME_VERSION = "1.0.0.18"` |
| `chainGuardIntercepts` | ~L2661 | `DEBUG_VARS` entry, if the playtest moved it |
| `chainGuardCooldown` | ~L2664 | added in P1, if the playtest moved it |
| `GUARD_ABSORB_SPARKS` | ~L356 | only if the playtest asked for it |
| GDD §2.14.2 | — | "The Chain Guard — a rule-changing timed effect" |
| GDD §2.19 | — | the `DEBUG_VARS` count, currently "9 to 12" era text; now 15 → 16 |

### Paste-ready prompt

```
Implement CS019 Phase 2 per IMPLEMENTATION-PHASES-CS019.md P2. This is the
closing phase of CS019: retune, version bump, doc sweep. No new logic.

PLAYTEST RESULTS — apply exactly these, no others:
  chainGuardCooldown   def -> [PAUL: number, or "no change"]
  chainGuardIntercepts def -> [PAUL: number, or "no change"]  (bump max too if the new def exceeds 10)
  GUARD_ABSORB_SPARKS  -> [PAUL: number, or "no change"]

(1) Apply the retune above. If a line says "no change", change nothing there —
    do not improve it on your own initiative.

(2) GAME_VERSION "1.0.0.18" -> "1.0.0.19". Then GREP THE WHOLE REPO for the
    literal "1.0.0.18" rather than trusting any file list — the CS016 P5 and
    CS017 P7 precedent is that the grep finds more live pins than the prompt
    names. As of planning, six files pin it: asteroids-deluxe.html plus
    test-cs010-p0.js, test-cs013-p4.js, test-cs015-p7.js, test-cs016-p5.js,
    test-cs017-p7.js, test-cs018-p10.js. Bump every LIVE pin — both the
    console.log label and the assert message string, not just the literal.
    LEAVE ALONE any HEADER COMMENT that describes what a past phase historically
    bumped to; those are narrative, not pins.

(3) The five CS018-phase tests (test-cs018-p1/p3/p4/p6/p7.js) assert GAME_VERSION
    is "unchanged this phase (bumps in P10)". That claim is now historically
    scoped and stale. Repoint them to the mirror-image claim — the version is no
    longer the one those phases shipped — rather than deleting the sections.
    Same for anything test-cs019-p1.js pinned as unchanged-this-phase.

(4) ORBITAL-OVERHAUL-GDD.md §2.14.2 (the Chain Guard section). Add the absorb
    cooldown to the mechanic description: an absorbed break stamps the SOURCE
    hazard for DEBUG.chainGuardCooldown seconds, and the hazards-vs-chain scan
    skips a stamped hazard while — and only while — the guard is up, so one
    sustained contact costs one charge instead of one per frame. Say explicitly
    that the count-mode unit is one absorbed break EVENT (which the section
    already claims and which is now actually true), that projectile breaks need
    no cooldown because a bullet dies on impact, and that guard-down behaviour is
    unchanged. Also update §2.19's DEBUG_VARS count: 15 -> 16.

(5) DIFFICULTY-LEVERS.md: check whether the chain guard appears in it at all
    (as of planning it does not). If it doesn't, leave the file untouched and say
    so — do not add a row for a defensive powerup that isn't a difficulty lever.

(6) Append a CS019 round-closing entry to GDD-VERSION-HISTORY.md — ONE entry
    covering P1+P2, per the CS012/CS013/CS015/CS016/CS017 precedent. This is the
    only file in the repo you may open specifically to append to; do not read it
    for context.

(7) Archive: move PLANNED-FEATURES-CS018.md and IMPLEMENTATION-PHASES-CS018.md
    into archive/. They have been sitting at root since CS018 closed. Leave the
    CS019 docs at root for whichever changeset opens next.

Run the FULL regression across every scratchpad/test-*.js file. Report file count
and total assertion count. Update STATUS.md. Commit; do NOT push.
```

### Commit message

```
CS019 P2: chain-guard retune, version 1.0.0.19, doc sweep

Playtest-tuned chainGuardCooldown / chainGuardIntercepts, GAME_VERSION
bump with the usual multi-file pin sweep, GDD §2.14.2 + §2.19 updated for
the absorb-cooldown mechanic, CS019 round entry appended to
GDD-VERSION-HISTORY.md, CS018 planning docs archived. Closes CS019.
```

---

## Model settings summary

| Phase | Model | Effort | Thinking | `ultrathink` in prompt |
|---|---|---|---|---|
| P1 | Opus 4.8 | xhigh | on | ✅ yes (already in the prompt text) |
| P2 | Sonnet 5 | high | — | no |

The `ultrathink` keyword is inside P1's prompt body, on its own line, where it
actually takes effect — not in a meta-note above it.