// Headless test for CS009 Phase 4 — powerup rings (dual-mode rows, overcharge halo, low-timer warning).
// FORK-3 A (overcharge halo) + FORK-5 (count-mode: track only, no arc).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL startGame()/drawHUD() — no reimplementation.
//
//   node scratchpad/test-cs009-p4.js
//
// A recording 2D ctx logs arc()/stroke() with the style state active at each stroke, so every ring
// arc drawn by drawHUD() (the dim track, the value arc, the overcharge halo) can be reconstructed by
// center, radius, sweep angle, color and width.
//
// REPOINTED THROUGHOUT BY CS024 P6 (spec §1.7/§3.4). This file's whole subject — the ring denominator,
// the overcharge halo, the count-mode row shape and the low-timer warning — is what that phase changed.
// Every claim below is repointed to its successor or INVERTED to its mirror image, never dropped:
// timed expiry is gone, so the denominator is now powerBudgetAmount(t) (a per-type BUDGET, two of the
// five live debug knobs) rather than powerDuration(t), and there is no second (count) row shape left to
// differ from — which is why (C) inverts and (E) inverts.
//
// Checks (per the phase prompt, as repointed):
//  (A) TRAP 1 (REPOINTED) — with game.powerBudget.magnet = MAGNET_PIECES (40), the magnet VALUE arc
//      sweeps a FULL turn, not more and not less: the denominator must be powerBudgetAmount("magnet"),
//      not another type's budget and not a literal. Engine's denominator is a LIVE knob and is checked
//      the same way (its budget is fractional seconds of fuel, not an integer count).
//  (B) TRAP 2 / FORK-3 A (REPOINTED) — with powerBudget.rapid = 80 (double-banked vs a 40-shot
//      denominator, frac=2.0), a main value arc pinned at a full turn AND a second arc at the halo
//      radius (HUD_FX_RING_R + 4) are BOTH drawn. Banking survives; only the unit changed.
//  (C) FORK-5 INVERTED — a budgeted row now DOES draw a value arc. FORK-5's "count mode has no
//      denominator, so it has no value arc" was true only while a second, timed shape existed to keep
//      the row shape constant against; every row is budgeted now and every one has a real denominator.
//  (D) drawHUD() makes ZERO ctx.fillRect and ZERO ctx.strokeRect calls (the whole point of the rebuild).
//  (E) FLAG-E INVERTED — NO row ever state-colors. HUD_FX_LOW is deleted; a low budget was never a
//      deadline, and now every row is a budget, so the lowhp coloring is gone for every type.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Recording 2D context ----
const recLog = [];
function makeRecordingCtx() {
  const state = {};
  const methods = ["arc", "stroke", "save", "restore", "translate", "rotate", "moveTo", "lineTo",
                   "closePath", "beginPath", "fillText", "fillRect", "strokeRect", "fill"];
  return new Proxy(state, {
    get(t, p) {
      if (p === "log") return recLog;
      if (methods.includes(p)) return (...args) => recLog.push([p, ...args]);
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) {
      t[p] = v;
      if (p === "strokeStyle" || p === "lineWidth" || p === "globalAlpha") recLog.push([p, v]);
      return true;
    }
  });
}
const recCtx = makeRecordingCtx();
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

// ---- Audio + env stubs (mirror test-cs009-p2) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; }
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
const windowStub = {
  addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
let perfNow = 0;                              // controllable clock (pulse alpha depends on it)
const performanceStub = { now: () => perfNow };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "drawHUD", "game", "settings", "AudioSys", "clamp01", "TAU", "COLOR",
  "POWERUP_COLOR", "POWERUP_BUDGET", "powerBudgetAmount", "DEBUG",
  "HUD_FX_BASE_Y", "HUD_FX_ROW_H", "HUD_FX_RING_R", "HUD_RING_TRACK_W",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }' 
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, drawHUD, game, settings, AudioSys, clamp01, TAU, COLOR,
  POWERUP_COLOR, POWERUP_BUDGET, powerBudgetAmount, DEBUG,
  HUD_FX_BASE_Y, HUD_FX_ROW_H, HUD_FX_RING_R, HUD_RING_TRACK_W, probe
} = A;
// CS024 P6: the two duration constants and the low-timer threshold are DELETED, not merely unread.
// Probed positively here so a silent restoration fails this file rather than passing unnoticed.
for (const dead of ["POWERUP_DURATION", "MAGNET_DURATION", "HUD_FX_LOW", "powerDuration", "powerMode"])
  if (probe(dead) !== "__ReferenceError__") { console.error("  FAIL: CS024 P6 — " + dead + " still exists"); process.exitCode = 1; }

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

AudioSys.init();

