// Headless test for CS016 Phase 3 — the build's FIRST modal confirmation dialog, plus its two
// consumers (Controls "Return to Defaults" and the mid-run root "Quit").
//
//   node scratchpad/test-cs016-p3.js
//
// Follows the standing rule (GDD 5.4 / CLAUDE.md): stub window/document/rAF/navigator/localStorage,
// eval the REAL <script> block, and drive the ACTUAL handlers — menuInput/menuModal/menuRoot/
// menuControls/returnToDefaults/openModal/drawMenu/drawModal, plus the REAL keydown listener and the
// REAL handleGamepadMenu with a fake pad. No dialog logic is reimplemented anywhere in this file.
//
// Sections:
//  (A) node --check; game.menu.modal defaults null (game literal AND startGame's reset).
//  (B) Opening a modal parks the cursor on CANCEL (index 1) — THE safety property of this phase.
//  (C) Cancel-row confirm and `back` both dismiss WITHOUT running onConfirm; confirm on the confirm
//      row runs it exactly once, and clears the modal BEFORE invoking.
//  (D) `pause` inside an open modal cancels and leaves the underlying screen open and paused.
//  (E) Return to Defaults: rebind away from default, CANCEL keeps the custom binding; CONFIRM
//      restores DEFAULT_BINDINGS and persists.
//  (F) Mid-run Quit: cancel -> still playing and still paused; confirm -> "title" + the title menu.
//  (G) Gameover "Quit to Title" opens NO modal and quits directly.
//  (H) The modal out-ranks the underlying screen: "down" moves the modal cursor, never m.row.
//  (I) A live rebinding capture still out-ranks a modal (guard order, behavioural AND in source).
//  (J) Modal clear sites; drawMenu()/drawModal() render on every screen that can raise one;
//      AudioSys.ctx null smoke.
//  (K) RENDER detail: measured (self-healing) panel width, the two rows in the "▶ "/COLOR convention,
//      the drawMenuHint footer, and the dialog painting AFTER (over) the panel that raised it.

"use strict";
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "asteroids-deluxe.html");
const scriptSrc = (() => {
  const m = fs.readFileSync(htmlPath, "utf8").match(/<script>([\s\S]*?)<\/script>/);
  if (!m) { console.error("Could not find <script> block"); process.exit(1); }
  return m[1];
})();

