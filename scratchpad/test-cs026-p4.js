// Headless test for CS026 Phase 4 — DELIVERY FEEDBACK: SPREAD THE FLOATERS, DROP COMBO, QUIET INCIDENTALS.
//
//   node scratchpad/test-cs026-p4.js
//
// WHY (archive/PLANNED-FEATURES-CS026.md §3). DOCK_OFFLOAD_INTERVAL is 0.05s (20 canisters/sec) but FloatText
// has always risen 30px/s and lived 1.1s, so consecutive delivery floaters were born 1.5px apart — a
// twelve-canister haul stacked twelve of them inside a 33px band. Nothing was ever removed (the escalating
// +50/+75/+100 floater still fires every delivery); the information was simply unreadable.
//
// WHAT LANDED — three things, no more:
//   1. FloatText gains optional trailing `rise`/`life` params (def 30/1.1, today's values). draw()'s alpha
//      divides by `this.life0` (the CONSTRUCTED life), not the literal 1.1 — the documented trap: get this
//      wrong and a short-lived floater never reaches full opacity.
//   2. Two new DELIVERY registry knobs, right after dockComboGrace: deliveryFloatRise (px/s, def 300,
//      30-600, step 10) and deliveryFloatLife (s, def 0.55, 0.2-2.0, step 0.05). Registry 79 -> 81. Both
//      delivery push sites (towed and incidental) read them live off DEBUG.
//   3. The incidental branch is QUIETED, not folded in: same text/position, COLOR.dim + size 12, same new
//      rise/life so it separates too — but it must never share a tally or colour with the towed branch
//      (CS020 P1's whole point was separating them). The CS021 P4 HUD `COMBO n/24` readout (closing
//      FLAG-CS020-i's READOUT, not its underlying claim) is removed outright, on the bet that legible dock
//      feedback carries delivery legibility better than a duplicate HUD line.
//
// ⛔ THE OFFLOAD BLOCK'S LOGIC DOES NOT MOVE. deliveryCount, the towed/incidental test, the 8/12/16/20
// reward tiers, Heavy Hauler, Maxed Out, and the Super Mega Delivery trigger all behave exactly as they do
// today — this phase changes how a delivery LOOKS, nothing about what it PAYS. AudioSys.deliver() is
// untouched. Section (E) drives a full 24-canister visit through the REAL offload block and checks every
// one of those latches fires exactly as before, alongside the new floater properties.
//
// Follows the standing rule (CLAUDE.md): stub window/document/rAF/navigator/localStorage, eval the REAL
// <script> block, and drive the ACTUAL startGame/nextWave/update/dock-offload paths. Nothing under test is
// reimplemented. Chain nodes are seeded directly as plain objects (the standing exception to the
// entity-lifecycle contract — CLAUDE.md, "Entity lifecycle"), exactly as test-cs026-p3.js §E does.
//
// Sections:
//  (A) node --check; FloatText's constructor/update/draw source pins (rise/life trailing+optional,
//      life0 stored and read by draw(), the two delivery sites reading the new DEBUG knobs, the other 8
//      pre-existing call sites left byte-identical / untouched).
//  (B) the registry: dockComboGrace -> deliveryFloatRise -> deliveryFloatLife, in order; ranges; DEBUG_
//      ENTRIES 79 -> 81; live values seed from def; driven through applyDebug like every other row.
//  (C) FloatText behaviour: default construction is byte-identical to the parent (rise 30, life 1.1); a
//      non-default life reaches alpha 1.0 at birth (⛔ THE TRAP in item 1) rather than a fraction of it;
//      rise moves `y` at the constructed rate, not the old hardcoded 30.
//  (D) HUD_COMBO_X/Y/SIZE and the `game.deliveryCount > 0` block are gone from drawHUD()'s executable
//      source (comments stripped, so the removal-explaining comment doesn't false-positive the pin).
//  (E) ⛔ A FULL 24-CANISTER VISIT DRIVEN FOR REAL through the actual dock-offload block: every latch
//      (deliveryCount, stats, the 8/12/16/20 tiers, Heavy Hauler, Maxed Out, the SMD trigger) fires exactly
//      as the parent's did; the towed floater's colour/size/rise/life vs. the incidental's; the measured
//      spacing between two real, live, born-apart floaters at the shipped knobs; SALVAGE BONUS / MAX HAUL
//      untouched (still default rise/life — deconfliction, spec §3.6).
//  (F) TRAPs: GAME_VERSION unmoved; LEVERS/leverState byte-identical to the parent; no design doc touched;
//      scope pin (asteroids-deluxe.html + STATUS.md + scratchpad/ only) — against this phase's own parent
//      SHA via _phase-ref.js, loudly skipped when git history is unavailable (FORK-CS026-H).
//  (G) AudioSys.ctx === null smoke: a real 24-canister visit through update()/draw(), no throw.

