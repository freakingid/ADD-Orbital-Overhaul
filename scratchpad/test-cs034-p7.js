// Headless test for CS034 Phase 7 — the local high score rework: the initials entry deleted, the
// record written from the profile at the death seam, the full stat set, 25 rows, the profile filter,
// the two-stage reset, and HighScores shaped for extraction.
//
//   node scratchpad/test-cs034-p7.js
//
// Drives the REAL code: killShip/update to the "dying"->"gameover" seam, HighScores.add/load/save/
// filtered/qualifies, makeRunResult, menuHighScores, menuModal, nameEntryCommit, drawMenu.
//
// FOUR TRAPS THIS FILE EXISTS FOR:
//  1. ⛔ load()'s filter. It used to require `typeof r.initials === "string"`; a new record has no
//     `initials`, so leaving that clause in would have thrown away every record this build writes on
//     the NEXT boot. §C round-trips through a second build rather than trusting memory.
//  2. ⛔ The eligibility gate is UNCHANGED and still refuses a debug or resumed run (§E).
//  3. ⛔ qualifies()/add() must never see the filter — a record cannot qualify differently depending
//     on which screen was last open (§F).
//  4. ⛔ HighScores reads no game global. §H reads that off the source, because a build with `game`
//     in scope passes every behavioural check either way.
//
// Sections: (A) node --check + the entry is gone. (B) the seam writes the record. (C) the store
// round-trip. (D) the stat set + rename snapshot. (E) debug/resumed write nothing. (F) capacity and
// the filter. (G) the two-stage reset. (H) extraction shape. (I) the browsable screen. (J) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-34 p6: typed-confirm screen + achievement reset".
const PARENT_SHA = "6f7bcfc6e99c925df2b3f3d0b4b609f8a908cfe4";
const PHASE_SUBJECT = "cs-34 p7:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// A build with a two-profile roster made by the game's own add(). The first add mints "p0", which IS
// PROFILE_LEGACY, so the active profile's stores are the bare frozen keys.
function withProfiles(store, opts) {
  const X = buildGame(Object.assign({ store: store || {} }, opts));
  X.Profiles.add("PAUL");
  X.Profiles.add("RIPLEY");
  return X;
}
// Drive a real run to the "dying" -> "gameover" seam with chosen numbers on the clock. The field is
// emptied first so the death shockwave detonates nothing and the stat counters stay where we put them.
function deathAt(X, opts) {
  const o = opts || {};
  X.startGame();
  X.game.score = o.score == null ? 50000 : o.score;
  X.game.wave = o.wave == null ? 4 : o.wave;
  X.game.stats.delivered = o.delivered == null ? 11 : o.delivered;
  X.game.stats.gameTime = o.gameTime == null ? 187.6 : o.gameTime;
  X.game.stats.saucerKills = o.saucerKills == null ? 6 : o.saucerKills;
  X.game.stats.debrisKills = o.satelliteKills == null ? 23 : o.satelliteKills;
  if (o.resumed) X.game.resumedRun = true;
  X.game.debris.length = 0; X.game.hunters.length = 0; X.game.saucers.length = 0;
  X.killShip();
  for (let i = 0; i < 2000 && X.game.state !== "gameover"; i++) X.update(0.05);
  X.game.celebration = null;   // the panel opens at the same seam and owns input; not this file's subject
  return X;
}
const typeIn = (X, s) => { for (const ch of s) X.nameEntryKey(ch); };
function pressCell(X, label) {
  const i = X.NAME_CELLS.indexOf(label);
  X.game.menu.row = Math.floor(i / X.NAME_GRID_COLS);
  X.game.menu.col = i % X.NAME_GRID_COLS;
  X.menuInput("confirm");
}
// A plain record the caller assembles, the way the build's own callers now do.
function rec(X, o) {
  return Object.assign({ name: "SOMEONE", score: 100, wave: 1, delivered: 0, durationS: 10,
    saucerKills: 0, satelliteKills: 0, build: X.GAME_VERSION }, o);
}

