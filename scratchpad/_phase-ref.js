// scratchpad/_phase-ref.js — the phase-reference helper for the headless suite.
// Built by CS026 P1 per archive/PLANNED-FEATURES-CS026.md §4.
//
//   const { parentSource, ownCommit, ownCommits, changedFiles, outsideScope, SKIP_TAG } = require("./_phase-ref.js");
//
// CS027 P2 added outsideScope() — see the section above module.exports.
//
// Node CommonJS, like everything else in scratchpad/. Not a no-modules violation — that rule binds
// `orbital-overhaul.html`, which never loads this.
//
// ============================================================================================
// ⛔ THE DECOMPOSITION IS THE OPPOSITE OF THE OBVIOUS ONE (§4.1)
// ============================================================================================
// The obvious helper is `parentOf(subjectPrefix)` — resolve the parent by searching history for a
// subject. That is the WRONG way round, and CS025 P1/P2 already ship the right way round:
//
//   * THE PARENT IS A HARDCODED LITERAL SHA. It is a FIXED reference, and it is known at write
//     time because it is simply `HEAD` before the phase commits. Ten pins across four changesets
//     were repaired because they were written against a MOVING reference; a literal cannot move.
//   * THE PHASE'S OWN COMMIT IS WHAT GETS RESOLVED DYNAMICALLY, by subject, and only within
//     `PARENT_SHA..HEAD` — a bounded range that cannot reach back into unrelated history.
//
// So: `parentSource(sha)` takes the literal, and `ownCommit(parentSha, subjectPrefix)` does the
// searching. The bodies below are LIFTED from `test-cs025-p2.js` (:174, :1185, :1191) rather than
// re-derived — that is the shape already proven to work across two phases.
//
// ============================================================================================
// ⛔ FORK-CS026-H — SKIP, LOUDLY (Paul's answer; §0.1, resolution (c))
// ============================================================================================
// Before this phase the suite was inconsistent on a shallow clone (`git clone --depth 1`):
// `test-cs025-p1.js` / `-p2.js` skipped their git-dependent pins SILENTLY and passed, while
// `test-cs025-p5.js` §G HARD-FAILED (`89 passed, 1 failed`). Reproduced, then settled uniformly:
//
//   Every git-dependent pin SKIPS when history is unavailable — but LOUDLY, printing SKIP_TAG and
//   counting the skip in the file's own summary line, so a vacuous run is VISIBLE rather than
//   silent. The CLOSING PHASE of the changeset asserts the suite runs with ZERO skips, which is
//   what stops a pin passing vacuously forever.
//
// `SKIP_TAG` is exported so all three files emit the SAME string and the closing phase has one
// literal to grep for. Do not reword it per file.
//
// ============================================================================================
// RETURN CONTRACT — `null` ALWAYS MEANS "COULD NOT ASK", NEVER "THE ANSWER IS EMPTY"
// ============================================================================================
// Every function returns `null` when git history is unavailable (no checkout, shallow clone, the
// SHA unreachable). An EMPTY ARRAY from `changedFiles`/`ownCommits` is a real answer meaning
// "nothing matched". Callers must distinguish the two: `null` is the skip signal, `[]` is data.

"use strict";
const path = require("path");
const { execFileSync } = require("child_process");

const repoRoot = path.join(__dirname, "..");

// The one string every skipped git-dependent pin prints. The closing phase greps for it.
const SKIP_TAG = "SKIPPED (no git history)";

// ⛔ `stdio: ["ignore", "pipe", "pipe"]` is load-bearing, not tidiness. execFileSync INHERITS the
// parent's stderr by default, so on a shallow clone git's own `fatal: bad revision ...` lands in
// the test run's output before the throw is even caught — which is exactly how the pre-CS026 suite
// printed a bare `fatal:` line above an otherwise-clean run. Capturing it makes SKIP_TAG the only
// report a skipped pin produces.
function git(args, opts) {
  return execFileSync("git", args,
    Object.assign({ cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] }, opts || {})).toString();
}

