# IMPLEMENTATION PHASES — CS032: Save Game / Load Saved Game / 3 Slots

**Baseline:** `faa8d35`, `GAME_VERSION` `1.0.0.31`. Target on close: **`1.0.0.32`**.
Companion spec: `PLANNED-FEATURES-CS032.md`. ⛔ **Read the spec's §3 fork resolutions before P1** —
this document assumes **A=save-moment values, F=resumedRun ineligibility flag**, B→a, C→b, D→a,
E→a, G→a, H→b, I→no.

⛔ **If you have an earlier draft of this document:** the data model changed. There is no
`game.checkpoint` field and no wave-boundary capture. Save reads the live run once, when pressed.
P1 is smaller than the earlier draft; a new `resumedRun` flag (P2) replaces the earlier draft's
score-exploit defense.

**One phase per Claude Code session. One commit per phase. Claude Code commits, never pushes.**

⛔ **CS033 boundary.** No network, no sync, no leaderboard. If a phase surfaces a decision that only
makes sense in service of online play, **stop and flag** — that is the CS033 seam.

⛔ **Snapshot boundary.** No ship position, no entity arrays, no in-flight timers, ever. The `kind`
field is the *only* concession to future snapshotting. If a phase wants to add a field "so
snapshotting can use it later," **stop and flag** — that is scope creep wearing a forward-compat hat.

⛔ **Grep every symbol before editing. Never navigate by line number.** Line numbers in the spec are
`faa8d35` hints and will have drifted by P3.

---

## Phase map

| P | Title | Model / effort | Ships |
|---|---|---|---|
| P1 | `SaveSlots` store + save-moment capture | Sonnet | data model, guarded persistence — no restore, no UI |
| P2 | `resumeFromSave()` + `resumedRun` | **Opus, xhigh + `ultrathink`** | the restore path and the eligibility flag, driven entirely by tests |
| P3 | The slots screen | Sonnet | one screen, two modes, no menu wiring |
| P4 | Menu wiring | **Opus, xhigh** | unpick the three-piece idiom; `Load Saved Game` row |
| P5 | Purge + edges | Sonnet | profile-delete integration, storage-failure reporting |
| P6 | ⛔ **PLAYTEST GATE — BLOCKING** | — | Paul plays; answers below |
| P7 | Close | Sonnet | gate answers applied, doc sweep, `1.0.0.32` |

---

## P1 — `SaveSlots` store + save-moment capture

**Model: Sonnet.** Mechanical: a persistence module in the established idiom, plus one pure function
that reads `game` and returns a plain object. No restore logic, no menu, no `game.*` field changes.

### Behavioural contract

**1. A `SaveSlots` module**, following `Profiles`' own shape.

- `SAVES_KEY = "afd_saves_v1"` — a **new** key. ⛔ Not one of the four existing keys; not a schema
  bump on any of them.
- Routed through `Profiles.keyFor(SAVES_KEY)` at **both** the read and the write site. Per-profile.
- Envelope: `{ v: 1, slots: [null|entry, null|entry, null|entry] }`.
- Entry: `{ kind: "wave", saved: <epoch ms>, profileName: <string>, wave, score, hp, nextRepair,
  scoopLevel, scoopHits, powerBudget, stats, debugRun }`.
  - `kind` per spec FORK-H — the forward door. A reader that doesn't recognise a `kind` treats the
    slot as **unreadable**, which renders distinctly from **empty** (P3).
  - `profileName` is a display convenience stamped at write time, mirroring `HighScores`' additive
    stamps. Never authoritative — the slot's identity is its key.
- `read()` / `write(i, entry)` / `clear(i)` / `count()`, all guarded in the established idiom
  (`storageOK()`, try/catch, never crash).
- ⛔ **Known-value-else-default on every field.** Absent, unreadable, corrupt, wrong-`v`, wrong-length
  array, and non-array all resolve to three empty slots. No throw, no `else`-branch on an
  unrecognised value.
- ⛔ `write()` returns a **boolean success**. Spec §4.4 — a failed save must be reportable. This is
  the one place the guarded idiom is extended rather than copied, and the reason is that Save is a
  player-initiated act, not a background write.
