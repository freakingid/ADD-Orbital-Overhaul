// Headless test for CS013 Phase 2 (Group B, §2.1 + §2.2) — the menu readability sweep: a new
// COLOR.menuIdle for unselected menu-item text (brighter than the too-dim COLOR.dim) + a shared
// drawMenuHint(text, cx, y) helper that renders every control-hint footer larger (MENU_HINT_SIZE)
// and in the new color. Covers P1's gameover-root rows too (rootItems()/drawRootMenu are state-aware,
// so exercising drawRootMenu once covers both the playing and gameover layouts).
//
//   node scratchpad/test-cs013-p2.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL draw*() functions via a recording 2D-context stub that logs
// fillText calls with their (x, y, font-size, fillStyle, textAlign) — mirrors test-cs012-p2.js's
// canvas-recording idiom. No menu-render logic is reimplemented here.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) COLOR.menuIdle exists and differs from both COLOR.dim and COLOR.text.
//  (C) drawRootMenu: unselected items -> menuIdle, selected -> text; footer -> MENU_HINT_SIZE/menuIdle.
//  (D) drawOptionsMenu: same contract as (C).
//  (E) drawSound: row labels + volume% readout + value-column readout + Back all swap to menuIdle when
//      unselected (text when selected); the volume slider FRAME (stroke/fill) stays COLOR.dim regardless
//      of selection (not a text-contrast site); footer via drawMenuHint.
//  (F) drawDifficulty: row label + Back swap; the toggle's two inactive-side reads and the "|" glyph
//      stay COLOR.dim (state indicators, not unselected-item text, per FINDING-C); help line + footer
//      both now route through drawMenuHint.
//  (G) drawControlsMenu: ACTION/KEYBOARD/GAMEPAD headers stay COLOR.dim; rebind row label swaps;
//      drawBindCell unselected -> menuIdle, capturing -> COLOR.garbage (unchanged); "Return to
//      Defaults"/"Back" swap; footer via drawMenuHint; drawTurnScaleRow label + % readout swap while
//      its slider frame stays dim.
//  (H) headless: AudioSys.ctx null -> startGame()/update(1/60) plus a render of every menu screen
//      (root, options, sound, difficulty, controls) never throws.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }

// ================= (A) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs013p2_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try {
    execSync(`node --check "${tmp}"`, { stdio: "pipe" });
    passed++;
  } catch (e) {
    failed++;
    console.error("  FAIL: node --check: " + e.stderr.toString());
  } finally {
    fs.unlinkSync(tmp);
  }
})();

// ---- Recording 2D context — logs fillText/fillRect/strokeRect calls with the style state
// (fillStyle/strokeStyle/font/textAlign) active at the moment of each call. Every other method
// (arc/stroke/beginPath/moveTo/...) is a safe no-op — the sliders/chevron ticks call them but this
// phase doesn't need to inspect them. ----
let recLog = [];
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null, shadowBlur: 0 };
  const loggedCalls = { fillText: true, fillRect: true, strokeRect: true };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str, x, y, font: t.font, color: t.fillStyle, align: t.textAlign });
      if (p === "fillRect") return (x, y, w, h) => recLog.push({ c: "fillRect", x, y, w, h, color: t.fillStyle });
      if (p === "strokeRect") return (x, y, w, h) => recLog.push({ c: "strokeRect", x, y, w, h, color: t.strokeStyle });
      // CS015 P1: drawRootMenu now measures its control hint before sizing the panel — a plausible
      // monospace-width stand-in (fontSize * 0.6 * length) so that call doesn't throw on undefined.
      if (p === "measureText") return (str) => ({ width: (parseInt(t.font, 10) || 10) * 0.6 * str.length });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}
const recCtx = makeRecordingCtx();
const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
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
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
const windowStub = {
  addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: FakeAudioContext, webkitAudioContext: FakeAudioContext
};
const performanceStub = { now: () => Date.now() };
const rafStub = () => 0;
const navigatorStub = { getGamepads: () => [] };
const lsStore = {};
const localStorageStub = {
  getItem: k => (k in lsStore ? lsStore[k] : null),
  setItem: (k, v) => { lsStore[k] = String(v); },
  removeItem: k => { delete lsStore[k]; }
};

