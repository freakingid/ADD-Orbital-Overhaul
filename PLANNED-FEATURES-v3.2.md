# PLANNED FEATURES — v3.2 (Changeset 3)

**Theme: salvage becomes persistent, physical, and adversarial.**
Garbage stops being ephemeral clutter on a timer and becomes a standing field object with real mass and size that the player must actively manage — collect it, shoot it apart, or watch it assemble itself into a Hunter.

Status of every Changeset-3 item against the *shipped* build (grepped, not recalled):

| CS3 item | Shipped state | Work |
|---|---|---|
| 1.1 attract / stick / 12 → Hunter | **Fully shipped** (GDD §2.5.1) | none |
| 1.2 merge into one scaled object | **Half shipped** — the single-object model exists (`Garbage.pieces`); mass/size do *not* scale (shipped FORK-2 says they must not) | **reverses FORK-2** |
| 1.3 longer post-explosion delay | Shipped at `1.0` s | retune + apply to shatter |
| 1.4 garbage never decays | **Conflicts** with §2.10, §2.10.1, §2.17 | remove decay + close the loop |
| 1.5 shoot a clump to break it | Not shipped | new |

---

## Answer to your performance question (1.2) — up front

**Yes, merging is the right call, and it's already what ships.** `coalesceGarbage` marks the absorbed piece `dead` and increments the survivor's `pieces` counter — there is never more than one body per clump. A joint-tracked 11-body clump would cost 11× the update, 11× the O(n²) pair tests, and would need constraint solving. Nothing to change.

**But do *not* build a class per piece-count** (a `Garbage2`, `Garbage3`, … `Garbage11`). That's 11 near-identical classes for zero performance gain — every one would carry the same fields and the same update. The shipped `pieces` integer already *is* the "appropriate individual object"; Changeset 3 just needs `mass` and `radius` to become functions of it. One class, derived properties.

---

## A. Clump identity — mass, size, silhouette (CS3 1.2)

**⚠️ CONFLICTS WITH SHIPPED §2.5.1 (FORK-2).** GDD §2.5.1 currently states, in bold: *"Mass is not summed — the survivor keeps its base mass… so a clump still hooks and delivers as one normal mass-1.0 canister."* That was the right call *when clumps were hookable*. CS3 1.5 makes clumps **un-hookable** (you must shoot them first), which removes the entire reason FORK-2 existed. **FORK-2 is hereby reversed.** §2.5.1 must be rewritten, not appended to.

- **`pieces`** stays the threat counter (unchanged, 1..11; at 12 it transforms).
- **`mass`** becomes the **sum** of the absorbed pieces' masses. A clump of 4 normal canisters is mass 4.0; a clump of 4 Hunter-scrap canisters is 2.0. Mass now *does* something (below), which is the point.
- **`radius`** becomes **`7 × √pieces`** — area-proportional, so an 11-clump is ~23 px, comparable to a large Hunter core (24). No new constant; the base 7 is the existing canister radius.
- **Attraction becomes mass-weighted.** Replace the flat symmetric pull with a gravity-like one that is momentum-conserving and *reduces exactly to the shipped behaviour when both masses are 1.0*:
  ```
  a.v += (dx/d) * GARBAGE_MAGNET_PULL * b.mass * dt
  b.v -= (dx/d) * GARBAGE_MAGNET_PULL * a.mass * dt
  ```
  Big clumps become slow-moving anchors that loose singles fall into. Legible, free, and it means no re-tune of `GARBAGE_MAGNET_PULL` for the single-piece case.
- **Render: a cluster, not a big canister.** Draw `pieces` mini-canisters at deterministic phyllotaxis offsets (golden-angle spiral: `θ = k·2.39996`, `r = 5·√k`), the whole cluster rotating on the existing `this.spin`. No stored per-clump state, no new UI language, and it reads unmistakably as *"that's a wad of garbage"* rather than *"that's a new enemy."* `pieces === 1` renders exactly as today.

**FORK-A1 — merge velocity: literal vector sum, or momentum-conserving?** ✅ **DECIDED: momentum-conserving.**
Shipped merge is a **literal vector sum** (`survivor.vx += other.vx`) — an explicit §2.5.1 contract with a dedicated headless assertion. With mass previously fixed at 1.0 that was harmless. **With mass now summing, and with garbage now permanent, literal-sum is a runaway:** every merge *adds* speed, so an 8-clump that ate 8 drifting pieces is moving at the vector sum of 8 velocities — clumps end up the fastest things on screen, which is exactly backwards from "a heavy wad of junk."
**Recommendation: switch to momentum-conserving** `v = (mₐvₐ + m_b v_b) / (mₐ + m_b)`. Heavy clumps get sluggish; the physics matches the visual. This **breaks one shipped assertion** in `test-v31-coalesce.js` (the exact-vector-sum check) — that test must be rewritten to assert the momentum sum instead. Flagging because it deliberately overwrites a decision you signed off on last round.

