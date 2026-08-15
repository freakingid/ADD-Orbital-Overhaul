// Headless test for CS016 Phase 2 — the title screen becomes a navigable vertical menu, and
// Achievements / High Scores move to it as their SOLE parent (single-parent IA, FORK-CS016-A).
//
//   node scratchpad/test-cs016-p2.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): stub window/document/rAF/navigator/localStorage,
// eval the REAL <script> block, and drive the ACTUAL handlers — menuTitle/menuInput/menuOptions/
// menuAchievements/menuHighScores/openPause/closePause/returnToTitleMenu/gotoScreen/quitToTitle/
// startGame, the REAL captured keydown listener, and the REAL handleGamepadMenu with a fake pad.
// No navigation logic is reimplemented anywhere in this file.
//
// Sections:
//  (A) node --check; MENU_TITLE and the shrunk 4-row MENU_OPTIONS shapes.
//  (B) Boot lands on screen "titlemenu", game.paused false, cursor on "Start Game"; quitToTitle() from
//      a live run lands the same way.
//  (C) Cursor wrap both directions over the 4 rows; each row's confirm reaches the right destination.
//  (D) Achievements and High Scores Back both return to "titlemenu" with the cursor on their own row.
//  (E) Round trip: titlemenu -> Options -> Controls -> Back -> Options -> Back -> titlemenu, ending
//      unpaused with the cursor on "Options".
//  (F) The pause-path and gameover-path roots are UNCHANGED (still "root", Options' Back still -> root).
//  (G) Achievements/High Scores genuinely unreachable from Options.
//  (H) ESC at the title opens Options; "o" still does; ENTER on the default cursor starts a game;
//      gamepad Start at the title starts a game (plus A and B).
//  (I) DEBUG_CODE contains no w/a/s/d (upper or lower) — previously incidental, now LOAD-BEARING since
//      the code's characters fall through into handleMenuKey — and typing the full code at the title
//      still opens the debug panel without having moved the title cursor.
//  (J) AudioSys.ctx null -> startGame()/update(1/60) + a full title-menu nav cycle, no crash.
//  (K) RENDER (additive): drawTitleMenu draws four rows at the TITLE_MENU_* offsets in the
//      COLOR.text/COLOR.menuIdle convention with the "▶ " prefix and one drawMenuHint footer; the
//      title branch of draw() no longer emits the removed legend/blink/hint lines, still emits the
//      kept ones, and is chrome-less (no menuPanel fill/stroke, no backdrop dim).
//
// FLAG-CS016-l is also covered here (section D): menuActive() had to widen from `=== "titlemenu"` to
// `!== null`, or Achievements/High Scores reached from the title menu would own no input at all.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const scriptSrc = (() => {
  const m = fs.readFileSync(htmlPath, "utf8").match(/<script>([\s\S]*?)<\/script>/);
  if (!m) { console.error("Could not find <script> block"); process.exit(1); }
  return m[1];
})();

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const eqJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ================= (A) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs016-p2-extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
})();

// ---- Recording 2D context (the test-cs013-p2.js idiom): logs fillText/fillRect/strokeRect with the
// style state active at the call; every other ctx method is a safe no-op. ----
let recLog = [];
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null, shadowBlur: 0, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str, x, y, font: t.font, color: t.fillStyle, align: t.textAlign });
      if (p === "fillRect") return (x, y, w, h) => recLog.push({ c: "fillRect", x, y, w, h, color: t.fillStyle });
      if (p === "strokeRect") return (x, y, w, h) => recLog.push({ c: "strokeRect", x, y, w, h, color: t.strokeStyle });
      if (p === "measureText") return (str) => ({ width: (parseInt(t.font, 10) || 10) * 0.6 * str.length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

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
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}

const RETURN = [
  "startGame", "update", "draw", "game", "settings",
  "menuActive", "menuInput", "menuTitle", "menuOptions", "menuAchievements", "menuHighScores",
  "openPause", "closePause", "returnToTitleMenu", "quitToTitle", "gotoScreen", "openDebug",
  "handleMenuKey", "handleGamepadMenu", "pollGamepad", "rootItems",
  "MENU_TITLE", "MENU_OPTIONS", "MENU_ROOT_PLAY", "MENU_ROOT_OVER", "SOUND_ROWS", "DIFFICULTY_ROWS",
  "TITLE_MENU_Y", "TITLE_MENU_STEP", "TITLE_MENU_SIZE", "TITLE_MENU_HINT_Y", "TITLE_MENU_HINT",
  "MENU_HINT_SIZE", "COLOR", "VIEW_W", "VIEW_H", "GAME_VERSION",
  "drawTitleMenu", "drawMenu", "DEBUG_CODE", "DebugCode", "bindings", "GP", "keys", "AudioSys",
  "DEBUG_VARS",   // CS018 P2: section (I) derives the debug panel's first selectable row from the registry
  "Profiles",     // CS031 P5: section (K) reads the Profile row's own name-display contract off it
  "SaveSlots",    // CS032 P4: section (K) asks the REAL store whether the Load row should be dim
  "leaderboardModuleAvailable"   // CS033 P2: section (K) asks whether the Leaderboard row should be dim
];

// `audio: true` gives the real keydown listener a live AudioSys (it calls AudioSys.init() up front);
// the default leaves AudioSys.ctx null, which is what section (J) needs.
function build({ audio = true } = {}) {
  const recCtx = makeRecordingCtx();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  let pads = [];
  const navigatorStub = { getGamepads: () => pads };
  // CS031 P5: an unseeded store reads as a genuinely empty install (Profiles.firstBoot), which now
  // boots straight to the "profiles" screen instead of "titlemenu" (FORK-CS031-E). Every section in
  // this file assumes a returning player already on the title menu, so seed one frozen key to migrate
  // a roster the same way a real upgrading player's machine would.
  const lsStore = { afd_settings_v1: "{}" };
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const A = factory(windowStub, documentStub, { now: () => 100000 }, () => 0, navigatorStub, localStorageStub);

  // Real keydown, through the listener the script actually registered.
  A.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  // Real gamepad path: a clean rising edge, then one handleGamepadMenu() tick.
  const makePad = (press) => {
    const buttons = [];
    for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 });
    return { connected: true, buttons, axes: [0, 0, 0, 0] };
  };
  A.setPad = (press) => { pads = press === null ? [] : [makePad(press)]; A.pollGamepad(); };
  A.padPress = (...btns) => { A.setPad([]); A.setPad(btns); A.handleGamepadMenu(); };
  A.render = fn => { recLog = []; fn(); return recLog.slice(); };
  return A;
}

