// Headless test for CS031 Phase 3 — the "nameentry" screen: pad grid, keyboard passthrough, validation.
//
//   node scratchpad/test-cs031-p3.js
//
// Drives the REAL code: openNameEntry/menuInput/nameEntryKey/nameEntryCommit/closeNameEntry and the real
// drawMenu(). No grid, cursor or validation rule is reimplemented here — the cell list, the row count and
// the collision test are all read off the build.
//
// TWO TRAPS THIS FILE EXISTS FOR:
//  1. ⛔ The keydown hook cannot be reached behaviourally — the harness's window.addEventListener is a
//     no-op, so the listener is unreferenceable. Its ORDERING (after the secret-code block, after the
//     debug numeric hook) is the whole risk, and ordering is a source fact; §F pins it on the source and
//     drives the function the hook calls (nameEntryKey) directly for behaviour.
//  2. ⛔ Collision is trimmed AND case-insensitive, and rename must EXCLUDE the profile being renamed —
//     "Paul" -> "PAUL" is a legal rename and a rejected add.
//
// Sections: (A) node --check + the three-place wiring. (B) both state declarations. (C) typing, DEL,
// the cap. (D) the grid cursor. (E) validation + commit/abort. (F) ⛔ the keydown hook's shape.
// (G) render smoke. (H) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-31 p2: Profiles.activate()".
const PARENT_SHA = "f2c266efe748d76aacf1295be6d1a51bbc0f2192";
const PHASE_SUBJECT = "cs-31 p3:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// A build with a roster of real profiles, made by the game's own add(), parked on the name screen.
function onScreen(ctx, initial, names = ["Paul", "Ripley"]) {
  const X = buildGame({ store: {} });
  for (const n of names) X.Profiles.add(n);
  X.openNameEntry(ctx, initial);
  return X;
}
// Type a whole string through the RAW path, one character at a time, as a keyboard player would.
const typeIn = (X, s) => { for (const ch of s) X.nameEntryKey(ch); };
// Walk the cursor onto a named cell, then confirm it — the pad player's route to the same acts.
function pressCell(X, label) {
  const i = X.NAME_CELLS.indexOf(label);
  X.game.menu.row = Math.floor(i / X.NAME_GRID_COLS);
  X.game.menu.col = i % X.NAME_GRID_COLS;
  X.menuInput("confirm");
}

// ================= (A) node --check; wired in all THREE places ==================================
(function sectionA() {
  console.log("(A) node --check; menuInput's switch, drawMenu's dispatch, and the closePause route");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs031p3_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  assert(/case "nameentry":\s*menuNameEntry\(action\);/.test(stripped),
    'A: ⛔ menuInput()\'s switch has a "nameentry" case');
  assert(/s === "nameentry"\) drawNameEntry\(\)/.test(stripped),
    "A: ⛔ drawMenu()'s dispatch has a nameentry branch");
  // The third place: `pause` on this screen must go through closePause(), whose title branch lands on
  // the title menu. Driven, not grepped.
  const X = onScreen({ mode: "add" });
  eq(X.game.state, "title", "A: (setup) the build boots at the title");
  X.menuInput("pause");
  eq(X.game.menu.screen, "titlemenu", "A: ⛔ pause on nameentry routes through closePause() to the title menu");
  eq(X.game.paused, false, "A: ...and clears game.paused with it");
})();

// ================= (B) both declaration sites ===================================================
(function sectionB() {
  console.log("(B) nameBuf / nameCtx / nameErr are declared in the game literal AND startGame()'s reset");
  const X = buildGame({ store: {} });
  const m = X.game.menu;
  // ⛔ THE STANDING CS016 P3 RULE. `undefined` in either place is undefined for a whole run — and
  // nameEntryKey reads .length off nameBuf on the very first keystroke.
  eq(m.nameBuf, "", "B: the game literal seeds nameBuf");
  eq(m.nameCtx, null, "B: ...nameCtx");
  eq(m.nameErr, "", "B: ...nameErr");
  X.openNameEntry({ mode: "add" });
  X.nameEntryKey("Q");
  eq(X.game.menu.nameBuf, "Q", "B: (setup) state is genuinely dirty before startGame()");
  X.startGame();
  eq(X.game.menu.nameBuf, "", "B: ⛔ startGame()'s reset clears nameBuf");
  eq(X.game.menu.nameCtx, null, "B: ⛔ ...nameCtx");
  eq(X.game.menu.nameErr, "", "B: ⛔ ...nameErr");
  assert(!("nameBuf" in X.game.menu) === false, "B: (setup) the field is present, not merely falsy");
})();

