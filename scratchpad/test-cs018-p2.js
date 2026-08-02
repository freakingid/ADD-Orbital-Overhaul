// Headless test for CS018 Phase P2 — the hidden Debug Options panel made usable at 32 registry entries:
// a viewport-safe FIXED panel height with a scrolling row window, non-selectable section headers skipped by
// up/down, and keyboard direct numeric entry committed through the existing applyDebug + saveSettings path.
//
//   node scratchpad/test-cs018-p2.js
//
// Follows the standing rule (GDD 5.4): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL DEBUG_ROWS/menuDebug()/drawDebug()/enterDebug()/debugEntry*() and the
// REAL keydown listener — never reimplement game logic. Modelled on scratchpad/test-cs015-p4.js's harness.
//
// The pre-P2 bug this phase fixes is asserted directly (section B): `h = 220 + (N + 1) * 46` is 818 px at
// N = 12 against VIEW_H 720, so the old panel's control hint rendered BELOW the canvas.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = process.env.CS018_HTML || path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const mm = html.match(/<script>([\s\S]*?)<\/script>/);
if (!mm) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = mm[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }

// ================= (A) syntax =====================
(function sectionA() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(repoRoot, "scratchpad", "_cs018p2_extracted.js");
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

function makeCtx(canvasStub) {
  return new Proxy({}, {
    get(t, prop) {
      if (prop === "measureText") return () => ({ width: 0 });
      if (prop === "canvas") return canvasStub;
      if (prop === "createLinearGradient" || prop === "createRadialGradient") return () => ({ addColorStop: () => {} });
      return () => {};
    },
    set() { return true; }
  });
}

function makeAudioProxy() {
  let proxy;
  proxy = new Proxy(function () {}, {
    get(t, prop) {
      if (prop === "currentTime") return 0;
      if (prop === "value") return 0;
      if (prop === "state") return "running";
      if (prop === "gain" || prop === "frequency" || prop === "destination") return proxy;
      return () => proxy;
    },
    set() { return true; }
  });
  return proxy;
}

const RETURN = [
  "startGame", "update", "loop", "game", "settings",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DebugPanel", "applyDebug",
  "saveSettings", "loadSettings", "STORAGE_KEY",
  "DebugCode", "DEBUG_CODE",
  "openDebug", "enterDebug", "gotoScreen", "menuDebug", "drawDebug", "drawMenu", "debugReturn", "menuInput",
  "debugFirstRow", "debugStep", "debugSelectedVar", "debugScrollTop",
  "debugEntryActive", "debugEntryKey", "debugEntryCommit", "debugEntryCancel", "DEBUG_ENTRY_CHARS",
  "VIEW_W", "VIEW_H", "DEBUG_PANEL_W", "DEBUG_PANEL_H", "DEBUG_ROW_STEP", "DEBUG_ROWS_VISIBLE",
  "DEBUG_ROWS_Y", "DEBUG_FOOTER_H", "DEBUG_VALUE_X", "DEBUG_ENTRY_MAXLEN", "MENU_HINT_SIZE",
  "AudioSys"
];

function build({ audio = false, storage = null } = {}) {
  const canvasStub = { width: 1280, height: 720, style: {} };
  canvasStub.getContext = () => makeCtx(canvasStub);
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const audioProxy = audio ? makeAudioProxy() : null;
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? function () { return audioProxy; } : undefined,
    webkitAudioContext: undefined
  };
  let clock = 100000;
  const performanceStub = { now: () => clock };
  const rafStub = () => 0;
  const navigatorStub = { getGamepads: () => [] };
  const lsStore = {};
  if (storage) for (const k in storage) lsStore[k] = storage[k];
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const exports = factory(windowStub, documentStub, performanceStub, rafStub, navigatorStub, localStorageStub);
  return { exports, listeners, lsStore, setClock: v => { clock = v; }, addClock: d => { clock += d; }, getClock: () => clock };
}

function ev(key, repeat) { return { key, repeat: !!repeat, preventDefault() {} }; }
const CODE_KEYS = ["E", "v", "i", "l", "G", "3", "n", "i", "u", "$"];

// Put an instance on the debug screen the way the game does (through the real entry point).
function onDebug(A, { playing = false } = {}) {
  const g = A.game;
  if (playing) { g.state = "playing"; g.paused = true; g.menu.screen = "root"; }
  else { g.state = "title"; g.paused = false; g.menu.screen = "titlemenu"; }
  g.menu.rebinding = null; g.menu.modal = null; g.entry = null;
  A.DebugCode.armed = false; A.DebugCode.buf = "";
  A.enterDebug();
  return g;
}