// ================= (A cont.) config shapes =====================
(function sectionA_shapes() {
  console.log("(A) MENU_TITLE and the shrunk MENU_OPTIONS shapes");
  const A = build();
  // CS031 P5 inserted "Profile" as the second row — pinned to its current post-P5 shape, the same
  // "re-runs against the current build" precedent MENU_ROOT_PLAY's own comment below already follows.
  // REPOINTED BY CS031 P5 ("Profile"), CS032 P4 ("Load Saved Game", inserted beside "Start Game") and
  // CS033 P2 ("Leaderboard", inserted beside "High Scores") — all of which this phase's own claim — the
  // title menu is the sole parent of Achievements and High Scores — is indifferent to. The literal is
  // re-pinned rather than loosened so a row appearing or disappearing unnoticed still fails here.
  const TITLE_ROWS = ["Start Game", "Load Saved Game", "Profile", "Achievements", "High Scores", "Leaderboard", "Options"];
  assert(eqJSON(A.MENU_TITLE, TITLE_ROWS),
    `A: MENU_TITLE === ${JSON.stringify(TITLE_ROWS)}; got ${JSON.stringify(A.MENU_TITLE)}`);
  assert(eqJSON(A.MENU_OPTIONS, ["Sound / Music", "Controls", "Difficulty", "Back"]),
    `A: MENU_OPTIONS shrank 6 -> 4; got ${JSON.stringify(A.MENU_OPTIONS)}`);
  assert(A.MENU_OPTIONS.length === 4, "A: MENU_OPTIONS is exactly 4 rows");
  // The two roots that existed before are untouched by THIS phase (P4 later adds a dim, inert "Save"
  // row to MENU_ROOT_PLAY, not P2 — this file re-runs against the current build, so it pins the
  // post-P4 shape rather than the stale pre-P4 one).
  assert(eqJSON(A.MENU_ROOT_PLAY, ["Continue", "Save", "Options", "Quit"]), "A: MENU_ROOT_PLAY (CS016 P4: + Save; P2 itself left it untouched)");
  assert(eqJSON(A.MENU_ROOT_OVER, ["Play Again", "Options", "Quit to Title"]), "A: MENU_ROOT_OVER untouched by P2 (or P4)");
  // No hardcoded index anywhere in the two repointed Back destinations.
  assert(!/gotoScreen\(\s*"titlemenu"\s*,\s*-?\d+\s*\)/.test(scriptSrc),
    "A: no gotoScreen(\"titlemenu\", <numeric literal>) — both call sites resolve via MENU_TITLE.indexOf");
})();

