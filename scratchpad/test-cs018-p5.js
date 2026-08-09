// Headless test for CS018 Phase 5 — payload capacity GRANTED by level (payloadSlots(n); levelDef(n).payloadSlots
// until CS024 P4 lifted the column out of the retired level table into its own function, unchanged),
// the delivery-earned growCap curve retired.
//
//   node scratchpad/test-cs018-p5.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — every
// value comes out of the REAL asteroids-deluxe.html source, driven through the REAL startGame(),
// nextWave() and the dock-offload path in update(), using the same build()-a-headless-instance
// harness as scratchpad/test-cs018-p1.js/p3.js/p4.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) cargoMax INTEGRATION: real startGame()/nextWave() calls across levels 1-63(+), matching the
//      phase prompt's pinned 8 (1-4), 10/12/.../24 (5-12), 24 (13-63+) curve, and equal to
//      payloadSlots(n) at every level, including a fresh run starting at 8 (not CARGO_BASE).
//  (C) growCap RETIRED: CARGO_GROW_PER has zero live (non-definition) readers; the "TOW +1" / "+1 CAP"
//      floater strings are gone from source; a long real run of deliveries (via update()'s dock-offload
//      path) never grows cargoMax mid-run — it only steps on a nextWave() level change.
//  (D) game.cargoFlash / HUD_CAP_FLASH SURVIVE: both still exist and the Maxed Out
//      (deliveryCount === CARGO_CAP_MAX) latch still arms cargoFlash; achievement latches (Heavy
//      Hauler ===12, The Long Haul, Freight Baron, Maxed Out ===CARGO_CAP_MAX) do not read cargoMax
//      anywhere in their definitions — confirmed by source-level scan, not just today's snapshot.
//  (E) HUD cargo ring: draw() is crash-free at cargoMax 8 and 24, and the ring source reads
//      game.cargoMax live (never a cached/literal denominator).

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function deepEq(a, b) {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every(k => deepEq(a[k], b[k]));
}

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p5_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    detune: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
const canvasCtxNoop = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => canvasCtxNoop };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
// CS024 P4: levelDef is DELETED and its payloadSlots COLUMN moved out into a standalone fixed curve,
// payloadSlots(n), deliberately outside the odometer (§2.5). Same expression, same values, same single
// consumer — so this whole file repoints by swapping levelDef(n).payloadSlots for payloadSlots(n).
const RETURN = ["game", "startGame", "update", "nextWave", "draw", "payloadSlots",
                "CARGO_BASE", "CARGO_CAP_MAX", "HUD_CAP_FLASH", "Achievements", "GAME_VERSION",
                'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'];
function build(src = scriptSrc, windowExtra) {
  const windowStub = Object.assign({ addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 }, windowExtra || {});
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, makeLocalStorage());
}

// ---- the phase prompt's pinned expected curve ----
const WANT_1_13 = [8, 8, 8, 8, 10, 12, 14, 16, 18, 20, 22, 24, 24];

// ================= (B) cargoMax INTEGRATION =====================
let X;
(function sectionB() {
  console.log("(B) cargoMax: real startGame()/nextWave() calls, levels 1-70");
  X = build();
  let threw = false;
  try { X.startGame(); } catch (e) { threw = true; console.error("  FAIL: startGame() threw: " + e.stack); }
  assert(!threw, "B: startGame() runs clean");
  if (threw) return;

  eq(X.game.cargoMax, 8, "B: a fresh run (level 1) starts at cargoMax 8, not CARGO_BASE (12)");
  eq(X.game.cargoMax, X.payloadSlots(1), "B: level 1 cargoMax === payloadSlots(1)");

  const got = [X.game.cargoMax];
  for (let n = 2; n <= 70; n++) {
    X.game.debris = []; // wave-clear precondition in real play: nextWave() only ever fires once this is empty
    let ok = true;
    try { X.nextWave(); } catch (e) { ok = false; console.error(`  FAIL: nextWave() to level ${n} threw: ` + e.stack); }
    assert(ok, `B: nextWave() to level ${n} runs clean`);
    got.push(X.game.cargoMax);
  }
  eq(X.game.wave, 70, "B: 70 nextWave() calls (1 from startGame + 69 more) land on level 70");
  assert(deepEq(got.slice(0, 13), WANT_1_13),
    `B: cargoMax levels 1-13 === ${WANT_1_13.join(",")} (got ${got.slice(0, 13).join(",")})`);
  console.log("    levels 1-13 cargoMax: " + got.slice(0, 13).join(","));
  for (let n = 13; n <= 70; n++) eq(got[n - 1], 24, `B: level ${n} (>=13) holds 24`);
  for (let n = 1; n <= 70; n++) eq(got[n - 1], X.payloadSlots(n), `B: level ${n} cargoMax === payloadSlots(${n})`);
})();
if (!X) { console.error("Cannot continue without a built instance."); process.exit(1); }

