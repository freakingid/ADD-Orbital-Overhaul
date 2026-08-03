// Headless test for CS021 Phase 1b — THE SHIP BOUNCES OFF A HAZARD IT CANNOT PUSH.
//
//   node scratchpad/test-cs021-p1b.js
//
// THE DEFECT (introduced by CS021 P1, found by Paul reading the P1 write-up, reproduced before any edit).
// shieldDeflect() shoves the HAZARD and never touches the ship. That separates every free-moving body,
// but a CS021 orbiting satellite has its position RE-DERIVED from its orbit angle every frame, so the
// shove is undone before it can separate and the identical contact re-presents on the very next frame.
// Measured on the P1 build at the pinned SHA below — shield held, no thrust, one hazard, 10 s:
//
//     placement                                   deflect frames   shield emptied   hull
//     ORBIT ring 1, ship at 68 px (shield-only)          5           0.10 s         250/250
//     ORBIT ring 1, ship at 50 px                        5           0.10 s         200/250 (one 50-dmg hit)
//     ORBIT ring 3 (fast), ship at 68 px                 5           0.10 s         250/250
//     FIELD control, ordinary drifting size-3            1           1.38 s         250/250
//
// The whole shield meter gone in 0.10 s against 1.38 s of ordinary SHIELD_DRAIN — a 14x drain — with no
// way to push clear. NOT a damage bug: once the shield collapses the ship's hitbox shrinks from
// SHIELD_RADIUS 26 to SHIP_RADIUS 13, so in the 59-72 px annulus it simply stops touching. It is a
// silent, instantaneous, total loss of a resource, with no feedback but five shieldPings in 83 ms.
//
// THE FIX. A body on a rail is effectively infinite mass, so the whole exchange goes to the SHIP:
// shieldBounce() is shieldDeflect()'s mirror image, gated at the one call site on `h.orbitCenter` (the
// same field the motion mode itself gates on — one concept, not two). The satellite is left COMPLETELY
// untouched; knocking a ring off its rail would be a different game (FORK-CS021-C2 keeps rings intact).
//
// The bounce is ELASTIC and computed in the HAZARD'S OWN FRAME, which is what makes the fast ring feel
// different from the slow ones: subtract the satellite's tangential velocity, reflect the APPROACHING
// component of what is left (restitution 1.0 — you get back exactly what you brought), add the
// satellite's velocity back. A SEPARATION FLOOR (SHIELD_BOUNCE_MIN) is applied last and is load-bearing,
// not decoration: reflection alone leaves a stationary ship stationary, and a stationary ship in contact
// is precisely the case this exists to fix.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, drive the ACTUAL startGame/update(1/60)/collision path. Section (B) additionally builds
// the pre-fix module from a FIXED SHA as a permanent red control — never HEAD, the trap test-cs017-p3.js
// fell into and CS017 P6 had to repoint.
//
// Sections:
//  (A) node --check + source pins, incl. TRAP 1 (GAME_VERSION) and TRAP 3 (DEBUG_VARS still 34)
//  (B) THE REGRESSION, CLOSED — the four placements above, fixed build vs. the pinned P1 build
//  (C) ELASTIC, IN THE HAZARD'S FRAME — reflection invariants over many incoming velocities
//  (D) THE SEPARATION FLOOR — a stationary ship gets ONE bounce, not one per frame
//  (E) THE SATELLITE IS UNTOUCHED — every field byte-identical, still exactly on its rail
//  (F) FIELD HAZARDS ARE UNTOUCHED — shieldDeflect still shoves them and still never moves the ship
//  (G) THE HOMING-HUNTER BRANCH IS UNTOUCHED — medium/small Hunters still die on the shield
//  (H) ACCOUNTING — one SHIELD_HIT_COST, one deflects++, one ping per bounce
//  (I) THE TOW CHAIN survives a bounce, including one that crosses the world seam
//  (J) WRAP CORRECTNESS — a bounce off a satellite sitting on the world edge
//  (K) AudioSys.ctx null smoke through a real shielded orbit level

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS021_HTML || path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// A FIXED SHA, never HEAD: 1aba2c2 is CS021 P1, the build that carries the defect.
const PRE_FIX_REF = "1aba2c2";

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) { assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want})`); }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.stack); } }

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check + source pins");
  const tmp = path.join(repoRoot, "scratchpad", "_cs021p1b_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
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

// Every symbol here exists in BOTH builds, so the same list drives the pre-fix module too.
// SHIELD_BOUNCE_* and shieldBounce are deliberately NOT in it — neither exists at PRE_FIX_REF.
const RETURN = [
  "game", "startGame", "update", "draw", "nextWave", "levelDef", "input", "dist2", "angleTo",
  "shieldDeflect", "DebrisSatellite", "HunterSatellite", "Garbage",
  "SHIELD_RADIUS", "SHIP_RADIUS", "SHIELD_HIT_COST", "SHIELD_DRAIN", "SHIELD_RECHARGE",
  "DEBRIS_RADII", "SHIP_MAX_HP", "KNOCKBACK_SPEED", "WORLD_W", "WORLD_H", "TAU",
  "AudioSys", "GAME_VERSION", "DEBUG_VARS",
];
// CS022 P1: worldDims joins the FIXED-build-only list rather than RETURN — it does not exist at
// PRE_FIX_REF, and the RETURN list above is shared with that older build. Sections (I)/(J) need it
// because they place things at a WORLD SEAM on an ORBIT level, where the live torus is 5120x2880
// while this file's destructured WORLD_W/WORLD_H are a load-time snapshot of the field size.
const FIXED_EXTRA = ["shieldBounce", "SHIELD_BOUNCE_RESTITUTION", "SHIELD_BOUNCE_MIN", "worldDims"];

const SPIES = [
  "__spyPing(fn) { const o = AudioSys.shieldPing; AudioSys.shieldPing = fn; return o; }",
];

function build({ audio = true, src = scriptSrc, extra = FIXED_EXTRA } = {}) {
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
  const names = RETURN.concat(extra);
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + names.join(", ") + ", " + SPIES.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}

let preFixSrcCache = null;
function preFixSrc() {
  if (preFixSrcCache === null) {
    const preHtml = execSync(`git show ${PRE_FIX_REF}:asteroids-deluxe.html`, { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    const pm = preHtml.match(/<script>([\s\S]*?)<\/script>/);
    if (!pm) throw new Error(`could not extract <script> from ${PRE_FIX_REF}`);
    preFixSrcCache = pm[1];
  }
  return preFixSrcCache;
}
const buildPreFix = () => build({ src: preFixSrc(), extra: [] });

function seededRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function withRandom(gen, fn) {
  const saved = Math.random;
  Math.random = gen;
  try { return fn(); } finally { Math.random = saved; }
}

// ---- shared staging (drives the REAL entry points; nothing is reimplemented) ----

// Reach `level` through the REAL nextWave(), then reduce the board to ONE hazard so nothing else can
// touch the ship, and push every spawn timer out of reach. Returns that hazard.
function stage(X, level, pick) {
  withRandom(seededRandom(0xABCD), () => {
    X.startGame();
    X.game.wave = level - 1; X.game.debris.length = 0;
    X.nextWave();
  });
  X.game.state = "playing"; X.game.paused = false;
  X.game.saucerTimer = 1e6; X.game.hunterTimer = 1e6; X.game.healthTimer = 1e6;
  X.game.garbage.length = 0; X.game.hunters.length = 0; X.game.bullets.length = 0;
  X.game.powerups.length = 0; X.game.floaters.length = 0; X.game.chain.length = 0;
  const h = pick(X.game.debris);
  X.game.debris.length = 0; X.game.debris.push(h);
  X.game.ship.hp = X.SHIP_MAX_HP; X.game.ship.energy = 1.0;
  X.game.ship.vx = 0; X.game.ship.vy = 0; X.game.ship.invuln = 0;
  // Hold the shield down and nothing else, for the whole run.
  X.input.shield = () => true;
  X.input.thrust = () => false; X.input.left = () => false; X.input.right = () => false;
  X.input.fire = () => false;
  return h;
}
// Park the ship `d` px from the hazard's centre, along the hazard's own outward ray.
function placeShipAt(X, h, d) {
  const ang = h.orbitCenter ? h.orbitAngle : Math.atan2(h.vy, h.vx) || 0;
  X.game.ship.x = h.x + Math.cos(ang) * d;
  X.game.ship.y = h.y + Math.sin(ang) * d;
  X.game.ship.vx = 0; X.game.ship.vy = 0;
}
// The probe that found the defect, run against whichever build is handed in.
function contactRun(X, { level, ringRadius, startDist, frames = 600 }) {
  const h = stage(X, level, ds => ringRadius ? ds.find(d => d.orbitRadius === ringRadius) : ds[0]);
  placeShipAt(X, h, startDist);
  let deflectFrames = 0, shieldGoneFrame = null, hits = 0;
  for (let f = 1; f <= frames; f++) {
    const before = X.game.stats.deflects, hpBefore = X.game.ship.hp;
    X.update(1 / 60);
    if (X.game.stats.deflects > before) deflectFrames++;
    if (shieldGoneFrame === null && !X.game.ship.shieldOn && X.game.ship.energy <= 0.02) shieldGoneFrame = f;
    if (X.game.ship.hp < hpBefore) hits++;
    if (X.game.ship.dead) break;
  }
  return { deflectFrames, shieldGoneFrame, hits, hp: X.game.ship.hp, dead: X.game.ship.dead };
}

// ================= (A, part 2) source pins =====================
(function sectionA_pins() {
  const X = build();
  const codeOnly = scriptSrc.split("\n").filter(l => !l.trim().startsWith("//")).join("\n");

  // TRAP 1 — REPOINTED BY CS021 P5: the bump has landed, so this becomes its mirror image.
  assert(X.GAME_VERSION !== "1.0.0.20", "A: TRAP 1 — GAME_VERSION moved off the pre-CS021 baseline (P5 bumped it)");
  // REPOINTED BY CS021 P3: the ORBIT section (10 knobs) landed, taking DEBUG_VARS from 34 to 44.
  eq(X.DEBUG_VARS.filter(v => !v.header).length, 44, "A: TRAP 3 — DEBUG_VARS has exactly 44 value entries (34 + CS021 P3's ORBIT section)");

  eq((scriptSrc.match(/function shieldBounce\(/g) || []).length, 1, "A: exactly one shieldBounce definition");
  eq((codeOnly.match(/\bshieldBounce\(/g) || []).length, 2, "A: exactly TWO shieldBounce mentions in live code — the definition and ONE call site");

  // The call site is gated on the SAME field the motion mode gates on, and only there.
  assert(/} else if \(h\.orbitCenter\) \{[\s\S]{0,600}shieldBounce\(h\);/.test(codeOnly),
    "A: the call site is `else if (h.orbitCenter)` and calls shieldBounce(h)");
  assert(/shieldBounce\(h\);[\s\S]{0,120}\} else \{[\s\S]{0,80}shieldDeflect\(h\);/.test(codeOnly),
    "A: ...and shieldDeflect is still the else branch, reached by every non-rail hazard");
  assert(/h instanceof HunterSatellite && h\.size < 3[\s\S]{0,400}destroyHunter\(h\);[\s\S]{0,600}\} else if \(h\.orbitCenter\)/.test(codeOnly),
    "A: the homing-Hunter branch is still FIRST — a medium/small Hunter can never reach the bounce");

  // shieldDeflect is byte-untouched and still never touches the ship's position or velocity.
  const deflectBody = scriptSrc.match(/function shieldDeflect\(obj\) \{[\s\S]*?\n\}/)[0];
  assert(!/game\.ship\.(x|y|vx|vy)\s*=/.test(deflectBody),
    "A: shieldDeflect still never assigns game.ship.x/y/vx/vy — it moves the HAZARD only");
  assert(/obj\.x = game\.ship\.x \+ Math\.cos\(a\)/.test(deflectBody), "A: ...and still pushes the hazard out of overlap exactly as before");

  // shieldBounce is the exact mirror: it must never touch the hazard.
  const bounceBody = scriptSrc.match(/function shieldBounce\(obj\) \{[\s\S]*?\n\}/)[0];
  assert(!/obj\.(x|y|vx|vy|orbitAngle|orbitRadius|orbitAngVel|orbitCenter)\s*=/.test(bounceBody),
    "A: shieldBounce never assigns to the hazard — the satellite stays on its rail");
  assert(/game\.ship\.x = obj\.x/.test(bounceBody) && /game\.ship\.y = obj\.y/.test(bounceBody),
    "A: shieldBounce separates the SHIP out of overlap");
  assert(/wrap\(game\.ship\)/.test(bounceBody), "A: ...and wraps it with the same helper Ship.update() uses");
  assert(/angleTo\(obj, game\.ship\)/.test(bounceBody), "A: the contact normal is derived with the wrap-aware angleTo");
  assert(/game\.ship\.energy = Math\.max\(0, game\.ship\.energy - SHIELD_HIT_COST\)/.test(bounceBody),
    "A: a bounce costs the same SHIELD_HIT_COST as a deflect");
  assert(/game\.stats\.deflects\+\+/.test(bounceBody), "A: ...and counts as the same Shield Surfer event");

  // Tuning lives in named constants, never inline at the call site.
  assert(/SHIELD_BOUNCE_RESTITUTION/.test(bounceBody) && /SHIELD_BOUNCE_MIN/.test(bounceBody),
    "A: both tuning values are named constants read inside shieldBounce");
  eq(X.SHIELD_BOUNCE_RESTITUTION, 1.0, "A: restitution ships at 1.0 — literally reflect incoming speed");
  eq(X.SHIELD_BOUNCE_MIN, 120, "A: the separation floor ships at 120 px/s");
  assert(X.SHIELD_BOUNCE_MIN < X.KNOCKBACK_SPEED,
    `A: the floor stays well under KNOCKBACK_SPEED (${X.KNOCKBACK_SPEED}) — a graze nudges, it does not launch`);
  eq((codeOnly.match(/const SHIELD_BOUNCE_RESTITUTION/g) || []).length, 1, "A: restitution declared exactly once");
  eq((codeOnly.match(/const SHIELD_BOUNCE_MIN/g) || []).length, 1, "A: the floor declared exactly once");
})();

// ================= (B) THE REGRESSION, CLOSED =====================
(function sectionB() {
  console.log("(B) the regression: fixed build vs. the pinned P1 build at " + PRE_FIX_REF);
  const CASES = [
    { name: "ORBIT ring 1 (slow), ship at 68 px — the shield-only annulus", level: 3, ringRadius: 180, startDist: 68 },
    { name: "ORBIT ring 1, ship at 50 px — the unshielded hitbox also reaches", level: 3, ringRadius: 180, startDist: 50 },
    { name: "ORBIT ring 3 (fast), ship at 68 px", level: 3, ringRadius: 480, startDist: 68 },
  ];
  for (const c of CASES) {
    const pre = contactRun(buildPreFix(), c);
    const fix = contactRun(build(), c);
    // The pre-fix build is a PERMANENT RED CONTROL: if this stops reproducing, the control is broken,
    // not the fix. Five consecutive deflect frames and a meter emptied inside a tenth of a second.
    eq(pre.deflectFrames, 5, `B: PRE-FIX ${c.name}: five deflect frames`);
    assert(pre.shieldGoneFrame !== null && pre.shieldGoneFrame <= 8,
      `B: PRE-FIX ${c.name}: the whole shield meter is gone by frame ${pre.shieldGoneFrame} (<= 8)`);
    // And the fix: ONE deflect, and the meter now lasts as long as ordinary SHIELD_DRAIN allows.
    eq(fix.deflectFrames, 1, `B: FIXED ${c.name}: exactly ONE deflect for the whole contact`);
    assert(fix.shieldGoneFrame > 60,
      `B: FIXED ${c.name}: the meter now survives past a second (frame ${fix.shieldGoneFrame})`);
    assert(fix.shieldGoneFrame > pre.shieldGoneFrame * 8,
      `B: FIXED ${c.name}: the meter lasts >8x longer than pre-fix (${fix.shieldGoneFrame} vs ${pre.shieldGoneFrame} frames)`);
    eq(fix.dead, false, `B: FIXED ${c.name}: the ship survives`);
  }
  // The 50 px case took a real 50-damage hit pre-fix, because the shield collapsed while the ship was
  // still inside the UNSHIELDED contact radius. The bounce clears it before that can happen.
  const preClose = contactRun(buildPreFix(), CASES[1]);
  const fixClose = contactRun(build(), CASES[1]);
  eq(preClose.hits, 1, "B: PRE-FIX at 50 px: the ship took exactly one hit once its shield collapsed");
  assert(preClose.hp < 250, `B: PRE-FIX at 50 px: hull dropped to ${preClose.hp}`);
  eq(fixClose.hits, 0, "B: FIXED at 50 px: no hit at all — the bounce separates before the shield can collapse");
  eq(fixClose.hp, 250, "B: FIXED at 50 px: hull untouched");

  // The FIELD control is the yardstick, and it must be IDENTICAL on both builds — this phase changes
  // nothing for a hazard that can be pushed.
  const fieldCase = { name: "FIELD control, ordinary drifting size-3", level: 4, ringRadius: null, startDist: 68 };
  const preField = contactRun(buildPreFix(), fieldCase);
  const fixField = contactRun(build(), fieldCase);
  eq(fixField.deflectFrames, preField.deflectFrames, "B: FIELD control: deflect count identical on both builds");
  eq(fixField.shieldGoneFrame, preField.shieldGoneFrame, "B: FIELD control: shield lifetime identical on both builds");
  eq(fixField.hits, preField.hits, "B: FIELD control: hits identical on both builds");
  eq(fixField.deflectFrames, 1, "B: FIELD control: one deflect, as it always was");
  // ...and the fixed ORBIT case now matches the FIELD yardstick exactly.
  const fixOrbit = contactRun(build(), CASES[0]);
  eq(fixOrbit.deflectFrames, fixField.deflectFrames, "B: a fixed ORBIT contact now costs the same as a FIELD contact");
  eq(fixOrbit.shieldGoneFrame, fixField.shieldGoneFrame, "B: ...and leaves the shield meter lasting exactly as long");
})();

// ================= (C) ELASTIC, IN THE HAZARD'S FRAME =====================
// The claims are PHYSICS INVARIANTS, not a copy of the implementation: in the hazard's own frame the
// tangential component of the ship's velocity is untouched and the approaching normal component is
// reflected with restitution SHIELD_BOUNCE_RESTITUTION. The world-frame floor is applied along the
// normal only, so it can raise the normal component but can never disturb the tangential one.
(function sectionC() {
  console.log("(C) the bounce is elastic and computed in the hazard's frame");
  const X = build();

  function bounceOnce(h, vx, vy) {
    X.game.ship.vx = vx; X.game.ship.vy = vy;
    const a = X.angleTo(h, X.game.ship);
    const n = [Math.cos(a), Math.sin(a)];
    const t = [-n[1], n[0]];
    const before = { vx, vy, hvx: h.vx, hvy: h.vy };
    X.shieldBounce(h);
    const after = { vx: X.game.ship.vx, vy: X.game.ship.vy };
    const uB = [before.vx - before.hvx, before.vy - before.hvy];
    const uA = [after.vx - before.hvx, after.vy - before.hvy];
    return {
      n, t,
      unBefore: uB[0] * n[0] + uB[1] * n[1], unAfter: uA[0] * n[0] + uA[1] * n[1],
      utBefore: uB[0] * t[0] + uB[1] * t[1], utAfter: uA[0] * t[0] + uA[1] * t[1],
      worldOut: after.vx * n[0] + after.vy * n[1],
      speedBefore: Math.hypot(before.vx, before.vy), speedAfter: Math.hypot(after.vx, after.vy),
      hazardVx: h.vx, hazardVy: h.vy,
    };
  }

  for (const ring of [180, 480]) {              // one slow ring and the fast one
    const h = stage(X, 3, ds => ds.find(d => d.orbitRadius === ring));
    const a = X.angleTo(h, { x: h.x + 1, y: h.y });   // any reference; recomputed per bounce below
    const label = `ring r=${ring}`;
    // A spread of incoming velocities: head-on fast, head-on slow, oblique, tangential, and receding.
    const cases = [];
    for (const speed of [400, 220, 60, 0]) {
      for (const dir of [0, 0.6, 1.2, Math.PI / 2, Math.PI]) {
        cases.push({ speed, dir });
      }
    }
    let reflected = 0, floored = 0;
    for (const c of cases) {
      placeShipAt(X, h, X.SHIELD_RADIUS + h.radius - 4);
      const ang = X.angleTo(h, X.game.ship);
      // `dir` 0 = straight at the satellite, PI = straight away from it.
      const vdir = ang + Math.PI + c.dir;
      const r = bounceOnce(h, Math.cos(vdir) * c.speed, Math.sin(vdir) * c.speed);
      // TANGENTIAL IS NEVER TOUCHED — by the reflection or by the floor.
      close(r.utAfter, r.utBefore, `C: ${label} v=${c.speed} d=${c.dir.toFixed(2)}: tangential component preserved`, 1e-9);
      if (r.unBefore < 0) {
        // Approaching. If the floor did not bind, the reflection is exact.
        const reflectedNormal = -X.SHIELD_BOUNCE_RESTITUTION * r.unBefore;
        const wouldBeWorldOut = reflectedNormal + (r.hazardVx * r.n[0] + r.hazardVy * r.n[1]);
        if (wouldBeWorldOut >= X.SHIELD_BOUNCE_MIN) {
          reflected++;
          close(r.unAfter, reflectedNormal, `C: ${label} v=${c.speed} d=${c.dir.toFixed(2)}: approaching normal reflected at restitution ${X.SHIELD_BOUNCE_RESTITUTION}`, 1e-9);
        } else {
          floored++;
          close(r.worldOut, X.SHIELD_BOUNCE_MIN, `C: ${label} v=${c.speed} d=${c.dir.toFixed(2)}: floor bound, world outward === SHIELD_BOUNCE_MIN`, 1e-9);
        }
      } else {
        // Already moving away in the hazard's frame — never yanked backwards.
        assert(r.unAfter >= r.unBefore - 1e-9,
          `C: ${label} v=${c.speed} d=${c.dir.toFixed(2)}: a receding ship is not pulled back`);
      }
      // Every bounce, without exception, leaves the ship with real outward speed.
      assert(r.worldOut >= X.SHIELD_BOUNCE_MIN - 1e-9,
        `C: ${label} v=${c.speed} d=${c.dir.toFixed(2)}: world outward speed >= the floor (${r.worldOut.toFixed(2)})`);
    }
    assert(reflected > 0, `C: ${label}: (control) the pure-reflection path was genuinely exercised (${reflected} cases)`);
    assert(floored > 0, `C: ${label}: (control) the floor path was genuinely exercised (${floored} cases)`);
  }

  // THE FLAVOUR CLAIM, and the reason the hazard's own frame is the right one to work in: A SATELLITE
  // THAT SWEEPS INTO A PARKED SHIP SHOVES IT AT TWICE THE SATELLITE'S OWN SPEED. That is the classic
  // elastic result against an infinite mass, and it is what makes the fast ring a different hazard
  // rather than just a faster-looking one.
  //
  // The geometry matters and is easy to get wrong. The ship has to be parked directly AHEAD of the
  // satellite ALONG ITS PATH, so the contact normal lines up with the satellite's velocity. A ship
  // parked radially outward from a satellite has a normal PERPENDICULAR to that velocity — no normal
  // component to reflect — so a pure sideswipe correctly does nothing at all. (My first draft used the
  // radial placement and measured both rings as identical: the right answer to the wrong question.)
  const swept = {};
  for (const ring of [180, 480]) {
    const sat = stage(X, 3, ds => ds.find(d => d.orbitRadius === ring));
    const tangential = Math.hypot(sat.vx, sat.vy);
    const dirA = Math.atan2(sat.vy, sat.vx);
    X.game.ship.x = sat.x + Math.cos(dirA) * (X.SHIELD_RADIUS + sat.radius - 4);
    X.game.ship.y = sat.y + Math.sin(dirA) * (X.SHIELD_RADIUS + sat.radius - 4);
    const r = bounceOnce(sat, 0, 0);                  // parked, directly in its path
    swept[ring] = { tangential, after: r.speedAfter };
    const wantElastic = (1 + X.SHIELD_BOUNCE_RESTITUTION) * tangential;
    if (wantElastic >= X.SHIELD_BOUNCE_MIN) {
      close(r.speedAfter, wantElastic,
        `C: ring r=${ring}: a sweeping satellite shoves a parked ship at 2x its own ${tangential.toFixed(1)} px/s`, 1e-6);
    } else {
      close(r.speedAfter, X.SHIELD_BOUNCE_MIN,
        `C: ring r=${ring}: too slow to out-push the floor (2x${tangential.toFixed(1)} < ${X.SHIELD_BOUNCE_MIN}), so the floor governs`, 1e-6);
    }
  }
  assert(swept[480].after > swept[180].after * 2,
    `C: the FAST ring shoves a parked ship far harder than a slow one ` +
    `(${swept[480].after.toFixed(1)} vs ${swept[180].after.toFixed(1)} px/s) — working in the hazard's frame is what carries that`);
  console.log(`    swept while parked: ring 1 (${swept[180].tangential.toFixed(1)} px/s) throws you at ` +
    `${swept[180].after.toFixed(1)} px/s; ring 3 (${swept[480].tangential.toFixed(1)} px/s) throws you at ${swept[480].after.toFixed(1)} px/s`);

  // And the mirror, which is the same physics seen from the other side: a purely TANGENTIAL approach is
  // a sideswipe with no normal component, so the reflection is a no-op and only the floor acts. That is
  // true on the fast ring exactly as on the slow ones, by design.
  const fast = stage(X, 3, ds => ds.find(d => d.orbitRadius === 480));
  assert(Math.hypot(fast.vx, fast.vy) > 100, `C: (setup) the fast ring's satellite really is moving`);
  placeShipAt(X, fast, X.SHIELD_RADIUS + fast.radius - 4);   // radial: normal perpendicular to its velocity
  const along = bounceOnce(fast, fast.vx, fast.vy);          // riding with it: zero relative velocity
  close(along.unBefore, 0, "C: riding alongside a satellite really is zero relative normal velocity", 1e-9);
  // With nothing approaching to reflect, EVERY bit of the outgoing normal speed came from the floor —
  // which is the observable form of "the reflection was a no-op". (Measuring unAfter against unBefore
  // would be wrong: unAfter is read after the floor has already acted, so it is 0 + the floor.)
  close(along.unAfter, X.SHIELD_BOUNCE_MIN, "C: ...so all of the outgoing normal speed is the floor's, none the reflection's", 1e-9);
  close(along.worldOut, X.SHIELD_BOUNCE_MIN, "C: ...and the world-frame outward speed is exactly the floor", 1e-9);
  close(along.utAfter, along.utBefore, "C: ...with the tangential component still untouched", 1e-9);
})();

