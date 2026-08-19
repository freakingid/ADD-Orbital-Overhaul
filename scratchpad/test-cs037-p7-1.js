// Headless test for CS037 P7.1 — tow release separation, Gate B's own finding
// (PLANNED-FEATURES-CS037.md §7.1, IMPLEMENTATION-PHASES-CS037.md P7.1).
//
//   node scratchpad/test-cs037-p7-1.js
//
// This phase owns: the two new mechanisms hooked ONLY inside damageShip()'s chain-loss block
// (directed release + game.towLockoutT pickup lockout), the two new SHIP registry knobs, and the
// pickup block's two gates (`pulling`, the capture `if`). It does NOT own scatterChain() or
// Garbage.fromNode(), which P5 already proved byte-unchanged and which §H re-proves here — a
// regression that moves either mechanism INTO one of those two functions is invisible to P5's own
// suite (breakChain() still calls fromNode() and still scatters randomly either way) and is exactly
// what §H's source pin exists to catch.
// ⛔ the auto-shield save is the trap this phase most needs pinned: it sets ship.invuln too, and a
// lockout gated on that field would blackout pickup after a successful save that KEPT the cargo.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const A = mkAssert();
const { assert, eq, close } = A;

const DT = 1 / 60;
const stripped = execSource(scriptSource());
// execSource() blanks a comment's TEXT but leaves its line's own trailing whitespace behind (it
// preserves line numbering), so a signature line ending in a now-gone `// ...` comment reads back
// with a trailing space before the newline. Both extraction helpers below trim that per line.
const trimTrailing = t => t.split("\n").map(l => l.replace(/[ \t]+$/, "")).join("\n");
// Top-level function, closing brace at column 0.
const bodyOf = (text, sig) => { const i = text.indexOf(sig); return trimTrailing(text.slice(i, text.indexOf("\n}\n", i))); };
// A class METHOD, indented two spaces — closes on "\n  }\n", not "\n}\n".
const methodBodyOf = (text, sig) => { const i = text.indexOf(sig); return trimTrailing(text.slice(i, text.indexOf("\n  }\n", i))); };

// ---- staging helpers (test-cs037-p5.js's own idiom, reused verbatim) -----------------------
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null; g.levelEndSafe = false;
  g.levelEndFreeze = false; g.levelDone = null;
  // An immortal dummy Debris satellite, parked far away — an EMPTY debris array would start the
  // wave-clear timer, which fires nextWave() mid-measurement across a multi-frame section (test-cs025-p1's
  // own idiom; test-cs037-p5.js gets away without one only because every one of its sections drives a
  // single update() frame).
  const d = new X.DebrisSatellite(1e5, 1e5, 1); d.vx = 0; d.vy = 0;
  g.debris = [d]; g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0; g.chain.length = 0;
  g.particles.length = 0;
  g.saucerTimer = 1e6; g.hunterTimer = 1e6; g.healthTimer = 1e6;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.shieldOn = false; g.ship.invuln = 0;
  g.ship.hp = X.SHIP_MAX_HP; g.ship.energy = 1;
  X.settings.autoShield = false;
  g.deliveryCount = 0; g.magnetHoldT = 0; g.towLockoutT = 0;
  if (g.dock) { g.dock.x = 200; g.dock.y = 200; }   // parked far away — inRing never true here
  return g;
}
const TOW_MASS = 0.5;
function layChain(X, n, far = 600) {
  const g = X.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = g.ship.x + far + i * 12, y = g.ship.y + far;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: TOW_MASS });
  }
  return g.chain;
}
const fromTow = X => X.game.garbage.filter(gb => gb.mass === TOW_MASS);
// An inert canister at (dx, dy) off the ship: zero velocity, coalesce delay far beyond the test's
// horizon, so the ONLY thing that can move it is the magnet's own attraction (test-cs025-p1's idiom).
function inertPiece(X, dx, dy) {
  const g = X.game;
  const p = new X.Garbage(g.ship.x + dx, g.ship.y + dy, 0, 0);
  p.coalesceDelay = 1e6;
  g.garbage.push(p);
  return p;
}