// ================= (C) growCap RETIRED =====================
(function sectionC() {
  console.log("(C) the delivery-earned growCap block is gone");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));

  const growPerHits = codeOnly.filter(l => l.includes("CARGO_GROW_PER") && !l.trim().startsWith("const CARGO_GROW_PER"));
  eq(growPerHits.length, 0, `C: CARGO_GROW_PER has zero readers left (found: ${JSON.stringify(growPerHits)})`);

  // "growCap" survives as PROSE in payloadSlots's comment (documenting what it replaced) —
  // only the CODE construct (the retired `const growCap = ...` declaration) must be gone.
  assert(!scriptSrc.includes("const growCap"), "C: the growCap local variable/derivation is gone from source");
  assert(!scriptSrc.includes("TOW +1"), 'C: the "TOW +1" floater string is gone from source');
  assert(!scriptSrc.includes("+1 CAP"), 'C: the "+1 CAP" floater string is gone from source');

  // Integration: drive a long real run of dock deliveries (via update()'s real offload path) and
  // confirm cargoMax NEVER changes mid-level from deliveries alone — only nextWave() may move it.
  const Y = build();
  Y.startGame();
  Y.game.state = "playing"; Y.game.paused = false;
  Y.game.debris.length = 1; Y.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  Y.game.hunters.length = 0; Y.game.saucers.length = 0; Y.game.bullets.length = 0;
  Y.game.garbage.length = 0; Y.game.powerups.length = 0; Y.game.floaters.length = 0;
  Y.game.saucerTimer = 1e6; Y.game.healthTimer = 1e6; Y.game.hunterTimer = 1e6;
  Y.game.ship.x = Y.game.dock.x; Y.game.ship.y = Y.game.dock.y;
  Y.game.ship.dead = false;
  const capAtStart = Y.game.cargoMax;
  let capChangedMidLevel = false;
  for (let i = 0; i < 400 && Y.game.stats.delivered < 60; i++) {
    if (Y.game.chain.length < Y.game.cargoMax) {
      Y.game.chain.push({ x: Y.game.dock.x, y: Y.game.dock.y, px: Y.game.dock.x, py: Y.game.dock.y, spin: 0, spinRate: 0, mass: 1 });
    }
    Y.update(1 / 60);
    if (Y.game.cargoMax !== capAtStart) capChangedMidLevel = true;
  }
  assert(Y.game.stats.delivered >= 30, `C: (setup) drove at least 30 real deliveries via update() (got ${Y.game.stats.delivered})`);
  assert(!capChangedMidLevel, "C: cargoMax never changed across 30+ deliveries within the same level (growth is level-gated, not delivery-gated)");
  eq(Y.game.cargoMax, capAtStart, "C: cargoMax after many deliveries at level 1 is still unchanged");
})();

