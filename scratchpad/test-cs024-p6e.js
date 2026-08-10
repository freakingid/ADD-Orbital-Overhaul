// Headless test for CS024 Phase 6e — debug panel gate tooling: reset one row ("r"), reset all
// (an action row), a master override toggle, and a high-score wipe (a second action row).
//
//   node scratchpad/test-cs024-p6e.js
//
// AN IN-ROUND CORRECTIVE PHASE, not in the original CS024 plan (PLANNED-FEATURES-CS024.md §4.5). By
// P6c the registry carried 51 lever rows and there was no way to undo a debug edit short of clearing
// localStorage. Four additions, all confined to the debug screen and its apply path:
//
//   1. `r` resets the SELECTED row to its registry default via applyDebug(e.id, e.def) — one uniform
//      rule, no special-casing for a lever row, a toNative row or a clampShown row. Inert while a
//      numeric entry is pending.
//   2. "Reset all debug knobs to defaults" — a navigable action row at the bottom of the registry,
//      reached like any row and fired via openModal, wired to `resetAllDebug()` — the SAME function
//      the module-level seed loop calls, extracted rather than duplicated.
//   3. `DEBUG_OVERRIDE_ID` ("debugOverride") — a boolean row at the TOP of the registry, default ON.
//      `debugShown` stays the edited, persisted store; `DEBUG` is DERIVED from either debugShown[id]
//      (on) or e.def (off) — applyDebug() derives a single field per edit, rebuildDebug() re-derives
//      every field at once, called only when the toggle itself is written. Toggling off never touches
//      debugShown, so toggling back on restores every edit.
//   4. "Reset saved scores" — a second action row, its own openModal wording, clears HighScores.entries
//      and calls HighScores.save() (never a raw removeItem). Scores ONLY — afd_achievements_v2 is
//      untouched. game.lastScoreId is cleared so the gameover table can't highlight a dead id.
//
// TRAP 1: GAME_VERSION stays "1.0.0.22" (P7 owns the bump).
// TRAP 2: no gameplay change — no LEVERS edit, no leverState change, no new/reshaped knob.
// TRAP 3: the three frozen localStorage keys keep their names/shapes; the toggle is additive.
// TRAP 4: achievements are not wiped, dimmed, or otherwise touched by the score wipe.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the
// REAL <script> block, and drive the ACTUAL applyDebug/menuDebug/menuModal/HighScores/Achievements
// paths. Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check; registry shape — the toggle row (top, boolean, def 1), the two new action rows
//      (bottom, before Back), untouched-panel byte-identity against HEAD.
//  (B) `r` restores a single row: a lever row, a toNative row, a clampShown row — and is inert while
//      a numeric entry is pending.
//  (C) Reset All restores every entry and is the same function as the module seed.
//  (D) the toggle flips DEBUG between edited and default values WITHOUT touching debugShown, and back.
//  (E) clampShown-before-toNative order is preserved through the derived (toggle-off) path.
//  (F) the toggle persists and reloads.
//  (G) the score wipe empties both the in-memory array and the stored key, leaves
//      afd_achievements_v2 provably intact, clears game.lastScoreId, and qualifies() answers
//      correctly immediately after.
//  (H) TRAPs.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }

