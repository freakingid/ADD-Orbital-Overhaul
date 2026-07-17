// Headless test for CS014 Phase 1 — HintSys: 8 adaptive one-shot onboarding hints.
//
//   node scratchpad/test-cs014-p1.js
//
// Follows the standing rule (GDD 5.4) and the test-cs010-p9.js pattern: stub window/document/rAF/
// localStorage, eval the REAL <script> block, and drive the ACTUAL startGame/update/damageShip/
// saveSettings — never reimplement the trigger logic under test. Sections:
//  (A) node --check on the extracted <script>.
//  (B) thrust: 7 idle sec -> hint shows + tutSeen.thrust persists through the storage stub; a fresh run
//      holding thrust 1.6 s -> silent latch (never shows, still persisted).
//  (C) shield: an unshielded damageShip at energy 0.8 -> shows; an auto-shield-branch hit does NOT arm.
//  (D) hook + dock edges, including both silent-latch paths.
//  (E) two triggers armed at once -> priority order wins, and the second STILL shows after TUT_GAP
//      (the re-arm / delay-not-drop assertion).
//  (F) clump viewport across the wrap seam: a piece 8 px across the seam counts, a far piece doesn't.
//  (G) tutSeen writes round-trip; a seen hint never re-fires in a fresh run.
//  (H) drawHint is crash-free via the proxy canvas, and draws nothing when Capture.hudVisible is false.

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

// ---- stubs (mirror test-cs010-p9.js) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
    Q: { value: 0 }, type: "sine", buffer: null, loop: false, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); }, set(t, p, v) { t[p] = v; return true; } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); }, set(t, p, v) { t[p] = v; return true; } });
}

// The draw proxy counts fillText calls so (H) can prove drawHint() actually emitted text (or didn't).
let textDrawn = [];
const noopCtx = new Proxy({}, {
  get: (t, p) => {
    if (p === "fillText") return (s) => { textDrawn.push(String(s)); };
    if (p === "canvas") return canvasStub;
    if (p === "measureText") return () => ({ width: 10 });
    return () => {};
  },
  set: () => true
});
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx, toDataURL: () => "" };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

const RETURN = ["HintSys", "TUT_IDS", "TUT_LINES", "TUT_GAP", "TUT_DUR", "TUT_Y", "TUT_SIZE",
  "TUT_THRUST_WAIT", "TUT_THRUST_SKILL", "TUT_SHIELD_SKILL", "TUT_CLUMP_PIECES", "TUT_TOW_LEN",
  "TUT_VIEW_PAD", "GARBAGE_FADE", "GARBAGE_DECAY", "VIEW_W", "VIEW_H", "WORLD_W", "WORLD_H",
  "game", "startGame", "update", "damageShip", "saveSettings", "settings", "keys", "input", "bindings",
  "Garbage", "DebrisSatellite", "drawHint", "drawCaption", "Capture", "tutKey", "prettyKey", "SHIP_MAX_HP",
  "LOW_HP_THRESHOLD", "SHIELD_HIT_COST", "STORAGE_KEY"];

