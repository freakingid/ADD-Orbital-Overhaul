// Headless test for CS032 Phase 3 — the "slots" screen: one screen, two modes (save/load), reachable
// only from this harness (P4 wires the real callers).
//
//   node scratchpad/test-cs032-p3.js
//
// Drives the REAL code: SaveSlots.write/read, buildSaveEntry(), resumeFromSave(), openModal, and the
// real menuSlots()/drawSlots(). No row state or write path is reimplemented here.
//
// THE TRAPS THIS FILE EXISTS FOR:
//   (§C) an occupied row must warn (modal) before an overwrite, and CANCEL must genuinely leave the
//        slot untouched — the same safety property as profile Delete's modal.
//   (§F) a failed write() must not be reported as success — the screen stays open with a message set.
//   (§E) an unrecognised `kind` renders UNREADABLE and is inert in load mode, exactly like EMPTY —
//        FORK-H's "don't guess at a payload you don't recognise."
//
// Sections: (A) nav wraps, both modes. (B) load-mode confirm on empty is inert. (C) save-mode confirm
// on occupied raises a modal; cancel leaves the slot untouched; confirm overwrites via buildSaveEntry().
// (D) save-mode confirm on empty writes with no modal. (E) an unreadable slot: state, inert in load,
// and the dim render pin. (F) a failed write() leaves the screen open with slotMsg set. (G) load-mode
// confirm on occupied calls resumeFromSave() and returns to "playing". (H) node --check + wiring +
// both-places rule. (I) render smoke across every shape. (J) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-32 p2: resumeFromSave + resumedRun".
const PARENT_SHA = "6d4a3b5";
const PHASE_SUBJECT = "cs-32 p3:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);
const countOf = (text, needle) => text.split(needle).length - 1;

// Brace-matched slice of a block, from the declaration through its closing brace (P1/P2/P4's helper).
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

// A full, valid slot payload — the shape buildSaveEntry() produces — with overrides.
function slotEntry(over) {
  return Object.assign({
    kind: "wave", saved: 1700000000000, profileName: "P", wave: 1, score: 0, hp: 100,
    nextRepair: 10000, scoopLevel: 0, scoopHits: 0,
    powerBudget: { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 },
    stats: { powerUsed: { rapid: false, triple: false, magnet: false, engine: false } },
    debugRun: false,
  }, over || {});
}
// A build parked on the slots screen. `mode: "save"` matches its only real caller (mid-run, the
// paused root) by starting a game first; `mode: "load"` matches its only real caller (the title,
// game.state === "title" by default) by leaving the build untouched.
function onSlots(mode, slots = [null, null, null], store = {}) {
  const X = buildGame({ store });
  if (mode === "save") X.startGame();
  slots.forEach((s, i) => { if (s !== null) X.SaveSlots.write(i, s); });
  X.game.menu.slotMode = mode;
  X.gotoScreen("slots");
  return X;
}

// ================= (A) Nav wraps across three rows, both modes ======================================
(function sectionA() {
  console.log("(A) up/down wrap across exactly three rows, in both save and load mode");
  for (const mode of ["save", "load"]) {
    const X = onSlots(mode, [slotEntry({ wave: 1 }), slotEntry({ wave: 2 }), slotEntry({ wave: 3 })]);
    eq(X.game.menu.index, 0, `A: (setup) ${mode} opens on row 0`);
    X.menuInput("up");
    eq(X.game.menu.index, 2, `A: ⛔ up from row 0 wraps to row 2 (${mode})`);
    X.menuInput("down");
    eq(X.game.menu.index, 0, `A: down from row 2 wraps to row 0 (${mode})`);
    X.menuInput("down"); X.menuInput("down");
    eq(X.game.menu.index, 2, `A: ⛔ down x2 from row 0 lands on row 2 (${mode})`);
  }
})();

// ================= (B) load mode: confirm on an empty row is inert ==================================
(function sectionB() {
  console.log("(B) ⛔ 'load' mode: confirm on an EMPTY row does nothing — no state change, no screen change");
  const X = onSlots("load", [null, slotEntry({ wave: 5 }), null]);
  const before = JSON.stringify(X.SaveSlots.read());
  X.game.menu.index = 0;
  X.menuInput("confirm");
  eq(X.game.menu.screen, "slots", "B: ⛔ the screen did not change");
  eq(X.game.resumedRun, false, "B: ⛔ resumeFromSave() was never called");
  eq(JSON.stringify(X.SaveSlots.read()), before, "B: ...and storage is byte-identical to before the confirm");
})();

