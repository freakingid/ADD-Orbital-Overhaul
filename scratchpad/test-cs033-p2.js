// Headless test for CS033 P2 — the Leaderboard wrapper and its wiring: beginRun at run start, submit
// at all three real outcomes ('died' at the "dying"->"gameover" seam, 'quit' from a LIVE run only,
// never a second time from gameover's own "Quit to Title"), the title-menu row's unavailable-row
// idiom, the rename flow's NAME_CHANGE_NOTICE gate, and the queue-pending indicator.
//
//   node scratchpad/test-cs033-p2.js
//
// window.KitLeaderboard is injected AFTER build (via extraExports:["window"]) with a fake module that
// records calls — Leaderboard.instance() reads it lazily at call time, so this drives the REAL
// startGame/killShip/updateDeath/quitToTitle/menuTitle/menuProfiles code, never a reimplementation.

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

function fakeKitLeaderboard(calls) {
  return {
    NAME_CHANGE_NOTICE: "Scores you've already posted will keep the name you used at the time.\nOnly new scores will show your new name.",
    create(config) {
      calls.config = config;
      return {
        beginRun: () => { calls.beginRunCount = (calls.beginRunCount || 0) + 1; },
        submit: (payload) => { (calls.submits = calls.submits || []).push(payload); return Promise.resolve({ status: "submitted" }); },
        fetchBoard: (opts) => {
          calls.fetchBoardOpts = opts;
          return Promise.resolve({ gameId: "orbital-overhaul", window: opts.window, metricLabel: "SCORE",
            entries: [{ rank: 1, publicId: "x", displayName: "GHOST", metric: 999, durationS: 10,
              outcome: "died", stats: { wave_reached: 3 }, submittedAt: "", flagged: true }] });
        },
        queueLength: () => calls.queueLengthValue || 0,
        flushQueue: () => Promise.resolve({ sent: 0, failed: 0, dropped: 0 }),
      };
    },
  };
}

(function sectionA() {
  console.log("(A) headless: module absent, every Leaderboard call is a safe no-op");
  const X = buildGame({ store: {} });
  eq(X.leaderboardModuleAvailable(), false, "A: no window.KitLeaderboard in the harness");
  eq(X.Leaderboard.instance(), null, "A: instance() returns null, not a throw");
  X.Leaderboard.beginRun(); X.Leaderboard.submit("died");   // must not throw
  eq(X.Leaderboard.queueLength(), 0, "A: queueLength() defaults to 0 with no module");
})();

(function sectionB() {
  console.log("(B) instance() wires gameId/gameVersion/getPlayer from Profiles correctly");
  const calls = {};
  const X = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  X.window.KitLeaderboard = fakeKitLeaderboard(calls);
  const b = X.Leaderboard.instance();
  assert(!!b, "B: instance() creates a board once the module is present");
  eq(calls.config.gameId, "orbital-overhaul", "B: gameId is the fixed registry id");
  eq(calls.config.gameVersion, X.GAME_VERSION, "B: gameVersion tracks GAME_VERSION");
  const player = calls.config.getPlayer();
  const p0 = X.Profiles.byId(X.PROFILE_LEGACY);
  eq(player.playerId, p0.playerId, "B: getPlayer().playerId is the active profile's player_id");
  eq(player.displayName, "PLAYER 1", "B: getPlayer().displayName is the active profile's name");
  eq(X.Leaderboard.instance(), b, "B: instance() is cached, not recreated per call");
})();

(function sectionC() {
  console.log("(C) beginRun() fires once per resetRun() — startGame() triggers it");
  const calls = {};
  const X = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  X.window.KitLeaderboard = fakeKitLeaderboard(calls);
  X.startGame();
  eq(calls.beginRunCount, 1, "C: startGame() -> resetRun() -> Leaderboard.beginRun() -> board.beginRun()");
})();

(function sectionD() {
  console.log("(D) eligible() gates submit(): a debug or resumed run never reaches board.submit()");
  const calls = {};
  const X = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  X.window.KitLeaderboard = fakeKitLeaderboard(calls);
  X.startGame();
  X.game.debugRun = true;
  X.Leaderboard.submit("died");
  assert(!calls.submits, "D: a debug run's submit() never reaches the module");
  X.game.debugRun = false; X.game.resumedRun = true;
  X.Leaderboard.submit("died");
  assert(!calls.submits, "D: a resumed run's submit() never reaches the module either");
})();

