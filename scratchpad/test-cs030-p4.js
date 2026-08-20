// Headless test for CS030 Phase 4 — the achievement celebration panel, wired at GAME OVER.
//
//   node scratchpad/test-cs030-p4.js
//
// Drives the REAL keydown listener, the REAL handleGamepadMenu(), and the REAL killShip() ->
// "dying" -> "gameover" seam through a recording ctx — no guard or scroll logic is reimplemented.
//
// TRAP the phase exists to avoid: the two input paths are separate functions, so a guard added to
// one and not the other lets a controller player blow through the panel with Start (spec §5.1).
// Every input assertion below is therefore run twice, once per handler.
//
// Sections: (A) node --check; the panel draws outside drawHUD() and in draw()'s overlay tail.
// (B) the seam: N banked unlocks open the panel with N items at scroll 0; zero unlocks open
// nothing. (C) scroll, clamped against celebrationMaxScroll(), on BOTH handlers, with the repeat/
// edge guards. (D) confirm and back dismiss at ANY scroll position, on BOTH handlers. (E) input
// priority: a confirm does not reach startGame() while the panel is up, on BOTH
// handlers — and entry becomes reachable after dismissal. (F) game.menu.scroll is neither read nor
// written by any celebration path (behavioural + source). (G) TRAPs: the gameover draw block is
// byte-identical to the parent's; scope pin.

"use strict";
const { mkAssert, scriptSource, execSource, topLevelNames } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope, parentSource } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-30 p3: ACH_EMBLEM table + drawEmblem()".
const PARENT_SHA = "154e699870820aa6901cfbdf7ebb0a16e6341990";
const PHASE_SUBJECT = "cs-30 p4:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const DT = 1 / 60;

// ---- recording ctx (the test-cs016-p2/test-cs029-p2 idiom): logs fillText with the live style ----
let recLog = [];
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str: String(str), x, y, font: t.font, color: t.fillStyle });
      if (p === "rect") return (x, y, w, h) => recLog.push({ c: "rect", x, y, w, h });
      if (p === "measureText") return s => ({ width: (parseFloat(t.font) || 10) * 0.6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

// Minimal FakeAudioContext — the real keydown listener calls AudioSys.init()/resume() on every key.
function makeAudioNode() {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  return new Proxy({
    gain: Object.assign(param(), { value: 1 }), frequency: param(), Q: param(), detune: param(),
    threshold: param(), ratio: Object.assign(param(), { value: 1 }), attack: param(), release: param(),
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {},
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; }, createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); }, resume() {},
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

// buildGame()'s window stub swallows addEventListener, and this file has to DRIVE the listener —
// so the factory is spelled out here (test-cs029-p2's idiom) over the harness's own export harvest.
const PROBE = 'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }';
function build() {
  const recCtx = makeRecordingCtx();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext,
  };
  let pads = [];
  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; },
  };
  const names = [...topLevelNames(src), PROBE];
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + names.join(", ") + " };");
  const X = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => pads }, localStorageStub);

  X.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  // One gamepad frame: refresh the snapshot, then run the dispatcher. gpPressed/menuNavEdges are
  // edge-detected, so a press needs a released frame in front of it — padPress() does both.
  X.padFrame = (press, axes) => {
    const buttons = [];
    for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 });
    pads = [{ connected: true, buttons, axes: axes || [0, 0, 0, 0] }];
    X.pollGamepad();
    X.handleGamepadMenu();
  };
  X.padPress = (btn, axes) => { X.padFrame([], axes); X.padFrame([btn], axes); };
  X.render = fn => { recLog = []; fn(); return recLog.slice(); };
  return X;
}

// A clean run into "gameover", with an empty field so no stray detonation fires anything.
function toGameover(X) {
  const frames = Math.ceil(X.DEATH_DURATION / DT) + 4;
  for (let i = 0; i < frames; i++) X.update(DT);
}
function freshRun(X, score) {
  X.startGame();
  X.game.score = score === undefined ? 5000 : score;
  X.game.debris.length = 0; X.game.hunters.length = 0; X.game.saucers.length = 0;
  X.game.garbage.length = 0; X.game.powerups.length = 0;
}
// A panel with `n` synthetic rows, in the shape onUnlock() banks (tiered + untiered both present).
function fakeItems(n) {
  return Array.from({ length: n }, (_, i) => ({
    id: "fake" + i, name: "Fake Achievement " + i, desc: "A synthetic row for the scroll maths.",
    tierIdx: i % 2 === 0 ? i % 6 : undefined, pool: i % 2 === 0 ? "lifetime" : "weekly",
  }));
}

