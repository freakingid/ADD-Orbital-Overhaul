// Headless test for CS029 Phase 4 — DELIVERY FLOATERS MOVE TO THE DOCK ANCHOR (model C, the gate).
//
//   node scratchpad/test-cs029-p4.js
//
// WHY. §0.3/§6 (PLANNED-FEATURES-CS029.md). The gate (STATUS.md) picked G1=C, G2=0.50 (anchorFrac),
// G3=160px/s/1.20s (unchanged), G4=n/a (no minGap — that's model B), G5=0.05 (unchanged). DELIVERY_FLOAT_DY
// (a fixed nudge above the SHIP, CS026 P6's own misreading — §0.3) is retired in favour of
// DELIVERY_FLOAT_ANCHOR_FRAC, a fraction of DOCK_RADIUS above the STATIC dock centre, shared by both
// delivery branches through one computed pair (`deliveryAnchorX`/`deliveryAnchorY`). The towed branch
// no longer pushes a floater per canister: one ticker object lives for the whole visit, pinned at the
// anchor, its `.text` rewritten to the running total as each canister lands, released (un-pinned) at
// the visit's last canister. A visit that ends WITHOUT reaching its last canister — a hostile break, a
// ship death, the one-effort grace window expiring, or a fresh haul starting before the old one
// finished — also releases the ticker (releaseDeliveryTicker(), called at all five deliveryCount=0
// sites), or it would sit pinned at the dock forever and the NEXT visit would silently resume its
// stale total instead of starting fresh.
//
// Follows the standing rule (CLAUDE.md): scratchpad/_harness.js's buildGame() evals the REAL <script>
// block (no export list needed — it harvests every top-level name), and every section drives the ACTUAL
// startGame/update/dock-offload/breakChain/scatterChain paths. Nothing under test is reimplemented.
//
// Sections:
//  (A) node --check; source pins — DELIVERY_FLOAT_DY is gone, DELIVERY_FLOAT_ANCHOR_FRAC exists and is
//      positive, FloatText gained `pinned` (optional, default false, every pre-existing call site
//      untouched), releaseDeliveryTicker() exists, both delivery push sites share ONE computed anchor.
//  (B) the registry: DEBUG_ENTRIES.length is UNCHANGED at 85 — G1=C carries no new knob (unlike a G1=B
//      pick, which would have added minGap). DOCK_OFFLOAD_INTERVAL is unmoved at 0.05 (G5).
//  (C) ⛔ a real dock visit, driven for real, with the ship offset from the dock centre (not merely
//      "near" it) so ship != dock is non-vacuous: both branches spawn at the DOCK anchor, never at ship
//      coordinates: exactly ONE towed push per visit (the ticker), its text is rewritten in place as
//      each canister lands, it is released (un-pinned, reference cleared) exactly at the last canister,
//      and never more than one pinned floater lives at once.
//  (D) the four abnormal-termination release sites: breakChain, scatterChain, the comboGrace timeout,
//      and a fresh haul starting before the old one finished — each releases an orphaned ticker rather
//      than leaving it pinned at the dock forever.
//  (E) the incidental branch: unchanged size/colour/text, shares the dock anchor, never touches or is
//      folded into the ticker, and multiple incidentals in one visit each get their own ordinary floater.
//  (F) TRAPs: GAME_VERSION unmoved (P5 owns the bump); LEVERS/leverState byte-identical to the parent;
//      scope pin against this phase's own parent (P3's commit), loudly skipped if git is unavailable.

"use strict";
const { buildGame, mkAssert, scriptSource } = require("./_harness.js");
const { ownCommits, changedFiles, outsideScope, parentSource, SKIP_TAG } = require("./_phase-ref.js");

// ⛔ THIS PHASE'S OWN PARENT, PINNED AS A LITERAL — cs-29 p3 (the float lab), v1.0.0.28.
const PARENT_SHA = "59dd0f0b054669c3997f2f3e892afcd5a5cb1c64";
const PHASE_SUBJECT = "cs-29 p4:";

