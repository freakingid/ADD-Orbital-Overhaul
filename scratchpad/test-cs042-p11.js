// scratchpad/test-cs042-p11.js — CS042 P11: GATE C's G4 answer, the scoop's dashed field render.
//
//   node scratchpad/test-cs042-p11.js
//
// §A the two dash constants — values, and that they are PLAIN constants (no DEBUG_VARS row).
// §B render order, driven through the real Ship.draw(): the dash is armed before the first scoop
//    stroke and disarmed before the hull, at every level 1-7, and never armed at all at level 0.
// §C the armed pattern is the two constants themselves, read off the build, not two literals.
// §D one site only — setLineDash() appears exactly twice in the executable source, both in Ship.draw.
// §E ⛔ RENDER-ONLY, MEASURED AGAINST THE PARENT. The capture predicate, both scoop tables and
//    damageShip()'s scoop block are byte-identical to the parent, and inScoopBox() answers the same
//    over a pose/probe grid at every level. G4 was a look question; nothing about play may have moved.
// §F the load-bearing mutation check: drop the disarm and the HULL strokes dashed. Without this,
//    §B's "cleared before the hull" would pass for a reason unrelated to that line existing.
// §G standing traps: no globalAlpha writer was added to the scoop block (the level-end grace pulse
//    still owns that channel — which is why alpha was not G4's answer), CS025 P5's magnet-recolour
//    prohibition still holds, and GAME_VERSION has moved off the parent's.
//
// ⛔ NO FILE-SCOPE PIN. CLAUDE.md's standing rule: a closing phase rewrites documents by
// instruction, so a "nothing else moved" pin cannot survive by construction. Zero-skips is asserted
// for the suite as a whole by the closing phase's own run, not from inside one file.

"use strict";
const { buildGame, mkAssert, scriptSource, execSource } = require("./_harness.js");
const { parentSource, SKIP_TAG } = require("./_phase-ref.js");

// ⛔ LITERAL, never HEAD (CLAUDE.md, phase-local pins). CS042's GATE C commit — this phase's parent.
const PARENT_SHA = "0a4be76d060d4b2b46017592fe3e800a66a94cfb";

const A = mkAssert();
const { assert, eq, close, skip, report } = A;

const X = buildGame();
const src = scriptSource();
const bare = execSource(src);           // comment-free TEXT, so a tombstone can't read as live code

const parentSrc = parentSource(PARENT_SHA);
const P = parentSrc ? buildGame({ source: parentSrc }) : null;

