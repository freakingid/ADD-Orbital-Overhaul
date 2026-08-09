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
  // CS024 P4: levelDef dropped — the level table is deleted (replaced by the LEVERS odometer).
  // REPOINTED BY CS024 P5: FROZEN_JUNK_COUNT is deleted outright — P5 wires the real junkCount lever,
  // so leverState replaces it as this file's source of truth for the wave-21 spawn count.
  "game", "startGame", "update", "draw", "nextWave", "destroyDebris", "killShip", "leverState",
  "DebrisSatellite", "HunterSatellite", "Garbage", "Dock",
  // the CS023 P2 surface
  "debrisBounce", "DEBRIS_MASS", "DEBRIS_BOUNCE_RESTITUTION", "DEBRIS_BOUNCE_MIN",
  // its parent, for the derived-from-shieldBounce claims
  "shieldBounce", "SHIELD_BOUNCE_RESTITUTION", "SHIELD_BOUNCE_MIN", "SHIELD_RADIUS",
  // the orbit surface every rail-state expectation derives from
  // PRUNED BY CS024 P1: the seven orbit functions and eight ORBIT_* constants exported here no longer
  // exist in the build, so the factory's own return statement threw a ReferenceError on load.
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
// PRUNED BY CS024 P1: levelWithRings() (the first level at which the ramp had laid `want` rings) and
// railBodies() are gone with the rings. RING_LEVEL is what the rail-staging sites used to reach for — an
// ordinary level, since every level is now the same kind — kept as one named constant so the pruned
// sites still read as "a level deep enough to have a full field".
const RING_LEVEL = 12;
const freeBodies = X => X.game.debris.filter(d => !d.dead);