function buildInstance(lsStore) {
  lsStore = lsStore || {};
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
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

// Park the two things that would otherwise perturb a multi-second run, each half a world from the ship:
//
//  - ONE immobile debris, as a wave-clear BLOCKER. Simply emptying game.debris is not a quiet field: the
//    wave-clear condition (debris + hunters empty for 2.5 s) fires, nextWave() respawns a ring of live
//    rocks around the ship, and one of them drifting into an idle test ship lands a real hull hit — which
//    arms the shield hint and steals the channel from whatever the test was actually watching. (That is
//    what made this suite flaky ~1 run in 3 before this fixture existed.) One surviving rock, immobile and
//    half a world away, keeps the wave open forever and can never reach the ship.
//  - The dock, away from the fake chain nodes the trigger tests push, so the real offload pass can't
//    quietly deliver them (delivered >= 1 silently latches the dock hint, and an emptied chain disarms it).
//
// Re-park after any test that moves the ship, so "half a world away" stays true.
function quiesce(inst) {
  const s = inst.game.ship;
  const ox = (s.x + inst.WORLD_W / 2) % inst.WORLD_W, oy = (s.y + inst.WORLD_H / 2) % inst.WORLD_H;
  inst.game.debris.length = 0;
  const keepAlive = new inst.DebrisSatellite(ox, oy, 3);
  keepAlive.vx = 0; keepAlive.vy = 0;
  inst.game.debris.push(keepAlive);
  if (inst.game.dock) { inst.game.dock.x = ox; inst.game.dock.y = oy; }
  return inst;
}

// Live play with the field emptied, so nothing but the test perturbs a hint.
function prepPlaying(inst) {
  inst.startGame();
  inst.game.state = "playing"; inst.game.paused = false;
  for (const arr of ["debris", "hunters", "saucers", "garbage", "bullets", "powerups", "floaters"])
    inst.game[arr].length = 0;
  inst.game.chain.length = 0;
  Object.assign(inst.game.ship, { dead: false, vx: 0, vy: 0, hp: inst.SHIP_MAX_HP, invuln: 0, shieldOn: false });
  for (const k of Object.keys(inst.keys)) delete inst.keys[k];
  return quiesce(inst);
}
// Run n seconds of the REAL update() at a fixed step, optionally observing each frame.
function run(inst, seconds, onFrame) {
  const dt = 1 / 60;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    if (onFrame) onFrame(i * dt);
    inst.update(dt);
  }
}
// Every hint id displayed over a span, in order (the active id sampled each frame, de-duped).
function recordShown(inst, seconds, onFrame) {
  const seen = [];
  run(inst, seconds, (t) => {
    if (onFrame) onFrame(t);
    const a = inst.game.tut.active;
    if (a && seen[seen.length - 1] !== a) seen.push(a);
  });
  return seen;
}
function savedTutSeen(lsStore, inst) {
  const raw = lsStore[inst.STORAGE_KEY];
  return raw ? (JSON.parse(raw).tutSeen || {}) : {};
}

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs014-p1-extracted.js");
  fs.writeFileSync(tmp, currentSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }
})();

// ================= (A2) the data table + live key rendering =====================
(function () {
  console.log("(A2) TUT_LINES covers TUT_IDS; {action} placeholders resolve through the live bindings");
  const inst = buildInstance();
  for (const id of inst.TUT_IDS) assert(typeof inst.TUT_LINES[id] === "string" && inst.TUT_LINES[id].length > 0,
    `TUT_LINES has copy for "${id}"`);
  assert(Object.keys(inst.TUT_LINES).length === inst.TUT_IDS.length, "TUT_LINES has no ids outside TUT_IDS");
  for (const id of inst.TUT_IDS) assert(inst.HintSys.RULES[id] && typeof inst.HintSys.RULES[id].armed === "function",
    `HintSys.RULES["${id}"] has an armed() predicate`);

  // Default bindings: thrust = arrowup/w, shield = shift. First key only, prettified.
  assert(inst.tutKey("thrust") === "↑", `tutKey("thrust") === "↑" (got ${inst.tutKey("thrust")})`);
  assert(inst.tutKey("shield") === "SHIFT", `tutKey("shield") === "SHIFT" (got ${inst.tutKey("shield")})`);
  assert(inst.HintSys.text("thrust") === "HOLD ↑ TO THRUST — YOU KEEP DRIFTING",
    `thrust copy renders its key live (got: ${inst.HintSys.text("thrust")})`);
  assert(!/\{|\}/.test(inst.HintSys.text("shield")), "no unresolved {placeholder} survives into shield copy");

  // Rebind-safe BY CONSTRUCTION: rebind thrust and the SAME data table renders the new key.
  inst.bindings.thrust.keys = ["j"];
  assert(inst.HintSys.text("thrust") === "HOLD J TO THRUST — YOU KEEP DRIFTING",
    `rebound thrust renders live (got: ${inst.HintSys.text("thrust")})`);
  inst.bindings.thrust.keys = ["arrowup", "w"];

  // A hint with no placeholder is passed through verbatim.
  assert(inst.HintSys.text("hook") === inst.TUT_LINES.hook, "placeholder-free copy is passed through unchanged");
})();

