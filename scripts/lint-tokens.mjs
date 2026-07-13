#!/usr/bin/env node
// Token discipline linter for Entry IDE component CSS.
//
// Enforces the design-system rules from docs/design-system/ (P4, P6, and
// the elevation doc) by failing when component CSS re-introduces a
// hardcoded value that a token already covers:
//
//   1. box-shadow with a raw rgba(0,0,0,…) tint  → must use --shadow-1..4
//   2. cubic-bezier(…) easing                    → must use --ease-*
//   3. raw duration (ms/s) in transition/animation (non-loop) → --dur-*
//   4. z-index: <number>                         → must use --z-*
//
// Allow-lists keep the legitimate literals (loop-animation content
// timing, the canonical .entry-progress/.entry-skel utilities, theme
// shadow definitions in tokens.css/themes.css themselves).
//
// Run:  npm run lint:tokens
// Exit non-zero on any violation.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(process.cwd(), "src", "styles");
const COMPONENTS = join(ROOT, "components");

// Files that DEFINE tokens, not consume them — never lint them.
const SKIP_FILES = new Set(["tokens.css", "themes.css", "base.css", "layout.css", "topbar.css"]);

// Selectors allowed to keep raw shadow literals: the canonical motion
// utilities defined in base.css (they ARE the token-backed primitives).
const ALLOW_SHADOW_SELECTORS = new Set([
  ".entry-progress",
  ".entry-progress::after",
  ".entry-skel",
]);

const SHADOW_RE = /box-shadow:\s*[^;]*rgba\(\s*0\s*,\s*0\s*,\s*0\s*,/i;
const EASING_RE = /cubic-bezier\(/i;
// z-index literal (not a var()).
const ZINDEX_RE = /z-index:\s*\d+\s*;/i;
// transition/animation line with a raw duration, excluding loop content
// timing (lines carrying `infinite`) and easing/keyword tokens.
const TIMING_LINE_RE = /^\s*(transition|animation)\s*:/i;
const DUR_RE = /(?<![\w-])(\d+(?:\.\d+)?)(ms|s)(?![\w-])/i;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (name.endsWith(".css")) out.push(p);
  }
  return out;
}

function currentSelector(lines, idx) {
  // Walk backward to find the selector block opening this declaration.
  for (let i = idx; i >= 0; i--) {
    const ln = lines[i];
    if (ln.includes("{")) {
      // Join preceding comma-continuation lines.
      let sel = ln;
      for (let j = i - 1; j >= 0 && /^[^{}]*,\s*$/.test(lines[j]); j--) {
        sel = lines[j] + sel;
      }
      return sel.replace(/[{}]/g, "").trim();
    }
  }
  return "";
}

let violations = 0;
const files = walk(COMPONENTS);

for (const file of files) {
  const rel = relative(process.cwd(), file);
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");

  lines.forEach((line, i) => {
    const lineno = i + 1;
    const sel = currentSelector(lines, i);

    // 1. raw rgba shadow
    if (SHADOW_RE.test(line) && !ALLOW_SHADOW_SELECTORS.has(sel)) {
      console.error(`  ${rel}:${lineno}  raw rgba shadow — use --shadow-1..4`);
      console.error(`    ${line.trim()}`);
      violations++;
    }

    // 2. manual cubic-bezier easing
    if (EASING_RE.test(line)) {
      console.error(`  ${rel}:${lineno}  manual cubic-bezier — use --ease-*`);
      console.error(`    ${line.trim()}`);
      violations++;
    }

    // 3. raw duration on a non-loop transition/animation line
    if (TIMING_LINE_RE.test(line) && !/\binfinite\b/.test(line) && DUR_RE.test(line)) {
      // allow if every timing value is already a var(--dur-*) (the regex
      // above only fires on a bare number, so this is a real violation)
      console.error(`  ${rel}:${lineno}  raw duration — use --dur-*/--ease-*`);
      console.error(`    ${line.trim()}`);
      violations++;
    }

    // 4. literal z-index
    if (ZINDEX_RE.test(line)) {
      console.error(`  ${rel}:${lineno}  literal z-index — use --z-*`);
      console.error(`    ${line.trim()}`);
      violations++;
    }
  });
}

if (violations === 0) {
  console.log("lint:tokens — OK (0 violations)");
  process.exit(0);
}
console.error(`\nlint:tokens — ${violations} violation(s)`);
process.exit(1);