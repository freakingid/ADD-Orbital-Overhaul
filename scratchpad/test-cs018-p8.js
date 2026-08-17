// Headless test for CS018 Phase 8 — delivery reward tiers: the single v3.6 P3 ===10 hub-powerup
// emitter is replaced by four independent "passes through N exactly once per visit" latches at
// game.deliveryCount === 8, 12, 16 and 20, each awarding ONE powerup (PLANNED-FEATURES-CS018.md §4.3,
// correction 1 in §2.1).
//
//   node scratchpad/test-cs018-p8.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): never reimplement the logic under test — every
// value comes out of the REAL orbital-overhaul.html source, driven through the REAL startGame() and
// the real dock-offload path inside update(), using the same build()-a-headless-instance harness as
// scratchpad/test-cs018-p1.js/p3.js/p4.js/p5.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) reward-count INTEGRATION: real per-visit deliveries of 7/8/11/12/15/16/19/20/23/24 canisters,
//      driven through the REAL update()'s dock-offload path, yield 0/1/1/2/2/3/3/4/4/4 powerups —
//      the exact cumulative table from PLANNED-FEATURES-CS018.md §4.3 (1 for 8-11, 2 for 12-15,
//      3 for 16-19, 4 for 20-23), including the seven delivery counts the phase prompt asks to be
//      reported explicitly (7, 8, 11, 12, 19, 20, 23).
//  (C) each award launches from the dock's own position on a fresh random vector at
//      DOCK_POWERUP_SPEED, exactly as the retired ===10 emitter did.
//  (D) the "SALVAGE BONUS" floater fires ONLY on the first award (delivery 8), not again at 12/16/20.
//  (E) source-level: the old single ===10 emitter is gone; the ===12 Heavy Hauler and
//      ===CARGO_CAP_MAX Maxed Out achievement latches are untouched; VoiceSys.dockDelivery's
//      5/10/15/20 voice tiers are untouched (FLAG-h — deliberately left alone this changeset).
//  (F) fewer than 8 pieces in a visit awards nothing, and no consolation drop exists.

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
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p8_extracted.js");
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
const RETURN = ["game", "startGame", "update", "DOCK_POWERUP_SPEED", "CARGO_CAP_MAX", "DOCK_RADIUS", "DEBUG"];
function build(src = scriptSrc, windowExtra) {
  const windowStub = Object.assign({ addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 }, windowExtra || {});
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + RETURN.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, makeLocalStorage());
}

