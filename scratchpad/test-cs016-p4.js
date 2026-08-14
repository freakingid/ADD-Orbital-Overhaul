// Headless test for CS016 Phase 4 — the shared "unavailable row" idiom: a menu row that is visible and
// focusable but cannot be actioned. This phase built two consumers: the disabled "Save" row in the
// pause root (MENU_ROOT_PLAY), and the Difficulty value rows locked while a run is in progress.
// ⛔ CS032 P4 made "Save" LIVE, so the Difficulty lock is the consumer this file still tests — §B was
// repointed in place (see its own header) and §D–§G are untouched.
//
//   node scratchpad/test-cs016-p4.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): stub window/document/rAF/navigator/localStorage,
// eval the REAL <script> block, and drive the ACTUAL menuRoot/menuDifficulty/drawRootMenu/drawDifficulty
// — no menu logic reimplemented here. The canvas-recording stub matches the test-cs013-p2.js /
// test-cs016-p3.js idiom (logs fillText/fillRect/strokeRect with the style state active at the call).
//
// Sections:
//  (A) node --check; MENU_ROOT_PLAY is 4 rows with Save at index 1; MENU_ROOT_OVER still 3 rows, no Save.
//  (B) the cursor CAN land on and pass through Save; confirm opens the "slots" screen in save mode;
//      the row renders in the ordinary selected/idle colours (REPOINTED, CS032 P4 — was inert + dim).
//  (C) drawRootMenu's derived panel height fits every row + the hint, for BOTH the 4-row pause root and
//      the 3-row gameover root — read off the real strokeRect bounds, not a re-derived formula.
//  (D) locked Difficulty (game.state "playing"): left/right on shot/magnet/autoshield is a byte-identical
//      no-op — no settings write, no saveSettings, no persistence.
//  (E) unlocked Difficulty (gameover, and from the title): the same presses DO change settings and DO
//      persist — the lock does not leak outside a live run.
//  (F) the Back row is live in both states.
//  (G) locked rows render COLOR.dim (label, both toggle sides, chevrons) and unlocked rows do not; the
//      per-row help line is replaced by DIFFICULTY_LOCK_HELP only while locked.
//  (H) AudioSys.ctx null smoke across the full Save + Difficulty-lock cycle.

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

// ================= (A, part 1) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs016-p4-extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
})();

// ---- Recording 2D context (test-cs013-p2.js / test-cs016-p3.js idiom) ----
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
  "startGame", "update", "draw", "game", "settings", "saveSettings", "loadSettings",
  "menuActive", "menuInput", "menuRoot", "menuDifficulty", "rootItems",
  "openPause", "closePause", "returnToTitleMenu", "quitToTitle", "gotoScreen",
  "MENU_ROOT_PLAY", "MENU_ROOT_OVER", "MENU_OPTIONS", "MENU_TITLE",
  "DIFFICULTY_ROWS", "DIFFICULTY_LOCK_HELP",
  "drawRootMenu", "drawDifficulty", "drawMenu",
  "COLOR", "MENU_HINT_SIZE", "ROOT_MENU_HINT", "VIEW_W", "VIEW_H", "GAME_VERSION",
  "AudioSys", "STORAGE_KEY", "DEBUG"   // DEBUG: CS017 P6's chain-guard help line interpolates two knobs
];

