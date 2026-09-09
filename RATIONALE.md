# RATIONALE.md — why the rules in `CLAUDE.md` are what they are

⛔ **This file is not session context.** Nothing loads it by default. `CLAUDE.md`
carries the rule; this carries the receipt. Pull **one section** when a rule's
scope is genuinely ambiguous, or when you think a rule is wrong and want to know
what it already survived — and say that you read it.

It exists so that **a rule can be questioned without the rule itself carrying an
essay.** `CLAUDE.md` used to state every rule and its full history in the same
breath, which made it 528 lines that every session paid for in full. The rules
stayed; the reasoning moved here.

**Everything below is relocated prose**, taken out of `CLAUDE.md` as it stood at
`89a9a3a` (the CS026-complete commit) and moved, not rewritten. **The last five
anchors were relocated later, by CS042 P11, when the valve fired for the first
time** — same contract, different donor commit; each says so at its own head. Where the rule
has since been narrowed, retired or superseded, a `**Status:**` line says so and
the original text is kept underneath as-is — a faithful record beats a tidy one.

| Anchor | Backs the rule in `CLAUDE.md` |
|---|---|
| [`#status-window`](#status-window) | STATUS.md format — one page, one paragraph per entry |
| [`#doc-naming`](#doc-naming) | Document map — the layers, the `CS0##` convention, the retired changelog |
| [`#external-files`](#external-files) | Build rules — external runtime files are optional |
| [`#tests`](#tests) | Test rules — headless, drive the real code |
| [`#pins`](#pins) | Test rules — phase-local pins use `_phase-ref.js`, never `HEAD` |
| [`#rendering`](#rendering) | Rendering — `drawPoly`/`glowStroke`, the ring primitives, `achLeader` |
| [`#scoring`](#scoring) | Scoring — `addScore()` and its one sanctioned bypass |
| [`#music`](#music) | Audio — tracks are DATA |
| [`#voice`](#voice) | Audio — `VoiceSys` is a separate module; lines are DATA; port verbatim |
| [`#voice-queue`](#voice-queue) | Audio — superseded lines DROP, except `VOICE_CRITICAL` |
| [`#captions`](#captions) | Audio — one gate, two outputs |
| [`#save-data`](#save-data) | Save data — the three frozen `localStorage` keys |
| [`#scoop-guard`](#scoop-guard) | Two traps — the `SCOOP_WIDTH[0]` load-time throw |
| [`#powerup-lists`](#powerup-lists) | Two traps — `POWERUP_DROP_TYPES` vs `POWERUP_DROP_WEIGHTS` |
| [`#levers`](#levers) | Difficulty levers — `destroyHunter()` is not levered |
| [`#code-map`](#code-map) | Code map — annotations, and the retired v2.0 in-flight list |
| [`#tools`](#tools) | Design instruments (`tools/`) |
| [`#capture`](#capture) | Capture tools — shipped, not scaffolding |
| [`#voice-repeat`](#voice-repeat) | Audio — per-event repeat suppression, the third mechanism |
| [`#event-sfx`](#event-sfx) | Audio — an event SFX fires at its trigger site, never inside `_emit()` |
| [`#cs042-health`](#cs042-health) | Healing — the CS042 supply qualifiers and the bank's second job |
| [`#cs042-mass`](#cs042-mass) | Math and lifecycle — one mass, one force, and the four retired divisors |
| [`#cs042-scoop`](#cs042-scoop) | Two traps / Rendering — the cap vs the mouth span, and the dashed field |

---

<a id="status-window"></a>

## `#status-window` — why `STATUS.md` is one page, and why every entry gets `\n\n`

**Status:** the rolling-window mechanism below is **retired as of CS027 P4.**
`STATUS.md` now covers the **current changeset only** and the closing phase moves
the whole thing to `log/CS0##.md`. The relocated text is why size management
existed at all, and the paragraph-break rule it produced is unchanged and still
live.

Relocated from the old Non-negotiables:

> - **`STATUS.md` is a rolling window, not an ever-growing log — keep roughly the
>   last 3 changesets live; prune the rest into `archive/STATUS-HISTORY.md`.**
>   Every session that closes out a changeset (the version-bump/doc-sweep phase)
>   should check `STATUS.md`'s size and, if the oldest changeset it still covers
>   is more than ~3 rounds behind the one just shipped, move that oldest
>   changeset's entries out of every section (`Working / verified`, `Known
>   issues`, `Balance notes`, `Next up`, `Playtest asks`) and append them,
>   **newest-first, each entry its own paragraph**, to
>   `archive/STATUS-HISTORY.md` under that section's own heading there. Do not
>   summarize or shorten while moving — a straight relocation, so the archive
>   stays a faithful record. `archive/STATUS-HISTORY.md` is **never** attached
>   to or read during a normal session (same rule as `GDD-VERSION-HISTORY.md`
>   and `archive/`'s planning docs) — pull it in only if a session genuinely
>   needs pre-archive history.
> - **Never let two changeset entries land on the same physical line.** Every
>   `STATUS.md` entry — the top rolling recap, and every bullet in every
>   section — gets its own paragraph break (`\n\n`) before the next one is
>   prepended or appended. If you're editing `STATUS.md` with a shell append
>   (`>>`, `echo`, `cat <<EOF`) rather than a normal file edit, double-check the
>   written entry actually starts on its own new paragraph — a missing trailing
>   newline here is what let years of entries fuse into a single 160 KB line
>   in mid-2026, which is what necessitated the archive split in the first
>   place. Don't repeat it.

Two things survived that retirement and are worth reading together: **do not
summarize while moving** (a relocation, not a rewrite — the same instruction this
whole file was written under), and the reason the archive existed in the first
place was a *missing trailing newline*, not a policy failure.

---

<a id="doc-naming"></a>

## `#doc-naming` — the documentation layers and the `CS0##` convention

**Status:** `GDD-VERSION-HISTORY.md` was **folded into `log/CS0##.md` in CS027
P4** and no longer exists; `archive/STATUS-HISTORY.md` was split the same way.
The layer *distinctions* below are unchanged — what moved is where history
lives, not what each document is for.

Relocated from the old "Documentation layers (don't conflate them)":

> - `orbital-overhaul-GDD.md` — design **intent** + what's actually
>   **shipped**. Section 2 must always describe the current build, never a
>   planned one. Sections 1 (Pillars) and 3 (Architecture Map / conventions)
>   rarely change; read them before writing code.
> - `GDD-VERSION-HISTORY.md` — the append-only per-phase changelog, split out of
>   the GDD's §7 in CS009 P0 for context economy. **Not session context** — do
>   not attach it to a build session by default; pull it in only when a session
>   genuinely needs project history. New phase entries are appended here, not
>   back into the GDD.
> - `PLANNED-FEATURES-CS###.md` — design **detail for what's not built yet**:
>   full specs, rationale, and flagged assumptions for every pending feature.
>   When a feature ships, its spec moves out of here and into the GDD. Current
>   round filenames are **changeset-numbered** (`CS` + a zero-padded 3-digit
>   index, e.g. `PLANNED-FEATURES-CS009.md`) — this superseded the older
>   `-vX.X` per-version suffix (`PLANNED-FEATURES-v3.6.md` etc.), which stays
>   as-is on already-archived files rather than being retroactively renamed.
> - `IMPLEMENTATION-PHASES-CS###.md` — the build **order**: dependency-ordered
>   phases, each with a ready-to-paste prompt, required testing, and a
>   suggested commit message. Same `CS###` naming convention as above.
> - `CLAUDE.md` (this file) — non-negotiables, conventions, code map.
> - `STATUS.md` — build **reality** + decisions, for roughly the last 3
>   changesets. You maintain it. Older entries live in
>   `archive/STATUS-HISTORY.md` (same not-session-context rule as
>   `GDD-VERSION-HISTORY.md`) — see the size-management rule under
>   Non-negotiables.

The load-bearing half is the last clause of the `PLANNED-FEATURES` entry:
**already-archived `-vX.X` files are not retroactively renamed.** A filename in
`archive/` is a historical artifact and is allowed to disagree with the current
convention.

---

<a id="external-files"></a>

## `#external-files` — why an external runtime file may never be required

Relocated from the old "What this is" and "Tech + test conventions":

> As of CS011 the game MAY load extra runtime files, but only as
> **non-essential enhancements** (see `EXTERNAL-FILES.md`): the HTML must always
> open and play by double-click, with or without them. The browser opens the file
> directly.

> **External runtime files are allowed but must be optional
> (CS011).** The shipped game may load extra files (e.g. base64-encoded audio) as
> classic `<script src="…">` subresources decoded at boot — never via `fetch()`
> or `import` (both fail on `file://`). Every such file is a **non-essential
> enhancement**: wrap the load so failure is caught (`<script onerror>` or
> try/catch around the decode), treat absence as the *normal* fallback path, and
> never let a missing / corrupt / blocked external file break gameplay — if voice
> audio doesn't load, the game plays silently-voiced, full stop. **Log every
> runtime external file in `EXTERNAL-FILES.md` before it ships.** `tools/`,
> `scratchpad/`, and docs don't count — only files the *shipped game* loads.

Scope note worth keeping in view: `EXTERNAL-FILES.md` logs **only what the
shipped game loads.** A file under `tools/` or `scratchpad/` is not an external
runtime file no matter how large it is.

---

<a id="tests"></a>

## `#tests` — why headless, and why never a copy of the logic

**Status:** the sandbox described below is now owned by `scratchpad/_harness.js`
(CS027 P2) rather than hand-rolled per file. The *reasons* are unchanged.

Relocated from the old "Tech + test conventions":

> - **Headless smoke tests, no canvas.** Extract the script block and run
>   `node --check` for syntax. For gameplay logic, stub `window`,
>   `document.getElementById` (return a canvas whose `getContext` yields a Proxy
>   that no-ops every method), and `requestAnimationFrame`, then drive
>   `startGame()` and `update(1/60)` directly against the real code — never
>   inline a copy of the logic under test. `AudioSys` is safe headless because
>   every method early-returns when `this.ctx` is null. Deliver tests with the
>   code, not after; a phase isn't done until its headless test passes.

`AudioSys` being safe headless is not an accident of the test rig — it falls out
of the `if (!AudioSys.ctx) return;` guard on every audio entry point, which is
itself a shipped rule (see [`#voice`](#voice)). The two hold each other up.

---

<a id="pins"></a>

## `#pins` — the phase-local pin lesson, paid for at least ten times

Relocated verbatim from the old "Tech + test conventions". This is the single
most expensive recurring defect in the suite's history:

> - **⛔ A PHASE-LOCAL PIN USES `scratchpad/_phase-ref.js` AND NEVER `HEAD`.**
>   This is the standing rule CS026 P1 built that helper to enforce, and it has
>   cost more repairs than anything else in the suite: **nine such pins were
>   retired in one go in CS024 P7**, and CS025 P3's retirement note called it the
>   tenth time the lesson had been paid for. The failure is always the same
>   shape — a phase asserts something true about *its own session* ("no design
>   doc was touched", "only these files changed", "the version is unmoved") by
>   measuring against a **moving reference**. `git diff HEAD` means "since
>   whatever is checked out now", so the claim silently re-aims at every later
>   commit and eventually fails for reasons that have nothing to do with the
>   phase. Write the claim against **this phase's own parent SHA**, pinned as a
>   literal: `parentSource(sha)` builds the parent's script, `ownCommits(sha,
>   subject)` finds the phase's own commits by subject line, and
>   `changedFiles(sha, own)` gives the file set — falling back to the working
>   tree, and **skipping loudly** (`SKIP_TAG`) when git history is unavailable
>   rather than passing vacuously (FORK-CS026-H; a closing phase asserts zero
>   skips). Two corollaries, both learned the hard way: a **"no design doc was
>   touched" pin cannot survive a closing phase by construction** — that phase
>   rewrites four documents by instruction — so don't write one; and a
>   phase-local **version** pin (`=== "1.0.0.N"`, "the next phase owns the bump")
>   is falsified by that bump, so at the bump it flips to its **standing mirror
>   image** (`!== "1.0.0.N"`, permanently true) rather than being re-pointed to a
>   new literal. Live pins that genuinely track HEAD's version are a separate,
>   small, deliberate set and *are* re-pointed each changeset.

Three details in there are the ones people get wrong on a re-read:

1. **Nine pins retired in a single phase (CS024 P7)**, and CS025 P3 counted its
   own as the tenth occasion. The rule is not defensive over-engineering; it is a
   ledger of repairs already paid.
2. **Skipping loudly beats passing vacuously.** A pin that cannot measure must
   announce that it did not measure, because a green suite that silently checked
   nothing is worse than a red one.
3. **The mirror-image flip is not a re-point.** `!== "1.0.0.N"` is permanently
   true from the bump forward, which is exactly what "this phase did not own the
   bump" means once the bump has happened. Re-pointing it to a new literal would
   recreate the moving reference the rule exists to forbid.

`outsideScope(changed, extra)` (CS027 P2) is the later addition: it centralises
the allowlist so a phase passes its extras rather than hardcoding a filename
list, which was the same moving-target failure in a different coat.

---

<a id="rendering"></a>

## `#rendering` — the vector-glow pipeline and the `measureText` NaN trap

Relocated from the old "Implementation practices":

> - **Rendering goes through `drawPoly` + `glowStroke`.** New visible entities
>   define local-space point arrays and reuse these — don't invent a new
>   per-entity draw pipeline. Keep the vector-glow look (Pillar 1: no fills
>   except bullets/particles, no sprites, no textures). `drawRingArc(x, y, r,
>   frac, color, width, blur)` (CS009 P1) is the ring/arc equivalent for HUD
>   gauges — routes through `glowStroke` the same way, never `closePath()`s,
>   and doesn't clamp `frac` (overshoot handling is the caller's job).
>   `drawRingSegments(x, y, r, segs, filled, litColor, dimColor)` (CS012 P2)
>   is the segmented-ring sibling — `segs` gapped wedges, the first `filled`
>   lit via `glowStroke`, the rest a plain dim stroke — used for the Scoop
>   level indicator; same never-`closePath()`s convention.
>   `achLeader(x0, x1, y)` + `achTextW(str, size)` (CS026 P6) are the
>   Achievements viewer's dotted name→status leader run and its shared measuring
>   path — **text, not a primitive**: the run is a `drawText`, so it adds no
>   §3.2 fill exception (the count stays at two). ⛔ `achLeader()` is the only
>   render code in the repo that does arithmetic on `ctx.measureText().width`,
>   and several suite stubs return `{width: 0}` — `"·".repeat(span / 0)` is
>   `repeat(Infinity)`, a `RangeError` out of the *menu* renderer. Its guards are
>   written `!(x >= n)` / `!(x > 0)`, never `x < n` / `x <= 0`, because NaN fails
>   every ordinary comparison; keep that form if you touch it.
> - **The HUD draws with `glowStroke` like everything else — no `fillRect`,
>   no `strokeRect`.** The CS009 HUD rebuild (P0–P6) replaced every hull/
>   shield/cargo/powerup fill bar with rings via `drawRingArc`; CS012 P2
>   replaced the Scoop pip row's fill dots with `drawRingSegments`. The only
>   fills left anywhere in `drawHUD()` are `drawText` (`fillText`) and the
>   low-health corner glow's four `createRadialGradient` corner fills, a
>   named, deliberate exception (see the GDD §3.2 no-fills rule: two named
>   exceptions as of CS012 P2, membership changed across CS010–CS012 but
>   each drop/add is individually named there).
>   The corner glow is a fill *by design* — a peripheral, edgeless alarm,
>   not a `glowStroke` arc — so it doesn't count as reintroducing a bar.
>   Don't reintroduce a bar/rect for a new HUD element; follow the ring
>   idiom instead.

Two scope points the compressed rule in `CLAUDE.md` doesn't spell out:

- **Pillar 1's "no fills" has always read "no fills *except bullets/particles*"**
  for the world renderer. The "exactly two exceptions" count in `CLAUDE.md` is
  about `drawHUD()` specifically, and GDD §3.2 is the authority on membership —
  which changed across CS010–CS012, each drop and add named individually there.
- **`achLeader()` is text, not a primitive.** It is a `drawText` run, so it adds
  no §3.2 fill exception; the count stayed at two when it landed in CS026 P6.

The `!(x >= n)` guard form is the part that actually bites. It is not stylistic:
`NaN < n` and `NaN >= n` are *both* false, so only the negated form rejects a
`NaN` span. The failure it prevents is a `RangeError` thrown out of the menu
renderer under a `{width: 0}` stub — a test-only stub crashing shipped code.

---

<a id="scoring"></a>

## `#scoring` — why exactly one `addScore()` bypass exists

Relocated from the old "Implementation practices":

> - **Route all scoring through `addScore()`.** It also handles the HP-repair
>   milestone bonus (post-Phase 2) — bypassing it breaks that logic. **One
>   documented exception (CS012 P5, FLAG-4e):** the auto-shield's
>   `AUTO_SHIELD_SCORE_PENALTY` deduction in `damageShip` subtracts from
>   `game.score` directly (clamped at 0) and MUST NOT go through `addScore` —
>   it's a penalty, not a gain, and routing it through `addScore` would let a
>   score *drop* trip the `nextRepair` milestone. This is the only sanctioned
>   `addScore` bypass; don't add others without the same explicit reason.

The test for a proposed second bypass is the one that admitted the first:
**does the value move the score downward?** `addScore` reads its argument as a
gain and compares the result against `nextRepair`; a negative gain can cross that
threshold from the wrong side and hand the player a repair for taking damage.
Anything that is genuinely a gain has no business bypassing it.

---

<a id="music"></a>

## `#music` — why the scheduler is frozen and tracks are data

Relocated from the old "Implementation practices":

> - **Tracks are DATA. `MusicSys.update()`/`scheduleStep()` and the
>   `layerGates` gain-gating are not to be modified.** New tracks are new
>   entries in `MUSIC_TRACKS`, built by their own `buildXTrack()` — never a
>   scheduler change. `playNote()`'s voice branch (`type`/`noise`/`hp`/`drop`+
>   `dropTime`/`cutoff`+`cutoffTo`+`cutoffTime`+`q`) is the one extension point
>   (v3.6) if a track needs a synthesis capability the current fields don't
>   cover. `tools/music-lab.html` is the composition/audition instrument —
>   tune and audition there, port verbatim, don't hand-tune gains in the live
>   build.

The port-verbatim half is what makes the lab trustworthy: `tools/music-lab.html`
runs a faithful copy of the scheduler, so what it plays is what the game plays —
but only while nobody hand-tunes a gain on either side of the port. Tuning in the
build silently invalidates every future audition.

---

<a id="voice"></a>

## `#voice` — why `VoiceSys` is its own module, and why `phon` is never hand-edited

Relocated from the old "Implementation practices":

> - **`VoiceSys` (Dan's speech, CS010 P9) is a separate module alongside
>   AudioSys/MusicSys — never fold it into AudioSys**, which is a flat bag of
>   one-shot voices that must not grow a sequencer (MusicSys set this precedent).
>   Three non-negotiables: **(1) Lines are DATA.** `VOICE_LINES` is keyed by
>   event, each event an ARRAY of `{text,phon}` alternatives — adding a line is a
>   one-line data edit, never a code change; selection is a plain random pick. A
>   new line's `phon` is composed in `tools/voice-lab.html` and pasted in; the
>   acoustic engine (`PH`, `buildUtterance`/`buildPitch`, `_schedule` — the
>   scheduler, called `_render` before the CS011 P2 split) is ported
>   **verbatim** from that lab like MusicSys/music-lab — don't re-tune it in the
>   build. (The lab's g2p text→ARPAbet layer is deliberately NOT ported — its
>   output is already the baked `phon` strings.) **As of CS011, the port-verbatim
>   rule also covers the `VOICE_STYLES` table and the ring-modulation stage,
>   sourced from `tools/voice-robot-lab.html` (the second voice instrument) — its
>   presets are `Object.assign` diffs, so each shipped style is expanded to a FULL
>   `VOICE_PARAMS`-shaped object (unstated fields from the lab's base `P`) before
>   pasting; the lab's flanger/crush stages do NOT ship. `VOICE_PARAMS` is now a
>   `let`-bound active style re-pointed by `setStyle(id)`, not a fixed `const` —
>   every consumer reads it live; `"off"` never reassigns it. Don't re-tune a
>   style value in the build.** **(2) Route "did an effect end?"
>   through `powerActive(type)`, never `powerFx`** — the latter silently misses
>   the count modes (shots/pieces).

> Every entry
> point is `if (!AudioSys.ctx) return;`-guarded (headless-safe). The low-health
> voice has its OWN latch (`game.lowHpVoiced`) that menus do NOT tear down —
> distinct from the siren latch — so Dan doesn't re-announce on every unpause.

Three mechanical details that the compressed rule elides but that bind anyone
editing this code:

- **A lab preset is an `Object.assign` diff.** Pasting one straight in leaves the
  unstated fields undefined at runtime; each shipped `VOICE_STYLES` entry is the
  preset expanded against the lab's base `P` into a full `VOICE_PARAMS`-shaped
  object *before* it is pasted.
- **`VOICE_PARAMS` is `let`, not `const`** — `setStyle(id)` re-points it and every
  consumer reads it live. `"off"` is the one style that never reassigns it.
- **`_schedule` was called `_render`** before the CS011 P2 split. Old planning
  docs and log entries use the old name.

The `powerFx` prohibition became structural rather than conventional in CS024 P6,
when timed expiry was deleted outright and `powerActive(type)` became the only
way to ask the question at all — see [`#powerup-lists`](#powerup-lists).

---

<a id="voice-queue"></a>

## `#voice-queue` — why "never queue" was over-broad, not wrong

Relocated verbatim from the old "Implementation practices". This is the section
to read before touching the voice gate, and specifically before "restoring" the
older blanket rule:

> **(3) Superseded lines DROP — except the four
> `VOICE_CRITICAL` events, which PARK and are RE-VALIDATED (CS025 P4/P5).**
> The old blanket rule ("superseded lines DROP, never queue — a queue has Dan
> narrating events that finished ten seconds ago") was **OVER-BROAD, NOT
> WRONG**, and the distinction matters if you touch this: its concern is real,
> and what answers it is **re-validation**, not overriding it. What it got
> wrong was applying that concern uniformly to a channel where a priority-1
> line (`cargo_full`) could not win a contest against *anything* — and where,
> the half nobody would guess had ever been broken, the post-line
> `VOICE_COOLDOWN` branch was **PRIORITY-BLIND** and silently ate even
> `health_low` at priority 3. No priority in the system survived it. The rule
> now reads: **four named lines may wait, and only while they are still true.**
> `VOICE_CRITICAL` = `health_low`, `health_relief`, `cargo_full` (CS025 P4) and
> `level` (CS025 P5, out of the playtest gate). A critical line that loses the
> gate is parked on a FIFO queue (`VOICE_QUEUE_MAX`, deduped by event — a newer
> line for a parked event **replaces** it in place, keeping its slot) and is
> exempt from the cooldown gap; at drain time `VOICE_STILL_TRUE[event](entry)`
> restates that trigger's own condition, and a line whose condition has gone
> false is discarded **silently** — never spoken late. **⛔ Criticality is
> ORTHOGONAL to priority — two questions, two tables, don't merge them.**
> Priority answers *may this line INTERRUPT?*; criticality answers *may this
> line WAIT?* `VOICE_PRIORITY` is untouched by all of it: `cargo_full` stays 1
> and `level` stays 2, because promoting either to "make it critical" would
> also let it pre-empt the health tier — a truck-full bark cutting off "hull
> integrity is critical", which is exactly backwards. **Pre-emption is
> unchanged and the queue is purely ADDITIVE**: it catches lines that would
> have been dropped and changes nothing about lines that already speak. **⛔ No
> TTL** — the drain takes no `dt`, because a TTL would tick on the GAME clock
> while `busyUntil` lives on the AUDIO clock (`ctx.currentTime`, which doesn't
> pause). **⛔ Adding a critical event means raising `VOICE_QUEUE_MAX` with
> it**, so the cap stays a structural guard rather than live logic that
> silently eats a real line (`test-cs025-p4.js` §F pins that relationship
> rather than either literal).

The shape of the argument, because it generalises:

1. **The old rule's concern was real** — a queue that replays stale events is a
   genuine failure, and "Dan narrating events that finished ten seconds ago" is
   the exact thing to avoid.
2. **What answered it was re-validation, not override.** `VOICE_STILL_TRUE`
   restates the trigger's own condition at drain time, so a stale line is
   discarded *silently* rather than spoken late. The concern is satisfied, not
   traded away. That is why widening this — queueing more events, adding a TTL,
   speaking a line whose condition went false — reopens a problem that is
   currently closed.
3. **The defect it uncovered was worse than the one it fixed.** The post-line
   `VOICE_COOLDOWN` branch was priority-blind and was eating `health_low` at
   priority 3. No priority in the system survived it, and nobody would have
   guessed that half was broken.
4. **`VOICE_QUEUE_MAX` is a structural guard, not a tuning knob.** It is sized to
   the critical set so the cap can never be reached by legitimate traffic; a cap
   that *can* be hit is live logic that silently eats a real line.
   `test-cs025-p4.js` §F pins the *relationship* between the two rather than
   either literal, which is why adding a critical event must raise the cap.

---

<a id="captions"></a>

## `#captions` — one gate, two outputs, and the two sibling draws

Relocated from the old "Implementation practices":

> **(4) One gate, two outputs (CS011 P2).** `say()` is split into `_emit(line,p)`
> (resolves the ONE cooldown/priority gate, then shows the caption if
> `settings.captions` and speaks if the global `voiceEnabled()`) and
> `_schedule(utt)` (the former `_render` scheduler, now taking a pre-built
> utterance — `buildUtterance` moved up into `_emit`). Keep the gate arithmetic
> byte-identical if you touch it: captions and audio must stay driven by the
> SAME `_emit` gate, so a caption obeys the drop / pre-empt / **park** rules
> exactly like the audio — but captions are INDEPENDENT of voice volume and of
> the Off style (voice Off still captions). **CS025 P4's narrowing of rule (3)
> needed no change here, and that is the invariant working:** a parked critical
> re-enters through the SAME `_emit`, so it captions when it finally PASSES the
> gate at drain time, and a line discarded by `VOICE_STILL_TRUE` never reaches
> `_emit` at all and so is never captioned late either. **"A caption is never
> shown late" is still exactly true** — what changed is *which* lines eventually
> pass, not whether caption and audio agree. Splitting the two outputs is what
> would let them disagree; don't. `drawCaption()` is a SIBLING of `drawHUD()`
> (not inside it — captions survive the `H` capture toggle) and self-gates on
> `game.state === "playing" && !game.paused && game.caption.life > 0`.
> **`drawLevelBanner()` (CS025 P5) is a second such sibling** — the large
> centre-screen "Level N" — but it is NOT a caption: it is set unconditionally
> in `nextWave()`, is independent of `AudioSys.ctx`, `settings.captions` and
> `voiceEnabled()`, and never touches the voice gate. That independence is the
> point (Paul's gate answer set the bar at "we definitely SEE it"), so don't
> "tidy" it into the caption path.

The strongest evidence for the one-gate design is negative: **CS025 P4 rewrote
the drop rule and this code needed no change at all.** A parked critical line
re-enters through the same `_emit`, so it captions exactly when it speaks; a line
`VOICE_STILL_TRUE` discards never reaches `_emit`, so it is never captioned late.
"A caption is never shown late" stayed exactly true through a change that
rewrote which lines survive. Splitting caption and audio into two gates is the
one edit that would break that property.

`drawLevelBanner()`'s independence traces to a specific playtest-gate answer from
Paul: the bar was set at **"we definitely SEE it"** — which is why it does not
consult `AudioSys.ctx`, `settings.captions`, or `voiceEnabled()`, and why folding
it into the caption path is a regression rather than a cleanup.

---

<a id="save-data"></a>

## `#save-data` — three keys, three stores, no migrations

Relocated from the old "Implementation practices":

> - **Three frozen `localStorage` keys — never rename or merge them.**
>   `afd_settings_v1` (options/bindings/difficulty modes/music track; CS011 P3
>   added `voiceStyle`/`captions` additively, CS012 P5 added `autoShield` — all
>   the same way, and all under the same known-value-else-default rule as every
>   other field on this key. **CS017 P6's `chainGuardMode` (`"time"` | `"count"`)
>   is GONE as of CS024 P6**, deleted with timed expiry along with
>   `shotPowerupMode` and `magnetMode`; a value saved under any of the three
>   orphans harmlessly, which is exactly the point of that rule and is why
>   removing a field needs **no key rename and no migration shim**),
>   `afd_achievements_v2` (progress + unlocks), and `afd_scores_v1` (v3.6 P6 —
>   the high-score table) are independent stores, each with its own guarded
>   `storageOK()` try/catch load/save path. None of the three reads or writes
>   either of the others. Renaming any of them to match a future product/version
>   bump silently wipes every player's saved data for that key — see GDD §2.16.

The temptation this rule exists to stop is **renaming a key to match a product or
version bump** — `afd_settings_v2` looks like housekeeping and is a total,
silent, unrecoverable data wipe for every player who has one. The `_v1`/`_v2`
suffixes on these keys are frozen identifiers, not version numbers that track
anything.

The additive/known-value-else-default rule has already been exercised in both
directions: fields added (`voiceStyle`, `captions`, `autoShield`) and fields
deleted (`chainGuardMode`, `shotPowerupMode`, `magnetMode`, all in CS024 P6). A
saved value for a deleted field orphans harmlessly — which is the entire point,
and why neither direction needed a key rename or a migration shim.

---

<a id="scoop-guard"></a>

## `#scoop-guard` — the load-time throw is the feature

Relocated from the old "Implementation practices":

> - **`SCOOP_WIDTH[0] !== 0 || SCOOP_DEPTH[0] !== 0` throws at load time — this
>   is a deliberate invariant guard, not test scaffolding.** It's what makes
>   `inScoopBox` return `false` at `scoopLevel` 0, which is what keeps Debris
>   pickup byte-identical to the pre-scoop build. Don't delete it on a
>   "cleanup" pass; if it ever fires, `SCOOP_CONFIG`/`buildScoopSteps` broke the
>   invariant, not the assertion (GDD §2.14.1).

The guarantee it protects is a compatibility one: **at `scoopLevel` 0 the game
must behave byte-identically to the build that existed before the Scoop shipped.**
A zero-sized capture box is what delivers that, and the throw is what makes a
non-zero one impossible to ship unnoticed. The correct response to it firing is
always to fix `SCOOP_CONFIG` / `buildScoopSteps`, never to soften the assertion.

---

<a id="powerup-lists"></a>

## `#powerup-lists` — two structures, conflated twice, answering different questions

Relocated from the old "Implementation practices":

> - **`POWERUP_DROP_TYPES` is the *budgeted-effect* list, not the drop table.**
>   (It was the "timed-effect" list until **CS024 P6 deleted timed expiry
>   outright** — `powerMode()`, `powerDuration()`, `game.powerFx`,
>   `POWERUP_DURATION`, `MAGNET_DURATION` and `DEBUG.chainGuardTime` are all
>   gone. The **structure is unchanged and the two-structures rule is
>   unchanged**; only the adjective moved, because every effect on this list now
>   expires on a *count* rather than a clock. Don't read the rename as a merge.)
>   It's what the HUD active-effect row / `powerActive()` / `powerBudget`
>   understand, and it deliberately excludes Health (instant) and Scoop
>   (persistent, not budgeted). The **drop table** — what can actually roll
>   out of `dropPowerup()` — is the separate `POWERUP_DROP_WEIGHTS`. This
>   distinction has already caused confusion across two changesets (v3.3 P3,
>   v3.6 P3); don't conflate the two structures a third time (GDD §2.14).
>   **CS017 P6 note:** `"guard"` (the chain guard) is now in **both** — it is a
>   real budgeted effect *and* a real drop — which does NOT merge the
>   structures; they still answer different questions, and Health/Scoop still
>   prove it. **Ask "did an effect end?" through `powerActive(type)`** — as of
>   CS024 P6 that is the only way to ask at all, so the old "never read
>   `powerFx`" discipline is now structural rather than a convention.
>   Two further rules came with it. (1) `POWERUP_DROP_TYPES` is **append-only**:
>   its order fixes each type's HUD row index, so inserting rather than
>   appending silently moves every existing row. (2) `POWERUP_DROP_WEIGHTS` now
>   has its first **conditional** entry — `"guard"` enters the roll only while
>   `game.chain.length >= DEBUG.chainGuardMinTow`, and an ineligible key must be
>   skipped in **both** the running total and the walk so the rest renormalise;
>   skipping it in only one leaves a dead slot that silently drops nothing.

The rename trap is worth stating on its own, because it is the most likely third
conflation: **CS024 P6 changed the adjective, not the structure.** The list was
"timed effects" and is now "budgeted effects" only because timed expiry was
deleted and every remaining effect expires on a count. Reading that rename as
evidence the two structures merged is exactly the mistake this rule guards.

Health and Scoop are the standing proof they are different lists: both are real
drops, neither is a budgeted effect. `"guard"` being in both is not a
counter-example — membership overlapping is what you expect from two lists that
answer different questions about the same objects.

---

<a id="levers"></a>

## `#levers` — why `destroyHunter()` stays 3-way

**Marker note (CS027 P5, Paul's call):** this shipped as `⚠ SETTLED` and was
flipped to `⛔ INVARIANT` the same phase. It reads as both — it *looks* like an
oversight that one kill path isn't levered, which is the `⚠` case — but the
reason it is pinned is that changing it breaks a shipped achievement's
arithmetic, which is the `⛔` definition exactly. `⚠ SETTLED` invites "raise it
with Paul"; this one isn't open for discussion, so it takes the stronger marker.

Relocated from the old code map:

> ⛔ destroyHunter() is NOT levered and stays 3-way
> (ACH_LINEAGE_FULL = 13 depends on it).

The dependency is arithmetic, not stylistic: a full Hunter lineage is
1 + 3 + 9 = 13 kills, and `ACH_LINEAGE_FULL = 13` is a shipped achievement
threshold. Levering the split count would move that total, silently changing an
achievement players have already earned or are partway through.

---

<a id="code-map"></a>

## `#code-map` — the annotated map, and the retired v2.0 in-flight list

**Status:** GDD §3 is the authority on what actually exists; `CLAUDE.md`'s map is
a read-order skeleton. The annotations below were the old map's inline commentary
and are kept because several carry a decision rather than a description.

> - `junkSplit` (CS026 P2) is the 18th lever — the Garbage Satellite split count,
>   ↳-carried by `junkCount`: 2-way through L10, 3-way from L11 on.
> - `WORLD_SIZE_EARLY` + `DEBUG.earlyWorldLevels` (CS026 P3) re-arm the
>   world-size seam: levels 1..5 at 1920x1080, L6+ unchanged, exactly one resize
>   per run.
> - `DELIVERY_FLOAT_DY` (CS026 P6) is the delivery floaters' fixed offset above
>   the SHIP — **deliberately a frozen constant, not a knob.**
> - `GARBAGE_SOFT_MAX`/`HARD_MAX` (CS024 P3) is the density ceiling that replaced
>   Debris decay; `ENGINE_BURN_SECONDS`/`ENGINE_MASS_MULT` + the count budgets
>   (`RAPID_SHOTS` etc.) are the whole of powerup expiry (CS024 P6).
> - `spawnFieldSatellites` is **the ONLY spawn path** as of CS024 P1 — no
>   archetype branch.
> - `magnetPulling` (CS025 P1) is **a FUNCTION, not a local**:
>   `powerActive("magnet") && magnetHoldT <= 0`, the full-cargo suppression
>   predicate.
> - `magnetPushBurst` (CS025 P2) sits at the END of the Debris cluster — the
>   full-cargo repulsion kick + `coalesceDelay` re-arm; a PRODUCER of
>   `coalesceDelay` writes, not a consumer change.
> - `cullGarbage`/`betterCullVictim` are the density ceiling — **there is no
>   decay clock.**
> - VoiceSys `update()` takes **NO `dt`** and is called from the very END of
>   `update()`'s playing body (CS025 P4/P5).
> - `AudioSys` is a singleton; every sound is a method; init on first keypress
>   (autoplay policy); continuous sounds are start/stop node pairs. MusicSys +
>   VoiceSys are separate modules alongside it (never inside).
> - `resize()` is CSS scale only — **game math never touches window size.**
> - `Input`: `keys{}` map + `input.*` predicates; **call sites never read `keys{}`
>   directly.**
> - Chain physics: verlet nodes, **not** entity-pattern — see GDD 3.4 before
>   touching.

And the stale forward-looking inventory, retired rather than carried — every item
in it either shipped under a different name or was abandoned, and GDD §3 has been
the authority throughout:

> **In-flight per the v2.0 plan** (see `PLANNED-FEATURES-v2.md` /
> `IMPLEMENTATION-PHASES.md`): `Asteroid` → `DebrisSatellite` rename (Phase 3),
> `Satellite`/`Wedge` → `HunterSatellite` merge (Phase 5), a `difficultyFactor()`
> helper (Phase 4), a `Powerup` class (Phase 6), a gamepad-aware `input` binding
> table (Phase 7), a menu state machine (Phase 8), and an achievements module
> (Phase 9). Don't assume any of these exist — check `STATUS.md` for what's
> actually landed.

The old map also carried its own hedge, which is why it lost the authority
argument to GDD §3:

> This is the read-order map; it's descriptive (matches what's built), not
> aspirational — check the GDD's Architecture Map table for the authoritative,
> currently-accurate version, since this file updates less often than that one.

---

<a id="tools"></a>

## `#tools` — what each instrument is for, and which one is the active source

Relocated from the old "Design instruments (`tools/`)":

> Standalone HTML files, **not shipped code** — disposable-by-design instruments
> used to pick numbers or compose data before porting the result into
> `orbital-overhaul.html`. Same no-bundler/no-imports rule as the main file;
> each carries whatever small slice of game logic it needs duplicated in place
> (drift here can only ever produce a bad *preview*, never a bad *build*).
>
> - **`tools/scoop-lab.html`** — the Scoop capture-mouth sizing instrument
>   (§2.14.1 of the GDD). Live sliders over `SCOOP_CONFIG`, a level stepper,
>   and draggable Debris pieces highlighted by the real `inScoopBox` math;
>   answers "how big does this look," not "how does this play."
> - **`tools/music-lab.html`** — the music-track composition/audition
>   instrument and the porting source for every `MUSIC_TRACKS` entry (GDD
>   §2.8/§3 MusicSys row). Runs a faithful copy of `MusicSys`'s scheduler, so
>   what it plays is what the game plays; a track is composed and auditioned
>   there, then its builder function is ported **verbatim** into the main
>   file — never hand-tuned in place. See the MusicSys non-negotiable above.
> - **`tools/voice-lab.html`** — the formant-synthesis instrument for Dan's
>   voice (CS010 §11a; **FLAG-11a-gated** — nothing ports until Paul has heard
>   it in the lab and signed off). A Klatt-style Web Audio synth: glottal
>   source → parallel formant bank, ARPAbet phoneme sequencing with consonant
>   locus transitions and VOT, a hand dictionary covering all 24 shipping
>   lines (each line's phoneme string is hand-editable), and a default-on
>   "radio" character chain (spec fallback (a)) as an A/B toggle. Its Dump
>   panel emits paste-ready `VOICE_PARAMS` + `VOICE_LINES` — the porting
>   source for the future `VoiceSys` (CS010 P9), engine and data verbatim.
> - **`tools/voice-robot-lab.html`** — the robot/style + dictionary instrument
>   (CS011), superseding `voice-lab.html` as the active style/data porting
>   source (`voice-lab.html` stays as the CS010 engine source). Six selectable
>   robot-voice presets (`comms`/`comms_f`/`flat`/`flat_f`/`vintage`/`vintage_f`)
>   plus a ring-modulation stage, auditioned live; its Dump panel emits the
>   paste-ready `VOICE_STYLES` table entries and `ring` blocks ported
>   **verbatim** into `VOICE_STYLES` (P1) — the lab's flanger/crush stages do
>   NOT ship. Also the composition source for new phon dictionary entries: the
>   `LEVEL_PHON`/`NUM_PHON` level-announcement vocabulary (P4) and the five
>   `chain_broken` frustration lines (P5) were composed and zero-err-verified
>   here (`parsePhonTokens`) before being pasted verbatim into the build.

The "disposable by design" framing is what makes duplicated logic acceptable
here and nowhere else: **drift in a tool can only ever produce a bad preview,
never a bad build.** That licence does not extend to `orbital-overhaul.html`.

`tools/orbit-lab.html` (orbit geometry) predates this list and was never written
up in `CLAUDE.md`; it is listed in the current file for completeness.

---

<a id="capture"></a>

## `#capture` — why `Capture` is player-facing and what `H` does not affect

Relocated from the old "Capture tools":

> All three keys are inert outside live play (`Capture.active()` gates on
> `game.state === "playing" && !game.paused`), so they can never collide with
> menu navigation or control rebinding.
>
> Two integration points in `loop()` are **load-bearing** — preserve them if
> `loop()` or `draw()` is ever restructured:
> 1. `dt` is multiplied by `Capture.timeScale` (drives O's slow-mo).
> 2. `Capture.afterDraw()` runs immediately after `draw()` (drives P — the
>    canvas must hold a complete, already-composited frame first).
>
> The HUD itself lives in its own `drawHUD()` function (the persistent in-play
> overlay: score, hull HP, level, cargo/targets, active-powerup bars, scoop
> pips, dock/low-health chevrons, shield bar), called from `draw()` gated on
> `Capture.hudVisible`. Menus, achievement toasts, and the game-over text are
> drawn separately in `draw()` and are unaffected by the H toggle.

The `afterDraw()` ordering is the subtle one: **P captures whatever is on the
canvas at that instant**, so it must run after `draw()` has composited a complete
frame. Moving it earlier produces a silently half-drawn export rather than an
error. And because `drawCaption()` and `drawLevelBanner()` are siblings of
`drawHUD()` rather than parts of it (see [`#captions`](#captions)), `H` does not
hide them — nor menus, toasts, or game-over text.

---

<a id="voice-repeat"></a>

## `#voice-repeat` — why repeat suppression is a third mechanism, not a tuning of the first two

Relocated from `CLAUDE.md`'s `### Audio` by CS042 P11's valve firing. The rule stayed;
this is the reasoning that came out with it.

> **Mechanism 1 — the no-immediate-repeat picker**, in `say()`: a uniform pick over the
> alternatives for an event EXCLUDING whichever index was picked last time for it,
> recorded in `lastLine` (keyed by event) at PICK time — not on a successful `_emit` — so
> a pick the gate then drops still rotates. A one-line event (`cargo_full`, `chain_lost`)
> has nothing to exclude and is unaffected, **which is exactly why mechanism 2 exists.**
>
> **Mechanism 2 — the entry-gate repeat window**, in `_emit()`, sitting at the very TOP of
> the gate, above the busy/cooldown branches: an event that passed the gate within its own
> window (`lastSpoke`, keyed by event, stamped in `AudioSys`-clock seconds) is **DROPPED —
> including a critical one, which does NOT park.** Parking it would replay the identical
> line seconds later, which is precisely what this mechanism exists to stop; that is a
> deliberate exception to the park-and-revalidate rule, not a contradiction of it.

Three things make this a separate question rather than a knob on the other two.

1. **The three questions are genuinely independent.** Priority answers *may this line
   interrupt one that is playing?*; criticality answers *may this line wait?*; repeat
   suppression answers *has this event JUST spoken?* An event can be high-priority,
   critical, and still a repeat — and the right answer to a repeat is neither "interrupt"
   nor "wait", it is "say nothing". No table already in the system encodes that.
2. **It was found by playtest, on the two events the picker could not help.** CS038's gate
   B found `cargo_full` and `chain_lost` — both `VOICE_CRITICAL`, both with exactly one
   line, and both made more frequent by CS037 P5's full-tow-release-on-damage change —
   repeating often enough to read as a bug. Mechanism 1 cannot rotate a one-line event, so
   the fix had to sit at the gate rather than at the pick. The same gate confirmed
   `health_low` / `chain_broken` / `chain_guard` (3–4 alternatives each) already read as
   varied, which is what sized CS039's line-authoring worklist to the one-line events
   first.
3. **The clock choice is load-bearing.** The window runs on `AudioSys.now()`, the same
   clock `busyUntil` uses, and takes **no `dt`** — the same no-TTL rule the park queue
   follows, for the same reason: a TTL would tick the game clock while the window's clock
   does not pause. A long pause therefore lets a window *lapse*, which is correct —
   re-saying a line after five minutes is not a repeat.

`level` is exempt (`VOICE_REPEAT_EXEMPT`) because it carries data — a different number
every firing — so consecutive levels are never a repeat. Nothing else shares that
property: the `dock_*` tiers carry data too, but a second `dock_10` genuinely **is** a
repeat of the same line. Both windows (12 s ordinary, 20 s critical) were playtested at
gate B3/B4 and no needed repeat — a genuine second `health_low` after a real recovery, a
`chain_lost` on a separate disaster — was ever eaten. `VoiceSys.reset()` clears both
`lastLine` and `lastSpoke`, so a fresh run picks and repeats unconstrained by the last one.

---

<a id="event-sfx"></a>

## `#event-sfx` — why an event SFX goes at the trigger site and never inside the gate

Written by CS042 P11 alongside the valve firing, from `PLANNED-FEATURES-CS042.md` §1.3 and
FORK-CS042-B. `CLAUDE.md`'s `### Audio` item 9 carries the rule.

The audit that produced CS042 §1 asked a simple question of every voice event: *if Dan
does not speak, does the player learn anything happened?* For most of them the answer was
no. The tow chain filling up, the payload being cut loose, a chain-guard charge absorbing
a hit, a hull edge crossing, a powerup landing or expiring — each announced itself only
through `VoiceSys`, and `VoiceSys` is the one subsystem in the build that is *designed* to
say nothing. It drops a superseded line, parks a critical one, suppresses a repeat, and is
switched off entirely by a settings value many players will use. Every one of those is
correct behaviour for a voice channel and a disaster for an event tell.

So the twelve cues exist to be the layer that never goes quiet, and **that only works if
they are outside the gate.** Placing the call inside `_emit()` — the obvious "one place,
one event" refactor a future session will propose — silently re-imports every rule the
sounds were added to escape: a `cargofull` inside its own repeat window would vanish, a
`chain_lost` pre-empted by a higher-priority line would take its sound with it, and voice
Off would mute the game's event feedback wholesale. The rule is therefore stated as a
*placement*, not as a policy: the call sits at the trigger site, immediately above the
`say()`, and the two are read together. `breakChain()`'s sever tail reads the **same**
`chain.length === 0` predicate the `say()` on the next line uses, so sound and line can
never disagree about what happened.

The sound landing slightly *before* the voice is a consequence of that placement, not a
second mechanism: `_schedule()` leads by 0.10 s. Do not add an offset to "fix" it.

Two smaller placements are load-bearing for their own reasons. `powertag()` carries a
0.16 s internal offset so the tag lands after `AudioSys.powerup()`'s second note — that
offset is measured against `powerup()` starting immediately before it, so moving the call
anywhere else makes the offset wrong rather than merely different. And `guardblock()` is
the one **replacement** among the twelve: `breakChain()`'s guard branch used to borrow
`AudioSys.shieldPing()`, which §1.4's audit found made chain armour and the ship's own
shield indistinguishable — the defect the new cue exists to fix. Its comment is rewritten
in place to record the reversal rather than deleted.

The port-verbatim rule is the same one music already lives under, for the same reason:
`tools/sfx-lab.html` auditioned three candidates per sound at the volume the game plays
them at, and the picks are only meaningful while nobody re-tunes a gain on either side of
the port. That is why the suite pins all twelve byte-for-byte against `CS042-GATE-A.md` —
a re-tuned gain is the one failure a behavioural test can never see.

---

<a id="cs042-health"></a>

## `#cs042-health` — why the health supply grew three qualifiers and the bank grew a second job

Written by CS042 P11 from `PLANNED-FEATURES-CS042.md` §2 and §4.5. `CLAUDE.md`'s
`### Healing` carries the rules.

**The flood was measured, not felt.** CS040's own telemetry showed the score milestone
supplying 63% / 62% of all healing across two captures, and climbing with wave on its own
because score *rate* climbs with wave while the milestone interval was flat. CS040 P1 had
already stopped the milestone healing directly; what remained was that it kept *spawning*,
faster and faster, at exactly the point a run should be getting harder. The growth term
(`repairMilestoneGrowth`) answers that half arithmetically rather than by capping anything,
and at 0 the interval is flat again and CS040's numbers return byte-for-byte.

**The hull gate answers a different half.** A milestone crossing at 96% hull was buying a
pickup for a scratch. `repairMilestoneHullPct` makes a crossing pay only while the player
is genuinely hurt. The older `< SHIP_MAX_HP` clause is deliberately kept beside it so the
knob at 1.0 reduces to CS040's rule exactly — a clean A/B rather than an approximation of
one.

**Two bounds, two questions, and only one of them is a knob.** Whether two Health pickups
may exist at once is a yes/no design rule, so the one-at-a-time gate has no dial; how often
any route may spawn is a rate, so `healthSpawnLock` has one. Moving the count gate out of
the ambient call site into `spawnHealthPowerup()` **reverses CS040 P1**, whose own comment
predicted this exact change and called it "a design change, not a tidy-up" — that comment
is rewritten in place rather than deleted, because the reversal is only legible beside it.

One consequence the spec did not reach: when the Super Mega Delivery's per-piece roll lands
on Health while the lock is up, Health leaves the pool and the piece rolls over the other
six. Dropping nothing was written first and broke a shipped guarantee two older tests pin
by name — every budgeted swept piece pays exactly one powerup. The sweep's payout volume is
therefore unmoved and at most one Health arrives per sweep.

**The bank's second job is a threshold on the post-damage hull, and that is the first thing
a future reader will question.** `s.hp -= amount` runs near the top of `damageShip()`, so by
the time the spend is reached the hull is essentially never at maximum — a literal full-hull
test there would be dead code that never fired once. This was built and measured: replacing
the shipped predicate with `s.hp >= SHIP_MAX_HP` and driving both builds over ten
post-damage hulls spares 6 times on the shipped one and **0** on the counterfactual.

`repairMilestoneHullPct` and `bankSpareHullPct` are the same 0.70 because CS042 has exactly
one definition of "hurt", and the suite asserts they are *equal* rather than each being
0.70 — so a one-sided retune fails rather than quietly splitting the definition.

At the shipped 2-hit loss rate a charge buys **half** a scoop level, not a whole one. That
follows from a judgment call §4.5 does not reach: a spared hit does not advance
`game.scoopHits` either. The alternative — let the tally climb and block only the level
drop — spends a charge silently on every hit that was not yet the costly one, which is
exactly what the `"SCOOP SAVED"` floater exists to prevent. If a charge should buy a whole
level, that is a different mechanism, not a tuning change.

---

<a id="cs042-mass"></a>

## `#cs042-mass` — why four cargo divisors became one mass, and why two of the results are deliberate

Written by CS042 P11 from `PLANNED-FEATURES-CS042.md` §6.8. `CLAUDE.md`'s
`### Math and lifecycle` carries the rule.

**This shape came out of a null result, not a preference.** `CARGO_THRUST`,
`CARGO_MAXSPD`, `CARGO_MASS` and `CARGO_TURN` were four separately hand-tuned coefficients
for four symptoms of one physical fact, and three full passes through
`tools/handling-lab.html` produced no set Paul trusted. The structural reason is that
`1/(1 + m·k)` **asymptotes**: raising `k` can never make a mid haul bite without
over-penalising a full one, which is why CS010 had leaned on the tug for mid-range heft and
shipped `CARGO_TURN` dormant as "the real structural fix for inertia". The lab also
diagnosed a defect none of the coefficients could reach — drag was `(1 − SHIP_DRAG)^dt`
with **no cargo term at all**, so an empty ship and a 24-node haul both bled to a tenth of
their speed in the same 5.35 s. Mass set the ceiling and then stopped mattering.

Paul's direction, verbatim: *"I just want to affect the 'effective mass' of the cargo, and
the 'effective thrust' added by the engine powerup, and have you or the game code calculate
all that other business within reason for a ship and cargo flying in the relative
weightlessness of space."*

So `M = 1 + chainMass() × cargoUnitMass`, and every handling term is that one mass under
one force. `CARGO_UNIT_MASS` ships at 0.07 — `CARGO_THRUST`'s own old value — chosen so
**acceleration is byte-identical to every build since CS010 at every chain length**. What
moves is coast (5.3 s → 14.3 s), turn (241 → 90 °/s) and the tug's mid range, every column
monotonic in node count with no clamp anywhere. At 0 the ship is weightless however much it
tows, which is the one-knob A/B for the entire model.

**Two consequences were flagged before they shipped and closed at GATE C as right.**
Terminal speed is `SHIP_THRUST/λ₀` regardless of load, so the top-speed penalty disappears
and a full haul can eventually reach 520 where it used to clamp at 283 — it takes 5.6 s to
get there and then cannot stop for 14 s. **Mass limits agility, not speed**, which is what
"relative weightlessness" means. And rotation is penalised by construction, reversing
FLAG-CS042-j's earlier close; under one mass there is no way to exempt rotation without
special-casing it back out, and §6.8 declines to.

**`CHAIN_TUG` 26 → 58 is derived, not tuned.** The mass factor changed form from the
clamped `min(1.4, m·CARGO_MASS)` to the physical `(M−1)/M`, which at 24 nodes is 0.627
where the old clamp was 1.4; 26 × 1.4 = 36.40 and 58 × 0.627 = 36.36, so a full chain tugs
exactly as hard as before. Re-solve it from that same equality if `cargoUnitMass`'s default
ever moves.

**The cost, measured and not softened:** only the endpoints were held. The two curves cross
at m ≈ 8 — below it the new tug is stronger (+37% at 2 nodes, +22% at 4), above it weaker,
worst at m = 14 (**−21%**), recovering to −0.1% at 24. That is what retiring the 14-node
flat spot costs, and CS010 P2's own reason for raising `CARGO_MASS` was exactly that
mid-range heft. If a mid haul ever reads floaty, a `CHAIN_TUG` retune is the first place to
look — and it re-opens GDD §3.4's stability envelope, which CS042 P7 re-validated at 4.112
px, byte-identical to its parent.

GATE A's own lesson is worth keeping with this: a mock ship on an empty field has no
enemies, no dock, no chain to lose and nothing to be late for, which is most of what makes
a haul feel heavy. Inertia was not judgeable outside a real run, and that is why the two
knobs went into the debug panel at values reproducing the old build and the question went
to GATE C.

---

<a id="cs042-scoop"></a>

## `#cs042-scoop` — the cap versus the mouth's span, and why the field is dashed rather than faint

Written by CS042 P11 from `PLANNED-FEATURES-CS042.md` §4 and GATE C's G4. `CLAUDE.md`'s
`### Two traps` and `### Rendering` carry the rules.

**The two constants.** `buildScoopSteps()` divides by `(N − 1)`. Raising the cap 5 → 7
while `N` stayed the cap would re-spread the same min→max range over seven steps and
silently shrink every existing level — L2's mouth 38.7 → 33.0 px, L3 55.8 → 44.4, L4
72.9 → 55.8, with only L1 and L5 held. Nothing would have failed; the levels the player
already knew would simply have got smaller. FORK-CS042-A resolved to give the mouth its own
span (`SCOOP_MOUTH_LEVELS`, 5) and let levels above it clamp to the top step, so **the
mouth's numbers do not move when the cap does**. Both readings were measured rather than
argued: the new builder fed the parent's own config reproduces levels 1–5 bit-for-bit, and
the counterfactual shrinks exactly 2, 3 and 4.

**Why the orbs, rather than a wider mouth.** §4.2 measured that the levels were not
discernible in play, and a bigger cone reads as a bigger number. Levels 6–7 grant the
Scoop's first *lateral* reach instead — the first level that gives a capability. The
predicate was deliberately not forked to do it: one disc test off `inScoopBox()`'s existing
`shortDelta()` projection, so both callers get the orbs for free and a fresh `Math.hypot`
never gets a chance to break at the wrap seam.

**Why the level-1 floor moved.** At `minWidthMult` 1.2 / `minDepth` 20 the L1 mouth sat
almost entirely inside the 18-px base pickup disc: 713 px² of box against a 1,018 px²
circle. The first Scoop pickup — the one that teaches what a Scoop *is* — changed almost
nothing. At 2.6 / 34 it is 2,200 px², unmistakably outside the circle. ⚠ The spec's claim
that this puts L1 "just ahead of the Magnet" is wrong on its own numbers: the Magnet's
boosted circle is 2,606 px², so L1 sits below it and §4.2's finding that the Magnet beats
Scoop levels 1–2 outright still holds at level 1. The constants shipped as specified;
moving them further to clear the Magnet would be new design.

**Why the render is dashed and not faint (GATE C, G4).** Paul's playtest read was that the
mouth V and the orbs look like *ship geometry* — solid glow-strokes that imply hittable
hull — so a hit landing near an orb feels as though it should have hurt. Nothing the Scoop
draws has ever been collidable: `inScoopBox()` is a capture test and no collision pass
reads any of those points. The render was contradicting the mechanics.

Two directions were on the table and neither was chosen at the gate. Transparency is not
available in that block: `ctx.globalAlpha` there belongs to the level-end grace pulse's
SET-DRAW-RESTORE, which is the same reason CS042 P8 made the level-7 tether a **colour**
choice rather than an alpha one. Composing a second alpha writer correctly is possible but
reverses a call made one phase earlier, and — more to the point — **a faint outline is
still an outline.** It dims the boundary without stopping it reading as one, and G4 is
about what the shape *means*, not how loud it is.

A broken outline is a different claim: it does not read as a surface at all.
`glowStroke`'s `shadowBlur` paints a continuous halo through the gaps while the bright core
stays broken, which is the energy-field look rather than a dashed line on a blueprint. The
cost Paul flagged is real but small — two `setLineDash()` calls per drawn frame, on the
ship alone, and only while a scoop exists. `drawPoly`/`glowStroke` stay dash-agnostic on
purpose: the pattern belongs to the one caller that wants it, so every other stroke in the
build keeps working without knowing the feature exists. The clear is mandatory rather than
tidy — `drawPoly()`'s own `save()`/`restore()` *preserves* a dash, so an unclosed window
would dash the hull, the flame, the shield and every entity drawn after the ship.

⚠ It shipped unseen in a browser. 6/6 px was sized off the shapes it strokes (13–18 dashes
around an orb ring), not picked round, but whether it reads right is the first thing to
look at next.
