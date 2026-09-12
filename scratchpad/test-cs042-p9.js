// scratchpad/test-cs042-p9.js — CS042 P9: the scoop loses at 2 hits, and a banked health charge can
// spend itself sparing the scoop instead of healing.
//
//   node scratchpad/test-cs042-p9.js
//
// §A the rate: SCOOP_HITS_PER_LEVEL 5 -> 2, measured against the parent, with the knob's MEANING
//    unchanged — a flat hits-per-level count, no table, no curve, same bounds.
// §B ⛔ THE ONE ASSERTION NOTHING ELSE IN THE SUITE MAKES: breakChain(0) leaves BOTH game.scoopLevel
//    and game.scoopHits untouched while damageShip() moves them. Two events, two paths, and the
//    separation IS FORK-S1's resolution — a phase that "unified" them would pass everything else.
// §C two hits cost a level; one does not.
// §D the reserve's three rows, driven through the real damageShip(): heal below the gate, spare above
//    it, heal at scoopLevel 0, ordinary hit on an empty bank, never both, one charge per event, and
//    never a rescue from a lethal hit.
// §E the knob's two ends ARE the design space: 1.0 reproduces the pre-phase charge, 0.0 always spares.
// §F ⛔ the comment's own load-bearing claim, MEASURED not asserted: the hull is read after the damage
//    lands, so a literal "is the hull full" rule is dead code. The counterfactual is built and run.
// §G the tell: "SCOOP SAVED" mirrors "SCOOP -1"; bankspend() rings either way; a spare is silent
//    otherwise (no scooploss, no expire_scoop).
// §H standing traps: exactly one registry row, no lever, breakChain/scatterChain/the srcTag switch
//    byte-identical to the parent, 0.70 shared with P6's milestone gate, the reversed comment kept
//    rather than deleted, and the phase's own file scope pinned against its literal parent SHA.

"use strict";
const { buildGame, mkAssert, scriptSource, execSource } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope, SKIP_TAG } = require("./_phase-ref.js");

// ⛔ LITERAL, never HEAD (CLAUDE.md, phase-local pins). CS042 P8's commit — this phase's parent.
const PARENT_SHA = "fd1ca2674e60da85780b8471946eddb7c0b17f99";
const SUBJECT = "cs042 p9:";

const A = mkAssert();
const { assert, eq, close, skip, report } = A;

const X = buildGame();
const src = scriptSource();
const bare = execSource(src);           // comment-free TEXT, so a tombstone can't read as live code

const parentSrc = parentSource(PARENT_SHA);
const P = parentSrc ? buildGame({ source: parentSrc }) : null;

const TOW_MASS = 1;

// A quiet live field: nothing spawns, nothing else can hit the ship, auto-shield off (it returns
// before the scoop block entirely, which would make every assertion below pass vacuously).
function quiet(G, opts = {}) {
  const g = G.game;
  G.startGame();
  g.state = "playing"; g.paused = false; g.celebration = null;  // CS043 P1: no game.levelDone to clear
  g.levelEndSafe = false;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0; g.chain.length = 0;
  g.particles.length = 0;
  g.saucerTimer = 1e6; g.hunterTimer = 1e6; g.healthTimer = 1e6;
  const [w, h] = G.liveDims();
  g.ship.x = w / 2; g.ship.y = h / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.shieldOn = false; g.ship.invuln = 0;
  g.ship.hp = G.SHIP_MAX_HP; g.ship.energy = 1;
  G.settings.autoShield = false;
  g.deliveryCount = 0;
  g.scoopLevel = opts.scoopLevel === undefined ? 0 : opts.scoopLevel;
  g.scoopHits = 0;
  g.healthBank = opts.bank === undefined ? 0 : opts.bank;
  return g;
}
// One real, non-lethal, unshielded hit. The i-frame the previous hit set is cleared first, or
// damageShip() early-returns and every assertion after it passes for the wrong reason.
function hit(G, amount = 10) {
  const s = G.game.ship;
  s.invuln = 0;
  return G.damageShip(amount, s.x + 100, s.y, "hunter3");
}
// Set the hull so that ONE hit of `amount` lands it exactly at `frac` of max.
function hullAfter(G, frac, amount) {
  G.game.ship.hp = G.SHIP_MAX_HP * frac + amount;
  return G.game.ship.hp;
}
function layChain(G, n, far = 600) {
  const g = G.game;
  g.chain.length = 0;
  for (let i = 0; i < n; i++) {
    const x = g.ship.x + far + i * 12, y = g.ship.y + far;
    g.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: TOW_MASS });
  }
  return g.chain;
}
const floatTexts = G => G.game.floaters.map(f => f.text);
function spySay(G) {
  const log = [];
  const real = G.VoiceSys.say.bind(G.VoiceSys);
  G.VoiceSys.say = ev => { log.push(ev); return real(ev); };
  return log;
}
function spy(obj, name) {
  const calls = { n: 0 };
  const real = obj[name].bind(obj);
  obj[name] = function (...args) { calls.n++; return real(...args); };
  return calls;
}
// The one body §H compares against the parent, by signature rather than by line number.
function fnBody(source, sig) {
  const at = source.indexOf(sig);
  if (at < 0) return "";
  let i = source.indexOf("{", at), depth = 0;
  for (let j = i; j < source.length; j++) {
    if (source[j] === "{") depth++;
    else if (source[j] === "}") { depth--; if (depth === 0) return source.slice(at, j + 1); }
  }
  return "";
}