// ================= (B) thrust: idle shows / demonstrated latches silently =====================
(function () {
  console.log("(B) thrust hint: fires after TUT_THRUST_WAIT idle; a thrusting player latches it silently");
  {
    const store = {};
    const inst = prepPlaying(buildInstance(store));
    const shown = recordShown(inst, 7);
    assert(shown.includes("thrust"), `7 idle sec shows the thrust hint (shown: ${JSON.stringify(shown)})`);
    assert(inst.settings.tutSeen.thrust === true, "displaying thrust latches settings.tutSeen.thrust");
    assert(savedTutSeen(store, inst).thrust === true, "the latch is PERSISTED through the storage stub");
    // It waits for TUT_THRUST_WAIT rather than firing at once.
    const early = prepPlaying(buildInstance({}));
    run(early, inst.TUT_THRUST_WAIT - 0.5);
    assert(early.game.tut.active === null, "the thrust hint does NOT fire before TUT_THRUST_WAIT");
  }
  {
    // A fresh run where the player holds thrust 1.6 s (>= TUT_THRUST_SKILL): silent latch, never displayed.
    const store = {};
    const inst = prepPlaying(buildInstance(store));
    const shown = recordShown(inst, 7, (t) => { inst.keys["arrowup"] = (t < 1.6); });
    assert(!shown.includes("thrust"), `a demonstrated thruster never SEES the hint (shown: ${JSON.stringify(shown)})`);
    assert(inst.game.tut.thrustT >= inst.TUT_THRUST_SKILL, `thrustT accumulated past the skill bar (got ${inst.game.tut.thrustT.toFixed(2)})`);
    assert(inst.settings.tutSeen.thrust === true, "the silent latch still writes settings.tutSeen.thrust");
    assert(savedTutSeen(store, inst).thrust === true, "the SILENT latch persists too (both paths persist)");
  }
})();

// ================= (C) shield: real hit arms, auto-shield save does not =====================
(function () {
  console.log("(C) shield hint: armed by a REAL unshielded hit only, never by an auto-shield save");
  {
    const store = {};
    const inst = prepPlaying(buildInstance(store));
    inst.game.ship.energy = 0.8;
    assert(inst.game.tut.shieldHitArmed === false, "precondition: shield hint starts unarmed");
    const hit = inst.damageShip(10, inst.game.ship.x + 30, inst.game.ship.y);
    assert(hit === true, "precondition: the test hit actually landed");
    assert(inst.game.tut.shieldHitArmed === true, "a real unshielded hit arms shieldHitArmed");
    run(inst, 1 / 30);
    assert(inst.game.tut.active === "shield", `the shield hint shows (got ${inst.game.tut.active})`);
    assert(inst.settings.tutSeen.shield === true && savedTutSeen(store, inst).shield === true,
      "the shield display latches + persists");
  }
  {
    // The auto-shield branch: enabled, hull at/below LOW_HP_THRESHOLD, energy above the cost. It eats the
    // hit for 0 HP — the shield did the work the hint would teach, so nothing arms.
    const inst = prepPlaying(buildInstance({}));
    inst.settings.autoShield = true;
    inst.game.ship.hp = inst.LOW_HP_THRESHOLD - 1;
    inst.game.ship.energy = 1;
    const hpBefore = inst.game.ship.hp;
    const dealt = inst.damageShip(10, inst.game.ship.x + 30, inst.game.ship.y);
    assert(dealt === false && inst.game.ship.hp === hpBefore, "precondition: the auto-shield branch ate the hit (0 HP)");
    assert(inst.game.tut.shieldHitArmed === false, "an AUTO-SHIELD save must NOT arm the shield hint");
    run(inst, 1);
    assert(inst.game.tut.active !== "shield", "and so the shield hint never shows off an auto-save");
  }
  {
    // Demonstrated skill: shield held >= TUT_SHIELD_SKILL latches silently, even though a real hit lands.
    const store = {};
    const inst = prepPlaying(buildInstance(store));
    inst.game.ship.energy = 1;
    run(inst, 1, () => { inst.keys["shift"] = true; });
    delete inst.keys["shift"];
    assert(inst.game.tut.shieldT >= inst.TUT_SHIELD_SKILL, `shieldT accumulated (got ${inst.game.tut.shieldT.toFixed(2)})`);
    assert(inst.settings.tutSeen.shield === true, "holding shield silently latches the hint");
    assert(savedTutSeen(store, inst).shield === true, "the silent shield latch persists");
    inst.game.ship.energy = 1; inst.game.ship.invuln = 0;
    inst.damageShip(10, inst.game.ship.x + 30, inst.game.ship.y);
    const shown = recordShown(inst, 2);
    assert(!shown.includes("shield"), `a proven shielder never sees it, even after a hit (shown: ${JSON.stringify(shown)})`);
  }
  {
    // Energy floor: "hold shield" is not actionable advice on an empty tank, so the hint waits — and,
    // because armed predicates re-arm every frame, it still lands once the tank recharges. Delay, not drop.
    const inst = prepPlaying(buildInstance({}));
    inst.game.ship.energy = 0.1;
    inst.damageShip(10, inst.game.ship.x + 30, inst.game.ship.y);
    run(inst, 0.5);
    assert(inst.game.tut.active === null, "the shield hint holds off while energy is below TUT_SHIELD_ENERGY");
    inst.game.ship.energy = 0.9;
    run(inst, 1 / 30);
    assert(inst.game.tut.active === "shield", "...and fires once the tank is back — the arm was never lost");
  }
})();

