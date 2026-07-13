# IMPLEMENTATION PHASES — v3.5 (Changeset 6)

Companion to `PLANNED-FEATURES-v3.5.md`. Three phases, **mutually independent** — no phase depends on
another, so they can ship in any order or be reordered freely. Listed bug-first.

Each phase is one Claude Code session. All three are small; **do not merge them** — P1 and P3 both touch
audio but different modules (`MusicSys`/menu vs. `AudioSys`), and keeping them apart keeps the blast
radius honest.

**Blocked on sign-off:** P1 needs **FORK-1**. P2 needs **FORK-2**. P3 needs **FORK-3**.
The prompts below assume my recommendations (FORK-1 = present-not-quiet · FORK-2 = keep the tint ·
FORK-3 = HP-scaled urgency). If you decide otherwise, edit the one marked line in the prompt.

| Phase | Scope | Model | Thinking |
|---|---|---|---|
| **P1** | Menu repeat guard + audible Ambient track | Sonnet | **on** |
| **P2** | Clump renders as a scaled canister | Sonnet | low |
| **P3** | Low-health warning: pulsed, HP-scaled | Sonnet | **on** |

---

## Phase 1 — the music-track switch

**Model:** Sonnet · **Thinking: on** (two unrelated root causes, one of which widens beyond music).

### Prompt

```
Read CLAUDE.md, then grep the live build before editing anything. Two independent fixes;
do them as two clearly-separated commits' worth of work in one session, part A first.

CONTEXT (already verified against this build — re-confirm by grep, don't re-derive):
Switching the Options "Music Track" row mid-game appears to stop the music. The switch
mechanism is NOT broken — setState() does crossfade correctly. There are two separate
real causes.

PART A — the keyboard menu handler has no e.repeat guard.
The window "keydown" listener (~line 1075) routes to handleMenuKey(k) with no repeat check,
so browser key auto-repeat (~30/sec while held) fires dozens of menu actions per press.
On the 3-value Music Track row a brief hold spins the selection and lands back where it
started ("nothing changed"), AND re-enters setState() nearly every frame — each time
discarding trackGain, restarting the 0.6s ramp from 0.0001, and resetting step=0, which
pins the music near-silent while the key is down.

The gamepad path is ALREADY correct: handleGamepadMenu() goes through menuNavEdges(),
which is strictly edge-detected (one press, one move). Make the keyboard match it.

Fix: in the keydown listener's menu branch (the `if (menuActive())` block), ignore repeats.
Still preventDefault() so the key doesn't scroll the page. Do NOT add repeat handling to the
rebind-capture branch or the normal-play branch — gameplay keys legitimately want held-key
behavior and are read from keys{} anyway, not from the keydown edge.

Be aware and call it out in your summary: this ALSO changes the three volume sliders and the
two Difficulty toggles — a held key no longer scrubs them. That is intended (it matches the
gamepad), but it means a 1.0 -> 0.0 volume sweep is now 10 taps. Do not add a throttled-repeat
mechanism to soften it; that's a deliberate follow-up if playtest misses it.

PART B — the `ambient` track is effectively inaudible.
buildAmbientTrack()'s tier-1 (always-on) foundation layer carries ONE note per 8.0s loop
(sine, gain 0.06, lowpass 300Hz). Everything above tier 1 is gated off by
MUSIC_LAYER_THRESHOLD until wave 3+, and the Options screen ducks music to MUSIC_DUCK_GAIN
(0.5) on top. Measured against the real scheduler over a 10s window: retro schedules 127
notes, tense 138, ambient 9. Ambient is ~25x below its siblings — selecting it genuinely
sounds like the music stopped.

Fix: rebuild buildAmbientTrack()'s LAYER DATA ONLY so the track is CALM, not ABSENT.
    [FORK-1 = present-not-quiet. If Paul chose "ambient is the near-silence option",
     instead do the minimum: give tier 1 a continuous sustained presence and stop there.]
  - Its tier-1 layer must be continuously present across the loop (sustained/overlapping pad
    notes, not one isolated blip) — a player at wave 1 who selects Ambient must immediately
    hear that something is playing.
  - Bring its layer gains into family with retro (0.075 bass) and tense (0.08 bass). It should
    be the CALMEST track, not the quietest one — "quiet" is the Music Volume slider's job.
  - Keep its character: slow, sparse, E dorian, the long-haul-in-the-dark salvage mood. Do not
    turn it into a third beat-driven track.
  - Keep the 4-layer tier structure (1 foundation / 2 pulse / 3 harmony / 4 lead) so the
    shipped intensity gating still works unchanged.
Touch NOTHING else in the music system: not the scheduler, not setState/setIntensity, not
MUSIC_TRACKS, not musicStateFor(), not MUSIC_LAYER_THRESHOLD, not the title/tense/retro tracks.

DO NOT (explicitly out of scope, both logged as flags):
  - a "preview at full intensity / undecked" mode for the Options row (FLAG-1b)
  - nudging MUSIC_LAYER_THRESHOLD[2] so tracks are 2 layers thick at wave 1 (FLAG-1c)

TESTS: extend scratchpad/test-v34-p6.js (the file that owns the music system) — do not create
a new file. Drive the REAL code, never reimplement it:
  - Part A: with a menu open, a repeat keydown on the Music Track row does NOT change
    settings.musicTrack, while a non-repeat one advances it exactly once. Same assertion for
    a volume slider row (repeat does not move AudioSys.vol) and a Difficulty toggle row.
    A repeat keydown in the NORMAL (non-menu) branch still records into keys{} — prove the
    guard did not leak into gameplay input.
  - Part B: drive the real scheduler over one full loop of each of the three gameplay tracks
    and assert ambient's TIER-1-ONLY note count (i.e. at intensity 0) is within a sane factor
    of retro's and tense's tier-1-only counts — pick the bound yourself and state it; the
    point is a regression guard against ambient silently going near-silent again, not a
    precise number. Also assert ambient's tier-1 layer has notes spread across the loop
    rather than a single cell.
  - Then re-run the FULL regression suite (all test files) and report the assertion count.

Update the GDD in place: §2.8 (ambient's rebuilt layer data + the measured density parity),
§2.16 (the keyboard menu repeat guard, and that it now matches the gamepad's edge-detected
nav — note the volume-slider consequence), the Architecture Map rows it touches, the top
Version line, and a new §7 v3.5 P1 entry. Do not push.
```

