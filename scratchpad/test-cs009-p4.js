// Headless test for CS009 Phase 4 — powerup rings (dual-mode rows, overcharge halo, low-timer warning).
// FORK-3 A (overcharge halo) + FORK-5 (count-mode: track only, no arc).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL startGame()/drawHUD() — no reimplementation.
//
//   node scratchpad/test-cs009-p4.js
//
// A recording 2D ctx logs arc()/stroke() with the style state active at each stroke, so every ring
// arc drawn by drawHUD() (the dim track, the value arc, the overcharge halo) can be reconstructed by
// center, radius, sweep angle, color and width.
//
// Checks (per the phase prompt):
//  (A) TRAP 1 — with game.powerFx.magnet = 30 (== MAGNET_DURATION), the magnet VALUE arc sweeps a FULL
//      turn, not two: the denominator must be powerDuration("magnet")=30, not POWERUP_DURATION=15.
//  (B) TRAP 2 / FORK-3 A — with powerFx.rapid = 30 (double-banked vs a 15s denominator, frac=2.0), a
//      main value arc pinned at a full turn AND a second arc at the halo radius (HUD_FX_RING_R + 4)
//      are BOTH drawn.
//  (C) FORK-5 — with settings.magnetMode = "pieces" and powerBudget.magnet = 40, NO value arc is drawn
//      for that row: only the dim track (so the row shape is constant across modes).
//  (D) drawHUD() makes ZERO ctx.fillRect and ZERO ctx.strokeRect calls (the whole point of the rebuild).

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Recording 2D context ----
const recLog = [];
function makeRecordingCtx() {
  const state = {};
  const methods = ["arc", "stroke", "save", "restore", "translate", "rotate", "moveTo", "lineTo",
                   "closePath", "beginPath", "fillText", "fillRect", "strokeRect", "fill"];
  return new Proxy(state, {
    get(t, p) {
      if (p === "log") return recLog;
      if (methods.includes(p)) return (...args) => recLog.push([p, ...args]);
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) {
      t[p] = v;
      if (p === "strokeStyle" || p === "lineWidth" || p === "globalAlpha") recLog.push([p, v]);
      return true;
    }
  });
}
const recCtx = makeRecordingCtx();
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

// ---- Audio + env stubs (mirror test-cs009-p2) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, setPeriodicWave() {}
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
let perfNow = 0;                              // controllable clock (pulse alpha depends on it)
const performanceStub = { now: () => perfNow };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "drawHUD", "game", "settings", "AudioSys", "clamp01", "TAU", "COLOR",
  "POWERUP_COLOR", "POWERUP_DURATION", "MAGNET_DURATION",
  "HUD_FX_BASE_Y", "HUD_FX_ROW_H", "HUD_FX_RING_R", "HUD_FX_LOW", "HUD_RING_TRACK_W"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, drawHUD, game, settings, AudioSys, clamp01, TAU, COLOR,
  POWERUP_COLOR, POWERUP_DURATION, MAGNET_DURATION,
  HUD_FX_BASE_Y, HUD_FX_ROW_H, HUD_FX_RING_R, HUD_FX_LOW, HUD_RING_TRACK_W
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

AudioSys.init();

// Reconstruct arc strokes (+ fill/stroke-rect counts) from a fresh drawHUD() pass.
function captureHUD() {
  recLog.length = 0;
  recCtx.globalAlpha = 1;              // draw() would have left it at 1; start clean
  drawHUD();
  let strokeStyle = null, lineWidth = null, alpha = 1;
  let pendingArc = null, isPoly = false;
  const arcs = [];
  let fillRectCount = 0, strokeRectCount = 0;
  for (const e of recLog) {
    switch (e[0]) {
      case "globalAlpha": alpha = e[1]; break;
      case "strokeStyle": strokeStyle = e[1]; break;
      case "lineWidth": lineWidth = e[1]; break;
      case "beginPath": pendingArc = null; isPoly = false; break;
      case "arc": pendingArc = { x: e[1], y: e[2], r: e[3], a0: e[4], a1: e[5] }; break;
      case "moveTo": case "lineTo": isPoly = true; break;
      case "fillRect": fillRectCount++; break;
      case "strokeRect": strokeRectCount++; break;
      case "stroke":
        if (pendingArc) arcs.push({ ...pendingArc, color: strokeStyle, width: lineWidth, alpha,
          sweep: pendingArc.a1 - pendingArc.a0 });
        pendingArc = null; isPoly = false;
        break;
    }
  }
  return { arcs, fillRectCount, strokeRectCount };
}

// Reset settings + all effect state, then start a run in "playing".
function fresh() {
  startGame();
  game.state = "playing"; game.paused = false;
  settings.shotPowerupMode = "time";
  settings.magnetMode = "time";
  game.powerups = [];
  game.powerFx = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  game.powerBudget = { rapid: 0, triple: 0, magnet: 0 };
}

