// Headless test for v3.6 Phase 6 — top-10 local high scores with 3-initial entry.
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ a fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL killShip()/update()/keydown/gamepad handlers/persistence —
// no reimplementation of the logic under test.
//
//   node scratchpad/test-v36-scores.js
//
// Checks:
//  (A) afd_settings_v1 / afd_achievements_v2 are neither read nor written by HighScores.load/save or
//      commitEntry() (spy the storage stub's get/set calls).
//  (B) the store round-trips through localStorage under afd_scores_v1, shape { v:1, entries:[...] }.
//  (C) a corrupt or missing payload doesn't crash HighScores.load().
//  (D) the table stays sorted score-desc, capped at SCORES_MAX, and a score <= the 10th is refused.
//  (E) every committed record carries all 8 wire-shape fields, with a unique id across two "runs".
//  (F) a confirm keypress while game.entry is live commits the initials and does NOT start a game
//      (checked via side effects, same methodology as test-v36-death.js §E — startGame is a bare
//      closure-scoped call, not a spyable object method); the SAME key after commit DOES start one.
//  (G) a held key (e.repeat) does not advance the letter.
//  (H) the gamepad path reaches the same entryInput() dispatcher (edge-detected nav + confirm).
//  (I) draw() is crash-free with an empty table, a partial table, a full table with the fresh entry
//      highlighted, the initials-entry slots, and the browsable High Scores menu screen.
//  (J) "High Scores" is nested under Options (CS010 P4, §8b) and reachable/returnable from BOTH the
//      system menu (via Options) and the pause menu mid-game; it is NOT in MENU_ROOT_SYS.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ---- Headless environment stubs (mirrors test-v36-death / test-f8) ----
const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
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

let fakePads = [];
const navigatorStub = { getGamepads: () => fakePads };

// In-memory localStorage, INSTRUMENTED so storage isolation (§A) can be verified: every get/set is
// logged with the key it touched.
const lsStore = {};
const storageLog = [];
global.localStorage = {
  getItem: k => { storageLog.push(["get", k]); return (k in lsStore ? lsStore[k] : null); },
  setItem: (k, v) => { storageLog.push(["set", k]); lsStore[k] = String(v); },
  removeItem: k => { storageLog.push(["remove", k]); delete lsStore[k]; }
};

const returnList = [
  "startGame", "update", "draw", "game", "keys", "killShip",
  "Achievements", "HighScores", "entryInput", "commitEntry",
  "SCORES_MAX", "SCORES_CHARSET", "GAME_VERSION", "DEATH_DURATION",
  "bindings", "GP", "GP_DEADZONE", "pollGamepad", "handleGamepadMenu",
  "openPause", "closePause", "menuInput", "rootItems", "MENU_ROOT_SYS", "MENU_OPTIONS", "AudioSys"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, draw, game, keys, killShip,
  Achievements, HighScores, entryInput, commitEntry,
  SCORES_MAX, SCORES_CHARSET, GAME_VERSION, DEATH_DURATION,
  bindings, GP, GP_DEADZONE, pollGamepad, handleGamepadMenu,
  openPause, closePause, menuInput, rootItems, MENU_ROOT_SYS, MENU_OPTIONS, AudioSys
} = A;

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

AudioSys.init();
const DT = 1 / 60;

function keydown(key, repeat = false) {
  const e = { key, repeat, preventDefault() {} };
  for (const fn of (listeners["keydown"] || [])) fn(e);
}
function makePad(press = [], axes = [0, 0, 0, 0]) {
  const buttons = [];
  for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 });
  return { connected: true, buttons, axes };
}
function setPad(pad) { fakePads = pad === null ? [] : [pad]; pollGamepad(); }
function noPad() { fakePads = []; pollGamepad(); }

// Drive the REAL killShip() -> "dying" -> "gameover" transition (P5's seam, where P6 hooks in).
function toGameover() {
  const frames = Math.ceil(DEATH_DURATION / DT) + 4;
  for (let i = 0; i < frames; i++) update(DT);
}
// A clean run into "gameover" with a chosen score/wave/delivered, empty field (no stray detonations).
function freshDeath(score, wave, delivered) {
  startGame();
  game.score = score; game.wave = wave; game.stats.delivered = delivered;
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  killShip();
  toGameover();
}

