// scratchpad/test-cs042-p8.js — CS042 P8: scoop levels 6-7, the flanking orbs, and the level-1 floor.
//
//   node scratchpad/test-cs042-p8.js
//
// §A THE TRAP. buildScoopSteps() divides by (N - 1). Raising SCOOP_MAX_LEVEL 5 -> 7 while N stayed the
//    cap would re-spread the mouth curve over seven steps and SILENTLY SHRINK levels 2-4. The check
//    that actually proves it did not: run the NEW builder with the PARENT's config and compare 1..5
//    against the parent build bit-for-bit, which isolates the cap raise from the deliberate floor raise.
//    The counterfactual is measured too, so the fix is shown to be load-bearing rather than incidental.
// §B the level-1 floor (minWidthMult 1.2 -> 2.6, minDepth 20 -> 34), measured as area against the parent.
// §C the two orb tables and the LOAD-TIME GUARD — extended over them, and mutation-checked: a non-zero
//    index 0, or a table off the cap's length, must throw at load.
// §D capture. A piece inside an orb but outside both the mouth and the base circle is taken at 6 and 7
//    and not at 5; wrap-aware at the seam; level 0 byte-identical to the parent across a pose grid.
// §E both inScoopBox() callers — the Debris pickup pass and the powerup pickup pass — driven for real.
// §F Ship.draw() renders the orbs at 6-7 only, stroke-only, in POWERUP_COLOR.scoop, tether at 7 only.
// §G the HUD ring reflows to seven segments, with the legibility measurement the phase asks for.
// §H standing traps: no registry row, no lever moved, the mouth V untouched, the predicate not forked,
//    and the phase's own file scope pinned against its literal parent SHA.

"use strict";
const { buildGame, mkAssert, scriptSource, execSource } = require("./_harness.js");
const { parentSource, ownCommits, changedFiles, outsideScope, SKIP_TAG } = require("./_phase-ref.js");

// ⛔ LITERAL, never HEAD (CLAUDE.md, phase-local pins). CS042 P7's commit — this phase's parent.
const PARENT_SHA = "4e150499fc379d2b4c376c3563f1790270dd8717";
const SUBJECT = "cs042 p8:";

const A = mkAssert();
const { assert, eq, close, skip, report } = A;

const X = buildGame();
const src = scriptSource();
const bare = execSource(src);           // comment-free TEXT, so a tombstone can't read as live code

const parentSrc = parentSource(PARENT_SHA);
const P = parentSrc ? buildGame({ source: parentSrc }) : null;

const wrapC = (v, size) => ((v % size) + size) % size;
function beginPlaying(G = X) {
  G.startGame();
  G.game.state = "playing"; G.game.paused = false;
  G.game.debris = []; G.game.hunters = []; G.game.saucers = [];
  G.game.garbage = []; G.game.chain = []; G.game.powerups = [];
}
function placeShip(G, angle, sx, sy) {
  const s = G.game.ship;
  s.x = sx; s.y = sy; s.vx = 0; s.vy = 0; s.angle = angle;
  s.dead = false; s.invuln = 0; s.shieldOn = false; s.hp = G.SHIP_MAX_HP;
  return s;
}
// Ship-local (forward, lateral) -> wrapped world point. The inverse of inScoopBox's own projection.
function localToWorld(G, forward, lateral) {
  const s = G.game.ship, ca = Math.cos(s.angle), sa = Math.sin(s.angle);
  const [w, h] = G.liveDims();
  return { x: wrapC(s.x + forward * ca - lateral * sa, w),
           y: wrapC(s.y + forward * sa + lateral * ca, h) };
}

