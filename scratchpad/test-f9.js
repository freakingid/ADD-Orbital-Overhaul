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
  "startGame", "update", "updateToasts", "nextWave", "game", "AudioSys", "Achievements",
  "destroyDebris", "destroyHunter", "applyPowerup", "damageShip", "killShip",
  "DebrisSatellite", "HunterSatellite", "Saucer", "Garbage", "Dock",
  "SHIP_MAX_HP", "HUNTER_DAMAGE", "DOCK_RADIUS", "TIER_NAMES", "TIER_COLOR", "drawAchievements"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub);
const {
  startGame, update, updateToasts, nextWave, game, AudioSys, Achievements,
  destroyDebris, destroyHunter, applyPowerup, damageShip, killShip,
  DebrisSatellite, HunterSatellite, Saucer, Garbage, Dock,
  SHIP_MAX_HP, HUNTER_DAMAGE, DOCK_RADIUS, TIER_NAMES, TIER_COLOR, drawAchievements
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
  Achievements.lifetimeTiers = {};                            // fresh tier state (v3.0 P7)
  Achievements.activeIds = Achievements.WEEKLY.map(a => a.id); // make ALL weeklies evaluable for gameplay tests
  Achievements._saveAccum = 1e9;                               // don't let periodic save fire mid-test
  game.toasts = [];
}
const wUnlocked = id => Achievements.weeklyUnlocked.has(id);
const lUnlocked = id => Achievements.lifetimeUnlocked.has(id);
// Highest tier index reached for a tiered lifetime id (-1 = not even bronze).
const lTier = id => (id in Achievements.lifetimeTiers) ? Achievements.lifetimeTiers[id] : -1;

console.log(`(config) weekly=${Achievements.WEEKLY.length}  lifetime=${Achievements.LIFETIME.length}  active/week=${Achievements.activeIds.length}`);
assert(Achievements.WEEKLY.length === 16, "config: 16 weekly achievements (v3.0 P8 added Flawless Run)");
assert(Achievements.LIFETIME.length === 19, "config: 19 lifetime achievements (v3.0 P8 added 7)");
// v3.0 P7 tier structure + P8 new tiered rows: 14 tiered total.
const tieredIds = Achievements.LIFETIME.filter(a => a.tiers).map(a => a.id);
assert(tieredIds.length === 14, "config: exactly 14 tiered lifetime achievements (got " + tieredIds.length + ": " + tieredIds.join(",") + ")");
assert(["recycling_magnate","ghost_protocol","saucer_hunter","perfect_wave","iron_hull","master_field","no_powerups"].every(id => tieredIds.includes(id)),
  "config: the 7 P7-converted achievements are still tiered");
assert(["sharpshooter","salvage_king","field_sweeper","freight_baron","daredevil","zen_master","wave_rider"].every(id => tieredIds.includes(id)),
  "config: the 7 P8 new lifetime achievements are tiered");
assert(Achievements.LIFETIME.every(a => !a.tiers || (Array.isArray(a.tiers) && a.tiers.length === 6)), "config: every tier ladder has 6 steps (bronze..diamond)");
assert(Achievements.LIFETIME.every(a => !a.tiers || a.tiers.every((v, i, arr) => i === 0 || v > arr[i - 1])), "config: tier ladders strictly ascend");
assert(Achievements.LIFETIME.every(a => !a.tiers || a.goal === undefined), "config: tiered entries carry no single-goal");
assert(TIER_NAMES.length === 6 && TIER_COLOR.length === 6, "config: 6 tier names + 6 tier colours");
assert("maxWaveNoPowerup" in Achievements.lifetime, "config: new MAX counter maxWaveNoPowerup exists");
// P8 new lifetime counters all present:
assert(["smallSaucerKills","bestDeliveredGame","bestDebrisGame","heavyHaulerEvents","pacifistTowEvents","glassCannonGames","shieldSurferGames"]
  .every(k => k in Achievements.lifetime), "config: all 7 new P8 lifetime counters exist");
