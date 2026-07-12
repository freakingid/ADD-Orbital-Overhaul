# PLANNED FEATURES — v3.5 (Changeset 6)

Design authority for this round. Shipped behavior lives in `orbital-overhaul-GDD.md` §2; build reality
is `asteroids-deluxe.html`. Everything below was **verified against the live build post-Changeset-5
(v3.4 P1–P7)** by grep + a headless drive of the real code — not from prior-conversation memory.

Three items: **(1)** the Options music-track switch, **(2)** the clump silhouette, **(3)** the low-health
warning. They are mutually independent and can ship in any order.

---

## 1. Music track switch — "it doesn't change, it just stops playing"

### What I found

The switch **mechanically works.** I drove the real `MusicSys`/`updateMusic`/`menuOptions` headlessly:
pausing mid-game, opening Options, and flipping the row *does* fire `setState()`, *does* fade out the
old `trackGain`, *does* build a new `trackGain` + `layerGates`, and *does* schedule notes. There is no
broken code path. Both halves of the report are real, but they have **two separate causes**, neither of
which is the one the symptom implies.

**Cause A — the `ambient` track is effectively inaudible ("it just stops playing").**

Measured note density and audible energy over a 10 s window (peak × layer gate × trackGain), driving
the real scheduler:

| track | notes / 10 s | audible energy | tier-1 (always-on) layer |
|---|---|---|---|
| `retro` | 127 | **5.73** | square bass, 16 notes / 3.2 s loop, gain 0.075 |
| `tense` | 138 | ~6 | sawtooth bass, 32 notes / 4.0 s loop, gain 0.08 |
| `ambient` | **9** | **0.06 – 0.26** | sine, **1 note per 8.0 s loop**, gain 0.06, lowpass 300 Hz |

Ambient's foundation layer is **one soft sub-bass note every eight seconds**. At waves 1–2 that is the
*only* ungated layer (see Cause C), and the Options screen further ducks music to `MUSIC_DUCK_GAIN`
(0.5), so you audition it at half volume. Switching to Ambient in the pause menu genuinely sounds like
the music stopped — because for practical purposes it did. This is a **track-data defect**, not a
scheduler defect: ambient sits ~25× below its siblings.

**Cause B — the keyboard menu handler has no `e.repeat` guard ("it does not actually change").**

`window.addEventListener("keydown", …)` (~line 1075) routes straight to `handleMenuKey(k)` with no
repeat check. Browser key auto-repeat fires ~30 keydowns/sec while ► is held. Simulated a ~0.5 s hold
(15 repeats) over a 3-value list: **the selection spins and lands back on `retro`** — you pressed the
key, the label ended where it started, "nothing changed." Each repeat *also* re-enters `setState()`,
which discards `trackGain`, restarts the 0.6 s ramp from 0.0001, and resets `step = 0` — so the music
is pinned near-silent for as long as the key is down.

**This is not a music bug — it's a menu-input bug**, and it affects **every** left/right row: the three
volume sliders (a held key slams a slider 1.0 → 0.0 in ~0.3 s) and both Difficulty toggles. Note the
**gamepad path is already correct**: `handleGamepadMenu()` runs through `menuNavEdges()`, which is
strictly edge-detected (one press, one move). The two input methods currently disagree on the same
rows. The fix is to make the keyboard match the gamepad.

**Cause C — contributing, not a bug: at waves 1–2 every track is tier-1 only.**

`difficultyFactor(1) = 0.000`, `difficultyFactor(2) = 0.118`, and `MUSIC_LAYER_THRESHOLD[2] = 0.20`. So
below wave 3 all three tracks are reduced to their foundation layer, and sound far more alike than
intended. This is v3.4 P7 working exactly as designed — but it blunts an Options audition. No change
recommended (see FLAG-1c).

### The change

- **(1a)** Guard `e.repeat` in the keydown handler's menu branch. One press = one menu action, matching
  the gamepad. Single edit, single site.
- **(1b)** Rebuild `buildAmbientTrack()`'s layer data so the track is *calm* rather than *absent* —
  a continuously-present tier-1 foundation and layer gains in family with `retro`/`tense`. Track data
  only; the scheduler, the gating architecture, `MUSIC_TRACKS`, and `musicStateFor()` are untouched.

### Forks

> **FORK-1 — what is "Ambient" supposed to be?** Is it meant to be a *quieter* track, or an *equally
> present but calmer* one? I recommend **equally present, different in character**: "quiet" is what the
> Music Volume slider is for; a track that a player selects and then cannot hear reads as broken, not
> as ambient. The rebuild targets audible parity with retro/tense (sustained pads, a real foundation),
> keeping the sparse, slow, E-dorian long-haul mood. **Say no if you actually want Ambient to be the
> near-silence option** — in which case 1b shrinks to "raise the floor just enough to prove it's on."

