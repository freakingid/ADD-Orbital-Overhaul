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
//  (D) drawHighScores() with a FULL table: its scrolling row band and all of its chrome stay inside
//      the panel's own strokeRect bounds. ⚠ CS034 P7 REPOINTED THIS SECTION. The browsable screen has
//      its own eight-column renderer now, it holds SCORES_MAX = 25 rows, and what keeps those rows off
//      the panel edge is a ctx.clip() band, not the whole table fitting. The recording stub does not
//      clip, so the old "every fillText y <= panel bottom" claim cannot hold and was replaced by the
//      claim that actually ships: the band is inside the panel, and every row drawn inside the band is
//      too — at scroll 0 and at the ceiling.
//  (E) the gameover block (draw(), game.state==="gameover", a full table): every fillText y stays
//      <= VIEW_H - 20, i.e. the unscaled ten-row table + its footer still fits the 720-tall viewport.
//  (F) the gameover caller in source still passes no scale argument (still scale 1, unchanged).

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
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
    "lineTo", "closePath", "beginPath", "fill", "fillRect", "createRadialGradient",
    "rect", "clip"];   // CS034 P7: §D reads the browsable screen's clip band back out of the log
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
    "SCORES_MAX", "VIEW_W", "VIEW_H", "AudioSys", "DEATH_DURATION", "killShip",
    "scoresMaxScroll", "HS_ROW_CLIP_TOP", "HS_ROW_CLIP_BOTTOM", "HS_GAMEOVER_ROWS",
    "HS_RESET_LABEL", "HS_HINT"
  ];
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const A = factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
  A.__log = recCtx.log;
  return A;
}

// ⚠ CS034 P7: add() takes a COMPLETE record now (spec §6.6) — the caller assembles it, and the display
// field is `name`, not `initials`.
function fillFull(A) {
  A.HighScores.entries = [];
  for (let i = 0; i < A.SCORES_MAX; i++) {
    A.HighScores.add({ name: "P" + i, score: (i + 1) * 1000, wave: i + 1, delivered: i,
      durationS: 90 + i, saucerKills: i, satelliteKills: i * 2, build: "1.0.0.0" });
  }
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
  // ⚠ CS034 P7: SCORES_MAX (25) now exceeds what this table shows (HS_GAMEOVER_ROWS, 10), so the top
  // row is no longer the first record inserted — read the name off the sorted table rather than
  // guessing at a literal.
  const top = A.HighScores.entries[0].name;
  const name0 = rows.find(r => r.str === top);
  assert(name0 && near(name0.x, 640 - 170), "B: NAME column at cx-170 (unchanged column offset — CS034 P7 renamed the header, not the geometry)");
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
  const name0 = rows.find(r => r.str === A.HighScores.entries[0].name);
  assert(name0 && near(name0.x, 640 - 170 * 1.8), "C: NAME column offset scaled to cx-170*1.8");
})();

// ================= (D) drawHighScores(): the clip band and all chrome stay inside the panel ========
(function () {
  console.log("(D) drawHighScores() with a full table: the scroll band and every banded row sit inside the panel");
  const A = buildInstance();
  fillFull(A);
  A.__log.length = 0;
  A.drawHighScores();
  const panel = A.__log.find(e => e.op === "strokeRect");
  assert(panel, "D: menuPanel drew a strokeRect (panel bounds recoverable)");
  const top = panel.y, innerBottom = panel.y + panel.h;
  const band = A.__log.find(e => e.op === "rect");
  assert(band, "D: the row region really is clipped (a ctx.rect preceded ctx.clip)");
  assert(band.args[1] >= top && band.args[1] + band.args[3] <= innerBottom,
    `D: ⛔ the clip band [${band.args[1]}, ${band.args[1] + band.args[3]}] is inside the panel [${top}, ${innerBottom}]`);
  assert(near(band.args[1], A.HS_ROW_CLIP_TOP) && near(band.args[1] + band.args[3], A.HS_ROW_CLIP_BOTTOM),
    "D: ...and it is the very band scoresMaxScroll() measures against — one set of numbers, not two");

  // Eight columns per row, plus the eight headers. Only the rows inside the band are on screen, but the
  // stub does not clip, so count the header row instead and check the banded ones for position.
  const rows = A.__log.filter(e => e.op === "fillText");
  for (const h of ["#", "NAME", "SCORE", "LEVEL", "TIME", "DEBRIS", "SAUCERS", "SATELLITES"]) {
    assert(rows.some(r => r.str === h), `D: the "${h}" column header is drawn`);
  }
  const inBand = rows.filter(r => r.y >= A.HS_ROW_CLIP_TOP && r.y <= A.HS_ROW_CLIP_BOTTOM);
  assert(inBand.length > 0, "D: (non-vacuous) rows are visible inside the band at scroll 0");
  assert(inBand.every(r => r.y <= innerBottom), "D: ⛔ every visible row is inside the panel");
  // The chrome below the band — reset row and footer — is drawn OUTSIDE the clip and must clear the
  // panel too. Matched by their exact strings: an unclipped row's own cells also land past the band in
  // this stub (it records what the real canvas would discard), so a positional filter would catch them.
  for (const label of [A.HS_RESET_LABEL, A.HS_HINT]) {
    const c = rows.find(r => r.str === label);
    assert(c && c.y > A.HS_ROW_CLIP_BOTTOM, `D: "${label}" is drawn below the band...`);
    assert(c && c.y <= innerBottom, "D: ⛔ ...and clears the panel's bottom edge");
  }

  // At the scroll ceiling the LAST row lands inside the band — that is what "measure from the clip top"
  // buys, and the property celebrationMaxScroll()'s header says achMaxScroll()'s formula would miss.
  const max = A.scoresMaxScroll();
  assert(max > 0, "D: (setup) a full table genuinely scrolls");
  A.game.menu.scroll = max;
  A.__log.length = 0;
  A.drawHighScores();
  const lastRank = A.SCORES_MAX + ".";
  const last = A.__log.filter(e => e.op === "fillText").find(r => r.str === lastRank);
  assert(last && last.y <= A.HS_ROW_CLIP_BOTTOM && last.y > A.HS_ROW_CLIP_TOP,
    `D: ⛔ at full scroll the last row's baseline (${last && last.y}) is inside the band`);
})();

// ================= (E) gameover block, full table, stays within the 720-tall viewport =====================
(function () {
  console.log("(E) gameover block with a full table: every fillText y <= VIEW_H - 20");
  const A = buildInstance();
  A.AudioSys.init();
  A.startGame();
  fillFull(A);
  A.game.debris.length = 0; A.game.hunters.length = 0; A.game.saucers.length = 0;
  A.game.lastScoreId = A.HighScores.entries[0].id;
  A.killShip();
  const DT = 1 / 60;
  for (let i = 0; i < Math.ceil(A.DEATH_DURATION / DT) + 4; i++) A.update(DT);
  // ⚠ CS034 P7: a "force the settled table view, not the initials-entry slots" line stood here. The
  // gameover screen has only the one view now.
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
