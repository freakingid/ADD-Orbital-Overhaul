// Headless test for CS018 Phase 9 — the SUPER MEGA DELIVERY: guaranteed six-type powerup set at the
// dock, the SNAPSHOT-SEMANTICS hunter sweep (PLANNED-FEATURES-CS018.md §4.2, FLAG-g, source doc
// §7.3/§7.3.1), the 48-powerup spawn ceiling, and the DEBUG.sweepCoalescePause coalescence pause.
// Covers test items 7, 8 and 9 of PLANNED-FEATURES-CS018.md §6.
//
//   node scratchpad/test-cs018-p9.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — every
// value comes out of the REAL orbital-overhaul.html source, driven through the REAL startGame() /
// superMegaDelivery() / update(), using the same build()-a-headless-instance harness as
// scratchpad/test-cs018-p1.js..p8.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) source pins: superMegaDelivery exists, snapshots via game.hunters.filter(h => !h.dead) (never
//      forEach / for...of over game.hunters), adds "health" to the sweep pool, never calls
//      dropPowerup (the weighted roll + guard gate are bypassed), SWEEP_POWERUP_CAP is a fixed 48
//      with NO debug-panel knob, and the trigger latch sits in the dock-offload block.
//  (C) §6 item 7 — pure-large board (N=10): exactly N destroyHunter credits, exactly N sweep
//      powerups (FLAG-g: all N from destroyHunter's own large-core drop, zero extra), 3N mediums
//      alive, NO medium hit, board not empty; the guaranteed set is one of EACH of the six droppable
//      types (guard included despite the empty chain — the chainGuardMinTow gate is bypassed), each
//      launched from the dock at DOCK_POWERUP_SPEED, all at normal POWERUP_DECAY float lifetime.
//  (D) §6 item 8 — mixed board (4 large + 5 medium + 7 small), tracked by OBJECT IDENTITY: every
//      dead piece was in the pre-sweep snapshot, every piece created BY the sweep is alive and
//      unpaid, the board is not empty afterwards.
//  (E) §6 item 9 — spawn ceiling: a board implying 71 powerups (5L+60S, interleaved) spawns exactly
//      48; an all-small board implying 106 spawns exactly 48; every piece still takes its hit even
//      after the powerup budget runs dry.
//  (F) sweep-payout pool: across many sweeps all SEVEN types appear (the six droppables + Health,
//      which is ambient-only everywhere else).
//  (G) coalescence pause: while game.sweepPause > 0 the REAL update() performs no merge and no
//      clump->Hunter conversion. REPOINTED BY CS024 P3: the "but decay clocks keep running" half is
//      retired with decay itself — the surviving claim is that Garbage.update() still runs during the
//      pause (it ticks the new monotonic `age`) and that the pause suspends coalescence ONLY; once
//      the pause expires the held merge + conversion goes through.
//  (H) trigger INTEGRATION: a REAL 24-piece dock visit through update()'s offload path fires the
//      sweep (seeded larges destroyed, set + per-piece payouts spawned, sweepPause armed) on top of
//      the P8 reward tiers; a 23-piece visit fires none of it.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function near(a, b, eps) { return Math.abs(a - b) <= (eps === undefined ? 1e-6 : eps); }

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p9_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ---- Headless environment for the full build (the standing stub idiom) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    detune: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
const canvasCtxNoop = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => canvasCtxNoop };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
function makeLocalStorage() {
  const store = {};
  return { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
}
const RETURN = ["game", "startGame", "update", "superMegaDelivery", "HunterSatellite", "Garbage",
  "DEBUG", "DEBUG_VARS", "DOCK_POWERUP_SPEED", "POWERUP_DECAY", "POWERUP_DROP_WEIGHTS",
  "SWEEP_POWERUP_CAP", "CARGO_CAP_MAX", "DOCK_RADIUS", "HUNTER_SCORE", "HUNTER_COALESCE_COUNT",
  "GARBAGE_MERGE_DIST"];
function build(src = scriptSrc, windowExtra) {
  const windowStub = Object.assign({ addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 }, windowExtra || {});
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, makeLocalStorage());
}

