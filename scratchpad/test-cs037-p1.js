// Headless test for CS037 P1 — per-source damage attribution (PLANNED-FEATURES-CS037.md §5.5, C4-rev).
//
//   node scratchpad/test-cs037-p1.js
//
// This phase owns: damageShip()'s new srcTag parameter; the ten dmgFrom* flat accumulators on
// game.stats; the merged hazard loop's instanceof+size discriminator; and hostile Bullet's new
// `small` field, set only at its Saucer.update() spawn site. Instrumentation only — §G pins that
// dmgThisWave/hitsSurvived/everBelowHalf/scoop decay/knockback are byte-identical to before.
//
// Trap worth knowing: damageShip() deducts HP (s.hp -= amount) on BOTH the lethal and non-lethal
// paths, but attribution is wired into the non-lethal branch only, mirroring dmgThisWave's own
// placement — a lethal hit attributes to nothing, by design (spec §5.5's "non-lethal branch only").

"use strict";
const { mkAssert, buildGame } = require("./_harness.js");
const { installSeed } = require("./_seeded-random.js");
const A = mkAssert();
const { assert, eq, close } = A;

installSeed(20260819);

const DT = 1 / 60;

const CATS = [
  { tag: "debris3", field: "dmgFromDebris3" },
  { tag: "debris2", field: "dmgFromDebris2" },
  { tag: "debris1", field: "dmgFromDebris1" },
  { tag: "hunter3", field: "dmgFromHunter3" },
  { tag: "hunter2", field: "dmgFromHunter2" },
  { tag: "hunter1", field: "dmgFromHunter1" },
  { tag: "ufoBodyLarge", field: "dmgFromUfoBodyLarge" },
  { tag: "ufoBodySmall", field: "dmgFromUfoBodySmall" },
  { tag: "ufoShotLarge", field: "dmgFromUfoShotLarge" },
  { tag: "ufoShotSmall", field: "dmgFromUfoShotSmall" },
];

function freshShip(X, { hp = 100, invuln = 0, shieldOn = false, energy = 1, autoShield = false } = {}) {
  const g = X.game;
  g.ship.hp = hp; g.ship.invuln = invuln; g.ship.shieldOn = shieldOn; g.ship.energy = energy;
  g.ship.dead = false; g.ship.vx = 0; g.ship.vy = 0;
  X.settings.autoShield = autoShield;
  return g.ship;
}
function snap(X) {
  const s = {};
  for (const c of CATS) s[c.field] = X.game.stats[c.field];
  return s;
}
// every field matches `before` except `changedField`, which must be `before[changedField] + delta`
function assertOnlyChanged(X, before, changedField, delta, label) {
  for (const c of CATS) {
    const want = before[c.field] + (c.field === changedField ? delta : 0);
    eq(X.game.stats[c.field], want, `${label}: ${c.field}`);
  }
}
// a quiet playing world: empty board, ship centred, i-frames off, no spawn timers due
function quiet(X) {
  const g = X.game;
  g.state = "playing"; g.paused = false; g.celebration = null; g.levelEndSafe = false;
  // CS036 P1/P2: an empty debris+hunters field arms the wave-clear freeze/ceremony at the end of
  // the frame it empties on — left armed, the NEXT update() takes the reduced-sim early return and
  // never reaches collision at all (test-cs035-p3.js's arm() lifts this by hand for the same reason).
  g.levelEndFreeze = false; g.levelDone = null;
  g.debris.length = 0; g.hunters.length = 0; g.saucers.length = 0; g.bullets.length = 0;
  g.garbage.length = 0; g.powerups.length = 0; g.floaters.length = 0; g.chain.length = 0;
  g.particles.length = 0;
  g.saucerTimer = 1e6; g.hunterTimer = 1e6; g.healthTimer = 1e6;
  g.ship.x = X.WORLD_W / 2; g.ship.y = X.WORLD_H / 2;
  g.ship.vx = 0; g.ship.vy = 0; g.ship.dead = false; g.ship.shieldOn = false; g.ship.invuln = 0;
  g.ship.hp = 100;
  X.settings.autoShield = false;
  return g;
}

// ================= (A) ten categories, ten accumulators, no cross-talk =================
(function sectionA() {
  console.log("(A) each of the ten srcTags attributes to its own accumulator and no other");
  const X = buildGame(); X.startGame();
  const AMOUNT = 13;
  for (const cat of CATS) {
    const ship = freshShip(X, { hp: 100 });
    const before = snap(X);
    const applied = X.damageShip(AMOUNT, ship.x + 40, ship.y, cat.tag);
    assert(applied === true, `A: ${cat.tag} — non-lethal hit applied`);
    assertOnlyChanged(X, before, cat.field, AMOUNT, `A: ${cat.tag}`);
  }
})();

