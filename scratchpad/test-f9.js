// Headless test for Phase 9 (F9 Achievements System).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ a fake localStorage), eval the REAL
// <script> block, then drive the actual achievement/stat code — no reimplementation under test.
//
//   node scratchpad/test-f9.js
//
// What can only be judged in a real browser (playtest asks): whether the toast reads clearly, the
// viewer layout is legible, and — the big one — whether achievements + lifetime counters actually
// PERSIST across a real reload (localStorage is stubbed here / absent in the artifact sandbox).
// What IS checkable headlessly, and what this verifies:
//  (A) ISO-week math + the deterministic weekly rotation: (isoYear*52+isoWeek) % 15, 5-wide slice,
//      wrap-around, and a year-boundary (2027-01-01 -> ISO 2026-W53);
//  (B) persistence: weekly unlocks reset when the calendar week rolls over, lifetime progress is
//      retained, and same-week unlocks round-trip through localStorage;
//  (C) real-driven gameplay unlocks at exact thresholds (debris kills, dock deliveries, a Hunter
//      collision), plus lifetime threshold checks via the real evaluate() predicates;
//  (D) an unlock pushes a toast, and updateToasts() ages it out.

"use strict";
const fs = require("fs");
const path = require("path");

// ---- Extract the real game script ----
const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
    Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }
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
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };

// Fake in-memory localStorage (the code references a bare `localStorage`, typeof-guarded).
const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "update", "updateToasts", "game", "AudioSys", "Achievements",
  "destroyDebris", "destroyHunter", "applyPowerup", "damageShip",
  "DebrisSatellite", "HunterSatellite", "Saucer", "Garbage", "Dock",
  "SHIP_MAX_HP", "HUNTER_DAMAGE", "DOCK_RADIUS"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, updateToasts, game, AudioSys, Achievements,
  destroyDebris, destroyHunter, applyPowerup, damageShip,
  DebrisSatellite, HunterSatellite, Saucer, Garbage, Dock,
  SHIP_MAX_HP, HUNTER_DAMAGE, DOCK_RADIUS
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const eqArr = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i]);
const ids = arr => arr.map(a => a.id);
const utc = (y, mo, d) => new Date(Date.UTC(y, mo, d));

// Reset achievement state to a clean slate but keep the definitions/byId (populated by init()).
function resetAch() {
  for (const k in Achievements.lifetime) Achievements.lifetime[k] = 0;
  Achievements.lifetimeUnlocked = new Set();
  Achievements.weeklyUnlocked = new Set();
  Achievements.activeIds = Achievements.WEEKLY.map(a => a.id); // make ALL weeklies evaluable for gameplay tests
  Achievements._saveAccum = 1e9;                               // don't let periodic save fire mid-test
  game.toasts = [];
}
const wUnlocked = id => Achievements.weeklyUnlocked.has(id);
const lUnlocked = id => Achievements.lifetimeUnlocked.has(id);

console.log(`(config) weekly=${Achievements.WEEKLY.length}  lifetime=${Achievements.LIFETIME.length}  active/week=${Achievements.activeIds.length}`);
assert(Achievements.WEEKLY.length === 15, "config: 15 weekly achievements");
assert(Achievements.LIFETIME.length === 12, "config: 12 lifetime achievements");

// =====================================================================
// (A) ISO-week math + deterministic weekly rotation
// =====================================================================
console.log("(A) ISO week math + weekly rotation (deterministic, calendar-driven)");
// 2026-01-01 is a Thursday -> Jan 5 (Mon) is ISO 2026-W02.
let wy = Achievements.isoWeekYear(utc(2026, 0, 5));
assert(wy.year === 2026 && wy.week === 2, "A: 2026-01-05 -> ISO year 2026, week 2 (got " + wy.year + "-W" + wy.week + ")");
// Year boundary: 2027-01-01 is a Friday -> belongs to ISO 2026 week 53 (2026 starts on a Thursday = 53-week year).
wy = Achievements.isoWeekYear(utc(2027, 0, 1));
assert(wy.year === 2026 && wy.week === 53, "A: 2027-01-01 -> ISO year 2026, week 53 (got " + wy.year + "-W" + wy.week + ")");

// poolIndex = (2026*52 + 2) % 15 = 9  ->  a 5-wide slice starting at index 9.
assert(Achievements.poolIndex(2026, 2) === 9, "A: poolIndex(2026,2) === 9");
const sliceW2 = ids(Achievements.selectWeekly(utc(2026, 0, 5)));
assert(eqArr(sliceW2, ["no_scratches", "combo_collector", "speed_recycler", "powered_up", "diamond_cutter"]),
  "A: week 2026-W02 selects the expected 5 (idx 9..13): " + sliceW2.join(","));
