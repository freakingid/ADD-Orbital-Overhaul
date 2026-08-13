// Headless test for CS031 Phase 4 — the "profiles" screen: roster list, add/rename/delete, switch.
//
//   node scratchpad/test-cs031-p4.js
//
// Drives the REAL code: Profiles.add/rename/remove/activate, openModal, openNameEntry, and the real
// menuProfiles()/drawProfiles(). No roster op or store write is reimplemented here.
//
// THE TRAP THIS FILE EXISTS FOR: deleting p0 must never removeItem the two frozen keys, but must still
// leave them holding an EMPTY blob — not p0's stale real data, and not whatever profile is switched to
// next. §F drives blankLegacyStores() through the screen in three shapes (p0 active, p0 not active, p0
// the only OTHER profile) and inspects the store bytes directly each time, with the currently-active
// profile's own live settings used as a canary that must survive untouched.
//
// Sections: (A) node --check + the three-place wiring. (B) Add + the PROFILE_MAX cap idiom. (C) Switch,
// end-to-end (no bleed). (D) Rename via the verb column. (E) Delete non-active / ACTIVE, store cleanup,
// activeId never dangling. (F) ⛔ delete p0 — frozen keys survive, empty, in every active/inactive shape.
// (G) guards: last-remaining refused, the modal's CANCEL default is untouched, empty-roster back/pause.
// (H) the verb-column cursor shape. (I) render smoke. (J) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-31 p3: name-entry screen".
const PARENT_SHA = "6a56c3ca275c845d62c96cad01f75f03c3ff806c";
const PHASE_SUBJECT = "cs-31 p4:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// Brace-matched slice of a block, from the declaration through its closing brace (P1/P2's helper).
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

// A build parked on the profiles screen with a real roster, made by the game's own add().
function onScreen(names = ["Paul", "Ripley", "Newt"], store = {}) {
  const X = buildGame({ store });
  for (const n of names) X.Profiles.add(n);
  X.gotoScreen("profiles");
  return X;
}
// Walk the cursor onto a profile row + verb, then confirm — mirrors a pad player's route.
function pressVerb(X, rowIndex, verb) {
  X.game.menu.index = rowIndex;
  X.game.menu.col = X.PROFILE_VERBS.indexOf(verb);
  X.menuInput("confirm");
}
// Confirm an open modal at its CONFIRM row (index 0) — the deliberate cursor move away from safety.
function confirmModal(X) {
  X.game.menu.modal.index = 0;
  X.menuInput("confirm");
}

// ================= (A) node --check; wired in all THREE places ==================================
(function sectionA() {
  console.log("(A) node --check; menuInput's switch, drawMenu's dispatch, and the closePause route");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs031p4_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  assert(/case "profiles":\s*menuProfiles\(action\);/.test(stripped),
    'A: ⛔ menuInput()\'s switch has a "profiles" case');
  assert(/s === "profiles"\) drawProfiles\(\)/.test(stripped),
    "A: ⛔ drawMenu()'s dispatch has a profiles branch");
  // The third place: `pause` on this screen must go through closePause(), whose title branch lands on
  // the title menu. Driven, not grepped.
  const X = onScreen();
  eq(X.game.state, "title", "A: (setup) the build boots at the title");
  X.menuInput("pause");
  eq(X.game.menu.screen, "titlemenu", "A: ⛔ pause on profiles routes through closePause() to the title menu");
  eq(X.game.paused, false, "A: ...and clears game.paused with it");
})();