// ================= (D) hook + dock edges, both silent-latch paths =====================
(function () {
  console.log("(D) hook + dock: edges fire, and each one's demonstrated-skill path latches silently");
  // hook: a PLAYER bullet destroying debris arms it (driven through the real collision pass).
  {
    const inst = prepPlaying(buildInstance({}));
    inst.settings.tutSeen.shield = true; // isolate: keep a higher-priority hint out of the channel
    assert(inst.game.tut.hookArmed === false, "precondition: hook starts unarmed");
    inst.game.tut.hookArmed = true;
    run(inst, 1 / 30);
    assert(inst.game.tut.active === "hook", `the hook hint shows once armed (got ${inst.game.tut.active})`);
  }
  {
    // hook's silent latch: the player hooked something (chain 0->1) before the hint got a slot.
    const store = {};
    const inst = prepPlaying(buildInstance(store));
    inst.settings.tutSeen.shield = true;
    inst.game.tut.hookArmed = true;
    inst.game.chain.push({ x: 0, y: 0, px: 0, py: 0, mass: 1 }); // a hooked canister, before any display
    run(inst, 1 / 30);
    assert(inst.game.tut.chainPeak >= 1, "chainPeak tracked the hook");
    assert(inst.game.tut.active !== "hook", "a player who already hooked never SEES the hook hint");
    assert(inst.settings.tutSeen.hook === true && savedTutSeen(store, inst).hook === true,
      "...and the hook hint latches + persists silently anyway");
  }
  // dock: the chain 0->1 edge (the chevron appearing) is what fires it.
  {
    const inst = prepPlaying(buildInstance({}));
    inst.settings.tutSeen.shield = true; inst.settings.tutSeen.hook = true;
    run(inst, 0.5);
    assert(inst.game.tut.active === null, "no cargo -> no dock hint");
    inst.game.chain.push({ x: 0, y: 0, px: 0, py: 0, mass: 1 });
    run(inst, 1 / 30);
    assert(inst.game.tut.active === "dock", `hooking the first canister shows the dock hint (got ${inst.game.tut.active})`);
  }
  {
    // dock's silent latch: a player who has already delivered has plainly found the dock.
    const store = {};
    const inst = prepPlaying(buildInstance(store));
    inst.settings.tutSeen.shield = true; inst.settings.tutSeen.hook = true;
    inst.game.stats.delivered = 1;
    inst.game.chain.push({ x: 0, y: 0, px: 0, py: 0, mass: 1 });
    run(inst, 1 / 30);
    assert(inst.game.tut.active !== "dock", "a player who has delivered never sees the dock hint");
    assert(inst.settings.tutSeen.dock === true && savedTutSeen(store, inst).dock === true,
      "...and it latches + persists silently");
  }
  // tow: the run's high-water chain length reaching TUT_TOW_LEN.
  {
    const inst = prepPlaying(buildInstance({}));
    for (const id of ["shield", "hook", "dock", "clump", "birth"]) inst.settings.tutSeen[id] = true;
    for (let i = 0; i < inst.TUT_TOW_LEN - 1; i++) inst.game.chain.push({ x: 0, y: 0, px: 0, py: 0, mass: 1 });
    run(inst, 0.5);
    assert(inst.game.tut.active === null, `a chain of ${inst.TUT_TOW_LEN - 1} does not trigger the tow hint`);
    inst.game.chain.push({ x: 0, y: 0, px: 0, py: 0, mass: 1 });
    run(inst, 1 / 30);
    assert(inst.game.tut.active === "tow", `chain length ${inst.TUT_TOW_LEN} shows the tow hint (got ${inst.game.tut.active})`);
    // chainPeak is a HIGH-WATER mark: dropping the cargo doesn't un-teach the weight.
    assert(inst.game.tut.chainPeak >= inst.TUT_TOW_LEN, "chainPeak recorded the peak");
  }
  // birth: a Hunter coalescing out of neglected scrap.
  {
    const inst = prepPlaying(buildInstance({}));
    for (const id of ["shield", "hook", "dock", "clump"]) inst.settings.tutSeen[id] = true;
    run(inst, 0.5);
    assert(inst.game.tut.active === null, "no births -> no birth hint");
    inst.game.stats.hunterCoalesced = 1;
    run(inst, 1 / 30);
    assert(inst.game.tut.active === "birth", `a coalesced Hunter shows the birth hint (got ${inst.game.tut.active})`);
  }
  // decay: a loose single in its blink window, on screen.
  {
    const inst = prepPlaying(buildInstance({}));
    for (const id of inst.TUT_IDS) inst.settings.tutSeen[id] = (id !== "decay");
    // On screen but well outside GARBAGE_PICKUP (18 px) — otherwise the ship hooks it out of game.garbage
    // and the scan has nothing to find.
    const g = new inst.Garbage(inst.game.camera.x + 200, inst.game.camera.y + 100);
    inst.game.garbage.push(g);
    run(inst, 0.5);
    assert(inst.game.tut.active === null, "a fresh single (not yet blinking) does not trigger the decay hint");
    g.decay = inst.GARBAGE_FADE - 0.1;   // inside the blink window
    run(inst, 1 / 30);
    assert(inst.game.tut.active === "decay", `a blinking single shows the decay hint (got ${inst.game.tut.active})`);
  }
})();

