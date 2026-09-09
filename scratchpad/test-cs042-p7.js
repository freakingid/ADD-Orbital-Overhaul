// Headless test for CS042 P7 — ONE MASS, ONE FORCE, and the Engine's laden-only burn.
//
//   node scratchpad/test-cs042-p7.js
//
// WHAT LANDED (PLANNED-FEATURES-CS042.md §6.8 + §6.5):
//   Four hand-tuned divisors (CARGO_THRUST / CARGO_MAXSPD / CARGO_MASS / CARGO_TURN) are RETIRED and
//   replaced by one mass — shipMass() = 1 + chainMass() x DEBUG.cargoUnitMass. Acceleration is
//   SHIP_THRUST/M, the drag RATE divides by M, the turn rate divides by M, the momentum tug reads
//   (M-1)/M, and top speed is a flat SHIP_MAX_SPEED rail. CHAIN_TUG rescales 26 -> 58 so a full chain
//   tugs exactly as hard as before. The Engine's burn gains one term: the chain must be non-empty.
//
// TWO TRAPS THIS FILE EXISTS TO CATCH, both of them things a later pass would "fix":
//   * The two FLAGGED consequences are ASSERTED, not softened. FLAG-CS042-l (top speed is
//     mass-independent, so a full haul reaches 520) and FLAG-CS042-m (rotation IS penalised, which
//     reverses Paul's GATE A close of FLAG-CS042-j) each get a positive assertion, so restoring the
//     old behaviour goes red rather than passing quietly as a tidy-up.
//   * Every "the Engine does nothing unloaded" probe measures ALL FOUR terms, not just thrust. That
//     is §6.4/FORK-CS042-C's rule and it is design, not a bug — an empty chain is mass 1 and
//     ENGINE_MASS_MULT has nothing to act on.
//
// Sections:
//  (A) the retirements and the replacement: four constants gone from source AND exports, the new one
//      at 0.07, CHAIN_TUG at 58, the registry row, DEBRIS_SPEED_CAP still reading the constant.
//  (B) ONE MASS: shipMass() is the stated expression, and all four terms divide by that same number,
//      measured through real Ship.update / shipTurnRate / updateChain.
//  (C) MONOTONIC, NO CLAMP: accel falls, coast rises, turn falls and the tug rises at EVERY step from
//      0 to 24 nodes — including 14 -> 24, where the retired min(1.4, .) used to flat-spot.
//  (D) 0.07 REPRODUCES TODAY: acceleration is byte-identical to the phase's own parent commit at
//      every chain length, measured on both builds rather than asserted from the arithmetic.
//  (E) THE ENGINE: its benefit rises with chain length and is EXACTLY zero at length 0, in all four
//      terms; ENGINE_MASS_MULT is still its only effect and the multiplier still does not taper.
//  (F) THE BURN CONDITION: unloaded thrust burns nothing, one towed node burns exactly dt, the
//      decrement is still inside the thrust branch, and the tank is still 10.0 s.
//  (G) GDD §3.4 STABILITY RE-VALIDATION (Part 3, mandatory): the documented 24-node stress, plus the
//      readings §6.8 newly makes reachable, both against the phase's own parent.
//  (H) scope: node --check, and only this phase's own files moved.

"use strict";
// ⛔ SEEDED ABOVE EVERYTHING, per _seeded-random.js: some nondeterminism is spent at module load
// inside the factory, so a seed installed after the first buildGame() fixes nothing.
const { installSeed } = require("./_seeded-random.js");
installSeed(20260908);
const path = require("path");
const { execFileSync } = require("child_process");
const { buildGame, mkAssert, scriptSource, execSource, repoRoot } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");
const { hasKnob } = require("./test-registry.js");

const PARENT_SHA = "aebd3df";                 // cs042 p6, this phase's own parent — a LITERAL, never HEAD
const PHASE_SUBJECT = "cs042 p7:";
const DT = 1 / 60;

const A = mkAssert();
const { assert, eq, close, skip, report } = A;
const src = scriptSource();
const code = execSource(src);                 // comment-free TEXT, so a tombstone can't read as live code
const X = buildGame();
const g = X.game;

X.startGame();
g.state = "playing"; g.paused = false;

function clearField() {
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.chain.length = 0; g.garbage.length = 0; g.particles.length = 0; g.floaters.length = 0;
  g.powerups.length = 0;
  g.waveClearTimer = -1e9;                    // the standing "empty field is not a level ending" staging
}
function resetShip(over) {
  Object.assign(g.ship, { dead: false, hp: 250, invuln: 0, shieldOn: false, energy: 1,
    angle: 0, x: X.WORLD_W / 2, y: X.WORLD_H / 2, vx: 0, vy: 0, cooldown: 0 }, over || {});
  g.powerBudget = { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 };
  g.state = "playing"; g.paused = false;
}
// A straight, unstretched chain trailing the ship — the same staging test-p6.js uses.
function fillChain(n, mass) {
  const a = X.chainAnchor();
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = a.x - X.CHAIN_LINK * (i + 1), y = a.y;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: mass === undefined ? 1.0 : mass });
  }
}
function stage(inst, n, engine) {
  const gg = inst.game;
  gg.debris.length = 0; gg.hunters.length = 0; gg.saucers.length = 0; gg.bullets.length = 0;
  gg.chain.length = 0; gg.garbage.length = 0; gg.particles.length = 0; gg.floaters.length = 0;
  gg.powerups.length = 0; gg.waveClearTimer = -1e9;
  Object.assign(gg.ship, { dead: false, hp: 250, invuln: 0, shieldOn: false, energy: 1,
    angle: 0, x: inst.WORLD_W / 2, y: inst.WORLD_H / 2, vx: 0, vy: 0, cooldown: 0 });
  gg.powerBudget = { rapid: 0, triple: 0, magnet: 0, engine: engine ? 1e6 : 0, guard: 0 };
  gg.state = "playing"; gg.paused = false;
  const a = inst.chainAnchor();
  for (let i = 0; i < n; i++) {
    const x = a.x - inst.CHAIN_LINK * (i + 1), y = a.y;
    gg.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1.0 });
  }
}