const A = mkAssert();
const { assert, eq, close, skip } = A;

const src = scriptSource();

// ================= (A) node --check + source pins =====================
(function sectionA() {
  console.log("(A) node --check; DELIVERY_FLOAT_DY retired, DELIVERY_FLOAT_ANCHOR_FRAC in, pinned/release wired");
  const { execFileSync } = require("child_process");
  const fs = require("fs"), path = require("path");
  const tmp = path.join(__dirname, "_cs029p4_extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: node --check: " + e.stderr.toString()); }
  finally { fs.unlinkSync(tmp); }

  assert(!/\bDELIVERY_FLOAT_DY\b/.test(src.replace(/\/\/[^\n]*/g, "")),
    "A: ⛔ DELIVERY_FLOAT_DY does not appear anywhere in executable source (comments may still name it historically)");
  // REPOINTED BY CS034 P8 (GATE A): the constant moved 0.50 -> 0.75, re-gated against the larger P8
  // ticker. REPOINTED BY CS035 P1 (§1.1): a later dock-float-lab session moved it back to 0.50.
  // Still a plain constant, not a registry knob — that half of the claim is unaffected.
  assert(/const DELIVERY_FLOAT_ANCHOR_FRAC = 0\.50;/.test(src),
    "A: DELIVERY_FLOAT_ANCHOR_FRAC is declared as a plain constant, 0.50 (CS035 P1) — not a registry knob");

  // FloatText's `pinned` field: optional, defaults false, every pre-existing call site untouched.
  const ftBody = src.slice(src.indexOf("class FloatText {"), src.indexOf("class Dock {"));
  assert(/this\.pinned = false;/.test(ftBody), "A: FloatText's constructor sets this.pinned = false by default");
  assert(/if \(this\.pinned\) return;/.test(ftBody), "A: update() returns early when pinned — position/life frozen");

  assert(/function releaseDeliveryTicker\(\) \{/.test(src), "A: releaseDeliveryTicker() exists");
  eq((src.match(/releaseDeliveryTicker\(\);/g) || []).length, 5,
    "A: ⛔ releaseDeliveryTicker() is called at exactly 5 sites — the last-canister release plus the four abnormal-termination resets");

  // The anchor is computed ONCE in the offload block — the §6.1 "one origin expression" rule.
  assert(/const deliveryAnchorX = game\.dock\.x, deliveryAnchorY = game\.dock\.y - DOCK_RADIUS \* DELIVERY_FLOAT_ANCHOR_FRAC;/.test(src),
    "A: the shared anchor is computed once, in the dock-offload block, at the top of the pop handler");
  // REPOINTED BY CS035 P2 (§2.4): the anchor had TWO readers — the towed ticker's birth and the
  // incidental branch's push. The dock lockout made the incidental category empty by construction, so
  // that branch (and its FloatText) is deleted and ONE reader is left. The rule this pinned — one
  // computed origin, never two that can drift apart — is unaffected, and with one branch cannot fail.
  eq((src.match(/deliveryAnchorX, deliveryAnchorY/g) || []).length, 1,
    "A: ...and read by name at the one FloatText call site left, the ticker's birth (CS035 P2 deleted the other)");
})();

