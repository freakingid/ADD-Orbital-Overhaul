// Headless test for v3.0 Phase 5 — Difficulty screen + powerup expiry modes (B-4 / B-5).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL fire block / magnet pass / menu state machine / persistence
// — no reimplementation of the logic under test.
//
//   node scratchpad/test-p5.js
//
// Checks:
//  (A) config + defaults: modes default "time"; MENU_OPTIONS has "Difficulty" right before "Back";
//      POWERUP_BUDGET maps to the shot/piece constants.
//  (B) powerMode routing: rapid/triple follow shotPowerupMode, magnet follows magnetMode, engine
//      is ALWAYS "time" (never configurable).
//  (C) default "time" reproduces the shipped behaviour EXACTLY — firing/hooking never touches the
//      count budgets; the timer path alone drives activity.
//  (D) "shots" mode ends Rapid after EXACTLY RAPID_SHOTS trigger-pulls; cadence flips to base after.
//  (E) a Triple 3-fan is ONE pull (3 bullets, budget -1).
//  (F) Rapid+Triple budgets decrement independently and each ends on its own.
//  (G) "pieces" mode ends Magnet after EXACTLY MAGNET_PIECES hooks; a draw-then-hook counts once (B-5-a).
//  (H) v3.6 P4: same-type pickup BANKS (adds duration/budget on top of what's left, never refreshes);
//      magnitude (fire cadence) never stacks.
//  (I) Difficulty screen: reachable via Options, toggles flip + persist, Back returns to Options;
//      persistence round-trips and tolerates an old save missing the mode keys.
//  (J) the Difficulty screen + the count-mode HUD draw without throwing.
//  (K/K2) Magnet's doubled duration and the HUD bar denominator that must track it.
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
  "settings", "powerActive", "powerMode", "applyPowerup", "saveSettings", "loadSettings",
  "openPause", "closePause", "menuInput", "rootItems", "MENU_OPTIONS", "STORAGE_KEY",
  "RAPID_SHOTS", "TRIPLE_SHOTS", "MAGNET_PIECES", "POWERUP_DURATION", "POWERUP_BUDGET",
  "MAGNET_DURATION", "powerDuration",
  "RAPID_FIRE_COOLDOWN", "FIRE_COOLDOWN", "AudioSys"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, draw, game, keys,
  settings, powerActive, powerMode, applyPowerup, saveSettings, loadSettings,
  openPause, closePause, menuInput, rootItems, MENU_OPTIONS, STORAGE_KEY,
  RAPID_SHOTS, TRIPLE_SHOTS, MAGNET_PIECES, POWERUP_DURATION, POWERUP_BUDGET,
  MAGNET_DURATION, powerDuration,
  RAPID_FIRE_COOLDOWN, FIRE_COOLDOWN, AudioSys
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
console.log("(A) config + defaults");
assert(settings.shotPowerupMode === "time", "A: shotPowerupMode defaults to time");
assert(settings.magnetMode === "time", "A: magnetMode defaults to time");
assert(MENU_OPTIONS.includes("Difficulty"), "A: MENU_OPTIONS has a Difficulty row");
assert(MENU_OPTIONS.indexOf("Difficulty") === MENU_OPTIONS.indexOf("Back") - 1, "A: Difficulty sits immediately before Back");
assert(POWERUP_BUDGET.rapid === RAPID_SHOTS && POWERUP_BUDGET.triple === TRIPLE_SHOTS && POWERUP_BUDGET.magnet === MAGNET_PIECES,
  "A: POWERUP_BUDGET maps rapid/triple/magnet to their constants");
assert([RAPID_SHOTS, TRIPLE_SHOTS, MAGNET_PIECES].every(n => Number.isFinite(n) && n > 0), "A: budget constants are positive numbers");