// ================= (A) the two registry knobs =================
console.log("(A) towReleaseLockout / towReleaseSpeed: the registry rows, both in SHIP");
{
  const X = buildGame();
  hasKnob(X, "towReleaseLockout", { def: X.HIT_STUN_DURATION * 1000, min: 0, max: 5000, step: 100 }, A);
  hasKnob(X, "towReleaseSpeed", { def: 120, min: 20, max: 300, step: 10 }, A);
  const row = X.DEBUG_ENTRIES.find(e => e.id === "towReleaseLockout");
  assert(typeof row.toNative === "function", "A: towReleaseLockout carries the ms->s toNative idiom");
  eq(row.toNative(1000), 1, "A: ...1000ms -> 1s");
  eq(X.DEBUG.towReleaseLockout, X.HIT_STUN_DURATION, "A: native DEBUG.towReleaseLockout seeds from HIT_STUN_DURATION");
  eq(X.DEBUG.towReleaseSpeed, 120, "A: native DEBUG.towReleaseSpeed seeds at 120");
}

// ================= (B) directed release: magnitude and direction =================
console.log("(B) every released node leaves radially away from the ship at exactly DEBUG.towReleaseSpeed");
{
  const X = buildGame(); X.startGame();
  const g = quiet(X);
  X.DEBUG.towReleaseSpeed = 77;               // a value distinct from fromNode's own rand(20,60) range
  const N = 6;
  layChain(X, N);
  const positions = g.chain.map(n => ({ x: n.x, y: n.y }));
  X.damageShip(13, g.ship.x + 40, g.ship.y, "debris3");

  eq(g.chain.length, 0, "B: (setup) the whole tow released");
  const released = fromTow(X);
  eq(released.length, N, "B: (setup) all N pieces came back as free Debris");
  for (let i = 0; i < released.length; i++) {
    const p = released[i], pos = positions[i];
    const speed = Math.hypot(p.vx, p.vy);
    close(speed, 77, `B: piece ${i} leaves at exactly DEBUG.towReleaseSpeed (got ${speed})`, 1e-6);
    const [ex, ey] = X.shortDelta(g.ship.x, g.ship.y, pos.x, pos.y);   // ship -> piece = away, wrap-aware
    const ed = Math.hypot(ex, ey);
    close(p.vx, (ex / ed) * 77, `B: piece ${i} vx points away from the ship`, 1e-6);
    close(p.vy, (ey / ed) * 77, `B: piece ${i} vy points away from the ship`, 1e-6);
  }
}

// ================= (C) the lockout: armed at the same instant, and only on a real release =========
console.log("(C) game.towLockoutT arms to DEBUG.towReleaseLockout exactly when the tow releases, and not otherwise");
{
  const X = buildGame(); X.startGame();
  const g = quiet(X);
  X.DEBUG.towReleaseLockout = 0.42;
  layChain(X, 4);
  eq(g.towLockoutT, 0, "C: (setup) no lockout running before the hit");
  X.damageShip(13, g.ship.x + 40, g.ship.y, "hunter2");
  eq(g.towLockoutT, 0.42, "C: the lockout arms to DEBUG.towReleaseLockout on a real release");

  // Empty-chain hit: a genuine no-op (P5's own guard) — no release, so no lockout either.
  const Y = buildGame(); Y.startGame();
  const gy = quiet(Y);
  Y.DEBUG.towReleaseLockout = 0.42;
  gy.chain.length = 0;
  const applied = Y.damageShip(13, gy.ship.x + 40, gy.ship.y, "hunter2");
  eq(applied, true, "C: (setup) an empty-handed hit still deals real HP");
  eq(gy.towLockoutT, 0, "C: ...but arms NO lockout — nothing was released");
}

// ================= (D) the capture gate: shut while the lockout runs, open the instant it expires ==
console.log("(D) a piece parked on the hull is refused while the lockout runs, hooked the frame it expires");
{
  const X = buildGame(); X.startGame();
  const g = quiet(X);
  X.DEBUG.towReleaseLockout = 3 * DT;    // a few frames, so there's room to observe "still locked out"
  layChain(X, 2);
  X.damageShip(13, g.ship.x + 40, g.ship.y, "debris1");
  close(g.towLockoutT, 3 * DT, "D: (setup) the lockout armed for a few frames", 1e-9);
  g.chain.length = 0; g.garbage.length = 0;   // isolate: only the parked piece below is on the field
  g.ship.vx = 0; g.ship.vy = 0;                // the hit's own knockback is not what this section measures

  const parked = inertPiece(X, 10, 0);        // inside GARBAGE_PICKUP (18px), stationary
  X.update(DT);
  assert(!parked.dead, "D: frame 1 (locked out) — the parked piece is NOT hooked");
  eq(g.chain.length, 0, "D: ...chain stays empty");
  X.update(DT);
  assert(!parked.dead, "D: frame 2 (still locked out) — still not hooked");

  // Drive frames until the countdown clears (Math.max(0, t - dt) does not always land on an exact
  // zero — same float reality DEBUG.magnetHoldT's own countdown has), and check the hook lands on
  // the VERY SAME frame the gate opens, never a frame late.
  let frames = 0;
  while (g.towLockoutT > 0 && frames < 10) { X.update(DT); frames++; }
  assert(frames > 0 && frames < 10, "D: (setup) the countdown actually reached zero within a few frames");
  assert(parked.dead, "D: ...and the SAME frame the countdown clears also hooks the parked piece");
  eq(g.chain.length, 1, "D: ...onto the chain, normally");
}

