// Headless test for CS035 P5 — Hunter volatility, the damage sources (PLANNED-FEATURES-CS035.md §4.4).
//
//   node scratchpad/test-cs035-p5.js
//
// This phase owns three NEW damage sources for a VOLATILE large Hunter only: Hunter<->Hunter mutual
// contact, a hostile bullet, and a saucer body. All three call destroyHunter(h, false) — no score, no
// achievement counters, but the 3-way split still runs. Non-volatile larges, mediums and smalls are
// unaffected by all three. Player bullets are unchanged (full credit, any tier, any age).
//
// Traps worth knowing: the hazards-vs-ship pass already mutually kills ANY Hunter (any tier) that
// touches the ship, so every scenario keeps its bodies far from the ship to isolate the new arms; the
// hostile-bullet-vs-chain block is guarded on !game.levelEndSafe but the new hunter arm is a SIBLING
// and must NOT inherit that guard, so one scenario tests it fires with levelEndSafe true; and
// game.debris.length === 0 arms a large core's "last stand" steer-toward-ship drift in its OWN
// update(), which would move a large off its staged overlap before collisions run — quiet() keeps one
// inert sentinel debris object far away so that branch never triggers, same idiom as test-cs035-p4.js.

"use strict";
const { mkAssert, buildGame, worldDims } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

const DT = 1 / 60;

// A point well clear of the ship's staged (100, 100) parking spot. Read LIVE off the build via
// worldDims() — level 1 runs in the small early-level world (1920x1080), not the 2560x1440 default,
// and a literal FAR.x past the live width wraps clean around, teleporting a "stationary" body.
function farPoint(X) {
  const [w, h] = worldDims(X);
  return { x: Math.floor(w / 2) + 200, y: Math.floor(h / 2) };
}

function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null; g.levelEndSafe = false;
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.chain.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.particles.length = 0;
  g.saucerTimer = 1e6; g.healthTimer = 1e6;
  g.ship.x = 100; g.ship.y = 100; g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false;
  g.ship.invuln = 0; g.ship.shieldOn = false;
  // Non-empty so a large core's "last stand" steer-toward-ship branch never arms (see header trap).
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  return g;
}
function hunterAt(X, x, y, { size = 3, volatile = true } = {}) {
  const h = new X.HunterSatellite(x, y, size);
  h.vx = 0; h.vy = 0;
  h.age = volatile ? X.DEBUG.hunterVolatileAge : 0;
  return h;
}
function saucerAt(X, x, y, small = false) {
  const s = new X.Saucer(small);
  s.x = x; s.y = y; s.vx = 0; s.vy = 0; s.fireTimer = 1e6; s.zigTimer = 1e6; s.travel = 0;
  return s;
}
function credit(X) {
  const g = X.game;
  return {
    score: g.score, lineage: g.stats.hunterLineageKills, large: g.stats.largeHunterKills,
    lifetime: X.Achievements.lifetime.hunterKills,
  };
}

// ================= (A) Hunter vs Hunter: both volatile larges die, 3-way split each =================
(function sectionA() {
  console.log("(A) two overlapping volatile larges both die in one update(), 3 mediums each");
  const X = buildGame(); X.startGame();
  const FAR = farPoint(X);
  const g = quiet(X);
  const a = hunterAt(X, FAR.x, FAR.y);
  const b = hunterAt(X, FAR.x, FAR.y);
  assert(a.volatile() && b.volatile(), "A: (setup) both are volatile larges");
  g.hunters.push(a, b);
  const before = credit(X);
  X.update(DT);
  assert(a.dead, "A: ⛔ the first large is dead");
  assert(b.dead, "A: ⛔ the second large is dead");
  const meds = g.hunters.filter(h => !h.dead && h.size === 2);
  eq(meds.length, 6, "A: each large split 3-way — 6 mediums total from the pair");
  eq(g.score, before.score, "A: ⛔ no score for a mutual Hunter-vs-Hunter kill");
  eq(g.stats.hunterLineageKills, before.lineage, "A: ⛔ no lineage counter either");
  eq(g.stats.largeHunterKills, before.large, "A: ⛔ nor the large-kill counter");
  eq(X.Achievements.lifetime.hunterKills, before.lifetime, "A: ⛔ nor the lifetime achievement counter");
})();

// ================= (B) two NON-volatile larges overlapping: both survive =================
(function sectionB() {
  console.log("(B) two overlapping NON-volatile larges do nothing to each other");
  const X = buildGame(); X.startGame();
  const FAR = farPoint(X);
  const g = quiet(X);
  const a = hunterAt(X, FAR.x, FAR.y, { volatile: false });
  const b = hunterAt(X, FAR.x, FAR.y, { volatile: false });
  assert(!a.volatile() && !b.volatile(), "B: (setup) neither is volatile");
  g.hunters.push(a, b);
  X.update(DT);
  assert(!a.dead, "B: ⛔ the first large survives");
  assert(!b.dead, "B: ⛔ the second large survives");
  eq(g.hunters.filter(h => !h.dead).length, 2, "B: both still present, nothing split");
})();

// ================= (C) a volatile large overlapping a medium: neither dies =================
(function sectionC() {
  console.log("(C) a volatile large touching a medium does nothing to either — no bounce, no damage");
  const X = buildGame(); X.startGame();
  const FAR = farPoint(X);
  const g = quiet(X);
  const large = hunterAt(X, FAR.x, FAR.y, { volatile: true });
  const med = hunterAt(X, FAR.x, FAR.y, { size: 2 });
  med.vx = 0; med.vy = 0; med.scatter = 1e6; // hold still — homers otherwise re-aim toward the ship
  g.hunters.push(large, med);
  const lx = large.x, ly = large.y;
  X.update(DT);
  assert(!large.dead, "C: ⛔ the volatile large survives");
  assert(!med.dead, "C: ⛔ the medium survives");
  eq(large.x, lx, "C: no bounce displacement from the pair-walk itself this frame (x)");
  eq(large.y, ly, "C: ...(y)");
})();

