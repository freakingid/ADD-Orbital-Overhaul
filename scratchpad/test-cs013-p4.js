// Headless test for CS013 Phase 4 — the auto-shield passive-regen pause (AUTO_SHIELD_REGEN_PAUSE),
// which closes the "never dies" degenerate case in CS012 P5's auto-shield by freezing passive energy
// recharge for a window after each auto-save.
//
//   node scratchpad/test-cs013-p4.js
//
// Follows the standing rule (GDD 5.4) / test-cs012-p5.js's idiom: stub window/document/rAF/navigator/
// localStorage, eval the REAL <script> block, and drive the ACTUAL damageShip / Ship.update — never
// reimplement the energy math. `game.ship.update(dt)` is called directly (not the top-level `update()`)
// to isolate ship/shield behavior from unrelated systems (spawns, chain, etc). `keys` is returned so the
// manual-shield branch (input.shield()) can be driven headlessly by setting keys["shift"] directly,
// exactly as a real held key would via kbActive/bindings.shield.
//
// Sections:
//  (A) node --check on the extracted <script>; source carries AUTO_SHIELD_REGEN_PAUSE, the
//      autoShieldRegenLock field, the arm site, the tick site, and the gated recharge site.
//  (B) Lock arms: a real auto-save sets s.autoShieldRegenLock === AUTO_SHIELD_REGEN_PAUSE.
//  (C) Regen frozen while locked; resumes once the lock elapses.
//  (D) Lock decrements by dt each frame, independent of shield state.
//  (E) Manual shield untouched (FLAG-3b): holding shield still drains via SHIELD_DRAIN normally, and a
//      manual raise still works, while the passive-regen lock is active — the lock only withholds
//      passive refill.
//  (F) Consecutive-save count: driven at the real i-frame cadence, the pool nets -0.22/cycle -> ~4 saves
//      from full before a hit lands as real damage (pre-P4 this was ~8, since +0.12 recharge used to
//      sneak in during the window). Note: a NORMAL (non-auto-saved) hit does NOT arm the lock, so once
//      the pool drops below SHIELD_HIT_COST and hits start landing for real again, passive recharge
//      resumes normally during those hits' own i-frames — by design, "a lull still lets it recover"
//      (IMPLEMENTATION-PHASES-CS013.md P4) applies to ANY gap, not just ones following a save.
//  (G) GAME_VERSION === "1.0.0.13".

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const extractScript = html => {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  if (!m) throw new Error("Could not find <script> block");
  return m[1];
};
const currentSrc = extractScript(fs.readFileSync(htmlPath, "utf8"));

const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

const RETURN = [
  "startGame", "update", "game", "damageShip", "settings", "keys", "AudioSys", "GAME_VERSION",
  "AUTO_SHIELD_REGEN_PAUSE", "SHIELD_HIT_COST", "SHIELD_RECHARGE", "SHIELD_DRAIN",
  "HIT_STUN_DURATION", "LOW_HP_THRESHOLD"
];

function buildInstance(lsStore) {
  lsStore = lsStore || {};
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720, AudioContext: undefined, webkitAudioContext: undefined
  };
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    currentSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  return factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// Same critical-hull setup idiom as test-cs012-p5.js's armShip: hazard at (150,100) => a clean -X
// knockback, deterministic, no random branch.
function armShip(A, hp) {
  const s = A.game.ship;
  s.x = 100; s.y = 100; s.vx = 0; s.vy = 0;
  s.hp = hp; s.energy = 1; s.invuln = 0; s.shieldOn = false; s.dead = false;
  s.autoShieldRegenLock = 0;
  A.keys["shift"] = false;
  A.game.floaters.length = 0;
  return s;
}