// ================= (A) storage isolation: settings/achievements keys untouched =====================
(function sectionA() {
  console.log("(A) afd_settings_v1 / afd_achievements_v2 untouched by HighScores or commitEntry");
  const other = ["afd_settings_v1", "afd_achievements_v2"];

  storageLog.length = 0;
  HighScores.load();
  assert(storageLog.every(([, k]) => !other.includes(k)), "A: HighScores.load() never touches settings/achievements keys");
  assert(storageLog.some(([, k]) => k === "afd_scores_v1"), "A: HighScores.load() DID touch afd_scores_v1");

  storageLog.length = 0;
  HighScores.save();
  assert(storageLog.every(([, k]) => !other.includes(k)), "A: HighScores.save() never touches settings/achievements keys");
  assert(storageLog.some(([op, k]) => op === "set" && k === "afd_scores_v1"), "A: HighScores.save() DID write afd_scores_v1");

  startGame();
  game.score = 500; game.wave = 3; game.stats.delivered = 5;
  storageLog.length = 0;
  game.entry = { initials: [0, 1, 2], idx: 0 };
  commitEntry();
  assert(storageLog.every(([, k]) => !other.includes(k)), "A: commitEntry() never touches settings/achievements keys");
  assert(storageLog.some(([op, k]) => op === "set" && k === "afd_scores_v1"), "A: commitEntry() persisted to afd_scores_v1");
})();

// ================= (B) round-trip through localStorage ==============================================
(function sectionB() {
  console.log("(B) afd_scores_v1 round-trips through localStorage, shape { v:1, entries:[...] }");
  HighScores.entries = [];
  HighScores.add({ initials: "AAA", score: 100, wave: 1, delivered: 1 });
  HighScores.add({ initials: "BBB", score: 200, wave: 2, delivered: 2 });
  const raw = global.localStorage.getItem("afd_scores_v1");
  assert(!!raw, "B: a payload was written under afd_scores_v1");
  const parsed = JSON.parse(raw);
  assert(parsed.v === 1 && Array.isArray(parsed.entries) && parsed.entries.length === 2, "B: stored shape is { v:1, entries:[...] }");

  HighScores.entries = []; // corrupt the live state
  HighScores.load();
  assert(HighScores.entries.length === 2, "B: reload restores both entries");
  assert(HighScores.entries[0].score === 200, "B: reload keeps score-desc order (BBB first)");
})();

// ================= (C) corrupt/missing payload doesn't crash init ===================================
(function sectionC() {
  console.log("(C) corrupt/missing afd_scores_v1 payload doesn't crash HighScores.load()");
  global.localStorage.setItem("afd_scores_v1", "{ not valid json");
  let threw = false;
  try { HighScores.load(); } catch (e) { threw = true; }
  assert(!threw, "C: corrupt JSON doesn't throw");
  assert(Array.isArray(HighScores.entries), "C: entries stays an array after a corrupt load");

  global.localStorage.removeItem("afd_scores_v1");
  threw = false;
  try { HighScores.load(); } catch (e) { threw = true; }
  assert(!threw, "C: a missing key doesn't throw");
})();

// ================= (D) sorted, capped, refuses <= 10th ===============================================
(function sectionD() {
  console.log("(D) table stays sorted + capped at SCORES_MAX; a score <= the 10th is refused");
  HighScores.entries = [];
  assert(!HighScores.qualifies(0), "D: a score of 0 never qualifies");
  assert(!HighScores.qualifies(-5), "D: a negative score never qualifies");
  assert(HighScores.qualifies(1), "D: any positive score qualifies for an empty table");

  for (let i = 0; i < SCORES_MAX; i++) HighScores.add({ initials: "P" + i, score: (i + 1) * 100, wave: 1, delivered: 0 });
  assert(HighScores.entries.length === SCORES_MAX, "D: table filled to SCORES_MAX");
  let sorted = true;
  for (let i = 1; i < HighScores.entries.length; i++) if (HighScores.entries[i].score > HighScores.entries[i - 1].score) sorted = false;
  assert(sorted, "D: entries sorted score-desc");

  const tenth = HighScores.entries[SCORES_MAX - 1].score;
  assert(!HighScores.qualifies(tenth), "D: a score EQUAL to the 10th does not qualify (must beat it)");
  assert(!HighScores.qualifies(tenth - 1), "D: a score below the 10th does not qualify");
  assert(HighScores.qualifies(tenth + 1), "D: a score above the 10th DOES qualify");

  HighScores.add({ initials: "HI", score: 100000, wave: 9, delivered: 9 });
  assert(HighScores.entries.length === SCORES_MAX, "D: table stays capped at SCORES_MAX after an 11th insert");
  assert(HighScores.entries[0].initials === "HI", "D: the new top score sorts to #1");
})();