// ================= (B) the registry =====================
(function sectionB() {
  console.log("(B) registry HOLDS at 85 — model C adds no knob; DOCK_OFFLOAD_INTERVAL unmoved (G5)");
  const X = buildGame();
  // REPOINTED BY CS030 P3: +2 later (celebrationScrollStep, celebrationEmblemSize) — a later phase's
  // rows, named rather than re-litigated. This phase's own claim (G1=C adds nothing) is unaffected.
  // REPOINTED BY CS034 P8: net +4 more (deliveryFloatLife retired, five new DELIVERY rows added).
  // REPOINTED BY CS035 P2: +1 more (dockBounceSpeed, the dock lockout's push speed).
  // REPOINTED BY CS035 P3: +4 more (levelEndHold/Grace/Fade/GracePulseEnd, the level-end window).
  // REPOINTED BY CS035 P4: +5 more (hunterVolatileAge, hunterPulseMin/Max/Grow/Shrink).
  // REPOINTED BY CS035 P6: +5 more (chainGuardDropBase/Pity/Max, sweepPowerupCap, dockPowerupSpeed).
  // REPOINTED BY CS036 P2: −1 — levelEndHold RETIRED (the pre-nextWave() hold is player-paced now).
  // REPOINTED BY CS036 P5: +1 — dockPingCooldown (the dock push's audio rate limit).
  // REPOINTED BY CS037 P7: +2 — dockBaseScore, dockBonusStep (the delivery score curve's two
  // constants promoted to knobs).
  // REPOINTED BY CS037 P7.1: +2 — towReleaseLockout, towReleaseSpeed (the tow release separation's
  // two SHIP knobs).
  eq(X.DEBUG_ENTRIES.length, 116, "B: ⛔ DEBUG_ENTRIES.length is unchanged from this phase's own parent (bar CS030 P3's two, CS034 P8's net four, CS035 P2's one, CS035 P3's four, CS035 P4's five, CS035 P6's five, CS036 P2's one retirement, CS036 P5's one addition CS037 P2's four BENCHMARK controls, CS037 P4's telemetryInterval, CS037 P7's two delivery score knobs, CS037 P7.1's two tow release knobs and CS038 P3's telemetryCapture later) — G1=C carries no new registry row");
  assert(!("deliveryFloatAnchorFrac" in X.DEBUG), "B: DELIVERY_FLOAT_ANCHOR_FRAC did not become a registry row");
  assert(!("minGap" in X.DEBUG) && !("deliveryFloatMinGap" in X.DEBUG),
    "B: no minGap knob either — that belongs to model B, which was not picked");
  close(X.DOCK_OFFLOAD_INTERVAL, 0.05, "B: DOCK_OFFLOAD_INTERVAL is unmoved at 0.05 (gate G5)");
  // REPOINTED BY CS034 P8 (GATE A): rise moved 160 -> 200; deliveryFloatLife is retired outright, its
  // two readers replaced by deliveryFloatHold/deliveryFloatFade (test-cs034-p8.js's territory now).
  // REPOINTED BY CS035 P1 (§1.1): rise moved again, 200 -> 150.
  eq(X.DEBUG.deliveryFloatRise, 150, "B: deliveryFloatRise's live value is 150 (CS035 P1)");
  eq(X.DEBUG.deliveryFloatLife, undefined, "B: ⛔ deliveryFloatLife no longer exists — retired by CS034 P8");
})();

// ---- shared staging: a real dock visit, ship OFFSET from the dock centre (non-vacuous) ----
function stageVisit(X, canisterCount) {
  X.startGame();
  const g = X.game;
  g.state = "playing"; g.paused = false;
  g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0;
  g.debris.length = 1;
  g.debris[0] = { x: 1e5, y: 1e5, vx: 0, vy: 0, size: 1, radius: 5, dead: false, update() {}, draw() {} };
  g.saucerTimer = 1e6; g.healthTimer = 1e6; g.hunterTimer = 1e6;
  g.ship.dead = false; g.ship.vx = 0; g.ship.vy = 0;
  // OFFSET, not centred: inside the offload radius (dock.radius+10) and the grace ring (dock.radius+40),
  // but far enough from dock.x/y that "born at the dock" and "born at the ship" are distinguishable.
  g.ship.x = g.dock.x + 30; g.ship.y = g.dock.y - 15;
  g.comboGrace = X.DEBUG.dockComboGrace;
  g.cargoMax = X.CARGO_CAP_MAX;
  g.deliveryCount = 0; g.offloadTimer = 0;
  g.chain.length = 0;
  for (let i = 0; i < canisterCount; i++) {
    const nx = g.ship.x - (i + 1) * X.CHAIN_LINK, ny = g.ship.y;
    g.chain.push({ x: nx, y: ny, px: nx, py: ny, spin: 0, spinRate: 0, mass: 1, towed: true });
  }
  return g;
}

