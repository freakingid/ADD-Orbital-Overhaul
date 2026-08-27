# PLANNED-FEATURES-CS041.md

**Changeset:** CS041
**Base:** `89662b4` ("cs040 p8: doc sweep + 1.0.0.40"), `GAME_VERSION 1.0.0.40`
**Theme:** Make the live docs cheap to load without losing what they protect. **No build code changes anywhere in this changeset.**

**Evidence base:** a measurement pass run at CS040 P8's close, reproduced in §1. Every number below is from the repo at `89662b4` and is re-measurable with the snippets in §1.4.

---

## 0. Scope

**The problem, in one line:** `ORBITAL-OVERHAUL-GDD.md` is **534 KB**, and CLAUDE.md's document map tells every session to read **§1–§3 before code** — which is **91% of the file**. That is ~130K tokens of context spent before a phase has read a single line of build source.

**In:**

1. A **read contract** change — the GDD gains a §0 index and CLAUDE.md's "read §1–§3" rule becomes "read §1, §3's skeleton, and the §2.x subsections your phase actually names." **No content deleted.**
2. §3's **Constants** table cell — a 22.5 KB changelog living in one table cell — replaced by a pointer to the build's own constants block.
3. **Conditionally, and only if GATE C says it is still wanted:** a prose trim of §2/§3, moving per-changeset narration into a new log file and leaving current-state-plus-protective-history behind.

**Explicitly out:**

- **Any build change.** `orbital-overhaul.html` is not touched by any phase in this changeset. If a phase finds a doc/build disagreement, it **records it in `STATUS.md` and stops** — correcting the build is a different changeset.
- **Renumbering, merging, splitting or reordering any GDD section.** See §2.1 — this is an ⛔ INVARIANT, not a preference.
- **Editing any file under `log/` or `archive/`.** Those are a historical record (CLAUDE.md). Trimmed prose goes to a *new* file; no closed changeset log is appended to or rewritten. See FORK-CS041-C.
- **Touching `RATIONALE.md`.** It is 43 KB but is already on a "pull one section on demand" contract, so it does not load by default and is not this changeset's problem.
- **Trimming `log/pre-CS009.md` (545 KB) or any other log.** They are large and that is fine — CLAUDE.md already says never read them by default.

---

## 1. The measurement

### 1.1 Where the weight is

| file | size | loaded when |
|---|---|---|
| `ORBITAL-OVERHAUL-GDD.md` | **534 KB** | §1–§3 "before code" = **91% of it** |
| `CLAUDE.md` | **46.6 KB** | **every session, unconditionally** |
| `RATIONALE.md` | 43 KB | on demand only — fine |
| `DIFFICULTY-LEVERS.md` | 28 KB | when touching difficulty — fine |
| `STATUS.md` | 10.6 KB | every session — fine, has a self-imposed ~400-line cap |
| `log/` (20 files) | 2.27 MB | never by default — fine |

Inside the GDD:

| span | size | note |
|---|---|---|
| §1 Vision & Pillars | 1.9 KB | genuinely always-read |
| **§2 Current Mechanics** | **395 KB** | the bulk |
| **§3 Code Architecture Map** | **107 KB** | of which the Constants cell is 22.5 KB |
| §4–§7 | ~30 KB | outside the "before code" span already |

Nine §2/§3 sections carry 381 KB — 73% of the file:

| bytes | ⛔ | ⚠ | section |
|---|---|---|---|
| 94,200 | 13 | 1 | `## 3. Code Architecture Map` |
| 46,999 | 2 | 0 | `### 2.16 Pause Menu, Options & Control Rebinding` |
| 44,904 | 10 | 2 | `### 2.14 Powerups` |
| 41,469 | 16 | 0 | `### 2.10 Radioactive Salvage, Tow Chain & Recycling Dock` |
| 41,339 | 3 | 0 | `### 2.8 Audio` |
| 31,562 | 7 | 0 | `### 2.19 Debug Options` |
| 30,790 | 4 | 1 | `### 2.5 Hunter Satellites` |
| 28,476 | 8 | 1 | `### 2.17 Achievements` |
| 21,818 | 27 | 2 | `### 2.20 Achievement Celebration Panel` |

### 1.2 ⛔ The history is WOVEN, not blocked — no mechanical trim is possible

This is the finding that shapes the whole changeset. A first instinct is that the GDD's per-changeset narration sits in extractable blocks (`(History: …)`, `[RETIRED …]`) that a script could lift out. **It does not.** Measured:

- `(History: …)` parentheticals: **1 hit, 184 bytes.**
- `[RETIRED …]` blocks: **4 hits, 2,801 bytes.**
- `*(History …)*` italic bullets: **2 hits, 872 bytes.**