// ================= (C) save mode: occupied row raises a modal; cancel is safe; confirm overwrites ===
(function sectionC() {
  console.log("(C) 'save' on an occupied row raises a modal; CANCEL leaves the slot untouched; confirm overwrites via buildSaveEntry()");
  const X = onSlots("save", [slotEntry({ wave: 4, score: 100 }), null, null]);
  X.game.score = 999; X.game.wave = 7;   // the LIVE run diverges from what the slot already holds
  X.game.menu.index = 0;
  X.menuInput("confirm");
  assert(X.game.menu.modal !== null, "C: (setup) confirm on an occupied row opens a modal");
  eq(X.game.menu.modal.index, 1, "C: ⛔ opens on CANCEL (index 1) — the safety property");

  X.menuInput("confirm");   // confirm WITHOUT moving the cursor -> cancels
  eq(X.game.menu.modal, null, "C: the dialog closed");
  eq(X.SaveSlots.read()[0].wave, 4, "C: ⛔ CANCEL left the slot untouched — still the original entry");
  eq(X.game.menu.screen, "slots", "C: ...and the screen is still slots, not the pause root");

  X.menuInput("confirm");                          // re-open the modal
  X.game.menu.modal.index = 0;                      // move onto OVERWRITE
  X.menuInput("confirm");
  const written = X.SaveSlots.read()[0];
  eq(written.wave, 7, "C: ⛔ confirming the overwrite wrote the LIVE run's wave, via buildSaveEntry()");
  eq(written.score, 999, "C: ...the live run's score too");
})();

// ================= (D) save mode: empty row writes with no modal ====================================
(function sectionD() {
  console.log("(D) 'save' on an EMPTY row writes straight through — no modal");
  const X = onSlots("save", [null, null, null]);
  X.game.score = 555; X.game.wave = 3;
  X.game.menu.index = 1;
  X.menuInput("confirm");
  eq(X.game.menu.modal, null, "D: ⛔ save on an empty row never opens a modal");
  const written = X.SaveSlots.read()[1];
  assert(written !== null, "D: ⛔ the slot was written");
  eq(written.wave, 3, "D: ...via buildSaveEntry() off the live run");
  eq(X.game.menu.screen, "root", "D: (spec) a successful save returns to the pause root, not straight into play");
})();

// ================= (E) an unrecognised kind renders UNREADABLE and is inert in load mode ============
(function sectionE() {
  console.log("(E) ⛔ kind:'snapshot' renders UNREADABLE (not occupied) and is inert in load mode, same as EMPTY");
  const X = onSlots("load", [{ kind: "snapshot", saved: 1700000000000, wave: 9 }, null, null]);
  eq(X.slotRowState(X.SaveSlots.read()[0]), "unreadable", "E: ⛔ slotRowState() reads an unrecognised kind as unreadable");
  X.game.menu.index = 0;
  X.menuInput("confirm");
  eq(X.game.menu.screen, "slots", "E: ⛔ confirm on an unreadable row in load mode does nothing");
  eq(X.game.resumedRun, false, "E: ...resumeFromSave() was never called");

  const log = [];
  X.ctx.fillText = (str) => log.push(String(str));
  X.drawMenu();
  assert(log.includes("▶ 1.  " + X.SLOT_UNREADABLE_LABEL), "E: ⛔ the row itself renders the UNREADABLE label");

  // The dim render rule, read off drawSlots()'s own source — the shared unavailable-row idiom.
  const fn = blockAt(stripped, stripped.indexOf("\nfunction drawSlots() {") + 1);
  assert(fn.length > 0, "E: (setup) drawSlots() brace-matched");
  assert(/mode === "load" && state !== "occupied"/.test(fn),
    'E: ⛔ drawSlots() dims exactly "load mode, not occupied" — empty and unreadable both, occupied never');
})();

// ================= (F) a failed write() leaves the screen open with a failure state set ==============
(function sectionF() {
  console.log("(F) ⛔ SaveSlots.write() returning false must not be reported as success");
  const X = onSlots("save", [null, null, null]);
  X.SaveSlots.write = () => false;   // force a storage failure
  X.game.menu.index = 0;
  X.menuInput("confirm");
  eq(X.game.menu.screen, "slots", "F: ⛔ a failed save does NOT return to the pause root — never silently 'worked'");
  assert(!!X.game.menu.slotMsg, "F: ⛔ ...and a failure message is set");

  // TEETH — the identical sequence on a build whose store actually works DOES succeed.
  const Y = onSlots("save", [null, null, null]);
  Y.game.menu.index = 0;
  Y.menuInput("confirm");
  eq(Y.game.menu.screen, "root", "F: (teeth) a genuine success DOES return to the pause root");
  eq(Y.game.menu.slotMsg, "", "F: (teeth) ...with no failure message left behind");
})();