// ================= (B) Add + the PROFILE_MAX cap idiom ===========================================
(function sectionB() {
  console.log("(B) confirm on Add Profile opens nameentry{mode:add}; roster grows on commit; the cap dims and no-ops");
  const store = {};
  const X = onScreen(["Paul"], store);
  X.menuInput("down");   // off Paul's row, onto the trailing Add Profile row
  eq(X.game.menu.index, 1, "B: (setup) row 1 is the trailing Add Profile row for a 1-profile roster");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "nameentry", "B: confirm on Add Profile opens the name-entry screen");
  eq(X.game.menu.nameCtx.mode, "add", 'B: ⛔ ...with nameCtx { mode: "add" }');
  eq(X.game.menu.nameCtx.back, "profiles", "B: ...and returns to profiles, not the title, on commit/cancel");

  for (const ch of "Ripley") X.nameEntryKey(ch);
  const i = X.NAME_CELLS.indexOf(X.NAME_CELL_DONE);
  X.game.menu.row = Math.floor(i / X.NAME_GRID_COLS); X.game.menu.col = i % X.NAME_GRID_COLS;
  X.menuInput("confirm");
  eq(X.game.menu.screen, "profiles", "B: commit lands back on profiles");
  eq(X.Profiles.roster.length, 2, "B: ⛔ the roster grew");
  eq(X.Profiles.roster[1].name, "Ripley", "B: ...with the typed name");
  assert(!("afd_settings_v1:" + X.Profiles.roster[1].id in store),
    "B: ⛔ add() writes the roster only — the new profile's OWN store does not exist yet");
  eq(X.settings.captions, true, "B: ...and reading defaults for it means the live shipped default, untouched");

  // The cap: PROFILE_MAX profiles, confirm on Add is inert (shared unavailable-row idiom).
  const Y = onScreen([]);
  for (let n = 0; n < Y.PROFILE_MAX; n++) Y.Profiles.add("P" + n);
  eq(Y.Profiles.roster.length, Y.PROFILE_MAX, "B: (setup) roster at PROFILE_MAX");
  Y.game.menu.index = Y.Profiles.roster.length;
  Y.menuInput("confirm");
  eq(Y.game.menu.screen, "profiles", "B: ⛔ confirm on Add Profile AT THE CAP does nothing — no nameentry opened");
  eq(Y.Profiles.roster.length, Y.PROFILE_MAX, "B: ...and the roster did not grow");
  // The dim color, read off drawProfiles()'s own source — the shared idiom, not a re-derived one.
  const fn = blockAt(stripped, stripped.indexOf("\nfunction drawProfiles() {") + 1);
  assert(fn.length > 0, "B: (setup) drawProfiles() brace-matched");
  assert(/roster\.length >= PROFILE_MAX \? COLOR\.dim/.test(fn),
    "B: ⛔ the Add row forces COLOR.dim at the cap, focused or not — MENU_ROOT_PLAY's Save idiom");
})();

// ================= (C) Switch, end-to-end (no bleed) =============================================
(function sectionC() {
  console.log("(C) confirm on a profile (default verb SWITCH) calls Profiles.activate() and returns to the title menu");
  const X = onScreen(["Paul", "Ripley"]);
  X.settings.captions = false; X.saveSettings();       // Paul (p0, active) customises and saves
  eq(X.game.menu.col, 0, "C: (setup) the default verb column is 0 = SWITCH — no left/right needed");

  pressVerb(X, 1, "SWITCH");
  eq(X.Profiles.activeId, "p1", "C: ⛔ activeId moved to the profile that was confirmed");
  eq(X.game.menu.screen, "titlemenu", "C: ⛔ ...and the screen returned to the title menu");
  // P2's own no-bleed contract, exercised through the SCREEN rather than calling activate() directly.
  eq(X.settings.captions, true, "C: ⛔ Ripley (a fresh profile) got the SHIPPED default, not Paul's saved `false`");
  eq(X.Achievements.lifetime.delivered, 0, "C: ⛔ ...and a zeroed lifetime counter, not inherited progress");

  X.gotoScreen("profiles");        // confirm's own SWITCH branch left us at the title; re-enter to switch again
  pressVerb(X, 0, "SWITCH");
  eq(X.Profiles.activeId, "p0", "C: switching back...");
  eq(X.settings.captions, false, "C: ⛔ ...restores Paul's own saved settings — the outgoing flush round-trips");
})();