const DROPPABLE = ["rapid", "triple", "scoop", "magnet", "engine", "guard"];

// Prepare a quiet in-play board for a direct superMegaDelivery() call: real startGame, all ambient
// producers suppressed, one immortal dummy debris so the wave never clears mid-test, ship parked far
// from the origin-corner area where hunters get seeded.
function quietBoard(X) {
  X.startGame();
  X.game.state = "playing"; X.game.paused = false;
  X.game.debris.length = 1;
  X.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  X.game.hunters.length = 0; X.game.saucers.length = 0; X.game.bullets.length = 0;
  X.game.garbage.length = 0; X.game.powerups.length = 0; X.game.floaters.length = 0;
  X.game.saucerTimer = 1e6; X.game.healthTimer = 1e6; X.game.hunterTimer = 1e6;
}
function alive(X, size) { return X.game.hunters.filter(h => !h.dead && (size === undefined || h.size === size)); }
function dead(X, size) { return X.game.hunters.filter(h => h.dead && (size === undefined || h.size === size)); }
function atDock(X, p) { return p.x === X.game.dock.x && p.y === X.game.dock.y; }

// ================= (B) source pins =====================
(function sectionB() {
  console.log("(B) source pins: snapshot idiom, health pool, no dropPowerup, fixed 48, trigger latch");
  const fm = scriptSrc.match(/function superMegaDelivery\(\)\s*\{([\s\S]*?)\n\}/);
  assert(!!fm, "superMegaDelivery() exists in the build");
  const body = fm ? fm[1] : "";
  assert(body.includes("game.hunters.filter(h => !h.dead)"),
    "the sweep captures an explicit snapshot via game.hunters.filter(h => !h.dead)");
  assert(!/for\s*\(\s*const\s+\w+\s+of\s+game\.hunters\s*\)/.test(body) && !body.includes("game.hunters.forEach"),
    "the sweep iterates the snapshot, never game.hunters directly (no for...of / forEach over the live array)");
  assert(body.includes('.concat("health")'), "the sweep payout pool adds Health");
  assert(!body.includes("dropPowerup("),
    "superMegaDelivery never calls dropPowerup — POWERUP_DROP_WEIGHTS and the guard gate are bypassed");
  assert(/const SWEEP_POWERUP_CAP = 48;/.test(scriptSrc), "SWEEP_POWERUP_CAP is a fixed const 48");
  assert(/=== CARGO_CAP_MAX\) superMegaDelivery\(\);/.test(scriptSrc),
    "the trigger latch (deliveryCount === CARGO_CAP_MAX -> superMegaDelivery) sits in the dock block");

  const X = build();
  eq(X.SWEEP_POWERUP_CAP, 48, "SWEEP_POWERUP_CAP value");
  assert(!X.DEBUG_VARS.some(v => v.id && /sweep(Powerup)?Cap/i.test(v.id)),
    "the 48 ceiling is NOT exposed as a debug-panel knob");
  assert(X.DEBUG_VARS.some(v => v.id === "sweepCoalescePause"),
    "DEBUG.sweepCoalescePause (the P6 knob) is still registered");
  eq(X.DEBUG.sweepCoalescePause, 10, "sweepCoalescePause default is 10 s");
  eq(Object.keys(X.POWERUP_DROP_WEIGHTS).join(","), DROPPABLE.join(","),
    "the six droppable types (the guaranteed set's source) are unchanged");
})();

