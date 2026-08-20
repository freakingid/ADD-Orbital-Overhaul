// CS038 P2 headless test — tools/lowhp-glow-lab.html (the low-hull corner-glow instrument).
// Drives the REAL lab script (extracted from the HTML, run under a stubbed DOM) — never a copy;
// same precedent as test-cs010-p8.js. No real canvas exists here, so the stub RECORDS draw ops
// instead of rasterising them, and the coverage checks below evaluate a recorded gradient
// analytically at a probe point. Two traps worth naming:
//   1. §C's port-verbatim compare is byte-strict INCLUDING INDENTATION, after exactly the three
//      substitutions the lab's own header documents. If it fails, the lab has grown a second
//      implementation of the glow, which is the one thing it must not have.
//   2. §E asserts the SHIPPED corner shape paints alpha 0 at every EDGE-MIDPOINT probe. That is
//      not a bug being pinned — it is hypothesis (b) (the glow is in the wrong PLACE) stated as
//      an assertion, and it is what the vignette/bars rows are compared against.
"use strict";
const fs = require("fs");
const vm = require("vm");
const os = require("os");
const path = require("path");

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", msg); }
}
const close = (a, b, eps, msg) => ok(Math.abs(a - b) <= eps, msg + " (got " + a + ")");

const ROOT = path.join(__dirname, "..");
const LAB = path.join(ROOT, "tools", "lowhp-glow-lab.html");
const html = fs.readFileSync(LAB, "utf8");
const gameSrc = fs.readFileSync(path.join(ROOT, "orbital-overhaul.html"), "utf8");

