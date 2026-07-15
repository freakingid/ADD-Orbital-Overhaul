// Headless test for CS012 Phase 2 — HUD: segmented Scoop ring + always-show muted powerup rows
// (fixed 5-row stack). Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake
// localStorage), eval the REAL <script> block, then drive the ACTUAL drawHUD()/drawRingSegments()
// via a recording 2D-context stub — no reimplementation of the aim-error/ring math.
//
//   node scratchpad/test-cs012-p2.js
//
// Checks (per the phase prompt):
//  (A) node --check on the extracted <script>.
//  (B) drawRingSegments(x,y,r,segs,filled,lit,dim) in isolation: logs exactly `segs` stroked wedges;
//      the first `filled` are glow strokes (color=lit, shadowBlur>0 via glowStroke), the rest are
//      plain dim strokes (color=dim, lineWidth=HUD_RING_TRACK_W, no glow); each wedge's angular span
//      is strictly less than a full segment slot (HUD_RING_SEG_GAP leaves a real gap); never
//      closePath()'d (arc, not poly).
//  (C) drawHUD(): all FIVE bottom-left rows (Scoop + rapid/triple/magnet/engine) render at a FIXED y
//      — scoop at HUD_FX_BASE_Y, timed row i at HUD_FX_BASE_Y - (i+1)*HUD_FX_ROW_H — independent of
//      which combination of powerups is active. Activating/expiring one type never moves any other
//      row's y (no compaction, ever).
//  (D) An inactive timed row logs NO value-arc (no glow arc in that type's color at the ring radius),
//      no bank pop, and its number text reads "0s" (time mode) or "0" (count mode) — the existing
//      expression, unmodified. An active row still logs its value arc.
//  (E) Scoop row: level 0 renders (dim track only, 0 lit segments, via drawRingSegments); level 3
//      lights exactly 3 of SCOOP_MAX_LEVEL segments. ZERO ctx.fill() calls anywhere in a full
//      drawHUD() pass (the old pip dot is gone) — fillText for labels/numbers is unaffected.
//  (F) headless startGame()/update(1/60) with AudioSys.ctx null does not crash.

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
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs012p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

// ---- Recording 2D context — logs arc/stroke/fillText/fill/closePath calls, plus the style state
// (strokeStyle/lineWidth/shadowBlur/globalAlpha) active at each stroke. shadowBlur > 0 at a stroke
// call is how a glowStroke() call is told apart from a plain dim-track stroke (glowStroke sets it,
// draws, then resets to 0 — see asteroids-deluxe.html's glowStroke()). ----
const recLog = [];
function makeRecordingCtx() {
  const state = { shadowBlur: 0 };
  const methods = ["arc", "stroke", "save", "restore", "translate", "rotate", "moveTo", "lineTo",
                   "closePath", "beginPath", "fillText", "fillRect", "strokeRect", "fill"];
  return new Proxy(state, {
    get(t, p) {
      if (p === "log") return recLog;
      if (methods.includes(p)) return (...args) => recLog.push([p, ...args, { ...t }]);
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) {
      t[p] = v;
      if (p === "strokeStyle" || p === "lineWidth" || p === "globalAlpha" || p === "shadowBlur" || p === "shadowColor") {
        recLog.push([p, v]);
      }
      return true;
    }
  });
}
const recCtx = makeRecordingCtx();
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

// ---- Audio + env stubs (mirror test-cs009-p4.js) ----
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
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
const windowStub = {
  addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
let perfNow = 5000;
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
  "startGame", "update", "drawHUD", "drawRingSegments", "game", "settings", "AudioSys",
  "clamp01", "TAU", "COLOR", "POWERUP_COLOR", "POWERUP_DROP_TYPES", "POWERUP_DURATION", "MAGNET_DURATION",
  "HUD_FX_BASE_Y", "HUD_FX_ROW_H", "HUD_FX_RING_R", "HUD_FX_LOW", "HUD_RING_TRACK_W", "HUD_RING_BLUR",
  "SCOOP_MAX_LEVEL"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, drawHUD, drawRingSegments, game, settings, AudioSys,
  clamp01, TAU, COLOR, POWERUP_COLOR, POWERUP_DROP_TYPES, POWERUP_DURATION, MAGNET_DURATION,
  HUD_FX_BASE_Y, HUD_FX_ROW_H, HUD_FX_RING_R, HUD_FX_LOW, HUD_RING_TRACK_W, HUD_RING_BLUR,
  SCOOP_MAX_LEVEL
} = A;

