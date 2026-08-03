// Headless test for CS021 Phase 3 — the ORBIT debug panel section, persistence, and the start-angle
// reroll keybind.
//
//   node scratchpad/test-cs021-p3.js
//
// WHAT LANDED (PLANNED-FEATURES-CS021 §6, FLAG-CS021-a/b/c/g). Ten live knobs under a new "ORBIT" debug
// header (registry 34 -> 44, nine headers), every `def` derived from the P1/P2 ORBIT_* consts:
//   orbitGapMult, orbitSafetyMargin, orbitCount, orbitDensity1-5, orbitAngVel, orbitFastMult.
// Persistence is the existing additive afd_settings_v1.debug path — no schema bump, no new key.
// orbitCount carries a NEW registry hook, `clampShown` (the one addition to the generic idiom this phase
// makes to applyDebug()): a requested value collapses to the largest ring count whose auto-derived
// radiusStep still clears the ORBIT_RADIUS_STEP_PAD floor (132 px at size-3) — 5 collapses to 4, and the
// collapse is visible EVERYWHERE at once (debugShown, DEBUG, and what's persisted), never a silent
// mismatch. REPOINTED BY CS022 P2 (Correction C3, spec §6/§9): the paragraph above describes CS021 P3's
// original rule, now RETIRED — orbitRadiusStepFor() holds ORBIT_RADIUS_STEP fixed regardless of count,
// and clampShown's underlying orbitEffectiveCount() clamps against the orbit-world wrap-clean budget
// instead of this step-pad floor. See section F below for the repointed behaviour and its own note.
// orbitGapMult's slider OVERRIDES orbitGapMult(level)'s occurrence curve only while it has been
// moved off its own default (orbitEffectiveGapMult()). Densities are consumed first-`orbitCount`
// (FLAG-CS021-b). The start-angle reroll (FLAG-CS021-c) is a raw "r" keybind, live only on the debug
// screen while an orbit level's layout exists (game.orbitLayout) — it re-randomises every ring's
// startAngle and re-runs spawn safety, touching nothing else.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL applyDebug/menuDebug/debugEntry*/keydown-listener/nextWave/
// update(1/60) paths. Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check + source pins, incl. TRAP 1 (GAME_VERSION) and the registry shape
//  (B) the ten ORBIT entries: def derives from the shipped consts, in DISPLAY units; toNative(30) ===
//      Math.PI/6 for orbitAngVel; clampShown present ONLY on orbitCount
//  (C) every knob driven through the REAL applyDebug / menuDebug ◄► / typed-entry commit path
//  (D) persistence round-trip through afd_settings_v1.debug, including bad-value fallbacks per field
//  (E) returnToDefaults() — bindings only; orbit knobs survive untouched
//  (F) the orbitCount clamp — REPOINTED BY CS022 P2 (Correction C3, spec §6/§9): the clamp is now
//      budget-derived against the orbit-world wrap-clean budget instead of the retired step-pad floor.
//      At today's still-CS021 geometry (180/150) nothing in the registry's [3,5] range clamps any more;
//      radiusStep is now a fixed value regardless of count, and the fairness sweep is re-run at the
//      (no-longer-clamped) 5-ring and 3-ring geometries.
//  (G) densities consumed first-orbitCount (FLAG-CS021-b) — a real spawn proves it, not just the formula
//  (H) orbitGapMult overrides the occurrence curve only while touched (spec §6 table)
//  (I) the reroll: layout-level invariants (counts/radii/density/angVel byte-identical, startAngle
//      moves), real-entity repositioning including after a partial harvest, and re-run spawn safety
//  (J) the reroll KEYBIND, through the REAL keydown listener — gated on debug screen + live orbit layout,
//      inert while typing, inert off an orbit level
//  (K) a velocity knob reaches the motion mode: set orbitAngVel, drive real frames, angle matches
//  (L) regression touchstones: default totals table (40/45) unchanged, DEBUG_ROWS count, GAME_VERSION

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
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs021p3_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment (the standing stub idiom, with listener capture for the keydown test) ----
function makeCtxStub() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "settings", "startGame", "update", "nextWave", "levelDef",
  "generateOrbitLayout", "spawnOrbitWave", "orbitGapMult", "orbitEffectiveGapMult",
  "orbitEffectiveCount", "orbitRadiusStepFor", "rerollOrbitStartAngles", "placeOrbitRing",
  "ORBIT_LEVEL_EVERY", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RADIUS_STEP_PAD", "ORBIT_RING_COUNT",
  "ORBIT_DENSITY", "ORBIT_GAP_MULT", "ORBIT_GAP_MULT_FLOOR", "ORBIT_GAP_MULT_STEP",
  "ORBIT_SAFETY_MARGIN", "ORBIT_ANG_VEL", "ORBIT_FAST_MULT", "ORBIT_FAST_RING",
  "DEBRIS_RADII", "SHIP_RADIUS", "WORLD_W", "WORLD_H", "TAU", "dist2", "wrapPos",
  "DEBUG", "debugShown", "applyDebug", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DebugPanel",
  "saveSettings", "loadSettings", "STORAGE_KEY", "returnToDefaults", "bindings", "REBINDABLE", "DEFAULT_BINDINGS",
  "DebugCode", "DEBUG_CODE", "enterDebug", "gotoScreen", "menuDebug", "menuInput", "drawDebug", "drawMenu",
  "debugSelectedVar", "debugStep", "debugScrollTop", "debugEntryActive", "debugEntryKey", "debugEntryCommit",
  "debugEntryCancel", "DEBUG_ENTRY_CHARS", "GAME_VERSION", "AudioSys",
];

