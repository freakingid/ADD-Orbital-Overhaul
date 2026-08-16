// Headless test for CS032 Phase 2 — resumeFromSave() and the sticky game.resumedRun flag.
//
//   node scratchpad/test-cs032-p2.js
//
// Drives the REAL code end to end: a live run seeded through startGame(), captured by P1's
// buildSaveEntry(), handed back to resumeFromSave(), and then played. Nothing is reimplemented.
//
// THE TWO TRAPS THIS FILE EXISTS FOR:
//   (§D) ORDERING. nextWave() reads game.stats.powerupsPicked to gate maxWaveNoPowerup. Restore the
//        stats after it and a resumed level is credited to a MAX counter that never earned it.
//   (§C/§E/§F/§M) STICKINESS. resumedRun is what makes save-moment values safe (spec FORK-A/FORK-F):
//        forced true on EVERY resume, never cleared mid-run, gating both persistence points. §M pins
//        that there is exactly one site setting it true and one clearing it — no "earn it back" path.
// §M also pins the EXTRACTION (spec Risk 5): one reset list, shared, never hand-copied — and it is
// the compensating pin for test-cs026-p3.js §G TRAP 5's repoint, which this phase made.
//
// Sections: (A) round-trip, field for field, incl. non-aliasing. (B) debugRun round-trips. (C) ⛔
// resumedRun unconditional. (D) ⛔ ordering. (E) ⛔ Achievements.save() gated. (F) ⛔ no initials
// entry. (G) the HUD tell. (H) hudHull. (I) the entry beats DEBUG.startLevel. (J) 120 real frames.
// (K) anti-drift vs a fresh run. (L) startGame() clears the flag. (M) source pins. (N) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");
const { installSeed } = require("./_seeded-random.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-32 p1: SaveSlots store + buildSaveEntry".
const PARENT_SHA = "c201843";
const PHASE_SUBJECT = "cs-32 p2:";

const restoreRandom = installSeed(20320002);   // above the first build(), per _seeded-random.js's header

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);
const countOf = (text, needle) => text.split(needle).length - 1;

// A run with every captured field pushed off its startGame() default, through the real code only.
// `dmgThisWave` is seeded NON-zero deliberately — see §A's note on the one field nextWave() re-zeroes.
function seededRun(X, wave = 12) {
  X.startGame();
  X.game.score = 48300;
  X.game.wave = wave;
  X.game.ship.hp = 42;
  X.game.nextRepair = 60000;
  X.game.scoopLevel = 3;
  X.game.scoopHits = 4;
  X.game.powerBudget = { rapid: 5, triple: 2, magnet: 1, engine: 3, guard: 1 };
  X.game.stats.delivered = 17;
  X.game.stats.powerupsPicked = 2;
  X.game.stats.everBelowHalf = true;
  X.game.stats.dmgThisWave = 5;
  X.game.stats.powerUsed = { rapid: true, triple: false, magnet: true, engine: false };
  return X;
}