// Determinism: same date -> same slice.
assert(eqArr(sliceW2, ids(Achievements.selectWeekly(utc(2026, 0, 5)))), "A: selection is deterministic for a fixed date");
// Wrap-around: (2026*52 + 6) % 15 = 13  ->  slice [13,14,0,1,2] wraps past the end of the pool.
assert(Achievements.poolIndex(2026, 6) === 13, "A: poolIndex(2026,6) === 13 (a wrapping index)");
const sliceW6 = ids(Achievements.selectWeekly(utc(2026, 1, 2))); // Feb 2 2026 (Mon) = ISO W06
assert(eqArr(sliceW6, ["diamond_cutter", "waste_not", "scrap_runner", "heavy_hauler", "glass_cannon"]),
  "A: week 2026-W06 wraps the pool correctly: " + sliceW6.join(","));

// =====================================================================
// (B) Persistence: weekly resets on a new week, lifetime is retained, same-week round-trips
// =====================================================================
console.log("(B) persistence — weekly week-reset + lifetime retained + same-week round-trip");
global.localStorage.removeItem("afd_achievements_v1");
Achievements.init(utc(2026, 0, 5)); // week 2026-2
assert(Achievements.weekKey === "2026-2", "B: init sets weekKey 2026-2");
assert(eqArr(Achievements.activeIds, sliceW2), "B: init sets the week's active slice");
// Simulate a weekly unlock + lifetime progress this week, then save.
Achievements.weeklyUnlocked.add("no_scratches");
Achievements.lifetime.delivered = 500;
Achievements.lifetimeUnlocked.add("century_club");
Achievements.save();
// Roll over to a DIFFERENT week -> weekly unlocks reset, lifetime retained.
Achievements.init(utc(2026, 1, 2)); // week 2026-6
assert(Achievements.weekKey === "2026-6", "B: init advances to weekKey 2026-6");
assert(Achievements.weeklyUnlocked.size === 0, "B: weekly unlocks RESET on a new calendar week");
assert(Achievements.lifetime.delivered === 500, "B: lifetime counters PERSIST across the week rollover");
assert(lUnlocked("century_club"), "B: lifetime unlocks PERSIST across the week rollover");
assert(eqArr(Achievements.activeIds, sliceW6), "B: the new week exposes its own active slice");
// Unlock a weekly THIS week + save, then re-init same week -> it comes back (same-week round-trip).
Achievements.weeklyUnlocked.add("scrap_runner");
Achievements.save();
Achievements.init(utc(2026, 1, 4)); // still ISO week 2026-6
assert(Achievements.weekKey === "2026-6" && wUnlocked("scrap_runner"), "B: same-week weekly unlock round-trips through storage");
global.localStorage.removeItem("afd_achievements_v1");

// =====================================================================
// (C) Real-driven gameplay unlocks at exact thresholds
// =====================================================================

// --- (C1) Satellite Buster: destroy 15 Debris Satellites (player kills) ---
console.log("(C1) Satellite Buster — real destroyDebris kills, threshold at 15");
startGame(); resetAch();
for (let i = 0; i < 14; i++) destroyDebris(new DebrisSatellite(500, 500, 1), true);
Achievements.evaluate();
assert(game.stats.debrisKills === 14 && !wUnlocked("satellite_buster"), "C1: 14 kills -> not yet unlocked");
destroyDebris(new DebrisSatellite(500, 500, 1), true);
Achievements.evaluate();
assert(game.stats.debrisKills === 15 && wUnlocked("satellite_buster"), "C1: 15th kill unlocks Satellite Buster");
// saucer-bullet kills (awardScore=false) do NOT count toward the player's tally
const before = game.stats.debrisKills;
destroyDebris(new DebrisSatellite(500, 500, 1), false);
assert(game.stats.debrisKills === before, "C1: a saucer-bullet debris kill is not credited to the player");

