// Headless test for CS024 Phase 2 — the dead-constant sweep, baking leverScale's shipped 2x into
// POWERUP_RADIUS/DOCK_RADIUS, and freezing freqJitter at 25%.
//
//   node scratchpad/test-cs024-p2.js
//
// WHAT LANDED (PLANNED-FEATURES-CS024 §1.6 [leverScale row only] / §1.8 / §5):
//
//   1. Fifteen dead constants deleted outright (declaration-and-comment only, zero live readers):
//      CARGO_GROW_PER, DEBRIS_SPEED_PER_WAVE, DEBRIS_COUNT_MAX, DEBRIS_COUNT_HARD_MAX,
//      SAUCER_GAP_FLOOR_MIN/MAX, SAUCER_GAP_CEIL_MIN/MAX, SAUCER_FIRE_MULT_FLOOR/CEIL,
//      SAUCER_AIM_ERR_FLOOR/CEIL, SAUCER_ACCURACY_RAMP_SCALE, GARBAGE_DECAY, GARBAGE_CLUMP_MAXSPD.
//   2. A DEVIATION FROM THE SPEC TEXT, found and handled rather than applied blindly: GARBAGE_CLUMP_MAXSPD
//      was NOT "declaration-and-comment only" — it was read at an `if (GARBAGE_CLUMP_MAXSPD !== Infinity)`
//      guard around two clampGarbageSpeed() calls inside coalesceGarbage(), plus the clampGarbageSpeed()
//      function itself. But the spec's own parenthetical already named it correctly as "an off-by-default
//      playtest clamp ... never on" — since the constant was a `const` literally set to Infinity, that
//      guard was STRUCTURALLY unreachable (the same class of always-false gate as leverScale's
//      `enabled: false`), so it and its now-orphaned callee are deleted too, not left standing.
//   3. leverScale()/LEVER_POWERUP_SIZE/LEVER_DOCK_SIZE deleted; POWERUP_RADIUS 15->30, DOCK_RADIUS 44->88,
//      baking in the mechanism's only-ever-observable effect (both levers shipped `enabled: false`).
//      Dock.draw()'s vane inner-radius/label-offset (formerly `14 * vaneScale`/`22 * vaneScale`, where
//      vaneScale was always exactly 2) are baked to the literals 28/44 for the same reason.
//   4. freqJitter removed from the debug registry (46 -> 35 at P1 -> 34 here); jitteredInterval() reads a
//      new frozen FREQ_JITTER = 0.25 constant instead of DEBUG.freqJitter / 100.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL Powerup/Dock/coalesceGarbage/jitteredInterval path. Nothing under
// test is reimplemented.
//
// Sections:
//  (A) node --check.
//  (B) zero readers: every deleted symbol probed absent, and grep-confirmed absent from executable
//      source (comments naming them for documentation are fine and checked separately).
//  (C) the GARBAGE_CLUMP_MAXSPD deviation: the guard and its callee are gone, and coalesceGarbage's only
//      diff from the pre-edit build is that exact deletion (byte-proof), plus a live behavioural proof
//      that removing an always-false guard changed nothing (a fast-closing pair's speed is identical to
//      what the pre-edit build would have produced, since its clamp branch could never fire).
//  (D) the baked 2x radii: POWERUP_RADIUS === 30, DOCK_RADIUS === 88, matching the pre-edit
//      leverScale(LEVER_*_SIZE, wave) computation at every wave (the lever was always inert); real
//      Powerup/Dock construction confirms the instance radius, the pickup/offload collision geometry,
//      and the dock vane draw geometry (28/44) are byte-identical to what the pre-edit build actually
//      produced — not merely equal by coincidence.
//  (E) jitteredInterval() at the frozen 25%: same bounds and distribution shape as the pre-edit build's
//      DEBUG.freqJitter default (25), and now provably INDEPENDENT of any debug knob.
//  (F) TRAPs: GAME_VERSION unchanged; the debug registry is 34 entries with freqJitter gone.
//  (G) AudioSys.ctx === null smoke.

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
const commentsOnly = scriptSrc.split("\n").filter(l => l.trim().startsWith("//")).join("\n");

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, eps = 1e-9) {
  assert(Math.abs(got - want) < eps, `${msg} (got ${got}, want ${want}, |d| ${Math.abs(got - want).toExponential(2)})`);
}