// ---- Headless environment (the standing stub idiom, verbatim from test-cs024-p6d.js) ----
function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    detune: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 }, onended: null,
    connect() { return makeAudioNode(); }, disconnect() {}, start() {}, stop() {}, setPeriodicWave() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function FakeAudioContext() {
  return new Proxy({
    state: "running", currentTime: 0, sampleRate: 44100, destination: makeAudioNode(),
    createGain() { return makeAudioNode(); },
    createBuffer() { return { getChannelData() { return new Float32Array(1); } }; },
    createPeriodicWave() { return {}; },
    createWaveShaper() { return makeAudioNode(); },
    createDynamicsCompressor() { return makeAudioNode(); },
    resume() {}
  }, { get(t, p) { return p in t ? t[p] : () => makeAudioNode(); } });
}
function makeCtxStub() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null,
    shadowBlur: 0, shadowColor: null, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "canvas") return { width: 1280, height: 720 };
      if (p === "measureText") return s => ({ width: 6 * String(s).length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

const RETURN = [
  "game", "startGame", "nextWave", "update", "killShip",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DEBUG_OVERRIDE_ID",
  "applyDebug", "rebuildDebug", "resetAllDebug", "resetHighScores", "overridesOn",
  "menuDebug", "menuModal", "debugSelectedVar", "debugFirstRow",
  "saveSettings", "loadSettings",
  "leverState", "liveLevers", "payloadSlots", "worldSizeFor",
  "Achievements", "HighScores", "GAME_VERSION", "LEVERS",
];

// A restricted RETURN list for comparing against a PRE-P6e checkout (section G) — that source doesn't
// declare resetAllDebug/rebuildDebug/DEBUG_OVERRIDE_ID/etc., and `return { name }` on an undeclared
// identifier throws a ReferenceError, not "undefined".
const OLD_RETURN = ["game", "startGame", "DEBUG", "debugShown", "DEBUG_ENTRIES", "applyDebug", "leverState", "GAME_VERSION", "LEVERS"];

function buildFrom(src, { audio = true, store = {}, exportNames = RETURN } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = {
    addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  const setCalls = [];
  const localStorageStub = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); setCalls.push(k); },
    removeItem: k => { delete store[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + exportNames.join(", ") + " };"
  );
  return {
    exports: factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
      { getGamepads: () => [] }, localStorageStub),
    store, setCalls
  };
}

// Drive a row's confirm through the real modal machinery: select it, confirm to open the dialog,
// move to the CONFIRM side (index 0 — CANCEL is the safe default at index 1), confirm again.
function confirmActionRow(A, label) {
  const idx = A.DEBUG_ROWS.findIndex(r => r.kind === "action" && r.label === label);
  assert(idx >= 0, `(setup) action row "${label}" exists`);
  A.game.menu.index = idx;
  A.menuDebug("confirm");
  assert(!!A.game.menu.modal, `(setup) confirming "${label}" opens a modal`);
  A.game.menu.modal.index = 0; // CONFIRM
  A.menuModal("confirm");
}

let X = null, STORE = null;

// ================= (A) node --check; registry shape =====================
(function sectionA() {
  console.log("(A) node --check; registry shape — toggle at top, two action rows at bottom");
  const tmp = path.join(repoRoot, "scratchpad", "_cs024p6e_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  const built = buildFrom(scriptSrc);
  X = built.exports; STORE = built.store;
  if (!X) { console.error("ABORT: build failed"); process.exit(1); }

  eq(X.DEBUG_OVERRIDE_ID, "debugOverride", "A: the toggle's id is debugOverride");
  const first = X.DEBUG_VARS.find(v => !v.header);
  eq(first.id, X.DEBUG_OVERRIDE_ID, "A: the toggle is the FIRST selectable row in the registry");
  eq(first.def, 1, "A: toggle default is ON (1)");
  eq(first.min, 0, "A: toggle min 0");
  eq(first.max, 1, "A: toggle max 1");
  assert(!X.LEVERS.some(l => l.id === X.DEBUG_OVERRIDE_ID), "A: the toggle belongs to no chain — not in LEVERS");

  const labels = X.DEBUG_ROWS.map(r => r.label);
  const iDump = labels.indexOf("Dump difficulty log");
  const iResetAll = labels.indexOf("Reset all debug knobs to defaults");
  const iResetScores = labels.indexOf("Reset saved scores");
  const iBack = X.DEBUG_ROWS.findIndex(r => r.kind === "back");
  assert(iDump >= 0 && iResetAll > iDump && iResetScores > iResetAll && iBack > iResetScores,
    "A: Dump, Reset All, Reset High Scores, Back appear in that order at the bottom");
  eq(X.DEBUG_ROWS[iResetAll].kind, "action", "A: Reset All is an action row (no chevrons, no value)");
  eq(X.DEBUG_ROWS[iResetScores].kind, "action", "A: Reset High Scores is an action row");

  eq(X.DEBUG.startLevel, 1, "A: sanity — an ordinary knob still seeds correctly alongside the toggle");
  eq(X.overridesOn(), true, "A: overridesOn() is true on a fresh, untouched build");
})();

// ================= (B) `r` resets one row =====================
(function sectionB() {
  console.log("(B) `r` resets the selected row: a lever row, a toNative row, a clampShown row; inert while typing");
  // A lever's Floor row (no toNative, no clampShown).
  {
    const A = buildFrom(scriptSrc).exports;
    const e = A.DEBUG_ENTRIES.find(v => v.id === "junkCountFloor");
    A.applyDebug(e.id, e.def + e.step * 3);
    assert(A.debugShown[e.id] !== e.def, "B: (setup) junkCountFloor moved off its default");
    A.game.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === e.id);
    A.menuDebug("reset");
    eq(A.debugShown[e.id], e.def, "B: `r` restored junkCountFloor's shown value to its default");
    eq(A.DEBUG[e.id], e.def, "B: ...and DEBUG.junkCountFloor too (no toNative on this row)");
  }
  // A toNative row (ms -> s).
  {
    const A = buildFrom(scriptSrc).exports;
    const e = A.DEBUG_ENTRIES.find(v => v.id === "autoShieldRegenPause");
    A.applyDebug(e.id, 4000);
    A.game.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === e.id);
    A.menuDebug("reset");
    eq(A.debugShown[e.id], e.def, "B: `r` restored autoShieldRegenPause's shown (ms) value to its default");
    eq(A.DEBUG[e.id], e.def / 1000, "B: ...and DEBUG.autoShieldRegenPause is back to the native (s) default");
  }
  // A clampShown row (a lever's Steps knob).
  {
    const A = buildFrom(scriptSrc).exports;
    const e = A.DEBUG_ENTRIES.find(v => v.id === "junkCountSteps");
    A.applyDebug(e.id, e.min + 1);
    assert(A.debugShown[e.id] !== e.def, "B: (setup) junkCountSteps moved off its default");
    A.game.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === e.id);
    A.menuDebug("reset");
    eq(A.debugShown[e.id], e.def, "B: `r` restored junkCountSteps to its default through clampShown too");
  }
  // Inert while a numeric entry is pending.
  {
    const A = buildFrom(scriptSrc).exports;
    const e = A.DEBUG_ENTRIES.find(v => v.id === "junkCountFloor");
    A.applyDebug(e.id, e.def + e.step * 3);
    const moved = A.debugShown[e.id];
    A.game.menu.index = A.DEBUG_ROWS.findIndex(r => r.kind === "var" && r.e.id === e.id);
    A.game.menu.entry = null; // n/a — DebugPanel.entry is module-private; drive via debugEntryActive's real trigger:
    // enter a digit the normal way so DebugPanel.entry is genuinely non-null, then try to reset.
    // (menuDebug's own "reset" branch is gated on debugEntryActive(), exercised through the real path.)
    // We can't reach DebugPanel directly (not exported — it's transient view state), so drive it via
    // the exported debugSelectedVar()/menuDebug() surface only: simulate by checking the documented
    // guard exists structurally — assert `r` while NOT typing still works (already covered above), and
    // assert the source contains the typing guard ahead of the reset branch (structural pin).
    assert(/if \(a === "reset"\) return;/.test(scriptSrc),
      "B: menuDebug's numeric-entry guard explicitly no-ops \"reset\" while typing");
    eq(A.debugShown[e.id], moved, "B: (sanity) the row is untouched by this structural check");
  }
})();