// ================= (B) shielded / i-framed / auto-shield attribute zero =================
(function sectionB() {
  console.log("(B) the three no-damage paths attribute zero");
  const X = buildGame(); X.startGame();

  // -- shielded --
  {
    const ship = freshShip(X, { hp: 100, shieldOn: true });
    const before = snap(X);
    const applied = X.damageShip(13, ship.x + 40, ship.y, "hunter3");
    eq(applied, false, "B: shielded — damageShip returns false");
    eq(X.game.ship.hp, 100, "B: shielded — hp untouched");
    assertOnlyChanged(X, before, null, 0, "B: shielded");
  }
  // -- i-framed --
  {
    const ship = freshShip(X, { hp: 100, invuln: 0.5 });
    const before = snap(X);
    const applied = X.damageShip(13, ship.x + 40, ship.y, "debris2");
    eq(applied, false, "B: i-framed — damageShip returns false");
    eq(X.game.ship.hp, 100, "B: i-framed — hp untouched");
    assertOnlyChanged(X, before, null, 0, "B: i-framed");
  }
  // -- auto-shield save (settings.autoShield, hp <= LOW_HP_THRESHOLD, energy >= SHIELD_HIT_COST) --
  {
    const ship = freshShip(X, { hp: X.LOW_HP_THRESHOLD, energy: 1, autoShield: true });
    const before = snap(X);
    const applied = X.damageShip(13, ship.x + 40, ship.y, "ufoShotSmall");
    eq(applied, false, "B: auto-shield save — damageShip returns false");
    eq(X.game.ship.hp, X.LOW_HP_THRESHOLD, "B: auto-shield save — hp untouched (0 HP dealt)");
    assert(X.game.ship.shieldOn === true, "B: (setup) the auto-shield branch actually fired");
    assertOnlyChanged(X, before, null, 0, "B: auto-shield save");
  }
})();

// ================= (C) a lethal hit does not double-attribute =================
(function sectionC() {
  console.log("(C) a lethal hit attributes zero (mirrors dmgThisWave's own non-lethal-only placement); two survived hits of the same category simply add");
  const X = buildGame(); X.startGame();

  // -- the killing blow contributes nothing to its own category --
  {
    const ship = freshShip(X, { hp: 13 });
    const before = snap(X);
    const applied = X.damageShip(13, ship.x + 40, ship.y, "debris3");
    eq(applied, true, "C: lethal hit — damageShip still returns true (damage was applied)");
    eq(X.game.ship.hp, 0, "C: lethal hit — hp floors at 0");
    assert(X.game.ship.dead, "C: lethal hit — ship is dead");
    assertOnlyChanged(X, before, null, 0, "C: lethal hit");
  }
  // -- two sequential non-lethal hits of the SAME category accumulate additively, not doubled --
  {
    const ship = freshShip(X, { hp: 100 });
    const before = snap(X);
    X.damageShip(13, ship.x + 40, ship.y, "hunter1");
    X.game.ship.invuln = 0; // clear the i-frame the first hit just opened
    X.damageShip(9, ship.x + 40, ship.y, "hunter1");
    assertOnlyChanged(X, before, "dmgFromHunter1", 22, "C: two survived hits, same category");
  }
})();

// ================= (D) hostile bullets: shooter-size wiring, then attribution =================
(function sectionD() {
  console.log("(D) a large and a small saucer's bullets carry different `small`, and attribute to different columns");

  // -- D1: the wiring at Saucer.update()'s one spawn site --
  {
    const X = buildGame(); X.startGame(); quiet(X);
    for (const small of [false, true]) {
      const sc = new X.Saucer(small);
      sc.x = X.game.ship.x + 300; sc.y = X.game.ship.y; sc.vx = 0; sc.vy = 0;
      sc.fireTimer = 0; sc.zigTimer = 1e6; sc.travel = 0;
      X.game.bullets.length = 0;
      sc.update(DT);
      eq(X.game.bullets.length, 1, `D1: small=${small} saucer fired exactly one bullet`);
      const b = X.game.bullets[0];
      eq(b.hostile, true, `D1: small=${small} — the spawned bullet is hostile`);
      eq(b.small, small, `D1: small=${small} — bullet.small is set from Saucer.this.small`);
    }
  }

  // -- D2: end-to-end attribution through the real bullet-vs-ship collision site --
  {
    const X = buildGame(); X.startGame();
    for (const { small, field } of [{ small: false, field: "dmgFromUfoShotLarge" },
                                     { small: true, field: "dmgFromUfoShotSmall" }]) {
      const g = quiet(X);
      const before = snap(X);
      g.bullets.push(new X.Bullet(g.ship.x, g.ship.y, 0, 0, true, small));
      X.update(DT);
      assertOnlyChanged(X, before, field, X.DMG_BULLET, `D2: small=${small} hostile bullet`);
    }
  }
})();

