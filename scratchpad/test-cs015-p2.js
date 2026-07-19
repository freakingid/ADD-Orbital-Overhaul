// Headless test for CS015 Phase P2 (item 3) — stop Achievements name/status ("medal") overlap at
// ACH_SCALE 1.5 by stacking each row's name/status/description on three separate lines instead of
// sharing one name-left/status-right baseline.
//
//   node scratchpad/test-cs015-p2.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL drawAchievements()/drawAchRow()/achMaxScroll()/menuAchievements()
// via a recording 2D-context stub (mirrors test-cs013-p3.js's canvas-recording idiom) — no menu-render
// or scroll-clamp logic reimplemented.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) Real per-row geometry, read off actual rendered fillText positions (both drawAchRow branches —
//      tiered and plain): name @ry, status @ry+ACH_STATUS_DY (still right-aligned at x+w), desc @
//      ry+ACH_DESC_DY; sizes unchanged from CS013 P3 (15/13-or-14/10 * ACH_SCALE); the stacking order
//      is strictly increasing (0 < ACH_STATUS_DY < ACH_DESC_DY < ACH_ROW_STEP) so three lines seat
//      inside one row without touching the next row's name line.
//  (C) achMaxScroll() agreement: the maxScroll value achMaxScroll() actually returns (real function,
//      real Achievements pool) is recomputed independently from the exported real symbols
//      (ACH_ROW_STEP, ACH_DESC_DY, ACH_SCALE, ACH_ROW_VISIBLE_H) and asserted equal — catches render
//      geometry (ACH_ROW_STEP/ACH_DESC_DY) and the achMaxScroll() tail term ever drifting apart;
//      achMaxScroll() >= 0; menuAchievements("down"/"up") clamps game.menu.scroll to [0, maxScroll].
//  (D) headless: drawAchievements() renders without throwing at scroll 0 and at scroll == maxScroll,
//      with both a tiered row and a plain (non-tiered) row present in the pool (both drawAchRow
//      branches exercised); AudioSys.ctx null -> startGame()/update(1/60) don't throw.

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
  const tmp = path.join(repoRoot, "scratchpad", "_cs015p2_extracted.js");
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

// ---- Recording 2D context — logs fillText (text/x/y/font-size/color/align), mirrors
// test-cs013-p3.js's canvas-recording idiom. Every other method is a safe no-op. ----
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
  "ACH_ROW_STEP", "ACH_ROW0_Y", "ACH_ROW_VISIBLE_H", "ACH_ROW_CLIP_TOP", "ACH_ROW_CLIP_BOTTOM",
  "MENU_HINT_SIZE", "MENU_OPTIONS", "drawAchievements", "drawAchRow", "AudioSys", "VIEW_W", "VIEW_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  startGame, update, game, gotoScreen, menuAchievements, achMaxScroll,
  Achievements, COLOR, TIER_COLOR, ACH_SCALE, ACH_SCROLL_STEP, ACH_STATUS_DY, ACH_DESC_DY,
  ACH_ROW_STEP, ACH_ROW0_Y, ACH_ROW_VISIBLE_H, ACH_ROW_CLIP_TOP, ACH_ROW_CLIP_BOTTOM,
  MENU_HINT_SIZE, MENU_OPTIONS, drawAchievements, drawAchRow, AudioSys, VIEW_W, VIEW_H
} = A;

AudioSys.init();
startGame();

// Mirrors test-cs013-p3.js's resetAch() — test scaffolding only, not a reimplementation of any
// achievement-unlock LOGIC. Keeps activeIds at the real 5-wide shape a live game always has.
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
const px = (VIEW_W - 1200) / 2, py = (VIEW_H - 660) / 2;
const xL = px + 30, xM = px + 430, xR = px + 820;
const ry0 = ACH_ROW0_Y;