**FORK-A2 — is a clump solid to the ship?** ✅ **DECIDED: non-solid.** The ship passes straight through a clump, taking no damage. The player is *meant* to shoot it apart, not bump it.
An 11-clump is a 23 px body. Today garbage is non-solid (hazards = debris + hunters only).
**Recommendation: keep it non-solid, zero damage.** Garbage isn't the threat; what it *becomes* is. Making clumps solid punishes the player for flying through the field they're supposed to be farming, and it would make a big clump a mobile roadblock the ship can't shoot through fast enough. Cheap to reverse later if it feels toothless.

---

## B. Shatter a clump with one shot (CS3 1.5)

New, and the piece that makes the whole changeset a *game* rather than a hazard.

- **One player bullet** hitting a clump (`pieces > 1`) destroys the clump and emits exactly `pieces` fresh single canisters at its position, each with a random outward kick (`GARBAGE_SHATTER_KICK`, ~40–90 px/s) — same fan-out pattern as the existing `destroyDebris` emission.
- Each shattered piece gets a **full, re-armed `coalesceDelay`**, so a freshly-shattered wad disperses before it can start re-clumping. Same constant as the emission delay (§C) — one knob, not two.
- **Mass on shatter:** each emitted piece gets `clump.mass / clump.pieces`. Per-piece mass identity (1.0 vs 0.5 Hunter scrap) is *lost* on merge and averaged back out on shatter. **FLAG A-3:** this is a deliberate fidelity trade to keep `mass` a single number instead of an array. The visible consequence is that a clump of mixed scrap shatters into uniform mid-mass pieces. Recommend accepting it; it's invisible in play.
- **Pickup gate:** the hook now requires `g.pieces === 1`. **A clump cannot be towed.** This is the load-bearing rule of the whole changeset — you must break it before you can bank it.
- **Magnet powerup ignores clumps** (`pieces > 1`). Pulling something you can't hook is just noise.
- **No score for shattering.** The reward is the 2–11 canisters you just unlocked. Recommend not adding a score hook.
- **Player bullets only.** Hostile (saucer) bullets pass through clumps as they do all garbage. Keeps the collision loop untouched in the hostile branch. Trivial to flip later.

**The loop this creates (say it out loud, because it's the design):** a clump sitting at 9 pieces is a countdown. Shoot it → 9 hookable canisters, a near-full cargo run, big escalating dock combo. Ignore it → 12 pieces → a Hunter core with a full lineage behind it. *Greed and neglect now have the same object as their fulcrum.* That's Pillar 5 with teeth.

---

## C. Longer separation delay (CS3 1.3)

- `GARBAGE_COALESCE_DELAY` **1.0 → ~6.0 s**. At the shipped emission kick (20–55 px/s) a 6 s dispersal carries same-explosion siblings 120–330 px apart — past the merge range and, in most cases, past the attraction range too. That's the "float through space and *happen upon* other garbage" feel you asked for.
- Exact value is a playtest knob; 6.0 is a starting point, not a design claim. It's one constant.

---

## D. Garbage never decays (CS3 1.4) — and the loop it breaks

Mechanically trivial: delete `decay`, `GARBAGE_DECAY`, `GARBAGE_SEVER_DECAY`, the blink-out branch in `Garbage.draw()`, and the `garbageDecayed` increment. A canister now leaves the field by exactly two doors: **recycled**, or **consumed into a Hunter**.

Three things break. Two are bookkeeping; one is a real design problem.

**⚠️ CONFLICTS WITH SHIPPED §2.10.1.** That section says, in a bullet titled *"Decay exists to protect readability — and matters more now"*: *"With ~8× the drop volume, persistent garbage would carpet the field into visual noise… the blink pattern is the player's countdown; **don't remove it**."* Changeset 3 overrules this. §2.10.1 must be rewritten to say that **coalescence + shatter-to-harvest** are now the density levers that decay used to be. Do not leave the old rationale sitting in the GDD contradicting the code.

**⚠️ BREAKS the "Waste Not" achievement.** §2.17: *"Finish a game with zero canisters expired."* With decay gone, `garbageDecayed` is always 0, so it auto-unlocks every single game. (STATUS already flags it as *"near-impossible-yet-cheesable"* — this kills it outright.)
**Recommendation: repurpose in place, keep the id and the pool slot.** New meaning: **"Finish a game with zero Hunters born from neglected scrap."** Same spirit ("don't let your mess pile up"), and now it's actually a live challenge. Needs one new per-game stat (`hunterCoalesced`, incremented at the transform site). Keeping the id and the pool position means the 16-entry weekly pool length is unchanged, so **`poolIndex` rotation math and `test-f9`'s hardcoded slice values do not need recomputing** — that's the cheap path and the reason to repurpose rather than retire.

### ✅ FORK-B — DECIDED: B1, a scrap-born Hunter emits no garbage at any tier.

Run the numbers on the shipped emission rates with decay removed:

> 12 canisters coalesce → **1 large Hunter core**. Kill the full lineage (1 large + 3 medium + 9 small = 13 kills) → `3+3·3` normal-mass + `9·6` low-mass = **12 + 54 = 66 canisters**.

**Twelve pieces in, sixty-six pieces out.** Coalescence isn't a sink — it's a **5.5× amplifier**. With decay gone, the *only* real sink is the player's cargo hold (12–20 per haul). Debris kills add 3 more per tier on top. Garbage supply now grows monotonically and without bound until the player either out-recycles it (they can't, at wave 6+) or dies.