**Commit message**

```
v3.5 P1: fix the Options music-track switch (menu repeat guard + audible Ambient)

Two independent causes, both confirmed against the live build:

- The keydown handler had no e.repeat guard, so browser auto-repeat fired ~30 menu
  actions per held keypress. On the 3-value Music Track row a brief hold spun the
  selection back to its start ("nothing changed") and re-entered setState() nearly
  every frame, restarting the 0.6s crossfade from 0.0001 and pinning the music
  near-silent. The gamepad path was already edge-detected via menuNavEdges(); the
  keyboard now matches it. This also stops held-key scrubbing on the volume sliders
  and Difficulty toggles — intended, and consistent with the gamepad.

- buildAmbientTrack()'s tier-1 foundation carried one note per 8s loop (sine, gain
  0.06), so with tiers 2-4 gated off below wave 3 and the menu duck at 0.5, selecting
  Ambient sounded like the music had stopped: 9 scheduled notes per 10s vs retro's 127.
  Rebuilt its layer data — continuously-present foundation, gains in family with
  retro/tense — while keeping its slow, sparse, E-dorian character and its 4-tier
  structure. Ambient is now the calmest track, not the quietest one.

Scheduler, setState/setIntensity, MUSIC_TRACKS, musicStateFor and the other three
tracks are untouched.
```

---

## Phase 2 — the clump silhouette

**Model:** Sonnet · **Thinking: low** (mechanical render change + a clean field deletion).

### Prompt