// ================= (C) §6 item 7 — pure-large board =====================
let reportBefore = 0, reportAfter = 0, reportPowerups = 0;
(function sectionC() {
  console.log("(C) item 7: 10-large board — N hits, N powerups, 3N mediums, none of them hit");
  const X = build();
  quietBoard(X);
  const N = 10;
  for (let i = 0; i < N; i++) X.game.hunters.push(new X.HunterSatellite(200 + i * 90, 300 + (i % 3) * 120, 3));
  const preLarge = X.game.hunters.slice();
  reportBefore = alive(X).length;
  eq(reportBefore, N, "board holds N=10 alive larges before the sweep");
  eq(X.game.chain.length, 0, "the chain is EMPTY at the trigger instant (the guard-gate scenario)");
  const score0 = X.game.score;
  eq(X.game.stats.hunterLineageKills, 0, "hunterLineageKills starts at 0");

  X.superMegaDelivery();

  // exactly N destroyHunter(h, true) calls — each and only each increments hunterLineageKills
  eq(X.game.stats.hunterLineageKills, N, "exactly N destroyHunter calls, all credited (awardScore=true)");
  eq(X.game.stats.largeHunterKills, N, "all N credited kills were larges");
  eq(X.game.score - score0, N * X.HUNTER_SCORE[3], "score credited exactly as if the player shot all N");
  eq(alive(X, 3).length, 0, "no large survives the sweep");
  eq(dead(X, 3).length, N, "all N larges are dead (not vanished — cleanup filter runs later)");
  eq(alive(X, 2).length, 3 * N, "3N mediums exist afterwards");
  eq(dead(X, 2).length, 0, "NO medium was hit — fragments created by the sweep take no hit");
  eq(alive(X, 1).length + dead(X, 1).length, 0, "no small exists (no medium was swept, so none split)");
  for (const h of alive(X, 2)) assert(!preLarge.includes(h), "every medium is sweep-born, not pre-existing");
  reportAfter = alive(X).length;
  eq(reportAfter, 3 * N, "board is NOT empty afterwards: 30 alive hunters");

  // powerups: 6 guaranteed + N large-core drops from inside destroyHunter, ZERO sweep extras (FLAG-g)
  reportPowerups = X.game.powerups.length;
  eq(reportPowerups, 6 + N, "total powerups = guaranteed 6 + exactly N from the sweep (16)");
  const dockPs = X.game.powerups.filter(p => atDock(X, p));
  eq(dockPs.length, 6, "exactly 6 powerups launch from the dock");
  eq(dockPs.map(p => p.type).sort().join(","), DROPPABLE.slice().sort().join(","),
    "the guaranteed set is one of EACH droppable type — guard included despite the empty chain");
  for (const p of dockPs) {
    assert(near(Math.hypot(p.vx, p.vy), X.DOCK_POWERUP_SPEED, 1e-9),
      "guaranteed powerup launches at DOCK_POWERUP_SPEED");
  }
  const sweepPs = X.game.powerups.filter(p => !atDock(X, p));
  eq(sweepPs.length, N, "exactly N powerups spawned at swept-piece positions");
  for (const p of sweepPs) {
    assert(dead(X, 3).some(h => h.x === p.x && h.y === p.y),
      "each sweep powerup sits at a swept large's position");
  }
  for (const p of X.game.powerups) eq(p.decay, X.POWERUP_DECAY, "normal float lifetime, no special casing");

  eq(X.game.sweepPause, X.DEBUG.sweepCoalescePause, "the sweep arms the coalescence pause (10 s)");
})();