// ---- the four measured terms, every one driven through the REAL code path ----

// ACCELERATION, in px/s^2, with each build's OWN drag divided back out. That last part is what makes
// this comparable across CS042 P7's boundary at all: the parent drags by (1-SHIP_DRAG)^dt and this
// build by (1-SHIP_DRAG)^(dt/M), so the raw one-frame velocity legitimately differs even where the
// acceleration behind it does not. Section (D) is the whole reason this is factored this way.
function accelOf(inst, nodes, engine) {
  stage(inst, nodes, engine);
  const M = inst.shipMass ? inst.shipMass() : null;
  const dragExp = M === null ? DT : DT / M;   // the parent has no shipMass(); its drag is mass-blind
  inst.keys["w"] = true;
  inst.game.ship.update(DT);
  inst.keys["w"] = false;
  return inst.game.ship.vx / (DT * Math.pow(1 - inst.SHIP_DRAG, dragExp));
}
// COAST: frames of pure drag to fall from 400 to 40 px/s. Driven through real Ship.update, never the
// closed form — the point is that the build's own drag reads the mass.
function coastFramesOf(inst, nodes, engine) {
  stage(inst, nodes, engine);
  inst.game.ship.vx = 400; inst.game.ship.vy = 0;
  let f = 0;
  while (inst.game.ship.vx > 40 && f < 100000) { inst.game.ship.update(DT); f++; }
  return f;
}
function turnOf(inst, nodes, engine) { stage(inst, nodes, engine); return inst.shipTurnRate(); }
// TUG massFactor, recovered from the real updateChain: node 0 held taut along +x by a known stretch,
// the rest parked well off-axis so they contribute mass and nothing else.
function tugFactorOf(inst, nodes, engine) {
  stage(inst, nodes, engine);
  const a = inst.chainAnchor();
  const stretch = 40, td = inst.CHAIN_LINK + stretch;
  inst.game.chain.length = 0;
  inst.game.chain.push({ x: a.x + td, y: a.y, px: a.x + td, py: a.y, spin: 0, spinRate: 0, mass: 1 });
  for (let i = 1; i < nodes; i++)
    inst.game.chain.push({ x: a.x + td + i, y: a.y + 200, px: a.x + td + i, py: a.y + 200, spin: 0, spinRate: 0, mass: 1 });
  inst.game.ship.vx = 0; inst.game.ship.vy = 0;
  inst.updateChain(DT);
  return inst.game.ship.vx / (inst.CHAIN_TUG * stretch * DT);
}
// TERMINAL speed under held thrust — long enough to settle at whatever binds, cap or drag.
function terminalOf(inst, nodes, engine) {
  stage(inst, nodes, engine);
  inst.keys["w"] = true;
  for (let i = 0; i < 3000; i++) inst.game.ship.update(DT);
  inst.keys["w"] = false;
  return Math.hypot(inst.game.ship.vx, inst.game.ship.vy);
}

const LENGTHS = [0, 4, 8, 12, 16, 20, 24];

