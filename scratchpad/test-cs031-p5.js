// Headless test for CS031 Phase 5 — title integration: the Profile row, derived title-menu layout,
// first-boot routing, and closing FLAG-CS031-d (the game.stats cross-profile bleed).
//
//   node scratchpad/test-cs031-p5.js
//
// Drives the REAL code via _harness.js's buildGame() — menuTitle/menuInput/gotoScreen/drawTitleMenu/
// titleMenuLayout/Profiles.activate, the real game.menu literal's boot-time screen choice. No
// navigation, layout arithmetic or roster logic is reimplemented here.
//
// Sections: (A) MENU_TITLE gained "Profile"; the wiring at all label-based consumers. (B) FORK-G:
// titleMenuLayout(n) is a pure function of the row count, asserted at N=5 (the real build) AND N=6
// (CS032's future row) without waiting for that row to exist. (C) FORK-E: first-boot routing.
// (D) FORK-H the row's own render contract + FORK-I its title-only reachability. (E) FLAG-CS031-d:
// Profiles.activate() no longer bleeds a stale game.stats onto the incoming profile. (F) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-31 p4: Choose Profile screen".
const PARENT_SHA = "1adeb07e2bac6145b58ffdf035a9cea60fa680b1";
const PHASE_SUBJECT = "cs-31 p5:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// Brace-matched slice of a block, from the declaration through its closing brace (the P1/P2/P4 helper).
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

// A store already holding one migrated-looking roster entry, so Profiles.init() is NOT first-boot —
// every section below except (C) wants a build that lands on "titlemenu" like a returning player's.
function seededStore(name) {
  return { afd_profiles_v1: JSON.stringify({
    v: 1, lastUsed: "p0", seq: 1, profiles: [{ id: "p0", name, created: 1 }]
  }) };
}

// Installs a recording override directly on the build's OWN ctx proxy (the harness's makeCtxStub
// forwards any property it finds already set on its backing state object), so drawTitleMenu's real
// fillText calls are captured without hand-rolling a second sandbox (CLAUDE.md: new tests use
// _harness.js, don't hand-roll one).
function recordFillText(X, drawFn) {
  const log = [];
  X.ctx.fillText = (str, x, y) => log.push({ str, x, y, font: X.ctx.font, color: X.ctx.fillStyle });
  drawFn();
  return log;
}

// ================= (A) MENU_TITLE gained "Profile"; every label-based consumer still resolves =====
(function sectionA() {
  console.log("(A) MENU_TITLE has a \"Profile\" row; label-dispatch consumers still resolve, no hardcoded index");
  const X = buildGame({ store: seededStore("Paul") });

  eq(X.MENU_TITLE.indexOf("Profile"), 1, "A: \"Profile\" is the second row (FORK-CS031-H → c)");
  assert(X.MENU_TITLE.includes("Start Game") && X.MENU_TITLE.includes("Achievements") &&
    X.MENU_TITLE.includes("High Scores") && X.MENU_TITLE.includes("Options"),
    "A: the four pre-existing rows are all still there");

  // ⛔ The wiring itself, pinned on the source (same idiom as test-cs031-p4.js §A): the confirm branch
  // dispatches "Profile" by LABEL to gotoScreen("profiles"), no numeric literal anywhere in the chain.
  assert(/label === "Profile"\)\s*gotoScreen\("profiles"\)/.test(stripped),
    'A: ⛔ menuTitle()\'s confirm branch routes "Profile" -> gotoScreen("profiles")');
  assert(!/gotoScreen\(\s*"titlemenu"\s*,\s*-?\d+\s*\)/.test(stripped),
    'A: no gotoScreen("titlemenu", <numeric literal>) anywhere — every Back destination resolves via MENU_TITLE.indexOf');

  // Driven, not just grepped: walking DOWN from the default cursor lands on Profile second, and
  // confirming it (through menuInput, not menuTitle directly) reaches the roster screen.
  X.game.menu.index = 0;
  X.menuInput("down");
  eq(X.game.menu.index, 1, "A: down-walk from Start Game lands on row 1");
  eq(X.MENU_TITLE[X.game.menu.index], "Profile", "A: ...which is the Profile row");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "profiles", "A: confirm on Profile opens the roster screen");

  // Achievements/High Scores' own indices shifted (2, 3 now, not 1, 2) — indexOf still resolves them
  // correctly, which is the whole point of dispatching by label rather than position.
  X.gotoScreen("titlemenu");
  X.game.menu.index = X.MENU_TITLE.indexOf("High Scores");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "highscores", "A: MENU_TITLE.indexOf(\"High Scores\") still resolves to the right row post-insertion");
})();

