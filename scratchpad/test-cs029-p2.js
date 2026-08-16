// Headless test for CS029 Phase 2 — the game-over exit path: ESC opens the pause menu at game
// over (previously refused), and the two-line blinking/dim footer collapses to one drawMenuHint
// line at GAMEOVER_HINT_SIZE (20, not the standard 16 — this is the only affordance on the screen).
//
//   node scratchpad/test-cs029-p2.js
//
// Drives the REAL keydown listener and the REAL draw()/drawMenuHint, through a recording ctx (the
// test-cs016-p2.js idiom) — no guard logic is reimplemented here.
//
// Sections: (A) the input guard admits "gameover", still refuses "title", carries !game.entry —
// driven live via keydown, plus openPause()/closePause() routing verified unchanged. (B) neither
// retired footer literal renders. (C) drawMenuHint's default parameter leaves every pre-existing
// call site byte-identical; the gameover footer renders once, at GAMEOVER_HINT_SIZE/_Y. (D) the
// phase-local scope pin, against PARENT_SHA = P1's own commit.

"use strict";
const { mkAssert, scriptSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — cs-29 p1 (the rename), v1.0.0.28.
const PARENT_SHA = "10c4d6faf5a9dd932134bb3d991faf821365d8ff";
const PHASE_SUBJECT = "cs-29 p2:";

const A = mkAssert();
const { assert, eq } = A;

const src = scriptSource();

// ---- recording ctx (test-cs016-p2.js idiom): logs fillText with the active style state ----
let recLog = [];
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null, shadowBlur: 0, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str, x, y, font: t.font, color: t.fillStyle });
      if (p === "fillRect") return (x, y, w, h) => recLog.push({ c: "fillRect", x, y, w, h, color: t.fillStyle });
      if (p === "strokeRect") return (x, y, w, h) => recLog.push({ c: "strokeRect", x, y, w, h, color: t.strokeStyle });
      if (p === "measureText") return str => ({ width: (parseFloat(t.font) || 10) * 0.6 * String(str).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "bindings", "openPause", "closePause", "startGame", "update", "draw",
  "GAMEOVER_HINT", "GAMEOVER_HINT_SIZE", "GAMEOVER_HINT_Y", "MENU_HINT_SIZE", "drawMenuHint",
  "VIEW_W", "VIEW_H", "COLOR",
];

// Minimal FakeAudioContext (the _harness.js idiom) — the real keydown listener calls AudioSys.init()
// on first keypress, so this must exist even though no test here asserts on audio.
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

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
  const localStorageStub = { getItem: () => null, setItem() {}, removeItem() {} };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };"
  );
  const X = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  X.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  X.render = fn => { recLog = []; fn(); return recLog.slice(); };
  return X;
}

// ================= (A) the input guard, driven live =====================
(function sectionA() {
  console.log("(A) ESC/pause admitted at gameover, still refused at title; the exclusive-mode guard holds");
  const X = build();
  const g = X.game;

  // Sanity: escape is the pause binding on this build (same assumption test-cs016-p2.js makes of
  // the back binding).
  assert(X.bindings.pause.keys.includes("escape"), "A: (setup) escape is bound to pause");

  // At GAMEOVER: previously refused, now opens the pause root.
  X.startGame();
  g.state = "gameover"; g.paused = false; g.menu.screen = null;
  X.keydown("Escape");
  assert(g.paused === true && g.menu.screen === "root",
    "A: ESC at gameover now opens the pause root (was refused before this phase)");

  // Verify-no-change (§3.1): openPause() already routes gameover -> "root"; closePause() returns to
  // a clean gameover screen; menuRoot's own Quit to Title path is untouched by this phase.
  X.closePause();
  assert(g.paused === false && g.menu.screen === null && g.state === "gameover",
    "A: closePause() returns to a clean gameover screen (unchanged by this phase)");

  // At TITLE, ESC still opens Options — but via the title menu's OWN "back" route (branch 2, which
  // intercepts before this guard because the title always has a menu active), not via THIS guard:
  // this guard would open the "root" screen, not "options".
  g.state = "title"; g.paused = false; g.menu.screen = "titlemenu";
  X.keydown("Escape");
  assert(g.menu.screen === "options",
    'A: ESC at title still opens Options through the title-menu\'s own route, not this guard (which would open "root")');

  // ⚠ CS034 P7 REPOINTED THIS CHECK. It read the guard's third operand, `!game.entry` — the belt-and
  // -suspenders that kept ESC from opening the pause menu out from under a live initials entry. That
  // entry is deleted (spec §6.1) and so is the operand. The property it protected is unchanged and is
  // now delivered by the celebration panel's own early return, the surviving exclusive mode armed at
  // the same "dying" -> "gameover" seam — so the check is aimed at that instead of dropped.
  X.startGame();
  g.state = "gameover"; g.paused = false; g.menu.screen = null;
  g.celebration = { items: [{ name: "X", desc: "y" }], scroll: 0, resume: null };
  X.keydown("Escape");
  assert(g.paused === false && g.menu.screen === null,
    "A: ESC under an exclusive gameover mode does not open the pause menu out from under it");
  g.celebration = null;

  // Source-level pin on the guard line itself, so a future edit that keeps behaviour but drops the
  // documented operand shape is still caught.
  const guardLine = src.split("\n").find(l => l.includes("bindings.pause.keys.includes(k)") && l.includes("openPause()"));
  assert(!!guardLine, "A: (setup) the pause-key guard line exists");
  assert(guardLine.includes('game.state === "gameover"') && guardLine.includes('game.state === "playing"'),
    "A: the guard's source still reads (playing || gameover)");
})();