// ---- A. the file is a standalone instrument -------------------------------
const scripts = html.match(/<script[^>]*>/g) || [];
ok(scripts.length === 1, "exactly one <script> tag (got " + scripts.length + ")");
ok(scripts[0] === "<script>", "the script tag is a plain classic script, no type/src attributes");
ok(!/<script[^>]+src=/.test(html), "no external <script src> — opens from file:// by double-click");
for (const bad of ["import ", "require(", "fetch(", "XMLHttpRequest", "import("]) {
  ok(html.indexOf(bad) === -1, "no " + bad.trim() + " — no build step, no imports (house rule)");
}
const m = html.match(/<script>([\s\S]*)<\/script>/);
ok(!!m, "script block extracts");
const labSrc = m[1];
ok(!/Math\.random\s*\(/.test(labSrc),
  "no Math.random() call — the backdrop is seeded, so a measurement can never move because the rocks moved");

// node --check on the extracted script, literally (not just vm compilation).
{
  const tmp = path.join(os.tmpdir(), "cs038-p2-lab-" + process.pid + ".js");
  fs.writeFileSync(tmp, labSrc);
  let clean = true;
  try { require("child_process").execFileSync(process.execPath, ["--check", tmp], { stdio: "pipe" }); }
  catch (e) { clean = false; console.error(String(e.stderr || e)); }
  fs.unlinkSync(tmp);
  ok(clean, "node --check is clean on the extracted script");
}

// ---- stub DOM: a RECORDING 2d context ------------------------------------
let ops = [];                  // every fillRect, with the paint that was live at the time
function mkGradient(kind, coords) {
  return { kind, coords, stops: [], addColorStop(o, c) { this.stops.push([o, c]); } };
}
function mkCtx() {
  const c = {
    fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, font: "", textAlign: "left",
    shadowColor: "", shadowBlur: 0, globalAlpha: 1,
    save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
    beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, arc() {}, stroke() {},
    fillText() {}, clearRect() {},
    fillRect(x, y, w, h) { ops.push({ x, y, w, h, fill: c.fillStyle, blur: c.shadowBlur }); },
    createRadialGradient(x0, y0, r0, x1, y1, r1) { return mkGradient("radial", [x0, y0, r0, x1, y1, r1]); },
    createLinearGradient(x0, y0, x1, y1) { return mkGradient("linear", [x0, y0, x1, y1]); },
    getImageData() { return { data: new Uint8ClampedArray([2, 4, 8, 255]) }; },
  };
  return c;
}
function mkEl(tag) {
  const el = {
    tag, value: "", textContent: "", innerHTML: "", className: "", disabled: false,
    checked: false, width: 0, height: 0, style: {}, dataset: {}, children: [], _on: {},
    classList: { add() {}, remove() {}, toggle() {} },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener(t, fn) { (this._on[t] = this._on[t] || []).push(fn); },
    select() {}, removeChild() {},
    getContext() { return (this._ctx = this._ctx || mkCtx()); },
  };
  return el;
}
const elements = {};
const documentStub = {
  body: mkEl("body"),
  getElementById(id) { return elements[id] || (elements[id] = mkEl("div")); },
  createElement(tag) { return mkEl(tag); },
  execCommand() {},
};
const sandbox = {
  document: documentStub, navigator: {}, console,
  requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, setTimeout: () => 0,
  addEventListener() {},
};
sandbox.window = sandbox;
const context = vm.createContext(sandbox);
vm.runInContext(labSrc, context, { filename: "lowhp-glow-lab.js" });
const ev = expr => vm.runInContext(expr, context);
function fire(id, type, i) {
  const el = elements[id];
  const list = (i === undefined ? el : el.children[i])._on[type] || [];
  for (const fn of list) fn({ target: (i === undefined ? el : el.children[i]), preventDefault() {} });
}

ok(true, "the lab script evaluates and initialises under a stubbed DOM");

// ---- B. the shipped baseline is a frozen CS038 GATE A snapshot, not a live mirror ----------
// Until CS038 P6, this section asserted the lab's SHIPPED object equalled orbital-overhaul.html's
// live LOWHP_GLOW_* constants — a real check while the retune was still undecided. P6 applied
// GATE A's answer (shape: edge vignette, alpha 0.20/0.40) to the build, which by DESIGN makes the
// lab's SHIPPED four-corner/0.10/0.26 baseline diverge from HEAD forever after: SHIPPED is the
// "today" GATE A was argued against, not a live tracker, and a lab is not re-synced to the build
// just because the build changed underneath it (the same house rule dock-float-lab/emblem-lab
// live under). test-cs038-p6.js is the authority on the LIVE build's glow constants now; this
// file only pins the LAB's own internal literals plus the two things a glow retune structurally
// cannot move: LOW_HP_THRESHOLD and lowhpPulseRate(t)'s rate constants (P6's own invariants:
// "these two are NOT glow knobs" — the audio siren and the hull ring share them).
function buildConst(name) {
  const re = new RegExp("^const " + name + "\\s*=\\s*([^;]+);", "m");
  const mm = gameSrc.match(re);
  ok(!!mm, "orbital-overhaul.html declares " + name);
  return mm ? mm[1].trim() : null;
}
const STABLE_EXPECT = {
  LOWHP_PULSE_RATE_MIN: "0.9", LOWHP_PULSE_RATE_MAX: "2.4", LOW_HP_THRESHOLD: "100",
};
for (const [k, v] of Object.entries(STABLE_EXPECT))
  ok(buildConst(k) === v, "build's " + k + " is untouched by the glow retune, still " + v);
const LAB_SHIPPED_FROZEN = {
  LOWHP_GLOW_ALPHA_MIN: 0.10, LOWHP_GLOW_ALPHA_MAX: 0.26, LOWHP_GLOW_RADIUS: 280,
  LOWHP_PULSE_RATE_MIN: 0.9, LOWHP_PULSE_RATE_MAX: 2.4,
};
for (const [k, v] of Object.entries(LAB_SHIPPED_FROZEN))
  ok(ev("SHIPPED." + k) === v, "lab SHIPPED." + k + " is the frozen pre-P6 baseline (" + v + ")");
ok(ev("SHIPPED.LOWHP_GLOW_RGB") === "255,64,64", "lab SHIPPED.LOWHP_GLOW_RGB is the frozen pre-P6 baseline");
ok(ev("LOW_HP_THRESHOLD") === 100, "lab LOW_HP_THRESHOLD matches the build");
ok(ev("VIEW_W") === 1280 && ev("VIEW_H") === 720, "lab viewport is the build's 1280x720");
ok(ev("Object.isFrozen(SHIPPED)"), "SHIPPED is frozen — the baseline cannot be edited by a handler");

// LOWHP_GLOW_RGB mirrors COLOR.lowhp, and the mirror is the lab's DEFAULT (a GATE A A5 decision
// to break it must be made on purpose, not inherited from a lab that shipped it already broken).
// The mirror is unaffected by which alpha/shape GATE A picks, so this one IS still checked live.
const lowhpHex = (gameSrc.match(/lowhp:\s*"(#[0-9a-fA-F]{6})"/) || [])[1];
ok(lowhpHex === "#ff4040", "build COLOR.lowhp is #ff4040");
const mirror = [1, 3, 5].map(i => parseInt(lowhpHex.substr(i, 2), 16)).join(",");
ok(ev("SHIPPED.LOWHP_GLOW_RGB") === mirror, "SHIPPED rgb is the COLOR.lowhp mirror (" + mirror + ")");
ok(ev("CAND.LOWHP_GLOW_RGB") === mirror, "the CANDIDATE defaults to the mirror too");
ok(ev("COLOR.lowhp") === lowhpHex, "the lab's copied COLOR.lowhp matches the build");
ok(buildConst("LOWHP_GLOW_RGB") === '"' + mirror + '"',
  "the build's own LOWHP_GLOW_RGB still carries the mirror post-retune (GATE A A5 kept it)");

// The HUD furniture is only useful as a judgement if it is where the build actually puts it —
// "two of the four corners are already occupied" is half the question this lab exists to answer.
for (const k of ["HUD_HULL_CX", "HUD_CARGO_CX", "HUD_RING_CY", "HUD_RING_R", "HUD_RING_W",
                 "HUD_RING_TRACK_W", "HUD_RING_LABEL_Y", "HUD_SHIELD_R_GAP", "HUD_FX_BASE_Y",
                 "HUD_FX_ROW_H", "HUD_FX_RING_R", "HUD_FX_GLYPH_R", "SCOOP_MAX_LEVEL",
                 "SHIP_MAX_HP", "HUD_RING_SEG_GAP"])
  ok(ev(k) === parseFloat(buildConst(k)), "lab " + k + " matches the build (" + buildConst(k) + ")");
ok(JSON.stringify(ev("POWERUP_DROP_TYPES")) === '["rapid","triple","magnet","engine","guard"]',
  "the powerup rows are the build's POWERUP_DROP_TYPES, in its load-bearing order");
ok(ev("VIEW_H") - ev("HUD_FX_BASE_Y") === 80, "the SCOOP row really does sit near the bottom edge");
// …and both really do fall inside the shipped corner blobs they are said to compete with.
{
  const R = ev("SHIPPED.LOWHP_GLOW_RADIUS"), W = ev("VIEW_W"), H = ev("VIEW_H");
  const d = (x, y, cx, cy) => Math.hypot(x - cx, y - cy);
  ok(d(ev("HUD_HULL_CX"), ev("HUD_RING_CY"), W, 0) < R,
    "the HULL ring sits inside the top-right blob (it is one of the two OCCUPIED corners)");
  ok(d(ev("HUD_CARGO_CX"), ev("HUD_RING_CY"), W, 0) < R, "…so does the CARGO ring");
  ok(d(40, ev("HUD_FX_BASE_Y"), 0, H) < R,
    "the SCOOP row sits inside the bottom-left blob (the other OCCUPIED corner)");
}

// ---- C. the PORT-ME block was VERBATIM at the moment GATE A was run -------
// Three substitutions and only three, exactly as the lab's own header documents. This compares
// the lab's `glowCorners()` — the "four corners" shape, i.e. the PORT-ME block as it read at CS038
// P2 — against a FROZEN copy of the pre-P6 build's glow block, not the live orbital-overhaul.html:
// P6 rewrote drawHUD()'s glow to the edge-vignette shape GATE A picked, so the live build no longer
// contains a four-corner block for this to re-extract by pattern. The frozen text below is the
// exact bytes read out of HEAD (pre-P6) at the time this check last passed live — this is a
// point-in-time correctness record for the port, not a standing live-drift guard (§B's comment
// explains why a lab is not re-synced to the build just because the build moved on).
const PRE_P6_GLOW_BLOCK =
  "    const gt = clamp01(1 - game.ship.hp / LOW_HP_THRESHOLD);            // HP urgency, the same t the siren uses\n" +
  "    const gpulse = 0.6 + 0.4 * Math.sin(game.lowHpPhase);              // shared phase → locked to the hull ring + siren\n" +
  "    const peak = (LOWHP_GLOW_ALPHA_MIN + (LOWHP_GLOW_ALPHA_MAX - LOWHP_GLOW_ALPHA_MIN) * gt) * gpulse;\n" +
  "    const R = LOWHP_GLOW_RADIUS;\n" +
  "    for (const c of [[0, 0], [VIEW_W, 0], [0, VIEW_H], [VIEW_W, VIEW_H]]) {\n" +
  "      const grad = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], R);\n" +
  "      grad.addColorStop(0, `rgba(${LOWHP_GLOW_RGB},${peak})`);\n" +
  "      grad.addColorStop(1, `rgba(${LOWHP_GLOW_RGB},0)`);\n" +
  "      ctx.fillStyle = grad;\n" +
  "      ctx.fillRect(Math.max(0, c[0] - R), Math.max(0, c[1] - R), R, R);\n" +
  "    }";
function extractGlowBlock(src) {
  const startMark = "    const gt = clamp01(1 - ";
  const endMark = "      ctx.fillRect(Math.max(0, c[0] - R), Math.max(0, c[1] - R), R, R);\n    }";
  const s = src.indexOf(startMark);
  if (s < 0) return null;
  const e = src.indexOf(endMark, s);
  if (e < 0) return null;
  return src.slice(s, e + endMark.length);
}
const labBlock = extractGlowBlock(labSrc);
ok(!!labBlock, "the four-corner shape block is findable in the lab's glowCorners()");
const substituted = PRE_P6_GLOW_BLOCK
  .replace("game.ship.hp", "hp")
  .replace("game.lowHpPhase", "phase");
ok(substituted === labBlock,
  "the lab's four-corner block was BYTE-IDENTICAL to drawHUD()'s pre-P6 block, after the three documented substitutions");
ok(PRE_P6_GLOW_BLOCK.indexOf("game.ship.hp") >= 0 && PRE_P6_GLOW_BLOCK.indexOf("game.lowHpPhase") >= 0,
  "both substituted identifiers really were in the frozen block (the compare is not vacuous)");
ok(labSrc.indexOf("PORT-ME BLOCK") >= 0, "the block is labelled PORT-ME, per the house lab pattern");
ok(extractGlowBlock(gameSrc) === null,
  "sanity: the live build no longer contains a four-corner block at all — P6 replaced the shape, confirming this section's frozen-text approach is the live one, not a stale check nobody noticed was vacuous");

// The candidate shapes' peakAlpha() mirror must not drift from that block's own arithmetic.
// Verified by DRAWING with the real block and reading the alpha off the gradient stop it built.
function stopAlpha(str) {
  const mm = String(str).match(/rgba\([^,]+,[^,]+,[^,]+,([^)]+)\)/);
  return mm ? parseFloat(mm[1]) : NaN;
}
function drawShape(key, P, hp, phase) {
  ops = [];
  const c = mkCtx();
  ev("drawGlow")(c, P, hp, phase, key);
  return { ops, ctx: c };
}
const CANDOBJ = ev("CAND"), SHIPOBJ = ev("SHIPPED");
for (const [hp, ph] of [[100, Math.PI / 2], [100, -Math.PI / 2], [50, 0], [1, Math.PI / 2]]) {
  const r = drawShape("corners", SHIPOBJ, hp, ph);
  const a = stopAlpha(r.ops[0].fill.stops[0][1]);
  close(a, ev("peakAlpha")(SHIPOBJ, hp, ph), 1e-12,
    "peakAlpha() mirrors the PORT-ME block at hp=" + hp + " phase=" + ph.toFixed(2));
}
// The two figures §2 of the planning doc is argued from, straight off the real block.
close(stopAlpha(drawShape("corners", SHIPOBJ, 100, -Math.PI / 2).ops[0].fill.stops[0][1]),
  0.02, 1e-12, "shipped alpha at the THRESHOLD trough is 0.10 x 0.2 = 0.02");
