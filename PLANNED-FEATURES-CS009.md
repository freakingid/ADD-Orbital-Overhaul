# PLANNED FEATURES — CS009 (v3.7): HUD Rebuild

Target build: **v3.7**, from shipped **v3.6** (`asteroids-deluxe.html` @ `7b20370`, 4640 lines).
Every claim below was confirmed by grepping that build — line numbers are that build's, not the brief's.

Source: `HUD-design-brief.md` + three mockup screenshots. **The mockup is a static comp, not the game.**
Section 1 lists every place it disagrees with shipped code; those corrections are already folded into
the spec below.

**All five forks are RESOLVED (Paul, this cycle) — no phase is blocked.** Everything else is a
best-guess with a FLAG.

| fork | question | **resolved** |
|---|---|---|
| FORK-1 | **The brief deletes the SHIELD bar and never replaces it.** Where does shield energy live? | **Option A** — concentric inner arc inside the HULL ring; one element, two arcs |
| FORK-2 | Cargo capacity **grows at runtime** (12→24). Ring center shows what? | **Option A** — `n` big + `/max` small; gold flash + `+1 CAP` on a cap-up |
| FORK-3 | Powerup duration **banks** (v3.6 P4), so remaining can exceed the denominator. Draw >100% how? | **Option A** — clamp the main arc; a thinner "overcharge" halo arc outside it |
| FORK-4 | The brief moves HULL+CARGO **into** the top-right corner that v3.6 P4 deliberately emptied | **Accept** — a glowing ring is not a dim bar |
| FORK-5 | Count-mode powerups have **no denominator** → no ring is possible | **Keep the shipped dual branch** — ring in time mode, glyph + number in count mode |

---

## 0. FORKS — all RESOLVED

### FORK-1 — Shield has no home in the brief — ✅ RESOLVED: **Option A (concentric arc)**

The brief's §6 removes "**HULL & SHIELD** fill bars … replaced by the HULL ring" — but §4 only designs
a HULL ring. The mockup has no shield element anywhere. Shield is not vestigial:

| constant | L | value | meaning |
|---|---|---|---|
| `SHIELD_DRAIN` | 118 | 0.55 /s | drains while held |
| `SHIELD_RECHARGE` | 119 | 0.12 /s | ~8s from empty to full |
| `SHIELD_HIT_COST` | 120 | 0.22 | per deflection — ~4 blocks on a full bar |

`game.ship.energy` (L1813, 0..1) is an **actively managed combat resource** with a 4.6:1
drain-to-recharge ratio. Deleting its readout means the player holds shield blind. Options:

- ✅ **A — Concentric arc. TAKEN.** One "ship status" ring in the HULL slot: outer arc = hull,
  inner arc (r−9) = shield, `COLOR.shield` `#40b0ff`. Same center glyph. Costs no new corner, and the
  two arcs are physically nested the way the fiction nests them (shield wraps hull).
- **B — Third ring.** Symmetric, but three rings across the top-right is busy and the brief's own
  §3 says *group related elements* — hull and shield are one group, cargo is another.
- **C — Arc under the ship glyph.** A short 120° arc across the bottom of the HULL ring's interior.
  Cheapest, but reads as decoration and is hard to parse at a glance.
- **D — Drop it.** Only if Paul is planning to retire the shield mechanic. Say so and it's one commit.

### FORK-2 — Cargo capacity grows during a run — ✅ RESOLVED: **Option A**

The brief proposes "capacity *(proposed: 15)*". There is no such constant. `game.cargoMax` (L2556)
**starts at `CARGO_BASE` 12 (L250) and grows to `CARGO_CAP_MAX` 24 (L251), +1 per `CARGO_GROW_PER` 30
canisters delivered** (L3712-3713). Two consequences the brief didn't anticipate:

1. **A bare center integer hides the denominator.** Today's HUD reads `CARGO 7/18` (L4449). A ring
   showing just `7` loses the earned cap — which is Pillar-5 progress the player worked for.
2. **The ring silently rescales on a cap-up.** At cap 12 a 6-piece chain is a half-ring; one delivery
   later at cap 13 the same 6 pieces are less than half. The ring *shrinks* on a reward.