// ================= (D) THE SEPARATION FLOOR =====================
(function sectionD() {
  console.log("(D) the floor: a stationary ship gets ONE bounce, not one per frame");
  for (const ring of [180, 330, 480, 630]) {
    const X = build();
    const h = stage(X, 3, ds => ds.find(d => d.orbitRadius === ring));
    placeShipAt(X, h, X.SHIELD_RADIUS + h.radius - 4);   // stationary, inside the shield contact radius
    eq(X.game.ship.vx, 0, `D: ring r=${ring}: (setup) the ship starts at rest`);
    let deflectFrames = 0;
    for (let f = 0; f < 180; f++) {
      const before = X.game.stats.deflects;
      X.update(1 / 60);
      if (X.game.stats.deflects > before) deflectFrames++;
    }
    eq(deflectFrames, 1, `D: ring r=${ring}: a stationary ship in contact is bounced exactly ONCE in 3 s`);
  }
  // The energy claim, measured over a SHORT window so the reading is not swamped by SHIELD_DRAIN — the
  // shield costs 0.55/s just to hold, which empties the meter in 1.8 s regardless of contacts, so a
  // 3 s window above can say nothing about hit costs. Ten frames is long enough to catch a repeat and
  // short enough that the arithmetic is exact.
  for (const ring of [180, 480]) {
    const X = build();
    const h = stage(X, 3, ds => ds.find(d => d.orbitRadius === ring));
    placeShipAt(X, h, X.SHIELD_RADIUS + h.radius - 4);
    const FR = 10;
    for (let f = 0; f < FR; f++) X.update(1 / 60);
    const wantHold = X.SHIELD_DRAIN * (FR / 60);
    close(X.game.ship.energy, 1 - X.SHIELD_HIT_COST - wantHold,
      `D: ring r=${ring}: over 10 frames the meter paid ONE SHIELD_HIT_COST plus the ordinary hold cost`, 1e-9);
    assert(X.game.ship.energy > 1 - 2 * X.SHIELD_HIT_COST - wantHold,
      `D: ring r=${ring}: ...and provably not two or more (energy ${X.game.ship.energy.toFixed(4)})`);
  }
  // The floor really is what does it: the outward speed immediately after a from-rest bounce is exactly
  // SHIELD_BOUNCE_MIN, because a ship at rest has no approaching component to reflect.
  const X = build();
  const h = stage(X, 3, ds => ds.find(d => d.orbitRadius === 180));
  placeShipAt(X, h, X.SHIELD_RADIUS + h.radius - 4);
  const a = X.angleTo(h, X.game.ship);
  X.shieldBounce(h);
  const outward = X.game.ship.vx * Math.cos(a) + X.game.ship.vy * Math.sin(a);
  close(outward, X.SHIELD_BOUNCE_MIN, "D: a bounce from rest leaves exactly SHIELD_BOUNCE_MIN of outward speed", 1e-9);
  const sep = Math.sqrt(X.dist2(X.game.ship, h));
  close(sep, X.SHIELD_RADIUS + h.radius + 2, "D: ...and the ship is separated to just outside the contact radius", 1e-6);

  // WHAT THE FLOOR ACTUALLY BUYS, behaviourally. The overlap push alone gives 2 px of clearance, so a
  // ship parked radially beside a slow satellite happens to separate even without the floor — which is
  // why the cases below, not the one above, are the ones that pin it. Each is something a player does
  // on purpose: fly INTO the ring under thrust, sit in a satellite's path, or arrive with a full tow
  // whose CARGO_TUG drags them straight back in. Measured deflect events over 5 s with the floor at its
  // shipped 120; at 0 they come out 2 / 2 / 5 respectively.
  //
  // The meter is held full each frame deliberately: SHIELD_DRAIN empties it in 1.8 s, and a collapsed
  // shield stops the contact entirely (the hitbox shrinks from SHIELD_RADIUS to SHIP_RADIUS), so
  // without this the count would be truncated by the drain rather than measuring re-contact.
  function contactEvents({ ring, placement, thrust = false, chain = false, frames = 300 }) {
    const Y = build();
    const h = stage(Y, 3, ds => ds.find(d => d.orbitRadius === ring));
    const d = Y.SHIELD_RADIUS + h.radius - 4;
    const ang = placement === "radial" ? h.orbitAngle : Math.atan2(h.vy, h.vx);
    Y.game.ship.x = h.x + Math.cos(ang) * d;
    Y.game.ship.y = h.y + Math.sin(ang) * d;
    Y.game.ship.vx = 0; Y.game.ship.vy = 0;
    Y.game.ship.angle = ang + Math.PI;              // nose pointed AT the satellite, for the thrust case
    Y.input.thrust = () => thrust;
    if (chain) for (let i = 0; i < 12; i++) Y.game.chain.push({
      x: Y.game.ship.x + Math.cos(ang) * (i + 1) * 4, y: Y.game.ship.y + Math.sin(ang) * (i + 1) * 4,
      px: Y.game.ship.x + Math.cos(ang) * (i + 1) * 4, py: Y.game.ship.y + Math.sin(ang) * (i + 1) * 4,
      spin: 0, spinRate: 0, mass: 1, towed: true });
    let events = 0;
    for (let f = 0; f < frames; f++) {
      const b = Y.game.stats.deflects;
      Y.game.ship.energy = 1.0;
      Y.update(1 / 60);
      if (Y.game.stats.deflects > b) events++;
    }
    return events;
  }
  eq(contactEvents({ ring: 180, placement: "swept" }), 1,
    "D: parked in a slow satellite's PATH: one contact event in 5 s (two without the floor)");
  eq(contactEvents({ ring: 180, placement: "radial", thrust: true }), 2,
    "D: flying INTO the ring under held thrust: two contact events in 5 s (five without the floor)");
  eq(contactEvents({ ring: 180, placement: "radial", chain: true }), 1,
    "D: arriving with a 12-node tow whose CARGO_TUG pulls back in: one event in 5 s (two without the floor)");
})();