// Reconstruct arc strokes (+ fill/stroke-rect counts) from a fresh drawHUD() pass.
function captureHUD() {
  recLog.length = 0;
  recCtx.globalAlpha = 1;              // draw() would have left it at 1; start clean
  drawHUD();
  let strokeStyle = null, lineWidth = null, alpha = 1;
  let pendingArc = null, isPoly = false;
  const arcs = [];
  let fillRectCount = 0, strokeRectCount = 0;
  for (const e of recLog) {
    switch (e[0]) {
      case "globalAlpha": alpha = e[1]; break;
      case "strokeStyle": strokeStyle = e[1]; break;
      case "lineWidth": lineWidth = e[1]; break;
      case "beginPath": pendingArc = null; isPoly = false; break;
      case "arc": pendingArc = { x: e[1], y: e[2], r: e[3], a0: e[4], a1: e[5] }; break;
      case "moveTo": case "lineTo": isPoly = true; break;
      case "fillRect": fillRectCount++; break;
      case "strokeRect": strokeRectCount++; break;
      case "stroke":
        if (pendingArc) arcs.push({ ...pendingArc, color: strokeStyle, width: lineWidth, alpha,
          sweep: pendingArc.a1 - pendingArc.a0 });
        pendingArc = null; isPoly = false;
        break;
    }
  }
  return { arcs, fillRectCount, strokeRectCount };
}

// Reset settings + all effect state, then start a run in "playing".
function fresh() {
  startGame();
  game.state = "playing"; game.paused = false;
  game.powerups = [];
  // CS024 P6: one state bag now — game.powerFx is deleted, and `engine` joins powerBudget.
  game.powerBudget = { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 };
}

// CS012 P2: rows are FIXED by index in POWERUP_DROP_TYPES (["rapid","triple","magnet","engine"]),
// never compacted — row i sits at HUD_FX_BASE_Y - (i+1)*HUD_FX_ROW_H regardless of which other types
// are active/inactive. ROW1_Y (rapid, index 0) happens to match the old "first active slot" value;
// MAGNET_Y (index 2) does not, since magnet is no longer compacted down to slot 1 when it's the only
// active effect.
const ROW1_Y = HUD_FX_BASE_Y - 1 * HUD_FX_ROW_H;
const MAGNET_Y = HUD_FX_BASE_Y - 3 * HUD_FX_ROW_H;
// arcs centered on a powerup ring column (x = 40), by radius
const atRow = (arcs, y, r) => arcs.filter(a => near(a.x, 40) && near(a.y, y) && near(a.r, r));

// ========== (A) TRAP 1 REPOINTED — the denominator is powerBudgetAmount(t), per type ==========
(function sectionA() {
  perfNow = 5000;
  fresh();
  game.powerBudget.magnet = POWERUP_BUDGET.magnet;   // one full pickup's grant -> frac must be exactly 1.0
  const { arcs } = captureHUD();

  // magnet's row is FIXED at its POWERUP_DROP_TYPES index (2), active or not (CS012 P2)
  const value = atRow(arcs, MAGNET_Y, HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.magnet);
  assert(!!value, "A: magnet value arc drawn in POWERUP_COLOR.magnet");
  assert(value && near(value.sweep, TAU),
    `A: magnet arc sweeps a FULL turn at a full budget (denominator = powerBudgetAmount("magnet") = ${powerBudgetAmount("magnet")}) — got sweep ${value && value.sweep} (expected ${TAU})`);
  // guard: a wrong denominator would over- or under-sweep. Triple's 30 would give 1.33 turns here.
  assert(value && Math.abs(value.sweep) <= TAU + 1e-6,
    "A: magnet arc does NOT overshoot a full turn (would mean a SMALLER type's budget was used as the denominator)");
  // sanity: the dim track is still there at the same radius
  const track = atRow(arcs, MAGNET_Y, HUD_FX_RING_R).find(a => a.color === COLOR.dim && near(Math.abs(a.sweep), TAU));
  assert(!!track, "A: dim full-circle track drawn under the magnet ring");

  // THE DENOMINATOR GENUINELY DIFFERS BY TYPE, and two of the five are LIVE KNOBS. Triple (30) at a
  // budget of 15 must be a HALF turn — which it can only be if the row read its OWN denominator.
  fresh();
  game.powerBudget.triple = POWERUP_BUDGET.triple / 2;
  const tripleY = HUD_FX_BASE_Y - 2 * HUD_FX_ROW_H;
  const tArc = atRow(captureHUD().arcs, tripleY, HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.triple);
  assert(tArc && near(tArc.sweep, TAU * 0.5),
    `A: triple's arc reads ITS OWN denominator (30) — half budget = half turn, got ${tArc && tArc.sweep}`);

  // ENGINE: its budget is fractional SECONDS of fuel and its denominator is the live DEBUG knob, so a
  // retune must move the ring. Half a tank is half a turn at 5 s AND at a retuned 12 s.
  const engineY = HUD_FX_BASE_Y - 4 * HUD_FX_ROW_H;
  for (const tank of [5, 12]) {
    fresh();
    DEBUG.engineBurnSeconds = tank;
    game.powerBudget.engine = tank / 2;
    const eArc = atRow(captureHUD().arcs, engineY, HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.engine);
    assert(eArc && near(eArc.sweep, TAU * 0.5),
      `A: engine's arc tracks the LIVE DEBUG.engineBurnSeconds denominator (${tank} s) — got ${eArc && eArc.sweep}`);
  }
  DEBUG.engineBurnSeconds = 10;   // REPOINTED BY CS024 P7 — restore the SHIPPED default (Gate B Q11: 5.0 -> 10.0)
})();