// ================= (E) the magnet: suppressed while the lockout runs, pulling once it expires ======
console.log("(E) `pulling` is suppressed by the lockout — a piece inside MAGNET_RANGE does not move until it expires");
{
  const X = buildGame(); X.startGame();
  const g = quiet(X);
  X.DEBUG.towReleaseLockout = 2 * DT;
  layChain(X, 2);
  X.damageShip(13, g.ship.x + 40, g.ship.y, "debris1");
  g.chain.length = 0; g.garbage.length = 0;
  g.ship.vx = 0; g.ship.vy = 0;                // the hit's own knockback is not what this section measures
  g.powerBudget.magnet = 50;                  // powerActive("magnet") is true
  assert(X.powerActive("magnet"), "E: (setup) the magnet is active");

  const far = inertPiece(X, 200, 0);          // inside MAGNET_RANGE (380), outside every pickup circle
  X.update(DT);
  eq(far.vx, 0, "E: frame 1 (locked out) — no pull (vx)");
  eq(far.vy, 0, "E: frame 1 (locked out) — no pull (vy)");
  X.update(DT);                               // the boundary frame: countdown reaches 0 THIS frame
  eq(g.towLockoutT, 0, "E: (setup) the lockout has fully counted down");
  assert(far.vx !== 0 || far.vy !== 0, "E: ...and the SAME frame the magnet pulls again");
  // Budget is unspent by the suppression itself — only a real hook spends it (CS025 P1's own rule).
  assert(g.powerBudget.magnet > 0, "E: the magnet budget was never spent by suppression alone");
}

// ================= (F) the auto-shield save arms NO lockout and keeps the cargo =====================
console.log("(F) an auto-shield save is NOT gated on ship.invuln — same field, opposite outcome from a real hit");
{
  const N = 5;
  const X = buildGame(); X.startGame();
  const g = quiet(X);
  layChain(X, N);
  X.settings.autoShield = true; g.ship.hp = X.LOW_HP_THRESHOLD; g.ship.energy = 1;
  const applied = X.damageShip(13, g.ship.x + 40, g.ship.y, "hunter3");

  assert(g.ship.shieldOn === true, "F: (setup) the auto-shield save branch really fired");
  assert(g.ship.invuln > 0, "F: (setup) ...and it DID set ship.invuln, same field a real hit sets");
  eq(applied, false, "F: 0 HP dealt");
  eq(g.chain.length, N, "F: the tow is KEPT, all N nodes");
  eq(g.towLockoutT, 0, "F: ⛔ and NO lockout was armed — a lockout here would blackout pickup after a save that kept the cargo");
}

// ================= (G) breakChain() is untouched: random scatter, no lockout ========================
console.log("(G) breakChain()'s sever path still scatters RANDOMLY and arms no lockout — this phase's mechanisms are damageShip-only");
{
  const X = buildGame(); X.startGame();
  const g = quiet(X);
  X.DEBUG.towReleaseSpeed = 250;               // well outside fromNode's rand(20,60) range
  X.DEBUG.towReleaseLockout = 0.9;
  g.powerBudget.guard = 0;
  layChain(X, 6);
  X.breakChain(2);

  eq(g.chain.length, 2, "G: (setup) a partial sever, node 2 onward cut loose");
  const released = fromTow(X);
  // breakChain(2) truncates chain.length to 2 and releases everything AFTER index 2 (nodes 3, 4, 5);
  // node 2 itself is the impact and is consumed, not released.
  eq(released.length, 3, "G: (setup) 3 pieces released (nodes 3..5; node 2 is the impact, not released)");
  for (const p of released) {
    const speed = Math.hypot(p.vx, p.vy);
    assert(speed >= 19.9 && speed <= 60.1, `G: ⛔ breakChain's release is still fromNode's rand(20,60), not towReleaseSpeed (got ${speed})`);
  }
  eq(g.towLockoutT, 0, "G: ⛔ breakChain() arms NO pickup lockout — that mechanism lives at damageShip's call site only");
}

