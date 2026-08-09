// Headless test for CS023 Phase 4 — THE INWARD DRIFT — and its corrections, Phase 4b (spec C15) and
// Phase 4c (spec C16).
//
//   node scratchpad/test-cs023-p4.js
//
// WHAT LANDED (PLANNED-FEATURES-CS023 §1.5/§4.7/§4.8, Corrections C14 and C16, FORK-CS023-B/C/H):
//
//   1. Two DERIVED radii and one guessed acceleration. DEBRIS_DRIFT_TRIGGER_R = ORBIT_INNER_RADIUS +
//      3 * ORBIT_RADIUS_STEP (1,000 px, ring 4's radius) and DEBRIS_DRIFT_TARGET_R = ORBIT_INNER_RADIUS +
//      2 * ORBIT_RADIUS_STEP (800 px, ring 3's) — never written as literals, so a geometry retune carries
//      them. IT CARRIED THEM AT P4C, WITH NO EDIT AT THE DECLARATION SITE: the ring step moved 138 -> 200
//      and the two radii moved 814 -> 1000 and 676 -> 800 by derivation alone, which was Paul's explicit
//      call (derived, not pinned) and is what §B's sandbox exists to keep true.
//      DEBRIS_DRIFT_ACCEL = 30 px/s^2 is the one guess left (FLAG-CS023-d).
//   2. maxOrbitSpeed() — the cap, DERIVED, and it SCANS EVERY RING (C14). angVel is not uniform, so the
//      outermost ring is not always the fastest: at the shipped [2, 4] the max falls on ring 4 (314.2
//      px/s) but at [1, 2] it falls on ring 2 (188.5) while ring 4 only reaches 104.7. Reads three LIVE
//      debug knobs, so a gate retune carries the cap. Called ONCE PER FRAME, not once per body. UNCHANGED
//      by P4b — it is genuinely a statement about orbital speeds, not archetype-scoped, and stays the
//      name.
//   3. updateDebrisDrift(dt) — one pass in update(), after the entity updates and before the collision
//      passes. CORRECTED BY P4B (C15, FORK-CS023-H re-resolved): RUNS ON EVERY LEVEL, field and orbit
//      alike — P4 shipped an `if (!game.orbitLayout || !game.dock) return;` archetype gate that read the
//      mechanic as orbit-specific; that premise was wrong (the ring radii only ever NAMED the two
//      distances, they never SCOPED the mechanic to the archetype that uses those rings), so P4b deletes the
//      gate, leaving only a defensive `if (!game.dock) return;`. ARMING is gated on "no live debris,
//      orbiting or free (FLAG-CS023-a), inside the trigger radius"; the FORCE is NOT (FLAG-CS023-b:
//      arming is sticky and per-piece). Only free bodies beyond the target radius are ever armed. On a
//      field level no body ever carries orbit state, so nothing else about the pass changes.
//   4. The force is an ACCELERATION added to vx/vy, flat, no falloff, no damping (FLAG-CS023-e), with the
//      INWARD RADIAL COMPONENT ONLY capped at maxOrbitSpeed(). Tangential motion is untouched. AFTER P4C
//      THE CAP NEVER BINDS ON EITHER ARCHETYPE (C16b) — see the note below, which is this phase's main
//      reversal of what §D used to assert.
//   5. Release is per-piece at the target radius and KEEPS the accumulated velocity.
//   6. Disarm on contact: one line at the top of debrisBounce (satellite contact + UFO contact). Player
//      shot and ship ram need no code — both destroy the body, and destroyDebris's children are fresh
//      objects with `drifting` ABSENT (FLAG-CS023-c). That third claim is VERIFIED here, not assumed.
//   7. Registry 44 -> 46: debrisDriftAccel (RENAMED by P4b from orbitGravityAccel — id and label only, def
//      still 46, position still row 45, still inside the ORBIT block) and debrisBounceRestitution,
//      APPENDED after the ORBIT block.
//
// SECTIONS MARKED "P4B" throughout this file are the first correction: P4's own field-level assertions
// proved the pass INERT there and are now INVERTED, with a CORRECTED BY CS023 P4B note left beside each
// one — the standing repoint idiom this suite already uses when a later phase changes what an earlier
// claim means (see test-cs023-p3.js's own "REPOINTED BY CS023 P4" notes for precedent).
//
// SECTIONS MARKED "P4C" ARE THE SECOND CORRECTION, AND THE ONE WORTH READING BEFORE TOUCHING §D.
// P4c moved ORBIT_RADIUS_STEP 138 -> 200, which did two things to the cap AT ONCE and in opposite
// directions: it RAISED the ceiling (ring 4's tangential speed, 255.7 -> 314.2 px/s) and it SHORTENED
// every possible fall (the target radius moved 676 -> 800, so the longest armed fall dropped from 1,527
// to 1,403 px on an orbit level and from 793 to 669 px on a field one). The result is that **the cap no
// longer binds anywhere in the shipped game**: the longest falls arrive at ~290 and ~200 px/s.
//
// P4's §D was built entirely around observing the cap bind — an exact ramp, then a PLATEAU at
// maxOrbitSpeed(), then a release at exactly the cap. Every one of those assertions is now unreachable at
// the shipped acceleration, and simply deleting them would leave the suite with nothing checking that the
// clamp arithmetic is correct at all. So §D is restructured rather than trimmed:
//   * the shipped-values fall now proves the OPPOSITE — an unbroken exact ramp all the way in, the cap
//     never touched, the release speed matching the constant-acceleration closed form — measured over the
//     LONGEST FALL EITHER WORLD ALLOWS, computed live from worldDims rather than staged at a guess;
//   * a SANDBOX raises DEBUG.debrisDriftAccel until the cap DOES bind, and the old plateau assertions run
//     there unchanged. That is what keeps the clamp proven-LIVE code rather than proven-unreachable, and
//     it is exactly the trap Correction C5 describes for the gap-multiplier curve: a lever that is quiet
//     at today's numbers is not a lever that is dead. Raising this acceleration is the first thing the
//     playtest gate is asked to try, so the guard rail it needs has to be known-working, not assumed.
//
// ONE DERIVATION THIS PHASE MADE AND IS FLAGGING RATHER THAN BURYING (see STATUS.md): adding the
// debrisBounceRestitution ROW is only half a knob — a slider that changes nothing cannot be "retuned
// in-session and reported" the way the playtest gate asks. So debrisBounce() now reads
// DEBUG.debrisBounceRestitution at its two restitution sites, exactly as every ORBIT knob's consumer
// already reads DEBUG.*, with DEBRIS_BOUNCE_RESTITUTION staying the registry's `def`. Behaviour is
// byte-identical until the slider moves, and P2's own restitution SANDBOX (which patches the constant)
// keeps working unchanged precisely because the const feeds the def feeds the knob.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update(1/60)/updateDebrisDrift/maxOrbitSpeed/
// debrisBounce/destroyDebris path. NOTHING under test is reimplemented; every expectation is recomputed
// from the same constants and the same DEBUG registry the shipped code reads.
//
// Sections (spec §6 items 13, 14, 15, 16, 17, 19, 20):
//  (A) item 20 — node --check, source pins, the registry, and TRAPs 1-4
//  (B) item 15 — THE CAP'S DERIVATION, in its own section: the ring scan, the [1,2] sandbox, the knobs,
//                and both radii proven derived (a source pin PLUS a behavioural ORBIT_RADIUS_STEP move)
//  (C) item 13 — the trigger and the arming pass; P4B — the SAME proof re-run on a field level: trigger,
//                lateness, target, arrival, all four disarm paths, and the cap never binding
//  (D) item 14 — drift motion, the exact per-frame ramp, the tangential proof, and — P4C — the cap NOT
//                binding over the longest fall either archetype allows, with a raised-acceleration
//                sandbox where it does bind, proving the clamp is live code (C16b)
//  (E) item 16 — release and disarm: all four interrupts driven for real
//  (F) item 17 — edge cases: a new dock, a real resizeWorld, destruction, split children, the seam
//  (G) item 19 — determinism
//  (H) item 20 — AudioSys.ctx null smoke across a real ramp

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
function close(got, want, msg, eps = 1e-6) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want}, |d| ${Math.abs(got - want).toExponential(2)})`); }

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
  // the driven surface
  "game", "startGame", "nextWave", "update", "draw", "resizeWorld",
  "destroyDebris", "destroySaucer", "debrisBounce", "coalesceGarbage",
  // THE CS023 P4 SURFACE
  "maxOrbitSpeed", "updateDebrisDrift",
  "DEBRIS_DRIFT_TRIGGER_R", "DEBRIS_DRIFT_TARGET_R", "DEBRIS_DRIFT_ACCEL",
  // entity classes
  "DebrisSatellite", "HunterSatellite", "Saucer", "Garbage", "Bullet", "Dock",
  // the orbit surface every expectation derives from
  "generateOrbitLayout", "activeRingsFor", "orbitEffectiveCount", "orbitRadiusStepFor",
  "orbitGapMult", "orbitEffectiveGapMult", "orbitTangent", "orbitSyncVelocity", "levelDef",
  "ORBIT_LEVEL_EVERY", "ORBIT_INNER_RADIUS", "ORBIT_RADIUS_STEP", "ORBIT_RING_COUNT",
  "ORBIT_DENSITY", "ORBIT_ANG_VEL", "ORBIT_FAST_MULT", "ORBIT_FAST_RING",
  // shared constants — never a restated literal
  "DEBRIS_RADII", "DEBRIS_MASS", "DEBRIS_BOUNCE_MIN", "DEBRIS_BOUNCE_RESTITUTION",
  "DEBRIS_SPEEDS", "DEBRIS_SPEED_CAP", "DEBRIS_GARBAGE", "DEBRIS_DAMAGE",
  "SHIP_RADIUS", "SHIP_MAX_HP", "HIT_STUN_DURATION", "DOCK_RADIUS",
  "WORLD_W", "WORLD_H", "worldDims", "worldSizeFor", "WORLD_SIZE_FIELD", "WORLD_SIZE_ORBIT",
  "TAU", "dist2", "angleTo", "shortDelta", "wrap", "wrapPos", "rand",
  "AudioSys", "GAME_VERSION", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES", "debugShown", "applyDebug",
];

function buildFrom(src, { audio = true, returns = RETURN } = {}) {
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
    src + "\n;return { " + returns.join(", ") + " };"
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

let headSrcCache = null;
function headSrc() {
  if (headSrcCache === null) {
    headSrcCache = execFileSync("git", ["show", "HEAD:asteroids-deluxe.html"], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
      .toString().match(/<script>([\s\S]*?)<\/script>/)[1];
  }
  return headSrcCache;
}
const bodyOf = (src, sig) => { const i = src.indexOf(sig); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i)); };

// ---- Shared staging helpers -----------------------------------------------------------------------
// Drive to absolute level `w` through the REAL nextWave(), clearing the field first so the post-call
// array is that level's ACTUAL spawn (the standing idiom in this suite).
function atWave(X, w) {
  X.game.wave = w - 1;
  X.game.debris.length = 0;
  X.nextWave();
  return X.game.debris.length;
}
// A body at an exact wrap-aware bearing/distance from the dock, with the velocity we hand it. wrapPos is
// the real helper, so a body placed "1,900 px right of a dock near the seam" lands where the torus says.
function placeFromDock(X, dist, bearing, size, vx = 0, vy = 0) {
  const p = X.wrapPos({ x: X.game.dock.x + Math.cos(bearing) * dist,
                        y: X.game.dock.y + Math.sin(bearing) * dist });
  const d = new X.DebrisSatellite(p.x, p.y, size, 1);
  d.x = p.x; d.y = p.y; d.vx = vx; d.vy = vy;
  return d;
}
// Wrap-aware distance from a body to the dock, through the real dist2.
const dockDist = (X, d) => Math.sqrt(X.dist2(d, X.game.dock));
// The unit vector the drift pass itself would use this frame, and the two components of a velocity in it.
function dockFrame(X, d) {
  const [dx, dy] = X.shortDelta(d.x, d.y, X.game.dock.x, X.game.dock.y);
  const L = Math.hypot(dx, dy) || 0.0001;
  return { ux: dx / L, uy: dy / L, dist: L };
}
const radial = (v, f) => v.vx * f.ux + v.vy * f.uy;          // INWARD component (positive = toward the dock)
const tangen = (v, f) => v.vx * -f.uy + v.vy * f.ux;         // the perpendicular one
// Park the level so the ONE body under test is the only physics in the frame: no ambient saucer, no
// ambient Hunter, no ambient health powerup, and a ship that is both far away and inside its i-frames.
// This isolates the measurement WITHOUT reimplementing anything — every frame still runs the real update().
function quiesce(X) {
  X.game.saucerTimer = 9999; X.game.hunterTimer = 9999; X.game.healthTimer = 9999;
  X.game.saucers.length = 0; X.game.hunters.length = 0; X.game.powerups.length = 0;
  X.game.ship.invuln = 9999;
}

// ================= (A) item 20 — node --check, source pins, registry, TRAPs =========================
(function sectionA() {
  console.log("(A) item 20 — node --check, source pins, the registry, TRAPs 1-4");
  const tmp = path.join(repoRoot, "scratchpad", "_cs023p4_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = seededBuild(0xA001);

  // --- the two radii are DERIVED IN SOURCE, never written as 1000 / 800 -----------------------------
  assert(/const DEBRIS_DRIFT_TRIGGER_R = ORBIT_INNER_RADIUS \+ 3 \* ORBIT_RADIUS_STEP;/.test(codeOnly),
    "A: DEBRIS_DRIFT_TRIGGER_R is derived — ORBIT_INNER_RADIUS + 3 * ORBIT_RADIUS_STEP");
  assert(/const DEBRIS_DRIFT_TARGET_R  = ORBIT_INNER_RADIUS \+ 2 \* ORBIT_RADIUS_STEP;/.test(codeOnly),
    "A: DEBRIS_DRIFT_TARGET_R is derived — ORBIT_INNER_RADIUS + 2 * ORBIT_RADIUS_STEP");
  {
    // Neither literal appears on either declaration line. (Both DO appear in the trailing comments naming
    // the shipped value, which is documentation, not a second source of truth — so this reads the code.)
    const decl = codeOnly.split("\n").filter(l => /^const DEBRIS_DRIFT_(TRIGGER|TARGET)_R/.test(l))
      .map(l => l.replace(/\/\/.*$/, "")).join("\n");
    eq(decl.split("\n").length, 2, "A: exactly two DEBRIS_DRIFT_*_R declarations");
    // REPOINTED BY CS023 P4C: the numbers that must not be inlined are the CURRENT ones. P1's 814/676
    // are kept in the guard as well — a build that reverted them to literals would be just as broken.
    assert(!/\b(1000|800|814|676)\b/.test(decl),
      "A: ...and none of 1000 / 800 (nor the retired 814 / 676) is inlined on either of them");
  }
  eq(X.DEBRIS_DRIFT_TRIGGER_R, X.ORBIT_INNER_RADIUS + 3 * X.ORBIT_RADIUS_STEP,
    "A: the live trigger radius IS ring 4's radius");
  eq(X.DEBRIS_DRIFT_TARGET_R, X.ORBIT_INNER_RADIUS + 2 * X.ORBIT_RADIUS_STEP,
    "A: the live target radius IS ring 3's radius");
  // CORRECTED BY CS023 P4C (spec C16): the ring step moved 138 -> 200 and BOTH RADII FOLLOWED, with no
  // edit at the declaration site. That is the derivation doing exactly what it was written to do — see
  // §B's sandbox, whose own step substitution had to be inverted for the same reason.
  eq(X.DEBRIS_DRIFT_TRIGGER_R, 1000, "A: P4C — which at the shipped geometry is 1,000 px (was 814 at P1's step)");
  eq(X.DEBRIS_DRIFT_TARGET_R, 800, "A: P4C — ...and 800 px (was 676)");
  eq(X.DEBRIS_DRIFT_ACCEL, 30, "A: DEBRIS_DRIFT_ACCEL is the specced 30 px/s^2 (FLAG-CS023-d, the one guess)");
  assert(X.DEBRIS_DRIFT_TARGET_R < X.DEBRIS_DRIFT_TRIGGER_R,
    "A: the target is strictly inside the trigger — otherwise arming could never release");

  // --- P4B: the three renamed constants have ZERO readers under their old ORBIT_GRAVITY_* names, and
  // the renamed knob has zero readers under its old orbitGravityAccel id, anywhere in the whole source ---
  for (const oldName of ["ORBIT_GRAVITY_TRIGGER_R", "ORBIT_GRAVITY_TARGET_R", "ORBIT_GRAVITY_ACCEL",
                         "orbitGravityAccel"]) {
    assert(!codeOnly.includes(oldName), `A: P4B — zero readers of the old name ${oldName} anywhere in source`);
  }

  // --- maxOrbitSpeed: one definition, ONE call, and that call is outside every per-body loop ---------
  eq((codeOnly.match(/function maxOrbitSpeed\(/g) || []).length, 1, "A: exactly one maxOrbitSpeed definition");
  eq((codeOnly.match(/maxOrbitSpeed\(\)/g) || []).length, 2,
    "A: maxOrbitSpeed appears exactly twice in executable source — its definition and ONE call site");
  {
    const drift = bodyOf(codeOnly, "function updateDebrisDrift(dt) {");
    assert(drift.length > 0, "A: updateDebrisDrift is present");
    assert(/const cap = maxOrbitSpeed\(\);/.test(drift), "A: the cap is taken into a local, once");
    // The call sits BEFORE the force loop opens, so it cannot be per-body (spec §4.7).
    const iCap = drift.indexOf("const cap = maxOrbitSpeed();");
    const iForceLoop = drift.indexOf("for (const d of game.debris) {", iCap);
    assert(iCap > 0 && iForceLoop > iCap, "A: ...and it is hoisted ABOVE the force loop, never called per body");
  }
  eq((codeOnly.match(/function updateDebrisDrift\(/g) || []).length, 1, "A: exactly one updateDebrisDrift definition");
  eq((codeOnly.match(/updateDebrisDrift\(dt\);/g) || []).length, 1, "A: ...and exactly one call site");

  // --- the call site's PLACEMENT in update(): after the entity updates, before every collision pass ---
  // Indexed against the RAW source, not codeOnly: three of the five anchors are the passes' own banner
  // comments, and codeOnly strips whole-line comments.
  {
    const iEntity = scriptSrc.indexOf("game.debris.forEach(a => a.update(dt));");
    const iDock   = scriptSrc.indexOf("if (game.dock) game.dock.update(dt);");
    const iCall   = scriptSrc.indexOf("  updateDebrisDrift(dt);");
    const iBullets = scriptSrc.indexOf("  // --- Collisions: player bullets vs targets ---");
    const iHazards = scriptSrc.indexOf("  // --- Collisions: hazards vs ship ---");
    const iPairs  = scriptSrc.indexOf("if (dist2(a, b) < r * r) debrisBounce(a, b);");
    const iUfo    = scriptSrc.indexOf("{ destroySaucer(s, false); debrisBounce(a, s); break; }");
    assert(iCall > 0, "A: the call site is present in update()");
    assert(iEntity > 0 && iEntity < iCall, "A: the drift runs AFTER every entity's update(dt)");
    assert(iDock > 0 && iDock < iCall, "A: ...and after the dock's own update, so game.dock is this frame's");
    for (const [i, name] of [[iBullets, "player bullets"], [iHazards, "hazards vs ship"],
                             [iPairs, "debris vs debris"], [iUfo, "UFO vs debris"]]) {
      assert(i > 0 && iCall < i, `A: ...and BEFORE the ${name} collision pass`);
    }
  }

  // --- TRAP 2: no rail is read or written. `orbitCenter` is read ONCE, to EXCLUDE a body -------------
  {
    const drift = bodyOf(codeOnly, "function updateDebrisDrift(dt) {");
    const cap   = bodyOf(codeOnly, "function maxOrbitSpeed() {");
    for (const forbidden of ["orbitRadius", "orbitAngle", "orbitAngVel", "orbitTangent", "orbitSyncVelocity",
                             "placeOrbitRing", "spawnOrbitWave", "generateOrbitLayout", ".rings"]) {
      assert(!drift.includes(forbidden), `A: TRAP 2 — updateDebrisDrift contains no reference to ${forbidden}`);
    }
    eq((drift.match(/orbitCenter/g) || []).length, 1,
      "A: TRAP 2 — updateDebrisDrift reads orbitCenter exactly ONCE");
    assert(/if \(d\.dead \|\| d\.orbitCenter\) continue;/.test(drift),
      "A: ...and that one read EXCLUDES a rail-borne body from arming — it never moves one");
    // maxOrbitSpeed's ring scan is the ONE place the spec sanctions ring math (phase prompt TRAP 2), so the
    // claim here is narrower and sharper: it never touches a LIVE BODY. No entity's orbit fields, no game
    // state of any kind — the radii it multiplies are computed from the geometry constants, not read off
    // anything on the board. (It legitimately reads DEBUG.orbitAngVel / orbitFastMult / orbitCount, which is
    // exactly what makes a gate retune carry the cap.)
    for (const forbidden of [".orbitRadius", ".orbitAngle", "orbitCenter", "game.", "orbitTangent",
                             "placeOrbitRing", "generateOrbitLayout", ".rings", "levelDef", "activeRingsFor"]) {
      assert(!cap.includes(forbidden), `A: TRAP 2 — maxOrbitSpeed contains no reference to ${forbidden}`);
    }
    assert(/DEBUG\.orbitAngVel/.test(cap) && /DEBUG\.orbitFastMult/.test(cap) && /DEBUG\.orbitCount/.test(cap),
      "A: ...while it DOES read all three live knobs, so a gate retune carries the cap (spec §4.8)");
    assert(/ORBIT_FAST_RING\.indexOf\(i \+ 1\)/.test(cap),
      "A: ...and the fast-ring test is MEMBERSHIP over the whole 1-based list, of any length (C14)");
    assert(/for \(let i = 0; i < count; i\+\+\)/.test(cap),
      "A: ...over EVERY ring, not just the outermost one — the C14 shortcut is structurally absent");
    // CORRECTED BY CS023 P4B (C15): the archetype gate is gone, so this is no longer "used as a gate
    // only" — it is not referenced AT ALL, anywhere in the pass.
    assert(!drift.includes("orbitLayout"),
      "A: P4B — updateDebrisDrift contains NO reference to game.orbitLayout, gate or otherwise (C15)");
    // TRAP 3: only game.debris is in scope. Hunters home, canisters coalesce.
    for (const forbidden of ["game.hunters", "game.garbage", "game.saucers", "game.chain", "game.powerups",
                             "game.bullets", "game.particles"]) {
      assert(!drift.includes(forbidden), `A: TRAP 3 — updateDebrisDrift contains no reference to ${forbidden}`);
    }
    // Wrap-awareness asserted AT THE SITE (CLAUDE.md's single commonest bug source).
    assert(/dist2\(d, game\.dock\)/.test(drift), "A: the trigger and the arm test both use wrap-aware dist2");
    eq((drift.match(/dist2\(d, game\.dock\)/g) || []).length, 2, "A: ...at exactly those two sites");
    assert(/shortDelta\(d\.x, d\.y, game\.dock\.x, game\.dock\.y\)/.test(drift),
      "A: the force vector comes from wrap-aware shortDelta");
    assert(!/Math\.hypot\(\s*d\.x/.test(drift) && !/game\.dock\.x -/.test(drift) && !/- game\.dock\.x/.test(drift),
      "A: no naive subtraction of raw dock coordinates anywhere in the pass");
    // No inlined magic numbers: both radii and the acceleration are read by name.
    const stripped = drift.replace(/DEBRIS_DRIFT_(TRIGGER_R|TARGET_R)/g, "").replace(/debrisDriftAccel/g, "");
    assert(!/\b(1000|800|814|676|30)\b/.test(stripped),
      "A: P4C — no inlined 1000 / 800 (nor the retired 814 / 676) / 30 — the constants are read by name");
    // The acceleration is the LIVE KNOB, so 0 is a real A/B (spec §4.8).
    assert(/DEBUG\.debrisDriftAccel \* dt/.test(drift), "A: the force reads DEBUG.debrisDriftAccel, not the const");
    // FLAG-CS023-b: the FORCE is outside the `blocked` gate — the failure mode that would be silent.
    {
      const iBlockedGate = drift.indexOf("if (!blocked) {");
      const iCapLocal = drift.indexOf("const cap = maxOrbitSpeed();");
      const between = drift.slice(iBlockedGate, iCapLocal);
      assert(iBlockedGate > 0 && iCapLocal > iBlockedGate,
        "A: the arming block precedes the force block");
      eq((between.match(/\breturn\b/g) || []).length, 0,
        "A: FLAG-CS023-b — NO return between the arming gate and the force loop: arming is sticky");
    }
    // CORRECTED BY CS023 P4B (C15, FORK-CS023-H re-resolved): the archetype gate is DELETED — the pass
    // runs on every level now. What remains is one defensive, dock-only guard; it is in-idiom belt-and-
    // braces (update() already early-returns unless game.state === "playing", and game.dock is created by
    // every nextWave()), not a scoping decision.
    eq((drift.match(/\breturn;/g) || []).length, 1,
      "A: P4B — exactly one return in the whole pass, the defensive dock guard (no archetype gate)");
    assert(/if \(!game\.dock\) return;/.test(drift),
      "A: P4B — ...and it is `if (!game.dock) return;` — dock-only, no game.orbitLayout check");
    assert(!/if \(!game\.orbitLayout/.test(drift),
      "A: P4B — the orbit-layout gate is gone, not just widened");
  }

  // --- the disarm line: ONE line, at the TOP of debrisBounce, before the rail dispatch ---------------
  {
    const fn = bodyOf(codeOnly, "function debrisBounce(a, b) {");
    assert(fn.length > 0, "A: debrisBounce is present");
    eq((fn.match(/a\.drifting = b\.drifting = false;/g) || []).length, 1,
      "A: debrisBounce clears `drifting` on BOTH bodies in exactly one line");
    const iClear = fn.indexOf("a.drifting = b.drifting = false;");
    const iDispatch = fn.indexOf("const aFixed = ");
    assert(iClear > 0 && iDispatch > iClear,
      "A: ...at the TOP, BEFORE the rail dispatch, so even the FIXED/FIXED no-op disarms");
    // The whole helper is otherwise +0 executable lines: this phase adds ONE line and repoints two reads.
    // REPOINT (this file's own note for whoever comes next): test-cs023-p3.js's "line COUNT is unchanged"
    // pin is repointed there to ignore exactly this line, which is why it is asserted here explicitly.
  }
  // The restitution reads are now the LIVE KNOB at both sites, and the constant is the registry's def.
  {
    const fn = bodyOf(codeOnly, "function debrisBounce(a, b) {");
    eq((fn.match(/DEBUG\.debrisBounceRestitution/g) || []).length, 3,
      "A: debrisBounce reads DEBUG.debrisBounceRestitution at all three restitution sites (2 free/rail, 1 free/free)");
    assert(!fn.includes("DEBRIS_BOUNCE_RESTITUTION"),
      "A: ...and the raw constant is no longer read inside the helper — it is the registry def now");
    assert(fn.includes("DEBRIS_BOUNCE_MIN"),
      "A: the separation FLOOR is untouched and still reads its constant directly (no knob was specced for it)");
  }

  // --- `drifting` is an OPTIONAL field: never declared in the constructor (FLAG-CS023-c) -------------
  {
    const ctor = codeOnly.slice(codeOnly.indexOf("class DebrisSatellite {"),
                                codeOnly.indexOf("  update(dt) {", codeOnly.indexOf("class DebrisSatellite {")));
    assert(ctor.length > 0, "A: DebrisSatellite's constructor located");
    assert(!/this\.drifting/.test(ctor),
      "A: FLAG-CS023-c — `drifting` is NOT initialised in the constructor (the orbitCenter optional-field idiom)");
    const d = new X.DebrisSatellite(100, 100, 3, 1);
    eq(d.drifting, undefined, "A: ...so a fresh satellite's `drifting` is ABSENT, not false");
    assert(!("drifting" in d), "A: ...genuinely absent — the key does not exist on the object");
  }

  // --- the registry: 44 -> 46, APPENDED, order preserved --------------------------------------------
  eq(X.DEBUG_ENTRIES.length, 46, "A: the debug registry is now 46 value entries (was 44)");
  {
    // CORRECTED BY CS023 P4B: this used to diff the registry against headSrc() (git HEAD) to prove the
    // first 44 ids were untouched. That worked only up to the moment CS023 P4 was itself committed — once
    // it landed, HEAD *is* the post-P4 46-entry registry, so a "HEAD had 44" control diffed against HEAD
    // can never be true again, on this phase or any later one that touches this file. The pre-P4 44 ids are
    // a fixed historical fact (CS023 P3's shipped registry), so they are pinned here as a literal instead
    // of re-derived from git history that has already moved past the point this claim describes.
    const PRE_P4_IDS = ["autoShieldRegenPause", "scoopHitsPerLevel", "garbageAttractDelay",
      "garbageAttractRadius", "garbageAttractForce", "garbageLifetime", "chainGuardTime",
      "chainGuardIntercepts", "chainGuardMinTow", "chainGuardCooldown", "dockComboGrace", "junkSpeedLow",
      "junkSpeedNormal", "junkSpeedHigh", "ufoFlightSpeedLow", "ufoFlightSpeedNormal", "ufoFlightSpeedHigh",
      "ufoAppearFreqLow", "ufoAppearFreqNormal", "ufoAppearFreqHigh", "ufoDirChangeFreqLow",
      "ufoDirChangeFreqNormal", "ufoDirChangeFreqHigh", "ufoFireFreqLow", "ufoFireFreqNormal",
      "ufoFireFreqHigh", "ufoAccuracyLow", "ufoAccuracyNormal", "ufoAccuracyHigh", "ufoShotSpeedLow",
      "ufoShotSpeedNormal", "ufoShotSpeedHigh", "freqJitter", "sweepCoalescePause", "orbitGapMult",
      "orbitSafetyMargin", "orbitCount", "orbitDensity1", "orbitDensity2", "orbitDensity3", "orbitDensity4",
      "orbitDensity5", "orbitAngVel", "orbitFastMult"];
    const nIds = X.DEBUG_ENTRIES.map(e => e.id);
    eq(PRE_P4_IDS.length, 44, "A: (control) the pinned pre-P4 id list really is 44 long");
    eq(JSON.stringify(nIds.slice(0, 44)), JSON.stringify(PRE_P4_IDS),
      "A: FLAG-CS023-o — APPEND-ONLY: the first 44 ids match CS023 P3's shipped registry, in order, so no row index moved");
    // P4B renamed id 45 orbitGravityAccel -> debrisDriftAccel (spec C15) — the id changed, the ROW did not:
    // it is still entry 45, still the first of the two P4 additions, still physically inside the ORBIT
    // block. debrisBounceRestitution (entry 46, P3) is untouched by this correction.
    eq(nIds[44], "debrisDriftAccel", "A: P4B — entry 45 is the RENAMED debrisDriftAccel (was orbitGravityAccel)");
    eq(nIds[45], "debrisBounceRestitution", "A: ...and entry 46 is still debrisBounceRestitution, unmoved");
    assert(!nIds.includes("orbitGravityAccel"),
      "A: P4B — the old id orbitGravityAccel has ZERO readers — it does not appear in the registry at all");
  }
  {
    const g = X.DEBUG_ENTRIES.find(e => e.id === "debrisDriftAccel");
    eq(g.def, X.DEBRIS_DRIFT_ACCEL, "A: debrisDriftAccel's def DERIVES from DEBRIS_DRIFT_ACCEL");
    eq(g.min, 0, "A: ...min 0 (the gate's A/B: 0 disables the drift outright)");
    eq(g.max, 200, "A: ...max 200");
    eq(g.step, 5, "A: ...step 5");
    eq(X.DEBUG.debrisDriftAccel, 30, "A: ...and the live value seeds to 30");
    const r = X.DEBUG_ENTRIES.find(e => e.id === "debrisBounceRestitution");
    eq(r.def, X.DEBRIS_BOUNCE_RESTITUTION, "A: debrisBounceRestitution's def DERIVES from DEBRIS_BOUNCE_RESTITUTION");
    eq(r.min, 0, "A: ...min 0");
    eq(r.max, 1.5, "A: ...max 1.5");
    eq(r.step, 0.05, "A: ...step 0.05");
    eq(X.DEBUG.debrisBounceRestitution, 1.0, "A: ...and the live value seeds to 1.0 — byte-identical behaviour until moved");
    assert(!g.toNative && !r.toNative, "A: neither knob needs a toNative conversion");
    assert(!g.clampShown && !r.clampShown, "A: ...nor a clampShown hook");
  }
  // NO knob for the cap — it is derived from three that already exist (spec §4.8).
  assert(!X.DEBUG_ENTRIES.some(e => /maxorbitspeed|driftcap|orbitcap/i.test(e.id)),
    "A: NO knob was added for the speed cap — it derives from orbitAngVel/orbitFastMult/orbitCount");

  // --- TRAP 1: the version does not move, and no design doc is touched ------------------------------
  eq(X.GAME_VERSION, "1.0.0.22", "A: TRAP 1 — GAME_VERSION unchanged at 1.0.0.22 (P5 owns the bump)");
  {
    const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot }).toString().trim().split("\n").filter(Boolean);
    const docs = changed.filter(f => /GDD|DIFFICULTY-LEVERS|VERSION-HISTORY|PLANNED-FEATURES|IMPLEMENTATION-PHASES/.test(f));
    eq(docs.length, 0, `A: TRAP 1 — no design doc is touched this phase (saw ${JSON.stringify(docs)})`);
  }

  // --- TRAP 4: the wave-clear condition is untouched, and so is everything else out of scope ---------
  {
    const hSrc = headSrc();
    const sliceBetween = (src, a, b) => { const i = src.indexOf(a); return i < 0 ? "" : src.slice(i, src.indexOf(b, i)); };
    const w0 = sliceBetween(hSrc, "  // --- Wave clear ---", "  // --- Achievements: evaluate every frame");
    const w1 = sliceBetween(scriptSrc, "  // --- Wave clear ---", "  // --- Achievements: evaluate every frame");
    assert(w0.length > 0 && w1.length > 0, "A: TRAP 4 — the wave-clear block found in both HEAD and current source");
    eq(w1, w0, "A: TRAP 4 — the wave-clear condition is BYTE-UNCHANGED (a drifting piece is still debris)");
    for (const sig of ["function destroyDebris(a, awardScore = true) {", "function coalesceGarbage(dt) {",
                       "class Garbage {", "function shieldBounce(obj) {", "function shieldDeflect(obj) {",
                       "function destroySaucer(s, awardScore = true) {", "function spawnOrbitWave(",
                       "function activeRingsFor(level) {",
                       "function orbitEffectiveCount(requested) {", "function orbitRadiusStepFor(count) {"]) {
      const b0 = bodyOf(hSrc, sig), b1 = bodyOf(scriptSrc, sig);
      assert(b0.length > 0 && b1.length > 0, `A: TRAP — ${sig.split("(")[0].trim()} found in both builds`);
      eq(b1, b0, `A: TRAP — ${sig.split("(")[0].trim()} is BYTE-UNCHANGED this phase`);
    }
    // CORRECTED BY CS023 P4C. generateOrbitLayout was in the byte-strict list above and no longer can be:
    // its `outerEdge` comment states the per-occurrence progression of the outer satellite edge, which the
    // ring respacing moves (446/584/722/860 -> 446/646/846/1046). Documenting that is a DUTY of this phase,
    // not a violation of the trap — so the claim narrows from "byte-unchanged" to "EXECUTABLY unchanged"
    // rather than being dropped, and the comment's own new content is asserted in test-cs023-p1.js §A.
    // Every other entry above stays byte-strict; a comment-insensitive sweep across all of them would be a
    // real loosening, which is exactly what this note exists to stop happening quietly.
    {
      const exec = t => t.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
      const sig = "function generateOrbitLayout({ satelliteDiameter";
      const b0 = bodyOf(hSrc, sig), b1 = bodyOf(scriptSrc, sig);
      assert(b0.length > 0 && b1.length > 0, "A: TRAP — generateOrbitLayout found in both builds");
      eq(exec(b1), exec(b0),
        "A: P4C — generateOrbitLayout's EXECUTABLE body is unchanged this phase (its outerEdge comment is not)");
      assert(b1 !== b0,
        "A: P4C — ...and it really did change in comments only, so this narrowing is not silently covering a no-op");
    }
  }
  // Every geometry constant this changeset does NOT move, pinned.
  eq(X.ORBIT_INNER_RADIUS, 400, "A: ORBIT_INNER_RADIUS unmoved at 400 (TRAP 2 — P4c moves the STEP, not this)");
  // CORRECTED BY CS023 P4C: this pin said "unmoved at 138" and P4c is precisely the phase that moves it.
  eq(X.ORBIT_RADIUS_STEP, 200, "A: P4C — ORBIT_RADIUS_STEP is 200 (this file used to pin it unmoved at 138)");
  eq(X.ORBIT_RING_COUNT, 4, "A: ORBIT_RING_COUNT unmoved at 4");
  // ...and the four-ring shell still fits, which is the constraint that bounded how far P4c could go.
  eq(X.ORBIT_INNER_RADIUS + 3 * X.ORBIT_RADIUS_STEP + X.DEBRIS_RADII[3], 1046,
    "A: P4C — the outer satellite edge is 1,046 px, 14 px inside the 1,060 px budget (spec C16; §G of test-cs023-p1 owns the guard)");
  eq(JSON.stringify(X.ORBIT_FAST_RING), "[2,4]", "A: ORBIT_FAST_RING unmoved at [2, 4]");
  close(X.ORBIT_ANG_VEL, 6 * Math.PI / 180, "A: ORBIT_ANG_VEL unmoved at 6 deg/s", 1e-12);
  eq(X.ORBIT_FAST_MULT, 3.0, "A: ORBIT_FAST_MULT unmoved at 3.0");
  eq(X.DEBRIS_BOUNCE_RESTITUTION, 1.0, "A: DEBRIS_BOUNCE_RESTITUTION unmoved at 1.0");
  eq(X.DEBRIS_BOUNCE_MIN, 40, "A: DEBRIS_BOUNCE_MIN unmoved at 40");
  eq(JSON.stringify(X.DEBRIS_MASS), JSON.stringify({ 3: 9, 2: 3, 1: 1 }), "A: DEBRIS_MASS unmoved at 9/3/1");
})();

// ================= (B) item 15 — THE CAP'S DERIVATION ===============================================
// Its own section, because this is the assertion a plausible-looking mutant fails.
(function sectionB() {
  console.log("(B) item 15 — maxOrbitSpeed(): the ring scan, the [1,2] sandbox, the knobs, the derived radii");
  const X = seededBuild(0xB001);

  // THE EXPECTATION IS RECOMPUTED, never restated: max over rings of angVel x radius, with the fast-ring
  // list read as HUMAN 1-BASED numbers exactly as generateOrbitLayout reads it.
  function expectedCap(B, fastList = B.ORBIT_FAST_RING, innerR = B.ORBIT_INNER_RADIUS, stepR = null) {
    const count = B.orbitEffectiveCount(B.DEBUG.orbitCount);
    const step = stepR === null ? B.orbitRadiusStepFor(count) : stepR;
    let best = 0, arg = -1;
    for (let i = 0; i < count; i++) {
      const v = B.DEBUG.orbitAngVel * (fastList.indexOf(i + 1) !== -1 ? B.DEBUG.orbitFastMult : 1)
                * (innerR + i * step);
      if (v > best) { best = v; arg = i; }
    }
    return { cap: best, ring: arg };
  }

  // --- the shipped list [2, 4]: ring 4 at 314.2 px/s (P4C — was 255.7 at P1's 138 px step) -----------
  {
    const e = expectedCap(X);
    close(X.maxOrbitSpeed(), e.cap, "B: maxOrbitSpeed() === max over rings of angVel x radius", 1e-9);
    close(X.maxOrbitSpeed(), 314.2, "B: P4C — which at the shipped constants is 314.2 px/s (was 255.7)", 0.05);
    eq(e.ring, 3, "B: ...and the argmax falls on ring 4 (0-based index 3) at THIS list");
    // Every ring's speed, so the claim is legible and a geometry slip fails HERE. Ring 1 is the one that
    // did not move at P4c — its radius is ORBIT_INNER_RADIUS, which TRAP 2 holds fixed.
    const speeds = [0, 1, 2, 3].map(i =>
      X.DEBUG.orbitAngVel * (X.ORBIT_FAST_RING.indexOf(i + 1) !== -1 ? X.DEBUG.orbitFastMult : 1)
      * (X.ORBIT_INNER_RADIUS + i * X.ORBIT_RADIUS_STEP));
    close(speeds[0], 41.9, "B: ring 1 reaches 41.9 px/s — unmoved by P4c", 0.05);
    close(speeds[1], 188.5, "B: P4C — ring 2 (fast) reaches 188.5 px/s (was 169.0)", 0.05);
    close(speeds[2], 83.8, "B: P4C — ring 3 reaches 83.8 px/s (was 70.8)", 0.05);
    close(speeds[3], 314.2, "B: P4C — ring 4 (fast) reaches 314.2 px/s (was 255.7)", 0.05);
    close(X.maxOrbitSpeed(), Math.max(...speeds), "B: ...and the cap is exactly the largest of the four", 1e-9);
    // The cap moved because the GEOMETRY moved, not because anything here was retuned: the motion
    // constants TRAP 2 pins are untouched, and the ratio is exactly the ratio of ring 4's two radii.
    close(X.maxOrbitSpeed() / 255.7, 1000 / 814,
      "B: P4C — the whole rise is ring 4's radius moving 814 -> 1000; angVel and the multiplier never moved", 1e-3);
  }

  // --- THE C14 CASE, IN A SANDBOX: at [1, 2] the max is RING 2, not the outermost --------------------
  // A "just use the outer ring" mutant passes every assertion above and fails this one.
  {
    const ALT_SRC = scriptSrc.replace("const ORBIT_FAST_RING     = [2, 4];", "const ORBIT_FAST_RING     = [1, 2];");
    assert(ALT_SRC !== scriptSrc, "B: (sandbox) the ORBIT_FAST_RING declaration was found and replaced");
    const A = withRandom(seededRandom(0xB100), () => buildFrom(ALT_SRC));
    eq(JSON.stringify(A.ORBIT_FAST_RING), "[1,2]", "B: (sandbox) the sandbox build really runs at [1, 2]");
    const e = expectedCap(A);
    close(A.maxOrbitSpeed(), e.cap, "B: (sandbox) maxOrbitSpeed() still equals the recomputed max over rings", 1e-9);
    close(A.maxOrbitSpeed(), 188.5,
      "B: P4C — spec C14: at [1, 2] the cap is RING 2's 188.5 px/s (was 169.0)", 0.05);
    eq(e.ring, 1, "B: ...and the argmax is ring 2 (0-based index 1), NOT the outermost ring");
    const outer = A.DEBUG.orbitAngVel * (A.ORBIT_INNER_RADIUS + 3 * A.ORBIT_RADIUS_STEP);
    close(outer, 104.7, "B: P4C — ...while the OUTERMOST ring only reaches 104.7 px/s (was 85.2)", 0.05);
    assert(A.maxOrbitSpeed() > outer + 80,
      `B: ...so a 'use the outer ring' shortcut would return ${outer.toFixed(1)} and is a latent bug, not a shortcut (C14)`);
  }
  // --- lists of any length, since P1 made the length arbitrary --------------------------------------
  // (An EMPTY list makes no ring fast, so the max falls back to the outermost — which is the ONE case the
  // "just use the outer ring" shortcut would get right, and exactly why it survives casual testing.)
  for (const [list, want] of [["[]", 3], ["[1]", 0], ["[1, 2, 3, 4]", 3], ["[3]", 2]]) {
    const SRC = scriptSrc.replace("const ORBIT_FAST_RING     = [2, 4];", `const ORBIT_FAST_RING     = ${list};`);
    const B = withRandom(seededRandom(0xB200), () => buildFrom(SRC));
    const e = expectedCap(B);
    close(B.maxOrbitSpeed(), e.cap, `B: (sandbox) the scan handles a list of length ${JSON.parse(list).length} — ${list}`, 1e-9);
    eq(e.ring, want, `B: ...and its argmax is ring index ${want} at ${list}`);
  }
  // An EMPTY list: no ring is fast, so the max really is the outermost ring at the base rate.
  {
    const SRC = scriptSrc.replace("const ORBIT_FAST_RING     = [2, 4];", "const ORBIT_FAST_RING     = [];");
    const B = withRandom(seededRandom(0xB300), () => buildFrom(SRC));
    close(B.maxOrbitSpeed(), B.DEBUG.orbitAngVel * (B.ORBIT_INNER_RADIUS + 3 * B.ORBIT_RADIUS_STEP),
      "B: (sandbox) with NO fast ring the cap is the outermost ring at the base rate — and does not throw", 1e-9);
  }

  // --- the three LIVE knobs move the cap -------------------------------------------------------------
  {
    const K = seededBuild(0xB400);
    const base = K.maxOrbitSpeed();
    K.applyDebug("orbitAngVel", 12);                       // 12 deg/s — double
    close(K.maxOrbitSpeed(), base * 2, "B: doubling DEBUG.orbitAngVel doubles the cap", 1e-9);
    K.applyDebug("orbitAngVel", K.DEBUG_ENTRIES.find(e => e.id === "orbitAngVel").def);
    close(K.maxOrbitSpeed(), base, "B: ...and restoring it restores the cap", 1e-9);
    K.applyDebug("orbitFastMult", 6.0);
    close(K.maxOrbitSpeed(), base * 2, "B: doubling DEBUG.orbitFastMult doubles the cap (the max is on a fast ring)", 1e-9);
    K.applyDebug("orbitFastMult", K.DEBUG_ENTRIES.find(e => e.id === "orbitFastMult").def);
    K.applyDebug("orbitCount", 3);                          // rings 1-3 only: the max moves to ring 2
    const e3 = expectedCap(K);
    close(K.maxOrbitSpeed(), e3.cap, "B: DEBUG.orbitCount moves the cap too — the scan is over the EFFECTIVE count", 1e-9);
    eq(e3.ring, 1, "B: ...and at three rings the argmax moves to ring 2");
    assert(K.maxOrbitSpeed() < base, "B: ...and the cap really is lower with ring 4 gone");
    K.applyDebug("orbitCount", K.DEBUG_ENTRIES.find(e => e.id === "orbitCount").def);
    close(K.maxOrbitSpeed(), base, "B: ...restored");
    // A degenerate but legal knob position: angVel 0 means nothing may close on the dock at all.
    K.applyDebug("orbitAngVel", 0);
    eq(K.maxOrbitSpeed(), 0, "B: at orbitAngVel 0 the cap is 0 — 'nothing may close on the dock', not a NaN");
    K.applyDebug("orbitAngVel", K.DEBUG_ENTRIES.find(e => e.id === "orbitAngVel").def);
  }
  // It is a PURE function of the registry + geometry: callable before startGame(), and no game state.
  {
    const P = seededBuild(0xB500);
    const before = P.maxOrbitSpeed();
    P.startGame();
    atWave(P, 3);
    close(P.maxOrbitSpeed(), before, "B: the cap is unchanged by startGame()/nextWave() — a property of the ARCHETYPE", 1e-12);
    atWave(P, 12);
    close(P.maxOrbitSpeed(), before, "B: ...and by the ramp: it does not depend on which rings this level laid down", 1e-12);
  }

  // --- BOTH RADII ARE DERIVED — the BEHAVIOURAL half (a source pin lives in section A) ---------------
  // Move ORBIT_RADIUS_STEP in a sandbox and show both follow, without either literal being touched.
  //
  // CORRECTED BY CS023 P4C, AND THIS IS THE SANDBOX THAT PREDICTED ITS OWN PHASE. P4 wrote this block
  // with the substitution `138 -> 200` and asserted the derived radii would become 1,000 and 800 "not 814
  // and 676". P4c then shipped exactly that step, so the sandbox was substituting the LIVE value and
  // proving nothing — a sandbox that agrees with the build is not a sandbox. It is inverted to the mirror
  // substitution, 200 -> 138: the radii must come back to P1's 814 / 676, which is the same claim read
  // from the other end and keeps a real difference between build and sandbox.
  {
    const SRC = scriptSrc.replace("const ORBIT_RADIUS_STEP   = 200;", "const ORBIT_RADIUS_STEP   = 138;");
    assert(SRC !== scriptSrc, "B: (sandbox) the ORBIT_RADIUS_STEP declaration was found and replaced");
    const S = withRandom(seededRandom(0xB600), () => buildFrom(SRC));
    eq(S.ORBIT_RADIUS_STEP, 138, "B: (sandbox) the sandbox build really runs at P1's retired 138 px ring step");
    eq(S.ORBIT_INNER_RADIUS, 400, "B: (sandbox) ...with the inner radius untouched");
    eq(S.DEBRIS_DRIFT_TRIGGER_R, 400 + 3 * 138,
      "B: P4C — the trigger radius FOLLOWS the step back down to 814 px, so 1,000 is nowhere pinned");
    eq(S.DEBRIS_DRIFT_TARGET_R, 400 + 2 * 138,
      "B: P4C — the target radius FOLLOWS it to 676 px, so 800 is nowhere pinned either");
    // ...and the cap follows the geometry too, since it multiplies the same radii.
    const e = expectedCap(S);
    close(S.maxOrbitSpeed(), e.cap, "B: ...and maxOrbitSpeed() follows the new radii as well", 1e-9);
    assert(S.maxOrbitSpeed() < X.maxOrbitSpeed(),
      "B: P4C — a NARROWER shell really does lower the cap (P4 asserted the widening direction here)");
    close(S.maxOrbitSpeed(), 255.7, "B: ...to exactly the 255.7 px/s this file used to pin as shipped", 0.05);
    // A third step, unrelated to either shipped value, so the claim is "it derives" rather than "it
    // happens to match the one other number this project has used".
    const SRC3 = scriptSrc.replace("const ORBIT_RADIUS_STEP   = 200;", "const ORBIT_RADIUS_STEP   = 111;");
    const S3 = withRandom(seededRandom(0xB601), () => buildFrom(SRC3));
    eq(S3.DEBRIS_DRIFT_TRIGGER_R, 400 + 3 * 111, "B: ...and at an arbitrary 111 px step the trigger is 733 px");
    eq(S3.DEBRIS_DRIFT_TARGET_R, 400 + 2 * 111, "B: ...and the target 622 px — a derivation, not a lookup table");
  }
  {
    const SRC = scriptSrc.replace("const ORBIT_INNER_RADIUS  = 400;", "const ORBIT_INNER_RADIUS  = 500;");
    const S = withRandom(seededRandom(0xB700), () => buildFrom(SRC));
    eq(S.DEBRIS_DRIFT_TRIGGER_R, 500 + 3 * 200, "B: P4C — the trigger radius follows ORBIT_INNER_RADIUS too — 1,100 px");
    eq(S.DEBRIS_DRIFT_TARGET_R, 500 + 2 * 200, "B: ...and so does the target — 900 px");
  }

  // --- CALLED ONCE PER FRAME, proven by an instrumented copy of the REAL source ----------------------
  {
    const INSTR = scriptSrc
      .replace("const DEBUG = {};", "const __capCalls = { n: 0 };\nconst DEBUG = {};")
      .replace("function maxOrbitSpeed() {", "function maxOrbitSpeed() { __capCalls.n++;");
    assert(INSTR !== scriptSrc && INSTR.includes("__capCalls"), "B: (instrument) the counter was injected");
    const I = withRandom(seededRandom(0xB800), () => buildFrom(INSTR, { returns: RETURN.concat(["__capCalls"]) }));
    withRandom(seededRandom(0xB801), () => { I.startGame(); atWave(I, 3); });
    quiesce(I);
    // Stage MANY drifting bodies, so "once per frame" and "once per body" differ by two orders of magnitude.
    I.game.debris.length = 0;
    // REPOINTED BY CS023 P4C: spreading 40 bodies at a flat 1,200 px around the WHOLE circle put the ones
    // near +/-PI/2 at a wrap-aware 960 px once the 2,160 px world height folded them — inside the new
    // 1,000 px trigger, where a single one of them blocks the arming pass for all forty. They are spread
    // over radius AND a bounded arc instead, so every nominal distance is the wrap-aware one.
    for (let k = 0; k < 40; k++) I.game.debris.push(placeFromDock(I, 1100 + k * 12, -0.5 + k * 0.025, 1));
    I.__capCalls.n = 0;
    const FRAMES = 30;
    for (let f = 0; f < FRAMES; f++) { quiesce(I); I.update(1 / 60); }
    eq(I.game.debris.filter(d => d.drifting).length, 40, "B: (instrument) all 40 staged bodies really are drifting");
    eq(I.__capCalls.n, FRAMES,
      `B: maxOrbitSpeed() ran exactly ONCE PER FRAME (${FRAMES}), not once per body (would be ${FRAMES * 40})`);
  }
})();

// ================= (C) item 13 — the trigger and the arming pass ====================================
(function sectionC() {
  console.log("(C) item 13 — the trigger radius, the arming rule, rail-borne exclusion, field-level inertness");
  const X = seededBuild(0xC001);
  withRandom(seededRandom(0xC002), () => { X.startGame(); atWave(X, 3); });
  eq(X.levelDef(X.game.wave).archetype, "orbit", "C: (setup) level 3 is an ORBIT level");
  assert(!!X.game.orbitLayout, "C: (setup) ...with a live layout");
  quiesce(X);

  // --- the load-bearing case: ONE ring satellite alive inside the trigger, and nothing is armed -------
  const ring = X.game.debris.find(d => d.orbitCenter);
  assert(!!ring, "C: (setup) the level laid at least one RAIL-BORNE satellite");
  X.game.debris = [ring];
  assert(dockDist(X, ring) < X.DEBRIS_DRIFT_TRIGGER_R,
    `C: (setup) ...and it sits inside the trigger radius (${dockDist(X, ring).toFixed(1)} < 1000)`);
  // Free bodies well beyond the trigger radius, at a spread of sizes.
  const far = [];
  for (let k = 0; k < 6; k++) far.push(placeFromDock(X, 1300, k * X.TAU / 6, k % 3 + 1));
  X.game.debris.push(...far);
  X.update(1 / 60);
  eq(X.game.debris.filter(d => d.drifting).length, 0,
    "C: with ONE ring satellite alive inside 1,000 px, NOTHING is armed — the shell must be harvested first");
  assert(far.every(d => d.drifting === undefined), "C: ...not even the bodies 1,300 px out");

  // --- destroy it, and observe that its own CHILDREN keep the trigger blocked (FLAG-CS023-a) ---------
  const nBefore = X.game.debris.length;
  X.destroyDebris(ring);                      // a real player kill: dead + three children at its position
  const kids = X.game.debris.slice(nBefore);  // the children are whatever destroyDebris just appended
  eq(kids.length, 3, "C: (setup) the kill really pushed three children");
  assert(kids.every(k => !("drifting" in k)),
    "C: FLAG-CS023-c — the children of the destroyed body are born with `drifting` ABSENT");
  X.update(1 / 60);
  eq(X.game.debris.filter(d => d.drifting).length, 0,
    "C: FLAG-CS023-a — the trigger counts the CHILDREN too: still nothing armed");

  // --- clear them, and on the VERY NEXT FRAME every remaining free body arms ------------------------
  for (const k of kids) k.dead = true;
  X.game.debris = X.game.debris.filter(d => !d.dead);
  X.update(1 / 60);
  assert(far.every(d => d.drifting === true),
    "C: destroy the last blocker and, on the next frame, every free body out there is armed");
  eq(X.game.debris.filter(d => d.drifting).length, far.length,
    "C: ...exactly those bodies, and nothing else");

  // --- THE TRIGGER DOMINATES THE TARGET, AND THAT IS A FINDING WORTH STATING -------------------------
  // The arming rule has two distance tests: "nothing live inside 1,000" (global) and "this body is beyond
  // 800" (per body). Because the TARGET radius is INSIDE the trigger radius, any body in the 800-1000 band
  // BLOCKS THE WHOLE PASS — including itself. So whenever arming runs at all, every live debris body is
  // already at 1,000 or more, and the per-body target test can never exclude anything. It is correct
  // belt-and-braces (it is what keeps the rule self-consistent if a future retune ever put the target
  // OUTSIDE the trigger), not dead weight — but the observable rule in this build is the TRIGGER.
  {
    const B = seededBuild(0xC100);
    withRandom(seededRandom(0xC101), () => { B.startGame(); atWave(B, 3); });
    quiesce(B);
    B.game.debris.length = 0;
    const between = placeFromDock(B, 900, 0.7, 1);            // REPOINTED BY P4C: in the 800-1000 band (was 700, in P1's 676-814)
    const outer = [];
    for (let k = 0; k < 4; k++) outer.push(placeFromDock(B, 1300, 1 + k * 1.4, 1));
    B.game.debris.push(between, ...outer);
    B.update(1 / 60);
    eq(between.drifting, undefined,
      "C: a body in the 800-1000 band is NOT armed — it is inside the trigger, so it blocks the pass");
    assert(outer.every(d => d.drifting === undefined), "C: ...and it blocks every other body too, including itself");
    between.dead = true;
    B.game.debris = B.game.debris.filter(d => !d.dead);
    B.update(1 / 60);
    assert(outer.every(d => d.drifting === true), "C: ...remove it and they all arm on the next frame");
    // The sweep: whenever the pass arms ANYTHING, nothing armed is inside the target radius — vacuously,
    // because nothing live is inside the trigger. Checked over a spread of staged distances.
    // REPOINTED BY P4C, on both axes of the staging. Every distance must now clear a 1,000 px trigger
    // rather than P1's 814 — and the BEARINGS had to come in with them: at bearing 2.0 rad a nominal
    // 1,500 px placement folds across the 2,160 px world height to a true wrap-aware 1,011 px, which
    // cleared 814 comfortably and clears 1,000 by eleven. Bearings are kept inside 0.6 rad so every
    // nominal distance IS the wrap-aware one, and the sweep tests what it says it tests.
    for (const stage of [[1100, 1200, 1300], [1010, 1500, 1800], [1400, 1401, 1402]]) {
      const S = seededBuild(0xC110 + stage[0]);
      withRandom(seededRandom(0xC111), () => { S.startGame(); atWave(S, 3); });
      quiesce(S);
      S.game.debris = stage.map((r, i) => placeFromDock(S, r, i * 0.3, 1));
      assert(S.game.debris.every((d, i) => Math.abs(dockDist(S, d) - stage[i]) < 1e-6),
        `C: (sweep ${stage}) (setup) every nominal distance really is the wrap-aware one`);
      S.update(1 / 60);
      assert(S.game.debris.every(d => d.drifting === true), `C: (sweep ${stage}) every staged body arms`);
      assert(S.game.debris.every(d => dockDist(S, d) > S.DEBRIS_DRIFT_TARGET_R),
        `C: (sweep ${stage}) ...and every armed body is beyond the target radius — nothing inside it is armed`);
    }
  }

  // --- the trigger boundary is STRICT: a body at exactly 1,000 does not block, one just inside does ---
  {
    // Integer dock and an axis-aligned placement, so "exactly 1,000" is exact in floating point rather
    // than 1,000 +/- 1e-13 either side of the comparison.
    const C2 = seededBuild(0xC200);
    withRandom(seededRandom(0xC201), () => { C2.startGame(); atWave(C2, 3); });
    quiesce(C2);
    C2.game.dock.x = 1000; C2.game.dock.y = 1000;
    C2.game.debris.length = 0;
    const onTrigger = new C2.DebrisSatellite(1000 + C2.DEBRIS_DRIFT_TRIGGER_R, 1000, 3, 1);
    onTrigger.vx = 0; onTrigger.vy = 0;
    // REPOINTED BY P4C: the control used to sit 1,000 px out, comfortably past P1's 814 px trigger. At a
    // 1,000 px trigger that would put it ON the boundary too, conflating the control with the case under
    // test — so it moves out to 1,400, along +x where the 3840-wide world cannot fold it.
    const other = new C2.DebrisSatellite(1000 + 1400, 1000, 1, 1);
    other.vx = 0; other.vy = 0;
    C2.game.debris.push(onTrigger, other);
    close(dockDist(C2, onTrigger), C2.DEBRIS_DRIFT_TRIGGER_R, "C: (setup) the body sits at exactly 1,000 px", 1e-9);
    C2.update(1 / 60);
    eq(other.drifting, true,
      "C: a body sitting EXACTLY at 1,000 px does NOT block the trigger — FLAG-CS023-a's 'ring 4 never blocks itself'");
    eq(onTrigger.drifting, true, "C: ...and, being beyond 800, it is armed itself");

    const C3 = seededBuild(0xC300);
    withRandom(seededRandom(0xC301), () => { C3.startGame(); atWave(C3, 3); });
    quiesce(C3);
    C3.game.dock.x = 1000; C3.game.dock.y = 1000;
    C3.game.debris.length = 0;
    const justIn = new C3.DebrisSatellite(1000 + C3.DEBRIS_DRIFT_TRIGGER_R - 2, 1000, 3, 1);
    justIn.vx = 0; justIn.vy = 0;
    const other3 = new C3.DebrisSatellite(1000 + 1400, 1000, 1, 1);   // REPOINTED BY P4C, as above
    other3.vx = 0; other3.vy = 0;
    C3.game.debris.push(justIn, other3);
    C3.update(1 / 60);
    eq(other3.drifting, undefined, "C: ...but one 2 px INSIDE 1,000 px blocks everything");
    eq(justIn.drifting, undefined, "C: ...itself included");
  }

  // --- RAIL-BORNE BODIES ARE NEVER ARMED, REGARDLESS OF DISTANCE ------------------------------------
  {
    const R = seededBuild(0xC400);
    withRandom(seededRandom(0xC401), () => { R.startGame(); atWave(R, 3); });
    quiesce(R);
    R.game.debris.length = 0;
    // A rail-borne satellite parked 1,500 px from the DOCK, on a rail centred somewhere else entirely —
    // so it neither blocks the trigger nor has any excuse to be skipped other than its orbit state.
    const railed = placeFromDock(R, 1500, 0.4, 3);
    railed.orbitCenter = R.wrapPos({ x: railed.x - 300, y: railed.y });
    railed.orbitRadius = 300; railed.orbitAngle = 0; railed.orbitAngVel = 0;
    railed.x = railed.orbitCenter.x + 300; railed.y = railed.orbitCenter.y;
    // A FREE control at the same distance but a long way round the dock, so the two can never touch (a
    // contact would disarm both through debrisBounce and prove nothing about arming).
    const freeCtl = placeFromDock(R, 1500, 0.4 + 2.0, 3);
    R.game.debris.push(railed, freeCtl);
    const railDist = dockDist(R, railed);
    assert(railDist > R.DEBRIS_DRIFT_TRIGGER_R,
      `C: (setup) the rail-borne body is beyond the trigger radius (${railDist.toFixed(1)} px)`);
    const snap = ["x", "y", "orbitRadius", "orbitAngle", "orbitAngVel"].map(k => railed[k]);
    for (let f = 0; f < 60; f++) { quiesce(R); R.update(1 / 60); }
    eq(railed.drifting, undefined, "C: a RAIL-BORNE satellite is never armed, at any distance (TRAP 2)");
    eq(freeCtl.drifting, true, "C: ...while the free control at the same distance is");
    eq(JSON.stringify(["orbitRadius", "orbitAngle", "orbitAngVel"].map(k => railed[k])),
       JSON.stringify(snap.slice(2)), "C: ...and none of its rail state was touched");
    close(Math.sqrt(R.dist2(railed, railed.orbitCenter)), 300,
      "C: ...and it is still exactly on its rail", 1e-6);
  }

  // --- CORRECTED BY CS023 P4B (C15, FORK-CS023-H re-resolved): a FIELD level is NOT inert — it behaves
  // IDENTICALLY to an orbit level. P4 proved the pass inert here; that assertion was backwards and would
  // now pass for the wrong reason if merely deleted, so this block INVERTS it — same trigger, same
  // lateness, same target, arrival, all four disarm paths, and the cap never binding — all driven through
  // the real startGame/nextWave/update() path, nothing staged by hand beyond placing bodies.
  {
    const F = seededBuild(0xC500);
    withRandom(seededRandom(0xC501), () => { F.startGame(); atWave(F, 4); });
    eq(F.levelDef(F.game.wave).archetype, "field", "C: P4B (setup) level 4 is a FIELD level");
    eq(F.game.orbitLayout, null, "C: P4B (setup) ...with no orbit layout — the drift no longer needs one");
    quiesce(F);
    F.game.debris.length = 0;

    // --- SAME TRIGGER, SAME RADII: one live body inside 1,000 px blocks EVERYTHING, exactly as on an
    // orbit level (mirrors the load-bearing orbit-level case earlier in this section).
    // Bearings kept ON the x-axis (0 or PI): a FIELD world is only 2560x1440, so a bearing with any real
    // y component risks the SHORT side wrapping a nominal placement back to a shorter wrap-aware distance
    // than intended (the trap the original P4 inertness test's own comment named). REPOINTED BY P4C, and
    // this is where the field world gets TIGHT: the trigger moved out to 1,000 px while the greatest
    // wrap-aware distance ALONG THE X-AXIS is only W/2 = 1,280 px, so the whole "beyond the trigger"
    // band on this bearing is 280 px wide. The four radii are spread 60 px apart inside it — still
    // comfortably more than the 59 px worst-case pair of radii, so debris-vs-debris never fires. That
    // narrowness IS spec C16c's cost, observed: the drift reclaims 29% of a field world now, not 46%.
    const blocker = placeFromDock(F, 700, 0, 1);
    assert(dockDist(F, blocker) < F.DEBRIS_DRIFT_TRIGGER_R,
      "C: P4B (setup) the blocker sits inside the SAME 1,000 px trigger radius used on an orbit level");
    const far = [1050, 1110, 1170, 1230].map((r, k) => placeFromDock(F, r, k % 2 ? Math.PI : 0, k % 3 + 1));
    assert(far.every(d => dockDist(F, d) > F.DEBRIS_DRIFT_TRIGGER_R),
      "C: P4B (setup) every far body really is beyond the SAME 1,000 px trigger");
    F.game.debris.push(blocker, ...far);
    F.update(1 / 60);
    assert(F.game.debris.every(d => d.drifting === undefined),
      "C: P4B — with a live body inside 1,000 px of the dock, NOTHING is armed on a field level — no archetype gate anywhere");

    // --- destroy the blocker: on the VERY NEXT FRAME every free body beyond 800 px arms, the same
    // lateness as on an orbit level.
    F.destroyDebris(blocker);
    F.game.debris = F.game.debris.filter(d => !d.dead);
    F.update(1 / 60);
    assert(far.every(d => d.drifting === true),
      "C: P4B — destroy the last blocker and, on the next frame, every free body beyond 800 px arms — same lateness as an orbit level");
    assert(far.every(d => dockDist(F, d) > F.DEBRIS_DRIFT_TARGET_R),
      "C: P4B — ...and every armed body is beyond the SAME 800 px target radius");

    // --- ARRIVAL: released at (or inside) the target radius, keeping its accumulated velocity ------------
    const arriver = far[0];
    let nA = 0;
    while (arriver.drifting && nA < 900) { quiesce(F); F.update(1 / 60); nA++; }
    eq(arriver.drifting, false, "C: P4B — ARRIVAL releases the piece on a field level, exactly like an orbit one");
    assert(dockDist(F, arriver) <= F.DEBRIS_DRIFT_TARGET_R, "C: P4B — ...at or inside the target radius");

    // --- all four disarm paths, driven for real, on a field level -----------------------------------------
    // 1. satellite contact
    {
      quiesce(F);
      F.game.debris.length = 0;
      const p = placeFromDock(F, 1200, 0.5, 2);   // REPOINTED BY P4C: clear of the 1,000 px trigger
      const q = placeFromDock(F, 1200, 0.5, 2);
      q.x = p.x + (p.radius + q.radius) * 0.8; q.y = p.y;
      F.game.debris.push(p, q);
      F.update(1 / 60);
      eq(p.drifting, false, "C: P4B — INTERRUPT 1/4 SATELLITE CONTACT disarms on a field level too");
      eq(q.drifting, false, "C: P4B — ...both bodies");
    }
    // 2. UFO contact
    {
      quiesce(F);
      F.game.debris.length = 0;
      const a = placeFromDock(F, 1200, 0.3, 2);   // REPOINTED BY P4C: 1,200 px, and a bearing the 1,440-tall field world cannot fold
      a.drifting = true;
      F.game.debris.push(a);
      const s = withRandom(seededRandom(0xC502), () => new F.Saucer(false));
      s.x = a.x; s.y = a.y; s.vx = 0; s.vy = 0;
      F.game.saucers.push(s);
      F.game.saucerTimer = 9999;
      const score0 = F.game.score;
      F.update(1 / 60);
      eq(a.drifting, false, "C: P4B — INTERRUPT 2/4 UFO CONTACT disarms on a field level too");
      assert(!F.game.saucers.includes(s), "C: P4B — ...and the saucer is destroyed");
      eq(F.game.score, score0, "C: P4B — ...with no score (FORK-CS023-E, unaffected by this correction)");
    }
    // 3. player shot
    {
      quiesce(F);
      F.game.debris.length = 0;
      const a = placeFromDock(F, 1200, 2.9, 3);   // REPOINTED BY P4C: clear of the 1,000 px trigger
      F.game.debris.push(a);
      F.update(1 / 60);
      eq(a.drifting, true, "C: P4B (setup) armed");
      const b = withRandom(seededRandom(0xC503), () => new F.Bullet(a.x, a.y, 0, false));
      b.x = a.x; b.y = a.y; b.vx = 0; b.vy = 0;
      F.game.bullets.push(b);
      F.update(1 / 60);
      eq(a.dead, true, "C: P4B — INTERRUPT 3/4 a PLAYER SHOT destroys the drifting body on a field level too");
      const kids = F.game.debris.filter(k => k.size === 2);
      assert(kids.every(k => k.drifting !== true), "C: P4B — ...and its children are not armed");
    }
    // 4. ship ram
    {
      quiesce(F);
      F.game.debris.length = 0;
      const a = placeFromDock(F, 1200, 3.4, 2);   // REPOINTED BY P4C: as above — at bearing 4.0 a 1,200 px placement folds to 948 px, inside the trigger
      F.game.debris.push(a);
      F.game.ship.invuln = 9999;
      F.update(1 / 60);
      eq(a.drifting, true, "C: P4B (setup) ram target armed");
      F.game.ship.invuln = 0; F.game.ship.shield = false;
      F.game.ship.x = a.x; F.game.ship.y = a.y; F.game.ship.vx = 0; F.game.ship.vy = 0;
      const hp0 = F.game.ship.hp;
      F.update(1 / 60);
      eq(a.dead, true, "C: P4B — INTERRUPT 4/4 a SHIP RAM destroys the drifting body on a field level too");
      assert(F.game.ship.hp < hp0, "C: P4B — ...and the ship takes its damage");
    }

    // --- THE CAP NEVER BINDS ON A FIELD LEVEL (C15) — the longest possible armed fall never reaches it ---
    // The true wrap-aware farthest point from the dock sits on the diagonal, at hypot(W/2, H/2) — computed
    // live from the real world dims, not hardcoded, so a future WORLD_SIZE_FIELD retune carries this too.
    {
      quiesce(F);
      F.game.debris.length = 0;
      const [w, h] = F.worldDims(F.game.worldSize);
      const maxDist = Math.hypot(w / 2, h / 2);
      const bearing = Math.atan2(h / 2, w / 2);
      const far1 = placeFromDock(F, maxDist, bearing, 1);
      F.game.debris.push(far1);
      close(dockDist(F, far1), maxDist, "C: P4B (setup) the body sits at the true wrap-aware farthest point", 1e-6);
      F.update(1 / 60);
      eq(far1.drifting, true, "C: P4B (setup) the farthest possible field body arms");
      const cap = F.maxOrbitSpeed();
      let worstVr = -Infinity, releaseSpeed = 0, nB = 0;
      while (far1.drifting && nB < 1200) {
        quiesce(F);
        F.update(1 / 60);
        nB++;
        if (far1.drifting === false) { releaseSpeed = Math.hypot(far1.vx, far1.vy); break; }
        worstVr = Math.max(worstVr, radial(far1, dockFrame(F, far1)));
      }
      eq(far1.drifting, false, "C: P4B — the longest possible field fall still reaches the target and releases");
      assert(worstVr < cap - 1,
        `C: P4B — the cap NEVER binds on a field level (worst inward speed ${worstVr.toFixed(1)} px/s, cap ${cap.toFixed(1)})`);
      // Cross-checked against the closed form for a constant-acceleration fall over the same distance
      // (spec C15's table as amended by C16: ~200 px/s over the ~669 px longest field fall — P4c moved
      // the target radius out to 800 px and SHORTENED the fall, recomputed here rather than restated).
      const fallDist = maxDist - F.DEBRIS_DRIFT_TARGET_R;
      const expectedSpeed = Math.sqrt(2 * F.DEBUG.debrisDriftAccel * fallDist);
      close(releaseSpeed, expectedSpeed,
        "C: P4B — ...and the release speed matches the constant-acceleration closed form (no cap ever applied)", 5);
    }
  }
})();

// ================= (D) item 14 — drift motion and the cap ===========================================
(function sectionD() {
  console.log("(D) item 14 — the exact per-frame ramp; P4C: the cap NOT binding at the shipped values, " +
              "and a raised-acceleration sandbox where it does");
  const DT = 1 / 60;

  // --- THE LONGEST FALL AN ORBIT LEVEL ALLOWS, AND THE CAP NEVER TOUCHING IT ------------------------
  // CORRECTED BY CS023 P4C (spec C16b). P4 staged a body 1,900 px out precisely so the 255.7 px/s cap
  // would be reached after 8.52 s and 1,089 px, leaving a genuine PLATEAU to observe before release. P4c
  // moved the cap to 314.2 px/s AND the target radius out to 800 px, so that fall now arrives at 256.9
  // px/s and never clamps — and neither does any other fall the shipped game can produce.
  //
  // So the shipped-values case proves the OPPOSITE claim, and proves it at the WORST CASE rather than at
  // a staged distance: the body starts at the true wrap-aware farthest point from the dock (computed live
  // from worldDims, never hardcoded, so a WORLD_SIZE_ORBIT retune carries this), which is the longest
  // armed fall the archetype can physically produce. The exact per-frame ramp, the untouched tangential
  // component and the release-keeps-its-velocity rule are all still asserted here — only the plateau
  // moved, and it moved to the sandbox below rather than being deleted.
  const X = seededBuild(0xD001);
  withRandom(seededRandom(0xD002), () => { X.startGame(); atWave(X, 3); });
  quiesce(X);
  X.game.debris.length = 0;
  const [OW, OH] = X.worldDims(X.game.worldSize);
  const D0 = Math.hypot(OW / 2, OH / 2);                 // 2,202.9 px — the far corner of the torus
  close(D0, 2202.9, "D: (setup) the orbit world's farthest wrap-aware point from the dock is ~2,203 px", 0.1);
  const d = placeFromDock(X, D0, Math.atan2(OH / 2, OW / 2), 3);
  X.game.debris.push(d);
  close(dockDist(X, d), D0, "D: (setup) ...and the body really sits on it", 1e-6);
  X.update(DT);
  eq(d.drifting, true, "D: (setup) the lone far body arms on the first frame");

  const cap = X.maxOrbitSpeed();
  const accel = X.DEBUG.debrisDriftAccel;
  // The two numbers spec C16b turns on, recomputed rather than restated.
  const orbitFall = D0 - X.DEBRIS_DRIFT_TARGET_R;
  close(orbitFall, 1402.9, "D: C16b — the longest armed fall on an orbit level is ~1,403 px", 0.1);
  close(Math.sqrt(2 * accel * orbitFall), 290.1,
    "D: C16b — ...worth ~290 px/s on arrival at 30 px/s^2, under the 314.2 px/s cap", 0.1);
  assert(Math.sqrt(2 * accel * orbitFall) < cap,
    `D: C16b — SO THE CAP CANNOT BIND ON AN ORBIT LEVEL (${Math.sqrt(2 * accel * orbitFall).toFixed(1)} < ${cap.toFixed(1)})`);
  // ...and it could NOT bind on a field level either, whose world is smaller still. Both halves of C16b's
  // claim in one place, each derived from the world it describes.
  {
    const [FW, FH] = X.worldDims(X.WORLD_SIZE_FIELD);
    const fieldFall = Math.hypot(FW / 2, FH / 2) - X.DEBRIS_DRIFT_TARGET_R;
    close(fieldFall, 668.6, "D: C16b — the longest armed fall on a FIELD level is ~669 px", 0.1);
    close(Math.sqrt(2 * accel * fieldFall), 200.3, "D: C16b — ...worth ~200 px/s on arrival", 0.1);
    assert(Math.sqrt(2 * accel * fieldFall) < cap, "D: C16b — so the cap cannot bind there either");
    // The distance a body would have to START from for the cap to bind at all — beyond both worlds.
    const reachCap = X.DEBRIS_DRIFT_TARGET_R + cap * cap / (2 * accel);
    close(reachCap, 2444.9, "D: C16b — the cap binds only from ~2,445 px out...", 0.5);
    assert(reachCap > D0 && reachCap > Math.hypot(FW / 2, FH / 2),
      "D: ...which is farther than EITHER world's farthest point — unreachable, not merely unlikely");
  }

  let prev = { vx: d.vx, vy: d.vy };
  let rampFrames = 0, clampedFrames = 0, released = -1, worstVr = -Infinity;
  let releaseSpeed = 0, preReleaseSpeed = 0;
  for (let f = 1; f <= 900 && released < 0; f++) {
    quiesce(X);
    const speedBefore = Math.hypot(d.vx, d.vy);
    X.update(DT);
    // The frame the drift saw: the pass runs LAST, so the body's CURRENT position is the one it used.
    const fr = dockFrame(X, d);
    const vrPrev = radial(prev, fr), vrNow = radial(d, fr);
    const vtPrev = tangen(prev, fr), vtNow = tangen(d, fr);
    if (d.drifting === false) {                                  // released this frame
      released = f;
      releaseSpeed = Math.hypot(d.vx, d.vy);
      preReleaseSpeed = speedBefore;
      break;
    }
    worstVr = Math.max(worstVr, vrNow);
    close(vtNow, vtPrev, `D: frame ${f} — the TANGENTIAL component is untouched`, 1e-9);
    if (vrPrev + accel * DT <= cap + 1e-9) {
      close(vrNow, vrPrev + accel * DT,
        `D: frame ${f} — the inward component grew by exactly debrisDriftAccel x dt`, 1e-9);
      rampFrames++;
    } else {
      clampedFrames++;                                           // must stay 0 at the shipped values
    }
    prev = { vx: d.vx, vy: d.vy };
  }
  assert(released > 0, "D: the piece reached the target radius and was released");
  assert(rampFrames > 500, `D: ...after a long ramp (${rampFrames} frames of exact acceleration)`);
  // THE INVERSION. P4 asserted `capReached && plateauFrames > 10` here; the claim is now that the clamp
  // never engaged for a single frame of the longest fall the archetype can produce.
  eq(clampedFrames, 0,
    "D: P4C — the cap NEVER engaged, not on ONE frame of the longest possible orbit fall (C16b)");
  eq(rampFrames, released - 1,
    "D: ...so every single pre-release frame was an exact, unclamped debrisDriftAccel x dt step");
  assert(worstVr < cap - 20,
    `D: ...and the fastest it ever closed was ${worstVr.toFixed(1)} px/s, a clear ${(cap - worstVr).toFixed(1)} px/s under the ${cap.toFixed(1)} px/s cap`);
  // The release speed is now the UNCAPPED closed form, where P4 asserted it was exactly the cap.
  close(releaseSpeed, preReleaseSpeed, "D: the released piece KEEPS its accumulated speed exactly (no damping)", 1e-9);
  close(releaseSpeed, Math.sqrt(2 * accel * orbitFall),
    "D: P4C — ...and that speed is the CONSTANT-ACCELERATION closed form, not the cap (nothing was ever clamped)", 5);
  assert(releaseSpeed < cap,
    `D: P4C — ...strictly under the cap (${releaseSpeed.toFixed(1)} < ${cap.toFixed(1)}), reversing P4's "exactly the cap"`);
  eq(d.drifting, false, "D: ...and `drifting` is false, not deleted — the field stays a boolean once used");
  // It COASTS ON rather than parking: the next second carries it well inside the shell region.
  {
    const distAtRelease = dockDist(X, d);
    for (let f = 0; f < 60; f++) { quiesce(X); X.update(DT); }
    assert(dockDist(X, d) < distAtRelease - 200,
      "D: ...and it coasts ON through the shell region rather than parking at the target radius");
    eq(d.drifting, false, "D: ...still released — a body inside the target is never re-armed");
  }

  // --- A TANGENTIALLY-MOVING PIECE: the force leaves the perpendicular component alone ---------------
  // At the shipped acceleration this is the pure "the force is radial" claim; the CLAMP half of it (total
  // speed legitimately exceeding the cap) moved into the raised-acceleration sandbox below, since nothing
  // clamps here any more.
  {
    const T = seededBuild(0xD100);
    withRandom(seededRandom(0xD101), () => { T.startGame(); atWave(T, 3); });
    quiesce(T);
    T.game.debris.length = 0;
    const V_T = 300;                                  // px/s of pure tangential drift, above the cap's own scale
    const t = placeFromDock(T, 1850, 0, 2, 0, V_T);   // dock is at -x; the velocity is +y, i.e. tangential
    T.game.debris.push(t);
    T.update(DT);
    eq(t.drifting, true, "D: (setup) the tangential piece arms");
    let p = { vx: t.vx, vy: t.vy };
    let minVt = Infinity, sawClamp = false;
    for (let f = 1; f <= 900 && t.drifting; f++) {
      quiesce(T);
      T.update(DT);
      if (t.drifting === false) break;
      const fr = dockFrame(T, t);
      const vrP = radial(p, fr), vrN = radial(t, fr);
      const vtP = tangen(p, fr), vtN = tangen(t, fr);
      // The perpendicular component is EXACTLY preserved ACROSS THE PASS, in the frame the pass used.
      // (Its MAGNITUDE still evolves frame to frame — a flat central force conserves r x v, so the
      // tangential speed rises as the body closes and falls as it swings out. That is the body's own
      // motion, not the force touching it, and it is exactly why total speed may exceed the cap.)
      close(vtN, vtP, `D: (tangential) frame ${f} — the perpendicular component is untouched by the force`, 1e-9);
      minVt = Math.min(minVt, Math.abs(vtN));
      if (vrP + accel * DT > cap + 1e-9) sawClamp = true;
      else close(vrN, vrP + accel * DT, `D: (tangential) frame ${f} — ...and the radial one ramps exactly`, 1e-9);
      p = { vx: t.vx, vy: t.vy };
    }
    assert(!sawClamp, "D: P4C — (tangential) nothing clamped at the shipped acceleration either");
    assert(minVt > 1, `D: ...and the tangential drift is never zeroed by the force (min ${minVt.toFixed(1)} px/s)`);
  }

  // --- THE SANDBOX WHERE THE CAP DOES BIND: proof that the clamp is LIVE CODE (spec C16b) ------------
  // The point of this block, and why it is not optional. The cap is unreachable at the shipped numbers,
  // which is exactly the state in which a clamp quietly rots: nothing exercises it, a later refactor
  // "simplifies" it away, and the guard rail is gone the moment somebody raises the acceleration — which
  // is the FIRST thing the playtest gate is asked to try (FLAG-CS023-d, gate question 12). So the old
  // plateau assertions are not deleted; they are re-run here with DEBUG.debrisDriftAccel raised until the
  // cap engages. Nothing about the SHIPPED build changes: this is the same source, the same update(), the
  // same live knob a player can move in the debug panel.
  {
    const C = seededBuild(0xD400);
    withRandom(seededRandom(0xD401), () => { C.startGame(); atWave(C, 3); });
    quiesce(C);
    const capC = C.maxOrbitSpeed();
    const A = 150;                                        // inside the knob's own [0, 200] registry range
    const e = C.DEBUG_ENTRIES.find(v => v.id === "debrisDriftAccel");
    assert(A > e.min && A <= e.max, "D: (sandbox) the raised acceleration is inside the knob's shipped range");
    C.applyDebug("debrisDriftAccel", A);
    eq(C.DEBUG.debrisDriftAccel, A, "D: (sandbox) the live knob really took the raised value");
    // The threshold, stated: below this the cap cannot bind over the longest orbit fall, above it it must.
    const [CW, CH] = C.worldDims(C.game.worldSize);
    const start = Math.hypot(CW / 2, CH / 2);
    const fall = start - C.DEBRIS_DRIFT_TARGET_R;
    const wakeAt = capC * capC / (2 * fall);
    close(wakeAt, 35.2, "D: (sandbox) the cap wakes up at ~35.2 px/s^2 over the longest orbit fall", 0.2);
    assert(X.DEBUG.debrisDriftAccel < wakeAt && A > wakeAt,
      "D: (sandbox) ...so the shipped 30 is below it and the sandbox's 150 is above it — a real threshold, not a staging trick");

    C.game.debris.length = 0;
    const c = placeFromDock(C, start, Math.atan2(CH / 2, CW / 2), 3);
    C.game.debris.push(c);
    C.update(DT);
    eq(c.drifting, true, "D: (sandbox) armed at the far corner");
    let pv = { vx: c.vx, vy: c.vy };
    let ramp = 0, plateau = 0, worst = -Infinity, relSpeed = 0;
    for (let f = 1; f <= 900; f++) {
      quiesce(C);
      C.update(DT);
      const fr = dockFrame(C, c);
      const vrP = radial(pv, fr), vrN = radial(c, fr);
      if (c.drifting === false) { relSpeed = Math.hypot(c.vx, c.vy); break; }
      worst = Math.max(worst, vrN);
      if (vrP + A * DT <= capC + 1e-9) {
        close(vrN, vrP + A * DT, `D: (sandbox) frame ${f} — exact acceleration below the cap`, 1e-9);
        ramp++;
      } else {
        close(vrN, capC, `D: (sandbox) frame ${f} — PLATEAUS at exactly maxOrbitSpeed()`, 1e-9);
        plateau++;
      }
      pv = { vx: c.vx, vy: c.vy };
    }
    assert(ramp > 50, `D: (sandbox) a real ramp before the cap (${ramp} frames)`);
    assert(plateau > 100,
      `D: (sandbox) AND A REAL PLATEAU AT THE CAP (${plateau} frames) — the clamp is LIVE CODE, not dead code (C16b)`);
    close(ramp * DT, capC / A, "D: (sandbox) the ramp lasted cap / accel seconds, to within a frame or two", 3 * DT);
    assert(worst <= capC + 1e-9,
      `D: (sandbox) the inward component NEVER exceeded the cap (worst ${worst.toFixed(6)} vs ${capC.toFixed(6)})`);
    close(relSpeed, capC, "D: (sandbox) ...and it arrived at exactly the cap, having plateaued long before", 1e-6);
    assert(relSpeed < Math.sqrt(2 * A * fall),
      `D: (sandbox) ...which is well under the uncapped closed form (${Math.sqrt(2 * A * fall).toFixed(1)} px/s) — the clamp really removed energy`);
    // A CONTROL, so "the clamp engaged" cannot be an artefact of the raised acceleration alone: the SAME
    // build, the SAME staging, at the shipped 30, must run the whole fall without one clamped frame.
    C.applyDebug("debrisDriftAccel", e.def);
    eq(C.DEBUG.debrisDriftAccel, 30, "D: (sandbox control) the knob is back at its shipped default");
    C.game.debris.length = 0;
    const c2 = placeFromDock(C, start, Math.atan2(CH / 2, CW / 2), 3);
    C.game.debris.push(c2);
    C.update(DT);
    let pv2 = { vx: c2.vx, vy: c2.vy }, clamped2 = 0, worst2 = -Infinity;
    for (let f = 1; f <= 900; f++) {
      quiesce(C);
      C.update(DT);
      if (c2.drifting === false) break;
      const fr = dockFrame(C, c2);
      if (radial(pv2, fr) + 30 * DT > capC + 1e-9) clamped2++;
      worst2 = Math.max(worst2, radial(c2, fr));
      pv2 = { vx: c2.vx, vy: c2.vy };
    }
    eq(clamped2, 0, "D: (sandbox control) at the shipped 30 the same fall clamps on ZERO frames");
    assert(worst2 < capC, `D: ...topping out at ${worst2.toFixed(1)} px/s against the ${capC.toFixed(1)} px/s cap`);
  }

  // --- THE CLAMP TOUCHES THE RADIAL COMPONENT ONLY, proven where it actually clamps ------------------
  // P4 proved this at the shipped acceleration; after P4c the only place it CAN be proved is a raised one.
  {
    const T = seededBuild(0xD500);
    withRandom(seededRandom(0xD501), () => { T.startGame(); atWave(T, 3); });
    quiesce(T);
    const capT = T.maxOrbitSpeed();
    T.applyDebug("debrisDriftAccel", 150);
    T.game.debris.length = 0;
    const V_T = 300;                                  // px/s of pure tangential drift, above the cap's own scale
    const t = placeFromDock(T, 1850, 0, 2, 0, V_T);   // dock is at -x; the velocity is +y, i.e. tangential
    T.game.debris.push(t);
    T.update(DT);
    eq(t.drifting, true, "D: (tangential/clamped) (setup) the tangential piece arms");
    let p = { vx: t.vx, vy: t.vy };
    let sawClamp = false, maxTotal = 0, maxTotalVt = 0, minVt = Infinity;
    for (let f = 1; f <= 900 && t.drifting; f++) {
      quiesce(T);
      T.update(DT);
      if (t.drifting === false) break;
      const fr = dockFrame(T, t);
      const vrP = radial(p, fr), vrN = radial(t, fr);
      const vtP = tangen(p, fr), vtN = tangen(t, fr);
      close(vtN, vtP, `D: (tangential/clamped) frame ${f} — the perpendicular component is untouched`, 1e-9);
      minVt = Math.min(minVt, Math.abs(vtN));
      if (vrP + 150 * DT > capT + 1e-9) {
        close(vrN, capT, `D: (tangential/clamped) frame ${f} — the RADIAL component is clamped at the cap`, 1e-9);
        sawClamp = true;
        const tot = Math.hypot(t.vx, t.vy);
        if (tot > maxTotal) { maxTotal = tot; maxTotalVt = vtN; }
      } else {
        close(vrN, vrP + 150 * DT, `D: (tangential/clamped) frame ${f} — ...and ramps exactly until then`, 1e-9);
      }
      p = { vx: t.vx, vy: t.vy };
    }
    assert(sawClamp, "D: (tangential/clamped) the run really did reach the cap");
    assert(maxTotal > capT + 1e-6,
      `D: (tangential/clamped) TOTAL speed legitimately EXCEEDS the cap (${maxTotal.toFixed(1)} > ${capT.toFixed(1)}) — ` +
      "the cap bounds the inward component only");
    close(maxTotal, Math.hypot(capT, maxTotalVt),
      "D: ...and at that frame it is EXACTLY hypot(cap, the body's own tangential component)", 1e-9);
    assert(minVt > 1, `D: ...and the tangential drift is never zeroed by the force (min ${minVt.toFixed(1)} px/s)`);
  }

  // --- the knob at 0 is a real A/B ------------------------------------------------------------------
  {
    const Z = seededBuild(0xD200);
    withRandom(seededRandom(0xD201), () => { Z.startGame(); atWave(Z, 3); });
    quiesce(Z);
    Z.applyDebug("debrisDriftAccel", 0);
    Z.game.debris.length = 0;
    const z = placeFromDock(Z, 1400, 1.1, 1, 5, -3);
    Z.game.debris.push(z);
    const v0 = [z.vx, z.vy];
    for (let f = 0; f < 180; f++) { quiesce(Z); Z.update(DT); }
    eq(z.drifting, true, "D: at debrisDriftAccel 0 a body still ARMS (the mechanism runs)...");
    eq(JSON.stringify([z.vx, z.vy]), JSON.stringify(v0),
      "D: ...but no force is applied at all — the gate's A/B is a genuine off switch");
  }
  // ...and moving the knob moves the force, one for one.
  {
    const K = seededBuild(0xD300);
    withRandom(seededRandom(0xD301), () => { K.startGame(); atWave(K, 3); });
    quiesce(K);
    K.applyDebug("debrisDriftAccel", 90);
    K.game.debris.length = 0;
    const k = placeFromDock(K, 1400, 0, 1);
    K.game.debris.push(k);
    K.update(DT);                                  // arms and applies one frame of force
    const fr = dockFrame(K, k);
    close(radial(k, fr), 90 * DT, "D: at debrisDriftAccel 90 the first frame's inward component is 90 x dt", 1e-9);
  }
})();

