// Headless test for CS012 Phase 5 — the Auto-shield difficulty option (reactive last-resort save at
// critical hull) + its Difficulty-menu row.
//
//   node scratchpad/test-cs012-p5.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL damageShip / saveSettings / loadSettings / menuDifficulty — never
// reimplement game logic. The load-bearing part is the damageShip hook: its knockback+stun is what
// rate-limits the auto-save to ~one per HIT_STUN_DURATION; without it a hazard sitting on the ship would
// drain energy + score every frame. Sections:
//  (A) node --check on the extracted <script>; source carries the additive autoShield field + the
//      "autoshield" DIFFICULTY_ROWS entry.
//  (B) autoShield OFF: a critical-hull hit deals full HP damage (baseline unchanged — no energy/score touched).
//  (C) autoShield ON at critical hull with energy: hit deals 0 HP, returns false, spends SHIELD_HIT_COST,
//      sets shieldOn + invuln = HIT_STUN_DURATION, applies KNOCKBACK_SPEED velocity away from the hazard,
//      subtracts AUTO_SHIELD_SCORE_PENALTY (clamped >= 0) WITHOUT touching game.nextRepair, pushes a "-500" floater.
//  (D) Rate-limit: a second hit the SAME frame is a shieldOn no-op; with invuln active (i-frame), a hit is
//      absorbed with NO extra auto-save (no energy/score/floater change).
//  (E) Energy self-limit: back-to-back saves exhaust energy (recharge 0.12/s < cost 0.22/save); once
//      energy < SHIELD_HIT_COST, hits land normally again.
//  (F) autoShield ON but hull ABOVE the threshold => normal full damage (no auto-save). Dead ship => no auto-save.
//  (G) Persistence: autoShield round-trips through afd_settings_v1 (save -> load); missing/non-boolean => false; default false.
//  (H) DIFFICULTY_ROWS includes "autoshield"; menuDifficulty toggles it both directions and saves each time.

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
  "startGame", "update", "game", "damageShip", "settings", "saveSettings", "loadSettings",
  "menuDifficulty", "DIFFICULTY_ROWS", "AudioSys", "STORAGE_KEY",
  "LOW_HP_THRESHOLD", "SHIELD_HIT_COST", "SHIELD_RECHARGE", "HIT_STUN_DURATION", "KNOCKBACK_SPEED",
  "AUTO_SHIELD_SCORE_PENALTY", "SHIP_MAX_HP"
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
  const inst = factory(windowStub, documentStub, { now: () => Date.now() }, () => 0, { getGamepads: () => [] }, localStorageStub);
  inst._lsStore = lsStore;
  return inst;
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// Put a ship in a known "critical hull, ready to be hit" state at (100,100). Hazard at (150,100) means
// shortDelta(src->ship) = (-50,0): knockback is a clean -X shove (deterministic, no random branch).
function armShip(A, hp) {
  const s = A.game.ship;
  s.x = 100; s.y = 100; s.vx = 0; s.vy = 0;
  s.hp = hp; s.energy = 1; s.invuln = 0; s.shieldOn = false; s.dead = false;
  A.game.floaters.length = 0;
  return s;
}

