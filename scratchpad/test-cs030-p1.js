// Headless test for CS030 Phase 1 — the achievement unlock collector: game.pendingAch (flushed
// bucket) + game.celebration (null until a later phase). Data only, no draw/input.
//
//   node scratchpad/test-cs030-p1.js
//
// archive/PLANNED-FEATURES-CS030.md §4.1: pendingAch/celebration are declared in BOTH the `game` literal
// and startGame()'s reset (CS016 P3 rule). onUnlock() appends { id, name, desc, tierIdx, pool } —
// tierIdx stays undefined for untiered unlocks, the collector is a FLUSHED bucket never filtered
// by game.wave (§0.4), and it is NOT gated on game.debugRun (that guard belongs only to
// Achievements.save(), a persistence point — this is UI state, §0.3/§4.1).
//
// Sections: (A) node --check; both declaration sites. (B) a real unlock via evaluate() appends one
// shaped item. (C) tiered vs untiered tierIdx. (D) a multi-tier crossing in one evaluate() pass
// appends one item per tier, bronze-first. (E) startGame() empties the bucket. (F) a debug run
// still collects while Achievements.save() writes nothing. (G) TRAPs: scope pin, registry unmoved.

"use strict";
const { buildGame, mkAssert, scriptSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope, parentSource } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "Docs update prior to cs030".
const PARENT_SHA = "1b6cd66c36c5265fe7d09de2edc4cebf4d3fcd2a";
const PHASE_SUBJECT = "cs-30 p1:";

const A = mkAssert();
const { assert, eq, close, skip } = A;

const src = scriptSource();

// ================= (A) node --check; both declaration sites =====================
(function sectionA() {
  console.log("(A) node --check; pendingAch/celebration declared in both the game literal and startGame()'s reset");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs030p1_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const gameLitBody = src.slice(src.indexOf("const game = {"), src.indexOf("function startGame()"));
  assert(/pendingAch:\s*\[\]/.test(gameLitBody), "A: game literal declares pendingAch: []");
  assert(/celebration:\s*null/.test(gameLitBody), "A: game literal declares celebration: null");

  const startGameBody = src.slice(src.indexOf("function startGame()"), src.indexOf("function startGame()") + 3000);
  assert(/game\.pendingAch\s*=\s*\[\]/.test(startGameBody), "A: startGame() resets game.pendingAch = []");
  assert(/game\.celebration\s*=\s*null/.test(startGameBody), "A: startGame() resets game.celebration = null");

  const onUnlockBody = src.slice(src.indexOf("onUnlock(ach, tierIdx)"), src.indexOf("onUnlock(ach, tierIdx)") + 400);
  assert(/game\.pendingAch\.push\(\{\s*id:\s*ach\.id,\s*name:\s*ach\.name,\s*desc:\s*ach\.desc,\s*tierIdx,\s*pool:\s*ach\.pool\s*\}\)/.test(onUnlockBody),
    "A: onUnlock() appends the exact { id, name, desc, tierIdx, pool } shape");
  assert(/game\.toasts\.push/.test(onUnlockBody), "A: (non-vacuous) the existing toast push is still there, not replaced");
})();