// Only needed to drive the REAL keydown listener (section J), which unconditionally calls
// AudioSys.init()/resume() before anything else — same idiom as test-cs018-p2.js's audio:true harness.
function makeAudioProxy() {
  let proxy;
  proxy = new Proxy(function () {}, {
    get(t, prop) {
      if (prop === "currentTime") return 0;
      if (prop === "value") return 0;
      if (prop === "state") return "running";
      if (prop === "gain" || prop === "frequency" || prop === "destination") return proxy;
      return () => proxy;
    },
    set() { return true; }
  });
  return proxy;
}

function build({ storage = null, audio = false } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const audioProxy = audio ? makeAudioProxy() : null;
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? function () { return audioProxy; } : undefined,
    webkitAudioContext: undefined
  };
  const lsStore = {};
  if (storage) for (const k in storage) lsStore[k] = storage[k];
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const exports = factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
  return { exports, listeners, lsStore };
}

function ev(key, repeat) { return { key, repeat: !!repeat, preventDefault() {} }; }

// Put an instance on the debug screen the way the game does (through the real entry point).
function onDebug(A) {
  const g = A.game;
  g.state = "title"; g.paused = false; g.menu.screen = "titlemenu";
  g.menu.rebinding = null; g.menu.modal = null; g.entry = null;
  A.DebugCode.armed = false; A.DebugCode.buf = "";
  A.enterDebug();
  return g;
}

// Drive the game to absolute level `w` through the REAL nextWave(), clearing the field first so the
// post-call array length is that level's ACTUAL spawn count (same idiom as test-cs021-p1.js/p2.js).
function atWave(X, w) {
  X.game.wave = w - 1;
  X.game.debris.length = 0;
  X.nextWave();
  return X.game.debris.length;
}

const ORBIT_IDS = ["orbitGapMult", "orbitSafetyMargin", "orbitCount",
  "orbitDensity1", "orbitDensity2", "orbitDensity3", "orbitDensity4", "orbitDensity5",
  "orbitAngVel", "orbitFastMult"];