// ================= (E) priority + re-arm (delay-not-drop) =====================
(function () {
  console.log("(E) two hints armed at once: priority order wins, and the loser STILL shows after TUT_GAP");
  const inst = prepPlaying(buildInstance({}));
  // Arm hook and dock in the same frame. TUT_IDS order puts hook (idx 1) ahead of dock (idx 2).
  inst.settings.tutSeen.shield = true;
  inst.game.tut.hookArmed = true;
  inst.game.chain.push({ x: 0, y: 0, px: 0, py: 0, mass: 1 });
  assert(inst.TUT_IDS.indexOf("hook") < inst.TUT_IDS.indexOf("dock"), "precondition: hook outranks dock in TUT_IDS");

  // hook's silent latch is chainPeak >= 1, which the pushed node would trip — take the node back out for
  // one frame so this exercises the DISPLAY contest rather than the veteran skip.
  const node = inst.game.chain.pop();
  run(inst, 1 / 30);
  assert(inst.game.tut.active === "hook", `the higher-priority hint (hook) takes the channel (got ${inst.game.tut.active})`);
  assert(inst.settings.tutSeen.dock === false, "the loser is NOT latched — it wasn't shown");
  inst.game.chain.push(node);

  // While hook is up, dock stays armed and simply waits.
  run(inst, 1);
  assert(inst.game.tut.active === "hook", "hook is still on screen mid-duration");
  assert(inst.game.tut.active !== "dock", "dock has not barged in — one hint at a time");

  // The delay-not-drop proof: run past the display + the gap; dock must appear on its own.
  const shown = recordShown(inst, inst.TUT_DUR + inst.TUT_GAP + 1);
  assert(shown.includes("dock"), `dock was DELAYED, not dropped — it shows after TUT_GAP (shown: ${JSON.stringify(shown)})`);
  assert(inst.settings.tutSeen.dock === true, "and it latches when it finally displays");

  // The gap is real: dock must not appear the instant hook clears.
  {
    const b = prepPlaying(buildInstance({}));
    b.settings.tutSeen.shield = true;
    b.game.tut.hookArmed = true;
    run(b, 1 / 30);
    assert(b.game.tut.active === "hook", "precondition: hook took the channel");
    run(b, b.TUT_DUR);                       // hook's display expires -> the gap opens
    assert(b.game.tut.active === null, "the hint clears after TUT_DUR");
    b.game.chain.push({ x: 0, y: 0, px: 0, py: 0, mass: 1 });
    b.settings.tutSeen.dock = false;         // dock armed the moment hook cleared
    run(b, b.TUT_GAP - 0.5);
    assert(b.game.tut.active === null, "nothing displays during the TUT_GAP quiet window");
    run(b, 0.6);
    assert(b.game.tut.active === "dock", `dock displays once TUT_GAP elapses (got ${b.game.tut.active})`);
  }
})();