// ================= (B) the pre-P2 overflow bug, and that P2's geometry fixes it =================
(function sectionB() {
  console.log("(B) panel geometry: the old formula overflowed VIEW_H; the new fixed height does not");
  const A = build().exports;
  const N = A.DEBUG_ENTRIES.length;

  // The bug the phase prompt asked to verify first, computed from the SAME registry the build ships.
  // REPOINTED BY CS018 P3+: the "N === 12" pin was true only at P2 and every later phase adds knobs by
  // design, so it has been replaced by the claim that actually matters and stays true — the old formula
  // overflows the viewport AT THE LIVE REGISTRY SIZE, whatever that size is, and gets worse as it grows.
  const oldH = 220 + (N + 1) * 46;
  assert(N >= 12, `B: the registry has at least P2's 12 value entries (got ${N})`);
  assert(220 + (12 + 1) * 46 === 818, "B: (historical) the pre-P2 formula gave 818px at P2's N=12");
  assert(oldH > A.VIEW_H, `B: the old formula gives ${oldH}px > VIEW_H ${A.VIEW_H} — it overflowed the viewport`);
  const oldY = (A.VIEW_H - oldH) / 2;
  assert(oldY < 0, `B: the old panel's top edge sat off-screen at y=${oldY}`);
  assert(oldY + oldH - 30 > A.VIEW_H, `B: the old control hint baseline (${oldY + oldH - 30}) was below the canvas`);
  const wouldBe32 = 220 + (32 + 1) * 46;
  assert(wouldBe32 === 1738, `B: at CS018's 32 entries the old formula would give 1738px (got ${wouldBe32})`);

  // The replacement: fixed, derived, viewport-safe — and it does NOT grow with the registry.
  assert(A.DEBUG_PANEL_H === A.DEBUG_ROWS_Y + A.DEBUG_ROWS_VISIBLE * A.DEBUG_ROW_STEP + A.DEBUG_FOOTER_H,
    "B: DEBUG_PANEL_H is DERIVED from DEBUG_ROWS_VISIBLE (one knob, footer can't be pushed off)");
  assert(A.DEBUG_PANEL_H === 640, `B: the derived panel height is 640px (got ${A.DEBUG_PANEL_H})`);
  assert(A.DEBUG_PANEL_H <= A.VIEW_H, `B: 640 <= VIEW_H ${A.VIEW_H}`);
  const y = (A.VIEW_H - A.DEBUG_PANEL_H) / 2;
  assert(y >= 0, `B: the panel's top edge is on-screen (y=${y})`);
  assert(y + A.DEBUG_PANEL_H <= A.VIEW_H, "B: the panel's bottom edge is on-screen");
  const hintY = y + A.DEBUG_PANEL_H - 30, indY = y + A.DEBUG_PANEL_H - 58;
  assert(hintY <= A.VIEW_H, `B: the control hint baseline (${hintY}) is inside the canvas`);
  assert(hintY === 650 && indY === 622, `B: hint at 650, position indicator at 622 (got ${hintY}, ${indY})`);
  // The last row's baseline must clear the footer band it sits above.
  const lastRowY = y + A.DEBUG_ROWS_Y + (A.DEBUG_ROWS_VISIBLE - 1) * A.DEBUG_ROW_STEP + 6;
  assert(lastRowY < indY, `B: the bottom visible row (${lastRowY}) sits above the indicator (${indY})`);
  assert(A.DEBUG_PANEL_W === 660 && (A.VIEW_W - A.DEBUG_PANEL_W) / 2 === 310, "B: panel is 660 wide, centered at x=310");
  assert(A.DEBUG_VALUE_X < A.DEBUG_PANEL_W - 140,
    "B: the value column + its ► chevron (ox+120) still fits inside the panel width");
})();

// ================= (C) the row model is DERIVED from the registry ==============================
(function sectionC() {
  console.log("(C) DEBUG_ROWS derives every index from DEBUG_VARS — headers + Dump + Back, no literals");
  const A = build().exports;
  const rows = A.DEBUG_ROWS, vars = A.DEBUG_VARS;

  // REPOINTED BY CS018 P3+: the header count and total row count were pinned at P2's registry size; later
  // phases add both knobs and sections by design. What is asserted now is the STRUCTURAL invariant, which
  // is what the section was ever really about: every index derives from the registry.
  const headers = vars.filter(v => v.header).length;
  assert(headers >= 4, `C: the registry declares at least P2's 4 section headers (got ${headers})`);
  assert(vars.every(v => !!v.header !== !!v.id), "C: every registry entry is either a header or a value entry, never both");
  assert(A.DEBUG_ENTRIES.length === vars.length - headers, "C: DEBUG_ENTRIES is the registry minus its headers");
  assert(rows.length === vars.length + 2, `C: DEBUG_ROWS = registry + Dump + Back (${rows.length} = ${vars.length} + 2)`);

  // Row order mirrors the registry exactly, then the two trailing action rows.
  let ok = true;
  vars.forEach((v, i) => {
    const r = rows[i];
    if (v.header) { if (r.kind !== "header" || r.label !== v.header) ok = false; }
    else if (r.kind !== "var" || r.e !== v || r.label !== v.label) ok = false;
  });
  assert(ok, "C: every registry entry maps to its row in order (header rows carry the label, var rows the entry)");
  assert(rows[rows.length - 2].kind === "action" && rows[rows.length - 2].label === "Dump difficulty log",
    "C: the Dump action is the second-to-last row");
  assert(rows[rows.length - 1].kind === "back" && rows[rows.length - 1].label === "Back",
    "C: Back is the last row");
  assert(rows.filter(r => r.kind === "var").length === A.DEBUG_ENTRIES.length,
    "C: exactly one var row per value entry");
  assert(rows.every(r => r.kind !== "var" || (r.e && typeof r.e.id === "string")),
    "C: every var row carries a real registry entry with an id");
  assert(rows[0].kind === "header", "C: (the interesting case) row 0 is a HEADER, so index 0 is not a valid cursor");

  // Header entries must not have leaked into either persistence map.
  assert(!("undefined" in A.debugShown) && !(undefined in A.debugShown),
    "C: no header seeded debugShown[undefined] (DEBUG_ENTRIES gates the seed loop)");
  assert(Object.keys(A.debugShown).length === A.DEBUG_ENTRIES.length,
    `C: debugShown holds exactly one key per value entry (${Object.keys(A.debugShown).length})`);
  assert(Object.keys(A.DEBUG).length === A.DEBUG_ENTRIES.length, "C: same for the native DEBUG map");
  assert(A.DEBUG_ENTRIES.every(e => A.debugShown[e.id] === e.def), "C: every value entry seeded from its own def");
})();

