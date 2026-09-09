// Headless test for CS010 Phase 2 — shipTurnRate() owns both turn sites, the rotation-speed slider,
// the towed-mass retune + CARGO_TURN knob, and the FLAG-3a chain-stability re-run.
//
//   node scratchpad/test-cs010-p2.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL functions — never reimplement game logic. Sections:
//  (A) node --check on the extracted <script>.
//  (B) shipTurnRate(): scale 0.5/1.0/1.5 x chain mass 0/12/24, and the mass divisor's own A/B.
//      ⛔ REWRITTEN BY CS042 P7 (spec §6.8), AND IT IS A REVERSAL, RECORDED IN PLACE. This section
//      pinned CARGO_TURN shipping DORMANT at 0.0 — "rotation is UNAFFECTED by cargo" — and proved the
//      divisor was merely wired by rebuilding the source with 0.02 substituted in. Under one mass
//      there is no separate turn coefficient to leave dormant: shipTurnRate() divides by shipMass(),
//      the same mass acceleration, drag and the tug divide by, so a heavy chain DOES resist turning
//      (241 -> 90 deg/s across 0 -> 24 nodes). That is FLAG-CS042-m, it reverses Paul's own GATE A
//      close of FLAG-CS042-j, and it is deliberate rather than a regression. The claim inverts and
//      the substitution is retired: DEBUG.cargoUnitMass is a LIVE knob, so the A/B (0 restores exact
//      mass-independence, and only that) is now measurable on the shipped build with no rebuild.
//  (C) settings.shipTurnScale persistence: round-trip through afd_settings_v1, missing key -> 1.0,
//      corrupt (string / out-of-range / unreadable JSON) -> 1.0, returnToDefaults() leaves it alone.
//  (D) FLAG-3a chain-stability re-run at 24 nodes / 900 frames, CS010 P2's commit vs its own parent:
//        (D1) documented envelope methodology (dt=1/60, kinematic v=420/260) -> reproduces ~4.11px and
//             asserts < 5px + neutrality (delta ~0);
//        (D2) the dt=0.05 clamp, realistic FAITHFUL stress (real ship.update, tug feeds back so the
//             tug coefficient is exercised) at mass 24/12/6 -> no NaN, speed bounded, and the CS010 P2
//             commit's stretch <= its own parent's (non-regression; that retune must not worsen it);
//        (D3) the dt=0.05 clamp, kinematic v=420/260 -> report only (the over-stress velocity is
//             unphysical at the big timestep; identical on both builds, so it's a methodology artifact).
//      ⛔ REPOINTED BY CS042 P7 — A FIFTH MOVING-`HEAD` PIN, FOUND AND FIXED. Every comparison in (D)
//      read `git show HEAD:` and asked "is the WORKING TREE at least as stable as HEAD?". That is the
//      exact defect CLAUDE.md's pin rule names: it silently re-aims at every later commit, so after
//      CS010 P2 landed it compared a build against itself and passed vacuously, and the first phase to
//      legitimately change the physics (this one — a laden ship now sustains far higher speeds for far
//      longer) made it fail for a reason that has nothing to do with CS010. Both sides are now LITERAL
//      SHAs: the CS010 P2 commit (a66ef10) against its own parent. CS010's claim is thereby measured
//      on CS010's own commit, is permanently true, and can never be re-aimed again. The LIVE build's
//      envelope keeps its own absolute check in (D1) — worst-case stretch under the documented ~5 px
//      budget — and CS042 P7's own §3.4 re-validation lives in scratchpad/test-cs042-p7.js.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { parentSource, SKIP_TAG } = require("./_phase-ref.js");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const extractScript = html => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
};