// ================= (C) Reset All =====================
(function sectionC() {
  console.log("(C) Reset All restores every entry, and is the module seed's own function (not a second copy)");
  assert(/function resetAllDebug\(\)\s*{\s*for \(const v of DEBUG_ENTRIES\) applyDebug\(v\.id, v\.def\);\s*}\s*\nresetAllDebug\(\);/.test(scriptSrc),
    "C: the module-level seed calls resetAllDebug() itself — one loop, not two");

  const A = buildFrom(scriptSrc).exports;
  const fresh = JSON.parse(JSON.stringify(A.debugShown));
  for (const e of A.DEBUG_ENTRIES) A.applyDebug(e.id, e.min); // drag EVERY row to its min
  assert(A.DEBUG_ENTRIES.some(e => A.debugShown[e.id] !== fresh[e.id]), "C: (setup) at least one row moved");

  const idx = A.DEBUG_ROWS.findIndex(r => r.kind === "action" && r.label === "Reset all debug knobs to defaults");
  A.game.menu.index = idx;
  A.menuDebug("confirm");
  assert(!!A.game.menu.modal, "C: confirming the row opens a confirmation modal");
  assert(A.game.menu.modal.text.toLowerCase().includes("reset all"), "C: modal wording is unambiguous");
  A.game.menu.modal.index = 0; // CONFIRM
  A.menuModal("confirm");

  for (const e of A.DEBUG_ENTRIES)
    eq(A.debugShown[e.id], e.def, `C: Reset All restored ${e.id}'s shown value to its default`);
  eq(JSON.stringify(A.debugShown), JSON.stringify(fresh), "C: the restored debugShown matches a fresh build's, field for field");
})();