// `audio: true` gives the real keydown-adjacent helpers a live AudioSys; the default leaves
// AudioSys.ctx null, which is what the (H) smoke needs.
function build({ audio = true } = {}) {
  const recCtx = makeRecordingCtx();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  let setItemCalls = 0;
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { setItemCalls++; lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const A = factory(windowStub, documentStub, { now: () => 100000 }, () => 0, navigatorStub, localStorageStub);

  A.store = lsStore;
  A.setItemCalls = () => setItemCalls;
  A.render = fn => { recLog = []; fn(); return recLog.slice(); };

  // Paused mid-run, cursor parked on the given MENU_ROOT_PLAY label.
  A.atPauseRoot = (label) => {
    A.startGame(); A.openPause();
    if (label) A.game.menu.index = A.rootItems().indexOf(label);
    return A.game.menu;
  };
  // The Difficulty screen, reached the real way (root -> Options -> Difficulty) while a run is live —
  // the locked scenario (game.state stays "playing").
  A.atDifficultyLocked = () => {
    A.startGame(); A.openPause();
    A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
    A.game.menu.index = A.MENU_OPTIONS.indexOf("Difficulty"); A.menuInput("confirm");
    return A.game.menu;
  };
  // The Difficulty screen reached with no run in progress — the unlocked scenario. `from` picks the
  // route: "gameover" (via the gameover root) or "title" (via the title menu's Options shortcut).
  A.atDifficultyUnlocked = (from) => {
    if (from === "title") {
      A.quitToTitle();
      A.game.menu.index = A.MENU_TITLE.indexOf("Options"); A.menuInput("confirm");
    } else {
      A.startGame(); A.game.state = "gameover"; A.game.paused = false; A.game.menu.screen = null;
      A.openPause();
      A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
    }
    A.game.menu.index = A.MENU_OPTIONS.indexOf("Difficulty"); A.menuInput("confirm");
    return A.game.menu;
  };
  return A;
}

// The exact per-row help strings drawDifficulty carries (unchanged by this phase) — used to prove
// the locked help line REPLACES these rather than appending to them.
// CS017 P6: a FOURTH row (Chain guard) joined the screen. Its help line is the one that INTERPOLATES
// live DEBUG_VARS values, so it is rebuilt here from the same knobs rather than pinned as a literal —
// that keeps the "the lock replaces the per-row tip" assertion exact without pinning a number that the
// debug panel is designed to change.
// REPOINTED BY CS024 P6 (spec §3.7): the three expiry-mode help lines are DELETED with their rows —
// including the interpolated chain-guard one, which read DEBUG.chainGuardTime, a knob that no longer
// exists. Auto-shield's line is untouched and is the only one left.
const helpText = A => [
  "Auto-raises shield at critical hull. -500 points per blocked hit.",
];
const DIFFICULTY_VALUE_ROWS = 1;   // CS024 P6: autoshield alone (Back excluded) — was 4
const DIFFICULTY_PANEL_H = 302;    // CS024 P6: 476 - 3*58, three value rows removed
const DIFFICULTY_HELP_DY = 248;    // CS024 P6: the help line's y offset inside the panel (was 422)

// ================= (A, part 2) config shapes =====================
(function sectionA_shapes() {
  console.log("(A) MENU_ROOT_PLAY is 4 rows w/ Save@1; MENU_ROOT_OVER still 3 rows, no Save");
  const A = build();
  assert(eqJSON(A.MENU_ROOT_PLAY, ["Continue", "Save", "Options", "Quit"]),
    `A: MENU_ROOT_PLAY === [Continue, Save, Options, Quit]; got ${JSON.stringify(A.MENU_ROOT_PLAY)}`);
  assert(A.MENU_ROOT_PLAY.indexOf("Save") === 1, "A: Save sits at index 1");
  assert(A.MENU_ROOT_OVER.length === 3 && !A.MENU_ROOT_OVER.includes("Save"),
    `A: MENU_ROOT_OVER is still 3 rows and carries no Save; got ${JSON.stringify(A.MENU_ROOT_OVER)}`);
  assert(eqJSON(A.MENU_ROOT_OVER, ["Play Again", "Options", "Quit to Title"]), "A: MENU_ROOT_OVER unchanged");
})();

// ================= (B) the Save row: focusable, live, ordinary colours =====================
// ⛔ REPOINTED BY CS032 P4. This section originally pinned the OTHER half of what this phase built:
// "Save" as the unavailable-row idiom's canonical demonstrator — inert confirm, forced COLOR.dim. That
// row went LIVE in CS032 P4 (both halves, one commit), so those two claims are now false OF THIS ROW
// and were repointed rather than deleted: the claims that survive the change (the cursor can land on
// it, the cursor passes freely through it) stay here, and the pair that flipped is asserted in its new
// direction. The IDIOM itself is untouched and still fully under test — by this file's own §D–§G
// (Difficulty's mid-run lock, the phase's second consumer) and by test-cs031-p4.js's "Add Profile" cap,
// which is now its canonical example. test-cs032-p4.js §A/§B owns the Save row's new contract.
(function sectionB() {
  console.log("(B) cursor CAN land on Save; confirm opens the slots screen; renders in the ordinary colours");
  const A = build();
  const g = A.game;

  A.atPauseRoot("Save");
  assert(A.rootItems()[g.menu.index] === "Save", "B: (precondition) cursor is parked on Save");

  A.menuInput("confirm");
  assert(g.menu.screen === "slots", "B: confirm on Save opens the slots screen (CS032 P4 — was inert)");
  assert(g.menu.slotMode === "save", "B: ...in save mode");
  assert(g.state === "playing" && g.paused === true, "B: ...without disturbing the paused run underneath");
  assert(A.setItemCalls() === 0, "B: merely OPENING the screen writes nothing to storage");

  // The cursor also freely passes THROUGH Save on the way to a live row (never trapped there) — as
  // true of a live row as it was of a dim one, and the reason the row's position could stay put.
  A.atPauseRoot("Continue");
  A.menuInput("down"); A.menuInput("down");
  assert(A.rootItems()[g.menu.index] === "Options", "B: down x2 from Continue reaches Options, having passed through Save");

  // Render: no root row is forced dim any more — Save follows the plain selected/idle convention.
  A.atPauseRoot("Save");
  let log = A.render(A.drawRootMenu);
  let entry = log.find(e => e.c === "fillText" && e.str.endsWith("Save"));
  assert(!!entry, "B: Save row rendered a fillText");
  assert(entry.str === "▶ Save", "B: ...with the focused \"▶ \" prefix");
  assert(entry.color === A.COLOR.text, `B: ...focused Save draws COLOR.text (got ${entry && entry.color})`);

  A.atPauseRoot("Continue");
  log = A.render(A.drawRootMenu);
  entry = log.find(e => e.c === "fillText" && e.str.endsWith("Save"));
  assert(!!entry, "B: Save row rendered a fillText while unfocused");
  assert(entry.str === "   Save", "B: ...with the unfocused blank prefix");
  assert(entry.color === A.COLOR.menuIdle, `B: ...unfocused Save draws COLOR.menuIdle (got ${entry && entry.color})`);
})();

// ================= (C) drawRootMenu: derived height fits every row, both root layouts =====================
(function sectionC() {
  console.log("(C) derived panel height fits all rows + the hint — 4-row pause root AND 3-row gameover root");
  const A = build();
  const g = A.game;

  const check = (name, log, N) => {
    const box = log.find(e => e.c === "strokeRect");
    assert(!!box, `C: [${name}] drawRootMenu stroked a menuPanel box`);
    if (!box) return;
    for (let i = 0; i < N; i++) {
      const rowY = box.y + 118 + i * 46;
      assert(rowY > box.y && rowY < box.y + box.h,
        `C: [${name}] row ${i} baseline (${rowY}) falls inside the panel [${box.y}, ${box.y + box.h}]`);
    }
    const hint = log.find(e => e.c === "fillText" && e.str === A.ROOT_MENU_HINT);
    assert(!!hint, `C: [${name}] found the ROOT_MENU_HINT footer`);
    if (hint) assert(hint.y > box.y && hint.y < box.y + box.h,
      `C: [${name}] hint baseline (${hint.y}) falls inside the panel [${box.y}, ${box.y + box.h}]`);
    // Every row + the hint must have room below it before the panel's bottom edge (no clipped text).
    assert(box.h >= 118 + (N - 1) * 46 + 62, `C: [${name}] panel height (${box.h}) covers all ${N} rows + hint offset`);
  };

  A.atPauseRoot();
  const log4 = A.render(A.drawRootMenu);
  check("pause root (4 rows)", log4, A.MENU_ROOT_PLAY.length);
  assert(A.MENU_ROOT_PLAY.length === 4, "C: (sanity) pause root really is 4 rows");

  A.startGame(); g.state = "gameover"; g.paused = false; g.menu.screen = null; A.openPause();
  const log3 = A.render(A.drawRootMenu);
  check("gameover root (3 rows)", log3, A.MENU_ROOT_OVER.length);
  assert(A.MENU_ROOT_OVER.length === 3, "C: (sanity) gameover root really is 3 rows");

  // The two panels are DIFFERENT heights (the derivation actually varies with row count, not a
  // coincidental fixed 300 that happens to also fit 4).
  const box4 = log4.find(e => e.c === "strokeRect");
  const box3 = log3.find(e => e.c === "strokeRect");
  assert(box4.h > box3.h, `C: the 4-row panel (${box4.h}) is taller than the 3-row panel (${box3.h})`);
  assert(box3.h === 300, `C: the 3-row (unchanged) panel height reproduces the old fixed 300 exactly (got ${box3.h})`);
})();

// ================= (D) locked Difficulty: left/right is a byte-identical no-op =====================
(function sectionD() {
  console.log("(D) game.state \"playing\": left/right on every value row changes nothing, persists nothing");
  const A = build();
  const g = A.game;

  // CS017 P6: "chainguard" joins the locked set — the lock keys on `row !== "back"`, so it inherited the
  // behaviour automatically, and this loop is what proves that rather than assuming it.
  // REPOINTED BY CS024 P6 (spec §3.7): "shot"/"magnet"/"chainguard" are DELETED with timed expiry, so
  // "autoshield" is the only value row left. The loop is DERIVED from DIFFICULTY_ROWS rather than
  // relisted, which is what keeps this claim about "every value row" instead of about a fixed list —
  // and the mid-run lock's own rule (`row !== "back"`) is unchanged and still what is under test.
  for (const row of A.DIFFICULTY_ROWS.filter(r => r !== "back")) {
    A.atDifficultyLocked();
    assert(g.state === "playing", `D: (precondition) [${row}] game.state is "playing"`);
    g.menu.index = A.DIFFICULTY_ROWS.indexOf(row);
    const before = { auto: A.settings.autoShield };
    const callsBefore = A.setItemCalls();
    A.menuInput("left");
    A.menuInput("right");
    A.menuInput("left");
    assert(A.settings.autoShield === before.auto, `D: [${row}] autoShield byte-identical after left/right/left`);
    assert(A.setItemCalls() === callsBefore, `D: [${row}] no saveSettings/localStorage write occurred while locked`);
    assert(g.menu.index === A.DIFFICULTY_ROWS.indexOf(row), `D: [${row}] left/right did not even move the cursor`);
  }
})();

// ================= (E) unlocked Difficulty: gameover AND title both allow real changes =====================
(function sectionE() {
  console.log("(E) game.state \"gameover\"/\"title\": left/right DOES change settings and DOES persist");
  for (const from of ["gameover", "title"]) {
    const A = build();
    const g = A.game;
    A.atDifficultyUnlocked(from);
    assert(g.state === from, `E: [${from}] (precondition) game.state is "${from}"`);
    // REPOINTED BY CS024 P6: the shot/magnet/chainguard rows are gone with timed expiry. Auto-shield —
    // which was already here — carries the whole claim now, in BOTH directions and with the persisted
    // blob re-read each time, so "unlocked really does write" stays as strong as it was with four rows.
    g.menu.index = A.DIFFICULTY_ROWS.indexOf("autoshield");
    A.settings.autoShield = false;
    A.menuInput("right");
    assert(A.settings.autoShield === true, `E: [${from}] right on the auto-shield row DID turn it on`);
    assert(!!A.store[A.STORAGE_KEY], `E: [${from}] the toggle persisted a settings write`);
    assert(JSON.parse(A.store[A.STORAGE_KEY]).autoShield === true, `E: [${from}] ...and the persisted value is the new one`);
    A.menuInput("left");
    assert(A.settings.autoShield === false, `E: [${from}] left on the auto-shield row DID turn it back off`);
    assert(JSON.parse(A.store[A.STORAGE_KEY]).autoShield === false, `E: [${from}] ...and that persisted too`);

    // ...and the three deleted rows are genuinely gone from the row model, not merely unreachable.
    for (const dead of ["shot", "magnet", "chainguard"])
      assert(A.DIFFICULTY_ROWS.indexOf(dead) === -1, `E: [${from}] the "${dead}" row is DELETED from DIFFICULTY_ROWS (CS024 P6)`);
  }
})();

// ================= (F) the Back row is live in both states =====================
(function sectionF() {
  console.log("(F) Back navigates normally whether Difficulty is locked or not");
  const A = build();
  const g = A.game;

  A.atDifficultyLocked();
  g.menu.index = A.DIFFICULTY_ROWS.indexOf("back");
  A.menuInput("confirm");
  assert(g.menu.screen === "options" && A.MENU_OPTIONS[g.menu.index] === "Difficulty",
    "F: [locked] confirm on Back -> Options, cursor on Difficulty");

  const B = build();
  B.atDifficultyUnlocked("gameover");
  B.game.menu.index = B.DIFFICULTY_ROWS.indexOf("back");
  B.menuInput("back");
  assert(B.game.menu.screen === "options" && B.MENU_OPTIONS[B.game.menu.index] === "Difficulty",
    "F: [unlocked] the `back` action on Back -> Options, cursor on Difficulty");
})();

// ================= (G) render: locked rows dim, unlocked rows contrast; help line swap =====================
(function sectionG() {
  console.log("(G) locked value rows render COLOR.dim; unlocked rows keep selected/unselected contrast; help line swaps");
  const A = build();
  const g = A.game;
  const cx = A.VIEW_W / 2;
  const at = (log, x, y) => log.filter(e => e.c === "fillText" && e.x === x && e.y === y);

  // ---- LOCKED ----
  A.atDifficultyLocked();
  const y0 = (A.VIEW_H - DIFFICULTY_PANEL_H) / 2;
  const HELP_TEXT = helpText(A);
  for (let i = 0; i < DIFFICULTY_VALUE_ROWS; i++) {
    g.menu.index = i;
    const log = A.render(A.drawDifficulty);
    const cy = y0 + 122 + i * 58 + 6;
    // Every fillText on this row's baseline (label + left/right toggle text) is COLOR.dim — including
    // the focused row (locked rows never brighten to COLOR.text just because the cursor is on them).
    const rowEntries = log.filter(e => e.c === "fillText" && e.y === cy);
    assert(rowEntries.length > 0, `G: [locked] row ${i} drew at least one fillText`);
    for (const e of rowEntries) {
      if (e.str === "|") continue; // the "|" glyph is always COLOR.dim regardless of lock — not the property under test
      assert(e.color === A.COLOR.dim, `G: [locked] row ${i} entry "${e.str}" draws COLOR.dim (got ${e.color})`);
    }
    // The focused row's ◄► chevrons dim too (locked, so nothing about them should read as "live").
    const chevrons = log.filter(e => e.c === "fillText" && e.y === cy + 1 && (e.str === "◄" || e.str === "►"));
    assert(chevrons.length === 2, `G: [locked] row ${i} (focused) drew both ◄► chevrons`);
    assert(chevrons.every(e => e.color === A.COLOR.dim), `G: [locked] row ${i}'s chevrons draw COLOR.dim, not COLOR.text`);
    const help = at(log, cx, y0 + DIFFICULTY_HELP_DY)[0];
    assert(!!help && help.str === A.DIFFICULTY_LOCK_HELP,
      `G: [locked] row ${i}'s help line is DIFFICULTY_LOCK_HELP, not the per-row tip (got ${help && help.str})`);
    assert(!HELP_TEXT.includes(help && help.str), `G: [locked] the normal per-row HELP text is NOT shown`);
  }

  // ---- UNLOCKED ----
  const B = build();
  B.atDifficultyUnlocked("gameover");
  const HELP_TEXT_B = helpText(B);
  for (let i = 0; i < DIFFICULTY_VALUE_ROWS; i++) {
    B.game.menu.index = i;
    const log = B.render(B.drawDifficulty);
    const cy = y0 + 122 + i * 58 + 6;
    const rowEntries = log.filter(e => e.c === "fillText" && e.y === cy);
    assert(rowEntries.length > 0, `G: [unlocked] row ${i} drew at least one fillText`);
    // The FOCUSED row's label reads COLOR.text; any other reads COLOR.menuIdle — never COLOR.dim.
    const labelEntry = rowEntries.find(e => e.align === "left" && e.x === (B.VIEW_W - 620) / 2 + 40);
    if (labelEntry) {
      const expect = i === B.game.menu.index ? B.COLOR.text : B.COLOR.menuIdle;
      assert(labelEntry.color === expect, `G: [unlocked] row ${i} label draws the normal focus color, not dim (got ${labelEntry.color})`);
    }
    const help = at(log, cx, y0 + DIFFICULTY_HELP_DY)[0];
    assert(!!help && help.str === HELP_TEXT_B[i], `G: [unlocked] row ${i}'s help line is the normal per-row tip (got ${help && help.str})`);
    assert((help && help.str) !== B.DIFFICULTY_LOCK_HELP, `G: [unlocked] the lock message is NOT shown`);
  }

  // The Back row's own color contrast is unaffected by the lock either way.
  A.atDifficultyLocked(); g.menu.index = A.DIFFICULTY_ROWS.indexOf("back");
  let log = A.render(A.drawDifficulty);
  let backEntry = log.find(e => e.c === "fillText" && e.str.endsWith("Back"));
  assert(!!backEntry && backEntry.color === A.COLOR.text, "G: [locked] focused Back still draws COLOR.text");
})();

// ================= (H) AudioSys.ctx null smoke =====================
(function sectionH() {
  console.log("(H) AudioSys.ctx null across the full Save + Difficulty-lock cycle");
  const A = build({ audio: false });
  assert(A.AudioSys.ctx === null, "H: sanity — no AudioContext stub means AudioSys.ctx is null");
  let threw = null;
  try {
    A.startGame();
    for (let i = 0; i < 30; i++) A.update(1 / 60);
    // Save row: focus it, confirm it, draw it.
    A.openPause();
    A.game.menu.index = A.rootItems().indexOf("Save");
    A.draw();
    A.menuInput("confirm");
    A.draw();
    // CS032 P4: that confirm now LANDS somewhere (the slots screen), so back out of it before the
    // Difficulty sweep below — without this the rest of the section would drive menuSlots by accident
    // and quietly stop smoking what it was written to smoke.
    A.menuInput("back");
    A.draw();
    // Difficulty, locked: nav every row, try left/right, draw each time.
    A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
    A.game.menu.index = A.MENU_OPTIONS.indexOf("Difficulty"); A.menuInput("confirm");
    for (let i = 0; i < 5; i++) {
      A.game.menu.index = i;
      A.menuInput("left"); A.menuInput("right");
      A.draw();
    }
    A.menuInput("back"); A.draw();
    A.closePause();
    // Difficulty, unlocked (gameover): same sweep.
    A.game.state = "gameover"; A.game.paused = false; A.game.menu.screen = null;
    A.openPause();
    A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
    A.game.menu.index = A.MENU_OPTIONS.indexOf("Difficulty"); A.menuInput("confirm");
    for (let i = 0; i < 5; i++) {
      A.game.menu.index = i;
      A.menuInput("left"); A.menuInput("right");
      A.draw();
    }
    A.update(1 / 60); A.draw();
  } catch (e) { threw = e; }
  assert(!threw, "H: no throw across the full Save/Difficulty-lock cycle with AudioSys.ctx null" + (threw ? ": " + threw.stack : ""));
})();

console.log(`\ntest-cs016-p4: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