// ================= (D) §6 item 8 — mixed board, identity-tracked =====================
(function sectionD() {
  console.log("(D) item 8: mixed board (4L+5M+7S) — nothing sweep-born is hit or paid");
  const X = build();
  quietBoard(X);
  for (let i = 0; i < 4; i++) X.game.hunters.push(new X.HunterSatellite(150 + i * 200, 200, 3));
  for (let i = 0; i < 5; i++) X.game.hunters.push(new X.HunterSatellite(150 + i * 160, 500, 2));
  for (let i = 0; i < 7; i++) X.game.hunters.push(new X.HunterSatellite(150 + i * 120, 800, 1));
  const pre = new Set(X.game.hunters);

  X.superMegaDelivery();

  eq(X.game.stats.hunterLineageKills, 16, "exactly 16 hits: one per snapshot member, none for fragments");
  for (const h of X.game.hunters) {
    if (h.dead) assert(pre.has(h), "every dead piece was in the pre-sweep snapshot");
    else if (!pre.has(h)) assert(!h.dead, "every sweep-born fragment is alive (took no hit)");
  }
  eq(dead(X).length, 16, "all 16 snapshot members are dead");
  eq(alive(X, 2).length, 12, "4 larges -> 12 fresh mediums");
  eq(alive(X, 1).length, 15, "5 swept mediums -> 15 fresh smalls; the 7 pre-existing smalls are gone");
  eq(dead(X, 1).length, 7, "post-sweep dead smalls = exactly the pre-existing smalls destroyed");
  eq(alive(X).length, 27, "board is NOT empty afterwards (27 alive pieces)");

  // payouts: 6 set + 4 large-core (FLAG-g) + 12 medium/small sweep spawns
  eq(X.game.powerups.length, 22, "powerups = 6 + 4 + (5+7) = 22, one per swept piece plus the set");
  const sweepPs = X.game.powerups.filter(p => !atDock(X, p));
  for (const p of sweepPs) {
    assert([...pre].some(h => h.x === p.x && h.y === p.y),
      "every non-dock powerup sits at a SNAPSHOT member's position, never at a fragment's");
  }
})();

// ================= (E) §6 item 9 — the 48 spawn ceiling =====================
(function sectionE() {
  console.log("(E) item 9: boards implying 71 and 106 powerups spawn exactly 48");
  // 5 larges interleaved among 60 smalls -> implied 6 + 5 + 60 = 71
  const X = build();
  quietBoard(X);
  for (let i = 0; i < 65; i++) {
    const size = (i % 13 === 6) ? 3 : 1;  // 5 larges at positions 6,19,32,45,58 — order must not matter
    X.game.hunters.push(new X.HunterSatellite(100 + (i % 10) * 150, 100 + Math.floor(i / 10) * 130, size));
  }
  eq(alive(X, 3).length, 5, "seeded 5 larges");
  eq(alive(X, 1).length, 60, "seeded 60 smalls");
  X.superMegaDelivery();
  eq(X.game.powerups.length, 48, "a board implying 71 powerups spawns exactly SWEEP_POWERUP_CAP (48)");
  eq(X.game.powerups.filter(p => atDock(X, p)).length, 6, "the guaranteed set is never squeezed out");
  eq(X.game.stats.hunterLineageKills, 65, "every piece STILL takes its hit after the budget runs dry");
  eq(alive(X, 2).length, 15, "the 5 larges still split into 15 mediums");

  // all-small board -> implied 6 + 100 = 106
  const Y = build();
  quietBoard(Y);
  for (let i = 0; i < 100; i++) Y.game.hunters.push(new Y.HunterSatellite(100 + (i % 10) * 150, 100 + Math.floor(i / 10) * 130, 1));
  Y.superMegaDelivery();
  eq(Y.game.powerups.length, 48, "an all-small board implying 106 powerups also spawns exactly 48");
  eq(Y.game.stats.hunterLineageKills, 100, "all 100 smalls are hit regardless");
  eq(alive(Y).length, 0, "an all-small board IS emptied — smalls have no children (not a cascade)");
})();

// ================= (F) sweep pool contains all seven types =====================
(function sectionF() {
  console.log("(F) sweep payouts draw from all SEVEN types (six droppables + Health)");
  const X = build();
  const tally = {};
  for (let s = 0; s < 15; s++) {                       // 15 sweeps x 30 small payouts = 450 flat rolls
    quietBoard(X);
    for (let i = 0; i < 30; i++) X.game.hunters.push(new X.HunterSatellite(100 + i * 70, 400, 1));
    X.superMegaDelivery();
    for (const p of X.game.powerups.filter(p => !atDock(X, p))) tally[p.type] = (tally[p.type] || 0) + 1;
  }
  for (const t of DROPPABLE.concat("health")) {
    assert((tally[t] || 0) > 0, `type "${t}" appears among sweep payouts (450 rolls; P(miss) ~ (6/7)^450)`);
  }
  assert((tally.health || 0) > 0, "Health — ambient-only everywhere else — IS in the sweep pool");
})();