// ================= (E) every record carries all 8 fields, unique id across two runs =================
(function sectionE() {
  console.log("(E) every committed record carries all 8 wire-shape fields with a unique id across two runs");
  HighScores.entries = [];
  const rec1 = HighScores.add({ initials: "AAA", score: 111, wave: 2, delivered: 3 });
  const rec2 = HighScores.add({ initials: "BBB", score: 222, wave: 4, delivered: 5 });
  const fields = ["v", "id", "initials", "score", "wave", "delivered", "ts", "build"];
  for (const rec of [rec1, rec2]) for (const f of fields) assert(f in rec, "E: record carries field '" + f + "'");
  assert(rec1.id !== rec2.id, "E: two records get unique ids across two 'runs'");
  assert(typeof rec1.id === "string" && rec1.id.length > 0, "E: id is a non-empty string");
  assert(rec1.v === 1 && rec2.v === 1, "E: record schema v === 1");
  assert(rec1.build === GAME_VERSION, "E: build tag matches GAME_VERSION");
})();

// ================= (F) confirm commits (no restart); confirm again DOES start a game ================
(function sectionF() {
  console.log("(F) confirm while game.entry is live commits initials and does NOT start a game; same key after DOES");
  HighScores.entries = [];
  freshDeath(999999, 5, 7); // score high enough to qualify against an empty table
  assert(game.state === "gameover", "F: reached 'gameover'");
  assert(game.entry, "F: a qualifying score armed game.entry");

  const confirmKey = bindings.confirm.keys[0];
  const stateBefore = game.state, scoreBefore = game.score, waveBefore = game.wave;
  keydown(confirmKey);
  assert(game.state === stateBefore, "F: confirm while entry is live did NOT restart the game (state unchanged)");
  assert(game.score === scoreBefore && game.wave === waveBefore, "F: score/wave unchanged (startGame not called)");
  assert(game.entry === null, "F: confirm committed the initials (game.entry cleared)");
  assert(HighScores.entries.some(r => r.id === game.lastScoreId), "F: the committed record made it into the table");

  keydown(confirmKey); // same key, now that entry is committed
  assert(game.state === "playing", "F: confirm AFTER commit DOES start a new game (unchanged, now-unblocked site)");
})();

// ================= (G) a held key does not spin the letter ===========================================
(function sectionG() {
  console.log("(G) a held key (e.repeat) does not advance the initials letter");
  HighScores.entries = [];
  freshDeath(888888, 1, 0);
  assert(game.entry, "G: armed entry for a held-key test");
  const before = game.entry.initials[0];
  keydown("arrowup", true); // repeat: true
  assert(game.entry.initials[0] === before, "G: a repeated (held) key does not advance the letter");
  keydown("arrowup", false); // a genuine press
  assert(game.entry.initials[0] === (before + 1) % SCORES_CHARSET.length, "G: a real (non-repeat) keypress DOES advance the letter");
})();

// ================= (H) gamepad path reaches entryInput too ===========================================
(function sectionH() {
  console.log("(H) the gamepad path reaches the same entryInput() dispatcher (edge-detected nav + confirm)");
  HighScores.entries = [];
  freshDeath(777777, 2, 1);
  assert(game.entry, "H: armed entry");
  const startIdx = game.entry.idx;

  setPad(makePad([])); handleGamepadMenu(); // baseline so the next press is a fresh edge
  setPad(makePad([GP.DPAD_RIGHT])); handleGamepadMenu();
  assert(game.entry.idx === (startIdx + 1) % 3, "H: D-Pad Right moves the cursor via entryInput");
  setPad(makePad([GP.DPAD_RIGHT])); handleGamepadMenu(); // held -> edge-detected, no repeat
  assert(game.entry.idx === (startIdx + 1) % 3, "H: holding D-Pad Right does not repeat (edge-detected)");

  setPad(makePad([])); handleGamepadMenu(); // release
  setPad(makePad([GP.A])); handleGamepadMenu(); // A = confirm
  assert(game.entry === null, "H: gamepad confirm (A) commits the initials via entryInput");
  assert(game.state === "gameover", "H: gamepad confirm during entry did NOT start a new game");
  noPad(); handleGamepadMenu();
})();