// =====================================================================================
console.log("(A) the rate — SCOOP_HITS_PER_LEVEL 5 -> 2, and only the number moved");
// =====================================================================================
{
  eq(X.SCOOP_HITS_PER_LEVEL, 2, "A: SCOOP_HITS_PER_LEVEL is 2");
  eq(X.DEBUG.scoopHitsPerLevel, X.SCOOP_HITS_PER_LEVEL,
    "A: DEBUG.scoopHitsPerLevel seeds from the const — one source of truth, the standing idiom");
  const row = X.DEBUG_ENTRIES.find(e => e.id === "scoopHitsPerLevel");
  assert(!!row, "A: the knob still exists");
  eq(row.def, X.SCOOP_HITS_PER_LEVEL, "A: ...its def derives from the const");
  // ⛔ THE KNOB'S MEANING IS UNCHANGED — spec §4.4 says so explicitly. A flat count, not a table and
  // not a curve, and its own bounds are exactly where P5 of CS015 put them.
  eq(typeof X.SCOOP_HITS_PER_LEVEL, "number", "A: ⛔ the rate is a NUMBER, not a per-level table");
  assert(!Array.isArray(X.SCOOP_HITS_PER_LEVEL), "A: ...and not an array");
  eq(row.min, 1, "A: min unmoved at 1");
  eq(row.max, 20, "A: max unmoved at 20");
  eq(row.step, 1, "A: step unmoved at 1");
  assert(!row.toNative, "A: still no toNative — display is native");
  assert(!X.LEVERS.some(l => l.id === "scoopHitsPerLevel"), "A: ...and it did not become a lever");

  if (!P) {
    skip("A: the parent build is unreachable — the 5 -> 2 move cannot be measured");
  } else {
    eq(P.SCOOP_HITS_PER_LEVEL, 5, "A: (measured) the parent shipped 5");
    eq(P.DEBUG.scoopHitsPerLevel, 5, "A: ...and its knob read 5 too");
    const pRow = P.DEBUG_ENTRIES.find(e => e.id === "scoopHitsPerLevel");
    eq(pRow.min, row.min, "A: the bounds did not move with the def — min");
    eq(pRow.max, row.max, "A: ...max");
    eq(pRow.step, row.step, "A: ...step");
    console.log(`      rate: parent ${P.SCOOP_HITS_PER_LEVEL} -> live ${X.SCOOP_HITS_PER_LEVEL}; ` +
      `a level-${X.SCOOP_MAX_LEVEL} scoop survives ${P.SCOOP_HITS_PER_LEVEL * X.SCOOP_MAX_LEVEL} hits ` +
      `-> ${X.SCOOP_HITS_PER_LEVEL * X.SCOOP_MAX_LEVEL}`);
  }
}

