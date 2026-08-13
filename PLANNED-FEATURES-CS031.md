# PLANNED-FEATURES-CS031 — Player Profiles

**Baseline (verified by fresh clone, this session):**
`git clone --depth 1 https://github.com/freakingid/ADD-Orbital-Overhaul` →
`9df0180 cs-30 p7: closing phase — gate answers applied, version 1.0.0.30, doc sweep`

- Game file: `orbital-overhaul.html`, **10,429 lines**. Version string `1.0.0.30`.
- `STATUS.md` header: Registry **87**, `LEVERS` **18**, CS030 **closed**, nothing in flight.
- No `PLANNED-FEATURES-CS0##.md` / `IMPLEMENTATION-PHASES-CS0##.md` at root — CS030's pair is in
  `archive/`. CS031 is genuinely next.
- `tools/` holds seven labs: `dock-float-lab.html`, `emblem-lab.html`, `music-lab.html`,
  `sat-art-lab.html`, `scoop-lab.html`, `voice-lab.html`, `voice-robot-lab.html`.

⚠ Every line number below is an **estimate from this session's clone**. Re-grep by symbol name
before editing. Line numbers drift.

**All nine design forks are resolved (Paul, this session). §3 records the Q&A. This is a
build-ready spec — no blocking forks remain.** Resolutions: A=suffix (legacy keys = `p0`'s store),
B=shared scores with an additive `profileId`, C=whole settings blob per-profile, D=pad-grid +
keyboard passthrough at 12 chars, E=migrate silently / ask only on an empty install, F=Rename
ships, G=derived title layout, H=`Profile: NAME` in the row, I=title-only.

---

## §0 CORRECTIONS — things prior notes got wrong

### §0.1 There is no "Save Game" menu row to un-grey — but there *is* a placeholder

Paul's note says *"'Save Game' is available from the Pause dialog. It is currently there, but
grayed-out as disabled."* Half right, and the half that's wrong matters for CS032, not CS031.

The row exists and is labelled **`"Save"`**, not `"Save Game"` (L3167):

```js
const MENU_ROOT_PLAY = ["Continue", "Save", "Options", "Quit"];     // paused mid-game
```

It is the **shared unavailable-row idiom** — three cooperating pieces, all of which CS032 will need
to unpick and none of which CS031 touches:

1. `MENU_ROOT_PLAY` carries the label (L3167).
2. `menuRoot()`'s confirm chain deliberately has **no branch** for it, so confirm falls off the
   chain as a silent no-op — no state change, no `AudioSys.ui()` blip (L4106–4109).
3. `drawRootMenu()` forces `COLOR.dim` **focused or not**, so silence reads as "this row does
   nothing" rather than "nothing happened" (L9165–9167).

⛔ **CS031 does not touch any of the three.** Flagged here only so CS032 inherits an accurate map.
Note also that `MENU_ROOT_OVER` (gameover) deliberately has no Save row and should not gain one.

### §0.2 `afd_achievements_v1` also exists, and it is a fourth key

`CLAUDE.md` names three frozen keys. There is a fourth string in the build: `LEGACY_KEY:
"afd_achievements_v1"` (L6995), read exactly once — in `Achievements.init()`, and **only when no v2
save exists** — to migrate raw counters forward from a pre-v3.0-P7 build.

This is load-bearing for CS031: see §4.3's trap. A brand-new profile must never inherit the v1
legacy blob, and the naive implementation does exactly that.

### §0.3 `tools/orbit-lab.html` is documented in `CLAUDE.md` and does not exist

`CLAUDE.md`'s "Design instruments" list opens with `tools/orbit-lab.html` — orbit geometry. The
directory holds seven labs and that is not one of them; it went with the orbit archetype CS024
excised. Not CS031's business, but it's a one-line doc fix that P7 can sweep for free.

---

## §1 What ships

1. A **`Profiles` module** — roster, active profile, key routing, legacy migration.
2. **Per-profile settings and achievements**, layered on the frozen keys additively.
3. A **profile-switch teardown/reload path** that does not bleed one profile's state into the next.
4. A **name-entry screen** — gamepad grid + live keyboard passthrough.
5. A **Choose Profile screen** — list, Add, Rename, Delete (confirmed), switch.
6. **Title integration** — a `Profile` row, the current name on screen, first-boot routing.

### Explicitly NOT in CS031 (→ CS032)

⛔ Save Game / Load Saved Game / the three save slots. If a phase session surfaces a decision that
only makes sense in service of save slots, **flag and defer** — do not build toward it. The one
concession CS031 makes to CS032 is structural headroom, named in §4.6.

---

## §2 The existing machinery, grepped

### §2.1 The three frozen keys and their read/write sites

| Key | Owner | Save site | Load site | Boot call |
|---|---|---|---|---|
| `afd_settings_v1` | `STORAGE_KEY` L4490 | `saveSettings()` L4494 | `loadSettings()` L4513 | `loadSettings();` L4572 |
| `afd_achievements_v2` | `Achievements.STORAGE_KEY` L6994 | `Achievements.save()` L7197 | inline in `init()` L7219 | `Achievements.init();` L10288 |
| `afd_scores_v1` | `HighScores.STORAGE_KEY` L7272 | `HighScores.save()` L7300 | `HighScores.load()` L7305 | `HighScores.load();` L7319 |

All three route through the one shared guard, `storageOK()` (L4491), and none reads another's key.
That separation is exactly what makes per-key routing tractable.

**`saveSettings()` writes one blob with seven top-level fields** (L4498–4509): `vol` (spread of
`AudioSys.vol`), `bindings` (per-`REBINDABLE` keys/buttons/axis), `musicTrack`, `shipTurnScale`,
`voiceStyle`, `captions`, `autoShield`, and `debug` (spread of `debugShown`, display units).

### §2.2 ⛔ THE BIG ONE: `loadSettings()` applies OVER the live state and mostly has no else-branch

This is the finding that shapes the whole changeset. `loadSettings()` (L4513) is written for a
**cold boot** — "apply saved settings over the shipped defaults, once at startup," as its own call
site comment says. Calling it a second time to switch profiles does **not** do what it looks like it
does. Field by field:

| Field | Missing-value behaviour | Bleeds across a switch? |
|---|---|---|
| `vol.*` | `if (typeof … === "number")` — no else | ⛔ **yes** |
| `bindings.*` | `if (!b) continue` — no else | ⛔ **yes** |
| `musicTrack` | `if (MUSIC_TRACK_VALUES.includes(…))` — no else | ⛔ **yes** |
| `shipTurnScale` | **has an else** → snaps to `SHIP_TURN_SCALE_DEFAULT` | no |
| `voiceStyle` | `if (VOICE_STYLE_VALUES.includes(…))` — no else | ⛔ **yes** |
| `captions` | `if (typeof … === "boolean")` — no else, deliberately | ⛔ **yes** |
| `autoShield` | `if (typeof … === "boolean")` — no else | ⛔ **yes** |
| `debug.*` | per-entry validate-then-`applyDebug` — no else | ⛔ **yes** |

So: player A turns captions off and rebinds thrust to `e`; player B — a fresh profile with an empty
blob — switches in and inherits **captions off and thrust on `e`**, silently. Seven of eight fields
leak.

⛔ **The no-else-branch shape is correct and must not be "fixed."** It is what makes the standing
known-value-else-default rule work: an unknown or absent key leaves the runtime default in place,
which is precisely why removing a field needs no migration shim (`CLAUDE.md`, Save data). The fix is
**not** to add else-branches to `loadSettings()`. It is to **reset the runtime to shipped defaults
before calling it** — §4.3.

### §2.3 ⛔ `Achievements.init()` resets three collections and NOT the counters

`init()` (L7219) explicitly clears `lifetimeUnlocked`, `weeklyUnlocked` and `lifetimeTiers` to empty
before loading. It never touches `this.lifetime` — the twenty cumulative counters, which live in the
object literal at L7075–7095 and are only ever incremented at their event sites.

`loadCounters()` (L7211) then copies **only keys present** in the saved blob:

```js
if (data && data.lifetime) for (const k in this.lifetime)
  if (typeof data.lifetime[k] === "number") this.lifetime[k] = data.lifetime[k];
```

So a re-`init()` for a fresh profile leaves **every one of player A's twenty lifetime counters
intact**, then `deriveLifetime()` (L7161) silently re-derives A's tier badges onto B's profile. B
boots as a Diamond-tier Recycling Magnate having delivered nothing.

⛔ **Same as §2.2, the shape is correct and must not be "fixed."** `loadCounters()` is shared by the
v2 load and the v1 migration by design. The fix is an explicit counter zero before re-init — §4.3.

### §2.4 Boot order is a hard constraint on where the module can live

```
L2806   const bindings          / L2828 DEFAULT_BINDINGS   (pristine snapshot)
L3275   const settings
L3713   function resetAllDebug  / L3716 resetAllDebug();   (seeds debugShown from registry defaults)
L4490   const STORAGE_KEY
L4491   function storageOK
L4572   loadSettings();          ← must already know the active profile
L6137   const game = {
L6991   const Achievements
L7271   const HighScores  /  L7319 HighScores.load();
L10288  Achievements.init();     ← must already know the active profile
```

`Profiles` must be **defined and initialised above L4572** and needs nothing but `storageOK()`. The
slot is immediately above `const STORAGE_KEY` (L4490), with `Profiles.init()` called immediately
before `loadSettings()` (L4572).

`storageOK` is a hoisted function declaration, so it is callable from a module defined above it;
`const Profiles = {…}` is TDZ'd, so the module cannot be defined *below* its own boot call. Define
above, call above.

Note `Profiles.activate()` — the runtime switch — references `Achievements` (L6991), which is
defined *after* the module. That is fine: the reference resolves at call time, and `activate()` is
never called during boot. ⛔ **`Profiles.init()` must not touch `Achievements`.** The boot path
already works: `init()` sets the active profile, and `Achievements.init()` at L10288 reads it.

### §2.5 The test harness's `localStorage` stub has no enumeration

`scratchpad/_harness.js` L305–309:

```js
const localStorageStub = {
  getItem: k => (k in s ? s[k] : null),
  setItem: (k, v) => { s[k] = String(v); },
  removeItem: k => { delete s[k]; },
};
```

No `key(i)`, no `length`, no iteration. ⛔ **The roster must therefore be an explicit key, never
discovered by scanning `localStorage`.** This is a design constraint, not an inconvenience — it also
happens to be the more robust design in a real browser, where the origin is shared with anything
else served from the same file path.

The stub is otherwise fully adequate (`store` is exposed so a test can seed or inspect it — see the
harness header at L230), so profile tests need no harness changes.

### §2.6 Precedents CS031 reuses rather than inventing

| Need | Existing precedent | Where |
|---|---|---|
| Grid cursor (row/col) | Controls rebinding screen | `menuControls` L4409, `drawControlsMenu` L9325 |
| Raw keyboard capture inside a menu | Debug panel numeric entry | keydown L2922–2934 |
| Charset scroller | High-score initials entry | `entryInput` L7324, `SCORES_CHARSET` L440 |
| Destructive confirm | `openModal` | L3990, consumers L4113 / L4376 / L4430 |
| Self-healing panel height | `drawRootMenu` derives `h` from `items.length` | L9148–9160 |
| Scrolling list window | Debug panel `DEBUG_ROWS_VISIBLE` | L3206 |
| A new menu screen | `gotoScreen` + `menuInput` switch + `drawMenu` dispatch | L3952 / L4042 / L9069 |
| Clearing a store without `removeItem` | `resetHighScores()` writes through `save()` | L4399 |

⛔ Every new screen must be added in **three** places or it is half-wired: `menuInput`'s switch
(L4055–4063), `drawMenu`'s dispatch (L9072–9080), and — if it is reachable from the title — a
`closePause()` path that lands back on `titlemenu` (L3918).

---

## §3 Forks — RESOLVED (Paul, this session)

Every fork below is answered. §4's design reflects the answers. Nothing here is left to a phase
session's judgement — if a Claude Code session finds a decision this section does not cover, **stop
and surface it** rather than picking a reading (`CLAUDE.md`, Session rules 3).

### FORK-CS031-A — how do per-profile stores map onto `localStorage`? → **(a) Suffix; the legacy keys ARE the default profile's store.**

Paul's framing (layer additively, migrate existing data into a default profile, no re-key) is
confirmed correct. The open question is the mechanism.

- **(a) Suffix, legacy keys ARE the default profile's store.** `keyFor(base)` returns `base`
  verbatim when the active profile is the default one, else `base + ":" + id`. A new roster key
  `afd_profiles_v1` holds `{ v:1, lastUsed, profiles:[{id,name,created}] }`. Existing data never
  moves, is never copied, and is never rewritten. Migration is: read roster → absent → mint one
  profile whose id marks it as the legacy owner.
- **(b) Suffix for everyone.** Copy the legacy blobs into `afd_settings_v1:p1` etc. at migration,
  leaving the originals in place as an untouched rollback snapshot. Cleaner symmetry; costs a
  duplicate of every store, and the two copies diverge silently the moment an older build is opened.
- **(c) One umbrella key.** `afd_profiles_v1` holds every profile's entire payload as a single blob;
  the legacy keys migrate in once and are never read again.

**Resolved: (a).** (c) is out: it violates `CLAUDE.md`'s "independent stores, none reads another,"
and it rewrites every profile's full payload on every `Achievements.save()` — which fires on every
unlock and every `ACH_SAVE_EVERY` (30 s) tick. (b)'s rollback snapshot is worth less than it sounds,
because the frozen-key invariant already guarantees an older build reads the legacy blob fine under
(a) — the default profile *is* the legacy blob.

**Accepted cost of (a):** deleting the default profile is a special case. It cannot `removeItem` the
frozen keys; it writes empty blobs through the normal `save()` paths, following `resetHighScores()`'s
precedent ("never a raw `removeItem`"). Non-default profiles' keys are not frozen and *are*
`removeItem`'d on delete, so abandoned keys don't accumulate.

### FORK-CS031-B — does `afd_scores_v1` go per-profile? → **(a) No — one shared machine-wide table.**

Paul's note lists what a profile saves: name, weekly achievements, lifetime achievements, options,
save slots. **High scores are not on that list.** Deliberate, or an omission?

- **(a) Machine-wide shared table.** One cabinet, one top-10, initials distinguish players. `HighScores`
  is untouched except for one additive field on new records.
- **(b) Per-profile table.** `HighScores` joins the key-routing scheme.

**Resolved: (a).** It matches the arcade metaphor the whole system is built on, and the initials
entry (`entryInput`, L7324) already answers "who got this score." It is also what the code was
written expecting — `HighScores`' own header (L7264–7270) says a `playerId`/`name` field is "purely
additive whenever login lands. Add fields later; never rename or repurpose one." So (a) lets CS031
stamp `profileId` and `profileName` onto new records for free, giving per-profile *filtering* later
without splitting the store now.

**Accepted cost of (a):** a shared house table means one strong player's ten entries can lock
everyone else off the board. The arcade answer to that is "get better," but it is a real product
call, not a technicality.

### FORK-CS031-C — how much of the settings blob is per-profile? → **(a) The whole blob, debug knobs included.**

`afd_settings_v1` holds eight things (§2.1). Paul's note says "Current Options preferences" go
per-profile; the blob also carries control bindings and the hidden debug knobs.

- **(a) Whole blob per-profile.** Simplest; one key, one route, no split.
- **(b) Whole blob per-profile EXCEPT `debug`,** which stays machine-wide on the legacy key.
- **(c) Split by kind.** Gameplay prefs per-profile; volumes, bindings and debug machine-wide.

**Resolved: (a).** (c) splits one blob across two keys and two code paths in `saveSettings()` /
`loadSettings()`, which is the exact opposite of additive, and it contradicts Paul's own note.

⛔ **Accepted cost, recorded so it is recognised as this and not a bug:** the debug knobs are dev
tooling, not a player preference, and under (a) they travel with the profile. Tuning a lever and
then switching profiles to test the other side of something loses the knob state to whatever that
profile last saved. If that turns out to bite during development, the fix is (b) — carve `debug`
back out onto the machine-wide key — and it is a small, self-contained change. Do not "fix" it
unprompted.

### FORK-CS031-D — how does a player type a name? → **(b) On-screen grid + keyboard passthrough, 12-char cap.**

The build has no text input. It has a 3-slot charset scroller and a raw-keyboard-capture hook, and
nothing else.

- **(a) 3-char initials.** Reuse `entryInput`'s scroller shape verbatim. Cheapest by a wide margin,
  gamepad-native, maximally arcade. But `Profile: PLK` is not "a profile with their name."
- **(b) On-screen character grid + live keyboard passthrough.** Grid navigable by pad (A appends, B
  backspaces, `DONE` / `CANCEL` cells); a raw keydown hook lets a keyboard player just type. ~12 char
  cap. Both precedents already exist in the build (§2.6).
- **(c) Keyboard-only text field.** Half the cost of (b) and breaks the "keyboard **or** gamepad,
  everywhere" property the menu system has held since v1.8.

**Resolved: (b), `PROFILE_NAME_MAX = 12`.** (c) was disqualified — a pad-only player could create
no profile at all, which makes the feature conditionally unreachable. Between (a) and (b): Paul
wrote "save a profile with their name," and a name is the whole point of the screen.

⛔ **Recorded: (b) is the single largest chunk of new UI in the changeset and owns a phase of its
own (P3).** If CS031 ever has to be cut down mid-flight, (a) is where the cut is — and taking it
would also retire FORK-F, since retyping three characters is not worth a Rename verb.

### FORK-CS031-E — what happens on a boot with no profile? → **(c) Migrate silently; ask only on a genuinely empty install.**

Paul's note: *"if there is no profile loaded, take the player to the 'Choose Profile' screen."*
Clean rule, but it collides with migration — an upgrading player has data and has never chosen a
name, so "no profile loaded" describes them too.

- **(a) Always auto-create.** Mint `PLAYER 1`, adopt whatever data exists, boot to Title. Choose
  Profile is only ever reached deliberately.
- **(b) Always force the screen.** Nobody plays until they've named themselves.
- **(c) Split by whether data exists.** Legacy data present → silently migrate into `PLAYER 1` and
  boot to Title. Genuinely empty install → force Choose Profile once.

**Resolved: (c), placeholder name `PLAYER 1`.** It honours Paul's rule for the case it was written
about (a new player) without interrupting an existing player who has lifetime achievements and just
wants to play the build they already had.

⛔ **Consequence of (c), named so P4 builds it deliberately:** the Add Profile screen must be reachable **with an empty roster** and must
not be cancellable there — there is no profile to fall back to. One guard, but the kind that gets
forgotten and produces a dead screen.

⛔ **The auto-created name is a placeholder the player never chose.** That is a direct dependency
for FORK-F — see below.

### FORK-CS031-F — does Rename ship in CS031? → **Yes.**

Not in Paul's note. Add / Delete / Switch only, or Add / Delete / Switch / Rename?

**Resolved: yes.** The argument is specific, not general tidiness. Under
FORK-A(a) + FORK-E(a or c), an upgrading player is auto-named `PLAYER 1`, and `PLAYER 1` **owns the
legacy keys**. Without Rename, the only route to a real name is Add-then-Delete — and deleting
`PLAYER 1` is exactly the special case that wipes the migrated lifetime achievements. The feature
would ship with a plausible, undoable, data-destroying path through it.

Once P3's name-entry screen exists, Rename is that screen re-entered seeded with the current name
plus one roster write. Small.

⛔ **This resolution is coupled to `D = b`.** If D is ever revisited to (a), Rename drops with it —
retyping three characters isn't worth a verb, and the data-loss trap above shrinks with it.

### FORK-CS031-G — the title menu has run out of room → **(b) Derive the layout from `MENU_TITLE.length`.**

`MENU_TITLE` is 4 rows (L3176). Adding `Profile` makes 5. The layout constants (L3181–3186) are
fixed literals, and the arithmetic doesn't survive it:

```
TITLE_MENU_Y    = VIEW_H/2 - 18  = 342      rows at 342, 380, 418, 456, [494]
TITLE_MENU_STEP = 38
flavour line "BEWARE THE HUNTER SATELLITE" is drawn at VIEW_H/2 + 120 = 480   (L9940)
```

The 5th row's baseline (494) lands **14 px below the flavour line**. And CS032 adds a 6th row
(`Load Saved Game`) at 532, which is worse.

- **(a) Retune the literals now** with headroom for six rows.
- **(b) Derive the block's vertical placement from `MENU_TITLE.length`,** so it recentres itself and
  CS032's row costs nothing — `drawRootMenu`'s own precedent (L9153–9158), which derives its panel
  height from `items.length` for exactly this reason.

**Resolved: (b),** with the resulting positions treated as playtest knobs at P6 (gate question G3).
This is the one place CS031 spends effort on CS032's behalf, and it's cheap.

### FORK-CS031-H — where does the current profile name render? → **(c) In the menu row itself.**

- **(a)** A dim line under `O V E R H A U L`.
- **(b)** Bottom-left, mirroring the version stamp bottom-right (L9941–9943).
- **(c)** In the menu row itself: `Profile: PAUL` — the row shows the name *and* is the way in.

**Resolved: (c).** It satisfies "so they know who is playing" with zero new
layout, and it makes the row self-explanatory. Under FORK-G(b) the row width isn't fixed, so a long
name costs nothing.

The row is the display *and* the way in. (b) stays available as a cheap addition if G4 asks for it
at the gate.

### FORK-CS031-I — can a profile be switched mid-run? → **No. Title only.**

Choose Profile is on the Title menu, so mid-run switching isn't reachable by construction — but the
gameover root exists and could host it.

**Resolved: title only.** A run's score and achievement progress belong to the profile that started
it; switching mid-run would make that meaningless. This is the same reasoning `menuDifficulty`'s
lock already ships (L4231–4233, `DIFFICULTY_LOCK_HELP`), so there's a precedent to point at rather
than a new rule to justify.



---

## §4 Design

### §4.1 The `Profiles` module

Placed immediately above `const STORAGE_KEY` (L4490); `Profiles.init()` called immediately above
`loadSettings()` (L4572).

```js
const PROFILES_KEY   = "afd_profiles_v1";   // NEW key. Not frozen — it is this changeset's own.
const PROFILE_LEGACY = "p0";                // the id whose stores ARE the three frozen keys
const PROFILE_MAX    = 8;                   // roster cap (see §4.6)
const PROFILE_NAME_MAX = 12;                // FORK-D(b)
```

Roster shape, `known-value-else-default` on every field:

```js
{ v: 1, lastUsed: "p0", profiles: [ { id: "p0", name: "PLAYER 1", created: 1700000000000 } ] }
```

Key routing — the one function every store asks through:

```js
// Returns the frozen key verbatim for the legacy profile, a suffixed key for every other.
// This is what makes the frozen-key invariant hold: p0's stores are not "migrated", they
// are simply still where they always were.
keyFor(base) { return this.activeId === PROFILE_LEGACY ? base : base + ":" + this.activeId; }
```

Three call sites change to route through it: `STORAGE_KEY` in `saveSettings`/`loadSettings`, and
`Achievements.STORAGE_KEY` in `save`/`init`. `HighScores` does not (FORK-B(a)).

### §4.2 ⛔ The `LEGACY_KEY` trap

`Achievements.init()`'s v1 migration branch (L7248–7253) runs whenever no v2 blob is found. Under
per-profile keys, **every newly created profile has no v2 blob** — so the naive change hands each
new profile the machine's `afd_achievements_v1` counters.

⛔ **The v1 fallback must be gated to `PROFILE_LEGACY` only.** A one-condition change, and the
single easiest thing in this changeset to get silently wrong: it is invisible on the developer's
machine unless a pre-v3.0-P7 blob happens to be sitting in that browser's storage.

### §4.3 `Profiles.activate(id)` — the teardown/reload path

Given §2.2 and §2.3, a switch is **reset, then load** — never load alone.

```
activate(id):
  1. flush the OUTGOING profile   (saveSettings + Achievements.save, at the CURRENT key)
  2. set activeId = id; persist roster.lastUsed
  3. reset runtime to SHIPPED defaults, with writes SUPPRESSED:
       - settings.*        <- the literal's defaults (L3275)
       - AudioSys.vol      <- { master:1, sfx:1, music:1, voice:1 } (L1182)
       - bindings          <- DEFAULT_BINDINGS (L2828)
       - debugShown/DEBUG  <- resetAllDebug() (L3713)
       - Achievements.lifetime <- all twenty counters to 0
  4. loadSettings()          // now genuinely "over defaults", as its contract assumes
  5. Achievements.init()     // re-derives tiers from the freshly-zeroed-then-loaded counters
```

⛔ **Step 3's "writes suppressed" is not optional.** `returnToDefaults()` (L4466) ends with
`saveSettings()`, and the `resetAllDebug()` consumer at L4376 does too. Reusing either verbatim
mid-switch writes a defaults blob into a store — and *which* store depends on whether step 2 has run
yet, so it corrupts either the profile being left or the one being entered. Either take a
suppression flag or factor the reset bodies out from their save calls. Do not call the existing
wrappers.

⛔ **Order matters within step 3→4.** `loadSettings()` calls `VoiceSys.setStyle()` (L4553), so the
voice style lands correctly for free — but only if the reset preceded it.

### §4.4 The screens

**`"nameentry"`** — grid + keyboard passthrough (FORK-D(b)). Charset from `SCORES_CHARSET` (L440)
plus lowercase if Paul wants it. State on `game.menu`: reuse `row`/`col` (the Controls-grid
precedent), plus a `nameBuf` string and a `nameCtx` describing what to do on commit (`{mode:"add"}`
or `{mode:"rename", id}`). Keyboard hook goes in keydown gated exactly like the debug numeric-entry
hook (L2929): only on this screen, only when the code window isn't armed, `preventDefault`'d so
Backspace can't navigate the browser back.

**`"profiles"`** — the roster list. Rows are `[…profiles, "Add Profile"]`; confirm on a profile
switches to it and returns to the title menu; a second verb column or a held modifier drives
Rename/Delete. Delete goes through `openModal` (L3990) — `index: 1` (CANCEL) is the safety property
and is not to be "tidied."

⛔ **Both screens need all three wiring points** (§2.6): `menuInput`'s switch, `drawMenu`'s
dispatch, and a `closePause()` route back to `titlemenu`.

### §4.5 Guards worth naming

- **Delete the last remaining profile:** refuse. Under FORK-E the roster is never legitimately empty
  after first boot, and an empty roster is the state that produces a dead title screen.
- **Delete the ACTIVE profile:** allowed, but must `activate()` another one in the same act, not
  leave `activeId` dangling.
- **Name collision:** compare trimmed and case-insensitively; reject with an inline message rather
  than auto-suffixing. Explicit beats clever, and `PAUL (2)` is nobody's name.
- **Empty / whitespace-only name:** reject. Same message path.
- **Corrupt roster:** the existing `try/catch → fall back to defaults, don't crash` idiom, which here
  means "route to Choose Profile," matching Paul's original note.

### §4.6 Structural headroom for CS032 (the one concession)

⛔ **CS031 builds no save-slot machinery.** It leaves exactly two doors open, both free:

1. The roster entry is an object, not a string, so CS032 adds a `slots` field additively.
2. FORK-G(b)'s derived title layout absorbs `Load Saved Game` with no layout edit.

Nothing else. If a phase wants a third, flag it.

---

## §5 Risks

1. ⛔ **The three frozen keys have never been round-tripped in a real browser** (`STATUS.md`, open
   since CS026 — "the failure mode if wrong is silent and total"). CS031 is a persistence changeset
   built entirely on top of that unverified foundation. **The P6 gate must include a real-browser
   set-reload-confirm**, and it should close the CS026 item at the same time. This is the single
   biggest risk in the changeset and the cheapest to retire.
2. **Silent cross-profile bleed** (§2.2, §2.3). Seven of eight settings fields and all twenty
   lifetime counters leak on a naive switch. Tests must assert the *absence* of bleed, which means
   seeding profile A, switching to B, and asserting defaults — not just asserting B loads.
3. **The `LEGACY_KEY` gate** (§4.2). Invisible on a clean machine.
4. **Suppressed writes during `activate()`** (§4.3). Corrupts one of two stores if missed; which one
   depends on timing.
5. **Ten suite files hard-fail rather than skip on a shallow clone** (`STATUS.md`, from CS026). CS031
   adds phase-local pins, which is exactly the category involved. Use `_phase-ref.js` and skip
   loudly; P7 asserts zero skips on a full clone.
6. **`quitToTitle()` calls `Achievements.save()`** (L3949). Harmless as long as `activeId` is
   correct at that moment — but it is a write site outside the switch path, and worth a grep during
   P2 to confirm no other one hides.

---

## §6 Fork summary — all resolved

| Fork | Question | Resolution |
|---|---|---|
| A | Key layout | **(a)** suffix; the legacy keys ARE `p0`'s store |
| B | Scores per-profile? | **(a)** shared table; stamp `profileId`/`profileName` additively |
| C | How much of settings blob | **(a)** whole blob, debug knobs included |
| D | Name entry | **(b)** pad grid + keyboard passthrough, `PROFILE_NAME_MAX` 12 |
| E | First boot | **(c)** migrate silently into `PLAYER 1`; ask only on an empty install |
| F | Rename in scope? | **yes** — coupled to D = b |
| G | Title layout | **(b)** derive from `MENU_TITLE.length` |
| H | Name display | **(c)** `Profile: NAME` in the row |
| I | Switch mid-run? | **no** — title only |

⛔ **CS032 defer list, confirmed untouched by this spec:** the `"Save"` row and its three-piece
unavailable-row idiom (§0.1), save slots, `Load Saved Game`, and any run-state serialisation.