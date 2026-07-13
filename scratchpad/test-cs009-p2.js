// Headless test for CS009 Phase 2 — HULL ring + concentric shield arc (FORK-1 A).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL startGame()/drawHUD() — no reimplementation.
//
//   node scratchpad/test-cs009-p2.js
//
// A recording 2D ctx logs arc/stroke/save/restore/translate/rotate/moveTo/lineTo + strokeStyle/
// lineWidth/globalAlpha/fillText/fillRect/strokeRect, so the three arcs (track, shield, hull) and the
// ship-glyph poly drawn by drawHUD() can be reconstructed with the style state active at each stroke.
//
// Checks:
//  (A) structure at Normal HP — dim full-circle track (no glow, HUD_RING_TRACK_W), a hull value arc
//      (COLOR.hp, HUD_RING_W), a concentric shield arc (COLOR.shield, thinner), a ship-glyph poly at
//      the ring center nose-up, and a centered "HULL" label. All at globalAlpha 1.
//  (B) the hull ARC sweep reads the eased game.hudHull, while the STATE color reads the TRUE hp — so a
//      fresh critical hit is red immediately even though the arc still shows the old (eased) fill.
//  (C) three mutually-exclusive states by true hp: MAX=gold/no-pulse, Critical=red/pulse, Normal=green.
//  (D) the shield arc is NEVER state-colored and is NOT eased — stays COLOR.shield at frac=energy even
//      while the hull is critical.
//  (E) the pulse fires only when Critical, and globalAlpha is always restored to 1 on return.

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

// ---- Audio + env stubs (mirror test-cs009-p1) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }
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
let perfNow = 0;                              // controllable clock: at 0, the pulse alpha is 0.6 (!= 1)
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
  "startGame", "drawHUD", "game", "AudioSys", "clamp01", "TAU", "COLOR",
  "SHIP_MAX_HP", "LOW_HP_THRESHOLD",
  "HUD_RING_R", "HUD_RING_W", "HUD_RING_TRACK_W", "HUD_HULL_CX", "HUD_RING_CY",
  "HUD_SHIELD_R_GAP", "HUD_RING_LABEL_Y", "HUD_PULSE_HZ", "HUD_SHIP_GLYPH"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, drawHUD, game, AudioSys, clamp01, TAU, COLOR,
  SHIP_MAX_HP, LOW_HP_THRESHOLD,
  HUD_RING_R, HUD_RING_W, HUD_RING_TRACK_W, HUD_HULL_CX, HUD_RING_CY,
  HUD_SHIELD_R_GAP, HUD_RING_LABEL_Y, HUD_PULSE_HZ, HUD_SHIP_GLYPH
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

AudioSys.init();

// Reconstruct stroke events + text/rect calls + the final globalAlpha from a fresh drawHUD() pass.
function captureHUD() {
  recLog.length = 0;
  recCtx.globalAlpha = 1;              // draw() would have left it at 1; start clean
  drawHUD();
  let strokeStyle = null, lineWidth = null, alpha = 1;
  let translate = null, rotate = null, pendingArc = null, isPoly = false;
  const arcs = [], polys = [], texts = [], fillRects = [], strokeRects = [];
  for (const e of recLog) {
    switch (e[0]) {
      case "globalAlpha": alpha = e[1]; break;
      case "strokeStyle": strokeStyle = e[1]; break;
      case "lineWidth": lineWidth = e[1]; break;
      case "save": translate = null; rotate = null; break;
      case "restore": translate = null; rotate = null; break;
      case "translate": translate = [e[1], e[2]]; break;
      case "rotate": rotate = e[1]; break;
      case "beginPath": pendingArc = null; isPoly = false; break;
      case "arc": pendingArc = { x: e[1], y: e[2], r: e[3], a0: e[4], a1: e[5] }; break;
      case "moveTo": case "lineTo": isPoly = true; break;
      case "fillText": texts.push({ str: e[1], x: e[2], y: e[3] }); break;
      case "fillRect": fillRects.push(e.slice(1)); break;
      case "strokeRect": strokeRects.push(e.slice(1)); break;
      case "stroke":
        if (pendingArc) arcs.push({ ...pendingArc, color: strokeStyle, width: lineWidth, alpha });
        else if (isPoly) polys.push({ translate, rotate, color: strokeStyle, alpha });
        pendingArc = null; isPoly = false;
        break;
    }
  }
  return { arcs, polys, texts, fillRects, strokeRects, finalAlpha: alpha };
}
// arcs centered on the HULL ring, by radius
const atR = (arcs, r) => arcs.filter(a => near(a.x, HUD_HULL_CX) && near(a.y, HUD_RING_CY) && near(a.r, r));
const shipGlyph = polys => polys.find(p => p.translate && near(p.translate[0], HUD_HULL_CX) && near(p.translate[1], HUD_RING_CY));