// ------------------------------------------------------------------------------------------
// gameFileAt(ref) -> which path the game file lives at in `ref`: GAME_FILE, GAME_FILE_LEGACY,
// or null if git history is unavailable (or neither path exists at that ref).
// ------------------------------------------------------------------------------------------
// CS029 P1. Asks git directly rather than comparing against the rename commit's SHA, so it needs
// no hardcoded rename-commit literal and cannot go stale as history grows. This is the ONE place
// in the suite that genuinely cannot know which name applies — every other site is pinned to
// either HEAD (always the new name) or a pre-rename PRE_*_REF literal (always the legacy name),
// and stays that way. Do not refactor those sites onto this helper (§2.4/FORK-CS029-B).
const GAME_FILE        = "orbital-overhaul.html";
const GAME_FILE_LEGACY = "asteroids-deluxe.html";   // pre-CS029 history only

function gameFileAt(ref) {
  if (!ref) return null;
  try {
    git(["cat-file", "-e", ref + ":" + GAME_FILE]);
    return GAME_FILE;
  } catch (e) {
    try {
      git(["cat-file", "-e", ref + ":" + GAME_FILE_LEGACY]);
      return GAME_FILE_LEGACY;
    } catch (e2) {
      return null;   // not a git checkout, ref unreachable, or neither path exists there
    }
  }
}

// ------------------------------------------------------------------------------------------
// parentSource(sha) -> the parent build's <script> text, or null if git history is unavailable.
// ------------------------------------------------------------------------------------------
// Lifted from test-cs025-p2.js:174. `sha` is the phase's own hardcoded PARENT_SHA literal. The
// caller then feeds the returned source to its own headless factory, exactly as before — this
// helper deliberately does NOT build, because every test file's factory has its own stub set and
// its own export list.
//
// The `git()` wrapper above swallows git's own stderr, so a shallow clone's `fatal: bad revision`
// never reaches the run's output — SKIP_TAG is the report.
//
// Routed through gameFileAt() (CS029 P1) since this is the one helper handed both pre- and
// post-rename SHAs — existing pins pass pre-rename SHAs, every future changeset passes post-rename.
function parentSource(sha) {
  if (!sha) return null;
  const file = gameFileAt(sha);
  if (!file) return null;
  try {
    const prev = git(["show", sha + ":" + file],
      { maxBuffer: 64 * 1024 * 1024 });
    const m = prev.match(/<script>([\s\S]*?)<\/script>/);
    return m ? m[1] : null;
  } catch (e) {
    return null;   // not a git checkout, or the parent is unreachable
  }
}

// ------------------------------------------------------------------------------------------
// ownCommits(parentSha, subjectPrefix) -> ALL commits in parentSha..HEAD whose subject starts
// with subjectPrefix, newest first; or null if git history is unavailable.
// ------------------------------------------------------------------------------------------
// Lifted from test-cs025-p2.js:1185. The plural form is the raw one because the count carries
// three distinct meanings the singular cannot express, and every existing caller checks all three:
//   0  -> the phase has not committed yet (a pre-commit run, which is how the phase's own session
//         sees it); fall back to the working tree.
//   1  -> the normal case.
//   >1 -> AMBIGUOUS. Two commits share the subject prefix and the pin no longer names one commit;
//         callers report this as a FAILURE, not a skip. Folding this into `ownCommit` would hide
//         it behind a `null` that also means "not yet committed", which are opposite situations.
function ownCommits(parentSha, subjectPrefix) {
  if (!parentSha || !subjectPrefix) return null;
  try {
    return git(["log", "--format=%H", "--grep", "^" + subjectPrefix, parentSha + "..HEAD"]).trim().split("\n").filter(Boolean);
  } catch (e) {
    return null;
  }
}

// ------------------------------------------------------------------------------------------
// ownCommit(parentSha, subjectPrefix) -> the SHA of this phase's own commit, or null before it
// exists (and null when history is unavailable, or when the match is ambiguous).
// ------------------------------------------------------------------------------------------
// The §4.1 export. A thin, deliberately unambiguous wrapper over `ownCommits`: it answers ONLY
// "is there exactly one commit for this phase, and what is it?". Callers that need to tell
// "not yet" apart from "ambiguous" — and the TRAP pins in test-cs025-p1/p2 do — use `ownCommits`.
function ownCommit(parentSha, subjectPrefix) {
  const shas = ownCommits(parentSha, subjectPrefix);
  return shas && shas.length === 1 ? shas[0] : null;
}