// ================= (B) boot + quitToTitle both land on the title menu =====================
(function sectionB() {
  console.log("(B) boot lands on \"titlemenu\", unpaused, cursor on Start Game; quitToTitle does too");
  const A = build();
  const g = A.game;

  // Boot: the game literal's own initial state, before anything has been driven.
  assert(g.state === "title", "B: boots in state \"title\"");
  assert(g.menu.screen === "titlemenu", "B: boots with the title's own menu armed (screen \"titlemenu\")");
  assert(g.paused === false, "B: boots UNPAUSED — the title menu owns input without freezing anything");
  assert(A.menuActive() === true, "B: ...and menuActive() is true anyway, so the input router owns the keys");
  assert(g.menu.index === 0 && A.MENU_TITLE[g.menu.index] === "Start Game",
    "B: cursor defaults to Start Game, so ENTER / A on a cold boot still starts a run");

  // quitToTitle() from a live run: same landing.
  A.startGame();
  assert(g.state === "playing" && g.menu.screen === null, "B: startGame clears the menu (in play there is no menu)");
  g.menu.index = 2; g.menu.row = 3; g.menu.col = 1; g.menu.scroll = 120; // stale cursor state to be cleared
  A.quitToTitle();
  assert(g.state === "title", "B: quitToTitle -> state title");
  assert(g.menu.screen === "titlemenu" && g.paused === false, "B: quitToTitle arms the title menu, unpaused");
  assert(g.menu.index === 0 && A.MENU_TITLE[g.menu.index] === "Start Game",
    "B: quitToTitle resets the cursor to Start Game (a stale index 2 would have landed on High Scores)");
  assert(g.menu.row === 0 && g.menu.col === 0 && g.menu.scroll === 0, "B: quitToTitle clears row/col/scroll too");

  // returnToTitleMenu(), the shared re-entry helper, lands on the Options row instead (where the
  // player just was) — and clears the paused flag openPause set.
  A.openPause();
  assert(g.paused === true && g.menu.screen === "options", "B: openPause from the title still routes straight to Options, paused");
  A.returnToTitleMenu();
  assert(g.paused === false && g.menu.screen === "titlemenu", "B: returnToTitleMenu clears paused and re-arms the title menu");
  assert(A.MENU_TITLE[g.menu.index] === "Options", "B: ...with the cursor on Options");
})();

// ================= (C) cursor wrap + every row's confirm destination =====================
(function sectionC() {
  console.log("(C) 4-row cursor wrap both directions; every row's confirm reaches the right screen");
  const A = build();
  const g = A.game;
  const N = A.MENU_TITLE.length;

  // Wrap DOWN through all four rows and past the end.
  A.quitToTitle();
  for (let i = 0; i < N; i++) {
    assert(g.menu.index === i, `C: down-walk sits on row ${i} (${A.MENU_TITLE[i]})`);
    A.menuInput("down");
  }
  assert(g.menu.index === 0, "C: down from the last row wraps to Start Game");

  // Wrap UP off the first row to the last, then all the way back.
  A.menuInput("up");
  assert(g.menu.index === N - 1 && A.MENU_TITLE[g.menu.index] === "Options", "C: up from Start Game wraps to Options");
  for (let i = N - 1; i > 0; i--) A.menuInput("up");
  assert(g.menu.index === 0, "C: up-walk returns to Start Game");

  // Nav never leaks into game state.
  assert(g.state === "title" && g.paused === false && g.menu.screen === "titlemenu",
    "C: nav alone changed nothing but the cursor");

  // Confirm on each row, driven through the real menuInput dispatcher (not menuTitle directly), so the
  // new `case "titlemenu"` in the switch is exercised.
  const dest = {};
  for (const label of A.MENU_TITLE) {
    A.quitToTitle();
    g.menu.index = A.MENU_TITLE.indexOf(label);
    A.menuInput("confirm");
    dest[label] = { screen: g.menu.screen, state: g.state, paused: g.paused };
  }
  assert(dest["Start Game"].state === "playing" && dest["Start Game"].screen === null,
    "C: confirm Start Game -> a real run (state playing, menu cleared)");
  assert(dest["Achievements"].screen === "achievements" && dest["Achievements"].paused === false,
    "C: confirm Achievements -> the achievements viewer, still unpaused");
  assert(dest["High Scores"].screen === "highscores" && dest["High Scores"].paused === false,
    "C: confirm High Scores -> the highscores table, still unpaused");
  assert(dest["Options"].screen === "options" && dest["Options"].paused === true,
    "C: confirm Options -> openPause() (paused, so Options keeps its dimmed-panel chrome)");

  // menuInput's dispatch really is going through menuTitle (dispatch by LABEL, not index): reorder a
  // local copy's cursor onto a label and confirm the label — not the position — decided the outcome.
  A.quitToTitle();
  g.menu.index = A.MENU_TITLE.indexOf("High Scores");
  A.menuTitle("confirm");
  assert(g.menu.screen === "highscores", "C: menuTitle dispatches the focused LABEL");
})();

// ================= (D) Back from Achievements / High Scores -> titlemenu, cursor restored =====
(function sectionD() {
  console.log("(D) Achievements/High Scores Back -> \"titlemenu\" with the cursor on their own row");
  const A = build();
  const g = A.game;

  for (const [label, screen, handler] of [
    ["Achievements", "achievements", A.menuAchievements],
    ["High Scores", "highscores", A.menuHighScores]
  ]) {
    for (const action of ["back", "confirm"]) {  // both exit this viewer
      A.quitToTitle();
      g.menu.index = A.MENU_TITLE.indexOf(label);
      A.menuInput("confirm");
      assert(g.menu.screen === screen, `D: reached ${screen} from the title menu`);
      // FLAG-CS016-l: this is the moment the "titlemenu"-only menuActive() went false. It must not.
      assert(A.menuActive() === true,
        `D: menuActive() stays TRUE on ${screen} even though game.paused is false (FLAG-CS016-l fix)`);
      A.menuInput(action);
      assert(g.menu.screen === "titlemenu", `D: ${action} from ${screen} -> titlemenu`);
      assert(A.MENU_TITLE[g.menu.index] === label, `D: ...cursor restored to the "${label}" row`);
      assert(g.paused === false, "D: ...and nothing got left paused");
      assert(typeof handler === "function", `D: sanity — the real ${screen} handler is exported and was driven via menuInput`);
    }
  }

  // The scroll offset resets on every entry (gotoScreen does it) — a stale offset must not survive.
  A.quitToTitle();
  g.menu.index = A.MENU_TITLE.indexOf("Achievements");
  A.menuInput("confirm");
  A.menuInput("down"); A.menuInput("down");
  const scrolled = g.menu.scroll;
  A.menuInput("back");
  A.menuInput("confirm"); // cursor is still on Achievements, so this re-enters it
  assert(g.menu.screen === "achievements" && g.menu.scroll === 0,
    `D: re-entry resets the viewer scroll to 0 (was ${scrolled})`);
})();