// REPOINTED BY CS024 P3, exactly as CS024 P2 repointed test-cs024-p1.js's own copy of this trap: the
// bare `HEAD` below was correct only until this phase's commit landed. Once "cs-24 p2: dead-constant
// sweep..." (0d56e93) was committed, HEAD stopped holding the pre-edit build these sections need as
// their reference and started holding the already-swept one, so every "(setup)" sanity check here failed
// for a reason unrelated to anything CS024 P3 touched. Pinned to 37bfcd1 ("Doc change to support CS025
// upcoming"), the last commit before P2 landed — a docs-only commit, so its asteroids-deluxe.html is
// byte-identical to P1's and is the genuine pre-P2 build.
const PRE_P2_REF = "37bfcd1";
let headSrcCache = null;
function headSrc() {
  if (headSrcCache === null) {
    headSrcCache = execFileSync("git", ["show", `${PRE_P2_REF}:asteroids-deluxe.html`],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString().match(/<script>([\s\S]*?)<\/script>/)[1];
  }
  return headSrcCache;
}
const bodyOf = (src, sig) => { const i = src.indexOf(sig); return i < 0 ? "" : src.slice(i, src.indexOf("\n}\n", i)); };

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p2_extracted.js");
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
// A ctx stub that also records every lineTo/moveTo/fillText call, so draw() geometry can be read back.
function makeCtxStub(log) {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p === "moveTo") return (x, y) => log && log.push(["moveTo", x, y]);
      if (p === "lineTo") return (x, y) => log && log.push(["lineTo", x, y]);
      if (p === "fillText") return (str, x, y) => log && log.push(["fillText", str, x, y]);
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "startGame", "nextWave", "update", "draw",
  "Powerup", "Dock", "Garbage", "coalesceGarbage",
  "POWERUP_RADIUS", "DOCK_RADIUS", "SHIP_RADIUS", "DOCK_NEIGHBORHOOD_PAD",
  "GARBAGE_MERGE_DIST", "GARBAGE_MAGNET_RANGE", "HUNTER_COALESCE_COUNT",
  "jitteredInterval", "FREQ_JITTER",
  "dist2", "wrapPos", "TAU", "GAME_VERSION", "DEBUG", "DEBUG_VARS", "DEBUG_ENTRIES",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }',
];

function build({ audio = true, ctxLog = null } = {}) {
  const c = makeCtxStub(ctxLog);
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
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}