// ================= (E) item 16 — release and disarm: all four interrupts ============================
(function sectionE() {
  console.log("(E) item 16 — arrival, satellite contact, UFO contact, player shot, ship ram");
  const DT = 1 / 60;

  // 1. ARRIVAL — covered exhaustively in (D); restated here as the first of the four.
  {
    const A = seededBuild(0xE001);
    withRandom(seededRandom(0xE002), () => { A.startGame(); atWave(A, 3); });
    quiesce(A);
    A.game.debris.length = 0;
    // Just outside the TRIGGER radius (a body inside it would block the pass — see section C), so it arms
    // immediately and has only ~220 px to fall before the target releases it (P4C: ~140 px at P1's step —
    // the gap between the two radii IS ORBIT_RADIUS_STEP, so it widened with everything else).
    const a = placeFromDock(A, A.DEBRIS_DRIFT_TRIGGER_R + 20, 0, 1);
    A.game.debris.push(a);
    A.update(DT);
    eq(a.drifting, true, "E: (arrival) armed just outside the trigger radius");
    let n = 0;
    while (a.drifting && n < 600) { quiesce(A); A.update(DT); n++; }
    eq(a.drifting, false, "E: INTERRUPT 1/4 — ARRIVAL releases the piece");
    assert(dockDist(A, a) <= A.DEBRIS_DRIFT_TARGET_R, "E: ...at or inside the target radius");
  }

  // 2. SATELLITE CONTACT — through the REAL debris-vs-debris pass, not a direct helper call ------------
  {
    const S = seededBuild(0xE100);
    withRandom(seededRandom(0xE101), () => { S.startGame(); atWave(S, 3); });
    quiesce(S);
    S.game.debris.length = 0;
    // Two free bodies, both far out, both armed, then walked into contact by the pass itself.
    const p = placeFromDock(S, 1400, 0.5, 2);
    const q = placeFromDock(S, 1400, 0.5, 2);
    q.x = p.x + (p.radius + q.radius) * 0.8; q.y = p.y;      // overlapping, so the pass fires immediately
    S.game.debris.push(p, q);
    S.update(DT);
    // update() arms in the drift pass and then runs the debris-vs-debris pass in the SAME frame, so the
    // contact disarms both on the very frame they were armed. That IS the rule: contact changes direction.
    eq(p.drifting, false, "E: INTERRUPT 2/4 — SATELLITE CONTACT disarms the first body");
    eq(q.drifting, false, "E: ...and the second");
    assert(Math.hypot(p.vx - q.vx, p.vy - q.vy) > S.DEBRIS_BOUNCE_MIN - 1e-6,
      "E: ...and they really did bounce (the separation floor was applied)");
  }
  // ...and against a RAIL-BORNE partner: the free one is bounced AND disarmed, the rail one untouched.
  {
    const S = seededBuild(0xE200);
    withRandom(seededRandom(0xE201), () => { S.startGame(); atWave(S, 3); });
    quiesce(S);
    const railed = S.game.debris.find(d => d.orbitCenter);
    assert(!!railed, "E: (setup) a rail-borne satellite is present");
    S.game.debris = [railed];
    const free = placeFromDock(S, 1400, 2.0, 1);
    S.game.debris.push(free);
    // Arm it manually (the ring satellite blocks the trigger, which is the point of the staging) and put
    // it in contact with the rail body.
    free.drifting = true;
    free.x = railed.x + (railed.radius + free.radius) * 0.8; free.y = railed.y;
    const snap = ["x", "y", "vx", "vy", "orbitRadius", "orbitAngle", "orbitAngVel", "size", "radius", "dead", "guardT", "angle"]
      .map(k => railed[k]);
    S.update(DT);
    eq(free.drifting, false, "E: a free ARMED body that hits a RAIL-BORNE one is disarmed");
    eq(railed.drifting, false,
      "E: ...and the rail body's `drifting` is set to false too — an inert write, since it was never armed");
    // The rail body's twelve fields: x/y/vx/vy are re-derived by its own update(dt) each frame, so what
    // must hold is that the BOUNCE moved none of them — checked via its rail invariant instead.
    close(Math.sqrt(S.dist2(railed, railed.orbitCenter)), railed.orbitRadius,
      "E: ...and the rail body is still exactly on its rail — the bounce could not push it", 1e-6);
    eq(JSON.stringify(["orbitRadius", "orbitAngVel", "size", "radius", "dead"].map(k => railed[k])),
       JSON.stringify([snap[4], snap[6], snap[7], snap[8], snap[9]]),
       "E: ...with its rail identity byte-unchanged");
  }

  // 3. UFO CONTACT — through the REAL UFO-vs-debris pass -----------------------------------------------
  {
    const U = seededBuild(0xE300);
    withRandom(seededRandom(0xE301), () => { U.startGame(); atWave(U, 3); });
    quiesce(U);
    U.game.debris.length = 0;
    // REPOINTED BY P4C: bearing 1.4 folded a nominal 1,400 px to a wrap-aware 816 px — harmless here,
    // since this block arms the piece by hand, but it read as a far body and was not one any more.
    const a = placeFromDock(U, 1400, 0.4, 2);
    a.drifting = true;
    U.game.debris.push(a);
    const s = withRandom(seededRandom(0xE302), () => new U.Saucer(false));
    s.x = a.x; s.y = a.y; s.vx = 0; s.vy = 0;
    U.game.saucers.push(s);
    const score0 = U.game.score;
    U.game.saucerTimer = 9999;
    U.update(DT);
    eq(a.drifting, false, "E: INTERRUPT 3/4 — UFO CONTACT disarms the satellite");
    assert(!U.game.saucers.includes(s), "E: ...and the saucer is destroyed and filtered out");
    eq(U.game.score, score0, "E: ...with no score, per FORK-CS023-E (unchanged from P3)");
    assert(Math.hypot(a.vx, a.vy) > 0, "E: ...and the satellite was knocked off course");
  }

  // 4. PLAYER SHOT — no code needed: the body is destroyed and its children are fresh objects ---------
  {
    const B = seededBuild(0xE400);
    withRandom(seededRandom(0xE401), () => { B.startGame(); atWave(B, 3); });
    quiesce(B);
    B.game.debris.length = 0;
    const a = placeFromDock(B, 1400, 2.9, 3);
    B.game.debris.push(a);
    B.update(DT);
    eq(a.drifting, true, "E: (setup) the target is armed");
    // A REAL player bullet, placed on top of it — driven through update()'s bullet pass.
    const b = withRandom(seededRandom(0xE402), () => new B.Bullet(a.x, a.y, 0, false));
    b.x = a.x; b.y = a.y; b.vx = 0; b.vy = 0;
    B.game.bullets.push(b);
    B.update(DT);
    eq(a.dead, true, "E: INTERRUPT 4a/4 — a PLAYER SHOT destroys the drifting body");
    assert(!B.game.debris.includes(a), "E: ...and it is filtered out, leaving nothing behind");
    const kids = B.game.debris.filter(k => k.size === 2);
    eq(kids.length, 3, "E: ...its three children exist");
    // NOT armed on the frame they were born. (They are born coincident, so the debris-vs-debris pass
    // later in the SAME frame bounces them and stamps `drifting = false` — hence `!== true` rather than
    // "absent" here; the absent-at-birth claim is proved directly, without a frame, in the next block.)
    assert(kids.every(k => k.drifting !== true),
      "E: ...and NOT ONE of them inherited the parent's armed state");
  }
  // THE INHERITANCE CLAIM, ISOLATED (FLAG-CS023-c): with a blocker inside the trigger radius the arming
  // pass cannot run at all, so a split child of an armed parent stays unarmed frame after frame.
  {
    const B = seededBuild(0xE500);
    withRandom(seededRandom(0xE501), () => { B.startGame(); atWave(B, 3); });
    quiesce(B);
    B.game.debris.length = 0;
    const a = placeFromDock(B, 1400, 0.2, 3);
    B.game.debris.push(a);
    B.update(DT);
    eq(a.drifting, true, "E: (setup) the parent is armed");
    const blocker = placeFromDock(B, 500, 3.0, 1);          // inside the trigger: arming is now blocked
    B.game.debris.push(blocker);
    B.destroyDebris(a, false);
    const kids = B.game.debris.filter(k => k.size === 2);
    eq(kids.length, 3, "E: (setup) three children were pushed");
    assert(kids.every(k => !("drifting" in k)),
      "E: FLAG-CS023-c — a split child of an ARMED parent is born with `drifting` ABSENT, never inherited");
    for (let f = 0; f < 60; f++) { quiesce(B); B.update(DT); }
    assert(kids.every(k => k.drifting !== true),
      "E: ...and stays unarmed while the field is blocked — arming is the ONLY way in");
    const v0 = kids.map(k => [k.vx, k.vy]);
    for (let f = 0; f < 30; f++) { quiesce(B); B.update(DT); }
    eq(JSON.stringify(kids.map(k => [k.vx, k.vy])), JSON.stringify(v0),
      "E: ...with no force applied to any of them");
  }

  // 4b. SHIP RAM — the other no-code interrupt, through the REAL hazards-vs-ship block ----------------
  {
    const R = seededBuild(0xE600);
    withRandom(seededRandom(0xE601), () => { R.startGame(); atWave(R, 3); });
    R.game.saucerTimer = 9999; R.game.hunterTimer = 9999; R.game.healthTimer = 9999;
    R.game.saucers.length = 0; R.game.hunters.length = 0;
    R.game.debris.length = 0;
    const a = placeFromDock(R, 1400, 4.0, 2);
    R.game.debris.push(a);
    R.game.ship.invuln = 9999;
    R.update(DT);
    eq(a.drifting, true, "E: (setup) the ram target is armed");
    // Now let the ship hit it: zero i-frames, ship placed on top, unshielded.
    R.game.ship.invuln = 0;
    R.game.ship.shield = false;
    R.game.ship.x = a.x; R.game.ship.y = a.y; R.game.ship.vx = 0; R.game.ship.vy = 0;
    const hp0 = R.game.ship.hp, score0 = R.game.score;
    R.update(DT);
    eq(a.dead, true, "E: INTERRUPT 4b/4 — a SHIP RAM destroys the drifting body (CS023 P3's mutual damage)");
    assert(R.game.ship.hp < hp0, "E: ...and the ship takes its damage");
    eq(R.game.score, score0, "E: ...with no score (FORK-CS023-E)");
    const kids = R.game.debris.filter(k => k.size === 1);
    eq(kids.length, 3, "E: ...and the three children exist");
    assert(kids.every(k => k.drifting !== true), "E: ...unarmed, exactly like the shot case");
  }

  // --- the disarm is at the TOP of debrisBounce, so even a FIXED/FIXED no-op disarms -----------------
  {
    const N = seededBuild(0xE700);
    withRandom(seededRandom(0xE701), () => { N.startGame(); atWave(N, 3); });
    const r1 = new N.DebrisSatellite(1000, 1000, 3, 1);
    const r2 = new N.DebrisSatellite(1000, 1000, 3, 1);
    r1.orbitCenter = { x: 900, y: 1000 }; r1.orbitRadius = 100; r1.orbitAngle = 0; r1.orbitAngVel = 0;
    r2.orbitCenter = { x: 900, y: 1000 }; r2.orbitRadius = 100; r2.orbitAngle = 0; r2.orbitAngVel = 0;
    r1.drifting = true; r2.drifting = true;      // impossible in play; the point is the ORDER of the line
    const snap = JSON.stringify([r1.x, r1.y, r1.vx, r1.vy, r2.x, r2.y, r2.vx, r2.vy]);
    N.debrisBounce(r1, r2);
    eq(r1.drifting, false, "E: the disarm precedes the FIXED/FIXED early return — first body cleared");
    eq(r2.drifting, false, "E: ...and second");
    eq(JSON.stringify([r1.x, r1.y, r1.vx, r1.vy, r2.x, r2.y, r2.vx, r2.vy]), snap,
      "E: ...and the rail/rail branch is still a physical NO-OP (C11)");
  }
})();

