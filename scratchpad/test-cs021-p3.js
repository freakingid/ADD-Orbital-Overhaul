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
  // CS022 P3: the ring ramp, plus the world-size table §F budgets the re-armed clamp against.
  "activeRingsFor", "worldDims", "WORLD_SIZE_ORBIT",
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

  // Registry shape: 46 value entries, nine headers, one of them "ORBIT" opening with exactly P3's ten ids.
  // REPOINTED BY CS023 P4: the registry grew to 46 and BOTH new entries were APPENDED to the ORBIT section
  // (FLAG-CS023-o), so this file's claim becomes a PREFIX claim rather than an equality one — P3's ten ids
  // are still the first ten of that section, in P3's order, which is exactly what append-only means and is
  // what this was really guarding. The section's full membership is pinned by test-cs023-p4.js.
  const values = X.DEBUG_VARS.filter(v => !v.header);
  const headers = X.DEBUG_VARS.filter(v => v.header).map(v => v.header);
  eq(values.length, 46, "A: DEBUG_VARS holds 46 value entries (34 + P3's 10-entry ORBIT section + CS023 P4's two)");
  eq(headers.length, 9, "A: nine section headers");
  assert(headers.includes("ORBIT"), "A: an ORBIT section header exists");
  const orbitIdx = X.DEBUG_VARS.findIndex(v => v.header === "ORBIT");
  const orbitVals = [];
  for (let i = orbitIdx + 1; i < X.DEBUG_VARS.length && !X.DEBUG_VARS[i].header; i++) orbitVals.push(X.DEBUG_VARS[i]);
  eq(orbitVals.slice(0, ORBIT_IDS.length).map(v => v.id).join(","), ORBIT_IDS.join(","),
    "A: the ORBIT section OPENS with exactly the ten spec ids, in order (CS023 P4 appended two after them)");
  // REPOINTED BY CS023 P4B: orbitGravityAccel -> debrisDriftAccel (spec C15). The row is still the first
  // of the two appended entries, still never inserted; only its id changed.
  eq(orbitVals.slice(ORBIT_IDS.length).map(v => v.id).join(","), "debrisDriftAccel,debrisBounceRestitution",
    "A: P4B — the only ids after the ten spec ids are CS023 P4's two (the first RENAMED by P4B), appended and never inserted");

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
  // REPOINTED BY CS022 P3: the call site gained a third argument, activeRingsFor(game.wave) — the ring
  // ramp, resolved at the same seam gapMult is.
  assert(/spawnOrbitWave\(speedMul,\s*orbitEffectiveGapMult\(game\.wave\),\s*activeRingsFor\(game\.wave\)\)/.test(codeOnly),
    "A: nextWave()'s orbit branch calls spawnOrbitWave with orbitEffectiveGapMult(game.wave) AND activeRingsFor(game.wave)");

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
// REPOINTED AGAIN BY CS022 P3, and this is exactly the re-arming CS022 P2's own STATUS note predicted:
// at P2's still-CS021 geometry (180/150) the 1420 px budget was so generous that NOTHING in the debug
// panel's [3,5] range clamped and the walk-down first bit at a requested 9. At P3's 460/276 geometry a
// 5th ring would sit at 1564 with an edge of 1610 px, so a requested 5 walks back down to 4 — the rule
// is unchanged, the geometry it measures is not. The second change is the RAMP: an orbit level lays one
// ring per occurrence, so a real spawn only shows every requested ring at a FULL-ramp level, and
// activeRingsFor() composes with the knob rather than ignoring it (FLAG-CS022-h) — asserted directly.
(function sectionF() {
  console.log("(F) orbitCount clamp is budget-derived (CS022 P2) and RE-ARMED at CS022 P3's geometry");
  const B = build();
  const X = B.exports;

  eq(X.orbitRadiusStepFor(4), X.ORBIT_RADIUS_STEP, "F: radiusStep at count 4 still reproduces the shipped ORBIT_RADIUS_STEP exactly");
  eq(X.orbitRadiusStepFor(3), X.ORBIT_RADIUS_STEP, "F: radiusStep at count 3 no longer widens (was 225 under the retired rule) — CS022 P2 holds the step fixed");
  eq(X.ORBIT_RADIUS_STEP, 138, "F: ...which at the CS023 P1 geometry is 138 px");

  // REPOINTED BY CS023 P1 (spec C6). The clamp is unchanged and still budget-derived; the GEOMETRY moved
  // under it, so where it bites moved too. At CS022's 460/276 a requested 5 reached 1,610 px and walked
  // back to 4; at CS023's 400/138 a fifth ring reaches only 998 px against a 1,060 px budget, so
  // orbitEffectiveCount(5) === 5 and a FIFTH RING GENUINELY SPAWNS for the first time. The registry's own
  // max is 5, so nothing a player can dial through the panel clamps any more — which is exactly why the
  // walk-down is still proven directly against the raw function past that ceiling, below.
  X.applyDebug("orbitCount", 5);
  eq(X.debugShown.orbitCount, 5, "F: requesting 5 is NO LONGER clamped — CS023's geometry fits five rings (spec C6)");
  eq(X.DEBUG.orbitCount, 5, "F: ...and DEBUG agrees");

  // The clamp still bites — just past the registry's range. 6 rings reach 1,136 px and do not fit.
  X.applyDebug("orbitCount", 6);
  eq(X.debugShown.orbitCount, 5, "F: requesting 6 IS clamped to 5 — the budget rule still has teeth, one ring further out");
  eq(X.DEBUG.orbitCount, 5, "F: ...and DEBUG agrees");

  X.saveSettings();
  const reload = build({ storage: { [X.STORAGE_KEY]: B.lsStore[X.STORAGE_KEY] } }).exports;
  eq(reload.debugShown.orbitCount, 5, "F: the persisted value is the CLAMPED 5, never the requested 6 — clampShown's whole point");

  // A count of 3 was already achievable under the retired rule and still is under the new one.
  X.applyDebug("orbitCount", 3);
  eq(X.debugShown.orbitCount, 3, "F: 3 is still not clamped — comfortably achievable");

  // The boundary, driven directly against the raw function. The registry's own [3,5] range now brackets
  // it, which is the state spec §6 describes.
  const budget = X.worldDims(X.WORLD_SIZE_ORBIT)[1] / 2 - 20;
  const edgeAt = c => X.ORBIT_INNER_RADIUS + (c - 1) * X.ORBIT_RADIUS_STEP + X.DEBRIS_RADII[3];
  eq(budget, 1060, "F: (arithmetic) the size-9 orbit world's wrap-clean budget is 1060px");
  eq(edgeAt(4), 860, "F: (arithmetic) a 4-ring outer edge is 860px");
  eq(edgeAt(5), 998, "F: (arithmetic) a 5-ring outer edge is 998px — and it FITS now (spec C6)");
  eq(edgeAt(6), 1136, "F: (arithmetic) a 6-ring outer edge would be 1136px");
  assert(edgeAt(5) <= budget && edgeAt(6) > budget, `F: 998 fits the ${budget}px orbit-world budget and 1136 does not`);
  eq(X.orbitEffectiveCount(4), 4, "F: orbitEffectiveCount(4): accepted outright");
  eq(X.orbitEffectiveCount(5), 5, "F: orbitEffectiveCount(5): accepted outright too (was 4 at the CS022 geometry)");
  eq(X.orbitEffectiveCount(6), 5, "F: orbitEffectiveCount(6): walks down to 5, the first that fits");
  eq(X.orbitEffectiveCount(20), 5, "F: orbitEffectiveCount(20): a wild request lands on the same 5");

  // The fairness sweep, re-run at the clamped and 3-ring geometries via a REAL spawn — spec §8 items 1-4.
  // CS022 P3: the probe level must be one where the RAMP has finished laying the requested count, or the
  // spawn shows fewer rings than the knob asked for and the assertion measures the ramp instead of the
  // knob. fullRampLevel() reads that off activeRingsFor() rather than assuming level 12.
  function fullRampLevel(X) {
    const want = X.orbitEffectiveCount(X.DEBUG.orbitCount);
    let n = X.ORBIT_LEVEL_EVERY;
    while (n <= 63 && X.activeRingsFor(n).length < want) n += X.ORBIT_LEVEL_EVERY;
    return n;
  }
  function fairnessSweep(X) {
    const lvl = fullRampLevel(X);
    atWave(X, lvl);
    return { L: X.game.orbitLayout, lvl };
  }
  // REPOINTED BY CS023 P1: a requested 5 is no longer clamped, so this staging now spawns FIVE rings —
  // which is C6 observed end to end through a real wave rather than only through orbitEffectiveCount.
  // Note the ramp needs one more occurrence to finish at five rings; fullRampLevel() reads that off
  // activeRingsFor() and so carries the change for free.
  X.applyDebug("orbitCount", 5); // -> 5, unclamped at CS023's geometry
  let { L, lvl } = fairnessSweep(X);
  eq(L.rings.length, 5, "F: orbitCount 5: FIVE rings actually spawned (spec C6 — a fifth ring is reachable for the first time)");
  eq(lvl, 15, "F: ...and the ramp needs occurrence 5 (level 15) to finish laying them");
  eq(L.rings.map(r => r.radius).join(","), "400,538,676,814,952", "F: 5-ring radii: the fixed 138px step throughout, per Correction C3");
  eq(L.inactive.length, 0, `F: at level ${lvl} the ramp has finished — no ring is inactive`);
  for (const r of L.rings) {
    assert(r.actualGapPx >= X.SHIP_RADIUS * 2 * X.orbitEffectiveGapMult(lvl) - 1e-9,
      `F: 4-ring geometry ring r=${r.radius}: actualGapPx (${r.actualGapPx.toFixed(1)}) clears the fairness floor`);
    assert(r.maxCount >= 1, `F: 4-ring geometry ring r=${r.radius}: maxCount >= 1`);
  }
  eq(L.outerEdge, 998, "F: the 5-ring outer edge is 952 + 46 = 998px");

  X.applyDebug("orbitCount", 3);
  ({ L, lvl } = fairnessSweep(X));
  eq(L.rings.length, 3, "F: orbitCount 3: three rings actually spawned");
  eq(L.rings.map(r => r.radius).join(","), "400,538,676", "F: 3-ring radii: the fixed 138px step (was 180,405,630 under the retired outer-edge-fixed rule)");
  for (const r of L.rings) {
    assert(r.actualGapPx >= X.SHIP_RADIUS * 2 * X.orbitEffectiveGapMult(lvl) - 1e-9,
      `F: 3-ring geometry ring r=${r.radius}: actualGapPx (${r.actualGapPx.toFixed(1)}) clears the fairness floor`);
    assert(r.maxCount >= 1, `F: 3-ring geometry ring r=${r.radius}: maxCount >= 1`);
  }
  // FLAG-CS022-h: the ramp COUNTS DOWN FROM THE EFFECTIVE COUNT, so at orbitCount 3 it completes an
  // occurrence earlier and its indices are [2], [2,1], [2,1,0] — never [3,...]. The knob and the ramp
  // compose; neither overrides the other.
  // REPOINTED BY CS023 P1 (FORK-CS023-A): the ramp fills INNERMOST-FIRST, so the index lists are
  // [0], [0,1], [0,1,2] — never counting down from the effective count. The COMPOSITION claim is what
  // this block is for and it is unchanged: at orbitCount 3 the ramp still completes one occurrence early
  // and never reaches a fourth ring.
  eq(JSON.stringify(X.activeRingsFor(3)),  "[0]",     "F: orbitCount 3, occurrence 1: activeRings is [0] — the innermost");
  eq(JSON.stringify(X.activeRingsFor(6)),  "[0,1]",   "F: orbitCount 3, occurrence 2: [0,1]");
  eq(JSON.stringify(X.activeRingsFor(9)),  "[0,1,2]", "F: orbitCount 3, occurrence 3: [0,1,2] — complete one occurrence earlier");
  eq(JSON.stringify(X.activeRingsFor(12)), "[0,1,2]", "F: orbitCount 3, occurrence 4: held, never a fourth ring");
  X.applyDebug("orbitCount", X.ORBIT_RING_COUNT);
  eq(JSON.stringify(X.activeRingsFor(3)),  "[0]",       "F: back at the shipped count, occurrence 1 is [0]");
  eq(JSON.stringify(X.activeRingsFor(12)), "[0,1,2,3]", "F: ...and occurrence 4 is the full [0,1,2,3]");
})();

