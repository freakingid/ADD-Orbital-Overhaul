// Headless test for CS040 P6 — telemetry controls move off the hidden debug panel onto a new Options
// "Telemetry" sub-screen (Capture ON/OFF, a Sample rate preset cycle, Copy log). CS038 P3's contract for
// telemetryCapture (opt-in, off at every launch, sessionSwitch-exempt) is UNCHANGED — this phase only
// gives it a more convenient switch. copyTelemetry() itself is untouched; only its control surface moved.
//
//   node scratchpad/test-cs040-p6.js

"use strict";
const { mkAssert, buildGame, scriptSource } = require("./_harness.js");
const A = mkAssert();
const { assert, eq } = A;

// ================= (A) "Telemetry" sits in MENU_OPTIONS; every indexOf consumer resolves =============
(function sectionA() {
  console.log("(A) MENU_OPTIONS carries Telemetry before Back; every consumer still resolves by label");
  const X = buildGame();
  assert(X.MENU_OPTIONS.includes("Telemetry"), "A: MENU_OPTIONS carries a Telemetry row");
  assert(X.MENU_OPTIONS.indexOf("Telemetry") < X.MENU_OPTIONS.indexOf("Back"), "A: Telemetry sits before Back");
  eq(X.MENU_OPTIONS.indexOf("Credits") + 1, X.MENU_OPTIONS.indexOf("Telemetry"),
    "A: inserted immediately after Credits, the same spot CS038 P1 inserted Credits itself");

  // Every gotoScreen("options", …) / MENU_OPTIONS.indexOf(...) call site still resolves to a real row —
  // the positionally-blind contract the registry comment claims.
  X.game.paused = true; X.game.state = "title"; X.game.menu.screen = "titlemenu";
  X.gotoScreen("options", X.MENU_OPTIONS.indexOf("Telemetry"));
  eq(X.game.menu.screen, "options", "A: (setup) landed on Options");
  eq(X.MENU_OPTIONS[X.game.menu.index], "Telemetry", "A: ...cursor on Telemetry");
  X.menuInput("confirm");
  eq(X.game.menu.screen, "telemetry", "A: confirming Telemetry opens its sub-screen");
  X.menuInput("back");
  eq(X.game.menu.screen, "options", "A: back returns to Options");
  eq(X.MENU_OPTIONS[X.game.menu.index], "Telemetry", "A: ...cursor restored to Telemetry");
})();

// ================= (B) Capture toggles from Options, and never survives a reload =====================
(function sectionB() {
  console.log("(B) Capture ON/OFF from the Telemetry screen; CS038 P3's session-only contract is unchanged");
  const store = {};
  const X = buildGame({ store });
  X.startGame();
  X.game.menu.screen = "telemetry";
  X.game.menu.index = X.TELEMETRY_ROWS.indexOf("Capture");
  eq(X.DEBUG.telemetryCapture, 0, "B: (setup) capture starts OFF");
  X.menuInput("right");
  eq(X.DEBUG.telemetryCapture, 1, "B: right toggles it ON");
  eq(X.debugShown.telemetryCapture, 1, "B: ...at the shown layer too");
  X.menuInput("left");
  eq(X.DEBUG.telemetryCapture, 0, "B: left toggles it back OFF");
  X.menuInput("right");
  eq(X.DEBUG.telemetryCapture, 1, "B: (setup) ON again, then saved");
  X.saveSettings();

  const blob = JSON.parse(store[X.STORAGE_KEY]);
  assert(blob.debug && !("telemetryCapture" in blob.debug),
    "B: ⛔ the saved blob's debug sub-object still never carries telemetryCapture");

  // A fresh module instance over the SAME store — the simulated reload.
  const X2 = buildGame({ store });
  eq(X2.DEBUG.telemetryCapture, 0, "B: ⛔ a fresh instance (simulated reload) comes back with capture OFF");
  eq(X2.debugShown.telemetryCapture, 0, "B: ...at every layer, not just the derived one");
})();

// ================= (C) the sample-rate preset cycle wraps 5 -> 10 -> 15 -> 5 ===========================
(function sectionC() {
  console.log("(C) Sample rate cycles the [5,10,15] preset ring both directions, and wraps");
  const X = buildGame();
  X.startGame();
  X.game.menu.screen = "telemetry";
  X.game.menu.index = X.TELEMETRY_ROWS.indexOf("Sample rate");
  eq(X.DEBUG.telemetryInterval, 15, "C: (setup) def is 15");
  X.menuInput("right");
  eq(X.DEBUG.telemetryInterval, 5, "C: 15 -> 5 (wraps forward)");
  X.menuInput("right");
  eq(X.DEBUG.telemetryInterval, 10, "C: 5 -> 10");
  X.menuInput("right");
  eq(X.DEBUG.telemetryInterval, 15, "C: 10 -> 15");
  X.menuInput("left");
  eq(X.DEBUG.telemetryInterval, 10, "C: 15 -> 10 (reverse)");
  X.menuInput("left");
  eq(X.DEBUG.telemetryInterval, 5, "C: 10 -> 5");
  X.menuInput("left");
  eq(X.DEBUG.telemetryInterval, 15, "C: 5 -> 15 (wraps backward)");

  // ⛔ The registry `def` stays 15, so a stock run still reports levers=none.
  const telemetryIntervalEntry = X.DEBUG_ENTRIES.find(e => e.id === "telemetryInterval");
  eq(telemetryIntervalEntry.def, 15, "C: DEBUG.telemetryInterval's registry def is unmoved at 15");
})();