// ================= (D) navigation: headers skipped, first + last row reachable, wraparound =====
(function sectionD() {
  console.log("(D) up/down skip headers entirely; the first and last rows are both reachable; wrap both ways");
  const A = build().exports;
  const g = onDebug(A);
  const rows = A.DEBUG_ROWS, ROWS = rows.length;
  const selectable = rows.map((r, i) => r.kind !== "header" ? i : -1).filter(i => i >= 0);

  assert(g.menu.screen === "debug", "D: enterDebug put us on the debug screen");
  assert(g.menu.index === A.debugFirstRow(), "D: the cursor lands on the first SELECTABLE row, not row 0");
  assert(rows[g.menu.index].kind !== "header", "D: ...which is not a header");
  assert(g.menu.index === 1, `D: concretely, row 1 (row 0 is the SHIP header) — got ${g.menu.index}`);

  // A full lap down visits every selectable row exactly once, in order, and never a header.
  const seen = [g.menu.index];
  for (let k = 1; k < selectable.length; k++) {
    A.menuDebug("down");
    assert(rows[g.menu.index].kind !== "header", `D: down never lands on a header (step ${k}, index ${g.menu.index})`);
    seen.push(g.menu.index);
  }
  assert(JSON.stringify(seen) === JSON.stringify(selectable),
    `D: one lap down visits every selectable row in order\n    got  ${seen}\n    want ${selectable}`);
  assert(g.menu.index === ROWS - 1, `D: the LAST row (Back, index ${ROWS - 1}) is reachable — got ${g.menu.index}`);
  assert(rows[g.menu.index].kind === "back", "D: ...and it is the Back row");
  assert(rows[g.menu.index - 1].kind === "action", "D: the Dump row is reachable, one above Back");

  // Wrap forward: last -> first selectable (never row 0, the header).
  A.menuDebug("down");
  assert(g.menu.index === A.debugFirstRow(), "D: down from the last row wraps to the first SELECTABLE row");
  assert(g.menu.index !== 0, "D: the wrap skips the leading header rather than landing on it");

  // Wrap backward: first selectable -> last row.
  A.menuDebug("up");
  assert(g.menu.index === ROWS - 1, "D: up from the first row wraps to the last row (Back)");

  // A full lap up visits the same set.
  const seenUp = [g.menu.index];
  for (let k = 1; k < selectable.length; k++) { A.menuDebug("up"); seenUp.push(g.menu.index); }
  assert(JSON.stringify(seenUp.slice().sort((a, b) => a - b)) === JSON.stringify(selectable),
    "D: one lap up visits exactly the same selectable set");
  assert(seenUp.every(i => rows[i].kind !== "header"), "D: up never lands on a header either");

  // Many laps: the invariant holds indefinitely, in both directions.
  let headerHits = 0;
  for (let k = 0; k < 500; k++) { A.menuDebug(k % 3 === 0 ? "up" : "down"); if (rows[g.menu.index].kind === "header") headerHits++; }
  assert(headerHits === 0, `D: 500 mixed moves never selected a header (got ${headerHits})`);

  // debugStep is the primitive, and it is header-free from ANY starting row — including from a header index,
  // which is what defends the cursor if some future reset writes a raw 0.
  let stepOk = true;
  for (let from = 0; from < ROWS; from++) for (const dir of [1, -1]) {
    const to = A.debugStep(from, dir);
    if (rows[to].kind === "header") stepOk = false;
  }
  assert(stepOk, "D: debugStep returns a non-header row from every index in both directions");
  assert(A.debugStep(0, 1) === 1, "D: debugStep(header, +1) advances to the row it labels");
  assert(A.debugStep(0, -1) === ROWS - 1, "D: debugStep(header, -1) wraps to the last row");
})();

// ================= (E) the scroll window always contains the selection ========================
(function sectionE() {
  console.log("(E) the scroll window follows the selection both directions, incl. the last→first wrap");
  const A = build().exports;
  const g = onDebug(A);
  const ROWS = A.DEBUG_ROWS.length, VIS = A.DEBUG_ROWS_VISIBLE;
  const maxTop = Math.max(0, ROWS - VIS);

  assert(ROWS > VIS, `E: (precondition) 18 rows vs a ${VIS}-row window, so scrolling is actually exercised`);
  assert(A.DebugPanel.scroll === 0, "E: entering the panel starts unscrolled");

  function windowOK(where) {
    const top = A.debugScrollTop();
    assert(top >= 0 && top <= maxTop, `E: scroll top in [0,${maxTop}] ${where} (got ${top})`);
    assert(g.menu.index >= top && g.menu.index < top + VIS,
      `E: the selection (${g.menu.index}) is inside the window [${top},${top + VIS}) ${where}`);
  }

  // Walk all the way down, checking the invariant at every stop.
  windowOK("on entry");
  for (let k = 0; k < ROWS + 4; k++) { A.menuDebug("down"); windowOK(`after ${k + 1} downs`); }
  // ...and all the way back up.
  for (let k = 0; k < ROWS + 4; k++) { A.menuDebug("up"); windowOK(`after ${k + 1} ups`); }

  // The two extremes concretely: the last row must be the window's bottom, the first its top.
  g.menu.index = ROWS - 1; A.debugScrollTop();
  assert(A.DebugPanel.scroll === maxTop, `E: on the last row the window is scrolled to the end (${maxTop})`);
  A.menuDebug("down");  // wrap to the first selectable row
  assert(A.debugScrollTop() === 0, "E: wrapping to the first row scrolls the window back to the top");
  assert(g.menu.index < VIS, "E: ...and the first row is visible in that window");

  // Selecting any row from cold (a stale scroll offset) still brings it into view.
  for (let i = 0; i < ROWS; i++) {
    if (A.DEBUG_ROWS[i].kind === "header") continue;
    A.DebugPanel.scroll = maxTop;          // deliberately stale, pointing at the far end
    g.menu.index = i;
    const top = A.debugScrollTop();
    assert(i >= top && i < top + VIS, `E: row ${i} pulled into view from a stale bottom offset (top=${top})`);
    A.DebugPanel.scroll = 0;               // stale the other way
    const top2 = A.debugScrollTop();
    assert(i >= top2 && i < top2 + VIS, `E: row ${i} pulled into view from a stale top offset (top=${top2})`);
  }

  // A section header is kept visible with the first value row under it.
  for (let i = 1; i < ROWS; i++) {
    if (A.DEBUG_ROWS[i].kind === "header" || A.DEBUG_ROWS[i - 1].kind !== "header") continue;
    A.DebugPanel.scroll = maxTop;
    g.menu.index = i;
    const top = A.debugScrollTop();
    assert(top <= i - 1, `E: the header above row ${i} is inside the window too (top=${top})`);
  }

  // debugScrollTop is idempotent — calling it twice (nav press then draw) can't creep.
  g.menu.index = ROWS - 1;
  const a1 = A.debugScrollTop(), a2 = A.debugScrollTop();
  assert(a1 === a2, "E: debugScrollTop is idempotent (nav + draw in the same frame agree)");
})();

