// scratchpad/run-all.js — discovers and runs every scratchpad/test-*.js in its own child process.
// Built by CS027 P1 per IMPLEMENTATION-PHASES-CS027.md P1.
//
//   node scratchpad/run-all.js [--only <substring>] [--quiet]
//
// Discovery: scratchpad/test-*.js, excluding `_`-prefixed helpers (_phase-ref.js,
// _seeded-random.js) and diag-*.js (diag-chain-iter.js is a manual repro tool, not a pass/fail
// test — it has no assertion counters and no `passed/failed` exit convention).
//
// Per-file bucket (mutually exclusive):
//   TIMEOUT — killed after TIMEOUT_MS. Detected via err.signal: a normal test failure exits
//             through `process.exit(1)` (status set, signal null); execFileSync's own timeout
//             kill is the only path that sets a signal, so a present signal IS the timeout tell.
//   FAILED  — nonzero exit code, not a timeout.
//   SKIPPED — exit 0, but stdout contains >=1 occurrence of SKIP_TAG (git history unavailable
//             for a phase-local pin — see scratchpad/_phase-ref.js). Not a failure: the suite's
//             own standing design is that a skip is a loud, visible non-answer, and only a
//             changeset's closing phase asserts the count is zero.
//   PASSED  — exit 0, no SKIP_TAG occurrences.
//
// Exits non-zero iff any file is FAILED or TIMEOUT.
//
// TIMEOUT_MS starts at 120s per the phase prompt: several suite files drive 200-level runs, and
// one (test-cs018-p4.js) was known to flake 2-in-12 before seeding landed (CS026 P1). A timeout
// that is too tight would manufacture failures indistinguishable from real ones, so this runner
// does not retry, does not treat a timeout as more suspicious than any other failure, and reports
// the actual wall time for every file (including passing ones) so a future tightening of
// TIMEOUT_MS has real numbers to work from instead of a guess.

"use strict";

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const TIMEOUT_MS = 120000;
const MAX_BUFFER = 64 * 1024 * 1024;
const SKIP_TAG = "SKIPPED (no git history)";
const TAIL_LINES = 20;

const scratchDir = __dirname;
const repoRoot = path.join(scratchDir, "..");

function parseArgs(argv) {
  const opts = { only: null, quiet: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--only") opts.only = argv[++i];
    else if (argv[i] === "--quiet") opts.quiet = true;
    else {
      console.error(`Unknown argument: ${argv[i]}`);
      process.exit(2);
    }
  }
  return opts;
}

function discover(only) {
  let files = fs.readdirSync(scratchDir)
    .filter(f => /^test-.*\.js$/.test(f))
    .filter(f => !f.startsWith("_"))
    .filter(f => !f.startsWith("diag-"))
    .sort();
  if (only) files = files.filter(f => f.includes(only));
  return files;
}

function tail(text, n) {
  if (!text) return "";
  const lines = text.replace(/\n$/, "").split("\n");
  return lines.slice(-n).join("\n");
}

function countOccurrences(text, needle) {
  if (!text) return 0;
  return text.split(needle).length - 1;
}

function runOne(file) {
  const fullPath = path.join(scratchDir, file);
  const start = Date.now();
  let stdout = "", stderr = "", exitCode = null, timedOut = false;
  try {
    stdout = execFileSync(process.execPath, [fullPath], {
      cwd: repoRoot,
      timeout: TIMEOUT_MS,
      killSignal: "SIGKILL",
      maxBuffer: MAX_BUFFER,
      encoding: "utf8",
    });
    exitCode = 0;
  } catch (err) {
    stdout = err.stdout != null ? err.stdout.toString() : "";
    stderr = err.stderr != null ? err.stderr.toString() : "";
    exitCode = typeof err.status === "number" ? err.status : null;
    if (err.signal) timedOut = true;
  }
  const wallMs = Date.now() - start;
  const skipCount = countOccurrences(stdout, SKIP_TAG);

  let bucket;
  if (timedOut) bucket = "TIMEOUT";
  else if (exitCode !== 0) bucket = "FAILED";
  else if (skipCount > 0) bucket = "SKIPPED";
  else bucket = "PASSED";

  return { file, bucket, wallMs, exitCode, skipCount, stdout, stderr };
}

function fmtSecs(ms) {
  return (ms / 1000).toFixed(2) + "s";
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const files = discover(opts.only);
  if (files.length === 0) {
    console.log(opts.only ? `No test files match --only "${opts.only}".` : "No test files found.");
    process.exit(0);
  }

  const results = [];
  for (const file of files) {
    const r = runOne(file);
    results.push(r);
    if (!opts.quiet || r.bucket === "FAILED" || r.bucket === "TIMEOUT") {
      const skipNote = r.skipCount > 0 ? `  (${r.skipCount} skip${r.skipCount === 1 ? "" : "s"})` : "";
      const exitNote = r.bucket === "FAILED" ? `  exit=${r.exitCode}` : "";
      console.log(`${r.bucket.padEnd(7)} ${file.padEnd(30)} ${fmtSecs(r.wallMs).padStart(9)}${exitNote}${skipNote}`);
      if (r.bucket === "FAILED" || r.bucket === "TIMEOUT") {
        const diag = r.stderr.trim() ? r.stderr : r.stdout;
        const t = tail(diag, TAIL_LINES);
        if (t) console.log(t.split("\n").map(l => "    " + l).join("\n"));
      }
    }
  }

  const passed = results.filter(r => r.bucket === "PASSED");
  const failed = results.filter(r => r.bucket === "FAILED");
  const skipped = results.filter(r => r.bucket === "SKIPPED");
  const timedOut = results.filter(r => r.bucket === "TIMEOUT");
  const totalMs = results.reduce((s, r) => s + r.wallMs, 0);
  const slowest = [...results].sort((a, b) => b.wallMs - a.wallMs).slice(0, 5);

  console.log("");
  console.log(`${results.length} files: ${passed.length} passed, ${failed.length} failed, ` +
    `${skipped.length} skipped, ${timedOut.length} timed out`);
  console.log(`Total wall time: ${fmtSecs(totalMs)}`);
  console.log("");
  console.log("Slowest 5:");
  for (const r of slowest) console.log(`  ${r.file.padEnd(30)} ${fmtSecs(r.wallMs)}`);

  if (failed.length || timedOut.length) {
    console.log("");
    console.log("Failures / timeouts:");
    for (const r of [...failed, ...timedOut]) console.log(`  ${r.file} (${r.bucket})`);
  }

  process.exit(failed.length || timedOut.length ? 1 : 0);
}

main();