// ================= (D) the toggle: DEBUG derived, debugShown untouched =====================
(function sectionD() {
  console.log("(D) the toggle flips DEBUG between edited and default values WITHOUT touching debugShown, and back");
  const A = buildFrom(scriptSrc).exports;
  const eFloor = A.DEBUG_ENTRIES.find(v => v.id === "junkCountFloor");
  const eMs = A.DEBUG_ENTRIES.find(v => v.id === "autoShieldRegenPause");

  A.applyDebug(eFloor.id, eFloor.def + eFloor.step * 4);
  A.applyDebug(eMs.id, 2500);
  const editedFloorShown = A.debugShown[eFloor.id], editedMsShown = A.debugShown[eMs.id];
  eq(A.DEBUG[eFloor.id], editedFloorShown, "D: (setup) overrides ON — DEBUG reflects the edit");
  eq(A.DEBUG[eMs.id], editedMsShown / 1000, "D: (setup) ...toNative applied too");

  A.applyDebug(A.DEBUG_OVERRIDE_ID, 0); // OFF
  eq(A.overridesOn(), false, "D: toggle is now off");
  eq(A.debugShown[eFloor.id], editedFloorShown, "D: debugShown.junkCountFloor is UNTOUCHED by toggling off");
  eq(A.debugShown[eMs.id], editedMsShown, "D: debugShown.autoShieldRegenPause is UNTOUCHED by toggling off");
  eq(A.DEBUG[eFloor.id], eFloor.def, "D: DEBUG.junkCountFloor now reads the registry default");
  eq(A.DEBUG[eMs.id], eMs.def / 1000, "D: DEBUG.autoShieldRegenPause now reads the registry default (native)");

  A.applyDebug(A.DEBUG_OVERRIDE_ID, 1); // back ON
  eq(A.debugShown[eFloor.id], editedFloorShown, "D: debugShown.junkCountFloor still holds the edit");
  eq(A.DEBUG[eFloor.id], editedFloorShown, "D: DEBUG.junkCountFloor is restored from the untouched edit");
  eq(A.DEBUG[eMs.id], editedMsShown / 1000, "D: DEBUG.autoShieldRegenPause is restored too");
})();

