# PLANNED-FEATURES-CS036 — Orbital Overhaul

Spec for changeset CS036. Companion: `IMPLEMENTATION-PHASES-CS036.md`.

Baseline: `a909d33` ("Doc additions before CS036 — draft spec input"), build unchanged since
`d8b82cf` ("cs-35 p7: closing phase — version 1.0.0.35, gate fold-in, doc sweep"), `GAME_VERSION`
`1.0.0.35`, registry **106** entries / **10** section headers, `LEVERS` **18**,
`POWERUP_DROP_TYPES` **5**, suite **143 files / 140 passed / 3 failed (pre-existing) / 0 skipped** on
a full clone. Thirteen suite files hard-fail on a shallow clone — work from a **full clone**, never
`--depth 1`.

Four scope areas:

1. **The level-end ceremony** — freeze the action and announce it (the headline item)
2. **A louder Hunter Satellite heartbeat** — CS035 G18, resolved as motion, not colour
3. Two small feedback fixes from the CS035 gate
4. Suite triage — the three standing red files

Every `FORK-CS036-*` below carries Paul's answer, resolved at the CS035 closing session.

---

## §0 Corrections to prior assumptions

### §0.1 CS035 P3 is not broken. It answered a different question.

Paul's CS035 gate reported the level-end window as apparently inert (G9), and G9–G14 went unanswered
as a result. **The window runs.** What it does not do is *announce itself*: `PLANNED-FEATURES-CS035.md`
§3.1's FORK-L resolved to "the player retains full control throughout — thrust, rotate, fire, tow,
dock. Steps 2/4/5 are ordinary gameplay frames with damage switched off." So the field keeps
simulating, Hunter Satellites keep hunting, and the only tell is a 2 Hz alpha pulse on the ship.

The intent is a **ceremonial pause**: the action stops, "Level N Complete" holds until the player
presses on, the Achievements panel runs if there is one, "Level N+1" announces as it already does,
play resumes. ⛔ **This is not a bug fix and must not be written up as one.** CS035 P3 shipped what its
spec asked for; CS036 asks for something else at the same seam.

### §0.2 ⛔ Half the desired sequence ALREADY SHIPS

The Achievements panel already defers `nextWave()` to `dismissCelebration()` (CS030 P5), and
`nextWave()` is what seeds `game.levelBanner` and fires `VoiceSys.sayLevel()`. So **panel →
"Level N+1" → next level is already the shipped order**, and ⛔ the `return` that *is* that deferral
is a standing invariant (`PLANNED-FEATURES-CS035.md` §3.7) and is not touched by this changeset.

What is missing is only the front half:

1. Freezing the field at wave-clear rather than at panel-open.
2. A "Level N Complete" announcement during that freeze, held until the player presses on.

**Scope it as that.** Every other step in §1.1 is either shipped or a one-line change to a condition.

### §0.3 ⛔ The freeze is a REDUCED SIM, not just another early-return term

`update()` early-returns on `game.state !== "playing" || game.paused || game.celebration`. Four things
live **below** that return, in the playing body's tail, and a naive extra term stalls all of them:

| What | Consequence of a naive freeze |
|---|---|
| `game.levelBanner.life -= dt` | **the banner never expires — a hard hang** at §1.1 step 4 |
| `VoiceSys.update()` (the queue drain, deliberately LAST) | parked critical lines never speak |
| the heartbeat (`game.beatTimer`) | audio pacing stops |
| `Achievements.evaluate()` | unlocks raised by the clear are deferred |

**The shipped precedent is `updateDeath()`** — v3.6 P5's "the death spectacle runs its own reduced
sim," a branch that sits *before* the general early-return and runs exactly what that state needs.
CS036 follows it: `updateLevelEndFreeze(dt)`, a small reduced sim, with each phase below stating
exactly what it runs.

⚠ **Two of the four deliberately stay stopped, matching the celebration panel's shipped behaviour.**
The panel's own freeze already drops `Achievements.evaluate()` and the heartbeat, and the wave-clear
branch's `return` comment says why in terms: *"an unlock raised by THIS clear would otherwise toast on
top of the panel and still not appear IN it, since evaluate() runs after this flush either way."*
Running them during the completion hold would change achievement timing that has been stable since
CS030. **They stay stopped. Only the voice drain and the banner countdown run.**

`updateToasts(dt)` and `updateMusic()` are in `loop()`, **not** `update()`, so they survive any freeze
already and need no work.