Options:
- ✅ **A — TAKEN.** Center = count, large; a small `/24` beneath it in `COLOR.dim`. On a cap-up,
  the ring flashes `COLOR.ach` gold for ~0.5s with a `+1 CAP` `FloatText` at the dock, so the rescale
  reads as a promotion instead of a bug.
- **B —** Center = count only. Cap moves to the label line (`CARGO · 24`). Cleaner ring, quieter cap.
- **C —** Pips instead of an arc, one per unit of cap. Honest about the count, but at cap 24 it's 24
  pips in a 60px ring — unreadable, and it fights the brief's own "rings" language. Not recommended.

### FORK-3 — Banking overshoots the ring — ✅ RESOLVED: **Option A (overcharge arc)**

v3.6 P4 made duration **bank**: `game.powerFx[type] += powerDuration(type)` (L2850). Magnet's
duration is 30s (L319); the other three are 15s (L318). Two Rapid pickups = 30s remaining against a
15s denominator → `frac = 2.0`. Today's bar just `clamp01`s it (L4471) and the surplus is invisible —
the shipped comment calls that "accepted behaviour," but the brief's ring makes it visible again,
because a ring that sits pinned at 100% for 15 straight seconds looks broken.

- ✅ **A — Overcharge arc. TAKEN.** Main arc = `clamp01(frac)`. If `frac > 1`, draw a *second*,
  thinner arc at radius +4 showing `frac - 1` (itself clamped). A double-banked Rapid reads as a ring
  with a halo. Generalizes: a triple-bank just pins the halo too, which is honest and rare.
- **B — Rescale the denominator.** Store `powerFxMax[type]` = the highest value `powerFx` has reached
  this activation; the ring always fills against that. Never over-full, but the ring's *rate* changes
  on every bank, so "how fast am I losing this" stops being a fixed read. New per-type state.
- **C — Clamp and rely on the number.** Ring pins at full; the `24s` text carries the truth. Zero new
  code. Cheapest, and defensible — but it wastes the ring exactly when the player is richest.

### FORK-4 — The brief refills the corner v3.6 P4 just emptied — ✅ RESOLVED: **accept**

v3.6 P4 moved SHIELD out of the top-right into the left column, and v3.3 P1 moved LEVEL out of it,
both for the same stated reason: the top-right corner was *"dim, easy-to-miss."* The top-right is
currently **empty**. The brief now puts the two most important readouts back into it.

Not necessarily wrong — the old occupants were a thin dim bar and 22px dim text, and a glowing 30px
ring is a categorically louder object. But it *is* a reversal of a two-changeset-old decision made for
a legibility reason, so it should be a decision rather than a drift. ✅ **TAKEN: accept.** The
ring is loud, and hull/cargo genuinely are the two things worth the player's peripheral vision.
The alternative — rings in the left column, keeping v3.6 P4's read — is a one-constant change to the
layout block if the corner turns out to be as easy to miss as the bar was.

### FORK-5 — Count-mode powerups can't have a ring — ✅ RESOLVED: **keep the dual branch**

`powerMode(type)` (L2761) returns `"time"`, `"shots"`, or `"pieces"` from **player settings**
(`settings.shotPowerupMode`, `settings.magnetMode`). In count mode, Rapid/Triple/Magnet expire on a
*budget* (`RAPID_SHOTS` 40, `TRIPLE_SHOTS` 30, `MAGNET_PIECES` 40 — L368-371) that **also banks**
(L2853) and therefore has no ceiling to draw an arc against. The shipped HUD already branches on
this (L4467: `const counted = powerMode(t) !== "time"`).