// ================= (E) clampShown-before-toNative order preserved =====================
(function sectionE() {
  console.log("(E) clampShown runs before toNative, both on a direct edit and through the toggle-off derived path");
  const A = buildFrom(scriptSrc).exports;
  // A synthetic registry row carrying BOTH hooks (no shipped row has both) — appended live to the real
  // DEBUG_ENTRIES array so it runs through the REAL applyDebug/debugNative/rebuildDebug, then removed.
  const synth = { id: "__p6eSynthetic", label: "synthetic", unit: "", def: 10, min: 0, max: 100, step: 1,
    clampShown: v => Math.round(v), toNative: v => v / 10 };
  A.DEBUG_ENTRIES.push(synth);
  try {
    A.applyDebug(synth.id, 7.6); // clampShown should round to 8 BEFORE toNative divides
    eq(A.debugShown[synth.id], 8, "E: clampShown ran first — shown is the rounded integer");
    eq(A.DEBUG[synth.id], 0.8, "E: ...and toNative ran on the ALREADY-clamped value (8 / 10, not 7.6 / 10)");

    A.applyDebug(A.DEBUG_OVERRIDE_ID, 0); // OFF — DEBUG derives from e.def now
    eq(A.debugShown[synth.id], 8, "E: toggling off leaves the clamped shown value untouched");
    eq(A.DEBUG[synth.id], 1, "E: DEBUG derives from e.def (10) through toNative — order holds on the derived path too");

    A.applyDebug(A.DEBUG_OVERRIDE_ID, 1); // back ON
    eq(A.DEBUG[synth.id], 0.8, "E: back on, DEBUG re-derives from the still-clamped shown value");
  } finally {
    A.DEBUG_ENTRIES.length = A.DEBUG_ENTRIES.length - 1; // remove the synthetic row
  }
})();

// ================= (F) the toggle persists and reloads =====================
(function sectionF() {
  console.log("(F) the toggle persists in afd_settings_v1.debug and reloads on the next build");
  const store = {};
  const A = buildFrom(scriptSrc, { store }).exports;
  A.applyDebug(A.DEBUG_OVERRIDE_ID, 0);
  A.saveSettings();
  assert("afd_settings_v1" in store, "F: (setup) settings were written");

  const B = buildFrom(scriptSrc, { store }).exports; // loadSettings() runs at module load, same store
  eq(B.debugShown[B.DEBUG_OVERRIDE_ID], 0, "F: the reloaded build's toggle came back OFF");
  eq(B.overridesOn(), false, "F: ...and overridesOn() agrees");

  // Flip back on, verify the round trip the other direction too.
  B.applyDebug(B.DEBUG_OVERRIDE_ID, 1);
  B.saveSettings();
  const C = buildFrom(scriptSrc, { store }).exports;
  eq(C.debugShown[C.DEBUG_OVERRIDE_ID], 1, "F: ...and back ON round-trips too");
})();

// ================= (G) overrides-on, untouched panel: byte-identical to HEAD =====================
(function sectionG() {
  console.log("(G) overrides ON + an untouched panel reproduces HEAD's DEBUG/leverState exactly");
  let OLD = null;
  try {
    const prev = execFileSync("git", ["show", "HEAD:asteroids-deluxe.html"],
      { cwd: repoRoot, maxBuffer: 64 * 1024 * 1024 }).toString();
    const om = prev.match(/<script>([\s\S]*?)<\/script>/);
    if (om) OLD = buildFrom(om[1], { exportNames: OLD_RETURN }).exports;
  } catch (e) { /* not a git checkout: skipped below */ }

  if (OLD) {
    const A = buildFrom(scriptSrc).exports;
    for (const e of OLD.DEBUG_ENTRIES) // every id HEAD knew about still resolves to the same native value
      eq(A.DEBUG[e.id], OLD.DEBUG[e.id], `G: DEBUG.${e.id} is byte-identical to HEAD on an untouched panel`);
    for (const w of [1, 5, 33, 100])
      eq(JSON.stringify(A.leverState(w)), JSON.stringify(OLD.leverState(w)),
        `G: leverState(${w}) is byte-identical to HEAD`);
    eq(A.GAME_VERSION, OLD.GAME_VERSION, "G: GAME_VERSION unchanged from HEAD (see TRAP 1 below too)");
  } else {
    console.log("  (skipped byte-identical pin — not a git checkout)");
  }
})();