// ================= (C) typing, backspace, the cap ===============================================
(function sectionC() {
  console.log("(C) typing appends, DEL / Backspace / `back` erase, PROFILE_NAME_MAX caps");
  const X = onScreen({ mode: "add" });
  const MAX = X.PROFILE_NAME_MAX;
  typeIn(X, "Newt");
  eq(X.game.menu.nameBuf, "Newt", "C: raw characters append verbatim — case is PRESERVED");
  X.nameEntryKey("Backspace");
  eq(X.game.menu.nameBuf, "New", "C: Backspace erases one character");
  pressCell(X, X.NAME_CELL_DEL);
  eq(X.game.menu.nameBuf, "Ne", "C: ⛔ confirm on the DEL cell is the same act (the pad's route)");
  pressCell(X, "W");
  eq(X.game.menu.nameBuf, "NeW", "C: ⛔ confirm on a character cell appends that character");
  pressCell(X, " ");
  eq(X.game.menu.nameBuf, "NeW ", "C: ...the space cell included (it is a real charset cell, drawn as a word)");

  // The cap DROPS the keystroke rather than truncating — debugEntryKey's convention.
  const Y = onScreen({ mode: "add" });
  typeIn(Y, "ABCDEFGHIJKLMNOPQRSTUVWXYZ");
  eq(Y.game.menu.nameBuf.length, MAX, `C: ⛔ the buffer caps at PROFILE_NAME_MAX (${MAX})`);
  eq(Y.game.menu.nameBuf, "ABCDEFGHIJKL".slice(0, MAX), "C: ...by dropping the overflow, never by truncating what was already there");
  pressCell(Y, "Z");
  eq(Y.game.menu.nameBuf.length, MAX, "C: ...and the grid path is capped by the same function");

  // Backspace on an empty buffer is inert, not a crash and not an abort.
  const Z = onScreen({ mode: "add" });
  Z.nameEntryKey("Backspace");
  eq(Z.game.menu.nameBuf, "", "C: Backspace on an empty buffer is inert");
  eq(Z.game.menu.screen, "nameentry", "C: ...and does NOT leave the screen (only `back` does that)");

  // ⛔ `back` is backspace-while-typing, abort-when-empty — the pad's B must not need a trip to CANCEL.
  const B = onScreen({ mode: "add" });
  typeIn(B, "Hi");
  B.menuInput("back");
  eq(B.game.menu.nameBuf, "H", "C: ⛔ `back` on a NON-EMPTY buffer backspaces");
  eq(B.game.menu.screen, "nameentry", "C: ...and stays on the screen");
  B.menuInput("back");
  eq(B.game.menu.nameBuf, "", "C: ...again");
  eq(B.game.menu.screen, "nameentry", "C: ...still here, because the buffer was non-empty when the key came in");
  B.menuInput("back");
  eq(B.game.menu.screen, "titlemenu", "C: ⛔ `back` on an EMPTY buffer aborts the screen");
  eq(B.game.menu.nameCtx, null, "C: ...and the context is torn down with it");
})();