// ================= (A) node --check; the initials entry is gone, the charset is not ================
(function sectionA() {
  console.log("(A) node --check; the initials entry is deleted; SCORES_CHARSET survives");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs034p7_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // ⛔ Every trace of the subsystem, in LIVE CODE and in comments alike — the phase's own done-when.
  for (const gone of ["game.entry", "entryInput", "commitEntry", "drawEntrySlots"]) {
    assert(!src.includes(gone), `A: ⛔ \`${gone}\` appears nowhere in the build file, comments included`);
  }
  // ...and the field is gone from the live game object, not merely never written.
  const X = withProfiles();
  assert(!("entry" in X.game), "A: ⛔ the game object declares no `entry` field");
  X.startGame();
  assert(!("entry" in X.game), "A: ⛔ ...and a fresh run does not re-create one (the both-places rule, both places)");

  // ⛔ SCORES_CHARSET IS KEPT — NAME_CELLS derives from it, and P6's typed confirm lives on that grid.
  assert(/^const SCORES_CHARSET = /m.test(stripped), "A: ⛔ SCORES_CHARSET is still declared");
  assert(/const NAME_CELLS\s*= SCORES_CHARSET\.split\(""\)/.test(stripped),
    "A: ⛔ ...and NAME_CELLS still derives from it");
  eq(X.NAME_CELLS.length, X.SCORES_CHARSET.length + 3, "A: ...charset plus the three verb cells, unchanged");
  assert(X.NAME_CELLS.includes("R") && X.NAME_CELLS.includes("E") && X.NAME_CELLS.includes("T"),
    "A: ...so a pad can still spell the typed-confirm word off the grid");
  // Its comment was repointed, not left describing a deleted feature.
  const charsetDoc = src.slice(src.lastIndexOf("// ", src.indexOf("const SCORES_CHARSET")) - 600,
                               src.indexOf("const SCORES_CHARSET"));
  assert(/name-entry grid alphabet/i.test(charsetDoc), "A: ...and its comment now calls it the name-entry grid alphabet");
})();

// ================= (B) ⛔ the seam writes the record, named from the profile =======================
(function sectionB() {
  console.log("(B) ⛔ a qualifying run's record is written at the death seam, from the active profile");
  const X = withProfiles();
  eq(X.Profiles.nameOf(X.Profiles.activeId), "PAUL", "B: (setup) the active profile is PAUL");
  deathAt(X, { score: 50000 });
  eq(X.game.state, "gameover", "B: (setup) the run reached gameover");

  eq(X.HighScores.entries.length, 1, "B: ⛔ exactly one record was written — with no input at all");
  const r = X.HighScores.entries[0];
  eq(r.name, "PAUL", "B: ⛔ its `name` is the active profile's name");
  assert(!("initials" in r), "B: ⛔ ...and it carries no `initials` key");
  eq(X.game.lastScoreId, r.id, "B: ⛔ game.lastScoreId points at it, for the gameover table's highlight");
  eq(r.profileId, X.Profiles.activeId, "B: the CS031 ownership stamps are still there — profileId...");
  eq(r.profileName, "PAUL", "B: ...and profileName");
  eq(r.build, X.GAME_VERSION, "B: and the build stamp");

  // A NON-qualifying run writes nothing and marks nothing. qualifies() refuses a score of 0.
  const Y = withProfiles();
  deathAt(Y, { score: 0 });
  eq(Y.HighScores.entries.length, 0, "B: a zero score writes no record");
  eq(Y.game.lastScoreId, null, "B: ...and marks no highlight");

  // A second profile's run is named for THAT profile.
  const Z = withProfiles();
  assert(Z.Profiles.activate("p1"), "B: (setup) switched to RIPLEY");
  deathAt(Z, { score: 777 });
  eq(Z.HighScores.entries[0].name, "RIPLEY", "B: ⛔ a different profile's run is named for it");
  eq(Z.HighScores.entries[0].profileId, "p1", "B: ...and stamped with its id");
})();