That may be exactly what you want — an arcade pressure cooker that escalates until it kills you. But it should be a choice, not an accident. Options:

- **B1 (recommended): a coalesced Hunter lineage drops no garbage.** Tag the core `bornOfScrap = true`, propagate to its children in `destroyHunter`'s split, and skip the garbage emission for tagged Hunters. The loop closes cleanly: **12 in, 0 out.** Thematically it reads perfectly — *that scrap has already been spent; it's the Hunter now.* It also gives the player a real reason to *let* a clump transform occasionally (a scrap-born lineage is pure score with no cleanup bill), which is a lovely tension against "shoot it and harvest it."
- **B2: trim emission at the source** — `DEBRIS_GARBAGE` 3→2 or 1, `HUNTER_SMALL_GARBAGE` 6→3. Blunt; doesn't close the loop, just slows the blow-up.
- **B3: accept the spiral.** Field silts up, difficulty compounds, you die. Honest arcade design, but the O(n²) coalescence pass and the glow-heavy render will decide how long that's playable.

**DECIDED: B1**, with B2 (trimming emission at the source) held in reserve as a playtest lever. B1 is ~5 lines and it's the only option that actually makes the system closed.

### FLAG D-1 — `GARBAGE_MAGNET_RANGE` almost certainly needs to grow.

140 px is a *very* local force in a 2560×1440 world. It was tuned when garbage lived 12 seconds — pieces only ever needed to find each other in a fresh, tight cloud. With permanent garbage, pieces that drift more than 140 px apart will **never** find each other again, and the field silts up with inert junk that neither clumps nor gets collected. Suggest starting at **~260** and tuning by feel. Flagging rather than specifying — this is a playtest number, and it's one constant.

### FLAG D-2 — perf, and why it's probably fine.

Render is already viewport-culled (`onScreen` in `drawEntity`), so free-canister count doesn't drive draw cost. `coalesceGarbage` is O(n²) with an early `continue`; at 400 free pieces that's ~80k cheap pair tests per frame — measurable but survivable, and coalescence itself compacts `n` downward. **No spatial hash in this changeset.** If a late-wave stress test shows it, that's a follow-up, not scope creep here. (The existing off-by-default `GARBAGE_CLUMP_MAXSPD` clamp stays as-is.)

---

## Out of scope for Changeset 3 (parked, deliberately)

- Spatial partitioning for the coalescence pass (see FLAG D-2).
- Splitting the single HTML file into modules — still parked, still needs an explicit go.
- Off-screen threat awareness (a coalesced Hunter can still be born off-camera; `hunterborn()` remains the only tell).
- The deferred joint F3+F10 debris-density retune.

---

## Housekeeping (per this round's note)

Both docs for this round ship **already version-suffixed** (`PLANNED-FEATURES-v3.2.md`, `IMPLEMENTATION-PHASES-v3.2.md`), so archival at round end is a plain `git mv` into `archive/` with no rename and no collision risk. The pre-existing bare `archive/IMPLEMENTATION-PHASES.md` (the v2.0-era one) is still un-suffixed — rename it to `IMPLEMENTATION-PHASES-v2.md` whenever you're next in `archive/`.

*Doc version string `v3.2` is a guess at the next build number — rename both files if you'd rather it be something else. Changeset 3 ≠ build 3.2 by design.*