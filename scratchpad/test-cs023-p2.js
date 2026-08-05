// Headless test for CS023 Phase 2 — THE BOUNCE PRIMITIVE AND THE SATELLITE<->SATELLITE PASS.
//
//   node scratchpad/test-cs023-p2.js
//
// WHAT LANDED (PLANNED-FEATURES-CS023 §1.2/§4.4/§4.5/§4.8, FORK-CS023-D). Three moving parts:
//
//   1. THREE CONSTANTS (§4.8). DEBRIS_MASS = {3:9, 2:3, 1:1} — mass CONSERVED through the 3-way split
//      the game already performs (a 9 becomes three 3s; a 3 becomes three 1s), which is where the ratio
//      comes from rather than from a fit. DEBRIS_BOUNCE_RESTITUTION 1.0, mirroring
//      SHIELD_BOUNCE_RESTITUTION. DEBRIS_BOUNCE_MIN 40 px/s, SHIELD_BOUNCE_MIN's separation floor
//      scaled to satellite speeds.
//   2. debrisBounce(a, b) (§4.4) — shieldBounce's SIBLING, placed immediately after it and DERIVED from
//      it. Three cases on rail state: free/free is a mass-weighted elastic exchange along the contact
//      normal; free/rail is shieldBounce's exact shape with the free body in the ship's role and the
//      rail body COMPLETELY untouched; rail/rail is a no-op (C11 — unreachable at the shipped geometry).
//   3. THE PASS (§4.5) — coalesceGarbage's pair-walk idiom over the LIVE game.debris array, placed after
//      the hazards-vs-chain scan and immediately before the end-of-frame dead-filter.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update(1/60)/destroyDebris/draw path. NOTHING
// under test is reimplemented. THE PHYSICS IS STATED AS PHYSICS, not as a transcription of the code:
// momentum, kinetic energy, Newton's restitution law, and "a body already separating is never yanked
// backwards" are properties an implementation either has or does not, and every assertion below is
// written in those terms rather than in terms of the impulse expression that produces them.
//
// Sections (spec §6 items 9, 10, 18, 19, 20):
//  (A) item 20 — node --check + source pins for the three constants, the helper, the pass, and the TRAPs
//  (B) item 9  — FREE vs FREE as physics, 60 incoming velocities per mass pair (nine ordered pairs)
//  (C) item 9  — FREE vs RAIL as physics, 60 incoming velocities per ring; shieldBounce's own shape
//  (D) item 10 — THE ASYMMETRY: twelve fields byte-identical, 300 real frames, never off its rail
//  (E) C11     — RING vs RING IS UNREACHABLE, swept exhaustively over the real geometry, not asserted
//                as a comment; plus the rail/rail branch proved to be a literal no-op
//  (F) item 9  — WRAP CORRECTNESS at the seam, with a naive non-wrap normal as a LIVE CONTROL that fails
//  (G) item 9  — the PASS itself through real update(1/60) frames; garbage canisters do NOT bounce
//  (H) item 18 — ⛔ FRAME-BUDGET GATE: two deterministic counters, both ceilings derived before measuring
//  (I) item 19 — determinism
//  (J) item 20 — AudioSys.ctx null smoke

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];
const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want}, |d| ${Math.abs(got - want).toExponential(2)})`); }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs023p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment (the standing stub idiom) ----
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
  "game", "startGame", "update", "draw", "nextWave", "destroyDebris", "killShip", "levelDef",
  "DebrisSatellite", "HunterSatellite", "Garbage", "Dock",
  // the CS023 P2 surface
  "debrisBounce", "DEBRIS_MASS", "DEBRIS_BOUNCE_RESTITUTION", "DEBRIS_BOUNCE_MIN",
  // its parent, for the derived-from-shieldBounce claims
  "shieldBounce", "SHIELD_BOUNCE_RESTITUTION", "SHIELD_BOUNCE_MIN", "SHIELD_RADIUS",
  // the orbit surface every rail-state expectation derives from
  "generateOrbitLayout", "activeRingsFor", "orbitEffectiveCount", "orbitRadiusStepFor",
  "orbitGapMult", "orbitEffectiveGapMult", "orbitTangent",
  "ORBIT_LEVEL_EVERY", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RING_COUNT",
  "ORBIT_DENSITY", "ORBIT_ANG_VEL", "ORBIT_FAST_MULT", "ORBIT_FAST_RING",
  // shared constants every expectation derives from — never a restated literal
  "DEBRIS_RADII", "DEBRIS_SPEEDS", "DEBRIS_SPEED_CAP", "SHIP_RADIUS", "SHIP_MAX_HP",
  "WORLD_W", "WORLD_H", "worldDims", "worldSizeFor", "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT",
  "TAU", "dist2", "angleTo", "shortDelta", "wrap", "wrapPos", "rand",
  "AudioSys", "GAME_VERSION", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES",
];

function buildFrom(src, { audio = true, extra = [], returns = RETURN } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const store = {};
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + returns.concat(extra).join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
function build(opts) { return buildFrom(scriptSrc, opts); }

// A deterministic LCG — every build and every real spawn runs inside one (spec §6 item 19). The starfield
// is laid down with Math.random() at MODULE LOAD, which is the one unpinned site in the whole file and is
// named here rather than left implicit.
function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}
const seededBuild = (seed, opts) => withRandom(seededRandom(seed), () => build(opts));

// Drive to absolute level `w` through the REAL nextWave(), clearing the field first so the post-call
// array is that level's ACTUAL spawn (the standing idiom in this suite).
function atWave(X, w) {
  X.game.wave = w - 1;
  X.game.debris.length = 0;
  X.nextWave();
  return X.game.debris.length;
}
// The first level at which the ramp has laid `want` rings. Derived from activeRingsFor(), never
// hardcoded — CS022 P3's own Known-issues idiom, and CS023 P1 inverted the ramp under it.
function levelWithRings(X, want) {
  let n = X.ORBIT_LEVEL_EVERY;
  while (X.activeRingsFor(n).length < want && n < 400) n += X.ORBIT_LEVEL_EVERY;
  return n;
}
const railBodies = X => X.game.debris.filter(d => !d.dead && d.orbitCenter);
const freeBodies = X => X.game.debris.filter(d => !d.dead && !d.orbitCenter);

// A bare free satellite at a chosen place and velocity. The constructor's own random drift is
// overwritten, exactly as spawnOrbitWave overwrites it with orbitSyncVelocity — this is staging, not a
// reimplementation of anything.
function freeSat(X, x, y, size, vx, vy) {
  const d = new X.DebrisSatellite(x, y, size, 1);
  d.x = x; d.y = y; d.vx = vx; d.vy = vy;
  return d;
}
// The twelve fields CS021 P1b §E pinned on a rail-borne hazard across a shieldBounce. Same twelve here,
// for the same reason and against the same claim: the rail is authoritative and NOTHING may write to it.
const TWELVE = ["x", "y", "vx", "vy", "angle", "spin", "orbitAngle", "orbitRadius", "orbitAngVel",
                "orbitCenter", "dead", "guardT"];
const snap12 = h => { const o = {}; for (const k of TWELVE) o[k] = h[k]; return o; };

// ================= (A, part 2) source pins (spec §6 item 20) =====================
(function sectionA() {
  const X = seededBuild(0xA001);

  // --- the three constants, declared once, at spec §4.8's values, grouped with the other DEBRIS_* ones
  eq((codeOnly.match(/^const DEBRIS_MASS = /gm) || []).length, 1, "A: DEBRIS_MASS declared exactly once");
  eq((codeOnly.match(/^const DEBRIS_BOUNCE_RESTITUTION = /gm) || []).length, 1, "A: DEBRIS_BOUNCE_RESTITUTION declared exactly once");
  eq((codeOnly.match(/^const DEBRIS_BOUNCE_MIN = /gm) || []).length, 1, "A: DEBRIS_BOUNCE_MIN declared exactly once");
  eq(JSON.stringify(X.DEBRIS_MASS), JSON.stringify({ 3: 9, 2: 3, 1: 1 }), "A: DEBRIS_MASS is FORK-CS023-D's 9/3/1");
  eq(X.DEBRIS_BOUNCE_RESTITUTION, 1.0, "A: DEBRIS_BOUNCE_RESTITUTION is 1.0");
  eq(X.DEBRIS_BOUNCE_MIN, 40, "A: DEBRIS_BOUNCE_MIN is 40 px/s");
  // ...and 1.0 is not a coincidence: it is SHIELD_BOUNCE_RESTITUTION's value, which is what "mirrors" means.
  eq(X.DEBRIS_BOUNCE_RESTITUTION, X.SHIELD_BOUNCE_RESTITUTION, "A: ...and it equals SHIELD_BOUNCE_RESTITUTION (§4.8 'mirrors')");
  assert(X.DEBRIS_BOUNCE_MIN < X.SHIELD_BOUNCE_MIN, "A: the satellite floor is BELOW the ship's (40 vs 120) — satellites are slower");
  // MASS IS CONSERVED THROUGH THE SPLIT, asserted as arithmetic rather than restated as prose. The game
  // splits one body into THREE of the next size down, at every tier.
  eq(X.DEBRIS_MASS[3], 3 * X.DEBRIS_MASS[2], "A: FORK-D — a large's mass IS its three mediums'");
  eq(X.DEBRIS_MASS[2], 3 * X.DEBRIS_MASS[1], "A: FORK-D — a medium's mass IS its three smalls'");
  {
    // ...and the split really is 3-way, read out of destroyDebris's own body rather than assumed.
    const i0 = codeOnly.indexOf("function destroyDebris(a, awardScore = true) {");
    const dd = codeOnly.slice(i0, codeOnly.indexOf("\n}\n", i0));
    eq((dd.match(/for \(let i = 0; i < 3; i\+\+\) \{/g) || []).length, 1,
      "A: ...and destroyDebris really splits 3-way, at exactly one site inside its own body");
  }
  // Grouped with the other DEBRIS_* tuning constants, by source ORDER — not floated to the bottom of the block.
  const iGarbage = codeOnly.indexOf("const DEBRIS_GARBAGE");
  const iMass = codeOnly.indexOf("const DEBRIS_MASS");
  const iSaucer = codeOnly.indexOf("const SAUCER_SCORE");
  assert(iGarbage < iMass && iMass < iSaucer, "A: the three new constants sit INSIDE the DEBRIS_* block, before SAUCER_SCORE");
  assert(codeOnly.indexOf("const DEBRIS_BOUNCE_MIN") < iSaucer, "A: ...all three of them");
  // No inline magic numbers: the values appear in debrisBounce only through their names.
  const fnStart = codeOnly.indexOf("function debrisBounce(a, b) {");
  const fnBody = codeOnly.slice(fnStart, codeOnly.indexOf("\n}\n", fnStart));
  assert(fnStart > 0, "A: debrisBounce is present");
  assert(!/\b(1\.0|40)\b/.test(fnBody.replace(/DEBRIS_BOUNCE_(RESTITUTION|MIN)/g, "")),
    "A: neither 1.0 nor 40 is inlined anywhere in debrisBounce — the constants are read by name");

  // --- the helper: exactly one definition, and IMMEDIATELY AFTER shieldBounce (spec §4.4)
  eq((codeOnly.match(/function debrisBounce\(/g) || []).length, 1, "A: exactly one debrisBounce definition");
  const iShield = codeOnly.indexOf("function shieldBounce(obj) {");
  const iShieldEnd = codeOnly.indexOf("\n}\n", iShield);
  assert(iShield > 0 && iShieldEnd < fnStart, "A: debrisBounce is placed AFTER shieldBounce");
  assert(codeOnly.slice(iShieldEnd, fnStart).trim() === "}", "A: ...and IMMEDIATELY after it — nothing between the two");
  // shieldBounce itself is BYTE-UNCHANGED. This phase derives from it; it does not edit it.
  const preSrc = execFileSync("git", ["show", "HEAD:asteroids-deluxe.html"], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
    .toString().match(/<script>([\s\S]*?)<\/script>/)[1];
  const bodyOf = (src, sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf("\n}\n", i)); };
  eq(bodyOf(scriptSrc, "function shieldBounce(obj) {"), bodyOf(preSrc, "function shieldBounce(obj) {"),
    "A: shieldBounce is BYTE-UNCHANGED — derived from, not edited");
  eq(bodyOf(scriptSrc, "function shieldDeflect(obj) {"), bodyOf(preSrc, "function shieldDeflect(obj) {"),
    "A: ...and so is shieldDeflect");
  // TRAP 2: coalesceGarbage and the Garbage class are out of scope entirely.
  eq(bodyOf(scriptSrc, "function coalesceGarbage(dt) {"), bodyOf(preSrc, "function coalesceGarbage(dt) {"),
    "A: TRAP 2 — coalesceGarbage is BYTE-UNCHANGED; canisters do not bounce");
  eq(bodyOf(scriptSrc, "class Garbage {"), bodyOf(preSrc, "class Garbage {"),
    "A: TRAP 2 — the Garbage class is BYTE-UNCHANGED");
  eq(bodyOf(scriptSrc, "function destroyDebris(a, awardScore = true) {"), bodyOf(preSrc, "function destroyDebris(a, awardScore = true) {"),
    "A: destroyDebris is BYTE-UNCHANGED — this phase creates and destroys nothing");

  // --- wrap-awareness, asserted at the SITE rather than trusted (CLAUDE.md's single commonest bug source)
  assert(/angleTo\(r, f\)/.test(fnBody), "A: the free/rail normal comes from angleTo (wrap-aware)");
  assert(/angleTo\(b, a\)/.test(fnBody), "A: the free/free normal comes from angleTo (wrap-aware)");
  assert(/Math\.sqrt\(dist2\(a, b\)\)/.test(fnBody), "A: the overlap depth comes from dist2 (wrap-aware)");
  eq((fnBody.match(/\bwrap\(/g) || []).length, 3, "A: wrap() is called after every positional push (free/rail 1, free/free 2)");
  assert(!/Math\.hypot\(\s*[ab]\.x/.test(fnBody) && !/Math\.atan2\(\s*b\.y\s*-/.test(fnBody),
    "A: no naive Math.hypot/Math.atan2 over raw coordinate differences anywhere in the helper");

  // --- the rail gate is `orbitCenter`, the SAME field the motion mode and shieldBounce already use
  assert(/const aRail = !!a\.orbitCenter, bRail = !!b\.orbitCenter;/.test(fnBody),
    "A: rail state is read off orbitCenter — one concept, not two (the CS021 P1b rule)");
  assert(/if \(aRail && bRail\) return;/.test(fnBody), "A: rail/rail is an explicit early no-op (C11)");
  assert(/if \(a\.orbitCenter\)/.test(bodyOf(scriptSrc, "  update(dt) {\n    // CS021 P1: ORBIT MOTION MODE")) ||
         /this\.orbitCenter/.test(codeOnly), "A: ...and it is the same field DebrisSatellite.update() gates its motion mode on");

  // --- the pass: one site, the coalesceGarbage idiom, the LIVE array, correctly placed
  eq((codeOnly.match(/if \(dist2\(a, b\) < r \* r\) debrisBounce\(a, b\);/g) || []).length, 1,
    "A: exactly one debrisBounce call site");
  assert(/for \(let i = 0; i < game\.debris\.length; i\+\+\) \{\n\s+const a = game\.debris\[i\];/.test(codeOnly),
    "A: the pass walks the LIVE game.debris array by index — not a spread copy");
  assert(/for \(let j = i \+ 1; j < game\.debris\.length; j\+\+\) \{/.test(codeOnly),
    "A: ...with j = i + 1, so every unordered pair is visited exactly once (coalesceGarbage's idiom)");
  assert(!/\[\.\.\.game\.debris\][\s\S]{0,400}debrisBounce/.test(codeOnly),
    "A: the pass does NOT take a spread copy — nothing is created or destroyed here");
  {
    const iChainScan = codeOnly.indexOf("chainScan:");
    const iPass = codeOnly.indexOf("if (dist2(a, b) < r * r) debrisBounce(a, b);");
    const iCleanup = codeOnly.indexOf("const hadSaucer = game.saucers.length > 0;");
    const iDebrisUpdate = codeOnly.indexOf("game.debris.forEach(");
    assert(iDebrisUpdate > 0 && iDebrisUpdate < iPass, "A: the pass runs AFTER every debris has had its update(dt) (§4.5)");
    assert(iChainScan > 0 && iChainScan < iPass, "A: the pass runs after the hazards-vs-chain scan");
    assert(iPass < iCleanup, "A: ...and before the end-of-frame dead-filter");
    // Nothing but comments between the pass and Cleanup — "immediately before" is the spec's word.
    const between = codeOnly.slice(codeOnly.indexOf("\n", iPass), iCleanup);
    assert(between.replace(/[}\s]/g, "") === "", "A: ...IMMEDIATELY before it — only the loop's closing braces in between");
  }
  // Both sides' dead flags are checked explicitly, because the pass runs BEFORE the filter.
  assert(/const a = game\.debris\[i\];\n\s+if \(a\.dead\) continue;/.test(codeOnly), "A: the outer body's dead flag is checked");
  assert(/const b = game\.debris\[j\];\n\s+if \(b\.dead\) continue;/.test(codeOnly), "A: the inner body's dead flag is checked");

  // --- TRAP 3: no ship path, no saucer path, no damage. This phase is physics only.
  for (const forbidden of ["damageShip", "destroySaucer", "destroyHunter", "destroyDebris", "addScore",
                           "game.ship", "game.stats", "AudioSys", "boom(", "dropPowerup"]) {
    assert(!fnBody.includes(forbidden), `A: TRAP 3 — debrisBounce contains no reference to ${forbidden}`);
  }
  {
    // ...and neither does the pass. Sliced from the pass's own banner to its closing brace.
    const iBanner = codeOnly.indexOf("  for (let i = 0; i < game.debris.length; i++) {");
    const passSrc = codeOnly.slice(iBanner, codeOnly.indexOf("const hadSaucer", iBanner));
    for (const forbidden of ["damageShip", "destroySaucer", "destroyHunter", "destroyDebris",
                             "game.ship", "game.saucers", "game.hunters", "game.garbage", "game.chain"]) {
      assert(!passSrc.includes(forbidden), `A: TRAP 3 — the pass contains no reference to ${forbidden}`);
    }
  }
  // The hazards-vs-ship block is byte-unchanged: P3 owns the mutual-damage rule, not this phase.
  {
    const sliceOf = src => { const i = src.indexOf("  // --- Collisions: hazards vs ship ---");
                             return src.slice(i, src.indexOf("  // --- Hazards vs tow chain", i)); };
    eq(sliceOf(scriptSrc), sliceOf(preSrc), "A: TRAP 3 — the hazards-vs-ship block is BYTE-UNCHANGED (P3 owns it)");
  }

  // --- TRAP 1 / TRAP 4
  eq(X.GAME_VERSION, "1.0.0.22", "A: TRAP 1 — GAME_VERSION unchanged (P5 bumps it)");
  eq(X.DEBUG_ENTRIES.length, 44, "A: TRAP 4 — the debug registry is still 44 value entries");
  assert(!X.DEBUG_ENTRIES.some(e => /bounce|restitution|gravity|drift|mass/i.test(e.id)),
    "A: TRAP 4 — debrisBounceRestitution is P4's knob and has not crept in early");
  assert(!/\bdrifting\b/.test(codeOnly), "A: TRAP — the P4 `drifting` field is not stubbed (spec: leave the seam, not a stub)");
  assert(!/ORBIT_GRAVITY/.test(codeOnly), "A: TRAP — no ORBIT_GRAVITY_* constants yet (P4)");
  assert(!/maxOrbitSpeed/.test(codeOnly), "A: TRAP — no maxOrbitSpeed helper yet (P4)");
  assert(!/function destroySaucer\(s, awardScore/.test(codeOnly), "A: TRAP — destroySaucer has not gained its parameter yet (P3)");
  // The P4 SEAM is a documented comment, not code — assert both halves of that.
  assert(/CS023 P4 SEAM/.test(scriptSrc), "A: the P4 seam is named in a comment at the top of debrisBounce");
  assert(scriptSrc.indexOf("CS023 P4 SEAM") > scriptSrc.indexOf("function debrisBounce(a, b) {"),
    "A: ...inside the helper, where the one-line clear drops in");
  assert(/drifting/.test(scriptSrc), "A: ...and it names the field P4 will clear");

  // --- the docs are untouched this phase (TRAP 1's second half)
  const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot }).toString().trim().split("\n").filter(Boolean);
  const docs = changed.filter(f => /GDD|DIFFICULTY-LEVERS|VERSION-HISTORY|PLANNED-FEATURES|IMPLEMENTATION-PHASES/.test(f));
  eq(docs.length, 0, `A: TRAP 1 — no design doc is touched this phase (saw ${JSON.stringify(docs)})`);
})();

// ================= (B) spec §6 item 9 — FREE vs FREE, AS PHYSICS =====================
//
// Every claim below is a property of an elastic collision, not a transcription of the impulse
// expression that produces it:
//   * MOMENTUM. The pair's total m*v is unchanged, at the DEBRIS_MASS ratios. This must hold even when
//     the separation floor fires, which is why the floor is an equal-and-opposite impulse pair rather
//     than a per-body world-frame shove.
//   * KINETIC ENERGY. At restitution 1.0 the pair's total (1/2)m|v|^2 is unchanged; below 1.0 it
//     strictly decreases. Checked in the cases where the floor does not fire, because the floor exists
//     precisely to ADD the energy needed to end a contact — a sandbox build at restitution 0.5 carries
//     the second half.
//   * NEWTON'S RESTITUTION LAW. The separation speed along the contact normal comes back as exactly
//     `restitution x approach speed` — or the floor, whichever is larger.
//   * TANGENTIAL MOTION IS UNTOUCHED. All impulses are along the normal, so the component of each body's
//     velocity perpendicular to the contact normal is EXACTLY (===) what it was.
//   * A SEPARATING BODY IS NEVER REVERSED. A pair already moving apart faster than the floor comes out
//     byte-identical; a pair moving apart slower is sped up, never slowed and never turned around.
//   * SEPARATION IS ACHIEVED WITHIN ONE FRAME. After the call the two bodies are no longer overlapping
//     at all, and they are moving apart at >= the floor, so the contact cannot re-present.
(function sectionB() { withRandom(seededRandom(0xB0B0), () => {
  console.log("(B) spec §6 item 9 — FREE vs FREE elastic exchange, as physics");
  const X = seededBuild(0xB001);
  X.startGame();
  const R = X.DEBRIS_BOUNCE_RESTITUTION, MIN = X.DEBRIS_BOUNCE_MIN;
  const TRIALS = 60;   // ">= 40 incoming velocities per case"

  let nApproach = 0, nSeparate = 0, nFloor = 0, nNoFloor = 0, nUntouched = 0;
  let worstP = 0, worstE = 0, worstTangent = 0;

  for (const sa of [3, 2, 1]) for (const sb of [3, 2, 1]) {
    const ma = X.DEBRIS_MASS[sa], mb = X.DEBRIS_MASS[sb];
    const rnd = seededRandom(0xB000 + sa * 16 + sb);
    for (let k = 0; k < TRIALS; k++) {
      const contactAng = rnd() * X.TAU;
      const ra = X.DEBRIS_RADII[sa], rb = X.DEBRIS_RADII[sb];
      const gap = (ra + rb) * (0.20 + 0.75 * rnd());          // overlapping, at every depth
      const ax = 1200, ay = 700;
      const a = freeSat(X, ax, ay, sa, (rnd() - 0.5) * 500, (rnd() - 0.5) * 500);
      const b = freeSat(X, ax + Math.cos(contactAng) * gap, ay + Math.sin(contactAng) * gap, sb,
                        (rnd() - 0.5) * 500, (rnd() - 0.5) * 500);
      eq(a.orbitCenter, undefined, "B: (setup) `a` carries no orbit state");
      eq(b.orbitCenter, undefined, "B: (setup) `b` carries no orbit state");

      // The contact normal, measured the way the world measures it (wrap-aware, b -> a).
      const nAng = X.angleTo(b, a), nx = Math.cos(nAng), ny = Math.sin(nAng);
      const tx = -ny, ty = nx;                                  // the tangent
      const p0 = [ma * a.vx + mb * b.vx, ma * a.vy + mb * b.vy];
      const e0 = 0.5 * ma * (a.vx * a.vx + a.vy * a.vy) + 0.5 * mb * (b.vx * b.vx + b.vy * b.vy);
      const un0 = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;      // relative normal speed; < 0 is approaching
      const at0 = a.vx * tx + a.vy * ty, bt0 = b.vx * tx + b.vy * ty;
      const va0 = [a.vx, a.vy], vb0 = [b.vx, b.vy];

      X.debrisBounce(a, b);

      // MOMENTUM — always, floor or no floor.
      const p1 = [ma * a.vx + mb * b.vx, ma * a.vy + mb * b.vy];
      worstP = Math.max(worstP, Math.abs(p1[0] - p0[0]), Math.abs(p1[1] - p0[1]));
      close(p1[0], p0[0], `B: momentum x conserved (${sa} vs ${sb})`, 1e-6);
      close(p1[1], p0[1], `B: momentum y conserved (${sa} vs ${sb})`, 1e-6);

      // TANGENTIAL MOTION — exactly untouched, for both bodies.
      const at1 = a.vx * tx + a.vy * ty, bt1 = b.vx * tx + b.vy * ty;
      worstTangent = Math.max(worstTangent, Math.abs(at1 - at0), Math.abs(bt1 - bt0));
      close(at1, at0, `B: a's tangential velocity is untouched (${sa} vs ${sb})`, 1e-9);
      close(bt1, bt0, `B: b's tangential velocity is untouched (${sa} vs ${sb})`, 1e-9);

      // NEWTON'S RESTITUTION LAW, or the floor — whichever is larger.
      const un1 = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      const lawful = un0 < 0 ? -R * un0 : un0;                  // physics, not the code's expression
      const wantSep = Math.max(lawful, MIN);
      close(un1, wantSep, `B: separation speed is max(restitution x approach, floor) (${sa} vs ${sb})`, 1e-9);
      assert(un1 >= MIN - 1e-9, `B: every bounce leaves the pair separating at >= the floor (${sa} vs ${sb})`);
      if (un0 < 0) nApproach++; else nSeparate++;
      if (wantSep > lawful + 1e-9) nFloor++; else nNoFloor++;

      // KINETIC ENERGY — conserved at restitution 1.0, in every case the floor did not have to pay for.
      const e1 = 0.5 * ma * (a.vx * a.vx + a.vy * a.vy) + 0.5 * mb * (b.vx * b.vx + b.vy * b.vy);
      if (wantSep <= lawful + 1e-9) {
        worstE = Math.max(worstE, Math.abs(e1 - e0));
        close(e1, e0, `B: kinetic energy conserved at restitution 1.0 (${sa} vs ${sb})`, 1e-6);
      } else {
        assert(e1 > e0 - 1e-9, `B: the floor only ever ADDS energy — it is what ends the contact (${sa} vs ${sb})`);
      }

      // A SEPARATING BODY IS NEVER REVERSED.
      assert(un1 >= un0 - 1e-9, `B: a pair already separating is never slowed or turned around (${sa} vs ${sb})`);
      if (un0 >= MIN) {
        nUntouched++;
        eq(a.vx, va0[0], `B: a pair separating faster than the floor is left EXACTLY alone — a.vx (${sa} vs ${sb})`);
        eq(a.vy, va0[1], `B: ...a.vy`);
        eq(b.vx, vb0[0], `B: ...b.vx`);
        eq(b.vy, vb0[1], `B: ...b.vy`);
      }

      // SEPARATION ACHIEVED WITHIN ONE FRAME — geometrically, this instant.
      const dAfter = Math.sqrt(X.dist2(a, b));
      assert(dAfter >= a.radius + b.radius, `B: the pair is no longer overlapping after the bounce (${sa} vs ${sb})`);
      close(dAfter, a.radius + b.radius + 2, `B: ...and is separated by shieldBounce's own 2 px epsilon (${sa} vs ${sb})`, 1e-6);

      // THE OVERLAP PUSH IS MASS-WEIGHTED, and exactly so: the two displacements are in INVERSE
      // proportion to the masses, i.e. ma x moveA === mb x moveB. That is the positional statement of
      // the same 9:1 ratio the impulse uses, and it is what makes a small ricochet off a large rather
      // than shove it. Asserted as the identity, not as an inequality — an inequality with any slack in
      // it is satisfied by an even 50/50 split.
      const moveA = Math.hypot(...X.shortDelta(ax, ay, a.x, a.y));
      const moveB = Math.hypot(...X.shortDelta(ax + Math.cos(contactAng) * gap, ay + Math.sin(contactAng) * gap, b.x, b.y));
      assert(moveA > 0 && moveB > 0, `B: (setup) both bodies really were pushed (${sa} vs ${sb})`);
      close(ma * moveA, mb * moveB, `B: the overlap push is split in INVERSE proportion to mass (${sa} vs ${sb})`, 1e-6);
      if (ma > mb) assert(moveA < moveB - 1e-6, `B: ...so the heavier body (size ${sa}) genuinely moved LESS than the lighter (size ${sb})`);
      if (ma === mb) close(moveA, moveB, `B: ...and equal masses share it equally (${sa} vs ${sb})`, 1e-9);
    }
  }

  // CONTROLS — every path was genuinely exercised, so none of the above passed vacuously.
  assert(nApproach > 50, `B: (control) the reflection path ran (${nApproach} approaching trials)`);
  assert(nSeparate > 50, `B: (control) the already-separating path ran (${nSeparate} trials)`);
  assert(nFloor > 20, `B: (control) the separation floor genuinely bound on ${nFloor} trials`);
  assert(nNoFloor > 20, `B: (control) ...and genuinely did not on ${nNoFloor}`);
  assert(nUntouched > 20, `B: (control) ${nUntouched} trials were left byte-identical (already separating fast)`);
  console.log(`    540 trials: worst momentum drift ${worstP.toExponential(2)}, worst energy drift ${worstE.toExponential(2)}, ` +
              `worst tangential drift ${worstTangent.toExponential(2)} px/s`);
  console.log(`    paths exercised — approaching ${nApproach}, separating ${nSeparate}, floor bound ${nFloor}, floor idle ${nNoFloor}`);

  // ---- THE SIZE ORDERING, STATED WITHOUT READING DEBRIS_MASS AT ALL.
  // FORK-CS023-D's sentence is "a small ricochets off a large rather than shoving it", and that is a
  // claim about SIZE. Every assertion above reads the mass table to build its expectation, so all of
  // them would still pass with the table inverted; these do not read it at all, and they are what fails
  // if 9/3/1 ever becomes 1/3/9. Head-on, along +x, into a stationary partner — the textbook case.
  {
    const U = 300;
    for (const [light, heavy] of [[1, 3], [1, 2], [2, 3]]) {
      const rl = X.DEBRIS_RADII[light], rh = X.DEBRIS_RADII[heavy];
      const a = freeSat(X, 1200, 700, light, U, 0);
      const b = freeSat(X, 1200 + (rl + rh) * 0.9, 700, heavy, 0, 0);
      X.debrisBounce(a, b);
      assert(a.vx < 0, `B: a size-${light} driven into a stationary size-${heavy} REVERSES (got ${a.vx.toFixed(1)} px/s)`);
      assert(b.vx > 0, `B: ...and pushes the size-${heavy} forward (got ${b.vx.toFixed(1)} px/s)`);
      assert(Math.abs(b.vx) <= Math.abs(a.vx) + 1e-9,
        `B: ...and never leaves the heavier body faster than the lighter one bounced back ` +
        `(${Math.abs(b.vx).toFixed(1)} vs ${Math.abs(a.vx).toFixed(1)})`);
      assert(b.vx < U, `B: ...nor faster than the light body arrived — it was shoved, not launched`);
      // A tie is EXPECTED between ADJACENT tiers and is a property of the game's own split, not a
      // coincidence: an elastic head-on gives |v_light| = u(M-m)/(M+m) and v_heavy = 2mu/(M+m), which are
      // equal exactly when M = 3m — and the 3-way split makes every adjacent tier exactly 3x. Two tiers
      // apart (1 against 3, the 9:1 pair) the inequality is strict, and that is asserted separately.
      if (heavy - light === 2) assert(Math.abs(b.vx) < Math.abs(a.vx) - 1,
        `B: ...and across TWO tiers (size 1 against size 3, 9:1) the heavier really does end slower ` +
        `(${Math.abs(b.vx).toFixed(1)} < ${Math.abs(a.vx).toFixed(1)})`);
    }
    // EQUAL MASSES: the classic swap. The mover stops dead and the stationary one takes the whole speed.
    for (const s of [1, 2, 3]) {
      const r = X.DEBRIS_RADII[s];
      const a = freeSat(X, 1200, 700, s, U, 0);
      const b = freeSat(X, 1200 + 2 * r * 0.9, 700, s, 0, 0);
      X.debrisBounce(a, b);
      close(a.vx, 0, `B: two size-${s} bodies swap normal velocities exactly — the mover stops dead`, 1e-9);
      close(b.vx, U, `B: ...and the stationary one leaves at the whole ${U} px/s`, 1e-9);
    }
  }

  // ---- THE OTHER HALF OF THE ENERGY CLAIM: a SANDBOX build at restitution 0.5.
  // DEBRIS_BOUNCE_RESTITUTION has no debug knob this phase (TRAP 4 — it is P4's), so "strictly
  // decreasing below 1.0" is checked against a build whose constant is edited, exactly as CS023 P1 §D
  // exercised fast-ring lists it does not ship. The edit is one literal and is named here.
  const LOSSY_SRC = scriptSrc.replace("const DEBRIS_BOUNCE_RESTITUTION = 1.0;", "const DEBRIS_BOUNCE_RESTITUTION = 0.5;");
  assert(LOSSY_SRC !== scriptSrc, "B: (sandbox) the restitution literal was found and replaced");
  const L = withRandom(seededRandom(0xB999), () => buildFrom(LOSSY_SRC));
  L.startGame();
  eq(L.DEBRIS_BOUNCE_RESTITUTION, 0.5, "B: (sandbox) the sandbox build really runs at restitution 0.5");
  let nLossy = 0, worstGain = -Infinity;
  for (const sa of [3, 2, 1]) for (const sb of [3, 2, 1]) {
    const ma = L.DEBRIS_MASS[sa], mb = L.DEBRIS_MASS[sb];
    const rnd = seededRandom(0xB500 + sa * 16 + sb);
    for (let k = 0; k < TRIALS; k++) {
      const contactAng = rnd() * L.TAU;
      const gap = (L.DEBRIS_RADII[sa] + L.DEBRIS_RADII[sb]) * (0.2 + 0.75 * rnd());
      // Drive them HARD together so the reflection dominates and the floor cannot bind.
      const a = freeSat(L, 1200, 700, sa, Math.cos(contactAng) * 400, Math.sin(contactAng) * 400);
      const b = freeSat(L, 1200 + Math.cos(contactAng) * gap, 700 + Math.sin(contactAng) * gap, sb,
                        -Math.cos(contactAng) * 400, -Math.sin(contactAng) * 400);
      const nAng = L.angleTo(b, a), nx = Math.cos(nAng), ny = Math.sin(nAng);
      const un0 = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      const e0 = 0.5 * ma * (a.vx * a.vx + a.vy * a.vy) + 0.5 * mb * (b.vx * b.vx + b.vy * b.vy);
      const p0m = [ma * a.vx + mb * b.vx, ma * a.vy + mb * b.vy];
      L.debrisBounce(a, b);
      const un1 = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      const e1 = 0.5 * ma * (a.vx * a.vx + a.vy * a.vy) + 0.5 * mb * (b.vx * b.vx + b.vy * b.vy);
      if (un0 < -1e-6 && un1 > L.DEBRIS_BOUNCE_MIN + 1e-6) {   // reflection dominated, floor idle
        nLossy++;
        assert(e1 < e0, `B: (sandbox) kinetic energy STRICTLY decreases below restitution 1.0 (${sa} vs ${sb})`);
        // ...and by exactly the amount the restitution law predicts: (1 - e^2) x the reduced-mass
        // kinetic energy of the approach. Pure physics.
        const mu = 1 / (1 / ma + 1 / mb);
        close(e0 - e1, (1 - 0.25) * 0.5 * mu * un0 * un0,
          `B: (sandbox) ...by exactly (1 - e^2) x the approach's reduced-mass KE (${sa} vs ${sb})`, 1e-6);
        worstGain = Math.max(worstGain, e1 - e0);
      }
      // Momentum survives a lossy collision too — the restitution changes the energy, never the momentum.
      close(ma * a.vx + mb * b.vx, p0m[0], `B: (sandbox) momentum x is conserved at restitution 0.5 (${sa} vs ${sb})`, 1e-6);
      close(ma * a.vy + mb * b.vy, p0m[1], `B: (sandbox) momentum y is conserved at restitution 0.5 (${sa} vs ${sb})`, 1e-6);
    }
  }
  assert(nLossy > 200, `B: (sandbox control) ${nLossy} genuinely-lossy collisions were measured`);
  console.log(`    sandbox at restitution 0.5: ${nLossy} lossy collisions, worst energy CHANGE ${worstGain.toExponential(2)} (must be < 0)`);
}); })();