const RETURN = [
  "startGame", "update", "game", "gotoScreen", "rootItems", "COLOR", "MENU_HINT_SIZE",
  "drawRootMenu", "drawOptionsMenu", "drawSound", "drawDifficulty", "drawControlsMenu",
  "MENU_OPTIONS", "SOUND_ROWS", "VOL_LABELS", "REBINDABLE", "bindings", "AudioSys", "VIEW_W", "VIEW_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  startGame, update, game, gotoScreen, rootItems, COLOR, MENU_HINT_SIZE,
  drawRootMenu, drawOptionsMenu, drawSound, drawDifficulty, drawControlsMenu,
  MENU_OPTIONS, SOUND_ROWS, VOL_LABELS, REBINDABLE, bindings, AudioSys, VIEW_W, VIEW_H
} = A;

AudioSys.init();
startGame();

function render(fn) { recLog = []; fn(); return recLog; }
const at = (log, x, y) => log.filter(e => e.c === "fillText" && e.x === x && e.y === y);
const fontSize = e => parseInt(e.font, 10);
const cx = VIEW_W / 2;

// ================= (B) COLOR.menuIdle exists and is distinct =================
(function sectionB() {
  console.log("(B) COLOR.menuIdle exists and differs from both COLOR.dim and COLOR.text");
  assert(typeof COLOR.menuIdle === "string" && COLOR.menuIdle.length > 0, "B: COLOR.menuIdle is a non-empty color string");
  assert(COLOR.menuIdle !== COLOR.dim, "B: COLOR.menuIdle !== COLOR.dim");
  assert(COLOR.menuIdle !== COLOR.text, "B: COLOR.menuIdle !== COLOR.text");
})();

// ================= (C) drawRootMenu =================
(function sectionC() {
  console.log("(C) drawRootMenu: unselected -> menuIdle, selected -> text; footer -> drawMenuHint");
  game.state = "playing";
  gotoScreen("root", 1); // select "Options" (index 1 of ["Continue","Options","Quit"])
  const items = rootItems();
  const y = (VIEW_H - 300) / 2;
  const log = render(drawRootMenu);
  items.forEach((it, i) => {
    const entries = at(log, cx, y + 118 + i * 46);
    assert(entries.length === 1, `C: exactly one fillText for root item "${it}" (got ${entries.length})`);
    const expect = i === game.menu.index ? COLOR.text : COLOR.menuIdle;
    assert(entries[0].color === expect, `C: root item "${it}" (${i === game.menu.index ? "selected" : "unselected"}) draws in ${i === game.menu.index ? "COLOR.text" : "COLOR.menuIdle"}`);
  });
  const footer = at(log, cx, y + 272);
  assert(footer.length === 1, "C: exactly one footer fillText");
  assert(footer[0].color === COLOR.menuIdle, "C: root footer draws in COLOR.menuIdle");
  assert(fontSize(footer[0]) === MENU_HINT_SIZE, `C: root footer draws at MENU_HINT_SIZE (got ${fontSize(footer[0])})`);
})();

// ================= (D) drawOptionsMenu =================
(function sectionD() {
  console.log("(D) drawOptionsMenu: unselected -> menuIdle, selected -> text; footer -> drawMenuHint");
  game.state = "playing";
  gotoScreen("options", 2); // select "Achievements"
  const y = (VIEW_H - 420) / 2;
  const log = render(drawOptionsMenu);
  MENU_OPTIONS.forEach((label, i) => {
    const entries = at(log, cx, y + 118 + i * 42);
    assert(entries.length === 1, `D: exactly one fillText for options item "${label}"`);
    const expect = i === game.menu.index ? COLOR.text : COLOR.menuIdle;
    assert(entries[0].color === expect, `D: options item "${label}" draws in the expected color`);
  });
  const footer = at(log, cx, y + 400);
  assert(footer.length === 1 && footer[0].color === COLOR.menuIdle, "D: options footer draws in COLOR.menuIdle");
  assert(fontSize(footer[0]) === MENU_HINT_SIZE, "D: options footer draws at MENU_HINT_SIZE");
})();