// ================= (A) node --check; drawn in draw()'s tail, outside drawHUD() =====================
(function sectionA() {
  console.log("(A) node --check; the panel draws from draw()'s overlay tail and survives the H toggle");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs030p4_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // Call-site ordering, read off draw()'s own body: after the gameover block, in drawMenu()'s slot,
  // before drawToasts(). Draw order mirrors input priority — a menu that owns input draws on top.
  const drawBody = src.slice(src.indexOf("\nfunction draw() {"), src.indexOf("\nfunction drawHUD() {"));
  const iOver = drawBody.indexOf('if (game.state === "gameover") {');
  const iCeleb = drawBody.indexOf("drawCelebration();");
  const iMenu = drawBody.indexOf("if (game.paused) drawMenu();");
  const iToast = drawBody.lastIndexOf("drawToasts();");
  assert(iOver >= 0 && iCeleb >= 0 && iMenu >= 0 && iToast >= 0, "A: (setup) draw() has all four call sites");
  assert(iOver < iCeleb, "A: drawCelebration() is called AFTER the gameover block");
  assert(iCeleb < iMenu, "A: ...and before drawMenu(), so an input-owning menu still draws on top");
  assert(iCeleb < iToast, "A: ...and before drawToasts(), which stays last (F9)");

  const hudBody = src.slice(src.indexOf("\nfunction drawHUD() {"));
  const hudEnd = hudBody.indexOf("\nfunction ", 1);
  assert(!hudBody.slice(0, hudEnd).includes("drawCelebration"),
    "A: ⛔ drawCelebration() is NOT called from inside drawHUD()");

  // The behavioural half: H hides the HUD, never the panel.
  const X = build();
  freshRun(X);
  X.game.state = "gameover";
  X.game.celebration = { items: fakeItems(2), scroll: 0 };
  X.Capture.hudVisible = false;
  const log = X.render(() => X.draw());
  assert(log.some(r => r.c === "fillText" && r.str === "ACHIEVEMENTS UNLOCKED"),
    "A: ⛔ the panel still renders with Capture.hudVisible false — H must not hide it");
  assert(log.some(r => r.c === "fillText" && r.str.startsWith("Fake Achievement 0")),
    "A: ...and its rows render with it");
  X.Capture.hudVisible = true;
})();

// ================= (B) the seam: N banked unlocks -> N items at scroll 0 =====================
(function sectionB() {
  console.log('(B) the "dying"->"gameover" seam opens the panel iff the bucket is non-empty');
  const X = build();
  freshRun(X);
  // Drive REAL unlocks: inflate the per-game counters, then let killShip()'s own final
  // Achievements.evaluate() do the unlocking. N is whatever that genuinely banks.
  for (const k of Object.keys(X.game.stats)) if (typeof X.game.stats[k] === "number") X.game.stats[k] = 1e6;
  X.killShip();
  const banked = X.game.pendingAch.slice();
  assert(banked.length > 0, `B: (setup) killShip()'s final evaluate() banked ${banked.length} unlocks`);
  assert(X.game.celebration === null, "B: no panel yet — the bucket is still open during the death spectacle");

  toGameover(X);
  eq(X.game.state, "gameover", "B: (setup) the run reached gameover");
  assert(X.game.celebration !== null, "B: ⛔ the panel opened at the seam");
  eq(X.game.celebration.items.length, banked.length, `B: ⛔ the panel carries all ${banked.length} banked unlocks`);
  eq(X.game.celebration.items.map(i => i.id).join(","), banked.map(i => i.id).join(","),
    "B: ...the same items, in bank order");
  eq(X.game.celebration.scroll, 0, "B: ⛔ it opens at scroll 0");
  eq(X.game.pendingAch.length, 0, "B: ⛔ the bucket was FLUSHED into the panel, not copied");

  // Zero unlocks: the guard is `if (game.pendingAch.length)`, so an empty bucket opens nothing.
  const Y = build();
  freshRun(Y);
  Y.killShip();
  Y.game.pendingAch.length = 0;      // whatever this fresh profile earned, drop it: test the empty case
  toGameover(Y);
  eq(Y.game.state, "gameover", "B: ⛔ a run with zero banked unlocks still reaches gameover");
  assert(Y.game.celebration === null, "B: ⛔ ...and opens NO panel");
  Y.render(() => Y.draw());
  assert(!recLog.some(r => r.c === "fillText" && r.str === "ACHIEVEMENTS UNLOCKED"),
    "B: ...and nothing of the panel renders");
})();