close(stopAlpha(drawShape("corners", SHIPOBJ, 1, Math.PI / 2).ops[0].fill.stops[0][1]),
  0.2584, 1e-9, "shipped alpha at the near-death peak is ~0.26");

// ---- D. luminance + contrast arithmetic ----------------------------------
const relLum = ev("relLum"), contrastRatio = ev("contrastRatio"), srgbToLin = ev("srgbToLin");
close(relLum(255, 255, 255), 1, 1e-12, "relLum(white) = 1");
close(relLum(0, 0, 0), 0, 1e-12, "relLum(black) = 0");
close(relLum(255, 0, 0), 0.2126, 1e-12, "relLum(pure red) = the 0.2126 R weight");
close(relLum(0, 255, 0), 0.7152, 1e-12, "relLum(pure green) = the 0.7152 G weight");
close(relLum(0, 0, 255), 0.0722, 1e-12, "relLum(pure blue) = the 0.0722 B weight");
close(relLum(128, 128, 128), 0.21586, 1e-5, "relLum(mid grey) = 0.2159 (sRGB de-gamma, not 0.5)");
// the 0.04045 knee: below it the channel is linear/12.92, above it the 2.4 power curve
close(srgbToLin(10), (10 / 255) / 12.92, 1e-15, "srgbToLin below the knee uses the /12.92 branch");
close(srgbToLin(11), Math.pow((11 / 255 + 0.055) / 1.055, 2.4), 1e-15,
  "srgbToLin above the knee uses the 2.4 power branch");