// ================= (E) THE SATELLITE IS UNTOUCHED =====================
(function sectionE() {
  console.log("(E) the hazard is left completely alone — the ring stays intact");
  const X = build();
  const h = stage(X, 3, ds => ds.find(d => d.orbitRadius === 480));
  placeShipAt(X, h, X.SHIELD_RADIUS + h.radius - 4);
  X.game.ship.vx = -300; X.game.ship.vy = 120;
  const snap = { x: h.x, y: h.y, vx: h.vx, vy: h.vy, angle: h.angle, spin: h.spin,
                 orbitAngle: h.orbitAngle, orbitRadius: h.orbitRadius, orbitAngVel: h.orbitAngVel,
                 orbitCenter: h.orbitCenter, dead: h.dead, guardT: h.guardT };
  X.shieldBounce(h);
  for (const k of Object.keys(snap)) eq(h[k], snap[k], `E: the bounce left hazard.${k} byte-identical`);
  close(Math.sqrt(X.dist2(h, h.orbitCenter)), h.orbitRadius, "E: and it is still exactly on its rail", 1e-6);

  // Over a real contact through update(), across every ring, the satellite never leaves its ring.
  for (const ring of [180, 330, 480, 630]) {
    const Y = build();
    const s = stage(Y, 3, ds => ds.find(d => d.orbitRadius === ring));
    placeShipAt(Y, s, Y.SHIELD_RADIUS + s.radius - 4);
    let worst = 0;
    for (let f = 0; f < 300; f++) {
      Y.update(1 / 60);
      worst = Math.max(worst, Math.abs(Math.sqrt(Y.dist2(s, s.orbitCenter)) - s.orbitRadius));
    }
    assert(worst < 1e-6, `E: ring r=${ring}: the satellite never left its rail across 300 frames (worst ${worst.toExponential(2)} px)`);
  }
})();