// ================= (A, part 2) source pins =====================
(function sectionA_pins() {
  const X = build().exports;
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

  // TRAP 1 — REPOINTED BY CS021 P5: P5 has bumped the version to "1.0.0.21", so P3's "untouched by me"
  // pin becomes its mirror image — off the pre-CS021 baseline.
  assert(X.GAME_VERSION !== "1.0.0.20", "A: TRAP 1 — GAME_VERSION moved off the pre-CS021 baseline (P5 bumped it)");

  // Registry shape: 44 value entries, nine headers, one of them "ORBIT" holding exactly the ten ids.
  const values = X.DEBUG_VARS.filter(v => !v.header);
  const headers = X.DEBUG_VARS.filter(v => v.header).map(v => v.header);
  eq(values.length, 44, "A: DEBUG_VARS holds 44 value entries (34 + the 10-entry ORBIT section)");
  eq(headers.length, 9, "A: nine section headers");
  assert(headers.includes("ORBIT"), "A: an ORBIT section header exists");
  const orbitIdx = X.DEBUG_VARS.findIndex(v => v.header === "ORBIT");
  const orbitVals = [];
  for (let i = orbitIdx + 1; i < X.DEBUG_VARS.length && !X.DEBUG_VARS[i].header; i++) orbitVals.push(X.DEBUG_VARS[i]);
  eq(orbitVals.map(v => v.id).join(","), ORBIT_IDS.join(","), "A: the ORBIT section holds exactly the ten spec ids, in order");

  // DEBUG_ROWS derives from DEBUG_VARS + the two trailing rows — never a hardcoded count.
  eq(X.DEBUG_ROWS.length, X.DEBUG_VARS.length + 2, "A: DEBUG_ROWS is DEBUG_VARS plus Dump + Back");

  // clampShown is the ONE new registry hook this phase adds, and only orbitCount carries one.
  eq(X.DEBUG_ENTRIES.filter(e => typeof e.clampShown === "function").length, 1,
    "A: exactly one entry (orbitCount) carries a clampShown hook");
  assert(typeof X.DEBUG_ENTRIES.find(e => e.id === "orbitCount").clampShown === "function",
    "A: ...and it is orbitCount's");

  // applyDebug() itself applies clampShown generically — one small addition, not a special case.
  assert(/const clamped = e\.clampShown \? e\.clampShown\(shown\) : shown;/.test(codeOnly),
    "A: applyDebug() runs clampShown generically before storing/persisting");

  // Consumption: spawnOrbitWave reads the live DEBUG.* knobs, not the fixed ORBIT_* consts, for
  // everything except the caller-supplied gapMult (P2's seam) and the fixed-per-design fastRingIndex.
  const spawnBody = codeOnly.slice(codeOnly.indexOf("function spawnOrbitWave"), codeOnly.indexOf("function nextWave"));
  for (const frag of ["DEBUG.orbitSafetyMargin", "DEBUG.orbitDensity1", "DEBUG.orbitDensity5",
                       "DEBUG.orbitAngVel", "DEBUG.orbitFastMult", "DEBUG.orbitCount",
                       "orbitRadiusStepFor(orbitCount)"]) {
    assert(spawnBody.includes(frag), `A: spawnOrbitWave() consumes ${frag}`);
  }
  assert(!/radiusStep:\s*ORBIT_RADIUS_STEP,/.test(spawnBody), "A: the fixed ORBIT_RADIUS_STEP no longer reaches radiusStep directly");
  assert(/spawnOrbitWave\(speedMul,\s*orbitEffectiveGapMult\(game\.wave\)\)/.test(codeOnly),
    "A: nextWave()'s orbit branch calls spawnOrbitWave with orbitEffectiveGapMult(game.wave)");

  // game.orbitLayout: declared in the literal, set unconditionally by both nextWave() branches.
  assert(/orbitLayout:\s*null,/.test(codeOnly), "A: game.orbitLayout is declared in the game literal");
  assert(/game\.orbitLayout\s*=\s*spawnOrbitWave\(/.test(codeOnly), "A: the orbit branch assigns game.orbitLayout");
  assert(/game\.orbitLayout\s*=\s*null;.*field level/.test(codeOnly) || /game\.orbitLayout = null;/.test(codeOnly),
    "A: the field branch clears game.orbitLayout");

  // Exactly one rerollOrbitStartAngles() definition and one raw-keydown call site.
  eq((scriptSrc.match(/function rerollOrbitStartAngles\(/g) || []).length, 1, "A: exactly one rerollOrbitStartAngles definition");
  eq((codeOnly.match(/rerollOrbitStartAngles\(\)/g) || []).length, 2, "A: exactly two mentions — the definition's call-free signature line and the ONE call site");
})();

// ================= (B) the ten entries: def derives from the const, in DISPLAY units =====================
(function sectionB() {
  console.log("(B) the ten ORBIT entries: def derives from the shipped consts, toNative for orbitAngVel");
  const X = build().exports;
  const byId = id => X.DEBUG_ENTRIES.find(e => e.id === id);

  eq(byId("orbitGapMult").def, X.ORBIT_GAP_MULT, "B: orbitGapMult def === ORBIT_GAP_MULT (2.5)");
  eq(byId("orbitGapMult").min, 1.5, "B: orbitGapMult min 1.5");
  eq(byId("orbitGapMult").max, 4.0, "B: orbitGapMult max 4.0");
  eq(byId("orbitGapMult").step, 0.05, "B: orbitGapMult step 0.05");

  eq(byId("orbitSafetyMargin").def, X.ORBIT_SAFETY_MARGIN, "B: orbitSafetyMargin def === ORBIT_SAFETY_MARGIN (8)");

  eq(byId("orbitCount").def, X.ORBIT_RING_COUNT, "B: orbitCount def === ORBIT_RING_COUNT (4)");
  eq(byId("orbitCount").min, 3, "B: orbitCount min 3");
  eq(byId("orbitCount").max, 5, "B: orbitCount max 5 (the nominal range; geometry clamps further)");

  ["orbitDensity1", "orbitDensity2", "orbitDensity3", "orbitDensity4"].forEach((id, i) => {
    eq(byId(id).def, X.ORBIT_DENSITY[i], `B: ${id} def === ORBIT_DENSITY[${i}]`);
  });
  eq(byId("orbitDensity5").def, X.ORBIT_DENSITY[3], "B: orbitDensity5 def mirrors ring 4's climax density (no shipped 5th ring)");

  // orbitAngVel: DISPLAY units are degrees/second; def converts ORBIT_ANG_VEL (radians) back to degrees.
  const angVelEntry = byId("orbitAngVel");
  close(angVelEntry.def, X.ORBIT_ANG_VEL * 180 / Math.PI, "B: orbitAngVel def is ORBIT_ANG_VEL in degrees/sec");
  eq(angVelEntry.def, 6, "B: ...which is 6 deg/s at the shipped constant");
  assert(typeof angVelEntry.toNative === "function", "B: orbitAngVel carries a toNative converter");
  eq(angVelEntry.toNative(30), Math.PI / 6, "B: toNative(30) === Math.PI/6 (FLAG-CS021-g)");
  close(angVelEntry.toNative(angVelEntry.def), X.ORBIT_ANG_VEL, "B: toNative(def) round-trips exactly to ORBIT_ANG_VEL", 1e-15);
  // No OTHER orbit entry carries a toNative — display units already ARE native units for the rest.
  for (const id of ORBIT_IDS) if (id !== "orbitAngVel") assert(!byId(id).toNative, `B: ${id} has no toNative (display === native)`);

  eq(byId("orbitFastMult").def, X.ORBIT_FAST_MULT, "B: orbitFastMult def === ORBIT_FAST_MULT (3.0)");
  eq(byId("orbitFastMult").min, 1.0, "B: orbitFastMult min 1.0");
  eq(byId("orbitFastMult").max, 6.0, "B: orbitFastMult max 6.0");

  // Every entry seeds debugShown/DEBUG identically to its def at a fresh load (through clampShown/toNative).
  for (const id of ORBIT_IDS) {
    const e = byId(id);
    const wantShown = e.clampShown ? e.clampShown(e.def) : e.def;
    eq(X.debugShown[id], wantShown, `B: ${id} seeded debugShown at its (possibly clamped) default`);
    eq(X.DEBUG[id], e.toNative ? e.toNative(wantShown) : wantShown, `B: ${id} seeded DEBUG at its native default`);
  }
})();

// ================= (C) every knob through the REAL applyDebug / menuDebug / typed-entry path =====
(function sectionC() {
  console.log("(C) every knob driven through the REAL applyDebug in DISPLAY units");
  const X = build().exports;
  const g = onDebug(X);

  function stepAndCheck(id, dir, n) {
    g.menu.index = X.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === id);
    for (let i = 0; i < n; i++) X.menuDebug(dir);
  }

  // ◄►: orbitSafetyMargin steps by exactly its own step (2), from its default (8).
  stepAndCheck("orbitSafetyMargin", "right", 1);
  eq(X.debugShown.orbitSafetyMargin, 10, "C: orbitSafetyMargin stepped right by 2 -> 10");
  eq(X.DEBUG.orbitSafetyMargin, 10, "C: ...and DEBUG agrees (no unit conversion)");
  stepAndCheck("orbitSafetyMargin", "left", 1);
  eq(X.debugShown.orbitSafetyMargin, 8, "C: back to the default via one left-step");

  // Typed entry: orbitAngVel typed to "30" commits through the SAME toNative path as the default.
  g.menu.index = X.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === "orbitAngVel");
  for (const ch of "30") X.debugEntryKey(ch);
  X.menuDebug("confirm");
  eq(X.debugShown.orbitAngVel, 30, "C: typed 30 committed live (display units, degrees/sec)");
  eq(X.DEBUG.orbitAngVel, Math.PI / 6, "C: ...and DEBUG holds the native radians/sec (toNative ran)");

  // Typed entry: orbitGapMult typed to "3.25" (within [1.5,4.0]).
  g.menu.index = X.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === "orbitGapMult");
  for (const ch of "3.25") X.debugEntryKey(ch);
  X.menuDebug("confirm");
  eq(X.debugShown.orbitGapMult, 3.25, "C: typed 3.25 committed on orbitGapMult");

  // ◄► from the default clamps at [min,max] for every remaining orbit entry (mirrors test-cs015-p5's
  // whole-registry sweep, which itself now excludes orbitCount — see that file's own repoint note).
  for (const id of ORBIT_IDS) {
    if (id === "orbitCount") continue;   // its own clamp semantics are covered in section F
    const e = X.DEBUG_ENTRIES.find(v => v.id === id);
    const n = Math.ceil((e.max - e.min) / e.step) + 5;
    stepAndCheck(id, "right", n);
    eq(X.debugShown[id], e.max, `C: ${id} clamps at its max ${e.max} via real menuDebug stepping`);
    stepAndCheck(id, "left", n);
    eq(X.debugShown[id], e.min, `C: ${id} clamps at its min ${e.min} via real menuDebug stepping`);
  }
})();