(function sectionE() {
  console.log("(E) 'died' fires at the dying->gameover seam, with real score/wave/delivered");
  const calls = {};
  const X = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  X.window.KitLeaderboard = fakeKitLeaderboard(calls);
  X.startGame();
  X.game.score = 4200; X.game.wave = 3; X.game.stats.delivered = 7; X.game.stats.gameTime = 61.4;
  X.killShip();
  eq(X.game.state, "dying", "E: (setup) killShip() enters the death spectacle, not gameover directly");
  X.updateDeath(999);   // one huge dt clears DEATH_DURATION in a single call — no need for a real tick loop
  eq(X.game.state, "gameover", "E: (setup) the death spectacle ran out");
  assert(!!calls.submits && calls.submits.length === 1, "E: exactly one submit() at the seam");
  const s = calls.submits[0];
  eq(s.outcome, "died", "E: outcome is 'died'");
  eq(s.metric, 4200, "E: metric is game.score");
  eq(s.stats.wave_reached, 3, "E: stats.wave_reached is game.wave");
  eq(s.stats.canisters_delivered, 7, "E: stats.canisters_delivered is game.stats.delivered");
  eq(s.stats.saucer_kills, X.game.stats.saucerKills, "E: stats.saucer_kills reads through game.stats.saucerKills");
  eq(s.stats.garbage_satellite_kills, X.game.stats.debrisKills, "E: stats.garbage_satellite_kills reads through game.stats.debrisKills");
  assert(!("duration" in s.stats) && !Object.keys(s.stats).some(k => k.toLowerCase().includes("duration")),
    "E: stats carries no duration-ish key — durationS stays top-level, not duplicated in");
  eq(s.durationS, 61, "E: durationS is game.stats.gameTime, rounded");
})();

(function sectionF() {
  console.log("(F) 'quit' fires from a LIVE run's Quit; gameover's own Quit to Title never re-submits");
  const calls = {};
  const X = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  X.window.KitLeaderboard = fakeKitLeaderboard(calls);
  X.startGame();
  eq(X.game.state, "playing", "F: (setup) a live run");
  X.quitToTitle();
  assert(!!calls.submits && calls.submits.length === 1 && calls.submits[0].outcome === "quit",
    "F: mid-run Quit submits outcome 'quit' exactly once");
  // Now drive a second run all the way to gameover, and use ITS "Quit to Title" — must NOT submit again.
  X.startGame();
  X.killShip(); X.updateDeath(999);
  eq(X.game.state, "gameover", "F: (setup) the second run reached gameover");
  const countAfterDeath = calls.submits.length;
  X.quitToTitle();   // gameover's own "Quit to Title" row calls this same function
  eq(calls.submits.length, countAfterDeath, "F: ⛔ gameover's Quit to Title does not submit a second time");
})();

(function sectionG() {
  console.log("(G) title menu: 'Leaderboard' is the unavailable-row idiom's newest consumer");
  const X = buildGame({ store: { afd_settings_v1: "{}" } });
  assert(X.MENU_TITLE.includes("Leaderboard"), "G: MENU_TITLE has the row");
  X.game.menu.index = X.MENU_TITLE.indexOf("Leaderboard");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "titlemenu", "G: ⛔ confirm is inert with no module — no navigation");

  const calls = {};
  const Y = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  Y.window.KitLeaderboard = fakeKitLeaderboard(calls);
  Y.game.menu.index = Y.MENU_TITLE.indexOf("Leaderboard");
  Y.menuInput("confirm");
  eq(Y.game.menu.screen, "leaderboard", "G: with the module present, confirm opens the board screen");
  eq(calls.fetchBoardOpts.window, "all", "G: openBoard() defaults to the 'all' window and fetches");
})();

(function sectionH() {
  console.log("(H) rename: NAME_CHANGE_NOTICE gates the rename when the module is present, skipped otherwise");
  // No module: rename applies immediately, exactly as before this phase.
  const X = buildGame({ store: { afd_settings_v1: "{}" } });
  const id = X.Profiles.activeId;
  X.Profiles.rename(id, "RENAMED");
  eq(X.Profiles.nameOf(id), "RENAMED", "H: with no module, rename() applies with no modal");

  // Module present: renaming through the profiles screen must NOT apply until the modal confirms.
  const calls = {};
  const Y = buildGame({ store: { afd_settings_v1: "{}" }, extraExports: ["window"] });
  Y.window.KitLeaderboard = fakeKitLeaderboard(calls);
  const yid = Y.Profiles.activeId;
  Y.gotoScreen("profiles");
  Y.game.menu.index = 0; Y.game.menu.col = 1;   // row 0 (the only profile), RENAME verb
  Y.menuInput("confirm");                        // opens nameentry
  eq(Y.game.menu.screen, "nameentry", "H: (setup) RENAME opens the name-entry grid");
  Y.game.menu.nameBuf = "RENAMED";
  Y.nameEntryCommit();
  eq(Y.Profiles.nameOf(yid), "PLAYER 1", "H: ⛔ the rename has NOT applied yet — the notice is pending");
  assert(!!Y.game.menu.modal, "H: the confirmation modal is open");
  eq(Y.game.menu.modal.text, fakeKitLeaderboard(calls).NAME_CHANGE_NOTICE, "H: modal text is NAME_CHANGE_NOTICE verbatim");
  // The modal's default focus is CANCEL (index 1, the safety property) — toggle onto CONFIRM (index 0)
  // first, same as any other openModal() consumer's test would, then confirm it.
  Y.menuInput("up");
  Y.menuInput("confirm");
  eq(Y.Profiles.nameOf(yid), "RENAMED", "H: confirming the modal applies the rename");
})();

(function sectionI() {
  console.log("(I) queueLength() reflects the module's own queue, read fresh every call");
  const calls = { queueLengthValue: 3 };
  const X = buildGame({ store: {}, extraExports: ["window"] });
  X.window.KitLeaderboard = fakeKitLeaderboard(calls);
  eq(X.Leaderboard.queueLength(), 3, "I: queueLength() passes through the module's own count");
})();

A.report();