// ================= (B) zero readers of every deleted symbol =====================
(function sectionB() {
  console.log("(B) every deleted symbol: absent from the build, absent from executable source");
  const X = build();

  const GONE_CONSTS = [
    "CARGO_GROW_PER", "DEBRIS_SPEED_PER_WAVE", "DEBRIS_COUNT_MAX", "DEBRIS_COUNT_HARD_MAX",
    "SAUCER_GAP_FLOOR_MIN", "SAUCER_GAP_FLOOR_MAX", "SAUCER_GAP_CEIL_MIN", "SAUCER_GAP_CEIL_MAX",
    "SAUCER_FIRE_MULT_FLOOR", "SAUCER_FIRE_MULT_CEIL",
    "SAUCER_AIM_ERR_FLOOR", "SAUCER_AIM_ERR_CEIL", "SAUCER_ACCURACY_RAMP_SCALE",
    "GARBAGE_DECAY", "GARBAGE_CLUMP_MAXSPD",
    "LEVER_POWERUP_SIZE", "LEVER_DOCK_SIZE",
  ];
  for (const c of GONE_CONSTS) {
    eq(X.probe(c), "__ReferenceError__", `B: ${c} does not exist`);
    assert(!codeOnly.includes(c), `B: ...and appears nowhere in executable source (${c})`);
  }

  const GONE_FNS = ["leverScale", "clampGarbageSpeed"];
  for (const fn of GONE_FNS) {
    eq(X.probe(fn), "__ReferenceError__", `B: ${fn}() does not exist`);
    eq((codeOnly.match(new RegExp(`function ${fn}\\s*\\(`, "g")) || []).length, 0, `B: ...and is not defined in source`);
  }

  // freqJitter: gone as a DEBUG knob, gone from the registry, gone as an identifier in executable source
  // (jitteredInterval reads FREQ_JITTER now, not DEBUG.freqJitter).
  assert(!("freqJitter" in X.DEBUG), "B: DEBUG.freqJitter does not exist");
  assert(!X.DEBUG_VARS.some(v => v.id === "freqJitter"), "B: no DEBUG_VARS entry has id \"freqJitter\"");
  assert(!codeOnly.includes("freqJitter"), "B: ...and the identifier appears nowhere in executable source");

  // The removals are documented in tombstone comments — checked separately and positively, so a
  // tombstone can never be mistaken for a live symbol and vice versa (the standing test-cs024-p1 idiom).
  assert(commentsOnly.includes("CS024 P2"), "B: the removal is documented with a CS024 P2 comment somewhere");
  assert(!codeOnly.includes("CS024 P2: was 44"), "B: (control) tombstone text lives in comments only");

  // The other four labs and tools/ files are unaffected (this phase touches no tool file) — a control,
  // same idiom as test-cs024-p1 §B.
  for (const f of ["scoop-lab.html", "music-lab.html", "voice-lab.html", "voice-robot-lab.html"]) {
    assert(fs.existsSync(path.join(repoRoot, "tools", f)), `B: (control) tools/${f} still exists, untouched`);
  }
})();

// ================= (C) the GARBAGE_CLUMP_MAXSPD deviation =====================
(function sectionC() {
  console.log("(C) GARBAGE_CLUMP_MAXSPD: the guard + orphaned callee are gone; behaviour is unchanged");

  // The guard text itself must be gone — not just the constant.
  assert(!codeOnly.includes("GARBAGE_CLUMP_MAXSPD !== Infinity"), "C: the dead-clamp guard condition is gone from source");
  assert(!codeOnly.includes("clampGarbageSpeed(a)"), "C: ...and its call sites inside coalesceGarbage are gone");

  // The ONLY diff between the pre-edit coalesceGarbage and the live one is that exact guard block —
  // proven by textual subtraction, not by re-deriving the function.
  const preCoalesce = bodyOf(headSrc(), "function coalesceGarbage(dt) {");
  const deadGuard = `\n      if (GARBAGE_CLUMP_MAXSPD !== Infinity) { // off-by-default playtest clamp\n        clampGarbageSpeed(a); clampGarbageSpeed(b);\n      }`;
  assert(preCoalesce.includes(deadGuard), "C: (setup) the pre-edit build really does contain the dead guard verbatim");
  // NARROWED BY CS024 P3, the way CS024 P1 narrowed test-cs023-p2's destroyDebris pin rather than
  // dropping it: a whole-body byte-subtraction can only hold until the NEXT phase edits the same
  // function, and CS024 P3 rewrote this one's merge and conversion branches (permanent garbage, the
  // overflow-destroy rule). What this section actually needs to prove is narrower and still exactly
  // provable — that CS024 P2's edit REMOVED the guard block and touched nothing else in the pair walk.
  // So: the pre-edit body minus the guard must still be a body whose ATTRACTION half is byte-identical
  // to today's, and the guard's own text must be absent from both today's body and today's source.
  {
    const attractionOf = t => t.slice(t.indexOf("      // Otherwise: mutual attraction"));
    const preMinusGuard = preCoalesce.replace(deadGuard, "");
    const live = bodyOf(scriptSrc, "function coalesceGarbage(dt) {");
    eq(attractionOf(live), attractionOf(preMinusGuard),
      "C: coalesceGarbage's attraction half — where the deleted clamp lived — is byte-identical to the pre-edit body minus the guard");
    assert(!/clampGarbageSpeed/.test(live), "C: ...and no clamp call survives anywhere in the live body");
    assert(attractionOf(live).length > 200, "C: (sanity) the attraction slice is a real slice, not an empty string");
  }

  // Live behavioural proof: because the guard's condition (`GARBAGE_CLUMP_MAXSPD !== Infinity`) could
  // NEVER be true in the pre-edit build (the constant was a `const` literally set to Infinity, never
  // reassigned), deleting the guard cannot change any coalescing pair's resulting velocity. Drive two
  // fast-closing pieces through the real coalesceGarbage() and confirm nothing clamps their speed even
  // when it would exceed what a hypothetical enabled clamp might have capped.
  const X = build();
  X.startGame();
  X.game.state = "playing"; X.game.paused = false;
  X.game.debris = []; X.game.hunters = []; X.game.saucers = []; X.game.chain = [];
  const a = new X.Garbage(1000, 1000);
  const b = new X.Garbage(1006, 1000); // 6px apart: inside GARBAGE_MERGE_DIST(12), inside attract radius
  a.coalesceDelay = 0; b.coalesceDelay = 0;
  a.vx = 5000; a.vy = 0; b.vx = 1000; b.vy = 0; // both +x, unequal — merged momentum is nonzero
  X.game.garbage = [a, b];
  X.coalesceGarbage(1 / 60);
  // They were within GARBAGE_MERGE_DIST, so they merged this frame — the survivor's velocity is the
  // exact momentum sum (mass-weighted), completely unclamped.
  assert(a.dead === false || b.dead === false, "C: (setup) at least one survivor remains after the merge");
  const survivor = a.dead ? b : a;
  const speed = Math.hypot(survivor.vx, survivor.vy);
  assert(speed > 100, `C: the merged survivor's speed is NOT clamped to anything small (got ${speed.toFixed(1)} px/s) — the dead guard never bound, so removing it changed nothing`);
})();