function setup(hp, energy, hudHull) {
  startGame();
  game.state = "playing"; game.paused = false;
  game.ship.hp = hp;
  game.ship.energy = energy;
  game.hudHull = hudHull;
  game.powerups = [];              // no health powerup -> no low-health chevron to pollute the poly list
}

// ================= (A) structure at Normal HP =================
(function sectionA() {
  perfNow = 0;
  setup(150, 0.5, 150 / SHIP_MAX_HP);      // 60% hull: above LOW (100), below MAX (250) -> Normal
  const { arcs, polys, texts, finalAlpha } = captureHUD();

  const track = atR(arcs, HUD_RING_R).find(a => near(a.a0, 0) && near(Math.abs(a.a1 - a.a0), TAU));
  assert(!!track, "A: full-circle track arc at HUD_RING_R (0..TAU)");
  assert(track && track.color === COLOR.dim, `A: track is COLOR.dim (got ${track && track.color})`);
  assert(track && track.width === HUD_RING_TRACK_W, `A: track width is HUD_RING_TRACK_W (got ${track && track.width})`);

  const hull = atR(arcs, HUD_RING_R).find(a => a.color === COLOR.hp);
  assert(!!hull, "A: hull value arc in COLOR.hp (Normal state)");
  assert(hull && hull.width === HUD_RING_W, `A: hull arc width is HUD_RING_W (got ${hull && hull.width})`);
  assert(hull && near(hull.a0, -Math.PI / 2), "A: hull arc starts at 12 o'clock (-PI/2)");
  assert(hull && near(hull.a1, -Math.PI / 2 + TAU * clamp01(game.hudHull)),
    "A: hull arc sweep = TAU * clamp01(hudHull)");

  const shield = atR(arcs, HUD_RING_R - HUD_SHIELD_R_GAP)[0];
  assert(!!shield, "A: concentric shield arc at HUD_RING_R - HUD_SHIELD_R_GAP");
  assert(shield && shield.color === COLOR.shield, `A: shield arc is COLOR.shield (got ${shield && shield.color})`);
  assert(shield && shield.width === HUD_RING_TRACK_W + 1, `A: shield arc is thinner (HUD_RING_TRACK_W+1, got ${shield && shield.width})`);

  const glyph = shipGlyph(polys);
  assert(!!glyph, "A: ship glyph poly drawn at the ring center");
  assert(glyph && near(glyph.rotate, -Math.PI / 2), "A: ship glyph is nose-up (angle -PI/2)");
  assert(glyph && glyph.color === COLOR.hp, `A: ship glyph takes the state color (got ${glyph && glyph.color})`);

  const label = texts.find(t => t.str === "HULL");
  assert(!!label, "A: HULL label drawn");
  assert(label && near(label.x, HUD_HULL_CX) && near(label.y, HUD_RING_LABEL_Y), "A: HULL label centered under the ring");

  assert(finalAlpha === 1, `A: globalAlpha restored to 1 (Normal, got ${finalAlpha})`);

  // HUD_SHIP_GLYPH is the 55%-scaled hull poly (4 vertices), authored as a constant, not scaled at draw.
  assert(Array.isArray(HUD_SHIP_GLYPH) && HUD_SHIP_GLYPH.length === 4, "A: HUD_SHIP_GLYPH is a 4-vertex array");
  assert(near(HUD_SHIP_GLYPH[0][0], 16 * 0.55) && near(HUD_SHIP_GLYPH[1][1], -9 * 0.55),
    "A: HUD_SHIP_GLYPH is the hull poly scaled to 55%");
})();