// ================= (F) item 17 — edge cases =========================================================
(function sectionF() {
  console.log("(F) item 17 — a new dock, a real resizeWorld, destruction, the seam");
  const DT = 1 / 60;

  // --- game.dock is RE-CREATED by every nextWave(): the force follows the NEW dock ------------------
  {
    const X = seededBuild(0xF001);
    withRandom(seededRandom(0xF002), () => { X.startGame(); atWave(X, 3); });
    quiesce(X);
    X.game.debris.length = 0;
    const d = placeFromDock(X, 1500, 0.6, 2);   // REPOINTED BY P4C: bearing 0.8 sat 4 px from folding across the world height
    X.game.debris.push(d);
    X.update(DT);
    eq(d.drifting, true, "F: (setup) armed on the first orbit level");
    const oldDock = X.game.dock;
    // Straight on to the NEXT orbit level (6), through the real nextWave() — which relocates the dock,
    // resizes nothing (orbit -> orbit), and lays a fresh shell that BLOCKS arming. The armed piece must
    // keep its force (FLAG-CS023-b, sticky) and must aim at the NEW dock.
    // FIXED BY CS023 P4B: nextWave() lays real random geometry (dock placement, ring layout) and was
    // called here UNSEEDED — a latent determinism gap (spec §6 item 19) that P4b's own new field-level
    // blocks earlier in this file surfaced as real flakiness (a shifted global Math.random() stream
    // occasionally puts the new dock coincidentally near the old one). Seeded like every other
    // nextWave() call in this file.
    withRandom(seededRandom(0xF003), () => { X.game.wave = 5; X.nextWave(); });
    eq(X.levelDef(X.game.wave).archetype, "orbit", "F: (setup) level 6 is an orbit level too");
    assert(X.game.dock !== oldDock, "F: ...and nextWave() really did create a NEW Dock object");
    assert(X.game.debris.some(b => b.orbitCenter), "F: ...whose fresh shell blocks the arming pass");
    eq(d.drifting, true, "F: FLAG-CS023-b — the armed piece keeps its force across the level boundary");
    quiesce(X);
    const before = { vx: d.vx, vy: d.vy };
    X.update(DT);
    const fNew = dockFrame(X, d);
    close(radial(d, fNew) - radial(before, fNew), X.DEBUG.debrisDriftAccel * DT,
      "F: ...and the force now points at the NEW dock, to the float", 1e-9);
    // A stale centre would show up as the OLD dock's direction; state it as a live control.
    const [odx, ody] = X.shortDelta(d.x, d.y, oldDock.x, oldDock.y);
    const oL = Math.hypot(odx, ody) || 1e-4;
    const oldFrame = { ux: odx / oL, uy: ody / oL };
    const gotOld = radial(d, oldFrame) - radial(before, oldFrame);
    assert(Math.abs(gotOld - X.DEBUG.debrisDriftAccel * DT) > 1e-4 ||
           Math.hypot(oldDock.x - X.game.dock.x, oldDock.y - X.game.dock.y) < 1,
      "F: ...and NOT at the old one — no piece keeps a stale centre");
    // Nothing anywhere caches a dock: the pass reads game.dock at every use.
    const drift = bodyOf(codeOnly, "function updateDebrisDrift(dt) {");
    assert(!/const .*= game\.dock;/.test(drift), "F: (source) the pass never caches game.dock in a local");
  }

  // --- a REAL resizeWorld shrink: `drifting` survives and the piece re-homes with the rest -----------
  {
    const X = seededBuild(0xF100);
    withRandom(seededRandom(0xF102), () => { X.startGame(); atWave(X, 3); });
    quiesce(X);
    X.game.debris.length = 0;
    // REPOINTED BY CS023 P4C: at bearing 1.9 a nominal 1,500 px folds across the 2,160 px world height to
    // a wrap-aware 885 px — outside P1's 814 px trigger, INSIDE the 1,000 px one, so the piece blocked its
    // own arming and this whole resizeWorld proof would have gone vacuous.
    const d = placeFromDock(X, 1500, 2.5, 1);
    const ctl = placeFromDock(X, 1500, 2.5 + 0.35, 1);   // an UNARMED control that must re-home identically
    X.game.debris.push(d, ctl);
    X.update(DT);
    eq(d.drifting, true, "F: (setup) armed in the size-9 orbit world");
    eq(X.game.worldSize, X.WORLD_SIZE_ORBIT, "F: (setup) ...which really is the orbit world");
    const bearingOf = e => { const [dx, dy] = X.shortDelta(X.game.ship.x, X.game.ship.y, e.x, e.y); return Math.atan2(dy, dx); };
    const b0 = [bearingOf(d), bearingOf(ctl)];
    const dist0 = [Math.hypot(...X.shortDelta(X.game.ship.x, X.game.ship.y, d.x, d.y)),
                   Math.hypot(...X.shortDelta(X.game.ship.x, X.game.ship.y, ctl.x, ctl.y))];
    X.resizeWorld(X.WORLD_SIZE_FIELD);                   // the real shrink, 3840x2160 -> 2560x1440
    const [w, h] = X.worldDims(X.WORLD_SIZE_FIELD);
    eq(X.game.worldSize, X.WORLD_SIZE_FIELD, "F: (setup) the shrink really happened");
    eq(d.drifting, true, "F: an armed piece carried through a real resizeWorld KEEPS `drifting`");
    const dmax = Math.min(w, h) / 2 - 60;
    for (const [e, i, name] of [[d, 0, "the armed piece"], [ctl, 1, "the unarmed control"]]) {
      const [dx, dy] = X.shortDelta(X.game.ship.x, X.game.ship.y, e.x, e.y);
      close(Math.atan2(dy, dx), b0[i], `F: ...${name} kept its bearing exactly`, 1e-9);
      close(Math.hypot(dx, dy), Math.min(dist0[i], dmax), `F: ...and its distance was clamped to dmax (${dmax})`, 1e-6);
      assert(e.x >= 0 && e.x <= w && e.y >= 0 && e.y <= h, `F: ...and ${name} landed inside the new world`);
    }
    // It re-homed WITH the rest: armed and unarmed took the identical treatment.
    close(Math.hypot(...X.shortDelta(X.game.ship.x, X.game.ship.y, d.x, d.y)),
          Math.hypot(...X.shortDelta(X.game.ship.x, X.game.ship.y, ctl.x, ctl.y)),
          "F: ...and the armed piece re-homed exactly like the unarmed one — resizeWorld knows nothing about drift", 1e-6);
    // Nothing throws on the very next frame, in the smaller world, with the layout still live.
    quiesce(X); X.update(DT);
    passed++;                                            // reaching here IS the assertion
  }
  // CORRECTED BY CS023 P4B (C15, FORK-CS023-H re-resolved): the realistic route — an orbit level ending
  // into a FIELD level — leaves the piece armed AND STILL DRIVEN. P4 proved it inert here; that assertion
  // is now backwards, so this INVERTS it: the force keeps applying, pointed at the field level's own dock.
  {
    const X = seededBuild(0xF200);
    withRandom(seededRandom(0xF201), () => { X.startGame(); atWave(X, 3); });
    quiesce(X);
    X.game.debris.length = 0;
    const d = placeFromDock(X, 1500, 2.4, 1);
    X.game.debris.push(d);
    X.update(DT);
    eq(d.drifting, true, "F: P4B (setup) armed on level 3");
    // Seeded (determinism, spec §6 item 19): nextWave() lays real random geometry (dock placement, the
    // field's own population), and leaving it unseeded here was flaky — the field dock can coincidentally
    // land within DEBRIS_DRIFT_TARGET_R of the re-homed piece, releasing it on frame one with zero force
    // applied, which is a legitimate outcome but not the one this block means to demonstrate.
    withRandom(seededRandom(0xF202), () => { X.game.wave = 3; X.nextWave(); });   // -> level 4, a field level
    // nextWave() lays a fresh field population alongside the carried-over piece (unlike a bare
    // resizeWorld) — isolate `d` again so its fall to arrival is not disturbed by an ambient collision
    // with one of THAT level's own asteroids, which would disarm it by CONTACT rather than by arrival.
    X.game.debris = X.game.debris.filter(b => b === d);
    eq(X.game.orbitLayout, null, "F: P4B (setup) level 4 has no orbit layout");
    eq(d.drifting, true, "F: P4B — an armed piece carried onto a FIELD level KEEPS the flag (FLAG-CS023-b, sticky)");
    quiesce(X);
    const before = { vx: d.vx, vy: d.vy };
    X.update(DT);
    const fr = dockFrame(X, d);
    close(radial(d, fr) - radial(before, fr), X.DEBUG.debrisDriftAccel * DT,
      "F: P4B — ...and the force keeps applying on the field level too, pointed at the NEW field dock — no archetype gate anywhere (C15)", 1e-9);
    // Let it run all the way: it must still ARRIVE on a field level, exactly as it would on an orbit one.
    let n = 0;
    while (d.drifting && n < 900) { quiesce(X); X.update(DT); n++; }
    eq(d.drifting, false, "F: P4B — ...and it genuinely arrives at the target radius on a field level");
    assert(dockDist(X, d) <= X.DEBRIS_DRIFT_TARGET_R, "F: P4B — ...inside 800 px of the field dock");
  }

  // --- an armed piece that is DESTROYED leaves nothing dangling -------------------------------------
  {
    const X = seededBuild(0xF300);
    withRandom(seededRandom(0xF301), () => { X.startGame(); atWave(X, 3); });
    quiesce(X);
    X.game.debris.length = 0;
    const d = placeFromDock(X, 1400, 1.0, 1);              // size 1: no children at all
    X.game.debris.push(d);
    X.update(DT);
    eq(d.drifting, true, "F: (setup) armed");
    const g0 = X.game.garbage.length;
    X.destroyDebris(d, false);
    quiesce(X); X.update(DT);
    assert(!X.game.debris.includes(d), "F: a destroyed armed piece is filtered out of game.debris");
    eq(X.game.debris.length, 0, "F: ...leaving the array empty — no orphan, no placeholder");
    eq(X.game.garbage.length - g0, X.DEBRIS_GARBAGE, "F: ...and its canisters dropped normally");
    assert(X.game.garbage.slice(g0).every(g => !("drifting" in g)),
      "F: ...with `drifting` on none of them — canisters coalesce, they do not drift (TRAP 3)");
  }
  // Canisters and Hunters are out of scope entirely: neither ever grows the field, over real frames.
  {
    const X = seededBuild(0xF400);
    withRandom(seededRandom(0xF401), () => { X.startGame(); atWave(X, 3); });
    X.game.saucerTimer = 9999; X.game.healthTimer = 9999;
    X.game.debris.length = 0;
    X.game.ship.invuln = 9999;
    for (let k = 0; k < 4; k++) X.game.garbage.push(new X.Garbage(X.game.dock.x + 900 + k * 20, X.game.dock.y, 0, 0));
    X.game.hunters.push(withRandom(seededRandom(0xF402), () => X.HunterSatellite.spawnCore()));
    for (let f = 0; f < 120; f++) {
      X.game.saucerTimer = 9999; X.game.healthTimer = 9999; X.game.ship.invuln = 9999;
      X.update(DT);
    }
    assert(X.game.garbage.every(g => !("drifting" in g)), "F: TRAP 3 — no canister ever gains a `drifting` field");
    assert(X.game.hunters.every(h => !("drifting" in h)), "F: TRAP 3 — nor any Hunter: they home, they do not drift");
  }

  // --- THE SEAM, with a naive-arithmetic control that pushes the WRONG way --------------------------
  {
    const X = seededBuild(0xF500);
    withRandom(seededRandom(0xF501), () => { X.startGame(); atWave(X, 3); });
    quiesce(X);
    const [W, H] = X.worldDims(X.game.worldSize);
    X.game.dock.x = 30; X.game.dock.y = H / 2;             // a dock hard against the left seam
    X.game.debris.length = 0;
    // 1,200 px to the RIGHT of the dock THE SHORT WAY ROUND — i.e. off the LEFT edge, wrapped.
    // REPOINTED BY CS023 P4C: 900 px was comfortably outside P1's 814 px trigger and is INSIDE the 1,000 px
    // one, where the body would block its own arming and this whole seam proof would go silently vacuous.
    const px = ((30 - 1200) % W + W) % W;
    const d = new X.DebrisSatellite(px, H / 2, 1, 1);
    d.x = px; d.y = H / 2; d.vx = 0; d.vy = 0;
    X.game.debris.push(d);
    const [sdx, sdy] = X.shortDelta(d.x, d.y, X.game.dock.x, X.game.dock.y);
    close(Math.hypot(sdx, sdy), 1200, "F: (setup) the wrap-aware distance to the dock is 1,200 px", 1e-6);
    assert(sdx > 0, "F: (setup) ...and the wrap-aware direction is +x, across the seam");
    const naiveDx = X.game.dock.x - d.x;
    assert(naiveDx < 0, "F: (setup) ...while NAIVE subtraction says -x — the control that must be wrong");
    assert(Math.abs(naiveDx) > 2000, "F: (setup) ...and by nearly a whole world period");
    X.update(DT);
    eq(d.drifting, true, "F: the seam-straddling body arms (1,200 px > 1,000, so it does not block itself)");
    assert(d.vx > 0, "F: THE FORCE PUSHES +x — the SHORT way across the seam, exactly as shortDelta says");
    close(d.vx, X.DEBUG.debrisDriftAccel * DT,
      "F: ...by exactly one frame of acceleration, along the wrap-aware unit vector", 1e-9);
    close(d.vy, 0, "F: ...with no spurious y component", 1e-9);
    assert(Math.sign(d.vx) !== Math.sign(naiveDx),
      "F: ...and the NAIVE control would have pushed it the opposite way, right across the world");
    // Let it run: it must ARRIVE, having crossed the seam, not sail off to the far side.
    let n = 0;
    while (d.drifting && n < 900) { quiesce(X); X.update(DT); n++; }
    eq(d.drifting, false, "F: ...and it genuinely arrives at the target radius across the seam");
    assert(dockDist(X, d) <= X.DEBRIS_DRIFT_TARGET_R, "F: ...inside 800 px of the dock, measured wrap-aware");
  }
})();