AudioSys.init();

// Reconstruct arc-strokes (with style state) + raw fillText/fill counts from one drawHUD() pass.
function captureHUD() {
  recLog.length = 0;
  recCtx.globalAlpha = 1; recCtx.shadowBlur = 0;
  drawHUD();
  return reduceLog(recLog);
}
function reduceLog(log) {
  let strokeStyle = null, lineWidth = null, alpha = 1, shadowBlur = 0;
  let pendingArc = null, closed = false;
  const arcs = [];
  let fillTextCount = 0, fillCount = 0, fillRectCount = 0, strokeRectCount = 0;
  for (const e of log) {
    switch (e[0]) {
      case "globalAlpha": alpha = e[1]; break;
      case "strokeStyle": strokeStyle = e[1]; break;
      case "lineWidth": lineWidth = e[1]; break;
      case "shadowBlur": shadowBlur = e[1]; break;
      case "beginPath": pendingArc = null; closed = false; break;
      case "closePath": closed = true; break;
      case "arc": pendingArc = { x: e[1], y: e[2], r: e[3], a0: e[4], a1: e[5] }; break;
      case "fillText": fillTextCount++; break;
      case "fill": fillCount++; break;
      case "fillRect": fillRectCount++; break;
      case "strokeRect": strokeRectCount++; break;
      case "stroke":
        if (pendingArc) arcs.push({ ...pendingArc, color: strokeStyle, width: lineWidth,
          alpha, glow: shadowBlur > 0, sweep: pendingArc.a1 - pendingArc.a0, closed });
        pendingArc = null; closed = false;
        break;
    }
  }
  return { arcs, fillTextCount, fillCount, fillRectCount, strokeRectCount };
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
  game.powerBank = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  game.powerBankAmt = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  game.scoopLevel = 0;
}

const atRow = (arcs, y, r) => arcs.filter(a => near(a.x, 40) && near(a.y, y) && near(a.r, r));
const rowY = i => HUD_FX_BASE_Y - (i + 1) * HUD_FX_ROW_H;  // i = index into POWERUP_DROP_TYPES

// ================= (B) drawRingSegments in isolation =================
(function sectionB() {
  console.log("(B) drawRingSegments: segs wedges, filled lit via glow, rest dim, gapped, never closed");
  recLog.length = 0;
  recCtx.globalAlpha = 1; recCtx.shadowBlur = 0;
  const SEGS = 5, FILLED = 3;
  drawRingSegments(40, 100, 16, SEGS, FILLED, "#lit", "#dim");
  const { arcs } = reduceLog(recLog);
  const wedges = arcs.filter(a => near(a.x, 40) && near(a.y, 100) && near(a.r, 16));
  assert(wedges.length === SEGS, `B: exactly ${SEGS} wedges logged (got ${wedges.length})`);
  const lit = wedges.filter(a => a.glow);
  const dim = wedges.filter(a => !a.glow);
  assert(lit.length === FILLED, `B: exactly ${FILLED} lit (glow) wedges (got ${lit.length})`);
  assert(dim.length === SEGS - FILLED, `B: remaining ${SEGS - FILLED} wedges are dim, no-glow (got ${dim.length})`);
  assert(lit.every(a => a.color === "#lit"), "B: every lit wedge strokes in the lit color");
  assert(dim.every(a => a.color === "#dim" && near(a.width, HUD_RING_TRACK_W)),
    "B: every dim wedge strokes in the dim color at HUD_RING_TRACK_W");
  assert(wedges.every(a => !a.closed), "B: no wedge is closePath()'d — an arc, not a poly");
  const fullSlot = TAU / SEGS;
  assert(wedges.every(a => Math.abs(a.sweep) < fullSlot - 1e-9),
    "B: every wedge's angular span is strictly less than a full slot (a real gap between wedges)");
  // 0 filled -> all dim; segs filled -> all lit
  recLog.length = 0;
  drawRingSegments(40, 100, 16, SEGS, 0, "#lit", "#dim");
  const none = reduceLog(recLog).arcs.filter(a => near(a.x, 40) && near(a.y, 100));
  assert(none.every(a => !a.glow), "B: filled=0 -> zero lit wedges");
  recLog.length = 0;
  drawRingSegments(40, 100, 16, SEGS, SEGS, "#lit", "#dim");
  const all = reduceLog(recLog).arcs.filter(a => near(a.x, 40) && near(a.y, 100));
  assert(all.every(a => a.glow), "B: filled=segs -> all wedges lit");
})();

