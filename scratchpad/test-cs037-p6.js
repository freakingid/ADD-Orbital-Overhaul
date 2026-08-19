// Headless test for CS037 P6 — the resume achievement baseline + the targeted merge write
// (PLANNED-FEATURES-CS037.md §6 and §2.2, IMPLEMENTATION-PHASES-CS037.md P6).
//
//   node scratchpad/test-cs037-p6.js
//
// This phase owns: Achievements.resumeBaseline + snapshotResumeBaseline(), the two baseline reads
// inside evaluate(), Achievements.mergeUnlock(), the clear in resetRun() and the snapshot's PLACEMENT
// inside resumeFromSave(). It does not own drawToasts(), save()'s shipped gate, or deriveLifetime() —
// those are driven or pinned here, never re-implemented.
//
// Four traps worth knowing:
//   * The weekly ACTIVE SET rotates with the real calendar week, so every section forces
//     Achievements.activeIds to all 16 ids BEFORE resuming — the snapshot reads activeWeekly().
//   * `master_field` / `no_powerups` are MAX lifetime counters that nextWave() credits AFTER the
//     snapshot, so a store whose maxWave is below the slot's wave toasts tiers for reasons that have
//     nothing to do with this phase. Every store here carries a realistic maxWave, and the slot
//     carries powerupsPicked > 0, which is what closes nextWave()'s own maxWaveNoPowerup gate.
//   * Nulling resumeBaseline mid-run is NOT the pre-P6 build: mergeUnlock() then treats the flood as
//     post-baseline and persists it. §C reconstructs the real pre-P6 build by source mutation instead.
//   * A tiered cur() reads only the lifetime counters, which a resume does not overwrite, so the tier
//     floor is a no-op on the shipped path. §E reaches it the one way a player can — an achievements
//     reset (lifetimeTiers emptied) followed by a resume.

"use strict";
const { installSeed } = require("./_seeded-random.js");
installSeed(20260819);

const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

const raw = scriptSource();
const stripped = execSource(raw);
const countOf = (text, needle) => text.split(needle).length - 1;
const fnBody = (text, sig) => { const i = text.indexOf(sig); return i < 0 ? "" : text.slice(i, text.indexOf("\n}\n", i)); };
const methodBody = (text, sig) => { const i = text.indexOf(sig); return i < 0 ? "" : text.slice(i, text.indexOf("\n  },", i)); };

// ---- fixtures ------------------------------------------------------------------------------
// One throwaway build answers the two things every store below needs: which key the legacy profile
// resolves to, and which ISO week this process is running in.
const probe = buildGame({ store: {} });
const ACH_KEY = probe.Profiles.keyFor(probe.Achievements.STORAGE_KEY);
const WEEK_KEY = probe.Achievements.weekKey;
const WEEKLY_IDS = probe.Achievements.WEEKLY.map(a => a.id);
const TIERED_IDS = probe.Achievements.LIFETIME.filter(a => a.tiers).map(a => a.id);

// A returning player's persisted lifetime progress. Every counter is far enough along that init()'s
// deriveLifetime() settles the badges silently, so nothing below toasts for a reason this phase
// does not own. maxWave 30 > any slot wave used here; maxWaveNoPowerup is high enough that
// nextWave()'s MAX bump cannot cross a tier even if its gate ever opened.
const STORED_LIFETIME = {
  delivered: 1200, deliveryScore: 500, fullChains: 3, hunterKills: 60, saucerKills: 300,
  hitsSurvived: 120, perfectWaves: 6, playTime: 3600, maxWave: 30, maxWaveNoPowerup: 25,
  smallSaucerKills: 150, bestDeliveredGame: 45, bestDebrisGame: 90, heavyHaulerEvents: 12,
  pacifistTowEvents: 11, glassCannonGames: 6, shieldSurferGames: 7
};
function mkStore(over = {}) {
  const blob = {
    lifetime: { ...STORED_LIFETIME, ...(over.lifetime || {}) },
    lifetimeTiers: over.lifetimeTiers || {},
    lifetimeUnlocked: over.lifetimeUnlocked || [],
    weekly: over.weekly || { key: WEEK_KEY, unlocked: [] }
  };
  return { [ACH_KEY]: JSON.stringify(blob) };
}
const readBlob = store => JSON.parse(store[ACH_KEY]);

// A stats-rich save slot: 15 of the 16 weeklies already satisfied at the save moment, plus both of
// the LIFETIME ids that read per-game stats (C7-rev). waste_not is deliberately NOT satisfied — it
// needs gameEnded, and it is this file's genuine post-load crossing.
const RICH = {
  delivered: 40, fullChainVisit: true, maxChainVisit: true, bestCombo: 12, speedRecycler: true,
  pacifistBest: 9, debrisKills: 60, hunterLineComplete: true, largeHunterKills: 5,
  smallSaucerKills: 20, deflects: 30, healthPicked: 0, noScratchWave3: true,
  flawlessLateWave: true, closeShave: true, everBelowHalf: false, hunterCoalesced: 0,
  gameEnded: false, powerupsPicked: 4
};
// Build a slot entry through the REAL buildSaveEntry(), from a real run staged to `wave`.
function mkEntry(wave, over = {}) {
  const X = buildGame({ store: mkStore() });
  X.startGame();
  X.game.wave = wave;
  Object.assign(X.game.stats, RICH, over.stats || {});
  X.game.stats.powerUsed = { rapid: true, triple: true, magnet: true, engine: true };
  const e = X.buildSaveEntry();
  if (over.debugRun !== undefined) e.debugRun = over.debugRun;
  return e;
}
// A fresh browser session that loads `entry`. activeIds is widened to all 16 BEFORE the resume so
// the snapshot (which walks activeWeekly()) covers the whole weekly pool deterministically.
function resumeIn(store, entry) {
  const X = buildGame({ store });
  X.Achievements.activeIds = WEEKLY_IDS.slice();
  X.Achievements._saveAccum = 1e9;          // no periodic flush mid-section
  X.resumeFromSave(entry);
  return X;
}
const toastNames = X => X.game.toasts.map(t => t.name);