// =====================================================================================
console.log("(B) ⛔ THE SEPARATION — breakChain(0) never touches the scoop; damageShip() always does");
// =====================================================================================
// FORK-S1's resolution is that the build is ALREADY right, and nothing else in the suite protects it.
// Losing the whole payload to a hazard hitting a chain NODE is not a hit on the ship, so it must not
// erode the scoop; a hit on the SHIP loses the payload AND erodes the scoop. Both halves are driven
// here, from identical starting state, so a phase that "unified" the two paths fails one or the other.
{
  const beforeLevel = 3;
  // -- the chain-node hit: breakChain(0), the total-loss case, which is the one that LOOKS like a
  //    ship hit because the player ends up with nothing in tow either way.
  {
    const g = quiet(X, { scoopLevel: beforeLevel });
    layChain(X, 8);
    g.powerBudget.guard = 0;                 // no intercept: the break must really sever
    eq(X.powerActive("guard"), false, "B: (setup) no chain guard, so the break really severs");
    const hpBefore = g.ship.hp;
    X.breakChain(0);
    eq(g.chain.length, 0, "B: (setup) breakChain(0) really cut the whole load loose");
    assert(g.garbage.length > 0, "B: (setup) ...and the payload became free Debris, so the call did work");
    eq(g.scoopLevel, beforeLevel, "B: ⛔ breakChain(0) leaves game.scoopLevel UNTOUCHED");
    eq(g.scoopHits, 0, "B: ⛔ ...and game.scoopHits UNTOUCHED — the tally does not even advance");
    eq(g.ship.hp, hpBefore, "B: ...and the hull is untouched too — a node was hit, not the ship");
  }
  // -- the same total loss reached the OTHER way: a hit on the ship. Same start, opposite outcome.
  {
    const g = quiet(X, { scoopLevel: beforeLevel });
    layChain(X, 8);
    const applied = hit(X, 10);
    eq(applied, true, "B: (setup) the ship hit really landed");
    eq(g.chain.length, 0, "B: (setup) ...and released the whole tow, the same visible outcome");
    eq(g.scoopLevel, beforeLevel, "B: one hit at a 2-hit rate does not yet cost a level");
    eq(g.scoopHits, 1, "B: ⛔ but damageShip() DID move game.scoopHits — that is the difference");
    hit(X, 10);
    eq(g.scoopLevel, beforeLevel - 1, "B: ⛔ ...and the second hit costs the level");
    eq(g.scoopHits, 0, "B: ⛔ ...resetting the tally");
  }
  // -- every partial break too: breakChain(i) for i > 0 is even more obviously not a ship hit.
  for (const i of [1, 2, 4, 7]) {
    const g = quiet(X, { scoopLevel: beforeLevel });
    layChain(X, 8);
    g.powerBudget.guard = 0;
    g.scoopHits = 1;                          // one hit already banked: a "unified" path would spend it
    X.breakChain(i);
    eq(g.chain.length, i, `B: (setup) breakChain(${i}) truncated to ${i}`);
    eq(g.scoopLevel, beforeLevel, `B: breakChain(${i}) leaves scoopLevel untouched`);
    eq(g.scoopHits, 1, `B: ...and scoopHits untouched at 1, mid-tally`);
  }
  // -- and the intercepted break, which returns before severing anything at all.
  {
    const g = quiet(X, { scoopLevel: beforeLevel });
    layChain(X, 8);
    g.powerBudget.guard = 1;
    eq(X.powerActive("guard"), true, "B: (setup) a guard charge is up");
    X.breakChain(0);
    eq(g.chain.length, 8, "B: (setup) the guard absorbed it — nothing severed");
    eq(g.scoopLevel, beforeLevel, "B: an absorbed break leaves scoopLevel untouched");
    eq(g.scoopHits, 0, "B: ...and scoopHits untouched");
  }
  // -- ship death scatters the whole load and the scoop is irrelevant, but it must not go NEGATIVE or
  //    throw on the way out either.
  {
    const g = quiet(X, { scoopLevel: 1 });
    layChain(X, 4);
    g.ship.hp = 5;
    g.scoopHits = X.DEBUG.scoopHitsPerLevel - 1;
    X.damageShip(500, g.ship.x + 100, g.ship.y, "hunter3");
    eq(g.ship.hp, 0, "B: (setup) the hit was lethal");
    eq(g.scoopLevel, 1, "B: a LETHAL hit never reaches the scoop block — killShip() returned first");
    eq(g.scoopHits, X.DEBUG.scoopHitsPerLevel - 1, "B: ...so the tally is where it was");
  }
}

// =====================================================================================
console.log("(C) two hits cost a level; one does not");
// =====================================================================================
{
  const g = quiet(X, { scoopLevel: X.SCOOP_MAX_LEVEL });
  eq(X.DEBUG.scoopHitsPerLevel, 2, "C: (setup) the live rate is 2");
  hit(X);
  eq(g.scoopLevel, X.SCOOP_MAX_LEVEL, "C: one hit -> no level lost");
  eq(g.scoopHits, 1, "C: ...tally at 1");
  hit(X);
  eq(g.scoopLevel, X.SCOOP_MAX_LEVEL - 1, "C: ⛔ two hits -> exactly one level lost");
  eq(g.scoopHits, 0, "C: ...tally reset, never carried");
  // The whole ladder, at the cap CS042 P8 raised: 2 x 7 = 14 hits to strip it, and no underflow after.
  // The hull is topped up between hits: this section measures the RATE, and a ladder that ran the
  // ship out of HP would stop for the wrong reason. The bank is empty, so no charge can spare a hit.
  eq(g.healthBank, 0, "C: (setup) the bank is empty, so nothing here can be spared");
  let hits = 2;
  while (g.scoopLevel > 0 && hits < 200) { g.ship.hp = X.SHIP_MAX_HP; hit(X); hits++; }
  eq(g.scoopLevel, 0, "C: the ladder strips to 0");
  eq(hits, X.DEBUG.scoopHitsPerLevel * X.SCOOP_MAX_LEVEL,
    `C: ...in exactly ${X.DEBUG.scoopHitsPerLevel * X.SCOOP_MAX_LEVEL} hits (rate x cap)`);
  hit(X); hit(X); hit(X);
  eq(g.scoopLevel, 0, "C: hits at level 0 are harmless — no underflow");
  eq(g.scoopHits, 0, "C: ...and do not accumulate (FORK-3 shape unchanged)");
  // FORK-3 still stands: a scoop PICKUP does not reset the tally.
  g.scoopLevel = 1; g.scoopHits = 0;
  hit(X);
  eq(g.scoopHits, 1, "C: (setup) mid-tally at 1");
  X.applyPowerup("scoop");
  eq(g.scoopLevel, 2, "C: (setup) ...and the pickup really granted a level");
  eq(g.scoopHits, 1, "C: ⛔ a scoop pickup does NOT reset the tally (FORK-3 stands)");
}