// =====================================================================================
console.log("(A) THE TRAP — the cap raise does not move the mouth curve at levels 1-5");
// =====================================================================================
{
  eq(X.SCOOP_MAX_LEVEL, 7, "A: SCOOP_MAX_LEVEL is 7");
  eq(X.SCOOP_MOUTH_LEVELS, 5, "A: SCOOP_MOUTH_LEVELS is 5 — the mouth curve's own span");
  assert(X.SCOOP_MAX_LEVEL !== X.SCOOP_MOUTH_LEVELS,
    "A: the cap and the mouth's span are now DIFFERENT numbers — that separation is the whole fix");
  eq(X.SCOOP_WIDTH.length, X.SCOOP_MAX_LEVEL + 1, "A: SCOOP_WIDTH is still cap-length (index = level)");
  eq(X.SCOOP_DEPTH.length, X.SCOOP_MAX_LEVEL + 1, "A: SCOOP_DEPTH is still cap-length");

  if (!P) {
    skip("A: the parent build is unreachable — the trap's before/after comparison cannot run");
  } else {
    eq(P.SCOOP_MAX_LEVEL, 5, "A: (sanity) the parent's cap was 5");
    // ⛔ THE ISOLATION. Feeding the parent's OWN config through the new builder holds the deliberate
    // floor change out of the picture, so any difference at 1..5 can only be the cap raise.
    const w = X.buildScoopSteps(P.SCOOP_CONFIG.minWidthMult * X.SHIP_DRAW_W,
      P.SCOOP_CONFIG.maxWidthMult * X.SHIP_DRAW_W, P.SCOOP_CONFIG.curve);
    const d = X.buildScoopSteps(P.SCOOP_CONFIG.minDepth, P.SCOOP_CONFIG.maxDepth, P.SCOOP_CONFIG.curve);
    console.log("      level |  parent width / depth  |  new builder, parent config");
    for (let k = 1; k <= 5; k++) {
      console.log(`        ${k}   |  ${P.SCOOP_WIDTH[k].toFixed(4).padStart(8)} / ${String(P.SCOOP_DEPTH[k]).padStart(5)}` +
                  `  |  ${w[k].toFixed(4).padStart(8)} / ${String(d[k]).padStart(5)}`);
      eq(w[k], P.SCOOP_WIDTH[k], `A: L${k} mouth width is BIT-IDENTICAL to the parent under the parent's config`);
      eq(d[k], P.SCOOP_DEPTH[k], `A: L${k} mouth depth is BIT-IDENTICAL to the parent under the parent's config`);
    }
    // Levels above the mouth's span clamp to its top step — they do not extend the curve.
    for (let k = X.SCOOP_MOUTH_LEVELS + 1; k <= X.SCOOP_MAX_LEVEL; k++) {
      eq(X.SCOOP_WIDTH[k], X.SCOOP_WIDTH[X.SCOOP_MOUTH_LEVELS], `A: L${k} reads L5's mouth WIDTH exactly`);
      eq(X.SCOOP_DEPTH[k], X.SCOOP_DEPTH[X.SCOOP_MOUTH_LEVELS], `A: L${k} reads L5's mouth DEPTH exactly`);
    }
    eq(X.SCOOP_WIDTH[X.SCOOP_MOUTH_LEVELS], P.SCOOP_WIDTH[5],
      "A: the mouth's top step is unmoved from the parent — both endpoints held");
    eq(X.SCOOP_DEPTH[X.SCOOP_MOUTH_LEVELS], P.SCOOP_DEPTH[5], "A: ...depth too");

    // ⛔ MUTATION CHECK — put the cap back in the divisor and levels 2-4 must visibly shrink. Without
    // this the section above could pass for a reason unrelated to SCOOP_MOUTH_LEVELS existing.
    const trapped = src.replace("const m = Math.min(k, SCOOP_MOUTH_LEVELS);", "const m = k;")
                       .replace("Math.pow((m - 1) / (SCOOP_MOUTH_LEVELS - 1), curve)",
                                "Math.pow((m - 1) / (SCOOP_MAX_LEVEL - 1), curve)");
    assert(trapped !== src, "A: (setup) the counterfactual substitution actually matched the builder");
    const T = buildGame({ source: trapped });
    const shrank = [2, 3, 4].filter(k => T.buildScoopSteps(
      P.SCOOP_CONFIG.minWidthMult * X.SHIP_DRAW_W, P.SCOOP_CONFIG.maxWidthMult * X.SHIP_DRAW_W,
      P.SCOOP_CONFIG.curve)[k] < P.SCOOP_WIDTH[k]);
    eq(shrank.length, 3,
      "A: the counterfactual (divide by the CAP) shrinks levels 2, 3 and 4 — the trap is real and the fix load-bearing");
    eq(shrank.join(","), "2,3,4", "A: ...and it is exactly those three levels, both endpoints still held");
  }
}