// ================= (D) persistence round-trip, incl. bad-value fallbacks =====================
(function sectionD() {
  console.log("(D) persistence round-trip through afd_settings_v1.debug, incl. bad-value fallbacks");
  const B = build();
  const X = B.exports;

  // Move every orbit knob off its default to a distinct, in-range, non-default value, then persist.
  const want = {};
  for (const id of ORBIT_IDS) {
    const e = X.DEBUG_ENTRIES.find(v => v.id === id);
    const raw = id === "orbitCount" ? 3 : Math.max(e.min, Math.min(e.max, e.def + e.step * 2));
    X.applyDebug(id, raw);
    want[id] = X.debugShown[id];   // through clampShown if it has one
  }
  X.saveSettings();
  const blob = B.lsStore[X.STORAGE_KEY];
  assert(typeof blob === "string", "D: saveSettings wrote the settings blob");
  const parsed = JSON.parse(blob);
  for (const id of ORBIT_IDS) eq(parsed.debug[id], want[id], `D: the blob carries ${id}'s value in display units`);

  // A fresh module instance seeded with that blob restores every orbit value at startup.
  const reload = build({ storage: { [X.STORAGE_KEY]: blob } }).exports;
  for (const id of ORBIT_IDS) {
    eq(reload.debugShown[id], want[id], `D: a fresh load restored ${id} (${reload.debugShown[id]} === ${want[id]})`);
  }
  eq(reload.DEBUG.orbitAngVel, want.orbitAngVel * Math.PI / 180, "D: ...and orbitAngVel's native value re-derived via toNative");

  // Bad-value fallbacks — one representative bad case per field shape: out-of-range, NaN, wrong type,
  // and a missing key entirely. Every one must leave the SHIPPED default in place, never stick or crash.
  const bad = {
    orbitGapMult: 99,              // out of [1.5, 4.0]
    orbitSafetyMargin: -5,         // out of [0, 32]
    orbitCount: NaN,               // not finite
    orbitDensity1: "0.5",          // wrong type (string, not number)
    orbitDensity2: 1.5,            // out of [0, 1]
    // orbitDensity3, 4, 5: omitted entirely — a missing key
    orbitAngVel: 9999,             // out of [0, 60]
    orbitFastMult: 0,              // out of [1.0, 6.0]
  };
  const badLoad = build({ storage: { [X.STORAGE_KEY]: JSON.stringify({ debug: bad }) } }).exports;
  for (const id of ORBIT_IDS) {
    const e = badLoad.DEBUG_ENTRIES.find(v => v.id === id);
    const wantDefault = e.clampShown ? e.clampShown(e.def) : e.def;
    eq(badLoad.debugShown[id], wantDefault, `D: bad/missing ${id} left at the shipped default (${wantDefault})`);
  }
})();