const currentSrc = extractScript(fs.readFileSync(htmlPath, "utf8"));
// ⛔ CS042 P7: the two sides of (D)'s non-regression comparison, as LITERAL SHAs — see the header note.
// P2_REF is CS010 P2's own commit; P2_PARENT_REF is what it was measured against at the time. Fetched
// through _phase-ref.js's parentSource(), which already carries the 64 MB maxBuffer this file's old
// hand-rolled execSync did not (orbital-overhaul.html crossed execSync's 1 MiB default at CS042 P6's
// commit) and which resolves the pre-CS029 `asteroids-deluxe.html` spelling these two refs still use.
const P2_REF = "a66ef10", P2_PARENT_REF = "a66ef10^";
const p2Src = parentSource(P2_REF);
const p2ParentSrc = parentSource(P2_PARENT_REF);

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

// Full return list for the worktree. CS042 P7: the four CARGO_* divisors are RETIRED (spec §6.8), so
// naming them here would throw at build time; (B) probes their absence off the SOURCE instead, and
// shipMass/CARGO_UNIT_MASS/DEBUG/applyDebug are what answer the questions they used to.
const FULL = ["shipTurnRate", "shipMass", "chainMass", "settings", "saveSettings", "loadSettings", "returnToDefaults",
  "game", "startGame", "updateChain", "chainAnchor", "shortDelta", "input", "menuControls", "drawControlsMenu",
  "REBINDABLE", "SHIP_TURN", "SHIP_TURN_SCALE_MIN", "SHIP_TURN_SCALE_MAX", "SHIP_TURN_SCALE_STEP",
  "CHAIN_LINK", "WORLD_W", "WORLD_H", "CARGO_UNIT_MASS", "DEBUG", "applyDebug"];