// =====================================================================================
console.log("(B) the level-1 floor — minWidthMult 1.2 -> 2.6, minDepth 20 -> 34");
// =====================================================================================
{
  eq(X.SCOOP_CONFIG.minWidthMult, 2.6, "B: minWidthMult is 2.6");
  eq(X.SCOOP_CONFIG.minDepth, 34, "B: minDepth is 34");
  eq(X.SCOOP_CONFIG.maxWidthMult, 5.0, "B: maxWidthMult is untouched at 5.0");
  eq(X.SCOOP_CONFIG.maxDepth, 60, "B: maxDepth is untouched at 60");
  eq(X.SCOOP_CONFIG.curve, 1.0, "B: curve is untouched at 1.0");
  close(X.SCOOP_WIDTH[1], 46.8, "B: L1 mouth width is 46.8 px (was 21.6)", 1e-9);
  eq(X.SCOOP_DEPTH[1], 34, "B: L1 mouth depth is 34 px (was 20)");

  // Box area = width x (depth + SHIP_RADIUS) — the exact region inScoopBox() tests, and the same
  // formula spec §4.2's own table is built from. This is the measurement the constant's comment records.
  const boxArea = (G, k) => G.SCOOP_WIDTH[k] * (G.SCOOP_DEPTH[k] + G.SHIP_RADIUS);
  const circle = Math.PI * X.GARBAGE_PICKUP * X.GARBAGE_PICKUP;
  close(circle, 1017.87, "B: the base pickup circle is ~1,018 px² (the scale spec §4.2 uses)", 0.5);
  if (!P) {
    skip("B: the parent build is unreachable — the before/after area table cannot be measured");
  } else {
    console.log("      level |   before   |   after    |  change");
    for (let k = 1; k <= 5; k++) {
      const b = boxArea(P, k), a = boxArea(X, k);
      console.log(`        ${k}   | ${b.toFixed(0).padStart(6)} px² | ${a.toFixed(0).padStart(6)} px² |  x${(a / b).toFixed(2)}`);
      assert(a >= b, `B: L${k} box area did not shrink (${b.toFixed(0)} -> ${a.toFixed(0)} px²)`);
    }
    close(boxArea(P, 1), 713, "B: the parent's L1 box was 713 px² — spec §4.2's own figure", 1);
    close(boxArea(X, 1), 2200, "B: L1 is now 2,200 px²", 1);
    assert(boxArea(X, 1) > circle,
      "B: ⛔ THE DEFECT §4.2 NAMED IS FIXED — L1's mouth is now larger than the base circle it used to hide inside");
    eq(boxArea(X, 5), boxArea(P, 5), "B: L5 is unmoved — the floor raise moved the bottom of the ramp, not the top");
    // ⚠ Spec §4.3 says L1 lands "just ahead of the Magnet". It does not, on its own numbers or on the
    // measured ones. Recorded rather than fixed: the constants ship as §4.3 specifies them.
    const magnet = Math.PI * Math.pow(X.GARBAGE_PICKUP * X.MAGNET_PICKUP_MULT, 2);
    console.log(`      L1 mouth ${boxArea(X, 1).toFixed(0)} px² vs the Magnet's boosted circle ${magnet.toFixed(0)} px² ` +
                `— §4.3's "just ahead of the Magnet" does NOT hold; see STATUS.md`);
    assert(boxArea(X, 1) < magnet, "B: (recorded, not a defect in this phase) L1 is still below the Magnet's circle");
  }
}

// =====================================================================================
console.log("(C) the orb tables and the LOAD-TIME GUARD, extended over both of them");
// =====================================================================================
{
  eq(X.SCOOP_ORB_OFFSET.length, X.SCOOP_MAX_LEVEL + 1, "C: SCOOP_ORB_OFFSET is cap-length (index = level)");
  eq(X.SCOOP_ORB_R.length, X.SCOOP_MAX_LEVEL + 1, "C: SCOOP_ORB_R is cap-length");
  for (let k = 0; k <= X.SCOOP_MOUTH_LEVELS; k++) {
    eq(X.SCOOP_ORB_OFFSET[k], 0, `C: SCOOP_ORB_OFFSET[${k}] is 0 — no orbs below the orb tier`);
    eq(X.SCOOP_ORB_R[k], 0, `C: SCOOP_ORB_R[${k}] is 0`);
  }
  eq(X.SCOOP_ORB_OFFSET[6], 62, "C: L6 orb offset is 62 (spec §4.3)");
  eq(X.SCOOP_ORB_R[6], 26, "C: L6 orb radius is 26");
  eq(X.SCOOP_ORB_OFFSET[7], 84, "C: L7 orb offset is 84");
  eq(X.SCOOP_ORB_R[7], 34, "C: L7 orb radius is 34");
  assert(X.SCOOP_ORB_OFFSET[7] > X.SCOOP_ORB_OFFSET[6] && X.SCOOP_ORB_R[7] > X.SCOOP_ORB_R[6],
    "C: level 7 reaches further out and sweeps wider than level 6");
  close(2 * Math.PI * X.SCOOP_ORB_R[6] ** 2, 4247, "C: L6's two orbs cover ~4,247 px² (spec §4.3)", 1);
  close(2 * Math.PI * X.SCOOP_ORB_R[7] ** 2, 7263, "C: L7's two orbs cover ~7,263 px²", 1);
  // L7's orbs clear the mouth entirely; L6's graze it. Recorded so the area figures above are read right.
  assert(X.SCOOP_ORB_OFFSET[7] - X.SCOOP_ORB_R[7] > X.SCOOP_WIDTH[7] / 2,
    "C: L7's orbs sit clear of the mouth's half-width — the two regions are disjoint there");

  // ⛔ THE GUARD IS A DELIBERATE INVARIANT GUARD, NOT TEST SCAFFOLDING. Mutation-checked in both
  // directions: the shipped tables load, and each broken table throws AT LOAD.
  const threw = mutated => {
    try { buildGame({ source: mutated }); return null; }
    catch (e) { return e.message; }
  };
  assert(threw(src) === null, "C: (control) the shipped build loads — the guard does not fire on it");

  const zeroCases = [
    ["SCOOP_ORB_OFFSET", "const SCOOP_ORB_OFFSET = [0, 0, 0, 0, 0, 0, 62, 84];",
                         "const SCOOP_ORB_OFFSET = [1, 0, 0, 0, 0, 0, 62, 84];"],
    ["SCOOP_ORB_R",      "const SCOOP_ORB_R      = [0, 0, 0, 0, 0, 0, 26, 34];",
                         "const SCOOP_ORB_R      = [1, 0, 0, 0, 0, 0, 26, 34];"],
  ];
  for (const [name, from, to] of zeroCases) {
    assert(src.includes(from), `C: (setup) the ${name} literal is where the mutation expects it`);
    const msg = threw(src.replace(from, to));
    assert(msg !== null, `C: a non-zero ${name}[0] THROWS at load — a level-0 ship can never grow orbs`);
    assert(msg !== null && /SCOOP step 0 must be 0/.test(msg),
      `C: ...through the same guard the mouth tables use (got ${JSON.stringify(msg)})`);
  }
  // The mouth tables' own half of the guard is unchanged and still fires.
  {
    const msg = threw(src.replace("const steps = [0];", "const steps = [1];"));
    assert(msg !== null && /SCOOP step 0 must be 0/.test(msg),
      "C: the mouth half of the guard still throws on a non-zero step 0 (untouched by this phase)");
  }
  // The LENGTH check: the mouth tables are generated from the cap, the orb tables are literals, so a
  // future cap change that misses them would index `undefined` and capture nothing rather than fail.
  {
    const msg = threw(src.replace("const SCOOP_ORB_R      = [0, 0, 0, 0, 0, 0, 26, 34];",
                                  "const SCOOP_ORB_R      = [0, 0, 0, 0, 0, 0, 26];"));
    assert(msg !== null && /SCOOP orb tables must be/.test(msg),
      "C: an orb table shorter than SCOOP_MAX_LEVEL+1 THROWS at load rather than silently reading undefined");
  }
  assert(/SCOOP_ORB_OFFSET\[0\] !== 0 \|\| SCOOP_ORB_R\[0\] !== 0/.test(bare),
    "C: both orb tables are named inside the one guard expression, not a second guard elsewhere");
}