assert("flawlessLateWave" in game.stats, "config: new per-game stat flawlessLateWave exists (Flawless Run)");
assert(!!Achievements.byId["flawless_run"] && Achievements.byId["flawless_run"].pool === "weekly", "config: Flawless Run is a weekly achievement");
// v3.2 P3: garbage no longer decays. The old per-game garbageDecayed stat is gone, replaced by
// hunterCoalesced; Waste Not is repurposed in place (id + pool slot kept, so the rotation math above is unchanged).
assert("hunterCoalesced" in game.stats, "config: new per-game stat hunterCoalesced exists (Waste Not, v3.2 P3)");
assert(!("garbageDecayed" in game.stats), "config: the old garbageDecayed stat is gone (v3.2 P3)");
const wasteNotDef = Achievements.byId["waste_not"];
assert(!!wasteNotDef && wasteNotDef.pool === "weekly" && /scrap/i.test(wasteNotDef.desc),
  "config: Waste Not kept as a weekly, repurposed to the neglected-scrap meaning");
assert(Achievements.STORAGE_KEY === "afd_achievements_v2", "config: persistence bumped to afd_achievements_v2");
// The Long Haul reworded to a fixed >=12/visit (still non-tiered, goal 10).
const longHaul = Achievements.byId["long_haul"];
assert(!longHaul.tiers && longHaul.goal === 10 && /12\+/.test(longHaul.desc), "config: The Long Haul is fixed >=12/visit, non-tiered");

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

// v3.0 P8: pool is 16 now, so the deterministic rotation shifts. poolIndex uses .length, so these
// expected values are recomputed for length 16 (FLAG A-7-a).
// poolIndex = (2026*52 + 2) % 16 = 105354 % 16 = 10  ->  a 5-wide slice starting at index 10.
assert(Achievements.poolIndex(2026, 2) === 10, "A: poolIndex(2026,2) === 10 (pool 16)");
const sliceW2 = ids(Achievements.selectWeekly(utc(2026, 0, 5)));
assert(eqArr(sliceW2, ["combo_collector", "speed_recycler", "powered_up", "diamond_cutter", "waste_not"]),
  "A: week 2026-W02 selects the expected 5 (idx 10..14): " + sliceW2.join(","));
// Determinism: same date -> same slice.
assert(eqArr(sliceW2, ids(Achievements.selectWeekly(utc(2026, 0, 5)))), "A: selection is deterministic for a fixed date");
// Wrap-around: (2026*52 + 6) % 16 = 105358 % 16 = 14  ->  slice [14,15,0,1,2] wraps past the end.
assert(Achievements.poolIndex(2026, 6) === 14, "A: poolIndex(2026,6) === 14 (a wrapping index, pool 16)");
const sliceW6 = ids(Achievements.selectWeekly(utc(2026, 1, 2))); // Feb 2 2026 (Mon) = ISO W06
assert(eqArr(sliceW6, ["waste_not", "flawless_run", "scrap_runner", "heavy_hauler", "glass_cannon"]),
  "A: week 2026-W06 wraps the pool correctly: " + sliceW6.join(","));

// =====================================================================
// (B) Persistence: weekly resets on a new week, lifetime is retained, same-week round-trips
// =====================================================================
console.log("(B) persistence — weekly week-reset + lifetime retained + same-week round-trip");
global.localStorage.removeItem("afd_achievements_v2");
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
global.localStorage.removeItem("afd_achievements_v2");
global.localStorage.removeItem("afd_achievements_v1");

