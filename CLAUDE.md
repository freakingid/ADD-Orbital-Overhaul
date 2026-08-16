# CLAUDE.md — Orbital Overhaul (ADD-Orbital-Overhaul)

Auto-loaded every session. Read this, then `STATUS.md`, then your phase prompt.
Nothing else unless the prompt names it.

**This file states rules, not reasons.** Reasons live in `RATIONALE.md`, keyed by
`#anchor`. Do not read `RATIONALE.md` by default — pull one section when a rule's
scope is genuinely ambiguous.

**Two markers, and they mean different things:**

- **⛔ INVARIANT** — violating this breaks the build, player save data, or a
  shipped guarantee. Never violate. Never "clean up."
- **⚠ SETTLED** — this looks wrong and is not. It was decided deliberately, and
  in several cases re-decided. **Do not fix it. Do not re-litigate it.** If you
  believe it is actually wrong, stop and say so to Paul; do not change it in the
  same session you noticed it.

---

## What this is

A standalone browser-based vector arcade shooter in the spirit of Atari's
*Asteroids Deluxe*, with an original radioactive-salvage tow-chain mechanic.
Canvas 2D + vanilla JS + Web Audio. Solo developer (Paul); you are the
implementer only. Repo: `github.com/freakingid/ADD-Orbital-Overhaul` (GPL-3.0).

**The one canonical name is `Orbital Overhaul`** (CS029 P5). Not "Asteroids
Deluxe: Orbital Overhaul", not "Asteroid Field Deluxe" — those are earlier
working names, retired. The GitHub repo keeps `ADD-Orbital-Overhaul` — that is
a URL, not the game's name, and is never renamed to match.

⛔ **The name sweep does not touch `archive/` or `log/`.** Those are a
historical record — a planning doc or narrative log written under an earlier
working name stays exactly as written. Only live, currently-read docs
(`CLAUDE.md`, `ORBITAL-OVERHAUL-GDD.md`, `EXTERNAL-FILES.md`, `RATIONALE.md`,
`STATUS.md`, the in-game strings) and the wider repo (excluding those two
directories) get swept.

⚠ **SETTLED — a legacy filename or working name inside a historical test pin is
correct, not a miss.** `_phase-ref.js`'s `parentSource()`/`gameFileAt()` reads
across the CS029 P1 rename (`asteroids-deluxe.html` → `orbital-overhaul.html`)
by design carry both names, and pins into pre-rename history legitimately cite
the old path. Don't "fix" one on a sweep pass — it's pointing at what the repo
actually looked like at that SHA.

---

## Vocabulary (CS034 P2)

Four canonical object terms. Use these in prose, docs, and player-facing strings.

| Term | What it is |
|---|---|
| **Garbage Satellite** | The satellite the player shoots for cleanup. Splits into smaller Garbage Satellites when hit; the smallest tier is destroyed outright. Sheds **Debris** on destruction. |
| **Debris** | The towable object the player scoops, chains, and delivers to the Recycle dock. Coalesces into a **Hunter Satellite** if neglected. |
| **Hunter Satellite** | Actively homing enemy born from coalesced Debris. Splits 3-way on each hit down to the small tier. |
| **Recycle dock** | Where Debris is delivered for points. |

### ⛔ The build's names for two of these are INVERTED — do not rename code to match

| Canonical term | What the build calls it |
|---|---|
| **Garbage Satellite** (shoot it, it splits) | `DebrisSatellite` / `DEBRIS_*` / `game.debris` / `destroyDebris` / `debrisKills` |
| **Debris** (tow it to the dock) | `Garbage` / `GARBAGE_*` / `game.garbage` / `coalesceGarbage` / `"canister"` |
| Hunter Satellite | `HunterSatellite` / `HUNTER_*` — already correct |
| Recycle dock | `Dock` / `DOCK_*`, renders `"RECYCLE"` — already correct |

This is documentation, not a defect. **Code identifiers are never renamed to match
the canonical terms** — the inversion is load-bearing history, not a cleanup target.
A future session that "fixes" `game.debris` would be touching ~278 sites for zero
behavioural gain. Read `game.debris` as "the Garbage Satellite array" and
`game.garbage` as "the Debris array," and move on.