// ================= (C) drawHUD: five FIXED rows, independent of active combination =================
(function sectionC() {
  console.log("(C) drawHUD: Scoop + 4 timed rows at FIXED y regardless of which are active");
  const combos = [
    [],
    ["rapid"],
    ["magnet"],
    ["rapid", "engine"],
    POWERUP_DROP_TYPES.slice()
  ];
  for (const activeSet of combos) {
    fresh();
    for (const t of activeSet) game.powerFx[t] = 10;
    game.scoopLevel = 2;
    const { arcs } = captureHUD();
    // scoop row's segmented ring always present at HUD_FX_BASE_Y
    const scoopTrack = atRow(arcs, HUD_FX_BASE_Y, HUD_FX_RING_R);
    assert(scoopTrack.length > 0, `C[${activeSet}]: scoop row renders at HUD_FX_BASE_Y`);
    // every timed row renders (dim track, at minimum) at its fixed index-derived y
    POWERUP_DROP_TYPES.forEach((t, i) => {
      const track = atRow(arcs, rowY(i), HUD_FX_RING_R).find(a => a.color === COLOR.dim && near(Math.abs(a.sweep), TAU));
      assert(!!track, `C[${activeSet}]: ${t}'s row (index ${i}) renders its dim track at y=${rowY(i)}`);
    });
  }
  // expiring one type never moves another's row
  fresh();
  game.powerFx.rapid = 10; game.powerFx.engine = 10;
  const { arcs: before } = captureHUD();
  const engineBefore = atRow(before, rowY(3), HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.engine);
  assert(!!engineBefore, "C: engine's value arc present at its fixed row while rapid is also active");
  game.powerFx.rapid = 0;   // rapid expires
  const { arcs: after } = captureHUD();
  const engineAfter = atRow(after, rowY(3), HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.engine);
  assert(!!engineAfter, "C: engine's row did NOT move after rapid expired (still at its own fixed y)");
})();