// =====================================================================
// (B2) v2 tier persistence round-trip + best-effort v1 -> v2 migration
// =====================================================================
console.log("(B2) v2 tier round-trip + v1->v2 migration keeps counters, re-derives tiers");
global.localStorage.removeItem("afd_achievements_v2");
global.localStorage.removeItem("afd_achievements_v1");
Achievements.init(utc(2026, 0, 5));
// Earn tier state + counters, save to v2, reload -> tiers + counters come back intact.
Achievements.lifetime.delivered = 12000;         // recycling_magnate: bronze,silver,gold
Achievements.lifetime.hunterKills = 300;         // ghost_protocol: bronze,silver
Achievements.lifetimeTiers["recycling_magnate"] = 2;
Achievements.lifetimeTiers["ghost_protocol"] = 1;
Achievements.save();
Achievements.lifetime.delivered = 0; Achievements.lifetime.hunterKills = 0; Achievements.lifetimeTiers = {}; // scribble over memory
Achievements.init(utc(2026, 0, 5));              // same week -> reload from v2
assert(Achievements.lifetime.delivered === 12000 && Achievements.lifetime.hunterKills === 300, "B2: v2 reload restores lifetime counters");
assert(lTier("recycling_magnate") === 2 && lTier("ghost_protocol") === 1, "B2: v2 reload restores per-id tier indices");
// A stored tier below what the counter now justifies is advanced (never lowered) by deriveLifetime.
Achievements.save();                             // delivered 12000, but pretend a stale low tier was stored
const v2raw = JSON.parse(global.localStorage.getItem("afd_achievements_v2"));
v2raw.lifetimeTiers.recycling_magnate = 0;       // corrupt the stored tier down to bronze
global.localStorage.setItem("afd_achievements_v2", JSON.stringify(v2raw));
Achievements.init(utc(2026, 0, 5));
assert(lTier("recycling_magnate") === 2, "B2: deriveLifetime advances a stale-low stored tier up to what the counter earns");
// Now the migration: only a v1 save present -> keep raw counters, re-derive tiers, ignore old unlock sets.
global.localStorage.removeItem("afd_achievements_v2");
global.localStorage.removeItem("afd_achievements_v1");
global.localStorage.setItem("afd_achievements_v1", JSON.stringify({
  lifetime: { delivered: 26000, hunterKills: 60, saucerKills: 0, hitsSurvived: 0, perfectWaves: 0, playTime: 0, maxWave: 0, deliveryScore: 0, fullChains: 0 },
  lifetimeUnlocked: ["recycling_magnate", "ghost_protocol"],  // old flat unlock set — must be IGNORED
  weekly: { key: "2026-2", unlocked: ["scrap_runner"] }
}));
Achievements.init(utc(2026, 0, 5));
assert(Achievements.lifetime.delivered === 26000 && Achievements.lifetime.hunterKills === 60, "B2: v1->v2 migration keeps the raw lifetime counters");
assert(lTier("recycling_magnate") === 3 && lTier("ghost_protocol") === 0, "B2: migration re-derives tiers from counters (26k=Titanium, 60=Bronze)");
// A migrated returning player should NOT get a toast storm: deriveLifetime seeds silently.
assert(game.toasts.length === 0, "B2: migration seeds tiers SILENTLY (no toast storm for past progress)");
global.localStorage.removeItem("afd_achievements_v2");
global.localStorage.removeItem("afd_achievements_v1");
// Corrupt v2 payload never crashes init (guarded).
global.localStorage.setItem("afd_achievements_v2", "{not valid json");
let threw = false; try { Achievements.init(utc(2026, 0, 5)); } catch (e) { threw = true; }
assert(!threw, "B2: a corrupt v2 payload does not crash init (typeof-guard + try/catch)");
global.localStorage.removeItem("afd_achievements_v2");

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
// Field Sweeper (lifetime MAX): the real destroyDebris hook tracked the per-game best.
assert(Achievements.lifetime.bestDebrisGame === 15, "C1: Field Sweeper tracks best Debris destroyed this game (15)");
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
assert(Achievements.lifetime.heavyHaulerEvents === 1, "C2: Freight Baron (per-EVENT) latched once at the 12-in-one-visit milestone");
assert(Achievements.lifetime.delivered === 12 && Achievements.lifetime.deliveryScore > 0, "C2: lifetime delivered + delivery score accrued");
// Deliver 8 more to cross 20 total -> Scrap Runner.
fillChain(8); game.offloadTimer = 0;
tickDock(9);
assert(game.stats.delivered === 20 && wUnlocked("scrap_runner"), "C2: 20 total delivered -> Scrap Runner (got " + game.stats.delivered + ")");
assert(Achievements.lifetime.bestDeliveredGame === 20, "C2: Salvage King tracks best delivered this game (20)");

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
// No Powerups Needed (lifetime, TIERED MAX on maxWaveNoPowerup): the counter rises via the REAL
// nextWave() only while powerupsPicked === 0, and freezes for the game the moment a powerup is picked.
startGame(); resetAch();
game.wave = 14; nextWave(); // -> wave 15, powerup-free, so maxWaveNoPowerup = 15
assert(Achievements.lifetime.maxWaveNoPowerup === 15, "C4: nextWave records maxWaveNoPowerup while powerup-free (got " + Achievements.lifetime.maxWaveNoPowerup + ")");
Achievements.evaluate();
assert(lTier("no_powerups") === 2, "C4: wave 15 powerup-free -> No Powerups Needed Gold (tiers 2/5/11/17..; 15 clears 11)");
// Frozen once a powerup is picked: a later, deeper wave does NOT advance the counter.
startGame(); resetAch();
game.wave = 4; nextWave();                       // -> wave 5, powerup-free -> maxWaveNoPowerup = 5
applyPowerup("rapid");                            // powerupsPicked > 0 -> frozen from here
game.wave = 20; nextWave();                       // -> wave 21, but frozen
assert(Achievements.lifetime.maxWaveNoPowerup === 5, "C4: maxWaveNoPowerup FROZEN at 5 once a powerup is picked (got " + Achievements.lifetime.maxWaveNoPowerup + ")");
Achievements.evaluate();
assert(lTier("no_powerups") === 1, "C4: frozen at wave 5 -> only Silver (tier 1), not higher");

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
// Perfect Wave is now TIERED [5,10,50,100,250,500]: the 10th perfect wave reaches Silver (tier 1).
assert(Achievements.lifetime.perfectWaves === 10 && lTier("perfect_wave") === 1, "C6: 10th damage-free wave -> Perfect Wave Silver (tier 1)");

