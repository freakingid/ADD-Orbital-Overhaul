// Headless test for CS032 Phase 5 — the purge: a deleted profile's save slots go with its settings
// and achievements, on both purge paths.
//
//   node scratchpad/test-cs032-p5.js
//
// Drives the REAL code via _harness.js: Profiles.add/activate, profileDelete(), SaveSlots itself.
// Nothing about a purge or a slot read is reimplemented here.
//
// THE TRAP THIS FILE EXISTS FOR: the two purge paths are genuinely different code
// (removeProfileStores() vs. blankLegacyStores()), and both needed the slot purge added
// independently — a fix to one silently leaves the other's saves key stranded in localStorage.
//
// Sections: (A) non-legacy delete removes that profile's afd_saves_v1:pN and no other's.
// (B) p0 delete blanks p0's slots (through the guarded write path, not removeItem) and leaves every
// other profile's slots intact. (C) deleting the ACTIVE profile clears the deleted id's slots, not
// the newly-active one's. (D) per-profile isolation across activate() — write, switch, read empty.
// (E) quitToTitle() writes no slot. (F) node --check. (G) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-32 p4: menu wiring".
const PARENT_SHA = "95f9643";
const PHASE_SUBJECT = "cs-32 p5:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();

// A slot payload of the shape buildSaveEntry() produces (P3/P4's fixture, trimmed to what P5 reads).
function slotEntry(over) {
  return Object.assign({
    kind: "wave", saved: 1700000000000, profileName: "P", wave: 6, score: 1234, hp: 100,
    nextRepair: 10000, scoopLevel: 0, scoopHits: 0,
    powerBudget: { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 },
    stats: { powerUsed: { rapid: false, triple: false, magnet: false, engine: false } },
    debugRun: false,
  }, over || {});
}

// A build with a real roster, backed by an inspectable store object. A fresh, empty store means
// Profiles.init() finds no roster and no legacy probe (FORK-CS031 first-boot), so the FIRST add()
// mints "p0" — the id PROFILE_LEGACY names. "Paul" always goes first so p0 plays the legacy role
// deliberately, and every name in `names` mints p1, p2, ... in order (the same shape
// test-cs031-p4.js's own onScreen() helper relies on).
function withRoster(names, store = {}) {
  const X = buildGame({ store });
  X.Profiles.add("Paul");
  for (const n of names) X.Profiles.add(n);
  return X;
}