// --- (C2) Deliveries: drive the REAL dock offload -> Heavy Hauler / Combo / Speed / Scrap Runner ---
console.log("(C2) deliveries — real dock offload drives Heavy Hauler, Combo Collector, Speed Recycler, Scrap Runner");
startGame(); resetAch();
game.debris = []; game.hunters = []; game.saucers = []; game.bullets = []; game.powerups = []; game.garbage = [];
game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
game.ship.invuln = 1e9; game.ship.shieldOn = false;
game.dock.x = game.ship.x; game.dock.y = game.ship.y; // park the dock on the ship
function fillChain(n) {
  game.chain = [];
  for (let i = 0; i < n; i++) game.chain.push({ x: game.ship.x, y: game.ship.y, px: game.ship.x, py: game.ship.y, spin: 0, spinRate: 0, mass: 1 });
}
function tickDock(times) {
  for (let i = 0; i < times; i++) {
    game.ship.x = game.dock.x; game.ship.y = game.dock.y; game.ship.vx = 0; game.ship.vy = 0;
    game.waveClearTimer = 0; // keep the empty field from advancing the wave mid-test
    update(0.13);            // > offload interval (0.13s) so exactly one canister peels off per call
  }
}
fillChain(12); game.deliveryCount = 0; game.offloadTimer = 0;
tickDock(14); // deliver all 12
assert(game.stats.delivered === 12, "C2: 12 canisters delivered (got " + game.stats.delivered + ")");
assert(game.stats.fullChainVisit && wUnlocked("heavy_hauler"), "C2: a full 12-in-one-visit unlocks Heavy Hauler");
assert(game.stats.bestCombo >= 8 && wUnlocked("combo_collector"), "C2: combo reached 8+ -> Combo Collector");
assert(game.stats.speedRecycler && wUnlocked("speed_recycler"), "C2: first delivery <60s -> Speed Recycler");
assert(Achievements.lifetime.fullChains === 1, "C2: The Long Haul lifetime counter incremented once at 12");
assert(Achievements.lifetime.delivered === 12 && Achievements.lifetime.deliveryScore > 0, "C2: lifetime delivered + delivery score accrued");
// Deliver 8 more to cross 20 total -> Scrap Runner.
fillChain(8); game.offloadTimer = 0;
tickDock(9);
assert(game.stats.delivered === 20 && wUnlocked("scrap_runner"), "C2: 20 total delivered -> Scrap Runner (got " + game.stats.delivered + ")");

// --- (C3) Close Shave: survive a Hunter collision under 10 HP (real collision path) ---
console.log("(C3) Close Shave — survive a Hunter collision under 10 HP (real damageShip via collision)");
startGame(); resetAch();
game.debris = []; game.hunters = []; game.saucers = []; game.bullets = []; game.chain = [];
game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
game.ship.hp = 35; game.ship.invuln = 0; game.ship.shieldOn = false; game.ship.dead = false;
game.hunters = [new HunterSatellite(game.ship.x, game.ship.y, 1)]; // small Hunter overlapping the ship (dmg 30)
update(1 / 60);
assert(game.ship.hp === 35 - HUNTER_DAMAGE[1], "C3: took exactly one small-Hunter hit (hp " + game.ship.hp + ")");
assert(game.ship.hp < 10 && !game.ship.dead && game.stats.closeShave, "C3: survived under 10 HP -> Close Shave flagged");
assert(wUnlocked("close_shave"), "C3: Close Shave unlocked");
assert(game.stats.everBelowHalf && Achievements.lifetime.hitsSurvived >= 1, "C3: hit also set below-half + lifetime hitsSurvived");

// --- (C4) Powerups: Powered Up needs all four; Health gates Glass Cannon; any powerup blocks No-Powerups ---
console.log("(C4) powerups — Powered Up (all four), Glass Cannon (no Health), No Powerups Needed");
startGame(); resetAch();
["rapid", "triple", "magnet"].forEach(applyPowerup);
Achievements.evaluate();
assert(!wUnlocked("powered_up"), "C4: 3 of 4 drop types -> Powered Up not yet");
applyPowerup("engine");
Achievements.evaluate();
assert(wUnlocked("powered_up"), "C4: all four drop types -> Powered Up unlocked");
// Glass Cannon: reach wave 5 with no Health picked.
startGame(); resetAch();
game.wave = 5; Achievements.evaluate();
assert(wUnlocked("glass_cannon"), "C4: wave 5 with no Health -> Glass Cannon");
startGame(); resetAch();
applyPowerup("health"); game.wave = 5; Achievements.evaluate();
assert(!wUnlocked("glass_cannon"), "C4: a Health pickup disqualifies Glass Cannon");
// No Powerups Needed (lifetime): wave 15 with zero powerups.
startGame(); resetAch();
game.wave = 15; Achievements.evaluate();
assert(lUnlocked("no_powerups"), "C4: wave 15 with no powerups -> No Powerups Needed");
startGame(); resetAch();
applyPowerup("rapid"); game.wave = 15; Achievements.evaluate();
assert(!lUnlocked("no_powerups"), "C4: any powerup disqualifies No Powerups Needed");