close(contrastRatio(1, 0), 21, 1e-12, "contrastRatio(white, black) = 21, the WCAG maximum");
close(contrastRatio(0.3, 0.3), 1, 1e-12, "contrastRatio of a colour with itself = 1");
close(contrastRatio(0.4, 0.1), contrastRatio(0.1, 0.4), 1e-12, "contrastRatio is symmetric");
ok(contrastRatio(0.2, 0.01) > contrastRatio(0.1, 0.01), "contrastRatio rises with the brighter term");
close(contrastRatio(0.05, 0), (0.05 + 0.05) / 0.05, 1e-12,
  "the +0.05 flare term is present — the whole reason these figures are usable against #000208");

// ---- E. probes, and the coverage each shape actually achieves -------------
const PROBES = ev("PROBES");
const VIEW_W = ev("VIEW_W"), VIEW_H = ev("VIEW_H");
ok(PROBES.length === 9, "nine probes: four corners, four edge midpoints, one centre control");
ok(PROBES.filter(p => p.control).length === 1, "exactly one control probe");
ok(PROBES[PROBES.length - 1].control === true, "the control is the centre, and it is last");
ok(new Set(PROBES.map(p => p.name)).size === 9, "probe names are unique");
for (const p of PROBES) {
  ok(Number.isInteger(p.x) && Number.isInteger(p.y), p.name + " is at integer pixel coords");
  ok(p.x >= 0 && p.x <= VIEW_W - 1 && p.y >= 0 && p.y <= VIEW_H - 1,
    p.name + " (" + p.x + "," + p.y + ") is inside the viewport");
}
const byName = Object.fromEntries(PROBES.map(p => [p.name, p]));
const INSET = ev("PROBE_INSET");
ok(INSET > 0 && INSET < 40, "the probe inset is a small positive number (" + INSET + ")");
ok(byName["corner TL"].x === INSET && byName["corner TL"].y === INSET, "corner TL is inset from (0,0)");
ok(byName["corner BR"].x === VIEW_W - INSET && byName["corner BR"].y === VIEW_H - INSET,
  "corner BR is inset from (VIEW_W, VIEW_H)");