// Deliver `n` canisters in one dock visit, driving the REAL dock-offload path inside update(), and
// return the powerups it emitted. cargoMax is forced well past CARGO_CAP_MAX so a visit of up to 24
// pieces is never blocked by the level-1 payload-slot curve (that curve is CS018 P5's concern, not
// this phase's) — the chain is filled directly rather than earned through play. The ship parks just
// inside the "nearDock" offload cutoff (DOCK_RADIUS+10) but outside the powerup pickup radius at
// spawn, same positioning as test-p6.js §G — but with a visit up to 24 deliveries long, an early
// powerup launched on a random vector can still wander back within the ship's pickup radius by the
// time later deliveries in the SAME visit finish, auto-collecting (and removing) it before a final
// game.powerups snapshot could see it (game.powerups is also REASSIGNED, not mutated, by update()'s
// own end-of-frame `.filter(p => !p.dead)`, so a push-spy on the array instance would silently stop
// firing after the very first frame too). Instead, every NEW object in game.powerups is captured by
// object identity right after the frame that created it — before it can move again or be picked up
// in a LATER frame, since the pickup-check loop runs at the TOP of update(), ahead of the dock-
// offload block, so a powerup can never be auto-collected in the same frame it's born.
function deliverN(X, n) {
  X.startGame();
  X.game.state = "playing"; X.game.paused = false;
  X.game.cargoMax = Math.max(n, X.CARGO_CAP_MAX);
  X.game.debris.length = 1;
  X.game.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  X.game.hunters.length = 0; X.game.saucers.length = 0; X.game.bullets.length = 0;
  X.game.garbage.length = 0; X.game.powerups.length = 0; X.game.floaters.length = 0;
  X.game.saucerTimer = 1e6; X.game.healthTimer = 1e6; X.game.hunterTimer = 1e6;
  X.game.ship.x = X.game.dock.x + X.DOCK_RADIUS + 9; X.game.ship.y = X.game.dock.y; X.game.ship.vx = 0; X.game.ship.vy = 0;
  X.game.ship.dead = false;
  X.game.deliveryCount = 0; X.game.offloadTimer = 0;

  for (let i = 0; i < n; i++) {
    X.game.chain.push({ x: X.game.dock.x, y: X.game.dock.y, px: X.game.dock.x, py: X.game.dock.y, spin: 0, spinRate: 0, mass: 1 });
  }
  const seenPowerups = new Set();
  const dropped = [];
  const seenFloaters = new Set();
  const floaters = [];
  for (let i = 0; i < n && X.game.chain.length > 0; i++) {
    X.game.offloadTimer = 0;
    X.update(1 / 60);
    for (const p of X.game.powerups) {
      if (seenPowerups.has(p)) continue;
      seenPowerups.add(p);
      dropped.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy });
    }
    // Floaters rise (FloatText.update: this.y -= 30*dt) and decay, so — same reasoning as the
    // powerups above — each one is snapshotted the frame it's born, before drift moves its y.
    for (const f of X.game.floaters) {
      if (seenFloaters.has(f)) continue;
      seenFloaters.add(f);
      floaters.push({ text: f.text, x: f.x, y: f.y });
    }
  }
  return { powerups: dropped, floaters, delivered: X.game.deliveryCount };
}

// ================= (B) reward-count INTEGRATION =====================
(function sectionB() {
  console.log("(B) reward count per visit size — the §4.3 cumulative table (1/2/3/4 at 8/12/16/20)");
  const cases = [
    // CS018 P9 repointed the [24, 4] forward-pin (this file's original "the SMD is P9's separate
    // mechanism, untouched here" claim) to its mirror image: a 24-canister visit now awards the four
    // tier powerups PLUS the Super Mega Delivery's guaranteed set.
    // REPOINTED BY CS035 P6 (spec §5.4): guard leaves the guaranteed set, 6 -> 5, so 24's total moves
    // 10 -> 9. deliverN seeds no hunters, so the SMD sweep itself pays nothing here; the sweep's own
    // accounting is test-cs018-p9.js's subject, not this file's.
    [7, 0], [8, 1], [11, 1], [12, 2], [15, 2], [16, 3], [19, 3], [20, 4], [23, 4], [24, 9],
  ];
  for (const [n, want] of cases) {
    const X = build();
    const { powerups, delivered } = deliverN(X, n);
    eq(delivered, n, `B: (setup) a ${n}-canister visit actually delivered ${n} (got ${delivered})`);
    eq(powerups.length, want, `B: a ${n}-canister visit awards ${want} powerup(s) (got ${powerups.length})`);
  }
  console.log("    reported per the phase prompt — deliveries of 7,8,11,12,19,20,23 award: " +
    [7, 8, 11, 12, 19, 20, 23].map(n => {
      const X = build();
      return deliverN(X, n).powerups.length;
    }).join(","));
})();

