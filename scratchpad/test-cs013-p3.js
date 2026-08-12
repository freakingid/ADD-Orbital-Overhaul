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
// CS016 P5 MIGRATION: the viewer became TWO TABS (Weekly / Lifetime) down a SINGLE full-width column
// instead of three 350px columns. Every assertion below keeps its original INTENT — sizes, contrast,
// the clip bracket, the scroll clamp — and only the positional expectations the new layout genuinely
// invalidates were repointed: the row x is ACH_COL_X (was xL/xM/xR), the row width is ACH_COL_W (was
// a hardcoded 350), the three COLOR.satellite column headers became two selected/idle tab labels, and
// each section now runs across BOTH tabs rather than across three columns of one render. Coverage went
// up, not down. Tab BEHAVIOUR itself (switching, wrap, per-tab ceilings) is scratchpad/test-cs016-p5.js.
//
// Sections:
//  (A) node --check on the extracted <script>.
//  (B) Sizes: every achievement fillText size == the pre-P3 size * ACH_SCALE; row-to-row step ==
//      ACH_ROW_STEP; the description sits at ry+ACH_DESC_DY under its name — checked on BOTH tabs,
//      plus the tab header's own size and selected/idle contrast.
//  (C) Contrast: description and locked/incomplete progress read COLOR.menuIdle (tiered AND
//      non-tiered rows); an unlocked non-tiered row's name/readout read COLOR.ach; tier tints on a
//      tiered row's name/status are unaffected by this phase. Both tabs.
//  (D) Clip bracket: a save -> beginPath -> rect -> clip -> ...the active tab's row fillTexts... ->
//      restore sequence appears in the log, in that order; the panel title, subtitle, tab header, and
//      footer draw OUTSIDE that bracket (before save or after restore). Both tabs.
//  (E) Scroll: on the Lifetime tab (20 rows, no longer halved across two columns) achMaxScroll() > 0;
//      menuAchievements("down") increases game.menu.scroll and clamps at maxScroll; "up" decreases and
//      clamps at 0; the ▲/▼ cue fillTexts are logged only while there's room to scroll that direction;
//      the Weekly tab's 5 rows fit, so its ceiling is 0 and no cue is drawn at all; forcing a short
//      LIFETIME (2 entries) drives the Lifetime tab's ceiling to 0 too. gotoScreen("achievements", ...)
//      resets scroll to 0 on every entry.
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
  "ACH_ROW_STEP", "MENU_HINT_SIZE", "MENU_OPTIONS", "drawAchievements", "drawAchRow", "AudioSys", "VIEW_W", "VIEW_H",
  // CS016 P5: the two-tab layout's own symbols.
  "ACH_TABS", "ACH_TAB_DEFAULT", "ACH_COL_X", "ACH_COL_W", "ACH_TAB_STEP", "ACH_TAB_Y", "ACH_HINT", "achTabIndex",
  // CS026 P6 (gate Q8): the row-0 baseline is now IMPORTED rather than re-derived (see below), and the
  // selected tab wears a mark.
  "ACH_ROW0_Y", "ACH_TAB_MARK"
];
const factory = new Function(
  "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
  scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
);
const A = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
const {
  startGame, update, game, gotoScreen, menuAchievements, achMaxScroll,
  Achievements, COLOR, TIER_COLOR, ACH_SCALE, ACH_SCROLL_STEP, ACH_STATUS_DY, ACH_DESC_DY,
  ACH_ROW_STEP, MENU_HINT_SIZE, MENU_OPTIONS, drawAchievements, drawAchRow, AudioSys, VIEW_W, VIEW_H,
  ACH_TABS, ACH_TAB_DEFAULT, ACH_COL_X, ACH_COL_W, ACH_TAB_STEP, ACH_TAB_Y, ACH_HINT, achTabIndex,
  ACH_ROW0_Y, ACH_TAB_MARK
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
// ⛔ CS026 P6 (gate Q8.2): `ry0` was the literal `py + 130` and that is why this file lost 233
// assertions the moment ACH_ROW0_Y moved to +152. The rest of this block is deliberately re-derived
// rather than imported (a geometry regression should surface as a position mismatch), but row 0's
// baseline is the ONE value the viewer's own answer to a playtest note moves, so re-deriving it was
// pinning the look-call rather than the geometry. It is imported now; `py` is still local and still
// cross-checks the panel's own maths.
const ry0 = ACH_ROW0_Y, step = ACH_ROW_STEP; // CS015 P2: was a bare 40*ACH_SCALE pre-P2; now the real (bumped) row step
// The selected tab's label carries ACH_TAB_MARK (CS026 P6, gate Q8.1), so every label match in this
// file has to accept either form. Exact-match both ways — never startsWith(), which the panel's own
// "WEEKLY SET ..." subtitle would satisfy first.
const isTabLabel = str => ACH_TABS.some(t => t.label === str || t.label + ACH_TAB_MARK === str);
const tabEntry = (log, label) => log.find(e => e.c === "fillText" && (e.str === label || e.str === label + ACH_TAB_MARK));

// CS016 P5: enter the viewer with a specific tab active, driving the REAL handler — gotoScreen always
// lands on Weekly, so reaching Lifetime means pressing "right" exactly as a player would. No direct
// poke at game.menu.achTab anywhere in this file.
function openTab(id) {
  gotoScreen("achievements", 0);
  for (let i = 0; i < ACH_TABS.length && ACH_TABS[achTabIndex()].id !== id; i++) menuAchievements("right");
  assert(ACH_TABS[achTabIndex()].id === id, `openTab: reached the "${id}" tab by pressing right`);
}
const statusSizeFor = ach => (ach.tiers ? 13 : 14) * ACH_SCALE;

// ================= (B) sizes + step + description offset =================
// CS015 P2 note: name/status no longer share row i's baseline — status moved to ry+ACH_STATUS_DY and
// desc to ry+ACH_DESC_DY (was a bare ry+22), and the row step itself grew to fit the extra line. The
// dedicated geometry regression test for that phase is scratchpad/test-cs015-p2.js; this section keeps
// verifying sizes/positions still track the real (now CS015-P2) symbols, not a re-pin of old numbers.
(function sectionB() {
  console.log("(B) sizes == pre-P3 * ACH_SCALE; step == ACH_ROW_STEP; description at ry+ACH_DESC_DY (both tabs)");
  assert(ACH_SCALE === 1.5, "B: ACH_SCALE is 1.5 (got " + ACH_SCALE + ")");
  assert(step === ACH_ROW_STEP, "B: row step is the real ACH_ROW_STEP (got " + step + ")");
  assert(ACH_COL_X === px + 30, `B: the single column's left edge is the old xL (px+30, got ${ACH_COL_X})`);
  assert(ACH_COL_W === 1200 - 60, `B: the single column is full panel width less a 30px gutter each side (got ${ACH_COL_W})`);
  assert(ACH_COL_W > 350 * 3, `B: CS013 P3's colW=350 complaint is resolved — the column is now wider than all three old ones (${ACH_COL_W})`);
  game.state = "playing";
  resetAch();

  ACH_TABS.forEach((tab, ti) => {
    openTab(tab.id);
    const log = render(drawAchievements);

    // Tab header (CS016 P5, replacing the three COLOR.satellite column headers): same 15*ACH_SCALE
    // size, now carrying the established selected/idle colour convention.
    ACH_TABS.forEach((t, i) => {
      // CS026 P6 (gate Q8.1): the SELECTED tab's label carries ACH_TAB_MARK, so match either form.
      const hit = at(log, ACH_COL_X + i * ACH_TAB_STEP, py + ACH_TAB_Y)
        .find(e => e.str === t.label || e.str === t.label + ACH_TAB_MARK);
      assert(!!hit, `B: [${tab.id}] tab label "${t.label}" logs a fillText at its expected position`);
      assert(!!hit && fontSize(hit) === 15 * ACH_SCALE, `B: [${tab.id}] tab label "${t.label}" size == 15*ACH_SCALE`);
      // ...and the mark is on the ACTIVE tab only — additive to, never a replacement for, the colour split.
      assert(!!hit && (hit.str === t.label + ACH_TAB_MARK) === (i === ti),
        `B: [${tab.id}] tab label "${t.label}" wears ACH_TAB_MARK iff it is the active tab`);
      assert(!!hit && hit.color === (i === ti ? COLOR.text : COLOR.menuIdle),
        `B: [${tab.id}] tab label "${t.label}" reads ${i === ti ? "COLOR.text (active)" : "COLOR.menuIdle (idle)"}`);
    });
    // Subtitle: size 12*ACH_SCALE, unchanged.
    const sub = log.find(e => e.c === "fillText" && /^WEEKLY SET/.test(e.str));
    assert(!!sub && sub.x === cx && sub.y === py + 74, `B: [${tab.id}] subtitle logs at (cx, py+74)`);
    assert(!!sub && fontSize(sub) === 12 * ACH_SCALE, `B: [${tab.id}] subtitle size == 12*ACH_SCALE`);

    // The ACTIVE tab's rows, one full-width column, unscrolled (gotoScreen/tab switch both zero it).
    tab.rows().forEach((ach, i) => {
      const ry = ry0 + i * step;
      const name = at(log, ACH_COL_X, ry).find(e => e.str === ach.name);
      assert(!!name, `B: [${tab.id}] row ${i} ("${ach.name}") name at its expected (ACH_COL_X, ry)`);
      assert(!!name && fontSize(name) === 15 * ACH_SCALE, `B: [${tab.id}] row ${i} name size == 15*ACH_SCALE`);
      const desc = at(log, ACH_COL_X, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
      assert(!!desc, `B: [${tab.id}] row ${i} description at ry+ACH_DESC_DY`);
      assert(!!desc && fontSize(desc) === 10 * ACH_SCALE, `B: [${tab.id}] row ${i} description size == 10*ACH_SCALE`);
      const readout = at(log, ACH_COL_X + ACH_COL_W, ry + ACH_STATUS_DY);
      assert(readout.length === 1, `B: [${tab.id}] row ${i} has exactly one readout fillText at (x+ACH_COL_W, ry+ACH_STATUS_DY)`);
      assert(readout.length === 1 && fontSize(readout[0]) === statusSizeFor(ach),
        `B: [${tab.id}] row ${i} readout size == ${statusSizeFor(ach)} (tiers=${!!ach.tiers})`);
    });

    // Footer: routed through drawMenuHint -> MENU_HINT_SIZE / COLOR.menuIdle, at the unchanged y.
    const footer = log.find(e => e.c === "fillText" && e.str === ACH_HINT);
    assert(!!footer && footer.x === cx && footer.y === py + 644, `B: [${tab.id}] footer logs at (cx, py+644)`);
    assert(!!footer && fontSize(footer) === MENU_HINT_SIZE, `B: [${tab.id}] footer size == MENU_HINT_SIZE (drawMenuHint)`);
  });

  // The pools really are different sizes — so the per-tab loop above isn't quietly testing one thing twice.
  assert(Achievements.activeWeekly().length !== Achievements.LIFETIME.length,
    "B: the two tabs carry genuinely different row counts (5 weekly vs. 20 lifetime)");
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

  // Both tabs: the weekly one carries the unlocked non-tiered row, the lifetime one both branches.
  ACH_TABS.forEach(tab => {
    openTab(tab.id);
    const log = render(drawAchievements);

    tab.rows().forEach((ach, i) => {
      const ry = ry0 + i * step;
      const desc = at(log, ACH_COL_X, ry + ACH_DESC_DY).find(e => e.str === ach.desc);
      assert(!!desc && desc.color === COLOR.menuIdle, `C: [${tab.id}] "${ach.name}" description always reads menuIdle`);
      const name = at(log, ACH_COL_X, ry).find(e => e.str === ach.name);
      const status = at(log, ACH_COL_X + ACH_COL_W, ry + ACH_STATUS_DY)[0];
      if (ach.tiers) {
        const idx = Achievements.tierIndex(ach);
        const expectCol = idx >= 0 ? TIER_COLOR[idx] : COLOR.text;
        assert(!!name && name.color === expectCol, `C: tiered "${ach.name}" name reads its tier tint (or COLOR.text pre-bronze) — unaffected by P3/P5`);
        assert(!!status && status.color === (idx >= 0 ? expectCol : COLOR.menuIdle), `C: tiered "${ach.name}" status is tier-tinted once >=bronze, else menuIdle`);
      } else {
        const done = ach.id === unlockedWeeklyId || Achievements.isUnlocked(ach);
        assert(!!name && name.color === (done ? COLOR.ach : COLOR.text), `C: non-tiered "${ach.name}" name color matches unlocked state`);
        assert(!!status && status.color === (done ? COLOR.ach : COLOR.menuIdle), `C: non-tiered "${ach.name}" readout is ach-when-done / menuIdle-when-locked`);
      }
    });
  });

  // Both drawAchRow branches and both unlock states really were exercised above.
  assert(Achievements.activeWeekly().some(a => a.id === unlockedWeeklyId), "C: sanity — an unlocked weekly row was in the rendered pool");
  assert(Achievements.LIFETIME.some(a => a.tiers) && Achievements.LIFETIME.some(a => !a.tiers),
    "C: sanity — the lifetime tab carries both a tiered and a plain row");
})();

// ================= (D) clip bracket =================
(function sectionD() {
  console.log("(D) save->beginPath->rect->clip->...the active tab's row fillTexts...->restore; chrome draws outside it");
  game.state = "playing";
  resetAch();

  ACH_TABS.forEach(tab => {
    openTab(tab.id);
    const log = render(drawAchievements);

    const idx = c => log.findIndex(e => e.c === c);
    const saveIdx = idx("save"), beginIdx = idx("beginPath"), rectIdx = idx("rect"), clipIdx = idx("clip"), restoreIdx = idx("restore");
    assert([saveIdx, beginIdx, rectIdx, clipIdx, restoreIdx].every(i => i >= 0), `D: [${tab.id}] save/beginPath/rect/clip/restore all appear in the log`);
    assert(saveIdx < beginIdx && beginIdx < rectIdx && rectIdx < clipIdx && clipIdx < restoreIdx, `D: [${tab.id}] they appear in save->beginPath->rect->clip->restore order`);

    const rowFillTexts = log.slice(clipIdx + 1, restoreIdx).filter(e => e.c === "fillText");
    const expectedRows = tab.rows().length; // CS016 P5: ONLY the active tab's rows are drawn (was 5 + 20 together)
    assert(rowFillTexts.length === expectedRows * 3, `D: [${tab.id}] exactly ${expectedRows * 3} row fillTexts (name+status+desc x ${expectedRows}) inside the clip (got ${rowFillTexts.length})`);

    const titleEntry = log.find(e => e.c === "fillText" && e.str === "ACHIEVEMENTS");
    const headerEntries = log.filter(e => e.c === "fillText" && isTabLabel(e.str));
    const subtitleEntry = log.find(e => e.c === "fillText" && /^WEEKLY SET/.test(e.str));
    const footerEntry = log.find(e => e.c === "fillText" && e.str === ACH_HINT);
    assert(headerEntries.length === ACH_TABS.length, `D: [${tab.id}] both tab labels are drawn (got ${headerEntries.length})`);
    [titleEntry, subtitleEntry, footerEntry, ...headerEntries].forEach(e => {
      const i = log.indexOf(e);
      assert(i >= 0 && (i < saveIdx || i > restoreIdx), `D: [${tab.id}] chrome fillText "${e && e.str}" draws outside the save/restore bracket`);
    });
    assert(log.indexOf(titleEntry) < saveIdx, `D: [${tab.id}] the panel title draws before the clip (via menuPanel, unchanged)`);
    headerEntries.forEach(e => assert(log.indexOf(e) < saveIdx, `D: [${tab.id}] the tab label "${e.str}" draws before the clip`));
    assert(log.indexOf(footerEntry) > restoreIdx, `D: [${tab.id}] the footer draws after restore (unscrolled chrome)`);
  });
})();

// ================= (E) scroll =================
(function sectionE() {
  console.log("(E) the Lifetime tab's achMaxScroll() > 0; up/down clamp; the ▲/▼ cue tracks maxScroll; the Weekly tab fits; gotoScreen resets scroll");
  game.state = "playing";
  resetAch();

  // CS016 P5: the scrolling tab is Lifetime — its 20 rows are no longer halved across two columns.
  openTab("lifetime");
  const maxScroll = achMaxScroll();
  assert(maxScroll > 0, `E: achMaxScroll() > 0 on the Lifetime tab with the real 20-entry LIFETIME (got ${maxScroll})`);
  assert(game.menu.scroll === 0, "E: entering the Lifetime tab starts unscrolled");

  // down increases, clamped at maxScroll.
  menuAchievements("down");
  assert(game.menu.scroll === Math.min(maxScroll, ACH_SCROLL_STEP), `E: one "down" advances scroll by ACH_SCROLL_STEP, clamped (got ${game.menu.scroll})`);
  for (let i = 0; i < 40; i++) menuAchievements("down"); // hammer past the ceiling
  assert(game.menu.scroll === maxScroll, `E: repeated "down" clamps at maxScroll (got ${game.menu.scroll}, max ${maxScroll})`);
  let log = render(drawAchievements);
  let up = log.find(e => e.c === "fillText" && e.str === "▲");
  let down = log.find(e => e.c === "fillText" && e.str === "▼");
  assert(!!up, "E: at max scroll, the ▲ cue is shown (there's content above)");
  assert(!down, "E: at max scroll, the ▼ cue is hidden (nothing further below)");
  assert(!!up && up.color === COLOR.menuIdle, "E: the ▲ cue reads COLOR.menuIdle");

  // up decreases, clamped at 0.
  for (let i = 0; i < 40; i++) menuAchievements("up"); // hammer past the floor
  assert(game.menu.scroll === 0, `E: repeated "up" clamps at 0 (got ${game.menu.scroll})`);
  log = render(drawAchievements);
  up = log.find(e => e.c === "fillText" && e.str === "▲");
  down = log.find(e => e.c === "fillText" && e.str === "▼");
  assert(!up, "E: at scroll 0, the ▲ cue is hidden (nothing above)");
  assert(!!down, "E: at scroll 0, the ▼ cue is shown (there's content below)");

  // The Weekly tab's 5 rows fit inside ACH_ROW_VISIBLE_H -> ceiling 0, no cue at all, and up/down are
  // inert. (Pre-P5 the ceiling was shared across all three columns, so this case couldn't be expressed.)
  openTab(ACH_TAB_DEFAULT);
  assert(achMaxScroll() === 0, `E: the Weekly tab's 5 rows fit -> achMaxScroll() 0 (got ${achMaxScroll()})`);
  for (let i = 0; i < 5; i++) menuAchievements("down");
  assert(game.menu.scroll === 0, `E: "down" on a tab with nothing to scroll leaves scroll at 0 (got ${game.menu.scroll})`);
  log = render(drawAchievements);
  assert(!log.find(e => e.c === "fillText" && (e.str === "▲" || e.str === "▼")), "E: with maxScroll 0, neither cue is logged");

  // A short LIFETIME drives the Lifetime tab's ceiling to 0 too — the ceiling is derived from the live
  // row count, not a hardcoded pixel total.
  const fullLifetime = Achievements.LIFETIME;
  Achievements.LIFETIME = fullLifetime.slice(0, 2);
  openTab("lifetime"); // re-enter so scroll is freshly 0 against the new (smaller) ceiling
  assert(achMaxScroll() === 0, `E: a short LIFETIME (2 entries) drives the Lifetime tab's achMaxScroll() to 0 (got ${achMaxScroll()})`);
  log = render(drawAchievements);
  assert(!log.find(e => e.c === "fillText" && (e.str === "▲" || e.str === "▼")), "E: with maxScroll 0, neither cue is logged (short LIFETIME)");
  Achievements.LIFETIME = fullLifetime; // restore for any later section

  // gotoScreen resets scroll on every entry, not just the first.
  openTab("lifetime");
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
    menuAchievements("right");   // CS016 P5: tab switching is part of the cycle now
    menuAchievements("down"); menuAchievements("down"); menuAchievements("down");
    render(drawAchievements);
    menuAchievements("up");
    menuAchievements("left");
    render(drawAchievements);
    menuAchievements("back");
  }, "F: a full open/tab-switch/scroll/close cycle renders without throwing");
  game.state = "gameover";
  noThrow(() => { gotoScreen("achievements", 0); render(drawAchievements); menuAchievements("confirm"); }, "F: the same cycle from gameover never throws");
})();

console.log(`\ntest-cs013-p3: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