// --- (C6b) Waste Not (v3.2 P3, repurposed): unlock on a game where NO Hunter was born from scrap;
//          does NOT unlock once even one clump coalesced. Evaluated at game over (needs gameEnded). ---
console.log("(C6b) Waste Not: zero coalesced Hunters unlocks; one coalesced Hunter does not");
startGame(); resetAch();
game.stats.hunterCoalesced = 0;
Achievements.evaluate();
assert(!wUnlocked("waste_not"), "C6b: not yet unlocked mid-game (gameEnded still false)");
game.stats.gameEnded = true; // game over
Achievements.evaluate();
assert(wUnlocked("waste_not"), "C6b: a finished game with zero coalesced Hunters unlocks Waste Not");
// a game where scrap DID coalesce into a Hunter must not unlock it
startGame(); resetAch();
game.stats.hunterCoalesced = 1; game.stats.gameEnded = true;
Achievements.evaluate();
assert(!wUnlocked("waste_not"), "C6b: a game with one Hunter born from scrap does NOT unlock Waste Not");

// --- (C7) TIERED lifetime boundaries via the REAL evaluate() (cross bronze not silver; multi-cross) ---
console.log("(C7) tiered lifetime thresholds — per-tier boundaries + multi-tier jumps");
startGame(); resetAch();