ok(byName["edge top"].x === VIEW_W / 2 && byName["edge left"].y === VIEW_H / 2,
  "the edge probes sit at the midpoint of their edge");
ok(byName["centre"].x === VIEW_W / 2 && byName["centre"].y === VIEW_H / 2, "the control is dead centre");

// Evaluate a recorded paint at a point: rect bounds, then the gradient's own falloff.
// (Radial gradients here are always centre-to-r with r0 = 0; linear ones are axis-projected.)
function gradAlphaAt(f, px, py) {
  let t;
  if (f.kind === "radial") {
    const [, , , x1, y1, r1] = f.coords;
    t = Math.hypot(px - x1, py - y1) / r1;
  } else {
    const [x0, y0, x1, y1] = f.coords;
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
    t = len2 === 0 ? 0 : ((px - x0) * dx + (py - y0) * dy) / len2;
  }
  t = Math.max(0, Math.min(1, t));
  const st = f.stops.map(s => [s[0], stopAlpha(s[1])]).sort((a, b) => a[0] - b[0]);
  if (t <= st[0][0]) return st[0][1];
  if (t >= st[st.length - 1][0]) return st[st.length - 1][1];
  for (let i = 1; i < st.length; i++) {
    if (t <= st[i][0]) {
      const k = (t - st[i - 1][0]) / (st[i][0] - st[i - 1][0]);
      return st[i - 1][1] + (st[i][1] - st[i - 1][1]) * k;
    }
  }
  return 0;
}
function coverAt(shapeOps, px, py) {
  let acc = 0;   // source-over accumulation of same-coloured layers
  for (const o of shapeOps) {
    if (px < o.x || px >= o.x + o.w || py < o.y || py >= o.y + o.h) continue;
    const a = typeof o.fill === "string" ? stopAlpha(o.fill) : gradAlphaAt(o.fill, px, py);
    if (a > 0) acc = acc + a * (1 - acc);
  }
  return acc;
}
// The base render for the glow-to-background ratio must draw NO glow at all.
ok(drawShape(null, SHIPOBJ, 1, Math.PI / 2).ops.length === 0,
  "drawGlow with a null shape key paints nothing — that is the no-glow BASE render");