// ================= (F) FIELD HAZARDS ARE UNTOUCHED =====================
(function sectionF() {
  console.log("(F) a hazard that CAN be pushed still goes through shieldDeflect, ship unmoved");
  const X = build();
  const h = stage(X, 4, ds => ds[0]);              // ordinary drifting size-3 debris
  eq(X.levelDef(4).archetype, "field", "F: (setup) level 4 is a field level");
  eq(h.orbitCenter, undefined, "F: (setup) the hazard carries no orbit state");
  placeShipAt(X, h, X.SHIELD_RADIUS + h.radius - 4);
  const shipBefore = { x: X.game.ship.x, y: X.game.ship.y, vx: X.game.ship.vx, vy: X.game.ship.vy };
  const hazBefore = { x: h.x, y: h.y, vx: h.vx, vy: h.vy };
  X.update(1 / 60);
  // The HAZARD moved and the SHIP did not (beyond its own drag/integration, which is zero at rest).
  assert(h.x !== hazBefore.x || h.y !== hazBefore.y, "F: shieldDeflect moved the hazard");
  assert(h.vx !== hazBefore.vx || h.vy !== hazBefore.vy, "F: ...and changed its velocity");
  close(X.game.ship.vx, shipBefore.vx, "F: the ship's vx is untouched by a deflect", 1e-9);
  close(X.game.ship.vy, shipBefore.vy, "F: the ship's vy is untouched by a deflect", 1e-9);
  close(Math.sqrt(X.dist2(X.game.ship, { x: shipBefore.x, y: shipBefore.y })), 0,
    "F: the ship did not move at all", 1e-9);

  // A LARGE Hunter core is also deflected, not bounced — it is free-moving, so the defect never applied.
  const Y = build();
  stage(Y, 4, ds => ds[0]);
  Y.game.debris.length = 0;
  const core = new Y.HunterSatellite(Y.game.ship.x + 60, Y.game.ship.y, 3);
  eq(core.orbitCenter, undefined, "F: (setup) a large Hunter core carries no orbit state");
  Y.game.hunters.push(core);
  Y.game.ship.vx = 0; Y.game.ship.vy = 0;
  const coreBefore = { x: core.x, y: core.y };
  const shipV = { vx: Y.game.ship.vx, vy: Y.game.ship.vy };
  Y.update(1 / 60);
  assert(core.x !== coreBefore.x || core.y !== coreBefore.y, "F: a large Hunter core is still DEFLECTED (it moved)");
  close(Y.game.ship.vx, shipV.vx, "F: ...and the ship was not bounced by it", 1e-9);
})();

