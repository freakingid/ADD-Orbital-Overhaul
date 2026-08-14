// Headless test for CS032 Phase 1 — the SaveSlots store and buildSaveEntry(), the data-model half
// of Save Game with no restore logic and no menu wiring.
//
//   node scratchpad/test-cs032-p1.js
//
// Drives the REAL code: buildSaveEntry() reads a live `game` built by the game's own startGame(),
// and SaveSlots read()/write()/clear()/count() go through the real Profiles.keyFor() and the real
// storageOK() guard. Nothing here is reimplemented.
//
// THE TRAP THIS FILE EXISTS FOR (§B, spec ⛔): game.stats.powerUsed is a nested object. A bare
// `{ ...game.stats }` leaves it ALIASED to the live run, so a slot would silently keep rewriting
// itself as play continues past the save point — §B mutates the live run after capture and asserts
// the returned entry did not move.
// SECOND TRAP (§E): the corruption matrix's last case, a slot holding an unrecognised `kind`, must
// come back as DATA (not be coerced to null/"empty") — recognising `kind` is the slots screen's
// (P3) job, not the store's. The spec's own shorthand list is written with the array literal
// showing only the occupied slot; this file pads it to the required 3-length envelope, which is
// what the ⛔ "wrong-length array resolves to three empties" rule actually governs.
//
// Sections: (A) node --check + module shapes. (B) buildSaveEntry() field-for-field, live. (C) ⛔ the
// non-aliasing pin. (D) debugRun captured from a debug-knob run. (E) write/read round-trip. (F) the
// corruption matrix. (G) per-profile isolation. (H) write() reports a storage failure. (I) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");
const { installSeed } = require("./_seeded-random.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "Doc updates prior to cs032". The planning docs'
// stated baseline (faa8d35, "cs-31 p7") is one commit stale: 282c901 landed the CS032 planning docs
// themselves (and archived CS031's) BEFORE P1 started, so it is HEAD at the moment this phase began
// and the correct parent for this pin — not this phase's own business, and not faa8d35 either.
const PARENT_SHA = "282c901";
const PHASE_SUBJECT = "cs-32 p1:";

const restoreRandom = installSeed(20320001);   // above the first build(), per _seeded-random.js's header

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);
const countOf = (text, needle) => text.split(needle).length - 1;

// ================= (A) node --check; the module's shape and placement ============================
(function sectionA() {
  console.log("(A) node --check; SaveSlots/buildSaveEntry exist, own key, guarded idiom");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs032p1_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  assert(/const SAVES_KEY\s*=\s*"afd_saves_v1";/.test(stripped), "A: the new key is afd_saves_v1, spelled exactly");
  // ⛔ NOT a schema bump on any of the four existing keys.
  for (const k of ['"afd_settings_v1"', '"afd_achievements_v2"', '"afd_scores_v1"', '"afd_profiles_v1"']) {
    assert(stripped.includes(k), `A: the frozen/existing key ${k} is untouched`);
  }
  eq(countOf(stripped, "ls.setItem(Profiles.keyFor(SAVES_KEY)"), 1, "A: SaveSlots writes through keyFor()");
  eq(countOf(stripped, "ls.getItem(Profiles.keyFor(SAVES_KEY))"), 1, "A: SaveSlots reads through keyFor()");
  // ⛔ Lazy: no boot-time call. Profiles.init() must not mention SaveSlots.
  const iInit = stripped.indexOf("\n  init() {");
  const iBoot = stripped.indexOf("\nProfiles.init();");
  assert(iInit > 0 && iBoot > 0, "A: (setup) both anchors found");
  assert(!/SaveSlots/.test(stripped.slice(iInit, iInit + 1500)), "A: ⛔ Profiles.init()'s body never mentions SaveSlots");
  // ⛔ REPOINTED BY CS032 P3 — the slots screen gives SaveSlots.read() its first two real callers
  // (menuSlots()/drawSlots()), so a textual "zero call sites in the whole build" count is no longer
  // the right proxy for what this trap actually protects: LAZINESS, i.e. nothing reads the store at
  // BOOT. Driven behaviourally instead of textually, so it stays correct no matter how many later
  // phases add real (non-boot) callers — a Proxy `store` records every key `buildGame()` alone
  // touches, before any menu action ever runs.
  const touched = new Set();
  const spyStore = new Proxy({}, {
    has(t, p) { if (typeof p === "string" && p.indexOf("afd_saves_v1") === 0) touched.add(p); return p in t; },
    get(t, p) { if (typeof p === "string" && p.indexOf("afd_saves_v1") === 0) touched.add(p); return t[p]; },
  });
  buildGame({ store: spyStore });
  eq(touched.size, 0, "A: ⛔ SaveSlots' own key is never touched by buildGame() alone — still lazy at boot");
})();

