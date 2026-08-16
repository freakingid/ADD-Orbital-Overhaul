// Headless test for CS018 Phase 10 — the SMD voice line (dock_24), version bump.
// Covers: node --check on the extracted <script>, the VOICE_LINES.dock_24 data pin (exact
// lab-verified text/phon, no derivation), GAME_VERSION === "1.0.0.33", and that superMegaDelivery()
// fires VoiceSys.say("dock_24") — NOT a fifth VoiceSys.dockDelivery tier (dockDelivery's 5/10/15/20
// chain stays untouched, still keyed off dock_5/10/15/20 only).
//
//   node scratchpad/test-cs018-p10.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — drives
// the REAL orbital-overhaul.html source through the same build()-a-headless-instance harness as
// scratchpad/test-cs018-p1.js..p9.js.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p10_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check ${JSON.stringify(tmp)}`); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
const canvasCtxNoop = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => canvasCtxNoop };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
const RETURN = ["game", "startGame", "update", "superMegaDelivery", "HunterSatellite",
  "VoiceSys", "VOICE_LINES", "VOICE_PRIORITY", "GAME_VERSION", "CARGO_CAP_MAX", "DOCK_RADIUS"];
function build(src = scriptSrc, windowExtra) {
  const windowStub = Object.assign({ addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 }, windowExtra || {});
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, makeLocalStorage());
}

// ================= (B) source pins =====================
(function sectionB() {
  console.log("(B) source pins: version, VOICE_LINES.dock_24, dockDelivery chain untouched");
  eq(scriptSrc.match(/const GAME_VERSION = "([^"]+)"/)[1], "1.0.0.33", "GAME_VERSION bumped to 1.0.0.33");
  assert(/dock_24:\s*\[/.test(scriptSrc), "VOICE_LINES has a dock_24 entry");
  assert(/VoiceSys\.say\(\s*"dock_24"\s*\)/.test(scriptSrc),
    "superMegaDelivery fires VoiceSys.say(\"dock_24\") directly");
  const dockDeliveryBody = scriptSrc.match(/dockDelivery\(n\)\s*\{([\s\S]*?)\n  \},/);
  assert(!!dockDeliveryBody, "VoiceSys.dockDelivery(n) still exists");
  assert(!/dock_24/.test(dockDeliveryBody[1]), "dockDelivery's own body does not reference dock_24 (chain untouched)");
  assert(/n >= 20 \? "dock_20"/.test(dockDeliveryBody[1]), "dockDelivery's 5/10/15/20 threshold chain is unchanged");
})();

// ================= (C) VOICE_LINES.dock_24 data pin =====================
(function sectionC() {
  console.log("(C) VOICE_LINES.dock_24 exact text/phon, ported verbatim from the voice lab");
  const X = build();
  const lines = X.VOICE_LINES.dock_24;
  assert(Array.isArray(lines) && lines.length === 1, "dock_24 has exactly one alternative");
  eq(lines[0].text, "Super Mega Delivery at your service.", "dock_24 text matches the lab-verified string exactly");
  eq(lines[0].phon,
    "S UW1 P ER / M EH1 G AH / D IH L IH1 V ER IY / AE T / Y ER / S ER1 V IH S .",
    "dock_24 phon matches the lab-verified string exactly");
})();

// ================= (D) functional: superMegaDelivery() calls VoiceSys.say("dock_24") =====================
(function sectionD() {
  console.log("(D) functional: superMegaDelivery() invokes VoiceSys.say(\"dock_24\") exactly once");
  const X = build();
  X.startGame();
  X.game.state = "playing"; X.game.paused = false;
  X.game.hunters.length = 0;
  const calls = [];
  const realSay = X.VoiceSys.say.bind(X.VoiceSys);
  X.VoiceSys.say = (event) => { calls.push(event); return realSay(event); };
  X.superMegaDelivery();
  eq(calls.length, 1, "VoiceSys.say called exactly once by superMegaDelivery()");
  eq(calls[0], "dock_24", "the call is for the dock_24 event");
})();

// ================= (E) integration: a real 24-piece dock visit fires dock_24, not dock_20 =====================
(function sectionE() {
  console.log("(E) integration: a REAL 24-piece dock visit calls VoiceSys.say(\"dock_24\") before dockDelivery's own dock_20 attempt");
  const X = build();
  X.startGame();
  X.game.state = "playing"; X.game.paused = false;
  X.game.cargoMax = X.CARGO_CAP_MAX;
  X.game.debris.length = 1;
  X.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  X.game.hunters.length = 0; X.game.saucers.length = 0; X.game.bullets.length = 0;
  X.game.garbage.length = 0; X.game.powerups.length = 0; X.game.floaters.length = 0;
  X.game.saucerTimer = 1e6; X.game.healthTimer = 1e6; X.game.hunterTimer = 1e6;
  X.game.ship.x = X.game.dock.x + X.DOCK_RADIUS + 9; X.game.ship.y = X.game.dock.y;
  X.game.ship.vx = 0; X.game.ship.vy = 0; X.game.ship.dead = false;
  X.game.deliveryCount = 0; X.game.offloadTimer = 0;
  for (let i = 0; i < 24; i++) {
    X.game.chain.push({ x: X.game.dock.x, y: X.game.dock.y, px: X.game.dock.x, py: X.game.dock.y, spin: 0, spinRate: 0, mass: 1 });
  }
  const calls = [];
  const realSay = X.VoiceSys.say.bind(X.VoiceSys);
  X.VoiceSys.say = (event) => { calls.push(event); return realSay(event); };
  for (let i = 0; i < 24 && X.game.chain.length > 0; i++) {
    X.game.offloadTimer = 0;
    X.update(1 / 60);
  }
  eq(X.game.deliveryCount, 24, "the visit delivered all 24 pieces");
  assert(calls.includes("dock_24"), "VoiceSys.say(\"dock_24\") was invoked during the visit");
  assert(calls.indexOf("dock_24") < calls.indexOf("dock_20"),
    "dock_24 (from the SMD trigger) is called before dockDelivery's own dock_20 attempt");
})();

// ================= summary =====================
console.log("");
console.log(`CS018 P10 headless: ${passed} passed, ${failed} failed (${passed + failed} assertions)`);
process.exit(failed ? 1 : 0);