### §0.4 §0.4's banner problem dissolved — the two announcements never share a countdown

The draft worried that `drawLevelBanner()` derives `elapsed = DEBUG.levelBannerTime -
game.levelBanner.life`, so two cards of different lengths would break the fade. **With FORK-E resolved
to "until the player presses on," the completion announcement has no duration at all** — it fades in,
holds, and is replaced. Nothing counts down, so nothing can disagree with `levelBannerTime`.

⛔ `game.levelBanner` is therefore **not** given a `total` field and `drawLevelBanner()` is **not**
generalised. The completion announcement is its own sibling draw function sharing the same style
constants (§1.3).

---

## §1 The level-end ceremony

### §1.1 The sequence

| # | Moment | Field | Ends when | Status |
|---|---|---|---|---|
| 1 | Last Garbage Satellite dies | **freezes** | — | **new** |
| 2 | "Level N Complete" + prompt | frozen | player confirms | **new** |
| 3 | Achievements panel, if any | frozen | player dismisses | ships today |
| 4 | `nextWave()` → "Level N+1" | frozen, then live | the label starts fading | **freeze is new** |
| 5 | Grace | live | `levelEndGrace` | ships today |
| 6 | Play | live | — | — |

If no panel is pending, step 3 is skipped — the existing
`if (game.state === "playing" && game.pendingAch.length)` branch already forks there and needs no new
code path.

### §1.2 The resolved forks

**FORK-CS036-A → A1. The freeze freezes everything, ship included.** A true freeze-frame: entities,
collisions, the ship, the tow chain. One reduced-sim branch (§0.3), not a per-system gate. A selective
freeze was considered and rejected as materially more code and more places to get wrong later.

**FORK-CS036-B → the freeze lifts when the "Level N+1" label STARTS FADING OUT.** The label itself is
exactly as shipped — same string, same style, same `levelBannerTime` — and the field is still beneath
it until it begins to fade, at `game.levelBanner.life <= DEBUG.levelBannerFade` (1.7 s in at the
shipped 2.2/0.5). ⛔ **This ties an unfreeze to two render knobs, and both are draggable** — see the
degenerate cases in §1.5.

**FORK-CS036-C → C2. `game.levelEndSafe` keeps its full extent, unchanged.** Belt-and-braces: most of
the window now protects against a stopped field, and that is accepted. ⛔ No gate site moves, and the
⛔ "`levelEndSafe` is never merged into `ship.invuln`" invariant (GDD §2.20.1) stands exactly as
written. **This fork changes no code** — it is recorded so a later cleanup pass does not read the
redundancy as an oversight and delete it.

**FORK-CS036-D → D1. The alpha pulse runs during the grace only.** Its job is "you cannot be hit right
now," which is meaningless while nothing moves. The accumulator and `Ship.draw()` both switch their
condition from `game.levelEndSafe` to `game.levelEndGraceT > 0`. ⛔ **Both knobs are RETAINED** —
`levelEndFade` and `levelEndGracePulseEnd` still shape the ramp across the grace, which is the only
place the pulse now runs. No registry row moves for this.

**FORK-CS036-E → E1, amended: `levelEndHold` is RETIRED.** The completion announcement is not timed;
it holds until the player confirms. The knob timed exactly one thing, that hold, and there is nothing
left for it to time. ⛔ **Registry 106 → 105 at that phase** (§7). ⛔ There is **no minimum hold and no
input lockout** — a fresh press is required rather than a held button, which §1.4 gets structurally.

**FORK-CS036-F → F2. The celebration panel's header reverts to `"ACHIEVEMENTS UNLOCKED"` in both
branches.** CS034 P5 made the wave branch read `"LEVEL N COMPLETE"`; with a full-screen announcement
saying that two seconds earlier, the header was saying it twice. The gameover branch already reads
`"ACHIEVEMENTS UNLOCKED"`, so this is deleting the `isWave` ternary from `menuPanel()`'s title
argument. ⚠ `isWave` itself has other readers — check before deleting the binding.

**FORK-CS036-G → no voice line.** `VoiceSys.sayLevel()` still announces "Level N+1" from inside
`nextWave()` at step 4, and step 2 is silent. ⛔ Standing rule, restated because this is exactly where
a phase would be tempted: **no `phon` string is ever derived, edited or improved by a phase.** Every
one is composed and zero-error-verified in `tools/voice-robot-lab.html` and pasted verbatim. A
completion line would be a future changeset with a lab session budgeted for it.

