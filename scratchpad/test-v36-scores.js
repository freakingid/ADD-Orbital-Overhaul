// Headless test for v3.6 Phase 6 — the local high score table and its store.
// ⚠ CS034 P7 DELETED THE 3-INITIAL ENTRY THIS FILE WAS WRITTEN AROUND (spec §6.1). The store, the
// qualification rule, the wire shape, the reachability IA and the draw paths are all still this file's
// subject and are all still here; the three sections that drove the entry field itself (its dispatcher,
// its held-key guard, its slots renderer) had no successor and were folded into one section on what
// gameover input does instead. Nothing was quietly dropped — see (F).
// Follows GDD 5.4 rule 7: stub window/document/rAF/navigator (+ a fake localStorage), eval the REAL
// <script> block, then drive the ACTUAL killShip()/update()/keydown/gamepad handlers/persistence —
// no reimplementation of the logic under test.
//
//   node scratchpad/test-v36-scores.js
//
// Checks:
//  (A) afd_settings_v1 / afd_achievements_v2 are neither read nor written by HighScores.load/save/add
//      (spy the storage stub's get/set calls).
//  (B) the store round-trips through localStorage under afd_scores_v1, shape { v:1, entries:[...] }.
//  (C) a corrupt or missing payload doesn't crash HighScores.load().
//  (D) the table stays sorted score-desc, capped at SCORES_MAX, and a score <= the last is refused.
//  (E) every committed record carries the whole wire shape, with a unique id across two "runs".
//  (F) ⚠ CS034 P7, replacing the old (F)/(G)/(H): a qualifying run's record is written at the seam with
//      no input at all, and the very first confirm at gameover — keyboard OR gamepad — starts a new
//      game, because there is no longer an entry field in front of it.
//  (I) draw() is crash-free with an empty table, a partial table, a full table with the fresh entry
//      highlighted, and the browsable High Scores screen under both filters.
//  (J) "High Scores" hangs off the TITLE MENU as its sole parent (CS016 P2 §2 deliberately reversed
//      CS010 P4 §8b's Options nesting): browsable + returnable from there with the cursor restored,
//      and no longer reachable via Options from the title or from a mid-run pause.

"use strict";
const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "..", "orbital-overhaul.html");
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
  "Achievements", "HighScores", "makeRunResult", "Profiles",
  "SCORES_MAX", "SCORES_CHARSET", "GAME_VERSION", "DEATH_DURATION",
  "bindings", "GP", "GP_DEADZONE", "pollGamepad", "handleGamepadMenu",
  "openPause", "closePause", "menuInput", "rootItems", "MENU_OPTIONS", "MENU_TITLE", "quitToTitle", "AudioSys"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + returnList.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, global.localStorage);