// ================= (B) TRAP 2 / FORK-3 A — double-banked -> main arc full + halo =================
(function sectionB() {
  perfNow = 5000;
  fresh();
  game.powerBudget.rapid = 2 * POWERUP_BUDGET.rapid;   // 80 shots vs a 40-shot denominator -> frac = 2.0
  const { arcs } = captureHUD();

  const main = atRow(arcs, ROW1_Y, HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR.rapid);
  assert(!!main, "B: rapid main value arc drawn");
  assert(main && near(main.sweep, TAU), `B: main arc pinned at a FULL turn (clamp01 of frac=2) — got ${main && main.sweep}`);

  const halo = atRow(arcs, ROW1_Y, HUD_FX_RING_R + 4).find(a => a.color === POWERUP_COLOR.rapid);
  assert(!!halo, "B: overcharge halo arc drawn at HUD_FX_RING_R + 4");
  assert(halo && near(halo.sweep, TAU), `B: halo shows clamp01(frac-1)=1.0 -> full turn — got ${halo && halo.sweep}`);
  // a partially-banked case: frac = 1.5 -> halo sweeps a HALF turn
  fresh();
  game.powerBudget.rapid = 1.5 * POWERUP_BUDGET.rapid;
  const { arcs: arcs2 } = captureHUD();
  const halo2 = atRow(arcs2, ROW1_Y, HUD_FX_RING_R + 4).find(a => a.color === POWERUP_COLOR.rapid);
  assert(halo2 && near(halo2.sweep, TAU * 0.5), `B: halo sweep tracks frac-1 (1.5->0.5 turn) — got ${halo2 && halo2.sweep}`);

  // and a NON-overcharged case (frac < 1) draws NO halo
  fresh();
  game.powerBudget.rapid = 0.5 * POWERUP_BUDGET.rapid;
  const { arcs: arcs3 } = captureHUD();
  const halo3 = atRow(arcs3, ROW1_Y, HUD_FX_RING_R + 4);
  assert(halo3.length === 0, "B: no halo arc when frac <= 1");
})();

// ====== (C) FORK-5 INVERTED BY CS024 P6 — a budgeted row DOES draw a value arc now ======
(function sectionC() {
  perfNow = 5000;
  fresh();
  // FORK-5's original claim was "count mode has no denominator, so it has no value arc — only the dim
  // track, so the row's SHAPE is identical across modes." Both halves of that are now false: there IS a
  // denominator (powerBudgetAmount) and there is no second mode to keep the shape constant against.
  // Inverted rather than deleted, per the standing convention — a silently-arc-less row would otherwise
  // read as "the ring works" while showing nothing.
  game.powerBudget.magnet = 20;                // half of the 40-piece grant
  const { arcs } = captureHUD();

  const rowArcs = atRow(arcs, MAGNET_Y, HUD_FX_RING_R);
  const track = rowArcs.find(a => a.color === COLOR.dim && near(Math.abs(a.sweep), TAU));
  assert(!!track, "C: dim full-circle track still drawn under the row");
  const valueArc = rowArcs.find(a => a.color === POWERUP_COLOR.magnet);
  assert(!!valueArc, "C: INVERTED — a budgeted row DOES draw its value arc (it has a real denominator now)");
  assert(valueArc && near(valueArc.sweep, TAU * 0.5), `C: ...and it reads 20/40 = a half turn — got ${valueArc && valueArc.sweep}`);
  // no overcharge halo below a full budget, unchanged
  const halo = atRow(arcs, MAGNET_Y, HUD_FX_RING_R + 4);
  assert(halo.length === 0, "C: no overcharge halo below a full budget");
})();