// ================= (B) arc = eased hudHull, color = TRUE hp =================
(function sectionB() {
  perfNow = 0;
  // TRUE hp is critical (80 <= 100) but the eased hudHull hasn't caught up yet (still 0.9). The ARC
  // must show the old fill (0.9) while the COLOR flips to red immediately from the true hp.
  setup(80, 0.5, 0.9);
  const { arcs } = captureHUD();
  const hull = atR(arcs, HUD_RING_R).find(a => a.color === COLOR.lowhp);
  assert(!!hull, "B: hull arc color is red from TRUE hp (80 <= LOW), not the eased value");
  assert(hull && near(hull.a1, -Math.PI / 2 + TAU * clamp01(0.9)),
    "B: hull arc SWEEP still reads the eased hudHull (0.9), not hp/max (0.32)");
})();

// ================= (C) three states by true hp =================
(function sectionC() {
  perfNow = 0;
  // MAX
  setup(SHIP_MAX_HP, 0.5, 1);
  let cap = captureHUD();
  let hull = atR(cap.arcs, HUD_RING_R).find(a => a.color === COLOR.ach);
  let glyph = shipGlyph(cap.polys);
  assert(!!hull && glyph && glyph.color === COLOR.ach, "C: MAX -> hull arc + glyph are COLOR.ach gold");
  assert(hull && hull.alpha === 1 && glyph.alpha === 1, "C: MAX does not pulse (alpha 1)");

  // Critical
  setup(LOW_HP_THRESHOLD, 0.5, LOW_HP_THRESHOLD / SHIP_MAX_HP);   // hp == threshold counts as critical (<=)
  cap = captureHUD();
  hull = atR(cap.arcs, HUD_RING_R).find(a => a.color === COLOR.lowhp);
  glyph = shipGlyph(cap.polys);
  assert(!!hull && glyph && glyph.color === COLOR.lowhp, "C: Critical -> hull arc + glyph are COLOR.lowhp red");

  // Normal
  setup(150, 0.5, 0.6);
  cap = captureHUD();
  hull = atR(cap.arcs, HUD_RING_R).find(a => a.color === COLOR.hp);
  glyph = shipGlyph(cap.polys);
  assert(!!hull && glyph && glyph.color === COLOR.hp, "C: Normal -> hull arc + glyph are COLOR.hp green");
  assert(hull.alpha === 1 && glyph.alpha === 1, "C: Normal does not pulse (alpha 1)");
})();

// ================= (D) shield arc: never state-colored, never eased =================
(function sectionD() {
  perfNow = 0;
  setup(LOW_HP_THRESHOLD, 0.5, 0.4);       // Critical hull, shield half-full
  const { arcs } = captureHUD();
  const shield = atR(arcs, HUD_RING_R - HUD_SHIELD_R_GAP)[0];
  assert(shield && shield.color === COLOR.shield, "D: shield stays COLOR.shield even while the hull is critical");
  assert(shield && shield.alpha === 1, "D: shield arc is not pulsed (drawn at full alpha, before the pulse)");
  assert(shield && near(shield.a1, -Math.PI / 2 + TAU * 0.5),
    "D: shield sweep reads game.ship.energy directly (0.5), un-eased");
})();

// ================= (E) pulse fires only when Critical; alpha always restored =================
(function sectionE() {
  perfNow = 0;                              // sin(0) -> pulse alpha = 0.6 + 0.4*0 = 0.6
  const expectedPulse = 0.6 + 0.4 * Math.sin(perfNow / 1000 * TAU * HUD_PULSE_HZ);

  setup(80, 0.5, 0.4);                      // Critical
  let cap = captureHUD();
  let hull = atR(cap.arcs, HUD_RING_R).find(a => a.color === COLOR.lowhp);
  let glyph = shipGlyph(cap.polys);
  assert(hull && near(hull.alpha, expectedPulse), `E: Critical hull arc is pulsed (got ${hull && hull.alpha}, want ${expectedPulse})`);
  assert(glyph && near(glyph.alpha, expectedPulse), "E: Critical ship glyph pulses with the same alpha");
  assert(cap.finalAlpha === 1, `E: globalAlpha restored to 1 after a pulsed frame (got ${cap.finalAlpha})`);

  // Not critical -> no pulse at all, alpha never leaves 1.
  setup(150, 0.5, 0.6);                     // Normal
  cap = captureHUD();
  const anyNon1 = cap.arcs.concat(cap.polys).some(x => x.alpha !== 1);
  assert(!anyNon1, "E: Normal state never sets globalAlpha off 1");
  assert(cap.finalAlpha === 1, "E: globalAlpha is 1 through a non-critical frame");
})();

// ---- summary ----
console.log(`\ntest-cs009-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