// ================= (D) Rename via the verb column =================================================
(function sectionD() {
  console.log("(D) cycling to RENAME opens nameentry prefilled with the row's own name; commit renames that profile");
  const X = onScreen(["Paul", "Ripley"]);
  X.game.menu.index = 1;
  X.menuInput("right");
  eq(X.PROFILE_VERBS[X.game.menu.col], "RENAME", "D: right from SWITCH lands on RENAME");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "nameentry", "D: confirm on RENAME opens name-entry");
  eq(X.game.menu.nameCtx.mode, "rename", "D: ⛔ ...in rename mode");
  eq(X.game.menu.nameCtx.id, "p1", "D: ...naming the profile that was highlighted, not the active one");
  eq(X.game.menu.nameBuf, "Ripley", "D: ⛔ ...prefilled with its CURRENT name");

  while (X.game.menu.nameBuf.length) X.nameEntryKey("Backspace");
  for (const ch of "Newt") X.nameEntryKey(ch);
  const i = X.NAME_CELLS.indexOf(X.NAME_CELL_DONE);
  X.game.menu.row = Math.floor(i / X.NAME_GRID_COLS); X.game.menu.col = i % X.NAME_GRID_COLS;
  X.menuInput("confirm");
  eq(X.Profiles.nameOf("p1"), "Newt", "D: ⛔ the commit renamed the ROW's profile");
  eq(X.game.menu.screen, "profiles", "D: ...and returned to profiles (nameCtx.back), not the title");
  eq(X.Profiles.roster.length, 2, "D: ⛔ rename created nothing — still two profiles");
})();

// ================= (E) Delete non-active / ACTIVE ==================================================
(function sectionE() {
  console.log("(E) delete non-active drops the roster row and its suffixed store; delete ACTIVE re-activates another");
  const store = {};
  const X = onScreen(["Paul", "Ripley", "Newt"], store);
  X.Profiles.activate("p2");                // Newt gets a real store
  X.settings.musicTrack = "warehouse"; X.saveSettings();
  X.Profiles.activate("p0");                 // back to Paul; Newt is now non-active with real data
  assert("afd_settings_v1:p2" in store, "E: (setup) Newt's own suffixed store exists");

  pressVerb(X, X.Profiles.roster.findIndex(p => p.id === "p2"), "DELETE");
  eq(X.game.menu.modal.index, 1, "E: ⛔ the confirmation dialog opens on CANCEL (index 1) — the safety property");
  confirmModal(X);
  eq(X.Profiles.roster.find(p => p.id === "p2"), undefined, "E: ⛔ the non-active profile is gone from the roster");
  assert(!("afd_settings_v1:p2" in store), "E: ⛔ ...and its suffixed settings key is gone from the store");
  assert(!("afd_achievements_v2:p2" in store), "E: ⛔ ...its suffixed achievements key too");
  eq(X.Profiles.activeId, "p0", "E: ...activeId, untouched, since Paul was never the one deleted");

  const Y = onScreen(["Paul", "Ripley", "Newt"]);
  Y.Profiles.activate("p1");                 // Ripley is ACTIVE
  Y.settings.captions = false; Y.saveSettings();
  pressVerb(Y, Y.Profiles.roster.findIndex(p => p.id === "p1"), "DELETE");
  confirmModal(Y);
  eq(Y.Profiles.roster.find(p => p.id === "p1"), undefined, "E: the ACTIVE profile is gone from the roster");
  eq(Y.Profiles.activeId === "p1", false, "E: ⛔ activeId is NEVER left dangling at the removed profile");
  assert(Y.Profiles.byId(Y.Profiles.activeId) !== null, "E: ⛔ ...it names a profile that still exists");
})();