// ================= (A) the retirements and the one replacement =================
(function sectionA() {
  console.log("(A) four divisors retired, one mass constant replaces them, one registry row");

  for (const gone of ["CARGO_THRUST", "CARGO_MAXSPD", "CARGO_MASS", "CARGO_TURN"]) {
    eq(X[gone], undefined, `A: ${gone} is retired — not a global at all`);
    assert(!new RegExp("^\\s*const\\s+" + gone + "\\s*=", "m").test(code),
      `A: ...and ${gone} is not declared anywhere in executable source`);
    // ⛔ The comment tombstone survives BY RULE (the phase prompt: rewritten to record the retirement,
    // never deleted), which is exactly why the checks above run over execSource()'s comment-free text
    // while this one runs over the raw source.
    assert(new RegExp("\\b" + gone + "\\b").test(src),
      `A: ...but ${gone} IS still named in a comment — the retirement is recorded, not erased`);
  }
  close(X.CARGO_UNIT_MASS, 0.07, "A: CARGO_UNIT_MASS ships at 0.07 — CARGO_THRUST's own old value");
  close(X.DEBUG.cargoUnitMass, X.CARGO_UNIT_MASS, "A: DEBUG.cargoUnitMass, what shipMass() reads, derives from it");
  eq(X.CHAIN_TUG, 58, "A: CHAIN_TUG rescaled 26 -> 58 to hold the full chain's tug fixed");
  // Its own registry row, through the one file allowed to know registry facts.
  hasKnob(X, "cargoUnitMass", { def: 0.07, min: 0, max: 0.30, step: 0.005 }, A);

  // ⛔ FLAG-CS017-a's guard rail is untouched and still reads the CONSTANT, not any live top speed —
  // it has nothing to do with player handling and the phase prompt names it by name.
  assert(/const DEBRIS_SPEED_CAP = 2 \* SHIP_MAX_SPEED;/.test(code),
    "A: DEBRIS_SPEED_CAP still reads `2 * SHIP_MAX_SPEED`, the constant");
  eq(X.DEBRIS_SPEED_CAP, 2 * X.SHIP_MAX_SPEED, "A: ...and evaluates to twice it");
  eq(X.SHIP_MAX_SPEED, 520, "A: SHIP_MAX_SPEED itself is unmoved at 520");
  eq(X.SHIP_DRAG, 0.35, "A: ⛔ SHIP_DRAG is unmoved at 0.35 — §6.3's proposed 0.45 is CLOSED and does not ship");

  // ⛔ §6.4 / FORK-CS042-C: the withdrawn Engine constants were never built and must not appear.
  // §6.7's CARGO_COAST likewise never shipped as a constant — the dt divisor is what it turned out to be.
  for (const never of ["ENGINE_THRUST_MULT", "ENGINE_MAXSPD_MULT", "ENGINE_DRAG_MULT",
                       "ENGINE_TAPER_SECONDS", "CARGO_COAST"])
    assert(!new RegExp("\\b" + never + "\\b").test(code),
      `A: ⛔ ${never} does not exist — proposed and withdrawn, never to be re-invented`);
})();