Together **0.7% of the file.** Meanwhile there are **1,285 version/changeset stamps** (`v3.4 P2`, `CS017 P6`, …), 257 distinct — **one every 411 characters** — and they are embedded mid-sentence:

> `SCOOP_HITS_PER_LEVEL` (**5** as of v3.4 P3, was 2)

That compact form is *good* and costs almost nothing. The expensive form is the multi-hop chain, and the two are interleaved inside single bullets. **Any phase that tries to regex this will either miss almost everything or destroy protective history.** The trim, if it happens at all, is a sentence-by-sentence human rewrite.

### 1.3 ⛔ Two hard constraints a trim must respect

**(a) Section numbers are load-bearing across the entire repo.** Measured § references:

| source | count |
|---|---|
| `orbital-overhaul.html` source comments | **619** |
| GDD internal | **565** |
| `CLAUDE.md` / `DIFFICULTY-LEVERS.md` / `RATIONALE.md` / `STATUS.md` | 51 |

**⛔ No section may be renumbered, merged, split or reordered.** A section that empties out is left as a stub pointing at where its content went; it does not disappear and its neighbours do not shift up.

**(b) Three test files assert on the GDD's literal prose.** A trim can turn the suite red. The four pins, verbatim:

| test | assertion |
|---|---|
| `test-cs026-p2.js` | `/3-way split/` **must match** |
| `test-cs026-p2.js` | `/junkSplit/` **must match** |
| `test-cs026-p3.js` | `/2560/` **must match** |
| `test-cs026-p6.js` | `/plus two deliberate exceptions/i` **must match**, `/three deliberate exceptions/i` **must not** |

These are cheap to preserve once known, and invisible if not. **Every trim phase runs the full suite**, which is what makes this a testable constraint rather than a hope.

### 1.4 Reproducing the measurement

```bash
# section sizes + marker density
python3 - <<'EOF'
import re
c=open('ORBITAL-OVERHAUL-GDD.md').read().splitlines()
m=[(i+1,l) for i,l in enumerate(c) if re.match(r'^#{2,3} ',l)]
r=[]
for i,(n,t) in enumerate(m):
    e=m[i+1][0]-1 if i+1<len(m) else len(c)
    b="\n".join(c[n-1:e]); r.append((sum(len(x)+1 for x in c[n-1:e]),t[:70],b.count('⛔'),b.count('⚠')))
for s,t,a,w in sorted(r,reverse=True)[:12]: print(f"{s:7d} {a:3d} {w:3d}  {t}")
EOF

# the constraint checks
grep -o '§[0-9]\+\(\.[0-9]\+\)*' orbital-overhaul.html | wc -l   # build->GDD refs
grep -rn "ORBITAL-OVERHAUL-GDD" scratchpad/*.js | grep readFileSync
```

---

## 2. The change

### 2.1 ⛔ Standing invariants for every phase in this changeset

1. **No build edit.** `orbital-overhaul.html` is not in any phase's diff. (P1 edits CLAUDE.md, which is not the build.)
2. **No section renumber, merge, split or reorder** — §1.3(a).
3. **The four literal prose pins keep matching** — §1.3(b). Run the suite.
4. **No file under `log/` or `archive/` is edited.** New files may be added to `log/`.
5. **Every ⛔ and ⚠ marker survives, with its reasoning intact.** A marker may be tightened; it may not be dropped, and its *why* may not be reduced to its *what*.
6. **Zero suite skips at close**, the standing rule.

### 2.2 Lever A — the read contract (P1). The cheap win.

Nothing is deleted. Two edits:

**The GDD gains a `## 0. How to read this document`** immediately after the title — a one-screen index: what each §2.x/§3.x subsection covers, its approximate size, and a one-line "read this when you are touching X." Roughly 3–4 KB.

**CLAUDE.md's document map row changes** from:

> `ORBITAL-OVERHAUL-GDD.md` | Design intent + shipped behavior. §2 = shipped only. | **§1–§3 before code**

to a rule of the shape:

> `ORBITAL-OVERHAUL-GDD.md` | Design intent + shipped behavior. §2 = shipped only. | **§0 index + §1 always; then the §2.x/§3.x subsections your phase names**

**Expected effect:** typical per-session GDD load falls from ~505 KB to **§0 + §1 + two or three named subsections ≈ 40–80 KB**. That is a larger reduction than the entire trim in §2.4 could achieve, at zero risk of losing a word.

⚠️ **The one real risk, and it is the gate's subject.** The current rule is blunt but safe: read everything, miss nothing. A named-subsection rule can miss a section the phase prompt did not think to name — a phase touching the dock might not think to name §2.14 Powerups, and the recycle hub lives in both. **§0's job is to make that failure unlikely** by describing each section in terms of *what you might be touching*, not what it is called. GATE C tests exactly this.

### 2.3 Lever B — the §3 Constants cell (P2). Surgical, no judgment call.