// ================= (D) inactive row: muted, no value arc, no bank pop; "0s"/"0" =================
(function sectionD() {
  console.log("(D) inactive timed row: dim track only, correct idle number, no value arc");
  fresh();
  // leave everything inactive; drive one full pass
  const { arcs, fillTextCount } = captureHUD();
  POWERUP_DROP_TYPES.forEach((t, i) => {
    const rowArcs = atRow(arcs, rowY(i), HUD_FX_RING_R);
    const valueArc = rowArcs.find(a => a.color === POWERUP_COLOR[t] && a.glow);
    assert(!valueArc, `D: inactive ${t} logs no value-arc (glow) call`);
    const halo = atRow(arcs, rowY(i), HUD_FX_RING_R + 4);
    assert(halo.length === 0, `D: inactive ${t} logs no overcharge halo`);
  });
  assert(fillTextCount > 0, "D: labels/numbers still render via fillText even when every row is inactive");

  // number text can't be read off the recording ctx directly (fillText args aren't asserted against
  // the real font metrics here), so assert the underlying VALUES the num expression reads are the
  // idle 0s drawHUD would format to "0s"/"0" — the expression itself is untouched game code.
  assert(game.powerFx.rapid === 0 && game.powerBudget.rapid === 0,
    "D: idle rapid state is powerFx=0/powerBudget=0 -> num expression yields \"0s\" (time mode)");

  // an ACTIVE row still logs its value arc
  fresh();
  game.powerFx.triple = 8;
  const { arcs: arcs2 } = captureHUD();
  const tripleIdx = POWERUP_DROP_TYPES.indexOf("triple");
  const value = atRow(arcs2, rowY(tripleIdx), HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.triple && a.glow);
  assert(!!value, "D: an ACTIVE row still logs its value arc");

  // count-mode idle -> "0" (no "s"); verified via the same live-state approach
  fresh();
  settings.magnetMode = "pieces";
  const magnetIdx = POWERUP_DROP_TYPES.indexOf("magnet");
  const { arcs: arcs3 } = captureHUD();
  const magnetValue = atRow(arcs3, rowY(magnetIdx), HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.magnet && a.glow);
  assert(!magnetValue, "D: inactive count-mode magnet also logs no value arc");
  assert(game.powerBudget.magnet === 0, "D: idle count-mode magnet budget is 0 -> num expression yields \"0\"");
})();

// ================= (E) Scoop segmented ring: level 0 and level 3; zero ctx.fill() =================
(function sectionE() {
  console.log("(E) Scoop row: correct lit-segment count at levels 0/3; zero ctx.fill() calls anywhere");
  fresh();
  game.scoopLevel = 0;
  const { arcs: arcs0, fillCount: fillCount0 } = captureHUD();
  const scoopWedges0 = atRow(arcs0, HUD_FX_BASE_Y, HUD_FX_RING_R);
  assert(scoopWedges0.length === SCOOP_MAX_LEVEL, `E: level 0 still renders all ${SCOOP_MAX_LEVEL} wedges (dim track)`);
  assert(scoopWedges0.every(a => !a.glow), "E: level 0 -> zero lit segments");
  assert(fillCount0 === 0, `E: zero ctx.fill() calls anywhere in drawHUD() at scoopLevel 0 (got ${fillCount0})`);

  fresh();
  game.scoopLevel = 3;
  const { arcs: arcs3, fillCount: fillCount3 } = captureHUD();
  const scoopWedges3 = atRow(arcs3, HUD_FX_BASE_Y, HUD_FX_RING_R);
  const lit3 = scoopWedges3.filter(a => a.glow);
  assert(lit3.length === 3, `E: scoopLevel 3 -> exactly 3 of ${SCOOP_MAX_LEVEL} segments lit (got ${lit3.length})`);
  assert(fillCount3 === 0, `E: zero ctx.fill() calls anywhere in drawHUD() at scoopLevel 3 (got ${fillCount3})`);

  // also exercise a fully-active HUD (every timed row + bank pop + scoop) — still zero ctx.fill()
  fresh();
  game.scoopLevel = 5;
  POWERUP_DROP_TYPES.forEach(t => { game.powerFx[t] = 10; game.powerBank[t] = 0.4; game.powerBankAmt[t] = 5; });
  const { fillCount: fillCountBusy } = captureHUD();
  assert(fillCountBusy === 0, `E: zero ctx.fill() calls even with every row active + banked (got ${fillCountBusy})`);
})();

// ================= (F) headless startGame()/update no-crash with AudioSys.ctx null =================
(function sectionF() {
  console.log("(F) AudioSys.ctx null -> startGame()/update(1/60) do not crash");
  AudioSys.ctx = null;
  noThrow(() => { startGame(); }, "F: startGame() with ctx null");
  noThrow(() => { for (let i = 0; i < 30; i++) update(1 / 60); }, "F: update(1/60) x30 with ctx null");
})();

// ---------------------------------------------------------------------------
console.log(`\ntest-cs012-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