// ================= (F) numeric entry: build, commit, clamp, cancel, and what it blocks =========
(function sectionF() {
  console.log("(F) numeric entry: digits build a pending value, ENTER commits + persists, ESC cancels");
  const inst = build();
  const A = inst.exports;
  const g = onDebug(A);

  // Land on a known value row.
  const target = "garbageLifetime";                       // {def:10, min:1, max:60, step:1}
  const row = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === target);
  g.menu.index = row;
  assert(A.debugSelectedVar() && A.debugSelectedVar().id === target, "F: cursor is on the Garbage lifetime row");
  assert(A.debugEntryActive() === false, "F: nothing pending to start with");

  // Typing builds the buffer without touching the live value.
  A.debugEntryKey("4"); A.debugEntryKey("2");
  assert(A.DebugPanel.entry === "42", `F: digits accrete into the pending buffer (got ${A.DebugPanel.entry})`);
  assert(A.debugEntryActive() === true, "F: an entry is pending");
  assert(A.debugShown[target] === 10, "F: the LIVE value is untouched while the entry is pending");

  // While pending, left/right must not step and back must not leave the screen.
  A.menuDebug("right"); A.menuDebug("left"); A.menuDebug("right");
  assert(A.debugShown[target] === 10, "F: left/right do not step while an entry is pending");
  assert(A.DebugPanel.entry === "42", "F: ...and do not disturb the pending digits");
  A.menuDebug("back");
  assert(g.menu.screen === "debug", "F: `back` while pending does NOT leave the screen");
  assert(A.debugEntryActive() === false, "F: ...it cancels the entry instead (ESC = cancel)");
  assert(A.debugShown[target] === 10, "F: a cancelled entry commits nothing");

  // Commit through the abstract confirm (so gamepad A behaves identically to ENTER).
  A.debugEntryKey("2"); A.debugEntryKey("5");
  A.menuDebug("confirm");
  assert(A.debugEntryActive() === false, "F: confirm clears the pending entry");
  assert(A.debugShown[target] === 25, `F: confirm committed the typed value (got ${A.debugShown[target]})`);
  assert(A.DEBUG[target] === 25, "F: ...through applyDebug, so the native map tracks it");
  assert(g.menu.screen === "debug", "F: committing does not leave the screen");

  // Clamped to the entry's own min/max on commit — never rejected, never reordered.
  A.debugEntryKey("9"); A.debugEntryKey("9"); A.debugEntryKey("9"); A.menuDebug("confirm");
  assert(A.debugShown[target] === 60, `F: an over-max entry clamps to max 60 (got ${A.debugShown[target]})`);
  A.debugEntryKey("0"); A.menuDebug("confirm");
  assert(A.debugShown[target] === 1, `F: an under-min entry clamps to min 1 (got ${A.debugShown[target]})`);

  // A typed value is exact — it is NOT snapped to `step`.
  // REPOINTED (CS018 P7): saucerAimPressure retired this phase; ufoDirChangeFreqNormal is the nearest
  // surviving fractional-step knob (def 1.3, min 0.1, max 10, step 0.1) — same demonstration, same claim.
  const frac = "ufoDirChangeFreqNormal";                  // {def:1.3, min:0.1, max:10, step:0.1}
  g.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === frac);
  for (const k of ["0", ".", "3", "7"]) A.debugEntryKey(k);
  assert(A.DebugPanel.entry === "0.37", `F: "." is accepted once (got ${A.DebugPanel.entry})`);
  A.debugEntryKey(".");
  assert(A.DebugPanel.entry === "0.37", "F: a second '.' is ignored");
  A.menuDebug("confirm");
  assert(A.debugShown[frac] === 0.37, `F: a typed decimal commits EXACTLY, not snapped to step (got ${A.debugShown[frac]})`);

  // Backspace edits; sign toggles; an empty/degenerate buffer is a no-op commit.
  for (const k of ["1", "2", "3"]) A.debugEntryKey(k);
  A.debugEntryKey("Backspace");
  assert(A.DebugPanel.entry === "12", "F: Backspace deletes the last character");
  A.debugEntryKey("-");
  assert(A.DebugPanel.entry === "-12", "F: '-' prefixes a sign");
  A.debugEntryKey("-");
  assert(A.DebugPanel.entry === "12", "F: '-' again toggles the sign back off");
  A.debugEntryKey("Backspace"); A.debugEntryKey("Backspace");
  assert(A.DebugPanel.entry === "", "F: Backspace can empty the buffer (still pending, not committed)");
  const before = A.debugShown[frac];
  A.menuDebug("confirm");
  assert(A.debugShown[frac] === before, "F: committing an EMPTY buffer changes nothing (treated as a cancel)");
  assert(A.debugEntryActive() === false, "F: ...and clears the pending state");
  A.debugEntryKey("-"); A.menuDebug("confirm");
  assert(A.debugShown[frac] === before, "F: committing a lone '-' changes nothing either");

  // Length guard: keystrokes past DEBUG_ENTRY_MAXLEN are dropped, not truncated mid-number.
  for (let i = 0; i < 20; i++) A.debugEntryKey("7");
  assert(A.DebugPanel.entry.length === A.DEBUG_ENTRY_MAXLEN,
    `F: the buffer stops at DEBUG_ENTRY_MAXLEN=${A.DEBUG_ENTRY_MAXLEN} (got ${A.DebugPanel.entry.length})`);
  A.debugEntryCancel();

  // Typing is impossible on a header / Dump / Back row.
  for (let i = 0; i < A.DEBUG_ROWS.length; i++) {
    if (A.DEBUG_ROWS[i].kind === "var") continue;
    g.menu.index = i;
    A.debugEntryKey("5");
    assert(A.debugEntryActive() === false, `F: no entry can start on a ${A.DEBUG_ROWS[i].kind} row (index ${i})`);
  }

  // up/down abandon a pending entry rather than trapping the cursor.
  g.menu.index = row;
  A.debugEntryKey("9");
  A.menuDebug("down");
  assert(A.debugEntryActive() === false, "F: moving off the row abandons the pending entry");
  assert(g.menu.index !== row, "F: ...and the move itself still happens (the cursor is not trapped)");

  // `pause` while pending also cancels instead of leaving.
  g.menu.index = row;
  A.debugEntryKey("8");
  A.menuDebug("pause");
  assert(g.menu.screen === "debug" && A.debugEntryActive() === false,
    "F: `pause` while pending cancels the entry and stays on the screen");
})();