// =====================================================================================
console.log("(D) the reserve — one charge, one job, decided by the post-damage hull");
// =====================================================================================
{
  const PCT = X.DEBUG.bankSpareHullPct;
  eq(PCT, 0.70, "D: the gate ships at 0.70");

  // -- row 1: hull at or below the gate -> the charge HEALS, and the scoop takes the hit as ever.
  {
    const g = quiet(X, { scoopLevel: 3, bank: 1 });
    const rings = spy(X.AudioSys, "bankspend");
    hullAfter(X, 0.50, 40);
    hit(X, 40);
    eq(g.healthBank, 0, "D: a charge was spent");
    eq(g.ship.hp, X.SHIP_MAX_HP * 0.50 + X.POWERUP_HEALTH_AMOUNT, "D: ⛔ it HEALED, +POWERUP_HEALTH_AMOUNT");
    eq(g.scoopHits, 1, "D: ⛔ ...and the scoop took the hit — the tally advanced");
    eq(rings.n, 1, "D: bankspend() rang once");
    assert(!floatTexts(X).includes("SCOOP SAVED"), "D: ⛔ NEVER BOTH — no spare floater on the heal arm");
  }
  // -- row 1, all the way to a real level loss at the 2-hit rate.
  {
    const g = quiet(X, { scoopLevel: 3, bank: 2 });
    hullAfter(X, 0.50, 40); hit(X, 40);
    hullAfter(X, 0.40, 40); hit(X, 40);
    eq(g.healthBank, 0, "D: both charges spent on the hurt hull");
    eq(g.scoopLevel, 2, "D: ⛔ hull at 50% then 40% -> the charge heals and the scoop still drops a level");
  }
  // -- row 2: hull above the gate -> the charge SPARES, and nothing heals.
  {
    const g = quiet(X, { scoopLevel: 3, bank: 1 });
    const rings = spy(X.AudioSys, "bankspend");
    hullAfter(X, 0.90, 10);
    const target = X.SHIP_MAX_HP * 0.90;
    hit(X, 10);
    eq(g.healthBank, 0, "D: a charge was spent here too");
    eq(g.ship.hp, target, "D: ⛔ ...and it did NOT heal — the hull is exactly the post-damage hull");
    eq(g.scoopLevel, 3, "D: ⛔ the scoop is KEPT");
    eq(g.scoopHits, 0, "D: ⛔ ...and the tally did not advance either — the hit never touched it");
    eq(rings.n, 1, "D: bankspend() rang on the spare arm too");
    assert(floatTexts(X).includes("SCOOP SAVED"), "D: ...and the spare floater is the tell");
    assert(!floatTexts(X).includes("SCOOP -1"), "D: ⛔ NEVER BOTH — no loss floater on the spare arm");
  }
  // -- a spare on the hit that WOULD have cost a level, which is the case the player feels.
  {
    const g = quiet(X, { scoopLevel: 3, bank: 1 });
    g.scoopHits = X.DEBUG.scoopHitsPerLevel - 1;      // the next hit is the costly one
    hullAfter(X, 0.90, 10);
    hit(X, 10);
    eq(g.scoopLevel, 3, "D: ⛔ the charge bought off the very hit that would have dropped a level");
    eq(g.scoopHits, X.DEBUG.scoopHitsPerLevel - 1, "D: ...and the tally is exactly where it was");
  }
  // -- row 3: scoopLevel 0 -> there is nothing to spare, so the charge heals whatever the hull reads.
  for (const frac of [0.95, 0.90, 0.71, 0.50, 0.20]) {
    const g = quiet(X, { scoopLevel: 0, bank: 1 });
    hullAfter(X, frac, 10);
    hit(X, 10);
    eq(g.healthBank, 0, `D: at scoopLevel 0 and hull ${frac}, the charge is spent`);
    eq(g.ship.hp, Math.min(X.SHIP_MAX_HP, X.SHIP_MAX_HP * frac + X.POWERUP_HEALTH_AMOUNT),
      `D: ⛔ ...on HEALING — nothing to spare at level 0 (hull ${frac})`);
    assert(!floatTexts(X).includes("SCOOP SAVED"), `D: ...and no spare floater (hull ${frac})`);
  }
  // -- an empty bank: an ordinary hit, whatever the hull reads.
  for (const frac of [0.90, 0.50]) {
    const g = quiet(X, { scoopLevel: 3, bank: 0 });
    const rings = spy(X.AudioSys, "bankspend");
    hullAfter(X, frac, 10);
    const target = X.SHIP_MAX_HP * frac;
    hit(X, 10);
    eq(g.ship.hp, target, `D: with an empty bank the hit lands in full (hull ${frac})`);
    eq(g.scoopHits, 1, `D: ⛔ ...and the scoop erodes normally (hull ${frac})`);
    eq(rings.n, 0, `D: ...and nothing rang (hull ${frac})`);
  }
  // -- ONE charge per damage event (FLAG-CS040-b), on the spare arm as well as the heal arm.
  {
    const g = quiet(X, { scoopLevel: 3, bank: 2 });
    hullAfter(X, 0.90, 10);
    hit(X, 10);
    eq(g.healthBank, 1, "D: ⛔ ONE charge per damage event — the spare arm never drains the reserve");
    hullAfter(X, 0.90, 10);
    hit(X, 10);
    eq(g.healthBank, 0, "D: ...and the next event spends the next one");
  }
  // -- and still BELOW the `hp <= 0` exit: a lethal hit is never rescued and never spares.
  {
    const g = quiet(X, { scoopLevel: 3, bank: 2 });
    const rings = spy(X.AudioSys, "bankspend");
    g.ship.hp = 30;
    X.damageShip(200, g.ship.x + 100, g.ship.y, "hunter3");
    eq(g.ship.hp, 0, "D: a lethal hit still kills");
    eq(g.healthBank, 2, "D: ⛔ ...and the reserve is untouched — a bank is a repair, not an extra life");
    eq(rings.n, 0, "D: ...nothing rang");
    assert(!floatTexts(X).includes("SCOOP SAVED"), "D: ...and nothing was spared");
  }
  // -- shielded / i-framed / auto-shielded hits return before the bank AND before the scoop block.
  {
    const g = quiet(X, { scoopLevel: 3, bank: 1 });
    g.ship.shieldOn = true;
    eq(X.damageShip(40, g.ship.x + 100, g.ship.y, "hunter3"), false, "D: (setup) a shielded hit deals nothing");
    eq(g.healthBank, 1, "D: a shielded hit spends no charge");
    eq(g.scoopHits, 0, "D: ...and erodes no scoop");
    g.ship.shieldOn = false; g.ship.invuln = 1;
    eq(X.damageShip(40, g.ship.x + 100, g.ship.y, "hunter3"), false, "D: (setup) an i-framed hit deals nothing");
    eq(g.healthBank, 1, "D: an i-framed hit spends no charge either");
    eq(g.scoopHits, 0, "D: ...and erodes no scoop");
    g.ship.invuln = 0; g.ship.hp = X.LOW_HP_THRESHOLD; g.ship.energy = 1;
    X.settings.autoShield = true;
    eq(X.damageShip(40, g.ship.x + 100, g.ship.y, "hunter3"), false, "D: (setup) the auto-shield ate the hit");
    eq(g.healthBank, 1, "D: an auto-shielded hit spends no charge");
    eq(g.scoopHits, 0, "D: ...and erodes no scoop — all three return before both blocks");
    X.settings.autoShield = false;
  }
}

