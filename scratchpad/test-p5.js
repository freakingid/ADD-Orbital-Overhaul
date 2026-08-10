// Headless test for v3.0 Phase 5 — Difficulty screen + powerup expiry modes (B-4 / B-5).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL fire block / magnet pass / menu state machine / persistence
// — no reimplementation of the logic under test.
//
//   node scratchpad/test-p5.js
//
// REPOINTED THROUGHOUT BY CS024 P6 (spec §1.7/§3.4/§3.7). This file's subject was "expiry MODES" — a
// choice between a timer and a count. THE CHOICE IS GONE: timed expiry is deleted and the count path is
// the only path. The file is NOT deleted, because sections D-H are precisely the count behaviours that
// SURVIVE as the shipped rule (and are the strongest existing proof of them); the mode-selection halves
// (A's defaults, B's routing, C's time path, I's three toggle rows, K's duration table) are INVERTED to
// their absence rather than dropped, per the standing mirror-image convention.
//
// Checks:
//  (A) config: MENU_OPTIONS has "Difficulty" right before "Back"; POWERUP_BUDGET maps to the shot/piece
//      constants; INVERTED — the three mode settings fields no longer exist.
//  (B) INVERTED — powerMode()/powerDuration() are deleted, and powerActive(t) is exactly
//      `powerBudget[t] > 0` for EVERY type, engine included.
//  (C) INVERTED — there is no timer path left to reproduce: a pickup grants a BUDGET for every type,
//      and firing/hooking always spends it (the old "time mode never touches the budget" claim, reversed).
//  (D) Rapid ends after EXACTLY RAPID_SHOTS trigger-pulls; cadence flips to base after.
//  (E) a Triple 3-fan is ONE pull (3 bullets, budget -1).
//  (F) Rapid+Triple budgets decrement independently and each ends on its own.
//  (G) Magnet ends after EXACTLY MAGNET_PIECES hooks; a draw-then-hook counts once (B-5-a).
//  (H) v3.6 P4: same-type pickup BANKS (adds budget on top of what's left, never refreshes);
//      magnitude (fire cadence) never stacks.
//  (I) Difficulty screen: reachable via Options, its ONE surviving row (auto-shield) flips + persists,
//      Back returns to Options; persistence tolerates a save carrying the three orphaned mode keys.
//  (J) the Difficulty screen + the budgeted HUD draw without throwing.
//  (K/K2) INVERTED — the duration table is deleted; per-type grant size now comes from
//      powerBudgetAmount(), including two LIVE debug knobs.
//  (L) v3.6 P4: HUD rebuild — TARGETS readout gone, shield bar in the left column, hull bar reads
//      distinctly at max HP, count-mode powerup rows have no bar (glyph + number only), time-mode
//      rows keep their bar.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs (mirrors test-p4 / test-f8) ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} }, // CS010 P9
    type: "sine", buffer: null, loop: false, playbackRate: { value: 1 }, curve: null, onended: null,
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

const listeners = {};
const windowStub = {
  addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
  innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };

