// Headless test for CS021 Phase 4 — the HUD delivery-combo readout, closing FLAG-CS020-i.
//
//   node scratchpad/test-cs021-p4.js
//
// ⛔ INVERTED BY CS026 P4 (PLANNED-FEATURES-CS026.md §3.4/§3, closes FLAG-CS020-i's READOUT — not its
// underlying claim; see STATUS.md for the recorded risk). The readout this file was written to prove
// EXISTS is now REMOVED outright: HUD_COMBO_X/Y/SIZE and the `game.deliveryCount > 0` block are gone from
// drawHUD(), on the bet that the CS026 P4 dock-anchored delivery floaters (spread and legible, no longer
// stacked into an unreadable smear) carry delivery feedback better than a HUD line duplicating the same
// number. Per the CS017 P6 / test-cs017-p6.js §G precedent for a fully-retired feature, this file is kept
// as living documentation and turned INVERTED rather than deleted or silently left broken: every scenario
// it used to prove the readout tracks correctly now proves it is ABSENT — the readout is checked for at
// every one of the same driven scenarios (a full skirt-and-return, incidentals, window expiry, ship death,
// deliveryCount 0), so a resurrected COMBO line anywhere would still be caught.
//
// WHAT ORIGINALLY LANDED (PLANNED-FEATURES-CS021.md §10, for the historical record this file preserves).
// A drawHUD() line, left column under Score/Level: whenever game.deliveryCount > 0, "COMBO
// <deliveryCount>/<cargoMax>" in COLOR.dock. DISPLAY ONLY — it read game.deliveryCount/game.cargoMax and
// wrote neither. The counter itself is entirely CS020 P1/P1b machinery and is UNTOUCHED by CS026 P4 too
// (TRAP 4, spec item 4) — the dock-offload block still increments it on a TOWED offload and still zeroes
// it on all three routes an effort can end (a fresh towed hook outside the ring, the DOCK_COMBO_GRACE
// window expiring outside the ring, and scatterChain() on ship death). That is WHY this file's scenario
// helpers (skirt/incidental/expiry/death) are all still driven for real, unchanged: they are still
// exercising real counter behaviour, they are just no longer checking a readout that reflects it.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/update/nextWave/killShip/dock-offload/drawHUD paths.
// AudioSys/VoiceSys are left entirely unwired (ctx stays null) — both are documented headless-safe.
//
// Sections:
//  (A) node --check + source pins: HUD_COMBO_X/Y/SIZE are GONE; drawHUD()'s executable source no longer
//      reads game.deliveryCount at all; the deliveryCount write-site counts (CS020 P1/P1b machinery) are
//      UNCHANGED — this phase touched none of them; the existing ring layout constants (HULL/CARGO/
//      powerup stack) unmoved — no reflow.
//  (B) THE CS020 P1b 8/1100 SCENARIO — driven for real, unchanged; the readout is absent throughout,
//      including at "3/8" and "8/8" moments where it used to appear.
//  (C) INCIDENTALS DO NOT ADVANCE THE COUNTER — unchanged behaviourally; the readout stays absent.
//  (D) THE COUNTER STILL EXPIRES WITH THE WINDOW — driven for real; no readout ever appears to vanish.
//  (E) THE COUNTER STILL ZEROES ON SHIP DEATH — driven for real; no readout ever appears to vanish.
//  (F) NEVER APPEARS AT deliveryCount 0, OR ANYWHERE ELSE — a fresh game, and ordinary non-dock play,
//      never draw "COMBO " text (this was already true at 0; CS026 P4 makes it true everywhere).

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

