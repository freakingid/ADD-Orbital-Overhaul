# IMPLEMENTATION PHASES — CS009 (v3.7): HUD Rebuild

> Spec: `PLANNED-FEATURES-CS009.md`. **GDD §2 is shipped truth** — P7 syncs it.
> One phase per Claude Code session; commit per phase on `main`; Paul pushes.
> **All five forks are resolved. No phase is blocked.**
> Base: `asteroids-deluxe.html` @ `7b20370` (v3.6 P7), 4640 lines. Every line number below is that
> build's — **re-grep before editing; earlier phases in this changeset will have shifted them.**

## Dependency graph

```
P1 (constants + drawRingArc + eased hull)  ← everything depends on this
 ├─ P2 (HULL ring + shield arc)
 ├─ P3 (CARGO ring + cap-up flash)
 └─ P4 (powerup rows)  ─┬─ P5 (bank feedback)
                        └─ P6 (SCOOP floor + no-fills sweep)
                                            └─ P7 (docs + archive + filename migration)
```

**The one hard dependency chain: P1 → P4 → {P5, P6} → P7.** P2 and P3 are independent of each other
and of P4 once P1 lands; ship them in any order. P5's `+Ns` badge attaches to the powerup row P4
builds, and P6's stack floor is defined relative to P4's stack. P7 is always last.

| # | phase | model | effort |
|---|---|---|---|
| P1 | HUD constants, `drawRingArc()`, eased `game.hudHull` | Sonnet | standard |
| P2 | HULL ring + concentric shield arc — **deletes both fill bars** | **Opus** | standard |
| P3 | CARGO ring + cap-up gold flash | Sonnet | standard |
| P4 | Powerup rows — dual-mode, overcharge halo, low warning | **Opus** | **extended thinking** |
| P5 | Bank feedback — new state, scale-pop, `+Ns` badge | Sonnet | standard |
| P6 | SCOOP pips to the stack floor + no-fills sweep | Sonnet | standard |
| P7 | Docs, archive, **filename-convention migration** | Sonnet | standard |

P2 and P4 get Opus: P2 is the aesthetic flagship (three mutually-exclusive states, two nested arcs, a
pulse) and P4 is the trickiest logic in the changeset (two expiry modes, a denominator that differs by
type, and an arc that can legitimately exceed 1.0). P4 gets extended thinking because the magnet
denominator (30, not 15) is a trap the shipped code has a standing comment about.

---

## Phase 1 — HUD constants, `drawRingArc()`, eased hull fraction

**Goal:** land the plumbing every later phase calls, with **zero visible change**. The HUD still draws
its old bars at the end of this phase.

**Sites:** constants block (L100-427) · helpers near `glowStroke` (L1738) / `drawPoly` (L1747) ·
`game` object (L2540-2566) · `startGame()` (L2570-2588) · `update()`.

