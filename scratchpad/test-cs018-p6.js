// Headless test for CS018 Phase 6 — saucer flight speed, appearance frequency and direction-change
// frequency repointed onto levelDef() tiers, plus the shared frequency-jitter helper and the two
// GLOBAL debug fields (freqJitter, sweepCoalescePause).
//
//   node scratchpad/test-cs018-p6.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — every
// value comes out of the REAL asteroids-deluxe.html source, driven through the REAL Saucer class,
// startGame()/nextWave()/update(), using the same build()-a-headless-instance harness as
// scratchpad/test-cs018-p1.js/p3.js/p4.js/p5.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) DEBUG_VARS registry: UFO MOVEMENT header + 9 entries (flight speed / appearance freq /
//      direction-change freq, low/normal/high each) and a GLOBAL header + 2 entries (freqJitter,
//      sweepCoalescePause), all with the specified unit/def/min/max/step; saucerGapPressure entry is
//      gone; no low<=normal<=high validator exists anywhere in source.
//  (C) UFO flight speed: real `new Saucer(small)` construction at low/normal/high-tier levels
//      reproduces the tiered px/s exactly for small, and the shipped 100/150 ratio for big — no jitter.
//  (D) UFO direction-change frequency: both zigTimer sites (ctor + update()) draw from the SAME
//      jitteredInterval(tier centre); rand(0.8, 1.8) is gone from source; bounds hold at 25% jitter.
//  (E) UFO appearance frequency: the real spawn-block site and startGame()'s initial timer both draw
//      from ufoAppearInterval(); bounds hold; the retired ramp()/gapPressure derivation is gone.
//  (F) jitteredInterval(): exactly one implementation, percentage-based, reused verbatim by both
//      consumers (no second jitter implementation).
//  (G) Retirement: SAUCER_GAP_FLOOR_MIN/MAX and SAUCER_GAP_CEIL_MIN/MAX have zero non-definition
//      readers; DEBUG.saucerGapPressure/DEBUG_VARS entry for it are gone.
//  (H) Persistence: the 11 new fields round-trip through afd_settings_v1.debug across a reload.
//  (I) Regression: cargoMax/junk/hunters untouched; GAME_VERSION unchanged; DEBUG_VARS/DEBUG_ROWS
//      counts reported.

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
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }
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
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p6_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
const canvasCtxNoop = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => canvasCtxNoop };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
const RETURN = ["game", "startGame", "update", "nextWave", "levelDef", "stepAt", "Saucer",
                "ufoFlightSpeedPx", "ufoAppearInterval", "ufoZigInterval", "jitteredInterval",
                "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "applyDebug",
                "saveSettings", "loadSettings", "STORAGE_KEY",
                "CARGO_BASE", "GAME_VERSION",
                'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'];
function build(storage) {
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const lsStore = {};
  if (storage) for (const k in storage) lsStore[k] = storage[k];
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };");
  const exports = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  return { exports, lsStore };
}

let X;
(function setup() {
  X = build().exports;
  let threw = false;
  try { X.startGame(); } catch (e) { threw = true; console.error("  FAIL: startGame() threw: " + e.stack); }
  assert(!threw, "setup: startGame() runs clean");
})();
if (!X) { console.error("Cannot continue without a built instance."); process.exit(1); }