// ⛔ HUD_COMBO_X/Y/SIZE REMOVED BY CS026 P4 — no longer exported; their absence is asserted directly in
// (A) via source pins instead.
const RETURN = [
  "game", "settings", "startGame", "update", "drawHUD", "nextWave", "killShip", "scatterChain",
  "breakChain", "Garbage", "dist2", "DEBUG", "COLOR", "TAU", "WORLD_W", "WORLD_H",
  "GAME_VERSION", "DOCK_BASE_SCORE", "DOCK_BONUS_STEP", "DOCK_NEIGHBORHOOD_PAD", "DOCK_COMBO_GRACE",
  "DOCK_OFFLOAD_INTERVAL", "CARGO_CAP_MAX", "CARGO_BASE",
  "HUD_HULL_CX", "HUD_CARGO_CX", "HUD_RING_CY", "HUD_RING_LABEL_Y", "HUD_FX_BASE_Y", "HUD_FX_ROW_H",
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

// The readout's own text, if drawn this frame; null if absent. ⛔ INVERTED BY CS026 P4 — every call site
// below now expects null, always; a non-null result means the retired readout somehow came back.
function comboText(X) {
  X.__log.length = 0;
  X.drawHUD();
  const hits = X.__log.filter(e => typeof e.str === "string" && e.str.indexOf("COMBO ") === 0);
  assert(hits.length === 0, "no COMBO fillText is ever drawn again (got " + hits.length + ")");
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
  GAME_VERSION, DOCK_BASE_SCORE, DOCK_NEIGHBORHOOD_PAD,
  HUD_HULL_CX, HUD_CARGO_CX, HUD_RING_CY, HUD_RING_LABEL_Y, HUD_FX_BASE_Y, HUD_FX_ROW_H,
} = A;

const stripComments = s => s.replace(/\/\/[^\n]*/g, "");
const codeSrc = stripComments(scriptSrc);
const hudBody = (() => {
  const a = codeSrc.indexOf("function drawHUD() {");
  const b = codeSrc.indexOf("\nfunction ", a + 1);
  return a >= 0 ? codeSrc.slice(a, b > a ? b : undefined) : "";
})();

// ================= (A, part 2) source pins — INVERTED =================
(function sectionA_pins() {
  assert(hudBody.length > 0, "A: (setup) drawHUD()'s executable source could be extracted");

  // ⛔ INVERTED — these three constants and the readout block are GONE (CS026 P4, spec §3.4).
  eq((codeSrc.match(/HUD_COMBO_X|HUD_COMBO_Y|HUD_COMBO_SIZE/g) || []).length, 0,
    "A: ⛔ none of the three HUD_COMBO_* constants remain anywhere in executable source");
  assert(!/deliveryCount/.test(hudBody), "A: ⛔ drawHUD()'s executable source no longer reads game.deliveryCount at all");
  assert(!/"COMBO /.test(hudBody), "A: ⛔ ...and no longer draws a \"COMBO \" label");

  // The counter's write sites are untouched — CS026 P4 changes how a delivery LOOKS, not what it PAYS or
  // tracks (TRAP 4). Same counts this file originally pinned for CS021 P4 itself.
  const eqWrites = (codeSrc.match(/game\.deliveryCount\s*=(?!=)/g) || []).length;
  const incWrites = (codeSrc.match(/game\.deliveryCount\+\+/g) || []).length;
  eq(eqWrites, 5, "A: game.deliveryCount `=` write-site count still unchanged (CS020 P1/P1b machinery)");
  eq(incWrites, 1, "A: game.deliveryCount `++` write-site count still unchanged");
  eq((codeSrc.match(/\bdeliveryCount:\s*0,/g) || []).length, 1,
    "A: exactly one game-object literal `deliveryCount: 0,` — still unchanged");

  // No reflow of any existing HUD element — still true; this phase didn't touch the ring layout either.
  eq(HUD_HULL_CX, 1156, "A: HUD_HULL_CX unmoved");
  eq(HUD_CARGO_CX, 1232, "A: HUD_CARGO_CX unmoved");
  eq(HUD_RING_CY, 74, "A: HUD_RING_CY unmoved");
  eq(HUD_RING_LABEL_Y, 122, "A: HUD_RING_LABEL_Y unmoved");
  eq(HUD_FX_BASE_Y, 640, "A: HUD_FX_BASE_Y (powerup stack floor) unmoved");
  eq(HUD_FX_ROW_H, 40, "A: HUD_FX_ROW_H unmoved");

  eq(GAME_VERSION, "1.0.0.26", "A: GAME_VERSION is CS026 P6's — the next changeset's closing phase owns the next bump");
})();

// ================= (B) the CS020 P1b 8/1100 scenario — driven for real, readout ABSENT throughout =====
(function sectionB() {
  console.log("(B) the CS020 P1b 8/1100 scenario, driven for real — the readout never appears");
  const X = build();
  X.startGame();
  quiet(X);

  eq(comboText(X), null, "B: absent before any pickup (deliveryCount 0)");

  gatherAndArrive(X, 8);
  eq(X.game.chain.length, 8, "B: 8 towed nodes hooked, control");
  eq(comboText(X), null, "B: still absent — nothing has offloaded yet");

  const s0 = X.game.score;
  hold(X, -20, 12);                       // the pinned staging: 12 frames pops exactly 3
  eq(X.game.deliveryCount, 3, "B: 3 delivered after the first 12-frame stint (counter tracking unchanged)");
  eq(comboText(X), null, "B: ⛔ absent even at the moment it used to read \"COMBO 3/8\"");

  hold(X, 200, 60);                       // skirt out past the ring, well under DOCK_COMBO_GRACE (4s)
  eq(X.game.deliveryCount, 3, "B: counter survives the skirt (control)");
  eq(comboText(X), null, "B: still absent mid-skirt");

  hold(X, -20, 220);                      // return and drain the rest (220f is enough for a full 24)
  eq(X.game.deliveryCount, 8, "B: all 8 delivered, control");
  eq(X.game.score - s0, 1100, "B: score matches the pinned 8/1100 figure, control");
  eq(comboText(X), null, "B: ⛔ absent even at the moment it used to read \"COMBO 8/8\"");
})();

// ================= (C) incidentals do not advance the counter; readout stays absent =================
(function sectionC() {
  console.log("(C) an incidental at dock.radius + 39 still leaves the counter unchanged; readout absent");

  // (C1) at a ZERO baseline.
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
    eq(comboText(X), null, "C1: readout absent after the incidental");
  }

  // (C2) at a NON-ZERO baseline.
  {
    const X = build();
    X.startGame(); quiet(X);
    gatherAndArrive(X, 3);
    hold(X, -20, 220);                               // deliver all 3 for real, towed
    eq(X.game.chain.length, 0, "C2: the 3-node towed load fully delivered, control");
    eq(X.game.deliveryCount, 3, "C2: baseline combo is 3, control");
    eq(comboText(X), null, "C2: ⛔ absent even though it used to read \"COMBO 3/8\" here");

    placeShip(X, DOCK_NEIGHBORHOOD_PAD - 1);          // dock.radius + 39 — still inside the ring
    feedCanister(X);
    hold(X, DOCK_NEIGHBORHOOD_PAD - 1, 1);
    eq(X.game.chain[X.game.chain.length - 1].towed, false, "C2: (setup) the new piece is tagged INCIDENTAL, control");
    const s0 = X.game.score;
    hold(X, -20, 10);
    eq(X.game.deliveryCount, 3, "C2: the incidental leaves deliveryCount exactly at 3 (not advanced)");
    eq(X.game.score - s0, DOCK_BASE_SCORE, "C2: it pays the flat incidental rate, not the escalating one");
    eq(comboText(X), null, "C2: readout stays absent after the incidental too");
  }
})();