// ================= (E) drawSound =================
(function sectionE() {
  console.log("(E) drawSound: row labels/readouts swap to menuIdle when unselected; slider frame stays dim; footer via drawMenuHint");
  game.state = "playing";
  gotoScreen("sound", 0); // select "SFX Volume" (a slider row)
  const x0 = (VIEW_W - 600) / 2, y0 = (VIEW_H - 602) / 2;
  let cy0 = y0 + 100;
  const rowY = []; // y for each non-Back SOUND_ROWS row, in order
  SOUND_ROWS.forEach(label => { if (label === "Back") return; rowY.push(cy0 + 6); cy0 += 46; });
  const log = render(drawSound);

  let ri = 0;
  SOUND_ROWS.forEach((label, i) => {
    if (label === "Back") return;
    const y = rowY[ri++];
    const isSel = game.menu.index === i;
    const labelEntries = at(log, x0 + 40, y);
    assert(labelEntries.length === 1, `E: exactly one label fillText for "${label}"`);
    assert(labelEntries[0].color === (isSel ? COLOR.text : COLOR.menuIdle), `E: "${label}" label draws in the expected color (${isSel ? "selected" : "unselected"})`);
    if (VOL_LABELS.includes(label)) {
      const bx = x0 + 270, bw = 190;
      const readout = at(log, bx + bw + 44, y);
      assert(readout.length === 1, `E: exactly one %-readout fillText for "${label}"`);
      assert(readout[0].color === (isSel ? COLOR.text : COLOR.menuIdle), `E: "${label}" %-readout draws in the expected color`);
      // slider frame (strokeRect) is a selection-highlight (shield when selected), never menuIdle —
      // not a text-contrast site, so it must never read COLOR.menuIdle.
      const by = y - 6 - 3;
      const frameStroke = log.find(e => e.c === "strokeRect" && e.x === bx && Math.abs(e.y - by) < 20);
      assert(!!frameStroke && frameStroke.color === (isSel ? COLOR.shield : COLOR.dim), `E: "${label}" slider frame strokeRect is shield-when-selected/dim-otherwise (unchanged), never menuIdle`);
    } else {
      const ox = x0 + 270;
      const val = at(log, ox, y);
      assert(val.length === 1, `E: exactly one value-column fillText for "${label}"`);
      assert(val[0].color === (isSel ? COLOR.text : COLOR.menuIdle), `E: "${label}" value-column draws in the expected color`);
    }
  });
  const backY = cy0 + 14 + 6;
  const backSel = game.menu.index === SOUND_ROWS.indexOf("Back");
  const backEntries = at(log, cx, backY);
  assert(backEntries.length === 1, "E: exactly one Back fillText");
  assert(backEntries[0].color === (backSel ? COLOR.text : COLOR.menuIdle), "E: Back draws in the expected color");
  const footer = at(log, cx, y0 + 582);
  assert(footer.length === 1 && footer[0].color === COLOR.menuIdle, "E: sound footer draws in COLOR.menuIdle");
  assert(fontSize(footer[0]) === MENU_HINT_SIZE, "E: sound footer draws at MENU_HINT_SIZE");
})();