// ================= (G) persistence: a typed value round-trips across a reload ==================
(function sectionG() {
  console.log("(G) a typed value round-trips through afd_settings_v1.debug across a fresh module load");
  const inst = build();
  const A = inst.exports;
  const g = onDebug(A);

  const target = "chainGuardTime";                        // {def:30, min:5, max:120, step:5}
  g.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === target);
  for (const k of ["7", "3"]) A.debugEntryKey(k);
  A.menuDebug("confirm");
  assert(A.debugShown[target] === 73, "G: typed 73 committed live");

  // Commit went through the SAME saveSettings path as arrow stepping — no extra write path.
  const blob = inst.lsStore[A.STORAGE_KEY];
  assert(typeof blob === "string", "G: the commit wrote the settings blob (saveSettings ran)");
  const parsed = JSON.parse(blob);
  assert(parsed.debug && parsed.debug[target] === 73, "G: the blob carries the typed value in DISPLAY units");
  assert(Object.keys(parsed.debug).length === A.DEBUG_ENTRIES.length,
    "G: the debug sub-object holds one key per value entry — headers contribute nothing");
  assert(!("undefined" in parsed.debug), "G: no header leaked an `undefined` key into the save");
  assert(A.STORAGE_KEY === "afd_settings_v1", "G: still the frozen key — not renamed, not versioned");

  // THE RELOAD: a fresh module instance seeded with that exact blob restores the typed value at startup.
  const reload = build({ storage: { "afd_settings_v1": blob } }).exports;
  assert(reload.debugShown[target] === 73, `G: a fresh load restored the typed 73 (got ${reload.debugShown[target]})`);
  assert(reload.DEBUG[target] === 73, "G: ...and re-derived the native value");
  assert(reload.debugShown.garbageLifetime === 10, "G: untouched knobs still load at their defaults");

  // Every entry round-trips, typed or not (test item 12's generalisation over the whole registry).
  const inst2 = build();
  const B = inst2.exports;
  const g2 = onDebug(B);
  const want = {};
  for (const e of B.DEBUG_ENTRIES) {
    g2.menu.index = B.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === e.id);
    // A value inside [min,max] that is deliberately NOT the default and NOT on the step grid. Rounded to
    // 6 decimals (CS018 P6): raw float arithmetic on some new fine-step levers (e.g. step 0.1 off a
    // non-round default) produces noise like 1.4500000000000002 — a real typist never enters that many
    // digits, and DEBUG_ENTRY_MAXLEN (a deliberate held/pasted-key guard, unrelated to this) truncates it
    // before parseFloat, which is a test-fixture artifact, not a product bug.
    const v = Math.round(Math.min(e.max, Math.max(e.min, e.def + e.step * 1.5)) * 1e6) / 1e6;
    for (const ch of String(v).split("")) B.debugEntryKey(ch);
    B.menuDebug("confirm");
    const clamped = Math.max(e.min, Math.min(e.max, v));
    // REPOINTED BY CS021 P3: orbitCount carries a `clampShown` hook (FLAG-CS021-a) that can collapse the
    // in-range value further (5, in range, still isn't geometry-fittable and lands on 4) — the same
    // transform applyDebug()/debugEntryCommit() apply live, so the expectation goes through it too.
    want[e.id] = e.clampShown ? e.clampShown(clamped) : clamped;
    assert(B.debugShown[e.id] === want[e.id], `G: typed ${v} into ${e.id} -> ${B.debugShown[e.id]}`);
  }
  const after = build({ storage: { "afd_settings_v1": inst2.lsStore[B.STORAGE_KEY] } }).exports;
  for (const e of B.DEBUG_ENTRIES)
    assert(after.debugShown[e.id] === want[e.id],
      `G: ${e.id} survived the reload (${after.debugShown[e.id]} === ${want[e.id]})`);

  // An older save (written before the headers existed) still loads, and headers can't break it.
  const legacy = build({ storage: { "afd_settings_v1": JSON.stringify({ debug: { garbageLifetime: 44 }, autoShield: true }) } }).exports;
  assert(legacy.debugShown.garbageLifetime === 44, "G: a 1.0.0.17-era save loads its debug values unchanged");
  assert(legacy.settings.autoShield === true, "G: ...and its other additive fields (proving load ran)");
  assert(legacy.debugShown.chainGuardTime === 30, "G: absent keys keep their seeded defaults");

  // A save carrying a literal "undefined" debug key must be ignored, never applied. (Honest note, verified by
  // mutation: switching loadSettings back to DEBUG_VARS does NOT break this — a header's `e.min` is
  // undefined, so the `dv >= e.min` range check is already false. The DEBUG_ENTRIES change there is
  // defensive clarity; the one in the STARTUP SEED is mandatory, and reverting THAT throws at load.)
  const poisoned = build({ storage: { "afd_settings_v1": JSON.stringify({ debug: { undefined: 5, garbageLifetime: 12 } }) } }).exports;
  assert(!("undefined" in poisoned.debugShown) && !(undefined in poisoned.debugShown),
    "G: an `undefined` debug key in a save is never applied to debugShown");
  assert(Object.keys(poisoned.debugShown).length === poisoned.DEBUG_ENTRIES.length,
    "G: ...so the map still holds exactly one key per value entry");
  assert(poisoned.debugShown.garbageLifetime === 12, "G: the real key alongside it still loaded");
})();