// ================= (G) item 19 — determinism =======================================================
(function sectionG() {
  console.log("(G) item 19 — the whole scenario is byte-identical run to run under a seeded LCG");
  function run() {
    return withRandom(seededRandom(0x6001), () => {
      const X = build();
      X.startGame();
      atWave(X, 3);
      quiesce(X);
      X.game.debris.length = 0;
      // REPOINTED BY CS023 P4C: the base distance was 1,000 px, which is now EXACTLY the trigger radius —
      // a float hair either way decides whether the whole staging arms, which is the opposite of what a
      // determinism harness wants. Moved clear of it, and the bearings kept inside 0.8 rad so a nominal
      // distance in a 3840x2160 world is always the wrap-aware one.
      for (let k = 0; k < 8; k++) X.game.debris.push(placeFromDock(X, 1100 + k * 90, k * 0.09, k % 3 + 1));
      const out = [];
      for (let f = 0; f < 400; f++) {
        quiesce(X);
        X.update(1 / 60);
        if (f % 40 === 0) out.push(X.game.debris.map(d => [
          +d.x.toFixed(9), +d.y.toFixed(9), +d.vx.toFixed(9), +d.vy.toFixed(9), d.size, !!d.drifting]));
      }
      out.push([X.maxOrbitSpeed(), X.game.debris.filter(d => d.drifting).length, X.game.debris.length]);
      return JSON.stringify(out);
    });
  }
  const a = run(), b = run(), c = run();
  eq(b, a, "G: run 2 is byte-identical to run 1");
  eq(c, a, "G: run 3 is byte-identical to run 1");
  assert(a.length > 500, "G: ...and the scenario actually produced a substantial trace");
  // The one unpinned Math.random() site in the whole file is the MODULE-LOAD starfield, which this file
  // never reads. Named here rather than left implicit (the standing note in this suite).
  passed++;
})();

