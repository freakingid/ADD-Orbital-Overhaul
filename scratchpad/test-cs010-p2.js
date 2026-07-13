// Headless test for CS010 Phase 2 — shipTurnRate() owns both turn sites, the rotation-speed slider,
// the towed-mass retune + CARGO_TURN knob, and the FLAG-3a chain-stability re-run.
//
//   node scratchpad/test-cs010-p2.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL functions — never reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) shipTurnRate(): scale 0.5/1.0/1.5 x chain mass 0/12/24 (CARGO_TURN=0 -> mass-independent),
//      plus a CARGO_TURN=0.02 rebuild to prove the mass divisor is actually wired.
//  (C) settings.shipTurnScale persistence: round-trip through afd_settings_v1, missing key -> 1.0,
//      corrupt (string / out-of-range / unreadable JSON) -> 1.0, returnToDefaults() leaves it alone.
//  (D) FLAG-3a chain-stability re-run at 24 nodes / 900 frames, HEAD build vs this working tree:
//        (D1) documented envelope methodology (dt=1/60, kinematic v=420/260) -> reproduces ~4.11px and
//             asserts < 5px + neutrality (delta ~0);
//        (D2) the dt=0.05 clamp, realistic FAITHFUL stress (real ship.update, tug feeds back so
//             CARGO_MASS is exercised) at mass 24/12/6 -> assert no NaN, speed bounded, and worktree
//             stretch <= HEAD (non-regression; the retune must not worsen stability);
//        (D3) the dt=0.05 clamp, kinematic v=420/260 -> report only (the over-stress velocity is
//             unphysical at the big timestep; identical on both builds, so it's a methodology artifact).

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const extractScript = html => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
};

const currentSrc = extractScript(fs.readFileSync(htmlPath, "utf8"));
let headSrc = null;
try { headSrc = extractScript(execSync("git show HEAD:asteroids-deluxe.html", { cwd: repoRoot, encoding: "utf8" })); }
catch (e) { console.warn("  (note: no HEAD build; the HEAD-vs-worktree stress comparison will be skipped)"); }

// ---- stubs (mirrors test-cs010-p1.js) ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
    Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

// Full return list for the worktree (has the new symbols). STRESS is a HEAD-safe subset (HEAD predates
// shipTurnRate/settings.shipTurnScale/CARGO_TURN), used for both builds in the stress so shapes match.
const FULL = ["shipTurnRate", "chainMass", "settings", "saveSettings", "loadSettings", "returnToDefaults",
  "game", "startGame", "updateChain", "chainAnchor", "shortDelta", "input", "menuControls", "drawControlsMenu",
  "REBINDABLE", "SHIP_TURN", "SHIP_TURN_SCALE_MIN", "SHIP_TURN_SCALE_MAX", "SHIP_TURN_SCALE_STEP",
  "CHAIN_LINK", "WORLD_W", "WORLD_H", "CARGO_MASS", "CARGO_THRUST", "CARGO_MAXSPD", "CARGO_TURN"];
const STRESS = ["chainMass", "game", "startGame", "updateChain", "chainAnchor", "shortDelta", "input",
  "CHAIN_LINK", "WORLD_W", "WORLD_H", "CARGO_MASS"];

function buildInstance(scriptSrc, lsStore, returnList) {
  lsStore = lsStore || {};
  returnList = returnList || FULL;
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720, AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
  };
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + returnList.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs010-p2-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (B) shipTurnRate() =====================
(function () {
  console.log("(B) shipTurnRate() over scale x chain mass");
  const A = buildInstance(currentSrc);
  A.startGame();
  const setMass = (inst, m) => { inst.game.chain.length = 0; for (let i = 0; i < m; i++) inst.game.chain.push({ mass: 1.0 }); };
  const ST = A.SHIP_TURN;
  assert(A.CARGO_TURN === 0.0, `CARGO_TURN ships at 0.0 (dormant); got ${A.CARGO_TURN}`);

  // Shipped CARGO_TURN = 0 => turn rate is SHIP_TURN*scale regardless of load (penalty dormant).
  for (const scale of [0.5, 1.0, 1.5]) {
    A.settings.shipTurnScale = scale;
    for (const mass of [0, 12, 24]) {
      setMass(A, mass);
      const got = A.shipTurnRate();
      assert(near(got, ST * scale), `scale=${scale} mass=${mass}: got ${got.toFixed(6)} expected ${(ST * scale).toFixed(6)} (mass-independent at CARGO_TURN=0)`);
    }
  }

  // Prove the divisor is live: rebuild with CARGO_TURN=0.02 and check the penalty applies.
  const B = buildInstance(currentSrc.replace(/const CARGO_TURN = 0\.0;/, "const CARGO_TURN = 0.02;"));
  B.startGame();
  assert(B.CARGO_TURN === 0.02, `substituted build has CARGO_TURN=0.02; got ${B.CARGO_TURN}`);
  for (const scale of [0.5, 1.0, 1.5]) {
    B.settings.shipTurnScale = scale;
    for (const mass of [0, 12, 24]) {
      setMass(B, mass);
      const got = B.shipTurnRate(), want = ST * scale / (1 + mass * 0.02);
      assert(near(got, want), `CARGO_TURN=0.02 scale=${scale} mass=${mass}: got ${got.toFixed(6)} want ${want.toFixed(6)}`);
    }
  }
})();