### Flags (no sign-off needed)

- **FLAG-1a — scope widening, deliberate.** The `e.repeat` guard changes shipped menu feel on the
  volume sliders: a full 1.0 → 0.0 sweep becomes 10 taps instead of one hold. That is exactly what the
  gamepad already requires, and I think it's correct, but it *is* a behavior change beyond the music
  row. If held-key scrubbing on sliders turns out to be missed, the follow-up is a throttled repeat
  (accept a repeat every ~120 ms) rather than reverting the guard — deliberately not built now.
- **FLAG-1b — no track preview mode.** In the pause menu you audition through a 0.5 duck and (early on)
  through tier-1-only gating, so the Options row never lets you hear a track as it will actually sound
  at wave 12. A "preview at full intensity, undecked, while the cursor is on this row" mode is the
  obvious fix and is **out of scope** — it would make Options sound unlike gameplay, which is its own
  confusion. Logged, not built.
- **FLAG-1c — tier-1-only below wave 3 (Cause C) left alone.** Nudging `MUSIC_LAYER_THRESHOLD[2]`
  0.20 → 0.0 would give every track two layers from wave 1 and make an early audition more
  representative, at the cost of one thickening step. One-line change if you want it; not doing it.

---

## 2. Clump silhouette — larger canisters, not asteroids

### What I found

`makeClumpHull(radius)` (~line 2072) generates **7–9 vertices at `radius × rand(0.8, 1.15)` with angular
jitter** — that is, definitionally, an asteroid silhouette. Your read is correct, and the code agrees
with you.

### ⚠️ Conflicts with shipped §2

**This reverses v3.3 P1.** GDD §2.5.1 currently justifies the hull as: *a clump renders as ONE closed
hull polygon "so it reads as 'a target,' not 'a pile of pickups'"* — it deliberately replaced a
mini-canister cluster, because at the time playtest read the cluster as a pile of pickups.

**That rationale was written while clumps were un-hookable** (v3.2 P1). **v3.3 P4 / 9c superseded that
premise** — clumps became directly scoopable. So "a pile of pickups" is now *the correct read*, and the
art simply never caught up with the mechanic. This is not a taste reversal; it's the render finishing a
migration the rules already made. **The §2.5.1 rationale bullet must be rewritten in place** (house rule
— never leave a contradicted rationale standing), with that history, so a future session doesn't
"restore" the hull.

Note the resulting shape is deliberate: a clump now *looks* like salvage (correct — you collide with it
to collect it) while remaining a bullet target for shatter. That's fine: shatter is the lossless
harvesting tool, not a defense. Nothing about the collision model changes.

### The change

- `drawCanister(x, y, angle, alpha, color)` gains a trailing **`scale = 1`** parameter. The two existing
  call sites (the `pieces === 1` single, ~2147; the chain nodes, ~3191) omit it and stay byte-identical.
- `Garbage.draw()`'s `pieces > 1` branch draws **one `drawCanister` at `scale = this.radius / 7`**
  (`= √pieces`). This makes the canister's long half-axis exactly equal the collision radius, which is
  already `7 · √pieces` — visual and collision agree by construction, no new constant.
- **`this.hull` and `makeClumpHull()` become dead and are deleted entirely**, along with both
  regeneration sites (the merge in `coalesceGarbage`, ~3061; the partial-scoop leftover, ~3290) and the
  constructor field (~2114). Same "delete the field, don't leave it orphaned" discipline as v3.3 P4's
  `bornOfScrap`. Tests asserting hull caching/regeneration get **rewritten to assert the inverse**
  (no `hull` field; the clump draws via `drawCanister` at the derived scale).
- The radioactive alpha flicker comes along for free — `drawCanister` already does it.

### Forks