- ⛔ **Lazy.** Nothing reads slots at boot. `SaveSlots` is not called from `Profiles.init()` and does
  not participate in boot ordering.

**2. A `buildSaveEntry()` function** — the entire "capture" half of this changeset. Pure: reads
`game`, returns a plain object, mutates nothing.

```
buildSaveEntry() → {
  kind: "wave", saved: Date.now(), profileName: Profiles.nameOf(Profiles.activeId),
  wave: game.wave, score: game.score, hp: game.ship.hp, nextRepair: game.nextRepair,
  scoopLevel: game.scoopLevel, scoopHits: game.scoopHits,
  powerBudget: { ...game.powerBudget },
  stats: { ...game.stats, powerUsed: { ...game.stats.powerUsed } },  // deep copy — see below
  debugRun: game.debugRun
}
```

⛔ **Copy semantics are load-bearing.** `game.stats.powerUsed` is a nested object; a shallow spread
of `game.stats` alone leaves `powerUsed` **aliased** to the live run. A slot holding a live reference
stops being a snapshot the instant the player resumes play — it silently rewrites itself as the run
continues. Every other field on the entry is a primitive and a shallow copy is correct for it.
`powerBudget` is flat (five numeric keys) — a shallow spread is sufficient there.

⛔ **Deliberately absent from the entry:** `game.checkpoint` (does not exist — see the header note),
`cargoMax`/`worldSize` (both derived from `wave` by `nextWave()` on resume — storing them creates a
second source of truth that can disagree), entity arrays (`chain`/`garbage`/`debris`/etc. — spec
FORK-G), `powerBank`/`powerBankAmt` (flash-display state, meaningless outside the frame it was set),
`magnetHoldT`/`cargoWasFull`/`comboGrace`/`sweepPause`/`deliveryCount` (all in-flight, meaningless at
a wave start), `resumedRun` (P2's field — capturing it would let a resumed-then-resaved run silently
regain eligibility on the *next* reload, exactly the hole spec §4.1 forbids; every resume forces it
`true` regardless of what a prior slot held).

**Where `buildSaveEntry()` lives and who calls it:** P1 defines it; nothing calls it yet.
`buildSaveEntry()` has no dependency on the menu, so it is fully testable here in isolation. P3 wires
it to the `"Save"` confirm.

### Do not touch

⛔ `MENU_ROOT_PLAY`, `menuRoot()`, `drawRootMenu()`, `MENU_TITLE`, `titleMenuLayout()`,
`startGame()`, `nextWave()`, `removeProfileStores()`, `blankLegacyStores()`. P2, P4, P5.

⛔ Do not add a `slots` field to `Profiles.roster` entries. Spec FORK-C and §0.3 — that door is
declined deliberately, not overlooked.

⛔ Do not add `game.resumedRun` this phase. It is P2's field and P2's invariant (both-places rule);
adding it here with no restore path to set it true would leave it permanently dead code.

### Tests — `scratchpad/test-cs032-p1.js`

Use `_harness.js`; `_phase-ref.js` for any git pin, skipping loudly on a shallow clone.

- §A `buildSaveEntry()` against a seeded live run matches every field 1:1.
- §B ⛔ Non-aliasing: call `buildSaveEntry()`, then mutate `game.stats.powerUsed.rapid` and
  `game.powerBudget.rapid` on the live run — the returned entry is unchanged.
- §C `debugRun` captured true when the run was started via `DEBUG.startLevel > 1`.
- §D Round-trip through a stubbed store: `write` → `read` → deep-equal.
- §E Corruption matrix — absent key, `"{"`, `{v:2}`, `{v:1,slots:"x"}`, `{v:1,slots:[]}`,
  `{v:1,slots:[{kind:"snapshot"}]}` — all resolve without throwing; the last renders as *unreadable*,
  not *empty*.
- §F Per-profile isolation: write under profile A, activate B, read → three empties.
- §G `write()` returns false when the store throws.

---

## P2 — `resumeFromSave()` + `resumedRun`