// STRESS is the subset every build in (D) can export — the two CS010-era builds and the live one alike.
// It deliberately names no tuning constant: the coefficients differ across those three builds by
// construction, and the stress measures the SOLVER, not the numbers feeding it.
const STRESS = ["chainMass", "game", "startGame", "updateChain", "chainAnchor", "shortDelta", "input",
  "CHAIN_LINK", "WORLD_W", "WORLD_H"];

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

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
// CS042 P7: this file's git-dependent pin now SKIPS LOUDLY like every other one in the suite
// (_phase-ref.js's FORK-CS026-H contract) instead of printing a bare console.warn nobody counts.
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }
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
  console.log("(B) shipTurnRate() over scale x chain mass — the ONE mass divisor (CS042 P7 §6.8)");
  const A = buildInstance(currentSrc);
  A.startGame();
  const setMass = (inst, m) => { inst.game.chain.length = 0; for (let i = 0; i < m; i++) inst.game.chain.push({ mass: 1.0 }); };
  const ST = A.SHIP_TURN;

  // ⛔ CARGO_TURN IS RETIRED, NOT SET TO SOMETHING. Probed two ways, because the point is that no
  // separate turn coefficient exists to be left dormant or quietly revived.
  assert(A.CARGO_TURN === undefined, `CARGO_TURN is RETIRED (CS042 P7 §6.8); got ${A.CARGO_TURN}`);
  assert(!/^\s*const\s+CARGO_TURN\s*=/m.test(currentSrc), "...and it is not declared anywhere in the build");
  // The one divisor both turn sites now go through, stated as source so a second expression cannot
  // creep in beside it — the "both sites read one function" guarantee is what this section owns.
  assert(/function shipTurnRate\(\) \{\s*\n\s*return SHIP_TURN \* settings\.shipTurnScale \/ shipMass\(\);\s*\n\}/.test(currentSrc),
    "shipTurnRate() is exactly SHIP_TURN * scale / shipMass() — one mass, no second coefficient");

  // ⛔ REVERSED BY CS042 P7 (FLAG-CS042-m), AND THE REVERSAL IS THE ASSERTION. This loop used to prove
  // turn was mass-INDEPENDENT at every load. It now proves turn divides by shipMass() at every load,
  // measured against the build's own shipMass() rather than a retyped coefficient.
  for (const scale of [0.5, 1.0, 1.5]) {
    A.settings.shipTurnScale = scale;
    for (const mass of [0, 12, 24]) {
      setMass(A, mass);
      const want = ST * scale / A.shipMass();
      const got = A.shipTurnRate();
      assert(near(got, want), `scale=${scale} mass=${mass}: got ${got.toFixed(6)} want ${want.toFixed(6)} (SHIP_TURN*scale/shipMass)`);
    }
  }
  // ...and it really does FALL as the load grows — the half CARGO_TURN's dormant 0.0 never delivered.
  A.settings.shipTurnScale = 1.0;
  setMass(A, 0); const turn0 = A.shipTurnRate();
  setMass(A, 12); const turn12 = A.shipTurnRate();
  setMass(A, 24); const turn24 = A.shipTurnRate();
  assert(turn0 > turn12 && turn12 > turn24,
    `⛔ a heavier chain turns strictly slower (${turn0.toFixed(3)} > ${turn12.toFixed(3)} > ${turn24.toFixed(3)} rad/s) — the CS010 §3 "inertia" fix, finally live`);
  assert(near(turn0, ST), "an EMPTY chain still turns at exactly SHIP_TURN x scale — mass 1, nothing to divide");

  // THE DIVISOR'S A/B, ON THE SHIPPED BUILD. The source substitution this section used to need is
  // retired with the constant: DEBUG.cargoUnitMass is a live registry knob, so the same proof runs
  // against the real build. At 0 the model is off and rotation is mass-independent again, which is
  // exactly the byte-for-byte pre-CS042 behaviour this file originally pinned — kept, as the A/B.
  for (const k of [0, 0.02, A.CARGO_UNIT_MASS]) {
    A.applyDebug("cargoUnitMass", k);
    for (const scale of [0.5, 1.0, 1.5]) {
      A.settings.shipTurnScale = scale;
      for (const mass of [0, 12, 24]) {
        setMass(A, mass);
        const want = ST * scale / (1 + mass * k);
        assert(near(A.shipTurnRate(), want), `cargoUnitMass=${k} scale=${scale} mass=${mass}: want ${want.toFixed(6)} got ${A.shipTurnRate().toFixed(6)}`);
      }
    }
    if (k === 0) {
      setMass(A, 24);
      assert(near(A.shipTurnRate(), ST * A.settings.shipTurnScale),
        "at cargoUnitMass 0 a FULL chain turns exactly as an empty one does — the whole model's clean A/B");
    }
  }
  A.applyDebug("cargoUnitMass", A.CARGO_UNIT_MASS);
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
  // ⛔ BOTH SIDES ARE LITERAL SHAs AS OF CS042 P7 — see the header note. The claim FLAG-3a asked for is
  // "CS010 P2's towed-mass retune did not worsen chain stability", and that is a statement about CS010
  // P2's commit against its own parent. Measured that way it is permanently true and permanently
  // checkable; measured against a moving HEAD it passed vacuously for eleven changesets and then failed
  // on an unrelated phase. The LIVE build keeps its own absolute envelope check in (D1).
  const haveRefs = p2Src !== null && p2ParentSrc !== null;
  const P2 = haveRefs ? () => buildInstance(p2Src, {}, STRESS) : null;
  const P2P = haveRefs ? () => buildInstance(p2ParentSrc, {}, STRESS) : null;
  if (!haveRefs) skip(`D: the ${P2_REF} vs ${P2_PARENT_REF} stability comparison (no git history)`);

  // (D1) Documented envelope methodology: dt=1/60, kinematic v=420/260. Reproduces the GDD's 4.11px.
  // The absolute budget is asserted on the LIVE build — that half was never a comparison and is the
  // part that must keep binding as the build changes. CS042 P7 measured it unmoved at 4.11px: the
  // kinematic stress overwrites ship velocity every frame, so it isolates the constraint solver from
  // the handling model, which is exactly why it is the documented methodology.
  const w1 = stressKinematic(buildInstance(currentSrc, {}, STRESS), 1 / 60);
  console.log(`  (D1) dt=1/60 kinematic v=420/260: live build worstStretch=${w1.worst.toFixed(2)}px (documented budget ~5px, GDD §3.4's 4.11px)`);
  assert(!w1.nan, "D1: no NaN in the live build");
  assert(w1.worst < 5.0, `D1: the LIVE build's stretch ${w1.worst.toFixed(2)}px is under the documented ~5px budget`);
  if (haveRefs) {
    const a1 = stressKinematic(P2(), 1 / 60), b1 = stressKinematic(P2P(), 1 / 60);
    console.log(`       ${P2_REF} ${a1.worst.toFixed(2)}px vs parent ${b1.worst.toFixed(2)}px  delta ${(a1.worst - b1.worst).toFixed(3)}px  (kinematic isolates the solver -> the retune was neutral)`);
    assert(Math.abs(a1.worst - b1.worst) < 0.01, `D1: CS010 P2's retune was stability-neutral under the documented methodology (delta ${(a1.worst - b1.worst).toFixed(3)}px)`);
  }

  // (D2) The real dt=0.05 clamp, realistic faithful stress — real ship.update, so the tug feeds back
  // and the retuned tug coefficient is genuinely exercised. At dt=0.05 the chain sags more than the
  // 1/60 envelope figure, inherent to the big timestep and present on both builds, so the meaningful
  // assertion is NON-REGRESSION across CS010 P2's own commit boundary, plus live sanity.
  console.log("  (D2) dt=0.05 (clamp) faithful stress — the tug-sensitive run:");
  for (const nodeMass of [1.0, 0.5, 0.25]) {
    const w = stressFaithful(buildInstance(currentSrc, {}, STRESS), nodeMass, 0.05);
    let line = `       node=${nodeMass} massSum=${w.mass}: live worst=${w.worst.toFixed(3)}px maxShipSpeed=${w.maxSpeed.toFixed(0)} NaN=${w.nan}`;
    assert(!w.nan, `D2 node=${nodeMass}: the live build produces no NaN`);
    assert(w.maxSpeed < 2000, `D2 node=${nodeMass}: live ship speed ${w.maxSpeed.toFixed(0)} bounded (no blowup)`);
    if (haveRefs) {
      const a = stressFaithful(P2(), nodeMass, 0.05), b = stressFaithful(P2P(), nodeMass, 0.05);
      line += ` | ${P2_REF} ${a.worst.toFixed(3)}px vs parent ${b.worst.toFixed(3)}px  delta ${(a.worst - b.worst >= 0 ? "+" : "") + (a.worst - b.worst).toFixed(3)}px`;
      assert(a.worst <= b.worst + 0.05, `D2 node=${nodeMass}: CS010 P2's retune did not worsen stretch (${a.worst.toFixed(3)} <= ${b.worst.toFixed(3)} + eps)`);
    }
    console.log(line);
  }

  // (D3) Report-only: the same over-stress velocity at dt=0.05 is unphysical (v=420 -> 21px/frame at
  // this timestep). Identical across the CS010 P2 boundary -> a methodology artifact, not a regression.
  const w3 = stressKinematic(buildInstance(currentSrc, {}, STRESS), 0.05);
  let l3 = `  (D3) dt=0.05 kinematic v=420/260 (over-stress, report only): live ${w3.worst.toFixed(2)}px NaN=${w3.nan}`;
  assert(!w3.nan, "D3: no NaN even under the over-stress");
  if (haveRefs) {
    const a3 = stressKinematic(P2(), 0.05), b3 = stressKinematic(P2P(), 0.05);
    l3 += ` | ${P2_REF} ${a3.worst.toFixed(2)}px vs parent ${b3.worst.toFixed(2)}px delta ${(a3.worst - b3.worst).toFixed(3)}px`;
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

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed > 0 ? 1 : 0);
