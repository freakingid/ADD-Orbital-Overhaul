// Headless test for CS013 Phase 3 (Group B, §2.3) — the Achievements viewer: ×1.5 text size,
// COLOR.menuIdle contrast (description + locked/incomplete progress), and the new clipped continuous
// vertical scroll (game.menu.scroll, driven by up/down through menuAchievements()).
//
//   node scratchpad/test-cs013-p3.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL drawAchievements()/drawAchRow()/menuAchievements()/gotoScreen()
// via a recording 2D-context stub that logs fillText (text/x/y/font-size/color/align) AND
// save/beginPath/rect/clip/restore in call order — mirrors test-cs012-p2.js/test-cs013-p2.js's
// canvas-recording idiom. No menu-render or achievement-logic is reimplemented here; resetAch() below
// only clears TEST state (mirrors test-f9.js's own resetAch(), it isn't game logic).
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) Sizes: every achievement fillText size == the pre-P3 size * ACH_SCALE; row-to-row step == 60;
//      the description sits at ry+22 under its name (checked across weekly + both lifetime columns).
//  (C) Contrast: description and locked/incomplete progress read COLOR.menuIdle (tiered AND
//      non-tiered rows); an unlocked non-tiered row's name/readout read COLOR.ach; tier tints on a
//      tiered row's name/status are unaffected by this phase.
//  (D) Clip bracket: a save -> beginPath -> rect -> clip -> ...75 row fillTexts... -> restore
//      sequence appears in the log, in that order; the panel title, subtitle, column headers, and
//      footer draw OUTSIDE that bracket (before save or after restore).
//  (E) Scroll: with the real (full 20-entry) LIFETIME, achMaxScroll() > 0; menuAchievements("down")
//      increases game.menu.scroll and clamps at maxScroll; "up" decreases and clamps at 0; the ▲/▼
//      cue fillTexts are logged only while there's room to scroll that direction; forcing a short
//      LIFETIME (2 entries — weekly's 5 rows still dominate) drives maxScroll to 0 and the cue
//      disappears entirely. gotoScreen("achievements", ...) resets scroll to 0 on every entry.
//  (F) headless: AudioSys.ctx null -> startGame()/update(1/60) + an open/scroll/close cycle never throws.

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
  const tmp = path.join(repoRoot, "scratchpad", "_cs013p3_extracted.js");
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

// ---- Recording 2D context — logs fillText (with the live fillStyle/font/textAlign) AND
// save/beginPath/rect/clip/restore, all into ONE ordered array so clip-bracket order can be asserted
// off the log. Every other method (arc/stroke/moveTo/...) is a safe no-op. ----
let recLog = [];
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null, shadowBlur: 0 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText")   return (str, x, y) => recLog.push({ c: "fillText", str, x, y, font: t.font, color: t.fillStyle, align: t.textAlign });
      if (p === "save")       return () => recLog.push({ c: "save" });
      if (p === "restore")    return () => recLog.push({ c: "restore" });
      if (p === "beginPath")  return () => recLog.push({ c: "beginPath" });
      if (p === "rect")       return (x, y, w, h) => recLog.push({ c: "rect", x, y, w, h });
      if (p === "clip")       return () => recLog.push({ c: "clip" });
      if (p === "fillRect")   return (x, y, w, h) => recLog.push({ c: "fillRect", x, y, w, h, color: t.fillStyle });
      if (p === "strokeRect") return (x, y, w, h) => recLog.push({ c: "strokeRect", x, y, w, h, color: t.strokeStyle });
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
  "startGame", "update", "game", "gotoScreen", "menuAchievements", "achMaxScroll",
  "Achievements", "COLOR", "TIER_COLOR", "ACH_SCALE", "ACH_SCROLL_STEP", "ACH_STATUS_DY", "ACH_DESC_DY",
  "ACH_ROW_STEP", "MENU_HINT_SIZE", "MENU_OPTIONS", "drawAchievements", "drawAchRow", "AudioSys", "VIEW_W", "VIEW_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  startGame, update, game, gotoScreen, menuAchievements, achMaxScroll,
  Achievements, COLOR, TIER_COLOR, ACH_SCALE, ACH_SCROLL_STEP, ACH_STATUS_DY, ACH_DESC_DY,
  ACH_ROW_STEP, MENU_HINT_SIZE, MENU_OPTIONS, drawAchievements, drawAchRow, AudioSys, VIEW_W, VIEW_H
} = A;