// ================= (C) persistence =====================
(function () {
  console.log("(C) shipTurnScale persistence + returnToDefaults isolation");
  // Round-trip: instance 1 saves 1.3; a fresh instance sharing the store loads it on eval.
  const store = {};
  const A = buildInstance(currentSrc, store);
  A.settings.shipTurnScale = 1.3; A.saveSettings();
  assert(near(buildInstance(currentSrc, store).settings.shipTurnScale, 1.3), "round-trip: 1.3 survives save+load");

  // Non-grid value snaps to the 0.10 grid on load (1.34 -> 1.3).
  const s2 = { "afd_settings_v1": JSON.stringify({ shipTurnScale: 1.34 }) };
  assert(near(buildInstance(currentSrc, s2).settings.shipTurnScale, 1.3), "1.34 snaps to 1.3 on load");

  // Missing key -> default 1.0.
  const s3 = { "afd_settings_v1": JSON.stringify({ vol: {}, bindings: {} }) };
  assert(near(buildInstance(currentSrc, s3).settings.shipTurnScale, 1.0), "missing key -> 1.0");

  // Corrupt values -> 1.0 (string, over/under-range, wrong type).
  for (const bad of ["banana", 99, 0, -1, true, null]) {
    const s = { "afd_settings_v1": JSON.stringify({ shipTurnScale: bad }) };
    assert(near(buildInstance(currentSrc, s).settings.shipTurnScale, 1.0), `corrupt shipTurnScale=${JSON.stringify(bad)} -> 1.0`);
  }
  // Unreadable JSON (the NaN case JSON can't represent) -> loadSettings catch -> default 1.0.
  const s4 = { "afd_settings_v1": '{"shipTurnScale": NaN}' };
  assert(near(buildInstance(currentSrc, s4).settings.shipTurnScale, 1.0), "unreadable JSON -> 1.0");

  // FLAG-10a: returnToDefaults() resets bindings only; shipTurnScale untouched.
  const C = buildInstance(currentSrc);
  C.settings.shipTurnScale = 1.4; C.returnToDefaults();
  assert(near(C.settings.shipTurnScale, 1.4), `returnToDefaults must NOT touch shipTurnScale (FLAG-10a); got ${C.settings.shipTurnScale}`);
})();

// ================= (D) FLAG-3a chain-stability stress =====================
const NODES = 24, FRAMES = 900;

function buildChain(inst, nodeMass) {
  const { game, chainAnchor, CHAIN_LINK } = inst;
  game.chain.length = 0;
  const a = chainAnchor();
  for (let i = 0; i < NODES; i++) {
    const x = a.x - CHAIN_LINK * (i + 1), y = a.y;
    game.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: nodeMass });
  }
}
function measure(inst) {
  const { game, chainAnchor, shortDelta, CHAIN_LINK } = inst;
  const a = chainAnchor();
  let worst = 0, nan = false;
  for (let i = 0; i < game.chain.length; i++) {
    const leader = i === 0 ? a : game.chain[i - 1], n = game.chain[i];
    if (!isFinite(n.x) || !isFinite(n.y)) nan = true;
    const [dx, dy] = shortDelta(leader.x, leader.y, n.x, n.y);
    worst = Math.max(worst, Math.abs(Math.hypot(dx, dy) - CHAIN_LINK));
  }
  return { worst, nan };
}
function prep(inst, x, y) {
  inst.startGame();
  inst.game.state = "playing"; inst.game.paused = false;
  inst.game.debris && (inst.game.debris.length = 0);
  inst.game.hunters && (inst.game.hunters.length = 0);
  inst.game.saucers && (inst.game.saucers.length = 0);
  Object.assign(inst.game.ship, { dead: false, x, y, vx: 0, vy: 0, angle: 0 });
}