let passed = 0, failed = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
const eqJSON = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ================= (A) syntax =====================
(function sectionA_syntax() {
  console.log("(A) node --check on the extracted <script>");
  const tmp = path.join(require("os").tmpdir(), "cs016-p3-extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execSync(`node --check "${tmp}"`, { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
})();

// ---- Recording 2D context (the test-cs016-p2.js idiom): logs fillText/fillRect/strokeRect with the
// style state active at the call; every other ctx method is a safe no-op. ----
let recLog = [];
function makeRecordingCtx() {
  const state = { fillStyle: null, strokeStyle: null, font: null, textAlign: null, lineWidth: null, shadowBlur: 0, globalAlpha: 1 };
  return new Proxy(state, {
    get(t, p) {
      if (p === "fillText") return (str, x, y) => recLog.push({ c: "fillText", str, x, y, font: t.font, color: t.fillStyle, align: t.textAlign });
      if (p === "fillRect") return (x, y, w, h) => recLog.push({ c: "fillRect", x, y, w, h, color: t.fillStyle });
      if (p === "strokeRect") return (x, y, w, h) => recLog.push({ c: "strokeRect", x, y, w, h, color: t.strokeStyle });
      if (p === "measureText") return (str) => ({ width: (parseInt(t.font, 10) || 10) * 0.6 * str.length });
      if (p === "createLinearGradient" || p === "createRadialGradient") return () => ({ addColorStop: () => {} });
      if (p in t) return t[p];
      return () => {};
    },
    set(t, p, v) { t[p] = v; return true; }
  });
}

function makeAudioNode() {
  return new Proxy({
    gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    Q: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} },
    threshold: { value: 0, setValueAtTime() {} }, ratio: { value: 1, setValueAtTime() {} },
    attack: { value: 0, setValueAtTime() {} }, release: { value: 0, setValueAtTime() {} },
    type: "sine", buffer: null, loop: false, curve: null, playbackRate: { value: 1 },
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

const RETURN = [
  "startGame", "update", "draw", "game", "settings", "saveSettings",
  "menuActive", "menuInput", "menuModal", "openModal", "menuRoot", "menuControls", "menuTitle",
  "menuOptions", "returnToDefaults", "startRebind",
  "openPause", "closePause", "returnToTitleMenu", "quitToTitle", "gotoScreen", "openDebug",
  "handleMenuKey", "handleGamepadMenu", "pollGamepad", "rootItems",
  "MENU_TITLE", "MENU_OPTIONS", "MENU_ROOT_PLAY", "MENU_ROOT_OVER",
  "MODAL_TITLE", "MODAL_CANCEL_LABEL", "MODAL_HINT", "MODAL_MIN_W", "MODAL_MARGIN", "MODAL_H",
  "MODAL_TEXT_SIZE", "MODAL_TEXT_Y", "MODAL_ROW_Y", "MODAL_ROW_STEP", "MODAL_ROW_SIZE", "MODAL_HINT_Y",
  "MENU_HINT_SIZE", "COLOR", "VIEW_W", "VIEW_H", "GAME_VERSION",
  "drawMenu", "drawModal", "drawTitleMenu", "menuPanel",
  "bindings", "DEFAULT_BINDINGS", "REBINDABLE", "GP", "keys", "AudioSys", "STORAGE_KEY"
];

// `audio: true` gives the real keydown listener a live AudioSys (it calls AudioSys.init() up front);
// the default leaves AudioSys.ctx null, which is what the (J) smoke needs.
function build({ audio = true } = {}) {
  const recCtx = makeRecordingCtx();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => recCtx };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const listeners = {};
  const windowStub = {
    addEventListener: (type, fn) => { (listeners[type] = listeners[type] || []).push(fn); },
    innerWidth: 1280, innerHeight: 720,
    AudioContext: audio ? FakeAudioContext : undefined,
    webkitAudioContext: audio ? FakeAudioContext : undefined
  };
  let pads = [];
  const navigatorStub = { getGamepads: () => pads };
  const lsStore = {};
  const localStorageStub = {
    getItem: k => (k in lsStore ? lsStore[k] : null),
    setItem: (k, v) => { lsStore[k] = String(v); },
    removeItem: k => { delete lsStore[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    scriptSrc + "\n;return { " + RETURN.join(", ") + " };"
  );
  const A = factory(windowStub, documentStub, { now: () => 100000 }, () => 0, navigatorStub, localStorageStub);

  A.store = lsStore;
  A.keydown = (key, repeat) => {
    const e = { key, repeat: !!repeat, preventDefault() {} };
    for (const fn of (listeners.keydown || [])) fn(e);
  };
  const makePad = (press) => {
    const buttons = [];
    for (let i = 0; i < 17; i++) buttons.push({ pressed: press.includes(i), value: press.includes(i) ? 1 : 0 });
    return { connected: true, buttons, axes: [0, 0, 0, 0] };
  };
  A.setPad = (press) => { pads = press === null ? [] : [makePad(press)]; A.pollGamepad(); };
  A.padPress = (...btns) => { A.setPad([]); A.setPad(btns); A.handleGamepadMenu(); };
  A.render = fn => { recLog = []; fn(); return recLog.slice(); };

  // --- Shared drivers, so no section reimplements "how you get to a modal". ---
  // Paused mid-run, cursor parked on the root's "Quit" row.
  A.atMidRunQuit = () => {
    A.startGame(); A.openPause();
    A.game.menu.index = A.rootItems().indexOf("Quit");
    return A.game.menu;
  };
  // Controls screen (reached the real way, through the root -> Options -> Controls), cursor parked on
  // the Return to Defaults row. Row index derived exactly the way menuControls derives it.
  A.defaultsRow = () => A.REBINDABLE.length + 1;
  A.atControlsDefaults = () => {
    A.startGame(); A.openPause();
    A.game.menu.index = A.rootItems().indexOf("Options"); A.menuInput("confirm");
    A.game.menu.index = A.MENU_OPTIONS.indexOf("Controls"); A.menuInput("confirm");
    A.game.menu.row = A.defaultsRow();
    return A.game.menu;
  };
  return A;
}

// ================= (A cont.) game.menu.modal defaults null in BOTH resets =====================
(function sectionA_state() {
  console.log("(A) game.menu.modal defaults null — the game literal AND startGame's reset");
  const A = build();
  const g = A.game;

  assert("modal" in g.menu, "A: the game literal's menu object declares a `modal` field");
  assert(g.menu.modal === null, "A: ...and it boots null (no dialog open)");

  // The field must land in startGame()'s reset literal too, or it is `undefined` for a whole run —
  // exactly the divergence `scroll` already has (STATUS.md Known issues).
  g.menu.modal = { text: "stale", confirmLabel: "X", cancelLabel: "Y", index: 0, onConfirm: () => {} };
  A.startGame();
  assert("modal" in g.menu, "A: startGame()'s menu reset literal declares `modal` (not just the game literal)");
  assert(g.menu.modal === null, "A: ...and a stale dialog never carries into a fresh run");

  // Source check: both literals really do carry it, so this can't regress to a runtime-only assignment.
  const literals = scriptSrc.match(/menu\s*[:=]\s*\{[^}]*\}/g) || [];
  assert(literals.length >= 2, `A: found both game.menu literals to inspect (got ${literals.length})`);
  assert(literals.every(l => /modal\s*:\s*null/.test(l)),
    "A: every game.menu object literal initialises modal: null");
})();

// ================= (B) THE safety property: a fresh modal parks on CANCEL =====================
(function sectionB() {
  console.log("(B) openModal parks index on 1 (CANCEL) — a double-tap of ENTER can never destroy");
  const A = build();
  const g = A.game;

  let ran = 0;
  A.openModal("Do the dangerous thing?", "DO IT", () => ran++);
  const md = g.menu.modal;
  assert(!!md, "B: openModal populated game.menu.modal");
  assert(md.index === 1, `B: index defaults to 1 (CANCEL), NOT 0 — got ${md.index}`);
  assert(md.confirmLabel === "DO IT", "B: confirmLabel is the caller's");
  assert(md.cancelLabel === A.MODAL_CANCEL_LABEL && md.cancelLabel === "CANCEL",
    `B: cancelLabel defaults to "CANCEL"; got ${JSON.stringify(md.cancelLabel)}`);
  assert(md.text === "Do the dangerous thing?", "B: text is the caller's prompt");
  assert(typeof md.onConfirm === "function", "B: onConfirm is stored as a callable");
  assert(eqJSON(Object.keys(md).sort(), ["cancelLabel", "confirmLabel", "index", "onConfirm", "text"]),
    `B: the state shape is exactly {text,confirmLabel,cancelLabel,index,onConfirm}; got ${JSON.stringify(Object.keys(md))}`);

  // The property that matters, exercised rather than merely inspected: ENTER twice (open, then the
  // very next confirm) must NOT fire the callback.
  A.menuInput("confirm");
  assert(ran === 0, "B: ENTER on the freshly-opened dialog cancels — the callback did not run");
  assert(g.menu.modal === null, "B: ...and the dialog is gone");

  // Every consumer's real dialog lands on cancel too, not just a synthetic one.
  A.atMidRunQuit(); A.menuInput("confirm");
  assert(g.menu.modal && g.menu.modal.index === 1, "B: the mid-run Quit dialog opens on CANCEL");
  A.atControlsDefaults(); A.menuInput("confirm");
  assert(g.menu.modal && g.menu.modal.index === 1, "B: the Return to Defaults dialog opens on CANCEL");

  // An explicit cancelLabel is honoured (the default is a default, not a hardcode).
  A.openModal("q", "YES", () => {}, "NO");
  assert(g.menu.modal.cancelLabel === "NO", "B: an explicit cancelLabel overrides the default");
})();

// ================= (C) cancel / back dismiss without running; confirm runs exactly once ==========
(function sectionC() {
  console.log("(C) cancel + back dismiss without onConfirm; confirm runs it exactly once");
  const A = build();
  const g = A.game;

  // Cancel row (the default) + ENTER.
  let ran = 0;
  A.openModal("t", "GO", () => ran++);
  A.menuInput("confirm");
  assert(ran === 0 && g.menu.modal === null, "C: ENTER on CANCEL dismisses and never runs onConfirm");

  // `back` from the CONFIRM row — moving the cursor onto the dangerous row then backing out must also
  // be inert. (Backing out from the cancel row is the same code path; this is the harder direction.)
  ran = 0;
  A.openModal("t", "GO", () => ran++);
  A.menuInput("up");
  assert(g.menu.modal.index === 0, "C: `up` moved the cursor onto the confirm row");
  A.menuInput("back");
  assert(ran === 0 && g.menu.modal === null, "C: `back` from the CONFIRM row dismisses without running onConfirm");

  // Confirm row + ENTER: runs, exactly once.
  ran = 0;
  A.openModal("t", "GO", () => ran++);
  A.menuInput("down");
  assert(g.menu.modal.index === 0, "C: `down` toggles to the confirm row (two rows, so any direction toggles)");
  A.menuInput("confirm");
  assert(ran === 1, `C: confirm on the confirm row ran onConfirm exactly once (got ${ran})`);
  assert(g.menu.modal === null, "C: ...and the dialog is torn down");
  A.menuInput("confirm");   // a second ENTER now falls through to the underlying screen, not the callback
  assert(ran === 1, "C: a second ENTER cannot re-run a dismissed dialog's callback");

  // All four directions toggle between exactly 0 and 1 — never a third index.
  A.openModal("t", "GO", () => {});
  const seen = new Set();
  for (const d of ["up", "down", "left", "right", "up", "left"]) { A.menuInput(d); seen.add(g.menu.modal.index); }
  assert(eqJSON([...seen].sort(), [0, 1]), `C: the cursor only ever visits 0 and 1; saw ${JSON.stringify([...seen])}`);
  A.menuInput("back");

  // CLEAR-BEFORE-INVOKE: the callback must observe modal === null, so a callback that navigates (or
  // opens another dialog) cannot be clobbered by the teardown running after it.
  let sawInside = "not-run";
  A.openModal("t", "GO", () => { sawInside = g.menu.modal; });
  A.menuInput("up"); A.menuInput("confirm");
  assert(sawInside === null, `C: onConfirm ran AFTER the modal was cleared (saw ${JSON.stringify(sawInside)})`);

  // ...and the concrete consequence: a callback that opens a second dialog keeps it.
  A.openModal("first", "GO", () => A.openModal("second", "GO2", () => {}));
  A.menuInput("up"); A.menuInput("confirm");
  assert(g.menu.modal && g.menu.modal.text === "second",
    "C: a callback that opens another dialog is not clobbered by the first one's teardown");
  assert(g.menu.modal.index === 1, "C: ...and the second dialog gets its own CANCEL default");
  A.menuInput("back");

  // A modal with no callback (defensive) doesn't throw on confirm.
  let threw = null;
  try { A.openModal("t", "GO", null); A.menuInput("up"); A.menuInput("confirm"); } catch (e) { threw = e; }
  assert(!threw && g.menu.modal === null, "C: a null onConfirm confirms cleanly instead of throwing");
})();

// ================= (D) `pause` inside a modal cancels, and does NOT closePause() =================
(function sectionD() {
  console.log("(D) `pause` in an open modal cancels; the underlying screen stays open and paused");
  const A = build();
  const g = A.game;

  // On the root (mid-run Quit dialog).
  let ran = 0;
  A.atMidRunQuit();
  A.menuInput("confirm");                      // open
  assert(!!g.menu.modal, "D: the Quit dialog is open");
  g.menu.modal.onConfirm = () => ran++;        // swap in a probe so a leak would be visible
  A.menuInput("pause");
  assert(g.menu.modal === null, "D: `pause` dismissed the dialog");
  assert(ran === 0, "D: ...as a CANCEL — onConfirm did not run");
  assert(g.menu.screen === "root", "D: the underlying root screen is STILL open (pause did not closePause)");
  assert(g.paused === true, "D: ...and the game is still paused");
  assert(g.state === "playing", "D: ...and still a live run");

  // On the Controls screen (Return to Defaults dialog) — `pause` there normally DOES closePause(),
  // so this is the case where swallowing it actually matters.
  A.atControlsDefaults();
  A.menuInput("confirm");
  assert(!!g.menu.modal, "D: the Return to Defaults dialog is open on the Controls screen");
  A.menuInput("pause");
  assert(g.menu.modal === null, "D: `pause` dismissed it");
  assert(g.menu.screen === "controls" && g.paused === true,
    "D: the Controls screen is still open and paused — menuControls' own `pause` -> closePause() never fired");
  assert(g.menu.row === A.defaultsRow(), "D: ...and the cursor is still on the row that raised the dialog");

  // Sanity that the screen's own `pause` DOES close once the dialog is gone (so the assertion above
  // is about the modal swallowing it, not about `pause` being inert on this screen).
  A.menuInput("pause");
  assert(g.paused === false && g.menu.screen === null, "D: sanity — with no dialog open, `pause` on Controls still closes the menu");
})();

// ================= (E) consumer one: Return to Defaults =====================
(function sectionE() {
  console.log("(E) Return to Defaults is gated: CANCEL keeps the custom binding, CONFIRM restores + saves");
  const A = build();
  const g = A.game;
  const act = A.REBINDABLE[0];
  const eqArr = (a, b) => eqJSON(a, b);

  const allDefault = () => A.REBINDABLE.every(n => {
    const b = A.bindings[n], d = A.DEFAULT_BINDINGS[n];
    return eqArr(b.keys, d.keys) && eqArr(b.buttons, d.buttons) && eqJSON(b.axis, d.axis);
  });

  // --- CANCEL keeps the custom binding ---
  A.bindings[act].keys = ["j"];
  assert(!allDefault(), "E: (precondition) a rebound action differs from DEFAULT_BINDINGS");
  A.atControlsDefaults();
  A.menuInput("confirm");
  assert(!!g.menu.modal, "E: confirm on the Return to Defaults row opens a dialog instead of resetting");
  assert(g.menu.modal.confirmLabel === "RESET", `E: confirmLabel is "RESET"; got ${JSON.stringify(g.menu.modal.confirmLabel)}`);
  assert(g.menu.modal.text === "Reset all controls to defaults?", `E: prompt text; got ${JSON.stringify(g.menu.modal.text)}`);
  assert(eqArr(A.bindings[act].keys, ["j"]), "E: merely OPENING the dialog reset nothing");
  A.menuInput("confirm");   // ENTER on the default CANCEL row
  assert(g.menu.modal === null, "E: CANCEL dismissed it");
  assert(eqArr(A.bindings[act].keys, ["j"]), "E: after CANCEL the custom binding is still the custom one");
  assert(g.menu.screen === "controls" && g.menu.row === A.defaultsRow(), "E: ...and we are still on the Controls row that asked");

  // --- CONFIRM resets and persists ---
  delete A.store[A.STORAGE_KEY];   // so "settings were saved" is a fresh write, not a leftover
  A.menuInput("confirm");          // re-open
  assert(!!g.menu.modal, "E: the dialog re-opens from the same row");
  assert(g.menu.modal.index === 1, "E: ...on CANCEL again (no sticky index across openings)");
  A.menuInput("up");               // onto RESET
  A.menuInput("confirm");
  assert(g.menu.modal === null, "E: CONFIRM tore the dialog down");
  assert(allDefault(), "E: every rebindable action now matches DEFAULT_BINDINGS");
  const raw = A.store[A.STORAGE_KEY];
  assert(!!raw, "E: returnToDefaults' saveSettings() wrote the settings key");
  const blob = raw ? JSON.parse(raw) : {};
  assert(!!blob.bindings, "E: ...with a bindings payload");
  assert(blob.bindings && eqArr(blob.bindings[act].keys, A.DEFAULT_BINDINGS[act].keys),
    "E: ...and the persisted binding is the default one, not the custom one");
  assert(g.menu.screen === "controls", "E: CONFIRM leaves the player on the Controls screen (nothing navigated)");

  // returnToDefaults() itself is UNCHANGED — still callable directly and still not touching
  // shipTurnScale (FLAG-10a). The gate is in menuControls, not in the function.
  A.bindings[act].keys = ["k"];
  A.settings.shipTurnScale = 1.4;
  A.returnToDefaults();
  assert(allDefault(), "E: returnToDefaults() called directly still resets everything (unchanged by P3)");
  assert(Math.abs(A.settings.shipTurnScale - 1.4) < 1e-9, "E: ...and still leaves shipTurnScale alone (FLAG-10a intact)");
})();

// ================= (F) consumer two: mid-run Quit =====================
(function sectionF() {
  console.log("(F) mid-run Quit is gated: cancel -> still playing+paused; confirm -> title menu");
  const A = build();
  const g = A.game;

  // --- CANCEL ---
  A.atMidRunQuit();
  assert(A.rootItems()[g.menu.index] === "Quit", "F: (precondition) cursor is on the mid-run \"Quit\" row");
  A.menuInput("confirm");
  assert(!!g.menu.modal, "F: confirm on \"Quit\" opens a dialog instead of quitting");
  assert(g.menu.modal.confirmLabel === "QUIT", `F: confirmLabel is "QUIT"; got ${JSON.stringify(g.menu.modal.confirmLabel)}`);
  assert(g.menu.modal.text === "Quit to title? Progress in this run will be lost.",
    `F: prompt text; got ${JSON.stringify(g.menu.modal.text)}`);
  assert(g.state === "playing", "F: merely opening the dialog did not end the run");
  A.menuInput("back");
  assert(g.menu.modal === null, "F: back dismissed it");
  assert(g.state === "playing", "F: after cancel the run is still live");
  assert(g.paused === true && g.menu.screen === "root", "F: ...and still paused on the root menu");
  assert(A.rootItems()[g.menu.index] === "Quit", "F: ...cursor still on Quit, ready to try again");

  // --- CONFIRM ---
  A.menuInput("confirm");   // re-open
  A.menuInput("up");        // onto QUIT
  assert(g.menu.modal.index === 0, "F: cursor moved onto the QUIT row");
  A.menuInput("confirm");
  assert(g.state === "title", "F: CONFIRM quit to the title");
  assert(g.menu.screen === "titlemenu", "F: ...and the title's own menu is armed (CS016 P2 invariant)");
  assert(g.paused === false, "F: ...unpaused");
  assert(g.menu.modal === null, "F: ...with no dialog left over");
  assert(A.menuActive() === true, "F: ...and the title menu owns input");

  // The keyboard path end-to-end, through the REAL listener — the dialog must be drivable with the
  // same keys that reach every other menu, with no special-casing in handleMenuKey.
  A.startGame(); A.openPause();
  g.menu.index = A.rootItems().indexOf("Quit");
  A.keydown("Enter");
  assert(!!g.menu.modal, "F: ENTER (real keydown) on Quit opens the dialog");
  A.keydown("Escape");
  assert(g.menu.modal === null && g.state === "playing", "F: ESC (real keydown) cancels it");
  A.keydown("Enter");
  A.keydown("ArrowUp");
  assert(g.menu.modal.index === 0, "F: ArrowUp (real keydown) moves the dialog cursor");
  A.keydown("Enter");
  assert(g.state === "title", "F: ENTER on QUIT (real keydown) quits");

  // And the gamepad path, through the REAL handleGamepadMenu.
  A.startGame(); A.openPause();
  g.menu.index = A.rootItems().indexOf("Quit");
  A.setPad([]);
  A.padPress(A.GP.A);
  assert(!!g.menu.modal, "F: pad A on Quit opens the dialog");
  A.padPress(A.GP.B);
  assert(g.menu.modal === null && g.state === "playing", "F: pad B cancels it");
  A.padPress(A.GP.A);
  A.padPress(A.GP.DPAD_UP);
  assert(g.menu.modal && g.menu.modal.index === 0, "F: pad D-Pad Up moves the dialog cursor");
  A.padPress(A.GP.A);
  assert(g.state === "title", "F: pad A on QUIT quits");
  // pad START inside a dialog must cancel, never punch through to closePause().
  A.startGame(); A.openPause();
  g.menu.index = A.rootItems().indexOf("Quit");
  A.setPad([]); A.padPress(A.GP.A);
  assert(!!g.menu.modal, "F: (precondition) dialog open before the START press");
  A.padPress(A.GP.START);
  assert(g.menu.modal === null && g.paused === true && g.menu.screen === "root",
    "F: pad START inside the dialog cancels it and leaves the root menu open");
})();

// ================= (G) the deliberate NON-consumer: gameover "Quit to Title" =====================
(function sectionG() {
  console.log("(G) gameover \"Quit to Title\" opens NO dialog — it quits directly");
  const A = build();
  const g = A.game;

  A.startGame();
  g.state = "gameover"; g.paused = false; g.menu.screen = null;
  A.openPause();
  assert(g.menu.screen === "root" && eqJSON(A.rootItems(), ["Play Again", "Options", "Quit to Title"]),
    "G: (precondition) the gameover root is open with its own layout");
  g.menu.index = A.rootItems().indexOf("Quit to Title");
  assert(g.menu.modal === null, "G: no dialog before the press");
  A.menuInput("confirm");
  assert(g.menu.modal === null, "G: no dialog after it either — the row is unconfirmed by design");
  assert(g.state === "title", "G: ...and it quit straight to the title");
  assert(g.menu.screen === "titlemenu" && g.paused === false, "G: ...landing on the armed title menu");

  // The two labels really are distinct, which is what lets one branch confirm and the other not.
  assert(A.MENU_ROOT_PLAY.includes("Quit") && !A.MENU_ROOT_PLAY.includes("Quit to Title"),
    "G: the mid-run root's label is exactly \"Quit\"");
  assert(A.MENU_ROOT_OVER.includes("Quit to Title") && !A.MENU_ROOT_OVER.includes("Quit"),
    "G: the gameover root's label is exactly \"Quit to Title\"");

  // Every OTHER row of both roots is likewise unconfirmed — only "Quit" grew a dialog.
  for (const [state, layout] of [["playing", "MENU_ROOT_PLAY"], ["gameover", "MENU_ROOT_OVER"]]) {
    for (const label of A[layout]) {
      if (label === "Quit") continue;
      A.startGame();
      if (state === "gameover") { g.state = "gameover"; g.paused = false; g.menu.screen = null; }
      A.openPause();
      g.menu.index = A.rootItems().indexOf(label);
      A.menuInput("confirm");
      assert(g.menu.modal === null, `G: [${state}] row "${label}" opens no dialog (got ${JSON.stringify(g.menu.modal)})`);
    }
  }

  // Likewise every non-defaults row of the Controls screen.
  for (let row = 0; row < A.REBINDABLE.length + 3; row++) {
    if (row === A.defaultsRow()) continue;
    A.atControlsDefaults();
    g.menu.row = row;
    A.menuInput("confirm");
    assert(g.menu.modal === null, `G: Controls row ${row} opens no dialog`);
    g.menu.rebinding = null;   // a rebindable row arms capture; clear it so the next iteration navigates
  }
})();

// ================= (H) input priority over the underlying screen =====================
(function sectionH() {
  console.log("(H) an open dialog out-ranks the screen beneath it — \"down\" never reaches m.row");
  const A = build();
  const g = A.game;

  A.atControlsDefaults();
  const row0 = g.menu.row;
  A.menuInput("confirm");
  assert(!!g.menu.modal, "H: (precondition) a dialog is open over the Controls screen");
  const idx0 = g.menu.modal.index;
  A.menuInput("down");
  assert(g.menu.modal.index === 1 - idx0, "H: \"down\" moved the DIALOG cursor");
  assert(g.menu.row === row0, `H: ...and did NOT move the Controls row (still ${row0})`);
  A.menuInput("down"); A.menuInput("up"); A.menuInput("left"); A.menuInput("right");
  assert(g.menu.row === row0, "H: no direction leaks to the underlying screen while a dialog is up");
  assert(g.menu.col === 0, "H: ...and left/right never toggled the Controls kb/pad column either");

  // Same over the root, where "down" would otherwise walk the root's index.
  A.atMidRunQuit();
  const ridx0 = g.menu.index;
  A.menuInput("confirm");
  A.menuInput("down"); A.menuInput("down"); A.menuInput("down");
  assert(g.menu.index === ridx0, `H: the root's own cursor never moved while its dialog was up (still ${ridx0})`);
  assert(g.menu.modal.index === 0 || g.menu.modal.index === 1, "H: the dialog cursor absorbed the presses");

  // "options" (the keyboard "o" action) is an unknown action to menuModal — it must be swallowed as an
  // inert no-op, never forwarded to the screen beneath.
  const before = { screen: g.menu.screen, index: g.menu.index, paused: g.paused };
  A.menuInput("options");
  assert(!!g.menu.modal, "H: an unhandled action does not dismiss the dialog");
  assert(g.menu.screen === before.screen && g.menu.index === before.index && g.paused === before.paused,
    "H: ...and does not reach the screen beneath either");
})();

// ================= (I) a live rebinding capture still out-ranks a dialog =====================
(function sectionI() {
  console.log("(I) the rebinding guard stays FIRST — capture out-ranks an open dialog");
  const A = build();
  const g = A.game;

  // Source-order check: in menuInput's body, the rebinding early-return precedes the modal branch.
  const body = scriptSrc.match(/function menuInput\(action\)\s*\{[\s\S]*?\n\}/);
  assert(!!body, "I: located menuInput's body in the source");
  if (body) {
    const iRebind = body[0].indexOf("game.menu.rebinding");
    const iModal = body[0].indexOf("game.menu.modal");
    const iSwitch = body[0].indexOf("switch (game.menu.screen)");
    assert(iRebind >= 0 && iModal >= 0 && iSwitch >= 0, "I: menuInput contains both guards and the screen switch");
    assert(iRebind < iModal, "I: the rebinding guard comes BEFORE the modal guard");
    assert(iModal < iSwitch, "I: the modal guard comes BEFORE the screen switch (no per-screen handler sees it)");
  }

  // Behavioural check: with BOTH modes live, nothing at all moves.
  let ran = 0;
  A.atControlsDefaults();
  A.openModal("t", "GO", () => ran++);
  g.menu.rebinding = { action: A.REBINDABLE[0], device: "key" };
  const idx0 = g.menu.modal.index, row0 = g.menu.row;
  for (const a of ["down", "up", "left", "right", "confirm", "back", "pause"]) A.menuInput(a);
  assert(!!g.menu.modal, "I: capture mode swallowed everything — the dialog is still open");
  assert(g.menu.modal.index === idx0, "I: ...its cursor never moved");
  assert(ran === 0, "I: ...its callback never ran");
  assert(g.menu.row === row0 && g.menu.screen === "controls", "I: ...and the screen beneath is untouched too");

  // Clear capture and the dialog wakes up again, proving the presses were swallowed and not queued.
  g.menu.rebinding = null;
  A.menuInput("down");
  assert(g.menu.modal.index === 1 - idx0, "I: with capture cleared, the dialog takes input again (nothing was queued)");

  // Real capture, driven through startRebind + the real keydown listener: the captured key must land
  // in the binding, not in the dialog.
  A.atControlsDefaults();
  A.openModal("t", "GO", () => {});
  A.startRebind(A.REBINDABLE[0], "key");
  A.keydown("j");
  assert(A.bindings[A.REBINDABLE[0]].keys.join() === "j", "I: the captured key went into the BINDING");
  assert(g.menu.rebinding === null, "I: ...capture cleared after one key");
  assert(!!g.menu.modal && g.menu.modal.index === 1, "I: ...and the dialog is untouched underneath, still on CANCEL");
  A.returnToDefaults();
})();

// ================= (J) clear sites + render smoke + AudioSys.ctx null =====================
(function sectionJ() {
  console.log("(J) modal clear sites; drawMenu renders with a dialog open; ctx-null smoke");
  const A = build();
  const g = A.game;
  const openOne = () => A.openModal("t", "GO", () => {});

  // Every menu-state reset clears it. (The three rebinding-capture teardowns — captureKeyRebind /
  // capturePadRebind / the keydown Esc cancel — deliberately do NOT, being capture-specific.)
  const sites = [
    ["gotoScreen", () => { openOne(); A.gotoScreen("options"); }],
    ["closePause", () => { A.startGame(); A.openPause(); openOne(); A.closePause(); }],
    ["startGame", () => { A.startGame(); A.openPause(); openOne(); A.startGame(); }],
    ["quitToTitle", () => { A.startGame(); A.openPause(); openOne(); A.quitToTitle(); }],
    ["openPause", () => { A.startGame(); openOne(); A.openPause(); }],
    ["openDebug", () => { A.quitToTitle(); openOne(); A.openDebug(); }],
    ["returnToTitleMenu", () => { A.quitToTitle(); A.openPause(); openOne(); A.returnToTitleMenu(); }]
  ];
  for (const [name, drive] of sites) {
    drive();
    assert(g.menu.modal === null, `J: ${name}() clears game.menu.modal`);
  }
  // ...and closePause's title-aware delegation still lands on the title menu with no dialog.
  A.quitToTitle(); A.openPause(); openOne(); A.closePause();
  assert(g.menu.screen === "titlemenu" && g.menu.modal === null,
    "J: closePause from a title-context screen still lands on the title menu, dialog cleared (CS016 P2 invariant held)");

  // RENDER: drawMenu with a dialog open on every screen that can raise one, plus the gameover root
  // (which cannot raise one itself, but must still render if a dialog is ever forced over it).
  const screens = [
    ["root (playing)", () => A.atMidRunQuit()],
    ["controls", () => A.atControlsDefaults()],
    ["root (gameover)", () => { A.startGame(); g.state = "gameover"; g.paused = false; g.menu.screen = null; A.openPause(); }]
  ];
  for (const [name, drive] of screens) {
    drive(); openOne();
    let threw = null, log = [];
    try { log = A.render(A.draw); } catch (e) { threw = e; }
    assert(!threw, `J: draw() with a dialog over ${name} does not throw${threw ? ": " + threw.stack : ""}`);
    assert(log.some(e => e.c === "fillText" && e.str.includes("GO")), `J: ...and the dialog's confirm row is on screen over ${name}`);
    assert(log.some(e => e.c === "fillText" && e.str === A.MODAL_TITLE), `J: ...with the ${A.MODAL_TITLE} panel title`);
  }
  // drawModal itself is a no-op when nothing is open (drawMenu calls it unconditionally).
  A.atMidRunQuit();
  assert(g.menu.modal === null, "J: (precondition) no dialog open");
  assert(A.render(A.drawModal).length === 0, "J: drawModal() draws nothing at all when no dialog is open");

  // ctx-null smoke: the whole open/cancel/confirm cycle with no AudioContext.
  const B = build({ audio: false });
  assert(B.AudioSys.ctx === null, "J: sanity — no AudioContext stub means AudioSys.ctx is null");
  let threw = null;
  try {
    B.startGame();
    for (let i = 0; i < 30; i++) B.update(1 / 60);
    // Return to Defaults: open, nav, cancel, reopen, confirm — with a draw at each step.
    B.atControlsDefaults();
    B.menuInput("confirm"); B.draw();
    B.menuInput("down"); B.menuInput("up"); B.draw();
    B.menuInput("back"); B.draw();
    B.menuInput("confirm"); B.menuInput("up"); B.menuInput("confirm"); B.draw();
    // Mid-run Quit: open, cancel by pause, reopen, confirm.
    B.atMidRunQuit();
    B.menuInput("confirm"); B.draw();
    B.menuInput("pause"); B.draw();
    B.menuInput("confirm"); B.menuInput("left"); B.menuInput("confirm"); B.draw();
    B.update(1 / 60); B.draw();
  } catch (e) { threw = e; }
  assert(!threw, "J: no throw across the full open/cancel/confirm cycle with AudioSys.ctx null" + (threw ? ": " + threw.stack : ""));
  assert(B.game.state === "title" && B.game.menu.screen === "titlemenu", "J: ...and the ctx-null run ended on the title menu");
})();

// ================= (K) RENDER detail: measured width, rows, footer, paint order =====================
(function sectionK() {
  console.log("(K) drawModal: measured self-healing width, the two rows, the footer, painted LAST");
  const A = build();
  const g = A.game;
  const cx = A.VIEW_W / 2;
  const at = (log, x, y) => log.filter(e => e.c === "fillText" && e.x === x && e.y === y);
  const fontSize = e => parseInt(e.font, 10);
  // The dialog's own box is the LAST strokeRect in the log (menuPanel strokes; drawModal runs last).
  const dialogBox = log => [...log].reverse().find(e => e.c === "strokeRect");
  // ...and everything the dialog itself drew is what follows that stroke. Needed because the modal
  // panel and the root panel are the same height and both centred, so menuPanel's title baseline
  // (y+46) and the hint baseline (y+272) coincide between them — the slice disambiguates whose is
  // whose instead of the test guessing.
  const dialogOnly = (log) => {
    let last = -1;
    log.forEach((e, i) => { if (e.c === "strokeRect") last = i; });
    return last < 0 ? [] : log.slice(last);
  };

  A.atMidRunQuit();
  A.menuInput("confirm");
  const md = g.menu.modal;
  let log = A.render(A.draw);
  const box = dialogBox(log);
  assert(!!box, "K: the dialog stroked a menuPanel box");
  const py = box ? box.y : 0;

  // Panel geometry: the shared 300px height, horizontally centred.
  assert(box && box.h === A.MODAL_H, `K: the box is MODAL_H (${A.MODAL_H}) tall; got ${box && box.h}`);
  assert(box && Math.abs(box.x - (A.VIEW_W - box.w) / 2) < 1e-9, "K: ...and horizontally centred");
  assert(box && Math.abs(py - (A.VIEW_H - A.MODAL_H) / 2) < 1e-9, "K: ...and vertically centred");

  // Prompt line.
  const prompt = at(log, cx, py + A.MODAL_TEXT_Y);
  assert(prompt.length === 1, "K: exactly one prompt fillText at MODAL_TEXT_Y");
  assert(prompt.length === 1 && prompt[0].str === md.text, "K: ...carrying the caller's text verbatim");
  assert(prompt.length === 1 && prompt[0].color === A.COLOR.text, "K: ...in COLOR.text");
  assert(prompt.length === 1 && fontSize(prompt[0]) === A.MODAL_TEXT_SIZE, "K: ...at MODAL_TEXT_SIZE");

  // Two choice rows, in the shared "▶ "/COLOR.text/COLOR.menuIdle convention. Cancel is selected.
  [md.confirmLabel, md.cancelLabel].forEach((label, i) => {
    const rows = at(log, cx, py + A.MODAL_ROW_Y + i * A.MODAL_ROW_STEP);
    assert(rows.length === 1, `K: exactly one fillText for the "${label}" row`);
    if (!rows.length) return;
    const sel = i === md.index;
    assert(rows[0].str === (sel ? "▶ " : "   ") + label, `K: "${label}" uses the shared "▶ " selection prefix`);
    assert(rows[0].color === (sel ? A.COLOR.text : A.COLOR.menuIdle),
      `K: "${label}" draws in ${sel ? "COLOR.text" : "COLOR.menuIdle"}`);
    assert(fontSize(rows[0]) === A.MODAL_ROW_SIZE, `K: "${label}" draws at MODAL_ROW_SIZE`);
  });
  assert(md.index === 1, "K: (and the row drawn as selected is CANCEL, the safe one)");

  // The panel title, and the footer routed through drawMenuHint (not a fresh drawText literal). Both
  // are read off the dialog's own slice of the log — see dialogOnly above.
  const dlog = dialogOnly(log);
  const title = at(dlog, cx, py + 46);
  assert(title.length === 1 && title[0].str === A.MODAL_TITLE, "K: menuPanel drew the MODAL_TITLE heading");
  const hint = at(dlog, cx, py + A.MODAL_HINT_Y);
  assert(hint.length === 1 && hint[0].str === A.MODAL_HINT, "K: one control-hint footer, the MODAL_HINT text");
  assert(hint.length === 1 && hint[0].color === A.COLOR.menuIdle && fontSize(hint[0]) === A.MENU_HINT_SIZE,
    "K: ...routed through drawMenuHint (COLOR.menuIdle at MENU_HINT_SIZE)");

  // Cursor movement re-renders with the other row selected.
  A.menuInput("up");
  log = A.render(A.draw);
  const confRow = at(log, cx, py + A.MODAL_ROW_Y);
  assert(confRow.length === 1 && confRow[0].str === "▶ " + md.confirmLabel && confRow[0].color === A.COLOR.text,
    "K: moving the cursor re-renders the confirm row as selected");
  A.menuInput("back");

  // PAINT ORDER: the dialog's box must come AFTER the underlying screen's box in the draw log, or it
  // would be painted under the panel that raised it.
  A.atControlsDefaults();
  const under = A.render(A.draw).filter(e => e.c === "strokeRect").length;
  A.menuInput("confirm");
  const over = A.render(A.draw);
  const strokes = over.filter(e => e.c === "strokeRect");
  assert(strokes.length === under + 1, `K: opening the dialog adds exactly one more panel box (${under} -> ${strokes.length})`);
  const lastFill = [...over].map((e, i) => ({ e, i })).filter(o => o.e.c === "fillText").pop();
  assert(lastFill && lastFill.e.str === A.MODAL_HINT, "K: the dialog's footer is the LAST text drawn — nothing paints over it");
  const boxIdx = over.findIndex(e => e === strokes[strokes.length - 1]);
  const ctlIdx = over.findIndex(e => e.c === "strokeRect");
  assert(boxIdx > ctlIdx, "K: the dialog's box is stroked after the Controls panel's — it paints OVER, not under");

  // SELF-HEALING WIDTH: the panel measures the prompt, so a longer prompt widens the box instead of
  // bleeding through the border (the CS015 P1 precedent). Never a hardcoded width.
  const widthFor = text => {
    A.atMidRunQuit();
    A.openModal(text, "GO", () => {});
    return dialogBox(A.render(A.draw)).w;
  };
  const wShort = widthFor("Y?");
  const wLong = widthFor("Y?" + "x".repeat(200));
  assert(wLong > wShort, `K: a longer prompt produces a wider panel (${wShort} -> ${wLong})`);
  assert(wShort >= A.MODAL_MIN_W, `K: a tiny prompt still gets at least MODAL_MIN_W (${A.MODAL_MIN_W}); got ${wShort}`);
  // At the floor the box is exactly MODAL_MIN_W or the hint's measured width — never narrower than
  // the hint it has to contain.
  A.atMidRunQuit(); A.openModal("Y?", "GO", () => {});
  const recCtxFont = A.MENU_HINT_SIZE * 0.6 * A.MODAL_HINT.length;   // the recording ctx's measureText model
  assert(wShort >= Math.ceil(recCtxFont) + 2 * A.MODAL_MARGIN || wShort === A.MODAL_MIN_W,
    "K: the floor width still contains the measured hint plus both margins");
  // Both consumers' real prompts fit inside their own boxes with the margin intact.
  for (const [text] of [["Reset all controls to defaults?"], ["Quit to title? Progress in this run will be lost."]]) {
    A.atMidRunQuit(); A.openModal(text, "GO", () => {});
    const b = dialogBox(A.render(A.draw));
    const measured = Math.ceil(A.MODAL_TEXT_SIZE * 0.6 * text.length);
    assert(b.w >= measured + 2 * A.MODAL_MARGIN, `K: "${text.slice(0, 24)}…" fits its box with both margins (${b.w} >= ${measured + 2 * A.MODAL_MARGIN})`);
  }
  assert(!/menuPanel\(\s*\d+\s*,\s*MODAL_H/.test(scriptSrc), "K: drawModal passes no hardcoded numeric width to menuPanel");
})();

console.log(`\ntest-cs016-p3: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