// ================= (D) the minutes label DERIVES from TELEMETRY_MAX, never hardcoded ===================
(function sectionD() {
  console.log("(D) telemetryRateLabel()'s minutes figure moves when TELEMETRY_MAX moves");
  const X = buildGame();
  eq(X.telemetryRateLabel(5), "5 s — Detail (67 min)", "D: 5s at the shipped 800-row cap reads 67 min");
  eq(X.telemetryRateLabel(10), "10 s — Balanced (133 min)", "D: 10s reads 133 min");
  eq(X.telemetryRateLabel(15), "15 s — Full run (200 min)", "D: 15s reads 200 min");

  // Move the cap and rebuild from PATCHED SOURCE — TELEMETRY_MAX is a const closed over by
  // telemetryRateLabel(), so reassigning X.TELEMETRY_MAX on the built instance would not reach it; a
  // literal 67/133/200 baked into the label function would not react either way.
  const raw = scriptSource();
  assert(/const TELEMETRY_MAX = 800;/.test(raw), "D: (setup) the cap is declared exactly as expected, patchable");
  const patched = raw.replace("const TELEMETRY_MAX = 800;", "const TELEMETRY_MAX = 400;");
  const Y = buildGame({ source: patched });
  eq(Y.telemetryRateLabel(5), "5 s — Detail (33 min)", "D: halving the cap halves the minutes (5s: 67 -> 33)");
  eq(Y.telemetryRateLabel(15), "15 s — Full run (100 min)", "D: ...and (15s: 200 -> 100)");
})();

// ================= (E) copyTelemetry() keeps working with capture OFF ==================================
(function sectionE() {
  console.log("(E) copyTelemetry() still exports whatever rows exist, capture OFF or ON");
  const X = buildGame();
  X.startGame();
  eq(X.DEBUG.telemetryCapture, 0, "E: (setup) capture is OFF");
  X.Telemetry.msg = "";
  X.copyTelemetry();
  assert(/no telemetry rows yet/i.test(X.Telemetry.msg), "E: an empty buffer with capture off states so, not silently");

  // A row banked while capture was ON is still exportable after capture is turned back OFF — the
  // "morning after a capture session" state the standing comment at Telemetry.tick() names.
  X.applyDebug("telemetryInterval", 1);
  X.applyDebug("telemetryCapture", 1);
  for (let i = 0; i < 90; i++) X.update(1 / 30);
  assert(X.Telemetry.rows.length > 0, "E: (setup) capture ON banked at least one row");
  X.applyDebug("telemetryCapture", 0);
  X.Telemetry.msg = "";
  X.copyTelemetry();
  assert(X.Telemetry.msg !== "" && !/no telemetry rows yet/i.test(X.Telemetry.msg),
    "E: with capture back OFF, the banked rows are still exportable (an outcome is stated either way)");
})();

// ================= (F) the three debug-panel rows are gone; the registry is untouched ===================
(function sectionF() {
  console.log("(F) telemetryInterval/telemetryCapture/Copy telemetry log no longer reachable on the debug panel");
  const X = buildGame();
  X.startGame();
  X.game.paused = true; X.game.state = "title"; X.game.menu.screen = "debug";
  X.game.menu.index = X.debugFirstRow();

  // The two knobs still exist in the registry (Telemetry.tick()/flush() and the CSV fingerprint read
  // them there unchanged) — hidden from the PANEL, not deleted.
  assert(X.DEBUG_ENTRIES.some(e => e.id === "telemetryInterval"), "F: telemetryInterval is still a registry entry");
  assert(X.DEBUG_ENTRIES.some(e => e.id === "telemetryCapture"), "F: telemetryCapture is still a registry entry");
  eq(X.LEVERS.length, 18, "F: LEVERS is unmoved — these were never levers, and nothing here changes that");

  // A full lap of the debug panel never lands on either hidden var row.
  const hiddenIds = new Set(["telemetryInterval", "telemetryCapture"]);
  for (let k = 0; k < X.DEBUG_ROWS.length + 5; k++) {
    X.menuDebug("down");
    const r = X.DEBUG_ROWS[X.game.menu.index];
    if (r.kind === "var") assert(!hiddenIds.has(r.e.id), `F: down never lands on ${r.e.id} (step ${k})`);
  }
  // "Copy telemetry log" is gone from the panel's action rows entirely — moved, not duplicated.
  const actionLabels = X.DEBUG_ROWS.filter(r => r.kind === "action").map(r => r.label);
  assert(!actionLabels.includes("Copy telemetry log"), "F: the debug panel carries no telemetry export row");
  eq(X.DEBUG_ROWS[X.DEBUG_ROWS.length - 1].kind, "back", "F: Back is still the panel's last row");
})();

A.report();