// ================= (H) source pins: scatterChain() and Garbage.fromNode() are byte-unchanged ========
console.log("(H) scatterChain() and Garbage.fromNode() are byte-identical to their pre-P7.1 shape");
{
  const fn = methodBodyOf(stripped, "static fromNode(n) {");
  const EXPECT_FN =
    "static fromNode(n) {\n" +
    "    const a = rand(0, TAU);\n" +
    "    return new Garbage(n.x, n.y,\n" +
    "      Math.cos(a) * rand(20, 60), Math.sin(a) * rand(20, 60), n.mass);";
  eq(fn, EXPECT_FN, "H: ⛔ Garbage.fromNode() is byte-unchanged");

  const sc = bodyOf(stripped, "function scatterChain() {");
  const EXPECT_SC =
    "function scatterChain() {\n" +
    "  for (const n of game.chain) game.garbage.push(Garbage.fromNode(n));\n" +
    "  game.chain.length = 0;\n" +
    "  game.deliveryCount = 0;\n" +
    "  releaseDeliveryTicker();";
  eq(sc, EXPECT_SC, "H: ⛔ scatterChain() is byte-unchanged");

  // And structurally: the release loop sits in damageShip(), reusing scatterChain() unchanged —
  // never a second copy of either function, never the release folded into them.
  const dmg = bodyOf(stripped, "function damageShip(amount, srcX, srcY, srcTag) {");
  eq(dmg.split("scatterChain()").length - 1, 1, "H: damageShip calls scatterChain() exactly once");
  const iSnap = dmg.indexOf("game.garbage.length");
  const iScatter = dmg.indexOf("scatterChain();");
  const iLoop = dmg.indexOf("DEBUG.towReleaseSpeed");
  const iLockout = dmg.indexOf("game.towLockoutT = DEBUG.towReleaseLockout;");
  assert(iSnap > 0 && iScatter > iSnap && iLoop > iScatter && iLockout > iLoop,
    "H: the snapshot precedes scatterChain(), which precedes the push loop, which precedes the lockout arm");
}

// ================= (I) game.towLockoutT: both-places rule, cleared by resetRun() ====================
console.log("(I) game.towLockoutT is declared in both the game literal and resetRun(), and resetRun() clears it");
{
  eq((stripped.match(/towLockoutT: 0,/g) || []).length, 1, "I: the game literal declares towLockoutT: 0 exactly once");
  eq((stripped.match(/game\.towLockoutT = 0;/g) || []).length, 1, "I: resetRun() clears it exactly once");

  const X = buildGame(); X.startGame();
  const g = quiet(X);
  layChain(X, 3);
  X.damageShip(13, g.ship.x + 40, g.ship.y, "debris1");
  assert(g.towLockoutT > 0, "I: (setup) a lockout is live");
  X.startGame();   // a fresh run, through resetRun()
  eq(X.game.towLockoutT, 0, "I: ...and a fresh run starts with no lockout carried over");
}

// ================= (J) `pulling` and the capture gate both read the suppressible field, structurally =
console.log("(J) source pins: `pulling` and the capture `if` both gate on game.towLockoutT <= 0");
{
  assert(/const pulling = magnetPulling\(\) && !inRing && game\.towLockoutT <= 0;/.test(stripped),
    "J: `pulling` rides the lockout, trailing the existing !inRing suppression");
  assert(/if \(!inRing && game\.chain\.length < game\.cargoMax && inCapture && game\.towLockoutT <= 0\) \{/.test(stripped),
    "J: the capture gate's hook condition is shut by the lockout too");
  // ⛔ Never the raw `magnet` name (CS025 P1's split, extended here rather than relaxed).
  assert(!/magnet && game\.towLockoutT/.test(stripped) && !/game\.towLockoutT.*&&\s*magnet\b/.test(stripped),
    "J: ⛔ the lockout is never composed with the raw `magnet` predicate");
}

A.report();