// ================= (D) hostile bullet vs a volatile large: kills both; non-volatile: neither =================
(function sectionD() {
  console.log("(D) a hostile bullet kills a volatile large and itself; a non-volatile large stops nothing");
  {
    const X = buildGame(); X.startGame();
    const FAR = farPoint(X);
    const g = quiet(X);
    const h = hunterAt(X, FAR.x, FAR.y);
    const b = new X.Bullet(FAR.x, FAR.y, 0, 0, true);
    g.hunters.push(h); g.bullets.push(b);
    const before = credit(X);
    X.update(DT);
    assert(h.dead, "D: ⛔ the volatile large is dead");
    assert(b.dead, "D: ⛔ the bullet died on contact, same as against the ship");
    eq(g.score, before.score, "D: ⛔ no score for a UFO-shot kill");
    eq(g.stats.hunterLineageKills, before.lineage, "D: ⛔ no lineage counter");
    eq(X.Achievements.lifetime.hunterKills, before.lifetime, "D: ⛔ no lifetime achievement counter");
  }
  {
    const X = buildGame(); X.startGame();
    const FAR = farPoint(X);
    const g = quiet(X);
    const h = hunterAt(X, FAR.x, FAR.y, { volatile: false });
    const b = new X.Bullet(FAR.x, FAR.y, 0, 0, true);
    g.hunters.push(h); g.bullets.push(b);
    X.update(DT);
    assert(!h.dead, "D: ⛔ a non-volatile large ignores the hostile bullet");
    assert(!b.dead, "D: ...and the bullet is not consumed — it flies through");
  }
})();

// ================= (E) the hostile-bullet arm is NOT guarded by game.levelEndSafe =================
(function sectionE() {
  console.log("(E) a hostile bullet still kills a volatile large while game.levelEndSafe is true");
  const X = buildGame(); X.startGame();
  const FAR = farPoint(X);
  const g = quiet(X);
  g.levelEndSafe = true;
  const h = hunterAt(X, FAR.x, FAR.y);
  const b = new X.Bullet(FAR.x, FAR.y, 0, 0, true);
  g.hunters.push(h); g.bullets.push(b);
  X.update(DT);
  assert(h.dead, "E: ⛔ the hunter arm is a SIBLING of the guarded chain block, not covered by its guard");
  assert(b.dead, "E: ...and the bullet died too");
})();

// ================= (F) a saucer body flown into a volatile large: kills both =================
(function sectionF() {
  console.log("(F) a saucer ramming a volatile large destroys both, same 'no score for either' shape");
  const X = buildGame(); X.startGame();
  const FAR = farPoint(X);
  const g = quiet(X);
  const h = hunterAt(X, FAR.x, FAR.y);
  const s = saucerAt(X, FAR.x, FAR.y, false);
  g.hunters.push(h); g.saucers.push(s);
  const before = credit(X);
  X.update(DT);
  assert(h.dead, "F: ⛔ the volatile large is dead");
  assert(s.dead, "F: ⛔ the saucer is dead too — unlike the debris arm, neither survives");
  eq(g.score, before.score, "F: ⛔ no score for either side");
  eq(g.stats.hunterLineageKills, before.lineage, "F: ⛔ no lineage counter");
  eq(X.Achievements.lifetime.hunterKills, before.lifetime, "F: ⛔ no lifetime achievement counter");

  // Non-vacuity: a saucer flown into a NON-volatile large does nothing new (the debris arm is untouched).
  const Y = buildGame(); Y.startGame();
  const FARY = farPoint(Y);
  const g2 = quiet(Y);
  const h2 = hunterAt(Y, FARY.x, FARY.y, { volatile: false });
  const s2 = saucerAt(Y, FARY.x, FARY.y, false);
  g2.hunters.push(h2); g2.saucers.push(s2);
  Y.update(DT);
  assert(!h2.dead, "F: (non-vacuity) a non-volatile large ignores the saucer");
  assert(!s2.dead, "F: ...and the saucer survives too");
})();

// ================= (G) regression: a PLAYER bullet on a non-volatile large is unchanged =================
(function sectionG() {
  console.log("(G) ⛔ a player bullet still kills any Hunter, any tier, any age, full score credit");
  const X = buildGame(); X.startGame();
  const FAR = farPoint(X);
  const g = quiet(X);
  const h = hunterAt(X, FAR.x, FAR.y, { volatile: false });
  const b = new X.Bullet(FAR.x, FAR.y, 0, 0, false);
  g.hunters.push(h); g.bullets.push(b);
  const before = credit(X);
  X.update(DT);
  assert(h.dead, "G: the non-volatile large is dead");
  assert(b.dead, "G: the bullet is consumed");
  eq(g.score, before.score + X.HUNTER_SCORE[3], "G: ⛔ full score credited, the unchanged player-bullet path");
  eq(g.stats.hunterLineageKills, before.lineage + 1, "G: ...and the lineage counter moved");
  eq(g.stats.largeHunterKills, before.large + 1, "G: ...and the large-kill counter moved");
  eq(X.Achievements.lifetime.hunterKills, before.lifetime + 1, "G: ...and the lifetime achievement counter moved");
  eq(g.hunters.filter(hh => !hh.dead && hh.size === 2).length, 3, "G: the split still runs 3-way");
})();

A.report();
