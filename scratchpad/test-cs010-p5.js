// Headless test for CS010 Phase 5 — drawScoreTable(cx, topY, highlightId, scale) at 180% on the
// browsable High Scores screen; the gameover table stays at scale 1 (spec: PLANNED-FEATURES-CS010.md
// §8a). Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the
// REAL <script> block, drive the ACTUAL drawHighScores()/draw()/HighScores — no reimplementation.
//
//   node scratchpad/test-cs010-p5.js
//
// A recording ctx captures every fillText call (with the font size active at the time) so we can
// assert on real pixel geometry, not on the tuning constants themselves:
//  (A) node --check on the extracted <script>.
//  (B) drawScoreTable's default scale (no 4th arg, the gameover call shape) reproduces the PRE-P5
//      geometry byte-for-byte: font 13, row pitch 18, header offset 22, column offsets cx+-230 etc.
//  (C) drawScoreTable(..., 1.8) scales every font size AND every column offset by 1.8.
//  (D) drawHighScores() with a FULL 10-row table: every fillText y stays within the panel's own
//      strokeRect bounds (menuPanel's inner bottom), i.e. the table doesn't run off its own panel.
//  (E) the gameover block (draw(), game.state==="gameover", a full 10-row table, no live entry): every
//      fillText y stays <= VIEW_H - 20, i.e. the unscaled table + "PRESS ENTER..."/O-hint footer still
//      fits the 720-tall viewport.
//  (F) the gameover caller in source still passes no scale argument (still scale 1, unchanged).

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs010-p5-extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ---- Recording 2D context: captures fillText(str, x, y) tagged with the font/size active at call
// time (drawText always sets ctx.font immediately before fillText, so "last font seen" is correct),
// plus strokeRect(x,y,w,h) so menuPanel's own panel bounds can be read back without hardcoding them.
function makeRecordingCtx() {
  const state = { font: "13px monospace" };
  const log = [];
  const passthroughMethods = ["arc", "stroke", "save", "restore", "translate", "rotate", "moveTo",
    "lineTo", "closePath", "beginPath", "fill", "fillRect", "createRadialGradient"];
  return new Proxy(state, {
    get(t, p) {
      if (p === "log") return log;
      if (p === "fillText") return (str, x, y) => {
        const fm = /^(\d+(?:\.\d+)?)px/.exec(t.font);
        log.push({ op: "fillText", str, x, y, size: fm ? parseFloat(fm[1]) : null });
      };
      if (p === "strokeRect") return (x, y, w, h) => log.push({ op: "strokeRect", x, y, w, h });
      if (passthroughMethods.includes(p)) return (...args) => log.push({ op: p, args });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

function buildInstance() {
  const recCtx = makeRecordingCtx();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  function makeAudioNode() {
    return new Proxy({
      gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
      frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
      Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
      connect() { return makeAudioNode(); }, start() {}, stop() {}
    }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
  }
  function FakeAudioContext() {
    return new Proxy({
      state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
      createGain() { return makeAudioNode(); },
      createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
    }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
  }
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const RETURN = [
    "startGame", "update", "draw", "game", "HighScores", "drawScoreTable", "drawHighScores",
    "SCORES_MAX", "VIEW_W", "VIEW_H", "AudioSys", "DEATH_DURATION", "killShip"
  ];
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const A = factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
  A.__log = recCtx.log;
  return A;
}

function fillFull(A) {
  A.HighScores.entries = [];
  for (let i = 0; i < A.SCORES_MAX; i++) A.HighScores.add({ initials: "P" + i, score: (i + 1) * 1000, wave: i + 1, delivered: i });
}

// ================= (B) default scale (no 4th arg) reproduces the pre-P5 geometry =====================
(function () {
  console.log("(B) drawScoreTable(cx, topY, highlightId) with no scale arg == old font 13 / pitch 18 layout");
  const A = buildInstance();
  fillFull(A);
  A.__log.length = 0;
  A.drawScoreTable(640, 200, null);
  const rows = A.__log.filter(e => e.op === "fillText");
  assert(rows.length > 0, "B: drawScoreTable emitted fillText calls");
  assert(rows.every(r => near(r.size, 13)), "B: every glyph is font 13 at default scale (unchanged)");
  const rank0 = rows.find(r => r.str === "1.");
  assert(rank0 && near(rank0.y, 200 + 22), "B: row 0 baseline == topY + 22 (unchanged header offset)");
  const rank1 = rows.find(r => r.str === "2.");
  assert(rank1 && near(rank1.y, 200 + 22 + 18), "B: row 1 baseline == topY + 22 + 18 (unchanged row pitch)");
  const header = rows.find(r => r.str === "SCORE");
  assert(header && near(header.x, 640 + 10), "B: SCORE header at cx+10 (unchanged column offset)");
  const initials0 = rows.find(r => r.str === "P0");
  assert(initials0 && near(initials0.x, 640 - 170), "B: INITIALS column at cx-170 (unchanged column offset)");
})();

// ================= (C) scale=1.8 scales fonts, pitch, AND column offsets =====================
(function () {
  console.log("(C) drawScoreTable(..., 1.8) scales fonts/pitch/header-offset/columns together");
  const A = buildInstance();
  fillFull(A);
  A.__log.length = 0;
  A.drawScoreTable(640, 200, null, 1.8);
  const rows = A.__log.filter(e => e.op === "fillText");
  assert(rows.every(r => near(r.size, 13 * 1.8)), "C: every glyph is font 13*1.8 = 23.4");
  const rank0 = rows.find(r => r.str === "1.");
  assert(rank0 && near(rank0.y, 200 + 22 * 1.8), "C: row 0 baseline == topY + 22*1.8");
  const rank1 = rows.find(r => r.str === "2.");
  assert(rank1 && near(rank1.y, 200 + 22 * 1.8 + 18 * 1.8), "C: row pitch scaled to 18*1.8");
  const header = rows.find(r => r.str === "SCORE");
  assert(header && near(header.x, 640 + 10 * 1.8), "C: SCORE header column offset scaled to cx+10*1.8");
  const initials0 = rows.find(r => r.str === "P0");
  assert(initials0 && near(initials0.x, 640 - 170 * 1.8), "C: INITIALS column offset scaled to cx-170*1.8");
})();

// ================= (D) drawHighScores() full table stays within its own panel =====================
(function () {
  console.log("(D) drawHighScores() with a full 10-row table: every fillText y <= panel's inner bottom");
  const A = buildInstance();
  fillFull(A);
  A.__log.length = 0;
  A.drawHighScores();
  const panel = A.__log.find(e => e.op === "strokeRect");
  assert(panel, "D: menuPanel drew a strokeRect (panel bounds recoverable)");
  const innerBottom = panel.y + panel.h;
  const rows = A.__log.filter(e => e.op === "fillText");
  assert(rows.length >= (A.SCORES_MAX + 1) * 5, "D: header + 10 rows x 5 columns all rendered");
  const maxY = Math.max(...rows.map(r => r.y));
  assert(maxY <= innerBottom, `D: max fillText y (${maxY}) <= panel inner bottom (${innerBottom})`);
})();

// ================= (E) gameover block, full table, stays within the 720-tall viewport =====================
(function () {
  console.log("(E) gameover block with a full 10-row table: every fillText y <= VIEW_H - 20");
  const A = buildInstance();
  A.AudioSys.init();
  A.startGame();
  fillFull(A);
  A.game.debris.length = 0; A.game.hunters.length = 0; A.game.saucers.length = 0;
  A.game.lastScoreId = A.HighScores.entries[0].id;
  A.killShip();
  const DT = 1 / 60;
  for (let i = 0; i < Math.ceil(A.DEATH_DURATION / DT) + 4; i++) A.update(DT);
  A.game.entry = null; // force the settled table view, not the initials-entry slots
  assert(A.game.state === "gameover", "E: reached gameover");
  A.__log.length = 0;
  A.draw();
  const all = A.__log.filter(e => e.op === "fillText");
  // Isolate the gameover overlay itself: everything from "GAME OVER" onward. Earlier fillText calls
  // are world-space entities (ship/dock/particles) drawn under an untracked ctx.translate — our stub
  // doesn't apply that transform, so their raw x/y args aren't real screen coordinates and would give
  // false positives/negatives here. The overlay text (GAME OVER / table / footer) is screen-space and
  // drawn last, after ctx.restore(), so this slice is exactly what this section needs to check.
  const startIdx = all.findIndex(r => r.str === "GAME OVER");
  assert(startIdx >= 0, "E: 'GAME OVER' text was drawn");
  const rows = all.slice(startIdx);
  assert(rows.length > 0, "E: gameover overlay emitted fillText calls");
  const maxY = Math.max(...rows.map(r => r.y));
  assert(maxY <= A.VIEW_H - 20, `E: max fillText y (${maxY}) <= VIEW_H-20 (${A.VIEW_H - 20})`);
  // The table itself (unscaled) must still be font 13 in this call — a stray global scale bump would
  // silently blow the ceiling this section checks.
  const tableRows = rows.filter(r => /^\d+\.$/.test(r.str));
  assert(tableRows.length && tableRows.every(r => near(r.size, 13)), "E: gameover table glyphs stay at font 13 (scale 1)");
})();

// ================= (F) source-level: the gameover caller still passes no scale arg =====================
(function () {
  console.log("(F) gameover caller: drawScoreTable(VIEW_W/2, VIEW_H/2 + 60, game.lastScoreId) — no scale arg");
  const call = scriptSrc.match(/drawScoreTable\(VIEW_W\s*\/\s*2,\s*VIEW_H\s*\/\s*2\s*\+\s*60,\s*game\.lastScoreId\)/);
  assert(!!call, "F: gameover drawScoreTable call site unchanged (still 3 args, still scale-1 by default)");
})();

console.log(`\ntest-cs010-p5: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