// ================= (H) NO cross-field validation (the CS018 inverted-lever trap) ===============
(function sectionH() {
  console.log("(H) descending values are accepted — no low<=normal<=high validator anywhere");
  const inst = build();
  const A = inst.exports;
  const g = onDebug(A);

  // CS018 ships four levers whose values DECREASE as difficulty rises. There are no tier trios in the
  // registry yet (P2 adds no entries), so the property is asserted structurally AND behaviourally: three
  // knobs set to a strictly DESCENDING sequence must all stick, with no clamping or reordering.
  const trio = ["chainGuardTime", "chainGuardIntercepts", "chainGuardMinTow"];
  const vals = [90, 7, 3];   // descending, and each inside its own [min,max]
  trio.forEach((id, k) => {
    g.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === id);
    for (const ch of String(vals[k]).split("")) A.debugEntryKey(ch);
    A.menuDebug("confirm");
  });
  trio.forEach((id, k) => assert(A.debugShown[id] === vals[k],
    `H: ${id} kept its descending value ${vals[k]} (got ${A.debugShown[id]})`));
  const restored = build({ storage: { "afd_settings_v1": inst.lsStore[A.STORAGE_KEY] } }).exports;
  trio.forEach((id, k) => assert(restored.debugShown[id] === vals[k],
    `H: ${id} still ${vals[k]} after a reload — nothing reordered it`));

  // Arrow stepping accepts a descending walk too (the same clamp, no relational check).
  g.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === "chainGuardTime");
  for (let i = 0; i < 4; i++) A.menuDebug("left");
  assert(A.debugShown.chainGuardTime === 70, `H: ◄ stepped 90 -> 70 unimpeded (got ${A.debugShown.chainGuardTime})`);

  // Structural: no relational logic between two registry entries exists in the panel's code. Comment lines
  // are stripped first — the source deliberately DISCUSSES the low/normal/high prohibition in prose, and the
  // point of the assertion is that no such comparison is ever executed.
  const block = scriptSrc.slice(scriptSrc.indexOf("function debugFirstRow"), scriptSrc.indexOf("function debugReturn"))
    .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  assert(!/\b(low|normal|high)\b/i.test(block), "H: no low/normal/high identifier appears in executable panel code");
  // The only comparisons in the block must be against the entry's OWN min/max (the clamp) or row indices —
  // never against another entry's value. `debugShown[` appears only as the stepped row's own current value.
  const shownReads = (block.match(/debugShown\[/g) || []).length;
  assert(shownReads === 1, `H: debugShown is read at exactly one site (the ◄► step) — got ${shownReads}`);
  assert(!/DEBUG_ENTRIES\s*\[|DEBUG_ENTRIES\.find|DEBUG_ENTRIES\.some/.test(block),
    "H: the panel never reaches across the registry to compare one entry against another");
})();

// ================= (I) the raw keydown hook, and DebugCode hygiene ============================
(function sectionI() {
  console.log("(I) the REAL keydown listener routes digits to the entry, and never steals from DebugCode");
  const kb = build({ audio: true });
  const A = kb.exports;
  const g = A.game;
  const keydown = kb.listeners.keydown[0];
  assert(typeof keydown === "function", "I: captured the main keydown listener");

  function resetTitle() {
    g.state = "title"; g.paused = false; g.menu.screen = null; g.menu.index = 0;
    g.menu.rebinding = null; g.entry = null;
    A.DebugCode.armed = false; A.DebugCode.buf = "";
    A.DebugPanel.entry = null;
  }

  // (I1) The secret code still opens the panel — now through enterDebug, landing on a selectable row.
  resetTitle();
  keydown(ev("`"));
  for (const k of CODE_KEYS) keydown(ev(k));
  assert(g.menu.screen === "debug" && g.paused === true, "I1: the code still opens the panel from the title");
  assert(A.DEBUG_ROWS[g.menu.index].kind !== "header", "I1: the cursor is on a selectable row, not the leading header");
  assert(g.menu.index === A.debugFirstRow(), "I1: enterDebug placed it on the first selectable row");
  assert(A.DebugCode.armed === false, "I1: matching the code disarmed the window");

  // (I2) Digits now feed the pending entry (a value row is selected).
  const id = A.debugSelectedVar().id;
  const live = A.debugShown[id];
  keydown(ev("1")); keydown(ev("2"));
  assert(A.DebugPanel.entry === "12", `I2: raw digits reached the entry buffer (got ${A.DebugPanel.entry})`);
  assert(A.debugShown[id] === live, "I2: the live value is untouched until commit");
  keydown(ev("."));  keydown(ev("5"));
  assert(A.DebugPanel.entry === "12.5", "I2: '.' and further digits accrete");
  keydown(ev("Backspace"));
  assert(A.DebugPanel.entry === "12.", "I2: Backspace reaches the buffer too");
  A.debugEntryCancel();

  // (I3) ENTER / ESC are NOT consumed by the hook — they stay abstract actions, so the pad works the same.
  keydown(ev("7"));
  assert(A.DebugPanel.entry === "7", "I3: pending entry armed");
  keydown(ev("Enter"));
  assert(A.debugEntryActive() === false, "I3: ENTER committed through the abstract confirm path");
  assert(A.debugShown[id] === Math.max(A.debugSelectedVar().min, Math.min(A.debugSelectedVar().max, 7)),
    "I3: ...and the value landed (clamped to the row's own range)");
  keydown(ev("9"));
  keydown(ev("Escape"));
  assert(A.debugEntryActive() === false && g.menu.screen === "debug",
    "I3: ESC cancelled the entry and did NOT leave the screen");
  keydown(ev("Escape"));
  assert(g.menu.screen !== "debug", "I3: a second ESC (nothing pending) leaves the panel as it always did");

  // (I4) An ARMED secret-code window keeps first claim: the code contains a digit ("3"), so the hook must
  // stand down while armed or it would eat that keystroke and the code could never complete.
  resetTitle();
  keydown(ev("`"));
  for (const k of CODE_KEYS) keydown(ev(k));       // open the panel
  assert(g.menu.screen === "debug", "I4: (setup) panel open");
  keydown(ev("`"));                                // re-arm the code window WHILE the panel is open
  assert(A.DebugCode.armed === true, "I4: the backtick re-armed the code window");
  keydown(ev("3"));
  assert(A.debugEntryActive() === false, "I4: the digit did NOT start a numeric entry while the code is armed");
  assert(A.DebugCode.buf === "3", "I4: ...it went to the code buffer, exactly as before this phase");
  for (const k of ["E", "v", "i", "l", "G", "3", "n", "i", "u", "$"]) keydown(ev(k));
  assert(A.DebugCode.armed === false, "I4: the full code still matched with the hook installed");
  assert(A.debugEntryActive() === false, "I4: and none of its characters leaked into a numeric entry");

  // (I5) Off the debug screen, digits are inert (no entry state created anywhere else).
  resetTitle();
  g.menu.screen = "titlemenu";
  keydown(ev("4")); keydown(ev("-")); keydown(ev("Backspace"));
  assert(A.DebugPanel.entry === null, "I5: digits on another menu screen never arm an entry");
  g.state = "playing"; g.paused = false; g.menu.screen = null;
  keydown(ev("4"));
  assert(A.DebugPanel.entry === null, "I5: nor during live play");

  // (I6) On a NON-value row of the debug panel, digits are inert.
  resetTitle();
  keydown(ev("`"));
  for (const k of CODE_KEYS) keydown(ev(k));
  g.menu.index = A.DEBUG_ROWS.length - 1;          // Back
  keydown(ev("5"));
  assert(A.DebugPanel.entry === null, "I6: digits on the Back row do nothing");
  g.menu.index = 0;                                // a header
  keydown(ev("5"));
  assert(A.DebugPanel.entry === null, "I6: digits on a header row do nothing");

  // (I7) Key auto-repeat does not spam the buffer (matches the menu-nav e.repeat discipline).
  g.menu.index = A.debugFirstRow();
  keydown(ev("1"));
  keydown(ev("1", true));
  assert(A.DebugPanel.entry === "1", "I7: an auto-repeat keydown is ignored");
  A.debugEntryCancel();

  // (I8) A rebind capture still out-ranks everything (defensive gate).
  g.menu.rebinding = { action: "fire", device: "key" };
  keydown(ev("6"));
  assert(A.DebugPanel.entry === null, "I8: no entry starts while a rebind capture is live");
  g.menu.rebinding = null;

  // (I9) The character class is exactly digits + "." + "-".
  assert(["0", "5", "9", ".", "-"].every(c => A.DEBUG_ENTRY_CHARS.test(c)), "I9: DEBUG_ENTRY_CHARS accepts 0-9 . -");
  assert(["a", "+", "e", " ", "Enter", "Escape", "ArrowUp", ""].every(c => !A.DEBUG_ENTRY_CHARS.test(c)),
    "I9: ...and nothing else, including Enter/Escape/arrows");
})();