```
Read CLAUDE.md, then grep the live build before editing.

GOAL: a garbage clump (pieces > 1) currently renders as a 7-9 vertex jittered closed hull —
i.e. an asteroid. Players read it as a hazard, when in fact you now collide with it to collect
it. Make a clump render as a simple, appropriately-LARGER version of the ordinary canister.

⚠️ THIS REVERSES A SHIPPED RULE. GDD §2.5.1 currently justifies the hull as "reads as a target,
not a pile of pickups" (v3.3 P1). That rationale was written while clumps were UN-HOOKABLE.
v3.3 P4 / item 9c made clumps directly scoopable and superseded that premise — the art never
caught up. You must REWRITE the §2.5.1 rationale bullet IN PLACE with that history (so a future
session doesn't restore the hull). Do not leave a contradicted rationale standing.

THE CHANGE:
1. drawCanister(x, y, angle, alpha, color) gains a trailing `scale = 1` parameter. Scale the
   body poly and the hazard stripe by it. The two existing call sites (the pieces===1 single
   in Garbage.draw, and the chain nodes in draw()) omit the arg and must stay BYTE-IDENTICAL.
2. Garbage.draw()'s `pieces > 1` branch: draw ONE drawCanister at scale = this.radius / 7
   (= sqrt(pieces), since radius is already 7*sqrt(pieces)). This makes the canister's long
   half-axis exactly equal the collision radius — visual and collision agree by construction.
   NO new constant.
3. KEEP the lerpColor(COLOR.garbage -> COLOR.clumpHot) tint scaled by pieces/HUNTER_COALESCE_COUNT.
   [FORK-2 = keep. If Paul chose "pure green", delete the lerp and draw at COLOR.garbage.]
   It is the only tell that a clump is about to become a Hunter.
   The radioactive alpha flicker comes free — drawCanister already does it.
4. DELETE this.hull and makeClumpHull() ENTIRELY, not just stop reading them. Three sites hold
   the field: the Garbage constructor, the merge in coalesceGarbage, and the partial-scoop
   leftover branch. Grep for every reader first and confirm nothing else touches it. Same
   discipline as v3.3 P4's bornOfScrap removal — delete the field, don't orphan it.

DO NOT TOUCH: this.radius (7*sqrt(pieces)) or any collision math; the bullet-vs-clump shatter
branch (it keys on g.pieces > 1 and g.radius — both unchanged); coalesceGarbage's merge math;
the scoop capture geometry; the pieces===1 single render.

DO NOT scale the hazard-stripe COUNT with pieces. At pieces=11 (scale ~3.32) a single long
stripe may read as "stretched" rather than "big" — that's a look-call for Paul in front of the
real render (FLAG-2b), not something to pre-emptively build.

TESTS: extend scratchpad/test-v33-p1.js (it owns the clump render; it currently asserts the
hull is cached and regenerates at merge). REWRITE those hull assertions to assert the INVERSE
in place — do not delete them and do not append alongside:
  - no `hull` field exists on a fresh Garbage, after a real coalesceGarbage merge, or on a
    real partial-scoop leftover; makeClumpHull is gone from the source.
  - Garbage.draw() at pieces = 2 / 5 / 11 is crash-free and (via a recording ctx) strokes a
    canister body scaled by sqrt(pieces) — assert the actual drawn extent tracks this.radius.
  - a pieces===1 single and a chain node still draw byte-identically to before (scale defaults
    to 1) — this is the load-bearing regression guard.
  - the clumpHot tint still lerps with pieces.
Also check scratchpad/test-v31-coalesce.js for any hull assertions and fix in place.
Then re-run the FULL regression suite and report the assertion count.

Update the GDD in place: §2.5.1 (the rationale rewrite described above + the new render),
§2.10 if it mentions the hull, the Architecture Map (Entity classes / Flow functions / draw()
rows — makeClumpHull is gone), the top Version line, and a new §7 v3.5 P2 entry. Do not push.
```

**Commit message**

```
v3.5 P2: a garbage clump renders as a larger canister, not an asteroid

makeClumpHull's 7-9 vertex jittered polygon read as a hazard, so players avoided
clumps instead of collecting them. A clump now draws as one ordinary canister scaled
by sqrt(pieces) (= radius / 7), so its long half-axis exactly equals the collision
radius that was already 7*sqrt(pieces). drawCanister gained a trailing `scale = 1`
param; the single-canister and chain-node call sites are byte-identical.

Reverses the v3.3 P1 render rule. That rule's rationale ("reads as a target, not a
pile of pickups") was written while clumps were un-hookable; v3.3 P4 / 9c made clumps
directly scoopable and superseded it — the art never caught up. §2.5.1's rationale is
rewritten in place with that history so it isn't restored later.

this.hull and makeClumpHull are deleted entirely (constructor, merge, and partial-scoop
leftover sites). The clumpHot threat tint, the radioactive flicker, collision radius,
the shatter branch, and the scoop geometry are all unchanged.
```

