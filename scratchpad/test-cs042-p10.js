// Headless test for CS042 P10 — MENU NAVIGATION REPEAT (PLANNED-FEATURES-CS042.md §5).
//
//   node scratchpad/test-cs042-p10.js
//
// The mechanism: the keyboard's `if (e.repeat) return;` guard in the keydown listener's menu branch
// STAYS (browser auto-repeat is ~30/sec and once pinned the Music Track row's crossfade near-silent) —
// what changes is that the game now supplies its OWN repeat, at its own rate, from one shared timer
// (tickMenuRepeat, ticked in loop() beside handleGamepadMenu()) feeding the existing menuInput(). Up/
// down only; left/right and confirm/back/pause never repeat (Paul's explicit call). Keyboard held-state
// for the two repeating actions lives in a new menuKeys{} map (menuKeys{} must never write keys{}),
// cleared at every resetMenuNav() site so a direction held across a screen change can't repeat into
// whatever takes input next.
//
// The traps this file exists to pin: the FIRST move on a held direction is the existing edge-detected
// path, not tickMenuRepeat firing a phantom extra one; the first repeat waits the FULL delay, not the
// delay-minus-something; repeats land evenly spaced by rate afterward, immune to dt jitter (verified by
// counting real tick calls against the real DEBUG values, not against a hand-derived frame number);
// releasing stops it outright; left/right and confirm/back/pause structurally cannot repeat (menuKeys{}
// only ever tracks the four up/down key names, and menuHeldDir()'s return domain is {up, down, null}).

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260908);

const { mkAssert, buildGame, execSource, scriptSource } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq } = A;

const DT = 1 / 60;
const src = scriptSource();
const stripped = execSource(src);

// A build whose real keydown/keyup listeners can be driven — not a second sandbox, _harness.js's own
// listeners hook (CS036 P2).
function build() {
  const listeners = {};
  const X = buildGame({ listeners });
  X.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  X.keyup = key => {
    const e = { key };
    for (const fn of (listeners.keyup || [])) fn(e);
  };
  return X;
}

// Opens the pause ROOT menu (4 rows: Continue/Save/Options/Quit) on a live "playing" run — up/down
// cycle game.menu.index mod 4, so a repeat is trivially observable.
function openRoot(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false;
  X.openPause();
  return g;
}

// Ticks tickMenuRepeat up to maxFrames times, returning the 1-indexed tick number on which
// game.menu.index first changed, or -1 if it never did within the budget.
function ticksUntilChange(X, g, maxFrames) {
  const start = g.menu.index;
  for (let i = 1; i <= maxFrames; i++) {
    X.tickMenuRepeat(DT);
    if (g.menu.index !== start) return i;
  }
  return -1;
}

// ================= (A) shape: node --check; the kept guard; the loop() hookup =================
(function sectionA() {
  console.log("(A) node --check; the e.repeat guard survives with its rewritten comment; loop() hookup");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs042p10_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  assert(/if\s*\(e\.repeat\)\s*return;/.test(src),
    "A: the keydown listener's menu-branch `if (e.repeat) return;` guard is still present");
  assert(/not what this phase removes/.test(src),
    "A: the guard's comment records that the suppression stays and the game supplies its own rate");
  assert(/handleGamepadMenu\(\);\s*\n\s*tickMenuRepeat\(dt\);\s*\n\s*update\(dt\);/.test(stripped),
    "A: tickMenuRepeat(dt) is ticked once per frame in loop(), beside handleGamepadMenu(), before update()");
})();

// ================= (B) registry: two new rows, shape and defaults =================
(function sectionB() {
  console.log("(B) DEBUG_VARS: menuRepeatDelay/menuRepeatRate — shape and seeded defaults");
  const X = build();
  hasKnob(X, "menuRepeatDelay", { def: 0.40, min: 0.1, max: 1.5, step: 0.05 }, A);
  hasKnob(X, "menuRepeatRate", { def: 0.10, min: 0.03, max: 0.5, step: 0.01 }, A);
  eq(X.DEBUG.menuRepeatDelay, 0.40, "B: DEBUG.menuRepeatDelay seeded from its registry default");
  eq(X.DEBUG.menuRepeatRate, 0.10, "B: DEBUG.menuRepeatRate seeded from its registry default");
})();

