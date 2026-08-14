// Headless test for CS032 Phase 4 — menu wiring: the paused root's "Save" row goes live, and the
// title menu gains "Load Saved Game" as the unavailable-row idiom's new consumer.
//
//   node scratchpad/test-cs032-p4.js
//
// Drives the REAL code via _harness.js: menuRoot/menuTitle through menuInput, drawRootMenu,
// drawTitleMenu, the real SaveSlots. Nothing about a row's colour or dispatch is reimplemented here.
//
// THE TRAP THIS FILE EXISTS FOR (§A):
//   the unavailable-row idiom is THREE pieces — label, dispatch, render. Unpicking the dispatch
//   without deleting drawRootMenu's forced `it === "Save" ? COLOR.dim` ternary is SILENT: the row
//   works and renders permanently grey. So §A asserts the COLOUR, not just the navigation.
//
// Sections: (A) drawRootMenu renders Save in the ordinary colours and holds no COLOR.dim at all.
// (B) confirm on Save opens "slots" in save mode. (C) MENU_ROOT_OVER still carries no Save row.
// (D) MENU_TITLE is 6 rows and the four TITLE_MENU_* knobs are byte-identical to the parent commit.
// (E) the Load row: dim + inert at zero slots, lit + live once one is written. (F) no surviving
// idiom comment cites the now-live "Save" row. (G) node --check. (H) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope, parentSource } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-32 p3: the slots screen".
const PARENT_SHA = "d4f56d3";
const PHASE_SUBJECT = "cs-32 p4:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// Brace-matched slice of a block, from the declaration through its closing brace (P1/P2/P3's helper).
function blockAt(text, from) {
  const open = text.indexOf("{", from);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(from, i + 1);
  }
  return "";
}

// A slot payload of the shape buildSaveEntry() produces (P3's helper, trimmed to what P4 reads).
function slotEntry(over) {
  return Object.assign({
    kind: "wave", saved: 1700000000000, profileName: "P", wave: 6, score: 1234, hp: 100,
    nextRepair: 10000, scoopLevel: 0, scoopHits: 0,
    powerBudget: { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 },
    stats: { powerUsed: { rapid: false, triple: false, magnet: false, engine: false } },
    debugRun: false,
  }, over || {});
}

// Every fillText the given renderer emits, with the fillStyle live at the call.
function renderRows(X, fn) {
  const log = [];
  const real = X.ctx.fillText;
  X.ctx.fillText = (str, x, y) => log.push({ str: String(str), x, y, color: X.ctx.fillStyle });
  try { fn(); } finally { X.ctx.fillText = real; }
  return log;
}
const rowFor = (log, label) => log.find(e => e.str.endsWith(label));

// A build paused mid-run with the root cursor parked on `label` — Save's only real caller (spec §0.2:
// the paused root, game.state === "playing", and nowhere else).
function atPauseRoot(label, store = {}) {
  const X = buildGame({ store });
  X.startGame();
  X.openPause();
  X.game.menu.index = X.rootItems().indexOf(label);
  return X;
}
// A build sitting on the title menu with the cursor on `label` — Load's only real caller (spec §4.3).
function atTitleMenu(label, slots = []) {
  const X = buildGame({ store: {} });
  slots.forEach((s, i) => { if (s !== null) X.SaveSlots.write(i, s); });
  X.quitToTitle();
  X.game.menu.index = X.MENU_TITLE.indexOf(label);
  return X;
}

// ================= (A) ⛔ THE PIECE-3 PIN: drawRootMenu no longer forces Save dim ====================
(function sectionA() {
  console.log("(A) ⛔ drawRootMenu renders \"Save\" in COLOR.text when selected — the forced-dim ternary is GONE");
  const X = atPauseRoot("Save");
  eq(X.rootItems()[X.game.menu.index], "Save", "A: (setup) the cursor is parked on Save");

  const sel = rowFor(renderRows(X, X.drawRootMenu), "Save");
  assert(!!sel, "A: the Save row rendered a fillText");
  eq(sel && sel.str, "▶ Save", "A: ...with the focused prefix");
  eq(sel && sel.color, X.COLOR.text, "A: ⛔ focused Save draws COLOR.text — NOT COLOR.dim");

  X.game.menu.index = X.rootItems().indexOf("Continue");
  const idle = rowFor(renderRows(X, X.drawRootMenu), "Save");
  eq(idle && idle.str, "   Save", "A: unfocused Save keeps the blank prefix");
  eq(idle && idle.color, X.COLOR.menuIdle, "A: ⛔ unfocused Save draws COLOR.menuIdle — NOT COLOR.dim");

  // TEETH — the colours the two assertions above distinguish are genuinely different values, so a
  // stub collapsing them could not make this section pass by accident.
  assert(X.COLOR.dim !== X.COLOR.text && X.COLOR.dim !== X.COLOR.menuIdle,
    "A: (teeth) COLOR.dim is distinct from both COLOR.text and COLOR.menuIdle");

  // Structural half: drawRootMenu's own body no longer mentions COLOR.dim anywhere. The render check
  // above only proves Save isn't dim TODAY; this proves the forced-dim branch is deleted, not merely
  // unreachable — which is what makes the three-piece unpick complete rather than half-done.
  const fn = blockAt(stripped, stripped.indexOf("\nfunction drawRootMenu() {") + 1);
  assert(fn.length > 0, "A: (setup) drawRootMenu() brace-matched");
  assert(!/COLOR\.dim/.test(fn), "A: ⛔ drawRootMenu()'s body holds no COLOR.dim at all");
  assert(!/=== "Save"/.test(fn), "A: ⛔ ...and no \"Save\" special case of any kind");
})();