// =====================================================================================
console.log("(E) the knob's two ends ARE the design space — 1.0 is the phase's own A/B");
// =====================================================================================
{
  const { hasKnob } = require("./test-registry.js");
  hasKnob(X, "bankSpareHullPct", { def: 0.70, min: 0, max: 1, step: 0.05 }, { assert, eq });

  // -- 1.0: the hull is never ABOVE max, so the charge always heals and the scoop always erodes.
  //    That is CS040's rule exactly, and it is what makes this row a clean A/B for the whole change.
  {
    const G = buildGame();
    G.applyDebug("bankSpareHullPct", 1.0);
    eq(G.DEBUG.bankSpareHullPct, 1.0, "E: (setup) dialled to 1.0");
    for (const frac of [0.99, 0.90, 0.71, 0.50]) {
      const g = quiet(G, { scoopLevel: 3, bank: 1 });
      hullAfter(G, frac, 10);
      hit(G, 10);
      eq(g.ship.hp, Math.min(G.SHIP_MAX_HP, G.SHIP_MAX_HP * frac + G.POWERUP_HEALTH_AMOUNT),
        `E: ⛔ at 1.0 the charge HEALS at hull ${frac} — pre-phase behaviour`);
      eq(g.scoopHits, 1, `E: ⛔ ...and the scoop always takes the hit (hull ${frac})`);
      assert(!floatTexts(G).includes("SCOOP SAVED"), `E: ...no spare ever fires (hull ${frac})`);
    }
  }
  // -- 0.0: any surviving hull is above 0, so the charge always spares while a scoop exists.
  {
    const G = buildGame();
    G.applyDebug("bankSpareHullPct", 0.0);
    eq(G.DEBUG.bankSpareHullPct, 0.0, "E: (setup) dialled to 0.0");
    for (const frac of [0.99, 0.50, 0.05]) {
      const g = quiet(G, { scoopLevel: 3, bank: 1 });
      hullAfter(G, frac, 10);
      const target = G.SHIP_MAX_HP * frac;
      hit(G, 10);
      eq(g.ship.hp, target, `E: ⛔ at 0.0 the charge never heals (hull ${frac})`);
      eq(g.scoopHits, 0, `E: ⛔ ...it always spares while a scoop exists (hull ${frac})`);
    }
    // ...but level 0 is still "nothing to spare", at either end of the knob.
    const g = quiet(G, { scoopLevel: 0, bank: 1 });
    hullAfter(G, 0.50, 10);
    hit(G, 10);
    eq(g.ship.hp, G.SHIP_MAX_HP * 0.50 + G.POWERUP_HEALTH_AMOUNT,
      "E: ⛔ even at 0.0, scoopLevel 0 heals — the level-0 arm is not part of the threshold");
  }
  // -- the boundary itself: `>` not `>=`, so hull exactly AT the gate heals.
  {
    const G = buildGame();
    const pct = G.DEBUG.bankSpareHullPct;
    {
      const g = quiet(G, { scoopLevel: 3, bank: 1 });
      hullAfter(G, pct, 10);
      hit(G, 10);
      eq(g.scoopHits, 1, "E: ⛔ hull EXACTLY at the gate heals and the scoop erodes ('at or below', spec §4.5)");
      eq(g.ship.hp, G.SHIP_MAX_HP * pct + G.POWERUP_HEALTH_AMOUNT, "E: ...the heal landed");
    }
    {
      const g = quiet(G, { scoopLevel: 3, bank: 1 });
      G.game.ship.hp = G.SHIP_MAX_HP * pct + 10 + 0.5;   // a hair above the gate after the hit
      hit(G, 10);
      eq(g.scoopHits, 0, "E: ...and a hair above it spares");
    }
  }
}