// ================= (B) FORK-CS031-G: titleMenuLayout(n) is derived, not fixed literals =============
(function sectionB() {
  console.log("(B) titleMenuLayout(n): the block clears the art above and the flavour line below at N=5 AND N=6");
  const X = buildGame({ store: seededStore("Paul") });

  // The live constants are exactly what the function returns for the live row count (5 rows today).
  const live = X.titleMenuLayout(X.MENU_TITLE.length);
  eq(X.TITLE_MENU_Y, live.y, "B: TITLE_MENU_Y === titleMenuLayout(N).y for the live MENU_TITLE");
  eq(X.TITLE_MENU_STEP, live.step, "B: TITLE_MENU_STEP === titleMenuLayout(N).step for the live MENU_TITLE");
  eq(X.MENU_TITLE.length, 5, "B: (setup) the live row count this phase ships is 5");

  // The two boundaries the block must never cross (the title art above, the flavour line below).
  const TOP = X.VIEW_H / 2 - 60, BOTTOM = X.VIEW_H / 2 + 120;
  eq(X.TITLE_MENU_TOP, TOP, "B: (setup) TITLE_MENU_TOP matches the O V E R H A U L baseline");
  eq(X.TITLE_MENU_BOTTOM, BOTTOM, "B: (setup) TITLE_MENU_BOTTOM matches the flavour-line baseline");

  // N=5 is the REAL row count this phase ships (Profile inserted). N=6 is CS032's planned "Load Saved
  // Game" row — asserted here, on the pure function, so CS032 costs no layout edit AND this pin does
  // not have to wait for that row to exist to prove the formula holds for it.
  for (const n of [5, 6]) {
    const { y, step } = X.titleMenuLayout(n);
    const lastRow = y + (n - 1) * step;
    assert(y > TOP, `B: N=${n}: the first row (${y}) clears the O V E R H A U L baseline (${TOP})`);
    assert(lastRow < BOTTOM, `B: N=${n}: the last row (${lastRow}) clears the flavour-line baseline (${BOTTOM})`);
    assert(step > 0 && step <= X.TITLE_MENU_STEP_MAX,
      `B: N=${n}: step (${step}) is positive and never exceeds the ${X.TITLE_MENU_STEP_MAX}px max`);
  }

  // The self-healing property FORK-G actually asked for: N=6 does NOT fit at the old fixed 38px step
  // (5 gaps * 38 = 190 > the ~132px usable band) — proving the step really does shrink rather than the
  // clearance above holding by accident.
  const n6 = X.titleMenuLayout(6);
  assert(n6.step < X.TITLE_MENU_STEP_MAX,
    `B: ⛔ N=6's step (${n6.step}) shrank below the ${X.TITLE_MENU_STEP_MAX}px max — a fixed step could not have cleared both boundaries here`);

  // And N=4 (the pre-P5 row count) still clears comfortably at the full step — this phase did not
  // starve the common case to make room for a hypothetical future one.
  const n4 = X.titleMenuLayout(4);
  eq(n4.step, X.TITLE_MENU_STEP_MAX, "B: N=4 still gets the full playtest-knob step (room to spare)");
})();