// ================= (B) one mass, and all four terms divide by it =================
(function sectionB() {
  console.log("(B) shipMass() is the one divisor for acceleration, drag, turn and the tug");

  assert(/function shipMass\(\) \{\s*\n\s*return 1 \+ chainMass\(\) \* DEBUG\.cargoUnitMass;\s*\n\}/.test(code),
    "B: shipMass() is exactly `1 + chainMass() * DEBUG.cargoUnitMass`");
  assert(/function shipTurnRate\(\) \{\s*\n\s*return SHIP_TURN \* settings\.shipTurnScale \/ shipMass\(\);\s*\n\}/.test(code),
    "B: shipTurnRate() divides by that same shipMass()");
  assert(/const massFactor = \(M - 1\) \/ M;/.test(code), "B: the tug's massFactor is (M-1)/M");
  assert(/const drag = Math\.pow\(1 - SHIP_DRAG, dt \/ M\);/.test(code), "B: drag divides its exponent by M");
  assert(/if \(sp > SHIP_MAX_SPEED\) \{/.test(code),
    "B: ⛔ the speed clamp reads SHIP_MAX_SPEED bare — no cargo divisor left in it");

  for (const n of LENGTHS) {
    clearField(); resetShip(); fillChain(n);
    const M = 1 + n * X.DEBUG.cargoUnitMass;
    close(X.shipMass(), M, `B: shipMass() at ${n} nodes is 1 + ${n}*cargoUnitMass`, 1e-12);
    close(accelOf(X, n, false), X.SHIP_THRUST / M, `B: acceleration at ${n} nodes is SHIP_THRUST/M`, 1e-6);
    close(turnOf(X, n, false), X.SHIP_TURN * X.settings.shipTurnScale / M, `B: turn rate at ${n} nodes is SHIP_TURN*scale/M`, 1e-12);
    if (n > 0) close(tugFactorOf(X, n, false), (M - 1) / M, `B: tug massFactor at ${n} nodes is (M-1)/M`, 1e-6);
    // Coast is checked against the closed form the divided exponent implies: the time to fall by a
    // fixed ratio scales linearly in M. Frames, so a rounding tolerance of one frame either way.
    const want = coastFramesOf(X, 0, false) * M;
    assert(Math.abs(coastFramesOf(X, n, false) - want) <= 1,
      `B: coast at ${n} nodes is the empty ship's x M (${coastFramesOf(X, n, false)} vs ${want.toFixed(1)} frames)`);
  }

  // ⛔ 0 IS THE WHOLE MODEL'S A/B, not just "less mass": every term reads unloaded at once.
  X.applyDebug("cargoUnitMass", 0);
  clearField(); resetShip(); fillChain(24);
  close(X.shipMass(), 1, "B: at cargoUnitMass 0 a FULL chain still weighs exactly 1");
  close(accelOf(X, 24, false), X.SHIP_THRUST, "B: ...acceleration is the unloaded 340", 1e-6);
  close(turnOf(X, 24, false), X.SHIP_TURN * X.settings.shipTurnScale, "B: ...turn is the unloaded rate", 1e-12);
  close(tugFactorOf(X, 24, false), 0, "B: ...and the tug is zero — (M-1)/M with M=1", 1e-12);
  eq(coastFramesOf(X, 24, false), coastFramesOf(X, 0, false), "B: ...and it coasts exactly like an empty ship");
  X.applyDebug("cargoUnitMass", X.CARGO_UNIT_MASS);
  close(X.DEBUG.cargoUnitMass, 0.07, "B: (teardown) the knob is back at its shipped default");
})();

// ================= (C) monotonic in chain length, with no clamp anywhere =================
(function sectionC() {
  console.log("(C) accel, coast, turn and tug all move monotonically with load — no clamp, no flat spot");

  const rows = LENGTHS.map(n => ({
    n,
    accel: accelOf(X, n, false),
    coast: coastFramesOf(X, n, false),
    turn: turnOf(X, n, false),
    tug: n === 0 ? 0 : tugFactorOf(X, n, false),
    term: terminalOf(X, n, false),
  }));
  for (const r of rows)
    console.log(`    ${String(r.n).padStart(2)} nodes: accel ${r.accel.toFixed(1).padStart(5)} px/s²  ` +
      `coast ${String(r.coast).padStart(4)} fr  turn ${(r.turn * 180 / Math.PI).toFixed(1).padStart(5)} °/s  ` +
      `tug ${r.tug.toFixed(3)}  terminal ${r.term.toFixed(0)} px/s`);

  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1], b = rows[i];
    assert(b.accel < a.accel, `C: acceleration falls from ${a.n} to ${b.n} nodes (${a.accel.toFixed(1)} -> ${b.accel.toFixed(1)})`);
    assert(b.coast > a.coast, `C: coast rises from ${a.n} to ${b.n} nodes (${a.coast} -> ${b.coast} frames)`);
    assert(b.turn < a.turn, `C: turn rate falls from ${a.n} to ${b.n} nodes`);
    assert(b.tug > a.tug, `C: the tug rises from ${a.n} to ${b.n} nodes (${a.tug.toFixed(3)} -> ${b.tug.toFixed(3)})`);
  }

  // ⛔ THE RETIRED FLAT SPOT, NAMED. min(1.4, m x CARGO_MASS) saturated at m=14, so every chain from
  // 14 to 24 nodes yanked identically — "more debris, more effect" stopped being true a third of the
  // way up the payload curve. (M-1)/M has no clamp, so it keeps growing to the cap and past it.
  const tug14 = tugFactorOf(X, 14, false), tug24 = tugFactorOf(X, 24, false);
  assert(tug24 > tug14 + 0.01,
    `C: ⛔ 14 -> 24 nodes still grows the tug (${tug14.toFixed(3)} -> ${tug24.toFixed(3)}) — the old 1.4 clamp tied them`);
  assert(tugFactorOf(X, 200, false) < 1,
    "C: ...and (M-1)/M asymptotes below 1 on its own at absurd load — physical, not clamped");
  // No expression in the tug's own block clamps anything.
  const tugBlock = code.slice(code.indexOf("const massFactor"), code.indexOf("const massFactor") + 200);
  assert(!/Math\.min|Math\.max|clamp/.test(tugBlock), "C: ...and the tug block contains no min/max/clamp at all");

  // ⛔ FLAG-CS042-l, ASSERTED RATHER THAN SOFTENED: terminal speed is mass-INDEPENDENT now, so a full
  // haul reaches the same rail an empty ship does. The old build capped a 24-node chain at ~283 px/s.
  // Restoring that divisor would go red here, which is the point — this is a flagged consequence
  // awaiting Paul at GATE C, not an oversight for a later pass to quietly undo.
  for (const r of rows)
    assert(r.term > X.SHIP_MAX_SPEED * 0.98,
      `C: ⛔ FLAG-CS042-l — a ${r.n}-node chain still reaches the flat rail (${r.term.toFixed(0)} of ${X.SHIP_MAX_SPEED})`);
  assert(Math.abs(rows[rows.length - 1].term - rows[0].term) < 5,
    `C: ⛔ ...and a FULL haul's top speed is within 5 px/s of an empty ship's (${rows[rows.length - 1].term.toFixed(0)} vs ${rows[0].term.toFixed(0)})`);

  // ⛔ FLAG-CS042-m, LIKEWISE ASSERTED: rotation IS penalised, reversing Paul's GATE A close of
  // FLAG-CS042-j. There is deliberately no special case exempting it, and no constant to re-zero.
  const deg = r => r * 180 / Math.PI;
  assert(deg(rows[0].turn) > 200 && deg(rows[rows.length - 1].turn) < 120,
    `C: ⛔ FLAG-CS042-m — turn falls from ${deg(rows[0].turn).toFixed(0)} to ${deg(rows[rows.length - 1].turn).toFixed(0)} °/s across an empty-to-full chain`);
})();