// ================= (A) syntax + additive source markers =====================
(function () {
  console.log("(A) node --check + AUTO_SHIELD_REGEN_PAUSE field/gate present in source");
  const tmp = path.join(require("os").tmpdir(), "cs013-p4-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }

  assert(/const AUTO_SHIELD_REGEN_PAUSE\s*=\s*1\.0/.test(currentSrc), "A: AUTO_SHIELD_REGEN_PAUSE = 1.0 constant present");
  assert(/this\.autoShieldRegenLock\s*=\s*0/.test(currentSrc), "A: ship init carries autoShieldRegenLock = 0");
  assert(/s\.autoShieldRegenLock\s*=\s*AUTO_SHIELD_REGEN_PAUSE/.test(currentSrc), "A: auto-shield branch arms the lock");
  assert(/if\s*\(this\.autoShieldRegenLock\s*>\s*0\)\s*this\.autoShieldRegenLock\s*-=\s*dt/.test(currentSrc), "A: lock ticks down each frame");
  assert(/if\s*\(this\.autoShieldRegenLock\s*<=\s*0\)\s*this\.energy\s*=\s*Math\.min\(1,\s*this\.energy\s*\+\s*SHIELD_RECHARGE\s*\*\s*dt\)/.test(currentSrc),
    "A: passive recharge site gated on the lock");
})();

// ================= (B) lock arms on a real auto-save =====================
(function () {
  console.log("(B) a real auto-save sets autoShieldRegenLock === AUTO_SHIELD_REGEN_PAUSE");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  const s = armShip(A, A.LOW_HP_THRESHOLD - 10);
  const dealt = A.damageShip(50, 150, 100);
  assert(dealt === false, "B: auto-save absorbed the hit (0 HP dealt)");
  assert(near(s.autoShieldRegenLock, A.AUTO_SHIELD_REGEN_PAUSE), "B: autoShieldRegenLock armed to AUTO_SHIELD_REGEN_PAUSE");
})();

// ================= (C) regen frozen while locked; resumes once it elapses =====================
(function () {
  console.log("(C) passive regen frozen while locked, resumes after the lock elapses");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  const s = armShip(A, A.LOW_HP_THRESHOLD - 10);
  A.damageShip(50, 150, 100); // arm the lock
  const energyAfterSave = s.energy;

  // Mid-window: several small-dt frames, well under the pause duration, shield held off (input.shield()
  // is false since no key is set) -> passive branch runs but stays gated, energy untouched.
  for (let i = 0; i < 10; i++) s.update(1 / 60); // 10/60s ≈ 0.167s, well under 1.0s
  assert(s.autoShieldRegenLock > 0, "C: lock still armed mid-window");
  assert(near(s.energy, energyAfterSave), "C: energy unchanged while locked (no passive recharge)");

  // One big-dt frame fully spans the rest of the window: the shield block this same frame still reads
  // the PRE-decrement (still-locked) value, so recharge stays gated on this transition frame too; the
  // lock decrements to <=0 only at the end of this call.
  s.update(A.AUTO_SHIELD_REGEN_PAUSE + 0.01);
  assert(s.autoShieldRegenLock <= 0, "C: lock has elapsed after the window passes");
  assert(near(s.energy, energyAfterSave), "C: still no recharge on the exact transition frame");

  // Next frame: lock is <=0 going in, so passive recharge now applies normally.
  const dt = 1 / 60;
  s.update(dt);
  assert(s.energy > energyAfterSave, "C: recharge resumed once the lock elapsed");
  assert(near(s.energy, energyAfterSave + A.SHIELD_RECHARGE * dt), "C: recharge amount matches SHIELD_RECHARGE*dt");
})();

// ================= (D) lock decrements by dt each frame, independent of shield state =====================
(function () {
  console.log("(D) lock decrements by dt each frame regardless of shield state");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  const s = armShip(A, A.LOW_HP_THRESHOLD - 10);
  A.damageShip(50, 150, 100); // arm the lock

  const dt = 1 / 60;
  const before1 = s.autoShieldRegenLock;
  A.keys["shift"] = false; // shield NOT held
  s.update(dt);
  assert(near(s.autoShieldRegenLock, before1 - dt), "D: lock decremented by dt with shield not held");

  const before2 = s.autoShieldRegenLock;
  A.keys["shift"] = true; // shield HELD (manual)
  s.update(dt);
  assert(near(s.autoShieldRegenLock, before2 - dt), "D: lock decremented by dt with shield actively held");
  A.keys["shift"] = false;
})();

// ================= (E) manual shield untouched (FLAG-3b) =====================
(function () {
  console.log("(E) manual shield drains/raises normally while the passive-regen lock is active");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  const s = armShip(A, A.LOW_HP_THRESHOLD - 10);
  A.damageShip(50, 150, 100); // arm the lock
  assert(s.autoShieldRegenLock > 0, "E: lock is armed going into this check");

  const dt = 1 / 60;
  const energyBefore = s.energy;
  A.keys["shift"] = true; // player holds shield manually
  s.update(dt);
  assert(s.shieldOn === true, "E: manually holding shield raises it (lock does not block the manual branch)");
  assert(near(s.energy, energyBefore - A.SHIELD_DRAIN * dt), "E: manual hold drains SHIELD_DRAIN*dt normally, lock or not");
  A.keys["shift"] = false;
})();

// ================= (F) consecutive-save count nets -0.22/cycle, ~4 saves, stays drained =====================
(function () {
  console.log("(F) i-frame-cadence saves net -0.22/cycle: ~4 saves from full, then drained under sustained fire");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  const s = armShip(A, A.LOW_HP_THRESHOLD - 10);

  let saves = 0, landed = false;
  for (let cycle = 0; cycle < 20; cycle++) {
    s.hp = A.LOW_HP_THRESHOLD - 10; // keep the hull critical between cycles
    const energyBefore = s.energy;
    const dealt = A.damageShip(30, 150, 100);
    if (dealt === false && near(s.energy, energyBefore - A.SHIELD_HIT_COST)) {
      saves++;
      // Let exactly one full i-frame/regen-pause window elapse (single big-dt frame, same technique as
      // section C) before the next hit is even eligible (s.invuln <= 0) — the real per-hit cadence.
      s.update(A.HIT_STUN_DURATION + 0.01);
    } else if (dealt === true) {
      landed = true; // energy ran out -> a hit finally lands as real damage
      break;
    } else {
      failed++; console.error("  FAIL: F: unexpected damageShip outcome mid-loop (dealt=" + dealt + ")");
      break;
    }
  }
  assert(saves === 4, "F: exactly 4 saves from a full pool at the real i-frame cadence (got " + saves + "; pre-P4 this was ~8)");
  assert(landed, "F: the 5th hit lands as real damage once energy < SHIELD_HIT_COST (below the pre-P4 ~8)");
  assert(s.energy < A.SHIELD_HIT_COST, "F: the pool sits below SHIELD_HIT_COST at the point it lands as real damage");
})();

// ================= (G) version bump =====================
(function () {
  console.log("(G) GAME_VERSION === \"1.0.0.13\"");
  const A = buildInstance();
  assert(A.GAME_VERSION === "1.0.0.13", "G: GAME_VERSION is exactly \"1.0.0.13\"");
})();

// ================= headless no-crash smoke =====================
(function () {
  console.log("(smoke) startGame() + update(1/60) with AudioSys.ctx null never throws");
  const A = buildInstance();
  assert(A.AudioSys.ctx == null, "smoke: AudioSys.ctx is null (headless)");
  try { A.startGame(); for (let i = 0; i < 5; i++) A.update(1 / 60); passed++; }
  catch (e) { failed++; console.error("  FAIL: headless update threw: " + e.stack); }
})();

console.log(`\nCS013 P4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