// ================= (A) the save-moment values come back exactly =====================================
(function sectionA() {
  console.log("(A) buildSaveEntry() -> resumeFromSave(): every restored field matches, wave lands on the entry's own");
  const X = buildGame({ store: {} });
  seededRun(X);
  const entry = X.buildSaveEntry();

  const Y = buildGame({ store: {} });
  Y.resumeFromSave(entry);
  const g = Y.game;

  eq(g.wave, entry.wave, "A: ⛔ game.wave IS the entry's wave — not wave+1, not wave-1");
  eq(g.wave, 12, "A: ...which is 12, the level the run was saved on");
  eq(g.score, 48300, "A: score");
  eq(g.ship.hp, 42, "A: ship.hp, set on the Ship the reset constructed");
  eq(g.nextRepair, 60000, "A: nextRepair");
  eq(g.scoopLevel, 3, "A: scoopLevel — a run-long upgrade, so it survives the resume (FORK-G's note)");
  eq(g.scoopHits, 4, "A: scoopHits");
  eq(JSON.stringify(g.powerBudget), JSON.stringify(entry.powerBudget), "A: powerBudget, key for key");
  eq(g.stats.delivered, 17, "A: stats.delivered");
  eq(g.stats.powerupsPicked, 2, "A: stats.powerupsPicked");
  eq(g.stats.everBelowHalf, true, "A: stats.everBelowHalf — a boolean stat, restored as a boolean");
  eq(JSON.stringify(g.stats.powerUsed), JSON.stringify(entry.stats.powerUsed), "A: stats.powerUsed, the nested object");
  eq(g.debugRun, false, "A: debugRun, from the entry");
  eq(g.state, "playing", "A: the run is live, not sitting in a menu");
  eq(g.menu.screen, null, "A: ...and no menu carried in");

  // The ONE stat nextWave() deliberately re-zeroes: dmgThisWave opens a fresh damage-free window for
  // the level about to be played. Seeded at 5 above so this is a real observation, not a coincidence.
  eq(entry.stats.dmgThisWave, 5, "A: (setup) the entry really did carry a non-zero dmgThisWave");
  eq(g.stats.dmgThisWave, 0, "A: ⛔ dmgThisWave is zeroed by nextWave() — a resumed level starts its own perfect-wave window");

  // FORK-G: the field and the tow are empty on resume, exactly as on a fresh run.
  eq(g.chain.length, 0, "A: FORK-G — the tow chain resumes empty");
  eq(g.garbage.length, 0, "A: FORK-G — and so does the loose garbage");

  // ⛔ NON-ALIASING, the mirror of buildSaveEntry()'s own copy rule: the resumed run must not write
  // through into the slot it came from.
  assert(g.stats !== entry.stats, "A: ⛔ game.stats is not the entry's own object");
  assert(g.stats.powerUsed !== entry.stats.powerUsed, "A: ⛔ ...nor is the nested powerUsed");
  assert(g.powerBudget !== entry.powerBudget, "A: ⛔ ...nor is powerBudget");
  const snap = JSON.stringify(entry);
  g.stats.delivered = 999; g.stats.powerUsed.rapid = false; g.powerBudget.rapid = 999; g.score = 1;
  eq(JSON.stringify(entry), snap, "A: ⛔ playing on after the resume leaves the entry byte-identical");
})();

// ================= (B) debugRun round-trips, independently of resumedRun ============================
(function sectionB() {
  console.log("(B) ⛔ a save made mid debug-run still says DEBUG RUN after a reload (spec §4.2 — HUD honesty)");
  const X = buildGame({ store: {} });
  X.applyDebug("startLevel", 33);
  seededRun(X, 33);
  const entry = X.buildSaveEntry();
  eq(entry.debugRun, true, "B: (setup) the entry carries debugRun true");

  // Resumed in a build whose OWN knob is at 1 — so a true result can only have come from the entry.
  const Y = buildGame({ store: {} });
  Y.applyDebug("startLevel", 1);
  Y.resumeFromSave(entry);
  eq(Y.game.debugRun, true, "B: ⛔ debugRun is restored from the entry, not recomputed from the knob");
  eq(Y.game.resumedRun, true, "B: ...and resumedRun is true as well — the two are independent flags");

  // ...and the reverse: a clean entry resumed in a build whose knob is high stays clean. (§I drives the
  // wave half of the same claim.)
  const Z = buildGame({ store: {} });
  Z.applyDebug("startLevel", 40);
  seededRun(Z);                                   // startGame() here DOES arm debugRun...
  const cleanEntry = Object.assign(X.buildSaveEntry(), { debugRun: false });
  Z.resumeFromSave(cleanEntry);
  eq(Z.game.debugRun, false, "B: ⛔ ...and an entry saying false wins over a live startLevel of 40");
})();

// ================= (C) ⛔ resumedRun is forced true on EVERY call ====================================
(function sectionC() {
  console.log("(C) ⛔ game.resumedRun === true after every resumeFromSave(), unconditionally");
  const base = (over) => Object.assign({
    kind: "wave", saved: 0, profileName: "P", wave: 3, score: 10, hp: 50, nextRepair: 20000,
    scoopLevel: 0, scoopHits: 0, powerBudget: { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 },
    stats: { delivered: 0, powerupsPicked: 0, powerUsed: { rapid: false, triple: false, magnet: false, engine: false } },
    debugRun: false,
  }, over || {});

  const cases = [
    ["a plain wave-3 entry",                 base()],
    ["a debug-run entry",                    base({ debugRun: true, wave: 33, score: 999 })],
    ["an entry from a clean, scoring run",   base({ debugRun: false, wave: 21, score: 500000, hp: 7 })],
  ];
  for (const [label, entry] of cases) {
    const X = buildGame({ store: {} });
    X.resumeFromSave(entry);
    eq(X.game.resumedRun, true, `C: ⛔ resumedRun true after resuming ${label}`);
    eq(X.game.wave, entry.wave, `C: ...and the wave landed for ${label}`);
  }

  // Twice in a row on the same build, and after a live run — still true, no path that unsets it.
  const Y = buildGame({ store: {} });
  seededRun(Y);
  Y.resumeFromSave(base());
  Y.resumeFromSave(base({ wave: 9 }));
  eq(Y.game.resumedRun, true, "C: ⛔ still true after a second resume on top of a resumed run");
  // ⛔ STICKY: playing on past the load point never gives eligibility back (spec §4.1).
  for (let i = 0; i < 600; i++) Y.update(1 / 60);
  Y.nextWave(); Y.nextWave();
  eq(Y.game.resumedRun, true, "C: ⛔ still true after 10s of play and two more levels — there is no earn-it-back path");
})();