// =====================================================================
console.log("(B) powerMode routing (engine is never configurable)");
settings.shotPowerupMode = "shots"; settings.magnetMode = "pieces";
assert(powerMode("rapid") === "shots" && powerMode("triple") === "shots", "B: rapid/triple follow shotPowerupMode");
assert(powerMode("magnet") === "pieces", "B: magnet follows magnetMode");
assert(powerMode("engine") === "time", "B: engine is ALWAYS time, even with count modes set");
settings.shotPowerupMode = "time"; settings.magnetMode = "time";
assert(powerMode("rapid") === "time" && powerMode("magnet") === "time", "B: modes flip back to time");

// =====================================================================
console.log("(C) default time mode reproduces shipped behaviour (no budget side-effects)");
settings.shotPowerupMode = "time"; settings.magnetMode = "time";
startGame(); isolate();
applyPowerup("rapid");
assert(near(game.powerFx.rapid, POWERUP_DURATION) && game.powerBudget.rapid === 0, "C: time-mode Rapid sets the timer, not the budget");
assert(powerActive("rapid"), "C: Rapid active via the timer");
firePull();
assert(game.powerBudget.rapid === 0, "C: firing in time mode does NOT touch the shot budget");
assert(near(game.ship.cooldown, RAPID_FIRE_COOLDOWN), "C: rapid cadence still applies in time mode");
// engine always timed
applyPowerup("engine");
assert(near(game.powerFx.engine, POWERUP_DURATION), "C: engine uses the timer (always)");
// magnet time mode: hooking does not spend a budget
startGame(); isolate(); applyPowerup("magnet");
assert(near(game.powerFx.magnet, MAGNET_DURATION) && game.powerBudget.magnet === 0, "C: time-mode Magnet sets the timer (MAGNET_DURATION, v3.4 P4), not the budget");
hookOne();
assert(game.powerBudget.magnet === 0 && game.chain.length === 1, "C: hooking in time mode spends no budget (and still hooks)");

// =====================================================================
console.log("(D) shots mode: Rapid ends after EXACTLY RAPID_SHOTS pulls; cadence flips to base");
settings.shotPowerupMode = "shots"; settings.magnetMode = "time";
startGame(); isolate();
applyPowerup("rapid");
assert(game.powerBudget.rapid === RAPID_SHOTS && game.powerFx.rapid === 0, "D: shots-mode Rapid sets the budget, not the timer");
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
console.log("(E) shots mode: a Triple 3-fan is ONE pull");
settings.shotPowerupMode = "shots";
startGame(); isolate();
applyPowerup("triple");
assert(game.powerBudget.triple === TRIPLE_SHOTS, "E: Triple budget set to TRIPLE_SHOTS");
firePull();
assert(shotsFired() === 3, "E: one pull fired a 3-bullet fan");
assert(game.powerBudget.triple === TRIPLE_SHOTS - 1, "E: the 3-fan spent exactly ONE triple shot");

// =====================================================================
console.log("(F) shots mode: Rapid + Triple budgets are independent");
settings.shotPowerupMode = "shots";
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
console.log("(G) pieces mode: Magnet ends after EXACTLY MAGNET_PIECES hooks (count at the hook)");
settings.magnetMode = "pieces"; settings.shotPowerupMode = "time";
startGame(); isolate();
applyPowerup("magnet");
assert(game.powerBudget.magnet === MAGNET_PIECES && game.powerFx.magnet === 0, "G: pieces-mode Magnet sets the budget, not the timer");
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
settings.shotPowerupMode = "shots"; settings.magnetMode = "pieces";
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
// time mode: duration banks too, and magnitude (fire cadence) is unaffected by stacking.
settings.shotPowerupMode = "time";
startGame(); isolate();
applyPowerup("rapid");
assert(near(game.powerFx.rapid, POWERUP_DURATION), "H: first Rapid pickup arms the timer to POWERUP_DURATION");
applyPowerup("rapid");
assert(near(game.powerFx.rapid, POWERUP_DURATION * 2), "H: a second Rapid pickup BANKS — timer is 2x duration, not refreshed to 1x");
firePull();
assert(near(game.ship.cooldown, RAPID_FIRE_COOLDOWN), "H: magnitude never stacks — cadence after two Rapids is the same as after one");
settings.shotPowerupMode = "time"; settings.magnetMode = "time"; // restore defaults for later sections