// ================= (G) densities consumed first-orbitCount (FLAG-CS021-b) =====================
(function sectionG() {
  console.log("(G) densities are consumed first-orbitCount — a real spawn proves it");
  const X = build().exports;

  // Fingerprint values, each distinct and far from any default, so a mismatch can't hide.
  const FP = [0.11, 0.22, 0.33, 0.44, 0.99];
  ["orbitDensity1", "orbitDensity2", "orbitDensity3", "orbitDensity4", "orbitDensity5"].forEach((id, i) =>
    X.applyDebug(id, FP[i]));

  // REPOINTED BY CS022 P3: the spawn has to happen at a FULL-RAMP level, or the ramp (not the density
  // registry) decides how many rings are on the board and this section measures the wrong thing. The
  // per-ring density → per-knob mapping it actually tests is unchanged.
  function fullRampSpawn(X) {
    const want = X.orbitEffectiveCount(X.DEBUG.orbitCount);
    let n = X.ORBIT_LEVEL_EVERY;
    while (n <= 63 && X.activeRingsFor(n).length < want) n += X.ORBIT_LEVEL_EVERY;
    atWave(X, n);
    return X.game.orbitLayout;
  }

  X.applyDebug("orbitCount", 3);
  const L3 = fullRampSpawn(X);
  eq(L3.rings.length, 3, "G: three rings spawned at orbitCount 3");
  L3.rings.forEach((r, i) => close(r.density, FP[i], `G: ring ${i + 1} density === orbitDensity${i + 1} (first-3 consumed)`));

  // orbitDensity4/5 changed too but must have had ZERO effect at orbitCount 3 — prove it by changing
  // them again and re-spawning: the first three rings' densities (and therefore counts) must not move.
  X.applyDebug("orbitDensity4", 0.05);
  X.applyDebug("orbitDensity5", 0.05);
  const L3b = fullRampSpawn(X);
  L3b.rings.forEach((r, i) => close(r.density, FP[i], `G: changing orbitDensity4/5 left ring ${i + 1} (of 3) untouched`));

  // Now widen to 4 rings — ring 4 picks up orbitDensity4's LATEST value (0.05), never a stale copy.
  X.applyDebug("orbitCount", 4);
  const L4 = fullRampSpawn(X);
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

  // REPOINTED BY CS022 P3, three ways. (1) Staged at a FULL-RAMP level so the reroll is exercised across
  // every ring rather than the single ring occurrence 1 now lays. (2) `snap` is keyed by RING INDEX, not
  // by array position — the two used to coincide and no longer do the moment the ramp drops a ring, and
  // the mismatch was a crash, not a soft failure. (3) The entity assertions filter to the RAIL-BORNE
  // population: an orbit level's field component (spec §1.4) has no orbit state for the reroll to touch,
  // and its untouched-ness is asserted separately below.
  let RAMP_LVL = X.ORBIT_LEVEL_EVERY;
  while (RAMP_LVL <= 63 && X.activeRingsFor(RAMP_LVL).length < X.ORBIT_RING_COUNT) RAMP_LVL += X.ORBIT_LEVEL_EVERY;
  atWave(X, RAMP_LVL);
  const L = X.game.orbitLayout;
  assert(!!L, "I: (setup) game.orbitLayout is live after a real orbit-level spawn");
  eq(L.rings.length, X.ORBIT_RING_COUNT, `I: (setup) level ${RAMP_LVL} is a full-ramp level — all four rings live`);
  const railBorne = X.game.debris.filter(d => !!d.orbitCenter);
  const scatter   = X.game.debris.filter(d => !d.orbitCenter);
  eq(railBorne.length, L.total, "I: (setup) the rail-borne population is exactly the layout's total");
  eq(scatter.length, X.levelDef(RAMP_LVL).fieldCount, "I: (setup) ...and the rest is the level's field component");

  const snap = {};
  for (const r of L.rings) snap[r.index] = { radius: r.radius, count: r.count, maxCount: r.maxCount, density: r.density,
                                    angVel: r.angVel, gap: r.actualGapPx, angleStep: r.angleStep, start: r.startAngle };
  const entitySnap = railBorne.map(d => ({ r: d.orbitRadius, w: d.orbitAngVel, x: d.x, y: d.y, a: d.orbitAngle }));
  const scatterSnap = scatter.map(d => ({ x: d.x, y: d.y, vx: d.vx, vy: d.vy }));

  const ok = X.rerollOrbitStartAngles();
  assert(ok === true, "I: rerollOrbitStartAngles() reports success on a live orbit level");

  L.rings.forEach(r => {
    const s = snap[r.index];
    eq(r.radius, s.radius, `I: reroll left ring ${r.index + 1} radius alone`);
    eq(r.count, s.count, `I: reroll left ring ${r.index + 1} count alone`);
    eq(r.maxCount, s.maxCount, `I: reroll left ring ${r.index + 1} maxCount alone`);
    eq(r.density, s.density, `I: reroll left ring ${r.index + 1} density alone`);
    eq(r.angVel, s.angVel, `I: reroll left ring ${r.index + 1} angVel alone`);
    eq(r.actualGapPx, s.gap, `I: reroll left ring ${r.index + 1} gap alone`);
    eq(r.angleStep, s.angleStep, `I: reroll left ring ${r.index + 1} angleStep alone`);
  });
  assert(L.rings.some(r => r.startAngle !== snap[r.index].start), "I: (control) at least one ring's startAngle DID move");

  // Live entities: orbitRadius/orbitAngVel are byte-identical (ring identity + speed untouched); at
  // least one entity's angle/position genuinely moved to match the new layout.
  const railAfter = X.game.debris.filter(d => !!d.orbitCenter);
  const scatterAfter = X.game.debris.filter(d => !d.orbitCenter);
  eq(railAfter.length, entitySnap.length, "I: reroll spawned/destroyed nothing — the same rail-borne satellites");
  eq(scatterAfter.length, scatterSnap.length, "I: ...and the same field-component satellites");
  let posChanged = 0;
  railAfter.forEach((d, i) => {
    eq(d.orbitRadius, entitySnap[i].r, `I: entity ${i}: orbitRadius unchanged by reroll`);
    eq(d.orbitAngVel, entitySnap[i].w, `I: entity ${i}: orbitAngVel unchanged by reroll`);
    close(Math.sqrt(X.dist2(d, d.orbitCenter)), d.orbitRadius,
      `I: entity ${i}: still exactly on its ring after reroll`, 1e-6);
    if (d.x !== entitySnap[i].x || d.y !== entitySnap[i].y) posChanged++;
  });
  assert(posChanged > 0, "I: (control) at least one entity's position actually moved");
  // CS022 P3: the reroll matches live entities by orbitRadius, so the field component — which has none —
  // must be left completely alone. Asserted rather than assumed.
  scatterAfter.forEach((d, i) => {
    eq(d.x, scatterSnap[i].x, `I: field-component satellite ${i}: x untouched by the reroll`);
    eq(d.y, scatterSnap[i].y, `I: field-component satellite ${i}: y untouched by the reroll`);
    eq(d.vx, scatterSnap[i].vx, `I: field-component satellite ${i}: vx untouched`);
    eq(d.vy, scatterSnap[i].vy, `I: field-component satellite ${i}: vy untouched`);
  });

  // Spawn safety re-ran: every ring's spawnSafetyCleared flag is set (the pass touched every ring).
  assert(L.rings.every(r => typeof r.spawnSafetyCleared === "boolean"), "I: spawn safety re-ran on every ring (spawnSafetyCleared set)");

  // Off an orbit level (or before any game has spawned one), reroll is an inert no-op.
  const Y = build().exports;
  eq(Y.game.orbitLayout, null, "I: (control) a fresh module has no live orbit layout");
  eq(Y.rerollOrbitStartAngles(), false, "I: reroll off an orbit level returns false and does nothing");

  // PARTIAL HARVEST: destroy a couple of satellites, then reroll must still succeed and must not throw
  // or misplace the SURVIVORS — every survivor stays exactly on its own ring.
  // REPOINTED BY CS022 P3: staged at a full-ramp level and counted from the live layout, and the
  // survivor loop filters to rail-borne bodies — a field-component satellite has no orbitCenter to
  // measure a ring distance from.
  const Z = build().exports;
  atWave(Z, RAMP_LVL);
  const zRing0 = Z.game.orbitLayout.rings[0];
  const zBefore = Z.game.debris.length;
  const victims = Z.game.debris.filter(d => d.orbitRadius === zRing0.radius).slice(0, 2);
  eq(victims.length, 2, "I: (setup) two ring-1 satellites selected for removal");
  victims.forEach(v => { v.dead = true; });
  Z.game.debris = Z.game.debris.filter(d => !d.dead);
  eq(Z.game.debris.length, zBefore - 2, `I: (setup) two ring-1 satellites removed, ${zBefore - 2} remain`);
  const ok2 = Z.rerollOrbitStartAngles();
  assert(ok2 === true, "I: reroll succeeds after a partial harvest");
  for (const d of Z.game.debris) {
    if (!d.orbitCenter) continue;
    close(Math.sqrt(Z.dist2(d, d.orbitCenter)), d.orbitRadius, "I: every SURVIVOR is still exactly on its ring after a post-harvest reroll", 1e-6);
  }
  const ring1Left = Z.game.debris.filter(d => d.orbitRadius === zRing0.radius).length;
  eq(ring1Left, zRing0.count - 2, `I: ring 1 still has its ${zRing0.count - 2} surviving members (${zRing0.count} - 2), none duplicated or dropped`);
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
  // REPOINTED BY CS022 P3: staged at a FULL-RAMP level. Level 3 lays ring 4 alone now (FORK-CS022-E), so
  // a slow ring and a fast one are simply not both on the board there. CS023 P1: which index is fast
  // moved too (ORBIT_FAST_RING is [2, 4] now), so both are resolved from the constant below.
  let kLvl = X.ORBIT_LEVEL_EVERY;
  while (kLvl <= 63 && X.activeRingsFor(kLvl).length < X.ORBIT_RING_COUNT) kLvl += X.ORBIT_LEVEL_EVERY;
  atWave(X, kLvl);
  X.game.state = "playing"; X.game.paused = false;   // update() early-returns off "playing" — same idiom as test-cs021-p1.js §E
  // REPOINTED BY CS023 P1 (spec C3): ORBIT_FAST_RING is a LIST now and rings 2/4 are the fast ones, so
  // index 2 — which CS022 P3 hardcoded as "the fast ring" — is a SLOW ring today. Both rings are resolved
  // from the constant instead, so a future change to the list carries this section with it. Keyed by
  // r.index rather than by array position, which happens to coincide again under the inverted ramp.
  const FAST_IDX = X.ORBIT_FAST_RING.map(n => n - 1);
  const ringByIdx = i => X.game.orbitLayout.rings.find(r => r.index === i);
  const slowIdx = [0, 1, 2, 3].find(i => FAST_IDX.indexOf(i) === -1);
  const ringSlow = ringByIdx(slowIdx);
  const ringFast = ringByIdx(FAST_IDX[0]);
  close(ringSlow.angVel, Math.PI / 6, `K: slow ring ${slowIdx + 1}'s angVel is the new base rate`);
  close(ringFast.angVel, (Math.PI / 6) * X.DEBUG.orbitFastMult, `K: fast ring ${FAST_IDX[0] + 1}'s angVel is base x the fast multiplier`);

  const d = X.game.debris.find(s => s.orbitRadius === ringSlow.radius);
  const a0 = d.orbitAngle;
  const DT = 1 / 60, FRAMES = 30;
  for (let i = 0; i < FRAMES; i++) X.update(DT);
  const survivor = X.game.debris.find(s => s.orbitRadius === ringSlow.radius && s.orbitAngVel === d.orbitAngVel);
  assert(!!survivor, `K: (control) a ring-${slowIdx + 1} satellite survived 30 frames untouched`);
  close(survivor.orbitAngle, a0 + (Math.PI / 6) * DT * FRAMES, "K: angle advanced by exactly the dialed rate x elapsed time", 1e-6);
})();