// ================= (G) THE HOMING-HUNTER BRANCH IS UNTOUCHED =====================
(function sectionG() {
  console.log("(G) medium/small Hunters still die on the shield, never bounce");
  for (const size of [2, 1]) {
    const X = build();
    stage(X, 4, ds => ds[0]);
    X.game.debris.length = 0;
    const hunter = new X.HunterSatellite(X.game.ship.x + 30, X.game.ship.y, size);
    X.game.hunters.push(hunter);
    X.game.ship.vx = 0; X.game.ship.vy = 0;
    const before = { vx: X.game.ship.vx, vy: X.game.ship.vy };
    X.update(1 / 60);
    eq(hunter.dead, true, `G: a size-${size} homing Hunter dies on shield contact, as before`);
    close(X.game.ship.vx, before.vx, `G: ...and the ship is not bounced by it`, 1e-9);
  }
})();

// ================= (H) ACCOUNTING =====================
(function sectionH() {
  console.log("(H) one cost, one deflect, one ping per bounce");
  const X = build();
  const h = stage(X, 3, ds => ds.find(d => d.orbitRadius === 180));
  placeShipAt(X, h, X.SHIELD_RADIUS + h.radius - 4);
  let pings = 0;
  X.__spyPing(() => { pings++; });
  const e0 = X.game.ship.energy, d0 = X.game.stats.deflects;
  X.shieldBounce(h);
  close(X.game.ship.energy, e0 - X.SHIELD_HIT_COST, "H: a bounce costs exactly one SHIELD_HIT_COST", 1e-9);
  eq(X.game.stats.deflects, d0 + 1, "H: ...counts exactly one Shield Surfer deflect");
  eq(pings, 1, "H: ...and plays exactly one shieldPing");
  // The energy floor is respected — a bounce can never drive energy negative.
  X.game.ship.energy = 0.05;
  X.shieldBounce(h);
  assert(X.game.ship.energy >= 0, `H: energy is clamped at 0 (got ${X.game.ship.energy})`);
})();