**Model: Opus, xhigh, `ultrathink`.** Two ordering invariants and one new sticky flag, and the
flag's *reason for existing* is what keeps FORK-A's save-moment values safe. Take the time.

### Behavioural contract

**A sibling of `startGame()`, not a branch inside it.** `startGame()` stays untouched except for one
addition (below).

⛔ **Share the reset, don't duplicate it.** Spec Risk 5. Extract `startGame()`'s entity-clearing and
field-zeroing into a shared reset that both call, or have `resumeFromSave()` call `startGame()` and
overwrite — either is acceptable, **a hand-copied third reset is not**. This project has been bitten
by duplicated reset lists before; that is what the both-places rule exists to patch.

Whichever shape is chosen, the resulting order must be:

1. Full reset to fresh-run state — arrays emptied, latches cleared, `applyWorldSize(WORLD_SIZE_FIELD)`,
   `new Ship()`, `VoiceSys.reset()`. Identical to a fresh run.
2. Overwrite from the loaded entry: `score`, `ship.hp`, `nextRepair`, `scoopLevel`, `scoopHits`,
   `powerBudget`, `stats`, `debugRun`.
3. ⛔ `game.wave = entry.wave - 1`, **from the entry, never from `DEBUG.startLevel`**.
4. ⛔ `game.resumedRun = true` — unconditional, every call, no exceptions. **The new invariant this
   phase adds.**
5. `nextWave()`.

⛔ **INVARIANT — step 2 precedes step 5.** `nextWave()` reads `game.stats.powerupsPicked` to gate
`Achievements.lifetime.maxWaveNoPowerup`. Restore stats *after* and it reads a fresh-zeroed counter,
wrongly crediting the resumed level *in memory*. Spec §2.6 — this can no longer corrupt a persisted
record (step 4 already blocks that), but it can still produce a wrong same-session toast. Get the
order right anyway.

⛔ **INVARIANT — `game.hudHull` follows restored HP.** `startGame()` sets it from a full-HP ship. A
resume at 30 HP that leaves `hudHull` at 1 plays a phantom drain animation on the first frame.

**Ship HP** is set on the `new Ship()` from step 1, after construction.

**Level announcement:** `nextWave()`'s voice line and banner fire normally. Correct — the player
wants to know where they landed.

⛔ **Nothing is cleared from the loaded slot.** Spec FORK-D.

### The `resumedRun` flag itself

**1. Add `game.resumedRun: false`** to the `game` object literal, beside `debugRun`.

**2. Add `game.resumedRun = false`** to `startGame()`'s reset, beside its own `debugRun` line. ⛔
Both-places rule — a field in only one of the two reads `undefined` for a whole run.

**3. `resumeFromSave()` sets it `true`** — step 4 above. This is the **only** site that ever sets it
true, and the **only** site that needs to; nothing else in the build creates a resumed run.

**4. Wire the two persistence gates**, exactly as spec §2.7 specifies:

| Site | Before | After |
|---|---|---|
| `Achievements.save()` | `if (game.debugRun) return;` | `if (game.debugRun \|\| game.resumedRun) return;` |
| Initials-entry arm | `!game.debugRun && HighScores.qualifies(...)` | `!game.debugRun && !game.resumedRun && HighScores.qualifies(...)` |

⛔ **Do not touch anything else in either function.** Both sites gain exactly one clause.

**5. Wire the HUD tell**, spec §2.8:

```js
if (game.debugRun) drawText("DEBUG RUN", VIEW_W / 2, 18, 14, COLOR.dim, "center");
else if (game.resumedRun) drawText("RESUMED RUN", VIEW_W / 2, 18, 14, COLOR.dim, "center");
```

⛔ Mutually exclusive — `debugRun` wins if both are true. This is the same spot the existing tag
occupies; there is no second draw call and no layout change.

⛔ **Do not build a "clear `resumedRun` once the player passes their load point" path.** Spec §4.1,
§3 FORK-F — it reopens the score-banking hole this flag exists to close, because the banked
component of `game.score` from before the load can't be separated out after the fact. Sticky for the
run's lifetime, exactly like `debugRun`.

### Do not touch