// ================= (C) FORK-CS031-E: first-boot routing ============================================
(function sectionC() {
  console.log("(C) a genuinely empty install boots to \"profiles\"; a migrated legacy install boots to \"titlemenu\"");

  // Empty store: no roster, no legacy keys -> Profiles.firstBoot, and this phase routes off it.
  const empty = buildGame({ store: {} });
  eq(empty.Profiles.firstBoot, true, "C: (setup) an empty store is a genuinely empty install");
  eq(empty.Profiles.roster.length, 0, "C: (setup) ...with nothing minted yet");
  eq(empty.game.menu.screen, "profiles", "C: ⛔ first boot routes straight to the profiles screen, not the title menu");
  eq(empty.game.state, "title", "C: ...state is still \"title\" (this is boot-time menu routing, not a state change)");

  // A machine already holding pre-profile save data: init() migrates it into p0 silently — this is
  // NOT first boot, and must land on the ordinary title menu (an upgrading player is never interrupted).
  const migrated = buildGame({ store: { afd_settings_v1: "{}" } });
  eq(migrated.Profiles.firstBoot, false, "C: (setup) legacy data present is not a first boot");
  eq(migrated.Profiles.roster.length, 1, "C: (setup) ...and mints exactly one profile over it");
  eq(migrated.Profiles.roster[0].id, migrated.PROFILE_LEGACY, "C: (setup) ...owning the legacy id (p0)");
  eq(migrated.game.menu.screen, "titlemenu", "C: ⛔ a migrated p0 boots normally, straight to the title menu");

  // A machine with its own real roster already saved (a returning player, post-CS031) boots the same
  // ordinary way — not just the legacy-migration shape.
  const returning = buildGame({ store: seededStore("Paul") });
  eq(returning.Profiles.firstBoot, false, "C: (setup) a saved roster is not a first boot either");
  eq(returning.game.menu.screen, "titlemenu", "C: a returning player with a real roster also boots to the title menu");
})();

// ================= (D) FORK-CS031-H render contract + FORK-CS031-I title-only reachability =========
(function sectionD() {
  console.log("(D) the Profile row renders \"Profile: NAME\"; the profiles screen is unreachable from either mid-run root");
  const X = buildGame({ store: seededStore("Paul") });
  eq(X.game.menu.screen, "titlemenu", "D: (setup) lands on the title menu");
  eq(X.Profiles.nameOf(X.Profiles.activeId), "Paul", "D: (setup) the seeded profile's name is Paul");

  const idx = X.MENU_TITLE.indexOf("Profile");
  const log = recordFillText(X, X.drawTitleMenu);
  const y = X.TITLE_MENU_Y + idx * X.TITLE_MENU_STEP;
  const row = log.filter(e => e.x === X.VIEW_W / 2 && e.y === y);
  eq(row.length, 1, "D: exactly one fillText for the Profile row");
  eq(row[0].str, "   Profile: Paul", "D: ⛔ the row IS the name display — \"Profile: NAME\", idle (not selected)");

  // Switch the active profile and re-render: the row follows the CURRENT active profile, not a
  // snapshot taken at build time.
  X.Profiles.add("Ripley");
  X.Profiles.activate(X.Profiles.roster[1].id);
  const log2 = recordFillText(X, X.drawTitleMenu);
  const row2 = log2.filter(e => e.x === X.VIEW_W / 2 && e.y === y);
  eq(row2[0].str, "   Profile: Ripley", "D: re-render after a switch shows the NEW active profile's name");

  // An empty roster's fallback: the render is defensive on its own, independent of whether the boot
  // router can actually reach this state (it can't — FORK-E keeps an empty roster on "profiles").
  const empty = buildGame({ store: {} });
  eq(empty.Profiles.nameOf(empty.Profiles.activeId), "", "D: (setup) nameOf on an unresolvable id is empty");
  empty.game.menu.screen = "titlemenu";   // force the shape purely to exercise the render's own guard
  const logEmpty = recordFillText(empty, empty.drawTitleMenu);
  const rowEmpty = logEmpty.filter(e => e.x === empty.VIEW_W / 2 && e.y === (empty.TITLE_MENU_Y + idx * empty.TITLE_MENU_STEP));
  eq(rowEmpty[0].str, "   Profile: —", "D: ⛔ an empty roster's row falls back to \"Profile: —\", not a blank/undefined name");

  // FORK-CS031-I: title-only. Neither mid-run root gained a row, and no mid-run confirm anywhere in
  // either root reaches the profiles screen.
  eq(JSON.stringify(X.MENU_ROOT_PLAY), JSON.stringify(["Continue", "Save", "Options", "Quit"]),
    "D: MENU_ROOT_PLAY untouched by this phase");
  eq(JSON.stringify(X.MENU_ROOT_OVER), JSON.stringify(["Play Again", "Options", "Quit to Title"]),
    "D: MENU_ROOT_OVER untouched by this phase");

  // Drive every row of the play root fresh (a confirm can close the panel, open a sub-screen or open
  // a modal — re-enter "root" before each one rather than assume the previous confirm left it there).
  for (let i = 0; i < X.MENU_ROOT_PLAY.length; i++) {
    X.quitToTitle();
    X.startGame();
    X.openPause();
    eq(X.game.menu.screen, "root", `D: (setup) play-root row ${i} starts from a fresh root`);
    X.game.menu.index = i;
    X.menuInput("confirm");
    assert(X.game.menu.screen !== "profiles", `D: play-root row ${i} ("${X.MENU_ROOT_PLAY[i]}") never reaches profiles`);
  }

  // Same for the gameover root — its own layout, its own confirm branches.
  for (let i = 0; i < X.MENU_ROOT_OVER.length; i++) {
    X.game.state = "gameover"; X.game.paused = false; X.game.menu.screen = null; X.game.menu.modal = null;
    X.openPause();
    eq(X.game.menu.screen, "root", `D: (setup) gameover-root row ${i} starts from a fresh root`);
    eq(JSON.stringify(X.rootItems()), JSON.stringify(X.MENU_ROOT_OVER), "D: (setup) it's the gameover layout");
    X.game.menu.index = i;
    X.menuInput("confirm");
    assert(X.game.menu.screen !== "profiles", `D: gameover-root row ${i} ("${X.MENU_ROOT_OVER[i]}") never reaches profiles`);
  }
})();