// ================= (D) 0.07 reproduces the parent's acceleration exactly =================
(function sectionD() {
  console.log("(D) acceleration is byte-identical to the parent commit at every chain length");
  const ps = parentSource(PARENT_SHA);
  if (ps === null) { skip(`D: the acceleration comparison against ${PARENT_SHA}`); return; }
  const P = buildGame({ source: ps });
  P.startGame();
  P.game.state = "playing"; P.game.paused = false;

  // (setup) the parent really is the old model — otherwise this section proves nothing.
  close(P.CARGO_THRUST, 0.07, "D: (setup) the parent still carries CARGO_THRUST 0.07");
  close(P.CARGO_MAXSPD, 0.035, "D: (setup) ...and CARGO_MAXSPD 0.035");
  eq(P.shipMass, undefined, "D: (setup) ...and has no shipMass() at all");

  for (const n of LENGTHS) {
    const now = accelOf(X, n, false), then = accelOf(P, n, false);
    close(now, then, `D: ⛔ acceleration at ${n} nodes is unmoved (${now.toFixed(6)} vs ${then.toFixed(6)} px/s²)`, 1e-9);
  }
  // ...and with the Engine lit, too — chainMass() is untouched, so the relief lands identically.
  for (const n of [8, 16, 24]) {
    const now = accelOf(X, n, true), then = accelOf(P, n, true);
    close(now, then, `D: ...and with the Engine up at ${n} nodes (${now.toFixed(6)} vs ${then.toFixed(6)})`, 1e-9);
  }

  // ⛔ AND THE THINGS THAT DID MOVE, MEASURED ON BOTH BUILDS. Without these the section above could be
  // satisfied by a phase that changed nothing at all.
  const pCoast24 = coastFramesOf(P, 24, false), xCoast24 = coastFramesOf(X, 24, false);
  eq(pCoast24, coastFramesOf(P, 0, false), "D: the parent's coast was mass-BLIND — 24 nodes stopped exactly like empty");
  assert(xCoast24 > pCoast24 * 2.5, `D: ⛔ ...and now a full haul coasts ${(xCoast24 / pCoast24).toFixed(2)}x longer (${pCoast24} -> ${xCoast24} frames)`);
  close(turnOf(P, 24, false), turnOf(P, 0, false), "D: the parent's turn rate was mass-blind (CARGO_TURN dormant at 0)");
  assert(turnOf(X, 24, false) < turnOf(X, 0, false) * 0.5, "D: ⛔ ...and now a full haul turns at under half the empty rate");
  assert(terminalOf(P, 24, false) < 300 && terminalOf(X, 24, false) > 500,
    `D: ⛔ the parent capped a full haul at ${terminalOf(P, 24, false).toFixed(0)} px/s; it now reaches ${terminalOf(X, 24, false).toFixed(0)}`);
  // ⛔ THE TUG CURVE, MEASURED ON BOTH BUILDS, BECAUSE §6.8 DID NOT STATE THIS AND IT IS NOT WHAT A
  // READER WOULD ASSUME. CHAIN_TUG's 26 -> 58 rescale was solved to hold the FULL chain's yank fixed,
  // and it does — but the two curves have different shapes between the endpoints, so holding one end
  // does not hold the middle. Old: 26 x min(1.4, 0.10m), a straight line that clamps flat from m=14.
  // New: 58 x (M-1)/M, a smooth saturating curve. They cross at m ~= 8. Below that the new tug is
  // STRONGER (up to +37% at m=2); between 8 and 24 it is WEAKER, worst at m=14 where the old one had
  // just hit its clamp. This is a real consequence for GATE C, not a defect: it is what "no clamp"
  // costs, and CS010's own reason for raising CARGO_MASS was mid-range heft. Recorded rather than
  // asserted away, and asserted in the direction it actually goes so a future retune sees it move.
  const pull = (inst, n) => inst.CHAIN_TUG * tugFactorOf(inst, n, false);
  console.log("      tug, accel px/s² per px of stretch — parent vs live:");
  for (const n of [2, 4, 8, 12, 14, 16, 20, 24]) {
    const a = pull(P, n), b = pull(X, n);
    console.log(`        ${String(n).padStart(2)} nodes: ${a.toFixed(2).padStart(6)} -> ${b.toFixed(2).padStart(6)}  ${((b / a - 1) * 100).toFixed(1).padStart(6)}%`);
  }
  close(pull(X, 24), pull(P, 24), `D: ⛔ a FULL chain's tug is unmoved by the rescale (${pull(X, 24).toFixed(2)} vs ${pull(P, 24).toFixed(2)} px/s² per px)`, 0.1);
  assert(pull(X, 4) > pull(P, 4) * 1.10,
    `D: a SHORT chain tugs harder than it used to (${pull(P, 4).toFixed(2)} -> ${pull(X, 4).toFixed(2)} at 4 nodes)`);
  assert(pull(X, 14) < pull(P, 14) * 0.85,
    `D: ⛔ ...and the MID range tugs LESS, worst at 14 nodes where the old clamp bit (${pull(P, 14).toFixed(2)} -> ${pull(X, 14).toFixed(2)}, ${((pull(X, 14) / pull(P, 14) - 1) * 100).toFixed(1)}%)`);
  assert(pull(P, 14) === pull(P, 24) && pull(X, 14) < pull(X, 24),
    "D: ⛔ ...which is the trade: the parent tied 14 and 24 nodes at the clamp, and this build does not");
})();