⛔ All P4/P5 sites. ⛔ Do not modify `nextWave()`'s achievement writes "to make resume safer" — the
ordering (step 2 before step 5) is the fix, not a guard inside `nextWave()` itself.

### Tests — `scratchpad/test-cs032-p2.js`

- §A Save-moment values round-trip: seed a mid-level run (arbitrary score/hp/stats/scoopLevel),
  `buildSaveEntry()`, `resumeFromSave()` on the result → every restored field matches exactly, and
  `game.wave` equals the entry's `wave` (not `wave + 1`, not `wave - 1`).
- §B ⛔ `debugRun` round-trips true when the entry carries it, independent of `resumedRun`.
- §C ⛔ `game.resumedRun === true` after **every** `resumeFromSave()` call, unconditionally — assert
  across three different entries, including one where the source run had `debugRun: false`.
- §D ⛔ Ordering: seed `stats.powerupsPicked = 3` in the entry, resume at wave 12, assert
  `Achievements.lifetime.maxWaveNoPowerup` did **not** advance to 12.
- §E ⛔ `Achievements.save()` returns without writing when `game.resumedRun` is true, even with
  `game.debugRun` false and a real unlock pending.
- §F ⛔ Game-over after a resumed run: `game.entry` is `null` even when `HighScores.qualifies(score)`
  is true.
- §G HUD: `resumedRun` true + `debugRun` false → `"RESUMED RUN"` renders. Both true → `"DEBUG RUN"`
  renders and `"RESUMED RUN"` does not.
- §H `hudHull` equals `hp / SHIP_MAX_HP` immediately after resume.
- §I `DEBUG.startLevel = 40`; resume a wave-5 entry → `game.wave === 5`, `debugRun` per the entry.
- §J Resume then run `update(1/60)` for 120 frames without throwing.
- §K Anti-drift pin (spec Risk 5): a resumed run and a fresh `startGame()` run at the same level have
  identical *derived* state (`cargoMax`, `worldSize`).
- §L Starting a brand-new game after a resumed one: `startGame()` resets `resumedRun` to `false`.

---

## P3 — The slots screen

**Model: Sonnet.** Mechanical UI against three established idioms.

### Behavioural contract

**One screen, `"slots"`, two modes.** `game.menu.slotMode` = `"save"` | `"load"`, set by the caller
— the direct precedent is CS031's `nameCtx` ("one screen, caller sets what commit does").

⛔ **`slotMode` obeys the both-places rule** — `game` literal *and* `startGame()`'s `game.menu`
reset. A field in only one reads `undefined` for a whole run.

Register in `menuInput()`'s dispatch switch and in the draw dispatch, beside `"profiles"`.

**Rendering** follows `drawProfiles()` — same panel, row step, `"▶ "` prefix, `COLOR.text` /
`COLOR.menuIdle`, shared `drawMenuHint()` footer. Three rows, fixed; no scroll (three never
overflows).

Row states:

| Slot | Renders | `"save"` | `"load"` |
|---|---|---|---|
| Empty | `1.  — EMPTY —` | selectable | dim, inert |
| Occupied | `1.  LEVEL 12 · 48,300 · 3 days ago` | selectable, **confirms** | selectable, loads |
| Unreadable | `1.  — UNREADABLE —` | selectable (overwrites) | dim, inert |

⛔ The occupied row shows the level and score the slot holds — under FORK-A these are the values the
run actually held the instant `"Save"` was pressed, so this is a literal, honest readout of what
loading will restore.

**`"save"` confirm calls `buildSaveEntry()` (P1) and `SaveSlots.write()`.** Overwrite uses
`openModal()` — same idiom as profile Delete. Copy names what is lost: the existing slot's level, not
the incoming one.

**`"load"` confirm calls `SaveSlots.read()` for that slot and `resumeFromSave()` (P2)**, then returns
to gameplay — `game.state = "playing"`, menu closed.

**Save success/failure:** on `write()` false, show a failure message on the screen and stay put.
⛔ Never return to the pause menu as though it worked (spec §4.4).

**Save success:** return to the pause root, not straight into play. The player opened a menu; drop
them where they were.

**Back** returns to whichever screen opened it.