> **FORK-2 — keep the `clumpHot` tint?** Your words are "simply render like appropriately-larger
> versions of the small garbage pieces," which read literally means dropping the `lerpColor(COLOR.garbage
> → COLOR.clumpHot)` reddening as `pieces → HUNTER_COALESCE_COUNT`. **I recommend keeping it.** It is the
> *only* tell that a clump is about to become a Hunter, and it doesn't fight your goal: a large green
> canister that gradually goes orange still unmistakably reads as a canister, and the orange is the
> thing telling you to deal with it *before* it turns into the hazard. Dropping the tint makes clumps
> friendlier *and* removes the warning. Say the word if you want it pure-green.

### Flags (no sign-off needed)

- **FLAG-2a — the big canister may read as *too* safe.** Making a clump look like loot could kill the
  shatter loop (playtest ask 9c has been open since v3.2 P2: "do you *hunt* clumps to break them?").
  With an obviously-scoopable 3× canister sitting there, the greed-vs-tidiness fulcrum may collapse into
  "always just scoop it." Purely a playtest read; no pre-emptive change.
- **FLAG-2b — visual heft at high `pieces`.** At `pieces = 11`, `scale ≈ 3.32` → a ~46 × 33 px canister
  with a single 46 px hazard stripe. That may read as *stretched* rather than *big*. If it does, the
  cheap fix is to scale the **stripe count** with pieces (a 3-piece clump gets 2–3 stripes, a bundle) —
  a look-call best made in front of the actual render, so it's **not** being specced now.

---

## 3. Low-health warning — more noticeable, still not annoying

### What I found

`AudioSys.lowhp(on)` (~line 526): a **220 Hz sine**, FM-warbled ±18 Hz by a 0.6 Hz LFO, at a
**constant gain of 0.05**, into `this.sfx`.

Gains of its peers on the same bus: **explosion 0.5 · hit 0.16 · fire 0.12 · thrust 0.10 (continuous) ·
saucer 0.055 (continuous) · lowhp 0.05**. It is **the quietest voice in the game** — and it is a *pure
sine*, so it has no harmonic content to cut through anything.

Three structural reasons it's subtle, and **turning it up fixes none of them**:

1. **Constant amplitude → no onsets.** Attention locks onto transients. A steady tone is exactly what
   the auditory system adapts away — the longer it plays, the less you hear it. This is the main one.
2. **Sine → no harmonics.** Masked by explosions (10× its gain), thrust noise, and the music bed.
3. **Lowest gain on the bus.** Real, but third in importance.

A louder steady drone would be *more annoying and no more noticeable*. The fix is to change its
**shape**, not its volume.

### The change

Keep the exact persistent-voice idiom (`thrust(on)` / `saucer(on)` — stored nodes, built on `true`, torn
down on `false`; all four existing teardown sites and the `startGame` reset stay as they are). Change
what the voice *is*:

- **Pulse it.** Add an amplitude LFO into a gain node so the tone becomes a slow **beep**, not a drone —
  a cockpit-warning pulse at roughly 1 Hz. Onsets are what get noticed; gaps are what keep it bearable.
- **Give it a body.** A single soft harmonic partner (a fifth or octave above, well below the root's
  gain) so it reads as an *instrument panel* rather than a test tone, and survives an explosion.
- **Raise the floor** into the same neighborhood as `thrust` — but the pulsing is doing the work, so
  don't over-lift it.

All of the above are **playtest knobs** — starting values in the phase prompt, deliberately not tuned
here.

### Forks

> **FORK-3 — static beep, or HP-scaled urgency?** The low-HP band is 100 HP wide (`LOW_HP_THRESHOLD`
> 100 of `SHIP_MAX_HP` 250 — 40% of the bar) and can persist for a long time. A single fixed pulse rate
> across that whole band is exactly the annoying case: identical nagging at 99 HP and at 10 HP.
> **I recommend HP-scaled urgency** — pulse rate and gain ramp with `1 − hp / LOW_HP_THRESHOLD`, so it's
> a gentle "hey" at 100 HP and a real alarm at 20. That *is* "noticeable yet not annoying," and it's
> cheap: `update()` already early-returns while paused and already has the edge-detect site, so a
> per-frame `AudioSys.lowhpSet(t)` call needs **no new teardown** and no new state. It also gives you a
> second free reading of your HP without looking at the bar. **Say no** if you'd rather have one flat,
> predictable beep — that's a smaller change and a legitimate preference.

### Flags (no sign-off needed)

- **FLAG-3a — this sharpens the open FLAG-8a.** v3.4 P5 left this deliberately unresolved:
  `POWERUP_HEALTH_GAP` is 18–26 s, so a player can sit in the low-health state with the siren running
  and **no Health powerup on the field to point at for up to 26 seconds**. Today that's tolerable
  because the siren is nearly inaudible. Make it noticeable and it becomes a nag you *cannot act on*.
  The two candidate fixes — force-spawn a Health powerup on entering the low-HP state, or shorten the
  gap while low — are **out of scope for this changeset**, and FORK-3's urgency scaling mitigates it
  (it stays gentle in the upper band, where you have time). Flagging it as the thing most likely to
  need a follow-up phase after playtest.
- **FLAG-3b — no visual change.** The red directional chevron (§2.12) is untouched. A synced red screen
  vignette pulse is the classic partner to a warning beep and would let the audio stay *quieter* while
  being *more* noticeable — a good idea, and scope creep. Logged, not built.

---

## Housekeeping (after the round)

- Archive `PLANNED-FEATURES-v3.4.md` + `IMPLEMENTATION-PHASES-v3.4.md` → `archive/` with version
  suffixes. **`DIFFICULTY-LEVERS.md` is a living doc — never archive it.**
- The bare-named `archive/IMPLEMENTATION-PHASES.md` rename (→ `-v2.md`) is *still* outstanding from the
  v3.3 round. Do it this time.
  