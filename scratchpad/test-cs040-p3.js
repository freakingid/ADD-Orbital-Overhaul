// Headless test for CS040 P3 — health BANKING. A Health pickup the hull has no room for banks a
// WHOLE charge (worth POWERUP_HEALTH_AMOUNT) up to DEBUG.healthBankMax; beyond that the leftover HP
// is counted in game.stats.hpWasted. One charge auto-spends per damage event, at damageShip()'s
// single hull-reduction choke point. Plus the HUD pip row under the "HULL" label.
//
//   node scratchpad/test-cs040-p3.js
//
// Traps this file is written around:
//  · The bank stores WHOLE charges, never leftover HP — a pickup at 240/250 applies 10 and banks 25.
//  · ONE charge per damage event (FLAG-CS040-b). damageShip() sets s.invuln, so a second hit in the
//    same test must clear it or it early-returns and proves nothing.
//  · The spend sits BELOW damageShip()'s `s.hp <= 0` exit — a lethal hit is never rescued.
//  · "Stroke only" is asserted over the PIP ROW'S OWN ops, not a whole drawHUD() pass: the low-hull
//    glow legitimately fills later in the same function (CS038 P6's trap, in its new clothes).

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { mkAssert, buildGame } = require("./_harness.js");
const { hasKnob } = require("./test-registry.js");
const { installSeed } = require("./_seeded-random.js");
const A = mkAssert();
const { assert, eq } = A;

installSeed(20260826);

const repoRoot = path.join(__dirname, "..");

// A live run, HUD-drawable, with a fresh ctx log.
function livePlay(opts = {}) {
  const X = buildGame(opts);
  X.startGame();
  X.game.state = "playing";
  X.game.paused = false;
  return X;
}