// =====================================================================
console.log("(I) Difficulty screen: navigation, toggles, persistence");
settings.shotPowerupMode = "time"; settings.magnetMode = "time";
startGame(); openPause();                                   // play root
game.menu.index = rootItems().indexOf("Options"); menuInput("confirm");
assert(game.menu.screen === "options", "I: reached Options");
game.menu.index = MENU_OPTIONS.indexOf("Difficulty"); menuInput("confirm");
assert(game.menu.screen === "difficulty" && game.menu.index === 0, "I: Options -> Difficulty (cursor on first row)");
// shot row (index 0): right = shots, left = time
menuInput("right"); assert(settings.shotPowerupMode === "shots", "I: ► on shot row selects Shots");
menuInput("left");  assert(settings.shotPowerupMode === "time", "I: ◄ on shot row selects Time");
menuInput("down");  assert(game.menu.index === 1, "I: down -> magnet row");
menuInput("right"); assert(settings.magnetMode === "pieces", "I: ► on magnet row selects Pieces");
menuInput("left");  assert(settings.magnetMode === "time", "I: ◄ on magnet row selects Time");
menuInput("down");  assert(game.menu.index === 2, "I: down -> Back row");
menuInput("confirm");
assert(game.menu.screen === "options" && game.menu.index === MENU_OPTIONS.indexOf("Difficulty"),
  "I: Back returns to Options with the cursor on Difficulty");
// ESC/back from the difficulty screen also returns to Options
game.menu.screen = "difficulty"; game.menu.index = 0;
menuInput("back");
assert(game.menu.screen === "options" && game.menu.index === MENU_OPTIONS.indexOf("Difficulty"), "I: back action also -> Options");
closePause();

// persist round-trip driven by the menu toggles (they call saveSettings)
game.menu.screen = "difficulty"; game.menu.index = 0; menuInput("right"); // shots
game.menu.index = 1; menuInput("right");                                   // pieces
settings.shotPowerupMode = "time"; settings.magnetMode = "time";           // wipe in-memory
loadSettings();
assert(settings.shotPowerupMode === "shots" && settings.magnetMode === "pieces", "I: menu toggles persisted + reload restores them");
// direct save/load round-trip
settings.shotPowerupMode = "shots"; settings.magnetMode = "pieces"; saveSettings();
settings.shotPowerupMode = "time"; settings.magnetMode = "time"; loadSettings();
assert(settings.shotPowerupMode === "shots" && settings.magnetMode === "pieces", "I: direct saveSettings/loadSettings round-trip");
// tolerate an OLD save with no mode keys (additive fields, no schema bump)
lsStore[STORAGE_KEY] = JSON.stringify({ vol: { master: 1, sfx: 1, music: 1 }, bindings: {} });
settings.shotPowerupMode = "time"; settings.magnetMode = "time";
loadSettings();
assert(settings.shotPowerupMode === "time" && settings.magnetMode === "time", "I: an old save missing the mode keys loads without error -> defaults kept");
// a corrupt mode value falls back to default (not stuck)
lsStore[STORAGE_KEY] = JSON.stringify({ shotPowerupMode: "bogus", magnetMode: "pieces" });
settings.shotPowerupMode = "time"; settings.magnetMode = "time";
loadSettings();
assert(settings.shotPowerupMode === "time" && settings.magnetMode === "pieces", "I: a bogus mode value is ignored; a valid one still loads");