// ================= (G) coalescence pause =====================
(function sectionG() {
  console.log("(G) pause: no merge/conversion while sweepPause > 0; Garbage.update still runs; resumes after");
  const X = build();
  quietBoard(X);
  X.game.wave = 21;                    // CS024 P3: the ceiling is flat now, so any level converts
  X.game.ship.x = 2000; X.game.ship.y = 1200;  // far from the seeded garbage — no scoop pickup
  X.DEBUG.sweepCoalescePause = 0.5;    // shorten the wait; the knob is the real consumer either way

  // a real (hunter-free) Super Mega Delivery arms the pause through the real path
  X.superMegaDelivery();
  eq(X.game.sweepPause, 0.5, "superMegaDelivery copies DEBUG.sweepCoalescePause into game.sweepPause");
  X.game.powerups.length = 0;          // the guaranteed set is section C's subject, not this one's

  // two 6-piece clumps co-located and active: the FIRST coalesce pass would merge them into 12
  // pieces and convert (HUNTER_COALESCE_COUNT = 12) — unless the pause holds it back.
  const mk = (x, y) => {
    const g = new X.Garbage(x, y, 0, 0);
    g.pieces = 6; g.mass = 6; g.radius = 7 * Math.sqrt(6);
    g.coalesceDelay = 0;
    return g;
  };
  const a = mk(300, 300), b = mk(300, 300);
  // REPOINTED BY CS024 P3: this used to be an `ephemeral` piece with decay 0.05, seeded to prove decay
  // clocks kept ticking through the pause (a piece aged out mid-pause). Nothing decays now, so the
  // equivalent claim — Garbage.update() is NOT suspended by the pause, only coalescence is — is read off
  // the new monotonic `age` instead. Same property, one clock later.
  const witness = mk(900, 900);
  witness.pieces = 1; witness.mass = 1; witness.radius = 7;
  X.game.garbage.push(a, b, witness);

  let mergedDuringPause = false, convertedDuringPause = false, frames = 0;
  while (X.game.sweepPause > 0 && frames < 600) {
    X.update(1 / 60); frames++;
    if (X.game.sweepPause > 0) {
      if (a.dead || b.dead || a.pieces !== 6 || b.pieces !== 6) mergedDuringPause = true;
      if (X.game.hunters.length > 0) convertedDuringPause = true;
    }
  }
  assert(!mergedDuringPause, "no merge happened while the pause was live");
  assert(!convertedDuringPause, "no clump->Hunter conversion happened while the pause was live");
  assert(!witness.dead, "nothing aged out mid-pause — nothing ages out at all any more (CS024 P3)");
  assert(witness.age > 0.4, `Garbage.update() still ran through the pause — age advanced (${witness.age.toFixed(3)}s)`);
  assert(a.age > 0.4, "the held clumps' age clocks advanced through the pause too");
  assert(frames >= 29 && frames <= 32, "the pause ran its full configured length (~0.5 s of frames)");

  for (let i = 0; i < 5; i++) X.update(1 / 60);   // pause expired — coalescence resumes
  eq(X.game.hunters.filter(h => h.size === 3).length, 1,
    "the held merge went through after the pause: 6+6 pieces converted into one large Hunter");
  eq(X.game.stats.hunterCoalesced, 1, "the conversion is the real coalescence path (stat moved)");
  assert(a.dead && b.dead, "both clumps were consumed by the post-pause merge+conversion");
})();