// ================= (C) ⛔ the store round-trip, both record shapes =================================
(function sectionC() {
  console.log("(C) ⛔ load() keeps a `name` record AND a legacy `initials` one — the filter's one clause");
  // TRAP 1, driven the only way that proves it: a SECOND build over the same store.
  const store = {};
  const X = withProfiles(store);
  deathAt(X, { score: 4242 });
  eq(X.HighScores.entries.length, 1, "C: (setup) the run's record is in memory");
  assert(typeof store["afd_scores_v1"] === "string", "C: (setup) ...and on disk");

  const Z = buildGame({ store });
  eq(Z.HighScores.entries.length, 1, "C: ⛔ a fresh build reads the new record back — it is NOT filtered out");
  eq(Z.HighScores.entries[0].name, "PAUL", "C: ⛔ ...with its name intact");
  eq(Z.HighScores.entries[0].score, 4242, "C: ...and its score");

  // A pre-CS034 record — `initials`, no `name`, none of the new fields — still loads.
  const legacyStore = { afd_scores_v1: JSON.stringify({ v: 1, entries: [
    { v: 1, id: "legacy-1", initials: "ABC", score: 9000, wave: 5, delivered: 4, ts: 1700000000000, build: "3.6" }
  ] }) };
  const L = buildGame({ store: legacyStore });
  eq(L.HighScores.entries.length, 1, "C: ⛔ a legacy `initials` record still loads");
  eq(L.HighScores.entries[0].initials, "ABC", "C: ⛔ ...unmigrated, initials and all");
  assert(!("name" in L.HighScores.entries[0]), "C: ...and nothing back-filled a `name` onto it");
  eq(L.scoreName(L.HighScores.entries[0]), "ABC", "C: ⛔ the renderer shows its initials forever");
  eq(L.scoreName({ name: "PAUL", initials: "ZZZ" }), "PAUL", "C: ⛔ ...and prefers `name` when both are present");
  eq(L.scoreName({ score: 1 }), "—", "C: ...falling back to an em dash when a record has neither");

  // Junk still cannot get in: the ONE surviving clause is a numeric score.
  const junkStore = { afd_scores_v1: JSON.stringify({ v: 1, entries: [
    { id: "a", score: "500" }, { id: "b" }, null, { id: "d", name: "OK", score: 7 }
  ] }) };
  const J = buildGame({ store: junkStore });
  eq(J.HighScores.entries.length, 1, "C: ⛔ a string score, a missing score and a null are all still refused");
  eq(J.HighScores.entries[0].id, "d", "C: ...and the one well-formed record survives");
})();

// ================= (D) ⛔ the full stat set; a rename never rewrites a record =====================
(function sectionD() {
  console.log("(D) ⛔ durationS / saucerKills / satelliteKills come off game.stats; a later rename does not");
  const X = withProfiles();
  deathAt(X, { score: 31337, wave: 9, delivered: 14, gameTime: 187.6, saucerKills: 6, satelliteKills: 23 });
  const r = X.HighScores.entries[0];
  eq(r.durationS, 188, "D: ⛔ durationS is Math.round(game.stats.gameTime)");
  eq(r.saucerKills, 6, "D: ⛔ saucerKills tracks game.stats.saucerKills");
  // ⚠ The local field takes the CANONICAL CS034 name; the runtime counter it reads keeps the inverted
  // one. Not a typo — spec §6.2, and the one canonical identifier this changeset introduces.
  eq(r.satelliteKills, 23, "D: ⛔ satelliteKills tracks game.stats.debrisKills (canonical name, inverted source)");
  eq(r.wave, 9, "D: wave");
  eq(r.delivered, 14, "D: delivered");

  // ⛔ SNAPSHOT AT COMMIT. Renaming the profile afterwards must not touch the record.
  assert(X.Profiles.rename("p0", "PAULINE"), "D: (setup) the profile renamed");
  eq(X.Profiles.nameOf("p0"), "PAULINE", "D: (setup) ...and the roster shows it");
  eq(X.HighScores.entries[0].name, "PAUL", "D: ⛔ the existing record keeps the name it was written under");
  eq(X.HighScores.entries[0].profileName, "PAUL", "D: ⛔ ...and so does its profileName stamp");
  // A run AFTER the rename picks the new name up, so the snapshot is a snapshot and not a freeze.
  deathAt(X, { score: 99999 });
  eq(X.HighScores.entries[0].name, "PAULINE", "D: a NEW record uses the new name");
  eq(X.HighScores.entries[1].name, "PAUL", "D: ⛔ ...while the old one still does not");

  // ⛔ ONE OBJECT, TWO CONSUMERS: the leaderboard payload reads the same RunResult the table did.
  // The fake module is injected AFTER build (test-cs033-p2.js's own idiom) — Leaderboard.instance()
  // reads the global lazily, so this drives the real submit path.
  const Y = withProfiles(null, { extraExports: ["window"] });
  const posts = [];
  Y.window.KitLeaderboard = { create: () => ({ beginRun() {}, submit: p => { posts.push(p); return Promise.resolve({}); },
    queueLength: () => 0, fetchBoard: () => Promise.resolve({ entries: [] }) }) };
  deathAt(Y, { score: 31337, wave: 9, delivered: 14, gameTime: 187.6, saucerKills: 6, satelliteKills: 23 });
  eq(posts.length, 1, "D: (setup) exactly one leaderboard submit at the seam");
  const local = Y.HighScores.entries[0];
  eq(posts[0].metric, local.score, "D: ⛔ the posted metric is the record's own score");
  eq(posts[0].durationS, local.durationS, "D: ⛔ ...its durationS");
  eq(posts[0].stats.wave_reached, local.wave, "D: ⛔ ...its wave");
  eq(posts[0].stats.canisters_delivered, local.delivered, "D: ⛔ ...its delivered count");
  eq(posts[0].stats.saucer_kills, local.saucerKills, "D: ⛔ ...its saucer kills");
  eq(posts[0].stats.debris_destroyed, local.satelliteKills, "D: ⛔ ...and its satellite kills");
  eq(Object.keys(posts[0].stats).sort().join(","), "canisters_delivered,debris_destroyed,saucer_kills,wave_reached",
    "D: ⛔ the four registered stats keys are untouched by this phase");
})();