"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const { parentSource, ownCommits, changedFiles, outsideScope, SKIP_TAG } = require("./_phase-ref.js");

const repoRoot = path.join(__dirname, "..");
const htmlPath = path.join(repoRoot, "orbital-overhaul.html");
const html = fs.readFileSync(htmlPath, "utf8");
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error("Could not find <script> block"); process.exit(1); }
const scriptSrc = m[1];

// ⛔ THIS PHASE'S OWN PARENT COMMIT, PINNED AS A LITERAL (§4.1) — CS026 P3's own commit, not HEAD.
const PARENT_SHA = "799bdf43a8a96d13ccc14c8bb5d1ec180132da62";   // cs-26 p3
const PHASE_SUBJECT = "cs-26 p4:";

let passed = 0, failed = 0, skipped = 0;
function assert(cond, msg) { if (cond) passed++; else { failed++; console.error("  FAIL: " + msg); } }
function eq(got, want, msg) { assert(got === want, `${msg} (got ${JSON.stringify(got)}, want ${JSON.stringify(want)})`); }
function close(got, want, msg, tol = 1e-9) { assert(Math.abs(got - want) <= tol, `${msg} (got ${got}, want ${want})`); }
function skip(what) { skipped++; console.log(`  ${SKIP_TAG}: ${what}`); }

const stripComments = s => s.replace(/\/\/[^\n]*/g, "");
const codeSrc = stripComments(scriptSrc);

// ---- Headless environment (the standing stub idiom) ----
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
  "game", "startGame", "nextWave", "update", "draw",
  "DEBUG", "debugShown", "DEBUG_VARS", "DEBUG_ENTRIES", "DEBUG_ROWS", "DEBUG_OVERRIDE_ID", "applyDebug",
  "LEVERS", "leverState",
  "FloatText", "COLOR", "POWERUP_COLOR",
  "DOCK_BASE_SCORE", "DOCK_BONUS_STEP", "DOCK_OFFLOAD_INTERVAL", "DOCK_NEIGHBORHOOD_PAD",
  "CARGO_CAP_MAX", "CHAIN_LINK", "SHIP_MAX_HP",
  "AudioSys", "Achievements", "GAME_VERSION",
];
const SPIES = [
  "__spySMD(fn) { const o = superMegaDelivery; superMegaDelivery = fn; return o; }",
];
function buildFrom(src, { exportList = RETURN } = {}) {
  const c = makeCtxStub();
  const canvasStub = { width: 1280, height: 720, style: {}, getContext: () => c };
  const documentStub = { getElementById: () => canvasStub, createElement: () => canvasStub };
  const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720 };
  const s = {};
  const localStorageStub = {
    getItem: k => (k in s ? s[k] : null),
    setItem: (k, v) => { s[k] = String(v); },
    removeItem: k => { delete s[k]; }
  };
  const factory = new Function(
    "window", "document", "performance", "requestAnimationFrame", "navigator", "localStorage",
    src + "\n;return { " + exportList.join(", ") + ", " + SPIES.join(", ") + " };");
  return factory(windowStub, documentStub, { now: () => 100000 }, () => 0,
    { getGamepads: () => [] }, localStorageStub);
}
const build = opts => buildFrom(scriptSrc, opts);