// KINEMATIC (test-p6.js (E) methodology): slam ship velocity directly. Velocity is overwritten each
// frame so the tug/CARGO_MASS don't influence it — the pure constraint-solver envelope check.
function stressKinematic(inst, dt) {
  prep(inst, inst.WORLD_W / 2, inst.WORLD_H / 2);
  buildChain(inst, 1.0);
  let worst = 0, nan = false;
  for (let fr = 0; fr < FRAMES; fr++) {
    const s = inst.game.ship;
    s.vx = (Math.floor(fr / 10) % 2 === 0 ? 1 : -1) * 420;
    s.vy = (Math.floor(fr / 23) % 2 === 0 ? 1 : -1) * 260;
    s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.x < 0) s.x += inst.WORLD_W; if (s.x > inst.WORLD_W) s.x -= inst.WORLD_W;
    if (s.y < 0) s.y += inst.WORLD_H; if (s.y > inst.WORLD_H) s.y -= inst.WORLD_H;
    inst.updateChain(dt);
    const m = measure(inst); worst = Math.max(worst, m.worst); if (m.nan) nan = true;
  }
  return { worst, nan };
}

// FAITHFUL: real ship.update (thrust held, heading hard-switched among 4 dirs every 40 frames) so the
// tug feeds back into ship velocity -> this is the run that actually exercises CARGO_MASS.
function stressFaithful(inst, nodeMass, dt) {
  prep(inst, 5, 5);
  inst.input.thrust = () => true; inst.input.fire = () => false;
  inst.input.shield = () => false; inst.input.left = () => false; inst.input.right = () => false;
  buildChain(inst, nodeMass);
  const dirs = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
  let worst = 0, nan = false, maxSpeed = 0;
  for (let fr = 0; fr < FRAMES; fr++) {
    inst.game.ship.angle = dirs[Math.floor(fr / 40) % 4];
    inst.game.ship.update(dt);
    inst.updateChain(dt);
    const sp = Math.hypot(inst.game.ship.vx, inst.game.ship.vy);
    maxSpeed = Math.max(maxSpeed, sp); if (!isFinite(sp)) nan = true;
    const m = measure(inst); worst = Math.max(worst, m.worst); if (m.nan) nan = true;
  }
  return { worst, nan, maxSpeed, mass: inst.chainMass() };
}

(function () {
  console.log("(D) FLAG-3a chain-stability stress — 24 nodes, 900 frames");
  const W = buildInstance(currentSrc, {}, STRESS);
  console.log(`    worktree coeffs: CARGO_MASS=${W.CARGO_MASS} (HEAD was 0.07), TUG cap 1.4 unchanged`);

  // (D1) Documented envelope methodology: dt=1/60, kinematic v=420/260. Reproduces the GDD's 4.11px.
  const w1 = stressKinematic(buildInstance(currentSrc, {}, STRESS), 1 / 60);
  console.log(`  (D1) dt=1/60 kinematic v=420/260: worktree worstStretch=${w1.worst.toFixed(2)}px (documented budget ~5px, prior 4.11px)`);
  assert(!w1.nan, "D1: no NaN");
  assert(w1.worst < 5.0, `D1: worktree stretch ${w1.worst.toFixed(2)}px under the documented ~5px budget`);
  if (headSrc) {
    const h1 = stressKinematic(buildInstance(headSrc, {}, STRESS), 1 / 60);
    console.log(`       HEAD ${h1.worst.toFixed(2)}px  delta ${(w1.worst - h1.worst).toFixed(3)}px  (kinematic isolates the solver -> the retune is neutral)`);
    assert(Math.abs(w1.worst - h1.worst) < 0.01, `D1: retune stability-neutral under the documented methodology (delta ${(w1.worst - h1.worst).toFixed(3)}px)`);
  }

  // (D2) The real dt=0.05 clamp, realistic faithful stress. This exercises the tug (CARGO_MASS). At
  // dt=0.05 the chain sags more than the 1/60 envelope figure — inherent to the big timestep, present
  // on BOTH builds — so the meaningful assertion is NON-REGRESSION (worktree <= HEAD), plus sanity.
  console.log("  (D2) dt=0.05 (clamp) faithful stress — the CARGO_MASS-sensitive run:");
  for (const nodeMass of [1.0, 0.5, 0.25]) {
    const w = stressFaithful(buildInstance(currentSrc, {}, STRESS), nodeMass, 0.05);
    let line = `       node=${nodeMass} massSum=${w.mass}: worktree worst=${w.worst.toFixed(3)}px maxShipSpeed=${w.maxSpeed.toFixed(0)} NaN=${w.nan}`;
    assert(!w.nan, `D2 node=${nodeMass}: no NaN`);
    assert(w.maxSpeed < 2000, `D2 node=${nodeMass}: ship speed ${w.maxSpeed.toFixed(0)} bounded (no blowup)`);
    if (headSrc) {
      const h = stressFaithful(buildInstance(headSrc, {}, STRESS), nodeMass, 0.05);
      line += ` | HEAD ${h.worst.toFixed(3)}px  delta ${(w.worst - h.worst >= 0 ? "+" : "") + (w.worst - h.worst).toFixed(3)}px`;
      assert(w.worst <= h.worst + 0.05, `D2 node=${nodeMass}: retune must not worsen stretch (worktree ${w.worst.toFixed(3)} <= HEAD ${h.worst.toFixed(3)} + eps)`);
    }
    console.log(line);
  }

  // (D3) Report-only: the same over-stress velocity at dt=0.05 is unphysical (v=420 -> 21px/frame at
  // this timestep). Identical on both builds -> a methodology artifact, not a regression.
  const w3 = stressKinematic(buildInstance(currentSrc, {}, STRESS), 0.05);
  let l3 = `  (D3) dt=0.05 kinematic v=420/260 (over-stress, report only): worktree ${w3.worst.toFixed(2)}px NaN=${w3.nan}`;
  assert(!w3.nan, "D3: no NaN even under the over-stress");
  if (headSrc) {
    const h3 = stressKinematic(buildInstance(headSrc, {}, STRESS), 0.05);
    l3 += ` | HEAD ${h3.worst.toFixed(2)}px delta ${(w3.worst - h3.worst).toFixed(3)}px`;
  }
  console.log(l3);
})();