const lsStore = {};
global.localStorage = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const returnList = [
  "startGame", "update", "draw", "game", "keys",
  "settings", "powerActive", "applyPowerup", "saveSettings", "loadSettings",
  "openPause", "closePause", "menuInput", "rootItems", "MENU_OPTIONS", "DIFFICULTY_ROWS", "STORAGE_KEY",
  "RAPID_SHOTS", "TRIPLE_SHOTS", "MAGNET_PIECES", "POWERUP_BUDGET", "powerBudgetAmount",
  "POWERUP_DROP_TYPES", "ENGINE_BURN_SECONDS", "DEBUG",
  "RAPID_FIRE_COOLDOWN", "FIRE_COOLDOWN", "AudioSys",
  'probe: (n) => { try { return eval(n); } catch (e) { return "__ReferenceError__"; } }'
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, draw, game, keys,
  settings, powerActive, applyPowerup, saveSettings, loadSettings,
  openPause, closePause, menuInput, rootItems, MENU_OPTIONS, DIFFICULTY_ROWS, STORAGE_KEY,
  RAPID_SHOTS, TRIPLE_SHOTS, MAGNET_PIECES, POWERUP_BUDGET, powerBudgetAmount,
  POWERUP_DROP_TYPES, ENGINE_BURN_SECONDS, DEBUG,
  RAPID_FIRE_COOLDOWN, FIRE_COOLDOWN, AudioSys, probe
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const near = (a, b) => Math.abs(a - b) < 1e-9;

AudioSys.init();
const DT = 1 / 60;

// Clear hazards so a long firing loop can't get the ship killed; park the ship in open space.
function isolate() {
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  game.powerups.length = 0; game.garbage.length = 0; game.bullets.length = 0;
  // FLAKE FIX (found by CS024 P3's regression sweep; PRE-EXISTING, not caused by that phase). nextWave()
  // places the dock at a RANDOM offset from the ship's spawn point, and this helper then teleports the
  // ship to a fixed (1800, 1000). On the unlucky rolls where that lands inside the dock's radius, the
  // real offload pass pops chain nodes the moment they are hooked — so §G's "one hooked canister spends
  // exactly one piece" saw an empty chain and failed, roughly 1 run in 30. CS024 P2 doubling DOCK_RADIUS
  // 44 -> 88 doubled the target it had to miss. Dropping the dock is the established idiom for this
  // (test-cs019-p1's quietRun does the same) and update() guards every dock read with `if (game.dock)`.
  game.dock = null;
  game.ship.x = 1800; game.ship.y = 1000; game.ship.vx = 0; game.ship.vy = 0;
  game.ship.invuln = 0; game.ship.cooldown = 0;
}
// One trigger-pull through the REAL fire block: force ready, clear the cap, fire once.
function firePull() {
  game.ship.cooldown = 0;
  game.bullets.length = 0;
  keys[" "] = true;
  update(DT);
}
const shotsFired = () => game.bullets.filter(b => !b.hostile).length;
// A minimal free-garbage stand-in the magnet pass accepts (only fields it reads + a no-op update).
function fakeCanister(x, y) { return { x, y, vx: 0, vy: 0, dead: false, spin: 0, spinRate: 0, mass: 1, pieces: 1, update() {} }; } // pieces:1 — hook now requires a single (v3.2 P1)
// One magnet hook: fresh empty chain + a canister sitting on the ship -> update() hooks it.
function hookOne() {
  game.chain.length = 0;
  game.garbage.length = 0;
  game.garbage.push(fakeCanister(game.ship.x, game.ship.y));
  update(DT);
}

// =====================================================================
console.log("(A) config + defaults (INVERTED: the mode fields are deleted)");
for (const dead of ["shotPowerupMode", "magnetMode", "chainGuardMode"])
  assert(!(dead in settings), `A: INVERTED BY CS024 P6 — settings.${dead} no longer exists`);
for (const dead of ["powerMode", "powerDuration", "POWERUP_DURATION", "MAGNET_DURATION"])
  assert(probe(dead) === "__ReferenceError__", `A: INVERTED BY CS024 P6 — ${dead} is deleted outright`);
assert(MENU_OPTIONS.includes("Difficulty"), "A: MENU_OPTIONS still has a Difficulty row (the SCREEN is kept, spec §3.7)");
assert(MENU_OPTIONS.indexOf("Difficulty") === MENU_OPTIONS.indexOf("Back") - 1, "A: Difficulty sits immediately before Back");
assert(POWERUP_BUDGET.rapid === RAPID_SHOTS && POWERUP_BUDGET.triple === TRIPLE_SHOTS && POWERUP_BUDGET.magnet === MAGNET_PIECES,
  "A: POWERUP_BUDGET maps rapid/triple/magnet to their constants");
assert([RAPID_SHOTS, TRIPLE_SHOTS, MAGNET_PIECES].every(n => Number.isFinite(n) && n > 0), "A: budget constants are positive numbers");

// =====================================================================
console.log("(B) INVERTED — powerActive(t) is exactly `powerBudget[t] > 0`, for EVERY type");
startGame(); isolate();
for (const t of POWERUP_DROP_TYPES) {
  game.powerBudget[t] = 0;
  assert(powerActive(t) === false, `B: ${t} at budget 0 reads INACTIVE`);
  game.powerBudget[t] = 0.5;   // a fraction is enough — engine's budget is fractional seconds
  assert(powerActive(t) === true, `B: ${t} at any positive budget reads ACTIVE`);
  game.powerBudget[t] = 0;
}
assert(POWERUP_DROP_TYPES.includes("engine"),
  "B: engine — once the ONE type that could never be counted — is now budgeted like the rest");

// =====================================================================
console.log("(C) INVERTED — there is no timer path: a pickup grants a BUDGET and use always spends it");
startGame(); isolate();
applyPowerup("rapid");
assert(game.powerBudget.rapid === RAPID_SHOTS, "C: a Rapid pickup grants its budget (no timer exists to arm instead)");
assert(powerActive("rapid"), "C: Rapid active via the budget");
firePull();
assert(game.powerBudget.rapid === RAPID_SHOTS - 1, "C: INVERTED — firing ALWAYS spends a shot now (no mode gates it)");
assert(near(game.ship.cooldown, RAPID_FIRE_COOLDOWN), "C: rapid cadence applies while the budget lasts");
// engine: fuel, granted from the live knob rather than a frozen duration
applyPowerup("engine");
assert(near(game.powerBudget.engine, DEBUG.engineBurnSeconds), "C: an Engine pickup grants DEBUG.engineBurnSeconds of FUEL");
// magnet: hooking always spends
startGame(); isolate(); applyPowerup("magnet");
assert(game.powerBudget.magnet === MAGNET_PIECES, "C: a Magnet pickup grants MAGNET_PIECES of budget");
hookOne();
assert(game.powerBudget.magnet === MAGNET_PIECES - 1 && game.chain.length === 1, "C: INVERTED — hooking ALWAYS spends one piece now (and still hooks)");

// =====================================================================
console.log("(D) Rapid ends after EXACTLY RAPID_SHOTS pulls; cadence flips to base");
startGame(); isolate();
applyPowerup("rapid");
assert(game.powerBudget.rapid === RAPID_SHOTS, "D: a Rapid pickup seeds exactly RAPID_SHOTS of budget");
firePull();
assert(game.powerBudget.rapid === RAPID_SHOTS - 1, "D: one pull spends one shot");
assert(near(game.ship.cooldown, RAPID_FIRE_COOLDOWN), "D: cadence is rapid while budget remains");
for (let i = 1; i < RAPID_SHOTS - 1; i++) firePull();        // pulls 2 .. RAPID_SHOTS-1
assert(game.powerBudget.rapid === 1 && powerActive("rapid"), "D: still active with 1 shot left");
firePull();                                                  // the RAPID_SHOTS-th pull
assert(game.powerBudget.rapid === 0 && !powerActive("rapid"), "D: Rapid ends exactly at RAPID_SHOTS pulls");
assert(near(game.ship.cooldown, RAPID_FIRE_COOLDOWN), "D: the last rapid pull still fired at rapid cadence");
firePull();                                                  // first post-expiry pull
assert(near(game.ship.cooldown, FIRE_COOLDOWN), "D: cadence returns to base after Rapid expires");

// =====================================================================
console.log("(E) a Triple 3-fan is ONE pull");
startGame(); isolate();
applyPowerup("triple");
assert(game.powerBudget.triple === TRIPLE_SHOTS, "E: Triple budget set to TRIPLE_SHOTS");
firePull();
assert(shotsFired() === 3, "E: one pull fired a 3-bullet fan");
assert(game.powerBudget.triple === TRIPLE_SHOTS - 1, "E: the 3-fan spent exactly ONE triple shot");

// =====================================================================
console.log("(F) Rapid + Triple budgets are independent");
startGame(); isolate();
applyPowerup("rapid"); applyPowerup("triple");
for (let i = 0; i < TRIPLE_SHOTS; i++) firePull();           // exhaust Triple first (TRIPLE_SHOTS < RAPID_SHOTS)
assert(game.powerBudget.triple === 0 && !powerActive("triple"), "F: Triple ends after TRIPLE_SHOTS pulls");
assert(game.powerBudget.rapid === RAPID_SHOTS - TRIPLE_SHOTS && powerActive("rapid"), "F: Rapid budget untouched by Triple's expiry (independent)");
firePull();
assert(shotsFired() === 1, "F: with Triple gone but Rapid live, a pull fires a single bullet");
assert(near(game.ship.cooldown, RAPID_FIRE_COOLDOWN), "F: cadence stays rapid while Rapid budget remains");
for (let i = 0; i < RAPID_SHOTS - TRIPLE_SHOTS - 1; i++) firePull();
assert(game.powerBudget.rapid === 0 && !powerActive("rapid"), "F: Rapid then ends on its own budget");

// =====================================================================
console.log("(G) Magnet ends after EXACTLY MAGNET_PIECES hooks (count at the hook)");
startGame(); isolate();
applyPowerup("magnet");
assert(game.powerBudget.magnet === MAGNET_PIECES, "G: a Magnet pickup seeds exactly MAGNET_PIECES of budget");
hookOne();
assert(game.chain.length === 1 && game.powerBudget.magnet === MAGNET_PIECES - 1, "G: one hooked canister spends exactly one piece (B-5-a: no double-spend on draw-then-hook)");
for (let i = 1; i < MAGNET_PIECES - 1; i++) hookOne();
assert(game.powerBudget.magnet === 1 && powerActive("magnet"), "G: still active with 1 piece left");
hookOne();
assert(game.powerBudget.magnet === 0 && !powerActive("magnet"), "G: Magnet ends exactly at MAGNET_PIECES hooks");
// once inactive, the widened pickup + budget spend stop
const chainWas = (game.chain.length = 0, game.garbage.length = 0, game.garbage.push(fakeCanister(game.ship.x, game.ship.y)), update(DT), game.chain.length);
assert(game.powerBudget.magnet === 0, "G: no further budget spend once Magnet is inactive");

// =====================================================================
console.log("(H) same-type pickup BANKS (v3.6 P4: adds, doesn't refresh) — magnitude never stacks");
startGame(); isolate();
applyPowerup("rapid");
for (let i = 0; i < 10; i++) firePull();
assert(game.powerBudget.rapid === RAPID_SHOTS - 10, "H: budget partially spent");
applyPowerup("rapid");
assert(game.powerBudget.rapid === RAPID_SHOTS - 10 + RAPID_SHOTS, "H: same-type pickup ADDS a full Rapid budget on top of what's left");
applyPowerup("rapid");
assert(game.powerBudget.rapid === RAPID_SHOTS - 10 + RAPID_SHOTS * 2, "H: a second pickup banks again (no ceiling)");
startGame(); isolate();
applyPowerup("magnet");
for (let i = 0; i < 5; i++) hookOne();
assert(game.powerBudget.magnet === MAGNET_PIECES - 5, "H: magnet budget partially spent");
applyPowerup("magnet");
assert(game.powerBudget.magnet === MAGNET_PIECES - 5 + MAGNET_PIECES, "H: same-type pickup ADDS a full Magnet budget on top of what's left");
// REPOINTED: the old "time mode banks its duration too" block becomes "EVERY type banks", which is the
// stronger claim CS024 P6 makes possible — engine and guard could never be banked before.
startGame(); isolate();
for (const t of POWERUP_DROP_TYPES) {
  const grant = powerBudgetAmount(t);
  applyPowerup(t); applyPowerup(t);
  assert(near(game.powerBudget[t], grant * 2), `H: ${t} BANKS — two pickups = 2x its grant, not refreshed to 1x`);
}
startGame(); isolate();
applyPowerup("rapid"); applyPowerup("rapid");
firePull();
assert(near(game.ship.cooldown, RAPID_FIRE_COOLDOWN), "H: magnitude never stacks — cadence after two Rapids is the same as after one");

// =====================================================================
console.log("(I) Difficulty screen: navigation, the one surviving toggle, persistence");
// CS016 P4 (§5): Difficulty's value rows lock while game.state === "playing" (a live run's rules can't
// change mid-run) — reaching them via Pause during a live game is no longer this section's scenario, so
// this drives the UNLOCKED path (post-game, via the gameover root) to keep exercising toggle +
// persistence. The lock itself is covered in test-cs016-p4.js.
startGame(); game.state = "gameover"; game.paused = false; game.menu.screen = null;
openPause();                                                 // gameover root
game.menu.index = rootItems().indexOf("Options"); menuInput("confirm");
assert(game.menu.screen === "options", "I: reached Options");
game.menu.index = MENU_OPTIONS.indexOf("Difficulty"); menuInput("confirm");
assert(game.menu.screen === "difficulty" && game.menu.index === 0, "I: Options -> Difficulty (cursor on first row)");
// REPOINTED BY CS024 P6 (spec §3.7): FOUR value rows down to ONE. The shot/magnet/chain-guard rows are
// deleted with the modes they selected; auto-shield — index 2 before, index 0 now — is the whole screen.
assert(DIFFICULTY_ROWS.join(",") === "autoshield,back", `I: DIFFICULTY_ROWS is exactly [autoshield, back] (got ${DIFFICULTY_ROWS.join(",")})`);
menuInput("right"); assert(settings.autoShield === true,  "I: ► on auto-shield row turns it On");
menuInput("left");  assert(settings.autoShield === false, "I: ◄ on auto-shield row turns it Off");
menuInput("down");  assert(game.menu.index === 1, "I: down -> Back row (the row AFTER the one value row)");
menuInput("confirm");
assert(game.menu.screen === "options" && game.menu.index === MENU_OPTIONS.indexOf("Difficulty"),
  "I: Back returns to Options with the cursor on Difficulty");
// ESC/back from the difficulty screen also returns to Options
game.menu.screen = "difficulty"; game.menu.index = 0;
menuInput("back");
assert(game.menu.screen === "options" && game.menu.index === MENU_OPTIONS.indexOf("Difficulty"), "I: back action also -> Options");
closePause();

// persist round-trip driven by the menu toggle (it calls saveSettings)
game.menu.screen = "difficulty"; game.menu.index = 0; menuInput("right"); // auto-shield On
settings.autoShield = false;                                              // wipe in-memory
loadSettings();
assert(settings.autoShield === true, "I: the menu toggle persisted + a reload restores it");
// direct save/load round-trip
settings.autoShield = false; saveSettings();
settings.autoShield = true; loadSettings();
assert(settings.autoShield === false, "I: direct saveSettings/loadSettings round-trip");
// REPOINTED BY CS024 P6: A PRE-EDIT SAVE LOADS CLEANLY. The three mode keys every earlier build wrote
// are now ORPHANED keys on the frozen afd_settings_v1 — ignored under known-value-else-default, with no
// schema bump, no rename and no migration shim — and every field this build DOES understand still loads.
lsStore[STORAGE_KEY] = JSON.stringify({
  vol: { master: 0.8, sfx: 1, music: 1 }, bindings: {},
  shotPowerupMode: "shots", magnetMode: "pieces", chainGuardMode: "count",   // the three orphans
  musicTrack: "drift", autoShield: true, captions: false
});
settings.autoShield = false; settings.musicTrack = "zen"; settings.captions = true;
loadSettings();
assert(settings.autoShield === true, "I: a pre-CS024-P6 save loads its autoShield normally");
assert(settings.musicTrack === "drift" && settings.captions === false, "I: ...and every other field it understands");
for (const orphan of ["shotPowerupMode", "magnetMode", "chainGuardMode"])
  assert(!(orphan in settings), `I: ...while the orphaned ${orphan} key is ignored, not resurrected onto settings`);
// an OLD save with no mode keys at all still loads (additive fields, no schema bump)
lsStore[STORAGE_KEY] = JSON.stringify({ vol: { master: 1, sfx: 1, music: 1 }, bindings: {} });
settings.autoShield = true;
loadSettings();
assert(settings.autoShield === true, "I: an old save missing every additive key loads without error -> runtime values kept");

// =====================================================================
console.log("(J) Difficulty screen + the budgeted HUD draw without throwing");
startGame();
game.state = "playing"; game.paused = true;
game.menu.screen = "difficulty"; game.menu.index = 0;
settings.autoShield = true;  draw();   // difficulty screen, toggle On
settings.autoShield = false; draw();   // ...and Off
game.menu.index = 1;         draw();   // ...with Back focused (index past the help array — no HELP read)
game.menu.screen = "options"; draw();  // Options with the Difficulty row
game.paused = false;
// the budgeted HUD: every row active at once, including the two live-knob types
for (const t of POWERUP_DROP_TYPES) applyPowerup(t);
draw();
assert(true, "J: drawing the Difficulty screen, Options, and the fully-active budgeted HUD did not throw");

// =====================================================================
// (K) v3.4 P4 — the Magnet gets a DOUBLED duration (30 s), in BOTH expiry modes, without
//     touching the shared POWERUP_DURATION the other three effects use.
// =====================================================================
console.log("(K) INVERTED — the duration table is deleted; grant size is powerBudgetAmount(), per type");
// v3.4 P4's durable half was "the per-type quantity is read through a FUNCTION, never a shared literal,
// and it genuinely differs by type." That survives verbatim — only the function's name and unit moved.
assert(MAGNET_PIECES === 40, `K: MAGNET_PIECES === 40 (v3.4 P4: 20->40; got ${MAGNET_PIECES})`);
assert(POWERUP_BUDGET.magnet === 40, `K: POWERUP_BUDGET.magnet reads MAGNET_PIECES === 40 for free (got ${POWERUP_BUDGET.magnet})`);
assert(powerBudgetAmount("rapid") === RAPID_SHOTS && powerBudgetAmount("triple") === TRIPLE_SHOTS &&
  powerBudgetAmount("magnet") === MAGNET_PIECES, "K: the three frozen grants come from POWERUP_BUDGET");
assert(!("guard" in POWERUP_BUDGET) && !("engine" in POWERUP_BUDGET),
  "K: ...and the two LIVE-knob types are deliberately absent from that table");
assert(powerBudgetAmount("guard") === DEBUG.chainGuardIntercepts, "K: guard's grant is the live DEBUG.chainGuardIntercepts");
assert(powerBudgetAmount("engine") === DEBUG.engineBurnSeconds, "K: engine's grant is the live DEBUG.engineBurnSeconds");
// REPOINTED BY CS024 P7 — Gate B Q11 retuned the tank 5.0 -> 10.0 s. The claim under test is unchanged:
// the constant is the ONE source and it seeds the knob.
assert(ENGINE_BURN_SECONDS === 10.0 && DEBUG.engineBurnSeconds === 10.0, `K: ENGINE_BURN_SECONDS is 10.0 s and seeds the knob (got ${ENGINE_BURN_SECONDS})`);
// a retune of the live knob moves the grant on the NEXT pickup, without a reload
DEBUG.engineBurnSeconds = 9;
startGame(); isolate(); applyPowerup("engine");
assert(near(game.powerBudget.engine, 9), `K: a retuned engineBurnSeconds grants 9 s of fuel (got ${game.powerBudget.engine})`);
DEBUG.engineBurnSeconds = ENGINE_BURN_SECONDS;
startGame(); isolate();
for (const t of POWERUP_DROP_TYPES) { applyPowerup(t); assert(near(game.powerBudget[t], powerBudgetAmount(t)), `K: applyPowerup("${t}") grants exactly powerBudgetAmount("${t}")`); }

// (K2) CS009 P4 SUPERSEDES v3.4 P4 here: the HUD active-effect FILL BAR is gone — every powerup row is
// now a ring (drawn via drawRingArc/glowStroke, not fillRect). So the magnet row draws NO bar fill at
// all. The powerDuration(30)-not-POWERUP_DURATION(15) denominator invariant this block used to guard is
// now covered by test-cs009-p4.js section A (magnet's value arc must sweep a FULL turn at powerFx=30,
// not two), which reads the ARC angle instead of a bar width.
console.log("(K2) CS009 P4: the powerup fill bar is gone — magnet row draws no fillRect (ring superseded it)");
{
  // A recording 2D context: no-ops everything, but records fillRect(x,y,w,h) calls so we can prove none.
  function makeRecordingCtx() {
    const calls = [];
    return new Proxy({}, {
      get(t, p) {
        if (p === "calls") return calls;
        if (p === "fillRect") return (...args) => calls.push(args);
        return (..._a) => {};
      },
      set(t, p, v) { t[p] = v; return true; }
    });
  }
  const recCtx = makeRecordingCtx();
  const recCanvas = { width: 0, height: 0, style: {}, getContext: () => recCtx };
  const recDoc = { getElementById: () => recCanvas };
  const B = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { startGame, draw, game, settings };"
  )(windowStub, recDoc, performanceStub, rafStub, navigatorStub, global.localStorage);
  B.startGame();
  B.game.state = "playing"; B.game.paused = false;
  // ONLY the magnet is active, at HALF its budget. Old build: a bar fill at x=59, h=4. Now: none.
  B.game.powerBudget = { rapid: 0, triple: 0, magnet: 20, engine: 0, guard: 0 };
  recCtx.calls.length = 0;
  B.draw();
  const bar = recCtx.calls.find(a => a.length === 4 && a[0] === 59 && a[3] === 4);
  assert(!bar, "K2: no active-effect bar fill (fillRect at x=59, h=4) — the ring replaced it (CS009 P4)");
}