// --- (C5) Hunter lineage (Hunter's Bane) + Diamond Cutter, via real destroyHunter kills ---
console.log("(C5) Hunter's Bane — a full 13-kill lineage; Diamond Cutter — 3 large cores");
startGame(); resetAch();
game.stats.hunterLineageKills = 0; // a fresh lineage begins
for (let i = 0; i < 12; i++) destroyHunter(new HunterSatellite(400, 400, 1), true);
Achievements.evaluate();
assert(!wUnlocked("hunters_bane"), "C5: 12 lineage kills -> not a full line yet");
destroyHunter(new HunterSatellite(400, 400, 1), true); // 13th
Achievements.evaluate();
assert(game.stats.hunterLineComplete && wUnlocked("hunters_bane"), "C5: 13th kill completes the line -> Hunter's Bane");
startGame(); resetAch();
for (let i = 0; i < 3; i++) destroyHunter(new HunterSatellite(400, 400, 3), true); // large cores
Achievements.evaluate();
assert(game.stats.largeHunterKills === 3 && wUnlocked("diamond_cutter"), "C5: 3 large cores -> Diamond Cutter");
assert(Achievements.lifetime.hunterKills >= 3, "C5: lifetime hunterKills accrued");

// --- (C6) Perfect wave path: complete wave 3 damage-free -> No Scratches + Perfect Wave (10th) ---
console.log("(C6) damage-free wave 3 -> No Scratches (weekly) + Perfect Wave (lifetime 10th)");
startGame(); resetAch();
Achievements.lifetime.perfectWaves = 9; // this completion will be the 10th
game.wave = 3; game.debris = []; game.hunters = []; game.saucers = []; game.bullets = [];
game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
game.ship.invuln = 1e9; game.stats.dmgThisWave = 0; game.waveClearTimer = 0;
let guard = 0;
while (game.wave === 3 && guard++ < 200) update(0.1); // accumulate waveClearTimer past 2.5s -> nextWave
assert(game.wave === 4, "C6: the empty wave 3 cleared into wave 4");
assert(game.stats.noScratchWave3 && wUnlocked("no_scratches"), "C6: damage-free wave 3 -> No Scratches");
assert(Achievements.lifetime.perfectWaves === 10 && lUnlocked("perfect_wave"), "C6: 10th damage-free wave -> Perfect Wave");

// --- (C7) Lifetime thresholds via the REAL evaluate() predicates (exact boundaries) ---
console.log("(C7) lifetime thresholds — exact just-below / at-goal boundaries");
startGame(); resetAch();
const boundary = (name, key, goal) => {
  Achievements.lifetime[key] = goal - 1; Achievements.evaluate();
  assert(!lUnlocked(name), "C7: " + name + " not unlocked at goal-1");
  Achievements.lifetime[key] = goal; Achievements.evaluate();
  assert(lUnlocked(name), "C7: " + name + " unlocks exactly at goal");
};
boundary("recycling_magnate", "delivered", 1000);
boundary("ghost_protocol", "hunterKills", 50);
boundary("ton_of_scrap", "deliveryScore", 10000);
boundary("iron_hull", "hitsSurvived", 100);
boundary("saucer_hunter", "saucerKills", 200);
boundary("marathon_runner", "playTime", 36000);
// Century Club / Master of the Field share maxWave.
Achievements.lifetime.maxWave = 25; Achievements.evaluate();
assert(lUnlocked("century_club") && !lUnlocked("master_field"), "C7: maxWave 25 -> Century Club only");
Achievements.lifetime.maxWave = 50; Achievements.evaluate();
assert(lUnlocked("master_field"), "C7: maxWave 50 -> Master of the Field");

// progressText formatting: play-time shows hours; a plain counter shows cur/goal.
const marathon = Achievements.byId["marathon_runner"];
Achievements.lifetime.playTime = 3600; Achievements.lifetimeUnlocked.delete("marathon_runner");
assert(Achievements.progressText(marathon) === "1.0/10h", "C7: Marathon progress reads in hours (" + Achievements.progressText(marathon) + ")");
Achievements.lifetime.delivered = 250;
assert(Achievements.progressText(Achievements.byId["recycling_magnate"]) === "250/1000", "C7: counter progress reads cur/goal");

// =====================================================================
// (D) Toast lifecycle: an unlock queues a banner; updateToasts ages it out
// =====================================================================
console.log("(D) unlock toast queued + aged out by updateToasts");
startGame(); resetAch();
destroyHunter(new HunterSatellite(300, 300, 3), true);
Achievements.lifetime.hunterKills = 50; Achievements.evaluate(); // force Ghost Protocol unlock -> toast
assert(game.toasts.length >= 1 && typeof game.toasts[game.toasts.length - 1].name === "string", "D: an unlock pushes a named toast");
updateToasts(999); // long enough to expire every toast
assert(game.toasts.length === 0, "D: updateToasts ages out expired toasts");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