// ================= (D) ⛔ ORDERING: stats are restored BEFORE nextWave() reads them ==================
(function sectionD() {
  console.log("(D) ⛔ a resumed level is NOT credited to maxWaveNoPowerup when the entry says powerups were picked");
  const X = buildGame({ store: {} });
  seededRun(X, 12);
  X.game.stats.powerupsPicked = 3;
  const entry = X.buildSaveEntry();
  eq(entry.stats.powerupsPicked, 3, "D: (setup) the entry carries powerupsPicked 3");

  const Y = buildGame({ store: {} });
  eq(Y.Achievements.lifetime.maxWaveNoPowerup, 0, "D: (setup) a fresh build starts the counter at 0");
  Y.resumeFromSave(entry);
  eq(Y.game.wave, 12, "D: (setup) the resume really did land on wave 12");
  assert(Y.Achievements.lifetime.maxWaveNoPowerup < 12,
    `D: ⛔ maxWaveNoPowerup did NOT advance to the resumed level (got ${Y.Achievements.lifetime.maxWaveNoPowerup})`);
  eq(Y.Achievements.lifetime.maxWave, 12, "D: ...while maxWave, which is unconditional, did advance");

  // TEETH — the same entry with a powerup-free run DOES credit it, so the pin above measures the
  // ordering rather than a counter that never moves.
  const clean = JSON.parse(JSON.stringify(entry));
  clean.stats.powerupsPicked = 0;
  const Z = buildGame({ store: {} });
  Z.resumeFromSave(clean);
  eq(Z.Achievements.lifetime.maxWaveNoPowerup, 12, "D: (teeth) a powerup-free entry DOES credit the resumed level");
})();

// ================= (E) ⛔ Achievements.save() writes nothing on a resumed run ========================
(function sectionE() {
  console.log("(E) ⛔ Achievements.save() returns without writing when resumedRun is true and debugRun is false");
  const store = {};
  const X = buildGame({ store });
  seededRun(X);
  const entry = X.buildSaveEntry();
  X.resumeFromSave(entry);
  eq(X.game.debugRun, false, "E: (setup) NOT a debug run — resumedRun is the only thing gating");
  eq(X.game.resumedRun, true, "E: (setup) ...and this run was resumed");

  const key = X.Profiles.keyFor(X.Achievements.STORAGE_KEY);
  delete store[key];                                  // clear anything boot or the resume itself left
  X.Achievements.lifetime.hunterKills = 999999;       // a real, unlock-worthy state
  X.Achievements.evaluate();                          // onUnlock() funnels through save()
  X.Achievements.save();
  X.Achievements.tick(999999);                        // would otherwise force the periodic flush
  assert(store[key] === undefined, "E: ⛔ nothing reached the achievements key during a resumed run");
  assert(X.Achievements.lifetimeUnlocked.size > 0 || X.game.toasts.length > 0 || X.game.pendingAch.length > 0,
    "E: (non-vacuous) the unlock DID happen in memory — only the write is suppressed");

  // TEETH — the identical sequence on a fresh, non-resumed run DOES write.
  const store2 = {};
  const Y = buildGame({ store: store2 });
  Y.startGame();
  eq(Y.game.resumedRun, false, "E: (teeth setup) a fresh run is not a resumed one");
  const key2 = Y.Profiles.keyFor(Y.Achievements.STORAGE_KEY);
  delete store2[key2];
  Y.Achievements.lifetime.hunterKills = 999999;
  Y.Achievements.evaluate();
  Y.Achievements.save();
  assert(store2[key2] !== undefined, "E: (teeth) ...while a normal run's save DOES reach storage");
})();