// ================= (C) a real dock visit: dock-anchored, one ticker, released at the end =====================
(function sectionC() {
  console.log("(C) a real 24-canister visit: dock-anchored (not ship), one ticker, released at canister 24");
  const X = buildGame();
  const g = stageVisit(X, X.CARGO_CAP_MAX);
  const wantX = g.dock.x, wantY = g.dock.y - X.DOCK_RADIUS * X.DELIVERY_FLOAT_ANCHOR_FRAC;
  assert(Math.abs(g.ship.x - wantX) > 5 && Math.abs(g.ship.y - wantY) > 5,
    "C: (non-vacuity) the staged ship position is clearly NOT the dock anchor");

  const pushes = [];
  let curFrame = -1;
  // `text0` is a SNAPSHOT at push time — `obj` is a live reference, and the ticker's `.text` is
  // rewritten in place for the rest of the visit, so reading `obj.text` after the drive loop gives
  // the FINAL total, not the birth text (the same trap CS026 P6 §C already documents for `.y`).
  const interceptor = function (...items) {
    for (const it of items) pushes.push({ frame: curFrame, obj: it, text0: it.text });
    return Array.prototype.push.apply(this, items);
  };
  // Sampled once per frame: how many currently-live floaters are pinned. Model C's whole claim is
  // "at most one ticker alive at a time" — sampling every frame is what makes that claim real rather
  // than inferred from the push log.
  let maxPinnedAtOnce = 0;
  for (let frame = 0; frame < 600 && g.chain.length > 0; frame++) {
    curFrame = frame;
    g.floaters.push = interceptor;
    X.update(1 / 60);
    const pinnedNow = g.floaters.filter(f => f.pinned).length;
    if (pinnedNow > maxPinnedAtOnce) maxPinnedAtOnce = pinnedNow;
  }
  eq(g.chain.length, 0, "C: (setup) the whole 24-canister chain was offloaded");
  eq(g.deliveryCount, X.CARGO_CAP_MAX, "C: (setup) all 24 counted as towed deliveries");
  assert(maxPinnedAtOnce <= 1, `C: ⛔ never more than one PINNED floater is alive at once (max observed ${maxPinnedAtOnce})`);

  // REPOINTED BY CS034 P8: the towed ticker's birth size is now the live deliveryFloatSize knob (18
  // shipped, was the hardcoded 16); at the shipped deliveryFloatSizeStep 0.0 it never grew mid-visit.
  // REPOINTED BY CS035 P1 (§1.1): deliveryFloatSizeStep moves off 0.0, so the ticker's `size` is
  // mutated in place as canisters land — filtering on a snapshot size no longer finds it once the
  // loop has run. `/^\+\d+$/` (its accumulating "+N" text) plus COLOR.dock is enough on its own —
  // no other push in this staged visit shares both.
  const towed = pushes.filter(p => p.obj.color === X.COLOR.dock && /^\+\d+$/.test(p.obj.text));
  eq(towed.length, 1, "C: ⛔ exactly ONE towed push for the whole visit — the ticker, born on canister 1");
  const ticker = towed[0].obj;
  close(ticker.x, wantX, "C: ⛔ the ticker is born at the dock's x, not the ship's");
  close(ticker.y, wantY, "C: ⛔ ...and at dock.y - DOCK_RADIUS x DELIVERY_FLOAT_ANCHOR_FRAC, not any ship-relative y");
  eq(towed[0].text0, "+" + X.DOCK_BASE_SCORE, "C: the ticker's BIRTH text is canister 1's own points (DOCK_BASE_SCORE)");

  let expectedTotal = 0;
  for (let n = 1; n <= X.CARGO_CAP_MAX; n++) expectedTotal += X.DOCK_BASE_SCORE + X.DOCK_BONUS_STEP * (n - 1);
  eq(ticker.text, "+" + expectedTotal, "C: ⛔ the ticker's FINAL text is the whole visit's running total");
  eq(ticker.pinned, false, "C: ⛔ the ticker is released (un-pinned) once the last canister lands");
  eq(g.deliveryTicker, null, "C: ...and the live reference is cleared — nothing left pinned for the next visit to find");
  eq(ticker.rise, X.DEBUG.deliveryFloatRise, "C: the released ticker still reads the live rise knob");
  // REPOINTED BY CS034 P8: life0 is now hold+fade (deliveryFloatLife retired).
  eq(ticker.life0, X.DEBUG.deliveryFloatHold + X.DEBUG.deliveryFloatFade, "C: ...and the live hold+fade knobs");
  eq(ticker.fade, X.DEBUG.deliveryFloatFade, "C: ...and the live fade knob");

  // A SECOND visit, immediately after: the ticker must be a FRESH object starting from ITS OWN first
  // canister, not a resumed/stale total left over from the first visit. deliveryCount/offloadTimer are
  // reset by hand here (this test seeds chain nodes directly, the standing plain-object exception) to
  // stand in for the real towed-hook reset a fresh pickup outside the ring would fire.
  // ⛔ The FIRST visit's released ticker is still a LIVE, un-expired floater at this point (life 1.2s,
  // far more than the few frames since release) — searching `g.floaters` by shape would find it before
  // the new one. A fresh interceptor, scoped to just this second drive, is what actually isolates
  // "the object THIS visit created" rather than "the first dock-coloured +N floater still on screen".
  g.chain.length = 0;
  const nx = g.ship.x - X.CHAIN_LINK, ny = g.ship.y;
  g.chain.push({ x: nx, y: ny, px: nx, py: ny, spin: 0, spinRate: 0, mass: 1, towed: true });
  g.deliveryCount = 0; g.offloadTimer = 0;
  const pushes2 = [];
  const interceptor2 = function (...items) {
    for (const it of items) pushes2.push(it);
    return Array.prototype.push.apply(this, items);
  };
  for (let f = 0; f < 60 && g.chain.length > 0; f++) { g.floaters.push = interceptor2; X.update(1 / 60); }
  eq(g.chain.length, 0, "C: (setup) the second, one-canister visit was delivered");
  const secondTicker = pushes2.find(f => f.color === X.COLOR.dock && f.size === X.DEBUG.deliveryFloatSize && /^\+\d+$/.test(f.text));
  assert(!!secondTicker && secondTicker !== ticker, "C: (setup) a NEW ticker object exists, distinct from the first visit's");
  eq(secondTicker.text, "+" + X.DOCK_BASE_SCORE,
    "C: ⛔ the second visit's ticker starts at ITS OWN first canister's points — no stale total carried over");
})();