const SHAPE_KEYS = ev("Object.keys(SHAPES)");
ok(SHAPE_KEYS.length === 4, "four shapes offered (got " + SHAPE_KEYS.join(",") + ")");
for (const k of ["corners", "vignette", "bars", "cornersAtt"])
  ok(SHAPE_KEYS.indexOf(k) >= 0, "shape '" + k + "' is offered");

for (const key of SHAPE_KEYS) {
  const r = drawShape(key, CANDOBJ, 1, Math.PI / 2);   // near death, pulse peak — the loudest case
  ok(r.ops.length > 0, key + ": draws at least one fill");
  ok(r.ops.every(o => o.w >= 0 && o.h >= 0), key + ": no negative-area fill");
  ok(r.ops.some(o => o.w > 0 && o.h > 0), key + ": at least one fill has real area");
  ok(r.ops.some(o => PROBES.some(p => coverAt([o], p.x, p.y) > 0)),
    key + ": paints a nonzero alpha on at least one probe");
  // ⛔ no shadowBlur, and no globalAlpha, in any candidate shape (see the lab's block comment)
  ok(r.ops.every(o => o.blur === 0), key + ": no fill is drawn with shadowBlur set");
  ok(r.ctx.shadowBlur === 0 && r.ctx.globalAlpha === 1,
    key + ": leaves shadowBlur at 0 and globalAlpha at 1");
}
// source-level, so a set-then-reset can't hide either
// comments stripped first: the block comment above the candidate shapes NAMES both hazards,
// which is the point of it — the check is about code, not about prose.
const shapeSrc = labSrc.slice(labSrc.indexOf("function glowCorners("),
                              labSrc.indexOf("const SHAPES = {"))
  .split("\n").map(l => l.replace(/\/\/.*$/, "")).join("\n");
ok(shapeSrc.indexOf("shadowBlur") === -1, "no shape function mentions shadowBlur at all");
ok(shapeSrc.indexOf("globalAlpha") === -1, "no shape function mentions globalAlpha at all");
ok(shapeSrc.indexOf("glowStroke") === -1, "no shape function strokes — every shape is a FILL");

// The hypothesis, as an assertion: the SHIPPED corner shape reaches no edge midpoint.
{
  const r = drawShape("corners", SHIPOBJ, 1, Math.PI / 2).ops;
  for (const n of ["corner TL", "corner TR", "corner BL", "corner BR"])
    ok(coverAt(r, byName[n].x, byName[n].y) > 0, "shipped corners: lights " + n);
  for (const n of ["edge top", "edge bottom", "edge left", "edge right"])
    close(coverAt(r, byName[n].x, byName[n].y), 0, 1e-12,
      "shipped corners: paints NOTHING at " + n + " — hypothesis (b), the dark middle of every edge");
  ok(coverAt(r, byName["centre"].x, byName["centre"].y) === 0,
    "shipped corners: the centre control is untouched by the glow");
}
// The two shapes that exist to fix that reach every edge probe.
for (const key of ["vignette", "bars"]) {
  const r = drawShape(key, CANDOBJ, 1, Math.PI / 2).ops;
  for (const p of PROBES.filter(p => !p.control))
    ok(coverAt(r, p.x, p.y) > 0, key + ": lights " + p.name);
}
// The attenuated shape dims exactly the two OCCUPIED corners, by exactly the factor.
{
  const P = Object.assign({}, CANDOBJ, { LOWHP_GLOW_OCC_ATTEN: 0.25 });
  const r = drawShape("cornersAtt", P, 1, Math.PI / 2).ops;
  const free = coverAt(r, byName["corner TL"].x, byName["corner TL"].y);
  const occTR = coverAt(r, byName["corner TR"].x, byName["corner TR"].y);
  const occBL = coverAt(r, byName["corner BL"].x, byName["corner BL"].y);
  const freeBR = coverAt(r, byName["corner BR"].x, byName["corner BR"].y);
  close(occTR, free * 0.25, 1e-12, "cornersAtt: top-right (HULL/CARGO) is attenuated by OCC_ATTEN");
  close(occBL, free * 0.25, 1e-12, "cornersAtt: bottom-left (powerup rows) is attenuated by OCC_ATTEN");
  close(freeBR, free, 1e-12, "cornersAtt: the two FREE corners are untouched");
  ok(ev("OCCUPIED.length") === 2 && ev("isOccupied")([VIEW_W, 0]) && ev("isOccupied")([0, VIEW_H]),
    "the occupied set is exactly top-right and bottom-left");
  ok(!ev("isOccupied")([0, 0]) && !ev("isOccupied")([VIEW_W, VIEW_H]),
    "the other two corners are not marked occupied");
}
// The bars shape is uniform the whole way round — that is what makes it the shape that measures
// best and (per its own header) may still read worst.
{
  const r = drawShape("bars", CANDOBJ, 1, Math.PI / 2).ops;
  const vals = PROBES.filter(p => !p.control).map(p => coverAt(r, p.x, p.y));
  close(Math.max(...vals) - Math.min(...vals), 0, 1e-12, "bars: identical alpha at all 8 edge probes");
}
// Brightness is monotone in the alpha knobs, at the t the gate cares about most (t = 0).
{
  const dim = drawShape("corners", Object.assign({}, SHIPOBJ, { LOWHP_GLOW_ALPHA_MIN: 0.10 }), 100, Math.PI / 2).ops;
  const bright = drawShape("corners", Object.assign({}, SHIPOBJ, { LOWHP_GLOW_ALPHA_MIN: 0.40 }), 100, Math.PI / 2).ops;
  ok(coverAt(bright, byName["corner TL"].x, byName["corner TL"].y) >
     coverAt(dim, byName["corner TL"].x, byName["corner TL"].y),
    "raising ALPHA_MIN raises the corner alpha at t=0");
  const wide = drawShape("corners", Object.assign({}, SHIPOBJ, { LOWHP_GLOW_RADIUS: 700 }), 100, Math.PI / 2).ops;
  ok(coverAt(wide, byName["edge top"].x, byName["edge top"].y) > 0,
    "a wide enough radius does reach the top edge midpoint — the radius lever is real");
}