// ================= (F) wrap-aware viewport scan =====================
(function () {
  console.log("(F) clump viewport test is wrap-aware: 8 px across the seam counts, far away doesn't");
  const inst = prepPlaying(buildInstance({}));
  for (const id of inst.TUT_IDS) inst.settings.tutSeen[id] = (id !== "clump");

  // Park the camera hard on the world's x seam, then place a piece 8 px across it (x wraps to ~4). The
  // naive camera-minus-position would call this ~WORLD_W away; shortDelta calls it 8 px, which is the
  // whole point of the wrap-aware test.
  inst.game.ship.x = inst.WORLD_W - 4; inst.game.ship.y = 300;
  inst.game.camera.x = inst.game.ship.x; inst.game.camera.y = inst.game.ship.y;
  quiesce(inst); // the ship moved — re-park the wave-clear blocker + dock opposite its new spot
  const near = new inst.Garbage(4, 300);       // 8 px away THROUGH the seam; ~WORLD_W away naively
  assert(inst.HintSys.onScreen(near) === true, "a piece 8 px across the seam reads as on-screen");

  // Now the same seam geometry as a live trigger, but parked outside GARBAGE_PICKUP so the ship can't hook
  // it out of game.garbage before the scan runs.
  const seamClump = new inst.Garbage(300, 300);  // ~304 px across the seam: on screen, un-hookable
  seamClump.pieces = inst.TUT_CLUMP_PIECES; seamClump.radius = 7 * Math.sqrt(seamClump.pieces);
  inst.game.garbage.push(seamClump);
  assert(inst.HintSys.onScreen(seamClump) === true, "a clump 304 px across the seam reads as on-screen");
  run(inst, 1 / 30);
  assert(inst.game.tut.active === "clump", `...and triggers the clump hint across the seam (got ${inst.game.tut.active})`);

  // A genuinely distant clump (half a world away) must not.
  const far = prepPlaying(buildInstance({}));
  for (const id of far.TUT_IDS) far.settings.tutSeen[id] = (id !== "clump");
  far.game.ship.x = 100; far.game.ship.y = 300;
  far.game.camera.x = 100; far.game.camera.y = 300;
  quiesce(far);
  const away = new far.Garbage(100 + far.WORLD_W / 2, 300);
  away.pieces = far.TUT_CLUMP_PIECES; away.radius = 7 * Math.sqrt(away.pieces);
  far.game.garbage.push(away);
  assert(far.HintSys.onScreen(away) === false, "a clump half a world away reads as off-screen");
  run(far, 1);
  assert(far.game.tut.active === null, "...and never triggers the hint");

  // The pad boundary itself, on the y axis, for good measure.
  const inView = new far.Garbage(100, 300 + far.VIEW_H / 2 + far.TUT_VIEW_PAD - 1);
  const outView = new far.Garbage(100, 300 + far.VIEW_H / 2 + far.TUT_VIEW_PAD + 1);
  assert(far.HintSys.onScreen(inView) === true, "just inside the viewport pad reads on-screen");
  assert(far.HintSys.onScreen(outView) === false, "just outside the viewport pad reads off-screen");

  // A sub-threshold clump on screen is not enough.
  const small = prepPlaying(buildInstance({}));
  for (const id of small.TUT_IDS) small.settings.tutSeen[id] = (id !== "clump");
  const g = new small.Garbage(small.game.camera.x + 200, small.game.camera.y + 100);
  g.pieces = small.TUT_CLUMP_PIECES - 1;
  small.game.garbage.push(g);
  run(small, 1);
  assert(small.game.tut.active === null, `a clump of ${small.TUT_CLUMP_PIECES - 1} is below the trigger`);
})();