// ================= (E) ⛔ a debug run and a resumed run each write NOTHING ========================
(function sectionE() {
  console.log("(E) ⛔ the eligibility gate is unchanged: neither a debug run nor a resumed run records");
  const D = withProfiles();
  D.applyDebug("startLevel", 33);
  deathAt(D, { score: 999999999 });
  assert(D.game.debugRun, "E: (setup) the run really is a debug run");
  eq(D.HighScores.entries.length, 0, "E: ⛔ a debug run writes no record, qualifying score or not");
  eq(D.game.lastScoreId, null, "E: ⛔ ...and marks no highlight");

  const R = withProfiles();
  deathAt(R, { score: 999999999, resumed: true });
  assert(R.game.resumedRun, "E: (setup) the run really is flagged resumed");
  eq(R.HighScores.entries.length, 0, "E: ⛔ a resumed run writes no record either");
  eq(R.game.lastScoreId, null, "E: ⛔ ...and marks no highlight");

  // TEETH — the same score on an ordinary run does record.
  const T = withProfiles();
  deathAt(T, { score: 999999999 });
  eq(T.HighScores.entries.length, 1, "E: (teeth) ...while an ordinary run with the same score DOES");

  // ⛔ The gate's source, byte-for-byte with Leaderboard.eligible()'s two flags — CLAUDE.md requires
  // the two be extended together, so a one-sided extension has to fail here.
  assert(stripped.includes("!game.debugRun && !game.resumedRun && HighScores.qualifies(run.score)"),
    "E: ⛔ the local gate still reads !debugRun && !resumedRun && qualifies()");
  assert(/eligible\(\) \{ return !game\.debugRun && !game\.resumedRun; \}/.test(stripped),
    "E: ⛔ ...and Leaderboard.eligible() is untouched beside it");
})();