// ================= (F) ⛔ no high-score record at game over after a resume ==========================
(function sectionF() {
  // ⚠ CS034 P7 deleted the initials-entry screen this gate used to arm (spec §6.1). The GATE is
  // byte-unchanged and so is the contract; what it now suppresses is the record write itself, which is
  // one indirection fewer and exactly what "no high-score entry" always meant.
  console.log("(F) ⛔ a resumed run never enters the high-score table, qualifying score or not");
  const X = buildGame({ store: {} });
  seededRun(X);
  X.resumeFromSave(X.buildSaveEntry());
  eq(X.game.debugRun, false, "F: (setup) not a debug run");
  X.game.score = 999999999;
  assert(X.HighScores.qualifies(X.game.score), "F: (setup) the score genuinely qualifies for the table");

  X.killShip();
  eq(X.game.state, "dying", "F: (setup) killShip() entered the dying spectacle");
  for (let i = 0; i < 2000 && X.game.state !== "gameover"; i++) X.update(0.05);
  eq(X.game.state, "gameover", "F: (setup) the run reached gameover");
  eq(X.HighScores.entries.length, 0, "F: ⛔ the table is empty — a resumed run cannot enter it");
  eq(X.game.lastScoreId, null, "F: ⛔ ...and nothing is marked for the gameover table's highlight");

  // TEETH — the same score on a run that was never resumed DOES arm it.
  const Y = buildGame({ store: {} });
  Y.startGame();
  Y.game.score = 999999999;
  Y.killShip();
  for (let i = 0; i < 2000 && Y.game.state !== "gameover"; i++) Y.update(0.05);
  eq(Y.game.state, "gameover", "F: (teeth setup) reached gameover");
  eq(Y.HighScores.entries.length, 1, "F: (teeth) ...and a non-resumed run with the same score DOES enter");
})();

// ================= (G) the HUD tell ================================================================
(function sectionG() {
  console.log("(G) 'RESUMED RUN' renders on a resumed run; 'DEBUG RUN' wins when a run is both");
  const X = buildGame({ store: {} });
  const log = [];
  X.ctx.fillText = (str) => log.push(String(str));   // the CS031 P5 spy idiom
  seededRun(X);
  X.resumeFromSave(X.buildSaveEntry());
  eq(X.game.debugRun, false, "G: (setup) resumed, not debug");

  log.length = 0; X.drawHUD();
  assert(log.includes("RESUMED RUN"), "G: ⛔ the resumed-run tag is drawn");
  assert(!log.includes("DEBUG RUN"), "G: ...and the debug tag is not");

  log.length = 0; X.game.debugRun = true; X.drawHUD();
  assert(log.includes("DEBUG RUN"), "G: ⛔ with BOTH flags set, DEBUG RUN wins");
  assert(!log.includes("RESUMED RUN"), "G: ⛔ ...and RESUMED RUN is not also drawn — mutually exclusive");

  log.length = 0; X.game.debugRun = false; X.game.resumedRun = false; X.drawHUD();
  assert(!log.includes("RESUMED RUN") && !log.includes("DEBUG RUN"), "G: (teeth) an ordinary run draws neither tag");
  assert(log.length > 0, "G: (non-vacuous) the HUD really did draw text on that pass");
})();

// ================= (H) hudHull follows the restored HP =============================================
(function sectionH() {
  console.log("(H) ⛔ game.hudHull matches the restored HP immediately — no phantom drain on frame 1");
  const X = buildGame({ store: {} });
  seededRun(X);
  const entry = X.buildSaveEntry();
  const Y = buildGame({ store: {} });
  Y.resumeFromSave(entry);
  eq(Y.game.ship.hp, 42, "H: (setup) resumed at 42 HP");
  eq(Y.game.hudHull, 42 / Y.SHIP_MAX_HP, "H: ⛔ hudHull is already at hp / SHIP_MAX_HP, not 1");
  assert(Y.game.hudHull < 1, "H: (non-vacuous) ...and that is genuinely below a full ring");
})();

// ================= (I) the entry's wave beats DEBUG.startLevel ======================================
(function sectionI() {
  console.log("(I) ⛔ with startLevel at 40, resuming a wave-5 entry lands on 5");
  const X = buildGame({ store: {} });
  X.applyDebug("startLevel", 40);
  eq(X.DEBUG.startLevel, 40, "I: (setup) the knob really is at 40");
  const entry = {
    kind: "wave", saved: 0, profileName: "P", wave: 5, score: 700, hp: 55, nextRepair: 20000,
    scoopLevel: 1, scoopHits: 2, powerBudget: { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 },
    stats: { delivered: 1, powerupsPicked: 1, powerUsed: { rapid: false, triple: false, magnet: false, engine: false } },
    debugRun: false,
  };
  X.resumeFromSave(entry);
  eq(X.game.wave, 5, "I: ⛔ the wave came from the entry, never from the debug knob");
  eq(X.game.debugRun, false, "I: ⛔ ...and so did debugRun, which the knob would otherwise have armed");
  eq(X.game.resumedRun, true, "I: ...with resumedRun forced true as always");
  eq(X.DEBUG.startLevel, 40, "I: (teeth) the knob is untouched — it was live and simply not read");
})();