// ================= (B) retired footer literals =====================
(function sectionB() {
  console.log("(B) neither retired gameover footer literal survives in the source");
  assert(!src.includes("PRESS ENTER TO PLAY AGAIN"),
    'B: the blinking 22px "PRESS ENTER TO PLAY AGAIN" literal is gone');
  assert(!src.includes("MENU: O    (controller: B)"),
    'B: the dim 14px "MENU: O    (controller: B)" literal is gone');
})();

// ================= (C) drawMenuHint default param + call sites, rendered live =====================
(function sectionC() {
  console.log("(C) drawMenuHint's default param preserves existing callers; gameover renders one footer");
  const X = build();
  const g = X.game;

  assert(X.GAMEOVER_HINT_SIZE === 20, "C: GAMEOVER_HINT_SIZE is 20, not the standard MENU_HINT_SIZE (16)");
  assert(X.GAMEOVER_HINT_Y === X.VIEW_H / 2 + 290, "C: GAMEOVER_HINT_Y is VIEW_H/2 + 290");

  // Pre-existing caller (ROOT_MENU_HINT-style 3-arg call) still resolves to MENU_HINT_SIZE.
  const three = X.render(() => X.drawMenuHint("↑↓ move    ENTER select", X.VIEW_W / 2, 400));
  assert(three.length === 1 && parseInt(three[0].font, 10) === X.MENU_HINT_SIZE,
    "C: a 3-arg drawMenuHint call still renders at the default MENU_HINT_SIZE");

  // New 4-arg call: the gameover footer.
  const four = X.render(() => X.drawMenuHint(X.GAMEOVER_HINT, X.VIEW_W / 2, X.GAMEOVER_HINT_Y, X.GAMEOVER_HINT_SIZE));
  assert(four.length === 1 && parseInt(four[0].font, 10) === X.GAMEOVER_HINT_SIZE,
    "C: passing an explicit 4th arg overrides the default size");

  // The real gameover draw() branch: exactly one footer, at the right size/position, and neither
  // retired line renders.
  X.startGame();
  for (let i = 0; i < 5; i++) X.update(1 / 60);
  g.state = "gameover"; g.entry = null; g.paused = false; g.menu.screen = null;
  const full = X.render(X.draw);
  const footer = full.filter(e => e.c === "fillText" && e.str === X.GAMEOVER_HINT);
  assert(footer.length === 1, `C: exactly one fillText renders GAMEOVER_HINT (found ${footer.length})`);
  if (footer.length) {
    assert(parseInt(footer[0].font, 10) === X.GAMEOVER_HINT_SIZE, "C: ...at GAMEOVER_HINT_SIZE");
    assert(footer[0].y === X.GAMEOVER_HINT_Y, "C: ...at GAMEOVER_HINT_Y");
    assert(footer[0].x === X.VIEW_W / 2, "C: ...centred");
  }
  assert(!full.some(e => e.c === "fillText" && e.str === "PRESS ENTER TO PLAY AGAIN"),
    "C: the retired blinking line does not render");
  assert(!full.some(e => e.c === "fillText" && e.str === "MENU: O    (controller: B)"),
    "C: the retired dim hint does not render");
})();

// ================= (D) the phase-local scope pin =====================
(function sectionD() {
  console.log("(D) this phase's own diff: the input guard, the footer re-flow, this test");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { A.skip("D: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: D: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { A.skip("D: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (measured against the WORKING TREE — this phase is not committed yet)");

  eq(outsideScope(changed, []).join(","), "",
    `D: nothing outside the base allowlist (found: ${outsideScope(changed, []).join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "D: (setup) the game file is in this phase's diff");
  assert(changed.includes("scratchpad/test-cs029-p2.js"), "D: (setup) ...including this test file");
})();

A.report();