// ---- F. the measurement report -------------------------------------------
{
  const rep = ev("measure()");
  ok(rep.rows.length === 9, "the report carries one row per probe");
  ok(rep.rows.every(r => ["base", "cand", "ship"].every(k => k in r)),
    "every row carries base, candidate and shipped figures");
  ok(rep.rows.every(r => ["pk", "tr", "pkTr", "glowBg"].every(k => k in r.cand && k in r.ship)),
    "each side reports L peak, L trough, peak:trough and glow:bg");
  ok(rep.rows.every(r => Number.isFinite(r.cand.glowBg) && Number.isFinite(r.ship.glowBg)),
    "no ratio comes back NaN or Infinite");
  ok(rep.worst && rep.worst.control !== true, "the worst-probe headline never lands on the control");
  const edge = rep.rows.filter(r => !r.control);
  close(rep.worstCand, Math.min(...edge.map(r => r.cand.glowBg)), 1e-12,
    "worstCand is the MINIMUM candidate glow:bg across the 8 edge probes");
  close(rep.worstShip, Math.min(...edge.map(r => r.ship.glowBg)), 1e-12,
    "worstShip is the same minimum for the shipped values");
  ok(ev("PHASE_PEAK") === Math.PI / 2 && ev("PHASE_TROUGH") === -Math.PI / 2,
    "the measurement poses are the exact sin = +-1 phases, not sampled from the animation");
  close(0.6 + 0.4 * Math.sin(ev("PHASE_PEAK")), 1.0, 1e-12, "the peak pose gives gpulse 1.0");
  close(0.6 + 0.4 * Math.sin(ev("PHASE_TROUGH")), 0.2, 1e-12, "the trough pose gives gpulse 0.2");
}

