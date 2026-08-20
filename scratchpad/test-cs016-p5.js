// Headless test for CS016 Phase 5 (the round's final phase) — the Achievements viewer becomes TWO
// TABS (Weekly / Lifetime) down a SINGLE full-width column instead of three 350px ones, achMaxScroll()
// becomes tab-aware, and GAME_VERSION bumps to "1.0.0.16".
//
//   node scratchpad/test-cs016-p5.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL drawAchievements()/drawAchRow()/achMaxScroll()/
// menuAchievements()/menuInput()/gotoScreen() via the recording 2D-context stub idiom established by
// test-cs013-p3.js. No scroll, ceiling, tab-resolution or row geometry is reimplemented here — every
// expectation is either read off the real render log or recomputed from real exported symbols.
//
// TAB SWITCHING WRAPS (it does not clamp). With exactly two tabs either direction always lands on the
// other one, so a player tapping ◄ on the Weekly tab gets Lifetime rather than a dead key; setAchTab's
// modulo keeps that a proper carousel if a third tab is ever added. §C asserts the wrap explicitly.
//
// Sections:
//  (A) node --check on the extracted <script>; GAME_VERSION === "1.0.0.38" (live pin, tracks HEAD).
//  (B) Entry defaults to the Weekly tab with scroll 0 — on a SECOND entry too, after the first entry
//      has been left on the Lifetime tab and scrolled.
//  (C) left/right switch tabs in both directions and WRAP at both ends; every switch resets
//      game.menu.scroll to 0; an unknown/stale achTab id degrades to tab 0 rather than crashing.
//  (D) Only the ACTIVE tab's rows render: the log carries every one of the active tab's achievement
//      names and NONE of the inactive tab's.
//  (E) achMaxScroll() returns a DIFFERENT, tab-appropriate ceiling per tab, each cross-checked against
//      an independent recompute from the real exported symbols (ACH_ROW_STEP / ACH_DESC_DY / ACH_SCALE
//      / ACH_ROW_VISIBLE_H); up/down clamp to [0, achMaxScroll()] on each tab; the ONE ceiling is
//      shared by render and input (the renderer never grows its own copy).
//  (F) Rows draw inside the clip bracket in save->beginPath->rect->clip->rows->restore order; the panel
//      title, subtitle, both tab labels and the footer all draw OUTSIDE it.
//  (G) Both drawAchRow branches (tiered + single-goal) render correctly in the new single-column
//      layout — name/status/desc at ACH_COL_X / ACH_COL_X+ACH_COL_W, right colours, right sizes.
//  (H) Back (and confirm) still return to "titlemenu" with the cursor restored to the Achievements row.
//  (I) AudioSys.ctx null -> startGame()/update(1/60) + a full open/tab-switch/scroll/close cycle from
//      the title never throws.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function noThrow(fn, msg) { try { fn(); passed++; } catch (e) { failed++; console.error("  FAIL: " + msg + " threw: " + e.message); } }