// ================= (E) the Engine: rises with load, exactly nothing at zero =================
(function sectionE() {
  console.log("(E) the Engine's benefit rises with chain length and is EXACTLY zero when unloaded");

  // ⛔ ZERO MEANS ZERO, IN ALL FOUR TERMS. §6.4 / FORK-CS042-C — Paul's explicit call, and the reason
  // §6.5's burn condition exists at all. Checking only thrust here would miss a cargo-independent
  // effect sneaking in through drag or rotation, which is exactly what was proposed and withdrawn.
  close(accelOf(X, 0, true), accelOf(X, 0, false), "E: ⛔ unloaded acceleration is identical with the Engine lit", 1e-12);
  close(turnOf(X, 0, true), turnOf(X, 0, false), "E: ⛔ ...so is the turn rate", 1e-12);
  eq(coastFramesOf(X, 0, true), coastFramesOf(X, 0, false), "E: ⛔ ...so is the coast");
  close(terminalOf(X, 0, true), terminalOf(X, 0, false), "E: ⛔ ...so is the top speed", 1e-9);
  clearField(); resetShip(); g.powerBudget.engine = 1e6;
  close(X.shipMass(), 1, "E: ⛔ ...because an empty chain is mass 1 and the multiplier has nothing to act on");

  // The benefit, as a ratio, must GROW with the load — that is the whole "the Engine finally matters"
  // claim, and it is what makes a heavier chain worth taking.
  let prev = 1;
  for (const n of [4, 8, 12, 16, 20, 24]) {
    const gain = accelOf(X, n, true) / accelOf(X, n, false);
    assert(gain > prev, `E: the Engine's acceleration gain at ${n} nodes (${((gain - 1) * 100).toFixed(1)}%) exceeds the shorter chain's`);
    prev = gain;
  }
  const gain24 = accelOf(X, 24, true) / accelOf(X, 24, false);
  assert(gain24 > 1.4, `E: at a full chain the Engine is worth +${((gain24 - 1) * 100).toFixed(0)}% acceleration`);
  assert(coastFramesOf(X, 24, true) < coastFramesOf(X, 24, false), "E: ...and it shortens the coast, so a laden ship can stop again");
  assert(turnOf(X, 24, true) > turnOf(X, 24, false), "E: ...and gives back rotation, the term §6.8 newly costs");
  assert(tugFactorOf(X, 24, true) < tugFactorOf(X, 24, false), "E: ...and eases the tug — one mass, so all four at once");

  // ⛔ CS024 P6's FLAT rule STANDS: full effect until the tank runs out, no taper, no sputter.
  clearField(); resetShip(); fillChain(8);
  g.powerBudget.engine = 10;
  const lit = X.chainMass();
  close(lit, 8 * X.DEBUG.engineMassMult, "E: (setup) a lit Engine halves an 8-node chain's towed mass");
  for (const fuel of [10, 5, 1, 0.1, 1e-6]) {
    g.powerBudget.engine = fuel;
    close(X.chainMass(), lit, `E: at ${fuel}s of fuel the towed mass is the same flat 8 x engineMassMult — no taper`, 1e-12);
  }
  g.powerBudget.engine = 0;
  close(X.chainMass(), 8, "E: ...and snaps back to the full 8 the instant the tank empties");
  // ENGINE_MASS_MULT is still the Engine's ONE effect: chainMass() is the only place it is read.
  eq((code.match(/DEBUG\.engineMassMult/g) || []).length, 1,
    "E: ⛔ DEBUG.engineMassMult is read in exactly ONE place — chainMass(), the Engine's only effect");
  assert(code.slice(code.indexOf("function chainMass"), code.indexOf("function shipMass")).includes("DEBUG.engineMassMult"),
    "E: ...and that place is chainMass()");
})();