// ================= (E) returnToDefaults() — bindings only, orbit knobs survive =====================
(function sectionE() {
  console.log("(E) returnToDefaults() resets bindings only; orbit knobs are untouched");
  const X = build().exports;
  onDebug(X);

  X.applyDebug("orbitAngVel", 45);
  X.applyDebug("orbitGapMult", 3.1);
  X.bindings.thrust.keys = ["k"]; // simulate a rebind away from the default

  X.returnToDefaults();

  eq(X.debugShown.orbitAngVel, 45, "E: orbitAngVel survived returnToDefaults() untouched");
  eq(X.debugShown.orbitGapMult, 3.1, "E: orbitGapMult survived returnToDefaults() untouched");
  eq(X.bindings.thrust.keys[0], X.DEFAULT_BINDINGS.thrust.keys[0], "E: ...but the rebound key WAS restored to its default");
  assert(X.DEFAULT_BINDINGS.thrust.keys[0] !== "k", "E: (control) the default itself was never 'k'");
})();

// ========= (F) the orbitCount clamp — REPOINTED BY CS022 P2 (Correction C3, spec §6/§9) ==============
// CS021 P3 shipped this section asserting a step-pad-derived clamp: request 5, get 4 everywhere, and
// orbitRadiusStepFor(3) widening to 225. CS022 P2 retired both halves of that rule — orbitRadiusStepFor
// now holds ORBIT_RADIUS_STEP fixed at every count, and orbitEffectiveCount's clampShown now walks
// against the orbit-world WRAP-CLEAN BUDGET (worldDims(WORLD_SIZE_ORBIT)) instead of the step-pad floor.
// At the geometry still live today (ORBIT_INNER_RADIUS 180 / ORBIT_RADIUS_STEP 150 — P3 owns 460/276),
// that budget (1420px) has so much headroom that nothing in the registry's own [3,5] range clamps any
// more; this section proves that directly, and proves the walk-down itself still exists by driving the
// pure function past the registry's own ceiling (see test-cs022-p2.js §C/§D for the dedicated formula
// coverage at both geometries — this file only re-proves the ONE thing that changed for its own scope:
// the real, wired-in debug-panel clamp and a real spawn's geometry).
(function sectionF() {
  console.log("(F) orbitCount clamp is now budget-derived (CS022 P2) — nothing in [3,5] clamps at this geometry");
  const B = build();
  const X = B.exports;

  eq(X.orbitRadiusStepFor(4), 150, "F: radiusStep at count 4 still reproduces the shipped ORBIT_RADIUS_STEP exactly");
  eq(X.orbitRadiusStepFor(3), 150, "F: radiusStep at count 3 no longer widens (was 225 under the retired rule) — CS022 P2 holds the step fixed");

  X.applyDebug("orbitCount", 5);
  eq(X.debugShown.orbitCount, 5, "F: requesting 5 is NO LONGER clamped at this geometry (was 4 under the retired step-pad rule)");
  eq(X.DEBUG.orbitCount, 5, "F: ...and DEBUG agrees");

  X.saveSettings();
  const reload = build({ storage: { [X.STORAGE_KEY]: B.lsStore[X.STORAGE_KEY] } }).exports;
  eq(reload.debugShown.orbitCount, 5, "F: the persisted value is the requested 5, unclamped");

  // A count of 3 was already achievable under the retired rule and still is under the new one.
  X.applyDebug("orbitCount", 3);
  eq(X.debugShown.orbitCount, 3, "F: 3 is still not clamped — comfortably achievable");

  // The walk-down rule itself still exists — it just takes a far larger request to trigger it now that
  // the budget, not a step-pad, is the ceiling. Driven directly against the raw function past the
  // registry's own [3,5] range, which the debug panel never requests but the pure function has no
  // opinion about.
  eq(X.orbitEffectiveCount(8), 8, "F: orbitEffectiveCount(8): edge 1276px still clears the 1420px orbit-world budget");
  eq(X.orbitEffectiveCount(9), 8, "F: orbitEffectiveCount(9): edge 1426px would not — walks down to 8");

  // The fairness sweep, re-run at the (no-longer-clamped) 5-ring and 3-ring geometries via a REAL spawn —
  // spec §8 items 1-4, at the shipped gapMult (2.5, occurrence 1, level 3). Radii now use the FIXED step
  // at every count (Correction C3), so a 3-ring request no longer reaches out to the old 4-ring edge.
  function fairnessSweep(X, level) {
    atWave(X, level);
    return X.game.orbitLayout;
  }
  X.applyDebug("orbitCount", 5); // -> no longer clamped: 5 rings actually spawn now
  let L = fairnessSweep(X, 3);
  eq(L.rings.length, 5, "F: orbitCount 5: five rings actually spawned (no longer clamped to 4)");
  eq(L.rings.map(r => r.radius).join(","), "180,330,480,630,780", "F: 5-ring radii: the fixed 150px step throughout, per Correction C3");
  for (const r of L.rings) {
    assert(r.actualGapPx >= X.SHIP_RADIUS * 2 * X.orbitEffectiveGapMult(3) - 1e-9,
      `F: 5-ring geometry ring r=${r.radius}: actualGapPx (${r.actualGapPx.toFixed(1)}) clears the fairness floor`);
    assert(r.maxCount >= 1, `F: 5-ring geometry ring r=${r.radius}: maxCount >= 1`);
  }
  eq(L.outerEdge, 826, "F: orbitCount 5's outer edge is 780 + 46 = 826px (was a fixed 676px under the retired rule)");

  X.applyDebug("orbitCount", 3);
  L = fairnessSweep(X, 3);
  eq(L.rings.length, 3, "F: orbitCount 3: three rings actually spawned");
  eq(L.rings.map(r => r.radius).join(","), "180,330,480", "F: 3-ring radii: the fixed 150px step (was 180,405,630 under the retired outer-edge-fixed rule)");
  for (const r of L.rings) {
    assert(r.actualGapPx >= X.SHIP_RADIUS * 2 * X.orbitEffectiveGapMult(3) - 1e-9,
      `F: 3-ring geometry ring r=${r.radius}: actualGapPx (${r.actualGapPx.toFixed(1)}) clears the fairness floor`);
    assert(r.maxCount >= 1, `F: 3-ring geometry ring r=${r.radius}: maxCount >= 1`);
  }
})();