// ================= (C) scroll, clamped against celebrationMaxScroll(), on BOTH handlers ===========
(function sectionC() {
  console.log("(C) up/down scroll by CELEB_SCROLL_STEP (CS038 P5: retired off DEBUG), clamped to celebrationMaxScroll() — keyboard AND gamepad");
  const step = build().CELEB_SCROLL_STEP;
  assert(step > 0, `C: (setup) CELEB_SCROLL_STEP is ${step}`);

  // A row count big enough that maxScroll is genuinely positive (and not a multiple of the step, so
  // the final clamp is a real clamp rather than an exact landing).
  const X = build();
  freshRun(X);
  X.game.state = "gameover";
  X.game.celebration = { items: fakeItems(12), scroll: 0 };
  const max = X.celebrationMaxScroll();
  assert(max > step, `C: (setup) 12 rows overflow the clip region — maxScroll ${max} > one step ${step}`);
  eq(X.celebrationMaxScroll(), max, "C: celebrationMaxScroll() is stable (a pure derivation of items.length)");

  X.keydown("ArrowDown");
  eq(X.game.celebration.scroll, step, "C: keyboard ↓ scrolls down one step");
  X.keydown("s");
  eq(X.game.celebration.scroll, 2 * step, "C: ...and S is the same action");
  X.keydown("ArrowUp");
  eq(X.game.celebration.scroll, step, "C: keyboard ↑ scrolls back up one step");
  X.keydown("ArrowUp"); X.keydown("ArrowUp");
  eq(X.game.celebration.scroll, 0, "C: ⛔ scrolling up past the top clamps at 0");
  for (let i = 0; i < 40; i++) X.keydown("ArrowDown");
  eq(X.game.celebration.scroll, max, "C: ⛔ scrolling down past the bottom clamps at celebrationMaxScroll()");

  // e.repeat: a HELD key must not spin the scroll (the v3.5 P1 menu-nav idiom the entry block uses).
  X.game.celebration.scroll = 0;
  X.keydown("ArrowDown", true);
  eq(X.game.celebration.scroll, 0, "C: ⛔ a repeat keydown does not scroll");
  X.keydown("ArrowDown", false);
  eq(X.game.celebration.scroll, step, "C: ...a genuine press does");

  // The renderer clamps against the SAME ceiling, so an out-of-range scroll self-heals on draw.
  X.game.celebration.scroll = max + 999;
  X.draw();
  eq(X.game.celebration.scroll, max, "C: ⛔ the renderer clamps against the same ceiling the input does");

  // ⛔ The ceiling is measured from the CLIP TOP, not from row 0's baseline (see the function's own
  // header). Transcribing achMaxScroll()'s baseline-relative formula falls this panel's 44px of
  // emblem headroom short and cuts the bottom row's emblem in half at full scroll. Derived from the
  // build's own consts, so a later layout retune re-derives with it instead of going stale.
  const rowBottom = Math.max(X.CELEB_DESC_DY + X.CELEB_DESC_SIZE,
                             X.CELEB_EMBLEM_DY + X.CELEB_EMBLEM_SIZE);
  const lastInk = X.CELEB_ROW0_Y + 11 * X.CELEB_ROW_STEP - max + rowBottom;
  assert(lastInk <= X.CELEB_ROW_CLIP_BOTTOM,
    `C: ⛔ at full scroll the LAST row's lowest ink (${lastInk}) is inside the clip (bottom ${X.CELEB_ROW_CLIP_BOTTOM})`);
  assert(lastInk > X.CELEB_ROW_CLIP_BOTTOM - X.CELEB_ROW_STEP,
    "C: ...and the ceiling doesn't over-scroll into a whole row of empty space either");
  assert(X.CELEB_ROW0_Y + X.CELEB_EMBLEM_DY - X.CELEB_EMBLEM_SIZE >= X.CELEB_ROW_CLIP_TOP,
    "C: ...and at scroll 0 row 0's emblem clears the clip top (that headroom is what the maths accounts for)");

  // Four rows are the shipped no-scroll capacity — the ▲/▼ affordance must not appear for a panel
  // that fits, and must appear the moment one doesn't.
  X.game.celebration = { items: fakeItems(4), scroll: 0 };
  eq(X.celebrationMaxScroll(), 0, "C: a 4-row panel fits with no scroll at all");
  assert(!X.render(() => X.draw()).some(r => r.c === "fillText" && (r.str === "▼" || r.str === "▲")),
    "C: ⛔ no ▲/▼ affordance is drawn when there is nothing to scroll");
  X.game.celebration = { items: fakeItems(5), scroll: 0 };
  assert(X.celebrationMaxScroll() > 0, "C: a 5-row panel does overflow");
  let cue = X.render(() => X.draw());
  assert(cue.some(r => r.c === "fillText" && r.str === "▼") && !cue.some(r => r.c === "fillText" && r.str === "▲"),
    "C: ⛔ at the top only ▼ shows — there is nothing above yet");
  X.game.celebration.scroll = X.celebrationMaxScroll();
  cue = X.render(() => X.draw());
  assert(cue.some(r => r.c === "fillText" && r.str === "▲") && !cue.some(r => r.c === "fillText" && r.str === "▼"),
    "C: ⛔ at the bottom only ▲ shows — and both cues draw OUTSIDE the clip, like the panel chrome");

  // Gamepad mirror: D-Pad up/down, edge-detected.
  const Y = build();
  freshRun(Y);
  Y.game.state = "gameover";
  Y.game.celebration = { items: fakeItems(12), scroll: 0 };
  Y.padPress(Y.GP.DPAD_DOWN);
  eq(Y.game.celebration.scroll, step, "C: ⛔ gamepad D-Pad ↓ scrolls down one step");
  Y.padFrame([Y.GP.DPAD_DOWN]);   // still held: no new edge
  eq(Y.game.celebration.scroll, step, "C: ⛔ a HELD D-Pad direction does not spin the scroll (edge-detected)");
  Y.padPress(Y.GP.DPAD_UP);
  eq(Y.game.celebration.scroll, 0, "C: gamepad D-Pad ↑ scrolls back up, clamped at 0");
  for (let i = 0; i < 40; i++) Y.padPress(Y.GP.DPAD_DOWN);
  eq(Y.game.celebration.scroll, max, "C: ⛔ gamepad scroll clamps at the same celebrationMaxScroll()");
})();