> **Claude Code prompt — CS009 Phase 1**
>
> Read `STATUS.md`, then `PLANNED-FEATURES-CS009.md` §2, §3, §7. Implement **Phase 1 only**: the HUD
> plumbing. No visual change ships in this phase — the existing HUD bars stay exactly as they are.
>
> 1. **Add a `HUD_*` constants group** to the constants block, with a header comment saying these are
>    look-call knobs tuned in the browser. Every value in spec §2/§3/§5 gets a named constant — no
>    literals in draw code, ever:
>    `HUD_RING_R = 30`, `HUD_RING_W = 4`, `HUD_RING_TRACK_W = 2`, `HUD_RING_BLUR = 12`,
>    `HUD_HULL_CX = 1156`, `HUD_CARGO_CX = 1232`, `HUD_RING_CY = 74`, `HUD_RING_LABEL_Y = 122`,
>    `HUD_SHIELD_R_GAP = 9` (shield arc radius = `HUD_RING_R - HUD_SHIELD_R_GAP`),
>    `HUD_FX_BASE_Y = 640`, `HUD_FX_ROW_H = 40`, `HUD_FX_RING_R = 16`, `HUD_FX_GLYPH_R = 9`,
>    `HUD_FX_LOW = 3`, `HUD_PULSE_HZ = 1.2`, `HUD_EASE = 0.002`, `HUD_BANK_FLASH = 0.6`,
>    `HUD_BANK_POP = 0.25`, `HUD_CAP_FLASH = 0.5`.
>
> 2. **Add `drawRingArc(x, y, r, frac, color, width, blur)`** next to `drawPoly` (~L1747), exactly as
>    spec §7 gives it. Arc from `-Math.PI/2`, clockwise, sweeping `TAU * frac`. **It must not clamp**
>    — callers clamp, because banking can legitimately exceed 1.0 (spec FORK-3). Never `closePath()`.
>    Route the stroke through `glowStroke()`; do not touch `ctx.strokeStyle`/`shadowBlur` by hand.
>
> 3. **Add `game.hudHull`** (init `1`) beside `game.powerFx` in the `game` object, reset to
>    `game.ship.hp / SHIP_MAX_HP` in `startGame()`, and advance it in **`update()`** with the
>    dt-correct exponential smoothing from spec §3:
>    `game.hudHull += (target - game.hudHull) * (1 - Math.pow(HUD_EASE, dt))`.
>    **It must live in `update()`, not `drawHUD()`** — `drawHUD()` is gated by `Capture.hudVisible`
>    (L4384), so easing inside it would freeze while the HUD is toggled off with `H` and then snap on
>    re-show. Add that reason as a comment; it is the whole point of the placement.
>
> 4. **Headless test** `scratchpad/test-cs009-p1.js` (GDD §5.4 rule 7 idiom — stub window/document,
>    eval the real `<script>` block, drive the real functions):
>    (A) `game.hudHull` converges to the true fraction within ~0.5s of simulated `update()` calls;
>    (B) frame-rate independence — 2×`update(1/60)` lands within 1% of 1×`update(1/30)`;
>    (C) `startGame()` resets `hudHull` to 1;
>    (D) `drawRingArc` doesn't throw against the stubbed ctx and passes `frac > 1` through unclamped.
>
> **Risks this phase names:** (a) putting the ease in `drawHUD()` — see item 3; (b) using
> `performance.now()` deltas instead of `dt` — don't, `update(dt)` already has the number;
> (c) `Math.pow(HUD_EASE, dt)` is the shipped `MAGNET_DAMP` idiom (L347) — a *larger* constant damps
> *less*. Comment it so nobody "fixes" it.
>
> Update `STATUS.md`. Commit: `CS009 P1: HUD plumbing — HUD_* constants, drawRingArc(), eased game.hudHull (no visual change)`

---

## Phase 2 — HULL ring + concentric shield arc

**Goal:** the flagship element. Two nested arcs (hull outer, shield inner), a ship glyph, three
mutually-exclusive states. **Deletes the hull fill bar (L4423-4436) and the shield fill bar
(L4438-4447).**

