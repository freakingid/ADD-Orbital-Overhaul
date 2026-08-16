// Headless test for CS034 Phase 6 — resetAchievements(pool) + the generalized typed-confirm field.
//
//   node scratchpad/test-cs034-p6.js
//
// Drives the REAL code: resetAchievements/openNameEntry/nameEntryKey/nameEntryCommit/menuAchievements/
// menuModal/drawMenu. No validator, clear rule or storage key is reimplemented here.
//
// THREE TRAPS THIS FILE EXISTS FOR:
//  1. ⛔ A reset must PERSIST, and Achievements.save() is the only writer — §D re-reads the store with a
//     SECOND build rather than trusting the in-memory object it just cleared.
//  2. ⛔ weekKey/activeIds are calendar-derived, NOT progress: a lifetime reset must leave both, and the
//     weekly reset must leave every lifetime collection (and vice versa). Both directions are checked.
//  3. ⛔ nameEntryError() stays the DEFAULT validator, not a deleted one — §G proves the two shipped
//     callers still get the name rules through the very path a supplied ctx.validate now travels.
//
// Sections: (A) node --check + wiring. (B) lifetime reset. (C) weekly reset. (D) it persisted.
// (E) another profile's blob is byte-unchanged. (F) a supplied validate. (G) the default validate.
// (H) the two stages, driven end to end. (I) render. (J) scope pin.