### §1.3 The announcement

**Style is the shipped "Level N" banner's, exactly** (Paul: "the same style as the 'Level N' we now use
to announce a coming level") — `LEVEL_BANNER_SIZE` (72), `LEVEL_BANNER_Y` (24), `COLOR.text`, centred,
through `drawText`. It is **not** a panel, not a card, and adds no new visual vocabulary.

- **Text:** `"Level N Complete"`, where `N` is the wave just cleared. ⛔ `game.wave` is still the
  completed wave at this point — `nextWave()` increments it and is deferred to step 4 — so read it
  directly and do **not** compensate.
- **A prompt sits under it**, in `CELEB_HINT`'s idiom (dim, small, naming the actual bindings rather
  than a physical button): proposed `LEVEL_DONE_HINT = "ENTER / A  continue"`. ⚠ Paul's phrasing was
  "press fire to continue," but `fire` is not the binding this uses (§1.4) and A is *fire* in play
  while being *confirm* at every menu. **Exact wording is a gate question** (§8).
- **Alpha:** fades in over `DEBUG.levelBannerFade`, then holds at full for as long as the freeze lasts.
  ⛔ **No fade-out** — the panel or the "Level N+1" label replaces it on the confirming frame.
- **⛔ It is a SIBLING of `drawHUD()`, like `drawLevelBanner()` and `drawCaption()` are**, and is
  **not** gated by Capture's `H` toggle: it is a transient announcement, the same category as the
  achievement toast and the game-over text. `drawLevelBanner()`'s own header states this rule; follow
  it rather than re-deriving it.

### §1.4 The input

⛔ **Mirror the celebration panel's contract exactly. Do not invent a new one.**

- **Keyboard:** a branch in the keydown handler, `if (!e.repeat)`, accepting
  `bindings.confirm.keys` or `bindings.back.keys` — the same pair, edge-detected the same way, that
  `game.celebration` uses one branch below.
- **Gamepad:** the matching branch in `handleGamepadMenu()`, on `pressedConfirm || pressedBack`.
- ⛔ **Both handlers, or neither.** CLAUDE.md's standing rule from CS030 P4: a guard added to one and
  not the other lets a controller player blow straight through and never see it.
- ⛔ **The branch sits IMMEDIATELY BEFORE the `game.celebration` branch in both handlers**, so input
  priority matches the visual order: completion announcement → panel → play.
- ⛔ **`resetMenuNav()` fires when the freeze arms**, exactly as the panel's open does and for the
  identical reason its comment gives: *"the nav latch matters MORE here, where the player is mid-flight
  and may well be holding the stick."*

**Why a held fire button cannot skip the announcement:** the keydown that fired the killing shot
already fired *before* the freeze armed, `!e.repeat` blocks the auto-repeat, and `resetMenuNav()`
clears the gamepad edge. The protection is structural, which is why no minimum-hold timer was added.
⚠ **Verify this at the gate anyway** (§8) — it is the single most likely way this feature fails in the
player's hands.

### §1.5 ⛔ Traps

1. **The unfreeze reads two draggable render knobs.** `levelBannerTime` (0–8 s) and `levelBannerFade`
   (0–3 s) are both live in the debug panel, and `fade >= time` makes the unfreeze condition true on
   the banner's first frame. Write it so that degrades to "unfreeze immediately" rather than glitching
   — the same spirit as `drawLevelBanner()`'s own `Math.max(0, ...)` guard, which exists for exactly
   this pair. `levelBannerTime === 0` (no banner at all) must also unfreeze immediately, not hang.
2. **The freeze spans `nextWave()`.** It arms at wave clear and lifts partway through the *next*
   level's banner, so it is in-flight state that **must survive a wave boundary** — the same category
   as `levelEndSafe`/`levelEndGraceT`/`levelEndPulseT`. ⛔ Reset it in the **run**-level reset
   (`resetRun()`), never in `nextWave()`, and add it to that function's standing ⛔ note.
3. **The Perfect Wave bookkeeping moves.** `lifetime.perfectWaves++`, `noScratchWave3` and
   `flawlessLateWave` currently fire at the `waveClearTimer > DEBUG.levelEndHold` crossing. With that
   threshold retired they move to the **arm** (the `waveClearTimer === 0` latch). Behaviourally
   identical — the ship is invincible across the whole span either way, so `dmgThisWave` cannot change
   between the two points — but it is a real move and must be stated, not slipped in.