// ================= (B) confirm on Save opens the slots screen in save mode ===========================
(function sectionB() {
  console.log("(B) confirm on \"Save\" opens \"slots\" with slotMode === \"save\"");
  const X = atPauseRoot("Save");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "slots", "B: ⛔ confirm on Save opened the slots screen");
  eq(X.game.menu.slotMode, "save", "B: ⛔ ...in SAVE mode, not load");
  eq(X.game.menu.index, 0, "B: ...with the slot cursor reset by gotoScreen");
  eq(X.game.state, "playing", "B: the paused run underneath is untouched");
  eq(X.game.paused, true, "B: ...and still paused");

  // Dispatch is by LABEL, not by index — the property that let CS032 add a branch with no row moving.
  assert(/label === "Save"\)\s*\{ game\.menu\.slotMode = "save"; gotoScreen\("slots"\); \}/.test(stripped),
    'B: ⛔ menuRoot() routes the "Save" LABEL to gotoScreen("slots"), slotMode set first');
  eq(X.MENU_ROOT_PLAY.indexOf("Save"), 1, "B: MENU_ROOT_PLAY's label and position are unchanged (row 1)");
  eq(JSON.stringify(X.MENU_ROOT_PLAY), JSON.stringify(["Continue", "Save", "Options", "Quit"]),
    "B: ...the whole array is unchanged");

  // Round trip: the slots screen's own Back lands on the root with the cursor restored to Save, which
  // is the pairing that makes slotMode a sufficient return-address (P3's own reasoning).
  X.menuInput("back");
  eq(X.game.menu.screen, "root", "B: back from slots -> the paused root");
  eq(X.rootItems()[X.game.menu.index], "Save", "B: ...cursor restored to the Save row");
})();

// ================= (C) MENU_ROOT_OVER gains no Save row ============================================
(function sectionC() {
  console.log("(C) ⛔ gameover's root still carries no \"Save\" — there is no run left to save");
  const X = buildGame({ store: {} });
  assert(!X.MENU_ROOT_OVER.includes("Save"), "C: ⛔ MENU_ROOT_OVER contains no \"Save\" row");
  eq(JSON.stringify(X.MENU_ROOT_OVER), JSON.stringify(["Play Again", "Options", "Quit to Title"]),
    "C: MENU_ROOT_OVER is unchanged by this phase");

  // Driven: at gameover the shared menuRoot() handler is live, and no cursor position on that root
  // can reach the new Save branch — the label simply isn't in the array it dispatches over.
  X.startGame();
  X.game.state = "gameover"; X.game.paused = false; X.game.menu.screen = null;
  X.openPause();
  eq(X.rootItems(), X.MENU_ROOT_OVER, "C: (setup) rootItems() serves the gameover layout");
  for (let i = 0; i < X.MENU_ROOT_OVER.length; i++) {
    const Y = buildGame({ store: {} });
    Y.startGame();
    Y.game.state = "gameover"; Y.game.paused = false; Y.game.menu.screen = null;
    Y.openPause();
    Y.game.menu.index = i;
    Y.menuInput("confirm");
    assert(Y.game.menu.screen !== "slots",
      `C: ⛔ confirm on gameover row ${i} ("${X.MENU_ROOT_OVER[i]}") never reaches the slots screen`);
  }
  const rendered = renderRows(X, X.drawRootMenu).map(e => e.str);
  assert(!rendered.some(s => s.endsWith("Save")), "C: ⛔ ...and the gameover root draws no Save row either");
})();