⛔ **Achievement `id` values are SAVE DATA and are never renamed**, regardless of how
inverted or dated their spelling looks. They are keys inside `afd_achievements_v2`'s
`lifetimeUnlocked` / `weeklyUnlocked` / `lifetimeTiers`. Renaming one silently drops
that achievement's unlock for every existing player.

The Worker's `debris_destroyed` stats key (`coinless-kit`, the online leaderboard) is
old vocabulary under this table too — it counts Garbage Satellite kills — and is
frozen in already-submitted rows. Deliberately not renamed; see the Leaderboard
section below.

Names were used inconsistently before CS034. Any doc or comment predating it may use
either term for either object — that's not a miss to fix on sight, just the state of
things before this table existed.

---

## Session rules

1. **Read `STATUS.md` first.** Update it at the end of the session.
2. **One phase per session.** Build only what the phase prompt scopes. Do not
   build ahead. If a later phase would be easier because of a small choice now,
   note it — don't take it.
3. **Implementation only.** You execute an already-reviewed plan. If a genuine
   design decision surfaces that `PLANNED-FEATURES-CS0##.md` doesn't cover,
   **stop and surface it.** Do not invent design; do not quietly pick a reading.
4. **Commit per phase, on `main`.** Code and doc updates in the same commit.
   **Never push** — pushing is Paul's.
5. **Edit docs in place.** "Update the GDD" means edit the file on disk, as part
   of the commit. Never print a doc for copy-paste.
6. **Prefer `str_replace` over full-file rewrites.** Re-read the region first.
   Keep edits surgical.
7. **Don't refactor unprompted.** Propose it; don't do it.
8. **Phases flag their own risks.** If you hit a hazard the prompt didn't name,
   record it in `STATUS.md` so the next prompt can account for it.

---

## Document map

| File | What it is | Read it? |
|---|---|---|
| `CLAUDE.md` | This. Rules + invariants + code map. | Always |
| `STATUS.md` | Build reality, current changeset only. One page. | Always |
| `PLANNED-FEATURES-CS0##.md` | Spec for what's being built now. | When in-flight |
| `IMPLEMENTATION-PHASES-CS0##.md` | Build order + phase prompts. | When in-flight |
| `ORBITAL-OVERHAUL-GDD.md` | Design intent + shipped behavior. §2 = shipped only. | §1–§3 before code |
| `DIFFICULTY-LEVERS.md` | The `LEVERS` table, documented. | Touching difficulty |
| `EXTERNAL-FILES.md` | Runtime files the shipped game loads. | Adding one |
| `RATIONALE.md` | Why the rules in this file exist. | On demand only |
| `DECISIONS.md` | Judgment calls made off-cycle (outside the phase flow) where no plan doc covered the question. | On demand only |
| `log/CS0##.md` | Per-changeset narrative build log **and** that changeset's version-history entry. | **Never by default** |
| `archive/` | Spent planning docs. | **Never by default** |

⛔ **`log/` and `archive/` are not session context.** Pull one file in only when a
question genuinely needs project history, and say you did.

⛔ **The version history is per-changeset, in `log/`. There is no
`GDD-VERSION-HISTORY.md`** — it was folded in CS027 P4. A closing phase appends
its changeset's entry to `log/CS0##.md` under `## GDD version history`, not to a
central changelog.

---

## STATUS.md format

⛔ **`STATUS.md` covers the current changeset only and stays under ~400 lines.**
The closing phase moves the whole thing to `log/CS0##.md` and resets it.

```markdown
# Orbital Overhaul — STATUS
Version: 1.0.0.NN · Changeset: CS0NN · Phase: PN · Registry: NN · Levers: NN

## Phase ledger — CS0NN
- P0 — one line: what shipped.
- P1 — one line: what shipped.

## Working / verified
## Known issues
## Open questions (blocking)
## Next up
## Playtest asks (open only — answered ones move to the log)
```

⛔ **A phase entry is one line in the ledger, ~200 words maximum in the body.**
What shipped, what moved, what's open. Reasoning goes in `log/CS0##.md`.

⛔ **Every entry starts on its own paragraph (`\n\n`).** If you append with a
shell redirect (`>>`, `cat <<EOF`), verify the written entry actually begins a
new paragraph. A missing trailing newline once fused years of entries into a
single 160 KB line.

---

## Test rules