---

## Phase 3 — the low-health warning

**Model:** Sonnet · **Thinking: on** (audio design + a per-frame call into a persistent voice).

### Prompt

```
Read CLAUDE.md, then grep the live build before editing.

GOAL: the low-health warning is too subtle. Make it noticeably more attention-getting while
keeping it non-annoying over a long low-HP stretch.

WHAT'S ACTUALLY WRONG (verified — re-confirm by grep):
AudioSys.lowhp(on) is a 220Hz SINE, FM-warbled +/-18Hz by a 0.6Hz LFO, at a CONSTANT gain of
0.05. Peers on the same sfx bus: explosion 0.5, hit 0.16, fire 0.12, thrust 0.10 (continuous),
saucer 0.055 (continuous). It is the quietest voice in the game AND a pure sine (no harmonics
to cut through anything) AND constant-amplitude. Constant amplitude is the main problem: the
ear adapts away steady tones, so it gets LESS audible the longer it plays. Simply raising the
gain would make it more annoying and no more noticeable. Change its SHAPE, not just its volume.

THE CHANGE — keep the exact persistent-voice idiom of thrust(on)/saucer(on) (stored nodes,
built on true, torn down on false). Rebuild what the voice IS:
  - PULSE it: an amplitude LFO into a gain node so it's a slow cockpit-warning BEEP (~1 Hz
    starting point), not a drone. The onsets are what get noticed; the gaps are what keep it
    bearable.
  - Give it a BODY: one soft harmonic partner (a fifth or octave above the root, at clearly
    lower gain) so it reads as an instrument panel, not a test tone, and survives an explosion.
  - Raise the base gain into thrust's neighborhood (~0.10) — but the pulsing is doing the work,
    so don't over-lift it.
  - HP-SCALED URGENCY: pulse rate and gain scale with urgency t = 1 - hp/LOW_HP_THRESHOLD, so
    it's a gentle "hey" at 100 HP and a real alarm at 20 HP.
    [FORK-3 = HP-scaled. If Paul chose a flat beep, drop the urgency scaling entirely and
     ship one fixed pulse rate/gain — do NOT add lowhpSet() at all in that case.]

    Add AudioSys.lowhpSet(t) (a no-op if the voice isn't live) that sets the pulse LFO
    frequency and the gain from t, and call it PER FRAME from the ONE existing edge-detect
    site in update() (right after camera-follow, where lowhp(true)/(false) already fire).
    That site only runs while playing-and-unpaused (update() early-returns otherwise), and
    killShip/quitToTitle/openPause/startGame already tear the voice down — so this needs NO
    new teardown and NO new game state. Do not add a second call site.
    Ramp the params (setTargetAtTime or a short linearRamp), never a bare per-frame .value
    set at 60Hz — that zippers.

ALL of the above numbers are PLAYTEST KNOBS. Hoist them into named constants in the constants
block (never inline), comment them as knobs, and don't agonize over the exact values — Paul
will tune by ear.

DO NOT (out of scope, both logged as flags):
  - touch POWERUP_HEALTH_GAP or force-spawn a Health powerup on entering the low-HP state.
    FLAG-8a from v3.4 P5 is still open: a player can be low-HP with NOTHING to point at for up
    to 26s, and a louder siren makes that nag worse. It is deliberately still open — the
    urgency scaling mitigates it (gentle in the upper band). Re-flag it in your summary.
  - touch the red directional chevron or add any visual (a synced red vignette pulse is a good
    idea and is FLAG-3b — logged, not built).
  - touch LOW_HP_THRESHOLD (100).

TESTS: extend scratchpad/test-v34-p5.js (it owns the low-health warning) — do not create a new
file. Drive the REAL update()/damageShip()/applyPowerup()/killShip()/quitToTitle()/openPause():
  - the four existing teardown assertions must still pass unchanged — this is the load-bearing
    regression guard; a rebuilt voice must not leak a droning oscillator.
  - the rising/falling edge still fires lowhp(true)/(false) EXACTLY ONCE (not per frame).
  - the voice builds its pulse LFO + harmonic partner without throwing, and tears every node
    down on false (assert the stored handles are nulled).
  - lowhpSet: urgency at hp = LOW_HP_THRESHOLD is ~0 and at hp = 1 is ~1; the pulse rate and
    gain are monotonically non-decreasing as hp falls; params move via a RAMP, not a bare
    per-frame .value set (assert the automation call, same idiom as the P6/P7 duck/gate tests);
    it is a safe no-op when the voice is not live and when ctx is null.
  - a real 120-frame update() run at fixed HP does not rebuild the voice (spy the constructor
    path) — proves the per-frame call is idempotent on the node graph.
  Then re-run the FULL regression suite and report the assertion count. Note: test-p5 §G and
  test-boundary §E have documented pre-existing RNG flakes — confirm any flake is one of those
  and not new.

Update the GDD in place: §2.12 (the low-health warning subsection — the new pulsed/harmonic/
HP-scaled voice, the new constants, FLAG-8a restated as still open), §2.8 (AudioSys.lowhp +
lowhpSet), the Architecture Map (Constants / AudioSys / update(dt) rows), the top Version line,
and a new §7 v3.5 P3 entry. Do not push.
```

