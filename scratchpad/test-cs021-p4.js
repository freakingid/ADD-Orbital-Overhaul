// Headless test for CS021 Phase 4 — the HUD delivery-combo readout, closing FLAG-CS020-i.
//
//   node scratchpad/test-cs021-p4.js
//
// WHAT LANDED (PLANNED-FEATURES-CS021.md §10). A new drawHUD() line, left column under Score/Level:
// whenever game.deliveryCount > 0, "COMBO <deliveryCount>/<cargoMax>" in COLOR.dock (the existing
// dock/delivery colour role — the same hue as the dock chevron and every delivery FloatText). It is
// DISPLAY ONLY: three new named constants (HUD_COMBO_X/Y/SIZE) and one new drawText() call, gated on a
// read of game.deliveryCount — nothing writes game.deliveryCount or game.cargoMax, no new game-state
// field, no reflow of any existing HUD element. Ships PLAIN per spec §10: no grace-window countdown.
//
// The counter itself is entirely CS020 P1/P1b machinery, untouched by this phase — the dock-offload
// block increments it on a TOWED offload, and already zeroes it on all three routes an effort can end
// (a fresh towed hook outside the ring, the DOCK_COMBO_GRACE window expiring while outside the ring, and
// scatterChain() on ship death). Because the readout only ever READS game.deliveryCount, those three
// routes need no dedicated readout logic — this file drives all three for real and watches the readout
// disappear as a CONSEQUENCE, not because any route is special-cased in the new code.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/update/nextWave/killShip/dock-offload/drawHUD paths.
// AudioSys/VoiceSys are left entirely unwired (ctx stays null) — both are documented headless-safe
// (every method early-returns when ctx is null), and nothing in this phase touches audio.
//
// Sections:
//  (A) node --check + source pins: the three HUD_COMBO_* constants, the gate, the DISPLAY-ONLY property
//      (no write to game.deliveryCount/game.cargoMax in the new block, no grace-window reference — ships
//      plain), the global game.deliveryCount write-site count UNCHANGED from P3, and the existing ring
//      layout constants (HULL/CARGO/powerup stack) unmoved — no reflow.
//  (B) THE CS020 P1b 8/1100 SCENARIO — the readout tracks deliveryCount through a full skirt-and-return:
//      absent while towing, "3/8" after the first stint, holds through the skirt, "8/8" at the end.
//  (C) INCIDENTALS DO NOT ADVANCE IT — at deliveryCount 0, and at a non-zero baseline, an incidental
//      hooked and offloaded at dock.radius + 39 leaves the counter (and the readout) exactly unchanged.
//  (D) VANISHES ON WINDOW EXPIRY — visible while comboGrace counts down outside the ring, gone the exact
//      frame game.deliveryCount hits 0.
//  (E) VANISHES ON SHIP DEATH — killShip() -> scatterChain() zeroes it; the readout is gone immediately.
//  (F) NEVER APPEARS AT deliveryCount 0 — a fresh game, and ordinary non-dock play, draw no "COMBO" text.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS021_HTML || path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const mm = html.match(/<script>([\s\S]*?)<\/script>/);
if (!mm) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = mm[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs021p4_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment (the standing stub idiom). No audio wiring at all — AudioSys/VoiceSys stay
// ctx-null and every call through them is documented headless-safe (CLAUDE.md).
function makeRecordingCtx(log) {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "fillText") return (str, x, y) => log.push({ str, x, y, fillStyle: t.fillStyle });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "settings", "startGame", "update", "drawHUD", "nextWave", "killShip", "scatterChain",
  "breakChain", "Garbage", "dist2", "DEBUG", "COLOR", "TAU", "WORLD_W", "WORLD_H",
  "GAME_VERSION", "DOCK_BASE_SCORE", "DOCK_BONUS_STEP", "DOCK_NEIGHBORHOOD_PAD", "DOCK_COMBO_GRACE",
  "DOCK_OFFLOAD_INTERVAL", "CARGO_CAP_MAX", "CARGO_BASE",
  "HUD_COMBO_X", "HUD_COMBO_Y", "HUD_COMBO_SIZE", "HUD_HULL_CX", "HUD_CARGO_CX", "HUD_RING_CY",
  "HUD_RING_LABEL_Y", "HUD_FX_BASE_Y", "HUD_FX_ROW_H",
];