// ================= (J) both input methods coexist: gamepad d-pad drives the same handler =======
(function sectionJ() {
  console.log("(J) menuInput (the shared keyboard+gamepad dispatcher) drives the panel identically");
  const A = build().exports;
  const g = onDebug(A);
  const first = g.menu.index;

  // The gamepad path calls menuInput(action) — the same entry the keyboard uses — so exercising it here
  // proves d-pad nav and adjust are not a separate code path that could rot.
  A.menuInput("down"); A.menuInput("down");
  assert(g.menu.index !== first && A.DEBUG_ROWS[g.menu.index].kind !== "header",
    "J: menuInput('down') navigates and still skips headers");
  const id = "garbageAttractRadius";
  g.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === id);
  const v0 = A.debugShown[id], step = A.DEBUG_ENTRIES.find(e => e.id === id).step;
  A.menuInput("right");
  assert(A.debugShown[id] === v0 + step, `J: menuInput('right') steps by exactly one step (${v0} -> ${v0 + step})`);
  A.menuInput("left");
  assert(A.debugShown[id] === v0, "J: menuInput('left') steps back");

  // A pending entry commits/cancels off the abstract actions, which is what gamepad A/B map to.
  A.debugEntryKey("2"); A.debugEntryKey("0"); A.debugEntryKey("0");
  A.menuInput("confirm");
  assert(A.debugShown[id] === 200, "J: gamepad A (confirm) commits a pending numeric entry");
  A.debugEntryKey("1"); A.debugEntryKey("0");
  A.menuInput("back");
  assert(A.debugEntryActive() === false && g.menu.screen === "debug", "J: gamepad B (back) cancels it, staying put");

  // Arrow stepping still clamps at both ends (unchanged behaviour, re-verified through the new row model).
  for (let i = 0; i < 200; i++) A.menuInput("right");
  assert(A.debugShown[id] === 600, `J: clamped at max 600 (got ${A.debugShown[id]})`);
  for (let i = 0; i < 200; i++) A.menuInput("left");
  assert(A.debugShown[id] === 0, `J: clamped at min 0 (got ${A.debugShown[id]})`);
})();

// ================= (K) drawDebug renders headless at every cursor position + every scroll pos ==
(function sectionK() {
  console.log("(K) drawDebug()/drawMenu() run headless at every row, scrolled and typing, without throwing");
  const A = build().exports;
  const g = onDebug(A);
  let threw = null;
  try {
    for (let i = 0; i < A.DEBUG_ROWS.length; i++) {
      g.menu.index = i;
      A.DebugPanel.scroll = 0;              A.drawDebug();
      A.DebugPanel.scroll = A.DEBUG_ROWS.length;  A.drawDebug();   // out-of-range offset must self-heal
      A.DebugPanel.scroll = -5;             A.drawDebug();
      A.drawMenu();                         // through the real screen dispatch
    }
    // ...and while a numeric entry is pending (the alternate value render + alternate hint line).
    g.menu.index = A.debugFirstRow();
    A.debugEntryKey("1"); A.debugEntryKey("."); A.debugEntryKey("2");
    A.drawDebug(); A.drawMenu();
    A.debugEntryCancel();
  } catch (e) { threw = e; }
  assert(!threw, "K: drawDebug()/drawMenu() did not throw headless" + (threw ? ": " + threw.stack : ""));
  assert(A.DebugPanel.scroll >= 0 && A.DebugPanel.scroll <= A.DEBUG_ROWS.length - A.DEBUG_ROWS_VISIBLE,
    "K: a garbage scroll offset is clamped back into range by the draw");
})();