// ================= (B) a real unlock via evaluate() appends one shaped item =====================
(function sectionB() {
  console.log("(B) a real unlock through Achievements.evaluate() appends exactly one correctly-shaped item");
  const X = buildGame();
  X.startGame();
  eq(X.game.pendingAch.length, 0, "B: (setup) fresh game starts with an empty bucket");

  // activeWeekly() rotates with the real calendar week, so pick whichever active achievement can be
  // satisfied by driving a SINGLE game.stats key (some, like glass_cannon, also gate on game.wave and
  // are skipped here rather than risked non-deterministically).
  let ach = null, found = null;
  for (const cand of X.Achievements.activeWeekly()) {
    for (const k of Object.keys(X.game.stats)) {
      if (typeof X.game.stats[k] !== "number") continue;
      const save = X.game.stats[k];
      X.game.stats[k] = 1e6;
      if (cand.cur(X.game.stats, X.Achievements.lifetime) >= cand.goal) { ach = cand; found = k; break; }
      X.game.stats[k] = save;
    }
    if (ach) break;
  }
  assert(!!ach, "B: (setup) found an active weekly achievement satisfiable by a single game.stats key");
  X.Achievements.evaluate();

  eq(X.game.pendingAch.length, 1, "B: exactly one item appended for the one active weekly unlock");
  const item = X.game.pendingAch[0];
  eq(item.id, ach.id, "B: item.id matches the unlocked achievement's id");
  eq(item.name, ach.name, "B: item.name matches");
  eq(item.desc, ach.desc, "B: item.desc matches");
  eq(item.pool, "weekly", "B: item.pool is 'weekly'");
  eq(item.tierIdx, undefined, "B: weekly (untiered) unlock carries tierIdx === undefined");
})();

// ================= (C) tiered vs untiered tierIdx =====================
(function sectionC() {
  console.log("(C) a tiered lifetime unlock carries a numeric tierIdx; an untiered one carries undefined");
  const X = buildGame();
  X.startGame();

  const tiered = X.Achievements.LIFETIME.find(a => a.tiers);
  assert(!!tiered, "C: (setup) at least one tiered lifetime achievement exists");
  // Probe which lifetime counter tiered.cur() actually reads by trying each key in turn.
  for (const k in X.Achievements.lifetime) {
    const save = X.Achievements.lifetime[k];
    X.Achievements.lifetime[k] = tiered.tiers[0];
    if (tiered.cur(X.game.stats, X.Achievements.lifetime) >= tiered.tiers[0]) break;
    X.Achievements.lifetime[k] = save;
  }
  X.Achievements.evaluate();
  const tieredItem = X.game.pendingAch.find(p => p.id === tiered.id);
  assert(!!tieredItem, "C: (setup) the tiered achievement actually unlocked bronze");
  eq(tieredItem.tierIdx, 0, "C: ⛔ a tiered unlock carries a numeric tierIdx (bronze = 0)");

  const untiered = X.Achievements.LIFETIME.find(a => !a.tiers && a.goal !== undefined);
  assert(!!untiered, "C: (setup) at least one untiered lifetime achievement exists");
  for (const k in X.Achievements.lifetime) {
    const save = X.Achievements.lifetime[k];
    X.Achievements.lifetime[k] = untiered.goal;
    if (untiered.cur(X.game.stats, X.Achievements.lifetime) >= untiered.goal) break;
    X.Achievements.lifetime[k] = save;
  }
  X.game.stats.gameEnded = true;
  X.game.wave = 999; X.game.stats.everBelowHalf = false;
  X.Achievements.evaluate();
  const untieredItem = X.game.pendingAch.find(p => p.id === untiered.id);
  if (untieredItem) {
    eq(untieredItem.tierIdx, undefined, "C: ⛔ an untiered unlock carries tierIdx === undefined");
  } else {
    A.skip("C: untiered lifetime unlock (achievement's cur() needs conditions this harness didn't reach)");
  }
})();