// ================= (I) draw() crash-free: empty/partial/full table, entry slots, browsable table ====
(function sectionI() {
  console.log("(I) draw() is crash-free: empty/partial/full tables, entry slots, and the High Scores menu");
  let ok = true;
  const tryDraw = label => { try { draw(); } catch (e) { ok = false; console.error("  draw() threw (" + label + "): " + (e && e.stack || e)); } };

  HighScores.entries = [];
  game.lastScoreId = null;
  game.state = "gameover"; game.entry = null; game.paused = false;
  tryDraw("empty table");

  for (let i = 0; i < 4; i++) HighScores.add({ initials: "X" + i, score: (i + 1) * 10, wave: 1, delivered: 0 });
  tryDraw("partial table");

  for (let i = 4; i < SCORES_MAX; i++) HighScores.add({ initials: "Y" + i, score: (i + 1) * 10, wave: 1, delivered: 0 });
  assert(HighScores.entries.length === SCORES_MAX, "I: table now full");
  game.lastScoreId = HighScores.entries[0].id;
  tryDraw("full table + fresh-entry highlight");

  freshDeath(654321, 3, 2);
  if (!game.entry) { HighScores.entries = []; freshDeath(654321, 3, 2); } // guarantee a qualifying, armed entry
  assert(game.entry, "I: entry armed for the entry-slots draw path");
  tryDraw("initials-entry slots");

  game.entry = null; game.state = "gameover";
  game.paused = true; game.menu.screen = "highscores";
  tryDraw("browsable High Scores menu screen");
  game.paused = false; game.menu.screen = null;

  assert(ok, "I: draw() never threw across any of the above");
})();

// ================= (J) "High Scores" nested under Options (CS010 P4, §8b) ============================
(function sectionJ() {
  console.log("(J) 'High Scores' is browsable from Options, reachable from both entry paths");
  assert(!MENU_ROOT_SYS.includes("High Scores"), "J: MENU_ROOT_SYS no longer carries a High Scores row (FORK-4)");
  assert(MENU_OPTIONS.includes("High Scores"), "J: MENU_OPTIONS carries a High Scores row");

  // Path 1: system menu (title/gameover) -> Options -> High Scores -> back -> Options.
  startGame(); game.state = "title"; game.paused = false;
  openPause(); // system menu from title
  assert(game.paused && rootItems().includes("Options"), "J: system root includes Options");
  game.menu.index = rootItems().indexOf("Options");
  menuInput("confirm");
  assert(game.menu.screen === "options", "J: system root -> Options");
  game.menu.index = MENU_OPTIONS.indexOf("High Scores");
  menuInput("confirm");
  assert(game.menu.screen === "highscores", "J: confirm on High Scores opens the highscores screen");
  menuInput("back");
  assert(game.menu.screen === "options" && MENU_OPTIONS[game.menu.index] === "High Scores", "J: back returns to Options, cursor on High Scores");
  closePause();
  assert(!game.paused, "J: closePause() exits the system menu");

  // Path 2: pause menu mid-game -> Options -> High Scores -> back -> Options — the whole point of §8b.
  startGame(); openPause(); // pause menu (play root: Continue/Options/Quit)
  game.menu.index = rootItems().indexOf("Options"); menuInput("confirm");
  game.menu.index = MENU_OPTIONS.indexOf("High Scores"); menuInput("confirm");
  assert(game.menu.screen === "highscores", "J: pause path -> Options -> High Scores also opens the screen");
  menuInput("back");
  assert(game.menu.screen === "options" && MENU_OPTIONS[game.menu.index] === "High Scores", "J: pause path back -> Options, cursor on High Scores");
  closePause();
})();

// ---- summary ----
console.log(`\ntest-v36-scores: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