// CS012 P2: rows are FIXED by index in POWERUP_DROP_TYPES (["rapid","triple","magnet","engine"]),
// never compacted — row i sits at HUD_FX_BASE_Y - (i+1)*HUD_FX_ROW_H regardless of which other types
// are active/inactive. ROW1_Y (rapid, index 0) happens to match the old "first active slot" value;
// MAGNET_Y (index 2) does not, since magnet is no longer compacted down to slot 1 when it's the only
// active effect.
const ROW1_Y = HUD_FX_BASE_Y - 1 * HUD_FX_ROW_H;
const MAGNET_Y = HUD_FX_BASE_Y - 3 * HUD_FX_ROW_H;
// arcs centered on a powerup ring column (x = 40), by radius
const atRow = (arcs, y, r) => arcs.filter(a => near(a.x, 40) && near(a.y, y) && near(a.r, r));

// ================= (A) TRAP 1 — magnet denominator is 30, not 15 =================
(function sectionA() {
  perfNow = 5000;                       // above HUD_FX_LOW so no pulse muddies the alpha read
  fresh();
  game.powerFx.magnet = MAGNET_DURATION;   // 30s remaining, full magnet duration -> frac must be 1.0
  const { arcs } = captureHUD();

  // magnet's row is FIXED at its POWERUP_DROP_TYPES index (2), active or not (CS012 P2)
  const value = atRow(arcs, MAGNET_Y, HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.magnet);
  assert(!!value, "A: magnet value arc drawn in POWERUP_COLOR.magnet");
  assert(value && near(value.sweep, TAU),
    `A: magnet arc sweeps a FULL turn (denominator 30, not 15) — got sweep ${value && value.sweep} (expected ${TAU})`);
  // guard: it must NOT be two turns (the bug is frac = 30/15 = 2 -> sweep 2*TAU)
  assert(value && Math.abs(value.sweep) <= TAU + 1e-6,
    "A: magnet arc does NOT sweep two turns (would mean POWERUP_DURATION=15 was used as the denominator)");
  // sanity: the dim track is still there at the same radius
  const track = atRow(arcs, MAGNET_Y, HUD_FX_RING_R).find(a => a.color === COLOR.dim && near(Math.abs(a.sweep), TAU));
  assert(!!track, "A: dim full-circle track drawn under the magnet ring");
})();

// ================= (B) TRAP 2 / FORK-3 A — double-banked -> main arc full + halo =================
(function sectionB() {
  perfNow = 5000;
  fresh();
  game.powerFx.rapid = 2 * POWERUP_DURATION;   // 30s vs a 15s denominator -> frac = 2.0
  const { arcs } = captureHUD();

  const main = atRow(arcs, ROW1_Y, HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.rapid);
  assert(!!main, "B: rapid main value arc drawn");
  assert(main && near(main.sweep, TAU), `B: main arc pinned at a FULL turn (clamp01 of frac=2) — got ${main && main.sweep}`);

  const halo = atRow(arcs, ROW1_Y, HUD_FX_RING_R + 4).find(a => a.color === POWERUP_COLOR.rapid);
  assert(!!halo, "B: overcharge halo arc drawn at HUD_FX_RING_R + 4");
  assert(halo && near(halo.sweep, TAU), `B: halo shows clamp01(frac-1)=1.0 -> full turn — got ${halo && halo.sweep}`);
  // a partially-banked case: frac = 1.5 -> halo sweeps a HALF turn
  fresh();
  game.powerFx.rapid = 1.5 * POWERUP_DURATION;
  const { arcs: arcs2 } = captureHUD();
  const halo2 = atRow(arcs2, ROW1_Y, HUD_FX_RING_R + 4).find(a => a.color === POWERUP_COLOR.rapid);
  assert(halo2 && near(halo2.sweep, TAU * 0.5), `B: halo sweep tracks frac-1 (1.5->0.5 turn) — got ${halo2 && halo2.sweep}`);

  // and a NON-overcharged case (frac < 1) draws NO halo
  fresh();
  game.powerFx.rapid = 0.5 * POWERUP_DURATION;
  const { arcs: arcs3 } = captureHUD();
  const halo3 = atRow(arcs3, ROW1_Y, HUD_FX_RING_R + 4);
  assert(halo3.length === 0, "B: no halo arc when frac <= 1");
})();

// ================= (C) FORK-5 — count mode: track only, no value arc =================
(function sectionC() {
  perfNow = 5000;
  fresh();
  settings.magnetMode = "pieces";              // magnet now a count-mode effect
  game.powerBudget.magnet = 40;                // budget remaining -> powerActive("magnet") true
  const { arcs } = captureHUD();

  const rowArcs = atRow(arcs, MAGNET_Y, HUD_FX_RING_R);
  const track = rowArcs.find(a => a.color === COLOR.dim && near(Math.abs(a.sweep), TAU));
  assert(!!track, "C: dim full-circle track still drawn in count mode (row shape constant)");
  const valueArc = rowArcs.find(a => a.color === POWERUP_COLOR.magnet);
  assert(!valueArc, "C: NO value arc drawn for a count-mode row (track only)");
  // and definitely no overcharge halo either
  const halo = atRow(arcs, MAGNET_Y, HUD_FX_RING_R + 4);
  assert(halo.length === 0, "C: no overcharge halo in count mode");
})();

