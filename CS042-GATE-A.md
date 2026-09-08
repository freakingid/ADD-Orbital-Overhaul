# CS042-GATE-A.md — Paul's answers, verbatim

⛔ **This file is GATE A's output and nothing else.** Both blocks below were produced by the labs and
pasted back on **2026-09-08**. They are the input to P3, P4 and P5, and they are reproduced here
**verbatim** — a copy-out block is the artefact, and an edited one is not one.

⛔ **Read the "What this means for the phase" note under each block before implementing.** Those
notes are this file's only added content; everything above them in each section is Paul's.

⚠ **GATE A's handling third is not here.** It returned a null result and was superseded by spec §6.8;
`STATUS.md` carries that story, and FLAG-CS042-l / FLAG-CS042-m stay Paul's, answerable at GATE C.

---

## 1. `tools/sfx-lab.html` → P3 and P4 (spec §1.3, §1.4)

**Picks:** cargofull A · cargolost A · chainsever C · guardblock C · levelup C · hullfull A ·
hullrelief C · hullcritical A · powertag B · powerfade A · haulsize C · megadelivery C

```js
// ==== tools/sfx-lab.html copy-out (CS042 P1, spec §1.6) — picks: cargofull A · cargolost A · chainsever C · guardblock C · levelup C · hullfull A · hullrelief C · hullcritical A · powertag B · powerfade A · haulsize C · megadelivery C ====
// Constants — with the other tuning constants; POWERTAG_ROOT beside POWERUP_COLOR.
const CARGOFULL_FREQS = [330, 415, 494, 659]; // cargofull()'s pitches (Stepped arpeggio); cargolost() and chainsever() read it REVERSED — the pair is matched by construction
const POWERTAG_ROOT = { // per-type roots for powertag()/powerfade() (spec §1.4): the list of pitches the tag voices, so guard's doubled octave is data
  rapid:  [1047],
  triple: [831],
  scoop:  [659],
  magnet: [523],
  engine: [330],
  guard:  [262, 523]
};

// AudioSys methods — paste inside the object after scooploss(). Each is this.ctx-guarded and routes into this.sfx.
  cargofull() { // CS042 §1.4 "Filling up" — a stepped climb that lands on a held top and latches shut
    if (!this.ctx) return;
    const t = this.now();
    const F = CARGOFULL_FREQS, step = 0.075, tEnd = t + F.length * step;
    F.forEach((f, i) => {
      const last = i === F.length - 1, t0 = t + i * step;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(last ? 0.14 : 0.10, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (last ? 0.38 : 0.13));
      o.connect(g).connect(this.sfx);
      o.start(t0); o.stop(t0 + (last ? 0.4 : 0.14));
    });
    const latch = this.ctx.createOscillator(); // the "clunk" — the tank is sealed
    const lg = this.ctx.createGain();
    latch.type = "square";
    latch.frequency.setValueAtTime(F[F.length - 1] / 2, tEnd + 0.05);
    lg.gain.setValueAtTime(0.06, tEnd + 0.05);
    lg.gain.exponentialRampToValueAtTime(0.001, tEnd + 0.11);
    latch.connect(lg).connect(this.sfx);
    latch.start(tEnd + 0.05); latch.stop(tEnd + 0.12);
  },

  cargolost() { // CS042 §1.4 "Running out" — cargofull's steps top-down, each softer, ending in an empty knock
    if (!this.ctx) return;
    const t = this.now();
    const R = CARGOFULL_FREQS.slice().reverse(), step = 0.075, tEnd = t + R.length * step;
    R.forEach((f, i) => {
      const t0 = t + i * step;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.13 - i * 0.02, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.13);
      o.connect(g).connect(this.sfx);
      o.start(t0); o.stop(t0 + 0.14);
    });
    const knock = this.ctx.createOscillator(); // the empty-tank knock, an octave under the bottom step
    const kg = this.ctx.createGain();
    knock.type = "square";
    knock.frequency.setValueAtTime(R[R.length - 1] / 2, tEnd);
    knock.frequency.exponentialRampToValueAtTime(R[R.length - 1] / 4, tEnd + 0.16);
    kg.gain.setValueAtTime(0.09, tEnd);
    kg.gain.exponentialRampToValueAtTime(0.001, tEnd + 0.22);
    knock.connect(kg).connect(this.sfx);
    knock.start(tEnd); knock.stop(tEnd + 0.23);
  },

  chainsever() { // CS042 §1.4 — a SMALLER cargolost: the whole reversed run at double speed, quiet, through a closed lowpass — heard at a distance
    if (!this.ctx) return;
    const t = this.now();
    const R = CARGOFULL_FREQS.slice().reverse(), step = 0.035;
    const filt = this.ctx.createBiquadFilter();
    filt.type = "lowpass"; filt.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + R.length * step + 0.08);
    R.forEach((f, i) => {
      const t0 = t + i * step;
      const o = this.ctx.createOscillator();
      o.type = "square";
      o.frequency.setValueAtTime(f, t0);
      o.connect(filt);
      o.start(t0); o.stop(t0 + step + 0.01);
    });
    filt.connect(g).connect(this.sfx);
  },

  guardblock() { // CS042 §1.4 — metallic, armoured: a square that drops fast (the hit) with one high sine partial that rings on (the plate)
    if (!this.ctx) return;
    const t = this.now();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(1100, t);
    o.frequency.exponentialRampToValueAtTime(700, t + 0.05);
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    o.connect(g).connect(this.sfx);
    o.start(t); o.stop(t + 0.08);
    const ring = this.ctx.createOscillator();
    const rg = this.ctx.createGain();
    ring.type = "sine"; ring.frequency.value = 3300;
    rg.gain.setValueAtTime(0.06, t);
    rg.gain.exponentialRampToValueAtTime(0.001, t + 0.26);
    ring.connect(rg).connect(this.sfx);
    ring.start(t); ring.stop(t + 0.27);
  },

  levelup() { // CS042 §1.4 — confident, rising: three square notes stacked in FOURTHS (D4 G4 C5), fast — open and bright, not achievement()'s major triad
    if (!this.ctx) return;
    const t = this.now();
    [294, 392, 523].forEach((f, i) => {
      const last = i === 2, t0 = t + i * 0.06;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.08, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (last ? 0.4 : 0.1));
      o.connect(g).connect(this.sfx);
      o.start(t0); o.stop(t0 + (last ? 0.41 : 0.11));
    });
  },

  hullfull() { // CS042 §1.4 — soft, warm, settled: two sines a major third apart SWELL in and fade — quieter than powerup(), no attack
    if (!this.ctx) return;
    const t = this.now();
    [330, 415].forEach(f => { // E4 + G#4
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.001, t);
      g.gain.linearRampToValueAtTime(0.06, t + 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + 0.71);
    });
  },

  hullrelief() { // CS042 §1.4 — an exhale: a suspended note steps DOWN onto a longer, resting one — tension released as an interval
    if (!this.ctx) return;
    const t = this.now();
    [[494, 0, 0.16, 0.07], [440, 0.14, 0.55, 0.06]].forEach(([f, at, dur, g0]) => { // B4 falling to A4
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t + at);
      g.gain.setValueAtTime(g0, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + dur);
      o.connect(g).connect(this.sfx);
      o.start(t + at); o.stop(t + at + dur + 0.01);
    });
  },

  hullcritical() { // CS042 §1.4 — an alarm hit over the siren's fade-up: a hard square TRITONE stab, gone in 80 ms
    if (!this.ctx) return;
    const t = this.now();
    [440, 622].forEach(f => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + 0.1);
    });
  },

  powertag(type) { // CS042 §1.4 — the root then its fifth, two quick sines: an upward flick that names the type by where it sits
    if (!this.ctx) return;
    const t = this.now() + 0.16;
    (POWERTAG_ROOT[type] || POWERTAG_ROOT.scoop).forEach(root => {
      [root, root * 1.5].forEach((f, i) => {
        const t0 = t + i * 0.055;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(f, t0);
        g.gain.setValueAtTime(0.09, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.1);
        o.connect(g).connect(this.sfx);
        o.start(t0); o.stop(t0 + 0.11);
      });
    });
  },

  powerfade(type) { // CS042 §1.4 — powertag() inverted: the same triangle on the same root, sliding DOWN an octave as it goes; no chime before it
    if (!this.ctx) return;
    const t = this.now();
    (POWERTAG_ROOT[type] || POWERTAG_ROOT.scoop).forEach(f => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f / 2, t + 0.26);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + 0.29);
    });
  },

  haulsize(n) { // CS042 §1.4 — the tier stinger: one square dyad hit PER TIER (5 = one, 20 = four), then a higher landing note — the player counts how big
    if (!this.ctx) return;
    const t = this.now();
    const tier = Math.max(1, Math.min(4, Math.floor(n / 5)));
    for (let i = 0; i < tier; i++) {
      [440, 660].forEach(f => {
        const t0 = t + i * 0.09;
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = "square";
        o.frequency.setValueAtTime(f, t0);
        g.gain.setValueAtTime(0.06, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
        o.connect(g).connect(this.sfx);
        o.start(t0); o.stop(t0 + 0.08);
      });
    }
    const tl = t + tier * 0.09 + 0.03;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(880, tl);
    g.gain.setValueAtTime(0.11, tl);
    g.gain.exponentialRampToValueAtTime(0.001, tl + 0.3);
    o.connect(g).connect(this.sfx);
    o.start(tl); o.stop(tl + 0.31);
  },

  megadelivery() { // CS042 §1.4 — the largest cue in the game: an eight-note sine bell run that dives and climbs back higher than it started, over a slow low pulse
    if (!this.ctx) return;
    const t = this.now();
    [1568, 1319, 1047, 784, 1047, 1319, 1568, 2093].forEach((f, i) => {
      const t0 = t + i * 0.09;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.09, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + (i === 7 ? 0.7 : 0.3));
      o.connect(g).connect(this.sfx);
      o.start(t0); o.stop(t0 + (i === 7 ? 0.71 : 0.31));
    });
    [0, 0.36, 0.72].forEach(at => { // the low pulse under the run
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(131, t + at);
      g.gain.setValueAtTime(0.12, t + at);
      g.gain.exponentialRampToValueAtTime(0.001, t + at + 0.3);
      o.connect(g).connect(this.sfx);
      o.start(t + at); o.stop(t + at + 0.31);
    });
  }
```

