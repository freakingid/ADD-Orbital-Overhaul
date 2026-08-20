// scratchpad/test-cs038-p1.js — CS038 P1: the Credits screen.
//
// Sections:
//  (A) node --check; CREDITS_ROWS shape; every link's url; the version line reads GAME_VERSION.
//  (B) The twelve satellite names, against SAT_ART's own comment header — an inspiration list, and
//      the "No assets were used." line that makes it one (spec C1).
//  (C) MENU_OPTIONS carries "Credits" before "Back", every consumer still resolves by label, and the
//      5th row still fits drawOptionsMenu's 600x420 panel.
//  (D) Nav: up/down land only on link rows, wrap both directions, and the scroll follows the cursor.
//  (E) back -> "options" with the cursor on the Credits row; pause -> closePause.
//  (F) openExternal: null return and a throwing window.open both set the status and neither throws;
//      "noopener" is passed.
//  (G) drawCredits at every selection state and both scroll extremes, under the harness canvas stub.
//
// ⛔ The harness's ctx Proxy answers unknown methods with () => {} — see achTextW()'s header. This
//    file draws nothing that measures text, and asserts through the fillText log rather than pixels.
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");
const { buildGame, mkAssert, scriptSource, execSource } = require("./_harness.js");

const A = mkAssert();
const { assert, eq, report } = A;
const src = scriptSource();
// Comment-free TEXT for the "is this the only call site?" questions below — openExternal's own header
// names window.open twice in prose, and a raw-source count would read those as call sites.
const code = execSource(src);