### Do not touch

⛔ `MENU_ROOT_PLAY`, `MENU_TITLE`, or either menu's dispatch. P4 wires this screen up; P3 only builds
it. The screen is reachable this phase **only** from a test harness. That is intentional — it keeps
the screen's correctness separable from the idiom-unpicking in P4.

### Tests — `scratchpad/test-cs032-p3.js`

- §A Nav wraps across three rows in both modes.
- §B `"load"` mode: confirm on an empty row is inert — no state change, no screen change.
- §C `"save"` on an occupied row raises a modal; cancel leaves the slot untouched; confirm writes via
  `buildSaveEntry()`.
- §D `"save"` on an empty row writes with no modal.
- §E A `kind: "snapshot"` slot renders unreadable and is inert in `"load"`.
- §F Failed `write()` leaves the screen open with a failure state set.
- §G `"load"` confirm on an occupied row calls `resumeFromSave()` and returns to `"playing"`.

---

## P4 — Menu wiring

**Model: Opus, xhigh.** Small diff, high coupling. The three-piece unpick is the phase's whole risk.

### Behavioural contract

**1. Make `"Save"` live — all three pieces, one commit.**

| # | Symbol | Change |
|---|---|---|
| 1 | `MENU_ROOT_PLAY` | **unchanged** — label and position both stay |
| 2 | `menuRoot()` confirm chain | add a `"Save"` branch → `gotoScreen("slots")` with `slotMode = "save"` |
| 3 | `drawRootMenu()` | ⛔ **delete the `it === "Save" ? COLOR.dim : ...` ternary** |

⛔ **Piece 3 is the one that gets forgotten**, and forgetting it is silent: the row works and renders
permanently grey. Spec §2.1. The test asserts the *colour*, not just the dispatch.

⛔ **`MENU_ROOT_OVER` does not gain a `"Save"` row.** CS016 P4's note stands: there is no run left to
save at game over.