// ================= (G) densities consumed first-orbitCount (FLAG-CS021-b) =====================
(function sectionG() {
  console.log("(G) densities are consumed first-orbitCount — a real spawn proves it");
  const X = build().exports;

  // Fingerprint values, each distinct and far from any default, so a mismatch can't hide.
  const FP = [0.11, 0.22, 0.33, 0.44, 0.99];
  ["orbitDensity1", "orbitDensity2", "orbitDensity3", "orbitDensity4", "orbitDensity5"].forEach((id, i) =>
    X.applyDebug(id, FP[i]));

  X.applyDebug("orbitCount", 3);
  atWave(X, 3);
  const L3 = X.game.orbitLayout;
  eq(L3.rings.length, 3, "G: three rings spawned at orbitCount 3");
  L3.rings.forEach((r, i) => close(r.density, FP[i], `G: ring ${i + 1} density === orbitDensity${i + 1} (first-3 consumed)`));

  // orbitDensity4/5 changed too but must have had ZERO effect at orbitCount 3 — prove it by changing
  // them again and re-spawning: the first three rings' densities (and therefore counts) must not move.
  X.applyDebug("orbitDensity4", 0.05);
  X.applyDebug("orbitDensity5", 0.05);
  atWave(X, 3);
  const L3b = X.game.orbitLayout;
  L3b.rings.forEach((r, i) => close(r.density, FP[i], `G: changing orbitDensity4/5 left ring ${i + 1} (of 3) untouched`));

  // Now widen to 4 rings — ring 4 picks up orbitDensity4's LATEST value (0.05), never a stale copy.
  X.applyDebug("orbitCount", 4);
  atWave(X, 3);
  const L4 = X.game.orbitLayout;
  eq(L4.rings.length, 4, "G: four rings spawned at orbitCount 4");
  close(L4.rings[3].density, 0.05, "G: ring 4 now consumes orbitDensity4's current value");
})();

// ================= (H) orbitGapMult overrides the occurrence curve only while touched =====================
(function sectionH() {
  console.log("(H) orbitGapMult overrides orbitGapMult(level) only while moved off its own default");
  const X = build().exports;

  // Untouched: identical to the pure occurrence-scaled curve at every level, deep past the floor too.
  for (const level of [3, 6, 24, 63]) {
    eq(X.orbitEffectiveGapMult(level), X.orbitGapMult(level), `H: untouched, level ${level}: matches orbitGapMult(level)`);
  }

  // Touched: overrides at EVERY level, including ones the occurrence curve would floor differently.
  X.applyDebug("orbitGapMult", 3.0);
  for (const level of [3, 24, 63]) {
    eq(X.orbitEffectiveGapMult(level), 3.0, `H: touched (3.0), level ${level}: override wins over orbitGapMult(level)`);
  }
  assert(X.orbitGapMult(24) !== 3.0, "H: (control) the underlying occurrence curve at level 24 is NOT 3.0 (it's the 1.8 floor)");

  // A real spawn at a touched value reflects the override, not the occurrence curve.
  atWave(X, 24); // occurrence 8 — the 1.8x floor, UNLESS overridden
  const L = X.game.orbitLayout;

  // Direct arithmetic check: minRequiredGap at the override (3.0x) vs. what 1.8x (the level-24 floor)
  // would have produced — they must differ, proving the spawn really used 3.0.
  const shipDia = X.SHIP_RADIUS * 2;
  const gapAt3  = Math.max(shipDia + X.DEBUG.orbitSafetyMargin, shipDia * 3.0);
  const gapAt18 = Math.max(shipDia + X.DEBUG.orbitSafetyMargin, shipDia * 1.8);
  assert(gapAt3 !== gapAt18, "H: (control) 3.0x and 1.8x produce different minRequiredGap values");
  const spacePerSat = X.DEBRIS_RADII[3] * 2 + gapAt3;
  const wantMaxCount0 = Math.floor(2 * Math.PI * L.rings[0].radius / spacePerSat);
  eq(L.rings[0].maxCount, wantMaxCount0, "H: ring 1's maxCount at level 24 matches the OVERRIDE (3.0x), not the floor (1.8x)");

  // Returning the slider to its exact default restores occurrence-scaled behaviour.
  X.applyDebug("orbitGapMult", X.ORBIT_GAP_MULT);
  eq(X.orbitEffectiveGapMult(24), X.orbitGapMult(24), "H: back at the default, the occurrence curve governs again");
})();