// ================= (B) DEBUG_VARS registry =====================
(function sectionB() {
  console.log("(B) DEBUG_VARS: UFO MOVEMENT (9) entries, GLOBAL down to 1 (freqJitter removed, CS024 P2), saucerGapPressure gone");

  const hIdx = X.DEBUG_VARS.findIndex(v => v.header === "UFO MOVEMENT");
  assert(hIdx >= 0, "B: a UFO MOVEMENT section header exists in DEBUG_VARS");
  const movementIds = X.DEBUG_VARS.slice(hIdx + 1, hIdx + 10).map(v => v.id);
  const wantMovementIds = [
    "ufoFlightSpeedLow", "ufoFlightSpeedNormal", "ufoFlightSpeedHigh",
    "ufoAppearFreqLow", "ufoAppearFreqNormal", "ufoAppearFreqHigh",
    "ufoDirChangeFreqLow", "ufoDirChangeFreqNormal", "ufoDirChangeFreqHigh",
  ];
  assert(deepEq(movementIds, wantMovementIds),
    `B: UFO MOVEMENT header immediately followed by the 9 expected ids (got ${JSON.stringify(movementIds)})`);

  const gIdx = X.DEBUG_VARS.findIndex(v => v.header === "GLOBAL");
  assert(gIdx >= 0, "B: a GLOBAL section header exists in DEBUG_VARS");
  // REPOINTED BY CS024 P2 (spec §1.8/§5): freqJitter is removed from the registry — jitteredInterval()
  // now reads a frozen FREQ_JITTER constant (0.25) instead of a live knob. GLOBAL is down to its one
  // surviving entry.
  const globalIds = X.DEBUG_VARS.slice(gIdx + 1, gIdx + 2).map(v => v.id);
  assert(deepEq(globalIds, ["sweepCoalescePause"]),
    `B: GLOBAL header immediately followed by sweepCoalescePause only, freqJitter removed (got ${JSON.stringify(globalIds)})`);
  assert(!X.DEBUG_VARS.some(v => v.id === "freqJitter"), "B: freqJitter entry is gone from DEBUG_VARS (CS024 P2)");
  assert(!("freqJitter" in X.DEBUG), "B: DEBUG.freqJitter is gone (CS024 P2)");

  const specs = {
    ufoFlightSpeedLow:      { unit: "px/s", def: 120, min: 20, max: 600, step: 2 },
    ufoFlightSpeedNormal:   { unit: "px/s", def: 150, min: 20, max: 600, step: 2 },
    ufoFlightSpeedHigh:     { unit: "px/s", def: 190, min: 20, max: 600, step: 2 },
    ufoAppearFreqLow:       { unit: "s",    def: 25,  min: 1,  max: 60,  step: 1 },
    ufoAppearFreqNormal:    { unit: "s",    def: 18,  min: 1,  max: 60,  step: 1 },
    ufoAppearFreqHigh:      { unit: "s",    def: 13,  min: 1,  max: 60,  step: 1 },
    ufoDirChangeFreqLow:    { unit: "s",    def: 2.0, min: 0.1, max: 10, step: 0.1 },
    ufoDirChangeFreqNormal: { unit: "s",    def: 1.3, min: 0.1, max: 10, step: 0.1 },
    ufoDirChangeFreqHigh:   { unit: "s",    def: 0.8, min: 0.1, max: 10, step: 0.1 },
    sweepCoalescePause:     { unit: "s",    def: 10,  min: 0,  max: 60,  step: 1 },
  };
  for (const [id, spec] of Object.entries(specs)) {
    const e = X.DEBUG_VARS.find(v => v.id === id);
    assert(!!e, `B: DEBUG_VARS has ${id}`);
    if (!e) continue;
    eq(e.unit, spec.unit, `B: ${id} unit is "${spec.unit}"`);
    eq(e.def, spec.def, `B: ${id} default is ${spec.def}`);
    eq(e.min, spec.min, `B: ${id} min is ${spec.min}`);
    eq(e.max, spec.max, `B: ${id} max is ${spec.max}`);
    eq(e.step, spec.step, `B: ${id} step is ${spec.step}`);
    eq(X.DEBUG[id], spec.def, `B: DEBUG.${id} seeded to ${spec.def}`);
  }

  assert(!X.DEBUG_VARS.some(v => v.id === "saucerGapPressure"), "B: saucerGapPressure entry is gone from DEBUG_VARS");
  assert(!("saucerGapPressure" in X.DEBUG), "B: DEBUG.saucerGapPressure is gone");
  // REPOINTED (CS018 P7): the two SAUCER PRESSURE siblings this file pinned as "still present (retires in
  // P7)" are now retired too, header included — mirror-image of the claim above.
  assert(!X.DEBUG_VARS.some(v => v.id === "saucerPressureSecs"), "B: saucerPressureSecs is gone (CS018 P7)");
  assert(!X.DEBUG_VARS.some(v => v.id === "saucerAimPressure"), "B: saucerAimPressure is gone (CS018 P7)");
  assert(!X.DEBUG_VARS.some(v => v.header === "SAUCER PRESSURE"), "B: the SAUCER PRESSURE header is gone (CS018 P7)");

  // Standing prohibition: no code anywhere may assume low <= normal <= high (two of these three levers
  // descend). A crude but effective proof: normal/high are numerically SMALLER than low for the two
  // inverted levers here, and nothing in source rejects that.
  assert(X.DEBUG.ufoAppearFreqHigh < X.DEBUG.ufoAppearFreqLow, "B: appearance frequency genuinely descends (high < low)");
  assert(X.DEBUG.ufoDirChangeFreqHigh < X.DEBUG.ufoDirChangeFreqLow, "B: direction-change frequency genuinely descends (high < low)");
  assert(X.DEBUG.ufoFlightSpeedHigh > X.DEBUG.ufoFlightSpeedLow, "B: flight speed still climbs (not inverted)");
})();

