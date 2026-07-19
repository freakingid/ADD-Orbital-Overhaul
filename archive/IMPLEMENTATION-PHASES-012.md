# IMPLEMENTATION-PHASES-CS012 — Grab-bag playtest fixes

**Changeset:** CS012. **Baseline:** shipped **CS011 P5** — `asteroids-deluxe.html`, `GAME_VERSION`
`"1.0.0.11"` (HEAD hash is Paul's local tree; every prompt re-greps the symbol, not a commit). **Turns**
the signed-off `PLANNED-FEATURES-CS012.md` (all three forks resolved) into dependency-ordered,
session-sized Claude Code phases.

**No design instrument.** CS012 is lab-free by design (spec §scope). Nothing here ports from a `tools/`
lab — the one lab-dependent option (§3's Dan voice line, FORK-CS012-B option (b)) was **deferred out of
CS012** for exactly that reason. So there is no P0 lab-gate phase; phases are P1–P5, one per item group.

**Version:** bump `GAME_VERSION` `"1.0.0.11" → "1.0.0.12"` on the **last player-visible phase**, per the
established `Major.Minor.Patch.Changeset` scheme (Changeset digit = 12). Every CS012 item is player-visible,
so "last phase" = **P5 (Group D)** by this ordering — recommended, mirroring CS010 P0 / CS011 P5's "last
change before the round closes" placement. Paul's call which phase; move it if he prefers.

**No auto-push.** Claude Code commits nothing to `main`. Each phase delivers the diff + a passing headless
test + the commit message to hand to Paul; **Paul commits and pushes each phase himself.**

---

## 0. Grep-confirmed against the live build (done this session — re-verify before editing)

The CS012 spec was grepped against **this same CS011 P5 tree**, so its anchors are close — but a few
carry corrections the phase prompts depend on (flagged **⚠**). **These are the actual anchors as grepped
in the attached `asteroids-deluxe.html`.** Each prompt still tells Claude Code to re-grep the symbol, never
trust a number.

### Group A — HUD bottom-left stack (§1)
| Symbol | Spec said | **Actual** | Notes |
|---|---|---|---|
| `drawHUD()` | — | **L5573** | powerup-row region **L5688–5742**, scoop-pip block **L5745–5757** |
| powerup-row loop | L5689–5743 | **L5688 `let slot = 1;` → L5742** | `for (const t of POWERUP_DROP_TYPES) { if (!powerActive(t)) continue; … slot++ }` — the `slot` cursor + `continue` skip is exactly what §1.2 removes |
| `POWERUP_DROP_TYPES` | L419 | **L419** | `["rapid","triple","magnet","engine"]` |
| scoop-pip block | L5749–5757 | **L5745–5757** | `if (game.scoopLevel > 0)` → "SCOOP" label + 5 dots at `108 + i*16`, r=4; **filled dot = FLAG-G no-fills exception (GDD §3.2)** |
| `SCOOP_MAX_LEVEL` | L470 | **L470** | `= 5`; segment count derives from this |
| `POWERUP_COLOR.scoop` | — | **L2734** | `"#c07bff"` violet |
| `HUD_FX_BASE_Y` / `HUD_FX_ROW_H` | L261 | **L261 / L262** | `640` / `40` — fixed slots: scoop=0, rapid/triple/magnet/engine=1–4 → top row `y=480` |
| `HUD_FX_RING_R` / `powerMode` / `powerDuration` / `powerActive` | L3743/L3752 | **L3743 / L3752 / L3759** | `num = counted ? String(powerBudget[t]) : Math.ceil(powerFx[t])+"s"` at **L5727** |
| `drawRingArc` | L2692 | **L2692** | arc-only; new sibling `drawRingSegments` goes beside it |
| `glowStroke` / `drawPowerupGlyph` / `drawText` | — | present | lit segments route through `glowStroke` like every other ring |

### Group B — UFO ramp (§2)
| Symbol | Spec said | **Actual** | Notes |
|---|---|---|---|
| small-saucer aim line | L3165 | **L3165** | `const err = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, game.wave);` — the one line FORK-A(a) edits |
| `SAUCER_AIM_ERR_FLOOR/CEIL` | L399–400 | **L399 / L400** | `0.35` → `0.09` |
| big-saucer random fire | L3168 | **L3168** | `a = rand(0, TAU);` — untouched (random is the easy case) |
| `ramp` / `difficultyFactor` / `RAMP_WAVES` | L2605 | **L2610 / L2605 / L384** | `ramp(floor,ceil,wave)`; wave arg accepts a fractional wave fine |
| `leverScale` | L2619 | **L2619** | not touched — (a) is a scaled-wave trick, not a lever |
| `SAUCER_ACCURACY_RAMP_SCALE` | — | **absent (new knob)** | place beside L399–400 |

### Group C — Max-haul achievement + celebration (§3)
| Symbol | Spec said | **Actual** | Notes |
|---|---|---|---|
| dock-offload block | L4789–4798 | **L4779–4840** | `deliveryCount++` L4779; cap-growth L4787–4798; emptying-pop voice L4832 |
| `deliveryCount === 12` latch | L4823 | **L4823** | `{ fullChainVisit = true; lifetime.fullChains++; lifetime.heavyHaulerEvents++; }` — mirror one line over |
| `CARGO_CAP_MAX` / `CARGO_BASE` / `CARGO_GROW_PER` | L330 | **L330 / L329 / L331** | `24 / 12 / 30` |
| `game.stats.fullChainVisit` | L3436 | **L3436** | in `resetGameStats()` (**L3432**); Heavy Hauler ach L3880 `cur: s => s.fullChainVisit ? 1 : 0` |
| `Achievements.LIFETIME` pool | L3909 | **L3909** | `fullChains` L3931, `heavyHaulerEvents` L3918/3949 |
| viewer two-column split | L5278 | **L5278** | `Math.ceil(LIFETIME.length / 2)` — auto-reflows, no edit |
| `dockDelivery` / `dock_20` | L1802 | **L1801 / L1802** | already barks 20+ on a 24-haul; do NOT add `dock_max` (that's deferred (b)) |
| `onUnlock` / `AudioSys.achievement()` | L4056–4057 | **L4054 / L4057** | fires the gold toast + fanfare when `evaluate()` crosses the goal — the celebration layers ON TOP |
| `FloatText` / `COLOR.ach` | — | **L3375 / L2716** | ⚠ `FloatText` is **world-space** (drawn under camera translate); `COLOR.ach` = `"#ffcf5a"` exists |
| `game.cargoFlash` / `HUD_CAP_FLASH` | — | present (L4796) | the existing cap-up ring flash — reusable for the celebration pulse |

### Group D — Auto-shield (§4)
| Symbol | Spec said | **Actual** | Notes |
|---|---|---|---|
| `damageShip(amount, srcX, srcY)` | L4226 | **L4226** | hook goes at the **top**, above the early-return |
| early-return | `s.shieldOn \|\| s.invuln > 0` @ L4228 | **⚠ L4228 = `if (s.dead \|\| s.shieldOn \|\| s.invuln > 0) return false;`** | includes `s.dead`; the hook (placed above it) MUST also guard `!s.dead` |
| hit body (knockback + stun) | — | **L4238–4247** | `shortDelta`→`atan2`→`vx/vy = KNOCKBACK_SPEED`; `s.invuln = HIT_STUN_DURATION` — copy this exact shape for the auto-save |
| hazard→`damageShip` call sites | L4913/4939/4963 | **L4920 (bullet), L4953 (Hunter), L4968 (saucer)** | ⚠ **L4953 = `const applied = damageShip(h.damage, h.x, h.y);`** — return value consumed; auto-save returns **false** (same contract as the shielded early-return already returns) |
| `SHIELD_HIT_COST` / `SHIELD_DRAIN` | L129 | **L129 / L127** | `0.22` / `0.55`; `shieldDeflect` spends `SHIELD_HIT_COST` at L4307 |
| `LOW_HP_THRESHOLD` / `SHIP_MAX_HP` | L173 | **L173 / L165** | `100` (40% of `250`) — the shared "critical" line |
| `HIT_STUN_DURATION` / `KNOCKBACK_SPEED` | — | **L172 / L171** | `1.0` / `250` |
| `addScore` / `nextRepair` ratchet | L3610 / L3613–3621 | **L3610 / L3613–3614** | penalty must **bypass** this (FLAG-4e) |
| `REPAIR_MILESTONE` / `SCOOP_MAX_BONUS` | — | **L210 / L503** | `10000` / `500` (500 = the reused round magnitude) |
| `settings` + `saveSettings`/`loadSettings` | — | see Group E table | `autoShield` additive, `captions` idiom |
| `AUTO_SHIELD_SCORE_PENALTY` / `settings.autoShield` | — | **absent (new)** | penalty knob near L127–130; setting default `false` |
| `DIFFICULTY_ROWS` / `menuDifficulty` / `drawDifficulty` | L2438/2439/5163 | **L2438 / L2439 / L5163** | `["shot","magnet","back"]`; string-keyed nav (`row = DIFFICULTY_ROWS[m.index]`); `menuPanel(620, 360, "DIFFICULTY")` L5164 |
| `menuPanel(w,h,title)` | — | **L5086** | grow `h` for the new row + help line |

### Group E — Menu reorganisation (§5)
| Symbol | Spec said | **Actual** | Notes |
|---|---|---|---|
| `MENU_ROOT_PLAY` / `MENU_ROOT_SYS` / `rootItems` | L2235/2238/2239 | **L2235 / L2238 / L2239** | `rootItems()` = `state==="playing" ? PLAY : SYS`; **SYS retires** under FORK-C(a) |
| `MENU_OPTIONS` | L2244 | **L2244** | `["Sound / Music","Controls","Achievements","High Scores","Difficulty","Back"]` |
| `openPause()` | — | **L2282** | sets `screen = "root"`; **O-key system open at L2122** (`k === "o" && (title\|gameover) && !game.entry`), pad-B at L2182/2185 — all route here |
| `menuRoot` | — | **L2341** | dispatch-by-label; **Achievements (L2349, `achReturn="root"`) + Back (L2351) branches are system-root-only → die** |
| `menuOptions` | L2360 | **L2359** | dispatch-by-label L2364–2369; **"Back" (L2369/L2371) = `gotoScreen("root", …)` → must branch on `game.state`** |
| `achReturn` | L2349/2366/2421–2422 | **L2349, L2366, L2421** (+ init **L3472 / L3542**, comment **L2428**) | retires: Achievements now always backs to Options |
| `menuAchievements` back | — | **L2421** | `if (achReturn==="root") …root… else …options…` → collapse to always Options |
| `drawRootMenu` / `drawOptionsMenu` | L5100–5102 | **L5100 / L5113** | root title ternary `PAUSED`/`MENU` (L5102); Options title hardcoded `"OPTIONS"` (L5114) — FLAG-5a |
| `closePause` / `gotoScreen` | — | **L2294 / L2309** | `closePause()` sets `paused=false, screen=null` — the correct "close the whole overlay" for a system-menu Back |

**`VIEW_W`/`VIEW_H`** = 1280 × 720. **`drawText(str,x,y,size,color,align)`** does not touch
`ctx.globalAlpha`. **`STORAGE_KEY` `afd_settings_v1`** frozen — `autoShield` is additive.

---

## Findings / decisions surfaced this session (all FLAGs — no new FORKs; the three resolved forks stay resolved)

Grep-caught issues where the spec's literal wording, taken at face value, would misbuild. Each resolved as
a best-guess with reasoning inline; none reopens a resolved fork.

- **FINDING-D1 — the auto-shield hook must guard `!s.dead` (P5, load-bearing).** The spec quotes the
  early-return as `s.shieldOn || s.invuln > 0`, but the live guard is `s.dead || s.shieldOn || s.invuln > 0`
  (**L4228**). The hook sits **above** that return, so without an explicit `!s.dead` a hit on an
  already-dead ship (dying spectacle, concurrent-hazard frame) could auto-save and bleed score after death.
  **Ship the full condition:** `settings.autoShield && !s.dead && !s.shieldOn && s.invuln <= 0 &&
  s.hp <= LOW_HP_THRESHOLD && s.energy >= SHIELD_HIT_COST`.

- **FINDING-D2 — Hunter site consumes `damageShip`'s return (P5, correctness check).** The Hunter collision
  captures `const applied = damageShip(h.damage, h.x, h.y);` (**L4953**); bullet (L4920) and saucer (L4968)
  discard it. The auto-save returns **`false`** — identical to the shielded/i-frame early-return that
  already returns `false` today — so `applied === false` drives the exact "no damage was applied" path the
  shielded case already exercises. No new downstream handling needed; **verify** the Hunter branch treats
  false as "didn't land" (it does — that's the existing shielded contract), and the headless test asserts it.

- **FINDING-D3 — the penalty is the deliberate `addScore` exception (P5).** Per FLAG-4e, subtract directly
  — `game.score = Math.max(0, game.score - AUTO_SHIELD_SCORE_PENALTY)` — and **do not touch
  `game.nextRepair`**. Routing a decrement through `addScore` (**L3610**, which ratchets `nextRepair` and
  grants HP on the way *up*) risks re-triggering an already-earned repair when the player re-crosses the
  threshold. Leave a code comment flagging this as the intentional exception to the "all scoring through
  `addScore`" rule so a future pass doesn't "fix" it back; note it in CLAUDE.md.

- **FINDING-A1 — Group A retires a sanctioned no-fills exception (P2, doc).** The scoop pips are filled
  4px dots — a named GDD §3.2 / FLAG-G exception. Replacing them with a **stroked** segmented ring
  (`glowStroke`, no fill) means the SCOOP-pip fill **goes away**: drop that entry from the §3.2 exception
  list and grep CLAUDE.md's no-fills paragraph for the SCOOP-pip mention. `drawRingSegments` adds **no**
  new fill, so it introduces no new exception. (Death-flash and the CS010-P3 low-health corner glow remain.)

- **FINDING-C1 — "centred MAX HAUL" needs care; `FloatText` is world-space (P3, look-call).** `FloatText`
  (**L3375**) renders in `game.floaters` under the camera translate — there is no screen-space banner
  primitive. Best-guess celebration: a **sized-up `FloatText("MAX HAUL", …, COLOR.ach)`** at the dock (where
  the other delivery floaters already spawn) **plus** a gold CARGO-ring pulse reusing `game.cargoFlash =
  HUD_CAP_FLASH` — both in-idiom, no new machinery, and it layers on top of the achievement toast+fanfare.
  A true screen-centred banner is a separate, optional bit of new screen-space text; flagged, not built
  unless Paul calls it.

- **FINDING-C2 — lifetime single-goal keyed on a per-game flag (P3, confirm).** `game.stats.maxChainVisit`
  is per-game (reset in `resetGameStats`). Adding it as a LIFETIME `goal:1` with `cur: s => s.maxChainVisit
  ? 1 : 0` unlocks the first game the player hits it and persists via the unlocked-set — the **exact**
  mechanism Heavy Hauler already uses on `s.fullChainVisit` (evaluated during play, from game stats `s`).
  Port the spec's prescription verbatim; the two-column viewer (L5278) auto-reflows 19→20.

- **FINDING-E1 — the "Back from Options" path is the load-bearing edge (P4).** Under FORK-C(a), `O` opens
  **Options directly** from title/gameover (no root behind it). So (1) `openPause()` must set `screen =
  game.state === "playing" ? "root" : "options"`; and (2) `menuOptions`'s Back
  (`gotoScreen("root", rootItems().indexOf("Options"))`, L2369/L2371) must branch: **playing →** back to the
  pause root; **not playing → `closePause()`** (close the whole overlay to the underlying title/gameover).
  Get this wrong and Back either dead-ends or drops to a now-nonexistent system root. The headless test
  drives both entry contexts.

- **FINDING-E2 — retire, don't strand, the machinery (P4).** With `MENU_ROOT_SYS` gone: `menuRoot`'s
  Achievements/Back branches (L2349/L2351) are dead — remove them; `menuAchievements`'s `achReturn`
  conditional (L2421) collapses to always `gotoScreen("options", MENU_OPTIONS.indexOf("Achievements"))`;
  drop the `achReturn` field from the `game.menu` literal (L3472) and its reset (L3542) and the L2428
  comment. `rootItems()` can simplify to `MENU_ROOT_PLAY` (root is now only ever reached while playing).
  **FLAG-5a (title):** the system entry lands on a panel reading `"OPTIONS"`; best-guess leave it — a
  `game.state`-based `"MENU"`/`"OPTIONS"` title is a one-line knob if Paul wants the old label back.

---

**Model policy (per Paul's standing guidance):** **Opus 4.8** for the two load-bearing/FORK phases — **P4**
(menu IA refactor + back-path branching + machinery retirement) and **P5** (the `damageShip` rate-limit
hook is the one place a subtle bug hides). **Sonnet 5** for the mechanical/data phases — **P1** (one-line
ramp + knob), **P2** (self-contained render), **P3** (additive latch + achievement + floater). Avoid
`opusplan`/`ultracode` (surgical single-file workflow).

**Applying them in Claude Code (session settings, not mid-prompt):** each phase is its own session — set the
model *before* pasting: `/model opus` for P4/P5, `/model sonnet` for P1/P2/P3. Effort defaults to `high`;
the P4/P5 prompt blocks below carry the literal **`ultrathink`** keyword for their hard sub-problem (the
back-path logic / the hook). If the spinner ever reads below `high`, `/effort high` corrects it
(`/effort xhigh` to push the hardest sub-problem). `think`/`think hard` are ignored as plain text —
`ultrathink` is the one that fires.

---

## Phase order & dependency graph

```
P1 (UFO ramp §2)          ─┐
P2 (HUD stack §1)          ─┼─ mutually INDEPENDENT (touch Saucer / drawHUD / dock-offload —
P3 (max-haul §3)          ─┘   no shared functions, no menu code); each individually shippable
                                                    │
P4 (menu reorg §5, FORK) ──sequence-before──► P5 (auto-shield §4 — its Difficulty row lands in E's tree)
```

- **A/B/C are genuinely independent** (spec confirmed): Group B = `Saucer.update`, Group A = `drawHUD`,
  Group C = the dock-offload block — disjoint functions, none touch the menu region, so none drifts the
  menu anchors P4/P5 re-grep. Order among them is free; sequenced B→A→C by ascending size for clean
  intermediate commits.
- **E before D** (the only cross-group rule): E reshapes the menu tree and moves anchors around
  `menuOptions`/`menuRoot`/`gotoScreen`/`achReturn`; doing E first means D re-greps `menuDifficulty`/
  `drawDifficulty` against the settled tree. Row *content* (D) and tree *structure* (E) don't otherwise
  interact.
- Each phase is one Claude Code session, one commit, individually shippable. Intermediate states are
  coherent (default-off auto-shield keeps shipped balance until P5; the menu still works after every phase).

---

## Phase 1 — UFO accuracy ramp: scaled-wave knob (Group B, §2, FORK-CS012-A → a)

**Goal:** saucers sharpen up **more slowly** than the global difficulty curve, while keeping the wave-1
feel Paul already likes — one new knob, one edited line.

**Exact work:**
1. **New constant `SAUCER_ACCURACY_RAMP_SCALE`** (playtest knob, e.g. `0.5` = accuracy improves half as
   fast as everything else), placed beside `SAUCER_AIM_ERR_FLOOR/CEIL` (~L399–400), with a knob comment.
2. **Edit the small-saucer aim line** (~L3165) from
   `ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, game.wave)` to
   `ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 1 + (game.wave - 1) * SAUCER_ACCURACY_RAMP_SCALE)`.
   At wave 1 the scaled wave is `1` — **byte-identical wave-1 floor preserved**. `ramp`/`difficultyFactor`
   accept a fractional wave fine.
3. **Do NOT touch** the big-saucer random fire (~L3168), `rollFireTimer` (~L3144), the `15%→60%`
   small-saucer appearance ramp (~L4850), or `leverScale` — FLAG-CS012-2a (ramping the appearance chance
   instead) stays a noted possibility, **not** built.

**Paste-ready Claude Code prompt:**
```
Read CLAUDE.md + STATUS.md. Single file (asteroids-deluxe.html), no auto-push.

Re-grep by symbol (line numbers drift): SAUCER_AIM_ERR_FLOOR / SAUCER_AIM_ERR_CEIL (~L399-400), the
small-saucer aim line in Saucer.update  const err = ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL,
game.wave)  (~L3165), the ramp() and difficultyFactor() defs (~L2610 / ~L2605).

1) Add a new playtest-knob constant beside the SAUCER_AIM_ERR_* lines:
   const SAUCER_ACCURACY_RAMP_SCALE = 0.5;  // <1: saucer aim sharpens slower than the global difficulty
                                            // ramp. Pins the wave-1 floor exactly. PLAYTEST KNOB.
2) Change ONLY the wave argument of that one aim line to:
   ramp(SAUCER_AIM_ERR_FLOOR, SAUCER_AIM_ERR_CEIL, 1 + (game.wave - 1) * SAUCER_ACCURACY_RAMP_SCALE)
   Do not touch the big-saucer random fire (a = rand(0, TAU)), rollFireTimer, the small-saucer
   appearance ramp (~L4850), or leverScale.

Headless test (extract the <script>, node --check, stub window/document/rAF, drive the REAL code — no
reimplementation):
  - At game.wave = 1 the aimed err equals the pre-edit value byte-for-byte (scaled wave === 1).
  - At a mid/late wave (e.g. 9, 17) the scaled-wave err is LOOSER than the old unscaled err at the same
    wave (aim tighter-later), and still monotonically tightening toward SAUCER_AIM_ERR_CEIL.
  - err never drops below SAUCER_AIM_ERR_CEIL nor above SAUCER_AIM_ERR_FLOOR.
node --check clean; startGame()/update(1/60) headless (ctx null) no-crash. No push. Give me the commit message.
```

**Session setup:** `/model sonnet` (Sonnet 5; effort defaults to `high`). One knob + one line. No `ultrathink`.

**Test expectations:** as embedded — wave-1 identity, tighter-later monotonicity, bounds respected.

**Doc note:** GDD §2 saucer/difficulty section — note saucer aim now samples a **scaled wave**
(`SAUCER_ACCURACY_RAMP_SCALE`) so accuracy ramps independently of `RAMP_WAVES` while pinning wave 1. GDD
Architecture Map / constants list gains the knob. STATUS.md "Changed this session". (No version bump.)

**Commit message:** `CS012 P1: UFO — scaled-wave saucer-accuracy knob (SAUCER_ACCURACY_RAMP_SCALE)`

---

## Phase 2 — HUD bottom-left stack: segmented Scoop ring + always-show muted powerup rings (Group A, §1)

**Goal:** turn the compacting powerup stack into **five fixed rows** — Scoop as a segmented ring (slot 0),
rapid/triple/magnet/engine as always-present rings (slots 1–4), muted with a `0` when inactive — so each
powerup keeps a constant screen position. One cohesive `drawHUD()` pass + one new stroke helper.

**Exact work:**
1. **New helper `drawRingSegments(x, y, r, segs, filled, litColor, dimColor)`** beside `drawRingArc`
   (~L2692): draws `segs` arc wedges with a small angular gap between each; the first `filled` lit via
   `glowStroke` (like every other ring), the rest as a dim no-glow track. **No fills** — strokes only.
   Segment-gap size is a look-call knob (comment it). (FLAG-CS012-1a.)
2. **Scoop → segmented ring at slot 0** (~L5745–5757): replace the `if (game.scoopLevel > 0)` pip block
   with a row in the powerup-row idiom at `(40, HUD_FX_BASE_Y)` — `drawRingSegments(40, HUD_FX_BASE_Y,
   HUD_FX_RING_R, SCOOP_MAX_LEVEL, game.scoopLevel, POWERUP_COLOR.scoop, COLOR.dim)` + the `"SCOOP"` label
   and level number to the right (same `drawText` positions the powerup rows use). **Always drawn** — the
   `scoopLevel > 0` hide is removed; at level 0 it shows the dim track, zero segments lit (FLAG-CS012-1b).
   Segment count derives from `SCOOP_MAX_LEVEL`, never hardcoded 5 (FLAG-CS012-1b).
3. **All four timed rows always show, fixed slots** (~L5688–5742): **remove** the `let slot = 1` cursor
   and the `if (!powerActive(t)) continue;` skip. Each type draws at a **fixed** row —
   `y = HUD_FX_BASE_Y - (i + 1) * HUD_FX_ROW_H` for `POWERUP_DROP_TYPES[i]` (scoop already holds slot 0).
   - **Active row:** unchanged, byte-for-byte — value arc (time mode), overcharge halo, low-timer pulse,
     bank pop, live number.
   - **Inactive row (`!powerActive(t)`):** dim full-circle track only (no value arc, no pulse, no bank);
     glyph + label + number drawn muted. The number expression is unchanged — an inactive row's
     `powerFx`/`powerBudget` are already 0, so it yields `"0s"` (time mode) / `"0"` (count mode) with no
     format flip once the skip is gone (FLAG-CS012-1d). "Muted" best-guess: flat `COLOR.dim` for
     glyph+label+number (comment as a knob vs. dimmed type-hue; FLAG-CS012-1c).
4. Fixed 5-row footprint tops out at `y = 480` (FLAG-CS012-1e) — fits the 720-tall viewport with room.

**Paste-ready Claude Code prompt:**
```
Read CLAUDE.md + STATUS.md. Single file, no auto-push. This is one cohesive drawHUD() change plus a new
STROKE-only helper. Honour the no-fills rule: the new ring is strokes (glowStroke), and the OLD scoop pip
FILL goes away (see doc note).

Re-grep by symbol: drawHUD() (~L5573); its powerup-row loop  let slot = 1; for (const t of
POWERUP_DROP_TYPES) { if (!powerActive(t)) continue; ... }  (~L5688-5742); the scoop-pip block
if (game.scoopLevel > 0) { ... 108 + i*16 dots ... }  (~L5745-5757); drawRingArc (~L2692);
HUD_FX_BASE_Y/HUD_FX_ROW_H/HUD_FX_RING_R; SCOOP_MAX_LEVEL (~L470); POWERUP_DROP_TYPES (~L419);
POWERUP_COLOR.scoop; powerActive/powerMode/powerDuration; the num line  counted ? String(powerBudget[t])
: Math.ceil(powerFx[t]) + "s"  (~L5727).

1) Add beside drawRingArc:
   function drawRingSegments(x, y, r, segs, filled, litColor, dimColor) — draw `segs` arc wedges with a
   small angular gap between each (gap = a look-call knob constant, comment it); wedges 0..filled-1 lit via
   glowStroke like the other rings, the rest stroked dim with no glow. NO fills.
2) Replace the scoop pip block with a slot-0 row in the powerup-row idiom, ALWAYS drawn (remove the
   scoopLevel>0 hide): drawRingSegments(40, HUD_FX_BASE_Y, HUD_FX_RING_R, SCOOP_MAX_LEVEL, game.scoopLevel,
   POWERUP_COLOR.scoop, COLOR.dim), plus "SCOOP" label + the level number to the right (reuse the powerup
   row's drawText x/y offsets). Segment count derives from SCOOP_MAX_LEVEL, never hardcode 5.
3) In the powerup-row loop: REMOVE the `slot` cursor and the `!powerActive(t) continue` skip. Draw all four
   POWERUP_DROP_TYPES at FIXED rows y = HUD_FX_BASE_Y - (i+1)*HUD_FX_ROW_H (i = index in POWERUP_DROP_TYPES).
   - powerActive(t): keep the CURRENT active rendering byte-for-byte (value arc / overcharge halo /
     low-timer pulse / bank pop / live number).
   - inactive: dim track only, no value arc/pulse/bank; glyph+label+number in COLOR.dim; the existing num
     expression yields "0s"/"0" unchanged (do not special-case it).

Headless test (drive REAL drawHUD via a recording-canvas stub that logs arc/stroke/fillText/glowStroke calls;
no reimplementation):
  - Five rows render at FIXED y (scoop=HUD_FX_BASE_Y; rapid/triple/magnet/engine at BASE - (i+1)*ROW_H),
    independent of how many powerups are active — activating/expiring one does NOT move any other row's y.
  - An inactive timed row logs NO value-arc drawRingArc call, NO fill, and its number text is "0s" (time
    mode) or "0" (count mode); an active row still logs its value arc.
  - Scoop at level 0 renders (dim track, 0 lit segments); at level 3 exactly 3 of SCOOP_MAX_LEVEL segments
    are lit; NO fillText/fill dot calls anywhere (the pip fill is gone).
  - drawRingSegments logs `segs` stroked wedges, `filled` of them via glowStroke.
node --check clean; startGame()/update(1/60) headless (ctx null) no-crash. No push. Give me the commit message.
```

**Session setup:** `/model sonnet` (Sonnet 5; `high`). Self-contained render — no `ultrathink`.

**Test expectations:** fixed row geometry regardless of active count; muted inactive rows (no arc/`0` number);
scoop segments derive from `SCOOP_MAX_LEVEL`; **zero fills** in the whole bottom-left stack.

**Doc note (FINDING-A1):**
- GDD §3.2 — **remove the SCOOP-pip-row fill** from the no-fills exception list (the pips are gone; the new
  ring strokes). Death-flash + the CS010-P3 low-health corner glow remain. Note `drawRingSegments` adds no fill.
- GDD §2.12 (HUD) — the bottom-left stack is now five FIXED rows (scoop segmented ring at slot 0; four
  timed rings always shown, muted+`0` when inactive; no compaction). Confirm the CS010-P3 corner-glow
  "frame, not wash out the rows" note still reads right against the now-stable footprint (playtest ask).
- GDD Architecture Map — `drawHUD` row gains `drawRingSegments`; CLAUDE.md no-fills paragraph — grep for the
  SCOOP-pip mention and drop it. STATUS.md. (No version bump.)

**Commit message:** `CS012 P2: HUD — segmented Scoop ring + always-show muted powerup rings (fixed 5-row stack)`

---

## Phase 3 — Max-haul: lifetime achievement + UI celebration (Group C, §3, FORK-CS012-B → a)

**Goal:** reward delivering a **full max-cap chain** (`CARGO_CAP_MAX` = 24) in one dock visit with a new
lifetime achievement + a bespoke UI flourish, layered on the existing toast/fanfare and Dan's 20+ bark.

**Exact work:**
1. **New per-game stat** `game.stats.maxChainVisit` — add `false` in `resetGameStats()` beside
   `fullChainVisit` (~L3436).
2. **Latch** — one line beside the `deliveryCount === 12` latch (~L4823):
   `if (game.deliveryCount === CARGO_CAP_MAX) game.stats.maxChainVisit = true;` (FLAG-3a: key on the
   **constant** `CARGO_CAP_MAX`, not runtime `game.cargoMax` — fixed target per B-8-b, tracks the true max
   if the cap is ever raised).
3. **New LIFETIME achievement** in the pool (~L3909), single-goal, **not** weekly (weekly's `%16` rotation
   must not grow): `{ id: "<id>", name: "<name>", desc: "<desc>", goal: 1, cur: s => s.maxChainVisit ? 1 : 0 }`.
   Placeholder id/name/desc for Paul (FLAG-3b: e.g. "Full Load" / "Maxed Out" / "The Whole Haul"). Viewer
   two-column split (L5278) auto-reflows.
4. **Celebration (FINDING-C1, best-guess UI-only):** on `deliveryCount === CARGO_CAP_MAX`, push a
   sized-up `FloatText("MAX HAUL", game.dock.x, game.dock.y - 22, COLOR.ach)` (bigger than the standard
   delivery floaters — a `size`/`scale` on `FloatText` if it takes one, else the largest existing tier) and
   arm the gold CARGO-ring pulse (`game.cargoFlash = HUD_CAP_FLASH`). Layers on top of the achievement
   toast+fanfare (`onUnlock`) and Dan's existing `dock_20`. **Do NOT add a `dock_max` voice line** — that's
   the deferred FORK-CS012-B (b), out of CS012's lab-free scope. A true screen-centred banner is optional,
   not built (flag).

**Paste-ready Claude Code prompt:**
```
Read CLAUDE.md + STATUS.md. Single file, no auto-push. Additive achievement + UI flourish; mirrors the
existing deliveryCount===12 latch idiom. Do NOT add any voice line (the Dan max-haul line is deferred).

Re-grep: resetGameStats() and its fullChainVisit:false line (~L3432/3436); the dock-offload block
(~L4779-4840), specifically  if (game.deliveryCount === 12) { ... }  (~L4823) and the emptying-pop
if (game.chain.length === 0) VoiceSys.dockDelivery(...)  (~L4832); CARGO_CAP_MAX (~L330); the LIFETIME
achievement pool (~L3909) and how existing lifetime single-goal entries are shaped; FloatText (~L3375);
COLOR.ach; game.cargoFlash / HUD_CAP_FLASH (~L4796).

1) resetGameStats(): add  maxChainVisit: false,  beside fullChainVisit.
2) Beside the ===12 latch add:  if (game.deliveryCount === CARGO_CAP_MAX) game.stats.maxChainVisit = true;
   (key on the constant CARGO_CAP_MAX, not game.cargoMax.)
3) Add ONE new LIFETIME (not weekly) achievement to the pool:
   { id:"max_haul", name:"Maxed Out", desc:"Deliver a full 24-canister chain in one dock visit.",
     goal:1, cur: s => s.maxChainVisit ? 1 : 0 }
   (id/name/desc are placeholders — leave them clearly marked for Paul to finalise.)
4) Celebration on deliveryCount === CARGO_CAP_MAX (same instant as the latch): push a large
   FloatText("MAX HAUL", game.dock.x, game.dock.y - 22, COLOR.ach) — use FloatText's size arg if it has
   one, else the biggest existing size — and set game.cargoFlash = HUD_CAP_FLASH for the gold ring pulse.
   Do NOT add a voice line.

Headless test (drive the REAL dock-offload path + Achievements.evaluate(); no reimplementation):
  - resetGameStats() leaves maxChainVisit false.
  - Driving deliveries so deliveryCount passes through 24 sets game.stats.maxChainVisit true exactly once;
    a visit topping out at 23 does NOT set it; a visit at 12 sets fullChainVisit but NOT maxChainVisit.
  - After maxChainVisit is set, Achievements.evaluate() puts the new id in the unlocked set (goal 1 met);
    it stays unlocked across a subsequent resetGameStats()+save()/load() (lifetime persistence).
  - The celebration pushes a floater and arms cargoFlash on the 24th delivery; nothing on a 12 or 23 haul.
  - No new VoiceSys line is emitted by the max-haul path (dockDelivery still fires its existing tier only).
node --check clean; startGame()/update(1/60) headless no-crash. No push. Give me the commit message.
```

**Session setup:** `/model sonnet` (Sonnet 5; `high`). Additive/mechanical — no `ultrathink`.

**Test expectations:** latch fires once at 24 (not 12/23); lifetime unlock persists; celebration fires only
at 24; no voice line added.

**Doc note:** GDD §2 (salvage/dock + achievements) — the new max-cap-haul lifetime achievement + the UI
celebration (FloatText + cargo-ring pulse); note the deferred Dan line (FORK-CS012-B (b), later CS). GDD
Architecture Map / achievement list. CLAUDE.md achievement pool note if it enumerates counts. STATUS.md.
(No version bump.)

**Commit message:** `CS012 P3: Achievements — max-cap-haul lifetime unlock + MAX HAUL UI celebration`

---

## Phase 4 — Menu reorganisation: collapse the system root, Options as sole hub (Group E, §5, FORK-CS012-C → a)

**Goal:** from title/gameover, `O` opens **Options directly** — the intermediate "MENU" dialog and the
whole `achReturn` machinery retire; Achievements lives in exactly one place (inside Options). Pause stays
`Continue / Options / Quit`. **Sequence before P5** so P5's Difficulty row lands in the settled tree.

**Exact work (the back-path branching is the load-bearing part — FINDING-E1/E2):**
1. **`openPause()`** (~L2282): set `game.menu.screen = game.state === "playing" ? "root" : "options"`
   (title/gameover → straight to Options; playing → the pause root, unchanged). The O-key (~L2122) and
   pad-B (~L2182/2185) already route here.
2. **`menuOptions` Back** (~L2369 `confirm` + ~L2371 `back`): branch —
   `if (game.state === "playing") gotoScreen("root", rootItems().indexOf("Options")); else closePause();`
   (playing → back to the pause root; system entry → close the whole overlay to the underlying title/gameover).
3. **Retire the system root:** remove `MENU_ROOT_SYS` (~L2238) and simplify `rootItems()` (~L2239) to
   return `MENU_ROOT_PLAY` (root is now only reached while playing). Delete `menuRoot`'s now-dead
   Achievements branch (`achReturn="root"`, ~L2349) and system-menu Back branch (~L2351).
4. **Retire `achReturn`:** `menuAchievements` back (~L2421) → always
   `gotoScreen("options", MENU_OPTIONS.indexOf("Achievements"))`; drop the `achReturn` assignment in
   `menuOptions` (~L2366); drop the field from the `game.menu` literal (~L3472) + reset (~L3542); update
   the L2428 comment.
5. **Titles (FLAG-5a, best-guess):** leave `drawOptionsMenu`'s `"OPTIONS"` (~L5114) as-is; `drawRootMenu`'s
   `PAUSED`/`MENU` ternary (~L5102) now only ever hits `PAUSED` — leave it harmless or simplify. Note the
   `game.state`-based `"MENU"`-vs-`"OPTIONS"` title as a one-line knob if Paul wants the old label on system entry.
6. **(FLAG-5b) Within-Options order** — leave `MENU_OPTIONS` order as-is unless Paul calls a reorder
   (dispatch is by label, so order is free).

**Paste-ready Claude Code prompt:**
```
ultrathink. Read CLAUDE.md + STATUS.md. Single file, no auto-push. This is an information-architecture
refactor of the menu tree. The BACK-PATH logic is the trap: get "Back from Options" wrong and navigation
dead-ends. Test both entry contexts.

Goal (FORK-CS012-C resolved (a)): from title/gameover, O opens OPTIONS directly — no intermediate MENU
dialog. Pause stays Continue/Options/Quit. Achievements lives ONLY inside Options. MENU_ROOT_SYS and the
achReturn tracker retire.

Re-grep: openPause (~L2282); the O-key open (~L2122  k==="o" && (title|gameover) && !game.entry) and pad-B
(~L2182/2185); MENU_ROOT_SYS/MENU_ROOT_PLAY/rootItems (~L2235/2238/2239); menuRoot (~L2341, its
Achievements achReturn="root" ~L2349 and Back ~L2351 branches); menuOptions (~L2359, its Achievements
achReturn="options" ~L2366 and Back ~L2369/2371); menuAchievements back (~L2421, the achReturn conditional);
the game.menu literal init (~L3472) + reset (~L3542) with achReturn; drawRootMenu title ternary (~L5102);
drawOptionsMenu title (~L5114); closePause (~L2294); gotoScreen (~L2309).

1) openPause(): set game.menu.screen = game.state === "playing" ? "root" : "options";  (rest unchanged).
2) menuOptions "Back" (both the confirm-label branch and the a==="back" branch): 
   if (game.state === "playing") gotoScreen("root", rootItems().indexOf("Options")); else closePause();
3) Remove MENU_ROOT_SYS; make rootItems() return MENU_ROOT_PLAY. Delete menuRoot's Achievements branch
   (achReturn="root") and its system-menu "Back" branch (both only ran for the retired system root).
4) menuAchievements back: always gotoScreen("options", MENU_OPTIONS.indexOf("Achievements")). Drop the
   achReturn="options" assignment in menuOptions; drop achReturn from the game.menu literal and its reset;
   fix the stale achReturn comment.
5) Leave drawOptionsMenu title "OPTIONS" and the (now PAUSED-only) drawRootMenu ternary as-is (harmless).
   Do NOT reorder MENU_OPTIONS.

Headless test (drive the REAL open/nav handlers by pushing menuInput actions; no reimplementation):
  - From game.state="title": openPause() lands on screen "options" (NOT "root"); menuInput("back") from
    Options closes the overlay (game.paused false, screen null) — back to title.
  - From game.state="gameover": same — O→Options directly, Back→closes to gameover.
  - From game.state="playing": openPause() lands on "root"; root shows Continue/Options/Quit; selecting
    Options → "options"; Back from Options returns to "root" (NOT closePause).
  - Achievements: reached ONLY via Options (from title AND from pause); its Back always returns to Options
    with the cursor on "Achievements". No path sets/reads achReturn (grep the source: achReturn gone).
  - rootItems() never returns an Achievements/Back system row; MENU_ROOT_SYS is undefined.
node --check clean; startGame()/update(1/60) headless no-crash. No push. Give me the commit message.
```

**Session setup:** `/model opus` (Opus 4.8; `high`; `ultrathink` baked into the prompt for the back-path
logic). IA refactor with a load-bearing navigation edge.

**Test expectations:** as embedded — O→Options direct from title/gameover with Back closing the overlay;
pause root intact with Back returning to root; Achievements single-parent; `achReturn`/`MENU_ROOT_SYS` gone.

**Doc note:** GDD §2 (menus/UI) — the three dialogs are now: Pause = `Continue/Options/Quit`; title/gameover
`O` → **Options directly**; Achievements lives once, under Options; `achReturn` retired. GDD Architecture Map
menu rows. CLAUDE.md if it describes the menu tree / `achReturn`. STATUS.md. (Version bump: not here unless
Paul moves it — recommended in P5.)

**Commit message:** `CS012 P4: Menus — collapse system root, Options as sole hub, retire achReturn (FORK-CS012-C a)`

---

## Phase 5 — Auto-shield difficulty option (Group D, §4)

**Goal:** an opt-in, default-off accessibility lever — when hull is **critical**, a hit that would land is
auto-absorbed by the shield (reactive, on the frame), costing energy + a visible **-500** score penalty and
a stun/knockback that rate-limits it. New `settings.autoShield`, a Difficulty-screen row with a per-row help
line, and the `damageShip` hook. **Depends on P4** (its row lands in the settled menu tree).

**Exact work:**
1. **New constant `AUTO_SHIELD_SCORE_PENALTY`** (playtest knob, `500`), near the `SHIELD_*` constants (~L127–130).
2. **`settings.autoShield`** default `false`; persist **additively** (FLAG-4c, the `captions` idiom):
   `saveSettings` writes it; `loadSettings` does `if (typeof data.autoShield === "boolean") settings.autoShield
   = data.autoShield;` (missing/non-boolean → stays `false`; no schema bump on frozen `afd_settings_v1`).
3. **The hook — top of `damageShip`, ABOVE the early-return** (~L4226/4228). Full condition (FINDING-D1,
   includes `!s.dead`):
   `settings.autoShield && !s.dead && !s.shieldOn && s.invuln <= 0 && s.hp <= LOW_HP_THRESHOLD && s.energy >= SHIELD_HIT_COST`.
   When it fires, behave like **one hit minus the HP** (FLAG-4b, load-bearing):
   - `s.energy = Math.max(0, s.energy - SHIELD_HIT_COST)`;
   - apply the **same** knockback + stun the real-hit body uses (copy the `shortDelta`→`atan2`→
     `vx/vy = KNOCKBACK_SPEED` shape at ~L4238–4245) and `s.invuln = HIT_STUN_DURATION`;
   - `s.shieldOn = true` (visible flash; makes concurrent-hazard `damageShip` calls this frame no-op via the
     shielded early-return → at most one save/frame);
   - **penalty, bypassing `addScore`** (FINDING-D3/FLAG-4e): `game.score = Math.max(0, game.score -
     AUTO_SHIELD_SCORE_PENALTY)`; **do not touch `game.nextRepair`**; leave a comment marking this the
     deliberate exception to the "all scoring through `addScore`" rule;
   - push a red tell: `FloatText("-" + AUTO_SHIELD_SCORE_PENALTY, s.x, s.y, COLOR.lowhp)`;
   - deal **0 HP** and **`return false`** (same contract the shielded early-return returns; FINDING-D2).
4. **Difficulty row** (~L2438–2455, ~L5163–5200):
   - `DIFFICULTY_ROWS` → `["shot","magnet","autoshield","back"]` (string-keyed nav — Back stays robust).
   - `menuDifficulty` left/right: add `else if (row === "autoshield") { settings.autoShield =
     !settings.autoShield; saveSettings(); AudioSys.ui(false); }` (toggle either direction, matching the
     shot/magnet toggle idiom).
   - `drawDifficulty`: add the auto-shield row (label + `Off | On`), grow `menuPanel(620, 360, …)` height for
     the extra row, and move the `Back` index/`y` + the trailing help lines down accordingly.
5. **Per-row help line (FLAG-4f, best-guess general):** a line below the rows showing the **focused** row's
   one-liner, updating as the cursor moves. Auto-shield: *"Auto-raises shield at critical hull. -500 points
   per blocked hit."* The existing shot/magnet rows may gain brief one-liners too (consistency; scope to
   auto-shield only if Paul prefers — flag). Optional non-focusable `"?"` marker at the row end is a look-call
   — skip unless asked; the help line carries the text (no new nav stop, no popup — the whole point of not
   doing the focusable "?").

**Paste-ready Claude Code prompt:**
```
ultrathink. Read CLAUDE.md + STATUS.md. Single file, no auto-push. Builds on P4's settled menu tree. The
damageShip hook is the load-bearing part: the stun+knockback is what rate-limits the auto-save to one per
~1s — without it a hazard on the ship drains energy+score every frame.

Re-grep: SHIELD_DRAIN/SHIELD_RECHARGE/SHIELD_HIT_COST (~L127-129); damageShip (~L4226) and its early-return
if (s.dead || s.shieldOn || s.invuln > 0) return false; (~L4228) and the hit body's knockback+stun
(shortDelta/atan2/KNOCKBACK_SPEED; s.invuln = HIT_STUN_DURATION, ~L4238-4245); the hazard call sites (bullet
~L4920, Hunter  const applied = damageShip(...)  ~L4953, saucer ~L4968); LOW_HP_THRESHOLD (~L173);
HIT_STUN_DURATION/KNOCKBACK_SPEED (~L171-172); addScore + nextRepair (~L3610/3613); FloatText (~L3375);
COLOR.lowhp; settings + saveSettings/loadSettings (captions idiom); DIFFICULTY_ROWS (~L2438), menuDifficulty
(~L2439), drawDifficulty (~L5163, menuPanel(620,360)).

1) const AUTO_SHIELD_SCORE_PENALTY = 500; // PLAYTEST KNOB — score lost per auto-save. Flat (FLAG-4d).
   near the SHIELD_* constants.
2) settings.autoShield default false; saveSettings writes it; loadSettings:
   if (typeof data.autoShield === "boolean") settings.autoShield = data.autoShield;  (no schema bump).
3) At the TOP of damageShip, before the early-return, add:
   if (settings.autoShield && !s.dead && !s.shieldOn && s.invuln <= 0 && s.hp <= LOW_HP_THRESHOLD
       && s.energy >= SHIELD_HIT_COST) {
     s.energy = Math.max(0, s.energy - SHIELD_HIT_COST);
     // same knockback+stun as a real hit (copy the body's shortDelta/atan2/KNOCKBACK_SPEED; set invuln):
     <apply knockback away from srcX/srcY exactly as the hit body does>
     s.invuln = HIT_STUN_DURATION;
     s.shieldOn = true;
     // penalty BYPASSES addScore by design (do NOT touch game.nextRepair — see FLAG-4e / CLAUDE.md):
     game.score = Math.max(0, game.score - AUTO_SHIELD_SCORE_PENALTY);
     game.floaters.push(new FloatText("-" + AUTO_SHIELD_SCORE_PENALTY, s.x, s.y, COLOR.lowhp));
     return false; // 0 HP dealt; same contract as the shielded early-return
   }
4) Difficulty row: DIFFICULTY_ROWS -> ["shot","magnet","autoshield","back"]; menuDifficulty left/right adds
   an "autoshield" branch toggling settings.autoShield + saveSettings(); drawDifficulty adds the row
   (label + Off|On), grows the panel height, and shifts Back + the help/hint lines down.
5) Add a per-row help line under the Difficulty rows showing the FOCUSED row's description; the auto-shield
   line reads: "Auto-raises shield at critical hull. -500 points per blocked hit." (shot/magnet may get brief
   lines too). No focusable "?" cell, no popup.

Headless test (drive the REAL damageShip / saveSettings / loadSettings / menuDifficulty; no reimplementation):
  - autoShield OFF: a critical-hull hit deals full HP damage (unchanged baseline).
  - autoShield ON, s.hp <= LOW_HP_THRESHOLD, energy >= SHIELD_HIT_COST: the hit deals 0 HP, returns false,
    spends SHIELD_HIT_COST, sets s.shieldOn true, sets s.invuln = HIT_STUN_DURATION, applies knockback
    velocity, subtracts AUTO_SHIELD_SCORE_PENALTY from game.score (clamped at 0), and does NOT change
    game.nextRepair; a "-500" floater is pushed.
  - Rate-limit: a second damageShip on the SAME frame is a no-op (shieldOn early-return); with invuln active,
    subsequent-frame hits are absorbed by the i-frame until it lapses. Energy recharge (0.12/s) < cost
    (0.22/save) => after ~4-5 saves energy < SHIELD_HIT_COST and hits land normally.
  - autoShield ON but hp ABOVE LOW_HP_THRESHOLD => normal full damage (no auto-save). Dead ship (s.dead) =>
    no auto-save.
  - autoShield round-trips through afd_settings_v1 (save->load); missing/non-boolean => false; default false.
  - DIFFICULTY_ROWS includes "autoshield"; menuDifficulty toggles it both directions and saves.
node --check clean; startGame()/update(1/60) headless no-crash. No push. Give me the commit message.
```

**Session setup:** `/model opus` (Opus 4.8; `high`; `ultrathink` for the hook/rate-limit). Load-bearing mechanic + a mechanical UI row.

**Test expectations:** as embedded — 0-HP auto-save with energy/score/stun/knockback/tell, one-per-window
rate-limit, energy self-limit, off-by-default balance untouched, additive persistence, Difficulty toggle.

**Doc note (final CS012 doc pass — do it here):**
- GDD §2 — auto-shield: reactive at critical hull, `SHIELD_HIT_COST` energy + `AUTO_SHIELD_SCORE_PENALTY`
  penalty + stun/knockback rate-limit, default off, additive `settings.autoShield`; the Difficulty screen's
  new row + per-row help line.
- GDD scoring section — note the deliberate `addScore` **bypass** for the penalty (FLAG-4e).
- GDD Architecture Map — `damageShip` (auto-shield hook), Difficulty menu rows, `settings`/persistence.
- **CLAUDE.md** — the "all scoring through `addScore`" non-negotiable gains the documented penalty exception;
  frozen-keys bullet notes the additive `autoShield` field.
- **GDD §7 → `GDD-VERSION-HISTORY.md`** — prepend the newest-first CS012 entry (P1–P5 summary). Requires the
  (unattached) history file in the session.
- **Version:** bump `GAME_VERSION` `"1.0.0.11" → "1.0.0.12"` (last player-visible phase) + confirm the
  title-screen display string; update any test that hardcodes the version literal.
- STATUS.md — CS012 complete; "Changed this session" lists P1–P5.

**Commit message:** `CS012 P5: Auto-shield difficulty option (reactive, -500/save) + Difficulty row; GAME_VERSION 1.0.0.12; CS012 docs`

---

## Session hygiene (every CS012 phase)

- **Attach** (fresh-pulled): `asteroids-deluxe.html`, `ORBITAL-OVERHAUL-GDD.md`, `STATUS.md`, `CLAUDE.md`,
  `PLANNED-FEATURES-CS012.md`, and this file. For P5's doc pass also attach `GDD-VERSION-HISTORY.md`.
- **Re-grep before editing** — anchors drift; each prompt re-confirms its symbols. Prior sessions found
  plan/code conflicts; this is non-negotiable. (This doc's §0 was grepped against the attached CS011 P5
  build, but re-verify — P4 moves menu anchors that P5 depends on.)
- **No auto-push.** Claude Code delivers the diff + a passing headless test + the commit message; **Paul
  commits and pushes.**
- **Frozen `afd_settings_v1` / `afd_scores_v1` / `afd_achievements_v2`** — every new field
  (`autoShield`, `maxChainVisit`) is additive, known-value-else-default, no schema bump. **Named invariant
  guards and the AudioSys / MusicSys / VoiceSys buses are untouched** — no CS012 item names one.
- **No new fills** — Group A's `drawRingSegments` strokes; it removes the SCOOP-pip fill rather than adding
  one. No other item touches the render rules.
- **No lab, no port-verbatim dependency** this changeset — CS012 is instrument-free (the one lab-dependent
  option, §3's Dan line, was deferred out). If a future session opens that, it re-enters the
  `voice-robot-lab` → port-verbatim discipline.
- **A phase isn't done until its headless test passes** — extract the `<script>` → `node --check` → stub
  `window`/`document`/`rAF`/`localStorage` → drive the REAL functions (`startGame()`/`update(1/60)`), never
  reimplement the logic. Use the fake-ctx stub for `ctx === null` no-crash, and the recording-canvas /
  advanceable-clock idioms the prior CS tests established.
- **Sequencing:** P4 (menu) before P5 (auto-shield row). P1/P2/P3 are independent and can ship in any order
  (this doc orders them B→A→C by ascending size).