// ------------------------------------------------------------------------------------------
// changedFiles(fromSha, toSha) -> the `git diff --name-only` list, or null if git history is
// unavailable.
// ------------------------------------------------------------------------------------------
// Lifted from test-cs025-p2.js:1191, plus that site's PRE-COMMIT fallback (:1197-1203) folded in
// under a single natural signature: `toSha == null` MEANS THE WORKING TREE. That is the state a
// phase's own session is always in — the phase's commit does not exist while the phase is being
// built, and the new test file is itself untracked until it lands — so the fallback also lists
// untracked files (`git ls-files --others --exclude-standard`). A caller passing `toSha === null`
// knows its measurement is PROVISIONAL and says so in its output.
//
// ⛔ `parent..worktree` is a provisional reading, NOT a substitute for `parent..ownCommit`. Once
// the phase is committed the pin must read the commit range: a working-tree reading starts failing
// the moment any LATER phase legitimately edits a file, which is precisely the moving-reference
// defect this whole helper exists to stop.
function changedFiles(fromSha, toSha) {
  if (!fromSha) return null;
  try {
    if (toSha) {
      return git(["diff", "--name-only", fromSha, toSha])
        .trim().split("\n").filter(Boolean);
    }
    const tracked = git(["diff", "--name-only", fromSha])
      .trim().split("\n").filter(Boolean);
    const untracked = git(["ls-files", "--others", "--exclude-standard"])
      .trim().split("\n").filter(Boolean);
    return [...new Set([...tracked, ...untracked])];
  } catch (e) {
    return null;
  }
}

// ------------------------------------------------------------------------------------------
// outsideScope(changed, extra) -> the changed files a phase is NOT allowed to have touched.
// ------------------------------------------------------------------------------------------
// Added by CS027 P2. The "nothing else moved" allowlist was written out longhand at every pin:
//
//   const outside = changed.filter(f =>
//     !f.startsWith("scratchpad/") && f !== "STATUS.md" && f !== "orbital-overhaul.html");
//
// Six files carried a copy, in five slightly different shapes. The BASE allowlist is the set
// every phase may touch by standing instruction — the game file, its own tests, the build-reality
// doc, and (from CS027 P4) the per-changeset log a closing phase writes. Anything else is the
// phase's own business and comes in through `extra`.
//
// ⛔ PASS EXTRAS, DO NOT EDIT THE BASE. A closing phase's doc sweep is `outsideScope(changed,
// ["ORBITAL-OVERHAUL-GDD.md", "DIFFICULTY-LEVERS.md", "CLAUDE.md"])`, not a wider base — the
// base is what makes an unlisted file in an ordinary phase's diff visible.
//
// An entry ending in "/" is a directory prefix; anything else is an exact path. `changed` is
// `changedFiles()`'s output, so a null (git unavailable) must be handled by the CALLER with a
// loud SKIP — passing null here throws rather than quietly returning "nothing outside scope".
//
// ⛔ CS029 P1 — BOTH game-file names are in the base, permanently. `outsideScope()` is called by
// already-landed phases' own scope pins, which diff PARENT_SHA..ownCommit ranges that predate the
// rename and correctly list `asteroids-deluxe.html` as changed. Swapping the entry to the new name
// outright (the obvious fix for the SCOPE_BASE landmine, §2.2) makes every one of those historical
// pins report the game file as out-of-scope. Both names identify the one game file across time; an
// allowlist that only recognizes today's spelling breaks yesterday's diffs.
const SCOPE_BASE = [
  "orbital-overhaul.html",
  "asteroids-deluxe.html",   // pre-CS029 diffs name the game file this way — see GAME_FILE_LEGACY
  "STATUS.md",
  "scratchpad/",
  "log/",            // CS027 P4 onward: the per-changeset narrative log
];
function outsideScope(changed, extra) {
  if (!Array.isArray(changed)) {
    throw new TypeError("outsideScope: `changed` must be an array — a null from changedFiles() is a SKIP, not a pass");
  }
  const allow = SCOPE_BASE.concat(extra || []);
  return changed.filter(f =>
    !allow.some(a => (a.endsWith("/") ? f.startsWith(a) : f === a)));
}

module.exports = {
  parentSource, ownCommit, ownCommits, changedFiles, outsideScope,
  SKIP_TAG, SCOPE_BASE, repoRoot,
  GAME_FILE, GAME_FILE_LEGACY, gameFileAt,
};