✅ **TAKEN: keep the branch.** Time mode → ring + seconds. Count mode → the type glyph inside a
*static, unfilled* ring track (so the row's shape stays constant across modes) + the raw number.
The brief was written as if every powerup is timed; a spec that assumed that would break the two
Difficulty settings that ship today.

---

## 1. CONFLICTS — what the mockup says vs. what the build does

Every row here is already corrected in §2-§6. Listing them so nobody re-imports the mockup's numbers.

| brief says | build says (grepped) | resolution |
|---|---|---|
| Powerups are **SPEED** and **WEAPON** | `POWERUP_DROP_TYPES` = `rapid`, `triple`, `magnet`, `engine` (L326) — **four**, plus persistent `scoop` | Spec all four |
| Icons: chevron + diamond, to be drawn | **`drawPowerupGlyph(type,x,y,r,color)` already exists** (L2370) — six glyphs, designed at r=12, used by both the field pickup and the HUD | Reuse it. Do not author new icons. |
| Capacity *(proposed 15)* | `game.cargoMax`, 12→24, runtime (L250-252) | FORK-2 |
| Hull warning *(proposed ≤25%)* | `LOW_HP_THRESHOLD = 100` / `SHIP_MAX_HP = 250` (L156, L164) = **40%**, and it already drives the audio siren (L616-625) and the low-health chevron (L4503) | **Hard-bind to the constant.** A HUD that warns at a different % than the siren is a bug. |
| `WAVE NN` | Shipped player-facing label is **`LEVEL N`** (L4419) — v3.3 P1 deliberately renamed it; "wave" stays the code term | Keep `LEVEL` |
| Palette: `#5ad9ff` / `#7dff9b` / `#ffcc3d` / `#ff5db1` / `#ff6a3d` | `COLOR.text #a8d4ff`, `COLOR.hp #5fe08a`, `POWERUP_COLOR.rapid #ffd24a`, `.triple #ff8adf`, `.magnet #8ab6ff`, `.engine #7dffb0`, `COLOR.lowhp #ff4040`, `COLOR.ach #ffcf5a`, `COLOR.dim #3a5a80` (L1759-1795) | **Use the live palette. Add no new hexes.** The brief's are eyedropper approximations of these. |
| Type: Rajdhani 500-700 | `drawText` = `` `${size}px monospace` `` (L3959) | Keep monospace. No external font in a zero-dependency single file — an embedded base64 woff is a separate, larger call. **FLAG-A.** |
| Background `#05060a` | canvas CSS `background: #000208` (L19) | Cosmetic, ignore |
| Remove the "delivery-to-bonus meter" | **No such element exists** in `drawHUD()` | No-op |
| Score `084 980` (space-grouped) | `String(game.score).padStart(6, "0")` (L4414) | Zero-pad is shipped. Grouping is a 1-line change if wanted — **FLAG-B**, not spec'd. |
| — (unmentioned) | **SCOOP pips** (L4477-4489), `SCOOP_MAX_LEVEL` 5, persistent upgrade | **Survives.** See §6. |
| — (unmentioned) | **Two center-orbit chevrons**: dock pointer at r=42, low-health pointer at r=58 (L4490-4512) | **Survive.** They're the "keep the center clear" rule's one sanctioned exception, and both are shipped navigation. See §6. |
| — (unmentioned) | **Full-hull gold `MAX` tag** (L4433, v3.6 FLAG-E) — tells the player a Health pickup would be wasted | **Survives**, re-expressed as a gold ring. See §3. |
| Mockup pixel sizes | HUD space is **`VIEW_W` 1280 × `VIEW_H` 720** (L103); the mockup canvas is ~600px wide | All sizes below are re-derived in 1280×720, ~2.1× the mockup |

---

## 2. Layout — "Corner Standard", in real coordinates

```
(30,46)  084980                                  HULL(1156,74)  CARGO(1232,74)
(30,62)  LEVEL 7                                     ◎              ◎
                                                   HULL           CARGO

                          [ play field — clear except the two chevrons ]

(40,560) ◔ RAPID  12s
(40,600) ◔ MAGNET 24s
(40,640) SCOOP ●●●○○
```

- **Score / Level — unchanged.** `drawText` at (30,46) size 30 and (30,62) size 22, `COLOR.text`. The
  brief keeps them, the build already does them, nothing to do.
- **Rings — top-right.** HULL center `(1156, 74)`, CARGO center `(1232, 74)`. Outer radius `HUD_RING_R
  = 30`, 76px between centers (16px of air between edges), 18px right margin.
- **Labels** — `drawText("HULL", 1156, 122, 13, COLOR.dim, "center")`, same for `CARGO` at 1232.
- **Powerup rows — bottom-left**, stacked **upward** from a fixed baseline so a row appearing or
  expiring never makes the others jump. Baseline `HUD_FX_BASE_Y = 640`, `HUD_FX_ROW_H = 40`. Row *i*
  (0 = bottom) sits at `y = HUD_FX_BASE_Y - i * HUD_FX_ROW_H`. **FLAG-C:** the shipped HUD stacks
  *downward* from a cursor and lets rows shuffle; anchoring the bottom is the fix, and it's why the
  SCOOP pips must move to the *bottom* of the stack (§6) rather than after it.
- Max simultaneous rows: **4** (`POWERUP_DROP_TYPES.length`) + 1 SCOOP row = 5 → top of the stack at
  y=480, well clear of the play field. No overflow case exists; no truncation rule needed.
- Draw order inside `drawHUD()`: score → level → HULL ring → CARGO ring → powerup rows → SCOOP pips →
  chevrons. (Chevrons last so they're never occluded.)

**All sizes above are `HUD_*` named constants at the top of the constants block (L100-427), not
literals in the draw code.** They are look-call knobs; expect one tuning pass in the browser.

---

## 3. HULL ring (top-right)

**Geometry.** Arc from `-π/2` (12 o'clock), clockwise, sweeping `TAU * frac`.
Track: full circle at `HUD_RING_R` 30, `COLOR.dim`, lineWidth `HUD_RING_TRACK_W` 2, **no glow**.
Value: same radius, lineWidth `HUD_RING_W` 4, `glowStroke(color, HUD_RING_W, 12)`.

**Fill.** `frac = clamp01(game.ship.hp / SHIP_MAX_HP)` — `game.ship.hp` L1817, `SHIP_MAX_HP` 250 L156.

**Animation.** Health arrives in lumps (a hit is 10-40, a Health pickup is `POWERUP_HEALTH_AMOUNT` 25,
a repair milestone is larger). A snap looks like a glitch. Store a display value on `game`:

```js
// eased HUD hull fraction — chases the true value so a hit/heal reads as a drain/fill, not a jump
game.hudHull = 1;                                        // in the game object + startGame()
game.hudHull += (frac - game.hudHull) * (1 - Math.pow(HUD_EASE, dt));  // in update(), dt-correct
const HUD_EASE = 0.002;  // per-sec retention → ~0.35s to close 95% of the gap. PLAYTEST KNOB.
```

Exponential smoothing, not a tween — no easing library, no `Date.now()` bookkeeping, and it is
frame-rate independent via `Math.pow(x, dt)` (the same idiom as `MAGNET_DAMP`, L347). **It must live in
`update()`, not `drawHUD()`** — `drawHUD()` is gated by `Capture.hudVisible` (L4384), so easing there
would freeze while the HUD is toggled off and then snap on re-show.

**Center glyph.** The ship, nose up: `drawPoly([[16,0],[-11,-9],[-6,0],[-11,9]], 1156, 74, -Math.PI/2,
color)` scaled to ~0.55 (i.e. author a `HUD_SHIP_GLYPH` array at 55% of the L1912 hull poly — do not
scale the context, `drawPoly` doesn't take a scale). Same shape as the ship the player is flying, so
the ring is unmistakably *theirs*.

**Three states, and they are mutually exclusive:**

| state | test | ring + glyph |
|---|---|---|
| **MAX** | `game.ship.hp >= SHIP_MAX_HP` | `COLOR.ach` gold, no pulse. Preserves v3.6's FLAG-E affordance: *a Health pickup right now is wasted*. The `MAX` text tag is retired — the gold ring is the tell. |
| **Critical** | `game.ship.hp <= LOW_HP_THRESHOLD` (100 / 40%) | `COLOR.lowhp` `#ff4040`, ring + glyph, **pulsing** |
| **Normal** | otherwise | `COLOR.hp` `#5fe08a` |

**The pulse.** `alpha = 0.6 + 0.4 * Math.sin(performance.now() / 1000 * TAU * HUD_PULSE_HZ)`, applied
via `ctx.globalAlpha` around the arc + glyph. `HUD_PULSE_HZ = 1.2`. **Bind the pulse rate to nothing
else** — the audio siren already scales its rate with HP urgency (`lowhpSet(t)`, L616-625). Two
independent urgency ramps at slightly different rates will read as a wobble. Constant rate here;
audio carries the urgency curve. **FLAG-D**, a real look-call — if Paul wants the ring to ramp too,
reuse `t = 1 - hp/LOW_HP_THRESHOLD` and drive both from that single value.

The brief says `#ff6a3d` orange for warnings. **We use `COLOR.lowhp` `#ff4040`** — already the
low-health chevron's color (L1773), so the ring and the pointer agree, which is the whole point of a
second channel.

---

## 4. CARGO ring (top-right, right of HULL)

Same geometry, same track, `COLOR.text` `#a8d4ff` (the brief's "cyan").

**Fill.** `frac = game.chain.length / game.cargoMax` — L2556. Both are integers; the arc is continuous,
which is a deliberate exception to the brief's "discrete counts as pips" principle, taken because at
cap 24 pips are illegible (FORK-2 option C). The **center integer is the discrete channel**, so the
principle is satisfied by the element as a whole.

**Center.** `String(game.chain.length)` at size 20 (`COLOR.text`, or `COLOR.dim` when the chain is
empty — mirrors the shipped `game.chain.length ? COLOR.text : COLOR.dim` at L4450), with `"/" +
game.cargoMax` beneath it at size 11 in `COLOR.dim` (FORK-2 A).

**Second channel vs. HULL:** center content is a *number*, HULL's is a *glyph*. Plus the label. Per the
brief's rule, that's two channels beyond hue. Good.

**Full-chain treatment** (the brief's open question — **answered: yes, and it should be gold**).
When `game.chain.length >= game.cargoMax` the ring goes `COLOR.ach` gold with the same
`HUD_PULSE_HZ` pulse as a critical hull. This is not an arbitrary color pick — it makes gold mean
exactly one thing across the whole HUD: **"this resource is at its cap; more of it is wasted."**
Identical semantics to the full-hull gold ring. One idiom, learned once, read twice.

---

## 5. Powerup rows (bottom-left, grouped)

One row per **active** effect, iterated in the stable `POWERUP_DROP_TYPES` order (L326) —
`rapid`, `triple`, `magnet`, `engine` — gated by `powerActive(t)` (L2777). Health is instant and never
appears here; Scoop is persistent and is not in this loop (§6).

Row *i* at `y = HUD_FX_BASE_Y - i * HUD_FX_ROW_H`, x-anchored at 40.

```
 ◔  RAPID          <- POWERUP_LABEL[t] (L1797), size 13, POWERUP_COLOR[t]
    12s            <- size 16, POWERUP_COLOR[t]
 ^ ring r=16, glyph inside at r=9
```

- **Ring** at `(40, y)`, radius `HUD_FX_RING_R = 16`, track `COLOR.dim`, value arc in `POWERUP_COLOR[t]`
  (L1788), lineWidth 3, `glowStroke`.
- **Glyph** dead center: `drawPowerupGlyph(t, 40, y, 9, color)` — **exactly the call the shipped HUD
  already makes** (L4469). Rapid is already a double-chevron, Triple a 3-way fan, Magnet a horseshoe,
  Engine a thruster bell. The brief's chevron/diamond icons are superseded; these are better and they
  already match the field pickup, which is the actual second channel.
- **Label + seconds** at x=64.

**Fill, time mode** (`powerMode(t) === "time"`):
`frac = game.powerFx[t] / powerDuration(t)` — `powerDuration` L2770 returns **30 for magnet, 15 for the
rest**. Getting this denominator wrong is the exact bug the L2768 comment warns about. Arc =
`clamp01(frac)`; overcharge arc when `frac > 1` (FORK-3 A).

**Fill, count mode** (`"shots"` / `"pieces"`): **no arc.** Static `COLOR.dim` track only, glyph inside,
and `String(game.powerBudget[t])` where the seconds go. (FORK-5.)

**Seconds text:** `Math.ceil(game.powerFx[t]) + "s"`. Ceil, not round — a ring showing "1s" must not
have already expired.

**Final-seconds warning:** `game.powerFx[t] <= HUD_FX_LOW = 3`. Ring, label, and seconds all shift to
`COLOR.lowhp` and pulse at `HUD_PULSE_HZ` — same treatment as a critical hull, same constant. Count
mode has no low-warning (a budget of 2 shots is not a *deadline*); **FLAG-E**, say the word and it
becomes `powerBudget[t] <= 5`.

### 5.1 Bank feedback — needs new state

Banking is shipped (L2850/L2853) but is **currently invisible**: `powerFx` just goes up. The brief's
surge + `+Ns` badge requires a bank event, and there is no event bus. Minimal addition:

```js
// game object, beside powerFx:
powerBank: { rapid: 0, triple: 0, magnet: 0, engine: 0 },   // sec of bank-flash left (0 = none)
powerBankAmt: { rapid: 0, triple: 0, magnet: 0, engine: 0 },// N for the "+Ns" badge
```

- **`applyPowerup()` (L2849-2854):** on a bank (i.e. the effect was already active), set
  `game.powerBank[type] = HUD_BANK_FLASH` (0.6s) and `game.powerBankAmt[type] = powerDuration(type)`
  (or `POWERUP_BUDGET[type]` in count mode). One `powerActive(type)` check before the `+=` tells you
  whether it *was* a bank or a fresh pickup — a fresh pickup gets no badge.
- **`update()`:** `game.powerBank[t] = Math.max(0, game.powerBank[t] - dt)`. Reset both in
  `startGame()` (L2570-2588) alongside `powerFx`/`powerBudget`.
- **`drawHUD()`:** while `powerBank[t] > 0`, scale the ring radius by
  `1 + HUD_BANK_POP * (powerBank[t] / HUD_BANK_FLASH)` (`HUD_BANK_POP = 0.25`, so it pops 25% and
  settles) and draw `"+" + powerBankAmt[t] + "s"` in `COLOR.ach` to the right of the seconds, fading
  with the same fraction.

**FLAG-F:** the badge should read `+30s` for a magnet and `+15s` for the rest — it must come from
`powerDuration(type)`, never a literal 15.

---

## 6. Survivors — elements the brief didn't mention

These are shipped, deliberate, and **must not be dropped in a rewrite of `drawHUD()`**.

1. **SCOOP pips** (L4477-4489). `game.scoopLevel` 0..`SCOOP_MAX_LEVEL` 5 (L377). A **persistent**
   upgrade — never on a clock, decays only on hits. Deliberately *outside* the powerup loop and it
   stays outside. It moves to the **bottom** of the bottom-left stack (y = `HUD_FX_BASE_Y`, powerups
   stack above it) so the persistent thing is the stable floor and the timed things float above.
   Pips stay pips — this is exactly the discrete count the brief's own principle wants as pips, and
   filled/hollow is already the second channel. `POWERUP_COLOR.scoop` `#c07bff`. Hidden at level 0.
   **FLAG-G:** the filled pips use `ctx.fill()` (L4485) — a fill, in a no-fills renderer. It's a 4px
   dot, it's fine, and v3.6 already accepted it. Not changing it here.
2. **Dock chevron** (L4490-4496). Orbits screen center at r=42, points at `game.dock`, `COLOR.dock`.
   Only when hauling. **This is the one thing allowed in the "clear center."**
3. **Low-health chevron** (L4497-4512). r=58, points at the nearest live Health powerup, `COLOR.lowhp`,
   only while `hp <= LOW_HP_THRESHOLD` *and* one exists. Both chevrons can show at once — that's why
   the radii differ.

---

## 7. New rendering helper

There is no arc helper in the build. One is needed, and exactly one:

```js
// A HUD ring arc: from 12 o'clock, clockwise, sweeping `frac` of a full turn. `frac` is NOT clamped
// here — callers clamp (banking can exceed 1.0, see the overcharge arc). Track-only when frac <= 0.
function drawRingArc(x, y, r, frac, color, width = HUD_RING_W, blur = 12) {
  if (frac <= 0) return;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * frac);
  glowStroke(color, width, blur);   // never closePath() — an arc, not a poly
}
```

`glowStroke` (L1738) does the whole glow contract. **Nothing in this changeset may call `ctx.fill()` or
`ctx.fillRect()`** — that's the entire point of the rebuild. The only surviving fills in the HUD are
`drawText` (which is `fillText`, an accepted exception) and the SCOOP pip dots (FLAG-G).

Every `strokeRect` / `fillRect` in `drawHUD()` (L4427, 4430, 4441, 4445, 4470, 4473) is **deleted**.

---

## 8. State-binding table

| HUD field | game state | source | notes |
|---|---|---|---|
| Score | `game.score` | L2557 | `padStart(6,"0")`, unchanged |
| Level | `game.wave` | L2557 | label is `LEVEL`, code term stays `wave` |
| HULL ring fill | `game.ship.hp / SHIP_MAX_HP` | L1817, L156 (250) | eased via new `game.hudHull` |
| HULL critical | `game.ship.hp <= LOW_HP_THRESHOLD` | L164 (100 = **40%**) | **shared with the audio siren** — do not fork this constant |
| HULL max | `game.ship.hp >= SHIP_MAX_HP` | L156 | gold ring (was the `MAX` tag) |
| SHIELD arc | `game.ship.energy` (0..1) | L1813 | FORK-1 A — concentric inner arc, r-9, `COLOR.shield` |
| CARGO ring fill | `game.chain.length / game.cargoMax` | L2556 | denominator is **runtime, 12→24** |
| CARGO center | `game.chain.length` | — | + `/cargoMax` sub-label (FORK-2 A) |
| CARGO full | `game.chain.length >= game.cargoMax` | — | gold + pulse |
| Powerup list | `POWERUP_DROP_TYPES` filtered by `powerActive(t)` | L326, L2777 | stable order; max 4 rows |
| Powerup icon | `drawPowerupGlyph(t, …)` | L2370 | already exists — reuse |
| Powerup hue | `POWERUP_COLOR[t]` | L1788 | already exists — reuse |
| Powerup label | `POWERUP_LABEL[t]` | L1797 | already exists — reuse |
| Powerup ring fill | `game.powerFx[t] / powerDuration(t)` | L2551, L2770 | **magnet's denominator is 30, not 15** |
| Powerup count mode | `powerMode(t) !== "time"` → `game.powerBudget[t]` | L2761, L2552 | no ring — static track + number (FORK-5) |
| Powerup low | `game.powerFx[t] <= 3` | new `HUD_FX_LOW` | time mode only (FLAG-E) |
| Bank surge / `+Ns` | new `game.powerBank[t]`, `game.powerBankAmt[t]` | **new state**, written in `applyPowerup` L2849 | §5.1 |
| SCOOP pips | `game.scoopLevel` / `SCOOP_MAX_LEVEL` | L2553, L377 (5) | survives |
| Dock chevron | `game.chain.length && game.dock && !game.ship.dead` | L4491 | survives |
| Health chevron | `game.state === "playing" && hp <= LOW_HP_THRESHOLD` | L4503 | survives |
| HUD visible at all | `Capture.hudVisible` | L4384, L4545 | `drawHUD()` is skipped when false — **so no HUD animation state may be advanced inside `drawHUD()`** |

**`drawHUD()` runs in `playing`, `dying`, and `gameover`** (title early-returns at L4323-4344). During
`"dying"` the ship is dead but `hp` may be 0 → the hull ring drains to empty and sits red. That's
correct and desirable; the death shockwave and flash (L4365-4379) draw *under* it by design.

---

## 9. Explicitly NOT in this changeset

- Lives / ship-count glyphs (no lives concept — correct, nothing to remove).
- A "Hunter forming" indicator (audio already carries it).
- A delivery-to-bonus meter (**never existed**; the brief's §6 removal is a no-op).
- An embedded webfont (FLAG-A). Monospace ships.
- Score digit grouping (FLAG-B).
- Any change to `game.wave` → `LEVEL` labelling, scoring, or the audio siren's HP ramp.

---

## 10. Playtest asks this round hands back

1. Is the top-right corner actually loud enough now that it holds rings instead of bars? (FORK-4 —
   the corner was abandoned once already for being easy to miss.)
2. At cap 24, does a nearly-full CARGO ring read as "nearly full," or does a growing denominator make
   the ring feel like it's lying? (FORK-2.)
3. Does the overcharge halo read as *good* (I'm rich) or as *broken*? (FORK-3.)
4. Two independent pulses — critical hull at 1.2 Hz and an expiring powerup at 1.2 Hz — in the same
   frame: does that read as one urgent system or as visual noise? (FLAG-D.)
5. Is `HUD_EASE` 0.002 too slow to register a hit? A hit already has screenshake and a sound; the ring
   is the third channel and can afford to be smooth. Tune in the browser.