// ================= (D) abnormal-termination release: the four other deliveryCount=0 sites =====================
(function sectionD() {
  console.log("(D) breakChain / scatterChain / comboGrace timeout / fresh-haul-outside-ring all release the ticker");

  // -- breakChain: a hostile hit mid-offload --
  {
    const X = buildGame();
    const g = stageVisit(X, 10);
    for (let f = 0; f < 20 && g.chain.length > 7; f++) X.update(1 / 60);
    assert(g.deliveryTicker !== null && g.deliveryTicker.pinned === true, "D: (setup) mid-visit, a ticker is live and pinned");
    X.breakChain(0);
    eq(g.deliveryTicker, null, "D: ⛔ breakChain() releases the reference");
  }

  // -- scatterChain: ship destroyed mid-offload --
  {
    const X = buildGame();
    const g = stageVisit(X, 10);
    for (let f = 0; f < 20 && g.chain.length > 7; f++) X.update(1 / 60);
    const tickerRef = g.deliveryTicker;
    assert(tickerRef !== null && tickerRef.pinned === true, "D: (setup) mid-visit, a ticker is live and pinned");
    X.scatterChain();
    eq(g.deliveryTicker, null, "D: ⛔ scatterChain() releases the reference");
    eq(tickerRef.pinned, false, "D: ...and the orphaned object itself is un-pinned, so it ages out instead of sitting forever");
  }

  // -- the comboGrace window expiring: ship parked away from the dock too long mid-visit --
  {
    const X = buildGame();
    const g = stageVisit(X, 10);
    for (let f = 0; f < 20 && g.chain.length > 7; f++) X.update(1 / 60);
    assert(g.deliveryTicker !== null, "D: (setup) mid-visit, a ticker is live");
    // Push the ship well outside dock.radius + DOCK_NEIGHBORHOOD_PAD and let the grace window run out.
    g.ship.x = g.dock.x + (g.dock.radius + X.DOCK_NEIGHBORHOOD_PAD) * 3;
    g.ship.y = g.dock.y;
    for (let f = 0; f < 600 && g.deliveryCount > 0; f++) X.update(1 / 60);
    eq(g.deliveryCount, 0, "D: (setup) the grace window really did expire and zero the combo");
    eq(g.deliveryTicker, null, "D: ⛔ the grace-window timeout releases the ticker too — not just the counter");
  }

  // -- a fresh haul starting outside the ring before the old visit finished --
  {
    const X = buildGame();
    const g = stageVisit(X, 10);
    for (let f = 0; f < 20 && g.chain.length > 7; f++) X.update(1 / 60);
    const staleTicker = g.deliveryTicker;
    const chainBefore = g.chain.length;
    assert(staleTicker !== null, "D: (setup) mid-visit, a ticker is live, still short of the last canister");
    // Leave the dock without finishing, then hook something new far outside the neighborhood — placed
    // exactly at the ship so the pickup gate's distance test is trivially satisfied on the first frame.
    g.ship.x = g.dock.x + (g.dock.radius + X.DOCK_NEIGHBORHOOD_PAD) * 3;
    g.ship.y = g.dock.y;
    g.garbage.push(new X.Garbage(g.ship.x, g.ship.y, 0, 0, 1));
    for (let f = 0; f < 10 && g.chain.length === chainBefore; f++) X.update(1 / 60);
    eq(g.chain.length, chainBefore + 1, "D: (setup) the new piece was hooked, tagged onto the old (unfinished) chain");
    eq(g.deliveryCount, 0, "D: ⛔ the fresh hook outside the ring reset the combo — a new effort started");
    eq(g.deliveryTicker, null, "D: ⛔ ...and released the OLD visit's stale ticker, so the next canister starts a fresh one");
    assert(staleTicker.pinned === false, "D: ...the orphaned object itself is released, not left pinned forever");
  }
})();