function build({ src = scriptSrc } = {}) {
  const recLog = [];
  const c = makeRecordingCtx(recLog);
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: undefined, webkitAudioContext: undefined
  };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };"
  );
  const X = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  X.__log = recLog;
  return X;
}

// The readout's own text, if drawn this frame; null if absent. Asserts there is never more than one.
function comboText(X) {
  X.__log.length = 0;
  X.drawHUD();
  const hits = X.__log.filter(e => typeof e.str === "string" && e.str.indexOf("COMBO ") === 0);
  assert(hits.length <= 1, "at most one COMBO fillText per drawHUD() pass (got " + hits.length + ")");
  return hits.length ? hits[0] : null;
}

// ---- shared staging helpers (mirror test-cs020-p1b.js's idiom — real entry points, nothing reimplemented) ----
function quiet(X) {
  X.game.state = "playing"; X.game.paused = false;
  X.game.dock.x = X.WORLD_W / 2; X.game.dock.y = X.WORLD_H / 2;
  X.game.debris.length = 1;
  X.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  X.game.hunters.length = 0; X.game.saucers.length = 0; X.game.bullets.length = 0;
  X.game.garbage.length = 0; X.game.powerups.length = 0; X.game.floaters.length = 0;
  X.game.chain.length = 0;
  X.game.saucerTimer = 1e6; X.game.healthTimer = 1e6; X.game.hunterTimer = 1e6;
  X.game.ship.dead = false; X.game.ship.vx = 0; X.game.ship.vy = 0;
  X.game.deliveryCount = 0; X.game.offloadTimer = 0;
}
function placeShip(X, pad) {
  const tx = X.game.dock.x + X.game.dock.radius + pad, ty = X.game.dock.y;
  const dx = tx - X.game.ship.x, dy = ty - X.game.ship.y;
  X.game.ship.x = tx; X.game.ship.y = ty;
  X.game.ship.vx = 0; X.game.ship.vy = 0;
  for (const n of X.game.chain) { n.x += dx; n.y += dy; n.px += dx; n.py += dy; }
}
function feedCanister(X, mass = 1.0) {
  const g = new X.Garbage(X.game.ship.x, X.game.ship.y, 0, 0, mass);
  g.coalesceDelay = 1e6;
  X.game.garbage.push(g);
  return g;
}
function hold(X, pad, frames) {
  for (let f = 0; f < frames; f++) {
    placeShip(X, pad);
    X.update(1 / 60);
    X.game.powerups.length = 0;
  }
}
function gatherAndArrive(X, n, outPad = 600) {
  placeShip(X, outPad);
  for (let i = 0; i < n; i++) feedCanister(X);
  hold(X, outPad, 1);
  placeShip(X, -20);
  return X.game.chain.length;
}

const A = build();
const {
  GAME_VERSION, DOCK_BASE_SCORE, DOCK_BONUS_STEP, DOCK_NEIGHBORHOOD_PAD, DOCK_COMBO_GRACE,
  CARGO_BASE, HUD_COMBO_X, HUD_COMBO_Y, HUD_COMBO_SIZE, HUD_HULL_CX, HUD_CARGO_CX, HUD_RING_CY,
  HUD_RING_LABEL_Y, HUD_FX_BASE_Y, HUD_FX_ROW_H, COLOR,
} = A;

// The whole drawHUD() left-column block, sliced out of the real source — the source pins below are
// about what IS and is NOT inside it.
const comboBlockSrc = (() => {
  const a = scriptSrc.indexOf('drawText("LEVEL " + game.wave');
  const b = scriptSrc.indexOf("CS009 P2: the hull + shield fill bars", a);
  return a > 0 && b > a ? scriptSrc.slice(a, b) : "";
})();
const stripComments = s => s.replace(/\/\/[^\n]*/g, "");
const codeSrc = stripComments(scriptSrc);
const comboBlockCode = stripComments(comboBlockSrc);