// ================= (D) zero fillRect / zero strokeRect anywhere in drawHUD() =================
(function sectionD() {
  perfNow = 5000;
  fresh();
  // exercise several rows at once (time + a low-timer + count) so the whole powerup path runs
  game.powerBudget.rapid = 8;                   // partial
  game.powerBudget.triple = 2;                  // nearly spent
  game.powerBudget.engine = 12.5;               // overcharged (banked past the 5 s grant)
  game.powerBudget.magnet = 25;                 // partial
  game.scoopLevel = 3;                          // SCOOP segmented ring draws too (strokes only, no fills)
  const { fillRectCount, strokeRectCount } = captureHUD();
  assert(fillRectCount === 0, `D: drawHUD() makes ZERO fillRect calls (got ${fillRectCount})`);
  assert(strokeRectCount === 0, `D: drawHUD() makes ZERO strokeRect calls (got ${strokeRectCount})`);
})();

// ========== (E) FLAG-E INVERTED BY CS024 P6 — NO row ever state-colors ==========
(function sectionE() {
  perfNow = 5000;
  // FLAG-E's rule survives; its SCOPE swallowed the other half. "A low timer is a deadline; a budget of
  // 2 shots is not" — with no timers left, nothing is a deadline, so no row is ever COLOR.lowhp. The
  // old time-mode half of this section is inverted, not deleted: it is the assertion that catches a
  // low-warning creeping back in on a quantity that is not a deadline.
  const rowY = { rapid: ROW1_Y, engine: HUD_FX_BASE_Y - 4 * HUD_FX_ROW_H };
  for (const [t, budget] of [["rapid", 2], ["rapid", 1], ["engine", 0.2], ["engine", 2]]) {
    fresh();
    game.powerBudget[t] = budget;
    const arcs = captureHUD().arcs;
    const lowArc = atRow(arcs, rowY[t], HUD_FX_RING_R).find(a => a.color === COLOR.lowhp);
    assert(!lowArc, `E: INVERTED — ${t} at a budget of ${budget} is NOT low-colored (no deadline exists any more)`);
    const value = atRow(arcs, rowY[t], HUD_FX_RING_R).find(a => a.color === POWERUP_COLOR[t]);
    assert(!!value, `E: ...and it still draws its own-hue value arc at ${budget}`);
    const track = atRow(arcs, rowY[t], HUD_FX_RING_R).find(a => a.color === COLOR.dim);
    assert(!!track, `E: ...over its dim track`);
  }
})();

// ================= (F) CS012 P2: fixed rows — a row NEVER moves when other rows (de)activate =================
(function sectionF() {
  perfNow = 5000;
  // rapid (index 0) and magnet (index 2) both active — each at its OWN fixed row, with the inactive
  // triple (index 1) row's y left as a gap, not collapsed.
  fresh();
  game.powerBudget.rapid = 10;
  game.powerBudget.magnet = 10;
  const { arcs } = captureHUD();
  const rapidY = HUD_FX_BASE_Y - 1 * HUD_FX_ROW_H;
  const rapidArc = arcs.find(a => near(a.x, 40) && near(a.y, rapidY) && a.color === POWERUP_COLOR.rapid);
  const magnetArc = arcs.find(a => near(a.x, 40) && near(a.y, MAGNET_Y) && a.color === POWERUP_COLOR.magnet);
  assert(!!rapidArc, "F: rapid (index 0) sits at its fixed row (y = BASE - 1*ROW_H)");
  assert(!!magnetArc, "F: magnet (index 2) sits at its fixed row (y = BASE - 3*ROW_H)");

  // Now expire rapid: magnet MUST NOT move — no compaction, ever (the point of CS012 P2).
  fresh();
  game.powerBudget.magnet = 10;                 // only magnet active now
  const { arcs: arcs2 } = captureHUD();
  const magnetArc2 = arcs2.find(a => near(a.x, 40) && near(a.y, MAGNET_Y) && a.color === POWERUP_COLOR.magnet);
  const magnetAtRapidSlot = arcs2.find(a => near(a.x, 40) && near(a.y, rapidY) && a.color === POWERUP_COLOR.magnet);
  assert(!!magnetArc2, "F: with rapid gone, magnet STAYS at its own fixed row (y = BASE - 3*ROW_H)");
  assert(!magnetAtRapidSlot, "F: magnet does NOT compact down into rapid's row");

  // and rapid's now-inactive row still renders (dim, muted) at its fixed y, not removed
  const rapidTrack = arcs2.find(a => near(a.x, 40) && near(a.y, rapidY) && a.color === COLOR.dim && near(Math.abs(a.sweep), TAU));
  assert(!!rapidTrack, "F: rapid's row still renders its dim track when inactive (muted, not hidden)");
})();

// ---------------------------------------------------------------------------
console.log(`\ntest-cs009-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