// ================= (E) full round trip through Options =====================
(function sectionE() {
  console.log("(E) titlemenu -> Options -> Controls -> Back -> Options -> Back -> titlemenu");
  const A = build();
  const g = A.game;

  A.quitToTitle();
  g.menu.index = A.MENU_TITLE.indexOf("Options");
  A.menuInput("confirm");
  assert(g.menu.screen === "options" && g.paused === true, "E: title menu -> Options (paused for the panel chrome)");

  g.menu.index = A.MENU_OPTIONS.indexOf("Controls");
  A.menuInput("confirm");
  assert(g.menu.screen === "controls", "E: Options -> Controls");

  A.menuInput("back");
  assert(g.menu.screen === "options" && A.MENU_OPTIONS[g.menu.index] === "Controls",
    "E: Controls Back -> Options, cursor on Controls");

  A.menuInput("back");
  assert(g.menu.screen === "titlemenu", "E: Options Back -> the title menu");
  assert(g.paused === false, "E: ...and the paused flag openPause set is cleared");
  assert(A.MENU_TITLE[g.menu.index] === "Options", "E: ...with the cursor back on the Options row");
  assert(g.state === "title", "E: still on the title screen throughout");

  // The other Options exit — confirm on the "Back" ROW — must behave identically (two branches, one helper).
  g.menu.index = A.MENU_TITLE.indexOf("Options"); A.menuInput("confirm");
  g.menu.index = A.MENU_OPTIONS.indexOf("Back"); A.menuInput("confirm");
  assert(g.menu.screen === "titlemenu" && g.paused === false && A.MENU_TITLE[g.menu.index] === "Options",
    "E: confirm on Options' own Back row lands identically (both branches route through returnToTitleMenu)");

  // And a `pause` action from an Options SUB-screen at the title (closePause's path) must not strand the
  // title with a null screen — that would render cursor-less and read menuActive() false.
  g.menu.index = A.MENU_TITLE.indexOf("Options"); A.menuInput("confirm");
  g.menu.index = A.MENU_OPTIONS.indexOf("Sound / Music"); A.menuInput("confirm");
  assert(g.menu.screen === "sound", "E: Options -> Sound / Music");
  A.menuInput("pause");
  assert(g.menu.screen === "titlemenu" && g.paused === false,
    "E: `pause` out of a title sub-screen lands on the title menu, never a null screen (closePause is title-aware)");
})();

// ================= (F) the pause-path and gameover-path roots are UNCHANGED =====================
(function sectionF() {
  console.log("(F) pause/gameover roots unchanged: still \"root\", Options' Back still -> root");
  const A = build();
  const g = A.game;

  // Paused mid-game.
  A.startGame();
  A.openPause();
  assert(g.paused === true && g.menu.screen === "root", "F: paused mid-game still opens \"root\" (NOT titlemenu)");
  // CS016 P4 inserted a dim, inert "Save" row into MENU_ROOT_PLAY — pinned against the live constant.
  assert(eqJSON(A.rootItems(), A.MENU_ROOT_PLAY), "F: ...with the play-root layout");
  g.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
  assert(g.menu.screen === "options", "F: root -> Options");
  A.menuInput("back");
  assert(g.menu.screen === "root" && g.paused === true, "F: Options Back mid-game still returns to \"root\", still paused");
  assert(A.rootItems()[g.menu.index] === "Options", "F: ...cursor on the Options row");
  A.menuInput("back");
  assert(g.paused === false && g.menu.screen === null, "F: Back from the play root still closes to a null screen (not titlemenu)");

  // Gameover.
  g.state = "gameover"; g.paused = false; g.menu.screen = null;
  A.openPause();
  assert(g.menu.screen === "root", "F: gameover still opens \"root\"");
  assert(eqJSON(A.rootItems(), ["Play Again", "Options", "Quit to Title"]), "F: ...with the gameover layout");
  g.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
  A.menuInput("back");
  assert(g.menu.screen === "root" && g.paused === true, "F: Options Back at gameover still returns to \"root\"");
  A.menuInput("back");
  assert(g.paused === false && g.menu.screen === null, "F: Back from the gameover root closes to a null screen");

  // Difficulty / Sound / Controls all still return to Options, not to the title menu, in every context.
  for (const state of ["playing", "gameover"]) {
    for (const [row, screen] of [["Sound / Music", "sound"], ["Controls", "controls"], ["Difficulty", "difficulty"]]) {
      A.startGame(); g.state = state; g.paused = false; g.menu.screen = null;
      A.openPause();
      g.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
      g.menu.index = A.MENU_OPTIONS.indexOf(row); A.menuInput("confirm");
      assert(g.menu.screen === screen, `F: [${state}] Options -> ${screen}`);
      A.menuInput("back");
      assert(g.menu.screen === "options" && A.MENU_OPTIONS[g.menu.index] === row,
        `F: [${state}] ${screen} Back -> Options, cursor on "${row}" (unchanged by P2)`);
    }
  }
})();