> **Claude Code prompt — CS009 Phase 2**
>
> Read `STATUS.md`, then `PLANNED-FEATURES-CS009.md` §3 and FORK-1. Implement **Phase 2 only**.
> Depends on Phase 1's `drawRingArc()` + `HUD_*` constants + `game.hudHull`.
>
> 1. **Delete** the hull HP bar block and the shield energy bar block from `drawHUD()` (~L4423-4447 in
>    the base build — re-grep, P1 shifted things). That removes their `ctx.strokeRect` /
>    `ctx.fillRect` calls and the `MAX` text tag. **No `fillRect`/`strokeRect` may survive in this
>    function.**
>
> 2. **Draw the HULL ring** at `(HUD_HULL_CX, HUD_RING_CY)`:
>    - Track: full circle at `HUD_RING_R`, `COLOR.dim`, `HUD_RING_TRACK_W`, **no glow**.
>    - Hull arc: `drawRingArc(cx, cy, HUD_RING_R, clamp01(game.hudHull), color, HUD_RING_W)` — read the
>      **eased** `game.hudHull`, not `game.ship.hp` directly.
>    - **Shield arc (FORK-1 A):** a second, concentric arc at `HUD_RING_R - HUD_SHIELD_R_GAP`,
>      fraction `game.ship.energy` (L1813, already 0..1), `COLOR.shield` `#40b0ff`, thinner
>      (`HUD_RING_TRACK_W + 1`). Shield is *not* eased — it drains and recharges continuously, so it
>      is already smooth; adding an ease would only add lag.
>    - **Center glyph:** the ship, nose up. Add a module-level `HUD_SHIP_GLYPH` array = the L1912 hull
>      poly `[[16,0],[-11,-9],[-6,0],[-11,9]]` scaled to 55%, and `drawPoly(HUD_SHIP_GLYPH, cx, cy,
>      -Math.PI/2, color)`. **Do not `ctx.scale()`** — `drawPoly` doesn't take a scale, and scaling the
>      context would scale the glow blur too.
>    - Label: `drawText("HULL", HUD_HULL_CX, HUD_RING_LABEL_Y, 13, COLOR.dim, "center")`.
>
> 3. **Three states — mutually exclusive, in this precedence order.** Both the hull arc and the ship
>    glyph take the state color; the shield arc never does (it stays `COLOR.shield` always — it's a
>    different resource and must not be swept up in a hull warning):
>    | state | test | color | pulse |
>    |---|---|---|---|
>    | MAX | `game.ship.hp >= SHIP_MAX_HP` | `COLOR.ach` | no |
>    | Critical | `game.ship.hp <= LOW_HP_THRESHOLD` | `COLOR.lowhp` | yes |
>    | Normal | else | `COLOR.hp` | no |
>    Test the **true** `game.ship.hp`, never the eased `hudHull` — the state must flip the instant the
>    hit lands, even though the arc takes ~0.35s to catch up.
>    The gold MAX ring **replaces** the deleted `MAX` text tag and carries the same meaning (v3.6
>    FLAG-E: *a Health pickup right now would be wasted*). Do not re-add the text.
>
> 4. **Pulse:** `ctx.globalAlpha = 0.6 + 0.4 * Math.sin(performance.now()/1000 * TAU * HUD_PULSE_HZ)`
>    around the arc + glyph; **always restore `globalAlpha = 1`** (the shipped code is disciplined
>    about this — see L1922-1925). Constant rate. Do **not** ramp it with HP urgency: `lowhpSet(t)`
>    (L616-625) already ramps the *audio* siren with urgency, and two independent ramps at nearby
>    rates read as a wobble (spec FLAG-D).
>
> 5. **`LOW_HP_THRESHOLD` (L164, = 100 of `SHIP_MAX_HP` 250 = 40%) is the threshold.** Do not
>    introduce a new HUD-only threshold and do not use the design brief's 25% — the ring must warn at
>    exactly the moment the siren and the low-health chevron do, or the HUD is lying about the audio.
>
> **Risks:** (a) a leaked `globalAlpha` tints the rest of the frame; (b) testing `hudHull` instead of
> `hp` for the state makes the color lag the hit; (c) `drawRingArc` must not be handed an unclamped
> hull fraction — clamp at the call site.
>
> Update `STATUS.md`. Commit: `CS009 P2: HULL ring + concentric shield arc — replaces both fill bars (FORK-1 A)`

---

## Phase 3 — CARGO ring + cap-up gold flash

**Goal:** replace the `CARGO n/m` text line (L4449-4451) with a ring whose denominator is the
**runtime-growing** `game.cargoMax`, and make the cap-up legible instead of silent.