// ================= (A) shape: the module state, the two new methods, the call sites =================
(function sectionA() {
  console.log("(A) shape — resumeBaseline, snapshotResumeBaseline(), mergeUnlock(), and their one call site each");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs037p6_extracted.js");
  fs.writeFileSync(tmp, raw);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const X = buildGame({ store: {} });
  eq(X.Achievements.resumeBaseline, null, "A: the module boots with no baseline");
  eq(typeof X.Achievements.snapshotResumeBaseline, "function", "A: snapshotResumeBaseline() exists");
  eq(typeof X.Achievements.mergeUnlock, "function", "A: mergeUnlock() exists");
  X.startGame();
  eq(X.Achievements.resumeBaseline, null, "A: ⛔ a FRESH run carries no baseline");

  // The baseline is module state, not a game.* field — which is what keeps it clear of CS016 P3.
  assert(!("resumeBaseline" in X.game), "A: ⛔ the baseline is NOT a field on game (the CS016 P3 both-places trap)");
  assert(/resumeBaseline: null/.test(stripped), "A: ...it is declared on the Achievements literal");

  // One writer, one clearer, one snapshot call site, one merge call site.
  eq(countOf(stripped, "snapshotResumeBaseline()"), 2, "A: ⛔ snapshotResumeBaseline — one definition, one call site");
  eq(countOf(stripped, "Achievements.snapshotResumeBaseline();"), 1, "A: ...and the call is qualified, from outside the module");
  eq(countOf(stripped, "Achievements.resumeBaseline = null;"), 1, "A: ⛔ exactly one site clears the baseline");
  assert(/Achievements\.resumeBaseline = null;/.test(fnBody(stripped, "function resetRun(wave, debugRun) {")),
    "A: ⛔ ...and it is inside resetRun(), so BOTH run paths get it");
  assert(/Achievements\.snapshotResumeBaseline\(\);/.test(fnBody(stripped, "function resumeFromSave(entry) {")),
    "A: ⛔ the snapshot is taken inside resumeFromSave()");
  eq(countOf(stripped, "mergeUnlock("), 2, "A: ⛔ mergeUnlock — one definition, one call site");
  assert(/this\.mergeUnlock\(ach, tierIdx\);/.test(methodBody(stripped, "onUnlock(ach, tierIdx) {")),
    "A: ⛔ ...and the call site is onUnlock(), beside the save() it complements");

  // ⛔ save()'s own shipped gate is untouched, and the single-flag form stays absent (test-cs032-p2 §M).
  assert(/save\(\) \{\s*if \(game\.debugRun \|\| game\.resumedRun\) return;/.test(stripped),
    "A: ⛔ Achievements.save()'s CS032 P2 gate is byte-unchanged");
  eq(countOf(stripped, "if (game.debugRun) return;"), 0, "A: ⛔ ...and P6 introduced no single-flag debugRun return");
  const merge = methodBody(stripped, "mergeUnlock(ach, tierIdx) {");
  assert(merge.length > 0, "A: (setup) mergeUnlock's body was located");
  assert(/game\.debugRun/.test(merge), "A: ⛔ mergeUnlock bars a debug run");
  assert(/!game\.resumedRun/.test(merge), "A: ⛔ ...and returns for every non-resumed run (save() owns those)");
  assert(/if \(Bench\.running\) return;/.test(merge), "A: ⛔ ...and carries the CS037 P2 seal guard");
  assert(/Profiles\.keyFor\(this\.STORAGE_KEY\)/.test(merge), "A: ⛔ per-profile key, CS031 P1");
  assert(!/this\.lifetime\b/.test(merge), "A: ⛔ mergeUnlock never reads the in-memory lifetime counters");
  assert(!/lifetime:/.test(merge), "A: ⛔ ...and never writes a lifetime section of its own");
  assert(/if \(!raw\) return;/.test(merge), "A: ⛔ no stored blob -> write nothing (init()'s v1-migration branch survives)");

  // ⛔ The snapshot marks NOTHING. Source-level half of §I.
  const snap = methodBody(stripped, "snapshotResumeBaseline() {");
  assert(snap.length > 0, "A: (setup) snapshotResumeBaseline's body was located");
  for (const name of ["weeklyUnlocked", "lifetimeUnlocked", "lifetimeTiers"])
    assert(!snap.includes(name), `A: ⛔ the snapshot never names ${name}`);
  assert(!snap.includes(".add("), "A: ⛔ ...and never adds to a Set");
  assert(/activeWeekly\(\)/.test(snap) && /this\.LIFETIME/.test(snap),
    "A: ⛔ BLANKET — the snapshot walks BOTH pools (spec C7-rev)");

  // The ⛔ INVARIANT comment names the baseline, per the phase prompt.
  assert(/INVARIANT — STEP 2 PRECEDES STEPS 3 AND 5/.test(raw),
    "A: ⛔ resumeFromSave()'s ordering invariant now names the baseline as a second reader");
  assert(/INVARIANT — AND STEP 3 PRECEDES STEP 5/.test(raw),
    "A: ⛔ ...and states the baseline's own reason for preceding nextWave()");
})();

// ================= (B) the flood: a stats-rich resume toasts NOTHING ================================
(function sectionB() {
  console.log("(B) a resume from a stats-rich slot raises no banner on the first evaluate()");
  const entry = mkEntry(12);
  const store = mkStore();
  const X = resumeIn(store, entry);
  const Ach = X.Achievements;

  eq(X.game.wave, 12, "B: (setup) the slot's own wave landed");
  eq(X.game.stats.delivered, 40, "B: (setup) the slot's stats landed");
  eq(X.game.toasts.length, 0, "B: ⛔ the snapshot itself raises no banner");
  eq(Object.keys(Ach.resumeBaseline).length, WEEKLY_IDS.length + Ach.LIFETIME.length,
    "B: ⛔ the baseline covers all 16 weeklies + all 20 lifetime — blanket, both pools");

  // Non-vacuity first: how many of the 16 were ALREADY satisfied at the save moment?
  const preSatisfied = WEEKLY_IDS.filter(id => {
    const a = Ach.byId[id];
    return a.cur(X.game.stats, Ach.lifetime) >= a.goal;
  });
  eq(preSatisfied.length, 15, "B: (non-vacuous) 15 of the 16 weeklies are satisfied by the loaded stats");
  assert(!preSatisfied.includes("waste_not"), "B: (non-vacuous) ...and waste_not is the one that is not");

  for (let i = 0; i < 3; i++) Ach.evaluate();
  eq(X.game.toasts.length, 0, "B: ⛔ three evaluate() passes raise ZERO banners");
  eq(X.game.pendingAch.length, 0, "B: ⛔ ...and bank nothing for the celebration panel");
  eq(Ach.weeklyUnlocked.size, 0, "B: ⛔ no weekly entered the unlock set");
  for (const id of preSatisfied) assert(!Ach.weeklyUnlocked.has(id), `B: ⛔ ${id} was satisfied at load, so it does not unlock`);
  for (const id of ["untouchable", "max_haul"])
    assert(!Ach.lifetimeUnlocked.has(id), `B: ⛔ ${id} (LIFETIME, reads per-game stats) does not unlock either`);

  // TEETH — the pre-P6 build, reconstructed by source mutation, floods on the identical input.
  const HEADSRC = preP6Source();
  const Y = buildGame({ source: HEADSRC, store: mkStore() });
  Y.Achievements.activeIds = WEEKLY_IDS.slice();
  Y.Achievements._saveAccum = 1e9;
  Y.resumeFromSave(mkEntry(12));
  Y.Achievements.evaluate();
  assert(Y.game.toasts.length >= 15, `B: (teeth) the pre-P6 build floods — ${Y.game.toasts.length} banners at once`);
  assert(Y.Achievements.weeklyUnlocked.size >= 15, "B: (teeth) ...and 15+ weeklies unlock on one frame");
  assert(Y.game.toasts.length > X.game.toasts.length, "B: (teeth) ...so the pin above is doing work");
  // ⛔ No banner-display gating: the stacked banners are the shipped behaviour, unchanged.
  assert(Y.game.toasts.length === Y.game.pendingAch.length,
    "B: ⛔ drawToasts() still stacks — every unlock is banked and banner-ed, one for one");
})();

// The pre-P6 build: this phase's three behavioural lines removed, everything else byte-identical.
function preP6Source() {
  const GATE  = "      if (base && base[ach.id] >= ach.goal) return;\n";
  const FLOOR = "      if (base && ach.id in base && base[ach.id] > reached) reached = base[ach.id];\n";
  const MERGE = "    this.mergeUnlock(ach, tierIdx);\n";
  assert(raw.includes(GATE),  "  (pre-P6) the checkSingle baseline gate is present in the build, verbatim");
  assert(raw.includes(FLOOR), "  (pre-P6) the tiered baseline floor is present in the build, verbatim");
  assert(raw.includes(MERGE), "  (pre-P6) the mergeUnlock call is present in the build, verbatim");
  return raw.replace(GATE, "").replace(FLOOR, "").replace(MERGE, "");
}

// ================= (C) untouchable + max_haul, and the leak they cause ==============================
(function sectionC() {
  console.log("(C) ⛔ C7-rev — untouchable and max_haul are LIFETIME, read per-game stats, and leak");
  const entry = mkEntry(12);
  const store = mkStore();
  const X = resumeIn(store, entry);
  const Ach = X.Achievements;

  eq(Ach.resumeBaseline.untouchable, 1, "C: ⛔ untouchable baselines at 1 — wave 11 at the snapshot, never below half");
  eq(Ach.resumeBaseline.max_haul, 1, "C: ⛔ max_haul baselines at 1 — the slot carries maxChainVisit");
  eq(Ach.byId.untouchable.goal, 1, "C: (setup) both are goal-1 …");
  eq(Ach.byId.max_haul.goal, 1, "C: (setup) … and non-tiered, so both run through checkSingle");
  assert(!Ach.byId.untouchable.tiers && !Ach.byId.max_haul.tiers, "C: (setup) neither is tiered");

  Ach.evaluate();
  assert(!Ach.lifetimeUnlocked.has("untouchable"), "C: ⛔ untouchable does not enter lifetimeUnlocked");
  assert(!Ach.lifetimeUnlocked.has("max_haul"), "C: ⛔ max_haul does not enter lifetimeUnlocked");
  assert(!toastNames(X).some(n => /Untouchable|Maxed Out/.test(n)), "C: ⛔ ...and neither raises a banner");

  // ⛔ The leak, end to end: a FRESH run later in the same session persists whatever is in the set.
  X.startGame();
  eq(X.game.resumedRun, false, "C: (setup) the next run is not a resumed one …");
  eq(X.game.debugRun, false, "C: (setup) … nor a debug one, so save() is unsuppressed");
  X.Achievements.save();
  const after = readBlob(store);
  assert(!after.lifetimeUnlocked.includes("untouchable"), "C: ⛔ the next run's save() does NOT persist untouchable");
  assert(!after.lifetimeUnlocked.includes("max_haul"), "C: ⛔ ...nor max_haul");

  // TEETH — the same three steps on the reconstructed pre-P6 build put both into afd_achievements_v2.
  const store2 = mkStore();
  const Y = buildGame({ source: preP6Source(), store: store2 });
  Y.Achievements.activeIds = WEEKLY_IDS.slice();
  Y.Achievements._saveAccum = 1e9;
  const before2 = store2[ACH_KEY];
  Y.resumeFromSave(mkEntry(12));
  Y.Achievements.evaluate();
  assert(Y.Achievements.lifetimeUnlocked.has("untouchable"), "C: (teeth) pre-P6, untouchable unlocks in memory …");
  assert(Y.Achievements.lifetimeUnlocked.has("max_haul"), "C: (teeth) … and so does max_haul");
  eq(store2[ACH_KEY], before2, "C: (teeth) CS032 P2 keeps them off disk DURING the resumed run …");
  Y.startGame();
  Y.Achievements.save();
  const leaked = readBlob(store2);
  assert(leaked.lifetimeUnlocked.includes("untouchable"), "C: ⛔ (teeth) … and the NEXT run banks untouchable — the shipping bug");
  assert(leaked.lifetimeUnlocked.includes("max_haul"), "C: ⛔ (teeth) … and max_haul with it");

  // And a GENUINE max_haul after the load still unlocks: the baseline is a floor, not a lockout.
  const Z = resumeIn(mkStore(), mkEntry(12, { stats: { maxChainVisit: false } }));
  eq(Z.Achievements.resumeBaseline.max_haul, 0, "C: a slot with no 24-haul baselines max_haul at 0");
  Z.Achievements.evaluate();
  assert(!Z.Achievements.lifetimeUnlocked.has("max_haul"), "C: (setup) ...and it is not unlocked yet");
  Z.game.stats.maxChainVisit = true;                      // the player fills a 24-chain after the load
  Z.Achievements.evaluate();
  assert(Z.Achievements.lifetimeUnlocked.has("max_haul"), "C: ⛔ a genuine post-load max_haul DOES unlock");
  eq(toastNames(Z).filter(n => n === "Maxed Out").length, 1, "C: ⛔ ...exactly one banner");
})();

// ================= (D) a genuine post-load crossing toasts exactly once =============================
(function sectionD() {
  console.log("(D) a crossing that happens AFTER the load toasts exactly once, and only once");
  const store = mkStore();
  const X = resumeIn(store, mkEntry(12));
  const Ach = X.Achievements;
  eq(Ach.resumeBaseline.waste_not, 0, "D: (setup) waste_not baselines at 0 — the slot has gameEnded false");

  Ach.evaluate();
  eq(X.game.toasts.length, 0, "D: (setup) nothing has crossed yet");

  X.game.stats.gameEnded = true;                       // the resumed run ends, with no coalescence
  Ach.evaluate();
  eq(X.game.toasts.length, 1, "D: ⛔ exactly one banner for the one genuine crossing");
  eq(toastNames(X)[0], "Waste Not", "D: ⛔ ...and it is the achievement that actually crossed");
  eq(X.game.pendingAch.length, 1, "D: ⛔ one item banked for the celebration panel");
  eq(X.game.pendingAch[0].id, "waste_not", "D: ...the same one");
  assert(Ach.weeklyUnlocked.has("waste_not"), "D: ⛔ it entered the weekly unlock set");

  for (let i = 0; i < 10; i++) Ach.evaluate();
  eq(X.game.toasts.length, 1, "D: ⛔ ten more evaluate() passes add nothing — the unlock set short-circuits");
  eq(Ach.weeklyUnlocked.size, 1, "D: ⛔ ...and exactly one weekly is unlocked in total");

  // The 15 that were satisfied at load stay silent through all of it.
  for (const id of WEEKLY_IDS) if (id !== "waste_not")
    assert(!Ach.weeklyUnlocked.has(id), `D: ⛔ ${id} stayed below its baseline the whole run`);
})();

// ================= (E) tiered lifetime baselines ====================================================
(function sectionE() {
  console.log("(E) a tiered lifetime baseline is the tier index the load already justified");
  const entry = mkEntry(12);

  // Every tiered cur() reads only the lifetime counters, so on the shipped path base === tierIndex.
  const X = resumeIn(mkStore(), entry);
  for (const id of TIERED_IDS)
    eq(X.Achievements.resumeBaseline[id], X.Achievements.tierIndex(X.Achievements.byId[id]),
      `E: ${id} baselines at the tier deriveLifetime() already settled`);
  X.Achievements.evaluate();
  eq(X.game.toasts.length, 0, "E: ⛔ ...so a plain resume toasts no tier at all");

  // The one path a player can actually reach it by: an achievements RESET (lifetimeTiers emptied)
  // followed by a resume. The counters still justify the badges; nothing here was earned after the load.
  const store = mkStore();
  const Y = buildGame({ store });
  Y.Achievements.activeIds = WEEKLY_IDS.slice();
  Y.Achievements._saveAccum = 1e9;
  const magnate = Y.Achievements.byId.recycling_magnate;
  eq(magnate.tiers[0], 1000, "E: (setup) Recycling Magnate's bronze rung is 1000 …");
  eq(magnate.tiers[3], 25000, "E: (setup) … and its Titanium rung is 25000");
  Y.Achievements.lifetimeTiers = {};                               // the reset
  Y.resumeFromSave(entry);
  eq(Y.Achievements.resumeBaseline.recycling_magnate, 0,
    "E: ⛔ the baseline is derived from the SNAPSHOT VALUE (1200 delivered -> Bronze), not from lifetimeTiers");
  eq(Y.Achievements.tierIndex(magnate), -1, "E: (setup) ...while the emptied tier state still reads -1");
  Y.Achievements.evaluate();
  eq(Y.game.toasts.length, 0, "E: ⛔ a tier the snapshot already justified raises no banner");
  assert(!("recycling_magnate" in Y.Achievements.lifetimeTiers),
    "E: ⛔ ...and is SKIPPED, not recorded silently — the baseline never writes lifetimeTiers");

  // Crossings ABOVE that floor still toast, one banner per rung: 1200 -> 30000 genuinely passes
  // Silver (5000), Gold (10000) and Titanium (25000). Bronze, which the snapshot already held, does not.
  Y.Achievements.lifetime.delivered = 30000;
  Y.Achievements.evaluate();
  eq(Y.game.toasts.length, 3, "E: ⛔ the three rungs genuinely crossed after the load each toast once");
  eq(JSON.stringify(toastNames(Y)),
    '["Recycling Magnate — Silver","Recycling Magnate — Gold","Recycling Magnate — Titanium"]',
    "E: ⛔ ...ascending, and Bronze — the baselined rung — is not among them");
  eq(Y.Achievements.lifetimeTiers.recycling_magnate, 3, "E: ⛔ ...and the tier state lands on 3");

  // TEETH — with the floor line removed, the same reset+resume re-fanfares every badge the counters
  // already justified, across the whole tiered pool.
  const FLOOR = "      if (base && ach.id in base && base[ach.id] > reached) reached = base[ach.id];\n";
  const Z = buildGame({ source: raw.replace(FLOOR, ""), store: mkStore() });
  Z.Achievements.activeIds = WEEKLY_IDS.slice();
  Z.Achievements._saveAccum = 1e9;
  Z.Achievements.lifetimeTiers = {};
  Z.resumeFromSave(mkEntry(12));
  Z.Achievements.evaluate();
  assert(Z.game.toasts.length >= 20, `E: (teeth) without the floor, the tier badges all fanfare (${Z.game.toasts.length})`);
  assert(toastNames(Z).includes("Recycling Magnate — Bronze"), "E: (teeth) ...the baselined rung included");
  eq(Z.Achievements.lifetimeTiers.recycling_magnate, 0, "E: (teeth) ...and it is recorded, not skipped");

  // A FRESH run is untouched by any of this — resumeBaseline is null there.
  const W = buildGame({ store: mkStore({ lifetimeTiers: {} }) });
  W.Achievements.activeIds = WEEKLY_IDS.slice();
  W.Achievements._saveAccum = 1e9;
  W.startGame();
  eq(W.Achievements.resumeBaseline, null, "E: (control) a fresh run has no baseline …");
  W.Achievements.lifetime.hunterKills = 12000;
  W.Achievements.evaluate();
  assert(W.game.toasts.length > 0, "E: (control) … and tier crossings toast exactly as they always did");
})();

// ================= (F) ⛔ PLACEMENT — after step 2, before step 5 ===================================
(function sectionF() {
  console.log("(F) ⛔ the snapshot's placement is load-bearing — both mis-ordered variants fail");

  // Textual: inside resumeFromSave(), the snapshot sits after the stats restore and before nextWave().
  const body = fnBody(stripped, "function resumeFromSave(entry) {");
  const iStats = body.indexOf("game.stats[k] = st[k]");
  const iSnap  = body.indexOf("Achievements.snapshotResumeBaseline();");
  const iNext  = body.lastIndexOf("nextWave();");
  assert(iStats > 0 && iSnap > 0 && iNext > 0, "F: (setup) all three ordering anchors found");
  assert(iStats < iSnap, "F: ⛔ the stats restore precedes the snapshot");
  assert(iSnap < iNext, "F: ⛔ ...and the snapshot precedes nextWave()");

  // Source surgery: lift the one call line and re-seat it at each of the two wrong places.
  const CALL = "\n  Achievements.snapshotResumeBaseline();";
  const iFn = raw.indexOf("function resumeFromSave(entry) {");
  const iEnd = raw.indexOf("\n}\n", iFn);
  const fn = raw.slice(iFn, iEnd);
  assert(fn.includes(CALL), "F: (setup) the call line was located, verbatim");
  const noCall = fn.replace(CALL, "");
  const ANCHOR = "  resetRun(num(e.wave, 1) - 1, e.debugRun === true);";
  assert(noCall.includes(ANCHOR), "F: (setup) the resetRun() call is the early anchor");
  const reseat = variant => raw.slice(0, iFn) + variant + raw.slice(iEnd);
  const EARLY = reseat(noCall.replace(ANCHOR, ANCHOR + CALL));   // before the stats overwrite
  const LATE  = reseat(noCall + CALL);                           // after nextWave()
  assert(EARLY !== raw && LATE !== raw && EARLY !== LATE, "F: (setup) both variants really differ");

  // TOO EARLY — the snapshot reads the freshly-zeroed stats, suppresses nothing, and the flood returns.
  const E = buildGame({ source: EARLY, store: mkStore() });
  E.Achievements.activeIds = WEEKLY_IDS.slice();
  E.Achievements._saveAccum = 1e9;
  E.resumeFromSave(mkEntry(12));
  eq(E.Achievements.resumeBaseline.delivered === undefined, true, "F: (setup) the early variant still snapshots by id");
  eq(E.Achievements.resumeBaseline.scrap_runner, 0, "F: ⛔ TOO EARLY — the baseline snapshots ZEROES");
  eq(E.Achievements.resumeBaseline.max_haul, 0, "F: ⛔ ...max_haul, the LIFETIME half of the leak, included");
  // ⚠ untouchable is the ONE id the early variant still covers by accident: its cur() reads game.wave,
  // which resetRun() has already seeded from the entry. That is a property of that achievement, not a
  // defence — every other stats-driven id baselines at zero and floods below.
  eq(E.Achievements.resumeBaseline.untouchable, 1, "F: (why the early variant is not merely 'mostly right')");
  E.Achievements.evaluate();
  assert(E.game.toasts.length >= 15, `F: ⛔ TOO EARLY — the flood fires anyway (${E.game.toasts.length} banners)`);
  assert(E.Achievements.lifetimeUnlocked.has("max_haul"), "F: ⛔ ...and the lifetime leak is back with it");

  // TOO LATE — nextWave() has advanced game.wave, which untouchable's cur() reads. A wave-10 slot then
  // baselines as though the player were already there, and suppresses an unlock they genuinely earn.
  const tenEntry = mkEntry(10);
  const shipped = resumeIn(mkStore(), tenEntry);
  eq(shipped.game.wave, 10, "F: (setup) the wave-10 slot resumed onto wave 10");
  eq(shipped.Achievements.resumeBaseline.untouchable, 0,
    "F: ⛔ shipped — the snapshot ran at wave 9, so untouchable baselines at 0");
  shipped.Achievements.evaluate();
  assert(shipped.Achievements.lifetimeUnlocked.has("untouchable"),
    "F: ⛔ shipped — reaching wave 10 after the load unlocks it");

  const L = buildGame({ source: LATE, store: mkStore() });
  L.Achievements.activeIds = WEEKLY_IDS.slice();
  L.Achievements._saveAccum = 1e9;
  L.resumeFromSave(mkEntry(10));
  eq(L.game.wave, 10, "F: (setup) the late variant resumed onto the same wave");
  eq(L.Achievements.resumeBaseline.untouchable, 1,
    "F: ⛔ TOO LATE — the snapshot ran at wave 10 and baselines at 1");
  L.Achievements.evaluate();
  assert(!L.Achievements.lifetimeUnlocked.has("untouchable"),
    "F: ⛔ TOO LATE — ...which silently swallows an achievement the player earns for real");
})();

// ================= (G) the targeted merge write (FORK-A -> b, FORK-A.1 -> b2) =======================
(function sectionG() {
  console.log("(G) ⛔ the merge write adds unlocks and leaves the stored lifetime counters alone");

  // --- weekly branch ---
  const store = mkStore();
  const lifetime0 = JSON.stringify(readBlob(store).lifetime);
  const X = resumeIn(store, mkEntry(12));
  eq(store[ACH_KEY] === undefined, false, "G: (setup) the store holds a blob to merge into");
  X.game.stats.gameEnded = true;
  X.Achievements.evaluate();
  eq(X.game.toasts.length, 1, "G: (setup) one genuine post-baseline unlock");
  const blob = readBlob(store);
  assert(blob.weekly.unlocked.includes("waste_not"), "G: ⛔ the weekly id reached afd_achievements_v2");
  eq(blob.weekly.key, WEEK_KEY, "G: ⛔ ...under the CURRENT week key, exactly as init() reads it");
  eq(JSON.stringify(blob.lifetime), lifetime0, "G: ⛔ the stored lifetime counters are byte-identical");
  eq(JSON.stringify(blob.lifetimeTiers), "{}", "G: ⛔ ...and no tier state was invented");
  eq(JSON.stringify(blob.lifetimeUnlocked), "[]", "G: ⛔ ...and no lifetime unlock was invented");

  // --- non-tiered lifetime branch ---
  const store2 = mkStore();
  const Y = resumeIn(store2, mkEntry(12, { stats: { maxChainVisit: false } }));
  Y.game.stats.maxChainVisit = true;
  Y.Achievements.evaluate();
  const blob2 = readBlob(store2);
  assert(blob2.lifetimeUnlocked.includes("max_haul"), "G: ⛔ a non-tiered lifetime unlock merges into lifetimeUnlocked");
  eq(JSON.stringify(blob2.lifetime), lifetime0, "G: ⛔ ...with the lifetime counters still byte-identical");
  eq(blob2.weekly.unlocked.length, 0, "G: ⛔ ...and nothing added to the weekly row");

  // --- tiered branch ---
  const store3 = mkStore();
  const Z = resumeIn(store3, mkEntry(12));
  Z.Achievements.lifetime.hunterKills = 12000;           // Ghost Protocol, tiers 50..10000
  Z.Achievements.evaluate();
  const blob3 = readBlob(store3);
  assert(typeof blob3.lifetimeTiers.ghost_protocol === "number", "G: ⛔ a tiered unlock merges a tier INDEX");
  eq(blob3.lifetimeTiers.ghost_protocol, 5, "G: ⛔ ...the highest tier crossed, Diamond");
  eq(JSON.stringify(blob3.lifetime), lifetime0,
    "G: ⛔ ...and the stored hunterKills counter is UNMOVED, though the in-memory one is 12000");
  eq(Z.Achievements.lifetime.hunterKills, 12000, "G: (non-vacuous) the in-memory counter really did move");

  // --- monotonic: a lower stored index is raised, a higher one is left alone ---
  const store4 = mkStore({ lifetimeTiers: { ghost_protocol: 5 } });
  const W = resumeIn(store4, mkEntry(12));
  W.Achievements.lifetimeTiers.ghost_protocol = 1;       // pretend the run only knows about Silver
  W.Achievements.lifetime.hunterKills = 300;             // crosses Gold (idx 2)
  W.Achievements.evaluate();
  eq(readBlob(store4).lifetimeTiers.ghost_protocol, 5, "G: ⛔ a HIGHER stored tier index is never lowered");

  // --- ⛔ repeated resume of ONE slot does not compound the stored counters (CS032 P2's bar) ---
  const store5 = mkStore();
  const stored5 = JSON.stringify(readBlob(store5).lifetime);
  const R = buildGame({ store: store5 });
  R.Achievements.activeIds = WEEKLY_IDS.slice();
  R.Achievements._saveAccum = 1e9;
  const CROSS = [
    ["scrap_runner", g => { g.stats.delivered = 999; }],
    ["satellite_buster", g => { g.stats.debrisKills = 999; }],
    ["small_ball", g => { g.stats.smallSaucerKills = 999; }],
  ];
  const entry5 = mkEntry(12, { stats: { delivered: 0, debrisKills: 0, smallSaucerKills: 0 } });
  for (let i = 0; i < CROSS.length; i++) {
    R.resumeFromSave(entry5);                            // the SAME slot, loaded again
    R.Achievements.lifetime.fullChains++;                // ...and a ++ counter moves during each run
    R.Achievements.lifetime.heavyHaulerEvents++;
    CROSS[i][1](R.game);
    R.Achievements.evaluate();
    const b = readBlob(store5);
    assert(b.weekly.unlocked.includes(CROSS[i][0]), `G: (non-vacuous) resume ${i + 1} genuinely unlocked ${CROSS[i][0]}`);
    eq(JSON.stringify(b.lifetime), stored5, `G: ⛔ resume ${i + 1} left the stored lifetime counters byte-identical`);
    eq(b.lifetime.fullChains, STORED_LIFETIME.fullChains, `G: ⛔ resume ${i + 1} did not bank fullChains`);
    eq(b.lifetime.heavyHaulerEvents, STORED_LIFETIME.heavyHaulerEvents, `G: ⛔ resume ${i + 1} did not bank heavyHaulerEvents`);
  }
  eq(R.Achievements.lifetime.fullChains, STORED_LIFETIME.fullChains + 3,
    "G: (non-vacuous) the IN-MEMORY counter really did compound three times");
  eq(readBlob(store5).weekly.unlocked.length, 3, "G: ⛔ all three genuine unlocks landed, one per resume");

  // --- no stored blob: write nothing (init()'s v1-migration branch survives), and lose nothing ---
  const store6 = {};
  const N = buildGame({ store: store6 });
  N.Achievements.activeIds = WEEKLY_IDS.slice();
  N.Achievements._saveAccum = 1e9;
  N.resumeFromSave(mkEntry(12, { stats: { maxChainVisit: false } }));
  N.game.stats.maxChainVisit = true;
  N.Achievements.evaluate();
  eq(store6[ACH_KEY], undefined, "G: ⛔ with nothing stored, the merge writes nothing");
  assert(N.Achievements.lifetimeUnlocked.has("max_haul"), "G: ...but the unlock is in memory …");
  N.startGame(); N.Achievements.save();
  assert(readBlob(store6).lifetimeUnlocked.includes("max_haul"), "G: … and the next non-resumed save persists it");

  // --- a corrupt blob is survived, not crashed on ---
  const store7 = { [ACH_KEY]: "{not json" };
  const C = buildGame({ store: store7 });
  C.Achievements.activeIds = WEEKLY_IDS.slice();
  C.Achievements._saveAccum = 1e9;
  C.resumeFromSave(mkEntry(12, { stats: { maxChainVisit: false } }));
  C.game.stats.maxChainVisit = true;
  C.Achievements.evaluate();
  eq(store7[ACH_KEY], "{not json", "G: ⛔ a corrupt blob is left exactly as found, and nothing threw");

  // --- a stale week row is replaced, never appended to under the wrong key ---
  const store8 = mkStore({ weekly: { key: "1999-1", unlocked: ["scrap_runner"] } });
  const S = resumeIn(store8, mkEntry(12));
  S.game.stats.gameEnded = true;
  S.Achievements.evaluate();
  const blob8 = readBlob(store8);
  eq(blob8.weekly.key, WEEK_KEY, "G: ⛔ a stale week row is re-keyed to the current week …");
  eq(JSON.stringify(blob8.weekly.unlocked), '["waste_not"]', "G: ⛔ … carrying only what THIS week earned");
  eq(JSON.stringify(blob8.lifetime), lifetime0, "G: ⛔ … and still not touching the lifetime counters");
})();

// ================= (H) ⛔ debugRun remains an absolute bar ===========================================
(function sectionH() {
  console.log("(H) ⛔ game.debugRun bars every write, merge write included");
  const store = mkStore();
  const before = store[ACH_KEY];
  const X = resumeIn(store, mkEntry(12, { debugRun: true, stats: { maxChainVisit: false } }));
  eq(X.game.debugRun, true, "H: (setup) the slot resumed as a debug run");
  eq(X.game.resumedRun, true, "H: (setup) ...and a resumed one");

  X.game.stats.gameEnded = true;                 // a genuine weekly crossing
  X.game.stats.maxChainVisit = true;             // a genuine non-tiered lifetime crossing
  X.Achievements.lifetime.hunterKills = 12000;   // a genuine tiered crossing
  X.Achievements.evaluate();
  assert(X.game.toasts.length >= 3, "H: (non-vacuous) three genuine unlocks fired in memory");
  eq(store[ACH_KEY], before, "H: ⛔ NOTHING reached afd_achievements_v2 on a debug run");
  X.Achievements.save();
  eq(store[ACH_KEY], before, "H: ⛔ ...and save() is still barred too");
  X.Achievements.tick(1e6);
  eq(store[ACH_KEY], before, "H: ⛔ ...periodic flush included");

  // TEETH — the identical run without the debug flag DOES merge.
  const store2 = mkStore();
  const Y = resumeIn(store2, mkEntry(12, { stats: { maxChainVisit: false } }));
  eq(Y.game.debugRun, false, "H: (teeth setup) not a debug run");
  Y.game.stats.maxChainVisit = true;
  Y.Achievements.evaluate();
  assert(readBlob(store2).lifetimeUnlocked.includes("max_haul"), "H: (teeth) ...so the same unlock merges");

  // ...and the benchmark seal still holds over the new write path.
  const store3 = mkStore();
  const Z = resumeIn(store3, mkEntry(12, { stats: { maxChainVisit: false } }));
  const before3 = store3[ACH_KEY];
  Z.Bench.running = true;
  Z.game.stats.maxChainVisit = true;
  Z.Achievements.evaluate();
  Z.Achievements.mergeUnlock(Z.Achievements.byId.max_haul, undefined);
  eq(store3[ACH_KEY], before3, "H: ⛔ the CS037 P2 seal bars the merge write too");
  Z.Bench.running = false;
})();

// ================= (I) ⛔ the baseline never touches the three unlock structures =====================
(function sectionI() {
  console.log("(I) ⛔ the snapshot marks nothing — weeklyUnlocked / lifetimeUnlocked / lifetimeTiers");
  const store = mkStore({
    lifetimeUnlocked: ["century_club"],
    weekly: { key: WEEK_KEY, unlocked: ["scrap_runner"] }
  });
  const X = buildGame({ store });
  X.Achievements.activeIds = WEEKLY_IDS.slice();
  X.Achievements._saveAccum = 1e9;
  const snap = () => JSON.stringify({
    w: [...X.Achievements.weeklyUnlocked].sort(),
    l: [...X.Achievements.lifetimeUnlocked].sort(),
    t: X.Achievements.lifetimeTiers
  });

  X.startGame();
  const before = snap();
  assert(X.Achievements.weeklyUnlocked.has("scrap_runner"), "I: (setup) the store's weekly unlock loaded");
  assert(X.Achievements.lifetimeUnlocked.has("century_club"), "I: (setup) ...and its lifetime unlock");
  assert(Object.keys(X.Achievements.lifetimeTiers).length > 0, "I: (setup) ...and deriveLifetime() settled tier badges");

  // The snapshot alone, called directly on a stats-rich board.
  Object.assign(X.game.stats, RICH);
  X.game.stats.powerUsed = { rapid: true, triple: true, magnet: true, engine: true };
  X.game.wave = 12;
  X.Achievements.snapshotResumeBaseline();
  eq(snap(), before, "I: ⛔ snapshotResumeBaseline() mutates none of the three");
  assert(X.Achievements.resumeBaseline !== null, "I: (non-vacuous) ...while it did produce a baseline");
  eq(X.Achievements.resumeBaseline.scrap_runner, 40, "I: ⛔ ...holding raw cur() values for non-tiered ids");
  eq(X.Achievements.resumeBaseline.recycling_magnate, 0, "I: ⛔ ...and TIER INDICES for tiered ones");

  // And across the whole resume path, which is the way a player reaches it.
  const store2 = mkStore({
    lifetimeUnlocked: ["century_club"],
    weekly: { key: WEEK_KEY, unlocked: ["scrap_runner"] }
  });
  const Y = resumeIn(store2, mkEntry(12));
  const after = JSON.stringify({
    w: [...Y.Achievements.weeklyUnlocked].sort(),
    l: [...Y.Achievements.lifetimeUnlocked].sort(),
    t: Y.Achievements.lifetimeTiers
  });
  eq(after, before, "I: ⛔ resumeFromSave() leaves all three exactly as the load found them");
  eq(store2[ACH_KEY], mkStore({
    lifetimeUnlocked: ["century_club"],
    weekly: { key: WEEK_KEY, unlocked: ["scrap_runner"] }
  })[ACH_KEY], "I: ⛔ ...and writes nothing to storage on the way through");

  // The baseline is per-run: a fresh run clears it.
  Y.startGame();
  eq(Y.Achievements.resumeBaseline, null, "I: ⛔ resetRun() clears the baseline — no floor carries into a fresh run");
  Y.game.stats.delivered = 999;
  Y.Achievements.evaluate();
  assert(Y.Achievements.weeklyUnlocked.has("scrap_runner"), "I: (setup) the stored weekly unlock is still held");
  Y.game.stats.gameEnded = true;
  Y.Achievements.evaluate();
  assert(Y.Achievements.weeklyUnlocked.has("waste_not"), "I: ⛔ ...and a fresh run unlocks normally, floor-free");
})();

// ================= (J) no banner-display gating =====================================================
(function sectionJ() {
  console.log("(J) drawToasts() is untouched — this phase fixes the award path, not the display");
  const draw = fnBody(stripped, "function drawToasts() {");
  const update = fnBody(stripped, "function updateToasts(dt) {");
  assert(draw.length > 0 && update.length > 0, "J: (setup) both toast functions were located");
  for (const [name, body] of [["drawToasts", draw], ["updateToasts", update]]) {
    assert(!body.includes("resumeBaseline"), `J: ⛔ ${name}() knows nothing about the baseline`);
    assert(!body.includes("resumedRun"), `J: ⛔ ${name}() knows nothing about the resumed-run flag`);
    assert(!body.includes("mergeUnlock"), `J: ⛔ ${name}() knows nothing about the merge write`);
  }
  const onUnlock = methodBody(stripped, "onUnlock(ach, tierIdx) {");
  assert(/game\.toasts\.push\(\{ name: label, life: ACH_TOAST_TIME \}\);/.test(onUnlock),
    "J: ⛔ onUnlock() still pushes its banner unconditionally");
  assert(!/if \(/.test(onUnlock.slice(0, onUnlock.indexOf("game.toasts.push"))),
    "J: ⛔ ...with no gate ahead of it");

  // Live: many unlocks on one frame still stack, one banner each.
  const X = buildGame({ store: mkStore() });
  X.Achievements.activeIds = WEEKLY_IDS.slice();
  X.Achievements._saveAccum = 1e9;
  X.startGame();
  X.game.wave = 12;
  Object.assign(X.game.stats, RICH, { gameEnded: true });
  X.game.stats.powerUsed = { rapid: true, triple: true, magnet: true, engine: true };
  X.Achievements.evaluate();
  eq(X.Achievements.weeklyUnlocked.size, 16, "J: (setup) a fresh run crosses all 16 weeklies on one frame");
  eq(X.game.toasts.length, 18, "J: ⛔ ...and 18 banners stack — the 16 plus untouchable and max_haul");
  eq(X.game.pendingAch.length, 18, "J: ⛔ ...with 18 celebration items banked, one for one");
})();

A.report();