// ================= (D) confirm/back dismiss at ANY scroll position, on BOTH handlers ==============
(function sectionD() {
  console.log("(D) confirm and back dismiss unconditionally — at the top, mid-scroll and at the bottom");
  // Top / mid / bottom, derived from the same ceiling the renderer and the input handlers use.
  function positions(X) {
    X.game.celebration = { items: fakeItems(12), scroll: 0 };
    const max = X.celebrationMaxScroll();
    assert(max > 0, `D: (setup) 12 rows genuinely overflow — maxScroll ${max}`);
    return [0, Math.floor(max / 2), max];
  }

  for (const key of ["Enter", "Escape"]) {
    const X = build();
    freshRun(X);
    X.game.state = "gameover";
    for (const pos of positions(X)) {
      X.game.celebration = { items: fakeItems(12), scroll: pos };
      X.keydown(key);
      assert(X.game.celebration === null, `D: keyboard ${key} dismisses the panel at scroll ${pos}`);
      eq(X.game.state, "gameover", `D: ...without leaving gameover (scroll ${pos})`);
    }
  }

  for (const btn of ["A", "B"]) {
    const X = build();
    freshRun(X);
    X.game.state = "gameover";
    for (const pos of positions(X)) {
      X.game.celebration = { items: fakeItems(12), scroll: pos };
      X.padPress(X.GP[btn]);
      assert(X.game.celebration === null, `D: ⛔ gamepad ${btn} dismisses the panel at scroll ${pos}`);
      eq(X.game.state, "gameover", `D: ...without leaving gameover (scroll ${pos})`);
    }
  }
})();