// ================= (A1) syntax =====================
(function () {
  console.log("(A) node --check on the extracted <script> + GAME_VERSION pin");
  const tmp = path.join(repoRoot, "scratchpad", "_cs016p5_extracted.js");
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
// save/beginPath/rect/clip/restore into ONE ordered array, so clip-bracket order can be asserted off
// the log (test-cs013-p3.js's idiom). Every other method is a safe no-op. ----
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
      if (p === "measureText") return str => ({ width: String(str).length * 8 });
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
  "GAME_VERSION", "startGame", "update", "game", "gotoScreen", "quitToTitle",
  "menuAchievements", "menuInput", "achMaxScroll", "achTabIndex", "achRows", "setAchTab",
  "Achievements", "COLOR", "TIER_COLOR", "MENU_TITLE", "MENU_HINT_SIZE",
  "ACH_SCALE", "ACH_SCROLL_STEP", "ACH_STATUS_DY", "ACH_DESC_DY", "ACH_ROW_STEP", "ACH_ROW0_Y",
  "ACH_TAB_MARK",  // CS026 P6 (gate Q8.1): the selected tab's suffix
  "ACH_ROW_VISIBLE_H", "ACH_ROW_CLIP_TOP", "ACH_ROW_CLIP_BOTTOM", "ACH_PANEL_W", "ACH_PANEL_X", "ACH_PANEL_Y",
  "ACH_TABS", "ACH_TAB_DEFAULT", "ACH_COL_X", "ACH_COL_W", "ACH_TAB_STEP", "ACH_TAB_Y", "ACH_HINT",
  "drawAchievements", "drawAchRow", "AudioSys", "VIEW_W", "VIEW_H"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  GAME_VERSION, startGame, update, game, gotoScreen, quitToTitle,
  menuAchievements, menuInput, achMaxScroll, achTabIndex, achRows, setAchTab,
  Achievements, COLOR, TIER_COLOR, MENU_TITLE, MENU_HINT_SIZE,
  ACH_SCALE, ACH_SCROLL_STEP, ACH_STATUS_DY, ACH_DESC_DY, ACH_ROW_STEP, ACH_ROW0_Y,
  ACH_TAB_MARK,
  ACH_ROW_VISIBLE_H, ACH_ROW_CLIP_TOP, ACH_ROW_CLIP_BOTTOM, ACH_PANEL_W, ACH_PANEL_X, ACH_PANEL_Y,
  ACH_TABS, ACH_TAB_DEFAULT, ACH_COL_X, ACH_COL_W, ACH_TAB_STEP, ACH_TAB_Y, ACH_HINT,
  drawAchievements, drawAchRow, AudioSys, VIEW_W, VIEW_H
} = A;

// CS026 P6 (gate Q8): two matchers this file needs everywhere it used to compare a label by identity.
// ⛔ MATCH EXACTLY, in both forms — never startsWith(), which the panel's own "WEEKLY SET 2026-33 —
// resets each calendar week" subtitle would satisfy before the real tab label.
const isTabLabel = (str, t) => str === t.label || str === t.label + ACH_TAB_MARK;
const isLeaderRun = str => typeof str === "string" && str.length > 0 && [...str].every(ch => ch === "\u00b7");

AudioSys.init();
startGame();

// Mirrors test-cs013-p3.js's resetAch() — TEST scaffolding only, not a reimplementation of any
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
const cx = VIEW_W / 2;
const tabId = () => ACH_TABS[achTabIndex()].id;
const tabOf = id => ACH_TABS.find(t => t.id === id);
// Enter the viewer by driving the REAL handlers, exactly as a player would: gotoScreen always lands
// on Weekly, so reaching Lifetime means pressing "right".
function openTab(id) {
  gotoScreen("achievements", 0);
  for (let i = 0; i < ACH_TABS.length && tabId() !== id; i++) menuAchievements("right");
  assert(tabId() === id, `openTab: reached the "${id}" tab by pressing right`);
}

// ================= (A2) GAME_VERSION pin =====================
(function sectionA() {
  assert(GAME_VERSION === "1.0.0.38", `A: GAME_VERSION is exactly "1.0.0.38" (got "${GAME_VERSION}")`);
  assert(/^\d+\.\d+\.\d+\.\d+$/.test(GAME_VERSION), "A: GAME_VERSION keeps the unprefixed Major.Minor.Patch.Changeset shape");
  // Table shape: exactly two tabs, the first one being the default the entry reset names.
  assert(ACH_TABS.length === 2, `A: ACH_TABS carries exactly two tabs (got ${ACH_TABS.length})`);
  assert(ACH_TABS[0].id === ACH_TAB_DEFAULT, "A: ACH_TABS[0].id IS ACH_TAB_DEFAULT (one source of truth, no duplicated literal)");
  assert(ACH_TABS[1].id === "lifetime", "A: the second tab is \"lifetime\"");
  assert(ACH_TABS[0].rows() === Achievements.activeWeekly() || ACH_TABS[0].rows().length === Achievements.activeWeekly().length,
    "A: tab 0's rows() is the live weekly pool");
  assert(ACH_TABS[1].rows() === Achievements.LIFETIME, "A: tab 1's rows() is the live LIFETIME array (a thunk, not a snapshot)");
  assert(ACH_COL_X === ACH_PANEL_X + 30 && ACH_COL_W === ACH_PANEL_W - 60,
    "A: the single column is the full panel width less a 30px gutter each side");
})();

// ================= (B) entry defaults to Weekly, scroll 0 — on a SECOND entry too =================
(function sectionB() {
  console.log("(B) every entry lands on the Weekly tab, unscrolled — second entry included");
  game.state = "playing";
  resetAch();

  gotoScreen("achievements", 0);
  assert(tabId() === ACH_TAB_DEFAULT, `B: first entry lands on the default (Weekly) tab (got "${tabId()}")`);
  assert(game.menu.achTab === "weekly", "B: ...and the field itself reads \"weekly\"");
  assert(game.menu.scroll === 0, "B: first entry starts unscrolled");

  // Leave it on the OTHER tab, scrolled, then come back.
  menuAchievements("right");
  for (let i = 0; i < 5; i++) menuAchievements("down");
  assert(tabId() === "lifetime" && game.menu.scroll > 0, "B: left the viewer on the Lifetime tab, scrolled");
  menuAchievements("back");
  assert(game.menu.screen === "titlemenu", "B: ...and exited to the title menu");

  gotoScreen("achievements", 0);
  assert(tabId() === ACH_TAB_DEFAULT, `B: the SECOND entry also lands on Weekly, not on the tab we left (got "${tabId()}")`);
  assert(game.menu.scroll === 0, "B: the SECOND entry is also unscrolled");

  // A third entry from a *different* screen resets it too — gotoScreen is the one reset site.
  menuAchievements("right");
  gotoScreen("options", 0);
  gotoScreen("achievements", 0);
  assert(tabId() === ACH_TAB_DEFAULT && game.menu.scroll === 0, "B: re-entry after visiting another screen is Weekly/unscrolled as well");

  // startGame()'s own game.menu reset carries the field too (CS016 P3's both-literals rule).
  startGame();
  assert(game.menu.achTab === ACH_TAB_DEFAULT, "B: startGame()'s game.menu reset carries achTab (never undefined for a run)");
})();

// ================= (C) left/right switch + wrap; every switch zeroes scroll =================
(function sectionC() {
  console.log("(C) left/right switch tabs both directions and WRAP; every switch resets scroll to 0");
  game.state = "playing";
  resetAch();

  gotoScreen("achievements", 0);
  assert(tabId() === "weekly", "C: start on Weekly");
  menuAchievements("right");
  assert(tabId() === "lifetime", "C: \"right\" from Weekly -> Lifetime");
  menuAchievements("left");
  assert(tabId() === "weekly", "C: \"left\" from Lifetime -> Weekly");

  // WRAP (the chosen behaviour, not clamp): left off the first tab lands on the last, and right off
  // the last lands back on the first.
  menuAchievements("left");
  assert(tabId() === "lifetime", "C: \"left\" off the FIRST tab WRAPS to the last (chosen: wrap, not clamp)");
  menuAchievements("right");
  assert(tabId() === "weekly", "C: \"right\" off the LAST tab WRAPS to the first");

  // Every switch zeroes the scroll — in both directions, from a nonzero offset.
  openTab("lifetime");
  for (let i = 0; i < 6; i++) menuAchievements("down");
  const scrolled = game.menu.scroll;
  assert(scrolled > 0, `C: scrolled the Lifetime tab first (got ${scrolled})`);
  menuAchievements("left");
  assert(tabId() === "weekly" && game.menu.scroll === 0, "C: switching LEFT resets scroll to 0");
  openTab("lifetime");
  for (let i = 0; i < 6; i++) menuAchievements("down");
  assert(game.menu.scroll > 0, "C: scrolled again ahead of the right-switch check");
  menuAchievements("right");
  assert(tabId() === "weekly" && game.menu.scroll === 0, "C: switching RIGHT (wrapping) resets scroll to 0");

  // Nothing else on this screen moved: left/right were genuinely free actions before P5.
  gotoScreen("achievements", 0);
  const before = { index: game.menu.index, row: game.menu.row, col: game.menu.col, screen: game.menu.screen };
  menuAchievements("right"); menuAchievements("left");
  assert(game.menu.index === before.index && game.menu.row === before.row &&
         game.menu.col === before.col && game.menu.screen === before.screen,
    "C: tab switching touches nothing but achTab/scroll (index/row/col/screen unchanged)");

  // A stale or unknown achTab id degrades to tab 0 rather than crashing or blanking the screen.
  game.menu.achTab = "no_such_tab";
  assert(achTabIndex() === 0, "C: an unknown achTab id resolves to tab 0");
  assert(achRows().length === Achievements.activeWeekly().length, "C: ...so achRows() falls back to the weekly pool");
  noThrow(() => render(drawAchievements), "C: ...and drawAchievements() renders it without throwing");
  game.menu.achTab = undefined;
  assert(achTabIndex() === 0, "C: an undefined achTab resolves to tab 0 too");
  gotoScreen("achievements", 0); // restore a sane field for later sections
})();

// ================= (D) only the ACTIVE tab's rows render =================
(function sectionD() {
  console.log("(D) the log carries every active-tab achievement name and NONE from the inactive tab");
  game.state = "playing";
  resetAch();

  // Precondition: the two pools share no names, so "none from the other tab" is a meaningful claim.
  const weeklyNames = Achievements.activeWeekly().map(a => a.name);
  const lifetimeNames = Achievements.LIFETIME.map(a => a.name);
  assert(!weeklyNames.some(n => lifetimeNames.includes(n)), "D: precondition — the weekly and lifetime pools share no achievement name");

  ACH_TABS.forEach((tab, i) => {
    const other = ACH_TABS[1 - i];
    openTab(tab.id);
    const log = render(drawAchievements);
    const strs = log.filter(e => e.c === "fillText").map(e => e.str);
    tab.rows().forEach(ach => assert(strs.includes(ach.name), `D: [${tab.id}] the active tab's row "${ach.name}" is rendered`));
    other.rows().forEach(ach => assert(!strs.includes(ach.name), `D: [${tab.id}] the INACTIVE tab's row "${ach.name}" is NOT rendered`));
    // The descriptions follow their names — not a name-only filter somewhere.
    tab.rows().forEach(ach => assert(strs.includes(ach.desc), `D: [${tab.id}] the active tab's description for "${ach.name}" is rendered`));
    other.rows().forEach(ach => assert(!strs.includes(ach.desc), `D: [${tab.id}] the INACTIVE tab's description for "${ach.name}" is NOT rendered`));
    // Both tab LABELS are always drawn (the header is a tab strip, not just the active caption).
    ACH_TABS.forEach(t => assert(strs.some(str => isTabLabel(str, t)), `D: [${tab.id}] both tab labels are drawn, including "${t.label}" (bare or ACH_TAB_MARK-suffixed)`));
  });
})();

// ================= (E) tab-aware ceiling, cross-checked + clamped, ONE shared function ==========
(function sectionE() {
  console.log("(E) achMaxScroll() is per-tab, cross-checks against an independent recompute, and clamps up/down on each");
  game.state = "playing";
  resetAch();

  const ceilings = {};
  ACH_TABS.forEach(tab => {
    openTab(tab.id);
    const rows = tab.rows().length;
    // Independent recompute from the REAL exported geometry symbols (the drift check test-cs015-p2.js
    // does): last row's baseline -> its description's bottom, less the visible clip height.
    const expectedContentH = (rows - 1) * ACH_ROW_STEP + ACH_DESC_DY + 10 * ACH_SCALE;
    const expected = Math.max(0, expectedContentH - ACH_ROW_VISIBLE_H);
    const real = achMaxScroll();
    ceilings[tab.id] = real;
    assert(real === expected,
      `E: [${tab.id}] achMaxScroll() (${real}) matches the independent recompute from ACH_ROW_STEP/ACH_DESC_DY/ACH_SCALE/ACH_ROW_VISIBLE_H (${expected})`);
    assert(real >= 0, `E: [${tab.id}] achMaxScroll() >= 0`);
    assert(ACH_ROW_VISIBLE_H === ACH_ROW_CLIP_BOTTOM - ACH_ROW_CLIP_TOP, `E: [${tab.id}] ACH_ROW_VISIBLE_H == clip bottom - clip top`);

    // up/down clamp to [0, achMaxScroll()] on THIS tab.
    assert(game.menu.scroll === 0, `E: [${tab.id}] a fresh entry starts unscrolled`);
    menuAchievements("down");
    assert(game.menu.scroll === Math.min(real, ACH_SCROLL_STEP), `E: [${tab.id}] one "down" advances by ACH_SCROLL_STEP, clamped (got ${game.menu.scroll})`);
    for (let i = 0; i < 40; i++) menuAchievements("down");
    assert(game.menu.scroll === real, `E: [${tab.id}] repeated "down" clamps at the tab's own ceiling (got ${game.menu.scroll}, max ${real})`);
    for (let i = 0; i < 40; i++) menuAchievements("up");
    assert(game.menu.scroll === 0, `E: [${tab.id}] repeated "up" clamps at 0 (got ${game.menu.scroll})`);
  });

  assert(ceilings.weekly !== ceilings.lifetime,
    `E: the two tabs return DIFFERENT ceilings (weekly ${ceilings.weekly}, lifetime ${ceilings.lifetime}) — the function really is tab-aware`);
  assert(ceilings.weekly === 0, `E: the Weekly tab's 5 rows fit inside ACH_ROW_VISIBLE_H -> ceiling 0 (got ${ceilings.weekly})`);
  assert(ceilings.lifetime > 0, `E: the Lifetime tab's 20 unhalved rows overflow -> ceiling > 0 (got ${ceilings.lifetime})`);

  // Pre-P5 the Lifetime column was halved across two columns; unhalved it is ~twice as tall, so the
  // ceiling must exceed what the old ceil-half column would have produced.
  const oldHalfRows = Math.ceil(Achievements.LIFETIME.length / 2);
  const oldCeiling = Math.max(0, (oldHalfRows - 1) * ACH_ROW_STEP + ACH_DESC_DY + 10 * ACH_SCALE - ACH_ROW_VISIBLE_H);
  assert(ceilings.lifetime > oldCeiling,
    `E: the Lifetime tab scrolls considerably more than the old half-column did (${ceilings.lifetime} > ${oldCeiling})`);

  // ONE function, BOTH callers: the renderer's own clamp uses the same ceiling the input clamp does.
  // Force a scroll far past the ceiling behind the handler's back and let the RENDERER clamp it.
  openTab("lifetime");
  game.menu.scroll = ceilings.lifetime + 99999;
  render(drawAchievements);
  assert(game.menu.scroll === ceilings.lifetime,
    `E: drawAchievements() clamps to the SAME achMaxScroll() the input clamp uses (got ${game.menu.scroll})`);
  game.menu.scroll = -500;
  render(drawAchievements);
  assert(game.menu.scroll === 0, "E: drawAchievements() also clamps a negative scroll to 0");
  // ...and on the zero-ceiling tab the renderer collapses any offset to 0.
  openTab("weekly");
  game.menu.scroll = 400;
  render(drawAchievements);
  assert(game.menu.scroll === 0, "E: on a tab with ceiling 0 the renderer collapses any offset to 0");

  // Source check: the render clamp really does call the shared helper, not a re-derived copy.
  const drawSrc = scriptSrc.slice(scriptSrc.indexOf("function drawAchievements()"));
  const body = drawSrc.slice(0, drawSrc.indexOf("\n}"));
  assert(/drawAchRow\(/.test(body) && /ctx\.clip\(\)/.test(body), "E: sanity — the extracted drawAchievements() body is the real one");
  assert(/achMaxScroll\(\)/.test(body), "E: drawAchievements() calls achMaxScroll() by name");
  // ACH_DESC_DY is the ceiling formula's distinguishing tail term and appears nowhere in the render
  // path (which only needs ACH_ROW0_Y/ACH_ROW_STEP and the clip window) — so its absence here is a
  // direct check that the renderer has not grown a second copy of the ceiling maths.
  assert(!/ACH_DESC_DY/.test(body), "E: drawAchievements() does NOT recompute the ceiling itself (no ACH_DESC_DY in its body)");
})();

// ================= (F) clip bracket order; chrome outside it =================
(function sectionF() {
  console.log("(F) save->beginPath->rect->clip->rows->restore; title/tab header/footer draw outside");
  game.state = "playing";
  resetAch();

  ACH_TABS.forEach(tab => {
    openTab(tab.id);
    const log = render(drawAchievements);
    const idx = c => log.findIndex(e => e.c === c);
    const saveIdx = idx("save"), beginIdx = idx("beginPath"), rectIdx = idx("rect"), clipIdx = idx("clip"), restoreIdx = idx("restore");
    assert([saveIdx, beginIdx, rectIdx, clipIdx, restoreIdx].every(i => i >= 0), `F: [${tab.id}] save/beginPath/rect/clip/restore all appear`);
    assert(saveIdx < beginIdx && beginIdx < rectIdx && rectIdx < clipIdx && clipIdx < restoreIdx,
      `F: [${tab.id}] they appear in save->beginPath->rect->clip->restore order`);

    // The clip rect is the panel-wide row window.
    const rectEntry = log[rectIdx];
    assert(rectEntry.x === ACH_PANEL_X && rectEntry.y === ACH_ROW_CLIP_TOP && rectEntry.w === ACH_PANEL_W && rectEntry.h === ACH_ROW_VISIBLE_H,
      `F: [${tab.id}] the clip rect is (ACH_PANEL_X, ACH_ROW_CLIP_TOP, ACH_PANEL_W, ACH_ROW_VISIBLE_H)`);

    // Exactly the active tab's rows, three fillTexts each, INSIDE the bracket.
    const inside = log.slice(clipIdx + 1, restoreIdx).filter(e => e.c === "fillText");
    const n = tab.rows().length;
    // ⛔ CS026 P6 (gate Q8.4): a row is FOUR fillTexts now, not three — name, status, description and
    // the dotted leader run tying the first two together. The leader is conditional (achLeader() bails
    // on a span under ACH_LEADER_MIN or a degenerate glyph width), so the count is bounded rather than
    // fixed: at least three per row, at most four, and every leader inside the bracket must be a run
    // of ACH_LEADER_DOT. Pinning `n * 4` flat would make this assertion depend on this stub's
    // measureText model rather than on the renderer.
    const leaders = inside.filter(e => isLeaderRun(e.str));
    assert(inside.length === n * 3 + leaders.length,
      `F: [${tab.id}] ${n} rows draw ${n * 3} name/status/desc fillTexts plus ${leaders.length} leader runs, all inside the clip (got ${inside.length})`);
    assert(leaders.length === n, `F: [${tab.id}] every one of the ${n} rows got a leader run (got ${leaders.length})`);
    tab.rows().forEach(ach => assert(inside.some(e => e.str === ach.name), `F: [${tab.id}] "${ach.name}" draws INSIDE the clip`));

    // Chrome outside: panel title, subtitle, both tab labels, footer.
    const chrome = [
      log.find(e => e.c === "fillText" && e.str === "ACHIEVEMENTS"),
      log.find(e => e.c === "fillText" && /^WEEKLY SET/.test(e.str)),
      ...ACH_TABS.map(t => log.find(e => e.c === "fillText" && isTabLabel(e.str, t))),
      log.find(e => e.c === "fillText" && e.str === ACH_HINT)
    ];
    chrome.forEach(e => {
      const i = log.indexOf(e);
      assert(i >= 0 && (i < saveIdx || i > restoreIdx), `F: [${tab.id}] chrome fillText "${e && e.str}" draws OUTSIDE the save/restore bracket`);
    });
    assert(log.indexOf(chrome[0]) < saveIdx, `F: [${tab.id}] the panel title draws before the clip (menuPanel)`);
    ACH_TABS.forEach((t, i) => {
      const e = log.find(e => e.c === "fillText" && isTabLabel(e.str, t));
      assert(log.indexOf(e) < saveIdx, `F: [${tab.id}] the tab label "${t.label}" draws before the clip`);
    });
    assert(log.indexOf(chrome[chrome.length - 1]) > restoreIdx, `F: [${tab.id}] the footer draws after restore`);

    // Tab header + footer detail: position, size, selected/idle contrast, hint routing.
    ACH_TABS.forEach((t, i) => {
      const hit = at(log, ACH_COL_X + i * ACH_TAB_STEP, ACH_PANEL_Y + ACH_TAB_Y).find(e => isTabLabel(e.str, t));
      assert(!!hit, `F: [${tab.id}] tab label "${t.label}" sits at (ACH_COL_X + i*ACH_TAB_STEP, panelY+ACH_TAB_Y)`);
      assert(!!hit && fontSize(hit) === 15 * ACH_SCALE, `F: [${tab.id}] tab label "${t.label}" is 15*ACH_SCALE`);
      assert(!!hit && hit.align === "left", `F: [${tab.id}] tab label "${t.label}" is left-aligned`);
      assert(!!hit && hit.color === (t.id === tab.id ? COLOR.text : COLOR.menuIdle),
        `F: [${tab.id}] tab label "${t.label}" uses the COLOR.text/COLOR.menuIdle selected-idle convention`);
      // CS026 P6 (gate Q8.1): ...and the mark rides ON TOP of that convention, on the selected tab only.
      assert(!!hit && (hit.str === t.label + ACH_TAB_MARK) === (t.id === tab.id),
        `F: [${tab.id}] tab label "${t.label}" wears ACH_TAB_MARK iff selected — additive to the colour, not a replacement`);
    });
    const footer = log.find(e => e.c === "fillText" && e.str === ACH_HINT);
    assert(!!footer && footer.x === cx && footer.y === ACH_PANEL_Y + 644, `F: [${tab.id}] the footer sits at (cx, panelY+644)`);
    assert(!!footer && fontSize(footer) === MENU_HINT_SIZE && footer.color === COLOR.menuIdle,
      `F: [${tab.id}] the footer routes through drawMenuHint (MENU_HINT_SIZE / COLOR.menuIdle)`);
    assert(/◄►/.test(ACH_HINT) && /switch tab/.test(ACH_HINT), "F: the hint tells the player left/right switches tabs");
  });
})();

// ================= (G) both drawAchRow branches in the single-column layout =================
(function sectionG() {
  console.log("(G) tiered and single-goal rows both render correctly at ACH_COL_X / ACH_COL_W");
  game.state = "playing";
  resetAch();
  // One unlocked weekly (plain, done), one tiered lifetime pushed to tier 1 — so every colour branch
  // of drawAchRow gets exercised in the new layout.
  const unlockedWeeklyId = Achievements.activeWeekly()[0].id;
  Achievements.weeklyUnlocked.add(unlockedWeeklyId);
  const tieredAch = Achievements.LIFETIME.find(a => a.tiers);
  Achievements.lifetimeTiers[tieredAch.id] = 1;

  let tieredSeen = 0, plainSeen = 0;
  ACH_TABS.forEach(tab => {
    openTab(tab.id);
    const log = render(drawAchievements);
    tab.rows().forEach((ach, i) => {
      const ry = ACH_ROW0_Y + i * ACH_ROW_STEP;
      const name = at(log, ACH_COL_X, ry).find(e => e.str === ach.name);
      const status = at(log, ACH_COL_X + ACH_COL_W, ry + ACH_STATUS_DY)[0];
      const desc = at(log, ACH_COL_X, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
      assert(!!name && !!status && !!desc, `G: [${tab.id}] "${ach.name}" renders all three lines in the single column`);
      assert(!!name && name.align === "left" && !!desc && desc.align === "left", `G: [${tab.id}] "${ach.name}" name/desc are left-aligned at ACH_COL_X`);
      assert(!!status && status.align === "right", `G: [${tab.id}] "${ach.name}" status is right-aligned at ACH_COL_X+ACH_COL_W`);
      assert(!!desc && desc.color === COLOR.menuIdle, `G: [${tab.id}] "${ach.name}" description reads COLOR.menuIdle`);
      if (ach.tiers) {
        tieredSeen++;
        const ti = Achievements.tierIndex(ach);
        const expect = ti >= 0 ? TIER_COLOR[ti] : COLOR.text;
        assert(!!name && name.color === expect, `G: tiered "${ach.name}" name reads its tier tint (or COLOR.text pre-bronze)`);
        assert(!!status && status.color === (ti >= 0 ? expect : COLOR.menuIdle), `G: tiered "${ach.name}" status is tier-tinted once >= bronze`);
        assert(!!status && fontSize(status) === 13 * ACH_SCALE, `G: tiered "${ach.name}" status size == 13*ACH_SCALE`);
        assert(!!status && status.str === Achievements.tierStatusText(ach), `G: tiered "${ach.name}" status text is the real tierStatusText()`);
      } else {
        plainSeen++;
        const done = Achievements.isUnlocked(ach);
        assert(!!name && name.color === (done ? COLOR.ach : COLOR.text), `G: single-goal "${ach.name}" name colour matches its unlocked state`);
        assert(!!status && status.color === (done ? COLOR.ach : COLOR.menuIdle), `G: single-goal "${ach.name}" readout is ach-when-done / menuIdle-when-locked`);
        assert(!!status && fontSize(status) === 14 * ACH_SCALE, `G: single-goal "${ach.name}" readout size == 14*ACH_SCALE`);
        assert(!!status && status.str === (done ? "✓" : Achievements.progressText(ach)), `G: single-goal "${ach.name}" readout is ✓ or the real progressText()`);
      }
      assert(!!name && fontSize(name) === 15 * ACH_SCALE, `G: [${tab.id}] "${ach.name}" name size == 15*ACH_SCALE`);
      assert(!!desc && fontSize(desc) === 10 * ACH_SCALE, `G: [${tab.id}] "${ach.name}" description size == 10*ACH_SCALE`);
    });
  });
  assert(tieredSeen > 0, `G: the tiered branch really was exercised (${tieredSeen} rows)`);
  assert(plainSeen > 0, `G: the single-goal branch really was exercised (${plainSeen} rows)`);
  assert(Achievements.tierIndex(tieredAch) >= 0, "G: sanity — the seeded tiered row really is >= bronze, so the tinted status branch ran");

  // drawAchRow is width-driven, not position-hardcoded: hand it an arbitrary x/w and the three lines follow.
  const log = render(() => drawAchRow(tieredAch, 111, 222, 333));
  assert(at(log, 111, 222).length === 1 && at(log, 111 + 333, 222 + ACH_STATUS_DY).length === 1 && at(log, 111, 222 + ACH_DESC_DY).length === 1,
    "G: drawAchRow still lays out purely from its (x, ry, w) arguments — the tab rebuild only changed what it is handed");
})();

// ================= (H) Back -> titlemenu with the cursor restored =================
(function sectionH() {
  console.log("(H) back from the viewer -> \"titlemenu\", cursor on the Achievements row");
  // ⚠ CS034 P6 (FLAG-CS034-a): `confirm` no longer exits — menuAchievements() split it off from `back`
  // and it now raises the achievement-reset flow. Only `back` leaves; its behaviour here (independent of
  // the active tab and the scroll offset) is what this section was always about and is unchanged.
  for (const action of ["back"]) {
    quitToTitle();
    game.menu.index = MENU_TITLE.indexOf("Achievements");
    menuInput("confirm");
    assert(game.menu.screen === "achievements", `H: [${action}] reached the viewer from the title menu`);
    // Exit from the NON-default tab, mid-scroll: leaving must not depend on the tab or the offset.
    menuInput("right");
    menuInput("down"); menuInput("down");
    assert(tabId() === "lifetime" && game.menu.scroll > 0, `H: [${action}] exiting from the Lifetime tab, scrolled`);
    menuInput(action);
    assert(game.menu.screen === "titlemenu", `H: "${action}" from the viewer -> titlemenu (P2's destination)`);
    assert(MENU_TITLE[game.menu.index] === "Achievements", `H: [${action}] ...cursor restored to the "Achievements" row`);
    assert(game.paused === false, `H: [${action}] ...and nothing got left paused`);
  }
})();

// ================= (I) headless: AudioSys.ctx null, full cycle from the title =================
(function sectionI() {
  console.log("(I) AudioSys.ctx null -> startGame()/update(1/60) + a full open/tab-switch/scroll/close cycle from the title");
  AudioSys.ctx = null;
  noThrow(() => { startGame(); }, "I: startGame() with ctx null");
  noThrow(() => { for (let i = 0; i < 30; i++) update(1 / 60); }, "I: update(1/60) x30 with ctx null");

  noThrow(() => {
    quitToTitle();
    game.menu.index = MENU_TITLE.indexOf("Achievements");
    menuInput("confirm");
    render(drawAchievements);
    menuInput("right");
    render(drawAchievements);
    menuInput("down"); menuInput("down"); menuInput("down");
    render(drawAchievements);
    menuInput("left");
    render(drawAchievements);
    menuInput("up");
    menuInput("right"); menuInput("right");   // wrap all the way round
    render(drawAchievements);
    menuInput("back");
  }, "I: a full open/tab-switch/scroll/close cycle from the title never throws");
  assert(game.menu.screen === "titlemenu", "I: ...and it ended back on the title menu");

  // The scroll/tab pair stays coherent through a hammering of every action, including unknown ones.
  noThrow(() => {
    gotoScreen("achievements", 0);
    for (const a of ["up", "down", "left", "right", "options", "shoot", "pause"]) {
      if (a === "pause") continue; // pause closes the menu; covered by the existing menu suites
      menuAchievements(a);
      render(drawAchievements);
    }
  }, "I: hammering every action (including an unknown one) never throws");
  assert(game.menu.scroll >= 0 && game.menu.scroll <= achMaxScroll(), "I: ...and scroll stayed inside [0, achMaxScroll()]");
})();

console.log(`\ntest-cs016-p5: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