// ================= (I) the reroll: layout invariants + real repositioning =====================
(function sectionI() {
  console.log("(I) reroll: startAngle moves, counts/radii/density/angVel byte-identical, spawn safety re-runs");
  const X = build().exports;

  atWave(X, 3);
  const L = X.game.orbitLayout;
  assert(!!L, "I: (setup) game.orbitLayout is live after a real orbit-level spawn");
  eq(X.game.debris.length, 40, "I: (setup) the shipped default totals 40 satellites");

  const snap = L.rings.map(r => ({ radius: r.radius, count: r.count, maxCount: r.maxCount, density: r.density,
                                    angVel: r.angVel, gap: r.actualGapPx, angleStep: r.angleStep, start: r.startAngle }));
  const entitySnap = X.game.debris.map(d => ({ r: d.orbitRadius, w: d.orbitAngVel, x: d.x, y: d.y, a: d.orbitAngle }));

  const ok = X.rerollOrbitStartAngles();
  assert(ok === true, "I: rerollOrbitStartAngles() reports success on a live orbit level");

  L.rings.forEach((r, i) => {
    eq(r.radius, snap[i].radius, `I: reroll left ring ${i + 1} radius alone`);
    eq(r.count, snap[i].count, `I: reroll left ring ${i + 1} count alone`);
    eq(r.maxCount, snap[i].maxCount, `I: reroll left ring ${i + 1} maxCount alone`);
    eq(r.density, snap[i].density, `I: reroll left ring ${i + 1} density alone`);
    eq(r.angVel, snap[i].angVel, `I: reroll left ring ${i + 1} angVel alone`);
    eq(r.actualGapPx, snap[i].gap, `I: reroll left ring ${i + 1} gap alone`);
    eq(r.angleStep, snap[i].angleStep, `I: reroll left ring ${i + 1} angleStep alone`);
  });
  assert(L.rings.some(r => r.startAngle !== snap[r.index].start), "I: (control) at least one ring's startAngle DID move");

  // Live entities: orbitRadius/orbitAngVel are byte-identical (ring identity + speed untouched); at
  // least one entity's angle/position genuinely moved to match the new layout.
  eq(X.game.debris.length, 40, "I: reroll spawned/destroyed nothing — still 40 satellites");
  let posChanged = 0;
  X.game.debris.forEach((d, i) => {
    eq(d.orbitRadius, entitySnap[i].r, `I: entity ${i}: orbitRadius unchanged by reroll`);
    eq(d.orbitAngVel, entitySnap[i].w, `I: entity ${i}: orbitAngVel unchanged by reroll`);
    close(Math.sqrt(X.dist2(d, d.orbitCenter)), d.orbitRadius,
      `I: entity ${i}: still exactly on its ring after reroll`, 1e-6);
    if (d.x !== entitySnap[i].x || d.y !== entitySnap[i].y) posChanged++;
  });
  assert(posChanged > 0, "I: (control) at least one entity's position actually moved");

  // Spawn safety re-ran: every ring's spawnSafetyCleared flag is set (the pass touched every ring).
  assert(L.rings.every(r => typeof r.spawnSafetyCleared === "boolean"), "I: spawn safety re-ran on every ring (spawnSafetyCleared set)");

  // Off an orbit level (or before any game has spawned one), reroll is an inert no-op.
  const Y = build().exports;
  eq(Y.game.orbitLayout, null, "I: (control) a fresh module has no live orbit layout");
  eq(Y.rerollOrbitStartAngles(), false, "I: reroll off an orbit level returns false and does nothing");

  // PARTIAL HARVEST: destroy a couple of satellites, then reroll must still succeed and must not throw
  // or misplace the SURVIVORS — every survivor stays exactly on its own ring.
  const Z = build().exports;
  atWave(Z, 3);
  const victims = Z.game.debris.filter(d => d.orbitRadius === Z.game.orbitLayout.rings[0].radius).slice(0, 2);
  victims.forEach(v => { v.dead = true; });
  Z.game.debris = Z.game.debris.filter(d => !d.dead);
  eq(Z.game.debris.length, 38, "I: (setup) two ring-1 satellites removed, 38 remain");
  const ok2 = Z.rerollOrbitStartAngles();
  assert(ok2 === true, "I: reroll succeeds after a partial harvest");
  for (const d of Z.game.debris) {
    close(Math.sqrt(Z.dist2(d, d.orbitCenter)), d.orbitRadius, "I: every SURVIVOR is still exactly on its ring after a post-harvest reroll", 1e-6);
  }
  const ring1Left = Z.game.debris.filter(d => d.orbitRadius === Z.game.orbitLayout.rings[0].radius).length;
  eq(ring1Left, 4, "I: ring 1 still has its 4 surviving members (6 - 2), none duplicated or dropped");
})();