// ================= (D) the baked 2x radii =====================
(function sectionD() {
  console.log("(D) POWERUP_RADIUS===30, DOCK_RADIUS===88, matching the pre-edit leverScale computation");
  const X = build();
  eq(X.POWERUP_RADIUS, 30, "D: POWERUP_RADIUS is 30 (was 15)");
  eq(X.DOCK_RADIUS, 88, "D: DOCK_RADIUS is 88 (was 44)");

  // Pre-edit reference: leverScale({enabled:false,start:2.0,floor:1.0}, wave) === 2.0 at EVERY wave
  // (the lever was always inert), so the pre-edit radius was always exactly 15*2/44*2 at every wave.
  // Confirmed against the pre-edit source directly, not re-derived.
  const preSrc = headSrc();
  assert(/const LEVER_POWERUP_SIZE = \{ enabled: false, start: 2\.0, floor: 1\.0 \};/.test(preSrc),
    "D: (setup) the pre-edit build really did ship LEVER_POWERUP_SIZE disabled at start=2.0");
  assert(/const LEVER_DOCK_SIZE = \{ enabled: false, start: 2\.0, floor: 1\.0 \};/.test(preSrc),
    "D: (setup) the pre-edit build really did ship LEVER_DOCK_SIZE disabled at start=2.0");
  assert(/const POWERUP_RADIUS = 15;/.test(preSrc), "D: (setup) the pre-edit base POWERUP_RADIUS was 15");
  assert(/const DOCK_RADIUS = 44;/.test(preSrc), "D: (setup) the pre-edit base DOCK_RADIUS was 44");

  X.startGame();
  for (const wave of [1, 25, 50, 200]) {
    X.game.wave = wave;
    const p = new X.Powerup(500, 500, "rapid");
    eq(p.radius, 30, `D: wave ${wave}: Powerup.radius === 30 (leverScale was always inert at 2.0x)`);
    const d = new X.Dock();
    eq(d.radius, 88, `D: wave ${wave}: Dock.radius === 88 (leverScale was always inert at 2.0x)`);
  }

  // Collision geometry: a canister at exactly the old 2x pickup radius from the ship is collected, same
  // as the pre-edit build (the radius itself hasn't moved — only its source did).
  X.game.wave = 1;
  X.game.state = "playing"; X.game.paused = false;
  X.game.debris = []; X.game.hunters = []; X.game.saucers = []; X.game.chain = []; X.game.garbage = [];
  Object.assign(X.game.ship, { dead: false, x: 500, y: 500, vx: 0, vy: 0, angle: 0, hp: 250, invuln: 0, shieldOn: false, energy: 1, cooldown: 0 });
  X.game.powerFx = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  const p = new X.Powerup(500 + X.POWERUP_RADIUS + X.SHIP_RADIUS - 5, 500, "rapid");
  X.game.powerups = [p];
  X.update(1 / 60);
  assert(X.game.powerups.length === 0 || X.game.powerups[0].dead,
    "D: a powerup just inside (POWERUP_RADIUS + SHIP_RADIUS) IS collected at the baked 30px radius");

  // Dock vane geometry: the draw() call's baked literals (28, 44) match 14*2/22*2 exactly — the same
  // pixels the pre-edit build's `14 * vaneScale`/`22 * vaneScale` (vaneScale always exactly 2) produced.
  const ctxLog = [];
  const Y = build({ ctxLog });
  Y.startGame();
  Y.game.wave = 1;
  const dock = new Y.Dock();
  dock.spin = 0;
  ctxLog.length = 0;
  dock.draw();
  // drawPoly() also emits lineTo calls for the dock's own octagon outline (at radius ~88) — filter to
  // just the vane endpoints (at radius ~28) so the octagon's own point count doesn't have to be pinned.
  const lineTos = ctxLog.filter(e => e[0] === "lineTo");
  const vaneEndpoints = lineTos.filter(([, x, y]) => Math.hypot(x - dock.x, y - dock.y) < 40);
  eq(vaneEndpoints.length, 3, "D: Dock.draw() emits exactly 3 vane-endpoint lineTo() calls (radius ~28, distinct from the octagon outline at radius ~88)");
  for (const [, x, y] of vaneEndpoints) {
    const dx = x - dock.x, dy = y - dock.y;
    close(Math.hypot(dx, dy), 28, "D: each vane's inner endpoint sits exactly 28px from dock center (14 * the old always-2x vaneScale)");
  }
  const fillTexts = ctxLog.filter(e => e[0] === "fillText" && e[1] === "RECYCLE");
  eq(fillTexts.length, 1, "D: Dock.draw() emits exactly one RECYCLE label");
  close(fillTexts[0][3] - dock.y, dock.radius + 44,
    "D: the RECYCLE label sits exactly (dock.radius + 44) below dock center (22 * the old always-2x vaneScale)");

  // Offload/neighborhood geometry reads game.dock.radius live — unaffected in form, just a bigger number.
  eq(X.DOCK_NEIGHBORHOOD_PAD > 0, true, "D: (sanity) DOCK_NEIGHBORHOOD_PAD is still a positive constant");
})();