// Every tiered ladder: threshold-1 leaves you on the prior tier; the exact threshold advances one tier.
// (For t>0, threshold-1 already sits >= the previous threshold, so a fresh evaluate first climbs to t-1
// in one pass — which also exercises multi-tier crossing — then the exact value reaches tier t.)
const tierBoundaries = (id, key, tiers) => {
  for (let t = 0; t < tiers.length; t++) {
    resetAch();
    Achievements.lifetime[key] = tiers[t] - 1; Achievements.evaluate();
    assert(lTier(id) === t - 1, "C7: " + id + " tier " + t + " NOT reached at threshold-1 (on tier " + lTier(id) + ")");
    Achievements.lifetime[key] = tiers[t]; Achievements.evaluate();
    assert(lTier(id) === t, "C7: " + id + " reaches tier " + t + " exactly at its threshold");
  }
};
tierBoundaries("recycling_magnate", "delivered",         [1000, 5000, 10000, 25000, 50000, 100000]);
tierBoundaries("ghost_protocol",    "hunterKills",       [50, 250, 1000, 2500, 5000, 10000]);
tierBoundaries("saucer_hunter",     "saucerKills",       [250, 500, 1000, 2500, 5000, 10000]);
tierBoundaries("perfect_wave",      "perfectWaves",      [5, 10, 50, 100, 250, 500]);
tierBoundaries("iron_hull",         "hitsSurvived",      [100, 500, 1000, 2500, 5000, 10000]);
tierBoundaries("master_field",      "maxWave",           [5, 10, 25, 50, 75, 100]);      // MAX counter
tierBoundaries("no_powerups",       "maxWaveNoPowerup",  [2, 5, 11, 17, 23, 29]);        // MAX counter
// v3.0 P8 new tiered ladders (SUM + MAX; the tier machinery is identical, so setting the counter
// directly exercises evaluate's crossing logic for each).
tierBoundaries("sharpshooter",      "smallSaucerKills",  [100, 500, 1000, 2500, 5000, 7500]);   // FLAG A-8-a: diamond 7500
tierBoundaries("freight_baron",     "heavyHaulerEvents", [1, 10, 50, 150, 400, 1000]);          // per-EVENT
tierBoundaries("zen_master",        "pacifistTowEvents", [1, 10, 50, 150, 400, 1000]);          // per-EVENT
tierBoundaries("daredevil",         "glassCannonGames",  [1, 5, 20, 50, 125, 300]);             // FLAG A-12-a softened
tierBoundaries("wave_rider",        "shieldSurferGames", [1, 5, 20, 50, 125, 300]);             // FLAG A-12-a softened
tierBoundaries("salvage_king",      "bestDeliveredGame", [10, 20, 40, 75, 125, 200]);           // MAX
tierBoundaries("field_sweeper",     "bestDebrisGame",    [15, 40, 80, 150, 250, 400]);          // MAX

// Explicit "cross bronze but NOT silver" single-step:
resetAch();
Achievements.lifetime.delivered = 1000; Achievements.evaluate();  // bronze (1000), silver is 5000
assert(lTier("recycling_magnate") === 0, "C7: exactly-bronze crosses bronze only, not silver");
assert(game.toasts.length === 1 && /Bronze/.test(game.toasts[0].name), "C7: crossing one tier fires exactly one Bronze toast");

// A single jump crossing MULTIPLE tiers fires one toast per crossed tier, ascending, tier-named:
resetAch();
Achievements.lifetime.delivered = 10000; Achievements.evaluate(); // clears 1000, 5000, 10000 at once
assert(lTier("recycling_magnate") === 2, "C7: a 10,000 jump reaches Gold (tier 2)");
assert(game.toasts.length === 3, "C7: crossing three tiers in one pass fires three toasts (got " + game.toasts.length + ")");
assert(/Recycling Magnate — Bronze/.test(game.toasts[0].name) && /— Silver/.test(game.toasts[1].name) && /— Gold/.test(game.toasts[2].name),
  "C7: multi-tier toasts are ascending and name the tier");

// Master of the Field (tiered maxWave) and Century Club (non-tiered, goal 25) coexist on the same counter.
resetAch();
Achievements.lifetime.maxWave = 25; Achievements.evaluate();
assert(lTier("master_field") === 2 && lUnlocked("century_club"), "C7: maxWave 25 -> Master gold (tier 2) + Century Club unlocked");

// Remaining NON-tiered lifetime single-goal boundaries (unchanged single-goal path).
const boundary = (name, key, goal) => {
  resetAch();
  Achievements.lifetime[key] = goal - 1; Achievements.evaluate();
  assert(!lUnlocked(name), "C7: " + name + " not unlocked at goal-1");
  Achievements.lifetime[key] = goal; Achievements.evaluate();
  assert(lUnlocked(name), "C7: " + name + " unlocks exactly at goal");
};
boundary("ton_of_scrap",    "deliveryScore", 10000);
boundary("marathon_runner", "playTime",      36000);
boundary("long_haul",       "fullChains",    10);
boundary("century_club",    "maxWave",       25);

// Progress-text formatting: tiered rows show "Badge · cur → next" (and "Diamond ✓ MAX" at the top);
// non-tiered rows still show a hours / cur-of-goal readout.
resetAch();
const magnate = Achievements.byId["recycling_magnate"];
Achievements.lifetime.delivered = 12431; Achievements.evaluate();
assert(Achievements.tierStatusText(magnate) === "Gold · 12,431 → 25,000",
  "C7: tiered status reads 'Gold · 12,431 → 25,000' (" + Achievements.tierStatusText(magnate) + ")");