// =====================================================================
console.log("(J) Difficulty screen + count-mode HUD draw without throwing");
settings.shotPowerupMode = "shots"; settings.magnetMode = "pieces";
startGame();
game.state = "playing"; game.paused = true;
game.menu.screen = "difficulty"; game.menu.index = 0;
draw(); // difficulty screen, both toggles in count state
settings.shotPowerupMode = "time"; settings.magnetMode = "time";
draw(); // difficulty screen, both toggles in time state
game.menu.screen = "options"; draw();  // Options with the new Difficulty row
game.paused = false;
// count-mode HUD: active Rapid/Triple (shots) + Magnet (pieces) render the numeric-count bars
settings.shotPowerupMode = "shots"; settings.magnetMode = "pieces";
applyPowerup("rapid"); applyPowerup("triple"); applyPowerup("magnet"); applyPowerup("engine");
draw();
assert(true, "J: drawing the Difficulty screen, Options, and the count-mode HUD did not throw");

// =====================================================================
// (K) v3.4 P4 — the Magnet gets a DOUBLED duration (30 s), in BOTH expiry modes, without
//     touching the shared POWERUP_DURATION the other three effects use.
// =====================================================================
console.log("(K) v3.4 P4: Magnet duration doubled (30 s) in time AND pieces modes; other effects unchanged");
// the powerDuration(type) helper mirrors powerMode(type): Magnet is the one long effect.
assert(MAGNET_DURATION === 30 && MAGNET_DURATION === POWERUP_DURATION * 2, `K: MAGNET_DURATION === 30 === 2*POWERUP_DURATION (got ${MAGNET_DURATION})`);
assert(POWERUP_DURATION === 15, `K: POWERUP_DURATION still 15 — NOT doubled (got ${POWERUP_DURATION})`);
assert(powerDuration("magnet") === 30, `K: powerDuration("magnet") === 30 (got ${powerDuration("magnet")})`);
for (const t of ["rapid", "triple", "engine"]) {
  assert(powerDuration(t) === 15, `K: powerDuration("${t}") === 15 — the other three keep the shared 15 s (got ${powerDuration(t)})`);
}
// time mode: applyPowerup("magnet") sets powerFx to 30, while the other three set 15.
settings.shotPowerupMode = "time"; settings.magnetMode = "time";
startGame(); isolate(); applyPowerup("magnet");
assert(near(game.powerFx.magnet, 30), `K: time-mode applyPowerup("magnet") arms powerFx.magnet to 30 (got ${game.powerFx.magnet})`);
startGame(); isolate();
for (const t of ["rapid", "triple", "engine"]) { applyPowerup(t); assert(near(game.powerFx[t], 15), `K: applyPowerup("${t}") still arms to 15 (got ${game.powerFx[t]})`); }
// pieces mode: the budget doubled for free (POWERUP_BUDGET reads MAGNET_PIECES, now 40).
assert(MAGNET_PIECES === 40, `K: MAGNET_PIECES === 40 (v3.4 P4: 20->40; got ${MAGNET_PIECES})`);
assert(POWERUP_BUDGET.magnet === 40, `K: POWERUP_BUDGET.magnet reads MAGNET_PIECES === 40 for free (got ${POWERUP_BUDGET.magnet})`);
settings.magnetMode = "pieces";
startGame(); isolate(); applyPowerup("magnet");
assert(game.powerBudget.magnet === 40 && near(game.powerFx.magnet, 0), `K: pieces-mode applyPowerup("magnet") arms the budget to 40, not the timer (got ${game.powerBudget.magnet})`);
settings.magnetMode = "time"; // restore