// ================= (F) ⛔ delete p0 — frozen keys survive, empty, never removed ===================
(function sectionF() {
  console.log("(F) ⛔ deleting p0 blanks its frozen keys through the guarded save paths — active, non-active, and sole-other shapes");

  // --- p0 active at the moment of deletion ---
  const store1 = {};
  const X = onScreen(["Paul", "Ripley"], store1);
  X.settings.captions = false; X.settings.autoShield = true;
  X.Achievements.lifetime.delivered = 500;
  X.saveSettings(); X.Achievements.save();
  pressVerb(X, 0, "DELETE");
  confirmModal(X);
  eq(X.Profiles.byId("p0"), null, "F: p0 is gone from the roster");
  assert("afd_settings_v1" in store1, "F: ⛔ the frozen settings key still EXISTS");
  assert("afd_achievements_v2" in store1, "F: ⛔ ...and the frozen achievements key too — neither was removeItem'd");
  const s1 = JSON.parse(store1.afd_settings_v1);
  eq(s1.captions, true, "F: ⛔ the frozen blob holds the SHIPPED default, not Paul's real `false`");
  eq(s1.autoShield, false, "F: ⛔ ...for every field");
  eq(JSON.parse(store1.afd_achievements_v2).lifetime.delivered, 0, "F: ⛔ ...and a zeroed lifetime counter, not Paul's 500");
  eq(X.Profiles.activeId, "p1", "F: Ripley became active");
  eq(X.settings.captions, true, "F: (Ripley is a fresh profile, so this happens to also be the default)");

  // --- p0 NOT active; the currently-active profile's own live data is the canary ---
  const store2 = {};
  const Y = onScreen(["Paul", "Ripley"], store2);
  Y.Profiles.activate("p1");                 // Ripley active
  Y.settings.musicTrack = "warehouse"; Y.saveSettings();
  pressVerb(Y, Y.Profiles.roster.findIndex(p => p.id === "p0"), "DELETE");
  confirmModal(Y);
  eq(Y.Profiles.byId("p0"), null, "F: p0 gone from the roster (non-active case)");
  assert("afd_settings_v1" in store2, "F: ⛔ the frozen key still exists");
  eq(JSON.parse(store2.afd_settings_v1).musicTrack, "zen", "F: ⛔ ...holding the shipped default, not whatever Paul last had");
  eq(Y.Profiles.activeId, "p1", "F: ⛔ Ripley, who was never touched by this delete, is STILL active");
  eq(Y.settings.musicTrack, "warehouse", "F: ⛔ ...and her own live runtime is untouched by blanking a stranger's keys");
  // Her own suffixed key legitimately exists (her own saveSettings() above wrote it) — the canary is
  // that ITS CONTENT is her own real data, not defaults left behind by the p0 detour re-flushing it.
  eq(JSON.parse(store2["afd_settings_v1:p1"]).musicTrack, "warehouse",
    "F: ⛔ ...and her OWN suffixed store still holds her real data, not defaults from the p0 detour");

  // --- p0 is the SOLE other profile (roster shrinks to exactly one afterward) ---
  const store3 = {};
  const Z = onScreen(["Paul", "Ripley"], store3);
  Z.Profiles.remove("p1");                   // roster-only op (P1's), leaves just p0 — a legal setup
  Z.Profiles.roster.push({ id: "p2", name: "Solo", created: 0 }); Z.Profiles.seq = 3;
  pressVerb(Z, Z.Profiles.roster.findIndex(p => p.id === "p0"), "DELETE");
  confirmModal(Z);
  eq(Z.Profiles.roster.length, 1, "F: (setup) exactly one profile remains");
  eq(Z.Profiles.activeId, "p2", "F: ⛔ the sole remaining profile is active, not dangling");
  assert("afd_settings_v1" in store3, "F: ⛔ the frozen key survives this shape too");
})();