// ================= (C) UFO flight speed =====================
(function sectionC() {
  console.log("(C) UFO flight speed: tiered, no jitter, 100/150 big/small ratio preserved");
  // TIER_STEPS.ufoFlightSpeed = [[1,"low"],[17,"normal"],[38,"high"]]
  const cases = [
    { level: 1,  tier: "low",    px: X.DEBUG.ufoFlightSpeedLow },
    { level: 16, tier: "low",    px: X.DEBUG.ufoFlightSpeedLow },
    { level: 17, tier: "normal", px: X.DEBUG.ufoFlightSpeedNormal },
    { level: 37, tier: "normal", px: X.DEBUG.ufoFlightSpeedNormal },
    { level: 38, tier: "high",   px: X.DEBUG.ufoFlightSpeedHigh },
    { level: 100, tier: "high",  px: X.DEBUG.ufoFlightSpeedHigh },
  ];
  for (const c of cases) {
    eq(X.levelDef(c.level).ufoFlightSpeed, c.tier, `C: level ${c.level} ufoFlightSpeed tier is "${c.tier}"`);
    X.game.wave = c.level;
    eq(X.ufoFlightSpeedPx(true), c.px, `C: level ${c.level} ufoFlightSpeedPx(small) === ${c.px}`);
    close(X.ufoFlightSpeedPx(false), c.px * (100 / 150), `C: level ${c.level} ufoFlightSpeedPx(big) preserves the 100/150 ratio`);

    // Integration: real Saucer construction at this level reproduces the same |vx| exactly (no jitter).
    for (const small of [true, false]) {
      X.game.wave = c.level;
      const s = new X.Saucer(small);
      const wantPx = small ? c.px : c.px * (100 / 150);
      close(Math.abs(s.vx), wantPx, `C: level ${c.level} real Saucer(${small}).vx magnitude === ${wantPx.toFixed(2)}`);
    }
  }
  console.log(`    low=${X.DEBUG.ufoFlightSpeedLow} normal=${X.DEBUG.ufoFlightSpeedNormal} high=${X.DEBUG.ufoFlightSpeedHigh} px/s (small); big derives at *100/150`);
})();