// ================= (F) capacity 25, the filter as a VIEW =========================================
(function sectionF() {
  console.log("(F) SCORES_MAX 25 and the table caps there; filtered() is a view qualifies() never sees");
  const X = withProfiles();
  eq(X.SCORES_MAX, 25, "F: SCORES_MAX is 25");
  for (let i = 0; i < 40; i++) X.HighScores.add(rec(X, { name: "N" + i, score: i + 1, profileId: "p0" }));
  eq(X.HighScores.entries.length, 25, "F: ⛔ the table caps at SCORES_MAX after 40 inserts");
  eq(X.HighScores.entries[0].score, 40, "F: ...keeping the highest");
  eq(X.HighScores.entries[24].score, 16, "F: ...and dropping the lowest 15");

  // The filter.
  const Y = withProfiles();
  Y.HighScores.add(rec(Y, { name: "PAUL", score: 300, profileId: "p0" }));
  Y.HighScores.add(rec(Y, { name: "RIPLEY", score: 200, profileId: "p1" }));
  Y.HighScores.add(rec(Y, { name: "PAUL", score: 100, profileId: "p0" }));
  Y.HighScores.entries.push({ v: 1, id: "ancient", initials: "OLD", score: 250 });  // pre-CS031: no profileId
  Y.HighScores.entries.sort((a, b) => b.score - a.score);

  eq(Y.HighScores.filtered("p0").length, 2, "F: filtered('p0') returns only p0's two records");
  assert(Y.HighScores.filtered("p0").every(r => r.profileId === "p0"), "F: ...and every one of them is p0's");
  eq(Y.HighScores.filtered("p1").length, 1, "F: filtered('p1') returns p1's one record");
  // ⛔ A pre-CS031 record belongs to nobody in particular and appears under NEITHER profile.
  assert(!Y.HighScores.filtered("p0").some(r => r.id === "ancient"), "F: ⛔ a profileId-less record is not p0's...");
  assert(!Y.HighScores.filtered("p1").some(r => r.id === "ancient"), "F: ⛔ ...nor p1's");
  assert(Y.HighScores.entries.some(r => r.id === "ancient"), "F: ...but it IS in the unfiltered table");
  eq(Y.HighScores.filtered(undefined).length, 0, "F: filtered() with no id matches nothing, rather than everything");

  // ⛔ qualifies() and add() ALWAYS work the unfiltered table — a record must not qualify differently
  // depending on which screen was last open.
  const Q = withProfiles();
  for (let i = 0; i < Q.SCORES_MAX; i++) Q.HighScores.add(rec(Q, { name: "P" + i, score: (i + 1) * 100, profileId: "p1" }));
  assert(Q.Profiles.activate("p0"), "Q: (setup) active profile has NO records of its own");
  eq(Q.HighScores.filtered(Q.Profiles.activeId).length, 0, "F: (setup) the THIS PROFILE view is empty");
  const answers = [];
  for (const f of ["all", "profile", "all", "profile"]) {
    Q.game.menu.hsFilter = f;
    answers.push(Q.HighScores.qualifies(50) + "/" + Q.HighScores.qualifies(100000));
  }
  eq(new Set(answers).size, 1, "F: ⛔ qualifies() answers identically whichever filter is set");
  eq(answers[0], "false/true", "F: ...and it is the UNFILTERED answer (50 loses to a full table, 100000 wins)");
  Q.game.menu.hsFilter = "profile";
  const before = Q.HighScores.entries.length;
  Q.HighScores.add(rec(Q, { name: "PAUL", score: 100000, profileId: "p0" }));
  eq(Q.HighScores.entries.length, before, "F: ⛔ add() capped against the whole table, not the filtered view");
  eq(Q.HighScores.entries[0].name, "PAUL", "F: ...and the new record still sorted to #1 of the shared table");
  Q.game.menu.hsFilter = "all";
})();