// ================= (F) drawDifficulty =================
(function sectionF() {
  console.log("(F) drawDifficulty: row label + Back swap; toggle inactive-side + \"|\" glyph stay dim; help/footer via drawMenuHint");
  game.state = "playing";
  gotoScreen("difficulty", 1); // select the second toggle row ("Magnet expires")
  const x0 = (VIEW_W - 620) / 2, y0 = (VIEW_H - 418) / 2;
  const log = render(drawDifficulty);

  for (let i = 0; i < 3; i++) {
    const rcy = y0 + 122 + i * 58 + 6;
    const isSel = game.menu.index === i;
    const labelEntries = at(log, x0 + 40, rcy);
    assert(labelEntries.length === 1, `F: exactly one row-label fillText for difficulty row ${i}`);
    assert(labelEntries[0].color === (isSel ? COLOR.text : COLOR.menuIdle), `F: difficulty row ${i} label draws in the expected color`);
    // toggle inactive-side reads + the "|" glyph are state indicators, not selection contrast — must stay dim
    const ox = x0 + 360;
    const leftEntries = at(log, ox, rcy);
    const rightEntries = at(log, ox + 92, rcy);
    const barEntries = at(log, ox + 74, rcy);
    assert(leftEntries.length === 1 && [COLOR.dim, COLOR.text].includes(leftEntries[0].color), `F: row ${i} toggle left-side is dim or text (state, not menuIdle)`);
    assert(rightEntries.length === 1 && [COLOR.dim, COLOR.text].includes(rightEntries[0].color), `F: row ${i} toggle right-side is dim or text (state, not menuIdle)`);
    assert(barEntries.length === 1 && barEntries[0].color === COLOR.dim, `F: row ${i} toggle "|" glyph stays COLOR.dim`);
    assert(leftEntries[0].color !== COLOR.menuIdle && rightEntries[0].color !== COLOR.menuIdle, `F: row ${i} toggle sides never read menuIdle`);
  }
  const backSel = game.menu.index === 3;
  const backEntries = at(log, cx, y0 + 320);
  assert(backEntries.length === 1 && backEntries[0].color === (backSel ? COLOR.text : COLOR.menuIdle), "F: Back draws in the expected color");
  const help = at(log, cx, y0 + 364);
  assert(help.length === 1 && help[0].color === COLOR.menuIdle, "F: the per-row help line now routes through drawMenuHint (COLOR.menuIdle)");
  assert(fontSize(help[0]) === MENU_HINT_SIZE, "F: the help line draws at MENU_HINT_SIZE");
  const footer = at(log, cx, y0 + 394);
  assert(footer.length === 1 && footer[0].color === COLOR.menuIdle, "F: difficulty footer draws in COLOR.menuIdle");
  assert(fontSize(footer[0]) === MENU_HINT_SIZE, "F: difficulty footer draws at MENU_HINT_SIZE");
})();