// ================= (D) cargoFlash / HUD_CAP_FLASH survive; achievements decoupled =====================
(function sectionD() {
  console.log("(D) cargoFlash/HUD_CAP_FLASH survive (Maxed Out); achievement latches don't read cargoMax");
  assert(typeof X.HUD_CAP_FLASH === "number" && X.HUD_CAP_FLASH > 0, "D: HUD_CAP_FLASH constant still exists");
  assert("cargoFlash" in X.game, "D: game.cargoFlash field still exists");

  // Drive deliveryCount to CARGO_CAP_MAX (24) in one visit via the real offload path and confirm the
  // Maxed Out latch still arms cargoFlash.
  const Z = build();
  Z.startGame();
  Z.game.state = "playing"; Z.game.paused = false;
  Z.game.debris.length = 1; Z.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  Z.game.hunters.length = 0; Z.game.saucers.length = 0; Z.game.bullets.length = 0;
  Z.game.garbage.length = 0; Z.game.powerups.length = 0; Z.game.floaters.length = 0;
  Z.game.saucerTimer = 1e6; Z.game.healthTimer = 1e6; Z.game.hunterTimer = 1e6;
  Z.game.ship.x = Z.game.dock.x; Z.game.ship.y = Z.game.dock.y;
  Z.game.ship.dead = false;
  Z.game.cargoMax = Z.CARGO_CAP_MAX; // give the chain room for a full 24-delivery visit regardless of level
  for (let i = 0; i < 2000 && Z.game.stats.delivered < Z.CARGO_CAP_MAX; i++) {
    if (Z.game.chain.length < Z.game.cargoMax) {
      Z.game.chain.push({ x: Z.game.dock.x, y: Z.game.dock.y, px: Z.game.dock.x, py: Z.game.dock.y, spin: 0, spinRate: 0, mass: 1 });
    }
    Z.update(1 / 60);
  }
  eq(Z.game.deliveryCount, Z.CARGO_CAP_MAX, `D: (setup) drove deliveryCount to CARGO_CAP_MAX (got ${Z.game.deliveryCount})`);
  assert(Z.game.stats.maxChainVisit === true, "D: Maxed Out latch (maxChainVisit) still fires");
  assert(Z.game.cargoFlash > 0, "D: Maxed Out latch still arms game.cargoFlash");

  // Source-level scan: none of the four cargo-cap achievement `cur` reader functions mention cargoMax.
  const achIds = ["heavy_hauler", "freight_baron", "long_haul", "max_haul"];
  for (const id of achIds) {
    const idx = scriptSrc.indexOf(`id: "${id}"`);
    assert(idx >= 0, `D: achievement entry "${id}" found in source`);
    if (idx < 0) continue;
    const lineEnd = scriptSrc.indexOf("\n", idx);
    const line = scriptSrc.slice(scriptSrc.lastIndexOf("\n", idx), lineEnd);
    assert(!line.includes("cargoMax"), `D: achievement "${id}" definition does not read game.cargoMax (line: ${line.trim()})`);
  }
})();

// ================= (E) HUD cargo ring =====================
(function sectionE() {
  console.log("(E) HUD cargo ring: draw() crash-free at cargoMax 8 and 24, denominator reads game.cargoMax live");
  for (const cap of [8, 24]) {
    const W = build();
    W.startGame();
    W.game.state = "playing";
    W.game.cargoMax = cap;
    for (let i = 0; i < Math.min(cap, 5); i++) W.game.chain.push({ x: 0, y: 0, px: 0, py: 0, spin: 0, spinRate: 0, mass: 1 });
    let drewOK = true;
    try { W.draw(); } catch (e) { drewOK = false; console.error(`  FAIL: draw() at cargoMax=${cap} threw: ` + e.stack); }
    assert(drewOK, `E: draw() crash-free at cargoMax=${cap}`);
  }
  // The ring's fraction and "/N" label must read game.cargoMax LIVE (never a cached var or literal).
  const ringDenomHits = (scriptSrc.match(/game\.chain\.length\s*\/\s*game\.cargoMax/g) || []).length;
  eq(ringDenomHits, 1, `E: exactly one "game.chain.length / game.cargoMax" fraction expression (got ${ringDenomHits})`);
  assert(scriptSrc.includes('"/" + game.cargoMax'), 'E: the "/N" label concatenates the LIVE game.cargoMax, not a cached value');
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