// ================= (D) the counter still expires with the window; no readout ever to vanish =========
(function sectionD() {
  console.log("(D) the counter still expires with DOCK_COMBO_GRACE — the readout was never there to vanish");
  const X = build();
  X.startGame(); quiet(X);
  gatherAndArrive(X, 4);
  hold(X, -20, 220);
  eq(X.game.deliveryCount, 4, "D: baseline combo is 4, control");
  eq(comboText(X), null, "D: ⛔ absent even though it used to read \"COMBO 4/8\" here");

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
    "D: game.deliveryCount still reaches 0 well within the window (frame " + vanishedAtFrame + ") — the counter itself is untouched");
  eq(comboText(X), null, "D: readout absent after expiry too");
})();

// ================= (E) the counter still zeroes on ship death; no readout ever to vanish ============
(function sectionE() {
  console.log("(E) killShip() -> scatterChain() still zeroes the counter — the readout was never there");
  const X = build();
  X.startGame(); quiet(X);
  gatherAndArrive(X, 5);
  hold(X, -20, 220);
  eq(X.game.deliveryCount, 5, "E: baseline combo is 5, control");
  eq(comboText(X), null, "E: ⛔ absent even though it used to read \"COMBO 5/8\" here");

  X.killShip();
  eq(X.game.ship.dead, true, "E: killShip() marked the ship dead, control");
  eq(X.game.deliveryCount, 0, "E: scatterChain() zeroed deliveryCount — unchanged");
  eq(comboText(X), null, "E: readout absent immediately after death too");
})();

// ================= (F) never appears anywhere, deliveryCount 0 or otherwise =================
(function sectionF() {
  console.log("(F) never appears — a fresh game, ordinary non-dock play, or anywhere else");
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