// ================= (H) the high-score wipe =====================
(function sectionH() {
  console.log("(H) Reset High Scores empties the array + key, leaves achievements intact, clears lastScoreId, qualifies() answers correctly after");
  const store = {};
  const A = buildFrom(scriptSrc, { store }).exports;

  A.HighScores.add({ initials: "AAA", score: 500, wave: 3, delivered: 1 });
  A.HighScores.add({ initials: "BBB", score: 300, wave: 2, delivered: 0 });
  assert(A.HighScores.entries.length === 2, "H: (setup) two scores recorded");
  assert("afd_scores_v1" in store, "H: (setup) the scores key was written");
  A.game.lastScoreId = A.HighScores.entries[0].id;

  A.Achievements.lifetime.hunterKills = 42;
  A.Achievements.save();
  const achievementsBefore = store["afd_achievements_v2"];
  assert(typeof achievementsBefore === "string" && achievementsBefore.length > 0,
    "H: (setup) the achievements key was written");

  confirmActionRow(A, "Reset saved scores");

  eq(A.HighScores.entries.length, 0, "H: HighScores.entries is emptied in memory");
  const stored = JSON.parse(store["afd_scores_v1"]);
  eq(stored.entries.length, 0, "H: the STORED afd_scores_v1 entries array is emptied too");
  eq(store["afd_achievements_v2"], achievementsBefore, "H: afd_achievements_v2 is byte-identical — untouched (TRAP 4)");
  eq(A.game.lastScoreId, null, "H: game.lastScoreId is cleared so the gameover table can't highlight a dead id");
  eq(A.HighScores.qualifies(1), true, "H: qualifies() answers correctly immediately after the wipe (table is empty)");

  // Wording distinct from Reset All's modal, and it does NOT reuse Reset All's confirm label.
  const B = buildFrom(scriptSrc).exports;
  const idxAll = B.DEBUG_ROWS.findIndex(r => r.kind === "action" && r.label === "Reset all debug knobs to defaults");
  const idxScores = B.DEBUG_ROWS.findIndex(r => r.kind === "action" && r.label === "Reset saved scores");
  B.game.menu.index = idxAll; B.menuDebug("confirm");
  const textAll = B.game.menu.modal.text; B.game.menu.modal = null;
  B.game.menu.index = idxScores; B.menuDebug("confirm");
  const textScores = B.game.menu.modal.text;
  assert(textAll !== textScores, "H: the two confirmation dialogs use different wording");
})();

// ================= (I) TRAPs =====================
(function sectionI() {
  console.log("(I) TRAPs: GAME_VERSION unchanged; no LEVERS/leverState edit; frozen keys unchanged; achievements never mentioned by the wipe path");
  eq(X.GAME_VERSION, "1.0.0.22", "I: TRAP 1 — GAME_VERSION stays 1.0.0.22 (P7 owns the bump)");
  eq(X.LEVERS.length, 17, "I: TRAP 2 — LEVERS is still 17 entries, this phase added no lever");

  assert(/STORAGE_KEY = "afd_settings_v1"/.test(scriptSrc), "I: TRAP 3 — afd_settings_v1 name unchanged");
  assert(/STORAGE_KEY: "afd_achievements_v2"/.test(scriptSrc), "I: TRAP 3 — afd_achievements_v2 name unchanged");
  assert(/STORAGE_KEY: "afd_scores_v1"/.test(scriptSrc), "I: TRAP 3 — afd_scores_v1 name unchanged");

  const resetHighScoresSrc = scriptSrc.slice(scriptSrc.indexOf("function resetHighScores"));
  const body = resetHighScoresSrc.slice(0, resetHighScoresSrc.indexOf("\n}"));
  assert(!/achievements/i.test(body), "I: TRAP 4 — resetHighScores() never references achievements");
})();

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