// ================= (B) real per-row geometry: name @ry, status @ry+ACH_STATUS_DY, desc @ry+ACH_DESC_DY =================
(function sectionB() {
  console.log("(B) name/status/desc stack on three real lines: ry, ry+ACH_STATUS_DY, ry+ACH_DESC_DY");
  assert(ACH_ROW0_Y === ry0, "B: ACH_ROW0_Y exported and consistent");
  assert(0 < ACH_STATUS_DY && ACH_STATUS_DY < ACH_DESC_DY && ACH_DESC_DY < ACH_ROW_STEP,
    `B: stacking order holds (0 < ACH_STATUS_DY=${ACH_STATUS_DY} < ACH_DESC_DY=${ACH_DESC_DY} < ACH_ROW_STEP=${ACH_ROW_STEP})`);

  game.state = "playing";
  resetAch();
  gotoScreen("achievements", 0);
  const log = render(drawAchievements);

  // Weekly column (row 0 is guaranteed non-tiered — the F9/CS010 weekly pool carries no .tiers entries).
  const weekly = Achievements.activeWeekly();
  weekly.forEach((ach, i) => {
    const ry = ry0 + i * ACH_ROW_STEP;
    const name = at(log, xL, ry).find(e => e.str === ach.name);
    assert(!!name, `B: weekly row ${i} ("${ach.name}") name fillText at (x, ry)`);
    assert(fontSize(name) === 15 * ACH_SCALE, `B: weekly row ${i} name size == 15*ACH_SCALE`);

    const status = at(log, xL + 350, ry + ACH_STATUS_DY);
    assert(status.length === 1, `B: weekly row ${i} status fillText at (x+w, ry+ACH_STATUS_DY) (got ${status.length} matches)`);
    assert(status[0].align === "right", `B: weekly row ${i} status stays right-aligned`);
    assert(fontSize(status[0]) === 14 * ACH_SCALE, `B: weekly row ${i} status size == 14*ACH_SCALE (unchanged from CS013 P3)`);
    assert(at(log, xL + 350, ry).length === 0, `B: weekly row ${i} status no longer shares the name's baseline (ry)`);

    const desc = at(log, xL, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
    assert(!!desc, `B: weekly row ${i} description fillText at (x, ry+ACH_DESC_DY)`);
    assert(fontSize(desc) === 10 * ACH_SCALE, `B: weekly row ${i} description size == 10*ACH_SCALE (unchanged)`);
  });

  // Lifetime columns: covers BOTH drawAchRow branches (tiered + plain).
  const half = Math.ceil(Achievements.LIFETIME.length / 2);
  Achievements.LIFETIME.forEach((ach, i) => {
    const col = i < half ? xM : xR, row = i < half ? i : i - half;
    const ry = ry0 + row * ACH_ROW_STEP;
    const name = at(log, col, ry).find(e => e.str === ach.name);
    assert(!!name, `B: lifetime row ${i} ("${ach.name}") name fillText at (x, ry)`);

    const statusSize = ach.tiers ? 13 * ACH_SCALE : 14 * ACH_SCALE;
    const status = at(log, col + 350, ry + ACH_STATUS_DY);
    assert(status.length === 1, `B: lifetime row ${i} ("${ach.name}") status at (x+w, ry+ACH_STATUS_DY)`);
    assert(status[0].align === "right", `B: lifetime row ${i} status stays right-aligned`);
    assert(fontSize(status[0]) === statusSize, `B: lifetime row ${i} status size == ${statusSize} (tiers=${!!ach.tiers})`);
    assert(at(log, col + 350, ry).length === 0, `B: lifetime row ${i} status no longer shares the name's baseline (ry)`);

    const desc = at(log, col, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
    assert(!!desc, `B: lifetime row ${i} description fillText at (x, ry+ACH_DESC_DY)`);
  });

  // Confirm both branches were actually exercised (not a vacuously-true loop).
  assert(Achievements.LIFETIME.some(a => a.tiers), "B: pool sanity — at least one tiered lifetime row exists");
  assert(Achievements.LIFETIME.some(a => !a.tiers) || weekly.length > 0, "B: pool sanity — at least one plain (non-tiered) row exists");
})();

// ================= (C) achMaxScroll() agrees with the real per-row geometry it assumes =================
(function sectionC() {
  console.log("(C) achMaxScroll() matches an independent recompute from the exported real symbols; clamps game.menu.scroll");
  game.state = "playing";
  resetAch();
  gotoScreen("achievements", 0);

  const half = Math.ceil(Achievements.LIFETIME.length / 2);
  const rowsTall = Math.max(Achievements.activeWeekly().length, half);
  const expectedContentH = (rowsTall - 1) * ACH_ROW_STEP + ACH_DESC_DY + 10 * ACH_SCALE;
  const expectedMaxScroll = Math.max(0, expectedContentH - ACH_ROW_VISIBLE_H);
  const realMaxScroll = achMaxScroll();
  assert(realMaxScroll === expectedMaxScroll,
    `C: achMaxScroll() (${realMaxScroll}) matches the independent recompute from ACH_ROW_STEP/ACH_DESC_DY/ACH_SCALE/ACH_ROW_VISIBLE_H (${expectedMaxScroll})`);
  assert(realMaxScroll >= 0, `C: achMaxScroll() >= 0 (got ${realMaxScroll})`);
  assert(ACH_ROW_VISIBLE_H === ACH_ROW_CLIP_BOTTOM - ACH_ROW_CLIP_TOP, "C: ACH_ROW_VISIBLE_H == clip bottom - clip top");

  // menuAchievements clamps game.menu.scroll to [0, maxScroll].
  assert(game.menu.scroll === 0, "C: fresh gotoScreen starts unscrolled");
  for (let i = 0; i < 40; i++) menuAchievements("down"); // hammer well past the ceiling
  assert(game.menu.scroll === realMaxScroll, `C: repeated "down" clamps scroll at maxScroll (got ${game.menu.scroll}, max ${realMaxScroll})`);
  for (let i = 0; i < 40; i++) menuAchievements("up"); // hammer well past the floor
  assert(game.menu.scroll === 0, `C: repeated "up" clamps scroll at 0 (got ${game.menu.scroll})`);
})();

// ================= (D) headless: no-throw at scroll 0 and scroll==maxScroll, both row shapes =================
(function sectionD() {
  console.log("(D) drawAchievements() renders without throwing at scroll 0 and scroll==maxScroll (tiered + plain rows both present); AudioSys.ctx null smoke");
  game.state = "playing";
  resetAch();
  gotoScreen("achievements", 0);

  assert(Achievements.LIFETIME.some(a => a.tiers) && Achievements.LIFETIME.some(a => !a.tiers),
    "D: pool sanity — both a tiered and a plain row are present in LIFETIME (both drawAchRow branches will render)");

  noThrow(() => render(drawAchievements), "D: drawAchievements() at scroll 0");
  const maxScroll = achMaxScroll();
  game.menu.scroll = maxScroll;
  noThrow(() => render(drawAchievements), "D: drawAchievements() at scroll == maxScroll");
  assert(game.menu.scroll === maxScroll, "D: forcing scroll to maxScroll didn't get reclamped away from it");

  AudioSys.ctx = null;
  noThrow(() => { startGame(); }, "D: startGame() with ctx null");
  noThrow(() => { for (let i = 0; i < 30; i++) update(1 / 60); }, "D: update(1/60) x30 with ctx null");
  game.state = "playing";
  noThrow(() => {
    gotoScreen("achievements", 0);
    render(drawAchievements);
    menuAchievements("down"); menuAchievements("down");
    render(drawAchievements);
    menuAchievements("up");
    render(drawAchievements);
    menuAchievements("back");
  }, "D: a full open/scroll/close cycle renders without throwing");
  game.state = "gameover";
  noThrow(() => { gotoScreen("achievements", 0); render(drawAchievements); menuAchievements("confirm"); }, "D: the same cycle from gameover never throws");
})();

console.log(`\ntest-cs015-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