Achievements.lifetime.delivered = 100000; Achievements.evaluate();
assert(lTier("recycling_magnate") === 5 && Achievements.tierStatusText(magnate) === "Diamond ✓ MAX",
  "C7: top tier shows 'Diamond ✓ MAX' (" + Achievements.tierStatusText(magnate) + ")");
resetAch();
const magnate2 = Achievements.byId["recycling_magnate"];
assert(Achievements.tierStatusText(magnate2) === "— · 0 → 1,000", "C7: pre-bronze status reads '— · 0 → 1,000' (" + Achievements.tierStatusText(magnate2) + ")");
const marathon = Achievements.byId["marathon_runner"];
Achievements.lifetime.playTime = 3600;
assert(Achievements.progressText(marathon) === "1.0/10h", "C7: Marathon progress reads in hours (" + Achievements.progressText(marathon) + ")");
Achievements.lifetime.deliveryScore = 2500;
assert(Achievements.progressText(Achievements.byId["ton_of_scrap"]) === "2500/10000", "C7: non-tiered counter progress reads cur/goal");

// =====================================================================
// (C8) Event-cadence hooks driven through the REAL dock offload:
//   Freight Baron (per-visit latch on >=12) + Zen Master (per-haul latch on a 5-streak)
// =====================================================================
console.log("(C8) event cadence — Freight Baron once per >=12 visit; Zen Master once per 5-streak haul");
function parkOnDock() {
  game.debris = []; game.hunters = []; game.saucers = []; game.bullets = []; game.powerups = []; game.garbage = [];
  game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
  game.ship.invuln = 1e9; game.ship.shieldOn = false;
  game.dock.x = game.ship.x; game.dock.y = game.ship.y;
}
// --- Freight Baron: one visit delivering 15 fires exactly once (latched on deliveryCount===12) ---
startGame(); resetAch(); parkOnDock();
fillChain(15); game.deliveryCount = 0; game.offloadTimer = 0;
tickDock(16);
assert(game.stats.delivered === 15, "C8: 15 delivered in one visit (got " + game.stats.delivered + ")");
assert(Achievements.lifetime.heavyHaulerEvents === 1, "C8: Freight Baron counts a >=12 visit exactly ONCE (not per canister past 12)");
assert(Achievements.lifetime.bestDeliveredGame === 15, "C8: Salvage King MAX tracks best delivered this game (15)");
// A SECOND full visit (fresh deliveryCount) -> Freight Baron increments to 2.
game.deliveryCount = 0; fillChain(12); game.offloadTimer = 0;
tickDock(13);
assert(Achievements.lifetime.heavyHaulerEvents === 2, "C8: a second >=12 visit increments Freight Baron to 2");
// An UNDER-12 visit does NOT count.
game.deliveryCount = 0; fillChain(11); game.offloadTimer = 0;
tickDock(12);
assert(Achievements.lifetime.heavyHaulerEvents === 2, "C8: an 11-canister visit does not increment Freight Baron");

// --- Zen Master: a 5-in-a-row no-fire haul latches once; a fresh 5-streak after a fire counts again ---
startGame(); resetAch(); parkOnDock();
fillChain(7); game.deliveryCount = 0; game.offloadTimer = 0; game.stats.pacifistStreak = 0;
tickDock(8); // deliver 7 with no firing -> streak passes 5 exactly once
assert(game.stats.pacifistStreak === 7, "C8: pacifist streak climbed to 7 with no firing (got " + game.stats.pacifistStreak + ")");
assert(Achievements.lifetime.pacifistTowEvents === 1, "C8: Zen Master counts a 5-streak haul exactly ONCE (not per delivery past 5)");
game.stats.pacifistStreak = 0; // firing breaks the streak (Ship.update fire block); model the reset directly
fillChain(5); game.deliveryCount = 0; game.offloadTimer = 0;
tickDock(6);
assert(Achievements.lifetime.pacifistTowEvents === 2, "C8: a fresh 5-streak haul after a reset counts again (per-EVENT)");