// A bare free satellite at a chosen place and velocity. The constructor's own random drift is
// overwritten, exactly as spawnOrbitWave overwrites it with orbitSyncVelocity — this is staging, not a
// reimplementation of anything.
function freeSat(X, x, y, size, vx, vy) {
  const d = new X.DebrisSatellite(x, y, size, 1);
  d.x = x; d.y = y; d.vx = vx; d.vy = vy;
  return d;
}
// REPOINTED BY CS024 P1: was TWELVE — CS021 P1b §E's twelve fields pinned on a RAIL-BORNE hazard across a
// shieldBounce, of which four (orbitAngle / orbitRadius / orbitAngVel / orbitCenter) were rail state and
// no longer exist on a DebrisSatellite. The remaining EIGHT still carry the claim that matters for the
// surviving free/SAUCER branch: the fixed partner is authoritative and NOTHING may write to it.
const TWELVE = ["x", "y", "vx", "vy", "angle", "spin", "dead", "guardT"];
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
  // REPOINTED BY CS024 P3, the same trap and the same fix as test-cs024-p1/p2: a bare `HEAD` reference
  // silently re-aims at whatever landed most recently, so these "BYTE-UNCHANGED vs the pre-edit build"
  // pins stopped meaning anything the moment CS024 P2 was committed. Pinned to the last commit before
  // CS023 P2 itself landed, which is what every claim in this section was always written against.
  const PRE_CS023_P2_REF = "300ac27";
  const preSrc = execFileSync("git", ["show", `${PRE_CS023_P2_REF}:asteroids-deluxe.html`], { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 })
    .toString().match(/<script>([\s\S]*?)<\/script>/)[1];
  const bodyOf = (src, sig) => { const i = src.indexOf(sig); return src.slice(i, src.indexOf("\n}\n", i)); };
  eq(bodyOf(scriptSrc, "function shieldBounce(obj) {"), bodyOf(preSrc, "function shieldBounce(obj) {"),
    "A: shieldBounce is BYTE-UNCHANGED — derived from, not edited");
  eq(bodyOf(scriptSrc, "function shieldDeflect(obj) {"), bodyOf(preSrc, "function shieldDeflect(obj) {"),
    "A: ...and so is shieldDeflect");
  // TRAP 2: coalesceGarbage and the Garbage class are out of scope for CS023 P2 (this phase never
  // touches either). REPOINTED BY CS024 P2 (spec §1.8): a LATER, unrelated phase deleted the dead
  // GARBAGE_CLUMP_MAXSPD off-by-default clamp guard (`if (GARBAGE_CLUMP_MAXSPD !== Infinity) {...}`,
  // permanently false since the constant was a literal `Infinity`) and its now-orphaned
  // clampGarbageSpeed() callee — that guard never fired at any point in this file's own history, so no
  // canister ever bounced off the CS023 P2 rewrite either way. The pin is repointed to prove the ONLY
  // diff from the pre-CS024-P2 body is that exact deletion, so this TRAP still catches an unrelated
  // change to the merge/attraction logic it actually cares about.
  // REPOINTED AGAIN BY CS024 P3. Both of these were WHOLE-BODY byte pins, and a whole-body pin can only
  // survive until the next phase edits the same code: CS024 P3 rewrote coalesceGarbage's merge and
  // conversion branches (permanent garbage, the overflow-destroy rule) and rewrote the Garbage class
  // itself (decay out, the monotonic `age` in). The claim this TRAP carries is NOT "these are frozen" —
  // it is "CS023 P2's satellite bounce never reached the garbage system," and that claim is timeless and
  // still exactly provable. Asserted directly instead of by textual identity to a moving reference.
  {
    const liveCoalesce = bodyOf(scriptSrc, "function coalesceGarbage(dt) {");
    const liveGarbage  = bodyOf(scriptSrc, "class Garbage {");
    const strip = t => t.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");
    for (const [name, body] of [["coalesceGarbage", liveCoalesce], ["class Garbage", liveGarbage]]) {
      assert(!/debrisBounce/.test(strip(body)), `A: TRAP 2 — ${name} never calls debrisBounce`);
      assert(!/DEBRIS_BOUNCE_(RESTITUTION|MIN)/.test(strip(body)), `A: TRAP 2 — ...and reads neither bounce constant`);
      assert(!/DEBRIS_MASS/.test(strip(body)), `A: TRAP 2 — ...nor the bounce system's mass table`);
    }
    // And the converse, which is the half a grep could not fake: every debrisBounce CALL SITE in live
    // source pairs two hazards, never a Garbage. The behavioural proof is in section (E) below.
    const bounceCalls = codeOnly.split("\n").filter(l => /debrisBounce\(/.test(l) && !/function debrisBounce/.test(l));
    assert(bounceCalls.length > 0, "A: TRAP 2 (sanity) — debrisBounce does have call sites");
    for (const l of bounceCalls) assert(!/garbage/i.test(l), `A: TRAP 2 — no debrisBounce call site mentions garbage: ${l.trim()}`);
  }
  // REPOINTED BY CS024 P1: destroyDebris can no longer be byte-pinned against the pre-CS023-P2 build,
  // because CS024 removed CS021 P1's rail handoff from its split branch (the `const tangent =
  // orbitTangent(a)` line and the two-line child fixup). The claim NARROWS rather than being dropped, and
  // it narrows in the direction that still means something: everything in destroyDebris OUTSIDE the split
  // branch — the dead flag, the score/achievement gate, the boom, the DEBRIS_GARBAGE fan-out — is still
  // byte-identical to the pre-CS023-P2 build, and the split branch is asserted positively to be the plain
  // three-child loop it was BEFORE CS021 P1 ever added the handoff.
  {
    const cut = t => t.slice(0, t.indexOf("  if (a.size > 1) {"));
    eq(cut(bodyOf(scriptSrc, "function destroyDebris(a, awardScore = true) {")),
       cut(bodyOf(preSrc, "function destroyDebris(a, awardScore = true) {")),
      "A: destroyDebris is BYTE-UNCHANGED up to its split branch — this phase creates and destroys nothing");
    const body = bodyOf(scriptSrc, "function destroyDebris(a, awardScore = true) {");
    assert(!/orbitTangent/.test(body),
      "A: REPOINTED BY CS024 P1 (inverted) — the split branch no longer calls orbitTangent");
    // REPOINTED BY CS024 P5: destroyDebris's split-child velocity is no longer a flat `speedMul` carried
    // in from the caller — P5 wires it to the CHILD's OWN size-tier lever (a large->medium split reads
    // junkSpeedMedium, a medium->small split reads junkSpeedSmall), read live at the point of use like
    // every other lever. The claim this section carries is unchanged — still the plain three-child loop,
    // still no rail handoff — only the argument it passes is now itself lever-derived rather than a
    // literal passed in from the parent's own spawn.
    assert(/const childId = a\.size - 1 === 2 \? "junkSpeedMedium" : "junkSpeedSmall";/.test(body),
      "A: REPOINTED BY CS024 P5 — the split child's lever id is chosen by the CHILD's own size tier");
    assert(/const speed = DEBUG\[childId\] \?\? lv\[childId\];/.test(body),
      "A: ...read live via the DEBUG-override-else-lever idiom, exactly like every other lever consumer");
    assert(/for \(let i = 0; i < 3; i\+\+\) \{\n\s+game\.debris\.push\(new DebrisSatellite\(a\.x, a\.y, a\.size - 1, speed\)\);/.test(body),
      "A: ...and the split is still the plain three-child loop, each child taking that same derived speed");
  }

  // --- wrap-awareness, asserted at the SITE rather than trusted (CLAUDE.md's single commonest bug source)
  assert(/angleTo\(r, f\)/.test(fnBody), "A: the free/saucer normal comes from angleTo (wrap-aware)");
  assert(/angleTo\(b, a\)/.test(fnBody), "A: the free/free normal comes from angleTo (wrap-aware)");
  assert(/Math\.sqrt\(dist2\(a, b\)\)/.test(fnBody), "A: the overlap depth comes from dist2 (wrap-aware)");
  eq((fnBody.match(/\bwrap\(/g) || []).length, 3, "A: wrap() is called after every positional push (free/saucer 1, free/free 2)");
  assert(!/Math\.hypot\(\s*[ab]\.x/.test(fnBody) && !/Math\.atan2\(\s*b\.y\s*-/.test(fnBody),
    "A: no naive Math.hypot/Math.atan2 over raw coordinate differences anywhere in the helper");

  // --- REPOINTED BY CS024 P1 (spec §4.1, consequence 1), to the mirror image at each of the three pins.
  // CS023 shipped `!!x.orbitCenter || x instanceof Saucer` and an explicit rail/rail early no-op
  // (Correction C11). With no body able to carry orbit state the predicate REDUCES to the Saucer test and
  // the FIXED/FIXED arm is unreachable at both call sites — the debris pair walk passes two satellites,
  // the UFO pass passes exactly one Saucer — so it is DELETED rather than left as a dead guard. All three
  // assertions invert: the reduced dispatch is pinned positively, and the no-op's ABSENCE is pinned so it
  // cannot creep back unnoticed.
  assert(/const aFixed = a instanceof Saucer, bFixed = b instanceof Saucer;/.test(fnBody),
    "A: REPOINTED BY CS024 P1 — the dispatch is the Saucer test alone, and still SYMMETRIC over both operands");
  assert(!/orbitCenter/.test(fnBody),
    "A: REPOINTED BY CS024 P1 (inverted) — debrisBounce reads orbitCenter NOWHERE");
  assert(!/if \(aFixed && bFixed\) return;/.test(fnBody),
    "A: REPOINTED BY CS024 P1 (inverted) — the FIXED/FIXED early no-op is GONE, not merely unreachable");
  assert(/if \(aFixed !== bFixed\) \{/.test(fnBody),
    "A: ...leaving exactly two branches — free/saucer and free/free");
  assert(!/orbitCenter/.test(bodyOf(scriptSrc, "  update(dt) {")),
    "A: ...and DebrisSatellite.update() has no motion-mode branch left to share the concept with");

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
    // REPOINTED BY CS023 P3: "immediately before Cleanup" is no longer true by itself — P3 inserted its
    // own UFO<->debris pass between this one and Cleanup (spec §4.6). What's still true, and what this
    // now checks, is that NOTHING but this loop's own closing braces sits between P2's pass and WHICHEVER
    // comes next — P3's pass if it's present, Cleanup otherwise — so a later phase inserting its own pass
    // here in turn will need the identical repoint, not a redesign.
    const iNext = codeOnly.indexOf("for (const s of game.saucers) {\n    if (s.dead) continue;\n    for (const a of game.debris) {", iPass);
    const boundary = iNext > 0 ? iNext : iCleanup;
    const between = codeOnly.slice(codeOnly.indexOf("\n", iPass), boundary);
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
    // ...and neither does the pass. Sliced from the pass's own banner to ITS OWN closing brace — the
    // outer loop's "\n  }\n" (2-space indent) immediately after the inner loop starts, NOT the next
    // known landmark further down: REPOINTED BY CS023 P3, which inserts its own UFO<->debris pass right
    // after this one and before Cleanup, so "const hadSaucer" is no longer adjacent to this pass's end.
    const iBanner = codeOnly.indexOf("  for (let i = 0; i < game.debris.length; i++) {");
    const iInner = codeOnly.indexOf("for (let j = i + 1", iBanner);
    const passSrc = codeOnly.slice(iBanner, codeOnly.indexOf("\n  }\n", iInner));
    for (const forbidden of ["damageShip", "destroySaucer", "destroyHunter", "destroyDebris",
                             "game.ship", "game.saucers", "game.hunters", "game.garbage", "game.chain"]) {
      assert(!passSrc.includes(forbidden), `A: TRAP 3 — the pass contains no reference to ${forbidden}`);
    }
  }
  // REPOINTED BY CS023 P3: this block is NO LONGER byte-unchanged from pre-P2 HEAD — P3, exactly the
  // very next phase this comment always named, added the mutual-damage kill calls here. The positive-
  // successor check: the block now carries P3's three kill call sites. (P2's OWN diff, already landed,
  // never touched this block — that historical fact doesn't need re-proving against a moving HEAD.)
  {
    const sliceOf = src => { const i = src.indexOf("  // --- Collisions: hazards vs ship ---");
                             return src.slice(i, src.indexOf("  // --- Hazards vs tow chain", i)); };
    const block = sliceOf(scriptSrc);
    assert(/if \(h instanceof HunterSatellite\) destroyHunter\(h, false\); else destroyDebris\(h, false\);/.test(block),
      "A: TRAP 3 REPOINTED — P3 landed: the hazards-vs-ship block now destroys the hazard too, awardScore=false");
    assert(/destroySaucer\(s, false\);/.test(block),
      "A: TRAP 3 REPOINTED — ...and the saucer sub-loop does too");
  }

  // --- TRAP 1 / TRAP 4
  eq(X.GAME_VERSION, "1.0.0.22", "A: TRAP 1 — GAME_VERSION unchanged (P5 bumps it)");
  // TRAP 4 — REPOINTED THREE TIMES NOW, and CS024 P1 is the first repoint that runs the other way.
  // CS023 P4 flipped these to their positive successors as the drift landed; P4B renamed them
  // (orbitGravityAccel -> debrisDriftAccel, ORBIT_GRAVITY_* -> DEBRIS_DRIFT_*). CS024 P1 REMOVES THE DRIFT
  // ENTIRELY (spec §1.5/§4.1), so every one of those claims inverts to an ABSENCE — which is the form
  // that now does the work, since a silently-restored drift is the thing this file should catch.
  // REPOINTED AGAIN BY CS024 P2: 35 -> 34 — freqJitter removed outright (spec §1.8/§5, frozen at 25%
  // via the FREQ_JITTER constant instead).
  // REPOINTED AGAIN BY CS024 P4: 36 -> 15 (the 21 tier knobs).
  // REPOINTED AGAIN BY CS024 P5: 15 -> 32. P5 rebuilt the registry outright to wire the levers: 17 new
  // lever knobs (def: null, the "follow the live odometer" sentinel) join the survivors across SHIP,
  // GARBAGE, CHAIN GUARD, DELIVERY, JUNK, HUNTER, UFO, GLOBAL — and garbageAttractDelay drops out with
  // the constant it derived from (retired outright, replaced by the coalescePause lever).
  eq(X.DEBUG_ENTRIES.length, 32, "A: TRAP 4 REPOINTED BY CS024 P5 — the debug registry is 32 value entries");
  eq(X.DEBUG_ENTRIES.filter(e => /bounce|restitution|gravity|drift|mass/i.test(e.id)).map(e => e.id).join(","),
    "debrisBounceRestitution",
    "A: REPOINTED BY CS024 P1 — debrisBounceRestitution is the ONLY survivor of CS023 P4's two knobs; debrisDriftAccel is gone");
  assert(!/\bdrifting\b/.test(codeOnly),
    "A: REPOINTED BY CS024 P1 (inverted) — the `drifting` field appears NOWHERE in executable source");
  eq((codeOnly.match(/function maxOrbitSpeed\(/g) || []).length, 0,
    "A: REPOINTED BY CS024 P1 (inverted) — maxOrbitSpeed is not defined at all");
  assert(!/DEBRIS_DRIFT_TRIGGER_R/.test(codeOnly) && !/DEBRIS_DRIFT_TARGET_R/.test(codeOnly) &&
         !/DEBRIS_DRIFT_ACCEL/.test(codeOnly),
    "A: REPOINTED BY CS024 P1 (inverted) — none of the three DEBRIS_DRIFT_* constants survive");
  assert(!/updateDebrisDrift/.test(codeOnly),
    "A: ...and updateDebrisDrift is neither defined nor called");
  // The seam this file reserved, and which P4 filled, is now EMPTY again — and stays empty.
  eq((codeOnly.match(/a\.drifting = b\.drifting = false;/g) || []).length, 0,
    "A: REPOINTED BY CS024 P1 (inverted) — debrisBounce's P4 drift-disarm line is gone with the drift");
  // REPOINTED BY CS023 P3: destroySaucer's awardScore parameter has now landed, exactly as this trap
  // always named it would — flipped to its positive successor rather than deleted.
  assert(/function destroySaucer\(s, awardScore = true\) \{/.test(codeOnly),
    "A: TRAP REPOINTED — destroySaucer now takes awardScore = true (P3 landed)");
  // REPOINTED BY CS024 P1: the "CS023 P4 SEAM" comment marked the spot in debrisBounce reserved for the
  // drift's disarm line. The drift is gone, so the seam marker goes with it — asserted as an absence, so
  // a reintroduced seam has to come back through this file rather than around it.
  assert(!/CS023 P4 SEAM/.test(scriptSrc),
    "A: REPOINTED BY CS024 P1 (inverted) — the P4 seam marker is gone from debrisBounce");

  // --- the docs are untouched this phase (TRAP 1's second half)
  const changed = execFileSync("git", ["diff", "--name-only", "HEAD"], { cwd: repoRoot }).toString().trim().split("\n").filter(Boolean);
  // REPOINTED BY CS024 P1, and this is a NARROWING with a reason rather than a convenience. The filter
  // used to include PLANNED-FEATURES-* and IMPLEMENTATION-PHASES-*, which are SPEC documents authored by
  // Paul and legitimately edited between build sessions — a phase-scoped "docs untouched" trap has no
  // business freezing them, and it fired on exactly that during CS024 P1 (an edit to P4's own prompt,
  // made outside the session and unrelated to any code change). What every phase's TRAP actually protects
  // is the SHIPPED-BEHAVIOUR documentation set — the GDD, its version history, and DIFFICULTY-LEVERS —
  // which is precisely the list CS024 P1's own TRAP 3 names. That list is what is checked now.
  const docs = changed.filter(f => /GDD|DIFFICULTY-LEVERS|VERSION-HISTORY/.test(f));
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
  // "Strictly decreasing below 1.0" is checked against a build whose CONSTANT is edited, exactly as
  // CS023 P1 §D exercised fast-ring lists it does not ship. The edit is one literal and is named here.
  // NOTE (CS023 P4): debrisBounce now reads DEBUG.debrisBounceRestitution rather than the constant, and
  // this sandbox goes on working UNCHANGED precisely because of the registry convention — the constant is
  // the entry's `def`, so patching it re-seeds the knob and the live value follows. That is the whole
  // reason the knob was wired that way rather than left as a dead slider.
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

// ============ (C), (D), (E) PRUNED BY CS024 P1 — their whole subject is gone ============
// Three sections stood here and all three were about RAILS, which no longer exist:
//   (C) FREE vs RAIL-BORNE as physics — shieldBounce's shape with the rail immovable, the twelve-field
//       byte-identity pin on the rail partner, the argument-order symmetry, and the deliberate
//       non-conservation of momentum against an immovable body.
//   (D) THE ASYMMETRY OVER 300 REAL FRAMES — a free satellite driven into a rail-borne one, proving the
//       rail body's trajectory was byte-identical with and without the contact.
//   (E) Correction C11 — RING vs RING IS UNREACHABLE, the geometric proof that two rail-borne bodies can
//       never touch (and the antipodal wrap-fold clearance CS023 P4c found underneath it).
//
// WHAT SURVIVES THEM IS NOT LOST. The free/FIXED branch those sections exercised is still live — a Saucer
// is now its only fixed partner — and it is covered by section (A)'s dispatch pins above, by CS023 P3's
// own UFO-vs-debris sections, and by test-cs024-p1.js §C, which sweeps BOTH surviving branches against a
// reference implementation of the pre-CS024 three-branch form across every size pair and an
// incoming-velocity grid. (E)'s subject in particular is not merely untested but IMPOSSIBLE: the branch
// it proved unreachable has been deleted, which section (A) now pins directly.

// ================= (F) spec §6 item 9 — WRAP CORRECTNESS, with a NAIVE CONTROL that must FAIL ========
(function sectionF() { withRandom(seededRandom(0xF0F0), () => {
  console.log("(F) wrap correctness at the seam, with a naive non-wrap normal as a LIVE control");
  const X = seededBuild(0xF001);
  X.startGame();
  atWave(X, RING_LEVEL);
  const [W, H] = X.worldDims(X.game.worldSize);
  // REPOINTED BY CS024 P1: every level runs at WORLD_SIZE_FIELD now (2560x1440), so the seam this section
  // exercises is the field world's seam. The claim — that wrap-aware measurement is load-bearing and a
  // naive one is wrong by a full world period — is unchanged and is proven against THIS world instead.
  eq(W, 2560, "F: (setup) the level is running in the field-sized world, the only size left");

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

  // PRUNED BY CS024 P1: a second sub-block stood here doing the same seam check FREE vs RAIL — a ring
  // straddling the world seam was the routine case on an orbit level, not the edge case. There are no
  // rings, so the sub-block has no subject; the wrap claim itself is fully carried by the free/free
  // sweep above, which is the branch that actually still runs in the shipped game.
}); })();

// ================= (G) THE PASS ITSELF, THROUGH REAL update(1/60) FRAMES =====================
(function sectionG() { withRandom(seededRandom(0x6060), () => {
  console.log("(G) the pass through real update(1/60) frames — and garbage canisters do NOT bounce");

  // (1) TWO OVERLAPPING FREE SATELLITES ON A FIELD LEVEL separate within ONE frame.
  {
    const X = seededBuild(0x6001);
    X.startGame();
    atWave(X, 4);
    // REPOINTED AGAIN BY CS024 P4: there is no level table left to hold a column, which makes the same
    // point more strongly than the absent-column check did — every level is the one kind, by
    // construction. (Checked off the export list rather than a probe(): this file already has a LOCAL
    // function called probe(level, seed, mode), and shadowing it here would be a trap for a later reader.)
    assert(X.levelDef === undefined, "G: (setup) there is no level table at all now; every level is the one kind");
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

  // (2) PRUNED BY CS024 P1. This staged THE MIXED POPULATION AN ORBIT LEVEL CARRIED — a field satellite
  //     spawned on top of a ring satellite, which used to pass straight through it (Correction C12's
  //     predicted fix) — and pinned that the ring satellite stayed exactly on its rail through the
  //     frame. With one population there is no mixture to stage: case (1) above already drives two
  //     free satellites through a real update(1/60) frame, which is now the only case that exists.

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

  // PRUNED BY CS024 P1: a sub-block here staged a RAIL-BORNE PARENT and pinned destroyDebris()'s
  // handoff — the three children leaving the rail as free bodies carrying the parent's instantaneous
  // orbital tangent as their identical velocity (FORK-CS021-C2 -> (i)). That handoff is removed with
  // the rails; every split child now takes the fresh random velocity its own constructor rolls, which
  // test-cs017-p3.js §D pins at every level.
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
//     peak, over 337 standing canisters. CS023's peak wave (level 21) is 31 satellites (REPOINTED BY
//     CS023 P4C: 29 -> 31, since the wider rings carry 18 ring satellites rather than 16), a ratio of
//     31/84 = 0.369. Canister VOLUME scales roughly linearly with satellite count and pair count
//     quadratically, so that ratio would project CS022's figure down to ~6,700 checks.
//   * THAT PROJECTION IS WRONG FOR GARBAGE, and CS023 P1 already measured why: it re-ran the same probe
//     on the new shell and got 36,816, six times the projection. Standing garbage is governed by how
//     fast coalescence MERGES, not by how much is emitted, so the entity-count ratio does not carry.
//     This is exactly why the two coalesce ceilings below are NOT re-derived downward (STATUS.md's
//     standing Known-issues rule) and are carried forward unchanged.
//   * THE RATIO ARGUMENT DOES CARRY FOR game.debris, because that population has no merge dynamics at
//     all — it is a closed-form function of the spawn count through the 3-way split cascade. So the
//     debris ceiling is derived from the cascade directly rather than from a scaling:
//       - level 21 spawns 31 size-3 satellites (18 ring + 13 field — P4C: was 16 + 13);
//       - the full cascade is 31 larges -> 93 mediums -> 279 smalls, i.e. 403 bodies ever created;
//       - the counter increments BEFORE the dead check (matching coalesceGarbage's own instrumentation),
//         and the pass runs BEFORE the end-of-frame filter, so the array length that matters is bounded
//         by all 377 coexisting in one frame — reachable only if every parent dies on the same frame its
//         children are born, i.e. the deliberately-unreachable blitz;
//       - C(403, 2) = 81,003 pair-checks (P4C: was C(377, 2) = 70,876 — the +2 satellites cost ~14% more
//         pairs, which is the quadratic sensitivity this ceiling's margin exists to absorb). That is a
//         HARD structural bound for one orbit level, because a wave cannot clear until game.debris is
//         empty, so nothing carries over from the level before.
//   * CEILING = 250,000, ~3.1x that bound (~3.5x before P4C). The margin covers the pair count's QUADRATIC sensitivity to a
//     body-count error (a 40% miss doubles the pairs) and the fact that the bound assumes exactly the
//     shipped spawn counts.
//   * A TIGHTER CEILING FOR THE REALISTIC PATH, derived the same way and also before measuring: a
//     progressive harvest converts tier by tier, so its peak array is the small-tier population, 279,
//     plus a handful of dead-but-unfiltered bodies. C(281, 2) = 39,340 (P4C: was C(263, 2) = 34,453).
//     CEILING = 100,000, ~2.5x — the same order of margin CS022 P3 used for its own realistic ceiling.
//   * NEITHER CEILING IS RAISED FOR P4C. The +2 satellites move both bounds by ~14%, well inside the
//     margins as derived, and moving a ceiling to accommodate a measurement is the one thing this gate
//     exists to prevent. If a later density change breaches one, that is a STOP AND REPORT, not a bump.
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
  // and looks like a pass. A fresh garbage burst cannot coalesce until its inert delay elapses, so
  // the control has to run well past that.
  {
    // REPOINTED BY CS024 P5: GARBAGE_COALESCE_DELAY is deleted outright, replaced by the coalescePause
    // lever. leverState joins the export list (DEBUG is already in the base RETURN list) so the control
    // window below can DERIVE itself from the LIVE lever — evaluated AFTER atWave(C, 4) sets game.wave,
    // exactly the real `DEBUG.coalescePause ?? leverState(game.wave).coalescePause` wired idiom — instead
    // of hard-coding a frame count or reaching for a constant that no longer exists.
    const C = withRandom(seededRandom(0x9101), () => buildFrom(instrumented, { extra: ["__PROBE", "leverState"] }));
    withRandom(seededRandom(0x9101), () => { C.startGame(); atWave(C, 4); });
    C.game.state = "playing"; C.game.paused = false;
    for (const d of C.game.debris.filter(d => !d.dead).slice(0, 8)) C.destroyDebris(d, true);
    let cd = 0, cc = 0;
    // REPOINTED BY CS024 P4: the window was a flat 300 frames (5.0 s), chosen when GARBAGE_COALESCE_DELAY
    // was 3.0 s. Gate A Q1 moved that constant to 5.0 s — exactly the old window — so the control was
    // sampling the last instant before any piece became active and the coalesce counter read 0, which is
    // precisely the false pass these two assertions exist to prevent. The window is now DERIVED from the
    // constant (delay + 5 s of live coalescence), so the next retune carries it instead of stranding it.
    // REPOINTED AGAIN BY CS024 P5: the constant itself is gone — replaced by the coalescePause lever, read
    // live at the wave this control actually runs at (4, set by atWave just above). At wave 4 the lever
    // reads 3.5 s (shorter than the old flat 5.0 s), so deriving live rather than restating a number is
    // exactly what keeps this control honest across a wave change or a future lever retune.
    const coalescePause = C.DEBUG.coalescePause ?? C.leverState(C.game.wave).coalescePause;
    const CONTROL_FRAMES = Math.ceil((coalescePause + 5) * 60);
    for (let i = 0; i < CONTROL_FRAMES; i++) {
      C.__PROBE.debrisPairs = 0; C.__PROBE.coalescePairs = 0;
      C.game.ship.hp = C.SHIP_MAX_HP; C.update(1 / 60);
      cd = Math.max(cd, C.__PROBE.debrisPairs); cc = Math.max(cc, C.__PROBE.coalescePairs);
    }
    assert(cd > 0, `H: (control) the DEBRIS pair counter is live — ${cd} checks in the worst of ${CONTROL_FRAMES} ordinary frames`);
    assert(cc > 0, `H: (control) the COALESCE pair counter is live — ${cc} checks in the worst of ${CONTROL_FRAMES} ordinary frames`);
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
  // REPOINTED BY CS024 P1. PEAK_SPAWN was 31 — CS022 P3's 18 ring satellites plus the 13-piece field
  // component an orbit level carried on top of them, amended by C16 from 29. With the rings gone, level
  // 21's spawn is simply the level table's own ceiling, and it is DERIVED from levelDef rather than
  // restated as a literal, so a future table retune carries this probe instead of stranding it.
  //   THE CEILINGS BELOW ARE DELIBERATELY NOT LOWERED TO MATCH. They are upper bounds derived before
  // measuring, and a gate whose bound tracks the measurement downward stops being a gate. The measured
  // headroom simply grew, which is reported in the summary rather than tuned away; CS024 P3 is the phase
  // that puts real pressure back on these counters (permanent garbage), and it should inherit bounds that
  // were not quietly ratcheted down first.
  let PEAK_SPAWN;
  {
    const V = seededBuild(0x9500);
    V.startGame();
    // REPOINTED BY CS024 P5: the level table is still gone, but the junk count is no longer frozen —
    // nextWave() now reads the wired junkCount lever live (DEBUG.junkCount ?? leverState(game.wave)
    // .junkCount), exactly like every other lever. junkCount is a DRIVER (floor 3, ceil 12, steps 10,
    // everyNLevels 1) that wraps back to its own floor every 10 levels; level 21 is 20 ticks in — two
    // full wraps, remainder 0 — so it lands exactly back on the floor, 3, the SAME number the retired
    // FROZEN_JUNK_COUNT held for one phase. Still DERIVED from the live lever rather than restated as a
    // literal, so a future retune of the junkCount table carries this probe instead of stranding it.
    //   THE CEILINGS BELOW ARE STILL DELIBERATELY NOT LOWERED TO MATCH — same reasoning as CS024 P1's
    // note: a gate whose bound tracks the measurement downward stops being a gate. Level 21 happening to
    // sit on a wrap boundary is a property of the odometer's arithmetic, not a choice made here — see the
    // note at GATE 1/2's vacuity floor below, which P5 was flagged to revisit and which this coincidence
    // means still applies.
    PEAK_SPAWN = V.leverState(21).junkCount;
    eq(PEAK_SPAWN, 3, "H: (validity) level 21's junkCount lever value is 3 — its own floor, since wave 21 lands exactly on a 10-level wrap boundary (CS024 P5)");
    eq(atWave(V, 21), PEAK_SPAWN, "H: (validity) ...and the real nextWave() spawns exactly that many");
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
  // REPOINTED BY CS024 P1. This used to ride on the blitz probe: at a 31-satellite peak wave the garbage
  // that cascade produced was itself enough to drive the coalesce counter past its realistic ceiling, so
  // the counter's teeth came free. A 13-satellite board does not produce that much garbage, so the claim
  // is moved onto a SANDBOX over-stress — exactly the idiom the debris counter above already uses, and
  // for exactly the same reason: a gate is only worth having if the instrument could register a breach.
  {
    const S = withRandom(seededRandom(0x9E00), () => buildFrom(instrumented, { extra: ["__PROBE"] }));
    withRandom(seededRandom(0x9E00), () => { S.startGame(); atWave(S, 4); });
    S.game.state = "playing"; S.game.paused = false;
    S.game.debris.length = 0;
    S.game.garbage.length = 0;
    const [W, H] = S.worldDims(S.game.worldSize);
    const NG = 1200;   // not reachable in play; it exists to show the counter scales and would show a breach
    withRandom(seededRandom(0x9E01), () => {
      for (let i = 0; i < NG; i++) {
        const g = new S.Garbage((i * 37) % W, (i * 53) % H, 0, 0);
        // coalesceGarbage's OUTER loop `continue`s past any piece still inside its inert window
        // (`a.coalesceDelay > 0`), so a board of fresh canisters would read ZERO and look like a pass —
        // the exact trap this file's own live-counter control at (H) setup warns about. Clearing the
        // delay is staging, not a reimplementation: it is the state a canister reaches on its own a
        // couple of seconds later.
        g.coalesceDelay = 0;
        S.game.garbage.push(g);
      }
    });
    S.__PROBE.coalescePairs = 0;
    S.game.ship.hp = S.SHIP_MAX_HP;
    S.update(1 / 60);
    assert(S.__PROBE.coalescePairs > COALESCE_HARVEST_CEILING,
      `H: (teeth) REPOINTED BY CS024 P1 — a ${NG}-canister sandbox board drives the coalesce counter to ` +
      `${S.__PROBE.coalescePairs.toLocaleString("en-US")} checks, ABOVE the ` +
      `${COALESCE_HARVEST_CEILING.toLocaleString("en-US")} gate, so a real breach could not go unseen`);
    console.log(`    teeth: a ${NG}-canister sandbox board registers ` +
                `${S.__PROBE.coalescePairs.toLocaleString("en-US")} coalesce pair checks`);
  }

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
  // REPOINTED BY CS024 P4, and this is a REAL loss of measurement power that is being recorded rather
  // than tuned away. Both thresholds were 1000, set when level 21 spawned 13 large satellites. P4 freezes
  // the junk count at 3 for one phase (TRAP 2 — the levers are built but not yet wired), so the harvest
  // cascade starts from under a quarter of the bodies and the worst frame does proportionally less work.
  // The GATE CEILINGS ABOVE ARE DELIBERATELY UNTOUCHED — lowering a bound to match a smaller measurement
  // is how a gate stops being a gate — so what moves is only the vacuity floor, and only far enough to
  // stay meaningful at 3 satellites.
  //   ⛔ P5 landed (nextWave() now reads leverState(game.wave).junkCount live), but level 21 did NOT
  // start spawning a bigger board: junkCount is a DRIVER that wraps back to its own floor (3) every 10
  // levels, and wave 21 is 20 ticks in — exactly two full wraps, remainder 0 — so it lands right back on
  // the same 3 that FROZEN_JUNK_COUNT held. The floor below is therefore STILL doing real work (measured
  // harvest.worstD is 351, comfortably over 100) and is left exactly where P4 set it rather than raised
  // on the strength of a prediction that didn't hold at this particular level.
  assert(harvest.worstD > 100,
    `H: (control) the harvest's worst debris frame really did substantial work (${harvest.worstD.toLocaleString("en-US")} checks ` +
    `over ${harvest.worstDBodies} bodies), so the ceiling is measuring something`);
  assert(harvest.worstC > 100,
    `H: (control) ...and so did its worst coalesce frame (${harvest.worstC.toLocaleString("en-US")} checks)`);
})();

// ================= (I) spec §6 item 19 — DETERMINISM =====================
(function sectionI() {
  console.log("(I) spec §6 item 19 — determinism under a seeded LCG");
  const run = () => withRandom(seededRandom(0xDE7E), () => {
    const B = build();
    B.startGame();
    atWave(B, RING_LEVEL);
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
  eq(a, b, "I: two seeded runs of a real bouncing level are byte-identical");
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
        atWave(X, occ * 3);
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