// ================= (G) load mode: confirm on an occupied row loads and resumes play ==================
(function sectionG() {
  console.log("(G) ⛔ 'load' confirm on an occupied row calls resumeFromSave() and returns to 'playing'");
  const entry = slotEntry({ wave: 12, score: 48300, hp: 42 });
  const X = onSlots("load", [entry, null, null]);
  eq(X.game.state, "title", "G: (setup) load mode's real caller is the title screen");
  X.game.menu.index = 0;
  X.menuInput("confirm");
  eq(X.game.state, "playing", "G: ⛔ the run is live");
  eq(X.game.menu.screen, null, "G: ⛔ ...and the menu is closed (resetRun()'s own teardown)");
  eq(X.game.wave, 12, "G: ⛔ resumeFromSave() actually ran — the entry's own wave landed");
  eq(X.game.resumedRun, true, "G: ...and resumedRun is the sticky tell that it did");
})();

// ================= (H) node --check; the three-place wiring; the both-places rule ====================
(function sectionH() {
  console.log("(H) node --check; menuInput's switch, drawMenu's dispatch, slotMode/slotMsg in BOTH game.menu declarations, gotoScreen's slotMsg reset");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs032p3_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  assert(/case "slots":\s*menuSlots\(action\);/.test(stripped),
    'H: ⛔ menuInput()\'s switch has a "slots" case');
  assert(/s === "slots"\) drawSlots\(\)/.test(stripped),
    "H: ⛔ drawMenu()'s dispatch has a slots branch");

  // ⛔ CS016 P3's standing both-places rule: a new game.menu field lands in BOTH the game literal and
  // resetRun()'s own menu reset, or it is undefined for a whole run. Read directly off each literal's
  // own text, not a global substring count (comments describing the fields also say their names).
  // (⚠ CS034 P7 appended a seventh field, hsFilter, to BOTH literals; the anchors keep naming this
  // phase's own two rather than widening to a wildcard.)
  assert(/menu: \{ screen: Profiles\.firstBoot[\s\S]*?slotMode: null, slotMsg: ""[,}]/.test(stripped),
    "H: ⛔ the game literal declares slotMode AND slotMsg");
  assert(/game\.menu = \{ screen: null[\s\S]{0,240}slotMode: null, slotMsg: ""[,}]/.test(stripped),
    "H: ⛔ resetRun()'s own menu reset declares them too");

  // gotoScreen() clears a stale slotMsg on every screen change — the achTab precedent, not a special case.
  const X = buildGame({ store: {} });
  X.game.menu.slotMsg = "boom";
  X.gotoScreen("root");
  eq(X.game.menu.slotMsg, "", "H: ⛔ gotoScreen() resets slotMsg unconditionally, on ANY screen change");
})();

// ================= (I) render smoke across every shape ===============================================
(function sectionI() {
  console.log("(I) drawMenu() renders the slots screen headlessly — every row state, both modes, no throw");
  let threw = null;
  try {
    const X = onSlots("save", [slotEntry({ wave: 8 }), null, { kind: "snapshot", saved: 0, wave: 1 }]);
    X.drawMenu();
    X.game.menu.index = 1; X.drawMenu();
    X.game.menu.index = 2; X.drawMenu();
    const Y = onSlots("load", [slotEntry({ wave: 2 }), null, { kind: "snapshot", saved: 0, wave: 1 }]);
    Y.drawMenu();
    Y.game.menu.modal = null; Y.game.menu.slotMsg = "Save failed — storage unavailable.";
    Y.drawMenu();
  } catch (e) { threw = e; }
  eq(threw, null, "I: drawMenu() does not throw in any of the above shapes" + (threw ? ": " + threw.message : ""));
  const X = onSlots("save");
  eq(X.AudioSys.ctx, null, "I: ⛔ all of the above ran with no AudioContext — headless-safe throughout");
})();

// ================= (J) scope pin ======================================================================
(function sectionJ() {
  console.log("(J) scope pin — the game file, scratchpad/ and STATUS.md");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("J: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: J: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("J: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (J measured against the WORKING TREE — this phase is not committed yet)");

  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `J: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "J: (setup) the game file is in this phase's diff");
})();

A.report();