### What this means for P3 and P4

⛔ **Paste verbatim.** These are the audition graphs Paul heard; retuning a gain or a duration in the
build breaks the only guarantee the lab gives, which is that what was picked is what ships. The
`AudioSys` house rules the phases still owe are §1.3's, not this block's: the call goes at the
**trigger site, immediately above the `VoiceSys.say()`**, never inside `_emit()`, and `AudioSys`
stays a flat bag of one-shot voices.

- ⛔ **`POWERTAG_ROOT` has SIX keys and `health` is deliberately not one of them** (spec §1.4's own
  ⚠). Health speaks through the hull-full latch and takes no tag. The `|| POWERTAG_ROOT.scoop`
  fallback in both methods is defensive code for an unknown type — **do not read it as "health
  sounds like scoop", and do not add a `collect_health` event to fill the table.** That is a design
  change and §1.4 forbids it by name.
- ⛔ **`powertag()`'s `this.now() + 0.16` is load-bearing** (P1 hazard 1, `STATUS.md`). The tag is
  written to land after `powerup()`'s second note. If P3 places the call anywhere but immediately
  after `AudioSys.powerup()`, the offset is wrong and the fix is the call site, not the constant.
- ⛔ **`POWERTAG_ROOT.guard` has no caller today** (P1 hazard 2). `applyPowerup()`'s collect and
  expire branches both exclude `guard`, so the row exists to satisfy §1.4's table. **P3 does not
  invent a caller for it.**