// ================= (H) trigger integration: a real 24-piece visit =====================
function runVisit(X, n) {
  X.startGame();
  X.game.state = "playing"; X.game.paused = false;
  X.game.cargoMax = Math.max(n, X.CARGO_CAP_MAX);
  X.game.debris.length = 1;
  X.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  X.game.hunters.length = 0; X.game.saucers.length = 0; X.game.bullets.length = 0;
  X.game.garbage.length = 0; X.game.powerups.length = 0; X.game.floaters.length = 0;
  X.game.saucerTimer = 1e6; X.game.healthTimer = 1e6; X.game.hunterTimer = 1e6;
  X.game.ship.x = X.game.dock.x + X.DOCK_RADIUS + 9; X.game.ship.y = X.game.dock.y;
  X.game.ship.vx = 0; X.game.ship.vy = 0; X.game.ship.dead = false;
  X.game.deliveryCount = 0; X.game.offloadTimer = 0;
  // two larges parked far from ship AND dock — the sweep's targets, out of contact range
  const hx = (X.game.dock.x + 1200) % 2560, hy = (X.game.dock.y + 700) % 1440;
  X.game.hunters.push(new X.HunterSatellite(hx, hy, 3), new X.HunterSatellite(hx + 80, hy, 3));
  for (let i = 0; i < n; i++) {
    X.game.chain.push({ x: X.game.dock.x, y: X.game.dock.y, px: X.game.dock.x, py: X.game.dock.y, spin: 0, spinRate: 0, mass: 1 });
  }
  // identity-capture idiom (P8): snapshot each powerup the frame it is born, before a later frame
  // can auto-collect it (the pickup loop runs at the TOP of update, ahead of the dock block).
  const seen = new Set(); const born = [];
  for (let i = 0; i < n && X.game.chain.length > 0; i++) {
    X.game.offloadTimer = 0;
    X.update(1 / 60);
    for (const p of X.game.powerups) if (!seen.has(p)) { seen.add(p); born.push({ type: p.type, x: p.x, y: p.y }); }
  }
  return born;
}
(function sectionH() {
  console.log("(H) integration: a REAL 24-piece visit triggers the SMD; a 23-piece visit does not");
  const X = build();
  const born24 = runVisit(X, 24);
  eq(X.game.deliveryCount, 24, "the visit delivered all 24 pieces");
  eq(alive(X, 3).length, 0, "no large survives the visit's sweep");
  eq(X.game.hunters.length, 6, "the swept larges are already cleanup-filtered; only fresh mediums remain");
  eq(alive(X, 2).length, 6, "the two swept larges left 6 fresh mediums");
  eq(X.game.stats.largeHunterKills, 2, "both sweep kills credited to the player");
  // 4 P8 reward tiers (8/12/16/20) + 6 guaranteed + 2 large-core drops
  eq(born24.length, 12, "powerups born across the visit = 4 tier awards + 6 set + 2 sweep");
  const dockBorn = born24.filter(p => p.x === X.game.dock.x && p.y === X.game.dock.y);
  eq(dockBorn.length, 10, "10 of them launched from the dock (4 tier + 6 set)");
  const setTypes = dockBorn.map(p => p.type);
  for (const t of DROPPABLE) assert(setTypes.includes(t), `guaranteed set delivered a "${t}" at the dock`);
  eq(X.game.sweepPause, X.DEBUG.sweepCoalescePause,
    "sweepPause is armed at full value right after the triggering frame (set AFTER that frame's gate)");

  const Y = build();
  const born23 = runVisit(Y, 23);
  eq(Y.game.deliveryCount, 23, "control visit delivered 23 pieces");
  eq(alive(Y, 3).length, 2, "23 pieces: both larges still alive — no sweep");
  eq(born23.length, 4, "23 pieces: only the four P8 tier awards, no set, no sweep payouts");
  eq(Y.game.sweepPause, 0, "23 pieces: no coalescence pause armed");
})();

// ================= summary =====================
console.log("");
console.log(`CS018 P9 headless: ${passed} passed, ${failed} failed (${passed + failed} assertions)`);
console.log(`report: 10-large board — hunters before ${reportBefore}, after ${reportAfter} (alive); powerups spawned ${reportPowerups}`);
process.exit(failed ? 1 : 0);