// ================= (E) merged hazard loop: Garbage Satellite vs Hunter Satellite, same size =================
(function sectionE() {
  console.log("(E) a size-2 Garbage Satellite and a size-2 Hunter land in different columns");

  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    const before = snap(X);
    const a = new X.DebrisSatellite(g.ship.x, g.ship.y, 2);
    a.vx = 0; a.vy = 0;
    g.debris.push(a);
    X.update(DT);
    assertOnlyChanged(X, before, "dmgFromDebris2", X.DEBRIS_DAMAGE[2], "E: size-2 Garbage Satellite contact");
  }
  {
    const X = buildGame(); X.startGame();
    const g = quiet(X);
    const before = snap(X);
    const h = new X.HunterSatellite(g.ship.x, g.ship.y, 2, 0);
    h.vx = 0; h.vy = 0; h.scatter = 0;
    g.hunters.push(h);
    X.update(DT);
    assertOnlyChanged(X, before, "dmgFromHunter2", X.HUNTER_DAMAGE[2], "E: size-2 Hunter Satellite contact");
  }
})();

// ================= (F) save/resume round trip preserves all ten =================
(function sectionF() {
  console.log("(F) the ten dmgFrom* fields survive buildSaveEntry() -> resumeFromSave()");
  const X = buildGame(); X.startGame();
  const VALUES = {};
  CATS.forEach((c, i) => { VALUES[c.field] = (i + 1) * 7; X.game.stats[c.field] = VALUES[c.field]; });

  const entry = X.buildSaveEntry();
  for (const c of CATS) eq(entry.stats[c.field], VALUES[c.field], `F: buildSaveEntry carries ${c.field}`);

  X.resumeFromSave(entry);
  for (const c of CATS) eq(X.game.stats[c.field], VALUES[c.field], `F: resumeFromSave restores ${c.field}`);
})();

// ================= (G) regression pins: unrelated damageShip behaviour is untouched =================
(function sectionG() {
  console.log("(G) dmgThisWave, hitsSurvived, everBelowHalf, scoop decay and knockback behave exactly as at HEAD");
  const X = buildGame(); X.startGame();

  // -- dmgThisWave / hitsSurvived: +1 per non-lethal hit, regardless of srcTag --
  {
    const ship = freshShip(X, { hp: 100 });
    const dmgBefore = X.game.stats.dmgThisWave, survBefore = X.Achievements.lifetime.hitsSurvived;
    X.damageShip(13, ship.x + 40, ship.y, "ufoBodyLarge");
    eq(X.game.stats.dmgThisWave, dmgBefore + 1, "G: dmgThisWave +1 on a survived hit");
    eq(X.Achievements.lifetime.hitsSurvived, survBefore + 1, "G: hitsSurvived +1 on a survived hit");
  }

  // -- everBelowHalf: set only when hp actually drops below 50% --
  {
    X.game.stats.everBelowHalf = false;
    const ship = freshShip(X, { hp: X.SHIP_MAX_HP });
    X.damageShip(5, ship.x + 40, ship.y, "debris1"); // stays well above half
    eq(X.game.stats.everBelowHalf, false, "G: everBelowHalf stays false above the 50% line");
    ship.invuln = 0; // clear the i-frame the first hit opened, so the second hit actually lands
    X.damageShip(X.SHIP_MAX_HP / 2 + 10, ship.x + 40, ship.y, "debris1"); // crosses below half
    eq(X.game.stats.everBelowHalf, true, "G: everBelowHalf flips true once hp crosses below 50%");
  }

  // -- scoop decay: unaffected by which srcTag caused the hit --
  {
    const ship = freshShip(X, { hp: 100 });
    X.game.scoopLevel = 1; X.game.scoopHits = X.DEBUG.scoopHitsPerLevel - 1;
    X.damageShip(5, ship.x + 40, ship.y, "hunter2");
    eq(X.game.scoopLevel, 0, "G: scoop decay — the threshold hit still drops scoopLevel");
    eq(X.game.scoopHits, 0, "G: scoop decay — scoopHits still resets to 0 at the threshold");
  }

  // -- knockback: magnitude is still exactly KNOCKBACK_SPEED, regardless of srcTag --
  {
    const ship = freshShip(X, { hp: 100 });
    ship.x = X.WORLD_W / 2; ship.y = X.WORLD_H / 2;
    X.damageShip(5, ship.x + 100, ship.y, "ufoShotSmall");
    close(Math.hypot(ship.vx, ship.vy), X.KNOCKBACK_SPEED, "G: knockback magnitude unchanged", 1e-6);
  }
})();

A.report();