// ================= (D) MENU_TITLE is 6 rows; the layout knobs are byte-identical =====================
(function sectionD() {
  console.log("(D) MENU_TITLE.length === 6; titleMenuLayout(6) is the live layout; no TITLE_MENU_* knob moved");
  const X = buildGame({ store: {} });
  eq(X.MENU_TITLE.length, 6, "D: MENU_TITLE is 6 rows");
  eq(JSON.stringify(X.MENU_TITLE),
    JSON.stringify(["Start Game", "Load Saved Game", "Profile", "Achievements", "High Scores", "Options"]),
    "D: ⛔ \"Load Saved Game\" sits SECOND, beside its \"start a run\" sibling");

  // The live constants ARE titleMenuLayout(6) — the derivation, not a hand-tuned pair.
  const want = X.titleMenuLayout(6);
  eq(X.TITLE_MENU_Y, want.y, "D: TITLE_MENU_Y === titleMenuLayout(6).y");
  eq(X.TITLE_MENU_STEP, want.step, "D: TITLE_MENU_STEP === titleMenuLayout(6).step");
  // The values test-cs031-p5.js forecast and test-cs016-p2.js §K now pins: Y unmoved, step shrunk.
  eq(X.TITLE_MENU_Y, 324, "D: ⛔ Y is still 324 — the block re-centred rather than sliding");
  eq(X.TITLE_MENU_STEP, 26.4, "D: ⛔ step shrank 33 -> 26.4, which is FORK-CS031-G's self-healing doing its job");
  const TOP = X.VIEW_H / 2 - 60, BOTTOM = X.VIEW_H / 2 + 120;
  assert(X.TITLE_MENU_Y > TOP, `D: the first row (${X.TITLE_MENU_Y}) clears the O V E R H A U L baseline (${TOP})`);
  const lastRow = X.TITLE_MENU_Y + 5 * X.TITLE_MENU_STEP;
  assert(lastRow < BOTTOM, `D: the last row (${lastRow}) clears the flavour-line baseline (${BOTTOM})`);

  // ⛔ NO LAYOUT EDIT. The four knobs are gate-confirmed (CS031 G3); if this phase had needed to move
  // one, something else was wrong. Pinned against THIS PHASE'S OWN PARENT as a literal SHA, so the
  // claim is "P4 did not touch them" and cannot silently re-aim at a later commit.
  const parent = parentSource(PARENT_SHA);
  if (parent === null) { skip("D: TITLE_MENU_* byte-identity (no git history)"); }
  else {
    const knobs = /const TITLE_MENU_TOP[\s\S]*?const TITLE_MENU_STEP_MAX = \d+;/;
    const now = src.match(knobs), was = parent.match(knobs);
    assert(!!now && !!was, "D: (setup) the TITLE_MENU_* knob block was found in both revisions");
    if (now && was) eq(now[0], was[0], "D: ⛔ TOP/BOTTOM/MARGIN/STEP_MAX are byte-identical to the parent commit");
  }
  eq(X.TITLE_MENU_MARGIN, 24, "D: MARGIN is still 24");
  eq(X.TITLE_MENU_STEP_MAX, 38, "D: STEP_MAX is still 38");
})();

// ================= (E) ⛔ the Load row: dim + inert at zero slots, lit + live with one ===============
(function sectionE() {
  console.log("(E) ⛔ \"Load Saved Game\" is present, dim and inert at zero slots; live once a slot is written");
  // ---- zero slots ----
  const X = atTitleMenu("Load Saved Game");
  eq(X.SaveSlots.count(), 0, "E: (setup) a fresh profile has zero occupied slots");
  const dimRow = rowFor(renderRows(X, X.drawTitleMenu), "Load Saved Game");
  assert(!!dimRow, "E: ⛔ the row is PRESENT, not hidden — the row count must not vary with save state");
  eq(dimRow && dimRow.str, "▶ Load Saved Game", "E: ...and focusable, with the shared selection prefix");
  eq(dimRow && dimRow.color, X.COLOR.dim, "E: ⛔ ...drawn COLOR.dim even while focused");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "titlemenu", "E: ⛔ confirm is INERT at zero slots — no navigation");
  eq(X.game.menu.slotMode, null, "E: ...and slotMode was not set on the way past");

  // ---- one slot ----
  const Y = atTitleMenu("Load Saved Game", [slotEntry({ wave: 6 })]);
  eq(Y.SaveSlots.count(), 1, "E: (setup) one slot is now occupied");
  const litRow = rowFor(renderRows(Y, Y.drawTitleMenu), "Load Saved Game");
  eq(litRow && litRow.color, Y.COLOR.text, "E: ⛔ the same row is COLOR.text once something is loadable");
  Y.menuInput("confirm");
  eq(Y.game.menu.screen, "slots", "E: ⛔ ...and confirm now opens the slots screen");
  eq(Y.game.menu.slotMode, "load", "E: ⛔ ...in LOAD mode");

  // ⛔ RECOMPUTED, NEVER CACHED. Same build, same screen: clearing the slot must flip the row back to
  // dim and inert without a rebuild — a value read once at boot would keep the row lit here.
  Y.gotoScreen("titlemenu", Y.MENU_TITLE.indexOf("Load Saved Game"));
  Y.SaveSlots.clear(0);
  eq(Y.SaveSlots.count(), 0, "E: (setup) the slot was cleared under a LIVE build");
  const again = rowFor(renderRows(Y, Y.drawTitleMenu), "Load Saved Game");
  eq(again && again.color, Y.COLOR.dim, "E: ⛔ the row went dim again with no rebuild — the count is not cached");
  Y.menuInput("confirm");
  eq(Y.game.menu.screen, "titlemenu", "E: ⛔ ...and confirm is inert again");

  // The row keeps the count STABLE at 6 in both states — the reason it is dimmed rather than hidden.
  eq(X.MENU_TITLE.length, Y.MENU_TITLE.length, "E: ⛔ the row count is identical with and without saves");

  // Both halves ask the same question, by LABEL, at use time. drawTitleMenu keeps two label-driven
  // special cases (Profile's text, this row's colour) and no index anywhere.
  const fn = blockAt(stripped, stripped.indexOf("\nfunction drawTitleMenu() {") + 1);
  assert(fn.length > 0, "E: (setup) drawTitleMenu() brace-matched");
  assert(/SaveSlots\.count\(\) === 0/.test(fn), "E: ⛔ drawTitleMenu asks SaveSlots.count() itself");
  assert(/label === "Load Saved Game"/.test(fn) && /label === "Profile"/.test(fn),
    "E: ⛔ both special cases are keyed on the LABEL, never on an index");
  assert(/label === "Load Saved Game"\)\s*\{\s*if \(SaveSlots\.count\(\) === 0\) return;/.test(stripped),
    "E: ⛔ menuTitle's branch asks the same question before navigating");
})();