// ================= (G) ⛔ the two-stage reset ====================================================
(function sectionG() {
  console.log("(G) ⛔ reset: modal (CANCEL default) -> typed word -> entries, key and lastScoreId all cleared");
  const store = {};
  const X = withProfiles(store);
  deathAt(X, { score: 5000 });
  eq(X.HighScores.entries.length, 1, "G: (setup) a record exists");
  assert(X.game.lastScoreId, "G: (setup) ...and is marked for the highlight");
  X.quitToTitle();
  X.gotoScreen("highscores", 0);

  // --- stage 1 ---
  X.menuInput("confirm");
  assert(!!X.game.menu.modal, "G: ⛔ confirm on the screen opens the modal instead of leaving");
  eq(X.game.menu.screen, "highscores", "G: ...staying on the screen");
  eq(X.game.menu.modal.index, 1, "G: ⛔ CANCEL is the default row — openModal's safety property, untouched");
  eq(X.game.menu.modal.confirmLabel, "ERASE", "G: the confirm row keeps the shipped ERASE wording");
  assert(/cannot be undone/i.test(X.game.menu.modal.text), "G: ...and the prompt says so");

  // ENTER straight through cancels and erases nothing.
  X.menuInput("confirm");
  eq(X.game.menu.modal, null, "G: ⛔ ENTER on the default row CANCELS");
  eq(X.HighScores.entries.length, 1, "G: ⛔ ...with nothing erased");

  // --- stage 2 ---
  X.menuInput("confirm"); X.menuInput("up");
  eq(X.game.menu.modal.index, 0, "G: (setup) cursor moved to ERASE deliberately");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "nameentry", "G: ⛔ confirming raises the TYPED field, not the erase");
  eq(X.game.menu.nameCtx.title, X.ACH_RESET_TITLE, "G: ...under the shared typed-confirm heading");
  eq(X.HighScores.entries.length, 1, "G: ⛔ ...and STILL nothing is erased — one stage is not enough");

  // A wrong word is refused, live and at commit.
  typeIn(X, "NOPE");
  eq(X.game.menu.nameErr, X.ACH_RESET_ERR, "G: ⛔ a wrong word reports live");
  pressCell(X, X.NAME_CELL_DONE);
  eq(X.game.menu.screen, "nameentry", "G: ⛔ ...and DONE on it commits nothing");
  eq(X.HighScores.entries.length, 1, "G: ⛔ ...the table is intact");

  // Backing out returns to the screen, unerased. ⛔ `back` is BACKSPACE while anything is typed and
  // only aborts on an empty buffer (CS031 P3's rule), so "NOPE" costs four presses plus one.
  for (let i = 0; i < 5; i++) X.menuInput("back");
  eq(X.game.menu.screen, "highscores", "G: back out of the typed field returns to the screen");
  eq(X.HighScores.entries.length, 1, "G: ...still unerased");

  // The whole way through, on the pad's own route: every letter off the shared NAME_CELLS grid.
  X.menuInput("confirm"); X.menuInput("up"); X.menuInput("confirm");
  for (const ch of "RESET") pressCell(X, ch);
  eq(X.game.menu.nameBuf, "RESET", "G: ⛔ a GAMEPAD can spell the word — every letter is a real grid cell");
  pressCell(X, X.NAME_CELL_DONE);
  eq(X.game.menu.screen, "highscores", "G: committing lands back on the screen");

  eq(X.HighScores.entries.length, 0, "G: ⛔ entries is emptied in memory");
  eq(X.game.lastScoreId, null, "G: ⛔ ...lastScoreId is cleared — the id it pointed at is gone");
  const stored = JSON.parse(store["afd_scores_v1"]);
  eq(stored.entries.length, 0, "G: ⛔ ...and the PERSISTED table is empty too");
  assert("afd_scores_v1" in store, "G: ⛔ ...written through save(), never a removeItem");
  eq(X.HighScores.qualifies(1), true, "G: qualifies() answers off the wiped table immediately");
  // A fresh build over the same store agrees — the wipe really persisted.
  eq(buildGame({ store }).HighScores.entries.length, 0, "G: ⛔ a fresh build reads back an empty table");

  // ⛔ resetHighScores() is reachable ONLY behind the typed stage, from both of its callers.
  eq(stripped.split("resetHighScores").length - 1, 2,
    "G: ⛔ resetHighScores appears exactly twice in live code — its declaration and ONE reference");
  assert(/onCommit: resetHighScores/.test(stripped),
    "G: ⛔ ...and that reference is the typed field's onCommit, i.e. behind BOTH stages");
  eq(stripped.split("openScoresReset(").length - 1, 3,
    "G: openScoresReset has exactly two call sites — the screen and the debug row — plus its declaration");
  assert(/else if \(r\.label === "Reset saved scores"\) openScoresReset\("debug", m\.index\);/.test(stripped),
    "G: the debug panel's own row STAYS, now routed through the same flow");
})();

// ================= (H) ⛔ shaped for extraction ===================================================
(function sectionH() {
  console.log("(H) ⛔ HighScores reads no game global; its surface is the five documented methods");
  // Brace-match the object out of the source and read it, because a build with `game` in scope passes
  // every behavioural check whether or not the module reaches for it.
  const from = stripped.indexOf("const HighScores = {");
  assert(from >= 0, "H: (setup) the HighScores object was located");
  let depth = 0, end = -1;
  for (let i = stripped.indexOf("{", from); i < stripped.length; i++) {
    if (stripped[i] === "{") depth++;
    else if (stripped[i] === "}" && --depth === 0) { end = i + 1; break; }
  }
  const body = stripped.slice(from, end);
  assert(end > from, "H: (setup) ...and brace-matched");
  for (const global of ["game.", "GAME_VERSION", "Profiles"]) {
    assert(!body.includes(global), `H: ⛔ HighScores never reads \`${global}\``);
  }
  // Non-vacuous: the instrument can see a reference when there is one.
  assert(body.includes("SCORES_MAX") && body.includes("storageOK"),
    "H: (non-vacuous) ...while it DOES reference the cap and the shared storage helper");
  // ⛔ Nor is the key routed through Profiles.keyFor() — one shared machine-wide table (⚠ SETTLED).
  assert(!body.includes("keyFor"), "H: ⛔ afd_scores_v1 is NOT routed through Profiles.keyFor()");
  assert(body.includes('STORAGE_KEY: "afd_scores_v1"'), "H: ⛔ and the frozen key name is unchanged");

  // The surface. `makeId` is internal bookkeeping (it reads nothing the game owns), so the five
  // documented entry points are what a caller may use — and all five exist.
  const X = withProfiles();
  for (const fn of ["qualifies", "add", "save", "load", "filtered"]) {
    eq(typeof X.HighScores[fn], "function", `H: HighScores.${fn}() exists`);
  }
  // ⛔ add() takes a COMPLETE record and stamps only the store's own three bookkeeping fields.
  const handed = rec(X, { name: "ZZZ", score: 4321 });
  const copy = JSON.parse(JSON.stringify(handed));
  const stored = X.HighScores.add(handed);
  eq(JSON.stringify(handed), JSON.stringify(copy),
    "H: ⛔ add() does NOT mutate the caller's object — the same RunResult also goes to the leaderboard");
  for (const k of Object.keys(copy)) eq(stored[k], copy[k], `H: ...the record kept the caller's \`${k}\``);
  eq(stored.v, 1, "H: ...and add() stamped its own `v`");
  assert(typeof stored.id === "string" && stored.id.length > 0, "H: ...its own `id`");
  assert(typeof stored.ts === "number" && stored.ts > 0, "H: ...and its own `ts`");

  // ⛔ makeRunResult() is the ONE assembler: the seam and Leaderboard.submit()'s default both use it.
  eq(stripped.split("makeRunResult()").length - 1, 3,
    "H: ⛔ makeRunResult() has exactly two call sites — the death seam and submit()'s default — plus its declaration");
  assert(/const run = makeRunResult\(\);/.test(stripped), "H: ...the seam assembles it once...");
  assert(/Leaderboard\.submit\("died", run\);/.test(stripped), "H: ...and hands that very object to the leaderboard");
  assert(/HighScores\.add\(run\)\.id/.test(stripped), "H: ...and to the local table");
})();