// A run with every captured field pushed off its startGame() default, via the real code only.
function seededRun(X) {
  X.startGame();
  X.game.score = 48300;
  X.game.wave = 12;
  X.game.ship.hp = 42;
  X.game.nextRepair = 60000;
  X.game.scoopLevel = 3;
  X.game.scoopHits = 4;
  X.game.powerBudget = { rapid: 5, triple: 2, magnet: 1, engine: 3, guard: 1 };
  X.game.stats.delivered = 17;
  X.game.stats.powerUsed = { rapid: true, triple: false, magnet: true, engine: false };
  return X;
}

// ================= (B) buildSaveEntry() matches the live run, field for field ====================
(function sectionB() {
  console.log("(B) buildSaveEntry() against a seeded live run matches every field 1:1");
  const X = buildGame({ store: {} });
  seededRun(X);
  const before = Date.now();
  const e = X.buildSaveEntry();
  const after = Date.now();

  eq(e.kind, "wave", "B: kind is the FORK-H forward-door discriminator");
  assert(e.saved >= before && e.saved <= after, "B: saved is a live Date.now() timestamp");
  eq(e.profileName, X.Profiles.nameOf(X.Profiles.activeId), "B: profileName is a display stamp of the active profile");
  eq(e.wave, 12, "B: wave");
  eq(e.score, 48300, "B: score");
  eq(e.hp, 42, "B: hp");
  eq(e.nextRepair, 60000, "B: nextRepair");
  eq(e.scoopLevel, 3, "B: scoopLevel");
  eq(e.scoopHits, 4, "B: scoopHits");
  eq(JSON.stringify(e.powerBudget), JSON.stringify({ rapid: 5, triple: 2, magnet: 1, engine: 3, guard: 1 }), "B: powerBudget");
  eq(e.stats.delivered, 17, "B: stats.delivered");
  eq(JSON.stringify(e.stats.powerUsed), JSON.stringify({ rapid: true, triple: false, magnet: true, engine: false }), "B: stats.powerUsed");
  eq(e.debugRun, false, "B: debugRun false for a plain run");

  // ⛔ Deliberately absent fields — none of the excluded ones leak onto the entry.
  for (const f of ["checkpoint", "cargoMax", "worldSize", "chain", "garbage", "debris",
                    "powerBank", "powerBankAmt", "magnetHoldT", "cargoWasFull", "comboGrace",
                    "sweepPause", "deliveryCount", "resumedRun"]) {
    assert(!(f in e), `B: ⛔ '${f}' is deliberately absent from the save entry`);
  }
})();