// ================= (C) keyboard: fires once, then delay, then rate, evenly spaced =================
(function sectionC() {
  console.log("(C) held ArrowDown: one edge move, nothing until menuRepeatDelay, then menuRepeatRate apart");
  const X = build();
  const g = openRoot(X);
  eq(g.menu.index, 0, "C: root opens on row 0");

  X.keydown("ArrowDown", false);
  eq(g.menu.index, 1, "C: the initial keydown is the existing edge move — fires once, immediately");
  eq(X.menuKeys["arrowdown"], true, "C: menuKeys{} records the held key");

  // Nothing for a good while short of the delay (10 ticks < the ~26-tick first fire measured below).
  let idx = g.menu.index;
  for (let i = 0; i < 10; i++) X.tickMenuRepeat(DT);
  eq(g.menu.index, idx, "C: no repeat fires well short of menuRepeatDelay");

  // The FULL delay, not delay-minus-something: X.keydown() above already consumed 10 ticks of
  // "no fire" above; keep ticking and record exactly when the first repeat lands.
  const firstAt = 10 + ticksUntilChange(X, g, 60);
  assert(firstAt > 10, "C: a first repeat did land within budget");
  // +1: the tick immediately after the keydown only PRIMES the timer (dir null -> "down", t=0, no dt
  // accumulated yet, no fire) — accumulation starts on the tick after that. ±1 for dt/0.40 rounding.
  const expectedDelayTicks = Math.round(X.DEBUG.menuRepeatDelay / DT) + 1;
  assert(Math.abs(firstAt - expectedDelayTicks) <= 1,
    `C: first repeat lands ~menuRepeatDelay/DT ticks in (got ${firstAt}, want ~${expectedDelayTicks})`);
  eq(g.menu.index, 2, "C: the first repeat is one more step (row 1 -> 2)");

  // Repeats thereafter, spaced menuRepeatRate apart — collect several and check the gaps.
  const expectedRateTicks = Math.round(X.DEBUG.menuRepeatRate / DT);
  const gaps = [];
  for (let n = 0; n < 4; n++) gaps.push(ticksUntilChange(X, g, 30));
  for (const gap of gaps) {
    assert(gap > 0, "C: a subsequent repeat landed within budget");
    assert(Math.abs(gap - expectedRateTicks) <= 1,
      `C: repeats land menuRepeatRate/DT ticks apart (got ${gap}, want ~${expectedRateTicks})`);
  }

  // Releasing stops it outright.
  X.keyup("ArrowDown");
  eq(X.menuKeys["arrowdown"], false, "C: keyup clears menuKeys{}");
  const idxAtRelease = g.menu.index;
  for (let i = 0; i < 90; i++) X.tickMenuRepeat(DT);   // well past another delay+several rates
  eq(g.menu.index, idxAtRelease, "C: releasing the key stops the repeat outright");
})();

// ================= (D) left/right never repeat =================
(function sectionD() {
  console.log("(D) held ArrowLeft on a value row (Sound/SFX Volume): one nudge, never a repeat");
  const X = build();
  const g = openRoot(X);
  X.gotoScreen("sound");
  eq(X.SOUND_ROWS[g.menu.index], "SFX Volume", "D: Sound screen opens on the SFX Volume row");
  eq(X.AudioSys.vol.sfx, 1, "D: SFX volume starts at its shipped default (1.0), so a left nudge is visible");

  X.keydown("ArrowLeft", false);
  const volAfterOne = X.AudioSys.vol.sfx;
  eq(volAfterOne, 1 - X.VOL_STEP, "D: the initial keydown nudges the slider once (edge move, unaffected by this phase)");
  eq(X.menuKeys["arrowleft"], undefined,
    "D: menuKeys{} never tracks arrowleft — only the four up/down key names");

  // Hold it (no keyup sent) across well past a delay and several rate intervals — no repeat.
  for (let i = 0; i < 90; i++) X.tickMenuRepeat(DT);
  eq(X.AudioSys.vol.sfx, volAfterOne, "D: left/right never repeats, however long the key is held");
})();