// ================= (L) return routing + Dump row unchanged =====================================
(function sectionL() {
  console.log("(L) Back / Dump / return routing behave exactly as before, now via row kind");
  const A = build().exports;
  const g = onDebug(A);
  const last = A.DEBUG_ROWS.length - 1;

  // confirm on Back from title context -> closePause -> the title menu (CS016 P2 behaviour, unchanged).
  g.menu.index = last;
  A.menuDebug("confirm");
  assert(g.menu.screen === "titlemenu" && g.paused === false,
    "L: confirm on Back from title context unpauses to the title menu");

  // confirm on the Dump row runs the dump (no throw headless — it builds a CSV and no-ops the download).
  const g2 = onDebug(A, { playing: false });
  g2.menu.index = last - 1;
  let threw = null;
  try { A.menuDebug("confirm"); } catch (e) { threw = e; }
  assert(!threw, "L: confirm on the Dump row runs dumpDifficultyLog without throwing" + (threw ? ": " + threw : ""));
  assert(g2.menu.screen === "debug", "L: ...and stays on the panel");

  // back from a paused live game -> the root menu, still paused.
  const g3 = onDebug(A, { playing: true });
  assert(g3.menu.screen === "debug" && g3.paused === true, "L: the paused-game route opens the panel paused");
  A.menuDebug("back");
  assert(g3.menu.screen === "root" && g3.paused === true, "L: back from a paused game returns to the root, still paused");

  // left/right on the Dump and Back rows remain no-ops (no value under the cursor).
  const g4 = onDebug(A);
  const snapshot = JSON.stringify(A.debugShown);
  for (const i of [last - 1, last, 0]) { g4.menu.index = i; A.menuDebug("left"); A.menuDebug("right"); }
  assert(JSON.stringify(A.debugShown) === snapshot, "L: left/right on header/Dump/Back change no value");
})();

// ================= (M) scale: the row model holds at CS018's projected 32-entry registry ========
(function sectionM() {
  console.log("(M) scale check — the same code at CS018's projected ~38 rows (32 knobs + headers + 2)");
  const A = build().exports;
  const g = onDebug(A);
  const rows = A.DEBUG_ROWS;

  // Splice synthetic rows in BEFORE the trailing Dump/Back pair, reusing real registry entries so
  // debugShown lookups resolve. This is the shape P3/P6/P7 will produce: 32 value entries interleaved with
  // JUNK / UFO MOVEMENT / UFO WEAPONS / GLOBAL headers, plus the two action rows.
  // REPOINTED BY CS018 P3+: the synthetic count is now DERIVED, so this section keeps testing the CS018
  // end-state (32 value rows, §3.1) as real knobs land phase by phase instead of overshooting it.
  // REPOINTED AGAIN BY CS019 P1: the registry has now GROWN PAST that end-state — chainGuardCooldown is
  // the 33rd value entry — so a fixed 32 target would ask this section to REMOVE rows and `need` would
  // go negative. The target now tracks the live registry, with CS018's 32 as its floor. Same claim at
  // the same strength ("the row model, scroll window and panel height all hold at the full registry"),
  // and the floor assertion flips to its mirror image: it used to say the registry had not yet reached
  // 32, it now says it is at or past it. Both are exact bounds on the live count; neither is softer.
  const CS018_VALUE_ROWS = 32;
  const reuse = A.DEBUG_ENTRIES[A.DEBUG_ENTRIES.length - 1];
  const baseRows = rows.length, baseVars = rows.filter(r => r.kind === "var").length;
  const TARGET_VALUE_ROWS = Math.max(CS018_VALUE_ROWS, baseVars);
  const need = TARGET_VALUE_ROWS - baseVars;
  assert(baseVars >= CS018_VALUE_ROWS, `M: the live registry is at or past CS018's 32 value rows (has ${baseVars})`);
  const SECTIONS = 4;
  const extra = [];
  for (let s = 0; s < SECTIONS; s++) {
    extra.push({ kind: "header", label: "SECTION " + s });
    const per = Math.floor(need / SECTIONS) + (s < need % SECTIONS ? 1 : 0);
    for (let k = 0; k < per; k++) extra.push({ kind: "var", label: `synthetic ${s}.${k}`, e: reuse });
  }
  rows.splice(rows.length - 2, 0, ...extra);
  const ROWS = rows.length, VIS = A.DEBUG_ROWS_VISIBLE, maxTop = ROWS - VIS;
  assert(ROWS === baseRows + extra.length, `M: the enlarged model has ${baseRows + extra.length} rows (got ${ROWS})`);
  assert(rows.filter(r => r.kind === "var").length === TARGET_VALUE_ROWS, `M: ...of which ${TARGET_VALUE_ROWS} are value rows, at or above CS018 §3.1's 32`);
  assert(ROWS >= 42, `M: at least the 42 rows CS018's end-state implies (got ${ROWS})`);

  // Panel height must NOT have grown — that is the whole point of the fixed-height rewrite.
  assert(A.DEBUG_PANEL_H === 640 && A.DEBUG_PANEL_H <= A.VIEW_H, `M: the panel height is unchanged at ${ROWS} rows`);

  // A full lap still visits every selectable row, never a header, and reaches the last row.
  g.menu.index = A.debugFirstRow();
  const selectable = rows.map((r, i) => r.kind !== "header" ? i : -1).filter(i => i >= 0);
  const seen = [g.menu.index];
  for (let k = 1; k < selectable.length; k++) {
    A.menuDebug("down");
    const top = A.debugScrollTop();
    assert(g.menu.index >= top && g.menu.index < top + VIS, `M: row ${g.menu.index} stays inside the window`);
    seen.push(g.menu.index);
  }
  assert(JSON.stringify(seen) === JSON.stringify(selectable), "M: one lap visits every selectable row at scale");
  assert(g.menu.index === ROWS - 1 && rows[ROWS - 1].kind === "back", `M: Back is still reachable at ${ROWS} rows`);
  assert(A.DebugPanel.scroll === maxTop, `M: ...with the window scrolled to the end (${maxTop})`);
  A.menuDebug("down");
  assert(g.menu.index === A.debugFirstRow() && A.debugScrollTop() === 0, "M: the wrap still returns to the top");

  let threw = null;
  try { for (let i = 0; i < ROWS; i++) { g.menu.index = i; A.drawDebug(); } } catch (e) { threw = e; }
  assert(!threw, "M: drawDebug renders every row of the enlarged model" + (threw ? ": " + threw.stack : ""));

  rows.splice(rows.length - 2 - extra.length, extra.length);   // leave the shared model as we found it
  assert(rows.length === baseRows, "M: the synthetic rows were removed again");
})();

console.log(`\ntest-cs018-p2: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