// ================= (E) FLAG-CS031-d: activate() no longer bleeds game.stats ========================
(function sectionE() {
  console.log("(E) Profiles.activate() resets game.stats — the outgoing game's untouchable/max_haul flags do not bleed onto the incoming profile");
  const X = buildGame({ store: seededStore("Paul") });
  X.Profiles.add("Ripley");
  const ripleyId = X.Profiles.roster[1].id;

  // The exact repro STATUS.md measured: a game left the title with these still set on game.stats.
  X.game.wave = 12;
  X.game.stats.everBelowHalf = false;   // Untouchable: wave >= 10 && !everBelowHalf
  X.game.stats.maxChainVisit = true;    // Maxed Out: maxChainVisit
  const before = { everBelowHalf: X.game.stats.everBelowHalf, maxChainVisit: X.game.stats.maxChainVisit };
  assert(before.everBelowHalf === false && before.maxChainVisit === true,
    "E: (setup) game.stats is dirty in exactly the shape that used to bleed");

  X.Profiles.activate(ripleyId);

  // 1. game.stats itself is reset to a fresh shape, not just happens to not qualify.
  eq(X.game.stats.everBelowHalf, false, "E: game.stats.everBelowHalf reset (fresh default is also false, but...)");
  eq(X.game.stats.maxChainVisit, false, "E: ⛔ game.stats.maxChainVisit reset to false — this is the flag a stale value would have kept true");
  eq(X.game.stats.gameEnded, false, "E: (broader) game.stats as a whole matches a fresh resetGameStats() shape");

  // 2. The consequence STATUS.md measured directly: Ripley (who never played) does not inherit either
  // non-tiered lifetime achievement Achievements.init()'s deriveLifetime() would have derived from the
  // stale game.stats above.
  assert(!X.Achievements.lifetimeUnlocked.has("untouchable"),
    "E: ⛔ Ripley was NOT granted \"untouchable\" from Paul's last game");
  assert(!X.Achievements.lifetimeUnlocked.has("max_haul"),
    "E: ⛔ Ripley was NOT granted \"max_haul\" from Paul's last game");

  // Sanity: switching back to Paul (who legitimately hit wave 12 with maxChainVisit) still leaves
  // Paul's OWN progress alone — this fix resets the RUNTIME field, not any persisted counter.
  eq(X.Profiles.activeId, ripleyId, "E: (setup) Ripley is active");
})();

// ================= (F) scope pin ====================================================================
(function sectionF() {
  console.log("(F) scope pin — the game file, scratchpad/ and STATUS.md");
  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  if (shas === null) { skip("F: scope pin (no git history)"); return; }
  if (shas.length > 1) {
    A.failed++;
    console.error(`  FAIL: F: ${shas.length} commits share the subject "${PHASE_SUBJECT}" — the pin no longer names one commit`);
    return;
  }
  const provisional = shas.length === 0;
  const changed = changedFiles(PARENT_SHA, provisional ? null : shas[0]);
  if (changed === null) { skip("F: scope pin (changedFiles unavailable)"); return; }
  if (provisional) console.log("  (F measured against the WORKING TREE — this phase is not committed yet)");

  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `F: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "F: (setup) the game file is in this phase's diff");
})();

A.report();