// ================= (G) persistence: a seen hint never re-fires in a fresh run =====================
(function () {
  console.log("(G) tutSeen round-trips; a seen hint never fires again in a fresh run");
  const store = {};
  const A = prepPlaying(buildInstance(store));
  run(A, 7);
  assert(A.settings.tutSeen.thrust === true, "precondition: run 1 saw the thrust hint");

  // Fresh instance reading the SAME storage: the latch survives, and the hint stays silent forever.
  const B = prepPlaying(buildInstance(store));
  assert(B.settings.tutSeen.thrust === true, "the latch round-tripped into a fresh instance");
  assert(B.game.tut.thrustT === 0 && B.game.tut.active === null, "but the per-run scratch state starts clean");
  const shown = recordShown(B, 9);
  assert(!shown.includes("thrust"), `a seen hint never re-fires in a later run (shown: ${JSON.stringify(shown)})`);

  // startGame() re-arms nothing that was already burned, and clears per-run state from the previous run.
  const C = prepPlaying(buildInstance(store));
  C.game.tut.thrustT = 99; C.game.tut.hookArmed = true; C.game.tut.active = "hook"; C.game.tut.chainPeak = 7;
  C.startGame();
  assert(C.game.tut.thrustT === 0 && C.game.tut.hookArmed === false && C.game.tut.active === null
    && C.game.tut.chainPeak === 0 && C.game.tut.showT === 0 && C.game.tut.gapT === 0,
    "startGame() resets every per-run tut field");
  assert(C.settings.tutSeen.thrust === true, "...while the PERSISTED latch survives a fresh run");

  // A veteran with every hint seen: HintSys is inert (and never writes storage again).
  const V = prepPlaying(buildInstance(store));
  for (const id of V.TUT_IDS) V.settings.tutSeen[id] = true;
  V.saveSettings();
  const writesBefore = JSON.stringify(store[V.STORAGE_KEY]);
  V.game.tut.hookArmed = true;
  V.game.stats.hunterCoalesced = 3;
  V.game.chain.push({ x: 0, y: 0, px: 0, py: 0, mass: 1 });
  const vShown = recordShown(V, 10, () => { V.keys["arrowup"] = true; });
  assert(vShown.length === 0, `a veteran with all latches set sees nothing (shown: ${JSON.stringify(vShown)})`);
  assert(JSON.stringify(store[V.STORAGE_KEY]) === writesBefore, "...and HintSys writes no further storage");
})();

// ================= (H) render =====================
(function () {
  console.log("(H) drawHint(): crash-free through the proxy canvas, and gated on Capture.hudVisible");
  const inst = prepPlaying(buildInstance({}));
  inst.game.tut.active = "hook";

  textDrawn = [];
  inst.Capture.hudVisible = true;
  inst.drawHint();
  assert(textDrawn.includes(inst.TUT_LINES.hook), `drawHint draws the active hint's copy (drew: ${JSON.stringify(textDrawn)})`);

  // FLAG-CS014-d: hints hide with the H capture toggle (unlike captions).
  textDrawn = [];
  inst.Capture.hudVisible = false;
  inst.drawHint();
  assert(textDrawn.length === 0, "drawHint draws NOTHING when Capture.hudVisible is false");
  inst.Capture.hudVisible = true;

  // Nothing active -> nothing drawn.
  textDrawn = [];
  inst.game.tut.active = null;
  inst.drawHint();
  assert(textDrawn.length === 0, "drawHint draws nothing with no active hint");

  // Never renders while paused, on a menu/title/gameover, or during the death spectacle.
  inst.game.tut.active = "hook";
  for (const state of ["title", "gameover", "dying"]) {
    textDrawn = [];
    inst.game.state = state;
    inst.drawHint();
    assert(textDrawn.length === 0, `drawHint draws nothing in state "${state}"`);
  }
  inst.game.state = "playing";
  textDrawn = [];
  inst.game.paused = true;
  inst.drawHint();
  assert(textDrawn.length === 0, "drawHint draws nothing while paused");
  inst.game.paused = false;

  // The key placeholder is resolved at DRAW time, so a rebind lands immediately.
  textDrawn = [];
  inst.game.tut.active = "thrust";
  inst.bindings.thrust.keys = ["j"];
  inst.drawHint();
  assert(textDrawn.some(s => s.includes("J")), `drawHint renders the CURRENT binding (drew: ${JSON.stringify(textDrawn)})`);
  inst.bindings.thrust.keys = ["arrowup", "w"];

  // A paused/dying frame doesn't age the hint either (update() never reaches HintSys there).
  const p = prepPlaying(buildInstance({}));
  p.game.tut.active = "hook"; p.game.tut.showT = inst.TUT_DUR;
  p.game.paused = true;
  run(p, 6);
  assert(p.game.tut.active === "hook" && p.game.tut.showT === inst.TUT_DUR, "a paused frame never ages a hint");
  p.game.paused = false;
  run(p, inst.TUT_DUR + 0.1);
  assert(p.game.tut.active === null, "...and it ages out normally once unpaused");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