// ================= (E) the incidental branch: DELETED BY CS035 P2, and it stays deleted ==========
// REPOINTED BY CS035 P2 (§2.4). This section owned the incidental branch's own floater — its size,
// text, colour, unpinned-ness and shared dock anchor. §2's dock lockout makes the incidental category
// empty BY CONSTRUCTION (a piece cannot be hooked while the ship is inside the ring at all), so the
// branch was unreachable and was deleted along with the `towed` tag that selected it. The section
// inverts rather than being dropped: it now pins that a chain node still carrying a stale
// `towed: false` — which is what every older test seeds by hand — delivers as an ORDINARY towed
// canister, tally and ticker included, and that nothing pushes a size-12 flat-rate floater any more.
(function sectionE() {
  console.log("(E) the incidental branch is gone: a stale `towed: false` node delivers as a normal towed one");
  const X = buildGame();
  const g = stageVisit(X, 0);
  // Two nodes tagged the old way. The tag is dead data now; it must not demote anything.
  g.chain.push({ x: g.ship.x + 5, y: g.ship.y, px: g.ship.x, py: g.ship.y, spin: 0, spinRate: 0, mass: 1, towed: false });
  g.chain.push({ x: g.ship.x + 10, y: g.ship.y, px: g.ship.x, py: g.ship.y, spin: 0, spinRate: 0, mass: 1, towed: false });

  for (let f = 0; f < 30 && g.chain.length > 0; f++) X.update(1 / 60);
  eq(g.chain.length, 0, "E: (setup) both nodes offloaded");
  eq(g.deliveryCount, 2, "E: ⛔ both counted — a stale `towed: false` demotes nothing, the branch that read it is gone");
  eq(g.floaters.filter(f => f.size === 12).length, 0,
    "E: ⛔ NO size-12 flat-rate floater exists any more — the incidental push was deleted with its branch");
  const tickers = g.floaters.filter(f => /^\+\d+$/.test(f.text));
  eq(tickers.length, 1, "E: ⛔ one ticker for the visit, the model-C rule, with nothing beside it");
  eq(tickers[0].text, "+" + (X.DOCK_BASE_SCORE + (X.DOCK_BASE_SCORE + X.DOCK_BONUS_STEP)),
    "E: ...and it accumulated BOTH pops on the escalating formula, not two flat DOCK_BASE_SCOREs");
  close(tickers[0].x, g.dock.x, "E: ...born at the dock anchor, the one origin expression left");
  eq(g.deliveryTicker, null, "E: ...and released at the last canister, so it is an ordinary floater now");
})();