// ================= (C) spec §6 item 9 — FREE vs RAIL-BORNE, AS PHYSICS =====================
//
// This branch is shieldBounce's exact shape with the free body in the ship's role, so it inherits
// shieldBounce's own physics rather than the free/free case's:
//   * THE RAIL IS AN INFINITE-MASS CONSTRAINT. Momentum is deliberately NOT conserved — asserted in
//     that direction, with a control, so nobody later "fixes" it into a symmetric exchange.
//   * The reflection happens IN THE RAIL BODY'S FRAME, which is what makes a fast ring feel different
//     from a slow one: subtract the rail body's velocity, reflect the approaching part, add it back.
//   * The classic result against an immovable partner: a rail satellite sweeping into a STATIONARY free
//     body throws it at exactly TWICE the satellite's own speed (CS021 P1b measured the same thing for
//     the ship, 2 x 150.8 = 301.6 px/s off the fast ring).
//   * The free body ends exactly `rail.radius + free.radius + 2` away, on the side it came from.
(function sectionC() { withRandom(seededRandom(0xC0C0), () => {
  console.log("(C) spec §6 item 9 — FREE vs RAIL-BORNE: shieldBounce's shape, the rail immovable");
  const X = seededBuild(0xC001);
  X.startGame();
  const FULL = levelWithRings(X, X.ORBIT_RING_COUNT);
  atWave(X, FULL);
  const rails = railBodies(X);
  eq(rails.length > 0, true, "C: (setup) a full-ramp orbit level laid rail-borne satellites");
  const byRing = [...new Set(rails.map(r => r.orbitRadius))].sort((p, q) => p - q);
  eq(byRing.length, X.ORBIT_RING_COUNT, "C: (setup) all four rings are on the board");
  const R = X.DEBRIS_BOUNCE_RESTITUTION, MIN = X.DEBRIS_BOUNCE_MIN;
  const TRIALS = 60;

  let nApproach = 0, nRecede = 0, nFloor = 0, nMomentumBroken = 0;
  for (const radius of byRing) {
    const proto = rails.find(r => r.orbitRadius === radius);
    for (const freeSize of [3, 1]) {
      const rnd = seededRandom(0xC000 + radius + freeSize);
      for (let k = 0; k < TRIALS / 2; k++) {
        // A fresh rail body each trial, carrying the REAL ring's state (radius, angle, angular velocity).
        const r = freeSat(X, proto.x, proto.y, 3, 0, 0);
        r.orbitCenter = proto.orbitCenter; r.orbitRadius = proto.orbitRadius;
        r.orbitAngle = rnd() * X.TAU; r.orbitAngVel = proto.orbitAngVel;
        const p = X.wrapPos({ x: r.orbitCenter.x + Math.cos(r.orbitAngle) * r.orbitRadius,
                              y: r.orbitCenter.y + Math.sin(r.orbitAngle) * r.orbitRadius });
        r.x = p.x; r.y = p.y;
        const t = X.orbitTangent(r); r.vx = t[0]; r.vy = t[1];

        const contactAng = rnd() * X.TAU;
        const gap = (r.radius + X.DEBRIS_RADII[freeSize]) * (0.2 + 0.75 * rnd());
        const fp = X.wrapPos({ x: r.x + Math.cos(contactAng) * gap, y: r.y + Math.sin(contactAng) * gap });
        const f = freeSat(X, fp.x, fp.y, freeSize, (rnd() - 0.5) * 500, (rnd() - 0.5) * 500);

        const nAng = X.angleTo(r, f), nx = Math.cos(nAng), ny = Math.sin(nAng);
        const tx = -ny, ty = nx;
        const un0 = (f.vx - r.vx) * nx + (f.vy - r.vy) * ny;   // approach speed IN THE RAIL BODY'S FRAME
        const ft0 = f.vx * tx + f.vy * ty;
        const railBefore = snap12(r);
        const mf = X.DEBRIS_MASS[freeSize], mr = X.DEBRIS_MASS[3];
        const p0 = [mf * f.vx + mr * r.vx, mf * f.vy + mr * r.vy];

        // BOTH ARGUMENT ORDERS must behave identically — the pass hands over whichever came first in
        // the array, and rail state is a property of the bodies, not of the call.
        const fSwap = freeSat(X, f.x, f.y, freeSize, f.vx, f.vy);
        X.debrisBounce(f, r);
        X.debrisBounce(r, fSwap);
        for (const key of ["x", "y", "vx", "vy"]) eq(fSwap[key], f[key], `C: debrisBounce(rail, free) === debrisBounce(free, rail) — ${key}`);

        // THE RAIL BODY IS COMPLETELY UNTOUCHED.
        for (const key of TWELVE) eq(r[key], railBefore[key], `C: the bounce left rail.${key} byte-identical (r=${radius})`);

        // Tangential motion of the free body is exactly preserved.
        close(f.vx * tx + f.vy * ty, ft0, `C: the free body's tangential velocity is untouched (r=${radius})`, 1e-9);

        // NEWTON'S RESTITUTION LAW, in the rail body's frame — or the world-frame floor, shieldBounce's own.
        const un1 = (f.vx - r.vx) * nx + (f.vy - r.vy) * ny;
        const lawful = un0 < 0 ? -R * un0 : un0;
        const outward = f.vx * nx + f.vy * ny;
        assert(outward >= MIN - 1e-9, `C: every bounce leaves the free body's OUTWARD world speed >= the floor (r=${radius})`);
        if (outward > MIN + 1e-9) {
          close(un1, lawful, `C: ...and where the floor is idle, the rail-frame separation obeys the restitution law (r=${radius})`, 1e-9);
        } else nFloor++;
        if (un0 < 0) nApproach++; else {
          nRecede++;
          // A body already receding is never yanked backwards: its rail-frame normal component can only
          // have grown (the floor), never shrunk or flipped.
          assert(un1 >= un0 - 1e-9, `C: a receding free body is never pulled back (r=${radius})`);
        }

        // SEPARATION, this instant, at shieldBounce's own epsilon and on the side it came from.
        close(Math.sqrt(X.dist2(f, r)), r.radius + f.radius + 2, `C: the free body is pushed to contact + 2 px (r=${radius})`, 1e-6);
        const outAng = X.angleTo(r, f);
        close(Math.cos(outAng - nAng), 1, `C: ...on the SAME side it approached from, not through the body (r=${radius})`, 1e-9);

        // MOMENTUM IS DELIBERATELY NOT CONSERVED — the rail is an infinite-mass constraint (C11/§4.4).
        const p1 = [mf * f.vx + mr * r.vx, mf * f.vy + mr * r.vy];
        if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 1e-6) nMomentumBroken++;
      }
    }
  }
  assert(nApproach > 100, `C: (control) the reflection path ran (${nApproach} approaching trials)`);
  assert(nRecede > 50, `C: (control) the already-receding path ran (${nRecede} trials)`);
  assert(nFloor > 10, `C: (control) the separation floor genuinely bound on ${nFloor} trials`);
  // 480 trials in all (4 rings x 2 free sizes x 30). Momentum breaks on every trial where the free body
  // was genuinely acted on, which is what an infinite-mass constraint MEANS: the rail body absorbs the
  // reaction and does not move. Stated as an assertion rather than a comment so nobody later "fixes" it.
  assert(nMomentumBroken > 100,
    `C: momentum is DELIBERATELY not conserved against a rail — it broke on ${nMomentumBroken} of 480 trials, which is the ` +
    `infinite-mass constraint working, not a defect. Do not "fix" this into a symmetric exchange.`);
  assert(nMomentumBroken >= nApproach / 2,
    `C: ...and it broke on essentially every trial where the free body was actually deflected`);

  // THE FLAVOUR RESULT, measured: a rail satellite sweeping into a STATIONARY free body throws it at
  // exactly twice its own speed — the classic elastic result against an immovable partner, and the same
  // one CS021 P1b measured for the ship.
  for (const radius of byRing) {
    const proto = rails.find(r => r.orbitRadius === radius);
    const r = freeSat(X, proto.x, proto.y, 3, proto.vx, proto.vy);
    r.orbitCenter = proto.orbitCenter; r.orbitRadius = proto.orbitRadius;
    r.orbitAngle = proto.orbitAngle; r.orbitAngVel = proto.orbitAngVel;
    const railSpeed = Math.hypot(r.vx, r.vy);
    // Park the free body directly in the rail body's path, dead ahead.
    const ahead = Math.atan2(r.vy, r.vx);
    const fp = X.wrapPos({ x: r.x + Math.cos(ahead) * (r.radius + X.DEBRIS_RADII[3] - 4),
                           y: r.y + Math.sin(ahead) * (r.radius + X.DEBRIS_RADII[3] - 4) });
    const f = freeSat(X, fp.x, fp.y, 3, 0, 0);
    X.debrisBounce(f, r);
    const got = Math.hypot(f.vx, f.vy);
    const want = Math.max(2 * railSpeed, X.DEBRIS_BOUNCE_MIN);
    close(got, want, `C: a rail satellite at ${railSpeed.toFixed(1)} px/s shoves a parked satellite at max(2x, floor)`, 1e-6);
    console.log(`    ring r=${radius}: rail ${railSpeed.toFixed(1)} px/s -> parked satellite leaves at ${got.toFixed(1)} px/s`);
  }
}); })();