// ================= (F) ⛔ no surviving idiom comment cites the now-live "Save" row ===================
(function sectionF() {
  console.log("(F) ⛔ every remaining unavailable-row-idiom citation names a row that is still inert");
  // The exact citation form all four call sites shared. Leaving one pointed at a live row is how a
  // comment becomes a lie, and it is invisible to every other test in the suite.
  assert(!/MENU_ROOT_PLAY's "Save"/.test(src),
    'F: ⛔ no comment still cites `MENU_ROOT_PLAY\'s "Save"` as the idiom\'s example');

  // Line-scoped: a line that talks about the idiom may not also quote "Save" as its subject.
  const lines = src.split("\n");
  const idiom = lines.map((l, i) => [i + 1, l]).filter(([, l]) => /unavailable[- ]row idiom/i.test(l));
  assert(idiom.length > 0, "F: (setup) the idiom is still described somewhere — the comments were not just deleted");
  for (const [n, l] of idiom) {
    assert(!/"Save"/.test(l), `F: ⛔ line ${n} mentions the idiom and still quotes "Save": ${l.trim()}`);
  }

  // The rows those comments DO name are driven-verified inert here, so §F is a behaviour check and
  // not a spelling check. Consumer 1: menuProfiles' "Add Profile" at PROFILE_MAX — the new canonical
  // example. Consumer 2: the Difficulty value row, locked mid-run. (Consumer 3, "Load Saved Game" at
  // zero slots, is §E's whole subject.)
  const X = buildGame({ store: {} });
  while (X.Profiles.roster.length < X.PROFILE_MAX) X.Profiles.add("P" + X.Profiles.roster.length);
  eq(X.Profiles.roster.length, X.PROFILE_MAX, "F: (setup) the roster is at its cap");
  X.gotoScreen("profiles");
  X.game.menu.index = X.Profiles.roster.length;   // the trailing Add Profile row
  X.menuInput("confirm");
  eq(X.game.menu.screen, "profiles", "F: ⛔ \"Add Profile\" at the cap is still INERT — the canonical example holds");
  const addRow = rowFor(renderRows(X, X.drawProfiles), X.PROFILE_ADD_LABEL);
  eq(addRow && addRow.color, X.COLOR.dim, "F: ⛔ ...and still renders COLOR.dim while focused");

  const Y = buildGame({ store: {} });
  Y.startGame();
  Y.openPause();
  Y.gotoScreen("difficulty", Y.DIFFICULTY_ROWS.indexOf("autoshield"));
  const before = Y.settings.autoShield;
  Y.menuInput("left"); Y.menuInput("right");
  eq(Y.settings.autoShield, before, "F: ⛔ the mid-run Difficulty row is still INERT — the second consumer holds");
})();

// ================= (G) node --check =================================================================
(function sectionG() {
  console.log("(G) node --check on the extracted <script>");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs032p4_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ================= (H) scope pin ====================================================================
(function sectionH() {
  console.log("(H) scope pin — the game file, scratchpad/ and STATUS.md");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("H: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: H: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("H: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (H measured against the WORKING TREE — this phase is not committed yet)");

  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `H: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "H: (setup) the game file is in this phase's diff");
})();

A.report();