// ================= (F) TRAPs =====================
(function sectionF() {
  console.log("(F) TRAPs: GAME_VERSION moved off P4's own \"1.0.0.28\" (P5 owns the bump), LEVERS untouched, scope pin");
  const X = buildGame();
  // ⚠ SETTLED (CLAUDE.md pins): at a version bump, a phase-local pin flips to its standing mirror
  // image rather than being re-pointed to a new literal. GAME_VERSION was "1.0.0.28" for this
  // phase's own commit, permanently true, so the pin is a permanent !== from here on.
  assert(X.GAME_VERSION !== "1.0.0.28", "F: GAME_VERSION has moved off P4's own \"1.0.0.28\"");

  const ps = parentSource(PARENT_SHA);
  if (ps === null) {
    skip("F: LEVERS/leverState byte-identity against the parent (no git history)");
  } else {
    const OLD = buildGame({ source: ps });
    eq(X.LEVERS.length, OLD.LEVERS.length, "F: ⛔ the lever count is unchanged — nothing in this phase is a lever");
    eq(X.LEVERS.map(l => l.id).join(","), OLD.LEVERS.map(l => l.id).join(","), "F: ⛔ the same levers, in the same order");
    let moved = 0;
    for (let w = 1; w <= 200; w++) {
      const before = OLD.leverState(w), now = X.leverState(w);
      for (const k of Object.keys(before)) if (before[k] !== now[k]) moved++;
      for (const k of Object.keys(now)) if (!(k in before)) moved++;
    }
    eq(moved, 0, "F: ⛔ leverState is identical to the parent at every level 1..200");
  }

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

  const designDocs = changed.filter(f => f.endsWith(".md") && f !== "STATUS.md");
  eq(designDocs.join(","), "", `F: ⛔ no design doc was touched (found: ${designDocs.join(", ") || "none"})`);
  const outside = outsideScope(changed, []);
  eq(outside.join(","), "", `F: nothing outside the game file, scratchpad/ and STATUS.md (found: ${outside.join(", ") || "none"})`);
  assert(changed.includes("orbital-overhaul.html"), "F: (setup) the game file is in this phase's diff");
})();

A.report();