// ================= (D) the grid cursor ==========================================================
(function sectionD() {
  console.log("(D) the grid: derived from SCORES_CHARSET, wraps in both axes, never lands off the list");
  const X = onScreen({ mode: "add" });
  const CELLS = X.NAME_CELLS, COLS = X.NAME_GRID_COLS, ROWS = X.NAME_GRID_ROWS;
  eq(CELLS.slice(0, X.SCORES_CHARSET.length).join(""), X.SCORES_CHARSET,
    "D: ⛔ the character cells ARE SCORES_CHARSET, in order — not a retyped alphabet");
  eq(CELLS.slice(-3).join(","), [X.NAME_CELL_DEL, X.NAME_CELL_DONE, X.NAME_CELL_CANCEL].join(","),
    "D: ...followed by exactly the three verb cells");
  eq(ROWS, Math.ceil(CELLS.length / COLS), "D: the row count is DERIVED from the cell count");
  eq(X.game.menu.row + X.game.menu.col, 0, "D: openNameEntry parks the cursor on cell 0");

  X.menuInput("right");
  eq(X.game.menu.col, 1, "D: right moves one column");
  X.menuInput("left"); X.menuInput("left");
  eq(X.game.menu.col, X.nameRowLen(0) - 1, "D: left off column 0 wraps to the end of THAT row");
  X.menuInput("up");
  eq(X.game.menu.row, ROWS - 1, "D: up off row 0 wraps to the last row");
  X.menuInput("down");
  eq(X.game.menu.row, 0, "D: ...and down comes back");

  // ⛔ Every reachable cursor position names a real cell. Walked exhaustively, so a partial last row
  // (which a wider charset or a different column count would create) cannot strand the cursor.
  let bad = 0;
  for (let r = 0; r < ROWS; r++) {
    X.game.menu.row = r; X.game.menu.col = 0;
    for (let c = 0; c < COLS + 2; c++) {
      if (CELLS[X.game.menu.row * COLS + X.game.menu.col] === undefined) bad++;
      X.menuInput("right");
    }
  }
  eq(bad, 0, "D: ⛔ no reachable (row, col) addresses a cell that does not exist");
  // ...and the same on the vertical axis, from the widest column, which is where a partial row bites.
  X.game.menu.row = 0; X.game.menu.col = COLS - 1;
  let badDown = 0;
  for (let i = 0; i < ROWS * 2; i++) {
    X.menuInput("down");
    if (CELLS[X.game.menu.row * COLS + X.game.menu.col] === undefined) badDown++;
  }
  eq(badDown, 0, "D: ⛔ ...moving DOWN from the last column never strands the cursor either");

  // ⛔ THE PARTIAL-ROW CLAMP, MADE NON-VACUOUS. Today's grid is EXACTLY full (37 characters + 3 verbs
  // over 10 columns), so the two walks above cannot reach an out-of-range column and would pass with
  // the clamp deleted. The state a partial last row WOULD create is an out-of-range `col`, so that is
  // what is fed in directly: the next row move must correct it rather than carry it onto a cell that
  // does not exist. If the first assertion here ever flips, the walks above go live on their own.
  eq(CELLS.length % COLS, 0,
    "D: (recorded) the grid is exactly full today — which is why the clamp needs the probe below");
  X.game.menu.row = 0; X.game.menu.col = COLS + 2;
  X.menuInput("down");
  eq(X.game.menu.col, X.nameRowLen(X.game.menu.row) - 1,
    "D: ⛔ an out-of-range column is CLAMPED to the destination row's last real cell");
  assert(CELLS[X.game.menu.row * COLS + X.game.menu.col] !== undefined,
    "D: ⛔ ...so the cursor lands on a cell that exists");
  eq(X.nameRowLen(ROWS - 1), CELLS.length - (ROWS - 1) * COLS,
    "D: nameRowLen() measures the LAST row against the cell count, not against COLS");
})();