// ================= (A, part 2) source pins =====================
(function sectionA_pins() {
  assert(comboBlockSrc.length > 0, "A: the LEVEL-to-HULL slice of drawHUD() could be extracted");

  assert(/const HUD_COMBO_X\s*=\s*30;/.test(scriptSrc), "A: HUD_COMBO_X declared, left margin matches Score/Level");
  assert(/const HUD_COMBO_Y\s*=/.test(scriptSrc), "A: HUD_COMBO_Y declared");
  assert(/const HUD_COMBO_SIZE\s*=/.test(scriptSrc), "A: HUD_COMBO_SIZE declared");
  eq((scriptSrc.match(/const HUD_COMBO_X\s*=/g) || []).length, 1, "A: HUD_COMBO_X declared exactly once");

  assert(/if\s*\(\s*game\.deliveryCount\s*>\s*0\s*\)/.test(comboBlockCode),
    "A: the readout is gated on game.deliveryCount > 0");
  assert(/drawText\(\s*"COMBO\s*"\s*\+\s*game\.deliveryCount\s*\+\s*"\/"\s*\+\s*game\.cargoMax/.test(comboBlockCode),
    "A: draws \"COMBO \" + game.deliveryCount + \"/\" + game.cargoMax");
  assert(/COLOR\.dock/.test(comboBlockSrc), "A: uses COLOR.dock, the existing delivery/dock colour role");
  assert(/HUD_COMBO_X.*HUD_COMBO_Y.*HUD_COMBO_SIZE/.test(comboBlockCode.replace(/\s+/g, " ")) ||
         /HUD_COMBO_X,\s*HUD_COMBO_Y,\s*HUD_COMBO_SIZE/.test(comboBlockCode),
    "A: the drawText call uses all three named HUD_COMBO_* constants, not bare literals");

  // DISPLAY ONLY — the new block never writes ANY game.* field (not just deliveryCount/cargoMax) —
  // per spec §10 it must never become a second source of truth for the counter, which rules out a
  // cache field just as much as a direct write to the fields it reads.
  assert(!/game\.\w+\s*[-+*/]?=(?!=)/.test(comboBlockCode) && !/game\.\w+(\+\+|--)/.test(comboBlockCode),
    "A: the combo block never writes ANY game.* field (display only, no second source of truth)");
  assert(!/comboGrace/.test(comboBlockCode) && !/DOCK_COMBO_GRACE/.test(comboBlockCode),
    "A: no grace-window countdown reference — ships PLAIN per spec §10");

  // The counter's write sites are entirely P1-P3 (dock-offload) machinery; this phase adds none.
  // 5 `game.deliveryCount = ...` sites (startGame, breakChain, scatterChain, the pickup-gate hook
  // reset, the grace-expiry reset) + 1 `game.deliveryCount++` (the towed-offload increment) + the one
  // `deliveryCount: 0,` game-object literal declaration.
  const eqWrites = (codeSrc.match(/game\.deliveryCount\s*=(?!=)/g) || []).length;
  const incWrites = (codeSrc.match(/game\.deliveryCount\+\+/g) || []).length;
  eq(eqWrites, 5, "A: game.deliveryCount `=` write-site count unchanged from P3");
  eq(incWrites, 1, "A: game.deliveryCount `++` write-site count unchanged from P3");
  eq((codeSrc.match(/\bdeliveryCount:\s*0,/g) || []).length, 1,
    "A: exactly one game-object literal `deliveryCount: 0,` — unchanged from P3");

  // No reflow of any existing HUD element — the ring layout this phase must not touch.
  eq(HUD_HULL_CX, 1156, "A: HUD_HULL_CX unmoved");
  eq(HUD_CARGO_CX, 1232, "A: HUD_CARGO_CX unmoved");
  eq(HUD_RING_CY, 74, "A: HUD_RING_CY unmoved");
  eq(HUD_RING_LABEL_Y, 122, "A: HUD_RING_LABEL_Y unmoved");
  eq(HUD_FX_BASE_Y, 640, "A: HUD_FX_BASE_Y (powerup stack floor) unmoved");
  eq(HUD_FX_ROW_H, 40, "A: HUD_FX_ROW_H unmoved");

  eq(GAME_VERSION, "1.0.0.20", "A: GAME_VERSION untouched (TRAP 1 — P5 bumps it)");
})();

// ================= (B) the CS020 P1b 8/1100 scenario =================
(function sectionB() {
  console.log("(B) the CS020 P1b 8/1100 scenario — tracks the counter through a full skirt-and-return");
  const X = build();
  X.startGame();
  quiet(X);

  eq(comboText(X), null, "B: absent before any pickup (deliveryCount 0)");

  gatherAndArrive(X, 8);
  eq(X.game.chain.length, 8, "B: 8 towed nodes hooked, control");
  eq(comboText(X), null, "B: still absent — nothing has offloaded yet");

  const s0 = X.game.score;
  hold(X, -20, 12);                       // the pinned staging: 12 frames pops exactly 3
  eq(X.game.deliveryCount, 3, "B: 3 delivered after the first 12-frame stint, control");
  const t1 = comboText(X);
  assert(t1 !== null, "B: readout visible after the first stint");
  eq(t1 && t1.str, "COMBO 3/8", "B: readout reads \"COMBO 3/8\"");
  eq(t1 && t1.fillStyle, COLOR.dock, "B: readout uses COLOR.dock");
  eq(t1 && t1.x, HUD_COMBO_X, "B: readout drawn at HUD_COMBO_X");
  eq(t1 && t1.y, HUD_COMBO_Y, "B: readout drawn at HUD_COMBO_Y");

  hold(X, 200, 60);                       // skirt out past the ring, well under DOCK_COMBO_GRACE (4s)
  eq(X.game.deliveryCount, 3, "B: counter survives the skirt (control)");
  const t2 = comboText(X);
  eq(t2 && t2.str, "COMBO 3/8", "B: readout still reads \"COMBO 3/8\" mid-skirt");

  hold(X, -20, 220);                      // return and drain the rest (220f is enough for a full 24)
  eq(X.game.deliveryCount, 8, "B: all 8 delivered, control");
  eq(X.game.score - s0, 1100, "B: score matches the pinned 8/1100 figure, control");
  const t3 = comboText(X);
  eq(t3 && t3.str, "COMBO 8/8", "B: readout reads \"COMBO 8/8\" at the end of the haul");
})();

// ================= (C) incidentals do not advance it =================
(function sectionC() {
  console.log("(C) an incidental at dock.radius + 39 leaves the counter, and the readout, unchanged");

  // (C1) at a ZERO baseline. Hook JUST INSIDE the ring (dock.radius + 39, the tagging boundary P1/P1b's
  // own §G test uses) — that alone tags it incidental — then move into the +10 offload zone to actually
  // pop it; the tag was already fixed at hook time, so where it pops doesn't matter.
  {
    const X = build();
    X.startGame(); quiet(X);
    eq(comboText(X), null, "C1: absent before the incidental (control)");
    placeShip(X, DOCK_NEIGHBORHOOD_PAD - 1);        // dock.radius + 39 — INSIDE the ring
    feedCanister(X);
    hold(X, DOCK_NEIGHBORHOOD_PAD - 1, 1);           // one frame hooks it, tagged incidental
    eq(X.game.chain.length, 1, "C1: (setup) the piece was hooked, control");
    eq(X.game.chain[0].towed, false, "C1: (setup) ...and tagged INCIDENTAL, control");
    const s0 = X.game.score;
    hold(X, -20, 10);                                // into the offload zone; long enough for one pop
    eq(X.game.deliveryCount, 0, "C1: an incidental does not advance deliveryCount from 0");
    eq(X.game.score - s0, DOCK_BASE_SCORE, "C1: it still pays the flat incidental rate");
    eq(comboText(X), null, "C1: readout still absent after the incidental");
  }

  // (C2) at a NON-ZERO baseline — the case that actually proves "does not advance", not just "stays absent".
  {
    const X = build();
    X.startGame(); quiet(X);
    gatherAndArrive(X, 3);
    hold(X, -20, 220);                               // deliver all 3 for real, towed
    eq(X.game.chain.length, 0, "C2: the 3-node towed load fully delivered, control");
    eq(X.game.deliveryCount, 3, "C2: baseline combo is 3, control");
    const before = comboText(X);
    eq(before && before.str, "COMBO 3/8", "C2: readout shows \"COMBO 3/8\" before the incidental");

    placeShip(X, DOCK_NEIGHBORHOOD_PAD - 1);          // dock.radius + 39 — still inside the ring
    feedCanister(X);
    hold(X, DOCK_NEIGHBORHOOD_PAD - 1, 1);
    eq(X.game.chain[X.game.chain.length - 1].towed, false, "C2: (setup) the new piece is tagged INCIDENTAL, control");
    const s0 = X.game.score;
    hold(X, -20, 10);
    eq(X.game.deliveryCount, 3, "C2: the incidental leaves deliveryCount exactly at 3 (not advanced)");
    eq(X.game.score - s0, DOCK_BASE_SCORE, "C2: it pays the flat incidental rate, not the escalating one");
    const after = comboText(X);
    eq(after && after.str, "COMBO 3/8", "C2: readout is UNCHANGED at \"COMBO 3/8\" after the incidental");
  }
})();

// ================= (D) vanishes on window expiry =================
(function sectionD() {
  console.log("(D) vanishes on DOCK_COMBO_GRACE window expiry — exactly when deliveryCount hits 0");
  const X = build();
  X.startGame(); quiet(X);
  gatherAndArrive(X, 4);
  hold(X, -20, 220);
  eq(X.game.deliveryCount, 4, "D: baseline combo is 4, control");
  eq(comboText(X) && comboText(X).str, "COMBO 4/8", "D: readout visible before leaving the ring");

  X.DEBUG.dockComboGrace = 0.2;   // short window so the test doesn't need hundreds of frames
  hold(X, -20, 1);                // one frame inside the ring re-arms comboGrace to the new 0.2s value
  eq(X.game.comboGrace, 0.2, "D: comboGrace re-armed to the shortened window, control");

  let vanishedAtFrame = -1;
  for (let f = 1; f <= 30 && vanishedAtFrame < 0; f++) {
    placeShip(X, 200);            // outside the ring — comboGrace decays every frame from here
    X.update(1 / 60);
    if (X.game.deliveryCount === 0) vanishedAtFrame = f;
  }
  assert(vanishedAtFrame > 0 && vanishedAtFrame < 30,
    "D: game.deliveryCount reaches 0 well within the window (frame " + vanishedAtFrame + ")");
  eq(comboText(X), null, "D: readout is gone the instant deliveryCount hits 0");

  // The frame right before expiry must still show it (proves this isn't just "always eventually null").
  const Y = build();
  Y.startGame(); quiet(Y);
  gatherAndArrive(Y, 4);
  hold(Y, -20, 220);
  Y.DEBUG.dockComboGrace = 1.0;
  hold(Y, -20, 1);
  placeShip(Y, 200);
  Y.update(1 / 60);               // one frame out — comboGrace ~0.983, nowhere near 0
  assert(Y.game.deliveryCount > 0, "D: control — deliveryCount is still nonzero one frame after leaving");
  eq(comboText(Y) && comboText(Y).str, "COMBO 4/8", "D: and the readout is still visible at that frame");
})();

// ================= (E) vanishes on ship death =================
(function sectionE() {
  console.log("(E) vanishes on ship death — killShip() -> scatterChain() zeroes it immediately");
  const X = build();
  X.startGame(); quiet(X);
  gatherAndArrive(X, 5);
  hold(X, -20, 220);
  eq(X.game.deliveryCount, 5, "E: baseline combo is 5, control");
  eq(comboText(X) && comboText(X).str, "COMBO 5/8", "E: readout visible before death");

  X.killShip();
  eq(X.game.ship.dead, true, "E: killShip() marked the ship dead, control");
  eq(X.game.deliveryCount, 0, "E: scatterChain() zeroed deliveryCount");
  eq(comboText(X), null, "E: readout is gone immediately after death, no extra frame needed");
})();

// ================= (F) never appears at deliveryCount 0 =================
(function sectionF() {
  console.log("(F) never appears at deliveryCount 0 — a fresh game, and ordinary non-dock play");
  const X = build();
  X.startGame();
  eq(X.game.deliveryCount, 0, "F: a fresh game starts at deliveryCount 0, control");
  eq(comboText(X), null, "F: absent on a fresh game");

  // Fly around for a while with no dock interaction at all — never a single COMBO frame.
  quiet(X);
  placeShip(X, 5000);   // far from the dock, out of any ring math entirely
  let sawCombo = false;
  for (let f = 0; f < 120; f++) {
    X.game.ship.vx = 40; X.game.ship.vy = -25;   // drift, never touching the dock
    X.update(1 / 60);
    X.game.powerups.length = 0;
    if (comboText(X) !== null) sawCombo = true;
  }
  assert(!sawCombo, "F: 120 frames of ordinary non-dock play never draw a COMBO line");
  eq(X.game.deliveryCount, 0, "F: and deliveryCount genuinely never left 0 (control)");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