// ================= (C) ⛔ NON-ALIASING — the nested-object trap ===================================
(function sectionC() {
  console.log("(C) ⛔ mutating the live run AFTER capture does not move the returned entry");
  const X = buildGame({ store: {} });
  seededRun(X);
  const e = X.buildSaveEntry();
  const snapPowerUsed = JSON.stringify(e.stats.powerUsed);
  const snapBudget = JSON.stringify(e.powerBudget);

  X.game.stats.powerUsed.rapid = !X.game.stats.powerUsed.rapid;
  X.game.powerBudget.rapid = X.game.powerBudget.rapid + 100;

  eq(JSON.stringify(e.stats.powerUsed), snapPowerUsed, "C: ⛔ entry.stats.powerUsed is UNCHANGED after mutating the live run's nested object");
  eq(JSON.stringify(e.powerBudget), snapBudget, "C: ⛔ entry.powerBudget is UNCHANGED after mutating the live run's powerBudget");
  assert(e.stats.powerUsed !== X.game.stats.powerUsed, "C: (non-vacuous) the two powerUsed objects are not the same reference");
  assert(e.powerBudget !== X.game.powerBudget, "C: (non-vacuous) the two powerBudget objects are not the same reference");
})();

// ================= (D) debugRun captured true from a debug-knob run ===============================
(function sectionD() {
  console.log("(D) debugRun is captured true when the run was started via DEBUG.startLevel > 1, false at 1");
  const X = buildGame({ store: {} });
  X.applyDebug("startLevel", 1);
  seededRun(X);
  eq(X.buildSaveEntry().debugRun, false, "D: startLevel 1 -> debugRun false, captured");

  const Y = buildGame({ store: {} });
  Y.applyDebug("startLevel", 33);
  seededRun(Y);
  eq(Y.game.debugRun, true, "D: (setup) startLevel 33 sets the sticky flag");
  eq(Y.buildSaveEntry().debugRun, true, "D: ⛔ ...and buildSaveEntry() carries it through");
})();

// ================= (E) write -> read round-trip through a stubbed store ===========================
(function sectionE() {
  console.log("(E) write()/read() round-trip a save entry byte-for-byte through the guarded store");
  const store = {};
  const X = buildGame({ store });
  seededRun(X);
  const entry = X.buildSaveEntry();

  eq(X.SaveSlots.read().join(","), [null, null, null].join(","), "E: (setup) three empty slots before any write");
  const ok = X.SaveSlots.write(1, entry);
  eq(ok, true, "E: write() reports success");
  eq(X.SaveSlots.count(), 1, "E: count() reflects the one occupied slot");

  const back = X.SaveSlots.read();
  eq(back[0], null, "E: slot 0 is untouched");
  eq(back[2], null, "E: slot 2 is untouched");
  eq(JSON.stringify(back[1]), JSON.stringify(entry), "E: ⛔ slot 1 round-trips DEEP-EQUAL to what was written");

  // A second build reading the same store gets the same slots — proves it is genuinely persisted,
  // not just held in the live SaveSlots object.
  const Y = buildGame({ store });
  eq(JSON.stringify(Y.SaveSlots.read()[1]), JSON.stringify(entry), "E: a fresh build reads the same persisted slot back");

  eq(X.SaveSlots.clear(1), true, "E: clear() reports success");
  eq(X.SaveSlots.count(), 0, "E: ...and the slot is gone");
})();