// ================= (I) the browsable screen =======================================================
(function sectionI() {
  console.log("(I) the screen: filter toggle, one scroll ceiling, the reset row, and a headless render");
  const X = withProfiles();
  eq(X.game.menu.hsFilter, X.HS_FILTER_DEFAULT, "I: the filter boots on its default");
  eq(X.HS_FILTER_DEFAULT, "all", "I: ...which is ALL PROFILES");
  X.startGame();
  eq(X.game.menu.hsFilter, X.HS_FILTER_DEFAULT, "I: ⛔ ...and resetRun() seeds it too (the both-places rule)");

  X.quitToTitle();
  X.gotoScreen("highscores", 0);
  X.menuInput("right");
  eq(X.game.menu.hsFilter, "profile", "I: ► moves to THIS PROFILE");
  X.menuInput("right");
  eq(X.game.menu.hsFilter, "all", "I: ...and wraps back round");
  X.menuInput("left");
  eq(X.game.menu.hsFilter, "profile", "I: ◄ wraps the other way too");
  X.menuInput("left");
  eq(X.game.menu.hsFilter, "all", "I: ...back to the start");

  // The rows the screen shows follow the filter; qualifies() (checked in §F) does not.
  X.HighScores.add(rec(X, { name: "PAUL", score: 300, profileId: "p0" }));
  X.HighScores.add(rec(X, { name: "RIPLEY", score: 200, profileId: "p1" }));
  eq(X.scoreRows().length, 2, "I: ALL PROFILES shows both records");
  X.game.menu.hsFilter = "profile";
  eq(X.scoreRows().length, 1, "I: THIS PROFILE shows only the active profile's");
  eq(X.scoreRows()[0].name, "PAUL", "I: ...and it is the right one");
  X.game.menu.hsFilter = "all";

  // ⛔ ONE ceiling, shared by the renderer and the input handler, and measured FROM THE CLIP TOP.
  X.HighScores.entries = [];
 // stamped p1 so the THIS PROFILE view below is genuinely empty
  for (let i = 0; i < 25; i++) X.HighScores.add(rec(X, { name: "N" + i, score: i + 1, profileId: "p1" }));
  const max = X.scoresMaxScroll();
  assert(max > 0, "I: 25 rows overflow the band, so the screen genuinely scrolls");
  const expected = (X.HS_ROW0_Y - X.HS_ROW_CLIP_TOP) + 24 * X.HS_ROW_PITCH + X.HS_ROW_DESCENT
                   - (X.HS_ROW_CLIP_BOTTOM - X.HS_ROW_CLIP_TOP);
  eq(max, expected, "I: ⚠ the ceiling is measured from the CLIP TOP, not from row 0's baseline");
  X.game.menu.scroll = 0;
  for (let i = 0; i < 200; i++) X.menuInput("down");
  eq(X.game.menu.scroll, max, "I: ⛔ scrolling down clamps at the SAME scoresMaxScroll() the renderer uses");
  for (let i = 0; i < 200; i++) X.menuInput("up");
  eq(X.game.menu.scroll, 0, "I: ⛔ ...and up clamps at 0");
  eq(X.ACH_SCROLL_STEP > 0, true, "I: (setup) the step is the Achievements viewer's own knob");
  X.menuInput("down");
  eq(X.game.menu.scroll, X.ACH_SCROLL_STEP, "I: ...one press is one ACH_SCROLL_STEP");

  // Switching the filter zeroes the scroll — the two views are different heights (setAchTab's reason).
  X.menuInput("down"); X.menuInput("down");
  assert(X.game.menu.scroll > 0, "I: (setup) scrolled into the table");
  X.menuInput("right");
  eq(X.game.menu.scroll, 0, "I: ⛔ switching the filter zeroes the scroll");
  eq(X.scoresMaxScroll(), 0, "I: ...and the empty THIS PROFILE view has no ceiling to scroll to");
  X.menuInput("left");

  // The footer no longer promises ENTER returns, and names what it does instead.
  assert(!/ENTER\s*\/?\s*B?\s*return|\/ ENTER/.test(X.HS_HINT), `I: ⛔ HS_HINT drops "ENTER return" (got "${X.HS_HINT}")`);
  assert(/reset/i.test(X.HS_HINT), "I: ⛔ ...and names the reset instead");
  assert(/◄►/.test(X.HS_HINT) && /scroll/.test(X.HS_HINT), "I: ...while advertising the filter and the scroll");

  // Headless render at every state this screen can be in.
  let threw = null;
  try {
    for (const f of ["all", "profile"]) {
      X.game.menu.hsFilter = f;
      X.game.menu.scroll = 0; X.drawMenu();
      X.game.menu.scroll = X.scoresMaxScroll(); X.drawMenu();
    }
    X.game.menu.hsFilter = "all";
    X.HighScores.entries = [{ v: 1, id: "legacy", initials: "OLD", score: 10 }];   // no name, no stats
    X.game.menu.scroll = 0; X.drawMenu();
    X.HighScores.entries = [];
    X.drawMenu();                              // the empty state
    X.menuInput("confirm"); X.drawMenu();      // stage 1 over the screen
    X.menuInput("up"); X.menuInput("confirm"); X.drawMenu();   // stage 2
    typeIn(X, "NOPE"); X.drawMenu();           // ...with the inline error showing
  } catch (e) { threw = e; }
  eq(threw, null, "I: drawMenu() renders every state headlessly" + (threw ? ": " + threw.message : ""));
  eq(X.AudioSys.ctx, null, "I: ⛔ all of the above ran with no AudioContext — headless-safe throughout");

  // The gameover table kept its five columns, INITIALS -> NAME the only change (spec §6.4).
  const G = withProfiles();
  deathAt(G, { score: 8080 });
  let renderThrew = null;
  try { G.draw(); } catch (e) { renderThrew = e; }
  eq(renderThrew, null, "I: the gameover screen renders headlessly" + (renderThrew ? ": " + renderThrew.message : ""));
  assert(G.HighScores.entries.length === 1 && G.game.lastScoreId,
    "I: (setup) ...with a fresh record to highlight, i.e. the branch that used to draw the entry slots");
  const tableSrc = stripped.slice(stripped.indexOf("function drawScoreTable("), stripped.indexOf("function drawScoreTable(") + 1400);
  assert(tableSrc.includes('drawText("NAME"'), "I: ⛔ the gameover table's second column header reads NAME");
  assert(!tableSrc.includes("INITIALS"), "I: ⛔ ...and no longer reads INITIALS");
  for (const h of ["#", "SCORE", "LEVEL", "DELIVERED"]) {
    assert(tableSrc.includes(`drawText("${h}"`), `I: ...while the "${h}" column is unchanged`);
  }
  eq(G.HS_GAMEOVER_ROWS, 10, "I: ⛔ the gameover table still shows ten rows of a now-25-deep table");
})();

// ================= (J) scope pin =================================================================
(function sectionJ() {
  console.log("(J) scope pin — the game file, scratchpad/, STATUS.md and the GDD");
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

  const outside = outsideScope(changed, ["ORBITAL-OVERHAUL-GDD.md"]);
  eq(outside.join(","), "", `J: nothing outside the game file, scratchpad/, STATUS.md and the GDD (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "J: (setup) the game file is in this phase's diff");
})();

A.report();