// ================= (E) ⛔ validation, commit and abort ==========================================
(function sectionE() {
  console.log("(E) ⛔ validation: empty, whitespace-only, collision (trimmed + case-insensitive), rename's exemption");
  // --- empty / whitespace-only ---
  const E = onScreen({ mode: "add" });
  let committed = null;
  E.game.menu.nameCtx = { mode: "add", onCommit: n => { committed = n; } };
  pressCell(E, E.NAME_CELL_DONE);
  eq(E.game.menu.screen, "nameentry", "E: ⛔ DONE on an EMPTY buffer is refused — the screen stays up");
  eq(E.game.menu.nameErr, E.NAME_ERR_EMPTY, "E: ...with the empty-name message");
  eq(committed, null, "E: ...and nothing was handed off");
  typeIn(E, "   ");
  eq(E.game.menu.nameErr, E.NAME_ERR_EMPTY, "E: ⛔ a WHITESPACE-ONLY buffer reports live, before DONE");
  pressCell(E, E.NAME_CELL_DONE);
  eq(committed, null, "E: ⛔ ...and DONE on it is refused too");

  // --- collision, trimmed and case-insensitive ---
  const C = onScreen({ mode: "add" });
  typeIn(C, "  paul ");
  eq(C.game.menu.nameErr, C.NAME_ERR_TAKEN,
    "E: ⛔ '  paul ' collides with the roster's 'Paul' — trimmed AND case-insensitively");
  let took = null;
  C.game.menu.nameCtx = { mode: "add", onCommit: n => { took = n; } };
  pressCell(C, C.NAME_CELL_DONE);
  eq(took, null, "E: ⛔ ...and DONE on a collision commits nothing");
  eq(C.game.menu.screen, "nameentry", "E: ...the screen stays up so the player can fix it");
  C.nameEntryKey("Backspace");                       // "  paul"
  typeIn(C, "a");                                    // "  paula"
  eq(C.game.menu.nameErr, "", "E: the message clears LIVE as soon as the name is clean again");
  pressCell(C, C.NAME_CELL_DONE);
  eq(took, "paula", "E: ⛔ the committed string is TRIMMED, and the caller's closure got it");
  eq(C.game.menu.screen, "titlemenu", "E: ...and commit left the screen, back to whoever raised it");
  eq(C.game.menu.nameBuf, "", "E: ...with the buffer torn down");
  eq(C.game.menu.nameCtx, null, "E: ...⛔ and nameCtx cleared BEFORE the closure ran (it is free to navigate)");
  eq(C.Profiles.roster.length, 2, "E: ⛔ P3 CREATED NOTHING — the roster is untouched; P4 owns the verb");
  eq(C.Profiles.nameOf("p0"), "Paul", "E: ⛔ ...and renamed nothing");

  // --- rename: its OWN name in a different case is ACCEPTED ---
  const R = onScreen({ mode: "rename", id: "p0" }, "Paul");
  eq(R.game.menu.nameBuf, "Paul", "E: (setup) a rename opens prefilled with the current name");
  for (let i = 0; i < 4; i++) R.nameEntryKey("Backspace");
  typeIn(R, "PAUL");
  eq(R.game.menu.nameErr, "", "E: ⛔ 'Paul' -> 'PAUL' is CLEAN — rename excludes the profile being renamed");
  let renamed = null;
  R.game.menu.nameCtx = { mode: "rename", id: "p0", onCommit: n => { renamed = n; } };
  pressCell(R, R.NAME_CELL_DONE);
  eq(renamed, "PAUL", "E: ⛔ ...and it commits");
  eq(R.Profiles.nameOf("p0"), "Paul", "E: ⛔ ...while P3 itself still renamed nothing");
  // The exemption is narrow: another profile's name is still a collision in rename mode.
  const R2 = onScreen({ mode: "rename", id: "p0" }, "Paul");
  for (let i = 0; i < 4; i++) R2.nameEntryKey("Backspace");
  typeIn(R2, "ripley");
  eq(R2.game.menu.nameErr, R2.NAME_ERR_TAKEN,
    "E: ⛔ ...but a DIFFERENT profile's name still collides in rename mode");
  // ...and an ADD of that same string is a collision, which is what makes the exemption non-vacuous.
  const R3 = onScreen({ mode: "add" });
  typeIn(R3, "PAUL");
  eq(R3.game.menu.nameErr, R3.NAME_ERR_TAKEN, "E: (non-vacuous) 'PAUL' as an ADD is rejected");

  // --- CANCEL, and the commit-time re-check ---
  const K = onScreen({ mode: "add" });
  let never = null;
  K.game.menu.nameCtx = { mode: "add", onCommit: n => { never = n; } };
  typeIn(K, "Bishop");
  pressCell(K, K.NAME_CELL_CANCEL);
  eq(K.game.menu.screen, "titlemenu", "E: CANCEL aborts to the raising screen");
  eq(never, null, "E: ...and hands nothing off");
  // ⛔ nameErr is a DISPLAY field, never the gate: a stale clean nameErr must not let a bad name through.
  const S = onScreen({ mode: "add" });
  S.game.menu.nameBuf = "Ripley";   // set behind the live path's back, exactly as a prefill does
  S.game.menu.nameErr = "";
  let leaked = null;
  S.game.menu.nameCtx = { mode: "add", onCommit: n => { leaked = n; } };
  pressCell(S, S.NAME_CELL_DONE);
  eq(leaked, null, "E: ⛔ commit RE-VALIDATES — a clean-looking nameErr is not the gate");
  eq(S.game.menu.nameErr, S.NAME_ERR_TAKEN, "E: ...and the message is raised at commit time");

  // The `back` route to a raising screen other than the title, which is what P4 will pass.
  const P = onScreen({ mode: "add", back: "options", backIndex: 2 });
  P.menuInput("back");
  eq(P.game.menu.screen, "options", "E: nameCtx.back names the screen the abort returns to");
  eq(P.game.menu.index, 2, "E: ...and backIndex restores that screen's cursor");
})();