// =====================================================================
// (C9) Flawless Run weekly + the once-per-game event counters at game over
// =====================================================================
console.log("(C9) Flawless Run — damage-free wave 8 clear (not wave 7); Daredevil/Wave Rider at game over");
startGame(); resetAch();
game.wave = 7; game.debris = []; game.hunters = []; game.saucers = []; game.bullets = [];
game.saucerTimer = 1e9; game.hunterTimer = 1e9; game.healthTimer = 1e9;
game.ship.invuln = 1e9; game.stats.dmgThisWave = 0; game.waveClearTimer = 0;
let g9 = 0; while (game.wave === 7 && g9++ < 200) update(0.1);
assert(game.wave === 8, "C9: empty wave 7 cleared into wave 8");
assert(!game.stats.flawlessLateWave && !wUnlocked("flawless_run"), "C9: a damage-free wave-7 clear does NOT arm Flawless Run (floor is 8)");
// nextWave repopulated the field for wave 8 — clear it again so the wave-8 clear can trip.
game.debris = []; game.hunters = []; game.saucers = []; game.bullets = [];
game.stats.dmgThisWave = 0; game.waveClearTimer = 0;
let g9b = 0; while (game.wave === 8 && g9b++ < 200) update(0.1);
assert(game.wave === 9, "C9: empty wave 8 cleared into wave 9");
assert(game.stats.flawlessLateWave && wUnlocked("flawless_run"), "C9: a damage-free wave-8 clear -> Flawless Run");

// Daredevil (glassCannonGames) + Wave Rider (shieldSurferGames) tally once at game over from per-game state.
startGame(); resetAch();
game.wave = 6; game.stats.healthPicked = 0; game.stats.deflects = 10; // qualifies for BOTH
killShip();
assert(Achievements.lifetime.glassCannonGames === 1, "C9: wave-6, no-Health game over -> Daredevil +1");
assert(Achievements.lifetime.shieldSurferGames === 1, "C9: 10-deflect game over -> Wave Rider +1");
assert(lTier("daredevil") === 0 && lTier("wave_rider") === 0, "C9: both reached Bronze (tier 0) after one qualifying game");
// A non-qualifying game (grabbed Health, few deflects) tallies neither.
startGame(); resetAch();
game.wave = 8; game.stats.healthPicked = 1; game.stats.deflects = 3;
killShip();
assert(Achievements.lifetime.glassCannonGames === 0, "C9: a Health pickup disqualifies Daredevil at game over");
assert(Achievements.lifetime.shieldSurferGames === 0, "C9: under 10 deflects -> no Wave Rider at game over");

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
// (E) Viewer renders the tiered + single-goal rows without throwing (ctx is a no-op proxy)
// =====================================================================
console.log("(E) drawAchievements renders mixed tiered/single-goal rows crash-free");
startGame(); resetAch();
// A spread of tier states across the seven ladders: pre-bronze, mid-ladder, and diamond/MAX.
Achievements.lifetime.delivered = 0;        // recycling_magnate: pre-bronze -> "— · 0 → 1,000"
Achievements.lifetime.hunterKills = 12431;  // ghost_protocol: past diamond -> "Diamond ✓ MAX"
Achievements.lifetime.saucerKills = 1200;   // saucer_hunter: mid -> gold-ish
Achievements.lifetime.perfectWaves = 10;    // perfect_wave: silver
Achievements.lifetime.hitsSurvived = 100;   // iron_hull: bronze
Achievements.lifetime.maxWave = 25;         // master_field: gold + century_club (single-goal)
Achievements.lifetime.maxWaveNoPowerup = 5; // no_powerups: silver
Achievements.evaluate();
let drew = true; try { drawAchievements(); } catch (e) { drew = false; console.error("  draw threw: " + e.message); }
assert(drew, "E: drawAchievements() renders a mixed tiered/single-goal viewer without throwing");
// Also render a fully-fresh state (every tiered row pre-bronze).
resetAch(); drew = true; try { drawAchievements(); } catch (e) { drew = false; }
assert(drew, "E: drawAchievements() renders an all-pre-bronze viewer without throwing");

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