// ================= (G) guards ======================================================================
(function sectionG() {
  console.log("(G) last-remaining refused; the modal's CANCEL default actually cancels; empty roster traps back/pause");
  const X = onScreen(["Solo"]);
  pressVerb(X, 0, "DELETE");
  eq(X.game.menu.modal, null, "G: ⛔ DELETE on the LAST remaining profile never even opens the confirmation");
  eq(X.Profiles.roster.length, 1, "G: ...and nothing changed");

  // The modal's index-1 (CANCEL) default is untouched: confirming WITHOUT moving the cursor cancels.
  const Y = onScreen(["Paul", "Ripley"]);
  pressVerb(Y, 0, "DELETE");
  assert(Y.game.menu.modal !== null, "G: (setup) two profiles, so DELETE does open the dialog");
  eq(Y.game.menu.modal.index, 1, "G: ⛔ opens on CANCEL");
  Y.menuInput("confirm");                    // confirm WITHOUT moving — must cancel, not delete
  eq(Y.game.menu.modal, null, "G: the dialog closed");
  eq(Y.Profiles.roster.length, 2, "G: ⛔ ...and nothing was deleted — the safety property held");

  // ⛔ FORK-E: an empty roster's only row is Add Profile; back/pause must not escape it.
  const Z = onScreen([]);
  eq(Z.Profiles.roster.length, 0, "G: (setup) a genuinely empty roster");
  eq(Z.game.menu.index, 0, "G: ...and the cursor sits on the one row there is");
  Z.menuInput("back");
  eq(Z.game.menu.screen, "profiles", "G: ⛔ `back` on an empty roster does NOT escape to the title");
  Z.menuInput("pause");
  eq(Z.game.menu.screen, "profiles", "G: ⛔ ...nor does `pause`");
  // Left/right on the Add Profile row (no verb column applies to it) is inert, not a crash.
  Z.menuInput("right");
  eq(Z.game.menu.col, 0, "G: left/right on the Add Profile row does not move a verb cursor that does not apply to it");
})();

// ================= (H) the verb-column cursor shape ================================================
(function sectionH() {
  console.log("(H) col cycles through exactly PROFILE_VERBS, wraps both ways, and resets to 0 on every row move");
  const X = onScreen(["Paul", "Ripley"]);
  eq(X.PROFILE_VERBS.join(","), "SWITCH,RENAME,DELETE", "H: (recorded) the verb order — SWITCH first, so a bare confirm switches");
  eq(X.game.menu.col, 0, "H: (setup) parks on SWITCH");
  X.menuInput("left");
  eq(X.PROFILE_VERBS[X.game.menu.col], "DELETE", "H: ⛔ left off SWITCH wraps to the LAST verb");
  X.menuInput("right");
  eq(X.PROFILE_VERBS[X.game.menu.col], "SWITCH", "H: ...and right comes back");
  X.menuInput("right"); X.menuInput("right"); X.menuInput("right");
  eq(X.PROFILE_VERBS[X.game.menu.col], "SWITCH", "H: ⛔ three rights from a clean SWITCH wrap all the way around (3 verbs)");

  X.game.menu.col = 2;                       // leave the cursor on DELETE...
  X.menuInput("down");
  eq(X.game.menu.col, 0, "H: ⛔ moving to a DIFFERENT row resets the verb column to 0 (SWITCH) — no leftover DELETE");
})();

// ================= (I) render smoke =================================================================
(function sectionI() {
  console.log("(I) drawMenu() renders the roster screen headlessly — populated, at the cap, and empty");
  let threw = null;
  try {
    const X = onScreen(["Paul", "Ripley"]);
    X.drawMenu();
    X.game.menu.index = 1; X.game.menu.col = 2;   // DELETE highlighted on a real row
    X.drawMenu();
    const Y = onScreen([]);
    for (let n = 0; n < Y.PROFILE_MAX; n++) Y.Profiles.add("P" + n);
    Y.gotoScreen("profiles");
    Y.game.menu.index = Y.Profiles.roster.length;  // the dimmed, capped Add row
    Y.drawMenu();
    const Z = onScreen([]);                        // the empty-roster shape
    Z.drawMenu();
  } catch (e) { threw = e; }
  eq(threw, null, "I: drawMenu() does not throw in any of the three shapes" + (threw ? ": " + threw.message : ""));
  const X = onScreen(["Paul"]);
  eq(X.AudioSys.ctx, null, "I: ⛔ all of the above ran with no AudioContext — headless-safe throughout");
})();

// ================= (J) scope pin ====================================================================
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