// ================= (D) a multi-tier crossing in one evaluate() pass: one item per tier, bronze-first =====================
(function sectionD() {
  console.log("(D) jumping a tiered counter past several rungs in one pass appends one item PER tier, bronze-first");
  const X = buildGame();
  X.startGame();

  const tiered = X.Achievements.LIFETIME.find(a => a.tiers && a.tiers.length >= 3);
  assert(!!tiered, "D: (setup) at least one tiered achievement with 3+ rungs exists");
  let key = null;
  for (const k in X.Achievements.lifetime) {
    const save = X.Achievements.lifetime[k];
    X.Achievements.lifetime[k] = tiered.tiers[2]; // jump straight to the 3rd rung's threshold
    if (tiered.cur(X.game.stats, X.Achievements.lifetime) >= tiered.tiers[2]) { key = k; break; }
    X.Achievements.lifetime[k] = save;
  }
  assert(key !== null, "D: (setup) found the lifetime counter this achievement's cur() reads");
  X.Achievements.evaluate();

  const items = X.game.pendingAch.filter(p => p.id === tiered.id);
  eq(items.length, 3, "D: ⛔ crossing 3 rungs in one pass appends exactly 3 items, one per tier");
  eq(items.map(i => i.tierIdx).join(","), "0,1,2", "D: ⛔ tierIdx ascends bronze-first (0, 1, 2), matching evaluate()'s own loop order");
})();

// ================= (E) startGame() empties the bucket =====================
(function sectionE() {
  console.log("(E) startGame() empties game.pendingAch (and leaves celebration null) even mid-run");
  const X = buildGame();
  X.startGame();
  X.game.pendingAch.push({ id: "x", name: "X", desc: "d", tierIdx: undefined, pool: "weekly" });
  X.game.celebration = { items: [{ id: "x" }], scroll: 0 };
  eq(X.game.pendingAch.length, 1, "E: (setup) the bucket has a stale entry before the reset");

  X.startGame();
  eq(X.game.pendingAch.length, 0, "E: ⛔ startGame() clears game.pendingAch");
  eq(X.game.celebration, null, "E: ⛔ startGame() clears game.celebration back to null");
})();

// ================= (F) a debug run still collects; Achievements.save() writes nothing =====================
(function sectionF() {
  console.log("(F) a debugRun still appends to pendingAch normally, while Achievements.save() writes nothing (do NOT copy the save() guard)");
  const store = {};
  const X = buildGame({ store });
  X.applyDebug("startLevel", 33);
  X.startGame();
  assert(X.game.debugRun, "F: (setup) this is a debug run");

  const before = Object.keys(store).length;
  for (const k of Object.keys(X.game.stats)) if (typeof X.game.stats[k] === "number") X.game.stats[k] = 1e6;
  X.game.stats.gameEnded = true;
  X.Achievements.evaluate();

  assert(X.game.pendingAch.length > 0, "F: ⛔ a debug run still collects into pendingAch — the UI-state bucket is not gated on debugRun");
  eq(Object.keys(store).length, before, "F: ⛔ Achievements.save() (called from onUnlock) wrote nothing to storage on a debug run");
  assert(!(X.Achievements.STORAGE_KEY in store), "F: ...specifically, the Achievements key itself is absent");
})();

// ================= (G) TRAPs: registry unmoved, scope pin =====================
(function sectionG() {
  console.log("(G) TRAPs: this phase added no registry knob; scope pin against this phase's own parent");
  const X = buildGame();
  const ps = parentSource(PARENT_SHA);
  if (ps === null) {
    skip("G: registry byte-identity against the parent (no git history)");
  } else {
    const OLD = buildGame({ source: ps });
    // REPOINTED BY CS030 P3: +2 later (celebrationScrollStep, celebrationEmblemSize) — a later phase's
    // rows, named rather than re-litigated. P1's own claim (a data-only collector adds no knob) holds.
    // REPOINTED BY CS034 P8: net +4 more (deliveryFloatLife retired, five new DELIVERY rows added).
    eq(X.DEBUG_ENTRIES.length, OLD.DEBUG_ENTRIES.length + 2 + 4, "G: ⛔ DEBUG_ENTRIES.length unchanged from P1's own parent bar CS030 P3's two and CS034 P8's net four later rows — a data-only collector adds no knob");
    eq(X.LEVERS.length, OLD.LEVERS.length, "G: ⛔ LEVERS.length unchanged");
  }

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

  const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
  eq(designDocs.join(","), "", `G: ⛔ no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `G: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "G: (setup) the game file is in this phase's diff");
})();

A.report();