// ================= (D) spec §6 item 10 — THE ASYMMETRY OVER 300 REAL FRAMES =====================
(function sectionD() { withRandom(seededRandom(0xD0D0), () => {
  console.log("(D) spec §6 item 10 — a free satellite driven into a rail-borne one for 300 real frames");
  const SEED = 0xD001, FRAMES = 300;

  // Stage identically in both runs; the ONLY difference is where the free body is parked. Every rand()
  // draw is therefore the same in both, which is what makes the trajectory comparison a real control
  // rather than two unrelated simulations.
  function run(contact) {
    const X = seededBuild(SEED);
    return withRandom(seededRandom(SEED ^ 0x5A5A), () => {
      X.startGame();
      const FULL = levelWithRings(X, X.ORBIT_RING_COUNT);
      atWave(X, FULL);
      X.game.state = "playing"; X.game.paused = false;
      const rails = railBodies(X);
      const r = rails[Math.floor(rails.length / 2)];
      // Park the ship on the far side of the world so nothing else can interfere with either run.
      const [W, H] = X.worldDims(X.game.worldSize);
      X.game.ship.x = (r.orbitCenter.x + W / 2) % W;
      X.game.ship.y = (r.orbitCenter.y + H / 2) % H;
      X.game.ship.vx = 0; X.game.ship.vy = 0;
      // One free satellite, constructed identically in both runs (same rand draws), then placed.
      const f = freeSat(X, r.x, r.y, 3, 0, 0);
      X.game.debris.push(f);
      const trace = [], fields = [];
      for (let i = 0; i < FRAMES; i++) {
        X.game.ship.hp = X.SHIP_MAX_HP;
        if (contact) {
          // Drive it into the rail body every frame: park it just inside contact, moving inward.
          const ang = i * 0.37;
          const d = r.radius + f.radius - 6;
          const p = X.wrapPos({ x: r.x + Math.cos(ang) * d, y: r.y + Math.sin(ang) * d });
          f.x = p.x; f.y = p.y;
          f.vx = -Math.cos(ang) * 260; f.vy = -Math.sin(ang) * 260;
        } else {
          const p = X.wrapPos({ x: r.orbitCenter.x + W * 0.31, y: r.orbitCenter.y + H * 0.29 });
          f.x = p.x; f.y = p.y; f.vx = 0; f.vy = 0;
        }
        X.update(1 / 60);
        trace.push([r.x, r.y, r.vx, r.vy, r.orbitAngle]);
        fields.push([r.size, r.radius, r.damage, r.dead, r.guardT, r.spin,
                     r.orbitCenter === rails[0].orbitCenter, r.orbitRadius, r.orbitAngVel]);
      }
      return { X, r, f, trace, fields, state: X.game.state, wave: X.game.wave, angVel: r.orbitAngVel };
    });
  }

  const hit = run(true), ctrl = run(false);
  eq(hit.state, "playing", "D: (validity) the contact run stayed in the live update path");
  eq(hit.wave, ctrl.wave, "D: (validity) both runs stayed on the same level");

  // (1) TWELVE FIELDS BYTE-IDENTICAL ACROSS THE HELPER CALL ITSELF — CS021 P1b §E's own claim, restated
  //     for satellites. Direct call, so nothing else can be the reason.
  {
    const X = seededBuild(0xD100);
    X.startGame();
    atWave(X, levelWithRings(X, X.ORBIT_RING_COUNT));
    const r = railBodies(X)[0];
    const f = freeSat(X, r.x + 10, r.y + 6, 3, -400, 250);
    const before = snap12(r);
    X.debrisBounce(f, r);
    for (const k of TWELVE) eq(r[k], before[k], `D: the bounce left rail.${k} byte-identical`);
    close(Math.sqrt(X.dist2(r, r.orbitCenter)), r.orbitRadius, "D: ...and it is still exactly on its rail", 1e-6);
    assert(f.vx !== -400 || f.vy !== 250, "D: (control) ...while the FREE body really was changed");
  }

  // (2) THE RAIL BODY'S WHOLE 300-FRAME TRAJECTORY IS BYTE-IDENTICAL to the control run in which the
  //     free satellite is parked a third of a world away and never touches it.
  eq(JSON.stringify(hit.trace), JSON.stringify(ctrl.trace),
    "D: the rail body's 300-frame trajectory is BYTE-IDENTICAL with and without a satellite slamming into it");
  eq(JSON.stringify(hit.fields), JSON.stringify(ctrl.fields),
    "D: ...and so is every one of its non-kinematic fields, on every frame");

  // (3) IT NEVER LEAVES ITS RAIL, and its angle advances at exactly the rate its own angVel dictates.
  let worstRail = 0, worstStep = 0;
  const X = hit.X, r = hit.r;
  for (let i = 0; i < FRAMES; i++) {
    const [x, y, vx, vy, ang] = hit.trace[i];
    worstRail = Math.max(worstRail, Math.abs(Math.sqrt(X.dist2({ x, y }, r.orbitCenter)) - r.orbitRadius));
    if (i > 0) worstStep = Math.max(worstStep, Math.abs((ang - hit.trace[i - 1][4]) - hit.angVel / 60));
    // Its velocity is the rail's tangent, at exactly angVel x radius, every frame.
    worstStep = Math.max(worstStep, 0);
    close(Math.hypot(vx, vy), Math.abs(hit.angVel) * r.orbitRadius, "D: |v| === angVel x radius on every frame", 1e-6);
  }
  assert(worstRail < 1e-6, `D: the satellite never left its rail across ${FRAMES} frames (worst ${worstRail.toExponential(2)} px)`);
  assert(worstStep < 1e-12, `D: its orbit angle advanced by exactly angVel x dt every frame (worst ${worstStep.toExponential(2)} rad)`);

  // (4) THE CONTROL THAT MAKES ALL OF THE ABOVE MEAN SOMETHING: the contact really happened, repeatedly.
  //     Measured by the free body being ACTED ON — its velocity must differ from the inward one it was
  //     given, on every single frame. (Final geometric clearance is a weaker signal here and is reported
  //     rather than asserted: a full-ramp shell puts rings 138 px apart while a size-3 body is 92 px
  //     across, so a free body wedged between two rings can be resolved against one and end up back
  //     inside the other — real behaviour of a sequential pair-walk, not a defect.)
  let contacts = 0, clear = 0;
  {
    const Y = seededBuild(0xD200);
    Y.startGame();
    atWave(Y, levelWithRings(Y, Y.ORBIT_RING_COUNT));
    Y.game.state = "playing"; Y.game.paused = false;
    const rr = railBodies(Y)[0];
    const ff = freeSat(Y, rr.x, rr.y, 3, 0, 0);
    Y.game.debris.push(ff);
    const [W, H] = Y.worldDims(Y.game.worldSize);
    Y.game.ship.x = (rr.orbitCenter.x + W / 2) % W; Y.game.ship.y = (rr.orbitCenter.y + H / 2) % H;
    for (let i = 0; i < FRAMES; i++) {
      Y.game.ship.hp = Y.SHIP_MAX_HP;
      const ang = i * 0.37, d = rr.radius + ff.radius - 6;
      const p = Y.wrapPos({ x: rr.x + Math.cos(ang) * d, y: rr.y + Math.sin(ang) * d });
      const inVx = -Math.cos(ang) * 260, inVy = -Math.sin(ang) * 260;
      ff.x = p.x; ff.y = p.y; ff.vx = inVx; ff.vy = inVy;
      Y.update(1 / 60);
      if (ff.vx !== inVx || ff.vy !== inVy) contacts++;
      if (Math.sqrt(Y.dist2(ff, rr)) >= rr.radius + ff.radius) clear++;
    }
    eq(contacts, FRAMES, "D: (control) all 300 frames really resolved a contact — the free body was deflected every single one");
    assert(clear > FRAMES * 0.9, `D: (reported) ...and ended geometrically clear of that ring satellite on ${clear} of ${FRAMES}`);
  }
  console.log(`    ${FRAMES} frames of continuous contact (${clear}/${FRAMES} ended clear of the ring): rail trajectory ` +
              `byte-identical to the no-contact control, worst rail error ${worstRail.toExponential(2)} px`);
}); })();