// ================= (J) the reroll KEYBIND, through the REAL keydown listener =====================
(function sectionJ() {
  console.log("(J) the reroll keybind: gated on debug screen + a live orbit layout, inert elsewhere");
  const B = build({ audio: true });
  const X = B.exports;
  const kd = e => B.listeners.keydown.forEach(fn => fn(e));

  atWave(X, 3);
  const before = X.game.debris.map(d => d.orbitAngle);

  // Off the debug screen entirely: "r" does nothing to the layout.
  X.game.menu.screen = null; X.game.state = "playing"; X.game.paused = false;
  kd(ev("r"));
  eq(X.game.debris.map(d => d.orbitAngle).join(","), before.join(","), "J: 'r' off the debug screen is inert");

  // On the debug screen, but the game never reached an orbit level: inert (game.orbitLayout null).
  const C = build({ audio: true });
  const Y = C.exports;
  const kdY = e => C.listeners.keydown.forEach(fn => fn(e));
  onDebug(Y);
  eq(Y.game.menu.screen, "debug", "J: (setup) onDebug() actually reached the debug screen");
  eq(Y.game.orbitLayout, null, "J: (setup) a fresh module on the debug screen has no live orbit layout");
  kdY(ev("r"));
  assert(true, "J: 'r' with no live layout does not throw (nothing to compare — there is no orbit debris to move)");

  // On the debug screen with a live layout: "r" fires the reroll.
  onDebug(X);
  X.game.menu.screen = "debug";
  assert(!!X.game.orbitLayout, "J: (setup) the orbit layout from atWave(3) is still live");
  kd(ev("r"));
  const afterAngles = X.game.debris.map(d => d.orbitAngle);
  assert(afterAngles.join(",") !== before.join(","), "J: 'r' on the debug screen WITH a live layout rerolls (angles changed)");

  // While a numeric entry is pending, "r" must stay inert (it's not a digit, and must not sneak a reroll
  // in behind the typist's back).
  const angles2 = X.game.debris.map(d => d.orbitAngle);
  X.game.menu.index = X.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === "orbitAngVel");
  X.debugEntryKey("3"); // arm a pending numeric entry
  assert(X.debugEntryActive(), "J: (setup) a numeric entry is now pending");
  kd(ev("r"));
  eq(X.game.debris.map(d => d.orbitAngle).join(","), angles2.join(","), "J: 'r' mid-typed-entry is inert (no reroll)");
  eq(X.DebugPanel.entry, "3", "J: ...and the pending entry itself is untouched ('r' wasn't appended to it either)");
  X.debugEntryCancel();

  // Held-repeat "r" (e.repeat === true) is handled the same as every other debug action here — the
  // reroll itself has no per-frame effect to runaway-guard against (it's a one-shot mutation), but the
  // gate must still fire on a genuine repeat the same as a fresh press.
  const angles3 = X.game.debris.map(d => d.orbitAngle);
  kd(ev("r", true));
  assert(X.game.debris.map(d => d.orbitAngle).join(",") !== angles3.join(","), "J: a repeated 'r' still rerolls (no special repeat-suppression on this key)");
})();

// ================= (K) a velocity knob reaches the motion mode =====================
(function sectionK() {
  console.log("(K) orbitAngVel reaches the motion mode: real frames, angle advances by the new rate");
  const X = build().exports;

  X.applyDebug("orbitAngVel", 30); // 30 deg/s -> Math.PI/6 rad/s, native
  eq(X.DEBUG.orbitAngVel, Math.PI / 6, "K: (setup) DEBUG.orbitAngVel holds the native rad/s");

  X.startGame();
  atWave(X, 3);
  X.game.state = "playing"; X.game.paused = false;   // update() early-returns off "playing" — same idiom as test-cs021-p1.js §E
  const ring1 = X.game.orbitLayout.rings[0]; // NOT the fast ring
  const ring3 = X.game.orbitLayout.rings[2]; // the fast ring (ORBIT_FAST_RING = 3)
  close(ring1.angVel, Math.PI / 6, "K: ring 1's angVel is the new base rate");
  close(ring3.angVel, (Math.PI / 6) * X.DEBUG.orbitFastMult, "K: ring 3's angVel is base x the fast multiplier");

  const d = X.game.debris.find(s => s.orbitRadius === ring1.radius);
  const a0 = d.orbitAngle;
  const DT = 1 / 60, FRAMES = 30;
  for (let i = 0; i < FRAMES; i++) X.update(DT);
  const survivor = X.game.debris.find(s => s.orbitRadius === ring1.radius && s.orbitAngVel === d.orbitAngVel);
  assert(!!survivor, "K: (control) a ring-1 satellite survived 30 frames untouched");
  close(survivor.orbitAngle, a0 + (Math.PI / 6) * DT * FRAMES, "K: angle advanced by exactly the dialed rate x elapsed time", 1e-6);
})();

// ================= (L) regression touchstones =====================
(function sectionL() {
  console.log("(L) regression: default totals table unchanged, DEBUG_ROWS count, real spawn byte-identical to P1/P2");
  const X = build().exports;

  // REPOINTED BY CS021 P5 — mirror image, same reason as §A's TRAP 1 above.
  assert(X.GAME_VERSION !== "1.0.0.20", "L: GAME_VERSION off the pre-CS021 baseline");

  const n3  = atWave(X, 3);
  const n24 = atWave(X, 24);
  const n63 = atWave(X, 63);
  eq(n3, 40, "L: level 3 (occurrence 1) still spawns 40 at shipped defaults");
  eq(n24, 45, "L: level 24 (the floor) still spawns 45 at shipped defaults");
  eq(n63, 45, "L: level 63 still spawns 45 at shipped defaults");

  const byRadius = {};
  for (const d of X.game.debris) byRadius[d.orbitRadius] = (byRadius[d.orbitRadius] || 0) + 1;
  const radii = Object.keys(byRadius).map(Number).sort((a, b) => a - b);
  eq(radii.join(","), "180,330,480,630", "L: shipped default radii unchanged at level 63");
  eq(radii.map(r => byRadius[r]).join(","), "6,7,8,24", "L: shipped default per-ring counts unchanged at the floor");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