// (K2) The HUD active-effect bar DENOMINATOR uses powerDuration(t), NOT the raw POWERUP_DURATION.
// Miss that and the magnet bar renders permanently over-full. Drive the REAL draw() through a recording
// ctx and read the bar's fill width: at powerFx.magnet = 15 (half of 30) the fill must be HALF, not full.
console.log("(K2) v3.4 P4: the HUD magnet bar denominator is powerDuration(30), not POWERUP_DURATION(15) — real draw()");
{
  // A recording 2D context: no-ops everything, but records fillRect(x,y,w,h) calls so we can read the bar.
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
  B.settings.shotPowerupMode = "time"; B.settings.magnetMode = "time";
  B.startGame();
  B.game.state = "playing"; B.game.paused = false;
  // ONLY the magnet is active, at HALF its (doubled) duration -> the bar should read frac 0.5.
  B.game.powerFx = { rapid: 0, triple: 0, magnet: 15, engine: 0 };
  B.game.powerBudget = { rapid: 0, triple: 0, magnet: 0, engine: 0 };
  recCtx.calls.length = 0;
  B.draw();
  // The active-effect bar fill is the unique fillRect at x=59 (ppx+1) with height 4 (ph-2); its width is
  // (pw-2)*clamp01(frac) = 94*frac. frac = powerFx.magnet / powerDuration("magnet") = 15/30 = 0.5 -> 47.
  // With the bug (denominator POWERUP_DURATION=15) frac would be 1.0 -> width 94 (clamped, over-full).
  const bar = recCtx.calls.find(a => a.length === 4 && a[0] === 59 && a[3] === 4);
  assert(!!bar, "K2: found the active-effect bar fill (fillRect at x=59, h=4) with the magnet active");
  assert(bar && Math.abs(bar[2] - 47) < 0.5, `K2: bar fill width is HALF (47 px = 94*0.5), proving denom 30 not 15 (got ${bar ? bar[2].toFixed(1) : "n/a"})`);
}

// =====================================================================
// (L) v3.6 P4 — HUD rebuild: TARGETS gone, shield in the left column, hull reads distinctly at max,
// count-mode powerup rows draw no bar (glyph + number only), time-mode rows keep their bar.
// =====================================================================
console.log("(L) v3.6 P4: HUD rebuild — TARGETS removed, shield moved, hull-at-max tell, count vs time rows");
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
    scriptSrc + "\n;return { startGame, draw, game, settings, COLOR, applyPowerup, SHIP_MAX_HP };"
  )(windowStub, recDoc, performanceStub, rafStub, navigatorStub, global.localStorage);
  C.settings.shotPowerupMode = "time"; C.settings.magnetMode = "time";
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

  // (L4) count-mode powerup row: no bar rect, just the glyph + a plain number.
  C.settings.shotPowerupMode = "shots"; C.settings.magnetMode = "time";
  C.applyPowerup("rapid");
  recCtx.calls.length = 0;
  C.draw();
  // the count-mode row's number is drawn at x=58 (no bar drawn at ppx=58..154 for this row); the
  // time-mode bar (when present) draws a strokeRect+fillRect pair at ppx=58 — count mode must not.
  const rapidCountText = recCtx.calls.find(c => c.fn === "fillText" && c.args[0] === String(C.game.powerBudget.rapid) && c.args[1] === 58);
  assert(!!rapidCountText, "L4: count-mode Rapid row draws the plain remaining-shots number");
  const rapidBarFill = recCtx.calls.find(c => c.fn === "fillRect" && c.args[0] === 59 && c.args[3] === 4);
  assert(!rapidBarFill, "L4: count-mode Rapid row draws NO bar rect");

  // (L5) time-mode powerup row still draws its clamped bar.
  C.settings.shotPowerupMode = "time";
  C.startGame();
  C.game.state = "playing"; C.game.paused = false;
  C.applyPowerup("rapid");
  recCtx.calls.length = 0;
  C.draw();
  const rapidTimeBar = recCtx.calls.find(c => c.fn === "fillRect" && c.args[0] === 59 && c.args[3] === 4);
  assert(!!rapidTimeBar, "L5: time-mode Rapid row still draws its remaining-duration bar");
}

// =====================================================================
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