`## 3. Code Architecture Map`'s **Constants** row holds a single table cell of **22,520 bytes** — one line of markdown. It is a complete append-only changelog of every tuning constant added, retired or retuned since v1.1, in a document whose own §2 rule is "shipped only."

It is also **redundant three ways**: the current constants are in the build's own constants block (grouped by system, per CLAUDE.md's Build rules); the retune history is in `log/CS0##.md`; the difficulty-relevant subset is in `DIFFICULTY-LEVERS.md` §4/§6.

Replace the cell with a short pointer: what lives in the constants block, how it is grouped, the invariants (`WORLD_*` vs `VIEW_*`, "change balance here first, never hardcode deeper"), and where the history is. Target **≤1.5 KB**, a ~21 KB saving from one edit.

⛔ The cell contains **13 ⛔ markers** across §3 as a whole. Before deleting a line, check it is not one of them or their reasoning — several sit inside this cell (e.g. the `POWERUP_RADIUS` **30** / `DOCK_RADIUS` **88** "do not restore 1×" rule). Those move into the replacement text; they do not go to the log.

### 2.4 Lever C — the §2/§3 prose trim (P3–P8). **Conditional on GATE C.**

**Honest expected win: 30–40% of §2/§3, i.e. 522 KB → ~330–370 KB.** Not transformative, and *smaller than what Lever A delivers in one session.* This is why it sits behind a gate.

**The trim rule** — the intellectual content of the whole changeset, and what GATE D validates:

**KEEP, in the GDD:**
- Current shipped behaviour, values, and mechanism.
- Every ⛔ / ⚠ SETTLED marker **and its reasoning**.
- **Protective history** — a record of a decision that was made, reversed, or re-decided, whose purpose is to stop it being re-opened. §2.14.1's V→box→V bullet ("*that trade was already made knowingly — don't re-decide it, ask Paul first*") is the archetype. This is history, and it is **load-bearing**; deleting it invites exactly the re-litigation it prevents.
- Compact inline old values where a nearby comment or knob `def` depends on them — `(5, was 2)` costs nothing.
- The four literal test-pinned phrases (§1.3b).

**MOVE to `log/`:**
- Multi-hop retune chains where only the endpoint is live: *"v3.4 P2 set it 3.0, v3.6 P1c raised it to 5.0, CS035 P1 retuned to 4.0"* → **"4.0"**.
- Narration framing on unambiguous current state — "for the first time", "still", "no longer", "as of CSxxx" — where the sentence reads correctly without it.
- Restatements of a rule `CLAUDE.md` already pins. (Worked example: §2.14's "`game.powerFx` is gone" is redundant with CLAUDE.md's ⛔ "*ask 'did an effect end?' through `powerActive(type)`, never `powerFx`*" — the CLAUDE.md pin is the one that gets read.)
- Phase attribution on settled behaviour that no live cross-reference points at.

**The test for a borderline sentence:** *does a session that has never read `log/` make a worse decision without this?* Yes → keep. No → move.

**Worked example**, from §2.14 (962 → ~700 chars, ~27%):

> **Before:** …**As of CS024 P6 that includes Engine and Guard for the first time** — a second Engine adds ten more seconds… **Magnitude still never stacks:**… `game.powerFx` is gone. **The banked amount is always read through `powerBudgetAmount(type)`, never `POWERUP_BUDGET[type]` directly** — the frozen table deliberately omits `guard` and `engine`…
>
> **After:** …including Engine and Guard — a second Engine adds ten more seconds… **Magnitude never stacks:**… **The banked amount is always read through `powerBudgetAmount(type)`, never `POWERUP_BUDGET[type]` directly** — the frozen table deliberately omits `guard` and `engine`…

The protective clause survives verbatim; three narration fragments go.

### 2.5 CLAUDE.md's own ceiling (P1, small)

`CLAUDE.md` is 46.6 KB and **auto-loads every session unconditionally**. Unlike `STATUS.md` — which has an explicit "~400 lines, the closing phase rolls it into the log" discipline — CLAUDE.md has **no size ceiling and only grows**; CS040 P8 alone added ~30 lines. Its largest sections are Audio (5.3 KB), Save data (3.8 KB), Code map (3.4 KB), Leaderboard (2.6 KB), Telemetry (2.5 KB).

**Not a trim this changeset.** P1 adds a stated ceiling and a pressure valve: a rule that a section past a size threshold moves its *reasoning* to `RATIONALE.md` (which already exists for exactly this, on an on-demand contract) and keeps its *rule* here. This is the mechanism CLAUDE.md's own header already describes — "**This file states rules, not reasons.** Reasons live in `RATIONALE.md`" — applied to itself.

---

## 3. Forks — ⛔ ALL OPEN, none may be resolved inside a session