// ================= (E) menu flow: drive the REAL Controls-screen input + render =====================
(function () {
  console.log("(E) Controls-screen: menuControls adjust + drawControlsMenu render (no reimplementation)");
  const A = buildInstance(currentSrc);
  A.startGame();
  const m = A.game.menu;
  A.game.paused = true; m.screen = "controls";
  const turnRow = A.REBINDABLE.length;     // slider sits right after the rebindable action rows
  m.row = turnRow; m.col = 0;

  // ► nudges up by one step and saves.
  A.settings.shipTurnScale = 1.0;
  A.menuControls("right");
  assert(near(A.settings.shipTurnScale, 1.0 + A.SHIP_TURN_SCALE_STEP), `menuControls right: 1.0 -> ${(1.0 + A.SHIP_TURN_SCALE_STEP).toFixed(2)} (got ${A.settings.shipTurnScale})`);
  // ◄ nudges back down.
  A.menuControls("left");
  assert(near(A.settings.shipTurnScale, 1.0), `menuControls left: back to 1.0 (got ${A.settings.shipTurnScale})`);
  // Holding ► clamps at MAX; holding ◄ clamps at MIN.
  for (let i = 0; i < 20; i++) A.menuControls("right");
  assert(near(A.settings.shipTurnScale, A.SHIP_TURN_SCALE_MAX), `menuControls right clamps at ${A.SHIP_TURN_SCALE_MAX} (got ${A.settings.shipTurnScale})`);
  for (let i = 0; i < 20; i++) A.menuControls("left");
  assert(near(A.settings.shipTurnScale, A.SHIP_TURN_SCALE_MIN), `menuControls left clamps at ${A.SHIP_TURN_SCALE_MIN} (got ${A.settings.shipTurnScale})`);
  // Landing exactly on the 100% default via steps stays a clean 1.0 (no float drift).
  A.settings.shipTurnScale = A.SHIP_TURN_SCALE_MIN;
  for (let i = 0; i < 5; i++) A.menuControls("right");   // 0.5 -> 1.0 in five 0.10 steps
  assert(A.settings.shipTurnScale === 1.0, `five steps from MIN land on exactly 1.0 (got ${A.settings.shipTurnScale})`);

  // "confirm" on the slider row must NOT navigate away or crash (it's a ◄/► row, no confirm action).
  const before = m.screen;
  A.menuControls("confirm");
  assert(m.screen === before, `confirm on the slider row does nothing (screen stayed "${m.screen}")`);

  // Adjusting the slider must not disturb the rebindable action rows above it.
  const onActionRow = () => { m.row = 0; m.col = 0; A.menuControls("left"); return m.col; };
  assert(onActionRow() === 1, "left on an action row still toggles kb/pad column (unbroken by the new row)");

  // The renderer runs clean against the no-op ctx at several slider values (incl. the default).
  m.row = turnRow;
  let threw = null;
  for (const v of [A.SHIP_TURN_SCALE_MIN, 1.0, 1.3, A.SHIP_TURN_SCALE_MAX]) {
    A.settings.shipTurnScale = v;
    try { A.drawControlsMenu(); } catch (e) { threw = `${v}: ${e.message}`; }
  }
  assert(threw === null, `drawControlsMenu renders without throwing at every slider value (${threw})`);
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