// ================= (C) launch position/speed =====================
// REPOINTED BY CS035 P6 (spec §5.5): DOCK_POWERUP_SPEED is now only the registry's `def` source — the
// reward-tier drop's call site reads the live DEBUG.dockPowerupSpeed knob instead.
(function sectionC() {
  console.log("(C) each award launches from the dock's position at DEBUG.dockPowerupSpeed");
  const X = build();
  const { powerups } = deliverN(X, 20);
  eq(powerups.length, 4, "C: (setup) a 20-canister visit awards 4 powerups");
  for (const p of powerups) {
    assert(near(p.x, X.game.dock.x) && near(p.y, X.game.dock.y), "C: a hub powerup launches from the dock's position");
    assert(near(Math.hypot(p.vx, p.vy), X.DEBUG.dockPowerupSpeed, 1e-6),
      `C: a hub powerup launches at DEBUG.dockPowerupSpeed (got ${Math.hypot(p.vx, p.vy).toFixed(2)})`);
  }
  // Fresh random vectors, not the same direction every time.
  const dirs = new Set(powerups.map(p => `${(p.vx).toFixed(3)},${(p.vy).toFixed(3)}`));
  assert(dirs.size > 1, "C: the four awards in one visit do not all launch on the identical vector");
})();

// ================= (D) SALVAGE BONUS floater =====================
// REPOINTED BY CS035 P1 (§1.3): the "SALVAGE BONUS" floater is deleted (ink overlap against the
// re-tuned delivery ticker) — this section now asserts it never fires, at any award count.
(function sectionD() {
  console.log('(D) no "SALVAGE BONUS" floater fires, on a 20-canister visit or a short one');
  const X = build();
  const { floaters } = deliverN(X, 20);
  eq(floaters.filter(f => f.text === "SALVAGE BONUS").length, 0, "D: a 20-canister visit shows no SALVAGE BONUS floater");

  // A visit that never reaches 8 gets no floater and no powerup.
  const Y = build();
  const short = deliverN(Y, 7);
  eq(short.powerups.length, 0, "D: a 7-canister visit awards no powerup (no consolation drop)");
  eq(short.floaters.filter(f => f.text === "SALVAGE BONUS").length, 0, "D: a 7-canister visit shows no SALVAGE BONUS floater");
})();

// ================= (E) source-level: old emitter gone, other latches untouched =====================
(function sectionE() {
  console.log("(E) source: the old ===10 emitter is gone; ===12/===CARGO_CAP_MAX latches and VoiceSys.dockDelivery untouched");
  assert(!scriptSrc.includes("game.deliveryCount === 10"), "E: the retired single ===10 emitter condition is gone from source");

  assert(scriptSrc.includes("game.deliveryCount === 12) { game.stats.fullChainVisit = true"),
    "E: the ===12 Heavy Hauler latch body is byte-unchanged");
  assert(scriptSrc.includes("game.deliveryCount === CARGO_CAP_MAX) {") && scriptSrc.includes("game.stats.maxChainVisit = true"),
    "E: the ===CARGO_CAP_MAX Maxed Out latch is present and unchanged");

  assert(scriptSrc.includes('n >= 20 ? "dock_20" : n >= 15 ? "dock_15" : n >= 10 ? "dock_10" : n >= 5 ? "dock_5" : null'),
    "E: VoiceSys.dockDelivery's 5/10/15/20 voice tiers are byte-unchanged (FLAG-h)");

  // The new latch condition itself, present exactly once.
  const latchHits = (scriptSrc.match(/game\.deliveryCount === 8 \|\| game\.deliveryCount === 12 \|\|\s*\n\s*game\.deliveryCount === 16 \|\| game\.deliveryCount === 20/g) || []).length;
  eq(latchHits, 1, `E: the new 8/12/16/20 latch condition appears exactly once (got ${latchHits})`);
})();

// ================= (F) fewer than 8 awards nothing =====================
(function sectionF() {
  console.log("(F) 1-7 piece visits award nothing, at every count");
  for (let n = 1; n <= 7; n++) {
    const X = build();
    const { powerups } = deliverN(X, n);
    eq(powerups.length, 0, `F: a ${n}-canister visit awards no powerup`);
  }
})();

// ================= summary =====================
console.log("");
console.log(`assertions run: ${passed + failed}   passed: ${passed}   failed: ${failed}`);
console.log(failed === 0 ? "RESULT: PASS" : "RESULT: FAIL");
process.exit(failed === 0 ? 0 : 1);