| id | question | recommendation | why it needs Paul |
|---|---|---|---|
| **FORK-CS041-A** | Does a **docs-only** changeset bump `GAME_VERSION`? | **No.** Leave at `1.0.0.40`; leave the two live version pins (`test-cs016-p5.js`, `test-cs021-p4.js`) un-repointed. | Every prior changeset bumped, but every prior changeset also changed the build. `GAME_VERSION` is stamped into high-score records and the leaderboard payload as the *build* identifier — moving it for a doc edit makes two runs on byte-identical game code report different builds. The counter-argument is that the closing-phase ritual is uniform and worth more than the precision. **This is a genuine call, not a detail.** |
| **FORK-CS041-B** | Is Lever C (the trim) wanted at all, once Lever A has landed? | **Decide at GATE C, not now.** | Lever A alone plausibly solves the problem. Lever C is 6+ sessions of judgment-heavy editing for a 30–40% reduction of a file that would no longer be loading in full. Committing to it before measuring A's effect is the expensive mistake. |
| **FORK-CS041-C** | Where does trimmed narration go? | **A new `log/GDD-TRIM-CS041.md`.** | The obvious answer — append each fragment to its originating `log/CS0##.md` — **edits closed historical records**, which CLAUDE.md treats as sacred ("`log/` and `archive/` are a historical record"). A single new file preserves everything, edits nothing, and is itself never read by default. |
| **FORK-CS041-D** | Does §0 list **sizes** per subsection? | **Yes.** | A session choosing what to read benefits from knowing §2.16 is 47 KB and §2.9 is 6.7 KB. The cost is that §0 needs re-measuring whenever a section grows materially — a closing-phase chore, and a small one. Declining is defensible; it just makes §0 less useful. |

---

## 4. Flags

| id | item | status |
|---|---|---|
| **FLAG-CS041-a** | §3's Constants cell (§2.3) is separable from the rest of Lever C and needs no judgment rule. | Scheduled as **P2, before GATE C**, so the gate sees both cheap wins before ruling on the expensive one. |
| **FLAG-CS041-b** | `CLAUDE.md` has no size ceiling (§2.5). | P1 adds one. **The threshold number is a guess** and should be revisited once it has bound something. |
| **FLAG-CS041-c** | §0's per-subsection sizes go stale as sections grow. | If FORK-D is yes, the closing phase re-measures. Consider adding the re-measure to the standing closing-phase checklist in `CLAUDE.md`'s STATUS.md-format section. |
| **FLAG-CS041-d** | A doc/build disagreement found mid-trim. | **Record in `STATUS.md`, do not fix.** Correcting the build is out of scope (§0) and would put build code in a docs-only changeset's diff. |
| **FLAG-CS041-e** | §2.20 Achievement Celebration Panel is 21.8 KB carrying **27 ⛔ markers** — by far the highest marker density in the file. | It may be almost entirely protective, i.e. nearly untrimmable. Trim it **last**, and treat a small reduction there as the correct outcome rather than a failure. |

---

## 5. Gates

**GATE C — blocking, after P2.** The question is whether Lever A worked, and therefore whether Lever C should happen at all (FORK-CS041-B).

1. Run one real, normal phase of other work under the new read contract. Did §0 point at the right subsections?
2. Did anything get missed that the old "read §1–§3" rule would have caught?
3. Is the remaining load acceptable — is the trim still worth 6+ sessions?
4. FORK-CS041-A: does this changeset bump `GAME_VERSION`?

⛔ **If GATE C says the trim is not needed, the changeset closes at P9 with P3–P8 unbuilt, and that is a good outcome** — the same shape as CS040's no-op P7.

**GATE D — blocking, after P3.** Only reached if GATE C greenlights Lever C.

1. Read P3's diff for the one worked section. Is the KEEP/MOVE rule (§2.4) drawing the line in the right place?
2. Is anything protective missing?
3. Is the reduction worth the reading loss?

⛔ **GATE D is a diff review, not a playtest.** It is the only thing standing between a correct rule and the same wrong rule applied to eight more sections.

---

## 6. Suite

**No new test file is required** — this changeset ships no behaviour. The suite's role here is as a **tripwire**, and it is already wired:

- The four prose pins (§1.3b) catch an over-aggressive trim.
- The scope pins in `test-cs034-p6.js` / `test-cs034-p7.js` / `test-cs027-p6.js` already allowlist `ORBITAL-OVERHAUL-GDD.md`.

**Every phase runs `node scratchpad/run-all.js` and must close at 171/171, 0 skips.** A phase that edits no build code and no test file has no business changing that number; if it does, the trim broke a pin.

⚠️ Phases that add a `_phase-ref.js` scope pin: **do not write a "no design doc was touched" pin** — CLAUDE.md marks that ⚠ SETTLED as unsurvivable by construction, and in this changeset the design doc *is* the subject.