4. **`waveClearTimer` survives as the arm latch.** Nothing reads it as a threshold any more, but the
   `=== 0` latch and the `else`-branch zeroing are what make the window re-arm on every clear. ⛔ Do
   not delete it as newly-unused.
5. **CS035's banner-crossing edge is re-derived, not ported.** A wave cleared while the previous
   level's banner is still live armed the grace early. Under the freeze the *new* level's banner cannot
   be live when a wave clears — the field is frozen through it and nothing can die — so the case
   changes shape. **Re-derive it in the phase that owns the freeze tail and record what it becomes**;
   do not carry the old flag forward blindly and do not assume it vanished.
6. **`AudioSys.thrust(false)`** is called by both existing early-return paths. The freeze must too, or
   a player thrusting on the killing frame gets a stuck engine loop over a silent, motionless field.

### §1.6 Not in scope

- Any change to the Achievements panel beyond F2's header string — its open, its input gating, its
  `resume: "wave"` field, or `dismissCelebration()`'s deferred `nextWave()`. ⛔ The `return` that is
  the deferral stays exactly where it is.
- `game.pendingAch` remains a flushed bucket, ⛔ never filtered by `game.wave`.
- The "Level N+1" label's own text, style, timing and voice line. Unchanged.

---

## §2 A louder Hunter Satellite heartbeat

**FORK-CS036-H / -I / -J → resolved: NO COLOUR CHANGE.** Paul reversed CS035's G18 answer at this
session: the volatile Hunter Satellite does **not** turn red. `PLANNED-FEATURES-CS035.md` §6's "No
Hunter colour change for volatility. Motion is the tell" therefore **stands**, and ⛔ `lerpColor()` and
a hazard red stay deleted. `COLOR.satellite` is unchanged.

**What CS036 does instead:** the existing heartbeat is the right idea but easy to miss. Paul: *"the
transition from small to large [should] happen quickly, so it is more of a punch, and then the
transition back down to the smaller size will be slower."*

⛔ **That is the shape the mechanism already has.** CS035 P4 shipped an asymmetric linear ramp — grow
at `hunterPulseGrow` %/s, shrink at `hunterPulseShrink` %/s, clamp and flip at
`hunterPulseMin`/`hunterPulseMax` — precisely so it would read as pumping rather than breathing. **No
new mechanism, no easing curve, no new state.** What is wrong is the numbers, and in one case the
bounds that hold them.

- **Retune the four `def`s** toward a harder punch and a slower settle. Current: 87 / 125 / 55 / 28
  (~0.69 s out, ~1.36 s back). Direction of travel: a wider envelope and a much faster growth rate.
- **⛔ `hunterPulseGrow`'s `max` of 300 %/s is the binding constraint and must be raised.** At the
  current ceiling an 87→125 sweep takes 0.13 s, which is fast — but a *wider* envelope at the same
  ceiling is slower again, so widening the envelope without raising the rate ceiling makes the punch
  worse, not better. Raise it far enough that the fastest reachable growth is effectively
  instantaneous at 60 fps.
- **`hunterPulseMax`'s `max` of 200 %** is not currently binding; leave it unless the gate wants past
  it.
- **⛔ Draw-only, unchanged.** `this.radius`, `this.shape` and `this.inner` are never touched, and the
  collision circle can never depend on animation phase. `draw()` keeps scaling a **fresh** vertex array
  per frame.
- **⛔ Still not a lever.** `LEVERS` stays 18; `DIFFICULTY-LEVERS.md`'s not-a-lever row gets the new
  numbers.

**Gate answers here are numbers, not yes/no** (§8).

---

## §3 Small feedback fixes

### §3.1 A cooldown on the dock push's `shieldPing()`

**FORK-CS036-K → a cooldown, ~0.5 s.** The dock lockout's push fires one `AudioSys.shieldPing()` per
pushed piece of Debris per frame, so several pieces on the hull stack the tell — which is what Paul's
G5 note ("numerous rapid collisions between ship and debris") was most likely hearing.

New knob, DELIVERY section: `dockPingCooldown`, `def 0.50`, `min 0`, `max 3.0`, `step 0.05`, unit `s`,
label `"Dock push ping cooldown"` (23 chars). ⛔ **Registry +1** (§7).