// ================= (D) zero fillRect / zero strokeRect anywhere in drawHUD() =================
(function sectionD() {
  perfNow = 5000;
  fresh();
  // exercise several rows at once (time + a low-timer + count) so the whole powerup path runs
  settings.magnetMode = "pieces";
  game.powerFx.rapid = 8;                       // time mode, normal
  game.powerFx.triple = 2;                      // time mode, low-timer warning (<= HUD_FX_LOW)
  game.powerFx.engine = 20;                     // time mode, overcharged (>15)
  game.powerBudget.magnet = 25;                 // count mode
  game.scoopLevel = 3;                          // SCOOP segmented ring draws too (strokes only, no fills)
  const { fillRectCount, strokeRectCount } = captureHUD();
  assert(fillRectCount === 0, `D: drawHUD() makes ZERO fillRect calls (got ${fillRectCount})`);
  assert(strokeRectCount === 0, `D: drawHUD() makes ZERO strokeRect calls (got ${strokeRectCount})`);
})();

// ================= (E) low-timer warning: time mode only =================
(function sectionE() {
  perfNow = 5000;
  fresh();
  game.powerFx.rapid = 2;                       // <= HUD_FX_LOW (3) in TIME mode -> lowhp color
  const { arcs } = captureHUD();
  const value = atRow(arcs, ROW1_Y, HUD_FX_RING_R).find(a => a.color === COLOR.lowhp);
  assert(!!value, "E: a low timer (2s <= HUD_FX_LOW) colors the ring COLOR.lowhp");

  // count mode with a small budget is NOT a deadline -> NOT low-colored (FLAG-E)
  fresh();
  settings.shotPowerupMode = "shots";
  game.powerBudget.rapid = 2;                   // budget of 2 shots, but count mode has no low warning
  const { arcs: arcs2 } = captureHUD();
  const lowArc = atRow(arcs2, ROW1_Y, HUD_FX_RING_R).find(a => a.color === COLOR.lowhp);
  assert(!lowArc, "E: a small COUNT budget is not a deadline — no low-timer coloring (FLAG-E)");
  // (count mode draws no value arc at all, but the glyph/label are also not lowhp; the track stays dim)
  const track = atRow(arcs2, ROW1_Y, HUD_FX_RING_R).find(a => a.color === COLOR.dim);
  assert(!!track, "E: count-mode row still has its dim track");
})();

// ================= (F) CS012 P2: fixed rows — a row NEVER moves when other rows (de)activate =================
(function sectionF() {
  perfNow = 5000;
  // rapid (index 0) and magnet (index 2) both active — each at its OWN fixed row, with the inactive
  // triple (index 1) row's y left as a gap, not collapsed.
  fresh();
  game.powerFx.rapid = 10;
  game.powerFx.magnet = 10;
  const { arcs } = captureHUD();
  const rapidY = HUD_FX_BASE_Y - 1 * HUD_FX_ROW_H;
  const rapidArc = arcs.find(a => near(a.x, 40) && near(a.y, rapidY) && a.color === POWERUP_COLOR.rapid);
  const magnetArc = arcs.find(a => near(a.x, 40) && near(a.y, MAGNET_Y) && a.color === POWERUP_COLOR.magnet);
  assert(!!rapidArc, "F: rapid (index 0) sits at its fixed row (y = BASE - 1*ROW_H)");
  assert(!!magnetArc, "F: magnet (index 2) sits at its fixed row (y = BASE - 3*ROW_H)");

  // Now expire rapid: magnet MUST NOT move — no compaction, ever (the point of CS012 P2).
  fresh();
  game.powerFx.magnet = 10;                     // only magnet active now
  const { arcs: arcs2 } = captureHUD();
  const magnetArc2 = arcs2.find(a => near(a.x, 40) && near(a.y, MAGNET_Y) && a.color === POWERUP_COLOR.magnet);
  const magnetAtRapidSlot = arcs2.find(a => near(a.x, 40) && near(a.y, rapidY) && a.color === POWERUP_COLOR.magnet);
  assert(!!magnetArc2, "F: with rapid gone, magnet STAYS at its own fixed row (y = BASE - 3*ROW_H)");
  assert(!magnetAtRapidSlot, "F: magnet does NOT compact down into rapid's row");

  // and rapid's now-inactive row still renders (dim, muted) at its fixed y, not removed
  const rapidTrack = arcs2.find(a => near(a.x, 40) && near(a.y, rapidY) && a.color === COLOR.dim && near(Math.abs(a.sweep), TAU));
  assert(!!rapidTrack, "F: rapid's row still renders its dim track when inactive (muted, not hidden)");
})();

// ---------------------------------------------------------------------------
console.log(`\ntest-cs009-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