- **`CARGOFULL_FREQS` is already a `const` in this block**, which discharges P1 hazard 4 — it was a
  `let` in the lab only. It belongs with the other tuning constants; `POWERTAG_ROOT` goes beside
  `POWERUP_COLOR`.
- **`haulsize(n)` clamps the tier to 1–4 from `floor(n/5)`**, matching `dock_5/10/15/20`, and is
  called on the emptying pop with `game.deliveryCount` (P1 hazard 3).
- ⚠ **`chainsever()` connects its filter to the bus after starting its oscillators.** Legal in Web
  Audio — the graph is live — and every start time is in the future, so nothing is lost. Noted only
  so a later reader does not "fix" a verbatim port.

---

## 2. `tools/ceremony-lab.html` → P5 (spec §3)

**Preset: Cross-fade, taken unedited.** No duration moves, no gate becomes a timer, and both
sequence totals are identical to shipped. ⛔ **Every one of the fourteen changes is a transition.**

```text
CS042 P2 — ceremony-lab findings              (hand this back; it is P5's spec)
generated 2026-09-08 21:39:17
working preset: Cross-fade
panel present:  YES, 3 unlock(s)

=== SEQUENCE A — LEVEL END =========================================
 #  beat                       when                field    transition
 1  Clear → arm                0.00–0.00 s         live     in CUT / out CUT
 2  “Level N Complete”         GATE (assume 2.0)   frozen   in 0.50 linear / out 0.35 easeIn (after the press)
 3  Achievements panel         GATE (assume 4.0)   frozen   in 0.35 easeOut / out 0.35 easeIn (after the press)
 4  “Level N+1” — frozen part  6.00–7.70 s         frozen   in 0.50 easeOut / out CUT
 5  Banner tail — field live   7.70–8.20 s         live     in CUT / out 0.50 linear
 6  Post-banner grace          8.20–11.20 s        live     in CUT / out CUT

 total at the assumed dwells above: 11.20 s   (shipped: 11.20 s)
 derived for the build:
   levelBannerTime = 2.20 s  (frozen 1.70 + live tail 0.50)     [shipped 2.20]
   levelBannerFade = 0.50 s in / 0.50 s out                    [shipped 0.50 / 0.50]
   thaw            = SWITCH (one frame), at life <= 0.50 s   [shipped SWITCH at 0.50]
   levelEndGrace   = 3.00 s                                  [shipped 3.00]
   levelEndFade    = 0.25 s  ·  levelEndGracePulseEnd = 0.08 s    [shipped 0.25 / 0.08]

=== SEQUENCE B — GAME OVER =========================================
 #  beat                       when                field    transition
 1  Death spectacle            0.00–2.50 s         live     in CUT / out CUT
 2  → gameover                 2.50–2.50 s         frozen   in CUT / out CUT
 3  Achievements panel         GATE (assume 4.0)   frozen   in 0.35 easeOut / out 0.35 easeIn (after the press)
 4  GAME OVER stack            GATE (assume 5.0)   frozen   in 0.40 easeOut / out CUT

 total at the assumed dwells above: 11.50 s   (shipped: 11.50 s)
 derived for the build:
   DEATH_DURATION  = 2.50 s                                  [shipped 2.50]
   stack stagger   = GAME OVER +0.00 / FINAL SCORE +0.00 / table +0.00 / footer +0.00
   element fade    = hard cut   ·  row step = none      [shipped: all zero]

=== CHANGES FROM SHIPPED — this is what P5 implements =====================
 A2 “Level N Complete”:          fade-out  0.00 → 0.35
 A2 “Level N Complete”:          fade-out curve  linear → easeIn
 A3 Achievements panel:          fade-in  0.00 → 0.35
 A3 Achievements panel:          fade-in curve  linear → easeOut
 A3 Achievements panel:          fade-out  0.00 → 0.35
 A3 Achievements panel:          fade-out curve  linear → easeIn
 A4 “Level N+1” — frozen part:   fade-in curve  linear → easeOut
 B3 Achievements panel:          fade-in  0.00 → 0.35
 B3 Achievements panel:          fade-in curve  linear → easeOut
 B3 Achievements panel:          fade-out  0.00 → 0.35
 B3 Achievements panel:          fade-out curve  linear → easeIn
 B4 GAME OVER stack:             fade-in  0.00 → 0.40
 B4 GAME OVER stack:             fade-in curve  linear → easeOut
 B4 GAME OVER stack:             drawn under the previous beat  yes → no

=== RENDERABILITY ========================================================
 Every transition above is ctx.globalAlpha or geometry only — the mechanism
 drawLevelBanner() and drawCaption() already use. No new fill and no new
 shadowBlur: GDD §3.2's two sanctioned fill exceptions (drawText, the low-hull
 glow) gain no third, and menuPanel()'s own backdrop fill is the shipped one.
```