**Commit message**

```
v3.5 P3: the low-health warning is a pulsed, HP-scaled alarm

The old warning was a constant-amplitude 220Hz sine at gain 0.05 — the quietest voice
on the sfx bus, with no harmonics to cut through explosions (0.5) or thrust (0.10), and
constant amplitude, which the ear adapts away the longer it plays. Raising its volume
would have made it more annoying without making it more noticeable.

Rebuilt the voice, same persistent-voice idiom as thrust()/saucer(): a slow ~1Hz
cockpit-warning pulse (onsets get noticed; the gaps keep it bearable), a soft harmonic
partner so it reads as an instrument panel rather than a test tone, and a base gain in
thrust's neighborhood. New AudioSys.lowhpSet(t) scales the pulse rate and gain with
urgency (1 - hp/LOW_HP_THRESHOLD), so it's a gentle prompt at 100 HP and a real alarm
at 20 — driven per-frame from the single existing edge-detect site in update(), which
only runs while playing-and-unpaused, so no new teardown or game state was needed. All
tuning values are named playtest knobs.

FLAG-8a (v3.4 P5) remains open and is now sharper: POWERUP_HEALTH_GAP is 18-26s, so a
player can be in the low-HP state with no Health powerup to point at for up to 26s. The
urgency scaling keeps the siren gentle in the upper band, but a force-spawn may be
wanted — deliberately not done here.
```

---

## After the round

- Archive `PLANNED-FEATURES-v3.4.md` + `IMPLEMENTATION-PHASES-v3.4.md` → `archive/` with version
  suffixes. **Do not archive `DIFFICULTY-LEVERS.md`** — it's a living doc.
- Rename `archive/IMPLEMENTATION-PHASES.md` → `archive/IMPLEMENTATION-PHASES-v2.md` (outstanding since
  the v3.3 round — bare names aren't allowed in `archive/`).

### Playtest asks this round opens

1. **P1** — does a held ► on a volume slider now feel too slow (10 taps for a full sweep)? If so the
   follow-up is a throttled repeat, not reverting the guard (FLAG-1a).
2. **P1** — does Ambient now read as *calm* rather than *quiet*, and is it still distinct from Retro?
3. **P2** — does a `pieces = 11` canister read as **big**, or as **stretched**? (FLAG-2b — the fix would
   be scaling the stripe count with pieces.)
4. **P2** — with clumps now obviously reading as loot, do you still ever *shatter* one, or is scooping
   always strictly correct? (This is the long-open v3.2 ask 9c, now sharpened — FLAG-2a.)
5. **P3** — is the pulse noticeable *through* an explosion, and is it still bearable after 30 seconds at
   low HP? Does the urgency ramp read as urgency, or just as "it got louder"?
6. **P3** — **FLAG-8a**: how often are you low-HP with no Health powerup on the field to run to? That's
   the number that decides whether a force-spawn is needed.