// ================= (L) regression touchstones =====================
(function sectionL() {
  console.log("(L) regression: default totals table unchanged, DEBUG_ROWS count, real spawn byte-identical to P1/P2");
  const X = build().exports;

  // REPOINTED BY CS021 P5 — mirror image, same reason as §A's TRAP 1 above.
  assert(X.GAME_VERSION !== "1.0.0.20", "L: GAME_VERSION off the pre-CS021 baseline");

  // REPOINTED BY CS022 P3: the touchstone table moves to the §4.7 figures — 40/45/45 was the CS021
  // geometry with every ring present at every occurrence. The three totals are the spec's own numbers
  // and are pinned as literals HERE on purpose (this section is the regression touchstone), while
  // test-cs022-p3.js §B derives the same table from the shipped helpers at every orbit level 3..63.
  // REPOINTED AGAIN BY CS023 P1: the touchstone table moves to spec §1.4's figures. Still literals, and
  // still on purpose — test-cs023-p1.js derives the same table from the shipped helpers at every orbit
  // level 3..63, so this section stays the blunt regression touchstone it was written to be.
  const n3  = atWave(X, 3);
  const n24 = atWave(X, 24);
  const n63 = atWave(X, 63);
  eq(n3, 8,  "L: level 3 (occurrence 1) spawns 8 at shipped defaults — one ring (3) plus 5 field");
  eq(n24, 21, "L: level 24 (the floor) spawns 21 — four rings (16) plus 5 field");
  eq(n63, 29, "L: level 63 spawns 29 — the peak (16 ring + 13 field)");

  const byRadius = {};
  for (const d of X.game.debris) if (d.orbitCenter) byRadius[d.orbitRadius] = (byRadius[d.orbitRadius] || 0) + 1;
  const radii = Object.keys(byRadius).map(Number).sort((a, b) => a - b);
  eq(radii.join(","), "400,538,676,814", "L: shipped default radii at level 63");
  eq(radii.map(r => byRadius[r]).join(","), "3,4,4,5", "L: shipped default per-ring counts at the floor");
  eq(X.game.debris.length - radii.reduce((n, r) => n + byRadius[r], 0), X.levelDef(63).fieldCount,
    "L: ...and the remainder is exactly levelDef(63).fieldCount");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