### What this means for P5

**The good news first: nothing about the ceremony's TIMING moves.** No `DEBUG_VARS` row changes, no
registry count changes, `levelBannerTime`/`levelBannerFade`/`levelEndGrace`/`DEATH_DURATION` all stay
exactly where they are, and GDD §2.20.1's step order is untouched. P5 is a **rendering and lifecycle**
change, and the whole of it is alpha.

⛔ **But "fade-out AFTER the press" is NEW MECHANISM, not a knob, and it collides with two invariants.**
Both dismissals hard-cut today by nulling the state the renderer self-gates on, and the lingering
fade needs a state the *renderer* can see and the *rest of the build* cannot.

1. ⛔ **`game.levelDone` MUST STILL GO NULL ON THE CONFIRM.** GDD §2.20.1: `updateLevelEndFreeze()` is
   one `if`/`else` where a non-null `game.levelDone` **is** the hold, and the `else` is the tail that
   lifts the freeze. Keeping the announcement alive for 0.35 s by leaving that field set would hang
   the freeze — the documented hard-hang failure mode of this function. The dissolve needs its **own
   render-only field**, set by `dismissLevelDone()` as it nulls `game.levelDone`, read by
   `drawLevelDone()` alone, and ticked in both `updateLevelEndFreeze()` and the playing body the way
   `tickLevelBanner()` already is.