// ================= (A) syntax + additive source markers =====================
(function () {
  console.log("(A) node --check + autoShield field / autoshield row present in source");
  const tmp = path.join(require("os").tmpdir(), "cs012-p5-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }

  assert(/autoShield:\s*false/.test(currentSrc), "A: settings literal carries autoShield: false (default off)");
  assert(/autoShield:\s*settings\.autoShield/.test(currentSrc), "A: saveSettings writes autoShield");
  assert(/typeof\s+data\.autoShield\s*===\s*"boolean"/.test(currentSrc), "A: loadSettings guards autoShield as a boolean");
  assert(/DIFFICULTY_ROWS\s*=\s*\[[^\]]*"autoshield"/.test(currentSrc), "A: DIFFICULTY_ROWS includes \"autoshield\"");
})();

// ================= (B) autoShield OFF => full damage, nothing else touched =====================
(function () {
  console.log("(B) autoShield OFF: critical-hull hit deals full HP damage (baseline)");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = false;
  const s = armShip(A, A.LOW_HP_THRESHOLD); // exactly at the threshold — the hook's hp<=THRESHOLD would qualify
  const score0 = A.game.score = 3000;
  const dealt = A.damageShip(50, 150, 100);
  assert(dealt === true, "B: damageShip returns true (real damage dealt)");
  assert(near(s.hp, A.LOW_HP_THRESHOLD - 50), "B: hp dropped by the full amount");
  assert(near(s.energy, 1), "B: energy untouched (no shield spent)");
  assert(A.game.score === score0, "B: score untouched");
})();

// ================= (C) autoShield ON at critical hull => 0 HP, energy+score+stun+knockback+tell =====================
(function () {
  console.log("(C) autoShield ON: 0-HP save with energy/score/stun/knockback/floater");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  const s = armShip(A, A.LOW_HP_THRESHOLD - 10); // below threshold
  A.game.score = 2000;
  const nextRepair0 = A.game.nextRepair;
  const dealt = A.damageShip(50, 150, 100);
  assert(dealt === false, "C: damageShip returns false (0 HP dealt — shielded contract)");
  assert(near(s.hp, A.LOW_HP_THRESHOLD - 10), "C: hp UNCHANGED (hit fully absorbed)");
  assert(near(s.energy, 1 - A.SHIELD_HIT_COST), "C: spent exactly SHIELD_HIT_COST energy");
  assert(s.shieldOn === true, "C: shieldOn raised");
  assert(near(s.invuln, A.HIT_STUN_DURATION), "C: invuln = HIT_STUN_DURATION (the rate-limiter)");
  assert(near(Math.hypot(s.vx, s.vy), A.KNOCKBACK_SPEED, 1e-4), "C: knockback speed = KNOCKBACK_SPEED");
  assert(s.vx < 0 && near(s.vy, 0, 1e-4), "C: knockback shoves AWAY from the hazard (-X)");
  assert(A.game.score === 2000 - A.AUTO_SHIELD_SCORE_PENALTY, "C: score reduced by AUTO_SHIELD_SCORE_PENALTY");
  assert(A.game.nextRepair === nextRepair0, "C: game.nextRepair NOT touched (addScore bypassed — FLAG-4e)");
  const f = A.game.floaters[A.game.floaters.length - 1];
  assert(f && f.text === "-" + A.AUTO_SHIELD_SCORE_PENALTY, "C: a \"-500\" floater was pushed");

  // score clamp: a save while score < penalty floors at 0, never negative.
  const B = buildInstance(); B.startGame(); B.settings.autoShield = true;
  armShip(B, B.LOW_HP_THRESHOLD - 10); B.game.score = 100;
  B.damageShip(50, 150, 100);
  assert(B.game.score === 0, "C: score clamps at 0 (never goes negative)");
})();

// ================= (D) rate-limit: same-frame no-op + i-frame absorption =====================
(function () {
  console.log("(D) rate-limit: second same-frame hit is a shieldOn no-op; i-frame absorbs without re-saving");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  const s = armShip(A, A.LOW_HP_THRESHOLD - 10);
  A.game.score = 5000;
  A.damageShip(50, 150, 100); // save #1
  const energyAfter1 = s.energy, scoreAfter1 = A.game.score, floatersAfter1 = A.game.floaters.length;
  // second hit SAME frame: shieldOn is true => early-return, no second save
  const d2 = A.damageShip(50, 150, 100);
  assert(d2 === false, "D: second same-frame hit returns false");
  assert(near(s.energy, energyAfter1), "D: no additional energy spent (no second save)");
  assert(A.game.score === scoreAfter1, "D: no additional score penalty");
  assert(A.game.floaters.length === floatersAfter1, "D: no second floater");
  assert(near(s.hp, A.LOW_HP_THRESHOLD - 10), "D: hp still unchanged");

  // i-frame active (shieldOn cleared, invuln > 0, hull still critical): hit absorbed, still NO auto-save.
  s.shieldOn = false; s.invuln = 0.5;
  const eBefore = s.energy, scoreBefore = A.game.score, fBefore = A.game.floaters.length;
  const d3 = A.damageShip(50, 150, 100);
  assert(d3 === false, "D: i-frame hit returns false (absorbed)");
  assert(near(s.energy, eBefore) && A.game.score === scoreBefore && A.game.floaters.length === fBefore,
    "D: i-frame hit triggers NO auto-save (energy/score/floater unchanged)");
})();

// ================= (E) energy self-limit =====================
(function () {
  console.log("(E) energy self-limit: back-to-back saves exhaust energy, then hits land");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  assert(A.SHIELD_RECHARGE < A.SHIELD_HIT_COST, "E: recharge/s < cost/save (drain is inevitable)");
  const s = armShip(A, A.LOW_HP_THRESHOLD - 10);
  let saves = 0, landed = false;
  for (let i = 0; i < 20; i++) {
    s.shieldOn = false; s.invuln = 0; s.hp = A.LOW_HP_THRESHOLD - 10; // simulate the i-frame lapsing, hull still critical
    const hpBefore = s.hp, dealt = A.damageShip(30, 150, 100);
    if (dealt === false && near(s.hp, hpBefore)) saves++;         // absorbed (auto-save)
    else if (dealt === true && s.hp < hpBefore) { landed = true; break; } // energy ran out -> real damage
  }
  assert(saves >= 4 && saves <= 5, "E: ~4-5 saves before energy < cost (got " + saves + ")");
  assert(landed, "E: once energy < SHIELD_HIT_COST, a hit lands as real damage");
})();

// ================= (F) above threshold + dead ship => no auto-save =====================
(function () {
  console.log("(F) hull above threshold => normal damage; dead ship => no auto-save");
  const A = buildInstance();
  A.startGame();
  A.settings.autoShield = true;
  // Above the threshold: normal full damage, no save.
  const s = armShip(A, A.LOW_HP_THRESHOLD + 1);
  A.game.score = 4000;
  const dealt = A.damageShip(50, 150, 100);
  assert(dealt === true, "F: above-threshold hit returns true (real damage)");
  assert(near(s.hp, A.LOW_HP_THRESHOLD + 1 - 50), "F: full HP damage taken above threshold");
  assert(near(s.energy, 1), "F: no energy spent above threshold");
  assert(A.game.score === 4000, "F: no score penalty above threshold");

  // Dead ship: the hook's !s.dead guard skips the save; damageShip returns false with nothing spent.
  const s2 = armShip(A, A.LOW_HP_THRESHOLD - 10); s2.dead = true;
  A.game.score = 4000; A.game.floaters.length = 0;
  const d2 = A.damageShip(50, 150, 100);
  assert(d2 === false, "F: dead ship returns false");
  assert(near(s2.energy, 1) && A.game.score === 4000 && A.game.floaters.length === 0,
    "F: dead ship triggers NO auto-save");
})();

// ================= (G) persistence round-trip / defaults =====================
(function () {
  console.log("(G) autoShield persists through afd_settings_v1; missing/non-boolean => false");
  // default off on a virgin store
  const fresh = buildInstance({});
  assert(fresh.settings.autoShield === false, "G: default false with no saved settings");

  // save true, then load into a fresh instance sharing the store
  const store = {};
  const A = buildInstance(store);
  A.settings.autoShield = true; A.saveSettings();
  const raw = JSON.parse(store[A.STORAGE_KEY]);
  assert(raw.autoShield === true, "G: saveSettings wrote autoShield:true to afd_settings_v1");
  const B = buildInstance(store); // loadSettings() runs at construction
  assert(B.settings.autoShield === true, "G: loadSettings restored autoShield true");

  // non-boolean stored value => stays default false
  const badStore = {}; const C0 = buildInstance(badStore);
  C0.settings.autoShield = true; C0.saveSettings();
  const parsed = JSON.parse(badStore[C0.STORAGE_KEY]); parsed.autoShield = "yes";
  badStore[C0.STORAGE_KEY] = JSON.stringify(parsed);
  const C = buildInstance(badStore);
  assert(C.settings.autoShield === false, "G: non-boolean autoShield ignored (falls back to false)");

  // missing key entirely (older save without the field) => default false
  const oldStore = {}; const D0 = buildInstance(oldStore);
  D0.saveSettings();
  const od = JSON.parse(oldStore[D0.STORAGE_KEY]); delete od.autoShield;
  oldStore[D0.STORAGE_KEY] = JSON.stringify(od);
  const D = buildInstance(oldStore);
  assert(D.settings.autoShield === false, "G: missing autoShield field => default false");
})();

// ================= (H) Difficulty row toggles both directions and saves =====================
(function () {
  console.log("(H) DIFFICULTY_ROWS/menuDifficulty toggle autoShield both ways + save");
  const store = {};
  const A = buildInstance(store);
  A.startGame();
  assert(A.DIFFICULTY_ROWS.includes("autoshield"), "H: DIFFICULTY_ROWS contains \"autoshield\"");
  A.game.menu.screen = "difficulty";
  A.game.menu.index = A.DIFFICULTY_ROWS.indexOf("autoshield");

  A.settings.autoShield = false;
  A.menuDifficulty("right");
  assert(A.settings.autoShield === true, "H: ► turns autoShield ON");
  assert(JSON.parse(store[A.STORAGE_KEY]).autoShield === true, "H: ► persisted the ON state");

  A.menuDifficulty("left");
  assert(A.settings.autoShield === false, "H: ◄ turns autoShield OFF");
  assert(JSON.parse(store[A.STORAGE_KEY]).autoShield === false, "H: ◄ persisted the OFF state");
})();

// ================= headless no-crash smoke =====================
(function () {
  console.log("(smoke) startGame() + update(1/60) with AudioSys.ctx null never throws");
  const A = buildInstance();
  assert(A.AudioSys.ctx == null, "smoke: AudioSys.ctx is null (headless)");
  try { A.startGame(); for (let i = 0; i < 5; i++) A.update(1 / 60); passed++; }
  catch (e) { failed++; console.error("  FAIL: headless update threw: " + e.stack); }
})();

console.log(`\nCS012 P5: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