// ================= (J) a resumed run actually plays =================================================
(function sectionJ() {
  console.log("(J) 120 real frames + draw passes after a resume, no throw, everything finite");
  const X = buildGame({ store: {} });
  seededRun(X);
  X.resumeFromSave(X.buildSaveEntry());
  let threw = null;
  try {
    for (let i = 0; i < 120; i++) { X.update(1 / 60); if (i % 30 === 0) X.draw(); }
  } catch (e) { threw = e; }
  assert(!threw, `J: 120 frames after a resume never threw${threw ? " — " + threw.stack : ""}`);
  eq(X.game.state, "playing", "J: ...and the run is still live");
  assert(Number.isFinite(X.game.ship.x) && Number.isFinite(X.game.ship.y), "J: the ship's position stayed finite");
  assert(Number.isFinite(X.game.score) && Number.isFinite(X.game.hudHull), "J: ...as did score and hudHull");
})();

// ================= (K) ⛔ ANTI-DRIFT: a resumed run matches a fresh one at the same level ===========
(function sectionK() {
  console.log("(K) ⛔ derived state is identical between a resumed run and a fresh run at the same level");
  // Level 3 is inside DEBUG.earlyWorldLevels and level 9 is outside it, so both sides of nextWave()'s
  // resize branch are exercised — a shared reset that drifted on world sizing would show up here.
  for (const level of [3, 9]) {
    const F = buildGame({ store: {} });
    F.applyDebug("startLevel", level);
    F.startGame();

    const R = buildGame({ store: {} });
    R.applyDebug("startLevel", 1);
    R.resumeFromSave({
      kind: "wave", saved: 0, profileName: "P", wave: level, score: 0, hp: R.SHIP_MAX_HP,
      nextRepair: R.REPAIR_MILESTONE, scoopLevel: 0, scoopHits: 0,
      powerBudget: { rapid: 0, triple: 0, magnet: 0, engine: 0, guard: 0 },
      stats: { powerUsed: { rapid: false, triple: false, magnet: false, engine: false } },
      debugRun: false,
    });

    eq(R.game.wave, F.game.wave, `K: level ${level} — same wave`);
    eq(R.game.cargoMax, F.game.cargoMax, `K: ⛔ level ${level} — same cargoMax`);
    eq(R.game.worldSize, F.game.worldSize, `K: ⛔ level ${level} — same worldSize`);
    eq(R.liveDims().join("x"), F.liveDims().join("x"), `K: level ${level} — same live world dimensions`);
    eq(R.game.hudHull, F.game.hudHull, `K: level ${level} — same hudHull`);
    eq(R.game.cargoMax, R.payloadSlots(level), `K: (non-vacuous) level ${level}'s cargoMax is the curve's own value`);
    eq(R.game.levelBanner.text, "Level " + level, `K: level ${level} — the banner announces where the player landed`);
  }
})();

// ================= (L) a brand-new game after a resumed one is clean ================================
(function sectionL() {
  console.log("(L) startGame() after a resumed run resets resumedRun to false");
  const X = buildGame({ store: {} });
  seededRun(X);
  X.resumeFromSave(X.buildSaveEntry());
  eq(X.game.resumedRun, true, "L: (setup) the run is resumed");
  X.startGame();
  eq(X.game.resumedRun, false, "L: ⛔ a brand-new game is eligible again — the flag is per-run, not per-install");
  eq(X.game.debugRun, false, "L: ...and its sibling is clean too");
  eq(X.game.score, 0, "L: (non-vacuous) it really is a fresh run");
})();