// ================= (E) Correction C11 — RING vs RING IS UNREACHABLE =====================
//
// C11 says two rail-borne satellites cannot touch at the shipped geometry, so debrisBounce's rail/rail
// branch is dead code in normal play. That is asserted here, not left as a comment.
//
// CS023 KEEPS THIS TRUE, and it is worth saying why while P4 is still unwritten: P4's inward drift acts
// ONLY on free bodies (FORK-CS023-B) and never reads or writes orbitCenter / orbitRadius / orbitAngle /
// orbitAngVel, so no body ever crosses a rail radius while itself on a rail. The moment a satellite
// leaves a rail — a split child, a knocked-loose piece — it has no orbit state at all and is a FREE body
// by construction, which is the free/rail or free/free branch, never this one.
(function sectionE() { withRandom(seededRandom(0xE0E0), () => {
  console.log("(E) Correction C11 — ring vs ring is unreachable, swept over the real geometry");
  const X = seededBuild(0xE001);
  X.startGame();

  // (1) THE CORRIDOR, AS A DERIVATION. 138 px of ring spacing minus a 92 px satellite diameter.
  const corridor = X.ORBIT_RADIUS_STEP - 2 * X.DEBRIS_RADII[3];
  eq(corridor, 46, "E: the inter-ring radial corridor is ORBIT_RADIUS_STEP - 2 x DEBRIS_RADII[3] = 46 px");
  assert(corridor > 0, "E: ...and it is positive, which is the whole claim");

  // (2) EXHAUSTIVE ANGLE SWEEP over the real layout, on the real torus. Only the two angles matter: the
  //     wrap-aware separation of centre + r_i*u(a) and centre + r_j*u(b) depends on the two points'
  //     DIFFERENCE, which is independent of where the dock happens to sit. 1-degree resolution over
  //     every pair of DISTINCT rings, with both angles free — deliberately more permissive than reality,
  //     since two rings sharing an angVel never change their relative angle at all.
  //     SAME-RING pairs are a different question and are answered separately in (2b): those satellites
  //     are laid at a fixed angular spacing and share an angular velocity, so their separation is a
  //     constant of the layout — sweeping their angles independently would model a pair that cannot
  //     exist, and reports a nonsense overlap.
  const FULL = levelWithRings(X, X.ORBIT_RING_COUNT);
  atWave(X, FULL);
  const radii = [...new Set(railBodies(X).map(r => r.orbitRadius))].sort((p, q) => p - q);
  eq(radii.length, X.ORBIT_RING_COUNT, "E: (setup) the sweep runs over all four shipped rings");
  const [W, H] = X.worldDims(X.game.worldSize);
  const tor = (dx, dy) => {
    let ax = Math.abs(dx); if (ax > W / 2) ax = W - ax;
    let ay = Math.abs(dy); if (ay > H / 2) ay = H - ay;
    return Math.hypot(ax, ay);
  };
  const D = 2 * X.DEBRIS_RADII[3];
  let sweepMin = Infinity, sweepMinPair = null;
  const STEPS = 360;
  for (let i = 0; i < radii.length; i++) {
    for (let j = i + 1; j < radii.length; j++) {
      for (let u = 0; u < STEPS; u++) {
        const au = (u / STEPS) * X.TAU, cx = Math.cos(au) * radii[i], cy = Math.sin(au) * radii[i];
        for (let v = 0; v < STEPS; v++) {
          const bv = (v / STEPS) * X.TAU;
          const sep = tor(cx - Math.cos(bv) * radii[j], cy - Math.sin(bv) * radii[j]) - D;
          if (sep < sweepMin) { sweepMin = sep; sweepMinPair = [radii[i], radii[j]]; }
        }
      }
    }
  }
  assert(sweepMin > 0, `E: over every DISTINCT ring pair x 360 x 360 angle pairs on the real torus, the CLOSEST two ` +
    `rail-borne satellites can ever come is ${sweepMin.toFixed(2)} px of clear space — they cannot touch`);
  close(sweepMin, corridor, "E: ...and that closest approach IS the 46 px inter-ring corridor", 0.2);
  console.log(`    exhaustive sweep (distinct rings): minimum rail-to-rail separation ${sweepMin.toFixed(3)} px ` +
              `(rings r=${sweepMinPair[0]} and r=${sweepMinPair[1]}), corridor ${corridor} px`);

  // (2b) SAME-RING PAIRS. Their separation is a constant of the layout — one angular spacing, one shared
  //      angular velocity — so it is read off the real generator rather than swept, and it is enormous
  //      compared with the inter-ring corridor. This is the half of "no two rail bodies can touch" that
  //      the angle sweep above deliberately does not cover.
  {
    const layout = X.generateOrbitLayout({
      satelliteDiameter: X.DEBRIS_RADII[3] * 2, shipDiameter: X.SHIP_RADIUS * 2,
      centerX: X.game.dock.x, centerY: X.game.dock.y,
      orbitCount: X.ORBIT_RING_COUNT, innerRadius: X.ORBIT_INNER_RADIUS,
      radiusStep: X.orbitRadiusStepFor(X.ORBIT_RING_COUNT), safetyMargin: X.DEBUG.orbitSafetyMargin,
      minGapMultiplier: X.orbitEffectiveGapMult(FULL), densityByOrbit: X.ORBIT_DENSITY,
      baseAngVel: X.ORBIT_ANG_VEL, fastRingIndices: X.ORBIT_FAST_RING.map(n => n - 1),
      fastRingMult: X.ORBIT_FAST_MULT, activeRings: X.activeRingsFor(FULL),
    });
    let laneMin = Infinity;
    for (const ring of layout.rings) laneMin = Math.min(laneMin, ring.actualGapPx);
    assert(laneMin > corridor,
      `E: the tightest SAME-RING lane on the board is ${laneMin.toFixed(1)} px, far wider than the ${corridor} px ` +
      `inter-ring corridor — so the inter-ring case really is the binding one`);
    // ...and measured on the real spawned bodies, ring by ring, not just read off the layout.
    let sameMin = Infinity, sameChecked = 0;
    const rails = railBodies(X);
    for (let i = 0; i < rails.length; i++) for (let j = i + 1; j < rails.length; j++) {
      if (rails[i].orbitRadius !== rails[j].orbitRadius) continue;
      sameChecked++;
      sameMin = Math.min(sameMin, Math.sqrt(X.dist2(rails[i], rails[j])) - rails[i].radius - rails[j].radius);
    }
    assert(sameChecked > 0, "E: (setup) there really are same-ring pairs to measure");
    assert(sameMin > corridor, `E: ...and the ${sameChecked} real same-ring pairs measure ${sameMin.toFixed(1)} px apart at the closest`);
  }

  // (3) THE SAME CLAIM ON REAL SPAWNS, at every occurrence of the archetype.
  let realMin = Infinity, pairsChecked = 0;
  for (let occ = 1; occ <= 21; occ++) {
    const Y = seededBuild(0xE100 + occ);
    Y.startGame();
    atWave(Y, occ * Y.ORBIT_LEVEL_EVERY);
    const rs = railBodies(Y);
    assert(rs.length > 0, `E: (setup) occurrence ${occ} laid rail-borne satellites`);
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
      pairsChecked++;
      realMin = Math.min(realMin, Math.sqrt(Y.dist2(rs[i], rs[j])) - rs[i].radius - rs[j].radius);
    }
  }
  assert(realMin >= corridor - 1e-6,
    `E: across all 21 occurrences (${pairsChecked} real rail-to-rail pairs) the minimum separation is ` +
    `${realMin.toFixed(1)} px, never below the ${corridor} px corridor`);

  // (4) ...AND OVER TIME, not just at spawn: rings spin at different rates, so the relative angles move.
  {
    const Y = seededBuild(0xE900);
    Y.startGame();
    atWave(Y, levelWithRings(Y, Y.ORBIT_RING_COUNT));
    Y.game.state = "playing"; Y.game.paused = false;
    let liveMin = Infinity, frames = 0;
    for (let i = 0; i < 1800; i++) {            // 30 s — a full relative revolution between a slow and a fast ring
      Y.game.ship.hp = Y.SHIP_MAX_HP;
      Y.update(1 / 60);
      const rs = railBodies(Y);
      if (rs.length < 2) break;
      frames++;
      for (let p = 0; p < rs.length; p++) for (let q = p + 1; q < rs.length; q++)
        liveMin = Math.min(liveMin, Math.sqrt(Y.dist2(rs[p], rs[q])) - rs[p].radius - rs[q].radius);
    }
    eq(frames, 1800, "E: (setup) the 30 s live sweep ran to completion with the shell intact");
    assert(liveMin >= corridor - 1e-6,
      `E: over 1800 REAL frames the minimum live rail-to-rail separation is ${liveMin.toFixed(1)} px — never below ${corridor}`);
    console.log(`    30 s of real play: minimum live rail-to-rail separation ${liveMin.toFixed(1)} px`);
  }

  // (5) THE BRANCH ITSELF IS A LITERAL NO-OP. Forced directly, since play cannot produce it.
  {
    const Y = seededBuild(0xEA00);
    Y.startGame();
    atWave(Y, levelWithRings(Y, Y.ORBIT_RING_COUNT));
    const rs = railBodies(Y);
    const p = rs[0], q = freeSat(Y, p.x + 3, p.y - 2, 3, 111, -222);
    q.orbitCenter = p.orbitCenter; q.orbitRadius = p.orbitRadius;
    q.orbitAngle = p.orbitAngle + 0.01; q.orbitAngVel = p.orbitAngVel;
    assert(Math.sqrt(Y.dist2(p, q)) < p.radius + q.radius, "E: (setup) the forced pair really is overlapping");
    const bp = snap12(p), bq = snap12(q);
    Y.debrisBounce(p, q);
    for (const k of TWELVE) { eq(p[k], bp[k], `E: rail/rail is a no-op — first body's ${k} untouched`); eq(q[k], bq[k], `E: ...and the second's ${k}`); }
  }
}); })();