// ================= (G) drawControlsMenu =================
(function sectionG() {
  console.log("(G) drawControlsMenu: headers stay dim; rebind label swaps; bind-cell menuIdle/garbage; Defaults/Back swap; turn-scale row swaps; footer via drawMenuHint");
  game.state = "playing";
  gotoScreen("controls", 0);
  game.menu.row = 0; game.menu.col = 0;
  game.menu.rebinding = { action: REBINDABLE[0], device: "key" }; // capture in progress on row0's KEY cell
  const x0 = (VIEW_W - 760) / 2, y0 = (VIEW_H - 512) / 2;
  const log = render(drawControlsMenu);

  ["ACTION", "KEYBOARD", "GAMEPAD"].forEach((h, i) => {
    const xs = [x0 + 36, x0 + 250, x0 + 490];
    const entries = at(log, xs[i], y0 + 88);
    assert(entries.length === 1 && entries[0].color === COLOR.dim, `G: column header "${h}" stays COLOR.dim`);
  });

  REBINDABLE.forEach((name, r) => {
    const ry = y0 + 122 + r * 42;
    const rowSel = game.menu.row === r;
    const labelEntries = at(log, x0 + 36, ry);
    assert(labelEntries.length === 1, `G: exactly one rebind-row label fillText for "${name}"`);
    assert(labelEntries[0].color === (rowSel ? COLOR.text : COLOR.menuIdle), `G: rebind row "${name}" label draws in the expected color`);

    const keyCell = at(log, x0 + 250, ry);
    const padCell = at(log, x0 + 490, ry);
    assert(keyCell.length === 1, `G: exactly one KEY bind-cell fillText for "${name}"`);
    assert(padCell.length === 1, `G: exactly one PAD bind-cell fillText for "${name}"`);
    if (r === 0) {
      assert(keyCell[0].color === COLOR.garbage, "G: the KEY cell under active capture draws COLOR.garbage (unchanged)");
    } else {
      assert(keyCell[0].color === COLOR.menuIdle, `G: an unselected KEY cell ("${name}") draws COLOR.menuIdle`);
    }
    assert(padCell[0].color === COLOR.menuIdle, `G: an unselected PAD cell ("${name}") draws COLOR.menuIdle`);
  });

  const turnRow = REBINDABLE.length;
  const turnY = y0 + 122 + turnRow * 42;
  const turnSel = game.menu.row === turnRow;
  const turnLabel = at(log, x0 + 36, turnY);
  assert(turnLabel.length === 1 && turnLabel[0].color === (turnSel ? COLOR.text : COLOR.menuIdle), "G: Ship Rotation label draws in the expected color");
  const bx = x0 + 250, bw = 200;
  const turnReadout = at(log, bx + bw + 30, turnY);
  assert(turnReadout.length === 1, "G: exactly one Ship Rotation %-readout fillText");
  assert([COLOR.ach, turnSel ? COLOR.text : COLOR.menuIdle].includes(turnReadout[0].color), "G: Ship Rotation readout is gold-at-default or the expected selection color");
  const sliderFrame = log.find(e => e.c === "strokeRect" && e.x === bx);
  assert(!!sliderFrame && sliderFrame.color === COLOR.dim, "G: Ship Rotation slider frame stays COLOR.dim");

  const dRow = REBINDABLE.length + 1, bRow = dRow + 1;
  const defY = y0 + 122 + dRow * 42 + 26, backY = y0 + 122 + bRow * 42 + 26;
  const defEntries = at(log, cx, defY), backEntries = at(log, cx, backY);
  assert(defEntries.length === 1 && defEntries[0].color === (game.menu.row === dRow ? COLOR.text : COLOR.menuIdle), "G: Return to Defaults draws in the expected color");
  assert(backEntries.length === 1 && backEntries[0].color === (game.menu.row === bRow ? COLOR.text : COLOR.menuIdle), "G: Back draws in the expected color");

  const footer = at(log, cx, y0 + 494);
  assert(footer.length === 1 && footer[0].color === COLOR.menuIdle, "G: controls footer draws in COLOR.menuIdle");
  assert(fontSize(footer[0]) === MENU_HINT_SIZE, "G: controls footer draws at MENU_HINT_SIZE");

  game.menu.rebinding = null;
})();

// ================= (H) headless: AudioSys.ctx null, no-crash across every menu screen =================
(function sectionH() {
  console.log("(H) AudioSys.ctx null -> startGame()/update(1/60) + every menu screen renders without throwing");
  AudioSys.ctx = null;
  noThrow(() => { startGame(); }, "H: startGame() with ctx null");
  noThrow(() => { for (let i = 0; i < 30; i++) update(1 / 60); }, "H: update(1/60) x30 with ctx null");
  game.state = "playing";
  noThrow(() => { gotoScreen("root", 0); render(drawRootMenu); }, "H: drawRootMenu renders with ctx null");
  noThrow(() => { gotoScreen("options", 0); render(drawOptionsMenu); }, "H: drawOptionsMenu renders with ctx null");
  noThrow(() => { gotoScreen("sound", 0); render(drawSound); }, "H: drawSound renders with ctx null");
  noThrow(() => { gotoScreen("difficulty", 0); render(drawDifficulty); }, "H: drawDifficulty renders with ctx null");
  noThrow(() => { gotoScreen("controls", 0); render(drawControlsMenu); }, "H: drawControlsMenu renders with ctx null");
  game.state = "gameover";
  noThrow(() => { gotoScreen("root", 0); render(drawRootMenu); }, "H: drawRootMenu (gameover root) renders with ctx null");
})();

console.log(`\ntest-cs013-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