⛔ **Delete the CS016 P4 comment block** that describes `"Save"` as a placeholder, and the
`unavailable-row idiom` cross-references at `menuRoot()` / `drawRootMenu()` that point at it. Three
other sites cite `MENU_ROOT_PLAY`'s `"Save"` as the *canonical example* of the idiom
(`menuProfiles()`'s `Add Profile` cap, `drawProfiles()`, and the `MENU_TITLE` region) — ⛔ **grep for
every citation and repoint them at `Add Profile`**, which remains a true example. Leaving them
pointing at a now-live row is how a comment becomes a lie.

**2. Add `"Load Saved Game"` to `MENU_TITLE`.**

Position: after `"Start Game"`. Rationale — it is a *start a run* verb and belongs with its sibling;
`"Profile"` onward are configuration.

⛔ **No layout edit.** `titleMenuLayout(n)` derives Y and step from `MENU_TITLE.length`;
`test-cs031-p5.js` already pins N=6. If this phase finds itself editing `TITLE_MENU_TOP`,
`TITLE_MENU_BOTTOM`, `TITLE_MENU_MARGIN` or `TITLE_MENU_STEP_MAX`, **stop** — those are gate-confirmed
knobs and something else is wrong.

`menuTitle()` dispatches by label; add a branch → `gotoScreen("slots")` with `slotMode = "load"`.

**3. `"Load Saved Game"` uses the unavailable-row idiom when no slot is occupied.**

⛔ Present, dim, inert — never hidden. Hiding it would make the title menu's row count vary with save
state, and the derived layout would shift the whole block vertically (spec §4.3).

⛔ **Recomputed on every entry to the title menu**, not cached — a profile switch or a profile delete
changes the answer. `drawTitleMenu()` asks `SaveSlots.count() === 0` at draw time; `menuTitle()`'s
branch checks the same before navigating.

⛔ **`drawTitleMenu()` now has two special-cased rows** — `"Profile"` (renders `Profile: NAME`) and
this one. Keep both label-driven; do not introduce an index.

### Tests — `scratchpad/test-cs032-p4.js`

- §A ⛔ `drawRootMenu()` renders `"Save"` in `COLOR.text` when selected — the piece-3 pin.
- §B Confirm on `"Save"` opens `"slots"` with `slotMode === "save"`.
- §C `MENU_ROOT_OVER` contains no `"Save"`.
- §D `MENU_TITLE.length === 6`; `titleMenuLayout(6)` matches the value `test-cs031-p5.js` pinned.
- §E Zero slots → title row dim and confirm inert; write one → live.
- §F Every remaining `unavailable-row idiom` comment citation names a row that is still inert.

---

## P5 — Purge and edges

**Model: Sonnet.**

### Behavioural contract

**1. Slots die with their profile — both paths.** ⛔ Spec §2.4; these are genuinely different code.

- `removeProfileStores(id)` — add `ls.removeItem(SAVES_KEY + ":" + id)` beside the two existing
  removes. Same guarded try/catch.
- `blankLegacyStores(keepActiveId)` — clear `p0`'s slots **through the guarded write path**, never a
  raw `removeItem`. `p0`'s keys are frozen and are reset-in-place, matching how settings and
  achievements are handled there.

**2. Profile switch invalidates nothing but is read fresh.** `Profiles.activate()` needs no change —
`SaveSlots` is lazy and reads through `keyFor()` at call time. ⛔ Confirm by test rather than by
inspection: activate A, write, activate B, read → empty.

**3. Deleting the active profile.** `profileDelete()` switches away *before* dropping the roster
entry. Slot clearing must happen on the **deleted** id, not the active one. Reuse the existing
ordering; do not reorder it.

**4. `quitToTitle()` mid-run.** ⛔ Does **not** write a slot. Save is explicit only — no autosave
(spec §1). Confirm `quitToTitle()` is untouched.

### Tests — `scratchpad/test-cs032-p5.js`

- §A Non-legacy delete removes that profile's saves key and no other's.
- §B `p0` delete blanks `p0`'s slots and leaves every other profile's intact.
- §C Deleting the active profile clears the deleted one's slots, not the newly-active one's.
- §D Per-profile isolation across `activate()`.
- §E `quitToTitle()` writes no slot.
- §F Full-suite regression: 122 prior files still pass.

---

## P6 — ⛔ PLAYTEST GATE — BLOCKING

⛔ **No code phase follows until Paul answers.** P7 applies the answers.

Real browser, real `file://` load, not the harness.

| # | Question | Answer format |
|---|---|---|
| **G1** | ⛔ Save at wave 12, quit to title, close the browser, reopen, load. Does the run come back at wave 12 with the score/HP you had when you saved? | pass / fail + what differed |
| **G2** | ⛔ Save, reload the same slot immediately without playing. Then play into wave 13, save again, reload. Both loads land correctly? | pass / fail |
| **G3** | ⛔ Start above level 1 via the debug knob, save, load. Does `DEBUG RUN` still show, and is initials entry still suppressed at game over? | pass / fail |
| **G4** | ⛔ Save mid-level, load, and play to game over with a genuinely high score. Does the `RESUMED RUN` tag show throughout, and is initials entry correctly absent at game over? | pass / fail |
| **G5** | Is `"RESUMED RUN"` the right wording, or does it read as an error rather than an informative state? | keep / change to: ___ |
| **G6** | Slot row copy: `LEVEL 12 · 48,300 · 3 days ago`. Readable at a glance? Right three facts? | keep / change to: ___ |
| **G7** | Title menu at 6 rows — step drops to ≈26.4px. Does the block still read cleanly against the title art, or is it cramped? | `TITLE_MENU_STEP_MAX` value to use (currently 38), or "unchanged" |
| **G8** | Overwrite-confirm copy. Does it clearly say *which* slot is lost? | keep / change to: ___ |
| **G9** | `"Load Saved Game"` dim-and-inert on a fresh profile — reads as "nothing saved yet," or as broken? | reads correctly / change to: ___ |
| **G10** | Is `Save` in the right position in the pause menu (2nd, after `Continue`)? | position index, or "unchanged" |
| **G11** | Three slots — right number? | 3 / other: ___ |

⛔ **G4 is the gate's real question this time.** It is the direct playtest of the mechanism that
makes save-moment values (FORK-A) safe — everything else is polish. A fail here (tag doesn't show,
or initials entry wrongly appears) means P2's eligibility wiring has a gap and P7 does not proceed
until it's fixed.

---

## P7 — Close

**Model: Sonnet.**

1. Apply every G-answer. Knob and copy changes only.
2. `GAME_VERSION` → `"1.0.0.32"`.
3. `STATUS.md` — CS032 ledger entry, version/changeset header, registry and lever counts
   **re-verified by grep, not predicted** (they have historically undershot). Archive CS029's block
   to `log/` if STATUS is carrying more than three changesets.
4. `log/CS032.md` — full P1–P7 build log.
5. `ORBITAL-OVERHAUL-GDD.md` — a save/load section (note the save-moment/`resumedRun` mechanism, not
   just the mechanics of slots) and a version-history entry.
6. `CLAUDE.md` — add the fifth `localStorage` key to the frozen-keys list with its per-profile
   routing noted. ⛔ **Free sweep: delete `tools/orbit-lab.html`** from the Design instruments list
   (spec §0.4 — CS031 flagged it and the sweep missed it).
7. Move `PLANNED-FEATURES-CS031.md` / `IMPLEMENTATION-PHASES-CS031.md` to `archive/`.
8. Full suite on a **full** clone: zero failures, ⛔ **zero skips**.
9. ⛔ Re-verify `MENU_ROOT_OVER` still has no `"Save"` row, and that no comment anywhere still
   describes `"Save"` as a placeholder.

---

## Paste-ready session openers

**P1**
> Read `PLANNED-FEATURES-CS032.md` and `IMPLEMENTATION-PHASES-CS032.md` at the repo root, then
> implement **P1 only**. This is the data model and persistence layer: `SaveSlots` plus a pure
> `buildSaveEntry()` that reads live `game` state. No restore logic — that's P2. The one thing worth
> slowing down for is copy semantics: `game.stats.powerUsed` is nested and needs an explicit deep
> copy, not a spread. Grep every symbol; do not navigate by line number. Do not touch any menu, draw,
> or profile-delete site, and do not add `game.resumedRun`. Commit as
> `cs-32 p1: SaveSlots store + buildSaveEntry`. Do not push.

**P2**
> Read both CS032 docs, then implement **P2 only**. `ultrathink`. Two things carry real weight here:
> the restore-ordering invariant (`game.stats` before `nextWave()`), and the new `game.resumedRun`
> flag, which must be forced `true` on every `resumeFromSave()` call with no exceptions and no path
> that ever clears it mid-run. It gates the same two persistence points `debugRun` already gates
> (OR'd in, not replacing), plus its own HUD tag — never `debugRun`'s. Share `startGame()`'s reset
> rather than hand-copying it. Commit as `cs-32 p2: resumeFromSave + resumedRun`. Do not push.

**P3**
> Read both CS032 docs, then implement **P3 only** — the `"slots"` screen, both modes, following
> `drawProfiles()`'s idioms, calling P1's `buildSaveEntry()` on save and P2's `resumeFromSave()` on
> load. The screen is reachable only from tests this phase; P4 wires it up. Do not touch
> `MENU_ROOT_PLAY` or `MENU_TITLE`. Commit as `cs-32 p3: slots screen`. Do not push.

**P4**
> Read both CS032 docs, then implement **P4 only**. `ultrathink`. The `"Save"` row's three-piece
> unavailable-row idiom must be unpicked in all three places in one commit — the forced `COLOR.dim`
> ternary in `drawRootMenu()` is the one that gets missed, and missing it is silent. Grep for every
> comment that cites `"Save"` as the canonical idiom example and repoint them at `Add Profile`. No
> `TITLE_MENU_*` constant changes. Commit as `cs-32 p4: menu wiring`. Do not push.

**P5**
> Read both CS032 docs, then implement **P5 only** — profile-delete purge on both the legacy and
> non-legacy paths, and the edge tests. `removeProfileStores` and `blankLegacyStores` are different
> code and both need the change. Then run the full suite. Commit as `cs-32 p5: purge + edges`.
> Do not push.