// ================= (F) spec §6 item 9 — WRAP CORRECTNESS, with a NAIVE CONTROL that must FAIL ========
(function sectionF() { withRandom(seededRandom(0xF0F0), () => {
  console.log("(F) wrap correctness at the seam, with a naive non-wrap normal as a LIVE control");
  const X = seededBuild(0xF001);
  X.startGame();
  atWave(X, levelWithRings(X, X.ORBIT_RING_COUNT));
  const [W, H] = X.worldDims(X.game.worldSize);
  eq(W, 3840, "F: (setup) the orbit level really is running in the size-9 world");

  let worstNaiveErr = 0, cases = 0;
  // A GENUINE STRADDLE, built rather than hoped for: `a` sits a couple of px inside a corner and `b` a
  // short way BACK from it, so wrapPos puts `b` at the far end of the world in BOTH axes. The short
  // vector a -> b is a few dozen px; the naive one is nearly a full world period, pointing the other way.
  const straddleCases = [];
  for (const [cx, cy, sx, sy] of [[2, 2, -1, -1], [W - 2, H - 2, +1, +1], [2, H - 2, -1, +1], [W - 2, 2, +1, -1]]) {
    for (const [sa, sb] of [[3, 3], [3, 1], [1, 2]]) straddleCases.push([cx, cy, sx, sy, sa, sb]);
  }
  for (const [ax, ay, sx, sy, sa, sb] of straddleCases) {
    {
      cases++;
      const ra = X.DEBRIS_RADII[sa], rb = X.DEBRIS_RADII[sb];
      const off = (ra + rb) * 0.5;
      const dx = sx * off * Math.SQRT1_2, dy = sy * off * Math.SQRT1_2;
      const bx = ((ax + dx) % W + W) % W, by = ((ay + dy) % H + H) % H;
      const a = freeSat(X, ax, ay, sa, 0, 0);
      const b = freeSat(X, bx, by, sb, 0, 0);
      assert(Math.sqrt(X.dist2(a, b)) < ra + rb, "F: (setup) the seam-straddling pair really is overlapping");
      assert(Math.abs(a.x - b.x) > W / 2 && Math.abs(a.y - b.y) > H / 2,
        "F: (setup) ...and it genuinely straddles the seam in BOTH axes — raw coordinates are a world apart");

      // The truth, and the naive answer. THE CONTROL IS THE TEST'S OWN ARITHMETIC, deliberately: it is
      // what a reader would write without reading CLAUDE.md's wrap-aware rule.
      const trueAng = X.angleTo(b, a);
      const naiveAng = Math.atan2(a.y - b.y, a.x - b.x);
      // The naive normal is not exactly 180 degrees out — the world is 3840x2160, not square, so the
      // naive delta (dx - W, dy - H) lands ~164 degrees from the truth rather than 180. Backwards is
      // backwards: a negative dot is the whole claim.
      const dot = Math.cos(trueAng) * Math.cos(naiveAng) + Math.sin(trueAng) * Math.sin(naiveAng);
      assert(dot < -0.5, `F: CONTROL — at the seam the naive normal points the OPPOSITE way (cos ${dot.toFixed(4)})`);
      const naiveDist = Math.hypot(a.x - b.x, a.y - b.y);
      worstNaiveErr = Math.max(worstNaiveErr, Math.abs(naiveDist - Math.sqrt(X.dist2(a, b))));

      X.debrisBounce(a, b);
      // The real helper separates them along the SHORT way round, to exactly contact + 2 px.
      close(Math.sqrt(X.dist2(a, b)), a.radius + b.radius + 2, "F: the pair is separated to contact + 2 px across the seam", 1e-6);
      // ...and in the RIGHT DIRECTION. A naive normal still lands them the right DISTANCE apart — just
      // on the wrong side — which is exactly the trap CS021 P1b §J caught for the ship.
      const outAng = X.angleTo(b, a);
      close(Math.cos(outAng - trueAng), 1, "F: ...and on the correct side, not shoved through each other", 1e-6);
      // Their separation VELOCITY also points the short way round.
      const nx = Math.cos(trueAng), ny = Math.sin(trueAng);
      assert((a.vx - b.vx) * nx + (a.vy - b.vy) * ny >= X.DEBRIS_BOUNCE_MIN - 1e-9,
        "F: ...and they are separating along the wrap-aware normal, at >= the floor");
      assert((a.vx - b.vx) * Math.cos(naiveAng) + (a.vy - b.vy) * Math.sin(naiveAng) < 0,
        "F: CONTROL — measured against the NAIVE normal the same pair reads as closing, i.e. the naive form is broken here");
    }
  }
  console.log(`    ${cases} seam cases: worst naive distance error ${worstNaiveErr.toFixed(0)} px (a full world period)`);
  assert(worstNaiveErr > 1000, "F: CONTROL — the naive measurement is wrong by more than 1,000 px at the seam");

  // The same, free vs RAIL: a ring straddling the seam is the routine case on an orbit level.
  {
    const Y = seededBuild(0xF900);
    Y.startGame();
    const FULL = levelWithRings(Y, Y.ORBIT_RING_COUNT);
    // Put the dock hard against a seam by placing the ship there before the wave is laid.
    Y.game.wave = FULL - 1; Y.game.debris.length = 0;
    Y.nextWave();
    const [WW, HH] = Y.worldDims(Y.game.worldSize);
    Y.game.dock.x = 4; Y.game.dock.y = HH - 4;
    Y.game.debris.length = 0;
    Y.game.wave = FULL - 1; Y.nextWave();
    Y.game.dock.x = 4; Y.game.dock.y = HH - 4;
    // Re-lay by hand is not needed — just take a rail body and confirm the shell really straddles.
    const rs = railBodies(Y);
    assert(rs.length > 0, "F: (setup) a seam-side orbit wave laid rail-borne satellites");
    const straddlers = rs.filter(r => r.x < 900 || r.x > WW - 900 || r.y < 900 || r.y > HH - 900);
    assert(straddlers.length > 0, "F: (setup) ...and some of them sit within a ring radius of a seam");
    for (const r of straddlers.slice(0, 8)) {
      const ang = Math.atan2(r.vy, r.vx);
      const p = Y.wrapPos({ x: r.x + Math.cos(ang) * (r.radius + Y.DEBRIS_RADII[3] - 5),
                            y: r.y + Math.sin(ang) * (r.radius + Y.DEBRIS_RADII[3] - 5) });
      const f = freeSat(Y, p.x, p.y, 3, 0, 0);
      const before = snap12(r);
      Y.debrisBounce(f, r);
      for (const k of TWELVE) eq(r[k], before[k], `F: a seam-side rail body is still untouched — ${k}`);
      close(Math.sqrt(Y.dist2(f, r)), r.radius + f.radius + 2, "F: ...and the free body lands at contact + 2 px, wrap-aware", 1e-6);
      assert(f.x >= -60 && f.x <= WW + 60 && f.y >= -60 && f.y <= HH + 60, "F: ...and inside the world, because wrap() ran");
    }
  }
}); })();