// ================= (A) syntax + the new surface exists =================
(function sectionA() {
  console.log("(A) node --check, and the new symbols exist");
  const html = fs.readFileSync(path.join(repoRoot, "orbital-overhaul.html"), "utf8");
  const tmp = path.join(repoRoot, "scratchpad", "_cs040p3_extracted.js");
  fs.writeFileSync(tmp, html.match(/<script>([\s\S]*?)<\/script>/)[1]);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    assert(true, "A: node --check on the extracted <script>");
  } catch (e) {
    assert(false, "A: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
  const X = buildGame();
  eq(X.HEALTH_BANK_MAX, 2, "A: HEALTH_BANK_MAX is 2");
  eq(X.game.healthBank, 0, "A: game.healthBank exists on the game literal, at 0");
  eq(X.resetGameStats().hpWasted, 0, "A: game.stats.hpWasted exists, at 0");
  assert(typeof X.AudioSys.bankspend === "function", "A: AudioSys.bankspend() exists");
  eq(X.AudioSys.bankspend(), undefined, "A: ...and is headless-safe with ctx null");
})();

// ================= (B) pickup at FULL hull banks, wastes nothing =================
(function sectionB() {
  console.log("(B) a Health pickup at full hull banks a charge and wastes no HP");
  const X = livePlay();
  X.game.ship.hp = X.SHIP_MAX_HP;
  const picked = X.game.stats.healthPicked;
  X.applyPowerup("health");
  eq(X.game.ship.hp, X.SHIP_MAX_HP, "B: hull is unchanged at max");
  eq(X.game.healthBank, 1, "B: the bank gained exactly one charge");
  eq(X.game.stats.hpWasted, 0, "B: nothing was wasted");
  eq(X.game.stats.healthPicked, picked + 1, "B: healthPicked still increments, exactly once");
})();

// ================= (C) pickup at 240/250 tops up AND banks a whole charge =================
(function sectionC() {
  console.log("(C) a partial-room pickup applies the room and banks a WHOLE charge");
  const X = livePlay();
  X.game.ship.hp = X.SHIP_MAX_HP - 10;             // 240/250
  X.applyPowerup("health");
  eq(X.game.ship.hp, X.SHIP_MAX_HP, "C: hull filled to max (10 HP applied)");
  eq(X.game.healthBank, 1, "C: ...and the 15 HP remainder banked a FULL charge, not a partial one");
  eq(X.game.stats.hpWasted, 0, "C: a banked remainder is not waste");
})();

// ================= (D) at the cap, the leftover HP is wasted, not banked =================
(function sectionD() {
  console.log("(D) full hull + full bank wastes POWERUP_HEALTH_AMOUNT");
  const X = livePlay();
  X.game.ship.hp = X.SHIP_MAX_HP;
  X.game.healthBank = X.DEBUG.healthBankMax;       // 2
  X.applyPowerup("health");
  eq(X.game.healthBank, X.DEBUG.healthBankMax, "D: the bank stays at its cap");
  eq(X.game.stats.hpWasted, X.POWERUP_HEALTH_AMOUNT, "D: hpWasted took the whole pickup");
  eq(X.game.ship.hp, X.SHIP_MAX_HP, "D: hull unchanged");
  // ...and it accumulates rather than latching.
  X.applyPowerup("health");
  eq(X.game.stats.hpWasted, X.POWERUP_HEALTH_AMOUNT * 2, "D: hpWasted is cumulative");
})();

// ================= (E) ONE charge per damage event, clamped at max =================
(function sectionE() {
  console.log("(E) a damage event spends exactly one charge, and never overfills the hull");
  const X = livePlay();
  let rings = 0;
  const realSpend = X.AudioSys.bankspend;
  X.AudioSys.bankspend = function () { rings++; return realSpend.apply(this, arguments); };

  X.game.ship.hp = X.SHIP_MAX_HP;
  X.game.healthBank = 2;
  X.damageShip(80, 100, 100, "hunter3");
  eq(X.game.healthBank, 1, "E: exactly ONE charge spent on one hit — never a drain to full");
  eq(X.game.ship.hp, X.SHIP_MAX_HP - 80 + X.POWERUP_HEALTH_AMOUNT, "E: the charge is worth POWERUP_HEALTH_AMOUNT");
  eq(rings, 1, "E: AudioSys.bankspend() rang exactly once");

  // A second, separate damage event spends the second charge (clear the i-frame the first hit set —
  // without this, damageShip() early-returns and the assertion would pass vacuously).
  X.game.ship.invuln = 0;
  X.damageShip(80, 100, 100, "hunter3");
  eq(X.game.healthBank, 0, "E: the second event spends the second charge");
  eq(rings, 2, "E: ...and rings again");

  // Empty bank: a hit is an ordinary hit.
  X.game.ship.invuln = 0;
  const before = X.game.ship.hp;
  X.damageShip(20, 100, 100, "hunter3");
  eq(X.game.ship.hp, before - 20, "E: with an empty bank the hit lands in full");
  eq(rings, 2, "E: ...and nothing rang");

  // Clamp: 5 damage off a full hull, then a 25 HP charge, must land exactly at SHIP_MAX_HP.
  X.game.ship.invuln = 0;
  X.game.ship.hp = X.SHIP_MAX_HP;
  X.game.healthBank = 1;
  X.damageShip(5, 100, 100, "debris1");
  eq(X.game.ship.hp, X.SHIP_MAX_HP, "E: the auto-spend clamps at SHIP_MAX_HP");
  assert(X.game.ship.hp <= X.SHIP_MAX_HP, "E: ...and never exceeds it");

  // A LETHAL hit is not rescued — the spend sits below damageShip()'s own `s.hp <= 0` exit.
  const ringsBeforeLethal = rings;
  X.game.ship.invuln = 0;
  X.game.ship.hp = 30;
  X.game.healthBank = 2;
  X.damageShip(200, 100, 100, "hunter3");
  eq(X.game.ship.hp, 0, "E: a lethal hit still kills");
  eq(X.game.healthBank, 2, "E: ...and the reserve is untouched — a bank is a repair, not an extra life");
  eq(rings, ringsBeforeLethal, "E: ...and nothing rang");
})();

// ================= (F) reset + save/load =================
(function sectionF() {
  console.log("(F) resets clear it; it round-trips through the save envelope");
  const X = livePlay();
  X.game.healthBank = 2;
  X.game.stats.hpWasted = 75;
  X.resetRun(4, false);
  eq(X.game.healthBank, 0, "F: resetRun() clears healthBank");
  eq(X.game.stats.hpWasted, 0, "F: resetGameStats() clears hpWasted");

  X.game.healthBank = 2;
  X.game.stats.hpWasted = 50;
  const e = X.buildSaveEntry();
  eq(e.healthBank, 2, "F: buildSaveEntry() carries healthBank");
  X.game.healthBank = 0;
  X.resumeFromSave(e);
  eq(X.game.healthBank, 2, "F: ...and resumeFromSave() restores it");
  eq(X.game.stats.hpWasted, 50, "F: hpWasted rides the stats copy for free");

  // An OLD save — written before this field existed — has no key at all.
  X.game.healthBank = 2;
  X.resumeFromSave({ wave: 3, score: 1000, hp: 200, scoopLevel: 1 });
  eq(X.game.healthBank, 0, "F: a save with no healthBank key loads as 0");

  // Out-of-range values clamp to the LIVE cap, both ends.
  X.resumeFromSave({ wave: 3, hp: 200, healthBank: 99 });
  eq(X.game.healthBank, X.DEBUG.healthBankMax, "F: a too-large stored value clamps to the cap");
  X.resumeFromSave({ wave: 3, hp: 200, healthBank: -5 });
  eq(X.game.healthBank, 0, "F: a negative stored value clamps to 0");
  X.resumeFromSave({ wave: 3, hp: 200, healthBank: "two" });
  eq(X.game.healthBank, 0, "F: a non-numeric stored value falls through to the default");
})();

// ================= (G) the HUD pip row =================
(function sectionG() {
  console.log("(G) the pip row: lit count, stroke-only, and clear of the CARGO cluster");
  const log = [];
  const X = livePlay({ ctxLog: log });
  const PIP_Y = X.HUD_RING_LABEL_Y + X.HUD_BANK_PIP_DY;

  // Pair every arc with the stroke that follows it, so a wedge's own color/width/glow is recoverable.
  const strokedArcs = () => {
    const out = [];
    let pending = null;
    for (const op of log) {
      if (op[0] === "arc") pending = op;
      else if (op[0] === "stroke" && pending) {
        const st = op[op.length - 1];
        out.push({ x: pending[1], y: pending[2], r: pending[3], a0: pending[4], a1: pending[5],
                   color: st.strokeStyle, lw: st.lineWidth, blur: st.shadowBlur });
        pending = null;
      }
    }
    return out;
  };
  const bbox = list => list.reduce((b, s) => ({
    x0: Math.min(b.x0, s.x - s.r - s.lw / 2), x1: Math.max(b.x1, s.x + s.r + s.lw / 2),
    y0: Math.min(b.y0, s.y - s.r - s.lw / 2), y1: Math.max(b.y1, s.y + s.r + s.lw / 2),
  }), { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity });

  for (const bank of [0, 1, 2]) {
    X.game.healthBank = bank;
    log.length = 0;
    X.drawHUD();
    const pips = strokedArcs().filter(s => Math.abs(s.y - PIP_Y) < 0.001 && Math.abs(s.x - X.HUD_HULL_CX) < 0.001);
    eq(pips.length, X.DEBUG.healthBankMax, `G: bank ${bank} — the row always draws all ${X.DEBUG.healthBankMax} segments`);
    const lit = pips.filter(s => s.color === X.POWERUP_COLOR.health);
    eq(lit.length, bank, `G: bank ${bank} — exactly ${bank} segment(s) lit in POWERUP_COLOR.health`);
    const dim = pips.filter(s => s.color === X.COLOR.dim);
    eq(dim.length, X.DEBUG.healthBankMax - bank, `G: bank ${bank} — the rest are the dim track`);
    assert(lit.every(s => s.blur > 0), `G: bank ${bank} — lit segments go through glowStroke`);
    assert(pips.every(s => s.a1 - s.a0 < (2 * Math.PI) / X.DEBUG.healthBankMax),
      `G: bank ${bank} — every wedge is short of a full slot (HUD_RING_SEG_GAP leaves real air)`);
  }

  // STROKE ONLY — scoped to the row's own ops (drawHUD() fills elsewhere by design), taken as the
  // slice from the "HULL" label to the arc that follows the pip row.
  X.game.healthBank = 1;
  log.length = 0;
  X.drawHUD();
  const hullAt = log.findIndex(op => op[0] === "fillText" && op[1] === "HULL");
  assert(hullAt >= 0, "G: the HULL label is drawn (the anchor the pip row hangs off)");
  const after = log.slice(hullAt + 1);
  const nextForeign = after.findIndex(op => op[0] === "arc" && Math.abs(op[2] - PIP_Y) > 0.001);
  const slice = after.slice(0, nextForeign < 0 ? after.length : nextForeign);
  eq(slice.filter(op => op[0] === "arc").length, X.DEBUG.healthBankMax, "G: the slice is exactly the pip row");
  assert(!slice.some(op => ["fill", "fillRect", "fillText"].includes(op[0])), "G: ⛔ STROKE ONLY — no fill of any kind in the pip row");
  assert(!slice.some(op => op[0] === "closePath"), "G: never closePath()'d — arcs, the drawRingSegments contract");

  // Geometry, measured off the running build rather than restated from the constants.
  const all = strokedArcs();
  const pips = all.filter(s => Math.abs(s.y - PIP_Y) < 0.001 && Math.abs(s.x - X.HUD_HULL_CX) < 0.001);
  const cargo = all.filter(s => Math.abs(s.x - X.HUD_CARGO_CX) < 0.001);
  assert(cargo.length > 0, "G: the CARGO ring cluster is on screen to be measured against");
  const p = bbox(pips), c = bbox(cargo);
  assert(p.y0 > X.HUD_RING_LABEL_Y, `G: the row sits BENEATH the HULL label (${p.y0} > ${X.HUD_RING_LABEL_Y})`);
  assert(p.x1 < c.x0, `G: ⛔ its bounding box clears the CARGO ring cluster (${p.x1} < ${c.x0})`);
  assert(p.x0 >= X.HUD_HULL_CX - X.HUD_RING_R && p.x1 <= X.HUD_HULL_CX + X.HUD_RING_R,
    "G: ⛔ and stays inside the HULL ring's own footprint — not a ring outside HUD_RING_R, so the 16 px of air between the two clusters is untouched");
})();

// ================= (H) the registry knob =================
(function sectionH() {
  console.log("(H) one POWERUPS knob, def from the const, and no LEVERS entry");
  const X = buildGame();
  hasKnob(X, "healthBankMax", { def: 2, min: 0, max: 5, step: 1 }, A);
  assert(!X.LEVERS.some(l => l.id === "healthBankMax"), "H: healthBankMax is not a lever");
  // min 0 is the mechanic's off switch: nothing banks, everything overflows, the row draws nothing.
  const Y = livePlay();
  Y.DEBUG.healthBankMax = 0;
  Y.game.ship.hp = Y.SHIP_MAX_HP;
  Y.applyPowerup("health");
  eq(Y.game.healthBank, 0, "H: at healthBankMax 0 nothing banks");
  eq(Y.game.stats.hpWasted, Y.POWERUP_HEALTH_AMOUNT, "H: ...and the whole pickup is wasted instead");
})();

A.report();