2. ⛔ **`game.celebration` MUST STILL GO NULL ON THE CONFIRM.** It gates three things beyond the
   renderer: `update()`'s early return (the panel freezes the field), both input handlers, and — at
   the level-end site — `dismissCelebration()`'s own `nextWave()`. A panel that outlived its
   dismissal by 0.35 s would keep freezing the field and keep owning input for that long. Same
   answer: a separate render-only fade-out state, and `drawCelebration()` reading it.
3. ⛔ **`drawLevelBanner()`'s one-expression alpha has to split.** A4 wants easeOut **in** and A5
   still reports linear **out**, but the shipped renderer derives both ends from
   `Math.min(elapsed, life) / fade` — one expression, and its header says so deliberately. Two
   curves means two branches. ⛔ **Keep the `Math.max(0, ...)` guard and the degenerate-knob
   behaviour that header describes**; the fade-in curve is the only thing licensed to move.
4. ⛔ **B4 REVERSES A CS034 P7 DECISION, and P5 should know that rather than discover it.** "Drawn
   under the previous beat: yes → no" means the game-over block must stop drawing while the panel is
   up, then fade in over 0.40 s. GDD §2.18 records that this block is drawn **unconditionally** as of
   CS034 P7, which deleted CS030 P7's gate-G6 `&& !game.celebration` refinement along with the
   initials entry. P5 re-introduces that gate in a new form. That is Paul's call, made at GATE A —
   **implement it, and note the reversal in the GDD rather than silently re-adding the condition.**
5. **The two panels' fades are the same numbers at both call sites** (0.35 easeOut in, 0.35 easeIn
   out), so `drawCelebration()` needs one fade implementation, not a per-site fork. ⛔ The existing
   `resume`-derived sub-line fork is untouched by this and must stay.
6. **Nothing else in the block moves.** No stagger, no row step, the thaw stays a one-frame switch at
   `life <= levelBannerFade`, and the grace pulse keeps 0.25 / 0.08. Anything P5 finds itself
   changing beyond the fourteen lines above is out of scope.