// =====================================================================================
console.log("(D) capture — the orbs are real, level 5 does not have them, level 0 is unchanged");
// =====================================================================================
{
  // A probe abreast of the ship, dead on an orb's centre: forward 0, lateral = the orb offset.
  // At that point the mouth cannot reach (|lateral| > half-width) and the base circle cannot either.
  const probeAt = lvl => ({ forward: 0, lateral: X.SCOOP_ORB_OFFSET[lvl] });

  for (const lvl of [6, 7]) {
    const { forward, lateral } = probeAt(lvl);
    beginPlaying();
    const [w, h] = X.liveDims();
    placeShip(X, 0, w / 2, h / 2);
    X.game.scoopLevel = lvl;
    const g = localToWorld(X, forward, lateral);
    assert(Math.abs(lateral) > X.SCOOP_WIDTH[lvl] / 2,
      `D: (setup) L${lvl}'s probe is OUTSIDE the mouth's half-width (${lateral} vs ${X.SCOOP_WIDTH[lvl] / 2})`);
    assert(Math.abs(lateral) > X.GARBAGE_PICKUP * X.MAGNET_PICKUP_MULT,
      `D: (setup) L${lvl}'s probe is outside even a MAGNET-widened base circle`);
    assert(X.inScoopBox(g), `D: L${lvl} CAPTURES a piece sitting on an orb's centre`);
    // The same point at level 5 — the level below the orb tier — must not be captured.
    X.game.scoopLevel = 5;
    assert(!X.inScoopBox(g), `D: the SAME point is NOT captured at level 5 (no orbs there)`);
    X.game.scoopLevel = lvl;

    // Edges of the disc, on both sides, just in and just out.
    const r = X.SCOOP_ORB_R[lvl], eps = 0.5;
    for (const side of [-1, 1]) {
      assert(X.inScoopBox(localToWorld(X, 0, side * (X.SCOOP_ORB_OFFSET[lvl] + r - eps))),
        `D: L${lvl} lateral edge just INSIDE the ${side < 0 ? "port" : "starboard"} orb is captured`);
      assert(!X.inScoopBox(localToWorld(X, 0, side * (X.SCOOP_ORB_OFFSET[lvl] + r + eps))),
        `D: L${lvl} lateral edge just OUTSIDE the ${side < 0 ? "port" : "starboard"} orb is not`);
      assert(X.inScoopBox(localToWorld(X, r - eps, side * X.SCOOP_ORB_OFFSET[lvl])),
        `D: L${lvl} the orb reaches FORWARD of the ship, not just abreast of it`);
      assert(X.inScoopBox(localToWorld(X, -(r - eps), side * X.SCOOP_ORB_OFFSET[lvl])),
        `D: L${lvl} ...and BEHIND it — the disc is centred on the ship's beam, not ahead of it`);
      assert(!X.inScoopBox(localToWorld(X, r + eps, side * X.SCOOP_ORB_OFFSET[lvl])),
        `D: L${lvl} just beyond the orb's forward edge is not captured`);
    }
    // The orbs are the SHIP's, not the world's: they rotate with the hull.
    for (const ang of [0, Math.PI / 2, Math.PI, -Math.PI / 2, 2.1]) {
      X.game.ship.angle = ang;
      assert(X.inScoopBox(localToWorld(X, 0, X.SCOOP_ORB_OFFSET[lvl])),
        `D: L${lvl} the orb follows the ship's heading (${ang.toFixed(2)} rad)`);
    }
    X.game.ship.angle = 0;
  }

  // ⛔ WRAP-AWARE. The orbs reuse inScoopBox's own shortDelta projection; a fresh Math.hypot on raw
  // world coordinates would fail exactly here.
  for (const lvl of [6, 7]) {
    for (const [name, ang, sx, sy] of [
      ["x-seam", 0, (w, h) => w - 5, (w, h) => h / 2],
      ["y-seam", Math.PI / 2, (w, h) => w / 2, (w, h) => h - 5],
    ]) {
      beginPlaying();
      const [w, h] = X.liveDims();
      placeShip(X, ang, sx(w, h), sy(w, h));
      X.game.scoopLevel = lvl;
      // Facing along the seam puts the ORBS across it (they sit on the beam, 90 degrees off the nose).
      const g = localToWorld(X, 0, X.SCOOP_ORB_OFFSET[lvl]);
      assert(X.inScoopBox(g), `D: L${lvl} the orb captures across the world ${name}`);
    }
  }

  // Level 0 is byte-identical to the parent across a pose grid — the whole point of the load-time guard.
  if (!P) {
    skip("D: the parent build is unreachable — the level-0 equivalence grid cannot run");
  } else {
    beginPlaying(); beginPlaying(P);
    const [w, h] = X.liveDims();
    placeShip(X, 0, w / 2, h / 2); placeShip(P, 0, P.game.ship.x, P.game.ship.y);
    P.game.ship.x = X.game.ship.x; P.game.ship.y = X.game.ship.y;
    let cases = 0, same = 0;
    for (const ang of [0, Math.PI / 4, Math.PI / 2, Math.PI, -Math.PI / 2, 2.1]) {
      X.game.ship.angle = P.game.ship.angle = ang;
      for (const forward of [-40, -13, 0, 20, 62, 84, 120]) {
        for (const lateral of [0, 20, 45, 62, 84, 118, -62, -84]) {
          X.game.scoopLevel = P.game.scoopLevel = 0;
          const g = localToWorld(X, forward, lateral);
          cases++;
          if (X.inScoopBox(g) === P.inScoopBox(g)) same++;
        }
      }
    }
    eq(same, cases, `D: at level 0 inScoopBox is byte-identical to the parent across all ${cases} poses`);
    assert(cases > 300, "D: (sanity) the level-0 grid is not degenerate");
  }
}