// ================= (I) THE TOW CHAIN =====================
// REPOINTED BY CS022 P1: stage(X, 3, …) drives to an ORBIT level, and an orbit level now runs in a
// 5120x2880 torus (spec §4.1) — so "the world edge" and "the normal wrapped position band" must be
// read off the LIVE period via worldDims(game.worldSize), not off this file's load-time WORLD_W/WORLD_H
// snapshot (which is the FIELD size, 2560x1440, and would have put the "seam" case a full 2560 px
// inside the board — the seam would never have been crossed and the test would have passed vacuously).
(function sectionI() {
  console.log("(I) a laden ship survives a bounce, including one across the world seam");
  for (const seam of [false, true]) {
    const X = build();
    const h = stage(X, 3, ds => ds.find(d => d.orbitRadius === 180));
    const [W, H] = X.worldDims(X.game.worldSize);   // the LIVE torus period at this level
    if (seam) {
      // Move the whole rail to the world edge so the bounce pushes the ship across it.
      const dx = -h.x + 2, dy = -h.y + 2;
      h.orbitCenter.x = ((h.orbitCenter.x + dx) % W + W) % W;
      h.orbitCenter.y = ((h.orbitCenter.y + dy) % H + H) % H;
      X.update(1 / 60);   // let the rail re-derive the satellite's position from the moved centre
    }
    placeShipAt(X, h, X.SHIELD_RADIUS + h.radius - 4);
    // A full 12-node relaxed rope trailing the ship.
    for (let i = 0; i < 12; i++) {
      X.game.chain.push({ x: X.game.ship.x - (i + 1) * 4, y: X.game.ship.y,
                          px: X.game.ship.x - (i + 1) * 4, py: X.game.ship.y,
                          spin: 0, spinRate: 0, mass: 1, towed: true });
    }
    const n0 = X.game.chain.length;
    noThrow(() => { for (let f = 0; f < 240; f++) X.update(1 / 60); },
      `I: ${seam ? "seam" : "mid-world"}: 240 frames with a 12-node tow through a bounce`);
    assert(X.game.chain.every(nd => Number.isFinite(nd.x) && Number.isFinite(nd.y)),
      `I: ${seam ? "seam" : "mid-world"}: every chain node stayed finite`);
    assert(X.game.chain.length <= n0, `I: ${seam ? "seam" : "mid-world"}: the chain did not grow`);
    assert(Number.isFinite(X.game.ship.x) && Number.isFinite(X.game.ship.y) &&
           Number.isFinite(X.game.ship.vx) && Number.isFinite(X.game.ship.vy),
      `I: ${seam ? "seam" : "mid-world"}: the ship's position and velocity stayed finite`);
    assert(X.game.ship.x >= -60 && X.game.ship.x <= W + 60 &&
           X.game.ship.y >= -60 && X.game.ship.y <= H + 60,
      `I: ${seam ? "seam" : "mid-world"}: the ship is inside the normal wrapped position band ` +
      `(${X.game.ship.x.toFixed(1)}, ${X.game.ship.y.toFixed(1)})`);
  }
})();

