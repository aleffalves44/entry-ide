#!/usr/bin/env node
// Stage the runtime deps that `src-tauri/bridge/hermes-claude-bridge.mjs`
// imports (the Claude Agent SDK + zod + transitive deps + the host-platform
// native `claude` binary) into `src-tauri/bridge/node_modules/`, where Tauri's
// `bundle.resources` glob picks them up and ships them inside the .app's
// Resources/.
//
// Without this, the bundled bridge crashes on first session with
// `ERR_MODULE_NOT_FOUND: @anthropic-ai/claude-agent-sdk` because there is no
// node_modules adjacent to it (root cause of the v1.1.2 Agent-mode regression).

import { execFileSync } from "node:child_process";
import { existsSync, statSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const BRIDGE_DIR = resolve(HERE, "..", "src-tauri", "bridge");
const BRIDGE_PKG = resolve(BRIDGE_DIR, "package.json");
const BRIDGE_LOCK = resolve(BRIDGE_DIR, "package-lock.json");
const BRIDGE_NM = resolve(BRIDGE_DIR, "node_modules");

if (!existsSync(BRIDGE_PKG)) {
  console.error(`[stage-bridge-deps] missing ${BRIDGE_PKG}`);
  process.exit(1);
}

const force = process.argv.includes("--force");
if (!force && existsSync(BRIDGE_NM)) {
  const nmTime = statSync(BRIDGE_NM).mtimeMs;
  const pkgTime = statSync(BRIDGE_PKG).mtimeMs;
  const lockTime = existsSync(BRIDGE_LOCK) ? statSync(BRIDGE_LOCK).mtimeMs : 0;
  if (nmTime >= Math.max(pkgTime, lockTime)) {
    console.log("[stage-bridge-deps] node_modules up to date — skipping");
    process.exit(0);
  }
}

mkdirSync(BRIDGE_DIR, { recursive: true });

const useCi = existsSync(BRIDGE_LOCK);
const args = useCi
  ? ["ci", "--omit=dev", "--no-audit", "--no-fund"]
  : ["install", "--omit=dev", "--no-audit", "--no-fund"];

console.log(`[stage-bridge-deps] running 'npm ${args.join(" ")}' in ${BRIDGE_DIR}`);
// Node 20+ on Windows refuses to spawnSync a .cmd file directly without
// shell:true (EINVAL — CVE-2024-27980 mitigation), so always go through
// the shell.  Args are static so there's no injection surface.
const isWindows = process.platform === "win32";
const npmCmd = isWindows ? "npm.cmd" : "npm";
execFileSync(npmCmd, args, { cwd: BRIDGE_DIR, stdio: "inherit", shell: isWindows });
console.log("[stage-bridge-deps] done");