const {
  startGame, update, draw, game, keys, killShip,
  Achievements, HighScores, makeRunResult, Profiles,
  SCORES_MAX, SCORES_CHARSET, GAME_VERSION, DEATH_DURATION,
  bindings, GP, GP_DEADZONE, pollGamepad, handleGamepadMenu,
  openPause, closePause, menuInput, rootItems, MENU_OPTIONS, MENU_TITLE, quitToTitle, AudioSys
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
// CS030 P4: a run that banked achievement unlocks also opens the celebration panel at this seam, and
// that panel owns input while it is up — so a confirm would dismiss the panel rather than doing what
// (F) below is about. This file's subject is the high-score table, not which modals queue in front of
// it (the panel has its own test, test-cs030-p4.js §E), so the helper dismisses it here. NAMED, not
// worked around: without this line every press in (F) is answered by the panel instead, and which runs
// bank an unlock depends on the achievement thresholds.
function freshDeath(score, wave, delivered) {
  startGame();
  game.score = score; game.wave = wave; game.stats.delivered = delivered;
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  killShip();
  toGameover();
  game.celebration = null;
}

// ================= (A) storage isolation: settings/achievements keys untouched =====================
(function sectionA() {
  console.log("(A) afd_settings_v1 / afd_achievements_v2 untouched by HighScores' own load/save/add");
  const other = ["afd_settings_v1", "afd_achievements_v2"];

  storageLog.length = 0;
  HighScores.load();
  assert(storageLog.every(([, k]) => !other.includes(k)), "A: HighScores.load() never touches settings/achievements keys");
  assert(storageLog.some(([, k]) => k === "afd_scores_v1"), "A: HighScores.load() DID touch afd_scores_v1");

  storageLog.length = 0;
  HighScores.save();
  assert(storageLog.every(([, k]) => !other.includes(k)), "A: HighScores.save() never touches settings/achievements keys");
  assert(storageLog.some(([op, k]) => op === "set" && k === "afd_scores_v1"), "A: HighScores.save() DID write afd_scores_v1");

  // ⚠ CS034 P7: the write path used to be commitEntry(); it is HighScores.add() handed a RunResult now.
  startGame();
  game.score = 500; game.wave = 3; game.stats.delivered = 5;
  storageLog.length = 0;
  HighScores.add(makeRunResult());
  assert(storageLog.every(([, k]) => !other.includes(k)), "A: a record write never touches settings/achievements keys");
  assert(storageLog.some(([op, k]) => op === "set" && k === "afd_scores_v1"), "A: ...and it DID persist to afd_scores_v1");
})();

// ================= (B) round-trip through localStorage ==============================================
(function sectionB() {
  console.log("(B) afd_scores_v1 round-trips through localStorage, shape { v:1, entries:[...] }");
  HighScores.entries = [];
  HighScores.add({ name: "AAA", score: 100, wave: 1, delivered: 1 });
  HighScores.add({ name: "BBB", score: 200, wave: 2, delivered: 2 });
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
  console.log("(D) table stays sorted + capped at SCORES_MAX; a score <= the last is refused");
  HighScores.entries = [];
  assert(!HighScores.qualifies(0), "D: a score of 0 never qualifies");
  assert(!HighScores.qualifies(-5), "D: a negative score never qualifies");
  assert(HighScores.qualifies(1), "D: any positive score qualifies for an empty table");

  for (let i = 0; i < SCORES_MAX; i++) HighScores.add({ name: "P" + i, score: (i + 1) * 100, wave: 1, delivered: 0 });
  assert(HighScores.entries.length === SCORES_MAX, "D: table filled to SCORES_MAX");
  let sorted = true;
  for (let i = 1; i < HighScores.entries.length; i++) if (HighScores.entries[i].score > HighScores.entries[i - 1].score) sorted = false;
  assert(sorted, "D: entries sorted score-desc");

  const cutoff = HighScores.entries[SCORES_MAX - 1].score;
  assert(!HighScores.qualifies(cutoff), "D: a score EQUAL to the cutoff does not qualify (must beat it)");
  assert(!HighScores.qualifies(cutoff - 1), "D: a score below the cutoff does not qualify");
  assert(HighScores.qualifies(cutoff + 1), "D: a score above the cutoff DOES qualify");

  HighScores.add({ name: "HI", score: 100000, wave: 9, delivered: 9 });
  assert(HighScores.entries.length === SCORES_MAX, "D: table stays capped at SCORES_MAX after one more insert");
  assert(HighScores.entries[0].name === "HI", "D: the new top score sorts to #1");
})();

// ================= (E) every record carries all 8 fields, unique id across two runs =================
(function sectionE() {
  console.log("(E) every committed record carries the whole wire shape with a unique id across two runs");
  HighScores.entries = [];
  startGame();
  // ⚠ CS034 P7: assembled by makeRunResult() (spec §6.6), and `initials` is replaced by `name` on a new
  // record — replaced, not renamed: a legacy record keeps its own (see (C)'s tolerance and §6.2).
  game.score = 111; game.wave = 2; game.stats.delivered = 3;
  const rec1 = HighScores.add(makeRunResult());
  game.score = 222; game.wave = 4; game.stats.delivered = 5;
  const rec2 = HighScores.add(makeRunResult());
  const fields = ["v", "id", "name", "score", "wave", "delivered", "ts", "build",
                  "durationS", "saucerKills", "satelliteKills", "profileId", "profileName"];
  for (const rec of [rec1, rec2]) for (const f of fields) assert(f in rec, "E: record carries field '" + f + "'");
  assert(rec1.id !== rec2.id, "E: two records get unique ids across two 'runs'");
  assert(typeof rec1.id === "string" && rec1.id.length > 0, "E: id is a non-empty string");
  assert(rec1.v === 1 && rec2.v === 1, "E: record schema v === 1");
  assert(rec1.build === GAME_VERSION, "E: build tag matches GAME_VERSION");
  for (const rec of [rec1, rec2]) assert(!("initials" in rec), "E: ⛔ a NEW record carries no `initials` key at all");
})();

// ================= (F) the seam writes the record; the first confirm plays again ====================
// ⚠ CS034 P7 REPLACED THE OLD (F)/(G)/(H) WITH THIS ONE. Those three drove the initials field: confirm
// commits rather than restarts, a held key does not spin the letter, and the gamepad reaches the same
// dispatcher. All three are claims about a subsystem that no longer exists. What replaced it is one
// behaviour worth pinning just as hard, on both input paths: the record is written with no input at
// all, so the first confirm at gameover means "play again".
(function sectionF() {
  console.log("(F) the record is written at the seam with no input; the FIRST confirm plays again (kb + pad)");
  HighScores.entries = [];
  freshDeath(999999, 5, 7); // score high enough to qualify against an empty table
  assert(game.state === "gameover", "F: reached 'gameover'");
  assert(HighScores.entries.length === 1, "F: ⛔ the record is already written — no keypress was involved");
  const rec = HighScores.entries[0];
  assert(game.lastScoreId === rec.id, "F: ⛔ ...and it is the one the gameover table will highlight");
  assert(rec.name === Profiles.nameOf(Profiles.activeId), "F: ⛔ its name came from the active profile");
  assert(!("initials" in rec), "F: ⛔ ...and nothing typed any initials");
  assert(rec.score === 999999 && rec.wave === 5 && rec.delivered === 7, "F: the run's own numbers landed on it");

  const confirmKey = bindings.confirm.keys[0];
  keydown(confirmKey);
  assert(game.state === "playing", "F: ⛔ the FIRST confirm at gameover starts a new game (nothing intercepts it)");
  assert(HighScores.entries.length === 1, "F: ...and wrote no second record on the way");

  // The gamepad path lands in the same place, through handleGamepadMenu()'s own branch (3).
  HighScores.entries = [];
  freshDeath(888888, 3, 2);
  assert(HighScores.entries.length === 1, "F: (setup) the pad run's record is banked too");
  setPad(makePad([])); handleGamepadMenu();            // baseline so the next press is a fresh edge
  setPad(makePad([GP.A])); handleGamepadMenu();        // A = confirm
  assert(game.state === "playing", "F: ⛔ pad A at gameover starts a new game as well");
  noPad(); handleGamepadMenu();
})();

// ================= (I) draw() crash-free: empty/partial/full table, entry slots, browsable table ====
(function sectionI() {
  console.log("(I) draw() is crash-free: empty/partial/full tables and the browsable screen, both filters");
  let ok = true;
  const tryDraw = label => { try { draw(); } catch (e) { ok = false; console.error("  draw() threw (" + label + "): " + (e && e.stack || e)); } };

  HighScores.entries = [];
  game.lastScoreId = null;
  game.state = "gameover"; game.paused = false;
  tryDraw("empty table");

  for (let i = 0; i < 4; i++) HighScores.add({ name: "X" + i, score: (i + 1) * 10, wave: 1, delivered: 0 });
  tryDraw("partial table");

  // ⚠ CS034 P7: a LEGACY record — `initials`, no `name`, and none of the new stat fields — must render
  // beside the new ones without special-casing (spec §6.2's additive-only rule, at the renderer).
  HighScores.add({ initials: "OLD", score: 45, wave: 2 });
  tryDraw("a legacy record alongside new ones");

  for (let i = 4; i < SCORES_MAX; i++) HighScores.add({ name: "Y" + i, score: (i + 1) * 10, wave: 1, delivered: 0 });
  assert(HighScores.entries.length === SCORES_MAX, "I: table now full");
  game.lastScoreId = HighScores.entries[0].id;
  tryDraw("full table + fresh-entry highlight");

  game.state = "gameover";
  game.paused = true; game.menu.screen = "highscores";
  tryDraw("browsable High Scores screen — ALL PROFILES");
  game.menu.hsFilter = "profile";
  tryDraw("browsable High Scores screen — THIS PROFILE (nothing matches these seeded records)");
  game.menu.hsFilter = "all";
  game.paused = false; game.menu.screen = null;

  assert(ok, "I: draw() never threw across any of the above");
})();

// ================= (J) "High Scores" hangs off the TITLE MENU (CS016 P2, §2) =========================
// CS010 P4 §8b nested High Scores under Options precisely so it would be reachable from the pause menu
// mid-game. CS016 P2 (FORK-CS016-A, single-parent IA) DELIBERATELY REVERSES that: the title menu is now
// its sole parent, and the mid-run route is gone. The accepted mitigation — already covered by section
// (I) above and unaffected — is that the gameover screen renders the top-10 table inline with the fresh
// entry highlighted. The browse/return/cursor-restore assertions are the ones §8b shipped, repointed to
// the new parent; the two lost paths are asserted absent rather than deleted.
(function sectionJ() {
  console.log("(J) 'High Scores' is browsable from the title menu; no longer reachable via Options");
  assert(!MENU_OPTIONS.includes("High Scores"), "J: MENU_OPTIONS no longer carries a High Scores row (CS016 P2)");
  assert(MENU_TITLE.includes("High Scores"), "J: MENU_TITLE carries it instead — its sole parent now");

  // Path 1: the title's own menu -> High Scores -> back -> title menu, cursor restored.
  startGame(); quitToTitle();
  assert(game.state === "title" && !game.paused && game.menu.screen === "titlemenu",
    "J: the title screen owns a menu, unpaused");
  game.menu.index = MENU_TITLE.indexOf("High Scores");
  menuInput("confirm");
  assert(game.menu.screen === "highscores", "J: confirm on High Scores opens the highscores screen");
  assert(!game.paused, "J: browsing High Scores from the title does NOT pause (CS016 P1's concept split)");
  menuInput("back");
  assert(game.menu.screen === "titlemenu" && MENU_TITLE[game.menu.index] === "High Scores",
    "J: back returns to the title menu, cursor on High Scores");

  // Path 2: the two former routes through Options are gone, from the title and from a mid-run pause.
  openPause();
  assert(game.paused && game.menu.screen === "options", "J: title path: Options still opens directly");
  assert(MENU_OPTIONS.indexOf("High Scores") === -1, "J: title path: no High Scores row on Options");
  closePause();
  assert(!game.paused, "J: closePause() exits the Options overlay");

  startGame(); openPause(); // pause menu (play root: Continue/Options/Quit)
  game.menu.index = rootItems().indexOf("Options"); menuInput("confirm");
  assert(game.menu.screen === "options" && MENU_OPTIONS.indexOf("High Scores") === -1,
    "J: pause path: High Scores is unreachable mid-run (CS016 P2 accepted cost)");
  closePause();
})();

// ---- summary ----
console.log(`\ntest-v36-scores: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