// ================= (D) UFO direction-change frequency =====================
(function sectionD() {
  console.log("(D) UFO direction-change frequency: both zigTimer sites tiered + jittered; rand(0.8,1.8) gone");

  // Distinguishes real assignment ("= rand(0.8, 1.8)", the old live idiom) from the new code's own
  // trailing comments documenting what it replaced ("...jittered, was rand(0.8, 1.8)", no "=" before it).
  const liveRand0818 = scriptSrc.split("\n").filter(l => /=\s*rand\(0\.8,\s*1\.8\)/.test(l));
  eq(liveRand0818.length, 0, `D: rand(0.8, 1.8) is gone as a live assignment (comments documenting the old value are fine) (found: ${JSON.stringify(liveRand0818)})`);
  const zigCallSites = scriptSrc.split("\n")
    .filter(l => !l.trim().startsWith("//"))
    .filter(l => l.includes("ufoZigInterval()") && !l.trim().startsWith("function ufoZigInterval("));
  eq(zigCallSites.length, 2, `D: ufoZigInterval() is called at exactly 2 live sites (ctor + update()) (found: ${JSON.stringify(zigCallSites.map(l => l.trim()))})`);

  const j = 0.25; // shipped default freqJitter
  const centers = { low: X.DEBUG.ufoDirChangeFreqLow, normal: X.DEBUG.ufoDirChangeFreqNormal, high: X.DEBUG.ufoDirChangeFreqHigh };
  // TIER_STEPS.ufoDirChangeFreq = [[1,"low"],[30,"normal"],[55,"high"]]
  const levelForTier = { low: 1, normal: 30, high: 55 };

  for (const tier of ["low", "normal", "high"]) {
    X.game.wave = levelForTier[tier];
    eq(X.levelDef(X.game.wave).ufoDirChangeFreq, tier, `D: level ${levelForTier[tier]} ufoDirChangeFreq tier is "${tier}"`);
    const center = centers[tier];
    const lo = center * (1 - j), hi = center * (1 + j);

    // Direct helper, many samples.
    let sawAbove = false, sawBelow = false;
    for (let i = 0; i < 500; i++) {
      const v = X.ufoZigInterval();
      assert(v >= lo - 1e-9 && v <= hi + 1e-9, `D: ufoZigInterval() at ${tier} tier within [${lo.toFixed(3)}, ${hi.toFixed(3)}] (got ${v.toFixed(4)})`);
      if (v > center) sawAbove = true;
      if (v < center) sawBelow = true;
    }
    assert(sawAbove && sawBelow, `D: ufoZigInterval() at ${tier} tier actually varies both above and below its centre across 500 samples`);

    // Integration: the ctor site.
    for (let i = 0; i < 20; i++) {
      const s = new X.Saucer(true);
      assert(s.zigTimer >= lo - 1e-9 && s.zigTimer <= hi + 1e-9, `D: Saucer ctor zigTimer at ${tier} tier within bounds (got ${s.zigTimer.toFixed(4)})`);
    }
    // Integration: the update() re-roll site.
    for (let i = 0; i < 20; i++) {
      const s = new X.Saucer(true);
      s.zigTimer = -0.01; // force the re-roll branch this frame
      s.update(1 / 60);
      assert(s.zigTimer >= lo - 1e-9 && s.zigTimer <= hi + 1e-9, `D: Saucer.update() re-roll zigTimer at ${tier} tier within bounds (got ${s.zigTimer.toFixed(4)})`);
    }
  }
  console.log(`    dirChange centres: low=${centers.low} normal=${centers.normal} high=${centers.high}s, ±25% jitter`);
})();