// ================= (E) input priority: startGame() is not reachable while the panel is up =========
(function sectionE() {
  console.log("(E) FORK-CS030-C: while the panel is up, a confirm does not reach startGame()");
  // ⚠ CS034 P7 NARROWED THIS SECTION. It used to prove the panel outranked TWO things at this seam —
  // startGame() and the initials entry's own dispatcher. The entry is deleted (spec §6.1) and its
  // record is written outright before this screen ever draws, so what is left to outrank is
  // startGame(). The sequence lost one step (dismiss, THEN play again) and nothing else.

  // Keyboard.
  const X = build();
  freshRun(X, 12345);
  for (const k of Object.keys(X.game.stats)) if (typeof X.game.stats[k] === "number") X.game.stats[k] = 1e6;
  X.killShip();
  toGameover(X);
  assert(X.game.celebration !== null, "E: (setup) the panel is up");
  // ⚠ CS034 P7: the record is ALREADY banked by the time the panel opens — both happen at the same
  // seam, and the write no longer waits on any input.
  assert(X.game.lastScoreId !== null, "E: ⛔ a qualifying run's record is already written at the seam");
  const bankedId = X.game.lastScoreId, bankedRows = X.HighScores.entries.length;

  X.keydown("Enter");
  assert(X.game.celebration === null, "E: the confirm dismissed the panel");
  eq(X.game.state, "gameover", "E: ⛔ ...and did NOT reach startGame() (state is still gameover)");
  eq(X.game.lastScoreId, bankedId, "E: ⛔ ...and committed nothing further — there is nothing left to commit");
  eq(X.HighScores.entries.length, bankedRows, "E: ...the table did not grow on a dismissal");

  X.keydown("Enter");   // and only now does confirm mean "play again"
  eq(X.game.state, "playing", "E: ...a second confirm finally starts a new game");

  // Gamepad. Same sequence through handleGamepadMenu(), including Start, which the panel swallows.
  const Y = build();
  freshRun(Y, 12345);
  for (const k of Object.keys(Y.game.stats)) if (typeof Y.game.stats[k] === "number") Y.game.stats[k] = 1e6;
  Y.killShip();
  toGameover(Y);
  assert(Y.game.celebration !== null, "E: (setup) the pad run's panel is up");

  Y.padPress(Y.GP.START);
  eq(Y.game.state, "gameover", "E: ⛔ Start is SWALLOWED by the panel — it does not reach startGame()");
  assert(Y.game.celebration !== null, "E: ...and does not dismiss the panel either");

  Y.padPress(Y.GP.A);
  assert(Y.game.celebration === null, "E: the pad confirm dismissed the panel");
  eq(Y.game.state, "gameover", "E: ⛔ ...and did NOT reach startGame()");

  Y.padPress(Y.GP.START);
  eq(Y.game.state, "playing", "E: ...Start after that finally starts a new game");
})();

// ================= (F) game.menu.scroll is untouched by every celebration path ====================
(function sectionF() {
  console.log("(F) ⛔ game.menu.scroll is neither read nor written by any celebration code path");
  const SENTINEL = 4242;
  const X = build();
  freshRun(X);
  X.game.state = "gameover";
  X.game.menu.scroll = SENTINEL;
  X.game.celebration = { items: fakeItems(12), scroll: 0 };
  X.draw();
  X.keydown("ArrowDown"); X.keydown("ArrowDown"); X.keydown("ArrowUp");
  X.padPress(X.GP.DPAD_DOWN);
  X.draw();
  assert(X.game.celebration.scroll > 0, "F: (setup) the panel's own scroll really did move");
  eq(X.game.menu.scroll, SENTINEL, "F: ⛔ game.menu.scroll is unchanged after open/scroll/render");
  X.keydown("Enter");
  assert(X.game.celebration === null, "F: (setup) dismissed");
  eq(X.game.menu.scroll, SENTINEL, "F: ⛔ ...and unchanged after dismissal");

  // Source half: no celebration region so much as NAMES game.menu. Read off execSource() output, so
  // a comment mentioning game.menu.scroll (this file's own rationale does) can't false-positive.
  const stripped = execSource(src);
  function blockAt(from) {
    const open = stripped.indexOf("{", from);
    if (open < 0) return "";
    let depth = 0;
    for (let i = open; i < stripped.length; i++) {
      if (stripped[i] === "{") depth++;
      else if (stripped[i] === "}" && --depth === 0) return stripped.slice(from, i + 1);
    }
    return "";
  }
  const regions = [];
  for (const fn of ["function celebrationMaxScroll(", "function celebrationScroll(",
                    "function dismissCelebration(", "function drawCelebrationRow(",
                    "function drawCelebration("]) {
    const i = stripped.indexOf(fn);
    assert(i >= 0, `F: (setup) ${fn}) exists in the build`);
    regions.push([fn, blockAt(i)]);
  }
  // Both input guards, plus the seam that opens the panel.
  let gi = -1, guards = 0;
  while ((gi = stripped.indexOf("if (game.celebration) {", gi + 1)) >= 0) { regions.push(["guard@" + gi, blockAt(gi)]); guards++; }
  eq(guards, 2, "F: (setup) exactly two `if (game.celebration) {` input guards — the keyboard and the gamepad one");
  const si = stripped.indexOf("if (game.pendingAch.length) {");
  assert(si >= 0, "F: (setup) the seam's bucket guard exists");
  regions.push(["seam", blockAt(si)]);

  for (const [label, body] of regions) {
    assert(body.length > 0, `F: (setup) ${label} brace-matched to a non-empty body`);
    assert(!body.includes("game.menu"), `F: ⛔ ${label} never touches game.menu (let alone game.menu.scroll)`);
  }
  // Non-vacuous: the Achievements viewer, which is the pattern's source, DOES use it.
  assert(blockAt(stripped.indexOf("function drawAchievements(")).includes("game.menu.scroll"),
    "F: (non-vacuous) drawAchievements() does read game.menu.scroll — the check can tell the two apart");
})();