// ================= (M) source pins: one reset list, one sticky flag, two gates, one tag =============
(function sectionM() {
  console.log("(M) node --check; the extraction, the sticky-flag sites, the two persistence gates, the HUD tag");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs032p2_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const bodyOf = (sig) => { const i = stripped.indexOf(sig); return i < 0 ? "" : stripped.slice(i, stripped.indexOf("\n}\n", i)); };
  const lines = t => t.split("\n").map(l => l.trim()).filter(Boolean);

  // ⛔ THE EXTRACTION (spec Risk 5) — startGame() is now the thin caller, and its two-line body is
  // pinned LITERALLY here because test-cs026-p3.js §G TRAP 5 folds these exact two lines back to their
  // parent form in order to keep comparing the reset list. This is the other half of that repoint.
  eq(lines(bodyOf("function startGame() {")).join(" | "),
    'function startGame() { | resetRun(DEBUG.startLevel - 1, DEBUG.startLevel > 1); | nextWave();',
    "M: ⛔ startGame() is exactly: seed the shared reset from the knob, then run the wave");

  // ⛔ ONE reset list, not two. The textual proof: the array-clearing line exists exactly once.
  eq(countOf(stripped, "game.debris = [];"), 1, "M: ⛔ exactly one run-reset list in the whole build — no hand-copied second");
  const resume = bodyOf("function resumeFromSave(entry) {");
  assert(resume.length > 0, "M: (setup) resumeFromSave() was located");
  eq(countOf(resume, "resetRun("), 1, "M: ⛔ resumeFromSave() reaches fresh-run state by CALLING the shared reset");
  assert(!/game\.state\s*=\s*"playing"/.test(resume), "M: ⛔ ...and never re-states a line the reset already owns");
  assert(!/DEBUG\.startLevel/.test(resume), "M: ⛔ resumeFromSave() never reads DEBUG.startLevel");
  assert(!/SaveSlots/.test(resume), "M: ⛔ FORK-D — resumeFromSave() never touches the slot it was handed");

  // ⛔ ORDERING, textually as well as behaviourally (§D drives it): the restore precedes nextWave().
  const iStats = resume.indexOf("game.stats[k] = st[k]");
  const iFlag = resume.indexOf("game.resumedRun = true");
  const iNext = resume.lastIndexOf("nextWave();");
  assert(iStats > 0 && iFlag > 0 && iNext > 0, "M: (setup) all three ordering anchors found");
  assert(iStats < iNext, "M: ⛔ the stats restore precedes nextWave()");
  assert(iFlag < iNext, "M: ⛔ ...and so does the resumedRun assignment");

  // ⛔ STICKY: exactly one site sets it true, exactly one clears it, and it is declared in both places.
  eq(countOf(stripped, "game.resumedRun = true"), 1, "M: ⛔ exactly ONE site sets resumedRun true");
  eq(countOf(stripped, "game.resumedRun = false"), 1, "M: ⛔ exactly ONE site clears it — no mid-run give-back path");
  eq(countOf(stripped, "resumedRun: false"), 1, "M: ⛔ ...and the game literal declares it (the CS016 P3 both-places rule)");
  assert(/game\.resumedRun = false;/.test(bodyOf("function resetRun(wave, debugRun) {")),
    "M: ⛔ the clearing site is inside the shared reset, so BOTH run paths get it");

  // The two persistence gates, each gaining exactly one clause.
  assert(stripped.includes("if (game.debugRun || game.resumedRun) return;"),
    "M: ⛔ Achievements.save() gates on both flags");
  eq(countOf(stripped, "if (game.debugRun) return;"), 0, "M: ...and the single-flag form is gone");
  // ⚠ CS034 P7: the gate is byte-identical apart from reading the RunResult's own score instead of
  // game.score — the record is written outright at this seam now, with no entry screen in between.
  assert(stripped.includes("!game.debugRun && !game.resumedRun && HighScores.qualifies(run.score)"),
    "M: ⛔ the high-score write gates on both flags");

  // The HUD tell — an else-if on the existing tag's own line, mutually exclusive by construction.
  assert(/if \(game\.debugRun\) drawText\("DEBUG RUN", VIEW_W \/ 2, 18, 14, COLOR\.dim, "center"\);\s*else if \(game\.resumedRun\) drawText\("RESUMED RUN", VIEW_W \/ 2, 18, 14, COLOR\.dim, "center"\);/.test(stripped),
    "M: ⛔ RESUMED RUN is an else-if on DEBUG RUN, same position, same style");
  eq(countOf(stripped, '"RESUMED RUN"'), 1, "M: ...drawn from exactly one site");
})();

// ================= (N) scope pin ====================================================================
(function sectionN() {
  console.log("(N) scope pin — the game file, scratchpad/ and STATUS.md, nothing else");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("N: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: N: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("N: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (N measured against the WORKING TREE — this phase is not committed yet)");

  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `N: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "N: (setup) the game file is in this phase's diff");
})();

restoreRandom();
A.report();
