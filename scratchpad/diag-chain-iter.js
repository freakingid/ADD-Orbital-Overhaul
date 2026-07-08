// Diagnostic (not a shipped test): measure worst-case chain-link stretch at CARGO_CAP_MAX (20)
// nodes under a hard thrust-flip + wrap stress run, for CHAIN_ITER = 3 / 4 / 5, to justify the
// B-8 iteration bump. Drives the REAL updateChain by re-extracting the script with the constant
// substituted. No reimplementation of the physics.
"use strict";
const fs = require("fs");
const path = require("path");
const html = fs.readFileSync(path.join(__dirname, "..", "asteroids-deluxe.html"), "utf8");
const scriptSrc0 = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const noopCtx = new Proxy({}, { get: () => () => {} });
const canvasStub = { width: 0, height: 0, style: {}, getContext: () => noopCtx };
const documentStub = { getElementById: () => canvasStub };
const windowStub = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 720,
  AudioContext: function () {}, webkitAudioContext: function () {} };
const performanceStub = { now: () => Date.now() };
const navigatorStub = { getGamepads: () => [] };

function build(iter) {
  const src = scriptSrc0.replace(/const CHAIN_ITER = \d+;/, `const CHAIN_ITER = ${iter};`);
  const ret = ["startGame","game","updateChain","chainAnchor","chainMass","Ship",
    "CHAIN_LINK","CHAIN_ITER","WORLD_W","WORLD_H","SHIP_THRUST","shortDelta"];
  const f = new Function("window","document","performance","requestAnimationFrame","navigator",
    src + "\n;return { " + ret.join(", ") + " };");
  return f(windowStub, documentStub, performanceStub, () => 0, navigatorStub);
}

const DT = 1 / 60;
function stress(iter) {
  const A = build(iter);
  const { startGame, game, updateChain, chainAnchor, CHAIN_LINK, WORLD_W, WORLD_H, shortDelta } = A;
  startGame();
  game.state = "playing"; game.paused = false;
  game.debris.length = 0; game.hunters.length = 0; game.saucers.length = 0;
  game.chain.length = 0;
  const cx = WORLD_W / 2, cy = WORLD_H / 2;
  Object.assign(game.ship, { dead: false, x: cx, y: cy, vx: 0, vy: 0, angle: 0 });
  // Build a taut 20-node chain trailing behind (to the left of) the ship.
  const a = chainAnchor();
  for (let i = 0; i < 20; i++) {
    const x = a.x - CHAIN_LINK * (i + 1), y = a.y;
    game.chain.push({ x, y, px: x, py: y, spin: 0, spinRate: 0, mass: 1.0 });
  }
  let maxStretch = 0, worstLink = 0, nan = false;
  // 600 frames: every ~12 frames flip thrust direction hard; drift crosses the wrap seam.
  for (let fr = 0; fr < 600; fr++) {
    // hard thrust flips: slam velocity back and forth
    const dir = Math.floor(fr / 12) % 2 === 0 ? 1 : -1;
    game.ship.vx = dir * 380;
    game.ship.vy = (Math.floor(fr / 25) % 2 === 0 ? 1 : -1) * 220;
    game.ship.x += game.ship.vx * DT; game.ship.y += game.ship.vy * DT;
    // wrap the ship like wrap() does (toroidal)
    if (game.ship.x < 0) game.ship.x += WORLD_W; if (game.ship.x > WORLD_W) game.ship.x -= WORLD_W;
    if (game.ship.y < 0) game.ship.y += WORLD_H; if (game.ship.y > WORLD_H) game.ship.y -= WORLD_H;
    updateChain(DT);
    // measure post-constraint link lengths (anchor→0, then i-1→i) via wrap-aware delta
    const an = chainAnchor();
    for (let i = 0; i < game.chain.length; i++) {
      const leader = i === 0 ? an : game.chain[i - 1];
      const n = game.chain[i];
      if (!isFinite(n.x) || !isFinite(n.y)) nan = true;
      const [dx, dy] = shortDelta(leader.x, leader.y, n.x, n.y);
      const d = Math.hypot(dx, dy);
      const stretch = Math.abs(d - CHAIN_LINK);
      if (stretch > maxStretch) { maxStretch = stretch; worstLink = i; }
    }
  }
  return { iter, maxStretch, worstLink, nan };
}

for (const it of [3, 4, 5]) {
  const r = stress(it);
  console.log(`CHAIN_ITER=${r.iter}  maxLinkStretch=${r.maxStretch.toFixed(2)}px (link ${r.worstLink})  NaN=${r.nan}`);
}