// ================= (J) WRAP CORRECTNESS =====================
(function sectionJ() {
  console.log("(J) a bounce off a satellite sitting on the world seam");
  const X = build();
  const h = stage(X, 3, ds => ds.find(d => d.orbitRadius === 180));
  // REPOINTED BY CS022 P1: the seam is the LIVE world's, and an orbit level's world is 5120x2880.
  const [W, H] = X.worldDims(X.game.worldSize);
  // Put the satellite itself at the very corner of the world.
  h.x = 1; h.y = 1;
  // Approach it from "the other side" of the seam, i.e. from a large coordinate.
  X.game.ship.x = W - 40; X.game.ship.y = H - 40;
  X.game.ship.vx = 0; X.game.ship.vy = 0;
  const dBefore = Math.sqrt(X.dist2(X.game.ship, h));
  assert(dBefore < X.SHIELD_RADIUS + h.radius,
    `J: (setup) the ship is in contact ACROSS the seam (toroidal distance ${dBefore.toFixed(1)} px)`);
  assert(Math.hypot(X.game.ship.x - h.x, X.game.ship.y - h.y) > 1000,
    "J: (setup) ...and naive arithmetic would call that distance enormous, so the wrap path is genuinely under test");
  // The TRUE contact normal, wrap-aware, captured before the bounce.
  const aBefore = X.angleTo(h, X.game.ship);
  const nx = Math.cos(aBefore), ny = Math.sin(aBefore);
  X.shieldBounce(h);
  const dAfter = Math.sqrt(X.dist2(X.game.ship, h));
  close(dAfter, X.SHIELD_RADIUS + h.radius + 2, "J: the ship separated to exactly the contact radius + 2, measured toroidally", 1e-6);
  assert(X.game.ship.x >= -60 && X.game.ship.x <= W + 60 &&
         X.game.ship.y >= -60 && X.game.ship.y <= H + 60,
    `J: and it landed inside the normal wrapped position band (${X.game.ship.x.toFixed(1)}, ${X.game.ship.y.toFixed(1)})`);

  // THE DIRECTION IS THE REAL CLAIM, and distance alone cannot test it: a naive (non-wrap) normal still
  // places the ship exactly `radius + 2` from the satellite — it just places it on the WRONG SIDE, the
  // long way round the torus, i.e. shoved through the ring instead of clear of it. These two assertions
  // are what a naive normal fails.
  const aAfter = X.angleTo(h, X.game.ship);
  const dAng = Math.abs(Math.atan2(Math.sin(aAfter - aBefore), Math.cos(aAfter - aBefore)));
  close(dAng, 0, "J: the separation was purely RADIAL along the true contact normal — the ship stayed on the side it approached from", 1e-9);
  const outward = X.game.ship.vx * nx + X.game.ship.vy * ny;
  assert(outward >= X.SHIELD_BOUNCE_MIN - 1e-9,
    `J: and the velocity was applied along that same true normal, outward (${outward.toFixed(2)} px/s)`);
  assert(Number.isFinite(aAfter), "J: the contact normal stays finite across the seam");

  // The same claim through the REAL update() path rather than a direct call, so the seam case is proven
  // end to end: after a real bounce the ship must be FURTHER from the satellite than it started.
  const Y = build();
  const h2 = stage(Y, 3, ds => ds.find(d => d.orbitRadius === 180));
  h2.x = 3; h2.y = 3;
  const [W2, H2] = Y.worldDims(Y.game.worldSize);   // CS022 P1: the live period again, for the same reason
  Y.game.ship.x = W2 - 42; Y.game.ship.y = H2 - 42;
  Y.game.ship.vx = 0; Y.game.ship.vy = 0;
  const d0 = Math.sqrt(Y.dist2(Y.game.ship, h2));
  Y.update(1 / 60);
  const d1 = Math.sqrt(Y.dist2(Y.game.ship, h2));
  assert(d1 > d0, `J: a real seam-crossing contact pushed the ship AWAY (${d0.toFixed(1)} -> ${d1.toFixed(1)} px), not through`);
  assert(d1 >= Y.SHIELD_RADIUS + h2.radius, `J: ...and clear of the shield contact radius`);
})();