// ================= (G) TRAPs: the gameover draw block is untouched; scope pin ====================
(function sectionG() {
  console.log("(G) TRAPs: the CS029 P2 gameover draw block is byte-identical to the parent's; scope pin");

  // Brace-match the gameover draw block out of BOTH sources and compare bytes. Safe on raw text
  // here: the block contains no braces inside its strings or comments.
  function gameoverBlock(text) {
    const from = text.indexOf('if (game.state === "gameover") {');
    if (from < 0) return null;
    let depth = 0;
    for (let i = text.indexOf("{", from); i < text.length; i++) {
      if (text[i] === "{") depth++;
      else if (text[i] === "}" && --depth === 0) return text.slice(from, i + 1);
    }
    return null;
  }
  const mine = gameoverBlock(src);
  assert(mine !== null, "G: (setup) HEAD's gameover draw block brace-matched");
  // Non-vacuous: it is still the CS029 P2 screen, footer knob and all.
  for (const lit of ["GAME OVER", "FINAL SCORE", "drawScoreTable", "GAMEOVER_HINT"]) {
    assert(mine.includes(lit), `G: (setup) the block still contains \`${lit}\``);
  }
  const ps = parentSource(PARENT_SHA);
  if (ps === null) {
    skip("G: gameover draw block against the parent (no git history)");
  } else {
    const theirs = gameoverBlock(ps);
    assert(theirs !== null, "G: (setup) the parent's gameover draw block brace-matched");
    // ⚠ REPOINTED TWICE, AND THE SECOND REPOINT CHANGED THE CLAIM'S SHAPE.
    //   CS030 P7 (gate G6) edited exactly the if/else-if condition pair, and this pin absorbed that as
    //   one known substitution applied to the parent text, keeping BYTE identity on everything else.
    //   CS034 P7 (spec §6.1) DELETED the initials-entry branch outright and dedented the surviving one.
    //   A substitution cannot express that, and a byte-identity claim over a re-indented block is not
    //   a pin, it is a diff. So the claim becomes: HEAD's block no longer mentions the entry at all,
    //   and EVERY OTHER executable line of the parent's block survives verbatim, in order, with none
    //   added. That still catches the thing this trap exists for — a stray edit riding along in the
    //   gameover screen — without pretending an instructed deletion never happened.
    const codeLines = t => t.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("//"));
    assert(!/game\.entry|drawEntrySlots/.test(mine),
      "G: ⛔ HEAD's gameover block has no trace of the initials entry left");
    // The parent's lines less the entry branch and every brace-only line (the deletion unbalanced them).
    const parentKept = codeLines(theirs).filter(l => !/game\.entry|drawEntrySlots/.test(l) && !/^\}/.test(l));
    const mineKept = codeLines(mine).filter(l => !/^\}/.test(l));
    let j = 0, missing = null;
    for (const l of parentKept) {
      const k = mineKept.indexOf(l, j);
      if (k < 0) { missing = l; break; }
      j = k + 1;
    }
    eq(missing, null, `G: ⛔ every surviving parent line is still in HEAD's block, in order (missing: ${missing})`);
    eq(mineKept.length, parentKept.length,
      "G: ⛔ ...and NOTHING was added — the deletion is the whole of this phase's edit to the block");
  }

  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("G: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: G: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("G: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (G measured against the WORKING TREE — this phase is not committed yet)");

  const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
  eq(designDocs.join(","), "", `G: ⛔ no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `G: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "G: (setup) the game file is in this phase's diff");
})();

A.report();