const wrapC = (v, size) => ((v % size) + size) % size;
function beginPlaying(G) {
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
// Draw one ship at one scoop level through the REAL Ship.draw(), returning the raw ctx write log.
// invuln 0 and levelEndGraceT 0 keep the draw out of the blink branch and off the grace pulse, so
// the log carries the scoop shapes and nothing conditional on top of them.
function drawAt(lvl, source) {
  const log = [];
  const G = source ? buildGame({ source, ctxLog: log }) : buildGame({ ctxLog: log });
  beginPlaying(G);
  const [w, h] = G.liveDims();
  placeShip(G, 0, w / 2, h / 2);
  G.game.scoopLevel = lvl;
  G.game.ship.invuln = 0;
  G.game.levelEndGraceT = 0;
  log.length = 0;
  G.game.ship.draw();
  return { G, log };
}
// The index of the first stroke made in `color`, or -1. A glowStroke sets, strokes and resets inside
// one statement, so the colour is only recoverable from the style snapshot the log appends.
function strokeIdx(log, color) {
  return log.findIndex(e => e[0] === "stroke" && (e[1] || {}).strokeStyle === color);
}
function dashCalls(log) {
  return log.map((e, i) => [e, i]).filter(([e]) => e[0] === "setLineDash");
}

// =====================================================================================
console.log("(A) the two field constants, and that they are PLAIN constants");
// =====================================================================================
{
  eq(X.SCOOP_FIELD_DASH, 6, "A: SCOOP_FIELD_DASH is 6 px of stroke per dash");
  eq(X.SCOOP_FIELD_GAP, 6, "A: SCOOP_FIELD_GAP is 6 px of gap");
  assert(X.SCOOP_FIELD_DASH > 0 && X.SCOOP_FIELD_GAP > 0,
    "A: both are positive — a zero gap is a solid line and a zero dash draws nothing");

  // ⛔ Pure-presentation values live as plain constants, never as DEBUG_VARS rows — the standing
  // CAPTION_LINGER / LEVEL_BANNER_TIME rule, and the category CS038 P5 retired twelve knobs INTO.
  // This is a presence check on a name pattern, not a registry count: counts live in test-registry.js.
  const rows = X.DEBUG_VARS.filter(v => /scoopField|scoopDash|scoopGap|scoopAlpha/i.test(v.key || ""));
  eq(rows.length, 0, "A: G4 added NO debug registry row — it is a look, tuned by editing the constant");

  // Sized against what they stroke: an orb ring must break into plainly countable dashes, not read
  // as a dotted line or as one continuous stroke with a nick in it.
  for (const lvl of [6, 7]) {
    const r = X.SCOOP_ORB_R[lvl];
    const perim = 2 * X.SCOOP_ORB_SEGS * r * Math.sin(Math.PI / X.SCOOP_ORB_SEGS);
    const dashes = perim / (X.SCOOP_FIELD_DASH + X.SCOOP_FIELD_GAP);
    console.log(`      L${lvl} orb: perimeter ${perim.toFixed(1)} px -> ${dashes.toFixed(1)} dashes`);
    assert(dashes >= 8 && dashes <= 40,
      `A: L${lvl}'s orb ring breaks into ${dashes.toFixed(1)} dashes — broken, but not stippled`);
  }
}

// =====================================================================================
console.log("(B) the dash is armed before the first scoop stroke and disarmed before the hull");
// =====================================================================================
{
  {
    const { log } = drawAt(0);
    eq(dashCalls(log).length, 0,
      "B: L0 — a ship with no scoop makes NO setLineDash call at all (nothing dashed is drawn)");
    assert(strokeIdx(log, X.COLOR.ship) >= 0, "B: L0 — (sanity) the hull is still drawn");
  }
  for (let lvl = 1; lvl <= X.SCOOP_MAX_LEVEL; lvl++) {
    const { G, log } = drawAt(lvl);
    const calls = dashCalls(log);
    eq(calls.length, 2, `B: L${lvl} — exactly two setLineDash calls: one arm, one disarm`);
    const [armed, cleared] = calls;
    assert(Array.isArray(armed[0][1]) && armed[0][1].length === 2,
      `B: L${lvl} — the first call arms a two-entry pattern`);
    assert(Array.isArray(cleared[0][1]) && cleared[0][1].length === 0,
      `B: L${lvl} — the second call clears it with an empty array`);

    const mouth = strokeIdx(log, G.COLOR.dock);
    const hull = strokeIdx(log, G.COLOR.ship);
    assert(mouth >= 0, `B: L${lvl} — (sanity) the mouth V is drawn`);
    assert(hull >= 0, `B: L${lvl} — (sanity) the hull is drawn`);
    assert(armed[1] < mouth, `B: L${lvl} — the dash is armed BEFORE the mouth V strokes`);
    assert(cleared[1] > mouth, `B: L${lvl} — ...and not cleared until after it`);
    assert(cleared[1] < hull, `B: L${lvl} — the dash is cleared BEFORE the hull strokes (the whole point)`);

    if (lvl >= 6) {
      const orb = strokeIdx(log, G.POWERUP_COLOR.scoop);
      assert(orb >= 0, `B: L${lvl} — (sanity) an orb ring is drawn`);
      assert(armed[1] < orb && cleared[1] > orb,
        `B: L${lvl} — both orbs stroke inside the armed window too`);
    }
    if (lvl >= X.SCOOP_ORB_TETHER_LEVEL) {
      const tether = strokeIdx(log, G.COLOR.dim);
      assert(tether >= 0 && armed[1] < tether && cleared[1] > tether,
        `B: L${lvl} — the tether strokes inside the armed window as well`);
    }
  }
}

// =====================================================================================
console.log("(C) the armed pattern IS the two constants, not two literals beside them");
// =====================================================================================
{
  const { G, log } = drawAt(7);
  const armed = dashCalls(log)[0][0][1];
  eq(armed[0], G.SCOOP_FIELD_DASH, "C: the armed dash length is SCOOP_FIELD_DASH");
  eq(armed[1], G.SCOOP_FIELD_GAP, "C: the armed gap length is SCOOP_FIELD_GAP");

  // Move both constants and the armed pattern must move with them — otherwise the two names above
  // could be coincidentally equal to hardcoded 6s at the call site.
  const retuned = src.replace("const SCOOP_FIELD_DASH = 6;", "const SCOOP_FIELD_DASH = 11;")
                     .replace("const SCOOP_FIELD_GAP  = 6;", "const SCOOP_FIELD_GAP  = 3;");
  assert(retuned !== src, "C: (setup) the retune substitution actually matched both constants");
  const armed2 = dashCalls(drawAt(7, retuned).log)[0][0][1];
  eq(armed2.join(","), "11,3", "C: retuning the constants retunes the stroke — a real read, not a literal");
}

// =====================================================================================
console.log("(D) one site — setLineDash lives in Ship.draw()'s scoop block and nowhere else");
// =====================================================================================
{
  const hits = bare.match(/setLineDash/g) || [];
  eq(hits.length, 2, "D: exactly two setLineDash calls in the whole executable source");
  const ship = bare.split("class Ship")[1].split("class Bullet")[0];
  eq((ship.match(/setLineDash/g) || []).length, 2, "D: ...and both are inside class Ship");
  // Neither shared render primitive learned the pattern: drawPoly/glowStroke stay dash-agnostic, so
  // every other caller in the file keeps stroking solid without knowing this feature exists.
  for (const fn of ["function drawPoly", "function glowStroke", "function drawRingArc",
                    "function drawRingSegments"]) {
    const body = bare.slice(bare.indexOf(fn));
    assert(!/setLineDash/.test(body.slice(0, body.indexOf("\n}"))),
      `D: ${fn.replace("function ", "")}() is unchanged — the dash is the caller's, not the primitive's`);
  }
}

// =====================================================================================
console.log("(E) ⛔ RENDER-ONLY — capture, tables and the decay block are the parent's exactly");
// =====================================================================================
if (!P) {
  skip(`E: ${SKIP_TAG} — the parent build is unreachable, so the render-only claim cannot be measured`);
} else {
  const pBare = execSource(parentSrc);
  const fnOf = (text, sig) => {
    const i = text.indexOf(sig);
    return i < 0 ? null : text.slice(i, text.indexOf("\n}", i) + 2);
  };
  for (const sig of ["function inScoopBox(", "function buildScoopSteps(", "function damageShip("]) {
    const a = fnOf(bare, sig), b = fnOf(pBare, sig);
    assert(a && b, `E: (sanity) ${sig}) found in both builds`);
    eq(a, b, `E: ${sig}) is BYTE-IDENTICAL to the parent — G4 moved no mechanics`);
  }
  for (const t of ["SCOOP_WIDTH", "SCOOP_DEPTH", "SCOOP_ORB_OFFSET", "SCOOP_ORB_R"]) {
    eq(X[t].join(","), P[t].join(","), `E: ${t} is unmoved from the parent`);
  }
  eq(X.SCOOP_HITS_PER_LEVEL, P.SCOOP_HITS_PER_LEVEL, "E: the loss rate is unmoved (P9's number stands)");
  eq(X.DEBUG.bankSpareHullPct, P.DEBUG.bankSpareHullPct, "E: the reserve's hull gate is unmoved");
  eq(X.DEBUG.repairMilestoneHullPct, P.DEBUG.repairMilestoneHullPct, "E: the milestone hull gate is unmoved");
  eq(X.DEBUG.repairMilestoneHullPct, X.DEBUG.bankSpareHullPct,
    "E: ...and the two are still the SAME number — CS042 has one definition of 'hurt'");
  eq(X.DEBUG.cargoUnitMass, P.DEBUG.cargoUnitMass, "E: CARGO_UNIT_MASS is unmoved (FLAG-CS042-l closed as shipped)");
  eq(X.DEBUG.menuRepeatDelay, P.DEBUG.menuRepeatDelay, "E: the menu repeat delay is unmoved (G9 shipped as-is)");
  eq(X.DEBUG.menuRepeatRate, P.DEBUG.menuRepeatRate, "E: ...and the rate");

  // The behavioural half: drive the real predicate over a pose/probe grid in BOTH builds and compare.
  // Same seedless geometry either side, so any difference is the phase's and nothing else's.
  let probes = 0, same = 0;
  for (let lvl = 0; lvl <= X.SCOOP_MAX_LEVEL; lvl++) {
    for (const ang of [0, 0.7, Math.PI / 2, 2.9, 4.4]) {
      const answers = [X, P].map(G => {
        beginPlaying(G);
        const [w, h] = G.liveDims();
        placeShip(G, ang, w / 2, h / 2);
        G.game.scoopLevel = Math.min(lvl, G.SCOOP_MAX_LEVEL);
        const s = G.game.ship, ca = Math.cos(ang), sa = Math.sin(ang);
        const out = [];
        for (let f = -30; f <= 110; f += 10) {
          for (let lat = -100; lat <= 100; lat += 10) {
            out.push(G.inScoopBox({
              x: wrapC(s.x + f * ca - lat * sa, w), y: wrapC(s.y + f * sa + lat * ca, h),
            }) ? 1 : 0);
          }
        }
        return out.join("");
      });
      probes += answers[0].length;
      if (answers[0] === answers[1]) same += answers[0].length;
      eq(answers[0], answers[1],
        `E: L${lvl} at ${ang.toFixed(2)} rad — every capture answer matches the parent's`);
    }
  }
  console.log(`      ${same}/${probes} capture probes identical to the parent across 8 levels x 5 headings`);
  eq(same, probes, "E: the capture region did not move by a single probe");
}

// =====================================================================================
console.log("(F) ⛔ the mutation check — without the disarm, the HULL strokes dashed");
// =====================================================================================
{
  // The counterfactual is the one-line omission a future refactor would actually make: keep the arm,
  // lose the clear. drawPoly()'s own save()/restore() PRESERVES the dash rather than dropping it, so
  // the hull, the flame and everything after would inherit the pattern. This is what §B's ordering
  // assertion is protecting, and it is unobservable without building the broken version.
  const broken = src.replace("      if (scoopField) ctx.setLineDash([]);", "      // (disarm removed)");
  assert(broken !== src, "F: (setup) the disarm substitution actually matched the line");
  const { G, log } = drawAt(7, broken);
  const calls = dashCalls(log);
  eq(calls.length, 1, "F: the broken build arms the dash and never clears it");
  const hull = strokeIdx(log, G.COLOR.ship);
  assert(hull > calls[0][1],
    "F: ...and the hull strokes AFTER the arm with nothing between — it would render dashed");
  // The shipped build is the same draw with the clear back in, and there the hull is outside.
  const good = dashCalls(drawAt(7).log);
  assert(good.length === 2 && good[1][1] < strokeIdx(drawAt(7).log, X.COLOR.ship),
    "F: the shipped build closes the window before the hull — the fix is load-bearing");
}

// =====================================================================================
console.log("(G) standing traps");
// =====================================================================================
{
  // ⛔ The scoop block writes no globalAlpha. That channel belongs to the level-end grace pulse's
  // SET-DRAW-RESTORE (CS035 P3), which is precisely why transparency was not G4's answer and why
  // CS042 P8's level-7 tether is a colour choice. A second writer here would clobber the pulse.
  const ship = bare.split("class Ship")[1].split("class Bullet")[0];
  const scoopBlock = ship.slice(ship.indexOf("setLineDash"), ship.lastIndexOf("setLineDash"));
  assert(!/globalAlpha/.test(scoopBlock),
    "G: nothing between the arm and the disarm touches ctx.globalAlpha — the grace pulse still owns it");

  // Both grace-pulse writes still stand, unchanged, either side of the scoop block.
  eq((ship.match(/ctx\.globalAlpha = 1 - 0\.8 \* tri;/g) || []).length, 1,
    "G: the grace pulse still sets its own alpha above the scoop block");
  eq((ship.match(/if \(pulsing\) ctx\.globalAlpha = 1;/g) || []).length, 1,
    "G: ...and still restores it below, before the shield block");

  // CS025 P5's prohibition is not reopened by giving the scoop a new look.
  assert(!/magnetPulling\(\)/.test(ship),
    "G: Ship.draw() still reads no magnet state — CS025 P5's backout stands");
  eq(X.COLOR.dock, P ? P.COLOR.dock : X.COLOR.dock, "G: the mouth's colour is unmoved");

  if (!P) {
    skip(`G: ${SKIP_TAG} — the parent build is unreachable, so the version bump cannot be measured`);
  } else {
    assert(X.GAME_VERSION !== P.GAME_VERSION,
      `G: GAME_VERSION moved off the parent's "${P.GAME_VERSION}" (now "${X.GAME_VERSION}") — the closing bump`);
  }
}

report("CS042 P11 — the scoop's dashed field render (GATE C, G4)");