// ================= (K) AudioSys.ctx null smoke =====================
(function sectionK() {
  console.log("(K) AudioSys.ctx null smoke through a real shielded orbit level");
  const X = build({ audio: false });
  eq(X.AudioSys.ctx, null, "K: (setup) AudioSys.ctx really is null");
  noThrow(() => {
    withRandom(seededRandom(0x1EAF), () => {
      X.startGame();
      X.game.wave = 2; X.game.debris.length = 0; X.nextWave();
      X.game.state = "playing"; X.game.paused = false;
      X.input.shield = () => true;
      // Park the ship right on ring 1 so it is in and out of contact for the whole run.
      const sat = X.game.debris.find(d => d.orbitRadius === 180);
      X.game.ship.x = sat.x; X.game.ship.y = sat.y;
      X.game.ship.vx = 0; X.game.ship.vy = 0;
      for (let i = 0; i < 300; i++) { X.game.ship.energy = 1.0; X.update(1 / 60); X.draw(); }
    });
  }, "K: 300 shielded frames on an orbit level update and DRAW with no audio context");
  assert(X.game.debris.every(d => Number.isFinite(d.x) && Number.isFinite(d.y)),
    "K: every satellite stayed finite");
  assert(Number.isFinite(X.game.ship.x) && Number.isFinite(X.game.ship.vx),
    "K: the ship stayed finite through repeated bounces");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