// ================= (E) UFO appearance frequency =====================
(function sectionE() {
  console.log("(E) UFO appearance frequency: spawn-block + startGame() init both tiered + jittered");

  eq((scriptSrc.match(/function ufoAppearInterval\(/g) || []).length, 1, "E: exactly one ufoAppearInterval definition");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  assert(!codeOnly.some(l => l.includes("gapPressure")), "E: no live reference to the retired gapPressure derivation");
  assert(!codeOnly.some(l => /ramp\(\s*SAUCER_GAP_FLOOR/.test(l)), "E: no live ramp(SAUCER_GAP_FLOOR...) call remains");

  const j = 0.25;
  const centers = { low: X.DEBUG.ufoAppearFreqLow, normal: X.DEBUG.ufoAppearFreqNormal, high: X.DEBUG.ufoAppearFreqHigh };
  // TIER_STEPS.ufoAppearFreq = [[1,"low"],[26,"normal"],[47,"high"]]
  const levelForTier = { low: 1, normal: 26, high: 47 };

  for (const tier of ["low", "normal", "high"]) {
    X.game.wave = levelForTier[tier];
    eq(X.levelDef(X.game.wave).ufoAppearFreq, tier, `E: level ${levelForTier[tier]} ufoAppearFreq tier is "${tier}"`);
    const center = centers[tier];
    const lo = center * (1 - j), hi = center * (1 + j);
    let sawAbove = false, sawBelow = false;
    for (let i = 0; i < 500; i++) {
      const v = X.ufoAppearInterval();
      assert(v >= lo - 1e-9 && v <= hi + 1e-9, `E: ufoAppearInterval() at ${tier} tier within [${lo.toFixed(3)}, ${hi.toFixed(3)}] (got ${v.toFixed(4)})`);
      if (v > center) sawAbove = true;
      if (v < center) sawBelow = true;
    }
    assert(sawAbove && sawBelow, `E: ufoAppearInterval() at ${tier} tier actually varies both above and below its centre across 500 samples`);
  }
  console.log(`    appear centres: low=${centers.low} normal=${centers.normal} high=${centers.high}s, ±25% jitter`);

  // Integration: the real spawn block (update()'s "--- Spawning ---" site) sets game.saucerTimer via
  // ufoAppearInterval() when a saucer spawns.
  const Y = build().exports;
  Y.startGame();
  Y.game.state = "playing"; Y.game.paused = false;
  Y.game.wave = 26; // normal tier
  Y.game.debris = [{ x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} }];
  Y.game.hunters = []; Y.game.saucers = []; Y.game.bullets = [];
  Y.game.healthTimer = 1e6; Y.game.hunterTimer = 1e6;
  Y.game.saucerTimer = 0; // force an immediate spawn this frame
  Y.game.ship.dead = false;
  Y.update(1 / 60);
  const cN = centers.normal, loN = cN * (1 - j), hiN = cN * (1 + j);
  assert(Y.game.saucers.length === 1, "E: (setup) the forced spawn actually fired");
  assert(Y.game.saucerTimer >= loN - 1e-6 && Y.game.saucerTimer <= hiN + 1e-6,
    `E: real spawn-block saucerTimer at normal tier within [${loN.toFixed(3)}, ${hiN.toFixed(3)}] (got ${Y.game.saucerTimer.toFixed(4)})`);

  // Integration: startGame()'s pre-nextWave() init (game.wave === 0 -> stepAt falls back to the "low" tier).
  const loL = centers.low * (1 - j), hiL = centers.low * (1 + j);
  for (let i = 0; i < 20; i++) {
    const Z = build().exports;
    Z.startGame();
    assert(Z.game.saucerTimer >= loL - 1e-6 && Z.game.saucerTimer <= hiL + 1e-6,
      `E: startGame() initial saucerTimer within the "low" tier's jittered bounds (got ${Z.game.saucerTimer.toFixed(4)})`);
  }
})();

// ================= (F) jitteredInterval() shared helper =====================
(function sectionF() {
  console.log("(F) jitteredInterval(): exactly one implementation, percentage-based, shared by both consumers");
  eq((scriptSrc.match(/function jitteredInterval\(/g) || []).length, 1, "F: exactly one jitteredInterval definition");

  // REPOINTED BY CS024 P2 (spec §1.8/§5): freqJitter is no longer a live debug knob — jitteredInterval()
  // reads a frozen FREQ_JITTER constant instead, so this section's old "the knob actually moves the
  // spread" claim is replaced by its mirror image: the spread is FIXED at 25% regardless of anything
  // applyDebug can do, because there is no longer a knob id to feed it.
  assert(!X.DEBUG_VARS.some(v => v.id === "freqJitter"), "F: no freqJitter knob exists to drive jitteredInterval() with");
  eq((scriptSrc.match(/FREQ_JITTER\s*=\s*0\.25/g) || []).length, 1, "F: exactly one FREQ_JITTER = 0.25 declaration");
  X.game.wave = 1;
  let sawAbove = false, sawBelow = false;
  for (let i = 0; i < 200; i++) {
    const v = X.jitteredInterval(10);
    assert(v >= 7.5 - 1e-9 && v <= 12.5 + 1e-9, `F: jitteredInterval(10) stays within the frozen ±25% band [7.5,12.5] (got ${v})`);
    if (v > 10) sawAbove = true;
    if (v < 10) sawBelow = true;
  }
  assert(sawAbove && sawBelow, "F: jitteredInterval(10) still varies both above and below its centre across 200 samples");
})();

// ================= (G) retirement: SAUCER_GAP_* and saucerGapPressure =====================
(function sectionG() {
  console.log("(G) retirement: SAUCER_GAP_FLOOR/CEIL and saucerGapPressure are gone");
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//"));
  for (const id of ["SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_CEIL_MAX"]) {
    const hits = codeOnly.filter(l => l.includes(id) && !l.trim().startsWith(`const ${id}`));
    eq(hits.length, 0, `G: ${id} has zero readers left (found: ${JSON.stringify(hits)})`);
  }
  const gapPressureHits = codeOnly.filter(l => l.includes("saucerGapPressure"));
  eq(gapPressureHits.length, 0, `G: saucerGapPressure has zero live references anywhere (found: ${JSON.stringify(gapPressureHits)})`);

  // REPOINTED BY CS024 P2 (spec §1.8): these four were "documented, unread" at P6 — now they are
  // deleted outright (dead-constant sweep). The claim inverts from "still defined" to "does not exist".
  for (const id of ["SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_CEIL_MAX"]) {
    eq(X.probe(id), "__ReferenceError__", `G: ${id} does not exist (deleted, CS024 P2)`);
    eq((scriptSrc.match(new RegExp(`const ${id}\\s*=`, "g")) || []).length, 0, `G: ...and no declaration remains either`);
  }
})();

// ================= (H) persistence round-trip =====================
(function sectionH() {
  // REPOINTED BY CS024 P2: freqJitter is gone (spec §1.8/§5), so this now round-trips 10 fields, not 11.
  console.log("(H) the 10 surviving fields round-trip through afd_settings_v1.debug across a reload");
  const inst = build();
  const A = inst.exports;
  const newIds = [
    "ufoFlightSpeedLow", "ufoFlightSpeedNormal", "ufoFlightSpeedHigh",
    "ufoAppearFreqLow", "ufoAppearFreqNormal", "ufoAppearFreqHigh",
    "ufoDirChangeFreqLow", "ufoDirChangeFreqNormal", "ufoDirChangeFreqHigh",
    "sweepCoalescePause",
  ];
  const want = {};
  for (const id of newIds) {
    const e = A.DEBUG_VARS.find(v => v.id === id);
    const v = Math.min(e.max, Math.max(e.min, e.def + e.step * 1.5));
    A.applyDebug(id, v);
    want[id] = v;
  }
  A.saveSettings();
  const blob = inst.lsStore[A.STORAGE_KEY];
  assert(typeof blob === "string", "H: saveSettings() wrote the settings blob");
  const parsed = JSON.parse(blob);
  for (const id of newIds) eq(parsed.debug[id], want[id], `H: saved blob carries ${id} = ${want[id]}`);

  const reload = build({ "afd_settings_v1": blob }).exports;
  for (const id of newIds) {
    eq(reload.debugShown[id], want[id], `H: reload restored debugShown.${id}`);
    eq(reload.DEBUG[id], want[id], `H: reload restored DEBUG.${id}`);
  }
  // Untouched knobs from earlier phases still load at their defaults alongside the new ones.
  eq(reload.debugShown.junkSpeedNormal, 70, "H: untouched junkSpeedNormal still loads at its default");
})();

// ================= (I) regression =====================
(function sectionI() {
  console.log("(I) regression: cargo/junk/hunters untouched, version unchanged, row/entry counts");
  const Y = build().exports;
  Y.startGame();
  eq(Y.game.cargoMax, 8, "I: cargoMax still starts at 8 (CS018 P5, untouched by P6)");
  eq(Y.levelDef(5).junkCount, 3, "I: junk count table untouched by P6");
  eq(Y.levelDef(5).maxLargeHunters, 1, "I: hunter cap table untouched by P6");
  // REPOINTED BY CS019 P2: mirror image of the stale "unchanged this phase (bumps in P10)" claim —
  // the version has since moved past what P6 (this phase) shipped.
  assert(Y.GAME_VERSION !== "1.0.0.17", "I: GAME_VERSION has moved past what P6 shipped (1.0.0.17) — bumped in P10, bumped again in CS019 P2");

  const nEntries = Y.DEBUG_ENTRIES.length;
  const nRows = Y.DEBUG_ROWS.length;
  // 15 pre-P6 value entries (12 baseline + 3 junk speed from P3) - 1 (saucerGapPressure retired) + 11 new = 25.
  // REPOINTED (CS018 P7): P7 landed after this test was written and removed 2 more (saucerPressureSecs,
  // saucerAimPressure) while adding 9 (UFO WEAPONS) -> 25 - 2 + 9 = 32. This file still only PROVES the
  // P6-era shape (asserted above in section B); this count just needs to stop pinning a now-stale total.
  // REPOINTED AGAIN (CS019 P1): + 1 (chainGuardCooldown, appended to the CHAIN GUARD group) -> 33. Same
  // claim, same strength — an exact live-registry count — plus the id of the entry that moved it, so a
  // different silent addition can't satisfy the new number.
  // REPOINTED AGAIN (CS020 P1b): + 1 (dockComboGrace, under a new DELIVERY header) -> 34. Same claim,
  // same strength, same treatment.
  // REPOINTED AGAIN (CS021 P3): + 10 (the ORBIT section) -> 44. Same claim, same strength, same treatment.
  // REPOINTED AGAIN (CS023 P4): + 2 (orbitGravityAccel, debrisBounceRestitution) -> 46.
  // REPOINTED AGAIN (CS023 P4B): orbitGravityAccel -> debrisDriftAccel (spec C15 — the drift is not
  // orbit-scoped). Count stays 46, row unmoved; only the id (and its /^orbit/i membership) changes.
  // REPOINTED BY CS024 P1: 46 -> 35, and it is the FIRST DECREASE this pin has ever taken. The ten ORBIT
  // knobs, their header and debrisDriftAccel are removed outright with the orbit archetype and the inward
  // drift (spec §1.1/§1.5/§4.1/§5) — a deliberate registry REBUILD under CS024 §5, not a violation of the
  // append-only rule that governed every increase above. The /^orbit/i claim is INVERTED rather than
  // deleted, per the standing convention: "none match" is the assertion that catches a knob creeping back.
  // REPOINTED AGAIN BY CS024 P2: 35 -> 34 — freqJitter removed outright (spec §1.8/§5, frozen at 25% via
  // the FREQ_JITTER constant instead). Section B/F/G/H above carry the rest of this phase's own claims.
  eq(nEntries, 34, `I: DEBUG_ENTRIES count is 34 after CS024 P2 (got ${nEntries})`);
  assert(Y.DEBUG_ENTRIES.some(v => v.id === "dockComboGrace"),
    "I: ...and the entry that moved it from 33 to 34 is CS020 P1b's dockComboGrace");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "chainGuardCooldown").length, 1,
    "I: ...and the entry CS019 P1 added is chainGuardCooldown");
  eq(Y.DEBUG_ENTRIES.filter(e => /^orbit/i.test(e.id)).length, 0,
    "I: REPOINTED BY CS024 P1 (inverted) — NO registry id matches /^orbit/i any more");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "debrisDriftAccel").length, 0,
    "I: REPOINTED BY CS024 P1 (inverted) — debrisDriftAccel is gone with the drift");
  eq(Y.DEBUG_ENTRIES.filter(e => e.id === "debrisBounceRestitution").length, 1,
    "I: ...but CS023 P2's debrisBounceRestitution survives — archetype-independent (CS024 spec §0)");
  console.log(`    DEBUG_ENTRIES: ${nEntries}   DEBUG_ROWS (incl. headers/action/back): ${nRows}`);
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