> **Claude Code prompt — CS009 Phase 3**
>
> Read `STATUS.md`, then `PLANNED-FEATURES-CS009.md` §4 and FORK-2. Implement **Phase 3 only**.
> Depends on Phase 1.
>
> 1. **Delete** the `CARGO n/m` `drawText` line from `drawHUD()` (~L4449, re-grep).
>
> 2. **Draw the CARGO ring** at `(HUD_CARGO_CX, HUD_RING_CY)`, same geometry and track as HULL:
>    - Fill: `game.chain.length / game.cargoMax` (L2556). **`game.cargoMax` is NOT a constant** — it
>      starts at `CARGO_BASE` 12 and grows to `CARGO_CAP_MAX` 24, +1 per `CARGO_GROW_PER` 30 canisters
>      delivered (L3712-3713). Read it live every frame; never cache it, never substitute a literal.
>    - Center: `String(game.chain.length)` at size 20, `COLOR.text` when the chain is non-empty and
>      `COLOR.dim` when empty (preserves the shipped `game.chain.length ? COLOR.text : COLOR.dim` tell
>      at L4450), with `"/" + game.cargoMax` beneath it at size 11 in `COLOR.dim`.
>    - Label: `drawText("CARGO", HUD_CARGO_CX, HUD_RING_LABEL_Y, 13, COLOR.dim, "center")`.
>
> 3. **Full-chain state:** when `game.chain.length >= game.cargoMax`, the ring goes `COLOR.ach` gold
>    and pulses at `HUD_PULSE_HZ` — the same pulse helper Phase 2 wrote. This deliberately makes gold
>    mean **exactly one thing across the whole HUD: "at cap, more is wasted"** — identical semantics
>    to the full-hull gold ring. Do not pick a different hue here.
>
> 4. **Cap-up flash.** Add `game.cargoFlash = 0` to the `game` object and reset it in `startGame()`.
>    At the cap-grow site (~L3712-3713, `if (growCap > game.cargoMax) { game.cargoMax = growCap; }`),
>    set `game.cargoFlash = HUD_CAP_FLASH` and push a `FloatText("+1 CAP", ...)` at the **dock**, using
>    `COLOR.ach` — the reward should read where it was earned. Decay `cargoFlash` by `dt` in
>    `update()`. While it's > 0, force the ring to `COLOR.ach` and thicken it to `HUD_RING_W + 2`.
>    Rationale (put it in the comment): a cap-up makes the ring *shrink* — the same chain is now a
>    smaller fraction of a bigger cap. Without the flash that reads as a bug instead of a promotion.
>
> 5. **Headless test** `scratchpad/test-cs009-p3.js`: drive real deliveries until `game.cargoMax`
>    increments and assert (A) `cargoFlash` is armed at exactly that frame, (B) it decays to 0 within
>    `HUD_CAP_FLASH`, (C) `startGame()` clears it, (D) `cargoMax` still stops at `CARGO_CAP_MAX`.
>
> **Risks:** (a) hardcoding 12, 15, or 24 as the denominator — the whole point is that it grows;
> (b) arming the flash inside `drawHUD()` (it'd never fire while the HUD is hidden); (c) the FloatText
> constructor signature — grep an existing call (L2860) rather than guessing it.
>
> Update `STATUS.md`. Commit: `CS009 P3: CARGO ring — runtime cargoMax denominator, gold-at-cap, +1 CAP flash (FORK-2 A)`

---

## Phase 4 — Powerup rows (Opus, extended thinking)

**Goal:** replace the powerup bar loop (L4453-4475) with ring rows. This is the phase with the traps.

> **Claude Code prompt — CS009 Phase 4**
>
> Read `STATUS.md`, then `PLANNED-FEATURES-CS009.md` §5, FORK-3, FORK-5. Implement **Phase 4 only**.
> Depends on Phase 1. **Think carefully before editing — this phase has three known traps, all named
> below.**
>
> 1. **Replace** the active-powerup bar loop in `drawHUD()` (~L4453-4475). Keep iterating
>    `POWERUP_DROP_TYPES` (L326) gated by `powerActive(t)` (L2777) — that stable order and that single
>    predicate are load-bearing; do not inline either.
>
> 2. **Stack upward from a fixed baseline.** Row *i* (0 = bottom) at
>    `y = HUD_FX_BASE_Y - i * HUD_FX_ROW_H`. The shipped HUD stacks *downward* from a moving `row`
>    cursor, so a powerup expiring makes every row below it jump. Anchoring the bottom fixes that.
>    **Reserve row index 0 for the SCOOP pips** — Phase 6 puts them there; for now, start the powerup
>    rows at *i* = 1 and leave a comment saying why.
>
> 3. **Each row:** ring at `(40, y)` radius `HUD_FX_RING_R`, `COLOR.dim` track always drawn; value arc
>    in `POWERUP_COLOR[t]` (L1788); `drawPowerupGlyph(t, 40, y, HUD_FX_GLYPH_R, color)` dead center
>    (**L2370 — this already exists, with all six glyphs, and the shipped HUD already calls it at
>    L4469. Do not author new icons; the design brief's chevron/diamond are superseded**);
>    `POWERUP_LABEL[t]` (L1797) at x=64 size 13; the number beneath it at size 16.
>
> 4. **TRAP 1 — the denominator differs by type.** Time-mode fill is
>    `game.powerFx[t] / powerDuration(t)`. **`powerDuration()` (L2770) returns 30 for magnet and 15 for
>    everything else.** L2768 carries a standing comment about exactly this: miss it and the magnet
>    ring renders permanently over-full. Call the function. Never `POWERUP_DURATION` directly.
>
> 5. **TRAP 2 — banking means the fraction can exceed 1.0.** `applyPowerup` does
>    `game.powerFx[type] += powerDuration(type)` (L2850), so a double-banked Rapid is 30s against a
>    15s denominator → `frac = 2.0`. **FORK-3 A — the overcharge halo:** draw the main arc at
>    `clamp01(frac)`, and if `frac > 1`, draw a *second*, thinner arc at radius `HUD_FX_RING_R + 4`
>    showing `clamp01(frac - 1)`. A double-banked powerup reads as a ring with a halo. Don't just clamp
>    and drop the surplus — a ring pinned at full for 15 straight seconds looks broken.
>
> 6. **TRAP 3 — count mode has no denominator, so it has no arc.** `powerMode(t)` (L2761) returns
>    `"time"`, `"shots"`, or `"pieces"` **from player settings** (`settings.shotPowerupMode`,
>    `settings.magnetMode`) — two Difficulty options that ship today. In count mode the budget banks
>    too (L2853) and has no ceiling. **FORK-5:** draw the `COLOR.dim` track only (so the row's shape is
>    identical across modes), the glyph inside it, and `String(game.powerBudget[t])` where the seconds
>    would go. The shipped code already branches here (`const counted = powerMode(t) !== "time"`,
>    L4467) — keep the branch.
>
> 7. **Seconds text:** `Math.ceil(game.powerFx[t]) + "s"`. Ceil, not round — a ring reading "1s" must
>    not have already expired.
>
> 8. **Low-timer warning:** `game.powerFx[t] <= HUD_FX_LOW` (3s) → ring, label, and seconds all shift
>    to `COLOR.lowhp` and pulse at `HUD_PULSE_HZ`, reusing Phase 2's pulse. **Time mode only** — a
>    budget of 2 shots is not a deadline (spec FLAG-E).
>
> 9. **Headless test** `scratchpad/test-cs009-p4.js`. Spy on the stubbed ctx: record every `ctx.arc()`
>    call's start/end angle during `drawHUD()`. Assert:
>    (A) with `game.powerFx.magnet = 30`, the magnet value arc sweeps a **full** turn, not two (the
>    Trap-1 regression test);
>    (B) with `powerFx.rapid = 30` (double-banked, 15s denominator), a main arc at full **and** a
>    second arc at the halo radius are both drawn;
>    (C) with `settings.magnetMode = "pieces"` and `powerBudget.magnet = 40`, **no value arc** is drawn
>    for that row — track only;
>    (D) `drawHUD()` makes **zero** `ctx.fillRect` and **zero** `ctx.strokeRect` calls.
>
> Update `STATUS.md`. Commit: `CS009 P4: powerup rings — dual-mode rows, overcharge halo, low-timer warning (FORK-3 A, FORK-5)`

---

## Phase 5 — Bank feedback (scale-pop + `+Ns` badge)

**Goal:** banking has shipped since v3.6 P4 but is **invisible** — `powerFx` just goes up. Give it a
tell. This is the only phase that adds gameplay-adjacent state.

> **Claude Code prompt — CS009 Phase 5**
>
> Read `STATUS.md`, then `PLANNED-FEATURES-CS009.md` §5.1. Implement **Phase 5 only**. Depends on
> Phase 4's powerup rows.
>
> 1. **New state** in the `game` object, beside `powerFx` (L2551):
>    `powerBank: { rapid: 0, triple: 0, magnet: 0, engine: 0 }` (seconds of bank-flash left) and
>    `powerBankAmt: { rapid: 0, triple: 0, magnet: 0, engine: 0 }` (the N for the badge).
>    Reset both in `startGame()` (L2585-2586) alongside `powerFx`/`powerBudget`.
>
> 2. **Arm it in `applyPowerup()`** (~L2849-2854). **Check `powerActive(type)` BEFORE the `+=`** — that
>    is what distinguishes a *bank* (effect was already running) from a *fresh pickup* (it wasn't). A
>    fresh pickup gets **no** badge; only a bank does. On a bank, set
>    `game.powerBank[type] = HUD_BANK_FLASH` and `game.powerBankAmt[type] = powerDuration(type)` in
>    time mode, or `POWERUP_BUDGET[type]` in count mode.
>    **The badge must read `+30s` for a magnet and `+15s` for the rest** — it comes from
>    `powerDuration(type)` (L2770), never a literal 15 (spec FLAG-F).
>
> 3. **Decay in `update()`:** `game.powerBank[t] = Math.max(0, game.powerBank[t] - dt)` for each type.
>    Not in `drawHUD()` — same `Capture.hudVisible` reason as Phase 1.
>
> 4. **Render in the powerup row** (Phase 4's loop). While `powerBank[t] > 0`, with
>    `k = powerBank[t] / HUD_BANK_FLASH` (1 → 0):
>    - scale the ring radius by `1 + HUD_BANK_POP * k` — a 25% pop that settles;
>    - draw `"+" + game.powerBankAmt[t] + "s"` (or a bare count in count mode) in `COLOR.ach` to the
>      right of the number, at `ctx.globalAlpha = k`. **Restore `globalAlpha = 1`.**
>
> 5. **Headless test** `scratchpad/test-cs009-p5.js`, driving the **real** `applyPowerup()`:
>    (A) a first pickup arms **no** badge (`powerBank.rapid === 0`);
>    (B) a second pickup while active arms `powerBank.rapid === HUD_BANK_FLASH` and
>    `powerBankAmt.rapid === 15`;
>    (C) the same for magnet gives `powerBankAmt.magnet === 30`, **not 15** (the FLAG-F regression);
>    (D) `powerBank` decays to 0 under `update()` within `HUD_BANK_FLASH`;
>    (E) `startGame()` clears both maps.
>
> **Risks:** (a) arming the badge on a fresh pickup — check `powerActive()` first; (b) hardcoding 15;
> (c) a leaked `globalAlpha`.
>
> Update `STATUS.md`. Commit: `CS009 P5: bank feedback — powerBank state, ring scale-pop, +Ns badge`

---

## Phase 6 — SCOOP pips to the stack floor + no-fills sweep

**Goal:** finish the layout and prove the rebuild's actual thesis — that the HUD now draws like the
rest of the renderer.

> **Claude Code prompt — CS009 Phase 6**
>
> Read `STATUS.md`, then `PLANNED-FEATURES-CS009.md` §6, §7. Implement **Phase 6 only**. Depends on
> Phase 4.
>
> 1. **Move the SCOOP pip row (L4477-4489) to the bottom of the stack** — row index 0, i.e.
>    `y = HUD_FX_BASE_Y`, with the powerup rows floating above it. Rationale for the comment: the
>    persistent upgrade is the stable floor; the timed effects come and go above it. **Keep it outside
>    the `POWERUP_DROP_TYPES` loop** — `game.scoopLevel` is a persistent upgrade, it is not in
>    `powerFx`/`powerBudget`, and it never expires on a clock. The shipped comment at L4476 says so;
>    keep it. Pips stay pips (filled/hollow is already the second channel); hidden at level 0.
>
> 2. **Verify the two center chevrons still draw** (L4490-4512): the dock pointer at r=42 and the
>    low-health pointer at r=58, both orbiting screen center. They are the sanctioned exception to
>    "keep the center clear" and both are shipped navigation. **They must survive the rebuild
>    untouched.**
>
> 3. **The no-fills sweep.** Grep `drawHUD()` for `fillRect`, `strokeRect`, `ctx.fill(`. After this
>    changeset the **only** permitted fills in the HUD are (a) `drawText` (which is `fillText` — the
>    accepted text exception) and (b) the 4px SCOOP pip dots (v3.6 already accepted these; spec
>    FLAG-G). Everything else must be a `glowStroke`. If any `fillRect`/`strokeRect` survives, a
>    previous phase missed a deletion — fix it here.
>
> 4. **Headless regression test** `scratchpad/test-cs009-hud.js`. Spy the stubbed ctx and call the real
>    `drawHUD()` across states — fresh run, mid-run with a full chain, hull at 1 HP, hull at max, two
>    powerups active, one banked, `scoopLevel = 3`, `game.state === "dying"`, `game.state ===
>    "gameover"`. Assert for **every** case: (A) it doesn't throw; (B) **zero** `ctx.fillRect` and
>    **zero** `ctx.strokeRect` calls; (C) `ctx.globalAlpha` is exactly 1 on return (no leak);
>    (D) `Capture.hudVisible = false` skips it entirely.
>
> **Risk:** `drawHUD()` runs in `playing`, `dying`, **and** `gameover` (title early-returns at L4323).
> During `"dying"` the ship is dead and `hp` may be 0 — the hull ring should drain to empty and sit
> red, under the death flash (L4365-4379), which is correct and desired. Don't guard it out.
>
> Update `STATUS.md`. Commit: `CS009 P6: SCOOP pips to the stack floor; no-fills sweep + full HUD regression test`

---

## Phase 7 — Docs, archive, and the filename-convention migration

> **Claude Code prompt — CS009 Phase 7**
>
> Read `STATUS.md`. Implement **Phase 7 only** — documentation. No gameplay code changes.
>
> 1. **GDD §2** — rewrite the HUD subsection to describe the **shipped** HUD only: two top-right rings
>    (hull with a concentric shield arc and a ship glyph; cargo with a live count over a runtime cap),
>    the bottom-left effect stack (SCOOP pips on the floor, timed-powerup rings above), and the two
>    center chevrons. **Supersede the old bar description in place, preserving the history note** —
>    do not leave a contradiction and do not delete the record that bars ever existed. Record the
>    gold-at-cap idiom explicitly: `COLOR.ach` now means *"this resource is at its cap; more is
>    wasted"* in exactly two places (full hull, full chain).
>
> 2. **CLAUDE.md** — update the code map to add `drawRingArc()` beside `drawPoly`/`glowStroke`, and add
>    a non-negotiable: **the HUD draws with `glowStroke` like everything else — no `fillRect`,
>    no `strokeRect`; the only fills are `drawText` and the SCOOP pips.**
>
> 3. **CLAUDE.md "Documentation layers"** (L45-58) — **the filename convention has changed.** Planning
>    docs are now named by **changeset number**, not version number:
>    `PLANNED-FEATURES-CS009.md` / `IMPLEMENTATION-PHASES-CS009.md`, zero-padded to three digits.
>    Update the section to say so, and to reference the CS-numbered files rather than the stale
>    `PLANNED-FEATURES-v2.md` / `IMPLEMENTATION-PHASES.md` names it currently names.
>
> 4. **Archive.** `git mv PLANNED-FEATURES-CS009.md IMPLEMENTATION-PHASES-CS009.md archive/`.
>    **Also:** the root `IMPLEMENTATION-PHASES.md` is a stray — its header says **v3.1**, and
>    `archive/` has every phases doc from v3.2 through v3.6 but **no v3.1**. It is the missing one.
>    `git mv IMPLEMENTATION-PHASES.md archive/IMPLEMENTATION-PHASES-v3.1.md` — that cleans the repo
>    root and closes the archive gap in one move. (Old `-vX.X` files stay as they are; the CS scheme
>    applies going forward, not retroactively.)
>
> Update `STATUS.md` with the CS009 close-out. Commit: `CS009 P7: docs — GDD §2 HUD rewrite, CLAUDE.md no-fills rule + CS-numbered doc convention, archive`

---

## Playtest asks this changeset hands back

1. Is the top-right corner loud enough now that it holds rings? v3.6 P4 abandoned it once for being
   easy to miss (FORK-4).
2. At cap 24, does a nearly-full CARGO ring read as "nearly full" — or does a growing denominator make
   the ring feel like it's lying? (FORK-2.)
3. Does the overcharge halo read as *good* (I'm rich) or as *broken*? (FORK-3.)
4. Critical hull and an expiring powerup pulsing in the same frame at the same 1.2 Hz: one urgent
   system, or visual noise? (FLAG-D.)
5. Is `HUD_EASE = 0.002` too slow to register a hit? A hit already has shake and a sound; the ring is
   the third channel and can afford to be smooth.
6. Does the shield arc read as *shield* nested inside *hull*, or as one confusing double ring?
   (FORK-1's real risk.)