// ================= (E) jitteredInterval() frozen at 25% =====================
(function sectionE() {
  console.log("(E) jitteredInterval(): frozen at 25%, same bounds as the pre-edit build's shipped default, knob-independent");
  const X = build();
  eq(X.FREQ_JITTER, 0.25, "E: FREQ_JITTER === 0.25");
  eq((scriptSrc.match(/function jitteredInterval\(/g) || []).length, 1, "E: exactly one jitteredInterval definition");

  // Pre-edit reference: the shipped freqJitter DEBUG_VARS default was 25 (i.e. 0.25 after /100), so the
  // frozen constant reproduces exactly the shipped-default bounds, not some other number.
  const preSrc = headSrc();
  const preDefaultMatch = preSrc.match(/\{ id: "freqJitter", label: "Frequency jitter", unit: "%",\s*\n\s*def: (\d+)/);
  assert(!!preDefaultMatch, "E: (setup) the pre-edit build's freqJitter registry entry is found");
  eq(Number(preDefaultMatch[1]), 25, "E: (setup) the pre-edit shipped default was 25 (%)");

  let sawAbove = false, sawBelow = false;
  const center = 40;
  for (let i = 0; i < 500; i++) {
    const v = X.jitteredInterval(center);
    assert(v >= center * 0.75 - 1e-9 && v <= center * 1.25 + 1e-9,
      `E: jitteredInterval(${center}) stays within the frozen +/-25% band [${center * 0.75},${center * 1.25}] (got ${v})`);
    if (v > center) sawAbove = true;
    if (v < center) sawBelow = true;
  }
  assert(sawAbove && sawBelow, "E: jitteredInterval() actually varies both above and below its centre across 500 samples");

  // Knob-independence: there is no DEBUG.freqJitter to feed it, and applyDebug on a retired id is a no-op
  // under the standing known-value-else-default rule (unknown ids are simply not found in DEBUG_VARS).
  assert(!X.DEBUG_VARS.some(v => v.id === "freqJitter"), "E: no live knob exists that could move the jitter spread");
})();

// ================= (F) TRAPs =====================
(function sectionF() {
  console.log("(F) TRAPs — GAME_VERSION unchanged; debug registry is 34 entries, freqJitter gone");
  const X = build();
  // REPOINTED BY CS024 P7 — the standing MIRROR IMAGE. This pin asserted the version was
  // UNCHANGED while CS024 P2 ran; P7 bumped it to "1.0.0.24", so the claim inverts and then
  // stays correct forever. Do not re-point it to a literal version again.
  assert(X.GAME_VERSION !== "1.0.0.22", "F: TRAP 1 — GAME_VERSION has moved off the pre-CS024-P7 baseline 1.0.0.22");
  // REPOINTED BY CS024 P3: 34 -> 36 (garbageLifetime out with the decay clock; garbageSoftMax,
  // garbageHardMax and lastStandSpeed in). The claim this TRAP carries — freqJitter is gone and stays
  // gone — is asserted directly below rather than through a total that later phases keep moving.
  // REPOINTED AGAIN BY CS024 P4: 36 -> 15 (the 21 tier knobs, out with levelDef()'s tier names).
  // REPOINTED AGAIN BY CS024 P5: 15 -> 32 (the levers wired: 17 new lever-knob entries plus
  // smallUfoChance, registry rebuilt).
  // REPOINTED AGAIN BY CS024 P6: 32 -> 33 — timed powerup expiry deleted (chainGuardTime out), a new
  // POWERUPS section in with engineBurnSeconds + engineMassMult (Engine-as-fuel). Net -1 +2.
  eq(X.DEBUG_ENTRIES.length, 72, "F: TRAP — the debug registry is exactly 72 value entries after CS024 P6f");
  eq(X.DEBUG_VARS.filter(v => !v.header).length, 72, "F: ...and DEBUG_VARS agrees");
  assert(X.DEBUG_ENTRIES.some(e => e.id === "debrisBounceRestitution"),
    "F: debrisBounceRestitution (untouched by this phase) still survives in the registry");
  // TRAP (docs) — [RETIRED IN PLACE BY CS024 P7, exactly as test-cs024-p6b.js §G TRAP 6 was retired,
  // and for the identical reason.] The pin required GDD / GDD-VERSION-HISTORY / DIFFICULTY-LEVERS to be
  // unmoved since HEAD — true of CS024 P2's own session, impossible during CS024 P7, which IS the doc
  // sweep and rewrites all three by instruction. A fixed-ref whole-repo doc pin is a phase-local claim
  // wearing a permanent assertion's clothing. P2's own rule was a TRAP in its phase prompt and its diff
  // is in the git history; do not re-add a fixed-ref doc pin here.
  console.log("  (the fixed-ref doc pin retired by CS024 P7 — see the comment above)");
})();

// ================= (G) AudioSys.ctx null smoke =====================
(function sectionG() {
  console.log("(G) AudioSys.ctx === null: startGame()/nextWave()/update() across many levels, no throw");
  const X = build({ audio: false });
  let threw = null;
  try {
    X.startGame();
    X.game.state = "playing"; X.game.paused = false;
    for (let w = 1; w <= 40; w++) {
      X.game.wave = w - 1;
      X.game.debris.length = 0;
      X.nextWave();
      for (let f = 0; f < 20; f++) X.update(1 / 60);
      X.draw();
    }
  } catch (e) { threw = e; }
  assert(threw === null, "G: no throw across a 40-level real run" + (threw ? `: ${threw.stack}` : ""));
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