// ================= (G) THE PASS ITSELF, THROUGH REAL update(1/60) FRAMES =====================
(function sectionG() { withRandom(seededRandom(0x6060), () => {
  console.log("(G) the pass through real update(1/60) frames — and garbage canisters do NOT bounce");

  // (1) TWO OVERLAPPING FREE SATELLITES ON A FIELD LEVEL separate within ONE frame.
  {
    const X = seededBuild(0x6001);
    X.startGame();
    atWave(X, 4);
    eq(X.levelDef(4).archetype, "field", "G: (setup) level 4 is a field level");
    X.game.debris.length = 0;
    X.game.state = "playing"; X.game.paused = false;
    const [W, H] = X.worldDims(X.game.worldSize);
    X.game.ship.x = 100; X.game.ship.y = 100; X.game.ship.vx = 0; X.game.ship.vy = 0;
    const a = freeSat(X, W * 0.7, H * 0.7, 3, 0, 0);
    const b = freeSat(X, W * 0.7 + 20, H * 0.7 + 8, 3, 0, 0);
    X.game.debris.push(a, b);
    assert(Math.sqrt(X.dist2(a, b)) < a.radius + b.radius, "G: (setup) they start deeply overlapped");
    X.update(1 / 60);
    assert(Math.sqrt(X.dist2(a, b)) >= a.radius + b.radius,
      "G: ONE real frame of update() separates two overlapping FREE satellites — the pass is wired in");
    assert(Math.hypot(a.vx - b.vx, a.vy - b.vy) >= X.DEBRIS_BOUNCE_MIN - 1e-6,
      "G: ...and leaves them moving apart at >= the floor");
    // Momentum of the pair is conserved across a real frame too (both are size 3, so equal masses).
    close(a.vx + b.vx, 0, "G: ...with the pair's momentum still zero, as it was", 1e-6);
    close(a.vy + b.vy, 0, "G: ...in both axes", 1e-6);
  }

  // (2) THE MIXED POPULATION AN ORBIT LEVEL ACTUALLY CARRIES (Correction C12's predicted fix): a FIELD
  //     satellite spawned on top of a ring satellite used to pass straight through it.
  {
    const X = seededBuild(0x6002);
    X.startGame();
    atWave(X, levelWithRings(X, X.ORBIT_RING_COUNT));
    X.game.state = "playing"; X.game.paused = false;
    const r = railBodies(X)[0];
    const f = freeSat(X, r.x + 6, r.y - 4, 3, 0, 0);
    X.game.debris.push(f);
    X.game.ship.hp = X.SHIP_MAX_HP;
    const before = snap12(r);
    X.update(1 / 60);
    assert(Math.sqrt(X.dist2(f, r)) >= f.radius + r.radius, "G: an overlapped FIELD satellite is pushed clear of a ring satellite in one frame");
    // The rail body kept doing exactly what it was doing — its own rail motion, nothing else.
    for (const k of ["orbitRadius", "orbitAngVel", "orbitCenter", "dead", "guardT", "spin"])
      eq(r[k], before[k], `G: ...and the ring satellite's ${k} is untouched`);
    close(Math.sqrt(X.dist2(r, r.orbitCenter)), r.orbitRadius, "G: ...and it is still exactly on its rail", 1e-6);
  }

  // (3) A DEAD BODY IS NEVER BOUNCED. The pass runs before the end-of-frame filter, so BOTH sides must
  //     check the flag — a dead body that got shoved would be a ghost contact. Driven in BOTH array
  //     orders, because the outer loop's check and the inner loop's are two different guards and only
  //     one of them is exercised by either order.
  for (const deadFirst of [true, false]) {
    const X = seededBuild(0x6003 + (deadFirst ? 0 : 1));
    X.startGame();
    atWave(X, 4);
    X.game.debris.length = 0;
    X.game.state = "playing"; X.game.paused = false;
    const [W, H] = X.worldDims(X.game.worldSize);
    X.game.ship.x = 60; X.game.ship.y = 60;
    const dead = freeSat(X, W * 0.6, H * 0.6, 3, 0, 0);
    const live = freeSat(X, W * 0.6 + 10, H * 0.6, 3, 0, 0);
    dead.dead = true;
    X.game.debris.push(...(deadFirst ? [dead, live] : [live, dead]));
    const where = deadFirst ? "first in the array (the OUTER loop's guard)" : "second in the array (the INNER loop's guard)";
    assert(Math.sqrt(X.dist2(dead, live)) < dead.radius + live.radius, `G: (setup) the pair overlaps, dead body ${where}`);
    const dBefore = [dead.x, dead.y, dead.vx, dead.vy], lBefore = [live.x, live.y, live.vx, live.vy];
    X.update(1 / 60);
    eq(dead.x, dBefore[0], `G: a DEAD body ${where} is never bounced — x`);
    eq(dead.y, dBefore[1], `G: ...nor y`);
    eq(dead.vx, dBefore[2], `G: ...nor its velocity`);
    eq(live.x, lBefore[0], `G: ...and the live body it overlaps is not moved either — x`);
    eq(live.vx, lBefore[2], `G: ...nor pushed — vx`);
    eq(live.vy, lBefore[3], `G: ...nor vy`);
  }

  // (4) GARBAGE CANISTERS DO NOT BOUNCE (TRAP 2). They coalesce, which is their own mechanic.
  {
    const X = seededBuild(0x6004);
    X.startGame();
    atWave(X, 4);
    X.game.debris.length = 0;
    X.game.state = "playing"; X.game.paused = false;
    const [W, H] = X.worldDims(X.game.worldSize);
    X.game.ship.x = 60; X.game.ship.y = 60;
    // Two canisters right on top of each other, held OUT of coalescence by their own delay so the only
    // thing that could move them is a bounce.
    const g1 = new X.Garbage(W * 0.5, H * 0.5, 0, 0);
    const g2 = new X.Garbage(W * 0.5 + 1, H * 0.5, 0, 0);
    g1.coalesceDelay = 99; g2.coalesceDelay = 99;
    X.game.garbage.push(g1, g2);
    const before = [g1.x, g1.y, g1.vx, g1.vy, g2.x, g2.y, g2.vx, g2.vy];
    for (let i = 0; i < 20; i++) { X.game.ship.hp = X.SHIP_MAX_HP; X.update(1 / 60); }
    eq(g1.vx, before[2], "G: TRAP 2 — a canister's vx is untouched by the debris pass");
    eq(g1.vy, before[3], "G: ...and its vy");
    eq(g2.vx, before[6], "G: ...and its neighbour's vx");
    eq(g2.pieces, 1, "G: ...and neither merged, because their coalesce delay was held");
    assert(Math.sqrt(X.dist2(g1, g2)) < 5, "G: ...they are still sitting on top of each other, unbounced");
  }

  // (5) THE PASS FIRES IN ORDINARY PLAY, not just in staged setups. destroyDebris() births its three
  //     children at the parent's OWN position, and a rail-borne parent hands all three the SAME tangent —
  //     so a split is the commonest contact in the game and the floor is what breaks the stack up.
  {
    const X = seededBuild(0x6005);
    X.startGame();
    atWave(X, levelWithRings(X, X.ORBIT_RING_COUNT));
    X.game.state = "playing"; X.game.paused = false;
    const parent = railBodies(X)[0];
    const px = parent.x, py = parent.y;
    X.destroyDebris(parent, true);
    const kids = X.game.debris.filter(d => !d.dead && d.size === 2);
    eq(kids.length, 3, "G: (setup) the rail-borne parent split three ways");
    for (const k of kids) eq(k.orbitCenter, undefined, "G: (setup) ...and every child is FREE, carrying no orbit state");
    const spread0 = Math.max(Math.sqrt(X.dist2(kids[0], kids[1])), Math.sqrt(X.dist2(kids[0], kids[2])), Math.sqrt(X.dist2(kids[1], kids[2])));
    close(spread0, 0, "G: (setup) ...and all three are born at exactly the parent's position", 1e-9);
    close(Math.hypot(kids[0].vx - kids[1].vx, kids[0].vy - kids[1].vy), 0,
      "G: (setup) ...with IDENTICAL velocities, because a rail parent hands over its tangent", 1e-9);
    const closest = () => Math.min(Math.sqrt(X.dist2(kids[0], kids[1])),
                                   Math.sqrt(X.dist2(kids[0], kids[2])),
                                   Math.sqrt(X.dist2(kids[1], kids[2])));
    X.game.ship.hp = X.SHIP_MAX_HP;
    X.update(1 / 60);
    const spread1 = closest();
    assert(spread1 > 0, "G: ONE real frame breaks the coincident stack apart — the three children are no longer at one point");
    assert(kids.every(k => Math.hypot(k.vx - kids[0].vx, k.vy - kids[0].vy) >= 0) &&
           kids.some(k => Math.hypot(k.vx - kids[0].vx, k.vy - kids[0].vy) > 0),
      "G: ...and they no longer share one velocity, so they will keep separating");
    // FULL separation takes a few frames, and honestly so: a pair-walk resolves ONE pair at a time, so a
    // three-body pile is resolved over successive frames rather than all at once. Bounded and asserted.
    let framesToClear = 1;
    while (closest() < 2 * X.DEBRIS_RADII[2] && framesToClear < 60) {
      X.game.ship.hp = X.SHIP_MAX_HP; X.update(1 / 60); framesToClear++;
    }
    assert(framesToClear < 60,
      `G: ...and all three pairs are fully clear of contact after ${framesToClear} frames (a pair-walk resolves a ` +
      `three-body pile over successive frames, not in one)`);
    console.log(`    a coincident 3-way split at (${px.toFixed(0)}, ${py.toFixed(0)}) is ${spread1.toFixed(1)} px apart ` +
                `after one frame and fully clear after ${framesToClear}`);
  }
}); })();