// ================= (A) syntax + the table's own shape =====================
(function sectionA() {
  console.log("(A) node --check; CREDITS_ROWS shape; link urls; the version line reads GAME_VERSION");
  const tmp = path.join(os.tmpdir(), "cs038-p1-extracted.js");
  fs.writeFileSync(tmp, src);
  try { execFileSync("node", ["--check", tmp], { stdio: "pipe" }); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: syntax: " + e.stderr.toString()); }

  const X = buildGame();
  const rows = X.CREDITS_ROWS;
  assert(Array.isArray(rows) && rows.length > 0, "A: CREDITS_ROWS is a non-empty array");
  const KINDS = new Set(["head", "text", "link", "gap"]);
  assert(rows.every(r => r && KINDS.has(r.kind)), "A: every row carries a kind of head/text/link/gap");
  assert(rows.every(r => r.kind === "gap" || (typeof r.text === "string" && r.text.length > 0)),
    "A: every non-gap row carries non-empty text");
  assert(rows.filter(r => r.kind === "gap").every(r => r.text === undefined),
    "A: a gap row is pure vertical air — it carries no text");

  const links = rows.filter(r => r.kind === "link");
  eq(links.length, 6, "A: six link rows (CS038 GATE B: Asteroids Deluxe promoted to a link)");
  assert(links.every(r => typeof r.url === "string" && /^https:\/\/\S+$/.test(r.url)),
    "A: every link carries a non-empty https url with no whitespace");
  assert(rows.filter(r => r.kind !== "link").every(r => r.url === undefined),
    "A: only link rows carry a url");
  const urls = links.map(r => r.url);
  for (const want of ["https://coinlessgames.com",
                      "https://coinlessgames.itch.io/orbital-overhaul",
                      "https://github.com/freakingid/ADD-Orbital-Overhaul",
                      "https://en.wikipedia.org/wiki/Asteroids_Deluxe",
                      "https://www.anthropic.com/claude-code",
                      "https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API"])
    assert(urls.includes(want), `A: spec §1.3 link present: ${want}`);
  eq(new Set(urls).size, urls.length, "A: no url is listed twice");

  // The version line is DERIVED, not typed — value first, then the source, because the value alone
  // would pass against a literal that happens to be current today.
  const ver = rows.find(r => r.kind === "text" && /^Version /.test(r.text));
  assert(!!ver, "A: a 'Version …' row exists");
  eq(ver && ver.text, "Version " + X.GAME_VERSION, "A: the version row reads GAME_VERSION's value");
  const table = src.slice(src.indexOf("const CREDITS_ROWS = ["), src.indexOf("];", src.indexOf("const CREDITS_ROWS = [")));
  assert(/"Version " \+ GAME_VERSION/.test(table),
    "A: ...and reads it FROM THE CONSTANT — the table interpolates GAME_VERSION");
  assert(!/\d+\.\d+\.\d+\.\d+/.test(table), "A: no version literal anywhere in the table");

  // The order the spec fixes (§1.3), asserted as the sequence of heads rather than row-by-row.
  const heads = rows.filter(r => r.kind === "head").map(r => r.text);
  eq(JSON.stringify(heads), JSON.stringify([
    "ORBITAL OVERHAUL", "MADE BY", "FIND IT AT", "INSPIRED BY", "BUILT WITH",
    "EVERYTHING YOU HEAR IS SYNTHESISED", "SATELLITE SILHOUETTES", "LICENSE"]),
    "A: the eight section headings, in spec §1.3's order");
  assert(rows[0].kind === "head", "A: row 0 is a heading — which is why index 0 is not a valid cursor");
})();

// ================= (B) the satellite block is an INSPIRATION list =====================
(function sectionB() {
  console.log("(B) twelve SAT_ART names, in shipped order, under a 'No assets were used.' line");
  const X = buildGame();
  const rows = X.CREDITS_ROWS;
  // SAT_ART's craft are identified in its own per-entry header comment, so the names are read out of
  // the SOURCE TEXT (a text-analysis job — _harness.js's own split) rather than off the evaluated
  // array, which carries geometry only.
  const art = src.slice(src.indexOf("const SAT_ART = ["));
  const names = [...art.matchAll(/^  \{ \/\/ (\d+) — ([^(]+?) \(/gm)].map(m => m[2].trim());
  eq(names.length, 12, "B: SAT_ART declares twelve craft");
  eq(X.SAT_ART.length, 12, "B: ...and the evaluated array agrees");

  const start = rows.findIndex(r => r.kind === "head" && r.text === "SATELLITE SILHOUETTES");
  assert(start >= 0, "B: the SATELLITE SILHOUETTES block exists");
  const block = rows.slice(start).filter(r => r.kind === "text").map(r => r.text);
  // ⛔ THE LOAD-BEARING LINE. Spec C1 / FLAG A-7: the silhouettes are original line drawings authored
  // in code, and this is an inspiration list, not an attribution list. A credit that read as crediting
  // a source would assert the opposite of what is true and put the GPL-3.0 licence in question.
  assert(block.some(t => /No assets were used\./.test(t)),
    "B: ⛔ the block states 'No assets were used.' — it is an INSPIRATION list, not an attribution list");
  assert(block.some(t => /Drawn from scratch in code/.test(t)), "B: ...and that the shapes were drawn from scratch in code");
  assert(!/attribut|courtesy|credit to|image|photo/i.test(block.join(" ")),
    "B: ...and says nothing that reads as crediting a source");

  // Every credited name is one of SAT_ART's own, in SAT_ART's order. Two are shortened to fit the
  // line ("Hubble", "James Webb"), so the pin is prefix-exact rather than string-exact — a name that
  // is not a prefix of the craft it stands for fails here.
  const listed = block.filter(t => t.includes("·")).join(" · ").split("·").map(t => t.trim()).filter(Boolean);
  eq(listed.length, 12, "B: twelve craft named in the credits");
  names.forEach((n, i) => assert(n.startsWith(listed[i]),
    `B: credit ${i} "${listed[i]}" is SAT_ART's craft ${i} ("${n}"), in shipped order`));
})();

// ================= (C) the MENU_OPTIONS row =====================
(function sectionC() {
  console.log("(C) MENU_OPTIONS: Credits before Back; label-resolved consumers; 5 rows still fit");
  const X = buildGame();
  const opts = X.MENU_OPTIONS;
  assert(opts.includes("Credits"), "C: MENU_OPTIONS carries a Credits row");
  assert(opts.indexOf("Credits") < opts.indexOf("Back"), "C: Credits sits before Back");
  eq(opts.indexOf("Credits"), opts.length - 2, "C: ...immediately before it, as spec §1.1 places it");
  assert(!X.MENU_TITLE.includes("Credits"), "C: the title menu is NOT a second parent (FORK-CS038-A -> c)");
  const parents = [X.MENU_TITLE, X.MENU_ROOT_PLAY, X.MENU_ROOT_OVER, X.SOUND_ROWS]
    .filter(Boolean).filter(list => list.includes("Credits"));
  eq(parents.length, 0, "C: ⛔ ONE parent — no other row list offers a Credits row (CS016 P2's IA)");

  // Every consumer resolves by LABEL. A numeric literal in a gotoScreen("options", …) call is exactly
  // what the insert would silently break, so the source is checked for one.
  const optionCalls = [...src.matchAll(/gotoScreen\("options"([^)]*)\)/g)].map(m => m[1].trim());
  assert(optionCalls.length > 0, "C: (non-vacuous) gotoScreen(\"options\", …) call sites exist");
  assert(optionCalls.every(a => a === "" || /MENU_OPTIONS\.indexOf\(/.test(a)),
    `C: every gotoScreen("options", …) resolves via MENU_OPTIONS.indexOf; got ${JSON.stringify(optionCalls)}`);
  assert(!/MENU_OPTIONS\[\s*\d/.test(src), "C: nothing indexes MENU_OPTIONS by a numeric literal");

  // drawOptionsMenu's 600x420 panel: rows start at y+118 and step 42px. Read the numbers off the
  // renderer's own source rather than restating them, so a later resize can't leave this pin stale.
  const draw = src.slice(src.indexOf("function drawOptionsMenu()"), src.indexOf("function drawSound()"));
  const panel = /menuPanel\((\d+),\s*(\d+),\s*"OPTIONS"\)/.exec(draw);
  const row = /y \+ (\d+) \+ i \* (\d+)/.exec(draw);
  const hint = /drawMenuHint\([^,]+,[^,]+,\s*y \+ (\d+)\)/.exec(draw);
  assert(panel && row && hint, "C: (non-vacuous) drawOptionsMenu's panel/row/hint geometry is readable");
  if (panel && row && hint) {
    const h = +panel[2], last = +row[1] + (opts.length - 1) * +row[2], footer = +hint[1];
    assert(last < footer, `C: the last of ${opts.length} rows (y+${last}) clears the footer (y+${footer})`);
    assert(footer < h, `C: ...and the footer (y+${footer}) is inside the ${panel[1]}x${h} panel`);
  }
})();

// ================= (D) nav lands only on link rows, wraps, and drags the scroll =====================
(function sectionD() {
  console.log("(D) up/down select link rows only, wrap both ways, scroll follows the cursor");
  const X = buildGame();
  const g = X.game;
  const rows = X.CREDITS_ROWS;
  const linkIdx = rows.map((r, i) => r.kind === "link" ? i : -1).filter(i => i >= 0);

  // Entry through the real Options dispatch, so the new branch is what puts the screen up.
  g.menu.screen = "options";
  g.menu.index = X.MENU_OPTIONS.indexOf("Credits");
  X.menuInput("confirm");
  eq(g.menu.screen, "credits", "D: Options -> Credits");
  eq(g.menu.index, linkIdx[0], "D: the cursor lands on the FIRST link, not on gotoScreen's index 0");
  eq(g.menu.scroll, 0, "D: ...unscrolled");

  // A full lap down, then a full lap up. Every landing is a link row; the walk closes on itself.
  const down = [];
  for (let k = 0; k < linkIdx.length; k++) { down.push(g.menu.index); X.menuInput("down"); }
  eq(JSON.stringify(down), JSON.stringify(linkIdx), "D: down walks every link row in order");
  eq(g.menu.index, linkIdx[0], "D: down from the last link wraps to the first");
  X.menuInput("up");
  eq(g.menu.index, linkIdx[linkIdx.length - 1], "D: up from the first link wraps to the last");
  const up = [];
  for (let k = 0; k < linkIdx.length; k++) { up.push(g.menu.index); X.menuInput("up"); }
  eq(JSON.stringify(up), JSON.stringify(linkIdx.slice().reverse()), "D: up walks every link row in reverse");

  // Nothing a head/text/gap row could ever be selected by.
  for (let k = 0; k < 4 * rows.length; k++) {
    X.menuInput(k % 3 === 0 ? "up" : "down");
    if (rows[g.menu.index].kind !== "link") {
      assert(false, `D: nav landed on a ${rows[g.menu.index].kind} row (index ${g.menu.index})`);
      break;
    }
  }
  A.passed++;   // the loop above asserts by exception; reaching here is the pass

  // The scroll is DERIVED from the cursor and clamps against the one ceiling the renderer uses.
  const max = X.creditsMaxScroll();
  assert(max > 0, "D: (non-vacuous) the content is taller than the panel, so the scroll ceiling is real");
  g.menu.index = linkIdx[0]; X.menuInput("down"); X.menuInput("up");
  eq(X.creditsScroll(), 0, "D: the FIRST link pins the window to the top of the content");
  g.menu.index = linkIdx[linkIdx.length - 1];
  eq(X.creditsScroll(), max, "D: ⛔ the LAST link pins it to the bottom — the only way the tail rows are seen");
  g.menu.scroll = 99999; X.creditsScroll();
  assert(g.menu.scroll <= max, "D: a wild scroll value is clamped to creditsMaxScroll()");
  g.menu.scroll = -50; X.creditsScroll();
  assert(g.menu.scroll >= 0, "D: ...and never goes negative");
  // Every intermediate link is fully inside the window its own selection produces.
  const L = X.creditsLayout(), lead = X.CREDITS_ROW0_Y - X.CREDITS_CLIP_TOP;
  for (const i of linkIdx) {
    g.menu.index = i;
    const s = X.creditsScroll(), r = L.rows[i];
    assert(lead + r.top >= s - 0.001 && lead + r.bot <= s + X.CREDITS_VISIBLE_H + 0.001,
      `D: link row ${i} (label AND url) is fully visible at its own derived scroll`);
  }
  // ...and every row in the table is visible at one scroll extreme or the other, so nothing in
  // CREDITS_ROWS is unreachable — the reason the two pins above exist.
  L.rows.forEach((r, i) => {
    const atTop = lead + r.bot <= X.CREDITS_VISIBLE_H + 0.001;
    const atBot = lead + r.top >= max - 0.001;
    assert(atTop || atBot, `D: row ${i} (${rows[i].kind}) is reachable at one of the two scroll extremes`);
  });
})();

// ================= (E) back / pause destinations =====================
(function sectionE() {
  console.log("(E) back -> Options with the cursor on Credits; pause closes the overlay");
  const X = buildGame();
  const g = X.game;
  X.openCredits();
  X.menuInput("back");
  eq(g.menu.screen, "options", "E: back returns to Options");
  eq(X.MENU_OPTIONS[g.menu.index], "Credits", "E: ...with the cursor on the Credits row");

  // From a paused live run, pause (gamepad Start) closes the whole overlay, as on every sibling.
  X.startGame();
  X.openPause();
  g.menu.screen = "credits"; g.menu.index = X.creditsFirstLink();
  X.menuInput("pause");
  assert(g.paused === false, "E: pause closes the overlay from the Credits screen");

  // gotoScreen clears the status line, for slotMsg's reason exactly.
  g.menu.linkMsg = "stale";
  X.gotoScreen("options");
  eq(g.menu.linkMsg, "", "E: gotoScreen clears linkMsg — no stale banner survives a screen change");
  // Both game.menu literals carry the field (the standing CS016 P3 rule).
  X.startGame();
  eq(g.menu.linkMsg, "", "E: startGame's menu literal carries linkMsg (never undefined mid-run)");
  assert("linkMsg" in g.menu, "E: ...as an own field, not an accident of assignment");
})();

// ================= (F) openExternal =====================
(function sectionF() {
  console.log("(F) openExternal: noopener is passed; null and a throw both report, neither escapes");
  // `window` is the factory's own parameter, so it is exported by expression rather than harvested.
  const X = buildGame({ extraExports: ["win: window"] });
  const g = X.game;
  const url = "https://example.invalid/x";

  let seen = null;
  X.win.open = (...a) => { seen = a; return null; };
  g.menu.linkMsg = "";
  let ret;
  try { ret = X.openExternal(url); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: F: openExternal threw on a null return: " + e); }
  eq(JSON.stringify(seen), JSON.stringify([url, "_blank", "noopener"]),
    "F: ⛔ window.open(url, \"_blank\", \"noopener\") — noopener is not optional");
  eq(g.menu.linkMsg, X.CREDITS_LINK_MSG, "F: a null return sets the status line — never silent");
  eq(ret, false, "F: ...and reports false");

  X.win.open = () => { throw new Error("blocked"); };
  g.menu.linkMsg = "";
  try { ret = X.openExternal(url); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: F: openExternal let a throw escape: " + e); }
  eq(g.menu.linkMsg, X.CREDITS_LINK_MSG, "F: a throwing window.open sets the same status line");
  eq(ret, false, "F: ...and reports false");

  // A window handle comes back: still reported, because with noopener the build cannot tell a real
  // success from a block — see openExternal's header. What matters is that nothing throws.
  X.win.open = () => ({});
  g.menu.linkMsg = "";
  try { ret = X.openExternal(url); A.passed++; }
  catch (e) { A.failed++; console.error("  FAIL: F: openExternal threw on a handle: " + e); }
  eq(ret, true, "F: a returned handle reports true");
  assert(typeof X.CREDITS_LINK_MSG === "string" && X.CREDITS_LINK_MSG.length > 0,
    "F: the status string is real text");

  // confirm on a link row actuates through it; confirm elsewhere on the screen cannot.
  X.win.open = (...a) => { seen = a; return null; };
  seen = null;
  X.openCredits();
  X.menuInput("confirm");
  eq(seen && seen[0], X.CREDITS_ROWS[X.creditsFirstLink()].url, "F: confirm opens the selected link's url");
  eq(seen && seen[2], "noopener", "F: ...through the same noopener call");

  // The build's ONLY window.open, and it goes through this one helper.
  const opens = [...code.matchAll(/window\.open\s*\(/g)].length;
  eq(opens, 1, "F: exactly one window.open in the build — openExternal is the single route");
})();

// ================= (G) drawCredits =====================
(function sectionG() {
  console.log("(G) drawCredits: every selection state and both scroll extremes render without throwing");
  const calls = [];
  const X = buildGame({
    measureText: state => s => ({ width: (parseFloat(state.font) || 10) * 0.6 * String(s).length }),
  });
  const g = X.game;
  // Log fillText through the ctx the build already holds — the harness Proxy answers unknown methods
  // with () => {}, so the log is installed as a property on it rather than by replacing the object.
  X.ctx.fillText = (str, x, y) => calls.push({ str, x, y, color: X.ctx.fillStyle, font: X.ctx.font });

  const rows = X.CREDITS_ROWS;
  const linkIdx = rows.map((r, i) => r.kind === "link" ? i : -1).filter(i => i >= 0);
  const max = X.creditsMaxScroll();

  for (const i of linkIdx) {
    calls.length = 0;
    g.menu.screen = "credits"; g.menu.index = i;
    let threw = null;
    try { X.drawMenu(); } catch (e) { threw = e; }
    assert(!threw, `G: drawMenu dispatches to drawCredits with the cursor on row ${i} without throwing (${threw})`);
    const drawn = calls.map(c => c.str);
    // ⛔ THE URL IS ALWAYS DRAWN — selected or not. This is FORK-CS038-B -> (c) itself.
    for (const j of linkIdx) {
      const r = rows[j];
      assert(drawn.includes(r.url), `G: ⛔ url "${r.url}" is drawn while row ${i} is selected (not only the selected row)`);
      // Matched on the PREFIXED string: "Coinless Games" is both a link label and a plain text row,
      // so an endsWith() search would find the wrong one.
      const want = (j === i ? "▶ " : "   ") + r.text;
      const label = calls.find(c => c.str === want);
      assert(!!label, `G: row ${j} draws as "${want}" while ${i} is selected`);
      if (label) eq(label.color, j === i ? X.COLOR.text : X.COLOR.menuIdle,
        `G: row ${j} draws in the ${j === i ? "selected" : "idle"} colour`);
      const u = calls.find(c => c.str === r.url);
      if (u) eq(u.color, X.COLOR.dim, `G: url "${r.url}" draws in COLOR.dim`);
    }
    // Heads and texts keep their own colours; gaps draw nothing.
    for (const r of rows) {
      if (r.kind === "head") {
        const c = calls.find(c2 => c2.str === r.text);
        if (c) eq(c.color, X.COLOR.text, `G: head "${r.text}" draws in COLOR.text`);
      } else if (r.kind === "text") {
        const c = calls.find(c2 => c2.str === r.text);
        if (c) eq(c.color, X.COLOR.menuIdle, `G: text "${r.text}" draws in COLOR.menuIdle`);
      }
    }
    assert(calls.some(c => c.str === X.CREDITS_HINT), "G: the drawMenuHint footer is drawn");
  }

  // Both scroll extremes, driven through the field the renderer clamps.
  for (const [where, idx] of [["top", X.creditsFirstLink()], ["bottom", X.creditsLastLink()]]) {
    calls.length = 0;
    g.menu.index = idx;
    let threw = null;
    try { X.drawCredits(); } catch (e) { threw = e; }
    assert(!threw, `G: drawCredits at the ${where} of the scroll renders without throwing (${threw})`);
    eq(g.menu.scroll, where === "top" ? 0 : max, `G: ...at scroll ${where === "top" ? 0 : max}`);
    const cues = calls.filter(c => c.str === "▲" || c.str === "▼").map(c => c.str);
    eq(JSON.stringify(cues), JSON.stringify(where === "top" ? ["▼"] : ["▲"]),
      `G: the ${where} extreme shows only the ${where === "top" ? "down" : "up"} scroll cue`);
  }

  // The status line renders when set, and not when it isn't.
  g.menu.index = X.creditsFirstLink();
  g.menu.linkMsg = "";
  calls.length = 0; X.drawCredits();
  assert(!calls.some(c => c.str === X.CREDITS_LINK_MSG), "G: no status line when linkMsg is empty");
  g.menu.linkMsg = X.CREDITS_LINK_MSG;
  calls.length = 0; X.drawCredits();
  assert(calls.some(c => c.str === X.CREDITS_LINK_MSG), "G: the status line renders when linkMsg is set");

  // A stale cursor (a caller that reached the screen without openCredits) still renders sanely.
  g.menu.index = 0;   // row 0 is a heading
  calls.length = 0;
  let threw = null;
  try { X.drawCredits(); } catch (e) { threw = e; }
  assert(!threw, `G: a cursor parked on a non-selectable row still renders (${threw})`);
  const sel = calls.filter(c => c.str.startsWith("▶ "));
  eq(sel.length, 1, "G: ...with exactly one selection marker, snapped to the first link");

  // ⛔ No fillRect/strokeRect grew here — the HUD/menu no-bar rule (GDD §3.2). The clip is a clip.
  const body = src.slice(src.indexOf("function drawCredits()"), src.indexOf("// Hidden Debug Options panel renderer"));
  assert(!/fillRect|strokeRect/.test(body), "G: drawCredits paints no bars or rects of its own");
  assert(/ctx\.clip\(\)/.test(body), "G: ...it clips the scrolling region, drawHighScores' idiom");
})();

report();