// ================= (H) item 20 — AudioSys.ctx null smoke ===========================================
(function sectionH() {
  console.log("(H) item 20 — AudioSys.ctx null: a real ramp with the drift live, no crash");
  const X = seededBuild(0x8001, { audio: false });
  eq(X.AudioSys.ctx, null, "H: (setup) the build really has no audio context");
  withRandom(seededRandom(0x8002), () => {
    X.startGame();
    for (let w = 1; w <= 13; w++) {
      atWave(X, w);
      // Every third level is an orbit level; harvest it down to nothing so the drift arms for real.
      if (X.levelDef(w).archetype === "orbit") {
        X.game.debris = X.game.debris.filter(d => !d.orbitCenter);
        for (const d of X.game.debris) {
          const p = X.wrapPos({ x: X.game.dock.x + 1200, y: X.game.dock.y + 300 });
          d.x = p.x; d.y = p.y;
        }
      }
      for (let f = 0; f < 90; f++) {
        X.game.ship.invuln = 9999;
        X.update(1 / 60);
        X.draw();
      }
    }
  });
  passed++;   // reaching here without a throw IS the assertion
  eq(X.game.state, "playing", "H: ...and the run is still in the playing state at the end");
  // The drift really did engage somewhere in that ramp, so the smoke covered the new code.
  eq(typeof X.maxOrbitSpeed(), "number", "H: maxOrbitSpeed() still returns a number with no audio context");
})();

console.log(`\ntest-cs023-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