// =====================================================================
// (L) v3.6 P4 + CS009 P2/P4 — HUD rebuild: TARGETS gone; shield + hull are now the HULL ring (P2, no
// fill bar / no MAX tag); powerup rows are RINGS (P4) — count-mode draws its budget number, time-mode
// draws seconds text, and NEITHER draws a fill bar.
// =====================================================================
console.log("(L) HUD rebuild — TARGETS removed, hull/shield ring (P2), powerup rings count vs time (P4)");
{
  // A recording ctx that captures fillRect/fillText calls tagged with the fillStyle active at call time.
  function makeStyledRecordingCtx() {
    const calls = [];
    let fillStyle = null;
    return new Proxy({}, {
      get(t, p) {
        if (p === "calls") return calls;
        if (p === "fillRect") return (...args) => calls.push({ fn: "fillRect", args, fillStyle });
        if (p === "fillText") return (...args) => calls.push({ fn: "fillText", args, fillStyle });
        return (..._a) => {};
      },
      set(t, p, v) { if (p === "fillStyle") fillStyle = v; t[p] = v; return true; }
    });
  }
  const recCtx = makeStyledRecordingCtx();
  const recCanvas = { width: 0, height: 0, style: {}, getContext: () => recCtx };
  const recDoc = { getElementById: () => recCanvas };
  const C = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { startGame, draw, game, settings, COLOR, applyPowerup, SHIP_MAX_HP, POWERUP_DROP_TYPES };"
  )(windowStub, recDoc, performanceStub, rafStub, navigatorStub, global.localStorage);
  C.startGame();
  C.game.state = "playing"; C.game.paused = false;

  // (L1) no TARGETS text anywhere in a plain playing-state draw.
  recCtx.calls.length = 0;
  C.draw();
  const targetsText = recCtx.calls.find(c => c.fn === "fillText" && String(c.args[0]).includes("TARGETS"));
  assert(!targetsText, "L1: no TARGETS text is drawn");

  // (L2) CS009 P2 SUPERSEDES v3.6 P4 here: the SHIELD fill bar is gone — shield energy is now the
  // unlabeled concentric inner arc of the HULL ring (FORK-1 A). No "SHIELD" text label survives.
  const shieldLabel = recCtx.calls.find(c => c.fn === "fillText" && c.args[0] === "SHIELD");
  assert(!shieldLabel, "L2: SHIELD fill bar + label are gone (shield is now the HULL ring's inner arc)");

  // (L3) CS009 P2: the hull fill bar and its "MAX" text tag are gone — replaced by the HULL ring, whose
  // gold arc (not a text tag) is the full-hull tell. No fillRect hull bar and no "MAX" fillText at any HP.
  C.game.ship.hp = C.SHIP_MAX_HP;
  recCtx.calls.length = 0;
  C.draw();
  // the old hull bar fill lived at x=93 (hpx+1), y=99 (hpy+1, row=104); assert nothing draws there now.
  const hullMaxFill = recCtx.calls.find(c => c.fn === "fillRect" && c.args[0] === 93 && c.args[1] === 99 && c.args[3] === 6);
  assert(!hullMaxFill, "L3: no hull fill bar at max HP (replaced by the HULL ring arc)");
  const maxTag = recCtx.calls.find(c => c.fn === "fillText" && c.args[0] === "MAX");
  assert(!maxTag, "L3: no MAX text tag at full HP (the gold ring carries the FLAG-E meaning now)");

  C.game.ship.hp = C.SHIP_MAX_HP - 1; // 99%-ish, NOT max
  recCtx.calls.length = 0;
  C.draw();
  const hull99Fill = recCtx.calls.find(c => c.fn === "fillRect" && c.args[0] === 93 && c.args[1] === 99 && c.args[3] === 6);
  assert(!hull99Fill, "L3: no hull fill bar just below max HP either");
  const noMaxTag = recCtx.calls.find(c => c.fn === "fillText" && c.args[0] === "MAX");
  assert(!noMaxTag, "L3: no MAX tag when HP is just below max");
  C.game.ship.hp = C.SHIP_MAX_HP;

  // (L4) a budgeted powerup row: CS009 P4 keeps the "no bar, plain number" read, the row is a ring, the
  // number sits at x=64, and it is the raw budget with NO "s" suffix. No fillRect anywhere in the row
  // (the number is fillText via drawText; the ring is a stroked arc).
  C.applyPowerup("rapid");
  recCtx.calls.length = 0;
  C.draw();
  const rapidCountText = recCtx.calls.find(c => c.fn === "fillText" && c.args[0] === String(C.game.powerBudget.rapid) && c.args[1] === 64);
  assert(!!rapidCountText, "L4: count-mode Rapid row draws the plain remaining-shots number at x=64 (no 's')");
  const rapidBarFill = recCtx.calls.find(c => c.fn === "fillRect" && c.args[0] === 59 && c.args[3] === 4);
  assert(!rapidBarFill, "L4: count-mode Rapid row draws NO bar rect (never did; the row is now a ring)");

  // (L5) INVERTED BY CS024 P6: there is no time-mode row left, so NO row anywhere draws an "Ns" string.
  // The old claim ("a time row draws its seconds as Ns text") is exactly what must now be false — and
  // the engine row is the case that would regress it first, since its budget really is in seconds.
  C.startGame();
  C.game.state = "playing"; C.game.paused = false;
  for (const t of C.POWERUP_DROP_TYPES) C.applyPowerup(t);
  recCtx.calls.length = 0;
  C.draw();
  const rapidTimeBar = recCtx.calls.find(c => c.fn === "fillRect" && c.args[0] === 59 && c.args[3] === 4);
  assert(!rapidTimeBar, "L5: no active-effect fill bar (replaced by the ring arc, CS009 P4)");
  const secsText = recCtx.calls.find(c => c.fn === "fillText" && c.args[1] === 64 && /^\d+s$/.test(String(c.args[0])));
  assert(!secsText, "L5: INVERTED — NO powerup row draws an 'Ns' seconds string any more (every row is a budget)");
  const engineNum = recCtx.calls.find(c => c.fn === "fillText" && c.args[1] === 64 &&
    String(c.args[0]) === String(Math.ceil(C.game.powerBudget.engine)));
  assert(!!engineNum, "L5: the engine row draws its fuel as a plain ceil'd number (no suffix), not '5s'");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