AudioSys.init();
startGame();

// Mirrors test-f9.js's own resetAch() — test scaffolding only, not a reimplementation of any
// achievement-unlock LOGIC (which stays exercised through the real Achievements.evaluate() elsewhere).
// Unlike f9's version (which activates all 16 weekly ids for gameplay-trigger coverage), this keeps
// activeIds at the real 5-wide shape a live game always has — this file is testing RENDER geometry,
// where a bloated weekly column would throw off the "5 weekly rows" shape the real viewer always has.
function resetAch() {
  for (const k in Achievements.lifetime) Achievements.lifetime[k] = 0;
  Achievements.lifetimeUnlocked = new Set();
  Achievements.weeklyUnlocked = new Set();
  Achievements.lifetimeTiers = {};
  Achievements.activeIds = Achievements.WEEKLY.slice(0, 5).map(a => a.id);
  Achievements._saveAccum = 1e9;
  game.toasts = [];
}

function render(fn) { recLog = []; fn(); return recLog; }
const at = (log, x, y) => log.filter(e => e.c === "fillText" && e.x === x && e.y === y);
const fontSize = e => parseFloat(e.font);
const cx = VIEW_W / 2;

// Panel geometry (mirrors menuPanel(1200,660) + drawAchievements' own constants) — derived here, not
// re-imported, so a geometry regression in the real code shows up as a position mismatch below.
const px = (VIEW_W - 1200) / 2, py = (VIEW_H - 660) / 2;
const xL = px + 30, xM = px + 430, xR = px + 820;
const ry0 = py + 130, step = ACH_ROW_STEP; // CS015 P2: was a bare 40*ACH_SCALE pre-P2; now the real (bumped) row step