"use strict";
const { mkAssert, buildGame, scriptSource, execSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — "cs-34 p5: level-end celebration header".
const PARENT_SHA = "6d18ae316129bc5506403ec9e6a9293230408a59";
const PHASE_SUBJECT = "cs-34 p6:";

const A = mkAssert();
const { assert, eq, skip } = A;

const src = scriptSource();
const stripped = execSource(src);

// A build with a two-profile roster made by the game's own add(). The first add mints "p0", which IS
// PROFILE_LEGACY — so the active profile's stores are the bare frozen keys and p1's are suffixed.
function withProfiles(store) {
  const X = buildGame({ store: store || {} });
  X.Profiles.add("PAUL");
  X.Profiles.add("RIPLEY");
  return X;
}
// Believable progress in every collection a reset can touch, so each assertion below is non-vacuous.
function seedProgress(X) {
  const Ach = X.Achievements;
  for (const k in Ach.lifetime) Ach.lifetime[k] = 7;
  Ach.lifetimeUnlocked.add(Ach.LIFETIME.find(a => !a.tiers).id);
  const tiered = Ach.LIFETIME.find(a => a.tiers);
  Ach.lifetimeTiers[tiered.id] = 1;
  Ach.weeklyUnlocked.add(Ach.activeWeekly()[0].id);
  return { tiered };
}
const typeIn = (X, s) => { for (const ch of s) X.nameEntryKey(ch); };
function pressCell(X, label) {
  const i = X.NAME_CELLS.indexOf(label);
  X.game.menu.row = Math.floor(i / X.NAME_GRID_COLS);
  X.game.menu.col = i % X.NAME_GRID_COLS;
  X.menuInput("confirm");
}

// ================= (A) node --check; the confirm/back split and the affordance =================
(function sectionA() {
  console.log("(A) node --check; menuAchievements splits confirm from back; the reset row is rendered");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs034p6_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  // ⚠ FLAG-CS034-a is a SOURCE fact as much as a behavioural one: the two actions used to share a
  // branch, and a merged branch would still pass most of the behaviour below.
  assert(!/a === "confirm" \|\| a === "back"/.test(stripped.slice(
    stripped.indexOf("function menuAchievements"), stripped.indexOf("function openAchReset"))),
    "A: ⚠ menuAchievements() no longer handles confirm and back in ONE shared branch");
  assert(/else if \(a === "confirm"\) openAchReset\(\);/.test(stripped),
    "A: ⚠ ...confirm raises the reset flow");
  assert(/else if \(a === "back"\) gotoScreen\("titlemenu"/.test(stripped),
    "A: ...and back still leaves for the title menu");

  // ⛔ The footer had to move in the same edit — ENTER-to-return was shipped muscle memory.
  const X = buildGame({ store: {} });
  assert(!/ENTER  return|\/ ENTER/.test(X.ACH_HINT),
    `A: ⛔ ACH_HINT no longer promises ENTER returns (got "${X.ACH_HINT}")`);
  assert(/reset/i.test(X.ACH_HINT), "A: ⛔ ...and it names what ENTER does instead");
  assert(/◄►/.test(X.ACH_HINT) && /switch tab/.test(X.ACH_HINT),
    "A: ...while keeping the tab control it already advertised");

  // ⛔ resetAchievements() is reachable only from a title-only screen — that is what satisfies
  // Achievements.save()'s debugRun/resumedRun gate STRUCTURALLY (spec §5.2). Pinned as a source fact:
  // openAchReset() is its one caller, and menuAchievements() is openAchReset()'s.
  const mentions = stripped.split("resetAchievements(").length - 1;
  eq(mentions, 2, "A: ⛔ resetAchievements appears exactly twice in live code — its declaration and ONE call");
  assert(/function resetAchievements\(pool\)/.test(stripped), "A: ...one of which is the declaration");
  assert(/onCommit: \(\) => resetAchievements\(pool\)/.test(stripped),
    "A: ⛔ ...and the only call site is the typed-confirm screen's onCommit, i.e. behind BOTH stages");
  // ⛔ save()'s own gate is NOT relaxed.
  assert(/save\(\) \{\s*if \(game\.debugRun \|\| game\.resumedRun\) return;/.test(stripped),
    "A: ⛔ Achievements.save()'s debugRun/resumedRun gate is untouched");
})();

// ================= (B) ⛔ resetAchievements("lifetime") ==========================================
(function sectionB() {
  console.log("(B) ⛔ lifetime: every counter to 0, both lifetime collections emptied, weekly + calendar intact");
  const X = withProfiles();
  const Ach = X.Achievements;
  const { tiered } = seedProgress(X);
  const weekKey = Ach.weekKey, activeIds = Ach.activeIds.slice();
  const weeklyId = Ach.activeWeekly()[0].id;

  // (setup) every collection genuinely holds something.
  assert(Object.keys(Ach.lifetime).length > 0, "B: (setup) there are lifetime counters at all");
  assert(Object.values(Ach.lifetime).every(v => v === 7), "B: (setup) every counter is non-zero");
  assert(Ach.lifetimeUnlocked.size > 0 && Object.keys(Ach.lifetimeTiers).length > 0,
    "B: (setup) both lifetime collections are non-empty");
  assert(Ach.weeklyUnlocked.size > 0, "B: (setup) ...and so is weeklyUnlocked");

  X.resetAchievements("lifetime");

  eq(Object.values(Ach.lifetime).filter(v => v !== 0).length, 0,
    "B: ⛔ EVERY lifetime counter is 0 — walked, not sampled");
  eq(Ach.lifetimeUnlocked.size, 0, "B: ⛔ lifetimeUnlocked is emptied");
  eq(Object.keys(Ach.lifetimeTiers).length, 0, "B: ⛔ lifetimeTiers is emptied");
  eq(Ach.tierIndex(tiered), -1, "B: ...so the seeded tiered row reads as pre-bronze through the real helper");

  // ⛔ NOT reset: the weekly pool, and the calendar state that picks it.
  eq(Ach.weeklyUnlocked.size, 1, "B: ⛔ weeklyUnlocked is UNTOUCHED by a lifetime reset");
  assert(Ach.weeklyUnlocked.has(weeklyId), "B: ...the same id, not a coincidentally-sized set");
  eq(Ach.weekKey, weekKey, "B: ⛔ weekKey is NOT reset — it is calendar-derived, not progress");
  eq(Ach.activeIds.join(","), activeIds.join(","), "B: ⛔ ...nor activeIds: this week's same five challenges");
  eq(Ach.activeWeekly().length, activeIds.length, "B: ...and the viewer's weekly tab still resolves them");

  // An unknown pool changes nothing at all.
  const Y = withProfiles();
  seedProgress(Y);
  Y.resetAchievements("everything");
  assert(Object.values(Y.Achievements.lifetime).every(v => v === 7) && Y.Achievements.weeklyUnlocked.size === 1,
    "B: an unknown pool name is inert — it clears nothing");
})();

// ================= (C) ⛔ resetAchievements("weekly") ============================================
(function sectionC() {
  console.log("(C) ⛔ weekly: weeklyUnlocked emptied, every lifetime collection intact");
  const X = withProfiles();
  const Ach = X.Achievements;
  const { tiered } = seedProgress(X);
  const weekKey = Ach.weekKey, activeIds = Ach.activeIds.slice();
  const unlockedId = [...Ach.lifetimeUnlocked][0];

  X.resetAchievements("weekly");

  eq(Ach.weeklyUnlocked.size, 0, "C: ⛔ weeklyUnlocked is emptied");
  assert(Object.values(Ach.lifetime).every(v => v === 7),
    "C: ⛔ every lifetime counter is UNTOUCHED by a weekly reset");
  eq(Ach.lifetimeUnlocked.size, 1, "C: ⛔ lifetimeUnlocked is untouched");
  assert(Ach.lifetimeUnlocked.has(unlockedId), "C: ...the same id");
  eq(Ach.lifetimeTiers[tiered.id], 1, "C: ⛔ lifetimeTiers keeps its tier index");
  eq(Ach.tierIndex(tiered), 1, "C: ...read back through the real helper");
  eq(Ach.weekKey, weekKey, "C: ⛔ weekKey is not reset — the SAME five challenges come back, locked");
  eq(Ach.activeIds.join(","), activeIds.join(","), "C: ⛔ ...nor activeIds");
})();

// ================= (D) ⛔ it actually PERSISTED ==================================================
(function sectionD() {
  console.log("(D) ⛔ a FRESH build over the same store reads back the cleared state");
  const store = {};
  const X = withProfiles(store);
  seedProgress(X);
  X.Achievements.save();
  const key = X.Profiles.keyFor(X.Achievements.STORAGE_KEY);
  eq(key, "afd_achievements_v2", "D: (setup) the active profile is the legacy one, so its key is the bare frozen name");
  const before = store[key];
  assert(typeof before === "string" && /"delivered":7/.test(before), "D: (setup) the seeded progress really is in the store");

  X.resetAchievements("lifetime");
  assert(store[key] !== before, "D: ⛔ the reset WROTE — the stored blob moved");

  // ⛔ The real read-back: a second build boots off this same store from scratch.
  const Z = buildGame({ store });
  eq(Z.Profiles.activeId, X.Profiles.activeId, "D: (setup) the fresh build boots on the same profile");
  eq(Object.values(Z.Achievements.lifetime).filter(v => v !== 0).length, 0,
    "D: ⛔ ...and reads back every lifetime counter at 0");
  eq(Z.Achievements.lifetimeUnlocked.size, 0, "D: ⛔ ...lifetimeUnlocked empty");
  eq(Object.keys(Z.Achievements.lifetimeTiers).length, 0,
    "D: ⛔ ...lifetimeTiers empty — deriveLifetime() had nothing left to re-derive from");
  eq(Z.Achievements.weeklyUnlocked.size, 1, "D: ⛔ ...and the weekly unlock survived the round trip");

  // The weekly direction persists the same way.
  Z.resetAchievements("weekly");
  const W = buildGame({ store });
  eq(W.Achievements.weeklyUnlocked.size, 0, "D: ⛔ a weekly reset also reads back cleared from a fresh build");
})();

// ================= (E) ⛔ other profiles' stores are untouched ===================================
(function sectionE() {
  console.log("(E) ⛔ a non-active profile's stored blob is BYTE-unchanged across a reset");
  const store = {};
  const X = withProfiles(store);

  // Give p1 real, saved progress through the game's own switch + save path.
  assert(X.Profiles.activate("p1"), "E: (setup) switched to the second profile");
  seedProgress(X);
  X.Achievements.save();
  const otherKey = X.Profiles.keyFor(X.Achievements.STORAGE_KEY);
  eq(otherKey, "afd_achievements_v2:p1", "E: (setup) a non-legacy profile writes a SUFFIXED key");
  const otherBlob = store[otherKey];
  assert(typeof otherBlob === "string" && otherBlob.length > 0, "E: (setup) p1's blob is on disk");

  // Back to p0, give it its own progress, and reset THAT.
  assert(X.Profiles.activate("p0"), "E: (setup) switched back to the legacy profile");
  seedProgress(X);
  X.Achievements.save();
  const ownBefore = store["afd_achievements_v2"];
  X.resetAchievements("lifetime");

  eq(store[otherKey], otherBlob, "E: ⛔ p1's blob is byte-identical after p0's reset");
  assert(store["afd_achievements_v2"] !== ownBefore, "E: (non-vacuous) ...while p0's own blob DID change");
  X.resetAchievements("weekly");
  eq(store[otherKey], otherBlob, "E: ⛔ ...and after a weekly reset too");

  // ⛔ The store is never enumerated, and no sixth key appears (the standing CS031 rule).
  const keys = Object.keys(store).sort();
  assert(keys.every(k => /^afd_(settings_v1|achievements_v2|profiles_v1|scores_v1|saves_v1)(:p\d+)?$/.test(k)),
    `E: ⛔ this phase added no localStorage key (store holds: ${keys.join(", ")})`);
  // And p1's own progress is genuinely still readable, not merely a string nobody parses.
  X.Profiles.activate("p1");
  assert(Object.values(X.Achievements.lifetime).every(v => v === 7),
    "E: ⛔ ...switching back to p1 finds its lifetime progress intact");
})();

// ================= (F) ⛔ a supplied ctx.validate ================================================
(function sectionF() {
  console.log("(F) ⛔ ctx.validate drives BOTH the live path and the commit path");
  const openReset = (X, onDone) => X.openNameEntry({
    mode: "confirm", back: "achievements", title: X.ACH_RESET_TITLE,
    validate: buf => (String(buf == null ? "" : buf).trim().toLowerCase() === X.ACH_RESET_WORD ? "" : X.ACH_RESET_ERR),
    onCommit: onDone
  });

  // --- rejected: empty, a wrong word, whitespace-only ---
  for (const bad of ["", "NOPE", "  "]) {
    const X = withProfiles();
    let fired = 0;
    openReset(X, () => { fired++; });
    typeIn(X, bad);
    if (bad.length) eq(X.game.menu.nameErr, X.ACH_RESET_ERR, `F: ⛔ "${bad}" reports LIVE with the supplied message`);
    pressCell(X, X.NAME_CELL_DONE);
    eq(fired, 0, `F: ⛔ DONE on "${bad}" commits nothing`);
    eq(X.game.menu.screen, "nameentry", `F: ...and the screen stays up so the player can fix it`);
    eq(X.game.menu.nameErr, X.ACH_RESET_ERR, `F: ...with the message raised at commit time`);
  }

  // --- accepted: the word, in any case, with any surrounding space ---
  for (const good of ["reset", "RESET", "  Reset  "]) {
    const X = withProfiles();
    let fired = 0;
    openReset(X, () => { fired++; });
    typeIn(X, good);
    eq(X.game.menu.nameBuf, good, `F: (setup) the buffer holds "${good}" verbatim — case and spaces preserved`);
    eq(X.game.menu.nameErr, "", `F: ⛔ "${good}" is CLEAN — trimmed and case-insensitive`);
    pressCell(X, X.NAME_CELL_DONE);
    eq(fired, 1, `F: ⛔ ...and DONE on it fires onCommit exactly once`);
    eq(X.game.menu.screen, "achievements", "F: ...leaving for ctx.back, not the title menu default");
    eq(X.game.menu.nameCtx, null, "F: ...with the context torn down BEFORE the closure ran");
  }

  // ⛔ THE COMMIT PATH RE-VALIDATES rather than trusting nameErr — the supplied validator gets the same
  // treatment the default one has always had, which matters because nameBuf can be set from outside.
  const S = withProfiles();
  let leaked = 0;
  openReset(S, () => { leaked++; });
  S.game.menu.nameBuf = "restart";   // set behind the live path's back, exactly as a prefill does
  S.game.menu.nameErr = "";
  pressCell(S, S.NAME_CELL_DONE);
  eq(leaked, 0, "F: ⛔ commit RE-VALIDATES through ctx.validate — a clean-looking nameErr is not the gate");
  eq(S.game.menu.nameErr, S.ACH_RESET_ERR, "F: ...and the supplied message is raised at commit time");

  // The pad's route to the same word: every character comes off the shared NAME_CELLS grid.
  const P = withProfiles();
  let padFired = 0;
  openReset(P, () => { padFired++; });
  for (const ch of "RESET") pressCell(P, ch);
  eq(P.game.menu.nameBuf, "RESET", "F: ⛔ a GAMEPAD can type the word — every letter is a real NAME_CELLS cell");
  pressCell(P, P.NAME_CELL_DONE);
  eq(padFired, 1, "F: ⛔ ...and commits it, which is why this screen was generalized rather than duplicated");

  // The panel heading is the supplied one.
  const T = withProfiles();
  openReset(T, () => {});
  eq(T.game.menu.nameCtx.title, "TYPE RESET TO CONFIRM", "F: ctx.title carries the reset flow's heading");
})();

// ================= (G) ⛔ NO validate -> the shipped name rules, unregressed ====================
(function sectionG() {
  console.log("(G) ⛔ with no ctx.validate the two existing callers still get nameEntryError()'s rules");
  // ⛔ nameEntryError() is not deleted and not inlined — it IS the default.
  assert(/function nameEntryError\(buf, ctx\)/.test(stripped), "G: ⛔ nameEntryError() still exists");
  assert(/typeof v === "function" \? v\(buf\) : nameEntryError\(buf, ctx\)/.test(stripped),
    "G: ⛔ ...and is the fallback inside the ONE resolver both paths call");
  const X0 = buildGame({ store: {} });
  eq(X0.nameEntryValidate("", { mode: "add" }), X0.NAME_ERR_EMPTY,
    "G: nameEntryValidate() with no ctx.validate returns nameEntryError()'s own answer");

  // --- empty ---
  const E = withProfiles();
  let committed = null;
  E.openNameEntry({ mode: "add", back: "profiles", onCommit: n => { committed = n; } });
  pressCell(E, E.NAME_CELL_DONE);
  eq(E.game.menu.nameErr, E.NAME_ERR_EMPTY, "G: ⛔ an empty buffer still reports the shipped empty-name message");
  eq(committed, null, "G: ...and commits nothing");

  // --- too long: the cap DROPS keystrokes, so the length rule is driven through the validator directly ---
  const L = withProfiles();
  L.openNameEntry({ mode: "add", back: "profiles", onCommit: () => {} });
  const over = "X".repeat(L.PROFILE_NAME_MAX + 3);
  eq(L.nameEntryValidate(over, L.game.menu.nameCtx), L.NAME_ERR_LONG,
    "G: ⛔ an over-long name still resolves to the shipped too-long message");
  typeIn(L, over);
  eq(L.game.menu.nameBuf.length, L.PROFILE_NAME_MAX, "G: ...and the field's own cap is unmoved at PROFILE_NAME_MAX");

  // --- taken, trimmed + case-insensitive, with rename's exemption intact ---
  const C = withProfiles();
  let took = null;
  C.openNameEntry({ mode: "add", back: "profiles", onCommit: n => { took = n; } });
  typeIn(C, "  paul ");
  eq(C.game.menu.nameErr, C.NAME_ERR_TAKEN, "G: ⛔ a collision still reports, trimmed AND case-insensitively");
  pressCell(C, C.NAME_CELL_DONE);
  eq(took, null, "G: ...and DONE on it commits nothing");

  const R = withProfiles();
  let renamed = null;
  R.openNameEntry({ mode: "rename", id: "p0", back: "profiles", onCommit: n => { renamed = n; } }, "PAUL");
  eq(R.game.menu.nameErr, "", "G: ⛔ rename mode still excludes the profile being renamed");
  pressCell(R, R.NAME_CELL_DONE);
  eq(renamed, "PAUL", "G: ...and commits the trimmed string to the caller's closure");
  eq(R.game.menu.screen, "profiles", "G: ...returning to ctx.back exactly as before");

  // ⛔ And the heading both callers see is unchanged — no ctx.title means the mode's own title.
  const AddX = withProfiles();
  AddX.openNameEntry({ mode: "add", back: "profiles", onCommit: () => {} });
  assert(!AddX.game.menu.nameCtx.title, "G: ⛔ the add caller passes no title...");
  const RenX = withProfiles();
  RenX.openNameEntry({ mode: "rename", id: "p0", back: "profiles", onCommit: () => {} }, "PAUL");
  assert(!RenX.game.menu.nameCtx.title, "G: ⛔ ...and neither does the rename caller");
  // ...so both still render their own shipped heading, read off the real source's fallback.
  assert(/m\.nameCtx\.title\) \|\| \(mode === "rename" \? NAME_TITLE_RENAME : NAME_TITLE_ADD\)/.test(stripped),
    "G: ⛔ ...and drawNameEntry falls back to the mode's own NAME_TITLE_* when ctx.title is absent");
})();

// ================= (H) ⛔ the two stages, driven end to end =====================================
(function sectionH() {
  console.log("(H) ⛔ viewer confirm -> modal (CANCEL default) -> typed field -> the pool actually resets");
  for (const [tabId, word] of [["weekly", "WEEKLY"], ["lifetime", "LIFETIME"]]) {
    const X = withProfiles();
    seedProgress(X);
    X.gotoScreen("achievements", 0);
    while (X.achActiveTab().id !== tabId) X.menuInput("right");
    eq(X.achActiveTab().id, tabId, `H: [${tabId}] (setup) on the ${tabId} tab`);

    // --- stage 1 ---
    X.menuInput("confirm");
    assert(!!X.game.menu.modal, `H: [${tabId}] ⛔ confirm opens the modal instead of leaving`);
    eq(X.game.menu.screen, "achievements", `H: [${tabId}] ...on the same screen`);
    eq(X.game.menu.modal.index, 1, `H: [${tabId}] ⛔ CANCEL is the default row — the safety property, untouched`);
    eq(X.game.menu.modal.confirmLabel, "RESET", `H: [${tabId}] the confirm row reads RESET`);
    assert(X.game.menu.modal.text.includes(word),
      `H: [${tabId}] ⛔ the prompt names the POOL (looking for "${word}" in "${X.game.menu.modal.text}")`);
    assert(X.game.menu.modal.text.includes("PAUL"),
      `H: [${tabId}] ⛔ ...and the PROFILE, because a reset is per-profile`);
    assert(/cannot be undone/i.test(X.game.menu.modal.text), `H: [${tabId}] ...and says so`);

    // ENTER straight through cancels, and changes nothing — that is what index 1 buys.
    X.menuInput("confirm");
    eq(X.game.menu.modal, null, `H: [${tabId}] ⛔ ENTER on the default row CANCELS`);
    eq(X.game.menu.screen, "achievements", `H: [${tabId}] ...staying on the viewer`);
    assert(Object.values(X.Achievements.lifetime).every(v => v === 7) && X.Achievements.weeklyUnlocked.size === 1,
      `H: [${tabId}] ⛔ ...with nothing reset`);

    // --- stage 2 ---
    X.menuInput("confirm");         // re-open
    X.menuInput("up");              // move onto RESET
    eq(X.game.menu.modal.index, 0, `H: [${tabId}] (setup) cursor moved to RESET deliberately`);
    X.menuInput("confirm");
    eq(X.game.menu.screen, "nameentry", `H: [${tabId}] ⛔ confirming raises the TYPED field, not the reset`);
    eq(X.game.menu.nameCtx.title, X.ACH_RESET_TITLE, `H: [${tabId}] ...under its own heading`);
    assert(Object.values(X.Achievements.lifetime).every(v => v === 7) && X.Achievements.weeklyUnlocked.size === 1,
      `H: [${tabId}] ⛔ ...and STILL nothing is reset — one stage is not enough`);

    // Backing out of stage 2 returns to the viewer, unreset.
    X.menuInput("back");
    eq(X.game.menu.screen, "achievements", `H: [${tabId}] ⛔ back on an empty typed field returns to the viewer`);
    assert(Object.values(X.Achievements.lifetime).every(v => v === 7), `H: [${tabId}] ...still unreset`);

    // The whole way through.
    while (X.achActiveTab().id !== tabId) X.menuInput("right");
    X.menuInput("confirm"); X.menuInput("up"); X.menuInput("confirm");
    for (const ch of "RESET") pressCell(X, ch);
    pressCell(X, X.NAME_CELL_DONE);
    eq(X.game.menu.screen, "achievements", `H: [${tabId}] committing lands back on the viewer`);
    if (tabId === "lifetime") {
      eq(Object.values(X.Achievements.lifetime).filter(v => v !== 0).length, 0,
        "H: [lifetime] ⛔ the lifetime counters are cleared");
      eq(X.Achievements.weeklyUnlocked.size, 1, "H: [lifetime] ⛔ ...and the weekly pool is not");
    } else {
      eq(X.Achievements.weeklyUnlocked.size, 0, "H: [weekly] ⛔ the weekly pool is cleared");
      assert(Object.values(X.Achievements.lifetime).every(v => v === 7),
        "H: [weekly] ⛔ ...and the lifetime counters are not");
    }
  }

  // ⛔ Both input paths gate the same way: the pad reaches all of the above through menuInput too, and
  // `back` on the viewer still leaves without going anywhere near a reset.
  const B = withProfiles();
  seedProgress(B);
  B.gotoScreen("achievements", 0);
  B.menuInput("back");
  eq(B.game.menu.screen, "titlemenu", "H: back on the viewer still exits to the title menu");
  assert(Object.values(B.Achievements.lifetime).every(v => v === 7), "H: ...resetting nothing on the way out");
})();

// ================= (I) render ===================================================================
(function sectionI() {
  console.log("(I) the reset row is labelled off the ACTIVE tab, drawn below the rows, above the footer");
  const X = withProfiles();
  X.gotoScreen("achievements", 0);
  eq(X.achActiveTab().id, "weekly", "I: (setup) entry is always the Weekly tab");
  eq(X.achResetLabel(), "ENTER  Reset Weekly Achievements", "I: ⛔ the Weekly tab's label");
  X.menuInput("right");
  eq(X.achResetLabel(), "ENTER  Reset Lifetime Achievements", "I: ⛔ ...and the Lifetime tab's");
  X.ACH_TABS.forEach(t => assert(typeof t.resetWord === "string" && t.resetWord.length > 0,
    `I: every ACH_TABS entry carries its own resetWord ("${t.id}")`));

  // Geometry: the row sits between the clipped row region and the footer, all three distinct.
  assert(X.ACH_ROW_CLIP_BOTTOM - X.ACH_PANEL_Y < X.ACH_RESET_Y,
    "I: ⛔ the reset row is BELOW the clipped row region — it can never be scrolled over");
  assert(X.ACH_RESET_Y < 644, "I: ...and above the footer");
  eq(X.ACH_ROW_VISIBLE_H, X.ACH_ROW_CLIP_BOTTOM - X.ACH_ROW_CLIP_TOP,
    "I: ACH_ROW_VISIBLE_H is still derived from the pair, not a literal");
  // ⛔ The band the row took came out of the row region, and the Weekly tab must still not scroll.
  X.game.menu.achTab = "weekly";
  eq(X.achMaxScroll(), 0, "I: ⛔ the Weekly tab's five rows still fit outright (ceiling 0) after the clip shrank");
  X.game.menu.achTab = "lifetime";
  assert(X.achMaxScroll() > 0, "I: ...and the Lifetime tab still scrolls");

  // Headless render, on both tabs and with a modal / the typed field up.
  let threw = null;
  try {
    for (const id of ["weekly", "lifetime"]) {
      X.game.menu.achTab = id;
      X.drawMenu();
    }
    X.gotoScreen("achievements", 0);
    X.menuInput("confirm"); X.drawMenu();     // stage 1 over the viewer
    X.menuInput("up"); X.menuInput("confirm"); X.drawMenu();   // stage 2
    for (const ch of "NOPE") X.nameEntryKey(ch);
    X.drawMenu();                              // ...with the inline error showing
  } catch (e) { threw = e; }
  eq(threw, null, "I: drawMenu() renders every step of the flow headlessly" + (threw ? ": " + threw.message : ""));
  eq(X.game.menu.nameErr, X.ACH_RESET_ERR, "I: (setup) an inline error really was on screen");
  eq(X.AudioSys.ctx, null, "I: ⛔ all of the above ran with no AudioContext — headless-safe throughout");
})();

// ================= (J) scope pin ================================================================
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