⛔ **A test asserts only what its own phase owns.** Presence and shape of the
things that phase built — never a global count, total, or inventory of anything
it did not build. If your phase adds a knob, assert *that knob exists with those
bounds*, not that the registry now holds N rows.

⛔ **Global counts live in exactly one place: `scratchpad/test-registry.js`.**
Registry size, lever count, section-header count, `POWERUP_DROP_TYPES` length.
Adding a knob updates one file. Never re-introduce a duplicate count assertion.

⛔ **New tests use `scratchpad/_harness.js`.** It owns loading
`orbital-overhaul.html`, extracting the `<script>` block, stubbing `window` /
`document` / `performance` / `requestAnimationFrame` / `navigator` /
`localStorage`, and the `assert` / `eq` / `close` / `skip` counters. Do not
hand-roll a sandbox. Do not hand-roll world dimensions — read them from the
build via the harness.

⚠ **SETTLED (CS027 P2, measured): `buildGame()` evaluates the RAW script. The
comment strip is not in the build path and must not be put in one.** The suite's
two-regex idiom deletes 80 live lines of the current build *and still parses* —
one line comment contains `/*`, and the block-comment regex runs first. Comment
stripping is a **text-analysis** job (so a tombstone can't be read as live code)
and belongs to `execSource()`, a character scanner. No ordering of those two
regexes is safe. See `_harness.js`'s header.

- **Drive the real code.** Real `startGame` / `nextWave` / `update(1/60)` /
  `draw` / `resizeWorld`. **Never inline a copy of the logic under test.**
- **`node --check` the extracted script for syntax.**
- **A phase isn't done until its test passes.** Deliver the test with the code.
- **Run `node scratchpad/run-all.js` before committing.** Non-zero exit = not
  done. A phase may not leave the suite redder than it found it.
- **Frame-budget gates are counter-based, never wall-clock.**
- **Seed before the first build.** `installSeed(n)` from `_seeded-random.js` goes
  above everything, unscoped — some nondeterminism is spent at module load
  inside the factory, so a seed installed after `new Function(...)(...)` fixes
  nothing.
- **Test comment budget: ~15 lines of header.** What's under test, and any trap
  that is not obvious from the code. Rationale belongs in the planning doc, which
  is already written and already archived.

### ⛔ Phase-local pins use `scratchpad/_phase-ref.js`, never `HEAD`

A phase that asserts something about *its own session* ("only these files
changed", "the version is unmoved") must measure against **its own parent SHA,
pinned as a literal** — `git diff HEAD` silently re-aims at every later commit.

- `parentSource(sha)` — the parent's script. `ownCommits(sha, subject)` — this
  phase's commits by subject. `changedFiles(sha, own)` — the file set.
  `outsideScope(changed, extra)` — the allowlist; **pass extras, don't hardcode
  a filename list.**
- ⛔ **Skip loudly** (`SKIP_TAG`) when git history is unavailable. Never pass
  vacuously. A closing phase asserts zero skips.
- ⚠ **SETTLED:** never write a "no design doc was touched" pin. A closing phase
  rewrites documents by instruction, so the pin cannot survive by construction.
- ⚠ **SETTLED:** at a version bump, a phase-local version pin flips to its
  standing mirror image (`!== "1.0.0.N"`, permanently true). It is **not**
  re-pointed to a new literal. Live pins that genuinely track HEAD's version are
  a separate, small, deliberate set and *are* re-pointed each changeset.

This rule has been paid for at least ten times. See `RATIONALE.md#pins`.

---

## Build rules

### Shape of the build

⛔ **All game logic lives in one `<script>` block in `orbital-overhaul.html`.**
No bundler, no npm runtime deps. The file must open and play from `file://` by
double-click. (`scratchpad/` and `tools/` are unconstrained — tests are Node
CommonJS.) **One narrow exception (CS033):** a third-party shared client
module this repo doesn't author and was told not to fork may ship as its own
ES module, loaded by a second `<script type="module">` tag whose only job is
handing its exports to a `window.*` global — full contract in
`EXTERNAL-FILES.md` rule 1. That tag carries no game logic; it fails outright
on `file://`, and that's by design (rule 2 there) — the classic script, and
so the game itself, is untouched either way.

⛔ **External runtime files are optional enhancements, never required.** Load as
classic `<script src>` — never `fetch()` or `import` (both fail on `file://`) —
*except* the module-script exception directly above, which is exactly the
inverse trade (it fails on `file://` by design so it can be a real ES module).
Wrap the load so failure is caught; absence is the *normal* fallback path. If
voice audio doesn't load, the game plays silently-voiced; if the leaderboard
module doesn't load, the game plays with no leaderboard. **Log every one in
`EXTERNAL-FILES.md` before it ships.**

⛔ **Tuning constants at the top, grouped by system** (`GARBAGE_*`, `CHAIN_*`,
`CARGO_*`, `DOCK_*`). Never inline magic numbers.

⛔ **One clock.** All difficulty scaling derives from `game.wave`. No parallel
clocks. See `DIFFICULTY-LEVERS.md`.

### Math and lifecycle

⛔ **Wrap-aware helpers are mandatory for all world-space distance, aiming, and
link math** — `dist2`, `angleTo`, `shortDelta`. Naive `Math.hypot` / subtraction
breaks at the wrap seam. This is the single most common source of subtle bugs
here.

⛔ **Entity lifecycle: `dead` flag + end-of-frame `.filter()`.** Every entity:
constructor / `update(dt)` / `draw()` / `dead`. Kill by setting `dead = true`.
Never splice mid-loop. *Exception:* tow-chain nodes are plain objects removed via
`breakChain()` / `chain.pop()` — read GDD §3.4 before touching them.

### Rendering

⛔ **Render through `drawPoly` + `glowStroke`.** New visible entities define
local-space point arrays and reuse these. No per-entity draw pipelines. No fills,
no sprites, no textures (Pillar 1).

- `drawRingArc(x, y, r, frac, color, width, blur)` — HUD gauge rings. Never
  `closePath()`s; does not clamp `frac` (overshoot is the caller's job).
- `drawRingSegments(x, y, r, segs, filled, litColor, dimColor)` — segmented
  sibling, used by the Scoop pip row. Same never-`closePath()` convention.
- `achLeader(x0, x1, y)` + `achTextW(str, size)` — the Achievements dotted leader.
  ⛔ `achLeader()` is the only render code doing arithmetic on
  `ctx.measureText().width`, and several suite stubs return `{width: 0}`. Its
  guards are written `!(x >= n)` / `!(x > 0)`, **never** `x < n` / `x <= 0`,
  because NaN fails every ordinary comparison. Keep that form.

⛔ **The HUD uses `glowStroke` — no `fillRect`, no `strokeRect`.** Don't
reintroduce a bar or rect for a new HUD element; follow the ring idiom.
⚠ **SETTLED:** exactly two fill exceptions exist, both named in GDD §3.2 —
`drawText` and the low-health corner radial gradients. The corner glow is a fill
*by design* (a peripheral, edgeless alarm). It is not a bar.

### Scoring

⛔ **Route all scoring through `addScore()`** — it also handles the HP-repair
milestone.
⚠ **SETTLED — one sanctioned bypass:** `AUTO_SHIELD_SCORE_PENALTY` in
`damageShip` subtracts from `game.score` directly, clamped at 0. It is a penalty,
not a gain; routing it through `addScore` would let a score *drop* trip the
`nextRepair` milestone. Do not add other bypasses.

### Audio

⛔ **Tracks are DATA.** New tracks are new `MUSIC_TRACKS` entries built by their
own `buildXTrack()`. **`MusicSys.update()` / `scheduleStep()` and the `layerGates`
gain-gating are not to be modified.** `playNote()`'s voice branch is the one
extension point. Compose in `tools/music-lab.html`, port **verbatim**, never
hand-tune gains in the build.

⛔ **`VoiceSys` is a separate module alongside AudioSys/MusicSys — never folded
into AudioSys**, which is a flat bag of one-shot voices and must not grow a
sequencer.

1. ⛔ **Lines are DATA.** `VOICE_LINES` is keyed by event, each an array of
   `{text, phon}`. Adding a line is a data edit. Selection is a plain random pick.
2. ⛔ **You never derive, edit, or improve a `phon` string.** Every `phon` is
   composed and zero-error-verified in `tools/voice-robot-lab.html` (or
   programmatically against the build's `PH` table) and pasted in verbatim.
   **Features ship silent until that gate clears.** The acoustic engine (`PH`,
   `buildUtterance` / `buildPitch`, `_schedule`), the `VOICE_STYLES` table, and
   the ring-modulation stage are all ported verbatim from the labs. The labs'
   g2p, flanger, and crush stages do **not** ship.
3. ⛔ **Ask "did an effect end?" through `powerActive(type)`, never `powerFx`.**
4. ⚠ **SETTLED — superseded lines DROP, except the four `VOICE_CRITICAL` events,
   which PARK and are RE-VALIDATED.** `VOICE_CRITICAL` = `health_low`,
   `health_relief`, `cargo_full`, `level`. A critical line that loses the gate is
   parked on a FIFO queue (`VOICE_QUEUE_MAX`, deduped by event — a newer line
   **replaces** a parked one in place, keeping its slot) and is exempt from the
   cooldown gap. At drain, `VOICE_STILL_TRUE[event](entry)` restates the
   trigger's own condition; a line gone false is discarded **silently**, never
   spoken late. The older blanket "never queue" rule was over-broad, not wrong —
   don't restore it, and don't widen this either. See `RATIONALE.md#voice-queue`.
   - ⛔ **Criticality is ORTHOGONAL to priority. Two questions, two tables, don't
     merge them.** Priority answers *may this line interrupt?*; criticality
     answers *may this line wait?* `VOICE_PRIORITY` is untouched — `cargo_full`
     stays 1, `level` stays 2.
   - ⛔ **No TTL.** The drain takes no `dt`. A TTL would tick the game clock while
     `busyUntil` lives on the audio clock, which doesn't pause.
   - ⛔ **Adding a critical event means raising `VOICE_QUEUE_MAX` with it.**
5. ⛔ **One gate, two outputs.** `_emit(line, p)` resolves the single
   cooldown/priority gate and drives **both** caption and audio; `_schedule(utt)`
   is the scheduler. Keep the gate arithmetic byte-identical — captions must obey
   the drop / pre-empt / park rules exactly like audio. Captions are independent
   of voice volume and of the Off style (voice Off still captions).
6. ⚠ **SETTLED:** `drawCaption()` is a **sibling** of `drawHUD()`, not inside it
   — captions survive the `H` capture toggle. `drawLevelBanner()` is a second
   sibling and is **not** a caption: set unconditionally in `nextWave()`,
   independent of `AudioSys.ctx`, `settings.captions` and `voiceEnabled()`, and
   it never touches the voice gate. That independence is the point. Don't tidy
   it into the caption path.
7. Every entry point is `if (!AudioSys.ctx) return;`-guarded (headless-safe).
   The low-health voice has its own latch (`game.lowHpVoiced`) that menus do not
   tear down — distinct from the siren latch.

### Save data

⛔ **Three frozen `localStorage` keys — never rename, merge, or version-bump
them.** `afd_settings_v1`, `afd_achievements_v2`, `afd_scores_v1`. Independent
stores, each with its own `storageOK()` try/catch path; none reads or writes
another. Renaming any of them silently wipes every player's data (GDD §2.16).
**Still true post-CS031** — Player Profiles (below) reads and writes these
same three keys, unrenamed; it does not add a fourth frozen key so much as
route these three through a suffix.

⛔ **CS031 adds a fourth key, `afd_profiles_v1` — additive, owned by CS031,
not frozen.** The roster of named profiles. `afd_settings_v1` and
`afd_achievements_v2` are now **per-profile**: `Profiles.keyFor(base)` maps a
non-legacy profile to a suffixed key (`afd_settings_v1:p3`), while the legacy
profile (`"p0"`) resolves to the bare base name — **`p0`'s stores ARE
`afd_settings_v1`/`afd_achievements_v2` themselves, verbatim,** not a copy of
them. Say this explicitly because it is the fact a future cleanup pass will
otherwise "tidy": nothing was renamed, migrated, or moved to make it true.
`afd_scores_v1` stays one shared machine-wide table across every profile,
records additively stamped `profileId`/`profileName` (GDD §2.21).

⛔ **CS032 adds a fifth key, `afd_saves_v1` — additive, owned by CS032, not
frozen.** Three save slots per profile, routed through `Profiles.keyFor()` at
both the read and write site exactly like `afd_settings_v1`/
`afd_achievements_v2`: a non-legacy profile reads/writes a suffixed key
(`afd_saves_v1:p3`), `"p0"` reads/writes the bare base name. Unlike those two,
`afd_saves_v1` is **lazy** — nothing reads it at boot; it is touched only when
the slots screen opens or a save/load fires (GDD §2.22).

⛔ **New state is additive, under known-value-else-default loading.** Removing a
field needs **no key rename and no migration shim** — a saved value for a deleted
field orphans harmlessly, which is the whole point of the rule.

⛔ **CS033 adds no sixth key.** `player_id` is an additive field on each roster
entry already inside `afd_profiles_v1` (`Profiles.roster[i].playerId`), not a
new store. See "Profiles (CS031)" below for the mint/backfill contract.

### Profiles (CS031)

⛔ **`Profiles.keyFor(base)` is the one route from a store's base name to the
key it actually reads/writes. `localStorage` is never enumerated** — no
`key(i)`, no `.length`, no `Object.keys` over storage — anywhere in the build.
⛔ **The `PROFILE_LEGACY_PROBE` / migrate-into-`"p0"` fallback runs only inside
`Profiles.init()`, gated to first boot.** Nothing later in the build re-probes
those two literal key names. ⛔ **`Profiles.activate(id)` resets the runtime to
shipped defaults BEFORE it loads the incoming profile — never load alone.**
`loadSettings()`/`Achievements.init()` are correctly written for a cold boot
and assume the runtime already holds defaults; skipping the reset step bleeds
the outgoing profile's settings, bindings, or lifetime achievements onto the
incoming one. See GDD §2.21 for the full contract.

⛔ **`Profiles.roster[i].playerId` (CS033) is minted once, the first time a
profile is actually activated — at `Profiles.init()` (this boot's profile) or
`Profiles.activate(id)` (a switch), never at `add()`.** It is never
regenerated once set — `Profiles.ensurePlayerId(id)` is a mint-if-missing,
no-op-otherwise call, and it is the ONLY writer. A profile created before this
field existed is backfilled the same lazy way, the first time it is next
activated. `player_id` is never rendered anywhere; `display_name` (the
existing `name` field) is the only user-facing identity.

### Leaderboard (CS033)

⛔ **`Leaderboard` (search the build for `const Leaderboard = {`) is the one
call surface for `window.KitLeaderboard`.** Nothing else in the build reads
that global directly except the rename flow's `NAME_CHANGE_NOTICE` lookup
(`menuProfiles`'s RENAME branch) and the ES-module bridge tag itself. Every
`Leaderboard.*` entry point is safe to call with the module absent.

⛔ **`Leaderboard.eligible()` (`!game.debugRun && !game.resumedRun`) gates
every `submit()` call — the identical gate `HighScores`' own top-10 check
already uses at the same "dying"→"gameover" seam**, and for the same reason:
a resumed run's score can't be separated from the score it loaded in with, and
a debug run was never a fair one. Extend both gates together if either ever
changes.

⛔ **`quitToTitle()` submits `outcome: 'quit'` only when `game.state ===
"playing"` at the moment it's called, checked BEFORE that function overwrites
`game.state`.** The same function is also gameover's own "Quit to Title" row
— an already-ended, already-submitted (or already-ineligible) run — and must
never submit a second time for it.

⚠ **SETTLED — `'completed'` has no call site.** The module's outcome enum is
`'died' | 'completed' | 'quit'`; this game has no win condition (escalating
waves forever — `DIFFICULTY-LEVERS.md`), so only the first and third are ever
submitted. Don't invent a "completed" trigger to fill the enum.

⛔ **`stats` is a fixed four keys: `wave_reached`, `canisters_delivered`, `saucer_kills`,
`debris_destroyed` — not by omission, extend deliberately.** All four are the Worker's
registered `statsFields` for `orbital-overhaul` — the registry **is** readable from this
machine, at `github.com/freakingid/coinless-kit`'s `services/leaderboard/src/registry.js`
(CS034 P4/§0.1; the prior claim that it "is not visible from this repo" was wrong — CS033
shipped `garbage_satellite_kills`, an unregistered key, flagging every row it posted, fixed
this changeset). `hunter_kills` is also registered and is deliberately NOT sent — no
per-game, player-only Hunter-kill counter exists (`hunterLineageKills` resets per lineage,
`Achievements.lifetime.hunterKills` is cross-game), and none was added to serve this.
`durationS` is NOT duplicated into `stats` — it's already a top-level field on every board
entry per the module's own contract. A key mismatch only sets a flag server-side, never a
rejection, so extending this object again is always a one-line change at
`Leaderboard.submit()` — but it's still a deliberate edit, not filler. See the Vocabulary
section above for `debris_destroyed`'s own legacy-naming note.

### Two traps that have each burned twice

⚠ **SETTLED — `SCOOP_WIDTH[0] !== 0 || SCOOP_DEPTH[0] !== 0` throws at load
time. This is a deliberate invariant guard, not test scaffolding.** It is what
makes `inScoopBox` return `false` at `scoopLevel` 0, which keeps garbage pickup
byte-identical to the pre-scoop build. Do not delete it on a cleanup pass. If it
fires, `SCOOP_CONFIG` / `buildScoopSteps` broke the invariant — the assertion is
correct (GDD §2.14.1).

⚠ **SETTLED — `POWERUP_DROP_TYPES` is the *budgeted-effect* list. The drop table
is the separate `POWERUP_DROP_WEIGHTS`.** They answer different questions and
have been conflated twice already; don't do it a third time (GDD §2.14).
`POWERUP_DROP_TYPES` deliberately excludes Health (instant) and Scoop
(persistent, not budgeted). `"guard"` is in **both**, which does not merge them.
- ⛔ `POWERUP_DROP_TYPES` is **append-only** — its order fixes each type's HUD row
  index. Inserting silently moves every existing row.
- ⛔ `POWERUP_DROP_WEIGHTS` has a **conditional** entry: `"guard"` enters the roll
  only while `game.chain.length >= DEBUG.chainGuardMinTow`. An ineligible key must
  be skipped in **both** the running total and the walk, or a dead slot silently
  drops nothing.

### Difficulty levers

⛔ **`LEVERS` is the game's one difficulty mechanism.** See
`DIFFICULTY-LEVERS.md`.
⛔ **Drivers-only wrapping: a carried (`↳`) lever may never declare `carriesTo`.**
Found via a difficulty regression at level 33.
⛔ **`destroyHunter()` is not levered and stays 3-way** — `ACH_LINEAGE_FULL = 13`
depends on it. Levering the split moves a shipped achievement threshold.

### Achievement celebration panel

⛔ **`game.pendingAch` is a flushed bucket, never filtered by `game.wave`.** In a
wave-clear frame `nextWave()` (which increments `game.wave`) runs before
`Achievements.evaluate()`, so a Perfect Wave earned clearing wave 7 is banked
while `game.wave === 8`. Recording or filtering an item by wave misattributes it
(CS030 spec §0.4).
⛔ **Both the keyboard and gamepad input handlers gate on `game.celebration` —
including its scroll input — before falling through to `game.entry` or normal
play.** Two independent input paths; a guard added to one and not the other lets
a controller player blow straight through the panel with Start and never see it
(CS030 P4).

### New enemies

Wire into `startGame` reset, `update()` entity update + collision passes +
cleanup filter, `draw()` z-order, and the wave-clear condition. **Decide
explicitly whether the new hazard can damage the tow chain.**

---

## Code map

Read-order skeleton. GDD §3 is authoritative for what actually exists.

```
orbital-overhaul.html
  <style>          fixed 1280x720 canvas, letterboxed via CSS scaling
  <script>
    Constants      SHIP_/BULLET_/SHIELD_/DEBRIS_/GARBAGE_/CHAIN_/CARGO_/
                   DOCK_/HUNTER_/POWERUP_, scores. Level Progression is its
                   own block: LEVERS + leverState/liveLevers/payloadSlots/
                   largeHunterCap. World sizing: WORLD_SIZE_* +
                   DEBUG.earlyWorldLevels.
    Canvas         resize() — CSS scale only; game math never reads window size
    AudioSys       singleton, one method per sound, init on first keypress
    MusicSys       separate module: MUSIC_TRACKS (data) + scheduler (frozen)
    VoiceSys       separate module: VOICE_STYLES/VOICE_PARAMS/VOICE_LINES/
                   VOICE_PRIORITY/VOICE_CRITICAL/VOICE_STILL_TRUE, LEVEL_PHON/
                   NUM_PHON/DIGIT_WORD, numberToWords/levelPhon/sayLevel.
                   Channel: say -> _emit (the one gate) -> _schedule;
                   _enqueue + update (no dt, called at the END of update())
    Input          keys{} map + input.* predicates; call sites never read keys{}
    Profiles       roster + keyFor() (CS031) — the "nameentry"/"profiles" menu
                   screens, immediately above STORAGE_KEY/saveSettings/
                   loadSettings, which every per-profile store still routes
                   through
    Helpers        rand, wrap, dist2, angleTo, shortDelta, glowStroke, drawPoly,
                   drawRingArc, drawRingSegments, COLOR
    Entities       Ship, Bullet, Asteroid, Satellite, Wedge, Saucer, Particle,
                   Garbage, FloatText, Dock — uniform contract
    game           central mutable state
    Flow           startGame, spawnFieldSatellites, nextWave, addScore, boom,
                   destroyDebris/Hunter/Saucer, shatterClump, damageShip,
                   killShip, shieldDeflect/shieldBounce/debrisBounce,
                   dropPowerup/applyPowerup/powerActive/powerBudgetAmount,
                   magnetPulling, superMegaDelivery. Garbage: coalesceGarbage,
                   saturatedClump/heldClumpCount/drainHeldClumps,
                   cullGarbage/betterCullVictim, magnetPushBurst
    Chain          chainAnchor, wrapNode, updateChain, breakChain, scatterChain,
                   drawLink, drawChain — verlet nodes, GDD 3.4 first
    update(dt)     respawn -> entities -> pickup/chain/dock -> spawn timers ->
                   collisions -> cleanup filters -> wave-clear -> heartbeat
    draw()         starfield -> title OR (dock -> particles -> garbage -> chain
                   -> rocks -> satellites -> wedges -> saucers -> bullets ->
                   ship -> floaters -> HUD -> overlays)
    Capture        P / O / H — shipped, player-facing (see below)
    Main loop      requestAnimationFrame, dt clamped to 0.05s
```

When you add or rename a section, update GDD §3 **and** `STATUS.md`.

---

## Capture tools — shipped, not scaffolding

⛔ **The `Capture` object is a player-facing feature. Do not strip it or gate it
behind a debug flag on a refactor pass.**

- **P** — export the current frame as a PNG, composited onto black.
- **O** — cycle time scale 1x / 0.5x / 0.25x.
- **H** — toggle `drawHUD()`. Purely visual; the game keeps simulating. `P`
  respects it, so hiding the HUD first exports a clean frame.

All three are inert outside live play (`Capture.active()`), so they can never
collide with menu navigation or rebinding.

⛔ **Two load-bearing integration points in `loop()`** — preserve them if `loop()`
or `draw()` is ever restructured:
1. `dt` is multiplied by `Capture.timeScale`.
2. `Capture.afterDraw()` runs immediately after `draw()`.

---

## Design instruments (`tools/`)

Standalone HTML, **not shipped code** — instruments for picking numbers or
composing data before porting the result in. Each duplicates whatever slice of
game logic it needs; drift here can only ever produce a bad *preview*, never a
bad *build*.

- **`tools/scoop-lab.html`** — Scoop capture-mouth sizing (GDD §2.14.1).
- **`tools/sat-art-lab.html`** — the twelve satellite craft's `SAT_ART` / `SAT_SCRAP` polylines.
- **`tools/dock-float-lab.html`** — the delivery "+pts" floater column: anchor, cadence, and the
  three placement models (CS029 P3). Its `slotY()` header records why the model-B rule as first
  written does not hold.
- **`tools/music-lab.html`** — the porting source for every `MUSIC_TRACKS` entry.
- **`tools/voice-lab.html`** — the CS010 engine source (formant synth).
- **`tools/voice-robot-lab.html`** — ⛔ **the active source for all `phon`
  strings, `VOICE_STYLES` entries, and dictionary additions.** Nothing reaches
  `VOICE_LINES` without clearing this gate. `VL.speak("...")` in DevTools plays
  ARPAbet directly through Dan's synthesizer.

---

## Model guidance

Per-phase, in `IMPLEMENTATION-PHASES-CS0##.md`. Follow it unless Paul says
otherwise. `ultrathink` must appear inside the message text itself — it is a
per-turn lever, not a session setting.