// ================= (F) ⛔ the keydown hook's shape and PLACEMENT ================================
(function sectionF() {
  console.log("(F) ⛔ the raw keydown hook: gated, consumed, placed after both prior claimants");
  const iCode  = stripped.indexOf("DebugCode.armed = true;");           // the secret-code capture window
  const iDebug = stripped.indexOf("debugEntryKey(e.key);");             // the debug numeric hook
  const iName  = stripped.indexOf("nameEntryKey(e.key);");              // ours
  assert(iCode > 0 && iDebug > 0 && iName > 0, "F: (setup) all three keydown claimants found in source");
  assert(iCode < iName, "F: ⛔ the block sits AFTER the secret-code window — a live window keeps first claim");
  assert(iDebug < iName, "F: ⛔ ...and after the debug numeric-entry hook it is modelled on");

  // The gate itself, read off the source: screen, code window, rebind, modal, entry, repeat, and the
  // two accepted key shapes.
  const gate = stripped.slice(stripped.lastIndexOf("if (", iName), iName);
  assert(/game\.menu\.screen === "nameentry"/.test(gate), 'F: ⛔ gated on screen === "nameentry"');
  assert(/!DebugCode\.armed/.test(gate), "F: ⛔ gated on !DebugCode.armed");
  assert(/!game\.menu\.rebinding/.test(gate), "F: gated on !game.menu.rebinding");
  assert(/!game\.menu\.modal/.test(gate), "F: gated on !game.menu.modal");
  assert(/!game\.entry/.test(gate), "F: gated on !game.entry");
  assert(/!e\.repeat/.test(gate), "F: ⛔ honours e.repeat, like both surrounding handlers");
  assert(/e\.key\.length === 1/.test(gate), "F: accepts single printable characters");
  assert(/e\.key === "Backspace"/.test(gate), "F: ...and Backspace");
  const body = stripped.slice(iName - 240, iName + 40);
  assert(/e\.preventDefault\(\);\s*nameEntryKey\(e\.key\);\s*return;/.test(body),
    "F: ⛔ preventDefault + return — Backspace cannot navigate the browser back, a character cannot reach handleMenuKey");
  // ⛔ ENTER and ESC stay on the ABSTRACT layer so gamepad A/B commit and cancel identically.
  assert(!/Enter/.test(gate) && !/Escape/.test(gate),
    "F: ⛔ the hook does NOT claim Enter/Escape — they stay abstract confirm/back");

  // Behaviour of the function the hook calls, on the two keys the hook admits. (The listener itself is
  // unreferenceable — the harness's window.addEventListener is a no-op — so this is where the raw path
  // is exercised; the ordering above is the part that could only ever be a source fact.)
  const X = onScreen({ mode: "add" });
  X.nameEntryKey("w"); X.nameEntryKey("s"); X.nameEntryKey("p");
  eq(X.game.menu.nameBuf, "wsp",
    "F: ⛔ w / s / p are TEXT on this screen, not nav or pause — a text field cannot swallow its own letters");
  eq(X.game.menu.row + X.game.menu.col, 0, "F: ...and the grid cursor did not move while typing");
})();

// ================= (G) render smoke =============================================================
(function sectionG() {
  console.log("(G) drawMenu() renders the screen headlessly, in both modes and with an error showing");
  for (const ctx of [{ mode: "add" }, { mode: "rename", id: "p0" }]) {
    const X = onScreen(ctx, ctx.mode === "rename" ? "Paul" : "");
    let threw = null;
    // Cleared through the real path first, so the rename mode's prefill doesn't leave "PaulRipley".
    try {
      X.drawMenu();
      while (X.game.menu.nameBuf.length) X.nameEntryKey("Backspace");
      typeIn(X, "Ripley");
      X.drawMenu();
    } catch (e) { threw = e; }
    eq(threw, null, `G: drawMenu() on the ${ctx.mode} screen does not throw` + (threw ? ": " + threw.message : ""));
    eq(X.game.menu.nameErr, X.NAME_ERR_TAKEN, "G: (setup) ...with an inline error actually on screen");
    // Every cell has to be drawable: the grid is walked, not sampled.
    X.game.menu.row = X.NAME_GRID_ROWS - 1; X.game.menu.col = X.nameRowLen(X.NAME_GRID_ROWS - 1) - 1;
    try { X.drawMenu(); } catch (e) { threw = e; }
    eq(threw, null, "G: ...and with the cursor on the very last cell");
  }
  const X = onScreen({ mode: "add" });
  eq(X.nameCellLabel(" "), "SPACE", "G: the space cell draws a WORD — an invisible cell is not a cell");
  eq(X.nameCellLabel("Q"), "Q", "G: ...every other character cell draws itself");
  eq(X.AudioSys.ctx, null, "G: ⛔ all of the above ran with no AudioContext — headless-safe throughout");
})();

// ================= (H) scope pin ================================================================
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