// ---- G. the dump round-trips the sliders ----------------------------------
function dump() { return elements["dump"].textContent; }
function parseDump(d) {
  const num = n => {
    const mm = d.match(new RegExp("^const " + n + "\\s*=\\s*([0-9.]+);", "m"));
    return mm ? parseFloat(mm[1]) : null;
  };
  const str = n => {
    const mm = d.match(new RegExp('^const ' + n + '\\s*=\\s*"([^"]*)";', "m"));
    return mm ? mm[1] : null;
  };
  return {
    alphaMin: num("LOWHP_GLOW_ALPHA_MIN"), alphaMax: num("LOWHP_GLOW_ALPHA_MAX"),
    radius: num("LOWHP_GLOW_RADIUS"), occ: num("LOWHP_GLOW_OCC_ATTEN"),
    rgb: str("LOWHP_GLOW_RGB"),
    rateMin: num("LOWHP_PULSE_RATE_MIN"), rateMax: num("LOWHP_PULSE_RATE_MAX"),
  };
}
ev("refreshDump()");
{
  const d0 = parseDump(dump());
  ok(d0.alphaMin === 0.10 && d0.alphaMax === 0.26 && d0.radius === 280 && d0.rgb === "255,64,64",
    "the dump at defaults emits the shipped constants verbatim");
  ok(d0.rateMin === null && d0.rateMax === null,
    "the pulse-rate constants are omitted while unchanged — they are not glow knobs");
  ok(dump().indexOf("mirrors COLOR.lowhp") >= 0, "the dump says the RGB mirror is intact");
}
// move every slider, then read the block back
function setSlider(id, v) { elements[id].value = String(v); fire(id, "input"); }
setSlider("alphaMin", 0.18);
setSlider("alphaMax", 0.44);
setSlider("radius", 520);
setSlider("hp", 40);
{
  const d = parseDump(dump());
  ok(d.alphaMin === 0.18, "dump round-trips ALPHA_MIN 0.18");
  ok(d.alphaMax === 0.44, "dump round-trips ALPHA_MAX 0.44");
  ok(d.radius === 520, "dump round-trips RADIUS 520");
  ok(ev("CAND.LOWHP_GLOW_ALPHA_MIN") === 0.18 && ev("CAND.LOWHP_GLOW_RADIUS") === 520,
    "the sliders really moved the candidate parameter set, not just the text");
  ok(ev("state.hp") === 40, "the HP slider drives the lab's hull state");
  ok(dump().indexOf("t = 0.60") >= 0, "the dump records the t it was measured at (hp 40 -> t 0.60)");
  ok(elements["tRead"].textContent === "0.60", "the headline reports t alongside HP");
}
// the RGB mirror warning is a real, reversible state
setSlider("rgbG", 160);
{
  ok(ev("CAND.LOWHP_GLOW_RGB") === "255,160,64", "the three RGB sliders compose the build's triple");
  ok(parseDump(dump()).rgb === "255,160,64", "the dump round-trips a moved RGB");
  ok(dump().indexOf("NO LONGER MIRRORS") >= 0, "breaking the COLOR.lowhp mirror is called out in the dump");
  fire("mirrorBtn", "click");
  ok(ev("CAND.LOWHP_GLOW_RGB") === "255,64,64", "'Restore the mirror' puts the default back");
  ok(dump().indexOf("mirrors COLOR.lowhp") >= 0, "and the dump says so again");
}
// a rate move is emitted, loudly, and flagged as not-a-glow-knob
setSlider("rateMin", 1.6);
ok(parseDump(dump()).rateMin === 1.6, "a moved pulse rate is emitted");
ok(dump().indexOf("NOT GLOW KNOBS") >= 0,
  "…under the warning that lowhpPulseRate(t) also drives the siren and the hull ring");
setSlider("rateMin", 0.9);

// shape selection changes what the dump asks P6 to do
{
  fire("shapeRow", "click", 3);                     // "Corners, occupied dimmed"
  ok(ev("shape") === "cornersAtt", "the shape buttons select a shape");
  const d = parseDump(dump());
  ok(d.occ !== null, "the OCC_ATTEN constant appears only for the shape that uses it");
  ok(dump().indexOf("SHAPE MOVED") >= 0, "a non-shipped shape tells P6 the draw block itself moves");
  ok(dump().indexOf("no shadowBlur") >= 0 || dump().indexOf("NO shadowBlur") >= 0,
    "…and restates the fill / no-shadowBlur constraint P6 must hold to");
  fire("shapeRow", "click", 0);                     // back to four corners
  ok(ev("shape") === "corners", "and back to the shipped shape");
  ok(parseDump(dump()).occ === null, "OCC_ATTEN is dropped again when the shape does not use it");
  ok(dump().indexOf("SHAPE MOVED") === -1, "no shape warning on the shipped shape");
}
// the GATE A answer line, which is what the gate is actually argued from
for (const tag of ["A1 shape", "A2 alphas", "A3 radius", "A4 pulse", "A5 rgb"])
  ok(dump().indexOf(tag) >= 0, "the dump answers " + tag);
ok(/worst-probe glow:bg\s+[0-9.]+ vs today's [0-9.]+ \(x[0-9.]+\)/.test(dump()),
  "A2 quotes the candidate's worst-probe ratio as a multiple of today's");

// ---- H. reset puts everything back ---------------------------------------
fire("resetBtn", "click");
{
  const d = parseDump(dump());
  ok(d.alphaMin === 0.10 && d.alphaMax === 0.26 && d.radius === 280 && d.rgb === "255,64,64",
    "Reset restores every shipped constant");
  ok(ev("shape") === "corners", "Reset restores the shipped shape");
  ok(ev("state.hp") === 40, "Reset leaves the HP slider alone — it is hull state, not a candidate value");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