// ================= (F) the burn condition gains one term, and only one =================
(function sectionF() {
  console.log("(F) fuel burns on LADEN thrust only — spec §6.5");

  eq(X.DEBUG.engineBurnSeconds, 10.0, "F: ⛔ ENGINE_BURN_SECONDS is unmoved at 10.0 — the tank is not resized");
  eq(X.ENGINE_BURN_SECONDS, 10.0, "F: ...and the shipped constant behind it agrees");

  // Structure: the term is an INNER guard on the decrement, never a widening of the thrust branch.
  // Thrust must obviously still work unloaded, and §6.5 requires the decrement stay where it is.
  assert(/if \(game\.chain\.length > 0\) game\.powerBudget\.engine = Math\.max\(0, game\.powerBudget\.engine - dt\);/.test(code),
    "F: the guard and the decrement share one line, inside the thrust branch");
  assert(/this\.thrusting = input\.thrust\(\);/.test(code) && /if \(this\.thrusting\) \{/.test(code),
    "F: ⛔ ...and `if (this.thrusting) {` is unchanged — the term did NOT widen the branch");
  eq((code.match(/powerBudget\.engine/g) || []).length, 2,
    "F: `powerBudget.engine` still appears exactly twice — the two sides of ONE assignment");
  eq(code.split("\n").filter(l => l.includes("powerBudget.engine")).length, 1,
    "F: ...on exactly one line of executable source, so there is no second place fuel burns");

  // Behaviour, both directions, driven through real Ship.update.
  clearField(); resetShip();
  X.applyPowerup("engine");
  const tank = g.powerBudget.engine;
  X.keys["w"] = true;
  for (let i = 0; i < 900; i++) g.ship.update(DT);   // fifteen seconds — one and a half tanks
  X.keys["w"] = false;
  assert(Math.hypot(g.ship.vx, g.ship.vy) > 100, "F: (precondition) the unloaded ship really did thrust");
  eq(g.powerBudget.engine, tank, "F: ⛔ 900 frames of UNLOADED thrust burned nothing — the tank no longer leaks");
  assert(X.powerActive("engine"), "F: ...so the Engine survives a flight it could not have helped");

  fillChain(1);                                       // ONE node: the term is `length > 0`, not a mass floor
  X.keys["w"] = true;
  for (let i = 0; i < 60; i++) g.ship.update(DT);
  X.keys["w"] = false;
  close(g.powerBudget.engine, tank - 60 * DT, "F: ⛔ ...and ONE towed node starts it burning again, at exactly dt a frame", 1e-9);

  // Rotating and coasting still cost nothing, LADEN — otherwise the new term would be the reason
  // they pass and CS024 P6's own claim would go untested.
  clearField(); resetShip(); fillChain(8);
  X.applyPowerup("engine");
  const before = g.powerBudget.engine;
  const angle0 = g.ship.angle;
  X.keys["arrowleft"] = true;
  for (let i = 0; i < 600; i++) g.ship.update(DT);
  X.keys["arrowleft"] = false;
  assert(g.ship.angle !== angle0, "F: (precondition) the laden ship really did rotate");
  eq(g.powerBudget.engine, before, "F: 600 frames of LADEN rotation still burn nothing");
  for (let i = 0; i < 600; i++) g.ship.update(DT);
  eq(g.powerBudget.engine, before, "F: ...and 600 frames of laden coasting burn nothing either");

  // The clamp still holds, laden, at the loop's maximum dt.
  clearField(); resetShip(); fillChain(1);
  g.powerBudget.engine = 0.01;
  X.keys["w"] = true;
  g.ship.update(0.05); g.ship.update(0.05);
  X.keys["w"] = false;
  eq(g.powerBudget.engine, 0, "F: a large dt against a near-empty tank clamps at exactly 0, never negative");
  assert(!X.powerActive("engine"), "F: ...and reads as inactive");
})();

// ================= (G) GDD §3.4 stability envelope — RE-VALIDATED, not assumed =================
(function sectionG() {
  console.log("(G) GDD §3.4 re-validation: 24 nodes, 900 frames, against this phase's own parent");
  const NODES = 24, FRAMES = 900;
  const ps = parentSource(PARENT_SHA);
  if (ps === null) skip(`G: the parent-vs-worktree half of the §3.4 re-validation (${PARENT_SHA})`);
  const P = ps === null ? null : buildGame({ source: ps });
  if (P) { P.startGame(); P.game.state = "playing"; P.game.paused = false; }

  function measure(inst) {
    const an = inst.chainAnchor();
    let worst = 0, nan = false, nodeSpeed = 0;
    for (let i = 0; i < inst.game.chain.length; i++) {
      const leader = i === 0 ? an : inst.game.chain[i - 1], n = inst.game.chain[i];
      if (!isFinite(n.x) || !isFinite(n.y)) nan = true;
      const [dx, dy] = inst.shortDelta(leader.x, leader.y, n.x, n.y);
      worst = Math.max(worst, Math.abs(Math.hypot(dx, dy) - inst.CHAIN_LINK));
      nodeSpeed = Math.max(nodeSpeed, Math.hypot(n.x - n.px, n.y - n.py));
    }
    return { worst, nan, nodeSpeed };
  }
  // KINEMATIC — the documented methodology (test-p6.js §E, GDD §3.4). Ship velocity is overwritten
  // every frame, so the tug cannot feed back and this isolates the constraint solver.
  function kinematic(inst, dt, vx, vy) {
    stage(inst, NODES, false);
    let worst = 0, nan = false, nodeSpeed = 0;
    for (let fr = 0; fr < FRAMES; fr++) {
      const s = inst.game.ship;
      s.vx = (Math.floor(fr / 10) % 2 === 0 ? 1 : -1) * vx;
      s.vy = (Math.floor(fr / 23) % 2 === 0 ? 1 : -1) * vy;
      s.x += s.vx * dt; s.y += s.vy * dt;
      if (s.x < 0) s.x += inst.WORLD_W; if (s.x > inst.WORLD_W) s.x -= inst.WORLD_W;
      if (s.y < 0) s.y += inst.WORLD_H; if (s.y > inst.WORLD_H) s.y -= inst.WORLD_H;
      inst.updateChain(dt);
      const m = measure(inst);
      worst = Math.max(worst, m.worst); nodeSpeed = Math.max(nodeSpeed, m.nodeSpeed / dt);
      if (m.nan) nan = true;
    }
    return { worst, nan, nodeSpeed, left: inst.game.chain.length };
  }
  // FAITHFUL — real Ship.update, so the tug feeds back and the handling model is genuinely exercised.
  // `settle` frames of one heading first: that is the regime §6.8 newly makes reachable, because a
  // laden ship is no longer speed-capped and can build to the full rail before the flips start.
  function faithful(inst, dt, settle) {
    stage(inst, NODES, false);
    inst.input.thrust = () => true; inst.input.fire = () => false; inst.input.shield = () => false;
    inst.input.left = () => false; inst.input.right = () => false;
    const dirs = [0, Math.PI, Math.PI / 2, -Math.PI / 2];
    let worst = 0, nan = false, maxSpeed = 0, nodeSpeed = 0;
    for (let fr = 0; fr < settle + FRAMES; fr++) {
      inst.game.ship.angle = fr < settle ? 0 : dirs[Math.floor((fr - settle) / 40) % 4];
      inst.game.ship.update(dt);
      inst.updateChain(dt);
      const sp = Math.hypot(inst.game.ship.vx, inst.game.ship.vy);
      maxSpeed = Math.max(maxSpeed, sp); if (!isFinite(sp)) nan = true;
      const m = measure(inst);
      worst = Math.max(worst, m.worst); nodeSpeed = Math.max(nodeSpeed, m.nodeSpeed / dt);
      if (m.nan) nan = true;
    }
    return { worst, nan, maxSpeed, nodeSpeed, left: inst.game.chain.length };
  }

  // ---- the documented number, which is the one §3.4's ~5 px budget is defined against ----
  const k = kinematic(X, 1 / 60, 420, 260);
  console.log(`    documented (kinematic dt=1/60, v=420/260): worst link stretch ${k.worst.toFixed(3)}px of ${X.CHAIN_LINK}px, CHAIN_ITER=${X.CHAIN_ITER}`);
  assert(!k.nan, "G: no NaN under the documented stress");
  assert(k.worst < 5.0, `G: ⛔ worst-case link stretch ${k.worst.toFixed(3)}px is under §3.4's ~5px budget`);
  assert(k.nodeSpeed < 5000, `G: no node velocity explosion (${k.nodeSpeed.toFixed(0)} px/s)`);
  eq(k.left, NODES, "G: no node lost or duplicated across the stress");
  eq(X.CHAIN_ITER, 4, "G: ⛔ CHAIN_ITER is UNMOVED at 4 — the budget was not exceeded, so nothing was raised to fit");
  if (P) {
    const kp = kinematic(P, 1 / 60, 420, 260);
    console.log(`      parent ${kp.worst.toFixed(3)}px  delta ${(k.worst - kp.worst).toFixed(3)}px`);
    close(k.worst, kp.worst, `G: ⛔ ...and it is UNCHANGED from the parent (delta ${(k.worst - kp.worst).toFixed(3)}px) — the kinematic stress isolates the solver`, 0.01);
  }

  // ---- the readings §6.8 newly makes reachable, recorded because they are the ones it moves ----
  // A laden ship used to clamp at ~283 px/s; it can now build to the full 520 rail and hold it. So the
  // v=420 over-stress above is no longer strictly an over-stress, and the faithful run is re-measured
  // with a settling period long enough to actually reach terminal before the heading flips begin.
  const probes = [
    ["kinematic dt=1/60 v=520/320 (the new attainable max)", inst => kinematic(inst, 1 / 60, 520, 320)],
    ["faithful  dt=1/60 settled to terminal first        ", inst => faithful(inst, 1 / 60, 900)],
    ["faithful  dt=0.05 settled to terminal first        ", inst => faithful(inst, 0.05, 900)],
  ];
  for (const [label, run] of probes) {
    const w = run(X);
    let line = `    ${label}: ${w.worst.toFixed(3)}px` +
      (w.maxSpeed === undefined ? "" : ` (peak ship speed ${w.maxSpeed.toFixed(0)} px/s)`);
    assert(!w.nan, `G: no NaN — ${label.trim()}`);
    assert(w.nodeSpeed < 5000, `G: node speeds bounded (${w.nodeSpeed.toFixed(0)} px/s) — ${label.trim()}`);
    eq(w.left, NODES, `G: no node lost — ${label.trim()}`);
    if (P) {
      const h = run(P);
      line += `  | parent ${h.worst.toFixed(3)}px  delta ${(w.worst - h.worst >= 0 ? "+" : "") + (w.worst - h.worst).toFixed(3)}px`;
      // ⛔ THE BOUND IS STATED AND IT IS NOT "no worse than the parent". §6.8 lets a laden ship sustain
      // far higher speeds for far longer, so the faithful stretch GROWS — it must, and pretending
      // otherwise would be the dishonest pin. What is asserted is that the growth stays small
      // (measured at +0.0 to +1.2px against a parent already at 7-13px on these methodologies, whose
      // own figures §3.4 records as big-timestep artifacts rather than budget readings).
      assert(w.worst <= h.worst + 1.5,
        `G: the stretch grew by no more than 1.5px against the parent — ${label.trim()} (${h.worst.toFixed(3)} -> ${w.worst.toFixed(3)})`);
    }
    console.log(line);
  }
})();

// ================= (H) scope =================
(function sectionH() {
  console.log("(H) node --check on the extracted script; only this phase's own files moved");
  const os = require("os"), fs = require("fs");
  const tmp = path.join(os.tmpdir(), "cs042-p7-extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync("node", ["--check", tmp], { stdio: ["ignore", "pipe", "pipe"] }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: H: syntax: " + String(e.stderr)); }

  const own = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (own === null) { skip("H: the scope pin (no git history)"); return; }
  if (own.length > 1) { assert(false, `H: ${own.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one`); return; }
  const changed = changedFiles(PARENT_SHA, own[0] || null);
  if (changed === null) { skip("H: the scope pin (could not diff)"); return; }
  if (!own.length) console.log("    (pre-commit: measuring the working tree, provisionally)");
  // The GDD is passed as an EXTRA rather than assumed: §3.4's stability envelope and its cargo-penalty
  // bullet are this phase's own mandatory re-validation target, and nothing else in the GDD is.
  const outside = outsideScope(changed, ["ORBITAL-OVERHAUL-GDD.md"]);
  eq(outside.join(", "), "", `H: nothing outside the game file, the suite, STATUS.md and GDD §3.4 moved (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "H: (setup) the game file really is in the diff");
  assert(changed.includes("scratchpad/test-cs042-p7.js"), "H: (setup) ...and so is this file");
})();

report();