- One timer on `game`, counted down wherever the per-frame decays live. The push site pings only when
  it is at 0, then re-arms it.
- ⛔ **Reset in `resetRun()`, not only `startGame()`** — the standing CS016 P3 both-places rule; a
  field added to `startGame()`'s thin body is missed by every resumed run.
- ⛔ **At `0` the feature is off** and every push pings, exactly as it does today. That is the gate's
  clean A/B, the same property `magnetResumeDelay`'s own 0 has, and it is why `min` is 0 and not 0.05.
- ⛔ **The push itself does not change.** Velocity is still SET, never added; direction, magnitude and
  the degenerate-case fallback are all untouched. This is an audio rate limit and nothing else.

### §3.2 The dock apron stays as it is

**FORK-CS036-L → accept as intended pressure. No work.** Paul: *"the point to the player is that they
should not plan on parking in the middle of the dock — it will not help them in any meaningful way."*

⛔ **The lockout zone stays at `dock.radius + DOCK_NEIGHBORHOOD_PAD` = 88 + 40 = 128 px**, checked
against a shrink-to-88 alternative and rejected. Recorded here because it will look shrinkable to a
future reader: the lockout and the `deliveryCount = 0` reset are the **same expression**, and shrinking
only the lockout leaves a 40 px annulus where the ship is `inRing` (so the counter never resets) but
hooks still succeed — from which a player could hook and deliver repeatedly with `deliveryCount`
climbing past `cargoMax`. **That breaks the structural guarantee `game.deliveryCount ≤ game.cargoMax`**
(GDD §2.10/§2.10.2), which "Maxed Out is a level-12+ achievement BY CONSTRUCTION" depends on. If the
zone is ever resized, ⛔ **both boundaries move together or neither does.**

### §3.3 FLAG-CS034-e — the debug label that does not fit

**FORK-CS036-M → whatever is simplest: shorten the label, do not widen the column.** Widening touches
every row's layout; the label is one string.

`debrisBounceRestitution`'s label becomes **`"Garbage Sat bounce restitution"`** (30 chars, inside the
hard 32-char column), replacing the non-canonical `"Satellite bounce restitution"`. ⛔ `drawDebug`
neither wraps nor truncates, so 32 is a hard ceiling, not a guideline.

⛔ **The `id` is NOT renamed.** `debugShown` persists **by id** inside `afd_settings_v1.debug`;
renaming it would orphan every player's saved tuning for that row. Only the `label` moves.

---

## §4 Suite triage — the three standing red files

**In scope for CS036, one phase, those three files only.** A changeset that opens with a red suite
cannot tell its own regressions from the furniture, and CS035 ran the whole way with that noise.

| File | Symptom | Age |
|---|---|---|
| `test-f2.js` §g | "shield deflection consumed energy" — fails **deterministically** | pre-CS035, undocumented until CS035 P1 |
| `test-v36-death.js` §A | 3 assertions on `Achievements.save` call counts around `killShip` | pre-CS035, undocumented until CS035 P1 |
| `test-cs023-p3.js` TRAP 3 | a pin against a fixed historical SHA | carried since CS035 P5 |

⛔ **Diagnose before fixing, and say which it was.** Each of these is either a stale test or a real
build defect, and the phase must determine which for each one rather than assuming "old test, repoint
it." `test-v36-death`'s is the one to be most careful with: if `Achievements.save()` genuinely fires
more than once around `killShip`, that is a **build** bug with save-write consequences, not a test to
adjust.

**Also in this phase:** FLAG-CS031-c's one-line fix, `game.celebration = null;` in `resetShip()` — the
celebration-panel state leaking across sections, which is `test-f2.js`'s *other*, intermittent failure
and is latent in 29 suite files that reach a death/gameover without ever mentioning
`game.celebration`. ⚠ CS036 §1 puts a freeze on the same seam, so this is worth doing here rather than
later.

**Explicitly NOT in this phase:** the thirteen shallow-clone hard-failers, FLAG-CS027-c and
FLAG-CS027-d. All three remain opportunistic backlog.

---

## §5 Explicitly elsewhere, not this repo

- **`coinless-kit`** — `game_version` in the board SELECT, a per-player query, and client-module
  support for both, ahead of a future GAME changeset that renders a Version column and a
  worldwide/just-me scope toggle. Full shape in `log/CS034.md`.