// ================= (G) Achievements/High Scores unreachable from Options =====================
(function sectionG() {
  console.log("(G) Options genuinely no longer offers Achievements or High Scores");
  const A = build();
  const g = A.game;

  assert(!A.MENU_OPTIONS.includes("Achievements"), "G: MENU_OPTIONS contains no \"Achievements\" label");
  assert(!A.MENU_OPTIONS.includes("High Scores"), "G: MENU_OPTIONS contains no \"High Scores\" label");
  // Not hidden behind an unreachable row either — no confirm on ANY Options row reaches either screen,
  // in any context. Drive every row of the real handler and collect where it goes.
  for (const state of ["title", "playing", "gameover"]) {
    for (let i = 0; i < A.MENU_OPTIONS.length; i++) {
      A.startGame();
      if (state === "title") { A.quitToTitle(); A.openPause(); }
      else { g.state = state; g.paused = false; g.menu.screen = null; A.openPause();
             if (g.menu.screen === "root") { g.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm"); } }
      g.menu.index = i;
      A.menuInput("confirm");
      assert(g.menu.screen !== "achievements" && g.menu.screen !== "highscores",
        `G: [${state}] Options row ${i} ("${A.MENU_OPTIONS[i]}") does not reach a moved screen (got ${g.menu.screen})`);
    }
  }
  // Nor from either root layout.
  A.startGame(); A.openPause();
  assert(!A.rootItems().includes("Achievements") && !A.rootItems().includes("High Scores"),
    "G: the play root offers neither either");
  g.state = "gameover";
  assert(!A.rootItems().includes("Achievements") && !A.rootItems().includes("High Scores"),
    "G: the gameover root offers neither either");
  // And their sole parent does.
  assert(A.MENU_TITLE.includes("Achievements") && A.MENU_TITLE.includes("High Scores"),
    "G: MENU_TITLE is where both live now");
})();

// ================= (H) keyboard + gamepad at the title =====================
(function sectionH() {
  console.log("(H) ESC/o open Options at the title; ENTER starts a game; pad Start/A start, pad B opens Options");
  const A = build();
  const g = A.game;

  // ESC — new this phase (§7 / spec 1.3). It resolves to the "back" action, which menuTitle routes to
  // Options; before P2 it was inert at the title (branch (3) only pauses when state === "playing").
  A.quitToTitle();
  assert(A.bindings.back.keys.includes("escape"), "H: sanity — ESC is the back binding");
  A.keydown("Escape");
  assert(g.paused === true && g.menu.screen === "options" && g.state === "title",
    "H: ESC at the title opens Options (CS016 P2 §7 — was inert)");
  A.keydown("Escape");
  assert(g.paused === false && g.menu.screen === "titlemenu", "H: ESC again backs out to the title menu");

  // "o" — existing muscle memory, kept (FLAG-CS016-e). It now routes handleMenuKey -> "options" ->
  // menuTitle, because branch (2) swallows every key once the title menu owns input.
  A.quitToTitle();
  A.keydown("o");
  assert(g.paused === true && g.menu.screen === "options", "H: \"o\" at the title still opens Options");
  assert(g.state === "title", "H: ...and did not also start a game");
  A.menuInput("back");

  // ENTER on the default cursor starts a game.
  A.quitToTitle();
  assert(A.MENU_TITLE[g.menu.index] === "Start Game", "H: sanity — the default cursor is on Start Game");
  A.keydown("Enter");
  assert(g.state === "playing" && g.paused === false && g.menu.screen === null,
    "H: ENTER on the default cursor starts a run");

  // ENTER on a NON-default row must NOT start a game (branch (3)'s title startGame() is properly shadowed).
  A.quitToTitle();
  g.menu.index = A.MENU_TITLE.indexOf("High Scores");
  A.keydown("Enter");
  assert(g.state === "title" && g.menu.screen === "highscores",
    "H: ENTER on High Scores opens that screen and does NOT fall through to startGame()");

  // Gamepad Start at the title — routed through menuTitle's "pause" branch so it still starts a run.
  A.quitToTitle();
  A.padPress(A.GP.START);
  assert(g.state === "playing", "H: pad Start at the title still starts a game (via menuTitle's pause branch)");

  // Gamepad A (confirm) at the title acts on the focused row.
  A.quitToTitle();
  A.setPad([]);
  A.padPress(A.GP.A);
  assert(g.state === "playing", "H: pad A on the default Start Game row starts a game");
  A.quitToTitle(); A.setPad([]);
  g.menu.index = A.MENU_TITLE.indexOf("Achievements");
  A.padPress(A.GP.A);
  assert(g.menu.screen === "achievements" && g.state === "title", "H: pad A confirms the focused row, not a blanket start");

  // Gamepad B at the title opens Options — the behaviour handleGamepadMenu branch (3) used to provide,
  // preserved through menuTitle's "back" branch.
  A.quitToTitle(); A.setPad([]);
  A.padPress(A.GP.B);
  assert(g.paused === true && g.menu.screen === "options", "H: pad B at the title still opens Options");

  // Regression guard: branch (3) is still LIVE at gameover, where no menu is open.
  A.startGame(); g.state = "gameover"; g.paused = false; g.menu.screen = null; A.setPad([]);
  A.keydown("Enter");
  assert(g.state === "playing", "H: ENTER at gameover still starts a game via keydown branch (3)");
  g.state = "gameover"; g.paused = false; g.menu.screen = null;
  A.keydown("o");
  assert(g.paused === true && g.menu.screen === "root", "H: \"o\" at gameover still opens the gameover root via branch (3)");
  A.closePause();
  g.state = "gameover"; g.paused = false; g.menu.screen = null; A.setPad([]);
  A.padPress(A.GP.A);
  assert(g.state === "playing", "H: pad A at gameover still starts a game via handleGamepadMenu branch (3)");
})();

// ================= (I) the debug secret code is still inert on the title menu =====================
(function sectionI() {
  console.log("(I) DEBUG_CODE has no w/a/s/d; typing it at the title opens debug without moving the cursor");
  const A = build();
  const g = A.game;

  // THE LOAD-BEARING PROPERTY. Before P2 the code's characters fell through inert because no branch
  // consumed them at the title; now they fall into handleMenuKey, which treats w/a/s/d as nav. So this
  // is no longer incidental: a code containing any of them would silently walk the title cursor.
  const NAV = new Set(["w", "a", "s", "d"]);
  for (const ch of A.DEBUG_CODE) {
    assert(!NAV.has(ch.toLowerCase()), `I: DEBUG_CODE character "${ch}" is not a w/a/s/d nav key`);
  }
  // Belt and braces: no character of the code maps to ANY menu action at all.
  const acted = [];
  for (const ch of A.DEBUG_CODE) {
    A.quitToTitle();
    const before = { index: g.menu.index, screen: g.menu.screen, paused: g.paused, state: g.state };
    A.handleMenuKey(ch.toLowerCase());
    if (g.menu.index !== before.index || g.menu.screen !== before.screen ||
        g.paused !== before.paused || g.state !== before.state) acted.push(ch);
  }
  assert(acted.length === 0, `I: no DEBUG_CODE character resolves to a menu action; offenders: ${JSON.stringify(acted)}`);

  // Now type the whole thing for real, through the actual keydown listener, from the armed title menu.
  A.quitToTitle();
  const idx0 = g.menu.index;
  A.keydown("`");                                   // arm
  assert(A.DebugCode.armed === true, "I: the backtick armed the capture window at the title");
  for (const ch of A.DEBUG_CODE) A.keydown(ch);     // raw e.key preserves case + shifted symbols
  assert(g.menu.screen === "debug", "I: the full code still opens the hidden debug panel from the title");
  assert(g.paused === true, "I: ...via openDebug(), which pauses (its own sibling-of-openPause contract)");
  // CS018 P2: the code's open path is now enterDebug(), which normalises the cursor onto the first
  // SELECTABLE row — row 0 is a non-selectable section header, so index 0 would leave the panel cursor-less.
  const firstDebugRow = A.DEBUG_VARS.findIndex(v => !v.header);
  assert(g.menu.index === firstDebugRow,
    `I: opening the panel resets the cursor to its own first selectable row (${firstDebugRow}, got ${g.menu.index})`);
  assert(idx0 === 0, "I: sanity — the title cursor started on row 0, so no nav could hide in that check");

  // Backing out of the debug panel from the title must land on the title menu, not a null screen.
  A.menuInput("back");
  assert(g.menu.screen === "titlemenu" && g.paused === false,
    "I: debugReturn from the title lands on the title menu (closePause is title-aware)");

  // Stronger cursor check: arm and type from a NON-zero cursor row and confirm it survives untouched.
  A.quitToTitle();
  g.menu.index = A.MENU_TITLE.indexOf("High Scores");
  const idx1 = g.menu.index;
  A.keydown("`");
  for (const ch of A.DEBUG_CODE) A.keydown(ch);
  assert(g.menu.screen === "debug", "I: the code lands from a non-default cursor row too");
  A.menuInput("back");
  assert(g.menu.screen === "titlemenu", "I: ...and backs out to the title menu");
  // openDebug/closePause both reset the index, so compare against what the title menu re-arms to
  // rather than idx1 — the point is that NONE of the code's keystrokes navigated while it was typed.
  assert(idx1 === A.MENU_TITLE.indexOf("High Scores"), "I: the cursor was still on High Scores when the code completed");
})();

// ================= (J) AudioSys.ctx null smoke =====================
(function sectionJ() {
  console.log("(J) AudioSys.ctx null: startGame/update + a full title-menu nav cycle never throw");
  const A = build({ audio: false });
  const g = A.game;
  assert(A.AudioSys.ctx === null, "J: sanity — no AudioContext stub means AudioSys.ctx is null");

  let threw = null;
  try {
    A.startGame();
    for (let i = 0; i < 30; i++) A.update(1 / 60);
    A.quitToTitle();
    // walk every row, enter it, come back
    for (const label of A.MENU_TITLE) {
      A.quitToTitle();
      g.menu.index = A.MENU_TITLE.indexOf(label);
      A.draw();                        // the chrome-less title render
      A.menuInput("confirm");
      A.draw();                        // whichever screen it opened
      if (g.state === "playing") { A.update(1 / 60); A.quitToTitle(); }
      else { A.menuInput("back"); }
      A.draw();
    }
    // nav + the ESC/o/pad shortcuts, then a couple of frames
    A.menuInput("down"); A.menuInput("up"); A.menuInput("back"); A.menuInput("pause");
    A.update(1 / 60); A.draw();
  } catch (e) { threw = e; }
  assert(!threw, "J: no throw across startGame/update/draw + the full title-menu cycle" + (threw ? ": " + threw.stack : ""));
})();

// ================= (K) RENDER: the chrome-less title menu =====================
(function sectionK() {
  console.log("(K) drawTitleMenu geometry/colors; the title branch drops the removed lines and adds no chrome");
  const A = build();
  const g = A.game;
  const cx = A.VIEW_W / 2;
  const at = (log, x, y) => log.filter(e => e.c === "fillText" && e.x === x && e.y === y);
  const fontSize = e => parseInt(e.font, 10);

  // The layout constants are real, named, and derived from VIEW_H (not magic inline numbers).
  // CS031 P5 (FORK-CS031-G → b): Y and STEP are now DERIVED from MENU_TITLE.length via
  // titleMenuLayout(n), not the fixed literals this section originally pinned — this pins the current
  // shape's OUTPUT. See scratchpad/test-cs031-p5.js for the derivation itself.
  // REPOINTED BY CS032 P4: N went 5 -> 6 ("Load Saved Game"). Y is unmoved at 324 — the block stays
  // centred in the band — and STEP shrank 33 -> 26.4, which is the self-healing FORK-G bought and the
  // reason this phase needed no TITLE_MENU_* knob edit.
  // REPOINTED AGAIN BY CS033 P2: N went 6 -> 7 ("Leaderboard"). Y still unmoved at 324; STEP shrank
  // again, 26.4 -> 22, same self-healing, same reason.
  assert(A.TITLE_MENU_Y === 324, "K: TITLE_MENU_Y is 324 at the current 7-row MENU_TITLE (derived, CS031 P5)");
  assert(A.TITLE_MENU_STEP === 22, `K: TITLE_MENU_STEP is 22px at the current 7-row MENU_TITLE (got ${A.TITLE_MENU_STEP})`);
  assert(A.TITLE_MENU_SIZE === 24, "K: TITLE_MENU_SIZE is 24 (matches drawRootMenu's rows)");
  assert(A.TITLE_MENU_HINT_Y === A.VIEW_H / 2 + 170, "K: TITLE_MENU_HINT_Y is VIEW_H/2 + 170 (530 at 720)");

  // The rows clear the art above and the flavour line below (the two things (7) said to keep).
  const lastRow = A.TITLE_MENU_Y + (A.MENU_TITLE.length - 1) * A.TITLE_MENU_STEP;
  assert(A.TITLE_MENU_Y > A.VIEW_H / 2 - 60, "K: the first row sits below the O V E R H A U L baseline");
  assert(lastRow < A.VIEW_H / 2 + 120, "K: the last row sits above the BEWARE THE HUNTER SATELLITE baseline");
  assert(A.TITLE_MENU_HINT_Y > A.VIEW_H / 2 + 120, "K: the hint sits below the flavour line");
  assert(A.TITLE_MENU_HINT_Y < A.VIEW_H - 16, "K: ...and above the version stamp");

  // drawTitleMenu itself: four rows, "▶ " on the selected one, text/menuIdle convention, one hint.
  A.quitToTitle();
  g.menu.index = A.MENU_TITLE.indexOf("High Scores");
  const log = A.render(A.drawTitleMenu);
  A.MENU_TITLE.forEach((label, i) => {
    const rows = at(log, cx, A.TITLE_MENU_Y + i * A.TITLE_MENU_STEP);
    assert(rows.length === 1, `K: exactly one fillText for the "${label}" row`);
    if (!rows.length) return;
    const sel = i === g.menu.index;
    // CS032 P4: "Load Saved Game" is the unavailable-row idiom's newest consumer — COLOR.dim while the
    // active profile has zero occupied slots, which is this build's state (asked through the REAL
    // SaveSlots, not assumed). scratchpad/test-cs032-p4.js §E owns that rule in both directions; here
    // the row is only excluded from the plain selected/idle convention.
    // CS033 P2: "Leaderboard" joins the same idiom — COLOR.dim while window.KitLeaderboard is absent,
    // which is every headless build (the module is loaded by a <script type="module"> tag this harness
    // never evaluates). scratchpad/test-cs033-p2.js owns that rule; here it's the same exclusion.
    const dim = (label === "Load Saved Game" && A.SaveSlots.count() === 0) ||
                (label === "Leaderboard" && !A.leaderboardModuleAvailable());
    const want = dim ? A.COLOR.dim : (sel ? A.COLOR.text : A.COLOR.menuIdle);
    assert(rows[0].color === want,
      `K: "${label}" draws in ${dim ? "COLOR.dim" : sel ? "COLOR.text" : "COLOR.menuIdle"}`);
    // CS031 P5 (FORK-CS031-H → c): the Profile row IS the name display — it renders "Profile: NAME",
    // not the bare label. scratchpad/test-cs031-p5.js owns that render's own contract; this section
    // only checks that the shared "▶ " prefix idiom still applies to it.
    const text = label === "Profile" ? "Profile: " + A.Profiles.nameOf(A.Profiles.activeId) : label;
    assert(rows[0].str === (sel ? "▶ " : "   ") + text, `K: "${label}" uses the shared "▶ " selection prefix`);
    assert(fontSize(rows[0]) === A.TITLE_MENU_SIZE, `K: "${label}" draws at TITLE_MENU_SIZE`);
  });
  const hint = at(log, cx, A.TITLE_MENU_HINT_Y);
  assert(hint.length === 1 && hint[0].str === A.TITLE_MENU_HINT, "K: one control-hint footer, the TITLE_MENU_HINT text");
  assert(hint.length === 1 && hint[0].color === A.COLOR.menuIdle && fontSize(hint[0]) === A.MENU_HINT_SIZE,
    "K: the footer went through drawMenuHint (COLOR.menuIdle at MENU_HINT_SIZE), not a fresh drawText literal");
  // CHROME-LESS: drawTitleMenu paints no panel and no backdrop.
  assert(!log.some(e => e.c === "fillRect" || e.c === "strokeRect"),
    "K: drawTitleMenu draws no fillRect/strokeRect — no menuPanel box, no backdrop dim");

  // The full title branch of draw(): removed lines gone, kept lines present, still chrome-less.
  A.quitToTitle();
  const full = A.render(A.draw);
  const texts = full.filter(e => e.c === "fillText").map(e => e.str);
  for (const gone of ["ROTATE", "THRUST", "FIRE: SPACE", "SHIELD", "PRESS ENTER TO START", "OPTIONS / ACHIEVEMENTS"]) {
    assert(!texts.some(t => t.includes(gone)), `K: the title no longer draws "${gone}"`);
  }
  assert(texts.includes("ORBITAL"), "K: ORBITAL kept");
  assert(texts.includes("O V E R H A U L"), "K: O V E R H A U L kept");
  assert(texts.includes("BEWARE THE HUNTER SATELLITE"), "K: the flavour line kept");
  assert(texts.some(t => t === "v" + A.GAME_VERSION), "K: the version stamp kept");
  A.MENU_TITLE.forEach(label => {
    // CS031 P5: the Profile row renders "Profile: NAME", so it never ends with the bare label "Profile".
    const want = label === "Profile" ? "Profile: " + A.Profiles.nameOf(A.Profiles.activeId) : label;
    assert(texts.some(t => t.endsWith(want)), `K: the "${label}" row is drawn by the title branch`);
  });
  assert(!full.some(e => e.c === "strokeRect"), "K: the title screen strokes no menu panel");
  assert(!full.some(e => e.c === "fillRect" && e.w === A.VIEW_W && e.h === A.VIEW_H),
    "K: no full-viewport backdrop dim over the title art");

  // Options opened FROM the title still gets drawMenu()'s chrome — the dim and the panel are both back.
  A.openPause();
  const opts = A.render(A.draw);
  assert(opts.some(e => e.c === "fillRect" && e.w === A.VIEW_W && e.h === A.VIEW_H),
    "K: Options over the title still paints drawMenu()'s full-viewport backdrop dim");
  assert(opts.some(e => e.c === "strokeRect"), "K: ...and its menuPanel box");
  assert(!opts.some(e => e.c === "fillText" && e.str.startsWith("▶ Options")),
    "K: the title menu is NOT drawn underneath the Options panel (the two paths are exclusive)");

  // Achievements/High Scores reached from the title (paused FALSE) must still render. Before the
  // draw-gate moved from game.paused to game.menu.screen, these drew nothing at all.
  for (const label of ["Achievements", "High Scores"]) {
    A.quitToTitle();
    g.menu.index = A.MENU_TITLE.indexOf(label);
    A.menuInput("confirm");
    assert(g.paused === false, `K: ${label} from the title is unpaused`);
    const scr = A.render(A.draw);
    assert(scr.some(e => e.c === "strokeRect"),
      `K: ${label} still renders its panel from the title despite game.paused being false`);
    assert(!scr.some(e => e.c === "fillText" && e.str === "▶ " + label),
      `K: ...and the title menu is not drawn under it`);
  }
})();

console.log(`\ntest-cs016-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