// ================= (F) corruption matrix — never throws, resolves to a sane default ================
(function sectionF() {
  console.log("(F) absent / unreadable / wrong-v / non-array / wrong-length all resolve to three empties, without throwing");
  const key = "afd_saves_v1";   // legacy profile (p0, the default activeId) reads/writes this verbatim
  const emptyCases = {
    "absent key":            null,
    "unparseable JSON":      "{",
    "wrong v":               JSON.stringify({ v: 2, slots: [null, null, null] }),
    "slots not an array":    JSON.stringify({ v: 1, slots: "x" }),
    "slots wrong length (0)": JSON.stringify({ v: 1, slots: [] }),
  };
  for (const [label, raw] of Object.entries(emptyCases)) {
    const store = raw === null ? {} : { [key]: raw };
    let threw = false, X = null;
    try { X = buildGame({ store }); } catch (e) { threw = true; }
    assert(!threw, `F: ⛔ ${label} does not crash the build`);
    if (X) eq(X.SaveSlots.read().join(","), [null, null, null].join(","), `F: ${label} resolves to three empty slots`);
  }

  // ⛔ THE UNREADABLE-NOT-EMPTY CASE (spec §E's last entry): a properly-shaped 3-slot envelope
  // holding an entry with an unrecognised `kind` comes back as DATA, not null. Recognising `kind`
  // (rendering it as "— UNREADABLE —") is the slots screen's (P3) job; SaveSlots only validates the
  // ENVELOPE (v, array-ness, length), never a slot's own contents.
  const snapshotStore = { [key]: JSON.stringify({ v: 1, slots: [{ kind: "snapshot" }, null, null] }) };
  let threw2 = false, Z = null;
  try { Z = buildGame({ store: snapshotStore }); } catch (e) { threw2 = true; }
  assert(!threw2, "F: ⛔ a slot with an unrecognised kind does not crash the build");
  const zSlots = Z.SaveSlots.read();
  assert(zSlots[0] !== null, "F: ⛔ the unrecognised-kind slot is NOT coerced to empty");
  eq(zSlots[0].kind, "snapshot", "F: ...its content is handed back opaque, unchanged");
  eq(zSlots[1], null, "F: ...the other two slots are still genuinely empty");
})();

// ================= (G) per-profile isolation ========================================================
(function sectionG() {
  console.log("(G) a save written under one profile is invisible after switching to another");
  const store = {};
  const X = buildGame({ store });
  const P = X.Profiles;
  P.add("Alpha"); P.add("Bravo");                 // -> p0 (legacy), p1
  eq(P.activeId, "p0", "G: (setup) p0 is active by default");

  seededRun(X);
  const entry = X.buildSaveEntry();
  X.SaveSlots.write(0, entry);
  eq(X.SaveSlots.count(), 1, "G: (setup) p0 has one save");

  assert(P.activate("p1"), "G: (setup) switch to Bravo (p1)");
  eq(X.SaveSlots.read().join(","), [null, null, null].join(","), "G: ⛔ p1 sees three empty slots — p0's save did not leak");
  eq(X.SaveSlots.count(), 0, "G: ...count() agrees");

  assert(store["afd_saves_v1"] !== undefined, "G: (setup) p0's save landed on the frozen, un-suffixed key");
  assert(store["afd_saves_v1:p1"] === undefined, "G: ...and switching to p1 wrote nothing new");

  assert(P.activate("p0"), "G: switch back to p0");
  eq(JSON.stringify(X.SaveSlots.read()[0]), JSON.stringify(entry), "G: ⛔ p0's own save is still exactly there");
})();

// ================= (H) write() reports a storage failure ===========================================
(function sectionH() {
  console.log("(H) write() returns false (never throws) when the underlying store throws");
  const X = buildGame({ store: {} });
  seededRun(X);
  const entry = X.buildSaveEntry();

  // Break localStorage.setItem AFTER boot, the same shape every guarded-write test in the suite uses:
  // storageOK() re-reads the global `localStorage` binding the factory closed over, so replacing its
  // methods post-boot is visible to every subsequent call without rebuilding.
  const ls = X.probe("localStorage");
  const realSetItem = ls.setItem;
  ls.setItem = () => { throw new Error("quota exceeded"); };
  let threw = false, ok = null;
  try { ok = X.SaveSlots.write(0, entry); } catch (e) { threw = true; }
  ls.setItem = realSetItem;

  assert(!threw, "H: ⛔ a throwing store does not propagate out of write()");
  eq(ok, false, "H: ⛔ write() reports failure as a boolean, not silently");
  eq(X.SaveSlots.read().join(","), [null, null, null].join(","), "H: ...and nothing was actually persisted");
})();

// ================= (I) scope pin ====================================================================
(function sectionI() {
  console.log("(I) scope pin — the game file, this test, and STATUS.md, nothing else");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("I: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: I: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("I: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (I measured against the WORKING TREE — this phase is not committed yet)");

  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `I: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "I: (setup) the game file is in this phase's diff");
})();

restoreRandom();
A.report();