// ================= (A) non-legacy delete removes that profile's saves key, and no other's ===========
(function sectionA() {
  console.log("(A) deleting a non-legacy profile removes its afd_saves_v1:pN and leaves every other's alone");
  const store = {};
  const X = withRoster(["Ripley", "Newt"], store);   // p0 (legacy, untouched here), p1 Ripley, p2 Newt

  X.Profiles.activate("p1");
  X.SaveSlots.write(0, slotEntry({ wave: 3 }));
  X.Profiles.activate("p2");
  X.SaveSlots.write(0, slotEntry({ wave: 9 }));
  X.Profiles.activate("p0");   // back to legacy, so p1/p2 are both non-active at delete time

  assert("afd_saves_v1:p1" in store, "A: (setup) Ripley's saves key exists");
  assert("afd_saves_v1:p2" in store, "A: (setup) Newt's saves key exists");

  eq(X.profileDelete("p1"), true, "A: profileDelete succeeds on a non-active profile");
  assert(!("afd_saves_v1:p1" in store), "A: ⛔ Ripley's saves key is gone from the store");
  assert("afd_saves_v1:p2" in store, "A: ⛔ Newt's saves key SURVIVES — the purge is scoped to the one id");
  eq(JSON.parse(store["afd_saves_v1:p2"]).slots[0].wave, 9, "A: ⛔ ...and its contents are untouched");

  // The other two frozen-adjacent stores go with it too, same as CS031 P4's own purge (not re-tested
  // here in depth — just confirmed the new remove sits beside the two existing ones, not instead of).
  assert(!("afd_settings_v1:p1" in store) && !("afd_achievements_v2:p1" in store),
    "A: (sanity) the two pre-existing removes still fire alongside the new one");

  // Structural: the new line sits in removeProfileStores(), beside the two it was asked to join.
  const fn = src.slice(src.indexOf("function removeProfileStores(id) {"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert(/ls\.removeItem\(SAVES_KEY \+ ":" \+ id\)/.test(body),
    "A: ⛔ removeProfileStores() removes SAVES_KEY + \":\" + id");
  assert(/ls\.removeItem\(STORAGE_KEY \+ ":" \+ id\)/.test(body) && /ls\.removeItem\(Achievements\.STORAGE_KEY \+ ":" \+ id\)/.test(body),
    "A: ...the two pre-existing removes are still there, unmoved");
})();

// ================= (B) p0 delete blanks p0's slots through the guarded write path ====================
(function sectionB() {
  console.log("(B) ⛔ deleting p0 blanks p0's OWN slots (never removeItem) and leaves every other profile's intact");
  const store = {};
  const X = withRoster(["Ripley"], store);   // p0 active by default

  X.SaveSlots.write(0, slotEntry({ wave: 4 }));
  X.SaveSlots.write(2, slotEntry({ wave: 7 }));
  X.Profiles.activate("p1");
  X.SaveSlots.write(1, slotEntry({ wave: 11 }));
  X.Profiles.activate("p0");   // p0 active again at delete time

  assert("afd_saves_v1" in store, "B: (setup) p0's bare saves key exists");
  eq(X.profileDelete("p0"), true, "B: profileDelete succeeds on p0");

  assert("afd_saves_v1" in store, "B: ⛔ the bare key still EXISTS — never removeItem'd");
  const blanked = JSON.parse(store.afd_saves_v1);
  eq(JSON.stringify(blanked.slots), JSON.stringify([null, null, null]), "B: ⛔ ...but every slot reads back empty");

  assert("afd_saves_v1:p1" in store, "B: ⛔ Ripley's own suffixed saves key survives, untouched by the p0 detour");
  eq(JSON.parse(store["afd_saves_v1:p1"]).slots[1].wave, 11, "B: ⛔ ...and her data is exactly what she wrote");
  eq(X.Profiles.activeId, "p1", "B: (sanity) Ripley became active — the sole remaining profile");

  // Driven a second shape: p0 NOT active at the moment of deletion (the detour through
  // blankLegacyStores must still land on p0's own bare key, not whoever was active).
  const store2 = {};
  const Y = withRoster(["Ripley"], store2);
  Y.Profiles.activate("p1");
  Y.saveSettings();
  Y.SaveSlots.write(0, slotEntry({ wave: 2 }));   // p0's own slot, written while p1 is active
  Y.Profiles.activate("p0");
  Y.SaveSlots.write(0, slotEntry({ wave: 5 }));
  Y.Profiles.activate("p1");   // Ripley active at delete time

  eq(Y.profileDelete("p0"), true, "B: profileDelete succeeds on p0 (non-active case)");
  const blanked2 = JSON.parse(store2.afd_saves_v1);
  eq(JSON.stringify(blanked2.slots), JSON.stringify([null, null, null]), "B: ⛔ p0's bare key is still blanked");
  eq(Y.Profiles.activeId, "p1", "B: ⛔ Ripley, never touched by this delete, is still active");

  // Structural: blankLegacyStores() clears through SaveSlots.clear(), never a raw removeItem on SAVES_KEY.
  const fn = src.slice(src.indexOf("function blankLegacyStores(keepActiveId) {"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert(/SaveSlots\.clear\(/.test(body), "B: ⛔ blankLegacyStores() clears through SaveSlots.clear()");
  assert(!/removeItem\(SAVES_KEY\)/.test(body), "B: ⛔ ...and never a raw removeItem(SAVES_KEY)");
})();

// ================= (C) deleting the ACTIVE profile clears the deleted id's slots, not the new one's ==
(function sectionC() {
  console.log("(C) deleting the ACTIVE profile purges the DELETED id's slots, leaving the newly-active one's alone");
  const store = {};
  const X = withRoster(["Ripley", "Newt"], store);   // roster order [p0 Paul, p1 Ripley, p2 Newt]
  X.SaveSlots.write(0, slotEntry({ wave: 4 }));       // p0 (Paul) writes its own slot while active
  X.Profiles.activate("p1");                          // Ripley active — the one about to be deleted
  X.SaveSlots.write(0, slotEntry({ wave: 8 }));

  eq(X.Profiles.activeId, "p1", "C: (setup) Ripley is active");
  eq(X.profileDelete("p1"), true, "C: profileDelete succeeds on the ACTIVE profile");
  // profileDelete()'s own ordering (unreordered by this phase): keepActive is the roster's first
  // surviving entry, so deleting p1 out of [p0, p1, p2] hands activeId back to p0 — Paul, not Newt.
  eq(X.Profiles.activeId, "p0", "C: ⛔ activeId moved off the deleted profile, onto the roster's next survivor");
  assert(!("afd_saves_v1:p1" in store), "C: ⛔ the DELETED profile's (Ripley's) saves key is gone");

  // The newly-active profile's (Paul's/p0's) own slot is exactly what it wrote before the delete —
  // read back through the switched-to runtime, not a stale store snapshot. p0's purge is
  // blankLegacyStores()'s job, not removeProfileStores()'s, and this delete took the non-legacy path
  // (id !== PROFILE_LEGACY), so p0's own data must be completely unaffected by it.
  eq(X.SaveSlots.read()[0].wave, 4, "C: ⛔ the newly-active profile's (Paul's) slot 0 is untouched — still wave 4");

  // Newt (p2), never active for this delete, is also untouched — a broader isolation check than the
  // spec strictly asks for, but the same purge that could clear "the deleted one's slots" could just
  // as easily clear "everyone else's" by accident, and this rules that out too.
  X.Profiles.activate("p2");
  eq(X.SaveSlots.count(), 0, "C: ⛔ Newt, never active for this delete, still has zero slots of her own");
})();

// ================= (D) per-profile isolation across activate() =======================================
(function sectionD() {
  console.log("(D) write under A, switch to B, read back empty; switch back to A, read the original write");
  const X = withRoster(["Ripley", "Newt"]);
  X.Profiles.activate("p1");
  eq(X.SaveSlots.count(), 0, "D: (setup) Ripley starts with zero slots");
  X.SaveSlots.write(0, slotEntry({ wave: 5 }));
  eq(X.SaveSlots.count(), 1, "D: (setup) the write landed under Ripley");

  X.Profiles.activate("p2");
  eq(X.SaveSlots.count(), 0, "D: ⛔ Newt reads zero slots — SaveSlots is lazy and re-reads through keyFor()");
  eq(X.SaveSlots.read()[0], null, "D: ⛔ ...specifically, slot 0 is empty under Newt, not Ripley's entry");

  X.Profiles.activate("p1");
  eq(X.SaveSlots.count(), 1, "D: ⛔ switching back to Ripley reads her write straight back — no cache to invalidate");
  eq(X.SaveSlots.read()[0].wave, 5, "D: ⛔ ...and it is exactly what she wrote");

  // Profiles.activate() itself needed no change — confirmed by grep: the function body mentions
  // neither SaveSlots nor SAVES_KEY, so the isolation above is entirely keyFor() doing its job at
  // call time, not a switch-time flush/reload this phase had to add.
  const fn = src.slice(src.indexOf("  activate(id) {"));
  const body = fn.slice(0, fn.indexOf("\n  }\n};"));
  assert(!/SaveSlots/.test(body) && !/SAVES_KEY/.test(body),
    "D: ⛔ Profiles.activate() touches neither SaveSlots nor SAVES_KEY — isolation is read-fresh, not flushed");
})();

// ================= (E) quitToTitle() writes no slot ====================================================
(function sectionE() {
  console.log("(E) ⛔ quitToTitle() mid-run does not write a slot — save is explicit only, no autosave");
  const X = buildGame({ store: {} });
  X.startGame();
  eq(X.SaveSlots.count(), 0, "E: (setup) a fresh run has zero slots");

  const realWrite = X.SaveSlots.write;
  let writeCalls = 0;
  X.SaveSlots.write = function (...a) { writeCalls++; return realWrite.apply(this, a); };
  X.quitToTitle();
  eq(writeCalls, 0, "E: ⛔ SaveSlots.write() was never called by quitToTitle()");
  eq(X.SaveSlots.count(), 0, "E: ⛔ ...and the slot table is still empty afterward");
  eq(X.game.state, "title", "E: (sanity) quitToTitle() did land at the title");

  // Structural: quitToTitle()'s own body names neither SaveSlots nor buildSaveEntry.
  const fn = src.slice(src.indexOf("function quitToTitle() {"));
  const body = fn.slice(0, fn.indexOf("\n}"));
  assert(!/SaveSlots/.test(body) && !/buildSaveEntry/.test(body),
    "E: ⛔ quitToTitle()'s body mentions neither SaveSlots nor buildSaveEntry — untouched by this phase");
})();

// ================= (F) node --check =================================================================
(function sectionF() {
  console.log("(F) node --check on the extracted <script>");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs032p5_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }
})();

// ================= (G) scope pin ====================================================================
(function sectionG() {
  console.log("(G) scope pin — the game file, scratchpad/ and STATUS.md");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("G: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: G: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("G: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (G measured against the WORKING TREE — this phase is not committed yet)");

  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `G: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "G: (setup) the game file is in this phase's diff");
})();

A.report();