// =====================================================================================
console.log("(F) ⛔ the comment's claim, MEASURED — a literal full-hull rule would be dead code");
// =====================================================================================
// The rule reads the hull AFTER the damage lands. §4.5 says a "only when the hull is full" rule would
// therefore never fire, and that this is the first thing a reader questions. It is not asserted here,
// it is BUILT: the shipped predicate is replaced by `s.hp >= SHIP_MAX_HP` and both builds are driven
// over the same grid. The shipped one spares; the counterfactual never does, at any hull, ever.
{
  const SHIPPED = "if (game.scoopLevel > 0 && s.hp > SHIP_MAX_HP * DEBUG.bankSpareHullPct) {";
  const DEAD    = "if (game.scoopLevel > 0 && s.hp >= SHIP_MAX_HP) {";
  eq((src.match(new RegExp(SHIPPED.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length, 1,
    "F: (setup) the shipped predicate appears exactly once, so the substitution is unambiguous");
  const M = buildGame({ source: src.replace(SHIPPED, DEAD) });

  const GRID = [0.999, 0.99, 0.95, 0.90, 0.80, 0.71, 0.70, 0.50, 0.20, 0.02];
  let shippedSpares = 0, deadSpares = 0;
  for (const frac of GRID) {
    for (const G of [X, M]) {
      const g = quiet(G, { scoopLevel: 3, bank: 1 });
      hullAfter(G, frac, 1);
      hit(G, 1);
      const spared = g.scoopHits === 0 && g.healthBank === 0;
      if (G === X) shippedSpares += spared ? 1 : 0; else deadSpares += spared ? 1 : 0;
    }
  }
  console.log(`      over ${GRID.length} post-damage hulls: shipped predicate spared ${shippedSpares}, ` +
              `"is the hull full" spared ${deadSpares}`);
  assert(shippedSpares > 0, "F: the shipped predicate really does spare over this grid");
  eq(deadSpares, 0,
    "F: ⛔ ...and the full-hull counterfactual spares ZERO times — dead code, exactly as the comment says");
  // And the reason, stated directly: the spend gate itself guarantees the hull is strictly below max.
  {
    const g = quiet(X, { scoopLevel: 3, bank: 1 });
    g.ship.hp = X.SHIP_MAX_HP;
    X.damageShip(0, g.ship.x + 100, g.ship.y, "hunter3");
    eq(g.healthBank, 1, "F: a 0-damage call burns no charge — `hp < SHIP_MAX_HP` is what forecloses it");
  }
}

// =====================================================================================
console.log("(G) the tell — SCOOP SAVED mirrors SCOOP -1, and a spare is otherwise silent");
// =====================================================================================
{
  // The loss arm's floater, for the shape the spare arm mirrors.
  const loss = (() => {
    const g = quiet(X, { scoopLevel: 3 });
    hit(X); hit(X);
    return g.floaters.find(f => f.text === "SCOOP -1");
  })();
  const haveLoss = assert(!!loss, "G: (setup) the loss arm still pushes SCOOP -1");

  const g = quiet(X, { scoopLevel: 3, bank: 1 });
  const lossSfx = spy(X.AudioSys, "scooploss");
  const bank = spy(X.AudioSys, "bankspend");
  const said = spySay(X);
  hullAfter(X, 0.90, 10);
  hit(X, 10);
  const saved = g.floaters.find(f => f.text === "SCOOP SAVED");
  // ⛔ The two finds are the section's own setup, and a missing floater must REPORT rather than throw —
  // report() deliberately does not exit, so a later section must still be able to run (_harness.js).
  if (assert(!!saved, "G: the spare arm pushes a SCOOP SAVED floater")) {
    eq(saved.color, X.POWERUP_COLOR.scoop, "G: ...in POWERUP_COLOR.scoop, the Scoop's own hue");
    if (haveLoss) {
      eq(saved.color, loss.color, "G: ...the same colour the loss floater uses — one object, two outcomes");
      eq(saved.y - g.ship.y, loss.y - g.ship.y, "G: ...at the same offset above the hull as SCOOP -1");
    }
  }
  eq(bank.n, 1, "G: AudioSys.bankspend() is the shared cue and rings on the spare");
  eq(lossSfx.n, 0, "G: ⛔ ...and AudioSys.scooploss() does NOT — nothing was lost");
  assert(!said.includes("expire_scoop"), "G: ⛔ ...and Dan does not report a scoop expiry either");
  // No new AudioSys method and no new voice event were invented for this.
  assert(!/scoopsaved|scoopSaved|scoop_saved/i.test(bare),
    "G: ⛔ no new sound or voice event was added — the spare reuses bankspend(), spec §4.5's own 'Tell'");
}

// =====================================================================================
console.log("(H) standing traps and the phase's own scope");
// =====================================================================================
{
  eq(X.BANK_SPARE_HULL_PCT, 0.70, "H: the const ships at 0.70");
  eq(X.BANK_SPARE_HULL_PCT, X.REPAIR_MILESTONE_HULL_PCT,
    "H: ⛔ ...which is P6's milestone hull gate, deliberately — the changeset has ONE definition of 'hurt'");
  eq(X.DEBUG.bankSpareHullPct, X.BANK_SPARE_HULL_PCT, "H: the knob's def derives from the const");

  // ⛔ THE COMMENT REVERSAL IS RECORDED, NOT DELETED. The v3.4 P3 sentence is still in the file, and
  // the changeset that reverses it is named beside it.
  assert(src.includes("That's the intent, not a bug to 'fix.'"),
    "H: ⛔ v3.4 P3's own words survive verbatim — the comment was REWRITTEN, never deleted");
  assert(/CS042 P9[\s\S]{0,900}That's the intent, not a bug to 'fix\.'/.test(src),
    "H: ...and CS042 P9 is named as the reversal in the same comment block");
  assert(!bare.includes("That's the intent, not a bug to 'fix.'"),
    "H: ...and it lives in a COMMENT, so nothing reads it as live code");

  if (!P) {
    skip("H: the parent build is unreachable — the no-trigger-change pins cannot be measured");
  } else {
    // ⛔ NO TRIGGER CHANGES. The two functions that own the other path are byte-identical.
    const bcNow = fnBody(src, "function breakChain("), bcOld = fnBody(parentSrc, "function breakChain(");
    assert(bcNow.length > 0 && bcOld.length > 0, "H: (setup) breakChain found in both builds");
    eq(bcNow, bcOld, "H: ⛔ breakChain() is BYTE-UNCHANGED — the sever path was already right (FORK-S1)");
    const scNow = fnBody(src, "function scatterChain("), scOld = fnBody(parentSrc, "function scatterChain(");
    eq(scNow, scOld, "H: ⛔ scatterChain() is BYTE-UNCHANGED too");
    // ⛔ NO srcTag TEST. The attribution switch already enumerates exactly the sources in scope.
    const sw = s => { const at = s.indexOf("switch (srcTag) {"); return at < 0 ? "" : s.slice(at, s.indexOf("}", s.indexOf('case "ufoShotSmall"')) + 1); };
    assert(sw(src).length > 0, "H: (setup) the srcTag switch was found");
    eq(sw(src), sw(parentSrc), "H: ⛔ the srcTag switch is BYTE-UNCHANGED — no new source test was added");
    assert(!/srcTag\s*===|SCOOP_SOURCES|scoopSources/.test(bare),
      "H: ...and nothing else compares srcTag either");

    // Exactly one registry row, and it is this phase's.
    // WIDENED BY CS042 P10 (the standing moving-pin maintenance): X is the LIVE build, and P10
    // legitimately appends its own two menu-repeat rows after P9 landed — named rather than
    // wildcarded, same idiom as every other repoint in the suite.
    const LATER_ROWS = ["menuRepeatDelay", "menuRepeatRate"];   // CS042 P10 (spec §5.2)
    const added = X.DEBUG_ENTRIES.map(e => e.id).filter(id => !P.DEBUG_ENTRIES.some(e => e.id === id));
    eq(added.filter(id => !LATER_ROWS.includes(id)).join(","), "bankSpareHullPct",
      "H: ⛔ exactly ONE registry row was added, and it is P9's");
    const removed = P.DEBUG_ENTRIES.map(e => e.id).filter(id => !X.DEBUG_ENTRIES.some(e => e.id === id));
    eq(removed.length, 0, "H: ...and none was retired");
    eq(X.DEBUG_ENTRIES.map(e => e.id).filter(id => P.DEBUG_ENTRIES.some(e => e.id === id)).join(","),
       P.DEBUG_ENTRIES.map(e => e.id).join(","),
       "H: ...and every pre-existing row keeps its place, in order (append-only within POWERUPS)");
    eq(JSON.stringify(X.LEVERS), JSON.stringify(P.LEVERS), "H: ⛔ no lever moved");
    // scoopHitsPerLevel is the ONE pre-existing knob whose live value moved, and it moved by design.
    const moved = P.DEBUG_ENTRIES.map(e => e.id).filter(id => X.DEBUG[id] !== P.DEBUG[id]);
    eq(moved.join(","), "scoopHitsPerLevel",
      "H: ⛔ exactly one pre-existing knob's value moved — §4.4's rate, and nothing else");
    // The Scoop's own geometry is P8's and is untouched here.
    eq(X.SCOOP_MAX_LEVEL, P.SCOOP_MAX_LEVEL, "H: the cap is unmoved — P8's, not P9's");
    eq(JSON.stringify(X.SCOOP_WIDTH), JSON.stringify(P.SCOOP_WIDTH), "H: ...and the mouth table too");
    eq(JSON.stringify(X.SCOOP_ORB_R), JSON.stringify(P.SCOOP_ORB_R), "H: ...and the orb table");
  }
  // Registry count lives in exactly one file (CLAUDE.md, Test rules) — read it, never restate it.
  {
    const { COUNTS } = require("./test-registry.js");
    eq(X.DEBUG_ENTRIES.length, COUNTS.registryEntries,
      "H: the registry total is test-registry.js's, the only file allowed to name it");
  }

  const own = ownCommits(PARENT_SHA, SUBJECT);
  if (own === null) {
    skip("H: git history is unavailable — the scope pin cannot be measured");
  } else if (own.length > 1) {
    assert(false, `H: AMBIGUOUS — ${own.length} commits share the subject "${SUBJECT}"`);
  } else {
    const provisional = own.length === 0;
    const changed = changedFiles(PARENT_SHA, provisional ? null : own[0]);
    if (changed === null) {
      skip("H: git could not list the changed files");
    } else {
      // ⛔ Pass the extra, never hardcode a file list (CLAUDE.md, phase-local pins). Spec §4.4 asks
      // this phase — not P11 — to note the loss rate's change in the telemetry guide's §7, so the
      // guide rides in this phase's own scope.
      const outside = outsideScope(changed, ["TELEMETRY-ANALYSIS-GUIDE.md"]);
      eq(outside.length, 0,
        `H: nothing outside scope changed${provisional ? " (PROVISIONAL — read from the working tree)" : ""}` +
        (outside.length ? " — " + outside.join(", ") : ""));
      assert(changed.includes("orbital-overhaul.html"), "H: the game file is in the diff");
      assert(changed.includes("scratchpad/test-registry.js"),
        "H: ...and test-registry.js, the one file that carries the registry count");
      assert(changed.includes("TELEMETRY-ANALYSIS-GUIDE.md"),
        "H: ...and the telemetry guide, whose §7 scoopHits trap spec §4.4 requires this phase to update");
    }
  }
}

report();