// ================= (A) node --check + FloatText source pins =====================
let X = null;
(function sectionA() {
  console.log("(A) node --check; FloatText's constructor/update/draw source pins");
  const tmp = path.join(__dirname, "_cs026p4_extracted.js");
  fs.writeFileSync(tmp, scriptSrc);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); passed++; }
  catch (e) { failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  try { X = build(); passed++; } catch (e) { failed++; console.error("  FAIL: A: the build evaluates — " + e.message); }
  if (!X) { console.error("ABORT: build failed"); process.exit(1); }

  // -- the constructor: trailing, optional, defaulted to today's values --
  // REPOINTED BY CS034 P8 (spec §3.5): a further trailing optional `fade = life` was added after
  // this phase's own rise/life pair. P4's claim (rise/life trailing+optional) still holds; the
  // signature now carries one more param, same pattern.
  assert(/constructor\(text, x, y, color, size = 16, rise = 30, life = 1\.1, fade = life\) \{/.test(scriptSrc),
    "A: FloatText's constructor signature adds rise=30, life=1.1, both trailing and optional");
  const ftBody = scriptSrc.slice(scriptSrc.indexOf("class FloatText {"), scriptSrc.indexOf("class Dock {"));
  assert(/this\.rise = rise; this\.life = life; this\.life0 = life;/.test(ftBody),
    "A: the constructed life is ALSO stored as this.life0 — the trap in item 1 is about what draw() divides by");
  assert(/this\.y -= this\.rise \* dt;/.test(ftBody), "A: update() reads this.rise, not a hardcoded 30");
  assert(!/this\.y -= 30 \* dt;/.test(ftBody), "A: ⛔ ...and the old hardcoded `30 * dt` is gone");
  // REPOINTED BY CS034 P8 (spec §3.5): draw()'s alpha formula changed from `max(0, life/life0)` to
  // `max(0, min(1, life/fade))` — byte-identical when fade === life0 (P4's own trap still holds,
  // restated against `fade` instead of `life0`), with a new min(1, ...) clamp for fade < life0.
  assert(/Math\.max\(0, Math\.min\(1, this\.life \/ this\.fade\)\)/.test(ftBody),
    "A: ⛔ THE TRAP — draw()'s alpha divides by this.fade (defaults to the constructed life), not a literal");
  assert(!/this\.life \/ 1\.1/.test(ftBody), "A: ...and the old literal 1.1 divisor is gone");

  // -- the two delivery push sites read the live DEBUG knobs --
  // REPOINTED BY CS034 P8 (spec §3.5): deliveryFloatLife is retired; both sites now read
  // deliveryFloatRise plus the hold+fade pair. The "exactly two sites" claim moves to that shape.
  eq((codeSrc.match(/DEBUG\.deliveryFloatRise,\s*\n\s*DEBUG\.deliveryFloatHold \+ DEBUG\.deliveryFloatFade, DEBUG\.deliveryFloatFade/g) || []).length, 2,
    "A: exactly TWO push sites read DEBUG.deliveryFloatRise plus the hold+fade pair — the towed and incidental branches");
  // ⛔ REPOINTED BY CS026 P6 (gate Q5), THEN AGAIN BY CS029 P4 (§0.3/§6.1/§6.3, model C), THEN AGAIN BY
  // CS034 P8 (spec §3.5). The origin moved from `node.x, node.y` (the popped node) to the ship (P6),
  // then to a static dock anchor (P4) shared as `deliveryAnchorX`/`deliveryAnchorY`. P8 replaced the
  // single deliveryFloatLife arg with the hold+fade pair and, on the towed branch, the hardcoded size
  // 16 with the live deliveryFloatSize knob. The incidental branch's colour/size claims (COLOR.dim,
  // size 12) are UNCHANGED. The towed branch's push site itself changed shape — it now creates the
  // model-C ticker on the FIRST towed canister of a visit; that shape is asserted in
  // test-cs029-p4.js/test-cs034-p8.js, not here.
  assert(/game\.deliveryTicker = new FloatText\("\+" \+ pts, deliveryAnchorX, deliveryAnchorY,\s*\n\s*COLOR\.dock, DEBUG\.deliveryFloatSize, DEBUG\.deliveryFloatRise,\s*\n\s*DEBUG\.deliveryFloatHold \+ DEBUG\.deliveryFloatFade, DEBUG\.deliveryFloatFade\);/.test(scriptSrc),
    "A: the TOWED branch's ticker reads deliveryFloatSize (P8) and the live rise/hold/fade knobs, and is born at the dock anchor");
  assert(/new FloatText\("\+" \+ DOCK_BASE_SCORE, deliveryAnchorX, deliveryAnchorY,\s*\n\s*COLOR\.dim, 12, DEBUG\.deliveryFloatRise,\s*\n\s*DEBUG\.deliveryFloatHold \+ DEBUG\.deliveryFloatFade, DEBUG\.deliveryFloatFade\)/.test(scriptSrc),
    "A: ⛔ the INCIDENTAL branch is QUIETED (COLOR.dim, size 12), not folded into the towed tally/colour — same dock anchor origin");

  // -- every other FloatText call site is untouched: total call sites vs. sites naming the new knobs --
  const totalSites = (codeSrc.match(/new FloatText\(/g) || []).length;
  const knobSites = (codeSrc.match(/DEBUG\.deliveryFloatRise/g) || []).length;
  eq(totalSites, 10, "A: (setup) ten FloatText call sites exist in the source");
  eq(knobSites, 2, "A: ...exactly two of them were touched by this phase");
  eq(totalSites - knobSites, 8, "A: ⛔ ...and the other eight are byte-identical to the parent (CS012 P3's own trailing-optional precedent)");
})();

// ================= (B) the registry =====================
(function sectionB() {
  console.log("(B) deliveryFloatRise: registry order, ranges, live values (deliveryFloatLife retired by CS034 P8)");
  const iGrace = X.DEBUG_VARS.findIndex(v => v.id === "dockComboGrace");
  const iRise = X.DEBUG_VARS.findIndex(v => v.id === "deliveryFloatRise");
  assert(iGrace >= 0 && iRise === iGrace + 1,
    "B: deliveryFloatRise immediately follows dockComboGrace");

  const rise = X.DEBUG_VARS[iRise];
  eq(rise.label, "Delivery floater rise", "B: deliveryFloatRise label");
  eq(rise.unit, "px/s", "B: deliveryFloatRise unit");
  // ⛔ REPOINTED BY CS026 P6 (gate Q5), THEN AGAIN BY CS034 P8 (GATE A). P4 SHIPPED THESE AS FIRST
  // GUESSES SPECIFICALLY SO THE GATE COULD SETTLE THEM — its own comment said so — so the gate
  // moving them is this phase working as designed, not a regression. P6: "the score numbers need to
  // fade more slowly, and they need to travel upwards more slowly" (300 -> 160). P8's GATE A
  // re-settled rise to 200 against the larger, growing ticker.
  eq(rise.def, 200, "B: deliveryFloatRise def 200 (P4 shipped 300, P6 settled 160; CS034 P8's GATE A re-settled it)");
  eq(rise.min, 30, "B: deliveryFloatRise min 30");
  eq(rise.max, 600, "B: deliveryFloatRise max 600");
  eq(rise.step, 10, "B: deliveryFloatRise step 10");
  assert(!rise.toNative, "B: no toNative hook — shown value is native");

  // REPOINTED BY CS034 P8 (spec §3.5): deliveryFloatLife is retired outright — its two readers moved
  // to the deliveryFloatHold/deliveryFloatFade pair, tested in test-cs034-p8.js. P4's own claim about
  // it shipping alongside rise no longer has a subject; assert the retirement instead.
  assert(!X.DEBUG_VARS.some(v => v.id === "deliveryFloatLife"),
    "B: ⛔ deliveryFloatLife (P4's own row) no longer exists — retired by CS034 P8");
  eq(X.DEBUG.deliveryFloatLife, undefined, "B: ...and DEBUG.deliveryFloatLife is undefined");

  eq(X.DEBUG.deliveryFloatRise, 200, "B: the live value seeds from def (rise)");
  eq(X.DEBUG_ROWS.length, X.DEBUG_VARS.length + 4,
    "B: DEBUG_ROWS is still registry + Dump + Reset All + Reset Scores + Back");

  // Live through the real panel path.
  const A = build();
  A.applyDebug("deliveryFloatRise", 500);
  eq(A.DEBUG.deliveryFloatRise, 500, "B: applyDebug writes deliveryFloatRise live");
  A.applyDebug(A.DEBUG_OVERRIDE_ID, 0);
  eq(A.DEBUG.deliveryFloatRise, 200, "B: overrides OFF derives from def, like every other row");
  eq(A.debugShown.deliveryFloatRise, 500, "B: ...without discarding the edit");
})();

// ================= (C) FloatText behaviour =====================
(function sectionC() {
  console.log("(C) FloatText: default construction unchanged; the alpha trap; rise honoured");

  // Default construction — byte-identical to the parent's behaviour.
  const f0 = new X.FloatText("+50", 100, 100, X.COLOR.dock);
  eq(f0.rise, 30, "C: default rise is still 30");
  eq(f0.life, 1.1, "C: default life is still 1.1");
  eq(f0.life0, 1.1, "C: ...and life0 agrees");
  f0.update(1 / 60);
  close(f0.y, 100 - 30 / 60, "C: default rise moves y at 30px/s", 1e-9);
  close(Math.max(0, f0.life / f0.life0), Math.max(0, (1.1 - 1 / 60) / 1.1), "C: default alpha arithmetic unchanged");

  // ⛔ THE TRAP — a non-default (short) life must still reach FULL opacity at birth, not a fraction of it.
  const fShort = new X.FloatText("+50", 100, 100, X.COLOR.dock, 16, 300, 0.2);
  const alphaAtBirth = Math.max(0, fShort.life / fShort.life0);
  eq(alphaAtBirth, 1, "C: ⛔ a short-life floater (life=0.2) reaches alpha 1.0 at birth — the divisor is life0, not 1.1");
  fShort.update(1 / 60);
  assert(Math.max(0, fShort.life / fShort.life0) < 1 && Math.max(0, fShort.life / fShort.life0) > 0.9,
    "C: ...and fades gradually from there, at its OWN life's pace");
  // The old-literal mutant this trap exists to catch: dividing 0.2's remaining life by 1.1 would start
  // near 0.18 alpha instead of 1.0 — stated explicitly so a future reader sees what "the trap" catches.
  assert(Math.abs(0.2 / 1.1 - 1) > 0.5, "C: (control) the old-literal mutant would have started near 0.18 alpha, not 1.0");

  // rise is honoured at the constructed rate, not the old hardcoded 30.
  const fFast = new X.FloatText("+50", 100, 100, X.COLOR.dock, 16, 300, 0.55);
  fFast.update(1 / 60);
  close(fFast.y, 100 - 300 / 60, "C: a custom rise (300) moves y at 300px/s, not 30", 1e-9);

  // life expiry still works with a custom life.
  const fExpire = new X.FloatText("+50", 0, 0, X.COLOR.dock, 16, 300, 0.05);
  fExpire.update(0.05 + 1e-6);
  assert(fExpire.dead, "C: a custom-life floater still dies when its life runs out");
})();

// ================= (D) the COMBO readout is gone =====================
(function sectionD() {
  console.log("(D) HUD_COMBO_X/Y/SIZE and drawHUD()'s deliveryCount block are gone");
  eq((codeSrc.match(/HUD_COMBO_X|HUD_COMBO_Y|HUD_COMBO_SIZE/g) || []).length, 0,
    "D: ⛔ none of the three HUD_COMBO_* constants remain in executable source (comments stripped)");
  const hudBody = codeSrc.slice(codeSrc.indexOf("function drawHUD() {"));
  const hudEnd = hudBody.indexOf("\nfunction ", 1);
  const hud = hudBody.slice(0, hudEnd > 0 ? hudEnd : undefined);
  assert(!/deliveryCount/.test(hud), "D: ⛔ drawHUD()'s executable source no longer reads game.deliveryCount at all");
  assert(!/COMBO /.test(hud), "D: ...and no longer draws a \"COMBO \" label");
})();

// ================= (E) a full 24-canister visit, driven for real =====================
(function sectionE() {
  console.log("(E) ⛔ a full 24-canister visit through the REAL offload block: latches, colours, spacing");
  const A = build();
  A.startGame();
  while (A.game.wave < 12) { A.game.debris.length = 0; A.game.hunters.length = 0; A.nextWave(); }
  eq(A.game.wave, 12, "E: (setup) reached level 12 for real");
  eq(A.game.cargoMax, 24, "E: (setup) level 12's payload cap is 24");

  const g = A.game;
  g.state = "playing"; g.paused = false;
  g.ship.dead = false; g.ship.hp = A.SHIP_MAX_HP; g.ship.vx = 0; g.ship.vy = 0;
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
  // Ship dead centre of the dock — always inside dock.radius+10 (nearDock) and dock.radius+40 (the grace
  // ring), so comboGrace stays armed and every pop is a real offload-block tick.
  g.ship.x = g.dock.x; g.ship.y = g.dock.y;
  g.comboGrace = A.DEBUG.dockComboGrace;
  g.deliveryCount = 0; g.offloadTimer = 0;

  // Twenty-four TOWED nodes, all at the SAME y (colinear behind the ship) so the birth-position gap
  // between two consecutive floaters is due to time alone — isolating the rise separation this phase
  // exists to create, rather than pre-existing chain sag. Then ONE incidental node on top (pops FIRST,
  // since it is pushed last and the offload block pops from the array's tail).
  g.chain.length = 0;
  for (let i = 0; i < 24; i++) {
    g.chain.push({ x: g.ship.x - (i + 1) * A.CHAIN_LINK, y: g.ship.y, px: g.ship.x - (i + 1) * A.CHAIN_LINK - 1, py: g.ship.y,
      spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  g.chain.push({ x: g.ship.x - 25 * A.CHAIN_LINK, y: g.ship.y, px: g.ship.x - 25 * A.CHAIN_LINK, py: g.ship.y,
    spin: 0, spinRate: 0, mass: 1, towed: false });
  eq(g.chain.length, 25, "E: (setup) 24 towed + 1 incidental, seeded directly as plain objects");

  let smd = 0;
  A.__spySMD(() => { smd++; });
  const score0 = g.score;

  // Drive real frames, capturing every floater PUSH event by intercepting Array#push on this instance —
  // an array-length DIFF would miss pushes once expiry starts removing entries mid-run (24 floaters at
  // 3-frame spacing and a 33-frame life means additions and removals interleave well before the visit
  // ends), so the capture has to see the actual push() calls, not infer them from length deltas.
  // ⛔ update()'s own end-of-frame cleanup pass REASSIGNS `game.floaters` to a brand-new filtered array
  // every frame (the standing dead-flag-plus-filter contract, CLAUDE.md "Entity lifecycle") — which
  // silently drops an own-property override set only once. The interceptor is therefore reinstalled on
  // `g.floaters` at the top of every iteration, immediately before that frame's update() call.
  const pushes = [];
  let curFrame = -1;
  const interceptor = function (...items) {
    for (const it of items) pushes.push({ frame: curFrame, obj: it });
    return Array.prototype.push.apply(this, items);
  };
  for (let f = 0; f < 400 && g.chain.length > 0; f++) {
    curFrame = f;
    g.floaters.push = interceptor;
    A.update(1 / 60);
  }
  eq(g.chain.length, 0, "E: (setup) the whole chain — all 25 nodes — was offloaded within the frame budget");
  eq(g.deliveryCount, 24, "E: ⛔ deliveryCount reaches 24 — the incidental never joined the towed tally");
  eq(g.stats.delivered, 24, "E: ...only the 24 towed pieces counted as delivered");
  eq(g.stats.bestCombo, 24, "E: ...bestCombo reaches 24");
  eq(g.stats.maxChainVisit, true, "E: ...Maxed Out's per-visit flag latches");
  eq(g.stats.fullChainVisit, true, "E: ...Heavy Hauler's per-visit flag latches (deliveryCount passed through 12)");
  eq(smd, 1, "E: ⛔ the Super Mega Delivery fires exactly once — the trigger is untouched");

  // The pts formula (unchanged) — checked from the constants, not hardcoded, so a future retune of
  // DOCK_BASE_SCORE/DOCK_BONUS_STEP does not make this pin stale for the wrong reason.
  let expectedGain = 0;
  for (let n = 1; n <= 24; n++) expectedGain += A.DOCK_BASE_SCORE + A.DOCK_BONUS_STEP * (n - 1);
  expectedGain += A.DOCK_BASE_SCORE; // the one incidental
  eq(g.score - score0, expectedGain, "E: ⛔ the score gain matches the UNCHANGED pts formula for 24 towed + 1 incidental");

  // -- the floaters --
  // ⛔ RESHAPED BY CS029 P4 (model C, gate G1/§6.3). P4/P6's claim here was about a per-canister
  // floater stream — 24 individual pushes, measured apart by rise x cadence. That stream no longer
  // exists: the towed branch now creates ONE ticker object on the first canister and mutates its
  // `.text` in place for the other 23, so exactly one push() call happens for the whole towed visit.
  // Detailed model-C shape (birth text, running total, release-at-last-canister, un-pin) is verified
  // in test-cs029-p4.js against the real offload block, the same way this section already does for
  // score/stats/latches. What survives here is what P4/P6 actually claimed about IDENTITY: colour,
  // size and the live rise/life knobs, on whatever gets pushed.
  // REPOINTED BY CS034 P8 (spec §3.5): the towed branch's size is now the live deliveryFloatSize knob
  // (18 shipped, was the hardcoded 16) — at the shipped deliveryFloatSizeStep 0.0 the ticker never
  // grows mid-visit, so filtering on the live knob is stable here exactly like the hardcoded 16 was.
  const towedFloaters = pushes.filter(p => p.obj.color === A.COLOR.dock && p.obj.size === A.DEBUG.deliveryFloatSize && p.obj.text.startsWith("+"));
  const incidentalFloaters = pushes.filter(p => p.obj.color === A.COLOR.dim && p.obj.size === 12);
  eq(towedFloaters.length, 1, "E: ⛔ the towed visit pushes exactly ONE floater — the ticker, born on canister 1 — not one per canister");
  eq(incidentalFloaters.length, 1, "E: exactly 1 incidental floater was pushed");
  eq(incidentalFloaters[0].obj.text, "+" + A.DOCK_BASE_SCORE, "E: the incidental floater's text is unchanged (+DOCK_BASE_SCORE)");
  assert(incidentalFloaters[0].obj.color !== towedFloaters[0].obj.color,
    "E: ⛔ the incidental floater does NOT share the towed branch's colour");
  assert(incidentalFloaters[0].obj.size !== towedFloaters[0].obj.size,
    "E: ⛔ ...nor its size — it must not read as part of the same tally");
  // REPOINTED BY CS034 P8: life0/fade split off the retired single deliveryFloatLife knob into
  // deliveryFloatHold + deliveryFloatFade (life0) and deliveryFloatFade (fade).
  for (const p of [...towedFloaters, ...incidentalFloaters]) {
    eq(p.obj.rise, A.DEBUG.deliveryFloatRise, "E: every delivery floater's rise is the live knob");
    eq(p.obj.life0, A.DEBUG.deliveryFloatHold + A.DEBUG.deliveryFloatFade, "E: ...and every one's life0 is hold+fade");
    eq(p.obj.fade, A.DEBUG.deliveryFloatFade, "E: ...and every one's fade is the live fade knob");
  }

  // -- the ticker's own lifecycle: born at the first canister's own points, ends up holding the FULL
  //    visit total, and is released (un-pinned) once the visit is over. --
  const ticker = towedFloaters[0].obj;
  let expectedTotal = 0;
  for (let n = 1; n <= 24; n++) expectedTotal += A.DOCK_BASE_SCORE + A.DOCK_BONUS_STEP * (n - 1);
  eq(ticker.text, "+" + expectedTotal, "E: ⛔ the ticker's FINAL text is the visit's full running total (50+75+...+625 = 8100 at these knobs)");
  eq(ticker.pinned, false, "E: ⛔ the ticker is released (un-pinned) once the visit's last canister lands");
  eq(g.deliveryTicker, null, "E: and the live reference is cleared — the next visit starts a fresh ticker");

  // -- deconfliction (spec §3.6): SALVAGE BONUS / MAX HAUL are UNTOUCHED — still default rise/life,
  //    still at dock.y - 22, never moved and never given the new knobs. --
  const bonus = pushes.find(p => p.obj.text === "SALVAGE BONUS");
  const maxHaul = pushes.find(p => p.obj.text === "MAX HAUL");
  assert(!!bonus, "E: (setup) the SALVAGE BONUS floater fired (8-delivered tier)");
  assert(!!maxHaul, "E: (setup) the MAX HAUL floater fired (24-delivered tier)");
  eq(bonus.obj.rise, 30, "E: ⛔ SALVAGE BONUS keeps the OLD default rise — this phase must not touch it");
  eq(bonus.obj.life0, 1.1, "E: ⛔ ...and the old default life");
  eq(maxHaul.obj.rise, 30, "E: ⛔ MAX HAUL likewise keeps the old default rise");
  eq(maxHaul.obj.life0, 1.1, "E: ⛔ ...and the old default life");
  eq(maxHaul.obj.size, 24, "E: ⛔ ...and its own size (24) is untouched");
  eq(bonus.obj.x, g.dock.x, "E: SALVAGE BONUS is still anchored at the dock, not the node (unmoved by this phase)");
  eq(maxHaul.obj.x, g.dock.x, "E: MAX HAUL likewise");
})();

// ================= (F) TRAPs =====================
(function sectionF() {
  console.log("(F) TRAPs: version, LEVERS/leverState byte-identical, no design doc, scope pin");
  // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE (the test-cs021-p4.js/test-cs025-p*.js
  // precedent). This pin asserted the version was UNCHANGED while CS026 P4 ran, and named P6 as the
  // phase that owns the bump — so P6 doing exactly that FALSIFIES the literal form by
  // instruction. Inverted, the claim is permanently true. Do not re-point it to a literal again.
  assert(X.GAME_VERSION !== "1.0.0.25", "F: ⛔ TRAP 1 — GAME_VERSION has moved off the pre-CS026-P6 baseline 1.0.0.25");

  const ps = parentSource(PARENT_SHA);
  if (!ps) {
    skip("§F's parent-commit pins: LEVERS/leverState byte-identity");
  } else {
    const OLD = buildFrom(ps, { exportList: ["LEVERS", "leverState", "GAME_VERSION"] });
    eq(X.LEVERS.length, OLD.LEVERS.length, "F: ⛔ TRAP 3 — the lever count is unchanged — nothing here is a lever");
    eq(X.LEVERS.map(l => l.id).join(","), OLD.LEVERS.map(l => l.id).join(","), "F: ⛔ TRAP 3 — the same levers, in the same order");
    const liveById = Object.fromEntries(X.LEVERS.map(l => [l.id, l]));
    for (const lev of OLD.LEVERS)
      eq(JSON.stringify(liveById[lev.id]), JSON.stringify(lev), `F: ⛔ TRAP 3 — ${lev.id} is byte-identical to the parent`);
    let moved = 0;
    for (let w = 1; w <= 200; w++) {
      const before = OLD.leverState(w), now = X.leverState(w);
      for (const k of Object.keys(before)) if (before[k] !== now[k]) moved++;
      for (const k of Object.keys(now)) if (!(k in before)) moved++;
    }
    eq(moved, 0, "F: ⛔ TRAP 3 — leverState is identical to the parent at EVERY level 1..200");
    // ⛔ FLIPPED BY CS026 P6 TO THE STANDING MIRROR IMAGE, exactly like the literal pin above it. P4's
    // claim was that IT did not move the version off ITS parent; P6 owns the bump and moves it off that
    // same parent by instruction, so the equality is permanently false and the inequality permanently
    // true. Do not re-point either form to a literal.
    assert(X.GAME_VERSION !== OLD.GAME_VERSION,
      "F: ⛔ TRAP 1 — the version has moved off P4's parent (CS026 P6 owns that bump)");
  }

  const shas = ownCommits(PARENT_SHA, PHASE_SUBJECT);
  let changed = null, provisional = false, ambiguous = false;
  if (shas === null) {
    /* skipped below */
  } else if (shas.length === 1) {
    changed = changedFiles(PARENT_SHA, shas[0]);
  } else if (shas.length === 0) {
    changed = changedFiles(PARENT_SHA, null);
    provisional = changed !== null;
  } else {
    ambiguous = true;
    failed++;
    console.error(`  FAIL: F: TRAP 2 — ${shas.length} commits match "${PHASE_SUBJECT}"; the pin is ambiguous`);
  }
  if (!changed) {
    if (!ambiguous) skip("§F's TRAP 2 scope pin");
  } else {
    if (provisional) console.log("  (TRAP 2 measured against the WORKING TREE — this phase is not committed yet)");
    const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
    eq(designDocs.join(","), "", `F: ⛔ TRAP 2 — no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
    const outside = outsideScope(changed);
    eq(outside.join(","), "", `F: this phase touched nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
    assert(changed.includes("asteroids-deluxe.html"), "F: (setup) the game file is in the diff");
    assert(changed.includes("scratchpad/test-cs026-p4.js"), "F: (setup) ...including this test file");
  }
})();

// ================= (G) headless smoke =====================
(function sectionG() {
  console.log("(G) AudioSys.ctx === null smoke: a real 24-canister visit through update()/draw()");
  const A = build();
  eq(A.AudioSys.ctx, null, "G: (setup) no audio context headless");
  A.startGame();
  while (A.game.wave < 12) { A.game.debris.length = 0; A.game.hunters.length = 0; A.nextWave(); }
  const g = A.game;
  g.state = "playing"; g.paused = false;
  g.ship.hp = A.SHIP_MAX_HP; g.ship.x = g.dock.x; g.ship.y = g.dock.y; g.ship.vx = 0; g.ship.vy = 0;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
  g.chain.length = 0;
  for (let i = 0; i < 24; i++)
    g.chain.push({ x: g.ship.x - (i + 1) * A.CHAIN_LINK, y: g.ship.y, px: g.ship.x - (i + 1) * A.CHAIN_LINK, py: g.ship.y,
      spin: 0, spinRate: 0, mass: 1, towed: true });
  let threw = null;
  try {
    for (let i = 0; i < 400; i++) { A.update(1 / 60); if (i % 30 === 0) A.draw(); }
  } catch (e) { threw = e; }
  assert(!threw, `G: 400 real frames of a full visit never threw${threw ? " — " + threw.stack : ""}`);
  eq(g.chain.length, 0, "G: the whole chain delivered within the frame budget");
  eq(g.deliveryCount, 24, "G: ...reaching 24");
})();

console.log(`\n${passed} passed, ${failed} failed, ${skipped} skipped`);
process.exit(failed ? 1 : 0);