// ================= (H) ⛔ FRAME-BUDGET GATE (spec §6 item 18) =====================
//
// GATED ON DETERMINISTIC COUNTERS, NOT ON WALL TIME. Headless Node timing is GC-noisy and machine-
// dependent, which is exactly why CS022 P3 gated on a counter; wall time and peak entity counts are
// measured and REPORTED alongside, never asserted. Two counters, one increment per site, in an
// instrumented COPY of the real source: the NEW debris pair-walk, and coalesceGarbage's existing one.
//
// ── CEILING 1: THE DEBRIS PASS (new this changeset). DERIVED BEFORE MEASURING. ──────────────────────
// The prompt asks for the derivation to be anchored on CS022 P3's 49,203-check measurement and the
// entity-count ratio, so start there and say where the ratio does and does not apply.
//   * CS022 P3 measured 49,203 coalesceGarbage pair-checks in the worst live frame at its 84-satellite
//     peak, over 337 standing canisters. CS023's peak wave (level 21) is 29 satellites, a ratio of
//     29/84 = 0.345. Canister VOLUME scales roughly linearly with satellite count and pair count
//     quadratically, so that ratio would project CS022's figure down to ~5,900 checks.
//   * THAT PROJECTION IS WRONG FOR GARBAGE, and CS023 P1 already measured why: it re-ran the same probe
//     on the new shell and got 36,816, six times the projection. Standing garbage is governed by how
//     fast coalescence MERGES, not by how much is emitted, so the entity-count ratio does not carry.
//     This is exactly why the two coalesce ceilings below are NOT re-derived downward (STATUS.md's
//     standing Known-issues rule) and are carried forward unchanged.
//   * THE RATIO ARGUMENT DOES CARRY FOR game.debris, because that population has no merge dynamics at
//     all — it is a closed-form function of the spawn count through the 3-way split cascade. So the
//     debris ceiling is derived from the cascade directly rather than from a scaling:
//       - level 21 spawns 29 size-3 satellites (16 ring + 13 field);
//       - the full cascade is 29 larges -> 87 mediums -> 261 smalls, i.e. 377 bodies ever created;
//       - the counter increments BEFORE the dead check (matching coalesceGarbage's own instrumentation),
//         and the pass runs BEFORE the end-of-frame filter, so the array length that matters is bounded
//         by all 377 coexisting in one frame — reachable only if every parent dies on the same frame its
//         children are born, i.e. the deliberately-unreachable blitz;
//       - C(377, 2) = 70,876 pair-checks. That is a HARD structural bound for one orbit level, because
//         a wave cannot clear until game.debris is empty, so nothing carries over from the level before.
//   * CEILING = 250,000, ~3.5x that bound. The margin covers the pair count's QUADRATIC sensitivity to a
//     body-count error (a 40% miss doubles the pairs) and the fact that the bound assumes exactly the
//     shipped spawn counts.
//   * A TIGHTER CEILING FOR THE REALISTIC PATH, derived the same way and also before measuring: a
//     progressive harvest converts tier by tier, so its peak array is the small-tier population, 261,
//     plus a handful of dead-but-unfiltered bodies. C(263, 2) = 34,453. CEILING = 100,000, ~2.9x — the
//     same order of margin CS022 P3 used for its own realistic ceiling.
//
// ── CEILINGS 2 AND 3: coalesceGarbage. CARRIED FORWARD FROM CS022 P3, DELIBERATELY NOT TIGHTENED. ────
// 8,000,000 (worst case) and 500,000 (realistic path). STATUS.md's standing rule is explicit that these
// are derived from arithmetic rather than fitted to a measurement, and that the slack is what buys this
// changeset's new passes. They are re-asserted here because this phase MOVES DEBRIS POSITIONS, which
// changes where garbage is emitted and therefore what coalescence has to do — a regression on the
// existing pass is a real possibility and is gated for.
//
// IF ANY CEILING IS BREACHED: STOP AND REPORT. The four density sliders are the first lever; a spatial
// hash is its own changeset with an 8.27M-check justification already on file. Neither is a thing to
// tune around inside this phase.
const DEBRIS_PAIR_CEILING     = 250000;
const DEBRIS_HARVEST_CEILING  = 100000;
const COALESCE_PAIR_CEILING   = 8000000;
const COALESCE_HARVEST_CEILING = 500000;
(function sectionH() {
  console.log("(H) ⛔ FRAME-BUDGET GATE (spec §6 item 18) — two deterministic pair-check counters");

  const DEBRIS_LOOP = "    for (let j = i + 1; j < game.debris.length; j++) {\n      const b = game.debris[j];";
  const COAL_LOOP   = "    for (let j = i + 1; j < gs.length; j++) {\n      const b = gs[j];";
  eq((scriptSrc.match(/for \(let j = i \+ 1; j < game\.debris\.length; j\+\+\) \{/g) || []).length, 1,
    "H: (setup) exactly one debris inner loop to instrument");
  eq((scriptSrc.match(/for \(let j = i \+ 1; j < gs\.length; j\+\+\) \{/g) || []).length, 1,
    "H: (setup) exactly one coalesceGarbage inner loop to instrument");
  assert(scriptSrc.includes(DEBRIS_LOOP) && scriptSrc.includes(COAL_LOOP), "H: (setup) both loops match their expected text");
  const instrumented = "const __PROBE = { debrisPairs: 0, coalescePairs: 0 };\n" +
    scriptSrc.replace(DEBRIS_LOOP, DEBRIS_LOOP + "\n      __PROBE.debrisPairs++;")
             .replace(COAL_LOOP,   COAL_LOOP   + "\n      __PROBE.coalescePairs++;");

  // Prove BOTH counters are live before trusting either. Getting this wrong is how a probe reads zero
  // and looks like a pass. A fresh garbage burst cannot coalesce for GARBAGE_COALESCE_DELAY seconds, so
  // the control has to run well past that.
  {
    const C = withRandom(seededRandom(0x9101), () => buildFrom(instrumented, { extra: ["__PROBE"] }));
    withRandom(seededRandom(0x9101), () => { C.startGame(); atWave(C, 4); });
    C.game.state = "playing"; C.game.paused = false;
    for (const d of C.game.debris.filter(d => !d.dead).slice(0, 8)) C.destroyDebris(d, true);
    let cd = 0, cc = 0;
    for (let i = 0; i < 300; i++) {
      C.__PROBE.debrisPairs = 0; C.__PROBE.coalescePairs = 0;
      C.game.ship.hp = C.SHIP_MAX_HP; C.update(1 / 60);
      cd = Math.max(cd, C.__PROBE.debrisPairs); cc = Math.max(cc, C.__PROBE.coalescePairs);
    }
    assert(cd > 0, `H: (control) the DEBRIS pair counter is live — ${cd} checks in the worst of 300 ordinary frames`);
    assert(cc > 0, `H: (control) the COALESCE pair counter is live — ${cc} checks in the worst of 300 ordinary frames`);
  }

  // THE MEASUREMENT, at level 21 — the peak wave. Same three probes CS022 P3 used, same reasons:
  //   harvest — a steady progressive FULL harvest with the ship kept alive, one kill every 6 frames.
  //   blitz   — every satellite and split child destroyed within a handful of frames, ship still ALIVE.
  //             A deliberate over-stress: the death-shockwave load put through the LIVE passes, which is
  //             what the debris ceiling's structural bound assumes. REPORTED, and gated only against the
  //             worst-case ceilings.
  //   death   — a real killShip() on a part-harvested board. updateDeath() runs neither pass (CS022 P3's
  //             finding), so this is expected to measure ZERO on both counters; it is kept because a
  //             future change that put either pass into the death path must be caught.
  // ONE SATELLITE IS DELIBERATELY LEFT ALIVE in the blitz, or wave-clear advances the level mid-measurement.
  function probe(level, seed, mode) {
    const Y = withRandom(seededRandom(seed), () => buildFrom(instrumented, { extra: ["__PROBE"] }));
    withRandom(seededRandom(seed), () => { Y.startGame(); atWave(Y, level); });
    Y.game.state = "playing"; Y.game.paused = false;
    const spawned = Y.game.debris.length;
    let frames = 0, sinceKill = 0, tail = 0;
    let worstD = 0, worstDFrame = 0, worstDBodies = 0, worstC = 0, worstCGarbage = 0;
    let worstDDead = 0, worstCDead = 0, deadFrames = 0;   // only the frames AFTER the ship dies
    let peak = 0, peakDebris = 0, peakGarbage = 0, peakParticles = 0;
    let worstNs = 0n, totalNs = 0n, livePlayFrames = 0;
    const samples = [];
    const MAX_FRAMES = mode === "harvest" ? 9000 : mode === "blitz" ? 600 : 4000;
    withRandom(seededRandom(seed ^ 0xFFFF), () => {
      while (tail < 120 && frames < MAX_FRAMES) {
        if (mode === "death") {
          if (frames === 90) Y.killShip();
          else if (frames < 90) {
            const live = Y.game.debris.filter(d => !d.dead);
            if (++sinceKill >= 6 && live.length) { sinceKill = 0; Y.destroyDebris(live[0], true); }
            Y.game.ship.hp = Y.SHIP_MAX_HP;
          }
        } else {
          Y.game.ship.hp = Y.SHIP_MAX_HP;
          const live = Y.game.debris.filter(d => !d.dead);
          if (mode === "blitz") {
            for (let k = 0; k + 1 < live.length; k++) Y.destroyDebris(live[k], true);   // all but one
          } else if (++sinceKill >= 6 && live.length) {
            sinceKill = 0; Y.destroyDebris(live[0], true);
          }
        }
        if (Y.game.debris.length === 0) tail++;
        Y.__PROBE.debrisPairs = 0; Y.__PROBE.coalescePairs = 0;
        const bodiesIn = Y.game.debris.length;
        const t0 = process.hrtime.bigint();
        Y.update(1 / 60);
        const dtNs = process.hrtime.bigint() - t0;
        if (Y.__PROBE.debrisPairs > worstD) { worstD = Y.__PROBE.debrisPairs; worstDFrame = frames; worstDBodies = bodiesIn; }
        if (Y.__PROBE.coalescePairs > worstC) { worstC = Y.__PROBE.coalescePairs; worstCGarbage = Y.game.garbage.length; }
        if (Y.game.state !== "playing") {
          deadFrames++;
          worstDDead = Math.max(worstDDead, Y.__PROBE.debrisPairs);
          worstCDead = Math.max(worstCDead, Y.__PROBE.coalescePairs);
        }
        totalNs += dtNs; if (dtNs > worstNs) worstNs = dtNs;
        if (Y.game.state === "playing") livePlayFrames++;
        frames++;
        const ents = Y.game.debris.length + Y.game.hunters.length + Y.game.saucers.length +
                     Y.game.garbage.length + Y.game.particles.length + Y.game.bullets.length +
                     Y.game.powerups.length + Y.game.floaters.length;
        samples.push({ ents, ns: dtNs });
        peak = Math.max(peak, ents);
        peakDebris = Math.max(peakDebris, Y.game.debris.length);
        peakGarbage = Math.max(peakGarbage, Y.game.garbage.length);
        peakParticles = Math.max(peakParticles, Y.game.particles.length);
        if (mode === "death" && Y.game.state === "gameover") break;
      }
    });
    const warm = samples.slice(30);
    const msOf = s => Number(s.ns) / 1e6;
    const pct = (arr, p) => { const v = arr.map(msOf).sort((a, b) => a - b); return v.length ? v[Math.min(v.length - 1, Math.floor(v.length * p))] : 0; };
    return { level, mode, spawned, frames, livePlayFrames, deadFrames, worstDDead, worstCDead,
             worstD, worstDFrame, worstDBodies, worstC, worstCGarbage,
             peak, peakDebris, peakGarbage, peakParticles, endState: Y.game.state, endWave: Y.game.wave,
             medianMs: pct(warm, 0.5), p95Ms: pct(warm, 0.95), p99Ms: pct(warm, 0.99),
             worstMs: Number(worstNs) / 1e6, meanMs: Number(totalNs / BigInt(frames || 1)) / 1e6 };
  }

  const harvest = probe(21, 0x9021, "harvest");
  const death   = probe(21, 0x9021, "death");
  const blitz   = probe(21, 0x9021, "blitz");

  // Validity: no probe may silently degenerate into a cheaper code path.
  const PEAK_SPAWN = 29;   // spec §1.4's published peak, re-derived below rather than trusted
  {
    const V = seededBuild(0x9500);
    V.startGame();
    eq(atWave(V, 21), PEAK_SPAWN, "H: (validity) level 21 really is the 29-satellite peak wave");
    eq(V.game.debris.every(d => d.size === 3), true, "H: (validity) ...and every one of them is a size-3 large, so the cascade bound holds");
  }
  for (const p of [harvest, blitz, death]) eq(p.spawned, PEAK_SPAWN, `H: (validity) the ${p.mode} probe started from the ${PEAK_SPAWN}-satellite peak wave`);
  eq(harvest.endState, "playing", "H: (validity) the harvest probe stayed in the live update path throughout");
  eq(blitz.endState, "playing", "H: (validity) so did the blitz probe");
  eq(harvest.endWave, 21, "H: (validity) the harvest stayed on level 21 — no wave clear mid-measurement");
  eq(blitz.endWave, 21, "H: (validity) ...and so did the blitz");
  assert(harvest.frames > 300, `H: (validity) the harvest ran a real number of frames (${harvest.frames})`);
  assert(harvest.peakDebris > PEAK_SPAWN, "H: (validity) the harvest really cascaded through the split tiers");
  eq(blitz.livePlayFrames, blitz.frames, "H: (validity) EVERY blitz frame was a live update() — none of it measured the death path");
  eq(death.endState, "gameover", "H: (validity) the death probe really reached gameover");

  // CS022 P3's finding, re-asserted for the NEW pass as well: updateDeath() runs neither O(n^2) pass.
  // Measured over the frames AFTER the ship dies — the death probe's first 90 frames are ordinary live
  // play and legitimately run the debris pass, which is why this is not death.worstD. (CS022 P3's own
  // version could use the raw worst because a fresh garbage burst cannot coalesce for 3 s, so its
  // pre-death frames happened to measure zero; the debris pass has no such delay and fires immediately.)
  assert(death.deadFrames > 100, `H: (setup) the death probe really ran ${death.deadFrames} frames past the ship's death`);
  eq(death.worstDDead, 0, "H: (finding) once the ship is dead the debris pass never runs — updateDeath() has no such call");
  eq(death.worstCDead, 0, "H: (finding) ...nor coalesceGarbage, exactly as CS022 P3 found");
  assert(death.worstD > 0, "H: (control) ...while its pre-death LIVE frames did run the debris pass, so the claim above is about the death path");
  {
    const ud = codeOnly.slice(codeOnly.indexOf("function updateDeath(dt) {"));
    const udBody = ud.slice(0, ud.indexOf("\n}\n"));
    assert(!/debrisBounce/.test(udBody), "H: (source) updateDeath() contains no debrisBounce call");
    assert(!/coalesceGarbage/.test(udBody), "H: (source) ...and still no coalesceGarbage call");
  }
  // The structural bound the debris ceiling was derived from is real: nothing ever exceeded it. It is a
  // deliberate OVER-estimate, and the reason is worth recording — the counter lives in the INNER loop and
  // the outer loop `continue`s past a dead body entirely, so a dead body contributes as `j` but never as
  // `i`. C(377,2) therefore bounds a frame in which all 377 are alive, which the cascade cannot produce.
  const STRUCTURAL = 377 * 376 / 2;
  for (const p of [harvest, blitz, death]) assert(p.worstD <= STRUCTURAL,
    `H: the derivation's structural bound holds — the ${p.mode} probe's worst frame did ${p.worstD.toLocaleString("en-US")} ` +
    `checks against the C(377,2) = ${STRUCTURAL.toLocaleString("en-US")} cascade maximum`);

  // ── THE COUNTERS' TEETH. A gate is only worth having if the instrument could register a breach, and
  // neither real scenario comes near the ceiling, so both counters are proved against a load that does.
  // The debris one gets a SANDBOX over-stress: 720 free satellites pushed onto one board and driven for a
  // single frame. That is not a state the game can reach — level 21's whole cascade tops out at 377
  // bodies — and it is not gated on; it exists to show the counter scales quadratically and would put a
  // real breach on screen.
  {
    const S = withRandom(seededRandom(0x9F00), () => buildFrom(instrumented, { extra: ["__PROBE"] }));
    withRandom(seededRandom(0x9F00), () => { S.startGame(); atWave(S, 4); });
    S.game.state = "playing"; S.game.paused = false;
    S.game.debris.length = 0;
    const [W, H] = S.worldDims(S.game.worldSize);
    const N = 720;
    withRandom(seededRandom(0x9F01), () => {
      for (let i = 0; i < N; i++) S.game.debris.push(freeSat(S, (i * 37) % W, (i * 53) % H, 1, 0, 0));
    });
    S.__PROBE.debrisPairs = 0;
    S.game.ship.hp = S.SHIP_MAX_HP;
    S.update(1 / 60);
    const want = N * (N - 1) / 2;
    eq(S.__PROBE.debrisPairs, want,
      `H: (teeth) a ${N}-body sandbox board drives the debris counter to exactly C(${N},2) — the counter is quadratic and exact`);
    assert(S.__PROBE.debrisPairs > DEBRIS_PAIR_CEILING,
      `H: (teeth) ...and that is ${S.__PROBE.debrisPairs.toLocaleString("en-US")} checks, ABOVE the ` +
      `${DEBRIS_PAIR_CEILING.toLocaleString("en-US")} gate, so a real breach could not go unseen`);
    console.log(`    teeth: a ${N}-body sandbox board (unreachable in play — the level-21 cascade tops out at 377) ` +
                `registers ${S.__PROBE.debrisPairs.toLocaleString("en-US")} debris pair checks`);
  }
  assert(blitz.worstC > COALESCE_HARVEST_CEILING,
    `H: (teeth) the coalesce counter registers far more than ITS gated realistic ceiling (${blitz.worstC.toLocaleString("en-US")})`);

  for (const p of [harvest, death, blitz]) {
    const label = p.mode === "harvest" ? "PROGRESSIVE FULL HARVEST (steady, ship alive) — GATED"
                : p.mode === "death"   ? "DEATH DETONATION at frame 90 (part-harvested, real killShip()) — GATED"
                                       : "BLITZ over-stress (whole ring at once, ship alive) — REPORTED, NOT REACHABLE IN PLAY";
    console.log(`    level ${p.level} ${label}: spawned ${p.spawned}, frames ${p.frames}`);
    console.log(`      PEAK ENTITIES ${p.peak}  (debris ${p.peakDebris} / garbage ${p.peakGarbage} / particles ${p.peakParticles})`);
    console.log(`      update(dt) ms — median ${p.medianMs.toFixed(3)}, p95 ${p.p95Ms.toFixed(3)}, p99 ${p.p99Ms.toFixed(3)}, ` +
      `worst ${p.worstMs.toFixed(3)}, mean ${p.meanMs.toFixed(3)} (GC-inflated)   [REPORTED, never gated]`);
    console.log(`      worst-frame DEBRIS pair checks:    ${p.worstD.toLocaleString("en-US")} (frame ${p.worstDFrame}, ${p.worstDBodies} bodies in the array)`);
    console.log(`      worst-frame COALESCE pair checks:  ${p.worstC.toLocaleString("en-US")} (${p.worstCGarbage} canisters standing)`);
  }
  const worstD = Math.max(harvest.worstD, death.worstD);
  const worstC = Math.max(harvest.worstC, death.worstC);
  console.log(`    ⛔ GATE 1 (debris pass, the two REAL scenarios): ${worstD.toLocaleString("en-US")} vs a derived ceiling of ` +
    `${DEBRIS_PAIR_CEILING.toLocaleString("en-US")} — ${(100 * worstD / DEBRIS_PAIR_CEILING).toFixed(2)}% of budget.`);
  console.log(`    ⛔ GATE 2 (debris pass, realistic path): the harvest's ${harvest.worstD.toLocaleString("en-US")} vs ` +
    `${DEBRIS_HARVEST_CEILING.toLocaleString("en-US")} — ${(100 * harvest.worstD / DEBRIS_HARVEST_CEILING).toFixed(1)}% of budget.`);
  console.log(`    ⛔ GATE 3 (coalesceGarbage, carried forward from CS022 P3, NOT tightened): ${worstC.toLocaleString("en-US")} vs ` +
    `${COALESCE_PAIR_CEILING.toLocaleString("en-US")} — ${(100 * worstC / COALESCE_PAIR_CEILING).toFixed(2)}% of budget.`);
  console.log(`    ⛔ GATE 4 (coalesceGarbage, realistic path): ${harvest.worstC.toLocaleString("en-US")} vs ` +
    `${COALESCE_HARVEST_CEILING.toLocaleString("en-US")} — ${(100 * harvest.worstC / COALESCE_HARVEST_CEILING).toFixed(1)}% of budget.`);
  console.log(`    CAVEAT: update(dt) ONLY. draw() is not in the loop and shadowBlur render cost is the browser`);
  console.log(`    watch item (playtest gate Q7), which no headless probe can answer.`);

  const STOP = "STOP: retune the four density sliders (first lever) or take a spatial hash as its own changeset — " +
               "do NOT tune around this here.";
  assert(worstD <= DEBRIS_PAIR_CEILING,
    `H: ⛔ GATE — the debris pass did ${worstD.toLocaleString("en-US")} pair checks in the worst frame of the two REAL ` +
    `scenarios, over the derived ceiling of ${DEBRIS_PAIR_CEILING.toLocaleString("en-US")}. ${STOP}`);
  assert(harvest.worstD <= DEBRIS_HARVEST_CEILING,
    `H: ⛔ GATE — the realistic progressive harvest did ${harvest.worstD.toLocaleString("en-US")} debris pair checks, over the ` +
    `${DEBRIS_HARVEST_CEILING.toLocaleString("en-US")} live-harvest ceiling. ${STOP}`);
  assert(worstC <= COALESCE_PAIR_CEILING,
    `H: ⛔ GATE — coalesceGarbage did ${worstC.toLocaleString("en-US")} pair checks, over the carried-forward ` +
    `${COALESCE_PAIR_CEILING.toLocaleString("en-US")} ceiling. ${STOP}`);
  assert(harvest.worstC <= COALESCE_HARVEST_CEILING,
    `H: ⛔ GATE — the realistic harvest did ${harvest.worstC.toLocaleString("en-US")} coalesce pair checks, over the ` +
    `${COALESCE_HARVEST_CEILING.toLocaleString("en-US")} ceiling. ${STOP}`);
  // ...and the gated measurement must not be vacuous.
  assert(harvest.worstD > 1000,
    `H: (control) the harvest's worst debris frame really did substantial work (${harvest.worstD.toLocaleString("en-US")} checks ` +
    `over ${harvest.worstDBodies} bodies), so the ceiling is measuring something`);
  assert(harvest.worstC > 1000,
    `H: (control) ...and so did its worst coalesce frame (${harvest.worstC.toLocaleString("en-US")} checks)`);
})();

// ================= (I) spec §6 item 19 — DETERMINISM =====================
(function sectionI() {
  console.log("(I) spec §6 item 19 — determinism under a seeded LCG");
  const run = () => withRandom(seededRandom(0xDE7E), () => {
    const B = build();
    B.startGame();
    atWave(B, levelWithRings(B, B.ORBIT_RING_COUNT));
    B.game.state = "playing"; B.game.paused = false;
    const out = [];
    for (let i = 0; i < 240; i++) {
      B.game.ship.hp = B.SHIP_MAX_HP;
      if (i === 40) { const live = B.game.debris.filter(d => !d.dead); if (live.length) B.destroyDebris(live[0], true); }
      if (i === 90) { const live = B.game.debris.filter(d => !d.dead); if (live.length) B.destroyDebris(live[0], true); }
      B.update(1 / 60);
      if (i % 30 === 0) out.push(B.game.debris.map(d => [+d.x.toFixed(9), +d.y.toFixed(9), +d.vx.toFixed(9), +d.vy.toFixed(9), d.size]));
    }
    return JSON.stringify(out);
  });
  const a = run(), b = run(), c = run();
  eq(a, b, "I: two seeded runs of a real bouncing orbit level are byte-identical");
  eq(b, c, "I: ...and a third");
  assert(a.length > 2000, "I: (control) the snapshot is substantial, not an empty array");
  // The one unpinned Math.random() site in the whole build is named rather than left implicit.
  assert(/for \(let i = 0; i < STAR_COUNT; i\+\+\)/.test(codeOnly),
    "I: the module-load starfield is the one unpinned Math.random() site — every build() above runs inside a seeded LCG for it");
})();

// ================= (J) spec §6 item 20 — AudioSys.ctx null smoke =====================
(function sectionJ() { withRandom(seededRandom(0x5A00), () => {
  console.log("(J) spec §6 item 20 — AudioSys.ctx === null update-and-draw smoke");
  const X = withRandom(seededRandom(0x5A11), () => build({ audio: false }));
  eq(X.AudioSys.ctx, null, "J: (setup) the build really has no audio context");
  X.startGame();
  let threw = null;
  try {
    withRandom(seededRandom(0x5A12), () => {
      // Walk the whole ramp — one ring, two, three, four — with real bouncing on every one.
      for (let occ = 1; occ <= 5; occ++) {
        atWave(X, occ * X.ORBIT_LEVEL_EVERY);
        X.game.state = "playing"; X.game.paused = false;
        // Seed a coincident split so the pass has real work on every level.
        const live = X.game.debris.filter(d => !d.dead);
        if (live.length) X.destroyDebris(live[0], true);
        for (let i = 0; i < 120; i++) { X.game.ship.hp = X.SHIP_MAX_HP; X.update(1 / 60); X.draw(); }
      }
      // ...and a field level, where the pass also runs.
      atWave(X, 4);
      X.game.state = "playing"; X.game.paused = false;
      for (let i = 0; i < 120; i++) { X.game.ship.hp = X.SHIP_MAX_HP; X.update(1 / 60); X.draw(); }
    });
  } catch (e) { threw = e; }
  assert(threw === null, "J: 720 update+draw frames across the whole ramp and a field level, no audio context, nothing thrown" +
    (threw ? " — " + threw.stack : ""));
}); })();

console.log(`\ntest-cs023-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