---

## §6 What CS036 explicitly does not do

- ⛔ **No Hunter Satellite colour change.** Reversed twice now; motion is the tell (§2).
- ⛔ **No new voice line.** Every `phon` needs a `tools/voice-robot-lab.html` gate no phase here has.
- ⛔ **No new lever.** `LEVERS` stays at **18**.
- ⛔ **No `destroyHunter()` split change** — `ACH_LINEAGE_FULL = 13` depends on it staying 3-way.
- ⛔ **No `towed`-tag or incidental-delivery revival in any form.**
- ⛔ **No change to the dock lockout's radius or to the push's physics** (§3.2, §3.1).
- **No delivery-ticker ship anchor.** Declined four times now; wants its own gate if ever attempted.
- **No shallow-clone suite conversions, FLAG-CS027-c or -d** (§4).
- **No music intensity work.** Still deferred from CS017.
- ⛔ **Code identifiers are never renamed to match the canonical vocabulary.** `game.debris` is the
  Garbage Satellite array; `game.garbage` is the Debris array. Documentation, not a defect.

---

## §7 Registry and version

| | Before | After |
|---|---|---|
| `DEBUG_ENTRIES` | 106 | **106** |
| Section headers | 10 | 10 |
| `LEVERS` | 18 | 18 |
| `POWERUP_DROP_TYPES` | 5 | 5 |
| `GAME_VERSION` | `1.0.0.35` | **`1.0.0.36`** |

⚠ **The count returns to 106 by two opposite moves, and they land in different phases** — it is *not*
unchanged, and a phase that asserts "still 106" mid-changeset will be wrong:

- **`levelEndHold` RETIRED** (CELEBRATION, −1 → **105**) at the completion-hold phase (§1.2, FORK-E).
- **`dockPingCooldown` ADDED** (DELIVERY, +1 → **106**) at the small-fixes phase (§3.1).

⛔ **The count lives in exactly one file: `scratchpad/test-registry.js`'s `COUNTS`.** Both phases update
it; no other file asserts a total. ⛔ **Retiring a row needs no migration shim** — a saved value for a
deleted knob orphans harmlessly under the standing known-value-else-default rule, which is the whole
point of that rule.

⛔ **Every label is under the hard 32-character column.** The two new/changed strings are
`"Dock push ping cooldown"` (23) and `"Garbage Sat bounce restitution"` (30).

---

## §8 Gate questions

Answers are **numbers** wherever a slider is involved.

**The ceremony (§1)**

- H1 — Does the level end now read as a deliberate beat rather than a hitch? `yes` / `no`
- H2 — ⛔ **Can a held fire button skip the "Level N Complete" announcement?** `no` / `yes — describe`
  (§1.4 says it cannot, structurally; this is the most likely way the feature fails in the hand)
- H3 — Is "ENTER / A  continue" the right prompt wording, and is it visible enough? `ok` / `change to ___`
- H4 — Does the freeze lifting partway through the "Level N+1" label read correctly, or does play
  restarting under a still-visible label feel wrong? `ok` / `describe`
- H5 — **CS034 Gate B's B8 re-asked:** the abrupt full-stop when the Achievements panel opens was
  flagged as jarring. With a frozen field and an announcement ahead of it, is it still? `fixed` /
  `still jarring — describe`
- H6 — With the pulse now confined to the grace, is the hand-back to live play readable? `yes` / `no`

**The heartbeat (§2)**

- H7 — `hunterVolatileAge` final: ___ (shipped 60)
- H8 — `hunterPulseMin` / `Max` final: ___ / ___ (shipped 87 / 125)
- H9 — `hunterPulseGrow` / `Shrink` final: ___ / ___ (shipped 55 / 28)
- H10 — Does the pulse now read as a *punch* — unmissable at the edge of vision? `yes` / `no`
- H11 — Is a volatile large now distinguishable from a non-volatile one at a glance, without knowing
  the rule? `yes` / `no` (this is G18's original complaint, re-asked with the colour answer withdrawn)

**The small fixes (§3)**

- H12 — `dockPingCooldown` final: ___ (shipped 0.50)
- H13 — Does the dock push now sound like one event rather than a stutter? `yes` / `no`

⛔ **CS035's G9–G14 are deliberately NOT re-asked.** `levelEndHold` no longer exists, and the pulse
questions are re-framed as H6/H10/H11. Do not resurrect them.