// ================= (B) sizes + step + description offset =================
// CS015 P2 note: name/status no longer share row i's baseline — status moved to ry+ACH_STATUS_DY and
// desc to ry+ACH_DESC_DY (was a bare ry+22), and the row step itself grew to fit the extra line. The
// dedicated geometry regression test for that phase is scratchpad/test-cs015-p2.js; this section keeps
// verifying sizes/positions still track the real (now CS015-P2) symbols, not a re-pin of old numbers.
(function sectionB() {
  console.log("(B) sizes == pre-P3 * ACH_SCALE; step == ACH_ROW_STEP; description at ry+ACH_DESC_DY");
  assert(ACH_SCALE === 1.5, "B: ACH_SCALE is 1.5 (got " + ACH_SCALE + ")");
  assert(step === ACH_ROW_STEP, "B: row step is the real ACH_ROW_STEP (got " + step + ")");
  game.state = "playing";
  resetAch();
  gotoScreen("achievements", 0);
  const log = render(drawAchievements);

  // Column headers: size 15*ACH_SCALE, unchanged position/color.
  [["THIS WEEK", xL], ["LIFETIME", xM], ["LIFETIME (cont.)", xR]].forEach(([text, x]) => {
    const e = at(log, x, py + 108).find(e => e.str === text);
    assert(!!e, `B: header "${text}" logs a fillText at its expected position`);
    assert(fontSize(e) === 15 * ACH_SCALE, `B: header "${text}" size == 15*ACH_SCALE (got ${e && fontSize(e)})`);
  });
  // Subtitle: size 12*ACH_SCALE.
  const sub = log.find(e => e.c === "fillText" && /^WEEKLY SET/.test(e.str));
  assert(!!sub && sub.x === cx && sub.y === py + 74, "B: subtitle logs at (cx, py+74)");
  assert(fontSize(sub) === 12 * ACH_SCALE, `B: subtitle size == 12*ACH_SCALE (got ${sub && fontSize(sub)})`);

  // Weekly rows (5, unscrolled -> scroll is 0 right after gotoScreen): name/readout/desc sizes + offsets.
  const weekly = Achievements.activeWeekly();
  weekly.forEach((ach, i) => {
    const ry = ry0 + i * step;
    const name = at(log, xL, ry).find(e => e.str === ach.name);
    assert(!!name, `B: weekly row ${i} ("${ach.name}") name at its expected (x, ry)`);
    assert(fontSize(name) === 15 * ACH_SCALE, `B: weekly row ${i} name size == 15*ACH_SCALE`);
    const desc = at(log, xL, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
    assert(!!desc, `B: weekly row ${i} description at ry+ACH_DESC_DY`);
    assert(fontSize(desc) === 10 * ACH_SCALE, `B: weekly row ${i} description size == 10*ACH_SCALE`);
    const readout = at(log, xL + 350, ry + ACH_STATUS_DY);
    assert(readout.length === 1, `B: weekly row ${i} has exactly one readout fillText at ry+ACH_STATUS_DY`);
    assert(fontSize(readout[0]) === 14 * ACH_SCALE, `B: weekly row ${i} readout size == 14*ACH_SCALE`);
  });

  // Lifetime rows (20, split half/half across mid+right columns): step spacing across the FULL column.
  const half = Math.ceil(Achievements.LIFETIME.length / 2);
  Achievements.LIFETIME.forEach((ach, i) => {
    const col = i < half ? xM : xR, row = i < half ? i : i - half;
    const ry = ry0 + row * step;
    const name = at(log, col, ry).find(e => e.str === ach.name);
    assert(!!name, `B: lifetime row ${i} ("${ach.name}") name at its expected (x, ry)`);
    assert(fontSize(name) === 15 * ACH_SCALE, `B: lifetime row ${i} name size == 15*ACH_SCALE`);
    const statusSize = ach.tiers ? 13 * ACH_SCALE : 14 * ACH_SCALE;
    const readout = at(log, col + 350, ry + ACH_STATUS_DY);
    assert(readout.length === 1, `B: lifetime row ${i} has exactly one status/readout fillText at ry+ACH_STATUS_DY`);
    assert(fontSize(readout[0]) === statusSize, `B: lifetime row ${i} status/readout size == ${statusSize}`);
    const desc = at(log, col, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
    assert(!!desc, `B: lifetime row ${i} description at ry+ACH_DESC_DY`);
    assert(fontSize(desc) === 10 * ACH_SCALE, `B: lifetime row ${i} description size == 10*ACH_SCALE`);
  });

  // Footer: routed through drawMenuHint -> MENU_HINT_SIZE / COLOR.menuIdle, at the unchanged y.
  const footer = log.find(e => e.c === "fillText" && /return to Options/.test(e.str));
  assert(!!footer && footer.x === cx && footer.y === py + 644, "B: footer logs at (cx, py+644)");
  assert(fontSize(footer) === MENU_HINT_SIZE, "B: footer size == MENU_HINT_SIZE (drawMenuHint)");
})();

// ================= (C) contrast =================
(function sectionC() {
  console.log("(C) description + locked/incomplete progress -> menuIdle; unlocked -> ach; tier tints unaffected");
  game.state = "playing";
  resetAch();
  // Unlock exactly one weekly (non-tiered) achievement so the "done" branch is exercised.
  const unlockedWeeklyId = Achievements.activeWeekly()[0].id;
  Achievements.weeklyUnlocked.add(unlockedWeeklyId);
  // Put one tiered lifetime achievement mid-ladder (tier 1) and leave the rest pre-bronze.
  const tieredAch = Achievements.LIFETIME.find(a => a.tiers);
  Achievements.lifetimeTiers[tieredAch.id] = 1;

  gotoScreen("achievements", 0);
  const log = render(drawAchievements);

  Achievements.activeWeekly().forEach((ach, i) => {
    const ry = ry0 + i * step;
    const done = ach.id === unlockedWeeklyId;
    const name = at(log, xL, ry).find(e => e.str === ach.name);
    assert(name.color === (done ? COLOR.ach : COLOR.text), `C: weekly "${ach.name}" name color matches unlocked state`);
    const readout = at(log, xL + 350, ry + ACH_STATUS_DY)[0];
    assert(readout.color === (done ? COLOR.ach : COLOR.menuIdle), `C: weekly "${ach.name}" readout is ach-when-done / menuIdle-when-locked`);
    const desc = at(log, xL, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
    assert(desc.color === COLOR.menuIdle, `C: weekly "${ach.name}" description always reads menuIdle`);
  });

  const half = Math.ceil(Achievements.LIFETIME.length / 2);
  Achievements.LIFETIME.forEach((ach, i) => {
    const col = i < half ? xM : xR, row = i < half ? i : i - half;
    const ry = ry0 + row * step;
    const desc = at(log, col, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
    assert(desc.color === COLOR.menuIdle, `C: lifetime "${ach.name}" description always reads menuIdle`);
    if (ach.tiers) {
      const idx = Achievements.tierIndex(ach);
      const expectCol = idx >= 0 ? TIER_COLOR[idx] : COLOR.text;
      const name = at(log, col, ry).find(e => e.str === ach.name);
      assert(name.color === expectCol, `C: tiered "${ach.name}" name reads its tier tint (or COLOR.text pre-bronze) — unaffected by P3`);
      const status = at(log, col + 350, ry + ACH_STATUS_DY)[0];
      const expectStatusCol = idx >= 0 ? expectCol : COLOR.menuIdle;
      assert(status.color === expectStatusCol, `C: tiered "${ach.name}" status is tier-tinted once >=bronze, else menuIdle`);
    } else {
      const done = Achievements.isUnlocked(ach);
      const name = at(log, col, ry).find(e => e.str === ach.name);
      assert(name.color === (done ? COLOR.ach : COLOR.text), `C: non-tiered "${ach.name}" name color matches unlocked state`);
      const readout = at(log, col + 350, ry + ACH_STATUS_DY)[0];
      assert(readout.color === (done ? COLOR.ach : COLOR.menuIdle), `C: non-tiered "${ach.name}" readout is ach-when-done / menuIdle-when-locked`);
    }
  });
})();

// ================= (D) clip bracket =================
(function sectionD() {
  console.log("(D) save->beginPath->rect->clip->...75 row fillTexts...->restore; chrome draws outside it");
  game.state = "playing";
  resetAch();
  gotoScreen("achievements", 0);
  const log = render(drawAchievements);

  const idx = c => log.findIndex(e => e.c === c);
  const saveIdx = idx("save"), beginIdx = idx("beginPath"), rectIdx = idx("rect"), clipIdx = idx("clip"), restoreIdx = idx("restore");
  assert([saveIdx, beginIdx, rectIdx, clipIdx, restoreIdx].every(i => i >= 0), "D: save/beginPath/rect/clip/restore all appear in the log");
  assert(saveIdx < beginIdx && beginIdx < rectIdx && rectIdx < clipIdx && clipIdx < restoreIdx, "D: they appear in save->beginPath->rect->clip->restore order");

  const rowFillTexts = log.slice(clipIdx + 1, restoreIdx).filter(e => e.c === "fillText");
  const expectedRows = Achievements.activeWeekly().length + Achievements.LIFETIME.length; // 5 + 20
  assert(rowFillTexts.length === expectedRows * 3, `D: exactly ${expectedRows * 3} row fillTexts (name+status+desc x ${expectedRows}) inside the clip (got ${rowFillTexts.length})`);

  const outsideStrings = ["ACHIEVEMENTS", "THIS WEEK", "LIFETIME", "LIFETIME (cont.)"];
  const titleEntry = log.find(e => e.c === "fillText" && e.str === "ACHIEVEMENTS");
  const headerEntries = log.filter(e => e.c === "fillText" && ["THIS WEEK", "LIFETIME", "LIFETIME (cont.)"].includes(e.str));
  const subtitleEntry = log.find(e => e.c === "fillText" && /^WEEKLY SET/.test(e.str));
  const footerEntry = log.find(e => e.c === "fillText" && /return to Options/.test(e.str));
  [titleEntry, subtitleEntry, footerEntry, ...headerEntries].forEach(e => {
    const i = log.indexOf(e);
    assert(i < saveIdx || i > restoreIdx, `D: chrome fillText "${e.str}" draws outside the save/restore bracket`);
  });
  assert(log.indexOf(titleEntry) < saveIdx, "D: the panel title draws before the clip (via menuPanel, unchanged)");
  assert(log.indexOf(footerEntry) > restoreIdx, "D: the footer draws after restore (unscrolled chrome)");
})();

// ================= (E) scroll =================
(function sectionE() {
  console.log("(E) achMaxScroll() > 0 for the full LIFETIME; up/down clamp; the ▲/▼ cue tracks maxScroll; gotoScreen resets scroll");
  game.state = "playing";
  resetAch();

  gotoScreen("achievements", 0);
  const maxScroll = achMaxScroll();
  assert(maxScroll > 0, `E: achMaxScroll() > 0 with the real 20-entry LIFETIME (got ${maxScroll})`);
  assert(game.menu.scroll === 0, "E: gotoScreen(\"achievements\") starts unscrolled");

  // down increases, clamped at maxScroll.
  menuAchievements("down");
  assert(game.menu.scroll === Math.min(maxScroll, ACH_SCROLL_STEP), `E: one "down" advances scroll by ACH_SCROLL_STEP, clamped (got ${game.menu.scroll})`);
  for (let i = 0; i < 20; i++) menuAchievements("down"); // hammer past the ceiling
  assert(game.menu.scroll === maxScroll, `E: repeated "down" clamps at maxScroll (got ${game.menu.scroll}, max ${maxScroll})`);
  let log = render(drawAchievements);
  let up = log.find(e => e.c === "fillText" && e.str === "▲");
  let down = log.find(e => e.c === "fillText" && e.str === "▼");
  assert(!!up, "E: at max scroll, the ▲ cue is shown (there's content above)");
  assert(!down, "E: at max scroll, the ▼ cue is hidden (nothing further below)");
  assert(up.color === COLOR.menuIdle, "E: the ▲ cue reads COLOR.menuIdle");

  // up decreases, clamped at 0.
  for (let i = 0; i < 20; i++) menuAchievements("up"); // hammer past the floor
  assert(game.menu.scroll === 0, `E: repeated "up" clamps at 0 (got ${game.menu.scroll})`);
  log = render(drawAchievements);
  up = log.find(e => e.c === "fillText" && e.str === "▲");
  down = log.find(e => e.c === "fillText" && e.str === "▼");
  assert(!up, "E: at scroll 0, the ▲ cue is hidden (nothing above)");
  assert(!!down, "E: at scroll 0, the ▼ cue is shown (there's content below)");

  // A short LIFETIME (weekly's 5 rows still dominate the row count) drives maxScroll to 0 -> no cue at all.
  const fullLifetime = Achievements.LIFETIME;
  Achievements.LIFETIME = fullLifetime.slice(0, 2);
  gotoScreen("achievements", 0); // re-enter so scroll is freshly 0 against the new (smaller) ceiling
  assert(achMaxScroll() === 0, `E: a short LIFETIME (2 entries) drives achMaxScroll() to 0 (got ${achMaxScroll()})`);
  log = render(drawAchievements);
  assert(!log.find(e => e.c === "fillText" && (e.str === "▲" || e.str === "▼")), "E: with maxScroll 0, neither cue is logged");
  Achievements.LIFETIME = fullLifetime; // restore for any later section

  // gotoScreen resets scroll on every entry, not just the first.
  gotoScreen("achievements", 0);
  menuAchievements("down"); menuAchievements("down");
  assert(game.menu.scroll > 0, "E: scroll advanced ahead of the reset check");
  gotoScreen("achievements", 0);
  assert(game.menu.scroll === 0, "E: re-entering via gotoScreen resets scroll back to 0");
})();

// ================= (F) headless: AudioSys.ctx null, no-crash open/scroll/close cycle =================
(function sectionF() {
  console.log("(F) AudioSys.ctx null -> startGame()/update(1/60) + open/scroll/close cycle never throws");
  AudioSys.ctx = null;
  noThrow(() => { startGame(); }, "F: startGame() with ctx null");
  noThrow(() => { for (let i = 0; i < 30; i++) update(1 / 60); }, "F: update(1/60) x30 with ctx null");
  game.state = "playing";
  noThrow(() => {
    gotoScreen("achievements", 0);
    render(drawAchievements);
    menuAchievements("down"); menuAchievements("down"); menuAchievements("down");
    render(drawAchievements);
    menuAchievements("up");
    render(drawAchievements);
    menuAchievements("back");
  }, "F: a full open/scroll/close cycle renders without throwing");
  game.state = "gameover";
  noThrow(() => { gotoScreen("achievements", 0); render(drawAchievements); menuAchievements("confirm"); }, "F: the same cycle from gameover never throws");
})();

console.log(`\ntest-cs013-p3: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
