// CS010 P8 headless test — tools/voice-lab.html (the formant-synthesis instrument).
// Drives the REAL lab script (extracted from the HTML, run under a stubbed DOM) — never a copy.
// No AudioContext is created: VL.ensure() only runs on a user gesture, so everything tested here
// is the pure layer (dictionary, g2p, buildUtterance, the 24 verbatim lines, the dump).
"use strict";
const fs = require("fs");
const vm = require("vm");
const path = require("path");

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; }
  else { fail++; console.error("FAIL:", msg); }
}

// ---- stub DOM --------------------------------------------------------------
const elements = {};   // by id
const created = [];    // every created element, for querySelectorAll("button.ln")
function mkEl(tag) {
  const el = {
    tag, value: "", textContent: "", innerHTML: "", className: "",
    style: {}, dataset: {}, checked: false, width: 1120, height: 240,
    children: [],
    classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(k, v) { (this.attrs = this.attrs || {})[k] = v; },
    getAttribute(k) { return (this.attrs || {})[k]; },
    appendChild(c) { this.children.push(c); return c; },
    addEventListener() {},
    getContext() { return new Proxy({}, { get: () => () => {} }); },
  };
  created.push(el);
  return el;
}
const documentStub = {
  getElementById(id) { return elements[id] || (elements[id] = mkEl("div")); },
  createElement(tag) { return mkEl(tag); },
  querySelector(sel) { return sel.startsWith("#") ? documentStub.getElementById(sel.slice(1)) : mkEl("div"); },
  querySelectorAll(sel) {
    if (sel === "button.ln") return created.filter(e => e.className === "ln");
    return [];
  },
};
const sandbox = {
  document: documentStub,
  navigator: {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => {},
  setTimeout: () => 0,
  console,
};
sandbox.window = sandbox;
const context = vm.createContext(sandbox);

// ---- load the real lab script ----------------------------------------------
const html = fs.readFileSync(path.join(__dirname, "..", "tools", "voice-lab.html"), "utf8");
const m = html.match(/<script>([\s\S]*)<\/script>/);
ok(m, "voice-lab.html has a script block");
vm.runInContext(m[1], context, { filename: "voice-lab.js" });
const ev = expr => vm.runInContext(expr, context);

// ---- 1. the 24 lines, Paul's phrasing VERBATIM -------------------------------
// (The P8 phase prompt says "25 including the dock/full tiers", but its own enumeration —
// 9 health + 5 collected + 5 expired + 4 dock + 1 full — totals 24. The spec corpus is 24.)
const EXPECT = [
  ["health_low", "Aw, man, we are taking a beating."],
  ["health_low", "Hull integrity is critical."],
  ["health_low", "Somebody patch that hole."],
  ["health_relief", "We're okay for now."],
  ["health_relief", "Crisis averted."],
  ["health_relief", "Nothing a little Duct Tape can't handle."],
  ["health_full", "Like a brand new ship."],
  ["health_full", "It doesn't get any better than this."],
  ["health_full", "Not a scratch on it."],
  ["collect_triple", "We got a triple shot."],
  ["collect_rapid", "Rapid shot acquired."],
  ["collect_scoop", "A bigger pooper scooper."],
  ["collect_magnet", "Now we're more attractive."],
  ["collect_engine", "A few more horsepower."],
  ["expire_triple", "Triple shot is gone."],
  ["expire_rapid", "Rapid shot is gone."],
  ["expire_scoop", "Garbage scoop got smaller."],
  ["expire_magnet", "Magnet power is gone."],
  ["expire_engine", "Engine's a little less peppy."],
  ["dock_5", "There's at least 5 good pieces in there."],
  ["dock_10", "That's somewhere around a dozen."],
  ["dock_15", "Special delivery."],
  ["dock_20", "I'm not sure I can count that high."],
  ["cargo_full", "Truck is full, let's go."],
];
ok(ev("LINES.length") === 24, "exactly 24 lines (the full §11f corpus)");
ok(EXPECT.length === 24, "test expects all 24");
const got = JSON.parse(ev("JSON.stringify(LINES.map(L => [L.ev, L.text]))"));
got.forEach(([evk, text], i) => {
  ok(EXPECT[i][0] === evk && EXPECT[i][1] === text,
    "line " + i + " matches spec order + verbatim text: " + text);
});

// ---- 2. the corpus never falls through to the rule guesser -------------------
for (let i = 0; i < 24; i++) {
  const unk = ev(`g2p(LINES[${i}].text).unknown.length`);
  ok(unk === 0, "no rule-guessed words in line " + i + ": " + got[i][1]);
}

// ---- 3. every derived phoneme token is valid ---------------------------------
for (let i = 0; i < 24; i++) {
  const errs = ev(`parsePhonTokens(LINES[${i}].phon).errs.length`);
  ok(errs === 0, "all phoneme tokens valid in line " + i);
}

// ---- 4. buildUtterance sanity on all 24 lines --------------------------------
for (let i = 0; i < 24; i++) {
  const s = ev(`(function(){
    const u = buildUtterance(LINES[${i}].phon, P);
    let mono = true, prevEnd = -1;
    for (const g of u.segs) { if (g.t0 < prevEnd - 1e-9) mono = false; prevEnd = g.t0 + g.dur; }
    let evIn = u.frics.every(f => f.t >= 0 && f.t <= u.dur) && u.asps.every(a => a.t >= 0 && a.t <= u.dur);
    let pMono = true, pPos = true;
    for (let k = 1; k < u.pitch.length; k++) if (u.pitch[k][0] < u.pitch[k-1][0]) pMono = false;
    for (const p of u.pitch) if (p[1] < 40) pPos = false;
    return JSON.stringify({ dur: u.dur, n: u.segs.length, mono, evIn, pMono, pPos, errs: u.errs.length });
  })()`);
  const r = JSON.parse(s);
  ok(r.errs === 0, "line " + i + " compiles with no token errors");
  ok(r.n > 3, "line " + i + " yields segments");
  ok(r.dur > 0.5 && r.dur < 8, "line " + i + " duration sane (" + r.dur.toFixed(2) + "s)");
  ok(r.mono, "line " + i + " segments are sequential, non-overlapping");
  ok(r.evIn, "line " + i + " fric/asp events inside the utterance");
  ok(r.pMono && r.pPos, "line " + i + " pitch contour monotonic in t, freqs >= 40Hz");
}

// ---- 5. the intelligibility mechanics that must not regress ------------------
// velar locus: F2 of /k/ fronts before a front vowel, backs before a back vowel
ok(ev(`buildUtterance("K IY1", P).segs[0].F[1]`) > 2000 * ev("P.f2Scale") - 1,
  "velar F2 locus is front (~2300) before IY");
ok(ev(`buildUtterance("K UW1", P).segs[0].F[1]`) < 1500 * ev("P.f2Scale"),
  "velar F2 locus is back (~1300) before UW");
// VOT: a vowel after voiceless /t/ has delayed voicing onset; after voiced /d/ it barely does
ok(ev(`buildUtterance("T AA1", P).segs[1].voiceDelay`) > 0.02, "voiceless stop delays voicing (VOT)");
ok(ev(`buildUtterance("D AA1", P).segs[1].voiceDelay`) <= 0.011, "voiced stop has near-zero VOT");
// stress lengthening: IY1 in "beating" is longer than the unstressed IH
ok(ev(`(function(){ const u = buildUtterance("B IY1 T IH NG", P);
  const iy = u.segs.find(s => s.label === "IY1"), ih = u.segs.find(s => s.label === "IH");
  return iy.dur > ih.dur; })()`), "stressed vowel is longer than unstressed");
// nasal murmur damps the high formants
ok(ev(`buildUtterance("M AA1", P).segs[0].hiDamp`) < 1, "nasal segment damps F2+");
// diphthong carries a second target
ok(ev(`buildUtterance("AY1", P).segs[0].F2nd !== null`), "diphthong has a second formant target");
// pauses: "," and "." produce silent segments
ok(ev(`buildUtterance("AA1 , AA1 .", P).segs.filter(s => s.amp === 0 && s.F === null).length`) === 2,
  "pause tokens compile to silence");
// the guesser is only a fallback and flags itself
ok(ev(`g2p("flibbertigibbet").unknown.length`) === 1, "unknown words are flagged as guessed");

// ---- 6. defaults & dump (the porting source) ---------------------------------
ok(ev("P.radio.on") === true, "radio character defaults ON (fallback (a) is the lead option)");
const dump = ev(`document.getElementById("dump").textContent`);
ok(dump.includes("VOICE_PARAMS"), "dump contains VOICE_PARAMS");
ok(dump.includes("VOICE_LINES"), "dump contains VOICE_LINES");
for (const [, text] of EXPECT)
  ok(dump.includes(JSON.stringify(text)), "dump carries verbatim: " + text);
// a hand-fix to a line's phonemes lands in the dump
ev(`LINES[0].phon = "AO1 M AE1 N"; refreshDump();`);
ok(ev(`document.getElementById("dump").textContent`).includes('"AO1 M AE1 N"'),
  "hand-fixed phoneme strings are exported by the dump");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