// ================= (E) confirm/back/pause structurally cannot repeat =================
(function sectionE() {
  console.log("(E) menuHeldDir()'s return domain is {up, down, null} — confirm/back/pause never enter it");
  const X = build();
  // Feed every non-up/down key name tickMenuRepeat's own held-state reads could plausibly see, and
  // confirm none of them is ever read as a direction. This drives the REAL menuHeldDir(), not a copy.
  for (const k of ["enter", "escape", "arrowleft", "a", "arrowright", "d", "o", "r"]) {
    X.menuKeys[k] = true;
    eq(X.menuHeldDir(), null, `E: menuHeldDir() ignores menuKeys["${k}"]`);
    delete X.menuKeys[k];
  }
  // And the source only ever calls menuInput with the variable it derived from menuHeldDir() — never a
  // hardcoded "confirm"/"back"/"pause"/"left"/"right" literal anywhere in tickMenuRepeat's body.
  const m = /function tickMenuRepeat\(dt\) \{([\s\S]*?)\n\}/.exec(stripped);
  assert(!!m, "E: tickMenuRepeat() found in source");
  assert(!/menuInput\(\s*["'](confirm|back|pause|left|right)["']\s*\)/.test(m[1]),
    "E: tickMenuRepeat() never calls menuInput with a hardcoded non-up/down action");
})();

// ================= (F) a direction held across a screen change does not repeat into it =================
(function sectionF() {
  console.log("(F) resetMenuNav() (all four call sites route through it) clears the held state mid-hold");
  const X = build();
  const g = openRoot(X);

  X.keydown("ArrowDown", false);
  for (let i = 0; i < 10; i++) X.tickMenuRepeat(DT);   // held, well short of the first repeat

  // openPause() is one of the four named resetMenuNav() sites ("menu open") — call it again, as a
  // stand-in for whatever real event would reopen/re-arm a menu screen while the key is still down
  // (no keyup is ever sent in this section).
  X.openPause();
  eq(X.menuKeys["arrowdown"], false, "F: resetMenuNav() clears menuKeys{}");
  eq(X.menuRepeat.dir, null, "F: resetMenuNav() clears the repeat timer's own state too");

  const idxAfterReset = g.menu.index;
  for (let i = 0; i < 90; i++) X.tickMenuRepeat(DT);   // past a full delay+several rates, no new keydown
  eq(g.menu.index, idxAfterReset,
    "F: the still-physically-held direction never repeats into the screen the reset opened");
})();

// ================= (G) menuKeys{} is never written into keys{} =================
(function sectionG() {
  console.log("(G) menuKeys{} and keys{} never share a write");
  const X = build();
  openRoot(X);
  X.keydown("ArrowDown", false);
  X.keydown("ArrowUp", false);
  for (const k of ["arrowdown", "arrowup", "w", "s"]) {
    assert(!X.keys[k], `G: keys["${k}"] was never set while a menu owned input`);
  }
  assert(X.menuKeys["arrowdown"] === true && X.menuKeys["arrowup"] === true,
    "G: menuKeys{} recorded both held directions");
})();

// ================= (H) menuRepeatDelay at max reproduces pre-phase behaviour =================
(function sectionH() {
  console.log("(H) menuRepeatDelay at its maximum: nothing repeats inside a realistic hold");
  const X = build();
  const g = openRoot(X);
  X.applyDebug("menuRepeatDelay", X.DEBUG_VARS.find(v => v.id === "menuRepeatDelay").max);
  eq(X.DEBUG.menuRepeatDelay, 1.5, "H: menuRepeatDelay applied at its max (1.5s)");

  X.keydown("ArrowDown", false);
  eq(g.menu.index, 1, "H: the edge move still fires once, unaffected by the knob");
  const idx = g.menu.index;
  for (let i = 0; i < 80; i++) X.tickMenuRepeat(DT);   // 80 ticks ≈ 1.33s, short of the 1.5s max delay
  eq(g.menu.index, idx, "H: at the maximum delay, nothing repeats inside a realistic hold");
})();

A.report();