// =====================================================================================
console.log("(E) BOTH inScoopBox() callers see the orbs — the predicate is not forked");
// =====================================================================================
{
  // (1) the Debris pickup pass, driven through the real update().
  {
    beginPlaying();
    const [w, h] = X.liveDims();
    placeShip(X, 0, w / 2, h / 2);
    X.game.scoopLevel = 6;
    const p = localToWorld(X, 0, X.SCOOP_ORB_OFFSET[6]);
    const g = new X.Garbage(p.x, p.y);
    X.game.garbage = [g];
    assert(X.dist2(g, X.game.ship) > X.GARBAGE_PICKUP * X.GARBAGE_PICKUP,
      "E: (setup) the piece is outside the base pickup circle");
    X.update(1 / 60);
    eq(X.game.chain.length, 1, "E: the Debris pickup pass hooks a piece sitting in an orb");
  }
  // ...and does not at level 5, same placement, same frame.
  {
    beginPlaying();
    const [w, h] = X.liveDims();
    placeShip(X, 0, w / 2, h / 2);
    X.game.scoopLevel = 5;
    const p = localToWorld(X, 0, X.SCOOP_ORB_OFFSET[6]);
    X.game.garbage = [new X.Garbage(p.x, p.y)];
    X.update(1 / 60);
    eq(X.game.chain.length, 0, "E: ...and does NOT at level 5, from the identical placement");
  }
  // (2) the powerup pickup pass, driven through the same real update().
  {
    beginPlaying();
    const [w, h] = X.liveDims();
    placeShip(X, 0, w / 2, h / 2);
    X.game.scoopLevel = 7;
    const pu = new X.Powerup(0, 0, "rapid");
    const p = localToWorld(X, 0, X.SCOOP_ORB_OFFSET[7]);
    pu.x = p.x; pu.y = p.y;
    const r = pu.radius + X.SHIP_RADIUS;
    assert(X.dist2(pu, X.game.ship) > r * r, "E: (setup) the powerup is outside its own base pickup circle");
    X.game.powerups = [pu];
    const picked = X.game.stats.powerupsPicked;
    X.update(1 / 60);
    eq(pu.dead, true, "E: the POWERUP pickup pass collects a drop sitting in an orb");
    eq(X.game.stats.powerupsPicked, picked + 1, "E: ...through the real applyPowerup(), not a shortcut");
  }
  {
    beginPlaying();
    const [w, h] = X.liveDims();
    placeShip(X, 0, w / 2, h / 2);
    X.game.scoopLevel = 5;
    const pu = new X.Powerup(0, 0, "rapid");
    const p = localToWorld(X, 0, X.SCOOP_ORB_OFFSET[7]);
    pu.x = p.x; pu.y = p.y;
    X.game.powerups = [pu];
    X.update(1 / 60);
    eq(pu.dead, false, "E: ...and does NOT at level 5, from the identical placement");
  }
  // Structural: exactly two call sites, both bare `inScoopBox(...)`, neither reimplementing the orbs.
  const callers = (bare.match(/inScoopBox\(/g) || []).length;
  eq(callers, 3, "E: `inScoopBox(` appears three times — its declaration plus its two callers, no third");
  assert(!/SCOOP_ORB_R\[/.test(bare.split("function inScoopBox")[1].split("\n}")[1] || ""),
    "E: (sanity) the orb tables are read inside inScoopBox, not re-tested at a call site");
}

// =====================================================================================
console.log("(F) render — the orbs are stroke-only, scoop-violet, and tethered only at level 7");
// =====================================================================================
{
  // A recording ctx: method calls land as [name, ...args, styleSnapshot]; the snapshot is how a
  // glowStroke's own colour is recoverable (it sets, strokes and resets inside one statement).
  function drawAt(lvl) {
    const log = [];
    const G = buildGame({ ctxLog: log });
    beginPlaying(G);
    const [w, h] = G.liveDims();
    placeShip(G, 0, w / 2, h / 2);
    G.game.scoopLevel = lvl;
    G.game.ship.invuln = 0;        // not blinking — the scoop shapes live in the !blink branch
    G.game.levelEndGraceT = 0;     // and not pulsing, so globalAlpha stays at 1 throughout
    log.length = 0;
    G.game.ship.draw();
    return { G, log };
  }
  // One "shape" per moveTo; its colour is the strokeStyle in force at the stroke that follows.
  function shapes(log) {
    const out = [];
    let cur = null;
    for (const e of log) {
      if (e[0] === "moveTo") { cur = { pts: [[e[1], e[2]]], color: null }; out.push(cur); }
      else if (e[0] === "lineTo" && cur) cur.pts.push([e[1], e[2]]);
      else if (e[0] === "stroke" && cur) { cur.color = (e[1] || {}).strokeStyle; cur = null; }
    }
    return out;
  }

  for (const lvl of [0, 5, 6, 7]) {
    const { G, log } = drawAt(lvl);
    eq(log.filter(e => e[0] === "fill" || e[0] === "fillRect").length, 0,
      `F: L${lvl} — the ship draws ZERO fills (Pillar 1; the orbs are strokes like everything else)`);
    const orbs = shapes(log).filter(s => s.color === G.POWERUP_COLOR.scoop);
    const want = lvl >= 6 ? 2 : 0;
    eq(orbs.length, want, `F: L${lvl} draws ${want} orb ring(s) in POWERUP_COLOR.scoop`);
    for (const o of orbs) {
      eq(o.pts.length, G.SCOOP_ORB_SEGS, `F: L${lvl} each orb ring is a ${G.SCOOP_ORB_SEGS}-point poly`);
      // Geometry read back off the drawn points, and checked against the TABLES, not a literal.
      const cx = o.pts.reduce((a, p) => a + p[0], 0) / o.pts.length;
      const cy = o.pts.reduce((a, p) => a + p[1], 0) / o.pts.length;
      close(cx, 0, `F: L${lvl} the orb is centred on the ship's beam (forward 0)`, 1e-9);
      close(Math.abs(cy), G.SCOOP_ORB_OFFSET[lvl], `F: L${lvl} ...at |lateral| = SCOOP_ORB_OFFSET[${lvl}]`, 1e-9);
      const rad = Math.hypot(o.pts[0][0] - cx, o.pts[0][1] - cy);
      close(rad, G.SCOOP_ORB_R[lvl], `F: L${lvl} ...with radius SCOOP_ORB_R[${lvl}]`, 1e-9);
    }
    if (want === 2) {
      const sides = orbs.map(o => Math.sign(o.pts.reduce((a, p) => a + p[1], 0))).sort();
      eq(sides.join(","), "-1,1", `F: L${lvl} one orb per side, mirrored about the facing axis`);
    }
    // The tether: two-point open polys in COLOR.dim, level 7 only.
    // ⛔ The expectation is the LITERAL 7, not SCOOP_ORB_TETHER_LEVEL — reading the constant here
    // would let the assertion move with the very knob it exists to pin, and a tether appearing at
    // level 6 would pass. The constant's own value is asserted once, separately, below.
    const tethers = shapes(log).filter(s => s.color === G.COLOR.dim && s.pts.length === 2);
    eq(tethers.length, lvl >= 7 ? 2 : 0,
      `F: L${lvl} draws ${lvl >= 7 ? "two faint tethers" : "no tether"} — the tether is level 7 only`);
    // The mouth V is untouched by all of this: still 3 points, still COLOR.dock, still there at 1-7.
    const vs = shapes(log).filter(s => s.color === G.COLOR.dock && s.pts.length === 3);
    eq(vs.length, lvl > 0 ? 1 : 0, `F: L${lvl} the mouth prong-V is unchanged (${lvl > 0 ? "drawn" : "hidden at level 0"})`);
    if (lvl > 0) {
      close(Math.max(...vs[0].pts.map(p => p[0])), G.SCOOP_DEPTH[lvl],
        `F: L${lvl} ...and still flares to SCOOP_DEPTH[${lvl}]`, 1e-9);
    }
  }
  eq(X.SCOOP_ORB_TETHER_LEVEL, 7, "F: SCOOP_ORB_TETHER_LEVEL is 7 — the tether is the top level's own tell");
  eq(X.SCOOP_ORB_SEGS, 12, "F: SCOOP_ORB_SEGS is 12 — a poly ring, not a ctx.arc");
  // The orbs are drawn BEFORE the hull, like the mouth — the phase's stated z-order.
  {
    const { G, log } = drawAt(7);
    const s = shapes(log);
    const lastOrb = s.map((x, i) => [x, i]).filter(([x]) => x.color === G.POWERUP_COLOR.scoop).pop()[1];
    const hull = s.findIndex(x => x.color === G.COLOR.ship);
    assert(hull > lastOrb, "F: both orbs are drawn BEFORE the hull, alongside the mouth V");
  }
  // ⛔ CS025 P5 stands: no magnet recolour on either shape.
  assert(!/magnetPulling\(\)/.test(bare.split("class Ship")[1].split("class Bullet")[0]),
    "F: Ship.draw() still reads no magnet state — CS025 P5's backout is not reopened by the orbs");
}

// =====================================================================================
console.log("(G) the HUD ring reflows to seven segments — with the legibility measurement");
// =====================================================================================
{
  const log = [];
  const G = buildGame({ ctxLog: log });
  beginPlaying(G);
  G.game.scoopLevel = 6;
  log.length = 0;
  G.draw();
  // The SCOOP row is the one segmented ring at (40, HUD_FX_BASE_Y) with radius HUD_FX_RING_R.
  // Each wedge is arc() then stroke(); a lit one goes out through glowStroke, which sets shadowBlur
  // on the STROKE, not on the arc — so the tell has to be read off the stroke that follows.
  const wedges = [];
  for (let i = 0; i < log.length; i++) {
    const e = log[i];
    if (!(e[0] === "arc" && e[1] === 40 && e[2] === G.HUD_FX_BASE_Y && e[3] === G.HUD_FX_RING_R)) continue;
    let closed = false, stroke = null;
    for (let j = i + 1; j < log.length && stroke === null; j++) {
      if (log[j][0] === "closePath") closed = true;
      if (log[j][0] === "stroke") stroke = log[j][1] || {};
    }
    wedges.push({ start: e[4], end: e[5], closed, lit: (stroke || {}).shadowBlur > 0 });
  }
  eq(wedges.length, G.SCOOP_MAX_LEVEL, `G: the SCOOP row draws ${G.SCOOP_MAX_LEVEL} wedges — derived from the cap, never hardcoded`);
  eq(wedges.filter(w => w.lit).length, 6, "G: at scoopLevel 6, exactly 6 of the 7 wedges are lit");
  eq(wedges.filter(w => w.closed).length, 0, "G: no wedge closePath()s — the ring-arc convention holds");
  // The seven wedges tile one full turn, so the reflow really is the ring rather than a partial row.
  if (wedges.length === G.SCOOP_MAX_LEVEL) {
    const span = wedges[wedges.length - 1].end - wedges[0].start + G.HUD_RING_SEG_GAP;
    close(span, 2 * Math.PI, "G: the seven wedges span exactly one full turn", 1e-9);
  }

  // The legibility measurement the phase asks for, at HUD_FX_RING_R.
  const step = (2 * Math.PI) / G.SCOOP_MAX_LEVEL;
  const wedgeArc = G.HUD_FX_RING_R * (step - G.HUD_RING_SEG_GAP);
  const gapArc = G.HUD_FX_RING_R * G.HUD_RING_SEG_GAP;
  const wedgeArc5 = G.HUD_FX_RING_R * ((2 * Math.PI) / 5 - G.HUD_RING_SEG_GAP);
  console.log(`      at r=${G.HUD_FX_RING_R}: wedge arc ${wedgeArc.toFixed(2)} px (was ${wedgeArc5.toFixed(2)} at 5 segments), ` +
              `gap ${gapArc.toFixed(2)} px, stroke ${G.HUD_RING_W} px`);
  assert(wedgeArc > 3 * G.HUD_RING_W,
    `G: a lit wedge is still over 3x its own stroke width long (${wedgeArc.toFixed(2)} vs ${G.HUD_RING_W}) — legible`);
  // HUD_RING_SEG_GAP is in RADIANS, so the visible gap between wedges does not shrink with the count —
  // only the lit wedge does. That is the whole legibility question at seven segments.
  const measuredGap = wedges.length > 1 ? G.HUD_FX_RING_R * (wedges[1].start - wedges[0].end) : NaN;
  close(measuredGap, gapArc, "G: the drawn inter-wedge gap is 1.92 px, unchanged from five segments", 1e-9);
  assert(wedgeArc > gapArc * 5,
    "G: a wedge is still five times the gap beside it, so the ring reads as segments and not as dots");
}

// =====================================================================================
console.log("(H) standing traps and the phase's own scope");
// =====================================================================================
{
  const { hasKnob } = require("./test-registry.js");
  eq(typeof hasKnob, "function", "H: (sanity) the registry helper loaded");
  assert(!X.DEBUG_VARS.some(v => /scoopOrb|orbOffset|orbRadius|scoopMouthLevels/i.test(v.key || "")),
    "H: P8 adds NO debug-registry row — the orbs are geometry, tuned in tools/scoop-lab.html");
  assert(!X.LEVERS.some(l => /scoop/i.test(l.id || "")),
    "H: P8 adds no difficulty lever — the Scoop has never been levered and still is not");
  // REWRITTEN IN PLACE BY CS042 P9: this pin said the loss rate and the health reserve belong to P9
  // and not to P8. They did, and P9 has now built both — so the pin flips from "P8 must not touch
  // this" to "P9 did, and P8's own scope claim still holds", which is the half that was ever P8's.
  // Deleting it would throw away the record that P8 deliberately left SCOOP_HITS_PER_LEVEL alone.
  eq(X.SCOOP_HITS_PER_LEVEL, 2,
    "H: ⛔ SCOOP_HITS_PER_LEVEL is 2 — P8 left it at 5 deliberately and CS042 P9 (§4.4) moved it, not P8");
  assert(/bankSpareHullPct/.test(bare),
    "H: ...and §4.5's health reserve is P9's too, built there and not ahead of itself here");
  eq(X.SCOOP_MAX_BONUS, 500, "H: the at-cap bonus is unmoved — a pick at 7 pays exactly what a pick at 5 did");
  // The at-cap arm still fires at the NEW cap, not the old one.
  {
    beginPlaying();
    X.game.scoopLevel = X.SCOOP_MAX_LEVEL - 1; X.game.score = 0;
    X.applyPowerup("scoop");
    eq(X.game.scoopLevel, X.SCOOP_MAX_LEVEL, "H: a pick at 6 climbs to 7 — the two new levels are reachable");
    eq(X.game.score, 0, "H: ...and pays no bonus, because it was not at the cap");
    X.applyPowerup("scoop");
    eq(X.game.scoopLevel, X.SCOOP_MAX_LEVEL, "H: a pick at 7 does not exceed the cap");
    eq(X.game.score, X.SCOOP_MAX_BONUS, "H: ...and pays SCOOP_MAX_BONUS instead");
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
      const outside = outsideScope(changed, ["tools/scoop-lab.html", "tools/lowhp-glow-lab.html"]);
      eq(outside.length, 0,
        `H: nothing outside scope changed${provisional ? " (PROVISIONAL — read from the working tree)" : ""}` +
        (outside.length ? " — " + outside.join(", ") : ""));
      assert(changed.includes("orbital-overhaul.html"), "H: the game file is in the diff");
      assert(changed.includes("tools/scoop-lab.html"), "H: the scoop lab grew the orbs, as the phase requires");
    }
  }
}

report();
